/* =====================================================================
   04 · AJAN YETENEKLERİ (10 ajan × Q / E / X)
        mermiler (projectile), alanlar (area), cihazlar (deployable),
        huzmeler (beam) ve bunların güncelleme mantığı
   ===================================================================== */
function aimAng(p, t) { return (t && t.ang !== undefined) ? t.ang : p.ang; }
function clampRange(p, t, R) {
  const d = dist(p.x, p.y, t.x, t.y);
  if (d <= R) return { x: t.x, y: t.y };
  const a = Math.atan2(t.y - p.y, t.x - p.x);
  return { x: p.x + Math.cos(a) * R, y: p.y + Math.sin(a) * R };
}
function addProj(p, type, tgt, o) {
  const a = Math.atan2(tgt.y - p.y, tgt.x - p.x), ux = Math.cos(a), uy = Math.sin(a);
  const dTo = dist(p.x, p.y, tgt.x, tgt.y);
  let sx = p.x + ux * (PR + 4), sy = p.y + uy * (PR + 4);
  if (!o.ghost && rayBlockAt(sx, sy)) { sx = p.x; sy = p.y; }
  const pr = {
    id: nid(), type, owner: p.id, team: p.team, x: sx, y: sy, vx: ux * o.speed, vy: uy * o.speed, trav: 0,
    maxD: o.fixed ? o.range : clamp(dTo - PR - 4, o.min || 0, o.range), bounces: o.bounces || 0, ghost: !!o.ghost,
    life: o.life || 6, r: o.r || 6, hit: {}, data: o.data || {}
  };
  S.proj.push(pr);
  return pr;
}
function addArea(type, at, o, owner) {
  const a = { id: nid(), type, x: at.x, y: at.y, r: o.r, dur: o.dur, t: o.dur, owner: owner ? owner.id : null, team: owner ? owner.team : -1, data: o.data || {} };
  if (o.pts) { a.pts = o.pts; a.pr = o.pr; }
  S.areas.push(a);
  return a;
}
function addDep(type, p, o) {
  const d = Object.assign({ id: nid(), type, owner: p.id, team: p.team, x: p.x, y: p.y, hp: 0, hr: 12 }, o);
  S.deps.push(d);
  return d;
}
function damageDep(dp, dmg) {
  if (!(dp.hp > 0)) return;
  dp.hp -= dmg;
  if (dp.hp <= 0) emitFx({ t: 'debris', x: r1(dp.x), y: r1(dp.y) });
}
function circleRect(cx, cy, r, rx, ry) {
  const x = clamp(cx, rx, rx + TILE), y = clamp(cy, ry, ry + TILE);
  return (cx - x) * (cx - x) + (cy - y) * (cy - y) < r * r;
}
function flashAt(x, y, team) {
  emitFx({ t: 'flash', x: r1(x), y: r1(y) });
  emitSnd('flash', x, y);
  for (const p of S.players) {
    if (!p.alive || p.team === team) continue;
    const d = dist(p.x, p.y, x, y);
    if (d > 760 || !losClear(p.x, p.y, x, y)) continue;
    const facing = Math.abs(angDiff(p.ang, Math.atan2(y - p.y, x - p.x))) < 1.25;
    const dur = (facing ? 2.4 : 0.6) * (d < 250 ? 1 : 1 - (d - 250) / 1100);
    p.st.blind = Math.max(p.st.blind || 0, dur);
  }
}
function slowPlayer(t, dur, amt) { t.st.slow = Math.max(t.st.slow || 0, dur); t.slowAmt = Math.max(t.st.slow > dur ? t.slowAmt : 0, amt); }

