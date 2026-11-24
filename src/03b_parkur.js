/* =====================================================================
   03b · PARKUR MODU
        5 raunt; her raunt farklı, çok uzun ve ince bir parkur (havada süzülen pist).
        Herkesin elinde yalnızca kılıç var: kılıçla rakibi itersin/yavaşlatırsın
        (öldürmez, boşluğa düşürebilirsin) ve kırılabilir barikatları kırarsın.
        Bitişe ilk varan raundu alır; 5 raunt sonunda en çok raunt alan kazanır.
        Engeller: boşluklar, zıplanan bloklar, merdivenler, dar kirişler, adacıklar,
        sütun slalomu, barikatlar, dönen çubuklar, zıplama pedleri, hız şeritleri.
        Düşen oyuncu son kontrol noktasında yeniden başlar.
        Harita, maç tohumundan (cfg.pkSeed) ve raunt numarasından üretilir:
        host ve istemciler aynı haritayı kendileri üretir (ağdan harita gitmez).
   ===================================================================== */
const PK_ROUNDS = 5, PK_COUNT = 4, PK_CINE = 5, PK_END = 6;
const PK_SPD = 1.3;                 // herkes aynı hızda koşar (kılıç seviyesi parkurda hız vermez)
const PK_VOID = -1e9, PK_FALL = -230, PK_PAD_V = 560;
let PKMAP = null;                   // parkur haritasıysa tanımı, değilse null
const PK_DEFS = [
  { name: 'GÖK PİSTİ', theme: 'ada', desc: 'Bulutların üstünde, güneşli bir pist' },
  { name: 'SAKURA KÖPRÜLERİ', theme: 'sakura', desc: 'Kiraz çiçekleri arasında asma köprüler' },
  { name: 'BUZ SIRTI', theme: 'buzul', desc: 'Kaygan görünen ama sağlam buz yolu' },
  { name: 'LAV GEÇİDİ', theme: 'volkan', desc: 'Altında lav, üstünde kızıl gökyüzü' },
  { name: 'YÖRÜNGE', theme: 'uzay', desc: 'Dev gezegenin önünde, boşlukta bir pist' },
  { name: 'NEON KULELER', theme: 'neon', desc: 'Gece şehrinin üstünde ışıklı yol' },
  { name: 'TAPINAK YOLU', theme: 'tapinak', desc: 'Ormanın üstünde taş patika' }
];
function mapDef() { return PKMAP || MAPS[CUR_MAP] || MAPS[0]; }
function pkOn() { return !!(S && S.cfg && S.cfg.mode === 'pk'); }
/* maç tohumuna göre 5 farklı parkur (tema sırası karışık, zorluk raunt raunt artar) */
function pkOrder(seed) { const R = mulberry(seed | 0), a = PK_DEFS.map((_, i) => i); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, PK_ROUNDS); }
function pkTime() { return G.mode === 'client' && typeof clientServerNow === 'function' && NET.haveOff ? clientServerNow() : (S ? S.time : 0); }

