/* =====================================================================
   02b · MAĞAZA MÜZİĞİ: satın alma süresince doğuş alanındaki hoparlörden
   çalan, tamamen sentezlenmiş (özgün) hareketli elektronik parça.
   Zincir: enstrümanlar → [fade] → PA hoparlör tınısı (bant geçiren + hafif
   distorsiyon) → kuru ses (mesafe/stereo) + geri yankı (delay) + oda yankısı (reverb)
   ===================================================================== */
const MUS = {
  vol: 0.75, on: false, n: null, step: 0, nextT: 0, t0: 0, riser: false, endT: 0, BPM: 138, tr: 0,
  /* 3 parça: her raunt sıradaki çalar (herkes aynı parçayı duyar) */
  TRACKS: [
    { name: 'NEON BASKIN', style: 'neon', bpm: 138 },
    { name: 'KIZIL NABIZ', style: 'house', bpm: 124,
      // Fm – Db – Ab – Eb
      prog: [[41, [53, 56, 60]], [37, [53, 56, 61]], [44, [51, 56, 60]], [39, [51, 55, 58]]],
      lead: [77, 0, 80, 84, 0, 80, 77, 0, 73, 0, 77, 80, 0, 82, 80, 77, 75, 0, 80, 84, 0, 87, 84, 0, 82, 0, 79, 75, 0, 79, 82, 0] },
    { name: 'SİBER AKIN', style: 'dnb', bpm: 164,
      // Em – C – Am – B
      prog: [[40, [55, 59, 64]], [36, [55, 60, 64]], [45, [57, 60, 64]], [35, [54, 59, 63]]],
      lead: [71, 0, 74, 76, 0, 79, 0, 76, 76, 0, 72, 0, 67, 0, 72, 74, 72, 0, 76, 0, 81, 0, 79, 76, 75, 0, 78, 0, 81, 0, 83, 0] }
  ],
  // Am – F – C – G (her ölçü bir akor): bas kökü ve akor notaları (MIDI)
  PROG: [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]]],
  // 4 ölçülük ana melodi, sekizlik notalar (0 = sus/uzat)
  LEAD: [76, 0, 72, 0, 74, 76, 0, 79, 77, 0, 76, 0, 72, 0, 69, 0, 72, 0, 76, 0, 79, 0, 84, 83, 79, 0, 74, 0, 71, 74, 79, 0],
  hz(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  curve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; },
  impulse(c, sec) {
    const sr = c.sampleRate, len = Math.floor(sr * sec), b = c.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.4) * 0.55; }
      // sert duvarlardan erken yansımalar (spawn alanı hissi)
      for (const [ms, a] of [[19, 0.7], [37, 0.5], [61, 0.42], [89, 0.3], [131, 0.22]]) { const k = Math.floor(sr * (ms + ch * 4) / 1000); if (k < len) d[k] += a; }
    }
    return b;
  },
  build(c, dest) {
    const n = { c };
    n.inp = c.createGain(); n.inp.gain.value = 0;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 95; hp.Q.value = 0.8;
    const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1800; pk.gain.value = 5; pk.Q.value = 1.1;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5600; lp.Q.value = 0.8;
    const sh = c.createWaveShaper(); sh.curve = this.curve(1.8);
    n.inp.connect(hp); hp.connect(pk); pk.connect(lp); lp.connect(sh);
    n.out = c.createGain(); n.out.gain.value = this.vol * 0.7; n.out.connect(dest);
    n.pos = c.createGain(); n.pos.gain.value = 1;
    // uzaklaştıkça boğuklaşma (duvarların arkasından gelen ses gibi)
    n.far = c.createBiquadFilter(); n.far.type = 'lowpass'; n.far.frequency.value = 16000; n.far.Q.value = 0.5; n.pos.connect(n.far);
    if (c.createStereoPanner) { n.pan = c.createStereoPanner(); n.far.connect(n.pan); n.pan.connect(n.out); } else n.far.connect(n.out);
    const dry = c.createGain(); dry.gain.value = 0.62; sh.connect(dry); dry.connect(n.pos);
    // geri yankı: ~1/8 nota gecikmeli, her tekrarda kararan
    const dl = c.createDelay(1.5); dl.delayTime.value = 60 / this.BPM * 0.75; n.dl = dl;
    const fb = c.createGain(); fb.gain.value = 0.36;
    const df = c.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 2400;
    const dw = c.createGain(); dw.gain.value = 0.3;
    sh.connect(dl); dl.connect(df); df.connect(fb); fb.connect(dl); df.connect(dw); dw.connect(n.pos);
    // oda yankısı (konumdan bağımsız, her yerden gelir)
    const cv = c.createConvolver(); cv.buffer = this.impulse(c, 3.6);
    n.wet = c.createGain(); n.wet.gain.value = 0.5; // (mesafeye göre update() ayarlar)
    sh.connect(cv); cv.connect(n.wet); n.wet.connect(n.out);
    if (!this.noise || this.noise.sampleRate !== c.sampleRate) {
      const len = c.sampleRate; this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return n;
  },
  /* ---- enstrümanlar ---- */
  env(c, t, a, peak, dur) { const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); return g; },
  osc(c, type, f, t, dur, out, det) { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (det) o.detune.value = det; o.connect(out); o.start(t); o.stop(t + dur + 0.05); return o; },
  nz(c, t, dur, ftype, f0, f1, peak, out, q) {
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 0.8;
    const g = this.env(c, t, 0.002, peak, dur); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },
  kick(n, t, v) {
    const c = n.c, o = c.createOscillator(), g = this.env(c, t, 0.002, 0.95 * v, 0.42);
    o.type = 'sine'; o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.13);
    o.connect(g); g.connect(n.inp); o.start(t); o.stop(t + 0.47);
    this.nz(c, t, 0.02, 'highpass', 3000, 0, 0.25 * v, n.inp);
  },
  clap(n, t, v) { for (let i = 0; i < 3; i++) this.nz(n.c, t + i * 0.011, i === 2 ? 0.17 : 0.03, 'bandpass', 1300, 0, 0.5 * v, n.inp, 0.9); },
  hat(n, t, v, open) { this.nz(n.c, t, open ? 0.2 : 0.045, 'highpass', 7500, 0, (open ? 0.2 : 0.13) * v, n.inp); },
  snare(n, t, v) { this.nz(n.c, t, 0.13, 'bandpass', 1900, 900, 0.62 * v, n.inp, 0.7); this.tone(n, t, 0.08, 'triangle', 230, 0.28 * v); },
  tone(n, t, dur, type, f, peak) { const g = this.env(n.c, t, 0.004, peak, dur); g.connect(n.inp); this.osc(n.c, type, f, t, dur, g); },
  bass(n, t, m, dur) {
    const c = n.c, f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(1500, t); f.frequency.exponentialRampToValueAtTime(260, t + dur);
    const g = this.env(c, t, 0.005, 0.42, dur); f.connect(g); g.connect(n.inp);
    this.osc(c, 'sawtooth', this.hz(m), t, dur, f); this.osc(c, 'square', this.hz(m - 12), t, dur, f);
  },
  arp(n, t, m, bright) {
    const c = n.c, f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(900 + 3200 * bright, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.11);
    const g = this.env(c, t, 0.003, 0.11, 0.12); f.connect(g); g.connect(n.inp); this.osc(c, 'square', this.hz(m), t, 0.12, f);
  },
  lead(n, t, m, dur) {
    const c = n.c, f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 4200; f.Q.value = 1;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11, t + 0.012);
    g.gain.setValueAtTime(0.11, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(g); g.connect(n.inp);
    for (const d of [-9, 9]) this.osc(c, 'sawtooth', this.hz(m), t, dur, f, d);
  },
  pad(n, t, notes, dur) {
    const c = n.c, g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.35); g.gain.setValueAtTime(0.05, t + dur - 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200; f.connect(g); g.connect(n.inp);
    for (const m of notes) this.osc(c, 'sawtooth', this.hz(m), t, dur, f, (Math.random() - 0.5) * 14);
  },
  crash(n, t) { this.nz(n.c, t, 2.2, 'highpass', 4200, 0, 0.32, n.inp); this.nz(n.c, t, 0.9, 'bandpass', 700, 200, 0.25, n.inp); },
  riserFx(n, t, dur) {
    const c = n.c, s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(7500, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45, t + dur);
    s.connect(f); f.connect(g); g.connect(n.inp); s.start(t); s.stop(t + dur + 0.05);
  },
  /* house akor vuruşu (kısa, filtreli testere akor) */
  stab(n, t, notes, v) {
    const c = n.c, f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(3800 * v + 600, t); f.frequency.exponentialRampToValueAtTime(420, t + 0.16);
    const g = this.env(c, t, 0.003, 0.085, 0.2); f.connect(g); g.connect(n.inp);
    for (const m of notes) for (const d of [-7, 7]) this.osc(c, 'sawtooth', this.hz(m + 12), t, 0.2, f, d);
  },
  pluck(n, t, m, dur) {
    const c = n.c, f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(5200, t); f.frequency.exponentialRampToValueAtTime(700, t + Math.min(dur, 0.35));
    const g = this.env(c, t, 0.004, 0.13, Math.max(0.15, dur)); f.connect(g); g.connect(n.inp);
    this.osc(c, 'square', this.hz(m), t, dur, f, -5); this.osc(c, 'sawtooth', this.hz(m), t, dur, f, 6);
  },
  /* titreşimli kare dalga lead */
  vib(n, t, m, dur) {
    const c = n.c, o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), f = c.createBiquadFilter();
    o.type = 'square'; o.frequency.setValueAtTime(this.hz(m), t);
    lfo.frequency.value = 6.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(this.hz(m) * 0.012, t + Math.min(dur, 0.25));
    lfo.connect(lg); lg.connect(o.frequency);
    f.type = 'lowpass'; f.frequency.value = 3600;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.085, t + 0.015); g.gain.setValueAtTime(0.085, t + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(n.inp);
    o.start(t); o.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
  },
  /* kalın, birbirine göre kaydırılmış testere bas (reese) */
  reese(n, t, m, dur) {
    const c = n.c, f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 7;
    f.frequency.setValueAtTime(220, t); f.frequency.linearRampToValueAtTime(950, t + dur * 0.5); f.frequency.linearRampToValueAtTime(260, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.21, t + 0.02); g.gain.setValueAtTime(0.21, t + dur * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(g); g.connect(n.inp);
    for (const d of [-14, 0, 14]) this.osc(c, 'sawtooth', this.hz(m), t, dur, f, d);
    this.osc(c, 'sine', this.hz(m - 12), t, dur, g);
  },
  /* ortak son iki ölçü: trampet rulosu + yükselen ses */
  buildUp(n, t, left, barDur, sd, lastBar) {
    const k = 1 - left / (barDur * 2);
    this.snare(n, t, 0.3 + 0.7 * k);
    if (lastBar) this.snare(n, t + sd / 2, 0.35 + 0.65 * k);
    if (!this.riser && left > 0.4) { this.riser = true; this.riserFx(n, t, left); }
  },
  /* PARÇA 2 — KIZIL NABIZ (124 BPM house): dörtlük davul, ters vuruş bas, senkoplu akorlar */
  schedHouse(n, s, t, left) {
    const T = this.TRACKS[1], sd = 60 / this.BPM / 4, bar = Math.floor(s / 16), st = s % 16, beat = st % 4 === 0;
    const [root, ch] = T.prog[bar % 4], barDur = sd * 16;
    const build = left < barDur * 2, lastBar = left < barDur, full = bar >= 2;
    if (st === 0 && !lastBar && bar >= 1) this.pad(n, t, ch, Math.min(barDur, Math.max(0.3, left)));
    if (beat && !lastBar) this.kick(n, t, bar === 0 ? 0.7 : 1);
    if (full && (st === 4 || st === 12) && !build) this.clap(n, t, 0.9);
    if (st % 4 === 2) this.hat(n, t, bar === 0 ? 0.5 : 1, bar >= 1 && !build);
    else this.hat(n, t, 0.35, false);
    if (build) this.buildUp(n, t, left, barDur, sd, lastBar);
    if (bar >= 1 && st % 4 === 2 && !lastBar) this.bass(n, t, root + (st === 14 ? 12 : 0), sd * 1.7);
    if (full && (st === 3 || st === 6 || st === 10) && !lastBar) this.stab(n, t, ch, build ? 1 : 0.6);
    if (bar >= 3 && !build && st % 2 === 0) {
      const i = ((bar - 3) % 4) * 8 + st / 2, m = T.lead[i];
      if (m) { let len = 1; while (len < 3 && !T.lead[(i + len) % 32]) len++; this.pluck(n, t, m, sd * 2 * len * 0.9); }
    }
  },
  /* PARÇA 3 — SİBER AKIN (164 BPM drum & bass): kırık davul, kalın reese bas, titreşimli lead */
  schedDnb(n, s, t, left) {
    const T = this.TRACKS[2], sd = 60 / this.BPM / 4, bar = Math.floor(s / 16), st = s % 16;
    const [root, ch] = T.prog[bar % 4], barDur = sd * 16;
    const build = left < barDur * 2, lastBar = left < barDur, full = bar >= 2;
    if (st === 0 && !lastBar) this.pad(n, t, ch, Math.min(barDur, Math.max(0.3, left)));
    if ((st === 0 || st === 10) && !lastBar && (bar >= 1 || st === 0)) this.kick(n, t, 1);
    if (full && (st === 4 || st === 12) && !build) { this.snare(n, t, 1); this.clap(n, t, 0.5); }
    if (st % 2 === 0) this.hat(n, t, 0.8, false); else if (full) this.hat(n, t, 0.3, false);
    if (full && st === 14 && !build) this.hat(n, t, 0.9, true);
    if (build) this.buildUp(n, t, left, barDur, sd, lastBar);
    if (bar >= 1 && (st === 0 || st === 8) && !lastBar) this.reese(n, t, root + 12, Math.min(sd * 7.6, Math.max(0.2, left - 0.05)));
    const ar = [0, 1, 2, 3, 2, 1][st % 6], am = ar === 3 ? ch[0] + 12 : ch[ar];
    if (bar >= 1 && st % 2 === 1) this.arp(n, t, am + 12, build ? 1 : 0.5);
    if (bar >= 3 && !build && st % 2 === 0) {
      const i = ((bar - 3) % 4) * 8 + st / 2, m = T.lead[i];
      if (m) { let len = 1; while (len < 4 && !T.lead[(i + len) % 32]) len++; this.vib(n, t, m, sd * 2 * len * 0.95); }
    }
  },
  /* tek 16'lık adım. left: satın alma bitimine kalan süre (sn) */
  sched(n, s, t, left) {
    if (this.tr === 1) return this.schedHouse(n, s, t, left);
    if (this.tr === 2) return this.schedDnb(n, s, t, left);
    const sd = 60 / this.BPM / 4, bar = Math.floor(s / 16), st = s % 16, beat = st % 4 === 0;
    const [root, ch] = this.PROG[bar % 4], barDur = sd * 16;
    const build = left < barDur * 2, lastBar = left < barDur;
    const full = bar >= 2;
    if (st === 0 && !lastBar) this.pad(n, t, ch, Math.min(barDur, Math.max(0.3, left)));
    // davul
    if (beat && (full || bar === 1 && st === 0) && !lastBar) this.kick(n, t, 1);
    if (full && (st === 4 || st === 12) && !build) this.clap(n, t, 1);
    if (st % 2 === 0) this.hat(n, t, bar === 0 ? 0.5 : 0.9, false); else if (full) this.hat(n, t, 0.45, false);
    if (full && st % 4 === 2 && !build) this.hat(n, t, 1, true);
    // son iki ölçü: trampet rulosu (16'lık → 32'lik), yükselen ses
    if (build) {
      const k = 1 - left / (barDur * 2);
      this.snare(n, t, 0.3 + 0.7 * k);
      if (lastBar) this.snare(n, t + sd / 2, 0.35 + 0.65 * k);
      if (!this.riser && left > 0.4) { this.riser = true; this.riserFx(n, t, left); }
    }
    // bas: vuruş arasında yuvarlanan 16'lıklar
    if (bar >= 1 && !beat && !lastBar) this.bass(n, t, root + (st % 4 === 3 ? 12 : 0), sd * 0.9);
    // arpej
    const ar = [0, 1, 2, 1, 0, 1, 2, 3][st % 8], am = ar === 3 ? ch[0] + 12 : ch[ar];
    this.arp(n, t, am + 12, build ? 1 : bar === 0 ? 0.15 : Math.min(1, 0.4 + bar * 0.12));
    // melodi (3. ölçüden sonra)
    if (bar >= 3 && !build && st % 2 === 0) {
      const i = ((bar - 3) % 4) * 8 + st / 2, m = this.LEAD[i];
      if (m) { let len = 1; while (len < 4 && !this.LEAD[(i + len) % 32]) len++; this.lead(n, t, m, sd * 2 * len * 0.95); }
    }
  },
  /* mağaza bitip raunt başlayınca: darbe + bir sonraki ölçünün başından tam düzen (drop) */
  drop() {
    const n = this.n, c = AU.ctx; if (!n || !c) return;
    const now = c.currentTime;
    this.kick(n, now + 0.02, 1.2); this.crash(n, now + 0.02);
    this.step = (Math.floor(this.step / 16) + 1) * 16; if (this.step < 32) this.step = 32;
    this.nextT = now + 0.02;
  },
  start(left) {
    const c = AU.ctx; if (!c) return;
    if (!this.n) this.n = this.build(c, AU.master);
    const n = this.n, now = c.currentTime;
    // raunda göre parça seç (her istemcide aynı)
    this.tr = Math.max(0, ((S && S.round) || 1) - 1) % this.TRACKS.length;
    this.BPM = this.TRACKS[this.tr].bpm;
    if (n.dl) n.dl.delayTime.setValueAtTime(60 / this.BPM * 0.75, now);
    if (S && S.phase === 'buy' && typeof UIS !== 'undefined') { UIS.msgs.push({ text: '♪ ' + this.TRACKS[this.tr].name, col: '#ffd166', t: 3 }); if (UIS.msgs.length > 4) UIS.msgs.shift(); }
    n.inp.gain.cancelScheduledValues(now); n.inp.gain.setValueAtTime(Math.max(0.0001, n.inp.gain.value), now); n.inp.gain.linearRampToValueAtTime(1, now + 0.4);
    this.on = true; this.step = 0; this.nextT = now + 0.08; this.t0 = this.nextT; this.riser = false;
  },
  stop(hit) {
    if (!this.on) return; this.on = false;
    const n = this.n, c = AU.ctx; if (!n || !c) return;
    const now = c.currentTime;
    if (hit) { this.kick(n, now + 0.02, 1.2); this.crash(n, now + 0.02); this.tone(n, now + 0.02, 1.2, 'sine', 55, 0.5); }
    // kuru ses kısılır; yankı ve geri yankı kuyrukları doğal olarak söner
    n.inp.gain.cancelScheduledValues(now); n.inp.gain.setValueAtTime(Math.max(0.0001, n.inp.gain.value), now + (hit ? 0.25 : 0));
    n.inp.gain.linearRampToValueAtTime(0, now + (hit ? 1.6 : 0.6));
  },
  setVol(v) { this.vol = v; if (this.n) this.n.out.gain.value = v * 0.7; },
  /* doğuştaki hoparlöre göre mesafe ve stereo */
  speaker(L) {
    const sp = MAPDATA && MAPDATA.speakers; if (!sp || !sp.length) return null;
    let best = sp[0], bd = 1e9; for (const s of sp) { const d = dist(L.x, L.y, s.x, s.y); if (d < bd) { bd = d; best = s; } }
    return { s: best, d: bd };
  },
  pump() { if (!this.on || !AU.ctx) return 0; const b = 60 / this.BPM, ph = ((AU.ctx.currentTime - this.t0) / b) % 1; return ph < 0 ? 0 : Math.exp(-ph * 7); },
  /* her karede ana döngüden çağrılır */
  update() {
    const c = AU.ctx; if (!c) return;
    const me = S && S.pmap[G.myId];
    // satın alma + raunt boyunca çalar; raunt bitince susar, sonraki mağazada yeniden başlar
    const want = !!(G.running && S && (S.phase === 'buy' || S.phase === 'live' || S.phase === 'planted') && me && this.vol > 0.001 && AU.enabled && !G.bye);
    if (want && !this.on) { if (S.phase !== 'buy' || S.phaseT > 2.5) { this.start(); this._ph = S.phase; } else return; }
    if (!want) { if (this.on) this.stop(false); this._ph = null; return; }
    if (this._ph === 'buy' && S.phase === 'live') this.drop();
    this._ph = S.phase;
    const n = this.n, L = audioListener(), now = c.currentTime;
    const sk = this.speaker(L);
    if (sk) {
      // hoparlöre yakınken tam ses; uzaklaştıkça hızla azalır (kuru ses çok daha hızlı düşer),
      // yankı oranı artar ve ses boğuklaşır; ~45 m'den sonra hiç duyulmaz
      const NEAR = 200, FAR = 1800, x = clamp((sk.d - NEAR) / (FAR - NEAR), 0, 1);
      const g = Math.pow(1 - x, 2.8), wet = 0.3 * (1 + 1.8 * x) * Math.pow(1 - x, 1.15);
      n.pos.gain.setTargetAtTime(g, now, 0.15);
      n.wet.gain.setTargetAtTime(wet, now, 0.15);
      n.far.frequency.setTargetAtTime(16000 * Math.pow(1 - x, 2.2) + 650, now, 0.15);
      if (n.pan) n.pan.pan.setTargetAtTime(sk.d > 30 ? clamp(Math.sin(angDiff(L.ang || 0, Math.atan2(sk.s.y - L.y, sk.s.x - L.x))), -1, 1) * 0.65 : 0, now, 0.08);
    }
    if (this.nextT < now - 0.3) this.nextT = now + 0.02; // sekme arka plandaydıysa
    const sd = 60 / this.BPM / 4;
    while (this.nextT < now + 0.2) {
      const left = S.phase === 'buy' ? S.phaseT - (this.nextT - now) : Infinity;
      if (left <= 0.02) break;
      this.sched(n, this.step, this.nextT, left);
      this.step++; this.nextT += sd;
    }
  }
};
