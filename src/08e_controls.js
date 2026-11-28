/* =====================================================================
   08e · KONTROL AYARLARI
   · TUŞ ATAMA (Minecraft gibi): AYARLAR → TUŞ ATAMALARI'nda bir eyleme
     tıkla, yeni tuşa bas. Tuş başka bir eylemdeyse ikisi yer değiştirir;
     ESC vazgeçer. Fare (ateş / nişan) ve ESC (menü) sabittir.
   · DOKUNMATİK DÜZEN (Brawl Stars gibi): butonları sürükleyerek taşı,
     seçili butonu büyüt / küçült; joystick de taşınır. Konum ekranın
     oranı olarak saklanır (her ekran boyutunda aynı yere düşer).
   · MOD BUTONLARI: her oyun modunda yalnızca o modda işe yarayan
     dokunmatik butonlar görünür.
   ===================================================================== */
/* [eylem, ad, varsayılan tuş] · 'key:.' = karaktere göre (Türkçe klavyede nokta) */
const KB_ACTS = [
  ['fwd', 'İLERİ', 'KeyW'], ['back', 'GERİ', 'KeyS'], ['left', 'SOLA', 'KeyA'], ['right', 'SAĞA', 'KeyD'],
  ['jump', 'ZIPLA', 'Space'], ['crouch', 'EĞİL', 'ShiftLeft'], ['walk', 'SESSİZ YÜRÜ', 'KeyC'],
  ['reload', 'ŞARJÖR DEĞİŞTİR', 'KeyR'], ['use', 'KULLAN (bomba kur / imha et)', 'KeyF'],
  ['slot1', 'ANA SİLAH', 'Digit1'], ['slot2', 'TABANCA', 'Digit2'], ['slot3', 'KILIÇ', 'Digit3'],
  ['q', '1. YETENEK', 'KeyQ'], ['e', '2. YETENEK', 'KeyE'], ['x', 'ULTİ', 'KeyX'], ['spawn', 'SPAWN MENÜSÜ (SERBEST)', 'KeyQ'],
  ['buy', 'MAĞAZA', 'KeyB'], ['drop', 'BOMBAYI BIRAK', 'KeyG'], ['req', 'BOMBA İSTE', 'KeyT'],
  ['emote', 'EMOTE MENÜSÜ', 'KeyZ'], ['chat', 'YAZILI SOHBET', 'key:.'], ['voice', 'BAS-KONUŞ', 'Digit0'],
  ['board', 'SKOR TABLOSU', 'Tab'], ['cam', 'KAMERA', 'F3'], ['pause', 'DURAKLAT', 'KeyP'], ['mute', 'SESİ AÇ / KAPAT', 'KeyM']
];
/* basılınca imleci oyuna kilitleyen (oynanış) eylemleri */
const KB_LOCK = { fwd: 1, back: 1, left: 1, right: 1, jump: 1, crouch: 1, walk: 1, reload: 1, use: 1, slot1: 1, slot2: 1, slot3: 1, q: 1, e: 1, x: 1, drop: 1, req: 1 };
const KB = { b: {}, used: {}, ch: {}, wait: null };
const KB_NAMES = {
  Space: 'BOŞLUK', ShiftLeft: 'SOL SHIFT', ShiftRight: 'SAĞ SHIFT', ControlLeft: 'SOL CTRL', ControlRight: 'SAĞ CTRL', AltLeft: 'ALT', AltRight: 'ALT GR',
  Tab: 'TAB', CapsLock: 'CAPS LOCK', Enter: 'ENTER', Backspace: 'GERİ SİL', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', MetaLeft: 'WIN', MetaRight: 'WIN',
  ContextMenu: 'MENÜ', Insert: 'INSERT', Delete: 'DELETE', Home: 'HOME', End: 'END', PageUp: 'PAGE UP', PageDown: 'PAGE DOWN', NumpadEnter: 'NUM ENTER',
  NumpadAdd: 'NUM +', NumpadSubtract: 'NUM −', NumpadMultiply: 'NUM *', NumpadDivide: 'NUM /', NumpadDecimal: 'NUM ,'
};
/* tuşun ekranda görünen adı (klavye düzenine göre: Türkçe klavyede gerçek harf) */
function kbUp(k) { return LANG === 'en' ? k.toUpperCase() : k.toLocaleUpperCase('tr-TR'); }
function kbName(code, key) {
  code = String(code || '');
  if (code.startsWith('key:')) return code.slice(4);
  const m = /^Key([A-Z])$/.exec(code); if (m) return key && key.length === 1 ? kbUp(key) : m[1];
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return 'NUM ' + code.slice(6);
  if (KB_NAMES[code]) return KB_NAMES[code];
  if (/^F\d{1,2}$/.test(code)) return code;
  if (key && key.length === 1 && key !== ' ') return kbUp(key);
  return code.slice(0, 12);
}
function kbDefaults() { const o = {}; for (const [a, , c] of KB_ACTS) o[a] = { c, l: kbName(c) }; return o; }
function kbLoad() {
  KB.b = kbDefaults();
  try {
    const o = JSON.parse(localStorage.getItem('spk_keys') || 'null');
    if (o && typeof o === 'object') for (const [a] of KB_ACTS) {
      const v = o[a];
      if (Array.isArray(v) && typeof v[0] === 'string' && (/^[A-Za-z0-9]{1,24}$/.test(v[0]) || /^key:.$/.test(v[0]))) KB.b[a] = { c: v[0], l: String(v[1] || kbName(v[0])).slice(0, 14) };
      else if (v === null) KB.b[a] = null; // eylem boş bırakılmış
    }
  } catch (e) { }
  kbIndex();
}
function kbSave() {
  const o = {}; for (const [a] of KB_ACTS) o[a] = KB.b[a] ? [KB.b[a].c, KB.b[a].l] : null;
  try { localStorage.setItem('spk_keys', JSON.stringify(o)); } catch (e) { }
}
function kbIndex() { KB.used = {}; for (const [a] of KB_ACTS) if (KB.b[a]) KB.used[KB.b[a].c] = 1; }
/* SPAWN menüsü yalnızca SERBEST'te, yetenekler yalnızca diğer modlarda: aynı tuşu paylaşabilirler */
function kbShare(a, b) { const ab = { q: 1, e: 1, x: 1 }; return (a === 'spawn' && !!ab[b]) || (b === 'spawn' && !!ab[a]); }
function kbSet(a, code, label) {
  const old = KB.b[a];
  for (const [o] of KB_ACTS) if (o !== a && !kbShare(a, o) && KB.b[o] && KB.b[o].c === code) KB.b[o] = old ? { c: old.c, l: old.l } : null; // yer değiştir
  KB.b[a] = { c: code, l: label || kbName(code) };
  kbIndex(); kbSave();
}
function kbReset() { KB.b = kbDefaults(); kbIndex(); try { localStorage.removeItem('spk_keys'); } catch (e) { } }
/* bu tuş olayı (keydown / keyup) eyleme mi ait? */
function kbIs(e, a) {
  const b = KB.b[a]; if (!b || !e) return false;
  if (b.c.startsWith('key:')) return e.key === b.c.slice(4) || (b.c === 'key:.' && e.code === 'NumpadDecimal');
  if (e.code === b.c) return true;
  if (/^F\d{1,2}$/.test(b.c) && e.key === b.c) return true;                  // Mac: fn + F3
  if (b.c === 'Digit0' && a === 'voice' && e.code === 'Numpad0') return true;  // varsayılan yedekler
  if (b.c === 'ShiftLeft' && a === 'crouch' && e.code === 'ShiftRight') return true;
  return false;
}
/* eylemin tuşu şu an basılı mı (hareket, eğilme, yürüme, kullanma) */
function kbHeld(a) {
  const b = KB.b[a]; if (!b) return false;
  if (b.c.startsWith('key:')) return !!KB.ch[b.c.slice(4)];
  return !!KEYS[b.c] || (a === 'crouch' && b.c === 'ShiftLeft' && !!KEYS.ShiftRight);
}
/* ok tuşları hareket için yedek — başka bir eyleme atanmadıysa */
function kbArrow(code) { return !!KEYS[code] && !KB.used[code]; }
function kbLabel(a) { const b = KB.b[a]; return b ? b.l : '—'; }
function kbAct(e) { for (const [a] of KB_ACTS) if (kbIs(e, a)) return a; return null; }
function kbLocks(e) { for (const a in KB_LOCK) if (kbIs(e, a)) return true; return false; }
/* HUD ipuçlarındaki varsayılan tuş harflerini atanan tuşla değiştir ([B] mağaza, [F] kullan, [G] bırak, [T] iste) */
const KB_HINT = { B: 'buy', F: 'use', G: 'drop', T: 'req' };
function kbHintFix(s) {
  if (IS_TOUCH || typeof s !== 'string' || s.indexOf('[') < 0) return s;
  return s.replace(/\[([BFGT])\]/g, (m, k) => '[' + kbLabel(KB_HINT[k]) + ']');
}
/* ayarlar: tuş listesi */
function kbRender() {
  const box = $('keyList'); if (!box) return;
  box.innerHTML = KB_ACTS.map(([a, n]) => '<div class="kr"><span>' + esc(n) + '</span><button type="button" data-k="' + a + '"' + (KB.wait === a ? ' class="wait"' : '') + '>' +
    (KB.wait === a ? '&gt; ? &lt;' : esc(kbLabel(a))) + '</button></div>').join('');
  for (const bt of box.querySelectorAll('button')) bt.onclick = ev => { ev.stopPropagation(); KB.wait = KB.wait === bt.dataset.k ? null : bt.dataset.k; kbRender(); };
}

