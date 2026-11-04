'use strict';
// src/core/tron.js testi (Node, Playwright'sız): 500 rastgele durumda
//  (a) tron-ref (core/test) ile, (b) game.js'in taşınmadan önceki biçiminin donmuş kopyasıyla
// aynı karar ve aynı rand çağrı sayısı. Çalıştırma: node test/tron-core.test.js
const assert = require('assert');
const T = require('../src/core/tron.js');
const { aiChooseDirRef, mulberry32, durumUret } = require('../core/test/tron-ref.js');

const COLS = 48, ROWS = 32;

// game.js (0.9.3) içindeki orijinal durumlu biçimin donmuş kopyası: değiştirmeyin.
function orijinalKoş(d, rand) {
    const { snake, ai, aiDir, nextDir, wins } = d;
    const tron = { ai, aiDir };
    const DIRS4 = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    let tronGrid = null;
    function tronBlocked(x, y) {
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
        if (tronGrid) return tronGrid.has(x * 64 + y);
        return snake.some(c => c.x === x && c.y === y) || tron.ai.some(c => c.x === x && c.y === y);
    }
    function floodCount(sx, sy) {
        const seen = new Set([sx * 64 + sy]);
        const stack = [[sx, sy]];
        let n = 0;
        while (stack.length && n < COLS * ROWS) {
            const [x, y] = stack.pop();
            n++;
            for (const dd of DIRS4) {
                const nx = x + dd.x, ny = y + dd.y, k = nx * 64 + ny;
                if (seen.has(k) || tronBlocked(nx, ny)) continue;
                seen.add(k);
                stack.push([nx, ny]);
            }
        }
        return n;
    }
    const h = tron.ai[0];
    const opts = DIRS4.filter(dd => !(dd.x === -tron.aiDir.x && dd.y === -tron.aiDir.y))
        .map(dd => ({ d: dd, ok: !tronBlocked(h.x + dd.x, h.y + dd.y) })).filter(o => o.ok);
    if (!opts.length) return tron.aiDir;
    const pn = { x: snake[0].x + nextDir.x, y: snake[0].y + nextDir.y };
    const dumb = Math.max(0.02, 0.2 - wins * 0.03);
    if (rand() < dumb) {
        const pool = opts.filter(o => !(h.x + o.d.x === pn.x && h.y + o.d.y === pn.y));
        const src = pool.length ? pool : opts;
        return src[Math.floor(rand() * src.length)].d;
    }
    let best = [], bestN = -Infinity;
    tronGrid = new Set();
    snake.forEach(c => tronGrid.add(c.x * 64 + c.y));
    tron.ai.forEach(c => tronGrid.add(c.x * 64 + c.y));
    opts.forEach(o => {
        const nx = h.x + o.d.x, ny = h.y + o.d.y;
        let n = floodCount(nx, ny);
        if (o.d.x === tron.aiDir.x && o.d.y === tron.aiDir.y) n += 0.5;
        if (nx === pn.x && ny === pn.y) n -= 1000;
        if (n > bestN) { bestN = n; best = [o]; }
        else if (n === bestN) best.push(o);
    });
    tronGrid = null;
    return best[Math.floor(rand() * best.length)].d;
}

function sayacliRand(seq) { let k = 0; const f = () => seq[k++]; f.say = () => k; return f; }

const rnd = mulberry32(20261104);
let dalgin = 0, akilli = 0, tek = 0;
for (let i = 0; i < 500; i++) {
    const d = durumUret(rnd, COLS, ROWS);
    const r1 = rnd() < 0.3 ? rnd() * 0.02 : rnd();
    const r2 = rnd();
    const ra = sayacliRand([r1, r2]), rb = sayacliRand([r1, r2]), rc = sayacliRand([r1, r2]);
    const a = T.aiChooseDir({ ...d, rand: ra });
    const b = aiChooseDirRef({ ...d, rand: rb });
    const c = orijinalKoş(d, rc);
    assert.deepStrictEqual(a, b, `durum #${i}: core != tron-ref`);
    assert.deepStrictEqual(a, c, `durum #${i}: core != orijinal game.js biçimi`);
    assert.strictEqual(ra.say(), rc.say(), `durum #${i}: rand çağrı sayısı ayrıştı`);
    if (r1 < Math.max(0.02, 0.2 - d.wins * 0.03)) dalgin++; else akilli++;
    if (ra.say() === 0) tek++;
}
assert.ok(dalgin > 50 && akilli > 50, `iki dal da denenmeli (dalgın ${dalgin}, akıllı ${akilli})`);

// tronBlocked / floodCount kenar durumları
assert.strictEqual(T.tronBlocked(-1, 0, COLS, ROWS, [], [], null), true);
assert.strictEqual(T.tronBlocked(COLS, 0, COLS, ROWS, [], [], null), true);
assert.strictEqual(T.tronBlocked(3, 3, COLS, ROWS, [{ x: 3, y: 3 }], [], null), true);
assert.strictEqual(T.tronBlocked(3, 3, COLS, ROWS, [], [{ x: 3, y: 3 }], null), true);
assert.strictEqual(T.tronBlocked(3, 4, COLS, ROWS, [{ x: 3, y: 3 }], [], null), false);
assert.strictEqual(T.floodCount(0, 0, COLS, ROWS, [], [], null), COLS * ROWS);

console.log(`tron-core OK: 500 durum (dalgın ${dalgin}, akıllı ${akilli})`);
