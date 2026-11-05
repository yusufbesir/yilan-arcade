// Yılan gövde animasyonu (src/yilan-anim.js): saf hesap testleri (Node, Playwright'sız)
const assert = require('assert');
const A = require('../src/yilan-anim.js');

function sarit(n, aralik) {
  const R = { x: [], y: [], nx: [], ny: [], w: [], s: [], brk: [], n, L: (n - 1) * aralik };
  for (let i = 0; i < n; i++) { R.x.push(i * aralik); R.y.push(0); R.nx.push(0); R.ny.push(1); R.w.push(6); R.s.push(i * aralik); R.brk.push(false); }
  return R;
}
const kopya = R => JSON.parse(JSON.stringify(R));
const S = 20;

// 1) hareket azaltma: hiçbir şey değişmez
A.sifirla();
let R = sarit(40, 5), ref = kopya(R);
assert.strictEqual(A.uygula(R, { simdi: 1000, hizMs: 150, calisiyor: true, reduced: true, S }), false);
assert.deepStrictEqual(R, ref);

// 2) baş (s=0) kaymaz, gövde sınırlı kayar, kuyruk başa göre daha çok oynar; genişlik makul kalır
A.sifirla();
let maxOff = 0, maxOffKuyruk = 0, maxW = 0, minW = 9;
for (let f = 0; f < 120; f++) {
  R = sarit(60, 5);
  A.uygula(R, { simdi: 1000 + f * 16, hizMs: 120, calisiyor: true, reduced: false, S });
  assert.strictEqual(R.y[0], 0, 'baş noktası kaydı');
  for (let i = 0; i < R.n; i++) {
    const o = Math.abs(R.y[i]);
    maxOff = Math.max(maxOff, o);
    if (i > 45) maxOffKuyruk = Math.max(maxOffKuyruk, o);
    maxW = Math.max(maxW, R.w[i] / 6); minW = Math.min(minW, R.w[i] / 6);
    assert(Number.isFinite(R.x[i]) && Number.isFinite(R.y[i]) && Number.isFinite(R.w[i]));
  }
}
assert(maxOff > 0.5 && maxOff <= 1.75 * 1.3, 'genlik aralık dışı: ' + maxOff);
assert(maxOffKuyruk > 0.5, 'kuyruk salınmıyor');
assert(maxW < 1.05 && minW > 0.95, 'nefes genişliği aşırı: ' + minW + '..' + maxW);

// 3) yem şişliği: zamanla baştan kuyruğa ilerler ve süresi dolunca kaybolur
A.sifirla();
A.uygula(sarit(60, 5), { simdi: 5000, hizMs: 150, calisiyor: true, reduced: false, S }); // durumu başlat
A.yedi(5000);
function zirve(simdi) {
  const r = sarit(60, 5);
  A.uygula(r, { simdi, hizMs: 150, calisiyor: true, reduced: false, S });
  let bi = 0; for (let i = 0; i < r.n; i++) if (r.w[i] > r.w[bi]) bi = i;
  return { i: bi, w: r.w[bi] / 6 };
}
const z1 = zirve(5100), z2 = zirve(5600), z3 = zirve(6200);
assert(z1.w > 1.2, 'şişlik yok: ' + z1.w);
assert(z2.i > z1.i && z3.i > z2.i, 'şişlik ilerlemiyor: ' + [z1.i, z2.i, z3.i]);
const z4 = zirve(5000 + 8000);
assert(z4.w < 1.05, 'şişlik silinmedi: ' + z4.w);

// 4) duraklatmada genlik yumuşakça düşer (ani sıçrama yok)
A.sifirla();
for (let f = 0; f < 90; f++) A.uygula(sarit(60, 5), { simdi: 1000 + f * 16, hizMs: 120, calisiyor: true, reduced: false, S });
const a0 = A._st.k;
A.uygula(sarit(60, 5), { simdi: 1000 + 90 * 16, hizMs: 120, calisiyor: false, reduced: false, S });
assert(a0 > 0.9 && A._st.k > a0 - 0.1 && A._st.k < a0, 'genlik ani değişti: ' + a0 + ' -> ' + A._st.k);
console.log('yilan-anim OK (kayma ≤ ' + maxOff.toFixed(2) + ' px, şişlik zirvesi ' + z1.w.toFixed(2) + ')');
