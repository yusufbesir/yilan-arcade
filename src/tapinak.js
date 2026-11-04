// ========================================================================
// TAPINAK: oda oda aksiyon + metroidvania modu (Twilight of the Serpents)
// Saf mantık (DOM yok, tohumlu, test edilebilir) + tuval çizim yardımcıları.
// game.js'e yalnız kancalarla bağlanır (startTapinak, tickTapinak, drawTapinak*).
// Tüm görseller kodla çizilir; hiçbir oyunun varlığı ya da metni kullanılmaz.
// ========================================================================
const Tapinak = (() => {
    const W = 48, H = 32, C = 20;
    const ZEMIN = 0, DUVAR = 1, SUTUN = 2, UCURUM = 3, CATLAK = 4, KILIT = 5, KAPI = 6;
    const YON = { n: { x: 0, y: -1 }, s: { x: 0, y: 1 }, w: { x: -1, y: 0 }, e: { x: 1, y: 0 } };
    const TERS = { n: 's', s: 'n', w: 'e', e: 'w' };
    const ANAHTAR = 'twilightTapinak';

    const ARMAGANLAR = {
        hasar: { ad: 'HASAR', acik: 'ATIŞ HASARI +1', renk: '#ff6b5e' },
        hiz: { ad: 'HIZ', acik: 'ATIŞ ARALIĞI KISALIR', renk: '#ffd84a' },
        can: { ad: 'CAN', acik: '+1 CAN', renk: '#ff4d7a' },
        coklu: { ad: 'ÇOKLU ATIŞ', acik: '+1 PARALEL MERMİ', renk: '#7fd6ff' },
        zehir: { ad: 'ZEHİR', acik: 'MERMİLER ZEHİRLER', renk: '#7CFF6B' },
        kalkan: { ad: 'KALKAN', acik: 'HER ODADA 1 DARBE EMER', renk: '#5ec4ff' },
        diken: { ad: 'DİKEN PUL', acik: 'GÖVDE ÇARPIŞMASI +1', renk: '#d9a2ff' }
    };
    const YETENEKLER = {
        atilim: { ad: 'ATILIM', acik: 'SHIFT: 3 HÜCRE İLERİ ATIL', renk: '#7fe3ff' },
        kirici: { ad: 'KIRICI ATIŞ', acik: 'ATIŞLAR ÇATLAK DUVARI KIRAR', renk: '#ffb36b' },
        anahtar: { ad: 'KÖK ANAHTARI', acik: 'RÜN KİLİTLİ KAPILARI AÇAR', renk: '#e8c46a' }
    };
    const DUSMANLAR = {
        kovalayan: { ad: 'HORTLAK', hp: 2, hiz: 0.12, puan: 10, r: 0.45 },
        atici: { ad: 'RÜN CADISI', hp: 2, hiz: 0.08, puan: 15, r: 0.45 },
        zirhli: { ad: 'TAŞ MUHAFIZ', hp: 6, hiz: 0.06, puan: 25, r: 0.55, zirh: 0.5 }
    };

    // 3x3 harita: (x,y), y=0 üst sıra. Boss orta-üstte, gizli odalar üst köşelerde.
    const HARITA = {
        '0,0': { tur: 'gizli', ad: 'KIRIK RÜN SUNAĞI', odul: 'kirici' },
        '1,0': { tur: 'boss', ad: "KÜL JARLI'NIN TAHTI" },
        '2,0': { tur: 'gizli', ad: 'KÖK SUNAĞI', odul: 'anahtar' },
        '0,1': { tur: 'savas' }, '1,1': { tur: 'savas' }, '2,1': { tur: 'savas' },
        '0,2': { tur: 'savas' }, '1,2': { tur: 'baslangic', ad: 'GİRİŞ AVLUSU' }, '2,2': { tur: 'hazine', ad: 'ALTIN KASA' }
    };
    // [oda, yön, engel] — engel yalnız bu taraftan geçişte geçerlidir (öbür taraftan dönüş serbest)
    const BAGLAR = [
        ['1,2', 'w', null], ['1,2', 'n', null], ['1,2', 'e', 'anahtar'],
        ['0,2', 'n', null], ['0,1', 'e', null], ['1,1', 'e', null], ['1,1', 'n', null],
        ['0,1', 'n', 'atilim'], ['2,1', 'n', 'kirici']
    ];
    const SAVAS_ADLARI = ['KEMİK SALONU', 'KÜL GEÇİDİ', 'RÜN MAHZENİ', 'DONMUŞ AVLU', 'KUZGUN YUVASI', 'SİS DEHLİZİ', 'ZİNCİR ODASI'];

    // ======================== YARDIMCILAR ========================
    function mulberry(a) {
        a = a >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function komsu(k, yon) {
        const [x, y] = k.split(',').map(Number);
        const nx = x + YON[yon].x, ny = y + YON[yon].y;
        return nx >= 0 && ny >= 0 && nx < 3 && ny < 3 ? nx + ',' + ny : null;
    }
    function hucre(oda, x, y) {
        if (x < 0 || y < 0 || x >= W || y >= H) return DUVAR;
        return oda.g[y * W + x];
    }
    function kapiHucreleri(yon) {
        const out = [];
        for (let i = 0; i < 4; i++) {
            if (yon === 'n') out.push({ x: 22 + i, y: 0 });
            else if (yon === 's') out.push({ x: 22 + i, y: H - 1 });
            else if (yon === 'w') out.push({ x: 0, y: 14 + i });
            else out.push({ x: W - 1, y: 14 + i });
        }
        return out;
    }
    function kapiYonu(x, y) { return y <= 0 ? 'n' : y >= H - 1 ? 's' : x <= 0 ? 'w' : 'e'; }
    function olay(run, t, v) { run.ev.push(Object.assign({ t }, v || {})); if (run.ev.length > 200) run.ev.shift(); }
    function ipucu(run, k, metin) { if (!run.ipucu[k]) { run.ipucu[k] = true; olay(run, 'ipucu', { metin }); } }

    // ======================== ÜRETİM (tohumlu) ========================
    function odaUret(k, rng) {
        const [rx, ry] = k.split(',').map(Number);
        const def = HARITA[k];
        const g = new Uint8Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x === 0 || y === 0 || x === W - 1 || y === H - 1) g[y * W + x] = DUVAR;
        const kapilar = {};
        BAGLAR.forEach(([a, yon, engel]) => {
            const b = komsu(a, yon);
            if (a === k) kapilar[yon] = { to: b, engel };
            else if (b === k) kapilar[TERS[yon]] = { to: a, engel: null };
        });
        Object.keys(kapilar).forEach(yon => {
            const engel = kapilar[yon].engel;
            const tip = engel === 'kirici' ? CATLAK : engel === 'anahtar' ? KILIT : KAPI;
            kapiHucreleri(yon).forEach(c => { g[c.y * W + c.x] = tip; });
            if (engel === 'atilim') { // kapı önünde 2 sıra uçurum şeridi: yalnız Atılım ile aşılır
                const ic = YON[TERS[yon]];
                for (let d = 1; d <= 2; d++) for (let s = -6; s <= 7; s++) {
                    let x, y;
                    if (yon === 'n' || yon === 's') { x = 22 + s; y = (yon === 'n' ? 0 : H - 1) + ic.y * d; }
                    else { y = 14 + s; x = (yon === 'w' ? 0 : W - 1) + ic.x * d; }
                    if (x > 0 && y > 0 && x < W - 1 && y < H - 1) g[y * W + x] = UCURUM;
                }
            }
        });
        // Sütunlar: kapı şeritleri (x 16..31 / y 11..20) ve orta alan hep boş kalır
        const sutunlar = [];
        if (def.tur === 'boss') sutunlar.push([8, 6], [38, 6], [8, 24], [38, 24]);
        else if (def.tur !== 'hazine') {
            const n = 1 + Math.floor(rng() * 3);
            for (let i = 0; i < n; i++) {
                const px = 4 + Math.floor(rng() * 11);
                const py = rng() < 0.5 ? 4 + Math.floor(rng() * 7) : 19 + Math.floor(rng() * 8);
                sutunlar.push([px, py], [W - 2 - px, py]);
            }
        }
        sutunlar.forEach(([px, py]) => {
            for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) if (g[(py + dy) * W + px + dx] === ZEMIN) g[(py + dy) * W + px + dx] = SUTUN;
        });
        const d = Math.abs(rx - 1) + Math.abs(ry - 2);
        let dalgalar = [];
        if (def.tur === 'savas') {
            dalgalar = [3 + d, 4 + d].map(n => Array.from({ length: n }, () => {
                const r = rng();
                return r < 0.5 - d * 0.05 ? 'kovalayan' : r < 0.82 ? 'atici' : 'zirhli';
            }));
        } else if (def.tur === 'gizli') dalgalar = [['zirhli', 'atici', 'zirhli']];
        const havuz = Object.keys(ARMAGANLAR);
        const a = Math.floor(rng() * havuz.length);
        let b = Math.floor(rng() * (havuz.length - 1));
        if (b >= a) b++;
        return {
            k, rx, ry, tur: def.tur, ad: def.ad || '', odul: def.odul || null, g, kapilar, dalgalar,
            teklif: [havuz[a], havuz[b]], derinlik: d, desen: Math.floor(rng() * 1e9),
            ziyaret: false, temiz: def.tur === 'baslangic' || def.tur === 'hazine',
            dalga: 0, bekle: 0, dusmanlar: [], dogumlar: [], kemerler: null, sunak: null,
            sandik: def.tur === 'hazine' ? { x: 23, y: 13 } : null, cikis: null, boss: null
        };
    }

    function yeniKosu(tohum, yetenek) {
        const seed = (Number(tohum) >>> 0) || 1;
        const rng = mulberry(seed);
        const odalar = {};
        Object.keys(HARITA).sort().forEach(k => { odalar[k] = odaUret(k, rng); });
        const adlar = SAVAS_ADLARI.slice();
        for (let i = adlar.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [adlar[i], adlar[j]] = [adlar[j], adlar[i]]; }
        Object.keys(odalar).sort().forEach(k => { if (!odalar[k].ad) odalar[k].ad = adlar.pop(); });
        const y = yetenek || {};
        const run = {
            tohum: seed, rng: mulberry(seed ^ 0x9E3779B9), odalar, oda: '1,2', t: 0, bitti: false, kazandi: false,
            yetenek: { atilim: y.atilim === true, kirici: y.kirici === true, anahtar: y.anahtar === true },
            snake: [], dir: { x: 0, y: -1 }, want: { x: 0, y: -1 },
            can: 3, canMax: 3, kalkan: 0, kalkanMax: 0, inv: 0,
            hasar: 1, atisBekleme: 4, coklu: 1, zehir: 0, diken: 0, armaganlar: [],
            skor: 0, oldurulen: 0, atisCd: 0, atilCd: 0, mermiler: [], oklar: [], ozler: [], izler: [], ipucu: {}, ev: []
        };
        odayaGir(run, '1,2', null, null);
        return run;
    }

    // Aynı tohumdan aynı harita: testler için düzenin özeti
    function duzen(run) {
        return Object.keys(run.odalar).sort().map(k => {
            const o = run.odalar[k];
            return [k, o.tur, o.ad, Array.from(o.g).join(''), JSON.stringify(o.dalgalar), o.teklif.join('+'), o.desen].join('|');
        }).join('\n');
    }

    // ======================== ODA GEÇİŞİ ========================
    function odayaGir(run, k, taraf, eski) {
        const oda = run.odalar[k];
        run.oda = k;
        const ilk = !oda.ziyaret;
        oda.ziyaret = true;
        run.mermiler = []; run.oklar = []; run.ozler = []; run.izler = [];
        run.kalkan = run.kalkanMax;
        const L = Math.max(6, run.snake.length);
        run.snake = [];
        let yon;
        if (!taraf) {
            for (let i = 0; i < L; i++) run.snake.push({ x: 23, y: 22 + Math.min(i, 7) });
            yon = { x: 0, y: -1 };
        } else {
            const ic = YON[TERS[taraf]];
            const kh = kapiHucreleri(taraf);
            let kapi = kh[1];
            if (eski) {
                const m = kh.find(c => (taraf === 'n' || taraf === 's') ? c.x === eski.x : c.y === eski.y);
                if (m) kapi = m;
            }
            let j = 2; // uçurum şeridinin üstüne doğmasın
            while (j < 6 && hucre(oda, kapi.x + ic.x * j, kapi.y + ic.y * j) === UCURUM) j++;
            for (let i = j; i >= 1; i--) run.snake.push({ x: kapi.x + ic.x * i, y: kapi.y + ic.y * i });
            while (run.snake.length < L) run.snake.push({ x: kapi.x + ic.x, y: kapi.y + ic.y });
            yon = { x: ic.x, y: ic.y };
        }
        run.dir = { ...yon }; run.want = { ...yon };
        run.inv = Math.max(run.inv, 6);
        if (!oda.temiz) {
            oda.dalga = 0; oda.bekle = 18; oda.dusmanlar = []; oda.dogumlar = [];
            if (oda.tur === 'boss') oda.boss = yeniBoss();
        }
        olay(run, 'oda', { k, ad: oda.ad, ilk, tur: oda.tur });
    }

    function gecis(run, yon) {
        const oda = run.odalar[run.oda];
        const kp = oda.kapilar[yon];
        if (!kp || !kp.to) return false;
        const h = run.snake[0];
        odayaGir(run, kp.to, TERS[yon], { x: h.x, y: h.y });
        return true;
    }

    // ======================== OYUNCU ========================
    function hasar(run, sebep) {
        if (run.inv > 0 || run.bitti) return false;
        if (run.kalkan > 0) { run.kalkan--; run.inv = 10; olay(run, 'kalkan', {}); return true; }
        run.can--;
        run.inv = 20; // hasar sonrası kısa dokunulmazlık
        const h = run.snake[0];
        olay(run, 'hasar', { sebep, x: h.x + 0.5, y: h.y + 0.5 });
        if (run.can <= 0) { run.can = 0; run.bitti = true; run.kazandi = false; olay(run, 'bitti', { won: false }); }
        return true;
    }

    function don(run) {
        const oda = run.odalar[run.oda], h = run.snake[0], d = run.dir;
        let best = null, bs = 0;
        [{ x: -d.y, y: d.x }, { x: d.y, y: -d.x }].forEach(a => {
            let s = 0;
            for (let i = 1; i <= 8; i++) {
                const x = h.x + a.x * i, y = h.y + a.y * i;
                if (hucre(oda, x, y) !== ZEMIN || run.snake.some(p => p.x === x && p.y === y)) break;
                s++;
            }
            if (s > bs) { bs = s; best = a; }
        });
        if (best) { run.dir = { ...best }; run.want = { ...best }; return; }
        // çıkmaz: yılanı ters çevir
        run.snake.reverse();
        const a = run.snake[0], b = run.snake[1] || a;
        const nd = { x: Math.sign(a.x - b.x), y: Math.sign(a.y - b.y) };
        if (nd.x || nd.y) { run.dir = nd; run.want = { ...nd }; }
    }

    function ilerle(run) {
        const oda = run.odalar[run.oda];
        const h = run.snake[0], d = run.dir;
        const nx = h.x + d.x, ny = h.y + d.y;
        const c = hucre(oda, nx, ny);
        if (c === KAPI && oda.temiz) { run.snake.unshift({ x: nx, y: ny }); run.snake.pop(); gecis(run, kapiYonu(nx, ny)); return; }
        if (c === KILIT && run.yetenek.anahtar) { donustur(oda, KILIT, KAPI); olay(run, 'kilit', { x: nx + 0.5, y: ny + 0.5 }); return; } // bir tik durur, sonra geçer
        if (c !== ZEMIN) {
            if (c === UCURUM) ipucu(run, 'ucurum', run.yetenek.atilim ? 'UÇURUM! SHIFT İLE ATIL' : 'UÇURUM: ATILIM GEREKİR');
            else if (c === CATLAK) ipucu(run, 'catlak', run.yetenek.kirici ? 'ÇATLAK DUVAR: ATEŞ ET!' : 'ÇATLAK DUVAR: KIRICI ATIŞ GEREKİR');
            else if (c === KILIT) ipucu(run, 'kilit', 'RÜN KİLİDİ: KÖK ANAHTARI GEREKİR');
            else if (c === KAPI) ipucu(run, 'kapi', 'KAPILAR MÜHÜRLÜ: ODAYI TEMİZLE');
            hasar(run, 'duvar');
            don(run);
            return;
        }
        const n = run.snake.length;
        if (run.snake.some((s, i) => i > 0 && i < n - 1 && s.x === nx && s.y === ny)) hasar(run, 'kendi');
        run.snake.unshift({ x: nx, y: ny });
        run.snake.pop();
        tetikler(run, oda);
    }

    function icinde(o, h) { return o && h.x >= o.x && h.x <= o.x + 1 && h.y >= o.y && h.y <= o.y + 1; }
    function tetikler(run, oda) {
        const h = run.snake[0];
        if (oda.kemerler) { const i = oda.kemerler.findIndex(k => icinde(k, h)); if (i >= 0) sec(run, i); }
        if (oda.sunak && icinde(oda.sunak, h)) sunakAl(run, oda);
        if (oda.sandik && icinde(oda.sandik, h)) sandikAc(run, oda);
        if (oda.cikis && icinde(oda.cikis, h)) {
            run.bitti = true; run.kazandi = true;
            run.skor += 1000 + run.can * 100;
            olay(run, 'bitti', { won: true });
        }
    }

    function ates(run) {
        if (run.bitti || run.atisCd > 0 || run.snake.length <= 3) return false;
        run.snake.pop();
        const h = run.snake[0], d = run.dir, px = -d.y, py = d.x;
        const ofs = run.coklu === 1 ? [0] : run.coklu === 2 ? [-0.5, 0.5] : [-1, 0, 1];
        ofs.forEach(o => run.mermiler.push({ x: h.x + 0.5 + px * o, y: h.y + 0.5 + py * o, dx: d.x, dy: d.y, dmg: run.hasar, zehir: run.zehir, omur: 30 }));
        run.atisCd = run.atisBekleme;
        olay(run, 'ates', {});
        return true;
    }

    function atil(run) {
        if (run.bitti || !run.yetenek.atilim || run.atilCd > 0) return false;
        const oda = run.odalar[run.oda], h0 = run.snake[0], d = run.dir;
        let son = 0, kapi = 0;
        for (let k = 1; k <= 5; k++) {
            const c = hucre(oda, h0.x + d.x * k, h0.y + d.y * k);
            if (c === KAPI && oda.temiz) { kapi = k; break; }
            if (c === UCURUM) continue;
            if (c !== ZEMIN) break;
            son = k;
            if (k >= 3) break;
        }
        const n = kapi || son;
        if (!n) return false;
        const x0 = h0.x, y0 = h0.y;
        for (let i = 1; i <= n; i++) { run.snake.unshift({ x: x0 + d.x * i, y: y0 + d.y * i }); run.snake.pop(); }
        run.inv = Math.max(run.inv, 4);
        run.atilCd = 18;
        const h = run.snake[0];
        run.izler.push({ x0: x0 + 0.5, y0: y0 + 0.5, x1: h.x + 0.5, y1: h.y + 0.5, t: 10 });
        olay(run, 'atilim', { x0: x0 + 0.5, y0: y0 + 0.5, x1: h.x + 0.5, y1: h.y + 0.5 });
        // yoldaki düşmanlar sıyrılır
        for (const e of oda.dusmanlar) {
            for (let i = 0; i <= n; i++) {
                if (Math.hypot(x0 + d.x * i + 0.5 - e.x, y0 + d.y * i + 0.5 - e.y) < 0.9) { e.hp -= 1 + run.diken; e.flash = 5; break; }
            }
        }
        if (kapi) gecis(run, kapiYonu(h.x, h.y));
        else tetikler(run, oda);
        return true;
    }

    // ======================== ARMAĞAN / YETENEK ========================
    function dolu(run, id) {
        return (id === 'hiz' && run.atisBekleme <= 1) || (id === 'coklu' && run.coklu >= 3) || (id === 'kalkan' && run.kalkanMax >= 2);
    }
    function kemerKur(run, oda) {
        let [a, b] = oda.teklif;
        if (dolu(run, a)) a = b === 'hasar' ? 'can' : 'hasar';
        if (dolu(run, b) || b === a) b = a === 'can' ? 'hasar' : 'can';
        oda.kemerler = [{ x: 18, y: 16, id: a }, { x: 28, y: 16, id: b }];
    }
    function sec(run, i) {
        const oda = run.odalar[run.oda];
        if (!oda.kemerler || !oda.kemerler[i]) return false;
        const id = oda.kemerler[i].id;
        oda.kemerler = null;
        armaganVer(run, id);
        return true;
    }
    function armaganVer(run, id) {
        switch (id) {
            case 'hasar': run.hasar += 1; break;
            case 'hiz': run.atisBekleme = Math.max(1, run.atisBekleme - 1); break;
            case 'can': if (run.can >= run.canMax) run.canMax = Math.min(5, run.canMax + 1); run.can = Math.min(run.canMax, run.can + 1); break;
            case 'coklu': run.coklu = Math.min(3, run.coklu + 1); break;
            case 'zehir': run.zehir += 1; break;
            case 'kalkan': run.kalkanMax = Math.min(2, run.kalkanMax + 1); run.kalkan = run.kalkanMax; break;
            case 'diken': run.diken += 1; break;
            default: return;
        }
        run.armaganlar.push(id);
        run.skor += 10;
        olay(run, 'armagan', { id, ad: ARMAGANLAR[id].ad, acik: ARMAGANLAR[id].acik });
    }
    function sunakAl(run, oda) {
        const s = oda.sunak;
        oda.sunak = null;
        if (s.yetenek && !run.yetenek[s.yetenek]) {
            run.yetenek[s.yetenek] = true;
            run.skor += 100;
            olay(run, 'yetenek', { id: s.yetenek, ad: YETENEKLER[s.yetenek].ad, acik: YETENEKLER[s.yetenek].acik });
        } else {
            run.can = run.canMax;
            run.skor += 150;
            olay(run, 'lutuf', {});
            if (oda.tur !== 'boss') kemerKur(run, oda);
        }
    }
    function sandikAc(run, oda) {
        oda.sandik = null;
        run.canMax = Math.min(5, run.canMax + 1);
        run.can = Math.min(run.canMax, run.can + 1);
        run.skor += 200;
        olay(run, 'sandik', {});
        kemerKur(run, oda);
    }
    function donustur(oda, a, b) { for (let i = 0; i < oda.g.length; i++) if (oda.g[i] === a) oda.g[i] = b; oda._cv = null; }

    // ======================== DÜŞMANLAR ========================
    function bosYer(run, oda, minD) {
        const h = run.snake[0];
        for (let i = 0; i < 80; i++) {
            const x = 3 + Math.floor(run.rng() * (W - 6)), y = 3 + Math.floor(run.rng() * (H - 6));
            if (hucre(oda, x, y) !== ZEMIN) continue;
            if (Math.hypot(x - h.x, y - h.y) < minD) continue;
            if (run.snake.some(s => s.x === x && s.y === y)) continue;
            return { x, y };
        }
        return null;
    }
    function yeniDusman(run, tur, x, y) {
        const t = DUSMANLAR[tur];
        return { tur, x, y, hp: t.hp, max: t.hp, cd: 40 + Math.floor(run.rng() * 30), sarj: 0, flash: 0, govdeCd: 0, zehirT: 0, zehirG: 0, yan: run.rng() < 0.5 ? 1 : -1, faz: run.rng() * 6.28 };
    }
    function serbest(oda, x, y) { return hucre(oda, Math.floor(x), Math.floor(y)) === ZEMIN; }
    function hareketEt(oda, e, vx, vy) {
        const r = 0.35;
        const nx = e.x + vx;
        if (serbest(oda, nx + Math.sign(vx) * r, e.y)) e.x = nx;
        const ny = e.y + vy;
        if (serbest(oda, e.x, ny + Math.sign(vy) * r)) e.y = ny;
    }
    function it(oda, e, vx, vy) {
        const n = Math.ceil(Math.hypot(vx, vy) / 0.4) || 1;
        for (let i = 0; i < n; i++) hareketEt(oda, e, vx / n, vy / n);
    }
    function ok(run, x, y, ang, spd, kaynak) {
        if (run.oklar.length > 160) return;
        run.oklar.push({ x, y, dx: Math.cos(ang) * spd, dy: Math.sin(ang) * spd, omur: 220, kaynak });
    }
    function vur(run, oda, e, m) {
        e.hp -= m.dmg * (DUSMANLAR[e.tur].zirh || 1);
        e.flash = 5;
        if (m.zehir) { e.zehirT = 60; e.zehirG = Math.max(e.zehirG, m.zehir); }
        it(oda, e, m.dx * 0.35, m.dy * 0.35);
    }
    function olum(run, e) {
        run.skor += DUSMANLAR[e.tur].puan;
        run.oldurulen++;
        if (run.ozler.length < 40) run.ozler.push({ x: e.x, y: e.y });
        olay(run, 'oldu', { x: e.x, y: e.y, tur: e.tur });
    }

    function dalgaAdim(run, oda) {
        if (oda.temiz || oda.tur === 'boss') return;
        if (oda.dusmanlar.length || oda.dogumlar.length || oda.dalga >= oda.dalgalar.length) return;
        if (--oda.bekle > 0) return;
        oda.dalgalar[oda.dalga].forEach(tur => {
            const p = bosYer(run, oda, 9);
            if (p) oda.dogumlar.push({ x: p.x + 0.5, y: p.y + 0.5, tur, t: 22 });
        });
        oda.dalga++;
        oda.bekle = 20;
        olay(run, 'dalga', { n: oda.dalga, top: oda.dalgalar.length });
    }
    function dogumAdim(run, oda) {
        oda.dogumlar = oda.dogumlar.filter(d => {
            if (--d.t > 0) return true;
            oda.dusmanlar.push(yeniDusman(run, d.tur, d.x, d.y));
            return false;
        });
    }

    function dusmanAdim(run, oda) {
        const h = run.snake[0], hx = h.x + 0.5, hy = h.y + 0.5;
        for (const e of oda.dusmanlar) {
            if (e.flash > 0) e.flash--;
            if (e.govdeCd > 0) e.govdeCd--;
            if (e.zehirT > 0) { e.zehirT--; if (e.zehirT % 15 === 0) { e.hp -= 0.5 * e.zehirG; e.flash = Math.max(e.flash, 2); } }
            const dx = hx - e.x, dy = hy - e.y, dist = Math.hypot(dx, dy) || 0.001;
            const ux = dx / dist, uy = dy / dist;
            const tip = DUSMANLAR[e.tur];
            const hiz = tip.hiz * (1 + oda.derinlik * 0.08);
            if (e.tur === 'atici') {
                let vx, vy;
                if (dist < 7) { vx = -ux; vy = -uy; } else if (dist > 11) { vx = ux; vy = uy; } else { vx = -uy * e.yan; vy = ux * e.yan; }
                if (e.sarj > 0) {
                    e.sarj--;
                    if (e.sarj === 0) { ok(run, e.x, e.y, Math.atan2(dy, dx), 0.24, 'atici'); e.cd = 55 + Math.floor(run.rng() * 25); }
                } else {
                    hareketEt(oda, e, vx * hiz, vy * hiz);
                    if (--e.cd <= 0) e.sarj = 16;
                }
                if ((run.t + Math.floor(e.faz * 10)) % 90 === 0) e.yan = -e.yan;
            } else hareketEt(oda, e, ux * hiz, uy * hiz);
            // baş teması: yılan yaralanır, düşman geri itilir
            if (dist < tip.r + 0.4) {
                hasar(run, 'temas');
                e.hp -= 1 + run.diken; e.flash = 5;
                it(oda, e, -ux * 1.6, -uy * 1.6);
            } else if (e.govdeCd <= 0) {
                // gövde çarpışması: düşman yaralanır
                for (let i = 1; i < run.snake.length; i++) {
                    const s = run.snake[i], sx = s.x + 0.5, sy = s.y + 0.5;
                    if (Math.hypot(sx - e.x, sy - e.y) < tip.r + 0.4) {
                        e.hp -= 1 + run.diken; e.flash = 5; e.govdeCd = 10;
                        const ax = e.x - sx, ay = e.y - sy, al = Math.hypot(ax, ay) || 1;
                        it(oda, e, ax / al * 1.2, ay / al * 1.2);
                        olay(run, 'govde', { x: e.x, y: e.y });
                        break;
                    }
                }
            }
        }
        // birbirinin içine girmesinler
        const ds = oda.dusmanlar;
        for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
            const a = ds[i], b = ds[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
            if (d > 0 && d < 0.9) { const p = (0.9 - d) / 2; hareketEt(oda, a, -dx / d * p, -dy / d * p); hareketEt(oda, b, dx / d * p, dy / d * p); }
        }
        oda.dusmanlar = oda.dusmanlar.filter(e => { if (e.hp > 0) return true; olum(run, e); return false; });
    }

    // ======================== BOSS: KÜL JARLI (3 faz) ========================
    function yeniBoss() {
        return { x: 24, y: 9, r: 1.7, hp: 60, max: 60, faz: 1, uyan: 40, t: 0, hedef: { x: 24, y: 10 }, sarj: 0, hamle: 0, hx: 0, hy: 1, aci: 0, flash: 0, govdeCd: 0 };
    }
    function halka(run, b, n, spd, ofs) {
        for (let i = 0; i < n; i++) ok(run, b.x, b.y, (ofs || 0) + i / n * Math.PI * 2, spd, 'boss');
    }
    function bossAdim(run, oda) {
        const b = oda.boss;
        if (!b) return;
        if (b.flash > 0) b.flash--;
        if (b.govdeCd > 0) b.govdeCd--;
        if (b.uyan > 0) { b.uyan--; if (b.uyan === 0) olay(run, 'faz', { faz: 1 }); return; }
        b.t++;
        const h = run.snake[0], hx = h.x + 0.5, hy = h.y + 0.5;
        const ang = Math.atan2(hy - b.y, hx - b.x);
        const faz = b.hp > b.max * 2 / 3 ? 1 : b.hp > b.max / 3 ? 2 : 3;
        if (faz !== b.faz) { b.faz = faz; b.sarj = 0; b.hamle = 0; run.oklar = []; olay(run, 'faz', { faz }); }
        if (b.hamle > 0) {
            b.hamle--;
            const nx = b.x + b.hx * 0.55, ny = b.y + b.hy * 0.55;
            if (nx < 3 || nx > W - 3 || ny < 3 || ny > H - 3) { b.hamle = 0; halka(run, b, 12, 0.22, b.t * 0.1); olay(run, 'sarsinti', {}); }
            else { b.x = nx; b.y = ny; }
        } else if (b.sarj > 0) {
            if (--b.sarj === 0) b.hamle = 18;
        } else {
            const tx = b.hedef.x - b.x, ty = b.hedef.y - b.y, td = Math.hypot(tx, ty);
            const sp = faz === 1 ? 0.06 : 0.085;
            if (td < 0.5) b.hedef = { x: 6 + run.rng() * (W - 12), y: 5 + run.rng() * (faz === 1 ? 10 : H - 12) };
            else { b.x += tx / td * sp; b.y += ty / td * sp; }
            if (faz === 1 && b.t % 50 === 0) halka(run, b, 10, 0.2, b.t * 0.05);
            if (faz === 2) {
                if (b.t % 34 === 0) [-0.28, 0, 0.28].forEach(o => ok(run, b.x, b.y, ang + o, 0.27, 'boss'));
                if (b.t % 150 === 0 && oda.dusmanlar.length + oda.dogumlar.length < 5) {
                    [-3, 3].forEach(s => { const x = Math.floor(b.x + s), y = Math.floor(b.y + 2); if (hucre(oda, x, y) === ZEMIN) oda.dogumlar.push({ x: x + 0.5, y: y + 0.5, tur: 'kovalayan', t: 20 }); });
                    olay(run, 'cagri', {});
                }
            }
            if (faz === 3) {
                if (b.t % 6 === 0) { b.aci += 0.55; ok(run, b.x, b.y, b.aci, 0.2, 'boss'); ok(run, b.x, b.y, b.aci + Math.PI, 0.2, 'boss'); }
                if (b.t % 85 === 0) { b.sarj = 20; b.hx = Math.cos(ang); b.hy = Math.sin(ang); olay(run, 'nisan', {}); }
            }
        }
        const d = Math.hypot(hx - b.x, hy - b.y);
        if (d < b.r + 0.4) hasar(run, 'boss');
        else if (b.govdeCd <= 0) {
            for (let i = 1; i < run.snake.length; i++) {
                const s = run.snake[i];
                if (Math.hypot(s.x + 0.5 - b.x, s.y + 0.5 - b.y) < b.r + 0.35) { b.govdeCd = 10; olay(run, 'govde', { x: s.x + 0.5, y: s.y + 0.5 }); bossVur(run, oda, 1 + run.diken); break; }
            }
        }
    }
    function bossVur(run, oda, dmg) {
        const b = oda.boss;
        if (!b || b.uyan > 0) return;
        b.hp -= dmg;
        b.flash = 4;
        if (b.hp <= 0) {
            oda.boss = null;
            run.skor += 500;
            run.oklar = [];
            olay(run, 'bossOldu', { x: b.x, y: b.y });
            temizle(run, oda);
        }
    }

    // ======================== MERMİLER ========================
    function mermiAdim(run, oda) {
        run.mermiler = run.mermiler.filter(m => {
            for (let i = 0; i < 3; i++) {
                m.x += m.dx * 0.5; m.y += m.dy * 0.5;
                const cx = Math.floor(m.x), cy = Math.floor(m.y), c = hucre(oda, cx, cy);
                if (c === CATLAK) {
                    if (run.yetenek.kirici) { donustur(oda, CATLAK, KAPI); run.skor += 20; olay(run, 'kirildi', { x: m.x, y: m.y }); }
                    else { ipucu(run, 'catlak', 'ÇATLAK DUVAR: KIRICI ATIŞ GEREKİR'); olay(run, 'sekti', { x: m.x, y: m.y }); }
                    return false;
                }
                if (c !== ZEMIN && c !== UCURUM) { olay(run, 'sekti', { x: m.x, y: m.y }); return false; }
                for (const e of oda.dusmanlar) if (e.hp > 0 && Math.hypot(e.x - m.x, e.y - m.y) < 0.8) { vur(run, oda, e, m); return false; }
                const b = oda.boss;
                if (b && b.uyan <= 0 && Math.hypot(b.x - m.x, b.y - m.y) < b.r + 0.2) { bossVur(run, oda, m.dmg + (m.zehir ? 0.5 * m.zehir : 0)); return false; }
            }
            return --m.omur > 0;
        });
    }
    function okAdim(run, oda) {
        const h = run.snake[0];
        run.oklar = run.oklar.filter(o => {
            o.x += o.dx; o.y += o.dy;
            if (--o.omur <= 0) return false;
            const c = hucre(oda, Math.floor(o.x), Math.floor(o.y));
            if (c !== ZEMIN && c !== UCURUM) return false;
            if (Math.hypot(h.x + 0.5 - o.x, h.y + 0.5 - o.y) < 0.6) { hasar(run, 'ok'); return false; }
            // gövde kalkan gibi mermiyi emer
            for (let i = 1; i < run.snake.length; i++) {
                const s = run.snake[i];
                if (Math.abs(s.x + 0.5 - o.x) < 0.55 && Math.abs(s.y + 0.5 - o.y) < 0.55) { olay(run, 'emildi', { x: o.x, y: o.y }); return false; }
            }
            return true;
        });
    }
    function ozAdim(run) {
        const h = run.snake[0], hx = h.x + 0.5, hy = h.y + 0.5;
        run.ozler = run.ozler.filter(o => {
            const dx = hx - o.x, dy = hy - o.y, d = Math.hypot(dx, dy);
            if (d < 0.8) {
                if (run.snake.length < 30) run.snake.push({ ...run.snake[run.snake.length - 1] });
                run.skor += 2;
                olay(run, 'oz', { x: o.x, y: o.y });
                return false;
            }
            if (d < 4) { o.x += dx / d * 0.35; o.y += dy / d * 0.35; }
            return true;
        });
    }

    function temizle(run, oda) {
        if (oda.temiz) return;
        oda.temiz = true;
        oda.dusmanlar = []; oda.dogumlar = [];
        run.oklar = [];
        run.skor += 50;
        if (oda.tur === 'savas') kemerKur(run, oda);
        if (oda.tur === 'gizli') oda.sunak = { x: 23, y: 15, yetenek: run.yetenek[oda.odul] ? null : oda.odul };
        if (oda.tur === 'boss') { oda.sunak = { x: 23, y: 15, yetenek: run.yetenek.atilim ? null : 'atilim' }; oda.cikis = { x: 23, y: 4 }; }
        olay(run, 'temiz', { tur: oda.tur });
    }

    // Bir tik: tüm dünya. Olaylar run.ev kuyruğuna yazılır (game.js boşaltır).
    function adim(run) {
        if (run.bitti) return run.ev;
        run.t++;
        if (run.inv > 0) run.inv--;
        if (run.atisCd > 0) run.atisCd--;
        if (run.atilCd > 0) run.atilCd--;
        run.izler = run.izler.filter(z => --z.t > 0);
        const w = run.want;
        if (w && (w.x || w.y) && Math.abs(w.x) + Math.abs(w.y) === 1 && !(w.x === -run.dir.x && w.y === -run.dir.y)) run.dir = { x: w.x, y: w.y };
        const k0 = run.oda;
        ilerle(run);
        if (run.bitti || run.oda !== k0) return run.ev;
        const oda = run.odalar[run.oda];
        dalgaAdim(run, oda);
        dogumAdim(run, oda);
        mermiAdim(run, oda);
        dusmanAdim(run, oda);
        bossAdim(run, oda);
        okAdim(run, oda);
        ozAdim(run);
        if (!run.bitti && !oda.temiz && oda.tur !== 'boss' && oda.dalga >= oda.dalgalar.length && !oda.dusmanlar.length && !oda.dogumlar.length) temizle(run, oda);
        return run.ev;
    }

    function ozet(run) {
        const oda = run.odalar[run.oda];
        return {
            oda: run.oda, tur: oda.tur, ad: oda.ad, temiz: oda.temiz, can: run.can, canMax: run.canMax, kalkan: run.kalkan, skor: run.skor,
            dusman: oda.dusmanlar.length + oda.dogumlar.length, boss: oda.boss ? { hp: oda.boss.hp, faz: oda.boss.faz } : null,
            kemerler: oda.kemerler ? oda.kemerler.map(k => k.id) : null, sunak: !!oda.sunak, cikis: !!oda.cikis,
            yetenek: { ...run.yetenek }, armaganlar: run.armaganlar.slice(), uzunluk: run.snake.length, bitti: run.bitti, kazandi: run.kazandi,
            ziyaret: Object.keys(run.odalar).filter(k => run.odalar[k].ziyaret).length
        };
    }

    // ======================== KALICILIK ========================
    function bosMeta() { return { yetenek: { atilim: false, kirici: false, anahtar: false }, kosu: 0, zafer: 0 }; }
    function depoAl(d) { try { return d || (typeof localStorage !== 'undefined' ? localStorage : null); } catch (e) { return null; } }
    function yukle(depo) {
        const m = bosMeta();
        try {
            const s = depoAl(depo);
            const d = s ? JSON.parse(s.getItem(ANAHTAR)) : null;
            if (d && typeof d === 'object' && !Array.isArray(d)) {
                if (d.yetenek && typeof d.yetenek === 'object') Object.keys(m.yetenek).forEach(k => { m.yetenek[k] = d.yetenek[k] === true; });
                ['kosu', 'zafer'].forEach(k => { const v = Number(d[k]); if (Number.isFinite(v) && v >= 0 && v < 1e9) m[k] = Math.floor(v); });
            }
        } catch (e) {}
        return m;
    }
    function kaydet(meta, depo) {
        try {
            const s = depoAl(depo);
            if (!s || !meta) return;
            const y = meta.yetenek || {};
            s.setItem(ANAHTAR, JSON.stringify({ yetenek: { atilim: y.atilim === true, kirici: y.kirici === true, anahtar: y.anahtar === true }, kosu: meta.kosu | 0, zafer: meta.zafer | 0 }));
        } catch (e) {}
    }

    // ======================== ÇİZİM ========================
    const FONT = '"Press Start 2P", monospace';
    function hash(x, y, s) {
        let h = (x * 374761393 + y * 668265263 + (s | 0) * 2246822519) >>> 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
        return (h ^ (h >>> 16)) >>> 0;
    }
    const TAS = { ust1: '#80879f', ust2: '#4d536b', on1: '#3a4056', on2: '#15171f' };
    const SUTUN_TAS = { ust1: '#959ab2', ust2: '#585e78', on1: '#41475e', on2: '#181a24' };
    const DUVAR_H = 12, SUTUN_H = 20;
    // Oda türüne göre doku teması (Doku hazır değilse prosedürel çizim yedek)
    const ODA_TEMA = { baslangic: 'tas', savas: 'tas', boss: 'lav', gizli: 'kaya', hazine: 'buz' };
    let TX = null; // { kind, dpr }: bloklar için kaya dokusu
    // Pişmiş 3B sprite'lar (src/sprites.js); hazır değilse tuval çizimine dönülür
    const SP = n => (typeof Sprites !== 'undefined' && Sprites.has(n) ? Sprites : null);
    const SPR_AD = { kovalayan: 'hortlak', atici: 'cadi', zirhli: 'muhafiz' };
    const yonHafiza = new WeakMap();   // yalnız çizim: düşmanın baktığı yön (mantığa dokunmaz)
    // Yalnız çizim durumu (mantık nesnelerine alan yazılmaz): ölüm animasyonları, son görülen düşmanlar,
    // boss faz geçişi zamanı. Hepsi oda/düşman nesnesine bağlı WeakMap'lerde tutulur.
    const olumler = new WeakMap();      // oda -> [{ spn, x, y, sol, s, t0, sure, boss, fr }]
    const sonGorulen = new WeakMap();   // oda -> { d: [düşmanlar], b: boss }
    const bossHafiza = new WeakMap();   // boss -> { faz, t0 }
    const bas = { x: -99, y: -99 };     // yılan başı (hücre merkezi), ciz() her karede günceller
    const OLUM_SURE = 0.6, BOSS_OLUM_SURE = 1.6, OLUM_KARE = 12;
    // Adlandırılmış kare aralığından kare (pişmiş harita anim içermiyorsa düz döngü)
    function kare(spn, ad, i) {
        const a = Sprites.anim && Sprites.anim(spn, ad);
        if (!a) return ad === 'bekle' ? Math.floor(i) : 0;
        return a[0] + ((Math.floor(i) % a[1]) + a[1]) % a[1];
    }
    function sprOlcek(tur) { return tur === 'zirhli' ? 1.55 : 1.5; }
    // Kaybolan düşman/boss hp<=0 ise ölüm animasyonu başlat (mantık ölüyü listeden hemen siler)
    function olumTakip(oda, t) {
        const son = sonGorulen.get(oda);
        let liste = olumler.get(oda);
        if (!liste) { liste = []; olumler.set(oda, liste); }
        if (son) {
            for (const e of son.d) {
                if (e.hp > 0 || oda.dusmanlar.includes(e)) continue;
                const yh = yonHafiza.get(e);
                liste.push({ spn: SPR_AD[e.tur], tur: e.tur, x: e.x, y: e.y, sol: yh ? yh.sol : false, s: sprOlcek(e.tur), t0: t, sure: OLUM_SURE, boss: false, fr: yh && yh.fr != null ? yh.fr : 0 });
            }
            if (son.b && son.b !== oda.boss && son.b.hp <= 0) {
                const b = son.b, R = b.r * C * 1.3;
                liste.push({ spn: 'jarl', x: b.x, y: b.y, sol: false, s: R / 27, oy: R * 0.8, R, t0: t, sure: BOSS_OLUM_SURE, boss: true, fr: kare('jarl', 'saldiri', 2) });
            }
        }
        sonGorulen.set(oda, { d: oda.dusmanlar.slice(), b: oda.boss });
        for (let i = liste.length - 1; i >= 0; i--) if (t - liste[i].t0 > liste[i].sure || t < liste[i].t0) liste.splice(i, 1);
        return liste;
    }
    // Ölüm: 12 adım; sprite yatay dilimlere ayrılıp savrulur, küçülür, solar; beyaz/renkli parlama + ruh kıvılcımları
    function olumCiz(c, d, t, reduced) {
        if (!SP(d.spn)) return;
        const p = Math.min(1, (t - d.t0) / d.sure);
        const k = Math.min(OLUM_KARE - 1, Math.floor(p * OLUM_KARE)), q = k / (OLUM_KARE - 1);
        const px = d.x * C, py = d.y * C + (d.boss ? d.oy : 8);
        const renk = d.boss ? '#ffb347' : d.tur === 'atici' ? '#ff8ae0' : d.tur === 'zirhli' ? '#ffb36b' : '#9ff6ff';
        c.save();
        // yerde yanık/ruh halkası
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = (1 - q) * 0.6;
        c.strokeStyle = renk; c.lineWidth = d.boss ? 4 : 2;
        const rr = (d.boss ? 30 : 8) + q * (d.boss ? 70 : 22);
        c.beginPath(); c.ellipse(px, py - 2, rr, rr * 0.4, 0, 0, 7); c.stroke();
        c.globalCompositeOperation = 'source-over';
        if (reduced) {
            c.globalAlpha = 1 - q;
            Sprites.draw(c, d.spn, d.fr, px, py, d.s, d.sol);
        } else {
            // 3 dilim: üst yukarı-dışa, orta yana, alt yere çöker
            const sc = d.s * (1 - 0.18 * q);
            const H = d.boss ? 150 : 46, top = py - H;
            const dil = [[-1, -1.2, -0.6], [1, 0.3, 0.2], [-0.4, 0.8, 0.7]];
            for (let j = 0; j < 3; j++) {
                const [ox, oy, rot] = dil[j];
                const y0 = top + j * H / 3 - (j === 0 ? 60 : 0), y1 = top + (j + 1) * H / 3 + (j === 2 ? 30 : 0);
                c.save();
                c.beginPath(); c.rect(px - 200, y0, 400, y1 - y0); c.clip();
                const m = q * q * (d.boss ? 26 : 9);
                c.translate(px + ox * m, py + oy * m); c.rotate(rot * q * 0.5);
                c.globalAlpha = Math.max(0, 1 - q * 1.1);
                Sprites.draw(c, d.spn, d.fr, 0, 0, sc, d.sol);
                Sprites.drawTint(c, d.spn, d.fr, 0, 0, sc, d.sol, k < 3 ? '#ffffff' : renk, (1 - q) * (k < 3 ? 0.9 : 0.5));
                c.restore();
            }
            // ruh/kor kıvılcımları
            c.globalCompositeOperation = 'lighter';
            const n = d.boss ? 26 : 9;
            for (let i = 0; i < n; i++) {
                const a = i * 2.39996 + (d.boss ? 0 : d.x), sp = (0.4 + (i * 37 % 10) / 10) * (d.boss ? 70 : 20);
                const x = px + Math.cos(a) * sp * q, y = py - (d.boss ? 70 : 14) + Math.sin(a) * sp * q * 0.6 - q * (d.boss ? 50 : 18);
                c.globalAlpha = (1 - q) * 0.9;
                c.fillStyle = i % 3 ? renk : '#ffffff';
                const r = (d.boss ? 3 : 1.6) * (1 - q * 0.5);
                c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
            }
            if (d.boss && k < 6) {
                const g = c.createRadialGradient(px, py - 80, 4, px, py - 80, 160);
                g.addColorStop(0, `rgba(255,220,160,${0.7 * (1 - k / 6)})`); g.addColorStop(1, 'rgba(255,120,40,0)');
                c.globalAlpha = 1; c.fillStyle = g; c.fillRect(px - 160, py - 240, 320, 320);
            }
        }
        c.restore();
    }

    function blok(c, x, y, hgt, renk, onYuz) {
        const px = x * C, py = y * C;
        if (onYuz) {
            const g = c.createLinearGradient(0, py + C - hgt, 0, py + C);
            g.addColorStop(0, renk.on1); g.addColorStop(1, renk.on2);
            c.fillStyle = g;
            c.fillRect(px, py + C - hgt, C, hgt);
            const wp = TX && Doku.pattern(c, TX.kind, TX.dpr);
            if (wp) {
                c.fillStyle = wp; c.fillRect(px, py + C - hgt, C, hgt);
                const og = c.createLinearGradient(0, py + C - hgt, 0, py + C);
                og.addColorStop(0, 'rgba(0,0,10,0.18)'); og.addColorStop(1, 'rgba(0,0,12,0.7)');
                c.fillStyle = og; c.fillRect(px, py + C - hgt, C, hgt);
            }
            c.fillStyle = 'rgba(0,0,0,0.35)';
            c.fillRect(px + ((x + y) % 2 ? 6 : 14), py + C - hgt, 1, hgt);
        }
        const g2 = c.createLinearGradient(px, py - hgt, px + C, py - hgt + C);
        g2.addColorStop(0, renk.ust1); g2.addColorStop(1, renk.ust2);
        c.fillStyle = g2;
        c.fillRect(px, py - hgt, C, C);
        const wt = TX && Doku.pattern(c, TX.kind, TX.dpr);
        if (wt) {
            c.fillStyle = wt; c.fillRect(px, py - hgt, C, C);
            const tg = c.createLinearGradient(px, py - hgt, px + C, py - hgt + C);
            tg.addColorStop(0, hgt > DUVAR_H ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)'); tg.addColorStop(1, 'rgba(0,0,12,0.2)');
            c.fillStyle = tg; c.fillRect(px, py - hgt, C, C);
        }
        c.fillStyle = 'rgba(255,255,255,0.14)';
        c.fillRect(px, py - hgt, C, 1.5);
        c.fillStyle = 'rgba(0,0,0,0.30)';
        c.fillRect(px + C - 1, py - hgt, 1, C);
        c.fillRect(px, py - hgt + C - 1, C, 1);
        c.fillStyle = 'rgba(0,0,0,0.16)';
        c.fillRect(px, py - hgt + C / 2, C, 1);
        c.fillRect(px + ((x + y) % 2 ? 5 : 13), py - hgt, 1, C / 2);
        c.fillRect(px + ((x + y) % 2 ? 13 : 5), py - hgt + C / 2, 1, C / 2);
    }

    function statik(oda, dpr) {
        const th = ODA_TEMA[oda.tur] || 'tas';
        const tex = typeof Doku !== 'undefined' && Doku.pump(th, dpr);
        TX = tex ? { kind: 'wall.' + th, dpr } : null;
        const spv = typeof Sprites !== 'undefined' ? Sprites.version : 0;
        if (oda._cv && oda._dpr === dpr && oda._tex === tex && oda._spv === spv) return oda._cv;
        const cv = document.createElement('canvas');
        cv.width = Math.round(W * C * dpr); cv.height = Math.round(H * C * dpr);
        const c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        const s = oda.desen;
        c.fillStyle = '#07080d';
        c.fillRect(0, 0, W * C, H * C);
        // gerçek doku zemini (PBR): taş / lav+kaya / yosunlu kaya / karo; meşale ışık havuzları, çatlak, yosun
        if (tex) {
            const fl = Doku.floor(th, W * C, H * C, C, dpr, {
                seed: s, grid: false,
                moss: oda.tur === 'gizli' ? 1 : oda.tur === 'savas' ? 0.45 : 0,
                cracks: oda.tur === 'hazine' ? 4 : 12, lavaN: 11,
                torches: [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2]].map(([x, y]) => ({ x: x * C + C / 2, y: y * C + C / 2 })), torchR: 190
            });
            if (fl) c.drawImage(fl, 0, 0, W * C, H * C);
            // kemikler (hazine odası hariç)
            if (oda.tur !== 'hazine') {
                for (let i = 0; i < 5; i++) {
                    const bx = 2 + hash(i, 11, s) % (W - 4), by = 2 + hash(i, 13, s) % (H - 4);
                    if (hucre(oda, bx, by) !== ZEMIN) continue;
                    const px = bx * C + 3 + hash(i, 5, s) % 14, py = by * C + 3 + hash(i, 6, s) % 14, a = (hash(i, 9, s) % 628) / 100;
                    c.save(); c.translate(px, py); c.rotate(a);
                    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(-5, 1.5, 11, 2);
                    c.strokeStyle = 'rgba(214,206,182,0.55)'; c.lineWidth = 2; c.lineCap = 'round';
                    c.beginPath(); c.moveTo(-5, 0); c.lineTo(5, 0); c.stroke();
                    c.fillStyle = 'rgba(214,206,182,0.6)';
                    [[-6, -1.2], [-6, 1.2], [6, -1.2], [6, 1.2]].forEach(k => { c.beginPath(); c.arc(k[0], k[1], 1.5, 0, 7); c.fill(); });
                    c.restore();
                }
            }
        }
        // zemin döşemeleri
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const t = hucre(oda, x, y);
            if (t === DUVAR || t === UCURUM) continue;
            const px = x * C, py = y * C, n = hash(x, y, s);
            if (t === KAPI || t === CATLAK || t === KILIT) {
                const gk = c.createLinearGradient(px, py, px + C, py + C);
                gk.addColorStop(0, '#0b0c12'); gk.addColorStop(1, '#05060a');
                c.fillStyle = gk; c.fillRect(px, py, C, C);
                continue;
            }
            if (tex) continue;
            const l = 27 + (n % 7);
            c.fillStyle = `rgb(${l},${l + 3},${l + 12})`;
            c.fillRect(px, py, C, C);
            c.fillStyle = 'rgba(255,255,255,0.035)';
            c.fillRect(px, py, C, 1); c.fillRect(px, py, 1, C);
            c.fillStyle = 'rgba(0,0,0,0.4)';
            c.fillRect(px, py + C - 1, C, 1); c.fillRect(px + C - 1, py, 1, C);
            if (n % 13 === 0) { c.fillStyle = 'rgba(52,86,64,0.35)'; c.beginPath(); c.ellipse(px + 6 + n % 8, py + 8 + (n >> 4) % 6, 5, 3, 0, 0, 7); c.fill(); }
            if (n % 19 === 0) {
                c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 1;
                c.beginPath(); c.moveTo(px + 3, py + 4); c.lineTo(px + 9, py + 9); c.lineTo(px + 8, py + 15); c.lineTo(px + 15, py + 17); c.stroke();
            }
        }
        // merkezde oyulmuş rün çemberi
        c.save();
        c.translate(W * C / 2, H * C / 2 + 10);
        c.strokeStyle = 'rgba(232,196,106,0.10)'; c.lineWidth = 2;
        c.beginPath(); c.arc(0, 0, 112, 0, 7); c.stroke();
        c.beginPath(); c.arc(0, 0, 92, 0, 7); c.stroke();
        for (let i = 0; i < 16; i++) {
            const a = i / 16 * Math.PI * 2, v = hash(i, 3, s) % 4;
            c.save(); c.rotate(a); c.translate(0, -102);
            c.beginPath();
            c.moveTo(0, -6); c.lineTo(0, 6);
            if (v === 0) { c.moveTo(0, -6); c.lineTo(4, -2); c.lineTo(0, 1); }
            else if (v === 1) { c.moveTo(0, 0); c.lineTo(4, -6); c.moveTo(0, 0); c.lineTo(4, 6); }
            else if (v === 2) { c.moveTo(-3, -6); c.lineTo(3, 6); }
            else { c.moveTo(-4, -2); c.lineTo(0, -6); c.lineTo(4, -2); }
            c.stroke(); c.restore();
        }
        c.restore();
        // uçurum: derin karanlık + yamaç
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            if (hucre(oda, x, y) !== UCURUM) continue;
            const px = x * C, py = y * C;
            const g = c.createLinearGradient(0, py, 0, py + C);
            g.addColorStop(0, '#04050b'); g.addColorStop(1, '#010103');
            c.fillStyle = g; c.fillRect(px, py, C, C);
            if (hucre(oda, x, y - 1) !== UCURUM) {
                const g2 = c.createLinearGradient(0, py, 0, py + 14);
                g2.addColorStop(0, '#3a3f55'); g2.addColorStop(1, 'rgba(8,9,16,0)');
                c.fillStyle = g2; c.fillRect(px, py, C, 14);
            }
            if (hucre(oda, x, y + 1) !== UCURUM) { c.fillStyle = 'rgba(150,170,220,0.3)'; c.fillRect(px, py + C - 2, C, 2); }
            if (hucre(oda, x - 1, y) !== UCURUM) { const gs = c.createLinearGradient(px, 0, px + 8, 0); gs.addColorStop(0, '#2e3346'); gs.addColorStop(1, 'rgba(8,9,16,0)'); c.fillStyle = gs; c.fillRect(px, py, 8, C); }
            if (hucre(oda, x + 1, y) !== UCURUM) { const gs = c.createLinearGradient(px + C, 0, px + C - 8, 0); gs.addColorStop(0, '#2e3346'); gs.addColorStop(1, 'rgba(8,9,16,0)'); c.fillStyle = gs; c.fillRect(px + C - 8, py, 8, C); }
            if (hash(x, y, s) % 5 === 0) { c.fillStyle = 'rgba(120,160,255,0.25)'; c.fillRect(px + hash(x, y, 2) % 16, py + 8 + hash(x, y, 3) % 8, 1.5, 1.5); }
        }
        // gölgeler (blokların güneydoğusuna düşer)
        c.fillStyle = 'rgba(0,0,0,0.38)';
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const t = hucre(oda, x, y);
            if (t === DUVAR) c.fillRect(x * C + 6, y * C + 6, C, C);
            if (t === SUTUN) c.fillRect(x * C + 9, y * C + 9, C, C);
        }
        // yükseltilmiş bloklar: satır sırasıyla (alttaki üstü örter)
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const t = hucre(oda, x, y);
            if (t !== DUVAR && t !== SUTUN) continue;
            const alt = hucre(oda, x, y + 1);
            const on = !(alt === DUVAR || alt === SUTUN) || y === H - 1;
            if (t === DUVAR) {
                blok(c, x, y, DUVAR_H, TAS, on);
                // iç kenarda altın şerit
                const ic = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => { const q = hucre(oda, x + dx, y + dy); return q === ZEMIN || q === UCURUM; });
                if (ic && on) { c.fillStyle = 'rgba(232,196,106,0.35)'; c.fillRect(x * C, y * C + C - DUVAR_H - 1, C, 1); }
            } else {
                blok(c, x, y, SUTUN_H, SUTUN_TAS, on);
                if (on && (x + y) % 2 === 0) { c.strokeStyle = 'rgba(120,220,255,0.45)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x * C + 10, y * C + 4); c.lineTo(x * C + 10, y * C + 17); c.moveTo(x * C + 10, y * C + 7); c.lineTo(x * C + 15, y * C + 11); c.stroke(); }
            }
        }
        oda._cv = cv; oda._dpr = dpr; oda._tex = tex; oda._spv = spv;
        return cv;
    }

    function ikon(c, id, x, y, s, renk) {
        c.save();
        c.translate(x, y); c.scale(s / 20, s / 20);
        c.lineCap = 'round'; c.lineJoin = 'round';
        c.strokeStyle = renk; c.fillStyle = renk; c.lineWidth = 2.4;
        c.beginPath();
        switch (id) {
            case 'hasar':
                c.moveTo(-7, 7); c.lineTo(7, -7); c.stroke();
                c.beginPath(); c.moveTo(-7, 1); c.lineTo(-1, 7); c.stroke();
                c.beginPath(); c.arc(-8.5, 8.5, 1.8, 0, 7); c.fill(); break;
            case 'hiz':
                c.moveTo(3, -9); c.lineTo(-5, 1); c.lineTo(0, 1); c.lineTo(-3, 9); c.lineTo(6, -2); c.lineTo(1, -2); c.closePath(); c.fill(); break;
            case 'can':
                c.moveTo(0, 8); c.bezierCurveTo(-11, 0, -7, -10, 0, -3); c.bezierCurveTo(7, -10, 11, 0, 0, 8); c.fill(); break;
            case 'coklu':
                [-0.5, 0, 0.5].forEach(a => { c.save(); c.rotate(a); c.beginPath(); c.moveTo(0, 8); c.lineTo(0, -7); c.moveTo(-3, -4); c.lineTo(0, -8); c.lineTo(3, -4); c.stroke(); c.restore(); }); break;
            case 'zehir':
                c.moveTo(0, -9); c.quadraticCurveTo(9, 2, 0, 8); c.quadraticCurveTo(-9, 2, 0, -9); c.fill();
                c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(-2, 2, 1.8, 0, 7); c.fill(); break;
            case 'kalkan':
                c.arc(0, 0, 8, 0, 7); c.stroke(); c.beginPath(); c.arc(0, 0, 3, 0, 7); c.fill();
                c.beginPath(); c.moveTo(0, -8); c.lineTo(0, -4); c.moveTo(0, 4); c.lineTo(0, 8); c.moveTo(-8, 0); c.lineTo(-4, 0); c.moveTo(4, 0); c.lineTo(8, 0); c.stroke(); break;
            case 'diken':
                for (let i = -1; i <= 1; i++) { c.moveTo(i * 6 - 3, 7); c.lineTo(i * 6, -8 + Math.abs(i) * 3); c.lineTo(i * 6 + 3, 7); }
                c.closePath(); c.fill(); break;
            case 'atilim':
                c.lineWidth = 3; c.moveTo(-8, -6); c.lineTo(-2, 0); c.lineTo(-8, 6); c.moveTo(0, -6); c.lineTo(6, 0); c.lineTo(0, 6); c.stroke(); break;
            case 'kirici':
                c.moveTo(-7, 8); c.lineTo(2, -1); c.stroke();
                c.beginPath(); c.moveTo(-1, -6); c.lineTo(5, -9); c.lineTo(9, -3); c.lineTo(3, 0); c.closePath(); c.fill();
                c.lineWidth = 1.4; c.beginPath(); c.moveTo(5, 3); c.lineTo(8, 5); c.lineTo(6, 8); c.stroke(); break;
            case 'anahtar':
                c.arc(-4, 0, 4, 0, 7); c.stroke();
                c.beginPath(); c.moveTo(0, 0); c.lineTo(9, 0); c.moveTo(6, 0); c.lineTo(6, 4); c.moveTo(9, 0); c.lineTo(9, 3); c.stroke();
                c.lineWidth = 1.2; c.beginPath(); c.moveTo(-6, 3); c.quadraticCurveTo(-9, 7, -6, 9); c.moveTo(-3, 4); c.quadraticCurveTo(-3, 8, -1, 9); c.stroke(); break;
            case 'sifa':
                c.moveTo(0, -8); c.lineTo(0, 8); c.moveTo(-8, 0); c.lineTo(8, 0); c.lineWidth = 4; c.stroke(); break;
        }
        c.restore();
    }

    function golge(c, x, y, rx, ry, a) {
        c.fillStyle = `rgba(0,0,0,${a || 0.4})`;
        c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill();
    }

    function kapilarCiz(c, oda, o) {
        Object.keys(oda.kapilar).forEach(yon => {
            const hs = kapiHucreleri(yon);
            const tip = hucre(oda, hs[0].x, hs[0].y);
            const yatay = yon === 'n' || yon === 's';
            const mx = (hs[0].x + hs[3].x + 1) / 2 * C, my = (hs[0].y + hs[3].y + 1) / 2 * C;
            if (tip === CATLAK || tip === KILIT) {
                hs.forEach(h => blok(c, h.x, h.y, DUVAR_H, TAS, true));
                const ic = YON[TERS[yon]];
                c.save();
                if (tip === CATLAK) {
                    c.strokeStyle = '#120a06'; c.lineWidth = 2.2;
                    c.beginPath();
                    if (yatay) { c.moveTo(mx - 36, my - 8); c.lineTo(mx - 14, my - 2); c.lineTo(mx - 4, my - 12); c.lineTo(mx + 10, my - 3); c.lineTo(mx + 34, my - 9); }
                    else { c.moveTo(mx - 4, my - 36); c.lineTo(mx + 3, my - 14); c.lineTo(mx - 6, my - 2); c.lineTo(mx + 4, my + 12); c.lineTo(mx - 2, my + 34); }
                    c.stroke();
                    c.strokeStyle = 'rgba(255,150,70,' + (0.25 + 0.2 * Math.sin(o.t * 3)) + ')'; c.lineWidth = 1; c.stroke();
                    ikon(c, 'kirici', mx + ic.x * 34, my + ic.y * 34, 16, 'rgba(255,179,107,0.8)');
                } else {
                    const p = 0.5 + 0.3 * Math.sin(o.t * 2.5);
                    c.shadowColor = '#e8c46a'; c.shadowBlur = 10 * p;
                    c.strokeStyle = 'rgba(232,196,106,' + (0.5 + p * 0.4) + ')'; c.lineWidth = 2;
                    c.fillStyle = 'rgba(10,8,4,0.7)';
                    c.beginPath(); c.arc(mx + ic.x * 34, my + ic.y * 34, 14, 0, 7); c.fill(); c.stroke();
                    c.shadowBlur = 0;
                    ikon(c, 'anahtar', mx + ic.x * 34, my + ic.y * 34, 16, '#e8c46a');
                    c.strokeStyle = 'rgba(232,196,106,0.7)'; c.lineWidth = 1.5;
                    c.beginPath(); c.arc(mx, my - (yatay ? 6 : 0), 9, 0, 7); c.stroke();
                }
                c.restore();
                return;
            }
            if (!oda.temiz) {
                // mühürlü kapı: kızıl rün parmaklıkları
                const p = 0.55 + 0.35 * Math.sin(o.t * 4);
                c.save();
                c.fillStyle = 'rgba(20,10,14,0.9)';
                hs.forEach(h => c.fillRect(h.x * C, h.y * C - (yatay ? 6 : 0), C, C + (yatay ? 6 : 0)));
                c.shadowColor = '#ff3355'; c.shadowBlur = 8 * p;
                c.fillStyle = `rgba(255,70,90,${0.5 + 0.4 * p})`;
                for (let i = 0; i < 9; i++) {
                    if (yatay) c.fillRect(hs[0].x * C + 4 + i * 9, hs[0].y * C - 6, 2.5, C + 6);
                    else c.fillRect(hs[0].x * C, hs[0].y * C + 4 + i * 9, C, 2.5);
                }
                c.restore();
            } else {
                // açık kapı: içeri sızan ışık
                const ic = YON[TERS[yon]];
                const g = c.createLinearGradient(mx, my, mx + ic.x * 70, my + ic.y * 70);
                g.addColorStop(0, 'rgba(255,200,120,0.22)'); g.addColorStop(1, 'rgba(255,200,120,0)');
                c.fillStyle = g;
                if (yatay) c.fillRect(hs[0].x * C - 10, Math.min(my, my + ic.y * 70), 4 * C + 20, 70);
                else c.fillRect(Math.min(mx, mx + ic.x * 70), hs[0].y * C - 10, 70, 4 * C + 20);
            }
        });
    }

    function mesaleler(c, t, reduced) {
        [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2]].forEach(([x, y], i) => {
            const px = x * C + C / 2, py = y * C - 2;
            if (SP('torch')) {
                Sprites.draw(c, 'torch', reduced ? 0 : Math.floor(t * 9 + i * 1.3), px, py + 10, 1);
                c.save(); c.globalCompositeOperation = 'lighter';
                const g = c.createRadialGradient(px, py - 14, 1, px, py - 14, 22);
                g.addColorStop(0, `rgba(255,150,60,${reduced ? 0.35 : 0.3 + 0.08 * Math.sin(t * 9 + i)})`); g.addColorStop(1, 'rgba(255,120,40,0)');
                c.fillStyle = g; c.fillRect(px - 22, py - 36, 44, 44);
                c.restore();
                return;
            }
            c.fillStyle = '#2a1c12'; c.beginPath(); c.ellipse(px, py + 4, 7, 3.5, 0, 0, 7); c.fill();
            c.fillStyle = '#4a3220'; c.fillRect(px - 6, py, 12, 4);
            const f = reduced ? 0 : Math.sin(t * 9 + i * 2) * 1.5;
            c.save();
            c.shadowColor = '#ff8a2a'; c.shadowBlur = 14;
            c.fillStyle = '#ff7a1f';
            c.beginPath(); c.moveTo(px - 5, py); c.quadraticCurveTo(px - 4 + f, py - 12, px + f * 0.5, py - 16 - f); c.quadraticCurveTo(px + 4 + f, py - 10, px + 5, py); c.fill();
            c.fillStyle = '#ffd36b';
            c.beginPath(); c.moveTo(px - 2.5, py); c.quadraticCurveTo(px - 1 + f, py - 7, px + f * 0.4, py - 9); c.quadraticCurveTo(px + 2 + f, py - 5, px + 2.5, py); c.fill();
            c.restore();
        });
    }

    function kemerCiz(c, k, t, reduced) {
        const x = k.x * C, y = k.y * C, w = 2 * C, a = ARMAGANLAR[k.id] || { renk: '#fff', ad: '?' };
        const ust = y - 16, alt = y + 2 * C, mx = x + w / 2;
        golge(c, mx + 6, alt - 1, 30, 7, 0.5);
        // portal içi: armağan renginde dönen ışık
        c.save();
        c.beginPath(); c.moveTo(x + 1, alt); c.lineTo(x + 1, ust); c.arc(mx, ust, w / 2 - 1, Math.PI, 0); c.lineTo(x + w - 1, alt); c.closePath();
        c.clip();
        const g = c.createRadialGradient(mx, y + C - 4, 2, mx, y + C - 4, 34);
        g.addColorStop(0, a.renk); g.addColorStop(0.45, 'rgba(40,30,60,0.8)'); g.addColorStop(1, 'rgba(8,6,16,0.95)');
        c.fillStyle = g; c.fillRect(x - 4, ust - w, w + 8, alt - ust + w);
        if (!reduced) {
            c.strokeStyle = a.renk; c.globalAlpha = 0.45; c.lineWidth = 1.5;
            for (let i = 0; i < 3; i++) { const r = 6 + i * 6, s0 = t * (2 + i) + i; c.beginPath(); c.arc(mx, y + C - 4, r, s0, s0 + 2.2); c.stroke(); }
            c.globalAlpha = 1;
        }
        c.restore();
        // taş sütunlar (2.5D: ön yüz + yan gölge) ve kemer
        [x - 5, x + w - 5].forEach(sx => {
            const pg = c.createLinearGradient(sx, 0, sx + 10, 0);
            pg.addColorStop(0, '#8d93ab'); pg.addColorStop(1, '#3b4054');
            c.fillStyle = pg; c.fillRect(sx, ust, 10, alt - ust);
            c.fillStyle = '#23263a'; c.fillRect(sx, alt - 6, 10, 6);
            c.fillStyle = '#a7adc4'; c.fillRect(sx - 1, ust - 2, 12, 4);
        });
        c.strokeStyle = '#3b4054'; c.lineWidth = 10;
        c.beginPath(); c.arc(mx, ust, w / 2, Math.PI, 0); c.stroke();
        c.strokeStyle = '#8d93ab'; c.lineWidth = 4;
        c.beginPath(); c.arc(mx, ust - 2, w / 2 + 2, Math.PI * 1.02, -0.02 * Math.PI); c.stroke();
        c.fillStyle = '#e8c46a'; c.beginPath(); c.moveTo(mx, ust - w / 2 - 9); c.lineTo(mx + 5, ust - w / 2 - 3); c.lineTo(mx, ust - w / 2 + 3); c.lineTo(mx - 5, ust - w / 2 - 3); c.fill();
        // süzülen armağan simgesi
        const bob = reduced ? 0 : Math.sin(t * 3 + k.x) * 3;
        const iy = ust - w / 2 - 26 + bob;
        c.save();
        c.shadowColor = a.renk; c.shadowBlur = 16;
        c.fillStyle = 'rgba(10,10,20,0.85)'; c.beginPath(); c.arc(mx, iy, 15, 0, 7); c.fill();
        c.strokeStyle = a.renk; c.lineWidth = 2; c.stroke();
        c.restore();
        ikon(c, k.id, mx, iy, 18, a.renk);
        c.font = '8px ' + FONT; c.textAlign = 'center';
        c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(mx - c.measureText(a.ad).width / 2 - 4, alt + 5, c.measureText(a.ad).width + 8, 13);
        c.fillStyle = a.renk; c.fillText(a.ad, mx, alt + 15);
    }

    function sunakCiz(c, s, t, reduced) {
        const x = s.x * C, y = s.y * C, w = 2 * C;
        golge(c, x + w / 2 + 5, y + 2 * C - 1, 22, 6, 0.45);
        // rün taşı sunak (pişmiş 3B) ya da basamaklı taş sunak
        if (!SP('runestone') || !Sprites.draw(c, 'runestone', 0, x + w / 2, y + 2 * C - 4, 1.1)) {
            c.fillStyle = '#262a39'; c.fillRect(x - 2, y + 22, w + 4, 16);
            c.fillStyle = '#5d637c'; c.fillRect(x - 2, y + 16, w + 4, 7);
            c.fillStyle = '#323748'; c.fillRect(x + 4, y + 8, w - 8, 14);
            c.fillStyle = '#7a809a'; c.fillRect(x + 4, y + 4, w - 8, 5);
        }
        const yt = s.yetenek ? YETENEKLER[s.yetenek] : null;
        const renk = yt ? yt.renk : '#ff4d7a';
        const bob = reduced ? 0 : Math.sin(t * 2.4) * 3;
        c.save();
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(x + w / 2, y - 10 + bob, 2, x + w / 2, y - 10 + bob, 34);
        g.addColorStop(0, renk); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalAlpha = 0.55; c.fillStyle = g; c.fillRect(x - 30, y - 46, w + 60, 72);
        c.restore();
        ikon(c, yt ? s.yetenek : 'sifa', x + w / 2, y - 10 + bob, 20, renk);
        c.font = '8px ' + FONT; c.textAlign = 'center';
        c.fillStyle = renk; c.fillText(yt ? yt.ad : 'ŞİFA', x + w / 2, y + 2 * C + 12);
    }

    function sandikCiz(c, s, t) {
        const x = s.x * C, y = s.y * C, w = 2 * C;
        golge(c, x + w / 2 + 5, y + 2 * C - 2, 22, 6, 0.45);
        c.fillStyle = '#4a2c14'; c.fillRect(x, y + 14, w, 22);
        c.fillStyle = '#6e4220'; c.beginPath(); c.moveTo(x, y + 14); c.quadraticCurveTo(x + w / 2, y - 2, x + w, y + 14); c.closePath(); c.fill();
        c.fillStyle = '#e8c46a'; c.fillRect(x + 5, y + 6, 3, 30); c.fillRect(x + w - 8, y + 6, 3, 30); c.fillRect(x + w / 2 - 4, y + 16, 8, 8);
        c.save(); c.shadowColor = '#ffd36b'; c.shadowBlur = 12 + 6 * Math.sin(t * 3); c.fillStyle = '#fff2c0'; c.fillRect(x + w / 2 - 1.5, y + 19, 3, 3); c.restore();
    }

    function cikisCiz(c, s, t, reduced) {
        const cx = (s.x + 1) * C, cy = (s.y + 1) * C;
        c.save();
        for (let i = 0; i < 4; i++) {
            const r = 24 - i * 5, a = (reduced ? 0 : t * (1.5 + i * 0.6)) + i;
            c.strokeStyle = `rgba(${150 + i * 25},${220 - i * 10},255,${0.35 + i * 0.15})`; c.lineWidth = 3;
            c.beginPath(); c.ellipse(cx, cy, r, r * 0.7, 0, a, a + Math.PI * 1.4); c.stroke();
        }
        const g = c.createRadialGradient(cx, cy, 1, cx, cy, 18);
        g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(120,200,255,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, 18, 13, 0, 0, 7); c.fill();
        c.font = '8px ' + FONT; c.textAlign = 'center'; c.fillStyle = '#bfe8ff'; c.fillText('ÇIKIŞ', cx, cy + 34);
        c.restore();
    }

    function dusmanCiz(c, e, o) {
        const px = e.x * C, py = e.y * C, t = o.t;
        const bob = o.reduced ? 0 : Math.sin(t * 6 + e.faz) * 1.5;
        const cb = o.cb ? (o.dusmanRenk || '#CC79A7') : null;
        const spn = SPR_AD[e.tur];
        if (SP(spn)) {
            // bakış yönü: son yatay harekete göre (sprite sağa dönük pişirildi); hızdan hafif eğim
            let yh = yonHafiza.get(e);
            if (!yh) { yh = { x: e.x, sol: false, lx: e.x, v: 0, fr: 0 }; yonHafiza.set(e, yh); }
            if (Math.abs(e.x - yh.x) > 0.01) { yh.sol = e.x < yh.x; yh.x = e.x; }
            yh.v = yh.v * 0.85 + (e.x - (yh.lx == null ? e.x : yh.lx)) * 0.15; yh.lx = e.x;
            const egim = o.reduced ? 0 : Math.max(-0.12, Math.min(0.12, yh.v * 2.5));
            if (cb) { c.save(); c.strokeStyle = cb; c.lineWidth = 2.5; c.beginPath(); c.ellipse(px, py + 7, 12, 5, 0, 0, 7); c.stroke(); c.restore(); }
            // kare: zamana ve duruma göre (şarj / yakın saldırı / bekleme-yürüme döngüsü)
            const yakin = Math.hypot(bas.x - e.x, bas.y - e.y);
            let fr;
            if (o.reduced) fr = e.tur === 'atici' && e.sarj > 0 ? kare(spn, 'saldiri', 3) : 0;
            else if (e.tur === 'atici' && e.sarj > 0) fr = kare(spn, 'saldiri', Math.min(3, Math.floor((16 - e.sarj) / 16 * 4)));
            else if (e.tur !== 'atici' && yakin < (e.tur === 'zirhli' ? 2.4 : 2.2)) fr = kare(spn, 'saldiri', t * (e.tur === 'zirhli' ? 6 : 8) + e.faz);
            else fr = kare(spn, 'bekle', t * (e.tur === 'zirhli' ? 7 : e.tur === 'atici' ? 7 : 9) + e.faz * 1.3);
            yh.fr = fr;
            const s = sprOlcek(e.tur);
            golge(c, px + 1, py + 8, e.tur === 'zirhli' ? 12 : 9, 3.2, 0.3);   // yere temas
            c.save();
            c.translate(px, py + 8); if (egim) c.rotate(egim);
            Sprites.draw(c, spn, fr, 0, 0, s, yh.sol);
            // şarj: sprite pembe parıldar; vuruş: beyaz flaş (alfa maskesi 'lighter' ile)
            if (e.tur === 'atici' && e.sarj > 0) Sprites.drawTint(c, spn, fr, 0, 0, s, yh.sol, '#ff5ed1', (16 - e.sarj) / 16 * 0.35);
            if (e.flash > 0) Sprites.drawTint(c, spn, fr, 0, 0, s, yh.sol, '#ffffff', Math.min(1, e.flash / 5) * 0.85);
            c.restore();
            if (e.tur === 'atici' && e.sarj > 0) {
                c.strokeStyle = 'rgba(255,94,209,0.6)'; c.lineWidth = 1; c.beginPath(); c.arc(px, py, 6 + e.sarj, 0, 7); c.stroke();
            }
            if (e.tur === 'zirhli') for (let i = 0; i < e.max; i++) { c.fillStyle = i < Math.ceil(e.hp) ? '#ffcf7a' : 'rgba(255,255,255,0.15)'; c.fillRect(px - 11 + i * 4, py - 44, 3, 3); }
        } else {
        golge(c, px + 3, py + 9, e.tur === 'zirhli' ? 15 : 11, 5, 0.45);
        c.save();
        c.translate(px, py); c.scale(1.3, 1.3); c.translate(-px, -py);
        if (e.tur === 'kovalayan') {
            c.fillStyle = '#26332d';
            c.beginPath();
            c.moveTo(px - 9, py + 7); c.lineTo(px - 7, py - 4 + bob); c.quadraticCurveTo(px, py - 13 + bob, px + 7, py - 4 + bob); c.lineTo(px + 9, py + 7);
            c.lineTo(px + 5, py + 3); c.lineTo(px + 2, py + 8); c.lineTo(px - 1, py + 3); c.lineTo(px - 4, py + 8); c.lineTo(px - 6, py + 3);
            c.closePath(); c.fill();
            c.fillStyle = cb || '#5f7f6a';
            c.beginPath(); c.arc(px + 1, py - 7 + bob, 5.2, 0, 7); c.fill();
            c.strokeStyle = '#8fa89a'; c.lineWidth = 1.5;
            c.beginPath(); c.moveTo(px - 7, py); c.lineTo(px - 12, py + 3); c.moveTo(px - 7, py + 1); c.lineTo(px - 11, py + 6);
            c.moveTo(px + 7, py); c.lineTo(px + 12, py + 3); c.moveTo(px + 7, py + 1); c.lineTo(px + 11, py + 6); c.stroke();
            c.shadowColor = '#bff6ff'; c.shadowBlur = 6; c.fillStyle = '#d8fbff';
            c.fillRect(px - 2, py - 9 + bob, 2.2, 2.2); c.fillRect(px + 2.5, py - 9 + bob, 2.2, 2.2);
        } else if (e.tur === 'atici') {
            c.fillStyle = cb ? '#2c1f3a' : '#3b2357';
            c.beginPath(); c.moveTo(px, py - 14 + bob); c.lineTo(px + 9, py + 8); c.lineTo(px - 9, py + 8); c.closePath(); c.fill();
            c.fillStyle = cb || '#56337c';
            c.beginPath(); c.moveTo(px, py - 14 + bob); c.lineTo(px + 6, py - 3 + bob); c.lineTo(px - 6, py - 3 + bob); c.closePath(); c.fill();
            c.fillStyle = '#05030a'; c.beginPath(); c.ellipse(px, py - 5 + bob, 3.6, 3, 0, 0, 7); c.fill();
            c.shadowColor = '#ff5ed1'; c.shadowBlur = 6; c.fillStyle = '#ff8ae0';
            c.fillRect(px - 2.4, py - 6 + bob, 1.6, 1.6); c.fillRect(px + 0.8, py - 6 + bob, 1.6, 1.6);
            c.shadowBlur = 0;
            c.strokeStyle = '#8a6a4a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(px + 10, py + 8); c.lineTo(px + 10, py - 10 + bob); c.stroke();
            const sr = e.sarj > 0 ? 3 + (16 - e.sarj) / 16 * 4 : 2.6;
            c.shadowColor = '#ff5ed1'; c.shadowBlur = e.sarj > 0 ? 18 : 8;
            c.fillStyle = e.sarj > 0 ? '#ffd0f4' : '#ff5ed1';
            c.beginPath(); c.arc(px + 10, py - 13 + bob, sr, 0, 7); c.fill();
            if (e.sarj > 0) { c.strokeStyle = 'rgba(255,94,209,0.6)'; c.lineWidth = 1; c.beginPath(); c.arc(px, py, 6 + e.sarj, 0, 7); c.stroke(); }
        } else {
            c.fillStyle = '#20232d'; c.fillRect(px - 11, py - 2, 22, 11);
            const g = c.createLinearGradient(px - 11, py - 12, px + 11, py + 6);
            g.addColorStop(0, cb ? '#a9a2b8' : '#868ca0'); g.addColorStop(1, cb ? '#5d4f66' : '#454a5c');
            c.fillStyle = g; c.fillRect(px - 11, py - 12, 22, 14);
            c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(px - 11, py - 5); c.lineTo(px + 11, py - 5); c.moveTo(px, py - 12); c.lineTo(px, py + 2); c.stroke();
            c.strokeStyle = '#c9c1a0'; c.lineWidth = 2.2;
            c.beginPath(); c.moveTo(px - 7, py - 12); c.quadraticCurveTo(px - 13, py - 16, px - 11, py - 21); c.moveTo(px + 7, py - 12); c.quadraticCurveTo(px + 13, py - 16, px + 11, py - 21); c.stroke();
            c.shadowColor = '#ff9a3c'; c.shadowBlur = 8; c.fillStyle = '#ffb36b'; c.fillRect(px - 6, py - 9, 12, 2.2);
            c.shadowBlur = 0;
            for (let i = 0; i < e.max; i++) { c.fillStyle = i < Math.ceil(e.hp) ? '#ffcf7a' : 'rgba(255,255,255,0.15)'; c.fillRect(px - 11 + i * 4, py - 27, 3, 3); }
        }
        c.restore();
        }
        if (e.tur !== 'zirhli' && e.hp < e.max) {
            c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(px - 9, py - 42, 18, 3);
            c.fillStyle = '#ff6b5e'; c.fillRect(px - 9, py - 42, 18 * Math.max(0, e.hp) / e.max, 3);
        }
        if (e.flash > 0 && !SP(spn)) { c.save(); c.globalAlpha = 0.55; c.fillStyle = '#fff'; c.beginPath(); c.arc(px, py - 4, 14, 0, 7); c.fill(); c.restore(); }
        if (e.zehirT > 0 && !o.reduced) { c.fillStyle = 'rgba(124,255,107,0.8)'; for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1; c.beginPath(); c.arc(px + Math.cos(a) * 7, py - 6 - ((t * 12 + i * 5) % 12), 1.6, 0, 7); c.fill(); } }
    }

    function bossCiz(c, b, o) {
        const px = b.x * C, py = b.y * C, R = b.r * C * 1.3, t = o.t;
        const renk = b.faz === 1 ? '#ff8a2a' : b.faz === 2 ? '#ff5a2a' : '#ff2a5a';
        c.save();
        if (b.uyan > 0) c.globalAlpha = 0.3 + 0.7 * (1 - b.uyan / 40);
        if (!SP('jarl')) golge(c, px + 8, py + R * 0.95, R * 1.1, R * 0.35, 0.5);
        if (!o.reduced) {
            c.globalCompositeOperation = 'lighter';
            const ag = c.createRadialGradient(px, py, R * 0.3, px, py, R * 2.2);
            ag.addColorStop(0, renk + '55'); ag.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = ag; c.fillRect(px - R * 2.2, py - R * 2.2, R * 4.4, R * 4.4);
            c.globalCompositeOperation = 'source-over';
        }
        if (SP('jarl')) {
            // kare: bekleme döngüsü (nefes) | kükreme: uyanış, faz geçişi (1.2 sn), şarj ve hamle
            let bh = bossHafiza.get(b);
            if (!bh) { bh = { faz: b.faz, t0: -99 }; bossHafiza.set(b, bh); }
            if (bh.faz !== b.faz) { bh.faz = b.faz; bh.t0 = t; }
            const gecis = t - bh.t0 >= 0 && t - bh.t0 < 1.2;
            let fr, kuk = 0;
            if (o.reduced) fr = 0;
            else if (b.hamle > 0) { fr = kare('jarl', 'saldiri', 2); kuk = 1; }
            else if (b.sarj > 0) { fr = kare('jarl', 'saldiri', Math.min(3, Math.floor((20 - b.sarj) / 20 * 3))); kuk = 0.7; }
            else if (gecis) { const k = Math.floor((t - bh.t0) / 0.24); fr = kare('jarl', 'saldiri', Math.min(3, k > 3 ? 2 + (k % 2) : k)); kuk = 1 - (t - bh.t0) / 1.2; }
            else if (b.uyan > 0) { fr = kare('jarl', 'saldiri', Math.min(3, Math.floor((40 - b.uyan) / 10))); kuk = 0.6; }
            else fr = kare('jarl', 'bekle', t * 6);
            const s = R / 27;
            golge(c, px + 2, py + R * 0.8, R * 0.85, R * 0.28, 0.32);
            Sprites.draw(c, 'jarl', fr, px, py + R * 0.8, s);
            // faz rengi: göğüs çekirdeği nabzı + kükremede faz renginde parıltı
            const p = 0.75 + 0.25 * Math.sin(t * (2 + b.faz));
            c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= 0.45 * p + 0.4 * kuk;
            const cg = c.createRadialGradient(px, py + R * 0.05, 1, px, py + R * 0.05, R * (0.6 + 0.4 * kuk));
            cg.addColorStop(0, b.faz === 3 ? '#ff6a8a' : '#ffb347'); cg.addColorStop(1, 'rgba(60,10,0,0)');
            c.fillStyle = cg; c.beginPath(); c.arc(px, py + R * 0.05, R, 0, 7); c.fill();
            c.restore();
            if (kuk > 0) Sprites.drawTint(c, 'jarl', fr, px, py + R * 0.8, s, false, renk, 0.35 * kuk);
            if (b.flash > 0) Sprites.drawTint(c, 'jarl', fr, px, py + R * 0.8, s, false, '#ffffff', Math.min(1, b.flash / 4) * 0.8);
        } else {
        // pelerin
        c.fillStyle = '#17141a';
        c.beginPath();
        c.moveTo(px - R * 0.9, py - R * 0.35);
        c.lineTo(px - R * 1.15, py + R * 0.9);
        for (let i = 0; i <= 6; i++) c.lineTo(px - R * 1.15 + i * R * 0.383, py + R * (i % 2 ? 0.7 : 0.95));
        c.lineTo(px + R * 0.9, py - R * 0.35);
        c.quadraticCurveTo(px, py - R * 0.75, px - R * 0.9, py - R * 0.35);
        c.fill();
        c.strokeStyle = renk; c.globalAlpha *= 0.7; c.lineWidth = 2; c.stroke(); c.globalAlpha = b.uyan > 0 ? 0.3 + 0.7 * (1 - b.uyan / 40) : 1;
        // erimiş göğüs çekirdeği
        const p = 0.75 + 0.25 * Math.sin(t * (2 + b.faz));
        const cg = c.createRadialGradient(px, py + R * 0.1, 1, px, py + R * 0.1, R * 0.55);
        cg.addColorStop(0, '#fff6d0'); cg.addColorStop(0.35, b.faz === 3 ? '#ff6a8a' : '#ffb347'); cg.addColorStop(1, 'rgba(60,10,0,0)');
        c.globalAlpha *= p; c.fillStyle = cg; c.beginPath(); c.arc(px, py + R * 0.1, R * 0.55, 0, 7); c.fill(); c.globalAlpha = b.uyan > 0 ? 0.3 + 0.7 * (1 - b.uyan / 40) : 1;
        c.strokeStyle = renk; c.lineWidth = 1.6;
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; c.beginPath(); c.moveTo(px + Math.cos(a) * R * 0.2, py + R * 0.1 + Math.sin(a) * R * 0.2); c.lineTo(px + Math.cos(a) * R * 0.7, py + R * 0.1 + Math.sin(a) * R * 0.6); c.stroke(); }
        // omuz zırhı
        c.fillStyle = '#3d3a44';
        [-1, 1].forEach(s => { c.beginPath(); c.ellipse(px + s * R * 0.78, py - R * 0.3, R * 0.32, R * 0.22, s * 0.3, 0, 7); c.fill(); });
        // miğfer + boynuz taç
        c.fillStyle = '#25222b';
        c.beginPath(); c.arc(px, py - R * 0.62, R * 0.36, 0, 7); c.fill();
        c.strokeStyle = '#d8cfae'; c.lineWidth = 3;
        [-1, 1].forEach(s => {
            c.beginPath(); c.moveTo(px + s * R * 0.25, py - R * 0.85);
            c.quadraticCurveTo(px + s * R * 0.75, py - R * 1.1, px + s * R * 0.7, py - R * 1.6); c.stroke();
            c.beginPath(); c.moveTo(px + s * R * 0.6, py - R * 1.2); c.lineTo(px + s * R * 0.95, py - R * 1.35); c.stroke();
        });
        c.shadowColor = renk; c.shadowBlur = 12; c.fillStyle = '#fff1b0';
        c.fillRect(px - R * 0.22, py - R * 0.66, R * 0.14, R * 0.07); c.fillRect(px + R * 0.08, py - R * 0.66, R * 0.14, R * 0.07);
        c.shadowBlur = 0;
        }
        // yüzen közler
        if (!o.reduced) for (let i = 0; i < 10; i++) {
            const a = i * 0.628 + t * 0.6, rr = R * (1.1 + 0.3 * Math.sin(t * 2 + i));
            c.fillStyle = i % 2 ? '#ffb347' : renk;
            c.fillRect(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.7 - ((t * 20 + i * 7) % 20), 2, 2);
        }
        if (b.sarj > 0) {
            c.strokeStyle = `rgba(255,40,80,${0.4 + 0.4 * Math.sin(t * 20)})`; c.lineWidth = 3; c.setLineDash([10, 8]);
            c.beginPath(); c.moveTo(px, py); c.lineTo(px + b.hx * 30 * C, py + b.hy * 30 * C); c.stroke(); c.setLineDash([]);
        }
        if (b.flash > 0 && !SP('jarl')) { c.globalAlpha = 0.5; c.fillStyle = '#fff'; c.beginPath(); c.arc(px, py, R, 0, 7); c.fill(); }
        c.restore();
    }

    // Yılanın altındaki katman: oda, kapılar, nesneler, düşmanlar, oyuncu mermileri
    function ciz(c, run, o) {
        const oda = run.odalar[run.oda];
        c.drawImage(statik(oda, o.dpr || 1), 0, 0, W * C, H * C);
        const t = o.t;
        // rün çemberi: temizse altın, savaşta kızıl nabız
        c.save();
        c.globalCompositeOperation = 'lighter';
        const p = 0.5 + 0.5 * Math.sin(t * 2);
        c.strokeStyle = oda.temiz ? `rgba(232,196,106,${0.12 + 0.1 * p})` : `rgba(255,60,80,${0.1 + 0.12 * p})`;
        c.lineWidth = 3; c.beginPath(); c.arc(W * C / 2, H * C / 2 + 10, 102, 0, 7); c.stroke();
        c.restore();
        kapilarCiz(c, oda, o);
        mesaleler(c, t, o.reduced);
        if (oda.tur === 'baslangic') {
            c.save(); c.font = '9px ' + FONT; c.textAlign = 'center'; c.fillStyle = 'rgba(232,196,106,0.45)';
            c.fillText('SPACE: KUYRUKTAN ATEŞ   ·   GÖVDENLE ÇARP', W * C / 2, 27 * C);
            c.fillText(run.yetenek.atilim ? 'SHIFT: ATILIM   ·   1/2: ARMAĞAN SEÇ' : 'ODALARI TEMİZLE · ARMAĞAN SEÇ · KÜL JARLI\'NI YEN', W * C / 2, 28 * C + 6);
            c.restore();
        }
        // uçurum kapısı önünde atılım simgesi
        Object.keys(oda.kapilar).forEach(yon => {
            if (oda.kapilar[yon].engel !== 'atilim') return;
            const hs = kapiHucreleri(yon), ic = YON[TERS[yon]];
            ikon(c, 'atilim', (hs[1].x + 1) * C + ic.x * 30, hs[1].y * C + C / 2 + ic.y * 30, 16, run.yetenek.atilim ? 'rgba(127,227,255,0.9)' : 'rgba(127,227,255,0.3)');
        });
        if (oda.sandik) sandikCiz(c, oda.sandik, t);
        if (oda.sunak) sunakCiz(c, oda.sunak, t, o.reduced);
        if (oda.cikis) cikisCiz(c, oda.cikis, t, o.reduced);
        if (oda.kemerler) oda.kemerler.forEach(k => kemerCiz(c, k, t, o.reduced));
        // ruh özleri
        run.ozler.forEach((z, i) => {
            const bob = o.reduced ? 0 : Math.sin(t * 5 + i) * 2;
            golge(c, z.x * C + 2, z.y * C + 6, 4, 2, 0.35);
            c.save(); c.shadowColor = '#9dffd0'; c.shadowBlur = 10; c.fillStyle = '#c8ffe6';
            c.beginPath(); c.arc(z.x * C, z.y * C - 3 + bob, 3.2, 0, 7); c.fill(); c.restore();
        });
        // doğum işaretleri
        oda.dogumlar.forEach(d => {
            const k = d.t / 22;
            c.save(); c.strokeStyle = `rgba(255,60,80,${0.9 - k * 0.5})`; c.lineWidth = 2;
            c.beginPath(); c.arc(d.x * C, d.y * C, 4 + k * 14, 0, 7); c.stroke();
            c.beginPath(); c.moveTo(d.x * C - 5, d.y * C); c.lineTo(d.x * C + 5, d.y * C); c.moveTo(d.x * C, d.y * C - 5); c.lineTo(d.x * C, d.y * C + 5); c.stroke();
            c.restore();
        });
        // düşmanlar + boss: y'ye göre ressam sırası (ölüm animasyonları dahil)
        const h0 = run.snake && run.snake[0];
        bas.x = h0 ? h0.x + 0.5 : -99; bas.y = h0 ? h0.y + 0.5 : -99;
        const ol = olumTakip(oda, t);
        const hep = oda.dusmanlar.map(e => ({ y: e.y, f: () => dusmanCiz(c, e, o) }));
        ol.forEach(d => hep.push({ y: d.y, f: () => olumCiz(c, d, t, o.reduced) }));
        if (oda.boss) hep.push({ y: oda.boss.y, f: () => bossCiz(c, oda.boss, o) });
        hep.sort((a, b) => a.y - b.y).forEach(h => h.f());
        // atılım izi
        run.izler.forEach(z => {
            c.save(); c.strokeStyle = `rgba(127,227,255,${z.t / 10 * 0.8})`; c.lineWidth = 10 * z.t / 10; c.lineCap = 'round';
            c.beginPath(); c.moveTo(z.x0 * C, z.y0 * C); c.lineTo(z.x1 * C, z.y1 * C); c.stroke(); c.restore();
        });
        // oyuncu mermileri: rün oku
        run.mermiler.forEach(m => {
            c.save();
            c.shadowColor = m.zehir ? '#7CFF6B' : '#00e5ff'; c.shadowBlur = 12;
            c.strokeStyle = m.zehir ? 'rgba(124,255,107,0.5)' : 'rgba(0,229,255,0.45)'; c.lineWidth = 4; c.lineCap = 'round';
            c.beginPath(); c.moveTo(m.x * C - m.dx * 14, m.y * C - m.dy * 14); c.lineTo(m.x * C, m.y * C); c.stroke();
            c.fillStyle = '#e6fdff'; c.beginPath(); c.arc(m.x * C, m.y * C, 3.5, 0, 7); c.fill();
            c.restore();
        });
    }

    // Yılanın üstündeki katman: düşman mermileri, ışık, mini harita, HUD
    function cizUst(c, run, o) {
        const oda = run.odalar[run.oda], t = o.t;
        run.oklar.forEach(k => {
            const px = k.x * C, py = k.y * C;
            c.save();
            c.shadowColor = k.kaynak === 'boss' ? '#ff7a2a' : '#ff5ed1'; c.shadowBlur = 10;
            c.fillStyle = k.kaynak === 'boss' ? '#ffb347' : '#ff8ae0';
            c.beginPath(); c.arc(px, py, 4.5, 0, 7); c.fill();
            c.fillStyle = '#fff'; c.beginPath(); c.arc(px, py, 1.8, 0, 7); c.fill();
            c.restore();
        });
        const bas = o.bas || run.snake[0];
        const hx = (bas.x + 0.5) * C, hy = (bas.y + 0.5) * C;
        // dokunulmazlık / kalkan halkası
        if (run.inv > 0 && (Math.floor(t * 12) % 2 === 0 || o.reduced)) {
            c.save(); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2; c.beginPath(); c.arc(hx, hy, 14, 0, 7); c.stroke(); c.restore();
        }
        if (run.kalkan > 0) {
            c.save(); c.strokeStyle = 'rgba(94,196,255,0.75)'; c.lineWidth = 2; c.setLineDash([5, 4]);
            c.beginPath(); c.arc(hx, hy, 17, t * 2, t * 2 + Math.PI * 2); c.stroke(); c.restore();
        }
        // ışık: başın çevresi aydınlık, köşeler karanlık; meşaleler sıcak
        const lg = c.createRadialGradient(hx, hy, 90, hx, hy, 600);
        lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(2,3,8,0.4)');
        c.fillStyle = lg; c.fillRect(0, 0, W * C, H * C);
        c.save(); c.globalCompositeOperation = 'lighter';
        [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2]].forEach(([x, y], i) => {
            const f = o.reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 7 + i * 1.7);
            const px = x * C + C / 2, py = y * C;
            const g = c.createRadialGradient(px, py, 4, px, py, 150);
            g.addColorStop(0, `rgba(255,150,70,${0.16 * f})`); g.addColorStop(1, 'rgba(255,150,70,0)');
            c.fillStyle = g; c.fillRect(px - 150, py - 150, 300, 300);
        });
        c.restore();
        // boss çubuğu
        if (oda.boss) {
            const b = oda.boss, bw = 420, bx = (W * C - bw) / 2, by = 26;
            c.save();
            c.fillStyle = 'rgba(8,6,10,0.8)'; c.fillRect(bx - 4, by - 18, bw + 8, 30);
            c.strokeStyle = 'rgba(232,196,106,0.6)'; c.lineWidth = 1; c.strokeRect(bx - 4, by - 18, bw + 8, 30);
            c.font = '9px ' + FONT; c.textAlign = 'left'; c.fillStyle = '#e8c46a'; c.fillText('KÜL JARLI', bx, by - 5);
            c.textAlign = 'right'; c.fillStyle = '#ffb347'; c.fillText(b.uyan > 0 ? 'UYANIYOR' : 'FAZ ' + b.faz, bx + bw, by - 5);
            c.fillStyle = '#1a0e0e'; c.fillRect(bx, by, bw, 7);
            const g = c.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#ff2a5a'); g.addColorStop(1, '#ffb347');
            c.fillStyle = g; c.fillRect(bx, by, bw * Math.max(0, b.hp) / b.max, 7);
            c.fillStyle = 'rgba(255,255,255,0.5)'; [1 / 3, 2 / 3].forEach(f => c.fillRect(bx + bw * f, by, 1, 7));
            c.restore();
        }
        haritaCiz(c, run, t);
        durumCiz(c, run);
    }

    function haritaCiz(c, run, t) {
        const cw = 24, ch = 16, gap = 5, pw = 3 * cw + 2 * gap;
        const x0 = W * C - pw - 16, y0 = 16;
        c.save();
        c.fillStyle = 'rgba(8,10,16,0.78)';
        c.fillRect(x0 - 8, y0 - 8, pw + 16, 3 * ch + 2 * gap + 26);
        c.strokeStyle = 'rgba(232,196,106,0.5)'; c.lineWidth = 1;
        c.strokeRect(x0 - 8 + 0.5, y0 - 8 + 0.5, pw + 15, 3 * ch + 2 * gap + 25);
        const pos = k => { const [rx, ry] = k.split(',').map(Number); return { x: x0 + rx * (cw + gap), y: y0 + ry * (ch + gap) }; };
        const bilinen = {};
        Object.keys(run.odalar).forEach(k => { if (run.odalar[k].ziyaret) bilinen[k] = 2; });
        BAGLAR.forEach(([a, yon]) => { const b = komsu(a, yon); if (bilinen[a] === 2 && !bilinen[b]) bilinen[b] = 1; if (bilinen[b] === 2 && !bilinen[a]) bilinen[a] = 1; });
        BAGLAR.forEach(([a, yon, engel]) => {
            const b = komsu(a, yon);
            if (!bilinen[a] || !bilinen[b] || (bilinen[a] < 2 && bilinen[b] < 2)) return;
            const pa = pos(a), pb = pos(b);
            const ax = pa.x + cw / 2, ay = pa.y + ch / 2, bx = pb.x + cw / 2, by = pb.y + ch / 2;
            c.strokeStyle = !engel ? '#8a8fa3' : run.yetenek[engel] ? YETENEKLER[engel].renk : '#6b4a3a';
            c.lineWidth = engel ? 3 : 2;
            c.setLineDash(engel && !run.yetenek[engel] ? [2, 2] : []);
            c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
        });
        c.setLineDash([]);
        Object.keys(run.odalar).forEach(k => {
            const o = run.odalar[k], p = pos(k), bil = bilinen[k];
            if (!bil) return;
            if (bil === 2) { c.fillStyle = o.temiz ? '#2e5a47' : '#6a2e38'; c.fillRect(p.x, p.y, cw, ch); }
            else { c.fillStyle = '#12141c'; c.fillRect(p.x, p.y, cw, ch); c.strokeStyle = '#555b70'; c.strokeRect(p.x + 0.5, p.y + 0.5, cw - 1, ch - 1); }
            const mx = p.x + cw / 2, my = p.y + ch / 2;
            if (o.tur === 'boss') { c.fillStyle = '#ff5a3a'; c.beginPath(); c.arc(mx, my, 3.5, 0, 7); c.fill(); }
            else if (o.tur === 'gizli' && bil === 2) { c.fillStyle = '#e8c46a'; c.beginPath(); c.moveTo(mx, my - 4); c.lineTo(mx + 4, my); c.lineTo(mx, my + 4); c.lineTo(mx - 4, my); c.fill(); }
            else if (o.tur === 'hazine' && bil === 2) { c.fillStyle = '#e8c46a'; c.fillRect(mx - 4, my - 3, 8, 6); c.fillStyle = '#6e4220'; c.fillRect(mx - 4, my - 1, 8, 1); }
            else if (o.tur === 'gizli' || o.tur === 'hazine') { c.fillStyle = '#8a8fa3'; c.font = '7px ' + FONT; c.textAlign = 'center'; c.fillText('?', mx, my + 3.5); }
            if (k === run.oda) { c.strokeStyle = `rgba(232,196,106,${0.7 + 0.3 * Math.sin(t * 5)})`; c.lineWidth = 2; c.strokeRect(p.x - 1, p.y - 1, cw + 2, ch + 2); }
        });
        c.font = '7px ' + FONT; c.textAlign = 'center'; c.fillStyle = 'rgba(232,196,106,0.8)';
        c.fillText('TAPINAK', x0 + pw / 2, y0 + 3 * ch + 2 * gap + 12);
        c.restore();
    }

    function durumCiz(c, run) {
        const x0 = 14, y0 = H * C - 16;
        c.save();
        const armSay = {};
        run.armaganlar.forEach(a => { armSay[a] = (armSay[a] || 0) + 1; });
        const arm = Object.keys(armSay);
        const pw = Math.max(150, 18 * run.canMax + 30, arm.length * 26 + 16);
        c.fillStyle = 'rgba(8,10,16,0.72)'; c.fillRect(x0 - 6, y0 - 50, pw, 58);
        for (let i = 0; i < run.canMax; i++) ikon(c, 'can', x0 + 8 + i * 18, y0 - 38, 14, i < run.can ? '#ff4d7a' : 'rgba(255,77,122,0.2)');
        for (let i = 0; i < run.kalkanMax; i++) ikon(c, 'kalkan', x0 + 8 + (run.canMax + i) * 18 + 6, y0 - 38, 12, i < run.kalkan ? '#5ec4ff' : 'rgba(94,196,255,0.2)');
        // kalıcı yetenekler (sağda)
        Object.keys(YETENEKLER).forEach((k, i) => ikon(c, k, x0 + pw - 22 - (2 - i) * 18, y0 - 38, 12, run.yetenek[k] ? YETENEKLER[k].renk : 'rgba(255,255,255,0.12)'));
        arm.forEach((a, i) => {
            ikon(c, a, x0 + 8 + i * 26, y0 - 12, 13, ARMAGANLAR[a].renk);
            if (armSay[a] > 1) { c.font = '7px ' + FONT; c.textAlign = 'left'; c.fillStyle = '#fff'; c.fillText('x' + armSay[a], x0 + 15 + i * 26, y0 - 4); }
        });
        c.restore();
    }

    return {
        W, H, HUCRE: { ZEMIN, DUVAR, SUTUN, UCURUM, CATLAK, KILIT, KAPI }, ARMAGANLAR, YETENEKLER, DUSMANLAR, HARITA, BAGLAR, ANAHTAR,
        yeniKosu, adim, ates, atil, sec, hasar, yukle, kaydet, hucre, kapiHucreleri, duzen, ozet, mulberry,
        olaylariAl: run => run.ev.splice(0),
        ciz, cizUst, ikon,
        // test/inceleme: odadaki süren ölüm animasyonu sayısı (yalnız çizim durumu)
        _olumSayisi: oda => (olumler.get(oda) || []).length
    };
})();
