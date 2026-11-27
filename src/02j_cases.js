/* =====================================================================
   02j · KASALAR (CS gibi)
   Mağazadaki KASALAR sekmesinden gems ile alınır ve hemen açılır.
   · Eşya önce nadirliğe göre (Askerî → Kısıtlı → Gizli → Örtülü → ★ Nadir Özel),
     sonra o nadirlikteki eşyalar arasından rastgele seçilir; olasılıklar kasada yazar.
   · ★ Nadir Özel eşyalar yalnızca kasadan çıkar, mağazada satılmaz.
   · Sahip olunan eşya yeniden çıkarsa değerinin %35'i gems olarak geri verilir.
   · Sonuç gems düşülürken profile yazılır; dönen şerit yalnızca gösteridir.
   ===================================================================== */
const CASES = [
  { id: 'cs1', n: 'Başlangıç Kasası', price: 400, c: ['#3ec1ff', '#123047'],
    items: ['ws:w01-w24', 'cs:c01-c22', 'kf:k01-k02', 'ws:w32', 'cs:c28', 'kf:k05', 'ws:w41', 'cs:c43'] },
  { id: 'cs2', n: 'Efsane Kasası', price: 2000, c: ['#ff4655', '#3a0a12'],
    items: ['ws:w21-w44', 'cs:c21-c44'] },
  { id: 'cs3', n: 'Öldürme Kasası', price: 1800, c: ['#ffd23a', '#3a2a06'],
    items: ['kf:k01-k14'] },
  // grup sohbetindeki isimlerle 20 karakter skini (02h, c45–c64); en çok geçen 4 isim yalnızca buradan çıkar
  { id: 'cs4', n: 'Yeniden Başlıyoruz', price: 500, c: ['#3ee08a', '#0e3a26'],
    items: ['cs:c45-c65'] }
];
const CASEM = {};
/* 'ws:w01-w24' → [['ws','w01'], …] */
function _caseExpand(spec) {
  const out = [];
  for (const s of spec) {
    const [kind, r] = s.split(':'), [a, b] = r.split('-'), pre = a[0], n0 = +a.slice(1), n1 = b ? +b.slice(1) : n0;
    for (let n = n0; n <= n1; n++) { const id = pre + String(n).padStart(2, '0'); if (SHOP_KIND[kind] && SHOP_KIND[kind].map[id]) out.push([kind, id]); }
  }
  return out;
}
for (const c of CASES) { c.all = _caseExpand(c.items); CASEM[c.id] = c; }
/* kasadaki nadirlik basamakları: [{k, w, items}] (yalnızca kasada bulunanlar) */
function caseTiers(c) {
  if (c._t) return c._t;
  const by = {};
  for (const [kind, id] of c.all) { const r = itemRar(SHOP_KIND[kind].map[id]); (by[r.k] = by[r.k] || []).push([kind, id]); }
  return (c._t = RARITY.filter(r => by[r.k]).map(r => ({ k: r.k, w: r.w, items: by[r.k] })));
}
function caseOdds(c) { const T = caseTiers(c), tot = T.reduce((a, t) => a + t.w, 0); return T.map(t => ({ r: RARM[t.k], p: t.w / tot * 100, n: t.items.length })); }
const _pct = v => { const n = String(+v.toFixed(v >= 10 ? 0 : v >= 1 ? 1 : 2)); return LANG === 'en' ? n + '%' : '%' + n.replace('.', ','); };

