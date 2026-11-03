// migrate.js userData taşıma: eski "Yılan Arcade" (noktasız ı) klasörü yeni ada kopyalanır.
const fs = require('fs'), os = require('os'), path = require('path');
const { migrateUserData } = require('../migrate.js');
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-'));
const oldDir = path.join(base, 'Yılan Arcade');
fs.mkdirSync(path.join(oldDir, 'Local Storage'), { recursive: true });
fs.writeFileSync(path.join(oldDir, 'Local Storage', 'x.txt'), 'rekor');
const newDir = path.join(base, 'Twilight of the Serpents');
const from = migrateUserData(newDir, base);
const ok1 = from === 'Yılan Arcade' && fs.readFileSync(path.join(newDir, 'Local Storage', 'x.txt'), 'utf8') === 'rekor';
const again = migrateUserData(newDir, base); // ikinci çağrı dokunmaz
const ok2 = again === null;
const none = migrateUserData(path.join(base, 'bos'), path.join(base, 'yok'));
console.log({ from, again, none }, ok1 && ok2 && none === null ? 'GEÇTİ' : 'BAŞARISIZ');
if (!(ok1 && ok2 && none === null)) process.exit(1);
