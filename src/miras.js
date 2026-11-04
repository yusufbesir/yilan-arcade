// ========================================================================
// MİRAS - kalıcı tecrübe (roguelite). Her oyunun sonunda "Kül" kazanılır,
// Kül ile kalıcı yetenekler alınır. Dışa bağımlılık yok; yalnız localStorage.
// ========================================================================
const Miras = (() => {
    const KEY = 'twilightMiras';
    const MAX_TIER = 3;
    const LIMIT = 1e9;

    // Yetenek tanımları: maliyet[kademe-1], etki[kademe] (0. kademe = etki yok)
    const YETENEK = [
        { id: 'can',      ad: 'Ekstra Can',      ic: '❤️', acik: 'Can kullanan modlarda +1 can.',                maliyet: [40, 110, 240], etki: [0, 1, 2, 3],           fmt: v => '+' + v + ' can' },
        { id: 'kalkan',   ad: 'Kalkan Başlangıcı', ic: '🛡️', acik: 'Oyuna kalkanla başla.',                       maliyet: [30, 80, 170],  etki: [0, 8, 12, 18],         fmt: v => v + ' sn kalkan' },
        { id: 'istah',    ad: 'Altın İştah',     ic: '🍎', acik: 'Yem puanı artar.',                              maliyet: [35, 90, 190],  etki: [0, 0.1, 0.2, 0.3],     fmt: v => '+%' + Math.round(v * 100) + ' yem puanı' },
        { id: 'carpan',   ad: 'Kül Çarpanı',     ic: '🔥', acik: 'Oyun sonu Kül kazancı artar.',                  maliyet: [50, 120, 260], etki: [0, 0.15, 0.3, 0.45],   fmt: v => '+%' + Math.round(v * 100) + ' Kül' },
        { id: 'sakin',    ad: 'Sakin Başlangıç', ic: '🌙', acik: 'İlk 3 yemde yılan yavaş akar.',                 maliyet: [25, 70, 150],  etki: [0, 0.12, 0.2, 0.3],    fmt: v => '%' + Math.round(v * 100) + ' yavaş' },
        { id: 'miknatis', ad: 'Mıknatıs Kemer',  ic: '🧲', acik: 'Klasik benzeri modlarda yeme yaklaşınca çeker.', maliyet: [45, 110, 230], etki: [0, 1, 2, 3],           fmt: v => ['', 'önü-yanı', 'çaprazlar da', '2 hücre ileri de'][v] }
    ];

    // Mod başına Kül ağırlığı (varsayılan 1)
    const AGIRLIK = { classic: 1, campaign: 1.2, bullet: 0.7, tailgun: 0.7, survivor: 0.6, timeattack: 1, portal: 1, tron: 4, chaos: 1.2, daily: 1.1, tapinak: 1.8 };

    function bos() { return { kul: 0, toplamXp: 0, seviye: 1, yetenekler: {} }; }
    let durum = bos();

    const sayi = v => typeof v === 'number' && isFinite(v) && v >= 0 && v <= LIMIT;

    // Kümülatif tecrübeden seviye: n -> n+1 için 40 + 25*(n-1) Kül tecrübesi gerekir
    function ilerleme(xp) {
        let sv = 1, kalan = Math.max(0, Math.floor(xp));
        let gerek = 40;
        while (kalan >= gerek && sv < 999) { kalan -= gerek; sv++; gerek = 40 + 25 * (sv - 1); }
        return { seviye: sv, mevcut: kalan, gerek };
    }

    function kaydet() {
        try { localStorage.setItem(KEY, JSON.stringify({ v: 1, kul: durum.kul, toplamXp: durum.toplamXp, yetenekler: durum.yetenekler })); } catch (e) {}
    }

    function yukle() {
        durum = bos();
        let ham = null;
        try { ham = JSON.parse(localStorage.getItem(KEY)); } catch (e) { ham = null; }
        if (!ham || typeof ham !== 'object' || Array.isArray(ham)) return;
        if (!sayi(ham.kul) || !sayi(ham.toplamXp)) { // bozuk veri: sıfırla
            try { localStorage.removeItem(KEY); } catch (e) {}
            return;
        }
        durum.kul = Math.floor(ham.kul);
        durum.toplamXp = Math.floor(ham.toplamXp);
        const y = ham.yetenekler && typeof ham.yetenekler === 'object' && !Array.isArray(ham.yetenekler) ? ham.yetenekler : {};
        YETENEK.forEach(t => {
            const k = parseInt(y[t.id], 10);
            if (k >= 1 && k <= MAX_TIER) durum.yetenekler[t.id] = k;
        });
        durum.seviye = ilerleme(durum.toplamXp).seviye;
    }

    function tanim(id) { return YETENEK.find(t => t.id === id) || null; }
    function tier(id) { return durum.yetenekler[id] || 0; }
    function value(id) { const t = tanim(id); return t ? t.etki[tier(id)] : 0; }

    function award(o) {
        o = o || {};
        const score = sayi(o.score) ? o.score : 0;
        const w = Object.prototype.hasOwnProperty.call(AGIRLIK, o.mode) ? AGIRLIK[o.mode] : 1;
        const ham = score * w + 2 + (o.won ? 8 : 0); // ölüm cezası yok: en az 2 Kül
        const gained = Math.max(1, Math.round(ham * (1 + value('carpan'))));
        const onceki = ilerleme(durum.toplamXp).seviye;
        durum.kul = Math.min(LIMIT, durum.kul + gained);
        durum.toplamXp = Math.min(LIMIT, durum.toplamXp + gained);
        durum.seviye = ilerleme(durum.toplamXp).seviye;
        kaydet();
        return { gained, levelUp: durum.seviye > onceki, level: durum.seviye };
    }

    function cost(id) {
        const t = tanim(id);
        if (!t || tier(id) >= MAX_TIER) return null;
        return t.maliyet[tier(id)];
    }

    function buy(id) {
        const c = cost(id);
        if (c === null || durum.kul < c) return false;
        durum.kul -= c;
        durum.yetenekler[id] = tier(id) + 1;
        kaydet();
        return true;
    }

    // Market gibi dış harcamalar için: Kül düşer (tecrübe/seviye etkilenmez). Yetmezse false.
    function harca(n) {
        n = Math.floor(n);
        if (!(n >= 0) || n > durum.kul) return false;
        durum.kul -= n;
        kaydet();
        return true;
    }
    function bakiye() { return durum.kul; }

    function reset() { durum = bos(); try { localStorage.removeItem(KEY); } catch (e) {} }

    return {
        YETENEK, MAX_TIER,
        award, buy, value, tier, cost, reset, load: yukle, harca, bakiye,
        get kul() { return durum.kul; },
        get toplamXp() { return durum.toplamXp; },
        get seviye() { return durum.seviye; },
        progress: () => ilerleme(durum.toplamXp),
        state: () => ({ kul: durum.kul, toplamXp: durum.toplamXp, seviye: durum.seviye, yetenekler: { ...durum.yetenekler } })
    };
})();
Miras.load();
