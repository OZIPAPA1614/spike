/* =====================================================================
   08 · ARAYÜZ: menüler, lobi, ajan seçimi, mağaza, duraklatma, maç sonu,
        girdi (klavye/fare) ve ana döngü
   ===================================================================== */
const $ = id => document.getElementById(id);
const IS_TOUCH = /[?&]touch=1/.test(location.search) || (('ontouchstart' in window || navigator.maxTouchPoints > 0) && !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches));
/* ---- Tam ekran ----
   iPhone/iPad'de (Safari ve iOS'taki tüm tarayıcılar WebKit'tir) tam ekrandayken hızlı dokunuşlar ya da klavye girişi
   "Tam ekrandayken yazı yazıyor gibi görünüyorsunuz" uyarısını açıp oyunu kesiyor; bu bir tarayıcı güvenlik özelliği ve
   kapatılamıyor. Bu yüzden iOS/iPadOS'ta Fullscreen API hiç kullanılmaz. Çubuksuz oynamak için Ana Ekrana Ekle yeterli. */
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_STANDALONE = navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches);
function enterFullscreen() {
  if (IS_IOS || document.fullscreenElement) return;
  try { const r = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (r && r.catch) r.catch(() => { }); } catch (e) { }
}
function toggleFullscreen() {
  if (IS_IOS) {
    if (!IS_STANDALONE) uiToast('Tam ekran için: Safari\'de Paylaş → Ana Ekrana Ekle, sonra oyunu ana ekrandaki simgeden aç');
    return;
  }
  try { if (document.fullscreenElement) document.exitFullscreen(); else enterFullscreen(); } catch (e) { }
}
const SETTINGS = { sens: 1, gfx: 'high' };
try { const g = localStorage.getItem('spk_gfx'); SETTINGS.gfx = g === 'low' || g === 'mid' || g === 'high' ? g : 'high'; } catch (e) { }
const TOUCH = { jx: 0, jy: 0, fire: false, use: false, alt: false, walk: false, crouch: false, ptr: {} };
/* ---- Fare kilidi (Pointer Lock) ----
   Kilit yalnızca doğrudan bir kullanıcı eyleminin (tıklama/tuş) içinde istenirse güvenilir çalışır (özellikle Safari).
   Kilit alınamazsa "serbest fare" moduna geçilir: imleç ekran kenarına gelince görüş kendiliğinden dönmeye devam eder,
   böylece imleç ekrandan/başka monitöre kaçsa bile istediğin yöne bakabilirsin. Her tıklamada kilit yeniden denenir. */
function isLocked() { return !!glcv && document.pointerLockElement === glcv; }
function lockPointer(gesture) {
  if (IS_TOUCH || !glcv || isLocked()) return;
  if (!glcv.requestPointerLock) { enterFreeMouse('api'); return; }
  G._lockReqT = performance.now(); G._lockGesture = !!gesture;
  try {
    const r = glcv.requestPointerLock();
    if (r && r.catch) r.catch(err => {
      const m = String((err && (err.message || err.name)) || '');
      if (/sandbox|allow-pointer-lock/i.test(m)) enterFreeMouse('sandbox');
    });
  } catch (e) { if (gesture) enterFreeMouse('error'); }
}
function enterFreeMouse(why) {
  if (G.freeMouse) return;
  G.freeMouse = true;
  if (!G.running) return;
  uiToast(IN_FRAME ? 'Bu pencere fareyi kilitlemeye izin vermiyor. Ekranın kenarına gelince görüş kendiliğinden döner. En iyisi dosyayı indirip tarayıcıda doğrudan açmak.'
    : 'Tarayıcı fareyi kilitleyemedi. Ekranın kenarına gelince görüş kendiliğinden döner; tıkladıkça kilit yeniden denenir. (Safari tam ekranda kilit sorunu yaşayabilir: tam ekrandan çıkmayı ya da Chrome\'u dene.)', true);
}
/* Serbest fare modunda ekran kenarı bölgesinde sürekli dönüş */
function freeLookTick(dt) {
  if (!G.freeMouse || isLocked() || !G.running || !S || IS_TOUCH || UI.overlay || !MOUSE.inside) return;
  const W = innerWidth, H = innerHeight, bx = Math.max(40, W * 0.09), by = Math.max(30, H * 0.08);
  const sp = 2.6 * Math.sqrt(SETTINGS.sens), me = S.pmap[G.myId], k = me && me.scoped ? 0.35 : 1;
  let ax = 0, ay = 0;
  if (MOUSE.x < bx) ax = -(1 - Math.max(0, MOUSE.x) / bx); else if (MOUSE.x > W - bx) ax = 1 - Math.max(0, W - MOUSE.x) / bx;
  if (MOUSE.y < by) ay = -(1 - Math.max(0, MOUSE.y) / by); else if (MOUSE.y > H - by) ay = 1 - Math.max(0, H - MOUSE.y) / by;
  if (ax) LOOK.yaw += Math.sign(ax) * (0.35 + 0.65 * Math.abs(ax)) * sp * k * dt;
  if (ay) LOOK.pitch = clamp(LOOK.pitch - Math.sign(ay) * (0.35 + 0.65 * Math.abs(ay)) * sp * 0.6 * k * dt, -1.4, 1.4);
}
/* "Tıkla ve kilitle" ipucu + imleç durumu */
function syncLockHint() {
  const need = G.running && !!S && !IS_TOUCH && !isLocked() && !G.freeMouse && !UI.overlay && !(S.phase === 'over');
  if (need !== G._needLock) { G._needLock = need; $('lockHint').classList.toggle('hidden', !need); document.body.classList.toggle('needlock', need); }
}
function unlockPointer() { G._noPauseOnUnlock = true; try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { } setTimeout(() => { G._noPauseOnUnlock = false; }, 300); }
/* Nişangahın dünyada işaret ettiği nokta (yetenek hedefi) */
function aimPoint(me) {
  const ux = Math.cos(LOOK.yaw), uy = Math.sin(LOOK.yaw);
  let d = raycast(me.x, me.y, ux, uy, 2600).d;
  if (LOOK.pitch < -0.01) { const g = EYE / Math.tan(-LOOK.pitch); if (g < d) d = g; }
  d = Math.max(30, d - 10);
  return { x: me.x + ux * d, y: me.y + uy * d, ang: LOOK.yaw };
}
/* Oyun içi fare imleci: oyun sırasında gizli, menü/mağaza/maç sonu açıkken görünür */
function syncCursor() {
  const endOpen = !$('end').classList.contains('hidden');
  document.body.classList.toggle('ovl', !!(UI.pauseOpen || UI.buyOpen || UI.frOpen || UI.admOpen || UI.setOpen || endOpen)); // spawn menüsü / admin paneli açıkken de imleç görünür
}
/* Bağlantı durumu (lobi) */
function uiNetStatus() {
  const el = $('lbNet'); if (!el) return;
  if (NET.mode === 'host') {
    const n = Object.keys(NET.conns).length;
    el.innerHTML = (NET.sigOk ? '<b class="ok">● Oda açık</b> — arkadaşların kodla katılabilir.' : '<b class="bad">● Eşleştirme sunucusu bağlantısı koptu</b> — yeniden bağlanılıyor… (bağlı oyuncular etkilenmez)') +
      ' Bağlı oyuncu: ' + n + '.' + (turnUrls(turnLoad()).length ? ' Özel TURN: açık.' : ' Arkadaşın farklı ağdan bağlanamıyorsa <a href="#" data-netcfg>Bağlantı ayarları</a>.');
  } else if (NET.mode === 'client') {
    el.innerHTML = '<b class="ok">● Host\'a bağlı</b>' + (NET.ping ? ' · gecikme ' + NET.ping + ' ms' : '');
  } else el.textContent = '';
  bindNetLinks(el);
}
let NETCFG_BACK = 'scr-menu';
function bindNetLinks(root) { for (const a of (root || document).querySelectorAll('[data-netcfg]')) a.onclick = e => { e.preventDefault(); openNetCfg(); }; }
function openNetCfg() {
  NETCFG_BACK = UI.screen && UI.screen !== 'scr-net' ? UI.screen : 'scr-menu';
  const t = turnLoad() || {};
  $('inTurnUrl').value = t.urls || ''; $('inTurnUser').value = t.user || ''; $('inTurnPass').value = t.pass || '';
  $('netDiagOut').innerHTML = ''; $('netCfgNote').textContent = NET.mode === 'host' ? 'Not: değişiklikler yeni kurulan odalarda geçerli olur (odayı kapatıp yeniden kur).' : '';
  uiShow('scr-net');
}
function saveNetCfg() {
  const urls = $('inTurnUrl').value.trim(), user = $('inTurnUser').value.trim(), pass = $('inTurnPass').value;
  if (!urls) { turnSave(null); return true; }
  if (!turnUrls({ urls }).length) { $('netCfgNote').textContent = 'Adres "turn:" veya "turns:" ile başlamalı (ör. turn:relay1.expressturn.com:3478).'; return false; }
  turnSave({ urls, user, pass }); return true;
}
function mapOptions(sel, withRandom, val) {
  sel.innerHTML = (withRandom ? '<option value="-1">RASTGELE</option>' : '') + MAPS.map((m, i) => '<option value="' + i + '">' + m.name + ' · ' + m.w + '×' + m.h + '</option>').join('');
  sel.value = String(val);
}
function mapLabel(i) { return i >= 0 && MAPS[i] ? MAPS[i].name : 'Rastgele'; }
/* ESC: maçtan çıkıp ana menüye dön */
function quitToMenu() {
  if (!G.running) return;
  if (FRM.open) frMenuToggle(false);
  uiBackToMenu();
  uiToast('Maçtan çıkıldı — ana menü');
}
/* Ana menüdeki OYUNDAN ÇIK */
function exitGame() {
  if (NET.mode !== 'off') netShutdown();
  G.running = false; S = null;
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { }
  try { if (AU.ctx && AU.ctx.suspend) AU.ctx.suspend(); } catch (e) { }
  G.bye = true; $('bye').classList.remove('hidden');
  try { window.close(); } catch (e) { }
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function uiShow(id) {
  for (const el of document.querySelectorAll('.screen')) el.classList.add('hidden');
  if (id) $(id).classList.remove('hidden');
  UI.screen = id || 'game';
}
function uiToast(msg, bad) {
  const el = document.createElement('div'); el.className = 'toast' + (bad ? ' bad' : ''); el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3200);
}
function playerName() {
  if (FR.nick) return FR.nick;
  let n = ($('inName').value || '').trim().slice(0, 16);
  if (!n) n = 'Ajan' + randi(100, 999);
  try { localStorage.setItem('spk_name', n); } catch (e) { }
  return n;
}

