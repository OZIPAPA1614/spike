/* =====================================================================
   07f · AÇILIŞ EKRANI
        1) OZN studios logosu (yanında "with Claude")
        2) NOVA yükleme ekranı: dönen ışık huzmeleri, zıplayarak gelen logo,
           çizgili yükleme çubuğu, rastgele ipucu
        Altta her zaman: "OZN studios™ 2026. Helped with Claude".
        Oyun asıl yüklemesini (dokular, harita) açılış ekranı çizildikten sonra
        yapar; yükleme çubuğu gerçek yükleme bitince dolar.
        Tıklama / dokunma / tuş ile atlanır.
   ===================================================================== */
const SPLASH_TIPS = [
  'İpucu: BOŞLUK ile zıpla — parkurda boşlukların üstünden böyle geçersin',
  'İpucu: Parkurda kılıçla vurduğun rakip geri savrulur',
  'İpucu: Barikatları kılıçla kır, sağ tık güçlü darbe vurur',
  'İpucu: Eğilince (SHIFT) daha isabetli ateş edersin',
  'İpucu: Bombayı A ya da B bölgesine kur, savunanlar imha etmeye çalışır',
  'İpucu: Mavi pedler seni havaya fırlatır',
  'İpucu: AYARLAR\'dan grafik kalitesini düşürüp oyunu akıcılaştırabilirsin',
  'İpucu: Z tuşuyla emote yapabilirsin'
];
function splashStart(initFn) {
  const el = document.getElementById('splash');
  let ran = false, tInit = null;
  const runInit = () => { if (ran) return; try { initFn(); } catch (e) { console.error(e); } ran = true; tInit = (performance.now() - t0) / 1000; };
  const t0 = performance.now();
  if (!el || window.__NOSPLASH) { if (el) el.remove(); runInit(); return; }
  el.classList.add('on');
  const fill = document.getElementById('spFill'), pct = document.getElementById('spPct');
  document.getElementById('spTip').textContent = tl(pick(SPLASH_TIPS));
  for (const n of el.querySelectorAll('.spSub')) n.textContent = tl(n.textContent);
  let prog = 0, out = false, skip = false;
  const finish = () => {
    if (out) return; out = true;
    window.removeEventListener('keydown', onKey, true);
    el.classList.add('out'); setTimeout(() => el.remove(), 480);
  };
  const onSkip = () => { skip = true; el.classList.add('ld'); };
  const onKey = e => { onSkip(); e.stopPropagation(); };
  el.addEventListener('pointerdown', e => { e.preventDefault(); onSkip(); });
  window.addEventListener('keydown', onKey, true);
  // önce açılış ekranı çizilsin, ağır yükleme ondan sonra
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(runInit, 40)));
  // stüdyo logosu en az 2,2 sn ve yükleme bittikten sonra en az 0,9 sn görünür; ardından NOVA yükleme ekranı ~1,7 sn
  const step = () => {
    if (out) return;
    const t = (performance.now() - t0) / 1000, studioEnd = tInit === null ? 1e9 : Math.max(2.2, tInit + 0.9);
    const ld = skip || t > studioEnd;
    if (ld) el.classList.add('ld');
    if (!ld) prog = Math.min(35, t * 12);
    else prog = Math.min(100, prog + (100 - prog) * 0.05 + 0.45);
    fill.style.width = prog.toFixed(1) + '%';
    pct.textContent = tl('YÜKLENİYOR') + ' %' + Math.floor(prog);
    if (ran && ld && prog >= 99.9 && (skip || t > studioEnd + 1.7)) { setTimeout(finish, skip ? 0 : 300); return; }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
