'use strict';
/* =====================================================================
   NOVA — Taktik Nişancı
   01 · ÇEKİRDEK: sabitler, yardımcılar, harita, çarpışma, ışın izleme,
        görüş, A* yol bulma, silah/ajan veri tabloları
   ===================================================================== */
const TILE = 80;            // 1 karo = 80 birim (haritalar ilk sürümün 2 katı büyüklükte)
const MS = TILE / 40;       // harita ölçeği (ilk sürüme göre)
let MW = 60, MH = 40, WW = MW * TILE, WH = MH * TILE;
const PR = 15, TAU = Math.PI * 2, RUN = 250, SIM_DT = 1 / 60;
/* 3D yükseklikler (dünya birimi; 40 birim ≈ 1 m) */
const EYE = 64, P_TOP = 75, HEAD_LO = 57, LEG_TOP = 26, BOX_H = 84, KNOCK_LIFT = 32;
/* Eğilme: göz ve vuruş kutusu alçalır; alçak siperler (LOW_H) yalnızca eğilene tam koruma sağlar */
const EYE_C = 42, P_TOP_C = 48, HEAD_LO_C = 32, LEG_TOP_C = 15, LOW_H = 50;
let WALL_H = 120;
const BUY_TIME = 20, END_TIME = 5;
let ROUND_TIME = 115, BOMB_TIME = 45; // haritaya göre loadMap'te ayarlanır
const PLANT_TIME = 4, DEFUSE_TIME = 7, MAX_CREDITS = 9000;
let MATCH_ROUNDS = 20, HALF_ROUNDS = 10; // maç 20 raunt sürer, 10. rauntten sonra taraflar değişir
const KIT_PRICE = 600, KIT_TIME = 1;
/* EMOTE'lar: Z menüsü, 1–6 */
const EMOTES = [{ k: 'wave', e: '👋', n: 'EL SALLA' }, { k: 'dance', e: '💃', n: 'DANS' }, { k: 'cheer', e: '🙌', n: 'SEVİN' }, { k: 'thumb', e: '👍', n: 'TAMAM' }, { k: 'laugh', e: '😂', n: 'GÜL' }, { k: 'gg', e: '🏆', n: 'GG' }];
const EMOTE_TIME = 2.6;     // İMHA KİTİ: yalnızca savunanlar, bombayı 1 sn'de imha eder
/* zıplama (tepe ≈ 1,05 m, havada ≈ 0,6 sn) ve reboot */
const JUMP_V = 280, GRAV = 935, REBOOT_TIME = 4, REBOOT_CD = 15, REBOOT_R = 82;
const HEAL_AMT = 50, HEAL_CD = 25, HEAL_R = 34, HEAL_MAX = 100; // can küresi: +50 can (en fazla 100), 25 sn'de yeniden çıkar
const PAL = {
  navy: '#0f1923', navy2: '#16232f', navy3: '#1f2e3c', red: '#ff4655', teal: '#1ee3cf',
  white: '#ece8e1', gold: '#f5c451', dim: '#8b978f', purple: '#b46cff', green: '#3cf07a'
};

/* ---------- yardımcılar ---------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
const tc = (tx, ty) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; }
function rotToward(a, b, max) { const d = angDiff(a, b); return Math.abs(d) <= max ? b : a + Math.sign(d) * max; }
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}
/* Işın-çember kesişimi: giriş mesafesi (içerideyse 0), yoksa null */
function rayCircle(ox, oy, ux, uy, cx, cy, r) {
  const fx = ox - cx, fy = oy - cy, b = fx * ux + fy * uy, c = fx * fx + fy * fy - r * r, disc = b * b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc), t1 = -b - s, t2 = -b + s;
  if (t2 < 0) return null;
  return t1 < 0 ? 0 : t1;
}
function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }

/* ---------- HARİTA ---------- */
const T_WALL = 0, T_FLOOR = 1, T_A = 2, T_B = 3, T_ATK = 4, T_DEF = 5, T_BOX = 6, T_WATER = 7, T_LOW = 8;
/* PARKUR karoları (03b_parkur): boşluk, yükseklikli bloklar (zıplanarak çıkılır), kılıçla kırılan barikat,
   zıplama pedi, hız şeridi, kontrol noktası ve bitiş zemini */
