# Twilight of the Serpents

Twilight of the Serpents (eski adı Yılan Arcade): Klasik, Mermi Manyağı, Kuyruk Silahı, Survivor, Zamana Karşı, Portal ve Bulmaca, Tron Düellosu, Kaos, Günlük Meydan Okuma ve Bölüm (30 bölüm) modları.

- `src/index.html`: güncel oyun (tek dosya)
- `legacy/eski-surum.html`: eski sürüm, saklanır
- `main.js`: Electron kabuğu

## Çalıştırma (geliştirme)
`npm install` sonra `npm start`

## Windows kurulum dosyası
`npm run dist` Çıktı: `dist/Twilight-of-the-Serpents-Setup-<sürüm>.exe` (kurulum ve kaldırma programı içerir).

Not: oyun yazı tipini Google Fonts'tan alır; internet yoksa sistem tek aralıklı yazı tipine döner.

## Test
Mod duman testleri (Playwright gerekir): `npm test`. Yazı tipi yerel (`src/fonts`, SIL OFL), ağ gerekmez.

## Derleme
Tekrarlanabilir derleme için `npm ci`, sonra `npm run dist`. `npm audit --omit=dev`: 0 açık; kalan uyarılar yalnız geliştirme araçlarında (electron-builder, test), uygulamanın içine girmiyor.

## Kurulum notu (kod imzası yok)
Kurulum dosyası kod imzalı değil, bu yüzden Windows SmartScreen "Windows bilgisayarınızı korudu" uyarısı gösterebilir. Dosyayı kendiniz derlediyseniz veya SHA256 değeri `BUILD-NOTU.md` ile aynıysa: **Ek bilgi** → **Yine de çalıştır**. Kişisel kullanım için ayrı bir sertifika alınmadı.

## İki oyuncu, gamepad ve erişilebilirlik

- Tron Düellosu kartındaki **2 OYUNCU** düğmesi açıkken rakip yapay zekâ yerine ikinci oyuncu geçer: P1 WASD, P2 ok tuşları; ilk 5 turu alan kazanır. Bu modda rekor ve başarım kaydedilmez.
- **Gamepad**: sol çubuk ya da yön tuşları hareket, A ateş, Start duraklat. İki oyuncuda ilk kol P1, ikinci kol P2. Klavye eşlemesinin aynısıdır, ayrı ekran yoktur.
- Ayarlar'da **BÜYÜK HUD** ve **RENK KÖRÜ PALETİ** (yılan mavi, yem beyaz halkalı, rakip turuncu).

## Görseller

Menü arka planı (`src/img/menu-bg.jpg`) ve amblem (`src/img/emblem.png`) Canva ile üretildi; ayrıntı `CREDITS.md`. Amblem yüklenemezse kodla çizilen SVG logo görünür. Anahtar görsel menüde belirgin, oyun sırasında soluktur.

## Ayarlar, müzik ve başarımlar
- Menüdeki **Ayarlar** paneli: oyun hızı, efekt yoğunluğu, ses seviyesi, hareket azaltma, ekran sarsıntısı, müzik. Ayarlar tarayıcıda saklanır.
- Müzik prosedüreldir (Web Audio), `B` tuşuyla açılıp kapanır.
- 14 başarım; menüdeki **Başarımlar** düğmesinden görülür. Oyun sonunda mod başına ilk 5 skor listelenir.
- Varlık kaynakları: `CREDITS.md`.

## Ses
Menüdeki düğmeyle veya oyunda `N` tuşuyla ses açılıp kapanır; tercih kaydedilir.