function uiInit() {
  const glok = initRender();
  if (IS_TOUCH) document.body.classList.add('touch');
  try { const sv = parseFloat(localStorage.getItem('spk_sens')); if (sv > 0) SETTINGS.sens = sv; } catch (e) { }
  $('sensR').value = SETTINGS.sens; $('sensV').textContent = SETTINGS.sens.toFixed(2);
  // ---- KULLANICI ADI (bir kez seçilir) + ARKADAŞLAR ----
  FR.init();
  uiStoreInit(); // gems + mağaza (hesaba göre profil)
  const lockNick = () => { $('inName').value = FR.nick; $('inName').readOnly = !!FR.acc; $('inName').title = FR.acc ? 'Kullanıcı adı değiştirilemez' : ''; };
  // ---- HESAP: kayıt ol / giriş yap / misafir ----
  let accMode = 'up';
  const accSet = m => {
    accMode = m; const up = m === 'up';
    $('accTitle').textContent = up ? 'HESAP OLUŞTUR' : 'GİRİŞ YAP';
    $('accSub').textContent = up ? 'Kullanıcı adın oyunda ve arkadaş listelerinde görünür. Sonradan değiştirilemez.' : 'Kullanıcı adın ve şifrenle hesabına gir — arkadaşların her cihazda seninle.';
    $('accGo').textContent = up ? 'KAYIT OL' : 'GİRİŞ YAP';
    $('accSwitch').textContent = up ? 'Hesabın var mı? GİRİŞ YAP' : 'Hesabın yok mu? KAYIT OL';
    $('accPass').setAttribute('autocomplete', up ? 'new-password' : 'current-password');
    $('accErr').textContent = '';
  };
  window.uiAccountOpen = (m) => { accSet(m || 'up'); $('accOv').classList.remove('hidden'); setTimeout(() => $('accNick').focus(), 50); };
  if (FR.acc && FR.nick) { lockNick(); FR.start(); FR.doSync(); }
  else {
    try { const old = localStorage.getItem('spk_nick') || localStorage.getItem('spk_name'); if (old && FR.validNick(old)) $('accNick').value = old; } catch (e) { }
    let guestOk = false; try { guestOk = localStorage.getItem('spk_guest') === '1'; } catch (e) { }
    if (guestOk && $('accNick').value) { FR.guest($('accNick').value); lockNick(); }
    else uiAccountOpen('up');
  }
  const accGo = async () => {
    if (ACC.busy) return;
    const n = $('accNick').value.trim(), pw = $('accPass').value;
    if (!FR.validNick(n)) { $('accErr').textContent = '3–16 karakter olmalı; yalnızca harf, rakam ve _ . - kullanılabilir.'; return; }
    if (pw.length < 6) { $('accErr').textContent = 'Şifre en az 6 karakter olmalı.'; return; }
    ACC.busy = true; $('accGo').disabled = true; $('accErr').textContent = ''; $('accGo').textContent = 'BEKLE…';
    try {
      if (accMode === 'up') await ACC.signUp(n, pw); else await ACC.signIn(n, pw);
      $('accPass').value = '';
      try { localStorage.removeItem('spk_guest'); } catch (e) { }
      FR.onLogin(); SHOP.load(); lockNick(); $('accOv').classList.add('hidden'); uiFriendsChanged();
      uiToast((accMode === 'up' ? 'Hesap oluşturuldu — hoş geldin, ' : 'Hoş geldin, ') + ACC.nick + '!');
    } catch (e) { $('accErr').textContent = ACC.errText(e && e.message); }
    ACC.busy = false; $('accGo').disabled = false; $('accGo').textContent = accMode === 'up' ? 'KAYIT OL' : 'GİRİŞ YAP';
  };
  $('accGo').onclick = accGo;
  $('accPass').addEventListener('keydown', e => { if (e.key === 'Enter') accGo(); });
  $('accNick').addEventListener('keydown', e => { if (e.key === 'Enter') $('accPass').focus(); });
  $('accSwitch').onclick = e => { e.preventDefault(); accSet(accMode === 'up' ? 'in' : 'up'); };
  $('accGuest').onclick = e => {
    e.preventDefault();
    const n = FR.validNick($('accNick').value) ? $('accNick').value.trim() : 'Ajan' + randi(100, 999);
    FR.guest(n); try { localStorage.setItem('spk_guest', '1'); } catch (x) { }
    lockNick(); $('accOv').classList.add('hidden'); uiFriendsChanged();
  };
  $('btnFriends').onclick = () => { closeSettings(); uiShow('scr-friends'); uiRenderFriends(); };
  $('frPopYes').onclick = () => uiFriendPopAnswer(true);
  $('frPopNo').onclick = () => uiFriendPopAnswer(false);
  // lobi sohbeti ve bas-konuş
  $('lbChatSend').onclick = () => { lobbyChatSend($('lbChatIn').value); $('lbChatIn').value = ''; };
  $('lbChatIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('lbChatSend').click(); } });
  { const mb = $('lbMic'); let down = false;
    mb.addEventListener('pointerdown', e => { e.preventDefault(); down = true; VC.keyDown(); });
    const up = () => { if (!down) return; down = false; VC.keyUp(); };
    mb.addEventListener('pointerup', up); mb.addEventListener('pointerleave', up); mb.addEventListener('pointercancel', up); }
  setInterval(() => { if (UI.screen === 'scr-friends') uiRenderFriends(); }, 15000);
  uiFriendsChanged();
  // ---- AYARLAR (ses, sesli sohbet, grafik, dil, hassasiyet) — tarayıcıda saklanır ----
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { } return null; };
  { const v = parseFloat(LS('spk_mus')); if (v >= 0 && v <= 1) MUS.setVol(v); }
  { const v = parseFloat(LS('spk_vcv')); if (v >= 0 && v <= 1) VC.setVol(v); }
  if (LS('spk_vch') === '0') VC.hear = false;
  if (LS('spk_snd') === '0') AU.setEnabled(false);
  MUS._last = MUS.vol > 0.001 ? MUS.vol : 0.75;
  const pct = v => v <= 0.001 ? 'KAPALI' : Math.round(v * 100) + '%';
  const tog = (id, on) => { const b = $(id); b.textContent = on ? 'AÇIK' : 'KAPALI'; b.classList.toggle('off', !on); };
  const seg = (id, v) => { for (const b of $(id).querySelectorAll('button')) b.classList.toggle('sel', b.dataset.v === v); };
  window.uiSettingsRefresh = () => {
    tog('stSound', AU.enabled);
    tog('stMus', MUS.vol > 0.001); $('musR').value = MUS.vol; $('musRV').textContent = pct(MUS.vol);
    tog('stVc', VC.hear); $('vcR').value = VC.vol; $('vcRV').textContent = pct(VC.vol);
    seg('stGfx', SETTINGS.gfx); seg('stLang', LANG);
    $('sensR2').value = SETTINGS.sens; $('sensV2').textContent = SETTINGS.sens.toFixed(2);
    $('btnMute').textContent = AU.enabled ? 'SESİ KAPAT' : 'SESİ AÇ';
  };
  $('stSound').onclick = () => { AU.setEnabled(!AU.enabled); LS('spk_snd', AU.enabled ? '1' : '0'); uiSettingsRefresh(); };
  $('stMus').onclick = () => { if (MUS.vol > 0.001) { MUS._last = MUS.vol; MUS.setVol(0); } else MUS.setVol(MUS._last || 0.75); LS('spk_mus', MUS.vol); uiSettingsRefresh(); };
  $('musR').oninput = () => { MUS.setVol(+$('musR').value); if (MUS.vol > 0.001) MUS._last = MUS.vol; LS('spk_mus', MUS.vol); uiSettingsRefresh(); };
  $('stVc').onclick = () => { VC.hear = !VC.hear; LS('spk_vch', VC.hear ? '1' : '0'); uiSettingsRefresh(); };
  $('vcR').oninput = () => { VC.setVol(+$('vcR').value); LS('spk_vcv', VC.vol); uiSettingsRefresh(); };
  for (const b of $('stGfx').querySelectorAll('button')) b.onclick = () => { SETTINGS.gfx = b.dataset.v; LS('spk_gfx', SETTINGS.gfx); resize(); uiSettingsRefresh(); };
  for (const b of $('stLang').querySelectorAll('button')) b.onclick = () => { setLang(b.dataset.v); uiSettingsRefresh(); G._buySig = null; if (UI.buyOpen) uiRenderBuy(); };
  $('sensR2').oninput = () => { SETTINGS.sens = +$('sensR2').value; $('sensR').value = SETTINGS.sens; $('sensV').textContent = SETTINGS.sens.toFixed(2); LS('spk_sens', SETTINGS.sens); uiSettingsRefresh(); };
  $('btnSettings').onclick = () => openSettings();
  $('btnPauseSet').onclick = () => openSettings();
  $('btnSetBack').onclick = () => closeSettings();
  $('emoteBox').innerHTML = '<div class="eh">EMOTE · 1–6 seç · Z kapat</div><div class="eg">' + EMOTES.map((m, i) => '<button data-e="' + i + '"><i>' + m.e + '</i><b>' + (i + 1) + '</b><span>' + m.n + '</span></button>').join('') + '</div>';
  for (const bt of $('emoteBox').querySelectorAll('button')) bt.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); doEmote(+bt.dataset.e); });
  uiSettingsRefresh();
  applyLang(); i18nObserve();
  $('sensR').oninput = () => { SETTINGS.sens = +$('sensR').value; $('sensV').textContent = SETTINGS.sens.toFixed(2); try { localStorage.setItem('spk_sens', SETTINGS.sens); } catch (e) { } };
  admInit(); // admin paneli (08b)
  frMenuInit(); // serbest mod spawn menüsü (08c)
  ctlInit(); // tuş atama + dokunmatik düzen (08e)
  if (!glok) setTimeout(() => uiToast('WebGL başlatılamadı — tarayıcın 3D grafiği desteklemiyor olabilir.', true), 300);
  try { const n = localStorage.getItem('spk_name'); if (n) $('inName').value = n; } catch (e) { }
  $('btnSP').onclick = () => { AU.init(); AU.resume(); uiShow('scr-sp'); };
  $('btnHost').onclick = () => {
    AU.init(); AU.resume();
    if (!netAvailable()) { const m = netBlockedMsg('PeerJS yüklenemedi — çok oyunculu mod için internet bağlantısı gerekli.'); $('netStatus').textContent = m; uiToast(m.length > 90 ? 'Çok oyunculu başlatılamadı — ayrıntı menüde.' : m, true); return; }
    $('btnHost').disabled = true; $('netStatus').textContent = 'Oda oluşturuluyor...';
    hostCreate(playerName(), code => {
      $('btnHost').disabled = false; $('netStatus').textContent = '';
      uiShow('scr-lobby'); uiRenderLobby();
    }, err => { $('btnHost').disabled = false; $('netStatus').textContent = err; uiToast(err.length > 90 ? 'Oda kurulamadı — ayrıntı menüde.' : err, true); netShutdown(); });
  };
  // HERKESE AÇIK SUNUCU: uygun odaya gir ya da yeni açık oda kur
  $('btnPub').onclick = () => {
    AU.init(); AU.resume();
    if (!netAvailable() || !rtcAvailable()) { const m = netBlockedMsg('Çok oyunculu mod bu sayfada çalışmıyor.'); $('netStatus').textContent = m; uiToast(m.length > 90 ? 'Çok oyunculu başlatılamadı — ayrıntı menüde.' : m, true); return; }
    uiShow('scr-pub'); $('pubStatus').textContent = 'Açık sunucular aranıyor…'; $('pubInfo').textContent = '';
    PUB.quickJoin(playerName(), {
      status: m => { if (UI.screen === 'scr-pub') $('pubStatus').textContent = m; },
      info: m => { $('pubInfo').textContent = m; },
      joined: () => { uiShow('scr-lobby'); uiRenderLobby(); uiToast('Açık sunucuya katıldın!'); },
      hosted: () => { uiShow('scr-lobby'); uiRenderLobby(); uiToast('Yeni açık sunucu kuruldu — oyuncular bekleniyor'); },
      fail: m => { uiShow('scr-play'); $('netStatus').textContent = m; uiToast(m.length > 90 ? 'Açık sunucuya bağlanılamadı — ayrıntı menüde.' : m, true); }
    });
  };
  $('btnPubCancel').onclick = () => { PUB.cancel(); uiShow('scr-play'); };
  $('lbPubChk').onchange = () => { if (NET.mode !== 'host') return; if ($('lbPubChk').checked) PUB.start(); else PUB.stop(); broadcastLobby(); };
  setInterval(() => { if (UI.screen === 'scr-lobby') uiLobbyPub(); }, 500);
  $('btnJoin').onclick = () => { AU.init(); AU.resume(); uiShow('scr-join'); $('joinStatus').textContent = ''; setTimeout(() => $('inCode').focus(), 50); };
  // ANA MENÜ: OYNA → oyun türleri · MAĞAZA → doğrudan mağaza · AYARLAR → ayarlar + diğer her şey
  $('btnPlay').onclick = () => { AU.init(); AU.resume(); uiShow('scr-play'); };
  $('btnHelp').onclick = () => { closeSettings(); uiShow('scr-help'); };
  $('btnExit').onclick = () => { closeSettings(); exitGame(); };
  $('btnNetCfg').onclick = () => { closeSettings(); openNetCfg(); };
  bindNetLinks(document);
  $('btnNetBack').onclick = () => uiShow(NETCFG_BACK);
  $('btnNetSave').onclick = () => { if (saveNetCfg()) { uiToast(turnUrls(turnLoad()).length ? 'TURN ayarları kaydedildi.' : 'Özel TURN kaldırıldı, varsayılanlar kullanılacak.'); uiShow(NETCFG_BACK); if (NETCFG_BACK === 'scr-lobby') uiNetStatus(); } };
  $('btnNetTest').onclick = () => {
    if (!saveNetCfg()) return;
    const out = $('netDiagOut'), btn = $('btnNetTest'), custom = turnUrls(turnLoad()).length > 0;
    btn.disabled = true; out.innerHTML = '<span class="dim">Test ediliyor… (10 sn kadar)</span>';
    netDiag(r => {
      btn.disabled = false;
      const L = (ok, a, b) => '<div class="' + (ok ? 'ok' : 'bad') + '">' + (ok ? '✓ ' : '✗ ') + (ok ? a : b) + '</div>';
      let h = L(r.sig, 'Eşleştirme sunucusu (oda kodu) erişilebilir', 'Eşleştirme sunucusuna ulaşılamadı — internet / güvenlik duvarı engeli olabilir');
      h += L(r.srflx, 'Genel IP bulundu (STUN) — doğrudan bağlantı mümkün olabilir', 'Genel IP bulunamadı (STUN engelli) — TURN şart');
      if (custom) h += L(r.relayCustom || r.relay, 'Aktarma (TURN) çalışıyor — farklı ağlardan bağlanabilirsiniz', 'Senin TURN sunucun yanıt vermedi — adres, kullanıcı adı veya şifre hatalı olabilir');
      else h += L(r.relay, 'Varsayılan aktarma (PeerJS TURN) çalışıyor', 'Varsayılan aktarma sunucusu yanıt vermedi — farklı ağlarda bağlanmak için kendi TURN bilgilerini gir');
      if (r.err) h += '<div class="dim">' + esc(r.err) + '</div>';
      out.innerHTML = h;
    });
  };
  $('btnBye').onclick = () => { G.bye = false; $('bye').classList.add('hidden'); try { if (AU.ctx && AU.ctx.resume) AU.ctx.resume(); } catch (e) { } uiShow('scr-menu'); };
  // harita seçimi
  let spMapV = -1; try { const v = parseInt(localStorage.getItem('spk_map'), 10); if (v >= -1 && v < MAPS.length) spMapV = v; } catch (e) { }
  mapOptions($('spMap'), true, spMapV); mapOptions($('lbMap'), true, 0);
  const spNote = () => {
    const pk = $('spMode').value === 'pk';
    $('spSideRow').style.display = $('spMapRow').style.display = pk ? 'none' : '';
    $('spSizeL').textContent = pk ? 'YARIŞÇI SAYISI' : 'TAKIM BOYUTU';
    for (const o of $('spSize').options) o.textContent = pk ? (o.value * 2) + ' yarışçı' : o.value + 'v' + o.value;
    const am = $('spMode').value;
    $('spSub').textContent = pk ? 'Kılıçla engel yarışı · 5 raunt, her raunt farklı uzun parkur · bitişe ilk varan raundu alır' : am === 'gg' ? 'SİLAH YARIŞI · her öldürmede sıradaki silah · son silah kılıç: kılıçla ilk öldüren takım kazanır' : am === 'sn' ? 'SÜPERNOVA · parlayan bölge yer değiştirir · bölgeyi tutan takım puan toplar · 100 puan kazanır' : am === 'fr' ? 'SERBEST · görev ve süre yok · [Q] spawn menüsü: bedava silah, NPC, pill · arkadaşlarınla oynamak için ODA KUR' : 'Botlara karşı tam maç · 20 raunt · 10. rauntten sonra taraf değişir';
    $('btnSpGo').textContent = pk ? 'PARKURA BAŞLA' : 'AJAN SEÇİMİ';
    const i = +$('spMap').value;
    $('spMapNote').textContent = pk ? 'Elinde yalnızca kılıç var: rakipleri it, barikatları kır, boşluklardan atla. Düşersen son kontrol noktasından devam edersin.' : i >= 0 ? MAPS[i].desc : 'Her maçta ' + MAPS.length + ' haritadan biri rastgele seçilir.';
  };
  try { const md = localStorage.getItem('spk_mode'); if (md === 'pk' || md === 'bomb' || md === 'gg' || md === 'sn' || md === 'fr') $('spMode').value = md; } catch (e) { }
  $('spMode').onchange = () => { try { localStorage.setItem('spk_mode', $('spMode').value); } catch (e) { } spNote(); };
  spNote();
  $('spMap').onchange = () => {
    const i = +$('spMap').value; spNote();
    try { localStorage.setItem('spk_map', i); } catch (e) { }
    if (i >= 0 && i !== CUR_MAP && !G.running) loadMap(i); // arka planda haritayı önizle
  };
  for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => { if (NET.mode !== 'off') netShutdown(); uiShow(b.dataset.back || 'scr-menu'); };
  $('btnSpGo').onclick = () => {
    NET.mode = 'off'; G.myId = 'h';
    const cfg = { teamSize: +$('spSize').value, fill: true, diff: $('spDiff').value, map: +$('spMap').value, mode: modeOf($('spMode').value) };
    if (cfg.mode === 'fr') cfg.fill = false; // serbest: tek başına dolaş (NPC'leri spawn menüsünden çıkar)
    const team = $('spSide').value === 'atk' ? 0 : 1;
    selStart([{ id: 'h', name: playerName(), team, cos: SHOP.cos() }], cfg);
  };
  $('btnConnect').onclick = () => {
    const code = $('inCode').value.trim().toUpperCase();
    if (code.length < 4) { $('joinStatus').textContent = 'Geçerli bir oda kodu gir.'; return; }
    $('joinStatus').textContent = 'Bağlanılıyor...'; $('btnConnect').disabled = true;
    clientJoin(code, playerName(), () => { $('btnConnect').disabled = false; uiShow('scr-lobby'); uiRenderLobby(); },
      err => { $('btnConnect').disabled = false; $('joinStatus').textContent = err; },
      msg => { if (UI.screen === 'scr-join') $('joinStatus').textContent = msg; });
  };
  $('inCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnConnect').click(); });
  $('btnCopy').onclick = () => { try { navigator.clipboard.writeText(NET.code); uiToast('Oda kodu kopyalandı: ' + NET.code); } catch (e) { uiToast('Kod: ' + NET.code); } };
  $('btnLobbyStart').onclick = () => {
    if (NET.mode !== 'host') return;
    const L = NET.lobby;
    if (!L.cfg.fill && L.cfg.mode !== 'fr' && (!L.players.some(p => p.team === 0) || !L.players.some(p => p.team === 1))) uiToast('Bir takım boş — o takıma bot eklenecek.');
    selStart(L.players.filter(p => !p.bot), L.cfg);
  };
  $('btnLobbyLeave').onclick = () => { netShutdown(); uiShow('scr-play'); };
  for (const id of ['lbSize', 'lbFill', 'lbDiff', 'lbMap', 'lbMode']) $(id).onchange = () => {
    if (NET.mode !== 'host') return;
    NET.lobby.cfg = { teamSize: +$('lbSize').value, fill: $('lbFill').checked, diff: $('lbDiff').value, map: +$('lbMap').value, ff: NET.lobby.cfg.ff !== false, mode: modeOf($('lbMode').value) };
    broadcastLobby();
  };
  // TAKIM ATEŞİ: tek tıkla aç/kapa (lobide host, maçta host veya tek oyunculu)
  $('lbFF').onclick = () => { if (NET.mode !== 'host' || !NET.lobby) return; NET.lobby.cfg.ff = NET.lobby.cfg.ff === false; broadcastLobby(); uiRenderLobby(); };
  $('btnFF').onclick = () => { if (!S || G.mode === 'client') return; setFF(!ffOn()); uiFFBtn(); };
  $('btnLock').onclick = () => {
    if (NET.mode === 'client') netSend(NET.conn, { t: 'lock' }); else selApplyLock(G.myId);
    if (NET.mode === 'off' && !IS_TOUCH) lockPointer(true);
  };
  $('lockHint').onclick = () => lockPointer(true);
  $('btnResume').onclick = () => togglePause(false);
  $('btnMute').onclick = () => { AU.setEnabled(!AU.enabled); try { localStorage.setItem('spk_snd', AU.enabled ? '1' : '0'); } catch (e) { } $('btnMute').textContent = AU.enabled ? 'SESİ KAPAT' : 'SESİ AÇ'; };
  $('btnQuit').onclick = () => quitToMenu();
  $('btnEndMenu').onclick = () => uiBackToMenu();
  $('buyClose').onclick = () => closeBuy();
  // girdi
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', e => { KEYS[e.code] = false; if (kbIs(e, 'board')) UI.board = false; if (kbIs(e, 'voice')) VC.keyUp(); });
  $('chatIn').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); chatClose(true); } else if (e.key === 'Escape') { e.preventDefault(); chatClose(false); } });
  window.addEventListener('blur', () => { if (!VC.open) VC.setTalk(false); for (const k in KEYS) KEYS[k] = false; MOUSE.down = false; MOUSE.right = false; UI.board = false; });
  document.addEventListener('mousemove', e => {
    if (!isLocked()) { MOUSE.x = e.clientX; MOUSE.y = e.clientY; MOUSE.inside = true; }
    if (!G.running || !S || IS_TOUCH || UI.overlay || CINE.on) return;
    if (!isLocked() && !G.freeMouse) return;
    // bazı sistemlerde kilit açılıp kapanırken dev sıçramalar gelir: kırp
    const mx = clamp(e.movementX || 0, -260, 260), my = clamp(e.movementY || 0, -260, 260);
    const me = S.pmap[G.myId], k = 0.0022 * SETTINGS.sens * (me && me.scoped ? 0.35 : 1);
    LOOK.yaw += mx * k; LOOK.pitch = clamp(LOOK.pitch - my * k, -1.4, 1.4);
  });
  document.documentElement.addEventListener('mouseleave', () => { MOUSE.inside = false; });
  document.addEventListener('mouseout', e => { if (!e.relatedTarget) MOUSE.inside = false; });
  glcv.addEventListener('mousedown', e => {
    AU.resume();
    if (!G.running || !S || IS_TOUCH) return;
    if (CINE.on && e.button === 0) { cineStop(true); if (!isLocked()) lockPointer(true); return; } // tıklama sinematiği atlar
    if (!isLocked()) {
      lockPointer(true);                 // her tıklamada kilidi (yeniden) iste — doğrudan kullanıcı eylemi içinde
      if (!G.freeMouse) return;          // kilit bekleniyorsa bu tıklama sadece kilitler
    }
    if (e.button === 0) {
      MOUSE.down = true; MOUSE.fp = (MOUSE.fp + 1) | 0;
      const me = S.pmap[G.myId]; if (me && !me.alive) cycleSpec();
    }
    if (e.button === 2) MOUSE.right = true;
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) MOUSE.down = false; if (e.button === 2) MOUSE.right = false; });
  glcv.addEventListener('contextmenu', e => e.preventDefault());
  glcv.addEventListener('wheel', e => { if (!G.running || !S) return; const me = S.pmap[G.myId]; if (!me) return; doSlot(nextSlot(me, e.deltaY < 0 ? -1 : 1)); }, { passive: true });
  document.addEventListener('pointerlockerror', () => {
    // doğrudan bir tıklamadan gelen istek reddedildiyse serbest fare moduna geç (oyun oynanabilir kalsın)
    // (ESC ile çıktıktan hemen sonraki ~1 sn'lik tarayıcı bekleme süresindeki retler geçicidir: sayma)
    const now = performance.now();
    if (G._lockGesture && now - (G._lockReqT || -1e9) < 2000 && now - (G._unlockT || -1e9) > 1600) enterFreeMouse('denied');
  });
  document.addEventListener('pointerlockchange', () => {
    MOUSE.down = false; MOUSE.right = false;
    if (document.pointerLockElement === glcv) { G.freeMouse = false; return; }
    G._unlockT = performance.now();
    if (!G.running || UI.buyOpen || UI.pauseOpen || UI.setOpen || G._noPauseOnUnlock || (S && S.phase === 'over')) return;
    // Kilit beklenmedik şekilde açıldı (ESC ya da pencere değişimi) → çıkış menüsü
    G._escMenuT = performance.now();
    togglePause(true);
  });
  setupTouch();
  document.addEventListener('contextmenu', e => { if (G.running) e.preventDefault(); });
  if (IN_PREVIEW) $('netStatus').textContent = 'Önizleme penceresindesin: tek oyunculu çalışır, ama çok oyunculu burada çalışmaz. Çok oyunculu için dosyayı indirip Safari veya Chrome\'da doğrudan aç.';
  else if (!netAvailable()) $('netStatus').textContent = 'PeerJS yüklenemedi: çok oyunculu mod için internet gerekir. Tek oyunculu mod çalışır.';
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) uiToast('Dokunmatik kontroller hazır — telefonu yatay tut, tam ekran (⛶) önerilir.');
  uiShow('scr-menu');
  requestAnimationFrame(frame);
}

