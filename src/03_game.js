/* =====================================================================
   03 · OYUN DURUMU, RAUNT/EKONOMİ, BOMBA, HAREKET, SİLAH, HASAR
   (Bu bölüm host/tek oyunculu modda otoritedir; istemci yalnızca
    hareket ve görsel tahmin için movePlayer/curW vb. kullanır.)
   ===================================================================== */
let S = null;
const G = { mode: 'sp', myId: 'h', running: false, paused: false, cfg: null, spec: null, overShown: false };
const HIST = [];

/* takım ateşi açık mı (oda ayarı; maç içinde host/tek oyunculu ESC menüsünden değiştirebilir) */
function ffOn() { return !S || !S.cfg || S.cfg.ff !== false; }
function setFF(v) {
  if (!S || !S.cfg) return;
  S.cfg.ff = !!v;
  emit({ k: 'msg', small: v ? 'TAKIM ATEŞİ AÇILDI' : 'TAKIM ATEŞİ KAPATILDI' });
}
function newState(cfg) {
  return {
    cfg, time: 0, phase: 'buy', phaseT: BUY_TIME, round: 0, score: [0, 0], swapped: false, lossStreak: [0, 0],
    players: [], pmap: {}, proj: [], areas: [], deps: [], beams: [], twalls: [], orbs: [], heal: [], corpses: [],
    bomb: { state: 'none', carrier: null, x: 0, y: 0, t: 0, site: null, defuser: null, prog: 0, half: false },
    cards: [], rb: [],
    evq: [], nid: 1, matchWinner: null, lastResult: null, known: [{}, {}], plan: null, planted: false, stepT: 0
  };
}
const getP = id => (S && id !== null && id !== undefined) ? S.pmap[id] : null;
function sideOf(team) { return ((team === 0) !== S.swapped) ? 'atk' : 'def'; }
function teamOfSide(side) { return sideOf(0) === side ? 0 : 1; }
function curW(p) { return p.slot === 3 ? 'sword' : (p.slot === 1 && p.primary) ? p.primary : (p.secondary || 'classic'); }
function blankInput() { return { mvx: 0, mvy: 0, ang: 0, pitch: 0, fire: false, fp: 0, alt: false, walk: false, crouch: false, use: false, mx: 0, my: 0, jc: 0 }; }

function makePlayer(o) {
  const p = {
    id: o.id, name: o.name, team: o.team, agent: o.agent, isBot: !!o.bot,
    ctrl: o.bot ? 'bot' : (o.id === G.myId ? 'local' : 'remote'),
    x: 0, y: 0, ang: 0, pitch: 0, vx: 0, vy: 0, spd: 0, hp: 100, armor: 0, alive: true,
    credits: 800, primary: null, secondary: 'classic', slot: 2, ammo: { classic: { mag: 12, res: 36 } },
    fireCD: 0, reloadT: 0, switchT: 0, bloom: 0, shotN: 0, lastShot: -9, pend: false, pendT: 0, lastFp: 0, scoped: false,
    ch: { q: 0, e: 0 }, ult: 0, st: {}, slowAmt: 0, zoneSlow: 1, zoneFire: 1, imp: null, posVer: 0,
    plantT: 0, defT: 0, hasBomb: false, kit: false, crouch: false, kills: 0, deaths: 0, dmg: 0, jz: 0, jvz: 0, lastJc: 0, rbT: 0, cards: [], tk: 0, reqT: 0,
    input: blankInput(), rt: 0, netMv: 0, rebirth: null, ai: null, dotAcc: {}, roundBuys: {}, beamT: 0, hist: []
  };
  { const c = cosClean(o.cos); p.swt = c.sw; p.wsk = c.ws; p.csk = c.cs; } // kozmetik: kılıç seviyesi + skinler
  if (p.ctrl === 'bot') p.ai = newAI(p);
  return p;
}
function nid() { return S.nid++; }
function emit(ev) { S.evq.push(ev); handleEvent(ev); }
function emitSnd(s, x, y) { emit({ k: 'snd', s, x: r1(x), y: r1(y) }); }
function emitFx(o) { o.k = 'fx'; emit(o); }

