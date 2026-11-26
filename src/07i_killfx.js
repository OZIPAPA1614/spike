/* =====================================================================
   07i · ÖLDÜRME EFEKTLERİ (Arsenal gibi)
   Öldüren oyuncunun kuşandığı efekt, ölen oyuncunun yerinde oynar; herkes görür.
   · Efekt 'kill' olayından başlar (host ve istemci aynı olayı işler), süresi S.time ile ölçülür.
   · Efekt sürerken ceset çizilmez; efekt bitince ceset görünür (canlandırma oyun kuralını değiştirmez).
   · Görünürlük cesetle aynı: takım arkadaşı, öldüren ve ölen hep görür; rakip cesedi görüş hattı ister.
   · Mağaza önizlemeleri (2B) kfxPreview ile çizilir.
   ===================================================================== */
const KFXA = [];
const _kh = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); }; // tohumlu rastgele [0,1)
const _kOut = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const _kBack = u => { u = clamp(u, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
const KFX_PAL = [[1, 0.27, 0.33], [1, 0.82, 0.3], [0.12, 0.89, 0.81], [0.66, 0.42, 1], [1, 0.4, 0.8], [0.35, 0.95, 0.4], [0.3, 0.6, 1]];
/* zamanlı sesler: [saniye, ses] */
const KFX_SND = {
  k01: [[0.18, 'kconf']], k02: [[0, 'kheart']], k03: [[0, 'kinfl'], [1.95, 'kpop']], k04: [[0, 'kfall'], [0.42, 'kanvil']],
  k05: [[0, 'kpoof'], [0.2, 'kcluck'], [1.3, 'kcluck']], k06: [[0, 'kdig'], [0.6, 'ktomb']], k07: [[0.3, 'kghost']], k08: [[0, 'kfreeze'], [1.35, 'kshatter']],
  k09: [[0, 'kthunder']], k10: [[0, 'kpixel']], k11: [[0, 'kwhizz'], [0.85, 'kfw']], k12: [[0, 'kufo']], k13: [[0, 'kvoid']], k14: [[0, 'kmeteor'], [0.55, 'bigboom']]
};
const KFX_SHAKE = { k04: [0.42, 5], k09: [0, 6], k11: [0.85, 4], k14: [0.55, 12] };

/* ölen oyuncunun renkleri (karakter skini ya da ajan renkleri) — efekt başında bir kez alınır */
function kfxCols(v) {
  const cs = charSkin(v, S ? S.time : 0), ag = AGCOL[v.agent] || COL.white, m = (c, k) => [c[0] * k, c[1] * k, c[2] * k, 1];
  return cs ? { suit: cs.suit.slice(), legs: cs.legs, helm: cs.helm.slice(), visor: cs.visor.slice(), pack: cs.pack }
    : { suit: m(ag, 0.75), legs: m(COL.dark, 1.2), helm: m(ag, 0.55), visor: ag, pack: m(COL.dark, 1.4) };
}
function kfxStart(kid, v, a) {
  const d = KFX[kid]; if (!d || !v || !S) return null;
  for (let i = KFXA.length - 1; i >= 0; i--) if (KFXA[i].id === v.id) KFXA.splice(i, 1);
  const ang = a && (a.x !== v.x || a.y !== v.y) ? Math.atan2(a.y - v.y, a.x - v.x) : (v.ang || 0);
  const f = { k: kid, d, id: v.id, team: v.team, att: a ? a.id : null, x: v.x, y: v.y, ang, run: ang + Math.PI + (Math.random() - 0.5) * 1.2, t0: S.time, sd: Math.random() * 97, col: kfxCols(v), st: 0, sh: 0 };
  if (KFXA.length >= 24) KFXA.shift();
  KFXA.push(f);
  return f;
}
/* 'kill' olayı (07c): öldürenin efekti varsa başlat */
function kfxOnKill(ev) {
  if (!S || !ev || !ev.a || ev.a === ev.v) return;
  const a = S.pmap[ev.a], v = S.pmap[ev.v];
  if (a && v && a.kfx && KFX[a.kfx]) kfxStart(a.kfx, v, a);
}
function kfxClear() { KFXA.length = 0; }
function kfxHides(id) { for (let i = 0; i < KFXA.length; i++) if (KFXA[i].id === id) return true; return false; }
function kfxVisible(f, me, v) {
  if (!me || PKMAP) return true;
  if (f.team === me.team || f.att === G.myId || f.id === G.myId) return true;
  return !!(v && v.alive && losClear(v.x, v.y, f.x, f.y, true));
}
function kfxSound(f, e, me) {
  const L = KFX_SND[f.k] || [];
  while (f.st < L.length && e >= L[f.st][0]) { AU.play(L[f.st][1], f.x, f.y, 1, f.att === G.myId); f.st++; }
  const sh = KFX_SHAKE[f.k];
  if (sh && !f.sh && e >= sh[0]) { f.sh = 1; if (me && dist(me.x, me.y, f.x, f.y) < 480) UIS.shake = Math.max(UIS.shake, sh[1]); }
}
function drawKillFx(me, v) {
  if (!S) { KFXA.length = 0; return; }
  for (let i = KFXA.length - 1; i >= 0; i--) {
    const f = KFXA[i], e = S.time - f.t0;
    if (e < -0.25 || e > f.d.dur) { KFXA.splice(i, 1); continue; }
    if (e < 0) continue;
    kfxSound(f, e, me);
    if (!kfxVisible(f, me, v)) continue;
    const fn = KFX_DRAW[f.k];
    if (fn) { try { fn(f, e, e / f.d.dur); } catch (er) { KFXA.splice(i, 1); } }
  }
}

/* ---------- çizim yardımcıları ---------- */
const _KR = new Array(9);
/* ölen oyuncunun gövdesi: o = { h: yükselme, sq: dikey ölçek, w: yatay ölçek, rot: ek dönüş, tilt: arkaya devrilme,
   roll, a: saydamlık, tint: [r,g,b], tk: renk karışımı 0..1, jx: titreme } */
function kfxBody(f, o) {
  o = o || {};
  const c = f.col, sq = o.sq === undefined ? 1 : o.sq, w = o.w === undefined ? 1 : o.w, al = o.a === undefined ? 1 : o.a;
  if (al <= 0.01 || sq <= 0.01 || w <= 0.01) return;
  const R = rotMat(f.ang + (o.rot || 0), o.tilt || 0, o.roll || 0, new Array(9)), h0 = o.h || 0, jx = o.jx || 0;
  const tc = f.team === myTeam() ? COL.teal : COL.red;
  const col = cc => o.tk ? [lerp(cc[0], o.tint[0], o.tk), lerp(cc[1], o.tint[1], o.tk), lerp(cc[2], o.tint[2], o.tk), al] : [cc[0], cc[1], cc[2], al];
  const P = (fx, hh, fz, sx, sy, sz, cc, em) => {
    const off = xf(R, fx * w, hh * sq, fz * w);
    QR('box', f.x + off[0] + jx, h0 + off[1], f.y + off[2], R, sx * w, sy * sq, sz * w, col(cc), em ? { em: o.tk ? [em[0] * (1 - o.tk), em[1] * (1 - o.tk), em[2] * (1 - o.tk)] : em } : null);
  };
  P(0, 13, -5, 9, 26, 8, c.legs); P(0, 13, 5, 9, 26, 8, c.legs);
  P(0, 41, 0, 12, 30, 22, c.suit);
  P(0.4, 49, 0, 12.6, 4, 22.6, tc, [tc[0] * 0.5, tc[1] * 0.5, tc[2] * 0.5]);
  P(-6.5, 44, 0, 3, 22, 16, c.pack);
  P(0, 64, 0, 12, 13, 12, COL.skin);
  P(5.6, 65, 0, 2, 4, 10, c.visor, [c.visor[0] * 0.7, c.visor[1] * 0.7, c.visor[2] * 0.7]);
  P(0, 71.5, 0, 13, 3, 13, c.helm);
  P(7, 50, 9, 16, 5, 5, c.suit); P(7, 50, -7, 16, 5, 5, c.suit);
}
const _kAdd = { add: true, lit: 0 };
function kfxGlow(x, h, z, r, c, a) { Q('sphere', x, h, z, 0, 0, r, r, r, [c[0], c[1], c[2], a], _kAdd); }
/* parçacık (analitik): yön th, yatay hız sp, dikey hız up, sürtünme k, yerçekimi g */
function kfxPart(f, i, te, sp, up, k, g, h0) {
  const th = _kh(i, f.sd) * TAU, s = (1 - Math.exp(-k * te)) / k;
  return [f.x + Math.cos(th) * sp * s, Math.max(1.5, h0 + up * s - g * te * te), f.y + Math.sin(th) * sp * s];
}
function kfxConfetti(f, te, n, h0, cols, fade, spd) {
  for (let i = 0; i < n; i++) {
    const sp = (110 + _kh(i, f.sd + 1) * 240) * (spd || 1), up = 240 + _kh(i, f.sd + 2) * 340;
    const pnt = kfxPart(f, i, te, sp, up, 2.4, 40, h0), cc = cols ? cols[i % cols.length] : KFX_PAL[i % KFX_PAL.length];
    Q('box', pnt[0], pnt[1], pnt[2], te * 9 + i, te * 13 + i * 0.7, 3.4, 0.7, 2.2, [cc[0], cc[1], cc[2], fade], { em: [cc[0] * 0.25, cc[1] * 0.25, cc[2] * 0.25] });
  }
}
function kfxShards(f, te, n, h0, col, sz, fade, g) {
  for (let i = 0; i < n; i++) {
    const pnt = kfxPart(f, i + 50, te, 90 + _kh(i, f.sd + 5) * 200, 120 + _kh(i, f.sd + 6) * 220, 1.6, g || 260, h0 + _kh(i, f.sd + 7) * 50);
    const s = sz * (0.6 + _kh(i, f.sd + 8) * 0.8);
    Q(i % 2 ? 'pyr' : 'octa', pnt[0], pnt[1], pnt[2], te * 6 + i, te * 8 + i, s, s * 1.4, s, [col[0], col[1], col[2], fade], col[3] ? { em: [col[0] * 0.3, col[1] * 0.3, col[2] * 0.4] } : null);
  }
}
const _kFade = (e, dur, d) => clamp((dur - e) / (d || 0.4), 0, 1);
/* kameraya dönük yön (kalpler, hayalet gözleri) */
const _kFace = (x, z) => Math.atan2(GLX.cam[2] - z, GLX.cam[0] - x);

/* ---------- efektler: (f, e = geçen sn, u = e/süre) ---------- */
const KFX_DRAW = {
  k01(f, e) { // KONFETİ: gövde zıplayıp patlar, renkli kâğıtlar saçılır
    const D = f.d.dur, fade = _kFade(e, D, 0.5);
    if (e < 0.2) { const s = Math.sin(e / 0.2 * Math.PI); kfxBody(f, { sq: 1 + 0.25 * s, w: 1 - 0.12 * s }); }
    else {
      if (e < 0.45) kfxGlow(f.x, 45, f.y, 60 + (e - 0.2) * 260, [1, 0.9, 0.6], 0.6 * (1 - (e - 0.2) / 0.25));
      kfxConfetti(f, e - 0.2, 70, 45, null, fade);
      for (let i = 0; i < 6; i++) { // serpantin
        const pnt = kfxPart(f, i + 200, e - 0.2, 160, 380, 2, 60, 50), cc = KFX_PAL[(i * 2) % KFX_PAL.length];
        Qline(pnt[0], pnt[1], pnt[2], pnt[0], pnt[1] + 16, pnt[2], 1.4, [cc[0], cc[1], cc[2], fade], _kAdd);
      }
    }
  },
  k02(f, e) { // KALP YAĞMURU
    const D = f.d.dur, fade = _kFade(e, D, 0.5);
    kfxBody(f, { a: 1 - e / 0.55, h: e * 30 });
    for (let i = 0; i < 14; i++) {
      const te = e - 0.08 - _kh(i, f.sd) * 0.25; if (te <= 0) continue;
      const th = _kh(i, f.sd + 1) * TAU, r = (40 + _kh(i, f.sd + 2) * 80) * (1 - Math.exp(-3 * te));
      const x = f.x + Math.cos(th) * r, z = f.y + Math.sin(th) * r, h = 40 + te * (35 + _kh(i, f.sd + 3) * 45) + Math.sin(te * 4 + i) * 5;
      const s = Math.min(1, te * 5) * (5 + _kh(i, f.sd + 4) * 4), R = rotMat(_kFace(x, z), 0, Math.sin(te * 3 + i) * 0.3, _KR);
      const cc = i % 3 ? [1, 0.22, 0.42, fade] : [1, 0.55, 0.75, fade], o = { em: [0.5, 0.08, 0.18] };
      for (const sz of [-1, 1]) { const p = xf(R, 0, s * 0.25, sz * s * 0.34); QR('sphere', x + p[0], h + p[1], z + p[2], R, s * 0.5, s * 0.8, s * 0.8, cc, o); }
      const p2 = xf(R, 0, -s * 0.22, 0); QR('octa', x + p2[0], h + p2[1], z + p2[2], R, s * 0.4, s * 1.25, s * 1.05, cc, o);
    }
  },
  k03(f, e) { // BALON: şişer, uçar, patlar
    const D = f.d.dur, POP = 1.95, c = f.col.suit;
    if (e < POP) {
      const u1 = _kOut(e / 0.6), rise = e > 0.6 ? Math.pow(e - 0.6, 1.5) * 125 : 0, sway = Math.sin(e * 3.2) * 6 * clamp(e - 0.6, 0, 1);
      if (e < 0.45) kfxBody(f, { w: 1 + u1 * 0.35, sq: 1 - u1 * 0.2 });
      const r = lerp(14, 42, u1) * (1 + Math.sin(e * 9) * 0.03), bh = 45 + rise;
      const ux = Math.cos(f.ang), uz = Math.sin(f.ang), bx = f.x + ux * sway * 0.2 - uz * sway, bz = f.y + uz * sway * 0.2 + ux * sway;
      Q('sphere', bx, bh, bz, f.ang, 0, r, r * 1.12, r, [c[0], c[1], c[2], 1], { em: [c[0] * 0.15, c[1] * 0.15, c[2] * 0.15] });
      Q('sphere', bx - uz * r * 0.2 + ux * r * 0.18, bh + r * 0.25, bz + ux * r * 0.2 + uz * r * 0.18, 0, 0, r * 0.22, r * 0.3, r * 0.22, [1, 1, 1, 0.35], _kAdd); // parlama
      const v = f.col.visor; Q('box', bx + ux * r * 0.47, bh + r * 0.05, bz + uz * r * 0.47, f.ang, 0, 2, r * 0.18, r * 0.55, [v[0], v[1], v[2], 1], { em: [v[0] * 0.7, v[1] * 0.7, v[2] * 0.7] });
      const hm = f.col.helm; Q('box', bx, bh + r * 0.54, bz, f.ang, 0, r * 0.4, 3, r * 0.4, [hm[0], hm[1], hm[2], 1]);
      Q('cone', bx, bh - r * 0.58, bz, 0, Math.PI, 6, 6, 6, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8, 1]);
      if (e > 0.35) Qline(bx, bh - r * 0.6, bz, bx - uz * sway * 0.6, bh - r * 0.6 - 55, bz + ux * sway * 0.6, 0.7, [0.95, 0.95, 0.95, 1]);
    } else {
      const te = e - POP, fade = _kFade(e, D, 0.35), bh = 45 + Math.pow(POP - 0.6, 1.5) * 125;
      if (te < 0.18) kfxGlow(f.x, bh, f.y, 70 + te * 400, [1, 1, 1], 0.7 * (1 - te / 0.18));
      kfxConfetti(f, te, 36, bh, [c, [1, 1, 1], f.col.visor], fade, 0.8);
    }
  },
  k04(f, e) { // ÖRS: gökten örs düşer, gövde yassılaşır, kafada yıldızlar döner
    const D = f.d.dur, TI = 0.42, fade = _kFade(e, D, 0.45), sink = e > D - 0.45 ? (e - (D - 0.45)) * 110 : 0;
    let ab;
    if (e < TI) {
      kfxBody(f, {});
      ab = 80 + 440 * (1 - Math.pow(e / TI, 2));
      const sr = 18 + 26 * (e / TI); Q('disc', f.x, 0.8, f.y, 0, 0, sr, 1, sr, [0, 0, 0, 0.45 * (e / TI)], { lit: 0 });
    } else {
      const te = e - TI, sq = 0.15 + 0.1 * Math.exp(-te * 7) * Math.cos(te * 26);
      kfxBody(f, { sq, w: 1.55, h: -sink });
      ab = 74 * sq + Math.max(0, Math.sin(te * 13) * 12 * Math.exp(-te * 5)) - sink;
      if (te < 0.45) { const k = te / 0.45; Q('ring', f.x, 2, f.y, 0, 0, 30 + k * 150, 1, 30 + k * 150, [0.8, 0.72, 0.6, 0.8 * (1 - k)], _kAdd); }
      if (te < 0.8) for (let i = 0; i < 12; i++) { const p = kfxPart(f, i + 300, te, 140 + _kh(i, 3) * 120, 160, 3, 380, 4); Q('box', p[0], p[1], p[2], te * 8 + i, i, 4, 4, 4, [0.55, 0.5, 0.42, 1 - te / 0.8]); }
      if (te > 0.08) for (let i = 0; i < 3; i++) { // dönen yıldızlar
        const a = e * 6 + i * TAU / 3; Q('octa', f.x + Math.cos(a) * 24, ab + 52 + Math.sin(e * 9 + i) * 2, f.y + Math.sin(a) * 20, e * 5, 0, 6, 8, 6, [1, 0.88, 0.25, fade], { lit: 0, em: [0.9, 0.7, 0.1] });
      }
    }
    // örs modeli
    const ux = Math.cos(f.ang), uz = Math.sin(f.ang), M = [0.27, 0.28, 0.31, 1], T = [0.42, 0.43, 0.47, 1], K = 1.4;
    Q('box', f.x, ab + 3.5 * K, f.y, f.ang, 0, 26 * K, 7 * K, 18 * K, M);
    Q('box', f.x, ab + 11.5 * K, f.y, f.ang, 0, 13 * K, 9 * K, 10 * K, M);
    Q('box', f.x, ab + 20.5 * K, f.y, f.ang, 0, 34 * K, 10 * K, 16 * K, T);
    Q('cone', f.x + ux * 23 * K, ab + 21.5 * K, f.y + uz * 23 * K, f.ang, -Math.PI / 2, 9 * K, 13 * K, 9 * K, M);
    Q('box', f.x - ux * 19 * K, ab + 22 * K, f.y - uz * 19 * K, f.ang, 0, 5 * K, 7 * K, 12 * K, M);
  },
  k05(f, e) { // TAVUK: duman olur, tavuk kaçar
    const D = f.d.dur, fade = _kFade(e, D, 0.35);
    if (e < 0.14) kfxBody(f, { w: 1 - e / 0.2, sq: 1 - e / 0.2 });
    if (e < 0.6) for (let i = 0; i < 7; i++) {
      const k = e / 0.6, th = i / 7 * TAU, r = 10 + k * 40;
      kfxGlow(f.x + Math.cos(th) * r, 25 + _kh(i, f.sd) * 40 + k * 20, f.y + Math.sin(th) * r, 26 + k * 30, [0.95, 0.95, 0.95], 0.55 * (1 - k));
    }
    if (e < 0.12) return;
    const te = e - 0.12, run = Math.max(0, te - 0.15) * 175, hop = te < 0.15 ? Math.sin(te / 0.15 * Math.PI) * 22 : Math.abs(Math.sin(te * 17)) * 4;
    const A = f.run + Math.sin(te * 2.3) * 0.25, cx = f.x + Math.cos(f.run) * run, cz = f.y + Math.sin(f.run) * run;
    const R = rotMat(A, 0, 0, new Array(9)), SC = 1.6, W = [0.97, 0.97, 0.95, fade], OR = [1, 0.6, 0.12, fade], RD = [0.92, 0.12, 0.15, fade];
    const P = (fx, h, fz, sx, sy, sz, col, mesh) => { const o = xf(R, fx * SC, h * SC, fz * SC); QR(mesh || 'box', cx + o[0], hop + o[1], cz + o[2], R, sx * SC, sy * SC, sz * SC, col); };
    const lg = Math.sin(te * 22) * 2.5;
    P(lg, 4, 2.6, 1.4, 8, 1.4, OR); P(-lg, 4, -2.6, 1.4, 8, 1.4, OR);
    P(0, 14, 0, 14, 11, 10, W); P(-8, 18, 0, 5, 8, 8, W);
    const wf = Math.sin(te * 30) * 1.5; P(0, 15 + wf, 5.6, 9, 6, 1.6, W); P(0, 15 + wf, -5.6, 9, 6, 1.6, W);
    P(7, 23, 0, 7, 8, 7, W); P(7, 28.5, 0, 4, 4, 1.6, RD); P(11.5, 23, 0, 4, 2.2, 3, OR); P(10, 19.6, 0, 1.6, 3, 1.4, RD);
    P(9.8, 24.6, 2.3, 1, 1.2, 1, [0.05, 0.05, 0.05, fade]); P(9.8, 24.6, -2.3, 1, 1.2, 1, [0.05, 0.05, 0.05, fade]);
  },
  k06(f, e) { // MEZAR TAŞI: gövde yere gömülür, mezar taşı yükselir
    const D = f.d.dur, end = e > D - 0.4 ? (e - (D - 0.4)) / 0.4 : 0;
    const sink = Math.pow(clamp(e / 0.7, 0, 1), 2) * 90; if (sink < 88) kfxBody(f, { h: -sink, jx: Math.sin(e * 60) * 1.2 });
    if (e < 0.9) for (let i = 0; i < 14; i++) { const p = kfxPart(f, i + 400, e, 60 + _kh(i, 9) * 90, 140 + _kh(i, 8) * 120, 2.5, 330, 3); Q('box', p[0], p[1], p[2], e * 7 + i, i, 4.5, 4.5, 4.5, [0.36, 0.25, 0.16, 1 - e / 0.9]); }
    const gm = _kOut((e - 0.2) / 0.5) * (1 - end); if (gm > 0) Q('sphere', f.x, 0, f.y, f.ang, 0, 52, 14 * gm, 34, [0.32, 0.23, 0.15, 1]);
    const th = _kBack((e - 0.45) / 0.5), off = -62 + 62 * th - end * 70; if (off < -60) return;
    const ux = Math.cos(f.ang), uz = Math.sin(f.ang), bx = f.x - ux * 22, bz = f.y - uz * 22, ST = [0.55, 0.56, 0.6, 1], DK = [0.2, 0.2, 0.22, 1];
    Q('box', bx, off + 18, bz, f.ang, 0, 7, 36, 28, ST);
    Q('cyl', bx, off + 36, bz, f.ang, Math.PI / 2, 28, 7, 28, ST);
    Q('box', bx + ux * 3.7, off + 30, bz + uz * 3.7, f.ang, 0, 0.8, 16, 2.8, DK);
    Q('box', bx + ux * 3.7, off + 33, bz + uz * 3.7, f.ang, 0, 0.8, 2.8, 11, DK);
    Q('box', bx + ux * 3.7, off + 12, bz + uz * 3.7, f.ang, 0, 0.8, 1.6, 18, DK);
    Q('box', bx, off + 2, bz, f.ang, 0, 12, 4, 34, [0.45, 0.46, 0.5, 1]);
  },
  k07(f, e) { // HAYALET: gövde devrilir, ruhu yükselir
    const D = f.d.dur, tilt = _kOut(e / 0.45) * 1.45;
    kfxBody(f, { tilt, a: e > D - 0.3 ? (D - e) / 0.3 : 1 });
    if (e < 0.3) return;
    const te = e - 0.3, gh = 18 + te * 88, a = 0.72 * clamp(te / 0.3, 0, 1) * _kFade(e, D, 0.6), sw = Math.sin(e * 4) * 12;
    const fx = _kFace(f.x, f.y), sx = Math.cos(fx + Math.PI / 2) * sw, sz = Math.sin(fx + Math.PI / 2) * sw, x = f.x + sx, z = f.y + sz;
    const WH = [0.9, 0.95, 1, a], o = { lit: 0, em: [0.35, 0.4, 0.45] };
    Q('sphere', x, gh + 30, z, 0, 0, 24, 24, 24, WH, o);
    Q('cyl', x, gh + 16, z, 0, 0, 23, 26, 23, WH, o);
    for (let i = 0; i < 5; i++) { const aa = i / 5 * TAU + e * 3; Q('sphere', x + Math.cos(aa) * 8.5, gh + 3 + Math.sin(e * 8 + i) * 2, z + Math.sin(aa) * 8.5, 0, 0, 9, 9, 9, WH, o); }
    const R = rotMat(fx, 0, 0, _KR);
    for (const s of [-1, 1]) {
      const pe = xf(R, 11.5, 33, s * 4.5); QR('sphere', x + pe[0], gh + pe[1], z + pe[2], R, 2, 5, 3.4, [0.05, 0.05, 0.08, a], { lit: 0 });
      const pa = xf(R, 0, 18 + Math.sin(e * 6 + s) * 4, s * 14); QR('sphere', x + pa[0], gh + pa[1], z + pa[2], R, 7, 7, 7, WH, o);
    }
    const pm = xf(R, 11.5, 25, 0); QR('sphere', x + pm[0], gh + pm[1], z + pm[2], R, 2, 4, 4, [0.05, 0.05, 0.08, a], { lit: 0 });
  },
  k08(f, e) { // BUZ HEYKELİ: donar, sonra paramparça olur
    const D = f.d.dur, SH = 1.35, IC = [0.62, 0.86, 1];
    if (e < SH) {
      const k = clamp(e / 0.35, 0, 1), jx = e > 0.9 ? Math.sin(e * 80) * 1.5 * (e - 0.9) : 0;
      kfxBody(f, { tint: IC, tk: k * 0.85, jx });
      const g = _kOut(k);
      Q('box', f.x + jx, 42 * g, f.y, f.ang, 0, 30 * g, 86 * g, 36 * g, [0.72, 0.92, 1, 0.38], { em: [0.12, 0.22, 0.3] });
      Q('disc', f.x, 0.9, f.y, 0, 0, 70 * g, 1, 70 * g, [0.75, 0.92, 1, 0.5], { lit: 0, em: [0.2, 0.3, 0.35] });
      if (e < 0.5) for (let i = 0; i < 10; i++) { const p = kfxPart(f, i + 500, e, 70, 60 + _kh(i, 2) * 80, 2, 0, 10 + _kh(i, 3) * 60); kfxGlow(p[0], p[1], p[2], 4, [0.85, 0.95, 1], 0.8 * (1 - e / 0.5)); }
    } else {
      const te = e - SH, fade = _kFade(e, D, 0.4);
      if (te < 0.2) kfxGlow(f.x, 45, f.y, 80 + te * 300, [0.8, 0.95, 1], 0.6 * (1 - te / 0.2));
      kfxShards(f, te, 28, 10, [0.75, 0.93, 1, 1], 7, fade, 420);
      Q('disc', f.x, 0.9, f.y, 0, 0, 70, 1, 70, [0.75, 0.92, 1, 0.5 * fade], { lit: 0 });
    }
  },
  k09(f, e) { // YILDIRIM: gökten çarpar, gövde kömürleşir ve devrilir
    const D = f.d.dur, fade = _kFade(e, D, 0.5), BL = [0.08, 0.08, 0.09];
    if (e < 0.38 && Math.floor(e * 30) % 3 !== 2) { // titreyen şimşek
      let px = f.x + 40, pz = f.y - 30, ph = 700; const fr = Math.floor(e * 24);
      for (let s = 1; s <= 11; s++) {
        const k = s / 11, nx = lerp(f.x + 40, f.x, k) + (s < 11 ? (_kh(s + fr * 13, f.sd) - 0.5) * 46 : 0), nz = lerp(f.y - 30, f.y, k) + (s < 11 ? (_kh(s + fr * 17, f.sd + 1) - 0.5) * 46 : 0), nh = lerp(700, 70, k);
        Qline(px, ph, pz, nx, nh, nz, 4, [0.92, 0.96, 1, 1], _kAdd); Qline(px, ph, pz, nx, nh, nz, 14, [0.5, 0.7, 1, 0.35], _kAdd);
        px = nx; pz = nz; ph = nh;
      }
    }
    if (e < 0.3) kfxGlow(f.x, 50, f.y, 190, [0.7, 0.85, 1], 0.6 * (1 - e / 0.3));
    if (e > 0.08) Q('disc', f.x, 0.8, f.y, 0, 0, 64, 1, 64, [0.04, 0.04, 0.04, 0.8 * fade], { lit: 0 });
    const tilt = e > 0.4 ? _kOut((e - 0.4) / 0.4) * 1.45 : 0;
    kfxBody(f, { tint: BL, tk: clamp(e / 0.15, 0, 0.95), jx: e < 0.4 ? Math.sin(e * 120) * 2 : 0, tilt, a: fade });
    if (e > 0.25) for (let i = 0; i < 6; i++) { // duman
      const k = ((e - 0.25) * 0.8 + i / 6) % 1; Q('sphere', f.x + Math.sin(i * 2.4) * 8, 20 + k * 90, f.y + Math.cos(i * 1.7) * 8, 0, 0, 14 + k * 22, 14 + k * 22, 14 + k * 22, [0.3, 0.3, 0.32, 0.35 * (1 - k) * fade], { lit: 0 });
    }
    if (e < 0.6) for (let i = 0; i < 12; i++) { const p = kfxPart(f, i + 600, e, 150 + _kh(i, 4) * 150, 150, 2, 300, 30); kfxGlow(p[0], p[1], p[2], 4, [1, 0.95, 0.5], 1 - e / 0.6); }
  },
  k10(f, e) { // PİKSEL DAĞILMA: gövde küplere ayrılıp dağılır
    const D = f.d.dur, R = rotMat(f.ang, 0, 0, _KR), c = f.col, tc = f.team === myTeam() ? COL.teal : COL.red, CY = [0.2, 1, 0.9];
    let i = 0;
    const grid = (x0, z0, h0, nx, nz, nh, col) => {
      for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) for (let hh = 0; hh < nh; hh++, i++) {
        const lx = x0 + a * 5.2, lz = z0 + b * 5.2, lh = h0 + hh * 5.2, dl = 0.05 + (1 - lh / 76) * 0.55 + _kh(i, f.sd) * 0.3, te = e - dl;
        let px, py, pz, s = 5, cc = col, gl = 0;
        const o = xf(R, lx, lh, lz);
        if (te <= 0) { px = f.x + o[0] + (Math.random() < 0.04 ? 2 : 0); py = o[1]; pz = f.y + o[2]; }
        else {
          const th = _kh(i, f.sd + 2) * TAU, k = te / 0.85; if (k >= 1) continue;
          px = f.x + o[0] + Math.cos(th) * te * 55; pz = f.y + o[2] + Math.sin(th) * te * 55; py = o[1] + te * (70 + _kh(i, f.sd + 3) * 70);
          s = 5 * (1 - k); gl = k; cc = [lerp(col[0], CY[0], k), lerp(col[1], CY[1], k), lerp(col[2], CY[2], k)];
        }
        Q('box', px, py, pz, f.ang + (te > 0 ? te * 4 : 0), te > 0 ? te * 3 : 0, s, s, s, [cc[0], cc[1], cc[2], 1], gl ? { em: [CY[0] * gl * 0.6, CY[1] * gl * 0.6, CY[2] * gl * 0.6] } : null);
      }
    };
    grid(-2.6, -7.6, 2.6, 2, 2, 5, c.legs); grid(-2.6, 2.4, 2.6, 2, 2, 5, c.legs);
    grid(-2.6, -10.4, 28.6, 2, 5, 4, c.suit); grid(-2.6, -10.4, 49.4, 2, 5, 1, tc);
    grid(-2.6, -2.6, 59.8, 2, 2, 2, COL.skin); grid(-2.6, -2.6, 70.2, 2, 2, 1, c.helm);
    const rh = (e / D) * 120; Q('ring', f.x, rh, f.y, e * 2, 0, 46, 1, 46, [CY[0], CY[1], CY[2], 0.7 * _kFade(e, D, 0.5)], _kAdd);
  },
  k11(f, e) { // HAVAİ FİŞEK: gövde roket gibi fırlar, gökte patlar
    const D = f.d.dur, BO = 0.85, fade = _kFade(e, D, 0.6), bh = u => Math.pow(clamp(u / BO, 0, 1), 2) * 200;
    if (e < BO) {
      kfxBody(f, { h: bh(e), rot: e * 16, tilt: Math.sin(e * 5) * 0.15 });
      for (let i = 1; i <= 16; i++) { const tt = e - i * 0.035; if (tt < 0) break; kfxGlow(f.x + Math.sin(i * 1.3) * 3, bh(tt) - 4, f.y + Math.cos(i * 1.7) * 3, 9 - i * 0.4, [1, 0.6 + i * 0.02, 0.2], 0.8 - i * 0.045); }
      kfxGlow(f.x, 1, f.y, 60 * (1 - e / BO), [1, 0.7, 0.3], 0.4);
    } else {
      const te = e - BO, H0 = bh(BO) + 30, C3 = [KFX_PAL[Math.floor(f.sd) % 7], KFX_PAL[(Math.floor(f.sd) + 2) % 7], [1, 0.95, 0.8]];
      if (te < 0.3) kfxGlow(f.x, H0, f.y, 120 + te * 500, [1, 0.9, 0.7], 0.7 * (1 - te / 0.3));
      for (let i = 0; i < 64; i++) {
        const u = _kh(i, f.sd + 9) * 2 - 1, th = _kh(i, f.sd + 10) * TAU, rr = Math.sqrt(1 - u * u), sp = (i % 2 ? 230 : 160) * (1 - Math.exp(-2.6 * te));
        const x = f.x + Math.cos(th) * rr * sp, z = f.y + Math.sin(th) * rr * sp, h = H0 + u * sp - 45 * te * te;
        const fl = te > 0.9 ? (Math.sin(te * 40 + i) > 0 ? 1 : 0.25) : 1, cc = C3[i % 3];
        kfxGlow(x, h, z, 6, cc, fade * fl); if (te < 0.5) Qline(x, h, z, f.x + (x - f.x) * 0.8, H0 + (h - H0) * 0.8, f.y + (z - f.y) * 0.8, 1.2, [cc[0], cc[1], cc[2], 0.5 * (1 - te / 0.5)], _kAdd);
      }
    }
  },
  k12(f, e) { // UFO: uzay gemisi gelir, çekim ışınıyla gövdeyi alıp götürür
    const D = f.d.dur, ux = Math.cos(f.run), uz = Math.sin(f.run), HV = 205;
    let x = f.x, z = f.y, h = HV;
    if (e < 0.55) { const k = 1 - _kOut(e / 0.55); x -= ux * 320 * k; z -= uz * 320 * k; h = HV + 260 * k; }
    else if (e > 2.25) { const k = e - 2.25; x += ux * k * k * 1100; z += uz * k * k * 1100; h = HV + k * 320; }
    const beam = e > 0.55 && e < 2.25, lift = e > 0.7 ? Math.pow(clamp((e - 0.7) / 1.4, 0, 1), 1.6) * (HV - 35) : 0;
    if (e < 2.12) kfxBody(f, { h: lift, rot: lift * 0.03, w: 1 - lift / HV * 0.55, sq: 1 - lift / HV * 0.55 });
    if (beam) {
      const bp = 0.14 + Math.sin(e * 14) * 0.03, bw = 92 * clamp((e - 0.55) / 0.15, 0, 1) * clamp((2.25 - e) / 0.15, 0, 1);
      Q('cone', f.x, HV / 2, f.y, e, 0, bw, HV, bw, [0.45, 1, 0.6, bp], _kAdd);
      Q('ring', f.x, 2, f.y, 0, 0, bw * 1.1 + Math.sin(e * 10) * 6, 1, bw * 1.1, [0.45, 1, 0.6, 0.7], _kAdd);
      for (let i = 0; i < 8; i++) { const k = ((e * 0.9 + i / 8) % 1); kfxGlow(f.x + Math.cos(i * 2.1 + e) * 26, k * HV, f.y + Math.sin(i * 2.1 + e) * 26, 5, [0.6, 1, 0.7], 0.8 * (1 - k)); }
    }
    const ME = [0.62, 0.66, 0.72, 1];
    Q('sphere', x, h, z, e * 2, 0, 96, 17, 96, ME, { em: [0.05, 0.06, 0.08] });
    Q('sphere', x, h - 4, z, e * 2, 0, 70, 12, 70, [0.4, 0.43, 0.48, 1]);
    Q('sphere', x, h + 10, z, 0, 0, 42, 30, 42, [0.55, 0.95, 0.85, 0.5], { lit: 0, em: [0.15, 0.4, 0.35] });
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + e * 2.5, on = (Math.floor(e * 8) + i) % 3 === 0, cc = on ? [1, 0.95, 0.4] : [0.4, 1, 0.7]; Q('sphere', x + Math.cos(a) * 41, h - 2, z + Math.sin(a) * 41, 0, 0, 5, 5, 5, [cc[0], cc[1], cc[2], 1], { lit: 0, em: cc }); }
    kfxGlow(x, h - 9, z, 44, [0.5, 1, 0.7], 0.35);
  },
  k13(f, e) { // KARA DELİK: girdap açılır, gövdeyi yutar, çöker
    const D = f.d.dur, CH = 50, grow = _kOut(e / 0.4), col = e > D - 0.35 ? 1 - (e - (D - 0.35)) / 0.35 : 1, rr = 28 * grow * col;
    const kk = clamp((e - 0.25) / 1.35, 0, 1), ke = kk * kk;
    if (kk < 0.98) kfxBody(f, { h: ke * (CH - 6), w: 1 - ke, sq: 1 - ke, rot: ke * 30, tilt: ke * 0.8, roll: ke * 0.6 });
    if (rr > 0.5) {
      Q('sphere', f.x, CH, f.y, 0, 0, rr, rr, rr, [0, 0, 0, 1], { lit: 0 });
      kfxGlow(f.x, CH, f.y, rr * 1.9, [0.55, 0.2, 0.95], 0.4);
      Q('ring', f.x, CH, f.y, e * 3.2, 0.38, rr * 4.4, 1, rr * 4.4, [1, 0.6, 0.25, 0.85], { add: true, lit: 0, roll: 0.25 });
      Q('ring', f.x, CH, f.y, -e * 2.4, 0.38, rr * 3.4, 1, rr * 3.4, [0.7, 0.35, 1, 0.85], { add: true, lit: 0, roll: 0.25 });
      Q('disc', f.x, CH, f.y, e * 3, 0.38, rr * 4, 1, rr * 4, [0.45, 0.2, 0.7, 0.22], { add: true, lit: 0, roll: 0.25 });
      for (let i = 0; i < 30; i++) {
        const k = ((e * 0.7 + _kh(i, f.sd)) % 1), a = _kh(i, f.sd + 1) * TAU + e * (3 + k * 6), r = rr * 0.9 + (1 - k) * 110;
        kfxGlow(f.x + Math.cos(a) * r, CH + (_kh(i, f.sd + 2) - 0.5) * 40 * (1 - k), f.y + Math.sin(a) * r, 4 + k * 2, i % 2 ? [1, 0.6, 0.25] : [0.7, 0.4, 1], 0.8 * k * col);
      }
    }
    if (e > D - 0.35) { const k = (e - (D - 0.35)) / 0.35; kfxGlow(f.x, CH, f.y, 40 + k * 160, [0.8, 0.6, 1], 0.7 * (1 - k)); }
  },
  k14(f, e) { // METEOR: gökten düşer, patlar, krater yanar
    const D = f.d.dur, TI = 0.55, ux = Math.cos(f.ang), uz = Math.sin(f.ang), fade = _kFade(e, D, 0.5);
    if (e < TI) {
      kfxBody(f, {});
      const k = Math.pow(e / TI, 1.25), mx = f.x + ux * 460 * (1 - k), mz = f.y + uz * 460 * (1 - k), mh = 20 + 600 * (1 - k);
      Q('sphere', mx, mh, mz, e * 5, e * 3, 30, 28, 30, [0.32, 0.2, 0.13, 1], { em: [0.5, 0.18, 0.04] });
      kfxGlow(mx, mh, mz, 62, [1, 0.55, 0.15], 0.6);
      for (let i = 1; i <= 9; i++) { const kk = Math.max(0, k - i * 0.035); kfxGlow(f.x + ux * 460 * (1 - kk), 20 + 600 * (1 - kk), f.y + uz * 460 * (1 - kk), 50 - i * 4, [1, 0.45 + i * 0.03, 0.12], 0.45 - i * 0.04); }
      const rr = 30 + k * 60; Q('ring', f.x, 2, f.y, e * 4, 0, rr, 1, rr, [1, 0.3, 0.2, 0.6 + 0.3 * Math.sin(e * 30)], _kAdd);
    } else {
      const te = e - TI;
      if (te < 0.45) { kfxGlow(f.x, 40, f.y, 160 + te * 600, [1, 0.6, 0.25], 0.75 * (1 - te / 0.45)); Q('ring', f.x, 3, f.y, 0, 0, 40 + te * 520, 1, 40 + te * 520, [1, 0.75, 0.4, 1 - te / 0.45], _kAdd); }
      Q('disc', f.x, 0.8, f.y, 0, 0, 95, 1, 95, [0.05, 0.04, 0.04, 0.92 * fade], { lit: 0 });
      Q('ring', f.x, 1, f.y, 0, 0, 96, 1, 96, [1, 0.4, 0.1, 0.6 * fade], _kAdd);
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.4, fh = 26 + Math.sin(e * 18 + i * 2) * 8; Q('cone', f.x + Math.cos(a) * 24, fh / 2, f.y + Math.sin(a) * 24, e * 3 + i, 0, 16, fh, 16, [1, 0.45, 0.1, 0.7 * fade], _kAdd); Q('cone', f.x + Math.cos(a) * 24, fh / 3, f.y + Math.sin(a) * 24, -e * 2, 0, 9, fh * 0.6, 9, [1, 0.85, 0.35, 0.6 * fade], _kAdd); }
      if (te < 1.2) for (let i = 0; i < 20; i++) { const p = kfxPart(f, i + 700, te, 200 + _kh(i, 5) * 220, 260 + _kh(i, 6) * 200, 1.8, 420, 10); Q('box', p[0], p[1], p[2], te * 7 + i, i, 6, 6, 6, [0.3, 0.2, 0.14, 1 - te / 1.2], { em: [0.4, 0.12, 0.02] }); }
      for (let i = 0; i < 5; i++) { const k = ((te * 0.6 + i / 5) % 1); Q('sphere', f.x + Math.sin(i * 2.1) * 20, 20 + k * 120, f.y + Math.cos(i * 1.4) * 20, 0, 0, 20 + k * 40, 20 + k * 40, 20 + k * 40, [0.22, 0.2, 0.2, 0.4 * (1 - k) * fade], { lit: 0 }); }
    }
  }
};

