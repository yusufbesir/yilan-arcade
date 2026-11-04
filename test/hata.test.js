// Hata düzeltmeleri: Klasik/Günlük afişi çizilir; duraklama güç sürelerini dondurur.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  await page.waitForTimeout(300);
  const out = await page.evaluate(async () => {
    const o = {}; const D = SnakeGame._debug;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    // 1) afiş: classic ve daily için çizilir
    for (const [k, fn] of [['classic', 'startClassic'], ['daily', 'startDaily']]) {
      SnakeGame[fn]();
      const ctx = document.getElementById('gameCanvas').getContext('2d');
      const orig = ctx.fillText; const seen = [];
      ctx.fillText = function (t) { seen.push(String(t)); return orig.apply(this, arguments); };
      const b = D.extra().banner; b.text = 'HIZ 9'; b.until = performance.now() + 5000;
      await sleep(250);
      ctx.fillText = orig;
      o[k + 'Banner'] = seen.includes('HIZ 9');
    }
    // 2) duraklama güç süresini dondurur: devam edince kalan süre ~tam (12000) yeniden kurulur
    SnakeGame.startClassic();
    D.power('shield');
    const delays = []; const st = window.setTimeout;
    window.setTimeout = function (fn, ms) { delays.push(ms); return st.apply(this, arguments); };
    SnakeGame.togglePause();
    await sleep(1500);
    SnakeGame.togglePause();
    window.setTimeout = st;
    const d = delays.find(x => x > 5000);
    o.shieldLeftKept = d > 10800 && d <= 12000;
    o.shieldStillOn = D.powers().shield === true;
    return o;
  });
  console.log(JSON.stringify(out));
  const ok = out.classicBanner && out.dailyBanner && out.shieldLeftKept && out.shieldStillOn && errors.length === 0;
  if (errors.length) console.log(errors);
  await browser.close();
  if (!ok) { console.log('FAIL'); process.exit(1); }
  console.log('hata.test OK');
})();
