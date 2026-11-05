// Sprite parçacıklar: Kenney "Particle Pack" (CC0) dokularıyla yumuşak, ışıklı parçacık çizimi.
// Atlas hazır değilse ya da özellik kapalıysa game.js eski daire çizimine döner.
const Parcacik = (() => {
    'use strict';
    const N = 64, ADET = 10;
    // 0 kıvılcım, 1 ince kıvılcım, 2 yıldız, 3 yıldız, 4 duman, 5 alev, 6 sihir, 7 halka, 8 ışık, 9 girdap
    const SET_PATLA = [0, 1, 2, 3, 5, 8];
    const SET_KIVILCIM = [1, 8];
    let atlas = null;
    const tint = new Map();
    if (typeof Image !== 'undefined') {
        const im = new Image();
        im.onload = () => { atlas = im; tint.clear(); };
        im.src = (typeof window !== 'undefined' && window.PARCACIK_DATA) || 'img/fx/parcacik.png';
    }
    function hazir() { return !!atlas; }
    function renkli(i, renk) {
        const k = i + '|' + renk;
        let c = tint.get(k);
        if (!c) {
            c = document.createElement('canvas');
            c.width = N; c.height = N;
            const g = c.getContext('2d');
            g.drawImage(atlas, i * N, 0, N, N, 0, 0, N, N);
            g.globalCompositeOperation = 'source-in';
            g.fillStyle = renk;
            g.fillRect(0, 0, N, N);
            tint.set(k, c);
        }
        return c;
    }
    function sec(kume, rnd) { return kume[Math.floor(rnd * kume.length)]; }
    // Parçacığa sprite bilgisi ekler (mantık değişmez; yalnız çizim)
    function ekle(p, tur) {
        p.s = sec(tur === 'kivilcim' ? SET_KIVILCIM : SET_PATLA, Math.random());
        p.rot = Math.random() * Math.PI * 2;
        p.dönüş = (Math.random() - 0.5) * 4;
        return p;
    }
    // ctx 'lighter' kipinde çağrılır; çizdiyse true
    function ciz(ctx, p, x, y, alfa, dt) {
        if (!atlas || p.s === undefined) return false;
        const boy = Math.max(6, p.r * 7) * (0.6 + 0.4 * alfa);
        p.rot += (p.dönüş || 0) * (dt || 0.016);
        ctx.globalAlpha = alfa;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot);
        ctx.drawImage(renkli(p.s, p.color), -boy / 2, -boy / 2, boy, boy);
        ctx.restore();
        return true;
    }
    return { hazir, ekle, ciz, ADET };
})();
if (typeof window !== 'undefined') window.Parcacik = Parcacik;
