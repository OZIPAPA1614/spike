#!/usr/bin/env python3
"""SPIKE günlük sağlık kontrolü.

Kullanım (depo kökünden):  python3 tests/check.py [--quick]
  1) src/ derlenir ve yayındaki index.html ile karşılaştırılır (biri index.html'i elle değiştirdiyse yakalar)
  2) index.html tarayıcıda açılır: menüler, mağaza, ayarlar, dil
  3) Her haritada botlarla maç oynatılır (--quick değilse 2 haritada TAM maç)
  4) Tek oyunculu arayüz akışı (ajan seçimi → oyun → çizim)
  5) Çok oyunculu: yerel eşleştirme sunucusuyla host + istemci (oda, katılma, maç, hareket, sohbet, ses)
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
INIT = ("window.__PEER_OPTS={host:'127.0.0.1',port:%d,secure:false,path:'/'};" % SIG +
        "window.__FB_OPTS={auth:'http://127.0.0.1:%d/v1/',tok:'http://127.0.0.1:%d/token',db:'http://127.0.0.1:%d/db'};" % (FBP, FBP, FBP) +
        "try{localStorage.setItem('spk_mus','0');localStorage.setItem('spk_gfx','low');localStorage.setItem('spk_guest','1');}catch(e){}")

def page(ctx, tag, errs, nick, vw=None):
    pg = ctx.new_page()
    if vw: pg.set_viewport_size(vw)
    pg.on('pageerror', lambda e: errs.append(f'{tag} sayfa hatası: {e} {str(e.stack)[:400]}'))
    pg.on('console', lambda m: errs.append(f'{tag} konsol hatası: {m.text[:300]}') if m.type == 'error' and 'Failed to load' not in m.text and 'ERR_' not in m.text else None)
    pg.add_init_script(INIT + ("try{localStorage.setItem('spk_nick',%s);}catch(e){}" % json.dumps(nick)))
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

    # ---------- 2) menüler ----------
    errs = []
    ctx = b.new_context(viewport={'width': 1100, 'height': 680}, permissions=['microphone'])
    M = page(ctx, 'MENÜ', errs, 'Kontrol')
    try:
        M.click('#btnStore'); M.wait_for_timeout(300)
        for tab in ('sw', 'ws', 'cs'):
            M.click(f'#stTabs button[data-tab={tab}]'); M.wait_for_timeout(200)
            n = M.evaluate("() => document.querySelectorAll('#stGrid .sc').length")
            if n < 5: fail(f'mağaza sekmesi {tab}: yalnızca {n} kart')
        M.click('#scr-store [data-back]'); M.wait_for_timeout(200)
        M.click('#btnSettings'); M.wait_for_timeout(200); M.evaluate("() => closeSettings && closeSettings()")
        M.click('#btnFriends'); M.wait_for_timeout(200); M.click('#scr-friends [data-back]'); M.wait_for_timeout(200)
        M.evaluate("() => setLang('en')"); M.wait_for_timeout(200); M.evaluate("() => setLang('tr')")
        ok('menü, mağaza, ayarlar, arkadaşlar, dil açıldı')
    except Exception as e: fail('menü gezintisi: ' + str(e)[:300])

    # ---------- 3) botlarla maçlar (tüm haritalar) ----------
    M.evaluate("""() => { window.__start = (mi, i) => {
        const A=['vex','ignis','mist','aegis','pulse'], B=['chrono','terra','vital','volt','phantom'];
        const t0 = i%2 ? B : A, t1 = i%2 ? A : B, roster=[];
        t0.forEach((a,j)=>roster.push({id:j?'x'+j:'h',name:a,team:0,agent:a,bot:j>0,cos:j%2?{sw:4,ws:'w20',cs:'c20'}:undefined}));
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
    report_errs(errs, 'menü + bot maçları')
    ctx.close()

    # ---------- 4) tek oyunculu arayüz akışı ----------
    errs = []
    ctx = b.new_context(viewport={'width': 960, 'height': 540})
    S1 = page(ctx, 'TEK', errs, 'Tekci')
    try:
        S1.click('#btnSP'); S1.click('#btnSpGo'); S1.wait_for_timeout(300)
        S1.click('#selGrid .agent >> nth=0'); S1.click('#btnLock')
        if not until(S1, "() => !!(G.running && S)", 40): fail('tek oyunculu maç başlamadı')
        S1.evaluate("() => { S.phase='live'; S.phaseT=60; }")
        S1.keyboard.down('KeyW'); S1.wait_for_timeout(800); S1.keyboard.up('KeyW')
        S1.keyboard.press('F3'); S1.wait_for_timeout(300); S1.keyboard.press('F3'); S1.wait_for_timeout(300); S1.keyboard.press('F3')
        S1.wait_for_timeout(500)
        ok('tek oyunculu: ajan seçimi, hareket, kamera, çizim')
    except Exception as e: fail('tek oyunculu akış: ' + str(e)[:300])
    report_errs(errs, 'tek oyunculu')
    ctx.close()

    # ---------- 5) çok oyunculu ----------
    errs = []
    ctx = b.new_context(viewport={'width': 560, 'height': 340}, permissions=['microphone'])
    H = page(ctx, 'HOST', errs, 'HostKontrol'); C = page(ctx, 'İSTEMCİ', errs, 'MisafirKontrol')
    try:
        H.click('#btnHost')
        if not until(H, "() => UI.screen==='scr-lobby' && (document.getElementById('lbCode').textContent||'').replace(/-/g,'').length>=5", 60): fail('oda açılamadı')
        code = H.inner_text('#lbCode')
        C.click('#btnJoin'); C.fill('#inCode', code); C.click('#btnConnect')
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
        ok('çok oyunculu: oda, katılma, maç, hareket, snapshot, sohbet, ses')
    except Exception as e: fail('çok oyunculu: ' + str(e)[:300])
    report_errs(errs, 'çok oyunculu')
    ctx.close()

    # ---------- 6) herkese açık sunucu ----------
    errs = []
    ctx = b.new_context(viewport={'width': 520, 'height': 320})
    A = page(ctx, 'AÇIK-A', errs, 'AcikA'); B = page(ctx, 'AÇIK-B', errs, 'AcikB')
    try:
        A.click('#btnPub')
        if not until(A, "() => UI.screen==='scr-lobby' && PUB.on", 60): fail('açık sunucu kurulamadı')
        A.wait_for_timeout(800)
        B.click('#btnPub')
        if not until(B, "() => UI.screen==='scr-lobby' && NET.mode==='client'", 80): fail('ikinci oyuncu açık sunucuya katılamadı')
        elif A.evaluate("() => NET.lobby.players.filter(p=>!p.bot).length") < 2: fail('açık sunucuda host 2. oyuncuyu görmüyor')
        else: ok('herkese açık sunucu eşleşmesi')
    except Exception as e: fail('açık sunucu: ' + str(e)[:300])
    report_errs(errs, 'açık sunucu')
    ctx.close()
    b.close()
finally:
    sig.kill(); fb.kill(); srv.shutdown()

print()
if FAILS:
    print(f'SONUÇ: {len(FAILS)} SORUN BULUNDU')
    for f in FAILS: print(' -', f)
    sys.exit(1)
print('SONUÇ: SORUN YOK')
