/* =====================================================================
   07b · 3D SAHNE: harita geometrisi, karakter modelleri, silah modelleri,
        birinci şahıs silah görünümü (viewmodel), tüm yetenek görselleri,
        3D parçacık/iz efektleri
   ===================================================================== */
const FX = [];
const VM = { kick: 0, flash: 0, bob: 0, swap: 0, lastW: null, sway: 0 };
const AGCOL = {};
const COL = {
  teal: hexRGB('#1ee3cf'), red: hexRGB('#ff4655'), gold: hexRGB('#f5c451'), white: [1, 1, 1, 1], dark: hexRGB('#1b2026'),
  skin: hexRGB('#d9b08c'), floor: [1.15, 1.15, 1.15, 1], wall: [1, 1, 1, 1]
};
let BARRIERS = [];
function addFx(f) { if (FX.length < 700) FX.push(f); }

/* ---------- statik harita ---------- */
function buildWorldMeshes() {
  if (PKMAP) { buildPkWorld(); return; } // parkur pisti (07e)
  for (const id of AGENT_IDS) AGCOL[id] = hexRGB(AGENTS[id].color);
  let g = GB();
  gquad(g, [0, 0, 0], [WW, 0, 0], [WW, 0, WH], [0, 0, WH], [0, 1, 0], null, null, [0, 0, 1, 0, 1, 1, 0, 1]);
  mkMesh('floor', g);
  const isWall = (x, y) => tileAt(x, y) === T_WALL;
  const isBox = (x, y) => tileAt(x, y) === T_BOX;
  const isFloor = (x, y) => !isWall(x, y) && !isBox(x, y);
  // duvarlar
  g = GB();
  const lo = [0.62, 0.66, 0.72], hi = [1, 1, 1], top = [0.42, 0.46, 0.52];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (!isWall(x, y)) continue;
    let adj = false;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (isFloor(x + i, y + j) || isBox(x + i, y + j)) adj = true;
    if (!adj) continue;
    const X = x * TILE, Z = y * TILE, X2 = X + TILE, Z2 = Z + TILE, Hh = WALL_H, s = 80;
    gquad(g, [X, Hh, Z2], [X2, Hh, Z2], [X2, Hh, Z], [X, Hh, Z], [0, 1, 0], top, top, [X / s, Z2 / s, X2 / s, Z2 / s, X2 / s, Z / s, X / s, Z / s]);
    if (!isWall(x, y + 1)) gquad(g, [X, 0, Z2], [X2, 0, Z2], [X2, Hh, Z2], [X, Hh, Z2], [0, 0, 1], lo, hi, [X / s, 0, X2 / s, 0, X2 / s, Hh / s, X / s, Hh / s]);
    if (!isWall(x, y - 1)) gquad(g, [X2, 0, Z], [X, 0, Z], [X, Hh, Z], [X2, Hh, Z], [0, 0, -1], lo, hi, [X2 / s, 0, X / s, 0, X / s, Hh / s, X2 / s, Hh / s]);
    if (!isWall(x + 1, y)) gquad(g, [X2, 0, Z2], [X2, 0, Z], [X2, Hh, Z], [X2, Hh, Z2], [1, 0, 0], lo, hi, [Z2 / s, 0, Z / s, 0, Z / s, Hh / s, Z2 / s, Hh / s]);
    if (!isWall(x - 1, y)) gquad(g, [X, 0, Z], [X, 0, Z2], [X, Hh, Z2], [X, Hh, Z], [-1, 0, 0], lo, hi, [Z / s, 0, Z2 / s, 0, Z2 / s, Hh / s, Z / s, Hh / s]);
  }
  mkMesh('walls', g);
  if (!THEME.trim) { delete GLX.meshes.trim; }
  // duvar alt şeridi (temaya göre aksan rengi)
  g = GB();
  const acc = [1, 1, 1];
  if (THEME.trim)
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (!isWall(x, y)) continue;
    const X = x * TILE, Z = y * TILE, X2 = X + TILE, Z2 = Z + TILE, a = 9, b = 13;
    if (isFloor(x, y + 1)) gquad(g, [X, a, Z2 + 0.3], [X2, a, Z2 + 0.3], [X2, b, Z2 + 0.3], [X, b, Z2 + 0.3], [0, 0, 1], acc, acc);
    if (isFloor(x, y - 1)) gquad(g, [X2, a, Z - 0.3], [X, a, Z - 0.3], [X, b, Z - 0.3], [X2, b, Z - 0.3], [0, 0, -1], acc, acc);
    if (isFloor(x + 1, y)) gquad(g, [X2 + 0.3, a, Z2], [X2 + 0.3, a, Z], [X2 + 0.3, b, Z], [X2 + 0.3, b, Z2], [1, 0, 0], acc, acc);
    if (isFloor(x - 1, y)) gquad(g, [X - 0.3, a, Z], [X - 0.3, a, Z2], [X - 0.3, b, Z2], [X - 0.3, b, Z], [-1, 0, 0], acc, acc);
  }
  mkMesh('trim', g);
  // kasalar
  g = GB();
  const rbSet = new Set((MAPDATA.reboot || []).map(r => r.ty * MW + r.tx));
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (!isBox(x, y) || rbSet.has(y * MW + x)) continue;
    const X = x * TILE, Z = y * TILE, X2 = X + TILE, Z2 = Z + TILE, Hh = BOX_H, c1 = [0.72, 0.72, 0.72], c2 = [1, 1, 1];
    const uvS = [0, 0, 1, 0, 1, 1, 0, 1];
    gquad(g, [X, Hh, Z2], [X2, Hh, Z2], [X2, Hh, Z], [X, Hh, Z], [0, 1, 0], c2, c2, uvS);
    for (const [cond, a, b, c, d, n] of [
      [!isBox(x, y + 1), [X, 0, Z2], [X2, 0, Z2], [X2, Hh, Z2], [X, Hh, Z2], [0, 0, 1]],
      [!isBox(x, y - 1), [X2, 0, Z], [X, 0, Z], [X, Hh, Z], [X2, Hh, Z], [0, 0, -1]],
      [!isBox(x + 1, y), [X2, 0, Z2], [X2, 0, Z], [X2, Hh, Z], [X2, Hh, Z2], [1, 0, 0]],
      [!isBox(x - 1, y), [X, 0, Z], [X, 0, Z2], [X, Hh, Z2], [X, Hh, Z], [-1, 0, 0]]]) {
      if (cond) gquad(g, a, b, c, d, n, c1, c2, [0, 0, 1, 0, 1, 2, 0, 2]);
    }
  }
  mkMesh('crates', g);
  // alçak siperler (eğilince tam koruma)
  g = GB();
  const isLow = (x, y) => tileAt(x, y) === T_LOW;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (!isLow(x, y)) continue;
    const X = x * TILE + 1, Z = y * TILE + 1, X2 = X + TILE - 2, Z2 = Z + TILE - 2, Hh = LOW_H, c1 = [0.7, 0.7, 0.7], c2 = [1, 1, 1];
    gquad(g, [X, Hh, Z2], [X2, Hh, Z2], [X2, Hh, Z], [X, Hh, Z], [0, 1, 0], c2, c2);
    for (const [cond, a, b, c, d, n] of [
      [!isLow(x, y + 1), [X, 0, Z2], [X2, 0, Z2], [X2, Hh, Z2], [X, Hh, Z2], [0, 0, 1]],
      [!isLow(x, y - 1), [X2, 0, Z], [X, 0, Z], [X, Hh, Z], [X2, Hh, Z], [0, 0, -1]],
      [!isLow(x + 1, y), [X2, 0, Z2], [X2, 0, Z], [X2, Hh, Z], [X2, Hh, Z2], [1, 0, 0]],
      [!isLow(x - 1, y), [X, 0, Z], [X, 0, Z2], [X, Hh, Z2], [X, Hh, Z], [-1, 0, 0]]]) {
      if (cond) gquad(g, a, b, c, d, n, c1, c2, [0, 0, 1, 0, 1, 1, 0, 1]);
    }
  }
  mkMesh('lows', g);
  // su yüzeyi
  g = GB();
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (tileAt(x, y) === T_WATER) {
    const X = x * TILE, Z = y * TILE;
    gquad(g, [X, 0.8, Z + TILE], [X + TILE, 0.8, Z + TILE], [X + TILE, 0.8, Z], [X, 0.8, Z], [0, 1, 0]);
  }
  // su yüzeyinin karo UV'si kayarak akar
  mkMesh('water', g);
  buildSkyMesh();
  buildDecor();
  // doğuş bariyerleri (satın alma evresinde görünür)
  BARRIERS = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const t = grid[y * MW + x];
    if (t !== T_ATK && t !== T_DEF) continue;
    const X = x * TILE, Z = y * TILE;
    const e = (nx, ny, x1, z1, x2, z2) => { const n = tileAt(nx, ny); if (n !== t && n !== T_WALL && n !== T_BOX) BARRIERS.push([x1, z1, x2, z2, t]); };
    e(x, y - 1, X, Z, X + TILE, Z); e(x, y + 1, X, Z + TILE, X + TILE, Z + TILE); e(x - 1, y, X, Z, X, Z + TILE); e(x + 1, y, X + TILE, Z, X + TILE, Z + TILE);
  }
}



/* ---------- ODA DEKORLARI (kuru kafa, sandık, fıçı, çuval, meşale...) ----------
   Duvar diplerine ve köşelere yerleştirilir; dokular kodla üretilen malzeme atlasından (PC hücreleri).
   Görseldir: oyuncuların çok az içine girebileceği kadar duvara yaslanır, çarpışma yoktur. */
