// ========================================================================
// IŞIK - dinamik aydınlatma + atmosfer + efekt katmanı (Twilight of the Serpents)
// Yalnız çizim; oyun mantığına dokunmaz. game.js / tapinak.js iki kancayla çağırır:
//   Isik.zemin(ctx, o) : zemin dokusunun hemen üstü, tüm oyun nesnelerinin ALTI
//                        (ortam karanlığı + tema tonu, baş ışığı ve ışığa göre uzayan yumuşak
//                         engel gölgeleri, meşale/kor/yem/kristal/portal ışıkları, sis şeritleri,
//                         lav ışıması, hız izi, portal girdabı)
//   Isik.ust(ctx, o)   : parçacıkların üstü (tema parçacıkları, halka/şok dalgası/kıvılcım,
//                        hasar kenar flaşı). İnce; nesneleri örtmez.
// Olaylar: Isik.patla(x,y,renk,n) (burst ile), Isik.olay(tur,x,y,renk). Koordinatlar hücre birimi.
// Başarım: yazılım raster'ında ölçeklenmiş tam ekran çizim pahalıdır; bu yüzden durağan ışık
// haritası dpr çözünürlüğünde önbelleğe pişirilir ve 1:1 basılır, dinamik ışıklar önceden
// boyutlandırılmış (ölçeksiz) lekelerdir. Kayıtlar önceden ayrılmış havuzlarda; karede dizi yok.
// ========================================================================
const Isik = (() => {
    'use strict';
    const TAU = Math.PI * 2;
    const LM_OLCEK = 0.25;      // durağan ışık haritasının ara çözünürlüğü (pişirme sırasında)
    const ATM_MAX = 60;         // tema başına en fazla atmosfer parçacığı
    const EF_MAX = 28;          // eşzamanlı efekt sınırı
    const IZ_N = 18;            // hız izi uzunluğu (nokta)
    const BAS_R = 170;          // baş ışığı yarıçapı (mantıksal px)

    // Tema: gölge tonu (LUT benzeri karanlık tint), ortam karanlığı, baş ışığı, sis ve derecelendirme renkleri
    const TEMA = {
        tas: { koyu: 'rgb(7,9,22)', A: 0.36, bas: 'rgb(255,214,160)', sis: 'rgb(150,165,205)', sisA: 0.06, grade: [36, 54, 120], gradeA: 0.16, sicak: 'rgb(255,178,96)', atm: 'toz' },
        kaya: { koyu: 'rgb(5,11,9)', A: 0.35, bas: 'rgb(255,204,140)', sis: 'rgb(120,150,128)', sisA: 0.055, grade: [24, 64, 46], gradeA: 0.16, sicak: 'rgb(255,150,70)', atm: 'kul' },
        buz: { koyu: 'rgb(5,14,34)', A: 0.30, bas: 'rgb(200,232,255)', sis: 'rgb(200,228,255)', sisA: 0.075, grade: [50, 100, 170], gradeA: 0.15, sicak: 'rgb(170,215,255)', atm: 'kar' },
        bat: { koyu: 'rgb(4,13,6)', A: 0.38, bas: 'rgb(222,255,170)', sis: 'rgb(110,175,90)', sisA: 0.12, grade: [28, 84, 30], gradeA: 0.18, sicak: 'rgb(170,235,110)', atm: 'spor' },
        run: { koyu: 'rgb(13,6,28)', A: 0.36, bas: 'rgb(205,185,255)', sis: 'rgb(150,110,225)', sisA: 0.065, grade: [84, 38, 150], gradeA: 0.17, sicak: 'rgb(110,235,235)', atm: 'run' },
        lav: { koyu: 'rgb(26,6,3)', A: 0.36, bas: 'rgb(255,190,120)', sis: 'rgb(255,120,60)', sisA: 0.05, grade: [130, 34, 8], gradeA: 0.17, sicak: 'rgb(255,120,40)', atm: 'koz' }
    };
    const ODA_TEMA = { baslangic: 'tas', savas: 'tas', boss: 'lav', gizli: 'kaya', hazine: 'buz' };

    let dpr = 1;
    let sonT = -1, dt = 0.016;

    function tuval(w, h) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
        return c;
    }
    function rgbAyir(renk) {
        const m = /^#([0-9a-f]{6})$/i.exec(renk);
        if (m) { const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
        const q = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(renk);
        return q ? [+q[1], +q[2], +q[3]] : [255, 255, 255];
    }
    function lekeBoya(g, renk, cx, cy, r) {
        const c = rgbAyir(renk), f = a => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        gr.addColorStop(0, f(1)); gr.addColorStop(0.18, f(0.72)); gr.addColorStop(0.42, f(0.32));
        gr.addColorStop(0.7, f(0.09)); gr.addColorStop(1, f(0));
        g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    // ---------- ölçekli leke (yalnız düşük çözünürlüklü tamponlara; büyütme ucuz olduğu yerde) ----------
    const sprCache = new Map();
    function leke(renk) {
        let s = sprCache.get(renk);
        if (s) return s;
        if (sprCache.size > 40) sprCache.clear();
        s = tuval(64, 64);
        lekeBoya(s.getContext('2d'), renk, 32, 32, 32);
        sprCache.set(renk, s);
        return s;
    }
    function lekeCiz(g, renk, x, y, r, a) {
        if (a <= 0.003 || r <= 0) return;
        g.globalAlpha = a > 1 ? 1 : a;
        g.drawImage(leke(renk), x - r, y - r, r * 2, r * 2);
    }
    // ---------- önceden boyutlandırılmış leke (ana tuvale 1:1 basılır: ölçekleme maliyeti yok) ----------
    const nCache = new Map();
    function lekeN(renk, r) {
        const rq = Math.max(8, Math.round(r / 8) * 8);
        const key = renk + '|' + rq + '|' + dpr;
        let s = nCache.get(key);
        if (s) return s;
        if (nCache.size > 72) nCache.clear();   // sınırsız büyümesin
        const px = Math.ceil(rq * 2 * dpr);
        s = tuval(px, px);
        s._r = rq;
        lekeBoya(s.getContext('2d'), renk, px / 2, px / 2, px / 2);
        nCache.set(key, s);
        return s;
    }
    function isikN(ctx, renk, x, y, r, a) {
        if (a <= 0.004 || r <= 0) return;
        const s = lekeN(renk, r), rq = s._r;
        ctx.globalAlpha = a > 1 ? 1 : a;
        // aygıt pikseline hizalı: ölçeksiz hızlı kopya yolu
        ctx.drawImage(s, Math.round((x - rq) * dpr) / dpr, Math.round((y - rq) * dpr) / dpr, rq * 2, rq * 2);
    }

    // ---------- durağan ışık katmanı: zemin önbelleğine bir kez pişirilir (karede ek çizim yok) ----------
    // ortam karanlığı (tema tonlu) + meşale delikleri/sıcak havuzları + lav ışıması + köşe derecelendirmesi
    const EMS = { c: null, glow: null };
    function emisyonOrnekle(ctx, W, H) {
        // zemin şu an tuvalde (nesnelerden önce): küçült, akkor (turuncu-kızıl) pikselleri maskeye çevir
        try {
            const k = LM_OLCEK, w = Math.round(W * k * dpr), h = Math.round(H * k * dpr);
            if (!EMS.c || EMS.c.width !== w || EMS.c.height !== h) { EMS.c = tuval(w, h); EMS.glow = tuval(w / 4, h / 4); }
            const g = EMS.c.getContext('2d');
            g.globalCompositeOperation = 'copy';
            g.drawImage(ctx.canvas, 0, 0, w, h);
            g.globalCompositeOperation = 'source-over';
            const im = g.getImageData(0, 0, w, h), d = im.data;
            let say = 0;
            for (let i = 0; i < d.length; i += 4) {
                const r = d[i], gg = d[i + 1], b = d[i + 2];
                const a = (r > 120 && r - b > 70 && gg < r * 0.8) ? Math.min(1, (r - 110) / 90) : 0;
                if (a > 0) say++;
                d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = Math.round(a * 255);
            }
            g.putImageData(im, 0, 0);
            const gl = EMS.glow.getContext('2d');
            gl.globalCompositeOperation = 'copy';
            gl.drawImage(EMS.c, 0, 0, EMS.glow.width, EMS.glow.height);
            gl.globalCompositeOperation = 'source-in';
            gl.fillStyle = '#ff6a1c'; gl.fillRect(0, 0, EMS.glow.width, EMS.glow.height);
            gl.globalCompositeOperation = 'source-over';
            return say >= 8;
        } catch (e) { return false; }
    }
    function durganPisir(ctx, o, tema, oda) {
        const W = o.W, H = o.H, T = TEMA[tema];
        // ara harita (düşük çözünürlük), sonra bir kez yumuşak büyütmeyle tam çözünürlüğe
        const k = dpr * LM_OLCEK;
        const lm = tuval(W * k, H * k), g = lm.getContext('2d');
        g.setTransform(k, 0, 0, k, 0, 0);
        g.fillStyle = T.koyu;
        g.globalAlpha = oda ? T.A * 0.55 : T.A;   // Tapınak kendi karanlığını zaten ekliyor
        g.fillRect(0, 0, W, H);
        const em = tema === 'lav' && emisyonOrnekle(ctx, W, H);
        g.globalCompositeOperation = 'destination-out';
        const tor = o.torches;
        if (tor) for (let i = 0; i < tor.length; i += 2) lekeCiz(g, '#ffffff', tor[i], tor[i + 1], oda ? 190 : 150, 0.85);
        if (oda && oda.sunak) lekeCiz(g, '#ffffff', (oda.sunak.x + 1) * o.S, (oda.sunak.y + 1) * o.S, 90, 0.6);
        if (em) { g.globalAlpha = 0.9; g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(EMS.c, 0, 0, lm.width, lm.height); g.setTransform(k, 0, 0, k, 0, 0); }
        g.globalCompositeOperation = 'lighter';
        if (tor) for (let i = 0; i < tor.length; i += 2) lekeCiz(g, T.sicak, tor[i], tor[i + 1], oda ? 150 : 130, 0.15);
        if (em) { g.globalAlpha = 0.5; g.drawImage(EMS.glow, 0, 0, W, H); }
        // köşe derecelendirmesi: tema tonuna kayan koyu köşeler + üstten ince renk perdesi (yalnız zemin)
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        const q = T.grade;
        const gr = g.createRadialGradient(W / 2, H * 0.48, H * 0.4, W / 2, H * 0.48, W * 0.66);
        gr.addColorStop(0, 'rgba(' + q[0] + ',' + q[1] + ',' + q[2] + ',0)');
        gr.addColorStop(0.6, 'rgba(' + (q[0] >> 2) + ',' + (q[1] >> 2) + ',' + (q[2] >> 2) + ',' + (T.gradeA * 0.6) + ')');
        gr.addColorStop(1, 'rgba(0,0,0,' + (T.gradeA + 0.12) + ')');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        const lg = g.createLinearGradient(0, 0, 0, H * 0.22);
        lg.addColorStop(0, 'rgba(' + q[0] + ',' + q[1] + ',' + q[2] + ',' + (T.gradeA * 0.5) + ')');
        lg.addColorStop(1, 'rgba(' + q[0] + ',' + q[1] + ',' + q[2] + ',0)');
        g.fillStyle = lg; g.fillRect(0, 0, W, H * 0.22);
        return lm;
    }
    // Zemin önbelleği kurulurken çağrılır (gfx25 buildFloor / tapinak statik): g = zemin tuvali (dpr ölçekli),
    // zemin o an çizilmiş durumda (lav ışıması buradan örneklenir). Işık haritası bir kez, yumuşak büyütmeyle basılır.
    function zeminPisir(g, W, H, tema, torches, oda, S) {
        if (!aktif || !g || !g.canvas) return;
        try {
            dpr = g.canvas.width / W || 1;
            const lm = durganPisir(g, { W, H, S: S || 20, torches }, TEMA[tema] ? tema : 'tas', oda || null);
            g.save();
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.globalCompositeOperation = 'source-over';
            g.globalAlpha = 1;
            g.imageSmoothingEnabled = true;
            g.drawImage(lm, 0, 0, W, H);
            g.restore();
        } catch (e) { /* ışık isteğe bağlı: zemin yine çizilir */ }
    }

    // ---------- sis şeritleri (dpr çözünürlüğünde, yatayda sarmalı; 1:1 basılır) ----------
    const SIS = { c: [null, null], key: '' };
    const SIS_H = [58, 78];
    // alfa şeride pişirilir (basımda globalAlpha = 1: yazılım raster'ında en ucuz karışım yolu)
    function sisHazirla(W, tema, sa) {
        const key = dpr + '|' + W + '|' + tema + '|' + sa.toFixed(3);
        if (SIS.key === key) return;
        const T = TEMA[tema];
        for (let L = 0; L < 2; L++) {
            const h = SIS_H[L];
            const c = tuval(W * dpr, h * dpr), g = c.getContext('2d');
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            let s = (L ? 9187 : 3301) >>> 0;
            const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
            const spr = leke(T.sis);
            for (let i = 0; i < 30; i++) {
                const x = R() * W, y = h * (0.35 + R() * 0.3), rx = 50 + R() * 90, ry = h * (0.2 + R() * 0.2);
                g.globalAlpha = (0.25 + R() * 0.45) * sa * (L ? 1 : 0.8);
                for (let w = -1; w <= 1; w++) g.drawImage(spr, x + w * W - rx, y - ry, rx * 2, ry * 2);
            }
            SIS.c[L] = c;
        }
        SIS.key = key;
    }
    // lav ısı dalgası bandı (1:1)
    const DALGA = { c: null, key: '' };
    function dalgaHazirla(W, a) {
        const key = dpr + '|' + W + '|' + a.toFixed(3);
        if (DALGA.key === key) return DALGA.c;
        const h = 96, c = tuval(W * dpr, h * dpr), g = c.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.globalAlpha = a;
        g.drawImage(leke('#ff5a1a'), -W * 0.1, 0, W * 1.2, h);
        DALGA.c = c; DALGA.key = key;
        return c;
    }

    // ---------- kenar flaşı (dpr çözünürlüğünde; yalnız hasar anında basılır) ----------
    const KENAR = { c: null, key: '' };
    function kenarHazirla(W, H, renk) {
        const key = dpr + '|' + W + 'x' + H + '|' + renk;
        if (KENAR.key === key) return KENAR.c;
        const c = tuval(W * dpr, H * dpr), g = c.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        const q = rgbAyir(renk), f = a => 'rgba(' + q[0] + ',' + q[1] + ',' + q[2] + ',' + a + ')';
        const gr = g.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, W * 0.62);
        gr.addColorStop(0, f(0)); gr.addColorStop(0.55, f(0.25)); gr.addColorStop(1, f(1));
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        KENAR.c = c; KENAR.key = key;
        return c;
    }

    // ---------- portal girdabı sprite'ı (renk başına) ----------
    function girdap(renk) {
        const key = 'gd|' + renk + '|' + dpr;
        let s = sprCache.get(key);
        if (s) return s;
        const R = 22, k = dpr;
        s = tuval(R * 2 * k, R * 2 * k);
        const g = s.getContext('2d');
        g.setTransform(k, 0, 0, k, R * k, R * k);
        g.strokeStyle = renk; g.lineCap = 'round';
        for (let arm = 0; arm < 3; arm++) {
            for (let i = 0; i < 26; i++) {
                const u0 = i / 26, u1 = (i + 1) / 26;
                const a0 = arm * TAU / 3 + u0 * 4.2, a1 = arm * TAU / 3 + u1 * 4.2;
                const r0 = 3 + u0 * (R - 4), r1 = 3 + u1 * (R - 4);
                g.globalAlpha = 0.9 * (1 - u0) * Math.min(1, 0.3 + 2 * u0);
                g.lineWidth = 2.2 * (1 - u0) + 0.5;
                g.beginPath();
                g.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
                g.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
                g.stroke();
            }
        }
        sprCache.set(key, s);
        return s;
    }

    // ---------- atmosfer parçacıkları (SoA havuz) ----------
    const P = {
        x: new Float32Array(ATM_MAX), y: new Float32Array(ATM_MAX), vx: new Float32Array(ATM_MAX), vy: new Float32Array(ATM_MAX),
        life: new Float32Array(ATM_MAX), max: new Float32Array(ATM_MAX), s: new Float32Array(ATM_MAX), tip: new Uint8Array(ATM_MAX),
        faz: new Float32Array(ATM_MAX), n: 0, tema: '', W: 0, H: 0
    };
    let tohum = 1234567;
    function rnd() { tohum = (tohum * 1664525 + 1013904223) >>> 0; return tohum / 4294967296; }
    const ATM_SAYI = { toz: 38, kul: 44, kar: 60, koz: 48, spor: 46, run: 40 };
    function parcacikDogur(i, W, H, ilk) {
        const atm = TEMA[P.tema].atm;
        P.faz[i] = rnd() * TAU;
        P.x[i] = rnd() * W;
        P.tip[i] = 0;
        if (atm === 'toz') {
            P.y[i] = rnd() * H; P.vx[i] = (rnd() - 0.5) * 6; P.vy[i] = (rnd() - 0.6) * 4;
            P.max[i] = 5 + rnd() * 6; P.s[i] = 0.8 + rnd() * 1.1;
        } else if (atm === 'kul') {
            if (rnd() < 0.3) { // kıvılcım: aşağıdan yükselir
                P.tip[i] = 1; P.y[i] = ilk ? rnd() * H : H * (0.6 + rnd() * 0.45);
                P.vx[i] = (rnd() - 0.5) * 10; P.vy[i] = -(14 + rnd() * 22); P.max[i] = 1.8 + rnd() * 2.2; P.s[i] = 0.9 + rnd() * 0.8;
            } else {           // kül: süzülerek düşer
                P.y[i] = ilk ? rnd() * H : -6; P.vx[i] = 3 + rnd() * 6; P.vy[i] = 6 + rnd() * 8;
                P.max[i] = 7 + rnd() * 7; P.s[i] = 1 + rnd() * 1.3;
            }
        } else if (atm === 'kar') {
            if (rnd() < 0.14) { // parıltı: yerinde yanıp söner
                P.tip[i] = 1; P.y[i] = rnd() * H; P.vx[i] = 0; P.vy[i] = 0; P.max[i] = 0.8 + rnd() * 1.2; P.s[i] = 1.6 + rnd() * 1.2;
            } else {
                P.y[i] = ilk ? rnd() * H : -6; P.vx[i] = 7 + rnd() * 8; P.vy[i] = 16 + rnd() * 20;
                P.max[i] = 18 + rnd() * 10; P.s[i] = 0.9 + rnd() * 1.4;
            }
        } else if (atm === 'spor') { // bataklık sporu: yavaş yükselip dalgalanan yeşil tozcuk
            P.y[i] = ilk ? rnd() * H : H * (0.5 + rnd() * 0.55); P.vx[i] = (rnd() - 0.5) * 5; P.vy[i] = -(3 + rnd() * 7);
            P.max[i] = 6 + rnd() * 6; P.s[i] = 1.2 + rnd() * 1.8;
            if (rnd() < 0.15) P.tip[i] = 1; // iri parlak spor
        } else if (atm === 'run') { // rün külleri: mor tozcuk + turkuaz parıltı
            P.y[i] = ilk ? rnd() * H : H + 4; P.vx[i] = (rnd() - 0.5) * 6; P.vy[i] = -(5 + rnd() * 12);
            P.max[i] = 5 + rnd() * 5; P.s[i] = 1 + rnd() * 1.2;
            if (rnd() < 0.2) { P.tip[i] = 1; P.vx[i] = 0; P.vy[i] = -2; P.s[i] = 1.8 + rnd(); }
        } else { // koz: yükselen kor
            P.y[i] = ilk ? rnd() * H : H + 4 - rnd() * H * 0.3; P.vx[i] = (rnd() - 0.5) * 8; P.vy[i] = -(18 + rnd() * 30);
            P.max[i] = 2.5 + rnd() * 3.5; P.s[i] = 0.9 + rnd() * 1.2;
        }
        P.life[i] = ilk ? P.max[i] * rnd() : P.max[i];
    }
    function atmGuncelle(o, W, H, n) {
        if (P.tema !== o.tema || P.W !== W || P.H !== H) {
            P.tema = o.tema; P.W = W; P.H = H; P.n = 0;
        }
        while (P.n < n) parcacikDogur(P.n++, W, H, true);
        if (P.n > n) P.n = n;
        const hz = o.reduced ? 0.4 : 1, t = o.t;
        for (let i = 0; i < P.n; i++) {
            P.life[i] -= dt;
            const sal = P.tip[i] === 0 && P.tema === 'koz' ? Math.sin(t * 2 + P.faz[i]) * 6 : (P.tema === 'bat' || P.tema === 'run') ? Math.sin(t * 0.8 + P.faz[i]) * 4 : P.tema === 'kar' && !P.tip[i] ? Math.sin(t * 0.9 + P.faz[i]) * 5 : 0;
            P.x[i] += (P.vx[i] + sal) * dt * hz; P.y[i] += P.vy[i] * dt * hz;
            if (P.life[i] <= 0 || P.y[i] < -10 || P.y[i] > H + 10 || P.x[i] < -10 || P.x[i] > W + 10) parcacikDogur(i, W, H, false);
        }
    }
    function atmCiz(ctx, o) {
        const atm = TEMA[P.tema].atm;
        ctx.save();
        // 1) ışıklı tür (toz zerresi, kıvılcım, kar, parıltı, kor): additive
        ctx.globalCompositeOperation = 'lighter';
        const renk0 = atm === 'toz' ? '#ffe2b8' : atm === 'kul' ? '#ffb070' : atm === 'kar' ? '#e8f4ff' : atm === 'spor' ? '#a6f06a' : atm === 'run' ? '#b48cff' : '#ff9a3c';
        for (let pass = 0; pass < 2; pass++) {
            ctx.fillStyle = pass === 0 ? renk0 : (atm === 'kar' ? '#ffffff' : atm === 'koz' ? '#ffd27a' : atm === 'spor' ? '#e4ffb0' : atm === 'run' ? '#5ff0e8' : '#ffd8a0');
            for (let i = 0; i < P.n; i++) {
                const tip = P.tip[i];
                if (atm === 'kul' && tip === 0) continue;          // kül ayrı (koyu)
                if ((pass === 1) !== (tip === 1 || (atm === 'koz' && P.s[i] > 1.8))) continue;
                const k = P.life[i] / P.max[i];                    // 1 -> 0
                let a = Math.sin(k * Math.PI);                     // yumuşak doğ/söyle
                if (atm === 'toz') a *= 0.32 * (0.6 + 0.4 * Math.sin(o.t * 1.3 + P.faz[i]));
                else if (atm === 'kar') a *= tip ? 0.85 * Math.abs(Math.sin(o.t * 7 + P.faz[i])) : 0.42;
                else if (atm === 'koz') a *= 0.75 * (0.7 + 0.3 * Math.sin(o.t * 11 + P.faz[i]));
                else if (atm === 'spor') a *= (tip ? 0.55 : 0.4) * (0.6 + 0.4 * Math.sin(o.t * 2.2 + P.faz[i]));
                else if (atm === 'run') a *= tip ? 0.8 * Math.abs(Math.sin(o.t * 3 + P.faz[i])) : 0.38;
                else a *= 0.8;
                if (a < 0.01) continue;
                ctx.globalAlpha = a;
                const s = P.s[i];
                if ((atm === 'kar' || atm === 'run') && tip) { // dört köşeli parıltı
                    ctx.fillRect(P.x[i] - s, P.y[i] - 0.35, s * 2, 0.7);
                    ctx.fillRect(P.x[i] - 0.35, P.y[i] - s, 0.7, s * 2);
                } else ctx.fillRect(P.x[i] - s / 2, P.y[i] - s / 2, s, s);
            }
        }
        // 2) kül: koyu, normal karışım
        if (atm === 'kul') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#9a9a92';
            for (let i = 0; i < P.n; i++) {
                if (P.tip[i] !== 0) continue;
                const k = P.life[i] / P.max[i];
                ctx.globalAlpha = 0.22 * Math.sin(k * Math.PI);
                const s = P.s[i];
                ctx.fillRect(P.x[i] - s / 2, P.y[i] - s / 2, s, s * 0.7);
            }
        }
        ctx.restore();
    }

    // ---------- efekt havuzu ----------
    // tur: 1 halka, 2 ışık patlaması (zemin), 3 şok dalgası, 4 kıvılcım, 5 kapı ışığı, 6 hasar kenarı, 7 güç halkası
    const EF = [];
    for (let i = 0; i < EF_MAX; i++) EF.push({ tur: 0, x: 0, y: 0, t: 0, dur: 1, r: 0, renk: '#ffffff', a: 1 });
    function efEkle(tur, x, y, dur, r, renk, a) {
        let e = null, eski = null;
        for (let i = 0; i < EF_MAX; i++) {
            const q = EF[i];
            if (!q.tur) { e = q; break; }
            if (!eski || q.t / q.dur > eski.t / eski.dur) eski = q;
        }
        e = e || eski;
        e.tur = tur; e.x = x; e.y = y; e.t = 0; e.dur = dur; e.r = r; e.renk = renk; e.a = a;
        return e;
    }

    // ---------- hız izi (halka tampon) ----------
    const IZ = { x: new Float32Array(IZ_N), y: new Float32Array(IZ_N), n: 0, bas: 0, sonuk: 0 };

    // ---------- durum ----------
    let fx = 1, reduced = false, cb = false, aktif = true;
    const vurusHafiza = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
    const B = { durgan: true, bas: true, isik: true, sis: true, atm: true, girdap: true };
    const SG = { g: null };

    let curT = 0;
    // meşale/kor titremesi (REDUCED: sabit)
    function titre(f, i) { return reduced ? 1 : 0.86 + 0.08 * Math.sin(curT * f + i * 1.7) + 0.06 * Math.sin(curT * f * 2.3 + i); }
    function zamanGuncelle(t) {
        dt = sonT < 0 ? 0.016 : Math.min(0.05, Math.max(0, t - sonT));
        sonT = t;
        for (let i = 0; i < EF_MAX; i++) {
            const e = EF[i];
            if (!e.tur) continue;
            e.t += dt;
            if (e.t >= e.dur) e.tur = 0;
        }
    }

    // ====================================================================
    // ZEMİN KATMANI (nesnelerin altı)
    // o: { W,H,S,t,dpr,tema,reduced,fx,cb, bas:{x,y}, yem, yemRenk, guclar, gucRenk, engeller, korlar,
    //      portallar, mermiler, mermiMerkez, hiz, tapinak, torches:[x,y,...] }
    // ====================================================================
    function zemin(ctx, o) {
        if (!aktif || !ctx) return;
        dpr = o.dpr || 1;
        fx = o.fx == null ? 1 : Math.max(0, Math.min(1.5, o.fx));
        reduced = !!o.reduced; cb = !!o.cb;
        const W = o.W, H = o.H, S = o.S || 20, t = o.t;
        zamanGuncelle(t);
        curT = t;
        const tp = o.tapinak, oda = tp ? tp.odalar[tp.oda] : null;
        const tema = oda ? (ODA_TEMA[oda.tur] || 'tas') : (TEMA[o.tema] ? o.tema : 'tas');
        o.tema = tema;
        const T = TEMA[tema];
        const bas = o.bas;
        const hx = bas ? (bas.x + 0.5) * S : -999, hy = bas ? (bas.y + 0.5) * S : -999;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        // 1) durağan ışık haritası zemin önbelleğinde (zeminPisir); burada kare başına çizim yok

        // 2) baş ışığı: önceden boyutlu yumuşak ışık havuzu (additive, alfa ile sınırlı) + engel gölgeleri.
        //    Her karede değişen ara tuval ya da ölçekli tam ekran çizim yok (yazılım raster'ında ucuz).
        if (bas && B.bas) {
            {
                const fl = reduced ? 1 : 0.95 + 0.05 * Math.sin(t * 9) * Math.sin(t * 3.7);
                ctx.globalCompositeOperation = 'lighter';
                isikN(ctx, T.bas, hx, hy + 3, BAS_R * 0.8, 0.16 * fl);
                ctx.globalCompositeOperation = 'source-over';
                // gölgeler: ışıktan uzaklaştıkça uzayan, ışık yarıçapında sönen; üç yarı saydam geçiş (yarı gölge)
                if (!SG.g) {
                    SG.g = ctx.createRadialGradient(0, 0, 0, 0, 0, BAS_R);
                    SG.g.addColorStop(0, 'rgba(0,0,0,0.42)'); SG.g.addColorStop(0.5, 'rgba(0,0,0,0.3)'); SG.g.addColorStop(1, 'rgba(0,0,0,0)');
                }
                ctx.translate(hx, hy);
                ctx.fillStyle = SG.g;
                // iki kaydırılmış geçiş = yumuşak yarı gölge; çok gölge vericide tek geçiş (maliyet sınırı)
                ctx.globalAlpha = 0.5;
                const n = golgeler(ctx, o, oda, S, hx - 4, hy - 3, BAS_R, hx, hy);
                if (n && n < 6) golgeler(ctx, o, oda, S, hx + 4, hy + 3, BAS_R, hx, hy);
                ctx.restore(); ctx.save();
            }
        }

        // 4) dinamik renkli ışıklar (önceden boyutlu, additive; alfa ile sınırlı parlaklık)
        if (B.isik) {
            ctx.globalCompositeOperation = 'lighter';
            const tor = o.torches;
            if (tor && !reduced) for (let i = 0; i < tor.length; i += 2) isikN(ctx, T.sicak, tor[i], tor[i + 1] + 6, 56, 0.1 * (titre(7, i) - 0.8) * 5);
            const yem = o.yem;
            if (yem && yem.x >= 0 && yem.y >= 0) isikN(ctx, o.yemRenk || '#ffbf2e', (yem.x + 0.5) * S, (yem.y + 0.5) * S + 3, 48, 0.24 * (reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 4)));
            const gl = o.guclar;
            if (gl) for (let i = 0; i < gl.length; i++) isikN(ctx, (o.gucRenk && o.gucRenk[gl[i].type]) || '#ffffff', (gl[i].x + 0.5) * S, (gl[i].y + 0.5) * S + 3, 48, 0.24 * (reduced ? 1 : 0.8 + 0.2 * Math.sin(t * 6 + i)));
            const kl = o.korlar;
            if (kl) for (let i = 0; i < kl.length && i < 40; i++) isikN(ctx, '#ff6a14', (Math.floor(kl[i].x) + 0.5) * S, (Math.floor(kl[i].y) + 0.5) * S + 4, 48, 0.26 * titre(5, i));
            const pr = o.portallar;
            if (pr) for (let i = 0; i < pr.length; i++) { isikN(ctx, pr[i].color, (pr[i].a.x + 0.5) * S, (pr[i].a.y + 0.5) * S, 48, 0.28); isikN(ctx, pr[i].color, (pr[i].b.x + 0.5) * S, (pr[i].b.y + 0.5) * S, 48, 0.28); }
            const ml = o.mermiler, mo = o.mermiMerkez ? S / 2 : 0;
            if (ml) for (let i = 0; i < ml.length && i < 24; i++) isikN(ctx, ml[i].color || '#ff4a7a', ml[i].x * S + mo, ml[i].y * S + mo, 24, 0.22);
            if (oda) {
                if (oda.boss) isikN(ctx, oda.boss.faz >= 3 ? '#ff2a5a' : '#ff7a2a', oda.boss.x * S, oda.boss.y * S + 10, 96, 0.2 * titre(4, 9));
                for (let i = 0; i < tp.mermiler.length && i < 16; i++) isikN(ctx, '#3fe6ff', tp.mermiler[i].x * S, tp.mermiler[i].y * S, 24, 0.25);
                let kapiK = 0;
                for (let i = 0; i < EF_MAX; i++) if (EF[i].tur === 5) kapiK = Math.max(kapiK, 1 - EF[i].t / EF[i].dur);
                if (oda.temiz) kapilarIsikN(ctx, oda, S, '#ffc878', 0.1 + 0.42 * kapiK);   // açık kapılardan sızan ışık
            }
            // efekt ışıkları (patlama, şok, güç): sabit yarıçap, sönen alfa
            for (let i = 0; i < EF_MAX; i++) {
                const e = EF[i];
                if (e.tur !== 2) continue;
                const k = e.t / e.dur;
                isikN(ctx, e.renk, e.x * S, e.y * S, e.r, 0.42 * (1 - k) * (1 - k) * e.a);
            }
        }
        ctx.globalCompositeOperation = 'source-over';

        // 5) lav: yavaş yükselen ısı ışığı dalgası (1:1 bant)
        if (tema === 'lav' && !reduced && fx > 0 && B.isik) {
            const c = dalgaHazirla(W, 0.06 * Math.min(1, fx));
            const yy = H - ((t * 26) % (H + 240)) + 60;
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 1;
            ctx.drawImage(c, 0, Math.round(yy * dpr) / dpr, W, 96);
            ctx.globalCompositeOperation = 'source-over';
        }

        // 6) parallax sis şeritleri (zeminde, çok düşük alfa, 1:1)
        if (fx > 0 && B.sis) {
            const sa = T.sisA * Math.min(1, fx) * (reduced ? 0.6 : 1);
            sisHazirla(W, tema, sa);
            ctx.globalAlpha = 1;
            for (let L = 0; L < 2; L++) {
                const c = SIS.c[L], h = SIS_H[L];
                const hiz = L ? 11 : 6;
                const ox = reduced ? 0 : -((t * hiz) % W);
                const y = (L ? H * 0.62 : H * 0.2) + (reduced ? 0 : Math.sin(t * 0.13 + L * 2) * 18);
                const xd = Math.round(ox * dpr) / dpr, yd = Math.round(y * dpr) / dpr;
                ctx.drawImage(c, xd, yd, W, h);
                ctx.drawImage(c, xd + W, yd, W, h);
            }
        }

        // 7) portal girdabı (zeminde, döner; eğik bakış için basık)
        const pr = o.portallar;
        if (pr && pr.length && B.girdap) {
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < pr.length; i++) {
                const sp = girdap(pr[i].color);
                for (let j = 0; j < 2; j++) {
                    const c = j ? pr[i].b : pr[i].a;
                    ctx.save();
                    ctx.translate((c.x + 0.5) * S, (c.y + 0.5) * S + 2);
                    ctx.scale(1, 0.62);
                    ctx.rotate(reduced ? j : -t * 2.4 + j);
                    ctx.globalAlpha = 0.5;
                    ctx.drawImage(sp, -22, -22, 44, 44);
                    ctx.restore();
                }
            }
            ctx.globalCompositeOperation = 'source-over';
        }

        // 8) hız izi (yılanın altında, zeminde)
        izCiz(ctx, o, hx, hy);
        ctx.restore();
    }

    function kapiMerkezleri(oda, S, f) {
        if (typeof Tapinak === 'undefined' || !Tapinak.kapiHucreleri) return;
        const KAPI = Tapinak.HUCRE ? Tapinak.HUCRE.KAPI : 6;
        for (const yon in oda.kapilar) {
            const hs = Tapinak.kapiHucreleri(yon);
            if (Tapinak.hucre(oda, hs[0].x, hs[0].y) !== KAPI) continue;
            const mx = (hs[0].x + hs[3].x + 1) / 2 * S, my = (hs[0].y + hs[3].y + 1) / 2 * S;
            f(mx, my, yon === 'w' ? 1 : yon === 'e' ? -1 : 0, yon === 'n' ? 1 : yon === 's' ? -1 : 0);
        }
    }
    // kapı ışığı: içeri doğru uzayan ve genişleyen üç leke (durağan haritada delik)
    function kapilarIsik(g, oda, S, renk, a) {
        kapiMerkezleri(oda, S, (mx, my, ix, iy) => {
            lekeCiz(g, renk, mx + ix * 30, my + iy * 30, 70, a);
            lekeCiz(g, renk, mx + ix * 90, my + iy * 90, 95, a * 0.6);
            lekeCiz(g, renk, mx + ix * 160, my + iy * 160, 120, a * 0.3);
        });
    }
    // kapı açılma ışığı (dinamik, sönen): önceden boyutlu lekeler
    let _kc = null, _ka = 0;
    function _kapiN(mx, my, ix, iy) {
        isikN(_kc, '#ffc878', mx + ix * 30, my + iy * 30, 64, _ka);
        isikN(_kc, '#ffc878', mx + ix * 96, my + iy * 96, 96, _ka * 0.6);
    }
    function kapilarIsikN(ctx, oda, S, renk, a) { _kc = ctx; _ka = a; kapiMerkezleri(oda, S, _kapiN); _kc = null; }

    // Engel bloklarının ışığa göre uzayan gölgeleri: siluet köşeleri ışıktan uzağa izdüşürülür
    function golgeKare(g, x0, y0, x1, y1, lx, ly, R, ox, oy) {
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const dx = cx - lx, dy = cy - ly;
        const d2 = dx * dx + dy * dy;
        if (d2 > R * R || d2 < 4) return false;
        const ac = Math.atan2(dy, dx);
        let mn = 9, mx = -9, ax = 0, ay = 0, bx = 0, by = 0;
        for (let k = 0; k < 4; k++) {
            const px = (k === 1 || k === 2) ? x1 : x0, py = k >= 2 ? y1 : y0;
            let d = Math.atan2(py - ly, px - lx) - ac;
            if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
            if (d < mn) { mn = d; ax = px; ay = py; }
            if (d > mx) { mx = d; bx = px; by = py; }
        }
        // gölge ışık yarıçapının biraz ötesinde biter (gradyan zaten orada söner): taranan alan küçük
        const L = Math.max(10, R * 1.15 - Math.sqrt(d2));
        const ul = Math.hypot(ax - lx, ay - ly) || 1, vl = Math.hypot(bx - lx, by - ly) || 1;
        // dörtgenler hep aynı yönde (küçük açı -> büyük açı) kurulur: tek yolda nonzero dolgu birleşimi verir
        g.moveTo(ax - ox, ay - oy); g.lineTo(bx - ox, by - oy);
        g.lineTo(bx + (bx - lx) / vl * L - ox, by + (by - ly) / vl * L - oy);
        g.lineTo(ax + (ax - lx) / ul * L - ox, ay + (ay - ly) / ul * L - oy);
        g.closePath();
        return true;
    }
    // Tapınak odasının iç gölge vericileri (sütun/duvar/çatlak/kilit; kenar duvarları hariç): oda başına bir kez
    const vericiHafiza = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
    const BOS16 = new Int16Array(0);
    function odaGolgeVericiler(oda) {
        if (!vericiHafiza || typeof Tapinak === 'undefined') return BOS16;
        const imza = oda.g;   // hücre dizisi değişirse (kırılan duvar) yeniden hesapla
        let k = vericiHafiza.get(oda);
        if (k && k.g === imza && k.n === sayGolge(oda)) return k.L;
        const HC = Tapinak.HUCRE, tmp = [];
        for (let y = 2; y < Tapinak.H - 2; y++) for (let x = 2; x < Tapinak.W - 2; x++) {
            const h = Tapinak.hucre(oda, x, y);
            if (h === HC.SUTUN || h === HC.DUVAR || h === HC.CATLAK || h === HC.KILIT) tmp.push(x, y);
        }
        k = { g: imza, n: tmp.length / 2, L: Int16Array.from(tmp) };
        vericiHafiza.set(oda, k);
        return k.L;
    }
    // ucuz değişim denetimi: yalnız kırılabilir hücre sayısı (CATLAK/KILIT dönüşünce değişir)
    function sayGolge(oda) {
        const k = vericiHafiza.get(oda);
        if (!k) return -1;
        if ((curT * 4 | 0) === k.son) return k.n;      // saniyede ~4 denetim
        k.son = curT * 4 | 0;
        const HC = Tapinak.HUCRE;
        let n = 0;
        for (let i = 0; i < k.L.length; i += 2) { const h = Tapinak.hucre(oda, k.L[i], k.L[i + 1]); if (h === HC.SUTUN || h === HC.DUVAR || h === HC.CATLAK || h === HC.KILIT) n++; }
        return n;
    }
    function golgeler(g, o, oda, S, lx, ly, R, ox, oy) {
        let var_ = 0;
        g.beginPath();
        const el = o.engeller;
        if (el) for (let i = 0; i < el.length; i++) {
            const x = el[i].x * S, y = el[i].y * S;
            if (golgeKare(g, x + 1, y + 1, x + S - 1, y + S - 1, lx, ly, R, ox, oy)) var_++;
        }
        if (oda) {
            const L = odaGolgeVericiler(oda);
            for (let i = 0; i < L.length; i += 2) {
                const x = L[i] * S, y = L[i + 1] * S;
                if (golgeKare(g, x, y, x + S, y + S, lx, ly, R, ox, oy)) var_++;
            }
        }
        if (var_) g.fill();
        return var_;
    }

    function izCiz(ctx, o, hx, hy) {
        if (!o.hiz || reduced || fx <= 0 || !o.bas) { IZ.n = 0; return; }
        // son konumla arası >2 px ise yeni nokta ekle
        const son = IZ.n ? (IZ.bas + IZ.n - 1) % IZ_N : -1;
        if (son < 0 || Math.hypot(IZ.x[son] - hx, IZ.y[son] - hy) > 2) {
            if (son >= 0 && Math.hypot(IZ.x[son] - hx, IZ.y[son] - hy) > 60) IZ.n = 0; // portal sıçraması
            const k = (IZ.bas + IZ.n) % IZ_N;
            IZ.x[k] = hx; IZ.y[k] = hy;
            if (IZ.n < IZ_N) IZ.n++; else IZ.bas = (IZ.bas + 1) % IZ_N;
        }
        if (IZ.n < 2) return;
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = cb ? '#56B4E9' : '#7fe8ff';
        for (let j = 1; j < IZ.n; j++) {
            const a = (IZ.bas + j - 1) % IZ_N, b = (IZ.bas + j) % IZ_N;
            const u = j / IZ.n;
            ctx.globalAlpha = 0.2 * u * Math.min(1, fx);
            ctx.lineWidth = 4 + 18 * u;
            ctx.beginPath(); ctx.moveTo(IZ.x[a], IZ.y[a] + 3); ctx.lineTo(IZ.x[b], IZ.y[b] + 3); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    // ---------- Kaya Mağarası kuralı: başın çevresinde küçük ışık dairesi, dışı karanlık ----------
    // Daire ön-pişirilmiş küçük bir leke; dışı 4 düz dikdörtgen (kare başı birkaç doldurma, tam ekran gradyan yok)
    const KR = { c: null, key: '', R: 104, A: 0.66 };
    function karanlikCiz(ctx, o, S) {
        const W = o.W, H = o.H, R = KR.R, A = KR.A * Math.min(1, 0.4 + (o.karanlik || 0));
        const key = dpr + '|' + R + '|' + A.toFixed(2);
        if (KR.key !== key) {
            const px = Math.ceil(R * 2 * dpr), c = tuval(px, px), g = c.getContext('2d');
            const gr = g.createRadialGradient(px / 2, px / 2, px * 0.06, px / 2, px / 2, px / 2);
            gr.addColorStop(0, 'rgba(2,6,5,0)'); gr.addColorStop(0.5, 'rgba(2,6,5,' + (A * 0.1) + ')');
            gr.addColorStop(0.8, 'rgba(2,6,5,' + (A * 0.55) + ')'); gr.addColorStop(1, 'rgba(2,6,5,' + A + ')');
            g.fillStyle = gr; g.fillRect(0, 0, px, px);
            KR.c = c; KR.key = key;
        }
        const hx = Math.round(((o.bas.x + 0.5) * S - R) * dpr) / dpr, hy = Math.round(((o.bas.y + 0.5) * S - R) * dpr) / dpr;
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(2,6,5,' + A + ')';
        const x0 = Math.max(0, Math.min(W, hx)), x1 = Math.max(0, Math.min(W, hx + R * 2));
        const y0 = Math.max(0, Math.min(H, hy)), y1 = Math.max(0, Math.min(H, hy + R * 2));
        ctx.fillRect(0, 0, W, y0);
        ctx.fillRect(0, y1, W, H - y1);
        ctx.fillRect(0, y0, x0, y1 - y0);
        ctx.fillRect(x1, y0, W - x1, y1 - y0);
        ctx.drawImage(KR.c, hx, hy, R * 2, R * 2);
        // yem karanlıkta da seçilsin: yumuşak ışıltı (ödül temasının kendisi)
        const yem = o.yem;
        if (yem && yem.x >= 0 && yem.y >= 0) {
            ctx.globalCompositeOperation = 'lighter';
            isikN(ctx, o.yemRenk || '#ffbf2e', (yem.x + 0.5) * S, (yem.y + 0.5) * S + 3, 40, 0.42 * (reduced ? 1 : 0.85 + 0.15 * Math.sin((o.t || 0) * 4)));
        }
        ctx.restore();
    }

    // ====================================================================
    // ÜST KATMAN (parçacıkların üstü): atmosfer, halkalar, şok dalgası, kıvılcım, kenar flaşı, derecelendirme
    // ====================================================================
    function ust(ctx, o) {
        if (!aktif || !ctx) return;
        const W = o.W, H = o.H, S = o.S || 20, t = o.t;
        const tema = TEMA[o.tema] ? o.tema : 'tas';
        const tp = o.tapinak, oda = tp ? tp.odalar[tp.oda] : null;
        // Tapınak: düşman/boss vuruş kıvılcımı (flash değeri yükselince)
        if (oda && vurusHafiza && fx > 0) {
            for (let i = 0; i < oda.dusmanlar.length; i++) vurusKontrol(oda.dusmanlar[i], oda.dusmanlar[i].x, oda.dusmanlar[i].y);
            if (oda.boss) vurusKontrol(oda.boss, oda.boss.x, oda.boss.y);
        }
        // 0) tema kuralı: karanlık (Kaya Mağarası)
        if (o.karanlik > 0 && o.bas && !tp) { dpr = o.dpr || dpr; reduced = !!o.reduced; try { karanlikCiz(ctx, o, S); } catch (e) {} }
        // 1) tema parçacıkları
        const n = Math.min(ATM_MAX, Math.round(ATM_SAYI[TEMA[tema].atm] * Math.min(1, fx) * (reduced ? 0.35 : 1)));
        P.tema = P.tema || tema;
        if (P.tema !== tema) P.n = 0;
        P.tema = tema;
        if (n > 0 && B.atm) { atmGuncelle(o, W, H, n); atmCiz(ctx, o); } else P.n = 0;

        // 2) efektler
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        let kenar = 0;
        for (let i = 0; i < EF_MAX; i++) {
            const e = EF[i];
            if (!e.tur) continue;
            const k = e.t / e.dur;
            const ease = 1 - (1 - k) * (1 - k) * (1 - k);
            if (e.tur === 1 || e.tur === 7) {            // halka dalgası
                if (reduced) continue;
                const r = 6 + e.r * ease;
                ctx.strokeStyle = e.renk;
                ctx.globalAlpha = 0.6 * (1 - k) * e.a;
                ctx.lineWidth = 3.2 * (1 - k) + 0.6;
                ctx.beginPath(); ctx.arc(e.x * S, e.y * S, r, 0, TAU); ctx.stroke();
                if (e.tur === 7) { // güç: ikinci, gecikmeli halka
                    const k2 = Math.max(0, k * 1.4 - 0.4);
                    if (k2 > 0 && k2 < 1) {
                        ctx.globalAlpha = 0.45 * (1 - k2) * e.a;
                        ctx.lineWidth = 2 * (1 - k2) + 0.5;
                        ctx.beginPath(); ctx.arc(e.x * S, e.y * S, 6 + e.r * 0.7 * (1 - (1 - k2) * (1 - k2)), 0, TAU); ctx.stroke();
                    }
                }
            } else if (e.tur === 3) {                     // şok dalgası (boss faz geçişi)
                if (reduced) continue;
                const r = 10 + e.r * ease;
                ctx.strokeStyle = e.renk;
                ctx.globalAlpha = 0.36 * (1 - k);
                ctx.lineWidth = 8 * (1 - k) + 1;
                ctx.beginPath(); ctx.arc(e.x * S, e.y * S, r, 0, TAU); ctx.stroke();
                ctx.strokeStyle = '#ffffff';
                ctx.globalAlpha = 0.22 * (1 - k);
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(e.x * S, e.y * S, r * 0.88, 0, TAU); ctx.stroke();
            } else if (e.tur === 4) {                     // kıvılcım
                ctx.strokeStyle = e.renk;
                ctx.globalAlpha = 0.95 * (1 - k);
                ctx.lineWidth = 2;
                ctx.beginPath();
                const n2 = reduced ? 3 : 6;
                for (let j = 0; j < n2; j++) {
                    const a = e.r + j * TAU / n2 + (j & 1) * 0.4;
                    const r0 = 5 + 14 * ease, r1 = r0 + 9 * (1 - k) + 2;
                    ctx.moveTo(e.x * S + Math.cos(a) * r0, e.y * S + Math.sin(a) * r0);
                    ctx.lineTo(e.x * S + Math.cos(a) * r1, e.y * S + Math.sin(a) * r1);
                }
                ctx.stroke();
            } else if (e.tur === 6) {
                kenar = Math.max(kenar, (1 - k) * (1 - k) * e.a);
            }
        }
        ctx.restore();

        // 3) hasar: kenar flaşı (merkez temiz)
        if (kenar > 0.01) {
            const c = kenarHazirla(W, H, cb ? 'rgb(230,159,0)' : 'rgb(255,30,60)');
            ctx.save();
            ctx.globalAlpha = Math.min(0.7, kenar * (reduced ? 0.6 : 1));
            ctx.drawImage(c, 0, 0, W, H);
            ctx.restore();
        }

    }

    function vurusKontrol(e, x, y) {
        const f = e.flash || 0;
        const onceki = vurusHafiza.get(e);
        if (onceki === undefined) { vurusHafiza.set(e, f); return; }
        if (f > onceki) { efEkle(4, x, y, 0.28, rnd() * TAU, cb ? '#F0E442' : '#ffd88a', 1); efEkle(2, x, y, 0.22, 46, '#ffd88a', 0.7); }
        if (f !== onceki) vurusHafiza.set(e, f);
    }

    // ====================================================================
    // OLAYLAR
    // ====================================================================
    // burst() ile: halka dalgası + kısa ışık patlaması (n ~ şiddet)
    function patla(x, y, renk, n) {
        if (!aktif) return;
        n = n || 10;
        const s = Math.min(1, n / 30);
        efEkle(2, x, y, 0.35 + 0.35 * s, 50 + 70 * s, renk || '#ffffff', 1);
        if (fx > 0) efEkle(1, x, y, 0.42 + 0.25 * s, 16 + 34 * s, renk || '#ffffff', Math.min(1, fx));
    }
    function olay(tur, x, y, renk) {
        if (!aktif) return;
        if (tur === 'hasar') efEkle(6, 0, 0, 0.42, 0, '', 1);
        else if (tur === 'guc') { efEkle(7, x, y, 0.7, 46, renk || '#ffffff', 1); efEkle(2, x, y, 0.5, 90, renk || '#ffffff', 0.9); }
        else if (tur === 'sok') { efEkle(3, x, y, 0.8, 300, renk || '#ff9a4a', 1); efEkle(2, x, y, 0.7, 220, renk || '#ffb070', 1); }
        else if (tur === 'kapi') efEkle(5, 0, 0, 2.4, 0, '', 1);
        else if (tur === 'kivilcim') efEkle(4, x, y, 0.26, rnd() * TAU, renk || '#ffd88a', 1);
    }

    function sifirla() {
        for (let i = 0; i < EF_MAX; i++) EF[i].tur = 0;
        IZ.n = 0; P.n = 0; sonT = -1;
    }
    function etkinSay() { let n = 0; for (let i = 0; i < EF_MAX; i++) if (EF[i].tur) n++; return n; }

    return {
        zemin, zeminPisir, ust, patla, olay, sifirla, TEMA,
        get aktif() { return aktif; }, set aktif(v) { aktif = !!v; },
        // test/inceleme
        _bolum: B,
        _durum: () => ({ parcacik: P.n, efekt: etkinSay(), iz: IZ.n, tema: P.tema, onbellek: sprCache.size })
    };
})();
if (typeof window !== 'undefined') window.Isik = Isik;
