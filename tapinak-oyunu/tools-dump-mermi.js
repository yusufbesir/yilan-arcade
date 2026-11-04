// Rust mermi+tuzak paritesi: node tools-dump-mermi.js > core/testdata/mermi.txt
const TK = require('./src/mantik.js');
const T = TK.T;
const f = v => typeof v === 'number' ? v.toPrecision(17) : (v === true ? 1 : v === false ? 0 : v);
for (let sc = 0; sc < 60; sc++) {
  const rg = TK.mulberry(3000 + sc);
  const meta = TK.mirasBos(); meta.seviye.guc = sc % 3; meta.seviye.kul = sc % 2;
  const s = TK.yeniKosu(1200 + sc, meta, null);
  s.oda = TK.odaUret(61 + sc, 'dinlenme', 2, meta, null); s.oda.nesneler = []; s.oda.risk = sc % 5 === 0;
  s.armagan = { ruzgar: 0, bilek: 0, golge: 0, tilsim: 0, keskin: sc % 2, kivilcim: 0, alev: sc % 4 === 0 ? 1 : 0, kan: 0 };
  s.p.x = 11; s.p.y = 8; s.p.hp = 1000; s.p.maxHp = 1000; s.p.aclik = 100; s.p.susuz = 100;
  const orijinal = [];
  const tipler = ['draugr', 'kurt', 'demirci', 'buzdev'];
  const mk = (tip, x, y, hp) => { const tn = TK.DUSMAN[tip]; const e = { tip, x, y, r: tn.r, ucar: false, hp: hp || tn.hp, maxHp: hp || tn.hp, dogum: 0, atk: 1, faz: 'bekle', fazT: 1, kx: 0, ky: 0, flas: 0, yanik: 0, olu: false, temasCd: 0, ac: rg() * 6.28, etki: null, elit: false, mini: false, hizK: 1, sayac: 0, hedef: 0, hizliT: 0, sersem: 1e9 }; s.enemies.push(e); orijinal.push(e); return e; };
  for (let i = 0; i < 4; i++) mk(tipler[Math.floor(rg() * 4)], 4 + rg() * 14, 3 + rg() * 8, 6 + rg() * 20);
  mk('buzdev', 20.5, 12.5, 1e9);
  s.mermiler = [];
  for (let i = 0; i < 6; i++) { const a = rg() * 6.28; s.mermiler.push({ x: s.p.x, y: s.p.y, vx: Math.cos(a) * 11, vy: Math.sin(a) * 11, dost: true, dusman: false, hasar: 15 * TK.hasarCarpan(s), r: 0.2, omur: 1.4, delme: Math.floor(rg() * 3), vuruldu: new Set() }); }
  for (let i = 0; i < 5; i++) { const x = 2 + rg() * 18, y = 2 + rg() * 9, a = Math.atan2(s.p.y - y, s.p.x - x) + (rg() - 0.5) * 0.3; s.mermiler.push({ x, y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, dost: false, dusman: true, hasar: 8 + Math.floor(rg() * 6), r: 0.2, omur: 5, delme: 0, vuruldu: new Set() }); }
  s.tuzaklar = [];
  for (let i = 0; i < 3; i++) s.tuzaklar.push({ x: s.p.x + (rg() - 0.5) * 2, y: s.p.y + (rg() - 0.5) * 2, r: 1.1, t: 0.3 + rg() * 0.8, m: 1, hasar: 16 });
  const g = s.oda.grid;
  const baslik = [sc, meta.seviye.guc, meta.seviye.kul, s.oda.risk ? 1 : 0, s.armagan.keskin, s.armagan.alev, g.map(r => r.map(v => v.toString(16)).join('')).join('/'),
    orijinal.map(e => [e.tip, e.x.toPrecision(17), e.y.toPrecision(17), e.r.toPrecision(17), e.hp.toPrecision(17), e.ac.toPrecision(17), TK.DUSMAN[e.tip].kul].join(',')).join(';'),
    s.mermiler.map(m => [m.x, m.y, m.vx, m.vy, m.dusman ? 1 : 0, m.hasar, m.omur, m.delme].map(f).join(',')).join(';'),
    s.tuzaklar.map(t => [t.x, t.y, t.r, t.t, t.hasar].map(f).join(',')).join(';')];
  const durum = [];
  for (let i = 1; i <= 120; i++) {
    TK.adim(s, {}, 1 / 60);
    if (i % 20 === 0) durum.push([s.p.hp, s.p.inv, s.kul, s.oldurme, s.mermiler.length, s.tuzaklar.length, ...s.mermiler.flatMap(m => [m.x, m.y, m.omur, m.delme]), ...orijinal.flatMap(e => [e.hp, e.olu ? 1 : 0])].map(f).join(','));
  }
  console.log(baslik.join(' ') + ' ' + durum.join(';'));
}
