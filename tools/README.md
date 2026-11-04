# tools/ — yardımcı araçlar

Python araçları yalnız standart kütüphane kullanır ve `python3 -I` ile çalışır (kucult.py ayrıca Pillow ister).

## Paketleme: `tools/paketle/paketle.py`
- `python3 -I tools/paketle/paketle.py --kontrol` — derleme öncesi denetim: package.json sürümü, BUILD-NOTU.md ve CHANGELOG.md (ya da README.md) varlığı, `src/` altında `on*=` satır içi işleyici sayısı (0 olmalı), `src/img` toplam boyutu (varsayılan sınır 30 MB, `--img-sinir-mb`), CREDITS.md'de her `src/img/tex/<ID>` için kaynak satırı, sıfır baytlık dosya. Hata varsa çıkış kodu 1.
- `python3 -I tools/paketle/paketle.py --ozet <exe yolu>` — PC'de elle derlemeden sonra: bayt/MB boyutu, SHA256 ve BUILD-NOTU.md'ye eklenecek sürüm bölümü taslağı stdout'a yazılır. Hiçbir dosya değiştirilmez; çıktıyı elle yapıştırın.
- `--kok DIZIN` ile başka bir depo kökü verilebilir.

## Varlık: `tools/varlik/kucult.py`
- `python3 -I tools/varlik/kucult.py KAYNAK HEDEF [--boyut 512]` — klasördeki jpg/png dosyalarını küçültüp HEDEF'e yazar. Pillow gerekir; yoksa açık hata verip çıkar (kod 3). Dosya silmez, kaynağı değiştirmez, hedefteki dosyanın üzerine yazmaz.

## Testler
- `python3 -I -m unittest discover -s tools/test`
- Oyun testleri ayrı: `NODE_PATH=$(npm root -g) npm test`

Diğer: `tools/bake/` (sprite pişirme, Node), `tools/denge-bot/` (denge botu).
