/* =====================================================================
   02h · GEMS + MAĞAZA
   Maç bitince "gems" kazanılır (ana menüde görünür). Mağazada gems ile:
   · KILIÇ YÜKSELTME: Tahta → Taş → Altın → Demir → Elmas (en üst). Her
     seviye daha hızlı koşturur, daha çok vurur, daha hızlı savurur.
   · 20 SİLAH SKİNİ (tüm silahlarına uygulanır, kılıç hariç)
   · 20 KARAKTER SKİNİ (takım şeridi her zaman görünür kalır)
   Profil tarayıcıda saklanır; hesapla girildiyse sunucuya da yazılır.
   Kuşanılanlar odaya girerken host'a bildirilir, herkes görür.
   ===================================================================== */
const SWORD_TIERS = [
  { k: 'wood', n: 'Tahta Kılıç', price: 0, spd: 1.22, dmg: 50, heavy: 75, rate: 1.7, heavyRate: 0.95, reach: 78, c: ['#9a6634', '#c08a52', '#5a3a1e', '#2e1d12'], glow: 0 },
  { k: 'stone', n: 'Taş Kılıç', price: 150, spd: 1.27, dmg: 56, heavy: 85, rate: 1.8, heavyRate: 1.0, reach: 81, c: ['#7d8187', '#a9adb3', '#4d5054', '#3a2618'], glow: 0 },
  { k: 'gold', n: 'Altın Kılıç', price: 400, spd: 1.32, dmg: 63, heavy: 95, rate: 1.9, heavyRate: 1.05, reach: 84, c: ['#e8b730', '#ffe28a', '#a8781a', '#3a2618'], glow: 0.25 },
  { k: 'iron', n: 'Demir Kılıç', price: 800, spd: 1.38, dmg: 71, heavy: 108, rate: 2.0, heavyRate: 1.1, reach: 88, c: ['#c3ccd4', '#ffffff', '#5f6870', '#20242a'], glow: 0.1 },
  { k: 'diamond', n: 'Elmas Kılıç', price: 1500, spd: 1.46, dmg: 80, heavy: 120, rate: 2.2, heavyRate: 1.2, reach: 93, c: ['#5ef2ff', '#e0feff', '#2aa9c9', '#1b2a3a'], glow: 0.45 }
];
const SWORD_MAX = SWORD_TIERS.length - 1;
/* silah skinleri: [ana renk, koyu parçalar, vurgu] · glow: vurgu parçaları ışık saçar · rb: gökkuşağı */
const WSKINS = [
  { id: 'w01', n: 'Gece Mavisi', price: 80, c: ['#1d3557', '#0b1420', '#457b9d'] },
  { id: 'w02', n: 'Çöl Kumu', price: 80, c: ['#c2a878', '#6b5a3e', '#e9d8a6'] },
  { id: 'w03', n: 'Orman Kamuflajı', price: 100, c: ['#4b5d34', '#2b3320', '#7a8a52'] },
  { id: 'w04', n: 'Askeri Haki', price: 100, c: ['#6b6b3a', '#30301c', '#a3a36b'] },
  { id: 'w05', n: 'Kar Beyazı', price: 120, c: ['#eef2f5', '#9aa4ad', '#ffffff'] },
  { id: 'w06', n: 'Okyanus', price: 120, c: ['#0f6e7a', '#063238', '#33d1c4'] },
  { id: 'w07', n: 'Kiraz Çiçeği', price: 150, c: ['#f7c6d9', '#8c4b67', '#ffffff'] },
  { id: 'w08', n: 'Gün Batımı', price: 150, c: ['#ff7e46', '#4a1d4f', '#ffd166'] },
  { id: 'w09', n: 'Gümüş Krom', price: 200, c: ['#c9d1d9', '#555c63', '#ffffff'] },
  { id: 'w10', n: 'Obsidyen', price: 200, c: ['#1a1420', '#08060a', '#7b4dff'], glow: 1 },
  { id: 'w11', n: 'Kızıl Ejder', price: 250, c: ['#b3141f', '#1a0a0c', '#ff5a3c'], glow: 1 },
  { id: 'w12', n: 'Zehir Yeşili', price: 250, c: ['#2b3a1a', '#0f140a', '#7dff3a'], glow: 1 },
  { id: 'w13', n: 'Buzul', price: 300, c: ['#bfe9ff', '#3d6f8c', '#e8fbff'], glow: 1 },
  { id: 'w14', n: 'Lav', price: 300, c: ['#2a1a14', '#120a08', '#ff6a1a'], glow: 1 },
  { id: 'w15', n: 'Neon Pembe', price: 350, c: ['#2a1030', '#100614', '#ff3ec8'], glow: 1 },
  { id: 'w16', n: 'Elektrik', price: 350, c: ['#262a12', '#0e1006', '#f7f35a'], glow: 1 },
  { id: 'w17', n: 'Siber Mor', price: 400, c: ['#2a1e55', '#0f0b22', '#a86bff'], glow: 1 },
  { id: 'w18', n: 'Altın Varak', price: 450, c: ['#e2b33c', '#6e4f14', '#fff1a8'], glow: 1 },
  { id: 'w19', n: 'Kraliyet', price: 500, c: ['#1f3a93', '#0d1a44', '#f5c451'], glow: 1 },
  { id: 'w20', n: 'Gökkuşağı', price: 650, c: ['#ff4655', '#1a1a1a', '#ffffff'], glow: 1, rb: 1 },
  // yeni, daha pahalı skinler · pulse: ışık nabız gibi atar · duo: ana renk ikinci renge gidip gelir
  { id: 'w21', n: 'Karbon Fiber', price: 900, c: ['#2b2d31', '#111214', '#8a929c'] },
  { id: 'w22', n: 'Bakır Pas', price: 950, c: ['#a8592c', '#3b1e10', '#4fb3a3'] },
  { id: 'w23', n: 'Kum Fırtınası', price: 1000, c: ['#d4a75a', '#5e4220', '#fff0c2'], glow: 1 },
  { id: 'w24', n: 'Mercan Resifi', price: 1100, c: ['#ff6f61', '#2b1a33', '#3ee0d0'], glow: 1 },
  { id: 'w25', n: 'Zümrüt', price: 1200, c: ['#0f7b4f', '#06281a', '#6dffb0'], glow: 1 },
  { id: 'w26', n: 'Yakut', price: 1200, c: ['#9b111e', '#2a0508', '#ff6b7a'], glow: 1 },
  { id: 'w27', n: 'Safir', price: 1300, c: ['#0f52ba', '#06183a', '#7fb2ff'], glow: 1 },
  { id: 'w28', n: 'Ametist', price: 1300, c: ['#6a2c91', '#1d0b29', '#d39bff'], glow: 1 },
  { id: 'w29', n: 'Kutup Işığı', price: 1500, c: ['#0c2a3a', '#041018', '#4dffb8'], glow: 1, pulse: 1, duo: '#3a1e5a' },
  { id: 'w30', n: 'Volkanik', price: 1600, c: ['#1e0f0a', '#0a0503', '#ff7a1a'], glow: 1, pulse: 1 },
  { id: 'w31', n: 'Ruhani', price: 1700, c: ['#c8d6e5', '#5f6f80', '#ffffff'], glow: 1, pulse: 1 },
  { id: 'w32', n: 'Plazma', price: 1800, c: ['#14103a', '#070514', '#5ef2ff'], glow: 1, pulse: 1, duo: '#3a0f4a' },
  { id: 'w33', n: 'Fosfor', price: 2000, c: ['#1a2a0a', '#081004', '#c6ff3a'], glow: 1, pulse: 1 },
  { id: 'w34', n: 'Kan Ayı', price: 2200, c: ['#3a0508', '#120102', '#ff2a3a'], glow: 1, pulse: 1, duo: '#6a0a12' },
  { id: 'w35', n: 'Siber Kafes', price: 2400, c: ['#0b0f1a', '#03050a', '#00ffd5'], glow: 1, pulse: 1, duo: '#2a0b3a' },
  { id: 'w36', n: 'Ejder Pulu', price: 2600, c: ['#0f4a2a', '#04140b', '#ffd166'], glow: 1, pulse: 1, duo: '#5a3a0a' },
  { id: 'w37', n: 'Güneş Patlaması', price: 2900, c: ['#ffb627', '#5a2a00', '#fff6c2'], glow: 1, pulse: 1, duo: '#ff5a1a' },
  { id: 'w38', n: 'Gece Yarısı Altını', price: 3200, c: ['#101018', '#050508', '#ffd65a'], glow: 1, pulse: 1 },
  { id: 'w39', n: 'Prizma', price: 3600, c: ['#ffffff', '#2a2a3a', '#ffffff'], glow: 1, rb: 1 },
  { id: 'w40', n: 'Sonsuzluk', price: 4200, c: ['#0a0a12', '#000000', '#ffffff'], glow: 1, pulse: 1, rb: 1 },
  // YALNIZCA KASADAN (ex): mağazada satılmaz · val: kopya çıkınca iade hesabı için değer
  { id: 'w41', n: 'Ejder Nefesi', ex: 1, val: 5000, c: ['#ff4a1a', '#1a0500', '#ffe14a'], glow: 1, pulse: 1, duo: '#ff9a1a' },
  { id: 'w42', n: 'Galaksi', ex: 1, val: 5000, c: ['#1a0b3a', '#05020f', '#a8c8ff'], glow: 1, pulse: 1, duo: '#3a0b5a' },
  { id: 'w43', n: 'Buz Kristali', ex: 1, val: 4500, c: ['#bff4ff', '#2a5a7a', '#ffffff'], glow: 1, pulse: 1, duo: '#5ac8ff' },
  { id: 'w44', n: 'Neon Rüya', ex: 1, val: 4500, c: ['#ff3ec8', '#120614', '#3ef1ff'], glow: 1, pulse: 1, duo: '#7b4dff' }
];
/* karakter skinleri: gövde/kollar, bacaklar, kask, vizör (ışıklı), sırt çantası, şapka */
const CSKINS = [
  { id: 'c01', n: 'Gece Ajanı', price: 100, suit: '#1c2026', legs: '#0e1013', helm: '#14171c', visor: '#ff4655', pack: '#0e1013', hat: null },
  { id: 'c02', n: 'Çöl Savaşçısı', price: 100, suit: '#b89a6a', legs: '#6b5a3e', helm: '#8f7650', visor: '#ffd166', pack: '#5a4a32', hat: 'cap' },
  { id: 'c03', n: 'Orman Korucusu', price: 120, suit: '#3f5a2e', legs: '#26331c', helm: '#2e4022', visor: '#9dff6a', pack: '#4b3a24', hat: 'cap' },
  { id: 'c04', n: 'Komando', price: 120, suit: '#5e6238', legs: '#2f311c', helm: '#41442a', visor: '#ffb347', pack: '#2f311c', hat: 'band' },
  { id: 'c05', n: 'Kar Leoparı', price: 150, suit: '#e9eef2', legs: '#9aa4ad', helm: '#ffffff', visor: '#5ec8ff', pack: '#bcc6cf', hat: 'ears' },
  { id: 'c06', n: 'Derin Deniz', price: 150, suit: '#0f5f6b', legs: '#073239', helm: '#0a4650', visor: '#33f0d4', pack: '#063238', hat: 'antenna' },
  { id: 'c07', n: 'Sakura', price: 180, suit: '#f4b6cf', legs: '#8c4b67', helm: '#ffffff', visor: '#ff5fa2', pack: '#c98aa6', hat: 'ears' },
  { id: 'c08', n: 'Gün Batımı', price: 180, suit: '#ff7e46', legs: '#4a1d4f', helm: '#c4553a', visor: '#ffd166', pack: '#4a1d4f', hat: 'cap' },
  { id: 'c09', n: 'Krom Robot', price: 250, suit: '#b9c2ca', legs: '#59616a', helm: '#dfe6ec', visor: '#3ef1ff', pack: '#7d868f', hat: 'antenna', glow: 1 },
  { id: 'c10', n: 'Gölge Ninja', price: 250, suit: '#151019', legs: '#08060a', helm: '#1f1726', visor: '#a86bff', pack: '#08060a', hat: 'band', glow: 1 },
  { id: 'c11', n: 'Kızıl Samuray', price: 300, suit: '#9e1b24', legs: '#1a0a0c', helm: '#2a0d10', visor: '#ffcc4d', pack: '#5a1016', hat: 'horns' },
  { id: 'c12', n: 'Zehirli Mutant', price: 300, suit: '#3c5a1a', legs: '#1b2a0c', helm: '#2e4512', visor: '#7dff3a', pack: '#1b2a0c', hat: 'mohawk', glow: 1 },
  { id: 'c13', n: 'Buz Muhafızı', price: 350, suit: '#bfe9ff', legs: '#3d6f8c', helm: '#e8fbff', visor: '#5ec8ff', pack: '#8cc4e0', hat: 'halo', glow: 1 },
  { id: 'c14', n: 'Lav Golemi', price: 350, suit: '#3a1d14', legs: '#1a0c08', helm: '#2a120a', visor: '#ff6a1a', pack: '#1a0c08', hat: 'horns', glow: 1 },
  { id: 'c15', n: 'Neon Koşucu', price: 400, suit: '#1d0f24', legs: '#0c0610', helm: '#2a1033', visor: '#ff3ec8', pack: '#0c0610', hat: 'mohawk', glow: 1 },
  { id: 'c16', n: 'Yıldırım', price: 400, suit: '#2a2a12', legs: '#121206', helm: '#f7f35a', visor: '#f7f35a', pack: '#121206', hat: 'antenna', glow: 1 },
  { id: 'c17', n: 'Siber Punk', price: 450, suit: '#2a1e55', legs: '#0f0b22', helm: '#3ef1ff', visor: '#ff3ec8', pack: '#0f0b22', hat: 'mohawk', glow: 1 },
  { id: 'c18', n: 'Altın Şövalye', price: 550, suit: '#e2b33c', legs: '#6e4f14', helm: '#fff1a8', visor: '#ffffff', pack: '#a8781a', hat: 'crown', glow: 1 },
  { id: 'c19', n: 'Kraliyet Muhafızı', price: 650, suit: '#1f3a93', legs: '#0d1a44', helm: '#f5c451', visor: '#f5c451', pack: '#0d1a44', hat: 'crown', glow: 1 },
  { id: 'c20', n: 'Gökkuşağı Efsanesi', price: 800, suit: '#ff4655', legs: '#1a1a1a', helm: '#ffffff', visor: '#ffffff', pack: '#1a1a1a', hat: 'halo', glow: 1, rb: 1 },
  // yeni, daha pahalı skinler (yeni şapkalar: pumpkin, cowboy, santa, bunny, tophat, astro, wings, flame)
  { id: 'c21', n: 'Cadı Kabağı', price: 1000, suit: '#3a2a4a', legs: '#1a1222', helm: '#ff8a1a', visor: '#ffd23a', pack: '#2a1a33', hat: 'pumpkin', glow: 1 },
  { id: 'c22', n: 'Kovboy', price: 1000, suit: '#8a5a32', legs: '#3a4a6a', helm: '#6a4222', visor: '#ffd166', pack: '#5a3a1e', hat: 'cowboy' },
  { id: 'c23', n: 'Noel Baba', price: 1100, suit: '#c8102e', legs: '#1a1a1a', helm: '#ffffff', visor: '#ffe0a0', pack: '#7a0a1a', hat: 'santa' },
  { id: 'c24', n: 'Pamuk Tavşan', price: 1100, suit: '#f2e6f0', legs: '#b9a8c0', helm: '#ffffff', visor: '#ff8ab8', pack: '#d8c8dc', hat: 'bunny' },
  { id: 'c25', n: 'Beyefendi', price: 1200, suit: '#1a1a22', legs: '#0a0a10', helm: '#202028', visor: '#d8c08a', pack: '#101016', hat: 'tophat' },
  { id: 'c26', n: 'Astronot', price: 1400, suit: '#e8ecf0', legs: '#a8b0b8', helm: '#ffffff', visor: '#ffb347', pack: '#c0c8d0', hat: 'astro' },
  { id: 'c27', n: 'Melek', price: 1600, suit: '#fff8e8', legs: '#e8dcc0', helm: '#ffffff', visor: '#ffe58a', pack: '#f0e6d0', hat: 'wings', glow: 1 },
  { id: 'c28', n: 'Ateş Ruhu', price: 1800, suit: '#2a0f08', legs: '#120604', helm: '#3a1408', visor: '#ff7a1a', pack: '#1a0804', hat: 'flame', glow: 1, pulse: 1 },
  { id: 'c29', n: 'Buz Kraliçesi', price: 2000, suit: '#cfefff', legs: '#5a8aa8', helm: '#ffffff', visor: '#7ad8ff', pack: '#a8d8f0', hat: 'crown', glow: 1, pulse: 1 },
  { id: 'c30', n: 'Karanlık Melek', price: 2200, suit: '#120a18', legs: '#06030a', helm: '#1a1022', visor: '#ff3a5a', pack: '#0a050f', hat: 'wings', glow: 1, pulse: 1 },
  { id: 'c31', n: 'Siber Samuray', price: 2400, suit: '#1a1a2a', legs: '#0a0a14', helm: '#ff3a4a', visor: '#3ef1ff', pack: '#0a0a14', hat: 'horns', glow: 1, pulse: 1, duo: '#2a0f3a' },
  { id: 'c32', n: 'Uzay Kovboyu', price: 2500, suit: '#2a3a5a', legs: '#0f1830', helm: '#c0c8d8', visor: '#3ef1ff', pack: '#1a2440', hat: 'cowboy', glow: 1, pulse: 1 },
  { id: 'c33', n: 'Hayalet Avcısı', price: 2600, suit: '#c8d6e5', legs: '#5f6f80', helm: '#e8f0f8', visor: '#9dff6a', pack: '#8a9aa8', hat: 'astro', glow: 1, pulse: 1 },
  { id: 'c34', n: 'Cehennem Lordu', price: 2800, suit: '#3a0508', legs: '#120102', helm: '#1a0204', visor: '#ff4a1a', pack: '#120102', hat: 'flame', glow: 1, pulse: 1, duo: '#7a1a08' },
  { id: 'c35', n: 'Kristal Şövalye', price: 3000, suit: '#a8e8ff', legs: '#3a6a8a', helm: '#e8fbff', visor: '#ffffff', pack: '#6aa8c8', hat: 'halo', glow: 1, pulse: 1, duo: '#c8a8ff' },
  { id: 'c36', n: 'Sihirbaz', price: 3200, suit: '#2a1a5a', legs: '#120a2a', helm: '#3a2a7a', visor: '#ffd23a', pack: '#1a0f3a', hat: 'tophat', glow: 1, pulse: 1 },
  { id: 'c37', n: 'Kozmik Tavşan', price: 3400, suit: '#1a0b3a', legs: '#05020f', helm: '#2a1a5a', visor: '#ff8ab8', pack: '#0f0624', hat: 'bunny', glow: 1, pulse: 1, duo: '#4a0b6a' },
  { id: 'c38', n: 'Güneş Tanrısı', price: 3800, suit: '#ffb627', legs: '#5a2a00', helm: '#fff6c2', visor: '#ffffff', pack: '#a85a00', hat: 'halo', glow: 1, pulse: 1, duo: '#ff5a1a' },
  { id: 'c39', n: 'Ejder Kral', price: 4400, suit: '#0f4a2a', legs: '#04140b', helm: '#ffd166', visor: '#ff4a1a', pack: '#0a2a18', hat: 'crown', glow: 1, pulse: 1, duo: '#1a7a3a' },
  { id: 'c40', n: 'Prizma Efsanesi', price: 5000, suit: '#ffffff', legs: '#1a1a2a', helm: '#ffffff', visor: '#ffffff', pack: '#1a1a2a', hat: 'wings', glow: 1, rb: 1 },
  // YALNIZCA KASADAN
  { id: 'c41', n: 'Kozmik Varlık', ex: 1, val: 6000, suit: '#0a0a1a', legs: '#000005', helm: '#1a1a3a', visor: '#a8c8ff', pack: '#05050f', hat: 'astro', glow: 1, pulse: 1, duo: '#2a0b4a' },
  { id: 'c42', n: 'Altın Ejder', ex: 1, val: 6000, suit: '#e2b33c', legs: '#6e4f14', helm: '#fff1a8', visor: '#ff4a1a', pack: '#a8781a', hat: 'wings', glow: 1, pulse: 1 },
  { id: 'c43', n: 'Kabak Kral', ex: 1, val: 5000, suit: '#1a0a2a', legs: '#0a0412', helm: '#ff8a1a', visor: '#9dff6a', pack: '#120820', hat: 'pumpkin', glow: 1, pulse: 1 },
  { id: 'c44', n: 'Alev Meleği', ex: 1, val: 5500, suit: '#ff5a1a', legs: '#3a0a00', helm: '#ffd23a', visor: '#ffffff', pack: '#a82a00', hat: 'flame', glow: 1, pulse: 1, duo: '#ffb627' }
];
/* ÖLDÜRME EFEKTLERİ (Arsenal gibi): rakibi öldürünce onun yerinde oynar, herkes görür (çizim: 07i) */
const KFXS = [
  { id: 'k01', n: 'Konfeti', price: 900, dur: 1.9, ds: 'Parti patlaması' },
  { id: 'k02', n: 'Kalp Yağmuru', price: 1000, dur: 2.1, ds: 'Kalpler saçılır' },
  { id: 'k03', n: 'Balon', price: 1400, dur: 2.5, ds: 'Şişer, uçar, patlar' },
  { id: 'k04', n: 'Örs', price: 1600, dur: 2.5, ds: 'Kafasına örs düşer' },
  { id: 'k05', n: 'Tavuk', price: 1800, dur: 2.7, ds: 'Tavuğa dönüp kaçar' },
  { id: 'k06', n: 'Mezar Taşı', price: 2000, dur: 2.7, ds: 'Yere gömülür' },
  { id: 'k07', n: 'Hayalet', price: 2200, dur: 2.5, ds: 'Ruhu göğe yükselir' },
  { id: 'k08', n: 'Buz Heykeli', price: 2500, dur: 2.4, ds: 'Donar ve paramparça olur' },
  { id: 'k09', n: 'Şimşek', price: 2800, dur: 2.0, ds: 'Gökten yıldırım çarpar' },
  { id: 'k10', n: 'Piksel Dağılma', price: 3000, dur: 2.3, ds: 'Kare kare dağılır' },
  { id: 'k11', n: 'Havai Fişek', price: 3400, dur: 2.7, ds: 'Fırlar ve patlar' },
  { id: 'k12', n: 'UFO', price: 4000, dur: 3.0, ds: 'Uzaylılar kaçırır' },
  { id: 'k13', n: 'Kara Delik', ex: 1, val: 6000, dur: 2.7, ds: 'Girdaba çekilir' },
  { id: 'k14', n: 'Meteor', ex: 1, val: 6000, dur: 2.7, ds: 'Gökten meteor düşer' }
];
const WSK = {}, CSK = {}, KFX = {};
for (const s of WSKINS) WSK[s.id] = s;
for (const s of CSKINS) CSK[s.id] = s;
for (const s of KFXS) KFX[s.id] = s;
/* mağaza türü → katalog / sahip olunanlar / kuşanılan alanı */
const SHOP_KIND = { ws: { list: WSKINS, map: WSK, eq: 'wsk' }, cs: { list: CSKINS, map: CSK, eq: 'csk' }, kf: { list: KFXS, map: KFX, eq: 'kfx' } };
/* NADİRLİK (CS gibi): değere göre; yalnızca kasadan çıkanlar altın */
const RARITY = [
  { k: 'mil', n: 'Askerî', c: '#4b69ff', w: 60 },
  { k: 'res', n: 'Kısıtlı', c: '#8847ff', w: 25 },
  { k: 'cla', n: 'Gizli', c: '#d32ce6', w: 10 },
  { k: 'cov', n: 'Örtülü', c: '#eb4b4b', w: 4 },
  { k: 'gold', n: '★ Nadir Özel', c: '#ffd23a', w: 1 }
];
const RARM = {}; RARITY.forEach((r, i) => { RARM[r.k] = r; r.i = i; });
function itemVal(it) { return it ? (it.ex ? it.val : it.price) | 0 : 0; }
function itemRar(it) {
  if (!it) return RARM.mil;
  if (it.ex) return RARM.gold;
  const v = it.price;
  return v < 250 ? RARM.mil : v < 700 ? RARM.res : v < 1800 ? RARM.cla : RARM.cov;
}
/* iki renk arası (RGB dizileri) */
function mixRGB(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, 1]; }
const skAnim = sk => !!(sk && (sk.rb || sk.duo || sk.pulse));
const pulseK = t => 0.75 + 0.55 * Math.sin(t * 4.2);
const duoK = t => 0.5 + 0.5 * Math.sin(t * 1.7);
const GEM_REWARD = { win: 150, draw: 70, lose: 30, kill: 5, killCap: 30 };
function swordStats(p) {
  const t = SWORD_TIERS[clamp((p && p.swt) | 0, 0, SWORD_MAX)];
  return t._w || (t._w = Object.assign({}, WEAPONS.sword, { spd: t.spd, dmg: t.dmg, heavy: t.heavy, rate: t.rate, heavyRate: t.heavyRate, reach: t.reach, range: t.reach }));
}
/* ağa gelen kozmetik bilgisini doğrula (host) */
function cosClean(c) {
  c = c && typeof c === 'object' ? c : {};
  return { sw: clamp(parseInt(c.sw, 10) || 0, 0, SWORD_MAX), ws: WSK[c.ws] ? c.ws : '', cs: CSK[c.cs] ? c.cs : '', kf: KFX[c.kf] ? c.kf : '' };
}
/* botlar: biraz çeşitlilik (kasaya özel eşyalar botlarda yok) */
function cosRandomBot() {
  const buyable = l => l.filter(s => !s.ex);
  return { sw: Math.random() < 0.5 ? 0 : randi(1, 3), ws: Math.random() < 0.45 ? pick(buyable(WSKINS)).id : '', cs: Math.random() < 0.55 ? pick(buyable(CSKINS)).id : '',
    kf: Math.random() < 0.3 ? pick(buyable(KFXS)).id : '' };
}
/* gökkuşağı rengi (zamanla döner) */
function rbCol(t, off) {
  const h = ((t * 0.18 + (off || 0)) % 1 + 1) % 1, i = Math.floor(h * 6), fr = h * 6 - i, v = 1, s = 0.85;
  const p = v * (1 - s), q = v * (1 - fr * s), tt = v * (1 - (1 - fr) * s);
  const r = [[v, tt, p], [q, v, p], [p, v, tt], [p, q, v], [tt, p, v], [v, p, q]][i % 6];
  return [r[0], r[1], r[2], 1];
}

