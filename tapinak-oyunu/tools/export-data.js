// JS tablolarını Rust/Python için JSON'a döker (şimdilik JS kaynak; Godot sürümü dengeye ulaşınca kaynak data/ olur).
// Kullanım: node tools/export-data.js
const fs = require('fs'), path = require('path');
const TK = require('../src/mantik.js');
const out = path.join(__dirname, '..', 'core', 'data');
const yaz = (ad, v) => fs.writeFileSync(path.join(out, ad + '.json'), JSON.stringify(v, null, 1) + '\n');
yaz('biyomlar', TK.BIYOMLAR.map(b => ({ id: b.id, ad: b.ad, alt: b.alt, bolum: b.bolum, boss: b.boss, kucuk: b.kucuk, menzil: b.menzil, agir: b.agir, ozel: b.ozel })));
yaz('dusmanlar', Object.fromEntries(Object.entries(TK.DUSMAN).map(([k, v]) => [k, v])));
yaz('armaganlar', { sira: TK.ARMAGAN_SIRA, tablo: TK.ARMAGANLAR, eslesme: TK.ESLESME });
yaz('muhurler', TK.MUHURLER);
yaz('miras', Object.fromEntries(Object.entries(TK.MIRAS).map(([k, v]) => [k, { ad: v.ad, acik: v.acik, maks: v.maks, maliyet: Array.from({ length: v.maks }, (_, n) => v.maliyet(n)) }])));
yaz('nadirlik', TK.NADIRLIK);
yaz('sablonlar', TK.SABLON_ADLARI);
console.log('core/data/*.json yazıldı');
