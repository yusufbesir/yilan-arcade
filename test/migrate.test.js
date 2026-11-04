// migrate.js userData taşıma testleri (Electron gerekmez; os.tmpdir içinde geçici klasörler).
// Senaryolar: temel taşıma; kaynak yok; hedef zaten var; kaynakta symlink (atlanır);
// yarıda kalmış .tasima-<pid> artığı; aynı anda iki çalıştırma (farklı pid). Veri kaybı / çift kopya olmamalı.
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');
const MIG = path.join(__dirname, '..', 'migrate.js');
const { migrateUserData } = require(MIG);
const NEW = 'Twilight of the Serpents', OLD = 'Yılan Arcade';
const sonuc = [];
function kontrol(ad, ok, ek) { sonuc.push({ ad, ok }); console.log((ok ? 'GEÇTİ  ' : 'BAŞARISIZ ') + ad + (ek ? ' — ' + ek : '')); }
function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'tw-mig-')); }
function kaynakYap(base, dosyaSayisi = 3) {
  const oldDir = path.join(base, OLD);
  fs.mkdirSync(path.join(oldDir, 'Local Storage'), { recursive: true });
  for (let i = 0; i < dosyaSayisi; i++) fs.writeFileSync(path.join(oldDir, 'Local Storage', 'f' + i + '.txt'), 'rekor' + i);
  return oldDir;
}
function listele(dir) { // alt ağacın göreli yol listesi (sıralı); symlink '@', klasör '/'
  const out = [];
  (function yuru(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = path.join(rel, e.name);
      out.push(r + (e.isSymbolicLink() ? '@' : e.isDirectory() ? '/' : ''));
      if (e.isDirectory() && !e.isSymbolicLink()) yuru(path.join(d, e.name), r);
    }
  })(dir, '');
  return out.sort();
}
function artiklar(base) { return fs.readdirSync(base).filter((n) => n.startsWith(NEW + '.tasima-')); }