/* ---------- HARİTA ÜRETİMİ ---------- */
function pkGenerate(round, seed) {
  const di = pkOrder(seed)[(round - 1) % PK_ROUNDS], def = PK_DEFS[di], D = clamp(round - 1, 0, 4);
  const R = mulberry((seed | 0) ^ Math.imul(round + 3, 0x9E3779B1)), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = a => a[Math.floor(R() * a.length)];
  const L = 250 + D * 40 + ri(0, 20);            // parkur uzunluğu (karo): 250–430 karo ≈ 500–860 m
  const M = 4, H = 9 + 2 * M;
  setMapSize(L + 34, H);
  grid.fill(T_PIT);
  const cy = H >> 1;
  const put = (x, y, t) => { if (x >= 0 && y >= 0 && x < MW && y < MH) grid[y * MW + x] = t; };
  const lane = (x, len, w, t, off) => { const y0 = cy + off - (w >> 1); for (let i = 0; i < len; i++) for (let j = 0; j < w; j++) put(x + i, y0 + j, t); };
  const W = [9, 9, 7, 7, 5][D];                  // pistin olağan genişliği (raunt ilerledikçe daralır)
  const cps = [], sw = [], brk = [], deco = [];
  // başlangıç alanı (doğuş + geri sayım bariyeri) ve arkasında duvar
  lane(3, 11, 9, T_ATK, 0); for (let y = cy - 5; y <= cy + 5; y++) put(2, y, T_WALL);
  const start = [];
  for (let c = 0; c < 3; c++) for (let r = -4; r <= 4; r += 2) start.push([5 + c * 2, cy + r]);
  cps.push({ x: 3, pts: start.map(p => p.slice()) });
  let x = 14, off = 0, sinceCp = 0;
  const cpGap = 40 - D * 2;
  const flat = (n, w, boost) => {
    lane(x, n, w, T_FLOOR, off);
    if (boost && n >= 6) { const bl = Math.min(n - 2, ri(4, 7)), bx = x + ((n - bl) >> 1); lane(bx, bl, w >= 7 ? 3 : 1, T_BOOST, off); }
    x += n;
  };
  const shift = () => { if (R() < 0.45) off = clamp(off + (R() < 0.5 ? -1 : 1), -2, 2); };
  const SEG = {
    hurdles() { const k = ri(3, 5); for (let i = 0; i < k; i++) { flat(ri(3, 4), W); lane(x, 1, W, T_H1, off); x++; } flat(3, W); },
    gaps() { const k = ri(2, 4); for (let i = 0; i < k; i++) { flat(ri(3, 5), W); x += D < 2 ? 1 : ri(1, 2); } flat(3, W); },
    stairs() {
      flat(3, W); lane(x, 2, W, T_H1, off); x += 2; lane(x, 2, W, T_H2, off); x += 2; lane(x, 3, W, T_H3, off); x += 3;
      if (D >= 1 && R() < 0.7) x += ri(1, 2); else { lane(x, 2, W, T_H2, off); x += 2; lane(x, 2, W, T_H1, off); x += 2; }
      flat(3, W);
    },
    beam() {
      flat(3, W); const bw = [3, 3, 2, 1, 1][D], n = ri(8, 13 + D);
      if (D >= 2 && R() < 0.5) { const h = n >> 1; lane(x, h, bw, T_FLOOR, off); const o2 = clamp(off + (R() < 0.5 ? -2 : 2), -2, 2); lane(x + h - 1, 1, Math.abs(o2 - off) + bw, T_FLOOR, (o2 + off) / 2 | 0); lane(x + h, n - h, bw, T_FLOOR, o2); off = o2; }
      else lane(x, n, bw, T_FLOOR, off);
      x += n; flat(3, W);
    },
    islands() {
      flat(3, W); const k = ri(3, 5), s = D < 2 ? 3 : 2; let o = off;
      for (let i = 0; i < k; i++) { x += D < 3 ? 1 : ri(1, 2); o = clamp(o + ri(-1, 1), off - 1, off + 1); lane(x, s, s, T_FLOOR, clamp(o, -2, 2)); x += s; }
      x += 1; flat(3, W);
    },
    pillars() {
      const n = ri(12, 16); lane(x, n, W, T_FLOOR, off);
      for (let i = 2; i < n - 2; i += 3) { const left = (i / 3 | 0) % 2 === 0, y0 = cy + off - (W >> 1); for (let j = 0; j < W - 2; j++) put(x + i, left ? y0 + j : y0 + 2 + j, T_WALL); }
      x += n;
    },
    breakwall() {
      const k = D >= 2 ? 2 : 1;
      flat(3, W);
      for (let r = 0; r < k; r++) { const y0 = cy + off - (W >> 1); for (let j = 0; j < W; j++) { put(x, y0 + j, T_BREAK); brk.push((y0 + j) * MW + x); } x++; flat(3, W); }
    },
    sweeper() {
      const k = D >= 3 ? 2 : 1;
      for (let r = 0; r < k; r++) {
        const n = 9, w = Math.max(W, 7); lane(x, n, w, T_FLOOR, off);
        const px = x + 4, py = cy + off; put(px, py, T_WALL);
        sw.push({ x: (px + 0.5) * TILE, y: (py + 0.5) * TILE, r: (w / 2 + 0.3) * TILE, w: (1.25 + D * 0.22) * (R() < 0.5 ? -1 : 1), ph: R() * TAU, h: 14 });
        x += n;
      }
      flat(3, W);
    },
    pads() {
      flat(3, W); lane(x, 1, W, T_PAD, off); x++;
      if (R() < 0.4) { lane(x, 1, W, T_PIT, off); x += 1; lane(x, 4, W, T_H3, off); x += 4; lane(x, 2, W, T_H2, off); x += 2; lane(x, 2, W, T_H1, off); x += 2; }
      else x += 3;
      flat(4, W);
    },
    sprint() { flat(ri(10, 16), W, true); }
  };
  const weights = [
    { hurdles: 3, gaps: 2, stairs: 2, beam: 1, islands: 0, pillars: 2, breakwall: 2, sweeper: 1, pads: 1, sprint: 2 },
    { hurdles: 2, gaps: 3, stairs: 2, beam: 2, islands: 1, pillars: 2, breakwall: 2, sweeper: 2, pads: 2, sprint: 1 },
    { hurdles: 2, gaps: 3, stairs: 2, beam: 2, islands: 2, pillars: 1, breakwall: 2, sweeper: 2, pads: 2, sprint: 1 },
    { hurdles: 1, gaps: 3, stairs: 2, beam: 3, islands: 3, pillars: 1, breakwall: 2, sweeper: 3, pads: 2, sprint: 1 },
    { hurdles: 1, gaps: 3, stairs: 2, beam: 3, islands: 3, pillars: 1, breakwall: 2, sweeper: 3, pads: 3, sprint: 1 }][D];
  const pickSeg = last => { let tot = 0; for (const k in weights) if (k !== last) tot += weights[k]; let z = R() * tot; for (const k in weights) { if (k === last) continue; z -= weights[k]; if (z <= 0) return k; } return 'sprint'; };
  let last = '';
  while (x < L) {
    if (sinceCp >= cpGap) { // kontrol noktası: tam genişlikte şerit, burada yeniden doğulur
      lane(x, 3, 9, T_CHECK, off); const pts = [];
      for (let i = 0; i < 3; i++) for (let j = -3; j <= 3; j += 2) pts.push([x + i, cy + off + j]);
      cps.push({ x, pts }); x += 3; sinceCp = 0; continue;
    }
    const x0 = x; shift(); const k = pickSeg(last); SEG[k](); last = k; sinceCp += x - x0;
  }
  // bitiş: düz yol, dama desenli bitiş çizgisi, arkada duvar
  off = 0; lane(x, 5, 9, T_FLOOR, 0); x += 5;
  const finX = x; lane(x, 2, 9, T_FINISH, 0); x += 2; lane(x, 10, 9, T_FLOOR, 0); x += 10;
  for (let y = cy - 5; y <= cy + 5; y++) put(x, y, T_WALL);
  const time = Math.round((finX / 3.6 * 2.5 + 40) / 5) * 5;
  return { id: 'pk' + round + '_' + di, pk: true, round, name: def.name, desc: def.desc, theme: THEMES[def.theme], di, L: finX, startX: 8, finX, cps, sw, brk, cy, time };
}
/* parkur haritasını yükle (host ve istemci aynı tohumla aynı haritayı üretir) */
function pkLoadMap(round, seed) {
  const m = pkGenerate(round, seed);
  PKMAP = m; CUR_MAP = 100 + m.di;
  pkBroken.fill(0); tgrid.fill(0);
  computeWallAdj();
  THEME = m.theme; WALL_H = THEME.wallH;
  const sp = m.cps[0].pts;
  MAPDATA = { pk: m, sites: { A: { center: [m.finX, m.cy] }, B: { center: [m.finX, m.cy] } }, spawns: { atk: sp, def: sp }, orbs: [], heal: [], reboot: [], speakers: [], labels: [], midHold: [], defCenter: sp[0], atkCenter: sp[0] };
  m.brkIdx = {}; m.brk.forEach((ti, n) => { m.brkIdx[ti] = n; });
  pkBuildNav();
  // güvence: başlangıçtan bitişe yol yoksa (üretecin kaçırdığı bir durum) en ileri noktadan köprü kur
  for (let it = 0; it < 30 && PKNAV.dist[m.cy * MW + 8] >= 1e8; it++) { pkBridge(); computeWallAdj(); pkBuildNav(); }
  ROUND_TIME = m.time;
  if (typeof onMapLoaded === 'function') onMapLoaded();
  return m;
}
function pkBridge() {
  const NV = PKNAV, seen = new Uint8Array(MW * MH), q = [PKMAP.cy * MW + 8]; seen[q[0]] = 1; let best = q[0];
  for (let h = 0; h < q.length; h++) { const u = q[h]; if (u % MW > best % MW) best = u; for (const e of NV.out[u]) { const v = NV.to[e]; if (!seen[v]) { seen[v] = 1; q.push(v); } } }
  const bx = best % MW, by = (best / MW) | 0;
  for (let x = bx + 1; x < MW - 1; x++) {
    let done = false;
    for (const y of [by, by + 1]) { if (y >= MH) continue; const i = y * MW + x; if (NV.ok[i] && NV.dist[i] < 1e8 && (PK_TOP[grid[i]] || 0) <= 30) done = true; else if (grid[i] !== T_ATK) grid[i] = T_FLOOR; }
    if (done) break;
  }
}
/* zemin yüksekliği: oyuncunun altındaki karoların en yükseği (köşelerden biri basıyorsa düşmezsin) */
function pkTileTop(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return PK_VOID;
  const i = ty * MW + tx, t = grid[i];
  if (t === T_PIT) return PK_VOID;
  if (t === T_BREAK) return pkBroken[i] ? 0 : 1e9;
  const h = PK_TOP[t]; return h === undefined ? 0 : h;
}
function pkGround(x, y) {
  const r = 7; let g = PK_VOID;
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) { const h = pkTileTop(Math.floor((x + ox) / TILE), Math.floor((y + oy) / TILE)); if (h > g && h < 1e8) g = h; }
  return g;
}
/* dikey hareket (yerçekimi, iniş, boşluğa düşüş) — movePlayer'dan */
function pkVertical(p, dt, g) {
  if (p.jz > g + 0.01 || p.jvz > 0) {
    p.jz += p.jvz * dt - 0.5 * GRAV * dt * dt; p.jvz -= GRAV * dt;
    if (p.jz <= g && p.jvz <= 0 && g > PK_VOID) { const hard = p.jvz < -500; p.jz = g; p.jvz = 0; if (p.ctrl === 'local' && typeof AU !== 'undefined') AU.play('land', p.x, p.y, hard ? 1 : 0.7, true); }
    if (p.jz < -420) { p.jz = -420; p.jvz = 0; }
  } else if (g > PK_VOID) p.jz = g;
}
/* yatay hareketten sonra: kenardan bloğun üstüne çıkış, ped ve hız şeridi */
function pkAfterMove(p, dt) {
  const g = pkGround(p.x, p.y);
  if (g > PK_VOID && p.jz < g && p.jz >= g - PK_STEP - 1) { p.jz = g; if (p.jvz < 0) p.jvz = 0; }
  if (g > PK_VOID && p.jz <= g + 0.6 && p.jvz <= 0) {
    const t = tileAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
    if (t === T_PAD && S.phase !== 'buy') { p.jvz = PK_PAD_V; p.jz += 0.5; if (typeof AU !== 'undefined') AU.play('jump', p.x, p.y, 1.2, p.ctrl === 'local'); }
    else if (t === T_BOOST) p.st.boost = Math.max(p.st.boost || 0, 0.9);
  }
}
function pkSweepAng(s, t) { return s.ph + s.w * t; }

