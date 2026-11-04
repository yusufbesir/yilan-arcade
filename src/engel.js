// ========================================================================
// ENGEL - bölüm biyomuna göre engel ÇEŞİTLERİ (Twilight of the Serpents)
// YALNIZ görsel/şekil farkıdır: oyun mantığı aynı kalır (hepsi mevcut `obstacles` dizisindeki hücreler gibi
// çarpınca hasar/ölüm; hücre bazlı çarpışma; yeni kural yok). Nesneye isteğe bağlı `tur` alanı eklenir:
//   Taş: sutun, yikik (yıkık duvar)        Kaya: stalagmit, yigin (kaya yığını)
//   Buzul: dag (buz dağı), kristal          Lav: nehir (akan lav nehri), bazalt
//   Bataklık: agac, sazlik, su (nehir)      Rün: dikilitas (rün dikilitaşı)
// uret(): küme/şerit yerleşimi, ayrı tohumdan (oyunun rand'ını tüketmez; Günlük sırası değişmez).
//   Yılanın doğduğu şerit, yılan, yem ve hareketli engellerin yanı boş kalır; haritada ulaşılamaz kapalı
//   bölge bırakan küme atılır (flood-fill). Günlük/Portal'da yalnız mevcut engeller etiketlenir (hücre ekleme yok).
// ciz(): statik katman tek tuvale pişirilir (yerleşim değişince), karede yalnız akış/parıltı çizilir.
//   Renk körü: PALET.engel tek tonu + biçim farkı (kenar çizgisi, nehirde çapraz tarama). Reduced: akış durur.
// ========================================================================
const Engel = (() => {
    'use strict';
    const TAU = Math.PI * 2;
    const TURLER = {
        tas: ['sutun', 'yikik', 'devrik'], kaya: ['stalagmit', 'yigin'], buz: ['dag', 'kristal'],
        lav: ['nehir', 'bazalt'], bat: ['agac', 'sazlik', 'su'], run: ['dikilitas']
    };
    const AD = {
        sutun: 'taş sütun', yikik: 'yıkık duvar', devrik: 'devrik sütun', stalagmit: 'stalagmit', yigin: 'kaya yığını', dag: 'buz dağı', kristal: 'buz kristali',
        nehir: 'lav nehri', bazalt: 'bazalt kayası', agac: 'ağaç', sazlik: 'sazlık', su: 'nehir', dikilitas: 'rün dikilitaşı'
    };
    const AKIS = { nehir: 1, su: 1 };                 // zemine yassı şerit türleri
    const BAGLI = { devrik: 1, yikik: 1, yigin: 1, dag: 1, nehir: 1, su: 1, bazalt: 1, sazlik: 1 }; // komşu hücrelerle birleşir
    const TEK = { tas: ['sutun', 'yikik'], kaya: ['stalagmit', 'yigin'], buz: ['kristal', 'dag'], lav: ['bazalt', 'bazalt'], bat: ['agac', 'sazlik'], run: ['dikilitas', 'dikilitas'] };

    // ---------- yardımcılar ----------
    function hash32(s) {
        let h = 2166136261;
        s = String(s);
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }
    function rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    const hxy = (x, y, k) => hash32(x * 73856093 ^ y * 19349663 ^ (k || 0) * 83492791);
    function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
    function tone(hex, k) {
        const c = hexRgb(hex);
        const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
        return 'rgb(' + f(c[0]) + ',' + f(c[1]) + ',' + f(c[2]) + ')';
    }
    function rgba(hex, a) { const c = hexRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

    // ---------- etiketleme (rand tüketmez; konuma bağlı) ----------
    // Etiketsiz engellere temaya uygun tür verir. Yan yana hücreler birleşen türü alır (duvar, sırt, öbek).
    function etiketle(list, tema) {
        const T = TEK[tema] ? tema : 'tas';
        const var_ = new Set();
        for (let i = 0; i < list.length; i++) var_.add(list[i].x + ',' + list[i].y);
        let n = 0;
        for (let i = 0; i < list.length; i++) {
            const o = list[i];
            if (o.tur) continue;
            const komsu = var_.has((o.x + 1) + ',' + o.y) || var_.has((o.x - 1) + ',' + o.y) || var_.has(o.x + ',' + (o.y + 1)) || var_.has(o.x + ',' + (o.y - 1));
            const h = hxy(o.x, o.y, 7);
            let tur = TEK[T][(h >> 3) & 1];
            if (komsu) tur = { tas: 'yikik', kaya: 'yigin', buz: 'dag', lav: 'bazalt', bat: 'sazlik', run: 'dikilitas' }[T];
            o.tur = tur; o.v = (h >> 5) & 3;
            n++;
        }
        return n;
    }

    // ---------- küme / şerit üretimi ----------
    const D4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    function sekilTek() { return [{ x: 0, y: 0 }]; }
    function sekilSeg(R, n) {
        const yatay = R() < 0.55, c = [];
        for (let i = 0; i < n; i++) c.push(yatay ? { x: i, y: 0 } : { x: 0, y: i });
        if (n >= 4 && R() < 0.6) c.splice(1 + Math.floor(R() * (n - 2)), 1); // yıkık: aradan bir parça kopuk
        return c;
    }
    function sekilBlob(R, n) {
        const c = [{ x: 0, y: 0 }], var_ = new Set(['0,0']);
        for (let g = 0; c.length < n && g < 60; g++) {
            const b = c[Math.floor(R() * c.length)], d = D4[Math.floor(R() * 4)];
            const x = b.x + d[0], y = b.y + d[1];
            if (var_.has(x + ',' + y)) continue;
            var_.add(x + ',' + y); c.push({ x, y });
        }
        return c;
    }
    // Sütun sırası: aralıklı (bir hücre boşluklu) düz dizi
    function sekilSira(R, n) {
        const yatay = R() < 0.5, c = [];
        for (let i = 0; i < n; i++) c.push(yatay ? { x: i * 2, y: 0 } : { x: 0, y: i * 2 });
        return c;
    }
    // Dolu dikdörtgen kütle (en çok 3x3), rastgele köşeleri kırpılmış: buz dağı / kaya kütlesi
    function sekilBlok(R, n) {
        let w = 2 + Math.floor(R() * 2), h = 2 + Math.floor(R() * 2);
        if (n >= 8) { w = 3; h = 3; }
        const c = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c.push({ x, y });
        const kose = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
        for (let k = 0; k < 2 && c.length > n && c.length > 4; k++) {
            const q = kose[Math.floor(R() * 4)], i = c.findIndex(e => e.x === q[0] && e.y === q[1]);
            if (i >= 0) c.splice(i, 1);
        }
        return c;
    }
    // Rün halkası: 5x5 çevresinde 8 konumdan 6-8'i (aralarında geçit)
    function sekilHalka(R) {
        const P = [[0, 0], [2, 0], [4, 0], [4, 2], [4, 4], [2, 4], [0, 4], [0, 2]];
        const at = Math.floor(R() * 3);
        for (let i = 0; i < at; i++) P.splice(Math.floor(R() * P.length), 1);
        return P.map(q => ({ x: q[0], y: q[1] }));
    }
    // İki hücre genişliğinde şerit: ana zincirin yanına bir sıra daha
    function sekilSerit2(R, n, kiv) {
        const c = sekilSerit(R, n, kiv), var_ = new Set(c.map(q => q.x + ',' + q.y)), ek = [];
        c.forEach(q => {
            const o = (q.d & 1) === 0 ? { x: 0, y: 1 } : { x: 1, y: 0 }, k = (q.x + o.x) + ',' + (q.y + o.y);
            if (!var_.has(k)) { var_.add(k); ek.push({ x: q.x + o.x, y: q.y + o.y, d: q.d }); }
        });
        return c.concat(ek);
    }
    function sekilSerit(R, n, kiv) {
        kiv = kiv || 0.3;
        let d = Math.floor(R() * 4);
        let x = 0, y = 0;
        const c = [{ x, y, d }], var_ = new Set(['0,0']);
        const yakin = (px, py, sonX, sonY) => D4.some(q => { const k = (px + q[0]) + ',' + (py + q[1]); return var_.has(k) && !((px + q[0]) === sonX && (py + q[1]) === sonY); });
        for (let i = 1; i < n; i++) {
            let ok = false;
            for (let dene = 0; dene < 6 && !ok; dene++) {
                const nd = (dene === 0 && R() > kiv) ? d : (d + (R() < 0.5 ? 1 : 3)) % 4;
                const nx = x + D4[nd][0], ny = y + D4[nd][1];
                if (var_.has(nx + ',' + ny) || yakin(nx, ny, x, y)) continue;
                c[c.length - 1].d = nd; d = nd; x = nx; y = ny;
                var_.add(x + ',' + y); c.push({ x, y, d }); ok = true;
            }
            if (!ok) break;
        }
        return c;
    }

    // Tema planı: [tür, şekil, adet, [min, max] hücre, kıvrım olasılığı]
    function plan(tema, seviye) {
        const sc = Math.min(2, Math.max(0, seviye) / 10), k = n => Math.floor(sc * n);
        switch (tema) {
            case 'tas': return [['yikik', 'seg', 3 + k(2), [2, 5]], ['sutun', 'sira', 2 + k(1), [3, 5]], ['devrik', 'seg', 2 + k(1), [2, 2]], ['sutun', 'tek', 4 + k(2)]];
            case 'kaya': return [['yigin', 'blok', 3 + k(2), [4, 9]], ['yigin', 'blob', 2 + k(1), [2, 4]], ['stalagmit', 'tek', 6 + k(3)]];
            case 'buz': return [['dag', 'blok', 2 + k(2), [6, 9]], ['dag', 'blok', 2 + k(1), [3, 5]], ['kristal', 'tek', 5 + k(3)]];
            case 'lav': return [['nehir', 'serit2', 1 + k(1), [6, 10], 0.3], ['bazalt', 'blob', 4 + k(1), [1, 3]]];
            case 'bat': return [['su', 'serit2', 1 + k(1) - (sc > 1 ? 0 : 0), [7, 11], 0.45], ['agac', 'blob', 3 + k(1), [3, 5]], ['agac', 'tek', 2 + k(1)], ['sazlik', 'blob', 3 + k(1), [1, 3]]];
            case 'run': return [['dikilitas', 'halka', 1 + k(1), [6, 8]], ['dikilitas', 'tek', 5 + k(2)]];
        }
        return [['sutun', 'tek', 4]];
    }

    // Baştan ulaşılamayan boş hücre sayısı (flood-fill)
    function ulasilamaz(grid, C, R, bx, by) {
        const seen = new Uint8Array(C * R);
        const st = [bx + by * C];
        seen[st[0]] = 1;
        let ulas = 1;
        while (st.length) {
            const p = st.pop(), x = p % C, y = (p / C) | 0;
            for (let i = 0; i < 4; i++) {
                const nx = x + D4[i][0], ny = y + D4[i][1];
                if (nx < 0 || ny < 0 || nx >= C || ny >= R) continue;
                const q = nx + ny * C;
                if (seen[q] || grid[q]) continue;
                seen[q] = 1; ulas++; st.push(q);
            }
        }
        let bos = 0;
        for (let i = 0; i < grid.length; i++) if (!grid[i]) bos++;
        return bos - ulas;
    }

    // o: { tema, mod, COLS, ROWS, yilan:[{x,y}], yem:{x,y}, hareketli:[{x,y}], tohum, seviye, ek:bool }
    // Dönen: eklenen hücre sayısı. list (obstacles) yerinde değiştirilir.
    function uret(list, o) {
        const tema = TURLER[o.tema] ? o.tema : 'tas';
        etiketle(list, tema);
        if (!o.ek) return 0;
        const C = o.COLS, R = o.ROWS, orta = R >> 1;
        const rnd = rng(hash32('engel|' + (o.tohum != null ? o.tohum : Date.now() + ':' + Math.floor((typeof performance !== 'undefined' ? performance.now() : 0) * 1000)) + '|' + tema + '|' + (o.seviye | 0)));
        const grid = new Uint8Array(C * R), yasak = new Uint8Array(C * R);
        for (let i = 0; i < list.length; i++) if (list[i].x >= 0 && list[i].y >= 0 && list[i].x < C && list[i].y < R) grid[list[i].x + list[i].y * C] = 1;
        const yasakla = (px, py, r) => {
            for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
                const x = Math.round(px) + dx, y = Math.round(py) + dy;
                if (x >= 0 && y >= 0 && x < C && y < R) yasak[x + y * C] = 1;
            }
        };
        (o.yilan || []).forEach(s => yasakla(s.x, s.y, 2));
        if (o.yem) yasakla(o.yem.x, o.yem.y, 1);
        (o.hareketli || []).forEach(m => yasakla(Math.floor(m.x), Math.floor(m.y), 1));
        for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
            if (x < 2 || y < 2 || x > C - 3 || y > R - 3) yasak[x + y * C] = 1;                 // çerçeve duvara 2 hücre pay
            if (Math.abs(y - orta) <= 2 && x <= 16) yasak[x + y * C] = 1;                       // yılanın doğduğu şerit
        }
        const bas = (o.yilan && o.yilan[0]) || { x: 2, y: orta };
        const taban = ulasilamaz(grid, C, R, bas.x, bas.y);
        let eklenen = 0;
        const gruplar = [];
        const pl = plan(tema, o.seviye | 0);
        for (let pi = 0; pi < pl.length; pi++) {
            const [tur, sek, adet, aralik, kiv] = pl[pi];
            for (let a = 0; a < adet; a++) {
                for (let dene = 0; dene < 70; dene++) {
                    const n = aralik ? aralik[0] + Math.floor(rnd() * (aralik[1] - aralik[0] + 1)) : 1;
                    const sekil = sek === 'tek' ? sekilTek() : sek === 'seg' ? sekilSeg(rnd, n) : sek === 'blob' ? sekilBlob(rnd, n) : sek === 'blok' ? sekilBlok(rnd, n) : sek === 'sira' ? sekilSira(rnd, n) : sek === 'halka' ? sekilHalka(rnd) : sek === 'serit2' ? sekilSerit2(rnd, n, kiv) : sekilSerit(rnd, n, kiv);
                    if ((sek === 'serit' || sek === 'serit2') && sekil.length < 4) continue;
                    const ox = 2 + Math.floor(rnd() * (C - 4)), oy = 2 + Math.floor(rnd() * (R - 4));
                    let ok = true;
                    for (let i = 0; i < sekil.length && ok; i++) {
                        const x = ox + sekil[i].x, y = oy + sekil[i].y;
                        if (x < 0 || y < 0 || x >= C || y >= R || yasak[x + y * C]) { ok = false; break; }
                        for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) {
                            const xx = x + dx, yy = y + dy;
                            if (xx >= 0 && yy >= 0 && xx < C && yy < R && grid[xx + yy * C]) { ok = false; break; }
                        }
                    }
                    if (!ok) continue;
                    for (let i = 0; i < sekil.length; i++) grid[(ox + sekil[i].x) + (oy + sekil[i].y) * C] = 1;
                    if (ulasilamaz(grid, C, R, bas.x, bas.y) > taban) {                    // kapalı bölge: kümeyi at
                        for (let i = 0; i < sekil.length; i++) grid[(ox + sekil[i].x) + (oy + sekil[i].y) * C] = 0;
                        continue;
                    }
                    const gid = gruplar.length;
                    gruplar.push(tur);
                    for (let i = 0; i < sekil.length; i++) {
                        const x = ox + sekil[i].x, y = oy + sekil[i].y;
                        const h = hxy(x, y, 11);
                        const c = { x, y, tur, v: (h >> 4) & 3, g: gid };
                        if (AKIS[tur]) c.d = sekil[i].d;
                        list.push(c); eklenen++;
                    }
                    break;
                }
            }
        }
        return eklenen;
    }

    // ---------- ışık kaynakları (Isik.zemin okur) ----------
    const isikOnb = { sig: '', liste: [] };
    function imza(list) {
        let h = list.length;
        for (let i = 0; i < list.length; i++) { const o = list[i]; h = (Math.imul(h, 31) + (o.x * 64 + o.y) * 8 + (o.v | 0) + (o.tur ? o.tur.length : 0)) | 0; }
        return h + ':' + list.length;
    }
    function isiklar(list, S) {
        const sg = imza(list) + ':' + S;
        if (isikOnb.sig === sg) return isikOnb.liste;
        const out = [];
        let nn = 0;
        for (let i = 0; i < list.length && out.length < 40; i++) {
            const o = list[i];
            if (o.tur === 'nehir') { if ((nn++ & 1) === 0) out.push({ x: (o.x + 0.5) * S, y: (o.y + 0.5) * S + 3, renk: 'rgb(255,110,30)', r: 48, a: 0.22, f: i }); }
            else if (o.tur === 'dikilitas') out.push({ x: (o.x + 0.5) * S, y: (o.y + 0.5) * S - 4, renk: 'rgb(150,120,255)', r: 40, a: 0.2, f: i });
            else if (o.tur === 'kristal') out.push({ x: (o.x + 0.5) * S, y: (o.y + 0.5) * S - 2, renk: 'rgb(120,210,255)', r: 32, a: 0.12, f: i });
        }
        isikOnb.sig = sg; isikOnb.liste = out;
        return out;
    }

    // ====================================================================
    // ÇİZİM
    // ====================================================================
    const L = { c: null, sig: '', anim: [], bakeMs: 0, bake: 0 };
    const halos = new Map();
    function halo(renk, r, dpr) {
        const key = renk + '|' + r + '|' + dpr;
        let c = halos.get(key);
        if (c) return c;
        c = document.createElement('canvas');
        c.width = c.height = Math.ceil(r * 2 * dpr);
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(c.width / 2, c.height / 2, 1, c.width / 2, c.height / 2, r * dpr);
        gr.addColorStop(0, renk); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
        halos.set(key, c);
        return c;
    }

    // Bir hücre için komşu maskesi (aynı türden)
    function maske(set, o) {
        const k = o.tur;
        return { n: set.has(k + (o.x) + ',' + (o.y - 1)), e: set.has(k + (o.x + 1) + ',' + o.y), s: set.has(k + o.x + ',' + (o.y + 1)), w: set.has(k + (o.x - 1) + ',' + o.y) };
    }

    // Çizim bağlamı K: { g, S, cb, color, th, bp (doku deseni), dpr }
    const col = (K, hex, kcb) => (K.cb ? tone(K.color, kcb) : hex);
    function golge(K, x0, y0, rx, ry, a) {
        const g = K.g;
        g.fillStyle = 'rgba(0,0,6,' + a + ')';
        g.beginPath(); g.ellipse(x0 + K.S / 2 + 1.5, y0 + K.S - 2, rx, ry, 0, 0, TAU); g.fill();
    }
    // Yolu çiz + doldur + (varsa) gerçek doku bindir + cb kenar çizgisi
    function sekil(K, yol, dolgu, doku, kenar) {
        const g = K.g;
        g.beginPath(); yol(g); g.fillStyle = dolgu; g.fill();
        if (K.bp && doku) {
            g.save(); g.beginPath(); yol(g); g.clip();
            g.globalCompositeOperation = 'overlay'; g.globalAlpha = doku; g.fillStyle = K.bp; g.fillRect(-2, -40, K.W + 4, K.H + 44);
            g.restore();
        }
        if (K.cb || kenar) { g.beginPath(); yol(g); g.lineWidth = K.cb ? 1.1 : 0.8; g.strokeStyle = K.cb ? 'rgba(255,255,255,0.55)' : kenar; g.stroke(); }
    }
    function lin(K, x1, y1, x2, y2, stops) {
        const gr = K.g.createLinearGradient(x1, y1, x2, y2);
        for (let i = 0; i < stops.length; i += 2) gr.addColorStop(stops[i], stops[i + 1]);
        return gr;
    }
    // Yükseltilmiş kutu (eğik bakış): üst yüz hücre derinliğinde, ön yüz altta
    function kutu(K, x0, y0, l, r, h, tUst, tOn, tYan, yan) {
        const g = K.g, S = K.S;
        sekil(K, p => p.rect(x0 + l, y0 - h, r - l, S), tUst, 0.5);
        sekil(K, p => p.rect(x0 + l, y0 + S - h, r - l, h), lin(K, 0, y0 + S - h, 0, y0 + S, [0, tOn[0], 1, tOn[1]]), 0.55);
        if (yan) sekil(K, p => { p.moveTo(x0 + r, y0 - h); p.lineTo(x0 + r + 2, y0 - h + 2); p.lineTo(x0 + r + 2, y0 + S); p.lineTo(x0 + r, y0 + S); p.closePath(); }, tYan, 0.4);
        g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(x0 + l, y0 - h, r - l, 1.2);
    }

    // ---- Taş ----
    function cSutun(K, c, x0, y0) {
        const g = K.g, S = K.S, kirik = c.v & 1;
        golge(K, x0, y0, 8, 3.2, 0.4);
        const h = kirik ? 17 : 21;
        // kaide
        sekil(K, p => p.rect(x0 + 3, y0 + S - 5, S - 6, 5), col(K, '#6b7391', -0.3), 0.5);
        // gövde (silindir: yatay gradyan)
        const gv = lin(K, x0 + 5, 0, x0 + S - 5, 0, [0, col(K, '#c4cbe0', 0.45), 0.45, col(K, '#8a93ad', 0), 1, col(K, '#4d5470', -0.5)]);
        sekil(K, p => {
            p.moveTo(x0 + 5, y0 + S - 5);
            p.lineTo(x0 + 5, y0 + S - h + (kirik ? 3 : 0));
            if (kirik) { p.lineTo(x0 + 8, y0 + S - h - 1); p.lineTo(x0 + 11, y0 + S - h + 2); p.lineTo(x0 + 14, y0 + S - h - 2); }
            p.lineTo(x0 + S - 5, y0 + S - h + (kirik ? 2 : 0));
            p.lineTo(x0 + S - 5, y0 + S - 5); p.closePath();
        }, gv, 0.5, 'rgba(0,0,10,0.3)');
        g.strokeStyle = 'rgba(0,0,10,0.28)'; g.lineWidth = 0.8; g.beginPath();
        for (let i = 1; i < 4; i++) { g.moveTo(x0 + 5 + i * 2.5, y0 + S - h + 4); g.lineTo(x0 + 5 + i * 2.5, y0 + S - 6); }
        g.stroke();
        if (!kirik) {
            sekil(K, p => p.rect(x0 + 3, y0 + S - h - 3, S - 6, 4), col(K, '#aab2cc', 0.25), 0.5);                   // başlık
            sekil(K, p => p.ellipse(x0 + S / 2, y0 + S - h - 3, (S - 6) / 2, 2.4, 0, 0, TAU), col(K, '#dfe5f5', 0.6), 0.4);
        } else {
            g.fillStyle = col(K, '#7a82a0', -0.2);                                                                    // moloz
            g.beginPath(); g.moveTo(x0 + 1, y0 + S - 1); g.lineTo(x0 + 4, y0 + S - 5); g.lineTo(x0 + 7, y0 + S - 1); g.fill();
            g.beginPath(); g.moveTo(x0 + 14, y0 + S - 1); g.lineTo(x0 + 17, y0 + S - 4); g.lineTo(x0 + 19, y0 + S - 1); g.fill();
        }
    }
    function cYikik(K, c, x0, y0, m) {
        const S = K.S, g = K.g, hh = [9, 7, 11, 5][c.v & 3];
        golge(K, x0, y0, 9, 3, 0.3);
        const l = m.w ? 0 : 1.5, r = m.e ? S : S - 1.5;
        kutu(K, x0, y0, l, r, hh, col(K, '#aeb6d0', 0.3), [col(K, '#7d86a3', -0.1), col(K, '#454c68', -0.55)], col(K, '#555c78', -0.4), !m.e);
        // derz + eksik taşlar
        g.strokeStyle = 'rgba(0,0,10,0.4)'; g.lineWidth = 1; g.beginPath();
        g.moveTo(x0 + l, y0 + S - hh / 2); g.lineTo(x0 + r, y0 + S - hh / 2);
        g.moveTo(x0 + S * (0.3 + 0.35 * (c.v & 1)), y0 + S - hh); g.lineTo(x0 + S * (0.3 + 0.35 * (c.v & 1)), y0 + S - hh / 2);
        g.stroke();
        // kırık üst kenar: pürüz
        g.fillStyle = col(K, '#cfd6ea', 0.5);
        g.beginPath(); g.moveTo(x0 + 4 + (c.v & 1) * 6, y0 - hh); g.lineTo(x0 + 7 + (c.v & 1) * 6, y0 - hh - 3); g.lineTo(x0 + 10 + (c.v & 1) * 6, y0 - hh); g.fill();
        if (c.v === 2) { g.fillStyle = col(K, '#4f9a5a', -0.2); g.fillRect(x0 + 3, y0 - hh + 1, 5, 2); }         // yosun
    }
    function cDevrik(K, c, x0, y0, m) {
        const S = K.S, g = K.g, yatay = m.w || m.e || !(m.n || m.s);
        golge(K, x0, y0, 9, 3, 0.35);
        const gv = (y1, y2) => lin(K, 0, y1, 0, y2, [0, col(K, '#d2d8ea', 0.5), 0.45, col(K, '#8a93ad', 0), 1, col(K, '#454c68', -0.5)]);
        if (yatay) {
            const l = x0 + (m.w ? 0 : 2), r = x0 + (m.e ? S : S - 2), y1 = y0 + S - 13, y2 = y0 + S - 2;
            sekil(K, p => p.rect(l, y1, r - l, y2 - y1), gv(y1, y2), 0.5, 'rgba(0,0,10,0.3)');
            g.strokeStyle = 'rgba(0,0,10,0.25)'; g.lineWidth = 0.8; g.beginPath();
            for (let i = 1; i < 4; i++) { g.moveTo(l, y1 + i * 2.7); g.lineTo(r, y1 + i * 2.7); }
            g.stroke();
            if (!m.w) sekil(K, p => p.ellipse(l, (y1 + y2) / 2, 2.4, (y2 - y1) / 2, 0, 0, TAU), col(K, '#b9c0d8', 0.3), 0.3, 'rgba(0,0,10,0.3)');
            if (!m.e) { g.fillStyle = col(K, '#2f3550', -0.4); g.beginPath(); g.moveTo(r, y1); g.lineTo(r - 3, y1 + 3); g.lineTo(r, y1 + 5); g.lineTo(r - 2, y1 + 8); g.lineTo(r, y2); g.fill(); }  // kırık uç
        } else {
            const t = y0 + (m.n ? 0 : 3), bt = y0 + S - (m.s ? 0 : 2);
            sekil(K, p => p.rect(x0 + 4, t, 12, bt - t), lin(K, x0 + 4, 0, x0 + 16, 0, [0, col(K, '#d2d8ea', 0.45), 0.5, col(K, '#8a93ad', 0), 1, col(K, '#454c68', -0.5)]), 0.5, 'rgba(0,0,10,0.3)');
            if (!m.s) sekil(K, p => p.ellipse(x0 + 10, bt, 6, 3, 0, 0, TAU), col(K, '#c4cbe0', 0.4), 0.3, 'rgba(0,0,10,0.3)');
        }
    }
    // ---- Kaya ----
    function sivri(K, cx, taban, h, w, a, kcb) {
        const g = K.g;
        const sol = lin(K, cx - w, 0, cx, 0, [0, col(K, '#6f6552', -0.3 + kcb), 1, col(K, '#a49a82', 0.1 + kcb)]);
        sekil(K, p => { p.moveTo(cx - w, taban); p.lineTo(cx + a, taban - h); p.lineTo(cx + 0.5, taban); p.closePath(); }, sol, 0.55, 'rgba(0,0,0,0.3)');
        sekil(K, p => { p.moveTo(cx + 0.5, taban); p.lineTo(cx + a, taban - h); p.lineTo(cx + w, taban); p.closePath(); }, lin(K, cx, 0, cx + w, 0, [0, col(K, '#c9bfa4', 0.35 + kcb), 1, col(K, '#6a604b', -0.35 + kcb)]), 0.5, 'rgba(0,0,0,0.3)');
        g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(cx + a - 0.5, taban - h, 1, 3);
    }
    function cStalagmit(K, c, x0, y0) {
        const S = K.S, b = y0 + S - 1;
        golge(K, x0, y0, 8, 3, 0.4);
        sivri(K, x0 + 9, b, 22 + (c.v & 1) * 3, 6.5, 1, 0);
        sivri(K, x0 + 15, b, 11 + (c.v >> 1) * 2, 4, -0.5, 0.05);
        sivri(K, x0 + 4, b, 8, 3.5, 0.5, -0.05);
    }
    function cYigin(K, c, x0, y0, m) {
        const S = K.S, g = K.g, b = y0 + S - 2;
        golge(K, x0, y0, 9.5, 3.4, 0.4);
        const kaya = (cx, cy, rx, ry, k) => {
            sekil(K, p => { p.moveTo(cx - rx, cy); p.quadraticCurveTo(cx - rx * 0.8, cy - ry * 1.2, cx - rx * 0.1, cy - ry); p.quadraticCurveTo(cx + rx * 0.8, cy - ry * 1.1, cx + rx, cy); p.closePath(); },
                lin(K, cx - rx, cy - ry, cx + rx, cy, [0, col(K, '#b4a98c', 0.15 + k), 0.55, col(K, '#80765f', -0.15 + k), 1, col(K, '#4a4334', -0.5 + k)]), 0.55, 'rgba(0,0,0,0.3)');
        };
        const j = c.v, kom = (m.n ? 1 : 0) + (m.e ? 1 : 0) + (m.s ? 1 : 0) + (m.w ? 1 : 0);
        if (kom >= 2) kaya(x0 + 10, b, 10.5, 9 + kom * 3.2, 0.02);       // büyük kütle: iç hücrelerde iri kaya
        kaya(x0 + 6 + (j & 1) * 2, b, 6.5, 8, 0);
        kaya(x0 + 14, b, 6, 6, 0.05);
        kaya(x0 + 10 + (j >> 1) * 2, b - 4, 5.5, 7.5, 0.12);
        if (m.e) kaya(x0 + S, b, 5, 5, -0.05);
        if (m.s) kaya(x0 + 10, y0 + S, 5, 4, 0);
        g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x0 + 8, b - 12, 3, 1.2);
    }
    // ---- Buzul ----
    function cDag(K, c, x0, y0, m) {
        const S = K.S, g = K.g, kom = (m.n ? 1 : 0) + (m.e ? 1 : 0) + (m.s ? 1 : 0) + (m.w ? 1 : 0);
        const gi = c.g != null && K.gr ? K.gr.get(c.g) : null;       // çok hücreli kütle: ortada belirgin zirve, kenarlar alçalır
        const tepe = !!gi && gi.px === c.x && gi.py === c.y;
        let h = 19 + kom * 6 + (c.v & 1) * 3;
        if (gi) h = tepe ? Math.min(46, 26 + 2.6 * gi.n) : Math.max(13, Math.min(34, 20 + 1.6 * gi.n) - 5 * Math.max(Math.abs(c.x - gi.px), Math.abs(c.y - gi.py)));
        const b = y0 + S - 1;
        const l = x0 + (m.w ? -2 : 0.5) - (tepe ? 3 : 0), r = x0 + S + (m.e ? 2 : -0.5) + (tepe ? 3 : 0), cx = x0 + 10 + (tepe ? 0 : ((c.v >> 1) * 2 - 1));
        golge(K, x0, y0, 9.5, 3.4, 0.38);
        sekil(K, p => { p.moveTo(l, b); p.lineTo(cx - 3, b - h * 0.7); p.lineTo(cx, b - h); p.lineTo(cx + 0.5, b); p.closePath(); }, lin(K, l, 0, cx, 0, [0, col(K, '#b8e4fb', 0.3), 1, col(K, '#6fb0d8', -0.05)]), 0.35, 'rgba(10,40,80,0.4)');
        sekil(K, p => { p.moveTo(cx + 0.5, b); p.lineTo(cx, b - h); p.lineTo(cx + 5, b - h * 0.6); p.lineTo(r, b); p.closePath(); }, lin(K, cx, 0, r, 0, [0, col(K, '#6fb0d8', -0.1), 1, col(K, '#2f6490', -0.45)]), 0.35, 'rgba(10,40,80,0.4)');
        // üstte kar
        const kh = Math.min(h * 0.45, tepe ? 15 : 9);
        g.fillStyle = K.cb ? 'rgba(255,255,255,0.8)' : '#f4fbff';
        g.beginPath(); g.moveTo(cx - 3 * (kh / 9) - 1, b - h + kh); g.lineTo(cx - 1.5, b - h + kh * 0.6); g.lineTo(cx, b - h); g.lineTo(cx + 3, b - h + kh * 0.7); g.lineTo(cx + 5 * (kh / 9), b - h + kh); g.lineTo(cx + 1.5, b - h + kh * 0.78); g.lineTo(cx - 1, b - h + kh * 0.9); g.closePath(); g.fill();
        // mavi kristal damarı
        g.strokeStyle = 'rgba(190,240,255,0.7)'; g.lineWidth = 0.9;
        g.beginPath(); g.moveTo(cx - 2, b - h * 0.55); g.lineTo(cx - 5, b - 3); g.moveTo(cx + 2, b - h * 0.45); g.lineTo(cx + 3, b - 2); g.stroke();
    }
    function cKristal(K, c, x0, y0) {
        const S = K.S, g = K.g, b = y0 + S - 2;
        golge(K, x0, y0, 7, 2.6, 0.35);
        const kr = (cx, h, w, k) => {
            sekil(K, p => { p.moveTo(cx - w, b); p.lineTo(cx - w, b - h * 0.7); p.lineTo(cx, b - h); p.lineTo(cx + w, b - h * 0.7); p.lineTo(cx + w, b); p.closePath(); },
                lin(K, cx - w, 0, cx + w, 0, [0, col(K, '#c8f1ff', 0.4 + k), 0.5, col(K, '#58b8ee', 0 + k), 1, col(K, '#2468a8', -0.4 + k)]), 0.25, 'rgba(220,250,255,0.8)');
            g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(cx - w + 1, b - h * 0.65, 1.2, h * 0.4);
        };
        kr(x0 + 10, 17 + (c.v & 1) * 3, 3.4, 0);
        kr(x0 + 5, 9, 2.6, 0.08);
        kr(x0 + 15, 11 + (c.v >> 1) * 2, 2.8, -0.04);
    }
    // ---- Lav ----
    function cNehirTaban(K, c, x0, y0, m) {
        const S = K.S, g = K.g;
        g.fillStyle = col(K, '#1a0f12', -0.55); g.fillRect(x0, y0, S, S);                       // bazalt kıyı
        const l = x0 + (m.w ? 0 : 3), r = x0 + (m.e ? S : S - 3), t = y0 + (m.n ? 0 : 3), b = y0 + (m.s ? S : S - 3);
        sekil(K, p => p.rect(l, t, r - l, b - t), lin(K, 0, t, 0, b, [0, col(K, '#ffb52e', 0.15), 0.5, col(K, '#ff6a14', 0), 1, col(K, '#d23c06', -0.25)]), 0.55);
        // soğumuş kabuk
        const h = hxy(c.x, c.y, 3);
        g.fillStyle = 'rgba(40,10,6,0.5)';
        g.beginPath(); g.ellipse(l + 4 + (h & 7), t + 4 + ((h >> 3) & 5), 2.6, 1.5, 0.4, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(r - 5 - ((h >> 6) & 3), b - 4 - ((h >> 8) & 3), 2, 1.2, -0.3, 0, TAU); g.fill();
        // parlak kıyı çizgisi
        g.strokeStyle = 'rgba(255,200,90,0.55)'; g.lineWidth = 1;
        g.beginPath();
        if (!m.n) { g.moveTo(l, t + 0.5); g.lineTo(r, t + 0.5); }
        if (!m.s) { g.moveTo(l, b - 0.5); g.lineTo(r, b - 0.5); }
        if (!m.w) { g.moveTo(l + 0.5, t); g.lineTo(l + 0.5, b); }
        if (!m.e) { g.moveTo(r - 0.5, t); g.lineTo(r - 0.5, b); }
        g.stroke();
        if (K.cb) hatch(K, x0, y0);
    }
    function hatch(K, x0, y0) {
        const g = K.g, S = K.S;
        g.save(); g.beginPath(); g.rect(x0, y0, S, S); g.clip();
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1; g.beginPath();
        for (let i = -S; i < S * 2; i += 5) { g.moveTo(x0 + i, y0 + S); g.lineTo(x0 + i + S, y0); }
        g.stroke(); g.restore();
    }
    function cBazalt(K, c, x0, y0, m) {
        const S = K.S, g = K.g, b = y0 + S - 1;
        golge(K, x0, y0, 9, 3.2, 0.42);
        const sut = (cx, h, w, k) => {
            sekil(K, p => p.rect(cx - w, b - h, w * 2, h), lin(K, cx - w, 0, cx + w, 0, [0, col(K, '#4a3b3e', 0.1 + k), 1, col(K, '#150e10', -0.5 + k)]), 0.5, 'rgba(0,0,0,0.5)');
            sekil(K, p => { p.moveTo(cx - w, b - h); p.lineTo(cx - w + 2, b - h - 3); p.lineTo(cx + w - 2, b - h - 3); p.lineTo(cx + w, b - h); p.closePath(); }, col(K, '#6a5659', 0.15 + k), 0.4, 'rgba(0,0,0,0.5)');
            g.strokeStyle = K.cb ? 'rgba(255,255,255,0.5)' : 'rgba(255,110,30,0.7)'; g.lineWidth = 0.9;           // kor çatlağı
            g.beginPath(); g.moveTo(cx - 1, b - h + 1); g.lineTo(cx + 1, b - h * 0.55); g.lineTo(cx - 1, b - 3); g.stroke();
        };
        sut(x0 + 6, 12 + (c.v & 1) * 3, 3.6, 0);
        sut(x0 + 14, 9 + (c.v >> 1) * 3, 3.6, 0.05);
        sut(x0 + 10, 15, 3.6, 0.1);
        if (m.e) sut(x0 + S, 8, 3, 0);
    }
    // ---- Bataklık ----
    function cAgac(K, c, x0, y0) {
        const S = K.S, g = K.g, b = y0 + S - 1, cx = x0 + 10, v = c.v;
        golge(K, x0, y0, 9, 3.4, 0.42);
        // gövde + kök
        sekil(K, p => { p.moveTo(cx - 5, b); p.quadraticCurveTo(cx - 3, b - 4, cx - 2.5, b - 8); p.lineTo(cx - 2.2, y0 + 3); p.lineTo(cx + 2.2, y0 + 3); p.lineTo(cx + 2.5, b - 8); p.quadraticCurveTo(cx + 3, b - 4, cx + 5, b); p.closePath(); },
            lin(K, cx - 4, 0, cx + 4, 0, [0, col(K, '#8a6540', 0.1), 0.5, col(K, '#5b4026', -0.1), 1, col(K, '#2e1f10', -0.5)]), 0.6, 'rgba(0,0,0,0.35)');
        const yaprak = (px, py, r, k) => sekil(K, p => p.ellipse(px, py, r, r * 0.88, 0, 0, TAU),
            K.g.createRadialGradient ? (() => { const gr = g.createRadialGradient(px - r * 0.35, py - r * 0.4, r * 0.1, px, py, r); gr.addColorStop(0, col(K, '#6fc15a', 0.2 + k)); gr.addColorStop(0.55, col(K, '#2f7d3a', k)); gr.addColorStop(1, col(K, '#173f1e', -0.45 + k)); return gr; })() : '#2f7d3a', 0.35, 'rgba(0,20,0,0.3)');
        if (v === 3) {                                                              // kurumuş bataklık ağacı
            g.strokeStyle = col(K, '#4b3822', -0.1); g.lineWidth = 1.5; g.lineCap = 'round'; g.beginPath();
            g.moveTo(cx, y0 + 4); g.lineTo(cx - 13, y0 - 9); g.moveTo(cx - 6, y0 - 2); g.lineTo(cx - 15, y0 - 2);
            g.moveTo(cx, y0 + 3); g.lineTo(cx + 12, y0 - 14); g.moveTo(cx + 6, y0 - 6); g.lineTo(cx + 15, y0 - 5); g.moveTo(cx, y0 + 2); g.lineTo(cx + 1, y0 - 19);
            g.stroke();
            g.strokeStyle = col(K, '#7fa86a', 0.1); g.lineWidth = 1; g.beginPath();                    // sarkan yosun
            g.moveTo(cx - 13, y0 - 9); g.lineTo(cx - 13, y0 - 2); g.moveTo(cx + 12, y0 - 14); g.lineTo(cx + 12, y0 - 5); g.stroke();
        } else if (v === 2) {                                                       // çam: üst üste üçgen katlar
            for (let i = 0; i < 3; i++) {
                const ty = y0 + 6 - i * 10, w = 16 - i * 4;
                sekil(K, p => { p.moveTo(cx - w, ty + 4); p.lineTo(cx, ty - 12); p.lineTo(cx + w, ty + 4); p.closePath(); },
                    lin(K, cx - w, 0, cx + w, 0, [0, col(K, '#4f9a4a', 0.1), 0.5, col(K, '#256a2e', -0.1), 1, col(K, '#0f3a18', -0.5)]), 0.3, 'rgba(0,20,0,0.35)');
            }
        } else {                                                                    // yuvarlak taç: gövdenin üstüne taşar
            yaprak(cx - 10, y0 + 1, 11, -0.05);                                  // taç ~1.8 hücre genişliğinde
            yaprak(cx + 10, y0, 11, -0.1);
            yaprak(cx, y0 - 10, 15, 0.05);
            yaprak(cx - 5, y0 - 5, 10, -0.02);
            yaprak(cx - 3 + v * 2, y0 - 18, 9.5, 0.12);
        }
    }
    function cSazlik(K, c, x0, y0, m) {
        const S = K.S, g = K.g, b = y0 + S - 1;
        g.fillStyle = col(K, '#2c3a1c', -0.3); g.beginPath(); g.ellipse(x0 + 10, b - 1, 9, 3.4, 0, 0, TAU); g.fill();
        g.lineCap = 'round';
        const n = 7;
        for (let i = 0; i < n; i++) {
            const h = hxy(c.x, c.y, 20 + i), px = x0 + 3 + i * 2.3 + ((h & 3) - 1), hh = 11 + (h >> 2) % 8, bend = ((h >> 5) & 7) - 3.5;
            g.strokeStyle = i & 1 ? col(K, '#7d9a3c', 0) : col(K, '#a5bd54', 0.1); g.lineWidth = 1.3;
            g.beginPath(); g.moveTo(px, b); g.quadraticCurveTo(px + bend * 0.4, b - hh * 0.6, px + bend, b - hh); g.stroke();
            if (i % 3 === 0) { g.strokeStyle = col(K, '#5b3a1c', -0.2); g.lineWidth = 2.6; g.beginPath(); g.moveTo(px + bend * 0.9, b - hh + 1); g.lineTo(px + bend, b - hh - 3.5); g.stroke(); }   // kaban başağı
        }
    }
    function cSuTaban(K, c, x0, y0, m) {
        const S = K.S, g = K.g;
        g.fillStyle = col(K, '#2f3a1e', -0.35); g.fillRect(x0, y0, S, S);                       // çamurlu kıyı
        const l = x0 + (m.w ? 0 : 2.5), r = x0 + (m.e ? S : S - 2.5), t = y0 + (m.n ? 0 : 2.5), b = y0 + (m.s ? S : S - 2.5);
        sekil(K, p => p.rect(l, t, r - l, b - t), lin(K, l, t, r, b, [0, col(K, '#3fb0a0', 0.05), 0.5, col(K, '#27867f', -0.1), 1, col(K, '#175562', -0.35)]), 0.3);
        g.strokeStyle = 'rgba(190,240,200,0.4)'; g.lineWidth = 1; g.beginPath();                 // köpüklü kıyı
        if (!m.n) { g.moveTo(l, t + 0.5); g.lineTo(r, t + 0.5); }
        if (!m.s) { g.moveTo(l, b - 0.5); g.lineTo(r, b - 0.5); }
        if (!m.w) { g.moveTo(l + 0.5, t); g.lineTo(l + 0.5, b); }
        if (!m.e) { g.moveTo(r - 0.5, t); g.lineTo(r - 0.5, b); }
        g.stroke();
        if ((hxy(c.x, c.y, 5) & 7) === 0) { g.fillStyle = col(K, '#4b9a48', 0); g.beginPath(); g.ellipse(l + 7, t + 7, 3.4, 2.4, 0.3, 0.3, TAU); g.fill(); } // nilüfer yaprağı
        if (K.cb) hatch(K, x0, y0);
    }
    // ---- Rün ----
    function cDikilitas(K, c, x0, y0) {
        const S = K.S, g = K.g, b = y0 + S - 1, cx = x0 + 10, h = 27 + (c.v & 1) * 3;
        golge(K, x0, y0, 8, 3, 0.42);
        sekil(K, p => p.rect(cx - 7, b - 4, 14, 4), col(K, '#4a3f78', -0.2), 0.5);
        sekil(K, p => { p.moveTo(cx - 5.5, b - 4); p.lineTo(cx - 4, b - h); p.lineTo(cx + 2, b - h); p.lineTo(cx + 3.5, b - 4); p.closePath(); },
            lin(K, cx - 5, 0, cx + 3, 0, [0, col(K, '#6b5aa8', 0.05), 1, col(K, '#35295c', -0.35)]), 0.6, 'rgba(0,0,20,0.4)');
        sekil(K, p => { p.moveTo(cx + 3.5, b - 4); p.lineTo(cx + 2, b - h); p.lineTo(cx + 5.5, b - h + 2); p.lineTo(cx + 6.5, b - 4); p.closePath(); }, col(K, '#241a46', -0.5), 0.5);
        sekil(K, p => { p.moveTo(cx - 4, b - h); p.lineTo(cx - 1, b - h - 5); p.lineTo(cx + 2, b - h); p.lineTo(cx + 5.5, b - h + 2); p.closePath(); }, col(K, '#9684d8', 0.3), 0.4);   // sivri uç
        // parlayan rünler
        g.strokeStyle = K.cb ? 'rgba(255,255,255,0.85)' : '#7af0e8'; g.lineWidth = 1.1; g.lineCap = 'round';
        const rn = (yy, t) => {
            g.beginPath();
            if (t === 0) { g.moveTo(cx - 2, yy - 3); g.lineTo(cx - 2, yy + 3); g.moveTo(cx - 2, yy - 3); g.lineTo(cx + 1, yy); g.lineTo(cx - 2, yy + 1); }
            else if (t === 1) { g.moveTo(cx - 3, yy - 2); g.lineTo(cx + 1, yy + 2); g.moveTo(cx + 1, yy - 2); g.lineTo(cx - 3, yy + 2); }
            else { g.moveTo(cx - 1, yy - 3); g.lineTo(cx - 1, yy + 3); g.moveTo(cx - 3, yy - 1); g.lineTo(cx - 1, yy - 3); g.lineTo(cx + 1, yy - 1); }
            g.stroke();
        };
        rn(b - h * 0.78, c.v & 1); rn(b - h * 0.5, (c.v + 1) % 3); rn(b - h * 0.25, (c.v + 2) % 3);
    }

    const CIZ = { devrik: cDevrik, sutun: cSutun, yikik: cYikik, stalagmit: cStalagmit, yigin: cYigin, dag: cDag, kristal: cKristal, nehir: cNehirTaban, bazalt: cBazalt, agac: cAgac, sazlik: cSazlik, su: cSuTaban, dikilitas: cDikilitas };
    const DOKU_ADI = { tas: 'block.tas', kaya: 'block.kaya', buz: 'block.buz', lav: 'block.ember', bat: 'block.bat', run: 'block.run' };

    // ---------- statik katmanı pişir ----------
    function pisir(list, o, dpr) {
        const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
        const W = o.W, H = o.H, S = o.S;
        if (!L.c || L.c.width !== Math.round(W * dpr) || L.c.height !== Math.round(H * dpr)) {
            L.c = document.createElement('canvas');
            L.c.width = Math.round(W * dpr); L.c.height = Math.round(H * dpr);
        }
        const g = L.c.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, L.c.width, L.c.height);
        g.scale(dpr, dpr);
        const dk = typeof Doku !== 'undefined' ? Doku : null;
        let bp = null;
        if (o.tex && dk) { try { bp = dk.pattern(g, DOKU_ADI[o.tema] || 'block.tas', dpr, 0, 0); } catch (e) { bp = null; } }
        const K = { g, S, cb: !!o.cb, color: o.color || '#CC79A7', th: o.tema, bp, W, H };
        const set = new Set();
        const items = [];
        for (let i = 0; i < list.length; i++) if (list[i].tur && CIZ[list[i].tur]) { items.push(list[i]); set.add(list[i].tur + list[i].x + ',' + list[i].y); }
        // yassı şeritler önce, sonra yüksek nesneler y artan
        items.sort((a, b) => (AKIS[b.tur] ? 1 : 0) - (AKIS[a.tur] ? 1 : 0) || a.y - b.y || a.x - b.x);
        // çok hücreli kütlelerin zirvesi: ağırlık merkezine en yakın hücre
        const gr = new Map(), gtop = {};
        for (let i = 0; i < items.length; i++) { const c = items[i]; if (c.g != null && c.tur === 'dag') (gtop[c.g] = gtop[c.g] || []).push(c); }
        Object.keys(gtop).forEach(id => {
            const a = gtop[id]; let mx = 0, my = 0;
            a.forEach(c => { mx += c.x; my += c.y; });
            mx /= a.length; my /= a.length;
            let en = a[0], ed = 1e9;
            a.forEach(c => { const d = (c.x - mx) * (c.x - mx) + (c.y - my) * (c.y - my) + 0.01 * c.y; if (d < ed) { ed = d; en = c; } });
            gr.set(+id, { px: en.x, py: en.y, n: a.length });
        });
        K.gr = gr;
        L.anim.length = 0;
        for (let i = 0; i < items.length; i++) {
            const c = items[i];
            const x0 = c.x * S, y0 = c.y * S;
            g.save();
            CIZ[c.tur](K, c, x0, y0, BAGLI[c.tur] ? maske(set, c) : null);
            g.restore();
            if (AKIS[c.tur]) L.anim.push(c);
        }
        L.bake = (L.bake | 0) + 1;
        L.bakeMs = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
    }

    // ---------- kare çizimi ----------
    // list: obstacles; o: { S, W, H, t, cb, color, reduced, tema, tex }
    function ciz(ctx, list, o) {
        let dpr = 1;
        try { dpr = ctx.getTransform().a || 1; } catch (e) { dpr = 1; }
        const sg = imza(list) + '|' + dpr + '|' + (o.cb ? 1 : 0) + '|' + o.tema + '|' + (o.tex ? 1 : 0) + '|' + o.W + 'x' + o.H;
        if (L.sig !== sg) { pisir(list, o, dpr); L.sig = sg; }
        ctx.drawImage(L.c, 0, 0, o.W, o.H);
        const S = o.S, t = o.reduced ? 0 : o.t;
        const n = L.anim.length;
        if (n) {
            ctx.save();
            for (let i = 0; i < n; i++) {
                const c = L.anim[i];
                const x0 = c.x * S, y0 = c.y * S, d = c.d == null ? 0 : c.d;
                const lav = c.tur === 'nehir';
                const yatay = (d & 1) === 0, ters = d >= 2;
                const hz = lav ? 0.55 : 0.4;
                ctx.fillStyle = o.cb ? 'rgba(255,255,255,0.7)' : (lav ? 'rgba(255,238,150,0.85)' : 'rgba(225,255,245,0.6)');
                for (let k = 0; k < 2; k++) {
                    let p = (t * hz + hxy(c.x, c.y, 2) / 4294967296 + k * 0.5) % 1;
                    if (ters) p = 1 - p;
                    const q = 5 + k * 8 + ((hxy(c.x, c.y, 9 + k) & 3));
                    if (yatay) ctx.fillRect(x0 + 2 + p * (S - 8), y0 + q, 5, lav ? 1.6 : 1.1);
                    else ctx.fillRect(x0 + q, y0 + 2 + p * (S - 8), lav ? 1.6 : 1.1, 5);
                }
                if (lav && !o.cb) {                                                              // kabarcık / parlama titremesi
                    ctx.fillStyle = 'rgba(255,200,80,' + (0.07 + 0.06 * Math.sin(t * 3 + c.x * 1.7 + c.y)) + ')';
                    ctx.fillRect(x0 + 3, y0 + 3, S - 6, S - 6);
                }
            }
            ctx.restore();
        }
    }

    function sifirla() { L.sig = ''; isikOnb.sig = ''; }

    return {
        TURLER, AD, AKIS, BAGLI, uret, etiketle, ciz, isiklar, sifirla,
        _durum: () => ({ bake: L.bake | 0, bakeMs: L.bakeMs, anim: L.anim.length, sig: L.sig }),
        _plan: plan, _ulasilamaz: ulasilamaz, _hash: hash32
    };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Engel;
