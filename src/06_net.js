/* =====================================================================
   06 · ÇOK OYUNCULU (PeerJS / WebRTC)
        Host otoriter simülasyon + istemci tarafı hareket tahmini,
        20 Hz anlık görüntü (snapshot), 30 Hz girdi, interpolasyon,
        gecikme telafisi (lag compensation)
   ===================================================================== */
const PEER_PREFIX = 'spkprtkl2d-';
const INTERP = 0.1;
const NET = {
  mode: 'off', peer: null, conns: {}, conn: null, code: '', lobby: null, sel: null, pc: 0,
  snapT: 0, sendT: 0, offset: 0, haveOff: false, ping: 0, pingT: 0, selTimer: null, connecting: false
};
function netAvailable() { return typeof Peer !== 'undefined'; }
/* Gömülü/korumalı pencere (ör. Claude'un dosya önizlemesi) — bu tür çerçeveler ağ bağlantılarını ve WebRTC'yi engeller */
const IN_FRAME = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
const IN_PREVIEW = IN_FRAME && (() => {
  let o = ''; try { o = String(self.origin !== undefined ? self.origin : location.origin); } catch (e) { }
  let h = ''; try { h = String(location.hostname); } catch (e) { }
  o += ' ' + h;
  return /^null\b/.test(o) || /claude|anthropic|usercontent/i.test((document.referrer || '') + ' ' + o);
})();
const SANDBOX_MSG = 'Çok oyunculu bu önizleme penceresinde çalışmaz: önizleme, internete ve WebRTC bağlantılarına izin vermiyor. ' +
  'Dosyayı indir (önizlemenin sağ üstündeki indirme düğmesi), sonra Safari veya Chrome\'da doğrudan aç. Arkadaşın da öyle açmalı.';
function netBlockedMsg(base) { return IN_FRAME ? (IN_PREVIEW ? SANDBOX_MSG : base + ' (Oyun gömülü bir pencerede açık; dosyayı indirip tarayıcıda doğrudan açmayı dene.)') : base; }
function rtcAvailable() { return typeof RTCPeerConnection !== 'undefined'; }
/* Bağlantı kurulurken PeerJS içinden gelen yakalanamayan hatalar (ör. engellenen WebSocket) bekleyen işlemi hemen düşürür */
window.addEventListener('error', e => {
  if (!NET.pendingFail) return;
  const fn = String((e && e.filename) || ''), msg = String((e && e.message) || '');
  if (/peerjs/i.test(fn) || /^Script error/i.test(msg) || /websocket|insecure|SecurityError/i.test(msg)) {
    const f = NET.pendingFail; NET.pendingFail = null;
    f(netBlockedMsg('Bağlantı tarayıcı tarafından engellendi (' + (msg || 'güvenlik hatası') + ').'));
    try { e.preventDefault(); } catch (x) { }
  }
});
/* ---- ICE (STUN/TURN) yapılandırması ----
   Farklı ağlardaki oyuncular (mobil veri, CGNAT, kurumsal ağ) çoğu zaman doğrudan
   bağlanamaz; bu durumda trafik bir TURN aktarma sunucusundan geçmelidir.
   Varsayılan: Google + Cloudflare STUN ve PeerJS'in ücretsiz TURN sunucuları.
   Kullanıcı kendi TURN bilgilerini (ör. ExpressTURN / Metered ücretsiz hesap) BAĞLANTI AYARLARI'ndan ekleyebilir. */
const ICE_DEFAULT = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }
];
function turnLoad() { try { const t = JSON.parse(localStorage.getItem('spk_turn') || 'null'); return t && typeof t === 'object' ? t : null; } catch (e) { return null; } }
function turnSave(t) { try { if (t) localStorage.setItem('spk_turn', JSON.stringify(t)); else localStorage.removeItem('spk_turn'); } catch (e) { } }
function turnUrls(t) { return t && t.urls ? String(t.urls).split(/[\s,;]+/).map(u => u.trim()).filter(u => /^(turns?|stun):/i.test(u)) : []; }
function iceConfig(relayOnly) {
  const list = [], t = turnLoad(), urls = turnUrls(t);
  if (urls.length) list.push({ urls, username: t.user || '', credential: t.pass || '' });
  for (const s of ICE_DEFAULT) list.push(s);
  const cfg = { iceServers: list, sdpSemantics: 'unified-plan' };
  if (relayOnly) cfg.iceTransportPolicy = 'relay';
  return cfg;
}
function peerOpts() { return { debug: 1, config: iceConfig() }; }
const NET_SIG_ERR = { 'network': 1, 'server-error': 1, 'socket-error': 1, 'socket-closed': 1, 'disconnected': 1 };
function netStatusChanged() { if (typeof uiNetStatus === 'function') uiNetStatus(); }
/* Host'un eşleştirme sunucusu bağlantısı koparsa (telefon arka plana alındı, ağ değişti) yeniden bağlan */
function hostReconnect() {
  const p = NET.peer;
  if (NET.mode !== 'host' || !p || p.destroyed) return;
  if (p.disconnected) { NET.sigOk = false; netStatusChanged(); try { p.reconnect(); } catch (e) { } }
}
function genCode() { const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += ch[Math.floor(Math.random() * ch.length)]; return s; }
function netSend(conn, msg) { try { if (conn && conn.open) conn.send(msg); } catch (e) { /* yoksay */ } }
function broadcast(msg) { for (const id in NET.conns) netSend(NET.conns[id], msg); }
function netShutdown() {
  try { PUB.stop(); } catch (e) { }
  try { for (const id in NET.conns) NET.conns[id].close(); } catch (e) { }
  try { if (NET.conn) NET.conn.close(); } catch (e) { }
  try { if (NET.peer) NET.peer.destroy(); } catch (e) { }
  if (NET.selTimer) clearInterval(NET.selTimer);
  if (NET.sigTimer) clearInterval(NET.sigTimer);
  NET.sigTimer = null; NET.sigOk = false; NET.pendingFail = null;
  try { VC.reset(); } catch (e) { }
  NET.vs = {}; NET.lchat = [];
  NET.mode = 'off'; NET.lastSnap = 0; NET.peer = null; NET.conns = {}; NET.conn = null; NET.lobby = null; NET.sel = null; NET.selTimer = null; NET.haveOff = false;
}

