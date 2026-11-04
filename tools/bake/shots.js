#!/usr/bin/env node
// Oyun içi ekran görüntüleri (deviceScaleFactor 2): klasik mod, Tapınak savaş odası, boss odası
// ve 20 px hücrede sprite galerisi. Çıkış: /tmp/bake-*.png  (önek argümanla değişir)
//   NODE_PATH=$(npm root -g) node tools/bake/shots.js [önek]
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const pre = process.argv[2] || '/tmp/bake-';
(async () => {
    const b = await chromium.launch();
    const p = await b.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 2 });
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    p.on('requestfailed', r => errs.push('404 ' + r.url()));
    await p.goto('file://' + path.resolve(__dirname, '../../src/index.html') + '?test=1');
    await p.waitForTimeout(700);
    // 1) Klasik: kıvrımlı uzun yılan, engeller, yem
    await p.evaluate(() => {
        SnakeGame.startClassic();
        const d = SnakeGame._debug, st = d.get().state;
        st.paused = true;
        const sn = d.get().snake;
        sn.length = 0;
        const path = [];
        for (let x = 22; x >= 10; x--) path.push({ x, y: 12 });
        for (let y = 13; y <= 17; y++) path.push({ x: 10, y });
        for (let x = 11; x <= 20; x++) path.push({ x, y: 17 });
        path.reverse().forEach(c => sn.push(c));
        sn.reverse();
        const g = d.get(); g.dir.x = 1; g.dir.y = 0;
        const ex = d.extra();
        ex.obstacles.length = 0;
        [[28, 8], [29, 8], [30, 8], [30, 9], [30, 10], [14, 22], [15, 22], [16, 22], [36, 18], [36, 19]].forEach(([x, y]) => ex.obstacles.push({ x, y }));
        ex.food.x = 26; ex.food.y = 12; ex.food.type = 'normal';
    });
    await p.waitForTimeout(400);
    await p.locator('#gameCanvas').screenshot({ path: pre + 'klasik.png' });
    // 2) Galeri: tüm parçalar oyun ölçeğinde (yem türleri, güçler, bloklar, yılanın 4 yönü)
    await p.evaluate(() => {
        SnakeGame._debug.get().state.over = true;
        const d = window.devicePixelRatio || 1;
        const cv = document.createElement('canvas'); cv.id = 'galeri'; cv.width = 960 * d; cv.height = 120 * d;
        cv.style.cssText = 'position:fixed;left:0;top:0;width:960px;height:120px;z-index:99999';
        document.body.appendChild(cv);
        const ctx = cv.getContext('2d');
        ctx.setTransform(d, 0, 0, d, 0, 0);
        const o = { CELL: 20, W: 960, H: 640, cb: false, pal: SnakeGame._debug.extra().palet, reduced: false, all: [] };
        Gfx25.drawBackground(ctx, 0, Object.assign({}, o, { W: 960, H: 120, reduced: true }));
        ctx.translate(0, -460);
        o.colors = { shield: '#00ccff', speed: '#ffdd00', invincible: '#ff00ff', clear: '#00ff66' };
        ctx.fillStyle = 'rgba(0,0,0,0.0)';
        const t = 1.3;
        Gfx25.drawFood(ctx, { x: 2, y: 26, type: 'normal' }, t, o);
        Gfx25.drawFood(ctx, { x: 4, y: 26, type: 'super' }, t, o);
        Gfx25.drawFood(ctx, { x: 6, y: 26, type: 'curuk' }, t, o);
        ['shield', 'speed', 'invincible', 'clear'].forEach((k, i) => Gfx25.drawPowerup(ctx, { x: 8 + i * 2, y: 26, type: k }, t, o));
        [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach((dd, i) => { o.all = [{ x: 26 + i * 3, y: 27 }]; Gfx25.drawSnakeHead(ctx, { x: 26 + i * 3, y: 26 }, { x: dd[0], y: dd[1] }, t + i * 0.2, o); });
        Gfx25.drawBlocks(ctx, [{ x: 17, y: 26 }, { x: 18, y: 26 }, { x: 18, y: 27 }], '#3a3a55', false, t, 20, false);
        Gfx25.drawBlocks(ctx, [{ x: 20, y: 26 }], '#ff7700', true, t, 20, true);
    });
    await p.locator('#galeri').screenshot({ path: pre + 'galeri.png' });
    await p.evaluate(() => { document.getElementById('galeri').remove(); SnakeGame._debug.get().state.over = false; });
    // 3) Tapınak savaş odası: üç düşman türü yakın plan
    await p.evaluate(() => {
        SnakeGame.startTapinak(7);
        const R = SnakeGame._tapinak.run();
        SnakeGame._debug.get().state.paused = true;
        const o = R.odalar[R.oda];
        o.dusmanlar = [];
        o.dogumlar = [];
        const mk = (tur, x, y) => ({ tur, x, y, hp: Tapinak.DUSMANLAR[tur].hp, max: Tapinak.DUSMANLAR[tur].hp, faz: x, sarj: 0, flash: 0, zehirT: 0, cd: 99, vx: 0, vy: 0 });
        o.dusmanlar.push(mk('kovalayan', 16.5, 12.5), mk('atici', 22.5, 11.5), mk('zirhli', 29.5, 12.5), mk('kovalayan', 19, 18), mk('zirhli', 33, 19));
        R.snake.length = 0;
        for (let i = 0; i < 9; i++) R.snake.push({ x: 24 - i, y: 21 });
    });
    await p.waitForTimeout(400);
    await p.locator('#gameCanvas').screenshot({ path: pre + 'tapinak.png' });
    // 4) Boss odası
    await p.evaluate(() => {
        const R = SnakeGame._tapinak.run();
        const o = R.odalar[R.oda];
        o.dusmanlar = [];
        o.boss = { x: 24, y: 11, r: 1.7, hp: 60, max: 60, faz: 1, uyan: 0, t: 0, hedef: { x: 24, y: 10 }, sarj: 0, hamle: 0, hx: 0, hy: 1, aci: 0, flash: 0, govdeCd: 0 };
    });
    await p.waitForTimeout(400);
    await p.locator('#gameCanvas').screenshot({ path: pre + 'boss.png' });
    const durum = await p.evaluate(() => Sprites.durum());
    console.log('sprite:', durum.yuklenen + '/' + durum.toplam, 'hata:', durum.hata.join(',') || 'yok', errs.length ? errs : '');
    await b.close();
})();
