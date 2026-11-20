/* =====================================================================
   05 · BOT YAPAY ZEKASI
        algılama (görüş + ses + takım bilgisi), tepki süresi, nişan hatası,
        siper alma, A* ile rota, spike görevleri, ajan bazlı yetenek kullanımı,
        ekonomik satın alma
   ===================================================================== */
/* hsP: nişan tekrarında kafaya gitme olasılığı (geri kalan atışlar göğüs/gövdeye) */
const DIFF = {
  kolay: { react: 0.6, err: 0.2, settle: 2.2, turn: 5.5, hsOff: 13, aimC: 41, hsP: 0.08, crouch: 0.1, burst: 2, abil: 0.5, lead: 0 },
  normal: { react: 0.36, err: 0.11, settle: 4, turn: 9, hsOff: 11, aimC: 44, hsP: 0.16, crouch: 0.3, burst: 3, abil: 0.8, lead: 0.5 },
  zor: { react: 0.2, err: 0.055, settle: 6.5, turn: 14, hsOff: 9, aimC: 46, hsP: 0.27, crouch: 0.45, burst: 4, abil: 1, lead: 0.9 }
};
/* Hedefle arada takım arkadaşı var mı (takım ateşinden kaçınmak için) */
function allyInLine(p, t) {
  const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  for (const o of S.players) {
    if (!o.alive || o === p || o.team !== p.team) continue;
    const ox = o.x - p.x, oy = o.y - p.y, al = ox * ux + oy * uy;
    if (al <= 0 || al >= d + 110) continue; // hedefin hemen arkasındaki arkadaş da risk altında
    if (Math.abs(ox * uy - oy * ux) < PR + 14) return true;
  }
  return false;
}
function rollHsOff(ai, D) { ai.hsOff = Math.random() < (D.hsP || 0.15) ? 66 - D.aimC + rand(-3, 3) : rand(-D.hsOff, D.hsOff * 0.55); }
function newAI() {
  return {
    path: null, pi: 0, goal: null, goalKey: '', repathT: 0, think: 0, target: null, visNow: null, reactT: 0, aimErr: 0, hsOff: 0,
    lastSeen: -9, lk: null, strafe: 1, strafeT: 0, pauseT: 0, stuckT: 0, lastPos: null, cover: null, retreatT: 0, coverTried: false,
    used: {}, nextAbil: 0, buyDone: false, buyT: rand(0.4, 3), route: null, hold: null, holdRole: null, plantSpot: null,
    clearSpot: null, post: null, reviveGoal: null, wander: null
  };
}
function makeRoundPlan() {
  const site = Math.random() < 0.5 ? 'A' : 'B';
  const atk = S.players.filter(p => sideOf(p.team) === 'atk'), def = S.players.filter(p => sideOf(p.team) === 'def');
  const plan = { site, roles: {}, routes: {}, smoked: false, sonar: false, rotate: null, rotateT: 0 };
  atk.forEach((p, i) => { plan.routes[p.id] = (i % 3 === 2) ? 'mid' : 'main'; });
  const base = def.length === 1 ? [pick(['A', 'B'])] : def.length === 2 ? ['A', 'B'] : ['A', 'B', 'M', 'A', 'B'];
  const roles = shuffle(base.slice(0, Math.max(1, def.length)));
  def.forEach((p, i) => { plan.roles[p.id] = roles[i % roles.length]; });
  return plan;
}
function knownEnemies(team, maxAge) {
  const out = [], K = S.known[team];
  for (const id in K) { const e = getP(id); if (e && e.alive && S.time - K[id].t < maxAge) out.push({ id, x: K[id].x, y: K[id].y, t: K[id].t }); }
  return out;
}
function botsHear(x, y, team, radius) {
  if (!S) return;
  for (const b of S.players) {
    if (!b.ai || !b.alive || b.team === team || b.st.deaf > 0 || b.ai.visNow) continue;
    if (dist2(b.x, b.y, x, y) < radius * radius) b.ai.lk = { x: x + rand(-50, 50), y: y + rand(-50, 50), t: S.time };
  }
}
function botOnDamaged(t, att) {
  const ai = t.ai; if (!ai || !att || att.team === t.team) return; // takım ateşine dönüp ateş etme
  if (!ai.visNow) { ai.lk = { x: att.x, y: att.y, t: S.time }; }
}

