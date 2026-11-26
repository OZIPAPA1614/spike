/* =====================================================================
   03d · SERBEST MOD ('fr', Garry's Mod tarzı serbest dolaşma) · NPC'LER · PİLLER
        Görev, süre, bomba yok; tek oyunculu ya da çok oyunculu odada herkes
        dolaşır. [Q] / [B] spawn menüsü: bedava silah, NPC çıkar, pill ile NPC'ye
        dönüş, kendi resminle NPC yap. Ölünce birkaç saniyede yeniden doğulur.
        NPC (nextbot): yüzü hep sana dönük dev bir resim; en yakın oyuncuyu duvarların
          etrafından dolaşarak kovalar, dokunduğunu vurur. Bazıları ölümsüzdür.
        PİLL: oyuncu bir NPC'ye dönüşür — onun resmi, hızı ve dokunma hasarıyla
          dolaşır, silah kullanamaz. İNSANA DÖN ile geri döner.
        Her şeyi host yönetir; istemciler isteklerini 'act' ile gönderir.
   ===================================================================== */
const FR_MAXNPC = 24, FR_MAXK = 16, FR_TOUCH = PR * 2 + 8;
/* hazır NPC'ler (resimleri 07h'de kodla çizilir). hp: 0 = ölümsüz */
const NPC_KINDS = {
  grin: { n: 'Sırıtkan', spd: 330, hp: 0, dmg: 999, sz: 1.15 },
  eye: { n: 'Dev Göz', spd: 290, hp: 0, dmg: 999, sz: 1.1 },
  cube: { n: 'Kutu Kafa', spd: 250, hp: 600, dmg: 60, sz: 1.2 },
  ghost: { n: 'Gölge', spd: 400, hp: 250, dmg: 35, sz: 1 },
  melon: { n: 'Karpuz', spd: 210, hp: 400, dmg: 45, sz: 0.9 }
};
function frOn() { return !!(S && S.cfg && S.cfg.mode === 'fr'); }
function npcKind(k) { return (k && (NPC_KINDS[k] || (S && S.npcK && S.npcK[k]))) || null; }
function frSetup() { S.npcs = []; S.npcK = S.npcK || {}; }
/* resim verisinden kısa, kararlı kimlik (aynı resim = aynı NPC türü) */
function npcIdOf(img) { let h = 2166136261; for (let i = 0; i < img.length; i += 7) { h ^= img.charCodeAt(i); h = Math.imul(h, 16777619); } return 'c' + (h >>> 0).toString(36); }

