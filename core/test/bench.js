'use strict';
// Hız ölçümü: 10000 Tron kararı, JS referansı ve wasm (çağrı + bellek kopyası dahil).
// Kullanım: node core/test/bench.js [N]
const { yukle } = require('./wasm-yukle');
const { aiChooseDirRef, mulberry32, durumUret } = require('./tron-ref');

const N = Number(process.argv[2]) || 10000;
const COLS = 48, ROWS = 32;
const rnd = mulberry32(777);
const durumlar = [];
for (let i = 0; i < N; i++) durumlar.push(durumUret(rnd, COLS, ROWS));
const w = yukle();

function olc(ad, fn) {
    for (let i = 0; i < 500; i++) fn(durumlar[i % N]); // ısınma
    const en = [];
    for (let tur = 0; tur < 5; tur++) {
        const t0 = process.hrtime.bigint();
        let sum = 0;
        for (let i = 0; i < N; i++) sum += fn(durumlar[i]);
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        en.push(ms);
        if (sum === -999) console.log(sum);
    }
    en.sort((a, b) => a - b);
    console.log(`${ad}: ${N} karar, en iyi ${en[0].toFixed(1)} ms, medyan ${en[2].toFixed(1)} ms (${(en[2] * 1000 / N).toFixed(2)} us/karar)`);
    return en[2];
}
// r1=0.9: dalgın yol dışında, flood-fill'li ağır yol
const js = olc('JS  ', d => { const s = [0.9, 0.5]; let k = 0; return aiChooseDirRef({ ...d, rand: () => s[k++] }).x; });
const wa = olc('wasm', d => w.tronChoose(d, 0.9, 0.5));
console.log(`hızlanma (medyan): x${(js / wa).toFixed(2)}`);