function botUpdate(p, dt) {
  if (p._emoAt && S.time >= p._emoAt) { p._emoAt = 0; hostEmote(p, p._emoE); }
  const ai = p.ai, inp = p.input, D = DIFF[S.cfg.diff] || DIFF.normal;
  inp.mvx = 0; inp.mvy = 0; inp.fire = false; inp.use = false; inp.walk = false; inp.alt = false; inp.crouch = false;
  if (!p.alive || S.phase === 'over') return;
  if (S.phase === 'buy') {
    botBuy(p, dt);
    if (!ai.wander || dist(p.x, p.y, ai.wander.x, ai.wander.y) < 12) {
      const side = sideOf(p.team), sp = pick(MAPDATA.spawns[side]); ai.wander = tc(sp[0], sp[1]);
    }
    if (Math.random() < 0.02) { const dx = ai.wander.x - p.x, dy = ai.wander.y - p.y, l = Math.hypot(dx, dy) || 1; inp.mvx = dx / l; inp.mvy = dy / l; inp.walk = true; }
    p.ang = rotToward(p.ang, sideOf(p.team) === 'atk' ? -Math.PI / 2 : Math.PI / 2, 2 * dt);
    p.pitch = 0; inp.ang = p.ang; inp.pitch = 0; return;
  }
  perceive(p, ai, D, dt);
  ai.think -= dt;
  if (ai.think <= 0) { ai.think = 0.12 + Math.random() * 0.1; botThink(p, ai, D); }
  botAct(p, ai, D, dt);
  inp.ang = p.ang; inp.pitch = p.pitch || 0; inp.mx = p.x + Math.cos(p.ang) * 300; inp.my = p.y + Math.sin(p.ang) * 300;
}

function perceive(p, ai, D, dt) {
  let best = null, bd = 1e9;
  const blind = p.st.blind > 0.3;
  for (const e of S.players) {
    if (e.team === p.team || !e.alive) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    const vis = !blind && canSee(p, e);
    if (vis) { if (d < bd) { bd = d; best = e; } S.known[p.team][e.id] = { x: e.x, y: e.y, t: S.time }; }
    else if (e.st.reveal > 0) {
      S.known[p.team][e.id] = { x: e.x, y: e.y, t: S.time };
      if (d < 1300 && (!ai.lk || S.time - ai.lk.t > 0.6)) ai.lk = { x: e.x, y: e.y, t: S.time };
    }
  }
  if (best) {
    if (ai.target !== best.id) {
      ai.target = best.id;
      ai.reactT = D.react * rand(0.8, 1.35) * (S.time - ai.lastSeen < 1 ? 0.5 : 1) * (p.st.concuss > 0 ? 1.6 : 1);
      ai.aimErr = (Math.random() < 0.5 ? -1 : 1) * D.err * rand(0.8, 2.2) * (p.st.concuss > 0 ? 2.5 : 1);
      rollHsOff(ai, D); ai.crouchEng = Math.random() < (D.crouch || 0);
    }
    ai.lastSeen = S.time; ai.lk = { x: best.x, y: best.y, t: S.time };
  } else if (ai.target && S.time - ai.lastSeen > 0.4) ai.target = null;
  ai.visNow = best;
  if (ai.reactT > 0) ai.reactT -= dt;
}

function botThink(p, ai, D) {
  const vis = ai.visNow;
  if (S.time >= ai.nextAbil) { ai.nextAbil = S.time + rand(0.7, 2.2) / D.abil; botAbilities(p, ai, D); }
  const wid = curW(p), w = WEAPONS[wid], am = p.ammo[wid];
  if (!vis && am && am.mag < w.mag * 0.45 && am.res > 0 && p.reloadT <= 0 && !(S.time - ai.lastSeen < 1.2)) startReload(p);
  // KILIÇ: sakin ve uzun yolda kılıçla koş (daha hızlı), tehlike sezince silaha dön
  const calm = !vis && S.time - ai.lastSeen > 2.5 && !(ai.lk && S.time - ai.lk.t < 3) && (S.phase === 'live' || S.phase === 'planted');
  const longTrip = ai.path && ai.path.length - ai.pi > 14 && !(ai.goal && (ai.goal.hold || ai.goal.use));
  if (p.slot !== 3 && calm && longTrip && p.reloadT <= 0) switchSlot(p, 3);
  else if (p.slot === 3 && !(calm && longTrip)) switchSlot(p, p.primary ? 1 : 2);
  else if (!vis && p.slot === 2 && p.primary && p.reloadT <= 0) switchSlot(p, 1);
  // takılma tespiti
  if (!ai.lastPos) ai.lastPos = { x: p.x, y: p.y, t: S.time };
  if (S.time - ai.lastPos.t > 1.2) {
    const moved = dist(p.x, p.y, ai.lastPos.x, ai.lastPos.y);
    if (moved < 18 && ai.path && ai.pi < ai.path.length && !(ai.goal && (ai.goal.hold || ai.goal.use))) { ai.repathT = 0; ai.stuck = (ai.stuck || 0) + 1; }
    else ai.stuck = 0;
    ai.lastPos = { x: p.x, y: p.y, t: S.time };
  }
  const g = botGoal(p, ai);
  ai.goal = g;
  if (g && (g.key !== ai.goalKey || S.time > ai.repathT)) {
    ai.path = findPath(p.x, p.y, g.x, g.y); ai.pi = 0; ai.goalKey = g.key; ai.repathT = S.time + 2.5;
    if (ai.stuck > 1 && ai.path && ai.path.length) { ai.pi = 0; ai.stuck = 0; }
  }
}

