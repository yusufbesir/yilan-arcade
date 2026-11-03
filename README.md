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
