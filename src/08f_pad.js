/* =====================================================================
   08f · OYUN KOLU (PlayStation DualShock 4 / DualSense ya da başka bir standart kol)
   · Gamepad API (navigator.getGamepads, standart düzen). Kol telefona (Android Chrome,
     iPhone Safari) ya da bilgisayara Bluetooth ile bağlanır; tarayıcı kolu ancak bir
     tuşa basılınca gösterir. Bağlanınca / kopunca bildirim çıkar.
   · OYUNDA: sol çubuk hareket (az it: yürü) · sağ çubuk bakış · R2 ateş · L2 nişan ·
     ✕ zıpla (ölüyken izlenen oyuncu) · ○ eğil · □ şarjör · △ silah · L1 / R1 yetenek ·
     ↑ ulti · ↓ kullan (basılı) · ← mağaza / spawn · → bomba bırak / iste · L3 sessiz yürü ·
     R3 kamera · OPTIONS menü · SHARE skor (basılı) · touchpad emote. Sinematikte yüz tuşu atlar.
   · MENÜLERDE: yön tuşları / sol çubuk en yakın düğmeye gider (altın çerçeve), basılı
     tutunca tekrarlar · ✕ seç · ○ geri · L1 / R1 sekme · sağ çubuk kaydırır.
   · Kol kullanılırken telefondaki dokunmatik butonlar gizlenir (ekrana dokununca geri
     gelir), bilgisayarda fare kilidi istenmez, ekrandaki tuş yazıları kol tuşu olur.
   · Ayarlar (spk_pad): kol hassasiyeti, ölü bölge, Y ters, titreşim, nişan yardımı.
   ===================================================================== */
const PAD = {
  on: false, idx: -1, id: '', ps: true, n: 0, scanT: 0,
  cur: new Array(18).fill(false), prev: new Array(18).fill(false),
  lx: 0, ly: 0, rx: 0, ry: 0,
  mx: 0, my: 0, fire: false, alt: false, crouch: false, use: false, walk: false, edgeT: 0, boardOn: false,
  dir: '', repT: 0, root: null, foc: null, focR: null, hl: null, mem: new Map(),
  rb: { s: null, hp: 0, alive: false, wid: '', mag: 0, sw: 0, t: 0 },
  cfg: { sens: 1, dz: 0.15, inv: false, vib: true, aim: true }
};
/* tuş yazıları: PlayStation ve diğer (Xbox düzeni) kollar */
const PAD_PS = { fire: 'R2', alt: 'L2', jump: '✕', crouch: '○', reload: '□', swap: '△', q: 'L1', e: 'R1', x: '↑', use: '↓', buy: '←', spawn: '←', drop: '→', req: '→',
  walk: 'L3', cam: 'R3', pause: 'OPTIONS', board: 'SHARE', emote: 'TOUCHPAD', move: 'SOL ÇUBUK', look: 'SAĞ ÇUBUK' };
const PAD_XB = Object.assign({}, PAD_PS, { fire: 'RT', alt: 'LT', jump: 'A', crouch: 'B', reload: 'X', swap: 'Y', q: 'LB', e: 'RB', walk: 'LS', cam: 'RS', pause: 'MENU', board: 'VIEW', emote: '—' });
const PAD_MAP = [['move', 'Hareket (az it: yürü)'], ['look', 'Bakış'], ['fire', 'Ateş'], ['alt', 'Nişan / dürbün'], ['jump', 'Zıpla · ölüyken: izlenen oyuncu'], ['crouch', 'Eğil (basılı tut)'],
  ['reload', 'Şarjör değiştir'], ['swap', 'Silah değiştir'], ['q', '1. yetenek'], ['e', '2. yetenek'], ['x', 'Ulti'], ['use', 'Kullan (basılı: bomba kur / imha et)'],
  ['buy', 'Mağaza / spawn menüsü'], ['drop', 'Bombayı bırak / bomba iste'], ['walk', 'Sessiz yürü (aç / kapa)'], ['cam', 'Kamera'], ['pause', 'Menü'],
  ['board', 'Skor tablosu (basılı tut)'], ['emote', 'Emote menüsü']];