const T_PIT = 9, T_H1 = 10, T_H2 = 11, T_H3 = 12, T_BREAK = 13, T_PAD = 14, T_BOOST = 15, T_CHECK = 16, T_FINISH = 17;
const PK_TOP = { [T_H1]: 30, [T_H2]: 60, [T_H3]: 90 };  // blok üst yüzeyi (zıplama tepesi ≈ 42)
const PK_STEP = 8;                                      // bu kadar alçaktaki kenara kendiliğinden çıkılır
let PKZ = 0;                                            // çarpışma denetlenen oyuncunun yüksekliği (yalnızca parkur blokları için)
let pkBroken = new Uint8Array(1);                       // kırılmış barikat karoları
let grid = new Uint8Array(MW * MH);
let tgrid = new Int32Array(MW * MH); // geçici duvar (TERRA) kimliği
let wallAdj = new Uint8Array(MW * MH);
let MAPDATA = null;

function setMapSize(w, h) {
  MW = w; MH = h; WW = MW * TILE; WH = MH * TILE;
  grid = new Uint8Array(MW * MH); tgrid = new Int32Array(MW * MH); wallAdj = new Uint8Array(MW * MH); pkBroken = new Uint8Array(MW * MH);
  AS_g = new Float32Array(MW * MH); AS_came = new Int32Array(MW * MH); AS_closed = new Uint8Array(MW * MH);
}
function carve(x, y, w, h, t) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < MW && j < MH) grid[j * MW + i] = (t === undefined ? T_FLOOR : t); }
function carveSym(x, y, w, h, t, t2) { carve(x, y, w, h, t); carve(MW - x - w, y, w, h, t2 === undefined ? t : t2); }
function computeWallAdj() {
  wallAdj = new Uint8Array(MW * MH);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    let n = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { if ((i || j) && baseSolid(x + i, y + j)) n++; }
    wallAdj[y * MW + x] = n;
  }
}
function tileAt(tx, ty) { return (tx < 0 || ty < 0 || tx >= MW || ty >= MH) ? T_WALL : grid[ty * MW + tx]; }
function baseSolid(tx, ty) { const t = tileAt(tx, ty); return t === T_WALL || t === T_BOX || t === T_LOW; }
/* Hareket için katı mı? (duvar, kasa, alçak siper, su, geçici duvar) */
function solidT(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return true;
  const i = ty * MW + tx, t = grid[i];
  if (t >= T_PIT) { // parkur: boşluk geçilir (düşülür), bloklar yalnızca üstlerinden alçaktaysan engeldir
    if (t === T_BREAK) return !pkBroken[i];
    const h = PK_TOP[t]; return h !== undefined && PKZ < h - PK_STEP;
  }
  return t === T_WALL || t === T_BOX || t === T_LOW || t === T_WATER || tgrid[i] > 0;
}
/* Işın için: 0 geçirgen (zemin, su), 1 tam engel, 2 alçak siper (yüksekliğe bağlı) */
function rayKind(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return 1;
  const i = ty * MW + tx;
  if (tgrid[i] > 0) return 1;
  const t = grid[i];
  return (t === T_WALL || t === T_BOX) ? 1 : t === T_LOW ? 2 : 0;
}
function solidAt(x, y) { return solidT(Math.floor(x / TILE), Math.floor(y / TILE)); }
function rayBlockAt(x, y) { return rayKind(Math.floor(x / TILE), Math.floor(y / TILE)) === 1; }
function tileTypeAt(x, y) { return tileAt(Math.floor(x / TILE), Math.floor(y / TILE)); }
function siteAt(x, y) { const t = tileTypeAt(x, y); return t === T_A ? 'A' : t === T_B ? 'B' : null; }

