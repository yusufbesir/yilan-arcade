// Rust/wasm Survivor döngüleri (core/src/survivor.rs, src/core/survivor-wasm.js) = JS (src/core/survivor.js):
// (1) 600 rastgele durumda moveEnemies konumları, moveShots mermi listesi/konumları/ölen indeksleri/düşman hp'leri,
// nearestEnemy ve headHit birebir aynı (f64 bit düzeyinde, Object.is); (2) 40 oyun x 120 tikte zincirleme benzetim aynı;
// (3) geçersiz girdide null (çağıran JS yedeğine döner) ve nesnelere dokunulmaz.
const assert = require('assert');
const SV = require('../src/core/survivor.js');
const W = require('../src/core/survivor-wasm.js');

const ex = new WebAssembly.Instance(new WebAssembly.Module(Buffer.from(require('../src/core/yilan_core.wasm.js'), 'base64')), W.ithal()).exports;
const w = W.kur(ex);
assert(w && w.hazir, 'survivor wasm kurulamadı (sürüm uyuşmuyor olabilir)');

function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
const klon = a => a.map(o => ({ ...o }));
const COLS = 48, ROWS = 32;

function durum(r) {
    const head = { x: Math.floor(r() * COLS), y: Math.floor(r() * ROWS) };
    const n = r() < 0.3 ? Math.floor(r() * 200) : Math.floor(r() * 61);
    const enemies = [];
    for (let i = 0; i < n; i++) {
        const yakin = r() < 0.4;
        const hpz = r();
        enemies.push({
            x: yakin ? head.x + (r() - 0.5) * 8 : -1 + r() * (COLS + 1),
            y: yakin ? head.y + (r() - 0.5) * 8 : -1 + r() * (ROWS + 1),
            hp: hpz < 0.05 ? 0 : hpz < 0.15 ? 0.2 * Math.ceil(r() * 10) : 1 + Math.floor(r() * 4)
        });
    }
    const m = Math.floor(r() * 41), shots = [];
    for (let i = 0; i < m; i++) {
        const a = r() * Math.PI * 2, dz = r();
        const s = { x: head.x + (r() - 0.5) * 30, y: head.y + (r() - 0.5) * 20, dx: Math.cos(a), dy: Math.sin(a) };
        if (dz < 0.6) s.dmg = 1 + Math.floor(r() * 3); else if (dz < 0.7) s.dmg = 0;
        if (r() < 0.2) s.from = 3; // Kuyruk Silahı mermisi alanı (dokunulmamalı)
        shots.push(s);
    }
    return { head, enemies, shots, espd: SV.enemySpeed(Math.floor(r() * 30)) };
}

