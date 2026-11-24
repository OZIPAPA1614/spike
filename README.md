# NOVA

Tarayıcıda oynanan 3D taktik FPS (5v5, ajanlar, bomba kur/imha et).

**Oyna:** https://ozipapa1614.github.io/nova/

- Tek oyunculu (botlara karşı), çok oyunculu odalar ve herkese açık sunucular (rastgele eşleşme)
- Hesaplar, arkadaş listesi, sesli ve yazılı sohbet
- 11 harita, gems mağazası, kılıç seviyeleri, 20 silah + 20 karakter skini
- **PARKUR modu:** yalnızca kılıçla engel yarışı · 5 raunt, her raunt farklı ve çok uzun, ince bir pist · bitişe ilk varan raundu alır
- Maç başında sinematik giriş (harita üstünden kamera uçuşu, atlanabilir)
- Duvar ve zemin dokuları Poly Haven CC0 fotoğrafları (`src/01c_texpack.js`)

Oynanan dosya `index.html`'dir; `src/` içindeki kaynaktan `python3 tools/build.py src index.html` ile üretilir.
Sağlık kontrolü: `python3 tests/check.py`.
