/* =====================================================================
   07c · HUD (2D katman, WebGL'in üstünde) ve OLAYLAR
        skor/süre, ajan ikonları, minimap, öldürme akışı, can/zırh/kredi/
        mermi, Q-E-X, nişangah, dürbün, dünya işaretleri, ekran efektleri
   ===================================================================== */
let cv = null, ctx = null, glcv = null, W = 1280, H = 720;
let miniCv = null;
const UIS = { chat: [], healFlash: 0, ff: null, feed: [], msgs: [], banner: null, hit: 0, hitHs: false, hitKill: 0, dmgFlash: 0, dmgDirs: [], pings: [], shake: 0, ultFeed: [], shroudFlash: 0, nukeFlash: 0, beepT: 0, deathBy: undefined, teamSeen: new Set(), menuT: 0, dmgNums: [] };
const UI = { overlay: false, buyOpen: false, pauseOpen: false, board: false, screen: 'menu' };
const KEYS = {}, MOUSE = { x: 640, y: 360, down: false, right: false, fp: 0 };
const LOOK = { yaw: 0, pitch: 0 };
const FONT = '"Bahnschrift","DIN Alternate","Arial Narrow","Roboto Condensed","Segoe UI",Arial,sans-serif';
const SRC_NAMES = { sword: 'Kılıç', blade: 'Karanlık Kesik', fire: 'Ateş Duvarı', poison: 'Zehir Sisi', mine: 'Tuzak Mayını', turret: 'Mini Taret', shock: 'Şok Oku', orbital: 'Yörünge Lazeri', quake: 'Sarsıntı Dalgası', rift: 'Tektonik Yarık', chain: 'Zincir Yük', overload: 'Aşırı Yük', wolf: 'Gölge Kurdu', bomb: 'BOMBA', nightmare: 'Kabus Alanı', tcollapse: 'Zaman Çöküşü', railgun: 'Railgun' };
const REASONS = { elim: 'Rakip takım elendi', time: 'Süre doldu', bomb: 'Bomba patladı', defuse: 'Bomba imha edildi', arena: '' };

function initRender() {
  glcv = document.getElementById('gl'); cv = document.getElementById('hud'); ctx = cv.getContext('2d');
  let ok = false;
  try { ok = glInit(glcv); } catch (e) { console.error(e); ok = false; }
  loadMap(0);
  resize(); window.addEventListener('resize', resize);
  return ok;
}
let HUD_DPR = 1;
function resize() {
  W = window.innerWidth; H = window.innerHeight;
  // arayüz katmanı ekranın piksel yoğunluğunda (yazılar ve simgeler telefonda bulanık/pikselli olmasın)
  HUD_DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * HUD_DPR); cv.height = Math.round(H * HUD_DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  glResize(W, H);
}
function buildMinimap() {
  miniCv = document.createElement('canvas'); miniCv.width = MW * 4; miniCv.height = MH * 4;
  const m = miniCv.getContext('2d');
  m.fillStyle = '#081018'; m.fillRect(0, 0, miniCv.width, miniCv.height);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const t = grid[y * MW + x];
    if (t === T_WALL) continue;
    m.fillStyle = t === T_BOX ? '#3a3326' : t === T_LOW ? '#46503a' : t === T_WATER ? '#1d4f6e' : (t === T_A || t === T_B) ? '#4a4537' : t === T_ATK ? '#3b2630' : t === T_DEF ? '#1f3b3d' : '#2a3a48';
    m.fillRect(x * 4, y * 4, 4, 4);
  }
  m.font = 'bold 20px ' + FONT; m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillStyle = 'rgba(245,196,81,0.75)';
  if (MAPDATA && MAPDATA.sites) for (const sn of ['A', 'B']) { const c = MAPDATA.sites[sn].center; m.fillText(sn, (c[0] + 0.5) * 4, (c[1] + 0.5) * 4); }
}
function viewer() {
  const me = S.pmap[G.myId];
  if (!me) return S.players[0];
  if (me.alive) return me;
  const pool = specPool(me);
  let sp = G.spec ? S.pmap[G.spec] : null;
  if (!sp || !pool.includes(sp)) { sp = pool[0] || null; G.spec = sp ? sp.id : null; }
  return sp || me;
}
/* ölüyken izlenebilecekler: önce hayattaki takım arkadaşları; takımda kimse kalmadıysa hayattaki rakipler */
function specPool(me) {
  const mates = S.players.filter(p => p.alive && p.team === me.team);
  return mates.length ? mates : S.players.filter(p => p.alive && p.team !== me.team);
}
function audioListener() {
  if (!S) return { x: 0, y: 0, ang: 0, deaf: false };
  const me = S.pmap[G.myId], v = viewer();
  const ang = (v === me && me && me.alive) ? LOOK.yaw : (v ? v.ang : 0);
  return { x: v ? v.x : 0, y: v ? v.y : 0, ang, deaf: !!(me && me.alive && me.st.deaf > 0) };
}
function showMsg(big, small, col, dur) {
  if (big) UIS.banner = { big, small: small || '', col: col || PAL.white, t: dur || 2.6, dur: dur || 2.6 };
  else if (small) { UIS.msgs.push({ text: small, col: col || PAL.white, t: 2.6 }); if (UIS.msgs.length > 4) UIS.msgs.shift(); }
}
function myTeam() { const me = S && S.pmap[G.myId]; return me ? me.team : 0; }
function traceCol(w) { return w && w.trace && w.trace[0] === '#' ? hexRGB(w.trace) : [0.8, 0.9, 1, 1]; }

