// Tarayıcı tarafı pişirme kitaplığı (three.js r160, global THREE).
// Prosedürel dokular, ortam haritası, ışık düzeni, kamera ve kare kare saydam PNG çıkışı.
// tools/bake/bake.js bu dosyayı başsız Chromium'a yükler; oyunla paketlenmez.
/* global THREE */
(function () {
    'use strict';
    const T = THREE;
    const PX = 40;      // 1 hücre (20 mantıksal px) = 40 px (2x)
    const SS = 3;       // süper örnekleme (kenar yumuşatma)

    // ---------------- yardımcılar ----------------
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
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const lerp = (a, b, t) => a + (b - a) * t;
    const fract = x => x - Math.floor(x);
    function hash2(i, j, s) {
        let h = (i * 374761393 + j * 668265263 + (s | 0) * 2246822519) >>> 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }

    // Döşenebilir (periyodik) değer gürültüsü + fbm
    function noiseGen(seed) {
        const cache = {};
        const grid = P => {
            if (!cache[P]) { const r = rng(seed * 977 + P * 131); const a = new Float32Array(P * P); for (let i = 0; i < a.length; i++) a[i] = r(); cache[P] = a; }
            return cache[P];
        };
        function sample(P, u, v) {
            const a = grid(P);
            const x = u * P, y = v * P;
            const xi = Math.floor(x), yi = Math.floor(y);
            let fx = x - xi, fy = y - yi;
            fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
            const i0 = ((xi % P) + P) % P, i1 = (i0 + 1) % P, j0 = ((yi % P) + P) % P, j1 = (j0 + 1) % P;
            const a0 = lerp(a[j0 * P + i0], a[j0 * P + i1], fx), a1 = lerp(a[j1 * P + i0], a[j1 * P + i1], fx);
            return lerp(a0, a1, fy);
        }
        function fbm(u, v, oct, base) {
            let s = 0, amp = 0.5, P = base || 4, n = 0;
            for (let o = 0; o < (oct || 5); o++) { s += amp * sample(P, u, v); n += amp; amp *= 0.5; P *= 2; }
            return s / n;
        }
        function ridged(u, v, oct, base) {
            let s = 0, amp = 0.5, P = base || 4, n = 0;
            for (let o = 0; o < (oct || 4); o++) { s += amp * (1 - Math.abs(2 * sample(P, u, v) - 1)); n += amp; amp *= 0.5; P *= 2; }
            return s / n;
        }
        return { sample, fbm, ridged };
    }

    // Yükseklik + renk + pürüz fonksiyonundan renk/normal/pürüz haritası üretir.
    // fn(u,v) -> { h:0..1, c:[r,g,b] 0..1, r:0..1 }
    function mapsFrom(size, fn, strength) {
        const N = size;
        const H = new Float32Array(N * N);
        const col = document.createElement('canvas'); col.width = col.height = N;
        const nor = document.createElement('canvas'); nor.width = nor.height = N;
        const rou = document.createElement('canvas'); rou.width = rou.height = N;
        const ci = col.getContext('2d').createImageData(N, N);
        const ni = nor.getContext('2d').createImageData(N, N);
        const ri = rou.getContext('2d').createImageData(N, N);
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const s = fn((x + 0.5) / N, (y + 0.5) / N);
            const i = y * N + x;
            H[i] = s.h;
            ci.data[i * 4] = clamp(s.c[0], 0, 1) * 255; ci.data[i * 4 + 1] = clamp(s.c[1], 0, 1) * 255; ci.data[i * 4 + 2] = clamp(s.c[2], 0, 1) * 255; ci.data[i * 4 + 3] = 255;
            const r = clamp(s.r, 0, 1) * 255;
            ri.data[i * 4] = r; ri.data[i * 4 + 1] = r; ri.data[i * 4 + 2] = r; ri.data[i * 4 + 3] = 255;
        }
        const k = strength || 2;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const hx = H[y * N + (x + 1) % N] - H[y * N + (x + N - 1) % N];
            const hy = H[((y + 1) % N) * N + x] - H[((y + N - 1) % N) * N + x];
            let nx = -hx * k * N / 64, ny = hy * k * N / 64, nz = 1;   // OpenGL (Y+) normal
            const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
            const i = (y * N + x) * 4;
            ni.data[i] = (nx * 0.5 + 0.5) * 255; ni.data[i + 1] = (ny * 0.5 + 0.5) * 255; ni.data[i + 2] = (nz * 0.5 + 0.5) * 255; ni.data[i + 3] = 255;
        }
        col.getContext('2d').putImageData(ci, 0, 0);
        nor.getContext('2d').putImageData(ni, 0, 0);
        rou.getContext('2d').putImageData(ri, 0, 0);
        return { color: col, normal: nor, rough: rou };
    }

    // ---------------- prosedürel malzeme dokuları ----------------
    const PROC = {
        // Üst üste binen yılan pulları (renk nötr; tonu malzeme rengi verir)
        scales(seed) {
            const n = noiseGen(seed || 3);
            const rows = 8, cols = 8;
            return mapsFrom(256, (u, v) => {
                const sv = v * rows;
                let best = null;
                for (let dr = 0; dr <= 1; dr++) {
                    const row = Math.floor(sv) + dr;
                    const off = (row & 1) ? 0.5 : 0;
                    const su = u * cols - off;
                    for (let dc = -1; dc <= 1; dc++) {
                        const cc = Math.floor(su) + dc;
                        const dx = (su - (cc + 0.5)) / 0.62;
                        const dy = (sv - (row - 0.1)) / 1.02;
                        const d = dx * dx + dy * dy;
                        if (d < 1 && (!best || row > best.row || (row === best.row && d < best.d))) best = { row, d, id: hash2(cc, row, 7), dy };
                    }
                }
                const g = n.fbm(u, v, 4, 16);
                if (!best) return { h: 0, c: [0.45, 0.45, 0.45], r: 0.8 };
                const dome = Math.sqrt(1 - best.d);
                const keel = 1 - Math.min(1, Math.abs(u * cols - Math.round(u * cols - 0.5) - 0.5) * 6) * 0.0;
                const h = dome * 0.85 + g * 0.15 + keel * 0;
                const edge = smooth(0.0, 0.35, dome);
                const tint = 0.78 + best.id * 0.22;
                const c = 0.55 + 0.45 * edge;
                return { h, c: [c * tint, c * tint, c * tint * 0.98], r: 0.32 + (1 - edge) * 0.45 + g * 0.1 };
            }, 3.2);
        },
        // Kaba taş: fbm + ridged çatlak + yosun lekesi
        stone(seed, tint) {
            const n = noiseGen(seed || 11);
            const tc = tint || [0.48, 0.5, 0.58];
            return mapsFrom(256, (u, v) => {
                const b = n.fbm(u, v, 6, 4);
                const cr = n.ridged(u + 0.31, v + 0.17, 4, 3);
                const crack = smooth(0.82, 0.97, cr);
                const pit = smooth(0.62, 0.75, n.fbm(u + 0.5, v, 3, 32));
                const h = b * 0.8 - crack * 0.5 - pit * 0.12;
                const moss = smooth(0.62, 0.74, n.fbm(u + 0.7, v + 0.3, 4, 3)) * (1 - crack);
                const l = 0.55 + b * 0.5 - crack * 0.45;
                let c = [tc[0] * l, tc[1] * l, tc[2] * l];
                c = [lerp(c[0], 0.2, moss * 0.6), lerp(c[1], 0.32, moss * 0.6), lerp(c[2], 0.22, moss * 0.6)];
                return { h, c, r: 0.78 + b * 0.18 + crack * 0.1 };
            }, 4);
        },
        // Dövme demir: ince fbm + çizikler
        iron(seed) {
            const n = noiseGen(seed || 21);
            return mapsFrom(256, (u, v) => {
                const b = n.fbm(u, v, 5, 8);
                const sc = smooth(0.9, 0.98, n.ridged(u * 1.0, v * 0.12 + u * 0.05, 3, 16));
                const h = b * 0.3 - sc * 0.15;
                const l = 0.55 + b * 0.35 + sc * 0.2;
                return { h, c: [l * 0.95, l * 0.96, l], r: 0.38 + b * 0.25 - sc * 0.12 };
            }, 2);
        },
        // Altın: çok hafif dövme dalgası
        gold(seed) {
            const n = noiseGen(seed || 31);
            return mapsFrom(128, (u, v) => {
                const b = n.fbm(u, v, 4, 6);
                return { h: b * 0.25, c: [1, 0.97, 0.9], r: 0.18 + b * 0.18 };
            }, 1.5);
        },
        // Kemik: sıcak kırık beyaz, gözenek
        bone(seed) {
            const n = noiseGen(seed || 41);
            return mapsFrom(128, (u, v) => {
                const b = n.fbm(u, v, 5, 6);
                const pore = smooth(0.7, 0.8, n.fbm(u, v, 2, 48));
                const l = 0.72 + b * 0.3 - pore * 0.2;
                return { h: b * 0.6 - pore * 0.3, c: [l, l * 0.94, l * 0.82], r: 0.6 + pore * 0.2 };
            }, 2.5);
        },
        // Kumaş: dokuma + yıpranma
        cloth(seed) {
            const n = noiseGen(seed || 51);
            return mapsFrom(256, (u, v) => {
                const N = 48;
                const wx = Math.sin(u * N * Math.PI * 2), wy = Math.sin(v * N * Math.PI * 2);
                const weave = ((Math.floor(u * N * 2) + Math.floor(v * N * 2)) & 1) ? wx * 0.5 + 0.5 : wy * 0.5 + 0.5;
                const b = n.fbm(u, v, 5, 4);
                const l = 0.65 + b * 0.4 + weave * 0.1;
                return { h: weave * 0.4 + b * 0.3, c: [l, l, l], r: 0.9 };
            }, 1.4);
        },
        // Ahşap: v boyunca uzamış lifler
        wood(seed) {
            const n = noiseGen(seed || 61);
            return mapsFrom(128, (u, v) => {
                const g = n.fbm(u * 1, v * 0.0625 + u * 0.2, 5, 16);
                const ring = 0.5 + 0.5 * Math.sin((u * 18 + g * 6) * Math.PI);
                const l = 0.45 + ring * 0.25 + g * 0.2;
                return { h: ring * 0.4 + g * 0.4, c: [l * 0.62, l * 0.42, l * 0.25], r: 0.7 };
            }, 2);
        },
        // Elma kabuğu: benekler (lentisel) + hafif dalga
        skin(seed) {
            const n = noiseGen(seed || 71);
            return mapsFrom(128, (u, v) => {
                const b = n.fbm(u, v, 4, 6);
                const sp = smooth(0.78, 0.86, n.sample(40, u, v));
                const l = 0.9 + b * 0.1;
                return { h: b * 0.2 + sp * 0.2, c: [l + sp * 0.1, l + sp * 0.12, l * 0.9 + sp * 0.2], r: 0.3 + b * 0.15 + sp * 0.2 };
            }, 1.2);
        },
        // Çürük: buruşuk, lekeli
        rot(seed) {
            const n = noiseGen(seed || 81);
            return mapsFrom(128, (u, v) => {
                const b = n.fbm(u, v, 6, 4);
                const w = n.ridged(u, v, 4, 6);
                const spot = smooth(0.58, 0.66, n.fbm(u + 0.4, v, 3, 5));
                const l = 0.6 + b * 0.4 - spot * 0.45;
                return { h: w * 0.8 + b * 0.2, c: [l, l * 0.95, l], r: 0.75 + spot * 0.2 };
            }, 3);
        },
        // Kristal iç kırılma: çok hafif bulut
        crystal(seed) {
            const n = noiseGen(seed || 91);
            return mapsFrom(128, (u, v) => {
                const b = n.fbm(u, v, 4, 4);
                const f = smooth(0.85, 0.95, n.ridged(u, v, 3, 4));
                return { h: f * 0.3, c: [0.85 + b * 0.15 + f * 0.2, 0.85 + b * 0.15 + f * 0.2, 0.9 + b * 0.1 + f * 0.2], r: 0.08 + f * 0.25 };
            }, 1);
        }
    };

    // Harici dokuyu atlayan prosedürel takma adlar (düşmanlar: nötr renkli dokuma ve granit)
    PROC.fabric = PROC.cloth;
    PROC.granite = seed => PROC.stone(seed, [0.62, 0.62, 0.66]);

    // ---------------- dokular: harici (ambientCG) varsa onu, yoksa prosedürel ----------------
    const texCache = {};
    function imgTex(src) {
        return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    }
    async function preloadExternal(ext) {
        // ext: { stone: {color, normal, rough}, ... } dataURL
        for (const k of Object.keys(ext || {})) {
            const e = ext[k], o = {};
            for (const m of ['color', 'normal', 'rough']) if (e[m]) o[m] = await imgTex(e[m]);
            if (o.color) texCache['ext:' + k] = o;
        }
    }
    function toTex(src, srgb, rep) {
        const t = new T.Texture(src);
        t.needsUpdate = true;
        t.wrapS = t.wrapT = T.RepeatWrapping;
        t.repeat.set(rep[0], rep[1]);
        t.anisotropy = 8;
        if (srgb) t.colorSpace = T.SRGBColorSpace;
        return t;
    }
    // Bir malzeme ailesinin doku seti: { map, normalMap, roughnessMap, external }
    function texSet(kind, rep, seed) {
        rep = rep || [1, 1];
        const ext = texCache['ext:' + kind];
        const key = kind + '|' + (seed || 0);
        let src;
        if (ext) src = { color: ext.color, normal: ext.normal, rough: ext.rough, ext: true };
        else {
            if (!texCache[key]) texCache[key] = (PROC[kind] || PROC.stone)(seed);
            src = texCache[key];
        }
        const o = { map: toTex(src.color, true, rep), external: !!src.ext };
        if (src.normal) o.normalMap = toTex(src.normal, false, rep);
        if (src.rough) o.roughnessMap = toTex(src.rough, false, rep);
        return o;
    }
    function mat(kind, opts, rep, seed) {
        const ts = texSet(kind, rep, seed);
        const P = opts && (opts.clearcoat || opts.transmission || opts.iridescence || opts.sheen) ? T.MeshPhysicalMaterial : T.MeshStandardMaterial;
        const m = new P(Object.assign({ envMapIntensity: 0.7 }, opts || {}));
        m.map = ts.map;
        if (ts.normalMap) { m.normalMap = ts.normalMap; m.normalScale = new T.Vector2(1, 1).multiplyScalar(opts && opts.ns != null ? opts.ns : 1); }
        if (ts.roughnessMap && !(opts && opts.noRoughMap)) m.roughnessMap = ts.roughnessMap;
        delete m.ns; delete m.noRoughMap;
        return m;
    }

    // ---------------- ortam (prosedürel gradyan HDR yerine) ----------------
    let renderer, pmrem, envRT;
    function envCanvas() {
        const c = document.createElement('canvas'); c.width = 512; c.height = 256;
        const g = c.getContext('2d');
        const gr = g.createLinearGradient(0, 0, 0, 256);
        gr.addColorStop(0, '#b0a290');      // tavan: sıcak gri (meşale yansıması)
        gr.addColorStop(0.42, '#5e6680');   // ufuk üstü: soğuk
        gr.addColorStop(0.5, '#2c3244');
        gr.addColorStop(1, '#07080c');      // zemin: koyu taş
        g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
        // anahtar ışık yönünde yumuşak sıcak pencere + karşı tarafta soğuk kenar
        const blob = (x, y, r, col) => { const b = g.createRadialGradient(x, y, 0, x, y, r); b.addColorStop(0, col); b.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = b; g.fillRect(x - r, y - r, r * 2, r * 2); };
        blob(150, 50, 70, 'rgba(255,214,160,0.95)');
        blob(400, 80, 60, 'rgba(120,170,255,0.6)');
        blob(280, 110, 120, 'rgba(255,140,60,0.18)');
        return c;
    }
    function contactTex() {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        const t = new T.CanvasTexture(c);
        return t;
    }
    let cTex;
    function init() {
        const cv = document.createElement('canvas');
        renderer = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
        renderer.setPixelRatio(1);
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        pmrem = new T.PMREMGenerator(renderer);
        const et = new T.CanvasTexture(envCanvas());
        et.mapping = T.EquirectangularReflectionMapping;
        et.colorSpace = T.SRGBColorSpace;
        envRT = pmrem.fromEquirectangular(et);
        cTex = contactTex();
    }

    // ---------------- sahne: ışıklar, gölge yakalayıcı, kontakt gölgesi ----------------
    function stage(opts) {
        opts = opts || {};
        const scene = new T.Scene();
        scene.environment = envRT.texture;
        const L = opts.light || {};
        // Anahtar: ekranın sol-üstünden sıcak (oyundaki gölge sağ-alta düşer)
        const key = new T.DirectionalLight(L.keyColor || 0xffe0b8, L.key != null ? L.key : 2.4);
        key.position.set(-3.2, 6.5, 1.6);
        key.castShadow = !!opts.shadow;
        key.shadow.mapSize.set(2048, 2048);
        const sc = key.shadow.camera; sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4; sc.near = 0.5; sc.far = 20;
        key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02;
        key.shadow.radius = 6; key.shadow.blurSamples = 16;
        scene.add(key);
        // Dolgu: önden-sağdan soğuk, zayıf
        const fill = new T.DirectionalLight(L.fillColor || 0xa4b2d8, L.fill != null ? L.fill : 1.2);
        fill.position.set(3, 2.2, 4.5);
        scene.add(fill);
        // Kenar: arkadan, silüeti koyu zeminden ayırır
        const rim = new T.DirectionalLight(L.rimColor || 0xbfe6ff, L.rim != null ? L.rim : 2.2);
        rim.position.set(2.5, 3.2, -5.5);
        scene.add(rim);
        const hemi = new T.HemisphereLight(0x8c90b0, 0x141018, L.amb != null ? L.amb : 0.45);
        scene.add(hemi);
        if (opts.shadow) {
            const pl = new T.Mesh(new T.PlaneGeometry(14, 14), new T.ShadowMaterial({ opacity: opts.shadowOpacity || 0.5 }));
            pl.rotation.x = -Math.PI / 2;
            pl.receiveShadow = true;
            scene.add(pl);
        }
        let contact = null;
        if (opts.contact) {
            const c = opts.contact;   // { rx, rz, a, x, z }
            const m = contact = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: cTex, transparent: true, opacity: c.a || 0.6, depthWrite: false, color: 0x000000 }));
            m.rotation.x = -Math.PI / 2;
            m.scale.set(c.rx * 2, c.rz * 2, 1);
            m.position.set(c.x || 0, 0.002, c.z || 0);
            m.renderOrder = -1;
            scene.add(m);
        }
        return { scene, key, fill, rim, hemi, contact };
    }

    // ---------------- kamera + çıkış ----------------
    const PITCH = 62 * Math.PI / 180;   // yerden yükselme açısı (3/4 üstten bakış; models.js ile aynı)
    function camera(w, h, target) {
        const cam = new T.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 50);
        const tg = new T.Vector3(target[0], target[1], target[2]);
        cam.position.set(tg.x, tg.y + Math.sin(PITCH) * 20, tg.z + Math.cos(PITCH) * 20);
        cam.lookAt(tg);
        cam.updateMatrixWorld();
        cam.updateProjectionMatrix();
        return cam;
    }
    // Yüksek çözünürlükte çiz, alan ortalamasıyla 2x'e indir
    function downsample(src, W, H) {
        let cur = src, cw = src.width, ch = src.height;
        while (cw / 2 >= W * 0.999 && cw / 2 >= W) {
            const nw = Math.max(W, Math.round(cw / 2)), nh = Math.max(H, Math.round(ch / 2));
            const c = document.createElement('canvas'); c.width = nw; c.height = nh;
            const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, nw, nh);
            cur = c; cw = nw; ch = nh;
        }
        if (cw !== W || ch !== H) {
            const c = document.createElement('canvas'); c.width = W; c.height = H;
            const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, W, H);
            cur = c;
        }
        return cur;
    }

    // Işıma (bloom) geçişi: yalnız userData.glow malzemeleri renkli, geri kalanı yalnız derinlik yazar
    // (öndeki kumaş/zırh ışığı örter). Sonuç bulanıklaştırılıp kareye 'lighter' ile eklenir.
    const occl = new T.MeshBasicMaterial({ colorWrite: false });
    const glowCache = new Map();
    function glowPass(scene, cam, W, H, bloom) {
        const saved = [];
        scene.traverse(o => {
            if (!o.isMesh) return;
            const m = o.material;
            saved.push([o, m, o.visible]);
            if (m && m.userData && m.userData.glow) {
                let g = glowCache.get(m);
                if (!g) { g = new T.MeshBasicMaterial({ toneMapped: false, side: m.side }); glowCache.set(m, g); }
                const k = Math.min(1.6, (m.emissiveIntensity || 1) / 3);
                g.color.copy(m.emissive).multiplyScalar(k);
                o.material = g;
            } else if (m && (m.transparent || m.isShadowMaterial)) o.visible = false;
            else o.material = occl;
        });
        renderer.render(scene, cam);
        saved.forEach(([o, m, v]) => { o.material = m; o.visible = v; });
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d');
        g.filter = 'blur(' + Math.round(bloom.r * SS) + 'px)';
        g.drawImage(renderer.domElement, 0, 0);
        g.filter = 'blur(' + Math.round(bloom.r * SS * 0.35) + 'px)';
        g.drawImage(renderer.domElement, 0, 0);
        return c;
    }

    // spec: { w, h (hücre), px (hücre başı piksel, vars. 40), target:[x,y,z], anchor:[x,y,z], frames, build(stage, i)->update, bloom:{r,a} }
    async function renderSprite(spec) {
        const P = spec.px || PX;
        const W = Math.round(spec.w * P), H = Math.round(spec.h * P);
        const st = stage(spec.stage);
        const cam = camera(spec.w, spec.h, spec.target || [0, 0, 0]);
        const upd = spec.build(st.scene, st);
        if (spec.lean) st.scene.children.forEach(c => { if (c.isGroup) c.rotation.x += spec.lean; });
        renderer.setSize(W * SS, H * SS, false);
        const n = spec.frames || 1;
        const strip = document.createElement('canvas'); strip.width = W * n; strip.height = H;
        const sg = strip.getContext('2d');
        for (let i = 0; i < n; i++) {
            if (upd) upd(i, n);
            renderer.render(st.scene, cam);
            const big = document.createElement('canvas'); big.width = W * SS; big.height = H * SS;
            const bg = big.getContext('2d');
            bg.drawImage(renderer.domElement, 0, 0);
            if (spec.bloom) {
                const gl = glowPass(st.scene, cam, W * SS, H * SS, spec.bloom);
                bg.globalCompositeOperation = 'lighter';
                bg.globalAlpha = spec.bloom.a || 0.8;
                bg.drawImage(gl, 0, 0);
                bg.globalAlpha = 1; bg.globalCompositeOperation = 'source-over';
            }
            sg.drawImage(downsample(big, W, H), i * W, 0);
        }
        // çapa: dünya noktasının görüntüdeki yeri
        const a = new T.Vector3().fromArray(spec.anchor || [0, 0, 0]).project(cam);
        const ax = (a.x * 0.5 + 0.5) * W, ay = (1 - (a.y * 0.5 + 0.5)) * H;
        // sahneyi bırak
        st.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
        return { png: strip.toDataURL('image/png'), w: W, h: H, n, ax: Math.round(ax * 10) / 10, ay: Math.round(ay * 10) / 10, sc: P / 20, anim: spec.anim || null };
    }

    window.Bake = { init, preloadExternal, renderSprite, mat, texSet, PROC, noiseGen, rng, smooth, lerp, clamp, fract, hash2, PX, T };
})();
