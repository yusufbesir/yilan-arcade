// Blender prosedürel dokular (0.9.23): dosyalar var, 512x512 JPEG, pakette, KIND'de ve Ek özellik satırı kapalı gelir.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const kok = path.resolve(__dirname, '..');
const KIM = ['BuzKristal01', 'LavBazalt01', 'YilanDeriNors', 'YilanDeriKor', 'YilanDeriBuz'];
const HAR = ['Color', 'NormalGL', 'Roughness', 'AmbientOcclusion'];
function jpgBoyut(b) {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xFF) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xC0 && m <= 0xC3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return null;
}
KIM.forEach(id => HAR.forEach(h => {
  const f = path.join(kok, 'src/img/tex', id, id + '_' + h + '.jpg');
  assert(fs.existsSync(f), f);
  const b = fs.readFileSync(f);
  assert.strictEqual(b[0], 0xFF); assert.strictEqual(b[1], 0xD8);
  assert.deepStrictEqual(jpgBoyut(b), [512, 512], id + '_' + h);
}));
const pack = fs.readFileSync(path.join(kok, 'src/img/tex/pack.js'), 'utf8');
['BuzKristal01_Color', 'BuzKristal01_NormalGL', 'BuzKristal01_Roughness', 'LavBazalt01_Color', 'LavBazalt01_NormalGL', 'LavBazalt01_Roughness', 'YilanDeriNors_Color', 'YilanDeriKor_Color', 'YilanDeriBuz_Color']
  .forEach(k => assert(pack.includes('"' + k + '"'), 'pack: ' + k));
const doku = fs.readFileSync(path.join(kok, 'src/doku.js'), 'utf8');
assert(/'floor\.buz': \{ tex: 'BuzKristal01'/.test(doku)); assert(/'floor\.lav': \{ tex: 'LavBazalt01'/.test(doku));
const game = fs.readFileSync(path.join(kok, 'src/game.js'), 'utf8');
assert(/\['yilanderi', 'YILAN DERİSİ',[^\n]*, false\]/.test(game), 'Ek özellik satırı kapalı gelmeli');
// eski ambientCG klasörleri yerinde
['Tiles141', 'Rock058', 'Lava004'].forEach(id => assert(fs.existsSync(path.join(kok, 'src/img/tex', id, id + '_Color.jpg'))));
console.log('blender-doku.test: OK');
