/* =====================================================================
   08c · SERBEST MOD SPAWN MENÜSÜ ([Q] / [B] / dokunmatikte SPAWN)
        SİLAHLAR · NPC'LER · PİLLER · KENDİ NPC'N (resim yükle) · MODLAR (08d)
        Kendi NPC'lerin bu cihazda saklanır; odada kullanınca resim diğer
        oyunculara da gider.
   ===================================================================== */
const FRM = { open: false, tab: 'w', img: null, audio: null, sndName: '', sndStart: 0, prev: null };
function frSaved() { try { const a = JSON.parse(localStorage.getItem('spk_npcs') || '[]'); return Array.isArray(a) ? a.filter(c => c && c.img && c.n) : []; } catch (e) { return []; } }
function frSaveList(a) { try { localStorage.setItem('spk_npcs', JSON.stringify(a.slice(0, FR_MAXK))); } catch (e) { uiToast('Kaydedilemedi: tarayıcı depolaması dolu', true); } }
/* menüde görünen tüm NPC türleri: hazırlar + odadakiler (mod / oyuncu) + bu cihazda kayıtlı olanlar */
function frKinds() {
  const out = [], seen = {};
  for (const k in NPC_KINDS) { out.push({ k, K: NPC_KINDS[k] }); seen[k] = 1; }
  for (const k in (S && S.npcK) || {}) if (!seen[k]) { out.push({ k, K: S.npcK[k] }); seen[k] = 1; }
  for (const c of frSaved()) { const k = kindIdOf(c); if (!seen[k]) { out.push({ k, K: c, local: c }); seen[k] = 1; } }
  return out;
}
/* bu cihazdaki kendi NPC'n odada henüz yoksa önce host'a gönder */
function frEnsure(it) {
  if (!it.local || (S.npcK && S.npcK[it.k])) return;
  if (G.mode === 'client') { const v = pakValid(it.local); if (v) { PAK.k[it.k] = PAK.k[it.k] || v; pakSend(NET.conn, it.k); } } // resim + ses parça parça host'a (06b)
  else frRequest({ a: 'npck', n: it.local.n, img: it.local.img, snd: it.local.snd, spd: it.local.spd, hp: it.local.hp, dmg: it.local.dmg, sz: it.local.sz });
}
function frMenuToggle(force) {
  const open = force === undefined ? !FRM.open : !!force;
  if (open && !(frOn() && G.running)) return;
  FRM.open = open; UI.frOpen = open;
  $('frOv').classList.toggle('hidden', !open);
  UI.overlay = open || UI.pauseOpen || UI.buyOpen || !!UI.setOpen || !!UI.admOpen; MOUSE.down = false;
  if (open) { try { unlockPointer(); } catch (e) { } frMenuRender(); }
  else if (G.running && !UI.pauseOpen && !UI.admOpen) { try { lockPointer(); } catch (e) { } }
  try { syncCursor(); } catch (e) { }
}
function frKindInfo(K) { return (K.snd || Object.values(NPC_KINDS).includes(K) ? '🔊 ' : '') + (K.hp ? 'can ' + K.hp : 'ölümsüz') + ' · hız ' + Math.round((K.spd || 300) / RUN * 100) + '%'; }
function frMenuRender() {
  for (const b of $('frTabs').querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === FRM.tab);
  const me = S && S.pmap[G.myId], body = $('frBody'), T = FRM.tab;
  let h = '';
  if (T === 'w') {
    h += '<div class="frgrid">' + WEAPON_ORDER.concat(['sword']).map(id => { const w = WEAPONS[id]; return '<button class="frc" data-w="' + id + '"><b>' + esc(w.name) + '</b><small>' + esc(w.type) + '</small></button>'; }).join('') + '</div>';
    h += '<div class="note">Bütün silahlar bedava. Seçtiğin silah ölünce de elinde kalır.</div>';
  } else if (T === 'n' || T === 'p') {
    const L = frKinds();
    h += '<div class="frgrid">' + L.map((it, i) => '<button class="frc" data-i="' + i + '"><img alt="" src="' + esc(it.local ? it.local.img : npcPreview(it.k)) + '"><b>' + esc(it.K.n) + '</b><small>' + esc(frKindInfo(it.K)) + '</small></button>').join('') + '</div>';
    if (T === 'n') h += '<div class="row-btn"><button id="frClr" class="ghost">TÜM NPC\'LERİ SİL (' + ((S.npcs || []).length) + ')</button></div><div class="note">NPC önünde çıkar ve en yakın oyuncuyu kovalar. Ölümsüz olanları yalnızca SİL ile kaldırabilirsin.</div>';
    else h += '<div class="row-btn"><button id="frHuman" class="primary"' + (me && me.pill ? '' : ' disabled') + '>İNSANA DÖN</button></div><div class="note">Pill ile o NPC\'ye dönüşürsün: onun hızıyla koşar, dokunduğun rakibi vurursun ama silah kullanamazsın.</div>';
    FRM.list = L;
  } else if (T === 'c') {
    const saved = frSaved();
    h += '<div class="frform"><div class="fprev">' + (FRM.img ? '<img alt="" src="' + FRM.img + '">' : '<span>RESİM</span>') + '</div><div class="ffields">' +
      '<input id="frcName" maxlength="16" placeholder="NPC adı" autocomplete="off">' +
      '<div class="admrow"><select id="frcSpd"><option value="220">Yavaş</option><option value="330" selected>Normal</option><option value="450">Hızlı</option></select><select id="frcHp"><option value="0">Ölümsüz</option><option value="300">Can 300</option><option value="800">Can 800</option></select></div>' +
      '<div class="admrow"><label class="filebtn">RESİM SEÇ<input id="frcFile" type="file" accept="image/*"></label><label class="filebtn">🔊 SES SEÇ<input id="frcSnd" type="file" accept="audio/*"></label><button id="frcSave" class="primary">KAYDET</button></div></div></div>' +
      '<div id="frcSndBox"></div><div id="frcMsg" class="note"></div>';
    h += '<h4 class="frh">KAYITLI NPC\'LERİN (' + saved.length + '/8)</h4>' + (saved.length ? '<div class="frgrid">' + saved.map((c, i) => '<div class="frc"><img alt="" src="' + esc(c.img) + '"><b>' + esc(c.n) + '</b><small>' + esc(frKindInfo(c)) + '</small><button class="ghost frdel" data-d="' + i + '">SİL</button></div>').join('') + '</div>' : '<div class="note">Henüz yok. Bir resim seçip kaydet; NPC\'LER ve PİLLER sekmesinde çıkar.</div>');
    h += '<div class="note" style="color:var(--dim)">Resim bu cihazda saklanır. Odada kullanırsan odadaki herkes görür.</div>';
  } else if (T === 'm') {
    h += typeof modMenuHtml === 'function' ? modMenuHtml() : '<div class="note">Mod sistemi yakında.</div>';
  }
  body.innerHTML = h;
  // olaylar
  for (const b of body.querySelectorAll('[data-w]')) b.onclick = () => { frRequest({ a: 'frw', w: b.dataset.w }); frMenuToggle(false); };
  for (const b of body.querySelectorAll('[data-i]')) b.onclick = () => {
    const it = FRM.list[+b.dataset.i]; if (!it) return;
    frEnsure(it);
    if (T === 'n') { frRequest({ a: 'npc', k: it.k }); uiToast(it.K.n + ' çıkarıldı'); setTimeout(() => FRM.open && FRM.tab === 'n' && frMenuRender(), 150); }
    else { frRequest({ a: 'pill', k: it.k }); frMenuToggle(false); }
  };
  if ($('frClr')) $('frClr').onclick = () => { frRequest({ a: 'npcclr' }); setTimeout(() => FRM.open && frMenuRender(), 150); };
  if ($('frHuman')) $('frHuman').onclick = () => { frRequest({ a: 'pill', k: '' }); frMenuToggle(false); };
  if ($('frcFile')) $('frcFile').onchange = e => frPickImage(e.target.files && e.target.files[0]);
  if ($('frcSnd')) { $('frcSnd').onchange = e => frPickSound(e.target.files && e.target.files[0]); frSndBox(); }
  if ($('frcSave')) $('frcSave').onclick = frSaveCustom;
  for (const b of body.querySelectorAll('[data-d]')) b.onclick = () => { const a = frSaved(); a.splice(+b.dataset.d, 1); frSaveList(a); frMenuRender(); };
  if (T === 'm' && typeof modMenuBind === 'function') modMenuBind(body);
}
/* seçilen resmi 96x96 kareye kırp, küçük data: adresine çevir */
function frPickImage(f) {
  if (!f) return;
  const msg = t => { const m = $('frcMsg'); if (m) m.textContent = t; };
  if (!/^image\//.test(f.type)) { msg('Bu bir resim dosyası değil'); return; }
  const rd = new FileReader();
  rd.onload = () => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 96;
      const g = c.getContext('2d'), s = Math.min(im.width, im.height);
      g.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 96, 96);
      let d = c.toDataURL('image/png'); if (d.length > 50000) d = c.toDataURL('image/jpeg', 0.82);
      FRM.img = d; const nm = $('frcName') ? $('frcName').value : '';
      frMenuRender(); if ($('frcName')) $('frcName').value = nm || f.name.replace(/\.[^.]+$/, '').slice(0, 16);
    };
    im.onerror = () => msg('Resim açılamadı');
    im.src = rd.result;
  };
  rd.readAsDataURL(f);
}
async function frSaveCustom() {
  const n = ($('frcName').value || '').trim().slice(0, 16), m = $('frcMsg');
  if (!FRM.img) { m.textContent = 'Önce RESİM SEÇ ile bir resim seç'; return; }
  if (!n) { m.textContent = 'NPC\'ye bir ad ver'; return; }
  const a = frSaved();
  if (a.length >= 8) { m.textContent = 'En fazla 8 kayıtlı NPC olabilir — birini sil'; return; }
  let snd;
  if (FRM.audio) { m.textContent = 'Ses kesiliyor…'; try { snd = await frSndCut(); } catch (e) { m.textContent = 'Ses kesilemedi: ' + e.message; return; } }
  a.push({ n, img: FRM.img, snd, spd: +$('frcSpd').value, hp: +$('frcHp').value, dmg: 999, sz: 1.15 });
  frSaveList(a); frSndStop(); FRM.img = null; FRM.audio = null; FRM.tab = 'n'; frMenuRender(); uiToast(n + ' kaydedildi');
  if (NET.mode === 'host') pakAddSaved(); else if (NET.mode === 'client') pakUploadSaved(); // odadakiler de görsün (06b)
}
/* ---- ses: dosya seç → 15 sn'lik parçayı seç → dinle → kaydederken kes ---- */
const fmtSec = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
async function frPickSound(f) {
  const msg = t => { const el = $('frcMsg'); if (el) el.textContent = t; };
  if (!f) return;
  AU.init(); AU.resume();
  if (!AU.ctx) { msg('Bu tarayıcı sesi desteklemiyor'); return; }
  if (f.size > 30e6) { msg('Ses dosyası çok büyük (en fazla 30 MB)'); return; }
  msg('Ses açılıyor…');
  try {
    const ab = await f.arrayBuffer();
    const buf = await new Promise((res, rej) => { const p = AU.ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
    frSndStop(); FRM.audio = buf; FRM.sndName = f.name; FRM.sndStart = 0; frSndBox(); msg('');
  } catch (e) { msg('Bu ses dosyası açılamadı (mp3, m4a, wav, ogg dene)'); }
}
function frSndBox() {
  const b = $('frcSndBox'); if (!b) return;
  const a = FRM.audio; if (!a) { b.innerHTML = ''; return; }
  const mx = Math.max(0, a.duration - 15), st = Math.min(FRM.sndStart, mx), en = Math.min(a.duration, st + 15);
  b.innerHTML = '<div class="sndbox"><div class="sndt"><b>🔊 ' + esc(FRM.sndName).slice(0, 40) + '</b><span>' + fmtSec(a.duration) + '</span></div>' +
    '<input type="range" id="frcSndPos" min="0" max="' + mx.toFixed(1) + '" step="0.5" value="' + st.toFixed(1) + '"' + (mx ? '' : ' disabled') + '>' +
    '<div class="admrow"><span id="frcSndT" class="sndsel">' + fmtSec(st) + ' – ' + fmtSec(en) + ' (15 sn)</span><button id="frcSndPlay" class="ghost">' + (FRM.prev ? '■ DUR' : '▶ DİNLE') + '</button><button id="frcSndDel" class="ghost">✕ SESİ KALDIR</button></div></div>';
  $('frcSndPos').oninput = e => { FRM.sndStart = +e.target.value; const s = FRM.sndStart; $('frcSndT').textContent = fmtSec(s) + ' – ' + fmtSec(Math.min(a.duration, s + 15)) + ' (15 sn)'; if (FRM.prev) frSndPlay(); };
  $('frcSndPlay').onclick = () => { if (FRM.prev) frSndStop(); else frSndPlay(); frSndBox(); };
  $('frcSndDel').onclick = () => { frSndStop(); FRM.audio = null; frSndBox(); };
}
function frSndStop() { if (FRM.prev) { try { FRM.prev.stop(); } catch (e) { } FRM.prev = null; } }
function frSndPlay() {
  frSndStop(); if (!FRM.audio || !AU.ctx) return;
  AU.resume();
  const s = AU.ctx.createBufferSource(); s.buffer = FRM.audio; s.connect(AU.master);
  s.start(0, FRM.sndStart, Math.min(15, FRM.audio.duration - FRM.sndStart));
  s.onended = () => { if (FRM.prev === s) { FRM.prev = null; frSndBox(); } };
  FRM.prev = s;
}
/* seçilen 15 sn'yi tek kanala indir, 12 kHz'e düşür, sesi dengele, uçlarını yumuşat, ADPCM ile sıkıştır */
async function frSndCut() {
  const a = FRM.audio, st = FRM.sndStart, dur = Math.min(15, a.duration - st), sr = a.sampleRate, n = Math.max(1, Math.floor(dur * sr));
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const oc = new OAC(1, n, sr), src = oc.createBufferSource(); src.buffer = a; src.connect(oc.destination); src.start(0, st, dur);
  const r = await new Promise((res, rej) => { oc.oncomplete = e => res(e.renderedBuffer); const p = oc.startRendering(); if (p && p.then) p.then(res, rej); });
  const x = r.getChannelData(0), ratio = sr / 12000, m = Math.floor(x.length / ratio), y = new Float32Array(m), half = Math.max(1, Math.floor(ratio / 2));
  let peak = 1e-4;
  for (let j = 0; j < m; j++) { const c = Math.floor(j * ratio); let s = 0, k = 0; for (let i = Math.max(0, c - half); i <= Math.min(x.length - 1, c + half); i++) { s += x[i]; k++; } y[j] = s / k; peak = Math.max(peak, Math.abs(y[j])); }
  const g = Math.min(4, 0.85 / peak), fade = Math.floor(12000 * 0.15), pcm = new Int16Array(m);
  for (let j = 0; j < m; j++) { const f = Math.min(1, j / fade, (m - 1 - j) / fade); pcm[j] = clamp(Math.round(y[j] * g * f * 32767), -32768, 32767); }
  return 'ima12k:' + bytesB64(adpcmEnc(pcm));
}
function frMenuInit() {
  for (const b of $('frTabs').querySelectorAll('button')) b.onclick = () => { FRM.tab = b.dataset.tab; frMenuRender(); };
  $('frX').onclick = () => frMenuToggle(false);
  $('frOv').addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); frMenuToggle(false); } });
}
