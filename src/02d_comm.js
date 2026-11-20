/* =====================================================================
   02d · SESLİ SOHBET + YAZILI SOHBET
   Sesli sohbet: her oyuncu mikrofonunu diğer insan oyunculara doğrudan
   (PeerJS ses araması, WebRTC) gönderir; alıcı tarafta ses mesafeye göre
   kısılır, belli bir mesafeden sonra kesilir, yöne göre sağ/sol verilir.
   Doğuş alanındaki oyuncuyu yalnızca kendi takımı duyar.
   0: basılı tut = bas-konuş · kısa dokun = mikrofonu açık bırak / kapat
   ===================================================================== */
const VC = {
  hear: true, vol: 1, stream: null, track: null, talking: false, open: false, asking: false,
  out: {}, in: {}, dir: {}, master: null, downT: 0, NEAR: 260, FAR: 1500,
  supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && typeof RTCPeerConnection !== 'undefined'; },
  online() { return NET.mode !== 'off' && !!NET.peer; },
  /* ---- mikrofon ---- */
  ensureMic() {
    if (this.stream) return Promise.resolve(true);
    if (this.asking) return Promise.resolve(false);
    if (!this.supported()) { showMsg(null, 'MİKROFON KULLANILAMIYOR — oyunu https adresinden ya da dosyadan aç', PAL.red); return Promise.resolve(false); }
    this.asking = true;
    showMsg(null, 'MİKROFON İZNİ İSTENİYOR…', PAL.dim);
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(s => {
      this.asking = false; this.stream = s; this.track = s.getAudioTracks()[0];
      if (this.track) this.track.enabled = false;
      showMsg(null, 'MİKROFON HAZIR — konuşmak için 0\'a basılı tut, açık bırakmak için dokun', PAL.teal);
      this.startCapture(); this.sendState(); return true;
    }).catch(() => { this.asking = false; showMsg(null, 'MİKROFON İZNİ VERİLMEDİ', PAL.red); return false; });
  },
  setTalk(on) {
    on = !!on;
    if (this.track) this.track.enabled = on;
    if (this.talking === on) return;
    this.talking = on; this.sendState();
    try { const b = document.getElementById('lbMic'); if (b) b.classList.toggle('on', on); if (!G.running && typeof uiRenderLobby === 'function' && NET.lobby) uiRenderLobby(); } catch (e) { }
    try { AU.play('click'); } catch (e) { }
  },
  keyDown() {
    if (!this.online()) { showMsg(null, 'SESLİ SOHBET YALNIZCA ÇOK OYUNCULU ODADA ÇALIŞIR', PAL.dim); return; }
    if (!this.stream) { this.ensureMic(); return; }
    if (this.open) { this.open = false; this.setTalk(false); this._ignoreUp = true; return; }
    this.downT = performance.now(); this._ignoreUp = false; this.setTalk(true);
  },
  keyUp() {
    if (this._ignoreUp || !this.stream) { this._ignoreUp = false; return; }
    if (!this.talking) return;
    if (performance.now() - this.downT < 280) { this.open = true; showMsg(null, 'MİKROFON AÇIK — kapatmak için 0\'a tekrar dokun', PAL.teal); }
    else this.setTalk(false);
  },
  /* konuşma durumu: host'a bildir (host anlık görüntüyle herkese dağıtır) */
  sendState() {
    const vm = this.stream ? 1 : 0, vt = this.talking ? 1 : 0;
    if (NET.mode === 'client') netSend(NET.conn, { t: 'vt', vm, vt });
    else if (NET.mode === 'host') vcHostSet('h', vm, vt);
  },
  /* ---- bağlantılar ----
     SES, OYUNUN MEVCUT VERİ BAĞLANTISININ İÇİNDEN gider (ayrı bir ses bağlantısı AÇILMAZ).
     Ayrı bağlantı kurulurken yapılan yoğun bağlantı denemeleri bazı modem/güvenlik duvarlarında
     internetin bir süre kesilmesine yol açıyordu. Mikrofon 12 kHz'e indirilir, μ-law ile
     sıkıştırılır (≈12 KB/sn) ve YALNIZCA konuşurken gönderilir. Host gelen sesi duyabilecek
     oyunculara iletir; alıcı mesafe/yön/takım kurallarını uygular. */
  setDir(dir) { this.dir = dir || {}; },
  callAll() { },
  onCall(call) { try { call.close(); } catch (e) { } },
  /* mikrofonu yakala → 40 ms'lik paketler */
  startCapture() {
    const c = AU.ctx; if (!c || !this.stream || this.cap) return;
    try {
      const src = c.createMediaStreamSource(this.stream), proc = c.createScriptProcessor(2048, 1, 1), sink = c.createGain();
      sink.gain.value = 0; src.connect(proc); proc.connect(sink); sink.connect(c.destination);
      const cap = this.cap = { src, proc, sink, rest: new Float32Array(0), rpos: 0, ratio: c.sampleRate / VOX_RATE, frame: new Uint8Array(VOX_FRAME), fl: new Float32Array(VOX_FRAME), n: 0, seq: 0, openT: 0 };
      proc.onaudioprocess = e => {
        if (!this.talking || !this.track || !this.track.enabled || !this.online()) { cap.n = 0; return; }
        const inp = e.inputBuffer.getChannelData(0), r = cap.ratio;
        let src2 = inp;
        if (cap.rest.length) { src2 = new Float32Array(cap.rest.length + inp.length); src2.set(cap.rest); src2.set(inp, cap.rest.length); }
        let p = cap.rpos;
        while (p + r <= src2.length) {
          const a = Math.floor(p), b = Math.max(a + 1, Math.floor(p + r)); let sm = 0;
          for (let k = a; k < b; k++) sm += src2[k];
          cap.fl[cap.n++] = sm / (b - a); p += r;
          if (cap.n === VOX_FRAME) { this.flushFrame(cap); cap.n = 0; }
        }
        const keep = Math.floor(p); cap.rest = src2.slice(keep); cap.rpos = p - keep;
      };
    } catch (e) { this.cap = null; }
  },
  stopCapture() {
    const cap = this.cap; this.cap = null; if (!cap) return;
    try { cap.proc.onaudioprocess = null; cap.src.disconnect(); cap.proc.disconnect(); cap.sink.disconnect(); } catch (e) { }
  },
  /* gürültü kapısı (sessizlik ve hoparlörden geri gelen yankı gönderilmez) + μ-law */
  flushFrame(cap) {
    let e = 0; for (let k = 0; k < VOX_FRAME; k++) e += cap.fl[k] * cap.fl[k];
    const rms = Math.sqrt(e / VOX_FRAME), nowMs = performance.now();
    let hearing = false; for (const id in this.in) if (nowMs - (this.in[id].last || 0) < 250 && this.in[id].g > 0.05) hearing = true;
    if (rms > (hearing ? 0.035 : 0.006)) cap.openT = nowMs + 350;
    if (nowMs > cap.openT) return;
    for (let k = 0; k < VOX_FRAME; k++) cap.frame[k] = vxEnc(cap.fl[k]);
    cap.seq = (cap.seq + 1) & 255;
    if (NET.mode === 'client') { if (vcRoom(NET.conn)) NET.conn.send(vxPacket('', cap.seq, cap.frame)); }
    else if (NET.mode === 'host') { const pk = vxPacket('h', cap.seq, cap.frame); for (const id in NET.conns) { const cn = NET.conns[id]; if (vcRoom(cn) && vcAudible('h', id)) cn.send(pk); } }
  },
  /* gelen sesi çal (küçük bir titreşim tamponu ile) */
  play(id, data) {
    const c = AU.ctx; if (!c || !this.hear || id === G.myId) return;
    let r = this.in[id]; if (!r) r = this.addRemote(id);
    r.last = performance.now();
    if (!r.gain || c.state !== 'running') return;
    const n = data.length, buf = c.createBuffer(1, n, VOX_RATE), ch = buf.getChannelData(0);
    for (let k = 0; k < n; k++) ch[k] = VX_DEC[data[k]];
    const now = c.currentTime;
    if (r.next < now + 0.02 || r.next > now + 0.5) r.next = now + 0.1; // gecikme en fazla ~0.5 sn
    const sn = c.createBufferSource(); sn.buffer = buf; sn.connect(r.gain); sn.start(r.next); r.next += n / VOX_RATE;
  },
  addRemote(id) {
    this.removeRemote(id);
    const r = { g: 0, next: 0, last: 0 }, c = AU.ctx;
    try {
      if (!this.master) { this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(c.destination); }
      r.gain = c.createGain(); r.gain.gain.value = 0;
      r.pan = c.createStereoPanner ? c.createStereoPanner() : null;
      if (r.pan) { r.gain.connect(r.pan); r.pan.connect(this.master); } else r.gain.connect(this.master);
    } catch (e) { }
    this.in[id] = r; return r;
  },
  removeRemote(id) {
    const r = this.in[id]; if (!r) return;
    try { if (r.gain) r.gain.disconnect(); if (r.pan) r.pan.disconnect(); } catch (e) { }
    delete this.in[id];
  },
  reset() {
    this.stopCapture();
    for (const id in this.in) this.removeRemote(id);
    this.out = {}; this.in = {}; this.dir = {}; this.open = false;
    this.setTalk(false);
    if (this.stream) { try { this.stream.getTracks().forEach(t => t.stop()); } catch (e) { } }
    this.stream = null; this.track = null;
  },
  setVol(v) { this.vol = v; if (this.master) this.master.gain.value = v; },
  /* ---- duyulabilirlik: [ses, stereo] ---- */
  gainFor(id) {
    if (!this.hear || this.vol <= 0.001) return [0, 0];
    if (!G.running || !S) return [1, 0];                                   // lobi / ajan seçimi: herkes herkesi duyar
    const p = S.pmap[id], me = S.pmap[G.myId]; if (!p || !me) return [0, 0];
    const ally = p.team === me.team;
    if (!p.alive || !me.alive) return ally ? [0.8, 0] : [0, 0];             // ölüler yalnızca takımıyla konuşur
    if (!ally && vcInSpawn(p)) return [0, 0];                                // doğuş alanındaki konuşma dışarı sızmaz
    const L = audioListener(), d = dist(L.x, L.y, p.x, p.y);
    if (d >= this.FAR) return [0, 0];                                        // belli mesafeden sonra kesilir
    let g = d <= this.NEAR ? 1 : Math.pow((this.FAR - d) / (this.FAR - this.NEAR), 1.6);
    if (!losClear(L.x, L.y, p.x, p.y, true)) g *= 0.6;                       // duvar arkası boğuk
    const pan = d > 30 ? clamp(Math.sin(angDiff(L.ang || 0, Math.atan2(p.y - L.y, p.x - L.x))), -1, 1) * 0.7 : 0;
    return [g, pan];
  },
  update() {
    if (!this.online()) return;
    const now = AU.ctx ? AU.ctx.currentTime : 0;
    for (const id in this.in) {
      const r = this.in[id], [g, pan] = this.gainFor(id);
      r.g = g;
      if (r.gain) { r.gain.gain.setTargetAtTime(g, now, 0.06); if (r.pan) r.pan.pan.setTargetAtTime(pan, now, 0.06); }
    }
  },
  /* solda gösterilecek konuşanlar */
  speakers() {
    if (!S) return [];
    const me = S.pmap[G.myId], out = [];
    for (const p of S.players) {
      if (p.id === G.myId) { if (this.talking) out.push(p); continue; }
      if (!p.vt) continue;
      if ((me && p.team === me.team) || (this.in[p.id] && this.in[p.id].g > 0.03)) out.push(p);
    }
    return out;
  }
};
/* ---- ses paketi: 'V' | id uzunluğu | id | sıra | μ-law örnekleri ---- */
const VOX_RATE = 12000, VOX_FRAME = 480;
const VX_DEC = (() => { const t = new Float32Array(256); for (let i = 0; i < 256; i++) { const u = ~i & 255, sg = u & 128, ex = (u >> 4) & 7, mt = u & 15; let v = ((mt << 3) + 132) << ex; v -= 132; t[i] = (sg ? -v : v) / 32768; } return t; })();
function vxEnc(x) {
  let v = Math.floor(clamp(x, -1, 1) * 32635); const sg = v < 0 ? 128 : 0; if (v < 0) v = -v;
  v += 132; let ex = 7; for (let m = 0x4000; (v & m) === 0 && ex > 0; m >>= 1) ex--;
  return ~(sg | (ex << 4) | ((v >> (ex + 3)) & 15)) & 255;
}
function vxPacket(id, seq, frame) {
  const b = new Uint8Array(3 + id.length + frame.length); b[0] = 86; b[1] = id.length;
  for (let k = 0; k < id.length; k++) b[2 + k] = id.charCodeAt(k) & 127;
  b[2 + id.length] = seq; b.set(frame, 3 + id.length); return b.buffer;
}
function vxParse(buf) {
  const b = new Uint8Array(buf); if (b.length < 4 || b[0] !== 86) return null;
  const L = b[1]; if (b.length < 3 + L) return null;
  let id = ''; for (let k = 0; k < L; k++) id += String.fromCharCode(b[2 + k]);
  return { id, seq: b[2 + L], data: b.subarray(3 + L) };
}
/* bağlantının kuyruğu doluysa ses paketini at (hat tıkanmasın) */
function vcRoom(cn) { if (!cn || !cn.open) return false; const dc = cn.dataChannel; return !dc || dc.bufferedAmount < 48 * 1024; }
/* host: "from"un sesi "to"ya ulaşmalı mı? (alıcıdaki kurallarla aynı, biraz paylı) */
function vcAudible(from, to) {
  if (!G.running || !S) return true;
  const a = S.pmap[from], b = S.pmap[to]; if (!a || !b) return false;
  const ally = a.team === b.team;
  if (!a.alive || !b.alive) return ally;
  if (!ally && vcInSpawn(a)) return false;
  return dist(a.x, a.y, b.x, b.y) < VC.FAR + 250 || !b.alive;
}
/* host: istemciden gelen ses paketi → kendin dinle + duyabilecek diğer oyunculara ilet */
function vcHostAudio(conn, buf) {
  const id = conn._pid; if (!id) return;
  const pk = vxParse(buf); if (!pk) return;
  VC.play(id, pk.data);
  let out = null;
  for (const oid in NET.conns) {
    if (oid === id) continue; const cn = NET.conns[oid];
    if (!vcRoom(cn) || !vcAudible(id, oid)) continue;
    cn.send(out || (out = vxPacket(id, pk.seq, pk.data)));
  }
}
function vcInSpawn(p) { const t = grid[Math.floor(p.y / TILE) * MW + Math.floor(p.x / TILE)]; return t === T_ATK || t === T_DEF; }
/* host: oyuncunun mikrofon/konuşma durumu */
function vcHostSet(id, vm, vt) {
  NET.vs = NET.vs || {}; NET.vs[id] = { vm, vt };
  if (S && S.pmap[id]) { S.pmap[id].vm = vm; S.pmap[id].vt = vt; }
  if (!G.running && NET.lobby) { clearTimeout(NET._lbT); NET._lbT = setTimeout(() => { if (NET.mode === 'host' && NET.lobby) broadcastLobby(); }, 120); } // lobide mikrofon simgesi
}
/* host: oyun kimliği → PeerJS kimliği rehberi */
function vcDirectory() {
  const d = {}; if (NET.peer && NET.peer.id) d.h = NET.peer.id;
  for (const id in NET.conns) if (NET.conns[id] && NET.conns[id].peer) d[id] = NET.conns[id].peer;
  return d;
}
function vcBroadcastDir() { if (NET.mode !== 'host') return; const d = vcDirectory(); broadcast({ t: 'vdir', d }); VC.setDir(d); }

