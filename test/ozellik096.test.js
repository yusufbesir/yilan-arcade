// 0.9.6 özellikleri: Kaos ön uyarısı, kusursuz dalga, Günlük sonuç kopyala, Ragnarök dakikası.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  const o = await page.evaluate(async () => {
    const D = SnakeGame._debug, o = {};
    const S = () => D.get().state, X = () => D.extra();
    const tk = () => { D.godMode(); D.get().snake.forEach((c, i) => { c.x = 10 - i; c.y = 10; }); D.tick(); }; // başı ortada tut: duvara çarpıp tik erken dönmesin

    // ---- 1) Kaos ön uyarısı ----
    SnakeGame.startChaos(); D.godMode();
    const c = X().chaos;
    c.next = 17; tk(); // 16
    o.k_erkenYok = c.pending === null && !X().banner.text.startsWith('YAKINDA');
    tk(); // 15 -> ön uyarı
    const secilen = c.pending;
    o.k_onUyari = !!secilen && X().banner.text === 'YAKINDA: ' + secilen[2] && X().banner.stil === 'soluk' && c.rule === null;
    for (let i = 0; i < 14; i++) tk(); // 1
    o.k_halaYok = c.rule === null;
    tk(); // 0 -> kural gelir
    o.k_ayniKural = c.rule === secilen[0] && c.pending === null && c.left === 70 && c.next === 140 && X().banner.text === secilen[1];
    for (let i = 0; i < 59; i++) tk(); // left 11
    const oncekiBanner = X().banner.text;
    tk(); // left 10 -> bitiyor ipucu
    o.k_bitiyor = c.left === 10 && X().banner.text === secilen[2] + ' BİTİYOR' && X().banner.stil === 'soluk' && oncekiBanner !== X().banner.text;
    for (let i = 0; i < 10; i++) tk();
    o.k_bitti = c.rule === null && X().banner.text === 'KURAL BİTTİ';
    // Günlük: Kaos mantığına hiç girmez; tohumlu yem iki koşuda aynı
    const gunluk = () => { SnakeGame.startDaily(); D.godMode(); const f = { ...X().food }, ob = X().obstacles.length; for (let i = 0; i < 40; i++) { D.tick(); if (S().over) break; } return JSON.stringify([f.x, f.y, f.type, ob, X().chaos.pending, X().chaos.next]); };
    const g1 = gunluk(); SnakeGame.showMenu(); const g2 = gunluk();
    o.k_gunlukAyni = g1 === g2 && JSON.parse(g1)[4] === null && JSON.parse(g1)[5] === 120;
    SnakeGame.showMenu();

    // ---- 2) Kusursuz dalga ----
    SnakeGame.startBullet();
    D.get().bullets.length = 0; S().score = 0;
    D.jump(3); D.tick(); // 2. dalga hasarsız bitti
    o.b_bonus = S().wave === 3 && S().score === 10 && S().kusursuz === 1 && X().banner.text === 'KUSURSUZ! +10' && X().banner.stil === 'altin' && S().waveHit === false;
    // hasar: duvara çarp -> bayrak, sonraki dalgada bonus yok, bayrak sıfırlanır
    D.get().snake[0].x = -2; D.tick();
    o.b_bayrak = S().waveHit === true;
    const skor0 = S().score; D.get().bullets.length = 0;
    D.jump(4); D.tick();
    o.b_iptal = S().score === skor0 && S().kusursuz === 1 && S().waveHit === false && X().banner.text !== 'KUSURSUZ! +15';
    D.get().bullets.length = 0; D.jump(5); D.tick(); // 4. dalga hasarsız -> 20
    o.b_sonraki = S().kusursuz === 2 && S().score === skor0 + 20;
    SnakeGame.showMenu();

    // ---- 3) Günlük sonuç kopyala ----
    const yaz = [];
    const pano = f => Object.defineProperty(navigator, 'clipboard', { value: f, configurable: true });
    pano({ writeText: t => { yaz.push(t); return Promise.resolve(); } });
    SnakeGame.startDaily(); S().score = 37;
    D.get().snake[0].x = -2; D.tick();
    const btn = document.getElementById('copyBtn'), ipucu = document.getElementById('copyHint');
    o.c_gorunur = S().over && btn.style.display !== 'none' && btn.textContent.trim() === 'Sonucu kopyala' && !!btn.querySelector('svg use[href="#i-copy"]');
    o.c_tiklamasiz = yaz.length === 0;
    btn.click(); await new Promise(r => setTimeout(r, 30));
    o.c_metin = yaz.length === 1 && yaz[0] === 'Twilight of the Serpents · Günlük ' + S().dailyKey + ' · Skor 37' && /^Twilight of the Serpents · Günlük \d{4}-\d\d-\d\d · Skor \d+$/.test(yaz[0]) && ipucu.textContent === 'Kopyalandı';
    pano({ writeText: () => Promise.reject(new Error('izin yok')) });
    btn.click(); await new Promise(r => setTimeout(r, 30));
    o.c_red = ipucu.textContent === 'Kopyalanamadı';
    ipucu.textContent = ''; pano({ writeText: () => { throw new Error('sync'); } });
    btn.click(); await new Promise(r => setTimeout(r, 30));
    o.c_atar = ipucu.textContent === 'Kopyalanamadı';
    ipucu.textContent = ''; pano(undefined);
    btn.click(); await new Promise(r => setTimeout(r, 30));
    o.c_panoYok = ipucu.textContent === 'Kopyalanamadı';
    SnakeGame.showMenu();
    SnakeGame.startClassic(); D.get().snake[0].x = -2; D.tick();
    o.c_digerModdaYok = document.getElementById('copyBtn').style.display === 'none' && document.getElementById('copyHint').textContent === '';
    SnakeGame.showMenu();

    // ---- 4) Ragnarök dakikası ----
    const yerCarpan = Tema.carpan;
    SnakeGame.startTimeAttack(); D.godMode();
    const hudT = document.getElementById('hudTarget');
    const ye = () => { const h = D.get().snake[0]; X().food.x = h.x + 1; X().food.y = h.y; X().food.type = 'normal'; const s0 = S().score; D.tick(); return S().score - s0; };
    S().timeLeft = 30; o.r_once = ye() === 1 && !S().ragnarok && !hudT.classList.contains('ragnarok');
    S().timeLeft = 10.05; tk();
    o.r_basladi = S().ragnarok === true && X().banner.text === 'RAGNARÖK! SKOR x2' && hudT.classList.contains('ragnarok');
    o.r_hud = /x2/.test(hudT.textContent) && /sn/.test(hudT.textContent) && !!hudT.querySelector('svg');
    o.r_desen = getComputedStyle(hudT).backgroundImage.includes('repeating-linear-gradient') && getComputedStyle(hudT).color === 'rgb(255, 90, 74)';
    const g = ye(); o.r_x2 = g === 2 && S().timeLeft > 10; // yem süre ekleyip 10 sn üstüne çıksa da sönmez
    tk(); o.r_kalici = S().ragnarok === true;
    Tema.carpan = () => 2; o.r_carpimlar = ye() === 4; Tema.carpan = yerCarpan; // Rün x2 ile çarpılır
    SnakeGame.setSetting('cb', true);
    o.r_cb = document.documentElement.classList.contains('cb') && getComputedStyle(hudT).color === 'rgb(213, 94, 0)' && getComputedStyle(hudT).backgroundImage.includes('repeating-linear-gradient');
    SnakeGame.setSetting('cb', false);
    o.r_nabizVar = getComputedStyle(hudT).animationName === 'ragNabiz';
    SnakeGame.setSetting('reduced', true);
    o.r_reduced = getComputedStyle(hudT).animationName === 'none';
    SnakeGame.setSetting('reduced', false);
    SnakeGame.showMenu(); SnakeGame.startTimeAttack();
    o.r_sifirlandi = S().ragnarok === false && !hudT.classList.contains('ragnarok');
    SnakeGame.showMenu();
    return o;
  });
  await browser.close();
  console.log(JSON.stringify({ ...o, errors }));
  const ok = Object.values(o).every(v => v === true) && errors.length === 0;
  console.log(ok ? 'OZELLIK096 TEST: GECTI' : 'OZELLIK096 TEST: KALDI');
  process.exit(ok ? 0 : 1);
})();
