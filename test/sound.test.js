// Ses düğmesi testi: açma/kapama ve tercihin kalıcı olması.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html'));
  await page.evaluate(() => SnakeGame.toggleSound());
  const off = await page.textContent('#soundBtn');
  await page.reload();
  const kept = await page.textContent('#soundBtn');
  await page.evaluate(() => SnakeGame.toggleSound());
  const on = await page.textContent('#soundBtn');
  await browser.close();
  const ok = off.includes('KAPALI') && kept.includes('KAPALI') && on.includes('AÇIK') && !errors.length;
  console.log(off, '|', kept, '|', on, 'hatalar:', errors.length);
  if (!ok) { console.error('BAŞARISIZ'); process.exit(1); }
  console.log('GEÇTİ');
})();