/* ---------------- LOBİ ---------------- */
function uiRenderLobby() {
  const L = NET.lobby; if (!L) return;
  const host = NET.mode === 'host';
  $('lbCode').textContent = L.code || NET.code;
  $('lbHostCtl').style.display = host ? '' : 'none';
  $('lbWait').style.display = host ? 'none' : '';
  uiNetStatus();
  const mv = L.cfg.map === undefined ? 0 : L.cfg.map;
  const pkm = L.cfg.mode === 'pk';
  $('lbSize').value = L.cfg.teamSize; $('lbFill').checked = L.cfg.fill; $('lbDiff').value = L.cfg.diff; $('lbMap').value = String(mv); $('lbMode').value = modeOf(L.cfg.mode);
  $('lbSize').disabled = $('lbFill').disabled = $('lbDiff').disabled = $('lbMap').disabled = $('lbFF').disabled = $('lbMode').disabled = !host;
  $('lbMapRow').style.display = $('lbFF').parentNode.style.display = pkm ? 'none' : '';
  const ffv = L.cfg.ff !== false; $('lbFF').textContent = 'TAKIM ATEŞİ: ' + (ffv ? 'AÇIK' : 'KAPALI') + (host ? '  ·  tıkla' : ''); $('lbFF').classList.toggle('off', !ffv);
  if (pkm) $('lbCfgText').textContent = 'Mod: PARKUR · 5 parkur · takım yok, herkes kendi için yarışır · Yarışçı: ' + L.cfg.teamSize * 2 + (L.cfg.fill ? ' (botlarla)' : '') + ' · Zorluk: ' + L.cfg.diff;
  else $('lbCfgText').textContent = (L.cfg.mode === 'gg' ? 'Mod: SİLAH YARIŞI · ' : L.cfg.mode === 'sn' ? 'Mod: SÜPERNOVA · ' : L.cfg.mode === 'fr' ? 'Mod: SERBEST · ' : '') + 'Harita: ' + mapLabel(mv) + ' · Takım boyutu: ' + L.cfg.teamSize + 'v' + L.cfg.teamSize + ' · Bot doldurma: ' + (L.cfg.fill ? 'Açık' : 'Kapalı') + ' · Zorluk: ' + L.cfg.diff + ' · Takım ateşi: ' + (L.cfg.ff !== false ? 'Açık' : 'Kapalı');
  for (const team of [0, 1]) {
    const box = $('lbTeam' + team); box.innerHTML = '';
    const ps = L.players.filter(p => p.team === team);
    for (const p of ps) {
      const d = document.createElement('div'); d.className = 'slot' + (p.id === G.myId ? ' me' : '');
      const me = p.id === G.myId, vs = ((host ? NET.vs : L.vs) || {})[p.id] || {}, talk = me ? VC.talking : !!vs.vt, hasMic = me ? !!VC.stream : !!vs.vm;
      d.innerHTML = '<span>' + esc(p.name) + (p.id === 'h' ? ' <b class="tag">HOST</b>' : '') + (talk ? ' <span class="mic">🎤</span>' : hasMic ? ' <span class="mic idle">🎤</span>' : '') + '</span>' + (host ? '<span class="sw" title="Takım değiştir">⇄</span>' : '');
      if (!me && p.uid && p.uid !== FR.uid && FR.acc && FR.nick) {
        const fb = document.createElement('span'); fb.className = 'fadd';
        if (FR.isFriend(p.uid)) { fb.textContent = '✓ ARKADAŞ'; fb.classList.add('done'); }
        else if (FR.reqOut.some(r => r.uid === p.uid)) { fb.textContent = 'İSTEK GÖNDERİLDİ'; fb.classList.add('done'); }
        else if (FR.reqIn.some(r => r.uid === p.uid)) { fb.textContent = 'İSTEĞİ KABUL ET'; fb.onclick = () => { FR.accept(p.uid); uiRenderLobby(); }; }
        else { fb.textContent = '+ ARKADAŞ EKLE'; fb.onclick = () => { FR.request(p.uid, p.name); uiRenderLobby(); }; }
        d.insertBefore(fb, d.children[1] || null);
      }
      if (host) d.querySelector('.sw').onclick = () => { p.team = 1 - p.team; broadcastLobby(); };
      if (host && p.id !== 'h') { const k = document.createElement('span'); k.className = 'kick'; k.textContent = '✕'; k.title = 'Çıkar'; k.onclick = () => hostKick(p.id); d.appendChild(k); }
      box.appendChild(d);
    }
    const fillN = L.cfg.fill ? Math.max(0, L.cfg.teamSize - ps.length) : 0;
    for (let i = 0; i < fillN; i++) { const d = document.createElement('div'); d.className = 'slot bot'; d.textContent = 'BOT'; box.appendChild(d); }
  }
  uiRenderLobbyChat();
  uiLobbyPub();
  pakUi(); // içerik indirme durumu (06b)
}
/* açık sunucu durumu: oyuncu sayısı + otomatik başlama geri sayımı */
function uiLobbyPub() {
  const L = NET.lobby, el = $('lbPub'); if (!L || !el) return;
  const host = NET.mode === 'host';
  $('lbPubChk').checked = !!L.pub; $('lbPubChk').disabled = !host;
  if (!L.pub) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const n = L.players.filter(p => !p.bot).length;
  let left = 0;
  if (host) left = L.autoAt ? Math.max(0, (L.autoAt - Date.now()) / 1000) : 0;
  else if (L.autoIn) left = Math.max(0, L.autoIn - (performance.now() - (L._at || performance.now())) / 1000);
  el.textContent = '🌐 HERKESE AÇIK SUNUCU · Oyuncu: ' + n + '/10 · ' + (left > 0 ? 'Başlamasına ' + Math.ceil(left) + ' sn' : n < 2 ? 'Oyuncu bekleniyor (en az 2 kişi)' : 'Maç başlıyor…');
}
function uiRenderLobbyChat() {
  const log = $('lbChatLog'); if (!log) return;
  const lines = NET.lchat || [];
  log.innerHTML = lines.length ? lines.map(c => '<div class="ln"><b class="t' + c.tm + '">' + esc(c.n) + ':</b>' + esc(c.m) + '</div>').join('') : '<div class="ln" style="color:var(--dim)">Lobi sohbeti — mesaj yaz ya da 0\'a basılı tutup konuş.</div>';
  log.scrollTop = log.scrollHeight;
}
/* ---------------- ARKADAŞLAR ---------------- */
function uiFriendsChanged() {
  const b = $('btnFriends'); if (b) { const on = FR.onlineCount(), rq = FR.reqIn.length; b.innerHTML = esc('ARKADAŞLAR') + (on ? ' · ' + on + ' ' + esc('ÇEVRİMİÇİ') : '') + (rq ? '<b>' + rq + '</b>' : ''); }
  const sb = $('btnSettings'); if (sb) { const rq = FR.reqIn.length; sb.innerHTML = esc('AYARLAR') + (rq ? '<b>' + rq + '</b>' : ''); }
  if (UI.screen === 'scr-friends') uiRenderFriends();
  if (UI.screen === 'scr-lobby' && NET.lobby) uiRenderLobby();
}
let frOpen = null;
function uiRenderFriends() {
  if (!FR.acc) {
    $('frMe').innerHTML = esc('Arkadaş sistemi için bir hesap gerekli.') + ' <button id="frAccBtn" class="primary" style="width:auto;margin:8px 0 0;padding:9px 14px">' + esc('HESAP AÇ / GİRİŞ YAP') + '</button>';
    $('frAccBtn').onclick = () => uiAccountOpen('up');
    $('frReqs').innerHTML = ''; $('frList').innerHTML = ''; return;
  }
  $('frMe').innerHTML = esc('Kullanıcı adın: ') + '<b>' + esc(FR.nick || '—') + '</b> · ' + esc(FR.ready || FR.online ? 'Çevrimiçisin' : 'Sunucuya bağlanılıyor…') + ' <a href="#" id="frLogout" style="margin-left:10px;color:var(--dim)">' + esc('ÇIKIŞ YAP') + '</a>';
  $('frLogout').onclick = e => { e.preventDefault(); ACC.logout(); try { localStorage.removeItem('spk_guest'); } catch (x) { } location.reload(); };
  let rq = '';
  for (const r of FR.reqIn) rq += '<div class="frreq"><span>' + esc(r.nick) + ' ' + esc('sana arkadaşlık isteği gönderdi') + '</span><button class="primary" data-acc="' + esc(r.uid) + '">' + esc('KABUL ET') + '</button><button class="ghost" data-dec="' + esc(r.uid) + '">' + esc('REDDET') + '</button></div>';
  for (const r of FR.reqOut) rq += '<div class="frreq" style="opacity:.7"><span>' + esc(r.nick) + ' · ' + esc('istek gönderildi, yanıt bekleniyor') + '</span></div>';
  $('frReqs').innerHTML = rq;
  const list = FR.list.slice().sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || (b.lastSeen || 0) - (a.lastSeen || 0));
  let h = list.length ? '' : '<div class="note">' + esc('Henüz arkadaşın yok.') + '</div>';
  for (const f of list) {
    h += '<div class="frrow' + (f.online ? ' on' : '') + '" data-f="' + esc(f.uid) + '"><div class="dot"></div><div class="nm">' + esc(f.nick) + '</div><div class="st">' + esc(frStatusText(f)) + '</div></div>';
    if (frOpen === f.uid) {
      h += '<div class="fract">';
      if (f.online && f.st === 'lobby' && f.code) h += '<button class="primary" data-join="' + esc(f.uid) + '">' + esc('OYUNA KATIL') + '</button>';
      else h += '<span class="note" style="align-self:center">' + esc(f.online ? (f.st === 'game' ? 'Maçta — maç bitince katılabilirsin' : 'Bir odada değil') : 'Çevrimdışı') + '</span>';
      h += '<button class="ghost" data-rm="' + esc(f.uid) + '">' + esc('ARKADAŞLIKTAN ÇIKAR') + '</button></div>';
    }
  }
  $('frList').innerHTML = h;
  for (const el of document.querySelectorAll('#frReqs [data-acc]')) el.onclick = () => FR.accept(el.dataset.acc);
  for (const el of document.querySelectorAll('#frReqs [data-dec]')) el.onclick = () => FR.decline(el.dataset.dec);
  for (const el of document.querySelectorAll('#frList .frrow')) el.onclick = () => { frOpen = frOpen === el.dataset.f ? null : el.dataset.f; uiRenderFriends(); };
  for (const el of document.querySelectorAll('#frList [data-join]')) el.onclick = e => { e.stopPropagation(); FR.askJoin(el.dataset.join); };
  for (const el of document.querySelectorAll('#frList [data-rm]')) el.onclick = e => { e.stopPropagation(); FR.remove(el.dataset.rm); frOpen = null; };
}
/* istek açılır kartı (kuyruklu) */
function uiFriendPopup(kind, uid, nick) {
  if (G.running) { if (kind === 'freq') uiToast(nick + ' sana arkadaşlık isteği gönderdi — ana menüdeki ARKADAŞLAR\'dan kabul edebilirsin.'); return; }
  if (FR.pops.some(p => p.kind === kind && p.uid === uid)) return; // aynı istek iki yoldan gelirse tek pencere
  if (kind === 'freq' && FR.isFriend(uid)) return;
  FR.pops.push({ kind, uid, nick }); if (FR.pops.length === 1) uiFriendPopShow();
}
function uiFriendPopShow() {
  const p = FR.pops[0]; if (!p) { $('frPop').classList.add('hidden'); return; }
  $('frPopT').textContent = p.kind === 'join' ? p.nick + ' odana katılmak istiyor' : p.nick + ' sana arkadaşlık isteği gönderdi';
  $('frPop').classList.remove('hidden');
  clearTimeout(FR._popT); FR._popT = setTimeout(() => { if (FR.pops[0] === p) uiFriendPopAnswer(null); }, 30000);
}
function uiFriendPopAnswer(ok) {
  const p = FR.pops.shift(); $('frPop').classList.add('hidden');
  if (p) {
    if (p.kind === 'join') FR.answerJoin(p.uid, !!ok);
    else if (ok) FR.accept(p.uid); else if (ok === false) FR.decline(p.uid);
  }
  setTimeout(uiFriendPopShow, 200);
}
/* arkadaş kabul etti: onun odasına gir */
function uiFriendJoin(code, nick) {
  if (G.running) return;
  if (NET.mode !== 'off') netShutdown();
  uiToast(nick + ' isteğini kabul etti — odaya giriliyor…');
  uiShow('scr-join'); $('inCode').value = code; setTimeout(() => $('btnConnect').click(), 150);
}