/* ---------------- DOKUNMATİK DÜZEN ---------------- */
const TL = { L: {}, W: null, sel: null, drag: null };
const TL_NAMES = {
  tbFire: 'ATEŞ', tbQ: '1. YETENEK', tbE: '2. YETENEK', tbX: 'ULTİ', tbReload: 'ŞARJÖR DEĞİŞTİR', tbSwap: 'SİLAH DEĞİŞTİR', tbUse: 'KULLAN',
  tbScope: 'NİŞAN', tbWalk: 'YÜRÜ', tbCrouch: 'EĞİL', tbPause: 'DURAKLAT', tbBoard: 'SKOR', tbBuy: 'MAĞAZA', tbDrop: 'BOMBAYI BIRAK',
  tbReq: 'BOMBA İSTE', tbJump: 'ZIPLA', tbMic: 'MİKROFON', tbChat: 'SOHBET', tbEmote: 'EMOTE', tbCam: 'KAMERA', tbFull: 'TAM EKRAN', tjoy: 'JOYSTICK'
};
function tlIds() { const out = []; for (const el of document.querySelectorAll('#touch .tb')) out.push(el.id); out.push('tjoy'); return out; }
function tlClean(o) {
  const out = {};
  if (o && typeof o === 'object') for (const id in o) {
    const v = o[id]; if (!TL_NAMES[id] || !v || typeof v !== 'object') continue;
    const x = +v.x, y = +v.y, s = +v.s;
    out[id] = { x: clamp(isFinite(x) ? x : 0.5, 0.02, 0.98), y: clamp(isFinite(y) ? y : 0.5, 0.02, 0.98), s: clamp(isFinite(s) && s > 0 ? s : 1, 0.6, 1.8) };
  }
  return out;
}
function tlLoad() { try { TL.L = tlClean(JSON.parse(localStorage.getItem('spk_tlay') || '{}')); } catch (e) { TL.L = {}; } }
function tlApply(L) {
  L = L || TL.L;
  for (const id of tlIds()) {
    const el = $(id), v = L[id]; if (!el) continue;
    if (id === 'tjoy' && el.classList.contains('act')) continue; // parmak altındaki joystick yerinde kalsın
    if (v) { el.classList.add('lay'); el.style.left = (v.x * 100) + '%'; el.style.top = (v.y * 100) + '%'; el.style.setProperty('--ts', v.s); }
    else { el.classList.remove('lay'); el.style.left = ''; el.style.top = ''; el.style.removeProperty('--ts'); }
  }
}
/* joystick: boyut çarpanı ve hangi yarıda başlar (varsayılan: sol taraf) */
function tlJoyScale() { const v = TL.L.tjoy; return v ? v.s : 1; }
function tlJoyZone(x) { const v = TL.L.tjoy; return v && v.x > 0.5 ? x > innerWidth * 0.58 : x < innerWidth * 0.42; }
function tlJoyIdle() { const el = $('tjoy'), v = TL.L.tjoy; el.style.left = v ? (v.x * 100) + '%' : ''; el.style.top = v ? (v.y * 100) + '%' : ''; }
function tlEnsure(id) { // kaydı olmayan butonun kaydını şu anki yerinden oluştur
  if (!TL.W[id]) { const r = $(id).getBoundingClientRect(); TL.W[id] = { x: clamp((r.left + r.width / 2) / innerWidth, 0.02, 0.98), y: clamp((r.top + r.height / 2) / innerHeight, 0.02, 0.98), s: 1 }; }
  return TL.W[id];
}
function tlBar() {
  const id = TL.sel, v = id && TL.W[id], s = v ? v.s : 1;
  $('tedSel').textContent = id ? TL_NAMES[id] : 'BİR BUTONA DOKUN';
  $('tedSize').value = s; $('tedPct').textContent = Math.round(s * 100) + '%';
  for (const b of ['tedSize', 'tedMinus', 'tedPlus', 'tedReset1']) $(b).disabled = !id;
  for (const el of document.querySelectorAll('#touch .tsel')) el.classList.remove('tsel');
  if (id) $(id).classList.add('tsel');
}
function tlSize(s) { if (!TL.sel) return; tlEnsure(TL.sel).s = clamp(Math.round(s * 20) / 20, 0.6, 1.8); tlApply(TL.W); tlBar(); }
function tlEditOpen() {
  if (UI.setOpen) closeSettings();
  TL.W = JSON.parse(JSON.stringify(TL.L)); TL.sel = null; TL.drag = null;
  UI.tedit = true; UI.overlay = true; MOUSE.down = false; TOUCH.fire = false;
  document.body.classList.add('tedit');
  $('touch').classList.remove('hidden'); $('tedBar').classList.remove('hidden');
  tlApply(TL.W); tlBar();
}
function tlEditClose(save) {
  if (!UI.tedit) return;
  if (save) { TL.L = tlClean(TL.W); try { localStorage.setItem('spk_tlay', JSON.stringify(TL.L)); } catch (e) { } }
  TL.W = null; TL.sel = null; TL.drag = null; UI.tedit = false;
  document.body.classList.remove('tedit', 'tdrag'); $('tedBar').classList.add('hidden');
  for (const el of document.querySelectorAll('#touch .tsel')) el.classList.remove('tsel');
  tlApply();
  if (!G.running) $('touch').classList.add('hidden');
  if (save) uiToast('Dokunmatik düzen kaydedildi');
  openSettings(); // ayarlara geri dön
}
/* düzenleyicide dokunma (08_ui setupTouch buraya yönlendirir) */
function tlDown(e) {
  const el = e.target.closest('#touch .tb, #tjoy');
  if (!el) { TL.sel = null; tlBar(); return; }
  TL.sel = el.id; tlBar();
  const r = el.getBoundingClientRect();
  TL.drag = { id: el.id, pid: e.pointerId, ox: e.clientX - (r.left + r.width / 2), oy: e.clientY - (r.top + r.height / 2), moved: false };
}
function tlMove(e) {
  const d = TL.drag; if (!d || d.pid !== e.pointerId) return;
  const v = tlEnsure(d.id);
  v.x = clamp((e.clientX - d.ox) / innerWidth, 0.02, 0.98); v.y = clamp((e.clientY - d.oy) / innerHeight, 0.02, 0.98);
  if (!d.moved) { d.moved = true; document.body.classList.add('tdrag'); }
  tlApply(TL.W);
}
function tlUp(e) { if (TL.drag && TL.drag.pid === e.pointerId) { TL.drag = null; document.body.classList.remove('tdrag'); } }

