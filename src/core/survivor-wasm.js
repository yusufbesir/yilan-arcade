'use strict';
// Rust çekirdeği (core/src/survivor.rs, src/core/yilan_core.wasm.js içinde base64) Survivor ağır döngüleri için sarmalar:
// moveEnemies, moveShots, nearestEnemy (indeks), headHit. Sonuçlar src/core/survivor.js ile birebir aynıdır
// (aynı işlem sırası, f64; Math.atan2/cos/sin wasm'a içe aktarılır, Math.hypot V8 algoritmasıyla kopyalanır).
// Yüklenemezse YilanCore.svWasm hazır olmaz; ?js=1 ile wasm zorla kapatılır. Girdi geçersizse her işlev null döner
// ve çağıran JS yedeğini (src/core/survivor.js) kullanır; null dönen çağrı hiçbir nesneyi değiştirmez.
// Tarayıcıda window.YilanCore.svWasm, Node'da module.exports ({ kur, ithal }).
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
        WebAssembly.instantiate(bayt, m.ithal()).then(function (r) {
            const w = m.kur(r.instance.exports);
            if (w) kok.YilanCore.svWasm = w;
        }).catch(function () { /* JS yedeği sürer */ });
    } catch (e) { /* JS yedeği sürer */ }
})(typeof self !== 'undefined' ? self : this, function () {
    // wasm içe aktarımları: JS'in kendi trig işlevleri (V8 bunları doğrudan çağrıya çevirir), son bit JS ile aynı olsun diye.
    function ithal() { return { yc_math: { atan2: Math.atan2, cos: Math.cos, sin: Math.sin } }; }

    const EN = 3, SH = 5; // tampon adımları: düşman [x,y,hp], mermi [x,y,dx,dy,dmg]
    const gecerli = Number.isFinite;

    function kur(ex) {
        if (!ex || !ex.memory || typeof ex.yc_version !== 'function' || ex.yc_version() < 0x000200) return null;
        for (const f of ['yc_alloc', 'yc_free', 'yc_sv_move_enemies', 'yc_sv_move_shots', 'yc_sv_nearest', 'yc_sv_head_hit']) {
            if (typeof ex[f] !== 'function') return null;
        }
        // Kalıcı çalışma alanı (yc_alloc/yc_free; gerektikçe büyür). Bellek büyürse görünümler tazelenir.
        let ptr = 0, kap = 0, buf = null, f64 = null, i32 = null;
        function gorus() {
            if (buf !== ex.memory.buffer) { buf = ex.memory.buffer; f64 = new Float64Array(buf); i32 = new Int32Array(buf); }
        }
        function alan(bayt) {
            if (bayt > kap) {
                if (ptr) ex.yc_free(ptr, kap);
                const yeni = Math.max(bayt, kap * 2, 4096);
                ptr = ex.yc_alloc(yeni);
                kap = ptr ? yeni : 0;
            }
            gorus();
            return ptr;
        }
        // Düşmanları tampona yazar (o: f64 indeksi). hp=false ise hp yazılmaz. Geçersizse false.
        function yazDusman(enemies, o, hp) {
            for (let i = 0, k = o; i < enemies.length; i++, k += EN) {
                const e = enemies[i];
                if (!e || !gecerli(e.x) || !gecerli(e.y)) return false;
                f64[k] = e.x; f64[k + 1] = e.y;
                if (hp) { if (!gecerli(e.hp)) return false; f64[k + 2] = e.hp; }
            }
            return true;
        }
        function bas(h) { return h && gecerli(h.x) && gecerli(h.y); }

        // survivor.js moveEnemies ile aynı (yerinde). Dönüş: true ya da null (geçersiz; nesnelere dokunulmadı).
        function moveEnemies(enemies, head, espd) {
            if (!Array.isArray(enemies) || !bas(head) || !gecerli(espd)) return null;
            const n = enemies.length;
            if (n === 0) return true;
            const p = alan(n * EN * 8);
            if (!p) return null;
            const o = p >> 3;
            if (!yazDusman(enemies, o, false)) return null;
            if (ex.yc_sv_move_enemies(p, n, head.x, head.y, espd) !== n) return null;
            for (let i = 0, k = o; i < n; i++, k += EN) { const e = enemies[i]; e.x = f64[k]; e.y = f64[k + 1]; }
            return true;
        }

        // survivor.js moveShots ile aynı. onKill geri çağrısı (verilirse) ölüm sırasıyla, döngü bittikten sonra çağrılır
        // (survivor/tailgun onKill'i mermi ve düşman dizilerine dokunmadığından sonuç aynı). Dönüş:
        // { shots, enemies, olenler } (olenler: ölen düşmanların giriş dizisindeki indeksleri) ya da null.
        function moveShots(playerShots, enemies, COLS, ROWS, onKill) {
            if (!Array.isArray(playerShots) || !Array.isArray(enemies) || !gecerli(COLS) || !gecerli(ROWS)) return null;
            const m = playerShots.length, n = enemies.length;
            const enB = n * EN * 8, shB = m * SH * 8;
            const p = alan(enB + shB + (m + n) * 4 + 8);
            if (!p) return null;
            const oe = p >> 3, os = (p + enB) >> 3, ok = (p + enB + shB) >> 2, od = ok + m;
            if (!yazDusman(enemies, oe, true)) return null;
            for (let i = 0, k = os; i < m; i++, k += SH) {
                const s = playerShots[i];
                if (!s) return null;
                const d = s.dmg || 1;
                if (!gecerli(s.x) || !gecerli(s.y) || !gecerli(s.dx) || !gecerli(s.dy) || !gecerli(d)) return null;
                f64[k] = s.x; f64[k + 1] = s.y; f64[k + 2] = s.dx; f64[k + 3] = s.dy; f64[k + 4] = d;
            }
            const nd = ex.yc_sv_move_shots(os << 3, m, oe << 3, n, COLS, ROWS, ok << 2, od << 2);
            if (nd < 0) return null;
            const shots = [];
            for (let i = 0, k = os; i < m; i++, k += SH) {
                const s = playerShots[i];
                s.x = f64[k]; s.y = f64[k + 1];
                if (i32[ok + i]) shots.push(s);
            }
            const olenler = new Array(nd);
            if (n) {
                for (let i = 0, k = oe + 2; i < n; i++, k += EN) enemies[i].hp = f64[k];
                for (let j = 0; j < nd; j++) olenler[j] = i32[od + j];
            }
            if (onKill) for (let j = 0; j < nd; j++) onKill(enemies[olenler[j]]);
            return { shots, enemies: enemies.filter(e => e.hp > 0), olenler };
        }

        // nearestEnemy'nin indeks hali: en yakın (<= 11) düşman indeksi, yoksa -1, geçersizse null.
        function nearestIndex(enemies, h) {
            if (!Array.isArray(enemies) || !bas(h)) return null;
            const n = enemies.length;
            if (n === 0) return -1;
            const p = alan(n * EN * 8);
            if (!p || !yazDusman(enemies, p >> 3, false)) return null;
            const r = ex.yc_sv_nearest(p, n, h.x, h.y);
            return r < -1 ? null : r;
        }
        // survivor.js nearestEnemy ile aynı dönüş (düşman ya da null); geçersiz girdide undefined.
        function nearestEnemy(enemies, h) {
            const i = nearestIndex(enemies, h);
            return i === null ? undefined : i < 0 ? null : enemies[i];
        }
        // survivor.js headHit ile aynı: indeks ya da -1; geçersizse null.
        function headHit(enemies, head) {
            if (!Array.isArray(enemies) || !bas(head)) return null;
            const n = enemies.length;
            if (n === 0) return -1;
            const p = alan(n * EN * 8);
            if (!p || !yazDusman(enemies, p >> 3, false)) return null;
            const r = ex.yc_sv_head_hit(p, n, head.x, head.y);
            return r < -1 ? null : r;
        }
        return { hazir: true, moveEnemies, moveShots, nearestIndex, nearestEnemy, headHit };
    }
    return { ithal, kur };
});
