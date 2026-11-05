# Emberwake

2.5D piksel art aksiyon oyunu (yılan oyunundan bağımsız). Karakter: **Köz**, fener taşıyan gezgin.
Nors ve Türk mitolojisinden esinli üç diyar, Hades/Dead Cells tarzı oda koşusu, Miras ile kalıcı güçlenme, metroidvania yetenek kapıları, hafif hayatta kalma (açlık/susuzluk).

## Diyarlar (her biri 4 bölüm; ilerledikçe palet, tehlike ve düşman havuzu değişir)
1. **Gjallar Höyükleri** (Nors, Niflheim): buz, dikenli zemin, Draugr/Fenrir yavrusu/Seidr/Hugin kuzgunu/Buz devi. Boss: Kral Hrolf.
2. **Demir Dağ Ocakları** (Türk, Ergenekon): lav, kor. Albastı, Demir Bozkurt (uluma ile sürüyü hızlandırır), Kor cini (patlar), Kalkanlı Demirci. Boss: Tepegöz.
3. **Tamu Kökleri** (Yggdrasil + Erlik Han yurdu): Şahmaran yavruları, Tamu kökü (zemin tuzakları), Tamu gölgesi (hayaletken dokunulmaz). Boss: Erlik Han.

## Tekrarı önleyen sistemler
- 12 oda şablonu (sütun düzeni, nehir, ada, koridor, bölmeli...), art arda tekrar etmez; her oda başlangıçtan kapılara ulaşılabilirlik testinden geçer.
- 5 kadro türü (karışık, sürü, nişancı, ağır, pusu), elit odalar ve elit etkileri (Çevik, Zırhlı, Bölünen, Kanemici).
- Oda türleri: savaş, elit, dinlenme, pazar, gizli oda, lanetli sandık.
- Armağan nadirliği (Yaygın/Nadir/Efsanevi), 10 Armağan (Köz Çemberi, Kurt Tılsımı dahil).
- Mühürler (ilk boss sonrası): zorluk artırır, Kül bonusu verir.

## Çalıştırma ve test
- Tarayıcıda `index.html` aç (derleme gerekmez). Test: `node test/mantik.test.js` (20 test).
- Exe: `npm ci && npm run dist` (Electron 45.2.2 + electron-builder 26.18.0, NSIS). Çıktı `dist/Emberwake-Setup-<sürüm>.exe`.
- Tuşlar: WASD hareket, fare nişan, sol tık/Boşluk savur, sağ tık/E köz, Shift atılım, Esc duraklat, M sessiz. Oyun kolu desteklenir.
- Tüm görseller (piksel doku, sprite) ve sesler kodla üretilir; dış varlık yok. Eski Miras kaydı (`koz-tapinagi-v1`) otomatik okunur.
