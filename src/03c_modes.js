/* =====================================================================
   03c · ARENA MODLARI (normal haritalarda, takımlı, yeniden doğmalı)
        SİLAH YARIŞI ('gg'): her öldürmede sıradaki silaha geçilir; son silah
          kılıçtır, kılıçla ilk öldüren oyuncunun takımı kazanır. Kılıçla
          öldürülen bir seviye geri düşer.
        SÜPERNOVA ('sn'): haritada parlayan enerji bölgesi belirli aralıklarla
          yer değiştirir; bölgede tek başına bulunan takım puan toplar,
          100 puana ilk ulaşan kazanır. Bölge çekişmeliyse kimse puan almaz.
        Ortak: bomba / mağaza / yetenek yok, ölünce birkaç saniyede yeniden
        doğulur (kısa doğuş koruması), süre dolarsa önde olan kazanır.
   ===================================================================== */
const GG_ORDER = ['spectre', 'vandal', 'phantom', 'operator', 'railgun', 'sheriff', 'classic', 'sword'];
const AR_TIME = 480, AR_COUNT = 5, SN_WIN = 100, SN_RATE = 0.65, SN_MOVE = 40, SN_R = 3.4 * TILE, AR_PROT = 1.8;
const AR_RESPAWN = { gg: 2.5, sn: 4 };
function arMode() { return S && S.cfg && (S.cfg.mode === 'gg' || S.cfg.mode === 'sn') ? S.cfg.mode : null; }
function arOn() { return !!arMode(); }
const AR_NAMES = { gg: 'SİLAH YARIŞI', sn: 'SÜPERNOVA' };
/* SÜPERNOVA bölge adayları: iki bölge merkezi, harita ortası ve aralarındaki noktalar */
function snSpots() {
  if (MAPDATA._snSpots) return MAPDATA._snSpots;
  const A = tc(...MAPDATA.sites.A.center), B = tc(...MAPDATA.sites.B.center), a = tc(...MAPDATA.atkCenter), d = tc(...MAPDATA.defCenter);
  const mid = { x: (a.x + d.x) / 2, y: (a.y + d.y) / 2 };
  const raw = [A, B, mid, { x: (A.x + mid.x) / 2, y: (A.y + mid.y) / 2 }, { x: (B.x + mid.x) / 2, y: (B.y + mid.y) / 2 }, { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }];
  const out = [];
  for (const p of raw) { const f = findFree(p.x, p.y, PR); if (!out.some(o => dist(o.x, o.y, f.x, f.y) < TILE * 3)) out.push({ x: r1(f.x), y: r1(f.y) }); }
  return (MAPDATA._snSpots = out);
}
/* Silah yarışı: seviyeye göre elde tutulan silah */
function ggEquip(p) {
  const wid = GG_ORDER[clamp(p.ggL | 0, 0, GG_ORDER.length - 1)], w = WEAPONS[wid];
  p.reloadT = 0; p.switchT = 0.35; p.scoped = false; p.pend = false;
  if (wid === 'sword') { p.primary = null; p.secondary = null; p.slot = 3; return; }
  if (w.slot === 1) { p.primary = wid; p.secondary = null; p.slot = 1; } else { p.primary = null; p.secondary = wid; p.slot = 2; }
  p.ammo = {}; p.ammo[wid] = { mag: w.mag, res: w.mag * 30 };
}
function arLoadout(p) {
  if (arMode() === 'gg') { ggEquip(p); return; }
  p.primary = 'vandal'; p.secondary = 'classic'; p.slot = 1; p.armor = 50;
  p.ammo = { vandal: { mag: WEAPONS.vandal.mag, res: 250 }, classic: { mag: WEAPONS.classic.mag, res: 120 } };
}
/* startRound sonunda (arena): bombasız tek uzun raunt */
function arSetup() {
  const m = arMode();
  S.phase = 'buy'; S.phaseT = AR_COUNT + INTRO_TIME;
  S.bomb = { state: 'none', carrier: null, x: 0, y: 0, t: 0, site: null, defuser: null, prog: 0, half: false };
  S.cards = null; S.rb = [];
  S.cfg.ff = false; // yeniden doğmalı modlarda takım ateşi kapalı
  S.arena = { m, sc: [0, 0], z: null, zi: -1, zt: SN_MOVE, own: -1, win: null, lead: null };
  for (const p of S.players) {
    p.hasBomb = false; p.kit = false; p.ch = { q: 0, e: 0 }; p.ult = 0;
    if (m === 'gg') p.ggL = 0;
    arLoadout(p); p.respawnAt = 0; p.prot = 0;
  }
  if (m === 'sn') snMoveZone(true);
}
function snMoveZone(first) {
  const A = S.arena, sp = snSpots();
  let i = first ? (sp.length > 2 ? 2 : 0) : randi(0, sp.length - 1);
  if (!first && sp.length > 1) while (i === A.zi) i = randi(0, sp.length - 1);
  A.zi = i; A.z = { x: sp[i].x, y: sp[i].y, r: SN_R }; A.zt = SN_MOVE;
  if (!first) { emit({ k: 'msg', big: 'BÖLGE YER DEĞİŞTİRDİ', small: 'Yeni süpernova bölgesine koş' }); emitSnd('ult', A.z.x, A.z.y); }
}
/* doğuş: takımın doğuş noktalarından, düşmanlardan en uzak olanı */
function arRespawn(p) {
  const side = sideOf(p.team), list = MAPDATA.spawns[side];
  let best = null, bd = -1;
  for (const s of shuffle(list.slice()).slice(0, 6)) {
    const c = tc(s[0], s[1]); let nd = 1e9;
    for (const o of S.players) if (o.alive && o.team !== p.team) nd = Math.min(nd, dist(o.x, o.y, c.x, c.y));
    if (nd > bd) { bd = nd; best = c; }
  }
  const f = findFree(best.x, best.y, PR);
  p.alive = true; p.hp = 100; p.armor = 0; p.st = {}; p.imp = null; p.vx = 0; p.vy = 0; p.jz = 0; p.jvz = 0; p.crouch = false; p.dotAcc = {};
  p.fireCD = 0; p.bloom = 0; p.zoneSlow = 1; p.zoneFire = 1; p.rebirth = null; p.respawnAt = 0; p.prot = S.time + AR_PROT;
  setPos(p, f.x, f.y);
  p.ang = Math.atan2(MAPDATA.sites.A.center[1] * TILE - f.y, MAPDATA.sites.A.center[0] * TILE - f.x); p.input = blankInput(); p.input.ang = p.ang; p.input.fp = p.lastFp; p.input.jc = p.lastJc;
  arLoadout(p);
  S.corpses = S.corpses.filter(c => c.id !== p.id);
  if (p.ctrl === 'bot') { const ai = newAI(p); ai.buyDone = true; p.ai = ai; }
  emitFx({ t: 'rebirth', x: r1(f.x), y: r1(f.y), x2: r1(f.x), y2: r1(f.y) });
}
/* killPlayer sonunda */
function arOnKill(t, att, src) {
  const m = arMode();
  t.respawnAt = S.time + AR_RESPAWN[m];
  if (m !== 'gg' || S.phase !== 'live') return;
  if (src === 'sword' && t.ggL > 0 && att && att.team !== t.team) { t.ggL--; emit({ k: 'msg', small: t.name + ' kılıçla bir seviye geri düştü' }); }
  if (!att || att === t || att.team === t.team) return;
  const fin = GG_ORDER.length - 1;
  if ((att.ggL | 0) >= fin) { arFinish(att.team, att.name + ' kılıçla bitirdi'); return; }
  att.ggL = (att.ggL | 0) + 1;
  if (att.alive) ggEquip(att);
  emit({ k: 'gg', p: att.id, l: att.ggL });
}
function arFinish(team, why) {
  if (S.phase === 'end' || S.phase === 'over') return;
  const A = S.arena;
  A.win = team;
  S.phase = 'end'; S.phaseT = END_TIME;
  S.score = arScores();
  S.matchWinner = team;
  S.lastResult = { win: team, reason: 'arena' };
  emit({ k: 'rend', w: team, r: 'arena', why: why || '' });
}
/* skor tablosu: sn = puanlar; gg = takımın en yüksek silah seviyesi (1..8) */
function arScores() {
  const A = S.arena;
  if (A.m === 'sn') return [Math.floor(A.sc[0]), Math.floor(A.sc[1])];
  const best = t => Math.max(0, ...S.players.filter(p => p.team === t).map(p => ggLv(p) + 1));
  return [best(0), best(1)];
}
/* ---------- ANA ADIM (host) ---------- */
function arHostTick(dt) {
  const A = S.arena, m = A.m;
  S.time += dt;
  for (const p of S.players) if (p.ctrl === 'bot') botUpdate(p, dt);
  updateZones(dt);
  for (const p of S.players) updateStatus(p, dt);
  for (const p of S.players) {
    if (!p.alive) continue;
    if (p.ctrl !== 'remote') movePlayer(p, dt, p.input);
    else p.spd = p.netMv * RUN;
  }
  separatePlayers();
  for (const p of S.players) updateCombat(p, dt);
  updateProjectiles(dt); updateDeps(dt); updateBeams(dt); updateTWalls(dt);
  updateOrbs(); updateHeal(dt); footstepsHear(dt);
  S.phaseT -= dt;
  if (S.phase === 'buy') {
    if (S.phaseT <= 0) { S.phase = 'live'; S.phaseT = AR_TIME; emit({ k: 'go' }); }
  } else if (S.phase === 'live') {
    for (const p of S.players) if (!p.alive && p.respawnAt && S.time >= p.respawnAt) arRespawn(p);
    if (m === 'sn' && A.z) {
      A.zt -= dt;
      const inZ = [0, 0];
      for (const p of S.players) if (p.alive && dist2(p.x, p.y, A.z.x, A.z.y) < A.z.r * A.z.r) inZ[p.team]++;
      A.own = inZ[0] && inZ[1] ? 2 : inZ[0] ? 0 : inZ[1] ? 1 : -1;
      if (A.own === 0 || A.own === 1) {
        const k = A.own, before = A.sc[k];
        A.sc[k] = Math.min(SN_WIN, A.sc[k] + SN_RATE * (1 + 0.2 * Math.min(3, inZ[k] - 1)) * dt);
        if (Math.floor(before / 25) !== Math.floor(A.sc[k] / 25) && A.sc[k] < SN_WIN) emit({ k: 'msg', small: (k === 0 ? 'A' : 'B') + ' takımı ' + Math.floor(A.sc[k]) + ' puana ulaştı' });
        if (A.sc[k] >= SN_WIN) arFinish(k, 'Süpernova bölgesini tuttu');
      }
      if (A.zt <= 0 && S.phase === 'live') snMoveZone(false);
    }
    S.score = arScores();
    if (S.phase === 'live' && S.phaseT <= 0) {
      const sc = arScores();
      arFinish(sc[0] > sc[1] ? 0 : sc[1] > sc[0] ? 1 : -1, 'Süre doldu');
    }
  } else if (S.phase === 'end' && S.phaseT <= 0) {
    S.phase = 'over'; S.phaseT = 0; emit({ k: 'over', w: S.matchWinner });
  }
  recordHistory();
}
/* ---------- botlar: arena hedefi ---------- */
function arGoal(p, ai) {
  const m = arMode(), A = S.arena;
  if (m === 'sn' && A && A.z) {
    if (!ai.zSpot || ai.zKey !== A.zi) { const a = Math.random() * TAU, r = Math.random() * A.z.r * 0.6; const f = findFree(A.z.x + Math.cos(a) * r, A.z.y + Math.sin(a) * r, PR); ai.zSpot = { x: f.x, y: f.y }; ai.zKey = A.zi; }
    const at = dist(p.x, p.y, ai.zSpot.x, ai.zSpot.y) < 40;
    if (at && Math.random() < 0.004) ai.zKey = -1; // bölge içinde ara sıra yer değiştir
    return { x: ai.zSpot.x, y: ai.zSpot.y, key: 'z' + A.zi + '_' + (ai.zSpot.x | 0), hold: at };
  }
  // silah yarışı: bilinen en yakın düşmana, yoksa haritada dolaş
  const ks = knownEnemies(p.team, 6);
  let best = null, bd = 1e9;
  for (const k of ks) { const d = dist(p.x, p.y, k.x, k.y); if (d < bd) { bd = d; best = k; } }
  if (best) return { x: best.x, y: best.y, key: 'hunt' + ((best.x / 160) | 0) + '_' + ((best.y / 160) | 0) };
  if (!ai.roam || dist(p.x, p.y, ai.roam.x, ai.roam.y) < 60) { const sp = snSpots(), s = sp[randi(0, sp.length - 1)], f = findFree(s.x + rand(-120, 120), s.y + rand(-120, 120), PR); ai.roam = { x: f.x, y: f.y, n: (ai.roam ? ai.roam.n : 0) + 1 }; }
  return { x: ai.roam.x, y: ai.roam.y, key: 'roam' + ai.roam.n };
}
/* ---------- görsel: bölge (dünya + mini harita) ve arayüz ---------- */
const ggLv = p => ((p.ggL !== undefined ? p.ggL : p.gl) | 0);
function snZoneCol(me) {
  const A = S.arena, mt = me ? me.team : 0;
  return !A || A.own === -1 ? [0.92, 0.9, 0.85] : A.own === 2 ? [0.96, 0.77, 0.32] : A.own === mt ? [0.12, 0.89, 0.81] : [1, 0.27, 0.33];
}
function arDrawWorld(me, t) {
  const A = S.arena; if (!A || A.m !== 'sn' || !A.z) return;
  const z = A.z, c = snZoneCol(me), pulse = 0.75 + Math.sin(t * 3) * 0.25, warn = A.zt < 6 && S.phase === 'live';
  Q('ring', z.x, 1.5, z.y, t * 0.4, 0, z.r * 2, 1, z.r * 2, [c[0], c[1], c[2], 0.9 * (warn ? (Math.sin(t * 12) > 0 ? 1 : 0.3) : 1)], { add: true, lit: 0 });
  Q('disc', z.x, 1.2, z.y, 0, 0, z.r * 2, 1, z.r * 2, [c[0], c[1], c[2], 0.1], { add: true, lit: 0 });
  Q('cyl', z.x, 520, z.y, t * 0.6, 0, 34, 1040, 34, [c[0], c[1], c[2], 0.22 * pulse], { add: true, lit: 0 });
  Q('cyl', z.x, 520, z.y, 0, 0, 10, 1040, 10, [1, 1, 1, 0.35 * pulse], { add: true, lit: 0 });
  Q('octa', z.x, 120 + Math.sin(t * 2) * 10, z.y, t * 1.5, 0, 34, 46, 34, [c[0], c[1], c[2], 0.85], { add: true, lit: 0, em: c });
}
function arDrawMinimap(P, s, me) {
  const A = S.arena; if (!A || A.m !== 'sn' || !A.z) return;
  const [px, py] = P(A.z.x, A.z.y), c = snZoneCol(me);
  circle(px, py, A.z.r * s, 'rgba(' + c.map(v => Math.round(v * 255)).join(',') + ',0.22)', 'rgba(' + c.map(v => Math.round(v * 255)).join(',') + ',0.95)', 2);
}
/* üst çubuk yerine arena paneli */
function arTopBar(me) {
  const A = S.arena, mt = me ? me.team : 0, et = 1 - mt, cx = W / 2, y = IS_TOUCH ? 46 : 10;
  const sc = A.m === 'sn' ? [Math.floor(A.sc[0]), Math.floor(A.sc[1])] : arScores();
  panel(cx - 70, y, 140, 48, 0.9);
  txt(S.phase === 'end' || S.phase === 'over' ? '—' : fmtTime(S.phaseT), cx, y + 21, 26, PAL.white, 'center');
  txt(S.phase === 'buy' ? 'HAZIRLAN' : AR_NAMES[A.m], cx, y + 40, 11, S.phase === 'buy' ? PAL.gold : PAL.dim, 'center');
  const bw = 150;
  for (const [team, dir, col] of [[mt, -1, PAL.teal], [et, 1, PAL.red]]) {
    const x0 = dir < 0 ? cx - 76 - bw : cx + 76;
    ctx.fillStyle = 'rgba(10,14,20,0.8)'; ctx.fillRect(x0, y, bw, 48);
    if (A.m === 'sn') {
      const f = clamp(sc[team] / SN_WIN, 0, 1); ctx.fillStyle = col; ctx.globalAlpha = 0.85;
      if (dir < 0) ctx.fillRect(x0 + bw * (1 - f), y + 40, bw * f, 8); else ctx.fillRect(x0, y + 40, bw * f, 8);
      ctx.globalAlpha = 1;
      txt(String(sc[team]), dir < 0 ? x0 + bw - 12 : x0 + 12, y + 20, 26, col, dir < 0 ? 'right' : 'left');
      txt(team === mt ? 'TAKIMIN' : 'RAKİP', dir < 0 ? x0 + 10 : x0 + bw - 10, y + 20, 11, PAL.dim, dir < 0 ? 'left' : 'right');
    } else {
      const best = S.players.filter(p => p.team === team).sort((a, b) => ggLv(b) - ggLv(a))[0];
      txt(sc[team] + ' / ' + GG_ORDER.length, dir < 0 ? x0 + bw - 12 : x0 + 12, y + 20, 22, col, dir < 0 ? 'right' : 'left');
      if (best) txt(best.name, dir < 0 ? x0 + bw - 12 : x0 + 12, y + 39, 11, PAL.dim, dir < 0 ? 'right' : 'left');
    }
  }
  // bilgi satırı
  let info = '';
  if (A.m === 'sn' && A.z) info = (A.own === -1 ? 'BÖLGE BOŞ' : A.own === 2 ? 'BÖLGE ÇEKİŞMELİ' : A.own === mt ? 'BÖLGE SİZDE' : 'BÖLGE RAKİPTE') + ' · yer değişimine ' + Math.max(0, Math.ceil(A.zt)) + ' sn';
  else if (A.m === 'gg' && me) { const l = ggLv(me), w = GG_ORDER[l], nx = GG_ORDER[l + 1]; info = 'SİLAH ' + (l + 1) + '/' + GG_ORDER.length + ': ' + WEAPONS[w].name + (nx ? '  →  ' + WEAPONS[nx].name : '  ·  KILIÇLA ÖLDÜR VE KAZAN'); }
  if (info) { ctx.font = 'bold 12px ' + FONT; const tw = ctx.measureText(tl(info)).width + 24; panel(cx - tw / 2, y + 54, tw, 20, 0.8); txt(info, cx, y + 64, 12, A.m === 'sn' ? snColCss(me) : PAL.gold, 'center'); }
}
function snColCss(me) { const c = snZoneCol(me); return 'rgb(' + c.map(v => Math.round(v * 255)).join(',') + ')'; }
