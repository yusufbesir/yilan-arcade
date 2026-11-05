// Sprite parçacıklar (Kenney CC0): açıkken parçacıklara sprite atanır, kapalıyken düz daire kalır
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  await page.waitForTimeout(500);
  assert.ok(await page.evaluate(() => Parcacik.hazir()), 'atlas yüklenmedi');
  await page.click('[data-act=startClassic]');
  await page.waitForTimeout(200);
  const acik = await page.evaluate(() => { const f = SnakeGame._debug.fx(); f.burst(10, 10, '#ffcc00', 12, 1); SnakeGame._debug.draw(); return f.particles.filter(p => p.s !== undefined).length; });
  console.log('sprite parçacık sayısı (açık):', acik);
  assert.ok(acik > 0, 'sprite atanmadı');
  assert.deepStrictEqual(errors, [], 'sayfa hatası: ' + errors.join('|'));
  await browser.close();
  console.log('parcacik testi geçti');
})().catch(e => { console.error(e); process.exit(1); });
