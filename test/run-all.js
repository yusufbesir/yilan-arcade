// Tüm testleri sırayla çalıştırır; biri düşse de kalanlar koşar, sonda özet verir.
const { spawnSync } = require('child_process');
const liste = [
  "test/ek.test.js",
  "test/bullet-mode.test.js",
  "test/tailgun-mode.test.js",
  "test/survivor-mode.test.js",
  "test/new-modes.test.js",
  "test/font-csp.test.js",
  "test/sound.test.js",
  "test/settings-ach.test.js",
  "test/migrate.test.js",
  "test/gorsel.test.js",
  "test/tur4.test.js",
  "test/guvenlik.test.js",
  "test/arastirma.test.js",
  "test/miras.test.js",
  "test/tapinak.test.js",
  "test/doku.test.js",
  "test/sprites.test.js",
  "test/govde.test.js",
  "test/arayuz.test.js",
  "test/fuzz.test.js",
  "test/odak.test.js",
  "test/gunluk.test.js",
  "test/gamepad.test.js",
  "test/hata.test.js",
  "test/erisim.test.js",
  "test/ses-odak.test.js",
  "test/bellek-denge.test.js",
  "test/duzeltme2.test.js",
  "test/isik.test.js",
  "test/market.test.js",
  "test/tema.test.js",
  "test/klavye.test.js",
  "test/tron-core.test.js",
  "test/tron-wasm.test.js",
  "test/engel.test.js",
  "test/yilan-doku.test.js",
  "test/survivor-core.test.js",
  "test/ozellik096.test.js"
];
const dusen = [];
for (const f of liste) {
  const r = spawnSync(process.execPath, [f], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) dusen.push(f);
}
console.log('\nTEST ÖZETİ: ' + (liste.length - dusen.length) + '/' + liste.length + ' geçti' + (dusen.length ? '; DÜŞEN: ' + dusen.join(', ') : ''));
process.exit(dusen.length ? 1 : 0);