function buildProps(ge) {
  const g = GB(), R = mulberry(strHash(mapDef().id + ':dekor'));
  const rr = (a, b) => a + R() * (b - a), W1 = [1, 1, 1], kind = THEME.decor || 'merkez';
  const DK = [0.09, 0.07, 0.06];
  let bx = 0, bz = 0, ba = 0;
  // yerel → dünya (x: duvardan odaya doğru, z: duvar boyunca)
  const put = (name, lx, ly, lz, sx, sy, sz, cell, col, yaw, pitch) => {
    const c = Math.cos(ba), s = Math.sin(ba);
    gAppend(g, name, bx + c * lx - s * lz, ly, bz + s * lx + c * lz, ba + (yaw || 0), sx, sy, sz, col || W1, pitch || 0, cell);
  };
  const glow = (name, lx, ly, lz, sx, sy, sz, col) => { const c = Math.cos(ba), s = Math.sin(ba); gAppend(ge, name, bx + c * lx - s * lz, ly, bz + s * lx + c * lz, ba, sx, sy, sz, col); };
  const skull = (lx, ly, lz, yaw) => {
    const c0 = Math.cos(yaw), s0 = Math.sin(yaw), f = (fx, fz) => [lx + c0 * fx - s0 * fz, lz + s0 * fx + c0 * fz];
    put('sphLo', lx, ly + 6.2, lz, 11, 10, 10, PC.bone, null, yaw);
    let q = f(3.4, 0); put('box', q[0], ly + 1.6, q[1], 5, 3.2, 7, PC.bone, null, yaw);
    for (const z of [-2.3, 2.3]) { q = f(4.4, z); put('sphLo', q[0], ly + 6.6, q[1], 3.4, 3.2, 3.2, PC.black, DK, yaw); }
    q = f(5.2, 0); put('box', q[0], ly + 4.2, q[1], 1, 2, 1.4, PC.black, DK, yaw);
  };
  const bone = (lx, ly, lz, yaw) => {
    put('pcyl', lx, ly + 1.4, lz, 2.6, 16, 2.6, PC.bone, null, yaw, Math.PI / 2);
    const c0 = Math.cos(yaw), s0 = Math.sin(yaw);
    for (const e of [-8, 8]) put('sphLo', lx + c0 * e, ly + 1.6, lz + s0 * e, 4.4, 3.6, 4.4, PC.bone);
  };
  const P = {
    chest() {
      put('box', 0, 9, 0, 22, 18, 36, PC.wood); put('box', 0, 21.5, 0, 23, 7, 37, PC.wood);
      for (const z of [-11, 11]) put('box', 0, 13.5, z, 23.6, 26, 3, PC.metal);
      put('box', 0, 22.2, 0, 23.6, 2, 37.6, PC.metal); put('box', 11.6, 17, 0, 2, 6, 5, PC.gold);
      if (R() < 0.45) skull(0, 25, rr(-8, 8), rr(-0.6, 0.6));
      if (R() < 0.3) put('sphLo', 14, 2, rr(-14, 14), 6, 3, 6, PC.gold); // dökülmüş altın
    },
    barrel(cell) {
      const n = 1 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) {
        const z = (k - (n - 1) / 2) * 28, top = k === 1 && R() < 0.4;
        put('pcyl', 0, 17, z, 26, 34, 26, cell || PC.wood);
        for (const y of [5, 17, 29]) put('pcyl', 0, y, z, 27.4, 2.6, 27.4, PC.metal);
        put('disc', 0, 34.2, z, 25, 1, 25, cell || PC.wood);
        if (top) put('pcyl', 0, 51, z, 26, 34, 26, cell || PC.wood);
      }
    },
    drum() { P.barrel(PC.rust); },
    skulls() {
      const n = 3 + Math.floor(R() * 4);
      for (let k = 0; k < n; k++) skull(rr(-6, 8), k > 3 ? 9 : 0, rr(-16, 16), rr(-1, 1));
      for (let k = 0; k < 3; k++) bone(rr(-2, 12), 0, rr(-18, 18), rr(0, TAU));
      if (R() < 0.5) put('pcyl', -2, 22, 14, 2.2, 44, 2.2, PC.wood, null, 0, 0.15), skull(-1, 42, 14, 0); // kazıkta kafa
    },
    crates() {
      put('box', 0, 12, -6, 24, 24, 24, PC.wood, null, rr(-0.2, 0.2)); put('box', 1, 12, 18, 22, 24, 22, PC.wood, null, rr(-0.3, 0.3));
      put('box', 0, 32, -4, 16, 16, 16, PC.wood, null, rr(0, 1.5));
      for (const z of [-6, 18]) put('box', 0, 12, z, 24.6, 3, 24.6, PC.metal);
    },
    sacks() {
      const n = 2 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) put('sphLo', rr(-2, 4), k > 2 ? 16 : 7, (k % 3 - 1) * 18 + rr(-3, 3), 22, 14, 18, PC.burlap, null, rr(-0.4, 0.4));
    },
    torch() {
      put('box', -1, 74, 0, 4, 10, 6, PC.metal); put('pcyl', 5, 80, 0, 4, 22, 4, PC.wood, null, 0, -0.5);
      put('pcyl', 9, 90, 0, 7, 5, 7, PC.metal);
      glow('sphLo', 9, 97, 0, 8, 13, 8, [1, 0.62, 0.2]); glow('sphLo', 9, 95, 0, 5, 8, 5, [1, 0.92, 0.55]);
    },
    lamp() { put('box', -1, 86, 0, 4, 14, 26, PC.metal); glow('box', 1.5, 86, 0, 2, 9, 22, kind === 'neon' ? [1, 0.3, 0.8] : [0.6, 0.95, 1]); },
    amphora() {
      const n = 1 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) {
        const z = (k - (n - 1) / 2) * 24, s = rr(0.8, 1.15);
        put('sphLo', 0, 14 * s, z, 20 * s, 26 * s, 20 * s, PC.clay); put('pcyl', 0, 29 * s, z, 8 * s, 8 * s, 8 * s, PC.clay); put('pcyl', 0, 33 * s, z, 12 * s, 2, 12 * s, PC.clay);
      }
      if (R() < 0.4) skull(10, 0, rr(-12, 12), rr(-1, 1));
    },
    server() {
      for (const z of [-17, 17]) {
        put('box', 0, 34, z, 22, 68, 30, PC.panel);
        for (let y = 12; y < 64; y += 9) glow('box', 11.2, y, z + rr(-9, 9), 0.6, 1.6, 2.2, R() < 0.7 ? [0.3, 1, 0.5] : [1, 0.3, 0.3]);
      }
    },
    tires() { const n = 2 + Math.floor(R() * 3); for (let k = 0; k < n; k++) put('pcyl', rr(-1, 1), 4.5 + k * 9, rr(-2, 2), 30, 9, 30, PC.rubber); },
    cone() { for (const z of [-14, 10]) { put('box', 0, 1, z, 18, 2, 18, PC.rubber); put('cone', 0, 15, z, 15, 28, 15, PC.red); put('pcyl', 0, 15, z, 9.5, 3, 9.5, PC.white); } },
    cactus() {
      put('pcyl', 0, 26, 0, 13, 52, 13, PC.cactus); put('sphLo', 0, 52, 0, 13, 9, 13, PC.cactus);
      put('pcyl', 0, 30, 12, 7, 7, 7, PC.cactus, null, 0, Math.PI / 2); put('pcyl', 0, 38, 16, 7, 18, 7, PC.cactus);
      put('pcyl', 0, 30, 0, 18, 8, 18, PC.clay);
    },
    bush() { for (let k = 0; k < 3; k++) put('sphLo', rr(0, 8), rr(10, 16), rr(-16, 16), rr(24, 32), rr(18, 26), rr(24, 32), PC.leaf); },
    mushroom() { for (let k = 0; k < 3; k++) { const z = rr(-16, 16), h = rr(8, 18); put('pcyl', rr(0, 8), h / 2, z, 4, h, 4, PC.bone); put('sphLo', rr(0, 8), h, z, 14, 7, 14, PC.red); } },
    snowpile() { put('sphLo', 4, 4, rr(-6, 6), 40, 16, 34, PC.snow); put('sphLo', 0, 9, rr(-8, 8), 22, 12, 20, PC.snow); },
    crystal() { for (let k = 0; k < 3; k++) { const z = rr(-14, 14), h = rr(18, 34); put('octa', rr(0, 6), h / 2, z, 9, h, 9, PC.white, [0.62, 0.86, 1], rr(0, 3), rr(-0.3, 0.3)); glow('octa', rr(0, 6), h / 2, z, 4, h * 0.6, 4, [0.15, 0.3, 0.4]); } },
    gastank() { for (const z of [-10, 10]) { put('pcyl', 0, 26, z, 14, 50, 14, PC.red); put('sphLo', 0, 51, z, 14, 8, 14, PC.red); put('pcyl', 0, 57, z, 4, 6, 4, PC.metal); } },
    vending() { put('box', 0, 30, 0, 24, 60, 30, PC.red); glow('box', 12.2, 38, 0, 0.6, 30, 22, [0.75, 0.9, 1]); put('box', 12.4, 12, 0, 0.6, 6, 16, PC.black, DK); },
    trash() { for (let k = 0; k < 3; k++) put('sphLo', rr(0, 6), 9, rr(-16, 16), rr(18, 24), rr(16, 20), rr(18, 24), PC.rubber, [0.5, 0.55, 0.6]); }
  };
  const TB = {
    merkez: { chest: 2, barrel: 2, skulls: 1, crates: 3, sacks: 1, server: 4, drum: 2, lamp: 3 },
    liman: { chest: 2, barrel: 3, skulls: 1, crates: 3, sacks: 2, drum: 4, tires: 2, cone: 1, lamp: 1 },
    col: { chest: 3, barrel: 2, skulls: 3, crates: 1, sacks: 2, amphora: 4, cactus: 2, torch: 3 },
    buzul: { chest: 2, barrel: 2, skulls: 1, crates: 3, sacks: 1, snowpile: 4, crystal: 3, gastank: 2, lamp: 2 },
    tapinak: { chest: 3, barrel: 2, skulls: 4, crates: 1, sacks: 1, amphora: 2, bush: 4, mushroom: 2, torch: 4 },
    neon: { chest: 2, barrel: 2, skulls: 1, crates: 2, sacks: 1, vending: 3, cone: 2, trash: 3, tires: 2, lamp: 3 },
    volkan: { chest: 2, barrel: 2, skulls: 4, crates: 1, crystal: 3, torch: 4, gastank: 1 },
    ada: { chest: 3, barrel: 3, crates: 2, sacks: 3, amphora: 2, bush: 3, torch: 3, tires: 1 },
    uzay: { crates: 3, server: 5, gastank: 3, lamp: 4, crystal: 2, drum: 2, vending: 1 },
    sakura: { chest: 2, barrel: 1, crates: 1, sacks: 2, amphora: 3, bush: 4, mushroom: 1, lamp: 3 },
    hurda: { barrel: 4, crates: 3, drum: 4, tires: 4, gastank: 2, trash: 3, cone: 2, lamp: 2 }
  }[kind] || { chest: 3, barrel: 3, skulls: 2, crates: 3, sacks: 2 };
  const tot = Object.values(TB).reduce((a, b) => a + b, 0);
  const pickType = () => { let r = R() * tot; for (const k in TB) { r -= TB[k]; if (r <= 0) return k; } return 'chest'; };
  const isW = (x, y) => tileAt(x, y) === T_WALL;
  const okFloor = (x, y) => { const t = tileAt(x, y); return t === T_FLOOR || t === T_A || t === T_B; };
  const cands = [];
  for (let y = 2; y < MH - 2; y++) for (let x = 2; x < MW - 2; x++) {
    if (!okFloor(x, y)) continue;
    const ws = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(d => isW(x + d[0], y + d[1]));
    if (ws.length < 1 || ws.length > 2) continue;
    if (ws.length === 2 && ws[0][0] === -ws[1][0] && ws[0][1] === -ws[1][1]) continue; // iki yanı duvar: dar geçit
    // odaya doğru en az 3 boş karo kalsın (koridorları tıkama)
    let ox = 0, oy = 0; for (const d of ws) { ox -= d[0]; oy -= d[1]; }
    let free = 0; for (let k = 1; k <= 3; k++) if (okFloor(x + ox * k, y + oy * k) || tileAt(x + ox * k, y + oy * k) === T_LOW) free++;
    if (free < 3) continue;
    let bad = false; for (let j = -1; j <= 1 && !bad; j++) for (let i = -1; i <= 1; i++) { const t = tileAt(x + i, y + j); if (t === T_ATK || t === T_DEF || t === T_WATER) { bad = true; break; } }
    if (bad) continue;
    cands.push([x, y, ws]);
  }
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = cands[i]; cands[i] = cands[j]; cands[j] = t; }
  const want = Math.round(MW * MH / 70), placed = [];
  for (const [x, y, ws] of cands) {
    if (placed.length >= want) break;
    if (placed.some(p => Math.abs(p[0] - x) + Math.abs(p[1] - y) < 5)) continue;
    let type = pickType();
    if ((type === 'torch' || type === 'lamp') && ws.length !== 1) type = 'chest';
    const d = ws[0], d2 = ws[1];
    // nesne tabanı: duvara yaslı, duvardan odaya bakar
    bx = (x + 0.5) * TILE + d[0] * (TILE / 2 - 14); bz = (y + 0.5) * TILE + d[1] * (TILE / 2 - 14);
    if (d2) { bx += d2[0] * (TILE / 2 - 22); bz += d2[1] * (TILE / 2 - 22); }
    ba = Math.atan2(-d[1], -d[0]);
    if (type === 'torch' || type === 'lamp') { bx = (x + 0.5) * TILE + d[0] * TILE / 2; bz = (y + 0.5) * TILE + d[1] * TILE / 2; }
    P[type]();
    placed.push([x, y, type, bx, bz, ba]);
  }
  GLX.propSpots = placed;
  // ---- reboot istasyonları (karo kadar: 2×2 m terminal, ekran ve anten) ----
  for (const r of MAPDATA.reboot || []) {
    const a = Math.atan2(r.dy, r.dx), c = Math.cos(a), s2 = Math.sin(a);
    const L = (lx, lz) => [r.x + c * lx - s2 * lz, r.y + s2 * lx + c * lz];
    let q = L(0, 0); gAppend(g, 'box', q[0], 6, q[1], a, 78, 12, 78, W1, 0, PC.metal);
    q = L(-8, 0); gAppend(g, 'box', q[0], 58, q[1], a, 56, 92, 64, W1, 0, PC.panel);
    q = L(21, 0); gAppend(g, 'box', q[0], 70, q[1], a, 2, 34, 46, [0.1, 0.12, 0.15], 0, PC.black);
    gAppend(ge, 'box', q[0] + c * 1.2, 70, q[1] + s2 * 1.2, a, 0.6, 28, 40, [0.25, 0.6, 0.85]);
    q = L(23, 0); gAppend(g, 'box', q[0], 40, q[1], a, 10, 6, 50, W1, 0, PC.metal);
    q = L(-14, 18); gAppend(g, 'pcyl', q[0], 112, q[1], 0, 3, 40, 3, W1, 0, PC.metal);
    q = L(-14, -18); gAppend(g, 'pcyl', q[0], 108, q[1], 0, 6, 8, 6, W1, 0, PC.red);
    for (const z of [-26, 26]) { q = L(24, z); gAppend(ge, 'box', q[0], 92, q[1], a, 1, 5, 5, [0.3, 0.9, 1]); }
  }
  // ---- suyun etrafına çit ----
  const isWater = (x, y) => tileAt(x, y) === T_WATER;
  const wood = kind === 'col' || kind === 'tapinak';
  const fcell = wood ? PC.wood : PC.metal, fcol = kind === 'liman' ? [1.5, 1.25, 0.45] : kind === 'neon' ? [1.1, 1.2, 1.4] : W1;
  const posts = new Set(), FH = 46;
  const post = (X, Z) => {
    const k = X + ',' + Z; if (posts.has(k)) return; posts.add(k);
    if (wood) { gAppend(g, 'box', X, FH / 2, Z, 0, 7, FH, 7, fcol, 0, fcell); gAppend(g, 'pyr', X, FH + 2.5, Z, 0, 7.5, 5, 7.5, fcol, 0, fcell); }
    else { gAppend(g, 'pcyl', X, FH / 2, Z, 0, 5, FH, 5, fcol, 0, fcell); gAppend(g, 'sphLo', X, FH, Z, 0, 6.5, 6.5, 6.5, fcol, 0, fcell); }
  };
  const rail = (cx, cz, a) => {
    for (const h of wood ? [18, 36] : [16, 30, FH - 2]) {
      if (wood) gAppend(g, 'box', cx, h, cz, a, TILE, 5, 3, fcol, 0, fcell);
      else gAppend(g, 'pcyl', cx, h, cz, a, 3, TILE, 3, fcol, Math.PI / 2, fcell);
    }
  };
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (!isWater(x, y)) continue;
    const X0 = x * TILE, Z0 = y * TILE, X1 = X0 + TILE, Z1 = Z0 + TILE;
    const open = (nx, ny) => !isWater(nx, ny) && tileAt(nx, ny) !== T_WALL;
    if (open(x + 1, y)) { rail(X1, (Z0 + Z1) / 2, Math.PI / 2); post(X1, Z0); post(X1, Z1); }
    if (open(x - 1, y)) { rail(X0, (Z0 + Z1) / 2, Math.PI / 2); post(X0, Z0); post(X0, Z1); }
    if (open(x, y + 1)) { rail((X0 + X1) / 2, Z1, 0); post(X0, Z1); post(X1, Z1); }
    if (open(x, y - 1)) { rail((X0 + X1) / 2, Z0, 0); post(X0, Z0); post(X1, Z0); }
  }
  mkMesh('props', g);
}

