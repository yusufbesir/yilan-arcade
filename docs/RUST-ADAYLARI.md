# Rust'a taşınacak game.js fonksiyonları (aday listesi, 0.9.3 main)

Ölçüt: kare/tik başına çalışan, DOM'a ve canvas'a dokunmayan saf hesap. Taşıma sırası öneri; çizim, menü ve panel kodu JS'te kalır.

| Öncelik | game.js | İş | Not |
|---|---|---|---|
| 1 | `tickTron` (2936), Tron rakip YZ | yol/tehlike seçimi | core'da Tron YZ iskeleti var (#28) |
| 1 | `spawnFood` (855) | boş hücre seçimi, engel/portal/lav/çamur dışlama | PCG32 tohumlu, Günlük için kritik |
| 2 | `tickBullets` (965), `tickWaves` (1026), `tickBoss` (1138) | mermi deseni, çarpışma | Mermi Manyağı |
| 2 | `tickTailgun` (1351), `tickSurvivor` (1460) | düşman sürüsü hareketi, çarpışma, XP | en ağır döngü |
| 3 | `tickMovingObs` (1713), `tickPowerups` (1619) | hareketli engel, güç süreleri | |
| 3 | `src/tema.js` kural motoru | lav takvimi, çamur, rün hücreleri | tik süresiyle ilerler, saf mantık |
| 3 | `src/isik.js` parçacık havuzu | 60 parçacık simülasyonu | çizim JS'te |
| 4 | `src/tapinak.js` oda üretimi + düşman YZ | tohumlu 3x3 harita | Tapınak ayrı iş, o başlıkla koordine |
| JS'te kalır | `tick` (694) ana akış, `draw*`, `render*`, menü/panel, Market, ses | | arayüz katmanı |

Python: `tools/` altında (paketle, varlık küçültme, denge botu); Rust çekirdek çıktısı Python botuyla dengelenir.

Kural: bir fonksiyon taşınırken JS tarafı aynı imzayla ince bir sarmalayıcı olarak kalır, `?test=1` testleri değişmeden geçmeli.
