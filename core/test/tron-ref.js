'use strict';
// JS referansı: artık src/core/tron.js'in kendisi (elle kopya yok; game.js de aynı modülü kullanır).
// rand() dışarıdan verilir (çağrı sırası: önce dalgınlık, sonra seçim).

const { DIRS4, aiChooseDir } = require('../../src/core/tron.js');

const aiChooseDirRef = aiChooseDir;

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