const r = mulberry32(4242);
let olumToplam = 0, vurusYok = 0;
for (let t = 0; t < 600; t++) {
    const d = durum(r);
    // moveEnemies
    const ej = klon(d.enemies), ew = klon(d.enemies);
    SV.moveEnemies(ej, d.head, d.espd);
    assert.strictEqual(w.moveEnemies(ew, d.head, d.espd), true, 'moveEnemies null, durum ' + t);
    assert.deepStrictEqual(ew, ej, 'moveEnemies farklı, durum ' + t);
    // nearestEnemy / headHit
    const nj = SV.nearestEnemy(ej, d.head);
    assert.strictEqual(w.nearestIndex(ej, d.head), nj ? ej.indexOf(nj) : -1, 'nearest farklı, durum ' + t);
    assert.strictEqual(w.nearestEnemy(ej, d.head), nj, 'nearestEnemy farklı, durum ' + t);
    assert.strictEqual(w.headHit(ej, d.head), SV.headHit(ej, d.head), 'headHit farklı, durum ' + t);
    // moveShots
    const sj = klon(d.shots), sw = klon(d.shots), mj = klon(d.enemies), mw = klon(d.enemies);
    const olJ = [], olW = [];
    const rj = SV.moveShots(sj, mj, COLS, ROWS, e => olJ.push(mj.indexOf(e)));
    const rw = w.moveShots(sw, mw, COLS, ROWS, e => olW.push(mw.indexOf(e)));
    assert(rw, 'moveShots null, durum ' + t);
    assert.deepStrictEqual(olW, olJ, 'onKill sırası farklı, durum ' + t);
    assert.deepStrictEqual(rw.olenler, olJ, 'ölen indeksleri farklı, durum ' + t);
    assert.deepStrictEqual(sw, sj, 'mermi nesneleri (silinenler dahil) farklı, durum ' + t);
    assert.deepStrictEqual(mw, mj, 'düşman hp farklı, durum ' + t);
    assert.deepStrictEqual(rw.shots, rj.shots, 'kalan mermi listesi farklı, durum ' + t);
    assert.deepStrictEqual(rw.enemies, rj.enemies, 'kalan düşman listesi farklı, durum ' + t);
    assert.deepStrictEqual(rw.shots.map(s => sw.indexOf(s)), rj.shots.map(s => sj.indexOf(s)), 'mermi kimliği/sırası farklı, durum ' + t);
    assert.deepStrictEqual(rw.enemies.map(e => mw.indexOf(e)), rj.enemies.map(e => mj.indexOf(e)), 'düşman kimliği/sırası farklı, durum ' + t);
    olumToplam += olJ.length; if (!olJ.length) vurusYok++;
}
assert(olumToplam > 300 && vurusYok < 550, 'test ölümleri yeterince kapsamıyor: ' + olumToplam + '/' + vurusYok);

// (2) Zincirleme benzetim: game.js tickSurvivor sırası (üretim, autoFire, moveShots, moveEnemies, headHit), aynı tohum
let tik = 0, maxDusman = 0;
for (let oyun = 0; oyun < 40; oyun++) {
    const rj = mulberry32(100 + oyun), rw = mulberry32(100 + oyun);
    const A = { sv: SV.newSv(), en: [], sh: [], ol: [] }, B = { sv: SV.newSv(), en: [], sh: [], ol: [] };
    A.sv.multi = B.sv.multi = 1 + (oyun % 5); A.sv.cd = B.sv.cd = 3 + (oyun % 4); A.sv.dmg = B.sv.dmg = 1 + (oyun % 3);
    let head = { x: 24, y: 16 };
    for (let k = 1; k <= 120; k++) {
        const wave = 1 + Math.floor((k + oyun * 37) / 40);
        if (k % SV.spawnGap(wave) === 0) { SV.spawnWaveStep(A.en, wave, COLS, ROWS, rj); SV.spawnWaveStep(B.en, wave, COLS, ROWS, rw); }
        head = { x: (head.x + (k % 7 === 0 ? 1 : 0)) % COLS, y: (head.y + (k % 11 === 0 ? COLS - 1 : 0)) % ROWS };
        SV.autoFire(A.sv, head, A.en, A.sh); SV.autoFire(B.sv, head, B.en, B.sh);
        const a = SV.moveShots(A.sh, A.en, COLS, ROWS, e => A.ol.push(e.x, e.y));
        const b = w.moveShots(B.sh, B.en, COLS, ROWS, e => B.ol.push(e.x, e.y));
        assert(b, 'zincir moveShots null');
        A.sh = a.shots; A.en = a.enemies; B.sh = b.shots; B.en = b.enemies;
        SV.moveEnemies(A.en, head, SV.enemySpeed(wave));
        assert(w.moveEnemies(B.en, head, SV.enemySpeed(wave)));
        const hA = SV.headHit(A.en, head), hB = w.headHit(B.en, head);
        assert.strictEqual(hB, hA, 'zincir headHit farklı');
        if (hA >= 0) { A.en.splice(hA, 1); B.en.splice(hB, 1); }
        assert.deepStrictEqual(B.en, A.en, `zincir düşmanlar farklı, oyun ${oyun} tik ${k}`);
        assert.deepStrictEqual(B.sh, A.sh, `zincir mermiler farklı, oyun ${oyun} tik ${k}`);
        assert.deepStrictEqual(B.ol, A.ol, `zincir ölümler farklı, oyun ${oyun} tik ${k}`);
        maxDusman = Math.max(maxDusman, A.en.length);
        tik++;
    }
}