function threatSite(team) {
  const ks = knownEnemies(team, 4), cnt = { A: 0, B: 0 };
  for (const k of ks) for (const s of ['A', 'B']) {
    const c = tc(...MAPDATA.sites[s].center);
    if (dist(k.x, k.y, c.x, c.y) < 800 * MS) cnt[s]++;
  }
  const sp = S.spike;
  if (sp.state === 'carried' || sp.state === 'dropped') {
    const car = getP(sp.carrier);
    if ((car && S.known[team][car.id] && S.time - S.known[team][car.id].t < 3) || sp.state === 'dropped') {
      for (const s of ['A', 'B']) { const c = tc(...MAPDATA.sites[s].center); if (dist(sp.x, sp.y, c.x, c.y) < 900 * MS) cnt[s] += 2; }
    }
  }
  if (cnt.A >= 2 && cnt.A > cnt.B) return 'A';
  if (cnt.B >= 2 && cnt.B > cnt.A) return 'B';
  return null;
}

function botGoal(p, ai) {
  const side = sideOf(p.team), sp = S.spike, plan = S.plan;
  if (ai.retreatT > S.time && ai.cover) return { x: ai.cover.x, y: ai.cover.y, key: 'cv' + (ai.cover.x | 0), look: ai.lk };
  if (ai.reviveGoal) {
    const c = S.corpses.find(c => c.id === ai.reviveGoal);
    if (c && p.ult >= AGENTS.vital.x.pts) return { x: c.x, y: c.y, key: 'rv' + c.id };
    ai.reviveGoal = null;
  }
  const rbg = rebootGoal(p, ai);
  if (rbg) return rbg;
  const hg = healGoal(p, ai);
  if (hg) return hg;
  if (side === 'atk') {
    if (sp.state === 'planted') {
      if (sp.defuser && S.time - (S.defAlert || -9) < 8) return { x: sp.x, y: sp.y, key: 'stopdef', look: { x: sp.x, y: sp.y } };
      if (!ai.post) {
        const c = pick(MAPDATA.sites[sp.site].post), a = tc(c[0], c[1]);
        ai.post = { x: a.x, y: a.y };
      }
      const at = dist(p.x, p.y, ai.post.x, ai.post.y) < 30;
      return { x: ai.post.x, y: ai.post.y, key: 'post', look: { x: sp.x, y: sp.y }, hold: at };
    }
    if (sp.state === 'dropped' && !(sp.res && sp.res.id !== p.id && S.time < sp.res.t)) {
      let near = null, nd = 1e9;
      for (const o of S.players) if (o.alive && o.team === p.team && o.ai) { const d = dist(o.x, o.y, sp.x, sp.y); if (d < nd) { nd = d; near = o; } }
      if (near === p) return { x: sp.x, y: sp.y, key: 'spk' + (sp.x | 0) };
    }
    const site = MAPDATA.sites[plan.site];
    if (!ai.route) ai.route = (plan.routes[p.id] === 'mid' ? site.routeMid : site.routeMain).map(w => tc(w[0], w[1]));
    while (ai.route.length && dist(p.x, p.y, ai.route[0].x, ai.route[0].y) < 80) ai.route.shift();
    if (p.hasSpike) {
      if (ai.route.length) return { x: ai.route[0].x, y: ai.route[0].y, key: 'r' + ai.route.length };
      if (!ai.plantSpot) { const c = pick(site.plant); ai.plantSpot = tc(c[0], c[1]); }
      const d = dist(p.x, p.y, ai.plantSpot.x, ai.plantSpot.y);
      if (siteAt(p.x, p.y) === plan.site && d < 45) return { x: p.x, y: p.y, key: 'plant', use: !ai.visNow, hold: true };
      return { x: ai.plantSpot.x, y: ai.plantSpot.y, key: 'ps' };
    }
    if (ai.route.length) return { x: ai.route[0].x, y: ai.route[0].y, key: 'r' + ai.route.length };
    if (!ai.clearSpot) { const c = pick(site.clear); ai.clearSpot = tc(c[0], c[1]); }
    const at = dist(p.x, p.y, ai.clearSpot.x, ai.clearSpot.y) < 30;
    const dc = tc(...MAPDATA.defCenter);
    return { x: ai.clearSpot.x, y: ai.clearSpot.y, key: 'clr', hold: at, look: at ? { x: lerp(ai.clearSpot.x, dc.x, 0.4), y: lerp(ai.clearSpot.y, dc.y, 0.4) } : null };
  }
  // SAVUNMA
  if (sp.state === 'planted') {
    // AZİM: kurulu Spike'ı geri almak için birlikte gir, zaman daralınca ne olursa olsun imha et
    const d = dist(p.x, p.y, sp.x, sp.y), need = (DEFUSE_TIME - (sp.half ? DEFUSE_TIME / 2 : 0)) / (p.kit ? DEFUSE_TIME / KIT_TIME : 1);
    const critical = sp.t < need + 2.5;
    if (d < 40) {
      const threats = knownEnemies(p.team, 2.5).filter(k => dist(k.x, k.y, sp.x, sp.y) < 550 * MS).length;
      const commit = critical || sp.half || threats === 0 || (sp.defuser === p.id && sp.prog > 1.2);
      return { x: p.x, y: p.y, key: 'def', use: commit && (!ai.visNow || critical), hold: true, force: critical };
    }
    const mates = S.players.filter(o => o.alive && o.team === p.team && o !== p);
    const ahead = mates.filter(o => dist(o.x, o.y, sp.x, sp.y) < d + 260).length;
    if (mates.length && !ahead && d > 350 && d < 1100 && sp.t > need + 16 && !critical) {
      ai.stageT = ai.stageT || S.time + 7; // en fazla 7 sn bekle
      if (S.time < ai.stageT) return { x: p.x, y: p.y, key: 'stage', hold: true, look: { x: sp.x, y: sp.y } };
    }
    return { x: sp.x, y: sp.y, key: 'dg' };
  }
  let role = plan.roles[p.id] || 'A';
  if (S.time > plan.rotateT) { plan.rotate = threatSite(p.team); plan.rotateT = S.time + 1.5; }
  if (plan.rotate && (role === 'M' || Math.random() < 0.002 || ai.holdRole === plan.rotate)) role = plan.rotate;
  if (!ai.hold || ai.holdRole !== role) {
    const holds = role === 'M' ? MAPDATA.midHold : MAPDATA.sites[role].hold;
    const mates = S.players.filter(o => o.team === p.team && (plan.roles[o.id] === role)).map(o => o.id);
    const idx = Math.max(0, mates.indexOf(p.id)) % holds.length;
    const h = holds[(idx + (role === plan.rotate ? randi(0, 2) : 0)) % holds.length], a = tc(h[0], h[1]), l = tc(h[2], h[3]);
    ai.hold = { x: a.x + rand(-10, 10), y: a.y + rand(-10, 10), lx: l.x, ly: l.y }; ai.holdRole = role;
  }
  const at = dist(p.x, p.y, ai.hold.x, ai.hold.y) < 30;
  return { x: ai.hold.x, y: ai.hold.y, key: 'h' + role + (ai.hold.x | 0), look: { x: ai.hold.lx, y: ai.hold.ly }, hold: at };
}

