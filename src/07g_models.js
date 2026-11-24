/* =====================================================================
   07g · 3B MODEL ÇİZİMİ (01d_models verisiyle)
        Karakter: iskelet + animasyon (çalışma anında ileri kinematik).
          · alt gövde: durma / koşu (ileri, geri, sola, sağa) karışımı
          · üst gövde: nişan pozu, kılıç pozu, kılıç savurma, el sallama
          · nişan açısı gövdeyi eğer, eğilince bacaklar bükülür
          · her kemik kendi katı parçasını taşır (parça başına tek çizim)
        Silahlar: rol (ana / koyu / vurgu) başına bir parça; skin renkleri rollere uygulanır.
   ===================================================================== */
const MDL = { ready: false, ch: null, guns: {}, cT: new Map() };
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
  const C = MODELDATA.char, nb = C.track.length;
  const ch = MDL.ch = { nb, names: C.track, upper: C.upper, piv: C.piv, ps: C.ps, fps: C.fps, parts: [], clips: {} };
  ch.bi = n => C.track.indexOf(n);
  for (const k in C.clips) { const c = C.clips[k]; ch.clips[k] = { d: c.d, n: c.n, q: _b64(c.q, Int16Array), t: _b64(c.t, Int16Array) }; }
  let headTop = 0;
  C.parts.forEach((p, i) => { const r = _mdlMesh('mc' + i, p); ch.parts.push({ mesh: 'mc' + i, b: p.b, r: p.r }); if (C.track[p.b] === 'Head') headTop = Math.max(headTop, r.y1); });
  const B = ch.B = {}; for (const n of ['Body', 'Hips', 'Abdomen', 'Chest', 'Head', 'WristR', 'WristL', 'UpperArmL', 'UpperArmR', 'LowerArmL', 'LowerArmR', 'UpperLegL', 'UpperLegR', 'LowerLegL', 'LowerLegR', 'FootL', 'FootR']) B[n] = ch.bi(n);
  ch.headTop = [ch.piv.neck ? ch.piv.neck[0] : 0, headTop || 74, ch.piv.neck ? ch.piv.neck[2] : 0];
  ch.chestBack = [-9, 50, 0];
  ch.T = Array.from({ length: nb }, () => new Float32Array(16));
  ch.acc = new Float32Array(nb * 7); ch.wsum = new Float32Array(nb);
  for (const wid in MODELDATA.guns) {
    const G = MODELDATA.guns[wid];
    MDL.guns[wid] = { len: G.len, box: G.box, parts: G.parts.map((p, i) => { _mdlMesh('mg_' + wid + '_' + i, p); return { mesh: 'mg_' + wid + '_' + i, r: p.r, c: p.c }; }) };
  }
  MDL.ready = true;
  return true;
}
/* ---------- matris yardımcıları ---------- */
function _m4QT(o, qx, qy, qz, qw, tx, ty, tz) {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz, xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2, wx = qw * x2, wy = qw * y2, wz = qw * z2;
  o[0] = 1 - (yy + zz); o[1] = xy + wz; o[2] = xz - wy; o[3] = 0;
  o[4] = xy - wz; o[5] = 1 - (xx + zz); o[6] = yz + wx; o[7] = 0;
  o[8] = xz + wy; o[9] = yz - wx; o[10] = 1 - (xx + yy); o[11] = 0;
  o[12] = tx; o[13] = ty; o[14] = tz; o[15] = 1; return o;
}
/* M ← (T(p)·Rz(a)·T(-p))·M : karakter uzayında p noktası etrafında sağ eksen (Z) döndürmesi */
function _rotAbout(M, px, py, a) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let k = 0; k < 4; k++) {
    const q = k === 3, x = M[k * 4] - (q ? px : 0), y = M[k * 4 + 1] - (q ? py : 0);
    M[k * 4] = x * c - y * s + (q ? px : 0); M[k * 4 + 1] = x * s + y * c + (q ? py : 0);
  }
}
function _xp(M, p) { return [M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]]; }
/* Poz: katman = [klip, zaman(sn), ağırlık]; üst gövde kemikleri 'up' katmanlarından (varsa) — kemik başına karakter uzayı dönüşümü */
function mdlPose(ch, low, up, pitch, crouch) {
  const nb = ch.nb, A = ch.acc, WS = ch.wsum, k = 1 / ch.ps;
  A.fill(0); WS.fill(0);
  const sample = (layers, part) => {
    for (const [ck, time, w] of layers) {
      if (w <= 0.001) continue;
      const c = ch.clips[ck]; if (!c) continue;
      const f = clamp(time, 0, c.d) * ch.fps, i0 = Math.min(c.n - 1, Math.floor(f)), i1 = Math.min(c.n - 1, i0 + 1), fr = f - i0;
      for (let b = 0; b < nb; b++) {
        if (part >= 0 && ch.upper[b] !== part) continue;
        const q0 = (i0 * nb + b) * 4, q1 = (i1 * nb + b) * 4, t0 = (i0 * nb + b) * 3, t1 = (i1 * nb + b) * 3, o = b * 7;
        let qx = c.q[q0] + (c.q[q1] - c.q[q0]) * fr, qy = c.q[q0 + 1] + (c.q[q1 + 1] - c.q[q0 + 1]) * fr, qz = c.q[q0 + 2] + (c.q[q1 + 2] - c.q[q0 + 2]) * fr, qw = c.q[q0 + 3] + (c.q[q1 + 3] - c.q[q0 + 3]) * fr;
        if (A[o + 3] * qx + A[o + 4] * qy + A[o + 5] * qz + A[o + 6] * qw < 0) { qx = -qx; qy = -qy; qz = -qz; qw = -qw; }
        A[o + 3] += qx * w; A[o + 4] += qy * w; A[o + 5] += qz * w; A[o + 6] += qw * w;
        A[o] += (c.t[t0] + (c.t[t1] - c.t[t0]) * fr) * k * w; A[o + 1] += (c.t[t0 + 1] + (c.t[t1 + 1] - c.t[t0 + 1]) * fr) * k * w; A[o + 2] += (c.t[t0 + 2] + (c.t[t1 + 2] - c.t[t0 + 2]) * fr) * k * w;
        WS[b] += w;
      }
    }
  };
  if (up) { sample(low, 0); sample(up, 1); } else sample(low, -1);
  const T = ch.T;
  for (let b = 0; b < nb; b++) {
    const o = b * 7, l = Math.hypot(A[o + 3], A[o + 4], A[o + 5], A[o + 6]) || 1, ws = WS[b] || 1;
    _m4QT(T[b], A[o + 3] / l, A[o + 4] / l, A[o + 5] / l, A[o + 6] / l, A[o] / ws, A[o + 1] / ws, A[o + 2] / ws);
  }
  const B = ch.B, P = ch.piv;
  // eğilme: gövde iner, uyluk öne, kaval geri döner; ayaklar yerde kalır
  if (crouch > 0.001 && P.hipL && P.kneeL) {
    const L = (P.hipL[1] - P.kneeL[1]) + (P.kneeL[1] - (P.ankL ? P.ankL[1] : 0)), a = Math.acos(clamp(1 - 17 * crouch / L, 0.2, 1)), drop = L * (1 - Math.cos(a));
    for (let b = 0; b < nb; b++) if (b !== B.FootL && b !== B.FootR) T[b][13] -= drop;
    for (const [ul, ll, hp, kp] of [[B.UpperLegL, B.LowerLegL, P.hipL, P.kneeL], [B.UpperLegR, B.LowerLegR, P.hipR, P.kneeR]]) {
      if (ul < 0 || ll < 0) continue;
      const h = _xp(T[ul], hp);
      _rotAbout(T[ul], h[0], h[1], a); _rotAbout(T[ll], h[0], h[1], a);
      const kn = _xp(T[ll], kp); _rotAbout(T[ll], kn[0], kn[1], -2 * a);
    }
    const ab = _xp(T[B.Hips >= 0 ? B.Hips : B.Body], P.abd);
    for (let b = 0; b < nb; b++) if (ch.upper[b]) _rotAbout(T[b], ab[0], ab[1], -0.22 * crouch);
  }
  // nişan açısı: üst gövde karın noktası etrafında eğilir
  if (pitch) { const ab = _xp(T[B.Hips >= 0 ? B.Hips : B.Body], P.abd); for (let b = 0; b < nb; b++) if (ch.upper[b]) _rotAbout(T[b], ab[0], ab[1], pitch * 0.85); }
  return T;
}
const _mC = new Float32Array(16), _mP = new Float32Array(16);
/* Karakter çiz. st: { low, up, pitch, crouch, R(3x3), x, y, lift, cols, alpha, o, xray, accGlow } → kemik dönüşümleri */
function mdlDrawChar(p, st) {
  const ch = MDL.ch, T = mdlPose(ch, st.low, st.up, st.pitch, st.crouch), R = st.R;
  _mC[0] = R[0]; _mC[1] = R[1]; _mC[2] = R[2]; _mC[3] = 0; _mC[4] = R[3]; _mC[5] = R[4]; _mC[6] = R[5]; _mC[7] = 0;
  _mC[8] = R[6]; _mC[9] = R[7]; _mC[10] = R[8]; _mC[11] = 0; _mC[12] = st.x; _mC[13] = st.lift; _mC[14] = st.y; _mC[15] = 1;
  for (const pt of ch.parts) {
    m4Mul(_mP, _mC, T[pt.b]);
    const c = st.xray ? [1, 0.25, 0.3, 0.45] : pt.r === 'fix' ? [1, 1, 1, st.alpha] : st.cols[pt.r];
    QM(pt.mesh, _mP, c, st.xray ? st.o : pt.r === 'acc' && st.accGlow ? st.accGlow : st.o);
  }
  return T;
}
/* Dinlenme pozundaki bir noktanın (kemik b'ye bağlı) şu anki dünya konumu */
function mdlPt(T, b, st, rest) {
  const q = _xp(T[b], rest), R = st.R;
  return [st.x + R[0] * q[0] + R[3] * q[1] + R[6] * q[2], st.lift + R[1] * q[0] + R[4] * q[1] + R[7] * q[2], st.y + R[2] * q[0] + R[5] * q[1] + R[8] * q[2]];
}
/* Silah modeli: yerel +X namlu, +Y yukarı, +Z sağ; başlangıç noktası kabza */
const GUN_STYLE = {
  railgun: { main: hexRGB('#1d2733'), dark: hexRGB('#2e3d4d'), acc: hexRGB('#7cf3ff'), glow: 0.9 },
  phantom: { main: hexRGB('#c3cad1'), dark: hexRGB('#2b3138'), acc: hexRGB('#5d6670'), glow: 0 },
  operator: { main: hexRGB('#3e4a3b'), dark: hexRGB('#1c1f22'), acc: hexRGB('#2b3138'), glow: 0 }
};
function gunColsFor(wid, p, t) {
  if (wid === 'sword') {
    const tier = clamp((p && p.swt) | 0, 0, SWORD_MAX), T = SWORD_TIERS[tier], key = 'swc' + tier;
    if (_SKC[key]) return _SKC[key];
    return (_SKC[key] = { main: hexRGB(T.c[0]), dark: hexRGB(T.c[3]), acc: hexRGB(T.c[2]), glowMain: T.glow || 0 });
  }
  const sk = p && p.wsk ? WSK[p.wsk] : null;
  if (!sk) {
    const key = 'gc' + wid; if (_SKC[key]) return _SKC[key];
    const G = MDL.guns[wid], S0 = GUN_STYLE[wid] || {}, o = { glow: S0.glow || 0 };
    for (const pt of G.parts) o[pt.r] = S0[pt.r] || pt.c;
    return (_SKC[key] = o);
  }
  if (!sk.rb && _SKC['gs' + wid + sk.id]) return _SKC['gs' + wid + sk.id];
  const o = { main: sk.rb ? rbCol(t || 0) : hexRGB(sk.c[0]), dark: hexRGB(sk.c[1]), acc: sk.rb ? rbCol(t || 0, 0.5) : hexRGB(sk.c[2]), glow: sk.glow ? 0.65 : 0 };
  if (!sk.rb) _SKC['gs' + wid + sk.id] = o;
  return o;
}
function drawGunModel(wid, x, h, z, R, sc, o, cols, alpha) {
  const G = MDL.guns[wid] || MDL.guns.classic, A = alpha === undefined ? 1 : alpha;
  for (const pt of G.parts) {
    const c = cols[pt.r] || pt.c, gl = pt.r === 'acc' ? cols.glow : pt.r === 'main' ? cols.glowMain : 0;
    const oo = gl ? Object.assign({}, o || {}, { em: [c[0] * gl, c[1] * gl, c[2] * gl] }) : o;
    QR(pt.mesh, x, h, z, R, sc, sc, sc, [c[0], c[1], c[2], A], oo);
  }
}
/* ---------- karakter animasyon durumu ---------- */
function mdlCharState(p, t, ek, et) {
  const m = p._md || (p._md = { t: t, ph: 0, px: p.x, py: p.y, w: [0, 0, 0, 0], mv: 0 });
  const dt = clamp(t - m.t, 0, 0.1); m.t = t;
  const ch = MDL.ch, dx = p.x - m.px, dy = p.y - m.py; m.px = p.x; m.py = p.y;
  const mvT = clamp((p.spd || 0) / RUN, 0, 1); m.mv += (mvT - m.mv) * Math.min(1, dt * 10);
  // hareket yönü (bakış yönüne göre): ileri / geri / sol / sağ ağırlıkları
  if (Math.hypot(dx, dy) > 0.05) {
    const r = Math.atan2(dy, dx) - p.ang, f = Math.cos(r), s = Math.sin(r), n = Math.abs(f) + Math.abs(s) || 1;
    const tw = [Math.max(0, f) / n, Math.max(0, -f) / n, Math.max(0, -s) / n, Math.max(0, s) / n];
    for (let i = 0; i < 4; i++) m.w[i] += (tw[i] - m.w[i]) * Math.min(1, dt * 8);
  }
  m.ph = (m.ph + dt * (0.35 + m.mv) / 0.8) % 1;
  const mv = m.mv, ws = m.w, run = (k, i) => [k, m.ph * ch.clips[k].d, mv * ws[i]];
  const low = [['idle', (t % 1.66), 1 - mv], run('run', 0), run('back', 1), run('left', 2), run('right', 3)];
  return low;
}
