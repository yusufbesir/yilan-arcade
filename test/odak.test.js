// Odak kaybı: pencere arka plana düşünce (blur / visibilitychange hidden) çalışan oyun duraklar, geri gelince kendiliğinden devam etmez.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  await page.waitForTimeout(300);
  const out = await page.evaluate(() => {
    const o = {};
    const D = SnakeGame._debug;
    const S = () => D.get().state;
    const overlay = () => document.getElementById('pauseOverlay').classList.contains('active');
    let hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    const hide = () => { hidden = true; document.dispatchEvent(new Event('visibilitychange')); };
    const show = () => { hidden = false; document.dispatchEvent(new Event('visibilitychange')); };
    // Menüde: oyun çalışmıyor, dokunma
    hide(); show();
    o.menuUntouched = S().paused === false && !overlay();
    // Klasik: sekme gizlenince duraklar
    SnakeGame.startClassic();
    hide();
    o.hiddenPauses = S().paused === true && overlay();
    // Geri gelince kendiliğinden devam etmez
    show();
    o.noAutoResume = S().paused === true && overlay();
    // Zaten duraklıysa ikinci blur dokunmaz (toggle'a dönüşmemeli)
    window.dispatchEvent(new Event('blur'));
    o.stillPaused = S().paused === true && overlay();
    // Kullanıcı P ile devam eder
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
    o.userResumes = S().paused === false && !overlay();
    // Pencere blur da duraklatır
    window.dispatchEvent(new Event('blur'));
    o.blurPauses = S().paused === true;
    SnakeGame.togglePause();
    // Oyun bittiyse dokunma
    S().over = true;
    hide();
    o.overUntouched = S().paused === false && !overlay();
    S().over = false;
    // Tron 2P dahil
    SnakeGame.showMenu();
    SnakeGame.setSetting('tron2p', true);
    SnakeGame.startTron();
    o.tron2p = D.extra().tron.twoP === true;
    hide();
    o.tronPauses = S().paused === true && overlay();
    show();
    o.tronNoResume = S().paused === true;
    SnakeGame.setSetting('tron2p', false);
    // Duraklı oyundan menüye dönüp yeni oyun açılınca temiz başlar; menüde odak kaybı dokunmaz
    SnakeGame.showMenu();
    o.menuStopped = S().running === false;
    hide(); show();
    SnakeGame.startClassic();
    o.freshStart = S().paused === false && !overlay() && S().running === true;
    SnakeGame.showMenu();
    return o;
  });
  await browser.close();
  const all = { ...out, errors };
  const ok = Object.entries(all).every(([k, v]) => k === 'errors' ? v.length === 0 : v === true);
  console.log(JSON.stringify(all, null, 1));
  console.log(ok ? 'ODAK TEST: GECTI' : 'ODAK TEST: KALDI');
  process.exit(ok ? 0 : 1);
})();