const PAD_HINT = { B: 'buy', F: 'use', G: 'drop', T: 'req', Q: 'spawn', 'BOŞLUK': 'jump', SPACE: 'jump' };
/* menüde odaklanabilenler · ilk odak (ekran / pencere başına) */
const PAD_SEL = 'button, a[href], input:not([type=hidden]):not([type=file]), select, textarea, .agent, .frrow, .item, .slot .sw, .slot .kick, .slot .fadd, label.filebtn';
const PAD_FIRST = { pause: ['#btnResume'], 'scr-menu': ['#btnPlay'], 'scr-play': ['#btnSP'], 'scr-sp': ['#btnSpGo'], 'scr-store': ['#stTabs button.on'], end: ['#btnEndMenu'],
  'scr-select': ['#selGrid .agent.sel', '#selGrid .agent:not(.taken)'], 'scr-lobby': ['#btnLobbyStart'], frPop: ['#frPopYes'], frOv: ['#frTabs button.on'],
  buy: ['#buyBody .item:not(.no):not(.owned)', '#buyBody .item'], 'scr-help': ['[data-back]'], bye: ['#btnBye'] };
/* üstten alta: açık pencereler (ilk görünen menüyü kol yönetir) */
const PAD_OV = ['bye', 'frPop', 'accOv', 'tedBar', 'settings', 'caseOv', 'admOv', 'frOv', 'end', 'pause', 'buy', 'emoteBox'];
const PAD_CHAT = { id: 'chat' };