const SHOP = {
  prof: null, key: '', _push: null,
  blank() { return { gems: 150, sw: 0, ws: [], cs: [], kf: [], wsk: '', csk: '', kfx: '', v: 0, played: 0, won: 0, co: 0 }; },
  fix(p) {
    const b = this.blank(); p = Object.assign(b, p && typeof p === 'object' ? p : {});
    p.gems = Math.max(0, Math.floor(+p.gems || 0)); p.sw = clamp(p.sw | 0, 0, SWORD_MAX); p.v = p.v | 0; p.co = Math.max(0, p.co | 0);
    for (const k in SHOP_KIND) {
      const K = SHOP_KIND[k];
      p[k] = Array.isArray(p[k]) ? p[k].filter((id, i, a) => K.map[id] && a.indexOf(id) === i) : [];
      if (p[K.eq] && !p[k].includes(p[K.eq])) p[K.eq] = '';
    }
    return p;
  },
  owns(kind, id) { const p = this.prof || this.load(); return !!(p[kind] && p[kind].includes(id)); },
  /* hesap değişince (giriş/misafir) ilgili profili yükle */
  load() {
    this.key = 'spk_prof_' + (FR && FR.acc && FR.uid ? FR.uid : 'guest');
    let p = null; try { p = JSON.parse(localStorage.getItem(this.key) || 'null'); } catch (e) { }
    this.prof = this.fix(p);
    if (typeof uiGemsChanged === 'function') uiGemsChanged();
    return this.prof;
  },
  save(push) {
    if (!this.prof) this.load();
    try { localStorage.setItem(this.key, JSON.stringify(this.prof)); } catch (e) { }
    if (typeof uiGemsChanged === 'function') uiGemsChanged();
    if (push !== false) this.pushSoon();
  },
  bump() { this.prof.v = (this.prof.v | 0) + 1; this.save(); },
  /* sunucuya (hesap varsa) kısa gecikmeyle yaz */
  pushSoon() {
    if (!(FR && FR.acc && ACC.uid)) return;
    clearTimeout(this._push);
    this._push = setTimeout(() => { ACC.db('PUT', 'users/' + ACC.uid + '/prof', this.prof).catch(() => { }); }, 600);
  },
  /* ACC.sync ile gelen sunucu profilini birleştir: hangisi daha yeniyse o kazanır */
  cloud(cp) {
    if (!this.prof) this.load();
    if (!cp || typeof cp !== 'object') { if (this.prof.v > 0) this.pushSoon(); return; }
    cp = this.fix(cp);
    if (cp.v > this.prof.v) { this.prof = cp; this.save(false); if (typeof uiStoreRender === 'function') uiStoreRender(); }
    else if (this.prof.v > cp.v) this.pushSoon();
  },
  /* ADMİN HEDİYESİ: admin'in gk/<anahtar>/ altına bıraktığı gems ekleme/silme kayıtları.
     Her kayıt önce sunucudan silinir, silme başarılıysa uygulanır (iki kez uygulanmaz). */
  async claimGifts() {
    if (this._gBusy || !(FR && FR.acc && ACC.uid && ACC.nick)) return;
    this._gBusy = true;
    try {
      const k = admKey(ACC.nick), all = await ACC.db('GET', 'gk/' + k);
      if (!all || typeof all !== 'object') return;
      if (!this.prof) this.load();
      let got = 0, n = 0;
      for (const id of Object.keys(all).sort()) {
        const g = all[id] || {};
        await ACC.db('DELETE', 'gk/' + k + '/' + id);
        const before = this.prof.gems;
        if (g.z) this.prof.gems = 0;
        this.prof.gems = Math.max(0, Math.min(1e9, this.prof.gems + (Math.round(+g.g) || 0)));
        got += this.prof.gems - before; n++;
      }
      if (!n) return;
      this.bump();
      if (typeof uiStoreRender === 'function') uiStoreRender();
      if (typeof uiToast === 'function') uiToast('ADMİN: ' + (got >= 0 ? '+' : '−') + Math.abs(got) + ' GEMS', got < 0);
    } catch (e) { } finally { this._gBusy = false; }
  },
  cos() { const p = this.prof || this.load(); return { sw: p.sw, ws: p.wsk || '', cs: p.csk || '', kf: p.kfx || '' }; },
  /* maç sonu ödülü: bir maç için bir kez */
  award(res, kills) {
    if (!this.prof) this.load();
    const k = Math.min(GEM_REWARD.killCap, kills | 0);
    const g = (GEM_REWARD[res] || 0) + k * GEM_REWARD.kill;
    this.prof.gems += g; this.prof.played++; if (res === 'win') this.prof.won++;
    this.bump();
    return g;
  },
  buySword() {
    const p = this.prof, nx = p.sw + 1; if (nx > SWORD_MAX) return 'max';
    const t = SWORD_TIERS[nx]; if (p.gems < t.price) return 'gems';
    p.gems -= t.price; p.sw = nx; this.bump(); return 'ok';
  },
  buy(kind, id) {
    const p = this.prof, K = SHOP_KIND[kind], it = K && K.map[id]; if (!it) return 'bad';
    if (p[kind].includes(id)) return 'owned';
    if (it.ex) return 'ex'; // yalnızca kasadan çıkar
    if (p.gems < it.price) return 'gems';
    p.gems -= it.price; p[kind].push(id); p[K.eq] = id; this.bump(); return 'ok';
  },
  equip(kind, id) {
    const p = this.prof, K = SHOP_KIND[kind]; if (!K) return 'bad';
    if (id && !p[kind].includes(id)) return 'bad';
    p[K.eq] = id || ''; this.bump(); return 'ok';
  },
  /* KASA AÇ: gems düşülür, eşya hemen profile yazılır (animasyon yalnızca gösteri).
     Önce nadirlik (kasadaki nadirliklerin ağırlıklarıyla), sonra o nadirlikten rastgele eşya.
     Zaten sahip olunan eşya çıkarsa değerinin %35'i gems olarak geri verilir. */
  openCase(cid, rnd) {
    const p = this.prof || this.load(), c = CASEM[cid]; if (!c) return { r: 'bad' };
    if (p.gems < c.price) return { r: 'gems' };
    const R = rnd || Math.random, tiers = caseTiers(c), tot = tiers.reduce((a, t) => a + t.w, 0);
    let x = R() * tot, tier = tiers[tiers.length - 1];
    for (const t of tiers) { if (x < t.w) { tier = t; break; } x -= t.w; }
    const [kind, id] = tier.items[Math.min(tier.items.length - 1, Math.floor(R() * tier.items.length))];
    const it = SHOP_KIND[kind].map[id], dup = p[kind].includes(id), refund = dup ? Math.max(10, Math.round(itemVal(it) * 0.35)) : 0;
    p.gems -= c.price;
    if (dup) p.gems += refund; else p[kind].push(id);
    p.co = (p.co | 0) + 1;
    this.bump();
    return { r: 'ok', kind, id, it, dup, refund, rar: tier.k };
  }
};