// 1) Temel taşıma + ikinci çağrı dokunmaz
{
  const base = temp(); kaynakYap(base); const newDir = path.join(base, NEW);
  const from = migrateUserData(newDir, base);
  const ok = from === OLD && fs.readFileSync(path.join(newDir, 'Local Storage', 'f0.txt'), 'utf8') === 'rekor0'
    && fs.existsSync(path.join(base, OLD)) && migrateUserData(newDir, base) === null && artiklar(base).length === 0;
  kontrol('temel taşıma (kaynak korunur, ikinci çağrı null, artık yok)', ok, JSON.stringify({ from, artik: artiklar(base) }));
}
// 2) Kaynak yok
{
  const base = temp(); const newDir = path.join(base, NEW);
  const r = migrateUserData(newDir, base);
  kontrol('kaynak yok → null, hedef oluşmaz', r === null && !fs.existsSync(newDir) && artiklar(base).length === 0);
  const r2 = migrateUserData(path.join(base, 'bos'), path.join(base, 'yok'));
  kontrol('üst klasör yok → null', r2 === null);
}
// 3) Hedef zaten var → dokunulmaz
{
  const base = temp(); kaynakYap(base); const newDir = path.join(base, NEW);
  fs.mkdirSync(newDir); fs.writeFileSync(path.join(newDir, 'yeni.txt'), 'yeni');
  const r = migrateUserData(newDir, base);
  kontrol('hedef var → null, içerik aynı', r === null && JSON.stringify(listele(newDir)) === JSON.stringify(['yeni.txt']) && artiklar(base).length === 0);
}
// 4) Kaynakta symlink (dosya + klasör + kırık) → atlanır, diğerleri kopyalanır
{
  const base = temp(); const oldDir = kaynakYap(base); const newDir = path.join(base, NEW);
  const dis = path.join(base, 'dis'); fs.mkdirSync(dis); fs.writeFileSync(path.join(dis, 'gizli.txt'), 'dis');
  let symOk = true;
  try {
    fs.symlinkSync(path.join(dis, 'gizli.txt'), path.join(oldDir, 'bag-dosya'));
    fs.symlinkSync(dis, path.join(oldDir, 'bag-klasor'), 'dir');
    fs.symlinkSync(path.join(base, 'yok-boyle'), path.join(oldDir, 'bag-kirik'));
  } catch (e) { symOk = false; console.log('symlink oluşturulamadı, senaryo atlandı: ' + e.code); }
  if (symOk) {
    let hata = null, r = null; try { r = migrateUserData(newDir, base); } catch (e) { hata = e; }
    const l = fs.existsSync(newDir) ? listele(newDir) : [];
    const ok = !hata && r === OLD && JSON.stringify(l) === JSON.stringify(['Local Storage/', 'Local Storage/f0.txt', 'Local Storage/f1.txt', 'Local Storage/f2.txt'])
      && fs.existsSync(path.join(dis, 'gizli.txt')) && artiklar(base).length === 0;
    kontrol('symlink atlanır (dosya/klasör/kırık), hedefte bağ yok', ok, hata ? String(hata) : JSON.stringify(l));
  }
}
// 5) Yarıda kalmış .tasima-<başka pid> artığı: taşıma yine tamamlanır, artık temizlenir, çift kopya yok
{
  const base = temp(); kaynakYap(base); const newDir = path.join(base, NEW);
  const olu = newDir + '.tasima-999999'; // yaşamayan bir pid
  fs.mkdirSync(path.join(olu, 'Local Storage'), { recursive: true });
  fs.writeFileSync(path.join(olu, 'Local Storage', 'f0.txt'), 'yarim');
  const r = migrateUserData(newDir, base);
  const ok = r === OLD && fs.readFileSync(path.join(newDir, 'Local Storage', 'f0.txt'), 'utf8') === 'rekor0' && artiklar(base).length === 0;
  kontrol('yarıda kalmış artık: taşıma tam, eski artık temizlendi', ok, JSON.stringify({ r, artik: artiklar(base) }));
}
// 6) Aynı anda iki çalıştırma (iki ayrı süreç, farklı pid): tek kopya, artık yok, veri kaybı yok, hata yok
{
  const base = temp(); kaynakYap(base, 400); const newDir = path.join(base, NEW);
  const kod = 'const m=require(' + JSON.stringify(MIG) + ');try{console.log(JSON.stringify({r:m.migrateUserData(' + JSON.stringify(newDir) + ',' + JSON.stringify(base) + ')}))}catch(e){console.log(JSON.stringify({err:e.code||String(e)}));process.exit(2)}';
  const run = () => new Promise((res) => { const p = spawn(process.execPath, ['-e', kod]); let out = ''; p.stdout.on('data', (d) => { out += d; }); p.on('close', (code) => res({ code, out: out.trim() })); });
  Promise.all([run(), run()]).then(([a, b]) => {
    const beklenen = JSON.stringify(listele(path.join(base, OLD)));
    const sonuclar = [a, b].map((x) => { try { return JSON.parse(x.out); } catch (e) { return { err: x.out }; } });
    const tasiyan = sonuclar.filter((s) => s.r === OLD).length;
    const ok = fs.existsSync(newDir) && JSON.stringify(listele(newDir)) === beklenen && artiklar(base).length === 0
      && tasiyan === 1 && sonuclar.every((s) => !s.err) && a.code === 0 && b.code === 0;
    kontrol('eşzamanlı iki süreç: tek kopya, artık yok, hatasız', ok, JSON.stringify({ sonuclar, artik: artiklar(base) }));
    bitir();
  });
}
function bitir() {
  const hepsi = sonuc.every((s) => s.ok);
  console.log(hepsi ? 'GEÇTİ (' + sonuc.length + ' kontrol)' : 'BAŞARISIZ');
  process.exit(hepsi ? 0 : 1);
}