/* ---------- BOT YOLU: bitişe uzaklık alanı (yüksekliğe ve zıplamaya duyarlı) ---------- */
let PKNAV = null;
function pkBuildNav() {
  const N = MW * MH, top = new Float32Array(N), ok = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const t = grid[i]; if (t === T_PIT || t === T_WALL) continue; ok[i] = 1; top[i] = t === T_BREAK ? 0 : (PK_TOP[t] || 0); }
  const from = [], to = [], cost = [], kind = [];
  const E = (u, v, c, k) => { from.push(u); to.push(v); cost.push(c); kind.push(k); };
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const u = y * MW + x; if (!ok[u]) continue;
    for (const [dx, dy] of D8) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const v = ny * MW + nx;
      if (ok[v] && top[v] - top[u] <= 36) {
        if (dx && dy) { const a = y * MW + nx, b = ny * MW + x; if (!ok[a] || !ok[b] || top[a] > top[u] + PK_STEP || top[b] > top[u] + PK_STEP) continue; }
        const up = top[v] - top[u] > PK_STEP;
        E(u, v, (dx && dy ? 1.414 : 1) * (up ? 1.5 : 1) + (grid[v] === T_BREAK ? 6 : 0), up ? 1 : 0);
      }
    }
    // boşluk atlamaları: kenardan kenara ≤175 birim (havada ~195 birim gidilir), arada yalnızca boşluk
    for (let jy = -2; jy <= 2; jy++) for (let jx = -2; jx <= 3; jx++) {
      if (Math.abs(jx) <= 1 && Math.abs(jy) <= 1) continue;
      const tx = x + jx, ty = y + jy; if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) continue;
      const w = ty * MW + tx; if (!ok[w] || top[w] > top[u] + 10) continue;
      const gx = Math.max(0, Math.abs(jx) - 1) * TILE, gy = Math.max(0, Math.abs(jy) - 1) * TILE;
      if (Math.hypot(gx, gy) > 175) continue;
      let clear = true, pit = false;
      for (let k = 1; k < 12 && clear; k++) { const f = k / 12, sx = Math.floor(x + 0.5 + jx * f), sy = Math.floor(y + 0.5 + jy * f), si = sy * MW + sx; if (si === u || si === w) continue; const st = grid[si]; if (st === T_PIT) pit = true; else if (st === T_WALL || (ok[si] && top[si] > top[u] + PK_STEP)) clear = false; }
      if (clear && pit) E(u, w, Math.hypot(jx, jy) + 1.5, 2);
    }
    if (grid[u] === T_PAD) for (const [dx, dy] of [[1, 0], [0, 1], [0, -1]]) for (let k = 2; k <= 6; k++) {
      const tx = x + dx * k, ty = y + dy * k; if (tx >= MW || ty < 0 || ty >= MH) break;
      const w = ty * MW + tx; if (grid[w] === T_WALL) break;
      if (ok[w] && top[w] <= top[u] + 150) E(u, w, k, 3);
    }
  }
  // ters yönde Dijkstra (bitiş karolarından)
  const inc = Array.from({ length: N }, () => []);
  for (let e = 0; e < from.length; e++) inc[to[e]].push(e);
  const dist = new Float64Array(N).fill(1e9), hi = [], hf = [];
  const push = (i, f) => { hi.push(i); hf.push(f); let k = hi.length - 1; while (k > 0) { const q = (k - 1) >> 1; if (hf[q] <= hf[k]) break; [hi[q], hi[k]] = [hi[k], hi[q]]; [hf[q], hf[k]] = [hf[k], hf[q]]; k = q; } };
  const pop = () => { const t = hi[0], li = hi.pop(), lf = hf.pop(); if (hi.length) { hi[0] = li; hf[0] = lf; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < hi.length && hf[l] < hf[m]) m = l; if (r < hi.length && hf[r] < hf[m]) m = r; if (m === k) break; [hi[m], hi[k]] = [hi[k], hi[m]]; [hf[m], hf[k]] = [hf[k], hf[m]]; k = m; } } return t; };
  const fx = PKMAP.finX;
  for (let y = 0; y < MH; y++) for (let x = fx; x < MW; x++) { const i = y * MW + x; if (ok[i]) { dist[i] = 0; push(i, 0); } }
  while (hi.length) {
    const f0 = hf[0], v = pop(); if (f0 > dist[v]) continue;
    for (const e of inc[v]) { const u = from[e], nd = dist[v] + cost[e]; if (nd < dist[u]) { dist[u] = nd; push(u, nd); } }
  }
  const out = Array.from({ length: N }, () => []);
  for (let e = 0; e < from.length; e++) out[from[e]].push(e);
  PKNAV = { dist, out, to, cost, kind, top, ok };
}

