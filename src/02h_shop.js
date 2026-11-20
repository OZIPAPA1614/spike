/* =====================================================================
   02h · GEMS + MAĞAZA
   Maç bitince "gems" kazanılır (ana menüde görünür). Mağazada gems ile:
   · KILIÇ YÜKSELTME: Tahta → Taş → Altın → Demir → Elmas (en üst). Her
     seviye daha hızlı koşturur, daha çok vurur, daha hızlı savurur.
   · 20 SİLAH SKİNİ (tüm silahlarına uygulanır, kılıç hariç)
   · 20 KARAKTER SKİNİ (takım şeridi her zaman görünür kalır)
   Profil tarayıcıda saklanır; hesapla girildiyse sunucuya da yazılır.
   Kuşanılanlar odaya girerken host'a bildirilir, herkes görür.
   ===================================================================== */
const SWORD_TIERS = [
  { k: 'wood', n: 'Tahta Kılıç', price: 0, spd: 1.22, dmg: 50, heavy: 75, rate: 1.7, heavyRate: 0.95, reach: 78, c: ['#9a6634', '#c08a52', '#5a3a1e', '#2e1d12'], glow: 0 },
  { k: 'stone', n: 'Taş Kılıç', price: 150, spd: 1.27, dmg: 56, heavy: 85, rate: 1.8, heavyRate: 1.0, reach: 81, c: ['#7d8187', '#a9adb3', '#4d5054', '#3a2618'], glow: 0 },
  { k: 'gold', n: 'Altın Kılıç', price: 400, spd: 1.32, dmg: 63, heavy: 95, rate: 1.9, heavyRate: 1.05, reach: 84, c: ['#e8b730', '#ffe28a', '#a8781a', '#3a2618'], glow: 0.25 },
  { k: 'iron', n: 'Demir Kılıç', price: 800, spd: 1.38, dmg: 71, heavy: 108, rate: 2.0, heavyRate: 1.1, reach: 88, c: ['#c3ccd4', '#ffffff', '#5f6870', '#20242a'], glow: 0.1 },
  { k: 'diamond', n: 'Elmas Kılıç', price: 1500, spd: 1.46, dmg: 80, heavy: 120, rate: 2.2, heavyRate: 1.2, reach: 93, c: ['#5ef2ff', '#e0feff', '#2aa9c9', '#1b2a3a'], glow: 0.45 }
];
const SWORD_MAX = SWORD_TIERS.length - 1;
/* silah skinleri: [ana renk, koyu parçalar, vurgu] · glow: vurgu parçaları ışık saçar · rb: gökkuşağı */
const WSKINS = [
  { id: 'w01', n: 'Gece Mavisi', price: 80, c: ['#1d3557', '#0b1420', '#457b9d'] },
  { id: 'w02', n: 'Çöl Kumu', price: 80, c: ['#c2a878', '#6b5a3e', '#e9d8a6'] },
  { id: 'w03', n: 'Orman Kamuflajı', price: 100, c: ['#4b5d34', '#2b3320', '#7a8a52'] },
  { id: 'w04', n: 'Askeri Haki', price: 100, c: ['#6b6b3a', '#30301c', '#a3a36b'] },
  { id: 'w05', n: 'Kar Beyazı', price: 120, c: ['#eef2f5', '#9aa4ad', '#ffffff'] },
  { id: 'w06', n: 'Okyanus', price: 120, c: ['#0f6e7a', '#063238', '#33d1c4'] },
  { id: 'w07', n: 'Kiraz Çiçeği', price: 150, c: ['#f7c6d9', '#8c4b67', '#ffffff'] },
  { id: 'w08', n: 'Gün Batımı', price: 150, c: ['#ff7e46', '#4a1d4f', '#ffd166'] },
  { id: 'w09', n: 'Gümüş Krom', price: 200, c: ['#c9d1d9', '#555c63', '#ffffff'] },
  { id: 'w10', n: 'Obsidyen', price: 200, c: ['#1a1420', '#08060a', '#7b4dff'], glow: 1 },
  { id: 'w11', n: 'Kızıl Ejder', price: 250, c: ['#b3141f', '#1a0a0c', '#ff5a3c'], glow: 1 },
  { id: 'w12', n: 'Zehir Yeşili', price: 250, c: ['#2b3a1a', '#0f140a', '#7dff3a'], glow: 1 },
  { id: 'w13', n: 'Buzul', price: 300, c: ['#bfe9ff', '#3d6f8c', '#e8fbff'], glow: 1 },
  { id: 'w14', n: 'Lav', price: 300, c: ['#2a1a14', '#120a08', '#ff6a1a'], glow: 1 },
  { id: 'w15', n: 'Neon Pembe', price: 350, c: ['#2a1030', '#100614', '#ff3ec8'], glow: 1 },
  { id: 'w16', n: 'Elektrik', price: 350, c: ['#262a12', '#0e1006', '#f7f35a'], glow: 1 },
  { id: 'w17', n: 'Siber Mor', price: 400, c: ['#2a1e55', '#0f0b22', '#a86bff'], glow: 1 },
  { id: 'w18', n: 'Altın Varak', price: 450, c: ['#e2b33c', '#6e4f14', '#fff1a8'], glow: 1 },
  { id: 'w19', n: 'Kraliyet', price: 500, c: ['#1f3a93', '#0d1a44', '#f5c451'], glow: 1 },
  { id: 'w20', n: 'Gökkuşağı', price: 650, c: ['#ff4655', '#1a1a1a', '#ffffff'], glow: 1, rb: 1 }
];
/* karakter skinleri: gövde/kollar, bacaklar, kask, vizör (ışıklı), sırt çantası, şapka */
const CSKINS = [
  { id: 'c01', n: 'Gece Ajanı', price: 100, suit: '#1c2026', legs: '#0e1013', helm: '#14171c', visor: '#ff4655', pack: '#0e1013', hat: null },
  { id: 'c02', n: 'Çöl Savaşçısı', price: 100, suit: '#b89a6a', legs: '#6b5a3e', helm: '#8f7650', visor: '#ffd166', pack: '#5a4a32', hat: 'cap' },
  { id: 'c03', n: 'Orman Korucusu', price: 120, suit: '#3f5a2e', legs: '#26331c', helm: '#2e4022', visor: '#9dff6a', pack: '#4b3a24', hat: 'cap' },
  { id: 'c04', n: 'Komando', price: 120, suit: '#5e6238', legs: '#2f311c', helm: '#41442a', visor: '#ffb347', pack: '#2f311c', hat: 'band' },
  { id: 'c05', n: 'Kar Leoparı', price: 150, suit: '#e9eef2', legs: '#9aa4ad', helm: '#ffffff', visor: '#5ec8ff', pack: '#bcc6cf', hat: 'ears' },
  { id: 'c06', n: 'Derin Deniz', price: 150, suit: '#0f5f6b', legs: '#073239', helm: '#0a4650', visor: '#33f0d4', pack: '#063238', hat: 'antenna' },
  { id: 'c07', n: 'Sakura', price: 180, suit: '#f4b6cf', legs: '#8c4b67', helm: '#ffffff', visor: '#ff5fa2', pack: '#c98aa6', hat: 'ears' },
  { id: 'c08', n: 'Gün Batımı', price: 180, suit: '#ff7e46', legs: '#4a1d4f', helm: '#c4553a', visor: '#ffd166', pack: '#4a1d4f', hat: 'cap' },
  { id: 'c09', n: 'Krom Robot', price: 250, suit: '#b9c2ca', legs: '#59616a', helm: '#dfe6ec', visor: '#3ef1ff', pack: '#7d868f', hat: 'antenna', glow: 1 },
  { id: 'c10', n: 'Gölge Ninja', price: 250, suit: '#151019', legs: '#08060a', helm: '#1f1726', visor: '#a86bff', pack: '#08060a', hat: 'band', glow: 1 },
  { id: 'c11', n: 'Kızıl Samuray', price: 300, suit: '#9e1b24', legs: '#1a0a0c', helm: '#2a0d10', visor: '#ffcc4d', pack: '#5a1016', hat: 'horns' },
  { id: 'c12', n: 'Zehirli Mutant', price: 300, suit: '#3c5a1a', legs: '#1b2a0c', helm: '#2e4512', visor: '#7dff3a', pack: '#1b2a0c', hat: 'mohawk', glow: 1 },
  { id: 'c13', n: 'Buz Muhafızı', price: 350, suit: '#bfe9ff', legs: '#3d6f8c', helm: '#e8fbff', visor: '#5ec8ff', pack: '#8cc4e0', hat: 'halo', glow: 1 },
  { id: 'c14', n: 'Lav Golemi', price: 350, suit: '#3a1d14', legs: '#1a0c08', helm: '#2a120a', visor: '#ff6a1a', pack: '#1a0c08', hat: 'horns', glow: 1 },
  { id: 'c15', n: 'Neon Koşucu', price: 400, suit: '#1d0f24', legs: '#0c0610', helm: '#2a1033', visor: '#ff3ec8', pack: '#0c0610', hat: 'mohawk', glow: 1 },
  { id: 'c16', n: 'Yıldırım', price: 400, suit: '#2a2a12', legs: '#121206', helm: '#f7f35a', visor: '#f7f35a', pack: '#121206', hat: 'antenna', glow: 1 },
  { id: 'c17', n: 'Siber Punk', price: 450, suit: '#2a1e55', legs: '#0f0b22', helm: '#3ef1ff', visor: '#ff3ec8', pack: '#0f0b22', hat: 'mohawk', glow: 1 },
  { id: 'c18', n: 'Altın Şövalye', price: 550, suit: '#e2b33c', legs: '#6e4f14', helm: '#fff1a8', visor: '#ffffff', pack: '#a8781a', hat: 'crown', glow: 1 },
  { id: 'c19', n: 'Kraliyet Muhafızı', price: 650, suit: '#1f3a93', legs: '#0d1a44', helm: '#f5c451', visor: '#f5c451', pack: '#0d1a44', hat: 'crown', glow: 1 },
  { id: 'c20', n: 'Gökkuşağı Efsanesi', price: 800, suit: '#ff4655', legs: '#1a1a1a', helm: '#ffffff', visor: '#ffffff', pack: '#1a1a1a', hat: 'halo', glow: 1, rb: 1 }
];
const WSK = {}, CSK = {};
for (const s of WSKINS) WSK[s.id] = s;
for (const s of CSKINS) CSK[s.id] = s;
const GEM_REWARD = { win: 150, draw: 70, lose: 30, kill: 5, killCap: 30 };
function swordStats(p) {
  const t = SWORD_TIERS[clamp((p && p.swt) | 0, 0, SWORD_MAX)];
  return t._w || (t._w = Object.assign({}, WEAPONS.sword, { spd: t.spd, dmg: t.dmg, heavy: t.heavy, rate: t.rate, heavyRate: t.heavyRate, reach: t.reach, range: t.reach }));
}
/* ağa gelen kozmetik bilgisini doğrula (host) */
function cosClean(c) {
  c = c && typeof c === 'object' ? c : {};
  return { sw: clamp(parseInt(c.sw, 10) || 0, 0, SWORD_MAX), ws: WSK[c.ws] ? c.ws : '', cs: CSK[c.cs] ? c.cs : '' };
}
/* botlar: biraz çeşitlilik */
function cosRandomBot() {
  return { sw: Math.random() < 0.5 ? 0 : randi(1, 3), ws: Math.random() < 0.45 ? pick(WSKINS).id : '', cs: Math.random() < 0.55 ? pick(CSKINS).id : '' };
}
/* gökkuşağı rengi (zamanla döner) */
function rbCol(t, off) {
  const h = ((t * 0.18 + (off || 0)) % 1 + 1) % 1, i = Math.floor(h * 6), fr = h * 6 - i, v = 1, s = 0.85;
  const p = v * (1 - s), q = v * (1 - fr * s), tt = v * (1 - (1 - fr) * s);
  const r = [[v, tt, p], [q, v, p], [p, v, tt], [p, q, v], [tt, p, v], [v, p, q]][i % 6];
  return [r[0], r[1], r[2], 1];
}

