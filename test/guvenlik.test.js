// Güvenlik bakımı: test API'si (_debug/_ach) ?test=1 olmadan açılmamalı; CSP ve window.open engeli yerinde.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html'));
  await page.waitForTimeout(200);
  const prod = await page.evaluate(() => ({ dbg: typeof SnakeGame._debug, ach: typeof SnakeGame._ach, keys: Object.keys(SnakeGame).filter(k => k.startsWith('_')), works: typeof SnakeGame.startClassic === 'function' }));
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  await page.waitForTimeout(200);
  const test = await page.evaluate(() => ({ dbg: typeof SnakeGame._debug, ach: typeof SnakeGame._ach }));
  // Tıklama yetkilendirmesi: gerçek tıklama ile kart oyunu başlatır, ayar düğmesi anahtarı çevirir, Tron 2P düğmesi oyunu başlatmaz
  await page.click('.mode-card.classic');
  const clicked = await page.evaluate(() => document.body.classList.contains('oyun-acik'));
  // Dokunmatik dpad/ateş: pointerdown ile çalışır, CSP ihlali üretmez (satır içi ontouchstart/onpointerdown yok)
  const dpad = await page.evaluate(() => {
    window.__cspv = 0; document.addEventListener('securitypolicyviolation', () => window.__cspv++);
    const dir0 = JSON.stringify(SnakeGame._debug.get().nextDir);
    document.querySelector('.dpad-btn.up').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    document.getElementById('fireBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const dir1 = JSON.stringify(SnakeGame._debug.get().nextDir);
    return { changed: dir0 !== dir1 && dir1 === '{"x":0,"y":-1}', cspv: window.__cspv, hasPress: document.getElementById('fireBtn').dataset.press === 'fire' };
  });
  await page.evaluate(() => SnakeGame.showModes()); // Tron 2P düğmesi Modlar ekranında
  await page.click('#tron2pBtn');
  const tronBtn = await page.evaluate(() => SnakeGame.getSettings().tron2p === true && document.getElementById('modesScreen').classList.contains('active') && document.body.classList.contains('menu-acik'));
  await page.evaluate(() => { SnakeGame.setSetting('tron2p', false); SnakeGame.openSettings(); });
  await page.click('#setShake');
  const shakeBtn = await page.evaluate(() => SnakeGame.getSettings().shake === false);
  await page.evaluate(() => SnakeGame.setSetting('shake', true));
  // CSP gerçekten uygulanıyor mu: satır içi betik çalışmamalı
  const cspEnforced = await page.evaluate(() => { window.__inl = false; const sc = document.createElement('script'); sc.textContent = 'window.__inl = true'; document.body.appendChild(sc); return window.__inl === false; });
  // Bozuk ayar kaydı tip/aralık denetiminden geçmemeli
  await page.evaluate(() => localStorage.setItem('twilightSettings', JSON.stringify({ speed: 99, vol: 'x', shake: 'evet', cb: true })));
  await page.reload(); await page.waitForTimeout(200);
  const sane = await page.evaluate(() => { const s = SnakeGame.getSettings(); return s.speed === 1 && s.vol === 0.6 && s.shake === true && s.cb === true; });
  await browser.close();
  const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
  const cspVal = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  const csp = /default-src 'self'/.test(cspVal) && !/script-src[^;]*unsafe-inline/.test(cspVal) && /object-src 'none'/.test(cspVal) && /base-uri 'none'/.test(cspVal) && !/\son(click|load|error|input|change|touchstart|pointerdown|touchend|mousedown)=/.test(html) && !/<script>/.test(html);
  const main = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  const shell = ['contextIsolation: true', 'nodeIntegration: false', 'sandbox: true', 'setPermissionRequestHandler', 'setWindowOpenHandler', "will-navigate", 'will-attach-webview', 'devTools: !app.isPackaged', 'new URL('].every(k => main.includes(k));
  const ok = prod.dbg === 'undefined' && prod.ach === 'undefined' && prod.keys.length === 0 && prod.works && test.dbg === 'object' && test.ach === 'object' && clicked && dpad.changed && dpad.cspv === 0 && dpad.hasPress && tronBtn && shakeBtn && cspEnforced && sane && csp && shell && errors.length === 0;
  console.log(JSON.stringify({ prod, test, clicked, dpad, tronBtn, shakeBtn, cspEnforced, sane, csp, shell, errors }));
  console.log(ok ? 'GUVENLIK TEST: GECTI' : 'GUVENLIK TEST: KALDI');
  process.exit(ok ? 0 : 1);
})();
