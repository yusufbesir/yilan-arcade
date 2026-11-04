// Emberwake: saf oyun mantığı (DOM yok, tohumlu). Tarayıcıda global TK, Node'da module.exports.
(function (root, fabrika) {
  if (typeof module === 'object' && module.exports) module.exports = fabrika();
  else root.TK = fabrika();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const W = 22, H = 14; // kenar duvarlar dahil; iç alan 20x12
  const T = { ZEMIN: 0, DUVAR: 1, UCURUM: 3, CATLAK: 4, SUTUN: 5, KAPI: 6, KAPIK: 7, GIZLIKAPI: 8, GERI: 9, SIVRI: 10, LAV: 11 };
  const KAPI_X = [6, 15];
  const SON_DERINLIK = 12; // 3 biyom x 4 oda (4. oda boss)
  const KEY = 'emberwake-v1';
  const ESKI_KEY = 'koz-tapinagi-v1';

  // ---------- Veri ----------
  const BIYOMLAR = [
    { id: 'nifl', ad: 'GJALLAR HÖYÜKLERİ', alt: 'Nors: Niflheim kapısı', bolum: ['Buzlu Giriş', 'Kemik Salonları', 'Donmuş Kalp', 'Kral Mezarı'], boss: 'hrolf', kucuk: ['draugr', 'kurt', 'kargaci'], menzil: ['seidr'], agir: ['buzdev'], ozel: ['draugr'] },
    { id: 'demir', ad: 'DEMİR DAĞ OCAKLARI', alt: 'Türk: Ergenekon demir dağı', bolum: ['Maden Ağzı', 'Körük Odaları', 'Eriyik Nehri', 'Tepegöz Ocağı'], boss: 'tepegoz', kucuk: ['kor', 'demirkurt', 'kurt'], menzil: ['kargaci', 'seidr'], agir: ['demirci'], ozel: ['albasti'] },
    { id: 'kok', ad: 'TAMU KÖKLERİ', alt: 'Yggdrasil kökü, Erlik Han yurdu', bolum: ['Kök Girişi', 'Yılan Çukuru', 'Gölge Bahçesi', 'Erlik Tahtı'], boss: 'erlik', kucuk: ['yilan', 'draugr', 'kor'], menzil: ['golge', 'seidr'], agir: ['demirci', 'buzdev'], ozel: ['kok', 'albasti'] }
  ];
  const biyomOf = d => d <= 0 ? 0 : Math.min(2, Math.floor((d - 1) / 4));
  const bolumOf = d => d <= 0 ? 0 : (d - 1) % 4;
  const bossMu = d => d > 0 && d % 4 === 0;

  const DUSMAN = {
    draugr: { ad: 'Draugr', hp: 30, hiz: 2.5, r: 0.42, kul: 4, temas: 10, ai: 'kovala' },
    kurt: { ad: 'Fenrir Yavrusu', hp: 22, hiz: 2.4, r: 0.4, kul: 5, temas: 10, ai: 'atilgan', atilim: 9.5 },
    seidr: { ad: 'Seidr Cadısı', hp: 24, hiz: 1.9, r: 0.42, kul: 6, temas: 6, ai: 'nisanci' },
    kargaci: { ad: 'Hugin Kuzgunu', hp: 14, hiz: 3.4, r: 0.32, kul: 5, temas: 8, ai: 'cirpinan', ucar: true },
    buzdev: { ad: 'Buz Devi', hp: 70, hiz: 1.5, r: 0.62, kul: 12, temas: 18, ai: 'devasa' },
    albasti: { ad: 'Albastı', hp: 34, hiz: 2.1, r: 0.42, kul: 9, temas: 12, ai: 'isinlan' },
    demirkurt: { ad: 'Demir Bozkurt', hp: 42, hiz: 2.7, r: 0.5, kul: 8, temas: 14, ai: 'atilgan', atilim: 10.5, uluma: true },
    kor: { ad: 'Kor Cini', hp: 18, hiz: 3.3, r: 0.36, kul: 6, temas: 6, ai: 'patlayan' },
    demirci: { ad: 'Kalkanlı Demirci', hp: 75, hiz: 1.6, r: 0.55, kul: 12, temas: 16, ai: 'kalkanli' },
    yilan: { ad: 'Şahmaran Yavrusu', hp: 16, hiz: 3.0, r: 0.34, kul: 3, temas: 7, ai: 'surunen' },
    kok: { ad: 'Tamu Kökü', hp: 40, hiz: 0, r: 0.5, kul: 8, temas: 0, ai: 'kok' },
    golge: { ad: 'Tamu Gölgesi', hp: 36, hiz: 2.3, r: 0.42, kul: 10, temas: 10, ai: 'golge' },
    hrolf: { ad: 'Kral Hrolf', hp: 560, hiz: 1.7, r: 0.95, kul: 120, temas: 20, ai: 'boss', boss: true, saldiri: ['hamle', 'halka', 'buz', 'cagri'] },
    tepegoz: { ad: 'Tepegöz', hp: 820, hiz: 1.5, r: 1.1, kul: 160, temas: 24, ai: 'boss', boss: true, saldiri: ['hamle', 'tas', 'zemin', 'cagri'] },
    erlik: { ad: 'Erlik Han', hp: 1100, hiz: 1.9, r: 1.0, kul: 260, temas: 24, ai: 'boss', boss: true, saldiri: ['halka', 'tuzak', 'hamle', 'cagri'] }
  };
  const ETKI = { hizli: 'Çevik', zirh: 'Zırhlı', bolen: 'Bölünen', vampir: 'Kanemici' };

  const ARMAGANLAR = {
    keskin: { ad: 'Parlak Keskinlik', acik: 'Kılıç hasarı +%20', renk: '#ff7a5c', ic: 'K' },
    ruzgar: { ad: 'Rüzgâr Ayağı', acik: 'Hareket hızı +%12', renk: '#8de3ff', ic: 'R' },
    kalp: { ad: 'Köz Kalbi', acik: '+25 azami can ve iyileşme', renk: '#ff5d8f', ic: 'C' },
    bilek: { ad: 'Çevik Bilek', acik: 'Savurma %15 daha hızlı', renk: '#ffd86b', ic: 'B' },
    alev: { ad: 'Alev İzi', acik: 'Vuruşlar yakar (3 sn)', renk: '#ff9a3c', ic: 'A' },
    golge: { ad: 'Gölge Adımı', acik: 'Atılım değdiğine hasar verir', renk: '#b69cff', ic: 'G' },
    kivilcim: { ad: 'Kıvılcım', acik: 'Köz atışı +1 yük, delip geçer', renk: '#7fffd4', ic: 'V' },
    kan: { ad: 'Kül Emici', acik: 'Her öldürmede 2 can', renk: '#e07bff', ic: 'E' },
    cember: { ad: 'Köz Çemberi', acik: 'Etrafında dönen köz küreleri yakar', renk: '#ffb35a', ic: 'Ç' },
    tilsim: { ad: 'Kurt Tılsımı', acik: 'Açlık ve susuzluk %25 yavaşlar', renk: '#9dffb0', ic: 'T' }
  };
  const NADIRLIK = [{ ad: 'Yaygın', guc: 1, renk: '#d9d2c0' }, { ad: 'Nadir', guc: 1.6, renk: '#7fd6ff' }, { ad: 'Efsanevi', guc: 2.4, renk: '#ffb02e' }];
  const MUHURLER = {
    sert: { ad: 'Demir Postal', acik: 'Düşman canı +%25', bonus: 0.15 },
    hizli: { ad: 'Hızlı Ordu', acik: 'Düşman hızı +%15', bonus: 0.15 },
    kitlik: { ad: 'Kıtlık', acik: 'Açlık/susuzluk %60 hızlı, az yiyecek', bonus: 0.2 },
    kral: { ad: 'Kor Kral', acik: 'Boss canı +%30 ve daha hırçın', bonus: 0.2 },
    cimri: { ad: 'Cimri Kader', acik: 'Pazar ve dinlenme odası çıkmaz', bonus: 0.25 }
  };
  const MIRAS = {
    zirh: { ad: 'Sağlam Kemik', acik: '+10 azami can', maks: 5, maliyet: n => 30 + 25 * n },
    guc: { ad: 'Demir Bilek', acik: '+%8 hasar', maks: 5, maliyet: n => 40 + 30 * n },
    kul: { ad: 'Kül Hasadı', acik: '+%15 Kül kazancı', maks: 4, maliyet: n => 50 + 40 * n },
    koz: { ad: 'Çifte Köz', acik: '+1 köz yükü', maks: 2, maliyet: n => 80 + 80 * n },
    ilk: { ad: 'İlk Armağan', acik: 'Koşuya rastgele Armağanla başla', maks: 2, maliyet: n => 90 + 110 * n },
    sans: { ad: 'İkinci Şans', acik: 'Ölünce bir kez %40 canla dön', maks: 1, maliyet: () => 220 },
    iase: { ad: 'Dayanıklı Mide', acik: 'Açlık ve susuzluk %15 yavaş', maks: 3, maliyet: n => 45 + 35 * n }
  };
  const YETENEKLER = {
    kirik: { ad: 'Kırıcı Rün', acik: 'Savurma çatlak duvarları kırar' },
    sicrama: { ad: 'Gölge Atılımı', acik: 'Atılım uçurumun üzerinden geçer' }
  };

  function mulberry(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mesafe = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const sec = (r, d) => d[Math.floor(r() * d.length)];

  // ---------- Miras (kalıcı ilerleme) ----------
  function mirasBos() {
    const s = {}; for (const k in MIRAS) s[k] = 0;
    return { kul: 0, seviye: s, yetenek: { kirik: false, sicrama: false }, kosu: 0, enIyi: 0, zafer: 0, bossOldu: 0, gunluk: { gun: 0, enIyi: 0 } };
  }
  function mirasYukle(depo) {
    const m = mirasBos();
    try {
      const o = JSON.parse(depo.getItem(KEY) || depo.getItem(ESKI_KEY) || 'null');
      if (!o || typeof o !== 'object') return m;
      if (Number.isFinite(o.kul) && o.kul >= 0 && o.kul < 1e9) m.kul = Math.floor(o.kul);
      for (const k in m.seviye) { const v = o.seviye && o.seviye[k]; if (Number.isInteger(v) && v >= 0 && v <= MIRAS[k].maks) m.seviye[k] = v; }
      for (const k in m.yetenek) m.yetenek[k] = !!(o.yetenek && o.yetenek[k]);
      for (const k of ['kosu', 'enIyi', 'zafer', 'bossOldu']) if (Number.isInteger(o[k]) && o[k] >= 0 && o[k] < 1e6) m[k] = o[k];
      const g = o.gunluk;
      if (g && Number.isInteger(g.gun) && g.gun >= 0 && g.gun < 1e8 && Number.isInteger(g.enIyi) && g.enIyi >= 0 && g.enIyi <= 99) m.gunluk = { gun: g.gun, enIyi: g.enIyi };
    } catch (e) { /* bozuk kayıt: boş başla */ }
    return m;
  }
  function mirasKaydet(depo, m) { try { depo.setItem(KEY, JSON.stringify(m)); } catch (e) { /* depo yok */ } }
  function mirasAl(m, id) {
    const d = MIRAS[id];
    if (!d) return false;
    const n = m.seviye[id];
    if (n >= d.maks) return false;
    const c = d.maliyet(n);
    if (m.kul < c) return false;
    m.kul -= c; m.seviye[id] = n + 1;
    return true;
  }

  // Günlük Koşu: tohum yerel tarihten (YYYYMMDD); herkes aynı gün aynı odaları görür. Mühür yok, kurallar sabit.
  function gunNo(d) { d = d || new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  function gunlukKosu(meta, d) {
    const gun = gunNo(d), s = yeniKosu((gun * 2654435761) >>> 0, meta, null);
    s.gunluk = gun;
    return s;
  }
  function gunlukKaydet(meta, s) {
    if (!s.gunluk) return;
    const g = meta.gunluk && meta.gunluk.gun === s.gunluk ? meta.gunluk : { gun: s.gunluk, enIyi: 0 };
    g.enIyi = Math.max(g.enIyi, Math.min(99, s.derinlik)); meta.gunluk = g;
  }

  // ---------- Oda şablonları ----------
  const bos = (x, y) => x >= 9 && x <= 13 && y >= 10; // başlangıç noktası
  const serbest = (x, y) => (x >= 5 && x <= 8 && y <= 3) || (x >= 13 && x <= 17 && y <= 3) || (x <= 2 && y >= 5 && y <= 8) || bos(x, y);
  function koy(g, x, y, t) { if (x < 1 || y < 1 || x > 20 || y > 12 || serbest(x, y)) return; g[y][x] = t; }
  const SABLONLAR = {
    acik(g, r) { const n = 3 + Math.floor(r() * 4); for (let i = 0; i < n; i++) koy(g, 3 + Math.floor(r() * 16), 3 + Math.floor(r() * 8), T.SUTUN); },
    izgara(g, r) { const o = Math.floor(r() * 2); for (const x of [4 + o, 8 + o, 13 + o, 17]) for (const y of [4, 8]) koy(g, x, y, T.SUTUN); },
    halka(g) { for (let i = 0; i < 12; i++) { if (i % 4 === 0) continue; const a = i * Math.PI / 6; koy(g, Math.round(11 + Math.cos(a) * 4.5), Math.round(6.5 + Math.sin(a) * 3.2), T.SUTUN); } },
    koridor(g, r) { const k1 = 3 + Math.floor(r() * 12), k2 = 3 + Math.floor(r() * 12); for (let x = 2; x <= 19; x++) { if (!(x >= k1 && x <= k1 + 1)) koy(g, x, 4, T.SUTUN); if (!(x >= k2 && x <= k2 + 1)) koy(g, x, 9, T.SUTUN); } },
    capraz(g) { for (let i = 0; i < 8; i++) { koy(g, 4 + i * 2, 3 + i, T.SUTUN); koy(g, 18 - i * 2, 3 + i, T.SUTUN); } },
    ada(g, r, hz) { for (let y = 4; y <= 9; y++) for (let x = 8; x <= 14; x++) { if ((x === 11 || x === 10) || y === 6 || y === 7) continue; koy(g, x, y, hz); } },
    nehir(g, r, hz) { const b1 = 2 + Math.floor(r() * 3), b2 = 8 + Math.floor(r() * 3); for (let y = 1; y <= 12; y++) { if ((y >= b1 && y <= b1 + 1) || (y >= b2 && y <= b2 + 1)) continue; koy(g, 10, y, hz); koy(g, 11, y, hz); } },
    bolmeli(g, r) { const k = 4 + Math.floor(r() * 3); for (let y = 1; y <= 12; y++) if (!(y >= k && y <= k + 3)) koy(g, 11, y, T.SUTUN); },
    sivriAlan(g, r) { for (let n = 0; n < 3; n++) { const cx = 3 + Math.floor(r() * 14), cy = 3 + Math.floor(r() * 6); for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if ((x + y) % 2 === 0) koy(g, cx + x, cy + y, T.SIVRI); } },
    dar(g) { for (let y = 3; y <= 10; y += 2) { koy(g, 3, y, T.SUTUN); koy(g, 4, y, T.SUTUN); koy(g, 18, y, T.SUTUN); koy(g, 19, y, T.SUTUN); } },
    kose(g) { for (const [cx, cy] of [[2, 2], [18, 2], [2, 10], [18, 10]]) for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) koy(g, cx + x, cy + y, T.SUTUN); },
    kume(g, r) { for (let n = 0; n < 3; n++) { const cx = 3 + Math.floor(r() * 15), cy = 3 + Math.floor(r() * 7); koy(g, cx, cy, T.SUTUN); koy(g, cx + 1, cy, T.SUTUN); koy(g, cx, cy + 1, T.SUTUN); koy(g, cx + 1, cy + 1, T.SUTUN); } }
  };
  const SABLON_ADLARI = Object.keys(SABLONLAR);

  function izgara() {
    const g = [];
    for (let y = 0; y < H; y++) { const s = []; for (let x = 0; x < W; x++) s.push(x === 0 || y === 0 || x === W - 1 || y === H - 1 ? T.DUVAR : T.ZEMIN); g.push(s); }
    return g;
  }
  // Başlangıçtan iki kapıya yürünebilir mi?
  function ulasilir(g) {
    const gec = (x, y) => { const t = g[y][x]; return t === T.ZEMIN || t === T.SIVRI || t === T.LAV || t === T.KAPI || t === T.KAPIK || t === T.GERI; };
    const goruldu = new Set(), q = [[11, 12]];
    goruldu.add(11 + 12 * W);
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || goruldu.has(nx + ny * W) || !gec(nx, ny)) continue;
        goruldu.add(nx + ny * W); q.push([nx, ny]);
      }
    }
    return KAPI_X.every(x => goruldu.has(x + 1 * W)) && goruldu.has(1 + 6 * W);
  }
  function hazardSec(r, biyom) { return biyom === 0 ? T.UCURUM : biyom === 1 ? T.LAV : (r() < 0.5 ? T.LAV : T.UCURUM); }
  function tehlikeEkle(g, r, biyom, bolum) {
    const say = biyom === 0 ? bolum : biyom === 1 ? 1 + bolum : 2 + bolum;
    const tip = biyom === 0 ? T.SIVRI : biyom === 1 ? T.LAV : (r() < 0.5 ? T.SIVRI : T.LAV);
    for (let i = 0; i < say; i++) { const cx = 3 + Math.floor(r() * 16), cy = 3 + Math.floor(r() * 8); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) if (g[cy + dy] && g[cy + dy][cx + dx] === T.ZEMIN) koy(g, cx + dx, cy + dy, tip); }
  }
  function sablonUret(r, biyom, bolum, gecmis) {
    for (let deneme = 0; deneme < 10; deneme++) {
      let ad;
      let adaylar = SABLON_ADLARI.filter(a => !gecmis.slice(-3).includes(a));
      if (biyom === 0) adaylar = adaylar.filter(a => a !== 'sivriAlan' || bolum > 0);
      ad = sec(r, adaylar.length ? adaylar : SABLON_ADLARI);
      const g = izgara();
      SABLONLAR[ad](g, r, hazardSec(r, biyom));
      tehlikeEkle(g, r, biyom, bolum);
      if (ulasilir(g)) return { g, ad };
    }
    return { g: izgara(), ad: 'acik' };
  }

  // ---------- Kadro (düşman dalgaları) ----------
  const KADROLAR = ['karisik', 'surunu', 'nisanci', 'agir', 'pusu'];
  const MALIYET = { kucuk: 1, menzil: 1.4, ozel: 1.8, agir: 2.6 };
  function dalgalarUret(r, tur, d, kadroGecmis) {
    const bi = BIYOMLAR[biyomOf(d)], bolum = bolumOf(d);
    const kadro = sec(r, KADROLAR.filter(k => k !== kadroGecmis[kadroGecmis.length - 1]));
    const toplam = 3.5 + d * 0.6 + (tur === 'elit' ? 2 : 0);
    const dalgaSay = d >= 5 ? 3 : 2;
    const roller = (x) => { const o = []; for (const rol of ['kucuk', 'menzil', 'ozel', 'agir']) { let w = rol === 'kucuk' ? 4 : rol === 'menzil' ? 2.5 : rol === 'ozel' ? 1 + bolum * 0.6 : (bolum >= 1 || d >= 3 ? 1 + bolum * 0.5 : 0); if (kadro === 'surunu') w = rol === 'kucuk' ? 10 : rol === 'menzil' ? 0.5 : w * 0.3; if (kadro === 'nisanci') w = rol === 'menzil' ? 8 : rol === 'kucuk' ? 2 : w; if (kadro === 'agir') w = rol === 'agir' ? 7 : rol === 'kucuk' ? 1.5 : w; if (bi[rol].length && w > 0) o.push([rol, w]); } return o; };
    const dalgalar = [];
    for (let w = 0; w < dalgaSay; w++) {
      const dalga = [];
      let b = toplam / dalgaSay;
      const havuz = roller();
      let koruma = 0;
      while (b > 0 && koruma++ < 30) {
        let t = havuz.reduce((a, x) => a + x[1], 0) * r(), rol = havuz[0][0];
        for (const [ad, wt] of havuz) { t -= wt; if (t <= 0) { rol = ad; break; } }
        const tip = sec(r, bi[rol]);
        const e = { tip, rol };
        if (tur !== 'elit' && d >= 6 && bolum >= 1 && r() < 0.08) e.etki = sec(r, Object.keys(ETKI));
        dalga.push(e); b -= MALIYET[rol];
      }
      dalgalar.push(dalga);
    }
    if (tur === 'elit') {
      const adaylar = bi.agir.concat(bi.ozel).filter(t => !DUSMAN[t].boss);
      dalgalar[0].unshift({ tip: sec(r, adaylar), rol: 'agir', etki: sec(r, Object.keys(ETKI)), elit: true });
      if (d >= 7) dalgalar[1].unshift({ tip: sec(r, adaylar), rol: 'agir', etki: sec(r, Object.keys(ETKI)), elit: true });
    }
    return { dalgalar, kadro };
  }

  // ---------- Oda üretimi ----------
  function odaUret(seed, tur, derinlik, meta, gecmis) {
    const r = mulberry(seed);
    gecmis = gecmis || { sablon: [], kadro: [] };
    const bi = biyomOf(derinlik), bolum = bolumOf(derinlik);
    const oda = { seed, tur, derinlik, biyom: bi, bolum, grid: null, temiz: false, odul: null, nesneler: [], dalgalar: [], dalga: 0, gizli: false, odulAlindi: false, kapiTur: [null, null], sablon: null, kadro: null };
    if (tur === 'gizli') {
      oda.grid = izgara(); oda.grid[H - 1][11] = T.GERI;
      oda.nesneler.push({ tur: 'sunak', alt: 'yetenek', x: 11, y: 6.5, aktif: true });
      oda.temiz = true;
      return oda;
    }
    if (tur === 'boss') {
      const g = izgara();
      SABLONLAR[['halka', 'kose', 'dar', 'izgara'][bi]](g, r, T.UCURUM);
      if (bi >= 1) for (const [x, y] of [[3, 3], [18, 3], [3, 10], [18, 10]]) koy(g, x, y, bi === 1 ? T.LAV : T.SIVRI);
      oda.grid = g; oda.sablon = 'boss';
      oda.dalgalar.push([{ tip: BIYOMLAR[bi].boss, rol: 'boss' }]);
      oda.odul = derinlik >= SON_DERINLIK ? 'yok' : 'armagan';
      if (derinlik < SON_DERINLIK) for (const x of KAPI_X) g[0][x] = T.KAPIK;
      return oda;
    }
    const sb = tur === 'dinlenme' || tur === 'pazar' || tur === 'baslangic' ? { g: izgara(), ad: tur === 'baslangic' ? 'acik' : 'duz' } : sablonUret(r, bi, bolum, gecmis.sablon);
    if (tur === 'baslangic') SABLONLAR.acik(sb.g, r);
    const g = sb.g; oda.grid = g; oda.sablon = sb.ad;
    // uçurum cebi + sandık (Gölge Atılımı gerekir)
    if (tur === 'savas' && derinlik >= 2 && r() < 0.35) {
      for (let y = 4; y <= 9; y++) { g[y][15] = T.UCURUM; g[y][16] = T.UCURUM; for (const x of [14, 17, 18, 19]) g[y][x] = T.ZEMIN; }
      oda.nesneler.push({ tur: 'sandik', x: 18.5, y: 6.5, aktif: true, kul: 35 + derinlik * 12 });
    }
    // çatlak duvar -> gizli oda
    if ((tur === 'savas' || tur === 'elit') && derinlik >= 1 && (derinlik === 2 || r() < 0.25)) { g[6][0] = T.CATLAK; oda.gizli = true; }
    // lanetli sandık
    if (tur === 'savas' && derinlik >= 3 && r() < 0.18) oda.nesneler.push({ tur: 'lanet', x: 17.5, y: 11, aktif: true });
    if (tur === 'dinlenme') { oda.nesneler.push({ tur: 'cesme', x: 9, y: 6.5, aktif: true }); oda.nesneler.push({ tur: 'ziyafet', x: 13, y: 6.5, aktif: true }); }
    if (tur === 'pazar') {
      const r2 = [['sifa', 'Şifa', 30], ['yem', 'Yemek ve su', 20], ['armagan', 'Armağan', 70], ['koz', '+1 köz yükü', 55]];
      r2.forEach((u, i) => oda.nesneler.push({ tur: 'raf', alt: u[0], ad: u[1], fiyat: u[2] + Math.floor(derinlik * 2), x: 6 + i * 3.4, y: 6.5, aktif: true }));
    }
    if (derinlik < SON_DERINLIK) for (const x of KAPI_X) g[0][x] = T.KAPIK;
    if (tur === 'savas' || tur === 'elit') {
      const dl = dalgalarUret(r, tur, derinlik, gecmis.kadro);
      oda.dalgalar = dl.dalgalar; oda.kadro = dl.kadro;
      oda.odul = tur === 'elit' ? 'armagan' : (r() < 0.62 ? 'armagan' : 'kul');
    } else oda.temiz = true;
    return oda;
  }
  function kapiTurleri(rnd, derinlik, muhurlar) {
    const sonraki = derinlik + 1;
    if (bossMu(sonraki)) return ['boss', 'boss'];
    const cimri = muhurlar && muhurlar.cimri;
    if (derinlik > 0 && bossMu(derinlik)) return [cimri ? 'savas' : 'dinlenme', cimri ? 'savas' : 'pazar'];
    const bolum = bolumOf(sonraki);
    let havuz = ['savas', 'savas', 'savas'];
    if (bolum >= 2) havuz.push('elit');
    if (bolum >= 1) { if (!cimri) havuz.push('dinlenme', 'pazar'); }
    if (sonraki === 1) havuz = ['savas'];
    const a = sec(rnd, havuz);
    const kalan = havuz.filter(x => x !== a);
    const b = sec(rnd, kalan.length ? kalan : havuz);
    return [a, b];
  }

  // ---------- Koşu ----------
  function yeniKosu(seed, meta, muhurlar) {
    const m = meta || mirasBos();
    const rnd = mulberry(seed ^ 0x9e3779b9);
    const mh = {}; if (muhurlar && m.yetenek.kirik) for (const k in MUHURLER) if (muhurlar[k]) mh[k] = true;
    const s = {
      seed, rnd, meta: m, muhur: mh, derinlik: 0, olaylar: [], zaman: 0, bitti: null, secim: null, kul: 0, oldurme: 0,
      armagan: {}, kullanilanSans: false, enemies: [], mermiler: [], tuzaklar: [], ustOda: null, gizliBulundu: false,
      p: null, oda: null, odaSayac: 0, gecmis: { sablon: [], kadro: [] }, kozElde: 0
    };
    const g = m.seviye;
    s.p = {
      x: 11, y: 11.4, r: 0.32, dir: -Math.PI / 2, hp: 100 + 10 * g.zirh, maxHp: 100 + 10 * g.zirh,
      swingT: 0, swingCd: 0, dashT: 0, dashCd: 0, dashX: 0, dashY: 0, inv: 0, kozYuk: 2 + g.koz, kozMaks: 2 + g.koz, kozSayac: 0, swingId: 0, swingYon: 0,
      aclik: 100, susuz: 100, aci: 0, cemberA: 0, lavT: 0
    };
    s.oda = odaUret(seed + 1, 'baslangic', 0, m, s.gecmis);
    s.oda.kapiTur = kapiTurleri(rnd, 0, mh);
    for (const x of KAPI_X) s.oda.grid[0][x] = T.KAPI;
    s.oda.temiz = true;
    for (let i = 0; i < g.ilk; i++) rastgeleArmagan(s);
    return s;
  }
  // Sade başlangıç: ilk 5 Armağan baştan açık; kalanlar boss yenildikçe açılır (1 boss: +2, 2 boss: +2, 3 boss: +1).
  // Eşleşmeler (Armağan iki yönlü ipucu): alev+cember: küreler yakar; tilsim+kan: öldürmede açlık/su dolar; golge+kivilcim: atılımda vurunca +1 köz yükü.
  const ESLESME = [['alev', 'cember', 'Küreler yakar'], ['tilsim', 'kan', 'Öldürmede açlık ve su dolar'], ['golge', 'kivilcim', 'Atılımla vurunca +1 köz yükü']];
  const ARMAGAN_SIRA = ['keskin', 'ruzgar', 'kalp', 'bilek', 'alev', 'golge', 'kivilcim', 'kan', 'cember', 'tilsim'];
  function armaganAcik(s) {
    const b = Math.min(3, (s.meta && s.meta.bossOldu) || 0);
    return ARMAGAN_SIRA.slice(0, 5 + (b >= 1 ? 2 : 0) + (b >= 2 ? 2 : 0) + (b >= 3 ? 1 : 0));
  }
  function rastgeleArmagan(s) {
    const idler = armaganAcik(s).filter(k => (s.armagan[k] || 0) < 6);
    if (!idler.length) return;
    armaganAl(s, sec(s.rnd, idler), 0);
  }
  function armaganAl(s, id, nadir) {
    const guc = NADIRLIK[nadir || 0].guc;
    s.armagan[id] = (s.armagan[id] || 0) + guc;
    if (id === 'kalp') { const k = Math.round(25 * guc); s.p.maxHp += k; s.p.hp = Math.min(s.p.maxHp, s.p.hp + k); }
    if (id === 'kivilcim') { const k = nadir >= 1 ? 2 : 1; s.p.kozMaks += k; s.p.kozYuk += k; }
  }
  const hasarCarpan = s => (1 + 0.08 * s.meta.seviye.guc) * (1 + 0.2 * (s.armagan.keskin || 0)) * (s.p.aclik < 25 ? 0.85 : 1);
  const hizCarpan = s => (1 + 0.12 * (s.armagan.ruzgar || 0)) * (s.p.susuz < 25 ? 0.88 : 1);
  const swingCd = s => 0.4 * Math.pow(0.85, s.armagan.bilek || 0);
  const olay = (s, tip, o) => s.olaylar.push(Object.assign({ tip }, o || {}));
  const acHizi = s => (1 - 0.15 * s.meta.seviye.iase) * (s.armagan.tilsim ? Math.pow(0.75, Math.min(2, s.armagan.tilsim)) : 1) * (s.muhur.kitlik ? 1.6 : 1);

  // ---------- Çarpışma ----------
  function engelli(s, t, ent) {
    if (t === T.DUVAR || t === T.SUTUN || t === T.CATLAK || t === T.KAPIK) return true;
    if (t === T.UCURUM) return !(ent === s.p && s.p.dashT > 0 && s.meta.yetenek.sicrama) && !(ent && ent.ucar);
    return false;
  }
  function hucre(s, x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return T.DUVAR;
    return s.oda.grid[iy][ix];
  }
  function carpisir(s, ent, x, y) {
    const r = ent.r;
    return engelli(s, hucre(s, x - r, y - r), ent) || engelli(s, hucre(s, x + r, y - r), ent) || engelli(s, hucre(s, x - r, y + r), ent) || engelli(s, hucre(s, x + r, y + r), ent);
  }
  function hareket(s, ent, dx, dy) {
    if (!carpisir(s, ent, ent.x + dx, ent.y)) ent.x += dx;
    if (!carpisir(s, ent, ent.x, ent.y + dy)) ent.y += dy;
  }
  // Diken durumu: 0 kapalı, 1 uyarı, 2 açık
  function sivriDurum(zaman, x, y) { const ph = (zaman + ((x * 7 + y * 13) % 5) * 0.3) % 3; return ph > 2.2 ? 2 : ph > 1.6 ? 1 : 0; }

  // ---------- Hasar ----------
  function oyuncuHasar(s, d, kaynak) {
    const p = s.p;
    if (p.inv > 0 || p.dashT > 0 || s.bitti) return;
    p.hp -= d; p.inv = 0.8;
    olay(s, 'hasar', { x: p.x, y: p.y, d, kaynak });
    if (p.hp <= 0) {
      if (s.meta.seviye.sans > 0 && !s.kullanilanSans) {
        s.kullanilanSans = true; p.hp = Math.ceil(p.maxHp * 0.4); p.inv = 2;
        olay(s, 'sans', { x: p.x, y: p.y });
      } else { p.hp = 0; bitir(s, 'yenilgi'); }
    }
  }
  function dusmanHasar(s, e, d, aci) {
    if (e.dogum > 0 || e.olu) return;
    if (e.faz === 'hayalet') { olay(s, 'blok', { x: e.x, y: e.y }); return; }
    if (e.tip === 'demirci' && Math.cos(aci - (e.ac + Math.PI)) > 0.45) { d *= 0.15; olay(s, 'blok', { x: e.x, y: e.y }); }
    if (e.etki === 'zirh') d *= 0.6;
    e.hp -= d; e.flas = 0.12;
    const kuvvet = DUSMAN[e.tip].boss ? 0.6 : e.tip === 'demirci' || e.tip === 'buzdev' ? 1.5 : 4;
    e.kx = Math.cos(aci) * kuvvet; e.ky = Math.sin(aci) * kuvvet;
    if (s.armagan.alev) e.yanik = 3;
    olay(s, 'vurus', { x: e.x, y: e.y, d });
    if (e.hp <= 0) oldur(s, e);
  }
  function oldur(s, e) {
    if (e.olu) return;
    e.olu = true; s.oldurme++;
    const tn = DUSMAN[e.tip];
    const kazan = Math.round(tn.kul * (e.mini ? 0.4 : 1) * (e.etki ? 1.6 : 1) * (1 + 0.15 * s.meta.seviye.kul));
    s.kul += kazan;
    if (s.armagan.kan) { s.p.hp = Math.min(s.p.maxHp, s.p.hp + 2 * s.armagan.kan); if (s.armagan.tilsim) { s.p.aclik = Math.min(100, s.p.aclik + 2); s.p.susuz = Math.min(100, s.p.susuz + 2); } }
    olay(s, 'oldu', { x: e.x, y: e.y, tip: e.tip, kul: kazan });
    if (tn.boss) { for (const o2 of s.enemies) if (o2 !== e && !o2.olu) { o2.olu = true; olay(s, 'oldu', { x: o2.x, y: o2.y, tip: o2.tip, kul: 0 }); } s.mermiler.length = 0; s.tuzaklar.length = 0; }
    if (tn.ai === 'patlayan') { olay(s, 'patla', { x: e.x, y: e.y }); if (mesafe(e, s.p) < 1.7) oyuncuHasar(s, 14, 'patlama'); }
    if (e.etki === 'bolen' && !e.mini) for (let i = 0; i < 2; i++) dusmanOlustur(s, e.tip, clamp(e.x + (i ? 0.7 : -0.7), 1.5, 20.5), e.y, { mini: true, hpK: 0.4 });
    if (!tn.boss && !e.mini && s.rnd() < (s.muhur.kitlik ? 0.06 : 0.14)) {
      const tur = s.p.aclik < s.p.susuz ? 'et' : 'su';
      s.oda.nesneler.push({ tur, x: clamp(e.x, 1.5, 20.5), y: clamp(e.y, 1.5, 12.5), aktif: true });
    }
  }

  // ---------- Odaya girme / geçiş ----------
  function odayaGir(s, oda, giris) {
    s.oda = oda; s.enemies = []; s.mermiler = []; s.tuzaklar = [];
    s.p.x = giris.x; s.p.y = giris.y; s.p.dashT = 0; s.p.inv = 1;
    s.p.kozYuk = s.p.kozMaks;
    olay(s, 'oda', { tur: oda.tur, biyom: oda.biyom, bolum: oda.bolum });
  }
  function sonrakiOda(s, kapi) {
    return odaUret(s.seed + 100 + (s.odaSayac + 1) * 7, s.oda.kapiTur[kapi] || 'savas', s.derinlik + 1, s.meta, s.gecmis);
  }
  // Kapı önizlemesi her karede çağrılır: oda başına kapı başına bir kez üretilir (oda nesnesine bağlı önbellek).
  function onizle(s, kapi) {
    const oc = s.oda._onizle || (s.oda._onizle = {});
    if (!oc[kapi]) { const o = sonrakiOda(s, kapi); oc[kapi] = { tur: o.tur, odul: o.odul, biyom: o.biyom }; }
    return oc[kapi];
  }
  function ilerle(s, kapi) {
    const oda = sonrakiOda(s, kapi);
    s.derinlik++; s.odaSayac++;
    if (oda.sablon && oda.sablon !== 'duz' && oda.sablon !== 'boss') s.gecmis.sablon.push(oda.sablon);
    if (oda.kadro) s.gecmis.kadro.push(oda.kadro);
    oda.kapiTur = kapiTurleri(s.rnd, s.derinlik, s.muhur);
    if (oda.biyom !== s.oda.biyom) { s.p.aclik = Math.min(100, s.p.aclik + 35); s.p.susuz = Math.min(100, s.p.susuz + 35); }
    odayaGir(s, oda, { x: 11, y: 12 });
  }
  function dusmanOlustur(s, tip, x, y, o) {
    o = o || {};
    const tn = DUSMAN[tip];
    let hp = tn.hp * (tn.boss ? 1 : 1 + 0.1 * Math.max(0, s.oda.derinlik - 1)) * (o.hpK || 1);
    if (s.muhur.sert) hp *= 1.25;
    if (tn.boss && s.muhur.kral) hp *= 1.3;
    if (o.etki) hp *= o.etki === 'zirh' ? 1.4 : 1.8;
    if (o.elit) hp *= 1.8;
    const e = { tip, x, y, r: tn.r * (o.mini ? 0.8 : 1), ucar: !!tn.ucar, hp, maxHp: hp, dogum: o.dogum === undefined ? 0.9 : o.dogum, atk: 1 + s.rnd(), faz: 'bekle', fazT: 1 + s.rnd(), kx: 0, ky: 0, flas: 0, yanik: 0, olu: false, temasCd: 0, ac: 0, etki: o.etki || null, elit: !!o.elit, mini: !!o.mini, hizK: (o.etki === 'hizli' ? 1.35 : 1) * (s.muhur.hizli ? 1.15 : 1), sayac: 0, hedef: 0, hizliT: 0 };
    s.enemies.push(e);
    return e;
  }
  function dalgaBaslat(s) {
    const o = s.oda;
    const dalga = o.dalgalar[o.dalga];
    if (!dalga) return;
    dalga.forEach((d, i) => {
      let x, y, deneme = 0;
      do {
        if (o.kadro === 'pusu') { x = (i % 2 ? 19 : 2.5) + s.rnd() * 1.2; y = (i % 4 < 2 ? 2 : 9) + s.rnd() * 1.5; } else { x = 2 + s.rnd() * 18; y = 1.8 + s.rnd() * 6.5; }
        deneme++;
      } while ((carpisir(s, { r: 0.6 }, x, y) || mesafe({ x, y }, s.p) < 4) && deneme < 40);
      const e = dusmanOlustur(s, d.tip, x, y, { etki: d.etki, elit: d.elit, dogum: 0.9 + i * 0.1 });
      if (d.rol === 'boss') e.dogum = 0.4;
    });
    o.dalga++;
    olay(s, 'dalga', { n: o.dalga });
  }
  function temizlendi(s) {
    const o = s.oda;
    o.temiz = true;
    if (o.tur === 'boss') {
      s.meta.yetenek.kirik = true; s.meta.bossOldu++;
      if (o.derinlik >= SON_DERINLIK) { s.meta.zafer++; bitir(s, 'zafer'); return; }
      olay(s, 'bossOldu', { biyom: o.biyom });
      s.p.hp = Math.min(s.p.maxHp, s.p.hp + Math.ceil(s.p.maxHp * 0.3));
    }
    for (const x of KAPI_X) if (o.grid[0][x] === T.KAPIK) o.grid[0][x] = T.KAPI;
    if (o.odul === 'armagan') o.nesneler.push({ tur: 'sunak', alt: 'armagan', x: 11, y: 5.5, aktif: true, min: o.tur === 'elit' || o.tur === 'boss' ? 1 : 0 });
    if (o.odul === 'kul') { const k = 25 + o.derinlik * 10; s.kul += k; olay(s, 'kul', { x: 11, y: 6, kul: k }); }
    if (o.tur === 'elit') { const k = 30 + o.derinlik * 8; s.kul += k; olay(s, 'kul', { x: 11, y: 6, kul: k }); }
    olay(s, 'temiz');
  }
  function bitir(s, durum) {
    if (s.bitti) return;
    s.bitti = durum;
    const m = s.meta;
    const bonus = Object.keys(s.muhur).reduce((a, k) => a + MUHURLER[k].bonus, 0);
    const kazanc = Math.round((s.kul + (durum === 'zafer' ? 80 : 0)) * (1 + bonus));
    s.kazanc = kazanc;
    m.kul += kazanc; m.kosu++; m.enIyi = Math.max(m.enIyi, s.derinlik);
    olay(s, durum);
  }

  // ---------- Saldırılar ----------
  function savur(s, aci) {
    const p = s.p;
    p.swingT = 0.2; p.swingCd = swingCd(s); p.swingYon = aci; p.swingId++;
    const hasar = 22 * hasarCarpan(s);
    const menzil = 1.75;
    for (const e of s.enemies) {
      if (e.olu || e.dogum > 0) continue;
      const d = mesafe(e, p);
      if (d > menzil + e.r) continue;
      let fark = Math.atan2(e.y - p.y, e.x - p.x) - aci;
      fark = Math.atan2(Math.sin(fark), Math.cos(fark));
      if (Math.abs(fark) < 1.15 || d < e.r + 0.6) dusmanHasar(s, e, hasar, aci);
    }
    for (const m of s.mermiler) if (m.dusman && !m.boss && mesafe(m, p) < menzil) { m.dusman = false; m.vx = -m.vx * 1.4; m.vy = -m.vy * 1.4; m.hasar = 14 * hasarCarpan(s); olay(s, 'sekti', { x: m.x, y: m.y }); }
    if (s.meta.yetenek.kirik) {
      for (let a = -0.6; a <= 0.61; a += 0.3) {
        const tx = p.x + Math.cos(aci + a) * 1.5, ty = p.y + Math.sin(aci + a) * 1.5;
        const ix = Math.floor(tx), iy = Math.floor(ty);
        if (ix >= 0 && iy >= 0 && ix < W && iy < H && s.oda.grid[iy][ix] === T.CATLAK) { s.oda.grid[iy][ix] = T.GIZLIKAPI; olay(s, 'kirildi', { x: ix + 0.5, y: iy + 0.5 }); }
      }
    }
    olay(s, 'savur', { x: p.x, y: p.y, aci });
  }
  function kozAt(s, aci) {
    const p = s.p;
    if (p.kozYuk < 1) return;
    p.kozYuk--;
    s.mermiler.push({ x: p.x, y: p.y, vx: Math.cos(aci) * 11, vy: Math.sin(aci) * 11, dost: true, dusman: false, hasar: 15 * hasarCarpan(s), r: 0.2, omur: 1.4, delme: s.armagan.kivilcim ? 2 : 0, vuruldu: new Set() });
    olay(s, 'koz', { x: p.x, y: p.y, aci });
  }
  function atilim(s, mx, my) {
    const p = s.p;
    if (p.dashCd > 0 || p.dashT > 0) return;
    let dx = mx, dy = my;
    const l = Math.hypot(dx, dy);
    if (l < 0.1) { dx = Math.cos(p.dir); dy = Math.sin(p.dir); } else { dx /= l; dy /= l; }
    p.dashX = dx; p.dashY = dy; p.dashT = 0.18; p.dashCd = 0.7 * Math.pow(0.8, s.armagan.golge || 0); p.dashVuruldu = new Set(); p.dashKoz = false;
    olay(s, 'atilim', { x: p.x, y: p.y });
  }
  function dusmanAtis(s, e, aci, hiz, hasar, ek) {
    s.mermiler.push(Object.assign({ x: e.x, y: e.y, vx: Math.cos(aci) * hiz, vy: Math.sin(aci) * hiz, dost: false, dusman: true, hasar, r: 0.2, omur: 5, delme: 0, vuruldu: new Set() }, ek || {}));
  }
  function tuzakKur(s, x, y, r, hasar, t) { s.tuzaklar.push({ x: clamp(x, 1.5, 20.5), y: clamp(y, 1.5, 12.5), r: r || 1.1, t: t || 0.9, m: t || 0.9, hasar: hasar || 16 }); }

  // ---------- Ana adım ----------
  function adim(s, girdi, dt) {
    if (s.bitti || s.secim) return;
    const p = s.p, o = s.oda;
    s.zaman += dt;
    for (const k of ['swingT', 'swingCd', 'dashCd', 'inv']) p[k] = Math.max(0, p[k] - dt);
    if (p.kozYuk < p.kozMaks) { p.kozSayac += dt; if (p.kozSayac >= 2.6) { p.kozSayac = 0; p.kozYuk++; } } else p.kozSayac = 0;
    // açlık ve susuzluk (ana unsur değil: yavaş akar, can yenmez, 0'da yavaş can kaybı, ölümcül değil)
    const ah = acHizi(s);
    if (o.tur !== 'gizli') { p.aclik = Math.max(0, p.aclik - dt * 0.2 * ah); p.susuz = Math.max(0, p.susuz - dt * 0.26 * ah); }
    if ((p.aclik <= 0 || p.susuz <= 0) && p.hp > 1) { p.hp = Math.max(1, p.hp - dt * 1.2); }
    if (girdi.hx !== undefined) p.dir = Math.atan2(girdi.hy - p.y, girdi.hx - p.x);
    if (p.dashT > 0) {
      p.dashT -= dt;
      const v = 14.5 * dt;
      hareket(s, p, p.dashX * v, p.dashY * v);
      if (p.dashT <= 0 && hucre(s, p.x, p.y) === T.UCURUM) p.dashT = 0.04;
      if (s.armagan.golge) for (const e of s.enemies) if (!e.olu && e.dogum <= 0 && !p.dashVuruldu.has(e) && mesafe(e, p) < e.r + 0.7) { p.dashVuruldu.add(e); dusmanHasar(s, e, 15 * hasarCarpan(s) * s.armagan.golge, Math.atan2(p.dashY, p.dashX)); if (s.armagan.kivilcim && !p.dashKoz) { p.dashKoz = true; p.kozYuk = Math.min(p.kozMaks, p.kozYuk + 1); } }
    } else {
      let mx = girdi.mx || 0, my = girdi.my || 0;
      const l = Math.hypot(mx, my);
      if (l > 1) { mx /= l; my /= l; }
      const v = 4.6 * hizCarpan(s) * dt * (p.swingT > 0 ? 0.55 : 1);
      hareket(s, p, mx * v, my * v);
    }
    if (girdi.atilim) atilim(s, girdi.mx || 0, girdi.my || 0);
    if (girdi.savur && p.swingCd <= 0 && p.dashT <= 0) savur(s, p.dir);
    if (girdi.koz) kozAt(s, p.dir);
    // zemin tehlikeleri
    const zt = hucre(s, p.x, p.y);
    if (zt === T.SIVRI && sivriDurum(s.zaman, Math.floor(p.x), Math.floor(p.y)) === 2) oyuncuHasar(s, 12, 'diken');
    if (zt === T.LAV) { p.lavT -= dt; if (p.lavT <= 0 && p.dashT <= 0) { p.lavT = 0.6; oyuncuHasar(s, 8, 'lav'); } }
    // Köz Çemberi
    if (s.armagan.cember) {
      p.cemberA += dt * 3.2;
      const n = 2 + Math.floor(s.armagan.cember);
      for (let i = 0; i < n; i++) {
        const a = p.cemberA + i * Math.PI * 2 / n, cx = p.x + Math.cos(a) * 1.7, cy = p.y + Math.sin(a) * 1.3;
        for (const e of s.enemies) if (!e.olu && e.dogum <= 0 && Math.hypot(e.x - cx, e.y - cy) < e.r + 0.3 && s.zaman - (e.cemberT || -9) > 0.5) { e.cemberT = s.zaman; dusmanHasar(s, e, 8 * hasarCarpan(s), a); if (s.armagan.alev) e.yanik = 3; }
      }
    }
    // dalgalar
    if ((o.tur === 'savas' || o.tur === 'boss' || o.tur === 'elit') && !o.temiz) {
      const canli = s.enemies.filter(e => !e.olu).length;
      if (canli === 0 && o.dalga < o.dalgalar.length) dalgaBaslat(s);
      else if (canli === 0 && o.dalga >= o.dalgalar.length) temizlendi(s);
    }
    for (const e of s.enemies.slice()) if (!e.olu) dusmanAdim(s, e, dt);
    s.enemies = s.enemies.filter(e => !e.olu);
    // tuzaklar
    for (const t of s.tuzaklar) { t.t -= dt; if (t.t <= 0) { olay(s, 'patla', { x: t.x, y: t.y }); if (Math.hypot(p.x - t.x, p.y - t.y) < t.r + p.r) oyuncuHasar(s, t.hasar, 'tuzak'); } }
    s.tuzaklar = s.tuzaklar.filter(t => t.t > 0);
    // mermiler
    for (const m of s.mermiler) {
      m.omur -= dt; m.x += m.vx * dt; m.y += m.vy * dt;
      const t = hucre(s, m.x, m.y);
      if (t === T.DUVAR || t === T.SUTUN || t === T.CATLAK || t === T.KAPIK) { m.omur = 0; olay(s, 'carp', { x: m.x, y: m.y }); continue; }
      if (m.dusman) { if (mesafe(m, p) < p.r + m.r) { oyuncuHasar(s, m.hasar, 'mermi'); m.omur = 0; } }
      else for (const e of s.enemies) {
        if (e.olu || e.dogum > 0 || m.vuruldu.has(e) || mesafe(m, e) > e.r + m.r) continue;
        m.vuruldu.add(e); dusmanHasar(s, e, m.hasar, Math.atan2(m.vy, m.vx));
        if (m.delme > 0) m.delme--; else { m.omur = 0; break; }
      }
    }
    s.mermiler = s.mermiler.filter(m => m.omur > 0);
    nesneler(s);
    // kapılar ve geçişler
    if (o.temiz && p.y < 1.05 && o.tur !== 'gizli') {
      for (let i = 0; i < 2; i++) if (o.grid[0][KAPI_X[i]] === T.KAPI && Math.abs(p.x - (KAPI_X[i] + 0.5)) < 0.9) { ilerle(s, i); return; }
    }
    if (p.x < 0.9 && Math.abs(p.y - 6.5) < 0.9 && o.grid[6][0] === T.GIZLIKAPI) {
      const gz = odaUret(s.seed + 5000 + s.derinlik, 'gizli', s.derinlik, s.meta, s.gecmis);
      s.ustOda = o; s.gizliBulundu = true;
      odayaGir(s, gz, { x: 11, y: 12 });
      return;
    }
    if (o.tur === 'gizli' && p.y > H - 1.1 && Math.abs(p.x - 11.5) < 1) {
      const ust = s.ustOda; s.ustOda = null;
      odayaGir(s, ust, { x: 1.8, y: 6.5 });
    }
  }
  function armaganSecenekleri(s, min) {
    const idler = armaganAcik(s).filter(k => (s.armagan[k] || 0) < 6);
    for (let i = idler.length - 1; i > 0; i--) { const j = Math.floor(s.rnd() * (i + 1)); [idler[i], idler[j]] = [idler[j], idler[i]]; }
    return idler.slice(0, 3).map(id => {
      const x = s.rnd(), sans = Math.min(0.5, 0.05 + s.derinlik * 0.03);
      let nadir = x < sans * 0.3 ? 2 : x < sans ? 1 : 0;
      nadir = Math.max(nadir, min || 0);
      return { id, nadir };
    });
  }
  function nesneler(s) {
    const o = s.oda, p = s.p;
    for (const n of o.nesneler) {
      if (!n.aktif || mesafe(n, p) > 0.9) continue;
      if (n.tur === 'sandik') { n.aktif = false; s.kul += n.kul; olay(s, 'kul', { x: n.x, y: n.y, kul: n.kul }); }
      else if (n.tur === 'cesme') { n.aktif = false; p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * 0.4)); p.susuz = 100; olay(s, 'iyiles', { x: n.x, y: n.y }); }
      else if (n.tur === 'ziyafet') { n.aktif = false; p.aclik = 100; p.hp = Math.min(p.maxHp, p.hp + 10); olay(s, 'iyiles', { x: n.x, y: n.y }); }
      else if (n.tur === 'et') { n.aktif = false; p.aclik = Math.min(100, p.aclik + 32); olay(s, 'yedi', { x: n.x, y: n.y }); }
      else if (n.tur === 'su') { n.aktif = false; p.susuz = Math.min(100, p.susuz + 32); olay(s, 'yedi', { x: n.x, y: n.y }); }
      else if (n.tur === 'lanet') { n.aktif = false; p.hp = Math.max(1, p.hp - Math.ceil(p.maxHp * 0.25)); olay(s, 'lanet', { x: n.x, y: n.y }); s.secim = { tur: 'armagan', secenekler: armaganSecenekleri(s, 1) }; }
      else if (n.tur === 'sunak' && n.alt === 'armagan') { n.aktif = false; s.secim = { tur: 'armagan', secenekler: armaganSecenekleri(s, n.min || 0) }; }
      else if (n.tur === 'sunak' && n.alt === 'yetenek') {
        n.aktif = false;
        if (!s.meta.yetenek.sicrama) { s.meta.yetenek.sicrama = true; olay(s, 'yetenek', { id: 'sicrama' }); } else { s.kul += 80; olay(s, 'kul', { x: n.x, y: n.y, kul: 80 }); }
      } else if (n.tur === 'raf') {
        if (s.kul < n.fiyat) { if (s.zaman - (n.uyari || -9) > 1.5) { n.uyari = s.zaman; olay(s, 'yetmez', { x: n.x, y: n.y }); } continue; }
        s.kul -= n.fiyat; n.aktif = false; olay(s, 'satin', { x: n.x, y: n.y });
        if (n.alt === 'sifa') p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * 0.5));
        else if (n.alt === 'yem') { p.aclik = 100; p.susuz = 100; }
        else if (n.alt === 'koz') { p.kozMaks++; p.kozYuk++; }
        else if (n.alt === 'armagan') s.secim = { tur: 'armagan', secenekler: armaganSecenekleri(s, 0) };
      }
    }
  }

  // ---------- Düşman yapay zekası ----------
  function dusmanAdim(s, e, dt) {
    const p = s.p, tn = DUSMAN[e.tip];
    e.flas = Math.max(0, e.flas - dt);
    if (e.dogum > 0) { e.dogum -= dt; return; }
    if (e.yanik > 0) { e.yanik -= dt; e.hp -= 5 * dt; if (e.hp <= 0) { oldur(s, e); return; } }
    if (e.hizliT > 0) e.hizliT -= dt;
    if (Math.abs(e.kx) + Math.abs(e.ky) > 0.05) { hareket(s, e, e.kx * dt, e.ky * dt); e.kx *= Math.pow(0.001, dt); e.ky *= Math.pow(0.001, dt); }
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.ac = Math.atan2(dy, dx);
    e.temasCd = Math.max(0, e.temasCd - dt);
    const hiz = tn.hiz * e.hizK * (e.hizliT > 0 ? 1.3 : 1) * (1 + 0.03 * s.oda.derinlik);
    const git = (v, yon) => {
      const ox = e.x, oy = e.y;
      hareket(s, e, Math.cos(yon) * v * dt, Math.sin(yon) * v * dt);
      if (Math.hypot(e.x - ox, e.y - oy) < v * dt * 0.3) { // engel: yana kay
        if (!e.yan) e.yan = s.rnd() < 0.5 ? 1 : -1;
        hareket(s, e, Math.cos(yon + 1.3 * e.yan) * v * dt, Math.sin(yon + 1.3 * e.yan) * v * dt);
      }
    };
    e.fazT -= dt;
    let temasVar = true;
    switch (tn.ai) {
      case 'kovala': git(hiz, e.ac); break;
      case 'atilgan': {
        if (e.faz === 'bekle') {
          if (d > 4) git(hiz, e.ac); else git(hiz * 0.7, e.ac + Math.PI / 2 * (e.sayac % 2 ? 1 : -1));
          if (e.fazT <= 0 && d < 7) {
            e.faz = 'hazir'; e.fazT = 0.5; e.hedef = e.ac; olay(s, 'uyari', { x: e.x, y: e.y });
            if (tn.uluma) { olay(s, 'uluma', { x: e.x, y: e.y }); for (const o2 of s.enemies) if (!o2.olu && o2 !== e) o2.hizliT = 5; }
          }
        } else if (e.faz === 'hazir') { e.hedef = e.ac; if (e.fazT <= 0) { e.faz = 'hamle'; e.fazT = 0.38; } }
        else { git(tn.atilim, e.hedef); if (e.fazT <= 0) { e.faz = 'bekle'; e.fazT = 1.2 + s.rnd(); e.sayac++; } }
        break;
      }
      case 'nisanci': {
        if (d > 5.5) git(hiz, e.ac); else if (d < 3.5) git(hiz, e.ac + Math.PI); else git(hiz * 0.5, e.ac + Math.PI / 2);
        e.atk -= dt;
        if (e.atk <= 0) {
          e.atk = 2.1;
          if (s.oda.derinlik >= 4) for (const a of [-0.28, 0, 0.28]) dusmanAtis(s, e, e.ac + a, 5.0, 8); else dusmanAtis(s, e, e.ac, 5.2, 10);
          olay(s, 'cadiAtis', { x: e.x, y: e.y });
        }
        break;
      }
      case 'cirpinan': {
        e.sayac += dt;
        if (e.faz === 'bekle') { const a = e.ac + Math.sin(e.sayac * 3) * 1.1; git(hiz * 0.9, a); if (e.fazT <= 0) { e.faz = 'hamle'; e.fazT = 0.45; e.hedef = e.ac; olay(s, 'uyari', { x: e.x, y: e.y }); } }
        else { git(hiz * 2.2, e.hedef); if (e.fazT <= 0) { e.faz = 'bekle'; e.fazT = 1.4 + s.rnd(); } }
        break;
      }
      case 'devasa': {
        if (e.faz === 'bekle') { git(hiz, e.ac); if (e.fazT <= 0 && d < 3.2) { e.faz = 'hazir'; e.fazT = 0.8; olay(s, 'uyari', { x: e.x, y: e.y }); } }
        else if (e.faz === 'hazir' && e.fazT <= 0) {
          for (let i = 0; i < 12; i++) dusmanAtis(s, e, i * Math.PI / 6, 4.0, 10, { omur: 1.2 });
          olay(s, 'halka', { x: e.x, y: e.y }); e.faz = 'bekle'; e.fazT = 2;
        }
        break;
      }
      case 'isinlan': {
        if (e.faz === 'bekle') { git(hiz, e.ac); if (e.fazT <= 0) { e.faz = 'hayalet'; e.fazT = 0.45; olay(s, 'kaybol', { x: e.x, y: e.y }); } }
        else if (e.faz === 'hayalet') {
          if (e.fazT <= 0) {
            const a = e.ac + Math.PI + (s.rnd() - 0.5), nx = p.x + Math.cos(a) * 1.6, ny = p.y + Math.sin(a) * 1.6;
            if (!carpisir(s, e, nx, ny)) { e.x = nx; e.y = ny; }
            e.faz = 'hazir'; e.fazT = 0.45; olay(s, 'belir', { x: e.x, y: e.y });
          }
          temasVar = false;
        } else if (e.faz === 'hazir') { if (e.fazT <= 0) { e.faz = 'bekle'; e.fazT = 2.4 + s.rnd(); if (d < 2) oyuncuHasar(s, 14, 'albasti'); olay(s, 'toz', { x: e.x, y: e.y }); } }
        break;
      }
      case 'patlayan': {
        git(hiz, e.ac);
        if (d < e.r + p.r + 0.3) { e.hp = 0; oldur(s, e); return; }
        temasVar = false;
        break;
      }
      case 'kalkanli': git(hiz, e.ac); if (e.fazT <= 0 && e.faz === 'bekle' && d < 1.8) { e.faz = 'hazir'; e.fazT = 0.5; olay(s, 'uyari', { x: e.x, y: e.y }); } else if (e.faz === 'hazir' && e.fazT <= 0) { e.faz = 'bekle'; e.fazT = 2; if (mesafe(e, p) < 2) oyuncuHasar(s, 18, 'çekiç'); olay(s, 'toz', { x: e.x, y: e.y }); } break;
      case 'surunen': e.sayac += dt; git(hiz, e.ac + Math.sin(e.sayac * 6) * 0.9); break;
      case 'kok': {
        e.atk -= dt;
        if (e.atk <= 0) { e.atk = 2.6; tuzakKur(s, p.x, p.y, 1.1, 14, 0.9); tuzakKur(s, p.x + (s.rnd() - 0.5) * 3, p.y + (s.rnd() - 0.5) * 3, 1.0, 12, 1.1); }
        temasVar = false;
        break;
      }
      case 'golge': {
        if (e.faz === 'bekle' || e.faz === 'hayalet') {
          e.faz = 'hayalet'; git(hiz * 1.3, e.ac);
          if (d < 3.4 || e.fazT <= 0) { e.faz = 'gorunur'; e.fazT = 2.2; e.atk = 0.4; olay(s, 'belir', { x: e.x, y: e.y }); }
          temasVar = false;
        } else if (e.faz === 'gorunur') {
          e.atk -= dt;
          if (e.atk <= 0) { e.atk = 0.8; for (const a of [-0.35, 0, 0.35]) dusmanAtis(s, e, e.ac + a, 5.4, 9); olay(s, 'cadiAtis', { x: e.x, y: e.y }); }
          if (e.fazT <= 0) { e.faz = 'hayalet'; e.fazT = 3; }
        }
        break;
      }
      case 'boss': bossAdim(s, e, dt, d, git); break;
    }
    if (temasVar && tn.temas > 0 && mesafe(e, p) < e.r + p.r && e.temasCd <= 0 && e.faz !== 'hayalet') {
      const guc = (e.faz === 'hamle' ? 1.6 : 1) * tn.temas;
      oyuncuHasar(s, Math.round(guc), 'temas'); e.temasCd = 0.9;
      if (e.etki === 'vampir') e.hp = Math.min(e.maxHp, e.hp + 15);
    }
  }
  function bossAdim(s, e, dt, d, git) {
    const tn = DUSMAN[e.tip], p = s.p;
    const oran = e.hp / e.maxHp;
    const faz2 = oran < 0.5, faz3 = oran < 0.25 && e.tip === 'erlik';
    const sinir = faz2 ? 4 : 3;
    const hiz = tn.hiz * (faz3 ? 1.3 : 1) * (s.muhur.kral ? 1.15 : 1);
    if (e.faz === 'bekle') {
      git(hiz, e.ac);
      if (e.fazT <= 0) {
        e.faz = 'hazir'; e.fazT = 0.7 - (faz2 ? 0.1 : 0); e.hedef = e.ac;
        e.saldiri = tn.saldiri[Math.floor(s.rnd() * sinir)];
        if (e.saldiri === 'hamle' || e.saldiri === 'zemin' || e.saldiri === 'tas') olay(s, 'uyari', { x: e.x, y: e.y });
      }
    } else if (e.faz === 'hazir') {
      if (e.saldiri === 'hamle') e.hedef = e.ac;
      if (e.fazT <= 0) {
        const kisa = s.muhur.kral ? 0.8 : 1;
        if (e.saldiri === 'halka') {
          const n = faz2 ? 18 : 12, off = s.rnd() * 6;
          for (let i = 0; i < n; i++) dusmanAtis(s, e, off + i * Math.PI * 2 / n, 4.2, 10, { boss: true });
          if (faz3) for (let i = 0; i < n; i++) dusmanAtis(s, e, off + 0.2 + i * Math.PI * 2 / n, 2.8, 10, { boss: true });
          olay(s, 'halka', { x: e.x, y: e.y }); e.faz = 'bekle'; e.fazT = 1.4 * kisa;
        } else if (e.saldiri === 'buz') {
          for (let i = -2; i <= 2; i++) dusmanAtis(s, e, e.ac + i * 0.22, 6.5, 9, { boss: true });
          olay(s, 'cadiAtis', { x: e.x, y: e.y }); e.faz = 'bekle'; e.fazT = 1.3 * kisa;
        } else if (e.saldiri === 'tas') {
          for (let i = -1; i <= 1; i++) dusmanAtis(s, e, e.ac + i * 0.35, 3.6, 14, { boss: true, r: 0.38, omur: 6 });
          olay(s, 'halka', { x: e.x, y: e.y }); e.faz = 'bekle'; e.fazT = 1.5 * kisa;
        } else if (e.saldiri === 'zemin') {
          for (let i = 0; i < 16; i++) dusmanAtis(s, e, i * Math.PI / 8, 3.8, 10, { boss: true, omur: 2 });
          for (let i = 0; i < 3; i++) tuzakKur(s, p.x + (s.rnd() - 0.5) * 4, p.y + (s.rnd() - 0.5) * 3, 1.1, 14, 1 + i * 0.25);
          olay(s, 'toz', { x: e.x, y: e.y }); e.faz = 'bekle'; e.fazT = 1.6 * kisa;
        } else if (e.saldiri === 'tuzak') {
          const n = faz2 ? 6 : 4;
          for (let i = 0; i < n; i++) tuzakKur(s, p.x + (i ? (s.rnd() - 0.5) * 6 : 0), p.y + (i ? (s.rnd() - 0.5) * 4 : 0), 1.15, 15, 0.8 + i * 0.18);
          e.faz = 'bekle'; e.fazT = 1.8 * kisa;
        } else if (e.saldiri === 'cagri') {
          const tipler = e.tip === 'hrolf' ? ['draugr', 'kurt'] : e.tip === 'tepegoz' ? ['kor', 'demirkurt'] : ['yilan', 'golge'];
          const n = faz2 ? 3 : 2;
          for (let i = 0; i < n; i++) { const nx = clamp(e.x + (i - 1) * 2.5, 2, 20), ny = clamp(e.y + 2, 2, 12); if (!carpisir(s, { r: 0.45 }, nx, ny)) dusmanOlustur(s, tipler[i % 2], nx, ny, { dogum: 0.8, hpK: 0.8 }); }
          olay(s, 'cagri', { x: e.x, y: e.y }); e.faz = 'bekle'; e.fazT = 2 * kisa;
        } else { e.faz = 'hamle'; e.fazT = 0.55; }
      }
    } else if (e.faz === 'hamle') {
      const v = 9.5 * (faz3 ? 1.2 : 1);
      const ox = e.x, oy = e.y;
      hareket(s, e, Math.cos(e.hedef) * v * dt, Math.sin(e.hedef) * v * dt);
      if (Math.hypot(e.x - ox, e.y - oy) < v * dt * 0.4) e.fazT = 0;
      if (e.fazT <= 0) { e.faz = 'bekle'; e.fazT = 1.2; olay(s, 'toz', { x: e.x, y: e.y }); }
    }
  }

  function secimYap(s, i) {
    if (!s.secim) return false;
    const o = s.secim.secenekler[i];
    if (!o) return false;
    const id = typeof o === 'string' ? o : o.id;
    armaganAl(s, id, typeof o === 'string' ? 0 : o.nadir); s.secim = null; olay(s, 'armagan', { id });
    return true;
  }

  return { W, H, T, KAPI_X, SON_DERINLIK, BIYOMLAR, ARMAGANLAR, NADIRLIK, MUHURLER, MIRAS, YETENEKLER, DUSMAN, ETKI, SABLON_ADLARI, KADROLAR, biyomOf, bolumOf, bossMu, mulberry, mirasBos, mirasYukle, mirasKaydet, mirasAl, odaUret, onizle, gunNo, gunlukKosu, gunlukKaydet, armaganAcik, ARMAGAN_SIRA, ESLESME, yeniKosu, adim, secimYap, armaganAl, ilerle, hucre, carpisir, savur, kozAt, atilim, dusmanHasar, dalgaBaslat, hasarCarpan, sivriDurum, ulasilir, KEY };
});
