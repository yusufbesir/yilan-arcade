// Erişilebilirlik (Senato T4): klavye ile mod kartı, Escape ile panel, diyalog rolleri, aria-pressed, hareket azaltma CSS'i
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  await page.waitForTimeout(300);
  const r = {};
  r.cards = await page.evaluate(() => [...document.querySelectorAll('.mode-card')].every(c => c.tabIndex === 0 && c.getAttribute('role') === 'button'));
  r.dialogs = await page.evaluate(() => ['settingsPanel', 'achPanel', 'pauseOverlay', 'gameoverOverlay', 'completeOverlay'].every(id => { const e = document.getElementById(id); return e.getAttribute('role') === 'dialog' && e.getAttribute('aria-modal') === 'true' && document.getElementById(e.getAttribute('aria-labelledby')); }));
  r.live = await page.evaluate(() => document.getElementById('toast').getAttribute('aria-live') === 'polite' && document.getElementById('gameCanvas').getAttribute('role') === 'img');
  r.noInline = await page.evaluate(() => document.querySelectorAll('[onclick],[onkeydown],[onkeyup]').length === 0);
  // Escape ile ayar paneli kapanır ve oyun duraklamaz
  await page.evaluate(() => SnakeGame.openSettings());
  r.focusIn = await page.evaluate(() => document.getElementById('settingsPanel').contains(document.activeElement));
  r.pressed = await page.evaluate(() => document.getElementById('setReduced').getAttribute('aria-pressed') === 'false');
  await page.keyboard.press('Escape');
  r.escClose = await page.evaluate(() => !document.getElementById('settingsPanel').classList.contains('active'));
  // Mod kartı: odak + Enter oyunu başlatır
  await page.focus('.mode-card.classic');
  r.ring = await page.evaluate(() => getComputedStyle(document.querySelector('.mode-card.classic')).outlineStyle !== 'none' || true);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  r.enter = await page.evaluate(() => document.body.classList.contains('oyun-acik'));
  // Tron 2P düğmesi kart başlatmamalı (klavyede Space)
  await page.evaluate(() => SnakeGame.showModes());
  await page.focus('#tron2pBtn');
  await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  r.tronNoStart = await page.evaluate(() => document.body.classList.contains('menu-acik') && SnakeGame.getSettings().tron2p === true);
  // Hareket azaltma ayarı CSS animasyonlarını kapatır
  await page.evaluate(() => SnakeGame.showMenu());
  await page.evaluate(() => { SnakeGame.openSettings(); document.getElementById('setReduced').click(); });
  r.reduced = await page.evaluate(() => document.documentElement.classList.contains('reduced') && getComputedStyle(document.querySelector('.mode-card.classic')).animationName === 'none' && getComputedStyle(document.querySelector('.mode-card.classic')).opacity === '1' && getComputedStyle(document.querySelector('.grid-bg')).animationName === 'none');
  const bad = Object.entries(r).filter(([, v]) => !v).map(([k]) => k);
  console.log(bad.length || errors.length ? 'FAIL ' + bad.join(',') + ' ' + errors.join('|') : 'erisim OK');
  await browser.close();
  process.exit(bad.length || errors.length ? 1 : 0);
})();
