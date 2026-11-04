// Ses: odak kaybında bağlam askıya alınır, dönüşte devam eder; müzik aç/kapa hata vermez.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  await page.waitForTimeout(200);
  const o = await page.evaluate(async () => {
    const o = {};
    let ac = null;
    const Orig = window.AudioContext;
    window.AudioContext = function () { ac = new Orig(); return ac; };
    SnakeGame.startClassic();
    await new Promise(r => setTimeout(r, 400));
    o.created = !!ac;
    if (!ac) return o;
    window.dispatchEvent(new Event('blur'));
    await new Promise(r => setTimeout(r, 200));
    o.suspended = ac.state === 'suspended';
    window.dispatchEvent(new Event('focus'));
    await new Promise(r => setTimeout(r, 200));
    o.resumed = ac.state === 'running';
    SnakeGame.toggleMusic(); SnakeGame.toggleMusic();
    return o;
  });
  await browser.close();
  console.log(JSON.stringify(o), 'hatalar:', errors.length);
  if (!o.created || !o.suspended || !o.resumed || errors.length) { console.error('BAŞARISIZ'); process.exit(1); }
  console.log('GEÇTİ');
})();
