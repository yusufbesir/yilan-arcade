// Tüm testleri sırayla çalıştırır; biri düşse de kalanlar koşar, sonda özet verir.
// Liste package.json içindeki "test" betiğinden okunur (tek kaynak).
const { spawnSync } = require('child_process');
const betik = require('../package.json').scripts.test;
const liste = (betik.match(/node (test\/[\w.-]+\.js)/g) || []).map(s => s.replace('node ', ''));
const dusen = [];
for (const f of liste) {
  const r = spawnSync(process.execPath, [f], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) dusen.push(f);
}
console.log('\nTEST ÖZETİ: ' + (liste.length - dusen.length) + '/' + liste.length + ' geçti' + (dusen.length ? '; DÜŞEN: ' + dusen.join(', ') : ''));
process.exit(dusen.length ? 1 : 0);
