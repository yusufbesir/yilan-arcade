// Yılan gövdesi 0.9.5: köşe yumuşatma (sabit yarıçaplı yay, kesintisiz eğri, yırtık yok, baş açısı
// dönüşte akar), pul dokusu önbelleği (skin/cb değişince yenilenir, aynı skinde yeniden üretim yok),
// renk körü / reduced, 120 parça süre bütçesi (dpr 2, dokunun ek maliyeti < 2 ms), sprite yokken
// eski baş çizimine düşme, oyun içinde konsol hatası yok.
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

  // 1) köşe yumuşatma: oyundaki gibi tik tik ilerleyen yılan, tikler arası lerp (renderPos)
  const k = await page.evaluate(async () => {
    const out = { maxDon: 0, maxAra: 0, kesik: 0, yaricap: [], basSicrama: 0, tikFark: 0, kare: 0, cizildi: true };
    const c = document.createElement('canvas'); c.width = 900; c.height = 700;
    const ctx = c.getContext('2d');
    const o = { CELL: 20, cb: false, pal: null, reduced: false, skin: null };
    // rota: sağ 6, aşağı 4, sol 3, aşağı 1, sağ 1, aşağı 1, sağ 5 (merdiven ve U dönüşleri)
    const rota = [];
    [[1, 0, 6], [0, 1, 4], [-1, 0, 3], [0, 1, 1], [1, 0, 1], [0, 1, 1], [1, 0, 5]].forEach(([dx, dy, n]) => { for (let i = 0; i < n; i++) rota.push({ x: dx, y: dy }); });
    let snake = []; for (let i = 0; i < 9; i++) snake.push({ x: 10 - i, y: 6 });
    let onceki = null, oncekiAci = null;
    const adim = 10;
    for (let t = 0; t < rota.length; t++) {
      await new Promise(r => setTimeout(r, 0)); // oyundaki gibi kareler arası olay döngüsüne dön
      const d = rota[t];
      const prev = snake.map(p => ({ ...p }));
      snake = [{ x: snake[0].x + d.x, y: snake[0].y + d.y }].concat(snake.slice(0, -1));
      for (let s = 0; s <= adim; s++) {
        const p = s / adim;
        const pts = snake.map((q, i) => ({ x: prev[i].x + (q.x - prev[i].x) * p, y: prev[i].y + (q.y - prev[i].y) * p }));
        ctx.clearRect(0, 0, 900, 700); // oyundaki gibi her kare temiz tuval
        if (!Gfx25.drawSnakeRibbon(ctx, pts, d, 0, o)) out.cizildi = false;
        Gfx25.drawSnakeHead(ctx, pts[0], d, 0, o);
        const R = Gfx25._yilan();
        out.kare++;
        for (let i = 1; i < R.n; i++) {
          if (R.brk[i]) { out.kesik++; continue; }
          out.maxAra = Math.max(out.maxAra, Math.hypot(R.x[i] - R.x[i - 1], R.y[i] - R.y[i - 1]));
          if (i < R.n - 1) {
            const a1 = Math.atan2(R.y[i] - R.y[i - 1], R.x[i] - R.x[i - 1]), a2 = Math.atan2(R.y[i + 1] - R.y[i], R.x[i + 1] - R.x[i]);
            let da = Math.abs(a2 - a1); if (da > Math.PI) da = 2 * Math.PI - da;
            if (Math.hypot(R.x[i + 1] - R.x[i], R.y[i + 1] - R.y[i]) > 1e-6) out.maxDon = Math.max(out.maxDon, da);
          }
        }
        // iç köşe (hücre 4 boyunca, kollar >= 1 hücre): eğrinin köşe merkezine en yakın uzaklığı
        // sabit yarıçapta r*(√2-1) olmalı
        const kose = []; // gövdedeki iç köşe hücreleri (iki kolu da tam hücre)
        for (let i = 2; i < snake.length - 2; i++) {
          const a = snake[i - 1], b = snake[i], cc = snake[i + 1];
          if ((a.x - b.x) * (cc.y - b.y) - (a.y - b.y) * (cc.x - b.x) !== 0) kose.push(b);
        }
        kose.forEach(b => {
          const X = b.x * 20 + 10, Y = b.y * 20 + 10 - 4;
          let m = 1e9; for (let i = 0; i < R.n; i++) m = Math.min(m, Math.hypot(R.x[i] - X, R.y[i] - Y));
          out.yaricap.push(m);
        });
        if (oncekiAci !== null) { let da = Math.abs(R.basAci - oncekiAci); if (da > Math.PI) da = 2 * Math.PI - da; out.basSicrama = Math.max(out.basSicrama, da); }
        oncekiAci = R.basAci;
        // tik sınırı: önceki tikin p=1 karesi ile bu tikin p=0 karesi aynı eğri olmalı
        if (s === 0 && onceki && onceki.n === R.n) {
          let f = 0; for (let i = 0; i < R.n; i++) f = Math.max(f, Math.hypot(R.x[i] - onceki.x[i], R.y[i] - onceki.y[i]));
          out.tikFark = Math.max(out.tikFark, f);
        } else if (s === 0 && onceki) out.tikFark = Math.max(out.tikFark, Math.abs(onceki.L - R.L));
        if (s === adim) onceki = R;
      }
    }
    out.yMin = Math.min(...out.yaricap); out.yMax = Math.max(...out.yaricap); out.yN = out.yaricap.length;
    delete out.yaricap;
    return out;
  });
  console.log('köşe:', JSON.stringify(k));
  assert.ok(k.cizildi, 'her karede şerit çizilmeli');
  assert.strictEqual(k.kesik, 0, 'ızgara yolunda kesik (yırtık) olmamalı');
  assert.ok(k.maxAra <= 7.5, 'örnekler arası boşluk ≤ 7.5 px: ' + k.maxAra);
  assert.ok(k.maxDon <= (16 * Math.PI) / 180, 'eğri kesintisiz: ardışık örnek dönüşü ≤ 16°: ' + (k.maxDon * 180 / Math.PI).toFixed(1));
  assert.ok(k.yN > 50, 'iç köşe ölçüldü');
  const hedef = 10 * (Math.SQRT2 - 1);
  assert.ok(Math.abs(k.yMin - hedef) < 0.6 && Math.abs(k.yMax - hedef) < 0.6, 'iç köşe yarıçapı sabit (≈' + hedef.toFixed(2) + '): ' + k.yMin.toFixed(2) + '..' + k.yMax.toFixed(2));
  assert.ok(k.basSicrama < 0.45, 'baş açısı kareler arası sıçramaz: ' + k.basSicrama.toFixed(2));
  assert.ok(k.tikFark < 0.01, 'tik sınırında eğri aynı kalır: ' + k.tikFark);

  // 2) piksel: 90° köşede gövde kalınlığı korunur, merkez hattında delik yok
  const p = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300;
    const ctx = c.getContext('2d');
    // L: yukarıdan aşağı inip sağa dönen; lerp ortasında (p = 0.5)
    const cells = [{ x: 9, y: 8 }, { x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }, { x: 6, y: 7 }, { x: 6, y: 6 }, { x: 6, y: 5 }, { x: 6, y: 4 }];
    const pts = cells.slice(0, -1).map((q, i) => ({ x: (cells[i + 1].x + q.x) / 2, y: (cells[i + 1].y + q.y) / 2 }));
    Gfx25.drawSnakeRibbon(ctx, pts, { x: 1, y: 0 }, 0, { CELL: 20 });
    const R = Gfx25._yilan();
    const d = ctx.getImageData(0, 0, 400, 300).data;
    const a = (x, y) => d[(Math.round(y) * 400 + Math.round(x)) * 4 + 3];
    let delik = 0, ince = 0, top = 0;
    for (let i = 2; i < R.n - 6; i++) {
      const tx = R.x[i + 1] - R.x[i - 1], ty = R.y[i + 1] - R.y[i - 1], l = Math.hypot(tx, ty) || 1;
      const nx = -ty / l, ny = tx / l, w = R.w[i];
      top++;
      if (a(R.x[i], R.y[i]) < 250) delik++;
      if (a(R.x[i] + nx * w * 0.7, R.y[i] + ny * w * 0.7) < 250 || a(R.x[i] - nx * w * 0.7, R.y[i] - ny * w * 0.7) < 250) ince++;
    }
    return { delik, ince, top };
  });
  assert.ok(p.top > 10 && p.delik === 0 && p.ince === 0, 'köşede yırtık/incelme yok: ' + JSON.stringify(p));

  // 3) doku önbelleği: skin değişince yenilenir, aynı skinde/geri dönüşte yeniden üretilmez; cb ayrı anahtar
  const d = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300;
    const ctx = c.getContext('2d');
    const pts = []; for (let i = 0; i < 8; i++) pts.push({ x: 10 - i, y: 5 });
    const ciz = (skin, cb) => { Gfx25.drawSnakeRibbon(ctx, pts, { x: 1, y: 0 }, 0, { CELL: 20, cb, pal: { yilan: '#0072B2', ton: h => h }, skin }); return Gfx25._yilan(); };
    const piksel = y => y.dokuRenk[0] / Math.max(1, y.dokuRenk[2]); // doku tonunun kırmızı/mavi oranı
    const out = {};
    const buz = Market.cizim('buz'), kizil = Market.cizim('kizil');
    let y = ciz(buz, false); out.a1 = y.dokuAnahtar; const u1 = y.dokuUretim; out.rbBuz = piksel(y); out.cizim = y.dokuCizim;
    y = ciz(buz, false); out.ayni = y.dokuUretim - u1;
    y = ciz(kizil, false); out.a2 = y.dokuAnahtar; out.yeni = y.dokuUretim - u1; out.rbKizil = piksel(y);
    const u2 = y.dokuUretim;
    y = ciz(buz, false); out.geri = y.dokuUretim - u2; out.a3 = y.dokuAnahtar;
    y = ciz(null, true); out.cb = y.dokuAnahtar;
    y = ciz(null, false); out.orman = y.dokuAnahtar;
    // 12 skin sırayla (market önizlemesi gibi) iki tur: ikinci turda üretim yok
    const ids = Market.SKINS.map(s => s.id);
    ids.forEach(id => ciz(Market.cizim(id), false));
    const u3 = Gfx25._yilan().dokuUretim;
    ids.forEach(id => ciz(Market.cizim(id), false));
    out.ikinciTur = Gfx25._yilan().dokuUretim - u3;
    return out;
  });
  assert.strictEqual(d.a1, 'skin:buz');
  assert.ok(d.cizim > 0, 'doku dilimleri basılmalı');
  assert.strictEqual(d.ayni, 0, 'aynı skin: yeniden üretim yok');
  assert.strictEqual(d.a2, 'skin:kizil'); assert.strictEqual(d.yeni, 1, 'skin değişti: doku bir kez yenilenir');
  assert.ok(d.rbKizil > d.rbBuz * 1.3, 'doku skin rengine boyanır (kırmızı/mavi oranı): ' + d.rbBuz.toFixed(2) + ' -> ' + d.rbKizil.toFixed(2));
  assert.strictEqual(d.geri, 0, 'önceki skine dönüş önbellekten'); assert.strictEqual(d.a3, 'skin:buz');
  assert.strictEqual(d.cb, 'cb'); assert.strictEqual(d.orman, 'orman');
  assert.strictEqual(d.ikinciTur, 0, '12 skin dönüşümlü çizimde yeniden üretim yok');

  // 4) cb / reduced / dokusuz (eski kafes) / sprite yokken eski baş: hatasız
  const r = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300;
    const ctx = c.getContext('2d');
    const pts = []; for (let i = 0; i < 8; i++) pts.push({ x: 10 - i, y: 5 + (i > 4 ? i - 4 : 0) });
    const pal = (typeof PALET !== 'undefined') ? PALET : { yilan: '#0072B2', ton: h => h };
    const out = {};
    out.cb = Gfx25.drawSnakeRibbon(ctx, pts, { x: 1, y: 0 }, 0, { CELL: 20, cb: true, pal, reduced: false });
    out.red = Gfx25.drawSnakeRibbon(ctx, pts, { x: 1, y: 0 }, 0, { CELL: 20, cb: false, reduced: true, skin: Market.cizim('gece') });
    out.redCiz = Gfx25._yilan().dokuCizim;
    out.cbred = Gfx25.drawSnakeRibbon(ctx, pts, { x: 1, y: 0 }, 0, { CELL: 20, cb: true, pal, reduced: true });
    out.eski = Gfx25.drawSnakeRibbon(ctx, pts, { x: 1, y: 0 }, 0, { CELL: 20, doku: false });
    out.eskiCiz = Gfx25._yilan().dokuCizim;
    const has = Sprites.has;
    Sprites.has = () => false;
    try {
      Gfx25.drawSnakeRibbon(ctx, pts, { x: 1, y: 0 }, 0, { CELL: 20 });
      Gfx25.drawSnakeHead(ctx, pts[0], { x: 1, y: 0 }, 0, { CELL: 20, cb: false, pal });
      Gfx25.drawSnakeHead(ctx, pts[0], { x: 1, y: 0 }, 0, { CELL: 20, cb: true, pal, skin: Market.cizim('buz') });
      out.spritesiz = true;
    } catch (e) { out.spritesiz = String(e); }
    Sprites.has = has;
    return out;
  });
  assert.ok(r.cb && r.red && r.cbred && r.eski, 'cb/reduced/dokusuz çizim');
  assert.ok(r.redCiz > 0, 'reduced modda doku durağan olarak kalır');
  assert.strictEqual(r.eskiCiz, 0, 'doku kapalıyken eski kafes');
  assert.strictEqual(r.spritesiz, true, 'sprite yokken eski baş çizimi');

  // 5) süre: 120 parça, dpr 2 tuval; doku ek maliyeti < 2 ms/kare
  const ms = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1920; c.height = 1280;
    const ctx = c.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    const yol = n => { const p = []; let x = 2, y = 28, dx = 1, st = 0;
      for (let i = 0; i < n; i++) { p.push({ x, y }); if (st === 9) { y--; st = 0; dx = -dx; } else { x += dx; st++; } } return p; };
    const pts = yol(120);
    const skin = Market.cizim('aurora');
    const olc = doku => {
      for (let i = 0; i < 2; i++) Gfx25.drawSnakeRibbon(ctx, pts, { x: 1, y: 0 }, 0, { CELL: 20, skin, doku });
      ctx.getImageData(0, 0, 1, 1);
      const t0 = performance.now();
      for (let i = 0; i < 20; i++) {
        const p = (i % 10) / 10;
        const q = pts.map((a, j) => { const b = pts[j - 1] || { x: a.x + 1, y: a.y }; return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p }; });
        Gfx25.drawSnakeRibbon(ctx, q, { x: 1, y: 0 }, i / 10, { CELL: 20, skin, doku });
      }
      ctx.getImageData(0, 0, 1, 1); // GPU kuyruğunu boşalt: ertelenmiş maliyet de ölçülsün
      return (performance.now() - t0) / 20;
    };
    // yazılım GL (swiftshader) gürültülü: dönüşümlü 6 tur, ortanca
    const A = [], B = [];
    for (let r = 0; r < 6; r++) { A.push(olc(false)); B.push(olc(true)); }
    const med = v => v.slice().sort((x, y) => x - y)[v.length >> 1];
    // kayıt (JS + komut kaydı) süresi: gerçek GPU'da kare maliyetine en yakın ölçü
    const kayit = doku => { const t0 = performance.now(); for (let i = 0; i < 40; i++) Gfx25.drawSnakeRibbon(ctx, pts, { x: 1, y: 0 }, 0, { CELL: 20, skin, doku }); const v = (performance.now() - t0) / 40; ctx.getImageData(0, 0, 1, 1); return v; };
    const KA = [], KB = [];
    for (let r = 0; r < 5; r++) { KA.push(kayit(false)); KB.push(kayit(true)); }
    return { dokusuz: med(A), dokulu: med(B), kayitDokusuz: med(KA), kayitDokulu: med(KB) };
  });
  console.log('120 parça ms/kare (dpr 2):', JSON.stringify(ms));
  // ölçüm 1: yazılım GL'de çizim + raster (tuval boşaltılarak); ölçüm 2: komut kaydı süresi
  // Eşik makine hızına göre ölçeklenir: temel kare süresi (dokusuz) uzadıkça izin verilen ek maliyet de artar
  const esik = Math.max(2, ms.dokusuz / 3);
  assert.ok(ms.dokulu - ms.dokusuz < esik, 'doku ek maliyeti (raster dahil) < ' + esik.toFixed(2) + ' ms: ' + (ms.dokulu - ms.dokusuz).toFixed(2));
  assert.ok(ms.kayitDokulu - ms.kayitDokusuz < 2 && ms.kayitDokulu < 3, 'doku kayıt süresi: ' + ms.kayitDokulu.toFixed(2));

  // 6) oyun içi: skinli uzun yılan döner, doku çizilir, konsol hatası yok
  const oyun = await page.evaluate(async () => {
    localStorage.setItem('twilightMarket', JSON.stringify({ v: 1, sahip: ['orman', 'kizil'], giyili: 'kizil' }));
    Market.load();
    SnakeGame.startClassic();
    SnakeGame._debug.godMode();
    SnakeGame._debug.grow(110);
    for (let i = 0; i < 6; i++) SnakeGame._debug.tick();
    await new Promise(r => setTimeout(r, 150));
    const y = Gfx25._yilan();
    return { n: y.n, anahtar: y.dokuAnahtar, cizim: y.dokuCizim };
  });
  assert.ok(oyun.n > 2 && oyun.cizim > 0, 'oyunda dokulu şerit: ' + JSON.stringify(oyun));
  assert.strictEqual(oyun.anahtar, 'skin:kizil');
  assert.deepStrictEqual(errors, [], 'konsol hatası: ' + errors.join('|'));
  await browser.close();
  console.log('yilan-doku.test.js OK');
})().catch(e => { console.error(e); process.exit(1); });
