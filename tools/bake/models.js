// Özgün 3B modeller (Nors karanlık fantezi). Birim: 1 = 1 hücre (oyunda 20 px).
// Her kayıt bir sprite şeridi üretir: { w, h, target, anchor, frames, stage, build(scene) -> update(i,n) }
/* global THREE, Bake */
(function () {
    'use strict';
    const T = THREE, B = Bake;
    const TAU = Math.PI * 2;
    const V3 = (x, y, z) => new T.Vector3(x, y, z);
    const V2 = (x, y) => new T.Vector2(x, y);

    // ---------------- geometri yardımcıları ----------------
    // UV dikişinde kopuk olmayan yumuşak normaller (konuma göre birleştirir)
    function smoothNormals(geo) {
        geo.computeVertexNormals();
        const p = geo.attributes.position, n = geo.attributes.normal;
        const map = new Map(), key = i => Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4);
        for (let i = 0; i < p.count; i++) {
            const k = key(i); let a = map.get(k);
            if (!a) { a = [0, 0, 0]; map.set(k, a); }
            a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i);
        }
        for (let i = 0; i < p.count; i++) {
            const a = map.get(key(i)); const l = Math.hypot(a[0], a[1], a[2]) || 1;
            n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
        }
        n.needsUpdate = true;
        return geo;
    }
    function deform(geo, fn, keepNormals) {
        const p = geo.attributes.position, v = new T.Vector3();
        for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, i); p.setXYZ(i, v.x, v.y, v.z); }
        p.needsUpdate = true;
        if (!keepNormals) smoothNormals(geo);
        return geo;
    }
    function mesh(geo, m, o) {
        const me = new T.Mesh(geo, m);
        o = o || {};
        if (o.p) me.position.set(o.p[0], o.p[1], o.p[2]);
        if (o.r) me.rotation.set(o.r[0], o.r[1], o.r[2], o.ro || 'XYZ');
        if (o.s) { if (typeof o.s === 'number') me.scale.setScalar(o.s); else me.scale.set(o.s[0], o.s[1], o.s[2]); }
        me.castShadow = o.cast !== false;
        me.receiveShadow = o.recv !== false;
        return me;
    }
    const sphere = (r, w, h) => new T.SphereGeometry(r, w || 48, h || 32);
    function ellipsoid(rx, ry, rz, w, h) { return sphere(1, w, h).scale(rx, ry, rz); }
    // Uca doğru incelen boru (boynuz, dil, kol)
    function taperTube(points, r0, r1, seg, rad) {
        const curve = new T.CatmullRomCurve3(points.map(p => V3(p[0], p[1], p[2])));
        const geo = new T.TubeGeometry(curve, seg || 24, 1, rad || 12, false);
        const p = geo.attributes.position, uv = geo.attributes.uv;
        const tmp = new T.Vector3();
        const nSeg = seg || 24, nRad = (rad || 12) + 1;
        for (let i = 0; i <= nSeg; i++) {
            const t = i / nSeg, c = curve.getPointAt(t);
            const r = B.lerp(r0, r1, Math.pow(t, 0.9));
            for (let j = 0; j < nRad; j++) {
                const k = i * nRad + j;
                tmp.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c);
                p.setXYZ(k, tmp.x, tmp.y, tmp.z);
            }
        }
        p.needsUpdate = true;
        geo.computeVertexNormals();
        void uv;
        // uç kapağı
        const g = new T.Group();
        g.add(new T.Mesh(geo));
        return { geo, curve };
    }
    function lathe(prof, seg) { return new T.LatheGeometry(prof.map(p => V2(p[0], p[1])), seg || 48); }
    // Rün çizgileri: 2B parçalar -> ince kutular (yüzeye oyulmuş/ışıyan)
    function runeStrokes(segs, m, w, d) {
        const g = new T.Group();
        segs.forEach(s => {
            const dx = s[2] - s[0], dy = s[3] - s[1], L = Math.hypot(dx, dy);
            const me = new T.Mesh(new T.BoxGeometry(L + w, w, d), m);
            me.position.set((s[0] + s[2]) / 2, (s[1] + s[3]) / 2, 0);
            me.rotation.z = Math.atan2(dy, dx);
            g.add(me);
        });
        return g;
    }
    // Basit Nors rünleri (birim kare içinde, merkez 0)
    const RUNES = [
        [[-0.15, -0.4, -0.15, 0.4], [-0.15, 0.4, 0.2, 0.15], [0.2, 0.15, -0.15, -0.05]],          // ᚦ benzeri
        [[-0.2, -0.4, -0.2, 0.4], [-0.2, 0, 0.2, 0.4], [-0.2, 0, 0.2, -0.4]],                     // ᚲ/ᚴ
        [[-0.3, -0.4, 0.3, 0.4], [0.3, -0.4, -0.3, 0.4]],                                        // ᚷ
        [[0, -0.4, 0, 0.4], [-0.3, 0.1, 0, 0.4], [0.3, 0.1, 0, 0.4]],                            // ᛏ
        [[0, -0.4, 0, 0.4], [-0.25, 0.4, 0, 0.15], [0.25, 0.4, 0, 0.15], [-0.25, -0.4, 0, -0.15], [0.25, -0.4, 0, -0.15]], // ᛟ/ᛝ
        [[-0.2, -0.4, -0.2, 0.4], [0.2, -0.4, 0.2, 0.4], [-0.2, 0.15, 0.2, -0.15]]               // ᚺ
    ];

    // ---------------- malzemeler ----------------
    const M = {
        snake(color, k) {
            return B.mat('scales', { color, roughness: 0.55, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.28, iridescence: 0.3, iridescenceIOR: 1.6, ns: 1.0 }, k || [7, 3.5]);
        },
        belly(color) { return B.mat('scales', { color, roughness: 0.6, clearcoat: 0.3, ns: 0.4 }, [10, 2], 9); },
        gold() { return B.mat('gold', { color: 0xffc95a, metalness: 1, roughness: 0.28, envMapIntensity: 1.3 }, [1, 1]); },
        iron(c) { return B.mat('iron', { color: c || 0x8d919e, metalness: 0.55, roughness: 0.5, envMapIntensity: 2.0 }, [2, 2]); },
        stone(c, rep, seed) { return B.mat('stone', { color: c || 0xb8bccb, roughness: 0.92, metalness: 0, ns: 1.2 }, rep || [1, 1], seed); },
        bone(c) { return B.mat('bone', { color: c || 0xe8dcc0, roughness: 0.62, ns: 0.8 }, [1, 1]); },
        fabric(c, rep) { return B.mat('fabric', { color: c, roughness: 0.92, ns: 0.8, sheen: 0.7, sheenColor: new T.Color(0x9098b8), sheenRoughness: 0.6 }, rep || [3, 3]); },
        granite(c, rep, seed) { return B.mat('granite', { color: c || 0xc8c4c0, roughness: 0.9, metalness: 0, ns: 1.4 }, rep || [1, 1], seed); },
        cloth(c, rep) { return B.mat('cloth', { color: c, roughness: 0.95, ns: 0.7, sheen: 0.6, sheenColor: new T.Color(0x8890a8), sheenRoughness: 0.7 }, rep || [3, 3]); },
        wood(c) { return B.mat('wood', { color: c || 0xb08860, roughness: 0.75 }, [1, 3]); },
        glow(c, i) { const m = new T.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: i || 3, roughness: 0.4 }); m.userData.glow = true; return m; },
        dark() { return new T.MeshStandardMaterial({ color: 0x050407, roughness: 0.9 }); },
        add(c, o) { return new T.MeshBasicMaterial({ color: c, transparent: true, opacity: o == null ? 0.6 : o, depthWrite: false }); }
    };

    // ---------------- yılan renkleri (oyundaki paletle aynı aile) ----------------
    function bodyColor(k, cb) {
        const c = new T.Color();
        if (cb) { c.set('#0072B2'); c.multiplyScalar(1 - 0.4 * k); return c; }
        c.setHSL((158 - 16 * k) / 360, (88 - 14 * k) / 100, (50 - 22 * k) / 100 * 0.72);
        return c;
    }
    const TONES = [0, 0.34, 0.67, 1];
    const SEG_R = 0.43;   // gövde küresi yarıçapı (hücre); oyun 8.6 px (baş) .. 5.2 px (kuyruk)

    // ---------------- 1) YILAN BAŞI ----------------
    function buildHead(scene, cb) {
        const root = new T.Group();
        scene.add(root);
        const skin = M.snake(bodyColor(0, cb), [6, 3]);
        const bellyC = cb ? new T.Color('#9cc6e6') : new T.Color('#c9e6a0');
        const lift = SEG_R;
        // kafatası: önü sivrilen, altı düz, kaş kemerli
        const skullG = deform(ellipsoid(0.62, 0.3, 0.44, 64, 40), v => {
            const f = B.smooth(-0.1, 0.62, v.x);
            v.z *= 1 - 0.42 * f;
            v.y *= 1 - 0.3 * f;
            if (v.y < 0) v.y *= 0.55;
            // gözlerin üstünde kaş sırtı
            const brow = Math.exp(-((v.x - 0.12) ** 2) / 0.02) * Math.exp(-((Math.abs(v.z) - 0.25) ** 2) / 0.012);
            v.y += brow * 0.07 * (v.y > 0 ? 1 : 0);
            // başın arkasında hafif çene kası şişkinliği
            const jaw = Math.exp(-((v.x + 0.25) ** 2) / 0.05) * (Math.abs(v.z) > 0.2 ? 1 : 0);
            v.z += Math.sign(v.z) * jaw * 0.04;
        });
        // sırtta koyu baklava deseni + yanlarda açık dudak bandı (köşe rengi)
        const cA = new Float32Array(skullG.attributes.position.count * 3), sp = skullG.attributes.position;
        for (let i = 0; i < sp.count; i++) {
            const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
            const dia = Math.abs(z) * 1.6 + Math.abs(((x + 0.62) * 2.2) % 1 - 0.5) * 0.5;
            let k = y > 0.05 ? 1 - 0.45 * (1 - B.smooth(0.12, 0.2, dia)) : 1;
            if (y < 0.02) k = 1.25;
            cA[i * 3] = k; cA[i * 3 + 1] = k; cA[i * 3 + 2] = k;
        }
        skullG.setAttribute('color', new T.BufferAttribute(cA, 3));
        const skullSkin = M.snake(bodyColor(0, cb).multiplyScalar(0.78), [6, 3]);
        skullSkin.vertexColors = true;
        const skull = mesh(skullG, skullSkin, { p: [0.05, lift + 0.02, 0] });
        root.add(skull);
        // alt çene (açık ton, pullu karın plakaları)
        const jawG = deform(ellipsoid(0.55, 0.13, 0.38, 48, 24), v => {
            const f = B.smooth(-0.1, 0.55, v.x);
            v.z *= 1 - 0.45 * f;
            if (v.y > 0) v.y *= 0.4;
        });
        root.add(mesh(jawG, M.belly(bellyC), { p: [0.04, lift - 0.12, 0] }));
        // boyun bağlantısı (gövde tüpüne geçiş)
        root.add(mesh(ellipsoid(0.3, 0.3, 0.3, 40, 24), skin, { p: [-0.36, lift - 0.02, 0] }));
        // gözler: parlak sarı, dikey yarık göz bebeği
        const eyeM = new T.MeshPhysicalMaterial({ color: 0xffc21a, emissive: 0xffa000, emissiveIntensity: 0.9, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4 });
        const pupM = new T.MeshStandardMaterial({ color: 0x050402, roughness: 0.2 });
        [-1, 1].forEach(s => {
            const eg = new T.Group();
            eg.position.set(0.2, lift + 0.15, s * 0.27);
            eg.add(mesh(sphere(0.11, 32, 24), eyeM, { cast: false }));
            eg.add(mesh(ellipsoid(0.07, 0.022, 0.022, 16, 12), pupM, { p: [0.0, 0.07, s * 0.075], cast: false }));
            root.add(eg);
            // göz çevresi pul halkası
            root.add(mesh(new T.TorusGeometry(0.115, 0.02, 10, 32), skin, { p: [0.2, lift + 0.15, s * 0.27], r: [Math.PI / 2 - s * 0.9, 0, 0], cast: false }));
            // altın boynuz çıkıntıları (Nors ejder esini)
            const h = taperTube([[0.0, 0, 0], [-0.14, 0.04, s * 0.04], [-0.28, 0.1, s * 0.08], [-0.38, 0.2, s * 0.1]], 0.045, 0.006, 20, 10);
            root.add(mesh(h.geo, M.gold(), { p: [0, lift + 0.18, s * 0.2] }));
            // burun delikleri
            root.add(mesh(ellipsoid(0.03, 0.018, 0.02, 12, 8), M.dark(), { p: [0.6, lift + 0.07, s * 0.07], cast: false }));
        });
        // ağız çizgisi
        const lipG = taperTube([[0.66, 0, 0], [0.45, -0.005, 0.2], [0.1, 0, 0.3], [-0.15, 0.02, 0.33]], 0.012, 0.012, 24, 6).geo;
        root.add(mesh(lipG, M.dark(), { p: [0, lift - 0.07, 0], cast: false }));
        root.add(mesh(lipG.clone().scale(1, 1, -1), M.dark(), { p: [0, lift - 0.07, 0], cast: false }));
        // çatal dil
        const tongue = new T.Group();
        const tM = new T.MeshPhysicalMaterial({ color: 0xff2a50, emissive: 0x500010, roughness: 0.3, clearcoat: 0.8 });
        tongue.add(mesh(taperTube([[0.55, 0, 0], [0.75, 0.01, 0], [0.92, 0.02, 0]], 0.028, 0.02, 12, 8).geo, tM));
        [-1, 1].forEach(s => tongue.add(mesh(taperTube([[0.91, 0.02, 0], [1.0, 0.03, s * 0.05], [1.07, 0.03, s * 0.1]], 0.02, 0.006, 10, 6).geo, tM)));
        tongue.position.y = lift - 0.1;
        root.add(tongue);
        return (i) => {
            const d = Math.floor(i / 2), out = i % 2;
            root.rotation.y = [0, -Math.PI / 2, Math.PI, Math.PI / 2][d];
            tongue.visible = !!out;
        };
    }

    // ---------------- 2) GÖVDE SEGMENTİ, BAĞLANTI TÜPÜ, KUYRUK ----------------
    function buildSeg(scene, cb) {
        const meshes = [];
        const g = mesh(sphere(SEG_R, 48, 32), M.snake(bodyColor(0, cb), [7, 3.5]), { p: [0, SEG_R, 0] });
        // pul sırasını ileri baksın diye yatır
        g.rotation.z = Math.PI / 2;
        scene.add(g); meshes.push(g);
        const stud = new T.Group();
        stud.add(mesh(new T.OctahedronGeometry(0.1, 0).scale(1, 0.55, 1.35), M.gold(), { p: [0, SEG_R * 2 - 0.02, 0] }));
        stud.add(mesh(sphere(0.035, 12, 8), M.glow(0xffb020, 2.5), { p: [0, SEG_R * 2 + 0.035, 0], cast: false }));
        scene.add(stud);
        return (i) => {
            const tone = TONES[Math.floor(i / 2)];
            g.material.color.copy(bodyColor(tone, cb));
            stud.visible = i % 2 === 1;
        };
    }
    const LINK_R = SEG_R * 0.9;
    const PITCH = 62 * Math.PI / 180;
    function buildLink(scene, cb, vertical) {
        const len = vertical ? 1 / Math.sin(PITCH) : 1.0;
        const geo = new T.CylinderGeometry(LINK_R, LINK_R, len + 0.02, 40, 1, true);
        geo.rotateZ(Math.PI / 2);
        const m = M.snake(bodyColor(0, cb), [6, 2]);
        const c = mesh(geo, m, { p: [0, SEG_R, 0] });
        if (vertical) c.rotation.y = Math.PI / 2;
        scene.add(c);
        return (i) => { m.color.copy(bodyColor(TONES[i], cb)); };
    }
    function buildTail(scene, cb) {
        const root = new T.Group(); scene.add(root);
        const m = M.snake(bodyColor(1, cb), [5, 3]);
        // kuyruk: kürenin içinden başlayıp sivri uca giden konik form (uç -x yönünde)
        const geo = lathe([[0, -0.62], [0.08, -0.5], [0.17, -0.3], [0.26, -0.05], [0.31, 0.12], [0.3, 0.24], [0.2, 0.33], [0, 0.36]], 40);
        geo.rotateZ(Math.PI / 2);
        root.add(mesh(geo, m, { p: [0, SEG_R * 0.75, 0] }));
        return (i) => { root.rotation.y = [0, -Math.PI / 2, Math.PI, Math.PI / 2][i]; };
    }

    // ---------------- 3) YEMLER ----------------
    function appleGeo(rot) {
        const prof = [];
        for (let i = 0; i <= 24; i++) {
            const t = i / 24, a = -Math.PI / 2 + t * Math.PI;
            let r = Math.cos(a) * (0.42 + 0.06 * Math.sin(a + 0.6));
            let y = Math.sin(a) * 0.38;
            if (t > 0.88) y -= (t - 0.88) * 0.6;     // üst çukur
            if (t < 0.08) y += (0.08 - t) * 0.5;     // alt çukur
            prof.push([Math.max(0.001, r), y]);
        }
        prof[0][0] = 0.001; prof[prof.length - 1][0] = 0.001;
        const geo = lathe(prof, 56);
        const n = B.noiseGen(rot ? 5 : 2);
        deform(geo, v => {
            const a = Math.atan2(v.z, v.x) / TAU + 0.5;
            const lobe = 1 + 0.035 * Math.cos(Math.atan2(v.z, v.x) * 5);
            v.x *= lobe; v.z *= lobe;
            if (rot) {
                const w = n.fbm(a, v.y + 0.5, 4, 4);
                const s = 0.82 + w * 0.22;
                v.x *= s; v.z *= s; v.y *= 0.86 + w * 0.1;
            }
        });
        // tepe renk geçişi (köz kırmızısı yanak -> altın)
        const col = new Float32Array(geo.attributes.position.count * 3);
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const a = Math.atan2(z, x);
            const blush = B.clamp(0.5 + 0.5 * Math.cos(a - 2.2) + n.fbm(a / TAU + 0.5, y + 0.5, 3, 6) * 0.5 - 0.35, 0, 1);
            let c;
            if (rot) c = new T.Color().setHSL(0.78 - blush * 0.05, 0.42, 0.32 - blush * 0.1);
            else c = new T.Color().setHSL(0.11 - blush * 0.09, 0.95, 0.52 - blush * 0.12 + y * 0.15);
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        geo.setAttribute('color', new T.BufferAttribute(col, 3));
        return geo;
    }
    function buildApple(scene, rot) {
        const root = new T.Group(); scene.add(root);
        const m = B.mat(rot ? 'rot' : 'skin', { vertexColors: true, color: 0xffffff, roughness: rot ? 0.85 : 0.35, clearcoat: rot ? 0.05 : 0.7, clearcoatRoughness: 0.25, envMapIntensity: 1.1, ns: rot ? 1.5 : 0.5 }, [3, 2]);
        root.add(mesh(appleGeo(rot), m, { p: [0, 0.4, 0] }));
        const stem = taperTube([[0, 0.66, 0], [0.02, 0.8, 0], [0.08, 0.92, 0.02]], 0.03, 0.018, 10, 8).geo;
        root.add(mesh(stem, M.wood(0x6a4a2a)));
        if (!rot) {
            const sh = new T.Shape();
            sh.moveTo(0, 0); sh.quadraticCurveTo(0.12, 0.09, 0.3, 0); sh.quadraticCurveTo(0.12, -0.09, 0, 0);
            const lg = new T.ShapeGeometry(sh, 12);
            deform(lg, v => { v.z = -Math.pow(v.x, 2) * 0.8; });
            const leaf = mesh(lg, new T.MeshPhysicalMaterial({ color: 0x3fae4a, roughness: 0.45, clearcoat: 0.5, side: T.DoubleSide }), { p: [0.03, 0.84, 0.0], r: [-1.1, 0.4, 0.35] });
            root.add(leaf);
        } else {
            // çürük: kurt deliği + küf lekeleri
            root.add(mesh(sphere(0.07, 16, 12), M.dark(), { p: [0.26, 0.48, 0.24], cast: false }));
            const mold = new T.MeshStandardMaterial({ color: 0x9dbb6a, roughness: 1 });
            for (let i = 0; i < 5; i++) root.add(mesh(ellipsoid(0.06, 0.02, 0.05, 12, 8), mold, { p: [Math.cos(i * 1.7) * 0.3, 0.55 + (i % 2) * 0.05, Math.sin(i * 1.7) * 0.3], r: [0.3, i, 0.2], cast: false }));
        }
        return (i, n) => { root.rotation.y = -0.5 + i / n * TAU; };
    }
    // Altın rün yıldızı (süper yem): eğimli 6 köşe yıldız, ortasında rün ve köz kalbi
    function buildStar(scene) {
        const root = new T.Group(); scene.add(root);
        const sh = new T.Shape();
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * TAU - Math.PI / 2, r = i % 2 ? 0.2 : 0.46;
            if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        sh.closePath();
        const g = new T.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 4 });
        g.translate(0, 0, -0.03);
        const gold = M.gold(); gold.emissive = new T.Color(0x6a3a00); gold.emissiveIntensity = 0.6;
        const star = mesh(g, gold);
        const holder = new T.Group();
        holder.position.y = 0.55;
        holder.add(star);
        const core = mesh(sphere(0.11, 24, 16), M.glow(0xffa31a, 2.2), { p: [0, 0, 0.0], s: [1, 1, 1.6], cast: false });
        holder.add(core);
        const rune = runeStrokes(RUNES[4], M.glow(0xfff0b0, 2.5), 0.035, 0.03);
        rune.scale.setScalar(0.28); rune.position.z = 0.15;
        holder.add(rune);
        const rune2 = rune.clone(); rune2.position.z = -0.15; holder.add(rune2);
        root.add(holder);
        const tilt = new T.Group(); tilt.position.y = 0.55; holder.position.y = 0; root.remove(holder); tilt.add(holder); tilt.rotation.x = -0.75; root.add(tilt);
        return (i, n) => { holder.rotation.y = Math.sin(i / n * TAU) * 0.75; };
    }

    // ---------------- 4) GÜÇ KRİSTALLERİ ----------------
    function buildCrystal(scene, color, runeIx) {
        const root = new T.Group(); scene.add(root);
        const holder = new T.Group(); holder.position.y = 0.52; root.add(holder);
        const c = new T.Color(color);
        const geo = new T.CylinderGeometry(0.2, 0.2, 0.42, 6, 1);
        // altıgen prizma + iki sivri uç = cilalı rün kristali
        const top = new T.ConeGeometry(0.2, 0.26, 6); top.translate(0, 0.34, 0);
        const bot = new T.ConeGeometry(0.2, 0.2, 6); bot.rotateX(Math.PI); bot.translate(0, -0.31, 0);
        const shell = new T.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.86, flatShading: true, envMapIntensity: 1.6, iridescence: 0.4 });
        [geo, top, bot].forEach(g => holder.add(mesh(g, shell)));
        const innerM = M.glow(c.clone().lerp(new T.Color(0xffffff), 0.35), 2.2);
        const inner = mesh(new T.OctahedronGeometry(0.11, 0).scale(1, 2.2, 1), innerM, { cast: false });
        holder.add(inner);
        // altın kafes bandı + rün
        const band = mesh(new T.TorusGeometry(0.215, 0.025, 8, 6), M.gold(), { r: [Math.PI / 2, 0, Math.PI / 6] });
        holder.add(band);
        const band2 = band.clone(); band2.position.y = -0.17; band2.scale.setScalar(0.93); holder.add(band2);
        const r = runeStrokes(RUNES[runeIx % RUNES.length], M.glow(0xffffff, 1.8), 0.04, 0.02);
        r.scale.setScalar(0.3); r.position.set(0, 0.03, 0.19);
        holder.add(r);
        return (i, n) => { holder.rotation.y = i / n * (TAU / 3); holder.rotation.z = 0.12; };
    }

    // ---------------- 5) TAPINAK DÜŞMANLARI ----------------
    // Her düşman 12 karelik şerit: 0-7 bekleme/yürüme döngüsü, 8-11 saldırı (hazırlık -> vuruş -> toparlanma).
    // Çizim tarafı (tapinak.js) kareyi zamana ve düşman durumuna göre seçer (map.anim).
    const ANIM = { bekle: [0, 8], saldiri: [8, 4] };
    function bob(i, n, a) { return Math.sin(i / n * TAU) * (a || 0.04); }
    // Yırtık kenarlı pelerin/cübbe (lathe + alt kenar dişli)
    function shroud(prof, ragged, seed, seg, teeth) {
        const geo = lathe(prof, seg || 48);
        const n = B.noiseGen(seed || 1);
        const ymin = Math.min(...prof.map(p => p[1]));
        deform(geo, v => {
            const a = Math.atan2(v.z, v.x) / TAU + 0.5;
            const low = 1 - B.smooth(ymin, ymin + 0.25, v.y);
            v.y += low * (-ragged * (0.5 + Math.sin(a * TAU * (teeth || 9)) * 0.5) * (0.6 + n.fbm(a, 0.3, 3, 6)));
            const w = 1 + (n.fbm(a, v.y * 0.5 + 0.5, 3, 4) - 0.5) * 0.18;
            v.x *= w; v.z *= w;
        });
        return geo;
    }
    // Kumaş kıvrımları: yarıçapı açıya göre dalgalandır (aşağı doğru derinleşen kıvrımlar)
    function folds(geo, k, amp, y0, y1, seed) {
        const n = B.noiseGen(seed || 2);
        return deform(geo, v => {
            const a = Math.atan2(v.z, v.x);
            const f = B.smooth(y1, y0, v.y);
            const w = 1 + amp * f * (Math.sin(a * k + n.fbm(a / TAU + 0.5, 0.2, 2, 4) * 3) * 0.7 + (n.fbm(a / TAU + 0.5, v.y, 3, 8) - 0.5));
            v.x *= w; v.z *= w;
        });
    }
    // Kare başına yeniden biçimlenen geometri (pelerin dalgası): taban konumları saklanır
    function animGeo(geo) {
        const base = Float32Array.from(geo.attributes.position.array);
        const v = new T.Vector3();
        return fn => {
            const p = geo.attributes.position;
            for (let i = 0; i < p.count; i++) { v.set(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]); fn(v, i); p.setXYZ(i, v.x, v.y, v.z); }
            p.needsUpdate = true;
            smoothNormals(geo);
        };
    }
    // Işıyan malzeme (bloom geçişinde parlar); kare başına şiddeti değişebilir
    function glowM(c, i) { const m = M.glow(c, i); m.userData.glow = true; m.userData.base = i; return m; }
    // Çatlak ağı: kökten dallanan kırık çizgiler (köz ışığı) -> runeStrokes parçaları
    function crackSegs(seed, n, len) {
        const R = B.rng(seed), segs = [];
        const grow = (x, y, a, l, d) => {
            const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
            segs.push([x, y, x2, y2]);
            if (d <= 0) return;
            grow(x2, y2, a + (R() - 0.5) * 1.1, l * 0.8, d - 1);
            if (R() < 0.55) grow(x2, y2, a + (R() < 0.5 ? 1 : -1) * (0.6 + R() * 0.6), l * 0.6, d - 2);
        };
        for (let k = 0; k < n; k++) grow(0, 0, k / n * TAU + R() * 0.5, len, 3);
        return segs;
    }
    function wispMotes(group, count, col, seed, r0) {
        const R = B.rng(seed), ms = [];
        const m = glowM(col, 5);
        for (let k = 0; k < count; k++) {
            const me = mesh(sphere(0.018 + R() * 0.014, 8, 6), m, { cast: false, recv: false });
            me.userData = { a: R() * TAU, r: (r0 || 0.3) * (0.6 + R() * 0.6), y: R(), s: 0.7 + R() * 0.6 };
            group.add(me); ms.push(me);
        }
        return ms;
    }

    // HORTLAK: süzülen kefenli ruh-iskelet. Kambur, öne uzanan pençeler; derin kapüşonda kafatası,
    // buz mavisi gözler ve kaburgaların ardında ışıyan ruh çekirdeği. Etek yırtık ve dalgalanır.
    function buildHortlak(scene, st) {
        const root = new T.Group(); scene.add(root);
        const body = new T.Group(); root.add(body);
        const cloth = M.fabric(new T.Color(0xa6d6ca), [4, 4]);
        cloth.side = T.DoubleSide;
        cloth.emissive = new T.Color(0x184c46); cloth.emissiveIntensity = 0.7;
        const clothD = M.fabric(new T.Color(0x5c8079), [4, 4]);
        clothD.side = T.DoubleSide;
        // kefen: omuzdan yırtık eteğe; üst kısım öne kambur, hafif asimetrik
        const prof = [[0.01, 1.0], [0.19, 0.97], [0.29, 0.86], [0.31, 0.7], [0.32, 0.52], [0.36, 0.34], [0.4, 0.16], [0.42, 0.0]];
        const shG = shroud(prof, 0.3, 3, 72, 7);
        deform(shG, v => { const h = B.smooth(0.55, 1.0, v.y); v.z += h * 0.12; v.x += Math.sin(v.y * 7) * 0.015; });
        folds(shG, 7, 0.1, 0.0, 0.8, 5);
        const shWave = animGeo(shG);
        const sh = mesh(shG, cloth, { p: [0, 0.1, 0] });
        body.add(sh);
        // iç karanlık (etek altından görünen boşluk)
        body.add(mesh(lathe([[0.01, 0.75], [0.25, 0.7], [0.38, 0.25], [0.42, 0.05]], 32), M.dark(), { p: [0, 0.1, 0], s: [0.92, 1, 0.92] }));
        // omuz atkısı: koyu, yırtık, ikinci katman
        const scG = shroud([[0.01, 1.04], [0.22, 0.98], [0.34, 0.86], [0.37, 0.74]], 0.12, 4, 56, 11);
        deform(scG, v => { v.z += B.smooth(0.8, 1.05, v.y) * 0.1; });
        body.add(mesh(scG, clothD, { p: [0, 0.1, 0] }));
        // kapüşon: geriye kıvrık sivri uç + yüz çerçevesi
        const head = new T.Group(); head.position.set(0, 1.04, 0.13); body.add(head);
        // derin kapüşon: önü açık kubbe (kafatasını çevreler) + geriye kıvrık sivri uç
        const cowl = new T.SphereGeometry(0.2, 40, 24, Math.PI / 2 + 1.0, TAU - 2.0, 0, Math.PI * 0.72);
        head.add(mesh(cowl, cloth, { p: [0, 0.0, 0.02], s: [1, 1.1, 1.05], r: [0.15, 0, 0] }));
        head.add(mesh(ellipsoid(0.15, 0.17, 0.1, 24, 16), M.dark(), { p: [0, -0.02, -0.04], cast: false }));
        const tipG = deform(new T.ConeGeometry(0.12, 0.3, 24, 8, true), v => { const t = (v.y + 0.15) / 0.3; v.z -= t * t * 0.18; v.x += t * t * 0.04; });
        head.add(mesh(tipG, cloth, { p: [0, 0.24, -0.1], r: [-0.7, 0, 0] }));
        // kafatası + çene (saldırıda açılır)
        const bone = M.bone(0xefe4c8);
        const skull = new T.Group(); skull.position.set(0, -0.03, 0.09); head.add(skull);
        skull.add(mesh(deform(ellipsoid(0.11, 0.115, 0.1, 32, 24), v => { if (v.y < -0.02) v.x *= 0.82; if (v.z > 0.05 && Math.abs(v.x) < 0.03 && v.y < 0) v.z -= 0.01; }), bone));
        const jaw = new T.Group(); jaw.position.set(0, -0.07, 0.02); skull.add(jaw);
        jaw.add(mesh(ellipsoid(0.07, 0.035, 0.07, 20, 12), bone, { p: [0, -0.02, 0.03] }));
        for (let k = -2; k <= 2; k++) jaw.add(mesh(new T.BoxGeometry(0.012, 0.022, 0.01), bone, { p: [k * 0.02, 0.0, 0.095], cast: false }));
        const eyeM = glowM(0x8ff8ff, 9);
        const eyes = [];
        [-1, 1].forEach(s => {
            skull.add(mesh(sphere(0.04, 16, 12), M.dark(), { p: [s * 0.045, 0.012, 0.075], cast: false }));
            const e = mesh(sphere(0.034, 14, 10), eyeM, { p: [s * 0.047, 0.012, 0.1], s: [1.2, 0.85, 0.7], cast: false });
            skull.add(e); eyes.push(e);
        });
        skull.add(mesh(new T.ConeGeometry(0.016, 0.035, 3), M.dark(), { p: [0, -0.04, 0.1], r: [Math.PI, 0, 0], cast: false }));
        // yırtık göğüs: koyu boşluk, kaburgalar, arkada ruh çekirdeği
        const chest = new T.Group(); chest.position.set(0, 0.72, 0.31); body.add(chest);
        chest.add(mesh(ellipsoid(0.11, 0.14, 0.04, 24, 16), M.dark(), { cast: false }));
        const core = mesh(sphere(0.075, 20, 14), glowM(0x6ffff0, 6), { p: [0, 0.0, 0.0], cast: false });
        chest.add(core);
        chest.add(mesh(new T.CylinderGeometry(0.014, 0.014, 0.3, 8), bone, { p: [0, 0, 0.045] }));
        for (let i = 0; i < 4; i++) {
            [-1, 1].forEach(s => chest.add(mesh(new T.TorusGeometry(0.1 - i * 0.008, 0.013, 6, 16, Math.PI * 0.55), bone, { p: [s * 0.006, 0.1 - i * 0.055, 0.02], r: [0, s > 0 ? 0 : Math.PI, s > 0 ? -0.2 : 0.2], s: [1, 0.6, 0.5], cast: false })));
        }
        // kollar: kemik + yırtık yen, uzun pençeler; omuz ekseninde döner
        const arms = [];
        [-1, 1].forEach(s => {
            const arm = new T.Group(); arm.position.set(s * 0.28, 0.86, 0.12); body.add(arm);
            arm.add(mesh(taperTube([[0, 0, 0], [s * 0.1, -0.14, 0.18], [s * 0.08, -0.2, 0.38]], 0.032, 0.022, 16, 8).geo, bone));
            for (let f = -1; f <= 1; f++) {
                const cl = taperTube([[s * 0.08, -0.2, 0.38], [s * 0.08 + f * 0.035, -0.23, 0.47], [s * 0.08 + f * 0.05, -0.31, 0.5]], 0.013, 0.002, 8, 6).geo;
                arm.add(mesh(cl, bone, { cast: false }));
            }
            const slv = shroud([[0.01, 0.1], [0.08, 0.05], [0.12, -0.12]], 0.07, 7 + s, 24, 5);
            arm.add(mesh(slv, cloth, { p: [s * 0.03, -0.04, 0.06], r: [1.0, 0, s * 0.35] }));
            arms.push(arm);
        });
        // ruh izi: altta toplanan soğuk ışık + yükselen kıvılcımlar
        const wisp = mesh(new T.ConeGeometry(0.4, 0.45, 32, 1, true), M.add(0x6fffd8, 0.22), { p: [0, 0.2, 0], r: [Math.PI, 0, 0], cast: false });
        body.add(wisp);
        const motes = wispMotes(body, 7, 0x8ffff0, 17, 0.35);
        root.rotation.y = 0.4;
        const ct = st.contact;
        return (i, n) => {
            const atk = i >= 8, k = i - 8;
            const f = i / 8 * TAU;
            const lift = atk ? [0.1, 0.06, 0.03, 0.08][k] : 0.12 + Math.sin(f) * 0.05;
            body.position.set(0, lift, atk ? [-0.05, 0.12, 0.2, 0.06][k] : 0);
            body.rotation.set(atk ? [-0.12, 0.25, 0.38, 0.12][k] : Math.sin(f + 1) * 0.04, 0, atk ? 0 : Math.sin(f) * 0.06);
            head.rotation.set(-0.45 + (atk ? [-0.25, 0.1, 0.2, 0][k] : Math.sin(f + 0.6) * 0.06), atk ? 0 : Math.sin(f) * 0.1, 0);
            jaw.rotation.x = atk ? [0.2, 0.45, 0.55, 0.15][k] : 0.06 + Math.max(0, Math.sin(f * 2)) * 0.05;
            arms.forEach((a, j) => {
                const s = j ? 1 : -1;
                a.rotation.x = atk ? [-0.9, -0.2, 0.25, -0.1][k] : Math.sin(f + j * Math.PI) * 0.16;
                a.rotation.z = atk ? s * [0.35, 0.1, -0.1, 0.05][k] : 0;
            });
            const ei = atk ? [11, 15, 16, 11][k] : 8 + Math.sin(f) * 1.5;
            eyeM.emissiveIntensity = ei;
            eyes.forEach(e => e.scale.set(1.2, atk ? 1.1 : 0.85, 0.7));
            core.material.emissiveIntensity = atk ? 7 : 4.5 + Math.sin(f * 2) * 1;
            core.scale.setScalar(atk ? 1.25 : 1 + Math.sin(f * 2) * 0.1);
            // pelerin dalgası: etekte açıya bağlı yürüyen dalga
            const wp = atk ? k * 1.4 + 2 : f;
            shWave(v => {
                const a = Math.atan2(v.z, v.x);
                const low = 1 - B.smooth(-0.3, 0.55, v.y);
                const dr = low * (0.06 * Math.sin(a * 3 - wp) + 0.035 * Math.sin(a * 5 + wp * 2));
                const r = Math.hypot(v.x, v.z) || 1;
                v.x += v.x / r * dr; v.z += v.z / r * dr;
                v.y += low * 0.04 * Math.sin(a * 4 - wp);
                if (atk) v.z -= low * 0.12 * [0.3, 0.8, 1, 0.5][k];
            });
            motes.forEach(m => {
                const u = m.userData, tt = (u.y + i / 8) % 1;
                m.position.set(Math.cos(u.a + tt * 2) * u.r, 0.05 + tt * 0.5, Math.sin(u.a + tt * 2) * u.r * 0.7);
                m.scale.setScalar(u.s * Math.sin(tt * Math.PI));
            });
            if (ct) { const q = 1 - (lift - 0.07) * 1.6; ct.scale.set(0.9 * q, 0.6 * q, 1); ct.material.opacity = 0.55 * q; }
        };
    }

    // RÜN CADISI: uzun kıvrık kapüşon, kıvrımlı mor cübbe, etekte ışıyan rün kuşağı, beyaz saç tutamları,
    // kök pençeli asada pembe rün kristali. Şarjda asa kalkar, kristal büyür, ayak altında rün çemberi açılır.
    function buildCadi(scene, st) {
        const root = new T.Group(); scene.add(root);
        const body = new T.Group(); root.add(body);
        const robeM = M.fabric(new T.Color(0xc060c8), [5, 4]);
        robeM.side = T.DoubleSide;
        robeM.emissive = new T.Color(0x220622); robeM.emissiveIntensity = 0.8;
        const capeM = M.fabric(new T.Color(0x7a3484), [5, 3]);
        capeM.side = T.DoubleSide;
        const rprof = [[0.01, 0.95], [0.15, 0.92], [0.2, 0.78], [0.23, 0.55], [0.3, 0.3], [0.4, 0.12], [0.47, 0.0]];
        const robeG = folds(shroud(rprof, 0.05, 11, 72, 13), 9, 0.12, 0.0, 0.75, 9);
        const robe = mesh(robeG, robeM);
        body.add(robe);
        // etek rün kuşağı (önde görünen yarım halka)
        const runeM = glowM(0xff6ad8, 4.5);
        const band = new T.Group(); body.add(band);
        for (let k = 0; k < 7; k++) {
            const a = -0.95 + k * 0.32;
            const rr = runeStrokes(RUNES[k % RUNES.length], runeM, 0.07, 0.04);
            rr.scale.setScalar(0.085);
            rr.position.set(Math.sin(a) * 0.43, 0.1, Math.cos(a) * 0.43);
            rr.rotation.set(-0.35, a, 0);
            band.add(rr);
        }
        body.add(mesh(new T.TorusGeometry(0.44, 0.012, 6, 64), M.gold(), { p: [0, 0.035, 0], r: [Math.PI / 2, 0, 0], s: [1, 1, 1] }));
        // omuz pelerini (dalgalanır)
        const capeG = shroud([[0.01, 0.98], [0.22, 0.89], [0.33, 0.72], [0.36, 0.56]], 0.08, 12, 64, 9);
        const capeWave = animGeo(capeG);
        body.add(mesh(capeG, capeM));
        // kapüşon: geriye kıvrık uzun sivri uç (kare başına salınır)
        const hood = new T.Group(); hood.position.set(0, 0.98, -0.02); body.add(hood);
        const hoodG = deform(new T.ConeGeometry(0.24, 0.7, 40, 14, true), v => {
            const t = (v.y + 0.35) / 0.7;
            v.z -= Math.pow(t, 2) * 0.32;
            v.x += Math.pow(t, 3) * 0.06;
            v.x *= 1 - t * 0.12;
        });
        const hoodTip = new T.Group(); hoodTip.position.set(0, 0.2, 0); hood.add(hoodTip);
        hoodTip.add(mesh(hoodG, capeM, { p: [0, 0.16, -0.03] }));
        hood.add(mesh(new T.SphereGeometry(0.2, 32, 20, 0, TAU, 0, Math.PI * 0.7), capeM, { r: [-0.45, 0, 0] }));
        hood.add(mesh(new T.TorusGeometry(0.14, 0.035, 10, 32), robeM, { p: [0, -0.03, 0.13], r: [0.3, 0, 0], s: [1, 1.15, 1] }));
        hood.add(mesh(ellipsoid(0.13, 0.14, 0.06, 24, 16), M.dark(), { p: [0, -0.04, 0.13], cast: false }));
        const eyeM = glowM(0xff8ae6, 9);
        [-1, 1].forEach(s => hood.add(mesh(sphere(0.03, 12, 8), eyeM, { p: [s * 0.048, -0.02, 0.18], s: [1.4, 0.75, 0.7], cast: false })));
        // beyaz saç tutamları
        const hair = M.bone(0xd8d4e4);
        [-1, 1].forEach(s => { for (let k = 0; k < 3; k++) hood.add(mesh(taperTube([[s * (0.08 + k * 0.02), -0.08, 0.12 - k * 0.03], [s * (0.12 + k * 0.025), -0.22, 0.14 - k * 0.03], [s * (0.1 + k * 0.03), -0.38 - k * 0.04, 0.12 - k * 0.04]], 0.016, 0.003, 10, 6).geo, hair, { cast: false })); });
        // kuşak + tılsımlar
        body.add(mesh(new T.TorusGeometry(0.245, 0.022, 8, 40), M.gold(), { p: [0, 0.54, 0], r: [Math.PI / 2, 0, 0] }));
        body.add(mesh(new T.BoxGeometry(0.06, 0.1, 0.02), M.gold(), { p: [0.06, 0.45, 0.27], r: [0.2, 0, 0.1] }));
        body.add(mesh(sphere(0.03, 12, 8), M.bone(), { p: [-0.08, 0.44, 0.26] }));
        // asa: omuzdan döner (şarjda kalkar)
        const arm = new T.Group(); arm.position.set(0.3, 0.78, 0.1); body.add(arm);
        const staff = new T.Group(); staff.position.set(0.04, -0.76, 0.02); arm.add(staff);
        const wood = M.wood(0x8a6040);
        staff.add(mesh(taperTube([[0, 0.02, 0], [0.02, 0.6, 0], [-0.01, 1.1, 0], [0.03, 1.38, 0]], 0.03, 0.022, 20, 8).geo, wood));
        for (let k = 0; k < 4; k++) {
            const a = k / 4 * TAU;
            staff.add(mesh(taperTube([[0.03, 1.36, 0], [0.03 + Math.cos(a) * 0.09, 1.46, Math.sin(a) * 0.09], [0.03 + Math.cos(a) * 0.035, 1.6, Math.sin(a) * 0.035]], 0.018, 0.005, 10, 6).geo, wood));
        }
        const orbM = new T.MeshPhysicalMaterial({ color: 0xff5ed1, emissive: 0xff3ac0, emissiveIntensity: 3, roughness: 0.1, clearcoat: 1, flatShading: true });
        orbM.userData.glow = true;
        const orb = mesh(new T.OctahedronGeometry(0.08, 1), orbM, { p: [0.03, 1.48, 0], cast: false });
        staff.add(orb);
        const orbMotes = wispMotes(staff, 4, 0xffa0ec, 23, 0.16);
        const handM = M.bone(0xc0b0d0);
        arm.add(mesh(sphere(0.048, 16, 12), handM, { p: [0.03, -0.06, 0.03] }));
        arm.add(mesh(shroud([[0.01, 0.16], [0.08, 0.08], [0.115, -0.08]], 0.05, 21, 20), robeM, { p: [0, 0.03, 0], r: [0.25, 0, -0.45] }));
        // sol el: öne açık avuç (şarjda kıvılcım toplar)
        const lh = new T.Group(); lh.position.set(-0.2, 0.62, 0.2); body.add(lh);
        lh.add(mesh(sphere(0.045, 16, 12), handM));
        lh.add(mesh(shroud([[0.01, 0.16], [0.08, 0.08], [0.11, -0.08]], 0.05, 22, 20), robeM, { p: [0.03, 0.06, -0.05], r: [1.0, 0, 0.5] }));
        const palm = mesh(sphere(0.035, 12, 8), glowM(0xff9ae8, 6), { p: [0, 0.02, 0.06], cast: false });
        lh.add(palm);
        // ayak altı rün çemberi (yalnız şarjda)
        const circ = new T.Group(); circ.position.y = 0.01; root.add(circ);
        const cM = glowM(0xff4ec8, 3.5);
        circ.add(mesh(new T.TorusGeometry(0.62, 0.012, 6, 72), cM, { r: [Math.PI / 2, 0, 0], cast: false, recv: false }));
        circ.add(mesh(new T.TorusGeometry(0.5, 0.008, 6, 72), cM, { r: [Math.PI / 2, 0, 0], cast: false, recv: false }));
        for (let k = 0; k < 8; k++) {
            const a = k / 8 * TAU, rr = runeStrokes(RUNES[k % RUNES.length], cM, 0.08, 0.01);
            rr.scale.setScalar(0.09); rr.position.set(Math.sin(a) * 0.56, 0.005, Math.cos(a) * 0.56); rr.rotation.set(-Math.PI / 2, 0, a); circ.add(rr);
        }
        root.rotation.y = 0.35;
        return (i, n) => {
            const atk = i >= 8, k = i - 8;
            const f = i / 8 * TAU;
            const q = atk ? (k + 1) / 4 : 0;
            body.position.y = 0.03 + (atk ? 0.02 * q : Math.sin(f) * 0.022);
            body.rotation.z = atk ? -0.04 * q : Math.sin(f) * 0.025;
            robe.rotation.y = Math.sin(f) * 0.08;
            robe.scale.set(1 + q * 0.06, 1, 1 + q * 0.06);
            hood.rotation.set(-0.2 + (atk ? -0.12 * q : Math.sin(f + 0.8) * 0.05), 0, atk ? 0 : Math.sin(f) * 0.04);
            hoodTip.rotation.set(Math.sin(f - 0.6) * 0.12 - q * 0.2, 0, Math.sin(f - 1.2) * 0.14);
            arm.rotation.set(atk ? [-0.35, -0.7, -0.95, -1.1][k] : Math.sin(f) * 0.04, 0, atk ? [0.1, 0.18, 0.22, 0.25][k] : 0);
            const oi = atk ? [5, 8, 12, 16][k] : 3 + Math.sin(f) * 0.9;
            orbM.emissiveIntensity = oi;
            orb.scale.setScalar(atk ? 1.15 + q * 0.6 : 1 + Math.sin(f) * 0.08);
            orb.rotation.set(0, f / 2 + k * 0.4, 0.3);
            orbMotes.forEach((m, j) => {
                const u = m.userData, a = u.a + (atk ? -k * 1.3 : f / 2);
                const r = atk ? u.r * (1 - q * 0.6) : u.r;
                m.position.set(0.03 + Math.cos(a) * r, 1.48 + Math.sin(a * 2 + j) * 0.05, Math.sin(a) * r);
                m.scale.setScalar(u.s * (atk ? 1.3 : 0.9));
            });
            palm.scale.setScalar(atk ? 0.8 + q * 1.4 : 0.6 + Math.sin(f) * 0.1);
            palm.material.emissiveIntensity = atk ? 8 : 4;
            runeM.emissiveIntensity = atk ? 5 + q * 6 : 3.5 + Math.sin(f) * 1.2;
            eyeM.emissiveIntensity = atk ? 14 : 9;
            circ.visible = atk;
            circ.scale.setScalar(0.6 + q * 0.5);
            circ.rotation.y = k * 0.25;
            cM.emissiveIntensity = 2 + q * 4;
            capeWave(v => {
                const a = Math.atan2(v.z, v.x);
                const low = 1 - B.smooth(0.5, 0.95, v.y);
                const dr = low * (0.03 * Math.sin(a * 4 - f) + (atk ? 0.04 * q : 0));
                const r = Math.hypot(v.x, v.z) || 1;
                v.x += v.x / r * dr; v.z += v.z / r * dr;
                v.y += low * 0.02 * Math.sin(a * 3 + f);
            });
        };
    }

    // TAŞ MUHAFIZ: ağır taş golem. Kambur kaya gövde, köz ışıklı çatlak ağı, demir kuşak ve apoletler,
    // yosunlu omuzlar, sırtta rün kristalleri, iri yumruklar. Yürüyüşte bacaklar sırayla kalkar,
    // gövde her adımda çöker ve yana sallanır; saldırıda iki yumruğu kaldırıp yere vurur.
    function rock(w, h, d, seed, amp) {
        const g = new T.BoxGeometry(w, h, d, 8, 8, 8);
        const n = B.noiseGen(seed || 5);
        // kutuyu yuvarlat + taş gibi çentikle
        deform(g, v => {
            const q = V3(v.x / (w / 2), v.y / (h / 2), v.z / (d / 2));
            const r = Math.max(Math.abs(q.x), Math.abs(q.y), Math.abs(q.z));
            const sp = q.clone().normalize().multiplyScalar(r);
            v.x = B.lerp(v.x, sp.x * w / 2, 0.35); v.y = B.lerp(v.y, sp.y * h / 2, 0.35); v.z = B.lerp(v.z, sp.z * d / 2, 0.35);
            const k = 1 + (n.fbm(v.x * 0.7 + 0.5, v.y * 0.7 + v.z * 0.3 + 0.5, 4, 3) - 0.5) * (amp || 0.25);
            v.multiplyScalar(k);
        });
        return g;
    }
    function buildMuhafiz(scene) {
        const root = new T.Group(); scene.add(root);
        const body = new T.Group(); root.add(body);
        const st = M.granite(0xd8d2cc, [1, 1], 13);
        const st2 = M.granite(0xb4aea8, [1, 1], 17);
        const iron = M.iron(0xa8a29a);
        const moss = B.mat('granite', { color: 0x6f9a3e, roughness: 1, ns: 1.5 }, [2, 2], 3);
        const emb = glowM(0xff7a1a, 3);
        // bacaklar: kalça ekseninde döner
        const legs = [-1, 1].map(s => {
            const g = new T.Group(); g.position.set(s * 0.2, 0.34, 0); root.add(g);
            g.add(mesh(rock(0.26, 0.24, 0.28, 30 + s, 0.2), st2, { p: [0, -0.1, 0] }));
            g.add(mesh(rock(0.3, 0.15, 0.36, 33 + s, 0.22), st, { p: [0, -0.27, 0.04] }));
            g.add(mesh(new T.TorusGeometry(0.13, 0.025, 8, 24), iron, { p: [0, -0.04, 0], r: [Math.PI / 2, 0, 0] }));
            return g;
        });
        // gövde (öne kambur)
        const torsoG = new T.Group(); torsoG.position.set(0, 0.62, 0); torsoG.rotation.x = 0.14; body.add(torsoG);
        torsoG.add(mesh(rock(0.7, 0.74, 0.52, 7, 0.22), st));
        torsoG.add(mesh(new T.TorusGeometry(0.39, 0.045, 10, 40), iron, { p: [0, -0.26, 0], r: [Math.PI / 2, 0, 0], s: [1.05, 0.72, 1] }));
        // göğüs: demir plaka + köz çatlak ağı + merkez rün
        const plate = mesh(new T.CylinderGeometry(0.42, 0.42, 0.3, 32, 1, true, -0.85, 1.7), iron, { p: [0, 0.03, -0.1] });
        plate.material = plate.material.clone(); plate.material.side = T.DoubleSide;
        torsoG.add(plate);
        for (let k = -2; k <= 2; k++) torsoG.add(mesh(sphere(0.026, 10, 8), iron, { p: [Math.sin(k * 0.38) * 0.43, 0.15, Math.cos(k * 0.38) * 0.43 - 0.1], cast: false }));
        const cracks = runeStrokes(crackSegs(4, 5, 0.085), emb, 0.014, 0.05);
        cracks.position.set(0, -0.06, 0.3); torsoG.add(cracks);
        const rune = runeStrokes(RUNES[3], glowM(0xffb04a, 6), 0.05, 0.05);
        rune.scale.setScalar(0.22); rune.position.set(0, -0.04, 0.33); torsoG.add(rune);
        // sırtta rün kristali dikenleri
        const crysM = new T.MeshPhysicalMaterial({ color: 0xffa050, emissive: 0xff6a10, emissiveIntensity: 1.6, roughness: 0.2, clearcoat: 1, flatShading: true });
        crysM.userData.glow = true;
        [[-0.2, 0.28, -0.2, -0.4], [0.05, 0.34, -0.22, 0.1], [0.24, 0.26, -0.18, 0.5]].forEach(([x, y, z, rz]) => torsoG.add(mesh(new T.ConeGeometry(0.06, 0.26, 5), crysM, { p: [x, y, z], r: [-0.5, 0, rz] })));
        // omuzlar: kaya + demir apolet + yosun
        const arms = [];
        [-1, 1].forEach(s => {
            torsoG.add(mesh(rock(0.32, 0.3, 0.34, 40 + s, 0.3), st, { p: [s * 0.44, 0.22, 0] }));
            torsoG.add(mesh(new T.SphereGeometry(0.18, 24, 12, 0, TAU, 0, Math.PI / 2), iron, { p: [s * 0.46, 0.3, 0], r: [0, 0, -s * 0.35], s: [1, 0.7, 1] }));
            for (let k = 0; k < 3; k++) torsoG.add(mesh(new T.ConeGeometry(0.03, 0.12, 6), iron, { p: [s * (0.42 + k * 0.08), 0.48 - k * 0.04, -0.02], r: [0, 0, -s * (0.3 + k * 0.25)] }));
            torsoG.add(mesh(rock(0.2, 0.08, 0.18, 70 + s, 0.6), moss, { p: [s * 0.36, 0.38, 0.08], cast: false }));
            // kol: omuz ekseni
            const a = new T.Group(); a.position.set(s * 0.56, 0.14, 0.02); torsoG.add(a);
            a.add(mesh(rock(0.22, 0.34, 0.22, 50 + s, 0.25), st2, { p: [0, -0.16, 0], r: [0, 0, s * 0.08] }));
            a.add(mesh(new T.TorusGeometry(0.12, 0.028, 8, 24), iron, { p: [0, -0.33, 0.02], r: [Math.PI / 2, 0, 0] }));
            a.add(mesh(rock(0.28, 0.26, 0.28, 60 + s, 0.3), st, { p: [0.0, -0.48, 0.05] }));
            arms.push(a);
        });
        // baş: omuzlar arasına gömük, köz vizör ve gözler, kıvrık boynuz
        const head = new T.Group(); head.position.set(0, 0.46, 0.12); torsoG.add(head);
        head.add(mesh(rock(0.3, 0.3, 0.3, 77, 0.18), st));
        head.add(mesh(new T.BoxGeometry(0.34, 0.07, 0.24), iron, { p: [0, 0.07, 0.04] }));
        const visor = mesh(new T.BoxGeometry(0.22, 0.04, 0.05), glowM(0xffa040, 7), { p: [0, 0.0, 0.15], cast: false });
        head.add(visor);
        const hornM = M.bone(0xd8cfae);
        [-1, 1].forEach(s => head.add(mesh(taperTube([[s * 0.12, 0.08, 0], [s * 0.27, 0.14, 0.02], [s * 0.32, 0.3, -0.03], [s * 0.25, 0.44, -0.07]], 0.055, 0.008, 20, 10).geo, hornM)));
        root.rotation.y = 0.35;
        return (i, n) => {
            const atk = i >= 8, k = i - 8;
            const f = i / 8 * TAU;
            const sn = Math.sin(f);
            // yürüme: bacak salınımı + adımda kalkan ayak; gövde her basışta çöker
            legs.forEach((g, j) => {
                const ph = j ? -sn : sn;
                g.rotation.x = atk ? [0, 0, 0.2, 0.1][k] * (j ? -1 : 1) : ph * 0.42;
                g.position.y = 0.34 + (atk ? 0 : Math.max(0, Math.cos(f + (j ? Math.PI : 0))) * 0.05);
            });
            body.position.y = atk ? [0.03, 0.06, -0.06, -0.02][k] : -Math.abs(Math.sin(f)) * 0.04 + 0.01;
            body.rotation.z = atk ? 0 : Math.cos(f) * 0.06;
            body.rotation.x = atk ? [-0.1, -0.18, 0.28, 0.1][k] : 0;
            arms.forEach((a, j) => {
                a.rotation.x = atk ? [-1.9, -2.7, -0.7, -0.3][k] : (j ? 1 : -1) * sn * 0.35;
                a.rotation.z = atk ? (j ? 1 : -1) * [0.25, 0.3, -0.1, 0][k] : 0;
            });
            head.rotation.set(atk ? [-0.15, -0.25, 0.25, 0][k] : 0, atk ? 0 : Math.sin(f) * 0.12, 0);
            const glow = atk ? [4.5, 7, 10, 5][k] : 3 + Math.sin(f * 2) * 0.8;
            emb.emissiveIntensity = glow;
            visor.material.emissiveIntensity = atk ? 12 : 7;
            crysM.emissiveIntensity = atk ? 3 : 1.4 + Math.sin(f) * 0.3;
        };
    }

    // KÜL JARLI: boss. Kıvrık boynuzlu miğfer (uçları kor), köz gözler, çatlak göğüste erimiş çekirdek,
    // kürk yaka, dikenli apoletler, kor kenarlı kül pelerini, rün baltası. Bekleme: nefes, pelerin
    // salınımı, çekirdek/boynuz nabzı, yükselen közler. Özel (8-11): kükreme / faz geçişi.
    function buildJarl(scene) {
        const root = new T.Group(); scene.add(root);
        const body = new T.Group(); root.add(body);
        const iron = M.iron(0xb0acb8);
        const dark = M.iron(0x5e5864);
        const cloakM = M.fabric(new T.Color(0x4e4040), [6, 5]);
        cloakM.side = T.DoubleSide;
        cloakM.emissive = new T.Color(0x2e0a04); cloakM.emissiveIntensity = 0.7;
        const S = 2.0;   // genel ölçek
        body.scale.setScalar(S);
        const cloakG = folds(shroud([[0.01, 1.0], [0.26, 0.95], [0.34, 0.8], [0.37, 0.5], [0.44, 0.2], [0.52, 0.0]], 0.12, 31, 72, 11), 8, 0.1, 0.0, 0.8, 31);
        const cloakWave = animGeo(cloakG);
        const cloak = mesh(cloakG, cloakM);
        body.add(cloak);
        // kor kenar: pelerin eteğinde ışıyan şerit
        const hemM = glowM(0xff5a1a, 2.4);
        // içten için için yanan etek: alt kenar köşelerinde düzensiz kor parçaları (kesintisiz halka yerine)
        const hem = new T.Group(); body.add(hem);
        {
            const p = cloakG.attributes.position, R1 = B.rng(77);
            for (let i = 0; i < p.count; i += 3) {
                if (p.getY(i) > 0.02 || R1() < 0.45) continue;
                const l = 0.03 + R1() * 0.05;
                hem.add(mesh(new T.BoxGeometry(l, 0.02, 0.02), hemM, { p: [p.getX(i) * 1.01, p.getY(i) + 0.01, p.getZ(i) * 1.01], r: [0, Math.atan2(p.getX(i), p.getZ(i)) + Math.PI / 2, (R1() - 0.5) * 0.8], cast: false }));
            }
        }
        // nefes alan gövde grubu
        const chestG = new T.Group(); chestG.position.set(0, 0.72, 0.06); body.add(chestG);
        chestG.add(mesh(deform(ellipsoid(0.34, 0.3, 0.24, 48, 32), v => { if (v.z < 0) v.z *= 0.6; v.x *= 1 + 0.08 * Math.max(0, v.y / 0.3); }), iron));
        // göğüs plakası kenarları (altın şerit)
        chestG.add(mesh(new T.TorusGeometry(0.2, 0.014, 6, 40, Math.PI), M.gold(), { p: [0, 0.02, 0.2], r: [0.1, 0, Math.PI] }));
        const coreM = glowM(0xff7a1a, 4);
        const core = mesh(sphere(0.095, 32, 20), coreM, { p: [0, -0.02, 0.22], cast: false });
        chestG.add(core);
        const crM = glowM(0xff8a2a, 4.5);
        const cracks = runeStrokes(crackSegs(9, 7, 0.08), crM, 0.016, 0.04);
        cracks.position.set(0, -0.02, 0.235); chestG.add(cracks);
        // kürk yaka
        const fur = M.fabric(new T.Color(0x6a5a4a), [3, 3]);
        const R0 = B.rng(5);
        for (let k = 0; k < 22; k++) {
            const a = k / 22 * TAU;
            chestG.add(mesh(new T.ConeGeometry(0.05, 0.16 + R0() * 0.06, 6), fur, { p: [Math.sin(a) * 0.28, 0.24, Math.cos(a) * 0.2 - 0.02], r: [Math.cos(a) * 1.0, 0, -Math.sin(a) * 1.0] }));
        }
        // kemer + kafatası tokası
        body.add(mesh(new T.TorusGeometry(0.33, 0.04, 10, 48), M.iron(0x5a4630), { p: [0, 0.46, 0.02], r: [Math.PI / 2, 0, 0] }));
        body.add(mesh(ellipsoid(0.06, 0.06, 0.04, 16, 12), M.bone(), { p: [0, 0.46, 0.35] }));
        body.add(mesh(new T.BoxGeometry(0.15, 0.03, 0.02), M.gold(), { p: [0, 0.41, 0.35] }));
        // dikenli apoletler + kollar (kükremede kalkar)
        const arms = [];
        [-1, 1].forEach(s => {
            const pa = new T.Group(); pa.position.set(s * 0.4, 0.9, 0); pa.rotation.z = -s * 0.4; body.add(pa);
            pa.add(mesh(new T.SphereGeometry(0.21, 32, 16, 0, TAU, 0, Math.PI / 2), iron));
            pa.add(mesh(new T.TorusGeometry(0.205, 0.02, 8, 32), M.gold(), { r: [Math.PI / 2, 0, 0] }));
            for (let k = 0; k < 3; k++) pa.add(mesh(new T.ConeGeometry(0.035, 0.2 - Math.abs(k - 1) * 0.04, 8), dark, { p: [(k - 1) * 0.1, 0.2, -0.02], r: [0, 0, (k - 1) * -0.3] }));
            const arm = new T.Group(); arm.position.set(s * 0.42, 0.82, 0.04); body.add(arm);
            arm.add(mesh(new T.CylinderGeometry(0.09, 0.08, 0.42, 16), dark, { p: [0, -0.2, 0] }));
            arm.add(mesh(new T.CylinderGeometry(0.1, 0.09, 0.14, 16), iron, { p: [0, -0.4, 0.01] }));
            arm.add(mesh(sphere(0.085, 16, 12), dark, { p: [0, -0.5, 0.03] }));
            arms.push(arm);
        });
        // rün baltası (sağ kolda)
        const axe = new T.Group(); axe.position.set(0.05, -0.52, 0.12); axe.rotation.z = 0.12; arms[1].add(axe);
        axe.add(mesh(new T.CylinderGeometry(0.025, 0.03, 1.05, 10), M.wood(0x5a3d26), { p: [0, 0.05, 0] }));
        const bladeS = new T.Shape();
        bladeS.moveTo(0, 0.12); bladeS.quadraticCurveTo(0.2, 0.2, 0.28, 0.3); bladeS.quadraticCurveTo(0.34, 0.0, 0.28, -0.3); bladeS.quadraticCurveTo(0.2, -0.2, 0, -0.12); bladeS.closePath();
        axe.add(mesh(new T.ExtrudeGeometry(bladeS, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 }), M.iron(0xb0b4c0), { p: [0.02, 0.42, -0.01], r: [0, -0.5, 0] }));
        const axeRuneM = glowM(0xff7a2a, 4);
        const ar = runeStrokes(RUNES[1], axeRuneM, 0.05, 0.03); ar.scale.setScalar(0.18); ar.position.set(0.13, 0.42, 0.06); ar.rotation.y = -0.5; axe.add(ar);
        // miğfer
        const helm = new T.Group(); helm.position.set(0, 1.12, 0.03); body.add(helm);
        helm.add(mesh(deform(ellipsoid(0.2, 0.2, 0.21, 40, 28), v => { if (v.y < -0.05) { v.x *= 1.05; v.z *= 1.05; } }), dark));
        helm.add(mesh(new T.TorusGeometry(0.2, 0.025, 8, 40), M.gold(), { p: [0, -0.02, 0], r: [Math.PI / 2, 0, 0] }));
        helm.add(mesh(new T.BoxGeometry(0.035, 0.24, 0.05), iron, { p: [0, -0.05, 0.2] }));
        const eyeM = glowM(0xfff1b0, 9);
        const hornTipM = glowM(0xff6a1a, 3);
        [-1, 1].forEach(s => {
            helm.add(mesh(sphere(0.032, 12, 8), eyeM, { p: [s * 0.075, -0.03, 0.18], s: [1.5, 0.6, 0.6], cast: false }));
            helm.add(mesh(new T.BoxGeometry(0.06, 0.18, 0.16), iron, { p: [s * 0.16, -0.14, 0.06], r: [0.1, 0, s * 0.15] }));
            const pts = [[s * 0.16, 0.08, 0], [s * 0.38, 0.14, 0.02], [s * 0.5, 0.33, -0.02], [s * 0.46, 0.54, -0.08], [s * 0.35, 0.65, -0.12]];
            const horn = taperTube(pts, 0.075, 0.01, 32, 12);
            helm.add(mesh(horn.geo, M.bone(0xd8cfae)));
            // kor uç: son çeyrek ayrı ışıyan tüp
            const tpts = [0.78, 0.88, 1.0].map(t => horn.curve.getPointAt(t).toArray());
            helm.add(mesh(taperTube(tpts, 0.026, 0.008, 10, 8).geo, hornTipM, { cast: false }));
            // halka bantlar
            for (let k = 1; k <= 3; k++) {
                const p = horn.curve.getPointAt(k * 0.16), tg = horn.curve.getTangentAt(k * 0.16);
                const rg = mesh(new T.TorusGeometry(0.075 * (1 - k * 0.16) + 0.006, 0.01, 6, 20), M.gold(), { cast: false });
                rg.position.copy(p); rg.quaternion.setFromUnitVectors(V3(0, 0, 1), tg);
                helm.add(rg);
            }
        });
        // yükselen közler (döngüsel)
        const embers = new T.Group(); root.add(embers);
        const eM = glowM(0xff8a2a, 6);
        const R = B.rng(99), em = [];
        for (let k = 0; k < 18; k++) {
            const me = mesh(sphere(0.022 + R() * 0.02, 8, 6), eM, { cast: false, recv: false });
            me.userData = { x: (R() - 0.5) * 2.2, z: (R() - 0.5) * 1.0, y: R(), s: 0.7 + R() * 0.6 };
            embers.add(me); em.push(me);
        }
        root.rotation.y = 0.2;
        return (i, n) => {
            const atk = i >= 8, k = i - 8;
            const f = i / 8 * TAU;
            const q = atk ? [0.35, 0.8, 1, 0.6][k] : 0;
            body.position.y = 0.04 + (atk ? 0.06 * q : Math.sin(f) * 0.04);
            body.rotation.x = atk ? -0.12 * q : 0;
            const br = atk ? 1 + 0.06 * q : 1 + Math.sin(f) * 0.03;
            chestG.scale.set(br, 1 + (br - 1) * 0.6, br);
            helm.rotation.x = atk ? -0.35 * q : Math.sin(f) * 0.03;
            helm.position.y = 1.12 + (br - 1) * 0.5;
            arms.forEach((a, j) => {
                const s = j ? 1 : -1;
                a.rotation.z = atk ? s * 0.9 * q : s * (0.05 + Math.sin(f) * 0.02);
                a.rotation.x = atk ? (j ? -1.6 : -0.8) * q : Math.sin(f + j) * 0.05;
            });
            coreM.emissiveIntensity = atk ? 6 + 8 * q : 3.5 + Math.sin(f) * 1.5;
            core.scale.setScalar(atk ? 1 + 0.5 * q : 1 + Math.sin(f) * 0.08);
            crM.emissiveIntensity = atk ? 5 + 7 * q : 3.5 + Math.sin(f) * 1.2;
            hornTipM.emissiveIntensity = atk ? 6 + 6 * q : 2.5 + Math.sin(f + 1) * 1.5;
            eyeM.emissiveIntensity = atk ? 16 : 9 + Math.sin(f) * 1;
            hemM.emissiveIntensity = atk ? 4 + 3 * q : 2.2 + Math.sin(f * 2) * 0.5;
            axeRuneM.emissiveIntensity = atk ? 9 : 4;
            cloakWave(v => {
                const a = Math.atan2(v.z, v.x);
                const low = 1 - B.smooth(0.2, 0.9, v.y);
                const dr = low * (0.03 * Math.sin(a * 3 - f) + (atk ? 0.06 * q : 0));
                const r = Math.hypot(v.x, v.z) || 1;
                v.x += v.x / r * dr; v.z += v.z / r * dr;
            });
            em.forEach(m => {
                const u = m.userData, tt = (u.y + (atk ? i / 8 * 2 : i / 8)) % 1;
                m.position.set(u.x * (1 + (atk ? q * 0.3 : 0)), 0.3 + tt * 2.4, u.z);
                m.scale.setScalar(u.s * Math.sin(tt * Math.PI) * (atk ? 1.4 : 1));
            });
        };
    }

    // ---------------- 6) ENGEL BLOK, SÜTUN, RÜN TAŞI, MEŞALE ----------------
    function bevelBox(w, h, d, bev) {
        const s = new T.Shape();
        const x = w / 2 - bev, z = d / 2 - bev;
        s.moveTo(-x, -z); s.lineTo(x, -z); s.lineTo(x, z); s.lineTo(-x, z); s.closePath();
        const g = new T.ExtrudeGeometry(s, { depth: h - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 2 });
        g.rotateX(-Math.PI / 2);
        g.translate(0, bev, 0);
        // ExtrudeGeometry UV'si dünya ölçeğinde; dokuyu birim kareye yay
        return g;
    }
    function buildBlock(scene, ember) {
        const root = new T.Group(); scene.add(root);
        const st = ember ? M.stone(0x5a4a44, [1.6, 1.6], 17) : M.stone(0x8f97b2, [1.6, 1.6], 19);
        const H = 0.5;
        const g = bevelBox(0.96, H, 0.96, 0.06);
        const n = B.noiseGen(ember ? 8 : 4);
        deform(g, v => { const k = (n.fbm(v.x + 0.5, v.z + 0.5 + v.y, 3, 4) - 0.5) * 0.05; v.x += k; v.z += k * 0.7; if (v.y > H - 0.02) v.y += k * 0.6; });
        root.add(mesh(g, st));
        const runeM = ember ? M.glow(0xff6a10, 4.5) : M.glow(0xffc65a, 1.6);
        const runes = RUNES.map(r => { const rr = runeStrokes(r, runeM, 0.07, 0.03); rr.scale.setScalar(0.62); rr.rotation.x = -Math.PI / 2; rr.position.y = H + 0.005; root.add(rr); return rr; });
        if (ember) {
            // kızgın çatlaklar yan yüzlerde
            const cm = M.glow(0xff5a00, 3);
            [[0, 0.25, 0.485, 0], [0.485, 0.2, 0, Math.PI / 2]].forEach(([x, y, z, ry]) => {
                const c = runeStrokes([[-0.3, 0.05, -0.1, -0.08], [-0.1, -0.08, 0.05, 0.1], [0.05, 0.1, 0.32, -0.04]], cm, 0.03, 0.02);
                c.position.set(x, y, z); c.rotation.y = ry; root.add(c);
            });
        }
        return (i) => { runes.forEach((r, k) => { r.visible = k === i; }); };
    }
    function buildPillar(scene) {
        const root = new T.Group(); scene.add(root);
        const st = M.stone(0xa5abc2, [1, 2], 23);
        const base = bevelBox(0.98, 0.16, 0.98, 0.04); root.add(mesh(base, st));
        const shaftG = deform(new T.CylinderGeometry(0.34, 0.38, 1.3, 12, 8), v => {
            const a = Math.atan2(v.z, v.x);
            const flute = 1 - 0.05 * Math.pow(Math.abs(Math.cos(a * 6)), 4);
            v.x *= flute; v.z *= flute;
        });
        root.add(mesh(shaftG, st, { p: [0, 0.16 + 0.65, 0] }));
        const cap = bevelBox(0.9, 0.16, 0.9, 0.04); root.add(mesh(cap, st, { p: [0, 1.46, 0] }));
        root.add(mesh(new T.TorusGeometry(0.37, 0.025, 8, 24), M.gold(), { p: [0, 1.4, 0], r: [Math.PI / 2, 0, 0] }));
        const rune = runeStrokes(RUNES[3], M.glow(0x78dcff, 3), 0.06, 0.03); rune.scale.setScalar(0.5); rune.position.set(0, 0.85, 0.37); root.add(rune);
        return null;
    }
    function buildRunestone(scene) {
        const root = new T.Group(); scene.add(root);
        const st = M.stone(0x9aa0b4, [1.2, 1.8], 29);
        const g = deform(new T.BoxGeometry(0.9, 1.5, 0.36, 10, 16, 6), v => {
            const t = (v.y + 0.75) / 1.5;
            v.x *= 1 - t * t * 0.35;
            if (t > 0.85) v.y -= Math.pow(Math.abs(v.x) / 0.45, 2) * 0.25;
            v.z *= 1 - t * 0.2;
        });
        const n = B.noiseGen(6);
        deform(g, v => { const k = 1 + (n.fbm(v.x + 0.5, v.y * 0.5 + 0.5, 4, 4) - 0.5) * 0.12; v.x *= k; v.z *= k; });
        root.add(mesh(g, st, { p: [0, 0.75, 0] }));
        const rm = M.glow(0x7fe3ff, 3);
        [RUNES[0], RUNES[4], RUNES[2]].forEach((r, i) => { const rr = runeStrokes(r, rm, 0.07, 0.03); rr.scale.setScalar(0.28); rr.position.set(0, 1.12 - i * 0.32, 0.17); root.add(rr); });
        // taban taşları
        const R = B.rng(4);
        for (let i = 0; i < 5; i++) root.add(mesh(rock(0.18, 0.1, 0.16, 90 + i, 0.4), M.stone(0x7a7f92, [1, 1], 31), { p: [(R() - 0.5) * 1.0, 0.04, 0.22 + R() * 0.15] }));
        return null;
    }
    function buildTorch(scene) {
        const root = new T.Group(); scene.add(root);
        const iron = M.iron(0x3f3a36);
        root.add(mesh(rock(0.5, 0.18, 0.5, 33, 0.3), M.stone(0x8a8f9f, [1, 1], 37), { p: [0, 0.09, 0] }));
        root.add(mesh(new T.CylinderGeometry(0.05, 0.07, 0.75, 10), iron, { p: [0, 0.5, 0] }));
        const bowl = lathe([[0.02, 0], [0.18, 0.04], [0.26, 0.16], [0.24, 0.2], [0.2, 0.16]], 24);
        root.add(mesh(bowl, iron, { p: [0, 0.86, 0] }));
        for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; root.add(mesh(new T.ConeGeometry(0.025, 0.12, 6), iron, { p: [Math.cos(a) * 0.25, 1.08, Math.sin(a) * 0.25], r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5] })); }
        root.add(mesh(sphere(0.16, 16, 10), M.glow(0xff5a10, 2), { p: [0, 0.98, 0], s: [1, 0.4, 1], cast: false }));
        const flames = new T.Group(); flames.position.y = 1.0; root.add(flames);
        const fl = [];
        [[0xff6a1a, 0.2, 0.55, 0.5], [0xffa040, 0.14, 0.42, 0.65], [0xfff0b0, 0.08, 0.28, 0.9]].forEach(([c, r, h, o]) => {
            const g = new T.ConeGeometry(r, h, 16, 6, true);
            g.translate(0, h / 2, 0);
            const m = mesh(g, M.add(c, o), { cast: false });
            flames.add(m); fl.push({ m, g: g.clone(), h });
        });
        const n = B.noiseGen(44);
        return (i, nF) => {
            fl.forEach((f, k) => {
                const src = f.g.attributes.position, dst = f.m.geometry.attributes.position;
                for (let j = 0; j < src.count; j++) {
                    const x = src.getX(j), y = src.getY(j), z = src.getZ(j);
                    const t = y / f.h;
                    const w = (n.fbm(i / nF, t * 0.5 + k * 0.3, 3, 4) - 0.5) * 0.25 * t;
                    dst.setXYZ(j, x + w, y * (0.9 + 0.2 * Math.sin(i / nF * TAU + k)), z + w * 0.5);
                }
                dst.needsUpdate = true;
            });
        };
    }

    // ---------------- sprite listesi ----------------
    const LIST = [];
    const add = (name, o) => LIST.push(Object.assign({ name }, o));
    [false, true].forEach(cb => {
        const sfx = cb ? '_cb' : '';
        add('head' + sfx, { w: 2.0, h: 1.8, target: [0, 0.3, 0], anchor: [0, 0, 0], frames: 8, build: s => buildHead(s, cb) });
        add('seg' + sfx, { w: 1.1, h: 1.15, target: [0, 0.45, 0], anchor: [0, 0, 0], frames: 8, build: s => buildSeg(s, cb) });
        add('linkh' + sfx, { w: 1.0, h: 1.0, target: [0, 0.4, 0], anchor: [0, 0, 0], frames: 4, build: s => buildLink(s, cb, false) });
        add('linkv' + sfx, { w: 0.9, h: 1.4, target: [0, 0.35, 0], anchor: [0, 0, 0], frames: 4, build: s => buildLink(s, cb, true) });
        add('tail' + sfx, { w: 1.5, h: 1.3, target: [0, 0.3, 0], anchor: [0, 0, 0], frames: 4, build: s => buildTail(s, cb) });
    });
    add('apple', { w: 1.2, h: 1.3, target: [0, 0.45, 0], anchor: [0, 0, 0], frames: 1, build: s => buildApple(s, false) });
    add('apple_rot', { w: 1.2, h: 1.3, target: [0, 0.45, 0], anchor: [0, 0, 0], frames: 1, build: s => buildApple(s, true) });
    add('star', { w: 1.4, h: 1.6, target: [0, 0.55, 0], anchor: [0, 0, 0], frames: 12, build: s => buildStar(s) });
    [['shield', '#00ccff', 2], ['speed', '#ffdd00', 3], ['invincible', '#ff00ff', 4], ['clear', '#00ff66', 1]].forEach(([k, c, r]) => {
        add('crystal_' + k, { w: 1.2, h: 1.6, lean: -0.6, target: [0, 0.55, 0], anchor: [0, 0, 0], frames: 8, build: s => buildCrystal(s, c, r) });
    });
    // düşmanlar: 3 px = 1 mantıksal px (oyunda 1.35-1.65x büyütülür; dpr 2'de net kalsın), ışıma geçişli
    const EN = { px: 60, frames: 12, anim: ANIM, bloom: { r: 5, a: 0.9 } };
    add('hortlak', Object.assign({ w: 2.2, h: 2.6, lean: -0.5, target: [0, 0.8, 0.1], anchor: [0, 0, 0], stage: { light: { rim: 4.2, rimColor: 0x9ff6ff, fill: 1.8, key: 2.6 }, shadow: true, shadowOpacity: 0.35, contact: { rx: 0.45, rz: 0.3, a: 0.55 } }, build: (s, st) => buildHortlak(s, st) }, EN));
    add('cadi', Object.assign({ w: 2.2, h: 3.0, lean: -0.5, target: [0, 1.0, 0], anchor: [0, 0, 0], stage: { light: { rim: 4.0, rimColor: 0xffb0f0, fill: 1.8, key: 2.6 }, shadow: true, shadowOpacity: 0.42, contact: { rx: 0.45, rz: 0.32, a: 0.6 } }, build: (s, st) => buildCadi(s, st) }, EN));
    add('muhafiz', Object.assign({ w: 2.6, h: 2.8, lean: -0.6, target: [0, 0.8, 0], anchor: [0, 0, 0], stage: { light: { rim: 3.8, rimColor: 0xffd0a0, fill: 1.7, key: 2.6 }, shadow: true, shadowOpacity: 0.5, contact: { rx: 0.62, rz: 0.42, a: 0.65 } }, build: (s, st) => buildMuhafiz(s, st) }, EN));
    add('jarl', Object.assign({ w: 5.2, h: 6.4, lean: -0.45, target: [0, 2.1, 0], anchor: [0, 0, 0], stage: { light: { rim: 3.6, rimColor: 0xffa070, fill: 1.6, key: 2.5 }, shadow: true, shadowOpacity: 0.5, contact: { rx: 1.2, rz: 0.8, a: 0.6 } }, build: (s, st) => buildJarl(s, st) }, EN, { bloom: { r: 8, a: 0.9 } }));
    add('block', { w: 1.5, h: 1.6, target: [0, 0.25, 0], anchor: [0, 0, 0], frames: 6, stage: { shadow: true, shadowOpacity: 0.55, contact: { rx: 0.62, rz: 0.62, a: 0.45 } }, build: s => buildBlock(s, false) });
    add('block_ember', { w: 1.5, h: 1.6, target: [0, 0.25, 0], anchor: [0, 0, 0], frames: 6, stage: { shadow: true, shadowOpacity: 0.55, contact: { rx: 0.62, rz: 0.62, a: 0.45 } }, build: s => buildBlock(s, true) });
    if (0) add('pillar', { w: 1.8, h: 2.2, target: [0, 0.6, 0], anchor: [0, 0, 0], frames: 1, stage: { shadow: true, shadowOpacity: 0.55, contact: { rx: 0.6, rz: 0.6, a: 0.5 } }, build: s => buildPillar(s) });
    add('runestone', { w: 2.0, h: 2.5, lean: -0.35, target: [0, 0.85, 0], anchor: [0, 0, 0], frames: 1, stage: { shadow: true, shadowOpacity: 0.5, contact: { rx: 0.6, rz: 0.35, a: 0.55 } }, build: s => buildRunestone(s) });
    add('torch', { w: 1.4, h: 2.5, lean: -0.4, target: [0, 0.9, 0], anchor: [0, 0, 0], frames: 4, stage: { shadow: true, shadowOpacity: 0.45, contact: { rx: 0.3, rz: 0.3, a: 0.5 } }, build: s => buildTorch(s) });

    window.BakeModels = { LIST, PITCH };
})();