// (3) Geçersiz girdi -> null, nesnelere dokunulmaz (çağıran JS yedeğine döner)
const H = { x: 5, y: 5 };
const bozuk = [{ x: 1, y: 1, hp: 1 }, { x: 'a', y: 2, hp: 1 }];
const once = JSON.stringify(bozuk);
assert.strictEqual(w.moveEnemies(bozuk, H, 0.1), null);
assert.strictEqual(w.moveEnemies([{ x: NaN, y: 1, hp: 1 }], H, 0.1), null);
assert.strictEqual(w.moveEnemies([{ x: 1, y: 1, hp: 1 }], { x: Infinity, y: 0 }, 0.1), null);
assert.strictEqual(w.moveEnemies([{ x: 1, y: 1, hp: 1 }], H, NaN), null);
assert.strictEqual(w.moveEnemies(null, H, 0.1), null);
assert.strictEqual(w.moveEnemies([null], H, 0.1), null);
assert.strictEqual(JSON.stringify(bozuk), once, 'geçersiz moveEnemies nesneleri değiştirdi');
const iyiS = [{ x: 4, y: 5, dx: 1, dy: 0, dmg: 1 }], iyiE = [{ x: 5, y: 5, hp: 1 }];
assert.strictEqual(w.moveShots([{ x: 4, y: 5, dx: '1', dy: 0 }], iyiE, COLS, ROWS), null);
assert.strictEqual(w.moveShots([{ x: 4, y: 5, dx: 1, dy: 0, dmg: '2' }], iyiE, COLS, ROWS), null);
assert.strictEqual(w.moveShots(iyiS, [{ x: 5, y: 5, hp: undefined }], COLS, ROWS), null);
assert.strictEqual(w.moveShots(iyiS, iyiE, NaN, ROWS), null);
assert.strictEqual(w.moveShots(iyiS, 'x', COLS, ROWS), null);
assert.deepStrictEqual(iyiS, [{ x: 4, y: 5, dx: 1, dy: 0, dmg: 1 }], 'geçersiz moveShots mermiyi değiştirdi');
assert.deepStrictEqual(iyiE, [{ x: 5, y: 5, hp: 1 }], 'geçersiz moveShots düşmanı değiştirdi');
assert.strictEqual(w.nearestIndex(bozuk, H), null);
assert.strictEqual(w.nearestEnemy(bozuk, H), undefined);
assert.strictEqual(w.nearestIndex(iyiE, { x: NaN, y: 0 }), null);
assert.strictEqual(w.headHit(bozuk, H), null);
assert.strictEqual(w.headHit(iyiE, null), null);
// boş girdiler
assert.strictEqual(w.nearestIndex([], H), -1);
assert.strictEqual(w.headHit([], H), -1);
assert.deepStrictEqual(w.moveShots([], [], COLS, ROWS), { shots: [], enemies: [], olenler: [] });
// ham ABI: null işaretçi / aşırı uzunluk -> -1 / -2
assert.strictEqual(ex.yc_sv_move_enemies(0, 3, 0, 0, 0.1), -1);
assert.strictEqual(ex.yc_sv_move_shots(0, 2, 0, 0, 48, 32, 0, 0), -1);
assert.strictEqual(ex.yc_sv_nearest(0, 1, 0, 0), -2);
assert.strictEqual(ex.yc_sv_head_hit(8, (1 << 20) + 1, 0, 0), -2);
// eski sürüm modül reddedilir
assert.strictEqual(W.kur({ ...ex, yc_version: () => 0x100 }), null);

const nodeOzet = `600 durum (${olumToplam} ölüm), zincir ${tik} tik (en çok ${maxDusman} düşman), geçersiz girdi -> null`;