/* ---------- OYUN AKIŞI (host / tek oyunculu) ---------- */
function pkCreate(roster, cfg) {
  S = newState(cfg);
  S.pk = { bk: [], fin: {}, winner: null, champ: null, t0: 0, ord: [] };
  for (const r of roster) { const p = makePlayer(r); S.players.push(p); S.pmap[p.id] = p; }
  HIST.length = 0;
  pkStartRound();
}
function pkStartRound() {
  S.round++;
  const m = pkLoadMap(S.round, S.cfg.pkSeed);
  S.phase = 'buy'; S.phaseT = PK_CINE + PK_COUNT; S.lastResult = null;
  S.proj.length = 0; S.areas.length = 0; S.deps.length = 0; S.beams.length = 0; S.corpses.length = 0; S.cards = []; S.rb = []; S.orbs = []; S.heal = [];
  S.bomb = { state: 'none', carrier: null, x: 0, y: 0, t: 0, site: null, defuser: null, prog: 0, half: false };
  S.pk.bk = m.brk.map(() => 3); S.pk.fin = {}; S.pk.winner = null; S.pk.ord = [];
  const spots = shuffle(m.cps[0].pts.slice());
  S.players.forEach((p, i) => {
    const sp = spots[i % spots.length], pos = tc(sp[0], sp[1]);
    p.alive = true; p.hp = 100; p.armor = 0; p.st = {}; p.imp = null; p.plantT = 0; p.defT = 0; p.hasBomb = false; p.rebirth = null; p.kit = false;
    p.scoped = false; p.reloadT = 0; p.switchT = 0; p.fireCD = 0; p.bloom = 0; p.zoneSlow = 1; p.zoneFire = 1; p.vx = 0; p.vy = 0;
    p.dotAcc = {}; p.pend = false; p.jz = 0; p.jvz = 0; p.rbT = 0; p.primary = null; p.slot = 3; p.ch = { q: 0, e: 0 };
    p.pkCp = 0; p.pkP = 0; p.pkF = 0; p.pkSlot = i; p.pkW = p.pkW || 0; p.pkSum = p.pkSum || 0; p.pkT = p.pkT || 0;
    p.x = pos.x; p.y = pos.y; p.posVer++; p.ang = 0; p.pitch = 0; p.crouch = false;
    p.input = blankInput(); p.input.ang = 0; p.input.fp = p.lastFp; p.input.jc = p.lastJc;
    if (p.ctrl === 'bot') p.ai = pkNewAI(p);
  });
  emit({ k: 'round', n: S.round });
}
function pkRespawn(p) {
  const cps = MAPDATA.pk.cps, cp = cps[clamp(p.pkCp | 0, 0, cps.length - 1)], pts = cp.pts;
  let best = pts[(p.pkSlot | 0) % pts.length];
  for (let k = 0; k < pts.length; k++) { const c = pts[((p.pkSlot | 0) + k) % pts.length], q = tc(c[0], c[1]); if (!S.players.some(o => o !== p && o.alive && dist2(o.x, o.y, q.x, q.y) < 30 * 30)) { best = c; break; } }
  const f = tc(best[0], best[1]);
  setPos(p, f.x, f.y); p.jz = 0; p.jvz = 0; p.ang = 0; p.st = {}; p.st.boost = 0.6;
  if (p.ctrl === 'bot' && p.ai) { p.ai.stuckT = 0; p.ai.bestP = p.x; }
  emit({ k: 'pkfall', id: p.id, x: r1(f.x), y: r1(f.y), cp: p.pkCp | 0 });
}
function pkEndRound(win, reason) {
  if (S.phase === 'end' || S.phase === 'over') return;
  S.phase = 'end'; S.phaseT = PK_END;
  S.pk.winner = win ? win.id : null;
  if (win) win.pkW = (win.pkW || 0) + 1;
  for (const p of S.players) { p.pkSum = (p.pkSum || 0) + (S.pk.fin[p.id] ? 1 : p.pkP || 0); if (S.pk.fin[p.id]) p.pkT = (p.pkT || 0) + S.pk.fin[p.id]; }
  S.lastResult = { win: win ? win.team : 0, reason };
  emit({ k: 'pkend', w: win ? win.id : null, r: reason });
}
/* sıralama: bitirenler (süreye göre), sonra ilerlemeye göre */
function pkStandings() {
  const f = (S.pk && S.pk.fin) || {};
  return S.players.slice().sort((a, b) => (f[a.id] ? 0 : 1) - (f[b.id] ? 0 : 1) || (f[a.id] || 0) - (f[b.id] || 0) || (b.pkP || 0) - (a.pkP || 0));
}
function pkMatchRank() { return S.players.slice().sort((a, b) => (b.pkW || 0) - (a.pkW || 0) || (b.pkSum || 0) - (a.pkSum || 0) || (a.pkT || 0) - (b.pkT || 0)); }
function pkHostTick(dt) {
  S.time += dt;
  for (const p of S.players) if (p.ctrl === 'bot') pkBotUpdate(p, dt);
  for (const p of S.players) updateStatus(p, dt);
  for (const p of S.players) {
    if (!p.alive) continue;
    if (p.ctrl !== 'remote') movePlayer(p, dt, p.input);
    else p.spd = p.netMv * RUN;
  }
  separatePlayers();
  for (const p of S.players) updateCombat(p, dt);
  pkSweepers();
  pkProgress();
  S.phaseT -= dt;
  if (S.phase === 'buy' && S.phaseT <= 0) { S.phase = 'live'; S.phaseT = PKMAP.time; S.pk.t0 = S.time; emit({ k: 'go' }); }
  else if (S.phase === 'live' && S.phaseT <= 0) pkEndRound(pkStandings()[0], 'time');
  else if (S.phase === 'end' && S.phaseT <= 0) {
    if (S.round >= PK_ROUNDS) {
      const ch = pkMatchRank()[0]; S.pk.champ = ch ? ch.id : null; S.matchWinner = ch ? ch.team : -1;
      S.phase = 'over'; S.phaseT = 0; emit({ k: 'over', w: S.matchWinner, c: S.pk.champ });
    } else pkStartRound();
  }
  recordHistory();
}
function pkProgress() {
  const m = PKMAP, cps = m.cps;
  for (const p of S.players) {
    if (!p.alive) continue;
    if (p.jz < PK_FALL) { pkRespawn(p); continue; }
    p.pkP = clamp((p.x / TILE - m.startX) / (m.finX - m.startX), 0, 1);
    if (p.jz > -20) while ((p.pkCp | 0) + 1 < cps.length && p.x >= cps[(p.pkCp | 0) + 1].x * TILE) { p.pkCp = (p.pkCp | 0) + 1; emit({ k: 'pkcp', id: p.id, n: p.pkCp }); }
    if (S.phase === 'live' && !S.pk.fin[p.id] && p.x >= m.finX * TILE && p.jz > -20) {
      const t = r2(S.time - S.pk.t0); S.pk.fin[p.id] = t; p.pkF = t; p.pkP = 1; S.pk.ord.push(p.id);
      emit({ k: 'pkfin', id: p.id, t, pl: S.pk.ord.length });
      if (S.pk.ord.length === 1) pkEndRound(p, 'fin');
    }
  }
}
/* dönen çubuklar: çarpan oyuncuyu dönüş yönünde savurur (zıplayarak üstünden geçilir) */
function pkSweepers() {
  const sws = PKMAP.sw; if (!sws.length || S.phase === 'buy') return;
  const t = S.time;
  for (const s of sws) {
    const a = pkSweepAng(s, t), ux = Math.cos(a), uy = Math.sin(a);
    for (const p of S.players) {
      if (!p.alive || p.jz > s.h + 9 || p.jz < -30 || (p._swT || 0) > S.time) continue;
      const dx = p.x - s.x, dy = p.y - s.y, al = dx * ux + dy * uy;
      if (Math.abs(al) > s.r + 4) continue;
      const pd = Math.abs(dx * uy - dy * ux);
      if (pd > PR + 5) continue;
      // çubuğun o noktadaki hareket yönü (dönüşe dik)
      const sg = Math.sign(s.w) * Math.sign(al || 1), nx = -uy * sg, ny = ux * sg;
      impulse(p, nx * 640, ny * 640, 0.24); slowPlayer(p, 0.6, 0.3);
      p._swT = S.time + 0.7;
      emitSnd('swordhit', p.x, p.y);
      emit({ k: 'pkhit', a: null, t: p.id, x: r1(p.x), y: r1(p.y) });
    }
  }
}
/* PARKUR kılıç darbesi: rakibi iter + yavaşlatır (hasar yok) ya da önündeki barikatı kırar */
function pkSwing(p, heavy) {
  const w = swordStats(p);
  p.fireCD = 1 / (heavy ? w.heavyRate : w.rate); p.lastShot = S.time;
  let best = null, bd = 1e9;
  for (const t of S.players) {
    if (!t.alive || t === p || Math.abs((t.jz || 0) - (p.jz || 0)) > 50) continue;
    const d = dist(p.x, p.y, t.x, t.y);
    if (d > w.reach + PR || Math.abs(angDiff(p.ang, Math.atan2(t.y - p.y, t.x - p.x))) > 0.8) continue;
    if (d < bd) { bd = d; best = t; }
  }
  let brokeAt = null;
  if (!best) {
    outer: for (let d = 16; d <= w.reach + PR; d += 10) for (const da of [0, -0.35, 0.35]) {
      const x = p.x + Math.cos(p.ang + da) * d, y = p.y + Math.sin(p.ang + da) * d, tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) continue;
      const i = ty * MW + tx; if (grid[i] !== T_BREAK || pkBroken[i]) continue;
      const n = PKMAP.brkIdx[i]; if (n === undefined) continue;
      S.pk.bk[n] = Math.max(0, S.pk.bk[n] - (heavy ? 2 : 1));
      const broken = S.pk.bk[n] <= 0; if (broken) pkBroken[i] = 1;
      brokeAt = { n, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, b: broken };
      break outer;
    }
  }
  emit({ k: 'sw', id: p.id, h: heavy ? 1 : 0, hit: best || brokeAt ? 1 : 0, x: r1(p.x), y: r1(p.y) });
  if (brokeAt) emit({ k: 'pkbk', i: brokeAt.n, b: brokeAt.b ? 1 : 0, x: r1(brokeAt.x), y: r1(brokeAt.y) });
  if (!best) return;
  const dx = best.x - p.x, dy = best.y - p.y, l = Math.hypot(dx, dy) || 1, K = heavy ? 780 : 540;
  impulse(best, dx / l * K, dy / l * K, heavy ? 0.3 : 0.22);
  slowPlayer(best, 0.8, 0.35);
  emit({ k: 'pkhit', a: p.id, t: best.id, x: r1(best.x), y: r1(best.y) });
}

