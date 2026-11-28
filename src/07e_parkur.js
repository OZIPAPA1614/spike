/* =====================================================================
   07e · PARKUR GÖRÜNTÜSÜ: havada süzülen pist geometrisi, engellerin
        çizimi (barikat, dönen çubuk, bayraklar, bitiş kapısı), parkur
        HUD'u (sıralama, ilerleme çubuğu, geri sayım), olaylar, raunt öncesi
        kamera uçuşu ve maç sonu tablosu
   ===================================================================== */
const PK_DEPTH = 70; // pist platformunun kalınlığı (boşluğa bakınca görünen yan yüzler)
function pkFloorCanvas(th) {
  const F = th.floor;
  return canvasOf(256, 256, (c, w, h) => {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { c.fillStyle = (i + j) % 2 ? F.floor[1] : F.floor[0]; c.fillRect(i * 128, j * 128, 128, 128); }
    noiseFill(c, w, h, 900, 0.05);
    c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 2; for (let k = 0; k <= 2; k++) { c.beginPath(); c.moveTo(k * 128, 0); c.lineTo(k * 128, h); c.moveTo(0, k * 128); c.lineTo(w, k * 128); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 2; for (let k = 0; k < 2; k++) { c.beginPath(); c.moveTo(k * 128 + 2, 0); c.lineTo(k * 128 + 2, h); c.moveTo(0, k * 128 + 2); c.lineTo(w, k * 128 + 2); c.stroke(); }
  });
}
const pkFlatT = t => t === T_FLOOR || t === T_ATK || t === T_PAD || t === T_BOOST || t === T_CHECK || t === T_FINISH || t === T_BREAK;
function buildPkWorld() {
  for (const id of AGENT_IDS) AGCOL[id] = hexRGB(AGENTS[id].color);
  const S8 = 160, top = (x, y) => { const t = tileAt(x, y); if (x < 0 || y < 0 || x >= MW || y >= MH || t === T_PIT) return -PK_DEPTH; if (t === T_WALL) return 1e9; return PK_TOP[t] || 0; };
  const isPit = (x, y) => x < 0 || y < 0 || x >= MW || y >= MH || tileAt(x, y) === T_PIT;
  const tint = { [T_ATK]: [1.18, 0.78, 0.8], [T_CHECK]: [0.72, 1.12, 1.1], [T_BOOST]: [1.3, 1.02, 0.55], [T_PAD]: [0.6, 1.15, 1.45] };
  const side = [0.52, 0.52, 0.58], tr = THEME.trim || [0.35, 0.9, 1];
  const fl = GB(), lo = GB(), wa = GB(), gl = GB();
  const N4 = [[0, 1, 0, 0, 1], [0, -1, 0, 0, -1], [1, 0, 1, 0, 0], [-1, 0, -1, 0, 0]]; // dx, dy, nx, ny, nz
  const sideQuad = (g, x, y, d, h0, h1, c0, c1) => {
    const X = x * TILE, Z = y * TILE, X2 = X + TILE, Z2 = Z + TILE, [dx, dy] = d;
    if (dy === 1) gquad(g, [X, h0, Z2], [X2, h0, Z2], [X2, h1, Z2], [X, h1, Z2], [0, 0, 1], c0, c1, [X / S8, h0 / S8, X2 / S8, h0 / S8, X2 / S8, h1 / S8, X / S8, h1 / S8]);
    else if (dy === -1) gquad(g, [X2, h0, Z], [X, h0, Z], [X, h1, Z], [X2, h1, Z], [0, 0, -1], c0, c1, [X2 / S8, h0 / S8, X / S8, h0 / S8, X / S8, h1 / S8, X2 / S8, h1 / S8]);
    else if (dx === 1) gquad(g, [X2, h0, Z2], [X2, h0, Z], [X2, h1, Z], [X2, h1, Z2], [1, 0, 0], c0, c1, [Z2 / S8, h0 / S8, Z / S8, h0 / S8, Z / S8, h1 / S8, Z2 / S8, h1 / S8]);
    else gquad(g, [X, h0, Z], [X, h0, Z2], [X, h1, Z2], [X, h1, Z], [-1, 0, 0], c0, c1, [Z / S8, h0 / S8, Z2 / S8, h0 / S8, Z2 / S8, h1 / S8, Z / S8, h1 / S8]);
  };
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const t = grid[y * MW + x]; if (t === T_PIT) continue;
    const X = x * TILE, Z = y * TILE, X2 = X + TILE, Z2 = Z + TILE;
    if (t === T_WALL) { // sütun / duvar: platform altından yukarıya
      const Hh = WALL_H, s = 80;
      gquad(wa, [X, Hh, Z2], [X2, Hh, Z2], [X2, Hh, Z], [X, Hh, Z], [0, 1, 0], [0.45, 0.48, 0.54], [0.45, 0.48, 0.54], [X / s, Z2 / s, X2 / s, Z2 / s, X2 / s, Z / s, X / s, Z / s]);
      for (const d of N4) if (tileAt(x + d[0], y + d[1]) !== T_WALL || isPit(x + d[0], y + d[1])) sideQuad(wa, x, y, d, -PK_DEPTH, Hh, [0.55, 0.58, 0.64], [1, 1, 1]);
      continue;
    }
    const h = PK_TOP[t] || 0;
    if (pkFlatT(t)) {
      if (t === T_FINISH) { // dama desenli bitiş çizgisi
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const c = (i + j) % 2 ? [1.55, 1.55, 1.55] : [0.18, 0.18, 0.2], a = X + i * 20, b = Z + j * 20; gquad(fl, [a, 0, b + 20], [a + 20, 0, b + 20], [a + 20, 0, b], [a, 0, b], [0, 1, 0], c, c, [a / S8, (b + 20) / S8, (a + 20) / S8, (b + 20) / S8, (a + 20) / S8, b / S8, a / S8, b / S8]); }
      } else { const c = tint[t] || [1, 1, 1]; gquad(fl, [X, 0, Z2], [X2, 0, Z2], [X2, 0, Z], [X, 0, Z], [0, 1, 0], c, c, [X / S8, Z2 / S8, X2 / S8, Z2 / S8, X2 / S8, Z / S8, X / S8, Z / S8]); }
      for (const d of N4) if (isPit(x + d[0], y + d[1])) sideQuad(fl, x, y, d, -PK_DEPTH, 0, [0.3, 0.3, 0.34], side);
    } else if (h > 0) { // zıplanan bloklar
      const k = t === T_H1 ? 1 : t === T_H2 ? 0.9 : 0.8, c = [k, k, k];
      gquad(lo, [X, h, Z2], [X2, h, Z2], [X2, h, Z], [X, h, Z], [0, 1, 0], [k * 1.12, k * 1.12, k * 1.12], [k * 1.12, k * 1.12, k * 1.12]);
      for (const d of N4) { const nh = top(x + d[0], y + d[1]); if (nh < h) sideQuad(lo, x, y, d, Math.max(-PK_DEPTH, nh), h, [k * 0.6, k * 0.6, k * 0.64], c); }
      // üst kenar ışık şeridi
      for (const d of N4) if (top(x + d[0], y + d[1]) < h) pkEdgeStrip(gl, x, y, d, h + 0.6, [tr[0] * 0.5, tr[1] * 0.5, tr[2] * 0.5]);
    }
    if (pkFlatT(t)) for (const d of N4) if (isPit(x + d[0], y + d[1])) pkEdgeStrip(gl, x, y, d, 0.7, [tr[0] * 0.6, tr[1] * 0.6, tr[2] * 0.6]);
    if (t === T_BOOST) { const cx = X + 40, cz = Z + 40, c = [1, 0.62, 0.12]; for (const o of [-14, 10]) { gquad(gl, [cx + o - 12, 0.9, cz - 22], [cx + o - 4, 0.9, cz - 22], [cx + o + 14, 0.9, cz], [cx + o + 6, 0.9, cz], [0, 1, 0], c, c); gquad(gl, [cx + o + 6, 0.9, cz], [cx + o + 14, 0.9, cz], [cx + o - 4, 0.9, cz + 22], [cx + o - 12, 0.9, cz + 22], [0, 1, 0], c, c); } }
    if (t === T_PAD) { const c = [0.25, 0.85, 1]; for (const d of N4) pkEdgeStrip(gl, x, y, d, 0.9, c, 7); const m = 22; gquad(gl, [X + m, 0.9, Z2 - m], [X2 - m, 0.9, Z2 - m], [X2 - m, 0.9, Z + m], [X + m, 0.9, Z + m], [0, 1, 0], [0.12, 0.4, 0.5], [0.12, 0.4, 0.5]); }
    if (t === T_CHECK) gquad(gl, [X, 0.8, Z2], [X2, 0.8, Z2], [X2, 0.8, Z], [X, 0.8, Z], [0, 1, 0], [0.04, 0.22, 0.2], [0.04, 0.22, 0.2]);
  }
  mkMesh('floor', fl); mkMesh('lows', lo); mkMesh('walls', wa); mkMesh('pkglow', gl);
  for (const n of ['trim', 'crates', 'water', 'decor', 'decorEm', 'props']) mkMesh(n, GB());
  buildSkyMesh();
  // başlangıç bariyeri (geri sayım bitene kadar)
  BARRIERS = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (grid[y * MW + x] !== T_ATK) continue;
    const X = x * TILE, Z = y * TILE;
    const e = (nx, ny, x1, z1, x2, z2) => { const n = tileAt(nx, ny); if (n !== T_ATK && n !== T_WALL && n !== T_PIT) BARRIERS.push([x1, z1, x2, z2, T_ATK]); };
    e(x + 1, y, X + TILE, Z, X + TILE, Z + TILE);
  }
}
function pkEdgeStrip(g, x, y, d, hh, c, wdt) {
  const X = x * TILE, Z = y * TILE, X2 = X + TILE, Z2 = Z + TILE, w = wdt || 3, [dx, dy] = d;
  if (dy === 1) gquad(g, [X, hh, Z2], [X2, hh, Z2], [X2, hh, Z2 - w], [X, hh, Z2 - w], [0, 1, 0], c, c);
  else if (dy === -1) gquad(g, [X, hh, Z + w], [X2, hh, Z + w], [X2, hh, Z], [X, hh, Z], [0, 1, 0], c, c);
  else if (dx === 1) gquad(g, [X2 - w, hh, Z2], [X2, hh, Z2], [X2, hh, Z], [X2 - w, hh, Z], [0, 1, 0], c, c);
  else gquad(g, [X, hh, Z2], [X + w, hh, Z2], [X + w, hh, Z], [X, hh, Z], [0, 1, 0], c, c);
}
/* her karede: ışık şeritleri, barikatlar, dönen çubuklar, kontrol bayrakları, bitiş kapısı */
function drawPkDynamic(t, me) {
  const m = PKMAP; if (!m) return;
  const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1], pulse = 0.75 + 0.25 * Math.sin(t * 4);
  QR('pkglow', 0, 0, 0, I3, 1, 1, 1, [pulse * 1.6, pulse * 1.6, pulse * 1.6, 1], { lit: 0, add: true });
  const cx = GLX.cam[0], cz = GLX.cam[2], far = (GLX.fog[1] || 5000) + 200, near = (x, z) => Math.abs(x - cx) < far && Math.abs(z - cz) < far;
  // barikatlar (kırılmamış): sandık dokusu, hasar aldıkça kararır ve küçülür
  m.brk.forEach((i, n) => {
    if (pkBroken[i]) return;
    const x = (i % MW + 0.5) * TILE, z = (((i / MW) | 0) + 0.5) * TILE; if (!near(x, z)) return;
    const hp = S.pk && S.pk.bk ? S.pk.bk[n] : 3, k = hp >= 3 ? 1 : hp === 2 ? 0.8 : 0.6, sh = hp >= 3 ? 0 : (3 - hp) * 3;
    Q('box', x, 48, z, (hp < 3 ? 0.04 * (3 - hp) : 0), 0, TILE - 6 - sh, 96 - sh, TILE - 6 - sh, [k, k * 0.95, k * 0.9, 1], { tex: GLX.tex.crate });
    Q('box', x, 97 - sh, z, 0, 0, TILE - 2 - sh, 3, TILE - 2 - sh, [1, 0.6, 0.15, 1], { lit: 0, em: [0.5, 0.25, 0.05] });
  });
  // dönen çubuklar (çift kollu): kırmızı-beyaz şeritli kol + dönen başlık
  const tt = pkTime();
  for (const s of m.sw) {
    if (!near(s.x, s.y)) continue;
    const a = pkSweepAng(s, tt), ux = Math.cos(a), uz = Math.sin(a), seg = 8, L = s.r * 2 / seg;
    for (let k = 0; k < seg; k++) { const o = -s.r + L * (k + 0.5); Q('box', s.x + ux * o, s.h, s.y + uz * o, a, 0, L, 10, 12, k % 2 ? [0.95, 0.95, 0.95, 1] : [0.92, 0.16, 0.18, 1], { em: k % 2 ? [0.1, 0.1, 0.1] : [0.35, 0.03, 0.04] }); }
    Q('cyl', s.x, s.h, s.y, a, 0, 30, 18, 30, [0.25, 0.27, 0.3, 1]);
    Q('sphere', s.x + ux * s.r, s.h, s.y + uz * s.r, 0, 0, 14, 14, 14, [1, 0.85, 0.2, 1], { lit: 0, em: [0.6, 0.45, 0.05] });
    Q('sphere', s.x - ux * s.r, s.h, s.y - uz * s.r, 0, 0, 14, 14, 14, [1, 0.85, 0.2, 1], { lit: 0, em: [0.6, 0.45, 0.05] });
  }
  // kontrol noktası bayrakları
  const myCp = me ? me.pkCp | 0 : 0;
  m.cps.forEach((c, n) => {
    if (n === 0) return;
    const x = (c.x + 1.5) * TILE, ys = c.pts.map(p => p[1]), y0 = (Math.min(...ys) - 1) * TILE, y1 = (Math.max(...ys) + 2) * TILE; if (!near(x, (y0 + y1) / 2)) return;
    const col = n <= myCp ? [0.3, 1, 0.55, 1] : [0.2, 0.9, 0.85, 1];
    for (const z of [y0 + 6, y1 - 6]) Q('cyl', x, 80, z, 0, 0, 7, 160, 7, [0.85, 0.88, 0.92, 1]);
    Q('box', x, 150, (y0 + y1) / 2, 0, 0, 6, 22, y1 - y0 - 12, col, { lit: 0, em: [col[0] * 0.35, col[1] * 0.35, col[2] * 0.35] });
  });
  // bitiş kapısı: iki kule + dama desenli pankart
  { const x = (m.finX + 1) * TILE, z0 = (m.cy - 4.5) * TILE, z1 = (m.cy + 5.5) * TILE;
    if (near(x, (z0 + z1) / 2)) {
      for (const z of [z0 - 10, z1 + 10]) { Q('box', x, 110, z, 0, 0, 26, 220, 26, [0.92, 0.92, 0.95, 1]); Q('box', x, 224, z, 0, 0, 30, 8, 30, [0.96, 0.77, 0.32, 1], { lit: 0, em: [0.5, 0.38, 0.1] }); }
      const n = 12, L = (z1 - z0 + 20) / n;
      for (let k = 0; k < n; k++) for (let r = 0; r < 2; r++) { const c = (k + r) % 2 ? [0.95, 0.95, 0.95, 1] : [0.08, 0.08, 0.1, 1]; Q('box', x, 196 + r * 14, z0 - 10 + L * (k + 0.5), 0, 0, 6, 14, L, c, { em: (k + r) % 2 ? [0.25, 0.25, 0.25] : [0, 0, 0] }); }
    } }
}

