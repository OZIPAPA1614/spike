/* =====================================================================
   01b · HARİTALAR ve TEMALAR
        6 harita (MERKEZ + 5 yeni geniş, açık hava haritası), her biri kendi
        zemin/duvar/kasa/siper dokusu, gökyüzü, sis, ışık ve dekoru ile.
        Bot taktik noktaları (savunma pozisyonları, kurulum sonrası noktalar,
        doğuş noktaları) yeni haritalarda otomatik çıkarılır.
   ===================================================================== */
const B_ = T_BOX, L_ = T_LOW, W_ = T_WATER;

/* ---------- doku yardımcıları (canvas) ---------- */
function nz(c, w, h, n, a, dark) { for (let i = 0; i < n; i++) { c.fillStyle = 'rgba(' + ((dark === undefined ? Math.random() < 0.5 : dark) ? '0,0,0' : '255,255,255') + ',' + Math.random() * a + ')'; c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 1 + Math.random() * 3); } }
function bricks(c, w, h, bw, bh, base, line, jitter) {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += bh) for (let x = -((y / bh) % 2) * bw / 2; x < w; x += bw) {
    c.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '255,255,255') + ',' + Math.random() * jitter + ')';
    c.fillRect(x + 1, y + 1, bw - 2, bh - 2);
  }
  c.strokeStyle = line; c.lineWidth = 2;
  for (let y = 0; y <= h; y += bh) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  for (let y = 0; y < h; y += bh) for (let x = -((y / bh) % 2) * bw / 2; x < w; x += bw) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + bh); c.stroke(); }
}

