'use strict';
// src/core/survivor.js testi (Node, Playwright'sız): game.js 0.9.4'teki orijinal Survivor mantığının DONMUŞ kopyasıyla,
// aynı tohumlu rand dizisinde, 300+ rastgele durumda aynı durum ve aynı rand çağrı sayısı.
// Çalıştırma: node test/survivor-core.test.js
const assert = require('assert');
const C = require('../src/core/survivor.js');

const COLS = 48, ROWS = 32;

function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
function sayac(rand) { const f = () => { f.n++; return rand(); }; f.n = 0; return f; }

// ---- game.js 0.9.4 orijinali (donmuş kopya; Math.random -> rand, DOM çağrıları kaldırıldı). DEĞİŞTİRMEYİN. ----
const UPGRADES0 = [
    { id: 'dmg', text: 'HASAR +1' }, { id: 'rate', text: 'ATEŞ HIZI +25%' }, { id: 'multi', text: 'ÇOKLU ATIŞ +1' },
    { id: 'magnet', text: 'MIKNATIS +1.5' }, { id: 'life', text: 'CANI DOLDUR' }
];
function orijinal(S, rand) {
    let { state, sv, enemies, gems, snake, powers } = S;
    let playerShots = S.playerShots;
    let waveTick = S.waveTick;
    function spawnEnemy() {
        if (enemies.length >= 60) return;
        const side = Math.floor(rand() * 4);
        const e = { x: 0, y: 0, hp: state.wave >= 4 && rand() < 0.25 ? 2 : 1 };
        if (side === 0) { e.x = rand() * COLS; e.y = -1; }
        else if (side === 1) { e.x = rand() * COLS; e.y = ROWS; }
        else if (side === 2) { e.x = -1; e.y = rand() * ROWS; }
        else { e.x = COLS; e.y = rand() * ROWS; }
        enemies.push(e);
    }
    function moveShots(onKill) {
        playerShots = playerShots.filter(s => {
            for (let i = 0; i < 3; i++) {
                s.x += s.dx * 0.5;
                s.y += s.dy * 0.5;
                for (const e of enemies) {
                    if (e.hp > 0 && Math.hypot(e.x - s.x, e.y - s.y) < 0.9) {
                        e.hp -= s.dmg || 1;
                        if (e.hp <= 0) onKill(e);
                        return false;
                    }
                }
            }
            return s.x > -2 && s.x < COLS + 2 && s.y > -2 && s.y < ROWS + 2;
        });
        enemies = enemies.filter(e => e.hp > 0);
    }
    function nearestEnemy(h) {
        let best = null, bd = 1e9;
        for (const e of enemies) {
            const d = Math.hypot(e.x - h.x, e.y - h.y);
            if (d < bd) { bd = d; best = e; }
        }
        return bd <= 11 ? best : null;
    }
    function levelUp() {
        sv.level++;
        sv.xp = 0;
        sv.need = 5 + sv.level * 3;
        const pool = UPGRADES0.slice().sort(() => rand() - 0.5);
        sv.choices = pool.slice(0, 3);
        sv.choosing = true;
    }
    function damage() { S.hits = (S.hits || 0) + 1; }
    function tickSurvivor() {
        if (sv.choosing) return;
        waveTick++;
        if (waveTick % 200 === 0) { state.wave++; }
        const gap = Math.max(3, 22 - state.wave * 2);
        if (waveTick % gap === 0) {
            const grup = state.wave >= 12 ? 1 + Math.floor((state.wave - 12) / 8) : 0;
            for (let k = 0; k <= Math.min(grup, 3); k++) {
                const n0 = enemies.length;
                spawnEnemy();
                if (enemies.length === n0) break;
                const ne = enemies[enemies.length - 1];
                if (state.wave >= 3 && rand() < 0.3) ne.hp = 1 + Math.floor(state.wave / 3);
                if (state.wave >= 10) ne.hp = Math.max(ne.hp, 1 + Math.floor((state.wave - 6) / 3));
            }
        }
        const head = snake[0];
        const espd = Math.min(0.36, 0.08 + state.wave * 0.006);
        sv.timer++;
        if (sv.timer >= sv.cd) {
            const t = nearestEnemy(head);
            if (t) {
                sv.timer = 0;
                const a = Math.atan2(t.y - head.y, t.x - head.x);
                for (let i = 0; i < sv.multi; i++) {
                    const off = (i - (sv.multi - 1) / 2) * 0.25;
                    playerShots.push({ x: head.x, y: head.y, dx: Math.cos(a + off), dy: Math.sin(a + off), dmg: sv.dmg });
                }
            }
        }
        moveShots(enemy => {
            state.score += 2;
            gems.push({ x: enemy.x, y: enemy.y, v: 1 });
            if (gems.length > 80) { const o = gems.shift(); gems[0].v = (gems[0].v || 1) + (o.v || 1); }
        });
        enemies.forEach(e => {
            const a = Math.atan2(head.y - e.y, head.x - e.x);
            e.x += Math.cos(a) * espd;
            e.y += Math.sin(a) * espd;
        });
        gems = gems.filter(g => {
            const d = Math.hypot(head.x - g.x, head.y - g.y);
            if (d < sv.magnet) {
                sv.xp += g.v || 1;
                if (sv.xp >= sv.need) { const artan = sv.xp - sv.need; levelUp(); sv.xp = artan; }
                S.hud = sv.xp + '/' + sv.need;
                return false;
            }
            return true;
        });
        if (!powers.invincible) {
            for (let i = 0; i < enemies.length; i++) {
                if (Math.hypot(head.x - enemies[i].x, head.y - enemies[i].y) < 1.0) {
                    enemies.splice(i, 1);
                    damage();
                    return;
                }
            }
        }
    }
    tickSurvivor();
    return Object.assign({}, S, { enemies, gems, playerShots, waveTick });
}
function orijinalPick(S, i) { // pickUpgrade
    const sv = S.sv;
    if (!sv.choosing || !sv.choices[i]) return;
    switch (sv.choices[i].id) {
        case 'dmg': sv.dmg += 1; break;
        case 'rate': sv.cd = Math.max(3, Math.round(sv.cd * 0.8)); break;
        case 'multi': sv.multi = Math.min(5, sv.multi + 1); break;
        case 'magnet': sv.magnet = Math.min(8, sv.magnet + 1.5); break;
        case 'life': S.state.lives = 3; break;
    }
    sv.choosing = false;
}
function orijinalSpawnTailgun(enemies, wave, rand) { // tailgun'ın ortak spawnEnemy'si
    if (enemies.length >= 60) return;
    const side = Math.floor(rand() * 4);
    const e = { x: 0, y: 0, hp: wave >= 4 && rand() < 0.25 ? 2 : 1 };
    if (side === 0) { e.x = rand() * COLS; e.y = -1; }
    else if (side === 1) { e.x = rand() * COLS; e.y = ROWS; }
    else if (side === 2) { e.x = -1; e.y = rand() * ROWS; }
    else { e.x = COLS; e.y = rand() * ROWS; }
    enemies.push(e);
}

