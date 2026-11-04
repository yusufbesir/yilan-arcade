// Rust parity için JS oda ızgaralarını döker: node tools-dump-oda.js > core/testdata/odalar.txt
const TK = require('./src/mantik.js');
const turler = ['savas', 'elit', 'dinlenme', 'pazar', 'baslangic', 'boss', 'gizli'];
const gecm = [[], ['acik', 'halka'], ['izgara', 'nehir', 'ada'], ['dar', 'kose', 'kume', 'capraz']];
const kg = [[], ['pusu'], ['surunu', 'agir'], ['karisik']];
for (let seed = 1; seed <= 60; seed++) for (const tur of turler) for (let d = 0; d <= 12; d++) for (let gi = 0; gi < gecm.length; gi++) {
  const o = TK.odaUret(seed * 7919 + d, tur, d, null, { sablon: gecm[gi], kadro: kg[gi] });
  console.log([seed * 7919 + d, tur, d, gecm[gi].join(','), o.sablon || '-', o.gizli ? 1 : 0, o.grid.map(r => r.map(v => v.toString(16)).join('')).join('/'), o.nesneler.some(n => n.tur === 'lanet') ? 1 : 0, kg[gi].join(','), (o.kadro || '-') + ' ' + (o.odul || '-') + ' ' + o.dalgalar.map(w => w.map(e => [e.tip, e.rol, e.etki || '', e.elit ? 1 : 0].join(':')).join(',')).join('|')].join(' '));
}
