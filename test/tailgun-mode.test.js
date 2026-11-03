// Kuyruk Silahı duman testi: düşman çıkmalı, ateş kuyruğu kısaltmalı, vurunca düşman ölmeli.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html'));
  await page.evaluate(() => SnakeGame.startTailgun());
  const res = await page.evaluate(() => {
    const D = SnakeGame._debug, out = { enemies: 0, fired: false, shortened: false, scoreUp: false };
    D.godMode();
    D.grow(12);
    for (let i = 0; i < 400; i++) {
      D.godMode();
      D.tick();
      const g = D.get();
      out.enemies = Math.max(out.enemies, g.enemies.length);
      if (i % 4 === 0) {
        const before = g.snake.length;
        SnakeGame.fire();
        const g2 = D.get();
        if (g2.playerShots.length) out.fired = true;
        if (g2.snake.length < before) out.shortened = true;
      }
      if (g.state.score >= 2) out.scoreUp = true;
      if (g.state.over) break;
      if (i % 15 === 0) { const d = [[0,1],[-1,0],[0,-1],[1,0]][(i / 15 | 0) % 4]; SnakeGame.input(d[0], d[1]); }
    }
    // belirli kill testi: kafanın önüne düşman koy, ateş et
    const g = D.get();
    const h = g.snake[0], d = { x: 1, y: 0 };
    g.state.score = 0;
    g.enemies.length = 0;
    g.enemies.push({ x: h.x + 4, y: h.y, hp: 1 });
    SnakeGame.fire();
    for (let i = 0; i < 3; i++) D.tick();
    out.killed = D.get().state.score >= 2 || D.get().enemies.every(e => e.x !== h.x + 4);
    return out;
  });
  console.log(JSON.stringify(res), 'hatalar:', errors.length);
  await browser.close();
  if (errors.length || !res.enemies || !res.fired || !res.shortened || !res.killed) { console.error('BAŞARISIZ', errors); process.exit(1); }
  console.log('GEÇTİ');
})();
