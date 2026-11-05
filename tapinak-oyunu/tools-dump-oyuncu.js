// Rust oyuncu adımı paritesi: node tools-dump-oyuncu.js > core/testdata/oyuncu.txt
const TK = require('./src/mantik.js');
const T = TK.T;
for (let sc = 0; sc < 60; sc++) {
  const rg = TK.mulberry(1000 + sc);
  const meta = TK.mirasBos();
  meta.seviye.iase = sc % 4; meta.seviye.guc = sc % 3; meta.yetenek.sicrama = sc % 2 === 0;
  const s = TK.yeniKosu(500 + sc, meta, null);
  s.muhur = { kitlik: sc % 5 === 0 };
  s.oda = TK.odaUret(77 + sc, 'dinlenme', 2, meta, null); s.enemies = []; s.oda.nesneler = [];
  const g = s.oda.grid;
  // elle tehlike: uçurum, lav, diken şeritleri
  for (let y = 3; y < 10; y++) { g[y][5] = T.UCURUM; g[y][6] = T.LAV; g[y][7] = T.SIVRI; g[y][16] = T.UCURUM; g[y][17] = T.SUTUN; }
  s.armagan = { ruzgar: sc % 3, bilek: sc % 2, golge: (sc >> 1) % 3, tilsim: sc % 4 === 3 ? 1 : 0, keskin: 0, kivilcim: 0 };
  s.p.x = 11; s.p.y = 11.4; s.p.kozMaks = 2; s.p.kozYuk = 2;
  const satir = [sc, meta.seviye.iase, meta.seviye.guc, meta.yetenek.sicrama ? 1 : 0, s.muhur.kitlik ? 1 : 0, s.armagan.ruzgar, s.armagan.bilek, s.armagan.golge, s.armagan.tilsim, g.map(r => r.map(v => v.toString(16)).join('')).join('/')];
  const durum = [];
  for (let i = 1; i <= 900; i++) {
    const girdi = { mx: rg() * 2 - 1, my: rg() * 2 - 1, atilim: rg() < 0.02, savur: rg() < 0.05, koz: rg() < 0.03 };
    girdi.hx = 11 + (rg() - 0.5) * 10; girdi.hy = 7 + (rg() - 0.5) * 8;
    TK.adim(s, girdi, 1 / 60);
    if (i % 100 === 0) { const p = s.p; durum.push([p.x, p.y, p.dir, p.hp, p.aclik, p.susuz, p.dashT, p.dashCd, p.swingT, p.swingCd, p.inv, p.kozYuk, s.bitti ? 1 : 0].map(v => typeof v === 'number' ? v.toPrecision(17) : v).join(',')); }
  }
  console.log(satir.join(' ') + ' ' + durum.join(';'));
}
