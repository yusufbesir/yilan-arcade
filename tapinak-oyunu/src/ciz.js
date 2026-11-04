// Köz Tapınağı: 2.5D çizim (eğik bakış, yükseltilmiş bloklar, gölge, ışık). Tüm görseller kodla çizilir.
const Ciz = (() => {
  'use strict';
  const { W, H, T } = TK;
  const TW = 42, TH = 28, OX = 18, OY = 118, DH = 34; // DH: duvar yüksekliği (px)
  const CW = 960, CH = 620;
  const sx = x => OX + x * TW, sy = y => OY + y * TH;
  const dunya = (px, py) => ({ x: (px - OX) / TW, y: (py - OY) / TH });
  const rgb = (h, k) => { const n = parseInt(h.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; };

  const TEMA = [
    { zemin: '#4b4660', duvar: '#6a617f', isik: '#ffb35a', sis: '#1a1326' },   // 0 avlu
    { zemin: '#3f5560', duvar: '#5a7684', isik: '#8de3ff', sis: '#0d1a22' },   // 1 donmuş
    { zemin: '#58463f', duvar: '#7d6358', isik: '#ff8a4a', sis: '#241410' },   // 2 kül
    { zemin: '#3f5a4c', duvar: '#58806b', isik: '#9dffb0', sis: '#0f1f17' },   // 3 yosun
    { zemin: '#5a3f58', duvar: '#80587d', isik: '#e07bff', sis: '#1f1022' },   // 4 rün
    { zemin: '#5c3434', duvar: '#8a4646', isik: '#ff5d4a', sis: '#260c0c' }    // 5 boss
  ];
  const parcacik = [];
  const yazilar = [];
  const kesikler = [];
  let titresim = 0;
  let sure = 0;
  let sonDerinlik = -1;

  function hash(x, y) { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function tema(s) { return TEMA[Math.min(s.oda.tur === 'boss' ? 5 : (s.derinlik % 5), 5)]; }

  function olaylariIsle(s) {
    for (const o of s.olaylar) {
      if (o.tip === 'vurus') { for (let i = 0; i < 7; i++) p(o.x, o.y, '#ffe9a8', 0.35, 5); yazilar.push({ x: o.x, y: o.y, t: 0.7, m: String(Math.round(o.d)), r: '#fff2c0' }); titresim = Math.max(titresim, 2); }
      if (o.tip === 'oldu') { for (let i = 0; i < 22; i++) p(o.x, o.y, i % 2 ? '#ff9a3c' : '#e9d8ff', 0.8, 6); titresim = Math.max(titresim, 5); }
      if (o.tip === 'hasar') { for (let i = 0; i < 14; i++) p(o.x, o.y, '#ff4a5f', 0.6, 5); titresim = Math.max(titresim, 8); yazilar.push({ x: o.x, y: o.y - 0.5, t: 0.9, m: '-' + o.d, r: '#ff6b7c' }); }
      if (o.tip === 'savur') kesikler.push({ x: o.x, y: o.y, aci: o.aci, t: 0.2 });
      if (o.tip === 'atilim') for (let i = 0; i < 14; i++) p(o.x, o.y, '#b7e6ff', 0.4, 3);
      if (o.tip === 'kirildi') { for (let i = 0; i < 24; i++) p(o.x, o.y, '#c9b9a0', 0.9, 6); titresim = 9; }
      if (o.tip === 'halka' || o.tip === 'toz') { for (let i = 0; i < 20; i++) p(o.x, o.y, '#ffb0a0', 0.7, 5); titresim = Math.max(titresim, 6); }
      if (o.tip === 'koz') for (let i = 0; i < 6; i++) p(o.x, o.y, '#ffcf7a', 0.3, 2);
      if (o.tip === 'carp' || o.tip === 'sekti') for (let i = 0; i < 6; i++) p(o.x, o.y, '#ffd9a0', 0.3, 3);
      if (o.tip === 'iyiles') for (let i = 0; i < 20; i++) p(o.x, o.y, '#7dffb0', 1.0, 2, -2);
      if (o.tip === 'kul') yazilar.push({ x: o.x, y: o.y - 0.4, t: 1.1, m: '+' + o.kul + ' Kül', r: '#ffd86b' });
    }
    s.olaylar.length = 0;
  }
  function p(x, y, renk, omur, hiz, yukari) {
    const a = Math.random() * 6.283, v = Math.random() * hiz;
    parcacik.push({ x, y, z: 0.3 + Math.random() * 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, vz: (yukari === undefined ? 2 + Math.random() * 3 : -yukari), t: omur * (0.6 + Math.random() * 0.6), m: omur, renk });
  }
  function guncelle(dt) {
    sure += dt;
    titresim = Math.max(0, titresim - dt * 30);
    for (const q of parcacik) { q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vz -= 9 * dt; q.z = Math.max(0, q.z + q.vz * dt * 0.3); q.vx *= 0.97; q.vy *= 0.97; }
    for (let i = parcacik.length - 1; i >= 0; i--) if (parcacik[i].t <= 0) parcacik.splice(i, 1);
    for (const y of yazilar) { y.t -= dt; y.y -= dt * 0.8; }
    for (let i = yazilar.length - 1; i >= 0; i--) if (yazilar[i].t <= 0) yazilar.splice(i, 1);
    for (const k of kesikler) k.t -= dt;
    for (let i = kesikler.length - 1; i >= 0; i--) if (kesikler[i].t <= 0) kesikler.splice(i, 1);
    if (parcacik.length > 400) parcacik.splice(0, parcacik.length - 400);
  }

  // ---------- zemin ve bloklar ----------
  function zeminCiz(c, s, th) {
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const t = s.oda.grid[y][x];
      const px = sx(x), py = sy(y), k = 0.82 + hash(x, y) * 0.3;
      if (t === T.UCURUM) {
        const g = c.createLinearGradient(0, py, 0, py + TH);
        g.addColorStop(0, '#05030a'); g.addColorStop(1, '#14102a');
        c.fillStyle = g; c.fillRect(px, py, TW, TH);
        c.fillStyle = 'rgba(140,120,255,.08)'; c.fillRect(px, py + TH - 4, TW, 4);
        continue;
      }
      c.fillStyle = rgb(th.zemin, k * ((x + y) % 2 ? 1 : 0.94));
      c.fillRect(px, py, TW, TH);
      c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1; c.strokeRect(px + 0.5, py + 0.5, TW - 1, TH - 1);
      if (hash(x + 9, y + 3) < 0.15) { c.strokeStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.moveTo(px + 6, py + 8); c.lineTo(px + 20, py + 15); c.lineTo(px + 28, py + 12); c.stroke(); }
      if (hash(x + 5, y + 7) < 0.08) { c.fillStyle = 'rgba(255,255,255,.07)'; c.beginPath(); c.ellipse(px + 20, py + 14, 9, 5, 0, 0, 6.283); c.fill(); }
    }
    // uçurum kenar gölgesi (yükseklik hissi)
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (s.oda.grid[y][x] === T.UCURUM && s.oda.grid[y - 1][x] !== T.UCURUM) { c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(sx(x), sy(y), TW, 5); }
  }
  function blok(c, x, y, h, renkUst, th, tip) {
    const px = sx(x), py = sy(y) - h;
    const on = rgb(renkUst, 0.62), yan = rgb(renkUst, 0.45);
    c.fillStyle = on; c.fillRect(px, py + TH, TW, h);
    // taş derz çizgileri
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1;
    for (let i = 1; i < 3; i++) { const yy = py + TH + h * i / 3; c.beginPath(); c.moveTo(px, yy); c.lineTo(px + TW, yy); c.stroke(); }
    c.fillStyle = rgb(renkUst, 0.9 + hash(x, y) * 0.2); c.fillRect(px, py, TW, TH);
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(px, py, TW, 2);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(px, py + TH - 2, TW, 2);
    if (tip === T.CATLAK) {
      c.strokeStyle = '#ffd9a0'; c.lineWidth = 2; c.shadowColor = '#ffb35a'; c.shadowBlur = 8;
      c.beginPath(); c.moveTo(px + 4, py + TH + 4); c.lineTo(px + 20, py + TH + 14); c.lineTo(px + 12, py + TH + 24); c.lineTo(px + 34, py + TH + h - 2); c.stroke(); c.shadowBlur = 0;
    }
    void yan;
  }
  function direk(c, x, y, th) {
    const px = sx(x) + TW / 2, py = sy(y) + TH;
    gol(c, px, py - 2, 17, 7);
    const h = 40;
    const g = c.createLinearGradient(px - 14, 0, px + 14, 0);
    g.addColorStop(0, rgb(th.duvar, 0.5)); g.addColorStop(0.45, rgb(th.duvar, 1.05)); g.addColorStop(1, rgb(th.duvar, 0.45));
    c.fillStyle = g; c.fillRect(px - 14, py - h, 28, h);
    c.fillStyle = rgb(th.duvar, 1.2); c.beginPath(); c.ellipse(px, py - h, 14, 6, 0, 0, 6.283); c.fill();
    c.fillStyle = rgb(th.duvar, 0.7); c.fillRect(px - 16, py - 6, 32, 6);
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.moveTo(px - 14, py - 24); c.lineTo(px + 14, py - 24); c.stroke();
    c.fillStyle = th.isik; c.globalAlpha = 0.5 + 0.2 * Math.sin(sure * 3 + x); c.fillRect(px - 3, py - 30, 6, 6); c.globalAlpha = 1;
  }
  function gol(c, x, y, rx, ry, a) { c.fillStyle = 'rgba(0,0,0,' + (a || 0.38) + ')'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.283); c.fill(); }

  function kapiCiz(c, s, th) {
    const o = s.oda;
    for (let i = 0; i < 2; i++) {
      const gx = TK.KAPI_X[i], t = o.grid[0][gx];
      if (t !== T.KAPI && t !== T.KAPIK) continue;
      const px = sx(gx), py = sy(0);
      c.fillStyle = '#07040c'; c.fillRect(px, py + TH - DH, TW, DH + 4);
      if (t === T.KAPIK) { c.fillStyle = rgb('#7a6a55', 0.8); c.fillRect(px + 2, py + TH - DH + 2, TW - 4, DH + 2); c.strokeStyle = 'rgba(0,0,0,.5)'; for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(px + 2, py + TH - DH + k * 9); c.lineTo(px + TW - 2, py + TH - DH + k * 9); c.stroke(); } }
      else {
        const g = c.createLinearGradient(0, py + TH - DH, 0, py + TH + 6);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, th.isik); c.globalAlpha = 0.55 + 0.2 * Math.sin(sure * 4 + i); c.fillStyle = g; c.fillRect(px, py + TH - DH, TW, DH + 6); c.globalAlpha = 1;
        ikonCiz(c, px + TW / 2, py - 10, TK.onizle(s, i));
      }
    }
  }
  function ikonCiz(c, x, y, on) {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(8,5,16,.85)'; c.beginPath(); c.arc(0, 0, 13, 0, 6.283); c.fill();
    const renk = on.tur === 'boss' ? '#ff5d4a' : on.tur === 'dinlenme' ? '#7dffb0' : on.odul === 'armagan' ? '#ffd86b' : '#ffb35a';
    c.strokeStyle = renk; c.fillStyle = renk; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, 13, 0, 6.283); c.stroke();
    c.beginPath();
    if (on.tur === 'boss') { c.arc(0, -1, 6, 0, 6.283); c.fill(); c.fillStyle = '#120a1e'; c.fillRect(-3, -3, 2, 3); c.fillRect(1, -3, 2, 3); }
    else if (on.tur === 'dinlenme') { c.moveTo(0, -7); c.quadraticCurveTo(7, 2, 0, 7); c.quadraticCurveTo(-7, 2, 0, -7); c.fill(); }
    else if (on.odul === 'armagan') { for (let i = 0; i < 5; i++) { const a = -1.57 + i * 1.2566, b = a + 0.628; c.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); c.lineTo(Math.cos(b) * 3.5, Math.sin(b) * 3.5); } c.closePath(); c.fill(); }
    else { c.moveTo(-6, -6); c.lineTo(6, 6); c.moveTo(6, -6); c.lineTo(-6, 6); c.stroke(); }
    c.restore();
  }

  // ---------- varlıklar ----------
  function oyuncuCiz(c, s) {
    const pl = s.p, px = sx(pl.x), py = sy(pl.y);
    const hareketli = s.zaman - (s.sonHareket || 0) < 0.15;
    const bob = hareketli ? Math.sin(sure * 14) * 1.6 : Math.sin(sure * 2.5) * 0.8;
    const yon = Math.cos(pl.dir) >= 0 ? 1 : -1;
    gol(c, px, py + 3, 12, 5);
    if (pl.dashT > 0) { c.globalAlpha = 0.35; for (let i = 1; i <= 3; i++) { c.fillStyle = '#9fd8ff'; c.beginPath(); c.ellipse(px - pl.dashX * i * 12, py - 14 - pl.dashY * i * 8, 8, 14, 0, 0, 6.283); c.fill(); } c.globalAlpha = 1; }
    if (pl.inv > 0 && Math.floor(sure * 20) % 2 === 0 && pl.dashT <= 0) c.globalAlpha = 0.45;
    c.save(); c.translate(px, py + bob);
    // pelerin
    const g = c.createLinearGradient(0, -34, 0, 2); g.addColorStop(0, '#2f6b7a'); g.addColorStop(1, '#12303a');
    c.fillStyle = g; c.beginPath(); c.moveTo(-9, -22); c.quadraticCurveTo(-15, -6, -12, 3); c.lineTo(12, 3); c.quadraticCurveTo(15, -6, 9, -22); c.closePath(); c.fill();
    c.fillStyle = '#0d222a'; c.beginPath(); c.moveTo(-12, 3); c.lineTo(-8, -2); c.lineTo(-4, 3); c.lineTo(0, -1); c.lineTo(4, 3); c.lineTo(8, -2); c.lineTo(12, 3); c.fill();
    // kapüşon
    c.fillStyle = '#245866'; c.beginPath(); c.arc(0, -27, 9, 3.14, 6.283); c.lineTo(8, -20); c.quadraticCurveTo(0, -17, -8, -20); c.closePath(); c.fill();
    c.fillStyle = '#071417'; c.beginPath(); c.ellipse(yon * 2, -23, 5.5, 5, 0, 0, 6.283); c.fill();
    c.fillStyle = '#ffd27a'; c.shadowColor = '#ffb35a'; c.shadowBlur = 6; c.fillRect(yon * 2 - 3, -24, 2, 2); c.fillRect(yon * 2 + 1, -24, 2, 2); c.shadowBlur = 0;
    // fener (sol el)
    const fx = -yon * 12, fy = -10 + Math.sin(sure * 5) * 0.8;
    c.strokeStyle = '#6b5a3a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(fx, fy - 8); c.lineTo(fx, fy - 2); c.stroke();
    c.fillStyle = '#ffcf7a'; c.shadowColor = '#ff9a3c'; c.shadowBlur = 14; c.beginPath(); c.arc(fx, fy, 4.5, 0, 6.283); c.fill(); c.shadowBlur = 0;
    // kılıç
    const a = pl.swingT > 0 ? pl.swingYon + (1 - pl.swingT / 0.2 - 0.5) * 2.6 : pl.dir;
    const bx = Math.cos(a) * 20, by = Math.sin(a) * 14 - 12;
    c.strokeStyle = '#e8f4ff'; c.lineWidth = 3; c.shadowColor = '#9fd8ff'; c.shadowBlur = pl.swingT > 0 ? 12 : 3;
    c.beginPath(); c.moveTo(Math.cos(a) * 6, Math.sin(a) * 4 - 12); c.lineTo(bx, by); c.stroke(); c.shadowBlur = 0;
    c.restore(); c.globalAlpha = 1;
  }
  function dusmanCiz(c, e, s) {
    const px = sx(e.x), py = sy(e.y);
    if (e.dogum > 0) {
      gol(c, px, py + 2, 14, 6, 0.3);
      c.strokeStyle = 'rgba(224,123,255,' + (0.4 + 0.4 * Math.sin(sure * 20)) + ')'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(px, py, 16 + e.dogum * 8, 8 + e.dogum * 4, 0, 0, 6.283); c.stroke();
      return;
    }
    const f = e.flas > 0;
    const kaf = Math.cos(e.ac) >= 0 ? 1 : -1;
    const bob = Math.sin(sure * 6 + e.x * 3) * 2;
    const R = e.tip === 'jarl' ? 1.9 : e.tip === 'muhafiz' ? 1.25 : 1;
    gol(c, px, py + 3, 14 * R, 6 * R);
    c.save(); c.translate(px, py); c.scale(R, R);
    const hazir = e.faz === 'hazir' && Math.floor(sure * 16) % 2 === 0;
    if (e.tip === 'hortlak') {
      c.translate(0, -10 + bob);
      c.fillStyle = f ? '#fff' : 'rgba(190,255,225,.85)';
      c.beginPath(); c.moveTo(-9, 10); c.quadraticCurveTo(-12, -12, 0, -14); c.quadraticCurveTo(12, -12, 9, 10);
      for (let i = 0; i < 4; i++) c.lineTo(9 - i * 6 - 3, 10 + (i % 2 ? -3 : 4)); c.closePath(); c.fill();
      c.fillStyle = '#0a2a22'; c.fillRect(-5, -6, 3, 4); c.fillRect(2, -6, 3, 4);
      c.fillStyle = '#7dffb0'; c.fillRect(-4, -5, 1.5, 2); c.fillRect(3, -5, 1.5, 2);
    } else if (e.tip === 'cadi') {
      c.translate(0, -8 + bob);
      c.fillStyle = f ? '#fff' : '#5a2f7d'; c.beginPath(); c.moveTo(-10, 12); c.lineTo(-6, -10); c.lineTo(6, -10); c.lineTo(10, 12); c.closePath(); c.fill();
      c.fillStyle = f ? '#fff' : '#3b1f55'; c.beginPath(); c.arc(0, -13, 7, 0, 6.283); c.fill();
      c.fillStyle = '#e07bff'; c.shadowColor = '#e07bff'; c.shadowBlur = 8; c.fillRect(-3, -14, 2, 2); c.fillRect(2, -14, 2, 2);
      for (let i = 0; i < 3; i++) { const a = sure * 2 + i * 2.09; c.fillRect(Math.cos(a) * 16 - 2, Math.sin(a) * 6 - 6, 4, 4); } c.shadowBlur = 0;
    } else if (e.tip === 'muhafiz') {
      c.translate(0, -12);
      c.fillStyle = f ? '#fff' : (hazir ? '#d9a38a' : '#7d7a8a'); c.fillRect(-12, -6, 24, 24);
      c.fillStyle = f ? '#fff' : '#6a6778'; c.fillRect(-9, -16, 18, 12);
      c.fillStyle = '#ffb35a'; c.shadowColor = '#ff8a3c'; c.shadowBlur = 8; c.fillRect(-6, -12, 4, 3); c.fillRect(2, -12, 4, 3);
      c.fillRect(-1, 2, 2, 12); c.shadowBlur = 0;
      c.fillStyle = '#58566a'; c.fillRect(-17, -4, 6, 14); c.fillRect(11, -4, 6, 14);
    } else if (e.tip === 'jarl') {
      c.translate(0, -14 + bob * 0.5);
      c.fillStyle = f ? '#fff' : (hazir ? '#7a2f2f' : '#3a2f44'); c.beginPath(); c.moveTo(-16, 14); c.lineTo(-11, -12); c.lineTo(11, -12); c.lineTo(16, 14); c.closePath(); c.fill();
      c.fillStyle = f ? '#fff' : '#2a2234'; c.beginPath(); c.arc(0, -17, 9, 0, 6.283); c.fill();
      c.strokeStyle = '#c9b9a0'; c.lineWidth = 2;
      for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 6, -22); c.lineTo(sd * 12, -30); c.lineTo(sd * 8, -38); c.moveTo(sd * 12, -30); c.lineTo(sd * 18, -34); c.stroke(); }
      c.fillStyle = '#ff5d4a'; c.shadowColor = '#ff3b2a'; c.shadowBlur = 12; c.fillRect(-5, -19, 3, 3); c.fillRect(2, -19, 3, 3);
      c.fillStyle = '#ff9a3c'; c.beginPath(); c.arc(0, -29, 4 + Math.sin(sure * 8), 0, 6.283); c.fill(); c.shadowBlur = 0;
    }
    c.restore(); void kaf;
    if (e.yanik > 0) { c.fillStyle = '#ff9a3c'; for (let i = 0; i < 3; i++) c.fillRect(px - 6 + i * 6 + Math.sin(sure * 12 + i) * 2, py - 22 * R - Math.abs(Math.sin(sure * 9 + i)) * 8, 3, 3); }
    if (e.tip !== 'jarl' && e.hp < e.maxHp) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(px - 14, py - 34 * R, 28, 4); c.fillStyle = '#ff6b7c'; c.fillRect(px - 14, py - 34 * R, 28 * Math.max(0, e.hp / e.maxHp), 4); }
    if (e.faz === 'hazir' && e.saldiri === 'hamle') { c.strokeStyle = 'rgba(255,90,70,.6)'; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(e.hedef) * 5 * TW, py + Math.sin(e.hedef) * 5 * TH); c.stroke(); c.setLineDash([]); }
  }
  function nesneCiz(c, n, th) {
    if (!n.aktif && n.tur !== 'cesme') { return; }
    const px = sx(n.x), py = sy(n.y);
    const yuk = Math.sin(sure * 3) * 3;
    gol(c, px, py + 4, 15, 6);
    if (n.tur === 'sunak') {
      c.fillStyle = '#5a5470'; c.fillRect(px - 16, py - 10, 32, 14); c.fillStyle = '#6d6788'; c.fillRect(px - 12, py - 22, 24, 12);
      const renk = n.alt === 'yetenek' ? '#7fe3ff' : '#ffd86b';
      c.fillStyle = renk; c.shadowColor = renk; c.shadowBlur = 16; c.beginPath(); c.moveTo(px, py - 42 + yuk); c.lineTo(px + 8, py - 31 + yuk); c.lineTo(px, py - 24 + yuk); c.lineTo(px - 8, py - 31 + yuk); c.closePath(); c.fill(); c.shadowBlur = 0;
    } else if (n.tur === 'sandik') {
      c.fillStyle = '#7a5a2f'; c.fillRect(px - 13, py - 16, 26, 18); c.fillStyle = '#9a7440'; c.fillRect(px - 13, py - 22, 26, 8);
      c.fillStyle = '#ffd86b'; c.fillRect(px - 2, py - 14, 4, 6);
    } else if (n.tur === 'cesme') {
      c.fillStyle = '#5a5470'; c.beginPath(); c.ellipse(px, py - 4, 18, 8, 0, 0, 6.283); c.fill();
      c.fillStyle = n.aktif ? '#5dffb0' : '#2f4f45'; c.globalAlpha = 0.85; c.beginPath(); c.ellipse(px, py - 6, 14, 5, 0, 0, 6.283); c.fill(); c.globalAlpha = 1;
    }
  }
  function mermiCiz(c, m) {
    const px = sx(m.x), py = sy(m.y) - 10;
    const renk = m.dusman ? '#d77bff' : '#ffcf7a';
    c.fillStyle = renk; c.shadowColor = renk; c.shadowBlur = 12;
    c.beginPath(); c.arc(px, py, 5, 0, 6.283); c.fill(); c.shadowBlur = 0;
    gol(c, px, sy(m.y) + 2, 5, 2, 0.25);
  }

  // ---------- ışık ve arayüz ----------
  function isikCiz(c, s, th) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const kaynaklar = [[sx(1.5), sy(1.3), 150], [sx(20.5), sy(1.3), 150], [sx(1.5), sy(12.5), 120], [sx(20.5), sy(12.5), 120]];
    for (const [x, y, r] of kaynaklar) { const fl = 0.8 + 0.2 * Math.sin(sure * 9 + x); const g = c.createRadialGradient(x, y, 4, x, y, r * fl); g.addColorStop(0, 'rgba(255,170,80,.20)'); g.addColorStop(1, 'rgba(255,170,80,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
    const px = sx(s.p.x) - 12 * 0, py = sy(s.p.y) - 14;
    const g = c.createRadialGradient(px, py, 6, px, py, 210); g.addColorStop(0, 'rgba(255,200,120,.30)'); g.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = g; c.fillRect(px - 210, py - 210, 420, 420);
    c.restore();
    c.save(); c.globalCompositeOperation = 'multiply';
    const v = c.createRadialGradient(CW / 2, OY + 6 * TH, 120, CW / 2, OY + 6 * TH, 620); v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(1, th.sis); c.fillStyle = v; c.fillRect(0, 0, CW, CH);
    c.restore();
  }
  function hud(c, s) {
    const p = s.p;
    c.fillStyle = 'rgba(8,5,16,.7)'; c.fillRect(12, 12, 250, 62); c.strokeStyle = 'rgba(255,200,120,.35)'; c.strokeRect(12.5, 12.5, 249, 61);
    c.fillStyle = '#2a1020'; c.fillRect(22, 20, 230, 14);
    const g = c.createLinearGradient(22, 0, 252, 0); g.addColorStop(0, '#ff5d6f'); g.addColorStop(1, '#ff9a5d'); c.fillStyle = g; c.fillRect(22, 20, 230 * Math.max(0, p.hp / p.maxHp), 14);
    c.fillStyle = '#fff'; c.font = '11px Georgia,serif'; c.textBaseline = 'middle'; c.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, 28, 28);
    for (let i = 0; i < p.kozMaks; i++) { c.fillStyle = i < p.kozYuk ? '#ffcf7a' : 'rgba(255,207,122,.18)'; c.shadowColor = '#ffb35a'; c.shadowBlur = i < p.kozYuk ? 8 : 0; c.beginPath(); c.arc(30 + i * 20, 52, 6, 0, 6.283); c.fill(); c.shadowBlur = 0; }
    const dh = 1 - Math.min(1, p.dashCd / 0.7);
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(160, 48, 92, 8); c.fillStyle = dh >= 1 ? '#8de3ff' : '#4a7a90'; c.fillRect(160, 48, 92 * dh, 8);
    c.fillStyle = '#cfe9f5'; c.font = '10px Georgia,serif'; c.fillText('ATILIM', 160, 64);
    c.textAlign = 'right'; c.fillStyle = '#ffd86b'; c.font = 'bold 16px Georgia,serif'; c.fillText('Kül  ' + s.kul, CW - 18, 26);
    c.fillStyle = '#d9cfee'; c.font = '13px Georgia,serif';
    const ad = s.oda.tur === 'boss' ? 'KÜL JARLI' : s.oda.tur === 'gizli' ? 'GİZLİ SUNAK' : s.oda.tur === 'dinlenme' ? 'DİNLENME' : s.oda.tur === 'baslangic' ? 'GİRİŞ' : 'ODA ' + s.derinlik + ' / ' + (TK.SON_DERINLIK - 1);
    c.fillText(ad, CW - 18, 48); c.textAlign = 'left';
    let x = 12;
    for (const id in s.armagan) { const a = TK.ARMAGANLAR[id]; c.fillStyle = 'rgba(8,5,16,.75)'; c.fillRect(x, 82, 26, 24); c.strokeStyle = a.renk; c.strokeRect(x + .5, 82.5, 25, 23); c.fillStyle = a.renk; c.font = 'bold 13px Georgia,serif'; c.textAlign = 'center'; c.fillText(a.ic, x + 13, 93); if (s.armagan[id] > 1) { c.font = '9px Georgia,serif'; c.fillText('x' + s.armagan[id], x + 13, 103); } c.textAlign = 'left'; x += 30; }
    const j = s.enemies.find(e => e.tip === 'jarl' && !e.olu);
    if (j) { c.fillStyle = 'rgba(8,5,16,.8)'; c.fillRect(CW / 2 - 232, CH - 40, 464, 22); c.fillStyle = '#3a0d12'; c.fillRect(CW / 2 - 226, CH - 34, 452, 10); c.fillStyle = '#ff5d4a'; c.fillRect(CW / 2 - 226, CH - 34, 452 * Math.max(0, j.hp / j.maxHp), 10); c.fillStyle = '#ffd9d0'; c.font = '11px Georgia,serif'; c.textAlign = 'center'; c.fillText('KÜL JARLI', CW / 2, CH - 46); c.textAlign = 'left'; }
    if (s.oda.tur === 'baslangic' && s.zaman < 14) { c.fillStyle = 'rgba(8,5,16,.7)'; c.fillRect(CW / 2 - 330, CH - 52, 660, 30); c.fillStyle = '#e8dcc0'; c.font = '13px Georgia,serif'; c.textAlign = 'center'; c.fillText('WASD hareket · Fare nişan · Sol tık/Boşluk savur · Sağ tık/E köz at · Shift atılım · Kapıya yürü', CW / 2, CH - 36); c.textAlign = 'left'; }
    if (s.oda.gizli && s.oda.temiz && s.oda.grid[6][0] === T.CATLAK) { c.fillStyle = 'rgba(255,217,160,' + (0.5 + 0.3 * Math.sin(sure * 4)) + ')'; c.font = '11px Georgia,serif'; c.fillText(s.meta.yetenek.kirik ? 'çatlak duvar: savur!' : 'çatlak duvar: Kırıcı Rün gerek', sx(1), sy(5.2)); }
  }

  function ciz(c, s) {
    olaylariIsle(s);
    const th = tema(s);
    c.save();
    c.fillStyle = th.sis; c.fillRect(0, 0, CW, CH);
    if (titresim > 0) c.translate((Math.random() - 0.5) * titresim, (Math.random() - 0.5) * titresim);
    // dış zemin
    const bg = c.createLinearGradient(0, 0, 0, CH); bg.addColorStop(0, th.sis); bg.addColorStop(1, '#000'); c.fillStyle = bg; c.fillRect(-20, -20, CW + 40, CH + 40);
    zeminCiz(c, s, th);
    // kapı oyukları
    kapiCiz(c, s, th);
    // sıralı çizim: duvarlar, sütunlar, varlıklar
    const liste = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = s.oda.grid[y][x];
      if (t === T.DUVAR || t === T.CATLAK || t === T.KAPIK && false) { if (y === 0 && (x === TK.KAPI_X[0] || x === TK.KAPI_X[1])) continue; liste.push({ k: y + 1, f: () => blok(c, x, y, y === 0 || y === H - 1 ? DH : 22, th.duvar, th, t) }); }
      else if (t === T.SUTUN) liste.push({ k: y + 1, f: () => direk(c, x, y, th) });
      else if ((t === T.GIZLIKAPI) && x === 0) { c.fillStyle = '#07040c'; c.fillRect(sx(0), sy(y), TW, TH); }
      else if (t === T.GERI) { c.fillStyle = th.isik; c.globalAlpha = 0.4; c.fillRect(sx(x), sy(y) + TH - 6, TW, 6); c.globalAlpha = 1; }
    }
    liste.push({ k: s.p.y, f: () => oyuncuCiz(c, s) });
    for (const e of s.enemies) liste.push({ k: e.y, f: () => dusmanCiz(c, e, s) });
    for (const n of s.oda.nesneler) liste.push({ k: n.y, f: () => nesneCiz(c, n, th) });
    liste.sort((a, b) => a.k - b.k);
    for (const l of liste) l.f();
    for (const m of s.mermiler) mermiCiz(c, m);
    // savurma yayı
    for (const k of kesikler) {
      const a = 1 - k.t / 0.2;
      c.save(); c.translate(sx(k.x), sy(k.y) - 12); c.scale(1, 0.68);
      c.strokeStyle = 'rgba(255,245,210,' + (0.9 * (1 - a)) + ')'; c.lineWidth = 8 * (1 - a) + 2; c.shadowColor = '#ffd27a'; c.shadowBlur = 14;
      c.beginPath(); c.arc(0, 0, 58, k.aci - 1.15 + a * 0.4, k.aci + 1.15 - a * 0.2); c.stroke(); c.restore();
    }
    for (const q of parcacik) { c.globalAlpha = Math.max(0, q.t / q.m); c.fillStyle = q.renk; c.fillRect(sx(q.x) - 2, sy(q.y) - q.z * 26 - 2, 4, 4); }
    c.globalAlpha = 1;
    for (const y of yazilar) { c.globalAlpha = Math.min(1, y.t * 2); c.fillStyle = y.r; c.font = 'bold 14px Georgia,serif'; c.textAlign = 'center'; c.fillText(y.m, sx(y.x), sy(y.y) - 30); }
    c.globalAlpha = 1; c.textAlign = 'left';
    isikCiz(c, s, th);
    c.restore();
    hud(c, s);
  }
  return { ciz, guncelle, dunya, CW, CH, ARM: null };
})();
