'use strict';
// Tron rakip YZ: saf mantık (DOM, global durum, Math.random yok; rastgelelik `rand` argümanı).
// Tarayıcıda window.YilanCore.tron, Node'da module.exports. Rust çekirdeğin (core/) JS yedeği/referansı.
(function (kok, fabrika) {
    const m = fabrika();
    if (typeof module === 'object' && module.exports) module.exports = m;
    else { kok.YilanCore = kok.YilanCore || {}; kok.YilanCore.tron = m; }
})(typeof self !== 'undefined' ? self : this, function () {
    const DIRS4 = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

    // grid: karar boyunca izler değişmez, Set(x*64+y) ile O(1) arama; null ise izlerde doğrusal arama.
    function tronBlocked(x, y, COLS, ROWS, snake, ai, grid) {
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
        if (grid) return grid.has(x * 64 + y);
        return snake.some(c => c.x === x && c.y === y) || ai.some(c => c.x === x && c.y === y);
    }

    function floodCount(sx, sy, COLS, ROWS, snake, ai, grid) {
        const seen = new Set([sx * 64 + sy]);
        const stack = [[sx, sy]];
        let n = 0;
        while (stack.length && n < COLS * ROWS) {
            const [x, y] = stack.pop();
            n++;
            for (const d of DIRS4) {
                const nx = x + d.x, ny = y + d.y, k = nx * 64 + ny;
                if (seen.has(k) || tronBlocked(nx, ny, COLS, ROWS, snake, ai, grid)) continue;
                seen.add(k);
                stack.push([nx, ny]);
            }
        }
        return n;
    }

    // rand çağrı sırası: önce dalgınlık, sonra seçim (dalgın dalda ikinci çağrı).
    function aiChooseDir({ COLS, ROWS, snake, ai, aiDir, nextDir, wins, rand }) {
        const h = ai[0];
        const opts = DIRS4.filter(d => !(d.x === -aiDir.x && d.y === -aiDir.y))
            .map(d => ({ d, ok: !tronBlocked(h.x + d.x, h.y + d.y, COLS, ROWS, snake, ai, null) }))
            .filter(o => o.ok);
        if (!opts.length) return aiDir;
        // Oyuncunun bir sonraki başı: kafa kafaya (berabere) hücresinden kaçın
        const pn = { x: snake[0].x + nextDir.x, y: snake[0].y + nextDir.y };
        const dumb = Math.max(0.02, 0.2 - wins * 0.03);
        if (rand() < dumb) {
            // "Dalgın" hamle: yine de boş ve kafa kafaya olmayan bir yön
            const pool = opts.filter(o => !(h.x + o.d.x === pn.x && h.y + o.d.y === pn.y));
            const src = pool.length ? pool : opts;
            return src[Math.floor(rand() * src.length)].d;
        }
        let best = [], bestN = -Infinity;
        const grid = new Set();
        snake.forEach(c => grid.add(c.x * 64 + c.y));
        ai.forEach(c => grid.add(c.x * 64 + c.y));
        opts.forEach(o => {
            const nx = h.x + o.d.x, ny = h.y + o.d.y;
            let n = floodCount(nx, ny, COLS, ROWS, snake, ai, grid);
            if (o.d.x === aiDir.x && o.d.y === aiDir.y) n += 0.5;
            if (nx === pn.x && ny === pn.y) n -= 1000;
            if (n > bestN) { bestN = n; best = [o]; }
            else if (n === bestN) best.push(o); // eşitlik: rastgele seç
        });
        return best[Math.floor(rand() * best.length)].d;
    }

    return { DIRS4, tronBlocked, floodCount, aiChooseDir };
});
