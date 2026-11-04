// Ek özellikler (geri alınabilir): her biri Ayarlar'dan kapanır; kapalıyken eski davranış
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  await page.waitForTimeout(300);
  const r = {};
  // Ayarlar: ek satırları çizilir, anahtar kapanır/açılır ve saklanır
  await page.evaluate(() => SnakeGame.openSettings());
  r.satir = await page.evaluate(() => document.querySelectorAll('#ekRows .toggle').length);
  assert.ok(r.satir >= 1, 'ek satırları çizilmedi');
  await page.click('#ek_donus');
  r.kapali = await page.evaluate(() => SnakeGame.getSettings().ek.donus === false && document.getElementById('ek_donus').textContent === 'KAPALI');
  await page.click('#ek_donus');
  r.acik = await page.evaluate(() => SnakeGame.getSettings().ek.donus !== false);
  await page.evaluate(() => SnakeGame.closeSettings());
  // Dönüş tamponu: tek tikte iki tuş -> ikisi de uygulanır
  await page.click('[data-act=startClassic]');
  await page.waitForTimeout(200);
  const tampon = await page.evaluate(() => {
    const d = SnakeGame._debug, st = d.get().state;
    const key = k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    key('ArrowUp'); key('ArrowLeft');
    d.tick(); const d1 = { ...d.get().dir };
    d.tick(); const d2 = { ...d.get().dir };
    return { d1, d2 };
  });
  assert.deepStrictEqual(tampon.d1, { x: 0, y: -1 }, 'ilk dönüş yukarı olmalı');
  assert.deepStrictEqual(tampon.d2, { x: -1, y: 0 }, 'ikinci dönüş (tampon) sola uygulanmalı');
  assert.deepStrictEqual(errors, [], 'hata: ' + errors);
  console.log('EK TEST: GECTI', JSON.stringify(r));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
