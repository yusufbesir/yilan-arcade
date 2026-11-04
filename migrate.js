// Eski ürün adlarının kullanıcı verisi (rekor, ilerleme) yeni ürün adına taşınır; Electron'a bağımlı değildir, test edilebilir.
const fs = require('fs');
const path = require('path');
const OLD_NAMES = ['Yılan Arcade', 'Yilan Arcade', 'Ragnarök', 'Ragnarok', 'Sampo'];
// Yarıda kesilmiş (çökmüş) bir önceki taşımanın .tasima-<pid> artığını siler; pid hâlâ yaşıyorsa (eşzamanlı süreç) dokunmaz.
function temizleArtik(newDir) {
  const on = path.basename(newDir) + '.tasima-';
  let adlar = []; try { adlar = fs.readdirSync(path.dirname(newDir)); } catch (e) { return; }
  for (const ad of adlar) {
    if (!ad.startsWith(on)) continue;
    const pid = Number(ad.slice(on.length));
    if (!Number.isInteger(pid) || pid === process.pid) continue;
    let yasiyor = false; try { process.kill(pid, 0); yasiyor = true; } catch (e) { yasiyor = e.code === 'EPERM'; }
    if (!yasiyor) fs.rmSync(path.join(path.dirname(newDir), ad), { recursive: true, force: true });
  }
}
function migrateUserData(newDir, parentDir) {
  if (fs.existsSync(newDir)) return null;
  for (const name of OLD_NAMES) {
    const oldDir = path.join(parentDir, name);
    if (fs.existsSync(oldDir)) {
      // Önce geçici klasöre kopyala, sonra yeniden adlandır: yarıda kalırsa eksik klasör kalmaz. Sembolik bağlantılar kopyalanmaz.
      const tmp = newDir + '.tasima-' + process.pid;
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
        temizleArtik(newDir);
        fs.cpSync(oldDir, tmp, { recursive: true, filter: (src) => !fs.lstatSync(src).isSymbolicLink() });
        fs.renameSync(tmp, newDir);
      } catch (e) {
        fs.rmSync(tmp, { recursive: true, force: true });
        if (fs.existsSync(newDir)) return null; // eşzamanlı başka bir süreç taşımayı bitirmiş: çift kopya yok
        throw e;
      }
      return name;
    }
  }
  return null;
}
module.exports = { migrateUserData, OLD_NAMES };