const THEMES = {
  merkez: {
    pack: { wall: 'concrete_layers', wallTint: '#c8d2dc', floor: 'concrete_tiles', crate: 'weathered_brown_planks', detS: 1 / 120,
      wallFx(c, w, h) { c.strokeStyle = 'rgba(20,28,36,0.55)'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h / 2 - 4); c.strokeRect(2, h / 2 + 2, w - 4, h / 2 - 4); } },
    sky: ['#0b1724', '#1c2c3c'], fogCol: '#121c27', fog: [1200, 3800], wallH: 120, amb: 0.48, dif: 0.72, lc: [1, 1, 1], light: [0.36, 0.88, 0.3],
    trim: [0.08, 0.62, 0.57], stars: true,
    floor: { style: 'tiles', bg: '#20262c', floor: ['#69737c', '#606a73'], site: ['#77736a', '#6d695f'], atk: ['#76545c', '#6b4b53'], def: ['#4a7577', '#426b6d'], water: '#24506e', low: '#4d5359' },
    wall(c, w, h) {
      c.fillStyle = '#7f8b96'; c.fillRect(0, 0, w, h); nz(c, w, h, 900, 0.06);
      c.strokeStyle = 'rgba(30,40,50,0.55)'; c.lineWidth = 3;
      c.strokeRect(2, 2, w - 4, h / 2 - 4); c.strokeRect(2, h / 2 + 2, w / 2 - 4, h / 2 - 4); c.strokeRect(w / 2 + 2, h / 2 + 2, w / 2 - 4, h / 2 - 4);
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(0, 0, w, 3);
    },
    crate(c, w, h) {
      c.fillStyle = '#9a7445'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#8d6a3e' : '#a57c4a'; c.fillRect(0, i * 21, w, 21); }
      nz(c, w, h, 300, 0.08);
      c.strokeStyle = '#4e3a22'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
      c.lineWidth = 9; c.beginPath(); c.moveTo(10, 10); c.lineTo(w - 10, h - 10); c.moveTo(w - 10, 10); c.lineTo(10, h - 10); c.stroke();
    },
    low(c, w, h) { c.fillStyle = '#9aa0a6'; c.fillRect(0, 0, w, h); nz(c, w, h, 400, 0.1); c.fillStyle = '#f5c451'; for (let i = 0; i < 4; i++) c.fillRect(i * 34, 10, 16, 8); },
    decor: null
  },
  liman: {
    pack: { wall: 'medieval_red_brick', floor: 'gravel_embedded_concrete', crate: 'rusty_metal_03', crateTint: '#d8a070', crateFrame: 'rgba(60,30,12,0.8)', detS: 1 / 140 },
    sky: ['#3f86cf', '#cfe3f2'], fogCol: '#c4d8e8', fog: [1600, 5600], wallH: 110, amb: 0.58, dif: 0.62, lc: [1, 0.98, 0.93], light: [0.5, 0.82, 0.28],
    trim: [0.95, 0.75, 0.12], sun: { dir: [0.5, 0.55, -0.66], col: [1, 0.97, 0.85], size: 26 }, clouds: 9,
    floor: { style: 'concrete', bg: '#3c4247', floor: ['#8d9194', '#878b8e'], site: ['#a39a80', '#9b9279'], atk: ['#9c6e6e', '#946767'], def: ['#679596', '#5f8d8e'], water: '#2a6a98', low: '#70757a', lines: '#e6c34a' },
    wall(c, w, h) {
      c.fillStyle = '#2f6c8f'; c.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 16) { c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(x, 0, 6, h); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x + 10, 0, 4, h); }
      nz(c, w, h, 500, 0.08); c.fillStyle = 'rgba(150,70,30,0.35)'; for (let i = 0; i < 25; i++) c.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 10, 2 + Math.random() * 14);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, w, 8); c.fillRect(0, h - 8, w, 8);
    },
    crate(c, w, h) {
      c.fillStyle = '#b8402f'; c.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 10) { c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(x, 0, 4, h); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x + 6, 0, 3, h); }
      c.fillStyle = '#7d2a1f'; c.fillRect(0, 0, w, 7); c.fillRect(0, h - 7, w, 7); c.fillRect(0, 0, 7, h); c.fillRect(w - 7, 0, 7, h);
      c.fillStyle = 'rgba(255,255,255,0.75)'; c.font = 'bold 22px Arial'; c.fillText('NVA', 34, 70);
    },
    low(c, w, h) { c.fillStyle = '#b9bdc0'; c.fillRect(0, 0, w, h); nz(c, w, h, 600, 0.12); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, h - 14, w, 14); c.fillStyle = '#e1b33a'; for (let i = 0; i < 4; i++) { c.save(); c.translate(i * 34, 0); c.fillRect(0, 20, 18, 12); c.restore(); } },
    decor: 'liman'
  },
  col: {
    pack: { wall: 'rock_pitted_mossy', wallTint: '#f4dcc0', floor: 'mud_cracked_dry_03', crate: 'weathered_brown_planks', crateTint: '#f0d8b8', detS: 1 / 170 },
    sky: ['#4b95dc', '#f6ddaa'], fogCol: '#ecd3a1', fog: [1500, 5200], wallH: 115, amb: 0.56, dif: 0.72, lc: [1, 0.93, 0.8], light: [0.62, 0.72, 0.22],
    trim: null, sun: { dir: [0.62, 0.42, 0.26], col: [1, 0.94, 0.7], size: 34 }, clouds: 3,
    floor: { style: 'sand', bg: '#a9895a', floor: ['#dcbb82', '#d6b57b'], site: ['#cba66b', '#c59f64'], atk: ['#cf9473', '#c88c6b'], def: ['#b3bf8e', '#abb886'], water: '#3f8aa0', low: '#a38558' },
    wall(c, w, h) { bricks(c, w, h, 64, 32, '#c9a46c', 'rgba(110,80,40,0.55)', 0.12); nz(c, w, h, 800, 0.08); c.fillStyle = 'rgba(255,240,200,0.25)'; c.fillRect(0, 0, w, 5); },
    crate(c, w, h) { bricks(c, w, h, 64, 64, '#b88f58', 'rgba(90,60,30,0.6)', 0.1); c.strokeStyle = 'rgba(90,60,30,0.6)'; c.lineWidth = 3; c.beginPath(); c.arc(64, 64, 22, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(64, 42); c.lineTo(64, 86); c.moveTo(42, 64); c.lineTo(86, 64); c.stroke(); },
    low(c, w, h) { c.fillStyle = '#9c8456'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 24) for (let x = -(y % 48) / 2; x < w; x += 44) { c.fillStyle = '#b29a68'; c.beginPath(); c.ellipse(x + 22, y + 12, 20, 10, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(60,45,20,0.6)'; c.lineWidth = 2; c.stroke(); } },
    decor: 'col'
  },
  buzul: {
    pack: { wall: 'concrete_layers', wallTint: '#e8f2ff', floor: 'snow_02', crate: 'rusty_metal_03', crateTint: '#ff9a7a', crateFrame: 'rgba(40,20,14,0.8)', detS: 1 / 150,
      wallFx(c, w, h) { c.globalCompositeOperation = 'screen'; c.fillStyle = 'rgba(120,130,150,0.55)'; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over'; c.fillStyle = 'rgba(245,250,255,0.9)'; c.fillRect(0, 0, w, 18); } },
    sky: ['#87a9c6', '#eef3f7'], fogCol: '#e3ebf1', fog: [800, 4000], wallH: 135, amb: 0.64, dif: 0.48, lc: [0.95, 0.98, 1.04], light: [0.3, 0.85, 0.42],
    trim: [0.3, 0.75, 1], sun: { dir: [-0.4, 0.3, -0.86], col: [1, 1, 0.97], size: 22 }, clouds: 12,
    floor: { style: 'snow', bg: '#c9d5de', floor: ['#eaf0f4', '#e4ebf0'], site: ['#d3dbe5', '#ccd5df'], atk: ['#e6d0d5', '#dfc9ce'], def: ['#cde3e4', '#c6dcdd'], water: '#9fd0ea', low: '#dbe6ee', ice: true },
    wall(c, w, h) {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, '#dfeaf2'); g.addColorStop(1, '#9fbad0');
      c.fillStyle = g; c.fillRect(0, 0, w, h); nz(c, w, h, 700, 0.06);
      c.strokeStyle = 'rgba(80,120,160,0.35)'; c.lineWidth = 2; for (let i = 0; i < 9; i++) { c.beginPath(); let x = Math.random() * w, y = h * 0.3; c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += rand(-20, 20); y += rand(15, 40); c.lineTo(x, y); } c.stroke(); }
    },
    crate(c, w, h) { c.fillStyle = '#e07a2e'; c.fillRect(0, 0, w, h); nz(c, w, h, 300, 0.1); c.fillStyle = '#5a5f66'; c.fillRect(0, 0, 18, 18); c.fillRect(w - 18, 0, 18, 18); c.fillRect(0, h - 18, 18, 18); c.fillRect(w - 18, h - 18, 18, 18); c.fillStyle = '#fff'; c.fillRect(30, 56, 68, 16); c.fillStyle = '#e07a2e'; c.fillRect(56, 30, 16, 68); },
    low(c, w, h) { c.fillStyle = '#e9f1f6'; c.fillRect(0, 0, w, h); nz(c, w, h, 400, 0.08); c.fillStyle = 'rgba(130,170,200,0.4)'; c.fillRect(0, h - 20, w, 20); },
    decor: 'buzul'
  },
  tapinak: {
    pack: { wall: 'mossy_brick', floor: 'leaves_forest_ground', crate: 'weathered_brown_planks', detS: 1 / 150,
      wallFx(c, w, h) { c.globalCompositeOperation = 'screen'; c.fillStyle = 'rgba(95,100,80,0.75)'; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over'; } },
    sky: ['#5f9fc6', '#d6e8d4'], fogCol: '#aecaa9', fog: [1000, 4600], wallH: 125, amb: 0.5, dif: 0.7, lc: [1, 1, 0.9], light: [0.42, 0.84, 0.34],
    trim: null, sun: { dir: [0.3, 0.6, 0.74], col: [1, 0.98, 0.85], size: 24 }, clouds: 7,
    floor: { style: 'grass', bg: '#4d6440', floor: ['#6c8a4f', '#668449'], site: ['#8f8b73', '#87836b'], atk: ['#8c7056', '#846850'], def: ['#5d8b72', '#56846b'], water: '#3b7c84', low: '#7b7d6e' },
    wall(c, w, h) { bricks(c, w, h, 85, 42, '#80826f', 'rgba(40,45,30,0.6)', 0.14); c.fillStyle = 'rgba(70,120,40,0.45)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h * 0.6, rand(4, 18), rand(3, 10), 0, 0, TAU); c.fill(); } for (let i = 0; i < 8; i++) { c.fillStyle = 'rgba(60,110,40,0.6)'; c.fillRect(Math.random() * w, 0, 3, rand(30, 120)); } },
    crate(c, w, h) { c.fillStyle = '#8c8a74'; c.fillRect(0, 0, w, h); nz(c, w, h, 400, 0.12); c.strokeStyle = 'rgba(40,40,25,0.7)'; c.lineWidth = 4; c.strokeRect(10, 10, w - 20, h - 20); c.beginPath(); c.moveTo(30, 40); c.lineTo(64, 24); c.lineTo(98, 40); c.moveTo(64, 24); c.lineTo(64, 100); c.moveTo(36, 80); c.lineTo(92, 80); c.stroke(); c.fillStyle = 'rgba(70,120,40,0.5)'; c.fillRect(0, 0, w, 10); },
    low(c, w, h) { c.fillStyle = '#7a7c68'; c.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { c.fillStyle = 'rgba(' + randi(90, 140) + ',' + randi(95, 140) + ',' + randi(80, 110) + ',1)'; c.beginPath(); c.ellipse(rand(0, w), rand(0, h), rand(10, 24), rand(8, 16), rand(0, 3), 0, TAU); c.fill(); } },
    decor: 'tapinak'
  },
  neon: {
    pack: { wall: 'painted_concrete_02', wallTint: '#8890a8', floor: 'granular_concrete', crate: 'rusty_metal_03', crateTint: '#7a8aa0', crateFrame: 'rgba(30,227,207,0.9)', detS: 1 / 110,
      wallFx(c, w, h) { for (let y = 16; y < h - 30; y += 64) for (let x = 16; x < w; x += 64) { const lit = Math.random(); c.fillStyle = lit < 0.35 ? 'rgba(255,214,140,0.85)' : lit < 0.45 ? 'rgba(120,200,255,0.8)' : 'rgba(30,34,48,0.9)'; c.fillRect(x, y, 36, 40); } } },
    sky: ['#05030f', '#2a0f45'], fogCol: '#1f0f33', fog: [900, 5000], wallH: 190, amb: 0.46, dif: 0.42, lc: [0.86, 0.8, 1.05], light: [0.25, 0.9, 0.3],
    trim: [1, 0.18, 0.72], stars: true, moon: true,
    floor: { style: 'asphalt', bg: '#15161b', floor: ['#2c2e36', '#292b32'], site: ['#383444', '#34303f'], atk: ['#3d2c36', '#392832'], def: ['#253a3e', '#22363a'], water: '#1d4a66', low: '#3a3d46', lines: '#f5c451' },
    wall(c, w, h) {
      c.fillStyle = '#1b1d26'; c.fillRect(0, 0, w, h);
      for (let y = 8; y < h; y += 32) for (let x = 8; x < w; x += 32) { const lit = Math.random(); c.fillStyle = lit < 0.35 ? 'rgba(255,214,140,0.85)' : lit < 0.45 ? 'rgba(120,200,255,0.8)' : 'rgba(40,44,60,1)'; c.fillRect(x, y, 18, 20); }
      c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(0, h - 10, w, 10);
    },
    crate(c, w, h) { c.fillStyle = '#2f3440'; c.fillRect(0, 0, w, h); nz(c, w, h, 200, 0.1); c.strokeStyle = '#1ee3cf'; c.lineWidth = 4; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = '#ff3fb4'; c.fillRect(20, 58, 88, 10); },
    low(c, w, h) { c.fillStyle = '#d9d9d9'; c.fillRect(0, 0, w, h); for (let x = -h; x < w; x += 32) { c.fillStyle = '#d93a3a'; c.beginPath(); c.moveTo(x, h); c.lineTo(x + 16, h); c.lineTo(x + 16 + h, 0); c.lineTo(x + h, 0); c.closePath(); c.fill(); } },
    decor: 'neon'
  },
  /* ---------- 5 YENİ HARİTA TEMASI ---------- */
  volkan: {
    pack: { wall: 'rock_pitted_mossy', wallTint: '#7a5a50', floor: 'mud_cracked_dry_03', crate: 'rusty_metal_03', crateTint: '#b07a5a', crateFrame: 'rgba(40,14,6,0.85)', detS: 1 / 150,
      wallFx(c, w, h) { c.globalCompositeOperation = 'multiply'; c.fillStyle = '#5a3a34'; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over';
        c.strokeStyle = 'rgba(255,110,20,0.85)'; c.lineWidth = 3; c.shadowColor = '#ff6a14'; c.shadowBlur = 8;
        for (let i = 0; i < 7; i++) { c.beginPath(); let x = Math.random() * w, y = h; c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rand(-22, 22); y -= rand(18, 46); c.lineTo(x, y); } c.stroke(); }
        c.shadowBlur = 0; const g = c.createLinearGradient(0, h * 0.82, 0, h); g.addColorStop(0, 'rgba(255,90,20,0)'); g.addColorStop(1, 'rgba(255,90,20,0.55)'); c.fillStyle = g; c.fillRect(0, h * 0.82, w, h * 0.18); } },
    sky: ['#1a0605', '#6a200e'], fogCol: '#3c160c', fog: [900, 4400], wallH: 125, amb: 0.5, dif: 0.62, lc: [1, 0.8, 0.66], light: [0.4, 0.8, 0.3],
    trim: [1, 0.36, 0.06], clouds: 0,
    floor: { style: 'asphalt', bg: '#2a1c18', floor: ['#4c3a32', '#47362e'], site: ['#5e4636', '#584131'], atk: ['#5e2f2a', '#582b26'], def: ['#3c4b48', '#374643'], water: '#ff5a14', low: '#4a3a34', waterEm: [1.1, 0.42, 0.06] },
    wall(c, w, h) { c.fillStyle = '#3a2a26'; c.fillRect(0, 0, w, h); nz(c, w, h, 900, 0.1); c.strokeStyle = 'rgba(255,110,20,0.8)'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(Math.random() * w, h); c.lineTo(Math.random() * w, h * 0.4); c.stroke(); } },
    crate(c, w, h) { c.fillStyle = '#6a4a3a'; c.fillRect(0, 0, w, h); nz(c, w, h, 300, 0.12); c.strokeStyle = '#2a1810'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); },
    low(c, w, h) { c.fillStyle = '#3e302c'; c.fillRect(0, 0, w, h); for (let i = 0; i < 18; i++) { c.fillStyle = 'rgba(' + randi(60, 90) + ',' + randi(45, 60) + ',' + randi(40, 55) + ',1)'; c.beginPath(); c.ellipse(rand(0, w), rand(0, h), rand(10, 22), rand(8, 14), rand(0, 3), 0, TAU); c.fill(); } c.fillStyle = 'rgba(255,100,20,0.6)'; c.fillRect(0, h - 6, w, 6); },
    decor: 'volkan'
  },
  ada: {
    pack: { wall: 'weathered_brown_planks', wallTint: '#f4dcb4', floor: 'mud_cracked_dry_03', crate: 'weathered_brown_planks', crateTint: '#e8c494', detS: 1 / 190,
      wallFx(c, w, h) { c.fillStyle = 'rgba(255,240,210,0.18)'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(70,45,20,0.55)'; for (let y = 0; y < h; y += 64) c.fillRect(0, y, w, 5); c.fillStyle = 'rgba(60,120,40,0.55)'; for (let i = 0; i < 14; i++) c.fillRect(Math.random() * w, 0, 4, rand(20, 70)); } },
    sky: ['#1f8fe0', '#c4f0fa'], fogCol: '#c4ecf6', fog: [1700, 6000], wallH: 105, amb: 0.64, dif: 0.7, lc: [1, 0.97, 0.9], light: [0.45, 0.85, 0.3],
    trim: null, sun: { dir: [0.4, 0.62, 0.5], col: [1, 0.97, 0.85], size: 30 }, clouds: 11,
    floor: { style: 'sand', bg: '#c9b07a', floor: ['#f0dba2', '#ead59b'], site: ['#e2c58a', '#dcbf84'], atk: ['#e6b48f', '#e0ae89'], def: ['#b8d6a8', '#b0cfa0'], water: '#16a4c8', low: '#b89a68' },
    wall(c, w, h) { c.fillStyle = '#b08a5a'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 14) { c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x, 0, 5, h); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x + 10, 0, 3, h); } },
    crate(c, w, h) { c.fillStyle = '#c49a64'; c.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#b88e58' : '#cfa56e'; c.fillRect(0, i * 21, w, 21); } c.strokeStyle = '#6a4a26'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); },
    low(c, w, h) { c.fillStyle = '#a88a5c'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { c.fillStyle = y % 32 ? '#b8986a' : '#9c7e52'; c.fillRect(0, y, w, 14); } },
    decor: 'ada'
  },
  uzay: {
    pack: { wall: 'painted_concrete_02', wallTint: '#d4dce8', floor: 'granular_concrete', crate: 'rusty_metal_03', crateTint: '#9fb0c8', crateFrame: 'rgba(60,200,255,0.9)', detS: 1 / 130,
      wallFx(c, w, h) { c.globalCompositeOperation = 'saturation'; c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over';
        c.strokeStyle = 'rgba(20,30,45,0.65)'; c.lineWidth = 4; for (let y = 0; y < h; y += 128) for (let x = 0; x < w; x += 128) c.strokeRect(x + 3, y + 3, 122, 122);
        c.fillStyle = 'rgba(80,220,255,0.95)'; c.shadowColor = '#3ec1ff'; c.shadowBlur = 10; c.fillRect(0, h * 0.62, w, 6); c.shadowBlur = 0;
        c.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 10; i++) c.fillRect(Math.random() * w, Math.random() * h, 18, 4); } },
    sky: ['#000002', '#070a1c'], fogCol: '#04050c', fog: [1300, 6400], wallH: 150, amb: 0.5, dif: 0.6, lc: [0.92, 0.96, 1.06], light: [0.3, 0.9, 0.3],
    trim: [0.2, 0.85, 1], stars: true, planet: { dir: [-0.6, 0.32, 0.72], size: 0.16, col: [0.95, 0.55, 0.32], col2: [0.75, 0.38, 0.22], ring: [0.9, 0.82, 0.7] },
    floor: { style: 'tiles', bg: '#1a1e26', floor: ['#5c6472', '#555d6b'], site: ['#4c5c7a', '#475775'], atk: ['#6c4c5c', '#654757'], def: ['#406c72', '#3b666c'], water: '#1b6ad8', low: '#626c7a', lines: '#3ec1ff', waterEm: [0.1, 0.45, 1] },
    wall(c, w, h) { c.fillStyle = '#9aa4b2'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(20,30,45,0.6)'; c.lineWidth = 3; for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) c.strokeRect(x + 2, y + 2, 60, 60); c.fillStyle = '#3ec1ff'; c.fillRect(0, h * 0.62, w, 4); },
    crate(c, w, h) { c.fillStyle = '#6a7486'; c.fillRect(0, 0, w, h); nz(c, w, h, 200, 0.08); c.strokeStyle = '#3ec1ff'; c.lineWidth = 4; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = '#f5c451'; c.fillRect(20, 20, 20, 20); },
    low(c, w, h) { c.fillStyle = '#7a8494'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a3240'; for (let x = 0; x < w; x += 16) c.fillRect(x, 0, 8, h); c.fillStyle = '#3ec1ff'; c.fillRect(0, 4, w, 3); },
    decor: 'uzay'
  },
  sakura: {
    pack: { wall: 'painted_concrete_02', wallTint: '#fff4ea', floor: 'gravel_embedded_concrete', crate: 'weathered_brown_planks', crateTint: '#d89a7a', detS: 1 / 160,
      wallFx(c, w, h) { c.globalCompositeOperation = 'saturation'; c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over';
        c.fillStyle = 'rgba(255,248,240,0.55)'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#4a2a1c'; c.fillRect(0, 0, w, 16); c.fillRect(0, h - 22, w, 22); for (let x = 0; x < w; x += 128) c.fillRect(x, 0, 14, h); c.fillRect(0, h * 0.48, w, 10);
        c.fillStyle = '#b02a2a'; c.fillRect(0, 16, w, 5); } },
    sky: ['#f39ab4', '#ffe6d8'], fogCol: '#f6d6dc', fog: [1300, 5200], wallH: 120, amb: 0.62, dif: 0.64, lc: [1, 0.95, 0.95], light: [0.4, 0.8, 0.4],
    trim: null, sun: { dir: [-0.5, 0.3, 0.62], col: [1, 0.85, 0.8], size: 36 }, clouds: 6,
    floor: { style: 'grass', bg: '#6a7a50', floor: ['#8aa262', '#849b5c'], site: ['#aaa292', '#a29a8a'], atk: ['#b28c7c', '#aa8474'], def: ['#7c9c8c', '#749484'], water: '#4aa0b8', low: '#8a7a68' },
    wall(c, w, h) { c.fillStyle = '#f3ece2'; c.fillRect(0, 0, w, h); c.fillStyle = '#4a2a1c'; c.fillRect(0, 0, w, 10); c.fillRect(0, h - 14, w, 14); for (let x = 0; x < w; x += 64) c.fillRect(x, 0, 8, h); },
    crate(c, w, h) { c.fillStyle = '#9a5a3a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#8e5234' : '#a6623f'; c.fillRect(0, i * 21, w, 21); } c.strokeStyle = '#3a1e12'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); },
    low(c, w, h) { c.fillStyle = '#8c8478'; c.fillRect(0, 0, w, h); for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(' + randi(120, 160) + ',' + randi(115, 150) + ',' + randi(105, 140) + ',1)'; c.beginPath(); c.ellipse(rand(0, w), rand(0, h), rand(10, 22), rand(8, 14), rand(0, 3), 0, TAU); c.fill(); } },
    decor: 'sakura'
  },
  hurda: {
    pack: { wall: 'rusty_metal_03', wallTint: '#e0d4c4', floor: 'concrete_tiles', crate: 'rusty_metal_03', crateTint: '#7f9a62', crateFrame: 'rgba(30,26,18,0.85)', detS: 1 / 130,
      wallFx(c, w, h) { for (let x = 0; x < w; x += 22) { c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(x, 0, 8, h); c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(x + 14, 0, 5, h); }
        for (let x = -h; x < w; x += 48) { c.fillStyle = '#e8b830'; c.beginPath(); c.moveTo(x, h); c.lineTo(x + 24, h); c.lineTo(x + 24 + 28, h - 28); c.lineTo(x + 28, h - 28); c.closePath(); c.fill(); }
        c.fillStyle = 'rgba(20,18,14,0.85)'; c.fillRect(0, h - 30, w, 2); } },
    sky: ['#6a6252', '#d0c098'], fogCol: '#b0a484', fog: [900, 4600], wallH: 130, amb: 0.54, dif: 0.6, lc: [1, 0.95, 0.84], light: [0.5, 0.75, 0.35],
    trim: [1, 0.74, 0.1], sun: { dir: [0.3, 0.4, -0.8], col: [1, 0.9, 0.7], size: 42 }, clouds: 5,
    floor: { style: 'concrete', bg: '#3a3830', floor: ['#7c786e', '#767268'], site: ['#8c8062', '#867a5c'], atk: ['#8c6052', '#865a4c'], def: ['#5c7c72', '#56766c'], water: '#5e7a24', low: '#6c685e', lines: '#f5c451', waterEm: [0.28, 0.55, 0.04] },
    wall(c, w, h) { c.fillStyle = '#8a5a3a'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(x, 0, 6, h); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x + 10, 0, 4, h); } },
    crate(c, w, h) { c.fillStyle = '#5a7a3a'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 10) { c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(x, 0, 4, h); } c.strokeStyle = '#2a3a1a'; c.lineWidth = 7; c.strokeRect(3, 3, w - 6, h - 6); },
    low(c, w, h) { c.fillStyle = '#5a5850'; c.fillRect(0, 0, w, h); for (let x = -h; x < w; x += 32) { c.fillStyle = '#e8b830'; c.beginPath(); c.moveTo(x, h); c.lineTo(x + 16, h); c.lineTo(x + 16 + h, 0); c.lineTo(x + h, 0); c.closePath(); c.fill(); } },
    decor: 'hurda'
  }
};