/* ---------- 2B önizleme (mağaza, kasa) ----------
   t: performance saniyesi (canlı) ya da -1 (efektin en tanıdık anı, durağan) */
const KFX_PEAK = { k01: 0.55, k02: 0.7, k03: 1.3, k04: 0.9, k05: 1.0, k06: 1.3, k07: 1.1, k08: 0.8, k09: 0.15, k10: 0.75, k11: 1.15, k12: 1.4, k13: 0.9, k14: 0.4 };
const _pvC = (c, a) => 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + (a === undefined ? 1 : a) + ')';
const PV_BODY = { suit: '#3a6f8a', legs: '#262b33', helm: '#2c5568', visor: '#3ec1ff', pack: '#20242b', skin: '#d9a679' };
/* önden ajan (yerden yukarı): sq dikey, w yatay ölçek, a saydamlık, tint renk, tk karışım, rot dönüş (yer noktasında) */
function pvBody(g, cx, gy, sc, o) {
  o = o || {}; const sq = o.sq === undefined ? 1 : o.sq, w = o.w === undefined ? 1 : o.w, a = o.a === undefined ? 1 : o.a;
  if (a <= 0.01 || sq <= 0.01 || w <= 0.01) return;
  g.save(); g.globalAlpha *= a; g.translate(cx, gy - (o.lift || 0) * sc); if (o.rot) g.rotate(o.rot);
  const T = hx => { if (!o.tk) return hx; const c = hexRGB(hx); return _pvC([lerp(c[0], o.tint[0], o.tk), lerp(c[1], o.tint[1], o.tk), lerp(c[2], o.tint[2], o.tk)]); };
  const B = (z, y, ww, h, c, gl) => { if (gl && !o.tk) { g.shadowColor = c; g.shadowBlur = 8; } g.fillStyle = T(c); g.fillRect((z - ww / 2) * sc * w, -(y + h / 2) * sc * sq, ww * sc * w, h * sc * sq); g.shadowBlur = 0; };
  const C = PV_BODY;
  B(-5, 13, 8, 26, C.legs); B(5, 13, 8, 26, C.legs); B(0, 41, 22, 30, C.suit); B(0, 49, 22.6, 4, '#1ee3cf', true);
  B(-13.5, 44, 5, 20, C.suit); B(13.5, 44, 5, 20, C.suit); B(-13.5, 32, 5, 5, C.skin); B(13.5, 32, 5, 5, C.skin);
  B(0, 64, 12, 13, C.skin); B(0, 65, 10, 4, C.visor, true); B(0, 71.5, 13, 3, C.helm);
  g.restore();
}
function _pvDot(g, x, y, r, col, glow) { g.save(); if (glow) { g.shadowColor = col; g.shadowBlur = glow; } g.fillStyle = col; g.beginPath(); g.arc(x, y, Math.max(0.3, r), 0, TAU); g.fill(); g.restore(); }
function _pvParts(g, n, cx, cy, te, sp, up, gr, seed, draw) {
  for (let i = 0; i < n; i++) { const th = _kh(i, seed) * TAU, s = (1 - Math.exp(-2.4 * te)) / 2.4; const x = cx + Math.cos(th) * sp * (0.4 + _kh(i, seed + 1) * 0.6) * s, y = Math.min(cy + 40, cy - (up * (0.5 + _kh(i, seed + 2) * 0.5) * s - gr * te * te)); draw(x, y, i); }
}
function kfxPreview(cv, id, t) {
  const g = cv.getContext('2d'), W2 = cv.width, H2 = cv.height, d = KFX[id]; g.clearRect(0, 0, W2, H2);
  const sc = (H2 - 18) / 130, cx = W2 / 2, gy = H2 - 9;
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(8, gy, W2 - 16, 1.5);
  if (!d) { pvBody(g, cx, gy, sc, { rot: Math.PI / 2 * 0.98, a: 0.75 }); return; } // efektsiz: normal devrilme
  const D = d.dur, e = t < 0 ? KFX_PEAK[id] : ((t % (D + 0.8)) - 0.3), fade = clamp((D - e) / 0.4, 0, 1);
  if (e < 0) { pvBody(g, cx, gy, sc); return; }
  const S2 = sc * 1, Y = h => gy - h * S2, PAL = ['#ff4655', '#ffd14d', '#1ee3cf', '#a86bff', '#ff66cc', '#5af266', '#4d99ff'];
  switch (id) {
    case 'k01': {
      if (e < 0.2) { const s = Math.sin(e / 0.2 * Math.PI); pvBody(g, cx, gy, sc, { sq: 1 + 0.25 * s, w: 1 - 0.12 * s }); break; }
      const te = e - 0.2; g.globalAlpha = fade;
      _pvParts(g, 40, cx, Y(45), te, 120, 160, 30, 3, (x, y, i) => { g.save(); g.translate(x, y); g.rotate(te * 9 + i); g.fillStyle = PAL[i % 7]; g.fillRect(-2.5, -1, 5, 2); g.restore(); });
      g.globalAlpha = 1; break;
    }
    case 'k02': {
      pvBody(g, cx, gy, sc, { a: 1 - e / 0.55, lift: e * 30 }); g.globalAlpha = clamp((D - e) / 0.5, 0, 1);
      for (let i = 0; i < 9; i++) { const te = e - 0.08 - _kh(i, 2) * 0.25; if (te <= 0) continue; const x = cx + (_kh(i, 4) - 0.5) * 120 * (1 - Math.exp(-3 * te)), y = Y(40 + te * (35 + _kh(i, 5) * 45)), s = Math.min(1, te * 5) * (4 + _kh(i, 6) * 3);
        g.fillStyle = i % 3 ? '#ff3a6c' : '#ff8cc0'; g.beginPath(); g.moveTo(x, y + s); g.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.5, x, y - s * 0.5); g.bezierCurveTo(x + s * 0.6, y - s * 1.5, x + s * 1.6, y - s * 0.2, x, y + s); g.fill(); }
      g.globalAlpha = 1; break;
    }
    case 'k03': {
      if (e < 1.95) {
        const u1 = _kOut(e / 0.6), rise = e > 0.6 ? Math.pow(e - 0.6, 1.5) * 125 : 0, r = lerp(14, 42, u1) * S2, by = Y(45 + rise), bx = cx + Math.sin(e * 3.2) * 4;
        if (e < 0.45) pvBody(g, cx, gy, sc, { w: 1 + u1 * 0.35, sq: 1 - u1 * 0.2 });
        if (e > 0.35) { g.strokeStyle = '#eee'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(bx, by + r * 1.1); g.quadraticCurveTo(bx + 4, by + r * 1.1 + 20, bx - 2, by + r * 1.1 + 40); g.stroke(); }
        g.fillStyle = PV_BODY.suit; g.beginPath(); g.ellipse(bx, by, r, r * 1.12, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(bx - r * 0.35, by - r * 0.4, r * 0.18, r * 0.28, -0.4, 0, TAU); g.fill();
        g.save(); g.shadowColor = PV_BODY.visor; g.shadowBlur = 8; g.fillStyle = PV_BODY.visor; g.fillRect(bx - r * 0.3, by - r * 0.1, r * 0.6, r * 0.18); g.restore();
        g.fillStyle = PV_BODY.helm; g.fillRect(bx - r * 0.25, by - r * 1.15, r * 0.5, 2.5);
        g.fillStyle = PV_BODY.suit; g.beginPath(); g.moveTo(bx - 3, by + r * 1.15); g.lineTo(bx + 3, by + r * 1.15); g.lineTo(bx, by + r * 1.05); g.fill();
      } else {
        const te = e - 1.95, by = Y(45 + Math.pow(1.35, 1.5) * 125); if (te < 0.18) _pvDot(g, cx, by, 10 + te * 160, 'rgba(255,255,255,' + 0.6 * (1 - te / 0.18) + ')');
        g.globalAlpha = fade; _pvParts(g, 22, cx, by, te, 100, 80, 40, 7, (x, y, i) => { g.fillStyle = [PV_BODY.suit, '#fff', PV_BODY.visor][i % 3]; g.fillRect(x - 2, y - 1, 4, 2); }); g.globalAlpha = 1;
      }
      break;
    }
    case 'k04': {
      const TI = 0.42; let ab;
      if (e < TI) { pvBody(g, cx, gy, sc); ab = 80 + 440 * (1 - Math.pow(e / TI, 2)); g.fillStyle = 'rgba(0,0,0,' + 0.4 * e / TI + ')'; g.beginPath(); g.ellipse(cx, gy, (12 + 20 * e / TI) * S2 * 1.5, 3, 0, 0, TAU); g.fill(); }
      else {
        const te = e - TI, sq = 0.15 + 0.1 * Math.exp(-te * 7) * Math.cos(te * 26); pvBody(g, cx, gy, sc, { sq, w: 1.55 });
        ab = 74 * sq + Math.max(0, Math.sin(te * 13) * 12 * Math.exp(-te * 5));
        if (te > 0.08) for (let i = 0; i < 3; i++) { const a = e * 6 + i * TAU / 3; _pvDot(g, cx + Math.cos(a) * 24 * S2, Y(ab + 52) + Math.sin(a) * 4, 2.6, '#ffd84d', 6); }
      }
      const y0 = Y(ab), A = S2 * 1.4; g.fillStyle = '#45474e'; g.fillRect(cx - 13 * A, y0 - 7 * A, 26 * A, 7 * A); g.fillRect(cx - 6.5 * A, y0 - 16 * A, 13 * A, 9 * A);
      g.fillStyle = '#6b6d75'; g.fillRect(cx - 17 * A, y0 - 26 * A, 34 * A, 10 * A);
      g.fillStyle = '#45474e'; g.beginPath(); g.moveTo(cx + 17 * A, y0 - 26 * A); g.lineTo(cx + 30 * A, y0 - 22 * A); g.lineTo(cx + 17 * A, y0 - 17 * A); g.fill();
      break;
    }
    case 'k05': {
      if (e < 0.14) pvBody(g, cx, gy, sc, { w: 1 - e / 0.2, sq: 1 - e / 0.2 });
      if (e < 0.6) for (let i = 0; i < 6; i++) _pvDot(g, cx + Math.cos(i) * (6 + e * 50), Y(30 + _kh(i, 1) * 40), (8 + e * 20) * S2, 'rgba(240,240,240,' + 0.6 * (1 - e / 0.6) + ')');
      if (e < 0.12) break;
      const te = e - 0.12, run = Math.max(0, te - 0.15) * 70, hop = te < 0.15 ? Math.sin(te / 0.15 * Math.PI) * 22 : Math.abs(Math.sin(te * 17)) * 4, x = cx + run, y = gy - hop * S2, k = 1.6 * S2;
      g.globalAlpha = fade; const lg = Math.sin(te * 22) * 2.5;
      g.fillStyle = '#ff9a1f'; g.fillRect(x + lg * k - 1, y - 8 * k, 1.6 * k, 8 * k); g.fillRect(x - lg * k - 1, y - 8 * k, 1.6 * k, 8 * k);
      g.fillStyle = '#f7f7f2'; g.fillRect(x - 7 * k, y - 19.5 * k, 14 * k, 11 * k); g.fillRect(x - 10.5 * k, y - 22 * k, 5 * k, 8 * k); g.fillRect(x + 3.5 * k, y - 27 * k, 7 * k, 8 * k);
      g.fillStyle = '#e8202a'; g.fillRect(x + 5 * k, y - 30.5 * k, 4 * k, 4 * k); g.fillRect(x + 9.2 * k, y - 21 * k, 1.6 * k, 3 * k);
      g.fillStyle = '#ff9a1f'; g.fillRect(x + 10.5 * k, y - 24 * k, 4 * k, 2.2 * k); g.fillStyle = '#111'; g.fillRect(x + 8 * k, y - 25.5 * k, 1.2 * k, 1.2 * k);
      g.globalAlpha = 1; break;
    }
    case 'k06': {
      const sink = Math.pow(clamp(e / 0.7, 0, 1), 2) * 90; g.save(); g.beginPath(); g.rect(0, 0, W2, gy); g.clip(); pvBody(g, cx, gy + sink * S2, sc); g.restore();
      const gm = _kOut((e - 0.2) / 0.5); if (gm > 0) { g.fillStyle = '#523b26'; g.beginPath(); g.ellipse(cx, gy, 26 * S2 * 1.4, 7 * gm * S2 * 1.4, 0, Math.PI, TAU); g.fill(); }
      const th = _kBack((e - 0.45) / 0.5), off = -62 + 62 * th; if (off < -60) break;
      g.save(); g.beginPath(); g.rect(0, 0, W2, gy); g.clip(); const x = cx + 16 * S2;
      g.fillStyle = '#8c8f99'; g.beginPath(); g.moveTo(x - 14 * S2, Y(off)); g.lineTo(x - 14 * S2, Y(off + 36)); g.arc(x, Y(off + 36), 14 * S2, Math.PI, TAU); g.lineTo(x + 14 * S2, Y(off)); g.fill();
      g.fillStyle = '#34353a'; g.fillRect(x - 1, Y(off + 38), 2, 16 * S2); g.fillRect(x - 5.5 * S2, Y(off + 34.5), 11 * S2, 2); g.font = 'bold ' + Math.round(7 * S2 + 4) + 'px ' + FONT; g.textAlign = 'center'; g.fillText('RIP', x, Y(off + 14)); g.restore();
      break;
    }
    case 'k07': {
      pvBody(g, cx, gy, sc, { rot: -_kOut(e / 0.45) * 1.45 });
      if (e < 0.3) break;
      const te = e - 0.3, gh = Y(18 + te * 88), a = 0.75 * clamp(te / 0.3, 0, 1) * clamp((D - e) / 0.6, 0, 1), x = cx + Math.sin(e * 4) * 10;
      g.save(); g.globalAlpha = a; g.fillStyle = '#e6f0ff'; g.shadowColor = '#cfe3ff'; g.shadowBlur = 10;
      g.beginPath(); g.arc(x, gh - 30 * S2, 12 * S2, Math.PI, TAU); g.lineTo(x + 12 * S2, gh); for (let i = 0; i < 4; i++) g.quadraticCurveTo(x + (9 - i * 6) * S2, gh - 5 * S2, x + (6 - i * 6) * S2, gh); g.closePath(); g.fill();
      g.shadowBlur = 0; g.fillStyle = '#111'; g.beginPath(); g.ellipse(x - 4 * S2, gh - 31 * S2, 1.8 * S2, 2.8 * S2, 0, 0, TAU); g.ellipse(x + 4 * S2, gh - 31 * S2, 1.8 * S2, 2.8 * S2, 0, 0, TAU); g.fill(); g.restore();
      break;
    }
    case 'k08': {
      if (e < 1.35) {
        const k = clamp(e / 0.35, 0, 1); pvBody(g, cx, gy, sc, { tint: [0.62, 0.86, 1], tk: k * 0.85 });
        g.fillStyle = 'rgba(180,230,255,' + 0.35 * k + ')'; g.strokeStyle = 'rgba(220,245,255,' + 0.8 * k + ')'; g.lineWidth = 1; g.fillRect(cx - 18 * S2, Y(86 * k), 36 * S2, 86 * k * S2); g.strokeRect(cx - 18 * S2, Y(86 * k), 36 * S2, 86 * k * S2);
      } else { const te = e - 1.35; g.globalAlpha = fade; _pvParts(g, 20, cx, Y(30), te, 110, 110, 90, 11, (x, y, i) => { g.fillStyle = i % 2 ? '#bfeaff' : '#e8f8ff'; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 3, y + 2); g.lineTo(x - 3, y + 2); g.fill(); }); g.globalAlpha = 1; }
      break;
    }
    case 'k09': {
      if (e < 0.38 && Math.floor(e * 30) % 3 !== 2) { g.save(); g.strokeStyle = '#eaf3ff'; g.lineWidth = 2; g.shadowColor = '#7fb0ff'; g.shadowBlur = 12; g.beginPath(); g.moveTo(cx + 20, 0); const fr = Math.floor(e * 24); for (let s = 1; s <= 8; s++) g.lineTo(cx + 20 * (1 - s / 8) + (s < 8 ? (_kh(s + fr * 13, 1) - 0.5) * 22 : 0), Y(80) * s / 8); g.stroke(); g.restore(); }
      if (e < 0.3) _pvDot(g, cx, Y(45), 40 * (1 - e / 0.3) + 5, 'rgba(180,210,255,' + 0.5 * (1 - e / 0.3) + ')');
      pvBody(g, cx, gy, sc, { tint: [0.08, 0.08, 0.09], tk: clamp(e / 0.15, 0, 0.95), rot: e > 0.4 ? -_kOut((e - 0.4) / 0.4) * 1.45 : 0, a: fade });
      if (e > 0.25) for (let i = 0; i < 4; i++) { const k = ((e - 0.25) * 0.8 + i / 4) % 1; _pvDot(g, cx + Math.sin(i * 2.4) * 6, Y(20 + k * 70), (6 + k * 10) * S2, 'rgba(90,90,95,' + 0.4 * (1 - k) * fade + ')'); }
      break;
    }
    case 'k10': {
      const cols = { l: PV_BODY.legs, s: PV_BODY.suit, h: PV_BODY.skin, m: PV_BODY.helm };
      let i = 0; const cube = (z, h, c) => { const dl = 0.05 + (1 - h / 76) * 0.55 + _kh(i, 3) * 0.3, te = e - dl; i++; let x = cx + z * S2, y = Y(h), s = 5.2 * S2, col = c;
        if (te > 0) { const k = te / 0.85; if (k >= 1) return; x += (_kh(i, 4) - 0.5) * te * 110; y -= te * (70 + _kh(i, 5) * 70) * S2; s *= 1 - k; col = 'rgba(40,255,230,' + (0.6 + 0.4 * (1 - k)) + ')'; }
        g.fillStyle = col; g.fillRect(x - s / 2, y - s / 2, s, s); };
      for (let h = 2.6; h < 26; h += 5.2) for (const z of [-7.6, -2.4, 2.4, 7.6]) cube(z, h, cols.l);
      for (let h = 28.6; h < 56; h += 5.2) for (let z = -10.4; z <= 10.5; z += 5.2) cube(z, h, h > 48 ? '#1ee3cf' : cols.s);
      for (let h = 59.8; h < 72; h += 5.2) for (const z of [-2.6, 2.6]) cube(z, h, h > 69 ? cols.m : cols.h);
      break;
    }
    case 'k11': {
      const BO = 0.85, bh = u => Math.pow(clamp(u / BO, 0, 1), 2) * 330 * 0.3;
      if (e < BO) { pvBody(g, cx, gy, sc * 0.8, { lift: bh(e) / 0.8, rot: Math.sin(e * 16) * 0.25 }); for (let i = 1; i <= 10; i++) { const tt = e - i * 0.035; if (tt < 0) break; _pvDot(g, cx, Y(bh(tt) - 4), 3.5 - i * 0.25, 'rgba(255,170,60,' + (0.9 - i * 0.08) + ')', 6); } }
      else { const te = e - BO, H0 = Y(bh(BO) + 50); if (te < 0.3) _pvDot(g, cx, H0, 10 + te * 90, 'rgba(255,240,200,' + 0.6 * (1 - te / 0.3) + ')');
        for (let i = 0; i < 40; i++) { const a = _kh(i, 9) * TAU, sp = (i % 2 ? 55 : 38) * (1 - Math.exp(-2.6 * te)), x = cx + Math.cos(a) * sp, y = H0 + Math.sin(a) * sp * 0.8 + 14 * te * te; const fl = te > 0.9 ? (Math.sin(te * 40 + i) > 0 ? 1 : 0.3) : 1; _pvDot(g, x, y, 1.8, PAL[(i % 3) * 2], 6 * fl); } }
      break;
    }
    case 'k12': {
      const HV = 92; let x = cx, h = HV;
      if (e < 0.55) { const k = 1 - _kOut(e / 0.55); x -= 120 * k; h = HV + 60 * k; } else if (e > 2.25) { const k = e - 2.25; x += k * k * 500; h = HV + k * 60; }
      const lift = e > 0.7 ? Math.pow(clamp((e - 0.7) / 1.4, 0, 1), 1.6) * (HV - 20) : 0;
      if (e > 0.55 && e < 2.25) { const gr = g.createLinearGradient(0, Y(HV), 0, gy); gr.addColorStop(0, 'rgba(110,255,150,0.05)'); gr.addColorStop(1, 'rgba(110,255,150,0.3)'); g.fillStyle = gr; g.beginPath(); g.moveTo(cx - 8, Y(HV)); g.lineTo(cx + 8, Y(HV)); g.lineTo(cx + 34, gy); g.lineTo(cx - 34, gy); g.fill(); }
      if (e < 2.12) pvBody(g, cx, gy, sc, { lift, w: 1 - lift / HV * 0.55, sq: 1 - lift / HV * 0.55, rot: Math.sin(lift * 0.1) * 0.3 });
      const y = Y(h); g.fillStyle = 'rgba(140,240,215,0.6)'; g.beginPath(); g.ellipse(x, y - 4, 13, 10, 0, Math.PI, TAU); g.fill();
      g.fillStyle = '#9ea7b3'; g.beginPath(); g.ellipse(x, y, 34, 7, 0, 0, TAU); g.fill(); g.fillStyle = '#69707a'; g.fillRect(x - 22, y + 2, 44, 3);
      for (let i = 0; i < 5; i++) _pvDot(g, x - 24 + i * 12, y + 1, 1.8, (Math.floor(e * 8) + i) % 3 ? '#66ffaa' : '#ffee66', 5);
      break;
    }
    case 'k13': {
      const grow = _kOut(e / 0.4), cl = e > D - 0.35 ? 1 - (e - (D - 0.35)) / 0.35 : 1, rr = 12 * grow * cl, kk = clamp((e - 0.25) / 1.35, 0, 1), ke = kk * kk, cy = Y(50);
      if (kk < 0.98) { g.save(); g.translate(cx, cy); g.rotate(ke * 12); g.translate(-cx, -cy); pvBody(g, cx, gy - ke * (gy - cy) * 0.9, sc, { w: 1 - ke, sq: 1 - ke }); g.restore(); }
      if (rr > 0.5) { g.save(); g.translate(cx, cy); g.rotate(e * 2); for (const [k, c] of [[2.4, 'rgba(255,150,60,0.8)'], [1.8, 'rgba(180,100,255,0.8)']]) { g.strokeStyle = c; g.lineWidth = 2; g.shadowColor = c; g.shadowBlur = 8; g.beginPath(); g.ellipse(0, 0, rr * k, rr * k * 0.35, 0, 0, TAU); g.stroke(); } g.restore();
        _pvDot(g, cx, cy, rr * 1.4, 'rgba(140,60,240,0.35)'); _pvDot(g, cx, cy, rr, '#000');
        for (let i = 0; i < 14; i++) { const k = ((e * 0.7 + _kh(i, 2)) % 1), a = _kh(i, 3) * TAU + e * (3 + k * 6), r = rr + (1 - k) * 45; _pvDot(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.4, 1.5, i % 2 ? '#ffa040' : '#b070ff', 5); } }
      break;
    }
    case 'k14': {
      const TI = 0.55;
      if (e < TI) { pvBody(g, cx, gy, sc); const k = Math.pow(e / TI, 1.25), mx = cx + 110 * (1 - k), my = Y(10 + 160 * (1 - k));
        for (let i = 6; i >= 1; i--) _pvDot(g, mx + i * 6, my - i * 8, 9 - i, 'rgba(255,' + (110 + i * 15) + ',40,' + (0.5 - i * 0.06) + ')', 8);
        _pvDot(g, mx, my, 8, '#5a3a24', 14); g.save(); g.globalCompositeOperation = 'lighter'; _pvDot(g, mx, my, 12, 'rgba(255,130,40,0.5)'); g.restore(); }
      else { const te = e - TI; if (te < 0.45) _pvDot(g, cx, Y(20), 20 + te * 140, 'rgba(255,170,80,' + 0.7 * (1 - te / 0.45) + ')');
        g.fillStyle = 'rgba(15,10,10,' + 0.9 * fade + ')'; g.beginPath(); g.ellipse(cx, gy, 50, 6, 0, 0, TAU); g.fill();
        g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { const fh = (16 + Math.sin(e * 18 + i * 2) * 5) * fade; g.fillStyle = 'rgba(255,120,30,0.7)'; g.beginPath(); g.moveTo(cx - 34 + i * 17 - 5, gy); g.lineTo(cx - 34 + i * 17 + 5, gy); g.lineTo(cx - 34 + i * 17, gy - fh); g.fill(); } g.restore();
        if (te < 1.2) _pvParts(g, 12, cx, Y(10), te, 140, 130, 140, 13, (x, y) => { g.fillStyle = 'rgba(80,55,40,' + (1 - te / 1.2) + ')'; g.fillRect(x - 2, y - 2, 4, 4); }); }
      break;
    }
  }
}

