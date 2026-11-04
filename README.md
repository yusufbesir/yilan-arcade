# Twilight of the Serpents

Twilight of the Serpents (eski adı Yılan Arcade): Klasik, Mermi Manyağı, Kuyruk Silahı, Survivor, Zamana Karşı, Portal ve Bulmaca, Tron Düellosu, Kaos, Günlük Meydan Okuma ve Bölüm (30 bölüm) modları.

- ~~`src/index.html`: güncel oyun (tek dosya)~~ `src/index.html`: işaretleme ve CSS; `src/game.js`: tüm oyun mantığı (0.6.1'den beri ayrı dosya, CSP gereği)
- `migrate.js`: eski uygulama adlarından (Yılan Arcade, Ragnarök, Sampo) kullanıcı verisini taşır
- `legacy/eski-surum.html`: eski sürüm, saklanır
- `main.js`: Electron kabuğu

## Çalıştırma (geliştirme)
`npm install` sonra `npm start`

## Windows kurulum dosyası
`npm run dist` Çıktı: `dist/Twilight-of-the-Serpents-Setup-<sürüm>.exe` (kurulum ve kaldırma programı içerir).

~~Not: oyun yazı tipini Google Fonts'tan alır; internet yoksa sistem tek aralıklı yazı tipine döner.~~ Not (0.4.1'den beri): yazı tipi yerel `src/fonts` klasöründedir, ağ gerekmez.

## Test
Mod duman testleri (Playwright gerekir): `npm test`. Yazı tipi yerel (`src/fonts`, SIL OFL), ağ gerekmez.

## Derleme
Tekrarlanabilir derleme için `npm ci`, sonra `npm run dist`. `npm audit --omit=dev`: 0 açık; kalan uyarılar yalnız geliştirme araçlarında (electron-builder, test), uygulamanın içine girmiyor.

## Kurulum notu (kod imzası yok)
Kurulum dosyası kod imzalı değil, bu yüzden Windows SmartScreen "Windows bilgisayarınızı korudu" uyarısı gösterebilir. Dosyayı kendiniz derlediyseniz veya SHA256 değeri `BUILD-NOTU.md` ile aynıysa: **Ek bilgi** → **Yine de çalıştır**. Kişisel kullanım için ayrı bir sertifika alınmadı.

