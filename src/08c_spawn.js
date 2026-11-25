/* =====================================================================
   08c · SERBEST MOD SPAWN MENÜSÜ ([Q] / [B] / dokunmatikte SPAWN)
        SİLAHLAR · NPC'LER · PİLLER · KENDİ NPC'N (resim yükle) · MODLAR (08d)
        Kendi NPC'lerin bu cihazda saklanır; odada kullanınca resim diğer
        oyunculara da gider.
   ===================================================================== */
const FRM = { open: false, tab: 'w', img: null };
function frSaved() { try { const a = JSON.parse(localStorage.getItem('spk_npcs') || '[]'); return Array.isArray(a) ? a.filter(c => c && c.img && c.n) : []; } catch (e) { return []; } }
function frSaveList(a) { try { localStorage.setItem('spk_npcs', JSON.stringify(a.slice(0, FR_MAXK))); } catch (e) { uiToast('Kaydedilemedi: tarayıcı depolaması dolu', true); } }
/* menüde görünen tüm NPC türleri: hazırlar + odadakiler (mod / oyuncu) + bu cihazda kayıtlı olanlar */
function frKinds() {
  const out = [], seen = {};
  for (const k in NPC_KINDS) { out.push({ k, K: NPC_KINDS[k] }); seen[k] = 1; }
  for (const k in (S && S.npcK) || {}) if (!seen[k]) { out.push({ k, K: S.npcK[k] }); seen[k] = 1; }
  for (const c of frSaved()) { const k = npcIdOf(c.img); if (!seen[k]) { out.push({ k, K: c, local: c }); seen[k] = 1; } }
  return out;
}
/* bu cihazdaki kendi NPC'n odada henüz yoksa önce host'a gönder */
function frEnsure(it) {
  if (it.local && !(S.npcK && S.npcK[it.k])) frRequest({ a: 'npck', n: it.local.n, img: it.local.img, spd: it.local.spd, hp: it.local.hp, dmg: it.local.dmg, sz: it.local.sz });
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
function frKindInfo(K) { return (K.hp ? 'can ' + K.hp : 'ölümsüz') + ' · hız ' + Math.round((K.spd || 300) / RUN * 100) + '%'; }
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
      '<div class="admrow"><label class="filebtn">RESİM SEÇ<input id="frcFile" type="file" accept="image/*"></label><button id="frcSave" class="primary">KAYDET</button></div></div></div>' +
      '<div id="frcMsg" class="note"></div>';
    h += '<h4 class="frh">KAYITLI NPC\'LERİN (' + saved.length + '/' + FR_MAXK + ')</h4>' + (saved.length ? '<div class="frgrid">' + saved.map((c, i) => '<div class="frc"><img alt="" src="' + esc(c.img) + '"><b>' + esc(c.n) + '</b><small>' + esc(frKindInfo(c)) + '</small><button class="ghost frdel" data-d="' + i + '">SİL</button></div>').join('') + '</div>' : '<div class="note">Henüz yok. Bir resim seçip kaydet; NPC\'LER ve PİLLER sekmesinde çıkar.</div>');
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
function frSaveCustom() {
  const n = ($('frcName').value || '').trim().slice(0, 16), m = $('frcMsg');
  if (!FRM.img) { m.textContent = 'Önce RESİM SEÇ ile bir resim seç'; return; }
  if (!n) { m.textContent = 'NPC\'ye bir ad ver'; return; }
  const a = frSaved();
  if (a.length >= FR_MAXK) { m.textContent = 'En fazla ' + FR_MAXK + ' kayıtlı NPC olabilir — birini sil'; return; }
  a.push({ n, img: FRM.img, spd: +$('frcSpd').value, hp: +$('frcHp').value, dmg: 999, sz: 1.15 });
  frSaveList(a); FRM.img = null; FRM.tab = 'n'; frMenuRender(); uiToast(n + ' kaydedildi');
}
function frMenuInit() {
  for (const b of $('frTabs').querySelectorAll('button')) b.onclick = () => { FRM.tab = b.dataset.tab; frMenuRender(); };
  $('frX').onclick = () => frMenuToggle(false);
  $('frOv').addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); frMenuToggle(false); } });
}
