# NOVA (eski adı SPIKE)

Tarayıcıda oynanan 3D taktik FPS (5v5, ajanlar, Spike kur/imha et).

**Oyna:** https://ozipapa1614.github.io/spike/

- Tek oyunculu (botlara karşı), çok oyunculu odalar ve herkese açık sunucular (rastgele eşleşme)
- Hesaplar, arkadaş listesi, sesli ve yazılı sohbet
- 11 harita, gems mağazası, kılıç seviyeleri, 20 silah + 20 karakter skini
- **PARKUR modu:** yalnızca kılıçla engel yarışı · 5 raunt, her raunt farklı ve çok uzun, ince bir pist · bitişe ilk varan raundu alır
- Maç başında sinematik giriş (harita üstünden kamera uçuşu, atlanabilir)
- Bütün dokular kodla üretilir (`src/01c_texgen.js`), dışarıdan alınmış fotoğraf yok

Oynanan dosya `index.html`'dir; `src/` içindeki kaynaktan `python3 tools/build.py src index.html` ile üretilir.
Sağlık kontrolü: `python3 tests/check.py`.
