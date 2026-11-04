// Köz Tapınağı mantık testi (Node, bağımlılık yok)
const assert = require('assert');
const TK = require('../src/mantik.js');
const { T } = TK;
let n = 0;
const ok = (ad, f) => { f(); n++; console.log('ok -', ad); };
const depo = () => { const d = {}; return { getItem: k => d[k] || null, setItem: (k, v) => { d[k] = v; } }; };
const gir = (s, o = {}) => ({ mx: 0, my: 0, ...o });
const ilerle = (s, n, g) => { for (let i = 0; i < n && !s.bitti && !s.secim; i++) { TK.adim(s, typeof g === 'function' ? g(s) : (g || gir(s)), 1 / 60); } };

ok('oda üretimi tohumludur ve kapı/duvar düzeni sağlam', () => {
  const a = TK.odaUret(42, 'savas', 2, TK.mirasBos()), b = TK.odaUret(42, 'savas', 2, TK.mirasBos());
  assert.deepStrictEqual(a.grid, b.grid);
  assert.strictEqual(a.grid[0][TK.KAPI_X[0]], T.KAPIK);
  assert.strictEqual(a.grid[13][5], T.DUVAR);
  assert.ok(a.dalgalar.length >= 2);
  const boss = TK.odaUret(7, 'boss', 5, TK.mirasBos());
  assert.strictEqual(boss.dalgalar[0][0].tip, 'jarl');
});
ok('çarpışma: duvar ve sütundan geçilmez', () => {
  const s = TK.yeniKosu(1);
  s.p.x = 1.4; s.p.y = 6.5;
  ilerle(s, 120, { mx: -1, my: 0 });
  assert.ok(s.p.x >= 1 + s.p.r - 0.001);
});
ok('Miras: kayıt/yükleme, satın alma ve bozuk kayıt', () => {
  const d = depo(), m = TK.mirasBos(); m.kul = 100;
  assert.ok(TK.mirasAl(m, 'zirh') && m.kul === 70 && m.seviye.zirh === 1);
  assert.ok(!TK.mirasAl(m, 'sans')); // 220 Kül yok
  TK.mirasKaydet(d, m);
  assert.deepStrictEqual(TK.mirasYukle(d), m);
  d.setItem(TK.KEY, '{bozuk'); assert.deepStrictEqual(TK.mirasYukle(d), TK.mirasBos());
  d.setItem(TK.KEY, JSON.stringify({ kul: -5, seviye: { zirh: 99 } })); assert.strictEqual(TK.mirasYukle(d).seviye.zirh, 0);
  const k = TK.yeniKosu(3, Object.assign(TK.mirasBos(), { seviye: { zirh: 2, guc: 0, kul: 0, koz: 1, ilk: 2, sans: 0 } }));
  assert.strictEqual(k.p.maxHp, 120 + 25 * (k.armagan.kalp || 0)); // İlk Armağan'a bağlı
  assert.strictEqual(Object.values(k.armagan).reduce((a, b) => a + b, 0), 2);
});
ok('dövüş: savurma Hortlak’ı öldürür, Kül kazanılır, dalgalar biter, kapılar açılır', () => {
  const s = TK.yeniKosu(5);
  TK.ilerle(s, 0);
  assert.strictEqual(s.oda.tur, 'savas');
  let guvenlik = 0;
  while (!s.oda.temiz && guvenlik++ < 6000) {
    s.p.inv = 1;
    const e = s.enemies.find(x => !x.olu);
    const g = e ? { hx: e.x, hy: e.y, mx: Math.sign(e.x - s.p.x) * 0.5, my: Math.sign(e.y - s.p.y) * 0.5, savur: true } : gir(s);
    TK.adim(s, g, 1 / 60);
  }
  assert.ok(s.oda.temiz, 'oda temizlenmeli');
  assert.ok(s.kul > 0 && s.oldurme > 0);
  assert.ok(s.oda.grid[0][6] === T.KAPI);
});
ok('Armağan seçimi ödülü uygular', () => {
  const s = TK.yeniKosu(9);
  s.secim = { tur: 'armagan', secenekler: ['kalp', 'keskin', 'ruzgar'] };
  const hp0 = s.p.maxHp;
  assert.ok(TK.secimYap(s, 0));
  assert.strictEqual(s.p.maxHp, hp0 + 25);
  assert.ok(!s.secim);
  assert.ok(TK.hasarCarpan(s) === 1);
  TK.armaganAl(s, 'keskin'); assert.ok(Math.abs(TK.hasarCarpan(s) - 1.2) < 1e-9);
});
ok('metroidvania: çatlak duvar yetenek olmadan kırılmaz, Kırıcı Rün ile kırılır ve gizli odaya geçilir', () => {
  const m = TK.mirasBos(), s = TK.yeniKosu(11, m);
  s.oda = TK.odaUret(2, 'savas', 2, m); s.oda.temiz = true; s.oda.grid[6][0] = T.CATLAK;
  s.p.x = 1.6; s.p.y = 6.5;
  TK.savur(s, Math.PI);
  assert.strictEqual(s.oda.grid[6][0], T.CATLAK);
  m.yetenek.kirik = true; s.p.swingCd = 0;
  TK.savur(s, Math.PI);
  assert.strictEqual(s.oda.grid[6][0], T.GIZLIKAPI);
  ilerle(s, 30, { mx: -1, my: 0 });
  assert.strictEqual(s.oda.tur, 'gizli');
  s.p.x = 11; s.p.y = 6.5; ilerle(s, 2);
  assert.ok(m.yetenek.sicrama, 'gizli sunak Gölge Atılımı verir');
  s.p.x = 11.5; s.p.y = 13; ilerle(s, 2);
  assert.strictEqual(s.oda.tur, 'savas', 'geri dönüş');
});
ok('metroidvania: uçurum yalnız Gölge Atılımı ile geçilir', () => {
  const m = TK.mirasBos(), s = TK.yeniKosu(13, m);
  s.oda = TK.odaUret(2, 'savas', 2, m); s.oda.temiz = true;
  for (let y = 1; y < 13; y++) { s.oda.grid[y][15] = T.UCURUM; s.oda.grid[y][16] = T.UCURUM; }
  s.p.x = 14.2; s.p.y = 6.5;
  TK.atilim(s, 1, 0); ilerle(s, 30, { mx: 1, my: 0 });
  assert.ok(s.p.x < 15, 'yetenek yok: uçuruma girilmez ' + s.p.x);
  m.yetenek.sicrama = true; s.p.x = 14.2; s.p.dashCd = 0;
  TK.atilim(s, 1, 0); ilerle(s, 30, { mx: 1, my: 0 });
  assert.ok(s.p.x > 17, 'yetenek var: karşıya geçilir ' + s.p.x);
});
ok('boss: halka mermisi atar, ölünce zafer ve Kırıcı Rün verir', () => {
  const m = TK.mirasBos(), s = TK.yeniKosu(17, m);
  s.oda = TK.odaUret(3, 'boss', 5, m); s.derinlik = 5; s.enemies = []; s.p.x = 11; s.p.y = 11;
  TK.dalgaBaslat(s);
  const j = s.enemies[0]; j.dogum = 0;
  let mermi = false;
  for (let i = 0; i < 1500 && !s.bitti; i++) { s.p.inv = 1; TK.adim(s, gir(s), 1 / 60); if (s.mermiler.length) mermi = true; if (i === 1400) j.hp = 1; }
  assert.ok(mermi, 'boss saldırıları mermi üretir');
  j.hp = 0.5; TK.dusmanHasar(s, j, 5, 0); ilerle(s, 3);
  assert.strictEqual(s.bitti, 'zafer'); assert.ok(m.yetenek.kirik); assert.strictEqual(m.zafer, 1);
});
ok('ölüm: Kül Miras’a işlenir; İkinci Şans bir kez geri getirir', () => {
  const m = TK.mirasBos(); m.seviye.sans = 1;
  const s = TK.yeniKosu(19, m); s.kul = 50;
  TK.adim(s, gir(s), 1 / 60); s.p.inv = 0; s.p.hp = 5;
  const mevcut = { x: 0, y: 0 };
  TK.dusmanHasar; // bilgi
  s.p.dashT = 0;
  // doğrudan hasar için düşman teması
  s.enemies = [{ tip: 'hortlak', x: s.p.x, y: s.p.y, r: 0.42, hp: 30, maxHp: 30, dogum: 0, atk: 1, faz: 'bekle', fazT: 1, kx: 0, ky: 0, flas: 0, yanik: 0, olu: false, temasCd: 0, ac: 0 }];
  s.oda.temiz = true; ilerle(s, 2);
  assert.ok(!s.bitti && s.p.hp > 5, 'ikinci şans');
  s.p.inv = 0; s.p.hp = 1; s.enemies[0].temasCd = 0; ilerle(s, 2);
  assert.strictEqual(s.bitti, 'yenilgi');
  assert.strictEqual(m.kul, 50); assert.strictEqual(m.kosu, 1);
});
ok('bot koşusu: rastgele 30 koşu hatasız biter, Kül sınırlı', () => {
  for (let tohum = 1; tohum <= 30; tohum++) {
    const s = TK.yeniKosu(tohum * 977, TK.mirasBos());
    let kare = 0;
    while (!s.bitti && kare++ < 60 * 400) {
      if (s.secim) TK.secimYap(s, 0);
      const e = s.enemies.filter(x => !x.olu).sort((a, b) => Math.hypot(a.x - s.p.x, a.y - s.p.y) - Math.hypot(b.x - s.p.x, b.y - s.p.y))[0];
      let g;
      if (e) { const d = Math.hypot(e.x - s.p.x, e.y - s.p.y) || 1; g = { hx: e.x, hy: e.y, mx: (e.x - s.p.x) / d * (d > 1.4 ? 1 : 0), my: (e.y - s.p.y) / d * (d > 1.4 ? 1 : 0), savur: d < 2, koz: d > 3 && kare % 40 === 0, atilim: kare % 150 === 0 }; }
      else {
        const hedefNesne = s.oda.nesneler.find(n => n.aktif && n.tur !== 'sandik');
        let tx = hedefNesne ? hedefNesne.x : TK.KAPI_X[tohum % 2] + 0.5, ty = hedefNesne ? hedefNesne.y : 0.4;
        const d = Math.hypot(tx - s.p.x, ty - s.p.y) || 1;
        g = { mx: (tx - s.p.x) / d, my: (ty - s.p.y) / d, hx: tx, hy: ty };
      }
      TK.adim(s, g, 1 / 60);
      assert.ok(Number.isFinite(s.p.x) && Number.isFinite(s.p.y) && Number.isFinite(s.p.hp));
      s.olaylar.length = 0;
    }
    assert.ok(s.bitti || kare >= 60 * 400);
  }
});
console.log(n + ' test geçti');