/* REBOOT görevleri: elindeki kartı istasyona götür, yakındaki takım kartını al */
/* Canı düşük bot, çatışmada değilse yakındaki can küresine uğrar */
function healGoal(p, ai) {
  if (!S.heal || !S.heal.length || p.hp > 55 || ai.visNow) return null;
  if (S.phase !== 'live' && S.phase !== 'planted') return null;
  const sp = S.spike, side = sideOf(p.team);
  if (side === 'def' && sp.state === 'planted' && sp.t < 25) return null;
  if (side === 'atk' && sp.state === 'planted' && sp.defuser) return null;
  if (p.hasSpike && S.phase === 'live' && p.hp > 30) return null;
  let best = null, bd = 1e9;
  for (const h of S.heal) if (h.cd <= 0) { const d = dist(p.x, p.y, h.x, h.y); if (d < bd) { bd = d; best = h; } }
  if (!best || bd > 1300) return null;
  for (const o of S.players) if (o !== p && o.alive && o.team === p.team && o.ai && o.hp < p.hp && dist(o.x, o.y, best.x, best.y) < bd - 60) return null;
  return { x: best.x, y: best.y, key: 'hl' + best.id };
}
function rebootGoal(p, ai) {
  if (!S.cards || !S.cards.length || !MAPDATA.reboot || !MAPDATA.reboot.length) return null;
  if ((S.phase !== 'live' && S.phase !== 'planted') || ai.visNow) return null;
  const side = sideOf(p.team), sp = S.spike;
  if (side === 'def' && sp.state === 'planted' && sp.t < 30) return null;   // önce Spike
  if (p.hasSpike && S.phase === 'live') return null;                         // taşıyıcı kurulumdan sapmaz
  const mine = S.cards.filter(c => c.carrier === p.id);
  if (mine.length) {
    let best = -1, bd = 1e9;
    const ks = knownEnemies(p.team, 4);
    MAPDATA.reboot.forEach((r, i) => {
      let d = dist(p.x, p.y, r.ax, r.ay) + (S.rb[i] && S.rb[i].cd > 0 ? S.rb[i].cd * RUN * 0.6 : 0);
      if (ks.some(k => dist(k.x, k.y, r.x, r.y) < 700)) d += 2500;
      if (d < bd) { bd = d; best = i; }
    });
    const r = MAPDATA.reboot[best], at = dist(p.x, p.y, r.ax, r.ay) < 34;
    return { x: r.ax, y: r.ay, key: 'rb' + best, use: at && !(S.rb[best] && S.rb[best].cd > 0), hold: at, look: { x: r.x, y: r.y } };
  }
  let card = null, cd = 1e9;
  for (const c of S.cards) if (!c.carrier && c.team === p.team) { const d = dist(p.x, p.y, c.x, c.y); if (d < cd) { cd = d; card = c; } }
  if (!card || cd > 1500) return null;
  for (const o of S.players) if (o !== p && o.alive && o.team === p.team && o.ai && !o.hasSpike && dist(o.x, o.y, card.x, card.y) < cd - 40) return null;
  return { x: card.x, y: card.y, key: 'card' + card.id };
}
function followPath(p, ai, inp) {
  if (!ai.path || ai.pi >= ai.path.length) return false;
  if (ai.pi < ai.path.length - 1) {
    const nx = ai.path[ai.pi + 1];
    if (walkLine(p.x, p.y, nx.x, nx.y, PR + 1)) ai.pi++;
  }
  let wp = ai.path[ai.pi];
  if (dist(p.x, p.y, wp.x, wp.y) < 14) { ai.pi++; if (ai.pi >= ai.path.length) return false; wp = ai.path[ai.pi]; }
  const dx = wp.x - p.x, dy = wp.y - p.y, l = Math.hypot(dx, dy) || 1;
  inp.mvx = dx / l; inp.mvy = dy / l;
  if (ai.stuck > 0) { inp.mvx += rand(-0.6, 0.6); inp.mvy += rand(-0.6, 0.6); }
  return true;
}
function findCover(p, e) {
  for (const r of [70, 120, 170, 230]) {
    let best = null, bd = 1e9;
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * TAU, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      if (circleHits(x, y, PR + 2) || !walkLine(p.x, p.y, x, y, PR)) continue;
      if (losClear(e.x, e.y, x, y, true)) continue;
      const d = dist(x, y, e.x, e.y);
      if (-d < bd) { bd = -d; best = { x, y }; }
    }
    if (best) return best;
  }
  return null;
}

