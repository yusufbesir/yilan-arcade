# Köz Tapınağı: ayrı 2.5D aksiyon oyunu (plan)

Karakter yılan değil: **Köz**, yanan fener taşıyan kapüşonlu gezgin (kılıç + köz atışı + atılım).
Yılan oyunundaki Tapınak modundan bağımsızdır; kod ve varlık paylaşmaz (tek bağımsız klasör, kendi testi).

## Kapsam
1. 2.5D: eğik bakış, yükseltilmiş duvar/sütun, gölgeler, ışık, parçacık, ekran sarsıntısı (hepsi kodla çizilir).
2. Hades benzeri döngü: 6 odalık koşu, kapı seçimi (ödül simgesi görünür), Armağan seçimi (3'ten 1), Kül Jarlı boss'u.
3. Sifu/Miras benzeri güçlenme: her koşuda Kül kazanılır; Miras sunağında kalıcı yükseltmeler; ölünce 1 kez geri dönüş seçeneği.
4. Metroidvania: boss'u yenince Kırıcı Rün (çatlak duvarlar), gizli odada Gölge Atılımı (uçurum geçişi); kalıcıdır.
5. Özgünlük: hiçbir oyunun varlığı, adı, metni kullanılmadı; ilham yalnız tür mekaniği.

## Dosyalar
- `src/mantik.js`: saf mantık (tohumlu, DOM yok, test edilebilir).
- `src/ciz.js`: 2.5D çizim. `src/oyun.js`: girdi, döngü, arayüz. `index.html`.
- `test/mantik.test.js`: Node testi (üretim, çarpışma, dövüş, Armağan, Miras, yetenek kapıları, bot koşusu).

## Sıra
mantık → test → çizim → arayüz → tarayıcıda ekran görüntüsü → PR.
Çalıştırma: `index.html` tarayıcıda ya da `npx electron tapinak-oyunu` (PC derlemesi sırası koordinatörden istenir).