/* ---------- HARİTA TANIMLARI ----------
   Tüm haritalar büyük labirent haritalardır: tohumlu üreteçle sol yarı üretilir, sağ yarıya aynalanır
   (A ↔ B adil). Ortada doğuş odaları ve orta meydan; geri kalan alan çok yollu bağlı odalar,
   kıvrımlı koridorlar ve bol engelle doludur. Boyutlar ilk geniş sürümün her yönde 4 katıdır. */
const MAPS = [
  // Boyutlar: koşarak saldıran doğuşundan bölgeye ~18–25 sn,
  // A↔B dönüşü ~12–20 sn (Liman gibi geniş haritalarda ~25 sn). 1 karo = 2 m, koşu hızı 6,25 m/sn.
  { id: 'merkez', name: 'MERKEZ', desc: 'Kapalı tesis · derli toplu, dar dönüşler', w: 104, h: 76, theme: THEMES.merkez,
    gen: { room: [10, 16], corr: [4, 4], fill: 0.36, gap: 5, loops: 0.35, dens: 34, site: [20, 15], mid: [20, 14], obs: { crate: 5, low: 2, pillar: 2 }, water: 0,
      names: ['DEPO', 'LAB', 'JENERATÖR', 'SUNUCU', 'OFİS', 'HANGAR', 'KONTROL', 'ARŞİV'] } },
  { id: 'liman', name: 'LİMAN', desc: 'Konteyner limanı · geniş ve açık · gündüz', w: 140, h: 96, theme: THEMES.liman,
    gen: { room: [13, 22], corr: [5, 6], fill: 0.40, gap: 5, loops: 0.3, dens: 30, site: [26, 19], mid: [26, 18], obs: { crate: 7, low: 2, pillar: 1 }, water: 0.35,
      names: ['DOK', 'VİNÇ', 'GÜMRÜK', 'AMBAR', 'RIHTIM', 'TERSANE', 'İSKELE', 'YÜKLEME'] } },
  { id: 'col', name: 'ÇÖL HARABESİ', desc: 'Antik kalıntılar · geniş orta avlu', w: 120, h: 84, theme: THEMES.col,
    gen: { room: [11, 18], corr: [4, 5], fill: 0.37, gap: 5, loops: 0.35, dens: 30, site: [22, 17], mid: [30, 20], obs: { crate: 2, low: 5, pillar: 4 }, water: 0.08,
      names: ['MEZAR', 'SÜTUNLAR', 'KUYU', 'PAZAR', 'KERVANSARAY', 'HAN', 'ÇEŞME', 'HAMAM'] } },
  { id: 'buzul', name: 'BUZUL ÜSSÜ', desc: 'Kutup üssü · uzun hatlar, donmuş havuzlar', w: 120, h: 88, theme: THEMES.buzul,
    gen: { seed: 'v4', room: [11, 18], corr: [4, 5], fill: 0.37, gap: 5, loops: 0.3, dens: 30, site: [22, 17], mid: [22, 16], obs: { crate: 5, low: 3, pillar: 2 }, water: 0.3,
      names: ['LAB', 'HANGAR', 'RADAR', 'JENERATÖR', 'DEPO', 'REVİR', 'YAKIT', 'SERA'] } },
  { id: 'tapinak', name: 'ORMAN TAPINAĞI', desc: 'Tapınak şehri · dolambaçlı yollar, gölet', w: 128, h: 88, theme: THEMES.tapinak,
    gen: { seed: 'v4', room: [11, 18], corr: [4, 5], fill: 0.37, gap: 5, loops: 0.4, dens: 30, site: [22, 17], mid: [22, 16], obs: { crate: 2, low: 4, pillar: 3 }, water: 0.35,
      names: ['SUNAK', 'HARABE', 'KUYU', 'AĞAÇ EV', 'MAĞARA', 'KULE', 'BAHÇE', 'HEYKEL'] } },
  { id: 'neon', name: 'NEON ŞEHİR', desc: 'Gece şehri · sıkışık sokaklar, pasajlar', w: 108, h: 84, theme: THEMES.neon,
    gen: { room: [10, 16], corr: [4, 5], fill: 0.38, gap: 5, loops: 0.4, dens: 30, site: [20, 16], mid: [20, 14], obs: { crate: 4, low: 4, pillar: 2 }, water: 0.05,
      names: ['ÇARŞI', 'OTOPARK', 'METRO', 'SAHNE', 'KULÜP', 'OTEL', 'PASAJ', 'GARAJ'] } },
  // ---- 5 yeni dokulu harita (mevcutlar kadar büyük) ----
  { id: 'volkan', name: 'VOLKAN', desc: 'Lav gölleri ve bazalt kayalar · kızıl gökyüzü, uzakta tüten yanardağ', w: 124, h: 88, theme: THEMES.volkan,
    gen: { seed: 'v1', room: [11, 18], corr: [4, 5], fill: 0.37, gap: 5, loops: 0.35, dens: 30, site: [22, 17], mid: [24, 16], obs: { crate: 2, low: 4, pillar: 4 }, water: 0.3,
      names: ['KRATER', 'MAGMA', 'BAZALT', 'KÜL', 'OBSİDYEN', 'LAV TÜNELİ', 'GÖZETLEME', 'MADEN'] } },
  { id: 'ada', name: 'TROPİK ADA', desc: 'Palmiyeli kumsal ve lagün · geniş ve güneşli, her yerde su', w: 132, h: 92, theme: THEMES.ada,
    gen: { seed: 'v1', room: [12, 20], corr: [5, 6], fill: 0.39, gap: 5, loops: 0.35, dens: 32, site: [24, 18], mid: [26, 17], obs: { crate: 4, low: 3, pillar: 1 }, water: 0.45,
      names: ['İSKELE', 'BUNGALOV', 'LAGÜN', 'FENER', 'KULÜBE', 'MERCAN', 'PLAJ', 'BAR'] } },
  { id: 'uzay', name: 'UZAY ÜSSÜ', desc: 'Yörüngedeki istasyon · panelli koridorlar, gökte dev gezegen', w: 116, h: 84, theme: THEMES.uzay,
    gen: { seed: 'v2', room: [10, 16], corr: [4, 5], fill: 0.37, gap: 5, loops: 0.35, dens: 32, site: [21, 16], mid: [22, 15], obs: { crate: 5, low: 3, pillar: 2 }, water: 0.08,
      names: ['KÖPRÜ', 'REAKTÖR', 'HANGAR', 'LAB', 'KAPSÜL', 'KOMUTA', 'DEPO', 'SERA'] } },
  { id: 'sakura', name: 'SAKURA KÖYÜ', desc: 'Kiraz ağaçları ve pagodalar · dolambaçlı sokaklar, koi gölleri', w: 120, h: 88, theme: THEMES.sakura,
    gen: { seed: 'v1', room: [11, 17], corr: [4, 5], fill: 0.37, gap: 5, loops: 0.42, dens: 30, site: [22, 17], mid: [22, 16], obs: { crate: 2, low: 4, pillar: 3 }, water: 0.3,
      names: ['PAGODA', 'ÇAY EVİ', 'KÖPRÜ', 'BAHÇE', 'TAPINAK', 'DOJO', 'PAZAR', 'FENER'] } },
  { id: 'hurda', name: 'HURDALIK', desc: 'Paslı fabrika ve hurda yığınları · bacalar, zehirli atık havuzları', w: 128, h: 90, theme: THEMES.hurda,
    gen: { seed: 'v1', room: [11, 18], corr: [4, 6], fill: 0.39, gap: 5, loops: 0.33, dens: 28, site: [23, 17], mid: [24, 16], obs: { crate: 6, low: 3, pillar: 2 }, water: 0.15,
      names: ['PRES', 'FIRIN', 'VİNÇ', 'DEPO', 'BANT', 'KAZAN', 'ATÖLYE', 'BACA'] } }
];
for (const m of MAPS) m.build = function () { genBigMap(this); };

