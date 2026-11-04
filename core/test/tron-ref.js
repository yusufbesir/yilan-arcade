'use strict';
// JS referansı: src/game.js içindeki tronBlocked / floodCount / aiChooseDir mantığının
// aynısı, global duruma bağlı olmayan saf hali. Tek fark: Math.random() yerine
// dışarıdan `rand()` verilir (çağrı sırası aynı: önce dalgınlık, sonra seçim).
// DİKKAT: game.js değişirse bu dosya elle senkron tutulmalı.

const DIRS4 = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

function aiChooseDirRef({ COLS, ROWS, snake, ai, aiDir, nextDir, wins, rand }) {
    let tronGrid = null;
    function tronBlocked(x, y) {
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
        if (tronGrid) return tronGrid.has(x * 64 + y);
        return snake.some(c => c.x === x && c.y === y) || ai.some(c => c.x === x && c.y === y);
    }
    function floodCount(sx, sy) {
        const seen = new Set([sx * 64 + sy]);
        const stack = [[sx, sy]];
        let n = 0;
        while (stack.length && n < COLS * ROWS) {
            const [x, y] = stack.pop();
            n++;
            for (const d of DIRS4) {
                const nx = x + d.x, ny = y + d.y, k = nx * 64 + ny;
                if (seen.has(k) || tronBlocked(nx, ny)) continue;
                seen.add(k);
                stack.push([nx, ny]);
            }
        }
        return n;
    }
    const h = ai[0];
    const opts = DIRS4.filter(d => !(d.x === -aiDir.x && d.y === -aiDir.y))
        .map(d => ({ d, ok: !tronBlocked(h.x + d.x, h.y + d.y) }))
        .filter(o => o.ok);
    if (!opts.length) return aiDir;
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
    ai.forEach(c => tronGrid.add(c.x * 64 + c.y));
    opts.forEach(o => {
        const nx = h.x + o.d.x, ny = h.y + o.d.y;
        let n = floodCount(nx, ny);
        if (o.d.x === aiDir.x && o.d.y === aiDir.y) n += 0.5;
        if (nx === pn.x && ny === pn.y) n -= 1000;
        if (n > bestN) { bestN = n; best = [o]; }
        else if (n === bestN) best.push(o);
    });
    tronGrid = null;
    return best[Math.floor(rand() * best.length)].d;
}

// Çağrı sırası notu: JS'te `Math.random() < dumb` sonrası dal içinde ikinci Math.random().
// Burada rand() iki yolda da en fazla iki kez çağrılır; wasm'a (r1, r2) olarak verilir.

// Tohumlu test rastgeleliği (mulberry32), yalnız durum üretimi için.
function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Rastgele ama geçerli durum: iki kendini kesmeyen iz, rastgele yönler.
function durumUret(rnd, COLS, ROWS) {
    const occ = new Set();
    function walk(maxLen) {
        for (let tries = 0; tries < 50; tries++) {
            const x0 = Math.floor(rnd() * COLS), y0 = Math.floor(rnd() * ROWS);
            if (occ.has(x0 * 64 + y0)) continue;
            const cells = [{ x: x0, y: y0 }];
            const mine = new Set([x0 * 64 + y0]);
            while (cells.length < maxLen) {
                const h = cells[cells.length - 1];
                const cand = DIRS4.map(d => ({ x: h.x + d.x, y: h.y + d.y }))
                    .filter(c => c.x >= 0 && c.x < COLS && c.y >= 0 && c.y < ROWS && !occ.has(c.x * 64 + c.y) && !mine.has(c.x * 64 + c.y));
                if (!cand.length) break;
                const c = cand[Math.floor(rnd() * cand.length)];
                cells.push(c); mine.add(c.x * 64 + c.y);
            }
            mine.forEach(k => occ.add(k));
            return cells;
        }
        return null;
    }
    const lenA = 1 + Math.floor(rnd() * (rnd() < 0.3 ? 400 : 60));
    const lenB = 1 + Math.floor(rnd() * (rnd() < 0.3 ? 400 : 60));
    const snake = walk(lenA), ai = walk(lenB);
    if (!snake || !ai) return durumUret(rnd, COLS, ROWS);
    const aiDir = DIRS4[Math.floor(rnd() * 4)];
    const nextDir = DIRS4[Math.floor(rnd() * 4)];
    const wins = Math.floor(rnd() * 8);
    return { COLS, ROWS, snake, ai, aiDir, nextDir, wins };
}

module.exports = { DIRS4, aiChooseDirRef, mulberry32, durumUret };