/* ---------- istekler (host): yerelde doğrudan, istemciden 'act' ile ---------- */
function frAct(p, d) {
  if (!frOn() || !p || !d) return;
  if ((d.a === 'npc' || (d.a === 'pill' && d.k)) && !frKnow(String(d.k || ''))) { // içerik henüz yükleniyorsa sıraya al (06b)
    if (PAK.inb[d.k]) (S.frQ || (S.frQ = [])).push({ pid: p.id, d, t: S.time });
    return;
  }
  switch (d.a) {
    case 'frw': frGive(p, String(d.w || '')); break;
    case 'npc': frSpawnNpc(p, String(d.k || '')); break;
    case 'pill': frPill(p, String(d.k || '')); break;
    case 'npcclr': if (S.npcs && S.npcs.length) { S.npcs.length = 0; emit({ k: 'msg', small: p.name + ' TÜM NPC\'LERİ SİLDİ' }); } break;
    case 'npck': frRegKind(d); break;
  }
}
function frRequest(d) {
  const me = S && S.pmap[G.myId]; if (!me || !frOn()) return;
  if (G.mode === 'client') netSend(NET.conn, Object.assign({ t: 'act' }, d));
  else frAct(me, d);
}
/* spawn menüsünden bedava silah (admin silahı hariç); yeniden doğunca da verilir */
function frGive(p, w) {
  const W = WEAPONS[w]; if (!W || W.hidden || !p.alive) return;
  p.pill = ''; p.scoped = false; p.reloadT = 0; p.switchT = 0.3; p.pend = false;
  if (w === 'sword') { p.slot = 3; return; }
  if (W.slot === 1) { p.primary = w; p.frP = w; p.slot = 1; } else { p.secondary = w; p.frS = w; p.slot = 2; }
  p.ammo[w] = { mag: W.mag, res: Math.max(W.res, W.mag * 12) };
}
function frLoadout(p) {
  p.primary = p.frP || null; p.secondary = p.frS || 'classic'; p.slot = p.primary ? 1 : 2; p.armor = 0;
  p.ammo = {};
  for (const id of [p.primary, p.secondary]) if (id) { const W = WEAPONS[id]; p.ammo[id] = { mag: W.mag, res: Math.max(W.res, W.mag * 12) }; }
}
function frSpawnNpc(p, k) {
  const K = npcKind(k); if (!K || !S.npcs || !p.alive) return;
  if (S.npcs.length >= FR_MAXNPC) { emit({ k: 'msg', to: p.id, small: 'EN FAZLA ' + FR_MAXNPC + ' NPC OLABİLİR — önce birkaçını sil' }); return; }
  const a = p.ang, f = findFree(p.x + Math.cos(a) * 170, p.y + Math.sin(a) * 170, PR);
  S.npcs.push({ id: 'n' + nid(), k, x: r1(f.x), y: r1(f.y), hp: K.hp || 0, path: null, pi: 0, rp: 0, hitT: S.time + 1, by: p.id });
  emitFx({ t: 'rebirth', x: r1(f.x), y: r1(f.y), x2: r1(f.x), y2: r1(f.y) });
}
function frPill(p, k) {
  if (k && !npcKind(k)) return;
  if (!p.alive) return;
  p.pill = k; p.scoped = false; p.reloadT = 0;
  emitFx({ t: 'rebirth', x: r1(p.x), y: r1(p.y), x2: r1(p.x), y2: r1(p.y) });
  if (k) emit({ k: 'msg', to: p.id, small: 'PİLL: ' + npcKind(k).n + ' oldun · dokunduğun rakibi vurursun · spawn menüsünden İNSANA DÖN' });
}
/* oyuncunun kendi resmi (ve sesi) ile yaptığı NPC türü — host / tek oyunculu */
function frRegKind(d) {
  const v = pakValid({ n: String(d.n || '').slice(0, 16), img: d.img, snd: d.snd, spd: clamp(d.spd | 0 || 320, 150, 520), hp: d.hp, dmg: d.dmg, sz: clamp(+d.sz || 1.1, 0.6, 2) });
  if (!v) return;
  const id = kindIdOf(v);
  frAddKind(id, v); pakPut(id, v);
}
/* NPC türünü maça ekle (sınır dolarsa en eski oyuncu NPC'si çıkar) */
function frAddKind(id, v) {
  const K = S.npcK || (S.npcK = {});
  if (!K[id]) { const ids = Object.keys(K).filter(k => !K[k].mod); if (ids.length >= FR_MAXK) delete K[ids[0]]; }
  K[id] = v;
}
/* tür biliniyor mu? Bilinmiyorsa odaya yüklenmiş içerikten ekle */
function frKnow(k) {
  if (!k || npcKind(k)) return !!k;
  if (PAK.k[k]) { frAddKind(k, PAK.k[k]); return true; }
  return false;
}
/* içerik yüklendi: sıradaki NPC / pill isteklerini uygula */
function frPakReady(id) {
  if (!S || !S.frQ || !frOn()) return;
  const q = S.frQ; S.frQ = [];
  for (const r of q) { const p = S.pmap[r.pid]; if (p && S.time - r.t < 30) { if (r.d.k === id || PAK.k[r.d.k]) frAct(p, r.d); else S.frQ.push(r); } }
}
/* mermi NPC'ye değdi: ölümsüzse mermiyi durdurur, değilse can düşer */
function npcHit(n, dmg, att) {
  const K = npcKind(n.k); if (!K || !K.hp) return;
  if (att && att.admDmg > 1) dmg *= att.admDmg;
  n.hp -= dmg;
  emit({ k: 'npch', id: n.id, d: Math.round(dmg), x: r1(n.x), y: r1(n.y), a: att ? att.id : null });
  if (n.hp <= 0) {
    S.npcs = S.npcs.filter(o => o !== n);
    emitFx({ t: 'boom', x: n.x, y: n.y, r: 70 }); emitSnd('boom', n.x, n.y);
    emit({ k: 'msg', small: (att ? att.name + ' · ' : '') + K.n + ' YOK EDİLDİ' });
  }
}
/* ---------- her adım (host) ---------- */
function frTick(dt) {
  if (!S.npcs) S.npcs = [];
  modTick(dt); // JavaScript modlarına oyun durumu (08d)
  for (const n of S.npcs) {
    const K = npcKind(n.k); if (!K) { n.dead = true; continue; }
    let tgt = null, bd = 1e9;
    for (const p of S.players) if (p.alive && !p.pill) { const d = dist(n.x, n.y, p.x, p.y); if (d < bd) { bd = d; tgt = p; } }
    if (!tgt) continue;
    let gx = tgt.x, gy = tgt.y;
    if (!walkLine(n.x, n.y, tgt.x, tgt.y, PR)) {
      n.rp -= dt;
      if (n.rp <= 0 || !n.path || n.pi >= n.path.length) { n.path = findPath(n.x, n.y, tgt.x, tgt.y); n.pi = 0; n.rp = 0.55 + Math.random() * 0.35; }
      if (n.path && n.pi < n.path.length) {
        if (n.pi < n.path.length - 1 && walkLine(n.x, n.y, n.path[n.pi + 1].x, n.path[n.pi + 1].y, PR)) n.pi++;
        let wp = n.path[n.pi];
        if (dist(n.x, n.y, wp.x, wp.y) < 14 && n.pi < n.path.length - 1) wp = n.path[++n.pi];
        gx = wp.x; gy = wp.y;
      }
    } else n.path = null;
    const dx = gx - n.x, dy = gy - n.y, l = Math.hypot(dx, dy) || 1, st = Math.min((K.spd || 300) * dt, l);
    moveCircle(n, dx / l * st, dy / l * st, PR);
    if (bd < FR_TOUCH && S.time >= n.hitT) { n.hitT = S.time + 0.6; damage(tgt, K.dmg || 999, null, 'npc'); }
  }
  if (S.npcs.some(n => n.dead)) S.npcs = S.npcs.filter(n => !n.dead);
  // pill: dönüşmüş oyuncu dokunduğu rakibi vurur
  for (const p of S.players) {
    if (!p.alive || !p.pill || S.time < (p.pillT || 0)) continue;
    const K = npcKind(p.pill); if (!K) { p.pill = ''; continue; }
    for (const o of S.players) {
      if (o === p || !o.alive || o.pill || (o.team === p.team && !ffOn())) continue;
      if (dist(o.x, o.y, p.x, p.y) < FR_TOUCH) { p.pillT = S.time + 0.6; damage(o, K.dmg || 999, p, 'pill'); break; }
    }
  }
}
/* ---------- istemci: snapshot'tan NPC listesi (yumuşak hareket için eski konumu tut) ---------- */
function frClientNpcs(arr) {
  const old = {}; for (const n of S.npcs || []) old[n.id] = n;
  S.npcs = (arr || []).map(a => {
    const o = old[a[0]] || { id: a[0], rx: a[2], ry: a[3] };
    o.k = a[1]; o.x = a[2]; o.y = a[3]; o.hp = a[4];
    return o;
  });
}
