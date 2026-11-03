// Yerel yazı tipi ve CSP: konsolda CSP hatası olmamalı, Türkçe karakterli yazı tipi yüklenmeli.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const msgs = [];
  p.on('console', m => { if (m.type() === 'error') msgs.push(m.text()); });
  p.on('pageerror', e => msgs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '../src/index.html'));
  await p.waitForTimeout(500);
  const ok = await p.evaluate(async () => { await document.fonts.load('16px "Press Start 2P"', 'İŞĞ'); return document.fonts.check('16px "Press Start 2P"', 'İŞĞ'); });
  console.log('font:', ok, 'hatalar:', msgs.length, msgs.join(' | '));
  await b.close();
  if (!ok || msgs.length) process.exit(1);
  console.log('GEÇTİ');
})();
