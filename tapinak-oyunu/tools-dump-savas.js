// Rust savaş paritesi (savur, köz, düşman hasarı): node tools-dump-savas.js > core/testdata/savas.txt
const TK = require('./src/mantik.js');
const tipler = ['draugr', 'kurt', 'demirci', 'buzdev', 'kargaci'];
const etkiler = [null, 'zirh', 'hizli'];
const f = v => typeof v === 'number' ? v.toPrecision(17) : (v === true ? 1 : v === false ? 0 : v);
for (let sc = 0; sc < 80; sc++) {
  const rg = TK.mulberry(2000 + sc);
  const meta = TK.mirasBos(); meta.seviye.guc = sc % 4; meta.seviye.kul = sc % 3; meta.yetenek.kirik = false;
  const s = TK.yeniKosu(900 + sc, meta, null);
  s.oda = TK.odaUret(31 + sc, 'dinlenme', 2, meta, null); s.oda.nesneler = []; s.oda.risk = sc % 7 === 0; s.enemies = [];
  s.armagan = { ruzgar: 0, bilek: sc % 3, golge: 0, tilsim: 0, keskin: sc % 2, kivilcim: sc % 4 === 1 ? 1 : 0, alev: sc % 5 === 0 ? 1 : 0, kan: 0 };
  s.p.x = 11; s.p.y = 7; s.p.aclik = sc % 6 === 0 ? 10 : 100;
  const n = 4 + (sc % 4);
  for (let i = 0; i < n; i++) {
    const tip = tipler[Math.floor(rg() * tipler.length)], tn = TK.DUSMAN[tip];
    const etki = etkiler[Math.floor(rg() * 3)];
    s.enemies.push({ tip, x: 11 + (rg() - 0.5) * 5, y: 7 + (rg() - 0.5) * 5, r: tn.r, ucar: false, hp: tn.hp, maxHp: tn.hp, dogum: rg() < 0.15 ? 0.5 : 0, atk: 1, faz: rg() < 0.1 ? 'hayalet' : 'bekle', fazT: 1, kx: 0, ky: 0, flas: 0, yanik: 0, olu: false, temasCd: 0, ac: rg() * 6.28, etki, elit: false, mini: rg() < 0.2, hizK: 1, sayac: 0, hedef: 0, hizliT: 0 });
  }
  const satir = [sc, meta.seviye.guc, meta.seviye.kul, s.oda.risk ? 1 : 0, s.armagan.bilek, s.armagan.keskin, s.armagan.kivilcim, s.armagan.alev, s.p.aclik,
    s.enemies.map(e => [e.tip, e.x.toPrecision(17), e.y.toPrecision(17), e.r.toPrecision(17), e.hp.toPrecision(17), e.dogum, e.faz, e.ac.toPrecision(17), e.etki || '-', e.mini ? 1 : 0, TK.DUSMAN[e.tip].kul].join(',')).join(';')];
  const sonuc = [];
  for (let k = 0; k < 6; k++) {
    const aci = rg() * 6.28;
    if (k % 3 === 2) { s.p.kozYuk = 2; s.mermiler.length = 0; TK.kozAt(s, aci); const m = s.mermiler[0]; sonuc.push(['K', s.p.kozYuk, m.x, m.y, m.vx, m.vy, m.hasar, m.omur, m.delme].map(f).join(',')); }
    else { s.p.swingCd = 0; TK.savur(s, aci); sonuc.push(['S', s.p.swingT, s.p.swingCd, s.p.swingYon, s.p.swingId, s.kul, s.oldurme, ...s.enemies.flatMap(e => [e.hp, e.kx, e.ky, e.flas, e.yanik, e.olu])].map(f).join(',')); }
  }
  console.log(satir.join(' ') + ' ' + sonuc.join(';'));
}
