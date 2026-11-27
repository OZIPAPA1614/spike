/* =====================================================================
   06b · İÇERİK PAYLAŞIMI (Garry's Mod'daki gibi odaya girerken indirme)
        Kendi NPC'lerin (resim + ses) ve modların yaptığı NPC'ler odadaki herkese
        bir kez, parça parça (16 KB) gönderilir:
          · odaya katılınca: host'un içeriği sana iner, seninki host'a ve
            oradan diğer oyunculara gider (lobide "İÇERİK İNDİRİLİYOR")
          · maçta yeni NPC yapılınca / mod NPC tanımlayınca da aynı yol
        Anlık görüntüde yalnızca NPC'nin adı ve değerleri gider; resim ve ses
        buradan gelir. İstemciden gelen içerik host'ta denetlenir.
   ===================================================================== */
const PAK = { k: {}, inb: {}, up: {}, CH: 16000 };
/* NPC kimliği resim + sesten (aynı içerik = aynı kimlik) */
function kindIdOf(c) { return npcIdOf(String(c.img || '') + String(c.snd || '')); }
/* gelen içeriği denetle (ad, resim, isteğe bağlı ses, değerler) */
function pakValid(o) {
  if (!o || typeof o !== 'object') return null;
  const img = String(o.img || ''), snd = o.snd ? String(o.snd) : '', n = String(o.n || '').trim().slice(0, 20);
  if (!n || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > 80000) return null;
  if (snd && (!/^ima12k:[A-Za-z0-9+/=]+$/.test(snd) || snd.length > 260000)) return null;
  const hp = +o.hp || 0;
  return { n, img, snd: snd || undefined, spd: clamp(+o.spd || 320, 60, 900), hp: hp > 0 ? clamp(hp, 1, 100000) : 0, dmg: clamp(+o.dmg || 999, 0, 9999), sz: clamp(+o.sz || 1.1, 0.3, 4), mod: o.mod ? 1 : undefined };
}
/* bir içeriği bağlantıya parça parça gönder (oyun verisini bekletmeden, kanal boşaldıkça) */
function pakSend(conn, id) {
  const o = PAK.k[id]; if (!conn || !o) return;
  conn._pk = conn._pk || {}; if (conn._pk[id]) return; conn._pk[id] = 1;
  const s = JSON.stringify(o), N = Math.ceil(s.length / PAK.CH), q = conn._pq || (conn._pq = []);
  q.push({ t: 'pk0', id, N, L: s.length, n: o.n });
  for (let i = 0; i < N; i++) q.push({ t: 'pk1', id, i, d: s.slice(i * PAK.CH, (i + 1) * PAK.CH) });
  pakPump(conn);
}
/* Parça yalnızca kanal neredeyse boşken gider: oyun verisi hep önde kalır. (Eskiden kanal 192 KB'a kadar
   doldurulurdu; anlık görüntü 96 KB'ın üstünde atlandığından yavaş bağlantıda içerik inerken istemciye hiç
   görüntü gitmez, maç başında "Host ile bağlantı koptu" diye düşerdi — özellikle 3+ kişide, çünkü bir
   oyuncunun içeriği host üzerinden diğerlerine de aktarılır.) */