/* Orijinal harita (MERKEZ) için elle hazırlanmış bot noktaları */
function mirrorPts(pts) { return pts.map(p => [MW - 1 - p[0], p[1], p[2] !== undefined ? MW - 1 - p[2] : undefined, p[3]]); }
function merkezData() {
  const A = {
    center: [10, 11],
    plant: [[10, 9], [5, 12], [16, 11], [10, 15], [5, 8]],
    clear: [[10, 9], [5, 12], [16, 11], [10, 15], [15, 15], [4, 9]],
    hold: [[4, 8, 6, 18], [16, 9, 19, 14], [11, 8, 6, 18]],
    post: [[7, 21, 10, 11], [20, 14, 12, 11], [15, 4, 13, 10], [4, 13, 9, 11]],
    smokeAtk: [[15, 6], [19, 14]], smokeDef: [[7, 20]], entry: [[7, 18], [19, 14]],
    routeMain: [[6, 31], [7, 22]], routeMid: [[30, 28], [27, 19], [20, 14]]
  };
  const B = {
    center: [MW - 1 - 10, 11],
    plant: mirrorPts(A.plant).map(p => [p[0], p[1]]), clear: mirrorPts(A.clear).map(p => [p[0], p[1]]),
    hold: A.hold.map(p => [MW - 1 - p[0], p[1], MW - 1 - p[2], p[3]]), post: A.post.map(p => [MW - 1 - p[0], p[1], MW - 1 - p[2], p[3]]),
    smokeAtk: mirrorPts(A.smokeAtk).map(p => [p[0], p[1]]), smokeDef: mirrorPts(A.smokeDef).map(p => [p[0], p[1]]),
    entry: mirrorPts(A.entry).map(p => [p[0], p[1]]), routeMain: mirrorPts(A.routeMain).map(p => [p[0], p[1]]),
    routeMid: [[29, 28], [32, 19], [39, 14]]
  };
  return {
    sites: { A, B },
    midHold: [[30, 9, 30, 20], [25, 13, 30, 22], [34, 12, 29, 22]],
    spawns: {
      atk: [[24, 34], [27, 33], [30, 35], [33, 33], [35, 35], [25, 36], [29, 33], [32, 36], [36, 33], [23, 35]],
      def: [[25, 2], [28, 3], [31, 2], [34, 3], [29, 4], [24, 4], [33, 4], [27, 1], [32, 1], [35, 2]]
    },
    orbs: [[20, 14], [39, 14]], defCenter: [30, 3], atkCenter: [30, 35],
    labels: [['MID', 30, 18.5], ['A MAIN', 6.5, 27], ['B MAIN', 52.5, 27], ['A LINK', 21, 12.6], ['B LINK', 39, 12.6]]
  };
}

/* ---------- IŞIN İZLEME (DDA) ----------
   h0/slope verilirse ışının yüksekliği izlenir: alçak siperin (LOW_H) üstünden geçebilir */
