/* =====================================================================
   08b · ADMİN PANELİ (yalnızca OZN hesabı)
   · Oyunculara gems ver / sil / sıfırla: Firebase'de gk/<anahtar>/<kayıt> altına bir kayıt
     bırakılır; oyuncu oyuna girince (SHOP.claimGifts) hesabına işlenir. Anahtar, kullanıcı adının
     hesap e-postasındaki koddur (n<kod>@spike-oyun.app). Bu yolu Firebase kuralları yalnızca
     admin'e ve kaydın sahibine açar.
   · Oyun içi güçler (can, kalkan, mermi, hız, atak gücü, gizli admin silahı): oyunu bu cihaz
     yönetiyorsa çalışır (tek oyunculu ya da kendi kurduğun oda); başkasının odasında kapalıdır.
   ===================================================================== */
const ADM = { email: 'nn55g4@spike-oyun.app', spd: [1, 1.5, 2, 3], dmg: [1, 2, 5, 10], open: false, gm: '' };
function admIs() { try { return !!(FR && FR.acc && ACC.uid && ACC.nick && ACC.email(ACC.nick) === ADM.email); } catch (e) { return false; } }
function admKey(nick) { const e = ACC.email(nick); return e.slice(1, e.indexOf('@')); }
function admMe() { return G.running && S && S.pmap ? S.pmap[G.myId] : null; }
function admGameOk() { return !!(admMe() && G.mode !== 'client'); }

function admOpen() {
  if (!admIs()) return;
  ADM.open = true; UI.admOpen = true; UI.overlay = true; MOUSE.down = false;
  $('admOv').classList.remove('hidden');
  try { unlockPointer(); syncCursor(); } catch (e) { }
  $('admWho').textContent = 'Admin: ' + ACC.nick;
  ADM.gm = ''; $('admGameMsg').textContent = '';
  admRender();
}
function admClose() {
  ADM.open = false; UI.admOpen = false;
  $('admOv').classList.add('hidden');
  UI.overlay = UI.pauseOpen || UI.buyOpen || !!UI.setOpen;
  try { syncCursor(); } catch (e) { }
}
function admRender() {
  const me = admMe(), ok = admGameOk(), sp = (me && me.admSpd) || 1, dm = (me && me.admDmg) || 1;
  $('admSpd').textContent = '» HIZ ×' + sp; $('admSpd').classList.toggle('on', sp > 1);
  $('admDmg').textContent = '✦ GÜÇ ×' + dm; $('admDmg').classList.toggle('on', dm > 1);
  for (const b of document.querySelectorAll('#admOv [data-adm]')) b.disabled = !ok;
  $('admGameMsg').textContent = ok ? ADM.gm : G.running ? 'Başkasının odasında kapalı: tek oyunculu ya da kendi kurduğun odada çalışır' : 'Maçtayken kullanılır (tek oyunculu ya da kendi kurduğun oda)';
}