// (4) Gerçek sayfa: aynı tohumlu Math.random ile 700 tik Survivor; wasm yolu (?test=1) ve JS yedeği (?test=1&js=1)
// aynı oyun durumuna varır (skor, düşmanlar, mermiler, elmaslar, can, Math.random çağrı sayısı); CSP/sayfa hatası yok.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
    const browser = await chromium.launch();
    const url = 'file://' + path.resolve(__dirname, '../src/index.html');
    const sonuc = {};
    for (const [ad, q] of [['wasm', '?test=1'], ['js', '?test=1&js=1']]) {
        const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        await page.addInitScript(() => {
            let a = 12345; window.__randSay = 0;
            Math.random = function () { window.__randSay++; a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
        });
        await page.goto(url + q);
        if (ad === 'wasm') await page.waitForFunction(() => window.YilanCore.svWasm, null, { timeout: 5000 });
        else await page.waitForTimeout(500);
        sonuc[ad] = await page.evaluate(() => {
            const yc = window.YilanCore, say = { ms: 0, hh: 0 };
            if (yc.svWasm) { // çağrıları say (wasm yolunun gerçekten kullanıldığını görmek için)
                const ms = yc.svWasm.moveShots, hh = yc.svWasm.headHit;
                yc.svWasm.moveShots = function () { const r = ms.apply(this, arguments); if (r) say.ms++; return r; };
                yc.svWasm.headHit = function () { const r = hh.apply(this, arguments); if (r !== null) say.hh++; return r; };
            }
            window.__randSay = 0;
            SnakeGame.startSurvivor();
            const D = SnakeGame._debug;
            let olum = 0;
            for (let i = 0; i < 700; i++) {
                const g = D.get();
                g.state.lives = 9; // kafa çarpması (headHit) da çalışsın, oyun bitmesin
                if (g.sv.choosing) document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
                if (i % 12 === 0) { const d = [[0, 1], [-1, 0], [0, -1], [1, 0]][(i / 12 | 0) % 4]; SnakeGame.input(d[0], d[1]); }
                const once = g.enemies.length;
                D.tick();
                if (D.get().enemies.length < once) olum++;
            }
            const g = D.get();
            const yuvarla = a => a.map(o => ({ x: o.x, y: o.y, hp: o.hp, dx: o.dx, dy: o.dy, v: o.v }));
            return { wasm: !!yc.svWasm, say, olum, randSay: window.__randSay, skor: g.state.score, can: g.state.lives, sv: { ...g.sv, choices: g.sv.choices.map(c => c.id) },
                enemies: yuvarla(g.enemies), shots: yuvarla(g.playerShots), gems: yuvarla(g.gems), snake: g.snake.map(c => [c.x, c.y]) };
        });
        sonuc[ad].errors = errors;
        await page.close();
    }
    await browser.close();
    const A = sonuc.wasm, B = sonuc.js;
    assert.strictEqual(A.wasm, true, 'svWasm sayfada yüklenmedi');
    assert.strictEqual(B.wasm, false, '?js=1 svWasm\'ı kapatmadı');
    assert(A.say.ms > 300 && A.say.hh > 0, 'wasm yolu kullanılmadı: ' + JSON.stringify(A.say));
    assert(A.olum > 10, 'sayfa benzetiminde düşman ölmedi');
    assert.deepStrictEqual(A.errors, [], 'wasm sayfasında hata/CSP: ' + A.errors);
    assert.deepStrictEqual(B.errors, [], 'js sayfasında hata: ' + B.errors);
    for (const k of ['randSay', 'skor', 'can', 'sv', 'enemies', 'shots', 'gems', 'snake']) assert.deepStrictEqual(A[k], B[k], 'sayfa: wasm ve JS yolu farklı: ' + k);
    console.log(`survivor-wasm OK: ${nodeOzet}; sayfa 700 tik wasm = JS (skor ${A.skor}, ${A.enemies.length} düşman, ${A.randSay} Math.random, wasm çağrısı ${A.say.ms}/${A.say.hh})`);
})().catch(e => { console.error(e); process.exit(1); });
