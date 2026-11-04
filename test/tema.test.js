// Tema testi: 6 temalı katalog, kayıt dayanıklılığı, sahiplik/satın alma, Otomatik ve seçili tema,
// kuralların yalnız izinli modlarda etkinliği (Günlük/Taş'ta yok), Lav uyarı->tehlike sırası, Bataklık çamuru,
// Rün çarpanı süresi, Kaya yem puanı, Buzul gecikmesi, Market Temalar bölümü, bütçeler, konsol hatası yok.
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const url = 'file://' + path.resolve(__dirname, '../src/index.html') + '?test=1';

  // ---------------- Bölüm A: mantık (sahte saat: aralıklar kendiliğinden tiklemez) ----------------
  const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.clock.install({ time: new Date('2026-05-05T12:00:00') });
  await page.goto(url);

  // 1) katalog
  const k = await page.evaluate(() => {
    const T = Tema.TEMALAR;
    return {
      ids: T.map(t => t.id), uniq: new Set(T.map(t => t.id)).size,
      hepsi: Tema.hepsi().map(t => t.id),
      fiyat: T.map(t => t.fiyat),
      alanlar: T.every(t => t.ad && t.ozet && typeof t.fiyat === 'number' && t.yem && t.yem.parilti && /^#[0-9a-f]{6}$/i.test(t.yem.renk) && t.muzik && t.muzik.carp > 0 && t.onizle),
      kuralli: T.filter(t => t.kural).map(t => t.id),
      kuralModlari: Tema.KURAL_MODLARI,
      doku: Doku.TUM, isik: Object.keys(Isik.TEMA)
    };
  });
  assert.deepStrictEqual(k.ids, ['tas', 'kaya', 'buz', 'lav', 'bat', 'run']);
  assert.strictEqual(k.uniq, 6);
  assert.deepStrictEqual(k.hepsi, ['otomatik', 'tas', 'kaya', 'buz', 'lav', 'bat', 'run']);
  assert.strictEqual(k.fiyat[0], 0);
  assert.ok(k.fiyat.slice(1).every(f => f >= 300 && f <= 900), 'fiyatlar 300-900 Kül');
  assert.ok(k.alanlar, 'katalog alanları');
  assert.deepStrictEqual(k.kuralli, ['kaya', 'buz', 'lav', 'bat', 'run'], 'Taş kuralsız');
  assert.deepStrictEqual(k.kuralModlari, ['classic', 'campaign', 'timeattack', 'portal']);
  k.ids.forEach(id => { assert.ok(k.doku.includes(id), 'Doku ' + id); assert.ok(k.isik.includes(id), 'Isik ' + id); });

  // 2) kayıt dayanıklılığı (v:1 sürer, eksik alan varsayılan, bilinmeyen değerler silinmez)
  const c = await page.evaluate(() => {
    const o = {};
    const dene = ham => { localStorage.setItem('twilightMarket', ham); Market.load(); return { st: Market.state(), sec: Market.temaSecili() }; };
    o.bozuk = dene('{bozuk');
    o.eski = dene('{"v":1,"sahip":["orman"],"giyili":"orman"}');            // 0.9.3 öncesi kayıt: tema alanı yok
    o.yabanci = dene('{"v":1,"tema":"kis","sahipTema":["lav","kis",7,null]}'); // bilinmeyen tema + sahip olunmayan seçim
    o.sahipli = dene('{"v":1,"tema":"lav","sahipTema":["otomatik","tas","lav"]}');
    o.sahipsiz = dene('{"v":1,"tema":"run","sahipTema":["otomatik","tas"]}');
    Market.temaSec('tas');
    o.kayit = JSON.parse(localStorage.getItem('twilightMarket'));
    dene('{"v":1,"sahip":["orman"],"giyili":"orman"}'); Market.equip('orman');
    o.eskiYazim = JSON.parse(localStorage.getItem('twilightMarket'));
    return o;
  });
  [c.bozuk, c.eski].forEach(r => { assert.strictEqual(r.sec, 'otomatik'); assert.deepStrictEqual(r.st.sahipTema, ['otomatik', 'tas']); assert.strictEqual(r.st.v, 1); });
  assert.strictEqual(c.yabanci.sec, 'otomatik', 'bilinmeyen seçim -> Otomatik');
  assert.deepStrictEqual(c.yabanci.st.sahipTema, ['otomatik', 'tas', 'lav']);
  assert.strictEqual(c.yabanci.st.tema, 'kis', 'ham tema değeri korunur');
  assert.strictEqual(c.sahipli.sec, 'lav');
  assert.strictEqual(c.sahipsiz.sec, 'otomatik', 'sahip olunmayan tema seçilemez');
  assert.strictEqual(c.kayit.v, 1); assert.strictEqual(c.kayit.tema, 'tas');
  assert.deepStrictEqual(c.eskiYazim, { v: 1, sahip: ['orman'], giyili: 'orman' }, 'tema yokken kayıt biçimi aynı');

  // 3) sahiplik / satın alma
  const b = await page.evaluate(() => {
    Miras.reset(); Market.reset();
    const o = {};
    o.baslangic = [Market.temaSahip('tas'), Market.temaSahip('otomatik'), Market.temaSahip('kaya'), Market.temaSecili()];
    o.yetersiz = Market.temaAl('kaya'); o.kul0 = Miras.kul;
    o.secSahipsiz = Market.temaSec('kaya');
    Miras.award({ mode: 'classic', score: 998 }); // 1000 Kül
    o.yeter = [Market.temaYeter('kaya'), Market.temaYeter('run'), Market.temaYeter('tas')];
    o.al = Market.temaAl('kaya'); o.kalan = Miras.kul;
    o.tekrar = Market.temaAl('kaya'); o.kalan2 = Miras.kul;
    o.sec = Market.temaSec('kaya'); o.secili = Market.temaSecili();
    o.yok = Market.temaAl('yok-tema') || Market.temaSec('yok-tema');
    o.bedava = Market.temaAl('tas');
    o.kalici = JSON.parse(localStorage.getItem('twilightMarket'));
    Market.load(); o.yeniden = Market.temaSecili();
    return o;
  });
  assert.deepStrictEqual(b.baslangic, [true, true, false, 'otomatik']);
  assert.strictEqual(b.yetersiz, false); assert.strictEqual(b.kul0, 0); assert.strictEqual(b.secSahipsiz, false);
  assert.deepStrictEqual(b.yeter, [true, true, false]);
  assert.strictEqual(b.al, true); assert.strictEqual(b.kalan, 700);
  assert.strictEqual(b.tekrar, false); assert.strictEqual(b.kalan2, 700, 'tekrar alım Kül düşmemeli');
  assert.strictEqual(b.sec, true); assert.strictEqual(b.secili, 'kaya'); assert.strictEqual(b.yok, false);
  assert.strictEqual(b.bedava, false, 'Taş zaten sahipli');
  assert.deepStrictEqual(b.kalici, { v: 1, sahip: ['orman'], giyili: 'orman', sahipTema: ['otomatik', 'tas', 'kaya'], tema: 'kaya' });
  assert.strictEqual(b.yeniden, 'kaya', 'seçim kalıcı');

  // 4) Otomatik ve seçili tema: görünüm + kural eşlemesi
  const e = await page.evaluate(() => {
    const o = {};
    const sahip = (...ids) => { Miras.reset(); Market.reset(); Miras.award({ mode: 'classic', score: 6000 }); ids.forEach(i => Market.temaAl(i)); };
    sahip();
    o.otoGorunum = [1, 2, 3, 4, 5].map(l => Tema.etkin('campaign', l));
    o.otoKural = [1, 2, 3, 4, 5].map(l => Tema.kuralTemasi('campaign', l));
    o.otoDiger = ['classic', 'timeattack', 'portal', 'daily', 'chaos'].map(m => [Tema.etkin(m), Tema.kuralTemasi(m)]);
    sahip('lav', 'bat'); Market.temaSec('lav');
    o.secBolum = [Tema.etkin('campaign', 1), Tema.etkin('campaign', 2), Tema.kuralTemasi('campaign', 1)];
    const modlar = ['classic', 'campaign', 'timeattack', 'portal', 'daily', 'tron', 'bullet', 'tailgun', 'survivor', 'chaos'];
    o.gorunum = modlar.map(m => Tema.etkin(m, 1));
    o.kural = modlar.map(m => Tema.kuralTemasi(m, 1));
    o.tapinak = Tema.etkin('tapinak', 1);
    Market.temaSec('tas'); o.tas = modlar.map(m => Tema.kuralTemasi(m, 1));
    return o;
  });
  assert.deepStrictEqual(e.otoGorunum, ['tas', 'kaya', 'buz', 'lav', 'tas'], 'Otomatik: mevcut (level-1)%4 döngüsü');
  assert.deepStrictEqual(e.otoKural, [null, 'kaya', 'buz', 'lav', null]);
  assert.deepStrictEqual(e.otoDiger.map(x => x[0]), ['tas', 'buz', 'buz', 'tas', 'lav'], 'Otomatik: diğer modlarda eski görünüm');
  assert.ok(e.otoDiger.every(x => x[1] === null), 'Otomatik: Bölüm dışında kural yok');
  assert.deepStrictEqual(e.secBolum, ['lav', 'lav', 'lav']);
  assert.ok(e.gorunum.every(t => t === 'lav'), 'seçili tema her modda görünür');
  assert.deepStrictEqual(e.kural, ['lav', 'lav', 'lav', 'lav', null, null, null, null, null, null], 'kural yalnız Klasik, Bölüm, Zamana Karşı, Portal');
  assert.strictEqual(e.tapinak, 'tas', 'Tapınak temadan etkilenmez');
  assert.ok(e.tas.every(x => x === null), 'Taş temasında kural yok');

  // 5) oyun içi: Günlük'te ve Taş'ta kural yok; Kaya puanı; Rün çarpanı
  const oyun = await page.evaluate(() => {
    const D = SnakeGame._debug, o = {};
    const kur = (id, baslat) => { Miras.reset(); Market.reset(); Miras.award({ mode: 'classic', score: 6000 }); if (id !== 'tas') Market.temaAl(id); Market.temaSec(id); baslat(); };
    const yemKos = n => { // yılanın önüne yem koy, tikle; n kez
      for (let i = 0; i < n; i++) {
        const h = D.get().snake[0], f = D.extra().food, d = D.get().dir;
        f.x = h.x + d.x; f.y = h.y + d.y; f.type = 'normal'; D.tick();
      }
    };
    kur('kaya', () => SnakeGame.startDaily());
    o.gunlukKural = Tema.aktif(); o.gunlukGorunum = Tema.etkin('daily');
    yemKos(2); o.gunlukPuan = D.get().state.score;
    kur('tas', () => SnakeGame.startClassic());
    o.tasKural = Tema.aktif(); yemKos(2); o.tasPuan = D.get().state.score;
    kur('kaya', () => SnakeGame.startClassic());
    o.kayaKural = Tema.aktif(); o.karanlik = Tema.karanlik(); yemKos(2); o.kayaPuan = D.get().state.score;
    // Rün: başta çarpan 1; yılanı rün hücresine sürünce 2
    kur('run', () => SnakeGame.startClassic());
    o.runBaslangic = Tema.carpan(); D.tick(); // ilk tik: rünler kurulur
    const r = Tema.runeler()[0];
    o.runVar = Tema.runeler().length;
    const sn = D.get().snake;
    sn.forEach((s, i) => { s.x = r.x - 1 - i; s.y = r.y; });
    D.get().dir.x = 1; D.get().dir.y = 0; D.get().nextDir.x = 1; D.get().nextDir.y = 0;
    D.extra().food.x = 0; D.extra().food.y = 0;
    D.tick();
    o.runSonra = Tema.carpan(); o.runKalan = Tema.runKalan();
    const f = D.extra().food, h2 = D.get().snake[0], dd = D.get().dir, once = D.get().state.score;
    f.x = h2.x + dd.x; f.y = h2.y + dd.y; f.type = 'normal'; D.tick();
    o.runPuan = D.get().state.score - once;
    return o;
  });
  assert.strictEqual(oyun.gunlukKural, null, 'Günlük: kural yok');
  assert.strictEqual(oyun.gunlukGorunum, 'kaya', 'Günlük: yalnız görsel');
  assert.strictEqual(oyun.gunlukPuan, 2, 'Günlük: puan sade');
  assert.strictEqual(oyun.tasKural, null); assert.strictEqual(oyun.tasPuan, 2);
  assert.strictEqual(oyun.kayaKural, 'kaya'); assert.strictEqual(oyun.karanlik, 1);
  assert.strictEqual(oyun.kayaPuan, 3, 'Kaya: 2 yem = 3 puan (+%50)');
  assert.strictEqual(oyun.runBaslangic, 1); assert.strictEqual(oyun.runVar, 3);
  assert.strictEqual(oyun.runSonra, 2, 'rün hücresi çarpanı açar');
  assert.ok(oyun.runKalan > 4000 && oyun.runKalan <= 5000, 'rün kalan süre ~5 sn: ' + oyun.runKalan);
  assert.strictEqual(oyun.runPuan, 2, 'çarpan açıkken yem x2');

  // 6) Rün çarpanı süresi (saf mantık): tam 5 sn
  const rs = await page.evaluate(() => {
    Miras.reset(); Market.reset(); Miras.award({ mode: 'classic', score: 6000 }); Market.temaAl('run'); Market.temaSec('run');
    Tema.baslat('classic', 1);
    const env = { COLS: 48, ROWS: 32, bos: () => true, rand: Math.random, bas: { x: 2, y: 2 }, yon: { x: 1, y: 0 } };
    Tema.adim(0, env);
    const r = Tema.runeler()[0];
    env.bas = { x: r.x, y: r.y }; const ev = Tema.adim(100, env); env.bas = { x: 0, y: 0 };
    const o = { olay: ev, a: Tema.carpan(), yenisi: Tema.runeler().length };
    for (let t = 0; t < 4800; t += 100) Tema.adim(100, env);
    o.d48 = Tema.carpan();
    for (let t = 0; t < 400; t += 100) Tema.adim(100, env);
    o.d52 = Tema.carpan();
    return o;
  });
  assert.deepStrictEqual(rs.olay, ['run']); assert.strictEqual(rs.a, 2); assert.strictEqual(rs.yenisi, 3, 'rün yenilenir');
  assert.strictEqual(rs.d48, 2, '4.8 sn: hâlâ x2'); assert.strictEqual(rs.d52, 1, '5.2 sn: bitti');

  // 7) Lav: bekle -> uyarı -> tehlike -> bekle; uyarıda ölüm yok
  const lv = await page.evaluate(() => {
    Miras.reset(); Market.reset(); Miras.award({ mode: 'classic', score: 6000 }); Market.temaAl('lav'); Market.temaSec('lav');
    Tema.baslat('timeattack', 1);
    const env = { COLS: 48, ROWS: 32, bos: () => true, rand: Math.random, bas: { x: 3, y: 16 }, yon: { x: 1, y: 0 } };
    const o = { sira: [] };
    let uyariTehlike = null, yanikTehlike = null, uyariOnce = null;
    for (let ms = 0; ms <= 26000; ms += 100) {
      const ev = Tema.adim(100, env);
      ev.forEach(x => o.sira.push([x, ms]));
      const d = Tema.lavDurum();
      if (d.faz === 'uyari' && uyariTehlike === null) { uyariTehlike = d.hucre.some(h => Tema.tehlike(h.x, h.y)); o.uyariHucre = d.hucre.length; }
      if (d.faz === 'yanik' && yanikTehlike === null) { yanikTehlike = d.hucre.every(h => Tema.tehlike(h.x, h.y)); const h0 = d.hucre[0]; Tema.vurdu(); o.vurduktanSonra = Tema.tehlike(h0.x, h0.y); }
      if (d.faz === 'bekle' && ms < 8000 && uyariOnce === null) uyariOnce = d.hucre.length === 0;
    }
    o.uyariTehlike = uyariTehlike; o.yanikTehlike = yanikTehlike; o.uyariOnce = uyariOnce;
    return o;
  });
  const adlar = lv.sira.map(x => x[0]);
  assert.deepStrictEqual(adlar.slice(0, 6), ['uyari', 'yanik', 'sondu', 'uyari', 'yanik', 'sondu'], 'sıra: uyarı -> yanık -> sönme');
  assert.ok(lv.sira[0][1] >= 8000 && lv.sira[0][1] <= 9000, 'ilk uyarı ~8.5 sn: ' + lv.sira[0][1]);
  assert.ok(lv.sira[3][1] - lv.sira[0][1] >= 11500 && lv.sira[3][1] - lv.sira[0][1] <= 12500, 'döngü ~12 sn');
  assert.ok(lv.sira[1][1] - lv.sira[0][1] >= 1900 && lv.sira[1][1] - lv.sira[0][1] <= 2100, 'uyarı ~2 sn belirgin');
  assert.strictEqual(lv.uyariTehlike, false, 'uyarı sırasında hücre öldürmez');
  assert.strictEqual(lv.yanikTehlike, true, 'yanışta tehlike');
  assert.ok(lv.uyariHucre >= 4, 'birkaç hücre');
  assert.strictEqual(lv.vurduktanSonra, false, 'aynı yanış iki kez vurmaz');
  assert.strictEqual(lv.uyariOnce, true);

  // oyunda lav: uyarı hücresinden geçen yaşar, yanan hücreye giren (kalkansız, tek can) ölür
  const lo = await page.evaluate(() => {
    const D = SnakeGame._debug, o = {};
    const hazir = () => {
      Miras.reset(); Market.reset(); Miras.award({ mode: 'classic', score: 6000 }); Market.temaAl('lav'); Market.temaSec('lav');
      SnakeGame.startClassic(); D.tick();
    };
    const hucreyeSur = h => {
      D.get().snake.forEach((c, i) => { c.x = h.x - 1 - i; c.y = h.y; });
      D.get().dir.x = 1; D.get().dir.y = 0; D.get().nextDir.x = 1; D.get().nextDir.y = 0;
      D.extra().food.x = 1; D.extra().food.y = 1;
    };
    const env = { COLS: 48, ROWS: 32, bos: () => true, rand: Math.random, bas: { x: 40, y: 3 }, yon: { x: 1, y: 0 } };
    hazir();
    while (Tema.lavDurum().faz !== 'uyari') Tema.adim(100, env);
    let h = Tema.lavDurum().hucre[0];
    hucreyeSur(h); D.tick();
    o.uyaridaYasar = !D.get().state.over && D.get().snake[0].x === h.x;
    hazir();
    while (Tema.lavDurum().faz !== 'yanik') Tema.adim(100, env);
    h = Tema.lavDurum().hucre[0];
    hucreyeSur(h); D.tick();
    o.yanikOldu = D.get().state.over;
    return o;
  });
  assert.strictEqual(lo.uyaridaYasar, true, 'uyarı hücresinden geçen yaşar');
  assert.strictEqual(lo.yanikOldu, true, 'yanan hücreye giren yılan ölür');

  // 8) Bataklık: çamur yavaşlatır, çürük yem seyrek
  const bt = await page.evaluate(() => {
    const D = SnakeGame._debug, o = {};
    Miras.reset(); Market.reset(); Miras.award({ mode: 'classic', score: 6000 }); Market.temaAl('bat'); Market.temaSec('bat');
    SnakeGame.startClassic(); D.tick();
    const cm = Tema.camurlar();
    o.camurSayisi = cm.length;
    const sur = (x, y) => {
      D.get().snake.forEach((c, i) => { c.x = x - 1 - i; c.y = y; });
      D.get().dir.x = 1; D.get().dir.y = 0; D.get().nextDir.x = 1; D.get().nextDir.y = 0;
      D.extra().food.x = 1; D.extra().food.y = 1;
    };
    o.hizOnce = D.extra().effSpeed;
    sur(cm[0].x, cm[0].y); D.tick(); // baş çamur hücresine girer
    o.camurdaBas = Tema.camurMu(D.get().snake[0].x, D.get().snake[0].y);
    o.camurHiz = D.extra().effSpeed; o.camurCarpan = D.extra().tmHiz;
    let bos = null;
    for (let x = 3; x < 44 && !bos; x++) for (let y = 3; y < 29 && !bos; y++) if (!Tema.camurMu(x, y) && !Tema.camurMu(x + 1, y)) bos = { x, y };
    sur(bos.x, bos.y); D.tick();
    o.cikincaCarpan = D.extra().tmHiz; o.cikincaHiz = D.extra().effSpeed;
    o.curuk = Tema.curukOran();
    return o;
  });
  assert.ok(bt.camurSayisi >= 12, 'çamur hücreleri: ' + bt.camurSayisi);
  assert.strictEqual(bt.camurdaBas, true);
  assert.strictEqual(bt.camurCarpan, 1.8, 'çamurda yavaşlama çarpanı');
  assert.ok(bt.camurHiz > bt.hizOnce * 1.5, 'tik aralığı uzar: ' + bt.hizOnce + ' -> ' + bt.camurHiz);
  assert.strictEqual(bt.cikincaCarpan, 1, 'çamurdan çıkınca normal hız'); assert.strictEqual(bt.cikincaHiz, bt.hizOnce);
  assert.ok(bt.curuk > 0 && bt.curuk < 0.15, 'çürük yem Kaos\'un %15\'inden seyrek');

  // 9) Buzul: dönüş bir tik gecikir; Taş'ta anında
  const bz = await page.evaluate(() => {
    const D = SnakeGame._debug, o = {};
    const dene = id => {
      Miras.reset(); Market.reset(); Miras.award({ mode: 'classic', score: 6000 }); if (id !== 'tas') Market.temaAl(id); Market.temaSec(id);
      SnakeGame.startClassic();
      D.get().snake.forEach((c, i) => { c.x = 10 - i; c.y = 16; });
      D.get().dir.x = 1; D.get().dir.y = 0; D.extra().food.x = 1; D.extra().food.y = 1;
      D.get().nextDir.x = 0; D.get().nextDir.y = 1;
      D.tick(); const a = { ...D.get().snake[0] };
      D.tick(); const b2 = { ...D.get().snake[0] };
      return [a, b2];
    };
    o.buz = dene('buz'); o.tas = dene('tas');
    return o;
  });
  assert.deepStrictEqual(bz.tas[0], { x: 10, y: 17 }, 'Taş: dönüş anında');
  assert.deepStrictEqual(bz.buz[0], { x: 11, y: 16 }, 'Buzul: ilk tik eski yönde kayar');
  assert.deepStrictEqual(bz.buz[1], { x: 11, y: 17 }, 'Buzul: ikinci tikte döner');

  // 10) Tema afişi sıraya girer; Otomatik + Klasik'te afiş yok (eski oyun)
  const af = await page.evaluate(() => {
    const D = SnakeGame._debug, o = {};
    Miras.reset(); Market.reset(); Miras.award({ mode: 'classic', score: 6000 }); Market.temaAl('buz'); Market.temaSec('buz');
    SnakeGame.startClassic();
    o.bekle = D.extra().banner.text;
    Miras.reset(); Market.reset(); SnakeGame.startClassic(); o.otoBekle = D.extra().banner.text;
    return o;
  });
  assert.ok(/BUZUL/.test(af.bekle), 'tema adı afişte: ' + af.bekle);
  assert.strictEqual(af.otoBekle, '');
  await ctx.close();

  // ---------------- Bölüm B: gerçek saat — çizim, Market sekmesi, bütçe, konsol ----------------
  const ctx2 = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 1100, height: 900 } });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', e => errors.push(String(e)));
  p2.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p2.goto(url);
  await p2.waitForTimeout(800);

  // Afiş gerçekten 2 sn görünür
  const afis = await p2.evaluate(async () => {
    Miras.reset(); Market.reset(); Miras.award({ mode: 'classic', score: 6000 }); Market.temaAl('kaya'); Market.temaSec('kaya');
    SnakeGame.startClassic();
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    await bekle(300);
    const a = SnakeGame._debug.extra().banner;
    const o = { metin: a.text, kalan: a.until - performance.now() };
    await bekle(2400);
    o.sonra = SnakeGame._debug.extra().banner.until < performance.now();
    return o;
  });
  assert.ok(/KAYA MAĞARASI/.test(afis.metin) && afis.kalan > 1200 && afis.kalan <= 2000, 'afiş 2 sn: ' + JSON.stringify(afis));
  assert.ok(afis.sonra, 'afiş kapanır');

  // Market: Temalar sekmesi
  const mk = await p2.evaluate(async () => {
    Miras.reset(); Market.reset(); Miras.award({ mode: 'classic', score: 598 }); // 600 Kül
    SnakeGame.openMarket();
    const o = {};
    o.sekmeler = [...document.querySelectorAll('#marketPanel .mk-sek')].map(b => b.textContent.trim());
    o.skinKart = document.querySelectorAll('#marketList .mk-kart').length;
    document.getElementById('mkSekTema').click();
    o.kart = document.querySelectorAll('#marketList .mk-tema').length;
    o.ad = [...document.querySelectorAll('#marketList .mk-tema .mk-bilgi b')].map(b => b.textContent);
    o.ozet = [...document.querySelectorAll('#marketList .mk-tema .mk-bilgi em')].every(e => e.textContent.length > 8);
    o.canvas = document.querySelectorAll('#marketList canvas.mk-tonizle').length;
    o.dugme = [...document.querySelectorAll('#marketList .mk-tema')].map(a => a.querySelector('button').textContent.trim());
    o.secili = document.querySelector('#marketList .mk-tema.on').dataset.tema;
    const px = document.querySelector('canvas.mk-tonizle[data-tema="kaya"]').getContext('2d').getImageData(10, 10, 1, 1).data;
    o.onizleBoyali = px[3] === 255;
    document.querySelector('[data-act="temaBuy"][data-id="kaya"]').click();
    o.alinca = [Market.temaSecili(), Miras.kul];
    document.querySelector('[data-act="temaSec"][data-id="tas"]').click();
    o.seciTas = Market.temaSecili();
    document.getElementById('mkSekSkin').click();
    o.skinGeri = document.querySelectorAll('#marketList .mk-kart').length;
    return o;
  });
  assert.deepStrictEqual(mk.sekmeler, ['Skinler', 'Temalar']);
  assert.strictEqual(mk.skinKart, 12, 'skin kartları aynı');
  assert.strictEqual(mk.kart, 7); assert.strictEqual(mk.canvas, 7);
  assert.deepStrictEqual(mk.ad, ['Otomatik', 'Taş Avlu', 'Kaya Mağarası', 'Buzul', 'Lav Ocağı', 'Bataklık', 'Rün Tapınağı']);
  assert.ok(mk.ozet, 'kural özeti her kartta');
  assert.strictEqual(mk.dugme[0], 'Seçili'); assert.strictEqual(mk.dugme[1], 'Seç'); assert.ok(/300 Kül/.test(mk.dugme[2]));
  assert.strictEqual(mk.secili, 'otomatik'); assert.ok(mk.onizleBoyali);
  assert.deepStrictEqual(mk.alinca, ['kaya', 300]); assert.strictEqual(mk.seciTas, 'tas'); assert.strictEqual(mk.skinGeri, 12);
  await p2.evaluate(() => SnakeGame.closeMarket());

  // Doku bütçesi: yeni temalar 150 ms/doku altında
  const bu = await p2.evaluate(() => {
    const out = {};
    ['bat', 'run'].forEach(t => {
      let worst = 0, n = 0;
      while (!Doku.ready(t, 2) && n++ < 12) { const a = performance.now(); Doku.pump(t, 2); worst = Math.max(worst, performance.now() - a); }
      out[t] = { ok: Doku.ready(t, 2), ms: Math.round(worst) };
    });
    return out;
  });
  ['bat', 'run'].forEach(t => { assert.ok(bu[t].ok, t + ' doku hazır'); assert.ok(bu[t].ms < 150, t + ' doku ' + bu[t].ms + ' ms'); });

  // 6 tema oyunda çiziliyor; renk körü + hareket azaltılmış ile de hatasız; kare maliyeti
  const ciz = await p2.evaluate(async () => {
    const o = { ok: {}, maliyet: {} };
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    for (const id of ['tas', 'kaya', 'buz', 'lav', 'bat', 'run']) {
      Miras.reset(); Market.reset(); Miras.award({ mode: 'classic', score: 6000 }); if (id !== 'tas') Market.temaAl(id); Market.temaSec(id);
      SnakeGame.startClassic();
      await bekle(900);
      SnakeGame._debug.draw();
      const c = document.getElementById('gameCanvas'), d = c.getContext('2d').getImageData(c.width * 0.45, c.height * 0.25, 60, 60).data;
      let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
      o.ok[id] = s > 0;
      const t0 = performance.now(); for (let i = 0; i < 40; i++) SnakeGame._debug.draw(); o.maliyet[id] = (performance.now() - t0) / 40;
    }
    SnakeGame.setSetting('cb', true); SnakeGame.setSetting('reduced', true);
    for (const id of ['lav', 'bat', 'run']) {
      Miras.reset(); Market.reset(); Miras.award({ mode: 'classic', score: 6000 }); Market.temaAl(id); Market.temaSec(id);
      SnakeGame.startClassic(); await bekle(300);
      for (let i = 0; i < 6; i++) SnakeGame._debug.draw();
    }
    SnakeGame.setSetting('cb', false); SnakeGame.setSetting('reduced', false);
    return o;
  });
  Object.keys(ciz.ok).forEach(t => assert.ok(ciz.ok[t], t + ' çizilmedi'));
  const taban = ciz.maliyet.tas;
  ['kaya', 'bat', 'run'].forEach(t => assert.ok(ciz.maliyet[t] - taban < 3, t + ' ek maliyet ' + (ciz.maliyet[t] - taban).toFixed(2) + ' ms (taban ' + taban.toFixed(2) + ')'));

  await browser.close();
  assert.deepStrictEqual(errors, [], 'konsol hatası: ' + errors.join(' | '));
  console.log('tema.test.js tamam', JSON.stringify({ maliyet: Object.fromEntries(Object.entries(ciz.maliyet).map(([a, v]) => [a, +v.toFixed(2)])), doku: bu }));
})().catch(e => { console.error('tema.test.js BAŞARISIZ', e.message || e); process.exit(1); });