/* ---------- harita yüklenince: dokular, geometri, ışık ---------- */
function onMapLoaded() {
  FX.length = 0;
  if (GLX.ok) {
    buildThemeTextures(THEME);
    buildWorldMeshes();
    const L = THEME.light, l = Math.hypot(L[0], L[1], L[2]);
    GLX.light = [L[0] / l, L[1] / l, L[2] / l]; GLX.ad = [THEME.amb, THEME.dif, 0]; GLX.lc = THEME.lc;
  }
  if (typeof buildMinimap === 'function' && typeof ctx !== 'undefined' && ctx) buildMinimap();
}
/* Gökyüzü kubbesi: renk geçişi + güneş/ay + bulutlar + yıldızlar tek mesh */
function buildSkyMesh() {
  const th = THEME, top = hexRGB(th.sky[0]), hor = hexRGB(th.sky[1]), src = GLX.prim.sphere, g = GB();
  const R = mulberry(strHash(mapDef().id + 'sky'));
  for (let i = 0; i < src.length; i += 11) {
    const y = src[i + 1] * 2, t = Math.pow(clamp(y, 0, 1), 0.55), k = y < 0 ? 0.85 : 1;
    g.v.push(src[i], src[i + 1], src[i + 2], 0, 1, 0, lerp(hor[0], top[0], t) * k, lerp(hor[1], top[1], t) * k, lerp(hor[2], top[2], t) * k, 0, 0);
  }
  const dirPt = (az, el, r) => [Math.cos(el) * Math.cos(az) * r, Math.sin(el) * r, Math.cos(el) * Math.sin(az) * r];
  if (th.stars) for (let i = 0; i < 220; i++) {
    const p = dirPt(R() * TAU, 0.08 + R() * 1.4, 0.48), b = 0.6 + R() * 0.4;
    gAppend(g, 'octa', p[0], p[1], p[2], 0, 0.003 + R() * 0.003, 0.003 + R() * 0.003, 0.003 + R() * 0.003, [b, b, b * 1.05]);
  }
  if (th.moon) { const p = dirPt(2.2, 0.55, 0.46); gAppend(g, 'sphere', p[0], p[1], p[2], 0, 0.035, 0.035, 0.035, [0.95, 0.93, 1.1]); }
  if (th.planet) { // dev gezegen + halkası
    const P = th.planet, d = P.dir, l = Math.hypot(d[0], d[1], d[2]), x = d[0] / l * 0.45, y = d[1] / l * 0.45, z = d[2] / l * 0.45, s = P.size;
    gAppend(g, 'sphere', x, y, z, 0, s, s, s, P.col);
    for (let k = -2; k <= 2; k++) gAppend(g, 'sphere', x, y + k * s * 0.3, z, 0, s * 1.004 * Math.sqrt(1 - Math.pow(k * 0.3, 2)), s * 0.08, s * 1.004 * Math.sqrt(1 - Math.pow(k * 0.3, 2)), k % 2 ? P.col2 : P.col.map(v => v * 0.92));
    if (P.ring) gAppend(g, 'sphere', x, y, z, 0.4, s * 1.9, s * 0.03, s * 1.9, P.ring);
  }
  if (th.sun) { const d = th.sun.dir, l = Math.hypot(d[0], d[1], d[2]); gAppend(g, 'sphere', d[0] / l * 0.46, d[1] / l * 0.46, d[2] / l * 0.46, 0, th.sun.size / 900, th.sun.size / 900, th.sun.size / 900, [1.6, 1.5, 1.2]); }
  for (let i = 0; i < (th.clouds || 0); i++) {
    const az = R() * TAU, el = 0.12 + R() * 0.35, p = dirPt(az, el, 0.44);
    for (let k = 0; k < 4; k++) gAppend(g, 'sphMd', p[0] + (R() - 0.5) * 0.06, p[1] + (R() - 0.5) * 0.01, p[2] + (R() - 0.5) * 0.06, az, 0.05 + R() * 0.05, 0.015 + R() * 0.01, 0.05 + R() * 0.04, [1.05, 1.05, 1.08]);
  }
  mkMesh('sky', g);
}
/* Duvar karolarının zemine uzaklığı (dekor yerleşimi için) */
function wallDepthField() {
  const d = new Int16Array(MW * MH).fill(-1), q = [];
  for (let i = 0; i < MW * MH; i++) if (grid[i] !== T_WALL) { d[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % MW, y = (c / MW) | 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const nx = x + i, ny = y + j; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const ni = ny * MW + nx; if (d[ni] < 0) { d[ni] = d[c] + 1; q.push(ni); }
    }
  }
  return d;
}
function buildDecor() {
  const g = GB(), ge = GB(), th = THEME, kind = th.decor, Hw = WALL_H;
  const R = mulberry(strHash(mapDef().id + 'decor'));
  const rr = (a, b) => a + R() * (b - a);
  if (kind) {
    const D = wallDepthField();
    const spots = (dmin, dmax, n) => {
      n = Math.round(n * clamp(Math.sqrt(MW * MH / 4400), 1, 3));
      const c = []; for (let i = 0; i < MW * MH; i++) if (grid[i] === T_WALL && D[i] >= dmin && D[i] <= dmax) c.push(i);
      const out = []; for (let k = 0; k < n && c.length; k++) { const j = Math.floor(R() * c.length); out.push(c[j]); c.splice(j, 1); }
      return out.map(i => [(i % MW + 0.5) * TILE + rr(-10, 10), (((i / MW) | 0) + 0.5) * TILE + rr(-10, 10)]);
    };
    const ringK = clamp((MW + MH) / 136, 1, 3);
    const ring = (n, off, fn) => { n = Math.round(n * ringK); for (let k = 0; k < n; k++) { const side = k % 4, t = R(); let x, z; if (side === 0) { x = t * WW; z = -off - rr(0, 300); } else if (side === 1) { x = t * WW; z = WH + off + rr(0, 300); } else if (side === 2) { x = -off - rr(0, 300); z = t * WH; } else { x = WW + off + rr(0, 300); z = t * WH; } fn(x, z, k); } };
    const tree = (x, z, s, trunk, leaf) => { gAppend(g, 'cylLo', x, Hw * 0.5 + 40 * s, z, 0, 14 * s, Hw + 80 * s, 14 * s, trunk); for (let k = 0; k < 4; k++) gAppend(g, 'sphLo', x + rr(-30, 30) * s, Hw + 70 * s + rr(0, 50) * s, z + rr(-30, 30) * s, 0, rr(70, 110) * s, rr(55, 80) * s, rr(70, 110) * s, leaf.map(c => c * rr(0.85, 1.1))); };
    const palm = (x, z, s) => { const hgt = Hw + rr(90, 160); gAppend(g, 'cylLo', x, hgt / 2, z, 0, 10 * s, hgt, 10 * s, [0.55, 0.42, 0.28]); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + rr(0, 0.4); gAppend(g, 'box', x + Math.cos(a) * 34 * s, hgt - 4, z + Math.sin(a) * 34 * s, a, 74 * s, 4, 16 * s, [0.3, 0.6, 0.22], -0.35); } gAppend(g, 'sphLo', x, hgt, z, 0, 18 * s, 14 * s, 18 * s, [0.42, 0.33, 0.2]); };
    const pine = (x, z, s, snow) => { gAppend(g, 'cylLo', x, Hw * 0.5 + 30, z, 0, 10 * s, Hw + 60, 10 * s, [0.35, 0.25, 0.18]); for (let k = 0; k < 4; k++) { const y = Hw + 20 + k * 42 * s, w = (110 - k * 22) * s; gAppend(g, 'cone', x, y, z, 0, w, 70 * s, w, [0.16, 0.34, 0.24]); if (snow) gAppend(g, 'cone', x, y + 16 * s, z, 0, w * 0.62, 40 * s, w * 0.62, [0.95, 0.97, 1]); } };
    if (kind === 'liman') {
      for (const [x, z] of spots(1, 2, 26)) { gAppend(g, 'cylLo', x, Hw + 70, z, 0, 5, 140, 5, [0.3, 0.32, 0.35]); gAppend(ge, 'sphLo', x, Hw + 142, z, 0, 14, 10, 14, [1, 0.92, 0.6]); }
      const cranes = [[-120, WH * 0.3], [-120, WH * 0.7], [WW + 120, WH * 0.3], [WW + 120, WH * 0.7]];
      for (const [x, z] of cranes) {
        const dir = x < 0 ? 0 : Math.PI, H2 = 520;
        for (const [ox, oz] of [[-40, -40], [40, -40], [-40, 40], [40, 40]]) gAppend(g, 'box', x + ox, H2 / 2, z + oz, 0, 14, H2, 14, [0.95, 0.72, 0.12]);
        gAppend(g, 'box', x, H2, z, 0, 110, 30, 110, [0.95, 0.72, 0.12]);
        gAppend(g, 'box', x + Math.cos(dir) * 300, H2 + 24, z, dir, 720, 22, 26, [0.95, 0.72, 0.12]);
        gAppend(g, 'box', x - Math.cos(dir) * 60, H2 + 50, z, 0, 60, 60, 60, [0.85, 0.85, 0.88]);
        gAppend(g, 'box', x + Math.cos(dir) * 520, H2 - 140, z, 0, 2, 300, 2, [0.2, 0.2, 0.2]);
        gAppend(ge, 'sphLo', x, H2 + 90, z, 0, 10, 10, 10, [1, 0.2, 0.2]);
      }
      const cc = [[0.72, 0.22, 0.18], [0.18, 0.42, 0.7], [0.2, 0.55, 0.3], [0.85, 0.6, 0.15], [0.55, 0.55, 0.58]];
      ring(70, 60, (x, z) => { const n = 1 + Math.floor(R() * 3), a = R() < 0.5 ? 0 : Math.PI / 2, col = cc[Math.floor(R() * cc.length)]; for (let k = 0; k < n; k++) gAppend(g, 'box', x, 50 + k * 100, z, a, 240, 98, 96, col.map(v => v * rr(0.85, 1.1))); });
      gAppend(g, 'box', WW / 2, 120, WH + 900, 0, 2200, 240, 420, [0.55, 0.12, 0.12]);
      gAppend(g, 'box', WW / 2 + 500, 340, WH + 900, 0, 420, 200, 300, [0.92, 0.92, 0.95]);
    } else if (kind === 'col') {
      for (const [x, z] of spots(1, 3, 34)) palm(x, z, rr(0.8, 1.2));
      for (const [x, z] of spots(1, 1, 18)) gAppend(g, 'cylLo', x, (Hw + 40) / 2, z, 0, 26, Hw + 40, 26, [0.8, 0.65, 0.42]);
      gAppend(g, 'pyr', WW * 0.25, 450, -1600, 0.2, 1500, 900, 1500, [0.86, 0.72, 0.46]);
      gAppend(g, 'pyr', WW * 0.72, 330, -1300, 0.6, 1100, 660, 1100, [0.84, 0.7, 0.45]);
      gAppend(g, 'pyr', WW * 0.5, 600, WH + 2200, 0, 2000, 1200, 2000, [0.83, 0.69, 0.44]);
      ring(40, 400, (x, z) => gAppend(g, 'sphLo', x, -20, z, R() * 3, rr(500, 1100), rr(140, 300), rr(400, 900), [0.86, 0.72, 0.5]));
    } else if (kind === 'buzul') {
      for (const [x, z] of spots(1, 3, 46)) pine(x, z, rr(0.8, 1.25), true);
      ring(24, 900, (x, z) => { const s = rr(900, 1700); gAppend(g, 'cone', x, s * 0.4, z, 0, s * 1.4, s * 0.9, s * 1.4, [0.78, 0.83, 0.9]); gAppend(g, 'cone', x, s * 0.72, z, 0, s * 0.55, s * 0.36, s * 0.55, [0.98, 0.99, 1]); });
      const dc = tc(...MAPDATA.defCenter);
      gAppend(g, 'cylLo', dc.x, Hw + 120, dc.y - 140, 0, 10, 240, 10, [0.6, 0.62, 0.66]);
      gAppend(g, 'disc', dc.x, Hw + 240, dc.y - 140, 0, 140, 1, 140, [0.9, 0.92, 0.95], 0.6);
      gAppend(ge, 'sphLo', dc.x, Hw + 252, dc.y - 140, 0, 10, 10, 10, [1, 0.25, 0.25]);
    } else if (kind === 'tapinak') {
      for (const [x, z] of spots(1, 3, 42)) tree(x, z, rr(0.9, 1.4), [0.36, 0.26, 0.17], [0.2, 0.45, 0.2]);
      // avludaki tapınağın basamaklı tepesi
      const cb = mapDef().centerBlock || [MW / 2 - 4, MH / 2 - 4, 8, 8];
      const tx0 = cb[0], tz0 = cb[1], tx1 = cb[0] + cb[2] - 1, tz1 = cb[1] + cb[3] - 1;
      if (tx1 > tx0) { const cx = (tx0 + tx1 + 1) / 2 * TILE, cz = (tz0 + tz1 + 1) / 2 * TILE, w0 = (tx1 - tx0 + 1) * TILE; for (let k = 0; k < 4; k++) gAppend(g, 'box', cx, Hw + 30 + k * 60, cz, 0, w0 * (1 - k * 0.2), 60, w0 * (1 - k * 0.2), [0.55, 0.57, 0.48].map(v => v * (1 - k * 0.04))); gAppend(ge, 'sphLo', cx, Hw + 290, cz, 0, 40, 40, 40, [0.3, 1, 0.6]); }
      for (let k = 0; k < 6; k++) gAppend(g, 'box', WW / 2, 150 + k * 140, WH + 1800, 0, 1600 - k * 240, 140, 1600 - k * 240, [0.5, 0.52, 0.44]);
      ring(50, 300, (x, z) => tree(x, z, rr(1.4, 2.4), [0.3, 0.22, 0.15], [0.16, 0.38, 0.18]));
    } else if (kind === 'volkan') {
      // uzakta tüten yanardağ: koni + parlayan krater + duman sütunu
      const vx = WW * 0.5, vz = -2600;
      gAppend(g, 'cone', vx, 700, vz, 0, 3600, 1400, 3600, [0.22, 0.14, 0.12]);
      gAppend(ge, 'cone', vx, 1420, vz, 0, 700, 120, 700, [1, 0.42, 0.08]);
      for (let k = 0; k < 7; k++) gAppend(g, 'sphLo', vx + rr(-150, 150), 1600 + k * 260, vz + rr(-150, 150), 0, 380 + k * 90, 220, 380 + k * 90, [0.18, 0.15, 0.15]);
      for (let k = 0; k < 6; k++) gAppend(ge, 'box', vx + rr(-900, 900), rr(300, 1100), vz + 900 + rr(-200, 200), rr(0, 3), 40, rr(400, 900), 30, [1, 0.35, 0.05], 0.9); // akan lav
      for (const [x, z] of spots(1, 3, 30)) { const h = rr(60, 160); gAppend(g, 'cone', x, Hw + h / 2, z, 0, rr(40, 70), h, rr(40, 70), [0.2, 0.16, 0.15]); }
      for (const [x, z] of spots(1, 1, 26)) gAppend(ge, 'box', x, Hw + 2, z, rr(0, 3), rr(40, 90), 3, 6, [1, 0.4, 0.06]); // duvar üstü lav çatlakları
      ring(40, 300, (x, z) => { const s = rr(300, 800); gAppend(g, 'cone', x, s * 0.3, z, 0, s, s * 0.6, s, [0.17, 0.12, 0.11]); if (R() < 0.3) gAppend(ge, 'sphLo', x, s * 0.6, z, 0, 40, 20, 40, [1, 0.4, 0.06]); });
    } else if (kind === 'ada') {
      for (const [x, z] of spots(1, 3, 44)) palm(x, z, rr(0.8, 1.3));
      // haritayı çevreleyen okyanus + dalga köpüğü
      gAppend(g, 'disc', WW / 2, -3, WH / 2, 0, WW * 4.5, 1, WH * 4.5, [0.08, 0.5, 0.72]);
      gAppend(g, 'disc', WW / 2, -2, WH / 2, 0, WW * 1.7, 1, WH * 1.7, [0.2, 0.72, 0.82]);
      // direkli kulübeler, şemsiyeler
      ring(26, 200, (x, z) => { const a = rr(0, 3); for (const [ox, oz] of [[-60, -60], [60, -60], [-60, 60], [60, 60]]) gAppend(g, 'cylLo', x + ox, 60, z + oz, 0, 8, 120, 8, [0.5, 0.36, 0.22]); gAppend(g, 'box', x, 130, z, a, 160, 20, 160, [0.62, 0.46, 0.28]); gAppend(g, 'pyr', x, 200, z, a, 200, 110, 200, [0.82, 0.7, 0.42]); });
      for (const [x, z] of spots(1, 1, 16)) { gAppend(g, 'cylLo', x, Hw + 40, z, 0, 3, 80, 3, [0.9, 0.9, 0.9]); gAppend(g, 'cone', x, Hw + 84, z, 0, 70, 22, 70, R() < 0.5 ? [0.95, 0.3, 0.3] : [0.2, 0.6, 0.95]); }
      gAppend(g, 'cylLo', WW + 600, 260, WH * 0.5, 0, 60, 520, 60, [0.95, 0.95, 0.95]); gAppend(g, 'cylLo', WW + 600, 300, WH * 0.5, 0, 62, 50, 62, [0.9, 0.2, 0.2]); gAppend(ge, 'sphLo', WW + 600, 560, WH * 0.5, 0, 40, 40, 40, [1, 0.95, 0.6]); // deniz feneri
    } else if (kind === 'uzay') {
      // anten kuleleri ve yanıp sönen ışıklar
      for (const [x, z] of spots(1, 2, 26)) { const h = rr(120, 260); gAppend(g, 'cylLo', x, Hw + h / 2, z, 0, 5, h, 5, [0.62, 0.66, 0.72]); gAppend(ge, 'sphLo', x, Hw + h + 4, z, 0, 9, 9, 9, R() < 0.5 ? [1, 0.25, 0.25] : [0.3, 0.9, 1]); }
      for (const [x, z] of spots(1, 3, 14)) { gAppend(g, 'cylLo', x, Hw + 50, z, 0, 8, 100, 8, [0.6, 0.62, 0.66]); gAppend(g, 'disc', x, Hw + 110, z, 0, 90, 1, 90, [0.85, 0.87, 0.9], 0.7); }
      // güneş panelleri ve kubbeler
      ring(36, 150, (x, z) => { if (R() < 0.5) { gAppend(g, 'box', x, 120, z, R() < 0.5 ? 0 : Math.PI / 2, 420, 6, 140, [0.1, 0.18, 0.42], 0.3); gAppend(g, 'cylLo', x, 60, z, 0, 10, 120, 10, [0.6, 0.62, 0.66]); }
        else { const s = rr(160, 320); gAppend(g, 'sphLo', x, 0, z, 0, s, s * 0.8, s, [0.78, 0.8, 0.85]); gAppend(ge, 'box', x, s * 0.35, z, 0, s * 1.6, 6, 8, [0.3, 0.9, 1]); } });
      gAppend(g, 'cylLo', WW / 2, 700, WH + 1600, 0, 140, 1400, 140, [0.7, 0.72, 0.78]); gAppend(g, 'box', WW / 2, 1300, WH + 1600, 0, 1800, 40, 120, [0.12, 0.2, 0.44]);
    } else if (kind === 'sakura') {
      const pink = [[1, 0.72, 0.82], [0.98, 0.62, 0.76], [1, 0.82, 0.88]];
      for (const [x, z] of spots(1, 3, 40)) tree(x, z, rr(0.85, 1.3), [0.3, 0.2, 0.16], pink[Math.floor(R() * 3)]);
      // pagodalar
      const pagoda = (x, z, s) => { for (let k = 0; k < 5; k++) { const w = (260 - k * 40) * s, y = (60 + k * 110) * s; gAppend(g, 'box', x, y, z, 0, w * 0.7, 90 * s, w * 0.7, [0.9, 0.88, 0.82]); gAppend(g, 'pyr', x, y + 60 * s, z, Math.PI / 4, w * 1.25, 34 * s, w * 1.25, [0.5, 0.12, 0.12]); } gAppend(g, 'cylLo', x, 640 * s, z, 0, 6 * s, 120 * s, 6 * s, [0.85, 0.7, 0.3]); };
      pagoda(WW / 2, -900, 1.6); pagoda(-700, WH * 0.4, 1.1); pagoda(WW + 700, WH * 0.6, 1.1);
      // torii kapıları ve fenerler
      for (const [x, z] of [[WW * 0.25, WH + 500], [WW * 0.75, WH + 500]]) { gAppend(g, 'cylLo', x - 120, 160, z, 0, 14, 320, 14, [0.82, 0.16, 0.12]); gAppend(g, 'cylLo', x + 120, 160, z, 0, 14, 320, 14, [0.82, 0.16, 0.12]); gAppend(g, 'box', x, 330, z, 0, 360, 24, 30, [0.82, 0.16, 0.12]); gAppend(g, 'box', x, 280, z, 0, 300, 14, 20, [0.82, 0.16, 0.12]); }
      for (const [x, z] of spots(1, 1, 22)) { gAppend(g, 'box', x, Hw + 10, z, 0, 14, 20, 14, [0.55, 0.55, 0.52]); gAppend(ge, 'box', x, Hw + 28, z, 0, 12, 14, 12, [1, 0.8, 0.45]); gAppend(g, 'pyr', x, Hw + 42, z, Math.PI / 4, 24, 10, 24, [0.4, 0.4, 0.38]); }
      ring(50, 300, (x, z) => tree(x, z, rr(1.4, 2.3), [0.28, 0.2, 0.16], pink[Math.floor(R() * 3)]));
    } else if (kind === 'hurda') {
      // bacalar ve duman
      for (const [x, z] of [[-500, WH * 0.25], [-560, WH * 0.7], [WW + 520, WH * 0.35], [WW + 560, WH * 0.8], [WW * 0.5, -700]]) {
        gAppend(g, 'cylLo', x, 450, z, 0, 90, 900, 90, [0.55, 0.42, 0.36]);
        for (let k = 0; k < 3; k++) gAppend(g, 'cylLo', x, 620 + k * 90, z, 0, 93, 24, 93, k % 2 ? [0.9, 0.9, 0.9] : [0.8, 0.15, 0.12]);
        for (let k = 0; k < 6; k++) gAppend(g, 'sphLo', x + k * 60 + rr(-30, 30), 960 + k * 120, z + rr(-40, 40), 0, 160 + k * 50, 110, 160 + k * 50, [0.35, 0.33, 0.3]);
      }
      // hurda araba yığınları
      const carC = [[0.55, 0.2, 0.15], [0.2, 0.3, 0.45], [0.5, 0.45, 0.2], [0.35, 0.36, 0.38], [0.45, 0.25, 0.12]];
      ring(70, 80, (x, z) => { const n = 1 + Math.floor(R() * 4); for (let k = 0; k < n; k++) { const a = rr(0, 3), c = carC[Math.floor(R() * carC.length)]; gAppend(g, 'box', x + rr(-20, 20), 30 + k * 58, z + rr(-20, 20), a, 220, 56, 100, c.map(v => v * rr(0.75, 1.05)), rr(-0.15, 0.15)); } });
      for (const [x, z] of spots(1, 2, 26)) { gAppend(g, 'cylLo', x, Hw + 18, z, 0, 18, 36, 18, [0.32, 0.4, 0.22]); if (R() < 0.4) gAppend(ge, 'sphLo', x, Hw + 37, z, 0, 14, 3, 14, [0.5, 0.95, 0.15]); }
      // mıknatıslı vinç
      gAppend(g, 'box', WW + 300, 380, WH * 0.15, 0, 24, 760, 24, [0.95, 0.72, 0.12]); gAppend(g, 'box', WW, 760, WH * 0.15, 0, 640, 26, 26, [0.95, 0.72, 0.12]); gAppend(g, 'cylLo', WW - 260, 560, WH * 0.15, 0, 70, 30, 70, [0.25, 0.25, 0.27]);
    } else if (kind === 'neon') {
      const neon = [[1, 0.2, 0.7], [0.2, 0.9, 1], [1, 0.8, 0.2], [0.6, 0.3, 1]];
      ring(90, 120, (x, z) => {
        const h = rr(500, 1500), w = rr(180, 360), d = rr(180, 360);
        gAppend(g, 'box', x, h / 2, z, 0, w, h, d, [0.12, 0.13, 0.17]);
        const c = neon[Math.floor(R() * neon.length)];
        for (let y = 140; y < h - 40; y += rr(70, 160)) gAppend(ge, 'box', x, y, z, 0, w + 2, 5, d + 2, c.map(v => v * rr(0.5, 0.9)));
      });
      for (const [x, z] of spots(1, 1, 30)) { const c = neon[Math.floor(R() * neon.length)]; gAppend(ge, 'box', x, Hw + 30, z, R() < 0.5 ? 0 : Math.PI / 2, 90, 34, 8, c); gAppend(g, 'box', x, Hw + 8, z, 0, 6, 16, 6, [0.2, 0.2, 0.22]); }
      for (const [x, z] of spots(1, 1, 24)) { gAppend(g, 'cylLo', x, Hw + 60, z, 0, 5, 120, 5, [0.25, 0.25, 0.28]); gAppend(ge, 'sphLo', x, Hw + 122, z, 0, 14, 8, 14, [0.7, 0.85, 1]); }
    }
  }
  buildProps(ge);
  mkMesh('decor', g); mkMesh('decorEm', ge);
}

