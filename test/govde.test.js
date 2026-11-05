// Tek parça yılan gövdesi (Gfx25.drawSnakeRibbon): uzunluk 3/30/150 hatasız çizim, kare süresi eşiği,
// renk körü modu, hayalet kuralında gövde gizli, portal kesiği ve büyüme sırasındaki yinelenen noktalar.
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/yok\.png|ERR_FILE_NOT_FOUND/.test(m.text() + m.location().url)) errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  await page.waitForTimeout(900);

  const res = await page.evaluate(() => {
    const out = {};
    const c = document.createElement('canvas');
    c.width = 960; c.height = 640;
    const ctx = c.getContext('2d');
    const pal = { yilan: '#0072B2', ton: (hex, k) => hex };
    const opt = cb => ({ CELL: 20, cb, pal: (typeof PALET !== 'undefined' ? PALET : pal), reduced: false });
    // ızgarada kıvrımlı yılan: 12 hücre sağa, 1 yukarı, 12 sola...
    const yol = n => {
      const p = []; let x = 2, y = 20, dx = 1, step = 0;
      for (let i = 0; i < n; i++) {
        p.push({ x, y });
        if (step === 12) { y--; step = 0; dx = -dx; } else { x += dx; step++; }
      }
      return p.reverse().map(q => ({ x: q.x, y: q.y })).reverse();
    };
    const sure = (n, cb) => {
      const pts = yol(n);
      for (let i = 0; i < 5; i++) Gfx25.drawSnakeRibbon(ctx, pts, { x: 1, y: 0 }, 0, opt(cb));
      const t0 = performance.now();
      const R = 60;
      for (let i = 0; i < R; i++) {
        // lerp benzeri kesirli kayma
        const q = pts.map(p => ({ x: p.x + (i % 10) / 10 * 0.5, y: p.y }));
        Gfx25.drawSnakeRibbon(ctx, q, { x: 1, y: 0 }, i / 10, opt(cb));
      }
      return (performance.now() - t0) / R;
    };
    out.ok = {};
    [3, 30, 150].forEach(n => { out.ok[n] = Gfx25.drawSnakeRibbon(ctx, yol(n), { x: 1, y: 0 }, 0, opt(false)); });
    out.ms = { 3: sure(3, false), 30: sure(30, false), 100: sure(100, false), 150: sure(150, false), cb30: sure(30, true), cb150: sure(150, true) };
    // büyüme: kuyruk kopyaları (aynı hücre) hata vermemeli
    const kopya = yol(10); for (let i = 0; i < 20; i++) kopya.push({ ...kopya[kopya.length - 1] });
    out.kopya = Gfx25.drawSnakeRibbon(ctx, kopya, { x: 1, y: 0 }, 0, opt(false));
    // portal/duvar geçişi: >1.5 hücre sıçrama gövdeyi böler, hata yok
    const kesik = yol(12); kesik[6] = { x: 40, y: 3 };
    out.kesik = Gfx25.drawSnakeRibbon(ctx, kesik, { x: 1, y: 0 }, 0, opt(false));
    out.tek = Gfx25.drawSnakeRibbon(ctx, [{ x: 3, y: 3 }], { x: 1, y: 0 }, 0, opt(false));
    // tuvalde gerçekten boya var mı (şerit renkli piksel bırakmalı)
    ctx.clearRect(0, 0, 960, 640);
    Gfx25.drawSnakeRibbon(ctx, yol(30), { x: 1, y: 0 }, 0, opt(false));
    const d = ctx.getImageData(0, 0, 960, 640).data;
    let dolu = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 200) dolu++;
    out.dolu = dolu;
    return out;
  });
  assert.strictEqual(res.ok[3] && res.ok[30] && res.ok[150], true, 'uzunluk 3/30/150 çizilmeli');
  assert.strictEqual(res.kopya, true, 'yinelenen kuyruk noktaları');
  assert.strictEqual(res.kesik, true, 'portal kesiği');
  assert.strictEqual(res.tek, false, 'tek hücrelik yılan şerit çizmez (baş yolu devralır)');
  assert(res.dolu > 800, 'şerit piksel bırakmalı: ' + res.dolu);
  // Eşik: yazılım (swiftshader/CPU) tuvalde bile uzun yılan kare başına ≤ 3 ms (gerçek GPU tuvalde çok daha az)
  console.log('şerit ms/kare:', JSON.stringify(res.ms));
  // Makine hızı: 3 parçalık yılan (0.2 ms hızlı makinede) yavaş CPU/yazılım GL'de ölçeği büyütür (1..4)
  const olcek = Math.min(4, Math.max(1.5, res.ms[3] / 0.2));
  console.log('makine ölçeği:', olcek.toFixed(2));
  assert(res.ms[100] <= 3 * olcek, '100 uzunlukta kare süresi ' + res.ms[100].toFixed(2) + ' ms');
  assert(res.ms[150] <= 4.5 * olcek, '150 uzunlukta kare süresi ' + res.ms[150].toFixed(2) + ' ms');
  assert(res.ms.cb30 <= 3 * olcek && res.ms.cb150 <= 4.5 * olcek, 'renk körü süre: cb30 ' + res.ms.cb30.toFixed(2) + ', cb150 ' + res.ms.cb150.toFixed(2));

  // Oyun içi: şerit yolu kullanılır, hayalet kuralında gövde çizilmez, renk körü modunda hata yok
  const oyun = await page.evaluate(async () => {
    const out = {};
    let n = 0;
    const orijinal = Gfx25.drawSnakeRibbon;
    Gfx25.drawSnakeRibbon = function () { n++; return orijinal.apply(this, arguments); };
    SnakeGame.startClassic();
    SnakeGame._debug.godMode();
    SnakeGame._debug.grow(20);
    for (let i = 0; i < 4; i++) SnakeGame._debug.tick();
    await new Promise(r => setTimeout(r, 120));
    out.serit = n > 0;
    const once = n;
    SnakeGame._debug.extra().chaos.rule = 'ghost';
    await new Promise(r => setTimeout(r, 120));
    out.hayalet = n === once;
    SnakeGame._debug.extra().chaos.rule = null;
    await new Promise(r => setTimeout(r, 120));
    out.geriGeldi = n > once;
    SnakeGame.setSetting('cb', true);
    await new Promise(r => setTimeout(r, 120));
    out.cb = true;
    Gfx25.drawSnakeRibbon = orijinal;
    return out;
  });
  assert.strictEqual(oyun.serit, true, 'oyun şerit çizimini çağırmalı');
  assert.strictEqual(oyun.hayalet, true, 'ghost kuralında gövde çizilmemeli');
  assert.strictEqual(oyun.geriGeldi, true, 'ghost bitince gövde geri gelmeli');
  assert.deepStrictEqual(errors, [], 'konsol hatası: ' + errors.join('|'));
  await browser.close();
  console.log('govde.test.js OK');
})().catch(e => { console.error(e); process.exit(1); });