/* ---------------- HOST ---------------- */
function hostCreate(name, onReady, onErr) {
  if (!netAvailable()) { onErr('PeerJS kütüphanesi yüklenemedi (internet bağlantısı gerekli).'); return; }
  NET.mode = 'host'; G.myId = 'h'; NET.pc = 0;
  NET.lobby = { players: [{ id: 'h', name, team: 0, bot: false, uid: FR.uid, cos: SHOP.cos() }], cfg: { teamSize: 5, fill: true, diff: 'normal', map: 0, ff: true }, inGame: false };
  if (!rtcAvailable()) { onErr(netBlockedMsg('Bu tarayıcı WebRTC desteklemiyor.')); return; }
  let opened = false, failed = false;
  const fail = msg => { if (opened || failed) return; failed = true; clearTimeout(to); NET.pendingFail = null; onErr(msg); };
  NET.pendingFail = fail;
  const to = setTimeout(() => fail(netBlockedMsg('Eşleştirme sunucusuna (PeerJS) ulaşılamadı. İnternet bağlantını kontrol et ya da biraz sonra tekrar dene.')), IN_FRAME ? 8000 : 20000);
  const tryOpen = (attempt) => {
    if (failed) return;
    NET.code = genCode();
    let peer;
    try { peer = new Peer(PEER_PREFIX + NET.code.toLowerCase(), peerOpts()); }
    catch (e) { fail(netBlockedMsg('Bağlantı başlatılamadı (' + (e && e.message ? e.message : e) + ').')); return; }
    NET.peer = peer;
    peer.on('open', () => {
      NET.sigOk = true;
      if (!opened) { opened = true; clearTimeout(to); NET.pendingFail = null; onReady(NET.code); }
      netStatusChanged();
    });
    peer.on('error', e => {
      const ty = e && e.type ? e.type : String(e);
      if (NET.peer !== peer) return;
      if (ty === 'unavailable-id' && !opened && attempt < 4) { try { peer.destroy(); } catch (x) { } tryOpen(attempt + 1); return; }
      if (ty === 'peer-unavailable') return; // bir istemci koptu
      if (!opened) { fail(NET_SIG_ERR[ty] ? netBlockedMsg('Eşleştirme sunucusuna (PeerJS) ulaşılamadı (' + ty + '). İnternetini kontrol et ya da biraz sonra tekrar dene.') : netBlockedMsg('Bağlantı hatası: ' + ty)); return; }
      // oda açıldıktan sonraki sunucu hataları odayı kapatmaz; bağlı oyuncular doğrudan bağlı kalır
      NET.sigOk = false; netStatusChanged();
      setTimeout(hostReconnect, 1500);
    });
    peer.on('disconnected', () => { if (NET.peer !== peer) return; NET.sigOk = false; netStatusChanged(); setTimeout(hostReconnect, 500); });
    peer.on('call', c => VC.onCall(c));
    peer.on('connection', conn => {
      conn.on('data', d => hostRecv(conn, d));
      conn.on('close', () => hostDrop(conn));
      conn.on('error', () => hostDrop(conn));
    });
  };
  tryOpen(0);
  if (NET.sigTimer) clearInterval(NET.sigTimer);
  NET.sigTimer = setInterval(hostReconnect, 3000);
}
function lobbyView() { const L = NET.lobby; return { players: L.players, cfg: L.cfg, code: NET.code, vs: NET.vs || {}, pub: !!L.pub, autoIn: L.autoAt ? Math.max(0, (L.autoAt - Date.now()) / 1000) : 0 }; }
function broadcastLobby() { broadcast({ t: 'lobby', lobby: lobbyView() }); if (typeof uiRenderLobby === 'function') uiRenderLobby(); }
function hostRecv(conn, d) {
  if (!d || typeof d !== 'object') return;
  conn._last = performance.now();
  if (d instanceof ArrayBuffer) { vcHostAudio(conn, d); return; } // sesli sohbet paketi
  switch (d.t) {
    case 'hello': {
      if (NET.lobby.inGame || NET.sel) { netSend(conn, { t: 'deny', why: 'Oyun zaten başladı.' }); setTimeout(() => conn.close(), 300); return; }
      if (NET.lobby.players.length >= 10) { netSend(conn, { t: 'deny', why: 'Oda dolu (10/10).' }); setTimeout(() => conn.close(), 300); return; }
      const id = 'p' + (++NET.pc);
      conn._pid = id; NET.conns[id] = conn;
      const t0 = NET.lobby.players.filter(p => p.team === 0).length, t1 = NET.lobby.players.filter(p => p.team === 1).length;
      NET.lobby.players.push({ id, name: String(d.name || 'Oyuncu').slice(0, 16), team: t0 <= t1 ? (t0 < t1 ? 0 : 1) : 1, bot: false, uid: String(d.uid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40), cos: cosClean(d.cos) });
      netSend(conn, { t: 'welcome', id });
      broadcastLobby();
      setTimeout(vcBroadcastDir, 400);
      uiToast((d.name || 'Oyuncu') + ' lobiye katıldı');
      break;
    }
    case 'ping': netSend(conn, { t: 'pong', c: d.c }); break;
    case 'vt': if (conn._pid) vcHostSet(conn._pid, d.vm ? 1 : 0, d.vt ? 1 : 0); break;
    case 'chat': if (G.running && S && conn._pid) hostChat(conn._pid, d.m); break;
    case 'lchat': if (conn._pid) lobbyChatHost(conn._pid, d.m); break;
    case 'pick': if (NET.sel) { selApplyPick(conn._pid, d.agent); } break;
    case 'lock': if (NET.sel) { selApplyLock(conn._pid); } break;
    case 'in': {
      if (!G.running || !S) return;
      const p = S.pmap[conn._pid]; if (!p || p.ctrl !== 'remote') return;
      if (p.alive && d.pv >= p.posVer && isFinite(d.x) && isFinite(d.y)) {
        const nx = clamp(+d.x, PR, WW - PR), ny = clamp(+d.y, PR, WH - PR);
        if (!circleHits(nx, ny, PR - 3) || dist(nx, ny, p.x, p.y) < 4) { p.x = nx; p.y = ny; p._rej = 0; }
        else if (++p._rej > 15) { // ~0.5 sn boyunca kabul edilmeyen konum: oyuncu host'ta eski yerde "donmuş" kalmasın
          const f = findFree(nx, ny, PR); p._rej = 0; setPos(p, f.x, f.y);
        }
      }
      const inp = p.input;
      inp.ang = +d.ang || 0; inp.mvx = +d.mvx || 0; inp.mvy = +d.mvy || 0; inp.walk = !!d.walk; inp.fire = !!d.fire;
      inp.fp = d.fp | 0; inp.alt = !!d.alt; inp.use = !!d.use; inp.crouch = !!d.cr; inp.pitch = clamp(+d.pt || 0, -1.45, 1.45); inp.jc = d.jc | 0;
      p.jz = p.alive ? clamp(+d.jz || 0, 0, 90) : 0;
      p.ang = inp.ang; p.pitch = inp.pitch; p.netMv = clamp(+d.mv || 0, 0, 3); p.rt = +d.rt || 0;
      break;
    }
    case 'act': {
      if (!G.running || !S) return;
      const p = S.pmap[conn._pid]; if (!p) return;
      if (d.a === 'abil') useAbility(p, d.k, { x: +d.tx, y: +d.ty, ang: +d.ang });
      else if (d.a === 'buy') buyItem(p, d.it);
      else if (d.a === 'reload') startReload(p);
      else if (d.a === 'slot') switchSlot(p, d.s | 0);
      else if (d.a === 'drop') dropSpike(p);
      else if (d.a === 'req') requestSpike(p);
      else if (d.a === 'emote') hostEmote(p, d.e);
      break;
    }
  }
}
function hostDrop(conn) {
  const id = conn._pid; if (!id || !NET.conns[id]) return;
  delete NET.conns[id];
  if (NET.vs) delete NET.vs[id];
  setTimeout(vcBroadcastDir, 50);
  try { conn.close(); } catch (e) { }
  if (G.running && S && S.pmap[id]) {
    const p = S.pmap[id];
    p.ctrl = 'bot'; p.isBot = true; p.ai = newAI(p); p.name = p.name + ' (BOT)';
    emit({ k: 'msg', small: p.name.replace(' (BOT)', '') + ' AYRILDI — BOT DEVRALDI' });
  } else if (NET.lobby) {
    const lp = NET.lobby.players.find(p => p.id === id);
    NET.lobby.players = NET.lobby.players.filter(p => p.id !== id);
    if (NET.sel) { NET.sel.players = NET.sel.players.filter(p => p.id !== id); selBroadcast(); }
    broadcastLobby();
    if (lp) uiToast(lp.name + ' ayrıldı');
  }
}
function hostKick(id) { const c = NET.conns[id]; if (c) { netSend(c, { t: 'deny', why: 'Host tarafından çıkarıldın.' }); setTimeout(() => { try { c.close(); } catch (e) { } }, 200); } }