Yerel kurulum dosyaları (Yusuf'un bilgisayarı, depoya girmez): güncel exe'ler `D:\Programlar\Yilan-Arcade\` klasöründe, eski sürümler aynı klasörün `eski\` alt klasöründe tutulur.

## Kaos, hız kademesi ve günlük

- **Kaos'ta çürük yem**: koyu mor, duman çıkaran yem; yenirse puan vermez, yılanı 2 halka kısaltır (en az 3 kalır). Yalnız Kaos modunda çıkar.
- **Hız kademesi**: Klasik, Portal ve Günlük modlarda her 5 yemde bir kademe (1–10), HUD'daki HIZ kutusunda görünür; kademe 10'da en yüksek hız.
- **Günlük'te dünkü skor**: dün oynandıysa HUD'da DÜN kutusunda dünkü skor görünür; geçilince ışıltı ve bant. Ayrıntı: dünkü skor `records.dailyPrev` kaydından okunur ve yalnız tarih damgası dünün tarihine eşitse gösterilir; açılış bandında da "DÜN: <skor>" yazar.
- **Çürük yem ayrıntısı**: Kaos'ta yem %15 olasılıkla çürük çıkar (`curuk`), yenince "ÇÜRÜK YEM! -2" bandı, vuruş sesi ve sarsıntı olur. Hız kademesi yalnız Klasik, Portal ve Günlük modlarında işler (`CLASSIC_LIKE`); kademe = 1 + yem/5, hız her kademede 10 ms artar, 50 ms tabanı aşmaz; kademe değişince "HIZ n" bandı çıkar.
- Tron'daki tek oyuncu rakibi zaten kural tabanlıdır (en geniş alana döner, kazandıkça akıllanır).

## Güvenlik

Electron 45; pencere contextIsolation, sandbox, nodeIntegration kapalı, izin isteği reddi, webview engeli, yalnız kendi index.html'ine gezinme (URL ayrıştırmalı) ve CSP ile açılır; devTools yalnız paketsiz sürümde. Betik `src/game.js` dosyasındadır, satır içi betik ve `onclick` yoktur (CSP `script-src 'self'`); tıklamalar `data-act` ile tek dinleyiciden geçer. Ayarlar ve başarım kayıtları yüklenirken tip ve aralık denetiminden geçer; eski veri taşıması geçici klasöre kopyalayıp yeniden adlandırır, sembolik bağlantıları kopyalamaz. Test API'si (`SnakeGame._debug`, `_ach`) yalnız sayfa `?test=1` ile açıldığında vardır; paketli oyunda yoktur. `test/guvenlik.test.js` bunları doğrular.

## İki oyuncu, gamepad ve erişilebilirlik

- Tron Düellosu kartındaki **2 OYUNCU** düğmesi açıkken rakip yapay zekâ yerine ikinci oyuncu geçer: P1 WASD, P2 ok tuşları; ilk 5 turu alan kazanır. Bu modda rekor ve başarım kaydedilmez.
- **Gamepad**: sol çubuk ya da yön tuşları hareket, A ateş, Start duraklat. İki oyuncuda ilk kol P1, ikinci kol P2. Klavye eşlemesinin aynısıdır, ayrı ekran yoktur.
- Ayarlar'da **BÜYÜK HUD** ve **RENK KÖRÜ PALETİ** (yılan mavi, yem beyaz halkalı, rakip turuncu).
- Gamepad eşlemesi (`padKeys`, `src/game.js`): sol çubuk (eşik ±0.5) veya d-pad düğmeleri 12/13/14/15 yön; düğme 0 (A) ateş (boşluk); düğme 9 (Start) duraklat (P); düğme 1/2/3 Survivor yükseltme seçimi (kol 1 → "1", kol 2 → "2"). Tron 2 oyuncuda kol 1 WASD'ye (P1), kol 2 ok tuşlarına (P2) çevrilir; tek oyuncuda her kol ok tuşlarıdır. Kol durumu Ayarlar panelindeki GAMEPAD satırında ("n KOL BAĞLI") görünür; kol girişi yalnız oyun ekranı açıkken işlenir.
- Tron 2P ayrıntısı: `2 OYUNCU` anahtarı `tron2p` ayarıdır ve diğer ayarlarla birlikte saklanır; açıkken HUD'da TUR ve "P1 - P2" skor kutusu görünür, oyun sonunda rekor yazılmaz (`kayitYok`).
- **Erişilebilirlik ayarları**: HAREKET AZALTMA (sistem `prefers-reduced-motion` ayarı da aynı etkiyi yapar; sarsıntı, kuzey ışıkları ve giriş animasyonları kapanır), EKRAN SARSINTISI aç/kapa, BÜYÜK HUD (HUD yazıları büyür, `buyuk-hud` sınıfı), RENK KÖRÜ PALETİ. Hepsi `data-act="toggle"` düğmeleriyle değişir ve kaydedilir.

## Dokunmatik kontroller

- Dar ekranda (genişlik ≤ 700 px) oyun ekranının altında bir yön takımı (d-pad) belirir: ▲ ◀ ▶ ▼ düğmeleri `data-act="input"` ile yön verir, ortadaki `| |` düğmesi duraklatır.
- Yön ve ateş düğmeleri `pointerdown` ile basar basmaz çalışır (tıklama bitişi beklenmez); 0.7.1'de satır içi `ontouchstart`/`onpointerdown` CSP'ye takıldığı için `src/game.js` içindeki tek dinleyiciye alındı.
- Ateş düğmesi (🔫, `data-press="fire"`) yalnız Kuyruk Silahı modunda görünür; diğer modlarda gizlidir.
- Oyun tuvalinde dokunma kaydırmayı engeller (`touchstart` preventDefault).

## Görseller

Menü arka planı (`src/img/menu-bg.jpg`) ve amblem (`src/img/emblem.png`) Canva ile üretildi; ayrıntı `CREDITS.md`. Amblem yüklenemezse kodla çizilen SVG logo görünür. Anahtar görsel menüde belirgin, oyun sırasında soluktur.

## Ayarlar, müzik ve başarımlar
- Menüdeki **Ayarlar** paneli: oyun hızı, efekt yoğunluğu, ses seviyesi, hareket azaltma, ekran sarsıntısı, müzik. Ayarlar tarayıcıda saklanır. (0.6.0'dan beri ayrıca Büyük HUD, Renk körü paleti ve Gamepad durumu; ayar anahtarları: `speed, fx, vol, reduced, shake, music, bigHud, cb, tron2p`.)
- Müzik prosedüreldir (Web Audio), `B` tuşuyla açılıp kapanır.
- 14 başarım; menüdeki **Başarımlar** düğmesinden görülür. Oyun sonunda mod başına ilk 5 skor listelenir.
- Varlık kaynakları: `CREDITS.md`.

## Ses
Menüdeki düğmeyle veya oyunda `N` tuşuyla ses açılıp kapanır; tercih kaydedilir.

## Sürüm geçmişi

Kaynak: `git log` (main dalı). Sürüm numarası commit iletilerinden alındı; 0.4.0 öncesi commit'lerde (0.1.0–0.3.0) sürüm iletide yoksa yazılmadı.

| Sürüm | Değişiklik |
|---|---|
| 0.4.0 | Ayarlar paneli, prosedürel müzik, zengin ses efektleri, 14 başarım, mod başına ilk 5 skor, SVG logo ve CREDITS eklendi. |
| 0.4.1 | Denetim düzeltmeleri: kayıt şeması doğrulama, günlük tarih damgası, büyük ekranda keskin tuval, kart tıklama y kontrolü, eski veri taşıma, pencere güvenliği, OFL metni ve MIT lisans. |
| 0.4.2 | userData taşıma: eski ad adayları (Yılan Arcade, Ragnarök, Sampo) için `migrate.js` + test, izin isteği reddi, ölü kod kaldırıldı. |
| 0.5.0 | Canva ile üretilen amblem ve menü anahtar görseli eklendi. |
| 0.6.0 | Tron içinde 2 oyuncu, gamepad desteği, Büyük HUD ve renk körü paleti, denetim düzeltmeleri. |
| 0.6.1 | Güvenlik bakımı: Electron 45, sıkı CSP (betik `game.js`'e taşındı), test API'si yalnız test modunda, sertleştirmeler. |
| 0.7.0 | Kaos'ta çürük yem, hız kademesi 1–10 (HUD), Günlük'te dünkü skoru geçme. |
| 0.7.1 | Dokunmatik d-pad/ateş: satır içi `ontouchstart`/`onpointerdown` kaldırıldı (CSP ihlali), `pointerdown` dinleyicisi eklendi. |
