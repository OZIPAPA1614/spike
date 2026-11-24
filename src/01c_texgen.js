/* =====================================================================
   01c · DOKU ÜRETECİ (tamamen kodla üretilir — dışarıdan alınmış fotoğraf yok)
   Duvar, kasa ve zemin ayrıntı dokuları ilk kullanıldıklarında tohumlu gürültü
   (değer gürültüsü + fbm), hücresel (Worley) gürültü ve çizimle üretilir.
   Hepsi dikişsizdir (kenarları birbirine uyar), ilk kullanımda önbelleğe alınır.
   Ayrıntı (_d) dokuları gri ve ortalaması ~0.5'tir: zemin rengini değiştirmez,
   yalnızca malzeme dokusu ekler (shader'da ×2 ile çarpılır).
   ===================================================================== */
const TEXGEN = (() => {
  const rng = seed => { let s = seed | 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  const mix = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  /* dikişsiz değer gürültüsü: P×P kafes, (x, y) kafes biriminde */
  function vnoise(seed, P) {
    const R = rng(seed), g = new Float32Array(P * P);
    for (let i = 0; i < g.length; i++) g[i] = R();
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const x0 = ((xi % P) + P) % P, y0 = ((yi % P) + P) % P, x1 = (x0 + 1) % P, y1 = (y0 + 1) % P;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const a = g[y0 * P + x0], b = g[y0 * P + x1], c = g[y1 * P + x0], d = g[y1 * P + x1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }
  /* fbm: u, v ∈ [0,1) doku koordinatı; fx/fy temel frekans (tam sayı → dikişsiz) */
  function fbm(seed, fx, fy, oct, gain) {
    const ns = [], P = Math.max(fx, fy);
    for (let k = 0; k < oct; k++) ns.push(vnoise(seed + k * 7919, P << k));
    const g = gain || 0.5;
    return (u, v) => {
      let s = 0, a = 1, n = 0;
      for (let k = 0; k < oct; k++) { const m = 1 << k; s += a * ns[k](u * fx * m, v * fy * m); n += a; a *= g; }
      return s / n;
    };
  }
  /* dikişsiz hücresel gürültü: N×N hücre, her hücrede bir nokta → F1, F2, hücre kimliği */
  function worley(seed, N) {
    const R = rng(seed), px = new Float32Array(N * N), py = new Float32Array(N * N), id = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) { px[i] = R(); py[i] = R(); id[i] = R(); }
    const out = { f1: 0, f2: 0, id: 0, dx: 0, dy: 0 };
    return (u, v) => {
      const x = u * N, y = v * N, cx = Math.floor(x), cy = Math.floor(y);
      let f1 = 9, f2 = 9, best = 0, bdx = 0, bdy = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const gx = cx + i, gy = cy + j, wx = ((gx % N) + N) % N, wy = ((gy % N) + N) % N, k = wy * N + wx;
        const dx = gx + px[k] - x, dy = gy + py[k] - y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < f1) { f2 = f1; f1 = d; best = k; bdx = dx; bdy = dy; } else if (d < f2) f2 = d;
      }
      out.f1 = f1; out.f2 = f2; out.id = id[best]; out.dx = bdx; out.dy = bdy; return out;
    };
  }
  /* piksel döngüsü: fn(u, v, x, y, out[3]) → RGB 0..255 */
  function paint(N, fn) {
    const c = document.createElement('canvas'); c.width = c.height = N;
    const x2 = c.getContext('2d'), img = x2.createImageData(N, N), d = img.data, o = [0, 0, 0];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      fn(x / N, y / N, x, y, o);
      const k = (y * N + x) * 4; d[k] = cl(o[0], 0, 255); d[k + 1] = cl(o[1], 0, 255); d[k + 2] = cl(o[2], 0, 255); d[k + 3] = 255;
    }
    x2.putImageData(img, 0, 0);
    return c;
  }
  /* gri ayrıntı dokusu: parlaklığı ortalama 127, istenen sapmaya ölçekle */
  function detail(N, sd, fn, tint) {
    const L = new Float32Array(N * N); let m = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = fn(x / N, y / N, x, y); L[y * N + x] = v; m += v; }
    m /= N * N; let s = 0; for (let i = 0; i < L.length; i++) s += (L[i] - m) * (L[i] - m);
    const k = sd / (Math.sqrt(s / L.length) || 1), t = tint || [1, 1, 1];
    return paint(N, (u, v, x, y, o) => { const l = 127 + (L[y * N + x] - m) * k; o[0] = l * t[0]; o[1] = l * t[1]; o[2] = l * t[2]; });
  }
  /* tuğla düzeni: (u,v) → { bx, by, fx, fy, row, col } — sıralar yarım kaydırılmış */
  function brickAt(u, v, cols, rows, mortar, out) {
    const ry = v * rows, row = Math.floor(ry), fy = ry - row;
    const rx = u * cols + (row % 2 ? 0.5 : 0), col = Math.floor(rx), fx = rx - col;
    out.row = row; out.col = ((col % cols) + cols) % cols; out.fx = fx; out.fy = fy;
    const ex = Math.min(fx, 1 - fx) * (1 / cols) * 512, ey = Math.min(fy, 1 - fy) * (1 / rows) * 512; // kenara uzaklık (512 px ölçeğinde)
    out.edge = Math.min(ex, ey); out.mortar = out.edge < mortar;
    return out;
  }
  const B = {};
  const G = {
    /* katmanlı dökme beton: yatay döküm katmanları, lekeler, akıntı izleri, küçük boşluklar */
    concrete_layers(N) {
      const n1 = fbm(11, 4, 4, 5, 0.55), n2 = fbm(12, 8, 1, 3), streak = fbm(13, 32, 2, 3), grain = fbm(14, 64, 64, 2), lay = vnoise(15, 16);
      const R = rng(16), pits = []; for (let i = 0; i < 260; i++) pits.push([R(), R(), 0.8 + R() * 2.2]);
      const pit = new Float32Array(N * N);
      for (const [pu, pv, r] of pits) { const cx = pu * N, cy = pv * N, rr = r * N / 512; for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const d = Math.hypot(i, j); if (d < rr + 1) { const xx = ((Math.round(cx) + i) % N + N) % N, yy = ((Math.round(cy) + j) % N + N) % N; pit[yy * N + xx] = Math.max(pit[yy * N + xx], cl(rr + 1 - d, 0, 1)); } } }
      return paint(N, (u, v, x, y, o) => {
        const w = v * 7 + (n2(u, v) - 0.5) * 0.9, li = Math.floor(w), lf = w - li;
        const layer = (lay(li * 3.7, 0.5) - 0.5) * 14 + (lf < 0.05 ? -9 * (1 - lf / 0.05) : 0); // katman sınırında ince koyu çizgi
        const st = (n1(u, v) - 0.5) * 26, dr = (streak(u, v) - 0.5) * 12 * (0.4 + v * 0.6), gr = (grain(u, v) - 0.5) * 10 + (Math.random() - 0.5) * 7;
        const b = 104 + layer + st + dr + gr - pit[y * N + x] * 38;
        o[0] = b * 1.04; o[1] = b * 0.97; o[2] = b * 0.91;
      });
    },
    /* kırmızı tuğla: tuğla başına renk farkı, pişme lekeleri, açık renk harç, pahlı kenarlar */
    medieval_red_brick(N) {
      const n = fbm(21, 16, 16, 4), big = fbm(22, 4, 4, 3), mort = fbm(23, 32, 32, 2), bk = {}, R = rng(24), cols = 8, rows = 16;
      const tone = (r, c) => { const k = r * 64 + c; if (!bk[k]) { const t = R(); bk[k] = [t, R(), R()]; } return bk[k]; };
      const out = {};
      return paint(N, (u, v, x, y, o) => {
        brickAt(u, v, cols, rows, 3.2, out);
        const g = (n(u, v) - 0.5), gr = (Math.random() - 0.5) * 10;
        if (out.mortar) { const m = 150 + (mort(u, v) - 0.5) * 40 + gr; o[0] = m * 1.02; o[1] = m * 0.96; o[2] = m * 0.88; return; }
        const [t, t2, t3] = tone(out.row, out.col);
        let r = mix(128, 176, t), gg = mix(56, 92, t * 0.6 + t2 * 0.4), bb = mix(40, 70, t2);
        if (t3 > 0.86) { r *= 0.62; gg *= 0.6; bb *= 0.62; } // fırında yanmış tuğla
        const bev = sstep(3.2, 7, out.edge), k = 0.78 + 0.22 * bev + g * 0.38 + (big(u, v) - 0.5) * 0.2;
        o[0] = r * k + gr; o[1] = gg * k + gr; o[2] = bb * k + gr;
      });
    },
    /* çatlaklı, çukurlu kaya (açık turuncu-kum rengi) */
    rock_pitted_mossy(N) {
      const W1 = worley(31, 5), W2 = worley(32, 13), n = fbm(33, 8, 8, 5, 0.55), m = fbm(34, 4, 4, 3), wx = fbm(35, 4, 4, 3), wy = fbm(36, 4, 4, 3), mask = fbm(37, 6, 6, 3);
      return paint(N, (u, v, x, y, o) => {
        // alan bükme: çatlaklar düz hücre kenarı gibi değil, kırık ve dolambaçlı olsun
        const du = u + (wx(u, v) - 0.5) * 0.16, dv = v + (wy(u, v) - 0.5) * 0.16;
        const a = W1(du, dv), crack1 = sstep(0.0, 0.05, a.f2 - a.f1), plate = a.id, mk = sstep(0.38, 0.55, mask(u, v));
        const b = W2(du + 0.03, dv), crack2 = sstep(0.0, 0.03, b.f2 - b.f1);
        const g = n(u, v) - 0.5, pitd = b.f1 < 0.08 && b.id > 0.55 ? (0.08 - b.f1) * 5 : 0;
        let k = 1 + g * 0.5 + (plate - 0.5) * 0.1 - (1 - crack1) * 0.45 * mk - (1 - crack2) * 0.22 * (1 - mk * 0.5) - pitd * 2 + (Math.random() - 0.5) * 0.06;
        const moss = sstep(0.64, 0.78, m(u, v)) * 0.3;
        o[0] = (196 * (1 - moss) + 120 * moss) * k; o[1] = (156 * (1 - moss) + 140 * moss) * k; o[2] = (116 * (1 - moss) + 70 * moss) * k;
      });
    },
    /* koyu, yosunlu tuğla: harç aralarında ve lekeler hâlinde yeşil yosun */
    mossy_brick(N) {
      const n = fbm(41, 16, 16, 4), moss = fbm(42, 6, 6, 4, 0.6), fine = fbm(43, 64, 64, 2), bk = {}, R = rng(44), out = {};
      const tone = (r, c) => { const k = r * 64 + c; return bk[k] || (bk[k] = [R(), R()]); };
      return paint(N, (u, v, x, y, o) => {
        brickAt(u, v, 7, 15, 4.5, out);
        const ms = moss(u, v), f = (fine(u, v) - 0.5), gr = (Math.random() - 0.5) * 6;
        if (out.mortar) { const g = (0.45 + f * 0.8) * (0.55 + ms * 0.6); o[0] = 66 * g + gr; o[1] = 88 * g + gr; o[2] = 18 * g; return; }
        const [t, t2] = tone(out.row, out.col), k = 0.7 + 0.3 * sstep(4.5, 9, out.edge) + (n(u, v) - 0.5) * 0.5;
        let r = mix(34, 58, t), g = mix(26, 42, t2), b = mix(12, 22, t);
        const mm = sstep(0.68, 0.8, ms + (1 - sstep(4.5, 12, out.edge)) * 0.1) * 0.8;
        r = mix(r, 52, mm); g = mix(g, 70, mm); b = mix(b, 14, mm);
        o[0] = r * k + gr; o[1] = g * k + gr; o[2] = b * k + gr;
      });
    },
    /* düz boyalı beton: çok hafif dalgalanma ve silik lekeler */
    painted_concrete_02(N) {
      const n = fbm(51, 3, 3, 4), s = fbm(52, 12, 12, 3), W = worley(53, 5);
      return paint(N, (u, v, x, y, o) => {
        const a = W(u, v), smudge = a.f1 < 0.12 && a.id > 0.6 ? (0.12 - a.f1) * 30 : 0;
        const b = 84 + (n(u, v) - 0.5) * 10 + (s(u, v) - 0.5) * 4 - smudge + (Math.random() - 0.5) * 3;
        o[0] = b * 1.03; o[1] = b * 0.98; o[2] = b * 0.92;
      });
    },
    /* sarı boyalı, paslanmış metal levha: pas adacıkları, akıntılar, dökülmüş boya */
    rusty_metal_03(N) {
      const big = fbm(61, 4, 4, 5, 0.6), mid = fbm(62, 12, 12, 4), run = fbm(63, 24, 2, 3), fine = fbm(64, 64, 64, 2), sp = worley(65, 22);
      return paint(N, (u, v, x, y, o) => {
        const b = big(u, v), r1 = sstep(0.46, 0.55, b + (mid(u, v) - 0.5) * 0.4), drip = sstep(0.6, 0.78, run(u, v)) * (0.4 + v * 0.6);
        const w = sp(u, v), spot = w.f1 < 0.18 && w.id > 0.72 ? sstep(0.18, 0.05, w.f1) : 0;
        const rust = cl(Math.max(r1, drip * 0.8, spot), 0, 1), f = (fine(u, v) - 0.5), gr = (Math.random() - 0.5) * 8;
        const dark = sstep(0.68, 0.82, b) * 0.45;
        const pr = 196 + f * 30, pg = 140 + f * 26, pb = 26 + f * 10;          // sarı boya
        const rr = (128 - dark * 60) * (0.8 + f * 0.9), rg = (62 - dark * 30) * (0.8 + f * 0.9), rb = (22 - dark * 10) * (0.8 + f); // pas
        o[0] = mix(pr, rr, rust) + gr; o[1] = mix(pg, rg, rust) + gr; o[2] = mix(pb, rb, rust) + gr * 0.4;
      });
    },
    /* yıpranmış kahverengi tahta: yatay kalaslar, damar, ekler, çivi */
    weathered_brown_planks(N) {
      const rows = 12, grain = vnoise(71, 64), ring = fbm(72, 2, 16, 3), wear = fbm(73, 4, 4, 4), R = rng(74);
      const joints = [], tones = [];
      for (let r = 0; r < rows; r++) { joints.push([R(), R() < 0.5 ? R() : -1]); tones.push([R(), R()]); }
      return paint(N, (u, v, x, y, o) => {
        const ry = v * rows, row = Math.floor(ry), fy = ry - row, J = joints[row], T = tones[row];
        let seg = 0, ed = 1;
        for (const j of J) if (j >= 0) { const d = Math.abs(u - j); const dd = Math.min(d, 1 - d); ed = Math.min(ed, dd); if (u >= j) seg++; }
        const gx = u * 4 + seg * 1.7 + row * 0.37, gy = v * rows * 6;
        const gtex = grain(gx * 4, gy * 1.1) * 0.6 + ring(u + seg * 0.31, v) * 0.8;
        const fib = Math.sin((gtex * 9 + v * rows * 3.1) * Math.PI) * 0.5 + 0.5;
        const tone = mix(0.82, 1.15, T[0]) * (seg % 2 ? mix(0.9, 1.05, T[1]) : 1);
        let k = tone * (0.78 + fib * 0.22 + (wear(u, v) - 0.5) * 0.35) + (Math.random() - 0.5) * 0.06;
        const gap = Math.min(fy, 1 - fy) * (N / rows);
        if (gap < 1.6) k *= 0.3 + gap * 0.2; else if (gap < 4) k *= 0.82 + (gap - 1.6) * 0.07;
        if (ed * N < 1.4) k *= 0.35;
        for (const j of J) if (j >= 0) { const nx = (j + 0.018) * N, ny = (row + 0.5) * N / rows; for (const sy of [-0.25, 0.25]) if (Math.hypot(x - nx, y - ny - sy * N / rows) < 2.4 * N / 512) k = 0.45; }
        o[0] = 100 * k; o[1] = 78 * k; o[2] = 58 * k;
      });
    },
    /* --- zemin ayrıntı dokuları (gri, ortalama 127) --- */
    concrete_tiles_d(N) {
      const n = fbm(81, 8, 8, 4), t = vnoise(82, 8), f = fbm(83, 64, 64, 2);
      return detail(N, 8, (u, v) => {
        const tx = u * 8, ty = v * 8, ix = Math.floor(tx), iy = Math.floor(ty), ex = Math.min(tx - ix, 1 - tx + ix), ey = Math.min(ty - iy, 1 - ty + iy);
        const grout = Math.min(ex, ey) < 0.025 ? -14 : Math.min(ex, ey) < 0.05 ? -4 : 0;
        return (t(ix + 0.5, iy + 0.5) - 0.5) * 10 + (n(u, v) - 0.5) * 14 + (f(u, v) - 0.5) * 8 + grout + (Math.random() - 0.5) * 4;
      });
    },
    gravel_embedded_concrete_d(N) {
      const W = worley(91, 48), W2 = worley(92, 90), n = fbm(93, 6, 6, 3);
      return detail(N, 13, (u, v) => {
        const a = W(u, v), b = W2(u, v), peb = a.f1 < 0.36 ? (a.id - 0.5) * 30 * sstep(0.36, 0.22, a.f1) : 0, small = b.f1 < 0.3 ? (b.id - 0.5) * 18 : 0;
        return peb + small + (n(u, v) - 0.5) * 10 + (Math.random() - 0.5) * 12;
      });
    },
    mud_cracked_dry_03_d(N) {
      const W = worley(101, 9), W2 = worley(102, 22), n = fbm(103, 8, 8, 4);
      return detail(N, 9, (u, v) => {
        const a = W(u, v), b = W2(u, v), c1 = sstep(0.0, 0.045, a.f2 - a.f1), c2 = sstep(0.0, 0.03, b.f2 - b.f1);
        return -(1 - c1) * 40 - (1 - c2) * 14 * (a.id > 0.4 ? 1 : 0.3) + a.f1 * 10 + (n(u, v) - 0.5) * 12 + (Math.random() - 0.5) * 3;
      });
    },
    snow_02_d(N) {
      const n = fbm(111, 4, 4, 5, 0.55), W = worley(112, 7);
      return detail(N, 5, (u, v) => { const a = W(u, v); return (n(u, v) - 0.5) * 20 + (a.f1 < 0.1 && a.id > 0.7 ? -(0.1 - a.f1) * 60 : 0) + (Math.random() - 0.5) * 2.5; });
    },
    granular_concrete_d(N) {
      const n = fbm(121, 6, 6, 4), f = fbm(122, 96, 96, 2);
      return detail(N, 7, (u, v) => (n(u, v) - 0.5) * 10 + (f(u, v) - 0.5) * 12 + (Math.random() - 0.5) * 14);
    },
    /* orman zemini: dağınık yapraklar (çizimle, kenarlarda sarmalanarak) */
    leaves_forest_ground_d(N) {
      const c = document.createElement('canvas'); c.width = c.height = N;
      const x = c.getContext('2d'), R = rng(131), s = N / 512;
      x.fillStyle = 'rgb(96,100,98)'; x.fillRect(0, 0, N, N);
      const cols = ['rgb(150,156,170)', 'rgb(132,138,150)', 'rgb(170,174,180)', 'rgb(168,150,96)', 'rgb(176,158,92)', 'rgb(112,116,120)', 'rgb(84,88,86)', 'rgb(120,128,104)'];
      const leaf = (cx, cy, r, a, col) => {
        x.save(); x.translate(cx, cy); x.rotate(a); x.fillStyle = col;
        x.beginPath(); x.moveTo(-r, 0); x.quadraticCurveTo(0, -r * 0.55, r, 0); x.quadraticCurveTo(0, r * 0.55, -r, 0); x.fill();
        x.strokeStyle = 'rgba(40,40,40,0.35)'; x.lineWidth = 1 * s; x.beginPath(); x.moveTo(-r * 1.15, 0); x.lineTo(r * 0.9, 0); x.stroke(); x.restore();
      };
      for (let i = 0; i < 2600; i++) {
        const cx = R() * N, cy = R() * N, r = (3.5 + R() * 7) * s, a = R() * TAU, col = cols[Math.floor(R() * cols.length)];
        for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) if (cx + ox > -30 * s && cx + ox < N + 30 * s && cy + oy > -30 * s && cy + oy < N + 30 * s) leaf(cx + ox, cy + oy, r, a, col);
      }
      // ortalama 127, sapma ~26 (renk tonu korunur, zemin rengini boğmaz)
      const img = x.getImageData(0, 0, N, N), d = img.data; let m = 0, q = 0;
      for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; m += l; q += l * l; }
      m /= N * N; const sd = Math.sqrt(Math.max(1, q / (N * N) - m * m)), k = 26 / sd;
      for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = 127 + (d[i + c] - m) * k;
      x.putImageData(img, 0, 0);
      return c;
    }
  };
  return {
    has: name => !!G[name],
    /* adı verilen dokuyu üret (önbellekli). Dokunmatik cihazlarda daha küçük üretilir (hızlı açılış). */
    get(name) {
      if (B[name]) return B[name];
      if (!G[name] || typeof document === 'undefined') return null;
      const N = (typeof IS_TOUCH !== 'undefined' && IS_TOUCH) ? 256 : 512;
      try { B[name] = G[name](N); } catch (e) { console.error(e); B[name] = null; }
      return B[name];
    }
  };
})();
