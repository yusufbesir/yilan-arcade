// Pişmiş 3B sprite'lar: harita ile PNG'ler tutarlı mı, hepsi yükleniyor mu (404 yok), boyutlar doğru mu,
// toplam ≤ 8 MB mı (PNG + gömülü kopya), düşman animasyon kareleri (12: 8 bekleme + 4 saldırı) ve ölüm animasyonu, gömülü kopya PNG ile aynı mı, tuval kirlenmiyor mu, klasik ve Tapınak çizimi sprite'larla hatasız dönüyor mu.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const src = path.resolve(__dirname, '../src');
  const map = JSON.parse(/SPRITE_MAP = (\{[\s\S]*?\});\n/.exec(fs.readFileSync(path.join(src, 'sprite-map.js'), 'utf8'))[1]).sprites;
  const sonuc = {};
  let toplam = 0;
  sonuc.dosyalar = Object.keys(map).every(k => {
    const f = path.join(src, map[k].file);
    if (!fs.existsSync(f)) return false;
    toplam += fs.statSync(f).size;
    return true;
  });
  toplam += fs.statSync(path.join(src, 'sprite-map.js')).size;
  sonuc.boyut = toplam <= 8 * 1024 * 1024;
  // Düşman/boss şeritleri: 12 kare, adlandırılmış aralıklar bekleme [0,8] + saldırı [8,4]
  sonuc.dusmanKare = ['hortlak', 'cadi', 'muhafiz', 'jarl'].every(k => map[k].n === 12 && map[k].anim &&
    map[k].anim.bekle[0] === 0 && map[k].anim.bekle[1] === 8 && map[k].anim.saldiri[0] === 8 && map[k].anim.saldiri[1] === 4);
  sonuc.gerekli = ['head', 'head_cb', 'seg', 'linkh', 'linkv', 'tail', 'apple', 'apple_rot', 'star', 'crystal_shield', 'crystal_speed', 'crystal_invincible', 'crystal_clear', 'hortlak', 'cadi', 'muhafiz', 'jarl', 'block', 'block_ember', 'torch', 'runestone'].every(k => map[k]);

  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 2 });
  const hatalar = [], kotu = [];
  p.on('pageerror', e => hatalar.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') hatalar.push(m.text()); });
  p.on('requestfailed', r => kotu.push(r.url()));
  p.on('response', r => { if (r.status() >= 400) kotu.push(r.url()); });
  await p.goto('file://' + path.join(src, 'index.html') + '?test=1');
  await p.waitForFunction(() => window.Sprites && Sprites.durum().yuklenen + Sprites.durum().hata.length >= Sprites.durum().toplam, null, { timeout: 10000 });
  const r = await p.evaluate(() => {
    const o = {};
    const d = Sprites.durum();
    o.yuklendi = d.yuklenen === d.toplam && d.hata.length === 0;
    return o;
  });
  Object.assign(sonuc, r);
  // Gömülü data: URI'ler diskteki PNG'lerle bayt bayt aynı (bake.js ikisini birlikte yazar)
  const gomulu = await p.evaluate(() => window.SPRITE_DATA || {});
  sonuc.gomuluAyni = Object.keys(map).every(k => gomulu[k] === 'data:image/png;base64,' + fs.readFileSync(path.join(src, map[k].file)).toString('base64'));
  // Tuval kirlenmez (file:// altında getImageData çalışmalı)
  sonuc.kirlenmez = await p.evaluate(() => new Promise(res => { SnakeGame.startClassic(); setTimeout(() => { try { document.getElementById('gameCanvas').getContext('2d').getImageData(0, 0, 4, 4); res(true); } catch (e) { res(false); } }, 300); }));
  // Görüntü boyutları haritayla aynı (yatay şerit: w*n x h), çapa kare içinde
  sonuc.olcu = await p.evaluate(() => Promise.all(Object.keys(Sprites.MAP).map(k => new Promise(res => {
    const m = Sprites.MAP[k], im = new Image();
    im.onload = () => res(im.naturalWidth === m.w * m.n && im.naturalHeight === m.h && m.ax >= 0 && m.ax <= m.w && m.ay >= 0 && m.ay <= m.h);
    im.onerror = () => res(false);
    im.src = m.file;
  }))).then(a => a.every(Boolean)));
  // Çizim: önceden ölçeklenmiş kare, ters çevirme, kırpma; olmayan ad false döner (eski çizime düşüş)
  sonuc.ciz = await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 200; c.height = 200;
    const g = c.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0);
    return Sprites.draw(g, 'hortlak', 3, 50, 50, 1.35, true) && Sprites.draw(g, 'head', 5, 50, 50, 1.2) &&
      Sprites.drawCrop(g, 'linkh', 1, 50, 50, 0.8, 20, null) && Sprites.draw(g, 'yok-boyle-bir-sey', 0, 0, 0, 1) === false && Sprites.has('jarl');
  });
  // Animasyon API'si: anim aralığı, son kareler çizilir, beyaz flaş siluet yalnız gövdeyi boyar (gölge hariç)
  sonuc.animApi = await p.evaluate(() => {
    const a = Sprites.anim('cadi', 'saldiri'), b = Sprites.anim('jarl', 'bekle');
    if (!a || a[0] !== 8 || !b || b[1] !== 8 || Sprites.anim('apple', 'bekle') !== null) return false;
    const c = document.createElement('canvas'); c.width = 240; c.height = 240;
    const g = c.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0);
    if (!['hortlak', 'cadi', 'muhafiz', 'jarl'].every(n => Sprites.draw(g, n, 11, 60, 90, 1.5) && Sprites.draw(g, n, 7, 60, 90, 1.5, true))) return false;
    const h = document.createElement('canvas'); h.width = 240; h.height = 240;
    const hg = h.getContext('2d'); hg.setTransform(2, 0, 0, 2, 0, 0);
    if (!Sprites.drawTint(hg, 'muhafiz', 0, 60, 90, 1.5, false, '#ffffff', 1) || Sprites.drawTint(hg, 'muhafiz', 0, 60, 90, 1.5, false, '#fff', 0) !== false) return false;
    const d = hg.getImageData(0, 0, 240, 240).data;
    let beyaz = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 200 && d[i - 1] > 200) beyaz++;
    return beyaz > 300;
  });
  // Oyun: klasik + Tapınak (düşman ve boss) birkaç kare sprite ile çizilir, hata yok
  sonuc.oyun = await p.evaluate(() => new Promise(res => {
    SnakeGame.startClassic();
    setTimeout(() => {
      SnakeGame.startTapinak(7);
      const R = SnakeGame._tapinak.run();
      const oda = R.odalar[R.oda];
      const mk = (tur, x, y) => ({ tur, x, y, hp: 2, max: 2, faz: 1, sarj: 5, flash: 0, zehirT: 0, cd: 99, vx: 0, vy: 0 });
      oda.dusmanlar = [mk('kovalayan', 10, 10), mk('atici', 14, 10), mk('zirhli', 18, 10)];
      oda.boss = { x: 24, y: 9, r: 1.7, hp: 60, max: 60, faz: 2, uyan: 0, t: 0, hedef: { x: 24, y: 10 }, sarj: 0, hamle: 0, hx: 0, hy: 1, aci: 0, flash: 0, govdeCd: 0 };
      SnakeGame._debug.get().state.paused = true;
      setTimeout(() => res(true), 400);
    }, 400);
  }));
  // Ölüm animasyonu: mantık ölüyü listeden siler, çizim tarafı (WeakMap) kısa bir parçalanma/solma oynatır
  sonuc.olum = await p.evaluate(() => new Promise(res => {
    const R = SnakeGame._tapinak.run(), oda = R.odalar[R.oda];
    const e = oda.dusmanlar[0];
    oda.dusmanlar.splice(0, 1); e.hp = 0;
    const b = oda.boss; oda.boss = null; b.hp = 0;
    setTimeout(() => {
      const n1 = Tapinak._olumSayisi(oda);
      setTimeout(() => res(n1 === 2 && Tapinak._olumSayisi(oda) === 0 && !('_olum' in e)), 1900);
    }, 120);
  }));
  await b.close();
  sonuc.hatasiz = hatalar.length === 0;
  sonuc.yok404 = kotu.length === 0;
  console.log(JSON.stringify(sonuc), 'toplam', (toplam / 1024).toFixed(0) + ' KB', hatalar.concat(kotu).join(' | '));
  if (Object.values(sonuc).some(v => v !== true)) process.exit(1);
  console.log('GEÇTİ');
})();
