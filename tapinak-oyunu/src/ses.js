// Köz Tapınağı: Web Audio ile prosedürel ses (dosya yok). Kullanıcı etkileşiminden sonra başlar.
const Ses = (() => {
  'use strict';
  let ac = null, ana = null, kapali = false, son = {};
  function baslat() {
    if (ac || typeof AudioContext === 'undefined') return;
    try { ac = new AudioContext(); ana = ac.createGain(); ana.gain.value = 0.35; ana.connect(ac.destination); } catch (e) { ac = null; }
  }
  function ton(f0, f1, sure, tip, ses, gec) {
    if (!ac || kapali) return;
    const t = ac.currentTime + (gec || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = tip; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + sure);
    g.gain.setValueAtTime(ses, t); g.gain.exponentialRampToValueAtTime(0.001, t + sure);
    o.connect(g); g.connect(ana); o.start(t); o.stop(t + sure + 0.02);
  }
  function gurultu(sure, ses, f) {
    if (!ac || kapali) return;
    const n = Math.floor(ac.sampleRate * sure), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(), g = ac.createGain(), fl = ac.createBiquadFilter();
    fl.type = 'bandpass'; fl.frequency.value = f; g.gain.value = ses;
    s.buffer = b; s.connect(fl); fl.connect(g); g.connect(ana); s.start();
  }
  const EFEKT = {
    savur: () => { gurultu(0.12, 0.5, 1800); ton(380, 140, 0.1, 'sawtooth', 0.12); },
    koz: () => ton(520, 1200, 0.18, 'triangle', 0.25),
    atilim: () => gurultu(0.18, 0.35, 900),
    vurus: () => { ton(180, 70, 0.1, 'square', 0.25); gurultu(0.06, 0.3, 2500); },
    oldu: () => { ton(240, 40, 0.35, 'sawtooth', 0.3); gurultu(0.25, 0.3, 700); },
    hasar: () => { ton(120, 45, 0.3, 'sawtooth', 0.45); gurultu(0.2, 0.4, 400); },
    cadiAtis: () => ton(700, 300, 0.2, 'sine', 0.2),
    uyari: () => { ton(300, 300, 0.12, 'square', 0.12); ton(300, 300, 0.12, 'square', 0.12, 0.18); },
    halka: () => { ton(90, 40, 0.5, 'sawtooth', 0.4); gurultu(0.4, 0.3, 300); },
    toz: () => gurultu(0.25, 0.3, 250),
    kirildi: () => { gurultu(0.5, 0.6, 500); ton(110, 40, 0.4, 'square', 0.3); },
    temiz: () => [523, 659, 784].forEach((f, i) => ton(f, f, 0.25, 'triangle', 0.2, i * 0.09)),
    kul: () => { ton(880, 1320, 0.12, 'sine', 0.2); },
    iyiles: () => [440, 554, 659].forEach((f, i) => ton(f, f * 1.01, 0.3, 'sine', 0.18, i * 0.08)),
    armagan: () => [392, 523, 659, 784].forEach((f, i) => ton(f, f, 0.3, 'triangle', 0.22, i * 0.08)),
    yetenek: () => [330, 440, 587, 880].forEach((f, i) => ton(f, f, 0.5, 'triangle', 0.25, i * 0.12)),
    zafer: () => [523, 659, 784, 1047].forEach((f, i) => ton(f, f, 0.6, 'triangle', 0.25, i * 0.15)),
    yenilgi: () => [330, 262, 196, 131].forEach((f, i) => ton(f, f * 0.98, 0.7, 'sawtooth', 0.2, i * 0.22)),
    sans: () => ton(200, 900, 0.5, 'sine', 0.3),
    oda: () => ton(150, 100, 0.3, 'sine', 0.2),
    dalga: () => ton(110, 90, 0.4, 'sawtooth', 0.15)
  };
  const SINIR = { vurus: 0.04, savur: 0.06, kul: 0.05 };
  function isle(olaylar) {
    if (!ac || kapali) return;
    const t = ac.currentTime;
    for (const o of olaylar) { const f = EFEKT[o.tip]; if (!f) continue; if (SINIR[o.tip] && t - (son[o.tip] || 0) < SINIR[o.tip]) continue; son[o.tip] = t; f(); }
  }
  return { baslat, isle, ac: () => ac, sessiz: v => { kapali = !!v; }, sessizMi: () => kapali };
})();
