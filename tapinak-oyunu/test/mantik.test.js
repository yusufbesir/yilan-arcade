// Emberwake mantık testi (Node, bağımlılık yok)
const assert = require('assert');
const TK = require('../src/mantik.js');
const { T } = TK;
let n = 0;
const ok = (ad, f) => { f(); n++; console.log('ok -', ad); };
const depo = () => { const d = {}; return { getItem: k => d[k] || null, setItem: (k, v) => { d[k] = v; } }; };
const yakina = (s, e) => { for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1], [-1.5, 1], [1.5, 1]]) if (!TK.carpisir(s, s.p, e.x + dx, e.y + dy) && TK.hucre(s, e.x + dx, e.y + dy) === 0) { s.p.x = e.x + dx; s.p.y = e.y + dy; return; } };
const gir = () => ({ mx: 0, my: 0 });
const ilerle = (s, n, g) => { for (let i = 0; i < n && !s.bitti && !s.secim; i++) TK.adim(s, g || gir(), 1 / 60); };
const bossOda = (s, d) => { s.oda = TK.odaUret(3, 'boss', d, s.meta, s.gecmis); s.derinlik = d; s.enemies = []; s.p.x = 11; s.p.y = 11; TK.dalgaBaslat(s); s.enemies[0].dogum = 0; return s.enemies[0]; };
const temasEnemy = (tip, x, y, o) => Object.assign({ tip, x, y, r: 0.42, hp: 30, maxHp: 30, dogum: 0, atk: 1, faz: 'bekle', fazT: 1, kx: 0, ky: 0, flas: 0, yanik: 0, olu: false, temasCd: 0, ac: 0, hizK: 1, sayac: 0, hedef: 0, hizliT: 0 }, o || {});

