// Işık katmanı testi (src/isik.js): tüm modlar + Tapınak 300 tik / çizim hatasız; REDUCED ve renk körü;
// 4 tema; parçacık sınırı (tema başına ≤ 60) ve havuz (dizi büyümez); efektler zamanla söner;
// nesne okunabilirliği (yemin parlaklığı ışıkla düşmez); ek kare maliyeti eşiği (≤ 3 ms, dpr 2).
// Ekran görüntüleri: /tmp/isik-test-*.png (deviceScaleFactor 2)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
(async () => {
  const kok = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(kok, 'src/index.html'), 'utf8');
  // betik sırası: gfx25.js -> isik.js -> tapinak.js -> game.js
  const sira = ['gfx25.js', 'isik.js', 'tapinak.js', 'game.js'].map(f => html.indexOf('<script src="' + f + '">'));
  assert(sira.every(i => i > 0) && sira[0] < sira[1] && sira[1] < sira[2] && sira[2] < sira[3], 'betik sırası ' + sira);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(kok, 'src/index.html') + '?test=1');
  await page.waitForTimeout(900);
  const sonuc = {};
  const shot = async ad => {
    const u = await page.evaluate(() => { SnakeGame._debug.draw(); return document.getElementById('gameCanvas').toDataURL('image/png'); });
    fs.writeFileSync('/tmp/isik-test-' + ad + '.png', Buffer.from(u.split(',')[1], 'base64'));
  };
  sonuc.api = await page.evaluate(() => typeof Isik === 'object' && ['zemin', 'ust', 'patla', 'olay', 'sifirla'].every(k => typeof Isik[k] === 'function'));
  assert(sonuc.api, 'Isik API eksik');

  // 1) Tüm modlar: 300 tik + her 10 tikte çizim, hata yok; parçacık ≤ 60
  const modlar = [
    ['classic', 'startClassic'], ['bullet', 'startBullet'], ['tailgun', 'startTailgun'], ['survivor', 'startSurvivor'],
    ['timeattack', 'startTimeAttack'], ['portal', 'startPortal'], ['tron', 'startTron'], ['chaos', 'startChaos'], ['daily', 'startDaily'],
    ['k1', 'startCampaign', 1], ['k2', 'startCampaign', 2], ['k3', 'startCampaign', 3], ['k4', 'startCampaign', 4], ['tapinak', 'startTapinak', 7]
  ];
  sonuc.modlar = {};
  for (const [ad, fn, arg] of modlar) {
    const r = await page.evaluate(([fn, arg]) => {
      try {
        SnakeGame[fn](arg);
        const d = SnakeGame._debug, st = d.get().state;
        st.paused = true;
        let maxP = 0;
        for (let i = 0; i < 300; i++) {
          if (st.over || st.complete) break;
          st.paused = false;
          d.godMode();
          if (st.mode === 'tapinak') { const r = SnakeGame._tapinak.run(); r.inv = Math.max(r.inv, 2); SnakeGame._tapinak.tick(); } else d.tick();
          st.paused = true;
          if (i % 10 === 0) { d.draw(); maxP = Math.max(maxP, Isik._durum().parcacik); }
        }
        d.draw();
        return { ok: true, maxP, d: Isik._durum() };
      } catch (e) { return { ok: false, e: String(e && e.stack || e) }; }
    }, [fn, arg]);
    sonuc.modlar[ad] = r;
    assert(r.ok, ad + ': ' + r.e);
    assert(r.maxP <= 60, ad + ' parçacık ' + r.maxP);
  }
  // 2) Tema başına parçacık türü / tema (Doku.themeFor ile aynı)
  sonuc.tema = await page.evaluate(() => {
    const out = {};
    for (let l = 1; l <= 4; l++) { SnakeGame.startCampaign(l); SnakeGame._debug.get().state.paused = true; for (let i = 0; i < 5; i++) SnakeGame._debug.draw(); out[l] = Isik._durum().tema; }
    return out;
  });
  assert.deepStrictEqual(sonuc.tema, { 1: 'tas', 2: 'kaya', 3: 'buz', 4: 'lav' });

  // 3) Efektler: patla/olay her tür; havuz sınırlı (≤ 28) ve zamanla söner
  sonuc.efekt = await page.evaluate(async () => {
    SnakeGame.startCampaign(1);
    SnakeGame._debug.get().state.paused = true;
    for (let i = 0; i < 80; i++) Isik.patla(10 + i % 20, 10, '#ffbf2e', 12);
    ['hasar', 'guc', 'sok', 'kapi', 'kivilcim'].forEach(t => Isik.olay(t, 12, 12, '#00ccff'));
    SnakeGame._debug.draw();
    const dolu = Isik._durum().efekt;
    SnakeGame._debug.power('speed');
    await new Promise(r => setTimeout(r, 2800));
    SnakeGame._debug.draw();
    return { dolu, sonra: Isik._durum().efekt };
  });
  assert(sonuc.efekt.dolu > 0 && sonuc.efekt.dolu <= 28, 'efekt havuzu ' + sonuc.efekt.dolu);
  assert(sonuc.efekt.sonra === 0, 'efektler sönmedi ' + sonuc.efekt.sonra);

  // 4) REDUCED ve renk körü: çizim hatasız, REDUCED'da parçacık azalır; fx=0'da atmosfer yok
  sonuc.ayar = await page.evaluate(() => {
    const out = {};
    const say = () => { for (let i = 0; i < 6; i++) SnakeGame._debug.draw(); return Isik._durum().parcacik; };
    SnakeGame.startCampaign(3); SnakeGame._debug.get().state.paused = true;
    out.normal = say();
    SnakeGame.setSetting('reduced', true); out.reduced = say();
    SnakeGame.setSetting('cb', true); Isik.olay('hasar'); Isik.patla(5, 5, '#E69F00', 20); out.cb = say();
    SnakeGame.setSetting('reduced', false); SnakeGame.setSetting('fx', 0); out.fx0 = say();
    SnakeGame.setSetting('fx', 1); SnakeGame.setSetting('cb', false);
    return out;
  });
  assert(sonuc.ayar.reduced < sonuc.ayar.normal, 'REDUCED parçacık azalmadı ' + JSON.stringify(sonuc.ayar));
  assert(sonuc.ayar.fx0 === 0, 'fx=0 atmosfer var');

  // 5) Okunabilirlik: yem merkezinin parlaklığı ışık katmanıyla düşmez (ışık nesnelerin altında)
  sonuc.okunur = await page.evaluate(() => {
    SnakeGame.startCampaign(1);
    const d = SnakeGame._debug, st = d.get().state; st.paused = true;
    const f = d.extra().food, c = document.getElementById('gameCanvas'), g = c.getContext('2d');
    const k = c.width / 960;
    const olc = () => { d.draw(); const p = g.getImageData(Math.round((f.x + 0.5) * 20 * k) - 3, Math.round((f.y + 0.5) * 20 * k) - 3, 6, 6).data; let s = 0; for (let i = 0; i < p.length; i += 4) s += p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114; return s / (p.length / 4); };
    // aynı karede karşılaştırmak için zamanı dondurmak yerine çok ölçüm ortalaması
    let a = 0, b = 0;
    for (let i = 0; i < 4; i++) { Isik.aktif = true; a += olc(); Isik.aktif = false; b += olc(); }
    Isik.aktif = true;
    return { acik: Math.round(a / 4), kapali: Math.round(b / 4) };
  });
  assert(sonuc.okunur.acik >= sonuc.okunur.kapali - 6, 'yem karardı ' + JSON.stringify(sonuc.okunur));

  // 6) Ek kare maliyeti: Isik açık/kapalı draw() farkı (dpr 2), ≤ 3 ms; Tapınak dahil.
  // Her çizimden sonra 1 piksel okunur: raster her iki durumda da karenin içinde biter (adil karşılaştırma);
  // açık/kapalı turlar iç içe, en küçük değerler (CPU yükü dalgalanmasına dayanıklı).
  sonuc.maliyet = await page.evaluate(() => {
    const d = SnakeGame._debug, out = {}, g = document.getElementById('gameCanvas').getContext('2d');
    const olc = (n) => { const a = performance.now(); for (let i = 0; i < n; i++) { d.draw(); g.getImageData(0, 0, 1, 1); } return (performance.now() - a) / n; };
    const sahne = (ad, f) => {
      f(); d.get().state.paused = true;
      olc(10);
      let on = 1e9, off = 1e9;
      for (let r = 0; r < 10; r++) { Isik.aktif = true; on = Math.min(on, olc(20)); Isik.aktif = false; off = Math.min(off, olc(20)); }
      Isik.aktif = true;
      out[ad] = { on: +on.toFixed(2), off: +off.toFixed(2), ek: +(on - off).toFixed(2) };
    };
    sahne('k1', () => SnakeGame.startCampaign(1));
    sahne('k4', () => SnakeGame.startCampaign(4));
    sahne('portal', () => SnakeGame.startPortal());
    sahne('tapinak', () => SnakeGame.startTapinak(7));
    return out;
  });
  const enKotu = Math.max(...Object.values(sonuc.maliyet).map(m => m.ek));
  assert(enKotu <= 3, 'ek kare maliyeti ' + enKotu + ' ms ' + JSON.stringify(sonuc.maliyet));

  // Ekran görüntüleri
  for (const [ad, fn] of [['k1', () => SnakeGame.startCampaign(1)], ['k2', () => SnakeGame.startCampaign(2)], ['k3', () => SnakeGame.startCampaign(3)], ['k4', () => SnakeGame.startCampaign(4)], ['tapinak', () => SnakeGame.startTapinak(7)]]) {
    await page.evaluate(fn);
    await page.waitForTimeout(700);
    await page.evaluate(() => { SnakeGame._debug.get().state.paused = true; });
    await shot(ad);
  }
  assert.deepStrictEqual(errors, [], 'konsol hatası: ' + errors.join(' | '));
  console.log('isik.test.js tamam', JSON.stringify({ tema: sonuc.tema, efekt: sonuc.efekt, ayar: sonuc.ayar, okunur: sonuc.okunur, maliyet: sonuc.maliyet }));
  await browser.close();
})().catch(e => { console.error('isik.test.js BAŞARISIZ', e.message); process.exit(1); });
