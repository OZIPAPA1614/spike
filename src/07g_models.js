/* =====================================================================
   07g · 3B SİLAH MODELLERİ (01d_models verisiyle)
        Silahlar: rol (ana / koyu / vurgu) başına bir parça; skin renkleri rollere uygulanır.
        (Karakterler 07b'deki kutu karakterle çizilir.)
   ===================================================================== */
const MDL = { ready: false, guns: {} };
function _b64(s, T) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); }
/* indeksli parça → düz gölgeli üçgen dizisi (GL meshi) */
function _mdlMesh(name, part) {
  const V = _b64(part.v, Int16Array), I = _b64(part.i, Uint16Array), PI = _b64(part.pi, Uint8Array), pal = part.p.map(c => [c[0] / 255, c[1] / 255, c[2] / 255]);
  const g = GB(), k = 1 / 64;
  let y0 = 1e9, y1 = -1e9;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ax = V[a] * k, ay = V[a + 1] * k, az = V[a + 2] * k, bx = V[b] * k, by = V[b + 1] * k, bz = V[b + 2] * k, cx = V[c] * k, cy = V[c + 1] * k, cz = V[c + 2] * k;
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const col = pal[PI[t / 3]] || [1, 1, 1];
    gv(g, ax, ay, az, nx, ny, nz, col, 0, 0); gv(g, bx, by, bz, nx, ny, nz, col, 0, 0); gv(g, cx, cy, cz, nx, ny, nz, col, 0, 0);
    y0 = Math.min(y0, ay, by, cy); y1 = Math.max(y1, ay, by, cy);
  }
  mkMesh(name, g);
  return { y0, y1 };
}
function mdlInit() {
  if (MDL.ready || !GLX.ok || typeof MODELDATA === 'undefined') return MDL.ready;
  for (const wid in MODELDATA.guns) {
    const G = MODELDATA.guns[wid];
    MDL.guns[wid] = { len: G.len, box: G.box, parts: G.parts.map((p, i) => { _mdlMesh('mg_' + wid + '_' + i, p); return { mesh: 'mg_' + wid + '_' + i, r: p.r, c: p.c }; }) };
  }
  MDL.ready = true;
  return true;
}
/* silahın 3B modeli (kendi modeli yoksa WEAPONS[wid].mdl, o da yoksa tabanca) */
function mdlGun(wid) { const w = WEAPONS[wid]; return MDL.guns[wid] || (w && w.mdl && MDL.guns[w.mdl]) || MDL.guns.classic; }
/* Silah modeli: yerel +X namlu, +Y yukarı, +Z sağ; başlangıç noktası kabza */
const GUN_STYLE = {
  railgun: { main: hexRGB('#1d2733'), dark: hexRGB('#2e3d4d'), acc: hexRGB('#7cf3ff'), glow: 0.9 },
  phantom: { main: hexRGB('#c3cad1'), dark: hexRGB('#2b3138'), acc: hexRGB('#5d6670'), glow: 0 },
  operator: { main: hexRGB('#3e4a3b'), dark: hexRGB('#1c1f22'), acc: hexRGB('#2b3138'), glow: 0 },
  admin: { main: hexRGB('#d9a92e'), dark: hexRGB('#2a2012'), acc: hexRGB('#fff0a0'), glow: 1, glowMain: 0.25 }
};
function gunColsFor(wid, p, t) {
  if (wid === 'sword') {
    const tier = clamp((p && p.swt) | 0, 0, SWORD_MAX), T = SWORD_TIERS[tier], key = 'swc' + tier;
    if (_SKC[key]) return _SKC[key];
    return (_SKC[key] = { main: hexRGB(T.c[0]), dark: hexRGB(T.c[3]), acc: hexRGB(T.c[2]), glowMain: T.glow || 0 });
  }
  const sk = p && p.wsk && wid !== 'admin' ? WSK[p.wsk] : null; // admin silahı her zaman altın
  if (!sk) {
    const key = 'gc' + wid; if (_SKC[key]) return _SKC[key];
    const G = mdlGun(wid), S0 = GUN_STYLE[wid] || {}, o = { glow: S0.glow || 0, glowMain: S0.glowMain || 0 };
    for (const pt of G.parts) o[pt.r] = S0[pt.r] || pt.c;
    return (_SKC[key] = o);
  }
  const anim = skAnim(sk), tt = t || 0;
  if (!anim && _SKC['gs' + wid + sk.id]) return _SKC['gs' + wid + sk.id];
  const o = { main: sk.rb ? rbCol(tt) : sk.duo ? mixRGB(hexRGB(sk.c[0]), hexRGB(sk.duo), duoK(tt)) : hexRGB(sk.c[0]), dark: hexRGB(sk.c[1]), acc: sk.rb ? rbCol(tt, 0.5) : hexRGB(sk.c[2]),
    glow: sk.glow ? 0.65 * (sk.pulse ? pulseK(tt) : 1) : 0, glowMain: sk.pulse && sk.glow ? 0.12 * pulseK(tt) : 0 };
  if (!anim) _SKC['gs' + wid + sk.id] = o;
  return o;
}
function drawGunModel(wid, x, h, z, R, sc, o, cols, alpha) {
  const G = mdlGun(wid), A = alpha === undefined ? 1 : alpha;
  for (const pt of G.parts) {
    const c = cols[pt.r] || pt.c, gl = pt.r === 'acc' ? cols.glow : pt.r === 'main' ? cols.glowMain : 0;
    const oo = gl ? Object.assign({}, o || {}, { em: [c[0] * gl, c[1] * gl, c[2] * gl] }) : o;
    QR(pt.mesh, x, h, z, R, sc, sc, sc, [c[0], c[1], c[2], A], oo);
  }
}
