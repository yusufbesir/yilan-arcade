// Ayarlar, müzik, başarımlar ve ilk 5 listesi duman testi.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html'));
  const res = await page.evaluate(() => {
    const out = {};
    SnakeGame.openSettings();
    out.panelOpen = document.getElementById('settingsPanel').classList.contains('active');
    SnakeGame.setSetting('speed', 1.5);
    out.speedSaved = JSON.parse(localStorage.getItem('twilightSettings')).speed === 1.5;
    SnakeGame.setSetting('reduced', true);
    out.reducedClass = document.documentElement.classList.contains('reduced');
    SnakeGame.setSetting('reduced', false);
    SnakeGame.closeSettings();
    SnakeGame.toggleMusic();
    out.musicOff = SnakeGame.getSettings().music === false;
    SnakeGame.toggleMusic();
    out.achCount0 = document.getElementById('achCount').textContent;
    SnakeGame.startClassic();
    const D = SnakeGame._debug;
    D.get().state.score = 120;
    SnakeGame._ach.check('eat');
    const u = SnakeGame._ach.unlocked();
    out.ach = !!(u.ilkyem && u.klasik50 && u.klasik100);
    out.toast = document.getElementById('toast').classList.contains('show');
    out.achCount = document.getElementById('achCount').textContent;
    // ölüm: ilk 5 listesi
    D.get().state.score = 7;
    SnakeGame._debug.get().snake.length = 1;
    return out;
  });
  // Oyunu bitirip ilk 5 listesine bak
  const top = await page.evaluate(() => {
    const D = SnakeGame._debug;
    const g = D.get();
    for (let i = 0; i < 400 && !g.state.over; i++) { SnakeGame.input(-1, 0); D.tick(); SnakeGame.input(1, 0); D.tick(); }
    const items = [...document.querySelectorAll('#topList li')].map(l => l.textContent);
    const saved = JSON.parse(localStorage.getItem('pixelSnakeArcade'));
    return { over: g.state.over, items, savedTop: !!(saved.records.top && saved.records.top.classic), savedAch: !!(saved.unlocked && saved.unlocked.ilkyem) };
  });
  await page.evaluate(() => { SnakeGame.openAchievements(); });
  const achCards = await page.evaluate(() => ({ cards: document.querySelectorAll('#achList .ach').length, on: document.querySelectorAll('#achList .ach.on').length }));
  console.log(JSON.stringify({ ...res, ...top, ...achCards }), 'hatalar:', errors.length, errors.join(' | '));
  await browser.close();
  const ok = !errors.length && res.panelOpen && res.speedSaved && res.reducedClass && res.musicOff && res.ach && res.toast && top.over && top.items.length >= 1 && top.savedTop && top.savedAch && achCards.cards === 14 && achCards.on >= 3;
  if (!ok) { console.error('BAŞARISIZ'); process.exit(1); }
  console.log('GEÇTİ');
})();