/* ---------- silah modelleri (yerel: +X ileri, +Y yukarı, +Z sağ) ---------- */
const GUNM = {
  classic: [[[13, 5, 3.4], [4, 0, 0], '#2a2f37'], [[4, 8, 3], [-1.5, -5, 0], '#1b1e23'], [[3, 1.6, 1.6], [11.5, 1.3, 0], '#6a717c']],
  sheriff: [[[16, 6, 4], [5, 0.5, 0], '#5a4636'], [[5, 6, 5], [1, 0.5, 0], '#3b3f46'], [[5, 9, 3.4], [-2, -5.5, 0], '#2a2018'], [[6, 2.6, 2.6], [14, 2, 0], '#7c838e']],
  spectre: [[[18, 6, 4], [3, 0, 0], '#2f3a44'], [[4, 10, 3], [4, -7, 0], '#1b2026'], [[9, 2, 2], [16, 1, 0], '#5d6670'], [[7, 4, 3], [-10, -0.5, 0], '#1b2026'], [[4, 8, 3], [-2, -5, 0], '#1b2026']],
  vandal: [[[22, 6.5, 4.5], [3, 0, 0], '#3b302a'], [[11, 2.2, 2.2], [19, 1, 0], '#2a2a2a'], [[5, 11, 3.6], [6, -7.5, 0], '#5a3e26'], [[11, 6, 4], [-13, -1, 0], '#6b4a2b'], [[7, 2.5, 2.5], [2, 4.5, 0], '#202020'], [[4, 8, 3], [-3, -5.5, 0], '#202020']],
  phantom: [[[21, 6.5, 4.6], [3, 0, 0], '#d4dbe2'], [[14, 3.4, 3.4], [20, 1, 0], '#2b3138'], [[5, 11, 3.6], [6, -7.5, 0], '#2b3138'], [[10, 5.5, 4], [-12, -0.5, 0], '#c3cad1'], [[6, 2.4, 2.4], [2, 4.4, 0], '#2b3138'], [[4, 8, 3], [-3, -5.5, 0], '#2b3138']],
  sword: [[[34, 1.4, 3.6], [21, 0, 0], '#d6dde4'], [[30, 0.6, 1.2], [21, 0.6, 0], '#ffffff'], [[2.2, 2.6, 11], [3.6, 0, 0], '#c9a227'], [[7, 2.6, 2.6], [-1.5, 0, 0], '#3a2618'], [[2.4, 3, 3], [-5.6, 0, 0], '#c9a227']],
  railgun: [[[30, 7, 5.6], [3, 0, 0], '#1d2733'], [[24, 2, 6.8], [22, 2.4, 0], '#2e3d4d'], [[24, 2, 6.8], [22, -2.4, 0], '#2e3d4d'], [[22, 1.2, 1.2], [22, 0, 0], '#7cf3ff'], [[10, 5, 6.4], [-2, 0, 0], '#7cf3ff'], [[12, 6.5, 4.6], [-17, -1, 0], '#1d2733'], [[4, 8, 3], [-5, -5.5, 0], '#111'], [[6, 3, 3], [4, 5.2, 0], '#111']],
  operator: [[[30, 6.5, 5], [3, 0, 0], '#40503d'], [[20, 2.8, 2.8], [26, 1, 0], '#222'], [[16, 4.5, 4.5], [3, 6.5, 0], '#151515'], [[13, 7, 4.5], [-18, -1, 0], '#40503d'], [[5, 7, 3.4], [3, -6, 0], '#222'], [[4, 8, 3], [-6, -5.5, 0], '#222']]
};
const GUNC = {};
for (const k in GUNM) GUNC[k] = GUNM[k].map(p => [p[0], p[1], hexRGB(p[2])]);
/* Silahı dünyada çiz: konum (x,h,z), yön (a,pitch), ölçek */
function drawGun(wid, x, h, z, a, pitch, sc, o, owner, t) {
  if (MDL.ready || mdlInit()) { // 3B silah modeli
    const R = rotMat(a, pitch, 0, new Array(9));
    drawGunModel(wid, x, h, z, R, sc, o && o.alpha !== undefined ? null : o, gunColsFor(wid, owner, t), o && o.alpha !== undefined ? o.alpha : 1);
    return R;
  }
  return drawGunBox(wid, x, h, z, a, pitch, sc, o, owner, t);
}
function drawGunBox(wid, x, h, z, a, pitch, sc, o, owner, t) {
  const parts = owner ? gunPartsFor(wid, owner, t) : (GUNC[wid] || GUNC.classic), R = rotMat(a, pitch, 0, new Array(9));
  for (const [s, p, c, gl] of parts) {
    const off = xf(R, p[0] * sc, p[1] * sc, p[2] * sc);
    const oo = gl ? Object.assign({}, o || {}, { em: [c[0] * gl, c[1] * gl, c[2] * gl] }) : o;
    QR('box', x + off[0], h + off[1], z + off[2], R, s[0] * sc, s[1] * sc, s[2] * sc, o && o.alpha !== undefined ? [c[0], c[1], c[2], o.alpha] : c, oo);
  }
  return R;
}

/* ---------- karakter modeli ---------- */
/* ---------- C4 bombası ----------
   yerel eksen: +X uzunluk, +Y yukarı, +Z genişlik; taban y=0 */
const C4C = { brick: [0.66, 0.6, 0.42], brick2: [0.6, 0.55, 0.38], tape: [0.16, 0.16, 0.17], box: [0.13, 0.14, 0.15], key: [0.55, 0.57, 0.6], red: [0.85, 0.12, 0.12], blue: [0.15, 0.35, 0.85], yel: [0.9, 0.78, 0.15] };
function drawC4(x, h, z, ang, pitch, s, mode, t, alpha) {
  // mode: 'planted' | 'dropped' | 'carried'; sayaç bitmeye yaklaştıkça LED hızlanır
  const R = rotMat(ang, pitch, 0, new Array(9)), A = alpha === undefined ? 1 : alpha;
  const P = (lx, ly, lz, sx, sy, sz, col, o, mesh) => {
    const off = xf(R, lx * s, ly * s, lz * s);
    QR(mesh || 'box', x + off[0], h + off[1], z + off[2], R, sx * s, sy * s, sz * s, [col[0], col[1], col[2], A], o);
  };
  // üç kalıp patlayıcı
  for (const [k, lz] of [[0, -6.4], [1, 0], [2, 6.4]]) P(0, 3.2, lz, 26, 6.4, 6, k === 1 ? C4C.brick2 : C4C.brick);
  // bantlar
  P(-7.5, 3.25, 0, 3, 6.7, 19.6, C4C.tape); P(7.5, 3.25, 0, 3, 6.7, 19.6, C4C.tape);
  // zamanlayıcı modülü + ekran + tuş takımı
  P(0, 7.6, 0, 12, 2.6, 10, C4C.box);
  const sp = S && S.bomb, planted = mode === 'planted', urgent = planted && sp && sp.t < 10;
  const blink = planted ? ((t * (urgent ? 5 : 1.6)) % 1 < 0.5) : false;
  P(-2.2, 9, 0, 6, 0.4, 7, planted ? [0.25, 0.9, 0.35] : [0.08, 0.2, 0.1], { lit: 0, em: planted ? [0.15, 0.55, 0.2] : ZERO3 });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) P(3 + j * 2.1, 9.1, -2.6 + i * 2.6, 1.5, 0.5, 1.6, C4C.key);
  // kablolar (modülden kalıplara)
  P(-6.4, 6.8, 4.6, 1, 1, 5, C4C.red); P(-6.4, 6.8, -4.6, 1, 1, 5, C4C.blue); P(6.4, 6.8, 2.5, 1, 1, 6, C4C.yel);
  P(-9.5, 5.8, 4.6, 6, 1, 1, C4C.red); P(-9.5, 5.8, -4.6, 6, 1, 1, C4C.blue);
  // anten ve LED
  P(5, 11.5, 4, 0.8, 7, 0.8, C4C.box, null, 'cyl');
  P(-5, 9.6, -4, 1.8, 1.8, 1.8, blink ? [1, 0.25, 0.25] : [0.35, 0.08, 0.08], { em: blink ? [1, 0.15, 0.15] : ZERO3 }, 'sphere');
}
function drawCharacterBox(p, rel, alpha, xray, t) {
  const em = p._emo && p._emo.t > 0 ? p._emo : null, ek = em ? EMOTES[em.e].k : null, et = em ? EMOTE_TIME - em.t : 0;
  const ag = AGCOL[p.agent] || COL.white, lift = (p.st.knock > 0 ? KNOCK_LIFT + Math.sin(t * 8) * 3 : 0) + (p.jz || 0) + (ek === 'dance' ? Math.abs(Math.sin(et * 9)) * 6 : ek === 'cheer' || ek === 'gg' ? Math.abs(Math.sin(et * 7)) * 9 : 0);
  const A = p.ang + (ek === 'dance' ? et * 6.5 : 0), R = rotMat(A, 0, p.st.knock > 0 ? Math.sin(t * 6) * 0.3 : ek === 'laugh' ? Math.sin(et * 28) * 0.07 : 0, new Array(9));
  const moving = clamp((p.spd || 0) / RUN, 0, 1);
  p._walk = (p._walk || 0) + moving * 0.16;
  const sw = Math.sin(p._walk) * 6 * moving;
  const rc = rel === 'ally' ? COL.teal : COL.red;
  const o = xray ? { xray: true, lit: 0, em: [0.6, 0.05, 0.1] } : null;
  const C = (c, k) => xray ? [1, 0.25, 0.3, 0.45] : [c[0] * (k || 1), c[1] * (k || 1), c[2] * (k || 1), alpha];
  const part = (fx, h, sz, sx, sy, szz, col, extra) => {
    const off = xf(R, fx, h + lift, sz);
    QR('box', p.x + off[0], off[1], p.y + off[2], R, sx, sy, szz, col, extra || o);
  };
  // karakter skini (yoksa ajan renkleri) — takım şeridi her zaman takım renginde kalır
  const cs = charSkin(p, t), suitC = cs ? cs.suit : ag, suitK = cs ? 1 : 0.75, legC = cs ? cs.legs : COL.dark, legK = cs ? 1 : 1.2;
  const visC = cs ? cs.visor : ag, helmC = cs ? cs.helm : ag, helmK = cs ? 1 : 0.55, packC = cs ? cs.pack : COL.dark, packK = cs ? 1 : 1.4;
  const glo = (c, k) => xray ? o : { em: [c[0] * k, c[1] * k, c[2] * k] };
  // bacaklar (eğilince kısa ve bükük)
  const cr = !!p.crouch, dy = cr ? -21 : 0, hx = cr ? 3 : 0;
  if (cr) { part(5, 6, -5, 16, 12, 8, C(legC, legK)); part(-4, 7, 5, 10, 14, 8, C(legC, legK)); }
  else { part(sw, 13, -5, 9, 26, 8, C(legC, legK)); part(-sw, 13, 5, 9, 26, 8, C(legC, legK)); }
  // gövde + takım şeridi
  part(cr ? 2 : 0, 41 + dy, 0, 12, 30, 22, C(suitC, suitK));
  part(cr ? 2.4 : 0.4, 49 + dy, 0, 12.6, 4, 22.6, xray ? C(rc) : [rc[0], rc[1], rc[2], alpha], xray ? o : { em: [rc[0] * 0.5, rc[1] * 0.5, rc[2] * 0.5] });
  if (cs && cs.glow) part(cr ? 2.4 : 0.4, 33 + dy, 0, 12.4, 1.6, 22.4, xray ? C(visC) : [visC[0], visC[1], visC[2], alpha], glo(visC, 0.8));
  part(cr ? -4.5 : -6.5, 44 + dy, 0, 3, 22, 16, C(packC, packK));
  // kafa + vizör
  part(hx, 64 + dy, 0, 12, 13, 12, C(COL.skin, 0.9));
  part(cr ? 8.6 : 5.6, 65 + dy, 0, 2, 4, 10, xray ? C(visC) : [visC[0], visC[1], visC[2], alpha], glo(visC, 0.7));
  part(hx, 71.5 + dy, 0, 13, 3, 13, C(helmC, helmK));
  // şapka / süs
  if (cs && cs.hat && !xray) {
    const hd = cs.helm, ac = cs.visor, H0 = dy;
    switch (cs.hat) {
      case 'cap': part(hx, 74.5 + H0, 0, 12, 3, 12, C(hd)); part(hx + 6, 72.5 + H0, 0, 8, 1.5, 12, C(hd, 0.7)); break;
      case 'ears': for (const s of [-1, 1]) { part(hx, 76 + H0, 4.5 * s, 3, 5, 3, C(hd)); part(hx + 1.6, 75.5 + H0, 4.5 * s, 0.6, 3, 1.4, [ac[0], ac[1], ac[2], alpha], glo(ac, 0.5)); } break;
      case 'antenna': part(hx - 1, 79 + H0, 3, 1, 10, 1, C([0.2, 0.2, 0.22, 1])); part(hx - 1, 84.5 + H0, 3, 3, 3, 3, [ac[0], ac[1], ac[2], alpha], glo(ac, 0.9)); break;
      case 'mohawk': part(hx - 1, 76 + H0, 0, 12, 6, 2.5, [ac[0], ac[1], ac[2], alpha], glo(ac, 0.7)); break;
      case 'horns': for (const s of [-1, 1]) { part(hx, 76 + H0, 6 * s, 2.5, 6, 2.5, C([0.91, 0.88, 0.82, 1])); part(hx, 80 + H0, 7.5 * s, 2, 3, 2, C([0.91, 0.88, 0.82, 1])); } break;
      case 'crown': { const gd = [0.96, 0.77, 0.32, 1]; part(hx, 74.2 + H0, 0, 13.5, 2.6, 13.5, [gd[0], gd[1], gd[2], alpha], glo(gd, 0.35));
        for (const a of [-5.2, 5.2]) for (const b of [-5.2, 5.2]) part(hx + a, 77 + H0, b, 2.4, 3.2, 2.4, [gd[0], gd[1], gd[2], alpha], glo(gd, 0.35));
        part(hx + 6.8, 75 + H0, 0, 0.6, 1.6, 1.6, [1, 0.27, 0.33, alpha], glo([1, 0.27, 0.33], 0.6)); break; }
      case 'halo': { const hp = xf(R, hx, 83 + H0 + lift, 0); Q('ring', p.x + hp[0], hp[1], p.y + hp[2], t * 1.5, 0, 9, 1, 9, [ac[0], ac[1], ac[2], 0.95 * alpha], { add: true, lit: 0 }); break; }
      case 'band': part(hx, 69 + H0, 0, 13.2, 2.2, 13.2, C(ac)); part(hx - 8, 67.5 + H0, 2, 6, 1.5, 1.5, C(ac)); break;
    }
  }
  // kollar ve silah
  const pt = p.pitch || 0;
  if (p.st.ovl > 0) {
    const hp = xf(R, 14, 50 + dy + lift, 0);
    Q('sphere', p.x + hp[0], hp[1], p.y + hp[2], 0, 0, 12, 12, 12, [1, 0.95, 0.4, 0.8 * alpha], { add: true, lit: 0, em: [1, 0.9, 0.2] });
  } else if (em) {
    // emote kolları (silah gizlenir)
    const arm = C(suitC, suitK), skin = C(COL.skin, 0.9);
    if (ek === 'wave') { const w = Math.sin(et * 12) * 3; part(2, 71 + dy, 12 + w, 5, 20, 5, arm); part(2, 83 + dy, 12 + w * 1.4, 5, 5, 5, skin); part(0, 40 + dy, -13, 5, 18, 5, arm); }
    else if (ek === 'dance') { const s = Math.sin(et * 9) * 9; part(0, 58 + dy + s, 13, 5, 18, 5, arm); part(0, 58 + dy - s, -13, 5, 18, 5, arm); }
    else if (ek === 'cheer' || ek === 'gg') { part(0, 72 + dy, 12, 5, 20, 5, arm); part(0, 72 + dy, -12, 5, 20, 5, arm); part(0, 84 + dy, 12, 5, 5, 5, skin); part(0, 84 + dy, -12, 5, 5, 5, skin);
      if (ek === 'gg') { part(0, 92 + dy, 12, 7, 8, 7, [0.96, 0.77, 0.32, alpha], { em: [0.5, 0.38, 0.1] }); } }
    else if (ek === 'thumb') { part(9, 54 + dy, 10, 16, 5, 5, arm); part(18, 59 + dy, 10, 3, 7, 3, skin); part(0, 40 + dy, -13, 5, 18, 5, arm); }
    else if (ek === 'laugh') { part(7, 41 + dy, 8, 11, 5, 5, arm); part(7, 41 + dy, -8, 11, 5, 5, arm); }
  } else {
    part(7, 50 + dy, 9, 16, 5, 5, C(suitC, suitK));
    part(10, 50 + dy, -7, 18, 5, 5, C(suitC, suitK));
    const wid = curW(p);
    if (p._sw > 0) p._sw -= 1 / 60;
    // kılıç: boşta öne-yukarı eğik; savururken sağ üstten sol alta yatay-çapraz kesik
    let side = 2, yawO = 0, pit = 0;
    if (wid === 'sword') {
      const k = p._sw > 0 ? clamp(1 - p._sw / 0.32, 0, 1) : -1;
      if (k >= 0) { const e = k * k * (3 - 2 * k); side = 10 - 18 * e; yawO = 1.25 - 2.5 * e; pit = 0.75 - 1.05 * e; }
      else pit = 0.55;
    }
    const g = xf(R, 13, 51 + dy + lift + (wid === 'sword' && p._sw > 0 ? 4 : 0), side);
    if (!xray) drawGun(wid, p.x + g[0], g[1], p.y + g[2], A + yawO, pt + pit, 0.95, alpha < 1 ? { alpha } : null, p, t);
  }
  // durum göstergeleri
  if (!xray) {
    if (p.st.clone > 0) Q('cyl', p.x, 40 + lift, p.y, 0, 0, 44, 84, 44, [1, 0.55, 0.2, 0.18], { add: true, lit: 0 });
    if (p.st.lock > 0) Q('ring', p.x, 2, p.y, t * 2, 0, 46, 1, 46, [1, 0.82, 0.4, 0.85], { add: true, lit: 0 });
    if (p.zoneSlow < 1 || p.st.slow > 0) Q('ring', p.x, 1.5, p.y, 0, 0, 38, 1, 38, [0.6, 0.85, 1, 0.8], { add: true, lit: 0 });
    if (p.st.reveal > 0 && rel === 'enemy') Q('ring', p.x, 2, p.y, 0, 0, 50 + Math.sin(t * 10) * 6, 1, 50, [1, 0.3, 0.35, 0.9], { add: true, lit: 0 });
    if (p.st.concuss > 0) for (let i = 0; i < 3; i++) { const aa = t * 5 + i * 2.1; Q('sphere', p.x + Math.cos(aa) * 12, 82 + lift, p.y + Math.sin(aa) * 12, 0, 0, 4, 4, 4, [0.85, 0.65, 0.35, 1], { lit: 0, em: [0.4, 0.3, 0.1] }); }
    if (p.st.boost > 0 && p.spd > 50) Q('cone', p.x - Math.cos(A) * 16, 30, p.y - Math.sin(A) * 16, A + Math.PI, -Math.PI / 2, 20, 30, 20, [1, 0.95, 0.3, 0.25], { add: true, lit: 0, roll: 0 });
    const prog = p.plantT > 0 ? p.plantT / PLANT_TIME : p.defT > 0 ? p.defT / DEFUSE_TIME : 0;
    if (prog > 0) Q('ring', p.x, 2, p.y, 0, 0, 40 + prog * 30, 1, 40 + prog * 30, [0.96, 0.77, 0.32, 0.9], { add: true, lit: 0 });
    // sırtta taşınan C4
    if (p.hasBomb) { const bo = xf(R, -10.5, 36 + dy + lift, 0); drawC4(p.x + bo[0], bo[1], p.y + bo[2], A, Math.PI / 2, 0.8, 'carried', t, alpha); }
  }
}
function drawCorpseBox(c, ally) {
  const a = ((c.id.charCodeAt(c.id.length - 1) * 37) % 360) * Math.PI / 180, R = rotMat(a, 0, 0, new Array(9));
  const col = ally ? [0.25, 0.5, 0.5, 1] : [0.5, 0.22, 0.25, 1];
  const P = (fx, h, sz, sx, sy, szz, cc) => { const o = xf(R, fx, h, sz); QR('box', c.x + o[0], o[1], c.y + o[2], R, sx, sy, szz, cc); };
  P(0, 5, 0, 30, 10, 20, col); P(21, 6, 0, 12, 11, 12, [0.55, 0.45, 0.38, 1]); P(-24, 4, -5, 22, 7, 8, [0.15, 0.17, 0.2, 1]); P(-24, 4, 5, 22, 7, 8, [0.15, 0.17, 0.2, 1]);
}