function createGame(roster, cfg) {
  if (cfg.mode === 'pk') { pkCreate(roster, cfg); return; } // PARKUR modu (03b)
  loadMap(cfg.map || 0);
  S = newState(cfg);
  for (const r of roster) { const p = makePlayer(r); S.players.push(p); S.pmap[p.id] = p; }
  HIST.length = 0;
  startRound();
}
function resetEconomy(p) {
  p.credits = 800; p.primary = null; p.secondary = 'classic'; p.armor = 0; p.ch = { q: 0, e: 0 }; p.kit = false;
  p.ammo = { classic: { mag: 12, res: 36 } };
}
function refillAmmo(p) {
  for (const id of [p.primary, p.secondary]) if (id) { const w = WEAPONS[id]; p.ammo[id] = { mag: w.mag, res: w.res }; }
}
function startRound() {
  S.round++;
  if (S.round === HALF_ROUNDS + 1 && !S.swapped) {
    S.swapped = true;
    for (const p of S.players) resetEconomy(p);
    S.lossStreak = [0, 0];
    emit({ k: 'msg', big: 'TARAF DEĞİŞİMİ', small: 'Ekonomi sıfırlandı · ulti puanları korunur' });
  }
  S.phase = 'buy'; S.phaseT = BUY_TIME + (S.round === 1 ? INTRO_TIME : 0); S.planted = false; S.lastResult = null; // 1. raunt: sinematik giriş süresi eklenir
  S.proj.length = 0; S.areas.length = 0; S.deps.length = 0; S.beams.length = 0; S.corpses.length = 0;
  S.cards = []; S.rb = (MAPDATA.reboot || []).map(() => ({ cd: 0 }));
  clearTempWalls();
  S.orbs = MAPDATA.orbs.map(o => ({ id: nid(), x: tc(o[0], o[1]).x, y: tc(o[0], o[1]).y }));
  S.heal = (MAPDATA.heal || []).map(h => ({ id: h.id, x: h.x, y: h.y, cd: 0 }));
  S.known = [{}, {}];
  const order = { atk: shuffle(MAPDATA.spawns.atk.slice()), def: shuffle(MAPDATA.spawns.def.slice()) }, idx = { atk: 0, def: 0 };
  for (const p of S.players) {
    const side = sideOf(p.team);
    if (!p.alive) { p.primary = null; p.secondary = 'classic'; p.armor = 0; p.kit = false; }
    if (side !== 'def') p.kit = false;
    p.alive = true; p.hp = 100; p.st = {}; p.imp = null; p.plantT = 0; p.defT = 0; p.hasBomb = false; p.rebirth = null;
    p.scoped = false; p.reloadT = 0; p.switchT = 0; p.fireCD = 0; p.bloom = 0; p.zoneSlow = 1; p.zoneFire = 1; p.vx = 0; p.vy = 0;
    p.dotAcc = {}; p.roundBuys = {}; p.pend = false; p.jz = 0; p.jvz = 0; p.rbT = 0; p.reqT = 0;
    const sp = order[side][idx[side]++ % order[side].length], pos = tc(sp[0], sp[1]);
    p.x = pos.x; p.y = pos.y; p.posVer++;
    p.ang = side === 'atk' ? -Math.PI / 2 : Math.PI / 2; p.pitch = 0; p.crouch = false;
    p.input = blankInput(); p.input.ang = p.ang; p.input.fp = p.lastFp; p.input.jc = p.lastJc;
    refillAmmo(p);
    p.slot = p.primary ? 1 : 2;
    const ag = AGENTS[p.agent];
    for (const k of ['q', 'e']) if (ag[k].free && p.ch[k] < ag[k].max) p.ch[k]++;
    if (p.ctrl === 'bot') p.ai = newAI(p);
  }
  const atks = S.players.filter(p => sideOf(p.team) === 'atk');
  S.bomb = { state: 'none', carrier: null, x: 0, y: 0, t: 0, site: null, defuser: null, prog: 0, half: false };
  if (atks.length) {
    const c = pick(atks); c.hasBomb = true;
    S.bomb.state = 'carried'; S.bomb.carrier = c.id; S.bomb.x = c.x; S.bomb.y = c.y;
  }
  if (arOn()) arSetup(); // SİLAH YARIŞI / SÜPERNOVA (03c): bombasız, yeniden doğmalı tek raunt
  S.plan = makeRoundPlan();
  emit({ k: 'round', n: S.round });
}
function endRound(win, reason) {
  if (S.phase === 'end' || S.phase === 'over') return;
  S.phase = 'end'; S.phaseT = END_TIME;
  S.score[win]++;
  const lose = 1 - win;
  S.lossStreak[win] = 0; S.lossStreak[lose] = Math.min(3, S.lossStreak[lose] + 1);
  for (const p of S.players) {
    if (p.team === win) p.credits += 3000;
    else p.credits += 1900 + 500 * Math.min(2, S.lossStreak[lose] - 1);
    if (S.planted && sideOf(p.team) === 'atk') p.credits += 300;
    p.credits = Math.min(MAX_CREDITS, p.credits);
    p.plantT = 0; p.defT = 0;
  }
  S.lastResult = { win, reason };
  if (S.round >= MATCH_ROUNDS) S.matchWinner = S.score[0] > S.score[1] ? 0 : S.score[1] > S.score[0] ? 1 : -1; // -1 = berabere
  emit({ k: 'rend', w: win, r: reason });
}

/* ---------- ANA SİMÜLASYON ADIMI (host) ---------- */
function hostTick(dt) {
  if (PKMAP && pkOn()) { pkHostTick(dt); return; }
  if (arOn()) { arHostTick(dt); return; } // arena modları (03c)
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
  updateOrbs(); updateHeal(dt); updateReboot(dt); updateBomb(dt); footstepsHear(dt);
  // faz geçişleri
  S.phaseT -= dt;
  if (S.phase === 'buy' && S.phaseT <= 0) { S.phase = 'live'; S.phaseT = ROUND_TIME; emit({ k: 'go' }); }
  else if (S.phase === 'live' && S.phaseT <= 0) endRound(teamOfSide('def'), 'time');
  else if (S.phase === 'planted') {
    S.bomb.t -= dt; S.phaseT = S.bomb.t;
    if (S.bomb.t <= 0) explodeBomb();
  } else if (S.phase === 'end' && S.phaseT <= 0) {
    if (S.matchWinner !== null) { S.phase = 'over'; S.phaseT = 0; emit({ k: 'over', w: S.matchWinner }); }
    else startRound();
  }
  if (S.phase === 'live' || S.phase === 'planted') {
    const at = teamOfSide('atk'), dtm = 1 - at;
    const aA = S.players.some(p => p.team === at && p.alive), dA = S.players.some(p => p.team === dtm && p.alive);
    if (!dA) endRound(at, 'elim');
    else if (S.phase === 'live' && !aA) endRound(dtm, 'elim');
  }
  recordHistory();
}
function recordHistory() {
  const m = {};
  for (const p of S.players) m[p.id] = [p.x, p.y];
  HIST.push({ t: S.time, m });
  if (HIST.length > 50) HIST.shift();
}
/* Gecikme telafisi: atıcının ekranda gördüğü andaki pozisyonlar */
function rewindMap(rt) {
  if (!rt || HIST.length < 2) return null;
  const t = clamp(rt, S.time - 0.4, S.time);
  for (let i = HIST.length - 1; i > 0; i--) {
    const a = HIST[i - 1], b = HIST[i];
    if (a.t <= t && t <= b.t) {
      const f = (t - a.t) / Math.max(1e-6, b.t - a.t), m = {};
      for (const id in b.m) { const pa = a.m[id] || b.m[id], pb = b.m[id]; m[id] = [lerp(pa[0], pb[0], f), lerp(pa[1], pb[1], f)]; }
      return m;
    }
  }
  return null;
}

/* ---------- DURUM ETKİLERİ ---------- */
function updateStatus(p, dt) {
  for (const k in p.st) {
    p.st[k] -= dt;
    if (p.st[k] <= 0) {
      delete p.st[k];
      if (k === 'clone') p.rebirth = null;
    }
  }
}
function dot(t, rate, dt, att, src) {
  t.dotAcc[src] = (t.dotAcc[src] || 0) + rate * dt;
  if (t.dotAcc[src] >= 5) { const d = Math.floor(t.dotAcc[src]); t.dotAcc[src] -= d; damage(t, d, att, src, false, true); }
}
function inR(p, x, y, r) { return dist2(p.x, p.y, x, y) <= r * r; }
function enemiesIn(team, x, y, r) { return S.players.filter(p => p.alive && p.team !== team && inR(p, x, y, r)); }

