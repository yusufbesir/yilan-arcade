# yilan-core (Rust çekirdek)

Bağımlılıksız Rust crate: tohumlu RNG (PCG32) ve Tron rakip YZ'si (`src/game.js` içindeki `tronBlocked` / `floodCount` / `aiChooseDir` mantığının saf hali). `game.js` Tron kararını (aiChooseDir) wasm üzerinden alır; wasm yüklenmezse ya da `?js=1` ile JS yedeği (`src/core/tron.js`) çalışır. Rust değişince: `cargo build --release --target wasm32-unknown-unknown` sonra `python3 -I tools/paketle/wasm_gom.py` (wasm base64 olarak `src/core/yilan_core.wasm.js`ye gömülür; `--kontrol` güncel mi bakar).

## Derleme ve test

```sh
cd core
cargo test                                                # birim testleri
cargo build --release --target wasm32-unknown-unknown     # -> target/wasm32-unknown-unknown/release/yilan_core.wasm
cargo build --release                                     # -> target/release/libyilan_core.so (.dll/.dylib), Python için
node --test test/tron-uyum.test.js                        # JS referansı = wasm uyum testi (wasm önce derlenmeli)
node test/bench.js 10000                                  # JS ve wasm hız ölçümü
```

wasm-bindgen gerekmez: ham `extern "C"` ihracı kullanılır.

## ABI

| İşlev | Anlamı |
|---|---|
| `yc_alloc(bayt) -> ptr`, `yc_free(ptr, bayt)` | Çekirdek belleğinde tampon ayır / bırak |
| `yc_tron_choose(cols, rows, snake*, n, ai*, m, aiDx, aiDy, nextDx, nextDy, wins, r1, r2) -> i32` | Rakip yönü: 0 sağ, 1 sol, 2 aşağı, 3 yukarı; geçersiz girdide -1 |
| `yc_tron_choose_seeded(..., wins, seedLo, seedHi)` | Aynı, r1/r2 PCG32 tohumundan |
| `yc_flood_count(cols, rows, blocked*, n, sx, sy)` | Erişilebilir hücre sayısı (sınır cols*rows) |
| `yc_rng_f64(seedLo, seedHi, index)` | Tohumlu dizinin `index`. sayısı, [0,1) |
| `yc_version()` | 0x000100 |

`snake*` / `ai*`: `[x0,y0,x1,y1,...]` i32 dizisi, baş ilk hücre. `r1`, `r2` in [0,1): JS'teki iki `Math.random()` çağrısının yerine (r1: dalgın hamle kararı, r2: seçim/eşitlik bozma). Yön sırası JS `DIRS4` ile aynı.

## JS'ten çağırma (WebAssembly.instantiate)

Electron renderer'da (CSP `script-src 'self' 'wasm-unsafe-eval'` gerekebilir, yalnız gerçekten kullanılınca eklenecek):

```js
const { instance } = await WebAssembly.instantiate(
  await (await fetch('core/yilan_core.wasm')).arrayBuffer(), {});
const ex = instance.exports;

function yaz(hucreler) {                      // [{x,y},...] -> çekirdek belleği
  const bayt = hucreler.length * 8, ptr = ex.yc_alloc(bayt);
  const v = new Int32Array(ex.memory.buffer);  // alloc sonrası buffer'ı tazele
  hucreler.forEach((c, i) => { v[ptr / 4 + 2 * i] = c.x; v[ptr / 4 + 2 * i + 1] = c.y; });
  return { ptr, bayt };
}

const DIRS4 = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
function aiYon(snake, ai, aiDir, nextDir, wins) {
  const s = yaz(snake), a = yaz(ai);
  const i = ex.yc_tron_choose(COLS, ROWS, s.ptr, snake.length, a.ptr, ai.length,
      aiDir.x, aiDir.y, nextDir.x, nextDir.y, wins, Math.random(), Math.random());
  ex.yc_free(s.ptr, s.bayt); ex.yc_free(a.ptr, a.bayt);
  return i < 0 ? aiDir : DIRS4[i];            // -1: geçersiz girdi -> JS yedeğine/eski yöne dön
}
```

Node'da aynısı: `core/test/wasm-yukle.js` (dosyadan `WebAssembly.Module`).

## Python

`tools/denge-bot/kosu.py` aynı işlevleri `ctypes` ile yerel kütüphaneden çağırır (`python3 -I tools/denge-bot/kosu.py --kosu 200 --tohum 1`).

## Not

`core/test/tron-ref.js`, `game.js` mantığının elle kopyasıdır; `game.js` Tron YZ'si değişirse hem referans hem Rust güncellenmeli (uyum testi farkı yakalar).
