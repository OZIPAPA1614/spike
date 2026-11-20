/* =====================================================================
   02i · HERKESE AÇIK SUNUCULAR
   "HERKESE AÇIK SUNUCUYA KATIL" denince oyun, Firebase'deki açık oda
   listesinden (pub/<kod>) uygun bir odayı seçip seni oraya bağlar; boş
   oda yoksa yeni bir açık oda kurar ve başkalarının gelmesini bekler.
   · Açık odayı kuran oyuncu (host) her 8 sn listede "hâlâ buradayım" der;
     30 sn haber vermeyen oda listede görünmez, 2 dk sonra silinir.
   · Lobide en az 2 kişi olunca maç 25 sn içinde kendiliğinden başlar
     (10 kişi dolarsa 3 sn). Boş yerleri botlar doldurur.
   · Maç başlayan odalar listeden çıkar; oyun sürümü farklı odalara girilmez.
   ===================================================================== */
const GAME_VER = 13;
const PUB = {
  on: false, code: null, timer: null, autoTimer: null, skew: 0, skewOk: false, searching: false, cancelled: false,
  async req(method, path, body, keep) {
    let r;
    try { r = await fetch(FB.db + '/' + path + '.json', { method, body: body === undefined ? undefined : JSON.stringify(body), keepalive: !!keep }); }
    catch (e) { throw new Error('NETWORK'); }
    if (!r.ok) throw new Error('DB ' + r.status);
    return r.json();
  },
  /* sunucu saati (oda kayıtlarının tazeliğini doğru ölçmek için) */
  async clock() {
    if (this.skewOk) return;
    const t0 = Date.now(), v = await this.req('PUT', 'clk', { '.sv': 'timestamp' }), t1 = Date.now();
    if (typeof v === 'number') { this.skew = v - (t0 + t1) / 2; this.skewOk = true; }
  },
  now() { return Date.now() + this.skew; },
  humans() { return NET.lobby ? NET.lobby.players.filter(p => !p.bot).length : 0; },
  /* ---- host: odayı herkese aç / kapat ---- */
  start() {
    if (NET.mode !== 'host' || !NET.lobby) return;
    this.on = true; NET.lobby.pub = true; this.code = NET.code;
    this.beat();
    clearInterval(this.timer); this.timer = setInterval(() => this.beat(), 8000);
    clearInterval(this.autoTimer); this.autoTimer = setInterval(() => this.autoTick(), 1000);
  },
  stop(keepFlag) {
    const c = this.code;
    this.on = false; this.code = null;
    clearInterval(this.timer); clearInterval(this.autoTimer); this.timer = this.autoTimer = null;
    if (NET.lobby && !keepFlag) { NET.lobby.pub = false; NET.lobby.autoAt = 0; }
    if (c) this.req('DELETE', 'pub/' + c).catch(() => { });
  },
  beat() {
    if (!this.on || NET.mode !== 'host' || !NET.code || !NET.lobby) return;
    if (this.code !== NET.code) { if (this.code) this.req('DELETE', 'pub/' + this.code).catch(() => { }); this.code = NET.code; }
    const L = NET.lobby, hostP = L.players.find(p => p.id === 'h');
    this.req('PUT', 'pub/' + NET.code, { n: String(hostP ? hostP.name : 'Oda').slice(0, 16), p: this.humans(), mx: 10, g: L.inGame || NET.sel ? 1 : 0, m: L.cfg.map, ts: { '.sv': 'timestamp' }, v: GAME_VER }).catch(() => { });
  },
  /* lobide yeterli kişi olunca maçı kendiliğinden başlat */
  autoTick() {
    const L = NET.lobby;
    if (!this.on || NET.mode !== 'host' || !L || L.inGame || NET.sel) return;
    const n = this.humans();
    if (n < 2) { if (L.autoAt) { L.autoAt = 0; broadcastLobby(); } return; }
    const want = n >= 10 ? 3000 : 25000, now = Date.now();
    if (!L.autoAt || L.autoAt - now > want) { L.autoAt = now + want; broadcastLobby(); }
    if (now >= L.autoAt) { L.autoAt = 0; this.beat(); selStart(L.players.filter(p => !p.bot), L.cfg); }
  },
  /* ---- açık odaları listele ---- */
  async list() {
    try { await this.clock(); } catch (e) { }
    const all = await this.req('GET', 'pub') || {}, now = this.now(), out = [];
    for (const code in all) {
      const r = all[code]; if (!r || typeof r !== 'object') continue;
      const age = now - (r.ts || 0);
      if (age > 120000) { this.req('DELETE', 'pub/' + code).catch(() => { }); continue; }  // terk edilmiş kaydı temizle
      if (age > 30000 || r.v !== GAME_VER) continue;
      out.push({ code, n: String(r.n || 'Oda'), p: r.p | 0, mx: r.mx | 0 || 10, g: !!r.g, m: r.m });
    }
    return out;
  },
  /* ---- HIZLI KATIL: uygun bir açık odaya gir, yoksa yeni açık oda kur ---- */
  async quickJoin(name, ui) {
    if (this.searching) return;
    this.searching = true; this.cancelled = false;
    try {
      ui.status('Açık sunucular aranıyor…');
      let rooms = [];
      try { rooms = await this.list(); } catch (e) { ui.status('Sunucu listesine ulaşılamadı — yeni bir açık oda kuruluyor…'); }
      if (this.cancelled) return;
      const all = rooms.length, players = rooms.reduce((a, r) => a + r.p, 0);
      ui.info(all ? 'Açık oda: ' + all + ' · Oyuncu: ' + players : 'Şu an açık oda yok');
      // dolmaya en yakın (ama dolu olmayan) lobiler önce; eşit olanlar arasında rastgele
      const cand = rooms.filter(r => !r.g && r.p < r.mx).map(r => ({ r, k: r.p + Math.random() * 0.9 })).sort((a, b) => b.k - a.k).map(x => x.r).slice(0, 4);
      for (const r of cand) {
        if (this.cancelled) return;
        ui.status('Odaya bağlanılıyor: ' + r.n + ' (' + r.p + '/' + r.mx + ')…');
        const ok = await new Promise(res => clientJoin(r.code, name, () => res(true), () => res(false), m => { if (!this.cancelled) ui.status(m); }));
        if (this.cancelled) { if (ok) netShutdown(); return; }
        if (ok) { ui.joined(); return; }
        netShutdown();
      }
      if (this.cancelled) return;
      ui.status('Uygun açık oda yok — yeni bir açık sunucu kuruluyor…');
      await new Promise(res => hostCreate(name, () => {
        if (this.cancelled) { netShutdown(); res(); return; }
        NET.lobby.cfg.map = -1; // açık odalarda harita her maç rastgele
        this.start(); ui.hosted(); res();
      }, err => { ui.fail(err); netShutdown(); res(); }));
    } finally { this.searching = false; }
  },
  cancel() { this.cancelled = true; this.searching = false; if (NET.mode !== 'off') netShutdown(); }
};
/* sekme kapanırken açık oda kaydını hemen sil */
window.addEventListener('pagehide', () => { if (PUB.code) { try { PUB.req('DELETE', 'pub/' + PUB.code, undefined, true).catch(() => { }); } catch (e) { } } });
