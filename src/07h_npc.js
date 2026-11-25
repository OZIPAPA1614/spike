/* =====================================================================
   07h · SERBEST MOD ÇİZİMİ: NPC'ler (kameraya hep dönük resim), pill'li
        oyuncular, mini harita noktaları. Hazır NPC yüzleri burada kodla
        çizilir; oyuncunun yüklediği resimler doku olarak yüklenir.
   ===================================================================== */
const NPCV = { tex: {}, prev: {}, cv: {} };
/* hazır NPC yüzleri (128x128 tuval) */
function npcCanvas(k) {
  if (NPCV.cv[k]) return NPCV.cv[k];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const eye = (x, y, r, iris, pup) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.fillStyle = iris; g.beginPath(); g.arc(x, y, r * 0.55, 0, TAU); g.fill(); g.fillStyle = pup || '#000'; g.beginPath(); g.arc(x, y, r * 0.28, 0, TAU); g.fill(); };
  switch (k) {
    case 'grin': { // sarı, dev sırıtış
      const rg = g.createRadialGradient(64, 56, 10, 64, 64, 80); rg.addColorStop(0, '#fff27a'); rg.addColorStop(1, '#d9a400'); g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#111'; g.beginPath(); g.ellipse(40, 44, 13, 18, 0, 0, TAU); g.ellipse(88, 44, 13, 18, 0, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(44, 38, 4, 0, TAU); g.arc(92, 38, 4, 0, TAU); g.fill();
      g.fillStyle = '#5a0a0a'; g.beginPath(); g.moveTo(14, 72); g.quadraticCurveTo(64, 132, 114, 72); g.quadraticCurveTo(64, 96, 14, 72); g.fill();
      g.fillStyle = '#fff'; for (let i = 0; i < 9; i++) { const x = 22 + i * 10.5; g.fillRect(x, 78 + Math.abs(i - 4) * -1.5 + 2, 7, 9); }
      break;
    }
    case 'eye': { // dev göz
      g.fillStyle = '#1a0608'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#f3eee6'; g.beginPath(); g.ellipse(64, 64, 58, 44, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(190,20,30,0.7)'; g.lineWidth = 1.6;
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; g.beginPath(); g.moveTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 42); g.quadraticCurveTo(64 + Math.cos(a + 0.3) * 40, 64 + Math.sin(a + 0.3) * 30, 64 + Math.cos(a) * 28, 64 + Math.sin(a) * 24); g.stroke(); }
      const ir = g.createRadialGradient(64, 64, 4, 64, 64, 28); ir.addColorStop(0, '#7cf3ff'); ir.addColorStop(1, '#1a5f8a'); g.fillStyle = ir; g.beginPath(); g.arc(64, 64, 28, 0, TAU); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(64, 64, 13, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(56, 56, 5, 0, TAU); g.fill();
      break;
    }
    case 'cube': { // piksel yüzlü kutu
      g.fillStyle = '#1e8fa3'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#7cf3ff'; g.fillRect(8, 8, 112, 112);
      g.fillStyle = '#0d2a33'; g.fillRect(26, 34, 22, 22); g.fillRect(80, 34, 22, 22);
      g.fillStyle = '#fff'; g.fillRect(30, 38, 8, 8); g.fillRect(84, 38, 8, 8);
      g.fillStyle = '#0d2a33'; g.fillRect(30, 84, 68, 10); g.fillRect(24, 76, 10, 10); g.fillRect(94, 76, 10, 10);
      break;
    }
    case 'ghost': { // mor gölge
      g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 128, 128);
      const gg = g.createLinearGradient(0, 0, 0, 128); gg.addColorStop(0, '#d7b3ff'); gg.addColorStop(1, '#6a2bb8'); g.fillStyle = gg;
      g.beginPath(); g.moveTo(14, 128); g.lineTo(14, 56); g.arc(64, 56, 50, Math.PI, 0); g.lineTo(114, 128);
      for (let i = 0; i < 5; i++) { const x0 = 114 - i * 20; g.quadraticCurveTo(x0 - 5, 110, x0 - 10, 124); g.quadraticCurveTo(x0 - 15, 110, x0 - 20, 128); }
      g.closePath(); g.fill();
      g.fillStyle = '#16051f'; g.beginPath(); g.ellipse(46, 56, 10, 15, 0, 0, TAU); g.ellipse(82, 56, 10, 15, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(64, 90, 9, 12, 0, 0, TAU); g.fill();
      break;
    }
    case 'melon': { // karpuz
      g.clearRect(0, 0, 128, 128);
      g.fillStyle = '#2f8a3b'; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.fill();
      g.strokeStyle = '#1b5524'; g.lineWidth = 7; for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(64, 64, Math.abs(i) * 12 + 6, 58, 0, 0, TAU); g.stroke(); }
      eye(44, 54, 13, '#3d2a12'); eye(84, 54, 13, '#3d2a12');
      g.fillStyle = '#e63950'; g.beginPath(); g.arc(64, 84, 22, 0, Math.PI); g.fill(); g.fillStyle = '#111'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(52 + i * 8, 92 + (i % 2) * 4, 2, 3.5, 0, 0, TAU); g.fill(); }
      break;
    }
    default: { g.fillStyle = '#444'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff'; g.font = 'bold 60px sans-serif'; g.textAlign = 'center'; g.fillText('?', 64, 86); }
  }
  return (NPCV.cv[k] = c);
}
/* NPC'nin önizleme resmi (spawn menüsü için) */
function npcPreview(k) {
  const K = npcKind(k); if (!K) return '';
  if (K.img) return K.img;
  return NPCV.prev[k] || (NPCV.prev[k] = npcCanvas(k).toDataURL('image/png'));
}
/* doku: hazırlar tuvalden, kendi resimler data: adresinden (yüklenene kadar beyaz) */
function npcTex(k) {
  const t = NPCV.tex[k]; if (t) return t.t;
  const K = npcKind(k); if (!K || !GLX.ok) return null;
  if (!K.img) { NPCV.tex[k] = { t: mkTex(npcCanvas(k), false) }; return NPCV.tex[k].t; }
  const rec = NPCV.tex[k] = { t: null }, im = new Image();
  im.onload = () => { try { rec.t = mkTex(im, false); } catch (e) { } };
  im.src = K.img;
  return null;
}
function npcQuad() {
  if (GLX.meshes.npcq) return;
  const g = GB();
  gquad(g, [0, -0.5, 0.5], [0, -0.5, -0.5], [0, 0.5, -0.5], [0, 0.5, 0.5], [1, 0, 0], null, null, [0, 1, 1, 1, 1, 0, 0, 0]);
  mkMesh('npcq', g);
}
const _npcR = new Array(9);
/* bir NPC resmini (x, y) noktasında kameraya dönük çiz; hpF: can oranı (gösterilecekse) */
function drawNpcSprite(k, x, y, lift, alpha, hpF) {
  const K = npcKind(k); if (!K) return;
  npcQuad();
  const tex = npcTex(k), h = 100 * (K.sz || 1), a = Math.atan2(GLX.cam[2] - y, GLX.cam[0] - x), R = rotMat(a, 0, 0, _npcR);
  QR('npcq', x, lift + h / 2 + 2, y, R, 1, h, h, [1, 1, 1, alpha === undefined ? 1 : alpha], { lit: 0, tex: tex || GLX.tex.white, cut: 0.5 });
  Q('disc', x, 1.2, y, 0, 0, h * 0.55, 1, h * 0.55, [0, 0, 0, 0.35], { lit: 0 });
  if (hpF !== undefined && hpF < 0.999) {
    const bw = h * 0.7, o = xf(R, 2, 0, 0);
    QR('box', x + o[0], lift + h + 14, y + o[2], R, 1, 5, bw, [0.08, 0.1, 0.12, 0.85], { lit: 0 });
    const f = clamp(hpF, 0, 1), o2 = xf(R, 3, 0, bw * (1 - f) / 2);
    QR('box', x + o2[0], lift + h + 14, y + o2[2], R, 1, 4, bw * f, [1, 0.3, 0.35, 1], { lit: 0, em: [0.6, 0.1, 0.15] });
  }
}
function drawNpcs(t) {
  const dt = clamp(t - (NPCV.lt || t), 0, 0.1); NPCV.lt = t;
  if (!S || !S.npcs || !S.npcs.length) return;
  const cl = G.mode === 'client', k = Math.min(1, dt * 12);
  for (const n of S.npcs) {
    if (cl) { if (n.rx === undefined) { n.rx = n.x; n.ry = n.y; } n.rx += (n.x - n.rx) * k; n.ry += (n.y - n.ry) * k; } else { n.rx = n.x; n.ry = n.y; }
    const K = npcKind(n.k); if (!K) continue;
    drawNpcSprite(n.k, n.rx, n.ry, 0, 1, K.hp ? n.hp / K.hp : undefined);
  }
}
function frDrawMinimap(P) {
  if (!S || !S.npcs) return;
  for (const n of S.npcs) { const [px, py] = P(n.rx !== undefined ? n.rx : n.x, n.ry !== undefined ? n.ry : n.y); circle(px, py, 3.5, '#b46cff', 'rgba(20,0,30,0.9)', 1); }
}
