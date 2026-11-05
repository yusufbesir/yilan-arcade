// Doku paketleyici: src/img/tex/<ID>/<ID>_<Harita>.jpg dosyalarını tek bir data-URI paketine (src/img/tex/pack.js) toplar.
// Neden: file:// ve Electron'da dosyadan yüklenen görseller tuvali "kirletir" (getImageData SecurityError verir);
// data: URI görselleri temiz kalır, böylece normal haritadan ışıklandırma piksel döngüsüyle hesaplanabilir.
// Kullanım: node build/doku-pack.js
const fs = require('fs');
const path = require('path');
const kok = path.join(__dirname, '..', 'src', 'img', 'tex');
const LISTE = {
    PavingStones138: ['Color', 'NormalGL', 'Roughness'],
    Rock064: ['Color', 'NormalGL', 'Roughness'],
    Rock058: ['Color', 'NormalGL', 'Roughness'],
    Tiles141: ['Color', 'NormalGL', 'Roughness'],
    Lava004: ['Color', 'NormalGL', 'Roughness'],
    Moss002: ['Color', 'NormalGL', 'Roughness'],
    Ground068: ['Color', 'NormalGL', 'Roughness'],
    Leather008: ['Color', 'NormalGL', 'Roughness'],
    // 0.9.23: Blender ile üretilen prosedürel setler (tools/blender/uret.py); yılan derisi yalnız Color paketlenir
    BuzKristal01: ['Color', 'NormalGL', 'Roughness'],
    LavBazalt01: ['Color', 'NormalGL', 'Roughness'],
    YilanDeriNors: ['Color'],
    YilanDeriKor: ['Color'],
    YilanDeriBuz: ['Color']
};
const pack = {};
Object.keys(LISTE).forEach(id => LISTE[id].forEach(h => {
    const f = path.join(kok, id, id + '_' + h + '.jpg');
    pack[id + '_' + h] = 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
}));
const cikti = '// Otomatik üretildi: node build/doku-pack.js (ambientCG CC0 + Blender prosedürel dokular, bkz. CREDITS.md)\nwindow.DOKU_PACK = ' + JSON.stringify(pack) + ';\n';
fs.writeFileSync(path.join(kok, 'pack.js'), cikti);
console.log('pack.js', (cikti.length / 1024).toFixed(0) + ' KB', Object.keys(pack).length + ' harita');
