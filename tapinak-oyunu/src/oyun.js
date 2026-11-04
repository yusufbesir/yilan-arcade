// Köz Tapınağı: girdi, döngü ve arayüz.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const tuval = $('tuval'), c = tuval.getContext('2d');
  let depo;
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); depo = localStorage; } catch (e) { const d = {}; depo = { getItem: k => d[k] || null, setItem: (k, v) => { d[k] = v; } }; }
  const meta = TK.mirasYukle(depo);
  let s = null, ekran = 'menu', onceki = 0, birikim = 0;
  const tus = {}, girdiOlay = { savur: false, koz: false, atilim: false };
  let fare = { x: 480, y: 300, hareket: 0 };
  const test = /[?&]test=1/.test(location.search);

  const goster = id => { for (const k of ['menu', 'miras', 'secim', 'son', 'duraklat']) $(k).classList.toggle('ac', k === id); ekran = id || 'oyun'; };
  function menuYenile() {
    $('menuKul').textContent = 'Kül: ' + meta.kul + ' · Koşu: ' + meta.kosu + ' · Zafer: ' + meta.zafer + ' · En derin oda: ' + meta.enIyi;
    const y = []; for (const k in meta.yetenek) if (meta.yetenek[k]) y.push(TK.YETENEKLER[k].ad);
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
  function basla() { s = TK.yeniKosu((Date.now() ^ (Math.random() * 1e9)) >>> 0, meta); goster(null); }
  function bitis() {
    TK.mirasKaydet(depo, meta);
    const z = s.bitti === 'zafer';
    $('sonBaslik').textContent = z ? 'ZAFER' : 'YENİLGİ';
    $('sonAlt').textContent = z ? 'Kül Jarlı yıkıldı. Kırıcı Rün artık seninle.' : 'Fener söndü, ama Kül yolunu bulur.';
    $('sonKul').textContent = '+' + s.kazanc + ' Kül kazandın (toplam ' + meta.kul + ')';
    $('sonYet').textContent = 'Oda: ' + s.derinlik + ' · Öldürülen: ' + s.oldurme + (s.gizliBulundu ? ' · Gizli oda bulundu' : '');
    goster('son');
  }
  function secimGoster() {
    const l = $('secimListe'); l.textContent = '';
    s.secim.secenekler.forEach((id, i) => {
      const a = TK.ARMAGANLAR[id], k = document.createElement('div'); k.className = 'kart';
      const b = document.createElement('b'); b.textContent = (i + 1) + ') ' + a.ad + (s.armagan[id] ? '  (seviye ' + (s.armagan[id] + 1) + ')' : ''); b.style.color = a.renk;
      const sm = document.createElement('small'); sm.textContent = a.acik;
      const bt = document.createElement('button'); bt.textContent = 'Seç'; bt.addEventListener('click', () => sec(i));
      k.append(b, sm, bt); l.append(k);
    });
    goster('secim');
  }
  function sec(i) { if (s && s.secim && TK.secimYap(s, i)) goster(null); }

  $('bBasla').onclick = basla; $('bTekrar').onclick = basla;
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
  tuval.addEventListener('mousedown', e => { fareKonum(e); if (ekran !== 'oyun') return; if (e.button === 0) girdiOlay.savur = true; if (e.button === 2) girdiOlay.koz = true; });
  tuval.addEventListener('contextmenu', e => e.preventDefault());

  function girdiAl() {
    let mx = (tus['d'] || tus['arrowright'] ? 1 : 0) - (tus['a'] || tus['arrowleft'] ? 1 : 0);
    let my = (tus['s'] || tus['arrowdown'] ? 1 : 0) - (tus['w'] || tus['arrowup'] ? 1 : 0);
    const g = { mx, my, savur: girdiOlay.savur, koz: girdiOlay.koz, atilim: girdiOlay.atilim };
    girdiOlay.savur = girdiOlay.koz = girdiOlay.atilim = false;
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
      Ciz.ciz(c, s);
    } else { c.fillStyle = '#05030a'; c.fillRect(0, 0, 960, 620); }
    requestAnimationFrame(dongu);
  }
  menuYenile();
  if (test) window.__KOZ = { TK, meta, basla, durum: () => s, goster, secimGoster, mirasYenile, bitis, menuYenile };
  requestAnimationFrame(dongu);
})();
