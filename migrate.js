// Eski ürün adlarının kullanıcı verisi (rekor, ilerleme) yeni ürün adına taşınır; Electron'a bağımlı değildir, test edilebilir.
const fs = require('fs');
const path = require('path');
const OLD_NAMES = ['Yılan Arcade', 'Yilan Arcade', 'Ragnarök', 'Ragnarok', 'Sampo'];
function migrateUserData(newDir, parentDir) {
  if (fs.existsSync(newDir)) return null;
  for (const name of OLD_NAMES) {
    const oldDir = path.join(parentDir, name);
    if (fs.existsSync(oldDir)) { fs.cpSync(oldDir, newDir, { recursive: true }); return name; }
  }
  return null;
}
module.exports = { migrateUserData, OLD_NAMES };
