# Emberwake: Godot 4 + Rust geniş oyun planı

Karar (Yusuf, 2026-11-04): motor Godot 4, mantık Rust, üst katman ve araçlar Python. Oyun uzun süre büyüyecek, sürekli yeni özellik eklenecek. Bu yüzden mimari "veri güdümlü ve eklenebilir" kurulur.

## İlkeler
1. **Rust çekirdek (`core/`) tek gerçek kaynak**: tohumlu, deterministik, Godot'tan bağımsız (`cargo test` ile sınanır). Godot yalnız çizer, sesi çalar, girdi alır.
2. **Veri güdümlü içerik**: düşman, Armağan, Mühür, Miras, biyom, şablon, engel tanımları `core/data/*.ron` (ya da .json) dosyalarında. Yeni içerik = yeni satır, kod değil. Python aracı bu dosyaları doğrular ve denge simülasyonu koşar.
3. **Yetenek/olay kancaları**: Armağan ve Mühür etkileri "kanca" olarak (vuruşta, öldürmede, odaya girişte, atılımda) kaydedilir; eşleşmeler ve yeni Armağanlar çekirdeği değiştirmeden eklenir.
4. **JS sürümü oynanabilir kalır** ve Godot sürümü dengeye ulaşana kadar referans olur. JS ile Rust paritesi testlerle korunur; parite biten alt sistem için JS donar.
5. **Sade ve özgün**: yeni özellik oyun ruhunu bozmaz; dövüş kuralı değişimi (karşılık, ikinci faz) Yusuf onayı ister.
6. **Piksel sanat**: Godot'ta nearest filtre, düşük çözünürlük SubViewport (480x310), tamsayı ölçek.

## Aşamalar
| # | Aşama | Çıktı | Durum |
|---|---|---|---|
| 0 | Araçlar | Godot 4.7.2, Rust, MSVC | bitti |
| 1 | Oda/dalga üretimi Rust'ta | JS ile 21.840 odada parite | bitti |
| 2 | Godot önizleme | gdext köprüsü, oda 2.5D çizimi | bitti |
| 3 | Veri tabloları Rust'ta | düşman, Armağan, Mühür, Miras, biyom tabloları + Python doğrulayıcı | bitti (core/data, tools/export-data.js, tools/dogrula.py) |
| 4 | Savaş çekirdeği | oyuncu hareketi, vuruş, atılım, köz, çarpışma, mermi; adım(dt) JS ile aynı sonuç (bot koşusu paritesi) | |
| 5 | Düşman yapay zekâsı | 12 tür + 3 boss, elit etkiler | |
| 6 | Koşu döngüsü | kapılar, odalar, açlık/susuzluk, Pazar, Armağan seçimi, Miras, Günlük Koşu | |
| 7 | Godot oynanabilir | tek koşu baştan sona, menü, HUD, ses, gamepad | |
| 8 | Paket | Godot dışa aktarım (Windows exe, ~50 MB), D:\Programlar\Emberwake\ | |
| 9 | Genişleme | yeni biyomlar ve engeller, boss'lar, mini-boss, hikâye parçaları, kalıcı Miras ağacı, eşleşmeler | sürekli |

## Genişleme yolu (Yusuf'un istekleri dahil)
- **Biyoma özgü engeller**: lav nehri (var), buz dağı/buzlu zemin, ağaç/kök, su nehri (geçit/köprü), kar yığını, tuzak dikeni. Engel = veri satırı: ad, geçilebilir mi, hasar, çizim anahtarı.
- Yeni biyomlar (ör. Asgard çayırı, Altay bozkırı), her biri 4 bölüm, kendi şablon ağırlığı ve düşman havuzu.
- Yeni Armağan eşleşmeleri, Mühürler (Sisli Oda), Pazar Armağan satışı, Köz Sınavı odası, Boss Provası.
- Python: denge simülatörü (bot koşusu binlerce tohum), ölüm raporu, varlık hattı (palet doğrulama).

## Test stratejisi
- `cargo test`: parite (JS çıktı dosyaları), özellik testleri, bot koşuları.
- Godot tarafı: `--headless` açılış testi, ekran görüntüsü karşılaştırma (PC oturumu).
- Her aşama sonunda commit, kısa rapor; PC derlemesi tek yuva kuralına göre.

## Riskler
- Savaş paritesi (aşama 4-5) en büyük iş; küçük parçalara bölünür, her parça JS ile karşılaştırılır.
- gdext API sürümü (4.6) ile çalışma sürümü (4.7.2) uyumlu görünüyor; Godot güncellenirse yeniden sınanır.
- Godot dışa aktarım şablonları PC'ye indirilmeli (aşama 8, Yusuf onayı verildi).
