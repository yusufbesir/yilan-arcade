// Rust düşman yapay zekâsı paritesi (kovala, atılgan, nişancı, çırpınan, devasa, sürünen): node tools-dump-ai.js > core/testdata/ai.txt
const TK = require('./src/mantik.js');
const f = v => typeof v === 'number' ? v.toPrecision(17) : (v === true ? 1 : v === false ? 0 : v);
const tipler = ['draugr', 'kurt', 'seidr', 'kargaci', 'buzdev', 'demirkurt', 'yilan', 'albasti', 'kor', 'demirci', 'kok', 'golge'];
for (let sc = 0; sc < 80; sc++) {
  const rg = TK.mulberry(5000 + sc);
  const meta = TK.mirasBos();
  const s = TK.yeniKosu(1500 + sc, meta, null);
  const derinlik = 1 + (sc % 6);
  s.oda = TK.odaUret(91 + sc, 'dinlenme', derinlik, meta, null); s.oda.nesneler = [];
  s.rnd = TK.mulberry(777 + sc);
  s.p.x = 11; s.p.y = 8; s.p.hp = 100000; s.p.maxHp = 100000; s.p.aclik = 100; s.p.susuz = 100;
  const orijinal = [];
  for (let i = 0; i < 6; i++) {
    const tip = tipler[Math.floor(rg() * tipler.length)], tn = TK.DUSMAN[tip];
    const e = { tip, x: 3 + rg() * 16, y: 2 + rg() * 9, r: tn.r, ucar: !!tn.ucar, hp: tn.hp, maxHp: tn.hp, dogum: rg() < 0.2 ? 0.4 : 0, atk: 1 + rg(), faz: 'bekle', fazT: 1 + rg(), kx: rg() < 0.3 ? (rg() - 0.5) * 6 : 0, ky: 0, flas: 0, yanik: rg() < 0.2 ? 2 : 0, olu: false, temasCd: 0, ac: 0, etki: null, elit: false, mini: false, hizK: rg() < 0.3 ? 1.35 : 1, sayac: 0, hedef: 0, hizliT: 0 };
    s.enemies.push(e); orijinal.push(e);
  }
  const g = s.oda.grid;
  const baslik = [sc, derinlik, 777 + sc, g.map(r => r.map(v => v.toString(16)).join('')).join('/'),
    orijinal.map(e => [e.tip, e.x, e.y, e.r, e.hp, e.dogum, e.atk, e.fazT, e.kx, e.yanik, e.hizK, e.ucar ? 1 : 0].map(f).join(',')).join(';')];
  const durum = [];
  for (let i = 1; i <= 360; i++) {
    TK.adim(s, {}, 1 / 60);
    if (i % 40 === 0) durum.push([s.p.hp, s.p.inv, s.mermiler.length, s.tuzaklar.length, ...s.mermiler.flatMap(m => [m.x, m.y]), ...orijinal.flatMap(e => [e.x, e.y, e.hp, e.olu ? 1 : 0, e.fazT, e.atk, e.sayac, e.temasCd, e.hizliT, e.faz === 'bekle' ? 0 : e.faz === 'hazir' ? 1 : e.faz === 'hamle' ? 2 : e.faz === 'gorunur' ? 4 : 3])].map(f).join(','));
  }
  console.log(baslik.join(' ') + ' ' + durum.join(';'));
}