/* 2B kasa çizimi (mağaza kartı) */
function drawCaseArt(cv, c, t) {
  const g = cv.getContext('2d'), W2 = cv.width, H2 = cv.height; g.clearRect(0, 0, W2, H2);
  const w = W2 * 0.56, h = H2 * 0.62, x = (W2 - w) / 2, y = H2 * 0.2 + Math.sin((t || 0) * 2) * 1.5;
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, c.c[0]); gr.addColorStop(1, c.c[1]);
  g.save(); g.shadowColor = c.c[0]; g.shadowBlur = 16; g.fillStyle = gr; g.fillRect(x, y, w, h); g.restore();
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y + h * 0.34, w, h * 0.1); // kapak çizgisi
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y, w, h * 0.08);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  for (const sx of [x + 6, x + w - 12]) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(sx, y + 4, 6, h - 8); }
  g.fillStyle = '#d9dde2'; g.fillRect(W2 / 2 - 7, y + h * 0.3, 14, h * 0.2); g.fillStyle = '#20242a'; g.fillRect(W2 / 2 - 2, y + h * 0.36, 4, h * 0.08); // kilit
  g.fillStyle = '#fff'; g.font = 'bold ' + Math.round(h * 0.34) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.shadowColor = '#fff'; g.shadowBlur = 8; g.fillText('?', W2 / 2, y + h * 0.72); g.restore();
}
/* KASALAR sekmesi: kasa kartları + seçili kasanın olasılıkları ve içeriği */
function uiCaseRender() {
  const grid = document.getElementById('stGrid'), det = document.getElementById('stCase'); if (!grid || !SHOP.prof) return;
  const p = SHOP.prof; if (!CASEM[STORE.cs]) STORE.cs = CASES[0].id;
  grid.innerHTML = CASES.map(c => '<div class="sc case' + (c.id === STORE.cs ? ' eq' : '') + '" data-c="' + c.id + '" style="--rc:' + c.c[0] + '"><canvas width="180" height="96"></canvas>' +
    '<div class="nm">' + esc(c.n) + '</div><div class="ds">' + c.all.length + ' eşya · ' + caseTiers(c).length + ' nadirlik</div>' +
    '<button class="' + (p.gems >= c.price ? 'primary' : '') + '"' + (p.gems < c.price ? ' disabled' : '') + '>🎁 AÇ 💎 ' + c.price + '</button></div>').join('');
  for (const el of grid.querySelectorAll('.sc.case')) {
    const c = CASEM[el.dataset.c]; drawCaseArt(el.querySelector('canvas'), c, 0);
    el.onclick = e => { if (e.target.tagName === 'BUTTON') return; STORE.cs = c.id; uiCaseRender(); };
    el.querySelector('button').onclick = () => { STORE.cs = c.id; caseOpen(c.id); };
  }
  if (!det) return;
  const c = CASEM[STORE.cs];
  det.innerHTML = '<div class="cdh"><b>' + esc(c.n) + '</b> · İÇİNDEKİLER</div>' +
    '<div class="codds">' + caseOdds(c).map(o => '<span style="--rc:' + o.r.c + '"><i></i>' + esc(o.r.n) + ' ' + _pct(o.p) + '</span>').join('') + '</div>' +
    '<div class="note">Kopya çıkarsa eşyanın değerinin %35\'i gems olarak geri verilir · ★ Nadir Özel eşyalar yalnızca kasalardan çıkar</div>' +
    '<div class="citems">' + c.all.slice().sort((a, b) => itemRar(SHOP_KIND[b[0]].map[b[1]]).i - itemRar(SHOP_KIND[a[0]].map[a[1]]).i).map(([kind, id]) => {
      const it = SHOP_KIND[kind].map[id], R = itemRar(it), own = SHOP.owns(kind, id);
      return '<div class="ci' + (own ? ' own' : '') + '" data-k="' + kind + '" data-id="' + id + '" style="--rc:' + R.c + '"><canvas width="120" height="64"></canvas><span>' + esc(it.n) + '</span><small>' + (own ? '✓ ' : '') + esc(KIND_NAME[kind]) + '</small></div>';
    }).join('') + '</div>';
  for (const el of det.querySelectorAll('.ci')) previewItem(el.querySelector('canvas'), el.dataset.k, el.dataset.id, el.dataset.k === 'kf' ? -1 : 0);
}
const KIND_NAME = { ws: 'Silah skini', cs: 'Karakter skini', kf: 'Öldürme efekti' };