/* ---------------- OLAYLAR (host anında, istemci snapshot ile) ---------------- */
function handleEvent(ev) {
  if (!S) return;
  const me = S.pmap[G.myId];
  if (PKMAP && pkOn() && pkEvent(ev, me)) return; // parkur olayları (07e)
  switch (ev.k) {
    case 'sh': {
      const w = WEAPONS[ev.w], own = ev.id === G.myId && ev.w !== 'turret';
      const vw = viewer(), fromViewer = vw && ev.id === vw.id && ev.w !== 'turret';
      // SİLAH SKİNİ: mermi rengi + arkasında bıraktığı renkli iz
      const shp = S.pmap[ev.id], sk = shp && shp.wsk && WSK[shp.wsk] && ev.w !== 'turret' ? WSK[shp.wsk] : null;
      const skc = sk ? (sk.rb ? rbCol(S.time * 3 + (ev.x + ev.y) * 0.001) : hexRGB(sk.c[2])) : null;
      const h1 = ev.z || 52, h2 = ev.z2 === undefined ? 40 : ev.z2, rail = ev.w === 'railgun';
      addFx({ type: 'tracer', x: ev.x, y: ev.y, h: h1, x2: ev.x2, y2: ev.y2, h2, c: skc || traceCol(w), w: (rail ? 4.2 : ev.w === 'operator' ? 2.4 : 1.1) * (sk ? 1.35 : 1), t: rail ? 0.5 : sk ? 0.14 : 0.09, dur: rail ? 0.5 : sk ? 0.14 : 0.09 });
      if (sk) { // kendi atışında iz, kameranın dibinden değil biraz ileriden başlar (ekranı kaplamasın)
        const L = dist(ev.x, ev.y, ev.x2, ev.y2), off = fromViewer && !CAM.on ? Math.min(90, L * 0.4) : 0, f0 = L > 1 ? off / L : 0;
        addFx({ type: 'trail', x: lerp(ev.x, ev.x2, f0), y: lerp(ev.y, ev.y2, f0), h: lerp(h1, h2, f0), x2: ev.x2, y2: ev.y2, h2, c: skc, w: rail ? 2.2 : 0.55, t: rail ? 1.4 : 0.85, dur: rail ? 1.4 : 0.85, glow: !!sk.glow });
      }
      addFx({ type: 'impact', x: ev.x2, y: ev.y2, h: h2, t: 0.2, dur: 0.2, c: skc });
      if (!(own && G.mode === 'client')) {
        AU.play(w ? w.snd : 'turret', ev.x, ev.y, 1, own);
        if (fromViewer) { VM.kick = Math.min(1, VM.kick + (w && w.dmg > 100 ? 1 : 0.45)); VM.flash = 0.05; if (own) UIS.shake = Math.max(UIS.shake, w && w.dmg > 100 ? 4 : 1); }
        else addFx({ type: 'muzzle', x: ev.x, y: ev.y, h: ev.z || 52, t: 0.06, dur: 0.06 });
      }
      const sh = S.pmap[ev.id];
      if (sh && me && sh.team !== me.team && !(w && w.silenced) && !(me.st.deaf > 0) && dist(ev.x, ev.y, me.x, me.y) < 1500) UIS.pings.push({ x: ev.x, y: ev.y, t: 1.3 });
      break;
    }
    case 'hit': {
      const ta = S.pmap[ev.t], aa = S.pmap[ev.a];
      if (ta) ta._hitT = S.time; // vurulma sarsılması (3B karakter)
      if (ta && aa && ta !== aa && ta.team === aa.team && ev.d > 0) {
        if (ev.a === G.myId) UIS.ff = { text: 'TAKIM ARKADAŞININ CANINI ALDIN!  −' + ev.d + ' · ' + ta.name, t: 2.6, col: PAL.red };
        else if (ev.t === G.myId) UIS.ff = { text: aa.name + ' SENİ VURDU — TAKIM ATEŞİ  −' + ev.d, t: 2.6, col: PAL.gold };
      }
      if (ev.a === G.myId && ev.t !== G.myId) {
        UIS.hit = 0.22; UIS.hitHs = !!ev.hs;
        if (!ev.q) AU.play(ev.hs ? 'hs' : 'hit');
        UIS.dmgNums.push({ x: ev.x, y: ev.y, txt: String(ev.d), c: ev.hs ? '#ffd166' : '#ffffff', t: 0.8, ox: rand(-14, 14) });
      }
      if (ev.t === G.myId) {
        UIS.dmgFlash = Math.min(0.6, UIS.dmgFlash + 0.3);
        if (ev.ax !== null && ev.ax !== undefined) UIS.dmgDirs.push({ x: ev.ax, y: ev.ay, t: 1.2 });
        if (!ev.q) AU.play('hurt');
      } else addFx({ type: 'blood', x: ev.x, y: ev.y, h: ev.hs ? 64 : 42, t: 0.3, dur: 0.3 });
      break;
    }
    case 'sw': {
      const sp = S.pmap[ev.id];
      if (sp) sp._sw = 0.32;
      const vw = viewer();
      if (vw && vw.id === ev.id && !(ev.id === G.myId && G.mode === 'client')) { VM.swing = 1; VM.swingHeavy = !!ev.h; }
      if (!(ev.id === G.myId && G.mode === 'client')) AU.play('sword', ev.x, ev.y, 1, ev.id === G.myId);
      if (ev.hit) AU.play('swordhit', ev.x, ev.y, 1, ev.id === G.myId);
      break;
    }
    case 'card': {
      const c = S.pmap[ev.id], o = S.pmap[ev.o];
      if (c && o && me && c.team === me.team) {
        showMsg(null, (ev.id === G.myId ? 'SEN' : c.name) + ' · ' + o.name + ' OYUNCUSUNUN KARTINI ALDI' + (ev.id === G.myId ? ' — REBOOT İSTASYONUNA GÖTÜR' : ''), PAL.teal);
        AU.play('card', ev.x, ev.y, 1, ev.id === G.myId);
      }
      break;
    }
    case 'reboot': {
      const o = S.pmap[ev.id], b = S.pmap[ev.by];
      if (o && me && o.team === me.team) showMsg(null, o.name + ' YENİDEN DOĞDU (REBOOT · ' + (b ? b.name : '') + ')', PAL.teal);
      else if (o) showMsg(null, 'RAKİP ' + o.name + ' REBOOT İLE DÖNDÜ', PAL.red);
      if (ev.id === G.myId) { G.spec = null; UIS.deathBy = undefined; showMsg('YENİDEN DOĞDUN', 'Takım arkadaşın seni reboot etti — sadece tabanca ve kılıcın var', PAL.teal, 2.5); }
      addFx({ type: 'ring', x: ev.x, y: ev.y, r0: 10, r1: 120, c: [0.3, 0.75, 1], t: 0.9, dur: 0.9 });
      addFx({ type: 'glow', x: ev.x, y: 50, z: ev.y, r: 160, c: [0.35, 0.8, 1], t: 0.9, dur: 0.9 });
      break;
    }
    case 'req': {
      const r = S.pmap[ev.id];
      if (r && me && r.team === me.team) AU.play('request');
      break;
    }
    case 'kill': {
      UIS.feed.unshift({ a: ev.a, v: ev.v, w: ev.w, hs: ev.hs, t: 6 });
      if (UIS.feed.length > 6) UIS.feed.pop();
      if (ev.a === G.myId && ev.v !== G.myId) { AU.play('kill'); UIS.hitKill = 0.4; }
      if (ev.tk) {
        const tv = S.pmap[ev.v], ta = S.pmap[ev.a];
        if (ev.a === G.myId) UIS.ff = { text: 'TAKIM ARKADAŞININ CANINI ALDIN!  ·  ' + (tv ? tv.name : '') + ' öldü', t: 3.2, col: PAL.red };
        else if (ev.v === G.myId) UIS.ff = { text: (ta ? ta.name : '') + ' SENİ ÖLDÜRDÜ — TAKIM ATEŞİ', t: 3.2, col: PAL.gold };
      }
      if (ev.v === G.myId) { UIS.deathBy = ev.a; G.spec = null; }
      const v = S.pmap[ev.v];
      if (v) addFx({ type: 'ring', x: v.x, y: v.y, r0: 10, r1: 50, c: v.team === myTeam() ? COL.teal : COL.red, t: 0.5, dur: 0.5 });
      break;
    }
    case 'snd': AU.play(ev.s, ev.x, ev.y); break;
    case 'fx': fxFromEvent(ev, me); break;
    case 'imp': if (G.mode === 'client' && ev.id === G.myId && me) me.imp = { vx: ev.vx, vy: ev.vy, t: ev.d }; break;
    case 'emo': {
      const p = S.pmap[ev.id]; if (!p) break;
      p._emo = { e: ev.e | 0, t: EMOTE_TIME };
      AU.play('emote', ev.x, ev.y, 0.9, ev.id === G.myId);
      break;
    }
    case 'chat':
      UIS.chat.push({ id: ev.id, n: ev.n, tm: ev.tm, m: ev.m, t: 10 }); if (UIS.chat.length > 40) UIS.chat.shift();
      AU.play('click');
      break;
    case 'heal':
      if (ev.id === G.myId) { UIS.healFlash = 0.55; showMsg(null, '+' + ev.a + ' CAN', PAL.green); }
      break;
    case 'msg':
      if (ev.to && ev.to !== G.myId) break;
      if (ev.team !== undefined && me && ev.team !== me.team) break;
      if (ev.side && me && sideOf(me.team) !== ev.side) break;
      showMsg(ev.big, ev.small, ev.big ? PAL.gold : PAL.white);
      break;
    case 'round': {
      const side = me ? sideOf(me.team) : 'atk';
      if (arOn()) { // arena modları: tek uzun raunt
        const m = arMode();
        showMsg(AR_NAMES[m], m === 'gg' ? 'Her öldürmede sıradaki silah · kılıçla öldüren kazanır' : 'Parlayan bölgeyi tut · 100 puana ilk ulaşan kazanır', PAL.gold, 3.5);
        AU.play('round'); G.spec = null; UIS.deathBy = undefined; UIS.pings.length = 0;
        LOOK.yaw = side === 'atk' ? -Math.PI / 2 : Math.PI / 2; LOOK.pitch = 0;
        if (ev.n === 1 && G.running) cineStart('match');
        break;
      }
      if (ev.n === MATCH_ROUNDS) setTimeout(() => showMsg(null, 'SON RAUNT!', PAL.gold), 900);
      showMsg('RAUNT ' + ev.n + ' / ' + MATCH_ROUNDS, side === 'atk' ? 'SALDIRI — Bombayı A veya B bölgesine kur' : 'SAVUNMA — Bölgeleri koru, bombayı imha et', side === 'atk' ? PAL.red : PAL.teal, 3);
      AU.play('round'); G.spec = null; UIS.deathBy = undefined; UIS.pings.length = 0;
      LOOK.yaw = side === 'atk' ? -Math.PI / 2 : Math.PI / 2; LOOK.pitch = 0;
      if (ev.n === 1 && G.running) cineStart('match'); // maç başı sinematik giriş
      break;
    }
    case 'go': showMsg(null, arOn() ? 'BAŞLADI — BARİYERLER KALKTI' : 'RAUNT BAŞLADI — BARİYERLER KALKTI', PAL.gold); AU.play('lockbeep'); break;
    case 'gg': {
      const p = S.pmap[ev.p];
      if (ev.p === G.myId) { showMsg(null, 'SİLAH ' + (ev.l + 1) + '/' + GG_ORDER.length + ' · ' + WEAPONS[GG_ORDER[ev.l]].name, PAL.gold); AU.play('buy'); }
      else if (p && ev.l === GG_ORDER.length - 1) showMsg(null, p.name + ' SON SİLAHTA: KILIÇ!', p.team === myTeam() ? PAL.teal : PAL.red);
      break;
    }
    case 'rend': {
      const win = ev.w === myTeam();
      if (ev.r === 'arena') { const dr = ev.w === -1; showMsg(dr ? 'BERABERE' : win ? 'MAÇI KAZANDINIZ' : 'MAÇI KAYBETTİNİZ', ev.why || '', dr ? PAL.gold : win ? PAL.teal : PAL.red, 4); AU.play(win || dr ? 'win' : 'lose'); break; }
      showMsg(win ? 'RAUNDU KAZANDINIZ' : 'RAUNDU KAYBETTİNİZ', REASONS[ev.r] || '', win ? PAL.teal : PAL.red, 4);
      AU.play(win ? 'win' : 'lose');
      break;
    }
    case 'plant':
      showMsg('BOMBA KURULDU', (ev.site || '') + ' BÖLGESİ — ' + BOMB_TIME + ' SANİYE', PAL.red, 3);
      AU.play('plant', ev.x, ev.y); UIS.beepT = 0;
      break;
    case 'ult': {
      const p = S.pmap[ev.id];
      if (p) UIS.ultFeed.push({ text: p.name + ' · ' + AGENTS[p.agent].x.name.toLocaleUpperCase('tr-TR'), ally: p.team === myTeam(), t: 3.5 });
      break;
    }
    case 'buy': if (ev.id === G.myId) { AU.play('buy'); if (UI.buyOpen) uiRenderBuy(); } break;
  }
}
function computeTeamSeen(me) {
  UIS.teamSeen.clear();
  if (!me) return;
  for (const e of S.players) {
    if (!e.alive || e.team === me.team) continue;
    if (e.st.reveal > 0) { UIS.teamSeen.add(e.id); continue; }
    for (const a of S.players) if (a.alive && a.team === me.team && canSee(a, e)) { UIS.teamSeen.add(e.id); break; }
  }
}