/* ---------------- MODA GÖRE BUTONLAR ---------------- */
/* yalnızca o modda işe yarayan butonlar görünür:
   KLASİK: hepsi · SİLAH YARIŞI / SÜPERNOVA: yetenek, mağaza, bomba, F yok · SERBEST: yetenek, bomba, F yok (MAĞAZA → SPAWN)
   PARKUR: yalnızca kılıç — yetenek, mağaza, bomba, F, şarjör, silah değiştir, nişan, sessiz yürüme yok
   Tek oyunculu: mikrofon yok, sohbet yok (SERBEST'te mod komutları için sohbet kalır) */
function tbModeHidden() {
  const h = {}; if (!S) return h;
  const m = modeOf(S.cfg && S.cfg.mode), sp = G.mode === 'sp';
  if (m !== 'bomb') for (const id of ['tbQ', 'tbE', 'tbX', 'tbUse', 'tbDrop', 'tbReq']) h[id] = 1;
  if (m === 'gg' || m === 'sn' || m === 'pk') h.tbBuy = 1;
  if (m === 'pk') for (const id of ['tbReload', 'tbSwap', 'tbScope', 'tbWalk']) h[id] = 1;
  if (sp) { h.tbMic = 1; if (m !== 'fr') h.tbChat = 1; }
  return h;
}
function tbApplyMode() {
  const h = tbModeHidden();
  for (const el of document.querySelectorAll('#touch .tb')) el.classList.toggle('mh', !!h[el.id]);
}

