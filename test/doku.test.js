// Doku testi: PBR doku paketi yükleniyor mu (404 yok), tema seçimi, makro doku bütçesi, 4 tema + Tapınak odaları çiziliyor mu, konsol hatası yok.
// Ekran görüntüleri: /tmp/doku-*.png (deviceScaleFactor 2)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
(async () => {
  const kok = path.resolve(__dirname, '..');
  // Kaynak dosyalar diskte var
  ['PavingStones138', 'Rock064', 'Rock058', 'Tiles141', 'Lava004', 'Moss002', 'Ground068', 'Leather008'].forEach(id => ['Color', 'NormalGL', 'Roughness'].forEach(h => {
    assert(fs.existsSync(path.join(kok, 'src/img/tex', id, id + '_' + h + '.jpg')), id + '_' + h);
  }));
  assert(fs.existsSync(path.join(kok, 'src/img/tex/pack.js')), 'pack.js');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 2 });
  const errors = [], bad = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => bad.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  await page.goto('file://' + path.join(kok, 'src/index.html') + '?test=1');
  await page.waitForTimeout(900);
  const sonuc = {};
  sonuc.yuklendi = await page.evaluate(() => typeof Doku !== 'undefined' && Doku.state === 'ready');
  // Tema seçimi: seviye%4 ve mod
  sonuc.tema = await page.evaluate(() => ({
    k: [1, 2, 3, 4, 5].map(l => Doku.themeFor('campaign', l)),
    c: Doku.themeFor('classic'), b: Doku.themeFor('bullet'), x: Doku.themeFor('bilinmeyen-mod')
  }));
  assert.deepStrictEqual(sonuc.tema.k, ['tas', 'kaya', 'buz', 'lav', 'tas']);
  assert.strictEqual(sonuc.tema.c, 'tas');
  assert(Doku_ok(sonuc.tema.x));
  function Doku_ok(t) { return ['tas', 'kaya', 'buz', 'lav'].includes(t); }
  // Makro doku bütçesi: her biri < 150 ms (dpr 2)
  sonuc.sure = await page.evaluate(() => {
    const out = {};
    ['tas', 'kaya', 'buz', 'lav', 'bat', 'run'].forEach(t => {
      let worst = 0, n = 0;
      while (!Doku.ready(t, 2) && n++ < 12) { const a = performance.now(); Doku.pump(t, 2); worst = Math.max(worst, performance.now() - a); }
      out[t] = { ok: Doku.ready(t, 2), ms: Math.round(worst) };
    });
    return out;
  });
  Object.keys(sonuc.sure).forEach(t => { assert(sonuc.sure[t].ok, t + ' hazır değil'); assert(sonuc.sure[t].ms < 150, t + ' ' + sonuc.sure[t].ms + ' ms'); });
  // Klasik + 4 tema: zemin tuvali dokulu çiziliyor (yedek değil)
  const shots = [['classic', () => SnakeGame.startClassic()], ['kaya', () => SnakeGame.startCampaign(2)], ['buz', () => SnakeGame.startCampaign(3)], ['lav', () => SnakeGame.startCampaign(4)]];
  sonuc.cizim = {};
  for (const [ad, fn] of shots) {
    await page.evaluate(fn);
    await page.evaluate(() => Tema.sifirla()); // Kaya karanlık kuralı zemini örtmesin: bu test yalnız doku okunurluğunu ölçer
    await page.waitForTimeout(1200);
    await page.locator('#gameCanvas').screenshot({ path: '/tmp/doku-' + ad + '.png' });
    // zemin ortalama parlaklığı orta-koyu (okunabilirlik) ve boş değil
    sonuc.cizim[ad] = await page.evaluate(() => {
      const c = document.getElementById('gameCanvas'), g = c.getContext('2d');
      const d = g.getImageData(c.width * 0.2, c.height * 0.3, 200, 150).data;
      let s = 0, v = 0, n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) s += (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      const m = s / n;
      for (let i = 0; i < d.length; i += 4) { const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; v += (l - m) * (l - m); }
      return { mean: Math.round(m), sd: Math.round(Math.sqrt(v / n)) };
    });
    const m = sonuc.cizim[ad];
    assert(m.mean > 8 && m.mean < 95, ad + ' parlaklık ' + m.mean);
    assert(m.sd > 2, ad + ' düz renk (doku yok) sd=' + m.sd);
  }
  // Tapınak: savaş / boss / gizli / hazine odaları
  for (const [tur, k] of [['savas', '1,1'], ['boss', '1,0'], ['gizli', '0,0'], ['hazine', '2,2']]) {
    await page.evaluate(k => { SnakeGame.startTapinak(5); SnakeGame._tapinak.run().oda = k; }, k);
    await page.waitForTimeout(1200);
    await page.locator('#gameCanvas').screenshot({ path: '/tmp/doku-tapinak-' + tur + '.png' });
    const tex = await page.evaluate(k => { const o = SnakeGame._tapinak.run().odalar[k]; return o._tex === true; }, k);
    assert(tex, 'tapınak ' + tur + ' dokulu değil');
  }
  assert.deepStrictEqual(bad, [], '404/başarısız istek: ' + bad.join(','));
  assert.deepStrictEqual(errors, [], 'konsol hatası: ' + errors.join(' | '));
  console.log('doku.test.js tamam', JSON.stringify(sonuc));
  await browser.close();
})().catch(e => { console.error('doku.test.js BAŞARISIZ', e.message); process.exit(1); });