function botAct(p, ai, D, dt) {
  const inp = p.input, t = ai.visNow, wid = curW(p), w = WEAPONS[wid];
  const gg = ai.goal;
  if (gg && gg.force && gg.use && dist(p.x, p.y, S.spike.x, S.spike.y) < 50) { inp.use = true; inp.crouch = true; return; }
  if (t && w.melee) {
    // kılıç eldeyken düşman: yakınsa sapla, değilse silaha geç
    const d0 = dist(p.x, p.y, t.x, t.y);
    if (d0 > swordStats(p).reach + PR + 30 || ai.reactT > 0.15) { switchSlot(p, p.primary ? 1 : 2); }
    else {
      const a0 = Math.atan2(t.y - p.y, t.x - p.x); p.ang = rotToward(p.ang, a0, D.turn * dt);
      moveToward(p, inp, t.x, t.y);
      if (Math.abs(angDiff(p.ang, a0)) < 0.5 && ai.reactT <= 0) inp.fire = true;
      return;
    }
  }
  if (t) {
    const d = dist(p.x, p.y, t.x, t.y);
    const lead = D.lead * Math.min(0.12, d / 4000);
    const tx = t.x + (t.vx || 0) * lead, ty = t.y + (t.vy || 0) * lead;
    const base = Math.atan2(ty - p.y, tx - p.x);
    ai.aimErr *= Math.exp(-D.settle * dt);
    ai.hsT = (ai.hsT || 0) - dt;
    if (ai.hsT <= 0) { ai.hsT = rand(0.18, 0.45); rollHsOff(ai, D); }
    const desired = base + ai.aimErr + (p.st.concuss > 0 ? Math.sin(S.time * 9) * 0.12 : 0);
    p.ang = rotToward(p.ang, desired, D.turn * dt);
    const myEye = eyeOf(p), tLift = t.st.knock > 0 ? KNOCK_LIFT : 0;
    const tLift2 = tLift + (t.jz || 0);
    let aimH = (t.crouch ? D.aimC - 23 : D.aimC) + ai.hsOff * (t.crouch ? 0.72 : 1) + tLift2;
    if (!losClear(p.x, p.y, t.x, t.y, true, myEye, (t.crouch ? 26 : 42) + tLift2)) aimH = (t.crouch ? 40 : 54) + tLift2 + Math.min(ai.hsOff, 12) * 0.5;
    p.pitch = rotToward(p.pitch || 0, Math.atan2(aimH - myEye, Math.max(d, 1)) + ai.aimErr * 0.15, D.turn * dt);
    const aimed = Math.abs(angDiff(p.ang, desired)) < 0.05 + 12 / Math.max(d, 1);
    if (p.st.ovl > 0) {
      if (d < 560) inp.fire = true;
      const dx = t.x - p.x, dy = t.y - p.y; inp.mvx = dx / d; inp.mvy = dy / d;
      if (d < 150) { const pa = base + Math.PI / 2 * ai.strafe; inp.mvx = Math.cos(pa); inp.mvy = Math.sin(pa); }
      return;
    }
    const blocked = allyInLine(p, t);
    if (blocked) { // arada takım arkadaşı: ateş etme, yana açıl
      const pa = base + Math.PI / 2 * ai.strafe; inp.mvx = Math.cos(pa); inp.mvy = Math.sin(pa);
      if (circleHits(p.x + inp.mvx * 24, p.y + inp.mvy * 24, PR)) { ai.strafe *= -1; inp.mvx = -inp.mvx; inp.mvy = -inp.mvy; }
    }
    if (ai.reactT <= 0 && aimed && !p.st.lock && !blocked) {
      if (ai.pauseT > 0) ai.pauseT -= dt;
      else if (w.auto) { inp.fire = true; if (d > 420 && p.shotN >= D.burst) ai.pauseT = 0.26; }
      else if (p.fireCD <= 0 && !p.pend) inp.fp = (inp.fp + 1) | 0;
    }
    if (w.scope) inp.alt = d > 260;
    // savaşta hareket
    if (ai.retreatT > S.time && ai.cover) { moveToward(p, inp, ai.cover.x, ai.cover.y); }
    else {
      if (p.hp < 45 && !ai.coverTried) {
        ai.coverTried = true;
        const c = findCover(p, t);
        if (c) { ai.cover = c; ai.retreatT = S.time + 1.7; }
      }
      if (d < 420 && !w.scope) {
        ai.strafeT -= dt;
        if (ai.strafeT <= 0) { ai.strafe *= -1; ai.strafeT = rand(0.22, 0.6); }
        const pa = base + Math.PI / 2 * ai.strafe;
        inp.mvx = Math.cos(pa); inp.mvy = Math.sin(pa);
        if (circleHits(p.x + inp.mvx * 24, p.y + inp.mvy * 24, PR)) { ai.strafe *= -1; inp.mvx = -inp.mvx; inp.mvy = -inp.mvy; }
        if (S.cfg.diff !== 'kolay' && (p.fireCD <= 0.03 || !w.auto)) inp.walk = true;
      }
    }
    if (ai.crouchEng && d > 380 && !inp.mvx && !inp.mvy && !(ai.retreatT > S.time) && losClear(p.x, p.y, t.x, t.y, true, EYE_C, aimH)) inp.crouch = true;
    return;
  }
  ai.pauseT = 0;
  p.pitch = rotToward(p.pitch || 0, 0, 2 * dt);
  // görünür hedef yok
  let desired = null;
  const lkRecent = ai.lk && S.time - ai.lk.t < 3.5;
  const g = ai.goal;
  const moving = followPath(p, ai, inp);
  if (lkRecent) desired = Math.atan2(ai.lk.y - p.y, ai.lk.x - p.x);
  else if (g && g.look && (g.hold || !moving)) desired = Math.atan2(g.look.y - p.y, g.look.x - p.x);
  else if (moving) desired = Math.atan2(inp.mvy, inp.mvx);
  if (desired !== null) p.ang = rotToward(p.ang, desired, D.turn * 0.55 * dt);
  if (g && g.use) { inp.use = true; inp.mvx = 0; inp.mvy = 0; inp.crouch = true; }
  if (g && g.hold && !moving && g.look) {
    const la = Math.atan2(g.look.y - p.y, g.look.x - p.x);
    for (const dd of [28, 55, 80]) if (rayKind(Math.floor((p.x + Math.cos(la) * dd) / TILE), Math.floor((p.y + Math.sin(la) * dd) / TILE)) === 2) { inp.crouch = true; break; }
  }
  if (p.st.ovl > 0 && lkRecent && !moving) moveToward(p, inp, ai.lk.x, ai.lk.y);
  if (lkRecent && g && g.hold && sideOf(p.team) === 'def' && dist(p.x, p.y, ai.lk.x, ai.lk.y) < 500) inp.walk = true;
  if (w.scope && g && g.hold) inp.alt = true;
}
function moveToward(p, inp, x, y) {
  const dx = x - p.x, dy = y - p.y, l = Math.hypot(dx, dy);
  if (l < 8) return;
  inp.mvx = dx / l; inp.mvy = dy / l;
}