Object.assign(SFX, {
  kconf(o, t) { AU.noise(o, t, 0.12, 'highpass', 2500, 0, 0.9, 1); [784, 988, 1175, 1568].forEach((f, i) => AU.tone(o, t + 0.04 + i * 0.05, 0.25, 'triangle', f, f, 0.18)); AU.tone(o, t, 0.4, 'sawtooth', 300, 900, 0.12, 0.02); },
  kheart(o, t) { [1046, 1318, 1568, 2093].forEach((f, i) => AU.tone(o, t + i * 0.09, 0.5, 'sine', f, f, 0.2)); },
  kinfl(o, t) { AU.tone(o, t, 0.6, 'sine', 180, 620, 0.25, 0.05); AU.noise(o, t, 0.6, 'bandpass', 1500, 3000, 0.25, 3); AU.tone(o, t + 0.65, 1.2, 'sine', 620, 660, 0.06, 0.2); },
  kpop(o, t) { AU.noise(o, t, 0.09, 'highpass', 1800, 0, 1.3, 0.8); AU.tone(o, t, 0.08, 'square', 900, 120, 0.3); },
  kfall(o, t) { AU.tone(o, t, 0.42, 'sine', 2200, 700, 0.18, 0.02); },
  kanvil(o, t) { [523, 1312, 2210, 3170].forEach((f, i) => AU.tone(o, t, 1.1 - i * 0.2, 'triangle', f, f * 0.995, 0.35 - i * 0.06)); AU.noise(o, t, 0.25, 'lowpass', 900, 120, 1.2, 1); AU.tone(o, t, 0.3, 'sine', 110, 50, 0.7); },
  kpoof(o, t) { AU.noise(o, t, 0.35, 'bandpass', 900, 300, 0.8, 1); },
  kcluck(o, t) { [[620, 480], [760, 520], [900, 600]].forEach(([a, b], i) => AU.tone(o, t + i * 0.11, 0.08, 'square', a, b, 0.14)); AU.noise(o, t, 0.3, 'bandpass', 2500, 1500, 0.15, 4); },
  kdig(o, t) { AU.noise(o, t, 0.6, 'lowpass', 600, 120, 1, 1); AU.tone(o, t, 0.4, 'sine', 90, 50, 0.4); },
  ktomb(o, t) { [330, 660, 990, 1320].forEach((f, i) => AU.tone(o, t, 1.6 - i * 0.25, 'sine', f, f, 0.22 - i * 0.04, 0.01)); },
  kghost(o, t) { AU.tone(o, t, 0.9, 'sine', 380, 520, 0.2, 0.25); AU.tone(o, t + 0.8, 0.9, 'sine', 520, 300, 0.2, 0.1); AU.tone(o, t, 1.7, 'triangle', 760, 600, 0.05, 0.3); },
  kfreeze(o, t) { AU.noise(o, t, 0.4, 'highpass', 4500, 0, 0.5, 1); AU.tone(o, t, 0.4, 'sine', 800, 2400, 0.12, 0.02); },
  kshatter(o, t) { AU.noise(o, t, 0.45, 'highpass', 3500, 0, 1, 1); for (let i = 0; i < 6; i++) AU.tone(o, t + i * 0.03, 0.3, 'sine', rand(2200, 4200), rand(1800, 3800), 0.1); },
  kthunder(o, t) { AU.noise(o, t, 0.15, 'highpass', 2500, 0, 1.2, 0.8); AU.noise(o, t + 0.05, 1.6, 'lowpass', 900, 60, 1.5, 0.6); AU.tone(o, t, 1.2, 'sine', 70, 30, 0.8); },
  kpixel(o, t) { for (let i = 0; i < 10; i++) AU.tone(o, t + i * 0.07, 0.06, 'square', [880, 1320, 660, 1760, 990][i % 5], 0, 0.1); },
  kwhizz(o, t) { AU.tone(o, t, 0.85, 'sine', 500, 2600, 0.15, 0.02); AU.noise(o, t, 0.85, 'bandpass', 1200, 4000, 0.3, 2); },
  kfw(o, t) { AU.noise(o, t, 0.7, 'lowpass', 2500, 100, 1.4, 0.6); AU.tone(o, t, 0.5, 'sine', 90, 35, 0.8); for (let i = 0; i < 9; i++) AU.noise(o, t + 0.25 + i * 0.09 + Math.random() * 0.04, 0.05, 'highpass', 3000, 0, 0.5, 1); },
  kufo(o, t) { for (let i = 0; i < 14; i++) AU.tone(o, t + i * 0.16, 0.18, 'sine', i % 2 ? 520 : 760, i % 2 ? 600 : 680, 0.14, 0.03); AU.tone(o, t + 0.55, 1.7, 'sawtooth', 120, 160, 0.06, 0.2); },
  kvoid(o, t) { AU.tone(o, t, 1.8, 'sine', 260, 40, 0.45, 0.1); AU.noise(o, t, 1.8, 'lowpass', 1200, 80, 0.7, 0.6); AU.tone(o, t + 2.2, 0.4, 'sine', 900, 200, 0.2); },
  kmeteor(o, t) { AU.noise(o, t, 0.55, 'bandpass', 300, 1400, 0.9, 1.5); AU.tone(o, t, 0.55, 'sawtooth', 120, 60, 0.2, 0.05); }
});
