// Yeni modlar duman testi: zaman, portal, tron, kaos, günlük.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  const res = await page.evaluate(() => {
    const D = SnakeGame._debug, out = {};
    const spin = (n, steer) => { for (let i = 0; i < n; i++) { D.godMode(); D.tick(); if (steer && i % 9 === 0) { const d = [[0,1],[-1,0],[0,-1],[1,0]][(i / 9 | 0) % 4]; SnakeGame.input(d[0], d[1]); } if (D.get().state.over) break; } };

    // Zamana karşı: süre azalır ve biter
    SnakeGame.startTimeAttack();
    const t0 = D.get().state.timeLeft;
    spin(20, false);
    out.timeDrops = D.get().state.timeLeft < t0 || D.get().state.over;
    for (let i = 0; i < 1200 && !D.get().state.over; i++) { D.tick(); }
    out.timeEnds = D.get().state.over === true;

    // Portal: portallar ve duvarlar var, ışınlanma çalışır
    SnakeGame.startPortal();
    let x = D.extra();
    out.portals = x.portals.length === 2;
    out.walls = x.obstacles.length > 20;
    const p = x.portals[0];
    const s = D.get().snake;
    // yılanı portalın solundaki hücreye koyup sağa sürmek yerine doğrudan başı portal önüne al
    s[0].x = p.a.x - 1; s[0].y = p.a.y; s[1].x = p.a.x - 2; s[1].y = p.a.y; s[2].x = p.a.x - 3; s[2].y = p.a.y;
    SnakeGame.input(1, 0);
    D.tick();
    const h = D.get().snake[0];
    out.teleported = (h.x === p.b.x && h.y === p.b.y) || D.get().state.over;
    spin(300, true);

    // Tron: tur kazanma ve çarpışmayla bitiş
    SnakeGame.startTron();
    spin(5, false);
    out.tronTrail = D.get().snake.length > 3 && D.extra().tron.ai.length > 3;
    D.tronWin();
    out.tronScore = D.get().state.score === 1 && D.extra().tron.round === 2;
    for (let i = 0; i < 100 && !D.get().state.over; i++) D.tick();
    out.tronEnds = D.get().state.over === true;

    // Kaos: kural tetiklenir
    SnakeGame.startChaos();
    let ruled = false;
    for (let i = 0; i < 400; i++) { D.godMode(); D.tick(); if (D.extra().chaos.rule) ruled = true; if (D.get().state.over) break; if (i % 9 === 0) { const d = [[0,1],[-1,0],[0,-1],[1,0]][(i / 9 | 0) % 4]; SnakeGame.input(d[0], d[1]); } }
    out.chaosRule = ruled;

    // Günlük: aynı tohum iki kez aynı harita
    SnakeGame.startDaily();
    const a = JSON.stringify(D.extra().obstacles) + JSON.stringify(D.extra().food);
    SnakeGame.startDaily();
    const b = JSON.stringify(D.extra().obstacles) + JSON.stringify(D.extra().food);
    out.dailySame = a === b && D.extra().obstacles.length >= 5;
    spin(200, true);
    return out;
  });
  console.log(JSON.stringify(res), 'hatalar:', errors.length);
  await browser.close();
  const bad = Object.entries(res).filter(([, v]) => !v);
  if (errors.length || bad.length) { console.error('BAŞARISIZ', bad, errors); process.exit(1); }
  console.log('GEÇTİ');
})();
