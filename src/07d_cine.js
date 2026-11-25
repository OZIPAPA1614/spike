/* =====================================================================
   07d · SİNEMATİK GİRİŞ
        Maçın ilk rauntu başlamadan önce harita üzerinde kamera uçuşu:
        genel görünüm → A bölgesi → B bölgesi → kendi doğuş noktana iniş.
        Sinema şeritleri, harita adı ve takımlar ekranda; BOŞLUK / ESC /
        tıklama (dokunmatikte ekrana dokunma) ile atlanabilir.
        Satın alma süresi kaybolmaz: ilk rauntun satın alma evresi
        sinematik süresi kadar uzatılır (host'ta, 03_game startRound).
        PARKUR modu her raunt öncesi kendi kısa uçuşunu (pkCineShots) kullanır.
   ===================================================================== */
const INTRO_TIME = 8;
const CINE = { on: false, t: 0, shots: null, total: 0, kind: '', last: null };
const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function cineMatchShots() {
  const cx = WW / 2, cz = WH / 2, big = Math.max(WW, WH);
  const A = tc(...MAPDATA.sites.A.center), B = tc(...MAPDATA.sites.B.center), m = MAPS[CUR_MAP];
  const hi = clamp(big * 0.3, 1400, 2600);
  if (typeof arOn === 'function' && arOn()) {
    const sn = arMode() === 'sn', Z = sn && S.arena && S.arena.z ? { x: S.arena.z.x, y: S.arena.z.y } : { x: cx, y: cz };
    return [
      { d: 2.6, p0: [cx - big * 0.42, hi * 1.05, cz + WH * 0.62], p1: [cx + big * 0.12, hi * 0.85, cz + WH * 0.58], l0: [cx, 0, cz - WH * 0.05], l1: [cx, 0, cz - WH * 0.1], title: m.name, sub: AR_NAMES[arMode()], col: PAL.white },
      { d: 2.4, p0: [Z.x - 1100, 820, Z.y + 900], p1: [Z.x - 320, 480, Z.y + 640], l0: [Z.x, 40, Z.y], l1: [Z.x + 60, 40, Z.y], title: sn ? 'SÜPERNOVA BÖLGESİ' : 'SİLAH YARIŞI', sub: sn ? 'Bölgede kalan takım puan toplar · bölge yer değiştirir' : 'Her öldürmede sıradaki silah · son silah kılıç', col: PAL.gold },
      { d: INTRO_TIME - 5, me: true, title: 'TAKIMLAR', col: PAL.teal }
    ];
  }
  return [
    { d: 2.3, p0: [cx - big * 0.42, hi * 1.05, cz + WH * 0.62], p1: [cx + big * 0.12, hi * 0.85, cz + WH * 0.58], l0: [cx, 0, cz - WH * 0.05], l1: [cx, 0, cz - WH * 0.1],
      title: m.name, sub: m.desc, col: PAL.white },
    { d: 1.8, p0: [A.x - 1100, 760, A.y + 820], p1: [A.x - 260, 460, A.y + 620], l0: [A.x, 20, A.y], l1: [A.x + 80, 20, A.y],
      title: 'A BÖLGESİ', sub: 'Bomba burada kurulabilir', col: PAL.gold },
    { d: 1.8, p0: [B.x + 1100, 760, B.y + 820], p1: [B.x + 260, 460, B.y + 620], l0: [B.x, 20, B.y], l1: [B.x - 80, 20, B.y],
      title: 'B BÖLGESİ', sub: 'Bomba burada kurulabilir', col: PAL.gold },
    { d: INTRO_TIME - 5.9, me: true, title: 'TAKIMLAR', col: PAL.teal }
  ];
}
function cineStart(kind, shots) {
  if (!S || !GLX.ok) return;
  CINE.shots = shots || cineMatchShots(); CINE.kind = kind || 'match';
  CINE.total = CINE.shots.reduce((a, s) => a + s.d, 0); CINE.t = 0; CINE.on = true; CINE.last = null;
  document.body.classList.add('cine');
  MOUSE.down = false;
}
function cineStop(skipped) {
  if (!CINE.on) return;
  CINE.on = false; document.body.classList.remove('cine');
  // tek oyunculuda atlanan süre satın alma süresinden düşülür (oyuncu boşuna beklemesin)
  if (skipped && S && G.mode === 'sp' && CINE.kind === 'match' && S.phase === 'buy' && S.round === 1) S.phaseT = Math.min(S.phaseT, BUY_TIME);
  if (skipped && S && G.mode === 'sp' && CINE.kind === 'pk' && S.phase === 'buy' && typeof PK_COUNT !== 'undefined') S.phaseT = Math.min(S.phaseT, PK_COUNT);
}
/* İlk rauntun satın alma evresi bitmeden sinematik bitmiş olmalı (geç katılma vb. durumlar için güvence) */
function cineCheck() {
  if (!CINE.on) return;
  if (!S || !G.running || S.phase !== 'buy' || CINE.t >= CINE.total) cineStop(false);
}
/* bu karenin kamerası: { x, y(yükseklik), z, yaw, pitch } */
function cineCam(dt) {
  CINE.t += dt; cineCheck(); if (!CINE.on) return null;
  let t = CINE.t, i = 0;
  while (i < CINE.shots.length - 1 && t >= CINE.shots[i].d) { t -= CINE.shots[i].d; i++; }
  const s = CINE.shots[i], f = clamp(t / s.d, 0, 1);
  let p, l;
  if (s.me) { // son çekim: arkadan-yukarıdan oyuncunun gözüne iniş
    const me = S.pmap[G.myId] || S.players[0], yw = me === S.pmap[G.myId] ? LOOK.yaw : me.ang, ux = Math.cos(yw), uz = Math.sin(yw);
    const e = easeIO(f), eye = EYE + liftOf(me);
    const p0 = [me.x - ux * 620, 470, me.y - uz * 620], p1 = [me.x, eye, me.y];
    const l0 = [me.x + ux * 120, 40, me.y + uz * 120], l1 = [me.x + ux * 400, eye, me.y + uz * 400];
    p = [lerp(p0[0], p1[0], e), lerp(p0[1], p1[1], Math.pow(e, 0.8)), lerp(p0[2], p1[2], e)]; l = [lerp(l0[0], l1[0], e), lerp(l0[1], l1[1], e), lerp(l0[2], l1[2], e)];
  } else {
    const e = s.lin ? f : easeIO(f) * 0.7 + f * 0.3;
    p = [lerp(s.p0[0], s.p1[0], e), lerp(s.p0[1], s.p1[1], e), lerp(s.p0[2], s.p1[2], e)]; l = [lerp(s.l0[0], s.l1[0], e), lerp(s.l0[1], s.l1[1], e), lerp(s.l0[2], s.l1[2], e)];
  }
  const dx = l[0] - p[0], dy = l[1] - p[1], dz = l[2] - p[2];
  CINE.last = { x: p[0], y: p[1], z: p[2], yaw: Math.atan2(dz, dx), pitch: Math.atan2(dy, Math.hypot(dx, dz)), shot: i, f };
  return CINE.last;
}
/* ekran katmanı: sinema şeritleri, başlıklar, takımlar, atlama ipucu */
function drawCine(dt, me) {
  const c = CINE.last; if (!c) return;
  const T = CINE.total, t = CINE.t, inK = clamp(t / 0.45, 0, 1), outK = clamp((T - t) / 0.5, 0, 1), k = Math.min(inK, outK);
  const bh = Math.round(H * 0.11 * easeIO(k));
  // çekimler arası kısa kararma (kesme geçişi)
  let acc = 0;
  for (let i = 0; i < CINE.shots.length - 1; i++) { acc += CINE.shots[i].d; const d = Math.abs(t - acc); if (d < 0.18) { ctx.fillStyle = 'rgba(0,0,0,' + (1 - d / 0.18) * 0.85 + ')'; ctx.fillRect(0, 0, W, H); } }
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
  ctx.fillStyle = PAL.red; ctx.fillRect(0, H - bh, W * clamp(t / T, 0, 1), 2);
  const s = CINE.shots[c.shot], fa = Math.min(1, c.f * 5, (1 - c.f) * 6 + 0.15), sm = clamp(Math.min(W, H) / 720, 0.8, 1.4);
  ctx.save(); ctx.globalAlpha = clamp(fa, 0, 1) * k;
  if (s.me && CINE.kind === 'pk') {
    { const g = ctx.createLinearGradient(0, H - bh - 90 * sm, 0, H - bh); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.7)'); ctx.fillStyle = g; ctx.fillRect(0, H - bh - 90 * sm, W, 90 * sm); }
    txt('PARKUR ' + S.round + ' / ' + PK_ROUNDS, W / 2, H - bh - 46 * sm, Math.round(30 * sm), PAL.gold, 'center');
    txt('Bitişe ilk varan raundu alır · düşersen kontrol noktasından devam', W / 2, H - bh - 18 * sm, Math.round(14 * sm), PAL.white, 'center', 'normal');
  } else if (s.me && CINE.kind === 'match') {
    // takımlar: solda kendi takımın, sağda rakip
    const mt = me ? me.team : 0;
    for (const side of [0, 1]) {
      const team = side ? 1 - mt : mt, ps = S.players.filter(p => p.team === team), x = side ? W - 40 * sm : 40 * sm, al = side ? 'right' : 'left', col = side ? PAL.red : PAL.teal;
      txt((side ? 'RAKİP' : 'TAKIMIN') + (arOn() ? '' : ' · ' + (sideOf(team) === 'atk' ? 'SALDIRAN' : 'SAVUNAN')), x, bh + 34 * sm, Math.round(15 * sm), col, al);
      ps.forEach((p, i) => txt(p.name + ' · ' + AGENTS[p.agent].name, x, bh + (62 + i * 24) * sm, Math.round(14 * sm), p.id === G.myId ? PAL.gold : PAL.white, al, 'normal'));
    }
    { const g = ctx.createLinearGradient(0, H - bh - 90 * sm, 0, H - bh); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.7)'); ctx.fillStyle = g; ctx.fillRect(0, H - bh - 90 * sm, W, 90 * sm); }
    if (arOn()) {
      txt(AR_NAMES[arMode()], W / 2, H - bh - 46 * sm, Math.round(30 * sm), PAL.gold, 'center');
      txt(arMode() === 'gg' ? 'Her öldürmede yeni silah · kılıçla öldüren takım kazanır' : arMode() === 'fr' ? 'Görev yok · dolaş, NPC çıkar, pill kullan · ' + (IS_TOUCH ? '[SPAWN]' : '[Q]') + ' spawn menüsü' : 'Parlayan bölgeyi tut · 100 puana ilk ulaşan takım kazanır', W / 2, H - bh - 18 * sm, Math.round(14 * sm), PAL.white, 'center', 'normal');
    } else {
      txt('RAUNT 1 / ' + MATCH_ROUNDS, W / 2, H - bh - 46 * sm, Math.round(30 * sm), PAL.white, 'center');
      txt(me && sideOf(me.team) === 'atk' ? 'SALDIRI — Bombayı A veya B bölgesine kur' : 'SAVUNMA — Bölgeleri koru, bombayı imha et', W / 2, H - bh - 18 * sm, Math.round(14 * sm), me && sideOf(me.team) === 'atk' ? PAL.red : PAL.teal, 'center', 'normal');
    }
  } else if (s.title) {
    const y = H - bh - 70 * sm;
    { const g = ctx.createLinearGradient(0, 0, W * 0.6, 0); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, y - 50 * sm, W * 0.6, 100 * sm); }
    ctx.fillStyle = s.col || PAL.white; ctx.fillRect(40 * sm, y - 34 * sm, 5 * sm, 64 * sm);
    txt(s.title, 58 * sm, y - 6 * sm, Math.round(44 * sm), s.col || PAL.white, 'left');
    if (s.sub) txt(s.sub, 60 * sm, y + 26 * sm, Math.round(15 * sm), PAL.white, 'left', 'normal');
  }
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.75 * k;
  txt(IS_TOUCH ? 'ATLAMAK İÇİN DOKUN' : '[BOŞLUK] ATLA', W - 24 * sm, H - bh / 2, Math.round(13 * sm), PAL.dim, 'right');
  ctx.restore();
}