/* ---------- HAREKET (host + istemci tahmini) ---------- */
function playerSpeed(p, inp) {
  const wid = curW(p), w = wid === 'sword' ? swordStats(p) : WEAPONS[wid];
  let s = RUN * (PKMAP ? PK_SPD : (w.spd || 1)); // parkurda herkes aynı hızda
  if (inp.walk) s *= 0.52;
  if (p.crouch) s *= 0.42;
  if (p.scoped) s *= 0.55;
  s *= p.zoneSlow;
  if (p.st.boost > 0) s *= 1.35;
  if (p.st.ovl > 0) s *= 1.9;
  if (p.st.lock > 0) s *= 0.55;
  if (p.st.slow > 0) s *= (1 - (p.slowAmt || 0.3));
  if (p.admSpd > 1) s *= p.admSpd; // admin: hız çarpanı
  return s;
}
function barrierFor(p) { const t = PKMAP ? T_ATK : sideOf(p.team) === 'atk' ? T_ATK : T_DEF; return (tx, ty) => tileAt(tx, ty) !== t; }
function movePlayer(p, dt, inp) {
  if (!p.alive) { p.spd = 0; return; }
  let mx = inp.mvx || 0, my = inp.mvy || 0;
  const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  if (p.st.knock > 0 || inp.use || S.phase === 'over' || p.plantT > 0 || p.defT > 0) { mx = 0; my = 0; }
  // zıplama: giriş sayacı değişince ve yerdeyken (parkurda zemin, altındaki bloğun üstü olabilir)
  const pk = !!PKMAP, g0 = pk ? pkGround(p.x, p.y) : 0;
  if ((inp.jc | 0) !== (p.lastJc | 0)) {
    p.lastJc = inp.jc | 0;
    const onG = pk ? (g0 > PK_VOID && p.jz <= g0 + 0.5 && p.jvz <= 0) : (p.jz <= 0.01 && p.jvz <= 0);
    if (onG && canAct(p) && !inp.use && !(p.plantT > 0) && !(p.defT > 0) && S.phase !== 'over') {
      p.jvz = JUMP_V;
      if (p.ctrl === 'local' && typeof AU !== 'undefined') AU.play('jump', p.x, p.y, 0.8, true);
    }
  }
  if (pk) pkVertical(p, dt, g0);
  else if (p.jz > 0 || p.jvz > 0) {
    p.jz += p.jvz * dt - 0.5 * GRAV * dt * dt; p.jvz -= GRAV * dt; // kare hızından bağımsız (tam parabol)
    if (p.jz <= 0) { p.jz = 0; p.jvz = 0; if (p.ctrl === 'local' && typeof AU !== 'undefined') AU.play('land', p.x, p.y, 0.7, true); }
  }
  const air = pk ? (p.jz > g0 + 0.5 || p.jvz > 0) : p.jz > 0.5;
  const sp = playerSpeed(p, inp), k = Math.min(1, dt * (air ? 3.5 : 18));
  p.vx += (mx * sp - p.vx) * k; p.vy += (my * sp - p.vy) * k;
  let vx = p.vx, vy = p.vy;
  if (p.imp && p.imp.t > 0) { vx = p.imp.vx; vy = p.imp.vy; p.imp.t -= dt; if (p.imp.t <= 0) p.imp = null; }
  const ox = p.x, oy = p.y;
  PKZ = p.jz || 0;
  moveCircle(p, vx * dt, vy * dt, PR, S.phase === 'buy' ? barrierFor(p) : null);
  PKZ = 0;
  if (pk) pkAfterMove(p, dt);
  p.spd = Math.hypot(p.x - ox, p.y - oy) / dt;
}
/* Oyuncular üst üste binmesin: yumuşak itme (uzak istemciler kendi tarafında ayrışır) */
function separatePlayers() {
  const ps = S.players, md = PR * 2 - 2;
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i]; if (!a.alive) continue;
    for (let j = i + 1; j < ps.length; j++) {
      const b = ps[j]; if (!b.alive) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 >= md * md || d2 < 1e-4) continue;
      const am = a.ctrl !== 'remote', bm = b.ctrl !== 'remote';
      if (!am && !bm) continue;
      if (PKMAP && Math.abs((a.jz || 0) - (b.jz || 0)) > 40) continue; // parkur: farklı yükseklikteki oyuncular itişmez
      const d = Math.sqrt(d2), push = (md - d) * 0.5, ux = dx / d, uy = dy / d;
      const fa = am && bm ? 0.5 : am ? 1 : 0, fb = am && bm ? 0.5 : bm ? 1 : 0;
      if (fa) { a.x -= ux * push * fa; a.y -= uy * push * fa; PKZ = a.jz || 0; resolveCircle(a, PR, S.phase === 'buy' ? barrierFor(a) : null); }
      if (fb) { b.x += ux * push * fb; b.y += uy * push * fb; PKZ = b.jz || 0; resolveCircle(b, PR, S.phase === 'buy' ? barrierFor(b) : null); }
      PKZ = 0;
    }
  }
}
function separateOne(me) {
  const md = PR * 2 - 2;
  for (const o of S.players) {
    if (o === me || !o.alive) continue;
    const dx = me.x - o.x, dy = me.y - o.y, d2 = dx * dx + dy * dy;
    if (d2 >= md * md || d2 < 1e-4) continue;
    if (PKMAP && Math.abs((me.jz || 0) - (o.jz || 0)) > 40) continue;
    const d = Math.sqrt(d2), push = (md - d) * 0.35;
    me.x += dx / d * push; me.y += dy / d * push;
    PKZ = me.jz || 0; resolveCircle(me, PR, S.phase === 'buy' ? barrierFor(me) : null); PKZ = 0;
  }
}
function setPos(p, x, y) { p.x = x; p.y = y; p.posVer++; p.vx = 0; p.vy = 0; p.imp = null; }
function impulse(p, vx, vy, dur) {
  if (p.ctrl === 'remote') emit({ k: 'imp', id: p.id, vx: r1(vx), vy: r1(vy), d: dur });
  else p.imp = { vx, vy, t: dur };
}
function footstepsHear(dt) {
  S.stepT -= dt; if (S.stepT > 0) return; S.stepT = 0.3;
  for (const p of S.players) if (p.alive && p.spd > RUN * 0.66 && !p.input.walk && !p.crouch) botsHear(p.x, p.y, p.team, 340);
}

