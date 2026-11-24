/* =====================================================================
   02e · DİL / LANGUAGE: Türkçe (varsayılan) ↔ English
   Oyun Türkçe yazılmıştır; İngilizce seçilince tl() metni sözlükten çevirir.
   Tuval (HUD) yazıları txt() içinde, menü yazıları DOM gözlemcisiyle çevrilir.
   ===================================================================== */
let LANG = 'tr';
try { const l = localStorage.getItem('spk_lang'); if (l === 'en' || l === 'tr') LANG = l; } catch (e) { }
/* tam eşleşme (kısa/tek kelimelik metinler) */
const EN_EXACT = {
  'ATEŞ': 'FIRE', 'YÜRÜ': 'WALK', 'EĞİL': 'CROUCH', 'SKOR': 'SCORE', 'MAĞAZA': 'SHOP', 'ZIPLA': 'JUMP', 'GERİ': 'BACK', 'KOPYALA': 'COPY',
  'AYRIL': 'LEAVE', 'ŞİFRE': 'PASSWORD', 'KAYDET': 'SAVE', 'KİLİTLE': 'LOCK IN', 'TAKIMIN': 'YOUR TEAM', 'Hareket': 'Move', 'BOŞLUK': 'SPACE',
  'FARE': 'MOUSE', 'MOBİL': 'MOBILE', 'MAÇ': 'MATCH', 'SAVAŞ': 'COMBAT', 'HARİTALAR': 'MAPS', 'ANLADIM': 'GOT IT', 'Kalan:': 'Left:',
  'SOHBET': 'CHAT', 'MENÜ': 'MENU', 'HASSASİYET': 'SENSITIVITY', 'ZAFER': 'VICTORY', 'BOZGUN': 'DEFEAT', 'BERABERE': 'DRAW', 'ANA MENÜ': 'MAIN MENU',
  'TIKLA': 'CLICK', 'Kolay': 'Easy', 'Normal': 'Normal', 'Zor': 'Hard', 'kolay': 'easy', 'normal': 'normal', 'zor': 'hard', 'Savunan': 'Defender', 'HARİTA': 'MAP', 'LOBİ': 'LOBBY',
  'BAĞLAN': 'CONNECT', 'TURN': 'TURN', 'veya': 'or', 'götürüp': 'carries it to', 'Kılıç': 'Sword', 'SEN': 'YOU', 'B': 'B', 'ESC': 'ESC',
  'TEK OYUNCULU': 'SINGLE PLAYER', 'ODAYA KATIL': 'JOIN ROOM', 'ODA KODU': 'ROOM CODE', 'OYUNCU ADI': 'PLAYER NAME', 'Adını yaz': 'Enter your name',
  'ÖRN: K7M2Q': 'E.G. K7M2Q', 'AJAN SEÇİMİ': 'AGENT SELECT', 'AJANINI SEÇ': 'PICK YOUR AGENT', 'KULLANICI ADI': 'USERNAME', 'TURN ADRES(LER)İ': 'TURN ADDRESS(ES)',
  'Tabanca': 'Pistol', 'Ağır Tabanca': 'Heavy Pistol', 'Hafif Makineli': 'SMG', 'Tüfek': 'Rifle', 'Susturuculu Tüfek': 'Silenced Rifle', 'Keskin Nişancı': 'Sniper', 'Raylı Top': 'Railgun', 'Yakın Dövüş': 'Melee',
  'Akıncı': 'Raider', 'Stratejist': 'Strategist', 'Bekçi': 'Warden', 'İzci': 'Scout',
  'Hafif Zırh': 'Light Armor', 'Ağır Zırh': 'Heavy Armor', '+25 zırh': '+25 armor', '+50 zırh': '+50 armor', '✂ İmha Kiti': '✂ Defuse Kit', 'İmha Kiti': 'Defuse Kit',
  'SES AÇIK': 'SOUND ON', 'SES KAPALI': 'SOUND OFF', 'SESİ KAPAT': 'MUTE SOUND', 'SESİ AÇ': 'UNMUTE SOUND', 'seçiyor…': 'picking…', 'Maç sona erdi.': 'Match over.',
  'SALDIRAN': 'ATTACK', 'SAVUNAN': 'DEFENSE', 'CAN': 'HP', 'Ö': 'D', 'TEKRAR': 'AGAIN',
  'AÇIK': 'ON', 'KAPALI': 'OFF', 'DÜŞÜK': 'LOW', 'ORTA': 'MEDIUM', 'YÜKSEK': 'HIGH', 'TÜRKÇE': 'TÜRKÇE', 'ENGLISH': 'ENGLISH', 'AYARLAR': 'SETTINGS'
};
/* parça çevirileri (birleştirilmiş metinlerin içinde de geçerli; uzunlar önce denenir) */
const EN_FRAG = {
  // menü
  'TAKTİKSEL 5v5 · BOMBA · AJANLAR': 'TACTICAL 5v5 · BOMB · AGENTS', 'TEK OYUNCULU · BOTLARA KARŞI': 'SINGLE PLAYER · VS BOTS', 'ODA KUR (HOST)': 'CREATE ROOM (HOST)',
  'ODAYA KATIL (JOIN)': 'JOIN ROOM', 'KONTROLLER & KURALLAR': 'CONTROLS & RULES', 'BAĞLANTI AYARLARI': 'CONNECTION SETTINGS', 'OYUNDAN ÇIK': 'QUIT GAME',
  '3D TAKTİK FPS': '3D TACTICAL FPS', 'Telefonunu yatay çevir': 'Rotate your phone to landscape', 'NOVA yatay ekranda oynanır': 'NOVA is played in landscape',
  'Botlara karşı tam maç · 20 raunt · 10. rauntten sonra taraf değişir': 'Full match vs bots · 20 rounds · sides swap after round 10',
  'TAKIM BOYUTU': 'TEAM SIZE', 'BOT ZORLUĞU': 'BOT DIFFICULTY', 'İLK YARI TARAFI': 'FIRST HALF SIDE', 'Saldıran (Bomba sende)': 'Attacker (you carry the bomb)',
  "Host'un verdiği 5 haneli oda kodunu gir": "Enter the 5-character room code from the host", 'Farklı ağlardan bağlanamıyor musunuz?': "Can't connect across networks?",
  'Bağlantı ayarları (TURN)': 'Connection settings (TURN)', 'Arkadaşların bu kodla "Odaya Katıl" diyerek bağlanabilir': 'Friends can connect with this code via "Join Room"',
  'TAKIM 1 · İLK YARI SALDIRAN': 'TEAM 1 · ATTACKS FIRST HALF', 'TAKIM 2 · İLK YARI SAVUNAN': 'TEAM 2 · DEFENDS FIRST HALF', 'BOŞ SLOTLARI BOTLARLA DOLDUR': 'FILL EMPTY SLOTS WITH BOTS',
  'ODAYI KAPAT': 'CLOSE ROOM', 'MAÇI BAŞLAT': 'START MATCH', "Host'un maçı başlatması bekleniyor...": 'Waiting for the host to start the match...',
  'Farklı ağlardaki oyuncular için aktarma (TURN) sunucusu': 'Relay (TURN) server for players on different networks', 'BAĞLANTIYI TEST ET': 'TEST CONNECTION',
  'Maçı bırakıp ana menüye dönersin': 'Leave the match and return to the main menu', 'MAÇA DÖN': 'RESUME', 'MAĞAZA MÜZİĞİ': 'SHOP MUSIC', 'KARAKTER SESİ': 'CHARACTER VOICE',
  'KAPAT (B / ESC)': 'CLOSE (B / ESC)', '· Tıkla ve satın al (aynı raunt içinde değiştirirsen iade edilir)': '· Click to buy (refunded if you change it in the same round)',
  'Mesajını yaz, Enter ile gönder · Esc kapat': 'Type a message, Enter to send · Esc to close', 'fareyi oyuna kilitle': 'to lock the mouse', 'Kilitliyken imleç görünmez · ESC: menü': 'Cursor hidden while locked · ESC: menu',
  'Oyundan çıktın. Bu sekmeyi kapatabilirsin.': 'You quit the game. You can close this tab.', 'OYUNA GERİ DÖN': 'BACK TO GAME',
  'BOMBA BIRAK': 'DROP BOMB', 'BOMBA İSTE': 'REQUEST BOMB', '🎤 KONUŞ': '🎤 TALK', '💬 SOHBET': '💬 CHAT', '⛶ TAM EKRAN': '⛶ FULLSCREEN',
  // ayarlar
  'OYUN SESİ': 'GAME SOUND', 'KARAKTER SESLERİ': 'CHARACTER VOICES', 'SESLİ SOHBET': 'VOICE CHAT', 'DİĞER OYUNCULARI DUY': 'HEAR OTHER PLAYERS', 'SOHBET SESİ': 'VOICE CHAT VOLUME',
  'GRAFİK': 'GRAPHICS', 'KALİTE': 'QUALITY', 'DİL / LANGUAGE': 'LANGUAGE / DİL', 'KONTROLLER': 'CONTROLS', 'FARE HASSASİYETİ': 'MOUSE SENSITIVITY', 'SES': 'SOUND',
  "Konuşmak için 0'a basılı tut; kısa dokunursan mikrofon açık kalır, tekrar dokununca kapanır. Uzaklaştıkça sesin azalır ve belli bir mesafeden sonra duyulmaz. Doğuş alanındayken seni yalnızca takımın duyar. Sohbet için nokta (.) tuşu.":
    'Hold 0 to talk; a short tap keeps the mic open, tap again to close it. Your voice fades with distance and is cut off beyond a certain range. While in a spawn area only your team hears you. Press period (.) to chat.',
  'Düşük: daha akıcı (düşük çözünürlük, dekor yok) · Yüksek: en net görüntü': 'Low: smoother (lower resolution, no decorations) · High: sharpest picture',
  // HUD / mesajlar
  'TAKIM ARKADAŞININ CANINI ALDIN!': 'YOU HURT A TEAMMATE!', ' SENİ VURDU — TAKIM ATEŞİ': ' SHOT YOU — FRIENDLY FIRE', ' SENİ ÖLDÜRDÜ — TAKIM ATEŞİ': ' KILLED YOU — FRIENDLY FIRE',
  ' OYUNCUSUNUN KARTINI ALDI': " PICKED UP THE PLAYER'S CARD:", ' — REBOOT İSTASYONUNA GÖTÜR': ' — TAKE IT TO A REBOOT STATION', ' YENİDEN DOĞDU (REBOOT · ': ' RESPAWNED (REBOOT · ',
  'RAKİP ': 'ENEMY ', ' REBOOT İLE DÖNDÜ': ' CAME BACK VIA REBOOT', 'YENİDEN DOĞDUN': 'YOU RESPAWNED', 'Takım arkadaşın seni reboot etti — sadece tabanca ve kılıcın var': 'A teammate rebooted you — you only have a pistol and sword',
  ' öldü': ' died', 'SON RAUNT!': 'FINAL ROUND!', "SALDIRI — Bombayı A veya B bölgesine kur": 'ATTACK — Plant the bomb at site A or B', "SAVUNMA — Bölgeleri koru, bombayı imha et": 'DEFENSE — Hold the sites, defuse the bomb',
  'RAUNT BAŞLADI — BARİYERLER KALKTI': 'ROUND STARTED — BARRIERS DOWN', 'RAUNDU KAZANDINIZ': 'ROUND WON', 'RAUNDU KAYBETTİNİZ': 'ROUND LOST', 'BOMBA KURULDU': 'BOMB PLANTED',
  ' BÖLGESİ — ': ' SITE — ', ' SANİYE': ' SECONDS', 'SATIN ALMA EVRESİ BİTTİ': 'BUY PHASE OVER', 'SATIN ALMA': 'BUY PHASE', 'BOMBA KURULU': 'BOMB PLANTED', 'RAUNT SONU': 'ROUND OVER', 'MAÇ BİTTİ': 'MATCH OVER',
  'Rakip takım elendi': 'Enemy team eliminated', 'Süre doldu': 'Time ran out', 'Bomba patladı': 'Bomb detonated', 'Bomba imha edildi': 'Bomb defused',
  ' CANLI': ' ALIVE', 'KARANLIK ÖRTÜ': 'DARK SHROUD', '✂ KİT': '✂ KIT', 'YAKIN GÖRÜŞ': 'NEARSIGHT', 'AÇIĞA ÇIKTIN': 'REVEALED', 'KÜL KLONU': 'ASH CLONE', 'AŞIRI YÜK': 'OVERLOAD',
  '⚡ IŞIN': '⚡ BEAM', '⚔ HIZLI KOŞU': '⚔ FAST RUN', 'İZLENİYOR (RAKİP): ': 'SPECTATING (ENEMY): ', 'İZLENİYOR: ': 'SPECTATING: ', '[BOŞLUK] değiştir': '[SPACE] switch', 'Takımında hayatta kimse kalmadı': 'No one on your team is alive',
  'KARTIN ': 'YOUR CARD IS WITH ', ' OYUNCUSUNDA — REBOOT İSTASYONUNA GÖTÜRÜYOR': ' — TAKING IT TO A REBOOT STATION', 'KARTIN YERDE — BİR TAKIM ARKADAŞI ALIP REBOOT ETMELİ': 'YOUR CARD IS ON THE GROUND — A TEAMMATE MUST REBOOT YOU',
  '[B] MAĞAZA · ': '[B] SHOP · ', '[F] BASILI TUT: BOMBA KUR': '[F] HOLD: PLANT BOMB', 'BOMBA SENDE — A/B bölgesine götür · [G] bırak': 'YOU HAVE THE BOMB — take it to A/B · [G] drop',
  '[F] BASILI TUT: BOMBA İMHA ET': '[F] HOLD: DEFUSE BOMB', ' · KİT: 1 SN': ' · KIT: 1 SEC', 'REBOOT İSTASYONU SOĞUYOR · ': 'REBOOT STATION COOLING · ', '[F] BASILI TUT: ': '[F] HOLD: ',
  '🂠 KART: ': '🂠 CARD: ', " — A veya B'deki REBOOT istasyonuna götür": ' — take it to the REBOOT station at A or B', ' · [T] İSTE': ' · [T] REQUEST',
  'BOMBA KURULUYOR': 'PLANTING BOMB', 'BOMBA İMHA EDİLİYOR — KİTLİ!': 'BOMB BEING DEFUSED — WITH KIT!', 'BOMBA İMHA EDİLİYOR!': 'BOMB BEING DEFUSED!', 'BOMBA İMHA EDİLİYOR': 'DEFUSING BOMB', 'REBOOT EDİLİYOR': 'REBOOTING',
  ' · MİKROFON AÇIK': ' · MIC OPEN', '⟳ REBOOT ': '⟳ REBOOT ', 'SKOR TABLOSU': 'SCOREBOARD', '  (SEN)': '  (YOU)', 'AJAN': 'AGENT', 'OYUNCU': 'PLAYER', 'HASAR': 'DAMAGE', 'KREDİ': 'CREDITS', 'ULTİ': 'ULT',
  'TAKIM ATEŞİ AÇILDI': 'FRIENDLY FIRE ENABLED', 'TAKIM ATEŞİ KAPATILDI': 'FRIENDLY FIRE DISABLED', 'TAKIM ATEŞİ: ': 'FRIENDLY FIRE: ', 'TAKIM ATEŞİ': 'FRIENDLY FIRE', '  ·  tıkla': '  ·  click',
  ' (oda sahibi değiştirir)': ' (room owner decides)', 'TARAF DEĞİŞİMİ': 'SIDE SWAP', 'Ekonomi sıfırlandı · ulti puanları korunur': 'Economy reset · ult points kept',
  'BOMBA DÜŞTÜ': 'BOMB DROPPED', " BOMBAYI ALDI": ' PICKED UP THE BOMB', " BOMBAYI BIRAKTI — ": ' DROPPED THE BOMB — ', " BOMBAYI BIRAKTI": ' DROPPED THE BOMB', 'BOMBA YERDE — MİNİ HARİTADA İŞARETLİ': 'BOMB ON THE GROUND — MARKED ON THE MINIMAP',
  " BOMBAYI ": ' GAVE THE BOMB TO ', ' OYUNCUSUNA VERDİ': '', ' İÇİN AYRILDI': ' (RESERVED)', ' BOMBA İSTİYOR': ' WANTS THE BOMB', '[G] ile bırak': 'drop with [G]', 'İSTEK ': 'REQUEST SENT TO ', ' OYUNCUSUNA GÖNDERİLDİ': '',
  'ULTİ KÜRESİ +1': 'ULT ORB +1', 'YAKININDA ÖLÜ TAKIM ARKADAŞI YOK': 'NO DEAD TEAMMATE NEARBY', ' YENİDEN CANLANDI': ' WAS REVIVED', 'ULTİ HAZIR DEĞİL (': 'ULT NOT READY (', 'ŞARJ YOK — MAĞAZADAN AL': 'NO CHARGES — BUY IN THE SHOP',
  ' AYRILDI — BOT DEVRALDI': ' LEFT — A BOT TOOK OVER', ' lobiye katıldı': ' joined the lobby', ' ayrıldı': ' left', 'Maçtan çıkıldı — ana menü': 'Left the match — main menu',
  'TABANCALAR': 'PISTOLS', 'SİLAHLAR': 'WEAPONS', 'ZIRH': 'ARMOR', 'YETENEKLER — ': 'ABILITIES — ', 'TAKIM EKONOMİSİ': 'TEAM ECONOMY', 'SAHİPSİN': 'OWNED', 'ÜCRETSİZ': 'FREE', ' şarj': ' charges',
  "Bombayı 1 saniyede imha et · ölünce gider": 'Defuse the bomb in 1 second · lost on death', ' ulti puanı': ' ult points', ' · her raunt 1 bedava': ' · 1 free each round',
  'HARİTA: ': 'MAP: ', 'İLK YARI: SALDIRAN': 'FIRST HALF: ATTACK', 'İLK YARI: SAVUNAN': 'FIRST HALF: DEFENSE', ' · Takım boyutu: ': ' · Team size: ', ' · Takım ateşi: ': ' · Friendly fire: ',
  'Harita: ': 'Map: ', ' · Bot doldurma: ': ' · Bot fill: ', ' · Zorluk: ': ' · Difficulty: ', 'Açık': 'On', 'Kapalı': 'Off', 'RASTGELE': 'RANDOM', 'Her maçta 6 haritadan biri rastgele seçilir.': 'One of the 6 maps is picked at random each match.',
  'Oyun duraklatıldı.': 'Game paused.', 'Çok oyunculu modda maç arkada devam ediyor!': 'In multiplayer the match keeps running in the background!',
  'Bir takım boş — o takıma bot eklenecek.': 'A team is empty — bots will be added to it.', 'Oda kodu kopyalandı: ': 'Room code copied: ', 'Geçerli bir oda kodu gir.': 'Enter a valid room code.',
  'Oda oluşturuluyor...': 'Creating room...', 'Oda kurulamadı — ayrıntı menüde.': 'Could not create the room — details in the menu.', 'Çok oyunculu başlatılamadı — ayrıntı menüde.': 'Could not start multiplayer — details in the menu.',
  'WebGL başlatılamadı — tarayıcın 3D grafiği desteklemiyor olabilir.': 'WebGL failed to start — your browser may not support 3D graphics.',
  'PeerJS yüklenemedi — çok oyunculu mod için internet bağlantısı gerekli.': 'PeerJS failed to load — multiplayer needs an internet connection.',
  'PeerJS yüklenemedi: çok oyunculu mod için internet gerekir. Tek oyunculu mod çalışır.': 'PeerJS failed to load: multiplayer needs internet. Single player works.',
  'Dokunmatik kontroller hazır — telefonu yatay tut, TAM EKRAN önerilir.': 'Touch controls ready — hold your phone sideways, FULLSCREEN recommended.',
  "Tam ekran için: Safari'de Paylaş → Ana Ekrana Ekle, sonra oyunu ana ekrandaki simgeden aç": 'For fullscreen: in Safari tap Share → Add to Home Screen, then open the game from the home screen icon',
  'TURN ayarları kaydedildi.': 'TURN settings saved.', 'Özel TURN kaldırıldı, varsayılanlar kullanılacak.': 'Custom TURN removed, defaults will be used.',
  'Oda açık': 'Room open', '— arkadaşların kodla katılabilir.': '— friends can join with the code.', 'Eşleştirme sunucusu bağlantısı koptu': 'Lost connection to the matchmaking server',
  '— yeniden bağlanılıyor… (bağlı oyuncular etkilenmez)': '— reconnecting… (connected players are unaffected)', ' Bağlı oyuncu: ': ' Connected players: ', ' Özel TURN: açık.': ' Custom TURN: on.',
  "Host'a bağlı": 'Connected to host', 'Eşleştirme sunucusuna bağlanılıyor…': 'Connecting to the matchmaking server…', 'Oda aranıyor…': 'Looking for the room…', 'Oda aranıyor… (': 'Looking for the room… (', '. deneme)': '. try)',
  'Oda bulundu, bağlantı kuruluyor (NAT geçişi)…': 'Room found, connecting (NAT traversal)…', 'Bağlandı, lobiye giriliyor…': 'Connected, entering lobby…', 'Host bağlantıyı kapattı.': 'The host closed the connection.',
  'Host ile bağlantı koptu.': 'Lost connection to the host.', 'Oyun zaten başladı.': 'The game has already started.', 'Oda dolu (10/10).': 'Room is full (10/10).', 'Host tarafından çıkarıldın.': 'You were kicked by the host.',
  "Oda bulunamadı. Kodu kontrol et; host'un oyunu açık ve lobide olmalı.": "Room not found. Check the code; the host's game must be open and in the lobby.",
  'MİKROFON KULLANILAMIYOR — oyunu https adresinden ya da dosyadan aç': 'MICROPHONE UNAVAILABLE — open the game from an https address or as a file',
  'MİKROFON İZNİ İSTENİYOR…': 'ASKING FOR MICROPHONE PERMISSION…', "MİKROFON HAZIR — konuşmak için 0'a basılı tut, açık bırakmak için dokun": 'MICROPHONE READY — hold 0 to talk, tap to leave it open',
  'MİKROFON İZNİ VERİLMEDİ': 'MICROPHONE PERMISSION DENIED', 'SESLİ SOHBET YALNIZCA ÇOK OYUNCULU ODADA ÇALIŞIR': 'VOICE CHAT ONLY WORKS IN A MULTIPLAYER ROOM',
  "MİKROFON AÇIK — kapatmak için 0'a tekrar dokun": 'MIC OPEN — tap 0 again to close it', 'BOMBA: ': 'BOMB: ', 'RAUNT ': 'ROUND ', 'PING ': 'PING ',
  // yetenek adları ve açıklamaları
  'Gölge Atılma': 'Shadow Dash', 'Hayalet Örtüsü': 'Ghost Veil', 'Karanlık Kesik': 'Dark Slash', 'Alev Topu': 'Fireball', 'Ateş Duvarı': 'Fire Wall', 'Küllerden Doğuş': 'Rise From Ashes',
  'Sis Küresi': 'Smoke Orb', 'Zehir Sisi': 'Venom Mist', 'Kabus Alanı': 'Nightmare Zone', 'Tuzak Mayını': 'Trap Mine', 'Mini Taret': 'Mini Turret', 'Mutlak Kilit': 'Absolute Lock',
  'Sonar Oku': 'Sonar Arrow', 'Şok Oku': 'Shock Arrow', 'Yörünge Lazeri': 'Orbital Laser', 'Zaman Küresi': 'Time Orb', 'Kuantum Sıçrama': 'Quantum Leap', 'Zaman Çöküşü': 'Time Collapse',
  'Sarsıntı Dalgası': 'Quake Wave', 'Taş Siper': 'Stone Cover', 'Tektonik Yarık': 'Tectonic Rift', 'Derman Halkası': 'Mending Ring', 'Buz Zemini': 'Ice Floor', 'Yeniden Uyanış': 'Reawakening',
  'Akım Kayması': 'Current Slide', 'Zincir Yük': 'Chain Charge', 'Aşırı Yük': 'Overload', 'Sağırlık Küresi': 'Deafening Orb', 'Gölge Kurdu': 'Shadow Wolf', 'Karanlık Örtü': 'Dark Shroud',
  'Hareket ettiğin yöne doğru anında hızlı bir atılma yapar.': 'Instantly dash in the direction you are moving.', '3.5 sn görünmez olursun. Ateş etmek görünmezliği bozar.': 'Become invisible for 3.5 s. Firing breaks it.',
  'Duvarlardan geçen, haritanın öbür ucuna kadar giden ve değdiği her düşmanı tek vuruşta öldüren dev bir enerji bıçağı fırlatır.': 'Throws a giant energy blade that passes through walls, flies across the map and kills every enemy it touches.',
  'Patladığı noktaya bakan düşmanları kör eden alev topu (flash).': 'A fireball that blinds enemies looking at its burst (flash).', 'Görüşü kesen, düşmanları yakan ateş duvarı. ALAZ alevin içinde iyileşir.': 'A vision-blocking wall of fire that burns enemies. ALAZ heals inside the flames.',
  '15 sn klon modu: bu sürede ölürsen ultiyi açtığın noktada tam can ve zırhla yeniden doğarsın.': '15 s clone mode: if you die, you respawn with full health and armor where you cast it.',
  'İmlecin olduğu yere, duvarların üzerinden görüş kesen duman küresi yerleştirir.': 'Places a vision-blocking smoke orb at your cursor, even over walls.', 'İçindeki düşmanları %45 yavaşlatan ve zehirleyen bulut.': 'A cloud that slows enemies inside by 45% and poisons them.',
  "Devasa bir alanı 13 sn zehirli sisle kaplar; içerideki düşmanlar yavaşlar, canları hızla 1'e iner ve yerleri açığa çıkar.": 'Covers a huge area in toxic fog for 13 s; enemies inside are slowed, quickly drop to 1 HP and are revealed.',
  'Düşman yaklaştığında patlayan gizli mayın (aynı anda en fazla 2).': 'A hidden mine that explodes when an enemy comes close (max 2 at a time).', 'Görüş konisine giren düşmanlara otomatik ateş eden taret.': 'A turret that automatically fires at enemies in its view cone.',
  'Kurulan cihaz 3 sn sonra çok geniş alandaki tüm düşmanları 7.5 sn sersemletir; silah ve yetenek kullanamazlar.': 'After 3 s the device stuns all enemies in a very large area for 7.5 s; they cannot use weapons or abilities.',
  'Saplandığı yerde iki kez tarama yapar, duvar arkasındaki düşmanları gösterir. 1 kez seker.': 'Scans twice where it lands, revealing enemies behind walls. Bounces once.', 'İki kez sekip patlayan, alan hasarı veren ok.': 'An arrow that bounces twice and explodes for area damage.',
  'Seçtiğin koridor boyunca haritanın sonuna kadar uzanan, duvarları delen dört ölümcül enerji huzmesi indirir.': 'Calls down four lethal wall-piercing beams that reach to the far end of the lane you choose.', 'İçine giren düşman mermilerini durduran zaman küresi.': 'A time orb that stops enemy bullets entering it.',
  'İmleç yönünde kısa mesafeli ışınlanma.': 'Short-range teleport toward your cursor.', 'Seçilen geniş bölgedeki düşmanların hareket ve ateş hızını %78 yavaşlatır ve onlara hasar verir.': 'Slows the movement and fire rate of enemies in a large chosen area by 78% and damages them.',
  'İleri giden şok dalgası; değdiği düşmanların nişanını 3 sn bozar.': 'A forward shockwave that ruins the aim of enemies it hits for 3 s.', 'Önüne geçici, kurşun geçirmez taş duvar örer (vurularak yıkılabilir).': 'Raises a temporary bulletproof stone wall in front of you (can be shot down).',
  'Önündeki çok uzun bir hattı yarar; üzerindeki düşmanları havaya savurur, sersemletir ve ağır hasar verir.': 'Splits a very long line ahead, launching and stunning enemies on it and dealing heavy damage.', 'İçindeki takım arkadaşlarını (ve seni) iyileştiren şifa alanı.': 'A healing zone that heals teammates (and you) inside.',
  'Düşmanları %50 yavaşlatan buz zemini.': 'An ice floor that slows enemies by 50%.', 'Yakınındaki ölmüş bir takım arkadaşını tam can ve zırhla diriltir; yakındaki canlı takım arkadaşlarını da tam iyileştirir.': 'Revives a nearby dead teammate with full health and armor, and fully heals nearby living teammates.',
  'Ani kayma + 4 sn %35 hız artışı.': 'Quick slide + 35% speed boost for 4 s.', 'Düşmandan düşmana seken elektrik yükü.': 'An electric charge that jumps from enemy to enemy.',
  '11 sn hareket hızın iki katına çıkar ve parmaklarından uzun menzilli, kesintisiz, yüksek hasarlı elektrik ışını ateşlersin.': 'For 11 s your speed doubles and you fire a long-range, continuous, high-damage lightning beam.',
  'İçindeki düşmanları sağır eder: ses duyamazlar, minimap uyarıları kesilir.': 'Deafens enemies inside: no sound, no minimap alerts.', 'İleri koşup en yakın düşmanı takip eden kurt; yakaladığını yakın görüşlü yapar ve açığa çıkarır.': 'A wolf that hunts the nearest enemy; whoever it catches is nearsighted and revealed.',
  '13 sn boyunca tüm düşmanların haritası kararır, görüş mesafeleri minimuma iner ve 4 sn yerleri açığa çıkar.': 'For 13 s all enemies lose their map, their view distance drops to a minimum and they are revealed for 4 s.'
};
Object.assign(EN_EXACT, { 'EL SALLA': 'WAVE', 'DANS': 'DANCE', 'SEVİN': 'CHEER', 'TAMAM': 'THUMBS UP', 'GÜL': 'LAUGH', '😀 EMOTE': '😀 EMOTE', '+ ARKADAŞ': '+ FRIEND', '✓ ARKADAŞ': '✓ FRIEND', 'ONAYLA': 'CONFIRM', 'GÖNDER': 'SEND', 'KABUL ET': 'ACCEPT', 'REDDET': 'DECLINE', 'Çevrimdışı': 'Offline', 'OYUNA KATIL': 'JOIN GAME' });
Object.assign(EN_FRAG, {
  'ARKADAŞLIKTAN ÇIKAR': 'REMOVE FRIEND', 'ARKADAŞLAR': 'FRIENDS', 'ÇEVRİMİÇİ': 'ONLINE', 'KULLANICI ADINI SEÇ': 'CHOOSE YOUR USERNAME', 'İSTEĞİ KABUL ET': 'ACCEPT REQUEST', 'İSTEK GÖNDERİLDİ': 'REQUEST SENT', '+ ARKADAŞ EKLE': '+ ADD FRIEND',
  'Oyunda ve arkadaş listelerinde bu adla görüneceksin.': 'This is how you will appear in games and friend lists.', 'Sonradan değiştirilemez.': 'It cannot be changed later.', '3–16 karakter: harf, rakam, _ . -': '3–16 characters: letters, digits, _ . -',
  '3–16 karakter olmalı; yalnızca harf, rakam ve _ . - kullanılabilir.': 'Must be 3–16 characters; only letters, digits and _ . - are allowed.', 'Kullanıcı adın: ': 'Your username: ', 'Kullanıcı adı değiştirilemez': "Username can't be changed", 'Çevrimiçisin': 'You are online', 'Sunucuya bağlanılıyor…': 'Connecting to server…',
  ' sana arkadaşlık isteği gönderdi — ana menüdeki ARKADAŞLAR\'dan kabul edebilirsin.': ' sent you a friend request — accept it under FRIENDS in the main menu.', 'sana arkadaşlık isteği gönderdi': 'sent you a friend request', 'istek gönderildi, yanıt bekleniyor': 'request sent, waiting for a reply', 'Henüz arkadaşın yok.': 'No friends yet.',
  'Maçta — maç bitince katılabilirsin': 'In a match — you can join after it ends', 'Bir odada değil': 'Not in a room', ' odana katılmak istiyor': ' wants to join your room', 'Çevrimdışı · son görülme ': 'Offline · last seen ', 'Çevrimiçi · Odada': 'Online · In a room', 'Çevrimiçi · Maçta': 'Online · In a match', 'Çevrimiçi · Menüde': 'Online · In the menu',
  'az önce': 'just now', ' dk önce': ' min ago', ' saat önce': ' h ago', ' gün önce (': ' days ago (', 'hiç görülmedi': 'never seen', '🎤 BAS-KONUŞ (0)': '🎤 PUSH TO TALK (0)', 'Lobiye mesaj yaz, Enter ile gönder': 'Message the lobby, Enter to send', "Lobi sohbeti — mesaj yaz ya da 0'a basılı tutup konuş.": 'Lobby chat — type a message or hold 0 to talk.',
  ' arkadaşlık isteğini kabul etti!': ' accepted your friend request!', ' oyuncusuna arkadaşlık isteği gönderildi': ': friend request sent', ' oyuncusuna katılma isteği gönderildi…': ': join request sent…', ' isteğini kabul etti — odaya giriliyor…': ' accepted — joining their room…',
  'Bu oyuncuya şu an ulaşılamadı — oyunu açıkken tekrar dene.': "Couldn't reach this player right now — try again while their game is open.", 'Arkadaşın şu an maçta.': 'Your friend is in a match right now.', 'Arkadaşın bir odada değil.': 'Your friend is not in a room.', 'İstek reddedildi.': 'Request declined.',
  'Arkadaş eklemek için çok oyunculu bir odada oyuncunun adının yanındaki': "To add a friend, in a multiplayer room press the button next to the player's name:", 'düğmesine bas. Arkadaşın bir odadaysa adına tıklayıp': '. If your friend is in a room, click their name and choose', 'diyebilirsin. Çevrimiçi görünmek için oyunun açık olması gerekir.': '. Your game must be open for you to appear online.',
  'Eşleştirme sunucusuna bağlanılamadı': 'Could not connect to the matchmaking server', 'HESAP OLUŞTUR': 'CREATE ACCOUNT', 'KAYIT OL': 'SIGN UP', 'GİRİŞ YAP': 'LOG IN', 'ÇIKIŞ YAP': 'LOG OUT', 'BEKLE…': 'WAIT…',
  'Kullanıcı adın oyunda ve arkadaş listelerinde görünür. Sonradan değiştirilemez.': 'Your username is shown in games and friend lists. It cannot be changed later.',
  'Kullanıcı adın ve şifrenle hesabına gir — arkadaşların her cihazda seninle.': 'Log in with your username and password — your friends follow you to every device.',
  'Hesabın var mı? GİRİŞ YAP': 'Have an account? LOG IN', 'Hesabın yok mu? KAYIT OL': "No account? SIGN UP", 'Misafir olarak oyna (arkadaş sistemi olmadan)': 'Play as a guest (no friends system)',
  'KULLANICI ADI': 'USERNAME', 'ŞİFRE': 'PASSWORD', 'en az 6 karakter': 'at least 6 characters', 'Şifre en az 6 karakter olmalı.': 'Password must be at least 6 characters.',
  'Bu kullanıcı adı alınmış, başka bir ad seç.': 'This username is taken, choose another.', 'Kullanıcı adı ya da şifre hatalı.': 'Wrong username or password.', 'Çok fazla deneme yapıldı, biraz sonra tekrar dene.': 'Too many attempts, try again later.',
  'Sunucuya ulaşılamadı — internet bağlantını kontrol et.': "Couldn't reach the server — check your internet connection.", 'Hesap oluşturuldu — hoş geldin, ': 'Account created — welcome, ', 'Hoş geldin, ': 'Welcome, ',
  'Arkadaş sistemi için bir hesap gerekli.': 'The friends system needs an account.', 'HESAP AÇ / GİRİŞ YAP': 'SIGN UP / LOG IN', 'Oturum süresi doldu — tekrar giriş yap.': 'Session expired — please log in again.', 'Bir hata oluştu (': 'Something went wrong (', 'EMOTE · 1–6 seç · Z kapat': 'EMOTE · pick 1–6 · Z to close'
});
// büyük harfle yazılan adlar (ör. yetenek kutuları) için büyük harfli kopyalar
/* yeni menü · sinematik giriş · PARKUR modu */
Object.assign(EN_EXACT, {
  'YÜKLENİYOR': 'LOADING', 'TAKTİK FPS · PARKUR': 'TACTICAL FPS · PARKOUR', 'OYNA': 'PLAY', '💎 MAĞAZA': '💎 SHOP', 'OYUNCU': 'PLAYER', 'OYUN MODU': 'GAME MODE', 'YARIŞÇI SAYISI': 'RACERS', 'PARKURA BAŞLA': 'START PARKOUR',
  'SIRALAMA': 'STANDINGS', 'HAZIR': 'READY', 'KOŞ!': 'RUN!', 'ŞAMPİYON': 'CHAMPION', 'İLERLEME': 'PROGRESS', 'SÜRE': 'TIME', 'RAUNT': 'ROUND',
  'BİRİNCİ GELDİN!': 'YOU CAME FIRST!', 'RAUNDU KAZANDIN!': 'YOU WON THE ROUND!', 'RAUNT BİTTİ': 'ROUND OVER', 'A BÖLGESİ': 'SITE A', 'B BÖLGESİ': 'SITE B',
  '[BOŞLUK] ATLA': '[SPACE] SKIP', 'ATLAMAK İÇİN DOKUN': 'TAP TO SKIP', 'TAKIMLAR': 'TEAMS', '#': '#'
});
Object.assign(EN_FRAG, {
  'İpucu: BOŞLUK ile zıpla — parkurda boşlukların üstünden böyle geçersin': 'Tip: jump with SPACE — that is how you clear gaps in parkour',
  'İpucu: Parkurda kılıçla vurduğun rakip geri savrulur': 'Tip: in parkour, rivals you hit with the sword get knocked back',
  'İpucu: Barikatları kılıçla kır, sağ tık güçlü darbe vurur': 'Tip: break barricades with the sword; right click hits harder',
  'İpucu: Eğilince (SHIFT) daha isabetli ateş edersin': 'Tip: crouch (SHIFT) to shoot more accurately',
  'İpucu: Bombayı A ya da B bölgesine kur, savunanlar imha etmeye çalışır': 'Tip: plant the bomb at site A or B; defenders try to defuse it',
  'İpucu: Mavi pedler seni havaya fırlatır': 'Tip: blue pads launch you into the air',
  "İpucu: AYARLAR'dan grafik kalitesini düşürüp oyunu akıcılaştırabilirsin": 'Tip: lower the graphics quality in SETTINGS for smoother play',
  'İpucu: Z tuşuyla emote yapabilirsin': 'Tip: press Z to emote',
  'KLASİK · 5v5 taktik bomba maçı': 'CLASSIC · 5v5 tactical bomb match', 'PARKUR · kılıçla engel yarışı (5 parkur)': 'PARKOUR · sword obstacle race (5 courses)', ' yarışçı': ' racers',
  'Kılıçla engel yarışı · 5 raunt, her raunt farklı uzun parkur · bitişe ilk varan raundu alır': 'Sword obstacle race · 5 rounds, a different long course every round · first to the finish wins the round',
  'Elinde yalnızca kılıç var: rakipleri it, barikatları kır, boşluklardan atla. Düşersen son kontrol noktasından devam edersin.': 'You only have a sword: push rivals, break barricades, jump over gaps. If you fall you continue from the last checkpoint.',
  'Mod: PARKUR · 5 parkur · takım yok, herkes kendi için yarışır · Yarışçı: ': 'Mode: PARKOUR · 5 courses · no teams, everyone races for themselves · Racers: ', ' (botlarla)': ' (with bots)', ' · Zorluk: ': ' · Difficulty: ',
  'KONTROL NOKTASI': 'CHECKPOINT', 'DÜŞTÜN': 'YOU FELL', 'BAŞTAN DEVAM': 'BACK TO START', 'BİTİRDİN · ': 'FINISHED · ', ' BİTİRDİ · ': ' FINISHED · ',
  'Süre doldu — en öndeydin': 'Time up — you were in front', 'Bitişe ilk sen vardın': 'You reached the finish first', ' RAUNDU KAZANDI': ' WON THE ROUND',
  'Süre doldu — en öndeki kazandı': 'Time up — the leader won', 'Bitişe ilk o vardı': 'They reached the finish first', ' SENİ İTTİ!': ' PUSHED YOU!',
  'DÖNEN ÇUBUK SENİ SAVURDU!': 'THE SWEEPER KNOCKED YOU AWAY!', 'KOŞ! — BARİYER KALKTI': 'RUN! — BARRIER DOWN',
  'Bitişe ilk varan raundu alır · kılıçla itebilir, barikatları kırabilirsin': 'First to the finish wins the round · push with your sword, break barricades',
  'Bitişe ilk varan raundu alır · düşersen kontrol noktasından devam': 'First to the finish wins the round · fall and you continue from the checkpoint',
  'Bitişe ilk varan raundu alır': 'First to the finish wins the round',
  'PARKURDA YETENEK YOK — YALNIZCA KILIÇ': 'NO ABILITIES IN PARKOUR — SWORD ONLY', 'PARKURDA MAĞAZA YOK — YALNIZCA KILIÇ': 'NO SHOP IN PARKOUR — SWORD ONLY',
  'BARİKAT — sol tık ile kılıçla kır (sağ tık: güçlü darbe)': 'BARRICADE — left click to break it with your sword (right click: heavy hit)', 'BARİKAT — ATEŞ ile kılıçla kır': 'BARRICADE — break it with FIRE',
  'PARKUR · GENEL SIRALAMA': 'PARKOUR · OVERALL STANDINGS', 'PARKUR ŞAMPİYONU: ': 'PARKOUR CHAMPION: ', 'PARKUR ': 'PARKOUR ', 'KALAN ': 'LEFT ', ' OLDUN': ' PLACE', ' raunt': ' rounds', '. SEN': '. YOU',
  'Bomba burada kurulabilir': 'The bomb can be planted here', 'TAKIMIN · ': 'YOUR TEAM · ', 'RAKİP · ': 'ENEMY · ',
  'GÖK PİSTİ': 'SKY TRACK', 'SAKURA KÖPRÜLERİ': 'SAKURA BRIDGES', 'BUZ SIRTI': 'ICE RIDGE', 'LAV GEÇİDİ': 'LAVA PASS', 'YÖRÜNGE': 'ORBIT', 'NEON KULELER': 'NEON TOWERS', 'TAPINAK YOLU': 'TEMPLE PATH',
  'Bulutların üstünde, güneşli bir pist': 'A sunny track above the clouds', 'Kiraz çiçekleri arasında asma köprüler': 'Hanging bridges among cherry blossoms',
  'Kaygan görünen ama sağlam buz yolu': 'An ice road that looks slippery but holds', 'Altında lav, üstünde kızıl gökyüzü': 'Lava below, a red sky above',
  'Dev gezegenin önünde, boşlukta bir pist': 'A track in the void before a giant planet', 'Gece şehrinin üstünde ışıklı yol': 'A glowing road above the night city', 'Ormanın üstünde taş patika': 'A stone path above the forest'
});
for (const k of Object.keys(EN_FRAG)) { if (k.length < 26 && /^[A-Za-zÇĞİÖŞÜçğıöşü ]+$/.test(k)) { const u = k.toLocaleUpperCase('tr-TR'); if (u !== k && !(u in EN_FRAG)) EN_FRAG[u] = EN_FRAG[k].toUpperCase(); } }
const EN_RULES = [
  [/^\+(\d+) CAN$/, '+$1 HP'], [/^RAUNT (\d+)( \/ |\/)(\d+)$/, 'ROUND $1$2$3'], [/^(\d+) sn$/, '$1 s'], [/(\d+) sn\b/g, '$1 s'], [/ \(BOT\)$/, ' (BOT)']
];
let _EN_RE = null; const _EN_CACHE = new Map();
function tl(s) { return LANG === 'tr' ? s : tlEN(s); }
function tlEN(s) {
  if (s === undefined || s === null) return s;
  s = String(s); if (!s) return s;
  const c = _EN_CACHE.get(s); if (c !== undefined) return c;
  let r = EN_EXACT[s];
  if (r === undefined) {
    if (!_EN_RE) _EN_RE = new RegExp(Object.keys(EN_FRAG).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    r = s.replace(_EN_RE, m => EN_FRAG[m]);
    for (const [re, to] of EN_RULES) r = r.replace(re, to);
  }
  if (_EN_CACHE.size > 3000) _EN_CACHE.clear();
  _EN_CACHE.set(s, r); return r;
}
/* DOM: metin düğümlerini ve placeholder'ları çevir (orijinal saklanır, Türkçeye dönünce geri yüklenir) */
const _I18N_ORIG = new WeakMap();
let _i18nBusy = false;
function i18nNode(n) {
  if (n.nodeType === 3) {
    const p = n.parentNode; if (!p || p.closest && p.closest('[data-noi18n],script,style')) return;
    const t = n.data; if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(t)) return;
    const tr = x => x.match(/^\s*/)[0] + tlEN(x.trim()) + x.match(/\s*$/)[0];
    let o = _I18N_ORIG.get(n);
    if (o === undefined || (t !== o && t !== tr(o))) { o = t; _I18N_ORIG.set(n, o); }
    const want = LANG === 'tr' ? o : tr(o);
    if (n.data !== want) n.data = want;
  } else if (n.nodeType === 1) {
    if (n.closest && n.closest('[data-noi18n]')) return;
    if (n.placeholder !== undefined && n.getAttribute && n.getAttribute('placeholder')) {
      if (!n.dataset.ph0) n.dataset.ph0 = n.getAttribute('placeholder');
      n.setAttribute('placeholder', LANG === 'tr' ? n.dataset.ph0 : tl(n.dataset.ph0));
    }
    for (const ch of n.childNodes) i18nNode(ch);
  }
}
function applyLang() {
  _i18nBusy = true;
  try { i18nNode(document.body); } catch (e) { }
  _i18nBusy = false;
  document.documentElement.lang = LANG;
  const he = document.getElementById('helpEN'), ht = document.getElementById('helpTR');
  if (he && ht) { he.classList.toggle('hidden', LANG !== 'en'); ht.classList.toggle('hidden', LANG === 'en'); }
}
function setLang(l) {
  LANG = l === 'en' ? 'en' : 'tr'; _EN_CACHE.clear();
  try { localStorage.setItem('spk_lang', LANG); } catch (e) { }
  applyLang();
}
function i18nObserve() {
  if (typeof MutationObserver === 'undefined') return;
  const mo = new MutationObserver(muts => {
    if (LANG === 'tr' || _i18nBusy) return;
    _i18nBusy = true;
    try { for (const m of muts) { if (m.type === 'characterData') i18nNode(m.target); else for (const n of m.addedNodes) i18nNode(n); } } catch (e) { }
    _i18nBusy = false;
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
}