function padOn() { return PAD.on; }
function padGlyph(a) { return (PAD.ps ? PAD_PS : PAD_XB)[a] || '—'; }
/* eylemin ekrandaki tuşu: kol → kol tuşu, dokunmatik → buton harfi, klavye → atanan tuş (08e) */
function ctlKey(a, touchLbl) { return PAD.on ? padGlyph(a) : IS_TOUCH ? (touchLbl || a.toUpperCase()) : kbLabel(a); }
function padHintFix(s) { return s.replace(/\[(BOŞLUK|SPACE|[BFGTQ])\]/g, (m, k) => '[' + padGlyph(PAD_HINT[k]) + ']'); }
function padIsPS(id) { return !/xbox|045e/i.test(id) && /054c|dualsense|dualshock|wireless controller|playstation/i.test(id); }
function padModel(id) {
  if (/0ce6|0df2|dualsense/i.test(id)) return 'DualSense';
  if (/05c4|09cc|dualshock/i.test(id)) return 'DualShock 4';
  return (String(id).replace(/\s*\(.*$/, '').trim() || 'Gamepad').slice(0, 32);
}
function padLoad() {
  try {
    const o = JSON.parse(localStorage.getItem('spk_pad') || 'null'), c = PAD.cfg;
    if (o && typeof o === 'object') {
      if (+o.s > 0) c.sens = clamp(+o.s, 0.3, 3);
      if (+o.dz > 0) c.dz = clamp(+o.dz, 0.05, 0.35);
      c.inv = !!o.inv; c.vib = o.vib !== false; c.aim = o.aim !== false;
    }
  } catch (e) { }
}
function padSave() { const c = PAD.cfg; try { localStorage.setItem('spk_pad', JSON.stringify({ s: c.sens, dz: c.dz, inv: c.inv, vib: c.vib, aim: c.aim })); } catch (e) { } }
padLoad();

/* ---------------- KOL OKUMA ---------------- */
function padGet() {
  let L = null;
  try { L = navigator.getGamepads ? navigator.getGamepads() : null; } catch (e) { L = null; }
  if (!L) return null;
  let gp = PAD.idx >= 0 ? L[PAD.idx] : null;
  if (gp && gp.connected === false) gp = null;
  if (!gp) { // standart düzenli kol öncelikli
    let alt = null;
    for (let i = 0; i < L.length; i++) { const g = L[i]; if (!g || g.connected === false) continue; if (g.mapping === 'standard') { gp = g; break; } if (!alt) alt = g; }
    gp = gp || alt;
  }
  return gp;
}
function padPoll(dt) {
  if (PAD.idx < 0) { PAD.scanT -= dt; if (PAD.scanT > 0) return null; PAD.scanT = 0.5; } // kol yokken yarım saniyede bir bak
  const gp = padGet();
  if (gp && gp.index !== PAD.idx) padConnect(gp);
  else if (!gp && PAD.idx >= 0) padLost();
  return gp;
}
function padConnect(gp) {
  PAD.idx = gp.index; PAD.id = String(gp.id || ''); PAD.ps = padIsPS(PAD.id);
  PAD.cur.fill(false); PAD.prev.fill(false);
  uiToast(PAD.ps ? 'PlayStation kolu bağlandı' : 'Oyun kolu bağlandı');
  padUiRefresh(); padMapRender();
}
function padLost() {
  const was = PAD.on;
  uiToast(PAD.ps ? 'PlayStation kolu bağlantısı kesildi' : 'Oyun kolu bağlantısı kesildi', true);
  PAD.idx = -1; padSetOn(false); padHold(false); PAD.cur.fill(false); PAD.prev.fill(false); PAD.scanT = 0.5;
  if (PAD.boardOn) { UI.board = false; PAD.boardOn = false; }
  padUiRefresh();
  // oynarken kol koptu: menüyü aç (tek oyunculuda oyun durur)
  if (was && G.running && S && !UI.overlay && S.phase !== 'over') togglePause(true);
}
function padRead(gp) {
  const B = gp.buttons || [], c = PAD.cur, p = PAD.prev;
  for (let i = 0; i < 18; i++) {
    const b = B[i];
    if (i === 6 || i === 7) { // tetikler analog: bırakma eşiği basma eşiğinden düşük
      const v = !b ? 0 : typeof b === 'number' ? b : (+b.value || (b.pressed ? 1 : 0));
      c[i] = p[i] ? v > 0.18 : v > 0.3;
    } else c[i] = !!b && (typeof b === 'number' ? b > 0.5 : !!b.pressed);
  }
  const A = gp.axes || [];
  PAD.lx = +A[0] || 0; PAD.ly = +A[1] || 0; PAD.rx = +A[2] || 0; PAD.ry = +A[3] || 0;
}
function padDn(i) { return PAD.cur[i] && !PAD.prev[i]; }
function padUp(i) { return !PAD.cur[i] && PAD.prev[i]; }
/* ölü bölge (dairesel): çubuk değerini 0..1'e yeniden ölçekleyen çarpan */
function padDzK(x, y, dz) { const m = Math.hypot(x, y); return m > dz ? Math.min(1, (m - dz) / (1 - dz)) / m : 0; }
function padHold(v) { if (!v) { PAD.mx = PAD.my = 0; PAD.fire = PAD.alt = PAD.crouch = PAD.use = false; PAD.edgeT = 0; } }
/* son girdi koldan mı (yazılar, dokunmatik butonlar, fare kilidi) */
function padSetOn(v) {
  v = !!v; if (PAD.on === v) return;
  PAD.on = v; document.body.classList.toggle('padon', v);
  if (!v) { padHL(null); padHold(false); }
  G._buySig = null; // mağazadaki tuş yazıları yenilensin
}

/* ---------------- HER KARE ---------------- */
function padTick(dt) {
  PAD.n++;
  const gp = padPoll(dt);
  if (!gp) return;
  padRead(gp);
  let act = false;
  for (let i = 0; i < 18; i++) if (PAD.cur[i] && !PAD.prev[i]) { act = true; break; }
  if (!act && (Math.hypot(PAD.lx, PAD.ly) > 0.5 || Math.hypot(PAD.rx, PAD.ry) > 0.5)) act = true; // hafif çubuk kayması kolu "etkin" yapmaz
  const wake = act && !PAD.on;
  if (act) padSetOn(true);
  if (padUp(8) && PAD.boardOn) { UI.board = false; PAD.boardOn = false; }
  const root = padLayer();
  if (root) padMenu(root, dt, wake);
  else {
    if (PAD.root) { if (PAD.foc) PAD.mem.set(PAD.root, PAD.foc); PAD.root = null; }
    padHL(null);
    if (G.running && S) padGame(dt); else padHold(false);
  }
  if (G.running && S && PAD.on) padRumbleTick(S.pmap[G.myId]);
  const t = PAD.prev; PAD.prev = PAD.cur; PAD.cur = t;
}
/* kolun yöneteceği menü (yoksa oyun) */
function padLayer() {
  for (let i = 0; i < PAD_OV.length; i++) { const el = $(PAD_OV[i]); if (el && !el.classList.contains('hidden')) return el; }
  if (CHAT.open) return PAD_CHAT;
  if (G.running) return null;
  const s = UI.screen && UI.screen !== 'game' ? $(UI.screen) : null;
  return s && !s.classList.contains('hidden') ? s : null;
}

/* ---------------- OYUN ---------------- */
function padGame(dt) {
  if (!PAD.on) { padHold(false); return; }
  const me = S.pmap[G.myId], alive = !!(me && me.alive);
  if (CINE.on) { padHold(false); if (padDn(0) || padDn(1) || padDn(2) || padDn(3) || padDn(9)) cineStop(true); return; } // yüz tuşu sinematiği atlar
  const dz = PAD.cfg.dz;
  let k = padDzK(PAD.lx, PAD.ly, dz);
  PAD.mx = PAD.lx * k; PAD.my = PAD.ly * k;
  PAD.fire = PAD.cur[7]; PAD.alt = PAD.cur[6]; PAD.crouch = PAD.cur[1]; PAD.use = PAD.cur[13];
  // bakış: yumuşak eğri (küçük itiş = ince nişan), tam itişte kısa süre sonra hızlanır
  k = padDzK(PAD.rx, PAD.ry, dz);
  if (k > 0) {
    const m = Math.min(1, Math.hypot(PAD.rx, PAD.ry) * k), c = Math.pow(m, 0.8);
    if (m > 0.96) PAD.edgeT += dt; else PAD.edgeT = 0;
    const boost = 1 + 0.6 * clamp((PAD.edgeT - 0.25) / 0.4, 0, 1);
    const sp = PAD.cfg.sens * (me && me.scoped ? 0.35 : 1) * boost * padAssist(me);
    LOOK.yaw += PAD.rx * k * c * 3.4 * sp * dt;
    LOOK.pitch = clamp(LOOK.pitch + (PAD.cfg.inv ? 1 : -1) * PAD.ry * k * c * 2.3 * sp * dt, -1.4, 1.4);
  } else PAD.edgeT = 0;
  if (padDn(7)) { MOUSE.fp = (MOUSE.fp + 1) | 0; if (me && !alive) cycleSpec(); } // her basış bir atış (tek atarlar)
  if (padDn(0)) { if (alive) doJump(); else cycleSpec(); }
  if (padDn(2)) doReload();
  if (padDn(3) && me) doSlot(nextSlot(me, 1));
  if (padDn(4)) castAbility('q');
  if (padDn(5)) castAbility('e');
  if (padDn(12)) castAbility('x');
  if (padDn(14)) toggleBuy();
  if (padDn(15) && me) { if (me.hasBomb) { if (G.mode === 'client') netSend(NET.conn, { t: 'act', a: 'drop' }); else dropBomb(me); } else doRequest(); }
  if (padDn(10)) { PAD.walk = !PAD.walk; showMsg(null, PAD.walk ? 'SESSİZ YÜRÜME: AÇIK' : 'SESSİZ YÜRÜME: KAPALI', PAL.teal); }
  if (padDn(11)) camCycle();
  if (padDn(8)) { UI.board = true; PAD.boardOn = true; }
  if (padDn(17)) toggleEmote();
  if (padDn(9)) togglePause(true);
}
/* NİŞAN YARDIMI (yalnızca kol): nişangâh görünen bir rakibin üstündeyken bakış biraz yavaşlar */
function padAssist(me) {
  if (!PAD.cfg.aim || !me || !me.alive || pkOn()) return 1;
  const ux = Math.cos(LOOK.yaw), uy = Math.sin(LOOK.yaw);
  for (const p of S.players) {
    if (!p.alive || p.team === me.team || (p.st && p.st.invis > 0)) continue;
    const dx = p.x - me.x, dy = p.y - me.y, d = Math.hypot(dx, dy);
    if (d < 30 || d > 2600 || dx * ux + dy * uy <= 0) continue;
    if (Math.abs(dx * uy - dy * ux) > 38 + d * 0.03) continue; // nişan çizgisine uzaklık
    if (losClear(me.x, me.y, p.x, p.y)) return 0.62;
  }
  return 1;
}
/* TİTREŞİM: atış (hafif), hasar (güçlü), ölüm (uzun) */
function padRumble(s, w, ms) {
  if (!PAD.cfg.vib || !PAD.on || PAD.idx < 0) return;
  const now = performance.now(); if (ms < 100 && now - PAD.rb.t < 45) return; PAD.rb.t = now;
  try {
    const gp = padGet(); if (!gp) return;
    const va = gp.vibrationActuator, ha = gp.hapticActuators && gp.hapticActuators[0];
    let r = null;
    if (va && va.playEffect) r = va.playEffect('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: w, strongMagnitude: s });
    else if (ha && ha.pulse) r = ha.pulse(Math.max(s, w), ms);
    if (r && r.catch) r.catch(() => { });
  } catch (e) { }
}
function padRumbleTick(me) {
  const R = PAD.rb; if (!me) return;
  const wid = curW(me), am = me.ammo && me.ammo[wid], mag = am ? am.mag : 0, sw = VM.swing || 0;
  if (R.s === S) {
    if (R.alive && !me.alive) padRumble(1, 1, 600);
    else if (R.alive && me.alive && me.hp < R.hp - 0.5) padRumble(clamp((R.hp - me.hp) / 50, 0.35, 1), 0.5, 180);
    else if (me.alive && wid === R.wid && mag < R.mag) padRumble(0, 0.4, 55);
    else if (me.alive && sw > R.sw + 0.5) padRumble(0.15, 0.35, 70);
  }
  R.s = S; R.hp = me.hp; R.alive = me.alive; R.wid = wid; R.mag = mag; R.sw = sw;
}

/* ---------------- MENÜLER ---------------- */
function padMenu(root, dt, wake) {
  padHold(false);
  if (root === PAD_CHAT) { padHL(null); if (padDn(1) || padDn(9)) chatClose(false); return; }
  if (root !== PAD.root) { // pencere değişti: oradaki son odağa dön
    if (PAD.root && PAD.foc) PAD.mem.set(PAD.root, PAD.foc);
    PAD.root = root; const m = PAD.mem.get(root);
    PAD.foc = m && padOk(m, root) ? m : null; PAD.dir = '';
  }
  if (!PAD.on) { padHL(null); return; }
  if (PAD.foc && !padOk(PAD.foc, root)) padSetFoc(padNear(root, PAD.focR)); // yeniden çizilen menüde aynı yere en yakın
  if (!PAD.foc) padSetFoc(padFirst(root));
  if (PAD.foc) PAD.focR = PAD.foc.getBoundingClientRect();
  padHL(PAD.foc);
  const d = padDirNow();
  if (d && d !== PAD.dir) { PAD.dir = d; PAD.repT = 0.35; if (!wake) padMove(root, d); }
  else if (d) { PAD.repT -= dt; if (PAD.repT <= 0) { PAD.repT = 0.12; padMove(root, d); } }
  else PAD.dir = '';
  if (padDn(0) && !wake && PAD.foc) padActivate(PAD.foc);
  else if (padDn(1)) padBack(root);
  else if (padDn(9)) { if (root.id === 'pause') togglePause(false); else padBack(root); }
  else if (padDn(4) || padDn(5)) padTab(root, padDn(5) ? 1 : -1);
  else if (padDn(17) && root.id === 'emoteBox') toggleEmote(false);
  if (Math.abs(PAD.ry) > PAD.cfg.dz + 0.1) { const sc = padScroller(PAD.foc || root.firstElementChild); if (sc) sc.scrollTop += PAD.ry * 900 * dt; }
}
function padDirNow() {
  const c = PAD.cur;
  if (c[12]) return 'u'; if (c[13]) return 'd'; if (c[14]) return 'l'; if (c[15]) return 'r';
  const ax = Math.abs(PAD.lx), ay = Math.abs(PAD.ly);
  if (Math.max(ax, ay) < (PAD.dir ? 0.35 : 0.55)) return '';
  return ay >= ax ? (PAD.ly < 0 ? 'u' : 'd') : (PAD.lx < 0 ? 'l' : 'r');
}
function padVis(el) {
  if (!el || el.disabled || !el.getClientRects().length) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.pointerEvents !== 'none';
}
function padOk(el, root) { return el.isConnected && root.contains(el) && padVis(el); }
function padList(root) {
  const out = [];
  for (const el of root.querySelectorAll(PAD_SEL)) if (!el.closest('#keyList') && padVis(el)) out.push(el);
  return out;
}
function padFirst(root) {
  const L = padList(root); if (!L.length) return null;
  for (const s of PAD_FIRST[root.id] || []) { const el = root.querySelector(s); if (el && L.includes(el)) return el; }
  return L[0];
}
function padNear(root, r) {
  if (!r) return padFirst(root);
  const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
  let best = null, bd = Infinity;
  for (const el of padList(root)) { const b = el.getBoundingClientRect(), d = Math.hypot((b.left + b.right) / 2 - cx, (b.top + b.bottom) / 2 - cy); if (d < bd) { bd = d; best = el; } }
  return best;
}
function padHL(el) {
  if (PAD.hl === el) return;
  if (PAD.hl) PAD.hl.classList.remove('padfoc');
  PAD.hl = el || null; if (el) el.classList.add('padfoc');
}
function padSetFoc(el) {
  PAD.foc = el || null; if (!el) return;
  const ae = document.activeElement;
  if (ae && ae !== el && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) { try { ae.blur(); } catch (e) { } } // yazı kutusundan çıkınca klavye kapansın
  try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { }
  PAD.focR = el.getBoundingClientRect();
  if (PAD.on) padHL(el);
}
/* kaydırılan kutu (mağaza ızgarası, ayarlar paneli…) */
function padScroller(el) {
  for (let p = el && el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (p.scrollHeight > p.clientHeight + 2) { const o = getComputedStyle(p).overflowY; if (o === 'auto' || o === 'scroll') return p; }
  }
  return null;
}
/* öğeye gidilebilir mi: görünür alanda, ya da onu gizleyen kaydırma kutusu odaklı öğeyi de içeriyor
   (mağaza ızgarasında aşağı inince sonraki sıra gelir; sekmelerden inince ızgaranın görünen ilk sırası) */
function padReach(el, b, cur) {
  let scr = false;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (p.scrollHeight <= p.clientHeight + 2 && p.scrollWidth <= p.clientWidth + 2) continue;
    const o = getComputedStyle(p); if (o.overflowY === 'visible' && o.overflowX === 'visible') continue;
    if (p.contains(cur)) { scr = true; continue; }
    const r = p.getBoundingClientRect();
    if (b.bottom <= r.top + 2 || b.top >= r.bottom - 2 || b.right <= r.left || b.left >= r.right) return false;
  }
  return scr || !(b.bottom <= 0 || b.top >= innerHeight || b.right <= 0 || b.left >= innerWidth);
}
/* yöndeki en yakın öğe: ana eksendeki boşluk + yan kayma */
function padScore(a, b, dir) {
  const v = dir === 'u' || dir === 'd', s = dir === 'd' || dir === 'r' ? 1 : -1;
  const ac = v ? (a.top + a.bottom) / 2 : (a.left + a.right) / 2, bc = v ? (b.top + b.bottom) / 2 : (b.left + b.right) / 2;
  if ((bc - ac) * s <= 2) return Infinity;
  const main = Math.max(0, v ? (s > 0 ? b.top - a.bottom : a.top - b.bottom) : (s > 0 ? b.left - a.right : a.left - b.right));
  const orth = Math.max(0, v ? Math.max(b.left - a.right, a.left - b.right) : Math.max(b.top - a.bottom, a.top - b.bottom));
  const oc = Math.abs(v ? (b.left + b.right - a.left - a.right) / 2 : (b.top + b.bottom - a.top - a.bottom) / 2);
  return main + orth * (v ? 1.5 : 2.5) + oc * 0.15;
}
function padMove(root, dir) {
  const cur = PAD.foc; if (!cur) { padSetFoc(padFirst(root)); return; }
  if (cur.tagName === 'INPUT' && cur.type === 'range' && (dir === 'l' || dir === 'r')) { padRange(cur, dir === 'r' ? 1 : -1); return; }
  const a = cur.getBoundingClientRect();
  let best = null, bs = Infinity;
  for (const el of padList(root)) {
    if (el === cur || el.contains(cur) || cur.contains(el)) continue;
    const b = el.getBoundingClientRect(), s = padScore(a, b, dir);
    if (s >= bs || !padReach(el, b, cur)) continue;
    bs = s; best = el;
  }
  if (best) padSetFoc(best);
}
function padRange(el, d) {
  const mn = +el.min || 0, mx = el.max === '' ? 100 : +el.max, st = +el.step || 1, inc = Math.max(st, (mx - mn) / 20);
  let v = clamp((+el.value || 0) + d * inc, mn, mx); v = Math.round((v - mn) / st) * st + mn;
  el.value = String(+clamp(v, mn, mx).toFixed(4));
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
}
function padActivate(el) {
  const tg = el.tagName, ty = String(el.type || '').toLowerCase();
  if (tg === 'SELECT') { // seçenekler arasında sırayla dolaş
    const n = el.options.length; if (!n) return;
    let i = el.selectedIndex;
    for (let k = 0; k < n; k++) { i = (i + 1) % n; if (!el.options[i].disabled) break; }
    el.selectedIndex = i; el.dispatchEvent(new Event('change', { bubbles: true })); return;
  }
  if (tg === 'INPUT' && ty === 'range') return; // ← → ile değişir
  if (tg === 'TEXTAREA' || (tg === 'INPUT' && ty !== 'checkbox' && ty !== 'radio' && ty !== 'button' && ty !== 'submit')) { try { el.focus(); } catch (e) { } return; }
  if (el.dataset && el.dataset.e !== undefined && el.closest('#emoteBox')) { doEmote(+el.dataset.e); return; } // emote düğmeleri pointerdown dinler
  el.click();
}
function padBack(root) {
  const ae = document.activeElement;
  if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && root.contains(ae)) { ae.blur(); return; }
  switch (root.id) {
    case 'settings': if (KB.wait) { KB.wait = null; kbRender(); } closeSettings(); return;
    case 'caseOv': caseClose(); return;
    case 'admOv': admClose(); return;
    case 'frOv': frMenuToggle(false); return;
    case 'pause': togglePause(false); return;
    case 'buy': closeBuy(); return;
    case 'emoteBox': toggleEmote(false); return;
    case 'tedBar': tlEditClose(false); return;
    case 'scr-net': $('btnNetBack').click(); return;
    case 'scr-pub': $('btnPubCancel').click(); return;
  }
  for (const b of root.querySelectorAll('[data-back]')) if (padVis(b)) { b.click(); return; } // ekranın GERİ düğmesi
}
function padTab(root, d) {
  const box = root.querySelector('.st-tabs'); if (!box || !padVis(box)) return;
  const bs = [...box.querySelectorAll('button')].filter(padVis); if (!bs.length) return;
  let i = bs.findIndex(b => b.classList.contains('on'));
  i = ((i < 0 ? 0 : i + d) + bs.length) % bs.length;
  bs[i].click();
  if (!PAD.foc || box.contains(PAD.foc)) padSetFoc(bs[i]);
}