/* ---------- LABİRENT ÜRETECİ ---------- */
function genBigMap(m) {
  const P = m.gen, R = mulberry(strHash(m.id + ':labirent:' + (P.seed || 'v1')));
  const W = MW, H = MH, HW = W >> 1, midY = H >> 1;
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const I = (x, y) => y * W + x;
  const inb = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
  // sol yarıya yazılır (x < HW); sağ yarı en sonda aynalanır
  const put = (x, y, t, force) => { if (!inb(x, y) || x >= HW) return; const k = I(x, y); if (force || grid[k] === T_WALL) grid[k] = t; };
  const fillR = (x, y, w, h, t, force) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(i, j, t, force); };
  const rooms = [];
  const room = (x, y, w, h, t, kind) => {
    const r = { x, y, w, h, t, kind, cx: Math.min(HW - 1, x + (w >> 1)), cy: y + (h >> 1), deg: 0 };
    rooms.push(r); fillR(x, y, w, h, t, true); return r;
  };
  // anahtar alanlar
  const defR = room(HW - 9, 2, 18, 7, T_DEF, 'def');
  const atkR = room(HW - 9, H - 9, 18, 7, T_ATK, 'atk');
  const [mw2, mh2] = P.mid || [24, 16];
  const midR = room(HW - (mw2 >> 1), midY - (mh2 >> 1), mw2, mh2, T_FLOOR, 'mid');
  const [sw, sh] = P.site;
  const siteR = room(Math.round(W * (P.siteX || 0.24) - sw / 2), Math.round(H * 0.34 - sh / 2), sw, sh, T_A, 'site');
  // rastgele odalar
  const overl = (x, y, w, h, g) => rooms.some(r => x < r.x + r.w + g && x + w + g > r.x && y < r.y + r.h + g && y + h + g > r.y);
  const target = (HW - 2) * (H - 2) * P.fill;
  let area = rooms.reduce((a, r) => a + Math.min(r.w, HW - r.x) * r.h, 0);
  for (let t = 0; t < 6000 && area < target; t++) {
    let w = ri(P.room[0], P.room[1]); const h = ri(P.room[0], P.room[1]);
    const x = ri(2, HW - 4); if (x + w > HW) w = HW - x;
    const y = ri(2, H - 3 - h);
    if (w < 5 || overl(x, y, w, h, P.gap)) continue;
    room(x, y, w, h, T_FLOOR, 'room'); area += w * h;
  }
  // bağlantı grafiği: en yakın komşular + minimum yayılan ağaç + ek döngüler
  const n = rooms.length, cd = (a, b) => Math.hypot(a.cx - b.cx, (a.cy - b.cy) * 1.1);
  const cand = [], seen = new Set();
  for (let i = 0; i < n; i++) {
    const near = [];
    for (let j = 0; j < n; j++) if (j !== i) near.push([cd(rooms[i], rooms[j]), j]);
    near.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < Math.min(4, near.length); k++) { const j = near[k][1], key = Math.min(i, j) + ':' + Math.max(i, j); if (!seen.has(key)) { seen.add(key); cand.push([near[k][0], i, j]); } }
  }
  cand.sort((a, b) => a[0] - b[0]);
  const par = rooms.map((_, i) => i), find = a => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  const edges = [];
  const link = (i, j) => { edges.push([i, j]); rooms[i].deg++; rooms[j].deg++; par[find(i)] = find(j); };
  const used = new Set();
  for (const [, i, j] of cand) if (find(i) !== find(j)) { link(i, j); used.add(i + ':' + j); }
  for (const [d, i, j] of cand) if (!used.has(i + ':' + j) && d < 45 && R() < P.loops) { link(i, j); used.add(i + ':' + j); }
  // bileşenler hâlâ ayrıysa en yakın çiftlerle birleştir
  for (let guard = 0; guard < n; guard++) {
    const roots = new Set(rooms.map((_, i) => find(i))); if (roots.size <= 1) break;
    let best = null;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (find(i) !== find(j)) { const d = cd(rooms[i], rooms[j]); if (!best || d < best[0]) best = [d, i, j]; }
    link(best[1], best[2]);
  }
  // önemli alanların en az bu kadar çıkışı olsun (sol yarıda; aynalanınca ikiye katlanır)
  const minDeg = (r, k) => {
    const i = rooms.indexOf(r), near = rooms.map((o, j) => [cd(r, o), j]).filter(a => a[1] !== i).sort((a, b) => a[0] - b[0]);
    for (const [, j] of near) { if (r.deg >= k) break; const key = Math.min(i, j) + ':' + Math.max(i, j); if (used.has(key) || used.has(j + ':' + i) || used.has(i + ':' + j)) continue; used.add(key); link(i, j); }
  };
  minDeg(defR, 3); minDeg(atkR, 3); minDeg(midR, 3); minDeg(siteR, 3);
  // koridor kaz (L veya Z biçimli, kıvrımlı: uzun düz görüş hatlarını azaltır)
  const pt = r => [ri(r.x + 1, Math.max(r.x + 1, Math.min(HW - 1, r.x + r.w - 2))), ri(r.y + 1, r.y + r.h - 2)];
  for (const [i, j] of edges) {
    const a = rooms[i], b = rooms[j], cw = ri(P.corr[0], P.corr[1]);
    const [x1, y1] = pt(a), [x2, y2] = pt(b);
    const hseg = (xa, xb, y) => fillR(Math.min(xa, xb), y, Math.abs(xb - xa) + cw, cw, T_FLOOR);
    const vseg = (x, ya, yb) => fillR(x, Math.min(ya, yb), cw, Math.abs(yb - ya) + cw, T_FLOOR);
    const r = R();
    if (r < 0.3) { hseg(x1, x2, y1); vseg(x2, y1, y2); }
    else if (r < 0.6) { vseg(x1, y1, y2); hseg(x1, x2, y2); }
    else if (r < 0.8) { const mx = ri(Math.min(x1, x2), Math.max(x1, x2)); hseg(x1, mx, y1); vseg(mx, y1, y2); hseg(mx, x2, y2); }
    else { const my = ri(Math.min(y1, y2), Math.max(y1, y2)); vseg(x1, y1, my); hseg(x1, x2, my); vseg(x2, my, y2); }
  }
  // orta meydan: iki doğuşun birbirini görmesini kesen dev blok + alçak siperler
  fillR(HW - 4, midY - 4, 4, 8, T_WALL, true);
  fillR(HW - Math.min(10, (mw2 >> 1) - 2), midY - 6, 1, 3, T_LOW, true); fillR(HW - Math.min(10, (mw2 >> 1) - 2), midY + 3, 1, 3, T_LOW, true);
  fillR(HW - 7, midY - 1, 2, 2, T_BOX, true);
  m.centerBlock = [HW - 4, midY - 4, 8, 8];
  // ---- bağlantı denetimi (sol yarı) ----
  const startK = I(atkR.x + 2, atkR.y + 2);
  const openCount = () => { let c = 0; for (let y = 1; y < H - 1; y++) for (let x = 1; x < HW; x++) if (!solidT(x, y)) c++; return c; };
  const reach = () => {
    const seen2 = new Uint8Array(W * H), q = [startK]; seen2[startK] = 1; let c = 0;
    for (let h = 0; h < q.length; h++) {
      const k = q[h], x = k % W, y = (k / W) | 0; c++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx >= HW || solidT(nx, ny)) continue;
        const nk = I(nx, ny); if (!seen2[nk]) { seen2[nk] = 1; q.push(nk); }
      }
    }
    return { c, seen: seen2 };
  };
  // kopuk parçaları ana ağa bağla
  for (let guard = 0; guard < 40; guard++) {
    const { c, seen: sn } = reach(); if (c >= openCount()) break;
    let lone = -1; for (let k = 0; k < W * H && lone < 0; k++) { const x = k % W; if (x < HW && x > 0 && !solidT(x, (k / W) | 0) && !sn[k]) lone = k; }
    if (lone < 0) break;
    const lx = lone % W, ly = (lone / W) | 0; let best = null;
    for (let k = 0; k < W * H; k++) if (sn[k]) { const d = Math.abs(k % W - lx) + Math.abs(((k / W) | 0) - ly); if (!best || d < best[0]) best = [d, k % W, (k / W) | 0]; }
    fillR(Math.min(lx, best[1]), ly, Math.abs(best[1] - lx) + 2, 2, T_FLOOR); fillR(best[1], Math.min(ly, best[2]), 2, Math.abs(best[2] - ly) + 2, T_FLOOR);
  }
  // ---- engeller (her oda için; erişimi bozarsa geri alınır) ----
  const O = P.obs, tot = O.crate + O.low + O.pillar;
  const free = (x, y, w, h, okSite) => {
    for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) {
      if (!inb(i, j) || i >= HW) return false;
      const t = grid[I(i, j)]; if (!(t === T_FLOOR || (okSite && t === T_A))) return false;
    }
    return true;
  };
  let baseOpen = openCount();
  // havuz/gölet odaları: su oranına göre en geniş odalardan seçilir (oranı > 0 olan her haritada en az bir tane)
  const pools = new Set();
  if (P.water > 0) {
    const pc = rooms.filter(r => r.kind === 'room' && Math.min(HW - 1, r.x + r.w) - r.x >= 9 && r.h >= 9).sort((a, b) => b.w * b.h - a.w * a.h);
    const nP = Math.max(1, Math.round(pc.length * P.water));
    for (const r of pc.slice(0, Math.min(pc.length, nP + 2)).sort(() => R() - 0.5).slice(0, nP)) pools.add(r);
  }
  for (const r of rooms) {
    if (r.kind === 'def' || r.kind === 'atk') continue;
    const x0 = r.x + 2, x1 = Math.min(HW - 1, r.x + r.w - 3), y0 = r.y + 2, y1 = r.y + r.h - 3;
    if (x1 - x0 < 2 || y1 - y0 < 2) continue;
    const changed = [];
    const set = (x, y, w, h, t) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const k = I(i, j); changed.push([k, grid[k]]); grid[k] = t; } };
    const site = r.kind === 'site';
    // su havuzu
    if (!site && pools.has(r)) {
      const px = r.x + 3, py = r.y + 3, pw = Math.min(HW - 1, r.x + r.w - 4) - px + 1, ph = r.h - 6;
      if (pw >= 3 && ph >= 3 && free(px, py, pw, ph, false)) set(px, py, pw, ph, T_WATER);
    }
    const cnt = Math.round(((x1 - x0 + 1) * (y1 - y0 + 1)) / P.dens) + (site ? 3 : 0);
    for (let k = 0, tries = 0; k < cnt && tries < cnt * 12; tries++) {
      const z = R() * tot;
      let t, w, h;
      if (z < O.crate) { t = T_BOX; [w, h] = [[1, 1], [2, 1], [1, 2], [2, 2]][ri(0, 3)]; }
      else if (z < O.crate + O.low) { t = T_LOW; [w, h] = [[3, 1], [1, 3], [2, 1], [1, 2], [4, 1]][ri(0, 4)]; }
      else { if (site) continue; t = T_WALL; [w, h] = [[1, 1], [2, 2], [1, 1]][ri(0, 2)]; }
      const x = ri(x0, Math.max(x0, x1 - w + 1)), y = ri(y0, Math.max(y0, y1 - h + 1));
      if (!free(x, y, w, h, site)) continue;
      set(x, y, w, h, t); k++;
    }
    if (!changed.length) continue;
    const nowOpen = openCount();
    if (reach().c < nowOpen) { for (let q = changed.length - 1; q >= 0; q--) grid[changed[q][0]] = changed[q][1]; }
    else baseOpen = nowOpen;
  }
  // ---- REBOOT İSTASYONU: bölgenin duvar kenarında, girişlerden en uzak karo ----
  {
    const inS = (x, y) => x >= siteR.x && x < siteR.x + siteR.w && y >= siteR.y && y < siteR.y + siteR.h;
    const opens = [];
    for (let y = siteR.y - 1; y <= siteR.y + siteR.h; y++) for (let x = siteR.x - 1; x <= Math.min(HW - 1, siteR.x + siteR.w); x++)
      if (!inS(x, y) && inb(x, y) && grid[I(x, y)] !== T_WALL && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inS(x + dx, y + dy))) opens.push([x, y]);
    let best = null, bs = -1;
    for (let y = siteR.y; y < siteR.y + siteR.h; y++) for (let x = siteR.x; x < Math.min(HW, siteR.x + siteR.w); x++) {
      if (grid[I(x, y)] !== T_A) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (grid[I(x - dx, y - dy)] !== T_WALL) continue;           // arkası duvar
        if (grid[I(x + dx, y + dy)] !== T_A || grid[I(x + 2 * dx, y + 2 * dy)] !== T_A) continue; // önü açık
        let md = 1e9; for (const o of opens) md = Math.min(md, Math.abs(o[0] - x) + Math.abs(o[1] - y));
        const sc = Math.min(md, 12) + R() * 0.5;
        if (md >= 4 && sc > bs) { bs = sc; best = [x, y, dx, dy]; }
      }
    }
    if (best) { grid[I(best[0], best[1])] = T_BOX; m.rbTiles = [best, [W - 1 - best[0], best[1], -best[2], best[3]]]; }
    else m.rbTiles = [];
  }
  // ---- aynala ----
  for (let y = 0; y < H; y++) for (let x = 0; x < HW; x++) { let t = grid[I(x, y)]; if (t === T_A) t = T_B; grid[I(W - 1 - x, y)] = t; }
  // ---- bot verisi için alanlar ----
  const ents = [];
  const border = [];
  for (let x = siteR.x - 1; x <= siteR.x + siteR.w; x++) { border.push([x, siteR.y - 1], [x, siteR.y + siteR.h]); }
  for (let y = siteR.y; y < siteR.y + siteR.h; y++) { border.push([siteR.x - 1, y], [siteR.x + siteR.w, y]); }
  for (const p of border) if (inb(p[0], p[1]) && !solidT(p[0], p[1]) && grid[I(p[0], p[1])] !== T_A && !ents.some(e => Math.hypot(e[0] - p[0], e[1] - p[1]) < 5)) ents.push(p);
  // saldıranlara en yakın girişler önce
  const dA0 = bfsFrom(T_ATK);
  ents.sort((a, b) => (dA0[I(a[0], a[1])] < 0 ? 1e9 : dA0[I(a[0], a[1])]) - (dA0[I(b[0], b[1])] < 0 ? 1e9 : dA0[I(b[0], b[1])]));
  m.entries = (ents.length ? ents : [[siteR.cx, siteR.y + siteR.h]]).slice(0, 4);
  m.mid = [HW - 1, midY - Math.min(7, (mh2 >> 1) - 1)];
  const nearMid = m.entries.slice().sort((a, b) => Math.hypot(a[0] - HW, a[1] - midY) - Math.hypot(b[0] - HW, b[1] - midY))[0];
  m.midRoute = [[HW - 1, midY + Math.min(7, (mh2 >> 1) - 1)], [HW - Math.min(12, (mw2 >> 1)), midY], nearMid.slice()];
  const side = rooms.filter(r => r.kind === 'room' && r.cx < HW - 12 && r.cx > W * 0.12).sort((a, b) => Math.abs(a.cy - midY * 1.15) - Math.abs(b.cy - midY * 1.15));
  const orb = side.length ? side[0] : midR;
  m.orbs = [[orb.cx, orb.cy], [W - 1 - orb.cx, orb.cy]];
  const names = P.names.slice(), labels = [['ORTA', HW, midY - 8.5]];
  const named = rooms.filter(r => r.kind === 'room' && r.w >= 9 && r.h >= 9 && r.x + r.w < HW - 1).sort(() => R() - 0.5).slice(0, Math.min(14, names.length * 2));
  named.forEach((r, k) => { const nm = names[k % names.length] + (k >= names.length ? ' 2' : ''); labels.push(['A ' + nm, r.cx + 0.5, r.cy + 0.5], ['B ' + nm, W - 1 - r.cx + 0.5, r.cy + 0.5]); });
  m.labels = labels;
}