const RC = { d: 0, hit: false, tx: 0, ty: 0, low: false };
function raycast(x, y, ux, uy, maxD, h0, slope) {
  let tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  RC.hit = false; RC.low = false; RC.tx = tx; RC.ty = ty;
  if (rayKind(tx, ty) === 1) { RC.d = 0; RC.hit = true; return RC; }
  const hasH = h0 !== undefined && h0 !== null, sl = slope || 0;
  const sx = ux > 0 ? 1 : -1, sy = uy > 0 ? 1 : -1;
  const dX = ux !== 0 ? Math.abs(TILE / ux) : Infinity, dY = uy !== 0 ? Math.abs(TILE / uy) : Infinity;
  let mX = ux > 0 ? ((tx + 1) * TILE - x) / ux : ux < 0 ? (tx * TILE - x) / ux : Infinity;
  let mY = uy > 0 ? ((ty + 1) * TILE - y) / uy : uy < 0 ? (ty * TILE - y) / uy : Infinity;
  for (let n = 0; n < 700; n++) {
    let t;
    if (mX < mY) { t = mX; mX += dX; tx += sx; } else { t = mY; mY += dY; ty += sy; }
    if (t > maxD) break;
    const k = rayKind(tx, ty);
    if (k === 1) { RC.d = t; RC.hit = true; RC.tx = tx; RC.ty = ty; return RC; }
    if (k === 2) {
      if (!hasH) { RC.d = t; RC.hit = true; RC.low = true; RC.tx = tx; RC.ty = ty; return RC; }
      const tOut = Math.min(Math.min(mX, mY), maxD);
      if (Math.min(h0 + sl * t, h0 + sl * tOut) < LOW_H) { RC.d = t; RC.hit = true; RC.low = true; RC.tx = tx; RC.ty = ty; return RC; }
    }
  }
  RC.d = maxD; RC.hit = false; return RC;
}
/* Görüşü kesen alanlar: duman ve ateş duvarı */
function blockerRay(ox, oy, ux, uy, maxD) {
  let d = maxD;
  if (!S) return d;
  for (const a of S.areas) {
    if (a.type === 'smoke') {
      const t = rayCircle(ox, oy, ux, uy, a.x, a.y, a.r * smokeScale(a));
      if (t !== null) { const tt = t === 0 ? 55 : t; if (tt < d) d = tt; }
    } else if (a.type === 'firewall' && a.pts) {
      for (const p of a.pts) {
        const t = rayCircle(ox, oy, ux, uy, p[0], p[1], a.pr);
        if (t !== null) { const tt = t === 0 ? 45 : t; if (tt < d) d = tt; }
      }
    }
  }
  return d;
}
function smokeScale(a) { const age = a.dur - a.t; return age < 0.35 ? 0.3 + age * 2 : (a.t < 0.6 ? Math.max(0.2, a.t / 0.6) : 1); }
/* h1/h2 verilirse yüksekliğe duyarlı (alçak siperin üstünden görülebilir) */
function losClear(x1, y1, x2, y2, noSmoke, h1, h2) {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const ux = dx / d, uy = dy / d;
  if (h1 !== undefined) { if (raycast(x1, y1, ux, uy, d, h1, (h2 - h1) / d).hit) return false; }
  else if (raycast(x1, y1, ux, uy, d).hit) return false;
  if (!noSmoke && blockerRay(x1, y1, ux, uy, d) < d - 1) return false;
  return true;
}
function liftOf(p) { return (p.st && p.st.knock > 0 ? KNOCK_LIFT : 0) + (p.jz || 0); }
function eyeOf(p) { return (p.crouch ? EYE_C : EYE) + liftOf(p); }
function topOf(p) { return (p.crouch ? P_TOP_C : P_TOP) + liftOf(p); }
function visionOf(p) {
  let far = 2000 * MS, near = 150, fov = 110 * Math.PI / 180;
  if (p.scoped) { far = 2900 * MS; fov = 40 * Math.PI / 180; }
  if (p.st.near > 0) { far = Math.min(far, 175); near = Math.min(near, 110); }
  if (p.st.shroud > 0) { far = Math.min(far, 220); near = Math.min(near, 100); }
  return { far, near, fov };
}
function seesPoint(v, x, y, h) {
  const d = dist(v.x, v.y, x, y), vp = visionOf(v);
  if (d > vp.near) {
    if (d > vp.far) return false;
    if (Math.abs(angDiff(v.ang, Math.atan2(y - v.y, x - v.x))) > vp.fov / 2) return false;
  }
  return losClear(v.x, v.y, x, y, false, eyeOf(v), h === undefined ? 40 : h);
}
/* Birinci şahıs görünürlüğü: kafa, gövde veya iki kenardan biri görünüyorsa düşman çizilir */
function fpsRange(v) { return v.st.near > 0 ? 175 : v.st.shroud > 0 ? 220 : 6000 * MS; }
function visibleFPS(v, t) {
  if (!t.alive) return false;
  const dx = t.x - v.x, dy = t.y - v.y, d = Math.hypot(dx, dy);
  if (d < 1) return true;
  if (t.st.invis > 0 && d > 70) return false;
  if (d > fpsRange(v)) return false;
  // oyuncunun görünebilen her yerine (baş, gövde, kollar, bacaklar) ışın: bir köşeden azıcık görünen oyuncu
  // "aniden kaybolmasın" — çizilen modelin kenarı görünüyorsa oyuncu da görünür
  const e = eyeOf(v), top = topOf(t) - 3, mid = top * 0.55, low = Math.max(8, top * 0.22);
  const px = -dy / d * (PR - 2), py = dx / d * (PR - 2);
  if (losClear(v.x, v.y, t.x, t.y, false, e, top) || losClear(v.x, v.y, t.x, t.y, false, e, mid)) return true;
  for (const s of [1, -1]) {
    const x = t.x + px * s, y = t.y + py * s;
    if (losClear(v.x, v.y, x, y, false, e, mid) || losClear(v.x, v.y, x, y, false, e, top) || losClear(v.x, v.y, x, y, false, e, low)) return true;
  }
  return losClear(v.x, v.y, t.x, t.y, false, e, low);
}
function canSee(v, t) {
  if (!t.alive) return false;
  const d = dist(v.x, v.y, t.x, t.y);
  if (t.st.invis > 0 && d > 70) return false;
  if (v.st.blind > 0.3 && d > 60) return false;
  return seesPoint(v, t.x, t.y, topOf(t) - 3);
}