/* ---------- SATIN ALMA ---------- */
function botBuy(p, dt) {
  const ai = p.ai; if (ai.buyDone) return;
  ai.buyT -= dt; if (ai.buyT > 0) return;
  ai.buyDone = true;
  const pistol = S.round === 1 || S.round === HALF_ROUNDS + 1;
  if (pistol) {
    const r = Math.random();
    if (r < 0.5) buyItem(p, 'light'); else if (r < 0.75) buyItem(p, 'sheriff');
  } else if (!p.primary) {
    const c = p.credits;
    if (c >= 3300) buyItem(p, (c >= 5800 && Math.random() < 0.2) ? 'operator' : (c >= 4900 && Math.random() < 0.18) ? 'railgun' : pick(['vandal', 'phantom']));
    else if (c >= 2100) buyItem(p, 'spectre');
    else if (c >= 800 && p.secondary === 'classic' && Math.random() < 0.55) buyItem(p, 'sheriff');
  }
  if (!pistol) {
    if (p.credits >= 1000 && p.armor < 50) buyItem(p, 'heavy');
    else if (p.credits >= 400 && p.armor < 25) buyItem(p, 'light');
  }
  // savunan botlar: takımda en fazla 2 kit
  if (!pistol && sideOf(p.team) === 'def' && !p.kit && p.credits >= KIT_PRICE + 100 && S.players.filter(o => o.team === p.team && o.kit).length < 2 && Math.random() < 0.7) buyItem(p, 'kit');
  const ag = AGENTS[p.agent];
  for (const k of shuffle(['q', 'e'])) {
    let guard = 0;
    while (p.ch[k] < ag[k].max && p.credits >= ag[k].cost && guard++ < 4) { if (!buyItem(p, k)) break; }
  }
}