/* ---------------- ANA ÇİZİM ---------------- */
function render(dt) {
  if (!S) return;
  const me = S.pmap[G.myId], v = viewer();
  UIS.shake = Math.max(0, UIS.shake - dt * 25);
  computeTeamSeen(me);
  // host: sabit 60 Hz simülasyon adımları arasında mermileri ileri taşıyarak çiz (yüksek Hz ekranlarda akıcı)
  const ex = G.mode !== 'client' && typeof simAcc === 'number' ? Math.min(simAcc, SIM_DT) : 0;
  if (ex > 0) for (const pr of S.proj) { pr._ox = pr.x; pr._oy = pr.y; pr.x += pr.vx * ex; pr.y += pr.vy * ex; }
  try { if (GLX.ok) render3D(dt, me, v); }
  finally { if (ex > 0) for (const pr of S.proj) { pr.x = pr._ox; pr.y = pr._oy; } }
  if (ctx.reset) ctx.reset(); // sızan save/clip durumları birikmesin (nişangâh kaybolma hatası)
  ctx.setTransform(HUD_DPR, 0, 0, HUD_DPR, 0, 0); ctx.clearRect(0, 0, W, H); ctx.globalAlpha = 1;
  if (CINE.on) { drawCine(dt, me); drawChat(dt, me); } else drawHUD(dt, me, v);
  bombBeeps(dt); footstepSounds(dt, v);
}
function renderMenuBg(dt) {
  UIS.menuT += dt;
  if (GLX.ok) render3D(dt, null, null);
  ctx.setTransform(HUD_DPR, 0, 0, HUD_DPR, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(8,13,20,0.55)'; ctx.fillRect(0, 0, W, H);
  vignette('5,8,12', 0.85, 0.2);
}

/* ---------------- HUD ---------------- */
function circle(x, y, r, fill, stroke, lw) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}
function drawBombIcon(x, y, s, blink) {
  ctx.save(); ctx.translate(x, y);
  // C4: üç kalıp, bant ve yanıp sönen LED
  const w = s * 2, h = s * 1.3;
  ctx.fillStyle = '#a89a6a'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-w / 2, -h / 6 - 0.5, w, 1); ctx.fillRect(-w / 2, h / 6 - 0.5, w, 1);
  ctx.fillStyle = '#26282b'; ctx.fillRect(-w * 0.32, -h / 2, w * 0.14, h); ctx.fillRect(w * 0.18, -h / 2, w * 0.14, h);
  ctx.strokeStyle = '#ff4655'; ctx.lineWidth = 1.5; ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = blink ? '#ff4655' : '#5a1820'; ctx.beginPath(); ctx.arc(w * 0.02, 0, s * 0.28, 0, TAU); ctx.fill();
  ctx.restore();
}
function hpBar(x, y, w, f, col) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, w * clamp(f, 0, 1), 4);
}
function vignette(col, a, inner) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * (inner || 0.3), W / 2, H / 2, Math.max(W, H) * 0.7);
  g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(1, 'rgba(' + col + ',' + a + ')');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function panel(x, y, w, h, a) { ctx.fillStyle = 'rgba(15,25,35,' + (a || 0.82) + ')'; ctx.fillRect(x, y, w, h); }