/* ---------- 3D: kozmetik renkleri ---------- */
const _SKC = {};
function lumOf(c) { return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; }
/* silah parçaları: [boyut, konum, renk, ışık] — skin yoksa orijinal renkler */
function gunPartsFor(wid, p, t) {
  if (wid === 'sword') {
    const tier = clamp((p && p.swt) | 0, 0, SWORD_MAX), key = 'sword' + tier;
    if (_SKC[key]) return _SKC[key];
    const T = SWORD_TIERS[tier], cols = T.c.map(h => hexRGB(h)), map = [0, 1, 2, 3, 2];
    return (_SKC[key] = GUNM.sword.map((q, i) => [q[0], q[1], cols[map[i]], T.glow && i < 2 ? T.glow : 0]));
  }
  const sk = p && p.wsk ? WSK[p.wsk] : null, base = GUNM[wid] || GUNM.classic;
  if (!sk) return GUNC[wid] || GUNC.classic;
  const anim = skAnim(sk), tt = t || 0;
  if (!anim && _SKC[wid + sk.id]) return _SKC[wid + sk.id];
  const main = sk.rb ? rbCol(tt) : sk.duo ? mixRGB(hexRGB(sk.c[0]), hexRGB(sk.duo), duoK(tt)) : hexRGB(sk.c[0]), dark = hexRGB(sk.c[1]), acc = sk.rb ? rbCol(tt, 0.5) : hexRGB(sk.c[2]);
  const gl = sk.glow ? 0.65 * (sk.pulse ? pulseK(tt) : 1) : 0;
  const out = base.map((q, i) => {
    const l = lumOf(hexRGB(q[2]));
    const isAcc = i > 0 && l >= 0.16 && i % 2 === 1;
    const col = i === 0 ? main : l < 0.16 ? dark : isAcc ? acc : main;
    return [q[0], q[1], col, isAcc ? gl : 0];
  });
  if (!anim) _SKC[wid + sk.id] = out;
  return out;
}
/* karakter skini renkleri (RGB dizileri) · pk: ışıklı parçaların parlaklık çarpanı (nabız) */
function charSkin(p, t) {
  const sk = p && p.csk ? CSK[p.csk] : null; if (!sk) return null;
  const b = sk._c || (sk._c = { suit: hexRGB(sk.suit), legs: hexRGB(sk.legs), helm: hexRGB(sk.helm), visor: hexRGB(sk.visor), pack: hexRGB(sk.pack), hat: sk.hat, glow: !!sk.glow, pk: 1 });
  if (!skAnim(sk)) return b;
  const tt = t || 0, o = Object.assign({}, b);
  if (sk.rb) { o.suit = rbCol(tt); o.helm = rbCol(tt, 0.33); o.visor = rbCol(tt, 0.66); o.glow = true; }
  else if (sk.duo) o.suit = mixRGB(b.suit, hexRGB(sk.duo), duoK(tt));
  if (sk.pulse) o.pk = pulseK(tt);
  return o;
}

