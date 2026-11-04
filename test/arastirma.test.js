// Tur 5: Kaos çürük yem, hız kademesi 1-10, Günlük "dünkü skoru geç".
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const url = 'file://' + path.resolve(__dirname, '../src/index.html') + '?test=1';
  // Dünkü skor kaydı
  const d = new Date(); d.setDate(d.getDate() - 1);
  const dun = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  await page.goto(url);
  await page.evaluate((dun) => localStorage.setItem('pixelSnakeArcade', JSON.stringify({ records: { classic: 0, daily: 7, dailyDate: dun, top: {} }, progress: { unlocked: 1, stars: {} }, unlocked: {} })), dun);
  await page.goto(url);
  await page.waitForTimeout(200);
  const out = await page.evaluate(() => {
    const D = SnakeGame._debug, o = {};
    const S = () => D.get().state, X = () => D.extra();
    // 7) Hız kademesi
    SnakeGame.startClassic();
    o.hudHiz = document.getElementById('hudLevelLabel').textContent === 'HIZ' && document.getElementById('hudLevel').textContent === '1';
    D.tick(); o.lv1 = S().speedLv === 1 && S().speed === 140;
    S().score = 5; D.tick(); for (let i = 0; i < 30; i++) D.tick();
    o.lv2 = S().speedLv === 2 && S().speed === 126 && document.getElementById('hudLevel').textContent === '2';
    SnakeGame.showMenu(); SnakeGame.startClassic();
    S().score = 50; D.tick(); o.lv10 = S().speedLv === 10 && S().speed === 54;
    S().score = 999; D.tick(); o.cap = S().speedLv === 10 && S().speed === 54;
    // geometrik: kademeler arası oran 0.9 (±yuvarlama)
    { const ms = []; for (let l = 1; l <= 10; l++) ms.push(Math.round(140 * Math.pow(0.9, l - 1))); o.geo = ms[2] === 113 && ms.every((v, i) => i === 0 || Math.abs(v / ms[i - 1] - 0.9) < 0.01); }
    // 5) Çürük yem yalnız Kaos'ta
    SnakeGame.showMenu(); SnakeGame.startClassic();
    SnakeGame.showMenu(); SnakeGame.startChaos();
    D.grow(3); const n0 = D.get().snake.length; // 6
    const h = D.get().snake[0];
    const f = X().food; f.x = h.x + 1; f.y = h.y; f.type = 'curuk';
    const sc0 = S().score;
    D.tick();
    o.kisaldi = D.get().snake.length === n0 - 2 && S().score === sc0 && X().food.type !== undefined && !(X().food.x === h.x + 1 && X().food.y === h.y && X().food.type === 'curuk');
    // en az 3 kalır
    D.get().snake.length = 3; const h2 = D.get().snake[0]; X().food.x = h2.x + 1; X().food.y = h2.y; X().food.type = 'curuk'; D.tick();
    o.min3 = D.get().snake.length === 3;
    // Kaos'ta yeterince denemede çürük çıkar, Klasik'te çıkmaz
    let seen = 0; for (let i = 0; i < 400; i++) { const hh = D.get().snake[0]; const ff = X().food; ff.x = hh.x + 1; ff.y = hh.y; ff.type = 'normal'; D.tick(); if (X().food.type === 'curuk') seen++; if (S().over) break; }
    o.kaosCuruk = seen > 0;
    // Çürük yem 60 tik sonra normal yeme döner (kilitlenme yok)
    SnakeGame.showMenu(); SnakeGame.startChaos();
    { const f0 = X().food; f0.type = 'curuk'; f0.age = 0; f0.x = 0; f0.y = 0; D.tick(); const a1 = X().food.type === 'curuk' && X().food.age === 1;
      X().food.age = 59; D.tick(); o.curukZaman = a1 && !S().over && X().food.type === 'normal'; }
    // 8) Günlük: dünkü skor 7
    SnakeGame.showMenu(); SnakeGame.startDaily();
    o.dunHud = document.getElementById('hudTargetLabel').textContent === 'DÜN' && document.getElementById('hudTarget').textContent === '7' && X().records.dailyPrev && X().records.dailyPrev.s === 7;
    S().score = 7; const h3 = D.get().snake[0]; X().food.x = h3.x + 1; X().food.y = h3.y; X().food.type = 'normal'; D.tick();
    o.pacer = S().pacerDone === true && S().score >= 8;
    return o;
  });
  // Klasik'te çürük yem hiç çıkmamalı
  const noRot = await page.evaluate(() => {
    SnakeGame.showMenu(); SnakeGame.startClassic();
    const D = SnakeGame._debug, X = () => D.extra();
    let rot = 0;
    for (let i = 0; i < 300; i++) { const h = D.get().snake[0]; const f = X().food; f.x = h.x + 1; f.y = h.y; f.type = 'normal'; D.tick(); if (X().food.type === 'curuk') rot++; if (D.get().state.over) break; }
    return rot === 0;
  });
  await browser.close();
  const all = { ...out, noRot, errors };
  const ok = Object.entries(all).every(([k, v]) => k === 'errors' ? v.length === 0 : v === true);
  console.log(JSON.stringify(all));
  console.log(ok ? 'ARASTIRMA TEST: GECTI' : 'ARASTIRMA TEST: KALDI');
  process.exit(ok ? 0 : 1);
})();