/* ---------------- AJAN SEÇİMİ (host/tek oyunculu ortak) ---------------- */
function selStart(players, cfg) {
  cfg = Object.assign({}, cfg);
  if (cfg.map === undefined || cfg.map === null || cfg.map < 0) cfg.map = randi(0, MAPS.length - 1);
  NET.sel = { players: players.map(p => ({ id: p.id, name: p.name, team: p.team, cos: p.cos })), picks: {}, locks: {}, remain: 35, cfg };
  try { PUB.beat(); } catch (e) { } // açık sunucu listesinde "maç başladı" olarak işaretle
  if (NET.selTimer) clearInterval(NET.selTimer);
  let last = Date.now();
  NET.selTimer = setInterval(() => {
    const now = Date.now(); NET.sel.remain -= (now - last) / 1000; last = now;
    const allLocked = NET.sel.players.every(p => NET.sel.locks[p.id]);
    if (NET.sel.remain <= 0 || allLocked) { clearInterval(NET.selTimer); NET.selTimer = null; selFinish(); }
    else selBroadcast();
  }, 250);
  selBroadcast();
}
function selTaken(team, agent, exceptId) {
  return NET.sel.players.some(p => p.team === team && p.id !== exceptId && NET.sel.picks[p.id] === agent);
}
function selApplyPick(id, agent) {
  const s = NET.sel; if (!s || !AGENTS[agent] || s.locks[id]) return;
  const pl = s.players.find(p => p.id === id); if (!pl) return;
  if (selTaken(pl.team, agent, id)) return;
  s.picks[id] = agent; selBroadcast();
}
function selApplyLock(id) {
  const s = NET.sel; if (!s || !s.picks[id]) return;
  s.locks[id] = true; selBroadcast();
}
function selBroadcast() {
  if (!NET.sel) return;
  if (NET.mode === 'host') broadcast({ t: 'sel', sel: NET.sel });
  if (typeof uiRenderSelect === 'function') uiRenderSelect(NET.sel);
}
function selFinish() {
  const s = NET.sel, humans = [];
  for (const p of s.players) {
    let ag = s.picks[p.id];
    if (!ag || selTaken(p.team, ag, p.id)) { const free = AGENT_IDS.filter(a => !selTaken(p.team, a, p.id)); ag = pick(free); s.picks[p.id] = ag; }
    humans.push({ id: p.id, name: p.name, team: p.team, agent: ag, bot: false, cos: p.cos ? cosClean(p.cos) : undefined });
  }
  const roster = buildRoster(humans, s.cfg);
  NET.sel = null;
  // lobide/ajan seçiminde uzun süre sessiz kalan istemciler maç başında düşürülmesin;
  // istemcinin büyük haritayı yüklemesi için de ek süre tanı
  for (const id in NET.conns) NET.conns[id]._last = performance.now() + 20000;
  launchGame(roster, s.cfg);
}
const BOT_NAMES = ['Kuzgun', 'Atlas', 'Nova', 'Poyraz', 'Kor', 'Demir', 'Yıldız', 'Tufan', 'Alaz', 'Bora', 'Kaya', 'Sarp'];
function buildRoster(humans, cfg) {
  const roster = humans.map(h => Object.assign({}, h));
  const names = shuffle(BOT_NAMES.slice());
  let bn = 0;
  for (const team of [0, 1]) {
    let n = roster.filter(r => r.team === team).length;
    const target = cfg.fill ? cfg.teamSize : Math.max(1, n);
    while (n < target) {
      const used = new Set(roster.filter(r => r.team === team).map(r => r.agent));
      const ag = pick(AGENT_IDS.filter(a => !used.has(a)));
      roster.push({ id: 'b' + (++bn), name: names[(bn - 1) % names.length], team, agent: ag, bot: true, cos: cosRandomBot() });
      n++;
    }
  }
  return roster;
}
function launchGame(roster, cfg) {
  G.mode = NET.mode === 'host' ? 'host' : 'sp';
  G.cfg = cfg;
  createGame(roster, cfg);
  for (const id in (NET.vs || {})) if (S.pmap[id]) { S.pmap[id].vm = NET.vs[id].vm; S.pmap[id].vt = NET.vs[id].vt; }
  if (NET.mode === 'host') { for (const id in NET.conns) { NET.conns[id]._snPrev = null; NET.conns[id]._evq = []; } NET.lobby.inGame = true; NET.lobby.autoAt = 0; try { PUB.beat(); } catch (e) { } broadcast({ t: 'start', roster, cfg }); vcBroadcastDir(); }
  uiStartGame();
}

