#!/usr/bin/env python3
"""NOVA günlük sağlık kontrolü.

Kullanım (depo kökünden):  python3 tests/check.py [--quick]
  1) src/ derlenir ve yayındaki index.html ile karşılaştırılır (biri index.html'i elle değiştirdiyse yakalar)
  2) index.html tarayıcıda açılır: menüler, mağaza (desenli skinler, öldürme efektleri, kasa açma), ayarlar, dil
  3) Her haritada botlarla maç oynatılır (--quick değilse 2 haritada TAM maç)
  3b) PARKUR modu: botlarla 5 raunt (--quick: 1 raunt)
  3c) SİLAH YARIŞI ve SÜPERNOVA: botlarla maç (--quick: 4 dk)
  4) Tek oyunculu arayüz akışı (ajan seçimi → sinematik giriş → oyun → çizim) + PARKUR arayüz akışı
  4c) Kontrol ayarları (tuş atama, dokunmatik düzen) · 4d) Oyun kolu (sahte standart kol: menü gezinme, oyunda tuşlar, telefonda dokunmatik gizleme)
  5) Çok oyunculu: yerel eşleştirme sunucusuyla host + istemci (oda, katılma, maç, hareket, sohbet, ses) + PARKUR eşitlemesi
  6) Herkese açık sunucu eşleşmesi (yerel Firebase taklidiyle)
Çıkış kodu 0 = sorun yok. Her bulgu "FAIL:" ile başlar.
"""
import functools, http.server, json, os, socketserver, subprocess, sys, tempfile, threading, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUICK = '--quick' in sys.argv
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
ARGS = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
        '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--disable-features=WebRtcHideLocalIpsWithMdns']
FAILS = []
def fail(msg): FAILS.append(msg); print('FAIL:', msg, flush=True)
def ok(msg): print('ok  :', msg, flush=True)

# ---------- 1) derleme tutarlılığı ----------
tmp = tempfile.mkdtemp()
built = os.path.join(tmp, 'built.html')
subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'build.py'), os.path.join(ROOT, 'src'), built], check=True, capture_output=True)
chk = subprocess.run(['node', '--check', built + '.js'], capture_output=True, text=True)
if chk.returncode: fail('src/ JavaScript sözdizimi hatası: ' + chk.stderr[:600])
else: ok('src/ derlendi, sözdizimi temiz')
if open(built, encoding='utf-8').read() != open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read():
    fail('index.html, src/ derlemesiyle AYNI DEĞİL (biri index.html\'i elle değiştirmiş ya da derlemeyi unutmuş). '
         'Farkı src/ içine işle, sonra: python3 tools/build.py src index.html')
else: ok('index.html = src/ derlemesi')

