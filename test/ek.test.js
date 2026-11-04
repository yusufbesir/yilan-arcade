// Ek özellikler (geri alınabilir): her biri Ayarlar'dan kapanır; kapalıyken eski davranış
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
  await page.waitForTimeout(300);
  const r = {};
  // Ayarlar: ek satırları çizilir, anahtar kapanır/açılır ve saklanır
  await page.evaluate(() => SnakeGame.openSettings());
  r.satir = await page.evaluate(() => document.querySelectorAll('#ekRows .toggle').length);
  assert.ok(r.satir >= 1, 'ek satırları çizilmedi');
  await page.click('#ek_donus');
  r.kapali = await page.evaluate(() => SnakeGame.getSettings().ek.donus === false && document.getElementById('ek_donus').textContent === 'KAPALI');
  await page.click('#ek_donus');
  r.acik = await page.evaluate(() => SnakeGame.getSettings().ek.donus !== false);
  await page.evaluate(() => SnakeGame.closeSettings());
  // Dönüş tamponu: tek tikte iki tuş -> ikisi de uygulanır
  await page.click('[data-act=startClassic]');
  await page.waitForTimeout(200);
  const tampon = await page.evaluate(() => {
    const d = SnakeGame._debug, st = d.get().state;
    const key = k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    key('ArrowUp'); key('ArrowLeft');
    d.tick(); const d1 = { ...d.get().dir };
    d.tick(); const d2 = { ...d.get().dir };
    return { d1, d2 };
  });
  assert.deepStrictEqual(tampon.d1, { x: 0, y: -1 }, 'ilk dönüş yukarı olmalı');
  assert.deepStrictEqual(tampon.d2, { x: -1, y: 0 }, 'ikinci dönüş (tampon) sola uygulanmalı');

  // Ortak yardımcı: modu başlat (sayfa yenilenir), elle tik atılır
  const baslat = async (act) => {
    await page.goto('file://' + path.resolve(__dirname, '../src/index.html') + '?test=1');
    await page.waitForTimeout(250);
    await page.evaluate(a => { if (a === 'startCampaign') SnakeGame.startCampaign(1); else document.querySelector('[data-act=' + a + ']').click(); }, act);
    await page.waitForTimeout(120);
    await page.evaluate(() => { window.T = () => { const st = SnakeGame._debug.get().state; st.paused = false; SnakeGame._debug.tick(); st.paused = true; }; window.T(); });
  };
  // yemi baş yönünün önüne koy ve tik at
  const yemTik = () => page.evaluate(() => {
    const d = SnakeGame._debug, g = d.get(); const h = g.snake[0];
    d.extra().food.x = h.x + g.nextDir.x; d.extra().food.y = h.y + g.nextDir.y; d.extra().food.type = 'normal';
    const once = d.get().state.score; T(); return d.get().state.score - once;
  });
  // 1) Rekor ışıltısı
  await baslat('startClassic');
  r.rekor = await page.evaluate(() => {
    const d = SnakeGame._debug; d.extra().records.classic = 1; d.get().state.score = 1;
    const h = d.get().snake[0], f = d.extra().food; f.x = h.x + 1; f.y = h.y; f.type = 'normal';
    T(); return d.extra().banner.text;
  });
  assert.ok(/REKOR/.test(r.rekor), 'rekor afişi yok: ' + r.rekor);
  // 2) Klasik zamanlı bonus yem: 5. yemde belirir, yenince 5+ puan
  await baslat('startClassic');
  r.zbonus = await page.evaluate(() => {
    const d = SnakeGame._debug; d.get().state.yemSay = 4;
    const h = d.get().snake[0], f = d.extra().food; f.x = h.x + 1; f.y = h.y; f.type = 'normal';
    T(); const e = d.get().state.ekYem; if (!e) return null;
    const x0 = d.get().state.score, hd = d.get().snake[0];
    e.x = hd.x + d.get().dir.x; e.y = hd.y + d.get().dir.y; e.left = 56; T();
    return { tur: e.tur, puan: d.get().state.score - x0, kalan: d.get().state.ekYem };
  });
  assert.ok(r.zbonus && r.zbonus.tur === 'bonus' && r.zbonus.puan >= 5 && !r.zbonus.kalan, 'bonus yem çalışmadı: ' + JSON.stringify(r.zbonus));
  // Kapalıyken bonus yem çıkmaz
  await baslat('startClassic');
  r.zbonusKapali = await page.evaluate(() => {
    SnakeGame.setSetting('ek', { zbonus: false });
    const d = SnakeGame._debug; d.get().state.yemSay = 4;
    const h = d.get().snake[0], f = d.extra().food; f.x = h.x + 1; f.y = h.y; f.type = 'normal';
    T(); const k = d.get().state.ekYem; SnakeGame.setSetting('ek', {}); return k;
  });
  assert.strictEqual(r.zbonusKapali, null, 'kapalıyken bonus yem çıktı');
  // 3) Zamana Karşı seri yem: 3 art arda yem +1 sn
  await baslat('startTimeAttack');
  const t0 = await page.evaluate(() => SnakeGame._debug.get().state.timeLeft);
  for (let i = 0; i < 3; i++) await yemTik();
  r.zseri = await page.evaluate(t0 => SnakeGame._debug.get().state.timeLeft - t0, t0);
  assert.ok(r.zseri > 6.5, 'seri +1 sn gelmedi: ' + r.zseri);
  // 4) Günlük kıvrım bonusu: son 3 yön farklıysa x2
  await baslat('startDaily');
  r.kivrim = await page.evaluate(() => {
    const d = SnakeGame._debug; d.get().state.yonler = [{ x: 0, y: -1 }, { x: -1, y: 0 }];
    const h = d.get().snake[0], f = d.extra().food; f.x = h.x + 1; f.y = h.y; f.type = 'normal';
    const s0 = d.get().state.score; T(); return d.get().state.score - s0;
  });
  assert.strictEqual(r.kivrim, 2, 'kıvrım x2 yok: ' + r.kivrim);
  // 5) Kaos çekim yemi
  await baslat('startChaos');
  r.cekim = await page.evaluate(() => {
    const d = SnakeGame._debug, h = d.get().snake[0], g = d.get();
    g.state.ekYem = { x: h.x + 1, y: h.y, tur: 'cekim', left: 50, max: 70 };
    T(); return d.get().state.cekimLeft;
  });
  assert.ok(r.cekim > 0, 'çekim yemi etkisiz');
  // 6) Mermi Manyağı sıyrılma zinciri: aynı tikte iki sıyrılma 1+2 = 3
  await baslat('startBullet');
  r.siyrilma = await page.evaluate(() => {
    const d = SnakeGame._debug, g = d.get(), h = g.snake[0];
    g.bullets.length = 0;
    g.bullets.push({ x: h.x + 1.5, y: h.y + 1.5, dx: 0, dy: 0, homing: false, color: '#f00', grazed: false });
    g.bullets.push({ x: h.x + 1.5, y: h.y - 1.5, dx: 0, dy: 0, homing: false, color: '#f00', grazed: false });
    g.state.waveHit = false; const s0 = g.state.score; T(); return d.get().state.score - s0;
  });
  assert.ok(r.siyrilma >= 3, 'sıyrılma zinciri yok: ' + r.siyrilma);
  // 7) Tron iz boşluğu
  await baslat('startTron');
  r.tizbos = await page.evaluate(() => {
    const d = SnakeGame._debug, t = d.extra().tron, g = d.get();
    for (let i = 0; i < 7; i++) { g.snake.push({ x: 1, y: 1 + i }); t.ai.push({ x: 46, y: 1 + i }); }
    t.gapN = 29; T(); return t.gaps.size;
  });
  assert.ok(r.tizbos >= 2, 'iz boşluğu açılmadı');

  // 8) Kuyruk Silahı av payı: 3. vuruşta halka geri gelir
  await baslat('startTailgun');
  r.avpayi = await page.evaluate(() => {
    const d = SnakeGame._debug, g = d.get(), h = g.snake[0];
    g.state.avSay = 2; g.enemies.length = 0;
    g.enemies.push({ x: h.x + 2, y: h.y, hp: 1, max: 1 });
    g.playerShots.length = 0; g.playerShots.push({ x: h.x + 1.2, y: h.y, dx: 1, dy: 0 });
    const n0 = d.get().snake.length; T(); return d.get().snake.length - n0;
  });
  assert.ok(r.avpayi >= 1, 'av payı halkası gelmedi: ' + r.avpayi);
  // 9) Survivor: gövde dikeni + elit sandık
  await baslat('startSurvivor');
  r.diken = await page.evaluate(() => {
    const d = SnakeGame._debug, g = d.get();
    for (let i = 0; i < 6; i++) g.snake.push({ x: g.snake[0].x - 3 - i, y: g.snake[0].y });
    g.enemies.length = 0; const b = g.snake[5];
    g.enemies.push({ x: b.x, y: b.y, hp: 1, max: 1, spd: 0 });
    T(); return d.get().enemies.length === 0 || d.get().enemies[0].hp < 1;
  });
  assert.ok(r.diken, 'gövde dikeni hasar vermedi');
  r.elit = await page.evaluate(() => {
    const d = SnakeGame._debug, g = d.get(), h = g.snake[0];
    g.state.svKill = 19; g.enemies.length = 0; g.gems.length = 0;
    g.enemies.push({ x: h.x + 4, y: h.y, hp: 1, max: 1 });
    g.playerShots.length = 0; g.playerShots.push({ x: h.x + 3.2, y: h.y, dx: 1, dy: 0, dmg: 5 });
    T(); return d.get().gems.some(x => x.elit) || d.get().state.svKill >= 20;
  });
  assert.ok(r.elit, 'elit sandık düşmedi');
  // 10) Portal soğuyan portal
  await baslat('startPortal');
  r.soguyan = await page.evaluate(() => {
    const d = SnakeGame._debug, ex = d.extra(), h = d.get().snake[0];
    ex.portals.length = 0; ex.portals.push({ a: { x: h.x + 1, y: h.y }, b: { x: 30, y: 3 }, color: '#f90', cool: 0 });
    T(); const p = ex.portals[0]; return p.cool;
  });
  assert.ok(r.soguyan > 0, 'portal soğumaya girmedi: ' + r.soguyan);
  // 11) Bölüm süre yıldızı: hızlı bitiriş +1
  await baslat('startCampaign');
  r.par = await page.evaluate(() => {
    const d = SnakeGame._debug, g = d.get();
    g.state.bolumTik = 1; g.state.score = g.state.target - 1;
    const h = g.snake[0], f = d.extra().food; f.x = h.x + 1; f.y = h.y; f.type = 'normal';
    T(); return document.getElementById('levelEndScore').textContent + '|' + document.getElementById('starsDisplay').getAttribute('aria-label');
  });
  assert.ok(/hızlı bitiriş/.test(r.par), 'hızlı bitiriş yok: ' + r.par);
  // 12) Güç halkası: güç aktifken çizim hatasız, kapalıyken de
  await baslat('startClassic');
  r.guc = await page.evaluate(() => {
    const d = SnakeGame._debug; d.power('shield'); d.draw();
    SnakeGame.setSetting('ek', { guc: false }); d.draw(); SnakeGame.setSetting('ek', {});
    return Object.keys(d.powers()).length > 0;
  });
  // 13) R ile yeniden dene: oyun sırasında skor sıfırlanır; kapalıyken değişmez
  r.rtekrar = await page.evaluate(() => {
    const d = SnakeGame._debug, st = d.get().state; st.score = 7;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    return d.get().state.score;
  });
  assert.strictEqual(r.rtekrar, 0, 'R yeniden başlatmadı');
  r.rtekrarKapali = await page.evaluate(() => {
    SnakeGame.setSetting('ek', { rtekrar: false });
    const d = SnakeGame._debug, st = d.get().state; st.score = 7;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    const v = d.get().state.score; SnakeGame.setSetting('ek', {}); return v;
  });
  assert.strictEqual(r.rtekrarKapali, 7, 'kapalıyken R yeniden başlattı');
  // 14) Rozetler: varsayılan kapalı, açılınca panelde görünür
  r.rozet0 = await page.evaluate(() => { SnakeGame.openAchievements(); const n = document.querySelectorAll('#achList .rozet-bas').length; SnakeGame.closeAchievements(); return n; });
  assert.strictEqual(r.rozet0, 0, 'rozetler varsayılan kapalı olmalı');
  r.rozet1 = await page.evaluate(() => { SnakeGame.setSetting('ek', { rozet: true }); SnakeGame.openAchievements(); const n = document.querySelectorAll('#achList .rozet-bas').length + document.querySelectorAll('#achList .ach').length; SnakeGame.closeAchievements(); SnakeGame.setSetting('ek', {}); return n; });
  assert.ok(r.rozet1 >= 25, 'rozetler görünmedi: ' + r.rozet1);
  assert.deepStrictEqual(errors, [], 'hata: ' + errors);
  console.log('EK TEST: GECTI', JSON.stringify(r));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