/* ---------- AJAN BAZLI YETENEK KULLANIMI ---------- */
function botAbilities(p, ai) {
  if (!canAct(p) || (S.phase !== 'live' && S.phase !== 'planted') || p.plantT > 0 || p.defT > 0) return;
  const side = sideOf(p.team), sp = S.spike, vis = ai.visNow, now = S.time;
  const lk = ai.lk && now - ai.lk.t < 3 ? ai.lk : null;
  const tk = knownEnemies(p.team, 5).sort((a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y));
  const siteKey = side === 'atk' ? S.plan.site : (ai.holdRole && ai.holdRole !== 'M' ? ai.holdRole : null);
  const siteC = siteKey ? tc(...MAPDATA.sites[siteKey].center) : null;
  const dSite = siteC ? dist(p.x, p.y, siteC.x, siteC.y) : 1e9;
  const ready = p.ult >= AGENTS[p.agent].x.pts;
  const U = (k, t) => useAbility(p, k, t ? { x: t.x, y: t.y } : undefined);
  const has = k => p.ch[k] > 0;
  const D2 = o => o ? dist(p.x, p.y, o.x, o.y) : 1e9;
  const tgt = vis || lk;
  const preplant = sp.state !== 'planted';
  const faceTo = o => { p.ang = Math.atan2(o.y - p.y, o.x - p.x); };
  switch (p.agent) {
    case 'vex':
      if (ready && tgt && D2(tgt) < 1700) { U('x', tgt); return; }
      if (has('q') && vis && p.hp < 45 && D2(vis) < 420) {
        const a = Math.atan2(p.y - vis.y, p.x - vis.x) + rand(-0.6, 0.6); p.input.mvx = Math.cos(a); p.input.mvy = Math.sin(a); U('q'); return;
      }
      if (has('e') && !vis && lk && D2(lk) < 700 && Math.random() < 0.4) { U('e'); return; }
      if (has('q') && side === 'atk' && !vis && preplant && dSite < 520 * MS && !ai.used.dash) { ai.used.dash = 1; U('q'); }
      break;
    case 'ignis':
      if (ready && (vis || (lk && D2(lk) < 900))) { U('x'); return; }
      if (has('q') && !vis && lk && D2(lk) < 720 && D2(lk) > 140) { U('q', lk); return; }
      if (has('q') && side === 'atk' && preplant && dSite < 720 * MS && !ai.used.flash) { ai.used.flash = 1; U('q', siteC); return; }
      if (has('e') && vis && p.hp < 55) { faceTo(vis); U('e', vis); return; }
      if (has('e') && p.hasSpike && ai.plantSpot && D2(ai.plantSpot) < 140 && tk.length) { U('e', tk[0]); }
      break;
    case 'mist':
      if (has('q') && side === 'atk' && preplant && dSite < 1050 * MS && !S.plan.smoked) {
        S.plan.smoked = true;
        for (const s of MAPDATA.sites[siteKey].smokeAtk) if (has('q')) U('q', tc(s[0], s[1]));
        return;
      }
      if (has('q') && side === 'def' && siteKey && !ai.used.sdef && tk.some(k => dist(k.x, k.y, siteC.x, siteC.y) < 850 * MS)) {
        ai.used.sdef = 1; const s = MAPDATA.sites[siteKey].smokeDef[0]; U('q', tc(s[0], s[1])); return;
      }
      if (has('q') && side === 'def' && !preplant && !ai.used.sret && tk.length) { ai.used.sret = 1; U('q', tk[0]); return; }
      if (has('e') && tgt && D2(tgt) < 720) { U('e', tgt); return; }
      if (ready && !preplant && D2(sp) < 1350) { U('x', sp); return; }
      if (ready && vis && tk.length >= 2) U('x', vis);
      break;
    case 'aegis': {
      if (ready && (vis || !preplant) && tk.filter(k => D2(k) < 400).length >= 1) { U('x'); return; }
      const atHold = ai.hold && D2(ai.hold) < 60;
      if (side === 'def' && atHold && preplant) {
        const look = { x: ai.hold.lx, y: ai.hold.ly };
        if (has('e') && !ai.used.tur) { ai.used.tur = 1; faceTo(look); U('e', look); return; }
        if (has('q') && (ai.used.mines || 0) < 2) {
          ai.used.mines = (ai.used.mines || 0) + 1;
          const a = Math.atan2(look.y - p.y, look.x - p.x) + rand(-0.3, 0.3), d = rand(90, 150);
          U('q', { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }); return;
        }
      }
      if (side === 'atk' && !preplant && D2(sp) < 200) {
        const dc = tc(...MAPDATA.defCenter);
        if (has('e') && !ai.used.tur) { ai.used.tur = 1; faceTo(dc); U('e', dc); return; }
        if (has('q') && !ai.used.pm) { ai.used.pm = 1; U('q', sp); return; }
      }
      break;
    }
    case 'pulse':
      if (has('q') && side === 'atk' && preplant && dSite < 1300 * MS && !S.plan.sonar) { S.plan.sonar = true; U('q', siteC); return; }
      if (has('q') && side === 'def' && !preplant && !ai.used.sq && D2(sp) < 1300) { ai.used.sq = 1; U('q', sp); return; }
      if (has('e') && !vis && lk && D2(lk) < 1000) { U('e', lk); return; }
      if (ready && tk.length && D2(tk[0]) < 2000) { faceTo(tk[0]); U('x', tk[0]); }
      break;
    case 'chrono':
      if (has('q') && vis && p.hp < 70 && D2(vis) < 650) { U('q', p); return; }
      if (has('q') && p.hasSpike && ai.plantSpot && D2(ai.plantSpot) < 90) { U('q', p); return; }
      if (has('e') && vis && p.hp < 40) {
        const a = Math.atan2(p.y - vis.y, p.x - vis.x); U('e', { x: p.x + Math.cos(a) * 300, y: p.y + Math.sin(a) * 300 }); return;
      }
      if (has('e') && side === 'atk' && preplant && !vis && dSite < 760 * MS && !ai.used.tpe && ai.path && ai.path[ai.pi + 2]) { ai.used.tpe = 1; U('e', ai.path[Math.min(ai.path.length - 1, ai.pi + 4)]); return; }
      if (ready && (vis || tk.length >= 2)) { U('x', vis || tk[0]); }
      break;
    case 'terra':
      if (has('q') && vis && D2(vis) < 520) { faceTo(vis); U('q', vis); return; }
      if (ready && tgt && D2(tgt) < 900) { faceTo(tgt); U('x', tgt); return; }
      if (has('e') && vis && p.hp < 40) { faceTo(vis); U('e', vis); return; }
      if (has('e') && lk && ((p.hasSpike && ai.plantSpot && D2(ai.plantSpot) < 90) || (side === 'def' && !preplant && D2(sp) < 90))) { faceTo(lk); U('e', lk); }
      break;
    case 'vital': {
      if (ready) {
        const c = S.corpses.filter(c => { const r = getP(c.id); return r && !r.alive && r.team === p.team; }).sort((a, b) => D2(a) - D2(b))[0];
        if (c && D2(c) < 260 && !vis) { U('x'); ai.reviveGoal = null; return; }
        if (c && D2(c) < 900 && !vis && !tk.some(k => dist(k.x, k.y, c.x, c.y) < 450)) ai.reviveGoal = c.id;
      }
      if (has('q') && !vis && p.hp < 70) { U('q', p); return; }
      const hurt = S.players.find(o => o.alive && o.team === p.team && o !== p && o.hp < 60 && D2(o) < 400);
      if (has('q') && hurt && !vis) { U('q', hurt); return; }
      if (has('e') && tgt && D2(tgt) < 720) { U('e', tgt); return; }
      if (has('e') && side === 'def' && siteKey && preplant && !ai.used.ice && tk.some(k => dist(k.x, k.y, siteC.x, siteC.y) < 750 * MS)) {
        ai.used.ice = 1; const s = MAPDATA.sites[siteKey].smokeDef[0]; U('e', tc(s[0], s[1]));
      }
      break;
    }
    case 'volt':
      if (ready && vis && D2(vis) < 600) { U('x'); return; }
      if (has('e') && vis && D2(vis) < 640) { faceTo(vis); U('e', vis); return; }
      if (has('q') && vis && D2(vis) < 300 && p.hp < 50) {
        const a = Math.atan2(p.y - vis.y, p.x - vis.x); p.input.mvx = Math.cos(a); p.input.mvy = Math.sin(a); U('q'); return;
      }
      if (has('q') && !vis && ai.path && ai.path.length - ai.pi > 14 && !ai.used.vq) { ai.used.vq = 1; U('q'); }
      break;
    case 'phantom':
      if (has('q') && lk && !vis && D2(lk) < 800) { U('q', lk); return; }
      if (has('e') && !vis && lk && D2(lk) < 900) { U('e', lk); return; }
      if (has('e') && side === 'atk' && preplant && dSite < 900 * MS && !ai.used.wolf) { ai.used.wolf = 1; U('e', siteC); return; }
      if (ready && ((side === 'atk' && preplant && dSite < 900 * MS) || (side === 'def' && !preplant))) U('x');
      break;
  }
}