/* ---------------- YETENEK TABLOSU ---------------- */
const ABIL = {
  vex: {
    q(p) {
      let dx = p.input.mvx, dy = p.input.mvy, l = Math.hypot(dx, dy);
      if (l < 0.1) { dx = Math.cos(p.ang); dy = Math.sin(p.ang); l = 1; }
      dx /= l; dy /= l;
      impulse(p, dx * 1150, dy * 1150, 0.18);
      emitFx({ t: 'dash', x: r1(p.x), y: r1(p.y), a: r2(Math.atan2(dy, dx)), c: '#a86bff' });
      emitSnd('dash', p.x, p.y); return true;
    },
    e(p) { p.st.invis = 3.5; emitFx({ t: 'ring', x: r1(p.x), y: r1(p.y), r: 60, c: '#a86bff' }); emitSnd('invis', p.x, p.y); return true; },
    x(p, t) {
      const a = aimAng(p, t);
      addProj(p, 'blade', { x: p.x + Math.cos(a) * 100, y: p.y + Math.sin(a) * 100 }, { speed: 1850, range: 3600, fixed: true, ghost: true, r: 48, life: 2.8 });
      emitSnd('blade', p.x, p.y); return true;
    }
  },
  ignis: {
    q(p, t) { addProj(p, 'flashball', t, { speed: 950, range: 760, min: 110 }); emitSnd('throw', p.x, p.y); return true; },
    e(p, t) {
      const a = aimAng(p, t), ux = Math.cos(a), uy = Math.sin(a), pts = [];
      for (let d = 46; d <= 450; d += 34) { const x = p.x + ux * d, y = p.y + uy * d; if (rayBlockAt(x, y)) break; pts.push([r1(x), r1(y)]); }
      if (pts.length < 2) return false;
      addArea('firewall', { x: p.x, y: p.y }, { r: 450, dur: 7, pts, pr: 26 }, p);
      emitSnd('fire', p.x + ux * 150, p.y + uy * 150); return true;
    },
    x(p) {
      p.st.clone = 15; p.rebirth = { x: p.x, y: p.y, armor: Math.max(50, p.armor) };
      addDep('rebirth', p, { hp: 0 });
      emitFx({ t: 'ring', x: r1(p.x), y: r1(p.y), r: 90, c: '#ff8a3d' });
      emitSnd('rebirth', p.x, p.y); return true;
    }
  },
  mist: {
    q(p, t) { addProj(p, 'smokeorb', t, { speed: 1400, range: 1150, min: 40, ghost: true }); emitSnd('throw', p.x, p.y); return true; },
    e(p, t) { addProj(p, 'poisonorb', t, { speed: 900, range: 760, min: 80 }); emitSnd('throw', p.x, p.y); return true; },
    x(p, t) {
      const c = clampRange(p, t, 1900);
      addArea('nightmare', c, { r: 450, dur: 13 }, p);
      emitSnd('nightmare', c.x, c.y); return true;
    }
  },
  aegis: {
    q(p, t) {
      const mine = S.deps.filter(d => d.type === 'mine' && d.owner === p.id);
      if (mine.length >= 2) S.deps.splice(S.deps.indexOf(mine[0]), 1);
      let pos = { x: p.x, y: p.y };
      if (dist(p.x, p.y, t.x, t.y) <= 170 && losClear(p.x, p.y, t.x, t.y, true) && !circleHits(t.x, t.y, 6)) pos = { x: t.x, y: t.y };
      addDep('mine', p, { x: pos.x, y: pos.y, arm: 0.8, trig: 0, hp: 20, hr: 9 });
      emitSnd('place', pos.x, pos.y); return true;
    },
    e(p, t) {
      S.deps = S.deps.filter(d => !(d.type === 'turret' && d.owner === p.id));
      const a = aimAng(p, t);
      let pos = { x: p.x + Math.cos(a) * 32, y: p.y + Math.sin(a) * 32 };
      if (circleHits(pos.x, pos.y, 12)) pos = { x: p.x, y: p.y };
      addDep('turret', p, { x: pos.x, y: pos.y, ang: a, aim: a, hp: 125, hr: 13, cd: 0, range: 660 });
      emitSnd('place', pos.x, pos.y); return true;
    },
    x(p) {
      addDep('lockdev', p, { wind: 3, hp: 260, hr: 15, r: 560, beep: 3 });
      emitSnd('ult', p.x, p.y); return true;
    }
  },
  pulse: {
    q(p, t) { addProj(p, 'sonar', t, { speed: 1150, range: 1300, min: 90, bounces: 1 }); emitSnd('throw', p.x, p.y); return true; },
    e(p, t) { addProj(p, 'shock', t, { speed: 1000, range: 1100, min: 90, bounces: 2 }); emitSnd('throw', p.x, p.y); return true; },
    x(p, t) {
      const a = aimAng(p, t), ux = Math.cos(a), uy = Math.sin(a);
      S.beams.push({ id: nid(), type: 'orbital', x1: r1(p.x), y1: r1(p.y), x2: r1(p.x + ux * 3600), y2: r1(p.y + uy * 3600), w: 86, wind: 0.9, shots: 4, gap: 0.45, next: 0, owner: p.id, team: p.team, flash: 0 });
      emitSnd('laserwarn', p.x, p.y); return true;
    }
  },
  chrono: {
    q(p, t) { addProj(p, 'tsorb', t, { speed: 900, range: 700, min: 0 }); emitSnd('throw', p.x, p.y); return true; },
    e(p, t) {
      const a = Math.atan2(t.y - p.y, t.x - p.x), ux = Math.cos(a), uy = Math.sin(a);
      const d = Math.min(dist(p.x, p.y, t.x, t.y), 330);
      const rc = raycast(p.x, p.y, ux, uy, d);
      const dd = rc.hit ? Math.max(0, rc.d - PR - 3) : d;
      if (dd < 25) return false;
      const f = findFree(p.x + ux * dd, p.y + uy * dd, PR);
      emitFx({ t: 'tp', x: r1(p.x), y: r1(p.y), x2: r1(f.x), y2: r1(f.y) });
      emitSnd('tp', p.x, p.y);
      setPos(p, f.x, f.y); return true;
    },
    x(p, t) {
      const c = clampRange(p, t, 1800);
      addArea('tcollapse', c, { r: 430, dur: 10 }, p);
      emitSnd('collapse', c.x, c.y); return true;
    }
  },
  terra: {
    q(p, t) {
      const a = aimAng(p, t);
      addProj(p, 'wave', { x: p.x + Math.cos(a) * 560, y: p.y + Math.sin(a) * 560 }, { speed: 760, range: 560, fixed: true, r: 58, life: 1.2 });
      emitSnd('quake', p.x, p.y); return true;
    },
    e(p, t) {
      const a = aimAng(p, t), ux = Math.cos(a), uy = Math.sin(a), cx = p.x + ux * 95, cy = p.y + uy * 95, px = -uy, py = ux;
      const tiles = [];
      for (let k = -2; k <= 2; k++) {
        const tx = Math.floor((cx + px * k * TILE) / TILE), ty = Math.floor((cy + py * k * TILE) / TILE);
        if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) continue;
        const i = ty * MW + tx;
        if (tiles.includes(i) || tgrid[i]) continue;
        const tt = grid[i];
        if (!(tt === T_FLOOR || tt === T_A || tt === T_B)) continue;
        let occ = false;
        for (const o of S.players) if (o.alive && circleRect(o.x, o.y, PR + 2, tx * TILE, ty * TILE)) occ = true;
        if ((S.bomb.state === 'planted' || S.bomb.state === 'dropped') && circleRect(S.bomb.x, S.bomb.y, 12, tx * TILE, ty * TILE)) occ = true;
        if (!occ) tiles.push(i);
      }
      if (tiles.length < 2) return false;
      addTWall(tiles, 600, 12);
      emitSnd('stone', cx, cy); return true;
    },
    x(p, t) {
      const a = aimAng(p, t), ux = Math.cos(a), uy = Math.sin(a);
      S.beams.push({ id: nid(), type: 'rift', x1: r1(p.x), y1: r1(p.y), x2: r1(p.x + ux * 1750), y2: r1(p.y + uy * 1750), w: 104, wind: 0.6, owner: p.id, team: p.team });
      emitSnd('rift', p.x, p.y); return true;
    }
  },
  vital: {
    q(p, t) { addProj(p, 'healorb', t, { speed: 800, range: 600, min: 0 }); emitSnd('throw', p.x, p.y); return true; },
    e(p, t) { addProj(p, 'iceorb', t, { speed: 900, range: 760, min: 80 }); emitSnd('throw', p.x, p.y); return true; },
    x(p) {
      // önce yakındaki canlı takım arkadaşlarını iyileştir
      let healed = 0;
      for (const a of S.players) if (a.alive && a.team === p.team && dist(p.x, p.y, a.x, a.y) < 520) { a.hp = 100; a.armor = Math.max(a.armor, 50); healed++; }
      let best = null, bd = 480;
      for (const c of S.corpses) {
        const r = getP(c.id);
        if (!r || r.alive || r.team !== p.team) continue;
        const d = dist(p.x, p.y, c.x, c.y); if (d < bd) { bd = d; best = c; }
      }
      if (!best) {
        if (healed > 1) { emitFx({ t: 'revive', x: r1(p.x), y: r1(p.y) }); emitSnd('revive', p.x, p.y); emit({ k: 'msg', team: p.team, small: 'TAKIM İYİLEŞTİRİLDİ' }); return true; }
        emit({ k: 'msg', to: p.id, small: 'YAKININDA ÖLÜ TAKIM ARKADAŞI YOK' }); return false;
      }
      const r = getP(best.id), f = findFree(best.x, best.y, PR);
      r.alive = true; r.hp = 100; r.armor = 50; r.st = {}; r.dotAcc = {};
      r.ammo[curW(r)] = r.ammo[curW(r)] || { mag: WEAPONS[curW(r)].mag, res: WEAPONS[curW(r)].res };
      setPos(r, f.x, f.y);
      S.corpses.splice(S.corpses.indexOf(best), 1);
      if (r.ai) r.ai = newAI(r);
      emitFx({ t: 'revive', x: r1(f.x), y: r1(f.y) });
      emitSnd('revive', f.x, f.y);
      emit({ k: 'msg', team: p.team, small: r.name + ' YENİDEN CANLANDI' });
      return true;
    }
  },
  volt: {
    q(p) {
      p.st.boost = 4;
      let dx = p.input.mvx, dy = p.input.mvy, l = Math.hypot(dx, dy);
      if (l < 0.1) { dx = Math.cos(p.ang); dy = Math.sin(p.ang); l = 1; }
      impulse(p, dx / l * 680, dy / l * 680, 0.32);
      emitFx({ t: 'dash', x: r1(p.x), y: r1(p.y), a: r2(Math.atan2(dy, dx)), c: '#f7f35a' });
      emitSnd('boost', p.x, p.y); return true;
    },
    e(p, t) {
      const a = aimAng(p, t);
      addProj(p, 'chain', { x: p.x + Math.cos(a) * 650, y: p.y + Math.sin(a) * 650 }, { speed: 1400, range: 650, fixed: true, r: 8, life: 1 });
      emitSnd('zap', p.x, p.y); return true;
    },
    x(p) { p.st.ovl = 11; p.reloadT = 0; p.scoped = false; emitSnd('overload', p.x, p.y); emitFx({ t: 'ring', x: r1(p.x), y: r1(p.y), r: 110, c: '#f7f35a' }); return true; }
  },
  phantom: {
    q(p, t) { addProj(p, 'deaforb', t, { speed: 900, range: 800, min: 80 }); emitSnd('throw', p.x, p.y); return true; },
    e(p, t) {
      const a = aimAng(p, t);
      addProj(p, 'wolf', { x: p.x + Math.cos(a) * 900, y: p.y + Math.sin(a) * 900 }, { speed: 430, range: 1400, fixed: true, r: 12, life: 3.4, bounces: 8 });
      emitSnd('wolf', p.x, p.y); return true;
    },
    x(p) {
      for (const e of S.players) if (e.alive && e.team !== p.team) { e.st.shroud = 13; e.st.reveal = Math.max(e.st.reveal || 0, 4); }
      emitFx({ t: 'shroud', team: p.team });
      emit({ k: 'snd', s: 'shroud' }); return true;
    }
  }
};