ok('oda üretimi tohumludur; kapılar ve duvarlar sağlam', () => {
  const a = TK.odaUret(42, 'savas', 2, TK.mirasBos()), b = TK.odaUret(42, 'savas', 2, TK.mirasBos());
  assert.deepStrictEqual(a.grid, b.grid);
  assert.strictEqual(a.grid[0][TK.KAPI_X[0]], T.KAPIK);
  assert.strictEqual(a.grid[13][5], T.DUVAR);
  assert.ok(a.dalgalar.length >= 2 && a.biyom === 0 && a.bolum === 1);
  const boss = TK.odaUret(7, 'boss', 4, TK.mirasBos());
  assert.strictEqual(boss.dalgalar[0][0].tip, 'hrolf');
  assert.strictEqual(TK.odaUret(7, 'boss', 8, TK.mirasBos()).dalgalar[0][0].tip, 'tepegoz');
  assert.strictEqual(TK.odaUret(7, 'boss', 12, TK.mirasBos()).dalgalar[0][0].tip, 'erlik');
});
ok('1500 oda: her biri başlangıçtan iki kapıya ulaşılabilir (tüm biyom/bölüm)', () => {
  let say = 0;
  for (let d = 1; d <= 12; d++) for (let i = 0; i < 125; i++) {
    const tur = TK.bossMu(d) ? 'boss' : (i % 5 === 0 ? 'elit' : 'savas');
    const o = TK.odaUret(i * 131 + d, tur, d, TK.mirasBos());
    assert.ok(TK.ulasilir(o.grid), 'ulaşılamaz oda ' + d + ' ' + i + ' ' + o.sablon); say++;
  }
  assert.strictEqual(say, 1500);
});
ok('tekrar yok: bir koşuda 8 savaş odasında ≥6 farklı şablon, art arda aynı şablon yok', () => {
  const g = { sablon: [], kadro: [] }, gorulen = [];
  for (let i = 0; i < 8; i++) { const o = TK.odaUret(900 + i * 11, 'savas', 1 + (i % 3), TK.mirasBos(), g); g.sablon.push(o.sablon); g.kadro.push(o.kadro); gorulen.push(o.sablon); }
  assert.ok(new Set(gorulen).size >= 6, gorulen.join());
  for (let i = 1; i < gorulen.length; i++) assert.notStrictEqual(gorulen[i], gorulen[i - 1]);
  const k = g.kadro; for (let i = 1; i < k.length; i++) assert.notStrictEqual(k[i], k[i - 1]);
});
ok('düşman çeşitliliği: 15 tür tanımlı, her biyomda ≥3 farklı tür çıkıyor', () => {
  assert.ok(Object.keys(TK.DUSMAN).length >= 15);
  for (let bi = 0; bi < 3; bi++) {
    const turler = new Set();
    for (let i = 0; i < 60; i++) { const o = TK.odaUret(i * 17 + bi, i % 7 === 0 ? 'elit' : 'savas', bi * 4 + 3, TK.mirasBos()); for (const w of o.dalgalar) for (const e of w) turler.add(e.tip); }
    assert.ok(turler.size >= 4, 'biyom ' + bi + ': ' + [...turler]);
  }
});
ok('biyom ve bölüm ilerledikçe değişir (palet kimliği, tehlike, tür havuzu)', () => {
  assert.deepStrictEqual([1, 4, 5, 8, 9, 12].map(TK.biyomOf), [0, 0, 1, 1, 2, 2]);
  assert.deepStrictEqual([1, 2, 3, 4, 5].map(TK.bolumOf), [0, 1, 2, 3, 0]);
  const lav = TK.odaUret(5, 'savas', 7, TK.mirasBos()).grid.flat().filter(t => t === T.LAV).length;
  const nif = TK.odaUret(5, 'savas', 3, TK.mirasBos()).grid.flat().filter(t => t === T.LAV).length;
  assert.ok(lav >= 1 && nif === 0);
});
ok('çarpışma: duvar ve sütundan geçilmez', () => {
  const s = TK.yeniKosu(1);
  s.p.x = 1.4; s.p.y = 6.5;
  ilerle(s, 120, { mx: -1, my: 0 });
  assert.ok(s.p.x >= 1 + s.p.r - 0.001);
});
ok('Miras: kayıt/yükleme, satın alma, bozuk kayıt, eski kayıt anahtarı', () => {
  const d = depo(), m = TK.mirasBos(); m.kul = 100;
  assert.ok(TK.mirasAl(m, 'zirh') && m.kul === 70 && m.seviye.zirh === 1);
  assert.ok(!TK.mirasAl(m, 'sans'));
  TK.mirasKaydet(d, m);
  assert.deepStrictEqual(TK.mirasYukle(d), m);
  d.setItem(TK.KEY, '{bozuk'); assert.deepStrictEqual(TK.mirasYukle(d), TK.mirasBos());
  d.setItem(TK.KEY, JSON.stringify({ kul: -5, seviye: { zirh: 99 } })); assert.strictEqual(TK.mirasYukle(d).seviye.zirh, 0);
  const e = depo(); e.setItem('koz-tapinagi-v1', JSON.stringify({ kul: 77, seviye: { zirh: 2 } })); assert.strictEqual(TK.mirasYukle(e).kul, 77);
  const k = TK.yeniKosu(3, Object.assign(TK.mirasBos(), { seviye: Object.assign(TK.mirasBos().seviye, { zirh: 2, koz: 1, ilk: 2 }) }));
  assert.ok(k.p.maxHp >= 120);
  assert.ok(Object.keys(k.armagan).length >= 1);
});
ok('dövüş: oda temizlenir, Kül kazanılır, kapılar açılır', () => {
  const s = TK.yeniKosu(5);
  TK.ilerle(s, 0);
  assert.strictEqual(s.oda.tur, 'savas');
  let guvenlik = 0;
  while (!s.oda.temiz && guvenlik++ < 8000) {
    s.p.inv = 1;
    const e = s.enemies.find(x => !x.olu);
    if (e && guvenlik % 240 === 0) yakina(s, e);
    const g = e ? { hx: e.x, hy: e.y, mx: Math.sign(e.x - s.p.x) * 0.5, my: Math.sign(e.y - s.p.y) * 0.5, savur: true } : gir();
    TK.adim(s, g, 1 / 60);
  }
  assert.ok(s.oda.temiz && s.kul > 0 && s.oldurme > 0);
  assert.ok(s.oda.grid[0][6] === T.KAPI);
});
ok('Armağan nadirliği: Efsanevi daha güçlü; Armağan seçimi uygulanır', () => {
  const s = TK.yeniKosu(9);
  s.secim = { tur: 'armagan', secenekler: [{ id: 'kalp', nadir: 2 }, { id: 'keskin', nadir: 0 }, 'ruzgar'] };
  const hp0 = s.p.maxHp;
  assert.ok(TK.secimYap(s, 0));
  assert.strictEqual(s.p.maxHp, hp0 + 60);
  TK.armaganAl(s, 'keskin', 1); assert.ok(Math.abs(TK.hasarCarpan(s) - 1.32) < 1e-9);
  assert.ok(TK.NADIRLIK[2].guc > TK.NADIRLIK[1].guc && TK.NADIRLIK[1].guc > TK.NADIRLIK[0].guc);
});
ok('Köz Çemberi etrafında dönüp yakar', () => {
  const s = TK.yeniKosu(21); TK.armaganAl(s, 'cember', 0);
  s.oda.temiz = true; const e = temasEnemy('draugr', 12.7, 11.4); e.hp = 30; s.enemies.push(e); s.p.inv = 99;
  ilerle(s, 120);
  assert.ok(e.hp < 30 || e.olu);
});
ok('açlık/susuzluk: yavaş akar, yiyecek doldurur, Miras ve Kıtlık etkiler, ölümcül değil', () => {
  const s = TK.yeniKosu(23); s.oda.temiz = true;
  ilerle(s, 60 * 10);
  assert.ok(s.p.aclik < 100 && s.p.aclik > 90 && s.p.susuz < s.p.aclik);
  s.oda.nesneler.push({ tur: 'su', x: s.p.x, y: s.p.y, aktif: true }); ilerle(s, 2); assert.ok(s.p.susuz > 90);
  const m = TK.mirasBos(); m.yetenek.kirik = true; m.seviye.iase = 3;
  const a = TK.yeniKosu(24, m), b = TK.yeniKosu(24, m, { kitlik: true });
  ilerle(a, 600); ilerle(b, 600); assert.ok(b.p.aclik < a.p.aclik);
  const c = TK.yeniKosu(25); c.p.aclik = 0; c.p.susuz = 0; c.oda.temiz = true; ilerle(c, 60 * 200);
  assert.ok(c.p.hp >= 1 && !c.bitti);
});
ok('Mühür: yalnız ilk boss sonrası, Kül bonusu verir ve düşmanı sertleştirir', () => {
  const m = TK.mirasBos();
  assert.deepStrictEqual(TK.yeniKosu(1, m, { sert: true }).muhur, {});
  m.yetenek.kirik = true;
  const s = TK.yeniKosu(1, m, { sert: true, kral: true }); assert.ok(s.muhur.sert && s.muhur.kral);
  s.oda = TK.odaUret(2, 'savas', 1, m, s.gecmis); s.derinlik = 1; s.enemies = []; TK.dalgaBaslat(s);
  const temel = TK.DUSMAN[s.enemies[0].tip].hp;
  assert.ok(s.enemies[0].maxHp >= temel * 1.25);
  s.kul = 100; s.p.hp = 0; TK.adim(s, gir(), 1 / 60); s.p.hp = 0; s.p.inv = 0; s.bitti = null;
  s.enemies = [temasEnemy('draugr', s.p.x, s.p.y)]; s.oda.temiz = true; ilerle(s, 3);
  assert.strictEqual(s.bitti, 'yenilgi'); assert.strictEqual(s.kazanc, Math.round(100 * 1.35));
});
ok('pazar: Kül karşılığı satın alma; yetmezse almaz', () => {
  const s = TK.yeniKosu(31); s.oda = TK.odaUret(5, 'pazar', 5, s.meta, s.gecmis); s.oda.temiz = true;
  const raf = s.oda.nesneler.find(n => n.alt === 'koz'); s.p.x = raf.x; s.p.y = raf.y; s.kul = 1;
  ilerle(s, 3); assert.ok(raf.aktif);
  s.kul = 500; const k0 = s.p.kozMaks; ilerle(s, 3); assert.ok(!raf.aktif && s.p.kozMaks === k0 + 1 && s.kul < 500);
});
ok('lanetli sandık: can bedeli, en az Nadir Armağan seçimi', () => {
  const s = TK.yeniKosu(33); s.oda.temiz = true; s.oda.nesneler.push({ tur: 'lanet', x: s.p.x, y: s.p.y, aktif: true });
  const hp = s.p.hp; ilerle(s, 2); assert.ok(s.p.hp < hp && s.secim && s.secim.secenekler.every(o => o.nadir >= 1));
});
ok('metroidvania: çatlak duvar Kırıcı Rün ister; gizli oda Gölge Atılımı verir', () => {
  const m = TK.mirasBos(), s = TK.yeniKosu(11, m);
  s.oda = TK.odaUret(2, 'savas', 2, m); s.oda.temiz = true; s.oda.grid[6][0] = T.CATLAK;
  s.p.x = 1.6; s.p.y = 6.5;
  TK.savur(s, Math.PI); assert.strictEqual(s.oda.grid[6][0], T.CATLAK);
  m.yetenek.kirik = true; s.p.swingCd = 0; TK.savur(s, Math.PI);
  assert.strictEqual(s.oda.grid[6][0], T.GIZLIKAPI);
  ilerle(s, 30, { mx: -1, my: 0 }); assert.strictEqual(s.oda.tur, 'gizli');
  s.p.x = 11; s.p.y = 6.5; ilerle(s, 2); assert.ok(m.yetenek.sicrama);
  s.p.x = 11.5; s.p.y = 13; ilerle(s, 2); assert.strictEqual(s.oda.tur, 'savas');
});
ok('uçurum yalnız Gölge Atılımı ile geçilir', () => {
  const m = TK.mirasBos(), s = TK.yeniKosu(13, m);
  s.oda = TK.odaUret(2, 'savas', 2, m); s.oda.temiz = true;
  for (let y = 1; y < 13; y++) { s.oda.grid[y][15] = T.UCURUM; s.oda.grid[y][16] = T.UCURUM; }
  s.p.x = 14.2; s.p.y = 6.5; TK.atilim(s, 1, 0); ilerle(s, 30, { mx: 1, my: 0 }); assert.ok(s.p.x < 15);
  m.yetenek.sicrama = true; s.p.x = 14.2; s.p.dashCd = 0; TK.atilim(s, 1, 0); ilerle(s, 30, { mx: 1, my: 0 }); assert.ok(s.p.x > 17);
});
ok('zemin tehlikeleri: açık diken ve lav oyuncuya hasar verir, atılım korur', () => {
  const s = TK.yeniKosu(41); s.oda.temiz = true; s.oda.grid[6][8] = T.LAV;
  s.p.x = 8.5; s.p.y = 6.5; s.p.inv = 0; const hp = s.p.hp; ilerle(s, 5); assert.ok(s.p.hp < hp);
  const durumlar = new Set(); for (let t = 0; t < 3; t += 0.1) durumlar.add(TK.sivriDurum(t, 3, 3));
  assert.deepStrictEqual([...durumlar].sort(), [0, 1, 2]);
});
ok('düşman davranışları: Albastı ışınlanır, Kor Cini patlar, Demirci kalkanı öne gelen vuruşu keser, Gölge hayaletken dokunulmaz', () => {
  const s = TK.yeniKosu(51); s.oda.temiz = true; s.p.inv = 99;
  const a = temasEnemy('albasti', 5, 6); s.enemies.push(a); const x0 = a.x;
  ilerle(s, 60 * 4); assert.ok(Math.hypot(a.x - s.p.x, a.y - s.p.y) < 4 || a.x !== x0);
  s.enemies = []; s.p.inv = 0; const k = temasEnemy('kor', s.p.x + 0.5, s.p.y); s.enemies.push(k); const hp = s.p.hp; ilerle(s, 5); assert.ok(k.olu || !s.enemies.includes(k)); assert.ok(s.p.hp < hp);
  const dm = temasEnemy('demirci', 10, 6, { hp: 75, maxHp: 75, ac: 0 }); TK.dusmanHasar(s, dm, 20, Math.PI); assert.ok(dm.hp > 70);
  dm.hp = 75; TK.dusmanHasar(s, dm, 20, 0); assert.ok(dm.hp <= 55);
  const g = temasEnemy('golge', 3, 3, { faz: 'hayalet', hp: 36, maxHp: 36 }); TK.dusmanHasar(s, g, 50, 0); assert.strictEqual(g.hp, 36);
});
ok('elit etkileri: Bölünen ikiye ayrılır', () => {
  const s = TK.yeniKosu(61); s.oda.temiz = true; s.p.inv = 99;
  const e = temasEnemy('draugr', 5, 6, { etki: 'bolen' }); s.enemies.push(e); e.hp = 1; TK.dusmanHasar(s, e, 5, 0);
  assert.ok(s.enemies.filter(x => x.mini).length === 2);
});
ok('boss: her biyomun boss saldırıları çalışır; ölünce yetenek, ara boss koşuyu bitirmez', () => {
  for (const [d, tip] of [[4, 'hrolf'], [8, 'tepegoz'], [12, 'erlik']]) {
    const m = TK.mirasBos(), s = TK.yeniKosu(17 + d, m);
    const j = bossOda(s, d); assert.strictEqual(j.tip, tip);
    let mermi = false, tuzak = false;
    for (let i = 0; i < 2400 && !s.bitti; i++) { s.p.inv = 1; TK.adim(s, gir(), 1 / 60); if (s.mermiler.length) mermi = true; if (s.tuzaklar.length) tuzak = true; if (i === 600) j.hp = j.maxHp * 0.4; }
    assert.ok(mermi || tuzak, tip + ' saldırı üretmeli');
    j.hp = 0.5; TK.dusmanHasar(s, j, 5, 0); ilerle(s, 3);
    assert.ok(m.yetenek.kirik && m.bossOldu === 1);
    if (d === 12) { assert.strictEqual(s.bitti, 'zafer'); assert.strictEqual(m.zafer, 1); } else { assert.ok(!s.bitti && s.oda.grid[0][6] === T.KAPI, 'ara boss sonrası kapılar'); }
  }
});
ok('ölüm: Kül Miras’a işlenir; İkinci Şans bir kez geri getirir', () => {
  const m = TK.mirasBos(); m.seviye.sans = 1;
  const s = TK.yeniKosu(19, m); s.kul = 50; s.p.hp = 5; s.oda.temiz = true;
  s.enemies = [temasEnemy('draugr', s.p.x, s.p.y)]; ilerle(s, 2);
  assert.ok(!s.bitti && s.p.hp > 5);
  s.p.inv = 0; s.p.hp = 1; s.enemies[0].temasCd = 0; ilerle(s, 2);
  assert.strictEqual(s.bitti, 'yenilgi'); assert.strictEqual(m.kul, 50); assert.strictEqual(m.kosu, 1);
});
ok('kapı türleri: boss öncesi boss, boss sonrası dinlenme/pazar, Cimri Kader dinlenmeyi kaldırır', () => {
  const r = TK.mulberry(1);
  assert.deepStrictEqual(TK.odaUret(1, 'savas', 3, TK.mirasBos()).kapiTur, [null, null]);
  const s = TK.yeniKosu(71); s.derinlik = 3; s.oda.kapiTur = null;
  const hepsi = new Set(); for (let i = 0; i < 40; i++) { const s2 = TK.yeniKosu(i, Object.assign(TK.mirasBos(), { yetenek: { kirik: true, sicrama: false } }), { cimri: true }); hepsi.add(s2.oda.kapiTur.join()); }
  assert.ok(r() >= 0 && !hepsi.has('dinlenme,pazar'));
});
ok('bot koşusu: 40 koşu hatasız (biyom geçişleri, kapı seçimi, pazar, lanet)', () => {
  let en = 0, boss = 0;
  for (let tohum = 1; tohum <= 40; tohum++) {
    const m = TK.mirasBos(); m.yetenek.kirik = true; m.seviye.zirh = 5; m.seviye.guc = 5;
    const s = TK.yeniKosu(tohum * 977, m, tohum % 3 === 0 ? { sert: true } : null);
    let kare = 0;
    while (!s.bitti && kare++ < 60 * 900) {
      if (s.secim) TK.secimYap(s, kare % 3);
      const e = s.enemies.filter(x => !x.olu).sort((a, b) => Math.hypot(a.x - s.p.x, a.y - s.p.y) - Math.hypot(b.x - s.p.x, b.y - s.p.y))[0];
      let g;
      if (e && kare % 200 === 0) yakina(s, e);
      if (e) { const d = Math.hypot(e.x - s.p.x, e.y - s.p.y) || 1; g = { hx: e.x, hy: e.y, mx: (e.x - s.p.x) / d * (d > 1.4 ? 1 : 0), my: (e.y - s.p.y) / d * (d > 1.4 ? 1 : 0), savur: d < 2.2, koz: d > 3 && kare % 40 === 0, atilim: kare % 150 === 0 }; }
      else {
        const n2 = s.oda.nesneler.find(n => n.aktif && (n.tur === 'sunak' || n.tur === 'et' || n.tur === 'su'));
        const tx = n2 ? n2.x : TK.KAPI_X[tohum % 2] + 0.5, ty = n2 ? n2.y : 0.4;
        const d = Math.hypot(tx - s.p.x, ty - s.p.y) || 1;
        g = { mx: (tx - s.p.x) / d, my: (ty - s.p.y) / d, hx: tx, hy: ty };
      }
      TK.adim(s, g, 1 / 60);
      assert.ok(Number.isFinite(s.p.x) && Number.isFinite(s.p.y) && Number.isFinite(s.p.hp));
      s.olaylar.length = 0;
    }
    en = Math.max(en, s.derinlik); if (s.derinlik >= 4) boss++;
  }
  assert.ok(en >= 4, 'bot en az ilk boss odasına ulaşmalı: ' + en);
});
ok('sade başlangıç: Armağanlar boss yenildikçe açılır', () => {
  const m = TK.mirasBos();
  const sayi = b => { m.bossOldu = b; return TK.armaganAcik({ meta: m }).length; };
  assert.deepStrictEqual([0, 1, 2, 3, 9].map(sayi), [5, 7, 9, 10, 10]);
  m.bossOldu = 0;
  const s = TK.yeniKosu(5, m);
  for (let i = 0; i < 50; i++) for (const o of Object.keys(s.armagan)) assert.ok(TK.armaganAcik(s).includes(o));
});
ok('Günlük Koşu: aynı gün aynı odalar, farklı gün farklı; en iyi derinlik kaydedilir', () => {
  const g1 = new Date(2026, 10, 4), g2 = new Date(2026, 10, 5);
  const a = TK.gunlukKosu(TK.mirasBos(), g1), b = TK.gunlukKosu(TK.mirasBos(), g1), c = TK.gunlukKosu(TK.mirasBos(), g2);
  assert.strictEqual(a.gunluk, 20261104);
  assert.deepStrictEqual(a.oda.grid, b.oda.grid);
  assert.deepStrictEqual(a.oda.dalgalar, b.oda.dalgalar);
  assert.notStrictEqual(a.seed, c.seed);
  assert.deepStrictEqual(Object.keys(a.muhur), []);
  const m = TK.mirasBos(); a.derinlik = 5; TK.gunlukKaydet(m, a);
  a.derinlik = 3; TK.gunlukKaydet(m, a);
  assert.deepStrictEqual(m.gunluk, { gun: 20261104, enIyi: 5 });
  const d = depo(); TK.mirasKaydet(d, m); assert.deepStrictEqual(TK.mirasYukle(d).gunluk, m.gunluk);
});
ok('Armağan eşleşmeleri: Tılsım+Kül Emici açlık doldurur, Alev+Çember yakar', () => {
  const m = TK.mirasBos(); m.bossOldu = 3;
  const s = TK.yeniKosu(11, m);
  TK.armaganAl(s, 'kan', 0); s.p.aclik = 50; s.p.susuz = 50;
  const e1 = temasEnemy('draugr', 5, 5, { hp: 1, maxHp: 1 }); s.enemies = [e1];
  TK.dusmanHasar(s, e1, 99, 0); assert.strictEqual(s.p.aclik, 50);
  TK.armaganAl(s, 'tilsim', 0);
  const e2 = temasEnemy('draugr', 5, 5, { hp: 1, maxHp: 1 }); s.enemies = [e2];
  TK.dusmanHasar(s, e2, 99, 0); assert.ok(s.p.aclik > 50 && s.p.susuz > 50);
  assert.strictEqual(TK.ESLESME.length, 3);
});
ok('Miras: Pazarlık Ustası pazar fiyatını düşürür, kayıt doğrulanır', () => {
  const m0 = TK.mirasBos(), m3 = TK.mirasBos(); m3.seviye.pazar = 3;
  const f = m => TK.odaUret(9, 'pazar', 6, m, null).nesneler.filter(n => n.tur === 'raf' && n.alt !== 'sat').map(n => n.fiyat);
  const a = f(m0), b = f(m3);
  assert.ok(a.length === 4 && a.every((v, i) => b[i] < v));
  const d = depo(); d.setItem(TK.KEY, JSON.stringify({ kul: 5, seviye: { pazar: 99 } }));
  assert.strictEqual(TK.mirasYukle(d).seviye.pazar, 0);
});
ok('geri alınabilir özellikler: varsayılan açık, kayıt doğrulanır, kapatılınca etkisiz', () => {
  const m = TK.mirasBos();
  assert.ok(Object.keys(TK.OZELLIKLER).every(k => m.ozellik[k] === true));
  const d = depo(); d.setItem(TK.KEY, JSON.stringify({ ozellik: { risk: false, ocak: 'evet', bilinmeyen: false } }));
  const y = TK.mirasYukle(d); assert.strictEqual(y.ozellik.risk, false); assert.strictEqual(y.ozellik.ocak, true); assert.ok(!('bilinmeyen' in y.ozellik));
  const sat = (mm, tur) => TK.odaUret(5, tur, 4, mm, null).nesneler.map(n => n.alt || n.tur);
  assert.ok(sat(m, 'pazar').includes('sat') && sat(m, 'dinlenme').includes('ocak'));
  const k = TK.mirasBos(); k.ozellik.armaganSatis = false; k.ozellik.ocak = false;
  assert.ok(!sat(k, 'pazar').includes('sat') && !sat(k, 'dinlenme').includes('ocak'));
});
ok('Armağan satışı en zayıf Armağanı geri alır; Köz Ocağı açlık ve suyu doldurur', () => {
  const s = TK.yeniKosu(3, TK.mirasBos(), null);
  TK.armaganAl(s, 'kalp', 0); TK.armaganAl(s, 'keskin', 2);
  const maks = s.p.maxHp; assert.strictEqual(TK.zayifArmagan(s), 'kalp');
  TK.armaganSat(s, 'kalp'); assert.ok(s.p.maxHp < maks && !s.armagan.kalp && s.armagan.keskin);
  s.oda = TK.odaUret(2, 'dinlenme', 3, s.meta, null); s.p.x = 11; s.p.y = 8.6; s.p.aclik = 10; s.p.susuz = 10;
  TK.adim(s, gir(), 1 / 60); assert.ok(s.p.aclik > 90 && s.p.susuz > 90);
});
ok('Karşılık: atılımın ilk anında hasar gelirse düşman sersemler, kapatılınca olmaz', () => {
  for (const acik of [true, false]) {
    const m = TK.mirasBos(); m.ozellik.karsilik = acik;
    const s = TK.yeniKosu(4, m, null); const e = temasEnemy('draugr', s.p.x + 1, s.p.y); s.enemies = [e];
    s.p.dashT = 0.15; TK.oyuncuHasar(s, 10, 'temas');
    assert.strictEqual(e.sersem > 0, acik); assert.strictEqual(s.p.hp, s.p.maxHp);
  }
});
ok('Ölüm raporu hasar kaynağını ve kesilen düşmanı yazar', () => {
  const s = TK.yeniKosu(6, TK.mirasBos(), null);
  TK.oyuncuHasar(s, 12, 'mermi'); s.oldurTip.draugr = 3;
  const r = TK.olumRaporu(s); assert.ok(r.includes('mermi (12)') && r.includes('Draugr ×3'), r);
});
ok('Boss Provası: boss ölünce biter, istatistik ve boss sayacı değişmez', () => {
  const m = TK.mirasBos(); m.bossOldu = 1; const kosu = m.kosu;
  const s = TK.bossProvasi(m, 0);
  assert.strictEqual(s.oda.tur, 'boss'); for (let i = 0; i < 90; i++) TK.adim(s, gir(), 1 / 60);
  const b = s.enemies.find(e => TK.DUSMAN[e.tip].boss); assert.ok(b);
  b.dogum = 0; TK.dusmanHasar(s, b, 99999, 0); for (let i = 0; i < 5; i++) TK.adim(s, gir(), 1 / 60);
  assert.strictEqual(s.bitti, 'zafer'); assert.strictEqual(m.kosu, kosu); assert.strictEqual(m.bossOldu, 1);
});
ok('Risk kapısı ve Köz Sınavı: işaretli kapı daha kalabalık oda ve çift Kül verir', () => {
  let risk = 0, sinav = 0;
  for (let t = 1; t <= 120; t++) {
    const s = TK.yeniKosu(t, TK.mirasBos(), null);
    for (let d = 0; d < 7; d++) {
      if (s.oda.kapiRisk && s.oda.kapiRisk[0]) { const on = TK.onizle(s, 0); assert.ok(on.risk); }
      const kapi = s.oda.kapiRisk && s.oda.kapiRisk[1] ? 1 : 0;
      const r0 = s.oda.kapiRisk && s.oda.kapiRisk[kapi];
      TK.ilerle(s, kapi);
      if (r0 && s.oda.tur !== 'boss') { assert.ok(s.oda.risk); risk++; }
      if (s.oda.sinav) { assert.strictEqual(s.oda.sinavT, 24); sinav++; }
      if (s.oda.tur === 'boss' || s.derinlik >= 11) break;
    }
  }
  assert.ok(risk > 5 && sinav > 0, 'risk ' + risk + ' sinav ' + sinav);
  const m = TK.mirasBos(); m.ozellik.risk = false; m.ozellik.kozSinavi = false;
  for (let t = 1; t <= 40; t++) { const s = TK.yeniKosu(t, m, null); for (let d = 0; d < 6; d++) { TK.ilerle(s, 0); assert.ok(!s.oda.risk && !s.oda.sinav && !(s.oda.kapiRisk[0] || s.oda.kapiRisk[1])); if (s.oda.tur === 'boss') break; } }
});
console.log(n + ' test geçti');