// ---- core ile aynı tik (game.js sarmalayıcısının eşleniği) ----
function cekirdek(S, rand) {
    const { state, sv, snake, powers } = S;
    let { enemies, gems, playerShots } = S;
    let waveTick = S.waveTick;
    if (sv.choosing) return Object.assign({}, S);
    waveTick++;
    if (C.waveAdvances(waveTick)) state.wave++;
    if (waveTick % C.spawnGap(state.wave) === 0) C.spawnWaveStep(enemies, state.wave, COLS, ROWS, rand);
    const head = snake[0];
    const espd = C.enemySpeed(state.wave);
    C.autoFire(sv, head, enemies, playerShots);
    const r = C.moveShots(playerShots, enemies, COLS, ROWS, enemy => { state.score += 2; C.addGem(gems, enemy.x, enemy.y); });
    playerShots = r.shots; enemies = r.enemies;
    C.moveEnemies(enemies, head, espd);
    gems = C.collectGems(gems, head, sv, () => C.levelUpStats(sv, rand), () => { S.hud = sv.xp + '/' + sv.need; });
    if (!powers.invincible) {
        const i = C.headHit(enemies, head);
        if (i >= 0) { enemies.splice(i, 1); S.hits = (S.hits || 0) + 1; }
    }
    return Object.assign({}, S, { enemies, gems, playerShots, waveTick });
}

