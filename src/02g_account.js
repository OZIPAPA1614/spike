/* =====================================================================
   02g · HESAP SİSTEMİ (Firebase: kullanıcı adı + şifre)
   Kayıt/giriş Firebase Authentication REST API'si ile yapılır; kullanıcı
   adı içeride benzersiz bir e-postaya çevrilir (aynı ad iki kez alınamaz).
   Veritabanı (Realtime Database REST):
     users/<uid>/p        { nick, lastSeen, st, code }   herkese açık durum
     users/<uid>/friends  { <uid>: nick }                arkadaş listesi
     users/<uid>/inbox    { <gönderen>: { t:'req'|'acc'|'unf', nick, ts } }
   Şifre hiçbir yerde saklanmaz; cihazda yalnızca oturum yenileme anahtarı tutulur.
   ===================================================================== */
const FB = {
  apiKey: 'AIzaSyBFUACPXMC5skW3V1KLrwp_8NMhfK7H5fQ',
  db: 'https://spike-oyun-default-rtdb.europe-west1.firebasedatabase.app',
  auth: 'https://identitytoolkit.googleapis.com/v1/',
  tok: 'https://securetoken.googleapis.com/v1/token'
};
if (typeof window !== 'undefined' && window.__FB_OPTS) Object.assign(FB, window.__FB_OPTS); // (yalnızca testler)
const ACC = {
  uid: null, nick: null, idToken: null, refresh: null, exp: 0, skew: 0, guest: false, busy: false,
  /* kullanıcı adı → benzersiz e-posta (büyük/küçük harf farkı yok, Türkçe harfler korunur) */
  email(nick) {
    const b = new TextEncoder().encode(String(nick).trim().toLocaleLowerCase('tr-TR'));
    const A = 'abcdefghijklmnopqrstuvwxyz234567'; let bits = 0, v = 0, s = '';
    for (const x of b) { v = (v << 8) | x; bits += 8; while (bits >= 5) { s += A[(v >>> (bits - 5)) & 31]; bits -= 5; } }
    if (bits > 0) s += A[(v << (5 - bits)) & 31];
    return 'n' + s + '@spike-oyun.app';
  },
  errText(code) {
    const c = String(code || '');
    if (/EMAIL_EXISTS/.test(c)) return 'Bu kullanıcı adı alınmış, başka bir ad seç.';
    if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND|INVALID_EMAIL/.test(c)) return 'Kullanıcı adı ya da şifre hatalı.';
    if (/WEAK_PASSWORD/.test(c)) return 'Şifre en az 6 karakter olmalı.';
    if (/TOO_MANY_ATTEMPTS/.test(c)) return 'Çok fazla deneme yapıldı, biraz sonra tekrar dene.';
    if (/USER_DISABLED/.test(c)) return 'Bu hesap kapatılmış.';
    if (/NETWORK|Failed to fetch|NetworkError|TypeError/i.test(c)) return 'Sunucuya ulaşılamadı — internet bağlantını kontrol et.';
    return 'Bir hata oluştu (' + c.slice(0, 60) + ').';
  },
  async post(url, body, form) {
    let r;
    try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' }, body: form ? body : JSON.stringify(body) }); }
    catch (e) { throw new Error('NETWORK'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && (j.error.message || j.error)) || ('HTTP ' + r.status));
    return j;
  },
  setSession(uid, idToken, refresh, expiresIn) {
    this.uid = uid; this.idToken = idToken; this.refresh = refresh; this.exp = Date.now() + (parseInt(expiresIn, 10) || 3600) * 1000;
    this.save();
  },
  save() { try { if (this.uid && this.refresh) localStorage.setItem('spk_acc', JSON.stringify({ uid: this.uid, nick: this.nick, refresh: this.refresh })); } catch (e) { } },
  load() { try { const a = JSON.parse(localStorage.getItem('spk_acc') || 'null'); if (a && a.uid && a.refresh) { this.uid = a.uid; this.nick = a.nick; this.refresh = a.refresh; return true; } } catch (e) { } return false; },
  logout() { try { localStorage.removeItem('spk_acc'); } catch (e) { } this.uid = this.nick = this.idToken = this.refresh = null; },
  async token() {
    if (this.idToken && Date.now() < this.exp - 60000) return this.idToken;
    if (!this.refresh) throw new Error('NO_SESSION');
    const j = await this.post(FB.tok + '?key=' + FB.apiKey, 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(this.refresh), true);
    this.setSession(j.user_id || this.uid, j.id_token, j.refresh_token || this.refresh, j.expires_in);
    return this.idToken;
  },
  async db(method, path, body) {
    const t = await this.token();
    let r;
    try { r = await fetch(FB.db + '/' + path + '.json?auth=' + encodeURIComponent(t), { method, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch (e) { throw new Error('NETWORK'); }
    if (!r.ok) throw new Error('DB ' + r.status);
    return r.json();
  },
  /* ---- kayıt / giriş ---- */
  async signUp(nick, pass) {
    nick = String(nick).trim();
    const j = await this.post(FB.auth + 'accounts:signUp?key=' + FB.apiKey, { email: this.email(nick), password: pass, returnSecureToken: true });
    this.nick = nick; this.setSession(j.localId, j.idToken, j.refreshToken, j.expiresIn);
    await this.db('PATCH', 'users/' + this.uid + '/p', { nick, lastSeen: { '.sv': 'timestamp' }, st: 'menu', code: '' });
    return true;
  },
  async signIn(nick, pass) {
    nick = String(nick).trim();
    const j = await this.post(FB.auth + 'accounts:signInWithPassword?key=' + FB.apiKey, { email: this.email(nick), password: pass, returnSecureToken: true });
    this.setSession(j.localId, j.idToken, j.refreshToken, j.expiresIn);
    let n = null; try { n = await this.db('GET', 'users/' + this.uid + '/p/nick'); } catch (e) { }
    this.nick = n || nick; this.save();
    return true;
  },
  /* ---- arkadaş işlemleri (sunucuda kalıcı) ---- */
  async friendAdd(uid, nick) { await this.db('PUT', 'users/' + this.uid + '/friends/' + uid, String(nick).slice(0, 16)); },
  async friendDel(uid) { await this.db('DELETE', 'users/' + this.uid + '/friends/' + uid); },
  async send(uid, t) { await this.db('PUT', 'users/' + uid + '/inbox/' + this.uid, { t, nick: this.nick, ts: { '.sv': 'timestamp' } }); },
  async inboxDel(uid) { await this.db('DELETE', 'users/' + this.uid + '/inbox/' + uid); },
  /* ---- düzenli eşitleme: durumumu yaz, arkadaşları/gelen kutusunu oku ---- */
  async sync(st, code) {
    const t0 = Date.now();
    await this.db('PATCH', 'users/' + this.uid + '/p', { nick: this.nick, lastSeen: { '.sv': 'timestamp' }, st: st || 'menu', code: code || '' });
    const me = await this.db('GET', 'users/' + this.uid) || {};
    if (me.p && me.p.lastSeen) this.skew = me.p.lastSeen - Math.round((t0 + Date.now()) / 2);
    const out = { friends: me.friends || {}, inbox: me.inbox || {}, pres: {} };
    try { if (typeof SHOP !== 'undefined') { SHOP.cloud(me.prof); SHOP.claimGifts(); } } catch (e) { } // gems/skin profili eşitle + admin hediyeleri
    await Promise.all(Object.keys(out.friends).slice(0, 40).map(async f => { try { out.pres[f] = await this.db('GET', 'users/' + f + '/p'); } catch (e) { } }));
    return out;
  },
  now() { return Date.now() + this.skew; }
};