/* ---- oyun içi güçler (bu cihaz oyunu yönetiyorsa doğrudan oyuncuya uygulanır) ---- */
function admGame(c) {
  if (!admIs() || !admGameOk()) { admRender(); return; }
  const me = admMe();
  if (!me.alive && c !== 'spd' && c !== 'dmg') { ADM.gm = 'Önce yeniden doğman gerekiyor'; admRender(); return; }
  let m = '';
  switch (c) {
    case 'hp': me.hp = Math.min(999, Math.ceil(me.hp) + 100); m = 'CAN ' + Math.ceil(me.hp); break;
    case 'ar': me.armor = Math.min(999, Math.ceil(me.armor || 0) + 50); m = 'KALKAN ' + me.armor; break;
    case 'am': {
      let any = false;
      for (const id of [me.primary, me.secondary]) {
        const w = id && WEAPONS[id]; if (!w || w.melee) continue;
        const a = me.ammo[id] || (me.ammo[id] = { mag: 0, res: 0 });
        a.mag = w.mag; a.res = Math.min(9999, (a.res || 0) + 100); any = true;
      }
      m = any ? 'MERMİ +100 · şarjör dolu' : 'Elinde mermili silah yok'; break;
    }
    case 'spd': { const L = ADM.spd; me.admSpd = L[(L.indexOf(me.admSpd || 1) + 1) % L.length]; m = 'HIZ ×' + me.admSpd; break; }
    case 'dmg': { const L = ADM.dmg; me.admDmg = L[(L.indexOf(me.admDmg || 1) + 1) % L.length]; m = 'ATAK GÜCÜ ×' + me.admDmg; break; }
    case 'gun': {
      if (PKMAP) { m = 'Parkurda silah kullanılamaz'; break; }
      const w = WEAPONS.admin;
      me.primary = 'admin'; me.ammo.admin = { mag: w.mag, res: w.res };
      me.slot = 1; me.switchT = 0.2; me.reloadT = 0; me.scoped = false;
      m = 'ADMİN SİLAHI ELİNDE (1. yuva)'; break;
    }
    default: return;
  }
  ADM.gm = m;
  showMsg(null, 'ADMİN · ' + m, PAL.gold); AU.play('buy');
  admRender();
}

/* ---- oyunculara gems ver / sil / sıfırla ---- */
async function admGems(kind) {
  if (!admIs()) return;
  const msg = $('admGemMsg'), nick = $('admNick').value.trim(), amt = Math.floor(+$('admAmt').value || 0);
  const bad = t => { msg.style.color = '#ff6b78'; msg.textContent = t; };
  if (!FR.validNick(nick)) return bad('Geçerli bir kullanıcı adı yaz (3–16 karakter)');
  if (kind !== 'zero' && !(amt > 0 && amt <= 1000000)) return bad('Miktar 1 ile 1.000.000 arasında olmalı');
  const rec = { g: kind === 'give' ? amt : kind === 'take' ? -amt : 0, by: ACC.nick, ts: { '.sv': 'timestamp' } };
  if (kind === 'zero') rec.z = 1;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7), btns = ['admGive', 'admTake', 'admZero'].map($);
  msg.style.color = ''; msg.textContent = 'Gönderiliyor…'; btns.forEach(b => { b.disabled = true; });
  try {
    await ACC.db('PUT', 'gk/' + admKey(nick) + '/' + id, rec);
    msg.textContent = '✓ ' + nick + ': ' + (kind === 'give' ? '+' + amt + ' GEMS' : kind === 'take' ? '−' + amt + ' GEMS' : 'GEMS SIFIRLANDI') + ' · oyuna girince hesabına işlenir';
    if (admKey(nick) === admKey(ACC.nick)) SHOP.claimGifts(); // kendine verdiysen hemen işle
  } catch (e) {
    bad(/DB 40[13]/.test(e.message) ? '✗ İzin yok: Firebase kurallarına admin (gk) kuralı eklenmemiş' : '✗ ' + ACC.errText(e.message));
  } finally { btns.forEach(b => { b.disabled = false; }); }
}

/* admin hesabıyla girilince düğmeleri göster (giriş/çıkış değişebilir: saniyede bir bak) */
function admVis() {
  const on = admIs();
  $('btnAdmin').classList.toggle('hidden', !on); $('btnPauseAdm').classList.toggle('hidden', !on);
  if (!on && ADM.open) admClose();
  else if (ADM.open) admRender();
}
function admInit() {
  $('btnAdmin').onclick = () => admOpen();
  $('btnPauseAdm').onclick = () => admOpen();
  $('admClose').onclick = () => admClose();
  $('admGive').onclick = () => admGems('give');
  $('admTake').onclick = () => admGems('take');
  $('admZero').onclick = () => admGems('zero');
  for (const b of document.querySelectorAll('#admOv [data-adm]')) b.onclick = () => admGame(b.dataset.adm);
  $('admOv').addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); admClose(); } });
  $('admNick').addEventListener('keydown', e => { if (e.key === 'Enter') $('admAmt').focus(); });
  admVis(); setInterval(admVis, 1000);
}