function useAbility(p, k, tgt) {
  if (!p || !S || !p.alive || !canAct(p) || PKMAP || arOn()) return false; // parkurda ve arena modlarında yetenek yok
  if (S.phase !== 'live' && S.phase !== 'planted') return false;
  if (p.plantT > 0 || p.defT > 0) return false;
  const ag = AGENTS[p.agent];
  if (k === 'x') { if (p.ult < ag.x.pts) return false; }
  else if (k === 'q' || k === 'e') { if (!(p.ch[k] > 0)) return false; }
  else return false;
  if (!tgt || typeof tgt.x !== 'number' || isNaN(tgt.x)) tgt = { x: p.x + Math.cos(p.ang) * 300, y: p.y + Math.sin(p.ang) * 300 };
  tgt = { x: clamp(tgt.x, 0, WW), y: clamp(tgt.y, 0, WH), ang: (typeof tgt.ang === 'number' && !isNaN(tgt.ang)) ? tgt.ang : Math.atan2(tgt.y - p.y, tgt.x - p.x) };
  const ok = ABIL[p.agent][k](p, tgt);
  if (ok) {
    if (k === 'x') { p.ult = 0; emit({ k: 'ult', id: p.id }); } else p.ch[k]--;
    if (p.st.invis && !(p.agent === 'vex' && k === 'e')) delete p.st.invis;
  }
  return ok;
}

