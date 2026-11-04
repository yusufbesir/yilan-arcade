// ========================================================================
// TEMA - harita temaları: katalog, seçim, görünüm tonları ve OYUN KURALLARI (Twilight of the Serpents)
// Altı tema: Taş (başlangıç, kuralsız), Kaya Mağarası, Buzul, Lav Ocağı, Bataklık, Rün Tapınağı.
// Kurallar yalnız KURAL_MODLARI içinde (Klasik, Bölüm, Zamana Karşı, Portal) çalışır; diğer modlarda
// (Günlük, Tron, Mermi, Kuyruk Silahı, Hayatta Kalma, Kaos, Tapınak) tema yalnız görseldir.
// Seçim ve sahiplik Market'te tutulur (twilightMarket.sahipTema / tema). Kural durumu burada,
// zamanlar milisaniye cinsinden ve oyun tikinden beslenir (adim(dt)); böylece test edilebilir.
// ========================================================================
const Tema = (() => {
    'use strict';
    const KURAL_MODLARI = ['classic', 'campaign', 'timeattack', 'portal'];
    const OTOMATIK = 'otomatik';

    // Zaman sabitleri (ms)
    const LAV = { bekle: 8500, uyari: 2000, yanik: 1500 };   // toplam ~12 sn döngü
    const RUN_SURE = 5000;                                      // rün çarpanı süresi
    const CAMUR_YAVAS = 1.8;                                    // çamurda tik aralığı çarpanı
    const CURUK_ORAN = 0.06;                                    // bataklıkta çürük yem (Kaos'un %15'inden seyrek)
    const KAYA_EK = 0.5;                                        // Kaya Mağarası: yem puanı +%50

    // ren: tema rengi tonları. yem: parıltı rengi + elma tonu (hue-rotate derece). mermi/dusman: karışım rengi.
    // onizle: Market kartında zemin dokusunun üzerine çarpılan ton. muzik: perde çarpanı + davul alçak geçiren.
    const TEMALAR = [
        { id: 'tas', ad: 'Taş Avlu', fiyat: 0, kural: null,
          ozet: 'Kural yok: klasik taş avlu', ipucu: '',
          yem: { parilti: 'rgba(255,191,46,0.42)', hue: 0, renk: '#ffbf2e' }, mermi: null, dusman: null,
          onizle: '#8fa0c8', muzik: { carp: 1, lp: 220 } },
        { id: 'kaya', ad: 'Kaya Mağarası', fiyat: 300, kural: 'karanlik',
          ozet: 'Karanlık: ışık dairesi küçük, yem +%50 puan', ipucu: 'KARANLIK: YEM +%50 PUAN',
          yem: { parilti: 'rgba(255,170,60,0.55)', hue: 0, renk: '#ffae3c' }, mermi: '#ff9a4a', dusman: '#d6803c',
          onizle: '#9a8f78', muzik: { carp: 0.89, lp: 170 } },
        { id: 'buz', ad: 'Buzul', fiyat: 450, kural: 'kayma',
          ozet: 'Kayma: dönüşler bir tik gecikir', ipucu: 'BUZ: DÖNÜŞLER BİR TİK GEÇ',
          yem: { parilti: 'rgba(140,220,255,0.55)', hue: 175, renk: '#7fd8ff' }, mermi: '#7fd8ff', dusman: '#59a6e8',
          onizle: '#7fb4e8', muzik: { carp: 1.26, lp: 420 } },
        { id: 'lav', ad: 'Lav Ocağı', fiyat: 600, kural: 'yanik',
          ozet: 'Her ~12 sn bazı hücreler uyarıyla yanar', ipucu: 'TURUNCU UYARI: HÜCRE YANACAK',
          yem: { parilti: 'rgba(255,140,40,0.55)', hue: 12, renk: '#ff9a3c' }, mermi: '#ff5a1a', dusman: '#ff4a1a',
          onizle: '#d4663c', muzik: { carp: 0.84, lp: 150 } },
        { id: 'bat', ad: 'Bataklık', fiyat: 750, kural: 'camur',
          ozet: 'Çamur yavaşlatır, çürük yem seyrek', ipucu: 'ÇAMUR YAVAŞLATIR',
          yem: { parilti: 'rgba(170,240,90,0.5)', hue: 75, renk: '#b6ee5a' }, mermi: '#9be34a', dusman: '#7fa83a',
          onizle: '#6f9a58', muzik: { carp: 0.94, lp: 190 } },
        { id: 'run', ad: 'Rün Tapınağı', fiyat: 900, kural: 'run',
          ozet: 'Rün hücresi: 5 sn skor x2', ipucu: 'RÜNDEN GEÇ: 5 SN SKOR x2',
          yem: { parilti: 'rgba(180,130,255,0.55)', hue: 250, renk: '#c09cff' }, mermi: '#b07bff', dusman: '#9a5cff',
          onizle: '#9a78d8', muzik: { carp: 1.12, lp: 300 } }
    ];
    const OTOMATIK_TEMA = { id: OTOMATIK, ad: 'Otomatik', fiyat: 0, kural: null, ozet: 'Bölümlerde Taş, Kaya, Buzul, Lav sırayla', ipucu: '', onizle: '#8896b0' };

    const get = id => TEMALAR.find(t => t.id === id) || null;
    const hepsi = () => [OTOMATIK_TEMA].concat(TEMALAR);

    // ---------- seçim ----------
    function secili() {
        try { const s = Market.temaSecili(); return s === OTOMATIK || get(s) ? s : OTOMATIK; } catch (e) { return OTOMATIK; }
    }
    const dokuTema = (mod, sev) => (typeof Doku !== 'undefined' ? Doku.themeFor(mod, sev) : 'tas');
    // Görünüm teması (altı temadan biri). Tapınak odaları kendi temasını kullanır (burada çağrılmaz).
    function etkin(mod, sev) {
        const s = secili();
        if (mod !== 'tapinak' && s !== OTOMATIK && get(s)) return s;
        return dokuTema(mod, sev);
    }
    // Kural temasını verir; kural yoksa null. Otomatik: kural yalnız Bölüm Modunda (tema döngüsü) çalışır.
    function kuralTemasi(mod, sev) {
        if (!KURAL_MODLARI.includes(mod)) return null;
        const s = secili();
        const id = s !== OTOMATIK ? s : (mod === 'campaign' ? dokuTema(mod, sev) : null);
        const t = get(id);
        return t && t.kural ? id : null;
    }

    // ---------- kural durumu ----------
    let R = null;
    const rastgeleHucre = (env, ek) => {
        for (let i = 0; i < 80; i++) {
            const x = 1 + Math.floor(env.rand() * (env.COLS - 2)), y = 1 + Math.floor(env.rand() * (env.ROWS - 2));
            if (env.bos(x, y) && (!ek || ek(x, y))) return { x, y };
        }
        return null;
    };
    function baslat(mod, sev) {
        const id = kuralTemasi(mod, sev);
        R = id ? { id, hazir: false, hit: false, lav: { faz: 'bekle', kalan: LAV.bekle, hucre: [] }, camur: [], run: [], runKalan: 0, acc: 0, bekliyor: false, sayac: 0 } : null;
        return id;
    }
    function hazirla(env) {
        R.hazir = true;
        const orta = Math.floor(env.ROWS / 2);
        const baslangicta = (x, y) => !(Math.abs(y - orta) <= 1 && x < 12); // yılanın doğduğu şerit boş kalsın
        if (R.id === 'bat') {
            for (let k = 0; k < 9; k++) {
                const c = rastgeleHucre(env, baslangicta);
                if (!c) continue;
                let x = c.x, y = c.y;
                for (let j = 0; j < 4; j++) {
                    if (env.bos(x, y) && baslangicta(x, y) && !R.camur.some(m => m.x === x && m.y === y)) R.camur.push({ x, y });
                    const yon = Math.floor(env.rand() * 4);
                    x += [1, -1, 0, 0][yon]; y += [0, 0, 1, -1][yon];
                    x = Math.max(1, Math.min(env.COLS - 2, x)); y = Math.max(1, Math.min(env.ROWS - 2, y));
                }
            }
        } else if (R.id === 'run') {
            for (let k = 0; k < 3; k++) { const c = rastgeleHucre(env, baslangicta); if (c) R.run.push(c); }
        }
    }
    function lavSec(env) {
        const bas = env.bas || { x: -9, y: -9 }, yon = env.yon || { x: 1, y: 0 };
        const uzak = (x, y) => Math.abs(x - bas.x) + Math.abs(y - bas.y) > 4 && !(Math.abs(y - bas.y) <= 1 && (x - bas.x) * yon.x > 0 && Math.abs(x - bas.x) < 7 && yon.x !== 0)
            && !(Math.abs(x - bas.x) <= 1 && (y - bas.y) * yon.y > 0 && Math.abs(y - bas.y) < 7 && yon.y !== 0);
        const out = [];
        for (let k = 0; k < 4; k++) {
            const c = rastgeleHucre(env, uzak);
            if (!c) continue;
            out.push(c);
            const yon2 = Math.floor(env.rand() * 4), nx = c.x + [1, -1, 0, 0][yon2], ny = c.y + [0, 0, 1, -1][yon2];
            if (nx >= 1 && ny >= 1 && nx < env.COLS - 1 && ny < env.ROWS - 1 && env.bos(nx, ny) && uzak(nx, ny)) out.push({ x: nx, y: ny });
        }
        return out;
    }
    // dt: ms. env: { COLS, ROWS, bos(x,y), rand(), bas:{x,y}, yon:{x,y} }. Dönen olaylar: 'uyari' | 'yanik' | 'sondu' | 'run'
    function adim(dt, env) {
        const ev = [];
        if (!R) return ev;
        if (!R.hazir) hazirla(env);
        R.sayac += dt;
        if (R.id === 'lav') {
            const L = R.lav;
            L.kalan -= dt;
            if (L.kalan <= 0) {
                if (L.faz === 'bekle') { L.faz = 'uyari'; L.kalan = LAV.uyari; L.hucre = lavSec(env); R.hit = false; ev.push('uyari'); }
                else if (L.faz === 'uyari') { L.faz = 'yanik'; L.kalan = LAV.yanik; ev.push('yanik'); }
                else { L.faz = 'bekle'; L.kalan = LAV.bekle; L.hucre = []; ev.push('sondu'); }
            }
        }
        if (R.id === 'run') {
            if (R.runKalan > 0) R.runKalan = Math.max(0, R.runKalan - dt);
            const b = env.bas;
            const i = b ? R.run.findIndex(r => r.x === b.x && r.y === b.y) : -1;
            if (i >= 0) {
                R.runKalan = RUN_SURE; R.run.splice(i, 1);
                const c = rastgeleHucre(env, (x, y) => !R.run.some(r => r.x === x && r.y === y) && Math.abs(x - b.x) + Math.abs(y - b.y) > 5);
                if (c) R.run.push(c);
                ev.push('run');
            }
        }
        return ev;
    }

    // ---------- sorgular ----------
    const aktif = () => (R ? R.id : null);
    const kural = () => (R ? get(R.id).kural : null);
    const karanlik = () => (R && R.id === 'kaya' ? 1 : 0);
    function lavDurum() { return R && R.id === 'lav' ? { faz: R.lav.faz, kalan: R.lav.kalan, hucre: R.lav.hucre } : null; }
    function tehlike(x, y) { return !!(R && R.id === 'lav' && R.lav.faz === 'yanik' && !R.hit && R.lav.hucre.some(h => h.x === x && h.y === y)); }
    function vurdu() { if (R) R.hit = true; }
    const camurlar = () => (R && R.id === 'bat' ? R.camur : []);
    const camurMu = (x, y) => !!(R && R.id === 'bat' && R.camur.some(m => m.x === x && m.y === y));
    function hizCarpan(bas) { return bas && camurMu(bas.x, bas.y) ? CAMUR_YAVAS : 1; }
    const runeler = () => (R && R.id === 'run' ? R.run : []);
    const carpan = () => (R && R.id === 'run' && R.runKalan > 0 ? 2 : 1);
    const runKalan = () => (R && R.id === 'run' ? R.runKalan : 0);
    // Kaya: yem puanı +%50 (kesirler birikir: 1,2,1,2 ...); diğer temalarda aynen
    function yemPuan(pts) {
        if (!R || R.id !== 'kaya') return pts;
        R.acc += pts * KAYA_EK;
        const ek = Math.floor(R.acc + 1e-9);
        R.acc -= ek;
        return pts + ek;
    }
    const curukOran = () => (R && R.id === 'bat' ? CURUK_ORAN : 0);
    // Buzul: yön değişikliği ilk tikte yok sayılır (dönüş bir tik geç gelir). true: bu tik eski yönde devam et.
    function kaymaBekle(dir, sonraki) {
        if (!R || R.id !== 'buz') return false;
        if (sonraki.x === dir.x && sonraki.y === dir.y) { R.bekliyor = false; return false; }
        if (!R.bekliyor) { R.bekliyor = true; return true; }
        R.bekliyor = false;
        return false;
    }

    // ---------- görünüm tonları ----------
    // Düşman/mermi rengini tema tonuna doğru karıştırır (renk körü açıkken ve Taş'ta dokunmaz)
    function hexRgb(h) { const m = /^#([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
    function ton(rol, renk, tema, cb) {
        const t = get(tema);
        if (cb || !t || !t[rol]) return renk;
        const a = hexRgb(renk), b = hexRgb(t[rol]);
        if (!a || !b) return t[rol];
        const k = 0.55;
        return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',') + ')';
    }
    const yemTon = tema => { const t = get(tema); return t ? t.yem : TEMALAR[0].yem; };
    const muzik = tema => { const t = get(tema); return t ? t.muzik : TEMALAR[0].muzik; };
    // Başlangıç afişi: kural varsa ipucu, yoksa yalnız ad
    function afis(tema, kuralVar) {
        const t = get(tema);
        if (!t) return '';
        return (t.ad.toUpperCase()) + (kuralVar && t.ipucu ? ' · ' + t.ipucu : '');
    }

    return {
        TEMALAR, OTOMATIK, KURAL_MODLARI, LAV, RUN_SURE, CAMUR_YAVAS, CURUK_ORAN, KAYA_EK,
        get, hepsi, secili, etkin, kuralTemasi, baslat, adim,
        aktif, kural, karanlik, lavDurum, tehlike, vurdu, camurlar, camurMu, hizCarpan, runeler, carpan, runKalan,
        yemPuan, curukOran, kaymaBekle, ton, yemTon, muzik, afis,
        sifirla() { R = null; }
    };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Tema;