/* ---------- ÇARPIŞMA ---------- */
function circleHits(x, y, r, extra) {
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE), y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (solidT(tx, ty) || (extra && extra(tx, ty))) {
      const cx = clamp(x, tx * TILE, tx * TILE + TILE), cy = clamp(y, ty * TILE, ty * TILE + TILE);
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
    }
  }
  return false;
}
function resolveCircle(o, r, extra) {
  for (let it = 0; it < 4; it++) {
    let any = false;
    const x0 = Math.floor((o.x - r) / TILE), x1 = Math.floor((o.x + r) / TILE), y0 = Math.floor((o.y - r) / TILE), y1 = Math.floor((o.y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!(solidT(tx, ty) || (extra && extra(tx, ty)))) continue;
      const rx = tx * TILE, ry = ty * TILE;
      const cx = clamp(o.x, rx, rx + TILE), cy = clamp(o.y, ry, ry + TILE);
      const dx = o.x - cx, dy = o.y - cy, d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        any = true;
        if (d2 > 1e-9) { const d = Math.sqrt(d2), push = r - d; o.x += dx / d * push; o.y += dy / d * push; }
        else {
          const l = o.x - rx, rr = rx + TILE - o.x, t = o.y - ry, b = ry + TILE - o.y, m = Math.min(l, rr, t, b);
          if (m === l) o.x = rx - r; else if (m === rr) o.x = rx + TILE + r; else if (m === t) o.y = ry - r; else o.y = ry + TILE + r;
        }
      }
    }
    if (!any) break;
  }
}
function moveCircle(o, dx, dy, r, extra) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 7));
  for (let i = 0; i < n; i++) { o.x += dx / n; o.y += dy / n; resolveCircle(o, r, extra); }
  o.x = clamp(o.x, r, WW - r); o.y = clamp(o.y, r, WH - r);
}
function findFree(x, y, r) {
  if (!circleHits(x, y, r)) return { x, y };
  for (let rad = 8; rad < 400; rad += 8) for (let a = 0; a < TAU; a += Math.PI / 10) {
    const nx = x + Math.cos(a) * rad, ny = y + Math.sin(a) * rad;
    if (!circleHits(nx, ny, r)) return { x: nx, y: ny };
  }
  return { x, y };
}
function walkLine(x1, y1, x2, y2, r) {
  const d = dist(x1, y1, x2, y2), n = Math.ceil(d / 10);
  for (let i = 1; i <= n; i++) { const t = i / n; if (circleHits(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r)) return false; }
  return true;
}

