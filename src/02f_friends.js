/* =====================================================================
   02f · KULLANICI ADI + ARKADAŞ SİSTEMİ
   Her oyuncunun kalıcı bir kimliği (uid) ve bir kez seçilen, değiştirilemeyen
   kullanıcı adı vardır. Oyun açıkken eşleştirme sunucusunda "SPIKE-u-<uid>"
   adıyla kayıtlıdır; arkadaşlar bu adla birbirine doğrudan bağlanıp
   çevrimiçi durumunu, odasını, arkadaşlık ve "oyuna katıl" isteklerini iletir.
   ===================================================================== */
const FR = {
  uid: null, nick: null, list: [], reqIn: [], reqOut: [], peer: null, conns: {}, q: {}, st: { s: 'menu', code: null }, ready: false, pops: [],
  ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { } return null; },
  acc: false,
  save() { if (!this.uid) return; const k = '_' + this.uid; this.ls('spk_fr' + k, JSON.stringify(this.list)); this.ls('spk_frin' + k, JSON.stringify(this.reqIn)); this.ls('spk_frout' + k, JSON.stringify(this.reqOut)); },
  loadCache() {
    const pj = (k, d) => { try { const v = JSON.parse(this.ls(k) || 'null'); return Array.isArray(v) ? v : d; } catch (e) { return d; } };
    const k = '_' + this.uid; this.list = pj('spk_fr' + k, []); this.reqIn = pj('spk_frin' + k, []); this.reqOut = pj('spk_frout' + k, []);
    for (const f of this.list) f.online = false;
  },
  init() {
    this.acc = ACC.load();
    if (this.acc) { this.uid = ACC.uid; this.nick = ACC.nick; this.loadCache(); }
    setInterval(() => this.tick(), 3000);
  },
  /* hesapla giriş yapıldı (kayıt ya da giriş) */
  onLogin() { this.acc = true; this.uid = ACC.uid; this.nick = ACC.nick; this.loadCache(); this.start(); this.doSync(); },
  /* misafir: arkadaş sistemi yok, ad yalnızca bu cihazda */
  guest(nick) { this.acc = false; this.uid = null; this.nick = nick; this.ls('spk_nick', nick); },
  validNick(n) { n = String(n || '').trim(); return n.length >= 3 && n.length <= 16 && /^[A-Za-z0-9_ÇĞİÖŞÜçğıöşü.\-]+$/.test(n); },
  /* sunucudan arkadaşlar, istekler ve son görülme */
  async doSync() {
    if (!this.acc || this._syncing) return; this._syncing = true;
    try {
      const st = this.myState(), res = await ACC.sync(st.s, st.code);
      this.online = true;
      const old = new Map(this.list.map(f => [f.uid, f]));
      this.list = Object.keys(res.friends).map(u => {
        const f = old.get(u) || { uid: u, since: Date.now() }; f.nick = res.friends[u] || f.nick;
        const p = res.pres[u], live = !!(this.conns[u] && this.conns[u].open);
        if (p) { f.nick = p.nick || f.nick; if (p.lastSeen) f.lastSeen = Math.max(f.lastSeen || 0, p.lastSeen); f.dbOnline = ACC.now() - (p.lastSeen || 0) < 75000; if (!live) { f.st = p.st; f.code = p.code || null; } }
        f.online = live || !!f.dbOnline; return f;
      });
      for (const from in res.inbox) {
        const m = res.inbox[from] || {}, nick = String(m.nick || 'Oyuncu').slice(0, 16);
        if (m.t === 'req') {
          if (this.isFriend(from)) { ACC.inboxDel(from).catch(() => { }); continue; }
          if (this.reqOut.some(r => r.uid === from)) { this.reqIn.push({ uid: from, nick, t: m.ts }); this.accept(from); continue; }
          if (!this.reqIn.some(r => r.uid === from)) { this.reqIn.push({ uid: from, nick, t: m.ts || Date.now() }); uiFriendPopup('freq', from, nick); }
        } else if (m.t === 'acc') {
          this.reqOut = this.reqOut.filter(r => r.uid !== from);
          if (!this.isFriend(from)) { this.list.push({ uid: from, nick, since: Date.now(), lastSeen: m.ts || Date.now(), online: false }); ACC.friendAdd(from, nick).catch(() => { }); uiToast(nick + ' arkadaşlık isteğini kabul etti!'); }
          ACC.inboxDel(from).catch(() => { });
        } else if (m.t === 'unf') {
          this.list = this.list.filter(f => f.uid !== from); ACC.friendDel(from).catch(() => { }); ACC.inboxDel(from).catch(() => { });
        }
      }
      this.reqIn = this.reqIn.filter(r => res.inbox[r.uid] && res.inbox[r.uid].t === 'req');
      this.save(); uiFriendsChanged();
    } catch (e) { this.online = false; if (/NO_SESSION|TOKEN_EXPIRED|INVALID_REFRESH_TOKEN|USER_NOT_FOUND/.test(String(e && e.message))) { uiToast('Oturum süresi doldu — tekrar giriş yap.', true); } }
    this._syncing = false;
  },
  pid(uid) { return PEER_PREFIX + 'u-' + uid; },
  isFriend(uid) { return this.list.some(f => f.uid === uid); },
  friend(uid) { return this.list.find(f => f.uid === uid); },
  /* ---- varlık (presence) bağlantısı ---- */
  start() {
    if (!this.acc || !this.uid || !this.nick || this.peer || typeof Peer === 'undefined' || (typeof IN_PREVIEW !== 'undefined' && IN_PREVIEW)) return;
    let p;
    try { p = new Peer(this.pid(this.uid), peerOpts()); } catch (e) { return; }
    this.peer = p;
    p.on('open', () => { this.ready = true; this.pollAll(); uiFriendsChanged(); });
    p.on('connection', c => this.bind(c));
    p.on('disconnected', () => { this.ready = false; setTimeout(() => { try { if (this.peer === p && !p.destroyed) p.reconnect(); } catch (e) { } }, 3000); });
    p.on('error', e => {
      const ty = e && e.type;
      if (ty === 'peer-unavailable') { const m = /peer (\S+)/.exec(e.message || ''); if (m) this.unreach(m[1]); return; }
      if (ty === 'unavailable-id' || ty === 'network' || ty === 'server-error') { this.ready = false; try { p.destroy(); } catch (x) { } if (this.peer === p) this.peer = null; setTimeout(() => this.start(), ty === 'unavailable-id' ? 30000 : 15000); }
    });
  },
  unreach(peerId) {
    const uid = String(peerId).replace(PEER_PREFIX + 'u-', '');
    if (this.q[uid] && this.q[uid].some(m => m.t === 'freq')) uiToast('Bu oyuncuya şu an ulaşılamadı — oyunu açıkken tekrar dene.');
    delete this.q[uid];
  },
  bind(c) {
    c.on('open', () => { this.hello(c); });
    c.on('data', d => this.onData(c, d));
    const gone = () => {
      const uid = c._uid; if (!uid) return;
      if (this.conns[uid] === c) delete this.conns[uid];
      const f = this.friend(uid);
      if (f && !this.conns[uid]) { f.online = false; f.lastSeen = Date.now(); this.save(); uiFriendsChanged(); }
    };
    c.on('close', gone); c.on('error', () => { });
    if (c.open) this.hello(c);
  },
  hello(c) { if (c._hi) return; c._hi = true; this.raw(c, { t: 'hi', uid: this.uid, nick: this.nick, st: this.st.s, code: this.st.code }); },
  raw(c, m) { try { c.send(m); } catch (e) { } },
  sendTo(uid, m) {
    const c = this.conns[uid];
    if (c && c.open) { this.raw(c, m); return; }
    (this.q[uid] = this.q[uid] || []).push(m);
    this.dial(uid);
  },
  dial(uid) {
    if (!this.peer || !this.ready || this.conns[uid] || this._dialing === uid) return;
    const c = this.peer.connect(this.pid(uid), { reliable: true, serialization: 'json' }); if (!c) return;
    c._uid = uid; this.conns[uid] = c; this.bind(c);
    setTimeout(() => { if (!c.open && this.conns[uid] === c) { delete this.conns[uid]; try { c.close(); } catch (e) { } } }, 15000);
  },
  pollAll() { for (const f of this.list) if (!this.conns[f.uid]) this.dial(f.uid); },
  onData(c, d) {
    if (!d || typeof d !== 'object') return;
    const uid = String(d.uid || c._uid || '').slice(0, 40);
    if (d.t === 'hi') {
      c._uid = uid; c._nick = String(d.nick || '').slice(0, 16);
      if (!this.conns[uid] || !this.conns[uid].open) this.conns[uid] = c;
      this.hello(c);
      const f = this.friend(uid);
      if (f) { f.online = true; f.lastSeen = Date.now(); f.nick = c._nick || f.nick; f.st = d.st; f.code = d.code || null; this.save(); uiFriendsChanged(); }
      const q = this.q[uid]; if (q) { delete this.q[uid]; for (const m of q) this.raw(c, m); }
      return;
    }
    if (!c._uid) return;
    const f = this.friend(c._uid), nick = c._nick || (f && f.nick) || 'Oyuncu';
    switch (d.t) {
      case 'st?': if (f) this.raw(c, { t: 'st', st: this.st.s, code: this.st.code }); break;
      case 'st': if (f) { f.st = d.st; f.code = d.code || null; f.online = true; f.lastSeen = Date.now(); uiFriendsChanged(); } break;
      case 'freq':
        if (f) { this.raw(c, { t: 'facc', nick: this.nick, st: this.st.s, code: this.st.code }); break; }
        if (this.reqOut.some(r => r.uid === c._uid)) { this.addFriend(c._uid, nick); this.raw(c, { t: 'facc', nick: this.nick, st: this.st.s, code: this.st.code }); break; }
        if (!this.reqIn.some(r => r.uid === c._uid)) { this.reqIn.push({ uid: c._uid, nick, t: Date.now() }); this.save(); }
        uiFriendsChanged(); uiFriendPopup('freq', c._uid, nick);
        break;
      case 'facc':
        this.reqOut = this.reqOut.filter(r => r.uid !== c._uid);
        this.addFriend(c._uid, String(d.nick || nick).slice(0, 16));
        { const nf = this.friend(c._uid); if (nf) { nf.online = true; nf.st = d.st || nf.st; nf.code = d.code || null; uiFriendsChanged(); } }
        uiToast(nick + ' arkadaşlık isteğini kabul etti!');
        break;
      case 'fdec': this.reqOut = this.reqOut.filter(r => r.uid !== c._uid); this.save(); uiFriendsChanged(); break;
      case 'unf': this.list = this.list.filter(x => x.uid !== c._uid); if (this.acc) ACC.friendDel(c._uid).catch(() => { }); this.save(); uiFriendsChanged(); break;
      case 'join?':
        if (!f) break;
        if (G.running || !(this.st.s === 'lobby' && this.st.code)) { this.raw(c, { t: 'join-no', why: G.running ? 'Arkadaşın şu an maçta.' : 'Arkadaşın bir odada değil.' }); break; }
        if (!this.pops.some(p => p.kind === 'join' && p.uid === c._uid)) uiFriendPopup('join', c._uid, nick);
        break;
      case 'join!': if (f && d.code) this.joinAccepted(c._uid, d.code, nick); break;
      case 'join-no': if (this.waitJoin && this.waitJoin.uid === c._uid) this.waitJoin = null; uiToast(nick + ': ' + String(d.why || 'İstek reddedildi.').slice(0, 80)); break;
    }
  },
  addFriend(uid, nick) {
    if (this.acc && !this.isFriend(uid)) ACC.friendAdd(uid, nick).catch(() => { });
    if (!this.isFriend(uid)) this.list.push({ uid, nick, since: Date.now(), lastSeen: Date.now(), online: !!(this.conns[uid] && this.conns[uid].open) });
    this.reqIn = this.reqIn.filter(r => r.uid !== uid); this.reqOut = this.reqOut.filter(r => r.uid !== uid);
    const c = this.conns[uid]; if (c && c.open) { const f = this.friend(uid); f.online = true; this.raw(c, { t: 'st', st: this.st.s, code: this.st.code }); }
    this.save(); uiFriendsChanged();
  },
  /* ---- kullanıcı eylemleri ---- */
  request(uid, nick) {
    if (!uid || uid === this.uid || this.isFriend(uid)) return;
    if (this.reqIn.some(r => r.uid === uid)) { this.accept(uid); return; }
    if (!this.reqOut.some(r => r.uid === uid)) this.reqOut.push({ uid, nick: String(nick || '').slice(0, 16), t: Date.now() });
    this.save(); this.sendTo(uid, { t: 'freq', nick: this.nick }); uiFriendsChanged();
    ACC.send(uid, 'req').then(() => uiToast(nick + ' oyuncusuna arkadaşlık isteği gönderildi')).catch(e => uiToast(ACC.errText(e.message), true));
  },
  accept(uid) { const r = this.reqIn.find(x => x.uid === uid); if (!r) return; this.st = this.myState(); this.addFriend(uid, r.nick); this.sendTo(uid, { t: 'facc', nick: this.nick, st: this.st.s, code: this.st.code }); if (this.acc) { ACC.send(uid, 'acc').catch(() => { }); ACC.inboxDel(uid).catch(() => { }); } },
  decline(uid) { this.reqIn = this.reqIn.filter(x => x.uid !== uid); this.save(); this.sendTo(uid, { t: 'fdec' }); if (this.acc) ACC.inboxDel(uid).catch(() => { }); uiFriendsChanged(); },
  remove(uid) { this.list = this.list.filter(x => x.uid !== uid); this.save(); this.sendTo(uid, { t: 'unf' }); if (this.acc) { ACC.friendDel(uid).catch(() => { }); ACC.send(uid, 'unf').catch(() => { }); } uiFriendsChanged(); },
  /* OYUNA KATIL isteği: doğrudan bağlantı varsa oradan, AYRICA sunucudaki gelen kutusundan da gider
     (iki oyuncu arasında doğrudan bağlantı kurulamasa bile istek mutlaka ulaşır) */
  inboxPut(uid, m) { if (!this.acc) return Promise.resolve(); return ACC.db('PUT', 'users/' + uid + '/inbox/' + this.uid, Object.assign({ nick: this.nick, ts: { '.sv': 'timestamp' } }, m)).catch(() => { }); },
  askJoin(uid) {
    const f = this.friend(uid); if (!f) return;
    this.sendTo(uid, { t: 'join?' });
    this.inboxPut(uid, { t: 'join' });
    this.waitJoin = { uid, nick: f.nick, until: Date.now() + 45000 };
    uiToast(f.nick + ' oyuncusuna katılma isteği gönderildi…');
  },
  answerJoin(uid, ok) {
    const code = this.st.code;
    if (ok && this.st.s === 'lobby' && code) { this.sendTo(uid, { t: 'join!', code }); this.inboxPut(uid, { t: 'joinok', code }); }
    else { this.sendTo(uid, { t: 'join-no', why: 'İstek reddedildi.' }); this.inboxPut(uid, { t: 'joinno', why: 'İstek reddedildi.' }); }
  },
  joinAccepted(uid, code, nick) {
    if (this.waitJoin && this.waitJoin.uid === uid) this.waitJoin = null;
    if (this._joinT && Date.now() - this._joinT < 6000) return; // aynı yanıt iki yoldan gelirse bir kez katıl
    this._joinT = Date.now();
    uiFriendJoin(String(code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8), nick);
  },
  /* odadayken ya da yanıt beklerken gelen kutusuna sık bak (3 sn) */
  async fastInbox() {
    if (!this.acc || !this.uid || this._fiBusy || document.hidden) return;
    const st = this.myState(), waiting = this.waitJoin && Date.now() < this.waitJoin.until;
    if (this.waitJoin && !waiting) { uiToast(this.waitJoin.nick + ' isteğine yanıt vermedi.'); this.waitJoin = null; }
    if (!(st.s === 'lobby' || waiting)) return;
    this._fiBusy = true;
    try {
      const inbox = await ACC.db('GET', 'users/' + this.uid + '/inbox') || {}, now = ACC.now();
      for (const from in inbox) {
        const m = inbox[from] || {}, nick = String(m.nick || 'Oyuncu').slice(0, 16);
        if (m.t !== 'join' && m.t !== 'joinok' && m.t !== 'joinno') continue;
        ACC.inboxDel(from).catch(() => { });
        if (now - (m.ts || 0) > 90000 || !this.isFriend(from)) continue; // eski ya da arkadaş olmayan
        if (m.t === 'join') {
          if (G.running || !(st.s === 'lobby' && st.code)) { this.inboxPut(from, { t: 'joinno', why: G.running ? 'Arkadaşın şu an maçta.' : 'Arkadaşın bir odada değil.' }); continue; }
          if (!this.pops.some(p => p.kind === 'join' && p.uid === from)) uiFriendPopup('join', from, nick);
        } else if (m.t === 'joinok') { if (m.code) this.joinAccepted(from, m.code, nick); }
        else { if (this.waitJoin && this.waitJoin.uid === from) this.waitJoin = null; uiToast(nick + ': ' + String(m.why || 'İstek reddedildi.').slice(0, 80)); }
      }
    } catch (e) { }
    this._fiBusy = false;
  },
  /* ---- kendi durumum ---- */
  myState() {
    if (G.running && S) return { s: 'game', code: NET.mode !== 'off' ? (NET.code || (NET.lobby && NET.lobby.code) || null) : null };
    if (NET.mode !== 'off' && NET.lobby && (UI.screen === 'scr-lobby' || UI.screen === 'scr-select')) return { s: UI.screen === 'scr-select' ? 'game' : 'lobby', code: NET.code || NET.lobby.code || null };
    return { s: 'menu', code: null };
  },
  tick() {
    if (!this.acc || !this.nick) return;
    if (!this.peer) this.start();
    this._syncT = (this._syncT || 0) + 3;
    if (this._syncT >= 15 && !document.hidden) { this._syncT = 0; this.doSync(); }
    const s = this.myState();
    if (s.s !== this.st.s || s.code !== this.st.code) {
      this.st = s;
      for (const uid in this.conns) { const c = this.conns[uid]; if (c.open && this.isFriend(uid)) this.raw(c, { t: 'st', st: s.s, code: s.code }); }
    }
    this._pollT = (this._pollT || 0) + 3;
    if (this._pollT >= 20) { this._pollT = 0; this.pollAll(); }
    this.fastInbox();
  },
  onlineCount() { return this.list.filter(f => f.online).length; }
};
function frAgo(t) {
  if (!t) return 'hiç görülmedi';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return 'az önce';
  if (s < 3600) return Math.round(s / 60) + ' dk önce';
  if (s < 86400) return Math.round(s / 3600) + ' saat önce';
  const d = new Date(t); return Math.round(s / 86400) + ' gün önce (' + d.toLocaleDateString('tr-TR') + ')';
}
function frStatusText(f) {
  if (!f.online) return 'Çevrimdışı · son görülme ' + frAgo(f.lastSeen);
  if (f.st === 'lobby') return 'Çevrimiçi · Odada' + (f.code ? ' (' + f.code + ')' : '');
  if (f.st === 'game') return 'Çevrimiçi · Maçta';
  return 'Çevrimiçi · Menüde';
}