/* ---------------- MERMİ TÜRLERİ ---------------- */
const PROJ = {
  flashball: { land(pr) { flashAt(pr.x, pr.y, pr.team); } },
  smokeorb: { land(pr) { addArea('smoke', pr, { r: 115, dur: 15 }, getP(pr.owner) || { id: pr.owner, team: pr.team }); emitSnd('smoke', pr.x, pr.y); } },
  poisonorb: { land(pr) { addArea('poison', pr, { r: 105, dur: 7 }, getP(pr.owner) || { id: pr.owner, team: pr.team }); emitSnd('poison', pr.x, pr.y); } },
  sonar: { land(pr) { addArea('sonar', pr, { r: 340, dur: 3.4, data: { pulses: 2, next: 0 } }, getP(pr.owner) || { id: pr.owner, team: pr.team }); } },
  shock: { land(pr) { explode(pr.x, pr.y, 115, 75, getP(pr.owner), pr.team, 'shock'); } },
  tsorb: { land(pr) { addArea('tsphere', pr, { r: 125, dur: 8 }, getP(pr.owner) || { id: pr.owner, team: pr.team }); emitSnd('tsphere', pr.x, pr.y); } },
  healorb: { land(pr) { addArea('heal', pr, { r: 100, dur: 6 }, getP(pr.owner) || { id: pr.owner, team: pr.team }); emitSnd('heal', pr.x, pr.y); } },
  iceorb: { land(pr) { addArea('ice', pr, { r: 130, dur: 7 }, getP(pr.owner) || { id: pr.owner, team: pr.team }); emitSnd('ice', pr.x, pr.y); } },
  deaforb: {
    land(pr) {
      addArea('deaf', pr, { r: 165, dur: 6 }, getP(pr.owner) || { id: pr.owner, team: pr.team });
      for (const e of enemiesIn(pr.team, pr.x, pr.y, 165)) e.st.deaf = Math.max(e.st.deaf || 0, 6);
      emitSnd('deaf', pr.x, pr.y);
    }
  },
  blade: {
    touch(pr) {
      const att = getP(pr.owner);
      for (const t of S.players) {
        if (!t.alive || t.team === pr.team || pr.hit[t.id]) continue;
        if (inR(t, pr.x, pr.y, pr.r + PR)) { pr.hit[t.id] = 1; damage(t, 999, att, 'blade', false); emitFx({ t: 'slash', x: r1(t.x), y: r1(t.y) }); }
      }
      for (const dp of S.deps) if (dp.team !== pr.team && dp.hp > 0 && inR(dp, pr.x, pr.y, pr.r + 10)) damageDep(dp, 999);
      return false;
    }
  },
  wave: {
    touch(pr) {
      const att = getP(pr.owner);
      for (const t of S.players) {
        if (!t.alive || t.team === pr.team || pr.hit[t.id]) continue;
        if (inR(t, pr.x, pr.y, pr.r + PR)) {
          pr.hit[t.id] = 1; t.st.concuss = 3;
          damage(t, 15, att, 'quake');
        }
      }
      return false;
    }
  },
  chain: {
    touch(pr) {
      for (const t of S.players) if (t.alive && t.team !== pr.team && inR(t, pr.x, pr.y, PR + 9)) { chainLightning(getP(pr.owner), t, pr); return true; }
      return false;
    },
    land(pr) { emitFx({ t: 'spark', x: r1(pr.x), y: r1(pr.y), c: '#f7f35a' }); }
  },
  wolf: {
    steer(pr, dt) {
      const sp = Math.hypot(pr.vx, pr.vy), cur = Math.atan2(pr.vy, pr.vx);
      let best = null, bd = 460;
      for (const t of S.players) {
        if (!t.alive || t.team === pr.team || t.st.invis > 0) continue;
        const d = dist(pr.x, pr.y, t.x, t.y);
        if (d < bd && Math.abs(angDiff(cur, Math.atan2(t.y - pr.y, t.x - pr.x))) < 1.8 && losClear(pr.x, pr.y, t.x, t.y, true)) { bd = d; best = t; }
      }
      if (best) {
        const na = rotToward(cur, Math.atan2(best.y - pr.y, best.x - pr.x), 4.5 * dt);
        pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
      }
    },
    touch(pr) {
      for (const t of S.players) if (t.alive && t.team !== pr.team && inR(t, pr.x, pr.y, PR + 12)) {
        t.st.near = 4; t.st.reveal = Math.max(t.st.reveal || 0, 3);
        damage(t, 20, getP(pr.owner), 'wolf');
        emitFx({ t: 'ring', x: r1(t.x), y: r1(t.y), r: 50, c: '#9aa7c7' });
        emitSnd('wolf', t.x, t.y);
        return true;
      }
      return false;
    },
    land(pr) { emitFx({ t: 'puff', x: r1(pr.x), y: r1(pr.y), c: '#5c6680' }); }
  }
};
function chainLightning(att, first, pr) {
  const hit = new Set(), pts = [[r1(pr.x), r1(pr.y)]];
  let cur = first, dmg = 45;
  for (let j = 0; j < 4 && cur; j++) {
    hit.add(cur.id); pts.push([r1(cur.x), r1(cur.y)]);
    damage(cur, dmg, att, 'chain'); slowPlayer(cur, 1.2, 0.3);
    dmg = 30;
    let nb = null, nd = 290;
    for (const o of S.players) if (o.alive && o.team !== pr.team && !hit.has(o.id)) {
      const d = dist(cur.x, cur.y, o.x, o.y);
      if (d < nd && losClear(cur.x, cur.y, o.x, o.y, true)) { nd = d; nb = o; }
    }
    cur = nb;
  }
  emitFx({ t: 'chain', pts });
  emitSnd('zap', first.x, first.y);
}
function updateProjectiles(dt) {
  for (let i = S.proj.length - 1; i >= 0; i--) {
    const pr = S.proj[i], PT = PROJ[pr.type];
    pr.life -= dt;
    if (PT.steer) PT.steer(pr, dt);
    const sp = Math.hypot(pr.vx, pr.vy), n = Math.max(1, Math.ceil(sp * dt / 8));
    let done = false;
    for (let s = 0; s < n && !done; s++) {
      const nx = pr.x + pr.vx * dt / n, ny = pr.y + pr.vy * dt / n;
      if (!pr.ghost && rayBlockAt(nx, ny)) {
        if (pr.bounces > 0) {
          pr.bounces--;
          const hx = rayBlockAt(nx, pr.y), hy = rayBlockAt(pr.x, ny);
          if (hx) pr.vx = -pr.vx;
          if (hy) pr.vy = -pr.vy;
          if (!hx && !hy) { pr.vx = -pr.vx; pr.vy = -pr.vy; }
          continue;
        }
        done = true; break;
      }
      pr.x = nx; pr.y = ny; pr.trav += sp * dt / n;
      if (PT.touch && PT.touch(pr)) { done = 'touch'; break; }
      if (pr.trav >= pr.maxD) { done = true; break; }
    }
    if (pr.life <= 0) done = done || true;
    if (pr.x < 0 || pr.y < 0 || pr.x > WW || pr.y > WH) done = done || true;
    if (done) { S.proj.splice(i, 1); if (done !== 'touch' && PT.land) PT.land(pr); }
  }
}