/* ---------- A* YOL BULMA ---------- */
let AS_g = new Float32Array(MW * MH), AS_came = new Int32Array(MW * MH), AS_closed = new Uint8Array(MW * MH);
const AS_hi = [], AS_hf = [];
function hPush(i, f) {
  AS_hi.push(i); AS_hf.push(f); let k = AS_hi.length - 1;
  while (k > 0) { const p = (k - 1) >> 1; if (AS_hf[p] <= AS_hf[k]) break; [AS_hi[p], AS_hi[k]] = [AS_hi[k], AS_hi[p]]; [AS_hf[p], AS_hf[k]] = [AS_hf[k], AS_hf[p]]; k = p; }
}
function hPop() {
  const top = AS_hi[0], li = AS_hi.pop(), lf = AS_hf.pop();
  if (AS_hi.length) {
    AS_hi[0] = li; AS_hf[0] = lf; let k = 0; const n = AS_hi.length;
    for (;;) {
      const l = 2 * k + 1, r = l + 1; let m = k;
      if (l < n && AS_hf[l] < AS_hf[m]) m = l;
      if (r < n && AS_hf[r] < AS_hf[m]) m = r;
      if (m === k) break;
      [AS_hi[m], AS_hi[k]] = [AS_hi[k], AS_hi[m]]; [AS_hf[m], AS_hf[k]] = [AS_hf[k], AS_hf[m]]; k = m;
    }
  }
  return top;
}
function nearestFreeTile(tx, ty) {
  if (!solidT(tx, ty)) return [tx, ty];
  for (let r = 1; r < 8; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (!solidT(tx + i, ty + j)) return [tx + i, ty + j];
  return [tx, ty];
}
const DIRS8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
function findPath(sx, sy, gx, gy) {
  let [stx, sty] = nearestFreeTile(Math.floor(sx / TILE), Math.floor(sy / TILE));
  let [gtx, gty] = nearestFreeTile(Math.floor(gx / TILE), Math.floor(gy / TILE));
  const start = sty * MW + stx, goal = gty * MW + gtx;
  if (start === goal) return [{ x: gx, y: gy }];
  AS_g.fill(1e9); AS_came.fill(-1); AS_closed.fill(0); AS_hi.length = 0; AS_hf.length = 0;
  AS_g[start] = 0; hPush(start, 0);
  let found = false, iter = 0;
  while (AS_hi.length && iter++ < MW * MH * 2) {
    const cur = hPop();
    if (cur === goal) { found = true; break; }
    if (AS_closed[cur]) continue;
    AS_closed[cur] = 1;
    const cx = cur % MW, cy = (cur / MW) | 0;
    for (const d of DIRS8) {
      const nx = cx + d[0], ny = cy + d[1];
      if (solidT(nx, ny)) continue;
      if (d[0] && d[1] && (solidT(cx + d[0], cy) || solidT(cx, cy + d[1]))) continue;
      const ni = ny * MW + nx;
      if (AS_closed[ni]) continue;
      const ng = AS_g[cur] + d[2] + (wallAdj[ni] ? 0.45 : 0);
      if (ng < AS_g[ni]) {
        AS_g[ni] = ng; AS_came[ni] = cur;
        const ddx = Math.abs(nx - gtx), ddy = Math.abs(ny - gty);
        hPush(ni, ng + (ddx + ddy) + (1.414 - 2) * Math.min(ddx, ddy));
      }
    }
  }
  if (!found) return null;
  const path = [];
  let c = goal;
  while (c !== start && c !== -1) { path.push(tc(c % MW, (c / MW) | 0)); c = AS_came[c]; }
  path.reverse();
  path[path.length - 1] = { x: gx, y: gy };
  if (circleHits(gx, gy, PR)) path[path.length - 1] = tc(gtx, gty);
  return path;
}

/* ---------- SİLAHLAR ---------- */
const WEAPONS = {
  classic: { vk: 0.004, name: 'Serçe', type: 'Tabanca', slot: 2, price: 0, dmg: 26, hs: 3, rate: 6.75, auto: false, mag: 12, res: 36, reload: 1.75, base: 0.012, move: 0.06, bloom: 0.02, bmax: 0.08, range: 1700, fall: [[900, 22]], snd: 'classic', sway: 0, trace: '#ffe7a3', len: 16 },
  sheriff: { vk: 0.014, name: 'Akrep', type: 'Ağır Tabanca', slot: 2, price: 800, dmg: 55, hs: 2.9, rate: 4, auto: false, mag: 6, res: 24, reload: 2.25, base: 0.006, move: 0.1, bloom: 0.05, bmax: 0.12, range: 2200, fall: [[1200, 50]], snd: 'sheriff', sway: 0, trace: '#ffd27a', len: 18 },
  spectre: { vk: 0.004, name: 'Arı', type: 'Hafif Makineli', slot: 1, price: 1600, dmg: 26, hs: 3, rate: 13.33, auto: true, mag: 30, res: 90, reload: 2.25, base: 0.018, move: 0.04, bloom: 0.006, bmax: 0.065, range: 1700, fall: [[700, 22]], snd: 'spectre', sway: 0.03, trace: '#a8f0ff', len: 22 },
  vandal: { vk: 0.009, name: 'Kartal', type: 'Tüfek', slot: 1, price: 2900, dmg: 40, hs: 4, rate: 9.75, auto: true, mag: 25, res: 50, reload: 2.5, base: 0.003, move: 0.14, bloom: 0.011, bmax: 0.1, range: 2600, fall: [], snd: 'vandal', sway: 0.05, trace: '#ffb36b', len: 27 },
  phantom: { vk: 0.007, name: 'Baykuş', type: 'Susturuculu Tüfek', slot: 1, price: 2900, dmg: 39, hs: 4, rate: 11, auto: true, mag: 30, res: 60, reload: 2.5, base: 0.003, move: 0.12, bloom: 0.008, bmax: 0.085, range: 2600, fall: [[600, 35], [1000, 31]], snd: 'phantom', sway: 0.04, silenced: true, trace: 'rgba(200,230,255,0.55)', len: 28 },
  railgun: { vk: 0, name: 'Railgun', type: 'Raylı Top', slot: 1, price: 3900, dmg: 999, hs: 1, rate: 0.85, auto: false, mag: 2, res: 4, reload: 3.2, base: 0.0035, move: 0.16, bloom: 0, bmax: 0, range: 3400, fall: [], snd: 'railgun', sway: 0, pierce: true, oneshot: true, spd: 0.88, trace: '#7cf3ff', len: 36 },
  operator: { vk: 0, name: 'Atmaca', type: 'Keskin Nişancı', slot: 1, price: 4700, dmg: 150, hs: 1.7, rate: 0.75, auto: false, mag: 5, res: 10, reload: 3.7, base: 0.11, scopedBase: 0.0012, move: 0.3, bloom: 0, bmax: 0, range: 3200, fall: [], snd: 'operator', sway: 0, scope: true, spd: 0.82, trace: '#ff6b81', len: 34 }
};
const WEAPON_ORDER = ['classic', 'sheriff', 'spectre', 'vandal', 'phantom', 'railgun', 'operator'];
/* büyük haritalar: menzil ve hasar düşüş mesafeleri ölçekle büyür */
for (const k in WEAPONS) { const w = WEAPONS[k]; w.range = Math.round(w.range * MS * 1.25); w.fall = w.fall.map(f => [f[0] * MS, f[1]]); }
/* KILIÇ (3. yuva): her zaman elde, mermisiz yakın dövüş. Elde tutarken daha hızlı koşulur.
   Sol tık: hızlı kesik (50, sırttan 100) · Sağ tık: ağır darbe (75, sırttan 150) */
WEAPONS.sword = { vk: 0, name: 'Kılıç', type: 'Yakın Dövüş', slot: 3, price: 0, melee: true, dmg: 50, heavy: 75, hs: 1, rate: 1.7, heavyRate: 0.95, reach: 78,
  auto: true, mag: 1, res: 0, reload: 0, base: 0, move: 0, bloom: 0, bmax: 0, range: 78, fall: [], snd: 'sword', sway: 0, spd: 1.22, trace: '#ffffff', len: 30 };
const ARMOR = { light: { name: 'Hafif Zırh', price: 400, val: 25 }, heavy: { name: 'Ağır Zırh', price: 1000, val: 50 } };

/* ---------- AJANLAR ---------- */
const AGENTS = {
  vex: { name: 'KUZGUN', role: 'Akıncı', color: '#a86bff', icon: 'K',
    q: { name: 'Gölge Atılma', cost: 150, max: 2, desc: 'Hareket ettiğin yöne doğru anında hızlı bir atılma yapar.' },
    e: { name: 'Hayalet Örtüsü', cost: 200, max: 1, free: true, desc: '3.5 sn görünmez olursun. Ateş etmek görünmezliği bozar.' },
    x: { name: 'Karanlık Kesik', pts: 6, desc: 'Duvarlardan geçen, haritanın öbür ucuna kadar giden ve değdiği her düşmanı tek vuruşta öldüren dev bir enerji bıçağı fırlatır.' } },
  ignis: { name: 'ALAZ', role: 'Akıncı', color: '#ff8a3d', icon: 'A',
    q: { name: 'Alev Topu', cost: 250, max: 2, desc: 'Patladığı noktaya bakan düşmanları kör eden alev topu (flash).' },
    e: { name: 'Ateş Duvarı', cost: 200, max: 1, free: true, desc: 'Görüşü kesen, düşmanları yakan ateş duvarı. ALAZ alevin içinde iyileşir.' },
    x: { name: 'Küllerden Doğuş', pts: 5, desc: '15 sn klon modu: bu sürede ölürsen ultiyi açtığın noktada tam can ve zırhla yeniden doğarsın.' } },
  mist: { name: 'PUS', role: 'Stratejist', color: '#8a8cff', icon: 'P',
    q: { name: 'Sis Küresi', cost: 100, max: 3, free: true, desc: 'İmlecin olduğu yere, duvarların üzerinden görüş kesen duman küresi yerleştirir.' },
    e: { name: 'Zehir Sisi', cost: 200, max: 1, desc: 'İçindeki düşmanları %45 yavaşlatan ve zehirleyen bulut.' },
    x: { name: 'Kabus Alanı', pts: 6, desc: 'Devasa bir alanı 13 sn zehirli sisle kaplar; içerideki düşmanlar yavaşlar, canları hızla 1\'e iner ve yerleri açığa çıkar.' } },
  aegis: { name: 'SUR', role: 'Bekçi', color: '#ffd166', icon: 'S',
    q: { name: 'Tuzak Mayını', cost: 200, max: 2, desc: 'Düşman yaklaştığında patlayan gizli mayın (aynı anda en fazla 2).' },
    e: { name: 'Mini Taret', cost: 0, max: 1, free: true, desc: 'Görüş konisine giren düşmanlara otomatik ateş eden taret.' },
    x: { name: 'Mutlak Kilit', pts: 6, desc: 'Kurulan cihaz 3 sn sonra çok geniş alandaki tüm düşmanları 7.5 sn sersemletir; silah ve yetenek kullanamazlar.' } },
  pulse: { name: 'YANKI', role: 'İzci', color: '#3ec1ff', icon: 'Y',
    q: { name: 'Sonar Oku', cost: 150, max: 2, free: true, desc: 'Saplandığı yerde iki kez tarama yapar, duvar arkasındaki düşmanları gösterir. 1 kez seker.' },
    e: { name: 'Şok Oku', cost: 200, max: 2, desc: 'İki kez sekip patlayan, alan hasarı veren ok.' },
    x: { name: 'Yörünge Lazeri', pts: 6, desc: 'Seçtiğin koridor boyunca haritanın sonuna kadar uzanan, duvarları delen dört ölümcül enerji huzmesi indirir.' } },
  chrono: { name: 'ÇAĞ', role: 'Stratejist', color: '#4be0a8', icon: 'Ç',
    q: { name: 'Zaman Küresi', cost: 200, max: 1, desc: 'İçine giren düşman mermilerini durduran zaman küresi.' },
    e: { name: 'Kuantum Sıçrama', cost: 150, max: 2, free: true, desc: 'İmleç yönünde kısa mesafeli ışınlanma.' },
    x: { name: 'Zaman Çöküşü', pts: 6, desc: 'Seçilen geniş bölgedeki düşmanların hareket ve ateş hızını %78 yavaşlatır ve onlara hasar verir.' } },
  terra: { name: 'TOPRAK', role: 'İzci', color: '#d4a25f', icon: 'T',
    q: { name: 'Sarsıntı Dalgası', cost: 200, max: 2, desc: 'İleri giden şok dalgası; değdiği düşmanların nişanını 3 sn bozar.' },
    e: { name: 'Taş Siper', cost: 0, max: 1, free: true, desc: 'Önüne geçici, kurşun geçirmez taş duvar örer (vurularak yıkılabilir).' },
    x: { name: 'Tektonik Yarık', pts: 6, desc: 'Önündeki çok uzun bir hattı yarar; üzerindeki düşmanları havaya savurur, sersemletir ve ağır hasar verir.' } },
  vital: { name: 'DERMAN', role: 'Bekçi', color: '#7cf29a', icon: '✚',
    q: { name: 'Derman Halkası', cost: 150, max: 2, free: true, desc: 'İçindeki takım arkadaşlarını (ve seni) iyileştiren şifa alanı.' },
    e: { name: 'Buz Zemini', cost: 200, max: 2, desc: 'Düşmanları %50 yavaşlatan buz zemini.' },
    x: { name: 'Yeniden Uyanış', pts: 6, desc: 'Yakınındaki ölmüş bir takım arkadaşını tam can ve zırhla diriltir; yakındaki canlı takım arkadaşlarını da tam iyileştirir.' } },
  volt: { name: 'ŞİMŞEK', role: 'Akıncı', color: '#f7f35a', icon: 'ϟ',
    q: { name: 'Akım Kayması', cost: 100, max: 2, desc: 'Ani kayma + 4 sn %35 hız artışı.' },
    e: { name: 'Zincir Yük', cost: 200, max: 1, free: true, desc: 'Düşmandan düşmana seken elektrik yükü.' },
    x: { name: 'Aşırı Yük', pts: 6, desc: '11 sn hareket hızın iki katına çıkar ve parmaklarından uzun menzilli, kesintisiz, yüksek hasarlı elektrik ışını ateşlersin.' } },
  phantom: { name: 'BÖRÜ', role: 'İzci', color: '#9aa7c7', icon: 'B',
    q: { name: 'Sağırlık Küresi', cost: 200, max: 1, desc: 'İçindeki düşmanları sağır eder: ses duyamazlar, minimap uyarıları kesilir.' },
    e: { name: 'Gölge Kurdu', cost: 250, max: 2, free: true, desc: 'İleri koşup en yakın düşmanı takip eden kurt; yakaladığını yakın görüşlü yapar ve açığa çıkarır.' },
    x: { name: 'Karanlık Örtü', pts: 6, desc: '13 sn boyunca tüm düşmanların haritası kararır, görüş mesafeleri minimuma iner ve 4 sn yerleri açığa çıkar.' } }
};
const AGENT_IDS = Object.keys(AGENTS);