/* ---------- raunt öncesi kamera uçuşu (bitişten başlangıca, sonra oyuncunun gözüne) ---------- */
function pkCineShots() {
  const m = PKMAP, cy = (m.cy + 0.5) * TILE, fx = m.finX * TILE, L = fx - m.startX * TILE;
  return [
    { d: 2.6, p0: [fx + 500, 760, cy + 1000], p1: [fx - L * 0.45, 640, cy + 900], l0: [fx - 900, 0, cy], l1: [fx - L * 0.45 - 1400, 0, cy], lin: true,
      title: m.name, sub: 'PARKUR ' + S.round + ' / ' + PK_ROUNDS + ' · ' + Math.round(L / 40) + ' m · ' + m.desc, col: PAL.gold },
    { d: PK_CINE - 2.6, me: true }
  ];
}
/* ---------- olaylar ---------- */
function pkEvent(ev, me) {
  switch (ev.k) {
    case 'round': {
      const m = PKMAP; LOOK.yaw = 0; LOOK.pitch = 0;
      showMsg('PARKUR ' + ev.n + ' / ' + PK_ROUNDS + ' · ' + (m ? m.name : ''), 'Bitişe ilk varan raundu alır · kılıçla itebilir, barikatları kırabilirsin', PAL.gold, 3);
      AU.play('round'); UIS.pings.length = 0;
      if (G.running && m) cineStart('pk', pkCineShots());
      return true;
    }
    case 'go': showMsg(null, 'KOŞ! — BARİYER KALKTI', PAL.gold); AU.play('lockbeep'); UIS.goT = 1.2; return true;
    case 'pkcp': if (ev.id === G.myId) { showMsg(null, 'KONTROL NOKTASI ' + ev.n, PAL.teal); AU.play('card'); } return true;
    case 'pkfall':
      addFx({ type: 'ring', x: ev.x, y: ev.y, r0: 10, r1: 70, c: [0.3, 0.9, 1], t: 0.6, dur: 0.6 });
      if (ev.id === G.myId) { showMsg(null, ev.cp ? 'DÜŞTÜN — KONTROL NOKTASI ' + ev.cp : 'DÜŞTÜN — BAŞTAN DEVAM', PAL.red); AU.play('hurt'); LOOK.yaw = 0; UIS.dmgFlash = 0.35; }
      return true;
    case 'pkfin': {
      const p = S.pmap[ev.id];
      if (ev.id === G.myId) { showMsg(ev.pl === 1 ? 'BİRİNCİ GELDİN!' : 'BİTİRDİN · ' + ev.pl + '.', fmtTime2(ev.t), ev.pl === 1 ? PAL.gold : PAL.teal, 3); AU.play('win'); }
      else if (p) showMsg(null, p.name + ' BİTİRDİ · ' + ev.pl + '. · ' + fmtTime2(ev.t), ev.pl === 1 ? PAL.gold : PAL.white);
      return true;
    }
    case 'pkend': {
      const w = S.pmap[ev.w];
      if (ev.w === G.myId) { showMsg('RAUNDU KAZANDIN!', ev.r === 'time' ? 'Süre doldu — en öndeydin' : 'Bitişe ilk sen vardın', PAL.gold, 4); AU.play('win'); }
      else { showMsg(w ? w.name + ' RAUNDU KAZANDI' : 'RAUNT BİTTİ', ev.r === 'time' ? 'Süre doldu — en öndeki kazandı' : 'Bitişe ilk o vardı', PAL.red, 4); AU.play('lose'); }
      return true;
    }
    case 'pkhit':
      if (ev.t === G.myId) { UIS.shake = Math.max(UIS.shake, 6); UIS.dmgFlash = Math.min(0.4, UIS.dmgFlash + 0.2); const a = S.pmap[ev.a]; showMsg(null, a ? a.name + ' SENİ İTTİ!' : 'DÖNEN ÇUBUK SENİ SAVURDU!', PAL.red); }
      else if (ev.a === G.myId) { UIS.hit = 0.22; UIS.hitHs = false; }
      addFx({ type: 'ring', x: ev.x, y: ev.y, r0: 6, r1: 40, c: [1, 0.85, 0.3], t: 0.35, dur: 0.35 });
      return true;
    case 'pkbk': {
      if (G.mode === 'client' && S.pk && PKMAP && PKMAP.brk[ev.i] !== undefined) { if (ev.b) { S.pk.bk[ev.i] = 0; pkBroken[PKMAP.brk[ev.i]] = 1; } else S.pk.bk[ev.i] = Math.max(1, (S.pk.bk[ev.i] || 3) - 1); }
      const n = ev.b ? 16 : 6;
      for (let i = 0; i < n; i++) addFx({ type: 'part', x: ev.x, y: ev.y, h: 40, vx: rand(-200, 200), vy: rand(-200, 200), vh: rand(80, 300), g: 800, c: [0.62, 0.45, 0.28, 1], s: ev.b ? 9 : 6, t: 0.8, dur: 0.8 });
      AU.play(ev.b ? 'boom' : 'swordhit', ev.x, ev.y, ev.b ? 0.5 : 0.8);
      return true;
    }
    case 'over': return true;
  }
  return false;
}
function fmtTime2(s) { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); }