/* ---------------- ALANLAR ---------------- */
function updateZones(dt) {
  for (const p of S.players) { p.zoneSlow = 1; p.zoneFire = 1; }
  for (let i = S.areas.length - 1; i >= 0; i--) {
    const a = S.areas[i]; a.t -= dt;
    const own = getP(a.owner);
    switch (a.type) {
      case 'poison':
        for (const t of enemiesIn(a.team, a.x, a.y, a.r)) { t.zoneSlow = Math.min(t.zoneSlow, 0.55); dot(t, 6, dt, own, 'poison'); }
        break;
      case 'ice':
        for (const t of enemiesIn(a.team, a.x, a.y, a.r)) t.zoneSlow = Math.min(t.zoneSlow, 0.5);
        break;
      case 'tcollapse':
        for (const t of enemiesIn(a.team, a.x, a.y, a.r)) { t.zoneSlow = Math.min(t.zoneSlow, 0.22); t.zoneFire = Math.min(t.zoneFire, 0.22); dot(t, 8, dt, own, 'tcollapse'); }
        break;
      case 'nightmare':
        for (const t of enemiesIn(a.team, a.x, a.y, a.r)) {
          if (t.hp > 1) t.hp = Math.max(1, t.hp - 22 * dt);
          t.st.reveal = Math.max(t.st.reveal || 0, 0.35);
          t.zoneSlow = Math.min(t.zoneSlow, 0.7);
        }
        break;
      case 'heal':
        for (const t of S.players) if (t.alive && t.team === a.team && inR(t, a.x, a.y, a.r)) t.hp = Math.max(t.hp, Math.min(100, t.hp + 14 * dt));
        break;
      case 'firewall': {
        const hitT = new Set();
        for (const pt of a.pts) for (const t of S.players) {
          if (!t.alive || hitT.has(t.id) || !inR(t, pt[0], pt[1], a.pr + PR * 0.6)) continue;
          hitT.add(t.id);
          if (t.team !== a.team) dot(t, 30, dt, own, 'fire');
          else if (own && t.id === own.id) t.hp = Math.max(t.hp, Math.min(100, t.hp + 10 * dt));
        }
        break;
      }
      case 'deaf':
        for (const t of enemiesIn(a.team, a.x, a.y, a.r)) t.st.deaf = Math.max(t.st.deaf || 0, 2);
        break;
      case 'sonar':
        a.data.next -= dt;
        if (a.data.next <= 0 && a.data.pulses > 0) {
          a.data.pulses--; a.data.next = 1.6;
          for (const t of enemiesIn(a.team, a.x, a.y, a.r)) t.st.reveal = Math.max(t.st.reveal || 0, 1.8);
          emitFx({ t: 'sonar', x: r1(a.x), y: r1(a.y), r: a.r });
          emitSnd('sonar', a.x, a.y);
        }
        break;
    }
    if (a.t <= 0) S.areas.splice(i, 1);
  }
}

