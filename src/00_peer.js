/* =====================================================================
   00 · GÖMÜLÜ BAĞLANTI KATMANI (PeerJS yerine)
   Dış kütüphane yüklemeden, ücretsiz PeerJS eşleştirme sunucusuyla
   (0.peerjs.com) aynı protokolle konuşur; oyun verisi WebRTC veri
   kanalıyla, sesli sohbet WebRTC ses akışıyla doğrudan cihazlar arasında akar.
   Arayüz PeerJS'inkiyle aynıdır: new Peer(id?, opts), connect, call, on(...).
   ===================================================================== */
(function () {
  if (typeof window === 'undefined' || typeof window.Peer !== 'undefined') return; // (testler sahte bir Peer verebilir)
  const DEF = { host: '0.peerjs.com', port: 443, secure: true, path: '/', key: 'peerjs' };
  const DEF_ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }] };
  const rid = n => { const c = 'abcdefghijklmnopqrstuvwxyz0123456789'; let s = ''; const r = new Uint8Array(n); (window.crypto || window.msCrypto).getRandomValues(r); for (const b of r) s += c[b % 36]; return s; };
  class Em {
    constructor() { this._h = {}; }
    on(e, f) { (this._h[e] = this._h[e] || []).push(f); return this; }
    off(e, f) { if (this._h[e]) this._h[e] = f ? this._h[e].filter(x => x !== f) : []; return this; }
    emit(e, ...a) { for (const f of (this._h[e] || []).slice()) { try { f(...a); } catch (err) { console.error(err); } } }
  }
  const mkErr = (type, msg) => { const e = new Error(msg || type); e.type = type; return e; };

  /* sesli sohbet: karşı tarafa "bana en fazla ~24 kbps mono gönder, sessizken hiç gönderme (DTX)"
     de — mobil bağlantıları ve evdeki interneti tıkamasın */
  function opusTune(sdp) {
    try {
      const m = /a=rtpmap:(\d+) opus\/48000[^\r\n]*/i.exec(sdp); if (!m) return sdp;
      const pt = m[1], re = new RegExp('a=fmtp:' + pt + ' ([^\\r\\n]*)');
      const add = 'maxaveragebitrate=24000;usedtx=1;stereo=0;sprop-stereo=0;cbr=0';
      if (re.test(sdp)) return sdp.replace(re, (all, p) => 'a=fmtp:' + pt + ' ' + p.split(';').filter(x => !/^(maxaveragebitrate|usedtx|stereo|sprop-stereo|cbr)=/.test(x.trim())).concat(add.split(';')).join(';'));
      return sdp.replace(m[0], m[0] + '\r\na=fmtp:' + pt + ' ' + add);
    } catch (e) { return sdp; }
  }
  /* ortak: bir RTCPeerConnection + uzak tarifin ayarlanmasını bekleyen ICE adayları */
  class Base extends Em {
    constructor(peer, remote, o, kind) {
      super();
      this.provider = peer; this.peer = remote; this.type = kind; this.open = false; this.metadata = o.metadata;
      this.connectionId = o.connectionId || ((kind === 'data' ? 'dc_' : 'mc_') + rid(12));
      this._pend = []; this._rd = false; this._closed = false;
      peer._conns[this.connectionId] = this;
      const pc = this.peerConnection = new RTCPeerConnection((peer.opts && peer.opts.config) || DEF_ICE);
      pc.onicecandidate = e => {
        if (!e.candidate) return;
        const c = e.candidate.toJSON ? e.candidate.toJSON() : { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex };
        peer._send({ type: 'CANDIDATE', dst: remote, payload: { candidate: c, type: kind, connectionId: this.connectionId } });
      };
      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        if (s === 'failed' || s === 'closed') this.close();
        else if (s === 'disconnected') { clearTimeout(this._dT); this._dT = setTimeout(() => { if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') this.close(); }, 8000); }
      };
    }
    async _sendOffer(extra) {
      try {
        const o = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(o);
        this.provider._send({ type: 'OFFER', dst: this.peer, payload: Object.assign({ sdp: { type: o.type, sdp: this.type === 'media' ? opusTune(o.sdp) : o.sdp }, type: this.type, connectionId: this.connectionId, metadata: this.metadata }, extra || {}) });
      } catch (e) { this.emit('error', e); this.close(); }
    }
    async _handleOffer(sdp) {
      try {
        await this.peerConnection.setRemoteDescription(sdp); this._flush();
        const a = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(a);
        this.provider._send({ type: 'ANSWER', dst: this.peer, payload: { sdp: { type: a.type, sdp: this.type === 'media' ? opusTune(a.sdp) : a.sdp }, type: this.type, connectionId: this.connectionId } });
      } catch (e) { this.emit('error', e); this.close(); }
    }
    async _handleAnswer(sdp) { try { await this.peerConnection.setRemoteDescription(sdp); this._flush(); } catch (e) { this.emit('error', e); this.close(); } }
    _flush() { this._rd = true; const p = this._pend; this._pend = []; for (const c of p) this.peerConnection.addIceCandidate(c).catch(() => { }); }
    _cand(c) { if (!c) return; if (!this._rd) this._pend.push(c); else this.peerConnection.addIceCandidate(c).catch(() => { }); }
    close() {
      if (this._closed) return; this._closed = true; this.open = false; clearTimeout(this._dT);
      try { if (this.dataChannel) this.dataChannel.close(); } catch (e) { }
      try { this.peerConnection.close(); } catch (e) { }
      delete this.provider._conns[this.connectionId];
      this.emit('close');
    }
  }
  class DataConn extends Base {
    constructor(peer, remote, o, incoming) {
      super(peer, remote, o, 'data');
      this.label = o.label || this.connectionId; this.serialization = 'json'; this.reliable = true;
      if (incoming) this.peerConnection.ondatachannel = e => this._setDC(e.channel);
      else { this._setDC(this.peerConnection.createDataChannel(this.label, { ordered: true })); this._sendOffer({ label: this.label, serialization: 'json', reliable: true }); }
    }
    _setDC(dc) {
      this.dataChannel = dc; try { dc.binaryType = 'arraybuffer'; } catch (x) { }
      dc.onopen = () => { this.open = true; this.emit('open'); };
      dc.onmessage = e => { let d = e.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (x) { } } this.emit('data', d); }; // ikili veri (ses) ArrayBuffer olarak gelir
      dc.onclose = () => this.close();
      dc.onerror = e => { this.emit('error', e); };
    }
    send(d) {
      const dc = this.dataChannel; if (!this.open || !dc || dc.readyState !== 'open') return;
      try { dc.send(d instanceof ArrayBuffer || ArrayBuffer.isView(d) ? d : JSON.stringify(d)); } catch (e) { this.emit('error', e); }
    }
  }
  class MediaConn extends Base {
    constructor(peer, remote, o, incoming, stream) {
      super(peer, remote, o, 'media');
      this.localStream = stream || null; this._offerSdp = o.sdp || null;
      this.peerConnection.ontrack = e => {
        const st = (e.streams && e.streams[0]) || new MediaStream([e.track]);
        if (this.remoteStream !== st) { this.remoteStream = st; this.open = true; this.emit('stream', st); }
      };
      if (!incoming) { if (stream) for (const t of stream.getTracks()) this.peerConnection.addTrack(t, stream); this._sendOffer(); }
    }
    answer(stream) {
      if (this._answered || !this._offerSdp) return; this._answered = true;
      if (stream) { this.localStream = stream; for (const t of stream.getTracks()) this.peerConnection.addTrack(t, stream); }
      this._handleOffer(this._offerSdp);
    }
  }

  class MiniPeer extends Em {
    constructor(id, opts) {
      super();
      if (id && typeof id === 'object') { opts = id; id = undefined; }
      this.opts = Object.assign({}, DEF, window.__PEER_OPTS || {}, opts || {});
      if (window.__PEER_OPTS) for (const k of ['host', 'port', 'secure', 'path', 'key']) if (k in window.__PEER_OPTS) this.opts[k] = window.__PEER_OPTS[k];
      this.id = id ? String(id) : 'sp' + rid(14);
      this.open = false; this.disconnected = true; this.destroyed = false; this._everOpen = false;
      this._conns = {}; this._early = {}; this._out = []; this.token = rid(10);
      setTimeout(() => this._connect(), 0);
    }
    get connections() { const o = {}; for (const k in this._conns) { const c = this._conns[k]; (o[c.peer] = o[c.peer] || []).push(c); } return o; }
    _url() {
      const o = this.opts; let path = o.path || '/'; if (!path.endsWith('/')) path += '/';
      return (o.secure ? 'wss' : 'ws') + '://' + o.host + ':' + o.port + path + 'peerjs?key=' + encodeURIComponent(o.key) + '&id=' + encodeURIComponent(this.id) + '&token=' + this.token + '&version=1.5.4';
    }
    _connect() {
      if (this.destroyed) return;
      let ws;
      try { ws = new WebSocket(this._url()); } catch (e) { this._fail('network', 'Eşleştirme sunucusuna bağlanılamadı'); return; }
      this._ws = ws;
      ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } this._msg(m); };
      ws.onclose = () => {
        if (this._ws !== ws) return;
        clearInterval(this._hb); this._ws = null; this.disconnected = true; this.open = false;
        if (this.destroyed) return;
        if (!this._everOpen) this._fail('network', 'Eşleştirme sunucusuna bağlanılamadı');
        else this.emit('disconnected', this.id);
      };
      ws.onerror = () => { };
      ws.onopen = () => { clearInterval(this._hb); this._hb = setInterval(() => this._send({ type: 'HEARTBEAT' }), 5000); };
    }
    _fail(type, msg) { this.emit('error', mkErr(type, msg)); }
    _send(m) {
      const ws = this._ws;
      if (ws && ws.readyState === 1 && this.open) { try { ws.send(JSON.stringify(m)); } catch (e) { } }
      else if (m.type !== 'HEARTBEAT') this._out.push(m);
    }
    _msg(m) {
      const src = m.src, p = m.payload || {};
      switch (m.type) {
        case 'OPEN': {
          this.open = true; this.disconnected = false;
          const first = !this._everOpen; this._everOpen = true;
          const q = this._out; this._out = []; for (const x of q) this._send(x);
          if (first) this.emit('open', this.id);
          break;
        }
        case 'ID-TAKEN': this._fail('unavailable-id', 'ID "' + this.id + '" is taken'); this._closeWs(); break;
        case 'INVALID-KEY': this._fail('invalid-key', 'API key is invalid'); this._closeWs(); break;
        case 'ERROR': this._fail('server-error', (p && p.msg) || 'Sunucu hatası'); break;
        case 'LEAVE': for (const k in this._conns) if (this._conns[k].peer === src) this._conns[k].close(); break;
        case 'EXPIRE': {
          this._fail('peer-unavailable', 'Could not connect to peer ' + src);
          for (const k in this._conns) { const c = this._conns[k]; if (c.peer === src && !c.open) c.close(); }
          break;
        }
        case 'OFFER': {
          const cid = p.connectionId; if (!cid || this._conns[cid]) return;
          let c;
          if (p.type === 'media') { c = new MediaConn(this, src, { connectionId: cid, metadata: p.metadata, sdp: p.sdp }, true); this._earlyFlush(c); this.emit('call', c); }
          else { c = new DataConn(this, src, { connectionId: cid, metadata: p.metadata, label: p.label }, true); this._earlyFlush(c); c._handleOffer(p.sdp); this.emit('connection', c); }
          break;
        }
        case 'ANSWER': { const c = this._conns[p.connectionId]; if (c) c._handleAnswer(p.sdp); break; }
        case 'CANDIDATE': {
          const c = this._conns[p.connectionId];
          if (c) c._cand(p.candidate);
          else (this._early[p.connectionId] = this._early[p.connectionId] || []).push(p.candidate);
          break;
        }
      }
    }
    _earlyFlush(c) { const e = this._early[c.connectionId]; if (e) { delete this._early[c.connectionId]; for (const x of e) c._cand(x); } }
    _closeWs() { const ws = this._ws; this._ws = null; clearInterval(this._hb); try { if (ws) ws.close(); } catch (e) { } this.disconnected = true; this.open = false; }
    connect(id, o) { if (this.destroyed) return null; return new DataConn(this, String(id), { metadata: o && o.metadata, label: o && o.label }, false); }
    call(id, stream, o) { if (this.destroyed) return null; return new MediaConn(this, String(id), { metadata: o && o.metadata }, false, stream); }
    reconnect() { if (this.destroyed || !this.disconnected || this._ws) return; this._connect(); }
    disconnect() { if (this._ws) { try { this._send({ type: 'LEAVE', dst: this.id }); } catch (e) { } } this._closeWs(); this.emit('disconnected', this.id); }
    destroy() {
      if (this.destroyed) return; this.destroyed = true;
      for (const k in this._conns) this._conns[k].close();
      this._closeWs(); this.emit('close');
    }
  }
  window.Peer = MiniPeer;
  window.__MINI_PEER = true;
})();