/* ---------- karakter (3B model: 07g) ---------- */
function _basisY(d) { // Y ekseni d yönünde dik taban (silindir/kol için)
  const y = v3n(d), h = Math.abs(y[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], x = v3n(v3c(h, y)), z = v3c(x, y);
  return [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]];
}
function drawCharacter(p, rel, alpha, xray, t) {
  if (!MDL.ready && !mdlInit()) return drawCharacterBox(p, rel, alpha, xray, t);
  const ch = MDL.ch, B = ch.B, PV = ch.piv;
  const em = p._emo && p._emo.t > 0 ? p._emo : null, ek = em ? EMOTES[em.e].k : null, et = em ? EMOTE_TIME - em.t : 0;
  const ag = AGCOL[p.agent] || COL.white, lift = (p.st.knock > 0 ? KNOCK_LIFT + Math.sin(t * 8) * 3 : 0) + (p.jz || 0) + (ek === 'dance' ? Math.abs(Math.sin(et * 9)) * 6 : ek === 'cheer' || ek === 'gg' ? Math.abs(Math.sin(et * 7)) * 9 : 0);
  const A = p.ang + (ek === 'dance' ? et * 6.5 : 0), R = rotMat(A, 0, p.st.knock > 0 ? Math.sin(t * 6) * 0.3 : ek === 'laugh' ? Math.sin(et * 28) * 0.07 : 0, new Array(9));
  const rc = rel === 'ally' ? COL.teal : COL.red;
  const o = xray ? { xray: true, lit: 0, em: [0.6, 0.05, 0.1] } : null;
  // karakter skini (yoksa ajan renkleri)
  const cs = charSkin(p, t), suitC = cs ? cs.suit : ag, suitK = cs ? 1 : 0.75, legC = cs ? cs.legs : COL.dark, legK = cs ? 1 : 1.2;
  const visC = cs ? cs.visor : ag, packC = cs ? cs.pack : COL.dark, packK = cs ? 1 : 1.4;
  const C4 = (c, k) => [c[0] * k, c[1] * k, c[2] * k, alpha];
  const cols = { suit: C4(suitC, suitK), legs: C4(legC, legK), pack: C4(packC, packK), acc: C4(visC, 1) };
  const wid = curW(p), pt = p.pitch || 0;
  if (p._sw > 0) p._sw -= 1 / 60;
  // animasyon katmanları
  const gun = wid !== 'sword' && !(p.st.ovl > 0), low = mdlCharState(p, t, gun), md = p._md;
  md.cr = (md.cr || 0) + ((p.crouch ? 1 : 0) - (md.cr || 0)) * 0.25;
  let up, pitch = 0;
  if (em) up = ek === 'wave' ? [['wave', et % 1.66, 1]] : ek === 'cheer' || ek === 'gg' ? [['wave', 0.55, 1]] : [['idle', t % 1.66, 1]];
  else if (wid === 'sword' || p.st.ovl > 0) up = p._sw > 0 ? [['slash', 0.2 + clamp(1 - p._sw / 0.32, 0, 1) * 0.5, 1]] : [['idleSword', t % 1.66, 1]];
  else {
    // silahla: durunca iki elle nişan, koşarken silahı göğüste taşıyarak koşma; havada zıplama pozu; vurulunca sarsılma
    const ch2 = MDL.ch, mv = md.mv * (1 - md.air), aimK = ch2.clips.aim2 ? 'aim2' : 'aim';
    up = [[aimK, t % (ch2.clips[aimK].d || 1.66), (1 - mv * 0.85) * (1 - md.air)]];
    if (ch2.clips.runGun) up.push(['runGun', md.ph * ch2.clips.runGun.d, mv * 0.85 * (1 - md.air)]);
    if (md.air > 0.01 && ch2.clips.jump) up.push(['jump', 0.35, md.air]);
    const ht = p._hitT !== undefined && S ? S.time - p._hitT : 9;
    if (ht < 0.35 && ch2.clips.hit) up.push(['hit', 0.08 + ht * 0.6, 0.7 * (1 - ht / 0.35)]);
    pitch = pt;
  }
  const st = { low, up, pitch, crouch: md.cr, R, x: p.x, y: p.y, lift, cols, alpha, o, xray, accGlow: cs && cs.glow && !xray ? { em: [visC[0] * 0.7, visC[1] * 0.7, visC[2] * 0.7] } : null };
  const W = mdlDrawChar(p, st);
  if (!xray) {
    // takım kol bantları (dost turkuaz / rakip kırmızı, parlak)
    for (const [ua, sh, el] of [[B.UpperArmL, PV.shL, PV.elL], [B.UpperArmR, PV.shR, PV.elR]]) {
      if (ua < 0 || !sh || !el) continue;
      const a = mdlPt(W, ua, st, sh), b = mdlPt(W, ua, st, el), m = [a[0] + (b[0] - a[0]) * 0.55, a[1] + (b[1] - a[1]) * 0.55, a[2] + (b[2] - a[2]) * 0.55];
      QR('cyl', m[0], m[1], m[2], _basisY([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), 6.4, 2.0, 6.4, [rc[0], rc[1], rc[2], alpha], { em: [rc[0] * 0.55, rc[1] * 0.55, rc[2] * 0.55] });
    }
    // şapka / süs (başın üstüne)
    if (cs && cs.hat) {
      const top = mdlPt(W, B.Head, st, ch.headTop), hd = cs.helm, ac = cs.visor, Ry = rotMat(A, 0, 0, new Array(9));
      const glo = (c, k) => ({ em: [c[0] * k, c[1] * k, c[2] * k] });
      const part = (fx, y, sz, sx, sy, szz, col, extra) => { const off = xf(Ry, fx, y - 73, sz); QR('box', top[0] + off[0], top[1] + off[1], top[2] + off[2], Ry, sx, sy, szz, col, extra); };
      const C = (c, k) => C4(c, k || 1);
      switch (cs.hat) {
        case 'cap': part(0, 74.5, 0, 12, 3, 12, C(hd)); part(6, 72.5, 0, 8, 1.5, 12, C(hd, 0.7)); break;
        case 'ears': for (const s of [-1, 1]) { part(0, 76, 4.5 * s, 3, 5, 3, C(hd)); part(1.6, 75.5, 4.5 * s, 0.6, 3, 1.4, C(ac), glo(ac, 0.5)); } break;
        case 'antenna': part(-1, 79, 3, 1, 10, 1, C([0.2, 0.2, 0.22, 1])); part(-1, 84.5, 3, 3, 3, 3, C(ac), glo(ac, 0.9)); break;
        case 'mohawk': part(-1, 76, 0, 12, 6, 2.5, C(ac), glo(ac, 0.7)); break;
        case 'horns': for (const s of [-1, 1]) { part(0, 76, 6 * s, 2.5, 6, 2.5, C([0.91, 0.88, 0.82, 1])); part(0, 80, 7.5 * s, 2, 3, 2, C([0.91, 0.88, 0.82, 1])); } break;
        case 'crown': { const gd = [0.96, 0.77, 0.32, 1]; part(0, 74.2, 0, 13.5, 2.6, 13.5, C(gd), glo(gd, 0.35));
          for (const a of [-5.2, 5.2]) for (const b of [-5.2, 5.2]) part(a, 77, b, 2.4, 3.2, 2.4, C(gd), glo(gd, 0.35)); break; }
        case 'halo': Q('ring', top[0], top[1] + 10, top[2], t * 1.5, 0, 9, 1, 9, [ac[0], ac[1], ac[2], 0.95 * alpha], { add: true, lit: 0 }); break;
        case 'band': part(0, 69, 0, 13.2, 2.2, 13.2, C(ac)); break;
      }
    }
    // elde: aşırı yükleme küresi ya da silah
    if (p.st.ovl > 0) {
      const hp = mdlPt(W, B.WristR, st, PV.wrR);
      Q('sphere', hp[0], hp[1], hp[2], 0, 0, 12, 12, 12, [1, 0.95, 0.4, 0.8 * alpha], { add: true, lit: 0, em: [1, 0.9, 0.2] });
    } else if (!em || ek === 'thumb' || ek === 'laugh') {
      let yawO = 0, pit = 0;
      if (wid === 'sword') {
        const k = p._sw > 0 ? clamp(1 - p._sw / 0.32, 0, 1) : -1;
        if (k >= 0) { const e = k * k * (3 - 2 * k); yawO = 1.25 - 2.5 * e; pit = 0.75 - 1.05 * e; } else pit = 0.55;
      }
      const g = mdlPt(W, B.WristR, st, PV.wrR), Rg = rotMat(A + yawO, (wid === 'sword' ? 0 : pt * 0.85) + pit, 0, new Array(9)), fo = xf(Rg, 2.5, 0.5, 0);
      if (!em) drawGunModel(wid, g[0] + fo[0], g[1] + fo[1], g[2] + fo[2], Rg, wid === 'sword' ? 0.9 : 0.95, null, gunColsFor(wid, p, t), alpha);
    }
    // durum göstergeleri
    if (p.st.clone > 0) Q('cyl', p.x, 40 + lift, p.y, 0, 0, 44, 84, 44, [1, 0.55, 0.2, 0.18], { add: true, lit: 0 });
    if (p.st.lock > 0) Q('ring', p.x, 2, p.y, t * 2, 0, 46, 1, 46, [1, 0.82, 0.4, 0.85], { add: true, lit: 0 });
    if (p.zoneSlow < 1 || p.st.slow > 0) Q('ring', p.x, 1.5, p.y, 0, 0, 38, 1, 38, [0.6, 0.85, 1, 0.8], { add: true, lit: 0 });
    if (p.st.reveal > 0 && rel === 'enemy') Q('ring', p.x, 2, p.y, 0, 0, 50 + Math.sin(t * 10) * 6, 1, 50, [1, 0.3, 0.35, 0.9], { add: true, lit: 0 });
    if (p.st.concuss > 0) for (let i = 0; i < 3; i++) { const aa = t * 5 + i * 2.1; Q('sphere', p.x + Math.cos(aa) * 12, 82 + lift, p.y + Math.sin(aa) * 12, 0, 0, 4, 4, 4, [0.85, 0.65, 0.35, 1], { lit: 0, em: [0.4, 0.3, 0.1] }); }
    if (p.st.boost > 0 && p.spd > 50) Q('cone', p.x - Math.cos(A) * 16, 30, p.y - Math.sin(A) * 16, A + Math.PI, -Math.PI / 2, 20, 30, 20, [1, 0.95, 0.3, 0.25], { add: true, lit: 0, roll: 0 });
    const prog = p.plantT > 0 ? p.plantT / PLANT_TIME : p.defT > 0 ? p.defT / DEFUSE_TIME : 0;
    if (prog > 0) Q('ring', p.x, 2, p.y, 0, 0, 40 + prog * 30, 1, 40 + prog * 30, [0.96, 0.77, 0.32, 0.9], { add: true, lit: 0 });
    // sırtta taşınan bomba
    if (p.hasBomb) { const c = mdlPt(W, B.Chest >= 0 ? B.Chest : B.Hips, st, ch.chestBack), bo = [0, 0, 0]; drawC4(c[0] + bo[0], c[1] + bo[1], c[2] + bo[2], A, Math.PI / 2, 0.8, 'carried', t, alpha); }
  }
}
function drawCorpse(c, ally) {
  if (!MDL.ready && !mdlInit()) return drawCorpseBox(c, ally);
  const a = ((c.id.charCodeAt(c.id.length - 1) * 37) % 360) * Math.PI / 180, R = rotMat(a, 0, 0, new Array(9));
  const key = c.id + ':' + (S ? S.round : 0) + ':' + Math.round(c.x) + ':' + Math.round(c.y), now = S ? S.time : 0;
  let t0 = MDL.cT.get(key); if (t0 === undefined) { if (MDL.cT.size > 300) MDL.cT.clear(); t0 = now; MDL.cT.set(key, t0); }
  const pl = S && S.pmap ? S.pmap[c.id] : null, ag = pl ? (AGCOL[pl.agent] || COL.white) : (ally ? COL.teal : COL.red), k = 0.6;
  const cols = { suit: [ag[0] * k, ag[1] * k, ag[2] * k, 1], legs: [COL.dark[0] * 1.1, COL.dark[1] * 1.1, COL.dark[2] * 1.1, 1], pack: [COL.dark[0] * 1.3, COL.dark[1] * 1.3, COL.dark[2] * 1.3, 1], acc: [ag[0] * k, ag[1] * k, ag[2] * k, 1] };
  // ölme animasyonu: dört farklı düşüş (oyuncuya ve raunda göre değişir)
  const DK = ['death', 'death2', 'death3', 'death4'].filter(k => MDL.ch.clips[k]), hh = (c.id.charCodeAt(0) * 7 + c.id.charCodeAt(c.id.length - 1) * 13 + (S ? S.round : 0) * 5) % DK.length;
  mdlDrawChar(c, { low: [[DK[hh] || 'death', clamp(now - t0, 0, 5), 1]], up: null, pitch: 0, crouch: 0, R, x: c.x, y: c.y, lift: 0, cols, alpha: 1, o: null });
}

/* ---------- birinci şahıs silah görünümü ---------- */
function drawViewmodel(p, dt, t) {
  if (!p || !p.alive || p.scoped) return;
  const wid = curW(p);
  if (VM.lastW !== wid) { VM.lastW = wid; VM.swap = 1; }
  VM.kick = Math.max(0, VM.kick - dt * 7); VM.flash = Math.max(0, VM.flash - dt); VM.swap = Math.max(0, VM.swap - dt * 3.2);
  const mv = clamp((p.spd || 0) / RUN, 0, 1);
  VM.bob += dt * (4 + mv * 7);
  const bx = Math.sin(VM.bob) * 0.9 * mv, by = Math.abs(Math.cos(VM.bob)) * 0.9 * mv;
  const rl = p.reloadT > 0 ? Math.min(1, p.reloadT * 2, (WEAPONS[wid].reload - p.reloadT) * 3) : 0;
  const ag = AGCOL[p.agent] || COL.white;
  // kamera uzayı: +x sağ, +y yukarı, -z ileri
  const gx = 6.6 * clamp(W / H / 1.78, 1, 1.45) + bx, gy = -6.4 - by - rl * 5 - VM.swap * 12, gz = -17 + VM.kick * 2.6;
  const vm = { vm: true };
  if (p.st.ovl > 0) {
    for (const s of [-1, 1]) {
      const pulse = 1 + Math.sin(t * 30 + s) * 0.15;
      Q('sphere', 6 * s, -7, -16, 0, 0, 5 * pulse, 5 * pulse, 5 * pulse, [1, 0.97, 0.5, 0.9], { vm: true, add: true, lit: 0 });
      Q('box', 6 * s, -10, -11, Math.PI / 2, 0, 9, 4.5, 4.5, [ag[0] * 0.8, ag[1] * 0.8, ag[2] * 0.8, 1], vm);
    }
    return;
  }
  if (wid === 'sword') { drawSwordVM(p, dt, t, gx, gy, gz, ag, vm); return; }
  const a = -Math.PI / 2 - 0.09, pitch = 0.03 + VM.kick * 0.2 - rl * 0.5;
  const R = rotMat(a, pitch, rl * 0.6, new Array(9));
  if (MDL.ready || mdlInit()) { drawViewmodelModel(p, t, wid, R, gx, gy, gz, ag); return; }
  const sc = wid === 'operator' || wid === 'railgun' ? 0.42 : 0.48;
  for (const [s, o, c, gl] of gunPartsFor(wid, p, t)) {
    const off = xf(R, o[0] * sc, o[1] * sc, o[2] * sc);
    QR('box', gx + off[0], gy + off[1], gz + off[2], R, s[0] * sc, s[1] * sc, s[2] * sc, c, gl ? { vm: true, em: [c[0] * gl, c[1] * gl, c[2] * gl] } : vm);
  }
  // eller / kollar
  const hr = xf(R, -2 * sc, -5 * sc, 1.5 * sc), hl = xf(R, 9 * sc, -3 * sc, -1 * sc);
  QR('box', gx + hr[0], gy + hr[1], gz + hr[2], R, 5 * sc, 5 * sc, 5 * sc, COL.skin, vm);
  QR('box', gx + hl[0], gy + hl[1], gz + hl[2], R, 5 * sc, 4 * sc, 5 * sc, COL.skin, vm);
  const sl = xf(R, -10 * sc, -7 * sc, 4 * sc), cs = charSkin(p, t), slc = cs ? cs.suit : ag;
  QR('box', gx + sl[0], gy + sl[1], gz + sl[2], R, 14 * sc, 6 * sc, 6 * sc, [slc[0] * 0.7, slc[1] * 0.7, slc[2] * 0.7, 1], vm);
  if (VM.flash > 0) {
    const L = (WEAPONS[wid].len || 20) * sc * 1.15, m = xf(R, L, 0.8 * sc, 0);
    Q('sphere', gx + m[0], gy + m[1], gz + m[2], 0, 0, 5, 5, 5, [1, 0.85, 0.45, 0.95], { vm: true, add: true, lit: 0 });
  }
}

/* Birinci şahıs: 3B silah modeli + eldivenli eller ve kollar */
const VM_GLOVE = [0.13, 0.14, 0.16, 1];
function vmArm(hand, elbow, slc, r) {
  const vm = { vm: true }, d = [elbow[0] - hand[0], elbow[1] - hand[1], elbow[2] - hand[2]], l = Math.hypot(d[0], d[1], d[2]), u = [d[0] / l, d[1] / l, d[2] / l], RB = _basisY(d);
  // eldiven (yuvarlak), bilek manşeti, kol (taktik koyu kumaş, ajan renginden hafif ton)
  QR('sphMd', hand[0], hand[1], hand[2], RB, r * 1.25, r * 1.5, r * 1.1, VM_GLOVE, vm);
  const c = [hand[0] + u[0] * r * 1.1, hand[1] + u[1] * r * 1.1, hand[2] + u[2] * r * 1.1];
  QR('cyl', c[0], c[1], c[2], RB, r * 1.15, r * 0.7, r * 1.15, [0.07, 0.08, 0.09, 1], vm);
  const s0 = r * 1.4, m = [hand[0] + u[0] * (s0 + l) / 2, hand[1] + u[1] * (s0 + l) / 2, hand[2] + u[2] * (s0 + l) / 2];
  const k = 0.32, base = [0.16, 0.17, 0.19];
  QR('cyl', m[0], m[1], m[2], RB, r * 1.2, l - s0, r * 1.2, [base[0] + slc[0] * k, base[1] + slc[1] * k, base[2] + slc[2] * k, 1], vm);
}
function drawViewmodelModel(p, t, wid, R, gx, gy, gz, ag) {
  const G = MDL.guns[wid] || MDL.guns.classic, sc = clamp(14 / G.len, 0.3, 0.5), vm = { vm: true };
  drawGunModel(wid, gx, gy, gz, R, sc, vm, gunColsFor(wid, p, t));
  const cs = charSkin(p, t), slc = cs ? cs.suit : ag, pistol = wid === 'classic' || wid === 'sheriff';
  const P = (x, y, z) => { const o = xf(R, x * sc, y * sc, z * sc); return [gx + o[0], gy + o[1], gz + o[2]]; };
  // sağ el kabzada, sol el ön kabzada (tabancada sağ elin altında)
  const hr = P(-1.5, -4.5, 0.6), hl = pistol ? P(0.5, -6.5, -2.2) : P(G.box[1] * 0.42, -3.6, -0.6);
  vmArm(hr, [hr[0] + 3.2, hr[1] - 6.5, hr[2] + 6], slc, 2.1);
  vmArm(hl, [hl[0] - 2.5, hl[1] - 7, hl[2] + 6], slc, 2.0);
  if (VM.flash > 0) { const m = P(G.box[1] * 1.04, 0.6, 0); Q('sphere', m[0], m[1], m[2], 0, 0, 5, 5, 5, [1, 0.85, 0.45, 0.95], { vm: true, add: true, lit: 0 }); }
}
/* Birinci şahıs kılıç: sağ elde, kabzadan tutulur. Hafif vuruş: sağ üstten sol alta çapraz kesik.
   Ağır vuruş: başın üstünden aşağı inen güçlü darbe. Anahtar karelerle (el konumu + kılıç yönü) çizilir. */
const SWK = {
  light: [ // [ilerleme, el konumu, kılıç yönü, keskin kenar ipucu]
    [0.00, [7.2, -7.6, -16], [-0.42, 1, -0.5], [-1, 0, 0]],
    [0.18, [9.4, -2.6, -15], [0.6, 0.85, -0.15], [-0.6, 0.4, -0.7]],
    [0.36, [2.5, -3.4, -18], [-0.78, 0.55, -0.3], [-0.6, -0.8, 0]],
    [0.56, [-5.5, -8.6, -17], [-0.88, -0.42, -0.22], [-0.4, 0.9, 0]],
    [1.00, [7.2, -7.6, -16], [-0.42, 1, -0.5], [-1, 0, 0]]
  ],
  heavy: [
    [0.00, [7.2, -7.6, -16], [-0.42, 1, -0.5], [-1, 0, 0]],
    [0.25, [5.0, 0.5, -13], [0.1, 1, 0.35], [0, 0.2, -1]],
    [0.45, [2.0, -3.0, -19], [-0.32, 0.72, -0.6], [0, -1, 0]],
    [0.62, [0.5, -10.5, -19], [-0.2, -0.75, -0.6], [0, -0.6, 0.8]],
    [1.00, [7.2, -7.6, -16], [-0.42, 1, -0.5], [-1, 0, 0]]
  ]
};
function v3n(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function v3c(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
/* x ekseni = kılıç boyu, z = kenar yönü, y = yassı yüz (sağ el kuralı) */
function basisR(dir, edgeHint) {
  const x = v3n(dir); let e = edgeHint, k = e[0] * x[0] + e[1] * x[1] + e[2] * x[2];
  let z = v3n([e[0] - k * x[0], e[1] - k * x[1], e[2] - k * x[2]]);
  if (!isFinite(z[0])) z = [0, 0, 1];
  const y = v3c(z, x);
  return [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]];
}
function swordPose(ph, heavy) {
  const K = heavy ? SWK.heavy : SWK.light;
  let i = 0; while (i < K.length - 2 && ph > K[i + 1][0]) i++;
  const a = K[i], b = K[i + 1], f0 = clamp((ph - a[0]) / Math.max(1e-4, b[0] - a[0]), 0, 1), f = f0 * f0 * (3 - 2 * f0);
  const L = (u, v) => [u[0] + (v[0] - u[0]) * f, u[1] + (v[1] - u[1]) * f, u[2] + (v[2] - u[2]) * f];
  return { h: L(a[1], b[1]), d: v3n(L(v3n(a[2]), v3n(b[2]))), e: L(a[3], b[3]) };
}
function drawSwordVM(p, dt, t, gx, gy, gz, ag, vm) {
  const dur = VM.swingHeavy ? 0.42 : 0.3;
  VM.swing = Math.max(0, (VM.swing || 0) - dt / dur);
  const sw = VM.swing, ph = sw > 0 ? 1 - sw : 0;
  const P = swordPose(ph, VM.swingHeavy);
  // boşta: yürürken hafif sallanma (gx/gy yürüme salınımını taşır)
  const bob = sw > 0 ? 0 : 1, H = [P.h[0] + (gx - 6.6) * 0.6 * bob, P.h[1] + (gy + 6.4) * 0.6 * bob, P.h[2]];
  const R = basisR(P.d, P.e), sc = 0.42, grip = -1.5, useM = MDL.ready || mdlInit();
  const at = lx => { const o = xf(R, (lx - grip) * sc, 0, 0); return [H[0] + o[0], H[1] + o[1], H[2] + o[2]]; };
  if (useM) drawGunModel('sword', H[0], H[1], H[2], R, 0.4, vm, gunColsFor('sword', p, t));
  else for (const [s, o, c, gl] of gunPartsFor('sword', p)) {
    const off = xf(R, (o[0] - grip) * sc, o[1] * sc, o[2] * sc);
    QR('box', H[0] + off[0], H[1] + off[1], H[2] + off[2], R, s[0] * sc, s[1] * sc, s[2] * sc, c, o[0] > 10 ? { vm: true, em: gl ? [c[0] * gl, c[1] * gl, c[2] * gl] : [0.08, 0.1, 0.12] } : vm);
  }
  // savurma izi: ucun son konumları boyunca sönen parlak çizgi
  if (sw > 0 && ph > 0.12 && ph < 0.75) {
    for (let k = 1; k <= 12; k++) {
      const q = swordPose(Math.max(0, ph - k * 0.016), VM.swingHeavy), Rq = basisR(q.d, q.e), tp = xf(Rq, (36 - grip) * sc, 0, 0);
      const a = 0.38 * (1 - k / 13);
      Q('sphere', q.h[0] + tp[0], q.h[1] + tp[1], q.h[2] + tp[2], 0, 0, 1.1, 1.1, 1.1, [0.85, 0.93, 1, a], { vm: true, add: true, lit: 0 });
    }
  }
  // el (kabzayı saran yumruk) ve önkol: elden sağ alta, ekran dışına doğru
  const hb = at(-1.5);
  const cs = charSkin(p, t), slc = cs ? cs.suit : ag;
  if (useM) { vmArm(hb, [H[0] + 3.2, H[1] - 6.5, H[2] + 6], slc, 2.1); return; }
  QR('box', hb[0], hb[1], hb[2], R, 4.2, 4.4, 4.6, COL.skin, vm);
  const E = [H[0] + 4.2, H[1] - 6.5, H[2] + 7.5], fd = [E[0] - H[0], E[1] - H[1], E[2] - H[2]], fl = Math.hypot(fd[0], fd[1], fd[2]);
  const RF = basisR(fd, [0, 0, 1]), mid = [(H[0] + E[0]) / 2, (H[1] + E[1]) / 2, (H[2] + E[2]) / 2];
  QR('box', mid[0], mid[1], mid[2], RF, fl, 4.2, 4.2, [slc[0] * 0.7, slc[1] * 0.7, slc[2] * 0.7, 1], vm);
}
/* ---------- dinamik dünya nesneleri ---------- */
function projHeight(pr) {
  if (pr.type === 'blade') return 46;
  if (pr.type === 'wolf') return 12;
  if (pr.type === 'wave') return 6;
  if (pr.type === 'chain') return 50;
  const f = clamp((pr.trav || 0) / Math.max(1, pr.maxD || 1), 0, 1);
  if (pr.type === 'smokeorb') return 52 + Math.sin(f * Math.PI) * 160 - f * 40;
  return 52 - f * 42 + Math.sin(f * Math.PI) * 45;
}
function drawWorldDynamic(v, me, t) {
  const mt = me ? me.team : 0;
  if (PKMAP) drawPkDynamic(t, me);
  if (arOn()) arDrawWorld(me, t);
  // geçici duvarlar
  for (const w of S.twalls) for (const i of w.tiles) {
    const x = (i % MW + 0.5) * TILE, z = (((i / MW) | 0) + 0.5) * TILE;
    Q('box', x, WALL_H * 0.45, z, 0, 0, TILE, WALL_H * 0.9, TILE, [1, 1, 1, 1], { tex: GLX.tex.stone });
  }
  // bariyerler
  if (S.phase === 'buy') for (const b of BARRIERS) {
    const c = b[4] === T_ATK ? [1, 0.27, 0.33, 0.22] : [0.12, 0.89, 0.81, 0.22];
    QR('box', (b[0] + b[2]) / 2, WALL_H / 2, (b[1] + b[3]) / 2, rotMat(Math.atan2(b[3] - b[1], b[2] - b[0]), 0, 0, _R), TILE, WALL_H, 1, c, { lit: 0, add: true });
  }
  // ulti küreleri
  for (const o of S.orbs) {
    Q('octa', o.x, 30 + Math.sin(t * 3) * 4, o.y, t * 1.5, 0, 16, 22, 16, [0.12, 0.89, 0.81, 1], { em: [0.05, 0.5, 0.45] });
    Q('sphere', o.x, 30, o.y, 0, 0, 34, 34, 34, [0.12, 0.89, 0.81, 0.18], { add: true, lit: 0 });
  }
  // mağaza hoparlörleri: duvara asılı kabin; müzik çalarken woofer vuruşla pompalar
  if (MAPDATA.speakers) {
    const pump = typeof MUS !== 'undefined' ? MUS.pump() : 0;
    for (const s of MAPDATA.speakers) {
      const h = Math.min(WALL_H - 40, 100), fx = Math.cos(s.ang), fy = Math.sin(s.ang);
      Q('box', s.x - fx * 9, h + 30, s.y - fy * 9, s.ang, 0, 4, 14, 8, [0.25, 0.26, 0.28, 1]);
      Q('box', s.x, h, s.y, s.ang, 0, 22, 52, 34, [0.08, 0.085, 0.1, 1]);
      Q('box', s.x + fx * 10.6, h, s.y + fy * 10.6, s.ang, 0, 1, 48, 30, [0.14, 0.145, 0.16, 1]);
      const wf = 11.4 + pump * 2.2;
      Q('disc', s.x + fx * wf, h - 8, s.y + fy * wf, s.ang, -Math.PI / 2, 25, 1, 25, [0.2, 0.2, 0.22, 1]);
      Q('disc', s.x + fx * (wf + 0.6), h - 8, s.y + fy * (wf + 0.6), s.ang, -Math.PI / 2, 9, 1, 9, [0.42, 0.43, 0.46, 1]);
      Q('disc', s.x + fx * 11.6, h + 15, s.y + fy * 11.6, s.ang, -Math.PI / 2, 9, 1, 9, [0.3, 0.3, 0.32, 1]);
      const live = typeof MUS !== 'undefined' && MUS.on;
      Q('sphere', s.x + fx * 11.8, h + 22, s.y + fy * 11.8, 0, 0, 2.6, 2.6, 2.6, live ? [0.3, 1, 0.5, 1] : [0.5, 0.15, 0.15, 1], { em: live ? [0.3, 1, 0.5] : [0.3, 0.05, 0.05], lit: 0 });
    }
  }
  // can küreleri: zeminde yeşil halka, üstünde dönen yeşil artı + parıltı
  for (const h of S.heal || []) {
    const on = !(h.cd > 0);
    Q('disc', h.x, 0.8, h.y, 0, 0, 30, 1, 30, [0.1, 0.35, 0.18, on ? 0.9 : 0.5], { lit: 0 });
    Q('ring', h.x, 1.6, h.y, 0, 0, 32, 1, 32, [0.24, 0.94, 0.48, on ? 0.85 : 0.22], { add: true, lit: 0 });
    if (!on) continue;
    const by = 36 + Math.sin(t * 2.4 + h.id) * 5, ya = t * 1.4 + h.id;
    Q('box', h.x, by, h.y, ya, 0, 30, 10, 9, [0.24, 0.94, 0.48, 1], { em: [0.08, 0.55, 0.22] });
    Q('box', h.x, by, h.y, ya, 0, 10, 30, 9, [0.24, 0.94, 0.48, 1], { em: [0.08, 0.55, 0.22] });
    Q('box', h.x, by, h.y, ya, 0, 18, 4, 9.6, [1, 1, 1, 1], { em: [0.7, 0.7, 0.7] });
    Q('box', h.x, by, h.y, ya, 0, 4, 18, 9.6, [1, 1, 1, 1], { em: [0.7, 0.7, 0.7] });
    Q('sphere', h.x, by, h.y, 0, 0, 46, 46, 46, [0.24, 0.94, 0.48, 0.16 + 0.05 * Math.sin(t * 4)], { add: true, lit: 0 });
    Q('cyl', h.x, 20, h.y, 0, 0, 2.5, 40, 2.5, [0.24, 0.94, 0.48, 0.22], { add: true, lit: 0 });
  }
  // cesetler
  for (const c of S.corpses) {
    const ally = c.team === mt;
    if (!ally && !(v.alive && losClear(v.x, v.y, c.x, c.y, true))) continue;
    drawCorpse(c, ally);
  }
  // bomba
  const sp = S.bomb;
  if (sp.state === 'planted' || sp.state === 'dropped') {
    const show = sp.state === 'planted' || (me && sideOf(me.team) === 'atk') || (v.alive && losClear(v.x, v.y, sp.x, sp.y, true));
    if (show) {
      const ang = ((sp.x * 0.0137 + sp.y * 0.0071) % 1) * TAU;
      drawC4(sp.x, 0.5, sp.y, ang, 0, 1.25, sp.state, t, 1);
      if (sp.state === 'planted') {
        const pulse = (t * (sp.t < 10 ? 2 : 0.8)) % 1;
        Q('ring', sp.x, 1.5, sp.y, 0, 0, 30 + pulse * 120, 1, 30 + pulse * 120, [1, 0.27, 0.33, (1 - pulse) * 0.8], { add: true, lit: 0 });
      }
    }
  }
  // reboot kartları (yerde dönen kart) ve istasyon ışıkları
  for (const c of S.cards || []) {
    if (c.carrier) continue;
    const o = S.pmap[c.owner], ac = o ? (AGCOL[o.agent] || COL.white) : COL.white, tc2 = me && c.team === mt ? COL.teal : COL.red;
    const bob = Math.sin(t * 3 + c.id) * 4;
    Q('box', c.x, 26 + bob, c.y, t * 2 + c.id, 0, 2, 26, 18, [0.95, 0.97, 1, 1], { em: [tc2[0] * 0.35, tc2[1] * 0.35, tc2[2] * 0.35] });
    Q('box', c.x, 29 + bob, c.y, t * 2 + c.id, 0, 2.4, 10, 10, [ac[0], ac[1], ac[2], 1], { em: [ac[0] * 0.5, ac[1] * 0.5, ac[2] * 0.5] });
    Q('ring', c.x, 1.5, c.y, 0, 0, 34 + Math.sin(t * 4) * 4, 1, 34 + Math.sin(t * 4) * 4, [tc2[0], tc2[1], tc2[2], 0.7], { add: true, lit: 0 });
    Q('cyl', c.x, 70, c.y, 0, 0, 3, 140, 3, [tc2[0], tc2[1], tc2[2], 0.25], { add: true, lit: 0 });
  }
  (MAPDATA.reboot || []).forEach((r, i) => {
    const cd = S.rb && S.rb[i] && S.rb[i].cd > 0, col = cd ? [1, 0.25, 0.3] : [0.35, 0.8, 1];
    const using = S.players.some(p => p.alive && p.rbT > 0 && dist(p.x, p.y, r.x, r.y) < REBOOT_R + 10);
    Q('sphere', r.x, 112, r.y, 0, 0, 9, 9, 9, [col[0], col[1], col[2], 1], { lit: 0, em: col });
    Q('ring', r.x + r.dx * 40, 1.5, r.y + r.dy * 40, t * (using ? 4 : 1), 0, 70, 1, 70, [col[0], col[1], col[2], using ? 0.85 : 0.35], { add: true, lit: 0 });
    if (using) Q('cyl', r.x, 260, r.y, 0, 0, 22 + Math.sin(t * 20) * 4, 500, 22 + Math.sin(t * 20) * 4, [0.4, 0.85, 1, 0.35], { add: true, lit: 0 });
  });
  // cihazlar
  for (const d of S.deps) {
    const ally = me && d.team === mt;
    if (d.type === 'mine') {
      if (!ally && !(v.alive && dist(v.x, v.y, d.x, d.y) < 110 && losClear(v.x, v.y, d.x, d.y, true))) continue;
      Q('cyl', d.x, 2, d.y, 0, 0, 18, 4, 18, hexRGB('#3a3220'));
      const blink = d.trig > 0 ? (t * 20 % 1 < 0.5) : (t * 2 % 1 < 0.2);
      Q('sphere', d.x, 5, d.y, 0, 0, 5, 5, 5, blink ? [1, 0.25, 0.3, 1] : [0.35, 0.28, 0.15, 1], { em: blink ? [1, 0.2, 0.2] : ZERO3 });
      if (ally && d.arm <= 0) Q('ring', d.x, 1, d.y, 0, 0, 116, 1, 116, [1, 0.82, 0.4, 0.25], { add: true, lit: 0 });
    } else if (d.type === 'turret') {
      if (!ally && !(v.alive && losClear(v.x, v.y, d.x, d.y, true))) continue;
      Q('cyl', d.x, 9, d.y, 0, 0, 20, 18, 20, hexRGB('#3b3420'));
      Q('box', d.x, 24, d.y, d.aim, 0, 16, 12, 14, hexRGB('#d9b75c'), { em: [0.15, 0.1, 0] });
      Q('box', d.x + Math.cos(d.aim) * 12, 25, d.y + Math.sin(d.aim) * 12, d.aim, 0, 14, 3.5, 3.5, hexRGB('#222'));
      Q('sphere', d.x + Math.cos(d.aim) * 6, 28, d.y + Math.sin(d.aim) * 6, 0, 0, 4, 4, 4, ally ? COL.teal : COL.red, { em: ally ? [0, 0.6, 0.5] : [0.8, 0.1, 0.1] });
    } else if (d.type === 'lockdev') {
      const pr = 1 - clamp(d.wind / 4, 0, 1);
      Q('cyl', d.x, 13, d.y, t, 0, 22, 26, 22, hexRGB('#3b3420'));
      Q('sphere', d.x, 30, d.y, 0, 0, 12, 12, 12, [1, 0.82, 0.4, 1], { em: (t * 4 % 1 < 0.5) ? [1, 0.75, 0.2] : [0.3, 0.2, 0] });
      Q('ring', d.x, 2, d.y, 0, 0, d.r * 2, 1, d.r * 2, [1, 0.82, 0.4, 0.25 + pr * 0.45], { add: true, lit: 0 });
      Q('cyl', d.x, 40, d.y, 0, 0, d.r * 2 * pr, 80, d.r * 2 * pr, [1, 0.82, 0.4, 0.06], { add: true, lit: 0 });
    } else if (d.type === 'rebirth' && ally) {
      Q('ring', d.x, 2, d.y, 0, 0, 40 + Math.sin(t * 5) * 6, 1, 40, [1, 0.55, 0.24, 0.9], { add: true, lit: 0 });
      Q('cone', d.x, 30, d.y, 0, 0, 20, 50, 20, [1, 0.55, 0.24, 0.3], { add: true, lit: 0 });
    }
  }
  // mermiler / atılan yetenekler
  for (const pr of S.proj) {
    const a = Math.atan2(pr.vy, pr.vx), h = projHeight(pr);
    const glow = (c, r) => { Q('sphere', pr.x, h, pr.y, 0, 0, r, r, r, c, { lit: 0, em: [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8] }); Q('sphere', pr.x, h, pr.y, 0, 0, r * 2.4, r * 2.4, r * 2.4, [c[0], c[1], c[2], 0.25], { add: true, lit: 0 }); };
    switch (pr.type) {
      case 'flashball': glow([1, 0.75, 0.4, 1], 10); break;
      case 'smokeorb': glow([0.55, 0.55, 1, 1], 11); break;
      case 'poisonorb': glow([0.45, 0.85, 0.35, 1], 9); break;
      case 'tsorb': glow([0.3, 0.9, 0.66, 1], 9); break;
      case 'healorb': glow([0.5, 0.95, 0.6, 1], 9); break;
      case 'iceorb': glow([0.75, 0.92, 1, 1], 9); break;
      case 'deaforb': glow([0.6, 0.65, 0.8, 1], 10); break;
      case 'chain': glow([1, 0.97, 0.45, 1], 8); break;
      case 'sonar': case 'shock': {
        const c = pr.type === 'sonar' ? [0.25, 0.75, 1, 1] : [0.6, 0.95, 1, 1];
        Qline(pr.x - Math.cos(a) * 22, h, pr.y - Math.sin(a) * 22, pr.x, h, pr.y, 2.4, [0.8, 0.8, 0.85, 1]);
        glow(c, 5); break;
      }
      case 'blade':
        Q('crescent', pr.x, h, pr.y, a, 0, 110, 1, 110, [0.85, 0.7, 1, 0.95], { add: true, lit: 0 });
        Q('crescent', pr.x - Math.cos(a) * 8, h, pr.y - Math.sin(a) * 8, a, 0, 100, 1, 100, [0.66, 0.42, 1, 0.8], { add: true, lit: 0, roll: 0.25 });
        Q('sphere', pr.x, h, pr.y, 0, 0, 90, 50, 90, [0.66, 0.42, 1, 0.12], { add: true, lit: 0 });
        break;
      case 'wolf':
        Q('box', pr.x, 12, pr.y, a, 0, 26, 12, 11, hexRGB('#2b3042'));
        Q('cone', pr.x + Math.cos(a) * 16, 15, pr.y + Math.sin(a) * 16, a, -Math.PI / 2, 10, 14, 10, hexRGB('#2b3042'));
        for (const s of [-1, 1]) Q('sphere', pr.x + Math.cos(a) * 17 - Math.sin(a) * 3 * s, 18, pr.y + Math.sin(a) * 17 + Math.cos(a) * 3 * s, 0, 0, 3, 3, 3, COL.red, { lit: 0, em: [1, 0.2, 0.2] });
        Q('sphere', pr.x - Math.cos(a) * 20, 14, pr.y - Math.sin(a) * 20, 0, 0, 30, 14, 30, [0.3, 0.33, 0.45, 0.25], { add: true, lit: 0 });
        break;
      case 'wave':
        for (let i = -3; i <= 3; i++) { const aa = a + i * 0.25; Q('sphere', pr.x + Math.cos(aa) * 50 - Math.cos(a) * 40, 8, pr.y + Math.sin(aa) * 50 - Math.sin(a) * 40, 0, 0, 18, 12, 18, [0.75, 0.6, 0.4, 0.5], { lit: 0 }); }
        break;
    }
  }
  // huzmeler
  for (const b of S.beams) {
    if (b.type === 'orbital') {
      const pulse = 0.25 + 0.2 * Math.sin(t * 18);
      const L = Math.hypot(b.x2 - b.x1, b.y2 - b.y1), a = Math.atan2(b.y2 - b.y1, b.x2 - b.x1);
      Q('box', (b.x1 + b.x2) / 2, 1.5, (b.y1 + b.y2) / 2, a, 0, L, 1, b.w, [0.25, 0.75, 1, b.wind > 0 ? pulse : 0.12], { add: true, lit: 0 });
      Q('box', (b.x1 + b.x2) / 2, 140, (b.y1 + b.y2) / 2, a, 0, L, 280, 2, [0.25, 0.75, 1, 0.08], { add: true, lit: 0 });
    } else if (b.type === 'rift') {
      const f = 1 - clamp(b.wind / 0.75, 0, 1), L = Math.hypot(b.x2 - b.x1, b.y2 - b.y1), a = Math.atan2(b.y2 - b.y1, b.x2 - b.x1);
      Q('box', b.x1 + Math.cos(a) * L * f / 2, 1.5, b.y1 + Math.sin(a) * L * f / 2, a, 0, L * f, 1, 10, [1, 0.6, 0.25, 0.9], { add: true, lit: 0 });
      Q('box', (b.x1 + b.x2) / 2, 1.2, (b.y1 + b.y2) / 2, a, 0, L, 1, b.w, [0.8, 0.55, 0.3, 0.2], { add: true, lit: 0 });
    }
  }
  // alanlar
  for (const a of S.areas) {
    const f = clamp(Math.min(a.t / 0.6, (a.dur - a.t) / 0.25), 0, 1);
    const enemy = me && a.team !== mt;
    switch (a.type) {
      case 'smoke': {
        const r = a.r * smokeScale(a) * 2;
        Q('sphere', a.x, 40, a.y, t * 0.1, 0, r, r * 1.05, r, [0.27, 0.29, 0.42, 0.975 * f], { lit: 0, em: [0.03, 0.03, 0.05] });
        Q('sphere', a.x, 40, a.y, -t * 0.15, 0, r * 1.07, r * 1.1, r * 1.07, [0.36, 0.38, 0.56, 0.3 * f], { lit: 0 });
        break;
      }
      case 'firewall':
        for (const p of a.pts) {
          const fl = 0.85 + 0.2 * Math.sin(t * 22 + p[0] * 0.1);
          Q('cone', p[0], 42 * fl, p[1], t * 3 + p[0], 0, a.pr * 1.6, 84 * fl, a.pr * 1.6, [0.85, 0.28, 0.05, 0.55 * f], { add: true, lit: 0 });
          Q('cone', p[0], 26 * fl, p[1], -t * 4, 0, a.pr * 0.95, 52 * fl, a.pr * 0.95, [0.95, 0.6, 0.12, 0.45 * f], { add: true, lit: 0 });
        }
        break;
      case 'tsphere':
        Q('sphere', a.x, 0, a.y, t * 0.4, 0, a.r * 2, a.r * 2, a.r * 2, [0.2, 0.9, 0.7, 0.16 * f], { add: true, lit: 0 });
        Q('ring', a.x, 2, a.y, t * 0.6, 0, a.r * 2, 1, a.r * 2, [0.3, 0.9, 0.66, 0.8 * f], { add: true, lit: 0 });
        Q('ring', a.x, 60 + Math.sin(t * 2) * 40, a.y, 0, 0, a.r * 1.7, 1, a.r * 1.7, [0.3, 0.9, 0.66, 0.4 * f], { add: true, lit: 0 });
        break;
      case 'nightmare':
        Q('cyl', a.x, 70, a.y, t * 0.2, 0, a.r * 2, 140, a.r * 2, [0.45, 0.12, 0.7, 0.18 * f], { add: true, lit: 0 });
        Q('disc', a.x, 1, a.y, 0, 0, a.r * 2, 1, a.r * 2, [0.35, 0.1, 0.55, 0.45 * f], { lit: 0 });
        Q('ring', a.x, 3, a.y, t * 0.5, 0, a.r * 2, 1, a.r * 2, [0.7, 0.42, 1, 0.9 * f], { add: true, lit: 0 });
        break;
      case 'tcollapse':
        Q('cyl', a.x, 60, a.y, 0, 0, a.r * 2, 120, a.r * 2, [0.2, 0.55, 0.9, 0.12 * f], { add: true, lit: 0 });
        for (let i = 0; i < 3; i++) Q('ring', a.x, 3 + i * 40, a.y, t * (0.5 + i * 0.3), 0, a.r * (2 - i * 0.4), 1, a.r * (2 - i * 0.4), [0.25, 0.75, 1, 0.6 * f], { add: true, lit: 0 });
        break;
      case 'poison':
        Q('disc', a.x, 1.2, a.y, 0, 0, a.r * 2, 1, a.r * 2, [0.35, 0.78, 0.3, 0.45 * f], { lit: 0 });
        Q('cyl', a.x, 30, a.y, 0, 0, a.r * 2, 60, a.r * 2, [0.45, 0.85, 0.35, 0.15 * f], { add: true, lit: 0 });
        if (enemy) Q('ring', a.x, 2, a.y, 0, 0, a.r * 2, 1, a.r * 2, [1, 0.3, 0.35, 0.7 * f], { add: true, lit: 0 });
        break;
      case 'ice':
        Q('disc', a.x, 1.2, a.y, 0, 0, a.r * 2, 1, a.r * 2, [0.75, 0.9, 1, 0.55 * f], { lit: 0, em: [0.2, 0.25, 0.3] });
        for (let i = 0; i < 6; i++) { const aa = i * 1.05; Q('cone', a.x + Math.cos(aa) * a.r * 0.55, 8, a.y + Math.sin(aa) * a.r * 0.55, 0, 0, 8, 16, 8, [0.85, 0.95, 1, 0.8 * f], { lit: 0 }); }
        break;
      case 'heal':
        Q('disc', a.x, 1.2, a.y, 0, 0, a.r * 2, 1, a.r * 2, [0.45, 0.95, 0.6, 0.35 * f], { lit: 0 });
        for (let i = 0; i < 4; i++) { const hh = (t * 30 + i * 22) % 80; Q('box', a.x - 30 + i * 20, hh, a.y, 0, 0, 3, 12, 3, [0.5, 1, 0.6, 0.7 * f], { add: true, lit: 0 }); Q('box', a.x - 30 + i * 20, hh, a.y, 0, 0, 12, 3, 3, [0.5, 1, 0.6, 0.7 * f], { add: true, lit: 0 }); }
        break;
      case 'deaf':
        for (let i = 0; i < 3; i++) { const r = (t * 60 + i * a.r / 3) % a.r; Q('ring', a.x, 4 + i * 18, a.y, 0, 0, r * 2, 1, r * 2, [0.6, 0.65, 0.8, 0.6 * (1 - r / a.r) * f], { add: true, lit: 0 }); }
        Q('disc', a.x, 1, a.y, 0, 0, a.r * 2, 1, a.r * 2, [0.25, 0.27, 0.35, 0.3 * f], { lit: 0 });
        break;
      case 'sonar':
        Q('box', a.x, 6, a.y, 0, 0.4, 4, 18, 4, [0.25, 0.75, 1, 1], { em: [0.1, 0.5, 0.8] });
        Q('ring', a.x, 1.5, a.y, 0, 0, a.r * 2, 1, a.r * 2, [0.25, 0.75, 1, 0.25 * f], { add: true, lit: 0 });
        break;
    }
  }
}

/* ---------- 3D efektler ---------- */
function fxFromEvent(ev, me) {
  switch (ev.t) {
    case 'dash': for (let i = 0; i < 8; i++) addFx({ type: 'part', x: ev.x, y: ev.y, h: rand(20, 60), vx: -Math.cos(ev.a) * rand(100, 260), vy: -Math.sin(ev.a) * rand(100, 260), vh: rand(-20, 20), c: hexRGB(ev.c), s: 5, t: 0.35, dur: 0.35, add: true }); break;
    case 'ring': addFx({ type: 'ring', x: ev.x, y: ev.y, r0: 10, r1: ev.r, c: hexRGB(ev.c), t: 0.5, dur: 0.5 }); break;
    case 'flash': addFx({ type: 'glow', x: ev.x, y: 40, z: ev.y, r: 260, c: [1, 1, 0.9], t: 0.45, dur: 0.45 }); break;
    case 'boom':
      addFx({ type: 'glow', x: ev.x, y: 20, z: ev.y, r: ev.r * 1.6, c: [1, 0.65, 0.3], t: 0.35, dur: 0.35 });
      addFx({ type: 'ring', x: ev.x, y: ev.y, r0: 10, r1: ev.r, c: [1, 0.7, 0.3, 1], t: 0.4, dur: 0.4 });
      for (let i = 0; i < 16; i++) addFx({ type: 'part', x: ev.x, y: ev.y, h: 10, vx: rand(-260, 260), vy: rand(-260, 260), vh: rand(80, 300), g: 600, c: [1, 0.7, 0.3, 1], s: 4, t: 0.6, dur: 0.6, add: true });
      if (me && dist(me.x, me.y, ev.x, ev.y) < 500) UIS.shake = Math.max(UIS.shake, 6);
      break;
    case 'nuke':
      addFx({ type: 'glow', x: ev.x, y: 60, z: ev.y, r: 1100, c: [1, 0.4, 0.35], t: 1.4, dur: 1.4 });
      addFx({ type: 'ring', x: ev.x, y: ev.y, r0: 20, r1: 520, c: [1, 0.3, 0.35, 1], t: 1.2, dur: 1.2 });
      UIS.nukeFlash = 1; UIS.shake = 16; break;
    case 'tp':
      addFx({ type: 'glow', x: ev.x, y: 40, z: ev.y, r: 60, c: [0.3, 0.9, 0.66], t: 0.35, dur: 0.35 });
      addFx({ type: 'glow', x: ev.x2, y: 40, z: ev.y2, r: 70, c: [0.3, 0.9, 0.66], t: 0.45, dur: 0.45 });
      addFx({ type: 'line', x: ev.x, y: ev.y, h: 40, x2: ev.x2, y2: ev.y2, h2: 40, c: [0.3, 0.9, 0.66, 0.6], w: 3, t: 0.25, dur: 0.25 });
      break;
    case 'rebirth':
      addFx({ type: 'glow', x: ev.x2, y: 40, z: ev.y2, r: 160, c: [1, 0.55, 0.24], t: 0.9, dur: 0.9 });
      addFx({ type: 'ring', x: ev.x2, y: ev.y2, r0: 10, r1: 120, c: [1, 0.55, 0.24, 1], t: 0.7, dur: 0.7 });
      break;
    case 'revive':
      addFx({ type: 'glow', x: ev.x, y: 40, z: ev.y, r: 140, c: [0.5, 0.95, 0.6], t: 1.2, dur: 1.2 });
      addFx({ type: 'pillar', x: ev.x, y: ev.y, c: [0.5, 0.95, 0.6, 0.5], t: 1.2, dur: 1.2 });
      break;
    case 'sonar': addFx({ type: 'ring', x: ev.x, y: ev.y, r0: 10, r1: ev.r, c: [0.25, 0.75, 1, 1], t: 0.9, dur: 0.9, wall: true }); break;
    case 'chain': addFx({ type: 'bolt', pts: ev.pts, h: 45, c: [1, 0.97, 0.45, 1], t: 0.35, dur: 0.35 }); break;
    case 'laser':
      addFx({ type: 'laser', x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, w: ev.w, t: 0.5, dur: 0.5 });
      UIS.shake = Math.max(UIS.shake, 6); break;
    case 'rift':
      addFx({ type: 'rift', x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, w: ev.w, t: 1.2, dur: 1.2 });
      for (let i = 0; i < 20; i++) { const f = Math.random(); addFx({ type: 'part', x: lerp(ev.x1, ev.x2, f), y: lerp(ev.y1, ev.y2, f), h: 5, vx: rand(-60, 60), vy: rand(-60, 60), vh: rand(150, 350), g: 700, c: [0.6, 0.45, 0.3, 1], s: 6, t: 0.9, dur: 0.9 }); }
      UIS.shake = Math.max(UIS.shake, 10); break;
    case 'lock':
      addFx({ type: 'ring', x: ev.x, y: ev.y, r0: 20, r1: ev.r, c: [1, 0.82, 0.4, 1], t: 0.8, dur: 0.8, wall: true });
      addFx({ type: 'glow', x: ev.x, y: 30, z: ev.y, r: ev.r * 1.2, c: [1, 0.82, 0.4], t: 0.6, dur: 0.6 });
      break;
    case 'shroud': if (me && me.team !== ev.team) UIS.shroudFlash = 1.4; break;
    case 'ovb': addFx({ type: 'bolt', pts: [[ev.x, ev.y], [ev.x2, ev.y2]], h: 50, c: [1, 0.97, 0.45, 1], t: 0.1, dur: 0.1 }); break;
    case 'stop': addFx({ type: 'glow', x: ev.x, y: 50, z: ev.y, r: 26, c: [0.12, 0.89, 0.81], t: 0.3, dur: 0.3 }); break;
    case 'debris': for (let i = 0; i < 12; i++) addFx({ type: 'part', x: ev.x, y: ev.y, h: 30, vx: rand(-160, 160), vy: rand(-160, 160), vh: rand(50, 250), g: 700, c: [0.55, 0.48, 0.38, 1], s: 6, t: 0.7, dur: 0.7 }); break;
    case 'slash': addFx({ type: 'glow', x: ev.x, y: 45, z: ev.y, r: 70, c: [0.8, 0.6, 1], t: 0.5, dur: 0.5 }); break;
    case 'spark': for (let i = 0; i < 8; i++) addFx({ type: 'part', x: ev.x, y: ev.y, h: 45, vx: rand(-200, 200), vy: rand(-200, 200), vh: rand(-100, 200), g: 400, c: hexRGB(ev.c || '#ffffff'), s: 3, t: 0.3, dur: 0.3, add: true }); break;
    case 'puff': addFx({ type: 'glow', x: ev.x, y: 20, z: ev.y, r: 50, c: hexRGB(ev.c || '#888888'), t: 0.6, dur: 0.6 }); break;
  }
}
function drawFX(dt) {
  for (let i = FX.length - 1; i >= 0; i--) {
    const f = FX[i]; f.t -= dt;
    if (f.t <= 0) { FX.splice(i, 1); continue; }
    const k = f.t / f.dur;
    switch (f.type) {
      case 'tracer': {
        const s = 1 - k, sx = lerp(f.x, f.x2, s * 0.85), sy = lerp(f.y, f.y2, s * 0.85), sh = lerp(f.h, f.h2, s * 0.85);
        Qline(sx, sh, sy, f.x2, f.h2, f.y2, f.w, [f.c[0], f.c[1], f.c[2], 0.9 * k], { add: true, lit: 0 });
        break;
      }
      case 'muzzle': Q('sphere', f.x, f.h, f.y, 0, 0, 8, 8, 8, [1, 0.85, 0.45, k], { add: true, lit: 0 }); break;
      case 'impact': { const c = f.c || [1, 0.9, 0.7]; Q('sphere', f.x, f.h, f.y, 0, 0, 3 + (1 - k) * 8, 3 + (1 - k) * 8, 3 + (1 - k) * 8, [c[0], c[1], c[2], k], { add: true, lit: 0 }); break; }
      case 'trail': { // skinli merminin arkasında kalan, yavaşça yükselip genişleyen renkli iz
        const up = (1 - k) * 8, ww = f.w + (1 - k) * 1.2, a = (f.glow ? 0.5 : 0.38) * k * k;
        Qline(f.x, f.h + up, f.y, f.x2, f.h2 + up, f.y2, ww, [f.c[0], f.c[1], f.c[2], a], { add: true, lit: 0 });
        if (f.glow) Qline(f.x, f.h + up, f.y, f.x2, f.h2 + up, f.y2, ww * 1.8, [f.c[0], f.c[1], f.c[2], a * 0.25], { add: true, lit: 0 });
        break;
      }
      case 'blood': Q('sphere', f.x, f.h, f.y, 0, 0, 8 + (1 - k) * 14, 8 + (1 - k) * 14, 8 + (1 - k) * 14, [1, 0.27, 0.33, 0.6 * k], { add: true, lit: 0 }); break;
      case 'ring': {
        const r = lerp(f.r1, f.r0, k);
        Q('ring', f.x, 2, f.y, 0, 0, r * 2, 1, r * 2, [f.c[0], f.c[1], f.c[2], k], { add: true, lit: 0 });
        if (f.wall) Q('cyl', f.x, 40, f.y, 0, 0, r * 2, 80, r * 2, [f.c[0], f.c[1], f.c[2], 0.12 * k], { add: true, lit: 0 });
        break;
      }
      case 'glow': Q('sphere', f.x, f.y, f.z, 0, 0, f.r * (1.3 - 0.3 * k), f.r * (1.3 - 0.3 * k), f.r * (1.3 - 0.3 * k), [f.c[0], f.c[1], f.c[2], 0.55 * k], { add: true, lit: 0 }); break;
      case 'part':
        f.x += f.vx * dt; f.y += f.vy * dt; f.h = Math.max(1, f.h + (f.vh || 0) * dt); f.vh = (f.vh || 0) - (f.g || 0) * dt; f.vx *= 0.96; f.vy *= 0.96;
        Q('box', f.x, f.h, f.y, f.t * 7, f.t * 5, f.s, f.s, f.s, [f.c[0], f.c[1], f.c[2], f.add ? k : 1], f.add ? { add: true, lit: 0 } : null); break;
      case 'line': Qline(f.x, f.h, f.y, f.x2, f.h2, f.y2, f.w, [f.c[0], f.c[1], f.c[2], f.c[3] * k], { add: true, lit: 0 }); break;
      case 'pillar': Q('cyl', f.x, 100, f.y, 0, 0, 50 * k + 10, 200, 50 * k + 10, [f.c[0], f.c[1], f.c[2], f.c[3] * k], { add: true, lit: 0 }); break;
      case 'bolt':
        for (let j = 0; j < f.pts.length - 1; j++) {
          const [x1, y1] = f.pts[j], [x2, y2] = f.pts[j + 1], n = Math.max(2, Math.ceil(dist(x1, y1, x2, y2) / 40));
          let px = x1, py = y1, ph = f.h;
          for (let s = 1; s <= n; s++) {
            const tt = s / n, nx = lerp(x1, x2, tt) + (s < n ? rand(-10, 10) : 0), ny = lerp(y1, y2, tt) + (s < n ? rand(-10, 10) : 0), nh = f.h + (s < n ? rand(-10, 10) : 0);
            Qline(px, ph, py, nx, nh, ny, 2.5, [f.c[0], f.c[1], f.c[2], k], { add: true, lit: 0 });
            px = nx; py = ny; ph = nh;
          }
        }
        break;
      case 'laser': {
        const L = Math.hypot(f.x2 - f.x1, f.y2 - f.y1), a = Math.atan2(f.y2 - f.y1, f.x2 - f.x1);
        Q('box', (f.x1 + f.x2) / 2, 150, (f.y1 + f.y2) / 2, a, 0, L, 300, f.w, [0.3, 0.8, 1, 0.5 * k], { add: true, lit: 0 });
        Q('box', (f.x1 + f.x2) / 2, 150, (f.y1 + f.y2) / 2, a, 0, L, 300, f.w * 0.35, [0.9, 0.98, 1, 0.8 * k], { add: true, lit: 0 });
        break;
      }
      case 'rift': {
        const L = Math.hypot(f.x2 - f.x1, f.y2 - f.y1), a = Math.atan2(f.y2 - f.y1, f.x2 - f.x1);
        Q('box', (f.x1 + f.x2) / 2, 1.6, (f.y1 + f.y2) / 2, a, 0, L, 1, 14, [1, 0.6, 0.25, k], { add: true, lit: 0 });
        Q('box', (f.x1 + f.x2) / 2, 25, (f.y1 + f.y2) / 2, a, 0, L, 50, f.w, [0.7, 0.5, 0.3, 0.25 * k], { add: true, lit: 0 });
        break;
      }
    }
  }
}

/* ---------- ana 3D çizim ---------- */
/* KAMERA (F3 · Mac: fn+F3): 0 = birinci şahıs · 1 = arkadan (3. şahıs) · 2 = önden (karakterin yüzünü çeker)
   Minecraft'ın F5 kamerası gibi. Düşman görünürlüğü yine karakterin kendi gözünden hesaplanır. */
const CAM = { mode: 0, k: 1 };
function camCycle() {
  CAM.mode = (CAM.mode + 1) % 3; CAM.k = 0.2;
  showMsg(null, 'KAMERA: ' + ['BİRİNCİ ŞAHIS', 'ARKADAN', 'ÖNDEN'][CAM.mode], PAL.teal);
}
function render3D(dt, me, v) {
  const t = S ? S.time : UIS.menuT, asp = W / H;
  let ex, ey, ez, yaw, pitch;
  const scoped = me && me.alive && v === me && me.scoped;
  const cc = S && CINE.on ? cineCam(dt) : null;
  if (cc) { ex = cc.x; ey = cc.y; ez = cc.z; yaw = cc.yaw; pitch = cc.pitch; CAM.on = true; } // sinematik giriş kamerası
  else if (S) {
    const lift = liftOf(v);
    VM.eye = VM.eye === undefined ? EYE : lerp(VM.eye, v.crouch ? EYE_C : EYE, Math.min(1, dt * 14));
    ex = v.x; ey = VM.eye + lift; ez = v.y;
    if (v === me && me.alive) { yaw = LOOK.yaw; pitch = LOOK.pitch; }
    else { yaw = v.ang; pitch = v.pitch || 0; }
    if (!v.alive) { ey = 160; pitch = -0.6; }
    yaw += (Math.random() - 0.5) * UIS.shake * 0.002; pitch += (Math.random() - 0.5) * UIS.shake * 0.002;
    // üçüncü şahıs kamera: arkadan ya da önden; duvara çarpmadan yaklaşır
    if (v === me && me.alive && !scoped && CAM.mode > 0) {
      const s = CAM.mode === 1 ? -1 : 1, D = 170, cp = Math.cos(pitch);
      const ux = Math.cos(yaw) * s, uz = Math.sin(yaw) * s, Lh = Math.max(1, D * cp);
      const rc = raycast(ex, ez, ux, uz, Lh + 16);
      const kMax = rc.hit ? clamp((rc.d - 16) / Lh, 0, 1) : 1;
      CAM.k = kMax < CAM.k ? kMax : lerp(CAM.k, kMax, Math.min(1, dt * 6));
      const d = D * CAM.k;
      ex += ux * cp * d; ez += uz * cp * d; ey = clamp(ey + Math.sin(pitch) * s * d + (s < 0 ? 22 : 6) * CAM.k, 12, WALL_H * 2.6);
      if (s > 0) { yaw += Math.PI; pitch = -pitch; }
      CAM.on = true;
    } else CAM.on = false;
  } else {
    const k = t * 0.06; ex = WW / 2 + Math.cos(k) * WW * 0.28; ez = WH / 2 + Math.sin(k * 1.3) * WH * 0.22; ey = WALL_H + 330; yaw = k * 1.6 + 2; pitch = -0.45;
  }
  const hfov = (scoped ? 32 : (IS_TOUCH ? 96 : 100)) * Math.PI / 180;
  const fovY = clamp(2 * Math.atan(Math.tan(hfov / 2) / asp), 0.35, 1.45);
  // sis: yakın görüş / karanlık örtü
  const fogK = 1 + 0.8 * (MS - 1);
  let fogFar = THEME.fog[1] * fogK * (cc ? 1.7 : 1), fogNear = THEME.fog[0] * fogK * (cc ? 1.7 : 1), fc = hexRGB(THEME.fogCol);
  if (S && v && v.alive && !cc) {
    if (v.st.near > 0) { fogNear = 30; fogFar = 210; fc = [0.02, 0.02, 0.04]; }
    else if (v.st.shroud > 0) { fogNear = 40; fogFar = 260; fc = [0.01, 0.01, 0.02]; }
  }
  GLX.fog[0] = fogNear; GLX.fog[1] = fogFar; GLX.fogCol[0] = fc[0]; GLX.fogCol[1] = fc[1]; GLX.fogCol[2] = fc[2];
  glBeginFrame(fc);
  glSetCamera(ex, ey, ez, yaw, pitch, fovY, asp);
  const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  if (!(S && v && v.alive && (v.st.near > 0 || v.st.shroud > 0))) { const sr = 7500 * MS * 0.9; QR('sky', ex, ey, ez, I3, sr, sr, sr, COL.white, { lit: 0, sky: true }); } // görüş uzaklığının hemen içinde: her şeyin arkasında kalır
  QR('floor', 0, 0, 0, I3, 1, 1, 1, COL.floor, { tex: GLX.tex.floor, det: SETTINGS.gfx === 'low' ? null : GLX.tex.det, detS: THEME.pack && THEME.pack.detS || 1 / 160 });
  QR('walls', 0, 0, 0, I3, 1, 1, 1, COL.wall, { tex: GLX.tex.wall });
  if (THEME.trim) { const tr = THEME.trim; QR('trim', 0, 0, 0, I3, 1, 1, 1, [tr[0], tr[1], tr[2], 1], { lit: 0, em: [tr[0] * 0.25, tr[1] * 0.25, tr[2] * 0.25] }); }
  QR('crates', 0, 0, 0, I3, 1, 1, 1, COL.wall, { tex: GLX.tex.crate });
  QR('lows', 0, 0, 0, I3, 1, 1, 1, COL.wall, { tex: GLX.tex.low });
  const lowQ = SETTINGS.gfx === 'low';
  if (!lowQ) QR('decor', 0, 0, 0, I3, 1, 1, 1, COL.wall);
  QR('props', 0, 0, 0, I3, 1, 1, 1, COL.white, { tex: GLX.tex.props });
  if (!lowQ) QR('decorEm', 0, 0, 0, I3, 1, 1, 1, COL.white, { lit: 0 });
  if (GLX.meshes.water) {
    const wv = 0.04 + Math.sin(t * 2) * 0.015, wc = hexRGB(THEME.floor.water), we = THEME.floor.waterEm;
    // dokulu, iki katmanı ters yönlere akan su (lav/zehirli atık: kendi ışığıyla parlar, yavaş akar)
    if (we) { const p = 0.75 + Math.sin(t * 1.3) * 0.25; QR('water', 0, 0, 0, I3, 1, 1, 1, [wc[0] * 1.5, wc[1] * 1.5, wc[2] * 1.5, 0.96], { lit: 0, em: [we[0] * p, we[1] * p, we[2] * p], tex: GLX.tex.water, det: GLX.tex.water, detS: 1 / 260, detO: [t * 0.006, -t * 0.004] }); }
    else QR('water', 0, 0, 0, I3, 1, 1, 1, [wc[0] * 2.3, wc[1] * 2.3, wc[2] * 2.4, 0.82], { lit: 0, em: [wv, wv * 1.4, wv * 1.8], tex: GLX.tex.water, det: GLX.tex.water, detS: 1 / 210, detO: [t * 0.021, -t * 0.013] });
  }
  if (S) {
    drawWorldDynamic(v, me, t);
    const mt = me ? me.team : 0;
    for (const p of S.players) {
      if (!p.alive || (p === v && !CAM.on)) continue;
      const ally = p.team === mt;
      if (cc) { if (p !== me || Math.hypot(p.x - cc.x, p.y - cc.z) > 190) drawCharacter(p, ally ? 'ally' : 'enemy', 1, false, t); continue; } // sinematikte herkes görünür (kameranın yaklaştığı kendi karakterin hariç)
      if (PKMAP) { drawCharacter(p, p === me ? 'ally' : 'enemy', 1, false, t); continue; } // parkur: yarışçıların hepsi her zaman görünür
      if (ally) { drawCharacter(p, 'ally', p.st.invis > 0 ? 0.35 : 1, false, t); continue; }
      if (v && v !== me && v.team === p.team) { drawCharacter(p, 'enemy', p.st.invis > 0 ? 0.35 : 1, false, t); continue; } // rakibi izlerken onun takımı görünür
      const seen = v.alive ? visibleFPS(v, p) : losClear(v.x, v.y, p.x, p.y);
      if (seen) drawCharacter(p, 'enemy', 1, false, t);
      else if (p.st.reveal > 0) drawCharacter(p, 'enemy', 1, true, t);
    }
    drawFX(dt);
    if (v.alive && !CAM.on) drawViewmodel(v, dt, t);
  }
  glFlush();
  if (S && v.alive) glFlushViewmodel(asp);
}
