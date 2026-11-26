/* =====================================================================
   02k · SİLAH SKİNİ DESENLERİ
   Skinde pat varsa silahın ana gövdesi bu desenle kaplanır (3B: doku, mağaza: 2B desen).
   · Desenler 128×128 kesintisiz döşenir, skin kimliğiyle tohumlanır: her cihazda aynı çıkar.
   · pg: desenin parlak çizgileri kendi ışığını verir · flow: [u, v] desen akar (sn başına döşeme)
   ===================================================================== */
const PAT_S = 128;
const PAT_N = {
  camo: 'Kamuflaj', digi: 'Dijital kamuflaj', waves: 'Dalga deseni', petal: 'Çiçek deseni', bands: 'Şeritli', brushed: 'Fırçalı metal',
  crack: 'Çatlak deseni', scale: 'Pul deseni', splat: 'Sıçrama deseni', grid: 'Neon ızgara', bolt: 'Şimşek deseni', circuit: 'Devre deseni',
  leaf: 'Varak deseni', damask: 'Damask deseni', carbon: 'Karbon örgü', rust: 'Pas deseni', hex: 'Petek deseni', facet: 'Kesme taş',
  aurora: 'Aurora deseni', smoke: 'Duman deseni', plasma: 'Plazma deseni', hazard: 'Tehlike şeridi', flame: 'Alev deseni', stars: 'Yıldızlı',
  flake: 'Kar tanesi', tiger: 'Kaplan deseni'
};
function _prng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function _hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
const _hx2 = c => '#' + c.slice(0, 3).map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
const _mixH = (a, b, k) => { const x = hexRGB(a), y = hexRGB(b); return _hx2([lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k)]); };
const _shH = (a, k) => { const x = hexRGB(a); return _hx2([x[0] * k, x[1] * k, x[2] * k]); };
const _rgba = (h, al) => { const x = hexRGB(h); return 'rgba(' + Math.round(x[0] * 255) + ',' + Math.round(x[1] * 255) + ',' + Math.round(x[2] * 255) + ',' + al + ')'; };
/* kenarlardan taşan şekil, karşı kenarda da çizilir (kesintisiz döşeme) */
function _wrap(fn) { for (const dx of [-PAT_S, 0, PAT_S]) for (const dy of [-PAT_S, 0, PAT_S]) fn(dx, dy); }
/* düzensiz yuvarlak leke (noktalar bir kez üretilir, kopyalarda aynı kalır) */
function _blobPts(R, cx, cy, r, n) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * (0.65 + R() * 0.6); p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * (0.7 + R() * 0.3)]); } return p; }
function _smooth(g, p, dx, dy) {
  g.beginPath(); const n = p.length, m = (i) => [(p[i % n][0] + p[(i + 1) % n][0]) / 2 + dx, (p[i % n][1] + p[(i + 1) % n][1]) / 2 + dy];
  const s = m(0); g.moveTo(s[0], s[1]);
  for (let i = 1; i <= n; i++) { const q = p[i % n], e = m(i); g.quadraticCurveTo(q[0] + dx, q[1] + dy, e[0], e[1]); }
  g.closePath(); g.fill();
}
/* rastgele yürüyen kırık çizgi (çatlak, şimşek, dal) */
function _walk(R, x, y, n, step, turn, ang) { const p = [[x, y]]; let a = ang === undefined ? R() * TAU : ang; for (let i = 0; i < n; i++) { a += (R() - 0.5) * turn; x += Math.cos(a) * step; y += Math.sin(a) * step; p.push([x, y]); } return p; }
function _strokeP(g, p, dx, dy) { g.beginPath(); g.moveTo(p[0][0] + dx, p[0][1] + dy); for (let i = 1; i < p.length; i++) g.lineTo(p[i][0] + dx, p[i][1] + dy); g.stroke(); }

