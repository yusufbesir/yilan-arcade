// ========================================================================
// MARKET - yılan kostümleri (skin) ve özgün efektleri. Para birimi Kül (Miras).
// Her şey kodla çizilir; dış varlık yok. Kayıt: localStorage 'twilightMarket'
// { v:1, sahip:[id...], giyili:id }. Efektler parçacıktır (kare başına en çok 40),
// reduced / fx kapalı / renk körü açıkken efekt çizilmez; renk körüyken skin de uygulanmaz.
// ========================================================================
const Market = (() => {
    'use strict';
    const KEY = 'twilightMarket';
    const VARSAYILAN = 'orman';
    const MAX_PARCA = 40;
    const TAU = Math.PI * 2;

    // Nadirlik: renk, etiket, sıra
    const NADIRLIK = {
        yaygin: { ad: 'Yaygın', renk: '#9aa3ad', sira: 0 },
        nadir: { ad: 'Nadir', renk: '#4aa3ff', sira: 1 },
        epik: { ad: 'Epik', renk: '#b46cff', sira: 2 },
        efsane: { ad: 'Efsanevi', renk: '#e8c46a', sira: 3 }
    };

    // ana: baş tarafı rengi, ikincil: kuyruk tarafı; desen: sırt baklavaları; goz: göz rengi.
    // Orman Yeşili renk vermez: yılan eski (pişmiş) yeşil görünümünde kalır.
    // Fiyatlar Kül kazancına göre: ortalama bir oyun ~30-80 Kül (skor x mod ağırlığı + 2).
    const SKINS = [
        { id: 'orman', ad: 'Orman Yeşili', nadir: 'yaygin', fiyat: 0, efekt: 'yaprak', acik: 'Başlangıç kostümü. Pullardan süzülen yapraklar.' },
        { id: 'kul', ad: 'Kül Jarlı', nadir: 'yaygin', fiyat: 100, ana: '#9a9ca6', ikincil: '#3a3c46', desen: 'rgba(255,150,70,0.92)', goz: '#ff8a3d', efekt: 'kivilcim', acik: 'Sönmüş ocağın külü; arkasında kıvılcım izi.' },
        { id: 'tas', ad: 'Taş Kuşak', nadir: 'yaygin', fiyat: 120, ana: '#b49a76', ikincil: '#54463a', desen: 'rgba(235,215,165,0.9)', goz: '#e8d27a', efekt: 'toz', acik: 'Dağ taşı pullar; kırıntı ve toz bırakır.' },
        { id: 'buz', ad: 'Buz Ejderi', nadir: 'nadir', fiyat: 320, ana: '#9be8ff', ikincil: '#2b6fb0', desen: 'rgba(255,255,255,0.92)', goz: '#e6fbff', efekt: 'kristal', acik: 'Donmuş fiyortların soğuğu; kristal yağar.' },
        { id: 'run', ad: 'Rün Işığı', nadir: 'nadir', fiyat: 380, ana: '#4a74e8', ikincil: '#1c2a66', desen: 'rgba(130,255,242,0.95)', goz: '#9dfff4', efekt: 'run', acik: 'Başının çevresinde dönen rün halkası.' },
        { id: 'kizil', ad: 'Kızıl Kuyruklu', nadir: 'nadir', fiyat: 440, ana: '#e8502e', ikincil: '#6b1410', desen: 'rgba(255,218,100,0.92)', goz: '#fff1a0', efekt: 'ates', acik: 'Kuyruğu yanan bir kuyruklu yıldız.' },
        { id: 'gul', ad: 'Çürük Gül', nadir: 'nadir', fiyat: 500, ana: '#a866cc', ikincil: '#47602c', desen: 'rgba(224,255,150,0.88)', goz: '#d4ff7a', efekt: 'spor', acik: 'Bataklıkta açan gül; spor bulutu salar.' },
        { id: 'gece', ad: 'Gece Kuşağı', nadir: 'epik', fiyat: 900, ana: '#5a48ac', ikincil: '#0f0c26', desen: 'rgba(196,176,255,0.92)', goz: '#d9ccff', efekt: 'sis', acik: 'Gölge sisine gömülü bir kuşak.' },
        { id: 'firtina', ad: 'Fırtına Skaldı', nadir: 'epik', fiyat: 1100, ana: '#33498a', ikincil: '#0e1330', desen: 'rgba(255,240,130,0.95)', goz: '#fff7b0', efekt: 'simsek', acik: 'Gövdesinde çatırdayan şimşekler.' },
        { id: 'aurora', ad: 'Kuzey Işığı', nadir: 'epik', fiyat: 1300, ana: '#3dffb4', ikincil: '#8a4dff', desen: 'rgba(255,255,255,0.88)', goz: '#e8fff6', efekt: 'aurora', acik: 'Yeşilden mora akan gökyüzü şeritleri.' },
        { id: 'ouroboros', ad: 'Altın Ouroboros', nadir: 'efsane', fiyat: 2600, ana: '#f6c744', ikincil: '#a8661a', desen: 'rgba(255,255,232,0.96)', goz: '#fffbe0', efekt: 'altin', acik: 'Kendi kuyruğunu yiyen kadim altın; toz ve halka.' },
        { id: 'yildiz', ad: 'Yıldız Yutan', nadir: 'efsane', fiyat: 3800, ana: '#4658c8', ikincil: '#10123a', desen: 'rgba(255,255,255,0.94)', goz: '#ffffff', efekt: 'yildiz', acik: 'Gökyüzünü yutan yılan; arkasında yıldız izi.' }
    ];

    // ---------- renk yardımcıları ----------
    function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
    function karis(a, b, k) { return a.map((v, i) => v + (b[i] - v) * k); }
    // k<0 koyultur, k>0 açar
    function tonla(c, k) { return c.map(v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)))); }
    const css = c => 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';

    // Çizim nesnesi (Gfx25'in kullandığı): pal(k) baştan (0) kuyruğa (1) renk kademesi
    const cizimOnbellek = {};
    function cizimNesnesi(s) {
        if (!s || !s.ana) return null;
        if (cizimOnbellek[s.id]) return cizimOnbellek[s.id];
        const A = hexRgb(s.ana), B = hexRgb(s.ikincil);
        const palCache = {};
        const o = {
            id: s.id,
            desen: s.desen,
            goz: s.goz,
            bas: css(karis(A, B, 0.04)),
            pal(k) {
                const q = Math.round(Math.max(0, Math.min(1, k)) * 12) / 12;
                let p = palCache[q];
                if (!p) {
                    const m = karis(A, B, q);
                    p = palCache[q] = { q, hi: css(tonla(m, 0.42)), mid: css(m), lo: css(tonla(m, -0.58)), alt: css(tonla(m, -0.14)) };
                }
                return p;
            }
        };
        cizimOnbellek[s.id] = o;
        return o;
    }

    // ---------- kayıt ----------
    function bos() { return { sahip: [VARSAYILAN], giyili: VARSAYILAN, bilinmeyen: [], tema: undefined }; }
    let durum = bos();
    const tanim = id => SKINS.find(s => s.id === id) || null;

    function kaydet() {
        const o = { v: 1, sahip: durum.sahip.concat(durum.bilinmeyen), giyili: durum.giyili };
        if (durum.tema !== undefined) o.tema = durum.tema; // sonraki aşama: temaya dokunma, koru
        try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
    }

    function yukle() {
        durum = bos();
        let ham = null;
        try { ham = JSON.parse(localStorage.getItem(KEY)); } catch (e) { ham = null; }
        if (!ham || typeof ham !== 'object' || Array.isArray(ham)) {
            try { if (ham !== null) localStorage.removeItem(KEY); } catch (e) {}
            return;
        }
        if (Array.isArray(ham.sahip)) {
            ham.sahip.forEach(id => {
                if (typeof id !== 'string' || id.length > 40) return;
                if (tanim(id)) { if (!durum.sahip.includes(id)) durum.sahip.push(id); }
                else if (!durum.bilinmeyen.includes(id) && durum.bilinmeyen.length < 100) durum.bilinmeyen.push(id); // yeni sürüm kostümü: silme
            });
        }
        if (typeof ham.giyili === 'string' && durum.sahip.includes(ham.giyili)) durum.giyili = ham.giyili;
        if (ham.tema !== undefined) durum.tema = ham.tema;
    }

    // ---------- işlemler ----------
    const owned = id => durum.sahip.includes(id);
    const balance = () => (typeof Miras !== 'undefined' && Miras.bakiye ? Miras.bakiye() : 0);
    function canAfford(id) { const s = tanim(id); return !!s && !owned(id) && balance() >= s.fiyat; }
    // Bakiyesi yetip henüz alınmamış en ucuz kostüm var mı (oyun sonu ipucu için)
    function affordableNew() { return SKINS.some(s => canAfford(s.id)); }

    function buy(id) {
        const s = tanim(id);
        if (!s || owned(id)) return false;
        if (typeof Miras === 'undefined' || !Miras.harca || balance() < s.fiyat) return false;
        if (s.fiyat > 0 && !Miras.harca(s.fiyat)) return false;
        durum.sahip.push(id);
        kaydet();
        return true;
    }
    function equip(id) {
        if (!tanim(id) || !owned(id)) return false;
        durum.giyili = id;
        kaydet();
        return true;
    }
    function reset() { durum = bos(); try { localStorage.removeItem(KEY); } catch (e) {} }
    const equipped = () => durum.giyili;

    // Çizimde kullanılacak skin: renk körü açıkken ya da varsayılan yeşilde null (eski görünüm)
    function skinFor(o) {
        o = o || {};
        if (o.cb) return null;
        try { return cizimNesnesi(tanim(durum.giyili)); } catch (e) { return null; }
    }
    // Efekt yalnız: hareket azaltılmamış, fx > 0, renk körü kapalı
    function fxOn(o) { o = o || {}; return !o.reduced && !o.cb && (o.fx === undefined || o.fx > 0); }

    // ====================================================================
    // EFEKTLER
    // Parçacık havuzu sabit 40; her efekt kendi üretici (uret) ve çizicisini (ciz) taşır.
    // Koordinatlar tuval pikseli. b: { bas:{x,y}, yon:{x,y}, govde:[{x,y}...], dt, t, uret }
    // ====================================================================
    const rnd = (a, b) => a + Math.random() * (b - a);
    const solma = u => (u < 0.12 ? u / 0.12 : 1 - (u - 0.12) / 0.88); // hızlı belir, yavaş sön

    // gövde üzerinde f (0..1) oranında nokta
    function gNokta(b, f, out) {
        const g = b.govde, n = g.length;
        if (n === 0) { out.x = b.bas.x; out.y = b.bas.y; return out; }
        const x = Math.max(0, Math.min(1, f)) * (n - 1), i = Math.floor(x), k = x - i;
        const p = g[i], q = g[Math.min(n - 1, i + 1)];
        out.x = p.x + (q.x - p.x) * k; out.y = p.y + (q.y - p.y) * k;
        return out;
    }
    const tmp = { x: 0, y: 0 };

    function yildiz4(ctx, x, y, r) {
        ctx.beginPath();
        ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.28, y - r * 0.28); ctx.lineTo(x + r, y); ctx.lineTo(x + r * 0.28, y + r * 0.28);
        ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.28, y + r * 0.28); ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.28, y - r * 0.28);
        ctx.closePath(); ctx.fill();
    }

    const EFEKT = {
        // Yaprak: pullardan süzülen küçük yapraklar
        yaprak: {
            hiz: 2.6,
            uret(p, b) {
                gNokta(b, Math.random(), tmp); p.x = tmp.x; p.y = tmp.y - 2;
                p.vx = rnd(-9, 9); p.vy = rnd(6, 15); p.ay = 0; p.a = rnd(0, TAU); p.w = rnd(-3, 3);
                p.bo = rnd(2.6, 3.8); p.ol = rnd(1.5, 2.3); p.c = rnd(0, 1);
            },
            ciz(ctx, p, u) {
                ctx.globalAlpha = solma(u) * 0.9;
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
                ctx.fillStyle = 'hsl(' + (96 + p.c * 40) + ',62%,' + (38 + p.c * 14) + '%)';
                ctx.beginPath(); ctx.ellipse(0, 0, p.bo, p.bo * 0.46, 0, 0, TAU); ctx.fill();
                ctx.strokeStyle = 'rgba(20,60,20,0.55)'; ctx.lineWidth = 0.6;
                ctx.beginPath(); ctx.moveTo(-p.bo, 0); ctx.lineTo(p.bo, 0); ctx.stroke();
                ctx.restore();
            }
        },
        // Kıvılcım: kuyruk tarafından yükselen sıcak kıvılcımlar
        kivilcim: {
            hiz: 15, karisim: 'lighter',
            uret(p, b) {
                gNokta(b, 0.25 + 0.75 * Math.random(), tmp); p.x = tmp.x + rnd(-3, 3); p.y = tmp.y;
                p.vx = rnd(-16, 16); p.vy = rnd(-48, -18); p.ay = 40; p.bo = rnd(1, 1.9); p.ol = rnd(0.45, 0.95);
            },
            ciz(ctx, p, u) {
                ctx.globalAlpha = (1 - u) * (0.6 + 0.4 * Math.sin(u * 40 + p.x));
                ctx.fillStyle = u < 0.3 ? '#fff2c0' : u < 0.65 ? '#ff9d3a' : '#e0432a';
                ctx.fillRect(p.x - p.bo / 2, p.y - p.bo / 2, p.bo, p.bo);
            }
        },
        // Toz: taş kırıntıları düşer, ara sıra toz bulutu
        toz: {
            hiz: 8,
            uret(p, b) {
                gNokta(b, Math.random(), tmp); p.x = tmp.x + rnd(-3, 3); p.y = tmp.y;
                p.tip = Math.random() < 0.7 ? 0 : 1;
                p.vx = rnd(-10, 10); p.vy = rnd(-14, -3); p.ay = 110; p.a = rnd(0, TAU); p.w = rnd(-6, 6);
                p.bo = p.tip ? rnd(3, 5) : rnd(1.2, 2.6); p.ol = p.tip ? rnd(0.7, 1.1) : rnd(0.7, 1.0); p.c = rnd(0, 1);
            },
            ciz(ctx, p, u) {
                if (p.tip) {
                    ctx.globalAlpha = (1 - u) * 0.22; ctx.fillStyle = '#b8a688';
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.bo * (1 + u * 1.4), 0, TAU); ctx.fill();
                    return;
                }
                ctx.globalAlpha = Math.min(1, (1 - u) * 1.4);
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
                ctx.fillStyle = p.c < 0.5 ? '#8b7556' : '#c2ae8a';
                ctx.fillRect(-p.bo / 2, -p.bo / 2, p.bo, p.bo * 0.8);
                ctx.restore();
            }
        },
        // Kristal: gövdenin üstünden yağan altı kollu buz kristalleri
        kristal: {
            hiz: 9, karisim: 'lighter',
            uret(p, b) {
                gNokta(b, Math.random(), tmp); p.x = tmp.x + rnd(-8, 8); p.y = tmp.y - rnd(8, 17);
                p.vx = rnd(-5, 5); p.vy = rnd(24, 42); p.ay = 0; p.a = rnd(0, TAU); p.w = rnd(-2, 2);
                p.bo = rnd(2.6, 4.2); p.ol = rnd(0.8, 1.3);
            },
            ciz(ctx, p, u) {
                ctx.globalAlpha = solma(u) * 0.95;
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
                ctx.strokeStyle = '#d8f5ff'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
                ctx.beginPath();
                for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3, c = Math.cos(a) * p.bo, s = Math.sin(a) * p.bo; ctx.moveTo(-c, -s); ctx.lineTo(c, s); }
                ctx.stroke();
                ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 0.9, 0, TAU); ctx.fill();
                ctx.restore();
            }
        },
        // Rün: başın çevresinde dönen rünler ve kesikli halka
        run: {
            hiz: 3.2, karisim: 'lighter',
            uret(p, b, n) {
                if (n.orbit >= 4) { p.ol = 0; return; }
                p.tip = 1; p.a = rnd(0, TAU); p.w = 2.1; p.bo = Math.floor(rnd(0, 4)); p.ol = 2.4; p.vx = p.vy = p.ay = 0;
                p.x = b.bas.x; p.y = b.bas.y;
            },
            baslangic(P, b, ekle) { // halka: tek, uzun ömürlü
                if (!P.some(p => p.canli && p.tip === 2)) ekle(q => { q.tip = 2; q.ol = 3.2; q.a = 0; q.w = 0.8; q.vx = q.vy = q.ay = 0; q.bo = 0; });
            },
            guncelle(p, b, dt) {
                p.a += p.w * dt;
                const r = p.tip === 2 ? 15 : 14 + Math.sin(p.yas * 3) * 1.5;
                p.x = b.bas.x + Math.cos(p.a) * r; p.y = b.bas.y + Math.sin(p.a) * r * 0.55 - 2;
            },
            ciz(ctx, p, u, b) {
                if (p.tip === 2) {
                    ctx.globalAlpha = solma(u) * 0.55; ctx.strokeStyle = '#7ffcf0'; ctx.lineWidth = 1;
                    ctx.setLineDash([3, 4]); ctx.lineDashOffset = -p.a * 12;
                    ctx.beginPath(); ctx.ellipse(b.bas.x, b.bas.y - 2, 15, 15 * 0.55, 0, 0, TAU); ctx.stroke();
                    ctx.setLineDash([]);
                    return;
                }
                ctx.globalAlpha = solma(u);
                ctx.save(); ctx.translate(p.x, p.y);
                ctx.strokeStyle = '#9dfff4'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
                ctx.beginPath();
                const k = p.bo;
                if (k === 0) { ctx.moveTo(-1.5, -3); ctx.lineTo(-1.5, 3); ctx.moveTo(-1.5, -3); ctx.lineTo(2, -1); ctx.lineTo(-1.5, 1); }
                else if (k === 1) { ctx.moveTo(-1.5, -3); ctx.lineTo(-1.5, 3); ctx.moveTo(-1.5, 0); ctx.lineTo(2, -3); ctx.moveTo(-1.5, 0); ctx.lineTo(2, 3); }
                else if (k === 2) { ctx.moveTo(-2, -3); ctx.lineTo(2, 3); ctx.moveTo(2, -3); ctx.lineTo(-2, 3); }
                else { ctx.moveTo(0, -3); ctx.lineTo(0, 3); ctx.moveTo(-2.5, -0.5); ctx.lineTo(0, -3); ctx.lineTo(2.5, -0.5); }
                ctx.stroke();
                ctx.restore();
            }
        },
        // Ateş: kuyruk boyunca yükselen ve sönen alevler
        ates: {
            hiz: 26, karisim: 'lighter',
            uret(p, b) {
                gNokta(b, 0.5 + 0.5 * Math.random(), tmp); p.x = tmp.x + rnd(-3, 3); p.y = tmp.y;
                p.vx = rnd(-7, 7); p.vy = rnd(-32, -10); p.ay = 0; p.bo = rnd(3, 5.2); p.ol = rnd(0.45, 0.85);
            },
            ciz(ctx, p, u) {
                const r = p.bo * (1 - u * 0.7);
                ctx.globalAlpha = (1 - u) * 0.8;
                ctx.fillStyle = u < 0.25 ? '#fff0a0' : u < 0.6 ? '#ff8a2a' : '#c02a14';
                ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
            }
        },
        // Spor: yavaş yükselen soluk mor-yeşil bulutlar ve parlayan sporlar
        spor: {
            hiz: 5,
            uret(p, b) {
                gNokta(b, Math.random(), tmp); p.x = tmp.x + rnd(-4, 4); p.y = tmp.y - 2;
                p.tip = Math.random() < 0.65 ? 0 : 1;
                p.vx = rnd(-5, 5); p.vy = p.tip ? rnd(-14, -5) : rnd(-9, -3); p.ay = 0;
                p.bo = p.tip ? rnd(1, 1.7) : rnd(5, 9); p.ol = p.tip ? rnd(1.2, 2) : rnd(1.6, 2.4); p.a = rnd(0, TAU);
            },
            ciz(ctx, p, u) {
                if (p.tip) {
                    ctx.globalAlpha = solma(u); ctx.fillStyle = '#dcff8c';
                    ctx.beginPath(); ctx.arc(p.x + Math.sin(p.yas * 4 + p.a) * 2, p.y, p.bo, 0, TAU); ctx.fill();
                    return;
                }
                const r = p.bo * (1 + u * 0.6);
                ctx.globalAlpha = solma(u) * 0.22; ctx.fillStyle = '#9fd05a';
                ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
                ctx.globalAlpha = solma(u) * 0.16; ctx.fillStyle = '#b070d8';
                ctx.beginPath(); ctx.arc(p.x + r * 0.2, p.y - r * 0.15, r * 0.6, 0, TAU); ctx.fill();
            }
        },
        // Sis: gövdeye yapışık koyu gölge bulutları ve soluk gözler
        sis: {
            hiz: 6.5,
            uret(p, b) {
                gNokta(b, Math.random(), tmp); p.x = tmp.x + rnd(-3, 3); p.y = tmp.y + rnd(-2, 3);
                p.tip = Math.random() < 0.8 ? 0 : 1;
                p.vx = rnd(-5, 5); p.vy = p.tip ? rnd(-16, -8) : rnd(-4, 3); p.ay = 0;
                p.bo = p.tip ? rnd(1, 1.6) : rnd(7, 12); p.ol = p.tip ? rnd(0.9, 1.5) : rnd(1.4, 2.2);
            },
            ciz(ctx, p, u) {
                if (p.tip) {
                    ctx.globalAlpha = solma(u) * 0.9; ctx.fillStyle = '#d2c2ff';
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.bo, 0, TAU); ctx.fill();
                    return;
                }
                const r = p.bo * (1 + u * 0.8);
                ctx.globalAlpha = solma(u) * 0.42; ctx.fillStyle = '#120a28';
                ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
                ctx.globalAlpha = solma(u) * 0.14; ctx.fillStyle = '#7a4ed0';
                ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.35, 0, TAU); ctx.fill();
            }
        },
        // Şimşek: gövdeden kısa, çatallı yıldırımlar
        simsek: {
            hiz: 6, karisim: 'lighter',
            uret(p, b) {
                gNokta(b, Math.random(), tmp); p.x = tmp.x; p.y = tmp.y;
                const a = rnd(0, TAU), L = rnd(10, 18);
                p.a = a; p.bo = L; p.vx = p.vy = p.ay = 0; p.ol = rnd(0.14, 0.26);
                // 4 kırık noktası (yanal sapma), p.z içine
                if (!p.z) p.z = [0, 0, 0, 0];
                for (let i = 0; i < 4; i++) p.z[i] = rnd(-3.2, 3.2);
            },
            ciz(ctx, p, u) {
                const c = Math.cos(p.a), s = Math.sin(p.a);
                const pts = [];
                for (let i = 0; i <= 4; i++) {
                    const d = p.bo * i / 4, off = i === 0 ? 0 : p.z[i - 1];
                    pts.push(p.x + c * d - s * off, p.y + s * d + c * off);
                }
                ctx.globalAlpha = (1 - u) * 0.95;
                ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.strokeStyle = '#8fb8ff'; ctx.lineWidth = 2.4;
                ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke();
                ctx.strokeStyle = '#fff8c4'; ctx.lineWidth = 0.9;
                ctx.stroke();
            }
        },
        // Aurora: renk değiştiren, dalgalı yükselen gökyüzü şeritleri
        aurora: {
            hiz: 7.5, karisim: 'lighter',
            uret(p, b) {
                gNokta(b, Math.random(), tmp); p.x = tmp.x + rnd(-3, 3); p.y = tmp.y - 3;
                p.vx = rnd(-3, 3); p.vy = rnd(-18, -8); p.ay = 0; p.c = Math.random(); p.a = rnd(0, TAU);
                p.bo = rnd(8, 14); p.ol = rnd(1.4, 2.3);
            },
            ciz(ctx, p, u) {
                ctx.globalAlpha = solma(u) * 0.6;
                ctx.strokeStyle = 'hsl(' + Math.round(140 + p.c * 140) + ',90%,62%)';
                ctx.lineWidth = 2.2; ctx.lineCap = 'round';
                const L = p.bo * (0.5 + u * 0.7);
                ctx.beginPath(); ctx.moveTo(p.x, p.y);
                for (let i = 1; i <= 4; i++) ctx.lineTo(p.x + Math.sin(p.a + p.yas * 3 + i * 1.1) * 3.2, p.y - L * i / 4);
                ctx.stroke();
            }
        },
        // Altın: parıldayan altın tozu ve baştan yayılan halkalar
        altin: {
            hiz: 16, karisim: 'lighter',
            uret(p, b, n) {
                if (Math.random() < 0.07 && n.halka < 1) { // halka
                    p.tip = 1; p.x = b.bas.x; p.y = b.bas.y - 2; p.vx = p.vy = p.ay = 0; p.ol = 0.9; p.bo = 5; return;
                }
                p.tip = 0;
                gNokta(b, Math.random(), tmp); p.x = tmp.x + rnd(-4, 4); p.y = tmp.y + rnd(-4, 2);
                p.vx = rnd(-10, 10); p.vy = rnd(-14, 6); p.ay = 0; p.bo = rnd(1.2, 2.6); p.ol = rnd(0.8, 1.5); p.a = rnd(0, TAU);
            },
            ciz(ctx, p, u) {
                if (p.tip) {
                    ctx.globalAlpha = (1 - u) * 0.7; ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 1.3;
                    ctx.beginPath(); ctx.ellipse(p.x, p.y, 6 + u * 22, (6 + u * 22) * 0.55, 0, 0, TAU); ctx.stroke();
                    return;
                }
                ctx.globalAlpha = Math.max(0, Math.sin(u * Math.PI)) * (0.6 + 0.4 * Math.sin(p.yas * 22 + p.a));
                ctx.fillStyle = u < 0.5 ? '#ffe9a0' : '#f2b840';
                yildiz4(ctx, p.x, p.y, p.bo * 1.5);
            }
        },
        // Yıldız: kuyruğun ardında kalan parlak yıldızlar; seyrek akan yıldız
        yildiz: {
            hiz: 13, karisim: 'lighter',
            uret(p, b) {
                if (Math.random() < 0.05) { // akan yıldız
                    gNokta(b, Math.random(), tmp); p.tip = 1; p.x = tmp.x - 14; p.y = tmp.y - 16; p.vx = 90; p.vy = 58; p.ay = 0; p.bo = 7; p.ol = 0.5; p.c = 0; return;
                }
                p.tip = 0;
                gNokta(b, 0.3 + 0.7 * Math.random(), tmp); p.x = tmp.x + rnd(-6, 6); p.y = tmp.y + rnd(-6, 4);
                p.vx = rnd(-2, 2); p.vy = rnd(-3, 2); p.ay = 0; p.bo = rnd(1.4, 3); p.ol = rnd(1.4, 2.6); p.c = Math.floor(rnd(0, 4)); p.a = rnd(0, TAU);
            },
            ciz(ctx, p, u) {
                if (p.tip) {
                    ctx.globalAlpha = (1 - u) * 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.09, p.y - p.vy * 0.09); ctx.stroke();
                    return;
                }
                ctx.globalAlpha = Math.max(0, Math.sin(u * Math.PI)) * (0.7 + 0.3 * Math.sin(p.yas * 14 + p.a));
                ctx.fillStyle = ['#ffffff', '#9ec9ff', '#ffb8e6', '#fff1a8'][p.c];
                yildiz4(ctx, p.x, p.y, p.bo * 1.6);
            }
        }
    };

    // Efekt örneği: kendi havuzu var (oyun için bir, her önizleme için bir)
    function efektKur(id) {
        const s = tanim(id), ef = s && EFEKT[s.efekt];
        const P = [];
        for (let i = 0; i < MAX_PARCA; i++) P.push({ canli: false, x: 0, y: 0, vx: 0, vy: 0, ay: 0, a: 0, w: 0, bo: 1, ol: 1, yas: 0, c: 0, tip: 0, z: null });
        let sayi = 0, acc = 0;
        const sayac = { orbit: 0, halka: 0 };
        function ekle(doldur, b) {
            if (sayi >= MAX_PARCA) return false;
            for (let i = 0; i < MAX_PARCA; i++) {
                const p = P[i];
                if (p.canli) continue;
                p.canli = true; p.yas = 0; p.tip = 0; p.w = 0; p.ay = 0;
                doldur(p, b, sayac);
                if (!(p.ol > 0)) { p.canli = false; return false; }
                sayi++;
                return true;
            }
            return false;
        }
        const o = {
            get sayi() { return sayi; },
            get var() { return !!ef; },
            temizle() { for (let i = 0; i < MAX_PARCA; i++) P[i].canli = false; sayi = 0; acc = 0; },
            // dt saniye; b.uret false ise yeni parçacık eklenmez (duraklatma, fx kapalı)
            adim(b) {
                if (!ef) return;
                const dt = Math.max(0, Math.min(0.05, b.dt || 0));
                sayac.orbit = 0; sayac.halka = 0;
                for (let i = 0; i < MAX_PARCA; i++) {
                    const p = P[i];
                    if (!p.canli) continue;
                    p.yas += dt;
                    if (p.yas >= p.ol) { p.canli = false; sayi--; continue; }
                    if (ef.guncelle) ef.guncelle(p, b, dt);
                    else {
                        p.vy += p.ay * dt;
                        p.x += p.vx * dt; p.y += p.vy * dt;
                        p.a += p.w * dt;
                    }
                    if (p.tip === 1 && s.efekt === 'run') sayac.orbit++;
                    if (p.tip === 1 && s.efekt === 'altin') sayac.halka++;
                }
                if (b.uret === false || !b.bas) return;
                if (ef.baslangic) ef.baslangic(P, b, f => ekle(f, b));
                acc += dt * ef.hiz * (b.yogunluk === undefined ? 1 : b.yogunluk);
                let guard = 4;
                while (acc >= 1 && guard-- > 0) { acc -= 1; ekle(ef.uret, b); }
                if (acc > 2) acc = 0;
            },
            ciz(ctx, b) {
                if (!ef || sayi === 0) return;
                ctx.save();
                if (ef.karisim) ctx.globalCompositeOperation = ef.karisim;
                for (let i = 0; i < MAX_PARCA; i++) {
                    const p = P[i];
                    if (!p.canli) continue;
                    ef.ciz(ctx, p, p.yas / p.ol, b);
                }
                ctx.restore();
            }
        };
        return o;
    }

    // ---------- oyun entegrasyonu: tek örnek, hücre konumlarından px'e çevirerek ----------
    let oyunEfekt = null, oyunEfektId = '', sonT = null;
    const govdeTamponu = [];
    const basTamponu = { x: 0, y: 0 };
    const yonTamponu = { x: 1, y: 0 };
    const bTampon = { bas: basTamponu, yon: yonTamponu, govde: govdeTamponu, dt: 0, t: 0, uret: true, yogunluk: 1 };
    const YUKSEKLIK = 5; // gövde/baş yerden yüksekliği (px), Gfx25 ile yakın

    // o: { pts:[{x,y} hücre], S, t (sn), aktif, cb, reduced, fx, yon:{x,y} }
    // Ctx üzerine, yılanın üstüne çizilir. Kapalıysa hiçbir şey yapmaz ve havuzu boşaltır.
    function efekt(ctx, o) {
        try {
            if (!o || !fxOn(o) || !o.pts || !o.pts.length) { if (oyunEfekt) oyunEfekt.temizle(); sonT = null; return 0; }
            const id = durum.giyili;
            if (!oyunEfekt || oyunEfektId !== id) { oyunEfekt = efektKur(id); oyunEfektId = id; sonT = null; }
            const S = o.S || 20, pts = o.pts;
            while (govdeTamponu.length < pts.length) govdeTamponu.push({ x: 0, y: 0 });
            govdeTamponu.length = pts.length;
            for (let i = 0; i < pts.length; i++) { govdeTamponu[i].x = pts[i].x * S + S / 2; govdeTamponu[i].y = pts[i].y * S + S / 2 - YUKSEKLIK; }
            basTamponu.x = govdeTamponu[0].x; basTamponu.y = govdeTamponu[0].y;
            if (o.yon) { yonTamponu.x = o.yon.x; yonTamponu.y = o.yon.y; }
            const dt = sonT === null ? 0 : Math.min(0.1, Math.max(0, o.t - sonT));
            sonT = o.t;
            bTampon.dt = dt; bTampon.t = o.t; bTampon.uret = o.aktif !== false;
            bTampon.yogunluk = o.fx === undefined ? 1 : Math.min(1.5, o.fx);
            oyunEfekt.adim(bTampon);
            oyunEfekt.ciz(ctx, bTampon);
            return oyunEfekt.sayi;
        } catch (e) { return 0; }
    }
    function efektSifirla() { if (oyunEfekt) oyunEfekt.temizle(); sonT = null; }

    // ====================================================================
    // ÖNİZLEME: market kartlarındaki küçük tuvaller (canlı efektli)
    // ====================================================================
    const PW = 208, PH = 76, PN = 9;
    let onizlemeler = [], onizlemeRaf = 0, onizlemeZamanlayici = 0;

    // t anındaki dalgalı yılan: hücre (pts) ve px (govde) konumları
    function onizleKonum(o, t) {
        const S = 20;
        for (let i = 0; i < PN; i++) {
            const x = 8.6 - i * 0.82, y = 1.55 + Math.sin(t * 2.6 - i * 0.85) * 0.5 * (1 - i * 0.025);
            o.pts[i].x = x; o.pts[i].y = y;
            o.govde[i].x = x * S + S / 2; o.govde[i].y = y * S + S / 2 - YUKSEKLIK;
        }
    }
    function onizleKare(o, t, dt) {
        const ctx = o.ctx, S = 20;
        onizleKonum(o, t);
        o.b.bas = o.govde[0]; o.b.govde = o.govde; o.b.dt = dt; o.b.t = t; o.b.uret = true;
        if (o.ef) o.ef.adim(o.b);
        ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
        ctx.clearRect(0, 0, PW, PH);
        const G = (typeof Gfx25 !== 'undefined') ? Gfx25 : null;
        const dir = { x: 1, y: 0 };
        const opts = { CELL: S, W: PW, H: PH, cb: false, pal: null, reduced: false, skin: o.skin, all: o.pts };
        let ciz = false;
        if (G && G.drawSnakeRibbon) {
            try { ciz = G.drawSnakeRibbon(ctx, o.pts, dir, t, opts); if (ciz) G.drawSnakeHead(ctx, o.pts[0], dir, t, opts); } catch (e) { ciz = false; }
        }
        if (!ciz) { // Gfx25 yoksa basit şerit
            ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = o.skin ? o.skin.pal(0.3).mid : '#13c27a'; ctx.lineWidth = 14;
            ctx.beginPath(); o.govde.forEach((p, i) => { i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.stroke();
        }
        if (o.ef) o.ef.ciz(ctx, o.b);
    }

    // liste: [{canvas, id}], ayar: { reduced, fx }. Hareket azaltılmış ya da fx kapalıysa tek durağan kare.
    function onizleBaslat(liste, ayar) {
        onizleDurdur();
        ayar = ayar || {};
        const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
        const dinamik = fxOn({ reduced: ayar.reduced, fx: ayar.fx });
        onizlemeler = liste.map(it => {
            const c = it.canvas;
            c.width = Math.round(PW * dpr); c.height = Math.round(PH * dpr);
            const o = { ctx: c.getContext('2d'), dpr, skin: cizimNesnesi(tanim(it.id)), ef: null, pts: [], govde: [],
                b: { bas: null, yon: { x: 1, y: 0 }, govde: null, dt: 0, t: 0, uret: true, yogunluk: 1 } };
            for (let i = 0; i < PN; i++) { o.pts.push({ x: 0, y: 0 }); o.govde.push({ x: 0, y: 0 }); }
            if (dinamik) {
                o.ef = efektKur(it.id);
                for (let k = 0; k < 45; k++) { // ön ısınma: ilk karede parçacıklar hazır olsun
                    onizleKonum(o, k / 30);
                    o.b.bas = o.govde[0]; o.b.govde = o.govde; o.b.dt = 1 / 30; o.b.t = k / 30; o.b.uret = true;
                    o.ef.adim(o.b);
                }
            }
            return o;
        });
        if (!dinamik) { onizlemeler.forEach(o => onizleKare(o, 0.9, 0)); return onizlemeler.length; }
        const t0 = performance.now();
        let son = t0;
        const kare = now => {
            const dt = Math.min(0.05, Math.max(0, (now - son) / 1000)); son = now;
            const t = (now - t0) / 1000 + 1.5;
            for (let i = 0; i < onizlemeler.length; i++) onizleKare(onizlemeler[i], t, dt);
            sonraki();
        };
        // sekme gizliyken seyrek bekle
        const sonraki = () => {
            if (!onizlemeler.length) return;
            if (typeof document !== 'undefined' && document.hidden) onizlemeZamanlayici = setTimeout(() => { onizlemeRaf = requestAnimationFrame(kare); }, 400);
            else onizlemeRaf = requestAnimationFrame(kare);
        };
        sonraki();
        return onizlemeler.length;
    }
    function onizleDurdur() {
        if (onizlemeRaf) { try { cancelAnimationFrame(onizlemeRaf); } catch (e) {} }
        if (onizlemeZamanlayici) { try { clearTimeout(onizlemeZamanlayici); } catch (e) {} }
        onizlemeRaf = 0; onizlemeZamanlayici = 0; onizlemeler = [];
    }
    const onizlemeSayisi = () => onizlemeler.length;

    yukle();

    return {
        SKINS, NADIRLIK, MAX_PARCA, VARSAYILAN,
        load: yukle, reset, buy, equip, owned, equipped, balance, canAfford, affordableNew,
        skinFor, fxOn, efekt, efektSifirla, efektKur, onizleBaslat, onizleDurdur, onizlemeSayisi,
        get: tanim,
        state: () => ({ v: 1, sahip: durum.sahip.slice(), giyili: durum.giyili, tema: durum.tema })
    };
})();
