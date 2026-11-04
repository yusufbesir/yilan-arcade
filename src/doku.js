// ========================================================================
// DOKU - gerçek fotoğraf-PBR dokuları (ambientCG, CC0) için yükleyici + ön-hesaplayıcı
// Dokular img/tex/pack.js içinde data: URI olarak gelir (file:// ve Electron'da tuval kirlenmez,
// böylece getImageData ile NormalGL'den ışıklandırma hesaplanabilir). Yüklenene kadar çağıranlar
// prosedürel çizimle devam eder (ready() false). Ağır işler kare başına en fazla bir makro doku.
// ========================================================================
const Doku = (() => {
    'use strict';
    const TAU = Math.PI * 2;
    const TEMALAR = ['tas', 'kaya', 'buz', 'lav'];            // Bölüm Modu "Otomatik" döngüsü (değişmez)
    const TUM = ['tas', 'kaya', 'buz', 'lav', 'bat', 'run'];  // Market temaları dahil tüm zemin temaları
    const AD = { tas: 'taş avlu', kaya: 'kaya mağarası', buz: 'buz karo', lav: 'lav', bat: 'bataklık', run: 'rün tapınağı' };

    // Seviye/moda göre tema (oynanış değişmez; yalnız görünüm)
    function themeFor(mode, level) {
        if (mode === 'campaign') return TEMALAR[(((level | 0) - 1) % 4 + 4) % 4];
        const sabit = { classic: 'tas', bullet: 'lav', tailgun: 'kaya', survivor: 'kaya', portal: 'buz', timeattack: 'buz', chaos: 'lav', daily: 'tas', tapinak: 'tas' };
        if (sabit[mode]) return sabit[mode];
        let h = 0; const s = String(mode || '');
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return TEMALAR[h % 4];
    }

    // makro doku tanımları: tex, scale (mantıksal px / döşeme), mean (hedef parlaklık), con (kontrast),
    // tint/tk (gece mavisi ton eşlemesi), bump (normal şiddeti), lit (ışık farkı), spec (Roughness parlaklığı)
    const KIND = {
        'floor.tas': { tex: 'PavingStones138', scale: 230, mean: 0.19, con: 0.8, tint: [0.82, 0.95, 1.2], tk: 0.6, bump: 1.4, lit: 1.5, spec: 0.05 },
        'floor.kaya': { tex: 'Rock064', scale: 240, mean: 0.17, con: 0.72, tint: [0.9, 0.97, 1.1], tk: 0.55, bump: 1.2, lit: 1.4, spec: 0.04 },
        'floor.buz': { tex: 'Tiles141', scale: 220, mean: 0.28, con: 1.15, tint: [0.7, 0.97, 1.32], tk: 0.85, bump: 3, lit: 2.2, spec: 0.3 },
        'floor.lav': { tex: 'Rock058', scale: 230, mean: 0.12, con: 0.8, tint: [1.15, 0.88, 0.8], tk: 0.65, bump: 1.3, lit: 1.5, spec: 0.05 },
        'wall.tas': { tex: 'Rock064', scale: 150, mean: 0.38, con: 0.95, tint: [0.9, 0.96, 1.12], tk: 0.45, bump: 1.5, lit: 1.8, spec: 0.05 },
        'wall.kaya': { tex: 'Rock058', scale: 150, mean: 0.33, con: 0.95, tint: [1.05, 0.98, 0.9], tk: 0.4, bump: 1.5, lit: 1.8, spec: 0.05 },
        'wall.buz': { tex: 'Rock058', scale: 150, mean: 0.42, con: 0.95, tint: [0.75, 0.95, 1.25], tk: 0.8, bump: 1.5, lit: 1.8, spec: 0.2 },
        'wall.lav': { tex: 'Rock064', scale: 150, mean: 0.27, con: 0.95, tint: [1.2, 0.85, 0.75], tk: 0.65, bump: 1.5, lit: 1.8, spec: 0.05 },
        'block.tas': { tex: 'Rock064', scale: 104, mean: 0.43, con: 1.0, tint: [0.9, 0.96, 1.12], tk: 0.4, bump: 1.7, lit: 2.0, spec: 0.06 },
        'block.kaya': { tex: 'Rock058', scale: 104, mean: 0.4, con: 1.0, tint: [1.05, 0.98, 0.9], tk: 0.35, bump: 1.7, lit: 2.0, spec: 0.06 },
        'block.buz': { tex: 'Rock058', scale: 104, mean: 0.46, con: 1.0, tint: [0.75, 0.95, 1.25], tk: 0.75, bump: 1.7, lit: 2.0, spec: 0.22 },
        'block.lav': { tex: 'Rock064', scale: 104, mean: 0.33, con: 1.0, tint: [1.2, 0.85, 0.75], tk: 0.6, bump: 1.7, lit: 2.0, spec: 0.06 },
        'block.ember': { tex: 'Lava004', scale: 96, mean: 0.5, con: 1.0, tint: [1, 1, 1], tk: 0, bump: 1, lit: 0.8, spec: 0 },
        // Bataklık: Ground068 zemin + Leather008 duvar/engel (yeşil-çamur tonu); Rün Tapınağı: Tiles141/PavingStones138 mor-turkuaz
        'floor.bat': { tex: 'Ground068', scale: 210, mean: 0.15, con: 0.85, tint: [0.62, 1.12, 0.66], tk: 0.7, bump: 1.4, lit: 1.4, spec: 0.04 },
        'wall.bat': { tex: 'Leather008', scale: 150, mean: 0.3, con: 0.95, tint: [0.7, 1.1, 0.62], tk: 0.65, bump: 1.4, lit: 1.7, spec: 0.05 },
        'block.bat': { tex: 'Leather008', scale: 104, mean: 0.36, con: 1.0, tint: [0.72, 1.12, 0.6], tk: 0.6, bump: 1.5, lit: 1.9, spec: 0.06 },
        'floor.run': { tex: 'Tiles141', scale: 200, mean: 0.17, con: 1.0, tint: [1.12, 0.74, 1.3], tk: 0.8, bump: 2.4, lit: 1.8, spec: 0.2 },
        'wall.run': { tex: 'PavingStones138', scale: 150, mean: 0.3, con: 0.95, tint: [1.1, 0.75, 1.28], tk: 0.7, bump: 1.5, lit: 1.8, spec: 0.08 },
        'block.run': { tex: 'PavingStones138', scale: 104, mean: 0.38, con: 1.0, tint: [1.08, 0.78, 1.25], tk: 0.65, bump: 1.6, lit: 1.9, spec: 0.1 },
        'moss': { tex: 'Moss002', scale: 120, mean: 0.2, con: 1.0, tint: [0.75, 1.1, 0.75], tk: 0.25, bump: 1.4, lit: 1.2, spec: 0 },
        'lavaglow': { tex: 'Lava004', scale: 160, mean: 0.58, con: 1.0, tint: [1, 1, 1], tk: 0, bump: 1, lit: 0.5, spec: 0 }
    };

    let state = 'idle';       // idle | loading | ready | failed
    let stamp = 0;            // her yeni makro/hazır oluşunda artar
    const imgs = {};
    const rawCache = new Map();
    const macros = new Map();
    const pats = new Map();

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

    // ---------- yükleme ----------
    function load() {
        if (state !== 'idle' || typeof document === 'undefined') return;
        state = 'loading';
        const s = document.createElement('script');
        s.src = 'img/tex/pack.js';
        s.onload = () => {
            const P = window.DOKU_PACK;
            if (!P) { state = 'failed'; return; }
            const keys = Object.keys(P);
            let n = keys.length;
            keys.forEach(k => {
                const im = new Image();
                im.onload = im.onerror = () => { if (--n === 0) { state = 'ready'; stamp++; } };
                im.src = P[k];
                imgs[k] = im;
            });
        };
        s.onerror = () => { state = 'failed'; };
        document.head.appendChild(s);
    }

    // ---------- ham harita (boyuta indirilmiş piksel verisi) ----------
    function rawMaps(tex, T) {
        const key = tex + '|' + T;
        let m = rawCache.get(key);
        if (m) return m;
        const c = document.createElement('canvas');
        c.width = c.height = T;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        const rd = h => {
            const im = imgs[tex + '_' + h];
            g.clearRect(0, 0, T, T);
            g.drawImage(im, 0, 0, T, T);
            return g.getImageData(0, 0, T, T).data;
        };
        m = { c: rd('Color'), n: rd('NormalGL'), r: rd('Roughness') };
        rawCache.set(key, m);
        return m;
    }

    // ---------- makro doku: 2x2 aynalı (dikişsiz) + normal haritadan lambert + roughness parlaklığı ----------
    function build(kind, dpr) {
        const K = KIND[kind];
        const T = Math.max(64, Math.round(K.scale * dpr)), N = T * 2;
        const m = rawMaps(K.tex, T);
        const cd = m.c, nd = m.n, rd = m.r;
        let lx = -0.5, ly = 0.55, lz = 0.67;
        const ll = Math.sqrt(lx * lx + ly * ly + lz * lz); lx /= ll; ly /= ll; lz /= ll;
        let hx = lx, hy = ly, hz = lz + 1;
        const hl = Math.sqrt(hx * hx + hy * hy + hz * hz); hx /= hl; hy /= hl; hz /= hl;
        const out = new Float32Array(N * N * 3);
        let sum = 0;
        for (let oy = 0; oy < N; oy++) {
            const fy = oy >= T, sy = fy ? N - 1 - oy : oy;
            for (let ox = 0; ox < N; ox++) {
                const fx = ox >= T, sx = fx ? N - 1 - ox : ox;
                const si = (sy * T + sx) * 4, oi = (oy * N + ox) * 3;
                let nx = (nd[si] / 127.5 - 1) * K.bump * (fx ? -1 : 1);
                let ny = (nd[si + 1] / 127.5 - 1) * K.bump * (fy ? -1 : 1);
                let nz = Math.max(0.12, nd[si + 2] / 127.5 - 1);
                const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
                nx *= inv; ny *= inv; nz *= inv;
                let mult = 1 + (nx * lx + ny * ly + nz * lz - lz) * K.lit;
                if (mult < 0.3) mult = 0.3;
                const spec = K.spec ? Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), 24) * (1 - rd[si] / 255) * K.spec : 0;
                let r = cd[si] / 255, g = cd[si + 1] / 255, b = cd[si + 2] / 255;
                const l = 0.299 * r + 0.587 * g + 0.114 * b;
                r += (l * K.tint[0] - r) * K.tk; g += (l * K.tint[1] - g) * K.tk; b += (l * K.tint[2] - b) * K.tk;
                r = r * mult + spec; g = g * mult + spec; b = b * mult + spec * 1.1;
                out[oi] = r; out[oi + 1] = g; out[oi + 2] = b;
                sum += 0.299 * r + 0.587 * g + 0.114 * b;
            }
        }
        const gain = K.mean / Math.max(0.02, sum / (N * N));
        const c = document.createElement('canvas');
        c.width = c.height = N;
        const g = c.getContext('2d');
        const id = g.createImageData(N, N), d = id.data;
        for (let i = 0, j = 0; i < N * N; i++, j += 3) {
            let r = out[j] * gain, gg = out[j + 1] * gain, b = out[j + 2] * gain;
            const l = 0.299 * r + 0.587 * gg + 0.114 * b;
            const l2 = Math.max(0.004, K.mean + (l - K.mean) * K.con);
            const k = l2 / Math.max(0.004, l);
            r *= k; gg *= k; b *= k;
            // Nors gece mavisi: gölgelere soğuk lacivert dolgu
            const sh = Math.max(0, 1 - l2 * 2.4);
            r += 0.010 * sh; gg += 0.020 * sh; b += 0.050 * sh;
            const p = i * 4;
            d[p] = r < 0 ? 0 : r > 1 ? 255 : r * 255;
            d[p + 1] = gg < 0 ? 0 : gg > 1 ? 255 : gg * 255;
            d[p + 2] = b < 0 ? 0 : b > 1 ? 255 : b * 255;
            d[p + 3] = 255;
        }
        g.putImageData(id, 0, 0);
        return c;
    }

    // ---------- kuyruk: kare başına en fazla bir makro ----------
    function kindsFor(theme) {
        if (!TUM.includes(theme)) theme = 'tas';
        const k = ['floor.' + theme, 'wall.' + theme, 'block.' + theme, 'block.ember'];
        if (theme === 'tas' || theme === 'kaya' || theme === 'bat') k.push('moss');
        if (theme === 'lav') k.push('lavaglow');
        return k;
    }
    function ready(theme, dpr) {
        if (!TUM.includes(theme)) theme = 'tas';
        if (state === 'idle') load();
        if (state !== 'ready') return false;
        return kindsFor(theme).every(k => macros.has(k + '|' + dpr));
    }
    // true: hazır; false: yedek çizim sürsün (bu çağrıda bir makro üretilebilir)
    function pump(theme, dpr) {
        if (!TUM.includes(theme)) theme = 'tas';
        if (ready(theme, dpr)) return true;
        if (state !== 'ready') return false;
        const eksik = kindsFor(theme).find(k => !macros.has(k + '|' + dpr));
        if (eksik) {
            try { macros.set(eksik + '|' + dpr, build(eksik, dpr)); stamp++; } catch (e) { macros.set(eksik + '|' + dpr, null); state = 'failed'; }
        }
        return state === 'ready' && ready(theme, dpr);
    }
    function pattern(ctx, kind, dpr, ox, oy) {
        const key = kind + '|' + dpr;
        const mc = macros.get(key);
        if (!mc) return null;
        const cacheKey = (ox || oy) ? null : key;
        let p = cacheKey && pats.get(cacheKey);
        if (p) return p;
        p = ctx.createPattern(mc, 'repeat');
        try { p.setTransform(new DOMMatrix().translate(ox || 0, oy || 0).scale(1 / dpr)); } catch (e) { /* eski tarayıcı: ölçeksiz */ }
        if (cacheKey) pats.set(cacheKey, p);
        return p;
    }

    // ---------- süsler ----------
    function blotch(g, W, H, R, cols, rows, lo, hi, mode, alpha) {
        const c = document.createElement('canvas');
        c.width = cols; c.height = rows;
        const q = c.getContext('2d');
        const id = q.createImageData(cols, rows);
        for (let i = 0; i < cols * rows; i++) {
            const v = lo + R() * (hi - lo);
            id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
        }
        q.putImageData(id, 0, 0);
        g.save();
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.globalCompositeOperation = mode; g.globalAlpha = alpha;
        g.drawImage(c, 0, 0, W, H);
        g.restore();
    }
    function crackPts(R, x, y, ang, len, step) {
        const pts = [[x, y]];
        for (let d = 0; d < len; d += step) { ang += (R() - 0.5) * 1.15; x += Math.cos(ang) * step; y += Math.sin(ang) * step; pts.push([x, y]); }
        return pts;
    }
    function strokePts(g, pts) { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); }
    function crack(g, R, x, y, len, a) {
        g.save();
        g.lineCap = 'round'; g.lineJoin = 'round';
        const ang = R() * TAU, pts = crackPts(R, x, y, ang, len, 4 + R() * 3);
        g.strokeStyle = 'rgba(0,0,8,' + (0.5 * a) + ')'; g.lineWidth = 1.2; strokePts(g, pts);
        g.strokeStyle = 'rgba(190,210,255,' + (0.09 * a) + ')'; g.lineWidth = 0.7;
        g.translate(0.8, 0.9); strokePts(g, pts);
        g.restore();
        if (R() < 0.6) { const b = pts[Math.floor(pts.length / 2)]; crack(g, R, b[0], b[1], len * 0.45, a * 0.8); }
    }
    // kenar ağırlıklı leke noktaları
    function edgePoints(R, W, H, n, depth) {
        const out = [];
        for (let i = 0; i < n; i++) {
            const side = Math.floor(R() * 4), t = R(), d = 12 + R() * depth;
            out.push(side === 0 ? { x: t * W, y: d } : side === 1 ? { x: t * W, y: H - d } : side === 2 ? { x: d, y: t * H } : { x: W - d, y: t * H });
        }
        return out;
    }
    function mossLayer(g, W, H, dpr, R, pts, rmax, alpha) {
        const c = document.createElement('canvas');
        c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
        const q = c.getContext('2d');
        q.scale(dpr, dpr);
        const p = pattern(q, 'moss', dpr);
        if (!p) return;
        q.fillStyle = p; q.fillRect(0, 0, W, H);
        q.globalCompositeOperation = 'destination-in';
        // maske: düzensiz yumuşak lekeler
        const m = document.createElement('canvas');
        m.width = c.width; m.height = c.height;
        const mg = m.getContext('2d');
        mg.scale(dpr, dpr);
        pts.forEach(pt => {
            const k = 3 + Math.floor(R() * 4);
            for (let i = 0; i < k; i++) {
                const x = pt.x + (R() - 0.5) * rmax, y = pt.y + (R() - 0.5) * rmax * 0.8, r = rmax * (0.25 + R() * 0.45);
                const gr = mg.createRadialGradient(x, y, r * 0.1, x, y, r);
                gr.addColorStop(0, 'rgba(255,255,255,0.95)');
                gr.addColorStop(0.6, 'rgba(255,255,255,0.45)');
                gr.addColorStop(1, 'rgba(255,255,255,0)');
                mg.fillStyle = gr; mg.fillRect(x - r, y - r, r * 2, r * 2);
            }
        });
        q.setTransform(1, 0, 0, 1, 0, 0);
        q.drawImage(m, 0, 0);
        g.save();
        g.globalAlpha = alpha;
        g.drawImage(c, 0, 0, W, H);
        g.restore();
    }
    function lavaCracks(g, W, H, dpr, R, n, a) {
        g.save();
        g.lineCap = 'round'; g.lineJoin = 'round';
        const lp = pattern(g, 'lavaglow', dpr);
        for (let i = 0; i < n; i++) {
            // çoğu kenarda; ortadan uzak (okunabilirlik)
            const e = edgePoints(R, W, H, 1, Math.min(W, H) * 0.3)[0];
            const pts = crackPts(R, e.x, e.y, R() * TAU, 70 + R() * 120, 6 + R() * 4);
            g.strokeStyle = 'rgba(6,2,2,0.7)'; g.lineWidth = 10; strokePts(g, pts);
            g.save(); g.shadowColor = 'rgba(255,90,20,' + (0.9 * a) + ')'; g.shadowBlur = 16;
            g.strokeStyle = 'rgba(255,100,25,' + (0.6 * a) + ')'; g.lineWidth = 5.5; strokePts(g, pts); g.restore();
            g.strokeStyle = lp || 'rgb(255,150,40)'; g.globalAlpha = 0.95 * a; g.lineWidth = 3; strokePts(g, pts); g.globalAlpha = 1;
            const b = pts[Math.floor(pts.length / 2)];
            const pb = crackPts(R, b[0], b[1], R() * TAU, 40 + R() * 50, 6);
            g.strokeStyle = 'rgba(255,110,30,' + (0.5 * a) + ')'; g.lineWidth = 2.2; strokePts(g, pb);
        }
        g.restore();
    }
    function pool(g, x, y, r, rgb, a) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(x, y, 2, x, y, r);
        gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
        gr.addColorStop(0.5, 'rgba(' + rgb + ',' + (a * 0.32) + ')');
        gr.addColorStop(1, 'rgba(' + rgb + ',0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
        g.restore();
    }

    // Rün Tapınağı: zemine işlenmiş soluk mor-turkuaz rün oyukları (ışıklı rünler oyunda ayrıca çizilir)
    function runeler(g, W, H, R) {
        g.save();
        g.lineCap = 'round'; g.lineJoin = 'round';
        for (let i = 0; i < 16; i++) {
            const x = 40 + R() * (W - 80), y = 40 + R() * (H - 80), s = 7 + R() * 5, tur = i % 4;
            g.strokeStyle = i % 3 === 0 ? 'rgba(80,235,230,0.22)' : 'rgba(170,120,255,0.24)';
            g.lineWidth = 1.6;
            g.beginPath();
            if (tur === 0) { g.moveTo(x, y - s); g.lineTo(x, y + s); g.moveTo(x, y - s * 0.2); g.lineTo(x + s * 0.8, y - s); }
            else if (tur === 1) { g.moveTo(x - s * 0.7, y - s); g.lineTo(x + s * 0.7, y + s); g.moveTo(x + s * 0.7, y - s); g.lineTo(x - s * 0.7, y + s); }
            else if (tur === 2) { g.moveTo(x - s * 0.7, y + s); g.lineTo(x, y - s); g.lineTo(x + s * 0.7, y + s); g.moveTo(x - s * 0.4, y + s * 0.2); g.lineTo(x + s * 0.4, y + s * 0.2); }
            else { g.arc(x, y, s * 0.7, 0, TAU); g.moveTo(x, y - s); g.lineTo(x, y + s); }
            g.stroke();
        }
        g.restore();
    }

    // Market kartı önizlemesi: zemin dokusunun renk haritası, tema tonuyla boyanmış (makro doku kurmaz; ucuz)
    function onizle(c, theme, ton, dpr) {
        const g = c.getContext('2d');
        const w = c.width, h = c.height;
        g.clearRect(0, 0, w, h);
        const K = KIND['floor.' + theme];
        const im = K && state === 'ready' ? imgs[K.tex + '_Color'] : null;
        if (im && im.naturalWidth) {
            const k = Math.max(w / im.naturalWidth, h / im.naturalHeight) * 1.6;
            g.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, 0, 0, im.naturalWidth * k, im.naturalHeight * k);
        } else { g.fillStyle = '#121a2a'; g.fillRect(0, 0, w, h); }
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = ton || '#667'; g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'source-over';
        const vg = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.62);
        vg.addColorStop(0, 'rgba(0,0,0,0.05)'); vg.addColorStop(1, 'rgba(0,0,8,0.7)');
        g.fillStyle = vg; g.fillRect(0, 0, w, h);
    }

    // Zemin tuvali. o: { seed, torches:[{x,y}], moss:0..1, cracks:n, grid:bool, torchRgb }
    function floor(theme, W, H, S, dpr, o) {
        if (!ready(theme, dpr)) return null;
        o = o || {};
        const R = rng(o.seed || 20250);
        const c = document.createElement('canvas');
        c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
        const g = c.getContext('2d');
        g.scale(dpr, dpr);
        const fp = pattern(g, 'floor.' + theme, dpr);
        g.fillStyle = fp; g.fillRect(0, 0, W, H);
        // büyük ölçekli parlaklık lekeleri: tekrar desenini kırar
        blotch(g, W, H, R, 7, 5, 150, 255, 'multiply', 0.9);
        blotch(g, W, H, R, 19, 13, 200, 255, 'multiply', 0.55);
        blotch(g, W, H, R, 11, 8, 90, 170, 'overlay', 0.35);
        // yosun / çatlak
        const moss = o.moss == null ? (theme === 'kaya' ? 0.9 : theme === 'tas' ? 0.55 : theme === 'bat' ? 1 : 0) : o.moss;
        if (moss > 0) mossLayer(g, W, H, dpr, R, edgePoints(R, W, H, Math.round(14 * moss) + 3, 60), 70, 0.5 * Math.min(1, moss + 0.15));
        const nc = o.cracks == null ? 11 : o.cracks;
        for (let i = 0; i < nc; i++) crack(g, R, 20 + R() * (W - 40), 20 + R() * (H - 40), 26 + R() * 50, 0.9);
        if (theme === 'lav') lavaCracks(g, W, H, dpr, R, o.lavaN == null ? 9 : o.lavaN, 1);
        if (theme === 'buz') {
            // buz çatlakları: açık mavi ince çizgiler
            g.save(); g.lineCap = 'round';
            for (let i = 0; i < 6; i++) {
                const pts = crackPts(R, R() * W, R() * H, R() * TAU, 50 + R() * 80, 5);
                g.strokeStyle = 'rgba(190,235,255,0.16)'; g.lineWidth = 1; strokePts(g, pts);
            }
            g.restore();
        }
        if (theme === 'run') runeler(g, W, H, R);
        if (o.grid !== false) {
            g.strokeStyle = 'rgba(0,0,12,0.13)'; g.lineWidth = 1;
            g.beginPath();
            for (let x = S; x < W; x += S) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
            for (let y = S; y < H; y += S) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
            g.stroke();
        }
        // ışık havuzları: orta ortam + meşale
        const warm = theme === 'buz' ? '150,200,255' : theme === 'lav' ? '255,120,50' : theme === 'bat' ? '150,230,110' : theme === 'run' ? '150,110,255' : '255,190,110';
        pool(g, W * 0.5, H * 0.46, W * 0.5, theme === 'buz' ? '120,170,255' : '255,205,130', 0.055);
        (o.torches || []).forEach(t => pool(g, t.x, t.y, o.torchR || 150, warm, theme === 'lav' ? 0.2 : 0.2));
        // kenar kararması + köşelerde hafif sis
        const vg = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.62);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,6,0.5)');
        g.fillStyle = vg; g.fillRect(0, 0, W, H);
        const fogRgb = theme === 'lav' ? '60,18,10' : theme === 'buz' ? '70,110,170' : theme === 'bat' ? '40,95,40' : theme === 'run' ? '70,40,130' : '50,70,120';
        [[0, 0], [W, 0], [0, H], [W, H]].forEach(([x, y]) => {
            const gr = g.createRadialGradient(x, y, 0, x, y, Math.min(W, H) * 0.55);
            gr.addColorStop(0, 'rgba(' + fogRgb + ',0.22)'); gr.addColorStop(1, 'rgba(' + fogRgb + ',0)');
            g.fillStyle = gr; g.fillRect(0, 0, W, H);
        });
        return c;
    }

    load();
    return { themeFor, TEMALAR, TUM, AD, onizle, load, ready, pump, pattern, floor, crack, pool, edgePoints, mossLayer, rng, get state() { return state; }, get stamp() { return stamp; } };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Doku;