/* ---------------- CİHAZLAR ---------------- */
function updateDeps(dt) {
  for (let i = S.deps.length - 1; i >= 0; i--) {
    const dp = S.deps[i], own = getP(dp.owner);
    let remove = false;
    switch (dp.type) {
      case 'mine':
        if (dp.arm > 0) dp.arm -= dt;
        else if (!dp.trig) {
          if (S.players.some(t => t.alive && t.team !== dp.team && inR(t, dp.x, dp.y, 58))) { dp.trig = 0.4; emitSnd('mine', dp.x, dp.y); }
        } else {
          dp.trig -= dt;
          if (dp.trig <= 0) {
            for (const t of enemiesIn(dp.team, dp.x, dp.y, 115)) slowPlayer(t, 2, 0.4);
            explode(dp.x, dp.y, 115, 85, own, dp.team, 'mine'); remove = true;
          }
        }
        break;
      case 'turret': {
        dp.cd -= dt;
        let tgt = null, bd = dp.range;
        for (const t of S.players) {
          if (!t.alive || t.team === dp.team || t.st.invis > 0) continue;
          const d = dist(dp.x, dp.y, t.x, t.y);
          if (d < bd && Math.abs(angDiff(dp.ang, Math.atan2(t.y - dp.y, t.x - dp.x))) < 1.05 && losClear(dp.x, dp.y, t.x, t.y)) { bd = d; tgt = t; }
        }
        if (tgt) {
          const want = Math.atan2(tgt.y - dp.y, tgt.x - dp.x);
          dp.aim = rotToward(dp.aim, want, 5 * dt);
          if (dp.cd <= 0 && Math.abs(angDiff(dp.aim, want)) < 0.12 && (S.phase === 'live' || S.phase === 'planted')) {
            dp.cd = 0.17;
            const a = dp.aim + gauss() * 0.05;
            const res = traceBullet(dp.x, dp.y, a, dp.range + 40, dp.team, own, 'turret', null, null);
            emit({ k: 'sh', id: dp.owner, x: r1(dp.x), y: r1(dp.y), z: 30, x2: r1(res.x), y2: r1(res.y), z2: 40, w: 'turret' });
          }
        } else dp.aim = rotToward(dp.aim, dp.ang, 2 * dt);
        break;
      }
      case 'lockdev': {
        const prev = Math.ceil(dp.wind);
        dp.wind -= dt;
        if (Math.ceil(dp.wind) !== prev && dp.wind > 0) emitSnd('lockbeep', dp.x, dp.y);
        if (dp.wind <= 0 && dp.hp > 0) {
          for (const t of enemiesIn(dp.team, dp.x, dp.y, dp.r)) { t.st.lock = 7.5; t.scoped = false; t.plantT = 0; t.defT = 0; }
          emitFx({ t: 'lock', x: r1(dp.x), y: r1(dp.y), r: dp.r });
          emitSnd('lock', dp.x, dp.y);
          remove = true;
        }
        break;
      }
      case 'rebirth':
        if (!own || !own.alive || !(own.st.clone > 0)) remove = true;
        break;
    }
    if ((dp.type === 'mine' || dp.type === 'turret' || dp.type === 'lockdev') && dp.hp <= 0) remove = true;
    if (remove) S.deps.splice(i, 1);
  }
}