function txt(s, x, y, size, col, align, weight) {
  ctx.font = (weight || 'bold') + ' ' + size + 'px ' + FONT; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = col; ctx.fillText(tl(s), x, y);
}
function drawTopBar(me) {
  if (arOn() && S.arena) { arTopBar(me); return; }
  const mt = me ? me.team : 0, et = 1 - mt, cx = W / 2, y = IS_TOUCH ? 46 : 10; // dokunmatikte üstteki düğme sırasının altında
  const myScore = S.score[mt], enScore = S.score[et];
  panel(cx - 60, y, 120, 48, 0.9);
  let timeTxt = fmtTime(S.phaseT), timeCol = PAL.white;
  if (S.phase === 'planted') { timeCol = PAL.red; timeTxt = ''; }
  if (S.phase === 'end' || S.phase === 'over') timeTxt = '—';
  txt(timeTxt, cx, y + 21, 26, timeCol, 'center');
  if (S.phase === 'planted') {
    const sp = S.bomb, blink = (S.time * (sp.t < 10 ? 4 : 2)) % 1 < 0.5;
    drawBombIcon(cx, y + 20, 13, blink);
    txt(Math.ceil(sp.t) + 's', cx + 34, y + 21, 14, PAL.red, 'center');
  }
  const phaseName = S.phase === 'buy' ? 'SATIN ALMA' : S.phase === 'planted' ? 'BOMBA KURULU' : S.phase === 'end' ? 'RAUNT SONU' : S.phase === 'over' ? 'MAÇ BİTTİ' : 'RAUNT ' + S.round + '/' + MATCH_ROUNDS;
  txt(phaseName, cx, y + 40, 11, S.phase === 'buy' ? PAL.gold : PAL.dim, 'center');
  ctx.fillStyle = 'rgba(30,227,207,0.92)'; ctx.fillRect(cx - 124, y, 60, 48);
  txt(String(myScore), cx - 94, y + 25, 30, '#062a27', 'center');
  ctx.fillStyle = 'rgba(255,70,85,0.92)'; ctx.fillRect(cx + 64, y, 60, 48);
  txt(String(enScore), cx + 94, y + 25, 30, '#2a0509', 'center');
  txt(sideOf(mt) === 'atk' ? 'SALDIRAN' : 'SAVUNAN', cx - 94, y + 58, 10, PAL.teal, 'center');
  txt(sideOf(et) === 'atk' ? 'SALDIRAN' : 'SAVUNAN', cx + 94, y + 58, 10, PAL.red, 'center');
  const drawIcons = (team, dir) => {
    const ps = S.players.filter(p => p.team === team);
    ps.forEach((p, i) => {
      const x = dir < 0 ? cx - 148 - i * 36 : cx + 148 + i * 36, yy = y + 24;
      const ag = AGENTS[p.agent];
      ctx.save(); ctx.globalAlpha = p.alive ? 1 : 0.35;
      circle(x, yy, 15, p.alive ? ag.color : '#3a4450', team === mt ? PAL.teal : PAL.red, 2);
      txt(ag.icon, x, yy + 1, 13, '#0b1016', 'center');
      ctx.restore();
      if (!p.alive) { ctx.strokeStyle = PAL.red; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 9, yy - 9); ctx.lineTo(x + 9, yy + 9); ctx.stroke(); }
      if (team === mt && p.alive) { ctx.fillStyle = PAL.teal; ctx.fillRect(x - 13, yy + 19, 26 * p.hp / 100, 3); }
      if (p.ult >= AGENTS[p.agent].x.pts && (team === mt)) circle(x + 11, yy - 11, 4, PAL.gold);
    });
  };
  if (!(IS_TOUCH && W < 1150)) { drawIcons(mt, -1); drawIcons(et, 1); }
  else { const al = (tm) => S.players.filter(p => p.team === tm && p.alive).length; txt(al(mt) + ' CANLI', cx - 150, y + 24, 12, PAL.teal, 'center'); txt(al(et) + ' CANLI', cx + 150, y + 24, 12, PAL.red, 'center'); }
  // ulti duyuruları
  let uy = y + 78;
  for (let i = UIS.ultFeed.length - 1; i >= 0; i--) {
    const u = UIS.ultFeed[i]; u.t -= 1 / 60;
    if (u.t <= 0) { UIS.ultFeed.splice(i, 1); continue; }
    ctx.save(); ctx.globalAlpha = Math.min(1, u.t);
    txt('⚡ ' + u.text, cx, uy, 13, u.ally ? PAL.teal : PAL.red, 'center'); ctx.restore(); uy += 18;
  }
}
/* Büyük haritalarda mini harita oyuncuyu merkeze alan yakın bir görünüm gösterir (TAB: tüm harita) */
function miniDims() { const mw = IS_TOUCH ? Math.min(170, W * 0.2) : Math.min(250, W * 0.2); return { mw, mh: Math.round(mw * 0.78) }; }
function drawMinimap(me, v) {
  const { mw, mh } = miniDims(), x0 = 14, y0 = IS_TOUCH ? 48 : 14;
  const full = !!UI.board; // TAB basılıyken tüm harita
  const vw = full ? WW : Math.min(WW, 10000), vh = full ? WH : vw * mh / mw;
  const s = full ? Math.min(mw / WW, mh / WH) : mw / vw;
  const fc = (v && v.alive) ? v : me;
  let ox = full ? 0 : clamp((fc ? fc.x : WW / 2) - vw / 2, 0, Math.max(0, WW - vw)), oy = full ? 0 : clamp((fc ? fc.y : WH / 2) - vh / 2, 0, Math.max(0, WH - vh));
  const ex = full ? (mw - WW * s) / 2 : 0, ey = full ? (mh - WH * s) / 2 : 0;
  panel(x0 - 4, y0 - 4, mw + 8, mh + 8, 0.85);
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, mw, mh); ctx.clip();
  if (me && me.st.shroud > 0) {
    for (let i = 0; i < 60; i++) { ctx.fillStyle = 'rgba(80,90,110,' + Math.random() * 0.4 + ')'; ctx.fillRect(x0 + Math.random() * mw, y0 + Math.random() * mh, 6, 2); }
    txt('KARANLIK ÖRTÜ', x0 + mw / 2, y0 + mh / 2, 13, PAL.dim, 'center'); ctx.restore(); return;
  }
  const k = miniCv.width / WW;
  ctx.imageSmoothingEnabled = false;
  if (full) ctx.drawImage(miniCv, x0 + ex, y0 + ey, WW * s, WH * s);
  else ctx.drawImage(miniCv, ox * k, oy * k, vw * k, vh * k, x0, y0, mw, mh);
  ctx.imageSmoothingEnabled = true;
  const P = (x, y) => [x0 + ex + (x - ox) * s, y0 + ey + (y - oy) * s];
  ctx.fillStyle = '#6e5b41';
  for (const w of S.twalls) for (const i of w.tiles) { const [px, py] = P((i % MW) * TILE, ((i / MW) | 0) * TILE); ctx.fillRect(px, py, TILE * s, TILE * s); }
  for (const a of S.areas) {
    if (a.type === 'smoke') { const [px, py] = P(a.x, a.y); circle(px, py, a.r * s, 'rgba(110,116,170,0.85)'); }
    else if (a.type === 'nightmare' || a.type === 'tcollapse') { const [px, py] = P(a.x, a.y); circle(px, py, a.r * s, null, a.type === 'nightmare' ? 'rgba(180,108,255,0.7)' : 'rgba(62,193,255,0.7)', 1.5); }
  }
  if (me && v && v.alive) {
    const vp = visionOf(v), [px, py] = P(v.x, v.y), a0 = (v === me ? LOOK.yaw : v.ang);
    ctx.fillStyle = 'rgba(236,232,225,0.1)'; ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, Math.min(vp.far, 650) * s, a0 - vp.fov / 2, a0 + vp.fov / 2); ctx.closePath(); ctx.fill();
  }
  for (let i = UIS.pings.length - 1; i >= 0; i--) {
    const pg = UIS.pings[i]; pg.t -= 1 / 60;
    if (pg.t <= 0) { UIS.pings.splice(i, 1); continue; }
    const [px, py] = P(pg.x, pg.y); circle(px, py, 3 + (1.3 - pg.t) * 6, null, 'rgba(255,70,85,' + pg.t / 1.3 + ')', 1.5);
  }
  if (arOn()) arDrawMinimap(P, s, me);
  const mt = me ? me.team : 0;
  for (const p of S.players) {
    if (!p.alive) continue;
    const [px, py] = P(p.x, p.y);
    if (p.team === mt) {
      circle(px, py, p.id === G.myId ? 4.5 : 3.5, p.id === G.myId ? '#fff' : PAL.teal);
      ctx.strokeStyle = p.id === G.myId ? '#fff' : PAL.teal; ctx.lineWidth = 1.5; ctx.beginPath(); const pa = p.id === G.myId && p.alive ? LOOK.yaw : p.ang; ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(pa) * 8, py + Math.sin(pa) * 8); ctx.stroke();
    } else if (UIS.teamSeen.has(p.id)) circle(px, py, 3.5, PAL.red);
  }
  const sp = S.bomb;
  if (sp.state === 'planted' || (sp.state === 'dropped' && me && sideOf(me.team) === 'atk')) { const [px, py] = P(sp.x, sp.y); drawBombIcon(px, py, 5, S.time * 3 % 1 < 0.5); }
  // reboot istasyonları ve takım kartları
  (MAPDATA.reboot || []).forEach((r, i) => {
    const [px, py] = P(r.x, r.y), cd = S.rb[i] && S.rb[i].cd > 0;
    ctx.fillStyle = cd ? 'rgba(255,70,85,0.9)' : 'rgba(80,190,255,0.95)'; ctx.fillRect(px - 4, py - 4, 8, 8);
    ctx.fillStyle = '#0b121a'; ctx.fillRect(px - 2, py - 2, 4, 4);
  });
  for (const c of S.cards || []) if (c.team === mt && !c.carrier) { const [px, py] = P(c.x, c.y); ctx.fillStyle = PAL.teal; ctx.fillRect(px - 2.5, py - 3.5, 5, 7); }
  for (const h of S.heal || []) { const [px, py] = P(h.x, h.y), on = !(h.cd > 0); ctx.fillStyle = on ? PAL.green : 'rgba(60,240,122,0.3)'; ctx.fillRect(px - 4, py - 1.5, 8, 3); ctx.fillRect(px - 1.5, py - 4, 3, 8); }
  // bölge yönleri (görünüm dışındaysa kenarda ok)
  if (!full) for (const sn of ['A', 'B']) {
    const c = tc(...MAPDATA.sites[sn].center); let [px, py] = P(c.x, c.y);
    if (px < x0 || px > x0 + mw || py < y0 || py > y0 + mh) {
      px = clamp(px, x0 + 9, x0 + mw - 9); py = clamp(py, y0 + 9, y0 + mh - 9);
      circle(px, py, 8, 'rgba(15,25,35,0.9)', 'rgba(245,196,81,0.9)', 1.5); txt(sn, px, py + 4, 11, PAL.gold, 'center');
    }
  }
  ctx.restore();
}
function drawFeed(dt) {
  let y = IS_TOUCH ? 50 : 16;
  for (let i = UIS.feed.length - 1; i >= 0; i--) { UIS.feed[i].t -= dt; if (UIS.feed[i].t <= 0) UIS.feed.splice(i, 1); }
  const mt = myTeam();
  for (const f of UIS.feed) {
    const a = S.pmap[f.a], v = S.pmap[f.v];
    const an = a ? a.name : '', vn = v ? v.name : '?';
    const wn = WEAPONS[f.w] ? WEAPONS[f.w].name : (SRC_NAMES[f.w] || f.w);
    ctx.font = 'bold 13px ' + FONT;
    const mid = '  [' + wn + (f.hs ? ' ✦' : '') + ']  ';
    const w1 = ctx.measureText(an).width, w2 = ctx.measureText(tl(mid)).width, w3 = ctx.measureText(vn).width, tw = w1 + w2 + w3 + 20;
    const x = W - 14 - tw;
    ctx.save(); ctx.globalAlpha = Math.min(1, f.t);
    const mine = f.a === G.myId || f.v === G.myId;
    panel(x, y, tw, 24, mine ? 0.95 : 0.75);
    if (mine) { ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, tw - 1, 23); }
    txt(an, x + 10, y + 12, 13, a && a.team === mt ? PAL.teal : PAL.red);
    txt(mid, x + 10 + w1, y + 12, 13, f.hs ? PAL.gold : PAL.white);
    txt(vn, x + 10 + w1 + w2, y + 12, 13, v && v.team === mt ? PAL.teal : PAL.red);
    ctx.restore();
    y += 28;
  }
}
function abilityBox(x, y, w, h, key, name, charges, max, ready, ult, pts, col) {
  panel(x, y, w, h, 0.85);
  ctx.strokeStyle = ready ? col : 'rgba(139,151,143,0.35)'; ctx.lineWidth = ready ? 2 : 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (ult && ready) { ctx.fillStyle = 'rgba(245,196,81,' + (0.12 + 0.08 * Math.sin(S.time * 5)) + ')'; ctx.fillRect(x, y, w, h); }
  txt(key, x + 7, y + 10, 12, ready ? col : PAL.dim);
  const words = name.toLocaleUpperCase('tr-TR').split(' ');
  ctx.font = 'bold 10px ' + FONT;
  txt(words[0] || '', x + w / 2, y + h / 2 - (words.length > 1 ? 4 : 0), 10, ready ? PAL.white : PAL.dim, 'center');
  if (words.length > 1) txt(words.slice(1).join(' '), x + w / 2, y + h / 2 + 8, 10, ready ? PAL.white : PAL.dim, 'center');
  if (ult) {
    for (let i = 0; i < pts; i++) { const px = x + w / 2 - (pts - 1) * 4.5 + i * 9; circle(px, y + h - 8, 3, i < charges ? PAL.gold : 'rgba(139,151,143,0.35)'); }
  } else for (let i = 0; i < max; i++) { const px = x + w / 2 - (max - 1) * 5 + i * 10; ctx.fillStyle = i < charges ? col : 'rgba(139,151,143,0.35)'; ctx.fillRect(px - 3, y + h - 10, 6, 5); }
}
function drawBottom(me) {
  const ag = AGENTS[me.agent], by = H - 78;
  // can / zırh
  panel(18, by, 210, 62);
  txt(String(Math.ceil(me.hp)), 30, by + 30, 42, me.hp < 35 ? PAL.red : PAL.white);
  txt('CAN', 30, by + 54, 10, PAL.dim);
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(110, by + 14, 104, 6);
  ctx.fillStyle = me.hp < 35 ? PAL.red : PAL.white; ctx.fillRect(110, by + 14, 104 * me.hp / 100, 6);
  ctx.fillStyle = 'rgba(159,216,255,0.2)'; ctx.fillRect(110, by + 28, 104, 6);
  ctx.fillStyle = '#9fd8ff'; ctx.fillRect(110, by + 28, 104 * me.armor / 50, 6);
  txt('⛨ ' + Math.ceil(me.armor), 110, by + 48, 16, '#9fd8ff');
  if (me.kit) txt('✂ KİT', 158, by + 48, 12, PAL.green);
  txt(ag.name, 214, by + 48, 12, ag.color, 'right');
  // yetenekler
  const bw = 78, bh = 56, gap = 8, x0 = W / 2 - (bw * 3 + gap * 2) / 2;
  abilityBox(x0, by + 4, bw, bh, 'Q', ag.q.name, me.ch.q, ag.q.max, me.ch.q > 0, false, 0, ag.color);
  abilityBox(x0 + bw + gap, by + 4, bw, bh, 'E', ag.e.name, me.ch.e, ag.e.max, me.ch.e > 0, false, 0, ag.color);
  abilityBox(x0 + (bw + gap) * 2, by + 4, bw, bh, 'X', ag.x.name, me.ult, 0, me.ult >= ag.x.pts, true, ag.x.pts, PAL.gold);
  // durum çipleri
  const chips = [];
  const st = me.st;
  if (st.blind > 0) chips.push(['KÖR', st.blind]); if (st.deaf > 0) chips.push(['SAĞIR', st.deaf]); if (st.lock > 0) chips.push(['KİLİTLİ', st.lock]);
  if (st.concuss > 0) chips.push(['SARSILMIŞ', st.concuss]); if (st.knock > 0) chips.push(['HAVADA', st.knock]); if (st.near > 0) chips.push(['YAKIN GÖRÜŞ', st.near]);
  if (st.shroud > 0) chips.push(['KARANLIK', st.shroud]); if (st.reveal > 0) chips.push(['AÇIĞA ÇIKTIN', st.reveal]); if (me.zoneSlow < 1 || st.slow > 0) chips.push(['YAVAŞ', st.slow || 0]);
  if (st.invis > 0) chips.push(['GÖRÜNMEZ', st.invis]); if (st.clone > 0) chips.push(['KÜL KLONU', st.clone]); if (st.ovl > 0) chips.push(['AŞIRI YÜK', st.ovl]); if (st.boost > 0) chips.push(['HIZ', st.boost]);
  let cxp = W / 2 - chips.length * 50;
  for (const c of chips) {
    panel(cxp, by - 26, 96, 20, 0.85);
    txt(c[0] + (c[1] ? ' ' + c[1].toFixed(1) : ''), cxp + 48, by - 16, 11, PAL.gold, 'center'); cxp += 100;
  }
  // silah
  const wid = curW(me), w = WEAPONS[wid], am = me.ammo[wid] || { mag: 0, res: 0 };
  panel(W - 238, by, 220, 62);
  txt(w.name.toUpperCase(), W - 30, by + 14, 13, PAL.dim, 'right');
  if (me.st.ovl > 0) txt('⚡ IŞIN', W - 30, by + 38, 30, '#f7f35a', 'right');
  else if (w.melee) txt('⚔ HIZLI KOŞU', W - 30, by + 38, 20, PAL.teal, 'right');
  else if (me.reloadT > 0) txt('ŞARJÖR...', W - 30, by + 38, 22, PAL.gold, 'right');
  else { txt(String(am.mag), W - 92, by + 38, 34, am.mag <= Math.ceil(w.mag * 0.25) ? PAL.red : PAL.white, 'right'); txt('/ ' + am.res, W - 30, by + 42, 16, PAL.dim, 'right'); }
  txt('¤ ' + me.credits, W - 226, by + 14, 14, PAL.gold);
  txt((me.primary ? '1 ' + WEAPONS[me.primary].name + '  ' : '') + (me.secondary ? '2 ' + WEAPONS[me.secondary].name + '  ' : '') + '3 Kılıç', W - 226, by + 52, 11, PAL.dim);
}
function drawDeathPanel(me, v) {
  const killer = S.pmap[UIS.deathBy];
  panel(W / 2 - 180, H - 96, 360, 70, 0.9);
  txt('ÖLDÜN' + (killer ? ' — ' + killer.name + ' (' + AGENTS[killer.agent].name + ')' : ''), W / 2, H - 76, 16, PAL.red, 'center');
  const rsp = me.respawnAt || me.rsp;
  if (arOn() && rsp && S.phase === 'live') txt('YENİDEN DOĞUŞ: ' + Math.max(0, Math.ceil(rsp - S.time)) + ' sn', W / 2, H - 50, 14, PAL.gold, 'center');
  else if (v && v !== me) txt((v.team !== me.team ? 'İZLENİYOR (RAKİP): ' : 'İZLENİYOR: ') + v.name + '   [BOŞLUK] değiştir', W / 2, H - 50, 12, v.team !== me.team ? PAL.red : PAL.white, 'center');
  else txt('Takımında hayatta kimse kalmadı', W / 2, H - 50, 12, PAL.dim, 'center');
  const myCard = (S.cards || []).find(c => c.owner === me.id);
  if (myCard && (S.phase === 'live' || S.phase === 'planted')) {
    const cr = myCard.carrier ? S.pmap[myCard.carrier] : null;
    const t = cr ? 'KARTIN ' + cr.name.toLocaleUpperCase('tr-TR') + ' OYUNCUSUNDA — REBOOT İSTASYONUNA GÖTÜRÜYOR' : 'KARTIN YERDE — BİR TAKIM ARKADAŞI ALIP REBOOT ETMELİ';
    ctx.font = 'bold 12px ' + FONT; const tw = ctx.measureText(tl(t)).width + 26;
    panel(W / 2 - tw / 2, H - 124, tw, 22, 0.85); txt(t, W / 2, H - 113, 12, PAL.teal, 'center');
  }
}
function drawHints(me) {
  let h = null;
  const sp = S.bomb;
  if (S.phase === 'buy' && me.alive) h = arOn() ? 'HAZIRLAN · ' + Math.ceil(S.phaseT) + ' sn' : '[B] MAĞAZA · ' + Math.ceil(S.phaseT) + ' sn';
  else if (me.alive && me.hasBomb && S.phase === 'live') h = siteAt(me.x, me.y) ? '[F] BASILI TUT: BOMBA KUR' : 'BOMBA SENDE — A/B bölgesine götür · [G] bırak';
  else if (me.alive && S.phase === 'planted' && sideOf(me.team) === 'def' && dist(me.x, me.y, sp.x, sp.y) < 58) h = '[F] BASILI TUT: BOMBA İMHA ET' + (me.kit ? ' · KİT: 1 SN' : '');
  const myCards = me.alive ? (S.cards || []).filter(c => c.carrier === me.id) : [];
  if (myCards.length && (S.phase === 'live' || S.phase === 'planted')) {
    let near = -1; (MAPDATA.reboot || []).forEach((r, i) => { if (dist(me.x, me.y, r.x, r.y) < REBOOT_R) near = i; });
    const names = myCards.map(c => (S.pmap[c.owner] || {}).name || '?').join(', ');
    if (near >= 0) h = S.rb[near] && S.rb[near].cd > 0 ? 'REBOOT İSTASYONU SOĞUYOR · ' + Math.ceil(S.rb[near].cd) + ' sn' : '[F] BASILI TUT: ' + names.toLocaleUpperCase('tr-TR') + ' — REBOOT';
    else if (!h) h = '🂠 KART: ' + names + ' — A veya B\'deki REBOOT istasyonuna götür';
  }
  if (!h && me.alive && sideOf(me.team) === 'atk' && !me.hasBomb && sp.state === 'carried' && (S.phase === 'live' || S.phase === 'buy')) {
    const c = S.pmap[sp.carrier]; if (c && c.team === me.team && !IS_TOUCH && S.phase !== 'buy') h = 'BOMBA: ' + c.name + ' · [T] İSTE';
  }
  if (h) { ctx.font = 'bold 14px ' + FONT; const tw = ctx.measureText(tl(h)).width + 30; panel(W / 2 - tw / 2, H - 140, tw, 26, 0.8); txt(h, W / 2, H - 127, 14, PAL.gold, 'center'); }
  const prog = me.plantT > 0 ? [me.plantT / PLANT_TIME, 'BOMBA KURULUYOR'] : me.defT > 0 ? [me.defT / DEFUSE_TIME, 'BOMBA İMHA EDİLİYOR'] : me.rbT > 0 ? [me.rbT / REBOOT_TIME, 'REBOOT EDİLİYOR'] : null;
  if (prog) {
    const w = 320, x = W / 2 - w / 2, y = H / 2 + 70;
    panel(x - 4, y - 22, w + 8, 40, 0.88);
    txt(prog[1], W / 2, y - 10, 12, PAL.gold, 'center');
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x, y, w, 8);
    ctx.fillStyle = PAL.gold; ctx.fillRect(x, y, w * clamp(prog[0], 0, 1), 8);
    if (me.defT > 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x + w / 2 - 1, y - 3, 2, 14); }
  }
}
function drawCenterMsgs(dt) {
  if (UIS.banner) {
    const b = UIS.banner; b.t -= dt;
    if (b.t <= 0) UIS.banner = null;
    else {
      const a = Math.min(1, b.t / 0.4, (b.dur - b.t) / 0.2 + 0.2);
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(15,25,35,0.78)'; ctx.fillRect(0, H * 0.24, W, 92);
      ctx.fillStyle = b.col; ctx.fillRect(0, H * 0.24, W, 3); ctx.fillRect(0, H * 0.24 + 89, W, 3);
      txt(b.big, W / 2, H * 0.24 + 38, 40, b.col, 'center');
      txt(b.small, W / 2, H * 0.24 + 72, 15, PAL.white, 'center', 'normal');
      ctx.restore();
    }
  }
  let y = IS_TOUCH ? 128 : 96; // dokunmatikte üst panel aşağıda olduğundan mesajlar da aşağıda
  for (let i = UIS.msgs.length - 1; i >= 0; i--) { UIS.msgs[i].t -= dt; if (UIS.msgs[i].t <= 0) UIS.msgs.splice(i, 1); }
  for (const m of UIS.msgs) {
    ctx.save(); ctx.globalAlpha = Math.min(1, m.t);
    ctx.font = 'bold 13px ' + FONT; const tw = ctx.measureText(tl(m.text)).width + 28;
    panel(W / 2 - tw / 2, y, tw, 24, 0.8); txt(m.text, W / 2, y + 12, 13, m.col, 'center');
    ctx.restore(); y += 28;
  }
}

