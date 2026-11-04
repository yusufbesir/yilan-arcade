// Klavye: menüde P/Esc hata vermez, odaktaki düğmede Boşluk tıklar, Market sekmeleri Tab ile gezilir, panel açıkken M menüye atmaz
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
  // 1) Oyun başlamadan P ve Escape
  await page.keyboard.press('p'); await page.keyboard.press('Escape'); await page.keyboard.press('p');
  assert.deepStrictEqual(errors, [], 'menüde P/Esc hata verdi: ' + errors);
  // 2) Odaktaki SES düğmesinde Boşluk düğmeyi tıklar
  const once = await page.textContent('#soundBtn');
  await page.focus('#soundBtn'); await page.keyboard.press(' ');
  const sonra = await page.textContent('#soundBtn');
  assert.notStrictEqual(once, sonra, 'Boşluk SES düğmesini tıklamadı');
  // 3) Market: sekmeler odaklanabilir, panel açıkken M panelden çıkarmaz
  await page.evaluate(() => SnakeGame.openMarket());
  const tab = await page.evaluate(() => document.getElementById('mkSekTema').tabIndex);
  assert.strictEqual(tab, 0, 'Temalar sekmesi odaklanamıyor');
  await page.keyboard.press('m');
  assert.ok(await page.evaluate(() => document.getElementById('marketPanel').classList.contains('active')), 'M paneli kapattı/atladı');
  await page.keyboard.press('Escape');
  assert.ok(!(await page.evaluate(() => document.getElementById('marketPanel').classList.contains('active'))), 'Escape paneli kapatmadı');
  assert.deepStrictEqual(errors, [], 'konsol hatası: ' + errors);
  await browser.close();
  console.log('klavye.test.js tamam');
})().catch(e => { console.error('klavye.test.js BAŞARISIZ', e.message); process.exit(1); });