/* ---------- HUD ---------- */
function pkPlace(p) { return pkStandings().indexOf(p) + 1; }
function drawPkHUD(dt, me, v) {
  drawScreenFX(dt, me, v);
  drawPkTags(me, v);
  const m = PKMAP, st = pkStandings(), cx = W / 2, sm = IS_TOUCH ? 0.85 : 1;
  // üst orta: raunt, harita, süre
  const ty0 = IS_TOUCH ? 46 : 10; // dokunmatikte üstteki düğme sırasının altında
  panel(cx - 120, ty0, 240, 52, 0.9);
  let tt = S.phase === 'buy' ? '—' : S.phase === 'live' ? fmtTime2(S.time - (S.pk ? S.pk.t0 : 0)) : '—';
  txt(tt, cx, ty0 + 20, 24, PAL.white, 'center');
  txt('PARKUR ' + S.round + '/' + PK_ROUNDS + ' · ' + m.name, cx, ty0 + 42, 11, PAL.gold, 'center');
  if (S.phase === 'live' && S.phaseT < 30) txt('KALAN ' + Math.ceil(S.phaseT) + ' sn', cx, ty0 + 64, 12, PAL.red, 'center');
  // sol üst: sıralama (bu raunt) + raunt galibiyetleri
  const x0 = 12, y0 = IS_TOUCH ? 48 : 12, rows = Math.min(st.length, IS_TOUCH ? 6 : 10), rw = 220 * sm;
  panel(x0, y0, rw, 26 + rows * 21 * sm, 0.82);
  txt('SIRALAMA', x0 + 10, y0 + 13, 11, PAL.dim); txt('🏆', x0 + rw - 12, y0 + 13, 11, PAL.dim, 'right');
  st.slice(0, rows).forEach((p, i) => {
    const y = y0 + 34 + i * 21 * sm, mine = p.id === G.myId, fin = S.pk && S.pk.fin[p.id];
    if (mine) { ctx.fillStyle = 'rgba(245,196,81,0.16)'; ctx.fillRect(x0 + 2, y - 10, rw - 4, 20); }
    txt((i + 1) + '.', x0 + 10, y, Math.round(13 * sm), i === 0 ? PAL.gold : PAL.white);
    txt(p.name.slice(0, 13), x0 + 34, y, Math.round(13 * sm), mine ? PAL.gold : AGENTS[p.agent].color, 'left', mine ? 'bold' : 'normal');
    txt(fin ? fmtTime2(fin) : Math.round((p.pkP || 0) * 100) + '%', x0 + rw - 40, y, Math.round(12 * sm), fin ? PAL.green : PAL.dim, 'right', 'normal');
    txt(String(p.pkW || 0), x0 + rw - 12, y, Math.round(13 * sm), PAL.gold, 'right');
  });
  if (me && rows < st.length && st.indexOf(me) >= rows) txt('… ' + (st.indexOf(me) + 1) + '. SEN', x0 + 10, y0 + 34 + rows * 21 * sm, 12, PAL.gold);
  // alt: pist ilerleme çubuğu (kontrol noktaları + herkes)
  const bw = IS_TOUCH ? Math.min(W * 0.4, 420) : Math.min(W * 0.62, 760), bx = cx - bw / 2, by = IS_TOUCH ? ty0 + 76 : H - 40; // dokunmatikte alttaki düğmelerle çakışmasın
  ctx.fillStyle = 'rgba(15,25,35,0.85)'; ctx.fillRect(bx - 8, by - 16, bw + 16, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(bx, by - 2, bw, 4);
  const X = tx => bx + bw * clamp((tx - m.startX) / (m.finX - m.startX), 0, 1);
  m.cps.forEach((c, n) => { if (!n) return; const px = X(c.x); ctx.fillStyle = me && n <= (me.pkCp | 0) ? PAL.green : PAL.teal; ctx.fillRect(px - 1, by - 7, 2, 14); });
  for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#fff' : '#111'; ctx.fillRect(bx + bw - 2, by - 8 + k * 4, 6, 4); }
  for (const p of S.players) { if (p === me) continue; circle(X(p.x / TILE), by, 4, AGENTS[p.agent].color, '#0b121a', 1); }
  if (me) { const px = X(me.x / TILE); circle(px, by, 7, PAL.gold, '#000', 2); txt(Math.round((me.pkP || 0) * 100) + '%', px, by - 18, 12, PAL.gold, 'center'); }
  // geri sayım (sinematikten sonra) ve KOŞ!
  if (S.phase === 'buy' && !CINE.on) {
    const n = Math.ceil(S.phaseT), big = n <= 3 ? String(n) : 'HAZIR';
    const k = 1 - (S.phaseT - Math.floor(S.phaseT));
    ctx.save(); ctx.globalAlpha = 0.9; txt(big, cx, H * 0.38, Math.round((n <= 3 ? 110 : 64) * (1 + k * 0.15)), n <= 3 ? PAL.gold : PAL.white, 'center'); ctx.restore();
    txt('Bitişe ilk varan raundu alır', cx, H * 0.38 + 70, 15, PAL.white, 'center', 'normal');
  }
  if (UIS.goT > 0) { UIS.goT -= dt; ctx.save(); ctx.globalAlpha = clamp(UIS.goT, 0, 1); txt('KOŞ!', cx, H * 0.38, 120, PAL.green, 'center'); ctx.restore(); }
  // ipucu: önde barikat
  if (me && me.alive && S.phase === 'live' && !(S.pk && S.pk.fin[me.id])) {
    let near = false;
    for (let d = 20; d <= 140 && !near; d += 20) { const X2 = Math.floor((me.x + Math.cos(LOOK.yaw) * d) / TILE), Y2 = Math.floor((me.y + Math.sin(LOOK.yaw) * d) / TILE), i = Y2 * MW + X2; if (tileAt(X2, Y2) === T_BREAK && !pkBroken[i]) near = true; }
    if (near) { const h = padOn() ? 'BARİKAT — ' + padGlyph('fire') + ' ile kılıçla kır (' + padGlyph('alt') + ': güçlü darbe)' : IS_TOUCH ? 'BARİKAT — ATEŞ ile kılıçla kır' : 'BARİKAT — sol tık ile kılıçla kır (sağ tık: güçlü darbe)'; ctx.font = 'bold 14px ' + FONT; const tw = ctx.measureText(tl(h)).width + 30; panel(cx - tw / 2, H - 120, tw, 26, 0.8); txt(h, cx, H - 107, 14, PAL.gold, 'center'); }
  }
  drawCenterMsgs(dt);
  drawVoiceList(me);
  drawChat(dt, me);
  drawEmotes(dt, me, v);
  drawCrosshair(me, v);
  if (UI.board) drawPkBoard(me);
  if (G.mode === 'client') txt('PING ' + NET.ping + 'ms', W - 14, H - 12, 12, PAL.dim, 'right', 'normal');
}
/* yarışçıların başının üstünde isim ve sıra */
function drawPkTags(me, v) {
  if (!GLX.ok) return;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const st = pkStandings(), drawn = [];
  // yakından uzağa; üst üste binen etiketler atlanır (kalabalıkta okunur kalsın)
  const list = S.players.filter(p => p.alive && p !== v).map(p => [p, dist(v.x, v.y, p.x, p.y)]).sort((a, b) => a[1] - b[1]);
  for (const [p, d] of list) {
    if (d > 2200) break;
    const s = worldToScreen(p.x, P_TOP + 18 + (p.jz || 0), p.y); if (!s) continue;
    const sc = clamp(1.3 - d / 1600, 0.6, 1.1), pl = st.indexOf(p) + 1;
    ctx.font = 'bold ' + Math.round(12 * sc) + 'px ' + FONT;
    const label = pl + '. ' + p.name, tw = ctx.measureText(label).width, th = 14 * sc;
    if (drawn.some(r => Math.abs(r[0] - s[0]) < (r[2] + tw) / 2 && Math.abs(r[1] - s[1]) < th)) continue;
    drawn.push([s[0], s[1], tw]);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(label, s[0] + 1, s[1] + 1);
    ctx.fillStyle = pl === 1 ? PAL.gold : AGENTS[p.agent].color; ctx.fillText(label, s[0], s[1]);
  }
}
function drawPkBoard(me) {
  const rows = pkMatchRank(), w = Math.min(640, W - 40), x = W / 2 - w / 2, h = 70 + rows.length * 30 + 20, y = H / 2 - h / 2;
  panel(x, y, w, h, 0.94);
  txt('PARKUR · GENEL SIRALAMA', x + 20, y + 22, 18, PAL.white);
  txt('RAUNT ' + S.round + ' / ' + PK_ROUNDS, x + w - 20, y + 22, 16, PAL.gold, 'right');
  for (const [c, cx] of [['#', 20], ['OYUNCU', 60], ['RAUNT', w - 230], ['İLERLEME', w - 150], ['SÜRE', w - 60]]) txt(c, x + cx, y + 50, 11, PAL.dim);
  rows.forEach((p, i) => {
    const ry = y + 66 + i * 30, mine = p.id === G.myId;
    ctx.fillStyle = mine ? 'rgba(245,196,81,0.12)' : 'rgba(255,255,255,0.04)'; ctx.fillRect(x + 10, ry, w - 20, 26);
    txt(String(i + 1), x + 20, ry + 13, 14, i === 0 ? PAL.gold : PAL.white);
    txt(p.name + (p.isBot ? ' [BOT]' : '') + (mine ? '  (SEN)' : ''), x + 60, ry + 13, 13, mine ? PAL.gold : AGENTS[p.agent].color);
    txt(String(p.pkW || 0), x + w - 230, ry + 13, 14, PAL.gold);
    txt(Math.round((p.pkP || 0) * 100) + '%', x + w - 150, ry + 13, 13, PAL.white);
    txt(p.pkT ? fmtTime2(p.pkT) : '—', x + w - 60, ry + 13, 13, PAL.white);
  });
}
/* maç sonu tablosu (08_ui uiShowEnd) */
function pkShowEnd(me) {
  const rows = pkMatchRank(), champ = rows[0], win = champ && me && champ.id === me.id, place = me ? rows.indexOf(me) + 1 : 0;
  $('endTitle').textContent = win ? 'ŞAMPİYON' : place + '. OLDUN';
  $('endTitle').className = win ? 'win' : 'lose';
  $('endScore').textContent = (champ ? champ.name : '—') + ' · ' + (champ ? champ.pkW || 0 : 0) + ' raunt'; $('endScore').style.fontSize = '26px';
  $('endTable').innerHTML = '<tr><th>#</th><th>OYUNCU</th><th>RAUNT</th><th>İLERLEME</th><th>SÜRE</th></tr>' + rows.map((p, i) =>
    '<tr class="' + (me && p.id === me.id ? 'al' : 'en') + '"><td>' + (i + 1) + '</td><td>' + esc(p.name) + (i === 0 ? ' <b class="mvp">🏆</b>' : '') + (me && p.id === me.id ? ' (sen)' : '') + '</td><td>' + (p.pkW || 0) + '</td><td>' + Math.round((p.pkSum || 0) / PK_ROUNDS * 100) + '%</td><td>' + (p.pkT ? fmtTime2(p.pkT) : '—') + '</td></tr>').join('');
  return { win, draw: false };
}
