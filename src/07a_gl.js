/* =====================================================================
   07a · WEBGL MOTORU (harici kütüphane yok)
        shader, matris matematiği, ilkel şekiller, doku üretimi,
        opak/saydam çizim kuyruğu
   ===================================================================== */
const GLX = {
  gl: null, cv: null, ok: false, L: {}, meshes: {}, tex: {}, oq: [], tq: [], pool: [], pn: 0,
  vp: new Float32Array(16), proj: new Float32Array(16), view: new Float32Array(16), projVM: new Float32Array(16),
  cam: [0, 0, 0], fogCol: [0.05, 0.08, 0.12], fog: [900, 3400], light: [0.36, 0.88, 0.3], ad: [0.48, 0.72, 0], lc: [1, 1, 1], dpr: 1, fovY: 1.2, prim: {}
};
const ZERO3 = [0, 0, 0];
const VS_SRC = `attribute vec3 aP; attribute vec3 aN; attribute vec3 aC; attribute vec2 aT;
uniform mat4 uVP; uniform mat4 uM; uniform mat3 uR; uniform vec3 uCam;
varying vec3 vN; varying vec3 vC; varying vec2 vT; varying vec3 vP;
void main(){ vec4 w = uM * vec4(aP, 1.0); gl_Position = uVP * w; vN = uR * aN; vC = aC; vT = aT; vP = w.xyz; }`;
const FS_SRC = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vN; varying vec3 vC; varying vec2 vT; varying vec3 vP;
uniform vec3 uCam; uniform vec4 uCol; uniform vec3 uEm; uniform float uLit; uniform sampler2D uTex; uniform sampler2D uDet; uniform float uDetS; uniform vec2 uDetO; uniform vec3 uFogC; uniform vec2 uFog; uniform vec3 uL; uniform vec3 uAD; uniform vec3 uLC;
void main(){
  vec4 tx = texture2D(uTex, vT);
  if (uDetS > 0.0) tx.rgb *= texture2D(uDet, vP.xz * uDetS + uDetO).rgb * 2.0;
  float vD = distance(vP, uCam); // mesafe parça başına (dev zemin üçgenlerinde doğru sis)
  vec3 base = vC * uCol.rgb * tx.rgb;
  float d = max(dot(normalize(vN), uL), 0.0);
  vec3 c = mix(base, base * (uAD.x + uAD.y * d) * uLC, uLit) + uEm;
  float f = clamp((vD - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0);
  gl_FragColor = vec4(mix(c, uFogC, f), uCol.a * tx.a);
}`;

/* ---------- matris yardımcıları (sütun öncelikli) ---------- */
function m4Persp(o, fovy, asp, n, f) {
  const t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f);
  o.fill(0); o[0] = t / asp; o[5] = t; o[10] = (f + n) * nf; o[11] = -1; o[14] = 2 * f * n * nf; return o;
}
function m4LookAt(o, ex, ey, ez, cx, cy, cz) {
  let zx = ex - cx, zy = ey - cy, zz = ez - cz, l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
  let xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l; // up=(0,1,0) × z
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0; o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0; o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
  o[12] = -(xx * ex + xy * ey + xz * ez); o[13] = -(yx * ex + yy * ey + yz * ez); o[14] = -(zx * ex + zy * ey + zz * ez); o[15] = 1; return o;
}
function m4Mul(o, a, b) {
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    o[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
  }
  return o;
}
/* 2D açı a (oyun düzlemi) → 3D dönüş: Ry(-a)·Rz(pitch)·Rx(roll); yerel +X ileri, +Y yukarı, +Z sağ */
function rotMat(a, pitch, roll, out) {
  const o = out || new Array(9);
  const cy = Math.cos(-a), sy = Math.sin(-a), cp = Math.cos(pitch || 0), sp = Math.sin(pitch || 0), cr = Math.cos(roll || 0), sr = Math.sin(roll || 0);
  o[0] = cy * cp; o[1] = sp; o[2] = -sy * cp;
  o[3] = -cy * sp * cr + sy * sr; o[4] = cp * cr; o[5] = sy * sp * cr + cy * sr;
  o[6] = cy * sp * sr + sy * cr; o[7] = -cp * sr; o[8] = -sy * sp * sr + cy * cr;
  return o;
}
function xf(R, x, y, z) { return [R[0] * x + R[3] * y + R[6] * z, R[1] * x + R[4] * y + R[7] * z, R[2] * x + R[5] * y + R[8] * z]; }
function hexRGB(h, a) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a === undefined ? 1 : a];
}

/* ---------- kurulum ---------- */
function glInit(canvas) {
  GLX.cv = canvas;
  const mobile = IS_TOUCH;
  let gl = null;
  try { gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' }) || canvas.getContext('experimental-webgl'); } catch (e) { gl = null; }
  if (!gl) return false;
  GLX.gl = gl;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS_SRC)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS_SRC));
  gl.bindAttribLocation(pr, 0, 'aP'); gl.bindAttribLocation(pr, 1, 'aN'); gl.bindAttribLocation(pr, 2, 'aC'); gl.bindAttribLocation(pr, 3, 'aT');
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  for (const u of ['uVP', 'uM', 'uR', 'uCam', 'uCol', 'uEm', 'uLit', 'uTex', 'uDet', 'uDetS', 'uDetO', 'uFogC', 'uFog', 'uL', 'uAD', 'uLC']) GLX.L[u] = gl.getUniformLocation(pr, u);
  for (let i = 0; i < 4; i++) gl.enableVertexAttribArray(i);
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
  gl.uniform1i(GLX.L.uTex, 0); gl.uniform1i(GLX.L.uDet, 1); gl.uniform1f(GLX.L.uDetS, 0);
  GLX.aniso = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
  buildPrimitives();
  loadTexPack();
  buildTextures();
  GLX.ok = true;
  return true;
}
function glResize(w, h) {
  if (!GLX.ok) return;
  // ekranın gerçek piksel yoğunluğunda çiz (telefonda da keskin görüntü); kalite yalnızca üst sınırı belirler
  const q = (typeof SETTINGS !== 'undefined' && SETTINGS.gfx) || 'high', dpr = window.devicePixelRatio || 1;
  // bilgisayarda (yüksek kalite) 1x ekranlarda da 1,25 kat çizilip küçültülür: kenarlar daha temiz
  const hi = IS_TOUCH ? Math.min(dpr, 2) : Math.min(Math.max(dpr, 1.25), 2);
  GLX.dpr = (q === 'low' ? Math.min(dpr, 1) : q === 'mid' ? Math.min(dpr, 1.5) : hi) * DYN.s; // grafik kalitesi × otomatik ölçek
  GLX.cv.width = Math.round(w * GLX.dpr); GLX.cv.height = Math.round(h * GLX.dpr);
  GLX.cv.style.width = w + 'px'; GLX.cv.style.height = h + 'px';
}

/* ---------- OTOMATİK ÇÖZÜNÜRLÜK ----------
   Kare hızı düşerse çizim çözünürlüğü kademeli olarak azaltılır (en fazla %50), oyun akıcılaşınca
   yavaşça geri yükseltilir. Takılmaya yol açan ölçeğe 20 sn boyunca geri dönülmez (gidip gelme olmasın). */
const DYN = { s: 1, acc: 0, n: 0, good: 0, cap: 1, capT: 0, min: 0.7, mx: 0 };
function dynRes(rawDt) {
  if (!GLX.ok || document.hidden || rawDt > 0.5) { DYN.acc = 0; DYN.n = 0; return; }
  DYN.acc += rawDt; DYN.n++; if (rawDt > DYN.mx) DYN.mx = rawDt;
  if (DYN.acc < 1) return;
  const fps = DYN.n / DYN.acc, now = performance.now(), steady = DYN.mx < 1.3 * DYN.acc / DYN.n; DYN.acc = 0; DYN.n = 0; DYN.mx = 0;
  // tarayıcı kare hızını kendisi 30'a sabitlemişse (ör. iPhone güç tasarrufu modu) çözünürlüğü düşürmenin faydası yok
  if (steady && fps > 28 && fps < 32) return;
  if (now > DYN.capT) DYN.cap = 1;
  let ns = DYN.s;
  if (fps < 50) { DYN.good = 0; DYN.cap = Math.min(DYN.cap, DYN.s * 0.97); DYN.capT = now + 20000; ns = DYN.s * (fps < 35 ? 0.8 : 0.9); }
  else if (fps >= 57) { if (++DYN.good >= 4) { DYN.good = 0; ns = Math.min(DYN.cap, DYN.s * 1.08, 1); } }
  else DYN.good = 0;
  ns = clamp(ns, IS_TOUCH ? DYN.min : Math.max(DYN.min, 0.8), 1);
  if (Math.abs(ns - DYN.s) > 0.01) { DYN.s = ns; glResize(window.innerWidth, window.innerHeight); }
}

/* ---------- geometri ---------- */
function GB() { return { v: [] }; }
function gv(g, x, y, z, nx, ny, nz, c, u, v) { g.v.push(x, y, z, nx, ny, nz, c[0], c[1], c[2], u, v); }
function gquad(g, p0, p1, p2, p3, n, c0, c1, uv) {
  const C0 = c0 || [1, 1, 1], C1 = c1 || C0, T = uv || [0, 0, 1, 0, 1, 1, 0, 1];
  gv(g, ...p0, ...n, C0, T[0], T[1]); gv(g, ...p1, ...n, C0, T[2], T[3]); gv(g, ...p2, ...n, C1, T[4], T[5]);
  gv(g, ...p0, ...n, C0, T[0], T[1]); gv(g, ...p2, ...n, C1, T[4], T[5]); gv(g, ...p3, ...n, C1, T[6], T[7]);
}
/* PERFORMANS: büyük dünya meshleri (duvar, zemin, dekor, eşyalar…) parçalara bölünür; her karede
   yalnızca kameranın görüş alanına giren parçalar çizilir. Sisin tamamen yuttuğu uzak küçük eşyalar
   (fogCull) hiç çizilmez. Görüntü aynı kalır, ekran kartının işi 2-4 kat azalır. */
/* değer: parçanın bu mesafeden uzaktaysa hiç çizilmediği mesafe (0 = yalnızca görüş alanı kontrolü).
   Süs eşyaları (fıçı, sandık, lamba…) oyunu etkilemez; 2600 birimden (~32 karo) uzakta birkaç piksel kalırlar. */
const CHUNKED = { floor: 0, walls: 0, trim: 0, crates: 0, lows: 0, water: 0, props: 2600, decor: 0, decorEm: 0 };
function mkMesh(name, g) {
  const gl = GLX.gl, old = GLX.meshes[name];
  if (old) { try { if (old.b) gl.deleteBuffer(old.b); if (old.ch) for (const c of old.ch) gl.deleteBuffer(c.b); } catch (e) { } }
  if (!g.v.length) { delete GLX.meshes[name]; return; }
  if (g.v.length < 200000) GLX.prim[name] = g.v; else delete GLX.prim[name]; // büyük dünya meshlerini bellekte tutma
  const nv = g.v.length / 11;
  if (name in CHUNKED && nv > 6000 && typeof WW === 'number' && WW > 0) {
    const cell = Math.max(WW, WH) / (CHUNKED[name] ? 10 : 5), V = g.v, groups = new Map();
    for (let i = 0; i < V.length; i += 33) { // üçgen başına: ağırlık merkezine göre parça
      const cx = (V[i] + V[i + 11] + V[i + 22]) / 3, cz = (V[i + 2] + V[i + 13] + V[i + 24]) / 3;
      const k = Math.floor(cx / cell) * 4096 + Math.floor(cz / cell);
      let a = groups.get(k); if (!a) { a = []; groups.set(k, a); }
      for (let j = 0; j < 33; j++) a.push(V[i + j]);
    }
    const ch = [];
    for (const a of groups.values()) {
      let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
      for (let i = 0; i < a.length; i += 11) { const x = a[i], y = a[i + 1], z = a[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a), gl.STATIC_DRAW);
      ch.push({ b, n: a.length / 11, bb: [x0, y0, z0, x1, y1, z1] });
    }
    GLX.meshes[name] = { ch, n: nv, far: CHUNKED[name] };
    return;
  }
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.v), gl.STATIC_DRAW);
  GLX.meshes[name] = { b, n: nv };
}
/* görüş piramidi (frustum) düzlemleri: VP matrisinden */
const FRU = new Float32Array(24);
function glFrustum() {
  const m = GLX.vp;
  for (let p = 0; p < 6; p++) {
    const r = p >> 1, s = p & 1 ? -1 : 1;
    let a = m[3] + s * m[r], b = m[7] + s * m[4 + r], c = m[11] + s * m[8 + r], d = m[15] + s * m[12 + r];
    const l = Math.hypot(a, b, c) || 1; FRU[p * 4] = a / l; FRU[p * 4 + 1] = b / l; FRU[p * 4 + 2] = c / l; FRU[p * 4 + 3] = d / l;
  }
}
function bbVisible(bb, far) {
  for (let p = 0; p < 6; p++) {
    const a = FRU[p * 4], b = FRU[p * 4 + 1], c = FRU[p * 4 + 2], d = FRU[p * 4 + 3];
    if (a * (a > 0 ? bb[3] : bb[0]) + b * (b > 0 ? bb[4] : bb[1]) + c * (c > 0 ? bb[5] : bb[2]) + d < 0) return false;
  }
  if (far) { // uzak (ya da sisin tamamen yuttuğu) parça
    const cx = clamp(GLX.cam[0], bb[0], bb[3]), cz = clamp(GLX.cam[2], bb[2], bb[5]);
    if (Math.hypot(cx - GLX.cam[0], cz - GLX.cam[2]) > Math.min(far, GLX.fog[1] + 40)) return false;
  }
  return true;
}
function buildPrimitives() {
  // birim küp (merkezli, -0.5..0.5)
  let g = GB(); const h = 0.5;
  gquad(g, [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h], [0, 0, 1]);
  gquad(g, [h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h], [0, 0, -1]);
  gquad(g, [h, -h, h], [h, -h, -h], [h, h, -h], [h, h, h], [1, 0, 0]);
  gquad(g, [-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h], [-1, 0, 0]);
  gquad(g, [-h, h, h], [h, h, h], [h, h, -h], [-h, h, -h], [0, 1, 0]);
  gquad(g, [-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h], [0, -1, 0]);
  mkMesh('box', g);
  // küre
  g = GB(); const RS = 10, SS = 14;
  for (let i = 0; i < RS; i++) for (let j = 0; j < SS; j++) {
    const P = (a, b) => { const th = a / RS * Math.PI, ph = b / SS * TAU; return [Math.sin(th) * Math.cos(ph) * 0.5, Math.cos(th) * 0.5, Math.sin(th) * Math.sin(ph) * 0.5]; };
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
    const N = p => [p[0] * 2, p[1] * 2, p[2] * 2];
    gv(g, ...a, ...N(a), [1, 1, 1], 0, 0); gv(g, ...b, ...N(b), [1, 1, 1], 0, 1); gv(g, ...c, ...N(c), [1, 1, 1], 1, 1);
    gv(g, ...a, ...N(a), [1, 1, 1], 0, 0); gv(g, ...c, ...N(c), [1, 1, 1], 1, 1); gv(g, ...d, ...N(d), [1, 1, 1], 1, 0);
  }
  mkMesh('sphere', g);
  // düşük poligonlu küre (dekor için)
  g = GB();
  for (let i = 0; i < 5; i++) for (let j = 0; j < 7; j++) {
    const P = (a, b) => { const th = a / 5 * Math.PI, ph = b / 7 * TAU; return [Math.sin(th) * Math.cos(ph) * 0.5, Math.cos(th) * 0.5, Math.sin(th) * Math.sin(ph) * 0.5]; };
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1), N = q => [q[0] * 2, q[1] * 2, q[2] * 2];
    gv(g, ...a, ...N(a), [1, 1, 1], 0, 0); gv(g, ...b, ...N(b), [1, 1, 1], 0, 1); gv(g, ...c, ...N(c), [1, 1, 1], 1, 1);
    gv(g, ...a, ...N(a), [1, 1, 1], 0, 0); gv(g, ...c, ...N(c), [1, 1, 1], 1, 1); gv(g, ...d, ...N(d), [1, 1, 1], 1, 0);
  }
  mkMesh('sphLo', g);
  // orta çözünürlüklü küre (bulutlar)
  g = GB();
  for (let i = 0; i < 6; i++) for (let j = 0; j < 10; j++) {
    const P = (a, b) => { const th = a / 6 * Math.PI, ph = b / 10 * TAU; return [Math.sin(th) * Math.cos(ph) * 0.5, Math.cos(th) * 0.5, Math.sin(th) * Math.sin(ph) * 0.5]; };
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1), N = q => [q[0] * 2, q[1] * 2, q[2] * 2];
    gv(g, ...a, ...N(a), [1, 1, 1], 0, 0); gv(g, ...b, ...N(b), [1, 1, 1], 0, 1); gv(g, ...c, ...N(c), [1, 1, 1], 1, 1);
    gv(g, ...a, ...N(a), [1, 1, 1], 0, 0); gv(g, ...c, ...N(c), [1, 1, 1], 1, 1); gv(g, ...d, ...N(d), [1, 1, 1], 1, 0);
  }
  mkMesh('sphMd', g);
  // silindir (yarıçap 0.5, yükseklik 1, merkezli)
  const CS = 18;
  g = GB();
  for (let i = 0; i < CS; i++) {
    const a0 = i / CS * TAU, a1 = (i + 1) / CS * TAU, c0 = Math.cos(a0) * 0.5, s0 = Math.sin(a0) * 0.5, c1 = Math.cos(a1) * 0.5, s1 = Math.sin(a1) * 0.5;
    gquad(g, [c0, -h, s0], [c1, -h, s1], [c1, h, s1], [c0, h, s0], [Math.cos(a0), 0, Math.sin(a0)]);
    gv(g, 0, h, 0, 0, 1, 0, [1, 1, 1], 0.5, 0.5); gv(g, c0, h, s0, 0, 1, 0, [1, 1, 1], 0, 0); gv(g, c1, h, s1, 0, 1, 0, [1, 1, 1], 1, 0);
    gv(g, 0, -h, 0, 0, -1, 0, [1, 1, 1], 0.5, 0.5); gv(g, c1, -h, s1, 0, -1, 0, [1, 1, 1], 1, 0); gv(g, c0, -h, s0, 0, -1, 0, [1, 1, 1], 0, 0);
  }
  mkMesh('cyl', g);
  // düşük poligonlu silindir (dekor: ağaç gövdesi, direk, baca)
  g = GB();
  for (let i = 0; i < 8; i++) {
    const a0 = i / 8 * TAU, a1 = (i + 1) / 8 * TAU, c0 = Math.cos(a0) * 0.5, s0 = Math.sin(a0) * 0.5, c1 = Math.cos(a1) * 0.5, s1 = Math.sin(a1) * 0.5;
    gquad(g, [c0, -h, s0], [c1, -h, s1], [c1, h, s1], [c0, h, s0], [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)]);
    gv(g, 0, h, 0, 0, 1, 0, [1, 1, 1], 0.5, 0.5); gv(g, c0, h, s0, 0, 1, 0, [1, 1, 1], 0, 0); gv(g, c1, h, s1, 0, 1, 0, [1, 1, 1], 1, 0);
  }
  mkMesh('cylLo', g);
  // dekor silindiri: sarmal UV (fıçı, varil), 12 dilim
  g = GB();
  for (let i = 0; i < 12; i++) {
    const a0 = i / 12 * TAU, a1 = (i + 1) / 12 * TAU, c0 = Math.cos(a0) * 0.5, s0 = Math.sin(a0) * 0.5, c1 = Math.cos(a1) * 0.5, s1 = Math.sin(a1) * 0.5;
    gquad(g, [c0, -h, s0], [c1, -h, s1], [c1, h, s1], [c0, h, s0], [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)], null, null, [i / 12, 0, (i + 1) / 12, 0, (i + 1) / 12, 1, i / 12, 1]);
    gv(g, 0, h, 0, 0, 1, 0, [1, 1, 1], 0.5, 0.5); gv(g, c0, h, s0, 0, 1, 0, [1, 1, 1], 0.5 + c0, 0.5 + s0); gv(g, c1, h, s1, 0, 1, 0, [1, 1, 1], 0.5 + c1, 0.5 + s1);
  }
  mkMesh('pcyl', g);
  // koni
  g = GB();
  for (let i = 0; i < CS; i++) {
    const a0 = i / CS * TAU, a1 = (i + 1) / CS * TAU;
    gv(g, Math.cos(a0) * 0.5, -h, Math.sin(a0) * 0.5, Math.cos(a0), 0.5, Math.sin(a0), [1, 1, 1], 0, 0);
    gv(g, Math.cos(a1) * 0.5, -h, Math.sin(a1) * 0.5, Math.cos(a1), 0.5, Math.sin(a1), [1, 1, 1], 1, 0);
    gv(g, 0, h, 0, Math.cos((a0 + a1) / 2), 0.5, Math.sin((a0 + a1) / 2), [1, 1, 1], 0.5, 1);
  }
  mkMesh('cone', g);
  // disk ve halka (XZ düzlemi, y=0)
  g = GB();
  for (let i = 0; i < 28; i++) { const a0 = i / 28 * TAU, a1 = (i + 1) / 28 * TAU; gv(g, 0, 0, 0, 0, 1, 0, [1, 1, 1], 0.5, 0.5); gv(g, Math.cos(a1) * 0.5, 0, Math.sin(a1) * 0.5, 0, 1, 0, [1, 1, 1], 0.5 + Math.cos(a1) * 0.5, 0.5 + Math.sin(a1) * 0.5); gv(g, Math.cos(a0) * 0.5, 0, Math.sin(a0) * 0.5, 0, 1, 0, [1, 1, 1], 0.5 + Math.cos(a0) * 0.5, 0.5 + Math.sin(a0) * 0.5); }
  mkMesh('disc', g);
  g = GB();
  for (let i = 0; i < 40; i++) {
    const a0 = i / 40 * TAU, a1 = (i + 1) / 40 * TAU, ri = 0.43, ro = 0.5;
    gquad(g, [Math.cos(a0) * ri, 0, Math.sin(a0) * ri], [Math.cos(a1) * ri, 0, Math.sin(a1) * ri], [Math.cos(a1) * ro, 0, Math.sin(a1) * ro], [Math.cos(a0) * ro, 0, Math.sin(a0) * ro], [0, 1, 0]);
  }
  mkMesh('ring', g);
  // hilal (VEX ultisi) XZ düzleminde, +X yönüne bakar
  g = GB();
  for (let i = 0; i < 20; i++) {
    const a0 = -1.15 + i / 20 * 2.3, a1 = -1.15 + (i + 1) / 20 * 2.3, w0 = 0.12 * Math.cos(a0 * 1.2), w1 = 0.12 * Math.cos(a1 * 1.2);
    gquad(g, [Math.cos(a0) * (0.5 - w0), 0, Math.sin(a0) * (0.5 - w0)], [Math.cos(a1) * (0.5 - w1), 0, Math.sin(a1) * (0.5 - w1)], [Math.cos(a1) * 0.5, 0, Math.sin(a1) * 0.5], [Math.cos(a0) * 0.5, 0, Math.sin(a0) * 0.5], [0, 1, 0]);
  }
  mkMesh('crescent', g);
  // sekizyüzlü
  g = GB(); const V = [[0.5, 0, 0], [-0.5, 0, 0], [0, 0.5, 0], [0, -0.5, 0], [0, 0, 0.5], [0, 0, -0.5]];
  for (const [a, b, c] of [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]]) {
    const A = V[a], B = V[b], C = V[c], n = [(A[0] + B[0] + C[0]), (A[1] + B[1] + C[1]), (A[2] + B[2] + C[2])];
    gv(g, ...A, ...n, [1, 1, 1], 0, 0); gv(g, ...B, ...n, [1, 1, 1], 1, 0); gv(g, ...C, ...n, [1, 1, 1], 0, 1);
  }
  mkMesh('octa', g);
  // dört yüzlü piramit (taban -0.5, tepe +0.5)
  g = GB(); const PB = [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]];
  for (let i = 0; i < 4; i++) { const a = PB[i], b = PB[(i + 1) % 4], n = [(a[0] + b[0]), 0.5, (a[2] + b[2])]; gv(g, ...a, ...n, [1, 1, 1], 0, 0); gv(g, ...b, ...n, [1, 1, 1], 1, 0); gv(g, 0, h, 0, ...n, [1, 1, 1], 0.5, 1); }
  mkMesh('pyr', g);
}
/* Bir ilkel şekli dönüştürüp toplu (statik) geometriye ekle — dekor tek çizim çağrısında */
/* cell: dekor doku atlasındaki hücre (4×4); verilirse UV'ler o hücreye eşlenir */
function gAppend(g, name, x, y, z, a, sx, sy, sz, col, pitch, cell) {
  const src = GLX.prim[name]; if (!src) return;
  const R = rotMat(a || 0, pitch || 0, 0, new Array(9));
  const at = cell !== undefined && cell !== null, cu = at ? (cell % 4) * 0.25 + 0.012 : 0, cv = at ? Math.floor(cell / 4) * 0.25 + 0.012 : 0;
  for (let i = 0; i < src.length; i += 11) {
    const px = src[i] * sx, py = src[i + 1] * sy, pz = src[i + 2] * sz, nx = src[i + 3], ny = src[i + 4], nz2 = src[i + 5];
    let u = src[i + 9], v = src[i + 10];
    if (at) { u = cu + clamp(u, 0, 1) * 0.226; v = cv + clamp(v, 0, 1) * 0.226; }
    g.v.push(x + R[0] * px + R[3] * py + R[6] * pz, y + R[1] * px + R[4] * py + R[7] * pz, z + R[2] * px + R[5] * py + R[8] * pz,
      R[0] * nx + R[3] * ny + R[6] * nz2, R[1] * nx + R[4] * ny + R[7] * nz2, R[2] * nx + R[5] * ny + R[8] * nz2,
      src[i + 6] * col[0], src[i + 7] * col[1], src[i + 8] * col[2], u, v);
  }
}

/* ---------- dokular (canvas ile üretilir) ---------- */
function mkTex(src, repeat) {
  const gl = GLX.gl, t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  const pot = (src.width & (src.width - 1)) === 0 && (src.height & (src.height - 1)) === 0;
  if (pot) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
  else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const wrap = repeat && pot ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  if (pot && GLX.aniso) gl.texParameterf(gl.TEXTURE_2D, GLX.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(IS_TOUCH ? 4 : 8, gl.getParameter(GLX.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  _boundTex = null;
  return t;
}
/* ---------- fotoğraf doku paketi (01c, CC0) ---------- */
const TEXIMG = {};
let TEXPACK_READY = false;
function loadTexPack() {
  if (typeof TEXPACK_SRC === 'undefined') return;
  const keys = Object.keys(TEXPACK_SRC); let left = keys.length;
  for (const k of keys) {
    const im = new Image();
    im.onload = () => { TEXIMG[k] = im; if (--left === 0) texPackDone(); };
    im.onerror = () => { if (--left === 0) texPackDone(); };
    im.src = TEXPACK_SRC[k];
  }
}
function texPackDone() { TEXPACK_READY = true; if (GLX.ok && CUR_MAP >= 0) buildThemeTextures(THEME); }
/* Dekor doku atlası (4×4 hücre, 256 px): Poly Haven CC0 fotoğraflarından türetilir.
   0 ahşap · 1 koyu metal · 2 altın · 3 kemik · 4 çuval bezi · 5 pas boyalı varil · 6 taş · 7 pişmiş toprak
   8 yaprak · 9 sunucu paneli · 10 beyaz · 11 siyah · 12 kırmızı boya · 13 kar · 14 kaktüs · 15 kauçuk */
const PC = { wood: 0, metal: 1, gold: 2, bone: 3, burlap: 4, rust: 5, stone: 6, clay: 7, leaf: 8, panel: 9, white: 10, black: 11, red: 12, snow: 13, cactus: 14, rubber: 15 };
function buildPropAtlas() {
  const spec = [
    ['weathered_brown_planks', null, '#8a6040'], ['rusty_metal_03', '#9aa0a8', '#6a6e75'], ['rusty_metal_03', '#ffe27a', '#d6aa38'], ['snow_02', '#f2e4c6', '#e6d8b8'],
    ['sand_03', '#f0d8a8', '#b49870'], ['rusty_metal_03', '#e07040', '#a85030'], ['concrete_layers', '#d8d4cc', '#8a8680'], ['rock_pitted_mossy', '#f0a070', '#b8673c'],
    ['leaves_forest_ground', '#6fc050', '#3c6a2a'], ['painted_concrete_02', '#6a7484', '#2a2f38'], [null, null, '#ffffff'], [null, null, '#141414'],
    ['rusty_metal_03', '#ff5040', '#b02a22'], ['snow_02', '#ffffff', '#f2f6fa'], ['leaves_forest_ground', '#4c9a40', '#3f7a35'], ['granular_concrete', '#404040', '#262626']];
  return canvasOf(1024, 1024, (c) => {
    spec.forEach(([img, tint, base], k) => {
      const x = (k % 4) * 256, y = Math.floor(k / 4) * 256, im = img && TEXIMG[img];
      c.save(); c.beginPath(); c.rect(x, y, 256, 256); c.clip();
      if (im) {
        c.drawImage(im, x, y, 256, 256);
        // metal/kauçuk/panel: önce renksizleştir (pas tonunu al), sonra renklendir
        if (k === PC.metal || k === PC.rubber || k === PC.panel || k === PC.white) { c.globalCompositeOperation = 'saturation'; c.fillStyle = '#808080'; c.fillRect(x, y, 256, 256); }
        if (tint) { c.globalCompositeOperation = 'multiply'; c.fillStyle = tint; c.fillRect(x, y, 256, 256); }
        c.globalCompositeOperation = 'source-over';
      } else { c.fillStyle = base; c.fillRect(x, y, 256, 256); }
      if (k === PC.burlap) { c.strokeStyle = 'rgba(80,60,30,0.18)'; c.lineWidth = 1; for (let i = 0; i < 256; i += 5) { c.beginPath(); c.moveTo(x + i, y); c.lineTo(x + i, y + 256); c.moveTo(x, y + i); c.lineTo(x + 256, y + i); c.stroke(); } }
      if (k === PC.panel) { c.fillStyle = 'rgba(0,0,0,0.45)'; for (let i = 20; i < 250; i += 26) c.fillRect(x + 18, y + i, 220, 10); }
      if (k === PC.cactus) { c.strokeStyle = 'rgba(20,50,20,0.5)'; c.lineWidth = 6; for (let i = 16; i < 256; i += 32) { c.beginPath(); c.moveTo(x + i, y); c.lineTo(x + i, y + 256); c.stroke(); } }
      c.restore();
    });
  });
}
/* Su dokusu: dikişsiz dalga/ışık kırılması (kostik) deseni; render'da iki katman farklı yönlere kayar */
const ZERO2 = [0, 0];
function buildWaterCanvas() {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const x2 = c.getContext('2d'), img = x2.createImageData(N, N), d = img.data;
  const W = [[3, 2, 0.0], [-2, 3, 1.3], [5, -1, 2.1], [1, 4, 4.0], [-4, -3, 0.7], [6, 2, 3.3]];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    let s = 0; for (const [a, b, ph] of W) s += Math.sin(TAU * (a * u + b * v) + ph);
    let s2 = 0; for (const [a, b, ph] of W) s2 += Math.sin(TAU * (b * u - a * v) + ph * 1.7);
    const caust = Math.pow(1 - Math.min(1, Math.abs(s) / 2.2), 5) + 0.6 * Math.pow(1 - Math.min(1, Math.abs(s2) / 2.2), 6);
    const base = 0.42 + 0.08 * Math.sin(TAU * (2 * u + v)) + 0.06 * Math.sin(TAU * (u - 3 * v) + 1);
    const L = Math.min(1, base + caust * 0.42), k = (y * N + x) * 4;
    d[k] = L * 225; d[k + 1] = L * 242; d[k + 2] = L * 255; d[k + 3] = 255;
  }
  x2.putImageData(img, 0, 0);
  return c;
}
/* Fotoğrafı tuvale çiz, isteğe bağlı renk çarpanı ve parlaklık uygula */
function photoCanvas(name, size, tint, fn) {
  const im = TEXIMG[name]; if (!im) return null;
  return canvasOf(size, size, (c, w, h) => {
    c.drawImage(im, 0, 0, w, h);
    if (tint) { c.globalCompositeOperation = 'multiply'; c.fillStyle = tint; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over'; }
    if (fn) fn(c, w, h);
  });
}
function canvasOf(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
function noiseFill(c, w, h, n, a) { for (let i = 0; i < n; i++) { c.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '255,255,255') + ',' + Math.random() * a + ')'; c.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 2 + Math.random() * 3); } }
function buildTextures() {
  GLX.tex.white = mkTex(canvasOf(2, 2, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 2, 2); }), false);
  GLX.tex.stone = mkTex(canvasOf(128, 128, (c, w, h) => {
    c.fillStyle = '#8a7556'; c.fillRect(0, 0, w, h); noiseFill(c, w, h, 500, 0.15);
    c.strokeStyle = 'rgba(40,28,15,0.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(10, 30); c.lineTo(60, 64); c.lineTo(40, 120); c.moveTo(60, 64); c.lineTo(118, 50); c.stroke();
  }), true);
}
function buildThemeTextures(th) {
  const gl = GLX.gl;
  for (const k of ['wall', 'crate', 'low', 'floor', 'det']) if (GLX.tex[k]) { try { gl.deleteTexture(GLX.tex[k]); } catch (e) { } GLX.tex[k] = null; }
  const P = th.pack || {};
  const wc = P.wall && photoCanvas(P.wall, 512, P.wallTint, P.wallFx || null);
  GLX.tex.wall = mkTex(wc || canvasOf(256, 256, th.wall), true);
  const cc = P.crate && photoCanvas(P.crate, 256, P.crateTint, (c, w, h) => {
    // kasa çerçevesi: kenar çıtaları + çapraz destek
    c.strokeStyle = P.crateFrame || 'rgba(30,22,14,0.85)'; c.lineWidth = 14; c.strokeRect(7, 7, w - 14, h - 14);
    c.lineWidth = 6; c.globalAlpha = 0.55; c.beginPath(); c.moveTo(14, 14); c.lineTo(w - 14, h - 14); c.stroke(); c.globalAlpha = 1;
  });
  GLX.tex.crate = mkTex(cc || canvasOf(128, 128, th.crate), true);
  const dc = P.floor && photoCanvas(P.floor + '_d', 512, null);
  if (dc) GLX.tex.det = mkTex(dc, true);
  if (GLX.tex.props) { try { gl.deleteTexture(GLX.tex.props); } catch (e) { } }
  GLX.tex.props = mkTex(buildPropAtlas(), false);
  if (!GLX.tex.water) GLX.tex.water = mkTex(buildWaterCanvas(), true);
  GLX.tex.low = mkTex(canvasOf(128, 128, th.low), true);
  GLX.tex.floor = PKMAP ? mkTex(pkFloorCanvas(th), true) : mkTex(buildFloorCanvas(th), false); // parkur: tekrarlanan karo dokusu
}
/* Zemin: 2048×1024 tek doku — temaya göre karo/kum/kar/çim/asfalt; site harfleri, çizgiler, su */
function buildFloorCanvas(th) {
  const F = th.floor, map = mapDef();
  const mx = Math.min(4096, (GLX.gl && GLX.gl.getParameter(GLX.gl.MAX_TEXTURE_SIZE)) || 2048);
  const big = MW * 16 > 2048 && (!(typeof IS_TOUCH !== 'undefined' && IS_TOUCH) || SETTINGS.gfx === 'high');
  const fw = big ? mx : 2048, fh = big ? Math.min(2048, Math.round(fw * MH / MW)) : 1024;
  return canvasOf(fw, fh, (c, w, h) => {
    const sx = w / WW, sy = h / WH;
    c.fillStyle = F.bg; c.fillRect(0, 0, w, h);
    const col = t => (t === T_A || t === T_B) ? F.site : t === T_ATK ? F.atk : t === T_DEF ? F.def : F.floor;
    const seams = F.style === 'tiles' || F.style === 'concrete';
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const t = grid[y * MW + x]; if (t === T_WALL || t === T_BOX) continue;
      const X = x * TILE * sx, Y = y * TILE * sy, TW = TILE * sx + 1, TH = TILE * sy + 1;
      if (t === T_WATER) { c.fillStyle = F.water; c.fillRect(X, Y, TW, TH); continue; }
      if (t === T_LOW) { c.fillStyle = F.low; c.fillRect(X, Y, TW, TH); continue; }
      const cc = col(t);
      const alt = F.style === 'concrete' ? ((x >> 1) + (y >> 1)) % 2 : (x + y) % 2;
      c.fillStyle = seams ? (alt ? cc[0] : cc[1]) : cc[0];
      c.fillRect(X, Y, TW, TH);
      if (seams && (F.style === 'tiles' || (x % 2 === 0 && y % 2 === 0))) { c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1; c.strokeRect(X + 0.5, Y + 0.5, (F.style === 'concrete' ? 2 : 1) * TILE * sx - 1, (F.style === 'concrete' ? 2 : 1) * TILE * sy - 1); }
      if ((t === T_A || t === T_B) && !seams) { c.strokeStyle = 'rgba(0,0,0,0.14)'; c.lineWidth = 1; c.strokeRect(X + 0.5, Y + 0.5, TW - 2, TH - 2); }
    }
    // malzeme ayrıntısı
    if (F.style === 'sand') { nz(c, w, h, Math.round(9000 * w * h / 2097152), 0.06); c.strokeStyle = 'rgba(120,90,50,0.10)'; c.lineWidth = 2; for (let i = 0; i < 260; i++) { const x0 = Math.random() * w, y0 = Math.random() * h; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + 20, y0 - 6, x0 + 44, y0); c.stroke(); } }
    else if (F.style === 'snow') { nz(c, w, h, Math.round(7000 * w * h / 2097152), 0.05, false); c.fillStyle = 'rgba(150,190,220,0.12)'; for (let i = 0; i < 120; i++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, rand(6, 30), rand(4, 14), rand(0, 3), 0, TAU); c.fill(); } }
    else if (F.style === 'grass') { for (let i = 0, nG = Math.round(9000 * w * h / 2097152); i < nG; i++) { c.fillStyle = 'rgba(' + randi(40, 90) + ',' + randi(80, 130) + ',' + randi(30, 60) + ',' + rand(0.08, 0.25) + ')'; c.fillRect(Math.random() * w, Math.random() * h, 2, 4); } c.fillStyle = 'rgba(110,90,60,0.18)'; for (let i = 0; i < 80; i++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, rand(8, 30), rand(5, 16), rand(0, 3), 0, TAU); c.fill(); } }
    else if (F.style === 'asphalt') { nz(c, w, h, Math.round(9000 * w * h / 2097152), 0.08); c.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 60; i++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, rand(6, 22), rand(4, 12), rand(0, 3), 0, TAU); c.fill(); } }
    else noiseFill(c, w, h, Math.round(4000 * w * h / 2097152), 0.05);
    c.save(); c.scale(sx, sy);
    // su dalgaları
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (grid[y * MW + x] === T_WATER) {
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 3;
      for (let k = 0; k < 3; k++) { const yy = y * TILE + 8 + k * 12 + ((x * 7) % 6); c.beginPath(); c.moveTo(x * TILE + 4, yy); c.quadraticCurveTo(x * TILE + 20, yy - 5, x * TILE + 36, yy); c.stroke(); }
    }
    const edgeLines = (types, color, dash, lw) => {
      c.setLineDash(dash); c.lineWidth = lw || 6; c.strokeStyle = color;
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        const t = grid[y * MW + x]; if (!types.includes(t)) continue;
        const X = x * TILE, Y = y * TILE;
        const e = (nx, ny, x1, y1, x2, y2) => { const n = tileAt(nx, ny); if (!types.includes(n) && n !== T_WALL && n !== T_BOX) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); } };
        e(x, y - 1, X, Y, X + TILE, Y); e(x, y + 1, X, Y + TILE, X + TILE, Y + TILE); e(x - 1, y, X, Y, X, Y + TILE); e(x + 1, y, X + TILE, Y, X + TILE, Y + TILE);
      }
      c.setLineDash([]);
    };
    if (F.lines) edgeLines([T_WATER], F.lines, [18, 12], 5);
    if (map.lines && F.lines) { c.strokeStyle = F.lines; c.lineWidth = 5; c.setLineDash([40, 30]); for (const l of map.lines) { c.beginPath(); c.moveTo(l[0] * TILE, l[1] * TILE); c.lineTo(l[2] * TILE, l[3] * TILE); c.stroke(); } c.setLineDash([]); }
    edgeLines([T_A], '#f5c451', [16, 10]); edgeLines([T_B], '#f5c451', [16, 10]);
    edgeLines([T_ATK], '#ff4655', []);
    edgeLines([T_DEF], '#1ee3cf', []);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 230px ' + FONT; c.fillStyle = 'rgba(245,196,81,0.55)';
    for (const sname of ['A', 'B']) { const ce = MAPDATA.sites[sname].center; c.fillText(sname, (ce[0] + 0.5) * TILE, (ce[1] + 1) * TILE); }
    c.font = 'bold 34px ' + FONT; c.fillStyle = F.style === 'snow' || F.style === 'sand' ? 'rgba(60,50,40,0.45)' : 'rgba(255,255,255,0.45)';
    for (const l of MAPDATA.labels) if (l[0].length > 1) c.fillText(l[0], l[1] * TILE, l[2] * TILE + 22);
    c.restore();
  });
}

/* ---------- çizim kuyruğu ---------- */
function poolItem() {
  let it = GLX.pool[GLX.pn];
  if (!it) { it = { M: new Float32Array(16), R: new Float32Array(9) }; GLX.pool[GLX.pn] = it; }
  GLX.pn++;
  return it;
}
/* QR: dönüş matrisi R ile; (x, y=yükseklik, z=2D y) */
function QR(mesh, x, y, z, R, sx, sy, sz, col, o) {
  const it = poolItem(), M = it.M;
  M[0] = R[0] * sx; M[1] = R[1] * sx; M[2] = R[2] * sx; M[3] = 0;
  M[4] = R[3] * sy; M[5] = R[4] * sy; M[6] = R[5] * sy; M[7] = 0;
  M[8] = R[6] * sz; M[9] = R[7] * sz; M[10] = R[8] * sz; M[11] = 0;
  M[12] = x; M[13] = y; M[14] = z; M[15] = 1;
  for (let i = 0; i < 9; i++) it.R[i] = R[i];
  it.mesh = mesh; it.col = col; it.em = (o && o.em) || ZERO3; it.lit = (o && o.lit === 0) ? 0 : 1; it.tex = (o && o.tex) || null;
  it.add = !!(o && o.add); it.xray = !!(o && o.xray); it.vm = !!(o && o.vm); it.sky = !!(o && o.sky);
  it.det = (o && o.det) || null; it.detS = (o && o.detS) || 0; it.detO = (o && o.detO) || null;
  const tr = col[3] < 0.999 || it.add || it.xray;
  if (tr) { it.dist = (x - GLX.cam[0]) ** 2 + (y - GLX.cam[1]) ** 2 + (z - GLX.cam[2]) ** 2; GLX.tq.push(it); } else GLX.oq.push(it);
  return it;
}
/* QM: hazır 4x4 model matrisiyle (iskeletli karakter parçaları) */
function QM(mesh, M, col, o) {
  const it = poolItem(), m = it.M, R = it.R;
  for (let i = 0; i < 16; i++) m[i] = M[i];
  for (let c = 0; c < 3; c++) { const x = M[c * 4], y = M[c * 4 + 1], z = M[c * 4 + 2], l = 1 / (Math.hypot(x, y, z) || 1); R[c * 3] = x * l; R[c * 3 + 1] = y * l; R[c * 3 + 2] = z * l; }
  it.mesh = mesh; it.col = col; it.em = (o && o.em) || ZERO3; it.lit = (o && o.lit === 0) ? 0 : 1; it.tex = (o && o.tex) || null;
  it.add = !!(o && o.add); it.xray = !!(o && o.xray); it.vm = !!(o && o.vm); it.sky = false; it.det = null; it.detS = 0; it.detO = null;
  if (col[3] < 0.999 || it.add || it.xray) { it.dist = (M[12] - GLX.cam[0]) ** 2 + (M[13] - GLX.cam[1]) ** 2 + (M[14] - GLX.cam[2]) ** 2; GLX.tq.push(it); } else GLX.oq.push(it);
  return it;
}
const _R = new Array(9);
function Q(mesh, x, y, z, a, pitch, sx, sy, sz, col, o) { return QR(mesh, x, y, z, rotMat(a, pitch, o && o.roll, _R), sx, sy, sz, col, o); }
/* İki 3D nokta arasında ince kutu (iz, ışın, çizgi) */
function Qline(x1, y1, z1, x2, y2, z2, w, col, o) {
  const dx = x2 - x1, dz = z2 - z1, dy = y2 - y1, hl = Math.hypot(dx, dz), l = Math.hypot(hl, dy);
  if (l < 0.01) return;
  QR('box', (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, rotMat(Math.atan2(dz, dx), Math.atan2(dy, hl), 0, _R), l, w, w, col, o);
}
let _boundTex = null;
let _detOn = true;
function glBindMesh(gl, b) {
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 44, 0); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 44, 12);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 44, 24); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 44, 36);
}
function glDrawItem(it) {
  const gl = GLX.gl, L = GLX.L, m = GLX.meshes[it.mesh];
  if (!m) return;
  if (m.ch) { // parçalı dünya meshi (birim dönüşümle çizilir): görünmeyen parçaları atla
    let any = false;
    for (const c of m.ch) if (c.vis = bbVisible(c.bb, m.far)) any = true;
    if (!any) return;
  } else glBindMesh(gl, m.b);
  gl.uniformMatrix4fv(L.uM, false, it.M); gl.uniformMatrix3fv(L.uR, false, it.R);
  gl.uniform4fv(L.uCol, it.col); gl.uniform3fv(L.uEm, it.em); gl.uniform1f(L.uLit, it.lit);
  const tx = it.tex || GLX.tex.white;
  if (it.det) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, it.det); gl.activeTexture(gl.TEXTURE0); gl.uniform1f(L.uDetS, it.detS); gl.uniform2fv(L.uDetO, it.detO || ZERO2); _detOn = true; }
  else if (_detOn) { gl.uniform1f(L.uDetS, 0); _detOn = false; }
  if (tx !== _boundTex) { gl.bindTexture(gl.TEXTURE_2D, tx); _boundTex = tx; }
  if (m.ch) { for (const c of m.ch) if (c.vis) { glBindMesh(gl, c.b); gl.drawArrays(gl.TRIANGLES, 0, c.n); GLX.stV += c.n; } }
  else { gl.drawArrays(gl.TRIANGLES, 0, m.n); GLX.stV += m.n; }
}
function glBeginFrame(clear) {
  const gl = GLX.gl;
  gl.viewport(0, 0, GLX.cv.width, GLX.cv.height);
  gl.clearColor(clear[0], clear[1], clear[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  GLX.oq.length = 0; GLX.tq.length = 0; GLX.pn = 0; _boundTex = null; GLX.stV = 0;
}
function glSetCamera(ex, ey, ez, yaw, pitch, fovY, aspect) {
  const fx = Math.cos(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = Math.sin(yaw) * Math.cos(pitch);
  m4LookAt(GLX.view, ex, ey, ez, ex + fx, ey + fy, ez + fz);
  m4Persp(GLX.proj, fovY, aspect, 3, 7500 * MS);
  m4Mul(GLX.vp, GLX.proj, GLX.view);
  GLX.cam[0] = ex; GLX.cam[1] = ey; GLX.cam[2] = ez; GLX.fovY = fovY;
  glFrustum();
}
function glFlush() {
  const gl = GLX.gl, L = GLX.L;
  gl.uniformMatrix4fv(L.uVP, false, GLX.vp); gl.uniform3fv(L.uCam, GLX.cam);
  gl.uniform3fv(L.uFogC, GLX.fogCol); gl.uniform3fv(L.uL, GLX.light); gl.uniform3fv(L.uAD, GLX.ad); gl.uniform3fv(L.uLC, GLX.lc);
  // önce opak dünya (önden arkaya yakın sıra: duvar/zemin), SONRA gökyüzü yalnızca boş kalan piksellere
  // (derinlik testiyle) — ekranın büyük kısmında gökyüzü boşuna boyanmaz
  gl.uniform2fv(L.uFog, GLX.fog);
  gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
  for (const it of GLX.oq) if (!it.vm && !it.sky) glDrawItem(it);
  gl.uniform2fv(L.uFog, [1e6, 2e6]); gl.depthMask(false); gl.enable(gl.BLEND);
  for (const it of GLX.oq) if (it.sky) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); glDrawItem(it); }
  for (const it of GLX.tq) if (it.sky) { if (it.add) gl.blendFunc(gl.SRC_ALPHA, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); glDrawItem(it); }
  gl.uniform2fv(L.uFog, GLX.fog); gl.disable(gl.BLEND); gl.depthMask(true);
  GLX.tq.sort((a, b) => b.dist - a.dist);
  gl.enable(gl.BLEND); gl.depthMask(false);
  for (const it of GLX.tq) {
    if (it.vm || it.sky) continue;
    if (it.add) gl.blendFunc(gl.SRC_ALPHA, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (it.xray) gl.disable(gl.DEPTH_TEST);
    glDrawItem(it);
    if (it.xray) gl.enable(gl.DEPTH_TEST);
  }
  gl.depthMask(true); gl.disable(gl.BLEND);
}
/* Silah görünümü: derinlik temizlenir, kamera uzayında ayrı projeksiyon */
function glFlushViewmodel(aspect) {
  const gl = GLX.gl, L = GLX.L;
  gl.clear(gl.DEPTH_BUFFER_BIT);
  m4Persp(GLX.projVM, 1.05, aspect, 0.5, 400);
  gl.uniformMatrix4fv(L.uVP, false, GLX.projVM); gl.uniform3fv(L.uCam, ZERO3); gl.uniform2fv(L.uFog, [5000, 6000]);
  gl.uniform3fv(L.uL, [0.3, 0.8, 0.5]); gl.uniform3fv(L.uAD, [0.5, 0.7, 0]); gl.uniform3fv(L.uLC, [1, 1, 1]);
  for (const it of GLX.oq) if (it.vm) glDrawItem(it);
  gl.enable(gl.BLEND); gl.depthMask(false); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  for (const it of GLX.tq) if (it.vm) glDrawItem(it);
  gl.depthMask(true); gl.disable(gl.BLEND);
}
/* Dünya noktasını ekran pikseline çevir (HUD etiketleri için) */
function worldToScreen(x, h, y) {
  const m = GLX.vp;
  const cx = m[0] * x + m[4] * h + m[8] * y + m[12], cy = m[1] * x + m[5] * h + m[9] * y + m[13], cw = m[3] * x + m[7] * h + m[11] * y + m[15];
  if (cw <= 1) return null;
  return [(cx / cw * 0.5 + 0.5) * W, (1 - (cy / cw * 0.5 + 0.5)) * H, cw];
}