/* ---------------- HUZMELER (PULSE / TERRA ultileri) ---------------- */
function updateBeams(dt) {
  for (let i = S.beams.length - 1; i >= 0; i--) {
    const b = S.beams[i], att = getP(b.owner);
    if (b.wind > 0) { b.wind -= dt; continue; }
    if (b.type === 'orbital') {
      b.next -= dt;
      if (b.next <= 0 && b.shots > 0) {
        b.shots--; b.next = b.gap;
        for (const t of S.players) if (t.alive && t.team !== b.team && segDist(t.x, t.y, b.x1, b.y1, b.x2, b.y2) < b.w / 2 + PR) damage(t, 160, att, 'orbital');
        for (const dp of S.deps) if (dp.team !== b.team && dp.hp > 0 && segDist(dp.x, dp.y, b.x1, b.y1, b.x2, b.y2) < b.w / 2 + 10) damageDep(dp, 999);
        emitFx({ t: 'laser', x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, w: b.w });
        emitSnd('laser', (b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2);
      }
      if (b.shots <= 0 && b.next <= 0.2) S.beams.splice(i, 1);
    } else if (b.type === 'rift') {
      const ux = (b.x2 - b.x1), uy = (b.y2 - b.y1), l = Math.hypot(ux, uy);
      for (const t of S.players) if (t.alive && t.team !== b.team && segDist(t.x, t.y, b.x1, b.y1, b.x2, b.y2) < b.w / 2 + PR) {
        t.st.knock = 2.2; t.plantT = 0; t.defT = 0; t.st.concuss = 3;
        damage(t, 115, att, 'rift');
        if (t.alive) impulse(t, ux / l * 820, uy / l * 820, 0.26);
      }
      emitFx({ t: 'rift', x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, w: b.w });
      emitSnd('quake', (b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2);
      S.beams.splice(i, 1);
    }
  }
}

/* VOLT ultisi: kesintisiz elektrik ışını */
function overloadBeam(p, dt) {
  const ux = Math.cos(p.ang), uy = Math.sin(p.ang);
  let end = raycast(p.x, p.y, ux, uy, 950).d;
  for (const ar of S.areas) if (ar.type === 'tsphere' && ar.team !== p.team) {
    const t = rayCircle(p.x, p.y, ux, uy, ar.x, ar.y, ar.r); if (t !== null && t > 0 && t < end) end = t;
  }
  let best = null, bt = end;
  for (const t of S.players) {
    if (!t.alive || t.team === p.team) continue;
    const d = rayCircle(p.x, p.y, ux, uy, t.x, t.y, PR + 5);
    if (d !== null && d < bt) { bt = d; best = t; }
  }
  for (const dp of S.deps) if (dp.team !== p.team && dp.hp > 0) {
    const d = rayCircle(p.x, p.y, ux, uy, dp.x, dp.y, dp.hr || 12); if (d !== null && d < bt) { bt = d; best = dp; }
  }
  if (best) { if (best.ch) dot(best, 200, dt, p, 'overload'); else damageDep(best, 200 * dt); }
  if (p.st.invis) delete p.st.invis;
  p.beamT -= dt;
  if (p.beamT <= 0) {
    p.beamT = 0.08;
    emitFx({ t: 'ovb', x: r1(p.x), y: r1(p.y), x2: r1(p.x + ux * bt), y2: r1(p.y + uy * bt) });
    if (Math.random() < 0.6) emitSnd('beam', p.x, p.y);
    botsHear(p.x, p.y, p.team, 900);
  }
}
