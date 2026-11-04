// ========================================================================
// GFX25 - 2.5D çizim katmanı (tüm çizim kodla; dış görsel yok)
// Eğik bakış: zemin döşemeleri, yükseltilmiş çerçeve duvar, extrude bloklar,
// kürevari yılan, yerde gölgesi olan süzülen yemler. Gölge/gradyanlar önbellekli.
// ========================================================================
const Gfx25 = (() => {
    'use strict';
    const LIFT = 6;     // yılan parçalarının yerden yüksekliği (px)
    const BLOCK_H = 8;  // blok yüksekliği (px)
    const TAU = Math.PI * 2;

    let dpr = 1;
    const cache = new Map();
    let bgCache = { c: null, key: '' };
    let shadowsDone = false;

    // ---------- yardımcılar ----------
    function hexRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [n >> 16, (n >> 8) & 255, n & 255];
    }
    // k<0 koyultur, k>0 açar
    function tone(hex, k) {
        const c = hexRgb(hex);
        const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
        return 'rgb(' + f(c[0]) + ',' + f(c[1]) + ',' + f(c[2]) + ')';
    }
    function rgba(hex, a) {
        const c = hexRgb(hex);
        return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
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
    function setDpr(ctx) {
        let d = 1;
        try { d = ctx.getTransform().a || 1; } catch (e) { d = 1; }
        if (Math.abs(d - dpr) > 0.01) { dpr = d; cache.clear(); bgCache = { c: null, key: '' }; }
    }
    // Önbellekli sprite: (ox,oy) çizim başlangıcı, (w,h) mantıksal boyut
    function sprite(key, w, h, ox, oy, fn) {
        let s = cache.get(key);
        if (s) return s;
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.ceil(w * dpr));
        c.height = Math.max(1, Math.ceil(h * dpr));
        const g = c.getContext('2d');
        g.scale(dpr, dpr);
        g.translate(ox, oy);
        fn(g);
        s = { c, ox, oy, w, h };
        cache.set(key, s);
        return s;
    }
    function blit(ctx, s, x, y) { ctx.drawImage(s.c, x - s.ox, y - s.oy, s.w, s.h); }
    function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); }

    function groundShadow(ctx, x, y, rx, ry, a) {
        ctx.fillStyle = 'rgba(0,0,0,' + a + ')';
        ell(ctx, x, y, rx, ry);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,' + (a * 0.5) + ')';
        ell(ctx, x, y, rx * 1.3, ry * 1.3);
        ctx.fill();
    }
    function haloSprite(color, r) {
        return sprite('halo|' + color + '|' + r, r * 2, r * 2, r, r, g => {
            const gr = g.createRadialGradient(0, 0, 1, 0, 0, r);
            gr.addColorStop(0, color);
            gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = gr;
            g.fillRect(-r, -r, r * 2, r * 2);
        });
    }
    function glow(ctx, x, y, color, r, alpha) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;
        blit(ctx, haloSprite(color, r), x, y);
        ctx.restore();
    }

    // ====================================================================
    // (a) ZEMİN + ÇERÇEVE
    // ====================================================================
    function buildFloor(o) {
        const W = o.W, H = o.H, S = o.CELL;
        const c = document.createElement('canvas');
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
        const g = c.getContext('2d');
        g.scale(dpr, dpr);
        const R = rng(20250);

        const sky = g.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#0d1730');
        sky.addColorStop(1, '#070b16');
        g.fillStyle = sky;
        g.fillRect(0, 0, W, H);

        // Döşemeler: 2x2 hücrelik taş levhalar (kayık dizilim), üst yüzey + alt dudak, derz
        const SL = S * 2;
        g.fillStyle = 'rgb(4,7,14)';
        g.fillRect(0, 0, W, H);
        for (let sy = 0; sy * SL < H + SL; sy++) {
            const off = (sy & 1) ? -S : 0;
            for (let sx = 0; sx * SL + off < W + SL; sx++) {
                const px = sx * SL + off, py = sy * SL;
                const depth = py / H;
                const l = 17 + depth * 6 + (R() - 0.5) * 5;
                const hue = 216 + (R() - 0.5) * 12;
                g.fillStyle = 'hsl(' + hue + ',26%,' + (l - 7) + '%)';
                g.fillRect(px + 1, py + 3, SL - 2, SL - 3);                 // dudak (kalınlık)
                const tg = g.createLinearGradient(px, py, px + SL, py + SL);
                tg.addColorStop(0, 'hsl(' + hue + ',30%,' + (l + 7) + '%)');
                tg.addColorStop(1, 'hsl(' + (hue + 6) + ',32%,' + (l - 1) + '%)');
                g.fillStyle = tg;
                g.fillRect(px + 1, py + 1, SL - 2, SL - 4);                 // üst yüzey
                g.fillStyle = 'rgba(200,222,255,0.2)';
                g.fillRect(px + 1, py + 1, SL - 2, 1);
                g.fillRect(px + 1, py + 1, 1, SL - 4);
                g.fillStyle = 'rgba(0,0,10,0.3)';
                g.fillRect(px + 1, py + SL - 5, SL - 2, 1);
                g.fillRect(px + SL - 2, py + 1, 1, SL - 4);
                for (let k = 0; k < 16; k++) {
                    g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
                    g.fillRect(px + 2 + R() * (SL - 5), py + 2 + R() * (SL - 7), 1 + R() * 1.5, 1 + R());
                }
                const q = R();
                if (q < 0.22) {
                    g.strokeStyle = 'rgba(0,0,8,0.4)';
                    g.lineWidth = 0.9;
                    g.beginPath();
                    let cx = px + 5 + R() * (SL - 14), cy = py + 4 + R() * 8;
                    g.moveTo(cx, cy);
                    for (let k = 0; k < 4; k++) { cx += (R() - 0.35) * 6; cy += 2 + R() * 5; g.lineTo(cx, cy); }
                    g.stroke();
                } else if (q > 0.88) {
                    g.fillStyle = 'rgba(70,150,110,0.12)';
                    g.fillRect(px + 2 + R() * 6, py + SL - 8, 8 + R() * 14, 3);
                    g.fillRect(px + 4 + R() * 6, py + SL - 10, 4 + R() * 6, 2);
                }
            }
        }
        // oyun ızgarasını okunur kılan çok silik hücre çizgileri
        g.strokeStyle = 'rgba(0,0,12,0.16)';
        g.lineWidth = 1;
        g.beginPath();
        for (let x = S; x < W; x += S) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
        for (let y = S; y < H; y += S) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
        g.stroke();

        // Ambient ışık havuzu (orta) ve kenar kararması
        const pool = g.createRadialGradient(W * 0.5, H * 0.46, 40, W * 0.5, H * 0.46, W * 0.58);
        pool.addColorStop(0, 'rgba(255,205,130,0.075)');
        pool.addColorStop(0.55, 'rgba(120,160,255,0.025)');
        pool.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = pool;
        g.fillRect(0, 0, W, H);
        const vg = g.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, W * 0.62);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,6,0.5)');
        g.fillStyle = vg;
        g.fillRect(0, 0, W, H);

        // Duvara temas gölgesi (AO)
        const ao = (x0, y0, x1, y1, rx, ry, rw, rh) => {
            const gr = g.createLinearGradient(x0, y0, x1, y1);
            gr.addColorStop(0, 'rgba(0,0,8,0.5)');
            gr.addColorStop(1, 'rgba(0,0,8,0)');
            g.fillStyle = gr;
            g.fillRect(rx, ry, rw, rh);
        };
        ao(0, 12, 0, 30, 0, 12, W, 18);          // üst duvarın dibi
        ao(8, 0, 22, 0, 8, 0, 14, H);            // sol
        ao(W - 8, 0, W - 22, 0, W - 22, 0, 14, H); // sağ
        ao(0, H - 6, 0, H - 20, 0, H - 20, W, 14); // alt

        drawFrame(g, o);
        return c;
    }

    function stoneFace(g, x, y, w, h, base, R) {
        const gr = g.createLinearGradient(x, y, x, y + h);
        gr.addColorStop(0, tone(base, 0.05));
        gr.addColorStop(1, tone(base, -0.35));
        g.fillStyle = gr;
        g.fillRect(x, y, w, h);
        for (let i = 0; i < w * h / 40; i++) {
            g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
            g.fillRect(x + R() * w, y + R() * h, 1 + R() * 1.5, 1);
        }
    }

    // Yükseltilmiş taş duvar: üst yüzey + ön (iç) yüz
    function drawFrame(g, o) {
        const W = o.W, H = o.H;
        const R = rng(777);
        const stone = '#5a6384', stoneDark = '#2d3350';
        const TOP = 4, FACE = 8, SIDE = 5, BOT = 5;

        // üst (uzak) duvar: ön yüz + üst yüzey
        stoneFace(g, 0, TOP, W, FACE, stoneDark, R);
        g.strokeStyle = 'rgba(0,0,10,0.45)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, TOP + FACE / 2 + 0.5); g.lineTo(W, TOP + FACE / 2 + 0.5);
        for (let x = 0, i = 0; x < W; x += 24, i++) {
            const bx = x + (i & 1 ? 12 : 0);
            g.moveTo(bx + 0.5, TOP); g.lineTo(bx + 0.5, TOP + FACE / 2);
            g.moveTo(((bx + 12) % W) + 0.5, TOP + FACE / 2); g.lineTo(((bx + 12) % W) + 0.5, TOP + FACE);
        }
        g.stroke();
        const tg = g.createLinearGradient(0, 0, 0, TOP);
        tg.addColorStop(0, tone(stone, 0.35));
        tg.addColorStop(1, tone(stone, 0.1));
        g.fillStyle = tg;
        g.fillRect(0, 0, W, TOP);
        g.fillStyle = 'rgba(255,255,255,0.28)';
        g.fillRect(0, 0, W, 1);

        // sol ve sağ duvar: üst yüzey + dar iç yüz
        const side = (x, inner) => {
            const gr = g.createLinearGradient(x, 0, x + SIDE, 0);
            gr.addColorStop(inner ? 1 : 0, tone(stone, 0.25));
            gr.addColorStop(inner ? 0 : 1, tone(stone, -0.05));
            g.fillStyle = gr;
            g.fillRect(x, TOP, SIDE, H - TOP - BOT);
            g.fillStyle = 'rgba(0,0,10,0.4)';
            g.fillRect(inner ? x : x + SIDE - 1.5, TOP + FACE, 1.5, H - TOP - FACE - BOT);
        };
        side(0, false);
        side(W - SIDE, true);
        // iç yüz (gölgeli şerit)
        g.fillStyle = tone(stoneDark, -0.2);
        g.fillRect(SIDE, TOP + FACE, 2, H - TOP - FACE - BOT);
        g.fillRect(W - SIDE - 2, TOP + FACE, 2, H - TOP - FACE - BOT);

        // alt (yakın) duvar: yalnız üst yüzey (kamera önünde, ön yüz taşar)
        const bg = g.createLinearGradient(0, H - BOT, 0, H);
        bg.addColorStop(0, tone(stone, 0.2));
        bg.addColorStop(1, tone(stone, -0.15));
        g.fillStyle = bg;
        g.fillRect(0, H - BOT, W, BOT);
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fillRect(0, H - BOT, W, 1);

        // köşe kuleleri: küçük extrude blok
        const pillar = (cx, cy) => {
            const w = 14, hgt = 6, x = cx - w / 2, y = cy - w / 2;
            g.fillStyle = tone(stoneDark, -0.1);
            g.fillRect(x, y + w - hgt + 2, w, hgt);        // ön yüz
            const pg = g.createLinearGradient(x, y, x + w, y + w);
            pg.addColorStop(0, tone(stone, 0.4));
            pg.addColorStop(1, tone(stone, 0.05));
            g.fillStyle = pg;
            g.fillRect(x, y, w, w - hgt + 2);              // üst yüz
            g.strokeStyle = 'rgba(255,208,100,0.7)';
            g.lineWidth = 1.2;
            g.beginPath();
            g.moveTo(cx - 3, cy - 1); g.lineTo(cx, cy - 4); g.lineTo(cx + 3, cy - 1); g.lineTo(cx, cy + 2); g.closePath();
            g.stroke();
        };
        pillar(8, 9); pillar(W - 8, 9); pillar(8, H - 8); pillar(W - 8, H - 8);

        // altın iç çizgi
        g.strokeStyle = 'rgba(255,208,100,0.22)';
        g.lineWidth = 1;
        g.strokeRect(SIDE + 0.5, TOP + FACE + 0.5, W - SIDE * 2 - 1, H - TOP - FACE - BOT - 1);
    }

    function drawBackground(ctx, now, o) {
        setDpr(ctx);
        const key = dpr + ':' + o.W + 'x' + o.H;
        if (!bgCache.c || bgCache.key !== key) { bgCache.c = buildFloor(o); bgCache.key = key; }
        ctx.drawImage(bgCache.c, 0, 0, o.W, o.H);
        if (!o.reduced) {
            // hareketli yumuşak ortam ışığı
            const t = now / 1000;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.05 + 0.02 * Math.sin(t * 0.6);
            for (let i = 0; i < 1; i++) {
                const cx = o.W * (0.3 + 0.4 * i) + Math.sin(t * 0.22 + i * 2) * 90;
                const cy = o.H * 0.5 + Math.cos(t * 0.17 + i) * 60;
                blit(ctx, haloSprite(i ? 'rgb(90,255,200)' : 'rgb(90,150,255)', 160), cx, cy);
            }
            ctx.restore();
        }
    }

    // ====================================================================
    // (b) ENGEL BLOKLARI
    // ====================================================================
    function runePath(g, v, cx, cy) {
        g.beginPath();
        if (v === 0) { g.moveTo(cx - 2, cy - 4); g.lineTo(cx - 2, cy + 4); g.moveTo(cx - 2, cy - 4); g.lineTo(cx + 3, cy - 1); g.lineTo(cx - 2, cy + 2); }
        else if (v === 1) { g.moveTo(cx - 3, cy - 4); g.lineTo(cx - 3, cy + 4); g.moveTo(cx - 3, cy); g.lineTo(cx + 3, cy - 4); g.moveTo(cx - 3, cy); g.lineTo(cx + 3, cy + 4); }
        else if (v === 2) { g.moveTo(cx - 4, cy - 4); g.lineTo(cx + 4, cy + 4); g.moveTo(cx + 4, cy - 4); g.lineTo(cx - 4, cy + 4); }
        else { g.moveTo(cx, cy - 4); g.lineTo(cx, cy + 4); g.moveTo(cx - 4, cy - 1); g.lineTo(cx, cy - 4); g.lineTo(cx + 4, cy - 1); }
    }

    function blockSprite(color, ember, v, S) {
        const H = BLOCK_H, PAD = 8, SD = 3;
        const w = S + PAD * 2 + SD, h = S + H + PAD * 2;
        return sprite('blk|' + color + '|' + ember + '|' + v, w, h, PAD, PAD + H, g => {
            // yere gölge (yumuşak, sağ-aşağı)
            g.save();
            g.shadowColor = 'rgba(0,0,6,0.42)';
            g.shadowBlur = 8;
            g.shadowOffsetX = 3 + 2000;
            g.shadowOffsetY = 3;
            g.fillStyle = '#000';
            g.fillRect(1 - 2000, 2, S - 1 + SD, S - 2);
            g.restore();
            const tw = S - SD; // üst yüz genişliği
            // ön yüz
            const fg = g.createLinearGradient(0, S - H, 0, S);
            fg.addColorStop(0, ember ? '#c24a00' : tone(color, -0.35));
            fg.addColorStop(1, ember ? '#6a1d00' : tone(color, -0.7));
            g.fillStyle = fg;
            g.fillRect(0, S - H, tw, H);
            // harç/taş derzi
            g.strokeStyle = 'rgba(0,0,0,0.35)';
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(0, S - H / 2 + 0.5); g.lineTo(tw, S - H / 2 + 0.5);
            g.moveTo(tw * (v & 1 ? 0.3 : 0.65), S - H); g.lineTo(tw * (v & 1 ? 0.3 : 0.65), S - H / 2);
            g.moveTo(tw * (v & 1 ? 0.7 : 0.35), S - H / 2); g.lineTo(tw * (v & 1 ? 0.7 : 0.35), S);
            g.stroke();
            // sağ yan yüz
            g.fillStyle = ember ? '#8a2a00' : tone(color, -0.5);
            g.beginPath();
            g.moveTo(tw, -H); g.lineTo(S, -H + SD); g.lineTo(S, S); g.lineTo(tw, S);
            g.closePath();
            g.fill();
            g.fillStyle = 'rgba(0,0,0,0.22)';
            g.fill();
            // üst yüz
            const tg = g.createLinearGradient(0, -H, tw, S - H);
            tg.addColorStop(0, ember ? '#ffc36a' : tone(color, 0.5));
            tg.addColorStop(1, ember ? '#e0600a' : tone(color, 0.08));
            g.fillStyle = tg;
            g.fillRect(0, -H, tw, S);
            // ışık kenarları
            g.fillStyle = 'rgba(255,255,255,0.4)';
            g.fillRect(0, -H, tw, 1.5);
            g.fillRect(0, -H, 1.5, S);
            g.fillStyle = 'rgba(0,0,0,0.3)';
            g.fillRect(0, S - H - 1.5, tw, 1.5);
            g.fillRect(tw - 1.5, -H, 1.5, S);
            // oyma run
            g.lineCap = 'round';
            g.lineWidth = 1.6;
            g.strokeStyle = ember ? 'rgba(90,20,0,0.7)' : 'rgba(0,0,10,0.45)';
            runePath(g, v, tw / 2, S / 2 - H + 0.5);
            g.stroke();
            g.strokeStyle = ember ? 'rgba(255,210,120,0.55)' : 'rgba(210,230,255,0.4)';
            g.lineWidth = 0.8;
            g.translate(-0.4, -0.5);
            runePath(g, v, tw / 2, S / 2 - H + 0.5);
            g.stroke();
        });
    }

    function drawBlock(ctx, x, y, color, ember, t, S) {
        const v = ((x * 7 + y * 13) % 4 + 4) % 4;
        const sp = blockSprite(color, !!ember, v, S);
        blit(ctx, sp, x * S, y * S);
        if (ember) {
            const a = 0.28 + 0.12 * Math.sin(t * 5 + x);
            glow(ctx, x * S + S / 2 - 1, y * S + S / 2 - BLOCK_H, 'rgb(255,110,20)', 26, a);
        }
    }

    // Ressam sırası: y artan (üst yüzler arkadaki ön yüzleri örter)
    let sortBuf = [];
    function drawBlocks(ctx, list, color, ember, t, S, floorXY) {
        setDpr(ctx);
        sortBuf.length = 0;
        for (let i = 0; i < list.length; i++) sortBuf.push(list[i]);
        sortBuf.sort((a, b) => (floorXY ? Math.floor(a.y) - Math.floor(b.y) : a.y - b.y));
        for (let i = 0; i < sortBuf.length; i++) {
            const o = sortBuf[i];
            drawBlock(ctx, floorXY ? Math.floor(o.x) : o.x, floorXY ? Math.floor(o.y) : o.y, color, ember, t, S);
        }
    }

    // ====================================================================
    // (c) YILAN
    // ====================================================================
    function bodyPalette(k, cb, pal) {
        const q = Math.round(k * 12) / 12;
        if (cb) {
            return { q, hi: pal.ton(pal.yilan, 0.55 - 0.3 * q), mid: pal.ton(pal.yilan, -0.4 * q), lo: pal.ton(pal.yilan, -0.4 * q - 0.45) };
        }
        const h = 158 - 16 * q, s = 88 - 14 * q, l = 50 - 22 * q;
        return { q, hi: 'hsl(' + h + ',' + (s - 8) + '%,' + Math.min(88, l + 30) + '%)', mid: 'hsl(' + h + ',' + s + '%,' + l + '%)', lo: 'hsl(' + (h + 6) + ',' + s + '%,' + Math.max(6, l - 26) + '%)' };
    }

    function sphereSprite(r, k, cb, pal, gem) {
        const pk = bodyPalette(k, cb, pal);
        const rq = Math.round(r * 4) / 4;
        const R = rq + 3;
        return sprite('sph|' + rq + '|' + pk.q + '|' + cb + '|' + gem, R * 2, R * 2, R, R, g => {
            const gr = g.createRadialGradient(-rq * 0.35, -rq * 0.4, rq * 0.1, 0, 0, rq);
            gr.addColorStop(0, pk.hi);
            gr.addColorStop(0.45, pk.mid);
            gr.addColorStop(1, pk.lo);
            g.fillStyle = gr;
            g.beginPath(); g.arc(0, 0, rq, 0, TAU); g.fill();
            // pul deseni: elmas kafes (daire içinde kırpılı)
            g.save();
            g.beginPath(); g.arc(0, 0, rq - 0.3, 0, TAU); g.clip();
            g.strokeStyle = 'rgba(0,25,20,0.34)';
            g.lineWidth = 0.8;
            const st = rq * 0.62;
            g.beginPath();
            for (let i = -3; i <= 3; i++) {
                g.moveTo(i * st - rq, -rq); g.lineTo(i * st + rq, rq);
                g.moveTo(i * st + rq, -rq); g.lineTo(i * st - rq, rq);
            }
            g.stroke();
            g.restore();
            if (gem) {
                g.fillStyle = 'rgba(255,214,102,0.88)';
                g.beginPath();
                g.moveTo(0, -3.2); g.lineTo(2.6, 0); g.lineTo(0, 3.2); g.lineTo(-2.6, 0);
                g.closePath(); g.fill();
            }
            // parlak vurgu + alt kenar yansıma
            const hg = g.createRadialGradient(-rq * 0.38, -rq * 0.45, 0, -rq * 0.38, -rq * 0.45, rq * 0.55);
            hg.addColorStop(0, 'rgba(255,255,255,0.75)');
            hg.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = hg;
            g.beginPath(); g.arc(-rq * 0.38, -rq * 0.45, rq * 0.55, 0, TAU); g.fill();
            g.strokeStyle = 'rgba(160,255,230,0.18)';
            g.lineWidth = 1;
            g.beginPath(); g.arc(0, 0, rq - 0.7, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
        });
    }

    // Tüm gölgeler tek yol olarak çizilir (parçalar üst üste binip koyulaşmaz)
    function shadowPass(ctx, all, S) {
        const n = all.length;
        if (!n) return;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let pass = 0; pass < 2; pass++) {
            ctx.strokeStyle = pass ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.13)';
            ctx.lineWidth = pass ? 11 : 16;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const p = all[i];
                const x = p.x * S + S / 2 + 2, y = p.y * S + S / 2 + 2.5;
                const q = all[i - 1];
                if (i && Math.abs(q.x - p.x) + Math.abs(q.y - p.y) <= 1.5) ctx.lineTo(x, y);
                else { ctx.moveTo(x, y); ctx.lineTo(x + 0.01, y); }
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawSnakeBody(ctx, pos, idx, total, o) {
        const S = o.CELL;
        setDpr(ctx);
        if (idx === total - 1 && o.all) { shadowPass(ctx, o.all, S); shadowsDone = true; }
        const k = total > 1 ? idx / (total - 1) : 0;
        const r = Math.max(5.2, 8.6 - k * 3.2);
        const cx = pos.x * S + S / 2, cy = pos.y * S + S / 2 - LIFT;
        const prev = o.all && o.all[idx - 1];
        const pk = bodyPalette(k, o.cb, o.pal);
        if (prev && Math.abs(prev.x - pos.x) + Math.abs(prev.y - pos.y) <= 1.5) {
            const px = prev.x * S + S / 2, py = prev.y * S + S / 2 - LIFT;
            ctx.lineCap = 'round';
            ctx.strokeStyle = pk.lo;
            ctx.lineWidth = r * 2;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
            ctx.strokeStyle = pk.mid;
            ctx.lineWidth = r * 1.5;
            ctx.beginPath(); ctx.moveTo(cx - r * 0.1, cy - r * 0.16); ctx.lineTo(px - r * 0.1, py - r * 0.16); ctx.stroke();
            ctx.strokeStyle = pk.hi;
            ctx.globalAlpha = 0.55;
            ctx.lineWidth = r * 0.75;
            ctx.beginPath(); ctx.moveTo(cx - r * 0.28, cy - r * 0.4); ctx.lineTo(px - r * 0.28, py - r * 0.4); ctx.stroke();
            ctx.strokeStyle = '#fff';
            ctx.globalAlpha = 0.28;
            ctx.lineWidth = r * 0.28;
            ctx.beginPath(); ctx.moveTo(cx - r * 0.38, cy - r * 0.55); ctx.lineTo(px - r * 0.38, py - r * 0.55); ctx.stroke();
            ctx.globalAlpha = 1;
        }
        blit(ctx, sphereSprite(r, k, o.cb, o.pal, idx % 3 === 1), cx, cy);
    }

    function drawSnakeHead(ctx, pos, dir, t, o) {
        const S = o.CELL;
        setDpr(ctx);
        if (!shadowsDone) shadowPass(ctx, [pos], S);
        shadowsDone = false;
        const cx = pos.x * S + S / 2, cy = pos.y * S + S / 2 - LIFT;
        const th = Math.atan2(dir.y, dir.x);
        const cs = Math.cos(th), sn = Math.sin(th);
        // ışık sabit (sol-üst): yerel eksene çevir
        const lx = cs * -0.4 + sn * -0.55, ly = -sn * -0.4 + cs * -0.55;
        const cb = o.cb, pal = o.pal;
        const hi = cb ? pal.ton(pal.yilan, 0.4) : '#6ff0b0';
        const mid = cb ? pal.yilan : '#13c27a';
        const lo = cb ? pal.ton(pal.yilan, -0.55) : '#06623f';

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(th);
        ctx.scale(1.12, 1.12);

        // dil
        if ((t * 2.2) % 1 < 0.35) {
            const flick = Math.sin(t * 60) * 0.6;
            ctx.strokeStyle = '#ff3b5c';
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(10, 0); ctx.lineTo(16, flick);
            ctx.moveTo(16, flick); ctx.lineTo(19.5, flick - 2.6);
            ctx.moveTo(16, flick); ctx.lineTo(19.5, flick + 2.6);
            ctx.stroke();
        }

        // kafatası: gölgeli taban + ana form (ön tarafı sivri)
        const headPath = () => {
            ctx.beginPath();
            ctx.moveTo(-8, -6.8);
            ctx.bezierCurveTo(-1, -9.6, 7, -7.6, 11.6, -2.2);
            ctx.quadraticCurveTo(13.4, 0, 11.6, 2.2);
            ctx.bezierCurveTo(7, 7.6, -1, 9.6, -8, 6.8);
            ctx.quadraticCurveTo(-10.6, 0, -8, -6.8);
            ctx.closePath();
        };
        ctx.fillStyle = lo;
        ctx.save(); ctx.translate(0, 1.2); headPath(); ctx.fill(); ctx.restore();
        const gr = ctx.createRadialGradient(lx * 4, ly * 4, 1, 0, 0, 13);
        gr.addColorStop(0, hi);
        gr.addColorStop(0.5, mid);
        gr.addColorStop(1, lo);
        ctx.fillStyle = gr;
        headPath();
        ctx.fill();
        ctx.save();
        headPath();
        ctx.clip();
        // pul deseni
        ctx.strokeStyle = 'rgba(0,30,20,0.3)';
        ctx.lineWidth = 0.9;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath(); ctx.arc(-6 + i * 3.6, 0, 4.4 - i * 0.3, -Math.PI * 0.45, Math.PI * 0.45); ctx.stroke();
        }
        // altın yan şeritler
        ctx.strokeStyle = 'rgba(255,214,102,0.8)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-7, -5.2); ctx.quadraticCurveTo(2, -7.2, 8.5, -3.2);
        ctx.moveTo(-7, 5.2); ctx.quadraticCurveTo(2, 7.2, 8.5, 3.2);
        ctx.stroke();
        // üst vurgu (parlak)
        const sg = ctx.createRadialGradient(lx * 5, ly * 5, 0, lx * 5, ly * 5, 4.2);
        sg.addColorStop(0, 'rgba(255,255,255,0.5)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(-12, -12, 26, 24);
        ctx.restore();
        // burun delikleri
        ctx.fillStyle = 'rgba(0,25,15,0.7)';
        ell(ctx, 10, -1.7, 0.7, 0.5); ctx.fill();
        ell(ctx, 10, 1.7, 0.7, 0.5); ctx.fill();
        // kaş çıkıntısı + gözler
        [-1, 1].forEach(side => {
            const ex = 4, ey = 4.5 * side;
            ctx.strokeStyle = 'rgba(0,30,20,0.55)';
            ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(ex, ey, 3.6, side < 0 ? Math.PI * 0.95 : Math.PI * 0.05 - 0.0001, side < 0 ? Math.PI * 2.05 : Math.PI * 1.05, side < 0 ? false : true); ctx.stroke();
            const eg = ctx.createRadialGradient(ex - 0.6, ey - 0.8, 0.3, ex, ey, 3);
            eg.addColorStop(0, '#fff2a0');
            eg.addColorStop(0.6, '#ffc21a');
            eg.addColorStop(1, '#a86a00');
            ctx.fillStyle = eg;
            ctx.beginPath(); ctx.arc(ex, ey, 2.9, 0, TAU); ctx.fill();
            ctx.fillStyle = '#0c0d08';
            ell(ctx, ex + 0.3, ey, 0.75, 2.1); ctx.fill();
            // göz parıltısı (ekranda sol-üst)
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.beginPath(); ctx.arc(ex + lx * 1.4, ey + ly * 1.4, 0.8, 0, TAU); ctx.fill();
        });
        ctx.restore();
    }

    // ====================================================================
    // (d) YEMLER
    // ====================================================================
    function appleSprite(rotten) {
        const R = 13;
        return sprite('apple|' + rotten, R * 2, R * 2 + 4, R, R + 2, g => {
            const body = (c0, c1, c2) => {
                const gr = g.createRadialGradient(-3, -3, 1, 0, 1, 9.5);
                gr.addColorStop(0, c0); gr.addColorStop(0.55, c1); gr.addColorStop(1, c2);
                g.fillStyle = gr;
                g.beginPath();
                g.moveTo(0, -5.2);
                g.bezierCurveTo(4, -8.6, 9.2, -4, 8.2, 2);
                g.bezierCurveTo(7.4, 7.6, 3, 9.4, 0, 8.2);
                g.bezierCurveTo(-3, 9.4, -7.4, 7.6, -8.2, 2);
                g.bezierCurveTo(-9.2, -4, -4, -8.6, 0, -5.2);
                g.closePath();
                g.fill();
            };
            if (rotten) body('#a77bd0', '#6a3d92', '#2c1540'); else body('#fff2a8', '#ffbf2e', '#c84a14');
            // alt gölge kenarı
            g.strokeStyle = 'rgba(0,0,0,0.22)';
            g.lineWidth = 1.2;
            g.beginPath(); g.arc(0, 1.4, 7.6, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
            // sap + yaprak
            g.strokeStyle = '#5a3a1a'; g.lineWidth = 1.6; g.lineCap = 'round';
            g.beginPath(); g.moveTo(0, -5); g.quadraticCurveTo(0.5, -8, 1.8, -10); g.stroke();
            if (!rotten) {
                g.fillStyle = '#4ad36b';
                g.beginPath(); g.ellipse(4.6, -8, 3.8, 1.8, -0.5, 0, TAU); g.fill();
                g.fillStyle = 'rgba(255,255,255,0.75)';
                g.beginPath(); g.ellipse(-3.6, -2.2, 1.7, 3, -0.55, 0, TAU); g.fill();
            } else {
                g.fillStyle = '#2a1238';
                g.beginPath(); g.arc(3.2, 1.6, 2.2, 0, TAU); g.fill();
                g.fillStyle = 'rgba(210,180,255,0.35)';
                g.beginPath(); g.ellipse(-3.6, -2.2, 1.5, 2.6, -0.55, 0, TAU); g.fill();
            }
        });
    }

    function starSprite() {
        return sprite('star', 30, 30, 15, 15, g => {
            const pts = [];
            for (let i = 0; i < 12; i++) {
                const a = (i * 30 - 90) * Math.PI / 180;
                const r = i % 2 === 0 ? 11 : 4.8;
                pts.push([Math.cos(a) * r, Math.sin(a) * r]);
            }
            // arka derinlik
            g.fillStyle = '#9a5a00';
            g.beginPath();
            pts.forEach((p, i) => i ? g.lineTo(p[0], p[1] + 1.6) : g.moveTo(p[0], p[1] + 1.6));
            g.closePath(); g.fill();
            const gr = g.createRadialGradient(-2, -3, 1, 0, 0, 11);
            gr.addColorStop(0, '#fffbe0'); gr.addColorStop(1, '#ffb800');
            g.fillStyle = gr;
            g.beginPath();
            pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
            g.closePath(); g.fill();
            // yüzeyler: köşegen ışık/gölge
            g.strokeStyle = 'rgba(160,90,0,0.4)';
            g.lineWidth = 0.8;
            g.beginPath();
            for (let i = 0; i < 12; i += 2) { g.moveTo(0, 0); g.lineTo(pts[i][0], pts[i][1]); }
            g.stroke();
            g.fillStyle = 'rgba(255,255,255,0.8)';
            g.beginPath(); g.arc(-2.2, -3, 1.4, 0, TAU); g.fill();
        });
    }

    function drawFood(ctx, food, t, o) {
        setDpr(ctx);
        const S = o.CELL;
        const gx = food.x * S + S / 2, gy = food.y * S + S / 2;
        const isSuper = food.type === 'super';
        const rotten = food.type === 'curuk';
        const bob = o.reduced ? 0 : Math.sin(t * 3 + food.x) ;
        const h = (rotten ? 3.5 : 6) + bob * 2.5;       // yerden yükseklik
        const k = 1 - Math.min(1, h / 22);               // yüksek = küçük, soluk gölge
        const pulse = 1 + Math.sin(t * 5) * 0.1;
        groundShadow(ctx, gx + 1, gy + 6, 6.5 * k + 1.5, 3 * k + 0.8, 0.34 * k + 0.1);
        const cx = gx, cy = gy - h;

        if (rotten) {
            for (let i = 0; i < 3; i++) {
                const ph = (t * 0.8 + i * 0.33) % 1;
                ctx.globalAlpha = 0.35 * (1 - ph);
                ctx.fillStyle = '#7CFF6B';
                ctx.beginPath(); ctx.arc(cx - 4 + i * 4, cy - 8 - ph * 14, 2 + ph * 3, 0, TAU); ctx.fill();
            }
            ctx.globalAlpha = 1;
            blit(ctx, appleSprite(true), cx, cy);
            if (o.cb) {
                ctx.strokeStyle = o.pal.curuk; ctx.lineWidth = 3; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5); ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx - 5, cy + 5); ctx.stroke();
            }
            return;
        }

        // parıltı (önbellekli halka sprite; shadowBlur yok)
        const hc = isSuper ? 'rgba(255,221,0,0.5)' : (o.cb ? 'rgba(230,159,0,0.42)' : 'rgba(255,191,46,0.42)');
        glow(ctx, cx, cy, hc, 22 * pulse, 1);
        if (o.cb) {
            ctx.strokeStyle = o.pal.yemHalka; ctx.lineWidth = 2; ctx.setLineDash(isSuper ? [3, 3] : []);
            ctx.beginPath(); ctx.arc(cx, cy, 11 * pulse, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        }
        if (isSuper) {
            ctx.save();
            ctx.translate(cx, cy);
            // dikey eksende dönen yıldız: 2.5D madalyon
            const sx = o.reduced ? 1 : (0.35 + 0.65 * Math.abs(Math.cos(t * 1.6)));
            ctx.scale(sx * pulse, pulse);
            blit(ctx, starSprite(), 0, 0);
            ctx.restore();
        } else {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(pulse, pulse);
            blit(ctx, appleSprite(false), 0, 0);
            ctx.restore();
        }
        if (!o.reduced) {
            ctx.fillStyle = isSuper ? '#ffdd00' : (o.cb ? o.pal.yem : '#ffbf2e');
            ctx.globalAlpha = 0.7;
            for (let i = 0; i < 3; i++) {
                const a = t * 2.2 + i * 2.094;
                ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 12, cy + Math.sin(a) * 7, 1.4, 0, TAU); ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
    }

    // Emoji yazı tipine bağımlı olmayan çizimli güç simgeleri (beyaz, koyu kenarlı)
    function powerGlyph(ctx, type, cx, cy) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        if (type === 'shield') {
            ctx.moveTo(0, -5); ctx.lineTo(4.5, -3.2); ctx.lineTo(3.8, 1.6); ctx.quadraticCurveTo(2.5, 4, 0, 5.5);
            ctx.quadraticCurveTo(-2.5, 4, -3.8, 1.6); ctx.lineTo(-4.5, -3.2); ctx.closePath();
        } else if (type === 'speed') {
            ctx.moveTo(1.5, -5.5); ctx.lineTo(-3.5, 0.8); ctx.lineTo(-0.3, 0.8); ctx.lineTo(-1.5, 5.5); ctx.lineTo(3.5, -1); ctx.lineTo(0.3, -1); ctx.closePath();
        } else if (type === 'invincible') {
            for (let i = 0; i < 10; i++) { const a = (i * 36 - 90) * Math.PI / 180, r = i % 2 ? 2.3 : 5.4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
            ctx.closePath();
        } else {
            for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 2.6 : 5.6; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
            ctx.closePath();
        }
        ctx.fill(); ctx.stroke();
        ctx.restore();
    }

    function drawPowerup(ctx, p, t, o) {
        setDpr(ctx);
        const S = o.CELL;
        const gx = p.x * S + S / 2, gy = p.y * S + S / 2;
        const bob = o.reduced ? 0 : Math.sin(t * 3 + p.x);
        const h = 6 + bob * 2.5;
        const k = 1 - Math.min(1, h / 22);
        groundShadow(ctx, gx + 1, gy + 6.5, 7 * k + 1.5, 3.2 * k + 0.8, 0.34 * k + 0.1);
        const col = o.colors[p.type];
        const cx = gx, cy = gy - h;
        glow(ctx, cx, cy, col, 17 + Math.sin(t * 6) * 2, 0.55);
        // rün taşı: döner elmas, iki tonlu yüzeyler
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 4 + Math.sin(t * 2) * 0.12);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(-6.5, -5.5, 14, 14);
        const g = ctx.createLinearGradient(-7, -7, 7, 7);
        g.addColorStop(0, 'rgba(255,255,255,0.8)');
        g.addColorStop(0.5, col);
        g.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = g;
        ctx.fillRect(-7, -7, 14, 14);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.strokeRect(-7, -7, 14, 14);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(7, -7); ctx.lineTo(7, 7); ctx.stroke();
        ctx.restore();
        powerGlyph(ctx, p.type, cx, cy);
    }

    function drawPortal(ctx, p, t, o) {
        setDpr(ctx);
        const S = o.CELL;
        [p.a, p.b].forEach(c => {
            const cx = c.x * S + S / 2, cy = c.y * S + S / 2;
            // zemindeki çukur / gölge
            ctx.fillStyle = 'rgba(0,0,6,0.55)';
            ell(ctx, cx, cy + 3, 10.5, 6.2); ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ell(ctx, cx, cy + 3, 12.5, 7.6); ctx.fill();
            glow(ctx, cx, cy - 1, p.color, 16, 0.42 + Math.sin(t * 4) * 0.1);
            // yükseltilmiş, yatık halkalar
            const lift = 3 + (o.reduced ? 0 : Math.sin(t * 2.5 + c.x) * 1);
            ctx.strokeStyle = p.color;
            ctx.lineCap = 'round';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(cx, cy - lift + 1.5, 9.5, 5.8, 0, t * 3, t * 3 + Math.PI * 1.6);
            ctx.stroke();
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.ellipse(cx, cy - lift + 1.5, 5.2, 3.2, 0, -t * 4, -t * 4 + Math.PI * 1.4);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(cx - 1, cy - lift + 0.5, 2, 2);
        });
    }

    return { drawBackground, drawBlock, drawBlocks, drawSnakeHead, drawSnakeBody, drawFood, drawPowerup, drawPortal, LIFT, BLOCK_H };
})();
if (typeof window !== 'undefined') window.Gfx25 = Gfx25;