/* ---------- açılış ekranı: dönen şerit ---------- */
const CASEUI = { spin: false, res: null, raf: 0 };
function _caseTile(kind, id) {
  const it = SHOP_KIND[kind].map[id], R = itemRar(it);
  return '<div class="rt" style="--rc:' + R.c + '"><canvas width="120" height="64"></canvas><span>' + esc(it.n) + '</span></div>';
}
function caseOpen(cid) {
  const c = CASEM[cid]; if (!c || CASEUI.spin) return;
  if (SHOP.prof.gems < c.price) { uiToast('Yeterli gems yok', true); return; }
  const res = SHOP.openCase(cid);
  if (res.r !== 'ok') { if (res.r === 'gems') uiToast('Yeterli gems yok', true); return; }
  CASEUI.res = res; CASEUI.c = c; UI.caseOpen = true;
  try { AU.init(); AU.resume(); } catch (e) { }
  AU.play('copen');
  // şerit: rastgele dolgu eşyalar (kasanın olasılıklarıyla) + kazanılan eşya WIN sırasında
  const T = caseTiers(c), tot = T.reduce((a, t) => a + t.w, 0), N = 48, WIN = 41, tiles = [];
  for (let i = 0; i < N; i++) {
    if (i === WIN) { tiles.push([res.kind, res.id]); continue; }
    let x = Math.random() * tot, tr = T[0]; for (const t of T) { if (x < t.w) { tr = t; break; } x -= t.w; }
    tiles.push(pick(tr.items));
  }
  $('caseTitle').textContent = c.n;
  const reel = $('caseReel');
  reel.innerHTML = tiles.map(([k, id]) => _caseTile(k, id)).join('');
  reel.querySelectorAll('.rt').forEach((el, i) => previewItem(el.querySelector('canvas'), tiles[i][0], tiles[i][1], tiles[i][0] === 'kf' ? -1 : 0));
  reel.style.transform = 'translateX(0px)';
  $('caseRes').classList.add('hidden'); $('caseRes').innerHTML = '';
  $('caseSkip').classList.remove('hidden'); for (const id of ['caseEquip', 'caseAgain', 'caseClose']) $(id).classList.add('hidden');
  $('caseOv').classList.remove('hidden'); $('caseOv').classList.remove('done');
  // durma noktası: kazanılan karonun içinde rastgele bir yer (CS gibi bazen kenara yakın)
  requestAnimationFrame(() => {
    const wrap = $('caseReel').parentElement, first = reel.querySelector('.rt');
    const TW = first ? first.getBoundingClientRect().width + 8 : 128, ww = wrap.getBoundingClientRect().width || 600;
    const end = WIN * TW + TW / 2 - ww / 2 + (Math.random() - 0.5) * TW * 0.7;
    CASEUI.spin = true; CASEUI.t0 = performance.now(); CASEUI.dur = 5600; CASEUI.end = end; CASEUI.TW = TW; CASEUI.ww = ww; CASEUI.lastTile = -1;
    cancelAnimationFrame(CASEUI.raf); CASEUI.raf = requestAnimationFrame(caseTick);
  });
}
function caseTick() {
  if (!CASEUI.spin) return;
  const u = clamp((performance.now() - CASEUI.t0) / CASEUI.dur, 0, 1), e = 1 - Math.pow(1 - u, 4.2), x = CASEUI.end * e;
  $('caseReel').style.transform = 'translateX(' + (-x).toFixed(1) + 'px)';
  const tile = Math.floor((x + CASEUI.ww / 2) / CASEUI.TW);
  if (tile !== CASEUI.lastTile) { CASEUI.lastTile = tile; AU.play('ctick'); }
  if (u >= 1) { caseReveal(); return; }
  CASEUI.raf = requestAnimationFrame(caseTick);
}
function caseSkip() {
  if (!CASEUI.spin) return;
  $('caseReel').style.transform = 'translateX(' + (-CASEUI.end).toFixed(1) + 'px)';
  caseReveal();
}
function caseReveal() {
  CASEUI.spin = false; cancelAnimationFrame(CASEUI.raf);
  const r = CASEUI.res, R = RARM[r.rar], c = CASEUI.c;
  const top = r.rar === 'gold' || r.rar === 'ultra'; // en üst iki nadirlik: altın açılış sesi + parıltı
  AU.play(top ? 'cgold' : r.rar === 'cov' || r.rar === 'cla' ? 'crare' : 'creveal');
  const el = $('caseRes'); $('caseOv').classList.add('done');
  el.style.setProperty('--rc', R.c);
  el.innerHTML = '<canvas width="300" height="160"></canvas><div class="crr">' + esc(R.n) + ' · ' + esc(KIND_NAME[r.kind]) + '</div><div class="crn">' + esc(r.it.n) + '</div>' +
    '<div class="crs">' + (r.dup ? 'Zaten sahipsin · kopya iadesi +' + r.refund + ' 💎' : 'YENİ! Envanterine eklendi') + '</div>';
  el.classList.remove('hidden');
  el.classList.toggle('gold', top);
  previewItem(el.querySelector('canvas'), r.kind, r.id, r.kind === 'kf' ? -1 : 0);
  $('caseSkip').classList.add('hidden');
  const eqd = SHOP.prof[SHOP_KIND[r.kind].eq] === r.id;
  $('caseEquip').textContent = eqd ? 'KUŞANILDI' : 'KUŞAN'; $('caseEquip').disabled = eqd; $('caseEquip').classList.remove('hidden');
  $('caseAgain').innerHTML = 'TEKRAR AÇ 💎 ' + c.price; $('caseAgain').disabled = SHOP.prof.gems < c.price; $('caseAgain').classList.remove('hidden');
  $('caseClose').classList.remove('hidden');
  uiGemsChanged();
  // sonuç önizlemesi canlı oynasın (öldürme efekti / nabızlı skin)
  const cv = el.querySelector('canvas');
  const anim = () => { if (!UI.caseOpen || CASEUI.spin || !cv.isConnected) return; previewItem(cv, r.kind, r.id, performance.now() / 1000); CASEUI.raf = requestAnimationFrame(anim); };
  if (r.kind === 'kf' || (r.kind === 'ws' && skAnim(r.it))) CASEUI.raf = requestAnimationFrame(anim);
}
function caseClose() {
  if (CASEUI.spin) { caseSkip(); return; }
  cancelAnimationFrame(CASEUI.raf);
  $('caseOv').classList.add('hidden'); UI.caseOpen = false;
  uiStoreRender();
}
function uiCaseInit() {
  if (!$('caseOv')) return;
  $('caseSkip').onclick = caseSkip;
  $('caseClose').onclick = caseClose;
  $('caseEquip').onclick = () => { const r = CASEUI.res; if (r && SHOP.equip(r.kind, r.id) === 'ok') { AU.play('buy'); $('caseEquip').textContent = 'KUŞANILDI'; $('caseEquip').disabled = true; } };
  $('caseAgain').onclick = () => { const c = CASEUI.c; if (c) caseOpen(c.id); };
  $('caseOv').addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); caseClose(); } });
}
Object.assign(SFX, {
  ctick(o, t) { AU.tone(o, t, 0.025, 'square', 1900, 1500, 0.07); },
  copen(o, t) { AU.noise(o, t, 0.12, 'bandpass', 1800, 600, 0.6, 2); AU.tone(o, t + 0.08, 0.1, 'square', 300, 200, 0.18); AU.tone(o, t + 0.16, 0.12, 'triangle', 900, 1400, 0.15); },
  creveal(o, t) { [660, 880].forEach((f, i) => AU.tone(o, t + i * 0.08, 0.35, 'triangle', f, f, 0.25)); },
  crare(o, t) { [523, 784, 1046, 1318].forEach((f, i) => AU.tone(o, t + i * 0.07, 0.5, 'triangle', f, f * 1.01, 0.25)); AU.noise(o, t, 0.5, 'highpass', 4000, 0, 0.2, 1); },
  cgold(o, t) { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => AU.tone(o, t + i * 0.09, 0.9, 'triangle', f, f, 0.26)); [1046, 1318, 1568].forEach(f => AU.tone(o, t + 0.6, 1.2, 'sine', f, f, 0.14, 0.05)); AU.noise(o, t + 0.55, 1.2, 'highpass', 5000, 0, 0.25, 1); }
});
/* İngilizce: yeni eşyalar, kasalar, öldürme efektleri */
Object.assign(EN_EXACT, {
  'Karbon Fiber': 'Carbon Fiber', 'Bakır Pas': 'Copper Rust', 'Kum Fırtınası': 'Sandstorm', 'Mercan Resifi': 'Coral Reef', 'Zümrüt': 'Emerald', 'Yakut': 'Ruby', 'Safir': 'Sapphire',
  'Ametist': 'Amethyst', 'Kutup Işığı': 'Aurora', 'Volkanik': 'Volcanic', 'Ruhani': 'Spectral', 'Hayalet': 'Ghost', 'Plazma': 'Plasma', 'Fosfor': 'Phosphor', 'Kan Ayı': 'Blood Moon', 'Siber Kafes': 'Cyber Grid',
  'Ejder Pulu': 'Dragon Scale', 'Güneş Patlaması': 'Solar Flare', 'Gece Yarısı Altını': 'Midnight Gold', 'Prizma': 'Prism', 'Sonsuzluk': 'Infinity', 'Ejder Nefesi': 'Dragon Breath',
  'Galaksi': 'Galaxy', 'Buz Kristali': 'Ice Crystal', 'Neon Rüya': 'Neon Dream',
  'Cadı Kabağı': 'Witch Pumpkin', 'Kovboy': 'Cowboy', 'Noel Baba': 'Santa', 'Pamuk Tavşan': 'Cotton Bunny', 'Beyefendi': 'Gentleman', 'Astronot': 'Astronaut', 'Melek': 'Angel',
  'Ateş Ruhu': 'Fire Spirit', 'Buz Kraliçesi': 'Ice Queen', 'Karanlık Melek': 'Dark Angel', 'Siber Samuray': 'Cyber Samurai', 'Uzay Kovboyu': 'Space Cowboy', 'Hayalet Avcısı': 'Ghost Hunter',
  'Cehennem Lordu': 'Hell Lord', 'Kristal Şövalye': 'Crystal Knight', 'Sihirbaz': 'Wizard', 'Kozmik Tavşan': 'Cosmic Bunny', 'Güneş Tanrısı': 'Sun God', 'Ejder Kral': 'Dragon King',
  'Prizma Efsanesi': 'Prism Legend', 'Kozmik Varlık': 'Cosmic Being', 'Altın Ejder': 'Golden Dragon', 'Kabak Kral': 'Pumpkin King', 'Alev Meleği': 'Flame Angel',
  'Konfeti': 'Confetti', 'Kalp Yağmuru': 'Heart Shower', 'Balon': 'Balloon', 'Örs': 'Anvil', 'Tavuk': 'Chicken', 'Mezar Taşı': 'Tombstone', 'Buz Heykeli': 'Ice Statue',
  'Piksel Dağılma': 'Pixelate', 'Havai Fişek': 'Firework', 'UFO': 'UFO', 'Kara Delik': 'Black Hole', 'Meteor': 'Meteor', 'Şimşek': 'Lightning Strike',
  'ÖLDÜRME EFEKTLERİ': 'KILL EFFECTS', '🎁 KASALAR': '🎁 CASES', 'Efektsiz': 'None', 'Öldürme efekti yok': 'No kill effect', '🎁 KASALARDA': '🎁 IN CASES',
  'Başlangıç Kasası': 'Starter Case', 'Efsane Kasası': 'Legend Case', 'Öldürme Kasası': 'Kill Effect Case', 'KASA': 'CASE', 'ATLA': 'SKIP', 'KAPAT': 'CLOSE',
  // özel adlar: İngilizcede de aynı kalır (parça çevirisi "Ata", "Ege" gibi kısa adları bozmasın)
  'Yeniden Başlıyoruz': 'Yeniden Başlıyoruz', 'Ömer': 'Ömer', 'Miraç': 'Miraç', 'Okan': 'Okan', 'Aziz': 'Aziz', 'Kenan': 'Kenan', 'Deniz': 'Deniz', 'Türker': 'Türker',
  'Ramazan': 'Ramazan', 'Kuzey': 'Kuzey', 'Uğurcan': 'Uğurcan', 'Levent': 'Levent', 'Kayra': 'Kayra', 'Ata': 'Ata', 'Mehmet': 'Mehmet', 'Utku': 'Utku', 'İsmail': 'İsmail',
  'Mete': 'Mete', 'Ege': 'Ege', 'Haktan': 'Haktan', 'Yusuf': 'Yusuf', 'Dederam': 'Dederam', '★★ Efsanevi': '★★ Legendary',
  'Askerî': 'Mil-Spec', 'Kısıtlı': 'Restricted', 'Gizli': 'Classified', 'Örtülü': 'Covert', '★ Nadir Özel': '★ Rare Special',
  'YENİ! Envanterine eklendi': 'NEW! Added to your inventory'
});
Object.assign(EN_FRAG, {
  'Parti patlaması': 'Party blast', 'Kalpler saçılır': 'Hearts burst out', 'Şişer, uçar, patlar': 'Inflates, floats, pops', 'Kafasına örs düşer': 'An anvil lands on their head',
  'Tavuğa dönüp kaçar': 'Turns into a chicken and runs', 'Yere gömülür': 'Gets buried', 'Ruhu göğe yükselir': 'Their ghost floats away', 'Donar ve paramparça olur': 'Freezes and shatters',
  'Gökten yıldırım çarpar': 'Struck by lightning', 'Kare kare dağılır': 'Breaks into pixels', 'Fırlar ve patlar': 'Launches and explodes', 'Uzaylılar kaçırır': 'Abducted by aliens',
  'Girdaba çekilir': 'Sucked into a vortex', 'Gökten meteor düşer': 'A meteor crashes down',
  'Nabız ışıklı': 'Pulsing glow', 'Yalnızca kasadan': 'Case only', '🎁 AÇ ': '🎁 OPEN ', 'TEKRAR AÇ': 'OPEN AGAIN', ' eşya · ': ' items · ', ' nadirlik': ' rarities',
  'İÇİNDEKİLER': 'CONTENTS', 'Kopya çıkarsa eşyanın değerinin %35\'i gems olarak geri verilir': 'A duplicate refunds 35% of the item\'s value as gems',
  '★ Nadir Özel eşyalar yalnızca kasalardan çıkar': '★ Rare Special items only drop from cases', 'Zaten sahipsin · kopya iadesi +': 'Already owned · duplicate refund +',
  'Silah skini': 'Weapon skin', 'Karakter skini': 'Character skin', 'Öldürme efekti': 'Kill effect',
  'Askerî': 'Mil-Spec', 'Kısıtlı': 'Restricted', 'Örtülü': 'Covert', '★ Nadir Özel': '★ Rare Special', 'Gizli ': 'Classified '
});
try { _EN_RE = null; _EN_CACHE.clear(); } catch (e) { }