/* ---------- MAĞAZA arayüzü (2B önizlemeler) ---------- */
const STORE = { tab: 'sw', raf: 0, cs: 'cs1' };
function _hx(c) { return '#' + c.slice(0, 3).map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join(''); }
function _shade(hex, k) { const c = hexRGB(hex); return _hx([c[0] * k, c[1] * k, c[2] * k]); }
/* yandan görünüş: GUNM parçaları (x ileri, y yukarı) */
function previewGun(cv, parts, glowCol) {
  const g = cv.getContext('2d'), W2 = cv.width, H2 = cv.height; g.clearRect(0, 0, W2, H2);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [s, o] of parts) { x0 = Math.min(x0, o[0] - s[0] / 2); x1 = Math.max(x1, o[0] + s[0] / 2); y0 = Math.min(y0, o[1] - s[1] / 2); y1 = Math.max(y1, o[1] + s[1] / 2); }
  const sc = Math.min((W2 - 16) / (x1 - x0), (H2 - 16) / (y1 - y0)), cx = W2 / 2 - (x0 + x1) / 2 * sc, cy = H2 / 2 + (y0 + y1) / 2 * sc;
  const order = parts.map((q, i) => [q, i]).sort((a, b) => a[0][1][2] - b[0][1][2]);
  for (const [[s, o, c, gl]] of order) {
    const col = Array.isArray(c) ? _hx(c) : c;
    if (gl) { g.shadowColor = glowCol || col; g.shadowBlur = 10; } else g.shadowBlur = 0;
    g.fillStyle = col; g.fillRect(cx + (o[0] - s[0] / 2) * sc, cy - (o[1] + s[1] / 2) * sc, s[0] * sc, s[1] * sc);
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(cx + (o[0] - s[0] / 2) * sc, cy - (o[1] + s[1] / 2) * sc, s[0] * sc, Math.max(1, s[1] * sc * 0.18));
  }
}
/* önden görünüş: bloklu ajan */
function previewChar(cv, sk) {
  const g = cv.getContext('2d'), W2 = cv.width, H2 = cv.height; g.clearRect(0, 0, W2, H2);
  const c = sk ? { suit: sk.suit, legs: sk.legs, helm: sk.helm, visor: sk.visor, pack: sk.pack } : { suit: '#3a6f8a', legs: '#262b33', helm: '#2c5568', visor: '#3ec1ff', pack: '#20242b' };
  const sc = (H2 - 10) / 96, ox = W2 / 2, oy = H2 - 4;
  const B = (z, y, w, h, col, glow) => { if (glow) { g.shadowColor = col; g.shadowBlur = 12; } g.fillStyle = col; g.fillRect(ox + (z - w / 2) * sc, oy - (y + h / 2) * sc, w * sc, h * sc); g.shadowBlur = 0; };
  B(-5, 13, 8, 26, c.legs); B(5, 13, 8, 26, c.legs);
  B(0, 41, 22, 30, c.suit); B(0, 49, 22.6, 4, '#1ee3cf', true);
  if (sk && sk.glow) B(0, 33, 22.4, 1.6, c.visor, true);
  B(-13.5, 44, 5, 20, c.suit); B(13.5, 44, 5, 20, c.suit);
  B(-13.5, 32, 5, 5, '#d9a679'); B(13.5, 32, 5, 5, '#d9a679');
  B(0, 64, 12, 13, '#d9a679'); B(0, 65, 10, 4, c.visor, true); B(0, 71.5, 13, 3, c.helm);
  const hat = sk && sk.hat, acc = c.visor;
  if (hat === 'cap') { B(0, 74.5, 12, 3, c.helm); B(0, 72.5, 14, 1.5, _shade(c.helm, 0.7)); }
  else if (hat === 'ears') { B(-4.5, 76, 3, 5, c.helm); B(4.5, 76, 3, 5, c.helm); B(-4.5, 75.5, 1.4, 3, acc); B(4.5, 75.5, 1.4, 3, acc); }
  else if (hat === 'antenna') { B(3, 79, 1, 10, '#333'); B(3, 84.5, 3, 3, acc, true); }
  else if (hat === 'mohawk') { B(0, 76, 2.5, 6, acc, true); }
  else if (hat === 'horns') { B(-6, 76, 2.5, 6, '#e8e0d0'); B(-7.5, 80, 2, 3, '#e8e0d0'); B(6, 76, 2.5, 6, '#e8e0d0'); B(7.5, 80, 2, 3, '#e8e0d0'); }
  else if (hat === 'crown') { B(0, 74.2, 13.5, 2.6, '#f5c451', true); for (const z of [-5.2, 0, 5.2]) B(z, 77, 2.4, 3.2, '#f5c451', true); B(0, 75, 1.6, 1.6, '#ff4655'); }
  else if (hat === 'halo') { g.save(); g.shadowColor = acc; g.shadowBlur = 12; g.strokeStyle = acc; g.lineWidth = 2.2; g.beginPath(); g.ellipse(ox, oy - 83 * sc, 9 * sc, 2.4 * sc, 0, 0, TAU); g.stroke(); g.restore(); }
  else if (hat === 'band') { B(0, 69, 13.2, 2.2, acc); B(9, 67.5, 5, 1.5, acc); }
  else if (hat === 'pumpkin') {
    g.fillStyle = c.helm; g.beginPath(); g.ellipse(ox, oy - 67 * sc, 12 * sc, 10.5 * sc, 0, 0, TAU); g.fill();
    g.strokeStyle = _shade(c.helm, 0.7); g.lineWidth = Math.max(1, sc * 0.8); g.beginPath(); g.ellipse(ox, oy - 67 * sc, 5 * sc, 10.5 * sc, 0, 0, TAU); g.stroke();
    B(0, 79, 2.4, 4.5, '#3f7f2e'); B(-4, 70, 3, 3, acc, true); B(4, 70, 3, 3, acc, true); B(0, 63.6, 8, 1.8, acc, true);
  }
  else if (hat === 'cowboy') { B(0, 73.6, 24, 1.4, c.helm); B(0, 77, 12.5, 6.5, c.helm); B(0, 74.8, 12.9, 1.5, acc); }
  else if (hat === 'santa') {
    B(0, 74, 14, 2.6, '#ffffff'); g.fillStyle = '#c8102e'; g.beginPath(); g.moveTo(ox - 6 * sc, oy - 75.3 * sc); g.lineTo(ox + 6 * sc, oy - 75.3 * sc); g.lineTo(ox - 5 * sc, oy - 86 * sc); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ox - 5 * sc, oy - 86.5 * sc, 2 * sc, 0, TAU); g.fill();
  }
  else if (hat === 'bunny') { for (const z of [-3.6, 3.6]) { B(z, 81, 3.8, 15, c.helm); B(z, 81, 1.8, 11, acc); } }
  else if (hat === 'tophat') { B(0, 73.6, 18, 1.4, _shade(c.helm, 0.8)); B(0, 80, 11.5, 12, c.helm); B(0, 75.4, 11.9, 2, acc, true); }
  else if (hat === 'astro') { B(0, 57.6, 15, 2.4, c.helm); g.save(); g.fillStyle = 'rgba(190,235,255,0.22)'; g.strokeStyle = 'rgba(220,245,255,0.75)'; g.lineWidth = 1.2; g.beginPath(); g.arc(ox, oy - 66.5 * sc, 13 * sc, 0, TAU); g.fill(); g.stroke(); g.restore(); }
  else if (hat === 'wings') {
    g.save(); g.globalCompositeOperation = 'destination-over';
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const z = (14 + i * 7.5) * s, hh = 52 + i * 5, ht = 17 - i * 3; B(z, hh, 7.5, ht, c.helm); B(z, hh + ht / 2 - 1, 7.7, 2, acc, true); }
    g.restore();
  }
  else if (hat === 'flame') {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { const z = (i - 1) * 4, fh = 11 + (i === 1 ? 4 : 0); g.fillStyle = acc; g.beginPath(); g.moveTo(ox + (z - 3.5) * sc, oy - 75 * sc); g.lineTo(ox + (z + 3.5) * sc, oy - 75 * sc); g.lineTo(ox + z * sc, oy - (75 + fh) * sc); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,240,140,0.8)'; g.beginPath(); g.moveTo(ox + (z - 2) * sc, oy - 75 * sc); g.lineTo(ox + (z + 2) * sc, oy - 75 * sc); g.lineTo(ox + z * sc, oy - (75 + fh * 0.6) * sc); g.closePath(); g.fill(); }
    g.restore();
  }
}
function previewRainbow(cv) {
  const g = cv.getContext('2d'); g.save(); g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(0, 0, cv.width, cv.height);
  ['#ff4655', '#ffb347', '#f7f35a', '#3ef17a', '#3ec1ff', '#a86bff', '#ff3ec8'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
  g.globalAlpha = 0.65; g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height); g.restore();
}
function uiGemsChanged() {
  const p = SHOP.prof; if (!p) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('gemN', p.gems); set('stGems', p.gems);
}
/* silah skini önizlemesi (yandan tüfek + mermi izi); t: zaman (nabız / renk geçişi için) */
function previewWs(cv, id, t) {
  const s = WSK[id]; previewGun(cv, gunPartsFor('vandal', { wsk: id }, t || 0), s ? s.c[2] : null); if (s && s.rb) previewRainbow(cv);
  if (!s) return;
  const g = cv.getContext('2d'), y = cv.height * 0.28, x0 = cv.width * 0.62, x1 = cv.width - 6, col = s.c[2];
  const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, col);
  g.save(); g.shadowColor = col; g.shadowBlur = s.glow ? 10 * (s.pulse ? pulseK(t || 0) : 1) : 4; g.strokeStyle = gr; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
  if (s.rb) { const g2 = g.createLinearGradient(x0, 0, x1, 0); ['#ff4655', '#f7f35a', '#3ef17a', '#3ec1ff', '#a86bff'].forEach((c, i) => g2.addColorStop(i / 4, c)); g.strokeStyle = g2; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x1 - 2, y, 2.4, 0, TAU); g.fill(); g.restore();
}
/* herhangi bir eşyanın önizlemesi (mağaza kartı, kasa şeridi, kasa sonucu) */
function previewItem(cv, kind, id, t) {
  if (kind === 'ws') previewWs(cv, id, t);
  else if (kind === 'cs') { const s = CSK[id]; previewChar(cv, s || null); if (s && s.rb) previewRainbow(cv); }
  else if (kind === 'kf') { if (typeof kfxPreview === 'function') kfxPreview(cv, id, t === undefined ? -1 : t); }
}
/* önizleme canlandırması: öldürme efektleri oynar, nabızlı / renk değiştiren skinler parlar */
function storeAnimTick() {
  STORE.raf = 0;
  if (UI.screen !== 'scr-store' || UI.caseOpen) return;
  const tt = performance.now() / 1000;
  for (const el of document.querySelectorAll('#stGrid .sc[data-anim]')) previewItem(el.querySelector('canvas'), el.dataset.k, el.dataset.id, tt);
  STORE.raf = requestAnimationFrame(storeAnimTick);
}
function storeAnimStart() { if (!STORE.raf && document.querySelector('#stGrid .sc[data-anim]')) STORE.raf = requestAnimationFrame(storeAnimTick); }
function uiStoreRender() {
  const grid = document.getElementById('stGrid'); if (!grid || !SHOP.prof) return;
  const p = SHOP.prof, tab = STORE.tab;
  for (const b of document.querySelectorAll('#stTabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  uiGemsChanged();
  const det = document.getElementById('stCase'); if (det) det.classList.toggle('hidden', tab !== 'cr');
  if (tab === 'cr') { if (typeof uiCaseRender === 'function') uiCaseRender(); return; } // KASALAR (02j)
  const cards = [];
  const card = (o) => '<div class="sc' + (o.eq ? ' eq' : '') + (o.lock ? ' lock' : '') + '" data-k="' + o.k + '" data-id="' + o.id + '"' + (o.anim ? ' data-anim="1"' : '') + (o.rc ? ' style="--rc:' + o.rc + '"' : '') + '>' +
    '<canvas width="180" height="96"></canvas>' + (o.rn ? '<div class="rr">' + esc(o.rn) + '</div>' : '') + '<div class="nm">' + esc(o.n) + '</div><div class="ds">' + o.ds + '</div>' +
    '<button class="' + (o.primary ? 'primary' : '') + '"' + (o.dis ? ' disabled' : '') + '>' + o.btn + '</button></div>';
  if (tab === 'sw') {
    SWORD_TIERS.forEach((t, i) => {
      const own = i <= p.sw, next = i === p.sw + 1, cur = i === p.sw;
      const ds = 'Hız ×' + t.spd.toFixed(2) + ' · ' + t.dmg + '/' + t.heavy + ' hasar · ' + t.rate.toFixed(1) + '/sn';
      cards.push(card({ k: 'sw', id: i, n: t.n, ds, eq: cur, lock: !own && !next, primary: next && p.gems >= t.price,
        btn: cur ? (i === SWORD_MAX ? 'MAKSİMUM' : 'ŞU AN ELİNDE') : own ? 'SAHİPSİN' : next ? 'YÜKSELT 💎 ' + t.price : '🔒 ' + t.n.toUpperCase(), dis: !next || p.gems < t.price }));
    });
  } else {
    const K = SHOP_KIND[tab] || SHOP_KIND.ws, eqId = p[K.eq], kf = tab === 'kf';
    cards.push(card({ k: tab, id: '', n: kf ? 'Efektsiz' : 'Varsayılan', ds: kf ? 'Öldürme efekti yok' : 'Skin yok', eq: !eqId, btn: !eqId ? 'KUŞANILDI' : 'KUŞAN', dis: !eqId }));
    for (const s of K.list) {
      const own = p[tab].includes(s.id), eq = eqId === s.id, R = itemRar(s), anim = kf || (tab === 'ws' && skAnim(s));
      const tr = kf ? s.ds + ' · ' : s.rb ? 'Renk değiştiren · ' : s.pulse ? 'Nabız ışıklı · ' : s.glow ? 'Işıklı · ' : '';
      if (s.ex && !own) { cards.push(card({ k: tab, id: s.id, n: s.n, ds: kf ? s.ds : tr + '🎁 Yalnızca kasadan', rc: R.c, rn: R.n, anim, lock: true, btn: '🎁 KASALARDA', dis: true })); continue; }
      cards.push(card({ k: tab, id: s.id, n: s.n, ds: kf ? (own ? tr + 'Sahipsin' : s.ds) : tr + (own ? 'Sahipsin' : '💎 ' + s.price), eq, rc: R.c, rn: R.n, anim,
        primary: !own && p.gems >= s.price, btn: eq ? 'KUŞANILDI' : own ? 'KUŞAN' : 'SATIN AL 💎 ' + s.price, dis: eq || (!own && p.gems < s.price) }));
    }
  }
  grid.innerHTML = cards.join('');
  for (const el of grid.querySelectorAll('.sc')) {
    const cv = el.querySelector('canvas'), k = el.dataset.k, id = el.dataset.id;
    if (k === 'sw') previewGun(cv, gunPartsFor('sword', { swt: +id }), SWORD_TIERS[+id].glow ? SWORD_TIERS[+id].c[0] : null);
    else if (k === 'kf' && !id) { if (typeof kfxPreview === 'function') kfxPreview(cv, '', 0); }
    else previewItem(cv, k, id, k === 'kf' ? -1 : 0);
    el.querySelector('button').onclick = () => {
      let r;
      if (k === 'sw') r = SHOP.buySword();
      else if (!id || SHOP.prof[k].includes(id)) r = SHOP.equip(k, id);
      else r = SHOP.buy(k, id);
      if (r === 'gems') uiToast('Yeterli gems yok', true);
      else if (r === 'ok') { AU.play && AU.play('buy'); if (k === 'sw') uiToast(SWORD_TIERS[SHOP.prof.sw].n + ' alındı!'); }
      uiStoreRender();
    };
  }
  storeAnimStart();
}
function uiStoreInit() {
  SHOP.load();
  uiCaseInit();
  for (const b of document.querySelectorAll('#stTabs button')) b.onclick = () => { STORE.tab = b.dataset.tab; uiStoreRender(); };
  const bs = document.getElementById('btnStore');
  if (bs) bs.onclick = () => { uiShow('scr-store'); uiStoreRender(); };
}
Object.assign(EN_EXACT, {
  'Tahta Kılıç': 'Wooden Sword', 'Taş Kılıç': 'Stone Sword', 'Altın Kılıç': 'Gold Sword', 'Demir Kılıç': 'Iron Sword', 'Elmas Kılıç': 'Diamond Sword',
  'Gece Mavisi': 'Midnight Blue', 'Çöl Kumu': 'Desert Sand', 'Orman Kamuflajı': 'Forest Camo', 'Askeri Haki': 'Army Khaki', 'Kar Beyazı': 'Snow White', 'Okyanus': 'Ocean',
  'Kiraz Çiçeği': 'Cherry Blossom', 'Gün Batımı': 'Sunset', 'Gümüş Krom': 'Silver Chrome', 'Obsidyen': 'Obsidian', 'Kızıl Ejder': 'Crimson Dragon', 'Zehir Yeşili': 'Toxic Green',
  'Buzul': 'Glacier', 'Lav': 'Lava', 'Neon Pembe': 'Neon Pink', 'Elektrik': 'Electric', 'Siber Mor': 'Cyber Purple', 'Altın Varak': 'Gold Leaf', 'Kraliyet': 'Royal', 'Gökkuşağı': 'Rainbow',
  'Gece Ajanı': 'Night Agent', 'Çöl Savaşçısı': 'Desert Warrior', 'Orman Korucusu': 'Forest Ranger', 'Komando': 'Commando', 'Kar Leoparı': 'Snow Leopard', 'Derin Deniz': 'Deep Sea',
  'Sakura': 'Sakura', 'Krom Robot': 'Chrome Robot', 'Gölge Ninja': 'Shadow Ninja', 'Kızıl Samuray': 'Crimson Samurai', 'Zehirli Mutant': 'Toxic Mutant', 'Buz Muhafızı': 'Ice Guardian',
  'Lav Golemi': 'Lava Golem', 'Neon Koşucu': 'Neon Runner', 'Yıldırım': 'Thunderbolt', 'Siber Punk': 'Cyberpunk', 'Altın Şövalye': 'Golden Knight', 'Kraliyet Muhafızı': 'Royal Guard',
  'Gökkuşağı Efsanesi': 'Rainbow Legend', 'Varsayılan': 'Default', 'Skin yok': 'No skin', 'KUŞAN': 'EQUIP', 'KUŞANILDI': 'EQUIPPED', 'SAHİPSİN': 'OWNED', 'MAKSİMUM': 'MAXED',
  'ŞU AN ELİNDE': 'EQUIPPED', 'KILIÇLAR': 'SWORDS', 'SİLAH SKİNLERİ': 'WEAPON SKINS', 'KARAKTER SKİNLERİ': 'CHARACTER SKINS', 'Yeterli gems yok': 'Not enough gems', 'TEK ATAR': 'ONE-SHOT',
  'Sahipsin': 'Owned', 'TAKIM İYİLEŞTİRİLDİ': 'TEAM HEALED', 'Toplam': 'Total', 'MAĞAZA · GEMS': 'STORE · GEMS'
});
Object.assign(EN_FRAG, {
  'YÜKSELT': 'UPGRADE', 'SATIN AL': 'BUY', 'TAHTA KILIÇ': 'WOODEN SWORD', 'TAŞ KILIÇ': 'STONE SWORD', 'ALTIN KILIÇ': 'GOLD SWORD', 'DEMİR KILIÇ': 'IRON SWORD',
  'Renk değiştiren': 'Color-shifting', 'Işıklı': 'Glowing', 'Hız ×': 'Speed ×', ' hasar': ' dmg', ' alındı!': ' unlocked!',
  'Maç bittikçe gems kazanırsın': 'You earn gems after every match', 'galibiyet': 'win', 'beraberlik': 'draw', 'yenilgi': 'loss', ' öldürme başına': ' per kill',
  'Odaya bağlanılıyor: ': 'Connecting to room: ', 'Açık oda: ': 'Public rooms: ', ' · Oyuncu: ': ' · Players: ', 'Başlamasına ': 'Starts in ',
  'Oyuncu bekleniyor (en az 2 kişi)': 'Waiting for players (at least 2)', 'Maç başlıyor…': 'Match starting…', 'HERKESE AÇIK SUNUCU': 'PUBLIC SERVER',
  'GEMS KAZANDIN': 'GEMS EARNED', 'MAĞAZA · GEMS': 'STORE · GEMS', '/sn': '/s',
  'HERKESE AÇIK SUNUCU': 'PUBLIC SERVER', 'Rastgele oyuncularla eşleşiyorsun': 'Matching you with random players', 'İPTAL': 'CANCEL',
  'Açık sunucular aranıyor…': 'Searching public servers…', 'Şu an açık oda yok': 'No public rooms right now', 'Açık sunucuya katıldın!': 'Joined a public server!',
  'Yeni açık sunucu kuruldu — oyuncular bekleniyor': 'New public server created — waiting for players', 'Uygun açık oda yok — yeni bir açık sunucu kuruluyor…': 'No open room — creating a new public server…',
  'Sunucu listesine ulaşılamadı — yeni bir açık oda kuruluyor…': 'Could not reach the server list — creating a new public room…', 'Açık sunucuya bağlanılamadı — ayrıntı menüde.': 'Could not join a public server — details in the menu.',
  'Boş yer olan bir odaya otomatik girersin. Hiç oda yoksa yeni bir açık oda kurulur ve başkaları sana katılır. Lobide 2 kişi olunca maç 25 saniye içinde kendiliğinden başlar, boş yerleri botlar doldurur.': 'You are placed in a room with free slots automatically. If there is none, a new public room is created and others join you. Once 2 players are in the lobby, the match starts by itself within 25 seconds; bots fill the empty slots.',
  '🌐 HERKESE AÇIK SUNUCUYA KATIL': '🌐 JOIN PUBLIC SERVER', '🌐 HERKESE AÇIK SUNUCU (rastgele oyuncular katılabilir)': '🌐 PUBLIC SERVER (random players can join)',
  'KAMERA': 'CAMERA', 'BİRİNCİ ŞAHIS': 'FIRST PERSON', 'ARKADAN': 'BEHIND', 'ÖNDEN': 'FRONT', 'Renkli mermi izi': 'Colored bullet trail', ' · Silah skinleri mermiye de renk ve iz verir': ' · Weapon skins also color your bullets and their trails'
});
EN_EXACT['Her maçta ' + MAPS.length + ' haritadan biri rastgele seçilir.'] = 'One of the ' + MAPS.length + ' maps is picked at random every match.';
try { _EN_RE = null; _EN_CACHE.clear(); } catch (e) { } // yeni çeviriler sözlüğe girsin