/* ---------- otomatik bot noktaları ---------- */
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h; }
function bfsFrom(type) {
  const d = new Int32Array(MW * MH).fill(-1), q = [];
  for (let i = 0; i < MW * MH; i++) if (grid[i] === type) { d[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % MW, y = (c / MW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (solidT(nx, ny)) continue;
      const ni = ny * MW + nx;
      if (d[ni] < 0) { d[ni] = d[c] + 1; q.push(ni); }
    }
  }
  return d;
}
function deriveMapData(m) {
  const R = mulberry(strHash(m.id));
  const dA = bfsFrom(T_ATK), dD = bfsFrom(T_DEF);
  const idx = (x, y) => y * MW + x;
  const free1 = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (solidT(x + i, y + j)) return false; return true; };
  const tiles = pred => { const out = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (pred(x, y)) out.push([x, y]); return out; };
  const tdist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const spread = (arr, n) => {
    if (!arr.length) return [];
    const out = [arr[Math.floor(R() * arr.length)]];
    while (out.length < n && out.length < arr.length) {
      let best = null, bd = -1;
      for (const c of arr) { let md = 1e9; for (const o of out) md = Math.min(md, tdist(c, o)); if (md > bd) { bd = md; best = c; } }
      out.push(best);
    }
    return out;
  };
  const tcx = p => (p[0] + 0.5) * TILE, tcy = p => (p[1] + 0.5) * TILE;
  const mir = p => [MW - 1 - p[0], p[1]];
  const centroid = list => { let sx = 0, sy = 0; for (const p of list) { sx += p[0]; sy += p[1]; } return [sx / list.length, sy / list.length]; };
  const nearestOf = (list, pt) => { let b = list[0], bd = 1e9; for (const c of list) { const d = tdist(c, pt); if (d < bd) { bd = d; b = c; } } return b; };
  const sites = {};
  for (const s of ['A', 'B']) {
    const tt = s === 'A' ? T_A : T_B;
    const st = tiles((x, y) => grid[idx(x, y)] === tt);
    const open = st.filter(p => free1(p[0], p[1]));
    const center = nearestOf(open.length ? open : st, centroid(st));
    const entries = (s === 'A' ? m.entries : m.entries.map(mir)).map(e => e.slice());
    const plant = spread(open, 6);
    const cand = tiles((x, y) => !solidT(x, y) && dD[idx(x, y)] >= 0 && tdist([x, y], center) <= 14 && grid[idx(x, y)] !== T_ATK && grid[idx(x, y)] !== T_DEF && (grid[idx(x, y)] === tt || dD[idx(x, y)] <= dA[idx(x, y)] + 3));
    const hold = [];
    for (let pass = 0; pass < 2 && hold.length < 3; pass++) for (const e of entries) {
      if (hold.length >= 3) break;
      let best = null, bs = -1e9;
      for (const c of cand) {
        const d = tdist(c, e);
        if (d < 5 || d > 17 || hold.some(h => tdist(h, c) < 4)) continue;
        if (!losClear(tcx(c), tcy(c), tcx(e), tcy(e), true, EYE, 40)) continue;
        const sc = (wallAdj[idx(c[0], c[1])] > 0 ? 3 : 0) - Math.abs(d - 10) * 0.25 + (dA[idx(c[0], c[1])] - dD[idx(c[0], c[1])]) * 0.04 + R() * 1.5;
        if (sc > bs) { bs = sc; best = c; }
      }
      if (best) hold.push([best[0], best[1], e[0], e[1]]);
    }
    if (!hold.length) hold.push([center[0], center[1], entries[0][0], entries[0][1]]);
    const pc = tiles((x, y) => !solidT(x, y) && dA[idx(x, y)] >= 0 && grid[idx(x, y)] !== T_ATK && grid[idx(x, y)] !== T_DEF && tdist([x, y], center) >= 5 && tdist([x, y], center) <= 13 && dA[idx(x, y)] <= dD[idx(x, y)] + 6 && wallAdj[idx(x, y)] > 0 && losClear(tcx([x, y]), tcy([x, y]), tcx(center), tcy(center), true, EYE, 40));
    let post = spread(pc, 4).map(p => [p[0], p[1], center[0], center[1]]);
    if (!post.length) post = plant.slice(0, 3).map(p => [p[0], p[1], center[0], center[1]]);
    sites[s] = {
      center, plant, clear: plant.concat(spread(open, 3)), hold, post,
      smokeAtk: hold.slice(0, 2).map(h => [h[0], h[1]]), smokeDef: [entries[0]], entry: entries,
      routeMain: [], routeMid: s === 'A' ? m.midRoute.map(p => p.slice()) : m.midRoute.map(mir)
    };
  }
  const defT = tiles((x, y) => grid[idx(x, y)] === T_DEF), atkT = tiles((x, y) => grid[idx(x, y)] === T_ATK);
  const defC = nearestOf(defT, centroid(defT)), atkC = nearestOf(atkT, centroid(atkT));
  const mc = m.mid || [MW >> 1, MH >> 1];
  const mh = spread(tiles((x, y) => !solidT(x, y) && tdist([x, y], mc) <= 8 && dD[idx(x, y)] >= 0 && dD[idx(x, y)] <= dA[idx(x, y)] && wallAdj[idx(x, y)] > 0), 3);
  const midHold = (mh.length ? mh : [mc]).map(p => [p[0], p[1], atkC[0], atkC[1]]);
  return {
    sites, midHold,
    spawns: { atk: spread(atkT.filter(p => free1(p[0], p[1])), 10), def: spread(defT.filter(p => free1(p[0], p[1])), 10) },
    orbs: m.orbs, labels: m.labels, defCenter: defC, atkCenter: atkC
  };
}