/* ---------- SİLAH ---------- */
function canAct(p) { return p.alive && !(p.st.lock > 0) && !(p.st.knock > 0); }
function updateCombat(p, dt) {
  if (!p.alive) return;
  const inp = p.input;
  if (p.ctrl !== 'bot') { p.ang = inp.ang; p.pitch = clamp(inp.pitch || 0, -1.45, 1.45); }
  p.crouch = !!inp.crouch && !(p.st.knock > 0);
  if (inp.fp !== p.lastFp) { p.lastFp = inp.fp; p.pend = true; p.pendT = 0.35; }
  if (p.pend) { p.pendT -= dt; if (p.pendT <= 0) p.pend = false; }
  const wid = curW(p), w = WEAPONS[wid];
  p.scoped = !!(w.scope && inp.alt && p.switchT <= 0 && p.reloadT <= 0 && !(p.st.ovl > 0) && canAct(p));
  const fm = p.zoneFire;
  p.fireCD -= dt * fm;
  if (p.switchT > 0) p.switchT -= dt;
  p.bloom = Math.max(0, p.bloom - dt * (w.bmax * 2.2 + 0.02));
  if (S.time - p.lastShot > 0.4) p.shotN = 0;
  if (p.reloadT > 0) { p.reloadT -= dt * fm; if (p.reloadT <= 0) finishReload(p); }
  if (p.st.ovl > 0) { if (inp.fire && canAct(p)) overloadBeam(p, dt); return; }
  if (inp.use || p.plantT > 0 || p.defT > 0 || p.rbT > 0 || !canAct(p) || S.phase === 'buy' || S.phase === 'over') return;
  if (w.melee) {
    const heavy = !!inp.alt && !inp.fire && !p.pend;
    if ((inp.fire || p.pend || heavy) && p.fireCD <= 0 && p.switchT <= 0) { swingSword(p, heavy); p.pend = false; }
    return;
  }
  const want = w.auto ? (inp.fire || p.pend) : p.pend;
  if (want && p.fireCD <= 0 && p.switchT <= 0 && p.reloadT <= 0) {
    const am = p.ammo[wid] || (p.ammo[wid] = { mag: w.mag, res: w.res });
    if (am.mag <= 0) {
      if (am.res > 0) startReload(p);
      else if (p.pend) emit({ k: 'snd', s: 'empty', x: r1(p.x), y: r1(p.y) });
      p.pend = false; return;
    }
    fireWeapon(p, wid, w); p.pend = false;
  }
}
function calcSpread(p, w) {
  const base = w.scope ? (p.scoped ? w.scopedBase : w.base) : w.base;
  const mv = p.ctrl === 'remote' ? p.netMv : p.spd / RUN;
  const mf = clamp((mv - 0.28) / 0.72, 0, 1);
  let s = base + w.move * mf + p.bloom;
  if (p.crouch) s *= 0.72;
  if (p.jz > 3) s += 0.16; // havadayken isabet çok düşer
  if (p.st.concuss > 0) s += 0.26;
  return s;
}
function fireWeapon(p, wid, w) {
  const am = p.ammo[wid]; am.mag--;
  p.fireCD = 1 / w.rate; p.lastShot = S.time; p.shotN++;
  const spr = calcSpread(p, w);
  let a = p.ang + gauss() * spr;
  let pt = (p.pitch || 0) + gauss() * spr * 0.85 + (w.vk || 0) * Math.min(p.shotN - 1, 10);
  if (w.sway && p.shotN > 4) a += w.sway * Math.sin(p.shotN * 0.55) * Math.min(1, (p.shotN - 4) / 6);
  p.bloom = Math.min(w.bmax, p.bloom + w.bloom);
  if (p.st.invis) delete p.st.invis;
  const eye = eyeOf(p);
  const res = traceBullet(p.x, p.y, a, w.range, p.team, p, wid, w, p.ctrl === 'remote' ? rewindMap(p.rt) : null, pt, eye, ffOn());
  emit({ k: 'sh', id: p.id, x: r1(p.x + Math.cos(a) * 18), y: r1(p.y + Math.sin(a) * 18), z: r1(eye - 8), x2: r1(res.x), y2: r1(res.y), z2: r1(res.z), w: wid });
  botsHear(p.x, p.y, p.team, w.silenced ? 320 : 1350);
  if (am.mag <= 0 && am.res > 0) startReload(p);
}
/* Kılıç darbesi: önündeki koni içindeki en yakın oyuncu (takım arkadaşı da olabilir) */
function swingSword(p, heavy) {
  if (PKMAP) { pkSwing(p, heavy); return; } // parkur: iter / barikat kırar, hasar vermez
  const w = swordStats(p); // kılıç seviyesine göre hasar/hız/menzil
  p.fireCD = 1 / (heavy ? w.heavyRate : w.rate); p.lastShot = S.time;
  if (p.st.invis) delete p.st.invis;
  let best = null, bd = 1e9;
  for (const t of S.players) {
    if (!t.alive || t === p || (t.team === p.team && !ffOn())) continue;
    const d = dist(p.x, p.y, t.x, t.y);
    if (d > w.reach + PR || Math.abs(angDiff(p.ang, Math.atan2(t.y - p.y, t.x - p.x))) > 0.8 || !losClear(p.x, p.y, t.x, t.y, true)) continue;
    if (d < bd) { bd = d; best = t; }
  }
  emit({ k: 'sw', id: p.id, h: heavy ? 1 : 0, hit: best ? 1 : 0, x: r1(p.x), y: r1(p.y) });
  botsHear(p.x, p.y, p.team, 320);
  if (!best) {
    for (const dp of S.deps) if (dp.team !== p.team && dp.hp > 0 && dist(p.x, p.y, dp.x, dp.y) < w.reach + 14 && Math.abs(angDiff(p.ang, Math.atan2(dp.y - p.y, dp.x - p.x))) < 0.8) { damageDep(dp, heavy ? w.heavy : w.dmg); break; }
    return;
  }
  const back = Math.abs(angDiff(best.ang, Math.atan2(best.y - p.y, best.x - p.x))) < 1.0;
  damage(best, (heavy ? w.heavy : w.dmg) * (back ? 2 : 1), p, 'sword', back);
}
function falloff(w, d) { let dmg = w.dmg; for (const f of w.fall) if (d > f[0]) dmg = f[1]; return dmg; }
/* Anlık isabet (hitscan): yatayda 2D ışın, dikeyde bakış açısına (pitch) göre kafa/gövde/bacak.
   pitch verilmezse (taret) her isabet gövdedir. */
