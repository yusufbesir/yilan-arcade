// Full HD: 1920x1080'de sayfa taşmaz, tuval 1100 px sınırını aşar; tam ekran sınıfıyla daha da büyür ve yine taşmaz
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  await page.waitForTimeout(300);
  await page.evaluate(() => SnakeGame.startClassic());
  const olc = () => page.evaluate(() => { const c = document.getElementById('gameCanvas'), r = c.getBoundingClientRect(), de = document.documentElement; return { w: r.width, h: r.height, tasma: de.scrollWidth > de.clientWidth || de.scrollHeight > de.clientHeight, px: c.width }; });
  await page.waitForTimeout(300);
  const a = await olc();
  assert.ok(a.w > 1200 && !a.tasma, 'normal: ' + JSON.stringify(a));
  await page.evaluate(() => { document.body.classList.add('tam-ekran'); window.dispatchEvent(new Event('resize')); });
  await page.waitForTimeout(400);
  const b = await olc();
  assert.ok(b.w >= a.w - 1 && b.h <= 1080 && !b.tasma && b.px >= 960, 'tam ekran: ' + JSON.stringify(b));
  assert.deepStrictEqual(errors, [], 'hata: ' + errors);
  console.log('FULLHD TEST: GECTI', JSON.stringify({ a, b }));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