const PATGEN = {
  camo(g, C, R) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    for (const col of [C.x[0] || _mixH(C.m, C.d, 0.5), C.d, C.a]) {
      g.fillStyle = col;
      for (let i = 0; i < 7; i++) { const p = _blobPts(R, R() * PAT_S, R() * PAT_S, 9 + R() * 14, 9); _wrap((dx, dy) => _smooth(g, p, dx, dy)); }
    }
  },
  digi(g, C, R) {
    const cs = 8, n = PAT_S / cs, cols = [C.d, C.a, C.x[0] || _mixH(C.m, C.d, 0.5)];
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    for (let k = 0; k < 34; k++) {
      g.fillStyle = cols[k % 3]; let x = Math.floor(R() * n), y = Math.floor(R() * n);
      for (let s = 0; s < 6 + R() * 6; s++) { g.fillRect(((x % n) + n) % n * cs, ((y % n) + n) % n * cs, cs, cs); if (R() < 0.5) x += R() < 0.5 ? 1 : -1; else y += R() < 0.5 ? 1 : -1; }
    }
  },
  waves(g, C, R) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    const f = [1, 2, 1, 3], cols = [C.d, C.a, C.x[0] || _mixH(C.m, C.a, 0.5), C.d];
    for (let k = 0; k < 8; k++) {
      const y0 = k * 16, A = 3 + R() * 4, ph = R() * TAU, fr = f[k % 4], th = 3 + R() * 5;
      g.fillStyle = cols[k % 4];
      _wrap((dx, dy) => { if (dx) return; g.beginPath(); for (let x = 0; x <= PAT_S; x += 4) g.lineTo(x, y0 + dy + Math.sin(x / PAT_S * TAU * fr + ph) * A); for (let x = PAT_S; x >= 0; x -= 4) g.lineTo(x, y0 + dy + th + Math.sin(x / PAT_S * TAU * fr + ph + 0.6) * A); g.closePath(); g.fill(); });
    }
    if (C.x[1]) { g.strokeStyle = C.x[1]; g.lineWidth = 0.8; for (let k = 0; k < 8; k++) { const y0 = k * 16 + 8, ph = R() * TAU; _wrap((dx, dy) => { if (dx) return; g.beginPath(); for (let x = 0; x <= PAT_S; x += 4) g.lineTo(x, y0 + dy + Math.sin(x / PAT_S * TAU * 2 + ph) * 2.5); g.stroke(); }); } }
  },
  petal(g, C, R) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    g.strokeStyle = C.d; g.lineWidth = 1.6; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const p = _walk(R, R() * PAT_S, R() * PAT_S, 10, 7, 1.2); _wrap((dx, dy) => _strokeP(g, p, dx, dy)); }
    for (let i = 0; i < 16; i++) {
      const x = R() * PAT_S, y = R() * PAT_S, r = 3 + R() * 3, rot = R() * TAU, col = i % 3 ? C.a : (C.x[0] || '#ffffff');
      _wrap((dx, dy) => { for (let k = 0; k < 5; k++) { const a = rot + k / 5 * TAU; g.fillStyle = col; g.beginPath(); g.ellipse(x + dx + Math.cos(a) * r, y + dy + Math.sin(a) * r, r * 0.9, r * 0.5, a, 0, TAU); g.fill(); } g.fillStyle = C.x[1] || '#ffd166'; g.beginPath(); g.arc(x + dx, y + dy, r * 0.4, 0, TAU); g.fill(); });
    }
  },
  bands(g, C) {
    const gr = g.createLinearGradient(0, 0, 0, PAT_S), cs = [C.m, C.a, C.d, C.x[0] || C.m, C.m];
    cs.forEach((c, i) => gr.addColorStop(i / (cs.length - 1), c)); g.fillStyle = gr; g.fillRect(0, 0, PAT_S, PAT_S);
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < PAT_S; y += 8) g.fillRect(0, y, PAT_S, 1.5);
  },
  brushed(g, C, R) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    for (let i = 0; i < 260; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,' + R() * 0.25 + ')' : 'rgba(0,0,0,' + R() * 0.18 + ')'; g.fillRect(0, R() * PAT_S, PAT_S, 0.6 + R() * 0.8); }
  },
  crack(g, C, R) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    g.fillStyle = _rgba(C.d, 0.35); for (let i = 0; i < 10; i++) { const p = _blobPts(R, R() * PAT_S, R() * PAT_S, 8 + R() * 16, 8); _wrap((dx, dy) => _smooth(g, p, dx, dy)); }
    g.lineCap = 'round'; g.lineJoin = 'round';
    const lines = []; for (let i = 0; i < 7; i++) { const p = _walk(R, R() * PAT_S, R() * PAT_S, 9, 7, 1.4); lines.push(p); const b = p[Math.floor(R() * p.length)]; lines.push(_walk(R, b[0], b[1], 4, 6, 1.6)); }
    for (const [w, col] of [[3.2, C.a], [1.1, C.x[0] || _mixH(C.a, '#ffffff', 0.55)]]) { g.strokeStyle = col; g.lineWidth = w; for (const p of lines) _wrap((dx, dy) => _strokeP(g, p, dx, dy)); }
  },
  scale(g, C) {
    g.fillStyle = C.d; g.fillRect(0, 0, PAT_S, PAT_S);
    for (let row = -1; row <= 9; row++) for (let col = -1; col <= 8; col++) {
      const x = col * 16 + (row % 2 ? 8 : 0), y = row * 14;
      const gr = g.createRadialGradient(x, y - 4, 1, x, y, 11); gr.addColorStop(0, _mixH(C.m, '#ffffff', 0.15)); gr.addColorStop(0.75, C.m); gr.addColorStop(1, _shH(C.m, 0.55));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 10.5, 0, Math.PI); g.lineTo(x - 10.5, y - 6); g.lineTo(x + 10.5, y - 6); g.closePath(); g.fill();
      g.strokeStyle = C.a; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, 10.5, 0.15, Math.PI - 0.15); g.stroke();
    }
  },
  splat(g, C, R) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    for (let i = 0; i < 9; i++) {
      const x = R() * PAT_S, y = R() * PAT_S, r = 4 + R() * 9, col = i % 4 ? C.a : C.d, drops = [];
      for (let k = 0; k < 9; k++) { const a = R() * TAU, d = r * (1.1 + R() * 1.6); drops.push([x + Math.cos(a) * d, y + Math.sin(a) * d, 0.8 + R() * 2.2, a]); }
      const p = _blobPts(R, x, y, r, 10);
      _wrap((dx, dy) => { g.fillStyle = col; _smooth(g, p, dx, dy); for (const [px, py, s, a] of drops) { g.beginPath(); g.arc(px + dx, py + dy, s, 0, TAU); g.fill(); g.strokeStyle = col; g.lineWidth = s * 0.7; g.beginPath(); g.moveTo(x + dx + Math.cos(a) * r * 0.8, y + dy + Math.sin(a) * r * 0.8); g.lineTo(px + dx, py + dy); g.stroke(); } });
    }
  },
  grid(g, C, R) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    for (const [w, al] of [[4, 0.18], [1.4, 1]]) { g.strokeStyle = _rgba(C.a, al); g.lineWidth = w; for (let i = 0; i <= PAT_S; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, PAT_S); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(PAT_S, i); g.stroke(); } }
    g.fillStyle = C.x[0] || '#ffffff'; for (let i = 0; i < 10; i++) { const x = Math.floor(R() * 8) * 16, y = Math.floor(R() * 8) * 16; _wrap((dx, dy) => { g.beginPath(); g.arc(x + dx, y + dy, 2.2, 0, TAU); g.fill(); }); }
  },
  bolt(g, C, R) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S); g.lineJoin = 'miter';
    const L = []; for (let i = 0; i < 10; i++) { const a = R() * TAU, p = [[R() * PAT_S, R() * PAT_S]]; for (let k = 0; k < 8; k++) { const q = p[p.length - 1], aa = a + (k % 2 ? 0.9 : -0.9) + (R() - 0.5) * 0.5; p.push([q[0] + Math.cos(aa) * 9, q[1] + Math.sin(aa) * 9]); } L.push(p); }
    for (const [w, col] of [[4, _rgba(C.a, 0.3)], [1.8, C.a], [0.7, '#ffffff']]) { g.strokeStyle = col; g.lineWidth = w; for (const p of L) _wrap((dx, dy) => _strokeP(g, p, dx, dy)); }
  },
  circuit(g, C, R) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S); g.lineCap = 'round'; g.lineJoin = 'round';
    const T = [];
    for (let i = 0; i < 16; i++) {
      let x = Math.floor(R() * 16) * 8, y = Math.floor(R() * 16) * 8; const p = [[x, y]], dir = Math.floor(R() * 4);
      for (let k = 0; k < 3 + R() * 4; k++) { const d = (dir + (R() < 0.35 ? (R() < 0.5 ? 1 : -1) : 0) + 4) % 4, l = 8 * (1 + Math.floor(R() * 3)); x += [l, 0, -l, 0][d]; y += [0, l, 0, -l][d]; p.push([x, y]); }
      T.push(p);
    }
    g.strokeStyle = _rgba(C.a, 0.25); g.lineWidth = 3.5; for (const p of T) _wrap((dx, dy) => _strokeP(g, p, dx, dy));
    g.strokeStyle = C.a; g.lineWidth = 1.3; for (const p of T) _wrap((dx, dy) => _strokeP(g, p, dx, dy));
    for (const p of T) for (const q of [p[0], p[p.length - 1]]) _wrap((dx, dy) => { g.fillStyle = C.m; g.beginPath(); g.arc(q[0] + dx, q[1] + dy, 2.6, 0, TAU); g.fill(); g.strokeStyle = C.x[0] || _mixH(C.a, '#ffffff', 0.4); g.lineWidth = 1.2; g.stroke(); });
  },
  leaf(g, C, R) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    for (let i = 0; i < 40; i++) {
      const x = R() * PAT_S, y = R() * PAT_S, r = 4 + R() * 9, n = 4 + Math.floor(R() * 3), a0 = R() * TAU, pts = [];
      for (let k = 0; k < n; k++) { const a = a0 + k / n * TAU + R() * 0.5; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
      const col = [C.a, _shH(C.m, 0.82), _mixH(C.m, '#ffffff', 0.25)][i % 3];
      _wrap((dx, dy) => { g.fillStyle = col; g.beginPath(); pts.forEach((q, k) => k ? g.lineTo(q[0] + dx, q[1] + dy) : g.moveTo(q[0] + dx, q[1] + dy)); g.closePath(); g.fill(); });
    }
    g.strokeStyle = _rgba(C.d, 0.6); g.lineWidth = 0.7; for (let i = 0; i < 8; i++) { const p = _walk(R, R() * PAT_S, R() * PAT_S, 6, 6, 1.5); _wrap((dx, dy) => _strokeP(g, p, dx, dy)); }
  },
  damask(g, C) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    const motif = (x, y) => {
      g.save(); g.translate(x, y); g.strokeStyle = C.a; g.fillStyle = C.a; g.lineWidth = 1.4;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, 12); g.bezierCurveTo(s * 14, 6, s * 14, -10, s * 4, -12); g.stroke(); g.beginPath(); g.arc(s * 9, 2, 3, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(0, -4); g.quadraticCurveTo(s * 8, -16, 0, -20); g.stroke(); }
      g.beginPath(); g.moveTo(0, -14); g.lineTo(3, -6); g.lineTo(0, 4); g.lineTo(-3, -6); g.closePath(); g.fill();
      g.beginPath(); g.arc(0, 14, 2, 0, TAU); g.fill(); g.restore();
    };
    for (let y = 0; y <= PAT_S; y += 64) for (let x = 0; x <= PAT_S; x += 64) { motif(x, y); motif(x + 32, y + 32); }
    g.fillStyle = _rgba(C.a, 0.5); for (let y = 16; y < PAT_S; y += 32) for (let x = 16; x < PAT_S; x += 32) { g.beginPath(); g.arc(x, y, 1.3, 0, TAU); g.fill(); }
  },
  carbon(g, C) {
    const cs = 8, lt = _mixH(C.m, '#ffffff', 0.2), dk = _shH(C.m, 0.55);
    for (let y = 0; y < PAT_S; y += cs) for (let x = 0; x < PAT_S; x += cs) {
      const hz = ((x / cs) + (y / cs)) % 2 === 0, gr = hz ? g.createLinearGradient(x, y, x, y + cs) : g.createLinearGradient(x, y, x + cs, y);
      gr.addColorStop(0, dk); gr.addColorStop(0.5, lt); gr.addColorStop(1, dk); g.fillStyle = gr; g.fillRect(x, y, cs, cs);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i <= PAT_S; i += cs) { g.fillRect(i, 0, 0.6, PAT_S); g.fillRect(0, i, PAT_S, 0.6); }
  },
  rust(g, C, R) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    const cols = [_rgba(C.d, 0.35), _rgba(C.a, 0.55), _rgba(_mixH(C.m, '#ffffff', 0.25), 0.3), _rgba(C.d, 0.6)];
    for (let i = 0; i < 70; i++) { const p = _blobPts(R, R() * PAT_S, R() * PAT_S, 2 + R() * (i % 4 === 1 ? 10 : 6), 7); g.fillStyle = cols[i % 4]; _wrap((dx, dy) => _smooth(g, p, dx, dy)); }
  },
  hex(g, C) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    const sx = 16, sy = PAT_S / 10, ry = sy / 1.5, P = [[0, -ry], [8, -ry / 2], [8, ry / 2], [0, ry], [-8, ry / 2], [-8, -ry / 2]];
    for (const [w, col] of [[3.5, _rgba(C.a, 0.25)], [1.3, C.a]]) {
      g.strokeStyle = col; g.lineWidth = w;
      for (let r = -1; r <= 10; r++) for (let c = -1; c <= 8; c++) { const x = c * sx + (r % 2 ? 8 : 0), y = r * sy; g.beginPath(); P.forEach((q, k) => k ? g.lineTo(x + q[0] * 0.86, y + q[1] * 0.86) : g.moveTo(x + q[0] * 0.86, y + q[1] * 0.86)); g.closePath(); g.stroke(); }
    }
  },
  facet(g, C, R) {
    const n = 8, cs = PAT_S / n, J = [];
    for (let j = 0; j < n; j++) { J.push([]); for (let i = 0; i < n; i++) J[j].push([(R() - 0.5) * cs * 0.7, (R() - 0.5) * cs * 0.7]); }
    const P = (i, j) => { const q = J[((j % n) + n) % n][((i % n) + n) % n]; return [i * cs + q[0], j * cs + q[1]]; };
    for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
      for (const tri of [[a, b, c], [a, c, d]]) { const k = 0.6 + R() * 0.75; g.fillStyle = k > 1.15 ? _mixH(C.m, '#ffffff', (k - 1.15) * 1.6) : _shH(C.m, k); g.beginPath(); tri.forEach((q, z) => z ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill(); g.strokeStyle = _rgba(C.a, 0.45); g.lineWidth = 0.7; g.stroke(); }
    }
  },
  aurora(g, C, R) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    const cols = [C.a, C.x[0] || C.d, C.a];
    for (let k = 0; k < 6; k++) {
      const y0 = R() * PAT_S, A = 6 + R() * 10, ph = R() * TAU, fr = 1 + Math.floor(R() * 2), th = 8 + R() * 14;
      _wrap((dx, dy) => { if (dx) return; const gr = g.createLinearGradient(0, y0 + dy - th, 0, y0 + dy + th); gr.addColorStop(0, _rgba(cols[k % 3], 0)); gr.addColorStop(0.5, _rgba(cols[k % 3], 0.55)); gr.addColorStop(1, _rgba(cols[k % 3], 0)); g.fillStyle = gr;
        g.beginPath(); for (let x = 0; x <= PAT_S; x += 4) g.lineTo(x, y0 + dy - th + Math.sin(x / PAT_S * TAU * fr + ph) * A); for (let x = PAT_S; x >= 0; x -= 4) g.lineTo(x, y0 + dy + th + Math.sin(x / PAT_S * TAU * fr + ph) * A); g.closePath(); g.fill(); });
    }
  },
  smoke(g, C, R) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    for (let i = 0; i < 46; i++) {
      const x = R() * PAT_S, y = R() * PAT_S, r = 6 + R() * 16, col = i % 3 ? (C.x[0] || '#ffffff') : C.d;
      _wrap((dx, dy) => { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, _rgba(col, 0.28)); gr.addColorStop(1, _rgba(col, 0)); g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2); });
    }
    g.strokeStyle = _rgba(C.x[0] || '#ffffff', 0.35); g.lineWidth = 1; for (let i = 0; i < 7; i++) { const p = _walk(R, R() * PAT_S, R() * PAT_S, 12, 5, 0.9); _wrap((dx, dy) => _strokeP(g, p, dx, dy)); }
  },
  plasma(g, C) {
    const id = g.createImageData(PAT_S, PAT_S), d = id.data, a = hexRGB(C.m), b = hexRGB(C.x[0] || C.d), c = hexRGB(C.a), w = TAU / PAT_S;
    for (let y = 0; y < PAT_S; y++) for (let x = 0; x < PAT_S; x++) {
      const v = (Math.sin(x * w * 2) + Math.sin(y * w * 3 + Math.sin(x * w) * 2) + Math.sin((x + y) * w * 2) + Math.sin((x - y) * w * 1)) / 4;
      const k = (v + 1) / 2, s = Math.pow(Math.abs(Math.sin(v * 5)), 6), i = (y * PAT_S + x) * 4;
      for (let q = 0; q < 3; q++) d[i + q] = Math.round(255 * clamp(lerp(a[q], b[q], k) * (1 - s) + c[q] * s, 0, 1));
      d[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
  },
  hazard(g, C) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S); g.fillStyle = C.a;
    for (let k = -PAT_S; k < PAT_S * 2; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 16, 0); g.lineTo(k + 16 - PAT_S, PAT_S); g.lineTo(k - PAT_S, PAT_S); g.closePath(); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < PAT_S; y += 32) g.fillRect(0, y, PAT_S, 1.2);
  },
  flame(g, C, R) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    const F = []; for (let i = 0; i < 12; i++) F.push([R() * PAT_S, R() * PAT_S, 7 + R() * 7, 22 + R() * 26, (R() - 0.5) * 10]);
    for (const [col, k] of [[C.d, 1.25], [C.a, 1], [C.x[0] || '#fff3a0', 0.55]]) {
      g.fillStyle = col;
      for (const [x, y, w, h, sw] of F) _wrap((dx, dy) => { const X = x + dx, Y = y + dy, ww = w * k, hh = h * k; g.beginPath(); g.moveTo(X - ww, Y); g.bezierCurveTo(X - ww, Y - hh * 0.5, X + sw - ww * 0.2, Y - hh * 0.7, X + sw, Y - hh); g.bezierCurveTo(X + sw * 0.4 + ww * 0.4, Y - hh * 0.6, X + ww, Y - hh * 0.4, X + ww, Y); g.quadraticCurveTo(X, Y + ww * 0.8, X - ww, Y); g.fill(); });
    }
  },
  stars(g, C, R) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    for (let i = 0; i < 8; i++) { const x = R() * PAT_S, y = R() * PAT_S, r = 18 + R() * 26, col = C.x[i % Math.max(1, C.x.length)] || C.d; _wrap((dx, dy) => { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, _rgba(col, 0.55)); gr.addColorStop(1, _rgba(col, 0)); g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2); }); }
    for (let i = 0; i < 70; i++) { const x = R() * PAT_S, y = R() * PAT_S, s = R() < 0.85 ? 0.5 + R() * 0.8 : 1.5 + R(), col = R() < 0.6 ? '#ffffff' : C.a; _wrap((dx, dy) => { g.fillStyle = col; g.beginPath(); g.arc(x + dx, y + dy, s, 0, TAU); g.fill(); if (s > 1.4) { g.fillRect(x + dx - s * 3, y + dy - 0.4, s * 6, 0.8); g.fillRect(x + dx - 0.4, y + dy - s * 3, 0.8, s * 6); } }); }
  },
  flake(g, C, R) {
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S); g.lineCap = 'round';
    g.strokeStyle = _rgba(C.d, 0.35); g.lineWidth = 0.8; for (let i = 0; i < 10; i++) { const p = _walk(R, R() * PAT_S, R() * PAT_S, 6, 8, 1.2); _wrap((dx, dy) => _strokeP(g, p, dx, dy)); }
    for (let i = 0; i < 11; i++) {
      const x = R() * PAT_S, y = R() * PAT_S, r = 5 + R() * 7, rot = R(), col = i % 2 ? (C.x[0] || '#ffffff') : C.a;
      _wrap((dx, dy) => { g.strokeStyle = col; g.lineWidth = 1.1; for (let k = 0; k < 6; k++) { const a = rot + k / 6 * TAU, ex = Math.cos(a), ey = Math.sin(a); g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + ex * r, y + dy + ey * r); g.stroke();
        for (const s of [-1, 1]) { const bx = x + dx + ex * r * 0.6, by = y + dy + ey * r * 0.6, ba = a + s * 0.7; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(ba) * r * 0.35, by + Math.sin(ba) * r * 0.35); g.stroke(); } } });
    }
  },
  tiger(g, C, R) { // sivrilen, dalgalı, yer yer çatallanan çizgiler
    g.fillStyle = C.m; g.fillRect(0, 0, PAT_S, PAT_S);
    const band = (x, y, h, w, bend, ph, col) => {
      const L = [], Rr = [], n = 14;
      for (let k = 0; k <= n; k++) { const t = k / n, cx = x + Math.sin(t * Math.PI * 1.4 + ph) * bend, ww = w * Math.sin(t * Math.PI); L.push([cx - ww, y + t * h]); Rr.push([cx + ww, y + t * h]); }
      const pts = L.concat(Rr.reverse());
      _wrap((dx, dy) => { g.fillStyle = col; g.beginPath(); pts.forEach((q, k) => k ? g.lineTo(q[0] + dx, q[1] + dy) : g.moveTo(q[0] + dx, q[1] + dy)); g.closePath(); g.fill(); });
    };
    for (let i = 0; i < 9; i++) {
      const x = i / 9 * PAT_S + R() * 5, y = R() * PAT_S, h = 50 + R() * 50, w = 3.5 + R() * 3, bend = 4 + R() * 7, ph = R() * TAU, col = C.x[0] && i % 3 === 2 ? C.x[0] : C.a;
      band(x, y, h, w, bend, ph, col);
      if (R() < 0.7) band(x + 5 + R() * 4, y + h * (0.2 + R() * 0.4), h * 0.35, w * 0.6, 3, ph + 1, col); // çatal
    }
  }
};
/* skinin desen tuvali (önbellekli) · willReadFrequently: tuval CPU belleğinde kalır, GPU sıfırlanınca boşalmaz */
const _PATC = {};
function patCanvas(sk) {
  if (!sk || !sk.pat || !PATGEN[sk.pat]) return null;
  const old = _PATC[sk.id];
  if (old) { try { if (old.getContext('2d').getImageData(0, 0, 1, 1).data[3]) return old; } catch (e) { return old; } } // desenler opak: köşe saydamsa tuval boşalmış, yeniden üret
  const cv = document.createElement('canvas'); cv.width = cv.height = PAT_S;
  const pk = sk.pk || sk.c, g = cv.getContext('2d', { willReadFrequently: true }), C = { m: pk[0], d: pk[1], a: pk[2], x: sk.pc || [] };
  try { PATGEN[sk.pat](g, C, _prng(_hashStr(sk.id + sk.pat))); } catch (e) { g.fillStyle = sk.c[0]; g.fillRect(0, 0, PAT_S, PAT_S); }
  return (_PATC[sk.id] = cv);
}
/* desenin akış kayması (döşeme birimi) */
function patFlow(sk, t) { return sk && sk.flow ? [((t * sk.flow[0]) % 1 + 1) % 1, ((t * sk.flow[1]) % 1 + 1) % 1] : null; }
Object.assign(EN_FRAG, {
  'Dijital kamuflaj': 'Digital camo', 'Kamuflaj': 'Camo', 'Dalga deseni': 'Wave pattern', 'Çiçek deseni': 'Flower pattern', 'Şeritli': 'Striped', 'Fırçalı metal': 'Brushed metal',
  'Çatlak deseni': 'Crack pattern', 'Pul deseni': 'Scale pattern', 'Sıçrama deseni': 'Splatter pattern', 'Neon ızgara': 'Neon grid', 'Şimşek deseni': 'Lightning pattern',
  'Devre deseni': 'Circuit pattern', 'Varak deseni': 'Gold leaf', 'Damask deseni': 'Damask pattern', 'Karbon örgü': 'Carbon weave', 'Pas deseni': 'Rust pattern', 'Petek deseni': 'Honeycomb',
  'Kesme taş': 'Cut gem', 'Aurora deseni': 'Aurora pattern', 'Duman deseni': 'Smoke pattern', 'Plazma deseni': 'Plasma pattern', 'Tehlike şeridi': 'Hazard stripes',
  'Alev deseni': 'Flame pattern', 'Yıldızlı': 'Starry', 'Kar tanesi': 'Snowflakes', 'Kaplan deseni': 'Tiger pattern', ' · akan': ' · flowing', ' · ışıklı': ' · glowing', ' · gökkuşağı': ' · rainbow', 'Düz renk': 'Solid color'
});
try { _EN_RE = null; _EN_CACHE.clear(); } catch (e) { }
