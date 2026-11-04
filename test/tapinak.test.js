// Tapınak modu: tohumlu üretim, mod başlangıcı, oda geçişi, düşman ölümü (atış + gövde), ödül seçimi,
// boss fazları, kalıcı yetenekler (Atılım/Kırıcı Atış/Kök Anahtarı ile kapalı kapılar), zafer, ölüm + Miras kancası, hata yok.
// Ekran görüntüleri: /tmp/tapinak-*.png (deviceScaleFactor 2)
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  await page.waitForTimeout(300);
  await page.evaluate(() => localStorage.removeItem('twilightTapinak'));
  const shot = async (ad) => { await page.waitForTimeout(250); await page.locator('#gameCanvas').screenshot({ path: '/tmp/tapinak-' + ad + '.png' }); };

  // Sayfa içi yardımcılar: oyun döngüsü test sırasında dondurulur (state.paused), adımlar elle atılır
  const yardimci = () => {
    const R = () => SnakeGame._tapinak.run();
    const ST = () => SnakeGame._debug.get().state;
    window.__T = {
      R, ST,
      tick(n, tanri = true) {
        ST().paused = false;
        const evs = [];
        for (let i = 0; i < n && !ST().over; i++) {
          if (tanri) R().inv = Math.max(R().inv, 2);
          const before = R().ev.length;
          SnakeGame._tapinak.tick();
          evs.push(...(window.__sonOlay || []));
        }
        ST().paused = true;
        return evs;
      },
      yerlestir(x, y, dx, dy, n = 6) {
        const r = R();
        r.snake.length = 0;
        for (let i = 0; i < n; i++) r.snake.push({ x: x - dx * i, y: y - dy * i });
        r.dir = { x: dx, y: dy }; r.want = { x: dx, y: dy };
      },
      temizle() {
        const o = R().odalar[R().oda];
        o.dusmanlar = []; o.dogumlar = []; o.dalga = o.dalgalar.length;
        this.tick(1);
        return o.temiz;
      },
      kapiya(yon) {
        const k0 = R().oda;
        if (yon === 'n') this.yerlestir(23, 2, 0, -1);
        if (yon === 's') this.yerlestir(23, 29, 0, 1);
        if (yon === 'w') this.yerlestir(2, 15, -1, 0);
        if (yon === 'e') this.yerlestir(45, 15, 1, 0);
        this.tick(3);
        return R().oda !== k0 ? R().oda : null;
      },
      dondur() { ST().paused = true; },
      coz() { ST().paused = false; }
    };
  };

  const sonuc = {};

  // 1) Tohumlu üretim: aynı tohum aynı düzen, farklı tohum farklı düzen; 3 düşman türü tanımlı
  sonuc.tohum = await page.evaluate(() => {
    const a = Tapinak.duzen(Tapinak.yeniKosu(7)), b = Tapinak.duzen(Tapinak.yeniKosu(7)), c = Tapinak.duzen(Tapinak.yeniKosu(8));
    return a === b && a !== c && ['kovalayan', 'atici', 'zirhli'].every(k => Tapinak.DUSMANLAR[k]) && Object.keys(Tapinak.ARMAGANLAR).length >= 6;
  });

  // 2) Menüden mod başlar
  await page.locator('.mode-card.tapinak').scrollIntoViewIfNeeded();
  await page.locator('.mode-card.tapinak').screenshot({ path: '/tmp/tapinak-0-kart.png' });
  await page.click('.mode-card.tapinak');
  await page.evaluate(yardimci);
  sonuc.basladi = await page.evaluate(() => {
    __T.dondur();
    const r = __T.R();
    return __T.ST().mode === 'tapinak' && r.oda === '1,2' && r.snake.length >= 6 && document.body.classList.contains('oyun-acik')
      && document.getElementById('menuTapinakHigh') !== null && document.getElementById('fireBtn').style.display === '';
  });
  // Belirli tohumla yeniden başla
  await page.evaluate(() => { SnakeGame.startTapinak(1234); __T.dondur(); });
  await shot('1-giris');

  // 3) Oda geçişi: başlangıç avlusundan kuzey kapısına yürü → savaş odası, kapılar mühürlü
  sonuc.gecis = await page.evaluate(() => {
    const r = __T.R();
    __T.tick(25);
    const o = r.odalar[r.oda];
    return r.oda === '1,1' && o.tur === 'savas' && !o.temiz && document.getElementById('hudLevel').textContent === '2/9';
  });

  // 4) Dalgalar doğar; atışla ve gövde çarpışmasıyla düşman ölümü
  sonuc.savas = await page.evaluate(() => {
    const r = __T.R(), o = r.odalar[r.oda];
    __T.yerlestir(23, 24, 0, -1, 10);
    for (let i = 0; i < 60 && o.dusmanlar.length < 2; i++) { __T.yerlestir(23, 24, 0, -1, 10); __T.tick(1); }
    const turler = new Set(o.dusmanlar.map(e => e.tur));
    // atış: başın 4 önüne düşman, Space mantığı (fire)
    __T.yerlestir(23, 20, 0, -1, 10);
    o.dusmanlar.splice(2);
    const [e1, e2] = o.dusmanlar;
    e1.tur = 'zirhli'; e1.x = 23.5; e1.y = 15.5; e1.hp = 0.5; e1.max = 6;
    e2.x = 8.5; e2.y = 8.5;
    const skor0 = r.skor, ol0 = r.oldurulen, uz0 = r.snake.length;
    __T.coz(); SnakeGame.fire(); __T.dondur();
    const kisaldi = r.snake.length === uz0 - 1 && r.mermiler.length >= 1;
    for (let i = 0; i < 6 && o.dusmanlar.includes(e1); i++) __T.tick(1);
    const atisla = r.oldurulen === ol0 + 1 && r.skor > skor0 && !o.dusmanlar.includes(e1);
    // gövde: düşmanı gövde halkasının yanına koy (baştan uzakta)
    __T.yerlestir(23, 14, 0, -1, 10);
    e2.tur = 'zirhli'; e2.hp = 1; e2.max = 6; e2.x = 22.75; e2.y = 21.5; e2.govdeCd = 0;
    __T.tick(1);
    const govdeyle = !o.dusmanlar.includes(e2) && r.oldurulen === ol0 + 2;
    return { kisaldi, atisla, govdeyle, turSayisi: turler.size, ozler: r.ozler.length > 0 };
  });
  await page.evaluate(() => {
    const r = __T.R(), o = r.odalar[r.oda];
    for (let i = 0; i < 80 && o.dusmanlar.length < 4; i++) { __T.yerlestir(16, 22, 1, 0, 12); __T.tick(1); }
    __T.yerlestir(16, 22, 1, 0, 12);
    o.dusmanlar.forEach((e, i) => { e.x = 10 + i * 6.5; e.y = 9 + (i % 2) * 6; if (e.tur === 'atici') e.sarj = 6; });
    if (o.dusmanlar[1]) o.dusmanlar[1].zehirT = 30;
    __T.tick(1); r.ates && Tapinak.ates(r);
    r.oklar.push({ x: 30, y: 14, dx: -0.2, dy: 0.1, omur: 50, kaynak: 'atici' });
  });
  await shot('2-savas');

  // 5) Temizlenen oda: kapılar açılır, 2 ödül kapısı; yürüyerek birini seç
  sonuc.odul = await page.evaluate(() => {
    const r = __T.R(), o = r.odalar[r.oda];
    const temiz = __T.temizle();
    const kemer = o.kemerler && o.kemerler.length === 2 && o.kemerler[0].id !== o.kemerler[1].id;
    return { temiz, kemer, teklif: o.kemerler && o.kemerler.map(k => k.id) };
  });
  await page.evaluate(() => __T.yerlestir(23, 22, 0, -1, 8));
  await shot('3-odul');
  sonuc.secim = await page.evaluate(() => {
    const r = __T.R(), o = r.odalar[r.oda];
    const id = o.kemerler[0].id;
    const once = { hasar: r.hasar, atisBekleme: r.atisBekleme, canMax: r.canMax, can: r.can, coklu: r.coklu, zehir: r.zehir, kalkanMax: r.kalkanMax, diken: r.diken };
    __T.yerlestir(18, 20, 0, -1);
    __T.tick(3);
    const etki = { hasar: r.hasar > once.hasar, hiz: r.atisBekleme < once.atisBekleme, can: r.canMax > once.canMax || r.can > once.can, coklu: r.coklu > once.coklu, zehir: r.zehir > once.zehir, kalkan: r.kalkanMax > once.kalkanMax, diken: r.diken > once.diken }[id];
    return r.armaganlar.length === 1 && r.armaganlar[0] === id && o.kemerler === null && etki === true;
  });

  // 6) Boss odası: çok fazlı Kül Jarlı; yenilince Atılım sunağı ve çıkış
  sonuc.boss = await page.evaluate(() => {
    const r = __T.R();
    const k = __T.kapiya('n');
    const o = r.odalar[r.oda];
    if (k !== '1,0' || !o.boss) return { k };
    __T.yerlestir(23, 26, 0, -1, 8);
    __T.tick(45);
    const b = o.boss;
    const uyandi = b.uyan === 0;
    b.hp = 35; __T.tick(1); const f2 = b.faz === 2;
    b.hp = 15; __T.tick(1); const f3 = b.faz === 3;
    return { uyandi, f2, f3 };
  });
  await page.evaluate(() => { const r = __T.R(), b = r.odalar[r.oda].boss; b.x = 30; b.y = 12; b.sarj = 12; b.hx = -0.6; b.hy = 0.8; __T.yerlestir(14, 22, 1, 0, 14); });
  await shot('4-boss');
  sonuc.bossYen = await page.evaluate(() => {
    const r = __T.R(), o = r.odalar[r.oda], b = o.boss;
    __T.yerlestir(23, 26, 0, -1, 8);
    b.x = 23.5; b.y = 20.5; b.hp = 1; b.hamle = 0; b.sarj = 0;
    r.atisCd = 0; __T.coz(); SnakeGame.fire(); __T.dondur();
    for (let i = 0; i < 8 && o.boss; i++) { if (o.boss) { o.boss.x = 23.5; o.boss.y = 20.5; o.boss.hamle = 0; o.boss.sarj = 0; } __T.tick(1); }
    return o.boss === null && o.temiz && !!o.sunak && o.sunak.yetenek === 'atilim' && !!o.cikis;
  });
  await page.evaluate(() => __T.yerlestir(23, 24, 0, -1, 8));
  await shot('5-sunak');
  sonuc.atilimKalici = await page.evaluate(() => {
    const r = __T.R();
    __T.yerlestir(23, 19, 0, -1);
    __T.tick(3);
    const d = JSON.parse(localStorage.getItem('twilightTapinak') || '{}');
    return r.yetenek.atilim === true && d.yetenek && d.yetenek.atilim === true && d.yetenek.kirici === false;
  });
  // 7) Zafer: çıkış kapısı → koşu biter (won), Miras kancası çağrılır
  sonuc.zafer = await page.evaluate(() => {
    window.__miras = [];
    window.Miras = { award: o => window.__miras.push(o) };
    __T.yerlestir(23, 9, 0, -1);
    __T.tick(5);
    const st = __T.ST();
    const m = window.__miras[0];
    return st.over && __T.R().kazandi && m && m.mode === 'tapinak' && m.won === true && m.score === st.score
      && document.getElementById('gameoverOverlay').classList.contains('active') && /TAPINAKTAN/.test(document.querySelector('#gameoverOverlay .overlay-title').textContent)
      && SnakeGame._debug.extra().records.tapinak === st.score;
  });

  // 8) Yeni koşu: yetenekler kalır, armağanlar sıfırlanır; Atılım uçurumu aşar → Kırıcı Atış → çatlak duvar → Kök Anahtarı → rün kilidi
  sonuc.metroid = await page.evaluate(() => {
    const kosu0 = SnakeGame._tapinak.meta().kosu;
    SnakeGame.restart();
    __T.dondur();
    const r = __T.R(), o = {};
    o.yeni = r.yetenek.atilim === true && r.yetenek.kirici === false && r.armaganlar.length === 0 && r.can === 3 && SnakeGame._tapinak.meta().kosu === kosu0 + 1;
    window.__kosu = kosu0 + 1;
    o.batı = __T.kapiya('w') === '0,2' && __T.temizle();
    o.kuzey = __T.kapiya('n') === '0,1' && __T.temizle();
    // Atılım olmadan uçuruma girmek zarar verir
    r.yetenek.atilim = false;
    __T.yerlestir(23, 4, 0, -1); r.inv = 0; const can0 = r.can;
    __T.tick(2, false);
    o.ucurumZarar = r.can === can0 - 1 && r.oda === '0,1';
    r.yetenek.atilim = true; r.inv = 0;
    __T.yerlestir(23, 4, 0, -1);
    __T.coz(); SnakeGame._tapinak.atil(); __T.dondur();
    o.atildi = r.oda === '0,0';
    o.gizli = __T.temizle() && r.odalar['0,0'].sunak && r.odalar['0,0'].sunak.yetenek === 'kirici';
    __T.yerlestir(23, 19, 0, -1); __T.tick(3);
    o.kirici = r.yetenek.kirici === true && JSON.parse(localStorage.getItem('twilightTapinak')).yetenek.kirici === true;
    o.donus = __T.kapiya('s') === '0,1' && __T.kapiya('e') === '1,1' && __T.temizle() && __T.kapiya('e') === '2,1' && __T.temizle();
    __T.yerlestir(23, 6, 0, -1, 8); r.atisCd = 0;
    __T.coz(); SnakeGame.fire(); __T.dondur();
    __T.tick(4);
    o.kirildi = Tapinak.hucre(r.odalar['2,1'], 23, 0) === Tapinak.HUCRE.KAPI;
    o.kokSunagi = __T.kapiya('n') === '2,0' && __T.temizle() && r.odalar['2,0'].sunak.yetenek === 'anahtar';
    __T.yerlestir(23, 19, 0, -1); __T.tick(3);
    o.anahtar = r.yetenek.anahtar === true;
    o.geri = __T.kapiya('s') === '2,1' && __T.kapiya('w') === '1,1' && __T.kapiya('s') === '1,2';
    __T.yerlestir(44, 15, 1, 0); __T.tick(6);
    o.kasa = r.oda === '2,2' && !!r.odalar['2,2'].sandik;
    __T.yerlestir(23, 19, 0, -1); const cm = r.canMax; __T.tick(5);
    o.sandik = r.canMax === cm + 1 && r.odalar['2,2'].kemerler && r.odalar['2,2'].kemerler.length === 2;
    return o;
  });
  await page.evaluate(() => __T.yerlestir(23, 23, 0, -1, 7));
  await shot('6-kasa');
  // Klavye: 1 ile armağan seçimi, Space ile ateş, Shift ile atılım
  sonuc.klavye = await page.evaluate(() => { __T.coz(); return true; });
  const r0 = await page.evaluate(() => __T.R().armaganlar.length);
  await page.keyboard.press('1');
  const k1 = await page.evaluate(() => __T.R().armaganlar.length === 1);
  await page.evaluate(() => { __T.yerlestir(23, 22, 0, -1, 10); __T.R().atisCd = 0; __T.R().atilCd = 0; });
  await page.keyboard.press('Space');
  const k2 = await page.evaluate(() => __T.R().mermiler.length > 0 || __T.R().snake.length === 9);
  await page.evaluate(() => __T.yerlestir(23, 22, 0, -1, 10));
  await page.keyboard.press('Shift');
  const k3 = await page.evaluate(() => { __T.dondur(); const h = __T.R().snake[0]; return h.y <= 19; });
  sonuc.klavye = r0 === 0 && k1 && k2 && k3;

  // Mini harita + yetenek göstergeli genel görünüm (kalan savaş odasında)
  await page.evaluate(() => { __T.kapiya('w'); __T.kapiya('w'); __T.kapiya('n'); const r = __T.R(); __T.yerlestir(30, 20, -1, 0, 12); __T.tick(50); __T.yerlestir(30, 20, -1, 0, 12); });
  await shot('7-harita');

  // 9) Ölüm: can biter → koşu biter, armağanlar sıfırlanır ama yetenekler kalır; Miras'a ölüm bildirilir
  sonuc.olum = await page.evaluate(() => {
    SnakeGame.startTapinak(77);
    __T.dondur();
    window.__miras = [];
    const r = __T.R();
    r.can = 1; r.inv = 0; r.kalkan = 0;
    __T.yerlestir(2, 5, -1, 0);
    __T.ST().paused = false;
    SnakeGame._tapinak.tick(); SnakeGame._tapinak.tick();
    const st = __T.ST();
    const m = window.__miras[0];
    const d = JSON.parse(localStorage.getItem('twilightTapinak'));
    window.__olumDbg = { over: st.over, bitti: r.bitti, m, d, kosu: window.__kosu, title: document.querySelector('#gameoverOverlay .overlay-title').textContent };
    return st.over && r.bitti && !r.kazandi && m && m.mode === 'tapinak' && m.won === false
      && /KOŞU BİTTİ/.test(document.querySelector('#gameoverOverlay .overlay-title').textContent)
      && d.yetenek.atilim && d.yetenek.kirici && d.yetenek.anahtar && d.kosu === window.__kosu + 1 && d.zafer === 1;
  });
  if (!sonuc.olum) console.log(JSON.stringify(await page.evaluate(() => window.__olumDbg)));
  // Diğer modlarda başlık geri döner
  sonuc.baslik = await page.evaluate(() => {
    SnakeGame.startClassic();
    const D = SnakeGame._debug; D.get().state.lives = 1;
    for (let i = 0; i < 200 && !D.get().state.over; i++) D.tick();
    return /GAME OVER/.test(document.querySelector('#gameoverOverlay .overlay-title').textContent);
  });
  // Bozuk kayıt: yükleme güvenli
  sonuc.bozukKayit = await page.evaluate(() => {
    const ok = ['{', 'null', '[]', '{"yetenek":"x","kosu":-5}', '{"yetenek":{"atilim":"evet"},"kosu":1e999}'].every(v => {
      localStorage.setItem('twilightTapinak', v);
      const m = Tapinak.yukle();
      return m.yetenek.atilim === false && m.kosu >= 0 && Number.isFinite(m.kosu);
    });
    localStorage.removeItem('twilightTapinak');
    return ok;
  });
  // Uzun koşu duman testi: rastgele yönlendirme + ateş, hata yok
  sonuc.duman = await page.evaluate(() => {
    SnakeGame.startTapinak(4242);
    __T.dondur();
    const r = __T.R(), rnd = Tapinak.mulberry(9);
    r.can = 99; r.canMax = 99;
    for (let i = 0; i < 1500 && !r.bitti; i++) {
      if (rnd() < 0.1) { const d = [[0, 1], [1, 0], [0, -1], [-1, 0]][Math.floor(rnd() * 4)]; SnakeGame.input(d[0], d[1]); }
      if (rnd() < 0.3) { __T.coz(); SnakeGame.fire(); }
      if (r.snake.length < 5) r.snake.push({ ...r.snake[r.snake.length - 1] });
      __T.tick(1, false);
    }
    return r.t > 100;
  });

  console.log(JSON.stringify(sonuc, null, 1), 'hatalar:', errors);
  await browser.close();
  const duz = v => (v && typeof v === 'object') ? Object.values(v).every(x => typeof x === 'number' ? x >= 2 : typeof x === 'string' ? true : Array.isArray(x) ? true : duz(x)) : v === true;
  const ok = duz(sonuc) && errors.length === 0;
  if (!ok) { console.error('BAŞARISIZ'); process.exit(1); }
  console.log('GEÇTİ');
})();
