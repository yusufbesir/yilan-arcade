// Emberwake: girdi, döngü ve arayüz.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const tuval = $('tuval'), c = tuval.getContext('2d');
  let depo;
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); depo = localStorage; } catch (e) { const d = {}; depo = { getItem: k => d[k] || null, setItem: (k, v) => { d[k] = v; } }; }
  const meta = TK.mirasYukle(depo);
  let fon = null, s = null, ekran = 'menu', onceki = 0, birikim = 0;
  const tus = {}, girdiOlay = { savur: false, koz: false, atilim: false };
  let fare = { x: 480, y: 300, hareket: 0 };
  const test = /[?&]test=1/.test(location.search);

  const goster = id => { for (const k of ['menu', 'miras', 'nasil', 'secim', 'son', 'duraklat']) $(k).classList.toggle('ac', k === id); ekran = id || 'oyun'; };
  function menuYenile() {
    $('menuKul').textContent = 'Kül: ' + meta.kul + ' · Koşu: ' + meta.kosu + ' · Zafer: ' + meta.zafer + ' · En derin oda: ' + meta.enIyi;
    const y = []; for (const k in meta.yetenek) if (meta.yetenek[k]) y.push(TK.YETENEKLER[k].ad);
    muhurYenile(); gunlukYenile(); ozellikYenile();
    $('menuYet').textContent = y.length ? 'Kalıcı yetenekler: ' + y.join(', ') : 'Kalıcı yetenek yok (boss ve gizli odalar yetenek verir)';
  }
  function mirasYenile() {
    $('mirasKul').textContent = 'Kül: ' + meta.kul;
    const l = $('mirasListe'); l.textContent = '';
    for (const id in TK.MIRAS) {
      const d = TK.MIRAS[id], n = meta.seviye[id], dolu = n >= d.maks, maliyet = dolu ? 0 : d.maliyet(n);
      const k = document.createElement('div'); k.className = 'kart';
      const b = document.createElement('b'); b.textContent = d.ad + '  (' + n + '/' + d.maks + ')';
      const sm = document.createElement('small'); sm.textContent = d.acik;
      const bt = document.createElement('button'); bt.textContent = dolu ? 'Tamam' : maliyet + ' Kül';
      bt.disabled = dolu || meta.kul < maliyet;
      bt.addEventListener('click', () => { if (TK.mirasAl(meta, id)) { TK.mirasKaydet(depo, meta); mirasYenile(); } });
      k.append(b, sm, bt); l.append(k);
    }
    const y = []; for (const k in TK.YETENEKLER) y.push((meta.yetenek[k] ? '✔ ' : '✖ ') + TK.YETENEKLER[k].ad + ': ' + TK.YETENEKLER[k].acik);
    $('mirasYet').innerHTML = ''; y.forEach(t => { const d = document.createElement('div'); d.textContent = t; $('mirasYet').append(d); });
  }
  const muhurSecili = {};
  function muhurYenile() {
    const kutu = $('muhurlar'); kutu.textContent = '';
    $('muhurBaslik').style.display = meta.yetenek.kirik ? '' : 'none';
    if (!meta.yetenek.kirik) return;
    for (const id in TK.MUHURLER) {
      const m = TK.MUHURLER[id], b = document.createElement('button');
      b.className = 'chip' + (muhurSecili[id] ? ' on' : ''); b.textContent = m.ad; b.title = m.acik + ' (+%' + Math.round(m.bonus * 100) + ' Kül)';
      b.addEventListener('click', () => { muhurSecili[id] = !muhurSecili[id]; muhurYenile(); });
      kutu.append(b);
    }
  }
  function basla() { Ses.baslat(); s = TK.yeniKosu((Date.now() ^ (Math.random() * 1e9)) >>> 0, meta, muhurSecili); goster(null); }
  function ozellikYenile() {
    const kutu = $('ozellikler'); kutu.textContent = '';
    for (const k in TK.OZELLIKLER) {
      const o = TK.OZELLIKLER[k], b = document.createElement('button');
      b.className = 'chip' + (meta.ozellik[k] !== false ? ' on' : ''); b.textContent = o.ad; b.title = o.acik;
      b.addEventListener('click', () => { meta.ozellik[k] = meta.ozellik[k] === false; TK.mirasKaydet(depo, meta); ozellikYenile(); });
      kutu.append(b);
    }
    const hb = document.createElement('button'); hb.className = 'chip'; hb.textContent = 'Sayı boyutu: ' + (meta.hasarBoyut === 1.6 ? 'Büyük' : meta.hasarBoyut === 1.3 ? 'Orta' : 'Normal');
    hb.addEventListener('click', () => { meta.hasarBoyut = meta.hasarBoyut === 1 ? 1.3 : meta.hasarBoyut === 1.3 ? 1.6 : 1; TK.mirasKaydet(depo, meta); ozellikYenile(); });
    kutu.append(hb);
    $('tohumKutu').style.display = TK.ozAcik(meta, 'tohum') ? '' : 'none';
    const pk = $('provalar'); pk.textContent = '';
    const acik = Math.min(3, meta.bossOldu);
    $('provaBaslik').style.display = acik ? '' : 'none';
    for (let i = 0; i < acik; i++) {
      const b = document.createElement('button'); b.className = 'chip'; b.textContent = TK.DUSMAN[TK.BIYOMLAR[i].boss].ad;
      b.title = 'Ödülsüz deneme: Kül %30, istatistik değişmez';
      b.addEventListener('click', () => { Ses.baslat(); s = TK.bossProvasi(meta, i); goster(null); });
      pk.append(b);
    }
  }
  function gunlukYenile() { const g = meta.gunluk, bugun = TK.gunNo(); $('gunlukYet').textContent = 'Bugünün tohumu ' + bugun + (g && g.gun === bugun ? ' · en iyi: oda ' + g.enIyi : ''); }
  function tohumBasla() { const v = Number($('tohumGir').value); if (!Number.isInteger(v) || v < 0 || v > 4294967295) { $('tohumGir').value = ''; return; } Ses.baslat(); s = TK.yeniKosu(v >>> 0, meta, null); goster(null); }
  function gunlukBasla() { Ses.baslat(); s = TK.gunlukKosu(meta); goster(null); }
  function bitis() {
    TK.gunlukKaydet(meta, s);
    TK.mirasKaydet(depo, meta);
    const z = s.bitti === 'zafer';
    $('sonBaslik').textContent = z ? 'ZAFER' : 'YENİLGİ';
    $('sonAlt').textContent = z ? 'Kül Jarlı yıkıldı. Kırıcı Rün artık seninle.' : 'Fener söndü, ama Kül yolunu bulur.';
    $('sonKul').textContent = '+' + s.kazanc + ' Kül kazandın (toplam ' + meta.kul + ')';
    $('sonYet').textContent = 'Oda: ' + s.derinlik + ' · Öldürülen: ' + s.oldurme + (s.gizliBulundu ? ' · Gizli oda bulundu' : '');
    if (TK.ozAcik(meta, 'olumRapor')) { const rp = TK.olumRaporu(s); if (rp) $('sonYet').textContent += ' · ' + rp; }
    $('sonSon5').textContent = TK.ozAcik(meta, 'son5') && !z ? TK.son5Raporu(s) : '';
    const tk = $('bTohumKop'); tk.style.display = TK.ozAcik(meta, 'tohum') && !s.gunluk && !s.prova ? '' : 'none';
    tk.textContent = 'Tohum ' + s.seed + ' · Kopyala';
    tk.onclick = () => { try { navigator.clipboard.writeText(String(s.seed)); tk.textContent = 'Kopyalandı: ' + s.seed; } catch (e) { /* pano yok */ } };
    goster('son');
  }
  function secimGoster() {
    const l = $('secimListe'); l.textContent = '';
    s.secim.secenekler.forEach((o, i) => {
      const id = typeof o === 'string' ? o : o.id, nd = TK.NADIRLIK[typeof o === 'string' ? 0 : o.nadir];
      const a = TK.ARMAGANLAR[id], k = document.createElement('div'); k.className = 'kart'; k.style.borderColor = nd.renk;
      const b = document.createElement('b'); b.textContent = (i + 1) + ') ' + a.ad; b.style.color = a.renk;
      const nl = document.createElement('div'); nl.textContent = nd.ad + (s.armagan[id] ? ' · sahip: x' + s.armagan[id].toFixed(1) : ''); nl.style.cssText = 'font-size:12px;color:' + nd.renk;
      const sm = document.createElement('small'); sm.textContent = a.acik;
      const es = TK.ESLESME.find(e => (e[0] === id && s.armagan[e[1]]) || (e[1] === id && s.armagan[e[0]]));
      if (es) { const ei = document.createElement('div'); ei.textContent = 'Eşleşme: ' + es[2]; ei.style.cssText = 'font-size:12px;color:#ffd86b'; sm.append(document.createElement('br'), ei); }
      const bt = document.createElement('button'); bt.textContent = 'Seç'; bt.addEventListener('click', () => sec(i));
      k.append(b, nl, sm, bt); l.append(k);
    });
    goster('secim');
  }
  function sec(i) { if (s && s.secim && TK.secimYap(s, i)) goster(null); }

  const sesYaz = () => { $('bSes').textContent = 'Ses: ' + (Ses.sessizMi() ? 'Kapalı' : 'Açık'); };
  $('bNasil').onclick = () => goster('nasil'); $('bNGeri').onclick = () => goster('menu');
  $('bSes').onclick = () => { Ses.baslat(); Ses.sessiz(!Ses.sessizMi()); sesYaz(); };
  $('bCik').onclick = () => { window.close(); };
  $('bBasla').onclick = basla; $('bGunluk').onclick = gunlukBasla; $('bTohum').onclick = tohumBasla; $('bTekrar').onclick = basla;
  $('bMiras').onclick = () => { mirasYenile(); goster('miras'); };
  $('bGeri').onclick = () => { menuYenile(); goster('menu'); };
  $('bMenu').onclick = () => { menuYenile(); goster('menu'); };
  $('bDevam').onclick = () => goster(null);
  $('bPMenu').onclick = () => { s = null; menuYenile(); goster('menu'); };

  addEventListener('keydown', e => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    tus[k] = true;
    if (ekran === 'secim' && '123'.includes(k)) sec(+k - 1);
    if (k === 'm') { Ses.sessiz(!Ses.sessizMi()); sesYaz(); }
    if (ekran !== 'oyun') return;
    if (k === ' ' || k === 'j') { girdiOlay.savur = true; e.preventDefault(); }
    if (k === 'e' || k === 'k') girdiOlay.koz = true;
    if (k === 'shift' || k === 'l') girdiOlay.atilim = true;
    if (k === 'escape') goster('duraklat');
  });
  addEventListener('keyup', e => { tus[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { for (const k in tus) tus[k] = false; if (ekran === 'oyun') goster('duraklat'); });
  function fareKonum(e) { const r = tuval.getBoundingClientRect(); fare.x = (e.clientX - r.left) * 960 / r.width; fare.y = (e.clientY - r.top) * 620 / r.height; fare.hareket = performance.now(); }
  tuval.addEventListener('mousemove', fareKonum);
  tuval.addEventListener('mousedown', e => { Ses.baslat(); fareKonum(e); if (ekran !== 'oyun') return; if (e.button === 0) girdiOlay.savur = true; if (e.button === 2) girdiOlay.koz = true; });
  tuval.addEventListener('contextmenu', e => e.preventDefault());

  const kolDurum = {};
  function oyunKolu() { try { const l = navigator.getGamepads ? navigator.getGamepads() : []; for (const g of l) if (g && g.connected) return g; } catch (e) { /* kol yok */ } return null; }
  function girdiAl() {
    let mx = (tus['d'] || tus['arrowright'] ? 1 : 0) - (tus['a'] || tus['arrowleft'] ? 1 : 0);
    let my = (tus['s'] || tus['arrowdown'] ? 1 : 0) - (tus['w'] || tus['arrowup'] ? 1 : 0);
    const g = { mx, my, savur: girdiOlay.savur, koz: girdiOlay.koz, atilim: girdiOlay.atilim };
    girdiOlay.savur = girdiOlay.koz = girdiOlay.atilim = false;
    const gp = oyunKolu();
    if (gp) {
      const d = v => Math.abs(v) > 0.25 ? v : 0;
      if (d(gp.axes[0]) || d(gp.axes[1])) { g.mx = d(gp.axes[0]); g.my = d(gp.axes[1]); mx = g.mx; my = g.my; }
      const bas = i => gp.buttons[i] && gp.buttons[i].pressed;
      const kenar = (i) => { const y = bas(i), e = y && !kolDurum[i]; kolDurum[i] = y; return e; };
      if (kenar(0) || kenar(7)) g.savur = true;
      if (kenar(2) || kenar(5)) g.koz = true;
      if (kenar(1) || kenar(4)) g.atilim = true;
      if (kenar(9)) goster('duraklat');
      if (d(gp.axes[2]) || d(gp.axes[3])) { g.hx = s.p.x + d(gp.axes[2]) * 3; g.hy = s.p.y + d(gp.axes[3]) * 3; if (mx || my) s.sonHareket = s.zaman; return g; }
      if (mx || my) { g.hx = s.p.x + mx; g.hy = s.p.y + my; s.sonHareket = s.zaman; return g; }
    }
    const w = Ciz.dunya(fare.x, fare.y);
    if (performance.now() - fare.hareket < 4000 || !(mx || my)) { g.hx = w.x; g.hy = w.y; }
    else { g.hx = s.p.x + mx; g.hy = s.p.y + my; }
    if (mx || my) s.sonHareket = s.zaman;
    return g;
  }
  function dongu(t) {
    const dt = Math.min(0.05, (t - onceki) / 1000 || 0); onceki = t;
    if (s) {
      if (ekran === 'oyun') {
        birikim += dt;
        while (birikim >= 1 / 60) { TK.adim(s, girdiAl(), 1 / 60); birikim -= 1 / 60; if (s.secim || s.bitti) break; }
        if (s.secim && ekran === 'oyun') secimGoster();
        else if (s.bitti && ekran === 'oyun') bitis();
        Ciz.guncelle(dt);
      }
      Ses.isle(s.olaylar);
      Ciz.ciz(c, s);
    } else {
      if (!fon) { fon = TK.yeniKosu(20261104, TK.mirasBos()); fon.p.x = 11; fon.p.y = 8; fon.menuFon = true; }
      fon.zaman += dt; fon.p.dir = Math.sin(fon.zaman * 0.6) * 3; Ciz.guncelle(dt); Ciz.ciz(c, fon);
    }
    requestAnimationFrame(dongu);
  }
  menuYenile();
  if (test) window.__KOZ = { TK, meta, basla, durum: () => s, goster, secimGoster, mirasYenile, bitis, menuYenile };
  requestAnimationFrame(dongu);
})();
