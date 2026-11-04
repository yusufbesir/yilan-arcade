// Gamepad: sahte navigator.getGamepads ile d-pad/çubuk yön, A ateş, Start duraklat, menüde etkisiz, kenar tetikleme, ölü bölge, yuva sırası.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { window.__pads = []; navigator.getGamepads = () => window.__pads; });
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  await page.waitForTimeout(300);
  const out = await page.evaluate(() => new Promise(resolve => {
    const o = {};
    const D = SnakeGame._debug;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const mkPad = () => ({ axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false })) });
    const pad = mkPad();
    const press = (i, v = true) => { pad.buttons[i].pressed = v; };
    const stick = (x, y) => { pad.axes = [x, y]; };
    const nd = () => ({ x: D.get().nextDir.x, y: D.get().nextDir.y });
    const eq = (a, b) => a.x === b.x && a.y === b.y;
    const key = k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    (async () => {
      window.__pads = [pad];
      // Menüde: d-pad yukarı ve Start oyun başlatmamalı / duraklatmamalı
      press(12); press(9);
      await wait(150);
      o.menuStays = document.body.classList.contains('menu-acik') && D.get().state.running === false && D.get().state.paused === false;
      o.padInfo = document.getElementById('padInfo').textContent === '1 KOL BAĞLI';
      press(12, false); press(9, false);
      await wait(150);
      // Klasik başlat: yılan sağa gider; d-pad yukarı → nextDir {0,-1}
      // Oyun döngüsü kendi kendine ilerlemesin (kol anketi zaten kurulu); adımlar D.tick() ile atılır
      window.setInterval = () => 0;
      SnakeGame.startClassic();
      o.startDir = eq(nd(), { x: 1, y: 0 });
      press(12);
      await wait(150);
      o.dpadUp = eq(nd(), { x: 0, y: -1 });
      // Kenar tetikleme: yukarı basılı dururken klavye ile sola dön; pad yeniden yukarı göndermemeli
      D.tick(); // dir = yukarı
      key('ArrowLeft');
      o.keyLeft = eq(nd(), { x: -1, y: 0 });
      await wait(200);
      o.noRepeat = eq(nd(), { x: -1, y: 0 });
      // Bırak-bas → tekrar tetiklenir
      D.tick(); // dir = sol
      press(12, false); await wait(150); press(12); await wait(150);
      o.retrigger = eq(nd(), { x: 0, y: -1 });
      press(12, false); D.tick(); // dir = yukarı
      // Çubuk sola → {-1,0}
      stick(-1, 0);
      await wait(150);
      o.stickLeft = eq(nd(), { x: -1, y: 0 });
      stick(0, 0); await wait(150); D.tick(); // dir = sol
      // Ölü bölge: zayıf itiş yön değiştirmemeli
      stick(0, -0.3);
      await wait(150);
      o.deadzone = eq(nd(), { x: -1, y: 0 });
      // Çapraz itiş: baskın eksen (yukarı) sayılır, zayıf eksen (sol) ikinci yön olarak gönderilmez
      stick(-0.6, -1);
      await wait(150);
      o.diagonal = eq(nd(), { x: 0, y: -1 });
      stick(0, 0); await wait(150);
      // A → ateş çağrısı hata vermez (Klasik'te mermi yok, sadece çökmemeli)
      press(0); await wait(150); press(0, false);
      // Start → duraklat; basılı tutmak geri açmamalı; bırak-bas → devam
      press(9);
      await wait(150);
      o.paused = D.get().state.paused === true && document.getElementById('pauseOverlay').classList.contains('active');
      await wait(200);
      o.pauseHold = D.get().state.paused === true;
      press(9, false); await wait(150); press(9); await wait(150);
      o.resumed = D.get().state.paused === false;
      press(9, false); await wait(150);
      // Duraklatılmışken yön tuşu yön değiştirmemeli
      press(9); await wait(150); press(9, false);
      const before = nd();
      press(13); await wait(150); press(13, false);
      o.pausedNoSteer = eq(nd(), before);
      SnakeGame.togglePause();
      await wait(150);
      // Yuva sırası: 1. yuva boş, 2. yuvadaki kol tek oyuncuda P1'i yine yönetir, sayaç 1 KOL
      const pad2 = mkPad();
      window.__pads = [null, pad2];
      await wait(150);
      o.slotInfo = document.getElementById('padInfo').textContent === '1 KOL BAĞLI';
      D.tick();
      const cur = D.get().dir;
      const horiz = cur.y !== 0; // yılan dikey gidiyorsa sağa, yatay gidiyorsa aşağı dön
      const want = horiz ? { x: 1, y: 0 } : { x: 0, y: 1 };
      pad2.buttons[horiz ? 15 : 13].pressed = true;
      await wait(150);
      o.slotSteer = eq(nd(), want);
      // Kol çıkıp geri gelince hâlâ basılı tuş yeniden tetiklenir (boş yuvanın eski durumu silinir)
      SnakeGame.setSetting('ek', { donus: false }); // bu bölüm 'son tuş kazanır' davranışını sınar (tampon kapalı)
      D.tick(); // dir = want
      key(horiz ? 'ArrowUp' : 'ArrowLeft'); // want'a dik, geçerli
      const perp = nd();
      o.perpSet = !eq(perp, want);
      window.__pads = []; await wait(150);
      o.noPad = document.getElementById('padInfo').textContent === 'BAĞLI DEĞİL';
      window.__pads = [null, pad2]; await wait(150);
      o.reconnect = eq(nd(), want);
      SnakeGame.showMenu();
      resolve(o);
    })();
  }));
  await browser.close();
  const all = { ...out, errors };
  const bad = Object.entries(all).filter(([k, v]) => k === 'errors' ? v.length : v !== true);
  console.log(JSON.stringify(all));
  if (bad.length) { console.error('GAMEPAD TEST FAILED:', bad.map(([k]) => k).join(', ')); process.exit(1); }
  console.log('gamepad.test.js OK');
})().catch(e => { console.error(e); process.exit(1); });