/* ---------- harita yükleme ---------- */
let CUR_MAP = -1, THEME = THEMES.merkez;
/* Duvar içinde kalan bot noktalarını en yakın yürünebilir karoya taşı */
function sanitizeMapData(D) {
  const okT = (x, y) => x > 0 && y > 0 && x < MW - 1 && y < MH - 1 && !solidT(x, y);
  const fix = p => {
    if (!p || okT(p[0], p[1])) return;
    for (let r = 1; r < 12; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
      if (okT(p[0] + i, p[1] + j)) { p[0] += i; p[1] += j; return; }
    }
  };
  const all = a => { if (a) for (const p of a) fix(p); };
  for (const k of ['A', 'B']) { const st = D.sites[k]; fix(st.center); for (const key of ['plant', 'clear', 'hold', 'post', 'smokeAtk', 'smokeDef', 'entry', 'routeMain', 'routeMid']) all(st[key]); }
  all(D.midHold); all(D.orbs); all(D.spawns.atk); all(D.spawns.def); fix(D.defCenter); fix(D.atkCenter);
}
/* CAN KÜRELERİ: saldıran/savunan doğuşlarına uzaklık oranına göre 3 bant (saldırana yakın, orta, savunana yakın),
   sol yarıda seçilip sağa aynalanır → her haritada 6 küre, iki takım için de adil */