/* ---------------- AYARLAR ---------------- */
function padTog(id, on) { const b = $(id); if (!b) return; b.textContent = on ? 'AÇIK' : 'KAPALI'; b.classList.toggle('off', !on); }
function padUiRefresh() {
  const st = $('padStat'); if (!st) return;
  const c = PAD.cfg;
  if (PAD.idx >= 0) { st.textContent = '✓ ' + (PAD.ps ? 'PlayStation kolu bağlı' : 'Oyun kolu bağlı') + ' · ' + padModel(PAD.id); st.classList.add('ok'); }
  else { st.textContent = 'Kol bağlı değil — kolu Bluetooth ile bağla ve bir tuşa bas'; st.classList.remove('ok'); }
  $('padSens').value = c.sens; $('padSensV').textContent = c.sens.toFixed(2);
  $('padDz').value = c.dz; $('padDzV').textContent = Math.round(c.dz * 100) + '%';
  padTog('padInv', c.inv); padTog('padVib', c.vib); padTog('padAim', c.aim);
}
function padMapRender() {
  const box = $('padMap'); if (!box) return;
  box.innerHTML = PAD_MAP.filter(r => padGlyph(r[0]) !== '—').map(([a, n]) => '<div class="pr"><b>' + esc(padGlyph(a)) + '</b><span>' + esc(n) + '</span></div>').join('');
}
function padInit() {
  padUiRefresh(); padMapRender();
  $('padSens').oninput = () => { PAD.cfg.sens = clamp(+$('padSens').value || 1, 0.3, 3); padSave(); padUiRefresh(); };
  $('padDz').oninput = () => { PAD.cfg.dz = clamp(+$('padDz').value || 0.15, 0.05, 0.35); padSave(); padUiRefresh(); };
  $('padInv').onclick = () => { PAD.cfg.inv = !PAD.cfg.inv; padSave(); padUiRefresh(); };
  $('padVib').onclick = () => { PAD.cfg.vib = !PAD.cfg.vib; padSave(); padUiRefresh(); if (PAD.cfg.vib) padRumble(0.6, 0.6, 220); };
  $('padAim').onclick = () => { PAD.cfg.aim = !PAD.cfg.aim; padSave(); padUiRefresh(); };
  // fare / dokunma / klavye kullanılınca kol yazıları ve odak çerçevesi kalkar, dokunmatik butonlar geri gelir
  const off = () => { if (PAD.on) padSetOn(false); };
  document.addEventListener('pointerdown', off, true);
  document.addEventListener('touchstart', off, { capture: true, passive: true });
  window.addEventListener('keydown', off, true);
  document.addEventListener('mousemove', e => { if (PAD.on && Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0) > 6) padSetOn(false); }, true);
  window.addEventListener('gamepadconnected', () => { PAD.scanT = 0; });
  window.addEventListener('gamepaddisconnected', () => { PAD.scanT = 0; });
}
Object.assign(EN_EXACT, {
  'OYUN KOLU': 'CONTROLLER', 'KOL HASSASİYETİ': 'STICK SENSITIVITY', 'Y EKSENİNİ TERS ÇEVİR': 'INVERT Y AXIS', 'ÖLÜ BÖLGE': 'DEADZONE', 'TİTREŞİM': 'VIBRATION', 'NİŞAN YARDIMI': 'AIM ASSIST',
  'Kol bağlı değil — kolu Bluetooth ile bağla ve bir tuşa bas': 'No controller — connect it via Bluetooth and press a button',
  'PlayStation kolu bağlandı': 'PlayStation controller connected', 'Oyun kolu bağlandı': 'Controller connected',
  'PlayStation kolu bağlantısı kesildi': 'PlayStation controller disconnected', 'Oyun kolu bağlantısı kesildi': 'Controller disconnected',
  'SOL ÇUBUK': 'LEFT STICK', 'SAĞ ÇUBUK': 'RIGHT STICK', 'Hareket (az it: yürü)': 'Move (push lightly: walk)', 'Bakış': 'Look', 'Ateş': 'Fire', 'Nişan / dürbün': 'Aim / scope',
  'Zıpla · ölüyken: izlenen oyuncu': 'Jump · while dead: switch player', 'Eğil (basılı tut)': 'Crouch (hold)', 'Şarjör değiştir': 'Reload', 'Silah değiştir': 'Switch weapon',
  '1. yetenek': 'Ability 1', '2. yetenek': 'Ability 2', 'Ulti': 'Ultimate', 'Kullan (basılı: bomba kur / imha et)': 'Use (hold: plant / defuse)', 'Mağaza / spawn menüsü': 'Shop / spawn menu',
  'Bombayı bırak / bomba iste': 'Drop / request the bomb', 'Sessiz yürü (aç / kapa)': 'Silent walk (toggle)', 'Kamera': 'Camera', 'Menü': 'Menu', 'Skor tablosu (basılı tut)': 'Scoreboard (hold)',
  'Emote menüsü': 'Emote menu', 'SESSİZ YÜRÜME: AÇIK': 'SILENT WALK: ON', 'SESSİZ YÜRÜME: KAPALI': 'SILENT WALK: OFF',
  'Menülerde: yön tuşları ya da sol çubuk ile gez · ✕ seç · ○ geri · L1 / R1 sekme değiştir · sağ çubuk kaydırır':
    'In menus: move with the D-pad or left stick · ✕ select · ○ back · L1 / R1 switch tabs · right stick scrolls',
  'Telefonda da çalışır (Android Chrome, iPhone Safari). Kolu kullanınca ekrandaki dokunmatik butonlar gizlenir, ekrana dokununca geri gelir.':
    'Works on phones too (Android Chrome, iPhone Safari). While you use the controller the on-screen touch buttons hide; touch the screen to bring them back.'
});
Object.assign(EN_FRAG, {
  'PlayStation kolu bağlı': 'PlayStation controller connected', 'Oyun kolu bağlı': 'Controller connected', ' ile seç · kapat: ': ' to pick · close: ',
  'BARİKAT — ': 'BARRICADE — ', ' ile kılıçla kır (': ' to break it with your sword (', ': güçlü darbe)': ': heavy hit)'
});
