# Köz Tapınağı

Ayrı 2.5D aksiyon oyunu (yılan oyunundan bağımsız). Karakter: **Köz**, fener taşıyan gezgin.
Hades benzeri oda koşusu, Armağan seçimi, Miras ile kalıcı güçlenme, metroidvania yetenek kapıları. Tüm görseller kodla çizilir, dış varlık yok.

- Çalıştır: `tapinak-oyunu/index.html` dosyasını tarayıcıda aç (derleme gerekmez).
- Test: `node tapinak-oyunu/test/mantik.test.js`
- Tuşlar: WASD hareket, fare nişan, sol tık/Boşluk savur, sağ tık/E köz at, Shift atılım, Esc duraklat.
- Kalıcı yetenekler: Kırıcı Rün (boss'u yen, çatlak duvarları kırar), Gölge Atılımı (gizli sunak, uçurum geçer).
- Plan: `PLAN.md`. İleride kendi deposuna taşınabilir (`yusufbesir/koz-tapinagi` açılırsa klasör olduğu gibi kopyalanır).
- Ses: Web Audio ile prosedürel (dosya yok), M ile sessiz. Oyun kolu: sol çubuk hareket, sağ çubuk nişan, A savur, X köz, B atılım, Start duraklat.
- Exe: `cd tapinak-oyunu && npm ci && npm run dist` (Electron 45.2.2 + electron-builder 26.18.0, NSIS kurulum + kaldırma). Çıktı `dist/`.
