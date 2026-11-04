#!/usr/bin/env node
// Sprite pişirici: three.js modellerini başsız Chromium (WebGL/SwiftShader) içinde
// ışıklandırıp saydam PNG şeritlerine çevirir ve src/sprite-map.js haritasını yazar.
//
//   npm i three@0.160.0 --no-save        (bir kez; paketlenmez)
//   NODE_PATH=$(npm root -g) node tools/bake/bake.js [ad1 ad2 ...]
//
// Doku: src/img/tex/<ID>/ altında ambientCG jpg'leri (Color / NormalGL / Roughness) varsa
// ID adına göre taş/metal/ahşap/kumaş ailesine bağlanır; yoksa prosedürel doku üretilir.
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'src/img/sprites');
const MAP = path.join(ROOT, 'src/sprite-map.js');
const TEX = path.join(ROOT, 'src/img/tex');

function threePath() {
    const c = [path.join(ROOT, 'node_modules/three/build/three.min.js'), '/tmp/bk/node_modules/three/build/three.min.js'];
    try { c.unshift(require.resolve('three/build/three.min.js', { paths: [ROOT] })); } catch (e) { /* yok */ }
    const p = c.find(f => fs.existsSync(f));
    if (!p) { console.error('three@0.160.0 bulunamadı: npm i three@0.160.0 --no-save'); process.exit(1); }
    return p;
}

// ambientCG klasörlerini malzeme ailelerine eşle (ilk uyan kazanır)
const AILE = [
    ['stone', /rock|stone|brick|cobble|concrete|marble|paving|ground|tiles|slate|granite/i],
    ['iron', /metal|iron|rust|steel|scratch/i],
    ['wood', /wood|bark|plank/i],
    ['cloth', /fabric|cloth|leather|carpet|wool/i]
];
function harici() {
    const ext = {};
    if (!fs.existsSync(TEX)) return ext;
    const dataUrl = f => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
    for (const id of fs.readdirSync(TEX).sort()) {
        const dir = path.join(TEX, id);
        if (!fs.statSync(dir).isDirectory()) continue;
        const aile = AILE.find(([, re]) => re.test(id));
        if (!aile || ext[aile[0]]) continue;
        const files = fs.readdirSync(dir);
        const bul = re => { const f = files.find(x => re.test(x) && /\.(jpe?g|png)$/i.test(x)); return f ? dataUrl(path.join(dir, f)) : null; };
        const color = bul(/color|albedo|diff/i);
        if (!color) continue;
        ext[aile[0]] = { color, normal: bul(/normalgl/i) || bul(/normal/i), rough: bul(/rough/i), id };
        console.log('doku:', aile[0], '<-', id);
    }
    return ext;
}

(async () => {
    const only = process.argv.slice(2);
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('sayfa hatası:', e.message));
    page.on('console', m => { if (m.type() === 'error') console.error('konsol:', m.text()); });
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: threePath() });
    await page.addScriptTag({ path: path.join(__dirname, 'lib.js') });
    await page.addScriptTag({ path: path.join(__dirname, 'models.js') });
    const ext = harici();
    await page.evaluate(async e => { Bake.init(); await Bake.preloadExternal(e); }, ext);
    const names = await page.evaluate(() => BakeModels.LIST.map(s => s.name));

    // mevcut haritayı koru (yalnız seçilenler yeniden pişirilirse)
    let map = {};
    if (only.length && fs.existsSync(MAP)) {
        const m = /SPRITE_MAP = (\{[\s\S]*?\});\n/.exec(fs.readFileSync(MAP, 'utf8'));
        if (m) try { map = JSON.parse(m[1]).sprites || {}; } catch (e) { map = {}; }
    }
    let toplam = 0;
    for (const n of names) {
        if (only.length && !only.includes(n)) continue;
        const t0 = Date.now();
        const r = await page.evaluate(async name => {
            const spec = BakeModels.LIST.find(s => s.name === name);
            return Bake.renderSprite(spec);
        }, n);
        const buf = Buffer.from(r.png.split(',')[1], 'base64');
        fs.writeFileSync(path.join(OUT, n + '.png'), buf);
        map[n] = { file: 'img/sprites/' + n + '.png', w: r.w, h: r.h, n: r.n, ax: r.ax, ay: r.ay };
        console.log(n.padEnd(18), (r.w + 'x' + r.h).padEnd(9), 'x' + r.n, (buf.length / 1024).toFixed(1) + ' KB', (Date.now() - t0) + ' ms');
    }
    for (const k of Object.keys(map)) toplam += fs.statSync(path.join(ROOT, 'src', map[k].file)).size;
    // haritada olmayan eski çıktılar uyarılır (silinmez)
    for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png') && !map[f.slice(0, -4)]) console.warn('haritada yok:', f);
    // file:// altında PNG'den çizilen tuval "tainted" olur (getImageData kırılır); bu yüzden
    // aynı PNG baytları data: URI olarak da gömülür (CSP img-src data: izinli). PNG'ler kaynak/inceleme içindir.
    const data = {};
    for (const k of Object.keys(map)) data[k] = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'src', map[k].file)).toString('base64');
    const out = '// OTOMATİK ÜRETİLDİ: node tools/bake/bake.js (elle düzenlemeyin)\n' +
        '// three.js (MIT) ile bu depoda modellenip pişirilen sprite şeritleri. Ölçek: 2 px = 1 mantıksal px.\n' +
        '// w,h: tek karenin piksel boyu; n: kare sayısı (yatay şerit); ax,ay: yer çapası (piksel).\n' +
        'window.SPRITE_MAP = ' + JSON.stringify({ scale: 2, sprites: map }, null, 1) + ';\n' +
        '// Aynı PNG baytları (file:// tuval kirlenmesini önler)\n' +
        'window.SPRITE_DATA = ' + JSON.stringify(data) + ';\n';
    fs.writeFileSync(MAP, out);
    console.log('toplam', (toplam / 1024 / 1024).toFixed(2), 'MB,', Object.keys(map).length, 'sprite ->', path.relative(ROOT, MAP));
    await browser.close();
    if (toplam > 6 * 1024 * 1024) { console.error('UYARI: 6 MB sınırı aşıldı'); process.exitCode = 2; }
})();
