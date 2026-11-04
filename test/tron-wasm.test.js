// Rust/wasm Tron bağı: (1) Node'da sarmalayıcı JS yedeğiyle aynı kararı verir, (2) gerçek sayfada wasm yüklenir,
// CSP hatası olmaz, Tron oyunu wasm ile çalışır; ?js=1 ile wasm kapanır ve JS yedeği çalışır.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const T = require('../src/core/tron.js');
const W = require('../src/core/tron-wasm.js');
const { mulberry32, durumUret } = require('../core/test/tron-ref.js');

// (1) Node
const ex = new WebAssembly.Instance(new WebAssembly.Module(Buffer.from(require('../src/core/yilan_core.wasm.js'), 'base64')), {}).exports;
const w = W.kur(ex);
assert(w && w.hazir, 'wasm kurulamadı (sürüm uyuşmuyor olabilir)');
const rnd = mulberry32(2026);
let n = 0;
for (let i = 0; i < 500; i++) {
  const d = durumUret(rnd, 48, 32);
  const r1 = rnd(), r2 = rnd();
  const q = [r1, r2]; let k = 0;
  const js = T.aiChooseDir({ ...d, rand: () => q[k++ % 2] });
  const rs = w.aiChooseDir(d, r1, r2);
  assert(rs, 'wasm null döndü: ' + JSON.stringify(d.aiDir));
  assert.deepStrictEqual(rs, js, 'wasm ile JS farklı yön verdi, durum ' + i);
  n++;
}
// geçersiz girdi -> null (JS yedeğine düşülür)
assert.strictEqual(w.aiChooseDir({ COLS: 48, ROWS: 32, snake: [], ai: [], aiDir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 }, wins: 0 }, 0.5, 0.5), null);

// (2) Sayfa
(async () => {
  const browser = await chromium.launch();
  const url = 'file://' + path.resolve(__dirname, '../src/index.html');
  const sonuc = {};
  for (const [ad, q] of [['wasm', '?test=1'], ['js', '?test=1&js=1']]) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url + q);
    await page.waitForTimeout(800);
    sonuc[ad] = await page.evaluate(() => {
      const yc = window.YilanCore;
      const dir = yc.wasm ? yc.wasm.aiChooseDir({ COLS: 48, ROWS: 32, snake: [{ x: 5, y: 5 }], ai: [{ x: 40, y: 20 }], aiDir: { x: -1, y: 0 }, nextDir: { x: 1, y: 0 }, wins: 0 }, 0.9, 0.5) : null;
      return { wasm: !!yc.wasm, dir };
    });
    sonuc[ad].errors = errors;
    await page.close();
  }
  await browser.close();
  assert.strictEqual(sonuc.wasm.wasm, true, 'wasm sayfada yüklenmedi: ' + JSON.stringify(sonuc.wasm));
  assert(sonuc.wasm.dir && typeof sonuc.wasm.dir.x === 'number', 'wasm karar vermedi');
  assert.strictEqual(sonuc.js.wasm, false, '?js=1 wasm\'ı kapatmadı');
  assert.deepStrictEqual(sonuc.wasm.errors, [], 'wasm sayfasında hata/CSP: ' + sonuc.wasm.errors);
  assert.deepStrictEqual(sonuc.js.errors, [], 'js sayfasında hata: ' + sonuc.js.errors);
  console.log('tron-wasm OK: ' + n + ' durum, sayfa wasm ' + sonuc.wasm.wasm + ', js yedek ' + !sonuc.js.wasm);
})().catch(e => { console.error(e); process.exit(1); });