function traceBullet(ox, oy, a, range, team, att, wid, w, rw, pitch, eyeH, ff) {
  const ux = Math.cos(a), uy = Math.sin(a);
  const tp = (pitch === undefined || pitch === null) ? null : Math.tan(pitch);
  const eh = eyeH === undefined ? EYE : eyeH;
  const rc = tp === null ? raycast(ox, oy, ux, uy, range) : raycast(ox, oy, ux, uy, range, eh, tp);
  let end = rc.d; const wallHit = rc.hit && !rc.low, wtx = rc.tx, wty = rc.ty;
  let blockedBySphere = false, floorHit = false;
  if (tp !== null && tp < -1e-4) { const fd = eh / -tp; if (fd < end) { end = fd; floorHit = true; } }
  for (const ar of S.areas) if (ar.type === 'tsphere' && ar.team !== team) {
    const t = rayCircle(ox, oy, ux, uy, ar.x, ar.y, ar.r);
    if (t !== null && t > 0 && t < end) { end = t; blockedBySphere = true; floorHit = false; }
  }
  const cands = [];
  for (const t of S.players) {
    if (!t.alive || t === att || (t.team === team && !ff)) continue; // ff: silah ateşi takım arkadaşlarını da vurur
    let tx = t.x, ty = t.y;
    if (rw && rw[t.id]) { tx = rw[t.id][0]; ty = rw[t.id][1]; }
    const d = rayCircle(ox, oy, ux, uy, tx, ty, PR + 1);
    if (d !== null && d < end) cands.push({ d, p: t, x: tx, y: ty });
  }
  for (const dp of S.deps) {
    if (dp.team === team || !(dp.hp > 0)) continue;
    const d = rayCircle(ox, oy, ux, uy, dp.x, dp.y, dp.hr || 12);
    if (d !== null && d < end) cands.push({ d, dep: dp });
  }
  cands.sort((A, B) => A.d - B.d);
  let pierced = 0;
  for (const c of cands) {
    const hz = tp === null ? 40 : eh + tp * c.d;
    if (c.dep) {
      if (tp !== null && (hz > 40 || hz < 0)) continue;
      damageDep(c.dep, w ? falloff(w, c.d) : 8);
      if (w && w.pierce) { pierced++; continue; }
      return { x: ox + ux * c.d, y: oy + uy * c.d, z: hz, hit: true };
    }
    const along = (c.x - ox) * ux + (c.y - oy) * uy, perp = Math.abs((c.x - ox) * uy - (c.y - oy) * ux);
    let dmg = w ? falloff(w, along) : 8, hs = false, bp; // bp: isabet bölgesi 0 kafa / 1 gövde / 2 bacak (savaş raporu için)
    if (tp !== null && w) {
      const h = eh + tp * along - liftOf(c.p), cr = c.p.crouch;
      if (h > (cr ? P_TOP_C : P_TOP) || h < 0) continue;
      if (h >= (cr ? HEAD_LO_C : HEAD_LO)) { if (perp > 9.5) continue; dmg *= w.hs; hs = true; bp = 0; }
      else if (h < (cr ? LEG_TOP_C : LEG_TOP)) { dmg *= 0.85; bp = 2; }
      else bp = 1;
    }
    if (w && w.oneshot) dmg = Math.max(1, Math.ceil(c.p.hp)); // RAILGUN (damage() 'railgun' kaynağında zırhı yok sayıp öldürür): nereye isabet ederse etsin tek atar
    damage(c.p, dmg, att, wid, hs, false, bp);
    if (w && w.pierce) { pierced++; continue; } // RAILGUN: ışın oyuncuların içinden geçer
    return { x: ox + ux * c.d, y: oy + uy * c.d, z: hz, hit: true };
  }
  if (wallHit && !blockedBySphere && !floorHit && wtx >= 0 && wty >= 0 && wtx < MW && wty < MH) {
    const id = tgrid[wty * MW + wtx]; if (id > 0) damageTWall(id, w ? falloff(w, end) : 8);
  }
  if (blockedBySphere) emitFx({ t: 'stop', x: r1(ox + ux * end), y: r1(oy + uy * end) });
  const zEnd = tp === null ? 40 : clamp(eh + tp * end, 0, WALL_H);
  return { x: ox + ux * end, y: oy + uy * end, z: zEnd, hit: pierced > 0 };
}
function startReload(p) {
  const wid = curW(p), w = WEAPONS[wid], am = p.ammo[wid];
  if (w.melee) return;
  if (!am || p.reloadT > 0 || am.mag >= w.mag || am.res <= 0 || p.st.ovl > 0 || !p.alive) return;
  p.reloadT = w.reload; p.scoped = false;
  emit({ k: 'snd', s: 'reload', x: r1(p.x), y: r1(p.y), id: p.id });
}
function finishReload(p) {
  const wid = curW(p), w = WEAPONS[wid], am = p.ammo[wid];
  const take = Math.min(w.mag - am.mag, am.res); am.mag += take; am.res -= take; p.reloadT = 0;
}
function switchSlot(p, s) {
  if (PKMAP) return; // parkur: yalnızca kılıç
  if (arMode() === 'gg' && s !== 3 && !(s === 1 ? p.primary : p.secondary)) return; // silah yarışı: yalnızca seviyedeki silah + kılıç
  if (s === 1 && !p.primary) return;
  if (s !== 1 && s !== 2 && s !== 3) return;
  if (p.slot === s) return;
  p.slot = s; p.switchT = 0.45; p.reloadT = 0; p.scoped = false;
}

