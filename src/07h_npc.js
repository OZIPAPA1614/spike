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
  const K = npcKind(k); if (!K || K.wait) return '';
  if (K.img) return K.img;
  return NPCV.prev[k] || (NPCV.prev[k] = npcCanvas(k).toDataURL('image/png'));
}
/* doku: hazırlar tuvalden, kendi resimler data: adresinden (yüklenene kadar beyaz) */
function npcTex(k) {
  const t = NPCV.tex[k]; if (t) return t.t;
  const K = npcKind(k); if (!K || !GLX.ok || K.wait) return null; // resmi henüz inmediyse beyaz (06b)
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
/* ---------- NPC SESİ: 15 sn, tek kanal, 12 kHz IMA-ADPCM (4 bit) → "ima12k:<base64>" ----------
   Kendi NPC'nin sesi kovalarken döngüde çalar; yaklaştıkça yükselir (en yakın 4 NPC). */
const IMA_STEP = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767];
const IMA_IDX = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];
function adpcmEnc(pcm) {
  const out = new Uint8Array(Math.ceil(pcm.length / 2)); let pred = 0, idx = 0;
  for (let i = 0; i < pcm.length; i++) {
    const step = IMA_STEP[idx]; let diff = pcm[i] - pred, code = 0;
    if (diff < 0) { code = 8; diff = -diff; }
    let vd = step >> 3;
    if (diff >= step) { code |= 4; diff -= step; vd += step; }
    if (diff >= step >> 1) { code |= 2; diff -= step >> 1; vd += step >> 1; }
    if (diff >= step >> 2) { code |= 1; vd += step >> 2; }
    pred = clamp(pred + ((code & 8) ? -vd : vd), -32768, 32767); idx = clamp(idx + IMA_IDX[code], 0, 88);
    if (i & 1) out[i >> 1] |= code << 4; else out[i >> 1] = code;
  }
  return out;
}
function adpcmDec(bytes, n) {
  const out = new Float32Array(n); let pred = 0, idx = 0;
  for (let i = 0; i < n; i++) {
    const code = (i & 1) ? bytes[i >> 1] >> 4 : bytes[i >> 1] & 15, step = IMA_STEP[idx];
    let vd = step >> 3; if (code & 4) vd += step; if (code & 2) vd += step >> 1; if (code & 1) vd += step >> 2;
    pred = clamp(pred + ((code & 8) ? -vd : vd), -32768, 32767); idx = clamp(idx + IMA_IDX[code], 0, 88);
    out[i] = pred / 32768;
  }
  return out;
}
function b64Bytes(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function bytesB64(u) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
/* 15 sn'lik sesi oynatılabilir tampona çevir (her tarayıcıda çalışsın diye 24 kHz'e çıkarılır) */
function sndBuffer(snd) {
  const u = b64Bytes(snd.slice(7)), n = u.length * 2, f = adpcmDec(u, n), b = AU.ctx.createBuffer(1, n * 2, 24000), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) { const a = f[i], c = i + 1 < n ? f[i + 1] : a; d[i * 2] = a; d[i * 2 + 1] = (a + c) / 2; }
  return b;
}
const NPCS = { buf: {}, live: new Map() };
/* hazır NPC'lerin kovalama müzikleri (kodla üretilir, 8 sn'lik döngü, 24 kHz) */
function npcSynth(k) {
  const sr = 24000, L = sr * 8, d = new Float32Array(L), TA = Math.PI * 2;
  const note = n => 440 * Math.pow(2, (n - 69) / 12);
  const add = (t0, dur, f, amp, wave, dec, vib) => { // tek nota (zarf + dalga)
    const i0 = Math.floor(t0 * sr), n = Math.floor(dur * sr);
    let ph = 0;
    for (let i = 0; i < n && i0 + i < L; i++) {
      const t = i / sr, ff = f * (vib ? 1 + Math.sin(t * 5.5 * TA) * vib : 1); ph += ff / sr;
      const x = ph % 1, w = wave === 'sq' ? (x < 0.5 ? 1 : -1) : wave === 'tri' ? 4 * Math.abs(x - 0.5) - 1 : Math.sin(ph * TA);
      const env = Math.min(1, t / 0.01) * Math.exp(-t * (dec || 3));
      d[i0 + i] += w * amp * env;
    }
  };
  if (k === 'grin') { // ürkütücü müzik kutusu
    const seq = [69, 72, 76, 81, 80, 76, 72, 71, 69, 72, 76, 79, 77, 74, 71, 68];
    for (let i = 0; i < 32; i++) add(i * 0.25, 0.6, note(seq[i % 16] + 12), 0.28, 'tri', 5);
    for (let i = 0; i < 4; i++) add(i * 2, 2.2, note(45 + (i % 2 ? 3 : 0)), 0.18, 'sin', 0.8);
  } else if (k === 'eye') { // alçak uğultu + kalp atışı
    for (let i = 0; i < L; i++) { const t = i / sr; d[i] += (Math.sin(TA * 55 * t) + Math.sin(TA * 55.7 * t)) * 0.12 + Math.sin(TA * 880 * t) * 0.02 * (0.5 + 0.5 * Math.sin(t * 0.8 * TA)); }
    for (let i = 0; i < 10; i++) { add(i * 0.8, 0.25, 62, 0.6, 'sin', 14); add(i * 0.8 + 0.22, 0.25, 58, 0.45, 'sin', 16); }
  } else if (k === 'cube') { // 8-bit kovalama
    const bass = [36, 36, 43, 43, 45, 45, 41, 41], mel = [72, 74, 76, 79, 76, 74, 72, 67];
    for (let i = 0; i < 64; i++) { const b = bass[Math.floor(i / 8) % 8]; add(i * 0.125, 0.12, note(b + (i % 2 ? 12 : 0)), 0.16, 'sq', 18); }
    for (let i = 0; i < 16; i++) add(i * 0.5, 0.4, note(mel[i % 8]), 0.1, 'sq', 6);
  } else if (k === 'ghost') { // titrek theremin
    const path = [64, 67, 71, 70, 66, 63, 61, 62]; let ph = 0;
    for (let i = 0; i < L; i++) { const t = i / sr, s = t / 1, a = Math.floor(s) % 8, b = (a + 1) % 8, fr = s - Math.floor(s), m = path[a] + (path[b] - path[a]) * fr * fr * (3 - 2 * fr); ph += note(m) * (1 + Math.sin(t * 6 * TA) * 0.012) / sr; d[i] += Math.sin(ph * TA) * 0.3; }
  } else { // karpuz: zıp zıp neşeli
    const seq = [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 83, 79, 74, 71];
    for (let i = 0; i < 32; i++) add(i * 0.25, 0.2, note(seq[i % 16]), 0.22, 'sq', 12);
    for (let i = 0; i < 16; i++) add(i * 0.5, 0.18, note(i % 2 ? 43 : 36), 0.3, 'tri', 10);
  }
  let pk = 1e-4; for (let i = 0; i < L; i++) pk = Math.max(pk, Math.abs(d[i]));
  const g = 0.8 / pk * (k === 'ghost' ? 0.5 : 1); for (let i = 0; i < L; i++) d[i] *= g; // sürekli ses (theremin) daha kısık
  const b = AU.ctx.createBuffer(1, L, sr); b.getChannelData(0).set(d); return b;
}
function npcHasSnd(k) { const K = npcKind(k); return !!(K && (K.snd || NPC_KINDS[k])); }
function npcSndBuf(k) {
  const K = npcKind(k); if (!K || !AU.ctx || !(K.snd || NPC_KINDS[k])) return null;
  if (NPCS.buf[k] !== undefined) return NPCS.buf[k];
  let b = null; try { b = K.snd ? sndBuffer(K.snd) : npcSynth(k); } catch (e) { b = null; }
  return (NPCS.buf[k] = b);
}
function _npcStopV(v) { try { const t = AU.ctx.currentTime; v.g.gain.setTargetAtTime(0, t, 0.05); v.s.stop(t + 0.3); } catch (e) { } }
function npcAudioStop() { for (const v of NPCS.live.values()) _npcStopV(v); NPCS.live.clear(); }
function npcAudioTick() {
  const live = NPCS.live;
  if (!AU.ctx || !S || !G.running || !frOn()) { if (live.size) npcAudioStop(); return; }
  const L = audioListener(), em = [];
  for (const n of S.npcs || []) if (npcHasSnd(n.k)) { const x = n.rx !== undefined ? n.rx : n.x, y = n.ry !== undefined ? n.ry : n.y; em.push({ key: n.id, k: n.k, x, y, d: dist(L.x, L.y, x, y) }); }
  for (const p of S.players) if (p.alive && p.pill && npcHasSnd(p.pill)) em.push({ key: 'p:' + p.id, k: p.pill, x: p.x, y: p.y, d: dist(L.x, L.y, p.x, p.y) });
  em.sort((a, b) => a.d - b.d);
  const keep = new Set(), now = AU.ctx.currentTime;
  for (const e of em.slice(0, 4)) {
    if (e.d > 6500) break; // GMod'daki gibi uzaktan da duyulsun
    let v = live.get(e.key);
    if (!v || v.k !== e.k) {
      if (v) _npcStopV(v);
      const b = npcSndBuf(e.k); if (!b) continue;
      const s = AU.ctx.createBufferSource(); s.buffer = b; s.loop = true;
      const g = AU.ctx.createGain(); g.gain.value = 0;
      let pn = null; if (AU.ctx.createStereoPanner) { pn = AU.ctx.createStereoPanner(); g.connect(pn); pn.connect(AU.master); } else g.connect(AU.master);
      s.connect(g); s.start(0, Math.random() * b.duration);
      v = { s, g, pn, k: e.k }; live.set(e.key, v);
    }
    keep.add(e.key);
    v.g.gain.setTargetAtTime((L.deaf ? 0.05 : 1) * 1.25 / (1 + e.d / 650), now, 0.08);
    if (v.pn) v.pn.pan.setTargetAtTime(e.d > 8 ? clamp(Math.sin(angDiff(L.ang || 0, Math.atan2(e.y - L.y, e.x - L.x))), -1, 1) * 0.8 : 0, now, 0.08);
  }
  for (const [key, v] of live) if (!keep.has(key)) { _npcStopV(v); live.delete(key); }
}
