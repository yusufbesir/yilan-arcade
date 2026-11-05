'use strict';
// Yılan gövde animasyonu: sürünme dalgası, yem şişliği, hafif nefes. Saf hesap (DOM yok); gfx25.js şeridi kurduktan
// sonra uygula() ile noktaları yana kaydırır ve genişliği değiştirir. Tarayıcıda window.YilanAnim, Node'da module.exports.
// Hareket azaltma açıkken (reduced) hiçbir şey değişmez. Mantığı/çarpışmayı etkilemez, yalnız çizim.
(function (kok, fabrika) {
    const m = fabrika();
    if (typeof module === 'object' && module.exports) module.exports = m;
    else kok.YilanAnim = m;
})(typeof self !== 'undefined' ? self : this, function () {
    const TAU = Math.PI * 2;
    const st = { bulges: [], k: 0, son: 0 }; // k: 0..1 yumuşatılmış genlik çarpanı

    // yem yutuldu: şişlik baştan kuyruğa doğru ilerler
    function yedi(simdi) {
        st.bulges.push(simdi);
        if (st.bulges.length > 6) st.bulges.shift();
    }
    function sifirla() { st.bulges.length = 0; st.k = 0; st.son = 0; }

    const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

    // Yana kayma (px): baştan 0, boyuna doğru artar; kuyruk ucu en çok salınır. Hızla genlik artar.
    function kayma(s, L, S, tSn, hucreSn, k) {
        const env = sm(S * 0.5, S * 2.6, s) * (0.75 + 0.55 * Math.min(1, s / Math.max(1, L)));
        const amp = Math.min(1.7, 0.7 + 0.14 * hucreSn) * k;
        const lam = S * 3.4;
        return Math.sin(TAU * (s / lam) - TAU * 0.85 * tSn) * amp * env;
    }
    // Genişlik çarpanı: yutulan yem şişliği + nefes
    function genislik(s, L, S, simdi, hucreSn, tSn, k) {
        let g = 1 + 0.022 * Math.sin(TAU * 0.55 * tSn) * k;
        const sig = S * 0.75;
        for (let i = 0; i < st.bulges.length; i++) {
            const yol = (simdi - st.bulges[i]) / 1000 * Math.max(2.5, hucreSn) * S; // baştan kat edilen yol
            if (yol > L + 2 * S) continue;
            const d = (s - yol) / sig;
            if (d > -3 && d < 3) g += 0.42 * Math.exp(-d * d) * (1 - 0.5 * Math.min(1, yol / Math.max(1, L)));
        }
        return g;
    }

    // R: {x,y,nx,ny,w,s,brk,n,L}; o: {simdi (ms), hizMs, calisiyor, reduced, S}
    function uygula(R, o) {
        if (o.reduced || R.n < 3 || !(o.hizMs > 0)) { st.k = 0; st.son = o.simdi; return false; }
        const dt = st.son ? Math.min(0.1, Math.max(0, (o.simdi - st.son) / 1000)) : 0;
        st.son = o.simdi;
        const hedef = o.calisiyor ? 1 : 0.3;
        st.k += (hedef - st.k) * Math.min(1, dt * 4);
        const k = st.k;
        if (k < 0.01 && !st.bulges.length) return false;
        const tSn = o.simdi / 1000, hucreSn = 1000 / o.hizMs;
        for (let i = 0; i < R.n; i++) {
            const s = R.s[i];
            const off = kayma(s, R.L, o.S, tSn, hucreSn, k);
            R.x[i] += R.nx[i] * off; R.y[i] += R.ny[i] * off;
            R.w[i] *= genislik(s, R.L, o.S, o.simdi, hucreSn, tSn, k);
        }
        return true;
    }

    return { yedi, sifirla, uygula, kayma, genislik, _st: st };
});