function placeHeal() {
  const dA = bfsFrom(T_ATK), dD = bfsFrom(T_DEF), HW = MW >> 1, out = [];
  const okT = (x, y) => { if (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1) return false; const t = grid[y * MW + x]; return t === T_FLOOR || t === T_A || t === T_B; };
  const open = (x, y) => okT(x, y) && okT(x + 1, y) && okT(x - 1, y) && okT(x, y + 1) && okT(x, y - 1);
  const avoid = (MAPDATA.reboot || []).map(r => [r.tx, r.ty]).concat(MAPDATA.orbs || []);
  for (const tr of [0.38, 0.5, 0.62]) {
    let best = null, bs = 1e9;
    for (let y = 2; y < MH - 2; y++) for (let x = 2; x < HW - 1; x++) {
      const k = y * MW + x, a = dA[k], d = dD[k];
      if (a < 10 || d < 10) continue;
      const r = a / (a + d);
      if (Math.abs(r - tr) > 0.05 || !open(x, y) || !open(MW - 1 - x, y)) continue;
      if (avoid.some(p => Math.hypot(p[0] - x, p[1] - y) < 5) || out.some(p => Math.hypot(p[0] - x, p[1] - y) < 12)) continue;
      const s = Math.abs(x - MW * 0.28) + Math.abs(r - tr) * 60 + (wallAdj[k] > 0 ? 0 : 2);
      if (s < bs) { bs = s; best = [x, y]; }
    }
    if (best) out.push(best);
  }
  const res = [];
  for (const [x, y] of out) res.push([x, y], [MW - 1 - x, y]);
  return res.map(([x, y], i) => ({ id: i, tx: x, ty: y, x: (x + 0.5) * TILE, y: (y + 0.5) * TILE }));
}
/* MAĞAZA HOPARLÖRLERİ: her doğuş alanında, merkeze en yakın duvara asılı */
function placeSpeakers() {
  const res = [];
  for (const [T, cen] of [[T_ATK, MAPDATA.atkCenter], [T_DEF, MAPDATA.defCenter]]) {
    let best = null, bd = 1e9;
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
      if (grid[y * MW + x] !== T) continue;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        if (grid[(y + dy) * MW + x + dx] !== T_WALL || solidT(x - dx, y - dy)) continue;
        const d = Math.hypot(x - cen[0], y - cen[1]);
        if (d < bd) { bd = d; best = { tx: x, ty: y, dx, dy }; }
      }
    }
    if (best) res.push({ side: T === T_ATK ? 'atk' : 'def', x: (best.tx + 0.5 + best.dx * 0.5) * TILE - best.dx * 12, y: (best.ty + 0.5 + best.dy * 0.5) * TILE - best.dy * 12, ang: Math.atan2(-best.dy, -best.dx) });
  }
  return res;
}
/* Raunt ve bomba süreleri haritadaki yürüme mesafesine göre */
function mapTimers() {
  const dA = bfsFrom(T_ATK), dS = bfsFrom(T_A);
  const at = p => { const k = p[1] * MW + p[0]; return dA[k] >= 0 ? dA[k] : 0; };
  const toSite = Math.max(at(MAPDATA.sites.A.center), at(MAPDATA.sites.B.center));
  const bc = MAPDATA.sites.B.center, ab = dS[bc[1] * MW + bc[0]] >= 0 ? dS[bc[1] * MW + bc[0]] : toSite;
  const sec = tiles => tiles * TILE * 0.82 / RUN; // 4 yönlü BFS mesafesi çaprazlardan biraz uzundur
  ROUND_TIME = Math.round(clamp(sec(toSite) * 1.9 + 45, 100, 420) / 5) * 5;
  SPIKE_TIME = Math.round(clamp(sec(ab) + DEFUSE_TIME + 35, 55, 240) / 5) * 5;
}
function loadMap(i) {
  i = clamp(i | 0, 0, MAPS.length - 1);
  PKMAP = null; PKNAV = null;
  const m = MAPS[i];
  setMapSize(m.w, m.h);
  grid.fill(T_WALL);
  m.build();
  // orta alan görüş kesici duvarlar
  if (m.blocks) for (const [bx, by, bw, bh] of m.blocks) for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) grid[y * MW + x] = T_WALL;
  computeWallAdj();
  THEME = m.theme; WALL_H = THEME.wallH;
  MAPDATA = m.data ? m.data() : deriveMapData(m);
  sanitizeMapData(MAPDATA);
  MAPDATA.reboot = (m.rbTiles || []).map(([x, y, dx, dy], i) => ({ site: i === 0 ? 'A' : 'B', tx: x, ty: y, dx, dy,
    x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, ax: (x + dx + 0.5) * TILE, ay: (y + dy + 0.5) * TILE }));
  MAPDATA.heal = placeHeal();
  MAPDATA.speakers = placeSpeakers();
  mapTimers();
  CUR_MAP = i;
  if (typeof onMapLoaded === 'function') onMapLoaded();
  return m;
}
