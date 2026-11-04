// Köz Tapınağı: saf oyun mantığı (DOM yok, tohumlu). Tarayıcıda global TK, Node'da module.exports.
(function (root, fabrika) {
  if (typeof module === 'object' && module.exports) module.exports = fabrika();
  else root.TK = fabrika();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const W = 22, H = 14; // kenar duvarlar dahil; iç alan 20x12
  const T = { ZEMIN: 0, DUVAR: 1, UCURUM: 3, CATLAK: 4, SUTUN: 5, KAPI: 6, KAPIK: 7, GIZLIKAPI: 8, GERI: 9 };
  const KAPI_X = [6, 15];
  const SON_DERINLIK = 5; // 0 başlangıç ... 5 boss
  const KEY = 'koz-tapinagi-v1';

  const ARMAGANLAR = {
    keskin: { ad: 'Parlak Keskinlik', acik: 'Kılıç hasarı +%20', renk: '#ff7a5c', ic: 'K' },
    ruzgar: { ad: 'Rüzgâr Ayağı', acik: 'Hareket hızı +%12', renk: '#8de3ff', ic: 'R' },
    kalp: { ad: 'Köz Kalbi', acik: '+25 azami can ve iyileşme', renk: '#ff5d8f', ic: 'C' },
    bilek: { ad: 'Çevik Bilek', acik: 'Savurma %15 daha hızlı', renk: '#ffd86b', ic: 'B' },
    alev: { ad: 'Alev İzi', acik: 'Vuruşlar yakar (3 sn)', renk: '#ff9a3c', ic: 'A' },
    golge: { ad: 'Gölge Adımı', acik: 'Atılım değdiğine hasar verir', renk: '#b69cff', ic: 'G' },
    kivilcim: { ad: 'Kıvılcım', acik: 'Köz atışı +1 yük, delip geçer', renk: '#7fffd4', ic: 'V' },
    kan: { ad: 'Kül Emici', acik: 'Her öldürmede 2 can', renk: '#e07bff', ic: 'E' }
  };
  const MIRAS = {
    zirh: { ad: 'Sağlam Kemik', acik: '+10 azami can', maks: 5, maliyet: n => 30 + 25 * n },
    guc: { ad: 'Demir Bilek', acik: '+%8 hasar', maks: 5, maliyet: n => 40 + 30 * n },
    kul: { ad: 'Kül Hasadı', acik: '+%15 Kül kazancı', maks: 4, maliyet: n => 50 + 40 * n },
    koz: { ad: 'Çifte Köz', acik: '+1 köz yükü', maks: 2, maliyet: n => 80 + 80 * n },
    ilk: { ad: 'İlk Armağan', acik: 'Koşuya rastgele Armağanla başla', maks: 2, maliyet: n => 90 + 110 * n },
    sans: { ad: 'İkinci Şans', acik: 'Ölünce bir kez %40 canla dön', maks: 1, maliyet: () => 220 }
  };
  const YETENEKLER = {
    kirik: { ad: 'Kırıcı Rün', acik: 'Savurma çatlak duvarları kırar' },
    sicrama: { ad: 'Gölge Atılımı', acik: 'Atılım uçurumun üzerinden geçer' }
  };
  const DUSMAN = {
    hortlak: { ad: 'Hortlak', hp: 30, hiz: 2.6, r: 0.42, kul: 4, temas: 10 },
    cadi: { ad: 'Rün Cadısı', hp: 24, hiz: 1.9, r: 0.42, kul: 6, temas: 6 },
    muhafiz: { ad: 'Taş Muhafız', hp: 90, hiz: 1.6, r: 0.6, kul: 12, temas: 20 },
    jarl: { ad: 'Kül Jarlı', hp: 650, hiz: 1.7, r: 0.95, kul: 150, temas: 20 }
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

  // ---------- Miras (kalıcı ilerleme) ----------
  function mirasBos() {
    return { kul: 0, seviye: { zirh: 0, guc: 0, kul: 0, koz: 0, ilk: 0, sans: 0 }, yetenek: { kirik: false, sicrama: false }, kosu: 0, enIyi: 0, zafer: 0 };
  }
  function mirasYukle(depo) {
    const m = mirasBos();
    try {
      const o = JSON.parse(depo.getItem(KEY) || 'null');
      if (!o || typeof o !== 'object') return m;
      if (Number.isFinite(o.kul) && o.kul >= 0 && o.kul < 1e9) m.kul = Math.floor(o.kul);
      for (const k in m.seviye) { const v = o.seviye && o.seviye[k]; if (Number.isInteger(v) && v >= 0 && v <= MIRAS[k].maks) m.seviye[k] = v; }
      for (const k in m.yetenek) m.yetenek[k] = !!(o.yetenek && o.yetenek[k]);
      for (const k of ['kosu', 'enIyi', 'zafer']) if (Number.isInteger(o[k]) && o[k] >= 0 && o[k] < 1e6) m[k] = o[k];
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

  // ---------- Oda üretimi ----------
  function izgara() {
    const g = [];
    for (let y = 0; y < H; y++) {
      const s = [];
      for (let x = 0; x < W; x++) s.push(x === 0 || y === 0 || x === W - 1 || y === H - 1 ? T.DUVAR : T.ZEMIN);
      g.push(s);
    }
    return g;
  }
  function odaUret(seed, tur, derinlik, meta) {
    const r = mulberry(seed);
    const g = izgara();
    const oda = { seed, tur, derinlik, grid: g, temiz: false, odul: null, nesneler: [], dalgalar: [], dalga: 0, gizli: false, odulAlindi: false, kapiTur: [null, null] };
    if (tur === 'gizli') {
      g[H - 1][11] = T.GERI;
      oda.nesneler.push({ tur: 'sunak', alt: 'yetenek', x: 11, y: 6.5, aktif: true });
      oda.temiz = true;
      return oda;
    }
    // sütunlar
    const n = tur === 'boss' ? 4 : 3 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const x = 3 + Math.floor(r() * 10), y = 3 + Math.floor(r() * 7);
      if (Math.abs(x - 11) < 2 && y > 9) continue;
      if (y === 6 && x < 3) continue;
      g[y][x] = T.SUTUN;
    }
    // uçurum cebi + sandık (Gölge Atılımı gerekir)
    if (tur === 'savas' && derinlik >= 2 && r() < 0.45) {
      for (let y = 4; y <= 9; y++) { g[y][15] = T.UCURUM; g[y][16] = T.UCURUM; g[y][14] = T.ZEMIN; g[y][17] = T.ZEMIN; g[y][18] = T.ZEMIN; g[y][19] = T.ZEMIN; }
      oda.nesneler.push({ tur: 'sandik', x: 18.5, y: 6.5, aktif: true, kul: 35 + derinlik * 12 });
    }
    // çatlak duvar -> gizli oda (batı duvarı)
    if (tur === 'savas' && derinlik >= 1 && (derinlik === 2 || r() < 0.3)) {
      g[6][0] = T.CATLAK; oda.gizli = true;
    }
    if (tur === 'dinlenme') oda.nesneler.push({ tur: 'cesme', x: 11, y: 6.5, aktif: true });
    // kapılar
    if (derinlik < SON_DERINLIK) for (const x of KAPI_X) g[0][x] = T.KAPIK;
    if (tur === 'savas' || tur === 'boss') {
      const butce = tur === 'boss' ? 0 : 3 + derinlik * 1.6;
      if (tur === 'boss') oda.dalgalar.push([{ tip: 'jarl' }]);
      else {
        const dalgaSayi = derinlik >= 3 ? 3 : 2;
        for (let w = 0; w < dalgaSayi; w++) {
          const dalga = [];
          let b = butce / dalgaSayi;
          while (b > 0) {
            const x = r();
            const tip = x < 0.5 ? 'hortlak' : x < 0.8 ? 'cadi' : (derinlik >= 2 ? 'muhafiz' : 'hortlak');
            dalga.push({ tip }); b -= tip === 'muhafiz' ? 2.4 : tip === 'cadi' ? 1.3 : 1;
          }
          oda.dalgalar.push(dalga);
        }
      }
      oda.odul = tur === 'boss' ? 'yok' : (r() < 0.65 ? 'armagan' : 'kul');
    } else oda.temiz = true;
    return oda;
  }
  function kapiTurleri(rnd, derinlik) {
    // sonraki odanın türleri (iki kapı). Boss'tan önceki oda hep dinlenme/savaş karışımı.
    if (derinlik + 1 === SON_DERINLIK) return ['boss', 'boss'];
    const havuz = derinlik + 1 === SON_DERINLIK - 1 ? ['dinlenme', 'savas'] : ['savas', 'savas', 'dinlenme'];
    const a = havuz[Math.floor(rnd() * havuz.length)];
    let b = havuz[Math.floor(rnd() * havuz.length)];
    if (a === b && a === 'dinlenme') b = 'savas';
    return [a, b];
  }

  // ---------- Koşu ----------
  function yeniKosu(seed, meta) {
    const m = meta || mirasBos();
    const rnd = mulberry(seed ^ 0x9e3779b9);
    const s = {
      seed, rnd, meta: m, derinlik: 0, olaylar: [], zaman: 0, bitti: null, secim: null, kul: 0, oldurme: 0,
      armagan: {}, kullanilanSans: false, enemies: [], mermiler: [], yaygin: [], ustOda: null, gizliBulundu: false,
      p: null, oda: null, odaSayac: 0
    };
    const g = m.seviye;
    s.p = {
      x: 11, y: 11.4, r: 0.32, dir: -Math.PI / 2, hp: 100 + 10 * g.zirh, maxHp: 100 + 10 * g.zirh,
      swingT: 0, swingCd: 0, dashT: 0, dashCd: 0, dashX: 0, dashY: 0, inv: 0, kozYuk: 2 + g.koz, kozMaks: 2 + g.koz, kozSayac: 0, vuruldu: new Set(), swingId: 0, swingYon: 0
    };
    s.oda = odaUret(seed + 1, 'baslangic', 0, m);
    s.oda.kapiTur = kapiTurleri(rnd, 0);
    for (const x of KAPI_X) s.oda.grid[0][x] = T.KAPI;
    s.oda.temiz = true;
    for (let i = 0; i < g.ilk; i++) rastgeleArmagan(s);
    return s;
  }
  function rastgeleArmagan(s) {
    const idler = Object.keys(ARMAGANLAR).filter(k => (s.armagan[k] || 0) < 4);
    if (!idler.length) return;
    armaganAl(s, idler[Math.floor(s.rnd() * idler.length)]);
  }
  function armaganAl(s, id) {
    s.armagan[id] = (s.armagan[id] || 0) + 1;
    if (id === 'kalp') { s.p.maxHp += 25; s.p.hp = Math.min(s.p.maxHp, s.p.hp + 25); }
    if (id === 'kivilcim') { s.p.kozMaks += 1; s.p.kozYuk += 1; }
  }
  const hasarCarpan = s => (1 + 0.08 * s.meta.seviye.guc) * (1 + 0.2 * (s.armagan.keskin || 0));
  const hizCarpan = s => 1 + 0.12 * (s.armagan.ruzgar || 0);
  const swingCd = s => 0.4 * Math.pow(0.85, s.armagan.bilek || 0);
  const olay = (s, tip, o) => s.olaylar.push(Object.assign({ tip }, o || {}));

  // ---------- Çarpışma ----------
  function engelli(s, t, ent) {
    if (t === T.DUVAR || t === T.SUTUN || t === T.CATLAK || t === T.KAPIK) return true;
    if (t === T.UCURUM) return !(ent === s.p && s.p.dashT > 0 && s.meta.yetenek.sicrama);
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
    e.hp -= d; e.flas = 0.12;
    const kuvvet = e.tip === 'jarl' ? 0.6 : e.tip === 'muhafiz' ? 1.5 : 4;
    e.kx = Math.cos(aci) * kuvvet; e.ky = Math.sin(aci) * kuvvet;
    if (s.armagan.alev) e.yanik = 3;
    olay(s, 'vurus', { x: e.x, y: e.y, d });
    if (e.hp <= 0) oldur(s, e);
  }
  function oldur(s, e) {
    if (e.olu) return;
    e.olu = true; s.oldurme++;
    const kazan = Math.round(DUSMAN[e.tip].kul * (1 + 0.15 * s.meta.seviye.kul));
    s.kul += kazan;
    if (s.armagan.kan) s.p.hp = Math.min(s.p.maxHp, s.p.hp + 2 * s.armagan.kan);
    olay(s, 'oldu', { x: e.x, y: e.y, tip: e.tip, kul: kazan });
  }

  // ---------- Odaya girme / geçiş ----------
  function odayaGir(s, oda, giris) {
    s.oda = oda; s.enemies = []; s.mermiler = []; s.yaygin = [];
    s.p.x = giris.x; s.p.y = giris.y; s.p.dashT = 0; s.p.inv = 1;
    s.p.kozYuk = s.p.kozMaks;
    olay(s, 'oda', { tur: oda.tur });
    if (oda.tur === 'savas' || oda.tur === 'boss') { if (!oda.temiz) oda.dalga = 0; }
  }
  function sonrakiOda(s, kapi) {
    return odaUret(s.seed + 100 + (s.odaSayac + 1) * 7, s.oda.kapiTur[kapi] || 'savas', s.derinlik + 1, s.meta);
  }
  function onizle(s, kapi) { const o = sonrakiOda(s, kapi); return { tur: o.tur, odul: o.odul }; }
  function ilerle(s, kapi) {
    const oda = sonrakiOda(s, kapi);
    s.derinlik++;
    s.odaSayac++;
    oda.kapiTur = kapiTurleri(s.rnd, s.derinlik);
    odayaGir(s, oda, { x: 11, y: 12 });
  }
  function dalgaBaslat(s) {
    const o = s.oda;
    const dalga = o.dalgalar[o.dalga];
    if (!dalga) return;
    dalga.forEach((d, i) => {
      let x, y, deneme = 0;
      do { x = 2 + s.rnd() * 18; y = 1.8 + s.rnd() * 6; deneme++; }
      while ((carpisir(s, { r: 0.6 }, x, y) || mesafe({ x, y }, s.p) < 4) && deneme < 40);
      const tn = DUSMAN[d.tip];
      const sc = 1 + 0.12 * Math.max(0, o.derinlik - 1);
      s.enemies.push({ tip: d.tip, x, y, r: tn.r, hp: tn.hp * (d.tip === 'jarl' ? 1 : sc), maxHp: tn.hp * (d.tip === 'jarl' ? 1 : sc), dogum: 0.9 + i * 0.12, atk: 1 + s.rnd(), faz: 'bekle', fazT: 1, kx: 0, ky: 0, flas: 0, yanik: 0, olu: false, temasCd: 0, ac: 0 });
    });
    o.dalga++;
    olay(s, 'dalga', { n: o.dalga });
  }
  function temizlendi(s) {
    const o = s.oda;
    o.temiz = true;
    if (o.tur === 'boss') {
      s.meta.yetenek.kirik = true; s.meta.zafer++;
      bitir(s, 'zafer');
      return;
    }
    for (const x of KAPI_X) if (o.grid[0][x] === T.KAPIK) o.grid[0][x] = T.KAPI;
    if (o.odul === 'armagan') o.nesneler.push({ tur: 'sunak', alt: 'armagan', x: 11, y: 5.5, aktif: true });
    if (o.odul === 'kul') { const k = 25 + o.derinlik * 10; s.kul += k; olay(s, 'kul', { x: 11, y: 6, kul: k }); }
    olay(s, 'temiz');
  }
  function bitir(s, durum) {
    if (s.bitti) return;
    s.bitti = durum;
    const m = s.meta;
    const kazanc = s.kul + (durum === 'zafer' ? 60 : 0);
    s.kazanc = kazanc;
    m.kul += kazanc; m.kosu++; m.enIyi = Math.max(m.enIyi, s.derinlik);
    olay(s, durum);
  }

  // ---------- Saldırılar ----------
  function savur(s, aci) {
    const p = s.p;
    p.swingT = 0.2; p.swingCd = swingCd(s); p.swingYon = aci; p.swingId++; p.vuruldu = new Set();
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
    // mermileri sektir
    for (const m of s.mermiler) if (m.dusman && mesafe(m, p) < menzil) { m.dusman = false; m.vx = -m.vx * 1.4; m.vy = -m.vy * 1.4; m.hasar = 14 * hasarCarpan(s); olay(s, 'sekti', { x: m.x, y: m.y }); }
    // çatlak duvar
    if (s.meta.yetenek.kirik) {
      for (let a = -0.6; a <= 0.61; a += 0.3) {
        const tx = p.x + Math.cos(aci + a) * 1.5, ty = p.y + Math.sin(aci + a) * 1.5;
        const ix = Math.floor(tx), iy = Math.floor(ty);
        if (ix >= 0 && iy >= 0 && ix < W && iy < H && s.oda.grid[iy][ix] === T.CATLAK) {
          s.oda.grid[iy][ix] = T.GIZLIKAPI; olay(s, 'kirildi', { x: ix + 0.5, y: iy + 0.5 });
        }
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
    p.dashX = dx; p.dashY = dy; p.dashT = 0.18; p.dashCd = 0.7 * Math.pow(0.8, s.armagan.golge || 0); p.dashVuruldu = new Set();
    olay(s, 'atilim', { x: p.x, y: p.y });
  }
  function dusmanAtis(s, e, aci, hiz, hasar) {
    s.mermiler.push({ x: e.x, y: e.y, vx: Math.cos(aci) * hiz, vy: Math.sin(aci) * hiz, dost: false, dusman: true, hasar, r: 0.2, omur: 5, delme: 0, vuruldu: new Set() });
  }

  // ---------- Ana adım ----------
  function adim(s, girdi, dt) {
    if (s.bitti || s.secim) return;
    const p = s.p, o = s.oda;
    s.zaman += dt;
    // oyuncu zamanlayıcıları
    for (const k of ['swingT', 'swingCd', 'dashCd', 'inv']) p[k] = Math.max(0, p[k] - dt);
    if (p.kozYuk < p.kozMaks) { p.kozSayac += dt; if (p.kozSayac >= 2.6) { p.kozSayac = 0; p.kozYuk++; } } else p.kozSayac = 0;
    // hedef
    if (girdi.hx !== undefined) p.dir = Math.atan2(girdi.hy - p.y, girdi.hx - p.x);
    // hareket
    if (p.dashT > 0) {
      p.dashT -= dt;
      const v = 14.5 * dt;
      hareket(s, p, p.dashX * v, p.dashY * v);
      if (p.dashT <= 0 && hucre(s, p.x, p.y) === T.UCURUM) p.dashT = 0.04; // uçurumda bitirme
      if (s.armagan.golge) for (const e of s.enemies) if (!e.olu && e.dogum <= 0 && !p.dashVuruldu.has(e) && mesafe(e, p) < e.r + 0.7) { p.dashVuruldu.add(e); dusmanHasar(s, e, 15 * hasarCarpan(s) * s.armagan.golge, Math.atan2(p.dashY, p.dashX)); }
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
    // dalga mantığı
    if ((o.tur === 'savas' || o.tur === 'boss') && !o.temiz) {
      const canli = s.enemies.filter(e => !e.olu).length;
      if (canli === 0 && o.dalga < o.dalgalar.length) dalgaBaslat(s);
      else if (canli === 0 && o.dalga >= o.dalgalar.length) temizlendi(s);
    }
    // düşmanlar
    for (const e of s.enemies) if (!e.olu) dusmanAdim(s, e, dt);
    s.enemies = s.enemies.filter(e => !e.olu);
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
    // nesneler
    for (const n of o.nesneler) {
      if (!n.aktif || mesafe(n, p) > 0.9) continue;
      if (n.tur === 'sandik') { n.aktif = false; s.kul += n.kul; olay(s, 'kul', { x: n.x, y: n.y, kul: n.kul }); }
      if (n.tur === 'cesme') { n.aktif = false; p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * 0.4)); olay(s, 'iyiles', { x: n.x, y: n.y }); }
      if (n.tur === 'sunak' && n.alt === 'armagan') {
        n.aktif = false;
        const idler = Object.keys(ARMAGANLAR).filter(k => (s.armagan[k] || 0) < 4);
        for (let i = idler.length - 1; i > 0; i--) { const j = Math.floor(s.rnd() * (i + 1)); [idler[i], idler[j]] = [idler[j], idler[i]]; }
        s.secim = { tur: 'armagan', secenekler: idler.slice(0, 3) };
      }
      if (n.tur === 'sunak' && n.alt === 'yetenek') {
        n.aktif = false;
        if (!s.meta.yetenek.sicrama) { s.meta.yetenek.sicrama = true; olay(s, 'yetenek', { id: 'sicrama' }); }
        else { s.kul += 80; olay(s, 'kul', { x: n.x, y: n.y, kul: 80 }); }
      }
    }
    // kapılar ve geçişler
    if (o.temiz && p.y < 1.05 && o.tur !== 'gizli') {
      for (let i = 0; i < 2; i++) if (o.grid[0][KAPI_X[i]] === T.KAPI && Math.abs(p.x - (KAPI_X[i] + 0.5)) < 0.9) { ilerle(s, i); return; }
    }
    if (p.x < 0.9 && Math.abs(p.y - 6.5) < 0.9 && o.grid[6][0] === T.GIZLIKAPI) {
      const gz = odaUret(s.seed + 5000 + s.derinlik, 'gizli', s.derinlik, s.meta);
      s.ustOda = o; s.gizliBulundu = true;
      odayaGir(s, gz, { x: 11, y: 12 });
      return;
    }
    if (o.tur === 'gizli' && p.y > H - 1.1 && Math.abs(p.x - 11.5) < 1) {
      const ust = s.ustOda; s.ustOda = null;
      odayaGir(s, ust, { x: 1.8, y: 6.5 });
    }
    // yaygın etkiler (görsel olay ömrü)
  }
  function dusmanAdim(s, e, dt) {
    const p = s.p, tn = DUSMAN[e.tip];
    e.flas = Math.max(0, e.flas - dt);
    if (e.dogum > 0) { e.dogum -= dt; return; }
    if (e.yanik > 0) { e.yanik -= dt; e.hp -= 5 * dt; if (e.hp <= 0) { oldur(s, e); return; } }
    if (Math.abs(e.kx) + Math.abs(e.ky) > 0.05) { hareket(s, e, e.kx * dt, e.ky * dt); e.kx *= Math.pow(0.001, dt); e.ky *= Math.pow(0.001, dt); }
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.ac = Math.atan2(dy, dx);
    e.temasCd = Math.max(0, e.temasCd - dt);
    const git = (hiz, yon) => hareket(s, e, Math.cos(yon) * hiz * dt, Math.sin(yon) * hiz * dt);
    if (e.tip === 'hortlak') {
      git(tn.hiz * (1 + 0.04 * s.oda.derinlik), e.ac);
    } else if (e.tip === 'cadi') {
      if (d > 5.5) git(tn.hiz, e.ac); else if (d < 3.5) git(tn.hiz, e.ac + Math.PI);
      else git(tn.hiz * 0.5, e.ac + Math.PI / 2);
      e.atk -= dt;
      if (e.atk <= 0) { e.atk = 1.9; dusmanAtis(s, e, e.ac, 5.2, 10); olay(s, 'cadiAtis', { x: e.x, y: e.y }); }
    } else if (e.tip === 'muhafiz' || e.tip === 'jarl') {
      e.fazT -= dt;
      if (e.faz === 'bekle') {
        git(tn.hiz, e.ac);
        if (e.fazT <= 0) { e.faz = 'hazir'; e.fazT = e.tip === 'jarl' ? 0.7 : 0.75; e.hedef = e.ac; if (e.tip === 'jarl') e.saldiri = ['halka', 'hamle', 'hamle', 'cagri'][Math.floor(s.rnd() * (e.hp < e.maxHp / 2 ? 4 : 3))]; else e.saldiri = 'hamle'; if (e.saldiri === 'hamle') olay(s, 'uyari', { x: e.x, y: e.y }); }
      } else if (e.faz === 'hazir') {
        if (e.saldiri === 'hamle') e.hedef = e.ac;
        if (e.fazT <= 0) {
          if (e.saldiri === 'halka') {
            const n = e.hp < e.maxHp / 2 ? 18 : 12, off = s.rnd() * 6;
            for (let i = 0; i < n; i++) dusmanAtis(s, e, off + i * Math.PI * 2 / n, 4.2, 10);
            olay(s, 'halka', { x: e.x, y: e.y }); e.faz = 'bekle'; e.fazT = 1.4;
          } else if (e.saldiri === 'cagri') {
            for (let i = 0; i < 2; i++) { const nx = clamp(e.x + (i ? 2.5 : -2.5), 2, 20), ny = clamp(e.y + 2, 2, 12); if (!carpisir(s, { r: 0.45 }, nx, ny)) s.enemies.push({ tip: 'hortlak', x: nx, y: ny, r: 0.42, hp: 30, maxHp: 30, dogum: 0.8, atk: 1, faz: 'bekle', fazT: 1, kx: 0, ky: 0, flas: 0, yanik: 0, olu: false, temasCd: 0, ac: 0 }); }
            olay(s, 'cagri', { x: e.x, y: e.y }); e.faz = 'bekle'; e.fazT = 1.6;
          } else { e.faz = 'hamle'; e.fazT = e.tip === 'jarl' ? 0.55 : 0.5; }
        }
      } else if (e.faz === 'hamle') {
        const v = (e.tip === 'jarl' ? 9.5 : 8.5);
        const ox = e.x, oy = e.y;
        hareket(s, e, Math.cos(e.hedef) * v * dt, Math.sin(e.hedef) * v * dt);
        if (Math.hypot(e.x - ox, e.y - oy) < v * dt * 0.4) e.fazT = 0;
        if (e.fazT <= 0) { e.faz = 'bekle'; e.fazT = e.tip === 'jarl' ? 1.2 : 1.8; olay(s, 'toz', { x: e.x, y: e.y }); }
      }
    }
    if (mesafe(e, p) < e.r + p.r && e.temasCd <= 0 && !(e.tip === 'cadi' && false)) {
      const guc = (e.faz === 'hamle' ? 1.6 : 1) * tn.temas;
      oyuncuHasar(s, Math.round(guc), 'temas'); e.temasCd = 0.9;
    }
  }

  function secimYap(s, i) {
    if (!s.secim) return false;
    const id = s.secim.secenekler[i];
    if (!id) return false;
    armaganAl(s, id); s.secim = null; olay(s, 'armagan', { id });
    return true;
  }

  return { W, H, T, KAPI_X, SON_DERINLIK, ARMAGANLAR, MIRAS, YETENEKLER, DUSMAN, mulberry, mirasBos, mirasYukle, mirasKaydet, mirasAl, odaUret, onizle, yeniKosu, adim, secimYap, armaganAl, ilerle, hucre, carpisir, savur, kozAt, atilim, dusmanHasar, dalgaBaslat, hasarCarpan, KEY };
});
