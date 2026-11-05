'use strict';
// Survivor döngüleri hız ölçümü: JS (src/core/survivor.js) ve wasm (src/core/survivor-wasm.js; nesne<->tampon dönüşümü
// dahil) ile ayrıca "yalnız wasm çağrısı" (veri tamponda hazır, dönüşüm yok) — dönüşümün maliyetini ayırmak için.
// Senaryolar: 60 düşman (oyunun gerçek üst sınırı, spawnEnemy) ve 200 düşman (yapay), 30 mermi.
// Kullanım: node core/test/bench-survivor.js [N]   (N: senaryo başına durum sayısı, varsayılan 2000)
const SV = require('../../src/core/survivor.js');
const W = require('../../src/core/survivor-wasm.js');

const ex = new WebAssembly.Instance(new WebAssembly.Module(Buffer.from(require('../../src/core/yilan_core.wasm.js'), 'base64')), W.ithal()).exports;
const w = W.kur(ex);
const N = Number(process.argv[2]) || 2000;
const COLS = 48, ROWS = 32;

function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
function durum(r, n, m) {
    const head = { x: 24, y: 16 }, enemies = [], shots = [];
    for (let i = 0; i < n; i++) enemies.push({ x: -1 + r() * (COLS + 1), y: -1 + r() * (ROWS + 1), hp: 1 + Math.floor(r() * 3) });
    for (let i = 0; i < m; i++) { const a = r() * 6.283; shots.push({ x: 24 + (r() - 0.5) * 20, y: 16 + (r() - 0.5) * 14, dx: Math.cos(a), dy: Math.sin(a), dmg: 1 }); }
    return { head, enemies, shots };
}
const klon = a => a.map(o => ({ ...o }));

function olc(fn, hazirla) {
    const veri = []; for (let i = 0; i < N; i++) veri.push(hazirla(i));
    for (let i = 0; i < Math.min(N, 300); i++) fn(veri[i]); // ısınma (veri bozulur; aşağıda tazelenir)
    const en = [];
    for (let tur = 0; tur < 7; tur++) {
        const v = []; for (let i = 0; i < N; i++) v.push(hazirla(i));
        const t0 = process.hrtime.bigint();
        for (let i = 0; i < N; i++) fn(v[i]);
        en.push(Number(process.hrtime.bigint() - t0) / 1e3 / N);
    }
    en.sort((a, b) => a - b);
    return en[3]; // medyan, us/çağrı
}

const satirlar = [];
for (const [n, m] of [[60, 30], [200, 30]]) {
    const r = mulberry32(n * 7 + m);
    const D = []; for (let i = 0; i < N; i++) D.push(durum(r, n, m));
    const ham = i => ({ head: D[i].head, enemies: klon(D[i].enemies), shots: klon(D[i].shots) });

    // "Yalnız wasm çağrısı": durumlar önceden düz Float64Array'e çevrilmiş; ölçülen = tek blok kopya (TypedArray.set) + çağrı.
    // Nesne dizisinden okuma/yazma yok: verinin oyun içinde hep tamponda yaşadığı (yeniden yazılmış) bir tasarımın alt sınırı.
    const enB = n * 24, shB = m * 40, p = ex.yc_alloc(enB + shB + (n + m) * 4 + 8);
    const duz = D.map(d => {
        const f = new Float64Array(n * 3 + m * 5);
        d.enemies.forEach((e, i) => { f[3 * i] = e.x; f[3 * i + 1] = e.y; f[3 * i + 2] = e.hp; });
        d.shots.forEach((s, i) => { const k = n * 3 + 5 * i; f[k] = s.x; f[k + 1] = s.y; f[k + 2] = s.dx; f[k + 3] = s.dy; f[k + 4] = s.dmg; });
        return f;
    });
    const F = new Float64Array(ex.memory.buffer), o = p >> 3;
    const doldur = i => duz[i];
    const ok = p + enB + shB, od = ok + m * 4;
    const sonuc = (ad, js, wa, cagri) => satirlar.push({ senaryo: `${n} düşman / ${m} mermi`, islev: ad, js, wa, cagri });
    sonuc('moveEnemies',
        olc(d => SV.moveEnemies(d.enemies, d.head, 0.2), ham),
        olc(d => w.moveEnemies(d.enemies, d.head, 0.2), ham),
        olc(f => { F.set(f, o); ex.yc_sv_move_enemies(p, n, 24, 16, 0.2); }, doldur));
    sonuc('moveShots',
        olc(d => SV.moveShots(d.shots, d.enemies, COLS, ROWS, () => {}), ham),
        olc(d => w.moveShots(d.shots, d.enemies, COLS, ROWS, () => {}), ham),
        olc(f => { F.set(f, o); ex.yc_sv_move_shots(p + enB, m, p, n, COLS, ROWS, ok, od); }, doldur));
    sonuc('nearestEnemy',
        olc(d => SV.nearestEnemy(d.enemies, d.head), ham),
        olc(d => w.nearestEnemy(d.enemies, d.head), ham),
        olc(f => { F.set(f, o); ex.yc_sv_nearest(p, n, 24, 16); }, doldur));
    sonuc('headHit',
        olc(d => SV.headHit(d.enemies, d.head), ham),
        olc(d => w.headHit(d.enemies, d.head), ham),
        olc(f => { F.set(f, o); ex.yc_sv_head_hit(p, n, 24, 16); }, doldur));
    // Bir Survivor tikinin bu dört adımı birlikte (game.js sırası)
    sonuc('tik (4 adım)',
        olc(d => { SV.nearestEnemy(d.enemies, d.head); const q = SV.moveShots(d.shots, d.enemies, COLS, ROWS, () => {}); SV.moveEnemies(q.enemies, d.head, 0.2); SV.headHit(q.enemies, d.head); }, ham),
        olc(d => { w.nearestEnemy(d.enemies, d.head); const q = w.moveShots(d.shots, d.enemies, COLS, ROWS, () => {}); w.moveEnemies(q.enemies, d.head, 0.2); w.headHit(q.enemies, d.head); }, ham),
        null);
    ex.yc_free(p, enB + shB + (n + m) * 4 + 8);
}

console.log(`Node ${process.version}, N=${N} durum/senaryo, 7 turun medyanı (us/çağrı)\n`);
console.log('| senaryo | işlev | JS | wasm (dönüşüm dahil) | yalnız wasm çağrısı | wasm/JS |');
console.log('|---|---|---:|---:|---:|---:|');
for (const s of satirlar) {
    console.log(`| ${s.senaryo} | ${s.islev} | ${s.js.toFixed(2)} | ${s.wa.toFixed(2)} | ${s.cagri === null ? '-' : s.cagri.toFixed(2)} | x${(s.wa / s.js).toFixed(2)} |`);
}