function rs(rng, lo, hi) { return lo + rng() * (hi - lo); }
function durumUret(seed) {
    const g = mulberry32(seed * 7919 + 13);
    const dalga = Math.floor(rs(g, 1, 30));
    const nEn = g() < 0.15 ? 59 + Math.floor(g() * 3) : Math.floor(rs(g, 0, 45));
    const nGem = g() < 0.2 ? 78 + Math.floor(g() * 5) : Math.floor(rs(g, 0, 40));
    const sv = {
        level: 1 + Math.floor(g() * 12), xp: Math.floor(g() * 10), need: 5 + Math.floor(g() * 30), dmg: 1 + Math.floor(g() * 5),
        cd: 3 + Math.floor(g() * 10), multi: 1 + Math.floor(g() * 5), magnet: 2.5 + Math.floor(g() * 4) * 1.5,
        timer: Math.floor(g() * 10), choosing: g() < 0.05, choices: g() < 0.5 ? UPGRADES0.slice(0, 3) : []
    };
    const head = { x: Math.floor(g() * COLS), y: Math.floor(g() * ROWS) };
    return {
        state: { wave: dalga, score: 0, lives: 1 + Math.floor(g() * 3) },
        sv,
        snake: [head, { x: head.x - 1, y: head.y }],
        powers: { invincible: g() < 0.2 },
        enemies: Array.from({ length: nEn }, () => ({ x: rs(g, -1, COLS + 1), y: rs(g, -1, ROWS + 1), hp: 1 + Math.floor(g() * 4) })),
        gems: Array.from({ length: nGem }, () => ({ x: rs(g, 0, COLS), y: rs(g, 0, ROWS), v: g() < 0.3 ? 1 + Math.floor(g() * 6) : 1 })),
        playerShots: Array.from({ length: Math.floor(g() * 8) }, () => {
            const a = g() * 6.283; return { x: rs(g, 0, COLS), y: rs(g, 0, ROWS), dx: Math.cos(a), dy: Math.sin(a), dmg: 1 + Math.floor(g() * 3) };
        }),
        // waveTick: bazen dalga/üretim sınırına yakın
        waveTick: g() < 0.4 ? 190 + Math.floor(g() * 20) : Math.floor(g() * 3000)
    };
}
const kopya = o => JSON.parse(JSON.stringify(o));

// 1) Çok tikli kıyas: 400 durum x 40 tik
let toplamRand = 0;
for (let s = 1; s <= 400; s++) {
    let A = durumUret(s), B = kopya(A);
    const ra = sayac(mulberry32(s * 31 + 5)), rb = sayac(mulberry32(s * 31 + 5));
    for (let t = 0; t < 40; t++) {
        A = orijinal(A, ra);
        B = cekirdek(B, rb);
        assert.deepStrictEqual(B, A, `durum ${s} tik ${t}`);
        assert.strictEqual(rb.n, ra.n, `rand sayısı ${s} tik ${t}`);
        // seçim ekranı açıksa her iki tarafta da aynı yükseltmeyi seç
        if (A.sv.choosing) {
            const i = Math.floor(ra() * 3); rb();
            orijinalPick(A, i);
            if (B.sv.choices[i]) { C.applyUpgrade(B.sv, B.state, B.sv.choices[i].id); B.sv.choosing = false; }
            assert.deepStrictEqual(B, A, `seçim ${s} tik ${t}`);
        }
    }
    toplamRand += ra.n;
}

// 2) Tek başına spawnEnemy (Tailgun ortak): dalga 1..20, doluluk sınırı dahil
for (let s = 1; s <= 400; s++) {
    const g = mulberry32(s + 99);
    const wave = 1 + Math.floor(g() * 20), n = Math.floor(g() * 62);
    const e1 = Array.from({ length: n }, (_, i) => ({ x: i, y: 0, hp: 1 })), e2 = kopya(e1);
    const ra = sayac(mulberry32(s)), rb = sayac(mulberry32(s));
    orijinalSpawnTailgun(e1, wave, ra);
    const ret = C.spawnEnemy(e2, wave, COLS, ROWS, rb);
    assert.deepStrictEqual(e2, e1);
    assert.strictEqual(rb.n, ra.n);
    assert.strictEqual(ret, n >= 60 ? null : e2[e2.length - 1]);
    if (n >= 60) assert.strictEqual(rb.n, 0, 'doluyken rand çağrılmaz');
}

// 3) Denge sayıları (tavanlar)
assert.strictEqual(C.spawnGap(1), 20);
assert.strictEqual(C.spawnGap(9), 4);
assert.strictEqual(C.spawnGap(10), 3);
assert.strictEqual(C.spawnGap(50), 3);
assert.strictEqual(C.enemySpeed(1), 0.08 + 0.006);
assert.strictEqual(C.enemySpeed(1000), 0.36);
assert.strictEqual(C.spawnGroup(11), 0);
assert.strictEqual(C.spawnGroup(12), 1);
assert.strictEqual(C.spawnGroup(20), 2);

// 4) Elmas birleşmesi: 81. elmas eskisinin XP'sini devralır, toplam XP korunur
{
    const gems = Array.from({ length: 80 }, (_, i) => ({ x: i, y: 0, v: 2 }));
    C.addGem(gems, 5, 5);
    assert.strictEqual(gems.length, 80);
    assert.strictEqual(gems[0].v, 4);
    assert.strictEqual(gems.reduce((a, g) => a + g.v, 0), 79 * 2 + 2 + 1);
}

// 5) newSv / UPGRADES
assert.deepStrictEqual(C.newSv(), { level: 1, xp: 0, need: 5, dmg: 1, cd: 10, multi: 1, magnet: 2.5, timer: 0, choosing: false, choices: [] });
assert.deepStrictEqual(C.UPGRADES, UPGRADES0);

console.log('survivor-core.test.js OK (400 durum x 40 tik, toplam rand çağrısı ' + toplamRand + ')');
