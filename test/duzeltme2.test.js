// Düzeltme ekibi tur 2: Zamana Karşı gerçek saniye, duraklama/devam rAF birikmesi, survivor elmas taşması XP kaybı, Tron YZ flood.
const { chromium } = require('playwright');
const path = require('path');

const FAKE = () => {
  const T = { now: 0, id: 1, timers: new Map(), raf: new Set() };
  window.__T = T;
  window.setTimeout = (fn, ms = 0) => { const id = T.id++; T.timers.set(id, { fn, at: T.now + ms, every: 0 }); return id; };
  window.setInterval = (fn, ms = 0) => { const id = T.id++; T.timers.set(id, { fn, at: T.now + ms, every: Math.max(1, ms) }); return id; };
  window.clearTimeout = window.clearInterval = id => { T.timers.delete(id); };
  window.requestAnimationFrame = fn => { const id = T.id++; T.raf.add(id); return id; };
  window.cancelAnimationFrame = id => { T.raf.delete(id); };
  T.advance = ms => {
    const end = T.now + ms;
    for (;;) {
      let nid = null, nt = null;
      for (const [id, t] of T.timers) if (t.at <= end && (nt === null || t.at < nt)) { nid = id; nt = t.at; }
      if (nid === null) break;
      const t = T.timers.get(nid);
      T.now = t.at;
      if (t.every) t.at += t.every; else T.timers.delete(nid);
      t.fn();
    }
    T.now = end;
  };
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(FAKE);
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  const r = await page.evaluate(() => {
    const T = window.__T, D = SnakeGame._debug, out = {};
    // 1) Zamana Karşı: 2x hızda 10 gerçek saniye ~ 10 sn düşmeli
    SnakeGame.setSetting('speed', 2);
    SnakeGame.startTimeAttack();
    D.godMode();
    T.advance(10000);
    out.taKalan = D.get().state.timeLeft; // beklenen ~50 (eskiden ~55)
    SnakeGame.setSetting('speed', 1);
    SnakeGame.showMenu();
    // 2) duraklat/devam x5: bekleyen rAF 1'i geçmemeli
    SnakeGame.startSurvivor();
    for (let i = 0; i < 5; i++) { SnakeGame.togglePause(); SnakeGame.togglePause(); }
    out.raf = T.raf.size; // beklenen 1
    SnakeGame.showMenu();
    // 3) elmas taşması: toplam XP korunmalı
    SnakeGame.startSurvivor();
    const g = D.get();
    D.godMode();
    g.gems.length = 0;
    for (let i = 0; i < 80; i++) g.gems.push({ x: 30 + (i % 8), y: 2 + Math.floor(i / 8), v: 1 });
    g.enemies.push({ x: g.snake[0].x + 6, y: g.snake[0].y, hp: 1 });
    // doğrudan öldürme yolu: oyuncu mermisi düşmanın üstünde
    g.playerShots.push({ x: g.enemies[0].x, y: g.enemies[0].y, dx: 0, dy: 0, dmg: 5 });
    D.tick();
    const toplam = D.get().gems.reduce((a, q) => a + (q.v || 1), 0);
    out.gemXp = toplam; // beklenen 81
    out.gemLen = D.get().gems.length; // <= 80
    return out;
  });
  const tron = await page.evaluate(() => {
    // 4) Tron YZ: çözülmemiş hata olmadan çok tik
    SnakeGame.startTron();
    SnakeGame._debug.godMode();
    for (let i = 0; i < 300 && !SnakeGame._debug.get().state.over; i++) SnakeGame._debug.tick();
    return true;
  });
  console.log(JSON.stringify(r), 'tron', tron, 'hatalar:', errors.length);
  await browser.close();
  const ok = Math.abs(r.taKalan - 50) < 1.5 && r.raf === 1 && r.gemXp === 81 && r.gemLen <= 80 && tron && errors.length === 0;
  if (!ok) { console.error('BAŞARISIZ'); process.exit(1); }
  console.log('GEÇTİ');
})();
