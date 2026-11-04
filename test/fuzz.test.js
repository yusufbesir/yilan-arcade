// Fuzz: localStorage anahtarlarına bozuk değerler yazılır, sayfa yeniden yüklenir;
// pageerror olmamalı, ayarlar aralıkta kalmalı, menü açılmalı, kayıtlar temiz kalmalı.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const url = 'file://' + path.resolve(__dirname, '../src/index.html') + '?test=1';
  await page.goto(url);

  const BIG = 'A'.repeat(1024 * 1024); // 1 MB
  const K_SET = 'twilightSettings', K_DATA = 'pixelSnakeArcade', K_SND = 'twilightSound';
  // [anahtar, ham string değer] — JSON.stringify ile üretilenler ve kasıtlı bozuk metinler
  const J = v => JSON.stringify(v);
  const cases = [
    // ayarlar
    [K_SET, 'null'], [K_SET, '[]'], [K_SET, '{'], [K_SET, ''], [K_SET, 'undefined'],
    [K_SET, J({ speed: 1e308, fx: -1, vol: 99 })], [K_SET, J({ speed: 'NaN', fx: 'x', vol: null })],
    [K_SET, J({ speed: -1, reduced: 'true', shake: 0, music: 1, tron2p: [] })],
    [K_SET, J({ speed: { a: { b: 1 } }, vol: [0.5] })], [K_SET, '{"__proto__":{"speed":0.1},"speed":1.2}'],
    [K_SET, J(BIG)], [K_SET, J({ speed: BIG })], [K_SET, '42'], [K_SET, '"metin"'], [K_SET, J({ vol: Infinity })],
    // kayıtlar / başarımlar / günlük
    [K_DATA, 'null'], [K_DATA, '[]'], [K_DATA, '{'], [K_DATA, '"{"'], [K_DATA, '-1'],
    [K_DATA, J({ records: null, progress: null, unlocked: null })],
    [K_DATA, J({ records: [], progress: [], unlocked: [] })],
    [K_DATA, J({ records: { classic: -1, bullet: 1e308, survivor: 'NaN', daily: null, dailyDate: 5 } })],
    [K_DATA, J({ records: { top: { classic: [{ s: 'x' }, null, 7, { s: 1e308 }, { s: -5 }] } } })],
    [K_DATA, J({ records: { top: { classic: new Array(1000).fill({ s: 1 }) } } })],
    [K_DATA, '{"records":{"top":{"__proto__":[{"s":1}]}}}'],
    [K_DATA, '{"records":{"__proto__":{"classic":99}},"unlocked":{"__proto__":{"ilkyem":true}}}'],
    [K_DATA, J({ records: { top: 'metin', dailyPrev: { d: 1, s: 'x' } } })],
    [K_DATA, J({ records: { dailyPrev: { d: BIG, s: 1e308 }, dailyDate: BIG } })],
    [K_DATA, J({ progress: { unlocked: -1, stars: { 1: 99, 2: 'x', '__proto__': 3 } } })],
    [K_DATA, J({ progress: { unlocked: 1e308, stars: [1, 2, 3] } })],
    [K_DATA, J({ progress: { unlocked: 'NaN', stars: null } })],
    [K_DATA, J({ unlocked: { ilkyem: 'true', klasik50: 1, boss: {}, yok: true } })],
    [K_DATA, J({ unlocked: BIG })], [K_DATA, J({ records: { classic: { s: 1 } } })],
    [K_DATA, BIG], [K_DATA, J({ a: { b: { c: { d: { e: 1 } } } } })],
    // ses
    [K_SND, '{'], [K_SND, J(BIG)], [K_SND, 'null']
  ];
  if (cases.length < 40) throw new Error('en az 40 durum olmalı: ' + cases.length);

  const RANGE = { speed: [0.7, 1.5], fx: [0, 1.5], vol: [0, 1] };
  const BOOLS = ['reduced', 'shake', 'music', 'bigHud', 'cb', 'tron2p'];
  const fails = [];
  for (let i = 0; i < cases.length; i++) {
    const [k, v] = cases[i];
    await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [k, v]);
    const before = errors.length;
    await page.reload();
    const r = await page.evaluate(() => {
      const s = SnakeGame.getSettings();
      const ex = SnakeGame._debug.extra();
      const rec = ex.records;
      const bad = [];
      Object.keys(rec).forEach(key => {
        if (key === 'top' || key === 'dailyDate' || key === 'dailyPrev') return;
        if (!(typeof rec[key] === 'number' && isFinite(rec[key]) && rec[key] >= 0)) bad.push('records.' + key + '=' + String(rec[key]));
      });
      if (Object.getPrototypeOf(rec.top) !== Object.prototype) bad.push('records.top prototipi bozuk');
      if (Object.getPrototypeOf(rec) !== Object.prototype) bad.push('records prototipi bozuk');
      Object.keys(rec.top).forEach(m => { if (m === '__proto__') bad.push('top.__proto__ anahtarı'); rec.top[m].forEach(t => { if (!(typeof t.s === 'number' && isFinite(t.s))) bad.push('top.' + m + ' s=' + t.s); }); });
      const menuTexts = ['menuClassicHigh', 'menuBulletHigh', 'menuSurvHigh', 'menuDailyHigh', 'menuProgress'].map(id => document.getElementById(id).textContent);
      menuTexts.forEach(t => { if (!/^\d+$/.test(t)) bad.push('menü metni: ' + t.slice(0, 20)); });
      // başarım paneli ve ayar paneli açılıp kapanmalı
      SnakeGame.openAchievements(); SnakeGame.closeAchievements(); SnakeGame.openSettings(); SnakeGame.closeSettings();
      return { s, menu: document.body.classList.contains('menu-acik'), bad, ach: document.getElementById('achCount').textContent };
    });
    const probs = [...r.bad];
    if (errors.length > before) probs.push('pageerror: ' + errors.slice(before).join(' | ').slice(0, 200));
    if (!r.menu) probs.push('menü açık değil');
    Object.keys(RANGE).forEach(key => { const [lo, hi] = RANGE[key]; const x = r.s[key]; if (!(typeof x === 'number' && x >= lo && x <= hi)) probs.push(`settings.${key}=${x}`); });
    BOOLS.forEach(b => { if (typeof r.s[b] !== 'boolean') probs.push(`settings.${b}=${r.s[b]}`); });
    if (!/^\d+\/14$/.test(r.ach)) probs.push('achCount: ' + r.ach);
    if (probs.length) fails.push(`#${i + 1} ${k}=${v.length > 60 ? v.slice(0, 60) + '…(' + v.length + ')' : v} -> ${probs.join('; ')}`);
  }
  await browser.close();
  console.log(`${cases.length} durum, ${fails.length} başarısız`);
  fails.forEach(f => console.log('  ' + f));
  if (fails.length) { console.error('BAŞARISIZ'); process.exit(1); }
  console.log('GEÇTİ');
})();
