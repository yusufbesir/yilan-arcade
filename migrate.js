// Eski ürün adlarının kullanıcı verisi (rekor, ilerleme) yeni ürün adına taşınır; Electron'a bağımlı değildir, test edilebilir.
const fs = require('fs');
const path = require('path');
const OLD_NAMES = ['Yılan Arcade', 'Yilan Arcade', 'Ragnarök', 'Ragnarok', 'Sampo'];
function migrateUserData(newDir, parentDir) {
  if (fs.existsSync(newDir)) return null;
  for (const name of OLD_NAMES) {
    const oldDir = path.join(parentDir, name);
    if (fs.existsSync(oldDir)) {
      // Önce geçici klasöre kopyala, sonra yeniden adlandır: yarıda kalırsa eksik klasör kalmaz. Sembolik bağlantılar kopyalanmaz.
      const tmp = newDir + '.tasima-' + process.pid;
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
        fs.cpSync(oldDir, tmp, { recursive: true, filter: (src) => !fs.lstatSync(src).isSymbolicLink() });
        fs.renameSync(tmp, newDir);
      } catch (e) { fs.rmSync(tmp, { recursive: true, force: true }); throw e; }
      return name;
    }
  }
  return null;
}
module.exports = { migrateUserData, OLD_NAMES };
