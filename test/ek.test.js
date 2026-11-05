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
  // 15) Kayıt yazılamazsa tek seferlik uyarı (kota dolu simülasyonu)
  await baslat('startClassic');
  r.kayitUyari = await page.evaluate(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new Error('quota'); };
    const d = SnakeGame._debug, g = d.get(), h = g.snake[0];
    d.extra().food.x = h.x + g.nextDir.x; d.extra().food.y = h.y + g.nextDir.y; d.extra().food.type = 'normal';
    T();
    return new Promise(res => setTimeout(() => { Storage.prototype.setItem = orig; res(document.getElementById('toast').textContent); }, 300));
  });
  assert.ok(/Kayıt yazılamadı/.test(r.kayitUyari), 'kayıt uyarısı yok: ' + r.kayitUyari);
  // 16) Ölüm eşiği: duvara çarpacak hamle bir kez bekler, ikincisi (60 tik içinde) öldürür; kapalıyken hemen
  await baslat('startClassic');
  r.esik = await page.evaluate(() => {
    const d = SnakeGame._debug, g = d.get();
    const h = g.snake[0]; h.x = 47; h.y = 5; g.snake[1].x = 46; g.snake[1].y = 5; g.snake[2].x = 45; g.snake[2].y = 5;
    g.dir.x = 1; g.dir.y = 0; g.nextDir.x = 1; g.nextDir.y = 0;
    const l0 = g.state.lives;
    T(); const a = { lives: d.get().state.lives, x: d.get().snake[0].x, over: d.get().state.over };
    T(); const b = { lives: d.get().state.lives, over: d.get().state.over };
    return { l0, a, b };
  });
  assert.ok(r.esik.a.lives === r.esik.l0 && r.esik.a.x === 47, 'eşik ilk hamleyi beklemedi: ' + JSON.stringify(r.esik));
  assert.ok(r.esik.b.lives < r.esik.l0 || r.esik.b.over, 'eşik ikinci hamlede öldürmedi: ' + JSON.stringify(r.esik));
  // 17) Yankı yemi: yem yenince 3 tik sonra yankı belirir, yenince +1
  await baslat('startClassic');
  r.yanki = await page.evaluate(() => {
    const d = SnakeGame._debug, g = d.get(), h = g.snake[0], f = d.extra().food;
    f.x = h.x + g.nextDir.x; f.y = h.y + g.nextDir.y; f.type = 'normal';
    T(); const y = d.get().state.yanki; return y ? { x: y.x, y: y.y, wait: y.wait } : null;
  });
  assert.ok(r.yanki && r.yanki.wait === 3, 'yankı oluşmadı: ' + JSON.stringify(r.yanki));
  r.yankiKapali = await page.evaluate(() => {
    SnakeGame.setSetting('ek', { yanki: false });
    const d = SnakeGame._debug; d.get().state.yanki = null;
    const g = d.get(), h = g.snake[0], f = d.extra().food; f.x = h.x + g.nextDir.x; f.y = h.y + g.nextDir.y; T();
    const v = d.get().state.yanki; SnakeGame.setSetting('ek', {}); return v;
  });
  assert.strictEqual(r.yankiKapali, null, 'kapalıyken yankı oluştu');
  // 18) Kuyruk rengi: yemler sayılır; çizim hatasız
  r.renk = await page.evaluate(() => { const d = SnakeGame._debug; d.draw(); return d.get().state.yemRenk.length; });
  assert.ok(r.renk >= 1, 'yem rengi kaydedilmedi');
  // 19) Renk kapısı: portaldan çıkınca ilk yem x2
  await baslat('startPortal');
  r.kapi = await page.evaluate(() => {
    const d = SnakeGame._debug, ex = d.extra(), g = d.get(), h = g.snake[0];
    ex.portals.length = 0; ex.portals.push({ a: { x: h.x + 1, y: h.y }, b: { x: h.x + 5, y: h.y }, color: '#f90', cool: 0 });
    T(); const kl = d.get().state.kapiLeft;
    const h2 = d.get().snake[0], f = d.extra().food; f.x = h2.x + g.nextDir.x; f.y = h2.y + g.nextDir.y; f.type = 'normal';
    const s0 = d.get().state.score; T(); return { kl, d: d.get().state.score - s0 };
  });
  assert.ok(r.kapi.kl > 0 && r.kapi.d >= 2, 'renk kapısı çalışmadı: ' + JSON.stringify(r.kapi));
  // 20) Kabuk değiştirme: 30 halkada K ile kuyruk 5'e iner, sonraki yem x2
  await baslat('startClassic');
  r.kabuk = await page.evaluate(() => {
    const d = SnakeGame._debug; d.grow(28);
    const g = d.get(), h = g.snake[0], f = d.extra().food; f.x = h.x + g.nextDir.x; f.y = h.y + g.nextDir.y; f.type = 'normal'; T();
    const hazir = d.get().state.kabukHazir, uz = d.get().snake.length;
    d.get().state.paused = false; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' })); d.get().state.paused = true;
    const s5 = d.get().snake.length;
    const g2 = d.get(), h2 = g2.snake[0], f2 = d.extra().food; f2.x = h2.x + g2.nextDir.x; f2.y = h2.y + g2.nextDir.y; f2.type = 'normal';
    const p0 = d.get().state.score; T();
    return { hazir, uz, s5, dp: d.get().state.score - p0 };
  });
  assert.ok(r.kabuk.hazir && r.kabuk.s5 === 5 && r.kabuk.dp >= 2, 'kabuk çalışmadı: ' + JSON.stringify(r.kabuk));
  // 21) Isı haritası: oyun sonunda canvas görünür; kapalıyken gizli
  await baslat('startClassic');
  r.isi = await page.evaluate(() => {
    const d = SnakeGame._debug; T(); T();
    d.get().state.paused = false; d.get().state.lives = 0; d.get().snake[0].x = -2; d.get().state.paused = true;
    return d.get().state.isi ? Array.from(d.get().state.isi).filter(Boolean).length : -1;
  });
  assert.ok(r.isi >= 2, 'ısı izlenmedi: ' + r.isi);
  // 22) Baş-kuyruk takası (Portal, X): yön tersine döner; kapalıyken hiçbir şey olmaz
  await baslat('startPortal');
  r.takas = await page.evaluate(() => {
    const d = SnakeGame._debug, g = d.get(); T(); T(); T();
    const b0 = { ...d.get().snake[0] }, t0 = { ...d.get().snake[d.get().snake.length - 1] };
    d.get().state.paused = false; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' })); d.get().state.paused = true;
    const g2 = d.get();
    return { baş: g2.snake[0].x === t0.x && g2.snake[0].y === t0.y, cool: g2.state.takasCool, dirX: g2.dir.x };
  });
  assert.ok(r.takas.baş && r.takas.cool > 0, 'takas çalışmadı: ' + JSON.stringify(r.takas));
  // 23) Yansıtma (Mermi, Z): öndeki mermi geri döner, 1 halka harcanır
  await baslat('startBullet');
  r.yansit = await page.evaluate(() => {
    const d = SnakeGame._debug, g = d.get(), h = g.snake[0]; g.bullets.length = 0; d.grow(2);
    const n0 = d.get().snake.length;
    g.bullets.push({ x: h.x + g.dir.x * 3, y: h.y + g.dir.y * 3, dx: -g.dir.x * 0.1, dy: -g.dir.y * 0.1, homing: false, grazed: false });
    d.get().state.paused = false; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' })); d.get().state.paused = true;
    const b = d.get().bullets[0]; return { n: n0 - d.get().snake.length, rev: b.dx * g.dir.x + b.dy * g.dir.y > 0 };
  });
  assert.ok(r.yansit.n === 1 && r.yansit.rev, 'yansıtma çalışmadı: ' + JSON.stringify(r.yansit));
  // 24) Mevsim çarkı (Günlük): bir kural seçilir ve ilk yem sayacı işler; Alacakaranlık çizimi hatasız
  await baslat('startDaily');
  r.mevsim = await page.evaluate(() => {
    const d = SnakeGame._debug, st = d.get().state; const m = st.mevsim ? st.mevsim.id : null;
    d.draw(); return m;
  });
  assert.ok(['cifte', 'bonus', 'seri'].includes(r.mevsim), 'mevsim kuralı yok: ' + r.mevsim);
  await baslat('startClassic');
  r.alaca = await page.evaluate(() => { const d = SnakeGame._debug; d.get().state.score = 80; d.draw(); SnakeGame.setSetting('ek', { alaca: false }); d.draw(); SnakeGame.setSetting('ek', {}); return true; });
  // 25) Yutma animasyonu: yem yenince gulpAt işlenir, çizim hatasız; kapalıyken de hatasız
  await baslat('startClassic');
  r.yutma = await page.evaluate(() => {
    const d = SnakeGame._debug, g = d.get(), h = g.snake[0], f = d.extra().food;
    f.x = h.x + g.nextDir.x; f.y = h.y + g.nextDir.y; f.type = 'normal'; T();
    d.draw(); const v = !!d.get().state.gulpAt;
    SnakeGame.setSetting('ek', { yutma: false }); d.draw(); SnakeGame.setSetting('ek', {}); return v;
  });
  assert.ok(r.yutma, 'yutma zamanı kaydedilmedi');
  // 26) Tohum kodu: aynı kodla aynı ilk yem konumu; kapalıyken kod yok
  await baslat('startClassic');
  r.tohum = await page.evaluate(() => {
    const d = SnakeGame._debug, k = d.get().state.tohum, f1 = { x: d.extra().food.x, y: d.extra().food.y };
    d.get().state.over = true;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }));
    const f2 = d.extra().food;
    return { k, k2: d.get().state.tohum, ok: !!k, ayni: f1.x === f2.x && f1.y === f2.y };
  });
  assert.ok(r.tohum.ok && /^[A-Z2-9]{5}$/.test(r.tohum.k) && r.tohum.k === r.tohum.k2 && r.tohum.ayni, 'tohum çalışmadı: ' + JSON.stringify(r.tohum));
  // 27) Parlama atılımı (Tron, O): enerji dolunca 3 hücre sıçrar, ara hücrelerde iz kalmaz
  await baslat('startTron');
  r.parlama = await page.evaluate(() => {
    const d = SnakeGame._debug, g = d.get(); g.tron ? 0 : 0;
    const tr = d.extra().tron; tr.enerji = 30;
    const h0 = { ...d.get().snake[0] }, dr = { ...d.get().dir }, n0 = d.get().snake.length;
    d.get().state.paused = false; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'o' })); d.get().state.paused = true; T();
    const s = d.get().snake, h = s[0];
    return { dx: h.x - h0.x, dy: h.y - h0.y, ex: dr.x * 3, ey: dr.y * 3, e: tr.enerji, ara: s.some(c => c.x === h0.x + dr.x && c.y === h0.y + dr.y && (c.x !== h0.x || c.y !== h0.y)) };
  });
  assert.ok(r.parlama.dx === r.parlama.ex && r.parlama.dy === r.parlama.ey && r.parlama.e === 0 && !r.parlama.ara, 'parlama çalışmadı: ' + JSON.stringify(r.parlama));
  // 28) Hayalet yılan: koşu bitince kayıt alınır, yeni koşuda hayalet çizilir ve geçilince bir kez haber verilir
  await baslat('startClassic');
  r.hayalet = await page.evaluate(() => {
    const d = SnakeGame._debug; T(); T(); T(); T();
    d.get().state.score = 7; d.get().state.paused = false;
    for (let i = 0; i < 400 && !d.get().state.over; i++) { SnakeGame.input(-1, 0); d.tick(); SnakeGame.input(1, 0); d.tick(); }
    SnakeGame.startClassic();
    const g = d.get(), recs = d.extra().records, h = recs.hay;
    const kayit = !!h && h.s === 7 && h.p.length >= 4;
    d.draw();
    const hayVar = !!g.state.hay;
    g.state.hay = { ...g.state.hay, e: [900] }; g.state.hEat = [1]; T(); const gecti = g.state.hayGecti;
    SnakeGame.setSetting('ek', { hayalet: false }); d.draw(); SnakeGame.setSetting('ek', {});
    return { kayit, hayVar, gecti };
  });
  assert.ok(r.hayalet.kayit && r.hayalet.hayVar && r.hayalet.gecti, 'hayalet çalışmadı: ' + JSON.stringify(r.hayalet));
  // 29) Kuyruk mayını (Kuyruk Silahı, O): halka harcanır, yaklaşan düşmanı yok eder; kapalıyken bırakılmaz
  await baslat('startTailgun');
  r.mayin = await page.evaluate(() => {
    const d = SnakeGame._debug, g = d.get(); d.grow(4);
    const n0 = d.get().snake.length;
    d.get().state.paused = false; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'o' })); d.get().state.paused = true;
    const st = d.get().state, m = st.mayinlar[0];
    const harcandi = n0 - d.get().snake.length;
    const en = g.enemies; en.length = 0; en.push({ x: m.x + 0.2, y: m.y, hp: 1 });
    const sk0 = st.score; T();
    return { harcandi, adet: d.get().state.mayinlar.length, skor: d.get().state.score - sk0, kalan: d.get().enemies.length };
  });
  assert.ok(r.mayin.harcandi === 1 && r.mayin.adet === 0 && r.mayin.skor >= 2 && r.mayin.kalan === 0, 'mayın çalışmadı: ' + JSON.stringify(r.mayin));
  // 30) Ritim yemi (Zamana Karşı): vuruşa denk yem +0,5 sn, uzak yem bonus vermez, kapalıyken vermez
  await baslat('startTimeAttack');
  r.ritim = await page.evaluate(() => {
    const d = SnakeGame._debug, st = d.get().state, t0 = st.timeLeft;
    const yakin = d.ritim(10.05, [10.0, 10.6]), t1 = st.timeLeft;
    const uzak = d.ritim(10.3, [10.0, 10.6]), t2 = st.timeLeft;
    SnakeGame.setSetting('ek', { ritim: false }); const kapali = d.ritim(10.0, [10.0]); SnakeGame.setSetting('ek', {});
    return { yakin, uzak, kapali, fark: Math.round((t1 - t0) * 10) / 10, fark2: Math.round((t2 - t1) * 10) / 10 };
  });
  assert.ok(r.ritim.yakin && !r.ritim.uzak && !r.ritim.kapali && r.ritim.fark === 0.5 && r.ritim.fark2 === 0, 'ritim çalışmadı: ' + JSON.stringify(r.ritim));
  // 31) Kaos kumarı (varsayılan kapalı): her 10. yemde iki kural sunulur, oyun durur, 1 ile seçilir
  await baslat('startChaos');
  r.kumar = await page.evaluate(() => {
    const d = SnakeGame._debug; SnakeGame.setSetting('ek', { kumar: true });
    const st = d.get().state, g = d.get(), h = g.snake[0], ch = d.extra().chaos; st.yemSay = 9; ch.rule = null;
    const f = d.extra().food; f.x = h.x + g.nextDir.x; f.y = h.y + g.nextDir.y; f.type = 'normal'; T();
    const sunuldu = !!d.extra().chaos.secim && d.extra().chaos.secim.length === 2 && d.extra().chaos.secim[0][0] !== d.extra().chaos.secim[1][0];
    const x0 = d.get().snake[0].x, y0 = d.get().snake[0].y; T(); const durdu = d.get().snake[0].x === x0 && d.get().snake[0].y === y0;
    d.get().state.paused = false; document.dispatchEvent(new KeyboardEvent('keydown', { key: '1' })); d.get().state.paused = true;
    const secildi = !d.extra().chaos.secim && !!d.extra().chaos.rule;
    SnakeGame.setSetting('ek', {}); return { sunuldu, durdu, secildi };
  });
  assert.ok(r.kumar.sunuldu && r.kumar.durdu && r.kumar.secildi, 'kumar çalışmadı: ' + JSON.stringify(r.kumar));
  // 32) Kaygan buz karosu (Bölüm): 5. bölümde karolar var, 1. bölümde yok; karo üstünde dönüş bir tik gecikir; kapalıyken gecikmez
  r.buz = await page.evaluate(() => {
    const d = SnakeGame._debug; SnakeGame.startCampaign(1); const l1 = !!d.get().state.buz;
    SnakeGame.startCampaign(5); const st = d.get().state; const var5 = !!st.buz && st.buz.size > 6;
    d.draw();
    const g = d.get(), h = g.snake[0]; st.buz.add(h.x + ',' + h.y);
    g.nextDir.x = 0; g.nextDir.y = 1; const dir0 = { ...g.dir };
    d.tick(); const ilk = { ...d.get().dir };
    d.tick(); const ikinci = { ...d.get().dir };
    return { l1, var5, gecikti: ilk.x === dir0.x && ilk.y === dir0.y, sonra: ikinci.y === 1 };
  });
  assert.ok(!r.buz.l1 && r.buz.var5 && r.buz.gecikti && r.buz.sonra, 'buz karosu çalışmadı: ' + JSON.stringify(r.buz));
  // 33) Hedef çeşitleri (Bölüm): 3. bölümde ek koşul var, 2'de yok; skor yetse de koşul yoksa bitmez; kapalıyken yok
  r.hedef = await page.evaluate(() => {
    const d = SnakeGame._debug; SnakeGame.startCampaign(2); const l2 = !!d.get().state.hedef;
    SnakeGame.startCampaign(3); const st = d.get().state, h = st.hedef; const var3 = !!h && h.tur === 'duz';
    st.score = st.target; for (let i = 0; i < 3; i++) d.tick();
    const bitmedi = !d.get().state.complete && !d.get().state.over;
    h.enUzun = 12; const g = d.get(); const tam = d.get().state.hedef.enUzun >= 12;
    SnakeGame.startCampaign(7); const gez = d.get().state.hedef && d.get().state.hedef.tur === 'gezgin';
    SnakeGame.setSetting('ek', { hedefcesit: false }); SnakeGame.startCampaign(3); const kapali = !d.get().state.hedef; SnakeGame.setSetting('ek', {});
    return { l2, var3, bitmedi, tam, gez, kapali };
  });
  assert.ok(!r.hedef.l2 && r.hedef.var3 && r.hedef.bitmedi && r.hedef.gez && r.hedef.kapali, 'hedef çeşitleri çalışmadı: ' + JSON.stringify(r.hedef));
  // 34) Sıralı yem (Bölüm): 4. bölümde 3 numaralı yem; sırayla +1, yanlış sırada set yenilenir, set tamamlanınca +2 ek; kapalıyken yok
  r.sira = await page.evaluate(() => {
    const d = SnakeGame._debug; SnakeGame.startCampaign(3); const l3 = !!d.get().state.sira;
    SnakeGame.startCampaign(4); const st = d.get().state; const var4 = !!st.sira && st.sira.items.length === 3;
    d.draw();
    const yem = (n) => { const c = d.get().state.sira.items.find(x => x.n === n), g = d.get(), h = g.snake[0]; c.x = h.x + g.nextDir.x; c.y = h.y + g.nextDir.y; d.tick(); };
    const s0 = d.get().state.score; yem(1); const bir = d.get().state.score - s0;
    yem(3); const bozuldu = d.get().state.sira.next === 1 && d.get().state.sira.items.length === 3;
    const s1 = d.get().state.score; yem(1); yem(2); yem(3); const tam = d.get().state.score - s1;
    SnakeGame.setSetting('ek', { sirali: false }); SnakeGame.startCampaign(4); const kapali = !d.get().state.sira; SnakeGame.setSetting('ek', {});
    return { l3, var4, bir, bozuldu, tam, kapali };
  });
  assert.ok(!r.sira.l3 && r.sira.var4 && r.sira.bir === 1 && r.sira.bozuldu && r.sira.tam === 5 && r.sira.kapali, 'sıralı yem çalışmadı: ' + JSON.stringify(r.sira));
  assert.deepStrictEqual(errors, [], 'hata: ' + errors);
  console.log('EK TEST: GECTI', JSON.stringify(r));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