const SHOP = {
  prof: null, key: '', _push: null,
  blank() { return { gems: 150, sw: 0, ws: [], cs: [], wsk: '', csk: '', v: 0, played: 0, won: 0 }; },
  fix(p) {
    const b = this.blank(); p = Object.assign(b, p && typeof p === 'object' ? p : {});
    p.gems = Math.max(0, Math.floor(+p.gems || 0)); p.sw = clamp(p.sw | 0, 0, SWORD_MAX); p.v = p.v | 0;
    p.ws = Array.isArray(p.ws) ? p.ws.filter(id => WSK[id]) : []; p.cs = Array.isArray(p.cs) ? p.cs.filter(id => CSK[id]) : [];
    if (p.wsk && !p.ws.includes(p.wsk)) p.wsk = ''; if (p.csk && !p.cs.includes(p.csk)) p.csk = '';
    return p;
  },
  /* hesap değişince (giriş/misafir) ilgili profili yükle */
  load() {
    this.key = 'spk_prof_' + (FR && FR.acc && FR.uid ? FR.uid : 'guest');
    let p = null; try { p = JSON.parse(localStorage.getItem(this.key) || 'null'); } catch (e) { }
    this.prof = this.fix(p);
    if (typeof uiGemsChanged === 'function') uiGemsChanged();
    return this.prof;
  },
  save(push) {
    if (!this.prof) this.load();
    try { localStorage.setItem(this.key, JSON.stringify(this.prof)); } catch (e) { }
    if (typeof uiGemsChanged === 'function') uiGemsChanged();
    if (push !== false) this.pushSoon();
  },
  bump() { this.prof.v = (this.prof.v | 0) + 1; this.save(); },
  /* sunucuya (hesap varsa) kısa gecikmeyle yaz */
  pushSoon() {
    if (!(FR && FR.acc && ACC.uid)) return;
    clearTimeout(this._push);
    this._push = setTimeout(() => { ACC.db('PUT', 'users/' + ACC.uid + '/prof', this.prof).catch(() => { }); }, 600);
  },
  /* ACC.sync ile gelen sunucu profilini birleştir: hangisi daha yeniyse o kazanır */
  cloud(cp) {
    if (!this.prof) this.load();
    if (!cp || typeof cp !== 'object') { if (this.prof.v > 0) this.pushSoon(); return; }
    cp = this.fix(cp);
    if (cp.v > this.prof.v) { this.prof = cp; this.save(false); if (typeof uiStoreRender === 'function') uiStoreRender(); }
    else if (this.prof.v > cp.v) this.pushSoon();
  },
  cos() { const p = this.prof || this.load(); return { sw: p.sw, ws: p.wsk || '', cs: p.csk || '' }; },
  /* maç sonu ödülü: bir maç için bir kez */
  award(res, kills) {
    if (!this.prof) this.load();
    const k = Math.min(GEM_REWARD.killCap, kills | 0);
    const g = (GEM_REWARD[res] || 0) + k * GEM_REWARD.kill;
    this.prof.gems += g; this.prof.played++; if (res === 'win') this.prof.won++;
    this.bump();
    return g;
  },
  buySword() {
    const p = this.prof, nx = p.sw + 1; if (nx > SWORD_MAX) return 'max';
    const t = SWORD_TIERS[nx]; if (p.gems < t.price) return 'gems';
    p.gems -= t.price; p.sw = nx; this.bump(); return 'ok';
  },
  buy(kind, id) {
    const p = this.prof, list = kind === 'ws' ? WSK : CSK, it = list[id]; if (!it) return 'bad';
    if (p[kind].includes(id)) return 'owned';
    if (p.gems < it.price) return 'gems';
    p.gems -= it.price; p[kind].push(id); p[kind === 'ws' ? 'wsk' : 'csk'] = id; this.bump(); return 'ok';
  },
  equip(kind, id) {
    const p = this.prof, f = kind === 'ws' ? 'wsk' : 'csk';
    if (id && !p[kind].includes(id)) return 'bad';
    p[f] = id || ''; this.bump(); return 'ok';
  }
};

