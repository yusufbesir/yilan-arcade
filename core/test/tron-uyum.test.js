'use strict';
// Golden/uyum testi: JS referansı (tron-ref.js) ile Rust/wasm aynı durumda aynı yönü vermeli.
// Çalıştırma: node --test core/test/tron-uyum.test.js   (önce: cd core && cargo build --release --target wasm32-unknown-unknown)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { yukle, WASM } = require('./wasm-yukle');
const { DIRS4, aiChooseDirRef, mulberry32, durumUret } = require('./tron-ref');

const COLS = 48, ROWS = 32; // game.js: 960/20, 640/20
const hazir = fs.existsSync(WASM);
const opts = hazir ? {} : { skip: 'wasm yok: cd core && cargo build --release --target wasm32-unknown-unknown' };

test('wasm yükleniyor ve sürüm dönüyor', opts, () => {
    const w = yukle();
    assert.strictEqual(w.ex.yc_version(), 0x200);
});

test('2000 rastgele durumda JS referansı = wasm yönü', opts, () => {
    const w = yukle();
    const rnd = mulberry32(20261104);
    let dumbSayi = 0, tekSecenek = 0;
    for (let i = 0; i < 2000; i++) {
        const d = durumUret(rnd, COLS, ROWS);
        // r1'i %30 durumda küçük yap: dalgın yolu da kapsansın
        const r1 = rnd() < 0.3 ? rnd() * 0.02 : rnd();
        const r2 = rnd();
        const seq = [r1, r2]; let k = 0;
        const ref = aiChooseDirRef({ ...d, rand: () => seq[k++] });
        const refIdx = DIRS4.findIndex(x => x.x === ref.x && x.y === ref.y);
        const got = w.tronChoose(d, r1, r2);
        if (r1 < Math.max(0.02, 0.2 - d.wins * 0.03)) dumbSayi++;
        assert.strictEqual(got, refIdx, `durum #${i} ayrıştı: wasm=${got} js=${refIdx}`);
    }
    assert.ok(dumbSayi > 100, 'dalgın dal yeterince denenmedi: ' + dumbSayi);
});

test('flood-fill sayısı JS ile aynı (kapalı odalar, sınır COLS*ROWS)', opts, () => {
    const w = yukle();
    assert.strictEqual(w.floodCount(COLS, ROWS, [], 0, 0), COLS * ROWS);
    const duvar = [];
    for (let x = 9; x <= 13; x++) { duvar.push({ x, y: 9 }, { x, y: 13 }); }
    for (let y = 10; y <= 12; y++) { duvar.push({ x: 9, y }, { x: 13, y }); }
    assert.strictEqual(w.floodCount(COLS, ROWS, duvar, 11, 11), 9);
});

test('girdi doğrulama: geçersiz r ve boş iz -1 döner, çökmez', opts, () => {
    const w = yukle();
    const rnd = mulberry32(1);
    const d = durumUret(rnd, COLS, ROWS);
    assert.strictEqual(w.tronChoose(d, 1.0, 0.5), -1);
    assert.strictEqual(w.tronChoose(d, 0.5, -0.1), -1);
    assert.strictEqual(w.tronChoose({ ...d, snake: [] }, 0.5, 0.5), -1);
});

test('tohumlu RNG: aynı tohum aynı sayı, [0,1) aralığı', opts, () => {
    const w = yukle();
    const a = w.ex.yc_rng_f64(7, 0, 5), b = w.ex.yc_rng_f64(7, 0, 5), c = w.ex.yc_rng_f64(8, 0, 5);
    assert.strictEqual(a, b);
    assert.notStrictEqual(a, c);
    assert.ok(a >= 0 && a < 1);
});