/* ---------------- YAZILI SOHBET ---------------- */
const CHAT = { open: false, lines: [] };
function chatOpen() {
  if (!G.running || !S || CHAT.open) return;
  CHAT.open = true; UI.chatOpen = true;
  for (const k in KEYS) KEYS[k] = false; MOUSE.down = false;
  G._noPauseOnUnlock = true; unlockPointer();
  const box = $('chatBox'), inp = $('chatIn'); box.classList.remove('hidden'); inp.value = '';
  setTimeout(() => inp.focus(), 0);
}
function chatClose(send) {
  if (!CHAT.open) return;
  const inp = $('chatIn'), text = inp.value;
  CHAT.open = false; UI.chatOpen = false; $('chatBox').classList.add('hidden'); inp.blur();
  if (send) chatSend(text);
  if (G.running && !IS_TOUCH && !UI.overlay) lockPointer(true);
  setTimeout(() => { G._noPauseOnUnlock = false; }, 400);
}
function chatClean(t) { return String(t || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120); }
function chatSend(text) {
  text = chatClean(text); if (!text || !S) return;
  if (G.mode === 'client') netSend(NET.conn, { t: 'chat', m: text });
  else hostChat(G.myId, text);
}
function hostChat(id, text) {
  const p = S && S.pmap[id]; text = chatClean(text); if (!p || !text) return;
  const now = performance.now(); if (now - (p._chatT || 0) < 600) return; p._chatT = now;
  emit({ k: 'chat', id, n: p.name.replace(' (BOT)', ''), tm: p.team, m: text });
}

/* ---------------- LOBİ SOHBETİ (host üzerinden herkese) ---------------- */
function lobbyChatSend(text) {
  text = chatClean(text); if (!text || NET.mode === 'off') return;
  if (NET.mode === 'client') netSend(NET.conn, { t: 'lchat', m: text }); else lobbyChatHost('h', text);
}
function lobbyChatHost(id, text) {
  text = chatClean(text); if (!text || !NET.lobby) return;
  const p = NET.lobby.players.find(q => q.id === id); if (!p) return;
  const now = performance.now(); NET._lct = NET._lct || {}; if (now - (NET._lct[id] || 0) < 500) return; NET._lct[id] = now;
  const m = { t: 'lchat', id, n: p.name, tm: p.team, m: text };
  broadcast(m); lobbyChatAdd(m);
}
function lobbyChatAdd(m) {
  NET.lchat = NET.lchat || [];
  NET.lchat.push({ id: m.id, n: String(m.n || '').slice(0, 16), tm: m.tm ? 1 : 0, m: chatClean(m.m) });
  if (NET.lchat.length > 60) NET.lchat.shift();
  if (typeof uiRenderLobbyChat === 'function') uiRenderLobbyChat();
  try { AU.play('click'); } catch (e) { }
}