/* ---------------- ANLIK GÖRÜNTÜ (SNAPSHOT) ---------------- */
function snapP(p) {
  const st = {}; for (const k in p.st) if (p.st[k] > 0) st[k] = r2(p.st[k]);
  return {
    id: p.id, name: p.name, team: p.team, agent: p.agent, isBot: p.isBot, x: r1(p.x), y: r1(p.y), ang: r2(p.ang), pitch: r2(p.pitch || 0), vx: r1(p.vx), vy: r1(p.vy),
    hp: Math.ceil(p.hp), armor: Math.ceil(p.armor), alive: p.alive, credits: p.credits, primary: p.primary, secondary: p.secondary, slot: p.slot,
    ammo: p.ammo, ch: p.ch, ult: p.ult, st, slowAmt: p.slowAmt, zoneSlow: r2(p.zoneSlow), zoneFire: r2(p.zoneFire), hasSpike: p.hasSpike, kit: p.kit ? 1 : 0,
    plantT: r2(p.plantT), defT: r2(p.defT), crouch: p.crouch, kills: p.kills, deaths: p.deaths, dmg: Math.round(p.dmg), posVer: p.posVer, reloadT: r2(p.reloadT),
    switchT: r2(p.switchT), bloom: Math.round(p.bloom * 1000) / 1000, scoped: p.scoped, spd: Math.round(p.spd), shotN: p.shotN, jz: r1(p.jz || 0), rbT: r2(p.rbT || 0), tk: p.tk || 0, vm: p.vm ? 1 : 0, vt: p.vt ? 1 : 0
  };
}
function makeSnapshot() {
  return {
    tm: r2(S.time), ph: S.phase, pt: r2(S.phaseT), rd: S.round, ff: ffOn() ? 1 : 0, sc: S.score, sw: S.swapped ? 1 : 0, mw: S.matchWinner, res: S.lastResult,
    pl: S.players.map(snapP),
    pj: S.proj.map(pr => ({ id: pr.id, type: pr.type, x: r1(pr.x), y: r1(pr.y), vx: r1(pr.vx), vy: r1(pr.vy), team: pr.team, r: pr.r, trav: r1(pr.trav), maxD: r1(pr.maxD), gh: pr.ghost ? 1 : 0 })),
    ar: S.areas.map(a => ({ id: a.id, type: a.type, x: r1(a.x), y: r1(a.y), r: a.r, t: r2(a.t), dur: a.dur, team: a.team, owner: a.owner, pts: a.pts, pr: a.pr })),
    dp: S.deps.map(d => ({ id: d.id, type: d.type, x: r1(d.x), y: r1(d.y), team: d.team, owner: d.owner, hp: Math.ceil(d.hp || 0), hr: d.hr, ang: r2(d.ang || 0), aim: r2(d.aim || 0), arm: r2(d.arm || 0), trig: r2(d.trig || 0), wind: r2(d.wind || 0), r: d.r || 0 })),
    bm: S.beams.map(b => ({ id: b.id, type: b.type, x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, w: b.w, wind: r2(b.wind), shots: b.shots, team: b.team })),
    tw: S.twalls.map(w => ({ id: w.id, tiles: w.tiles, hp: Math.ceil(w.hp), t: r1(w.t) })),
    sp: { state: S.spike.state, carrier: S.spike.carrier, x: r1(S.spike.x), y: r1(S.spike.y), t: r2(S.spike.t), site: S.spike.site, defuser: S.spike.defuser, prog: r2(S.spike.prog), half: S.spike.half },
    ob: S.orbs, cp: S.corpses, cd: S.cards || [], rb: (S.rb || []).map(r => r2(r.cd)), hl: (S.heal || []).map(h => h.cd > 0 ? 1 : 0), ev: S.evq.slice()
  };
}
function netHostUpdate(dt) {
  if (NET.mode !== 'host') { S.evq.length = 0; return; }
  NET.hbT = (NET.hbT || 0) - dt;
  if (NET.hbT <= 0) {
    NET.hbT = 1;
    const now = performance.now();
    for (const id in NET.conns) { const c = NET.conns[id]; if (!c._last) c._last = now; if (now - c._last > 10000) hostDrop(c); }
  }
  NET.snapT -= dt;
  if (NET.snapT > 0) return;
  NET.snapT = 1 / 20;
  const snap = makeSnapshot();
  S.evq.length = 0;
  // FARK (delta) GÖNDERİMİ: kanal sıralı + güvenilir olduğundan her istemciye yalnızca son
  // gönderilenden bu yana DEĞİŞEN alanlar gider (veri ~4-5 kat azalır). Bağlantısı yavaş olan
  // istemcinin kuyruğu dolarsa o anlık görüntü atlanır (olaylar biriktirilir) — hat tıkanmaz.
  const J = { top: {}, pl: {} };
  for (const k in snap) if (k !== 'pl' && k !== 'ev') J.top[k] = JSON.stringify(snap[k]);
  for (const sp of snap.pl) { const o = J.pl[sp.id] = {}; for (const k in sp) o[k] = JSON.stringify(sp[k]); }
  for (const id in NET.conns) {
    const c = NET.conns[id]; if (!c || !c.open) continue;
    const q = c._evq || (c._evq = []);
    for (const e of snap.ev) q.push(e);
    if (q.length > 400) q.splice(0, q.length - 400);
    const dc = c.dataChannel;
    if (dc && dc.bufferedAmount > 96 * 1024) { c._skip = (c._skip || 0) + 1; continue; }
    // her 2 sn'de bir TAM görüntü: istemcide herhangi bir şey kaymışsa (oyuncu görünmez kalmış vb.) kendiliğinden düzelir
    if ((c._kf = (c._kf || 0) + 1) >= 40) { c._kf = 0; c._snPrev = null; }
    const prev = c._snPrev || (c._snPrev = { top: {}, pl: {} }), out = {};
    for (const k in J.top) if (k === 'tm' || prev.top[k] !== J.top[k]) { out[k] = snap[k]; prev.top[k] = J.top[k]; }
    out.ev = q.splice(0, q.length);
    out.pl = [];
    for (const sp of snap.pl) {
      const pj = J.pl[sp.id], pp = prev.pl[sp.id] || (prev.pl[sp.id] = {});
      let o = null;
      for (const k in pj) if (pp[k] !== pj[k]) { (o || (o = { id: sp.id }))[k] = sp[k]; pp[k] = pj[k]; }
      if (o) out.pl.push(o);
    }
    netSend(c, { t: 's', s: out });
  }
}

