// Arayüz (Nors cam kart): HUD alanları 3 görünüm genişliğinde taşmadan görünür, paneller açılıp kapanır,
// ikonlar (SVG sprite) çözülür, seviye kartlarında kilit/yıldız durumu, konsol hatası yok
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const url = 'file://' + path.resolve(__dirname, '../src/index.html') + '?test=1';
  for (const [w, h] of [[390, 800], [800, 900], [1920, 1080]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(() => {
      if (!localStorage.getItem('pixelSnakeArcade')) localStorage.setItem('pixelSnakeArcade', JSON.stringify({ records: { classic: 99990 }, progress: { unlocked: 4, stars: { 1: 3, 2: 2, 3: 1 } }, unlocked: { ilkyem: 1 } }));
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(w + ' ' + e));
    page.on('console', m => { if (m.type() === 'error') errors.push(w + ' ' + m.text()); });
    await page.goto(url);
    await page.waitForTimeout(300);

    // Tüm <use href="#i-..."> sembolleri gerçekten var olmalı
    const eksik = await page.evaluate(() => [...document.querySelectorAll('use')].map(u => u.getAttribute('href').slice(1)).filter(id => !document.getElementById(id)));
    assert.deepStrictEqual(eksik, [], w + ' eksik ikon: ' + eksik);

    // HUD: dört kutulu (Günlük: skor/rekor/hız/dün) ve beş kutulu (Mermi: skor/rekor/dalga/can), normal ve büyük HUD
    for (const big of [false, true]) {
      await page.evaluate(b => SnakeGame.setSetting('bigHud', b), big);
      for (const baslat of ['startClassic', 'startBullet', 'startCampaign', 'startDaily', 'startTapinak']) {
        const r = await page.evaluate(b => {
          SnakeGame[b](b === 'startCampaign' ? 5 : undefined);
          document.getElementById('hudScore').textContent = '123450'; document.getElementById('hudHigh').textContent = '999990';
          const de = document.documentElement, hud = document.querySelector('.game-hud'), hr = hud.getBoundingClientRect();
          const items = [...document.querySelectorAll('.hud-item')].filter(e => getComputedStyle(e).display !== 'none');
          return {
            sayfa: de.scrollWidth <= de.clientWidth,
            hud: hud.scrollWidth <= hud.clientWidth,
            icinde: items.every(e => { const r = e.getBoundingClientRect(); return r.left >= hr.left - 0.5 && r.right <= hr.right + 0.5 && r.width > 0 && r.height > 0; }),
            kutuIci: items.every(e => [...e.querySelectorAll('.hud-label,.hud-value')].every(c => c.scrollWidth <= e.clientWidth)),
            adet: items.length
          };
        }, baslat);
        assert.ok(r.sayfa && r.hud && r.icinde && r.kutuIci && r.adet >= 2, `${w}px ${baslat} bigHud=${big}: ${JSON.stringify(r)}`);
      }
    }
    await page.evaluate(() => SnakeGame.setSetting('bigHud', false));

    // Can kalpleri SVG ve aria-label doğru
    const can = await page.evaluate(() => { SnakeGame.startBullet(); const g = SnakeGame._debug.get(); g.state.lives = 2; SnakeGame.input(1, 0); SnakeGame._debug.tick(); const el = document.getElementById('hudLives'); return { kalp: el.querySelectorAll('svg.kalp').length, bos: el.querySelectorAll('svg.kalp.bos').length, aria: el.getAttribute('aria-label') }; });
    assert.ok(can.kalp >= 3 && /^Can: \d/.test(can.aria), JSON.stringify(can));

    // Seviye ızgarası: kilit, yıldız, sıradaki
    await page.evaluate(() => SnakeGame.showLevels());
    const sv = await page.evaluate(() => {
      const b = [...document.querySelectorAll('#levelsGrid .level-btn')];
      const g = document.getElementById('levelsGrid'), de = document.documentElement;
      return { n: b.length, kilit: b.filter(e => e.classList.contains('locked') && e.getAttribute('aria-disabled') === 'true' && e.querySelector('svg.kilit')).length, bitti: b.filter(e => e.classList.contains('completed')).length, sira: b.filter(e => e.classList.contains('current')).length, yildiz: b[0].querySelectorAll('svg.yildiz.on').length, etiket: b[0].getAttribute('aria-label'), yatay: g.scrollWidth <= g.clientWidth && de.scrollWidth <= de.clientWidth };
    });
    assert.ok(sv.n === 30 && sv.kilit === 26 && sv.bitti === 3 && sv.sira === 1 && sv.yildiz === 3 && /Bölüm 1, 3 yıldız/.test(sv.etiket) && sv.yatay, w + ' seviye: ' + JSON.stringify(sv));

    // Paneller: aç, odak içinde, taşma yok, Escape ile kapat
    for (const [ac, id, kapat] of [['openSettings', 'settingsPanel', 'closeSettings'], ['openAchievements', 'achPanel', 'closeAchievements'], ['openMiras', 'mirasPanel', 'closeMiras']]) {
      await page.evaluate(a => SnakeGame.showMenu() || SnakeGame[a](), ac);
      const p = await page.evaluate(i => {
        const e = document.getElementById(i), pn = e.querySelector('.panel'), r = pn.getBoundingClientRect();
        return { acik: e.classList.contains('active'), odak: e.contains(document.activeElement), sig: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, yatay: document.documentElement.scrollWidth <= document.documentElement.clientWidth, govde: pn.querySelector('.panel-body').scrollWidth <= pn.querySelector('.panel-body').clientWidth, diyalog: e.getAttribute('role') === 'dialog' && !!document.getElementById(e.getAttribute('aria-labelledby')) };
      }, id);
      assert.ok(Object.values(p).every(Boolean), `${w}px ${id}: ${JSON.stringify(p)}`);
      await page.keyboard.press('Escape');
      const kapali = await page.evaluate(i => !document.getElementById(i).classList.contains('active'), id);
      assert.ok(kapali, `${w}px ${id} Escape ile kapanmadı`);
      await page.evaluate(([a, k]) => { SnakeGame[a](); SnakeGame[k](); }, [ac, kapat]);
      assert.ok(await page.evaluate(i => !document.getElementById(i).classList.contains('active'), id));
    }

    // Oyun sonu: Kül kutusu, ilk 5 listesi ve düğmeler görünür, kutu tuvalden taşmaz
    const son = await page.evaluate(() => {
      SnakeGame.startClassic(); const D = SnakeGame._debug, g = D.get(); g.state.score = 40;
      for (let i = 0; i < 400 && !g.state.over; i++) { SnakeGame.input(-1, 0); D.tick(); SnakeGame.input(1, 0); D.tick(); }
      const ov = document.getElementById('gameoverOverlay'), box = ov.querySelector('.overlay-box'), cv = document.getElementById('gameCanvas').getBoundingClientRect(), br = box.getBoundingClientRect();
      const btn = [...ov.querySelectorAll('.overlay-btn')].map(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.bottom <= cv.bottom + 1 && r.height >= 36; });
      return { acik: ov.classList.contains('active'), kul: /^\s*\+\d+ KÜL$/.test(document.getElementById('kulMsg').textContent) && !!document.querySelector('#kulMsg svg use') && !/[\u{1F300}-\u{1FAFF}]/u.test(document.getElementById('kulMsg').textContent) && getComputedStyle(document.getElementById('kulMsg')).display !== 'none', btn: btn.length === 2 && btn.every(Boolean), sig: br.top >= cv.top - 1 && br.bottom <= cv.bottom + 1 && br.left >= cv.left && br.right <= cv.right };
    });
    assert.ok(Object.values(son).every(Boolean), `${w}px oyun sonu: ${JSON.stringify(son)}`);

    // Bölüm tamam: yıldızlar SVG ve aria-label
    const yd = await page.evaluate(() => { SnakeGame.startCampaign(1); const D = SnakeGame._debug, g = D.get(); g.state.score = g.state.target - 1; const f = D.extra().food; g.snake[0].x = f.x - 1; g.snake[0].y = f.y; g.dir.x = 1; g.dir.y = 0; g.nextDir.x = 1; g.nextDir.y = 0; for (let i = 0; i < 3 && !g.state.complete; i++) D.tick(); const s = document.getElementById('starsDisplay'); const ov = document.getElementById('completeOverlay'), box = ov.querySelector('.overlay-box').getBoundingClientRect(), cv = document.getElementById('gameCanvas').getBoundingClientRect(); return { acik: ov.classList.contains('active'), n: s.querySelectorAll('svg.yildiz').length, aria: /yıldız/.test(s.getAttribute('aria-label')), sig: box.top >= cv.top - 1 && box.bottom <= cv.bottom + 1 }; });
    assert.ok(yd.acik && yd.n === 3 && yd.aria && yd.sig, `${w}px bölüm tamam: ${JSON.stringify(yd)}`);

    // Duraklat kutusu ve toast görünür / taşmaz
    const dr = await page.evaluate(() => { SnakeGame.startClassic(); SnakeGame.togglePause(); const a = document.getElementById('pauseOverlay').classList.contains('active'); SnakeGame.togglePause(); const t = document.getElementById('toast'); t.textContent = '🏅 BAŞARIM: ZAMANI BÜK ve biraz daha uzun bir metin'; t.classList.add('show'); const r = t.getBoundingClientRect(); return { a, toast: r.left >= 0 && r.right <= innerWidth }; });
    assert.ok(dr.a && dr.toast, `${w}px duraklat/toast: ${JSON.stringify(dr)}`);
    await page.screenshot({ path: path.join(require('os').tmpdir(), `arayuz-test-${w}.png`) }).catch(() => {});
    await ctx.close();
  }
  // 0.9.4: 320x568'de Modlar ekranı yatay taşmaz; Tron 2P düğmesi kartın içinde kalır
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 568 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('320 ' + e));
    await page.goto(url);
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('[data-act="showModes"]').click());
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const kartlar = [...document.querySelectorAll('#modesScreen .mode-card')];
      const tr = document.querySelector('#modesScreen #tron2pBtn').getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, tasan: kartlar.filter(k => k.getBoundingClientRect().right > 320.5).length, n: kartlar.length, tron: tr.left >= 0 && tr.right <= 320 };
    });
    assert.ok(m.sw <= m.cw && m.tasan === 0 && m.n >= 8 && m.tron, '320px Modlar taşıyor: ' + JSON.stringify(m));
    await ctx.close();
  }
  await browser.close();
  assert.strictEqual(errors.length, 0, 'konsol hataları: ' + errors.join(' | '));
  console.log('arayuz testi: TAMAM');
})().catch(e => { console.error(e); process.exit(1); });