function drawHUD(dt, me, v) {
  if (PKMAP && pkOn()) { drawPkHUD(dt, me, v); return; }
  drawScreenFX(dt, me, v);
  drawWorldMarkers(dt, me, v);
  drawTopBar(me);
  drawMinimap(me, v);
  drawFeed(dt);
  if (me) {
    if (me.alive) { if (IS_TOUCH) drawMobileStats(me); else drawBottom(me); }
    else drawDeathPanel(me, v);
    drawHints(me);
  }
  drawCenterMsgs(dt);
  drawFFMsg(dt);
  drawVoiceList(me);
  drawChat(dt, me);
  drawEmotes(dt, me, v);
  drawCrosshair(me, v);
  if (UI.board) drawScoreboard(me);
  if (G.mode === 'client') txt('PING ' + NET.ping + 'ms', W - 14, H - 12, 12, PAL.dim, 'right', 'normal');
}
/* EMOTE baloncukları: oyuncunun başının üstünde emoji; kendi emote'un ekranın üstünde */
function drawEmotes(dt, me, v) {
  for (const p of S.players) {
    const em = p._emo; if (!em || em.t <= 0) continue;
    em.t -= dt; if (em.t <= 0 || !p.alive) { p._emo = null; continue; }
    const age = EMOTE_TIME - em.t, pop = Math.min(1, age / 0.18), fade = Math.min(1, em.t / 0.4), sym = EMOTES[em.e].e;
    if (p === v && v.alive) {   // birinci şahıs: kendi emote'un
      ctx.save(); ctx.globalAlpha = fade; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const s = 44 * (0.6 + 0.4 * pop); ctx.font = s + 'px sans-serif'; ctx.fillText(sym, W / 2, H * 0.24);
      ctx.font = 'bold 13px ' + FONT; ctx.fillStyle = PAL.white; ctx.fillText(tl(EMOTES[em.e].n), W / 2, H * 0.24 + 34); ctx.restore();
      continue;
    }
    const ally = me && p.team === me.team;
    if (!ally && !UIS.teamSeen.has(p.id) && !(v && losClear(v.x, v.y, p.x, p.y))) continue;
    const sc = worldToScreen(p.x, P_TOP + 40 + age * 6, p.y); if (!sc) continue;
    const d = dist(v.x, v.y, p.x, p.y), k = clamp(1.25 - d / 1800, 0.55, 1.15) * (0.5 + 0.5 * pop), r = 22 * k;
    ctx.save(); ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(15,25,35,0.85)'; ctx.beginPath(); ctx.arc(sc[0], sc[1], r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ally ? PAL.teal : PAL.red; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = Math.round(24 * k) + 'px sans-serif'; ctx.fillText(sym, sc[0], sc[1] + 1);
    ctx.restore();
  }
}
/* Mikrofon simgesi (vektör, her cihazda aynı görünür) */
function drawMic(x, y, col, talking) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1.7;
  ctx.beginPath(); ctx.arc(x, y - 4, 3.2, Math.PI, 0); ctx.lineTo(x + 3.2, y + 1); ctx.arc(x, y + 1, 3.2, 0, Math.PI); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, 6, 0.1, Math.PI - 0.1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 9); ctx.moveTo(x - 3.5, y + 9); ctx.lineTo(x + 3.5, y + 9); ctx.stroke();
  if (talking) { const k = 0.5 + 0.5 * Math.sin(performance.now() / 120); ctx.globalAlpha = 0.35 + 0.5 * k; ctx.beginPath(); ctx.arc(x, y - 1, 10, -0.7, 0.7); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y - 1, 10, Math.PI - 0.7, Math.PI + 0.7); ctx.stroke(); }
  ctx.restore();
}
/* Solda: sesli sohbette konuşanlar (isminin yanında mikrofon) */
function drawVoiceList(me) {
  if (typeof VC === 'undefined') return;
  const sp = VC.speakers(); if (!sp.length) return;
  const { mh } = miniDims(); let y = IS_TOUCH ? 48 + mh + 96 : 14 + mh + 14; const x = 14;
  for (const p of sp.slice(0, 8)) {
    const self = p.id === G.myId, ally = me && p.team === me.team, col = self ? PAL.white : ally ? PAL.teal : PAL.red;
    const name = self ? 'SEN' + (VC.open ? ' · MİKROFON AÇIK' : '') : p.name.replace(' (BOT)', '');
    ctx.font = 'bold 13px ' + FONT; const w = ctx.measureText(tl(name)).width + 46;
    panel(x, y, w, 26, 0.8); ctx.fillStyle = col; ctx.fillRect(x, y, 3, 26);
    drawMic(x + 17, y + 13, col, true); txt(name, x + 32, y + 13, 13, col);
    y += 30;
  }
}
/* Solda altta: yazılı sohbet */
function wrapText(s, maxW) {
  const words = String(s).split(' '), out = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur); return out.slice(0, 4);
}
function drawChat(dt, me) {
  const all = UIS.chat; if (!CHAT.open) for (const c of all) c.t -= dt;
  const shown = CHAT.open ? all.slice(-10) : all.filter(c => c.t > 0).slice(-6);
  if (!shown.length) return;
  const x = 18, maxW = Math.min(520, W * 0.42); let y = H - (IS_TOUCH ? 214 : 124);
  ctx.save();
  for (let i = shown.length - 1; i >= 0 && y > 240; i--) {
    const c = shown[i], a = CHAT.open ? 1 : Math.min(1, c.t / 1.5);
    const self = c.id === G.myId, ally = me && c.tm === me.team, col = self ? PAL.gold : ally ? PAL.teal : PAL.red;
    const name = c.n + ': ';
    ctx.font = 'bold 14px ' + FONT; const nw = ctx.measureText(name).width;
    ctx.font = 'normal 14px ' + FONT; const lines = wrapText(c.m, maxW - nw);
    const bh = lines.length * 19 + 6; y -= bh + 3;
    ctx.globalAlpha = a * 0.62; ctx.fillStyle = '#0b121a';
    let bw = 0; lines.forEach((l, k) => { bw = Math.max(bw, (k ? 0 : nw) + ctx.measureText(l).width); }); ctx.fillRect(x - 6, y, bw + 14, bh);
    ctx.globalAlpha = a;
    ctx.font = 'bold 14px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(name, x, y + 12);
    ctx.font = 'normal 14px ' + FONT; ctx.fillStyle = PAL.white;
    lines.forEach((l, k) => ctx.fillText(l, x + (k ? 0 : nw), y + 12 + k * 19));
  }
  ctx.restore();
}
/* Takım ateşi uyarısı (ekranın altında) */
function drawFFMsg(dt) {
  const f = UIS.ff; if (!f) return;
  f.t -= dt; if (f.t <= 0) { UIS.ff = null; return; }
  ctx.save(); ctx.globalAlpha = Math.min(1, f.t * 2);
  ctx.font = 'bold 17px ' + FONT; const tw = ctx.measureText(tl('⚠ ' + f.text)).width + 30, y = H - (IS_TOUCH ? 150 : 176);
  ctx.fillStyle = 'rgba(40,6,12,0.88)'; ctx.fillRect(W / 2 - tw / 2, y, tw, 34);
  ctx.fillStyle = f.col; ctx.fillRect(W / 2 - tw / 2, y, 4, 34); ctx.fillRect(W / 2 + tw / 2 - 4, y, 4, 34);
  txt('⚠ ' + f.text, W / 2, y + 17, 17, f.col, 'center');
  ctx.restore();
}
function drawMobileStats(me) {
  const { mw, mh } = miniDims(), y = 48 + mh + 10, x = 10, w = mw + 8;
  const wid = curW(me), wpn = WEAPONS[wid], am = me.ammo[wid] || { mag: 0, res: 0 };
  panel(x, y, w, 64, 0.82);
  txt(String(Math.ceil(me.hp)), x + 8, y + 18, 24, me.hp < 35 ? PAL.red : PAL.white);
  txt('⛨' + Math.ceil(me.armor), x + 56, y + 18, 14, '#9fd8ff');
  txt('¤' + me.credits, x + w - 6, y + 18, 13, PAL.gold, 'right');
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x + 8, y + 32, w - 16, 4);
  ctx.fillStyle = me.hp < 35 ? PAL.red : PAL.white; ctx.fillRect(x + 8, y + 32, (w - 16) * me.hp / 100, 4);
  const ammoTxt = me.st.ovl > 0 ? '⚡ IŞIN' : wpn.melee ? '⚔' : me.reloadT > 0 ? 'ŞARJÖR...' : am.mag + ' / ' + am.res;
  txt(wpn.name.toUpperCase(), x + 8, y + 50, 11, PAL.dim);
  txt(ammoTxt, x + w - 6, y + 50, 15, !wpn.melee && am.mag <= Math.ceil(wpn.mag * 0.25) ? PAL.red : PAL.white, 'right');
  const st = me.st, chips = [];
  if (st.blind > 0) chips.push('KÖR'); if (st.deaf > 0) chips.push('SAĞIR'); if (st.lock > 0) chips.push('KİLİTLİ'); if (st.concuss > 0) chips.push('SARSILMIŞ');
  if (st.near > 0) chips.push('YAKIN GÖRÜŞ'); if (st.shroud > 0) chips.push('KARANLIK'); if (st.reveal > 0) chips.push('AÇIĞA ÇIKTIN'); if (st.invis > 0) chips.push('GÖRÜNMEZ');
  if (st.clone > 0) chips.push('KÜL'); if (st.ovl > 0) chips.push('AŞIRI YÜK'); if (me.zoneSlow < 1 || st.slow > 0) chips.push('YAVAŞ');
  if (chips.length) txt(chips.join(' · '), x, y + 78, 11, PAL.gold);
}
/* Dünya işaretleri: takım arkadaşı isimleri, bomba konumu, hasar sayıları */
function drawWorldMarkers(dt, me, v) {
  if (!GLX.ok) return;
  const mt = me ? me.team : 0;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  for (const p of S.players) {
    if (!p.alive || p === v || p.team !== mt) continue;
    const s = worldToScreen(p.x, P_TOP + 14, p.y); if (!s) continue;
    const d = dist(v.x, v.y, p.x, p.y), sc = clamp(1.3 - d / 1600, 0.65, 1.1);
    ctx.font = 'bold ' + Math.round(12 * sc) + 'px ' + FONT;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(p.name, s[0] + 1, s[1] + 1);
    ctx.fillStyle = PAL.teal; ctx.fillText(p.name, s[0], s[1]);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(s[0] - 16 * sc, s[1] + 4, 32 * sc, 4);
    ctx.fillStyle = PAL.teal; ctx.fillRect(s[0] - 16 * sc, s[1] + 4, 32 * sc * p.hp / 100, 4);
    if (p.hasBomb) drawBombIcon(s[0] + 26 * sc, s[1] - 4, 6, true);
  }
  for (const p of S.players) {
    if (!p.alive || p.team === mt || !(p.st.reveal > 0) || (v.alive && visibleFPS(v, p))) continue;
    const s = worldToScreen(p.x, P_TOP + 12, p.y); if (!s) continue;
    ctx.fillStyle = 'rgba(255,70,85,' + (0.6 + 0.3 * Math.sin(S.time * 10)) + ')';
    ctx.beginPath(); ctx.moveTo(s[0], s[1] + 8); ctx.lineTo(s[0] - 7, s[1] - 4); ctx.lineTo(s[0] + 7, s[1] - 4); ctx.closePath(); ctx.fill();
  }
  const sp = S.bomb;
  if (sp.state === 'planted' || (sp.state === 'dropped' && me && sideOf(me.team) === 'atk')) {
    const s = worldToScreen(sp.x, 40, sp.y);
    if (s) {
      const blink = sp.state === 'planted' ? (S.time * (sp.t < 10 ? 4 : 1.5)) % 1 < 0.5 : true;
      drawBombIcon(s[0], s[1], 10, blink);
      txt(Math.round(dist(v.x, v.y, sp.x, sp.y) / 40) + 'm', s[0], s[1] + 22, 11, PAL.red, 'center');
    }
  }
  // reboot kartları (takımın) ve istasyonlar
  for (const c of S.cards || []) {
    if (c.carrier || c.team !== mt) continue;
    const s = worldToScreen(c.x, 52, c.y); if (!s) continue;
    const o = S.pmap[c.owner];
    txt('🂠 ' + (o ? o.name : 'KART'), s[0], s[1], 12, PAL.teal, 'center');
    txt(Math.round(dist(v.x, v.y, c.x, c.y) / 40) + 'm', s[0], s[1] + 14, 10, PAL.dim, 'center');
  }
  if ((S.cards || []).some(c => c.carrier === (me && me.id))) {
    (MAPDATA.reboot || []).forEach((r, i) => {
      const s = worldToScreen(r.x, 130, r.y); if (!s) return;
      const cd = S.rb[i] && S.rb[i].cd > 0;
      txt('⟳ REBOOT ' + r.site + (cd ? ' · ' + Math.ceil(S.rb[i].cd) + 's' : ''), s[0], s[1], 13, cd ? PAL.red : '#7fd4ff', 'center');
      txt(Math.round(dist(v.x, v.y, r.x, r.y) / 40) + 'm', s[0], s[1] + 15, 10, PAL.dim, 'center');
    });
  }
  for (let i = UIS.dmgNums.length - 1; i >= 0; i--) {
    const d = UIS.dmgNums[i]; d.t -= dt;
    if (d.t <= 0) { UIS.dmgNums.splice(i, 1); continue; }
    const s = worldToScreen(d.x, 80 + (0.8 - d.t) * 30, d.y); if (!s) continue;
    ctx.save(); ctx.globalAlpha = Math.min(1, d.t * 1.5);
    txt(d.txt, s[0] + d.ox + 1, s[1] + 1, 16, '#000', 'center'); txt(d.txt, s[0] + d.ox, s[1], 16, d.c, 'center');
    ctx.restore();
  }
}
function drawScreenFX(dt, me, v) {
  if (v && v.alive) {
    for (const a of S.areas) {
      if (a.type === 'smoke' && inR(v, a.x, a.y, a.r * smokeScale(a) - 4)) { ctx.fillStyle = 'rgba(88,92,135,0.93)'; ctx.fillRect(0, 0, W, H); }
    }
  }
  if (me && me.alive) {
    for (const a of S.areas) {
      if (a.team === me.team || !inR(me, a.x, a.y, a.r)) continue;
      if (a.type === 'nightmare') { ctx.fillStyle = 'rgba(90,20,140,0.18)'; ctx.fillRect(0, 0, W, H); }
      if (a.type === 'tcollapse') { ctx.fillStyle = 'rgba(40,140,220,0.14)'; ctx.fillRect(0, 0, W, H); }
      if (a.type === 'poison') { ctx.fillStyle = 'rgba(90,200,80,0.1)'; ctx.fillRect(0, 0, W, H); }
      if (a.type === 'firewall') { ctx.fillStyle = 'rgba(255,120,40,0.12)'; ctx.fillRect(0, 0, W, H); }
    }
    if (me.st.shroud > 0) vignette('0,0,0', 0.9, 0.15);
    if (me.st.near > 0) vignette('10,12,20', 0.92, 0.1);
    if (me.st.lock > 0) { ctx.fillStyle = 'rgba(255,209,102,0.1)'; ctx.fillRect(0, 0, W, H); }
    if (me.hp < 35) vignette('255,40,60', 0.35 + 0.15 * Math.sin(S.time * 6), 0.35);
    if (me.st.blind > 0) { ctx.fillStyle = 'rgba(255,255,250,' + clamp(me.st.blind / 0.9, 0, 1) * 0.97 + ')'; ctx.fillRect(0, 0, W, H); }
    if (me.st.deaf > 0) { ctx.strokeStyle = 'rgba(154,167,199,0.35)'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, W - 10, H - 10); }
  }
  if (UIS.shroudFlash > 0) { UIS.shroudFlash -= dt; ctx.fillStyle = 'rgba(0,0,0,' + clamp(UIS.shroudFlash, 0, 0.8) + ')'; ctx.fillRect(0, 0, W, H); }
  if (UIS.dmgFlash > 0) { UIS.dmgFlash -= dt; vignette('255,40,60', UIS.dmgFlash, 0.4); }
  if (UIS.healFlash > 0) { UIS.healFlash -= dt; vignette('60,240,122', UIS.healFlash, 0.4); }
  if (UIS.nukeFlash > 0) { UIS.nukeFlash -= dt * 0.8; ctx.fillStyle = 'rgba(255,230,230,' + clamp(UIS.nukeFlash, 0, 1) * 0.8 + ')'; ctx.fillRect(0, 0, W, H); }
  if (me && me.alive) for (let i = UIS.dmgDirs.length - 1; i >= 0; i--) {
    const d = UIS.dmgDirs[i]; d.t -= dt; if (d.t <= 0) { UIS.dmgDirs.splice(i, 1); continue; }
    const rel = angDiff(LOOK.yaw, Math.atan2(d.y - me.y, d.x - me.x)), r = Math.min(W, H) * 0.2;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(rel - Math.PI / 2);
    ctx.strokeStyle = 'rgba(255,70,85,' + d.t / 1.2 + ')'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(0, 0, r, -0.28, 0.28); ctx.stroke(); ctx.restore();
  }
}
function drawCrosshair(me, v) {
  if (UIS.hit > 0) UIS.hit -= 1 / 60;
  if (UIS.hitKill > 0) UIS.hitKill -= 1 / 60;
  if (!me || !me.alive || UI.overlay) return;
  if (CAM.on && CAM.mode === 2) return; // önden kamera: nişangâh yok
  const x = W / 2, y = H / 2, w = WEAPONS[curW(me)];
  ctx.save();
  if (me.scoped) {
    const R = Math.min(W, H) * 0.46;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(x, y, R, 0, TAU, true); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - R, y); ctx.lineTo(x + R, y); ctx.moveTo(x, y - R); ctx.lineTo(x, y + R); ctx.stroke();
    circle(x, y, 2, PAL.red);
  } else if (me.st.ovl > 0) {
    circle(x, y, 10 + Math.sin(S.time * 20) * 2, null, '#f7f35a', 2);
  } else {
    const spread = calcSpread(me, w), gap = clamp(Math.tan(spread) / Math.tan(GLX.fovY / 2) * (H / 2), 3, 110), L = 7;
    const lines = () => { ctx.beginPath(); ctx.moveTo(x - gap - L, y); ctx.lineTo(x - gap, y); ctx.moveTo(x + gap, y); ctx.lineTo(x + gap + L, y); ctx.moveTo(x, y - gap - L); ctx.lineTo(x, y - gap); ctx.moveTo(x, y + gap); ctx.lineTo(x, y + gap + L); ctx.stroke(); };
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; lines();
    ctx.lineWidth = 2; ctx.strokeStyle = PAL.teal; lines();
    circle(x, y, 1.6, PAL.teal);
  }
  if (UIS.hit > 0) {
    ctx.strokeStyle = UIS.hitKill > 0 ? PAL.red : UIS.hitHs ? PAL.gold : '#fff'; ctx.lineWidth = 2.5;
    const a = 6, b = 13;
    ctx.beginPath(); ctx.moveTo(x - b, y - b); ctx.lineTo(x - a, y - a); ctx.moveTo(x + b, y - b); ctx.lineTo(x + a, y - a); ctx.moveTo(x - b, y + b); ctx.lineTo(x - a, y + a); ctx.moveTo(x + b, y + b); ctx.lineTo(x + a, y + a); ctx.stroke();
  }
  ctx.restore();
}
function drawScoreboard(me) {
  const mt = me ? me.team : 0, w = Math.min(820, W - 40), x = W / 2 - w / 2;
  const rows = S.players.slice().sort((a, b) => (a.team === mt ? 0 : 1) - (b.team === mt ? 0 : 1) || b.kills - a.kills);
  const h = 70 + rows.length * 30 + 20, y = H / 2 - h / 2;
  panel(x, y, w, h, 0.94);
  txt('SKOR TABLOSU', x + 20, y + 22, 18, PAL.white);
  txt(S.score[mt] + ' — ' + S.score[1 - mt], x + w - 20, y + 22, 18, PAL.gold, 'right');
  const cols = [['AJAN', 20], ['OYUNCU', 80], ['K', w - 330], ['Ö', w - 280], ['HASAR', w - 220], ['KREDİ', w - 140], ['ULTİ', w - 60]];
  for (const c of cols) txt(c[0], x + c[1], y + 50, 11, PAL.dim);
  rows.forEach((p, i) => {
    const ry = y + 66 + i * 30, ally = p.team === mt, ag = AGENTS[p.agent];
    ctx.fillStyle = ally ? 'rgba(30,227,207,0.08)' : 'rgba(255,70,85,0.08)'; ctx.fillRect(x + 10, ry, w - 20, 26);
    ctx.save(); ctx.globalAlpha = p.alive ? 1 : 0.45;
    circle(x + 34, ry + 13, 11, ag.color); txt(ag.icon, x + 34, ry + 14, 11, '#0b1016', 'center');
    const nm = p.name + (p.isBot ? ' [BOT]' : '') + (p.id === G.myId ? '  (SEN)' : '');
    txt(nm, x + 80, ry + 13, 13, ally ? PAL.teal : PAL.red);
    { const self = p.id === G.myId, vm = self ? !!VC.stream : !!p.vm, vt = self ? VC.talking : !!p.vt && (ally || (VC.in[p.id] && VC.in[p.id].g > 0.03));
      if (vm || vt) { ctx.font = 'bold 13px ' + FONT; const nx = x + 80 + ctx.measureText(tl(nm)).width + 14; drawMic(nx, ry + 13, vt ? (ally ? PAL.teal : PAL.red) : 'rgba(236,232,225,0.35)', vt); } }
    txt(String(p.kills), x + w - 330, ry + 13, 13, PAL.white);
    txt(String(p.deaths), x + w - 280, ry + 13, 13, PAL.white);
    txt(String(Math.round(p.dmg || 0)), x + w - 220, ry + 13, 13, PAL.white);
    txt(ally ? '¤ ' + p.credits : '—', x + w - 140, ry + 13, 13, PAL.gold);
    txt(p.ult + '/' + ag.x.pts, x + w - 60, ry + 13, 13, p.ult >= ag.x.pts ? PAL.gold : PAL.white);
    ctx.restore();
  });
}

/* ---------------- SES YARDIMCILARI ---------------- */
function bombBeeps(dt) {
  const sp = S.bomb;
  if (sp.state !== 'planted' || S.phase !== 'planted') return;
  UIS.beepT -= dt;
  if (UIS.beepT <= 0) {
    UIS.beepT = sp.t > 15 ? 1 : sp.t > 8 ? 0.55 : sp.t > 3 ? 0.28 : 0.12;
    AU.play('bombbeep', sp.x, sp.y, 1.4);
  }
}
function footstepSounds(dt, v) {
  for (const p of S.players) {
    if (!p.alive) continue;
    if (p.spd > RUN * 0.62) {
      p._stepT = (p._stepT || 0) - dt;
      if (p._stepT <= 0) { p._stepT = 0.33; AU.play('step', p.x, p.y, p.id === G.myId ? 0.35 : 0.9, p.id === G.myId); }
    }
  }
}

