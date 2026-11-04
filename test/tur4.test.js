// Tur 4: büyük HUD, renk körü paleti, Tron 2 oyuncu, gamepad eşlemesi, 390 px taşma, seviye kartı tıklama alanı.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // Sahte gamepad: önce boş, test içinde doldurulur
  await page.addInitScript(() => { window.__pads = []; navigator.getGamepads = () => window.__pads; });
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  await page.waitForTimeout(300);
  const out = await page.evaluate(() => {
    const o = {};
    const noScroll = () => document.documentElement.scrollWidth <= innerWidth;
    o.menu390 = noScroll();
    // Ayarlar: büyük HUD + palet
    SnakeGame.setSetting('bigHud', true);
    o.bigHudClass = document.documentElement.classList.contains('buyuk-hud');
    o.bigHudBtn = document.getElementById('setBigHud').textContent === 'AÇIK';
    SnakeGame.setSetting('cb', true);
    o.cbSaved = JSON.parse(localStorage.getItem('twilightSettings')).cb === true;
    o.cbBtn = document.getElementById('setCb').classList.contains('on');
    SnakeGame.setSetting('bigHud', false); SnakeGame.setSetting('cb', false);
    // Tron 2 oyuncu düğmesi
    const btn = document.getElementById('tron2pBtn');
    btn.click();
    o.tron2pOn = SnakeGame.getSettings().tron2p === true && btn.classList.contains('on');
    o.stillMenu = document.body.classList.contains('menu-acik'); // düğme kartı başlatmamalı
    SnakeGame.startTron();
    const D = SnakeGame._debug;
    const T = () => D.extra().tron;
    o.twoP = T().twoP === true;
    o.hudTarget = document.getElementById('hudTarget').textContent === '0 - 0';
    o.game390 = noScroll();
    // P2 ok tuşlarıyla yukarı, P1 WASD ile yukarı
    const key = k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    key('ArrowUp'); key('w');
    o.p2Next = T().p2Next.y === -1;
    const p2Before = T().ai[0].y;
    D.tick();
    o.p2Moved = T().ai[0].y === p2Before - 1 && T().aiDir.y === -1;
    o.p1Moved = D.get().snake[0].y === Math.floor(24 / 2) - 1;
    // P1 duvara çarpar → P2 turu alır, oyun bitmez
    key('a'); // ters yön, yok sayılır
    for (let i = 0; i < 30 && !D.get().state.over; i++) D.tick();
    o.p2Won = T().p2Wins >= 1 && !D.get().state.over;
    // P2 5 tur alınca oyun biter ve rekor yazılmaz
    const recBefore = D.extra().records.tron;
    T().p2Wins = 4;
    key('w');
    for (let i = 0; i < 40 && !D.get().state.over; i++) D.tick();
    o.over = D.get().state.over === true;
    o.noRecord = D.extra().records.tron === recBefore && !(D.extra().records.top.tron || []).some(t => t.d > Date.now() - 5000);
    o.final = document.getElementById('finalScore').textContent === 'P2';
    SnakeGame.showMenu();
    SnakeGame.setSetting('tron2p', false);
    SnakeGame.startTron();
    o.single = T().twoP === false && document.getElementById('hudTargetBox').style.display === 'none';
    // Tek oyuncu rakibi: 200 tikte boş komşusu varken duvara/kuyruğa çarpmaz (oyuncu güvenli sürülür)
    {
      const COLS = 33, ROWS = 24, D4 = [[1,0],[-1,0],[0,1],[0,-1]];
      const blocked = (x, y) => x < 0 || x >= COLS || y < 0 || y >= ROWS || D.get().snake.some(c => c.x === x && c.y === y) || T().ai.some(c => c.x === x && c.y === y);
      let bad = 0, ticks = 0;
      for (let i = 0; i < 200 && !D.get().state.over; i++) {
        const s = D.get().snake, pd = { x: s[0].x - s[1].x, y: s[0].y - s[1].y };
        const safe = D4.filter(([dx, dy]) => !(dx === -pd.x && dy === -pd.y) && !blocked(s[0].x + dx, s[0].y + dy));
        const keep = safe.find(([dx, dy]) => dx === pd.x && dy === pd.y);
        const pick = keep || safe[0];
        if (pick) SnakeGame.input(pick[0], pick[1]);
        const pNext = pick ? { x: s[0].x + pick[0], y: s[0].y + pick[1] } : null;
        const a = T().ai[0], ad = T().aiDir;
        const aiFree = D4.filter(([dx, dy]) => !(dx === -ad.x && dy === -ad.y) && !blocked(a.x + dx, a.y + dy) && !(pNext && a.x + dx === pNext.x && a.y + dy === pNext.y)).length;
        const score = D.get().state.score, len = T().ai.length;
        D.tick(); ticks++;
        const aiDied = D.get().state.score > score || T().ai.length < len;
        if (aiDied && aiFree > 0) bad++;
      }
      o.aiNoInstantCrash = bad === 0;
      o.aiRan = ticks >= 30; // oyuncu erken ölürse bile rakip en az 30 tik sürüldü
      SnakeGame.showMenu(); SnakeGame.startTron(); // gamepad bölümü taze oyun bekler
    }
    return o;
  });
  // Renk körü paleti: Okabe-Ito sabitleri ve cb açıkken yılanın canvas'ta mavi çizilmesi
  const palet = await page.evaluate(() => new Promise(r => {
    const P = SnakeGame._debug.extra().palet;
    const okabe = P.yilan === '#0072B2' && P.yem === '#E69F00' && P.curuk === '#D55E00' && P.dusman === '#CC79A7' && P.engel === '#CC79A7' && P.tron === '#F0E442';
    SnakeGame.showMenu(); SnakeGame.setSetting('cb', true); SnakeGame.startClassic();
    setTimeout(() => {
      const cv = document.getElementById('gameCanvas'); const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let mavi = 0, yesil = 0; // cb açıkken yılan mavi baskın pikseller çizer; varsayılan yeşil palet yeşil baskın olur
      for (let i = 0; i < data.length; i += 4) { const R = data[i], G = data[i + 1], B = data[i + 2]; if (B > 120 && B > R + 60 && B > G + 20 && R < 80) mavi++; else if (G > 150 && G > R + 80 && G > B + 30) yesil++; }
      SnakeGame.showMenu(); SnakeGame.setSetting('cb', false); SnakeGame.startTron(); // gamepad adımı tek oyunculu Tron bekler
      r({ okabe, cbBlue: mavi > 100 }); // #0072B2: mavi baskın
    }, 250);
  }));
  // Gamepad: pad 0 sol çubuk yukarı → ok yukarı eşlemesi (tek oyuncuda P1'i döndürür)
  const pad = await page.evaluate(() => new Promise(r => {
    const D = SnakeGame._debug;
    window.__pads = [{ axes: [0, -1], buttons: Array.from({ length: 17 }, () => ({ pressed: false })) }];
    setTimeout(() => {
      const d1 = document.getElementById('padInfo').textContent === '1 KOL BAĞLI';
      D.tick();
      const up = D.get().snake[0].y < Math.floor(24 / 2);
      window.__pads[0].buttons[9].pressed = true; // Start → duraklat
      setTimeout(() => r({ padInfo: d1, padUp: up, paused: D.get().state.paused === true }), 150);
    }, 150);
  }));
  // Seviye kartı: kartlar arası boşluğa tıklama seçmez, kart içi seçer
  const card = await page.evaluate(() => {
    SnakeGame.showMenu(); SnakeGame.startSurvivor();
    const D = SnakeGame._debug; const sv = D.get().sv;
    sv.choosing = true; sv.choices = [{ text: 'A', apply() {} }, { text: 'B', apply() {} }, { text: 'C', apply() {} }];
    const c = document.getElementById('gameCanvas'); const r = c.getBoundingClientRect();
    const click = (x, y) => c.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + x / 660 * r.width, clientY: r.top + y / 480 * r.height, bubbles: true }));
    click(220, 200); // 1. ve 2. kart arası boşluk (x=220 → sınır 206..234)
    const gapIgnored = sv.choosing === true;
    click(330, 200); // 2. kartın ortası
    return { gapIgnored, picked: sv.choosing === false };
  });
  await browser.close();
  const all = { ...out, ...palet, ...pad, ...card, errors };
  const ok = Object.entries(all).every(([k, v]) => k === 'errors' ? v.length === 0 : v === true);
  console.log(JSON.stringify(all, null, 1));
  console.log(ok ? 'TUR4 TEST: GECTI' : 'TUR4 TEST: KALDI');
  process.exit(ok ? 0 : 1);
})();