/* ---------- HASAR / ÖLÜM ---------- */
function damage(t, amt, att, src, hs, quiet, bp) {
  if (!t || !t.alive || S.phase === 'buy' || S.phase === 'over' || PKMAP) return;
  if (t.prot && S.time < t.prot) return; // arena: yeniden doğuş koruması
  if (att && att.admDmg > 1 && att !== t) amt *= att.admDmg; // admin: atak gücü çarpanı
  amt = Math.round(amt); if (amt <= 0) return;
  let rem = amt;
  const pierce = src === 'blade' || src === 'bomb' || src === 'railgun' || src === 'admin', real = Math.min(amt, Math.max(0, Math.ceil(t.hp) + (pierce ? 0 : Math.max(0, t.armor)))); // gerçekten giden hasar (can + zırh kadar)
  if (pierce) rem = 9999;
  else if (t.armor > 0) { const ab = Math.min(t.armor, rem); t.armor -= ab; rem -= ab; }
  t.hp -= rem;
  if (att && att.team !== t.team) att.dmg += amt;
  else if (att && att !== t) att.tk = (att.tk || 0) + amt;
  const ev = { k: 'hit', a: att ? att.id : null, t: t.id, d: amt, hs: hs ? 1 : 0, x: r1(t.x), y: r1(t.y), ax: att ? r1(att.x) : null, ay: att ? r1(att.y) : null, q: quiet ? 1 : 0 };
  if (bp === 0 || bp === 1 || bp === 2) ev.bp = bp; else ev.w = src; // savaş raporu: silah isabetinde bölge, diğerlerinde kaynak
  if (real !== amt) ev.r = real;
  emit(ev);
  if (t.ai && att) botOnDamaged(t, att);
  if (t.hp <= 0) {
    if (t.st.clone > 0 && t.rebirth) { doRebirth(t); return; }
    killPlayer(t, att, src, hs);
  }
}
function killPlayer(t, att, src, hs) {
  t.alive = false; t.hp = 0; t.deaths++; t.st = {}; t.plantT = 0; t.defT = 0; t.scoped = false; t.imp = null; t.vx = 0; t.vy = 0;
  t.ult = Math.min(AGENTS[t.agent].x.pts, t.ult + 1);
  if (att && att.team !== t.team) {
    att.kills++; att.credits = Math.min(MAX_CREDITS, att.credits + 200);
    att.ult = Math.min(AGENTS[att.agent].x.pts, att.ult + 1);
  }
  S.corpses.push({ id: t.id, x: r1(t.x), y: r1(t.y), team: t.team });
  if (att && att.ai && att.team !== t.team && Math.random() < 0.22) { att._emoAt = S.time + 0.9; att._emoE = pick([0, 2, 3, 4, 5]); } // botlar bazen kutlar
  t.jz = 0; t.jvz = 0; t.rbT = 0;
  // REBOOT: taşıdığı kartlar yere düşer, kendi kartı da yere bırakılır
  if (S.cards) {
    for (const c of S.cards) if (c.carrier === t.id) { const f = findFree(t.x + rand(-26, 26), t.y + rand(-26, 26), 6); c.carrier = null; c.x = r1(f.x); c.y = r1(f.y); }
    if ((S.phase === 'live' || S.phase === 'planted') && MAPDATA.reboot && MAPDATA.reboot.length) {
      const f = findFree(t.x + rand(-14, 14), t.y + rand(-14, 14), 6);
      S.cards.push({ id: nid(), owner: t.id, team: t.team, x: r1(f.x), y: r1(f.y), carrier: null });
    }
  }
  if (t.hasBomb) {
    t.hasBomb = false;
    const f = findFree(t.x, t.y, 6);
    S.bomb.state = 'dropped'; S.bomb.x = f.x; S.bomb.y = f.y; S.bomb.carrier = null;
    emit({ k: 'msg', side: 'atk', small: 'BOMBA DÜŞTÜ' });
  }
  if (S.bomb.defuser === t.id) { S.bomb.defuser = null; S.bomb.prog = S.bomb.half ? DEFUSE_TIME / 2 : 0; }
  emit({ k: 'kill', a: att ? att.id : null, v: t.id, w: src, hs: hs ? 1 : 0, tk: att && att !== t && att.team === t.team ? 1 : 0 });
  if (arOn()) arOnKill(t, att, src);
}
function doRebirth(t) {
  const rb = t.rebirth, f = findFree(rb.x, rb.y, PR);
  emitFx({ t: 'rebirth', x: r1(t.x), y: r1(t.y), x2: r1(f.x), y2: r1(f.y) });
  emitSnd('rebirth', f.x, f.y);
  t.hp = 100; t.armor = rb.armor; delete t.st.clone; t.rebirth = null;
  t.st.blind = 0; delete t.st.blind;
  setPos(t, f.x, f.y);
  S.deps = S.deps.filter(d => !(d.type === 'rebirth' && d.owner === t.id));
}
function explode(x, y, r, dmg, att, team, src) {
  for (const t of S.players) {
    if (!t.alive || t.team === team) continue;
    const d = dist(t.x, t.y, x, y);
    if (d > r || !losClear(x, y, t.x, t.y, true)) continue;
    damage(t, dmg * (1 - 0.5 * d / r), att, src);
  }
  for (const dp of S.deps) if (dp.team !== team && dp.hp > 0 && inR(dp, x, y, r)) damageDep(dp, dmg);
  emitFx({ t: 'boom', x: r1(x), y: r1(y), r });
  emitSnd(src === 'shock' ? 'shock' : 'boom', x, y);
}

/* ---------- SATIN ALMA ---------- */
function buyItem(p, item) {
  if (!S || S.phase !== 'buy' || !p || !p.alive || PKMAP || arOn()) return false;
  const rb = p.roundBuys;
  if (WEAPONS[item]) {
    const w = WEAPONS[item];
    if (w.hidden) return false; // admin silahı satın alınamaz
    if ((w.slot === 1 && p.primary === item) || (w.slot === 2 && p.secondary === item)) return false;
    const key = w.slot === 1 ? 'primary' : 'secondary', refund = rb[key] ? rb[key].price : 0;
    if (p.credits + refund < w.price) return false;
    p.credits += refund - w.price;
    if (w.slot === 1) { p.primary = item; p.slot = 1; } else { p.secondary = item; if (!p.primary) p.slot = 2; }
    rb[key] = { id: item, price: w.price };
    p.ammo[item] = { mag: w.mag, res: w.res }; p.switchT = 0.3; p.reloadT = 0;
  } else if (ARMOR[item]) {
    const a = ARMOR[item], refund = rb.armor ? rb.armor.price : 0;
    if (p.armor >= a.val) return false;
    if (p.credits + refund < a.price) return false;
    p.credits += refund - a.price; p.armor = a.val; rb.armor = { price: a.price };
  } else if (item === 'kit') {
    if (sideOf(p.team) !== 'def' || p.kit || p.credits < KIT_PRICE) return false;
    p.credits -= KIT_PRICE; p.kit = true;
  } else if (item === 'q' || item === 'e') {
    const ab = AGENTS[p.agent][item];
    if (p.ch[item] >= ab.max || p.credits < ab.cost) return false;
    p.credits -= ab.cost; p.ch[item]++;
  } else return false;
  emit({ k: 'buy', id: p.id, it: item });
  return true;
}

