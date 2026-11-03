# Yılan Arcade

Pixel Yılan Arcade: Klasik, Kampanya (30 bölüm) ve Mermi modları.

- `src/index.html`: güncel oyun (tek dosya)
- `legacy/eski-surum.html`: eski sürüm, saklanır
- `main.js`: Electron kabuğu

## Çalıştırma (geliştirme)
`npm install` sonra `npm start`

## Windows kurulum dosyası
`npm run dist` Çıktı: `dist/Yilan-Arcade-Kurulum-<sürüm>.exe` (kurulum ve kaldırma programı içerir).

Not: oyun yazı tipini Google Fonts'tan alır; internet yoksa sistem tek aralıklı yazı tipine döner.

## Test
Mermi Manyağı duman testi: `node test/bullet-mode.test.js` (Playwright gerekir).
