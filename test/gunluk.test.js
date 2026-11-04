// Senato 16: Günlük mod — dünkü skoru geçme geri bildirimi, reduced ayarı, gün dönümü ve saat dilimi.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  // UTC+3: yerel 00:30'da UTC hâlâ bir önceki gün → toISOString tuzağı burada görünür
  const ctx = await browser.newContext({ timezoneId: 'Europe/Istanbul' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const url = 'file://' + path.resolve(__dirname, '../src/index.html') + '?test=1';
  await page.clock.install({ time: new Date('2026-03-01T00:30:00+03:00') });
  await page.goto(url);
  await page.evaluate(() => localStorage.setItem('pixelSnakeArcade', JSON.stringify({ records: { classic: 0, daily: 9, dailyDate: '2026-02-28', top: {} }, progress: { unlocked: 1, stars: {} }, unlocked: {} })));
  await page.goto(url);
  await page.waitForTimeout(200);
  const out = await page.evaluate(() => {
    const D = SnakeGame._debug, o = {};
    const S = () => D.get().state, X = () => D.extra();
    const hudT = document.getElementById('hudTarget');
    // Saat dilimi: yerel anahtar 03-01, UTC (toISOString) 02-28 — yerel olan kullanılmalı
    o.yerelAnahtar = X().bugun === '2026-03-01' && new Date().toISOString().slice(0, 10) === '2026-02-28';
    // Gün dönümü: 02-28 kaydı (9) dünkü skor oldu, günlük rekor sıfırlandı
    o.dondu = X().records.dailyPrev && X().records.dailyPrev.d === '2026-02-28' && X().records.dailyPrev.s === 9 && X().records.daily === 0 && X().records.dailyDate === '2026-03-01';
    SnakeGame.startDaily();
    o.dunHud = document.getElementById('hudTargetLabel').textContent === 'DÜN' && hudT.textContent === '9' && !hudT.classList.contains('gecildi');
    // Geçme anı: afiş + HUD yeşil; aynı tikteki 'HIZ 3' afişi üstüne yazamaz (9→10 = hız kademesi 3)
    S().score = 9; const h = D.get().snake[0]; X().food.x = h.x + 1; X().food.y = h.y; X().food.type = 'normal'; D.tick();
    o.pacer = S().pacerDone === true && S().score === 10 && S().speedLv === 3;
    o.afis = X().banner.text === 'DÜNKÜ SKORU GEÇTİN!' && X().banner.onemli === true && X().banner.until > performance.now();
    o.hudYesil = hudT.classList.contains('gecildi') && getComputedStyle(hudT).color === 'rgb(0, 255, 102)';
    o.animVar = getComputedStyle(hudT).animationName === 'dunGecildi';
    // Reduced: animasyon yok
    SnakeGame.setSetting('reduced', true);
    o.animYok = document.documentElement.classList.contains('reduced') && getComputedStyle(hudT).animationName === 'none';
    SnakeGame.setSetting('reduced', false);
    return o;
  });
  // Oyun gece yarısını aşarsa: hedef (DÜN) oyunun başladığı güne göre sabit kalır
  await page.clock.setFixedTime(new Date('2026-03-02T00:10:00+03:00'));
  const gece = await page.evaluate(() => {
    const D = SnakeGame._debug, o = {};
    const S = () => D.get().state, X = () => D.extra();
    o.bugunDegisti = X().bugun === '2026-03-02' && S().dailyKey === '2026-03-01';
    o.hedefSabit = X().dunku === 9;
    // Çarpışma ile bitir: rekor (10) başlangıç gününe (03-01) yazılır
    D.get().snake[0].x = -2; D.tick();
    o.bitti = S().over === true && X().records.daily === 10 && X().records.dailyDate === '2026-03-01';
    // Menüye dönünce gün döner: 03-01 → dünkü skor, bugün (03-02) sıfırdan
    SnakeGame.showMenu();
    o.yeniGun = X().records.dailyPrev.d === '2026-03-01' && X().records.dailyPrev.s === 10 && X().records.daily === 0 && X().records.dailyDate === '2026-03-02';
    SnakeGame.startDaily();
    o.yeniHedef = document.getElementById('hudTarget').textContent === '10' && !document.getElementById('hudTarget').classList.contains('gecildi') && S().pacerDone === false;
    SnakeGame.showMenu();
    // Dünkü kayıt yoksa (iki gün önce) DÜN kutusu gösterilmez
    X().records.dailyPrev = { d: '2026-02-27', s: 5 };
    SnakeGame.startDaily();
    o.eskiKayitYok = document.getElementById('hudTargetBox').style.display === 'none' && X().dunku === 0;
    SnakeGame.showMenu();
    return o;
  });
  await browser.close();
  const all = { ...out, ...gece, errors };
  const ok = Object.entries(all).every(([k, v]) => k === 'errors' ? v.length === 0 : v === true);
  console.log(JSON.stringify(all));
  console.log(ok ? 'GUNLUK TEST: GECTI' : 'GUNLUK TEST: KALDI');
  process.exit(ok ? 0 : 1);
})();