/* ---------- PARKUR BOTLARI ---------- */
const PK_BOT = {
  kolay: { spd: 0.84, miss: 0.22, lag: 0.16, agg: 0.1, react: 0.3 },
  normal: { spd: 0.93, miss: 0.08, lag: 0.1, agg: 0.3, react: 0.18 },
  zor: { spd: 1, miss: 0.02, lag: 0.04, agg: 0.6, react: 0.1 }
};
function pkNewAI(p) { return { tgt: -1, lane: rand(-1.2, 1.2), jumpAt: 0, stuckT: 0, bestP: p.x, chk: 0, swingT: 0, faceT: 0 }; }
function pkBotUpdate(p, dt) {
  const ai = p.ai || (p.ai = pkNewAI(p)), inp = p.input, D = PK_BOT[S.cfg.diff] || PK_BOT.normal, NV = PKNAV;
  inp.mvx = 0; inp.mvy = 0; inp.fire = false; inp.alt = false; inp.use = false; inp.walk = false; inp.crouch = false;
  if (!p.alive || S.phase === 'over' || !NV) return;
  if (S.phase === 'buy' || S.pk.fin[p.id]) {
    p.ang = rotToward(p.ang, 0, 3 * dt); inp.ang = p.ang; inp.pitch = 0;
    if (S.pk.fin[p.id] && p._emoAt === undefined) { p._emoAt = S.time + rand(0.3, 1.2); p._emoE = pick([2, 5, 1]); }
    if (p._emoAt && S.time >= p._emoAt) { p._emoAt = 0; hostEmote(p, p._emoE); }
    return;
  }
  p._emoAt = undefined;
  const g = pkGround(p.x, p.y), onG = g > PK_VOID && p.jz <= g + 0.6 && p.jvz <= 0;
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE), u = ty * MW + tx;
  const jump = () => { if (!onG || S.time < ai.jumpAt) return; if (Math.random() < D.miss) { ai.jumpAt = S.time + D.lag * 3; return; } inp.jc = p.lastJc + 1; ai.jumpAt = S.time + 0.25; };
  // hedef karo: bitişe uzaklık alanında en iyi komşu (botlar kendi şeritlerine biraz yayılır)
  if (onG && tx >= 0 && ty >= 0 && tx < MW && ty < MH && NV.ok[u] && (ai.tgt < 0 || ai.from !== u || S.time > ai.chk)) {
    let bv = -1, bs = 1e9, bk = 0;
    for (const e of NV.out[u]) {
      const v = NV.to[e], vy = (v / MW) | 0, bias = Math.abs(vy - (PKMAP.cy + ai.lane)) * 0.06;
      const sc = NV.cost[e] + NV.dist[v] + bias + (S.players.some(o => o !== p && o.alive && Math.abs(o.x - ((v % MW) + 0.5) * TILE) < 40 && Math.abs(o.y - (vy + 0.5) * TILE) < 40) ? 0.8 : 0);
      if (sc < bs) { bs = sc; bv = v; bk = NV.kind[e]; }
    }
    ai.tgt = bv; ai.kind = bk; ai.from = u; ai.chk = S.time + D.react;
  }
  let gx = p.x + 200, gy = p.y;
  if (ai.tgt >= 0) {
    gx = (ai.tgt % MW + 0.5) * TILE; gy = (((ai.tgt / MW) | 0) + 0.5) * TILE;
    // düz yürüme adımlarında bir adım ileriye bak (daha akıcı rota)
    if (ai.kind === 0 && NV.ok[ai.tgt]) { let b2 = -1, s2 = 1e9; for (const e of NV.out[ai.tgt]) if (NV.kind[e] === 0 && NV.cost[e] + NV.dist[NV.to[e]] < s2) { s2 = NV.cost[e] + NV.dist[NV.to[e]]; b2 = NV.to[e]; } if (b2 >= 0) { gx = lerp(gx, (b2 % MW + 0.5) * TILE, 0.5); gy = lerp(gy, (((b2 / MW) | 0) + 0.5) * TILE, 0.5); } }
  }
  let dx = gx - p.x, dy = gy - p.y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
  // önünde barikat: dur, dön ve kes
  const ahead = (d, a) => { const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d, X = Math.floor(x / TILE), Y = Math.floor(y / TILE); return { X, Y, t: tileAt(X, Y), i: Y * MW + X }; };
  const mvA = Math.atan2(dy, dx);
  const bA = ahead(PR + 30, mvA);
  let face = mvA;
  if (bA.t === T_BREAK && !pkBroken[bA.i]) { face = Math.atan2((bA.Y + 0.5) * TILE - p.y, (bA.X + 0.5) * TILE - p.x); if (Math.abs(angDiff(p.ang, face)) < 0.4) inp.fire = true; }
  // zıplama kararları: önde boşluk, yüksek blok
  if (onG) {
    const a1 = ahead(PR + 6 + Math.hypot(p.vx, p.vy) * 0.02, mvA);
    if (a1.t === T_PIT) jump();
    else { const h = pkTileTop(a1.X, a1.Y); if (h < 1e8 && h > g + PK_STEP && h <= g + 36) jump(); }
    // dönen çubuk yaklaşıyorsa
    for (const s of PKMAP.sw) {
      const ddx = p.x - s.x, ddy = p.y - s.y, d = Math.hypot(ddx, ddy); if (d > s.r + PR + 30 || d < 30) continue;
      const pa = Math.atan2(ddy, ddx), a = pkSweepAng(s, S.time);
      let del = ((pa - a) * Math.sign(s.w)) % Math.PI; if (del < 0) del += Math.PI;
      if (del / Math.abs(s.w) < 0.2 + D.lag) jump();
    }
  }
  // rakibe kılıç (yakınsa ve önündeyse)
  if (!inp.fire && S.time > ai.swingT) {
    for (const o of S.players) {
      if (o === p || !o.alive || S.pk.fin[o.id]) continue;
      const d = dist(p.x, p.y, o.x, o.y); if (d > 80 + PR) continue;
      if (Math.random() < D.agg * dt * 3) { face = Math.atan2(o.y - p.y, o.x - p.x); inp.fire = true; ai.swingT = S.time + rand(1.8, 3.5); }
      break;
    }
  }
  p.ang = rotToward(p.ang, face, 14 * dt); p.pitch = 0;
  inp.mvx = dx * D.spd; inp.mvy = dy * D.spd;
  if (bA.t === T_BREAK && !pkBroken[bA.i]) { inp.mvx *= 0.2; inp.mvy *= 0.2; }
  // takılma: 3 sn ilerleyemezse yana kay + zıpla
  if (p.x > ai.bestP + 20) { ai.bestP = p.x; ai.stuckT = 0; } else if ((ai.stuckT += dt) > 3) { ai.stuckT = 1.5; ai.lane = rand(-2, 2); ai.tgt = -1; jump(); inp.mvy += rand(-1, 1); }
  inp.ang = p.ang; inp.pitch = 0;
}
