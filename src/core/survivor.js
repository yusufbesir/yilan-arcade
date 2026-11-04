'use strict';
// Survivor (ve Kuyruk Silahı ile paylaşılan düşman) saf mantığı: DOM, global durum, Math.random yok;
// rastgelelik `rand` argümanı. Durum nesneleri (sv, enemies, gems...) argüman olarak verilir ve yerinde güncellenir.
// Tarayıcıda window.YilanCore.survivor, Node'da module.exports. Rand çağrı sırası game.js 0.9.4 ile aynıdır.
(function (kok, fabrika) {
    const m = fabrika();
    if (typeof module === 'object' && module.exports) module.exports = m;
    else { kok.YilanCore = kok.YilanCore || {}; kok.YilanCore.survivor = m; }
})(typeof self !== 'undefined' ? self : this, function () {
    const UPGRADES = [
        { id: 'dmg', text: 'HASAR +1' },
        { id: 'rate', text: 'ATEŞ HIZI +25%' },
        { id: 'multi', text: 'ÇOKLU ATIŞ +1' },
        { id: 'magnet', text: 'MIKNATIS +1.5' },
        { id: 'life', text: 'CANI DOLDUR' }
    ];

    function newSv() {
        return { level: 1, xp: 0, need: 5, dmg: 1, cd: 10, multi: 1, magnet: 2.5, timer: 0, choosing: false, choices: [] };
    }

    // Düşman üretimi (Tailgun ile ortak). rand sırası: kenar; dalga>=4 ise HP zarı; sonra x/y (2. rand).
    // Üst sınır doluysa rand çağrılmaz ve null döner.
    function spawnEnemy(enemies, wave, COLS, ROWS, rand) {
        if (enemies.length >= 60) return null;
        const side = Math.floor(rand() * 4);
        const e = { x: 0, y: 0, hp: wave >= 4 && rand() < 0.25 ? 2 : 1 };
        if (side === 0) { e.x = rand() * COLS; e.y = -1; }
        else if (side === 1) { e.x = rand() * COLS; e.y = ROWS; }
        else if (side === 2) { e.x = -1; e.y = rand() * ROWS; }
        else { e.x = COLS; e.y = rand() * ROWS; }
        enemies.push(e);
        return e;
    }

    // Oyuncu mermileri: 3 alt adımda ilerler, her adımda çarpışma bakar. Yeni diziler döner.
    function moveShots(playerShots, enemies, COLS, ROWS, onKill) {
        const shots = playerShots.filter(s => {
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
        return { shots, enemies: enemies.filter(e => e.hp > 0) };
    }

    function nearestEnemy(enemies, h) {
        let best = null, bd = 1e9;
        for (const e of enemies) {
            const d = Math.hypot(e.x - h.x, e.y - h.y);
            if (d < bd) { bd = d; best = e; }
        }
        return bd <= 11 ? best : null;
    }

    // Her 200 tikte dalga artar.
    function waveAdvances(waveTick) { return waveTick % 200 === 0; }
    // Denge: dalga 10'dan sonra da zorluk artar (gap/hız tavanı)
    function spawnGap(wave) { return Math.max(3, 22 - wave * 2); }
    function enemySpeed(wave) { return Math.min(0.36, 0.08 + wave * 0.006); }
    function spawnGroup(wave) { return wave >= 12 ? 1 + Math.floor((wave - 12) / 8) : 0; }

    // Üretim adımı (waveTick % gap === 0 ise çağrılır): grup kadar düşman, HP ölçeği. rand sırası orijinalle aynı.
    function spawnWaveStep(enemies, wave, COLS, ROWS, rand) {
        const grup = spawnGroup(wave);
        for (let k = 0; k <= Math.min(grup, 3); k++) {
            const n0 = enemies.length;
            spawnEnemy(enemies, wave, COLS, ROWS, rand);
            if (enemies.length === n0) break;
            const ne = enemies[enemies.length - 1];
            if (wave >= 3 && rand() < 0.3) ne.hp = 1 + Math.floor(wave / 3);
            if (wave >= 10) ne.hp = Math.max(ne.hp, 1 + Math.floor((wave - 6) / 3));
        }
    }

    // Otomatik ateş sayacı: sv.timer'ı ve playerShots'ı günceller.
    function autoFire(sv, head, enemies, playerShots) {
        sv.timer++;
        if (sv.timer >= sv.cd) {
            const t = nearestEnemy(enemies, head);
            if (t) {
                sv.timer = 0;
                const a = Math.atan2(t.y - head.y, t.x - head.x);
                for (let i = 0; i < sv.multi; i++) {
                    const off = (i - (sv.multi - 1) / 2) * 0.25;
                    playerShots.push({ x: head.x, y: head.y, dx: Math.cos(a + off), dy: Math.sin(a + off), dmg: sv.dmg });
                }
            }
        }
    }

    function moveEnemies(enemies, head, espd) {
        enemies.forEach(e => {
            const a = Math.atan2(head.y - e.y, head.x - e.x);
            e.x += Math.cos(a) * espd;
            e.y += Math.sin(a) * espd;
        });
    }

    // Öldürülen düşmandan XP elması; 80 üstünde en eski elmas XP'siyle birleşir, silinmez.
    function addGem(gems, x, y) {
        gems.push({ x, y, v: 1 });
        if (gems.length > 80) { const o = gems.shift(); gems[0].v = (gems[0].v || 1) + (o.v || 1); }
    }

    // Mıknatıs menzilindeki elmaslar toplanır; yeni gems dizisi döner. Seviye atlama: onLevelUp() (sv'yi günceller),
    // artan XP korunur. Her toplanan elmasta xpChanged çağrılır (HUD).
    function collectGems(gems, head, sv, onLevelUp, xpChanged) {
        return gems.filter(g => {
            const d = Math.hypot(head.x - g.x, head.y - g.y);
            if (d < sv.magnet) {
                sv.xp += g.v || 1;
                if (sv.xp >= sv.need) { const artan = sv.xp - sv.need; onLevelUp(); sv.xp = artan; }
                if (xpChanged) xpChanged();
                return false;
            }
            return true;
        });
    }

    // Kafaya değen ilk düşmanın indeksi (yoksa -1).
    function headHit(enemies, head) {
        for (let i = 0; i < enemies.length; i++) {
            if (Math.hypot(head.x - enemies[i].x, head.y - enemies[i].y) < 1.0) return i;
        }
        return -1;
    }

    // Seviye atlama: sayaçlar + 3 rastgele yükseltme seçeneği (sort karşılaştırıcısı rand çağırır).
    function levelUpStats(sv, rand) {
        sv.level++;
        sv.xp = 0;
        sv.need = 5 + sv.level * 3;
        const pool = UPGRADES.slice().sort(() => rand() - 0.5);
        sv.choices = pool.slice(0, 3);
        sv.choosing = true;
    }

    // Yükseltme uygular (choosing'i kapatmaz). 'life' state.lives'ı doldurur; true dönerse HUD yenilenmeli.
    function applyUpgrade(sv, state, id) {
        switch (id) {
            case 'dmg': sv.dmg += 1; break;
            case 'rate': sv.cd = Math.max(3, Math.round(sv.cd * 0.8)); break;
            case 'multi': sv.multi = Math.min(5, sv.multi + 1); break;
            case 'magnet': sv.magnet = Math.min(8, sv.magnet + 1.5); break;
            case 'life': state.lives = 3; return true;
        }
        return false;
    }

    return { UPGRADES, newSv, spawnEnemy, moveShots, nearestEnemy, waveAdvances, spawnGap, enemySpeed, spawnGroup,
        spawnWaveStep, autoFire, moveEnemies, addGem, collectGems, headHit, levelUpStats, applyUpgrade };
});