/* ---------- BOMBA ---------- */
function updateBomb(dt) {
  const sp = S.bomb;
  if (sp.state === 'carried') {
    const c = getP(sp.carrier);
    if (c && c.alive) { sp.x = c.x; sp.y = c.y; }
  } else if (sp.state === 'dropped' && (S.phase === 'live' || S.phase === 'buy')) {
    for (const p of S.players) if (p.alive && sideOf(p.team) === 'atk' && dist2(p.x, p.y, sp.x, sp.y) < 30 * 30 && !(sp.noPick && sp.noPick.id === p.id && S.time < sp.noPick.t) && !(sp.res && sp.res.id !== p.id && S.time < sp.res.t)) {
      p.hasBomb = true; sp.state = 'carried'; sp.carrier = p.id;
      emit({ k: 'msg', side: 'atk', small: p.name + ' BOMBAYI ALDI' }); break;
    }
  }
  if (S.phase === 'live') {
    for (const p of S.players) {
      if (!p.hasBomb || !p.alive) continue;
      const site = siteAt(p.x, p.y);
      if (p.input.use && site && canAct(p) && !(p.rbT > 0)) {
        p.plantT += dt;
        if (p.plantT >= PLANT_TIME) { plantBomb(p, site); break; }
      } else p.plantT = 0;
    }
  }
  if (S.phase === 'planted' && sp.state === 'planted') {
    let def = null;
    const cur = getP(sp.defuser);
    if (cur && cur.alive && cur.input.use && canAct(cur) && dist2(cur.x, cur.y, sp.x, sp.y) < 58 * 58) def = cur;
    else for (const p of S.players) if (p.alive && sideOf(p.team) === 'def' && p.input.use && canAct(p) && dist2(p.x, p.y, sp.x, sp.y) < 58 * 58) { def = p; break; }
    for (const p of S.players) if (p !== def) p.defT = 0;
    if (def) {
      if (sp.defuser !== def.id) {
        sp.defuser = def.id; sp.prog = sp.half ? DEFUSE_TIME / 2 : 0; S.defAlert = S.time;
        emit({ k: 'msg', side: 'atk', small: def.kit ? 'BOMBA İMHA EDİLİYOR — KİTLİ!' : 'BOMBA İMHA EDİLİYOR!' });
        emitSnd('defstart', sp.x, sp.y);
        for (const b of S.players) if (b.ai && b.alive && sideOf(b.team) === 'atk') b.ai.lk = { x: sp.x, y: sp.y, t: S.time };
      }
      sp.prog += dt * (def.kit ? DEFUSE_TIME / KIT_TIME : 1); def.defT = sp.prog;
      if (sp.prog >= DEFUSE_TIME / 2 && !sp.half) sp.half = true;
      if (sp.prog >= DEFUSE_TIME) {
        sp.state = 'defused'; def.defT = 0; def.ult = Math.min(AGENTS[def.agent].x.pts, def.ult + 1);
        emitSnd('defused', sp.x, sp.y);
        emit({ k: 'vo', id: def.id, l: 'defuse' });
        endRound(teamOfSide('def'), 'defuse');
      }
    } else if (sp.defuser) { sp.defuser = null; sp.prog = sp.half ? DEFUSE_TIME / 2 : 0; }
  }
}
function dropBomb(p) {
  if (!p || !p.hasBomb || !p.alive || (S.phase !== 'live' && S.phase !== 'buy')) return false;
  const f = findFree(p.x + Math.cos(p.ang) * 34, p.y + Math.sin(p.ang) * 34, 6);
  p.hasBomb = false; p.plantT = 0;
  S.bomb.state = 'dropped'; S.bomb.x = f.x; S.bomb.y = f.y; S.bomb.carrier = null; S.bomb.noPick = { id: p.id, t: S.time + 2 };
  emit({ k: 'msg', side: 'atk', small: p.name + ' BOMBAYI BIRAKTI' });
  return true;
}
/* Takım arkadaşından bomba isteme: bot taşıyıcı yakındaysa verir, uzaktaysa bırakıp sana ayırır;
   oyuncu taşıyıcıya bildirim gider */
function requestBomb(p) {
  if (!p || !p.alive || sideOf(p.team) !== 'atk' || p.hasBomb || (S.phase !== 'live' && S.phase !== 'buy')) return;
  if (S.time < (p.reqT || 0)) return;
  p.reqT = S.time + 2.5;
  const sp = S.bomb;
  if (sp.state === 'dropped') { emit({ k: 'msg', to: p.id, small: 'BOMBA YERDE — MİNİ HARİTADA İŞARETLİ' }); return; }
  const c = getP(sp.carrier);
  if (sp.state !== 'carried' || !c || !c.alive || c.team !== p.team) return;
  emit({ k: 'req', id: p.id, c: c.id });
  if (c.ctrl === 'bot') {
    if (dist(c.x, c.y, p.x, p.y) < 650 && losClear(c.x, c.y, p.x, p.y, true)) {
      c.hasBomb = false; c.plantT = 0; p.hasBomb = true; sp.carrier = p.id; sp.x = p.x; sp.y = p.y;
      emit({ k: 'msg', side: 'atk', small: c.name + ' BOMBAYI ' + p.name.toLocaleUpperCase('tr-TR') + ' OYUNCUSUNA VERDİ' });
      emitSnd('card', p.x, p.y);
    } else {
      dropBomb(c);
      sp.res = { id: p.id, t: S.time + 15 };
      emit({ k: 'msg', side: 'atk', small: c.name + ' BOMBAYI BIRAKTI — ' + p.name.toLocaleUpperCase('tr-TR') + ' İÇİN AYRILDI' });
    }
  } else {
    emit({ k: 'msg', to: c.id, big: p.name + ' BOMBA İSTİYOR', small: '[G] ile bırak' });
    emit({ k: 'msg', to: p.id, small: 'İSTEK ' + c.name.toLocaleUpperCase('tr-TR') + ' OYUNCUSUNA GÖNDERİLDİ' });
  }
}
/* ---------- REBOOT (Fortnite tarzı) ----------
   Ölen oyuncunun kartı yere düşer; takım arkadaşı üzerinden geçerek alır, A veya B bölgesindeki
   reboot istasyonunda [F]'yi basılı tutar (4 sn) → kartın sahibi istasyonun yanında yeniden doğar. */