/* ---------------- İSTEMCİ ---------------- */
const NAT_MSG = 'Oda bulundu ama host ile bağlantı kurulamadı (NAT / güvenlik duvarı engeli — farklı ağlarda sık olur). ' +
  'Çözüm: ana menü → BAĞLANTI AYARLARI\'ndan ücretsiz bir TURN sunucusu ekleyin (host\'un eklemesi genelde yeterli) ve odayı yeniden kurup tekrar deneyin.';
function clientJoin(code, name, onOk, onErr, onStatus) {
  if (!netAvailable()) { onErr('PeerJS kütüphanesi yüklenemedi (internet bağlantısı gerekli).'); return; }
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 4) { onErr('Geçerli bir oda kodu gir.'); return; }
  if (!rtcAvailable()) { onErr(netBlockedMsg('Bu tarayıcı WebRTC desteklemiyor.')); return; }
  NET.mode = 'client'; NET.connecting = true;
  const st = m => { if (onStatus) onStatus(m); };
  let stage = 'server', tries = 0, done = false;
  const fail = msg => {
    if (done) return; done = true; NET.connecting = false; clearTimeout(to); NET.pendingFail = null;
    NET.conn = null; netShutdown(); onErr(msg);
  };
  NET.pendingFail = fail;
  const to = setTimeout(() => fail(stage === 'server' ? netBlockedMsg('Eşleştirme sunucusuna (PeerJS) ulaşılamadı. İnternet bağlantını kontrol et ya da biraz sonra tekrar dene.')
    : stage === 'room' ? 'Oda bulunamadı. Kodu kontrol et; host\'un oyunu açık ve lobide olmalı.' : NAT_MSG), 35000);
  st('Eşleştirme sunucusuna bağlanılıyor…');
  let peer;
  try { peer = new Peer(peerOpts()); }
  catch (e) { fail(netBlockedMsg('Bağlantı başlatılamadı (' + (e && e.message ? e.message : e) + ').')); return; }
  NET.peer = peer;
  peer.on('call', c => VC.onCall(c));
  if (IN_FRAME) setTimeout(() => { if (!done && stage === 'server') fail(netBlockedMsg('Eşleştirme sunucusuna (PeerJS) ulaşılamadı.')); }, 8000);
  const attempt = () => {
    if (done || NET.peer !== peer) return;
    stage = 'room'; st(tries ? 'Oda aranıyor… (' + (tries + 1) + '. deneme)' : 'Oda aranıyor…');
    const c = peer.connect(PEER_PREFIX + code.toLowerCase(), { reliable: true, serialization: 'json' });
    NET.conn = c;
    const mine = () => NET.conn === c && !done;
    // ICE durumunu izle: "checking" → NAT geçişi sürüyor, "failed" → doğrudan/aktarma yolu yok
    let polls = 0;
    const watchIce = () => {
      if (!mine()) return;
      const pc = c.peerConnection;
      if (!pc) { if (++polls < 150) setTimeout(watchIce, 100); return; }
      const h = () => {
        if (!mine()) return;
        const s2 = pc.iceConnectionState;
        if (s2 === 'checking' || s2 === 'new') { stage = 'ice'; st('Oda bulundu, bağlantı kuruluyor (NAT geçişi)…'); }
        else if (s2 === 'failed') fail(NAT_MSG);
      };
      pc.addEventListener('iceconnectionstatechange', h); h();
    };
    watchIce();
    c.on('open', () => { if (!mine()) return; stage = 'hello'; st('Bağlandı, lobiye giriliyor…'); netSend(c, { t: 'hello', name, uid: FR.uid, cos: SHOP.cos() }); });
    c.on('data', d => {
      if (NET.conn !== c) return;
      if (d && d.t === 'welcome') { if (done) return; done = true; NET.connecting = false; clearTimeout(to); NET.pendingFail = null; G.myId = d.id; onOk(); }
      else if (d && d.t === 'deny') { fail(d.why); return; }
      clientRecv(d);
    });
    const onClose = () => {
      if (NET.conn !== c) return;
      if (NET.connecting) { if (stage === 'ice' || stage === 'hello') fail(stage === 'ice' ? NAT_MSG : 'Host bağlantıyı kapattı.'); }
      else clientLost();
    };
    c.on('close', onClose);
    c.on('error', onClose);
  };
  peer.on('open', () => { if (NET.peer === peer) attempt(); });
  peer.on('error', e => {
    if (NET.peer !== peer) return;
    const ty = e && e.type ? e.type : String(e);
    if (!NET.connecting) return; // maç sırasında sunucu hataları önemsiz (veri doğrudan akar)
    if (ty === 'peer-unavailable') {
      // host'un sunucu bağlantısı geçici kopmuş olabilir (ör. telefonda başka uygulamaya geçti): birkaç kez dene
      if (++tries < 4) { stage = 'room'; st('Oda henüz bulunamadı, tekrar deneniyor… (' + tries + '/3)'); setTimeout(attempt, 2000); }
      else fail('Oda bulunamadı. Kodu kontrol et; host\'un oyunu açık ve lobide olmalı. (Host telefondaysa kodu paylaşırken oyunu arka planda bırakmasın.)');
      return;
    }
    if (NET_SIG_ERR[ty] && stage !== 'server') { try { if (!peer.destroyed && peer.disconnected) peer.reconnect(); } catch (x) { } return; }
    fail(NET_SIG_ERR[ty] || ty === 'server-error' ? netBlockedMsg('Eşleştirme sunucusuna (PeerJS) ulaşılamadı (' + ty + '). İnternetini kontrol et ya da biraz sonra tekrar dene.') : netBlockedMsg('Bağlantı hatası: ' + ty));
  });
  peer.on('disconnected', () => { if (NET.peer === peer && NET.connecting) { try { if (!peer.destroyed) peer.reconnect(); } catch (x) { } } });
}
/* Bağlantı testi: eşleştirme sunucusu + STUN (genel IP) + TURN (aktarma) adaylarını kontrol eder */
function netDiag(done) {
  const res = { sig: null, host: false, srflx: false, relay: false, relayCustom: false, err: '' };
  let pending = 2;
  const fin = () => { if (--pending === 0) done(res); };
  // 1) eşleştirme sunucusu
  if (!netAvailable()) { res.sig = false; fin(); }
  else {
    let p = null, ok = false;
    const t = setTimeout(() => { if (!ok) { res.sig = false; try { p.destroy(); } catch (e) { } fin(); } }, 10000);
    try {
      p = new Peer(peerOpts());
      p.on('open', () => { if (ok) return; ok = true; clearTimeout(t); res.sig = true; try { p.destroy(); } catch (e) { } fin(); });
      p.on('error', () => { if (ok) return; ok = true; clearTimeout(t); res.sig = false; try { p.destroy(); } catch (e) { } fin(); });
    } catch (e) { ok = true; clearTimeout(t); res.sig = false; fin(); }
  }
  // 2) ICE adayları
  if (!rtcAvailable()) { res.err = 'WebRTC kullanılamıyor'; fin(); return; }
  try {
    const t = turnLoad(), cu = turnUrls(t);
    const pc = new RTCPeerConnection(iceConfig());
    pc.createDataChannel('t');
    let closed = false;
    const end = () => { if (closed) return; closed = true; try { pc.close(); } catch (e) { } fin(); };
    pc.onicecandidate = e => {
      if (!e.candidate) { end(); return; }
      const c = e.candidate.candidate || '';
      if (/ typ host/.test(c)) res.host = true;
      if (/ typ srflx/.test(c)) res.srflx = true;
      if (/ typ relay/.test(c)) {
        res.relay = true;
        const url = e.candidate.url || '';
        if (cu.length && (!url || cu.some(u => url.indexOf(u.replace(/^(turns?):/i, '').split('?')[0]) >= 0))) res.relayCustom = true;
      }
    };
    pc.createOffer().then(o => pc.setLocalDescription(o)).catch(err => { res.err = String(err); end(); });
    setTimeout(end, 9000);
  } catch (e) { res.err = String(e); fin(); }
}
function clientLost() {
  if (NET.mode !== 'client') return;
  netShutdown();
  uiBackToMenu('Host ile bağlantı koptu.');
}
function clientRecv(d) {
  if (!d || typeof d !== 'object') return;
  if (d instanceof ArrayBuffer) { const pk = vxParse(d); if (pk) VC.play(pk.id, pk.data); return; } // sesli sohbet paketi
  switch (d.t) {
    case 'lobby': NET.lobby = d.lobby; NET.lobby._at = performance.now(); if (typeof uiRenderLobby === 'function') uiRenderLobby(); break;
    case 'sel': NET.sel = d.sel; uiRenderSelect(d.sel); break;
    case 'start':
      NET.sel = null; G.mode = 'client'; G.cfg = d.cfg;
      loadMap(d.cfg.map || 0);
      S = newState(d.cfg);
      for (const r of d.roster) { const p = makePlayer(r); p.ctrl = r.id === G.myId ? 'local' : (r.bot ? 'bot' : 'remote'); p.ai = null; S.players.push(p); S.pmap[p.id] = p; }
      NET.haveOff = false; NET.lastSnap = performance.now(); NET.full = {}; NET.npl = {};
      { const me = S.pmap[G.myId]; if (me) { LOOK.yaw = sideOf(me.team) === 'atk' ? -Math.PI / 2 : Math.PI / 2; LOOK.pitch = 0; } }
      uiStartGame();
      break;
    case 's': clientApplySnap(d.s); break;
    case 'vdir': VC.setDir(d.d); break;
    case 'lchat': lobbyChatAdd(d); break;
    case 'pong': NET.ping = Math.round(performance.now() - d.c); break;
  }
}
function clientApplySnap(d) {
  if (!S) return;
  NET.lastSnap = performance.now();
  // farkı son bilinen tam durumla birleştir (gelmeyen alanlar değişmemiştir)
  const F = NET.full || (NET.full = {}), PL = NET.npl || (NET.npl = {});
  for (const k in d) if (k !== 'pl' && k !== 'ev') F[k] = d[k];
  const s = Object.assign({}, F); s.ev = d.ev || [];
  s.pl = (d.pl || []).map(dp => Object.assign(PL[dp.id] || (PL[dp.id] = {}), dp));
  const hasPj = 'pj' in d, hasTw = 'tw' in d;
  const now = performance.now() / 1000, off = s.tm - now;
  if (!NET.haveOff || Math.abs(off - NET.offset) > 0.25) { NET.offset = off; NET.haveOff = true; }
  else NET.offset = NET.offset * 0.92 + off * 0.08;
  const prevPhase = S.phase;
  if (S.cfg && s.ff !== undefined) S.cfg.ff = !!s.ff;
  S.time = s.tm; S.phase = s.ph; S.phaseT = s.pt; S.round = s.rd; S.score = s.sc; S.swapped = !!s.sw; S.matchWinner = s.mw; S.lastResult = s.res;
  // konumu değişmeyen uzak oyuncular için de interpolasyon geçmişine nokta ekle
  for (const id in PL) if (!d.pl || !d.pl.some(x => x.id === id)) { const p = S.pmap[id], sp = PL[id]; if (p && id !== G.myId && p.hist) { p.hist.push({ t: s.tm, x: sp.x, y: sp.y, a: sp.ang, pt: sp.pitch || 0, z: sp.jz || 0 }); if (p.hist.length > 24) p.hist.shift(); } }
  for (const sp of s.pl) {
    let p = S.pmap[sp.id];
    if (!p) { p = makePlayer({ id: sp.id, name: sp.name, team: sp.team, agent: sp.agent, bot: sp.isBot }); p.ai = null; S.players.push(p); S.pmap[p.id] = p; }
    if (sp.id === G.myId) {
      const keep = { x: p.x, y: p.y, ang: p.ang, pitch: p.pitch, crouch: p.crouch, vx: p.vx, vy: p.vy, imp: p.imp, posVer: p.posVer, spd: p.spd, input: p.input, ctrl: 'local', jz: p.jz, jvz: p.jvz, lastJc: p.lastJc };
      const wasAlive = p.alive;
      Object.assign(p, sp); Object.assign(p, keep); p.st = Object.assign({}, sp.st);
      if (sp.posVer > keep.posVer || (!wasAlive && sp.alive)) { p.x = sp.x; p.y = sp.y; p.posVer = sp.posVer; p.vx = 0; p.vy = 0; p.imp = null; p.jz = 0; p.jvz = 0; }
      if (!sp.alive) p.imp = null;
    } else {
      const hist = p.hist || [];
      Object.assign(p, sp); p.st = Object.assign({}, sp.st);
      p.hist = hist;
      hist.push({ t: s.tm, x: sp.x, y: sp.y, a: sp.ang, pt: sp.pitch || 0, z: sp.jz || 0 });
      if (hist.length > 24) hist.shift();
    }
  }
  if (hasPj) { // mermiler: snapshot konumuna ışınlanmak yerine yumuşakça yaklaş (titreme olmasın)
    const old = {}; for (const pr of S.proj || []) old[pr.id] = pr;
    const age = clamp(clientServerNow() - s.tm, 0, 0.25);
    for (const np of s.pj) {
      np.tx = np.x + np.vx * age; np.ty = np.y + np.vy * age;
      const o = old[np.id];
      np.ox = 0; np.oy = 0;
      if (o && Math.abs(o.x - np.tx) + Math.abs(o.y - np.ty) < 260) { np.ox = o.x - np.tx; np.oy = o.y - np.ty; }
      np.x = np.tx + np.ox; np.y = np.ty + np.oy;
    }
  }
  if (hasPj) S.proj = s.pj;
  if ('ar' in d) S.areas = s.ar;
  if ('dp' in d) S.deps = s.dp;
  if ('bm' in d) S.beams = s.bm;
  if ('sp' in d) S.spike = s.sp;
  if ('ob' in d) S.orbs = s.ob;
  if ('cp' in d) S.corpses = s.cp;
  if ('cd' in d) S.cards = s.cd || [];
  if ('rb' in d) S.rb = (s.rb || []).map(cd => ({ cd }));
  if ('hl' in d || !S.heal) S.heal = (MAPDATA.heal || []).map((h, i) => ({ id: h.id, x: h.x, y: h.y, cd: s.hl && s.hl[i] ? 1 : 0 }));
  if (hasTw) { S.twalls = s.tw; tgrid.fill(0); for (const w of S.twalls) for (const i of w.tiles) tgrid[i] = w.id; }
  for (const ev of s.ev) handleEvent(ev);
  if (prevPhase !== S.phase && S.phase === 'buy') LOCALFIRE.mag = null;
}
function clientServerNow() { return performance.now() / 1000 + NET.offset; }
function clientInterp() {
  const rt = clientServerNow() - INTERP;
  for (const p of S.players) {
    if (p.id === G.myId || !p.hist || !p.hist.length) continue;
    const h = p.hist;
    if (rt <= h[0].t) { p.x = h[0].x; p.y = h[0].y; p.ang = h[0].a; continue; }
    let done = false;
    for (let i = h.length - 1; i > 0; i--) {
      if (h[i - 1].t <= rt && rt <= h[i].t) {
        const f = (rt - h[i - 1].t) / Math.max(1e-6, h[i].t - h[i - 1].t);
        const a = h[i - 1], b = h[i];
        if (dist(a.x, a.y, b.x, b.y) > 160) { p.x = b.x; p.y = b.y; } else { p.x = lerp(a.x, b.x, f); p.y = lerp(a.y, b.y, f); }
        p.ang = a.a + angDiff(a.a, b.a) * f; p.pitch = lerp(a.pt || 0, b.pt || 0, f); p.jz = lerp(a.z || 0, b.z || 0, f); done = true; break;
      }
    }
    if (!done) { const l = h[h.length - 1]; p.x = l.x; p.y = l.y; p.ang = l.a; }
  }
}
/* İstemci kendi atışını anında hisseder (ses + namlu alevi); isabet hesabı host'ta */
const LOCALFIRE = { cd: 0, lastFp: 0, pend: false, pendT: 0, mag: null };
function clientUpdate(dt) {
  const me = S.pmap[G.myId];
  if (NET.lastSnap && performance.now() - NET.lastSnap > 10000) { clientLost(); return; }
  clientInterp();
  for (const pr of S.proj) {
    if (pr.tx === undefined) { pr.tx = pr.x; pr.ty = pr.y; pr.ox = 0; pr.oy = 0; }
    const nx = pr.tx + pr.vx * dt, ny = pr.ty + pr.vy * dt;
    if (pr.gh || !rayBlockAt(nx, ny)) { pr.tx = nx; pr.ty = ny; } // duvarın içine tahmin etme; host sektirir/patlatır
    const k = Math.exp(-dt * 12); pr.ox *= k; pr.oy *= k; // düzeltme farkı yumuşakça erir (gecikme yok)
    pr.x = pr.tx + pr.ox; pr.y = pr.ty + pr.oy;
    pr.trav = (pr.trav || 0) + Math.hypot(pr.vx, pr.vy) * dt;
  }
  for (const a of S.areas) a.t -= dt;
  for (const p of S.players) for (const k in p.st) { p.st[k] -= dt; if (p.st[k] <= 0) delete p.st[k]; }
  if (S.spike.state === 'planted') S.spike.t = Math.max(0, S.spike.t - dt);
  if (S.phase !== 'over') S.phaseT = Math.max(0, S.phaseT - dt);
  if (me) {
    const inp = buildLocalInput(me);
    me.input = inp;
    if (me.alive) {
      me.ang = inp.ang; me.pitch = inp.pitch; me.crouch = !!inp.crouch && !(me.st.knock > 0);
      movePlayer(me, dt, inp);
      separateOne(me);
      clientPredictFire(me, inp, dt);
    }
    NET.sendT -= dt;
    if (NET.sendT <= 0) {
      NET.sendT = 1 / 30;
      netSend(NET.conn, { t: 'in', x: r1(me.x), y: r1(me.y), ang: r2(inp.ang), pt: r2(inp.pitch), mvx: r2(inp.mvx), mvy: r2(inp.mvy), walk: inp.walk, cr: inp.crouch, fire: inp.fire, fp: inp.fp, alt: inp.alt, use: inp.use, mv: r2(me.spd / RUN), pv: me.posVer, rt: r2(clientServerNow() - INTERP), jc: inp.jc, jz: r1(me.jz || 0) });
    }
  }
  NET.pingT -= dt;
  if (NET.pingT <= 0) { NET.pingT = 2; netSend(NET.conn, { t: 'ping', c: performance.now() }); }
}
function clientPredictFire(me, inp, dt) {
  const LF = LOCALFIRE, wid = curW(me), w = wid === 'sword' ? swordStats(me) : WEAPONS[wid];
  LF.cd -= dt * (me.zoneFire || 1);
  if (inp.fp !== LF.lastFp) { LF.lastFp = inp.fp; LF.pend = true; LF.pendT = 0.35; }
  if (LF.pend) { LF.pendT -= dt; if (LF.pendT <= 0) LF.pend = false; }
  if (S.phase === 'buy' || S.phase === 'over' || me.st.ovl > 0 || me.st.lock > 0 || me.st.knock > 0 || inp.use || me.plantT > 0 || me.defT > 0) return;
  if (me.reloadT > 0 || me.switchT > 0) return;
  if (w.melee) {
    const heavy = inp.alt && !inp.fire && !LF.pend;
    if ((inp.fire || LF.pend || heavy) && LF.cd <= 0) { LF.cd = 1 / (heavy ? w.heavyRate : w.rate); LF.pend = false; VM.swing = 1; VM.swingHeavy = heavy; AU.play('sword', me.x, me.y, 1, true); }
    return;
  }
  const am = me.ammo[wid]; if (!am || am.mag <= 0) return;
  const want = w.auto ? (inp.fire || LF.pend) : LF.pend;
  if (want && LF.cd <= 0) {
    LF.cd = 1 / w.rate; LF.pend = false;
    am.mag--;
    AU.play(w.snd, me.x, me.y, 1, true);
    VM.kick = Math.min(1, VM.kick + (w.dmg > 100 ? 1 : 0.45)); VM.flash = 0.05;
    UIS.shake = Math.max(UIS.shake, w.dmg > 100 ? 4 : 1);
  }
}
