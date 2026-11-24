/* =====================================================================
   02 · SES: Web Audio API ile tamamen sentezlenmiş efektler
   ===================================================================== */
const AU = {
  ctx: null, master: null, comp: null, noiseBuf: null, enabled: true, vol: 0.55, lastPlay: {},
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = this.vol;
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.ratio.value = 6;
      this.master.connect(this.comp); this.comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setEnabled(v) { this.enabled = v; if (this.master) this.master.gain.value = v ? this.vol : 0; },
  out(gain, pan) {
    const g = this.ctx.createGain(); g.gain.value = gain;
    if (this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.master); }
    else g.connect(this.master);
    return g;
  },
  noise(out, t0, dur, ftype, f0, f1, g0, q) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(f0, t0);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    f.Q.value = q || 1;
    const g = c.createGain(); g.gain.setValueAtTime(g0, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.03);
  },
  tone(out, t0, dur, type, f0, f1, g0, attack) {
    const c = this.ctx, o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    const g = c.createGain(), a = attack || 0.004;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(g0, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.03);
  },
  /* x,y verilirse dinleyiciye göre konumsal (mesafe + stereo) çalar */
  play(name, x, y, vol, own) {
    if (!this.ctx || !this.enabled) return;
    const fn = SFX[name]; if (!fn) return;
    let g = vol === undefined ? 1 : vol, pan = 0;
    if (x !== undefined && x !== null) {
      const L = audioListener();
      const d = dist(L.x, L.y, x, y);
      if (d > 2300) return;
      g *= 1 / (1 + d / 380);
      pan = d > 8 ? clamp(Math.sin(angDiff(L.ang || 0, Math.atan2(y - L.y, x - L.x))), -1, 1) * 0.9 : 0;
      if (L.deaf && !own) g *= 0.05;
    }
    if (g < 0.012) return;
    const key = name + ((x | 0) >> 4) + ':' + ((y | 0) >> 4);
    const now = this.ctx.currentTime;
    if (this.lastPlay[key] && now - this.lastPlay[key] < 0.012) return;
    this.lastPlay[key] = now;
    try { fn(this.out(g, pan), now + 0.004); } catch (e) { /* ses hatası oyunu durdurmasın */ }
  }
};
const SFX = {
  classic(o, t) { AU.noise(o, t, 0.09, 'bandpass', 2600, 900, 0.9, 0.8); AU.tone(o, t, 0.06, 'square', 320, 90, 0.25); },
  sheriff(o, t) { AU.noise(o, t, 0.24, 'lowpass', 3500, 380, 1.2, 0.7); AU.tone(o, t, 0.2, 'sine', 160, 42, 0.75); },
  spectre(o, t) { AU.noise(o, t, 0.06, 'highpass', 1400, 0, 0.7, 0.7); AU.tone(o, t, 0.045, 'square', 420, 150, 0.16); },
  vandal(o, t) { AU.noise(o, t, 0.14, 'bandpass', 1700, 480, 1.1, 0.9); AU.tone(o, t, 0.1, 'sawtooth', 200, 66, 0.36); },
  phantom(o, t) { AU.noise(o, t, 0.07, 'bandpass', 4200, 2000, 0.42, 1.5); AU.tone(o, t, 0.03, 'triangle', 900, 300, 0.12); },
  railgun(o, t) { AU.tone(o, t, 0.5, 'sawtooth', 1400, 3200, 0.3); AU.noise(o, t, 0.5, 'bandpass', 4200, 900, 1.3, 0.8); AU.tone(o, t, 0.6, 'sine', 90, 30, 1); AU.tone(o, t + 0.02, 0.35, 'square', 2400, 600, 0.12); },
  operator(o, t) { AU.noise(o, t, 0.6, 'lowpass', 2600, 180, 1.4, 0.7); AU.tone(o, t, 0.5, 'sine', 110, 28, 0.95); AU.noise(o, t, 0.05, 'highpass', 3000, 0, 0.8, 1); },
  turret(o, t) { AU.tone(o, t, 0.06, 'square', 900, 480, 0.18); AU.noise(o, t, 0.04, 'highpass', 3000, 0, 0.3, 1); },
  reload(o, t) { AU.tone(o, t, 0.03, 'square', 1500, 1200, 0.14); AU.tone(o, t + 0.2, 0.04, 'square', 900, 800, 0.14); AU.noise(o, t + 0.34, 0.05, 'bandpass', 2000, 0, 0.3, 3); },
  empty(o, t) { AU.tone(o, t, 0.03, 'square', 2200, 1800, 0.12); },
  hit(o, t) { AU.tone(o, t, 0.05, 'triangle', 1300, 1100, 0.32); },
  hs(o, t) { AU.tone(o, t, 0.12, 'triangle', 2100, 2000, 0.45); AU.tone(o, t, 0.2, 'sine', 3150, 3100, 0.2); },
  kill(o, t) { AU.tone(o, t, 0.12, 'triangle', 880, 880, 0.35); AU.tone(o, t + 0.08, 0.22, 'triangle', 1320, 1320, 0.35); },
  hurt(o, t) { AU.tone(o, t, 0.12, 'sawtooth', 180, 90, 0.3); AU.noise(o, t, 0.08, 'lowpass', 800, 200, 0.4, 1); },
  step(o, t) { AU.noise(o, t, 0.06, 'lowpass', 380, 200, 0.5, 1); },
  dash(o, t) { AU.noise(o, t, 0.28, 'bandpass', 400, 2400, 0.9, 1.2); },
  invis(o, t) { AU.tone(o, t, 0.5, 'sine', 600, 1800, 0.15, 0.05); AU.tone(o, t, 0.5, 'sine', 900, 2700, 0.08, 0.05); },
  blade(o, t) { AU.noise(o, t, 0.8, 'bandpass', 300, 3000, 1, 2); AU.tone(o, t, 0.9, 'sawtooth', 90, 600, 0.35, 0.05); },
  throw(o, t) { AU.noise(o, t, 0.15, 'bandpass', 800, 1600, 0.4, 1); },
  flash(o, t) { AU.tone(o, t, 0.35, 'sine', 900, 3600, 0.4); AU.noise(o, t, 0.4, 'highpass', 2000, 0, 0.6, 1); },
  fire(o, t) { AU.noise(o, t, 0.9, 'bandpass', 900, 300, 0.7, 0.6); AU.tone(o, t, 0.6, 'sawtooth', 70, 40, 0.25, 0.1); },
  rebirth(o, t) { [440, 554, 659, 880].forEach((f, i) => AU.tone(o, t + i * 0.07, 0.6, 'triangle', f, f * 1.01, 0.25)); AU.noise(o, t, 0.8, 'bandpass', 600, 2500, 0.5, 1); },
  smoke(o, t) { AU.noise(o, t, 0.9, 'lowpass', 900, 150, 0.7, 0.6); },
  poison(o, t) { AU.noise(o, t, 0.8, 'bandpass', 500, 250, 0.5, 4); AU.tone(o, t, 0.5, 'sine', 140, 90, 0.25); },
  nightmare(o, t) { AU.noise(o, t, 1.6, 'lowpass', 500, 80, 0.9, 0.5); AU.tone(o, t, 1.5, 'sawtooth', 55, 40, 0.35, 0.3); AU.tone(o, t, 1.5, 'sawtooth', 82, 60, 0.25, 0.3); },
  mine(o, t) { AU.tone(o, t, 0.06, 'square', 1800, 1800, 0.25); AU.tone(o, t + 0.12, 0.06, 'square', 1800, 1800, 0.25); },
  place(o, t) { AU.tone(o, t, 0.08, 'square', 500, 700, 0.2); AU.noise(o, t, 0.06, 'bandpass', 1500, 0, 0.3, 2); },
  boom(o, t) { AU.noise(o, t, 0.8, 'lowpass', 2000, 90, 1.4, 0.6); AU.tone(o, t, 0.6, 'sine', 90, 30, 0.9); },
  bigboom(o, t) { AU.noise(o, t, 2.2, 'lowpass', 3000, 40, 1.6, 0.5); AU.tone(o, t, 1.8, 'sine', 70, 20, 1); },
  lock(o, t) { AU.tone(o, t, 1.0, 'sawtooth', 70, 40, 0.5, 0.05); AU.tone(o, t, 0.6, 'square', 440, 220, 0.2); AU.noise(o, t, 1, 'lowpass', 800, 100, 0.6, 1); },
  lockbeep(o, t) { AU.tone(o, t, 0.1, 'square', 1000, 1000, 0.25); },
  sonar(o, t) { AU.tone(o, t, 0.9, 'sine', 1250, 1150, 0.4, 0.01); AU.tone(o, t + 0.25, 0.6, 'sine', 1250, 1150, 0.15, 0.01); },
  shock(o, t) { AU.noise(o, t, 0.5, 'bandpass', 2500, 400, 1, 1.5); AU.tone(o, t, 0.3, 'square', 300, 60, 0.4); },
  laserwarn(o, t) { AU.tone(o, t, 1.1, 'sine', 300, 1200, 0.3, 0.2); },
  laser(o, t) { AU.tone(o, t, 0.7, 'sawtooth', 160, 60, 0.6); AU.noise(o, t, 0.7, 'lowpass', 3000, 200, 1, 0.7); },
  tsphere(o, t) { [0, 0.25, 0.5].forEach(d => AU.tone(o, t + d, 0.12, 'triangle', 1500, 1400, 0.2)); AU.tone(o, t, 0.8, 'sine', 220, 440, 0.2, 0.1); },
  tp(o, t) { AU.tone(o, t, 0.25, 'sine', 300, 1800, 0.4); AU.noise(o, t, 0.2, 'highpass', 3000, 0, 0.3, 1); },
  collapse(o, t) { AU.tone(o, t, 1.4, 'sine', 600, 80, 0.5, 0.05); AU.tone(o, t, 1.4, 'triangle', 900, 120, 0.25, 0.05); },
  quake(o, t) { AU.noise(o, t, 0.7, 'lowpass', 400, 60, 1.2, 0.8); AU.tone(o, t, 0.5, 'sine', 60, 30, 0.7); },
  stone(o, t) { AU.noise(o, t, 0.6, 'lowpass', 700, 100, 1, 1); AU.noise(o, t + 0.1, 0.2, 'bandpass', 2000, 800, 0.4, 2); },
  rift(o, t) { AU.noise(o, t, 1.4, 'lowpass', 600, 50, 1.4, 0.6); AU.tone(o, t, 1.2, 'sawtooth', 45, 25, 0.6, 0.05); },
  heal(o, t) { [523, 659, 784].forEach((f, i) => AU.tone(o, t + i * 0.08, 0.4, 'triangle', f, f, 0.25)); },
  ice(o, t) { AU.noise(o, t, 0.5, 'highpass', 5000, 0, 0.4, 1); [2093, 2637].forEach((f, i) => AU.tone(o, t + i * 0.05, 0.3, 'sine', f, f, 0.12)); },
  revive(o, t) { [392, 523, 659, 784, 1046].forEach((f, i) => AU.tone(o, t + i * 0.09, 0.7, 'triangle', f, f, 0.25)); },
  zap(o, t) { for (let i = 0; i < 5; i++) AU.tone(o, t + i * 0.025, 0.04, 'sawtooth', rand(400, 1600), rand(200, 800), 0.25); AU.noise(o, t, 0.15, 'highpass', 2500, 0, 0.5, 1); },
  boost(o, t) { AU.tone(o, t, 0.4, 'sawtooth', 200, 900, 0.3); AU.noise(o, t, 0.3, 'bandpass', 1000, 3000, 0.4, 1); },
  overload(o, t) { AU.tone(o, t, 1.0, 'sawtooth', 100, 800, 0.45, 0.05); AU.tone(o, t, 1.0, 'square', 150, 1200, 0.2, 0.05); },
  beam(o, t) { AU.tone(o, t, 0.12, 'sawtooth', rand(700, 900), rand(300, 500), 0.18); AU.noise(o, t, 0.1, 'highpass', 3000, 0, 0.25, 1); },
  deaf(o, t) { AU.tone(o, t, 0.5, 'sine', 120, 60, 0.6); AU.tone(o, t, 1.2, 'sine', 4000, 3900, 0.08, 0.1); },
  wolf(o, t) { AU.tone(o, t, 0.9, 'sine', 320, 620, 0.35, 0.15); AU.tone(o, t + 0.4, 0.6, 'sine', 620, 280, 0.3, 0.05); },
  shroud(o, t) { AU.tone(o, t, 1.6, 'sawtooth', 110, 55, 0.4, 0.2); AU.noise(o, t, 1.6, 'lowpass', 300, 60, 0.6, 0.5); },
  ult(o, t) { [220, 277, 330].forEach(f => AU.tone(o, t, 1.0, 'sawtooth', f, f * 2, 0.12, 0.1)); },
  sword(o, t) { AU.noise(o, t, 0.2, 'bandpass', 900, 3800, 0.75, 1.4); AU.tone(o, t, 0.12, 'sine', 500, 1300, 0.1, 0.02); },
  swordhit(o, t) { AU.noise(o, t, 0.12, 'lowpass', 1600, 300, 0.9, 1); AU.tone(o, t, 0.25, 'triangle', 1800, 1500, 0.2); AU.tone(o, t, 0.4, 'sine', 2600, 2550, 0.12); },
  jump(o, t) { AU.noise(o, t, 0.08, 'lowpass', 500, 220, 0.45, 1); },
  land(o, t) { AU.noise(o, t, 0.1, 'lowpass', 420, 120, 0.6, 1); },
  card(o, t) { AU.tone(o, t, 0.1, 'triangle', 1200, 1600, 0.25); AU.tone(o, t + 0.08, 0.14, 'triangle', 1800, 2200, 0.2); },
  rbstart(o, t) { AU.tone(o, t, 0.5, 'sine', 300, 900, 0.25, 0.05); },
  reboot(o, t) { [330, 440, 554, 659, 880, 1108].forEach((f, i) => AU.tone(o, t + i * 0.06, 0.5, 'triangle', f, f * 1.01, 0.22)); AU.noise(o, t, 0.9, 'bandpass', 500, 3000, 0.5, 1); },
  request(o, t) { AU.tone(o, t, 0.08, 'square', 900, 900, 0.18); AU.tone(o, t + 0.1, 0.08, 'square', 1200, 1200, 0.18); },
  bombbeep(o, t) { AU.tone(o, t, 0.07, 'sine', 1650, 1650, 0.35); },
  plant(o, t) { [600, 800, 1000, 1200].forEach((f, i) => AU.tone(o, t + i * 0.1, 0.08, 'square', f, f, 0.15)); },
  defstart(o, t) { [0, 0.15, 0.3].forEach(d => AU.tone(o, t + d, 0.09, 'square', 2200, 2200, 0.2)); AU.noise(o, t, 0.4, 'bandpass', 3000, 1500, 0.3, 3); },
  defused(o, t) { [1200, 900, 600].forEach((f, i) => AU.tone(o, t + i * 0.12, 0.12, 'triangle', f, f, 0.3)); },
  win(o, t) { [523, 659, 784, 1046].forEach((f, i) => AU.tone(o, t + i * 0.12, 0.5, 'triangle', f, f, 0.3)); },
  lose(o, t) { [440, 370, 311, 262].forEach((f, i) => AU.tone(o, t + i * 0.14, 0.5, 'triangle', f, f, 0.3)); },
  buy(o, t) { AU.tone(o, t, 0.06, 'square', 1200, 1500, 0.15); },
  click(o, t) { AU.tone(o, t, 0.03, 'square', 900, 900, 0.1); },
  heal(o, t) { [523, 659, 784, 1047].forEach((f, i) => AU.tone(o, t + i * 0.055, 0.22, 'triangle', f, f * 1.02, 0.2)); AU.tone(o, t, 0.4, 'sine', 260, 520, 0.12); },
  emote(o, t) { AU.tone(o, t, 0.12, 'sine', 660, 990, 0.18); AU.tone(o, t + 0.08, 0.2, 'triangle', 990, 1320, 0.14); },
  orb(o, t) { [880, 1320, 1760].forEach((f, i) => AU.tone(o, t + i * 0.05, 0.25, 'sine', f, f, 0.2)); },
  round(o, t) { AU.tone(o, t, 0.5, 'sawtooth', 220, 440, 0.2); AU.tone(o, t + 0.1, 0.5, 'triangle', 660, 660, 0.2); },
  tick(o, t) { AU.tone(o, t, 0.02, 'square', 2500, 2500, 0.08); }
};
