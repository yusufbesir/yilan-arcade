// Emberwake: piksel art 2.5D çizim. Sahne 480x310 düşük çözünürlüklü tuvale çizilir, ardından en yakın komşu ile 2x büyütülür.
// Tüm dokular ve sprite'lar kodla üretilir (dış varlık yok). Arayüz metinleri tam çözünürlükte çizilir.
const Ciz = (() => {
  'use strict';
  const { W, H, T } = TK;
  const LW = 480, LH = 310, CW = 960, CH = 620;
  const TW = 21, TH = 14, OX = 9, OY = 59, DH = 17;
  const sx = x => Math.round(OX + x * TW), sy = y => Math.round(OY + y * TH);
  const dunya = (px, py) => ({ x: (px / 2 - OX) / TW, y: (py / 2 - OY) / TH });
  const lo = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (lo) { lo.width = LW; lo.height = LH; }
  const lc = lo ? lo.getContext('2d') : null;

  // ---------- renk yardımcıları ----------
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const css = (r, g, b) => 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]; };
  const kar = (rgb, k) => [Math.min(255, rgb[0] * k), Math.min(255, rgb[1] * k), Math.min(255, rgb[2] * k)];
  function hash(x, y, z) { let h = (x * 374761393 + y * 668265263 + (z || 0) * 2147483647) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  // ---------- biyom paletleri (bölüm ilerledikçe 'derin' renge kayar) ----------
  const PAL = [
    { z0: '#5b6a86', z1: '#7d8fae', d0: '#6c7b99', d1: '#8aa0c0', derin: '#1a2a52', isik: '#8de3ff', sis: '#0a1226', vurgu: '#e8f6ff' },  // Niflheim: buz mavisi
    { z0: '#6e4a3a', z1: '#8c5c44', d0: '#7a5a48', d1: '#9a7058', derin: '#3a0d08', isik: '#ff8a3c', sis: '#200a06', vurgu: '#ffcf7a' },  // Demir Dağ: kor
    { z0: '#4d3f6e', z1: '#654f8c', d0: '#5a4a7a', d1: '#74609a', derin: '#10281a', isik: '#b38bff', sis: '#120a22', vurgu: '#9dffb0' }   // Tamu: mor/yosun
  ];
  const cache = {};
  function yap(bi, bolum) {
    const key = bi + ':' + bolum;
    if (cache[key]) return cache[key];
    const P = PAL[bi], t = bolum / 3 * 0.55;
    const z0 = mix(css(...hex(P.z0)).replace(/.*/, ''), P.derin, 0) && null;
    const col = h => { const m = mix(h, P.derin, t); return m; };
    const Z0 = col(P.z0), Z1 = col(P.z1), D0 = col(P.d0), D1 = col(P.d1);
    void z0;
    const yeni = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const zemin = [];
    for (let v = 0; v < 4; v++) {
      const c = yeni(TW, TH), g = c.getContext('2d'), im = g.createImageData(TW, TH);
      for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
        const n = hash(x, y, v * 7 + bi * 31 + bolum);
        let k = 0.95 + n * 0.1;
        if (y === 0 || x === 0) k *= 1.14; else if (y === TH - 1 || x === TW - 1) k *= 0.78;
        const m = [Z0[0] + (Z1[0] - Z0[0]) * n, Z0[1] + (Z1[1] - Z0[1]) * n, Z0[2] + (Z1[2] - Z0[2]) * n];
        const o = (y * TW + x) * 4; im.data[o] = Math.min(255, m[0] * k); im.data[o + 1] = Math.min(255, m[1] * k); im.data[o + 2] = Math.min(255, m[2] * k); im.data[o + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      // biyoma özgü süs
      const r = (i) => hash(v, i, bi * 5 + bolum);
      if (v === 1 || v === 3) { // çatlak
        g.fillStyle = css(...kar(Z0, 0.55)); let x = 3 + (r(1) * 8 | 0), y = 2;
        for (let i = 0; i < 9; i++) { g.fillRect(x, y, 1, 1); x += r(i + 5) < 0.5 ? 1 : 0; y += 1; if (y >= TH - 1) break; if (r(i + 9) < 0.3) x += 1; }
        if (bi === 1) { g.fillStyle = '#ff8a3c'; g.fillRect(x - 1, y - 2, 1, 1); g.fillRect(x - 2, y - 4, 1, 1); }
      }
      if (v === 2) {
        if (bi === 0) { g.fillStyle = 'rgba(235,248,255,.55)'; for (let i = 0; i < 6; i++) g.fillRect((r(i) * (TW - 2) | 0) + 1, (r(i + 20) * (TH - 2) | 0) + 1, 1, 1); }
        if (bi === 1) { g.fillStyle = 'rgba(30,10,6,.5)'; g.fillRect(4, 4, 5, 3); g.fillStyle = 'rgba(255,160,80,.5)'; g.fillRect(5, 4, 3, 1); }
        if (bi === 2) { g.fillStyle = 'rgba(140,255,170,.5)'; for (let i = 0; i < 5; i++) g.fillRect((r(i) * (TW - 3) | 0) + 1, (r(i + 20) * (TH - 3) | 0) + 1, 2, 1); g.fillStyle = 'rgba(20,50,30,.5)'; g.fillRect(6, 7, 6, 2); }
      }
      if (bolum >= 2 && v === 0) { g.fillStyle = css(...kar(Z0, 0.5)); g.fillRect(8, 5, 4, 1); g.fillRect(7, 6, 1, 1); g.fillRect(12, 6, 1, 1); }
      zemin.push(c);
    }
    const duvarOn = yeni(TW, DH), g2 = duvarOn.getContext('2d');
    for (let y = 0; y < DH; y++) for (let x = 0; x < TW; x++) {
      const satir = (y / 4) | 0, ofs = satir % 2 ? 5 : 0, derz = (y % 4 === 3) || ((x + ofs) % 10 === 0);
      const n = hash(x, y, 77 + bi);
      const m = derz ? kar(D0, 0.5) : kar(D0, 0.7 + n * 0.14);
      g2.fillStyle = css(...m); g2.fillRect(x, y, 1, 1);
    }
    if (bi === 0) { g2.fillStyle = '#e8f6ff'; for (let x = 1; x < TW; x += 3) { const l = 2 + (hash(x, 1, 3) * 4 | 0); g2.fillRect(x, 0, 1, l); } }
    if (bi === 1) { g2.fillStyle = '#c9923a'; g2.fillRect(2, 5, 1, 1); g2.fillRect(18, 5, 1, 1); g2.fillRect(2, 12, 1, 1); g2.fillRect(18, 12, 1, 1); g2.fillStyle = '#ff8a3c'; g2.fillRect(9, 6, 3, 1); }
    if (bi === 2) { g2.fillStyle = '#2f7a4a'; for (let x = 2; x < TW; x += 4) { const l = 3 + (hash(x, 2, 9) * 7 | 0); g2.fillRect(x, 0, 1, l); } }
    const duvarUst = yeni(TW, TH), g3 = duvarUst.getContext('2d'), im3 = g3.createImageData(TW, TH);
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const n = hash(x, y, 55 + bi), k = (y === 0 || x === 0 ? 1.3 : (y === TH - 1 || x === TW - 1) ? 0.85 : 1) * (0.95 + n * 0.12);
      const o = (y * TW + x) * 4; im3.data[o] = Math.min(255, D1[0] * k); im3.data[o + 1] = Math.min(255, D1[1] * k); im3.data[o + 2] = Math.min(255, D1[2] * k); im3.data[o + 3] = 255;
    }
    g3.putImageData(im3, 0, 0);
    return (cache[key] = { zemin, duvarOn, duvarUst, P, D0 });
  }

  // ---------- sprite sistemi ----------
  function spr(c, d, x, y, ters, alfa, flas) {
    const rows = d.rows, w = d.w, h = rows.length, k = d.k || 1;
    const ox = Math.round(x - w * k / 2), oy = Math.round(y - h * k);
    if (alfa !== undefined) c.globalAlpha = alfa;
    const piksel = (i, j) => {
      const row = rows[j];
      let ch;
      if (d.sym) { const hw = row.length; ch = i < hw ? row[i] : row[w - 1 - i]; } else ch = row[i];
      return ch && ch !== '.' && ch !== ' ' ? ch : null;
    };
    const xx = i => (ters && !d.sym ? w - 1 - i : i) * k;
    // 1 piksellik koyu kontur
    c.fillStyle = '#0a0612';
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!piksel(i, j)) continue;
      if (!(i > 0 && piksel(i - 1, j))) c.fillRect(ox + xx(i) - 1, oy + j * k, 1, k);
      if (!(i < w - 1 && piksel(i + 1, j))) c.fillRect(ox + xx(i) + k, oy + j * k, 1, k);
      if (!(j > 0 && piksel(i, j - 1))) c.fillRect(ox + xx(i), oy + j * k - 1, k, 1);
      if (!(j < h - 1 && piksel(i, j + 1))) c.fillRect(ox + xx(i), oy + (j + 1) * k, k, 1);
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const ch = piksel(i, j);
      if (!ch) continue;
      const col = flas ? '#fff' : d.pal[ch];
      if (!col) continue;
      c.fillStyle = col; c.fillRect(ox + xx(i), oy + j * k, k, k);
    }
    if (alfa !== undefined) c.globalAlpha = 1;
  }
  const INSAN = ['..hhhh', '.hhhhh', '.hhfff', '.hfEff', '.hfffm', '..hfff', '.aaaaa', 'aaccaa', 'aaccaa', 'aaaaaa', '.aaaaa', '..aabb', '..bbbb', '..bbb.'];
  const DEV = ['....hhhhhh', '..hhhhhhhh', '.hhhhhhhhh', '.hhfffffff', '.hfffEEfff', '.hffffffff', '..hffmmmmm', '...hhhhhhh', '..aaaaaaaa', '.aaaccaaaa', 'aaaaccaaaa', 'aaaaaaaaaa', 'aaabbbaaaa', 'aaaaaaaaaa', 'aaaaaaaaaa', '.aaaaaaaaa', '.aaaaaaaaa', '..aaaaaaa.', '..aaaaaaa.', '..bbbbbbb.', '..bbbbbbb.', '..bbbbbb..'];
  const SPR = {
    koz: { sym: true, w: 12, rows: ['....hh', '..hhhh', '.hhhhh', '.hddde', '.hdeee', '.hddde', '..hhch', '.cccct', '.cccct', 'ccccct', 'ccccct', 'cccccc', 'bbcbbc', '.bb.bb'].map(r => r.replace(/e/g, 'E')), pal: { h: '#2e6f80', d: '#06161a', E: '#ffd27a', c: '#2a5f70', t: '#4a93a8', b: '#10303a' } },
    draugr: { sym: true, w: 12, rows: INSAN, pal: { h: '#7b8b97', f: '#b9c9bd', E: '#7dffb0', m: '#5a6a62', a: '#43586a', c: '#9cb2c0', b: '#242c34' } },
    seidr: { sym: true, w: 12, rows: INSAN, pal: { h: '#6b3f9a', f: '#2a1838', E: '#e07bff', m: '#2a1838', a: '#54307a', c: '#8a5ac0', b: '#2b1a3d' }, acc: 'asa' },
    albasti: { sym: true, w: 12, rows: INSAN, pal: { h: '#b02a2a', f: '#e8c8b0', E: '#ffdd55', m: '#8a1a1a', a: '#6a1a2a', c: '#a02a3a', b: '#2a0a12' }, acc: 'pence' },
    golge: { sym: true, w: 12, rows: INSAN, pal: { h: '#4a3a7a', f: '#2a2050', E: '#ffffff', m: '#2a2050', a: '#5b4a8a', c: '#7a68b0', b: '#352a5a' }, alfa: 0.72 },
    demirci: { sym: true, w: 12, rows: INSAN, pal: { h: '#8a6a4a', f: '#c89a7a', E: '#222222', m: '#7a4a3a', a: '#6a6a78', c: '#9a9aaa', b: '#3a2a22' }, acc: 'kalkan' },
    buzdev: { sym: true, w: 20, rows: DEV, pal: { h: '#bfe3f2', f: '#8fb8d0', E: '#2a6a9a', m: '#4a7a98', a: '#6fa3c8', c: '#a7d2ea', b: '#3a6a8a' } },
    hrolf: { sym: true, k: 2, w: 20, rows: DEV, pal: { h: '#8a98a6', f: '#b9c9bd', E: '#7dffb0', m: '#4a5a52', a: '#3c5266', c: '#7f98ae', b: '#1e2a36' }, acc: 'tac' },
    tepegoz: { sym: true, k: 2, w: 20, rows: DEV, pal: { h: '#6a4a38', f: '#c8946a', E: '#ffdd55', m: '#5a2a1a', a: '#7a3a22', c: '#b86a3a', b: '#2a1208' }, acc: 'goz' },
    erlik: { sym: true, k: 2, w: 20, rows: DEV, pal: { h: '#2a1038', f: '#3a1a48', E: '#ff3b3b', m: '#1a0828', a: '#3a1448', c: '#6a2a7a', b: '#12061c' }, acc: 'boynuz' },
    kurt: { sym: false, w: 14, rows: ['..........ww..', '.........wwww.', '..w.....wwEwww', '.wwwwwwwwwwwnn', 'wwwwwwwwwwwwwn', 'wwwwwwwwwwwww.', '.wwwwwwwwwww..', '.ww.ww...ww.ww', '.ww.ww...ww.ww', '.dd.dd...dd.dd'], pal: { w: '#8a92a6', d: '#33384a', E: '#ff5d4a', n: '#1a1a22' } },
    demirkurt: { sym: false, w: 16, rows: ['...........mm...', '..........mmmm..', '.m.......mmwEww.', '.mmm.mmmmmwwwwnn', 'mmmmmmmmmmmwwwwn', 'wwwwwwwwwwwwwww.', '.wwwwwwwwwwwww..', '.ww..ww.....ww.w', '.ww..ww.....ww.w', '.dd..dd.....dd.d'], pal: { w: '#6a4a3a', m: '#c9923a', d: '#2a1a14', E: '#ffdd55', n: '#1a1a22' } },
    kargaci: { sym: false, w: 14, rows: ['..............', '.k..........k.', '.kk........kk.', '..kkk.kk.kkk..', '...kkkkkkkk...', '....kkkkkkE.n.', '.....kkkkkkn..', '.....k..k.....'], pal: { k: '#1c1a2a', E: '#ff5d4a', n: '#d9a63a' } },
    kor: { sym: true, w: 10, rows: ['...oo', '..ooo', '.ooyy', '.oyyy', 'ooyEy', 'ooyyy', '.ooyy', '..ooo', '..b.b'].map(r => r), pal: { o: '#ff6a2a', y: '#ffc04a', E: '#2a0a04', b: '#7a2a10' } },
    yilan: { sym: false, w: 14, rows: ['...........ss.', '..........ssEs', '.........ssss.', '..sss..sss....', '.sGGGsssG.....', 'sGGGGGGGG.....', '.sssssss......'], pal: { s: '#3a8a4a', G: '#5ac870', E: '#ff3b3b' } },
    kok: { sym: true, w: 12, rows: ['....rr', '..r.rr', '.rrrrR', 'rrRrRR', '.rrRRR', 'rrRRRE', '.rrRRR', 'rrrRRR', '.rrrrR', 'rrrrrr'], pal: { r: '#4a3a22', R: '#6a5a32', E: '#b38bff' } }
  };
  function sprAcc(c, ad, x, y, ters, zaman, kimlik) {
    const sg = ters ? -1 : 1;
    if (kimlik === 'asa') { c.fillStyle = '#7a5a3a'; c.fillRect(x + 7 * sg - 1, y - 16, 1, 15); c.fillStyle = '#e07bff'; c.fillRect(x + 6 * sg - 1, y - 18, 3, 3); }
    if (kimlik === 'pence') { c.fillStyle = '#e8c8b0'; c.fillRect(x - 8, y - 8, 2, 5); c.fillRect(x + 6, y - 8, 2, 5); c.fillStyle = '#ffdd55'; c.fillRect(x - 8, y - 4, 1, 2); c.fillRect(x + 7, y - 4, 1, 2); }
    if (kimlik === 'kalkan') { c.fillStyle = '#8a6a3a'; c.fillRect(x - 11, y - 11, 6, 9); c.fillStyle = '#c9923a'; c.fillRect(x - 10, y - 10, 4, 7); c.fillStyle = '#6a6a78'; c.fillRect(x + 6, y - 14, 1, 10); c.fillRect(x + 4, y - 15, 5, 3); }
    if (kimlik === 'tac') { c.fillStyle = '#c9b9a0'; for (const k of [-1, 1]) { c.fillRect(x + k * 12 - 1, y - 52, 2, 12); c.fillRect(x + k * 16 - 1, y - 58, 2, 8); c.fillRect(x + k * 20 - 1, y - 62, 2, 6); c.fillRect(x + k * 8 - 1, y - 48, 2, 6); } c.fillStyle = '#7fffd4'; c.fillRect(x - 8, y - 44, 16, 3); }
    if (kimlik === 'goz') { c.fillStyle = '#f4ecd0'; c.fillRect(x - 11, y - 38, 22, 11); c.fillStyle = '#ffdd55'; c.fillRect(x - 5, y - 36, 10, 7); c.fillStyle = '#7a1a1a'; c.fillRect(x - 2, y - 34, 4, 3); c.fillStyle = '#ffffff'; c.fillRect(x - 4, y - 36, 2, 2); }
    if (kimlik === 'boynuz') { c.fillStyle = '#9a9aaa'; for (const k of [-1, 1]) { c.fillRect(x + k * 10 - 1, y - 52, 3, 10); c.fillRect(x + k * 14 - 1, y - 60, 3, 10); c.fillRect(x + k * 18 - 1, y - 66, 3, 8); } c.fillStyle = '#ff3b3b'; c.fillRect(x - 3, y - 52, 6, 4); }
    void ad; void zaman;
  }

  // ---------- durum ----------
  const parcacik = [], yazilar = [], kesikler = [];
  let titresim = 0, sure = 0, afis = null, afisT = 0;
  function p(x, y, renk, omur, hiz, yukari) {
    const a = Math.random() * 6.283, v = Math.random() * hiz;
    parcacik.push({ x, y, z: 0.3 + Math.random() * 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, vz: yukari === undefined ? 2 + Math.random() * 3 : -yukari, t: omur * (0.6 + Math.random() * 0.6), m: omur, renk });
  }
  function olaylariIsle(s) {
    for (const o of s.olaylar) {
      if (o.tip === 'vurus') { for (let i = 0; i < 7; i++) p(o.x, o.y, '#ffe9a8', 0.35, 5); yazilar.push({ x: o.x, y: o.y, t: 0.7, m: String(Math.round(o.d)), r: '#fff2c0' }); titresim = Math.max(titresim, 2); }
      if (o.tip === 'oldu') { for (let i = 0; i < 22; i++) p(o.x, o.y, i % 2 ? '#ff9a3c' : '#e9d8ff', 0.8, 6); titresim = Math.max(titresim, 5); }
      if (o.tip === 'hasar') { for (let i = 0; i < 14; i++) p(o.x, o.y, '#ff4a5f', 0.6, 5); titresim = Math.max(titresim, 8); yazilar.push({ x: o.x, y: o.y - 0.5, t: 0.9, m: '-' + o.d, r: '#ff6b7c' }); }
      if (o.tip === 'savur') kesikler.push({ x: o.x, y: o.y, aci: o.aci, t: 0.2 });
      if (o.tip === 'atilim') for (let i = 0; i < 14; i++) p(o.x, o.y, '#b7e6ff', 0.4, 3);
      if (o.tip === 'kirildi') { for (let i = 0; i < 24; i++) p(o.x, o.y, '#c9b9a0', 0.9, 6); titresim = 9; }
      if (o.tip === 'halka' || o.tip === 'toz' || o.tip === 'patla') { for (let i = 0; i < 20; i++) p(o.x, o.y, o.tip === 'patla' ? '#ffb35a' : '#ffb0a0', 0.7, 5); titresim = Math.max(titresim, 6); }
      if (o.tip === 'koz') for (let i = 0; i < 6; i++) p(o.x, o.y, '#ffcf7a', 0.3, 2);
      if (o.tip === 'carp' || o.tip === 'sekti') for (let i = 0; i < 6; i++) p(o.x, o.y, '#ffd9a0', 0.3, 3);
      if (o.tip === 'iyiles' || o.tip === 'yedi' || o.tip === 'satin') for (let i = 0; i < 20; i++) p(o.x, o.y, '#7dffb0', 1.0, 2, -2);
      if (o.tip === 'kul') yazilar.push({ x: o.x, y: o.y - 0.4, t: 1.1, m: '+' + o.kul + ' Kül', r: '#ffd86b' });
      if (o.tip === 'yetmez') yazilar.push({ x: o.x, y: o.y - 0.8, t: 1.0, m: 'Kül yetmiyor', r: '#ff9a7a' });
      if (o.tip === 'blok') { for (let i = 0; i < 6; i++) p(o.x, o.y, '#d9e6ff', 0.3, 3); yazilar.push({ x: o.x, y: o.y, t: 0.5, m: 'BLOK', r: '#d9e6ff' }); }
      if (o.tip === 'kaybol' || o.tip === 'belir') for (let i = 0; i < 12; i++) p(o.x, o.y, '#b69cff', 0.5, 3);
      if (o.tip === 'uluma') yazilar.push({ x: o.x, y: o.y - 0.8, t: 1, m: 'ULUMA!', r: '#ffb35a' });
      if (o.tip === 'lanet') { for (let i = 0; i < 20; i++) p(o.x, o.y, '#c04aff', 0.9, 4); titresim = 6; }
      if (o.tip === 'oda') { const bi = TK.BIYOMLAR[o.biyom]; if (bi && o.tur !== 'gizli') { afis = [bi.ad, bi.bolum[o.bolum] + (o.tur === 'elit' ? ' · ELİT' : o.tur === 'pazar' ? ' · PAZAR' : o.tur === 'dinlenme' ? ' · DİNLENME' : '')]; afisT = 3; } }
    }
    s.olaylar.length = 0;
  }
  function guncelle(dt) {
    sure += dt; afisT = Math.max(0, afisT - dt);
    titresim = Math.max(0, titresim - dt * 30);
    for (const q of parcacik) { q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vz -= 9 * dt; q.z = Math.max(0, q.z + q.vz * dt * 0.3); q.vx *= 0.97; q.vy *= 0.97; }
    for (let i = parcacik.length - 1; i >= 0; i--) if (parcacik[i].t <= 0) parcacik.splice(i, 1);
    for (const y of yazilar) { y.t -= dt; y.y -= dt * 0.8; }
    for (let i = yazilar.length - 1; i >= 0; i--) if (yazilar[i].t <= 0) yazilar.splice(i, 1);
    for (const k of kesikler) k.t -= dt;
    for (let i = kesikler.length - 1; i >= 0; i--) if (kesikler[i].t <= 0) kesikler.splice(i, 1);
    if (parcacik.length > 400) parcacik.splice(0, parcacik.length - 400);
  }
  function r(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); }
  function gol(c, x, y, rx, a) { c.fillStyle = 'rgba(0,0,0,' + (a || 0.35) + ')'; c.fillRect(Math.round(x - rx), Math.round(y), rx * 2, 2); c.fillRect(Math.round(x - rx + 1), Math.round(y - 1), rx * 2 - 2, 1); c.fillRect(Math.round(x - rx + 1), Math.round(y + 2), rx * 2 - 2, 1); }

  // ---------- sahne ----------
  function zeminCiz(c, s, tx) {
    const g = s.oda.grid;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const t = g[y][x], px = sx(x), py = sy(y);
      if (t === T.UCURUM) {
        c.fillStyle = '#04030a'; c.fillRect(px, py, TW, TH);
        c.fillStyle = '#0d0b22'; c.fillRect(px, py + TH - 4, TW, 4); c.fillStyle = '#17143a'; c.fillRect(px, py + TH - 2, TW, 2);
        if (g[y - 1][x] !== T.UCURUM) { c.fillStyle = '#000'; c.fillRect(px, py, TW, 3); }
        for (let i = 0; i < 3; i++) if (hash(x, y, i) < 0.5) { c.fillStyle = '#241f55'; c.fillRect(px + 3 + ((hash(x, y, i + 9) * 14) | 0), py + 4 + i * 3, 2, 1); }
        continue;
      }
      c.drawImage(tx.zemin[(hash(x, y, 3) * 4) | 0], px, py);
      if (t === T.LAV) {
        const f = ((sure * 3 + x * 0.7 + y * 0.3) | 0) % 4;
        c.fillStyle = '#7a1a06'; c.fillRect(px, py, TW, TH);
        c.fillStyle = '#d9440f'; c.fillRect(px + 1, py + 1, TW - 2, TH - 2);
        c.fillStyle = '#ff8a2a';
        for (let i = 0; i < 5; i++) c.fillRect(px + 2 + ((hash(x, y, i) * 14) | 0), py + 2 + ((hash(x, y, i + 5) * 8) | 0) + (f + i) % 2, 4, 1);
        c.fillStyle = '#ffe07a'; c.fillRect(px + 4 + f * 3, py + 5 + (f % 2) * 3, 2, 1);
        c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(px, py, TW, 1); c.fillRect(px, py, 1, TH);
      } else if (t === T.SIVRI) {
        const d = TK.sivriDurum(s.zaman, x, y);
        c.fillStyle = '#1a1018'; for (const [dx, dy] of [[3, 3], [13, 3], [3, 9], [13, 9], [8, 6]]) c.fillRect(px + dx, py + dy, 4, 2);
        if (d === 1) { c.fillStyle = '#ff4a3a'; for (const [dx, dy] of [[4, 3], [14, 3], [4, 9], [14, 9], [9, 6]]) c.fillRect(px + dx, py + dy, 2, 1); }
        if (d === 2) for (const [dx, dy] of [[4, 3], [14, 3], [4, 9], [14, 9], [9, 6]]) { c.fillStyle = '#cfd6e2'; c.fillRect(px + dx, py + dy - 5, 2, 6); c.fillStyle = '#fff'; c.fillRect(px + dx, py + dy - 6, 2, 1); c.fillStyle = '#8a93a8'; c.fillRect(px + dx - 1, py + dy, 4, 1); }
      }
    }
  }
  function blok(c, x, y, h, tx, tip) {
    const px = sx(x), py = sy(y) - h;
    c.drawImage(tx.duvarOn, 0, 0, TW, Math.min(h, DH), px, py + TH, TW, h);
    c.drawImage(tx.duvarUst, px, py);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(px, py + TH - 2, TW, 2);
    if (tip === T.CATLAK) {
      c.fillStyle = '#ffd9a0'; const yy = py + TH;
      for (const [dx, dy] of [[3, 2], [4, 3], [5, 4], [4, 5], [3, 6], [4, 7], [6, 8], [7, 9], [8, 10], [9, 11], [10, 12]]) c.fillRect(px + dx + 2, yy + dy, 1, 1);
      c.fillStyle = 'rgba(255,179,90,.5)'; c.fillRect(px + 6, yy + 4, 1, 4);
    }
  }
  function direk(c, x, y, tx) {
    const px = sx(x) + (TW >> 1), py = sy(y) + TH - 1, P = tx.P;
    gol(c, px, py + 1, 9, 0.35);
    const g = tx.D0;
    const gövde = css(...kar(g, 0.9)), acik = css(...kar(g, 1.25)), koyu = css(...kar(g, 0.55));
    c.fillStyle = koyu; c.fillRect(px - 8, py - 3, 16, 4);
    c.fillStyle = gövde; c.fillRect(px - 6, py - 21, 12, 19);
    c.fillStyle = acik; c.fillRect(px - 6, py - 21, 3, 19); c.fillStyle = koyu; c.fillRect(px + 4, py - 21, 2, 19);
    c.fillStyle = css(...kar(g, 1.35)); c.fillRect(px - 8, py - 25, 16, 4); c.fillStyle = acik; c.fillRect(px - 7, py - 28, 14, 3);
    c.fillStyle = koyu; c.fillRect(px - 6, py - 13, 12, 1); c.fillRect(px - 6, py - 8, 12, 1);
    c.globalAlpha = 0.6 + 0.3 * Math.sin(sure * 3 + x); c.fillStyle = P.isik; c.fillRect(px - 1, py - 17, 2, 3); c.globalAlpha = 1;
  }
  function kapiCiz(c, s, tx) {
    const o = s.oda, P = tx.P;
    for (let i = 0; i < 2; i++) {
      const gx = TK.KAPI_X[i], t = o.grid[0][gx];
      if (t !== T.KAPI && t !== T.KAPIK) continue;
      const px = sx(gx), py = sy(0) + TH - DH;
      c.fillStyle = '#05030a'; c.fillRect(px, py, TW, DH + 2);
      c.fillStyle = css(...kar(tx.D0, 0.9)); c.fillRect(px - 1, py - 1, 2, DH + 3); c.fillRect(px + TW - 1, py - 1, 2, DH + 3); c.fillRect(px - 1, py - 2, TW + 2, 3);
      if (t === T.KAPIK) { c.fillStyle = css(...kar(tx.D0, 0.65)); c.fillRect(px + 1, py + 2, TW - 2, DH); c.fillStyle = css(...kar(tx.D0, 0.4)); for (let k = 0; k < 4; k++) c.fillRect(px + 1, py + 4 + k * 4, TW - 2, 1); c.fillRect(px + 10, py + 2, 1, DH); }
      else {
        const a = 0.5 + 0.2 * Math.sin(sure * 4 + i);
        c.globalAlpha = a; c.fillStyle = P.isik; for (let k = 0; k < 6; k++) c.fillRect(px + 2, py + 2 + k * 3, TW - 4, 1); c.globalAlpha = 1;
        ikonCiz(c, px + (TW >> 1), py - 8, TK.onizle(s, i));
      }
    }
  }
  function ikonCiz(c, x, y, on) {
    c.fillStyle = 'rgba(8,5,16,.88)'; c.fillRect(x - 7, y - 6, 14, 12); c.fillRect(x - 8, y - 5, 16, 10);
    const renk = on.tur === 'boss' ? '#ff5d4a' : on.tur === 'dinlenme' ? '#7dffb0' : on.tur === 'pazar' ? '#ffd86b' : on.tur === 'elit' ? '#e07bff' : on.odul === 'armagan' ? '#ffd86b' : '#ffb35a';
    c.fillStyle = renk;
    if (on.tur === 'boss') { c.fillRect(x - 3, y - 4, 6, 5); c.fillRect(x - 2, y + 1, 4, 2); c.fillStyle = '#120a1e'; c.fillRect(x - 2, y - 2, 1, 2); c.fillRect(x + 1, y - 2, 1, 2); }
    else if (on.tur === 'dinlenme') { c.fillRect(x - 1, y - 5, 2, 2); c.fillRect(x - 2, y - 3, 4, 3); c.fillRect(x - 3, y, 6, 3); }
    else if (on.tur === 'pazar') { c.fillRect(x - 4, y - 3, 8, 6); c.fillStyle = '#8a6a1a'; c.fillRect(x - 1, y - 1, 2, 2); }
    else if (on.tur === 'elit') { c.fillRect(x - 4, y - 4, 2, 3); c.fillRect(x + 2, y - 4, 2, 3); c.fillRect(x - 3, y - 1, 6, 4); }
    else if (on.odul === 'armagan') { c.fillRect(x - 1, y - 5, 2, 10); c.fillRect(x - 4, y - 1, 8, 2); c.fillRect(x - 2, y - 3, 4, 6); }
    else { for (let i = -3; i <= 3; i++) { c.fillRect(x + i, y + i, 1, 1); c.fillRect(x + i, y - i, 1, 1); } }
  }

  // ---------- varlıklar ----------
  function oyuncuCiz(c, s) {
    const pl = s.p, px = sx(pl.x), py = sy(pl.y);
    const hareketli = s.zaman - (s.sonHareket || 0) < 0.15;
    const bob = hareketli ? (Math.floor(sure * 8) % 2) : 0;
    const ters = Math.cos(pl.dir) < 0;
    gol(c, px, py + 1, 6);
    if (pl.dashT > 0) { for (let i = 1; i <= 3; i++) spr(c, SPR.koz, px - pl.dashX * i * 6, py - pl.dashY * i * 4, ters, 0.3 / i + 0.1); }
    if (pl.inv > 0 && Math.floor(sure * 20) % 2 === 0 && pl.dashT <= 0) c.globalAlpha = 0.45;
    // fener
    const fx = px + (ters ? 8 : -8), fy = py - 8 - bob;
    c.fillStyle = '#6b5a3a'; c.fillRect(fx, fy - 4, 1, 3);
    c.fillStyle = '#ffcf7a'; c.fillRect(fx - 1, fy - 2, 3, 3); c.fillStyle = '#fff2c0'; c.fillRect(fx, fy - 1, 1, 1);
    spr(c, SPR.koz, px, py - bob, ters);
    // kılıç
    const a = pl.swingT > 0 ? pl.swingYon + (1 - pl.swingT / 0.2 - 0.5) * 2.6 : pl.dir;
    const L = pl.swingT > 0 ? 12 : 9;
    for (let i = 3; i <= L; i++) { c.fillStyle = i > L - 3 ? '#ffffff' : '#cfe6ff'; c.fillRect(Math.round(px + Math.cos(a) * i), Math.round(py - 8 - bob + Math.sin(a) * i * 0.7), 1, 1); }
    c.globalAlpha = 1;
    // Köz Çemberi
    if (s.armagan.cember) { const n = 2 + Math.floor(s.armagan.cember); for (let i = 0; i < n; i++) { const t = pl.cemberA + i * Math.PI * 2 / n; const ox = sx(pl.x + Math.cos(t) * 1.7), oy = sy(pl.y + Math.sin(t) * 1.3) - 8; c.fillStyle = '#ff9a3c'; c.fillRect(ox - 2, oy - 2, 4, 4); c.fillStyle = '#ffe07a'; c.fillRect(ox - 1, oy - 1, 2, 2); } }
  }
  function dusmanCiz(c, e) {
    const px = sx(e.x), py = sy(e.y);
    if (e.dogum > 0) {
      gol(c, px, py + 1, 7, 0.3);
      c.fillStyle = 'rgba(224,123,255,' + (0.4 + 0.4 * Math.sin(sure * 20)) + ')';
      const rr = Math.round(8 + e.dogum * 6); c.fillRect(px - rr, py, rr * 2, 1); c.fillRect(px - rr + 2, py - 1, rr * 2 - 4, 1); c.fillRect(px - rr + 2, py + 1, rr * 2 - 4, 1);
      return;
    }
    const tn = TK.DUSMAN[e.tip];
    const f = e.flas > 0;
    const sp = SPR[e.tip];
    const ters = Math.cos(e.ac) < 0;
    const ucar = tn.ucar ? 7 + Math.round(Math.sin(sure * 8 + e.x)) : 0;
    const yuz = (e.tip === 'golge' || e.tip === 'albasti') ? Math.round(Math.sin(sure * 5 + e.x)) : 0;
    const R = tn.boss ? 22 : e.tip === 'buzdev' ? 10 : e.tip === 'demirci' ? 7 : 5;
    gol(c, px, py + 1, R, 0.35);
    let alfa = sp.alfa;
    if (e.faz === 'hayalet') alfa = 0.28;
    const hazir = e.faz === 'hazir' && Math.floor(sure * 16) % 2 === 0;
    if (hazir) c.globalAlpha = 0.8;
    spr(c, sp, px, py - ucar + yuz, ters, alfa, f);
    if (hazir) { c.fillStyle = 'rgba(255,60,40,.35)'; c.fillRect(px - R, py - R * 2, R * 2, R * 2); c.globalAlpha = 1; }
    if (!f && sp.acc) sprAcc(c, e.tip, px, py - ucar, ters, sure, sp.acc);
    if (e.elit || e.etki) { c.fillStyle = e.elit ? '#ffb02e' : '#e07bff'; const hh = R * 2 + 6; c.fillRect(px - 1, py - hh, 3, 1); c.fillRect(px - 2, py - hh + 1, 5, 1); }
    if (e.yanik > 0) { c.fillStyle = '#ff9a3c'; for (let i = 0; i < 3; i++) c.fillRect(px - 3 + i * 3 + Math.round(Math.sin(sure * 12 + i)), py - R * 2 - Math.round(Math.abs(Math.sin(sure * 9 + i)) * 4), 1, 2); }
    if (!tn.boss && e.hp < e.maxHp) { c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(px - 7, py - R * 2 - 5, 14, 2); c.fillStyle = '#ff6b7c'; c.fillRect(px - 7, py - R * 2 - 5, Math.max(1, Math.round(14 * e.hp / e.maxHp)), 2); }
    if (e.faz === 'hazir' && (e.saldiri === 'hamle' || e.ai === 'atilgan' || tn.ai === 'atilgan')) { c.fillStyle = 'rgba(255,90,70,.6)'; for (let i = 2; i < 40; i += 3) c.fillRect(Math.round(px + Math.cos(e.hedef) * i), Math.round(py - 3 + Math.sin(e.hedef) * i * 0.7), 1, 1); }
  }
  function nesneCiz(c, n, s, tx) {
    if (!n.aktif && n.tur !== 'cesme' && n.tur !== 'ziyafet') return;
    const px = sx(n.x), py = sy(n.y), yuk = Math.round(Math.sin(sure * 3 + n.x) * 1.5);
    gol(c, px, py + 1, 8, 0.3);
    if (n.tur === 'sunak') {
      c.fillStyle = '#4a4560'; c.fillRect(px - 8, py - 6, 16, 7); c.fillStyle = '#6a6488'; c.fillRect(px - 6, py - 12, 12, 6);
      const renk = n.alt === 'yetenek' ? '#7fe3ff' : '#ffd86b'; c.fillStyle = renk; c.fillRect(px - 1, py - 24 + yuk, 3, 8); c.fillRect(px - 3, py - 21 + yuk, 7, 3); c.fillStyle = '#fff'; c.fillRect(px, py - 22 + yuk, 1, 3);
    } else if (n.tur === 'sandik' || n.tur === 'lanet') {
      const koyu = n.tur === 'lanet'; c.fillStyle = koyu ? '#3a1a4a' : '#7a5a2f'; c.fillRect(px - 7, py - 8, 14, 9); c.fillStyle = koyu ? '#6a2a8a' : '#9a7440'; c.fillRect(px - 7, py - 12, 14, 4);
      c.fillStyle = koyu ? '#e07bff' : '#ffd86b'; c.fillRect(px - 1, py - 7, 2, 3);
    } else if (n.tur === 'cesme') {
      c.fillStyle = '#4a4560'; c.fillRect(px - 9, py - 5, 18, 5); c.fillStyle = n.aktif ? '#4dd9ff' : '#2f4f6a'; c.fillRect(px - 7, py - 6, 14, 2); if (n.aktif) { c.fillStyle = '#d9f6ff'; c.fillRect(px - 2 + Math.round(Math.sin(sure * 4)) * 2, py - 6, 2, 1); }
    } else if (n.tur === 'ziyafet') {
      c.fillStyle = '#5a3a22'; c.fillRect(px - 9, py - 6, 18, 5); c.fillStyle = n.aktif ? '#c04a2a' : '#4a3a32'; c.fillRect(px - 6, py - 9, 5, 3); c.fillStyle = n.aktif ? '#e8c070' : '#4a3a32'; c.fillRect(px + 1, py - 8, 6, 2);
    } else if (n.tur === 'et') { c.fillStyle = '#c04a2a'; c.fillRect(px - 3, py - 6 + yuk, 6, 4); c.fillStyle = '#f4e6c8'; c.fillRect(px + 3, py - 5 + yuk, 3, 2); }
    else if (n.tur === 'su') { c.fillStyle = '#4dd9ff'; c.fillRect(px - 2, py - 7 + yuk, 4, 6); c.fillStyle = '#d9f6ff'; c.fillRect(px - 1, py - 8 + yuk, 2, 1); }
    else if (n.tur === 'raf') {
      c.fillStyle = '#4a3a2a'; c.fillRect(px - 8, py - 5, 16, 5); c.fillStyle = '#6a5238'; c.fillRect(px - 8, py - 6, 16, 2);
      const ik = { sifa: '#ff5d7a', yem: '#7dffb0', armagan: '#ffd86b', koz: '#ffcf7a' }[n.alt]; c.fillStyle = ik; c.fillRect(px - 3, py - 14 + yuk, 6, 6); c.fillStyle = '#fff'; c.fillRect(px - 1, py - 13 + yuk, 2, 2);
    }
    void s; void tx;
  }
  function mermiCiz(c, m) {
    const px = sx(m.x), py = sy(m.y) - 6;
    const renk = m.dusman ? (m.boss ? '#ff7a5c' : '#d77bff') : '#ffcf7a';
    const k = m.r > 0.3 ? 3 : 2;
    c.fillStyle = renk; c.fillRect(px - k, py - k + 1, k * 2, k * 2 - 2); c.fillRect(px - k + 1, py - k, k * 2 - 2, k * 2);
    c.fillStyle = '#fff'; c.fillRect(px - 1, py - 1, 2, 2);
    gol(c, px, sy(m.y) + 1, 3, 0.25);
  }
  function tuzakCiz(c, t) {
    const px = sx(t.x), py = sy(t.y), a = 1 - t.t / t.m, rr = Math.round(t.r * TW);
    c.fillStyle = 'rgba(255,60,50,' + (0.18 + a * 0.35) + ')';
    for (let j = -4; j <= 4; j++) { const w = Math.round(rr * Math.sqrt(1 - (j / 5) ** 2)); c.fillRect(px - w, py + j, w * 2, 1); }
    c.fillStyle = '#ff6a4a'; c.fillRect(px - rr, py, 2, 1); c.fillRect(px + rr - 2, py, 2, 1);
    if (a > 0.4) { c.fillStyle = '#ffd0a0'; for (let i = 0; i < 4; i++) c.fillRect(px - 5 + i * 3, py - Math.round(a * 8), 1, Math.round(a * 8)); }
  }

  // ---------- ışık ve arayüz ----------
  function isikCiz(c, s, tx) {
    const P = tx.P;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const [x, y, rr] of [[sx(1.5), sy(1.3), 80], [sx(20.5), sy(1.3), 80], [sx(1.5), sy(12.5), 60], [sx(20.5), sy(12.5), 60]]) {
      const fl = 0.8 + 0.2 * Math.sin(sure * 9 + x); const [r0, g0, b0] = hex(P.isik);
      const g = c.createRadialGradient(x, y, 2, x, y, rr * fl); g.addColorStop(0, 'rgba(' + r0 + ',' + g0 + ',' + b0 + ',.22)'); g.addColorStop(1, 'rgba(' + r0 + ',' + g0 + ',' + b0 + ',0)'); c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    const px = sx(s.p.x), py = sy(s.p.y) - 8;
    const g = c.createRadialGradient(px, py, 3, px, py, 105); g.addColorStop(0, 'rgba(255,200,120,.32)'); g.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = g; c.fillRect(px - 105, py - 105, 210, 210);
    c.restore();
    c.save(); c.globalCompositeOperation = 'multiply';
    const v = c.createRadialGradient(LW / 2, OY + 6 * TH, 60, LW / 2, OY + 6 * TH, 310); v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(0.7, 'rgba(200,200,210,1)'); v.addColorStop(1, P.sis); c.fillStyle = v; c.fillRect(0, 0, LW, LH);
    c.restore();
  }
  function bar(c, x, y, w, h, oran, a, b) { c.fillStyle = '#12081a'; c.fillRect(x, y, w, h); const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(x, y, w * Math.max(0, Math.min(1, oran)), h); }
  function hud(c, s) {
    const p = s.p;
    c.textBaseline = 'middle';
    c.fillStyle = 'rgba(8,5,16,.72)'; c.fillRect(12, 12, 250, 76); c.strokeStyle = 'rgba(255,200,120,.35)'; c.strokeRect(12.5, 12.5, 249, 75);
    bar(c, 22, 20, 230, 14, p.hp / p.maxHp, '#ff5d6f', '#ff9a5d');
    c.fillStyle = '#fff'; c.font = '11px Georgia,serif'; c.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, 28, 28);
    for (let i = 0; i < p.kozMaks; i++) { c.fillStyle = i < p.kozYuk ? '#ffcf7a' : 'rgba(255,207,122,.18)'; c.fillRect(24 + i * 16, 44, 10, 10); }
    const dh = 1 - Math.min(1, p.dashCd / 0.7);
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(160, 44, 92, 8); c.fillStyle = dh >= 1 ? '#8de3ff' : '#4a7a90'; c.fillRect(160, 44, 92 * dh, 8);
    c.fillStyle = '#cfe9f5'; c.font = '10px Georgia,serif'; c.fillText('ATILIM', 160, 61);
    // açlık ve susuzluk
    const a = p.aclik < 25 && Math.floor(sure * 4) % 2 === 0, su = p.susuz < 25 && Math.floor(sure * 4) % 2 === 0;
    c.fillStyle = '#e8b070'; c.font = '10px Georgia,serif'; c.fillText('AÇLIK', 22, 76); bar(c, 60, 72, 80, 7, p.aclik / 100, a ? '#ff3b3b' : '#c9822a', '#e8b070');
    c.fillStyle = '#9fe0ff'; c.fillText('SU', 156, 76); bar(c, 176, 72, 76, 7, p.susuz / 100, su ? '#ff3b3b' : '#2a8ac9', '#6fd0ff');
    c.textAlign = 'right'; c.fillStyle = '#ffd86b'; c.font = 'bold 16px Georgia,serif'; c.fillText('Kül  ' + s.kul, CW - 18, 26);
    c.fillStyle = '#d9cfee'; c.font = '13px Georgia,serif';
    const bi = TK.BIYOMLAR[s.oda.biyom || 0];
    const ad = s.oda.tur === 'boss' ? TK.DUSMAN[bi.boss].ad.toUpperCase() : s.oda.tur === 'gizli' ? 'GİZLİ SUNAK' : s.oda.tur === 'dinlenme' ? 'DİNLENME' : s.oda.tur === 'pazar' ? 'PAZAR' : s.oda.tur === 'baslangic' ? 'GİRİŞ' : 'ODA ' + s.derinlik + ' / ' + (TK.SON_DERINLIK);
    c.fillText(ad, CW - 18, 48); c.fillStyle = '#9d92b8'; c.font = '11px Georgia,serif'; c.fillText(bi.ad, CW - 18, 66); c.textAlign = 'left';
    let x = 12;
    for (const id in s.armagan) { const ar = TK.ARMAGANLAR[id], guc = s.armagan[id], renk = guc >= 2.3 ? '#ffb02e' : guc >= 1.5 ? '#7fd6ff' : ar.renk; c.fillStyle = 'rgba(8,5,16,.75)'; c.fillRect(x, 96, 26, 24); c.strokeStyle = renk; c.strokeRect(x + .5, 96.5, 25, 23); c.fillStyle = ar.renk; c.font = 'bold 13px Georgia,serif'; c.textAlign = 'center'; c.fillText(ar.ic, x + 13, 107); c.font = '9px Georgia,serif'; c.fillStyle = renk; c.fillText('x' + guc.toFixed(1), x + 13, 116); c.textAlign = 'left'; x += 30; }
    const mh = Object.keys(s.muhur || {}); if (mh.length) { c.fillStyle = '#e07bff'; c.font = '10px Georgia,serif'; c.fillText('Mühür: ' + mh.map(k => TK.MUHURLER[k].ad).join(', '), 12, 134); }
    const j = s.enemies.find(e => TK.DUSMAN[e.tip].boss && !e.olu);
    if (j) { c.fillStyle = 'rgba(8,5,16,.8)'; c.fillRect(CW / 2 - 232, CH - 40, 464, 22); bar(c, CW / 2 - 226, CH - 34, 452, 10, j.hp / j.maxHp, '#7a1a14', '#ff5d4a'); c.fillStyle = '#ffd9d0'; c.font = '11px Georgia,serif'; c.textAlign = 'center'; c.fillText(TK.DUSMAN[j.tip].ad.toUpperCase(), CW / 2, CH - 46); c.textAlign = 'left'; }
    if (s.oda.tur === 'baslangic' && s.zaman < 14) { c.fillStyle = 'rgba(8,5,16,.7)'; c.fillRect(CW / 2 - 330, CH - 52, 660, 30); c.fillStyle = '#e8dcc0'; c.font = '13px Georgia,serif'; c.textAlign = 'center'; c.fillText('WASD hareket · Fare nişan · Sol tık/Boşluk savur · Sağ tık/E köz at · Shift atılım · Kapıya yürü', CW / 2, CH - 36); c.textAlign = 'left'; }
    if (s.oda.gizli && s.oda.temiz && s.oda.grid[6][0] === T.CATLAK) { c.fillStyle = 'rgba(255,217,160,' + (0.5 + 0.3 * Math.sin(sure * 4)) + ')'; c.font = '11px Georgia,serif'; c.fillText(s.meta.yetenek.kirik ? 'çatlak duvar: savur!' : 'çatlak duvar: Kırıcı Rün gerek', sx(1) * 2, sy(5.2) * 2); }
    for (const n of s.oda.nesneler) if (n.tur === 'raf' && n.aktif) { c.textAlign = 'center'; c.fillStyle = s.kul >= n.fiyat ? '#ffd86b' : '#ff9a7a'; c.font = '11px Georgia,serif'; c.fillText(n.ad + ' · ' + n.fiyat + ' Kül', sx(n.x) * 2, sy(n.y) * 2 + 18); c.textAlign = 'left'; }
    if (afisT > 0 && afis) { const al = Math.min(1, afisT * 1.2); c.globalAlpha = al; c.textAlign = 'center'; c.fillStyle = '#ffd86b'; c.font = 'bold 30px Georgia,serif'; c.shadowColor = '#000'; c.shadowBlur = 8; c.fillText(afis[0], CW / 2, 210); c.fillStyle = '#e8dcc0'; c.font = 'italic 17px Georgia,serif'; c.fillText(afis[1], CW / 2, 238); c.shadowBlur = 0; c.textAlign = 'left'; c.globalAlpha = 1; }
  }

  function ciz(c, s) {
    olaylariIsle(s);
    const tx = yap(s.oda.biyom || 0, s.oda.bolum || 0);
    const P = tx.P;
    lc.imageSmoothingEnabled = false;
    lc.save();
    lc.fillStyle = P.sis; lc.fillRect(0, 0, LW, LH);
    const sh = titresim > 0 ? Math.round(titresim / 3) : 0;
    if (sh) lc.translate(Math.round((Math.random() - 0.5) * sh), Math.round((Math.random() - 0.5) * sh));
    zeminCiz(lc, s, tx);
    kapiCiz(lc, s, tx);
    const liste = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = s.oda.grid[y][x];
      if (t === T.DUVAR || t === T.CATLAK) { if (y === 0 && (x === TK.KAPI_X[0] || x === TK.KAPI_X[1])) continue; liste.push({ k: y + 1, f: () => blok(lc, x, y, y === 0 || y === H - 1 ? DH : 11, tx, t) }); }
      else if (t === T.SUTUN) liste.push({ k: y + 1, f: () => direk(lc, x, y, tx) });
      else if (t === T.GIZLIKAPI && x === 0) { lc.fillStyle = '#05030a'; lc.fillRect(sx(0), sy(y), TW, TH); }
      else if (t === T.GERI) { lc.fillStyle = P.isik; lc.globalAlpha = 0.4; lc.fillRect(sx(x), sy(y) + TH - 3, TW, 3); lc.globalAlpha = 1; }
    }
    for (const t of s.tuzaklar) tuzakCiz(lc, t);
    liste.push({ k: s.p.y, f: () => oyuncuCiz(lc, s) });
    for (const e of s.enemies) liste.push({ k: e.y, f: () => dusmanCiz(lc, e) });
    for (const n of s.oda.nesneler) liste.push({ k: n.y, f: () => nesneCiz(lc, n, s, tx) });
    liste.sort((a, b) => a.k - b.k);
    for (const l of liste) l.f();
    for (const m of s.mermiler) mermiCiz(lc, m);
    for (const k of kesikler) {
      const a = 1 - k.t / 0.2;
      lc.fillStyle = 'rgba(255,245,210,' + (0.9 * (1 - a)) + ')';
      for (let i = -9; i <= 9; i++) { const an = k.aci + i * 0.12 + (a - 0.5) * 0.4; const rr = 29; lc.fillRect(Math.round(sx(k.x) + Math.cos(an) * rr), Math.round(sy(k.y) - 7 + Math.sin(an) * rr * 0.68), 2, 2); }
    }
    for (const q of parcacik) { lc.globalAlpha = Math.max(0, q.t / q.m); lc.fillStyle = q.renk; lc.fillRect(sx(q.x), Math.round(sy(q.y) - q.z * 13), 2, 2); }
    lc.globalAlpha = 1;
    isikCiz(lc, s, tx);
    lc.restore();
    c.save();
    c.imageSmoothingEnabled = false;
    c.drawImage(lo, 0, 0, CW, CH);
    for (const y of yazilar) { c.globalAlpha = Math.min(1, y.t * 2); c.fillStyle = y.r; c.font = 'bold 14px Georgia,serif'; c.textAlign = 'center'; c.fillText(y.m, sx(y.x) * 2, sy(y.y) * 2 - 30); }
    c.globalAlpha = 1; c.textAlign = 'left';
    c.restore();
    if (!s.menuFon) hud(c, s);
  }
  return { ciz, guncelle, dunya, CW, CH };
})();