/* ---------------- AJAN SEÇİMİ ---------------- */
let selDetail = null;
function uiRenderSelect(sel) {
  if (!sel) return;
  if (UI.screen !== 'scr-select') { uiShow('scr-select'); selDetail = null; }
  const me = sel.players.find(p => p.id === G.myId);
  if (!me) return;
  const myPick = sel.picks[G.myId], locked = !!sel.locks[G.myId];
  $('selTimer').textContent = Math.max(0, Math.ceil(sel.remain));
  $('selSide').textContent = 'HARİTA: ' + mapLabel(sel.cfg.map) + ' · ' + (me.team === 0 ? 'İLK YARI: SALDIRAN' : 'İLK YARI: SAVUNAN') + ' · ' + sel.cfg.teamSize + 'v' + sel.cfg.teamSize + ' · ' + String(sel.cfg.diff).toUpperCase();
  const grid = $('selGrid');
  if (!grid.children.length) {
    for (const id of AGENT_IDS) {
      const a = AGENTS[id], c = document.createElement('div');
      c.className = 'agent'; c.dataset.id = id;
      c.innerHTML = '<div class="ic" style="background:' + a.color + '">' + a.icon + '</div><div class="nm">' + a.name + '</div><div class="rl">' + a.role + '</div>';
      c.onclick = () => {
        selDetail = id;
        const s = NET.sel; if (!s) return;
        if (s.locks[G.myId]) { uiRenderSelect(s); return; }
        if (NET.mode === 'client') netSend(NET.conn, { t: 'pick', agent: id }); else selApplyPick(G.myId, id);
        uiRenderSelect(s);
      };
      grid.appendChild(c);
    }
  }
  for (const c of grid.children) {
    const id = c.dataset.id, taken = sel.players.some(p => p.team === me.team && p.id !== G.myId && sel.picks[p.id] === id);
    c.classList.toggle('sel', myPick === id);
    c.classList.toggle('taken', taken);
    c.classList.toggle('locked', locked);
  }
  const did = myPick || selDetail || AGENT_IDS[0], a = AGENTS[did];
  $('selDetail').innerHTML = '<div class="dh"><div class="ic big" style="background:' + a.color + '">' + a.icon + '</div><div><div class="dn">' + a.name + '</div><div class="dr">' + a.role + '</div></div></div>' +
    ['q', 'e', 'x'].map(k => {
      const ab = a[k];
      const meta = k === 'x' ? ab.pts + ' ulti puanı' : (ab.cost ? '¤' + ab.cost : 'Ücretsiz') + ' · en fazla ' + ab.max + (ab.free ? ' · her raunt 1 bedava' : '');
      return '<div class="ab"><span class="k">' + esc(IS_TOUCH ? k.toUpperCase() : kbLabel(k)) + '</span><div><b>' + ab.name + '</b> <i>' + meta + '</i><p>' + ab.desc + '</p></div></div>';
    }).join('');
  $('btnLock').disabled = !myPick || locked;
  $('btnLock').textContent = locked ? 'KİLİTLENDİ' : 'KİLİTLE';
  const team = $('selTeam'); team.innerHTML = '';
  for (const p of sel.players.filter(p => p.team === me.team)) {
    const ag = sel.picks[p.id] ? AGENTS[sel.picks[p.id]] : null;
    const d = document.createElement('div'); d.className = 'tm' + (sel.locks[p.id] ? ' lk' : '');
    d.innerHTML = '<div class="ic sm" style="background:' + (ag ? ag.color : '#333') + '">' + (ag ? ag.icon : '?') + '</div><div><div>' + esc(p.name) + (p.id === G.myId ? ' (sen)' : '') + '</div><small>' + (ag ? ag.name + (sel.locks[p.id] ? ' ✓' : ' …') : 'seçiyor…') + '</small></div>';
    team.appendChild(d);
  }
}

