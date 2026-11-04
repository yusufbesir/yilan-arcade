// Düzeltme ekibi: (1) zamanlayıcı/rAF birikmesi mod geçişlerinde, (2) survivor dengesi (bot tick sınırına ulaşmamalı).
// Sanal saat: setTimeout/setInterval/rAF sayfaya enjekte edilir, gerçek bekleme yok.
const { chromium } = require('playwright');
const path = require('path');

const FAKE = () => {
  const T = { now: 0, id: 1, timers: new Map(), raf: new Set() };
  window.__T = T;
  window.setTimeout = (fn, ms = 0) => { const id = T.id++; T.timers.set(id, { fn, at: T.now + ms, every: 0 }); return id; };
  window.setInterval = (fn, ms = 0) => { const id = T.id++; T.timers.set(id, { fn, at: T.now + ms, every: Math.max(1, ms) }); return id; };
  window.clearTimeout = window.clearInterval = id => { T.timers.delete(id); };
  window.requestAnimationFrame = fn => { const id = T.id++; T.raf.add(id); return id; }; // çalıştırılmaz, yalnız sayılır
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
  T.intervals = () => [...T.timers.values()].filter(t => t.every).length;
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(FAKE);
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  const res = await page.evaluate(() => {
    const T = window.__T, D = SnakeGame._debug, out = {};
    T.advance(1000);
    const base = T.intervals(); // kalıcı: gamepad yoklaması vb.

    // 1) Hız gücü açıkken menüye dön: süre dolunca hayalet tick döngüsü doğmamalı
    SnakeGame.startSurvivor();
    D.power('speed');
    SnakeGame.showMenu();
    T.advance(8000);
    out.speedGhost = T.intervals() - base; // beklenen 0

    // 2) Yeniden doğma dokunulmazlığı yeni oyuna sızmamalı
    SnakeGame.startSurvivor();
    D.power('invincible');
    SnakeGame.showMenu();
    SnakeGame.startSurvivor();
    out.invincibleLeak = D.powers().invincible; // beklenen false
    D.godMode();
    T.advance(6000);
    out.invincibleStays = D.powers().invincible; // eski oyunun sahipsiz zamanlayıcısı kapatmamalı => true

    // 3) Mod geçişleri: interval/rAF sayısı sabit kalmalı
    const starters = ['startSurvivor', 'startTimeAttack', 'startDaily', 'startSurvivor'].filter(n => typeof SnakeGame[n] === 'function');
    for (let i = 0; i < 40; i++) {
      SnakeGame[starters[i % starters.length]]();
      T.advance(300);
      if (i % 3 === 0) SnakeGame.showMenu();
    }
    SnakeGame.showMenu();
    T.advance(500);
    out.intervalsAfterMenu = T.intervals() - base; // beklenen 0
    out.rafAfterMenu = T.raf.size; // beklenen 0
    return out;
  });
  const bot = await page.evaluate(() => {
    // 4) Denge: yarı-akıllı bot sanal saatle oynar; 40000 tick içinde ölmeli (en az 4/6 koşuda)
    const T = window.__T, D = SnakeGame._debug, ds = [[1, 0], [0, 1], [-1, 0], [0, -1]], runs = [];
    for (let run = 0; run < 6; run++) {
      SnakeGame.startSurvivor();
      let t = 0;
      for (; t < 40000; t++) {
        const g = D.get();
        if (g.state.over) break;
        if (g.sv.choosing) { const c = document.getElementById('gameCanvas'), r = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + r.width / 6, clientY: r.top + r.height * 0.5, bubbles: true })); }
        if (t % 3 === 0) {
          const h = g.snake[0]; let best = null, bs = -1e9;
          for (const d of ds) {
            if (d[0] === -g.dir.x && d[1] === -g.dir.y) continue;
            const nx = h.x + d[0] * 2, ny = h.y + d[1] * 2; if (nx < 1 || ny < 1 || nx >= 39 || ny >= 29) continue;
            let s = 0; for (const e of g.enemies) { const dd = Math.hypot(e.x - nx, e.y - ny); if (dd < 4) s -= (4 - dd) * 5; }
            let gd = 1e9; for (const q of g.gems) gd = Math.min(gd, Math.hypot(q.x - nx, q.y - ny)); s -= gd === 1e9 ? 0 : gd * 0.3;
            if (g.snake.some(c => c.x === h.x + d[0] && c.y === h.y + d[1])) s -= 100;
            if (s > bs) { bs = s; best = d; }
          }
          if (best) SnakeGame.input(best[0], best[1]);
        }
        T.advance(115); // döngü interval'ı kendi tick'ini atar
      }
      runs.push({ ticks: t, over: D.get().state.over });
    }
    return runs;
  });
  console.log(JSON.stringify(res), JSON.stringify(bot), 'hatalar:', errors.length);
  await browser.close();
  const ok = res.speedGhost === 0 && res.invincibleLeak === false && res.invincibleStays === true
    && res.intervalsAfterMenu === 0 && res.rafAfterMenu === 0
    && bot.filter(r => r.over).length >= 4 && errors.length === 0;
  if (!ok) { console.error('BAŞARISIZ'); process.exit(1); }
  console.log('GEÇTİ');
})();
