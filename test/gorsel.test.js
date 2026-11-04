// Canva amblemi ve menü anahtar görseli duman testi: dosyalar yükleniyor mu, menü/oyun sınıfları geçiyor mu, amblem yoksa SVG'ye dönüyor mu.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/yok\.png|ERR_FILE_NOT_FOUND/.test(m.text() + m.location().url)) errors.push(m.text()); });
  const bad = [];
  page.on('requestfailed', r => { if (!r.url().endsWith('yok.png')) bad.push(r.url()); });
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  await page.waitForTimeout(900);
  const res = await page.evaluate(() => {
    const em = document.getElementById('emblem');
    const svg = em.nextElementSibling;
    const art = document.querySelector('.key-art');
    const out = {};
    out.emblemLoaded = em.complete && em.naturalWidth > 0 && !em.hidden;
    out.svgHidden = svg.hasAttribute('hidden') && getComputedStyle(svg).display === 'none';
    out.bgUrl = getComputedStyle(art).backgroundImage.includes('menu-bg.jpg');
    out.menuOpacity = parseFloat(getComputedStyle(art).opacity) >= 0.95 ? '1' : getComputedStyle(art).opacity; // geçiş sürerken 0.99 okunabiliyor
    out.menuClass = document.body.classList.contains('menu-acik');
    SnakeGame.startClassic();
    out.gameClass = document.body.classList.contains('oyun-acik') && !document.body.classList.contains('menu-acik');
    SnakeGame.showMenu();
    out.backToMenu = document.body.classList.contains('menu-acik');
    return out;
  });
  await page.waitForTimeout(700);
  const gameOpacity = await page.evaluate(() => { SnakeGame.startClassic(); return new Promise(r => setTimeout(() => r(getComputedStyle(document.querySelector('.key-art')).opacity), 800)); });
  // Yedek: amblem dosyası yoksa SVG görünmeli
  const fallback = await page.evaluate(() => new Promise(r => {
    const em = document.getElementById('emblem');
    em.addEventListener('error', () => setTimeout(() => r(em.hidden && !em.nextElementSibling.hasAttribute('hidden') && getComputedStyle(em.nextElementSibling).display !== 'none'), 0));
    em.src = 'img/yok.png';
  }));
  await page.screenshot({ path: path.join(require('os').tmpdir(), 'twilight-gorsel-menu.png') }).catch(() => {});
  // Dar ekran (390x844) taşma denetimi: menü, ayarlar ve 4 kutulu HUD (HIZ+DÜN) büyük HUD açık/kapalı; yatay taşma olmamalı
  const dar = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await dar.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  await dar.waitForTimeout(600);
  const tasma = await dar.evaluate(() => {
    const de = document.documentElement;
    const olc = () => {
      const hud = document.querySelector('.game-hud');
      return de.scrollWidth <= de.clientWidth && hud.scrollWidth <= hud.clientWidth && [...document.querySelectorAll('.hud-item')].every(e => e.getBoundingClientRect().right <= innerWidth);
    };
    const out = {};
    out.menu = olc();
    SnakeGame.openSettings(); const pn = document.querySelector('#settingsPanel .panel'); out.ayar = olc() && pn.getBoundingClientRect().right <= innerWidth; SnakeGame.closeSettings();
    const d = new Date(); d.setDate(d.getDate() - 1);
    SnakeGame._debug.extra().records.dailyPrev = { d: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), s: 1230 };
    for (const b of [false, true]) {
      SnakeGame.setSetting('bigHud', b);
      SnakeGame.startClassic(); document.getElementById('hudScore').textContent = '12340'; document.getElementById('hudHigh').textContent = '99990';
      out['klasik' + (b ? 'Buyuk' : '')] = olc();
      SnakeGame.startDaily(); document.getElementById('hudScore').textContent = '12340'; document.getElementById('hudHigh').textContent = '99990';
      out['gunluk' + (b ? 'Buyuk' : '')] = olc() && document.getElementById('hudTargetLabel').textContent === 'DÜN';
    }
    SnakeGame.setSetting('bigHud', false); SnakeGame.showMenu();
    return out;
  });
  await dar.screenshot({ path: path.join(require('os').tmpdir(), 'twilight-gorsel-dar.png') }).catch(() => {});
  await dar.close();
  const darOk = Object.values(tasma).every(Boolean);
  await browser.close();
  const files = ['src/img/emblem.png', 'src/img/menu-bg.jpg', 'build/icon.png'].map(f => fs.existsSync(path.join(__dirname, '..', f)));
  const ok = darOk && res.emblemLoaded && res.svgHidden && res.bgUrl && res.menuOpacity === '1' && res.menuClass && res.gameClass && res.backToMenu && gameOpacity === '0.25' && fallback && files.every(Boolean) && errors.length === 0;
  console.log(JSON.stringify({ ...res, gameOpacity, fallback, files, errors, bad, tasma }, null, 1));
  console.log(ok ? 'GORSEL TEST: GECTI' : 'GORSEL TEST: KALDI');
  process.exit(ok ? 0 : 1);
})();