/* ---------- 3D: kozmetik renkleri ---------- */
const _SKC = {};
function lumOf(c) { return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; }
/* silah parçaları: [boyut, konum, renk, ışık] — skin yoksa orijinal renkler */
function gunPartsFor(wid, p, t) {
  if (wid === 'sword') {
    const tier = clamp((p && p.swt) | 0, 0, SWORD_MAX), key = 'sword' + tier;
    if (_SKC[key]) return _SKC[key];
    const T = SWORD_TIERS[tier], cols = T.c.map(h => hexRGB(h)), map = [0, 1, 2, 3, 2];
    return (_SKC[key] = GUNM.sword.map((q, i) => [q[0], q[1], cols[map[i]], T.glow && i < 2 ? T.glow : 0]));
  }
  const sk = p && p.wsk ? WSK[p.wsk] : null, base = GUNM[wid] || GUNM.classic;
  if (!sk) return GUNC[wid] || GUNC.classic;
  if (!sk.rb && _SKC[wid + sk.id]) return _SKC[wid + sk.id];
  const main = sk.rb ? rbCol(t || 0) : hexRGB(sk.c[0]), dark = hexRGB(sk.c[1]), acc = sk.rb ? rbCol(t || 0, 0.5) : hexRGB(sk.c[2]);
  const out = base.map((q, i) => {
    const l = lumOf(hexRGB(q[2]));
    const isAcc = i > 0 && l >= 0.16 && i % 2 === 1;
    const col = i === 0 ? main : l < 0.16 ? dark : isAcc ? acc : main;
    return [q[0], q[1], col, sk.glow && isAcc ? 0.65 : 0];
  });
  if (!sk.rb) _SKC[wid + sk.id] = out;
  return out;
}
/* karakter skini renkleri (RGB dizileri) */
function charSkin(p, t) {
  const sk = p && p.csk ? CSK[p.csk] : null; if (!sk) return null;
  if (!sk.rb) return sk._c || (sk._c = { suit: hexRGB(sk.suit), legs: hexRGB(sk.legs), helm: hexRGB(sk.helm), visor: hexRGB(sk.visor), pack: hexRGB(sk.pack), hat: sk.hat, glow: !!sk.glow });
  return { suit: rbCol(t || 0), legs: hexRGB(sk.legs), helm: rbCol(t || 0, 0.33), visor: rbCol(t || 0, 0.66), pack: hexRGB(sk.pack), hat: sk.hat, glow: true };
}

