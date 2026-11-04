// ========================================================================
// SPRITES - three.js ile modellenip pişirilmiş PNG şeritlerinin yükleyicisi
// Harita: sprite-map.js (tools/bake/bake.js üretir). Görsel hazır değilse
// has() false döner ve çağıran kod eski tuval çizimine geri düşer.
// Her kare, ekran ölçeği (dpr x ölçek) için önceden küçültülüp önbelleğe alınır.
// ========================================================================
const Sprites = (() => {
    'use strict';
    const MAP = (typeof window !== 'undefined' && window.SPRITE_MAP && window.SPRITE_MAP.sprites) || {};
    const SC0 = (typeof window !== 'undefined' && window.SPRITE_MAP && window.SPRITE_MAP.scale) || 2;
    const img = {};
    const st = { yuklenen: 0, hata: [], toplam: Object.keys(MAP).length };
    let version = 0;
    const cache = new Map();

    function load() {
        if (typeof Image === 'undefined') return;
        Object.keys(MAP).forEach(k => {
            const im = new Image();
            im.decoding = 'async';
            im.onload = () => { img[k] = im; st.yuklenen++; version++; cache.clear(); tintCache.clear(); };
            im.onerror = () => { st.hata.push(k); };
            // data: URI (gömülü) tercih edilir: file:// altında tuvali kirletmez; yoksa PNG dosyası
            im.src = (window.SPRITE_DATA && window.SPRITE_DATA[k]) || MAP[k].file;
        });
    }
    function has(name) { return !!img[name]; }
    // Ölçek büyüklüğü (döndürülmüş bağlamda da: baş dönüşte döndürülür). Önbellek anahtarı
    // kararlı kalsın diye 1/8'e yuvarlanır; yoksa her açı yeni bir küçültülmüş tuval üretirdi.
    function dprOf(ctx) {
        let d = 1;
        try { const m = ctx.getTransform(); d = Math.hypot(m.a, m.b) || 1; } catch (e) { d = 1; }
        return Math.max(0.125, Math.round(d * 8) / 8);
    }

    // Kareyi hedef piksel boyuna yüksek kaliteyle indir (yarılayarak)
    // m.sc (varsa): sprite'a özgü çözünürlük (ör. düşmanlar 3 px = 1 mantıksal px)
    function scaled(name, i, s, dpr) {
        const q = Math.round(s * 20) / 20;
        const key = name + '|' + i + '|' + q + '|' + dpr;
        let c = cache.get(key);
        if (c) return c;
        const m = MAP[name], im = img[name], SC = m.sc || SC0;
        const tw = Math.max(1, Math.round(m.w / SC * q * dpr)), th = Math.max(1, Math.round(m.h / SC * q * dpr));
        let src = document.createElement('canvas');
        src.width = m.w; src.height = m.h;
        src.getContext('2d').drawImage(im, i * m.w, 0, m.w, m.h, 0, 0, m.w, m.h);
        let w = m.w, h = m.h;
        while (w / 2 >= tw && h / 2 >= th) {
            const n = document.createElement('canvas');
            n.width = Math.round(w / 2); n.height = Math.round(h / 2);
            const g = n.getContext('2d'); g.imageSmoothingQuality = 'high';
            g.drawImage(src, 0, 0, n.width, n.height);
            src = n; w = n.width; h = n.height;
        }
        c = document.createElement('canvas');
        c.width = tw; c.height = th;
        const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
        g.drawImage(src, 0, 0, tw, th);
        c = { c, w: m.w / SC * q, h: m.h / SC * q, ax: m.ax / SC * q, ay: m.ay / SC * q };
        if (cache.size > 900) cache.clear();
        cache.set(key, c);
        return c;
    }

    // (x,y): yer çapası (modelin dünya başlangıcı) mantıksal pikselde
    function draw(ctx, name, i, x, y, s, flip) {
        if (!img[name]) return false;
        const m = MAP[name];
        const fr = ((i % m.n) + m.n) % m.n;
        const sp = scaled(name, fr, s || 1, dprOf(ctx));
        if (flip) {
            ctx.save();
            ctx.translate(x, y); ctx.scale(-1, 1);
            ctx.drawImage(sp.c, -sp.ax, -sp.ay, sp.w, sp.h);
            ctx.restore();
        } else ctx.drawImage(sp.c, x - sp.ax, y - sp.ay, sp.w, sp.h);
        return true;
    }
    // Kırpılmış çizim: çapa çevresinde yalnız (cw x ch) mantıksal px'lik dikdörtgen (bağlantı tüpleri)
    // cx0, cy0: kırpma merkezinin çapaya göre kayması
    function drawCrop(ctx, name, i, x, y, s, cw, ch, cy0) {
        if (!img[name]) return false;
        const m = MAP[name];
        const sp = scaled(name, ((i % m.n) + m.n) % m.n, s || 1, dprOf(ctx));
        const k = sp.c.width / sp.w;
        const w = cw == null ? sp.w : Math.min(sp.w, cw), h = ch == null ? sp.h : Math.min(sp.h, ch);
        const sx = cw == null ? 0 : sp.ax - w / 2;
        const sy = ch == null ? 0 : sp.ay + (cy0 || 0) - h / 2;
        ctx.drawImage(sp.c, Math.max(0, sx * k), Math.max(0, sy * k), w * k, h * k, x - sp.ax + sx, y - sp.ay + sy, w, h);
        return true;
    }
    function frames(name) { return MAP[name] ? MAP[name].n : 0; }
    // Adlandırılmış kare aralığı: anim('hortlak','bekle') -> [ilk, adet]; yoksa null
    function anim(name, ad) { const a = MAP[name] && MAP[name].anim; return a && a[ad] ? a[ad] : null; }

    // Renkli siluet (vuruş flaşı, ölüm parlaması): karenin alfa maskesi düz renkle doldurulur ve
    // 'lighter' ile sprite'ın üstüne eklenir (ctx.filter gerekmez). a: 0..1 yoğunluk.
    const tintCache = new Map();
    function drawTint(ctx, name, i, x, y, s, flip, color, a) {
        if (!img[name] || !(a > 0)) return false;
        const m = MAP[name];
        const fr = ((i % m.n) + m.n) % m.n;
        const sp = scaled(name, fr, s || 1, dprOf(ctx));
        const key = sp.c.width + 'x' + sp.c.height + '|' + name + '|' + fr + '|' + color;
        let t = tintCache.get(key);
        if (!t) {
            t = document.createElement('canvas'); t.width = sp.c.width; t.height = sp.c.height;
            const g = t.getContext('2d');
            g.drawImage(sp.c, 0, 0);
            // pişmiş zemin gölgesi (siyah, yarı saydam) maskeye girmesin: alfa parlaklıkla ağırlıklanır
            try {
                const d = g.getImageData(0, 0, t.width, t.height), a = d.data;
                for (let i = 0; i < a.length; i += 4) {
                    const l = (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) / 255;
                    a[i + 3] = a[i + 3] * Math.min(1, Math.max(0, (l - 0.03) / 0.12));
                }
                g.putImageData(d, 0, 0);
            } catch (e) { /* kirli tuval: düz maske */ }
            g.globalCompositeOperation = 'source-in';
            g.fillStyle = color; g.fillRect(0, 0, t.width, t.height);
            if (tintCache.size > 200) tintCache.clear();
            tintCache.set(key, t);
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= Math.min(1, a);
        if (flip) { ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(t, -sp.ax, -sp.ay, sp.w, sp.h); }
        else ctx.drawImage(t, x - sp.ax, y - sp.ay, sp.w, sp.h);
        ctx.restore();
        return true;
    }

    load();
    return { has, draw, drawCrop, drawTint, frames, anim, durum: () => st, get version() { return version; }, MAP };
})();
if (typeof window !== 'undefined') window.Sprites = Sprites;
