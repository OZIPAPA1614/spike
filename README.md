# NOVA

Tarayıcıda oynanan 3D taktik FPS (5v5, ajanlar, bomba kur/imha et).

**Oyna:** https://ozipapa1614.github.io/nova/

- Tek oyunculu (botlara karşı), çok oyunculu odalar ve herkese açık sunucular (rastgele eşleşme)
- Hesaplar, arkadaş listesi, sesli ve yazılı sohbet
- 11 harita, gems mağazası, kılıç seviyeleri, 20 silah + 20 karakter skini
- **PARKUR modu:** yalnızca kılıçla engel yarışı · 5 raunt, her raunt farklı ve çok uzun, ince bir pist · bitişe ilk varan raundu alır
- **SİLAH YARIŞI:** her öldürmede sıradaki silah, kılıçla öldüren takım kazanır
- **SÜPERNOVA:** yer değiştiren enerji bölgesini tutan takım puan toplar, 100 puan kazanır
- **SERBEST:** Garry's Mod tarzı serbest dolaşma (tek ya da çok oyunculu) · [Q] spawn menüsü: bedava silah, kovalayan NPC'ler, pill ile NPC'ye dönüşme, kendi resminle ve sesinle (ses dosyasından 15 sn) NPC · odaya girerken özel içerik herkese iner · JavaScript modları (`nova` arayüzü, oyunu kuran cihazda güvenli alanda çalışır)
- Savaş raporu: öldürünce rakibe nereye (kafa / gövde / bacak) kaç isabet ve ne kadar hasar verdiğin; ölünce seni öldürenin sana nereye ne kadar vurduğu
- Silahlar 3B model (Quaternius / Kenney, CC0)
- Maç başında sinematik giriş (harita üstünden kamera uçuşu, atlanabilir)
- Duvar ve zemin dokuları Poly Haven CC0 fotoğrafları (`src/01c_texpack.js`)

Oynanan dosya `index.html`'dir; `src/` içindeki kaynaktan `python3 tools/build.py src index.html` ile üretilir.
Sağlık kontrolü: `python3 tests/check.py`.
