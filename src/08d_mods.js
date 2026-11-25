/* =====================================================================
   08d · JAVASCRIPT MODLARI (Garry's Mod'daki Lua gibi)
        Modlar SERBEST modda, oyunu yöneten cihazda (tek oyunculu ya da odayı
        kuran) ayrı bir iş parçacığında (Web Worker) çalışır:
          · sayfaya, hesaplara, şifrelere, tarayıcı depolamasına erişemez
          · sonsuz döngü oyunu dondurmaz (mod durdurulabilir)
          · oyuna yalnızca "nova" arayüzüyle istek gönderebilir; her istek
            burada denetlenir (tür, sınır, saniyedeki sayı)
        Diğer oyuncular mod kodunu çalıştırmaz; etkileri (NPC'ler, can, mesaj…)
        anlık görüntüyle gider.
        API: nova.npc / spawn / msg / setHp / setArmor / setSpeed / give / pill /
             teleport / clearNpcs / removeNpc / kill / on('tick'|'kill'|'chat'|'spawn')
   ===================================================================== */
const MODS = { run: [], log: [], tickT: 0, max: 6, size: 100000, edit: -1 };
const MOD_EXAMPLE = `// ÖRNEK MOD — kopyala, değiştir, kendi modunu yap!
// Kırmızı Kafa adında bir NPC tanımlar ve sohbet komutları ekler.

nova.npc({
  id: 'kirmizi', name: 'Kırmızı Kafa', speed: 360, hp: 0, damage: 999, size: 1.2,
  draw(g) {                       // 96x96 tuvale çiz (ya da image: 'data:image/png;base64,...')
    g.fillStyle = '#c0182b'; g.fillRect(0, 0, 96, 96);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(30, 38, 12, 0, 7); g.arc(66, 38, 12, 0, 7); g.fill();
    g.fillStyle = '#000'; g.beginPath(); g.arc(30, 40, 5, 0, 7); g.arc(66, 40, 5, 0, 7); g.fill();
    g.fillRect(22, 64, 52, 9);
  }
});

nova.on('chat', (p, text) => {
  if (text === '!yağmur') for (let i = 0; i < 5; i++) nova.spawn('kirmizi', p.x + Math.random() * 600 - 300, p.y + Math.random() * 600 - 300);
  if (text === '!can') { nova.setHp(p.id, 500); nova.msg(p.name + ' 500 can aldı', p.id); }
  if (text === '!hız') nova.setSpeed(p.id, 2);
  if (text === '!temizle') nova.clearNpcs();
});

nova.on('kill', (killer, victim) => {
  if (killer) nova.msg(killer.name + ' → ' + victim.name);
});

nova.msg('Örnek mod yüklendi! Sohbete !yağmur, !can, !hız ya da !temizle yaz.');
`;
/* işçi (worker) içinde çalışan başlatıcı: nova arayüzü + olay dağıtımı */
const MOD_BOOT = `"use strict";
(() => {
  const H = {}, post = o => postMessage(o);
  let st = { players: [], npcs: [], time: 0, map: null }, errN = 0, errT = 0;
  const report = (e) => { const now = Date.now(); if (now - errT > 1000) { errT = now; errN = 0; } if (errN++ < 5) post({ t: 'err', m: String(e && e.stack || e).slice(0, 400) }); };
  const cmd = (c, a) => post({ t: 'cmd', c, a });
  const pl = id => st.players.find(p => p.id === id) || null;
  const nova = {
    get players() { return st.players.slice(); }, get npcs() { return st.npcs.slice(); },
    get time() { return st.time; }, get map() { return st.map; },
    player: pl,
    on(e, f) { if (typeof f === 'function') (H[e] || (H[e] = [])).push(f); },
    npc(d) {
      d = Object.assign({}, d || {});
      const send = img => post({ t: 'npc', d: { id: String(d.id || d.name || 'npc'), name: String(d.name || d.id || 'NPC'), img, speed: +d.speed || 320, hp: +d.hp || 0, damage: +d.damage || 999, size: +d.size || 1.1 } });
      if (typeof d.image === 'string') return send(d.image);
      if (typeof d.draw === 'function') {
        if (typeof OffscreenCanvas === 'undefined') { report('Bu tarayıcı modda çizimi desteklemiyor: draw yerine image kullan'); return; }
        const c = new OffscreenCanvas(96, 96), g = c.getContext('2d');
        try { d.draw(g); } catch (e) { report(e); return; }
        c.convertToBlob({ type: 'image/png' }).then(b => { const r = new FileReader(); r.onload = () => send(r.result); r.readAsDataURL(b); });
        return;
      }
      report('nova.npc: draw ya da image gerekli');
    },
    spawn(k, x, y) { cmd('spawn', { k: String(k), x: +x, y: +y }); },
    msg(text, to) { cmd('msg', { text: String(text), to: to || null }); },
    setHp(id, v) { cmd('hp', { id, v: +v }); }, setArmor(id, v) { cmd('armor', { id, v: +v }); },
    setSpeed(id, m) { cmd('speed', { id, v: +m }); }, give(id, w) { cmd('give', { id, w: String(w) }); },
    pill(id, k) { cmd('pill', { id, k: String(k || '') }); }, teleport(id, x, y) { cmd('tp', { id, x: +x, y: +y }); },
    clearNpcs() { cmd('clear', {}); }, removeNpc(id) { cmd('rmnpc', { id }); }, kill(id) { cmd('kill', { id }); }
  };
  const fire = (e, ...a) => { for (const f of H[e] || []) { try { f(...a); } catch (er) { report(er); } } };
  self.onmessage = ev => {
    const d = ev.data || {};
    if (d.t === 'init') {
      st.map = d.map;
      try { (new Function('nova', '"use strict";\\n' + d.code))(nova); post({ t: 'ok' }); } catch (e) { report(e); }
    } else if (d.t === 'tick') { const dt = d.s.time - st.time; st = Object.assign(st, d.s); fire('tick', dt); }
    else if (d.t === 'ev') {
      if (d.e === 'kill') fire('kill', pl(d.a), pl(d.v));
      else if (d.e === 'chat') { const p = pl(d.id); if (p) fire('chat', p, d.text); }
      else if (d.e === 'spawn') { const p = pl(d.id); if (p) fire('spawn', p); }
    }
  };
})();`;
function modList() { try { const a = JSON.parse(localStorage.getItem('spk_mods') || '[]'); return Array.isArray(a) ? a.filter(m => m && typeof m.code === 'string') : []; } catch (e) { return []; } }
function modSave(a) { try { localStorage.setItem('spk_mods', JSON.stringify(a)); return true; } catch (e) { uiToast('Mod kaydedilemedi: tarayıcı depolaması dolu', true); return false; } }
function modHostOk() { return !!(G.running && S && frOn() && G.mode !== 'client'); }
function modLog(name, m, bad) { MODS.log.unshift({ n: name, m: String(m).slice(0, 300), bad: !!bad }); if (MODS.log.length > 30) MODS.log.length = 30; if (FRM.open && FRM.tab === 'm') frMenuRender(); }
/* ---------- çalıştır / durdur ---------- */
function modStopAll() { for (const r of MODS.run) { try { r.w.terminate(); } catch (e) { } } MODS.run = []; }
function modStartAll() {
  modStopAll();
  if (!modHostOk() || typeof Worker === 'undefined') return;
  modList().forEach((m, i) => { if (m.on) modStart(m, i); });
}
function modStart(m, i) {
  let w;
  try { const url = URL.createObjectURL(new Blob([MOD_BOOT], { type: 'text/javascript' })); w = new Worker(url); URL.revokeObjectURL(url); }
  catch (e) { modLog(m.name, 'Mod başlatılamadı: ' + e.message, true); return; }
  const rec = { m, i, w, kinds: {}, budget: 0 };
  w.onmessage = e => { try { modMsg(rec, e.data || {}); } catch (er) { modLog(m.name, 'Hatalı istek: ' + er.message, true); } };
  w.onerror = e => { e.preventDefault && e.preventDefault(); modLog(m.name, e.message || 'hata', true); };
  w.postMessage({ t: 'init', code: m.code, map: { w: WW, h: WH, tile: TILE, name: MAPDATA && MAPDATA.name } });
  MODS.run.push(rec);
}
/* host adımı: modlara saniyede 10 kez oyun durumu gönder */
function modTick(dt) {
  if (!MODS.run.length) return;
  MODS.tickT -= dt; if (MODS.tickT > 0) return; MODS.tickT = 0.1;
  const s = { time: Math.round(S.time * 100) / 100,
    players: S.players.map(p => ({ id: p.id, name: p.name, team: p.team, x: Math.round(p.x), y: Math.round(p.y), ang: r2(p.ang), hp: Math.ceil(p.hp), armor: Math.ceil(p.armor), alive: p.alive, pill: p.pill || '', bot: !!p.isBot, kills: p.kills, deaths: p.deaths, weapon: curW(p) })),
    npcs: (S.npcs || []).map(n => ({ id: n.id, kind: n.k, x: Math.round(n.x), y: Math.round(n.y), hp: Math.ceil(n.hp || 0) })) };
  for (const r of MODS.run) { r.budget = 0; r.w.postMessage({ t: 'tick', s }); }
}
function modEvent(e) { if (!MODS.run.length) return; for (const r of MODS.run) r.w.postMessage(Object.assign({ t: 'ev' }, e)); }
/* ---------- modun isteklerini denetle ve uygula ---------- */
function modMsg(rec, d) {
  const name = rec.m.name;
  if (d.t === 'err') { modLog(name, d.m, true); return; }
  if (d.t === 'ok') { modLog(name, 'yüklendi'); return; }
  if (!modHostOk()) return;
  if (d.t === 'npc') {
    const x = d.d || {}, id = String(x.id).replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 20) || 'npc', img = String(x.img || '');
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > 80000) { modLog(name, 'NPC "' + id + '": resim geçersiz ya da çok büyük (en fazla ~60 KB)', true); return; }
    const k = 'm' + rec.i + '_' + id, K = S.npcK || (S.npcK = {});
    K[k] = { n: String(x.name).slice(0, 20), img, spd: clamp(+x.speed || 320, 60, 900), hp: x.hp > 0 ? clamp(+x.hp, 1, 100000) : 0, dmg: clamp(+x.damage || 999, 0, 9999), sz: clamp(+x.size || 1.1, 0.3, 4), mod: 1 };
    rec.kinds[id] = k; delete NPCV.tex[k]; delete NPCV.prev[k];
    if (FRM.open) frMenuRender();
    return;
  }
  if (d.t !== 'cmd' || ++rec.budget > 120) return; // saniyede ~1200'den fazla istek yok sayılır
  const a = d.a || {}, P = S.pmap[a.id];
  switch (d.c) {
    case 'spawn': {
      const k = rec.kinds[a.k] || (NPC_KINDS[a.k] ? a.k : (S.npcK && S.npcK[a.k] ? a.k : null));
      if (!k || !isFinite(a.x) || !isFinite(a.y) || (S.npcs || []).length >= FR_MAXNPC) return;
      const f = findFree(clamp(a.x, TILE, WW - TILE), clamp(a.y, TILE, WH - TILE), PR);
      S.npcs.push({ id: 'n' + nid(), k, x: r1(f.x), y: r1(f.y), hp: npcKind(k).hp || 0, path: null, pi: 0, rp: 0, hitT: S.time + 0.8 });
      break;
    }
    case 'msg': { const t = String(a.text || '').slice(0, 140); if (t) emit(Object.assign({ k: 'msg', small: '[' + String(name).slice(0, 20) + '] ' + t }, a.to && S.pmap[a.to] ? { to: a.to } : {})); break; }
    case 'hp': if (P && P.alive && isFinite(a.v)) { P.hp = clamp(Math.round(a.v), 1, 9999); } break;
    case 'armor': if (P && P.alive && isFinite(a.v)) P.armor = clamp(Math.round(a.v), 0, 9999); break;
    case 'speed': if (P && isFinite(a.v)) P.modSpd = clamp(a.v, 0.2, 5); break;
    case 'give': if (P) frGive(P, String(a.w)); break;
    case 'pill': if (P) frPill(P, rec.kinds[a.k] || a.k); break;
    case 'tp': if (P && P.alive && isFinite(a.x) && isFinite(a.y)) { const f = findFree(clamp(a.x, TILE, WW - TILE), clamp(a.y, TILE, WH - TILE), PR); setPos(P, f.x, f.y); } break;
    case 'clear': if (S.npcs) S.npcs.length = 0; break;
    case 'rmnpc': if (S.npcs) S.npcs = S.npcs.filter(n => n.id !== a.id); break;
    case 'kill': if (P && P.alive) damage(P, 99999, null, 'mod'); break;
  }
}
/* ---------- MODLAR sekmesi (spawn menüsü) ---------- */
function modMenuHtml() {
  const L = modList(), host = modHostOk();
  let h = '<div class="note" style="color:var(--dim)">' + (host ? 'Modlar bu cihazda, ayrı ve kapalı bir alanda çalışır: hesabına, şifrene ve sayfaya erişemez. Odadakiler etkilerini görür.' : 'Bu odada modları odayı kuran kişi çalıştırır. Kendi modlarını tek oyunculu SERBEST modda ya da kendi kurduğun odada kullanabilirsin.') + '</div>';
  h += '<div class="frgrid modgrid">' + (L.length ? L.map((m, i) => '<div class="frc modc"><b>' + esc(m.name) + '</b><small>' + Math.round(m.code.length / 102.4) / 10 + ' KB</small><div class="admrow"><button class="' + (m.on ? 'primary' : 'ghost') + '" data-mt="' + i + '">' + (m.on ? 'AÇIK' : 'KAPALI') + '</button><button class="ghost" data-me="' + i + '">DÜZENLE</button><button class="ghost" data-md="' + i + '">SİL</button></div></div>').join('') : '<div class="note">Henüz mod yok. Aşağıdan örnek modu ekleyip dene.</div>') + '</div>';
  h += '<h4 class="frh">' + (MODS.edit >= 0 ? 'MODU DÜZENLE' : 'YENİ MOD') + '</h4>' +
    '<input id="modName" maxlength="24" placeholder="Mod adı" autocomplete="off" style="width:100%;margin-top:6px">' +
    '<textarea id="modCode" spellcheck="false" placeholder="nova.on(\'chat\', (p, text) => { ... })"></textarea>' +
    '<div class="admrow"><button id="modSave" class="primary">KAYDET VE AÇ</button><button id="modEx" class="ghost">ÖRNEK MOD</button><input id="modUrl" placeholder="ya da .js linki" autocomplete="off"><button id="modGet" class="ghost">LİNKTEN AL</button></div>';
  if (MODS.log.length) h += '<h4 class="frh">MOD GÜNLÜĞÜ</h4><div class="modlog">' + MODS.log.slice(0, 12).map(l => '<div class="' + (l.bad ? 'bad' : '') + '">' + esc(l.n) + ': ' + esc(l.m) + '</div>').join('') + '</div>';
  return h;
}
function modMenuBind(body) {
  const L = modList();
  if (MODS.edit >= 0 && L[MODS.edit]) { $('modName').value = L[MODS.edit].name; $('modCode').value = L[MODS.edit].code; }
  else MODS.edit = -1;
  for (const b of body.querySelectorAll('[data-mt]')) b.onclick = () => { const a = modList(), m = a[+b.dataset.mt]; m.on = !m.on; modSave(a); modStartAll(); frMenuRender(); };
  for (const b of body.querySelectorAll('[data-md]')) b.onclick = () => { const a = modList(); a.splice(+b.dataset.md, 1); modSave(a); MODS.edit = -1; modStartAll(); frMenuRender(); };
  for (const b of body.querySelectorAll('[data-me]')) b.onclick = () => { MODS.edit = +b.dataset.me; frMenuRender(); };
  $('modEx').onclick = () => { $('modName').value = 'Örnek Mod'; $('modCode').value = MOD_EXAMPLE; MODS.edit = -1; };
  $('modGet').onclick = async () => {
    const u = $('modUrl').value.trim(); if (!/^https:\/\//.test(u)) { uiToast('https:// ile başlayan bir link yaz', true); return; }
    try { const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); const t = await r.text(); if (t.length > MODS.size) throw new Error('dosya çok büyük'); $('modCode').value = t; if (!$('modName').value) $('modName').value = u.split('/').pop().replace(/\.js$/, '').slice(0, 24); MODS.edit = -1; }
    catch (e) { uiToast('Link okunamadı (' + e.message + '). Kodu kopyalayıp kutuya yapıştırabilirsin.', true); }
  };
  $('modSave').onclick = () => {
    const name = $('modName').value.trim().slice(0, 24), code = $('modCode').value;
    if (!name) { uiToast('Moda bir ad ver', true); return; }
    if (!code.trim()) { uiToast('Mod kodu boş', true); return; }
    if (code.length > MODS.size) { uiToast('Mod en fazla 100 KB olabilir', true); return; }
    const a = modList();
    if (MODS.edit >= 0 && a[MODS.edit]) { a[MODS.edit].name = name; a[MODS.edit].code = code; a[MODS.edit].on = true; }
    else { if (a.length >= MODS.max) { uiToast('En fazla ' + MODS.max + ' mod olabilir', true); return; } a.push({ name, code, on: true }); }
    if (!modSave(a)) return;
    MODS.edit = -1; modStartAll(); uiToast(name + ' kaydedildi' + (modHostOk() ? ' ve açıldı' : '')); frMenuRender();
  };
}
