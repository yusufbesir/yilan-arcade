// Survivor duman testi: otomatik ateş, XP, seviye atlama ve yükseltme seçimi.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html'));
  await page.evaluate(() => SnakeGame.startSurvivor());
  const res = await page.evaluate(() => {
    const D = SnakeGame._debug, out = { shots: false, gems: false, leveled: false, picked: false };
    D.godMode();
    for (let i = 0; i < 900; i++) {
      D.godMode();
      D.tick();
      const g = D.get();
      if (g.playerShots.length) out.shots = true;
      if (g.gems.length) out.gems = true;
      if (g.sv.choosing) {
        out.leveled = true;
        const lvl = g.sv.level;
        document.getElementById('gameCanvas').dispatchEvent(new PointerEvent('pointerdown', { clientX: document.getElementById('gameCanvas').getBoundingClientRect().left + 10, clientY: document.getElementById('gameCanvas').getBoundingClientRect().top + document.getElementById('gameCanvas').getBoundingClientRect().height * 0.5, bubbles: true }));
        if (!D.get().sv.choosing) out.picked = true;
      }
      if (g.state.over) break;
      if (i % 12 === 0) { const d = [[0,1],[-1,0],[0,-1],[1,0]][(i / 12 | 0) % 4]; SnakeGame.input(d[0], d[1]); }
    }
    return out;
  });
  console.log(JSON.stringify(res), 'hatalar:', errors.length);
  await browser.close();
  if (errors.length || !res.shots || !res.gems || !res.leveled || !res.picked) { console.error('BAŞARISIZ', errors); process.exit(1); }
  console.log('GEÇTİ');
})();
