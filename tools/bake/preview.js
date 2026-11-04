#!/usr/bin/env node
// Pişmiş sprite'ların temas tablosu: koyu taş zeminde 2x (gerçek boy) ve büyütülmüş.
//   NODE_PATH=$(npm root -g) node tools/bake/preview.js [çıkış.png] [büyütme]
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const out = process.argv[2] || path.join(os.tmpdir(), 'bake-sheet.png');
const zoom = parseFloat(process.argv[3] || '2');
(async () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/sprite-map.js'), 'utf8');
    const map = JSON.parse(/SPRITE_MAP = (\{[\s\S]*?\});\n/.exec(src)[1]).sprites;
    const imgs = {};
    for (const k of Object.keys(map)) imgs[k] = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'src', map[k].file)).toString('base64');
    const b = await chromium.launch();
    const p = await b.newPage();
    await p.setContent('<canvas id=c></canvas>');
    const data = await p.evaluate(async ({ map, imgs, zoom }) => {
        const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
        const L = {};
        for (const k of Object.keys(imgs)) L[k] = await load(imgs[k]);
        const W = 1800;
        let x = 10, y = 30, rowH = 0;
        const pos = [];
        for (const k of Object.keys(map)) {
            const m = map[k], w = m.w * m.n * zoom / 2 + 10, h = m.h * zoom / 2 + 24;
            if (x + w > W) { x = 10; y += rowH; rowH = 0; }
            pos.push([k, x, y]); x += w; rowH = Math.max(rowH, h);
        }
        const c = document.getElementById('c'); c.width = W; c.height = y + rowH + 10;
        const g = c.getContext('2d');
        g.fillStyle = '#1b1f2b'; g.fillRect(0, 0, c.width, c.height);
        for (let yy = 0; yy < c.height; yy += 20 * zoom / 2) for (let xx = 0; xx < W; xx += 20 * zoom / 2) { g.fillStyle = ((xx + yy) / (20 * zoom / 2)) % 2 ? '#232838' : '#1e2231'; g.fillRect(xx, yy, 20 * zoom / 2, 20 * zoom / 2); }
        g.font = '11px monospace';
        for (const [k, px, py] of pos) {
            const m = map[k];
            g.fillStyle = '#ffd36b'; g.fillText(k, px, py - 4);
            g.drawImage(L[k], px, py, m.w * m.n * zoom / 2, m.h * zoom / 2);
            g.fillStyle = 'rgba(255,0,0,0.8)';
            for (let i = 0; i < m.n; i++) g.fillRect(px + (i * m.w + m.ax) * zoom / 2 - 1, py + m.ay * zoom / 2 - 1, 2, 2);
        }
        return c.toDataURL('image/png');
    }, { map, imgs, zoom });
    fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
    console.log(out);
    await b.close();
})();
