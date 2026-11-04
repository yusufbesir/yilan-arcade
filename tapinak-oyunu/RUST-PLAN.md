# Emberwake: Rust + Python geçiş planı

Kural (Yusuf, 2026-11-04): ağır hesap ve asıl iş Rust'ta, üstünde Python; diğer diller parça parça. Rust ağırlıklı.

## Hedef mimari
- **`core/` (Rust, crate `emberwake-core`)**: bugünkü `src/mantik.js` mantığının tamamı: tohumlu RNG, oda şablonları ve ulaşılabilirlik (BFS), kadro ve dalga üretimi, çarpışma, dövüş, düşman yapay zekası, boss, açlık/susuzluk, Miras ve Mühür kuralları.
  Aynı çekirdek üç yere derlenir: WASM (oyun), PyO3 eklentisi (Python), yerel test (cargo test).
- **Oyun (tarayıcı/WebView)**: `ciz.js`, `oyun.js`, `ses.js` ince katman olarak kalır (çizim, girdi, arayüz). Çekirdek her karede küçük bir durum anlık görüntüsü (JSON/typed array) döndürür.
- **Paketleme**: Electron yerine **Tauri 2** (Rust kabuk, WebView2). Kurulum ve kaldırma NSIS ile, exe ~10 MB civarı (Electron ~80 MB). Kayıt dosyası Rust tarafında doğrulanarak yazılır.
- **Python (`tools/`)**: (1) denge simülatörü: PyO3 bağlamasıyla binlerce bot koşusu, diyar/bölüm başına ölüm oranı ve Kül eğrisi; (2) varlık hattı: palet/doku/sprite üretimi (Pillow) ve önizleme; (3) test düzenleyici ve sürüm betikleri.
- JS yalnız çizim, DOM ve Web Audio için kalır.

## Aşamalar (her aşama kendi PR'ı, her aşamada oyun çalışır kalır)
1. **Temel (bu PR'da başladı)**: `core/` iskeleti, mulberry32 RNG'nin JS ile birebir aynı çıktısı (karşılaştırma testi). Kanıt: aynı tohum, aynı sayı dizisi.
2. **Oda üretimi**: şablonlar, tehlikeler, BFS, kadro; JS ile aynı tohumda aynı ızgara (parite testi, 1500 oda). WASM olarak `ulasilir` ve `odaUret` çağrılır.
3. **Savaş çekirdeği**: `adim()`, düşman yapay zekası, boss, mermiler. JS sürümü bir sürüm boyunca yedek kalır; parite: aynı girdi dizisiyle aynı durum.
4. **Python**: `maturin` ile `emberwake_py`; denge simülatörü ve ilk dengeleme raporu.
5. **Tauri paketi**: `src-tauri/`, NSIS kurulum + kaldırma, `Emberwake-Setup-<sürüm>.exe`. Electron kaldırılır (eski `main.js` silinmez, `eski/` altında kalır).
6. **Yılan Arcade ve diğer uygulamalar**: aynı kalıp (Rust çekirdek + Python araçları), uygulama başına ayrı plan; sıra Yusuf/koordinatör kararı.

## Araçlar ve riskler
- Bulutta Rust 1.97 ve Python 3.13 var; `wasm-pack` ve `maturin` yok, kurulumları ağdan inecek (ağ izni denenir). Olmazsa PC oturumu kurar.
- PC'de Rust araç zinciri (rustup, MSVC derleme araçları, WebView2) kurulu mu bilinmiyor: PC oturumu önce `rustc --version` ile bakar; kurulum yeni uygulama kuralıyla `D:\Programlar\Indirilenler\` altına.
- Aynı anda tek ağır derleme kuralı geçerli: Tauri/cargo derlemeleri PC sırasına girer.
- Parite testleri geçmeden JS mantığı silinmez (silme zaten yasak; eski kod `eski/`).
- Dış bağımlılıklar (crate/pip) sürümleri sabitlenir, `Cargo.lock` ve kilit dosyaları depoya girer.
