'use strict';
const fs = require('fs');
const path = require('path');

const WASM = path.join(__dirname, '..', 'target', 'wasm32-unknown-unknown', 'release', 'yilan_core.wasm');

// wasm-bindgen gerektirmeyen ince sarmalayıcı. Dönüş: { tronChoose, floodCount, ... }
function yukle(wasmYolu = WASM) {
    const mod = new WebAssembly.Module(fs.readFileSync(wasmYolu));
    const ex = new WebAssembly.Instance(mod, { yc_math: { atan2: Math.atan2, cos: Math.cos, sin: Math.sin } }).exports;
    const mem = () => new Int32Array(ex.memory.buffer);

    function yaz(cells) {
        const bytes = cells.length * 8;
        const ptr = ex.yc_alloc(bytes);
        const view = mem();
        const o = ptr / 4;
        for (let i = 0; i < cells.length; i++) { view[o + 2 * i] = cells[i].x; view[o + 2 * i + 1] = cells[i].y; }
        return { ptr, bytes };
    }
    function tronChoose(d, r1, r2) {
        const s = yaz(d.snake), a = yaz(d.ai);
        const r = ex.yc_tron_choose(d.COLS, d.ROWS, s.ptr, d.snake.length, a.ptr, d.ai.length,
            d.aiDir.x, d.aiDir.y, d.nextDir.x, d.nextDir.y, d.wins, r1, r2);
        ex.yc_free(s.ptr, s.bytes); ex.yc_free(a.ptr, a.bytes);
        return r;
    }
    function floodCount(COLS, ROWS, blocked, sx, sy) {
        const b = yaz(blocked);
        const r = ex.yc_flood_count(COLS, ROWS, b.ptr, blocked.length, sx, sy);
        ex.yc_free(b.ptr, b.bytes);
        return r;
    }
    return { ex, tronChoose, floodCount };
}

module.exports = { yukle, WASM };
