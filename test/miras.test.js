// Miras (kalıcı tecrübe) testi: Kül hesabı, satın alma, bozuk veri, panel, perk uygulama, ölünce Kül, konsol hatası.
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1100, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const url = 'file://' + path.resolve(__dirname, '../src/index.html') + '?test=1';
  await page.goto(url);

  // 1) award hesabı
  const a = await page.evaluate(() => {
    Miras.reset();
    const r1 = Miras.award({ mode: 'classic', score: 10, won: false });   // 10*1 + 2 = 12
    const r0 = Miras.award({ mode: 'classic', score: 0 });                 // ölüm cezası yok: 2
    const rt = Miras.award({ mode: 'tapinak', score: 10 });                // 10*1.8+2 = 20
    const rc = Miras.award({ mode: 'campaign', score: 10, won: true });    // 10*1.2+2+8 = 22
    const rx = Miras.award({ mode: 'bilinmeyen', score: -5 });             // geçersiz skor -> 2
    return { r1, r0, rt, rc, rx, kul: Miras.kul, xp: Miras.toplamXp };
  });
  assert.strictEqual(a.r1.gained, 12); assert.strictEqual(a.r0.gained, 2);
  assert.strictEqual(a.rt.gained, 20); assert.strictEqual(a.rc.gained, 22); assert.strictEqual(a.rx.gained, 2);
  assert.strictEqual(a.kul, 58); assert.strictEqual(a.xp, 58);
  assert.ok(a.rc.levelUp === true && a.rc.level === 2, 'seviye atlamalı: ' + JSON.stringify(a.rc));

  // 2) satın alma + değer + çarpan
  const b = await page.evaluate(() => {
    Miras.reset();
    const yok = Miras.buy('can');                  // Kül yok
    Miras.award({ mode: 'classic', score: 500 });  // 502 Kül
    const ok1 = Miras.buy('can'), ok2 = Miras.buy('can'), ok3 = Miras.buy('can'), ok4 = Miras.buy('can'); // 4.'sü kademe sınırı
    const v = Miras.value('can');
    const bad = Miras.buy('yok'), val0 = Miras.value('yok');
    Miras.buy('carpan');
    const r = Miras.award({ mode: 'classic', score: 100 }); // (100+2)*1.15 = 117.3 -> 117
    return { yok, ok1, ok2, ok3, ok4, v, bad, val0, g: r.gained, tier: Miras.tier('can') };
  });
  assert.strictEqual(b.yok, false); assert.deepStrictEqual([b.ok1, b.ok2, b.ok3, b.ok4], [true, true, true, false]);
  assert.strictEqual(b.v, 3); assert.strictEqual(b.bad, false); assert.strictEqual(b.val0, 0);
  assert.strictEqual(b.g, 117); assert.strictEqual(b.tier, 3);

  // 3) kalıcılık + bozuk localStorage
  const c = await page.evaluate(() => {
    const kayit = JSON.parse(localStorage.getItem('twilightMiras'));
    const out = { kaydedildi: kayit && kayit.yetenekler.can === 3 };
    const dene = ham => { localStorage.setItem('twilightMiras', ham); Miras.load(); return Miras.state(); };
    out.json = dene('{{{'); out.dizi = dene('[1,2]'); out.tip = dene('{"kul":"x","toplamXp":5}');
    out.neg = dene('{"kul":-5,"toplamXp":3}'); out.nul = dene('null');
    out.kismi = dene('{"kul":7,"toplamXp":9,"yetenekler":{"can":9,"kalkan":2,"__proto__":{"x":1},"sahte":3}}');
    return out;
  });
  assert.ok(c.kaydedildi);
  for (const k of ['json', 'dizi', 'tip', 'neg', 'nul']) assert.deepStrictEqual(c[k], { kul: 0, toplamXp: 0, seviye: 1, yetenekler: {} }, k);
  assert.strictEqual(c.kismi.kul, 7); assert.deepStrictEqual(c.kismi.yetenekler, { kalkan: 2 });

  // 4) panel açılıyor, kartlar var, satın alma arayüzden çalışıyor
  await page.evaluate(() => { Miras.reset(); Miras.award({ mode: 'classic', score: 200 }); });
  await page.reload();
  await page.click('[data-act="openMiras"]');
  assert.ok(await page.evaluate(() => document.getElementById('mirasPanel').classList.contains('active')));
  assert.strictEqual(await page.locator('#mirasList .miras-card').count(), 6);
  await page.screenshot({ path: '/tmp/miras-panel.png' });
  await page.click('#mirasList [data-id="kalkan"]');
  assert.strictEqual(await page.evaluate(() => Miras.tier('kalkan')), 1);
  assert.ok(await page.evaluate(() => document.querySelectorAll('#mirasList .miras-card.on').length === 1));
  await page.click('[data-act="closeMiras"]');
  assert.ok(!(await page.evaluate(() => document.getElementById('mirasPanel').classList.contains('active'))));
  await page.screenshot({ path: '/tmp/miras-menu.png' });

  // 5) perk uygulanıyor: kalkan, ekstra can (bullet), klasikte can değişmez, altın iştah
  const p = await page.evaluate(() => {
    Miras.reset(); Miras.award({ mode: 'classic', score: 2000 });
    const o = {};
    SnakeGame.startClassic(); o.dCan0 = SnakeGame._debug.get().state.lives; o.dKalkan0 = document.getElementById('powerShield').classList.contains('active');
    Miras.buy('can'); Miras.buy('kalkan'); Miras.buy('sakin'); for (let i = 0; i < 3; i++) Miras.buy('istah'); Miras.buy('miknatis');
    SnakeGame.startBullet(); o.bulletCan = SnakeGame._debug.get().state.lives; o.shield = document.getElementById('powerShield').classList.contains('active');
    SnakeGame.startClassic(); o.classicCan = SnakeGame._debug.get().state.lives;
    const D = SnakeGame._debug; const g = D.get();
    for (let i = 0; i < 4; i++) { const f = D.extra().food; g.snake[0] = { x: f.x - 1, y: f.y }; g.dir.x = 1; g.dir.y = 0; g.nextDir.x = 1; g.nextDir.y = 0; D.tick(); }
    o.skor = g.state.score;
    return o;
  });
  assert.strictEqual(p.dCan0, 1); assert.ok(!p.dKalkan0); assert.strictEqual(p.bulletCan, 4); assert.ok(p.shield); assert.strictEqual(p.classicCan, 1);
  assert.ok(p.skor >= 5, 'altın iştah skor: ' + p.skor);

  // 6) ölünce Kül yazılıyor + oyun sonu satırı
  const d = await page.evaluate(() => {
    Miras.reset();
    SnakeGame.startClassic();
    const D = SnakeGame._debug; const g = D.get();
    g.state.score = 30;
    for (let i = 0; i < 400 && !g.state.over; i++) { SnakeGame.input(-1, 0); D.tick(); SnakeGame.input(1, 0); D.tick(); }
    return { over: g.state.over, kul1: Miras.kul, msg: document.getElementById('kulMsg').textContent, saved: JSON.parse(localStorage.getItem('twilightMiras')).kul };
  });
  assert.ok(d.over); assert.strictEqual(d.kul1, 32); assert.strictEqual(d.msg, '🔥 +32 KÜL'); assert.strictEqual(d.saved, 32);
  await page.screenshot({ path: '/tmp/miras-gameover.png' });

  assert.strictEqual(errors.length, 0, 'konsol hataları: ' + errors.join(' | '));
  console.log('miras testi: TAMAM');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
