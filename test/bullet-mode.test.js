// Mermi Manyağı modu duman testi: hata vermeden dalga, patron ve lazer üretmeli.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  const seen = { boss: false, laser: false, pattern: false, maxWave: 0, bullets: 0 };
  await page.evaluate(() => SnakeGame.startBullet());
  const res = await page.evaluate(() => {
    const D = SnakeGame._debug, out = { boss: false, laser: false, pattern: false, maxWave: 0, bullets: 0, bossKilled: false };
    D.godMode();
    for (let w = 2; w <= 6; w++) {
      D.jump(w);
      for (let i = 0; i < 200; i++) {
        D.godMode();
        if (i % 9 === 0) SnakeGame.input([[1,0],[0,1],[-1,0],[0,-1]][(i / 9 | 0) % 4][0], [[1,0],[0,1],[-1,0],[0,-1]][(i / 9 | 0) % 4][1]);
        D.tick();
        const g = D.get();
        out.maxWave = Math.max(out.maxWave, g.state.wave);
        out.boss = out.boss || !!g.boss;
        out.laser = out.laser || g.lasers.length > 0;
        out.pattern = out.pattern || g.patterns.length > 0;
        out.bullets = Math.max(out.bullets, g.bullets.length);
        out.patBullets = Math.max(out.patBullets || 0, g.bullets.filter(b => b.color).length);
        if (g.state.over) return Object.assign(out, { over: true });
      }
    }
    return out;
  });
  console.log(JSON.stringify(res), 'hatalar:', errors.length);
  await browser.close();
  const ok = errors.length === 0 && res.boss && res.laser && res.pattern && res.maxWave >= 5 && res.bullets > 0 && res.patBullets > 20;
  if (!ok) { console.error('BAŞARISIZ', errors); process.exit(1); }
  console.log('GEÇTİ');
})();