function updateReboot(dt) {
  if (!S.cards || !MAPDATA.reboot) return;
  for (const r of S.rb) if (r.cd > 0) r.cd = Math.max(0, r.cd - dt);
  if (S.phase !== 'live' && S.phase !== 'planted') { for (const p of S.players) p.rbT = 0; return; }
  for (const c of S.cards) {
    const o = getP(c.owner);
    if (!o || o.alive) { c.dead = true; continue; }
    if (c.carrier) {
      const cp = getP(c.carrier);
      if (cp && cp.alive) { c.x = r1(cp.x); c.y = r1(cp.y); } else c.carrier = null;
      continue;
    }
    for (const p of S.players) if (p.alive && p.team === c.team && dist2(p.x, p.y, c.x, c.y) < 38 * 38) {
      c.carrier = p.id;
      emit({ k: 'card', id: p.id, o: o.id, x: r1(c.x), y: r1(c.y) });
      break;
    }
  }
  if (S.cards.some(c => c.dead)) S.cards = S.cards.filter(c => !c.dead);
  for (const p of S.players) {
    if (!p.alive) { p.rbT = 0; continue; }
    let st = -1;
    if (p.input.use && canAct(p) && S.cards.some(c => c.carrier === p.id)) {
      const defusing = S.phase === 'planted' && sideOf(p.team) === 'def' && dist2(p.x, p.y, S.bomb.x, S.bomb.y) < 58 * 58;
      if (!defusing) MAPDATA.reboot.forEach((r, i) => { if (st < 0 && S.rb[i].cd <= 0 && dist2(p.x, p.y, r.x, r.y) < REBOOT_R * REBOOT_R) st = i; });
    }
    if (st < 0) { p.rbT = 0; continue; }
    if (p.rbT === 0) emitSnd('rbstart', p.x, p.y);
    p.rbT += dt;
    if (p.rbT >= REBOOT_TIME) { doReboot(p, st); p.rbT = 0; }
  }
}
function doReboot(p, i) {
  const card = S.cards.find(c => c.carrier === p.id); if (!card) return;
  const o = getP(card.owner); S.cards = S.cards.filter(c => c !== card);
  if (!o || o.alive) return;
  const R = MAPDATA.reboot[i], f = findFree(R.ax, R.ay, PR + 2);
  o.alive = true; o.hp = 100; o.armor = 0; o.kit = false; o.st = {}; o.primary = null; o.slot = 2; o.scoped = false;
  o.reloadT = 0; o.switchT = 0.6; o.fireCD = 0; o.pend = false; o.plantT = 0; o.defT = 0; o.rbT = 0; o.jz = 0; o.jvz = 0;
  o.zoneSlow = 1; o.zoneFire = 1; o.dotAcc = {};
  const sw = WEAPONS[o.secondary || 'classic']; o.ammo[o.secondary || 'classic'] = { mag: sw.mag, res: sw.res };
  setPos(o, f.x, f.y);
  o.ang = Math.atan2(f.y - R.y, f.x - R.x); o.input = blankInput(); o.input.ang = o.ang; o.input.fp = o.lastFp; o.input.jc = o.lastJc;
  if (o.ctrl === 'bot') o.ai = newAI(o);
  S.corpses = S.corpses.filter(c => c.id !== o.id);
  S.rb[i].cd = REBOOT_CD;
  emit({ k: 'reboot', id: o.id, by: p.id, st: i, x: r1(f.x), y: r1(f.y) });
  emitSnd('reboot', R.x, R.y);
}
function plantBomb(p, site) {
  const sp = S.bomb;
  sp.state = 'planted'; sp.x = p.x; sp.y = p.y; sp.site = site; sp.t = BOMB_TIME; sp.carrier = null; sp.prog = 0; sp.half = false; sp.defuser = null;
  p.hasBomb = false; p.plantT = 0; p.ult = Math.min(AGENTS[p.agent].x.pts, p.ult + 1);
  S.phase = 'planted'; S.phaseT = BOMB_TIME; S.planted = true;
  emit({ k: 'plant', x: r1(p.x), y: r1(p.y), site, id: p.id });
}
function explodeBomb() {
  const sp = S.bomb; sp.state = 'exploded'; sp.t = 0;
  emitFx({ t: 'nuke', x: r1(sp.x), y: r1(sp.y) });
  emit({ k: 'snd', s: 'bigboom', x: r1(sp.x), y: r1(sp.y) });
  for (const p of S.players) if (p.alive && dist(p.x, p.y, sp.x, sp.y) < 520) killPlayer(p, null, 'bomb', false);
  endRound(teamOfSide('atk'), 'bomb');
}
/* CAN KÜRESİ: canı 100'den az olan oyuncu üstünden geçince +50 can */
function updateHeal(dt) {
  if (!S.heal) return;
  for (const h of S.heal) {
    if (h.cd > 0) { h.cd = Math.max(0, h.cd - dt); continue; }
    if (S.phase !== 'live' && S.phase !== 'planted') continue;
    for (const p of S.players) if (p.alive && p.hp < HEAL_MAX && (p.jz || 0) < 60 && dist2(p.x, p.y, h.x, h.y) < HEAL_R * HEAL_R) {
      const add = Math.min(HEAL_AMT, HEAL_MAX - p.hp);
      p.hp = Math.max(p.hp, Math.min(HEAL_MAX, p.hp + HEAL_AMT)); h.cd = HEAL_CD; // 100'ün üstündeki (admin) canı düşürmez
      emit({ k: 'heal', id: p.id, a: Math.round(add), x: r1(h.x), y: r1(h.y) });
      emitSnd('heal', h.x, h.y);
      break;
    }
  }
}
/* EMOTE: kısa hareket + başın üstünde emoji (herkese olay olarak gider) */
function hostEmote(p, e) {
  e = e | 0; if (!p || !p.alive || e < 0 || e >= EMOTES.length) return;
  if (S.time - (p._emoT || -9) < 2.5) return;
  p._emoT = S.time;
  emit({ k: 'emo', id: p.id, e, x: r1(p.x), y: r1(p.y) });
}
function updateOrbs() {
  if (S.phase !== 'live' && S.phase !== 'planted') return;
  for (let i = S.orbs.length - 1; i >= 0; i--) {
    const o = S.orbs[i];
    for (const p of S.players) if (p.alive && dist2(p.x, p.y, o.x, o.y) < 26 * 26) {
      const mx = AGENTS[p.agent].x.pts;
      if (p.ult >= mx) continue;
      p.ult++; S.orbs.splice(i, 1);
      emit({ k: 'snd', s: 'orb', x: r1(o.x), y: r1(o.y) });
      emit({ k: 'msg', to: p.id, small: 'ULTİ KÜRESİ +1' });
      break;
    }
  }
}

/* ---------- GEÇİCİ DUVARLAR (TERRA) ---------- */
function addTWall(tiles, hp, life) {
  const id = nid();
  S.twalls.push({ id, tiles, hp, t: life });
  for (const i of tiles) tgrid[i] = id;
  return id;
}
function removeTWall(w) {
  for (const i of w.tiles) if (tgrid[i] === w.id) tgrid[i] = 0;
  const c = w.tiles[(w.tiles.length / 2) | 0];
  emitFx({ t: 'debris', x: (c % MW + 0.5) * TILE, y: (((c / MW) | 0) + 0.5) * TILE });
}
function updateTWalls(dt) {
  for (let i = S.twalls.length - 1; i >= 0; i--) {
    const w = S.twalls[i]; w.t -= dt;
    if (w.t <= 0 || w.hp <= 0) { removeTWall(w); S.twalls.splice(i, 1); }
  }
}
function damageTWall(id, dmg) { const w = S.twalls.find(x => x.id === id); if (w) w.hp -= dmg; }
function clearTempWalls() { if (S) S.twalls.length = 0; tgrid.fill(0); }