/* ---------------- KURULUM ---------------- */
function ctlInit() {
  kbLoad(); tlLoad(); tlApply();
  $('setKeys').classList.toggle('hidden', IS_TOUCH);
  $('setTouch').classList.toggle('hidden', !IS_TOUCH);
  kbRender();
  $('btnKeyReset').onclick = () => { KB.wait = null; kbReset(); kbRender(); uiToast('Tuşlar varsayılana döndü'); };
  $('btnTouchEdit').onclick = () => tlEditOpen();
  // tuş yakalama: bekleyen eylem varsa ilk tuş ona atanır (oyuna gitmez)
  window.addEventListener('keydown', e => {
    if (e.key && e.key.length === 1) KB.ch[e.key] = true;
    if (!KB.wait) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const a = KB.wait; KB.wait = null;
    if (e.code && e.code !== 'Escape') kbSet(a, e.code, kbName(e.code, e.key));
    kbRender();
  }, true);
  window.addEventListener('keyup', e => { if (e.key && e.key.length === 1) KB.ch[e.key] = false; }, true);
  window.addEventListener('blur', () => { KB.ch = {}; });
  document.addEventListener('pointerdown', e => { if (KB.wait && !(e.target.closest && e.target.closest('#keyList button'))) { KB.wait = null; kbRender(); } }, true);
  // düzenleyici araç çubuğu
  $('tedSize').oninput = () => tlSize(+$('tedSize').value);
  $('tedMinus').onclick = () => { if (TL.sel) tlSize(tlEnsure(TL.sel).s - 0.1); };
  $('tedPlus').onclick = () => { if (TL.sel) tlSize(tlEnsure(TL.sel).s + 0.1); };
  $('tedReset1').onclick = () => { if (!TL.sel) return; delete TL.W[TL.sel]; tlApply(TL.W); tlBar(); };
  $('tedResetAll').onclick = () => { TL.W = {}; tlApply(TL.W); tlBar(); };
  $('tedCancel').onclick = () => tlEditClose(false);
  $('tedSave').onclick = () => tlEditClose(true);
}
Object.assign(EN_EXACT, {
  'İLERİ': 'FORWARD', 'SOLA': 'LEFT', 'SAĞA': 'RIGHT', 'SESSİZ YÜRÜ': 'SILENT WALK', 'ŞARJÖR DEĞİŞTİR': 'RELOAD', 'KULLAN (bomba kur / imha et)': 'USE (plant / defuse)',
  'ANA SİLAH': 'PRIMARY', 'TABANCA': 'PISTOL', 'KILIÇ': 'SWORD', '1. YETENEK': 'ABILITY 1', '2. YETENEK': 'ABILITY 2', 'SPAWN MENÜSÜ (SERBEST)': 'SPAWN MENU (FREE ROAM)',
  'BOMBAYI BIRAK': 'DROP BOMB', 'EMOTE MENÜSÜ': 'EMOTE MENU', 'YAZILI SOHBET': 'TEXT CHAT', 'BAS-KONUŞ': 'PUSH TO TALK', 'DURAKLAT': 'PAUSE', 'SESİ AÇ / KAPAT': 'SOUND ON / OFF',
  'TUŞ ATAMALARI': 'KEY BINDINGS', 'TUŞLARI VARSAYILANA DÖNDÜR': 'RESET KEYS TO DEFAULT', 'Tuşlar varsayılana döndü': 'Keys reset to default',
  'Değiştirmek istediğin eyleme tıkla, sonra yeni tuşa bas (ESC: vazgeç). Tuş başka bir eylemdeyse ikisi yer değiştirir. Ateş: sol tık · Nişan: sağ tık · Menü: ESC.':
    'Click the action you want to change, then press the new key (ESC: cancel). If the key is already used, the two actions swap. Fire: left click · Aim: right click · Menu: ESC.',
  'SOL SHIFT': 'LEFT SHIFT', 'SAĞ SHIFT': 'RIGHT SHIFT', 'SOL CTRL': 'LEFT CTRL', 'SAĞ CTRL': 'RIGHT CTRL', 'GERİ SİL': 'BACKSPACE', 'MENÜ': 'MENU',
  '✥ DOKUNMATİK DÜZENİ DÜZENLE': '✥ EDIT TOUCH LAYOUT', 'Butonları sürükleyerek istediğin yere taşı, seçtiğin butonu büyüt ya da küçült. Joystick de taşınır.':
    'Drag buttons wherever you like and make the selected one bigger or smaller. The joystick can be moved too.',
  'BİR BUTONA DOKUN': 'TAP A BUTTON', 'Sürükle: taşı · Kaydırıcı: boyut': 'Drag: move · Slider: size', 'BUNU SIFIRLA': 'RESET THIS', 'HEPSİNİ SIFIRLA': 'RESET ALL',
  'Dokunmatik düzen kaydedildi': 'Touch layout saved', 'SİLAH DEĞİŞTİR': 'SWITCH WEAPON', 'KULLAN': 'USE', 'NİŞAN': 'AIM', 'MİKROFON': 'MICROPHONE', 'EMOTE': 'EMOTE',
  'TAM EKRAN': 'FULLSCREEN', 'JOYSTICK': 'JOYSTICK', 'EMOTE · dokunarak seç': 'EMOTE · tap to pick'
});
Object.assign(EN_FRAG, { 'EMOTE · 1–6 seç · kapat: ': 'EMOTE · pick 1–6 · close: ' });
