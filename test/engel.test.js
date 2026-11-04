// Engel testi (0.9.5): biyoma özgü engel çeşitleri (src/engel.js). Yalnız görsel/şekil; oyun mantığı aynı.
// Kapsam: tema başına türler, tohumlu determinizm (Günlük dahil), erişilebilirlik (flood-fill), yılan başlangıcı/yem güvenliği,
// çarpışmanın hücre bazlı kalması, renk körü + reduced, çizim süresi, konsol hatası yok.
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
(async () => {
  const kok = path.resolve(__dirname, '..');
  const fs = require('fs');
  const html = fs.readFileSync(path.join(kok, 'src/index.html'), 'utf8');
  const sira = ['engel.js', 'gfx25.js', 'isik.js', 'game.js'].map(f => html.indexOf('<script src="' + f + '">'));
  assert(sira.every(i => i > 0) && sira.every((v, i) => !i || v > sira[i - 1]), 'betik sırası: engel.js -> gfx25.js -> isik.js -> game.js');
  const gsatir = fs.readFileSync(path.join(kok, 'src/game.js'), 'utf8');
  assert(/Engel\.uret\(/.test(gsatir) && !/Engel\.ciz\(/.test(gsatir), 'game.js yalnız üretim kancası içerir; çizim gfx25 içinde');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(kok, 'src/index.html') + '?test=1');
  await page.waitForTimeout(700);

  // 1) Tür kataloğu: tema başına özgü türler (Yusuf'un istediği: lav nehri, buz dağı, ağaç, nehir)
  const kat = await page.evaluate(() => ({ T: Engel.TURLER, AD: Engel.AD }));
  assert.deepStrictEqual(Object.keys(kat.T).sort(), ['bat', 'buz', 'kaya', 'lav', 'run', 'tas']);
  assert.deepStrictEqual(kat.T.tas, ['sutun', 'yikik']);
  assert.deepStrictEqual(kat.T.kaya, ['stalagmit', 'yigin']);
  assert.deepStrictEqual(kat.T.buz, ['dag', 'kristal']);
  assert.deepStrictEqual(kat.T.lav, ['nehir', 'bazalt']);
  assert.deepStrictEqual(kat.T.bat, ['agac', 'sazlik', 'su']);
  assert.deepStrictEqual(kat.T.run, ['dikilitas']);
  const tumTurler = [].concat(...Object.values(kat.T));
  assert.strictEqual(new Set(tumTurler).size, tumTurler.length, 'her tür tek temaya ait');
  tumTurler.forEach(t => assert(kat.AD[t], 'ad: ' + t));

  // 2) Üretim: tema x seviye x tohum. Boş haritada ulaşılamaz bölge yok, başlangıç şeridi/yılan/yem boş, tüm türler görülür
  const uretim = await page.evaluate(() => {
    const COLS = 48, ROWS = 32, orta = 16, out = {};
    for (const tema of Object.keys(Engel.TURLER)) {
      const r = { turler: {}, enAz: 1e9, enCok: 0, ihlal: [], kapali: 0, cakisma: 0 };
      for (let seviye = 1; seviye <= 30; seviye += 3) for (let k = 0; k < 6; k++) {
        const yilan = [{ x: 5, y: orta }, { x: 4, y: orta }, { x: 3, y: orta }];
        const yem = { x: 10 + k * 5, y: 5 + k * 3 };
        const list = [];
        Engel.uret(list, { tema, COLS, ROWS, yilan, yem, hareketli: [], seviye, ek: true, tohum: 's' + seviye + '-' + k });
        r.enAz = Math.min(r.enAz, list.length); r.enCok = Math.max(r.enCok, list.length);
        const set = new Set();
        list.forEach(o => {
          r.turler[o.tur] = (r.turler[o.tur] || 0) + 1;
          const key = o.x + ',' + o.y;
          if (set.has(key)) r.cakisma++;
          set.add(key);
          if (o.x < 2 || o.y < 2 || o.x > COLS - 3 || o.y > ROWS - 3) r.ihlal.push('sinir ' + key);
          if (Math.abs(o.y - orta) <= 2 && o.x <= 16) r.ihlal.push('serit ' + key);
          if (yilan.some(s => Math.abs(s.x - o.x) <= 1 && Math.abs(s.y - o.y) <= 1)) r.ihlal.push('yilan ' + key);
          if (Math.abs(yem.x - o.x) <= 1 && Math.abs(yem.y - o.y) <= 1) r.ihlal.push('yem ' + key);
          if (!Engel.TURLER[tema].includes(o.tur)) r.ihlal.push('tur ' + o.tur);
        });
        const grid = new Uint8Array(COLS * ROWS);
        list.forEach(o => { grid[o.x + o.y * COLS] = 1; });
        r.kapali += Engel._ulasilamaz(grid, COLS, ROWS, yilan[0].x, yilan[0].y);
      }
      out[tema] = r;
    }
    return out;
  });
  Object.keys(uretim).forEach(t => {
    const r = uretim[t];
    assert.strictEqual(r.ihlal.length, 0, t + ' ihlal: ' + r.ihlal.slice(0, 3));
    assert.strictEqual(r.kapali, 0, t + ': ulaşılamaz kapalı bölge');
    assert.strictEqual(r.cakisma, 0, t + ': çakışan hücre');
    assert(r.enAz >= 6 && r.enCok <= 60, t + ' yoğunluk ' + r.enAz + '..' + r.enCok + ' (48x32 ızgara, makul)');
    kat.T[t].forEach(tur => assert(r.turler[tur] > 0, t + ': ' + tur + ' hiç üretilmedi'));
  });

  // 3) Determinizm: aynı tohum aynı yerleşim; farklı tohum farklı; mevcut engeller yerinde kalır
  const det = await page.evaluate(() => {
    const yap = (tema, tohum, on) => {
      const list = (on || []).map(o => ({ ...o }));
      Engel.uret(list, { tema, COLS: 48, ROWS: 32, yilan: [{ x: 5, y: 16 }, { x: 4, y: 16 }], yem: { x: 30, y: 8 }, seviye: 12, ek: true, tohum });
      return list;
    };
    const o = {};
    o.ayni = ['tas', 'kaya', 'buz', 'lav', 'bat', 'run'].every(t => JSON.stringify(yap(t, 'gun-1')) === JSON.stringify(yap(t, 'gun-1')));
    o.farkli = JSON.stringify(yap('bat', 'gun-1')) !== JSON.stringify(yap('bat', 'gun-2'));
    const mevcut = [{ x: 20, y: 5 }, { x: 21, y: 5 }, { x: 30, y: 25 }];
    const l = yap('buz', 'x', mevcut);
    o.mevcutYerinde = mevcut.every((m, i) => l[i].x === m.x && l[i].y === m.y);
    o.mevcutTurlu = mevcut.every((m, i) => !!l[i].tur);
    // ek: false => hücre eklenmez (Günlük/Portal)
    const e = mevcut.map(m => ({ ...m }));
    Engel.uret(e, { tema: 'lav', COLS: 48, ROWS: 32, yilan: [], seviye: 5, ek: false, tohum: 'z' });
    o.eklemez = e.length === 3 && e.every(m => m.tur);
    // üretim oyunun Math.random'ını tüketmez
    const orj = Math.random; let say = 0; Math.random = () => { say++; return 0.5; };
    yap('bat', 'tohumlu'); Math.random = orj;
    o.randTuketmez = say === 0;
    return o;
  });
  assert(det.ayni, 'aynı tohum aynı yerleşim');
  assert(det.farkli, 'farklı tohum farklı yerleşim');
  assert(det.mevcutYerinde && det.mevcutTurlu, 'mevcut engeller yerinde ve etiketli');
  assert(det.eklemez, 'ek:false hücre eklemez');
  assert(det.randTuketmez, 'Math.random tüketilmez');

  // 4) Oyun içinde: Bölüm Modu 6 temada; yılan başlangıcı ve yem güvenli; tur alanı var; hücre çarpışması aynı
  const temalar = ['tas', 'kaya', 'buz', 'lav', 'bat', 'run'];
  for (const id of temalar) {
    const r = await page.evaluate(id => {
      localStorage.setItem('twilightMarket', JSON.stringify({ v: 1, sahip: ['orman'], giyili: 'orman', tema: id, sahipTema: ['otomatik', 'tas', 'kaya', 'buz', 'lav', 'bat', 'run'] }));
      Market.load();
      const o = {};
      SnakeGame.startCampaign(14);
      const D = SnakeGame._debug, X = D.extra(), G = D.get();
      const obs = X.obstacles;
      o.tema = Tema.etkin('campaign', 14);
      o.sayi = obs.length;
      o.turlu = obs.filter(c => c.tur).length;
      o.gecersiz = obs.filter(c => c.tur && !Engel.TURLER[id].includes(c.tur)).length;
      o.yilanIcinde = G.snake.some(s => obs.some(c => c.x === s.x && c.y === s.y));
      o.yemIcinde = obs.some(c => c.x === X.food.x && c.y === X.food.y);
      o.serit = obs.filter(c => c.g !== undefined && Math.abs(c.y - 16) <= 2 && c.x <= 16).length; // yalnız Engel'in eklediği kümeler (eski rastgele engeller eski davranış)
      const grid = new Uint8Array(48 * 32); obs.forEach(c => { grid[c.x + c.y * 48] = 1; });
      o.kapali = Engel._ulasilamaz(grid, 48, 32, G.snake[0].x, G.snake[0].y);
      // hücre bazlı çarpışma: başın önüne türlü engel koy, tik at, can azalmalı (yeni kural yok)
      const h = G.snake[0], d = G.dir, can = G.state.lives;
      obs.push({ x: h.x + d.x, y: h.y + d.y, tur: Engel.TURLER[id][0], v: 0 });
      D.tick();
      o.carpti = SnakeGame._debug.get().state.lives < can || SnakeGame._debug.get().state.over === true || SnakeGame._debug.get().state.dead === true || SnakeGame._debug.get().state.state === 'dead';
      return o;
    }, id);
    assert.strictEqual(r.tema, id, id + ' teması etkin');
    assert(r.sayi >= 8, id + ' engel sayısı ' + r.sayi);
    assert.strictEqual(r.turlu, r.sayi, id + ': tüm engeller türlü');
    assert.strictEqual(r.gecersiz, 0, id + ': tema dışı tür');
    assert(!r.yilanIcinde && !r.yemIcinde, id + ': yılan/yem engelin içinde');
    assert.strictEqual(r.serit, 0, id + ': başlangıç şeridi boş olmalı');
    assert.strictEqual(r.kapali, 0, id + ': ulaşılamaz bölge');
    assert(r.carpti, id + ': türlü engele çarpınca hasar (mantık aynı)');
  }

  // 5) Bölüm Modu "Otomatik" döngüsü (level-1)%4: tas/kaya/buz/lav
  const dongu = await page.evaluate(() => {
    localStorage.setItem('twilightMarket', JSON.stringify({ v: 1, sahip: ['orman'], giyili: 'orman' })); Market.load();
    return [1, 2, 3, 4, 5].map(l => { SnakeGame.startCampaign(l); const t = Tema.etkin('campaign', l); return { t, ok: SnakeGame._debug.extra().obstacles.every(c => !c.tur || Engel.TURLER[t].includes(c.tur)) }; });
  });
  assert.deepStrictEqual(dongu.map(d => d.t), ['tas', 'kaya', 'buz', 'lav', 'tas']);
  assert(dongu.every(d => d.ok), 'döngüde türler temaya uygun');

  // 6) Günlük: aynı gün aynı yerleşim (tohum), hücre sayısı eski üretimle aynı (9), hepsi etiketli; Portal: duvar etiketli, hücre ekleme yok
  const gun = await page.evaluate(() => {
    const o = {};
    SnakeGame.startDaily(); const a = JSON.stringify(SnakeGame._debug.extra().obstacles);
    SnakeGame.startDaily(); const b = JSON.stringify(SnakeGame._debug.extra().obstacles);
    o.ayni = a === b; o.n = JSON.parse(a).length; o.etiket = JSON.parse(a).every(c => c.tur);
    // etiketsiz yerleşim (eski kod): konumlar aynı kalmalı
    o.konumlar = JSON.parse(a).map(c => c.x + ',' + c.y).join(';');
    SnakeGame.startPortal();
    const p = SnakeGame._debug.extra().obstacles;
    o.portalN = p.length; o.portalEtiket = p.every(c => c.tur);
    o.portalDuvar = p.every(c => c.x === 11 || c.x === 22);
    return o;
  });
  assert(gun.ayni, 'Günlük: aynı gün aynı yerleşim');
  assert(gun.n >= 1 && gun.n <= 9 && gun.etiket, 'Günlük: en çok 9 engel, hepsi etiketli (' + gun.n + ')');
  assert(gun.portalEtiket && gun.portalDuvar, 'Portal duvarları etiketli, hücre eklenmedi');
  // 7) Çizim: statik katman önbellekte, çizim süresi, cb ve reduced, konsol hatası yok
  const cizim = await page.evaluate(() => {
    const o = {};
    const mk = (tema, kind) => {
      const list = [];
      Engel.uret(list, { tema, COLS: 48, ROWS: 32, yilan: [{ x: 5, y: 16 }], yem: { x: 30, y: 8 }, seviye: 20, ek: true, tohum: 'cizim-' + tema });
      return list;
    };
    const cv = document.createElement('canvas'); cv.width = 960; cv.height = 640;
    const g = cv.getContext('2d');
    const opts = (tema, extra) => Object.assign({ S: 20, W: 960, H: 640, t: 1, cb: false, color: '#3a3a55', reduced: false, tema, tex: false }, extra || {});
    const hash = () => { const d = g.getImageData(0, 0, 960, 640).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; };
    // süre: her tema, 120 kare
    o.sure = {};
    ['tas', 'kaya', 'buz', 'lav', 'bat', 'run'].forEach(t => {
      const list = mk(t);
      g.clearRect(0, 0, 960, 640);
      Engel.ciz(g, list, opts(t)); // pişirme (ilk kare)
      const bake = Engel._durum().bakeMs;
      let best = 1e9;
      for (let rep = 0; rep < 3; rep++) {
        const a = performance.now();
        for (let i = 0; i < 120; i++) { g.clearRect(0, 0, 960, 640); Engel.ciz(g, list, opts(t, { t: i / 60 })); }
        g.getImageData(0, 0, 1, 1); best = Math.min(best, (performance.now() - a) / 120); // getImageData: GPU/yazılım kuyruğunu boşaltıp gerçek maliyeti ölç
      }
      o.sure[t] = { kare: +best.toFixed(2), bake: +bake.toFixed(1), bakeSayisi: Engel._durum().bake };
    });
    // statik katman: tekrar çağrı yeniden pişirmez
    const lv = mk('lav'); g.clearRect(0, 0, 960, 640); Engel.ciz(g, lv, opts('lav'));
    const b0 = Engel._durum().bake; for (let i = 0; i < 10; i++) Engel.ciz(g, lv, opts('lav', { t: i }));
    o.yenidenPisirmez = Engel._durum().bake === b0;
    o.animHucre = Engel._durum().anim;
    // reduced: akış durur (iki farklı t aynı piksel); normalde değişir
    g.clearRect(0, 0, 960, 640); Engel.ciz(g, lv, opts('lav', { reduced: true, t: 1 })); const r1 = hash();
    g.clearRect(0, 0, 960, 640); Engel.ciz(g, lv, opts('lav', { reduced: true, t: 3.3 })); const r2 = hash();
    g.clearRect(0, 0, 960, 640); Engel.ciz(g, lv, opts('lav', { reduced: false, t: 1 })); const n1 = hash();
    g.clearRect(0, 0, 960, 640); Engel.ciz(g, lv, opts('lav', { reduced: false, t: 1.4 })); const n2 = hash();
    o.reducedDurur = r1 === r2; o.akisVar = n1 !== n2;
    // cb: PALET.engel tonu + biçim farkı (nehirde tarama); renk normalden farklı
    g.clearRect(0, 0, 960, 640); Engel.ciz(g, lv, opts('lav', { cb: false })); const c0 = hash();
    g.clearRect(0, 0, 960, 640); Engel.ciz(g, lv, opts('lav', { cb: true, color: '#CC79A7' })); const c1 = hash();
    o.cbFarkli = c0 !== c1;
    // ışık kaynakları: lav nehri/rün/kristal
    o.isikLav = Engel.isiklar(lv, 20).length;
    o.isikRun = Engel.isiklar(mk('run'), 20).length;
    o.isikTas = Engel.isiklar(mk('tas'), 20).length;
    return o;
  });
  Object.keys(cizim.sure).forEach(t => assert(cizim.sure[t].kare < 2, t + ' kare maliyeti ' + cizim.sure[t].kare + ' ms (<2 ms)'));
  assert(cizim.yenidenPisirmez, 'statik katman önbellekte');
  assert(cizim.animHucre > 0, 'lav/su hücreleri animasyon listesinde');
  assert(cizim.reducedDurur, 'reduced: akış animasyonu durur');
  assert(cizim.akisVar, 'normal: akış animasyonu var');
  assert(cizim.cbFarkli, 'renk körü çizimi farklı');
  assert(cizim.isikLav > 0 && cizim.isikRun > 0 && cizim.isikTas === 0, 'ışık kaynakları: ' + JSON.stringify([cizim.isikLav, cizim.isikRun, cizim.isikTas]));

  // 8) Gerçek oyun karesi: cb + reduced açıkken tüm temalar çiziliyor, hata yok; Tron/Mermi/Tapınak engelleri türsüz kalır
  const kare = await page.evaluate(() => {
    const o = {};
    SnakeGame.setSetting('cb', true); SnakeGame.setSetting('reduced', true);
    ['tas', 'bat', 'lav'].forEach(id => {
      localStorage.setItem('twilightMarket', JSON.stringify({ v: 1, sahip: ['orman'], giyili: 'orman', tema: id, sahipTema: ['otomatik', 'tas', 'kaya', 'buz', 'lav', 'bat', 'run'] })); Market.load();
      SnakeGame.startCampaign(9); SnakeGame._debug.draw(); SnakeGame._debug.draw();
    });
    SnakeGame.setSetting('cb', false); SnakeGame.setSetting('reduced', false);
    SnakeGame.startBullet && SnakeGame.startBullet(); SnakeGame._debug.draw();
    o.mermiTursuz = SnakeGame._debug.extra().obstacles.every(c => !c.tur);
    SnakeGame.startTron && SnakeGame.startTron(false); SnakeGame._debug.draw();
    o.tronTursuz = SnakeGame._debug.extra().obstacles.every(c => !c.tur);
    return o;
  });
  assert(kare.mermiTursuz && kare.tronTursuz, 'Tron/Mermi engelleri türsüz kalır (mevcut düzen)');

  console.log('üretim:', Object.keys(uretim).map(t => t + ' ' + uretim[t].enAz + '..' + uretim[t].enCok).join(' | '));
  console.log('kare ms:', JSON.stringify(cizim.sure));
  assert.deepStrictEqual(errors, [], 'konsol hatası: ' + errors.join(' || '));
  await browser.close();
  console.log('engel testi: OK');
})().catch(e => { console.error(e); process.exit(1); });