/* ---------------- OYUN AKIŞI ---------------- */
function uiStartGame() {
  uiShow(null);
  closeBuy(); togglePause(false); $('end').classList.add('hidden');
  G.running = true; G.paused = false; G.overShown = false; G.spec = null; CINE.on = false; document.body.classList.remove('cine');
  FX.length = 0; UIS.feed.length = 0; UIS.msgs.length = 0; UIS.banner = null; UIS.ultFeed.length = 0; UIS.pings.length = 0; UIS.dmgNums.length = 0;
  LOCALFIRE.cd = 0; LOCALFIRE.lastFp = MOUSE.fp;
  AU.init(); AU.resume();
  document.body.classList.add('ingame');
  $('touch').classList.toggle('hidden', !IS_TOUCH);
  $('tbFull').classList.toggle('hidden', IS_IOS && IS_STANDALONE);
  for (const k in TOUCH.ptr) delete TOUCH.ptr[k];
  TOUCH.jx = TOUCH.jy = 0; TOUCH.fire = TOUCH.use = TOUCH.alt = TOUCH.crouch = false;
  for (const id of ['tbCrouch', 'tbScope']) { const el = $(id); if (el) el.classList.remove('lit'); }
  tbApplyMode(); // yalnızca bu modda işe yarayan dokunmatik butonlar (08e)
  syncCursor();
  if (IS_TOUCH) { enterFullscreen(); try { screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }
  else { G.freeMouse = false; G._needLock = undefined; lockPointer(false); }
  glcv.focus();
  // host / tek oyunculu: ilk rauntun sinematik girişi (istemcide 'round' olayıyla başlar)
  if (G.mode !== 'client' && S && S.round === 1 && S.phase === 'buy') { if (S.cfg && S.cfg.mode === 'pk') { if (PKMAP) cineStart('pk', pkCineShots()); } else cineStart('match'); }
  document.body.classList.toggle('pk', !!(S && S.cfg && S.cfg.mode === 'pk'));
}
function uiBackToMenu(msg) {
  const wasOver = S && S.phase === 'over';
  G.running = false; G.paused = false; S = null; toggleEmote(false); cineStop(false); modStopAll(); npcAudioStop(); if (FRM.open) frMenuToggle(false);
  document.body.classList.remove('pk'); if (PKMAP) loadMap(0); // parkurdan çıkınca menü arka planı normal haritaya döner
  if (CHAT.open) chatClose(false); UIS.chat.length = 0;
  document.body.classList.remove('ingame', 'ovl'); $('touch').classList.add('hidden');
  unlockPointer();
  closeBuy(); togglePause(false, true); $('end').classList.add('hidden');
  if (NET.mode !== 'off') netShutdown();
  uiShow('scr-menu');
  if (msg) uiToast(wasOver ? 'Maç sona erdi.' : msg, !wasOver);
}
function uiFFBtn() {
  const b = $('btnFF'); if (!b || !S) return;
  const on = ffOn(), can = G.mode !== 'client';
  b.textContent = 'TAKIM ATEŞİ: ' + (on ? 'AÇIK' : 'KAPALI') + (can ? '' : ' (oda sahibi değiştirir)');
  b.disabled = !can; b.classList.toggle('off', !on);
}
function toggleEmote(force) {
  const open = force === undefined ? !UI.emoteOpen : !!force;
  UI.emoteOpen = open && !!(G.running && S); $('emoteBox').classList.toggle('hidden', !UI.emoteOpen);
  const eh = $('emoteBox').querySelector('.eh'); if (eh && UI.emoteOpen) eh.textContent = IS_TOUCH ? 'EMOTE · dokunarak seç' : 'EMOTE · 1–6 seç · kapat: ' + kbLabel('emote'); // atanan tuşla
}
function doEmote(i) {
  toggleEmote(false);
  const me = S && S.pmap[G.myId]; if (!me || !me.alive) return;
  if (G.mode === 'client') netSend(NET.conn, { t: 'act', a: 'emote', e: i }); else hostEmote(me, i);
}
function openSettings() { UI.setOpen = true; $('settings').classList.remove('hidden'); $('setMenuOnly').classList.toggle('hidden', !!G.running); UI.overlay = true; MOUSE.down = false; if (window.uiSettingsRefresh) uiSettingsRefresh(); if (G.running) unlockPointer(); }
function closeSettings() { UI.setOpen = false; $('settings').classList.add('hidden'); UI.overlay = UI.pauseOpen || UI.buyOpen; }
function togglePause(force, noRelock) {
  const open = force === undefined ? !UI.pauseOpen : force;
  const was = UI.pauseOpen;
  UI.pauseOpen = open; $('pause').classList.toggle('hidden', !open);
  if (open) unlockPointer(); else if (was && !noRelock && G.running) lockPointer();
  MOUSE.down = false;
  if (G.mode === 'sp') G.paused = open;
  if (open) uiFFBtn();
  $('pauseNote').textContent = G.mode === 'sp' ? 'Oyun duraklatıldı.' : 'Çok oyunculu modda maç arkada devam ediyor!';
  UI.overlay = UI.pauseOpen || UI.buyOpen || !!UI.setOpen;
  syncCursor();
}
function toggleBuy() {
  if (frOn()) { frMenuToggle(); return; } // serbest mod: mağaza yerine spawn menüsü (08c)
  if (UI.buyOpen) { closeBuy(); return; }
  const me = S && S.pmap[G.myId];
  if (!me || !me.alive) return;
  if (PKMAP) { showMsg(null, 'PARKURDA MAĞAZA YOK — YALNIZCA KILIÇ', PAL.dim); return; }
  if (arOn()) { showMsg(null, AR_NAMES[arMode()] + ' MODUNDA MAĞAZA YOK', PAL.dim); return; }
  if (S.phase !== 'buy') { showMsg(null, 'SATIN ALMA EVRESİ BİTTİ', PAL.red); return; }
  UI.buyOpen = true; $('buy').classList.remove('hidden'); UI.overlay = true; MOUSE.down = false; G._buySig = null;
  unlockPointer(); syncCursor();
  uiRenderBuy();
}
function closeBuy() {
  const was = UI.buyOpen;
  UI.buyOpen = false; const b = $('buy'); if (b) b.classList.add('hidden'); UI.overlay = UI.pauseOpen || !!UI.setOpen;
  syncCursor();
  if (was && G.running && !UI.pauseOpen) lockPointer();
}
function requestBuy(item) {
  const me = S && S.pmap[G.myId]; if (!me) return;
  if (G.mode === 'client') netSend(NET.conn, { t: 'act', a: 'buy', it: item });
  else if (!buyItem(me, item)) AU.play('empty');
  setTimeout(uiRenderBuy, 120);
}
function uiRenderBuy() {
  if (!UI.buyOpen || !S) return;
  const me = S.pmap[G.myId]; if (!me) return;
  const ag = AGENTS[me.agent];
  $('buyCredits').textContent = '¤ ' + me.credits;
  $('buyTime').textContent = S.phase === 'buy' ? Math.ceil(S.phaseT) + ' sn' : 'KAPALI';
  const sig = [me.credits, me.primary, me.secondary, me.armor, me.kit, me.ch.q, me.ch.e, S.players.filter(p => p.team === me.team).map(p => p.credits + (p.primary || '')).join(',')].join('|');
  if (sig === G._buySig && $('buyBody').children.length) return;
  G._buySig = sig;
  const item = (id, name, sub, price, owned, extra) => {
    const can = !owned && me.credits >= price;
    return '<div class="item' + (owned ? ' owned' : '') + (can ? '' : ' no') + '" data-it="' + id + '"><div class="in">' + name + '</div><div class="is">' + sub + '</div><div class="ip">' + (owned ? 'SAHİPSİN' : (price ? '¤ ' + price : 'ÜCRETSİZ')) + '</div>' + (extra || '') + '</div>';
  };
  const wsub = w => (w.oneshot ? 'TEK ATAR' : w.dmg + ' hasar') + ' · ' + w.rate + '/sn · ' + w.mag + ' mermi';
  let html = '<div class="cat"><h4>TABANCALAR</h4><div class="row">';
  for (const id of ['classic', 'sheriff']) html += item(id, WEAPONS[id].name, wsub(WEAPONS[id]), WEAPONS[id].price, me.secondary === id);
  html += '</div></div><div class="cat"><h4>SİLAHLAR</h4><div class="row">';
  for (const id of ['spectre', 'vandal', 'phantom', 'railgun', 'operator']) html += item(id, WEAPONS[id].name, WEAPONS[id].type + ' · ' + wsub(WEAPONS[id]), WEAPONS[id].price, me.primary === id);
  html += '</div></div><div class="cat"><h4>ZIRH</h4><div class="row">';
  html += item('light', 'Hafif Zırh', '+25 zırh', 400, me.armor >= 25);
  html += item('heavy', 'Ağır Zırh', '+50 zırh', 1000, me.armor >= 50);
  if (sideOf(me.team) === 'def') html += item('kit', '✂ İmha Kiti', 'Bombayı 1 saniyede imha et · ölünce gider', KIT_PRICE, !!me.kit);
  html += '</div></div><div class="cat"><h4>YETENEKLER — ' + ag.name + '</h4><div class="row">';
  for (const k of ['q', 'e']) {
    const ab = ag[k];
    html += item(k, '[' + esc(IS_TOUCH ? k.toUpperCase() : kbLabel(k)) + '] ' + ab.name, me.ch[k] + ' / ' + ab.max + ' şarj', ab.cost, me.ch[k] >= ab.max);
  }
  html += '</div></div>';
  html += '<div class="cat"><h4>TAKIM EKONOMİSİ</h4><div class="eco">' + S.players.filter(p => p.team === me.team).map(p => '<span>' + esc(p.name) + ' <b>¤' + p.credits + '</b>' + (p.primary ? ' · ' + WEAPONS[p.primary].name : '') + '</span>').join('') + '</div></div>';
  $('buyBody').innerHTML = html;
  for (const el of $('buyBody').querySelectorAll('.item')) el.onclick = () => requestBuy(el.dataset.it);
}
function castAbility(k) {
  const me = S && S.pmap[G.myId]; if (!me || !me.alive) return;
  if (PKMAP) { showMsg(null, 'PARKURDA YETENEK YOK — YALNIZCA KILIÇ', PAL.dim); return; }
  if (arOn()) { showMsg(null, AR_NAMES[arMode()] + ' MODUNDA YETENEK YOK', PAL.dim); return; }
  const wm = aimPoint(me), ang = LOOK.yaw;
  const ag = AGENTS[me.agent];
  const avail = k === 'x' ? me.ult >= ag.x.pts : me.ch[k] > 0;
  if (!avail) { AU.play('empty'); showMsg(null, k === 'x' ? 'ULTİ HAZIR DEĞİL (' + me.ult + '/' + ag.x.pts + ')' : 'ŞARJ YOK — MAĞAZADAN AL', PAL.dim); return; }
  if (S.phase !== 'live' && S.phase !== 'planted') { AU.play('empty'); return; }
  if (G.mode === 'client') netSend(NET.conn, { t: 'act', a: 'abil', k, tx: r1(wm.x), ty: r1(wm.y), ang: r2(ang) });
  else { me.input = buildLocalInput(me); if (!useAbility(me, k, { x: wm.x, y: wm.y, ang })) AU.play('empty'); }
}
function doReload() { const me = S && S.pmap[G.myId]; if (!me) return; if (G.mode === 'client') netSend(NET.conn, { t: 'act', a: 'reload' }); else startReload(me); }
/* 1 → 2 → 3 (kılıç) döngüsü */
function nextSlot(me, dir) { const order = me.primary ? [1, 2, 3] : [2, 3]; const i = order.indexOf(me.slot); return order[(i + (dir || 1) + order.length) % order.length]; }
function doJump() { const me = S && S.pmap[G.myId]; if (!me || !me.alive) return; G.jc = ((G.jc || 0) + 1) | 0; }
function doRequest() { const me = S && S.pmap[G.myId]; if (!me || !me.alive) return; if (G.mode === 'client') netSend(NET.conn, { t: 'act', a: 'req' }); else requestBomb(me); }
function doSlot(s) { const me = S && S.pmap[G.myId]; if (!me) return; if (G.mode === 'client') netSend(NET.conn, { t: 'act', a: 'slot', s }); else switchSlot(me, s); }
function cycleSpec() {
  const me = S && S.pmap[G.myId]; if (!me || me.alive) return;
  const mates = specPool(me);
  if (!mates.length) return;
  const i = mates.findIndex(p => p.id === G.spec);
  G.spec = mates[(i + 1) % mates.length].id;
}
function onKeyDown(e) {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (e.code === 'Escape' && UI.caseOpen) { caseClose(); return; }
  if (e.code === 'Escape' && UI.admOpen) { admClose(); return; }
  if (e.code === 'Escape' && UI.frOpen) { frMenuToggle(false); return; }
  if (e.code === 'Escape' && UI.setOpen) { closeSettings(); return; }
  KEYS[e.code] = true;
  // tuşlar AYARLAR → TUŞ ATAMALARI'ndan değiştirilebilir (08e); ESC (menü) ve fare sabittir
  const K = a => kbIs(e, a);
  if (K('board')) { e.preventDefault(); UI.board = true; }
  // bas-konuş (lobide de çalışır)
  if (K('voice')) { if (!e.repeat) VC.keyDown(); return; }
  if (!G.running || !S) return;
  // kamera — birinci şahıs → arkadan → önden
  if (K('cam')) { e.preventDefault(); if (!e.repeat) camCycle(); return; }
  // emote menüsü · menü açıkken 1–6 emote seçer
  if (K('emote') && !UI.overlay && !e.repeat) { e.preventDefault(); toggleEmote(); return; }
  if (UI.emoteOpen && /^(Digit|Numpad)[1-6]$/.test(e.code)) { e.preventDefault(); doEmote(+e.code.slice(-1) - 1); return; }
  if (UI.emoteOpen && e.code === 'Escape') { toggleEmote(false); return; }
  // yazılı sohbet (varsayılan: nokta — Türkçe klavyede '.' tuşu)
  if (K('chat') && !UI.overlay) { e.preventDefault(); KEYS[e.code] = false; chatOpen(); return; }
  const act = kbAct(e);
  if (act || ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (CINE.on && !e.repeat && (K('jump') || e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter')) { cineStop(true); return; }
  if (!isLocked() && !UI.overlay && !G.freeMouse && !IS_TOUCH && kbLocks(e)) lockPointer(true);
  if (e.repeat) return;
  if (e.code === 'Escape') {
    if (UI.buyOpen) closeBuy();
    else if (UI.pauseOpen) { if (performance.now() - (G._escMenuT || 0) > 400) togglePause(false); }
    else { G._escMenuT = performance.now(); togglePause(true); }
    return;
  }
  if ((e.code === 'Enter' || e.code === 'NumpadEnter') && UI.pauseOpen) { quitToMenu(); return; }
  if (!act) return;
  const me = S.pmap[G.myId];
  if (frOn() && K('spawn')) { if (!UI.pauseOpen) frMenuToggle(); return; } // serbest mod: spawn menüsü (GMod gibi)
  switch (act) {
    case 'pause': if (UI.buyOpen) closeBuy(); togglePause(); break;
    case 'buy': if (!UI.pauseOpen) toggleBuy(); break;
    case 'q': case 'e': case 'x': if (!UI.overlay) castAbility(act); break;
    case 'reload': if (!UI.overlay) doReload(); break;
    case 'slot1': doSlot(1); break;
    case 'slot2': doSlot(2); break;
    case 'slot3': doSlot(3); break;
    case 'jump': if (me && me.alive) { if (!UI.overlay) doJump(); } else cycleSpec(); break;
    case 'req': if (!UI.overlay) doRequest(); break;
    case 'drop': if (!UI.overlay && me && me.hasBomb) { if (G.mode === 'client') netSend(NET.conn, { t: 'act', a: 'drop' }); else dropBomb(me); } break;
    case 'mute': AU.setEnabled(!AU.enabled); showMsg(null, AU.enabled ? 'SES AÇIK' : 'SES KAPALI'); break;
  }
}
function buildLocalInput(me) {
  const blocked = UI.overlay || CINE.on;
  let f = 0, r = 0;
  if (!blocked) {
    if (kbHeld('fwd') || kbArrow('ArrowUp')) f += 1; if (kbHeld('back') || kbArrow('ArrowDown')) f -= 1;
    if (kbHeld('right') || kbArrow('ArrowRight')) r += 1; if (kbHeld('left') || kbArrow('ArrowLeft')) r -= 1;
    f += -TOUCH.jy; r += TOUCH.jx;
  }
  const jm = Math.hypot(TOUCH.jx, TOUCH.jy);
  const a = LOOK.yaw, ca = Math.cos(a), sa = Math.sin(a);
  let mx = ca * f - sa * r, my = sa * f + ca * r;
  const l = Math.hypot(mx, my); if (l > 0.08) { mx /= l; my /= l; } else { mx = 0; my = 0; }
  const ap = aimPoint(me);
  return {
    mvx: mx, mvy: my, ang: a, pitch: LOOK.pitch, fire: (MOUSE.down || TOUCH.fire) && !blocked, fp: MOUSE.fp,
    alt: (MOUSE.right || TOUCH.alt) && !blocked, walk: !!(kbHeld('walk') || TOUCH.walk || (jm > 0.05 && jm < 0.5)),
    crouch: !!(kbHeld('crouch') || TOUCH.crouch),
    use: (kbHeld('use') || TOUCH.use) && !blocked, mx: ap.x, my: ap.y, jc: G.jc | 0
  };
}
/* ---------------- DOKUNMATİK KONTROLLER ---------------- */
function setupTouch() {
  const layer = $('touch'), joy = $('tjoy'), knob = $('tknob');
  const btnDown = (act, el) => {
    const me = S && S.pmap[G.myId];
    switch (act) {
      case 'fire': TOUCH.fire = true; MOUSE.fp = (MOUSE.fp + 1) | 0; if (me && !me.alive) cycleSpec(); break;
      case 'q': case 'e': case 'x': if (!UI.overlay) castAbility(act); break;
      case 'reload': doReload(); break;
      case 'swap': if (me) doSlot(nextSlot(me, 1)); break;
      case 'jump': doJump(); break;
      case 'req': doRequest(); break;
      case 'mic': VC.keyDown(); break;
      case 'chat': chatOpen(); break;
      case 'emote': toggleEmote(); break;
      case 'cam': camCycle(); break;
      case 'use': TOUCH.use = true; break;
      case 'scope': TOUCH.alt = !TOUCH.alt; el.classList.toggle('lit', TOUCH.alt); break;
      case 'walk': TOUCH.walk = !TOUCH.walk; el.classList.toggle('lit', TOUCH.walk); break;
      case 'crouch': TOUCH.crouch = !TOUCH.crouch; el.classList.toggle('lit', TOUCH.crouch); break;
      case 'buy': toggleBuy(); break;
      case 'board': UI.board = true; break;
      case 'drop': if (me && me.hasBomb) { if (G.mode === 'client') netSend(NET.conn, { t: 'act', a: 'drop' }); else dropBomb(me); } break;
      case 'pause': togglePause(true); break;
      case 'full': toggleFullscreen(); break;
    }
  };
  const btnUp = act => {
    if (act === 'fire') TOUCH.fire = false;
    else if (act === 'mic') VC.keyUp();
    else if (act === 'use') TOUCH.use = false;
    else if (act === 'board') UI.board = false;
  };
  layer.addEventListener('pointerdown', e => {
    e.preventDefault(); AU.resume();
    if (UI.tedit) { tlDown(e); try { layer.setPointerCapture(e.pointerId); } catch (x) { } return; } // dokunmatik düzen düzenleyicisi (08e)
    if (CINE.on) { cineStop(true); return; } // dokunma sinematiği atlar
    const el = e.target.closest('[data-act]');
    const P = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
    if (el) { P.role = 'btn'; P.act = el.dataset.act; P.el = el; el.classList.add('on'); btnDown(P.act, el); }
    else if (tlJoyZone(e.clientX)) { // joystick parmağın altında açılır (taraf ve boyut düzenden)
      P.role = 'joy';
      joy.classList.add('act'); joy.style.left = e.clientX + 'px'; joy.style.top = e.clientY + 'px';
      knob.style.transform = 'translate(0px,0px)';
    } else P.role = 'look';
    TOUCH.ptr[e.pointerId] = P;
    try { layer.setPointerCapture(e.pointerId); } catch (x) { }
  }, { passive: false });
  layer.addEventListener('pointermove', e => {
    if (UI.tedit) { e.preventDefault(); tlMove(e); return; }
    const P = TOUCH.ptr[e.pointerId]; if (!P) return;
    e.preventDefault();
    if (P.role === 'joy') {
      const js = tlJoyScale(), m = 55 * js;
      let dx = e.clientX - P.sx, dy = e.clientY - P.sy; const l = Math.hypot(dx, dy);
      if (l > m) { dx = dx / l * m; dy = dy / l * m; }
      TOUCH.jx = dx / m; TOUCH.jy = dy / m;
      knob.style.transform = 'translate(' + (dx / js) + 'px,' + (dy / js) + 'px)';
    } else if (P.role === 'look' || (P.role === 'btn' && P.act === 'fire')) {
      const me = S && S.pmap[G.myId], k = 0.0055 * SETTINGS.sens * (me && me.scoped ? 0.35 : 1);
      LOOK.yaw += (e.clientX - P.x) * k; LOOK.pitch = clamp(LOOK.pitch - (e.clientY - P.y) * k, -1.4, 1.4);
    }
    P.x = e.clientX; P.y = e.clientY;
  }, { passive: false });
  const end = e => {
    if (UI.tedit) { tlUp(e); return; }
    const P = TOUCH.ptr[e.pointerId]; if (!P) return;
    delete TOUCH.ptr[e.pointerId];
    if (P.role === 'joy') { TOUCH.jx = 0; TOUCH.jy = 0; joy.classList.remove('act'); tlJoyIdle(); knob.style.transform = 'translate(0px,0px)'; }
    else if (P.role === 'btn') { P.el.classList.remove('on'); btnUp(P.act); }
    else if (P.role === 'look' && Math.hypot(e.clientX - P.sx, e.clientY - P.sy) < 8 && performance.now() - P.t < 250) {
      const me = S && S.pmap[G.myId]; if (me && !me.alive) cycleSpec();
    }
  };
  layer.addEventListener('pointerup', end); layer.addEventListener('pointercancel', end);
}
function updateTouchButtons() {
  if (!IS_TOUCH || !S) return;
  tbApplyMode(); // yalnızca bu modda işe yarayan butonlar (08e)
  const me = S.pmap[G.myId]; if (!me) return;
  const ag = AGENTS[me.agent];
  for (const k of ['q', 'e', 'x']) {
    const el = $('tb' + k.toUpperCase());
    const ready = k === 'x' ? me.ult >= ag.x.pts : me.ch[k] > 0;
    el.classList.toggle('ready', ready);
    el.querySelector('small').textContent = k === 'x' ? me.ult + '/' + ag.x.pts : '×' + me.ch[k];
    el.querySelector('i').textContent = ag[k].name.split(' ')[0];
  }
  $('tbDrop').classList.toggle('hidden', !me.hasBomb);
  const car = S.bomb && S.bomb.state === 'carried' ? S.pmap[S.bomb.carrier] : null;
  $('tbReq').classList.toggle('hidden', !(me.alive && !me.hasBomb && car && car.team === me.team && (S.phase === 'live' || S.phase === 'buy')));
  $('tbBuy').classList.toggle('hidden', S.phase !== 'buy' && !frOn()); // serbest modda SPAWN menüsü her zaman
  $('tbBuy').textContent = frOn() ? 'SPAWN' : 'MAĞAZA';
  $('tbScope').classList.toggle('hidden', !WEAPONS[curW(me)].scope);
  const use = $('tbUse');
  const nearRb = (MAPDATA.reboot || []).some((r, i) => (S.cards || []).some(c => c.carrier === me.id) && dist(me.x, me.y, r.x, r.y) < REBOOT_R && !(S.rb[i] && S.rb[i].cd > 0));
  const canUse = me.alive && ((me.hasBomb && siteAt(me.x, me.y) && S.phase === 'live') || (S.phase === 'planted' && sideOf(me.team) === 'def' && dist(me.x, me.y, S.bomb.x, S.bomb.y) < 70) || nearRb);
  use.classList.toggle('ready', !!canUse);
}
function uiGameTick(dt) {
  G._tbT = (G._tbT || 0) - dt;
  if (G._tbT <= 0) { G._tbT = 0.2; updateTouchButtons(); }
  if (UI.buyOpen) {
    G._buyT = (G._buyT || 0) - dt;
    if (G._buyT <= 0) { G._buyT = 0.25; if (S.phase !== 'buy') closeBuy(); else uiRenderBuy(); }
  }
  if (S.phase === 'over' && !G.overShown) {
    G._overT = (G._overT || 0) + dt;
    if (G._overT > 2) { G._overT = 0; G.overShown = true; uiShowEnd(); }
  }
}
function modeOf(v) { return v === 'pk' || v === 'gg' || v === 'sn' || v === 'fr' ? v : 'bomb'; }
function uiShowEnd() {
  const me = S.pmap[G.myId], mt = me ? me.team : 0, win = S.matchWinner === mt;
  closeBuy();
  if (pkOn()) { // PARKUR: genel sıralama
    const r = pkShowEnd(me), g = SHOP.award(r.win ? 'win' : 'lose', 0);
    $('endGems').innerHTML = '+' + g + ' 💎 <span>GEMS KAZANDIN</span> · <span>Toplam</span> ' + SHOP.prof.gems;
    $('end').classList.remove('hidden'); unlockPointer(); syncCursor(); AU.play(r.win ? 'win' : 'lose');
    return;
  }
  const draw = S.matchWinner === -1;
  $('endScore').style.fontSize = '';
  $('endTitle').textContent = draw ? 'BERABERE' : win ? 'ZAFER' : 'BOZGUN';
  $('endTitle').className = draw ? '' : win ? 'win' : 'lose';
  $('endScore').textContent = S.score[mt] + ' — ' + S.score[1 - mt];
  const rows = S.players.slice().sort((a, b) => b.kills - a.kills || (b.dmg || 0) - (a.dmg || 0));
  const mvp = rows[0];
  $('endTable').innerHTML = '<tr><th>OYUNCU</th><th>AJAN</th><th>K</th><th>Ö</th><th>HASAR</th></tr>' + rows.map(p =>
    '<tr class="' + (p.team === mt ? 'al' : 'en') + '"><td>' + esc(p.name) + (p === mvp ? ' <b class="mvp">MVP</b>' : '') + (p.id === G.myId ? ' (sen)' : '') + '</td><td>' + AGENTS[p.agent].name + '</td><td>' + p.kills + '</td><td>' + p.deaths + '</td><td>' + Math.round(p.dmg || 0) + '</td></tr>').join('');
  // GEMS ödülü (maç başına bir kez)
  { const g = SHOP.award(draw ? 'draw' : win ? 'win' : 'lose', me ? me.kills : 0);
    $('endGems').innerHTML = '+' + g + ' 💎 <span>GEMS KAZANDIN</span> · <span>Toplam</span> ' + SHOP.prof.gems; }
  $('end').classList.remove('hidden');
  unlockPointer(); syncCursor();
  AU.play(win || draw ? 'win' : 'lose');
}

/* ---------------- ANA DÖNGÜ ---------------- */
let lastT = 0, simAcc = 0, simLast = 0;
/* Simülasyonu gerçek zamana göre ilerletir; hem rAF hem de arka plan zamanlayıcısı çağırabilir */
function simAdvance() {
  const now = performance.now();
  let dt = simLast ? (now - simLast) / 1000 : 0; simLast = now;
  if (dt > 0.25) dt = 0.25;
  if (dt <= 0 || !G.running || !S) return;
  if (G.mode === 'client') { clientUpdate(dt); return; }
  const me = S.pmap[G.myId];
  if (me && me.ctrl === 'local') me.input = buildLocalInput(me);
  if (!G.paused) {
    simAcc += dt; let n = 0;
    // yavaş cihazda "yetişmeye çalışırken daha da yavaşlama" döngüsüne girmemek için kare başına en fazla 8 adım
    while (simAcc >= SIM_DT && n < 8) { hostTick(SIM_DT); simAcc -= SIM_DT; n++; }
    if (n >= 8) simAcc = 0;
  }
  netHostUpdate(dt);
}
function frame(now) {
  requestAnimationFrame(frame);
  G._lastFrame = performance.now();
  try { MUS.update(); } catch (e) { console.error(e); }
  try { VC.update(); } catch (e) { console.error(e); }
  if (!lastT) lastT = now;
  let dt = (now - lastT) / 1000; lastT = now;
  try { dynRes(dt); } catch (e) { }
  if (dt > 0.1) dt = 0.1;
  if (dt <= 0) return;
  try {
    if (G.running && S) {
      simAdvance();
      if (S) { freeLookTick(dt); render(dt); uiGameTick(dt); }
      syncLockHint();
    } else if (!G.bye) renderMenuBg(dt);
  } catch (err) {
    console.error(err);
    if (!G._errShown) { G._errShown = true; uiToast('Hata: ' + (err && err.message ? err.message : err), true); }
  }
}
/* Sekme arka plandayken tarayıcı rAF'yi durdurur; host'un oyunu dondurmaması için Worker zamanlayıcısı */
function startBgTicker() {
  const onTick = () => {
    if (!G.running || !S) return;
    if (!document.hidden && performance.now() - G._lastFrame < 70) return;
    try { simAdvance(); } catch (e) { console.error(e); }
  };
  try {
    const src = 'setInterval(function(){postMessage(0)},16);';
    const wk = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    wk.onmessage = onTick;
  } catch (e) { setInterval(onTick, 16); }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.running && G.mode === 'sp' && !UI.pauseOpen) togglePause(true);
    if (!document.hidden) hostReconnect();
  });
}
window.addEventListener('DOMContentLoaded', () => splashStart(() => { uiInit(); startBgTicker(); })); // açılış ekranı (07f) çizildikten sonra yükle