const PAK_LOW = 8 * 1024;
function pakPump(conn) {
  if (conn._pumpT) return;
  const step = () => {
    conn._pumpT = 0;
    const dc = conn.dataChannel;
    while (conn._pq && conn._pq.length && conn.open && (!dc || dc.bufferedAmount < PAK_LOW)) netSend(conn, conn._pq.shift());
    if (conn._pq && conn._pq.length && conn.open) conn._pumpT = setTimeout(step, 30);
  };
  step();
}
/* host: tüm içeriği bir oyuncuya; yeni içeriği herkese (gönderen hariç) */
function pakSendAll(conn) { for (const id in PAK.k) pakSend(conn, id); }
function pakBroadcast(id, except) { for (const pid in NET.conns) if (NET.conns[pid] !== except) pakSend(NET.conns[pid], id); }
/* host: kendi kayıtlı NPC'lerini içeriğe ekle (lobi kurulunca / kaydedince) */
function pakAddSaved() {
  for (const c of frSaved()) { const v = pakValid(c), id = kindIdOf(c); if (v && !PAK.k[id]) { PAK.k[id] = v; if (NET.mode === 'host') pakBroadcast(id); } }
}
/* host ya da tek oyunculu: içerik kaydı (oyuncu NPC'si, mod NPC'si); odadakilere de gider */
function pakPut(id, v) {
  PAK.k[id] = v;
  if (NET.mode === 'host') pakBroadcast(id);
}
/* istemci: kendi kayıtlı NPC'lerini host'a yükle (odaya katılınca) */
function pakUploadSaved() {
  if (NET.mode !== 'client' || !NET.conn) return;
  for (const c of frSaved()) { const v = pakValid(c), id = kindIdOf(c); if (v) { PAK.k[id] = PAK.k[id] || v; pakSend(NET.conn, id); } }
}
/* parça geldi (host'ta istemciden, istemcide host'tan) */
function pakRecv(conn, d) {
  if (d.t === 'pk0') {
    if (!(d.N > 0 && d.N <= 20 && d.L > 0 && d.L <= 360000) || typeof d.id !== 'string' || d.id.length > 40) return;
    if (PAK.k[d.id]) { PAK.inb[d.id] = { N: d.N, got: 0, parts: [], have: true }; return; }
    PAK.inb[d.id] = { N: d.N, got: 0, parts: [], n: String(d.n || '').slice(0, 20), from: conn };
    pakUi();
    return;
  }
  const b = PAK.inb[d.id]; if (!b || !(d.i >= 0 && d.i < b.N) || b.parts[d.i] !== undefined) return;
  b.parts[d.i] = String(d.d || ''); b.got++;
  if (b.got < b.N) { if (b.got % 4 === 0) pakUi(); return; }
  delete PAK.inb[d.id];
  if (b.have) { pakUi(); return; }
  let o = null; try { o = JSON.parse(b.parts.join('')); } catch (e) { }
  const v = pakValid(o);
  if (!v) { pakUi(); return; }
  const host = NET.mode === 'host';
  if (host && kindIdOf(v) !== d.id) { pakUi(); return; } // istemciden gelen kimlik içerikle uyuşmalı
  PAK.k[d.id] = v;
  if (host) { pakBroadcast(d.id, conn); if (typeof frPakReady === 'function') frPakReady(d.id); }
  else pakApply(d.id);
  pakUi();
}
/* istemci: maçtaki NPC türüne indirilen resmi/sesi ekle */
function pakApply(id) {
  if (S && S.npcK && S.npcK[id]) { const v = PAK.k[id]; Object.assign(S.npcK[id], { img: v.img, snd: v.snd, wait: undefined }); }
  if (typeof NPCV !== 'undefined') { delete NPCV.tex[id]; delete NPCV.prev[id]; }
  if (typeof NPCS !== 'undefined') delete NPCS.buf[id];
}
/* istemci: anlık görüntüdeki NPC türleri (yalnızca değerler) + indirilen içerik */
function pakMergeKinds(meta) {
  const out = {};
  for (const k in meta || {}) { const m = meta[k], v = PAK.k[k]; out[k] = Object.assign({}, m, v ? { img: v.img, snd: v.snd } : { wait: 1 }); }
  return out;
}
/* host: anlık görüntüye resim/ses olmadan */
function pakMeta(K) {
  if (!K) return 0;
  const o = {}; for (const k in K) { const v = K[k]; o[k] = { n: v.n, spd: v.spd, hp: v.hp, dmg: v.dmg, sz: v.sz, mod: v.mod }; }
  return o;
}
/* lobide indirme durumu */
function pakStatus() {
  const ids = Object.keys(PAK.inb).filter(i => !PAK.inb[i].have);
  let got = 0, tot = 0; for (const i of ids) { got += PAK.inb[i].got; tot += PAK.inb[i].N; }
  return { n: Object.keys(PAK.k).length, dl: ids.length, pct: tot ? Math.round(got / tot * 100) : 100, names: ids.map(i => PAK.inb[i].n).filter(Boolean) };
}
function pakUi() {
  const el = typeof $ === 'function' && $('lbPak'); if (!el) return;
  const s = pakStatus();
  el.textContent = s.dl ? 'İÇERİK İNDİRİLİYOR %' + s.pct + (s.names.length ? ' · ' + s.names.slice(0, 3).join(', ') : '') : s.n ? 'Odadaki içerik hazır: ' + s.n + ' özel NPC' : '';
  el.style.color = s.dl ? 'var(--gold)' : 'var(--teal)';
}
function pakReset() { PAK.k = {}; PAK.inb = {}; PAK.up = {}; }