# ---------- yerel sunucular ----------
class Q(socketserver.TCPServer): allow_reuse_address = True
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = Q(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT))
PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
SIG, FBP = PORT + 1, PORT + 2
sig = subprocess.Popen([sys.executable, os.path.join(ROOT, 'tests', 'sigserver.py'), str(SIG)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fb = subprocess.Popen([sys.executable, os.path.join(ROOT, 'tests', 'fbmock.py'), str(FBP)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
URL = f'http://127.0.0.1:{PORT}/index.html'
INIT = ("window.__NOSPLASH=1;window.__PEER_OPTS={host:'127.0.0.1',port:%d,secure:false,path:'/'};" % SIG +
        "window.__FB_OPTS={auth:'http://127.0.0.1:%d/v1/',tok:'http://127.0.0.1:%d/token',db:'http://127.0.0.1:%d/db'};" % (FBP, FBP, FBP) +
        "try{localStorage.setItem('spk_mus','0');localStorage.setItem('spk_gfx','low');localStorage.setItem('spk_guest','1');}catch(e){}")

def page(ctx, tag, errs, nick, vw=None, init=''):
    pg = ctx.new_page()
    if vw: pg.set_viewport_size(vw)
    pg.on('pageerror', lambda e: errs.append(f'{tag} sayfa hatası: {e} {str(e.stack)[:400]}'))
    pg.on('console', lambda m: errs.append(f'{tag} konsol hatası: {m.text[:300]}') if m.type == 'error' and 'Failed to load' not in m.text and 'ERR_' not in m.text else None)
    pg.add_init_script(INIT + init + ("try{localStorage.setItem('spk_nick',%s);}catch(e){}" % json.dumps(nick)))
    pg.goto(URL); pg.wait_for_timeout(700)
    if pg.is_visible('#accOv'):
        try: pg.click('#accGuest'); pg.wait_for_timeout(200)
        except Exception: pass
    return pg

def until(pg, js, n=60, step=250):
    for _ in range(n):
        try:
            if pg.evaluate(js): return True
        except Exception: pass
        pg.wait_for_timeout(step)
    return False

def report_errs(errs, where):
    if errs:
        uniq = list(dict.fromkeys(errs))
        fail(f'{where}: {len(uniq)} farklı tarayıcı hatası, ilki: {uniq[0]}')
        for e in uniq[1:5]: print('      ', e)
    else: ok(f'{where}: tarayıcı hatası yok')

try:
  with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=ARGS)

    # ---------- 1b) açılış ekranı (OZN studios → NOVA yükleme) ----------
    errs = []
    ctx = b.new_context(viewport={'width': 960, 'height': 540})
    try:
        SP = ctx.new_page()
        SP.on('pageerror', lambda e: errs.append(f'AÇILIŞ sayfa hatası: {e}'))
        SP.add_init_script("try{localStorage.setItem('spk_mus','0');localStorage.setItem('spk_guest','1');localStorage.setItem('spk_nick','Acilis');}catch(e){}")
        SP.goto(URL); SP.wait_for_timeout(300)
        if not SP.evaluate("() => !!document.getElementById('splash') && document.getElementById('splash').classList.contains('on')"): fail('açılış ekranı görünmedi')
        elif not until(SP, "() => !document.getElementById('splash') && UI.screen==='scr-menu'", 60): fail('açılış ekranı kapanmadı / menü gelmedi')
        else: ok('açılış ekranı: OZN studios → NOVA yükleme → menü')
    except Exception as e: fail('açılış ekranı: ' + str(e)[:300])
    report_errs(errs, 'açılış ekranı')
    ctx.close()

    # ---------- 2) menüler ----------
    errs = []
    ctx = b.new_context(viewport={'width': 1100, 'height': 680}, permissions=['microphone'])
    M = page(ctx, 'MENÜ', errs, 'Kontrol')
    try:
        M.click('#btnStore'); M.wait_for_timeout(300)
        for tab, want in (('sw', 5), ('ws', 40), ('cs', 40), ('kf', 12), ('cr', 3)):
            M.click(f'#stTabs button[data-tab={tab}]'); M.wait_for_timeout(250)
            n = M.evaluate("() => document.querySelectorAll('#stGrid .sc').length")
            if n < want: fail(f'mağaza sekmesi {tab}: yalnızca {n} kart')
        # öldürme efekti satın al + kuşan; kasaya özel eşya satın alınamaz
        r = M.evaluate("() => { SHOP.prof.gems = 20000; SHOP.save(); const a = SHOP.buy('kf', 'k04'), b = SHOP.buy('ws', 'w41'); return [a, b, SHOP.prof.kfx, SHOP.cos().kf, SHOP.prof.gems]; }")
        if r[:4] != ['ok', 'ex', 'k04', 'k04'] or r[4] != 20000 - 1600: fail(f'mağaza: öldürme efekti alma / kasaya özel eşya kuralı bozuk {r}')
        # KASA: arayüzden aç, atla, sonuç; gems düşer, eşya envantere girer (kopyaysa iade)
        M.click('#stTabs button[data-tab=cr]'); M.wait_for_timeout(250)
        g0 = M.evaluate("() => SHOP.prof.gems")
        M.click('#stGrid .sc.case >> nth=0 >> button'); M.wait_for_timeout(700)
        if not M.evaluate("() => UI.caseOpen && CASEUI.spin && !$('caseOv').classList.contains('hidden')"): fail('kasa açılış ekranı / dönen şerit başlamadı')
        M.click('#caseSkip'); M.wait_for_timeout(300)
        r = M.evaluate("() => { const r = CASEUI.res; return { vis: !$('caseRes').classList.contains('hidden'), own: SHOP.owns(r.kind, r.id), dup: r.dup, ref: r.refund, gems: SHOP.prof.gems, spin: CASEUI.spin }; }")
        price = M.evaluate("() => CASEM.cs1.price")
        if not r['vis'] or r['spin'] or not r['own'] or r['gems'] != g0 - price + (r['ref'] if r['dup'] else 0): fail(f'kasa sonucu hatalı {r} (önce {g0})')
        M.keyboard.press('Escape'); M.wait_for_timeout(200)
        if M.evaluate("() => UI.caseOpen || !$('caseOv').classList.contains('hidden')"): fail('kasa ekranı ESC ile kapanmadı')
        st = M.evaluate("() => { const save = JSON.stringify(SHOP.prof); SHOP.prof.gems = 1e9; const n = {}; let bad = 0; for (const c of CASES) for (let i = 0; i < 600; i++) { const r = SHOP.openCase(c.id); if (r.r !== 'ok' || !SHOP.owns(r.kind, r.id)) bad++; n[r.rar] = (n[r.rar] || 0) + 1; } SHOP.prof = SHOP.fix(JSON.parse(save)); SHOP.save(); return { n, bad, sum: CASES.map(c => Math.round(caseOdds(c).reduce((a, o) => a + o.p, 0))) }; }")
        if st['bad'] or any(s != 100 for s in st['sum']) or not st['n'].get('gold'): fail(f'kasa olasılıkları / açılışları hatalı {st}')
        else: ok(f"kasalar: arayüzden açıldı, 1800 açılışta nadirlik dağılımı {st['n']}")
        M.click('#scr-store [data-back]'); M.wait_for_timeout(200)
        M.click('#btnSettings'); M.wait_for_timeout(200); M.evaluate("() => closeSettings && closeSettings()")
        M.click('#btnSettings'); M.wait_for_timeout(200); M.click('#btnFriends'); M.wait_for_timeout(200); M.click('#scr-friends [data-back]'); M.wait_for_timeout(200)
        M.click('#btnSettings'); M.wait_for_timeout(200); M.click('#btnHelp'); M.wait_for_timeout(200); M.click('#scr-help [data-back]'); M.wait_for_timeout(200)
        M.click('#btnPlay'); M.wait_for_timeout(200)
        if not M.is_visible('#btnSP') or not M.is_visible('#btnPub'): fail('OYNA ekranında oyun türleri görünmüyor')
        M.click('#scr-play [data-back]'); M.wait_for_timeout(200)
        M.evaluate("() => setLang('en')"); M.wait_for_timeout(200); M.evaluate("() => setLang('tr')")
        ok('menü, mağaza, ayarlar, arkadaşlar, dil açıldı')
    except Exception as e: fail('menü gezintisi: ' + str(e)[:300])

    # ---------- 3) botlarla maçlar (tüm haritalar) ----------
    M.evaluate("""() => { window.__start = (mi, i) => {
        const A=['vex','ignis','mist','aegis','pulse'], B=['chrono','terra','vital','volt','phantom'];
        const t0 = i%2 ? B : A, t1 = i%2 ? A : B, roster=[];
        t0.forEach((a,j)=>roster.push({id:j?'x'+j:'h',name:a,team:0,agent:a,bot:j>0,cos:j%2?(j===1?{sw:4,ws:'w20',cs:'c20',kf:'k04'}:{sw:4,ws:'w42',cs:'c43',kf:'k13'}):{ws:'w40',cs:'c40',kf:['k03','k11'][j%4>>1]}}));
        t1.forEach((a,j)=>roster.push({id:'y'+j,name:a,team:1,agent:a,bot:true}));
        NET.mode='off'; G.myId='h'; launchGame(roster, {teamSize:5, fill:true, diff:['kolay','normal','zor'][i%3], map:mi});
        const me=S.pmap.h; me.ctrl='bot'; me.isBot=true; me.ai=newAI(me); G.paused=true; }; }""")
    nmaps = M.evaluate("() => MAPS.length")
    full = set() if QUICK else {0, nmaps - 1}
    for mi in range(nmaps):
        before = len(errs)
        try:
            M.evaluate(f"() => __start({mi}, {mi})")
            limit = 4200 if mi in full else 150
            sim, r = 0, None
            while True:
                r = M.evaluate("() => { for (let i=0;i<3600;i++){ hostTick(SIM_DT); S.evq.length=0; if (S.phase==='over') break; } render(1/60); return {phase:S.phase, round:S.round, score:S.score, map:MAPS[CUR_MAP].id}; }")
                sim += 60
                if r['phase'] == 'over' or sim >= limit: break
            if mi in full and r['phase'] != 'over': fail(f"harita {r['map']}: tam maç {sim} sn'de bitmedi ({r})")
            elif len(errs) == before: ok(f"harita {mi} {r['map']}: {'TAM maç ' + str(r['score']) if mi in full else str(r['round']) + '. raunda kadar'} hatasız")
        except Exception as e: fail(f'harita {mi}: ' + str(e)[:300])
    # ---------- 3b) PARKUR: botlarla 5 raunt ----------
    try:
        M.evaluate("""() => { const A=['vex','ignis','mist','aegis','pulse'], B=['chrono','terra','vital','volt','phantom'], roster=[];
            A.forEach((a,j)=>roster.push({id:j?'x'+j:'h',name:a,team:0,agent:a,bot:j>0})); B.forEach((a,j)=>roster.push({id:'y'+j,name:a,team:1,agent:a,bot:true}));
            NET.mode='off'; G.myId='h'; launchGame(roster, {teamSize:5, fill:true, diff:'normal', map:0, mode:'pk', pkSeed: 777});
            const me=S.pmap.h; me.ctrl='bot'; me.isBot=true; me.ai=pkNewAI(me); G.paused=true;
            window.__pkr=[]; const o=pkEndRound; pkEndRound=(w,r)=>{ window.__pkr.push(r); o(w,r); }; }""")
        want = 1 if QUICK else 5
        sim, r = 0, None
        while sim < 1500:
            r = M.evaluate("() => { for (let i=0;i<3600;i++){ hostTick(SIM_DT); S.evq.length=0; if (S.phase==='over') break; } render(1/60); return {phase:S.phase, round:S.round, ends:window.__pkr.slice(), wins:S.players.reduce((a,p)=>a+(p.pkW||0),0), map:PKMAP&&PKMAP.name}; }")
            sim += 60
            if r['phase'] == 'over' or len(r['ends']) >= want: break
        if len(r['ends']) < want: fail(f'PARKUR: {sim} sn\'de {want} raunt bitmedi ({r})')
        elif r['ends'].count('fin') < max(1, want - 1): fail(f'PARKUR: botlar bitişe varamıyor (raunt sonları: {r["ends"]})')
        elif not QUICK and r['phase'] != 'over': fail(f'PARKUR: 5 raunttan sonra maç bitmedi ({r})')
        else: ok(f"PARKUR: botlarla {len(r['ends'])} raunt ({r['ends'].count('fin')} tanesi bitişe varılarak), harita {r['map']}")
    except Exception as e: fail('PARKUR bot maçı: ' + str(e)[:300])
    # ---------- 3c) SİLAH YARIŞI ve SÜPERNOVA: botlarla maç ----------
    for mode, name in (('gg', 'SİLAH YARIŞI'), ('sn', 'SÜPERNOVA')):
        before = len(errs)
        try:
            M.evaluate("""(mode) => { const A=['vex','ignis','mist','aegis','pulse'], B=['chrono','terra','vital','volt','phantom'], roster=[];
                A.forEach((a,j)=>roster.push({id:j?'x'+j:'h',name:a,team:0,agent:a,bot:j>0})); B.forEach((a,j)=>roster.push({id:'y'+j,name:a,team:1,agent:a,bot:true}));
                NET.mode='off'; G.myId='h'; launchGame(roster, {teamSize:5, fill:true, diff:'normal', map:0, mode});
                const me=S.pmap.h; me.ctrl='bot'; me.isBot=true; me.ai=newAI(me); G.paused=true; }""", mode)
            limit = 240 if QUICK else 900
            sim, r = 0, None
            while sim < limit:
                r = M.evaluate("() => { for (let i=0;i<3600;i++){ hostTick(SIM_DT); S.evq.length=0; if (S.phase==='over') break; } render(1/60); const A=S.arena; return {phase:S.phase, sc:A?A.sc.map(Math.round):null, lv:Math.max(...S.players.map(p=>p.ggL|0)), kills:S.players.reduce((a,p)=>a+p.kills,0), bomb:S.players.some(p=>p.hasBomb)}; }")
                sim += 60
                if r['phase'] == 'over': break
            if r['bomb']: fail(f'{name}: bomba taşıyan oyuncu var')
            elif r['kills'] < 5: fail(f'{name}: botlar savaşmıyor ({r})')
            elif mode == 'gg' and r['lv'] < 2: fail(f'{name}: silah seviyesi ilerlemiyor ({r})')
            elif mode == 'sn' and max(r['sc']) < 10: fail(f'{name}: bölge puanı birikmiyor ({r})')
            elif not QUICK and r['phase'] != 'over': fail(f"{name}: maç {sim} sn'de bitmedi ({r})")
            elif len(errs) == before: ok(f"{name}: botlarla {'TAM maç' if r['phase'] == 'over' else str(sim) + ' sn'} · {r['kills']} öldürme · " + (f"en yüksek seviye {r['lv'] + 1}/8" if mode == 'gg' else f"puan {r['sc']}"))
        except Exception as e: fail(f'{name} bot maçı: ' + str(e)[:300])
    # ---------- 3d) ÖLDÜRME EFEKTLERİ: hepsini baştan sona çiz; 'kill' olayı öldürenin efektini başlatır ----------
    before = len(errs)
    try:
        M.evaluate("""() => { const A=['vex','ignis','mist','aegis','pulse'], B=['chrono','terra','vital','volt','phantom'], roster=[];
            A.forEach((a,j)=>roster.push({id:j?'x'+j:'h',name:a,team:0,agent:a,bot:j>0,cos:{kf:'k05',cs:'c21'}})); B.forEach((a,j)=>roster.push({id:'y'+j,name:a,team:1,agent:a,bot:true,cos:{cs:'c2'+(j+5)}}));
            NET.mode='off'; G.myId='h'; launchGame(roster, {teamSize:5, fill:true, diff:'normal', map:0}); CINE.on=false; G.paused=true; window.__kr = {drawn:0, hidden:0}; }""")
        for kid in M.evaluate("() => KFXS.map(k => k.id)"): # her efekt ayrı adımda (tek görevde yüzlerce kare yazılımsal GPU'yu zaman aşımına sokar)
            M.evaluate("""(kid) => { const k = KFX[kid], me=S.pmap.h, v=S.pmap.y0, out=window.__kr; kfxClear(); v.x = me.x + Math.cos(LOOK.yaw)*150; v.y = me.y + Math.sin(LOOK.yaw)*150; const f = kfxStart(k.id, v, me);
              if (!f) return; if (kfxHides(v.id)) out.hidden++;
              for (let t = 0; t <= k.dur + 0.1; t += 0.2) { S.time = f.t0 + t; render(1/60); } out.drawn++; }""", kid)
            M.wait_for_timeout(30)
        r = M.evaluate("""() => { const me=S.pmap.h, v=S.pmap.y0, out=window.__kr;
            kfxClear(); S.time += 1; S.phase = 'live'; S.phaseT = 100; damage(v, 999, me, 'vandal');
            const kf = KFXA.find(f => f.id === v.id); out.kill = kf ? kf.k : null; out.alive = v.alive;
            S.time += 5; render(1/60); out.left = KFXA.length; out.lost = GLX.gl.isContextLost(); return out; }""")
        if r['drawn'] != M.evaluate("() => KFXS.length") or r['hidden'] != r['drawn']: fail(f'öldürme efektleri çizilemedi {r}')
        elif r['kill'] != 'k05' or r['alive']: fail(f'öldürünce öldürme efekti başlamadı {r}')
        elif r['left']: fail(f'öldürme efekti süresi bitince silinmedi {r}')
        elif r['lost']: fail(f'öldürme efektleri çizilirken WebGL bağlamı kayboldu {r}')
        elif len(errs) == before: ok(f"öldürme efektleri: {r['drawn']} efekt baştan sona çizildi, öldürünce efekt başlıyor")
    except Exception as e: fail('öldürme efektleri: ' + str(e)[:300])
    # ---------- 3e) SİLAH DESENLERİ: her desenli skinin dokusu üretilir, elde ve 3. şahısta desenle çizilir ----------
    before = len(errs)
    try:
        r = M.evaluate("""() => { const me=S.pmap.h, o=S.pmap.x1; for (const q of [me, o]) { q.alive=true; q.primary='vandal'; q.ammo.vandal={mag:25,res:50}; q.slot=1; }
            o.x = me.x + Math.cos(LOOK.yaw)*90; o.y = me.y + Math.sin(LOOK.yaw)*90;
            const L = WSKINS.filter(s => s.pat), out = { n: L.length, cv: 0, tex: 0, uniq: new Set() };
            for (const s of L) { const c = patCanvas(s); if (c && c.width === PAT_S) { out.cv++; out.uniq.add(c.toDataURL().length + s.pat); }
              me.wsk = o.wsk = s.id; S.time += 0.3; render(1/60); if (gunColsFor('vandal', me, S.time).tex) out.tex++; }
            out.uniq = out.uniq.size; out.lost = GLX.gl.isContextLost(); return out; }""")
        if r['n'] < 30 or r['cv'] != r['n'] or r['tex'] != r['n'] or r['uniq'] < r['n'] - 2 or r['lost']: fail(f'silah desenleri üretilemedi / çizilemedi {r}')
        elif len(errs) == before: ok(f"silah desenleri: {r['n']} desenli skin dokusuyla çizildi")
    except Exception as e: fail('silah desenleri: ' + str(e)[:300])
    report_errs(errs, 'menü + bot maçları')
    ctx.close()

    # ---------- 4) tek oyunculu arayüz akışı ----------
    errs = []
    ctx = b.new_context(viewport={'width': 960, 'height': 540})
    S1 = page(ctx, 'TEK', errs, 'Tekci')
    try:
        S1.click('#btnPlay'); S1.click('#btnSP'); S1.click('#btnSpGo'); S1.wait_for_timeout(300)
        S1.click('#selGrid .agent >> nth=0'); S1.click('#btnLock')
        if not until(S1, "() => !!(G.running && S)", 40): fail('tek oyunculu maç başlamadı')
        ci = S1.evaluate("() => [CINE.on, S.phaseT]")
        if not ci[0] or ci[1] <= 20: fail(f'sinematik giriş başlamadı ya da satın alma süresine eklenmedi: {ci}')
        S1.keyboard.press('Space'); S1.wait_for_timeout(300)
        ci = S1.evaluate("() => [CINE.on, S.phaseT]")
        if ci[0] or ci[1] > 20.5: fail(f'sinematik giriş BOŞLUK ile atlanmadı: {ci}')
        else: ok('sinematik giriş: başladı, satın alma süresi korundu, atlanabildi')
        S1.evaluate("() => { S.phase='live'; S.phaseT=60; }")
        S1.keyboard.down('KeyW'); S1.wait_for_timeout(800); S1.keyboard.up('KeyW')
        S1.keyboard.press('F3'); S1.wait_for_timeout(300); S1.keyboard.press('F3'); S1.wait_for_timeout(300); S1.keyboard.press('F3')
        S1.wait_for_timeout(500)
        ok('tek oyunculu: ajan seçimi, hareket, kamera, çizim')
    except Exception as e: fail('tek oyunculu akış: ' + str(e)[:300])
    report_errs(errs, 'tek oyunculu')
    ctx.close()

    # ---------- 4b) PARKUR arayüz akışı ----------
    errs = []
    ctx = b.new_context(viewport={'width': 960, 'height': 540})
    P1 = page(ctx, 'PARKUR', errs, 'Parkurcu')
    try:
        P1.click('#btnPlay'); P1.click('#btnSP'); P1.select_option('#spMode', 'pk'); P1.click('#btnSpGo')
        if not until(P1, "() => !!(G.running && S && PKMAP && S.cfg.mode==='pk')", 40): fail('PARKUR başlamadı')
        P1.keyboard.press('Space')
        if not until(P1, "() => S.phase==='live'", 60): fail('PARKUR geri sayımı bitmedi')
        P1.evaluate("() => { LOOK.yaw = 0; window.__mz = 0; window.__x0 = S.pmap.h.x; setInterval(() => { window.__mz = Math.max(window.__mz, S.pmap.h.jz); }, 16); }")
        P1.keyboard.down('KeyW'); P1.wait_for_timeout(900); P1.keyboard.press('Space'); P1.wait_for_timeout(900); P1.keyboard.up('KeyW')
        mv = P1.evaluate("() => [S.pmap.h.x - window.__x0, window.__mz]")
        if mv[0] < 150: fail(f'PARKUR: oyuncu ilerlemedi ({mv})')
        elif mv[1] < 20: fail(f'PARKUR: zıplama çalışmadı ({mv})')
        P1.evaluate("() => { const me=S.pmap.h; setPos(me, (PKMAP.finX-2)*TILE, (PKMAP.cy+0.5)*TILE); LOOK.yaw=0; }")
        P1.keyboard.down('KeyW'); P1.wait_for_timeout(1500); P1.keyboard.up('KeyW')
        if not until(P1, "() => S.phase==='end' && S.pk.winner==='h'", 20): fail('PARKUR: bitiş çizgisi raundu bitirmedi')
        else: ok('PARKUR: mod seçimi, sinematik, geri sayım, koşu, zıplama, bitiş')
    except Exception as e: fail('PARKUR arayüz akışı: ' + str(e)[:300])
    report_errs(errs, 'parkur')
    ctx.close()

    # ---------- 4c) kontrol ayarları: tuş atama, dokunmatik düzen, moda göre butonlar ----------
    errs = []
    ctx = b.new_context(viewport={'width': 1100, 'height': 700})
    K1 = page(ctx, 'TUŞ', errs, 'Tuscu')
    def sp_go(pg, mode):
        pg.click('#btnPlay'); pg.click('#btnSP'); pg.select_option('#spMode', mode); pg.click('#btnSpGo'); pg.wait_for_timeout(300)
        if mode != 'pk': pg.click('#selGrid .agent >> nth=0'); pg.click('#btnLock')
        if not until(pg, "() => !!(G.running && S)", 40): raise Exception(mode + ' maçı başlamadı')
        pg.evaluate("() => { cineStop(false); S.phase = 'live'; S.phaseT = 200; if (UI.pauseOpen) togglePause(false); updateTouchButtons(); }"); pg.wait_for_timeout(200)
    try:
        K1.click('#btnSettings'); K1.wait_for_timeout(200)
        K1.click('#keyList button[data-k=fwd]'); K1.keyboard.press('KeyI')
        K1.click('#keyList button[data-k=jump]'); K1.keyboard.press('KeyR')
        K1.click('#keyList button[data-k=chat]'); K1.keyboard.press('Escape'); K1.wait_for_timeout(100)
        kb = K1.evaluate("() => [KB.b.fwd.c, KB.b.jump.c, KB.b.reload.c, KB.b.chat.c, UI.setOpen, !!localStorage.getItem('spk_keys')]")
        if kb != ['KeyI', 'KeyR', 'Space', 'key:.', True, True]: fail(f'tuş atama: atama / yer değiştirme / ESC iptal bozuk {kb}')
        K1.click('#btnSetBack'); K1.wait_for_timeout(200)
        sp_go(K1, 'bomb')
        p0 = K1.evaluate("() => [S.pmap.h.x, S.pmap.h.y]")
        K1.keyboard.down('KeyW'); K1.wait_for_timeout(500); K1.keyboard.up('KeyW'); K1.wait_for_timeout(150)
        p1 = K1.evaluate("() => [S.pmap.h.x, S.pmap.h.y]")
        K1.keyboard.down('KeyI'); K1.wait_for_timeout(600); K1.keyboard.up('KeyI'); K1.wait_for_timeout(150)
        p2 = K1.evaluate("() => [S.pmap.h.x, S.pmap.h.y]")
        K1.evaluate("() => { const me = S.pmap.h; me.ammo[curW(me)].mag = 1; }"); K1.keyboard.press('Space'); K1.wait_for_timeout(150)
        rl = K1.evaluate("() => S.pmap.h.reloadT > 0")
        dd = lambda a, c: abs(a[0] - c[0]) + abs(a[1] - c[1])
        if dd(p0, p1) > 5 or dd(p1, p2) < 40 or not rl: fail(f'tuş atama oyunda çalışmıyor: eski W {dd(p0, p1):.0f}, yeni İLERİ {dd(p1, p2):.0f}, BOŞLUK=şarjör {rl}')
        K1.evaluate("() => { uiBackToMenu(); kbReset(); }")
        if K1.evaluate("() => KB.b.fwd.c") != 'KeyW': fail('tuş atama: varsayılana dönmedi')
        else: ok('tuş atama: atandı, çakışan tuşla yer değişti, ESC iptal, oyunda yeni tuşlar çalışıyor, varsayılana döndü')
    except Exception as e: fail('tuş atama: ' + str(e)[:300])
    ctx.close()
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True)
    T1 = page(ctx, 'DOKUNMATİK', errs, 'Dokuncu'); T1.goto(URL + '?touch=1'); T1.wait_for_timeout(700)
    try:
        if T1.is_visible('#accOv'): T1.click('#accGuest'); T1.wait_for_timeout(200)
        T1.click('#btnSettings'); T1.wait_for_timeout(200); T1.click('#btnTouchEdit'); T1.wait_for_timeout(300)
        FR_ = "() => { const r = $('tbFire').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; }"
        r0 = T1.evaluate(FR_)
        T1.mouse.move(r0[0], r0[1]); T1.mouse.down(); T1.mouse.move(r0[0] - 150, r0[1] - 110, steps=8); T1.mouse.up()
        T1.evaluate("() => { $('tedSize').value = 1.4; $('tedSize').oninput(); }"); T1.click('#tedSave'); T1.wait_for_timeout(200)
        sv = T1.evaluate("() => JSON.parse(localStorage.getItem('spk_tlay') || '{}').tbFire || null")
        if not sv or abs(sv['s'] - 1.4) > 0.01: fail(f'dokunmatik düzen kaydedilmedi {sv}')
        T1.reload(); T1.wait_for_timeout(800)
        sp_go(T1, 'bomb')
        r1 = T1.evaluate(FR_)
        if abs(r1[0] - (r0[0] - 150)) > 6 or abs(r1[1] - (r0[1] - 110)) > 6 or r1[2] < r0[2] * 1.3: fail(f'dokunmatik düzen oyunda uygulanmadı: önce {r0}, sonra {r1}')
        VIS = "() => [...document.querySelectorAll('#touch .tb')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.id)"
        seen = {'bomb': T1.evaluate(VIS)}
        for m in ('gg', 'pk', 'fr'):
            T1.evaluate("() => uiBackToMenu()"); T1.wait_for_timeout(200); sp_go(T1, m); seen[m] = T1.evaluate(VIS)
        bad = []
        if not {'tbQ', 'tbE', 'tbX', 'tbUse'} <= set(seen['bomb']) or 'tbMic' in seen['bomb']: bad.append('klasik')
        if set(seen['gg']) & {'tbQ', 'tbE', 'tbX', 'tbUse', 'tbBuy', 'tbDrop'} or 'tbSwap' not in seen['gg']: bad.append('silah yarışı')
        if set(seen['pk']) & {'tbQ', 'tbReload', 'tbSwap', 'tbWalk', 'tbBuy', 'tbUse'} or 'tbJump' not in seen['pk']: bad.append('parkur')
        if set(seen['fr']) & {'tbQ', 'tbUse', 'tbDrop'} or not {'tbBuy', 'tbChat'} <= set(seen['fr']): bad.append('serbest')
        if bad: fail(f'moda göre butonlar yanlış: {bad} {seen}')
        else: ok('dokunmatik düzen: buton taşındı ve büyütüldü, kaydedildi, oyunda uygulandı · her modda yalnızca gerekli butonlar')
    except Exception as e: fail('dokunmatik düzen: ' + str(e)[:300])
    report_errs(errs, 'kontrol ayarları')
    ctx.close()

    # ---------- 4d) oyun kolu (PlayStation / standart kol): bağlanma, menü gezinme, oyunda tuşlar, telefonda dokunmatik gizleme ----------
    # Playwright gerçek kol takamaz: navigator.getGamepads sahte bir standart kol döndürür, durumunu test değiştirir
    PADMOCK = r"""(() => { const btns = []; for (let i = 0; i < 18; i++) btns.push({ pressed: false, touched: false, value: 0 });
      window.__pad = { id: 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)', index: 0, connected: false, mapping: 'standard', axes: [0, 0, 0, 0], buttons: btns, timestamp: 0,
        vibrationActuator: { type: 'dual-rumble', n: 0, playEffect() { this.n++; return Promise.resolve('complete'); } } };
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [window.__pad.connected ? window.__pad : null, null, null, null] });
      window.__frames = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
      window.__tap = async (i) => { const b = __pad.buttons[i]; b.pressed = true; b.value = 1; await __frames(3); b.pressed = false; b.value = 0; await __frames(3); };
      window.__stick = async (a, v, n) => { __pad.axes[a] = v; await __frames(n); __pad.axes[a] = 0; await __frames(2); }; })();"""
    ptap = lambda pg, i: pg.evaluate("(i) => __tap(i)", i)
    pfoc = lambda pg: pg.evaluate("() => PAD.foc ? (PAD.foc.id || PAD.foc.className) : ''")
    PCON = "() => { __pad.connected = true; window.dispatchEvent(new Event('gamepadconnected')); }"
    errs = []
    ctx = b.new_context(viewport={'width': 1100, 'height': 700})
    G1 = page(ctx, 'KOL', errs, 'Kolcu', init=PADMOCK)
    try:
        G1.evaluate(PCON)
        if not until(G1, "() => PAD.idx === 0 && PAD.ps && [...document.querySelectorAll('#toasts .toast')].some(t => t.textContent.includes('PlayStation kolu bağlandı'))", 20): fail('oyun kolu: "PlayStation kolu bağlandı" bildirimi / durumu yok')
        # ana menü: ↓ (ilk basış yalnızca odağı gösterir) ↓ ↓ → AYARLAR · ✕ açar · → kaydırıcı · ○ kapatır · ↑ ✕ → MAĞAZA · R1 sekme · ○ geri
        for i in (13, 13, 13): ptap(G1, i)
        f1 = pfoc(G1); ptap(G1, 0)
        st = G1.evaluate("() => [UI.setOpen, !!document.querySelector('#settings .padfoc'), $('padStat').textContent]")
        G1.evaluate("() => padSetFoc($('padSens'))"); ptap(G1, 15)
        sens = G1.evaluate("() => [PAD.cfg.sens, JSON.parse(localStorage.getItem('spk_pad') || '{}').s]")
        ptap(G1, 1); f2 = pfoc(G1); so = G1.evaluate("() => UI.setOpen")
        en = G1.evaluate("() => { setLang('en'); const t = [$('setPad').querySelector('h4').textContent, $('padStat').textContent, $('padMap').textContent.includes('Switch weapon')]; setLang('tr'); return t; }")
        ptap(G1, 12); G1.evaluate("() => { SHOP.prof.gems = 5000; SHOP.save(); }"); ptap(G1, 0); ptap(G1, 5)
        stv = G1.evaluate("() => [UI.screen, STORE.tab]")
        # kasa: R1 ×3 → KASALAR · ↓ kasa · ✕ seç · ✕ aç · ✕ atla → odak KAPAT'ta (✕'e basmaya devam eden yanlışlıkla yeni kasa almasın) · ○ kapat → odak kasada
        for i in (5, 5, 5, 13, 0, 0): ptap(G1, i)
        until(G1, "() => UI.caseOpen", 12); ptap(G1, 0); G1.wait_for_timeout(250)
        cz = G1.evaluate("() => [STORE.tab, UI.caseOpen, !!CASEUI.spin, PAD.foc && PAD.foc.id]")
        ptap(G1, 1); cz.append(G1.evaluate("() => !UI.caseOpen && !!PAD.foc && PAD.foc.classList.contains('case')"))
        ptap(G1, 1); back = G1.evaluate("() => UI.screen")
        bad = []
        if f1 != 'btnSettings': bad.append(f'↓ ile AYARLAR\'a gelinmedi ({f1})')
        if not st[0] or not st[1] or 'bağlı' not in st[2]: bad.append(f'✕ ile ayarlar / odak / kol durumu {st}')
        if sens[0] <= 1.01 or abs((sens[1] or 0) - sens[0]) > 1e-6: bad.append(f'→ ile kaydırıcı değişmedi / kaydedilmedi {sens}')
        if so or f2 != 'btnSettings': bad.append(f'○ ile ayarlar kapanmadı ya da odak dönmedi ({so}, {f2})')
        if en[0] != 'CONTROLLER' or 'PlayStation controller connected' not in en[1] or not en[2]: bad.append(f'İngilizce çeviri {en}')
        if stv != ['scr-store', 'ws']: bad.append(f'mağaza / R1 sekme {stv}')
        if cz != ['cr', True, False, 'caseClose', True]: bad.append(f'kasa ekranı (sekme, açık, dönüyor, odak, kapanınca odak kasada) {cz}')
        if back != 'scr-menu': bad.append(f'mağazadan ○ ile dönülmedi ({back})')
        if bad: fail('oyun kolu menü gezinmesi: ' + ' · '.join(bad))
        else: ok('oyun kolu: bağlandı bildirimi · menüde ↓ ✕ ○ ile ayarlar ve mağaza, → kaydırıcı, R1 sekme, kasa aç / atla / kapat · İngilizce')
        # tek oyunculu maça yalnızca kolla gir: OYNA → TEK OYUNCULU → AJAN SEÇİMİ → ✕ ajanı seç → ✕ tekrar: KİLİTLE
        ptap(G1, 12); ptap(G1, 0); ptap(G1, 0); ptap(G1, 0)
        until(G1, "() => UI.screen === 'scr-select'", 20); ptap(G1, 15); ptap(G1, 0)
        if not G1.evaluate("() => !!(NET.sel && NET.sel.picks.h)"): raise Exception('ajan seçimi: ✕ ajanı seçmedi (odak: ' + pfoc(G1) + ')')
        ptap(G1, 0)
        if not until(G1, "() => !!(G.running && S)", 40): raise Exception('kolla tek oyunculu maça girilemedi (odak: ' + pfoc(G1) + ')')
        until(G1, "() => CINE.on", 8); ptap(G1, 0)
        r = {'cine': G1.evaluate("() => CINE.on")}
        G1.evaluate("() => { S.phase = 'live'; S.phaseT = 200; window.__mz = 0; setInterval(() => { window.__mz = Math.max(window.__mz, S.pmap.h.jz || 0); }, 16); }")
        p0 = G1.evaluate("() => [S.pmap.h.x, S.pmap.h.y]")
        G1.evaluate("() => { __pad.axes[1] = -1; }"); G1.wait_for_timeout(600); G1.evaluate("() => { __pad.axes[1] = 0; }"); G1.wait_for_timeout(150)
        p1 = G1.evaluate("() => [S.pmap.h.x, S.pmap.h.y]"); r['move'] = round(abs(p1[0] - p0[0]) + abs(p1[1] - p0[1]))
        y0 = G1.evaluate("() => LOOK.yaw"); G1.evaluate("() => __stick(2, 1, 10)"); r['look'] = round(G1.evaluate("() => LOOK.yaw") - y0, 2)
        a0 = G1.evaluate("() => { const me = S.pmap.h; return [me.ammo[curW(me)].mag, MOUSE.fp]; }"); ptap(G1, 7); G1.wait_for_timeout(150)
        a1 = G1.evaluate("() => { const me = S.pmap.h; return [me.ammo[curW(me)].mag, MOUSE.fp, __pad.vibrationActuator.n]; }")
        r['fire'] = a1[0] < a0[0] and a1[1] == a0[1] + 1; r['rumble'] = a1[2] > 0
        ptap(G1, 0); G1.wait_for_timeout(400); r['jump'] = G1.evaluate("() => window.__mz") > 5
        G1.evaluate("() => { const me = S.pmap.h; me.ammo[curW(me)].mag = 1; }"); ptap(G1, 2); r['reload'] = G1.evaluate("() => S.pmap.h.reloadT > 0")
        s0 = G1.evaluate("() => S.pmap.h.slot"); ptap(G1, 3); r['swap'] = G1.evaluate("() => S.pmap.h.slot") != s0
        # basılı tutulanlar: ○ eğil · L2 nişan · ↓ kullan
        G1.evaluate("() => { for (const i of [1, 6, 13]) { __pad.buttons[i].pressed = true; __pad.buttons[i].value = 1; } }"); G1.evaluate("() => __frames(3)")
        r['hold'] = G1.evaluate("() => { const q = buildLocalInput(S.pmap.h); return [q.crouch, q.alt, q.use]; }")
        G1.evaluate("() => { for (const i of [1, 6, 13]) { __pad.buttons[i].pressed = false; __pad.buttons[i].value = 0; } }"); G1.evaluate("() => __frames(3)")
        r['hold'] += G1.evaluate("() => { const q = buildLocalInput(S.pmap.h); return [q.crouch, q.alt, q.use]; }")
        r['labels'] = G1.evaluate("() => [ctlKey('q'), ctlKey('x'), kbHintFix('[F] BASILI TUT: BOMBA KUR'), $('lockHint').classList.contains('hidden')]")
        r['assist'] = G1.evaluate("""() => { const me = S.pmap.h, e = S.players.find(p => p.team !== me.team); e.alive = true; e.st = {}; let ok = false;
            for (let k = 0; k < 16 && !ok; k++) { const a = k * Math.PI / 8, x = me.x + Math.cos(a) * 160, y = me.y + Math.sin(a) * 160; if (!rayBlockAt(x, y) && losClear(me.x, me.y, x, y)) { setPos(e, x, y); LOOK.yaw = a; ok = true; } }
            const a1 = padAssist(me); PAD.cfg.aim = false; const a2 = padAssist(me); PAD.cfg.aim = true; return [ok, a1, a2]; }""")
        ptap(G1, 9); r['pause'] = G1.evaluate("() => [UI.pauseOpen, PAD.foc && PAD.foc.id]"); ptap(G1, 1); r['resume'] = not G1.evaluate("() => UI.pauseOpen")
        G1.evaluate("() => { __pad.connected = false; }")
        r['lost'] = until(G1, "() => PAD.idx === -1 && !PAD.on && UI.pauseOpen && [...document.querySelectorAll('#toasts .toast')].some(t => t.textContent.includes('bağlantısı kesildi'))", 20)
        exp = {'cine': False, 'fire': True, 'rumble': True, 'jump': True, 'reload': True, 'swap': True, 'hold': [True, True, True, False, False, False],
               'labels': ['L1', '↑', '[↓] BASILI TUT: BOMBA KUR', True], 'assist': [True, 0.7, 1], 'pause': [True, 'btnResume'], 'resume': True, 'lost': True}
        if r['move'] < 40 or r['look'] < 0.2 or any(r[k] != v for k, v in exp.items()): fail(f'oyun kolu oyunda beklenen gibi değil: {r}')
        else: ok(f"oyun kolu oyunda: maça kolla girildi, ✕ sinematiği atladı, sol çubuk hareket ({r['move']}), sağ çubuk bakış, R2 ateş + titreşim, ✕ zıpla, □ şarjör, △ silah, ○ / L2 / ↓ basılı, OPTIONS menü, kol tuşu yazıları, nişan yardımı, kol kopunca menü")
    except Exception as e: fail('oyun kolu: ' + str(e)[:300])
    ctx.close()
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True)
    T2 = page(ctx, 'KOL-DOKUNMATİK', errs, 'KolDokun', init=PADMOCK); T2.goto(URL + '?touch=1'); T2.wait_for_timeout(700)
    try:
        if T2.is_visible('#accOv'): T2.click('#accGuest'); T2.wait_for_timeout(200)
        T2.evaluate(PCON)
        sp_go(T2, 'bomb')
        TD = "() => getComputedStyle($('touch')).display"
        d0 = T2.evaluate(TD); q0 = T2.evaluate("() => [S.pmap.h.x, S.pmap.h.y]")
        T2.evaluate("() => { TOUCH.jx = 1; TOUCH.ptr[77] = { role: 'joy' }; __pad.axes[1] = -1; }"); T2.wait_for_timeout(500); T2.evaluate("() => { __pad.axes[1] = 0; }"); T2.wait_for_timeout(150)
        d1 = T2.evaluate(TD); q1 = T2.evaluate("() => [S.pmap.h.x, S.pmap.h.y]")
        stuck = T2.evaluate("() => TOUCH.jx !== 0 || Object.keys(TOUCH.ptr).length > 0") # gizlenen katmanda basılı kalan joystick bırakılmalı
        T2.touchscreen.tap(420, 200); T2.wait_for_timeout(250)
        d2 = T2.evaluate(TD); on2 = T2.evaluate("() => PAD.on")
        mv = abs(q1[0] - q0[0]) + abs(q1[1] - q0[1])
        if d0 == 'none' or d1 != 'none' or d2 == 'none' or on2 or mv < 40 or stuck: fail(f'oyun kolu telefonda: dokunmatik butonlar önce {d0}, kolla {d1}, dokununca {d2} (kol etkin {on2}), hareket {mv:.0f}, basılı kalan joystick {stuck}')
        else: ok('oyun kolu telefonda: kolla oynarken dokunmatik butonlar gizlendi (basılı kalan joystick bırakıldı), ekrana dokununca geri geldi')
    except Exception as e: fail('oyun kolu telefonda: ' + str(e)[:300])
    report_errs(errs, 'oyun kolu')
    ctx.close()

    # ---------- 5) çok oyunculu ----------
    errs = []
    ctx = b.new_context(viewport={'width': 560, 'height': 340}, permissions=['microphone'])
    H = page(ctx, 'HOST', errs, 'HostKontrol'); C = page(ctx, 'İSTEMCİ', errs, 'MisafirKontrol')
    try:
        H.evaluate("() => { const p = SHOP.prof; p.kf.push('k04'); p.kfx = 'k04'; p.cs.push('c26'); p.csk = 'c26'; SHOP.save(); }")
        C.evaluate("() => { const p = SHOP.prof; p.kf.push('k11'); p.kfx = 'k11'; p.ws.push('w37'); p.wsk = 'w37'; p.cs.push('c27'); p.csk = 'c27'; SHOP.save(); }")
        H.click('#btnPlay'); H.click('#btnHost')
        if not until(H, "() => UI.screen==='scr-lobby' && (document.getElementById('lbCode').textContent||'').replace(/-/g,'').length>=5", 60): fail('oda açılamadı')
        code = H.inner_text('#lbCode')
        C.click('#btnPlay'); C.click('#btnJoin'); C.fill('#inCode', code); C.click('#btnConnect')
        if not until(C, "() => UI.screen==='scr-lobby'", 80): fail('istemci odaya katılamadı: ' + C.inner_text('#joinStatus')[:200])
        H.select_option('#lbSize', '1'); H.wait_for_timeout(600); H.click('#btnLobbyStart')
        until(C, "() => UI.screen==='scr-select'", 60)
        C.click('.agent[data-id="vex"]'); C.wait_for_timeout(200); C.click('#btnLock')
        H.click('.agent[data-id="mist"]'); H.wait_for_timeout(200); H.click('#btnLock')
        if not until(C, "() => !!(G.running && S && S.pmap.h)", 80): fail('çok oyunculu maç istemcide başlamadı')
        H.evaluate("() => { S.phase='live'; S.phaseT=200; }"); C.evaluate("() => { if (UI.pauseOpen) togglePause(false); }")
        H.wait_for_timeout(800)
        x0 = H.evaluate("() => [S.pmap.p1.x, S.pmap.p1.y]")
        C.keyboard.down('KeyW'); C.wait_for_timeout(900); C.keyboard.up('KeyW'); C.wait_for_timeout(600)
        x1 = H.evaluate("() => [S.pmap.p1.x, S.pmap.p1.y]")
        if abs(x1[0] - x0[0]) + abs(x1[1] - x0[1]) < 20: fail('host, istemcinin hareketini görmüyor')
        cp = C.evaluate("() => [S.pmap[G.myId].x, S.pmap[G.myId].y]")
        if abs(cp[0] - x1[0]) + abs(cp[1] - x1[1]) > 120: fail(f'istemci konumu host\'ta farklı: {cp} vs {x1}')
        bid = 'h'
        H.evaluate("(id) => { const q=S.pmap[id]; q.hp=37; q.credits=1234; }", bid); H.wait_for_timeout(700)
        if C.evaluate("(id) => [S.pmap[id].hp, S.pmap[id].credits]", bid) != [37, 1234]: fail('istemci host\'taki değişikliği almadı (snapshot)')
        C.keyboard.press('Period'); C.wait_for_timeout(250); C.keyboard.type('selam'); C.keyboard.press('Enter'); C.wait_for_timeout(900)
        if 'selam' not in H.evaluate("() => JSON.stringify(UIS.chat)"): fail('sohbet mesajı host\'a gitmedi')
        C.evaluate("async () => { try { AU.ctx && AU.ctx.resume(); } catch(e){} return await VC.ensureMic(); }")
        H.evaluate("() => { window.__vp=0; const o=VC.play.bind(VC); VC.play=(id,d)=>{ window.__vp++; o(id,d); }; const h=S.pmap.h, c=S.pmap.p1; setPos(c, h.x+40, h.y); }")
        C.keyboard.down('Digit0'); C.wait_for_timeout(1800); C.keyboard.up('Digit0')
        if not H.evaluate("() => window.__vp > 0"): fail('sesli sohbet paketi host\'a ulaşmadı')
        cz = [H.evaluate("() => [S.pmap.p1.kfx, S.pmap.p1.wsk, S.pmap.p1.csk]"), C.evaluate("() => [S.pmap.h.kfx, S.pmap.h.csk]")]
        if cz != [['k11', 'w37', 'c27'], ['k04', 'c26']]: fail(f'kozmetikler (skin / öldürme efekti) odada eşitlenmedi {cz}')
        H.evaluate("() => damage(S.pmap.p1, 999, S.pmap.h, 'vandal')")
        if not until(C, "() => KFXA.some(f => f.id === G.myId && f.k === 'k04')", 20): fail('istemci kendisini öldürenin öldürme efektini görmedi')
        ok('çok oyunculu: oda, katılma, maç, hareket, snapshot, sohbet, ses, skin ve öldürme efekti eşitlemesi')
    except Exception as e: fail('çok oyunculu: ' + str(e)[:300])
    report_errs(errs, 'çok oyunculu')
    ctx.close()

    # ---------- 5b) çok oyunculu PARKUR: aynı harita, raunt geçişi, barikat eşitlemesi ----------
    errs = []
    ctx = b.new_context(viewport={'width': 560, 'height': 340})
    H = page(ctx, 'PK-HOST', errs, 'PkHost'); C = page(ctx, 'PK-İSTEMCİ', errs, 'PkMisafir')
    GH = "() => { let h=0; for (let i=0;i<grid.length;i++) h=(h*31+grid[i])|0; return [PKMAP && PKMAP.round, MW, MH, h]; }"
    try:
        H.click('#btnPlay'); H.click('#btnHost')
        if not until(H, "() => UI.screen==='scr-lobby' && (document.getElementById('lbCode').textContent||'').replace(/-/g,'').length>=5", 60): fail('PARKUR odası açılamadı')
        code = H.inner_text('#lbCode')
        C.click('#btnPlay'); C.click('#btnJoin'); C.fill('#inCode', code); C.click('#btnConnect')
        if not until(C, "() => UI.screen==='scr-lobby'", 80): fail('istemci PARKUR odasına katılamadı')
        H.select_option('#lbMode', 'pk'); H.select_option('#lbSize', '2'); H.wait_for_timeout(600); H.click('#btnLobbyStart')
        if not until(C, "() => !!(G.running && S && PKMAP && S.pmap.h)", 80): fail('PARKUR istemcide başlamadı')
        H.evaluate("() => { cineStop(false); S.phase='live'; S.phaseT=200; S.pk.t0=S.time; }"); C.evaluate("() => { cineStop(false); if (UI.pauseOpen) togglePause(false); }")
        H.wait_for_timeout(600)
        if H.evaluate(GH) != C.evaluate(GH): fail(f'PARKUR: host ve istemcinin haritası farklı {H.evaluate(GH)} / {C.evaluate(GH)}')
        x0 = H.evaluate("() => S.pmap.p1.x")
        C.evaluate("() => { LOOK.yaw = 0; }"); C.keyboard.down('KeyW'); C.wait_for_timeout(900); C.keyboard.up('KeyW'); C.wait_for_timeout(500)
        if H.evaluate("() => S.pmap.p1.x") - x0 < 40: fail('PARKUR: host istemcinin koşusunu görmüyor')
        H.evaluate("() => { if (S.pk.bk.length) { S.pk.bk[0]=0; pkBroken[PKMAP.brk[0]]=1; } }"); H.wait_for_timeout(700)
        if C.evaluate("() => !PKMAP.brk.length || pkBroken[PKMAP.brk[0]] === 1") is not True: fail('PARKUR: kırılan barikat istemciye gitmedi')
        H.evaluate("() => { pkEndRound(S.pmap.h, 'fin'); S.phaseT = 0.05; }")
        if not until(C, "() => PKMAP && PKMAP.round === 2 && S.round === 2", 60): fail('PARKUR: istemci 2. raunt haritasına geçmedi')
        elif H.evaluate(GH) != C.evaluate(GH): fail('PARKUR: 2. rauntta host ve istemcinin haritası farklı')
        elif C.evaluate("() => S.pmap.h.pkW") != 1: fail('PARKUR: raunt galibiyeti istemciye gitmedi')
        else: ok('çok oyunculu PARKUR: aynı harita, koşu, barikat, raunt geçişi')
    except Exception as e: fail('çok oyunculu PARKUR: ' + str(e)[:300])
    report_errs(errs, 'çok oyunculu parkur')
    ctx.close()

    # ---------- 6) herkese açık sunucu ----------
    errs = []
    ctx = b.new_context(viewport={'width': 520, 'height': 320})
    A = page(ctx, 'AÇIK-A', errs, 'AcikA'); B = page(ctx, 'AÇIK-B', errs, 'AcikB')
    try:
        A.click('#btnPlay'); A.click('#btnPub')
        if not until(A, "() => UI.screen==='scr-lobby' && PUB.on", 60): fail('açık sunucu kurulamadı')
        A.wait_for_timeout(800)
        B.click('#btnPlay'); B.click('#btnPub')
        if not until(B, "() => UI.screen==='scr-lobby' && NET.mode==='client'", 80): fail('ikinci oyuncu açık sunucuya katılamadı')
        elif A.evaluate("() => NET.lobby.players.filter(p=>!p.bot).length") < 2: fail('açık sunucuda host 2. oyuncuyu görmüyor')
        else: ok('herkese açık sunucu eşleşmesi')
    except Exception as e: fail('açık sunucu: ' + str(e)[:300])
    report_errs(errs, 'açık sunucu')
    ctx.close()

    # ---------- 7) admin paneli (OZN): gems ver/sil, yetkisiz yazma, oyun içi güçler ----------
    errs = []
    ca = b.new_context(viewport={'width': 960, 'height': 540}); cb = b.new_context(viewport={'width': 960, 'height': 540})
    try:
        A = page(ca, 'ADMİN', errs, 'OZN'); B = page(cb, 'HEDEF', errs, 'Hedef1')
        A.evaluate("async () => { await ACC.signUp('OZN', 'sifre123'); FR.onLogin(); SHOP.load(); }")
        B.evaluate("async () => { await ACC.signUp('Hedef1', 'sifre123'); FR.onLogin(); SHOP.load(); }")
        if not until(A, "() => !document.getElementById('btnAdmin').classList.contains('hidden')", 20): fail('admin: OZN hesabında ADMİN düğmesi görünmedi')
        B.wait_for_timeout(1300)
        if B.is_visible('#btnAdmin'): fail('admin: admin olmayan hesapta ADMİN düğmesi görünüyor')
        g0 = B.evaluate("() => SHOP.prof.gems")
        A.click('#btnAdmin'); A.fill('#admNick', 'hedef1'); A.fill('#admAmt', '1000'); A.click('#admGive')
        if not until(A, "() => document.getElementById('admGemMsg').textContent.startsWith('✓')", 20): fail('admin: gems gönderilemedi: ' + A.evaluate("() => document.getElementById('admGemMsg').textContent"))
        B.evaluate("() => SHOP.claimGifts()")
        if not until(B, f"() => SHOP.prof.gems === {g0} + 1000", 20): fail(f'admin: hedef oyuncuya 1000 gems işlenmedi ({g0} → ' + str(B.evaluate("() => SHOP.prof.gems")) + ')')
        A.fill('#admAmt', '300'); A.click('#admTake'); until(A, "() => document.getElementById('admGemMsg').textContent.startsWith('✓')", 20)
        B.evaluate("() => SHOP.claimGifts()")
        if not until(B, f"() => SHOP.prof.gems === {g0} + 700", 20): fail('admin: gems silme işlenmedi')
        if B.evaluate("async () => { try { await ACC.db('PUT', 'gk/' + admKey('OZN') + '/x', { g: 5 }); return 'yazdı'; } catch (e) { return 'red'; } }") != 'red': fail('admin: admin olmayan hesap başkasına gems yazabildi')
        else: ok('admin paneli: OZN gems verip silebiliyor, hedefe işleniyor, başkası yazamıyor')
        A.click('#admClose')
        # oyun içi güçler (tek oyunculu)
        A.evaluate("""() => { const A=['vex','ignis','mist','aegis','pulse'], B=['chrono','terra','vital','volt','phantom'], roster=[];
            A.forEach((a,j)=>roster.push({id:j?'x'+j:'h',name:j?a:'OZN',team:0,agent:a,bot:j>0})); B.forEach((a,j)=>roster.push({id:'y'+j,name:a,team:1,agent:a,bot:true}));
            NET.mode='off'; G.myId='h'; launchGame(roster, {teamSize:5, fill:true, diff:'kolay', map:0}); try { cineStop(false); } catch (e) {} S.phase='live'; S.phaseT=120; }""")
        r = A.evaluate("""() => { for (const c of ['hp','ar','am','spd','dmg','dmg','gun']) admGame(c); const me=S.pmap.h, e=S.pmap.y0;
            const sp0 = playerSpeed({ ...me, admSpd: 1 }, me.input), sp1 = playerSpeed(me, me.input);
            let d = 0; const oh = handleEvent; window.handleEvent = ev => { if (ev.k==='hit' && ev.t==='y0') d = ev.d; return oh(ev); };
            e.armor = 0; damage(e, 10, me, 'classic'); window.handleEvent = oh;
            const buy = buyItem(S.pmap.x1, 'admin'); render(1/60);
            return { hp: me.hp, ar: me.armor, res: me.ammo.classic.res, sp: Math.round(sp1 / sp0 * 10) / 10, d, pri: me.primary, slot: me.slot, buy }; }""")
        if r != {'hp': 200, 'ar': 50, 'res': 136, 'sp': 1.5, 'd': 50, 'pri': 'admin', 'slot': 1, 'buy': False}: fail(f'admin: oyun içi güçler beklenen gibi değil: {r}')
        else: ok('admin paneli: can, kalkan, mermi, hız, atak gücü ve admin silahı çalışıyor; admin silahı satın alınamıyor')
    except Exception as e: fail('admin paneli: ' + str(e)[:300])
    report_errs(errs, 'admin paneli')
    ca.close(); cb.close()

    # ---------- 8) SERBEST mod: NPC, pill, bedava silah, JS modları; çok oyunculu eşitleme ----------
    errs = []
    ctx = b.new_context(viewport={'width': 960, 'height': 540})
    F = page(ctx, 'SERBEST', errs, 'Serbestci')
    try:
        F.click('#btnPlay'); F.click('#btnSP'); F.select_option('#spMode', 'fr'); F.click('#btnSpGo')
        F.click('#selGrid .agent >> nth=0'); F.click('#btnLock')
        if not until(F, "() => !!(G.running && S && S.cfg.mode==='fr')", 40): fail('SERBEST mod başlamadı')
        F.evaluate("() => { localStorage.setItem('spk_mods', JSON.stringify([{ name: 'Örnek', code: MOD_EXAMPLE, on: true }, { name: 'Döngü', code: \"nova.on('chat',(p,t)=>{ if(t==='!d') while(true){} });\", on: true }])); cineStop(false); G.paused = true; for (let i = 0; i < 60 * 30 && S.phase !== 'live'; i++) hostTick(SIM_DT); G.paused = false; }")
        F.wait_for_timeout(1500)
        r = F.evaluate("""() => { G.paused = true; const me = S.pmap.h, out = { n: S.players.length, live: S.phase };
            frAct(me, { a: 'npc', k: 'grin' }); me.prot = 0; const n = S.npcs[0]; n.x = me.x + Math.cos(me.ang) * 300; n.y = me.y + Math.sin(me.ang) * 300; n.hitT = 0;
            let t = 0; for (; t < 240 && me.alive; t++) hostTick(SIM_DT); out.chaseKill = !me.alive;
            S.npcs.length = 0; for (let i = 0; i < 60 * 4; i++) hostTick(SIM_DT); out.respawn = me.alive;
            frAct(me, { a: 'pill', k: 'ghost' }); out.pillSpd = Math.round(playerSpeed(me, me.input)); frAct(me, { a: 'pill', k: '' });
            frAct(me, { a: 'frw', w: 'operator' }); frAct(me, { a: 'frw', w: 'admin' }); out.w = me.primary;
            frAct(me, { a: 'npc', k: 'cube' }); const c = S.npcs[0]; c.x = me.x + Math.cos(me.ang) * 150; c.y = me.y + Math.sin(me.ang) * 150;
            for (let k = 0; k < 20 && S.npcs.length; k++) traceBullet(me.x, me.y, me.ang, 3000, me.team, me, 'vandal', WEAPONS.vandal, null, 0, EYE);
            out.cubeDead = S.npcs.length === 0; out.mods = MODS.run.length; out.modK = Object.keys(S.npcK).filter(k => k.startsWith('m')).length;
            render(1/60); G.paused = false; return out; }""")
        F.evaluate("() => { S.pmap.h.prot = S.time + 999; S.pmap.h._chatT = 0; hostChat('h', '!yağmur'); }"); F.wait_for_timeout(900)
        r['rain'] = F.evaluate("() => S.npcs.filter(n => n.k.startsWith('m')).length")
        F.evaluate("() => { S.pmap.h._chatT = 0; hostChat('h', '!d'); }"); F.wait_for_timeout(500)
        r['alive'] = F.evaluate("() => { const t = performance.now(); G.paused = true; for (let i = 0; i < 30; i++) hostTick(SIM_DT); G.paused = false; return performance.now() - t < 3000; }")
        exp = {'n': 1, 'live': 'live', 'chaseKill': True, 'respawn': True, 'pillSpd': 400, 'w': 'operator', 'cubeDead': True, 'mods': 2, 'modK': 1, 'rain': 5, 'alive': True}
        if r != exp: fail(f'SERBEST: beklenen gibi değil: {r}')
        else: ok('SERBEST: tek başına, NPC kovalayıp öldürüyor, yeniden doğuş, pill, bedava silah (admin silahı yok), NPC vurulur, JS modları (sohbet komutu, sonsuz döngü oyunu dondurmuyor)')
        F.keyboard.press('KeyQ'); F.wait_for_timeout(200)
        if not F.is_visible('#frOv'): fail('SERBEST: Q ile spawn menüsü açılmadı')
        for tab in ['w', 'n', 'p', 'c', 'm']: F.click(f'#frTabs [data-tab="{tab}"]'); F.wait_for_timeout(80)
        F.keyboard.press('Escape'); F.wait_for_timeout(150)
        if F.is_visible('#frOv'): fail('SERBEST: spawn menüsü ESC ile kapanmadı')
    except Exception as e: fail('SERBEST: ' + str(e)[:300])
    report_errs(errs, 'serbest mod')
    ctx.close()
    errs = []
    ctx = b.new_context(viewport={'width': 560, 'height': 340})
    H = page(ctx, 'SERBEST-HOST', errs, 'SerbestHost'); C = page(ctx, 'SERBEST-İSTEMCİ', errs, 'SerbestMisafir')
    try:
        H.click('#btnPlay'); H.click('#btnHost')
        if not until(H, "() => UI.screen==='scr-lobby' && (document.getElementById('lbCode').textContent||'').replace(/-/g,'').length>=5", 60): fail('SERBEST: oda açılamadı')
        code = H.inner_text('#lbCode')
        C.click('#btnPlay'); C.click('#btnJoin'); C.fill('#inCode', code); C.click('#btnConnect')
        if not until(C, "() => UI.screen==='scr-lobby'", 80): fail('SERBEST: istemci odaya katılamadı')
        H.select_option('#lbMode', 'fr'); H.select_option('#lbSize', '1'); H.wait_for_timeout(600); H.click('#btnLobbyStart')
        until(C, "() => UI.screen==='scr-select'", 60)
        C.click('.agent[data-id="vex"]'); C.wait_for_timeout(200); C.click('#btnLock')
        H.click('.agent[data-id="mist"]'); H.wait_for_timeout(200); H.click('#btnLock')
        if not until(C, "() => !!(G.running && S && S.cfg && S.cfg.mode==='fr')", 80): fail('SERBEST: çok oyunculu maç istemcide başlamadı')
        H.evaluate("() => { cineStop(false); S.phase='live'; S.phaseT=1e9; }"); C.evaluate("() => { cineStop(false); if (UI.pauseOpen) togglePause(false); }")
        H.wait_for_timeout(600)
        img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEJMDEgAUYGBgAuIAEDHRwRxQAAAABJRU5ErkJggg=="
        C.evaluate("(img) => { frRequest({ a: 'npck', n: 'Misafir Botu', img, spd: 300, hp: 0 }); frRequest({ a: 'npc', k: npcIdOf(img) }); frRequest({ a: 'pill', k: 'grin' }); }", img)
        C.wait_for_timeout(900)
        hk = H.evaluate("() => [S.npcs.length, Object.keys(S.npcK).length, S.pmap[Object.keys(NET.conns)[0]] ? S.pmap[Object.keys(NET.conns)[0]].pill : '?']")
        H.evaluate("() => { frAct(S.pmap.h, { a: 'npc', k: 'eye' }); S.npcs.forEach(n => { n.hitT = S.time + 999; }); }"); H.wait_for_timeout(900)
        ck = C.evaluate("() => [S.npcs.length, Object.keys(S.npcK || {}).length, S.pmap[G.myId].pill, Math.round(playerSpeed(S.pmap[G.myId], S.pmap[G.myId].input))]")
        if hk != [1, 1, 'grin']: fail(f'SERBEST: istemcinin NPC/pill isteği host\'a işlenmedi: {hk}')
        elif ck != [2, 1, 'grin', 330]: fail(f'SERBEST: istemci NPC\'leri / pill\'i görmüyor: {ck}')
        else: ok('SERBEST çok oyunculu: istemci kendi resmiyle NPC çıkarıyor, pill oluyor; NPC\'ler ve pill herkese gidiyor')
    except Exception as e: fail('SERBEST çok oyunculu: ' + str(e)[:300])
    report_errs(errs, 'serbest çok oyunculu')
    ctx.close()

    # ---------- 8b) SERBEST içerik paylaşımı (GMod gibi): odaya girerken özel NPC resim + sesleri iner ----------
    errs = []
    ch = b.new_context(viewport={'width': 560, 'height': 340}); cc = b.new_context(viewport={'width': 560, 'height': 340})
    try:
        H = page(ch, 'İÇERİK-HOST', errs, 'IcerikHost'); C = page(cc, 'İÇERİK-İSTEMCİ', errs, 'IcerikMisafir')
        mk = """(a) => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.fillStyle = a.col; g.fillRect(0, 0, 32, 32);
            const o = { n: a.n, img: c.toDataURL('image/png'), spd: 300, hp: 0, dmg: 999, sz: 1.1 };
            if (a.snd) { const pcm = new Int16Array(12000 * 15); for (let i = 0; i < pcm.length; i++) pcm[i] = Math.round(8000 * Math.sin(i * 0.11)); o.snd = 'ima12k:' + bytesB64(adpcmEnc(pcm)); }
            localStorage.setItem('spk_npcs', JSON.stringify([o])); return kindIdOf(o); }"""
        ka = H.evaluate(mk, {'n': 'Host NPC', 'col': '#c33'}); kb = C.evaluate(mk, {'n': 'Misafir Sesli', 'col': '#3c3', 'snd': True})
        H.click('#btnPlay'); H.click('#btnHost')
        if not until(H, "() => UI.screen==='scr-lobby' && (document.getElementById('lbCode').textContent||'').replace(/-/g,'').length>=5", 60): fail('İÇERİK: oda açılamadı')
        code = H.inner_text('#lbCode')
        C.click('#btnPlay'); C.click('#btnJoin'); C.fill('#inCode', code); C.click('#btnConnect')
        if not until(C, "() => UI.screen==='scr-lobby'", 80): fail('İÇERİK: istemci odaya katılamadı')
        ok1 = until(H, f"() => !!(PAK.k['{ka}'] && PAK.k['{kb}'] && PAK.k['{kb}'].snd)", 40) and until(C, f"() => !!(PAK.k['{ka}'] && PAK.k['{kb}']) && !Object.keys(PAK.inb).length", 40)
        lb = C.inner_text('#lbPak')
        # yavaş bağlantı: içerik parçaları kanalı doldurup anlık görüntüyü (96 KB'da atlanır) / sesi (48 KB) bekletmemeli
        fill = H.evaluate(f"""() => {{ const dc = {{ bufferedAmount: 0 }}, c = {{ open: true, dataChannel: dc, send(m) {{ dc.bufferedAmount += JSON.stringify(m).length; }} }};
            pakSend(c, '{kb}'); const n = dc.bufferedAmount; c.open = false; clearTimeout(c._pumpT); return n; }}""")
        if fill >= 48 * 1024: fail(f'İÇERİK: yavaş bağlantıda içerik kanalı {fill // 1024} KB dolduruyor (oyun verisi bekler, istemci maç başında düşer)')
        H.select_option('#lbMode', 'fr'); H.select_option('#lbSize', '1'); H.wait_for_timeout(500); H.click('#btnLobbyStart')
        until(C, "() => UI.screen==='scr-select'", 60)
        C.click('.agent[data-id="vex"]'); C.wait_for_timeout(200); C.click('#btnLock')
        H.click('.agent[data-id="mist"]'); H.wait_for_timeout(200); H.click('#btnLock')
        if not until(C, "() => !!(G.running && S && S.cfg && S.cfg.mode==='fr')", 80): fail('İÇERİK: maç başlamadı')
        H.evaluate("() => { cineStop(false); S.phase='live'; S.phaseT=1e9; }"); C.evaluate("() => { cineStop(false); if (UI.pauseOpen) togglePause(false); }")
        H.wait_for_timeout(500)
        C.evaluate(f"() => {{ const it = frKinds().find(x => x.k === '{kb}'); frEnsure(it); frRequest({{ a: 'npc', k: '{kb}' }}); }}")
        H.evaluate(f"() => {{ frAct(S.pmap.h, {{ a: 'npc', k: '{ka}' }}); S.npcs.forEach(n => {{ n.hitT = S.time + 999; }}); }}")
        H.wait_for_timeout(1200)
        hs = H.evaluate("() => S.npcs.map(n => n.k).sort()")
        cs = C.evaluate(f"() => [S.npcs.length, !!(npcKind('{ka}') && npcKind('{ka}').img), !!(npcKind('{kb}') && npcKind('{kb}').snd), !!npcSndBuf('{kb}')]")
        if not ok1: fail('İÇERİK: lobide özel NPC\'ler iki yöne de inmedi')
        elif 'hazır' not in lb: fail(f'İÇERİK: lobide indirme durumu görünmüyor: {lb!r}')
        elif hs != sorted([ka, kb]) or cs != [2, True, True, True]: fail(f'İÇERİK: maçta özel NPC\'ler eksik: host {hs} istemci {cs}')
        else: ok('SERBEST içerik: odaya girerken host ve misafirin özel NPC resim + sesleri karşılıklı iniyor, maçta ikisi de görünüyor')
    except Exception as e: fail('İÇERİK: ' + str(e)[:300])
    report_errs(errs, 'içerik paylaşımı')
    ch.close(); cc.close()
    b.close()
finally:
    sig.kill(); fb.kill(); srv.shutdown()

print()
if FAILS:
    print(f'SONUÇ: {len(FAILS)} SORUN BULUNDU')
    for f in FAILS: print(' -', f)
    sys.exit(1)
print('SONUÇ: SORUN YOK')