/* ---------- MAĞAZA arayüzü (2B önizlemeler) ---------- */
const STORE = { tab: 'sw' };
function _hx(c) { return '#' + c.slice(0, 3).map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join(''); }
function _shade(hex, k) { const c = hexRGB(hex); return _hx([c[0] * k, c[1] * k, c[2] * k]); }
/* yandan görünüş: GUNM parçaları (x ileri, y yukarı) */
function previewGun(cv, parts, glowCol) {
  const g = cv.getContext('2d'), W2 = cv.width, H2 = cv.height; g.clearRect(0, 0, W2, H2);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [s, o] of parts) { x0 = Math.min(x0, o[0] - s[0] / 2); x1 = Math.max(x1, o[0] + s[0] / 2); y0 = Math.min(y0, o[1] - s[1] / 2); y1 = Math.max(y1, o[1] + s[1] / 2); }
  const sc = Math.min((W2 - 16) / (x1 - x0), (H2 - 16) / (y1 - y0)), cx = W2 / 2 - (x0 + x1) / 2 * sc, cy = H2 / 2 + (y0 + y1) / 2 * sc;
  const order = parts.map((q, i) => [q, i]).sort((a, b) => a[0][1][2] - b[0][1][2]);
  for (const [[s, o, c, gl]] of order) {
    const col = Array.isArray(c) ? _hx(c) : c;
    if (gl) { g.shadowColor = glowCol || col; g.shadowBlur = 10; } else g.shadowBlur = 0;
    g.fillStyle = col; g.fillRect(cx + (o[0] - s[0] / 2) * sc, cy - (o[1] + s[1] / 2) * sc, s[0] * sc, s[1] * sc);
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(cx + (o[0] - s[0] / 2) * sc, cy - (o[1] + s[1] / 2) * sc, s[0] * sc, Math.max(1, s[1] * sc * 0.18));
  }
}
/* önden görünüş: bloklu ajan */
function previewChar(cv, sk) {
  const g = cv.getContext('2d'), W2 = cv.width, H2 = cv.height; g.clearRect(0, 0, W2, H2);
  const c = sk ? { suit: sk.suit, legs: sk.legs, helm: sk.helm, visor: sk.visor, pack: sk.pack } : { suit: '#3a6f8a', legs: '#262b33', helm: '#2c5568', visor: '#3ec1ff', pack: '#20242b' };
  const sc = (H2 - 10) / 96, ox = W2 / 2, oy = H2 - 4;
  const B = (z, y, w, h, col, glow) => { if (glow) { g.shadowColor = col; g.shadowBlur = 12; } g.fillStyle = col; g.fillRect(ox + (z - w / 2) * sc, oy - (y + h / 2) * sc, w * sc, h * sc); g.shadowBlur = 0; };
  B(-5, 13, 8, 26, c.legs); B(5, 13, 8, 26, c.legs);
  B(0, 41, 22, 30, c.suit); B(0, 49, 22.6, 4, '#1ee3cf', true);
  if (sk && sk.glow) B(0, 33, 22.4, 1.6, c.visor, true);
  B(-13.5, 44, 5, 20, c.suit); B(13.5, 44, 5, 20, c.suit);
  B(-13.5, 32, 5, 5, '#d9a679'); B(13.5, 32, 5, 5, '#d9a679');
  B(0, 64, 12, 13, '#d9a679'); B(0, 65, 10, 4, c.visor, true); B(0, 71.5, 13, 3, c.helm);
  const hat = sk && sk.hat, acc = c.visor;
  if (hat === 'cap') { B(0, 74.5, 12, 3, c.helm); B(0, 72.5, 14, 1.5, _shade(c.helm, 0.7)); }
  else if (hat === 'ears') { B(-4.5, 76, 3, 5, c.helm); B(4.5, 76, 3, 5, c.helm); B(-4.5, 75.5, 1.4, 3, acc); B(4.5, 75.5, 1.4, 3, acc); }
  else if (hat === 'antenna') { B(3, 79, 1, 10, '#333'); B(3, 84.5, 3, 3, acc, true); }
  else if (hat === 'mohawk') { B(0, 76, 2.5, 6, acc, true); }
  else if (hat === 'horns') { B(-6, 76, 2.5, 6, '#e8e0d0'); B(-7.5, 80, 2, 3, '#e8e0d0'); B(6, 76, 2.5, 6, '#e8e0d0'); B(7.5, 80, 2, 3, '#e8e0d0'); }
  else if (hat === 'crown') { B(0, 74.2, 13.5, 2.6, '#f5c451', true); for (const z of [-5.2, 0, 5.2]) B(z, 77, 2.4, 3.2, '#f5c451', true); B(0, 75, 1.6, 1.6, '#ff4655'); }
  else if (hat === 'halo') { g.save(); g.shadowColor = acc; g.shadowBlur = 12; g.strokeStyle = acc; g.lineWidth = 2.2; g.beginPath(); g.ellipse(ox, oy - 83 * sc, 9 * sc, 2.4 * sc, 0, 0, TAU); g.stroke(); g.restore(); }
  else if (hat === 'band') { B(0, 69, 13.2, 2.2, acc); B(9, 67.5, 5, 1.5, acc); }
}
function previewRainbow(cv) {
  const g = cv.getContext('2d'); g.save(); g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(0, 0, cv.width, cv.height);
  ['#ff4655', '#ffb347', '#f7f35a', '#3ef17a', '#3ec1ff', '#a86bff', '#ff3ec8'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
  g.globalAlpha = 0.65; g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height); g.restore();
}
function uiGemsChanged() {
  const p = SHOP.prof; if (!p) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('gemN', p.gems); set('stGems', p.gems);
}
function uiStoreRender() {
  const grid = document.getElementById('stGrid'); if (!grid || !SHOP.prof) return;
  const p = SHOP.prof, tab = STORE.tab;
  for (const b of document.querySelectorAll('#stTabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  uiGemsChanged();
  const cards = [];
  const card = (o) => '<div class="sc' + (o.eq ? ' eq' : '') + (o.lock ? ' lock' : '') + '" data-k="' + o.k + '" data-id="' + o.id + '">' +
    '<canvas width="180" height="96"></canvas><div class="nm">' + esc(o.n) + '</div><div class="ds">' + o.ds + '</div>' +
    '<button class="' + (o.primary ? 'primary' : '') + '"' + (o.dis ? ' disabled' : '') + '>' + o.btn + '</button></div>';
  if (tab === 'sw') {
    SWORD_TIERS.forEach((t, i) => {
      const own = i <= p.sw, next = i === p.sw + 1, cur = i === p.sw;
      const ds = 'Hız ×' + t.spd.toFixed(2) + ' · ' + t.dmg + '/' + t.heavy + ' hasar · ' + t.rate.toFixed(1) + '/sn';
      cards.push(card({ k: 'sw', id: i, n: t.n, ds, eq: cur, lock: !own && !next, primary: next && p.gems >= t.price,
        btn: cur ? (i === SWORD_MAX ? 'MAKSİMUM' : 'ŞU AN ELİNDE') : own ? 'SAHİPSİN' : next ? 'YÜKSELT 💎 ' + t.price : '🔒 ' + t.n.toUpperCase(), dis: !next || p.gems < t.price }));
    });
  } else {
    const list = tab === 'ws' ? WSKINS : CSKINS, eqId = tab === 'ws' ? p.wsk : p.csk;
    cards.push(card({ k: tab, id: '', n: 'Varsayılan', ds: 'Skin yok', eq: !eqId, btn: !eqId ? 'KUŞANILDI' : 'KUŞAN', dis: !eqId }));
    for (const s of list) {
      const own = p[tab].includes(s.id), eq = eqId === s.id;
      cards.push(card({ k: tab, id: s.id, n: s.n, ds: (s.rb ? 'Renk değiştiren · ' : s.glow ? 'Işıklı · ' : '') + (own ? 'Sahipsin' : '💎 ' + s.price), eq,
        primary: !own && p.gems >= s.price, btn: eq ? 'KUŞANILDI' : own ? 'KUŞAN' : 'SATIN AL 💎 ' + s.price, dis: eq || (!own && p.gems < s.price) }));
    }
  }
  grid.innerHTML = cards.join('');
  for (const el of grid.querySelectorAll('.sc')) {
    const cv = el.querySelector('canvas'), k = el.dataset.k, id = el.dataset.id;
    if (k === 'sw') previewGun(cv, gunPartsFor('sword', { swt: +id }), SWORD_TIERS[+id].glow ? SWORD_TIERS[+id].c[0] : null);
    else if (k === 'ws') {
      const s = WSK[id]; previewGun(cv, gunPartsFor('vandal', { wsk: id }, 0), s ? s.c[2] : null); if (s && s.rb) previewRainbow(cv);
      if (s) { // mermi + arkasındaki iz
        const g = cv.getContext('2d'), y = cv.height * 0.28, x0 = cv.width * 0.62, x1 = cv.width - 6, col = s.c[2];
        const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, col);
        g.save(); g.shadowColor = col; g.shadowBlur = s.glow ? 10 : 4; g.strokeStyle = gr; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
        if (s.rb) { const g2 = g.createLinearGradient(x0, 0, x1, 0); ['#ff4655', '#f7f35a', '#3ef17a', '#3ec1ff', '#a86bff'].forEach((c, i) => g2.addColorStop(i / 4, c)); g.strokeStyle = g2; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
        g.fillStyle = '#fff'; g.beginPath(); g.arc(x1 - 2, y, 2.4, 0, TAU); g.fill(); g.restore();
      }
    }
    else { const s = CSK[id]; previewChar(cv, s || null); if (s && s.rb) previewRainbow(cv); }
    el.querySelector('button').onclick = () => {
      let r;
      if (k === 'sw') r = SHOP.buySword();
      else if (!id || SHOP.prof[k].includes(id)) r = SHOP.equip(k, id);
      else r = SHOP.buy(k, id);
      if (r === 'gems') uiToast('Yeterli gems yok', true);
      else if (r === 'ok') { AU.play && AU.play('buy'); if (k === 'sw') uiToast(SWORD_TIERS[SHOP.prof.sw].n + ' alındı!'); }
      uiStoreRender();
    };
  }
}
function uiStoreInit() {
  SHOP.load();
  for (const b of document.querySelectorAll('#stTabs button')) b.onclick = () => { STORE.tab = b.dataset.tab; uiStoreRender(); };
  const bs = document.getElementById('btnStore');
  if (bs) bs.onclick = () => { uiShow('scr-store'); uiStoreRender(); };
}
Object.assign(EN_EXACT, {
  'Tahta Kılıç': 'Wooden Sword', 'Taş Kılıç': 'Stone Sword', 'Altın Kılıç': 'Gold Sword', 'Demir Kılıç': 'Iron Sword', 'Elmas Kılıç': 'Diamond Sword',
  'Gece Mavisi': 'Midnight Blue', 'Çöl Kumu': 'Desert Sand', 'Orman Kamuflajı': 'Forest Camo', 'Askeri Haki': 'Army Khaki', 'Kar Beyazı': 'Snow White', 'Okyanus': 'Ocean',
  'Kiraz Çiçeği': 'Cherry Blossom', 'Gün Batımı': 'Sunset', 'Gümüş Krom': 'Silver Chrome', 'Obsidyen': 'Obsidian', 'Kızıl Ejder': 'Crimson Dragon', 'Zehir Yeşili': 'Toxic Green',
  'Buzul': 'Glacier', 'Lav': 'Lava', 'Neon Pembe': 'Neon Pink', 'Elektrik': 'Electric', 'Siber Mor': 'Cyber Purple', 'Altın Varak': 'Gold Leaf', 'Kraliyet': 'Royal', 'Gökkuşağı': 'Rainbow',
  'Gece Ajanı': 'Night Agent', 'Çöl Savaşçısı': 'Desert Warrior', 'Orman Korucusu': 'Forest Ranger', 'Komando': 'Commando', 'Kar Leoparı': 'Snow Leopard', 'Derin Deniz': 'Deep Sea',
  'Sakura': 'Sakura', 'Krom Robot': 'Chrome Robot', 'Gölge Ninja': 'Shadow Ninja', 'Kızıl Samuray': 'Crimson Samurai', 'Zehirli Mutant': 'Toxic Mutant', 'Buz Muhafızı': 'Ice Guardian',
  'Lav Golemi': 'Lava Golem', 'Neon Koşucu': 'Neon Runner', 'Yıldırım': 'Thunderbolt', 'Siber Punk': 'Cyberpunk', 'Altın Şövalye': 'Golden Knight', 'Kraliyet Muhafızı': 'Royal Guard',
  'Gökkuşağı Efsanesi': 'Rainbow Legend', 'Varsayılan': 'Default', 'Skin yok': 'No skin', 'KUŞAN': 'EQUIP', 'KUŞANILDI': 'EQUIPPED', 'SAHİPSİN': 'OWNED', 'MAKSİMUM': 'MAXED',
  'ŞU AN ELİNDE': 'EQUIPPED', 'KILIÇLAR': 'SWORDS', 'SİLAH SKİNLERİ': 'WEAPON SKINS', 'KARAKTER SKİNLERİ': 'CHARACTER SKINS', 'Yeterli gems yok': 'Not enough gems', 'TEK ATAR': 'ONE-SHOT',
  'Sahipsin': 'Owned', 'TAKIM İYİLEŞTİRİLDİ': 'TEAM HEALED', 'Toplam': 'Total', 'MAĞAZA · GEMS': 'STORE · GEMS'
});
Object.assign(EN_FRAG, {
  'YÜKSELT': 'UPGRADE', 'SATIN AL': 'BUY', 'TAHTA KILIÇ': 'WOODEN SWORD', 'TAŞ KILIÇ': 'STONE SWORD', 'ALTIN KILIÇ': 'GOLD SWORD', 'DEMİR KILIÇ': 'IRON SWORD',
  'Renk değiştiren': 'Color-shifting', 'Işıklı': 'Glowing', 'Hız ×': 'Speed ×', ' hasar': ' dmg', ' alındı!': ' unlocked!',
  'Maç bittikçe gems kazanırsın': 'You earn gems after every match', 'galibiyet': 'win', 'beraberlik': 'draw', 'yenilgi': 'loss', ' öldürme başına': ' per kill',
  'Odaya bağlanılıyor: ': 'Connecting to room: ', 'Açık oda: ': 'Public rooms: ', ' · Oyuncu: ': ' · Players: ', 'Başlamasına ': 'Starts in ',
  'Oyuncu bekleniyor (en az 2 kişi)': 'Waiting for players (at least 2)', 'Maç başlıyor…': 'Match starting…', 'HERKESE AÇIK SUNUCU': 'PUBLIC SERVER',
  'GEMS KAZANDIN': 'GEMS EARNED', 'MAĞAZA · GEMS': 'STORE · GEMS', '/sn': '/s',
  'HERKESE AÇIK SUNUCU': 'PUBLIC SERVER', 'Rastgele oyuncularla eşleşiyorsun': 'Matching you with random players', 'İPTAL': 'CANCEL',
  'Açık sunucular aranıyor…': 'Searching public servers…', 'Şu an açık oda yok': 'No public rooms right now', 'Açık sunucuya katıldın!': 'Joined a public server!',
  'Yeni açık sunucu kuruldu — oyuncular bekleniyor': 'New public server created — waiting for players', 'Uygun açık oda yok — yeni bir açık sunucu kuruluyor…': 'No open room — creating a new public server…',
  'Sunucu listesine ulaşılamadı — yeni bir açık oda kuruluyor…': 'Could not reach the server list — creating a new public room…', 'Açık sunucuya bağlanılamadı — ayrıntı menüde.': 'Could not join a public server — details in the menu.',
  'Boş yer olan bir odaya otomatik girersin. Hiç oda yoksa yeni bir açık oda kurulur ve başkaları sana katılır. Lobide 2 kişi olunca maç 25 saniye içinde kendiliğinden başlar, boş yerleri botlar doldurur.': 'You are placed in a room with free slots automatically. If there is none, a new public room is created and others join you. Once 2 players are in the lobby, the match starts by itself within 25 seconds; bots fill the empty slots.',
  '🌐 HERKESE AÇIK SUNUCUYA KATIL': '🌐 JOIN PUBLIC SERVER', '🌐 HERKESE AÇIK SUNUCU (rastgele oyuncular katılabilir)': '🌐 PUBLIC SERVER (random players can join)',
  'KAMERA': 'CAMERA', 'BİRİNCİ ŞAHIS': 'FIRST PERSON', 'ARKADAN': 'BEHIND', 'ÖNDEN': 'FRONT', 'Renkli mermi izi': 'Colored bullet trail', ' · Silah skinleri mermiye de renk ve iz verir': ' · Weapon skins also color your bullets and their trails'
});
EN_EXACT['Her maçta ' + MAPS.length + ' haritadan biri rastgele seçilir.'] = 'One of the ' + MAPS.length + ' maps is picked at random every match.';
try { _EN_RE = null; _EN_CACHE.clear(); } catch (e) { } // yeni çeviriler sözlüğe girsin
