// Market testi: katalog, kayıt dayanıklılığı, satın alma/giyme, efekt tavanı, reduced/cb, menü öğesi, panel + Escape, konsol hatası.
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');

  // 1) katalog bütünlüğü
  const k = await page.evaluate(() => {
    const S = Market.SKINS, say = {}, ids = new Set();
    let efektler = new Set(), ok = true;
    S.forEach(s => {
      say[s.nadir] = (say[s.nadir] || 0) + 1; ids.add(s.id); efektler.add(s.efekt);
      if (!Market.NADIRLIK[s.nadir] || typeof s.ad !== 'string' || !s.ad || !(s.fiyat >= 0) || !s.efekt) ok = false;
      if (s.id !== 'orman' && (!/^#[0-9a-f]{6}$/i.test(s.ana) || !/^#[0-9a-f]{6}$/i.test(s.ikincil) || !s.desen || !s.goz)) ok = false;
    });
    const aralik = (n, a, b) => S.filter(s => s.nadir === n).every(s => s.fiyat >= a && s.fiyat <= b);
    return { say, n: S.length, uniq: ids.size, ef: efektler.size, ok, bedava: S.filter(s => s.fiyat === 0).map(s => s.id),
      fy: aralik('yaygin', 0, 150) && aralik('nadir', 300, 600) && aralik('epik', 900, 1800) && aralik('efsane', 2500, 6000),
      renk: Object.values(Market.NADIRLIK).map(n => n.renk) };
  });
  assert.strictEqual(k.n, 12); assert.strictEqual(k.uniq, 12); assert.strictEqual(k.ef, 12, 'her skinin efekti farklı');
  assert.deepStrictEqual(k.say, { yaygin: 3, nadir: 4, epik: 3, efsane: 2 });
  assert.ok(k.ok && k.fy, 'katalog alanları/fiyat aralıkları');
  assert.deepStrictEqual(k.bedava, ['orman']);

  // 2) kayıt dayanıklılığı + tema alanı korunur
  const c = await page.evaluate(() => {
    const o = {};
    const dene = ham => { localStorage.setItem('twilightMarket', ham); Market.load(); return Market.state(); };
    o.bozuk = dene('{bozuk');
    o.dizi = dene('[1,2]');
    o.sayi = dene('42');
    o.eksik = dene('{"v":1}');
    o.yabanci = dene('{"v":1,"sahip":["orman","yok-skin",5,null,"buz"],"giyili":"gece"}'); // sahip olunmayan giyili -> varsayılan
    o.gecerli = dene('{"v":1,"sahip":["buz"],"giyili":"buz","tema":"kis"}');
    Market.equip('orman');
    o.tema = JSON.parse(localStorage.getItem('twilightMarket')).tema;
    o.yabanciKorundu = JSON.parse((localStorage.setItem('twilightMarket', '{"v":1,"sahip":["gelecek-skin"],"giyili":"orman"}'), Market.load(), Market.equip('orman'), localStorage.getItem('twilightMarket'))).sahip;
    return o;
  });
  [c.bozuk, c.dizi, c.sayi, c.eksik].forEach(s => { assert.deepStrictEqual(s.sahip, ['orman']); assert.strictEqual(s.giyili, 'orman'); });
  assert.deepStrictEqual(c.yabanci.sahip, ['orman', 'buz']); assert.strictEqual(c.yabanci.giyili, 'orman');
  assert.deepStrictEqual(c.gecerli.sahip, ['orman', 'buz']); assert.strictEqual(c.gecerli.giyili, 'buz');
  assert.strictEqual(c.tema, 'kis', 'tema alanı korunmalı');
  assert.ok(c.yabanciKorundu.includes('gelecek-skin'), 'bilinmeyen kimlik silinmemeli');

  // 3) satın alma / giyme / yetersiz bakiye
  const b = await page.evaluate(() => {
    Miras.reset(); Market.reset();
    const o = {};
    o.yetersiz = Market.buy('kul');                 // 0 Kül
    o.kulAyni = Miras.kul;
    Miras.award({ mode: 'classic', score: 498 });   // 500 Kül
    o.canAfford = [Market.canAfford('kul'), Market.canAfford('buz'), Market.canAfford('gece')];
    o.al = Market.buy('buz');                       // 320
    o.kalan = Miras.kul;
    o.tekrar = Market.buy('buz');                   // zaten var
    o.kalan2 = Miras.kul;
    o.girmeden = Market.equip('kul');               // sahip değil
    o.gir = Market.equip('buz');
    o.giyili = Market.equipped();
    o.yok = Market.buy('yok') || Market.equip('yok');
    o.kalici = JSON.parse(localStorage.getItem('twilightMarket'));
    o.miras = JSON.parse(localStorage.getItem('twilightMiras')).kul;
    o.harca = [Miras.harca(1e9), Miras.harca(-5), Miras.harca(NaN)];
    o.ipucu = Market.affordableNew();
    return o;
  });
  assert.strictEqual(b.yetersiz, false); assert.strictEqual(b.kulAyni, 0);
  assert.deepStrictEqual(b.canAfford, [true, true, false]);
  assert.strictEqual(b.al, true); assert.strictEqual(b.kalan, 180);
  assert.strictEqual(b.tekrar, false); assert.strictEqual(b.kalan2, 180, 'tekrar alım Kül düşmemeli');
  assert.strictEqual(b.girmeden, false); assert.strictEqual(b.gir, true); assert.strictEqual(b.giyili, 'buz');
  assert.strictEqual(b.yok, false);
  assert.deepStrictEqual(b.kalici, { v: 1, sahip: ['orman', 'buz'], giyili: 'buz' });
  assert.strictEqual(b.miras, 180); assert.deepStrictEqual(b.harca, [false, false, false]);
  assert.strictEqual(b.ipucu, true, 'kul (100) alınabilir');

  // 4) efekt: parçacık tavanı, reduced/fx/cb
  const e = await page.evaluate(() => {
    const o = { sayilar: {}, tavan: true, dolu: {} };
    const gov = []; for (let i = 0; i < 20; i++) gov.push({ x: 300 - i * 14, y: 200 + Math.sin(i) * 10 });
    const b = { bas: gov[0], yon: { x: 1, y: 0 }, govde: gov, dt: 0.05, t: 0, uret: true, yogunluk: 1.5 };
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300;
    const g = cv.getContext('2d');
    Market.SKINS.forEach(s => {
      const ef = Market.efektKur(s.id);
      let en = 0;
      for (let i = 0; i < 400; i++) { b.t = i * 0.05; ef.adim(b); ef.ciz(g, b); if (ef.sayi > en) en = ef.sayi; if (ef.sayi > Market.MAX_PARCA) o.tavan = false; }
      o.sayilar[s.id] = en;
    });
    // kapalı durumlar
    const piks = () => { const d = g.getImageData(0, 0, 400, 300).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; };
    const pts = gov.map(p => ({ x: p.x / 20, y: p.y / 20 }));
    Market.equip('kizil'); Market.efektSifirla();
    const dene = ayar => { g.clearRect(0, 0, 400, 300); let sy = 0; for (let i = 0; i < 80; i++) sy = Math.max(sy, Market.efekt(g, Object.assign({ pts, S: 20, t: i * 0.03, aktif: true, cb: false, reduced: false, fx: 1 }, ayar))); return { sy, px: piks() }; };
    o.acik = dene({});
    o.reduced = dene({ reduced: true });
    o.fx0 = dene({ fx: 0 });
    o.cb = dene({ cb: true });
    o.skinNormal = !!Market.skinFor({ cb: false }); o.skinCb = Market.skinFor({ cb: true });
    Market.equip('orman'); o.skinOrman = Market.skinFor({});
    return o;
  });
  Object.keys(e.sayilar).forEach(id => assert.ok(e.sayilar[id] > 0, id + ' parçacık üretmeli'));
  assert.ok(e.tavan, 'parçacık sayısı 40 üstüne çıkmamalı');
  assert.ok(e.acik.sy > 0 && e.acik.px, 'efekt açıkken çizilmeli');
  assert.ok(e.reduced.sy === 0 && !e.reduced.px, 'reduced: efekt yok');
  assert.ok(e.fx0.sy === 0 && !e.fx0.px, 'fx=0: efekt yok');
  assert.ok(e.cb.sy === 0 && !e.cb.px, 'cb: efekt yok');
  assert.ok(e.skinNormal && e.skinCb === null && e.skinOrman === null, 'cb ve Orman Yeşili eski görünüm (null)');

  // 5) oyun içi: skin ile oyun çalışır, Tapınak etkilenmez, cb palet korunur
  const g1 = await page.evaluate(async () => {
    Market.reset(); Miras.reset(); Miras.award({ mode: 'classic', score: 6000 });
    Market.buy('ouroboros'); Market.equip('ouroboros');
    const o = {};
    SnakeGame.startClassic();
    const D = SnakeGame._debug;
    D.grow(10);
    for (let i = 0; i < 6; i++) D.tick();
    await new Promise(r => setTimeout(r, 700));
    o.klasikCalisiyor = !D.get().state.over;
    SnakeGame.setSetting('cb', true);
    await new Promise(r => setTimeout(r, 200));
    o.cbSkin = Market.skinFor({ cb: true });
    SnakeGame.setSetting('cb', false);
    return o;
  });
  assert.ok(g1.klasikCalisiyor); assert.strictEqual(g1.cbSkin, null);
  await page.evaluate(() => { SnakeGame.showMenu && SnakeGame.showMenu(); });

  // 6) menü öğesi ve panel
  await page.reload();
  const m = await page.evaluate(() => {
    const el = document.querySelector('.menu-list .mode-card.market');
    const sirasi = [...document.querySelectorAll('.menu-list .menu-item')].map(x => x.className.split(' ')[1]);
    return { var: !!el, tab: el && el.tabIndex, rol: el && el.getAttribute('role'), act: el && el.dataset.act, sirasi, ikon: !!document.querySelector('#i-gem'), bak: !!document.getElementById('marketInfo') };
  });
  assert.ok(m.var && m.tab === 0 && m.rol === 'button' && m.act === 'openMarket' && m.ikon && m.bak, JSON.stringify(m));
  assert.deepStrictEqual(m.sirasi.slice(3), ['tapinak', 'market', 'miras']);
  await page.evaluate(() => { Miras.reset(); Market.reset(); Miras.award({ mode: 'classic', score: 700 }); });
  await page.focus('.mode-card.market');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const p = await page.evaluate(() => ({
    aktif: document.getElementById('marketPanel').classList.contains('active'),
    kart: document.querySelectorAll('#marketList .mk-kart').length,
    grup: [...document.querySelectorAll('#marketList .mk-grup h3')].map(h => h.textContent),
    kul: document.getElementById('marketKul').textContent,
    odak: document.activeElement && document.activeElement.closest('#marketPanel') !== null,
    onizle: Market.onizlemeSayisi(),
    pasif: [...document.querySelectorAll('#marketList [data-act="marketBuy"]')].filter(x => x.disabled).length,
    giyili: document.querySelectorAll('#marketList .mk-kart.on').length
  }));
  assert.ok(p.aktif && p.kart === 12 && p.odak && p.onizle === 12, JSON.stringify(p));
  assert.deepStrictEqual(p.grup, ['Yaygın', 'Nadir', 'Epik', 'Efsanevi']);
  assert.strictEqual(p.kul, '702'); assert.strictEqual(p.giyili, 1); assert.ok(p.pasif > 0, 'yetersiz Kül düğmesi pasif');
  // tıklayarak satın alma (320): bakiye düşer, giyilir
  await page.click('#marketList [data-act="marketBuy"][data-id="buz"]');
  const q = await page.evaluate(() => ({ kul: Miras.kul, giyili: Market.equipped(), panel: document.getElementById('marketKul').textContent, odak: document.activeElement.closest('#marketPanel') !== null }));
  assert.strictEqual(q.kul, 382); assert.strictEqual(q.giyili, 'buz'); assert.strictEqual(q.panel, '382'); assert.ok(q.odak);
  await page.click('#marketList [data-act="marketEquip"][data-id="orman"]');
  assert.strictEqual(await page.evaluate(() => Market.equipped()), 'orman');
  // Escape kapatır, odak menü öğesine döner
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const r = await page.evaluate(() => ({ aktif: document.getElementById('marketPanel').classList.contains('active'), odak: document.activeElement && document.activeElement.classList.contains('market'), onizle: Market.onizlemeSayisi() }));
  assert.ok(!r.aktif && r.odak && r.onizle === 0, JSON.stringify(r));

  // 7) PUBLIC API
  const api = await page.evaluate(() => ['openMarket', 'closeMarket', 'marketBuy', 'marketEquip'].every(f => typeof SnakeGame[f] === 'function'));
  assert.ok(api);

  // 8) oyun sonu ipucu: bakiye bir kostüme yetiyorsa görünür, yetmiyorsa boş
  const ip = await page.evaluate(() => {
    const o = {};
    const bitir = () => { SnakeGame.startClassic(); const st = SnakeGame._debug.get().state; st.score = 5; st.mirasVerildi = false; SnakeGame._debug.get().state.lives = 1; for (let i = 0; i < 60 && !SnakeGame._debug.get().state.over; i++) SnakeGame._debug.tick(); return document.getElementById('kulMsgMarket').textContent; };
    Miras.reset(); Market.reset(); Miras.award({ mode: 'classic', score: 300 });
    o.yeter = bitir();
    Miras.reset(); Market.reset();
    o.yetmez = bitir();
    return o;
  });
  assert.strictEqual(ip.yeter, "Market'te yeni kostüm alabilirsin"); assert.strictEqual(ip.yetmez, '');

  assert.deepStrictEqual(errors, [], 'konsol hatası: ' + errors.join('|'));
  await browser.close();
  console.log('market.test.js: tamam');
})().catch(e => { console.error(e); process.exit(1); });
