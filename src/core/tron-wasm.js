'use strict';
// Rust çekirdeği (core/ -> src/core/yilan_core.wasm.js içinde base64) Tron YZ için sarmalar. Yüklenemezse YilanCore.wasm hazır olmaz
// ve game.js JS yedeğini (src/core/tron.js) kullanır. ?js=1 ile wasm zorla kapatılır.
// Tarayıcıda window.YilanCore.wasm, Node'da module.exports ({ kur }).
(function (kok, fabrika) {
    const m = fabrika();
    if (typeof module === 'object' && module.exports) { module.exports = m; return; }
    kok.YilanCore = kok.YilanCore || {};
    if (/[?&]js=1\b/.test(kok.location && kok.location.search || '')) return;
    const b64 = kok.YilanCore.wasmB64; // src/core/yilan_core.wasm.js (betik etiketiyle gömülü)
    if (typeof WebAssembly !== 'object' || !b64 || typeof atob !== 'function') return;
    try {
        const ikili = atob(b64), bayt = new Uint8Array(ikili.length);
        for (let i = 0; i < ikili.length; i++) bayt[i] = ikili.charCodeAt(i);
        WebAssembly.instantiate(bayt, {}).then(function (r) {
            const w = m.kur(r.instance.exports);
            if (w) kok.YilanCore.wasm = w;
        }).catch(function () { /* JS yedeği sürer */ });
    } catch (e) { /* JS yedeği sürer */ }
})(typeof self !== 'undefined' ? self : this, function () {
    const DIRS4 = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

    function kur(ex) {
        if (!ex || typeof ex.yc_tron_choose !== 'function' || !ex.memory || ex.yc_version() !== 0x000100) return null;
        function yaz(hucreler) {
            const bayt = Math.max(8, hucreler.length * 8), ptr = ex.yc_alloc(bayt);
            const v = new Int32Array(ex.memory.buffer); // alloc sonrası tazele
            const o = ptr >> 2;
            for (let i = 0; i < hucreler.length; i++) { v[o + 2 * i] = hucreler[i].x; v[o + 2 * i + 1] = hucreler[i].y; }
            return { ptr, bayt };
        }
        // Dönüş: yön nesnesi (DIRS4 öğesi) ya da girdi geçersizse null (çağıran JS yedeğine döner).
        function aiChooseDir(d, r1, r2) {
            const s = yaz(d.snake), a = yaz(d.ai);
            let i = -1;
            try {
                i = ex.yc_tron_choose(d.COLS, d.ROWS, s.ptr, d.snake.length, a.ptr, d.ai.length,
                    d.aiDir.x, d.aiDir.y, d.nextDir.x, d.nextDir.y, d.wins, r1, r2);
            } finally { ex.yc_free(s.ptr, s.bayt); ex.yc_free(a.ptr, a.bayt); }
            return i >= 0 && i < 4 ? DIRS4[i] : null;
        }
        return { hazir: true, aiChooseDir };
    }
    return { DIRS4, kur };
});
