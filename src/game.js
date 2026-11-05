// ========================================================================
// TWILIGHT OF THE SERPENTS - GAME ENGINE
// ========================================================================

const SnakeGame = (() => {
    // ======================== CONFIGURATION ========================
    const CONFIG = {
        CELL: 20,
        WIDTH: 960,
        HEIGHT: 640,
        BASE_SPEED: 140,
        COLORS: {
            bg: '#080810',
            grid: '#101018',
            snakeHead: '#00ff66',
            snakeBody: '#00cc55',
            food: '#ff3344',
            superFood: '#ffdd00',
            bullet: '#ff0066',
            bulletHoming: '#ff9900',
            obstacle: '#3a3a55',
            movingObs: '#ff7700',
            powerShield: '#00ccff',
            powerSpeed: '#ffdd00',
            powerInvincible: '#ff00ff',
            powerClear: '#00ff66'
        }
    };
    
    // Renk körü paleti (settings.cb): Okabe & Ito (2008) / Wong (2011, Nature Methods 8:441) kesin hex değerleri.
    // Tek kaynak; eski hsl/hex değerleri kullanıldıkları satırlarda yorumda bırakıldı. Kaynak notu: CREDITS.md.
    const PALET = {
        yilan: '#0072B2',    // mavi
        yem: '#E69F00',      // turuncu
        yemHalka: '#FFFFFF', // şekil ipucu: beyaz halka
        curuk: '#D55E00',    // kızıl turuncu X
        dusman: '#CC79A7',   // kızıl mor
        engel: '#CC79A7',    // kızıl mor
        tron: '#F0E442',     // sarı
        // k < 0 koyultur, k > 0 açar (gövde gradyanı için)
        ton(hex, k) {
            const n = parseInt(hex.slice(1), 16);
            const ch = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
            return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
        }
    };

    const COLS = Math.floor(CONFIG.WIDTH / CONFIG.CELL);
    const ROWS = Math.floor(CONFIG.HEIGHT / CONFIG.CELL);
    
    // ======================== STATE ========================
    let canvas, ctx;
    let state = {
        mode: 'classic',
        level: 1,
        score: 0,
        lives: 3,
        target: 10,
        speed: CONFIG.BASE_SPEED,
        paused: false,
        over: false,
        complete: false,
        running: false
    };
    
    let snake = [];
    let dir = { x: 1, y: 0 };
    let nextDir = { x: 1, y: 0 };
    let food = null;
    let obstacles = [];
    let movingObs = [];
    let bullets = [];
    let powerups = [];
    let bulletTimer = 0;
    let patterns = [];
    let lasers = [];
    let boss = null;
    let waveTick = 0;
    let playerShots = [];
    let enemies = [];
    let shotCooldown = 0;
    let gems = [];
    let sv = { level: 1, xp: 0, need: 5, dmg: 1, cd: 10, multi: 1, magnet: 2.5, timer: 0, choosing: false, choices: [] };
    let banner = { text: '', until: 0 };
    let portals = [];
    let tron = { ai: [], aiDir: { x: -1, y: 0 }, round: 1, twoP: false, p2Next: { x: -1, y: 0 }, p2Wins: 0, gaps: new Set(), gapN: 0 };
    let chaos = { rule: null, left: 0, next: 0, saved: 0 };
    let rand = Math.random;
    let particles = [];
    let shake = { mag: 0 };
    let prevSnake = [];
    let lastTickAt = 0;
    let lastFrameAt = 0;
    let dpr = 1;
    const SYS_REDUCED = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
    let REDUCED = SYS_REDUCED;
    const TEST_MODE = /[?&]test=1\b/.test(location.search);
    let settings = { speed: 1, fx: 1, vol: 0.6, reduced: false, shake: true, music: true, bigHud: false, cb: false, tron2p: false, ek: {} };

    // ======================== EK ÖZELLİKLER (geri alınabilir) ========================
    // Her biri Ayarlar > Ek özellikler altında tek tek kapatılabilir; varsayılan açık. Kapalıyken oyun eski davranışıyla çalışır.
    const EK_LISTE = [
        ['donus', 'DÖNÜŞ TAMPONU', 'Bir tik içinde basılan iki ardışık tuş sıraya alınır'],
        ['rekor', 'REKOR IŞILTISI', 'Her modda kendi rekorunu geçince kısa ışıltı ve uyarı'],
        ['siyrilma', 'SIYRILMA ZİNCİRİ', 'Mermi Manyağı: 90 tik içinde art arda sıyrılma x2, x3 puan'],
        ['zbonus', 'ZAMANLI BONUS YEM', 'Klasik: her 5 yemde kısa süreli yıldız yem, erken yenirse çok puan'],
        ['zseri', 'SERİ YEM', 'Zamana Karşı: 2 sn içinde art arda 3 yem +1 sn'],
        ['cekim', 'ÇEKİM YEMİ', 'Kaos: nadir mor yem, yenince yem 1 sn başa doğru kayar'],
        ['kivrim', 'KIVRIM BONUSU', 'Günlük: son 3 hareket farklı yöndeyse yem x2'],
        ['tizbos', 'İZ BOŞLUĞU', 'Tron: iz duvarında periyodik küçük geçit açılır'],
        ['avpayi', 'AV PAYI', 'Kuyruk Silahı: her 3. vuruşta harcanan kuyruk halkası geri gelir'],
        ['diken', 'GÖVDE DİKENİ', 'Hayatta Kalma: gövdeye değen düşman yavaş yavaş hasar alır'],
        ['soguyan', 'SOĞUYAN PORTAL', 'Portal: kullanılan çift 8 tik uyur (solar), art arda sıçrama olmaz'],
        ['par', 'SÜRE YILDIZI', 'Bölüm: hedefi hızlı bitirirsen yıldız +1 (en çok 3)'],
        ['elit', 'ELİT SANDIK', 'Hayatta Kalma: her 20. öldürmede tam seviyelik altın elmas düşer'],
        ['guc', 'GÜÇ HALKASI', 'Aktif güçlendirmenin kalan süresi yılanın başında ince halka olarak görünür'],
        ['rtekrar', 'R İLE YENİDEN DENE', 'Oyun sırasında R tuşu menüye dönmeden oyunu baştan başlatır'],
        ['yutma', 'YUTMA ANİMASYONU', 'Yem yenince baş kısa süre şişer ve geri toplanır (yalnız çizim)'],
        ['alaca', 'ALACAKARANLIK SAATİ', 'Klasik: skor arttıkça ekran kararır, yılan başı fener gibi aydınlatır (hız değişmez)'],
        ['mevsim', 'MEVSİM ÇARKI', 'Günlük: tarihe göre bir ek kural (her 4. yem x2, her 6. yem +3 ya da 12 tik içinde seri yem +1)'],
        ['takas', 'BAŞ-KUYRUK TAKASI', 'Portal: X tuşu baş ile kuyruğu değiştirir (ters yön), 120 tik bekleme'],
        ['yansit', 'YANSITMA HALKASI', 'Mermi Manyağı: Z tuşu önündeki mermiyi geri yansıtır, 1 kuyruk halkası harcar, 40 tik bekleme'],
        ['vizz', 'YAKIN GEÇİŞ SESİ', 'Mermi Manyağı: sıyrılan mermi kısa tiz bir ses çıkarır'],
        ['kabuk', 'KABUK DEĞİŞTİRME', 'Klasik: 30 halkada K tuşu ile deri atılır, kuyruk 5 halkaya iner, 40 tik puan x2'],
        ['isi', 'ISI HARİTASI', 'Oyun sonu ekranında yılanın en çok geçtiği hücrelerin küçük ısı haritası'],
        ['olum', 'ÖLÜM EŞİĞİ', 'Klasik/Portal/Zamana Karşı: ölümcül hamlede bir tik bekler, dönmen için süre verir (60 tikte bir)'],
        ['yanki', 'YANKI YEMİ', 'Klasik: yem yenince 3 tik sonra aynı yerde soluk yankı belirir, yersen +1 puan'],
        ['kuyrukrenk', 'KUYRUK RENGİ', 'Son 10 yemin türü kuyruk halkalarında küçük renk noktası olarak görünür (yalnız çizim)'],
        ['renkkapi', 'RENK KAPISI', 'Portal: portaldan çıkınca 12 tik içinde yenen yem x2, baş portal renginde parlar'],
        ['surunme', 'SÜRÜNME DALGASI', 'Yılanın gövdesi hafifçe dalgalanır, yem yenince gövdede şişlik baştan kuyruğa ilerler (yalnız çizim; hareket azaltmada kapalı)'],
        ['mayin', 'KUYRUK MAYINI', 'Kuyruk Silahı: O tuşu kuyruk ucundan halka bırakıp mayın yapar; düşman yaklaşınca patlar, 30 tikte kaybolur'],
        ['hayalet', 'HAYALET YILAN', 'Klasik: en iyi koşunun izi soluk bir ışık olarak yanında ilerler; önüne geçince "hayaleti geçtin" yazar'],
        ['parlama', 'PARLAMA ATILIMI', 'Tron: iz uzadıkça enerji dolar (30 tik); dolunca O tuşu 3 hücre iz bırakmadan sıçratır'],
        ['tohum', 'TOHUM KODU', 'Klasik: oyun sonunda kısa kod gösterilir, T tuşu aynı kodla (aynı yem düzeniyle) yeniden başlatır'],
        ['pspr', 'SPRİTE PARÇACIKLAR', 'Patlama ve kıvılcımlar Kenney CC0 dokularıyla (yıldız, alev, ışık) çizilir; kapalıyken düz daire'],
        ['rozet', 'ROZETLER', 'Başarımlar panelinde 10 sessiz rozet gösterir (oyun içinde görünmez)', false],
    ];
    const EK_KAPALI = new Set(EK_LISTE.filter(x => x[3] === false).map(x => x[0]));
    const ek = id => EK_KAPALI.has(id) ? settings.ek[id] === true : settings.ek[id] !== false;
    let turnQ = [];
    let tmHiz = 1;      // Tema kuralı: Bataklık çamurunda tik aralığı çarpanı
    let tmBekle = null; // Tema başlangıç afişi (mod afişi bitince 2 sn gösterilir)
    const effSpeed = () => Math.max(30, Math.round(state.speed * tmHiz * (state.calm > 0 ? 1 + Miras.value('sakin') : 1) / settings.speed)); // Miras: Sakin Başlangıç
    const STARS = Array.from({ length: 46 }, (_, i) => ({ x: (i * 97.13) % 960, y: (i * 53.71) % 640, r: 0.6 + (i % 3) * 0.5, s: 0.4 + (i % 5) * 0.25, p: i }));
    const CLASSIC_LIKE = ['classic', 'portal', 'daily'];
    
    let powers = { shield: false, speed: false, invincible: false };
    let powerTimers = {};
    
    let loopInterval = null;
    let frameRequest = null;
    
    // Saved Data
    let records = { classic: 0, bullet: 0, tailgun: 0, survivor: 0, timeattack: 0, portal: 0, tron: 0, chaos: 0, daily: 0, tapinak: 0, dailyDate: '', top: {}, hay: null };
    let unlocked = {};
    let progress = { unlocked: 1, stars: {} };
    
    // Audio
    let audio = null, masterGain = null, fitDpr = null;
    let soundOn = true;
    
    // ======================== INIT ========================
    function init() {
        canvas = document.getElementById('gameCanvas');
        ctx = canvas.getContext('2d');
        document.body.classList.add('menu-acik');
        fitDpr = () => {
            const cssW = canvas.getBoundingClientRect().width || CONFIG.WIDTH;
            const nd = Math.min(4, Math.max(1, (window.devicePixelRatio || 1) * Math.max(1, cssW / CONFIG.WIDTH)));
            if (Math.abs(nd - dpr) < 0.05) return;
            dpr = nd;
            canvas.width = Math.round(CONFIG.WIDTH * dpr);
            canvas.height = Math.round(CONFIG.HEIGHT * dpr);
        };
        dpr = Math.min(2, window.devicePixelRatio || 1);
        let fitT = 0; // art arda resize olaylarını tek fitDpr'a indir
        window.addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(fitDpr, 50); });
        setTimeout(fitDpr, 0);
        canvas.width = CONFIG.WIDTH * dpr;
        canvas.height = CONFIG.HEIGHT * dpr;
        
        loadSavedData();
        try { soundOn = localStorage.getItem('twilightSound') !== '0'; } catch (e) {}
        loadSettings();
        refreshSoundBtn();
        refreshAchCount();
        refreshMenuStats();
        refreshMirasBtn();
        
        document.addEventListener('keydown', onKey);
        // Klavye erişimi: odaktaki mod kartı Enter/Space ile tıklanmış sayılır (iç düğmeler kendi davranışını korur)
        document.addEventListener('keydown', e => {
            const el = e.target;
            if (el && el.classList && el.classList.contains('mode-card') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); el.click(); }
        });
        // Odak kaybı: pencere arka plana düşerse oyun kendini duraklatır; dönüşte kullanıcı devam eder (P/Esc)
        window.addEventListener('blur', autoPause);
        document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); holdAudio(document.hidden); });
        window.addEventListener('blur', () => holdAudio(true));
        window.addEventListener('focus', () => holdAudio(document.hidden));
        setInterval(pollPads, 60);
        // Tıklamalar: satır içi onclick yok (CSP script-src 'self'); data-act ile tek dinleyici
        document.addEventListener('click', e => {
            const el = e.target.closest('[data-act]');
            if (!el) return;
            const act = el.dataset.act;
            if (act === 'ekToggle') { ekSet(el.dataset.key, !ek(el.dataset.key)); return; }
            if (act === 'toggle') { setSetting(el.dataset.key, !settings[el.dataset.key]); return; }
            if (act === 'mirasBuy') { mirasBuy(el.dataset.id); return; }
            if (act === 'marketBuy') { marketBuy(el.dataset.id); return; }
            if (act === 'marketEquip') { marketEquip(el.dataset.id); return; }
            if (act === 'marketSekme') { marketSekmeSec(el.dataset.id); return; }
            if (act === 'temaBuy') { temaBuy(el.dataset.id); return; }
            if (act === 'temaSec') { temaSec(el.dataset.id); return; }
            if (act === 'input') { input(Number(el.dataset.dx), Number(el.dataset.dy)); return; }
            if (Object.prototype.hasOwnProperty.call(PUBLIC, act) && typeof PUBLIC[act] === 'function') PUBLIC[act]();
        });
        // Dokunmatik yön/ateş: basar basmaz (click beklemeden); satır içi ontouchstart/onpointerdown CSP'ye takılıyordu
        document.addEventListener('pointerdown', e => {
            const el = e.target.closest('.dpad-btn[data-act="input"], [data-press]');
            if (!el) return;
            if (el.dataset.press === 'atil') { tapinakAtil(); return; }
            if (el.dataset.press === 'fire') { fire(); return; }
            input(Number(el.dataset.dx), Number(el.dataset.dy));
        });
        // Amblem yüklenemezse SVG logoya dön
        const em = document.getElementById('emblem');
        if (em) {
            const svg = em.nextElementSibling;
            const ok = () => svg.setAttribute('hidden', '');
            const fail = () => { em.hidden = true; svg.removeAttribute('hidden'); };
            if (em.complete) { (em.naturalWidth > 0 ? ok : fail)(); }
            em.addEventListener('load', ok);
            em.addEventListener('error', fail);
        }
        canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
        canvas.addEventListener('pointerdown', onCanvasClick);
    }
    
    // ======================== SCREEN NAVIGATION ========================
    function showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        const menuMu = id === 'menuScreen' || id === 'modesScreen';
        document.body.classList.toggle('menu-acik', menuMu);
        document.body.classList.toggle('oyun-acik', !menuMu);
    }
    
    function showMenu() {
        stopGame();
        clearPowerTimers();
        stopMusic();
        closeOverlays();
        refreshMenuStats();
        showScreen('menuScreen');
    }
    
    function showLevels() {
        stopGame();
        closeOverlays();
        buildLevelGrid();
        showScreen('levelScreen');
    }
    
    function showModes() {
        stopGame();
        closeOverlays();
        refreshMenuStats();
        showScreen('modesScreen');
    }

    function showGame() {
        closeOverlays();
        showScreen('gameScreen');
    }
    
    function closeOverlays() {
        ['pauseOverlay', 'gameoverOverlay', 'completeOverlay'].forEach(id => {
            document.getElementById(id).classList.remove('active');
        });
    }
    
    function refreshMenuStats() {
        document.getElementById('menuClassicHigh').textContent = records.classic;
        document.getElementById('menuBulletHigh').textContent = records.bullet;
        document.getElementById('menuTailHigh').textContent = records.tailgun;
        document.getElementById('menuSurvHigh').textContent = records.survivor;
        rollDaily();
        [['menuTimeHigh', 'timeattack'], ['menuPortalHigh', 'portal'], ['menuTronHigh', 'tron'], ['menuChaosHigh', 'chaos'], ['menuDailyHigh', 'daily'], ['menuTapinakHigh', 'tapinak']].forEach(([id, k]) => {
            const el = document.getElementById(id); if (el) el.textContent = records[k];
        });
        document.getElementById('menuProgress').textContent = Math.max(0, progress.unlocked - 1);
    }
    
    // Arayüz ikonları: index.html'deki SVG sprite'ından (yazı tipine bağımlı değil)
    function ikon(ad, sinif) { return '<svg class="ik ' + (sinif || '') + '" aria-hidden="true" focusable="false"><use href="#i-' + ad + '"/></svg>'; }
    function yildizlar(n, toplam) {
        let h = '';
        for (let i = 0; i < toplam; i++) h += ikon('star', 'yildiz' + (i < n ? ' on' : ''));
        return h;
    }
    function buildLevelGrid() {
        const grid = document.getElementById('levelsGrid');
        grid.innerHTML = '';
        
        for (let i = 1; i <= 30; i++) {
            const btn = document.createElement('button');
            btn.className = 'level-btn';
            
            if (i <= progress.unlocked) {
                btn.innerHTML = `<span class="level-no">${i}</span>`;
                const yn = progress.stars[i] || 0;
                
                const starsEl = document.createElement('div');
                starsEl.className = 'level-stars';
                starsEl.innerHTML = yildizlar(yn, 3);
                btn.appendChild(starsEl);
                btn.setAttribute('aria-label', 'Bölüm ' + i + (yn ? ', ' + yn + ' yıldız' : (i === progress.unlocked ? ', sıradaki' : '')));
                
                if (i < progress.unlocked) btn.classList.add('completed');
                else btn.classList.add('current');
                
                // Difficulty indicator
                const diffLevel = Math.ceil(i / 10);
                const diffEl = document.createElement('div');
                diffEl.className = 'level-diff';
                for (let d = 1; d <= 3; d++) {
                    const pip = document.createElement('span');
                    pip.className = 'diff-pip' + (d <= diffLevel ? ' active' : '');
                    diffEl.appendChild(pip);
                }
                btn.appendChild(diffEl);
                
                btn.onclick = () => startCampaign(i);
            } else {
                btn.innerHTML = ikon('lock', 'kilit');
                btn.classList.add('locked');
                btn.setAttribute('aria-disabled', 'true');
                btn.setAttribute('aria-label', 'Bölüm ' + i + ', kilitli');
            }
            
            grid.appendChild(btn);
        }
    }
    
    // ======================== GAME START ========================
    function startClassic() {
        document.getElementById('fireBtn').style.display = 'none';
        state.mode = 'classic';
        state.lives = 1;
        state.speed = CONFIG.BASE_SPEED;
        state.speedLv = 0;
        
        document.getElementById('hudHighBox').style.display = '';
        document.getElementById('hudLevelBox').style.display = '';
        document.getElementById('hudLevelLabel').textContent = 'HIZ';
        document.getElementById('hudLevel').textContent = '1';
        document.getElementById('hudTargetBox').style.display = 'none';
        document.getElementById('hudLivesBox').style.display = 'none';
        document.getElementById('hudHigh').textContent = records.classic;
        
        initGameState();
        showGame();
        beginLoop();
        playSound('start');
    }
    
    function startBullet() {
        document.getElementById('fireBtn').style.display = 'none';
        state.mode = 'bullet';
        state.lives = 3;
        state.speed = 115;
        
        document.getElementById('hudHighBox').style.display = '';
        document.getElementById('hudLevelBox').style.display = '';
        document.getElementById('hudLevelLabel').textContent = 'DALGA';
        document.getElementById('hudTargetBox').style.display = 'none';
        document.getElementById('hudLivesBox').style.display = '';
        document.getElementById('hudHigh').textContent = records.bullet;
        
        initGameState();
        document.getElementById('hudLevel').textContent = state.wave;
        showBanner('DALGA 1');
        showGame();
        beginLoop();
        playSound('start');
    }
    
    function startTailgun() {
        state.mode = 'tailgun';
        document.getElementById('fireBtn').style.display = '';
        state.lives = 3;
        state.speed = 115;
        
        document.getElementById('hudHighBox').style.display = '';
        document.getElementById('hudLevelBox').style.display = '';
        document.getElementById('hudLevelLabel').textContent = 'DALGA';
        document.getElementById('hudTargetBox').style.display = 'none';
        document.getElementById('hudLivesBox').style.display = '';
        document.getElementById('hudHigh').textContent = records.tailgun;
        
        initGameState();
        document.getElementById('hudLevel').textContent = state.wave;
        showBanner('BOŞLUK TUŞU: KUYRUKTAN ATEŞ');
        showGame();
        beginLoop();
        playSound('start');
    }
    
    function startCampaign(level) {
        document.getElementById('fireBtn').style.display = 'none';
        state.mode = 'campaign';
        state.level = level;
        state.lives = 3;
        state.speed = Math.max(45, 155 - level * 3.5);
        state.target = 5 + Math.floor(level * 1.2);
        
        document.getElementById('hudHighBox').style.display = 'none';
        document.getElementById('hudLevelBox').style.display = '';
        document.getElementById('hudLevelLabel').textContent = 'BÖLÜM';
        document.getElementById('hudTargetBox').style.display = '';
        document.getElementById('hudTargetLabel').textContent = 'HEDEF';
        document.getElementById('hudLivesBox').style.display = '';
        document.getElementById('hudLevel').textContent = level;
        
        initGameState();
        setupLevel(level);
        showGame();
        beginLoop();
        playSound('start');
    }
    
    function rollDaily() { // gün değişince önceki günün skoru saklanır, günlük rekor sıfırlanır
        const t = todayKey();
        if (records.dailyDate === t) return;
        if (records.daily > 0 && records.dailyDate) records.dailyPrev = { d: records.dailyDate, s: records.daily };
        records.dailyDate = t; records.daily = 0;
    }
    function dunkuSkor() { // "dün" = oyunun başladığı güne göre (gece yarısını aşan oyunda hedef değişmez)
        const p = records.dailyPrev;
        if (!p || !(p.s > 0)) return 0;
        const ref = (state.mode === 'daily' && state.dailyKey) ? state.dailyKey : todayKey();
        const [y, m, g] = ref.split('-').map(Number);
        const dunKey = dateKey(new Date(y, m - 1, g - 1)); // yerel saat; UTC (toISOString) kullanılmaz
        return p.d === dunKey ? p.s : 0;
    }
    function dateKey(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function todayKey() { return dateKey(new Date()); }
    
    function seededRand(key) {
        let h = 1779033703 ^ key.length;
        for (let i = 0; i < key.length; i++) {
            h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
            h = (h << 13) | (h >>> 19);
        }
        let a = h >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    
    function setHud(o) {
        const show = (id, on) => { document.getElementById(id).style.display = on ? '' : 'none'; };
        show('hudHighBox', o.high !== undefined);
        if (o.high !== undefined) document.getElementById('hudHigh').textContent = o.high;
        show('hudLevelBox', !!o.levelLabel);
        if (o.levelLabel) document.getElementById('hudLevelLabel').textContent = o.levelLabel;
        show('hudTargetBox', !!o.targetLabel);
        if (o.targetLabel) document.getElementById('hudTargetLabel').textContent = o.targetLabel;
        show('hudLivesBox', !!o.lives);
        document.getElementById('fireBtn').style.display = 'none';
    }
    
    function setSpeed(ms) {
        state.speed = ms;
        if (loopInterval) {
            clearInterval(loopInterval);
            loopInterval = setInterval(tick, effSpeed());
        }
    }
    
    function startSimple(mode, speed, hudOpts) {
        state.mode = mode;
        state.lives = 1;
        state.speed = speed;
        setHud(hudOpts);
        initGameState();
    }
    
    function startTimeAttack() {
        startSimple('timeattack', 105, { high: records.timeattack, targetLabel: 'SÜRE' });
        showBanner('60 SANİYE! YEMLER +SÜRE');
        showGame();
        beginLoop();
        playSound('start');
    }
    
    const MEVSIM_KURAL = [{ id: 'cifte', ad: 'HER 4. YEM x2' }, { id: 'bonus', ad: 'HER 6. YEM +3' }, { id: 'seri', ad: 'SERİ YEM +1' }];
    function startDaily() {
        setTimeout(() => unlockAch('gunluk'), 0);
        state.dailyKey = todayKey();
        rollDaily();
        const dun = dunkuSkor();
        startSimple('daily', CONFIG.BASE_SPEED, { high: records.daily, levelLabel: 'HIZ', targetLabel: dun ? 'DÜN' : undefined });
        document.getElementById('hudLevel').textContent = '1';
        if (dun) document.getElementById('hudTarget').textContent = dun;
        document.getElementById('hudTarget').classList.remove('gecildi');
        state.pacerDone = false;
        state.mevsim = ek('mevsim') ? MEVSIM_KURAL[Array.from(state.dailyKey).reduce((a, c) => a + c.charCodeAt(0), 0) % MEVSIM_KURAL.length] : null; // tarihe bağlı, rastgelelik tüketmez
        showBanner('GÜNLÜK ' + state.dailyKey.slice(5) + (dun ? ' · DÜN: ' + dun : '') + (state.mevsim ? ' · ' + state.mevsim.ad : ''));
        const midY = Math.floor(ROWS / 2);
        for (let i = 0; i < 9; i++) {
            for (let t = 0; t < 30; t++) {
                const pos = findEmpty();
                if (pos && !(Math.abs(pos.y - midY) <= 1 && pos.x < 14)) { obstacles.push(pos); break; }
            }
        }
        if (isOccupied(food.x, food.y) && obstacles.some(o => o.x === food.x && o.y === food.y)) spawnFood();
        engelCesit();
        showGame();
        beginLoop();
        playSound('start');
    }
    
    function placePortals() {
        const midY = Math.floor(ROWS / 2);
        const regions = [[2, 9, 12, 20], [12, 20, 23, 30]];
        portals = [];
        const colors = ['#ff9900', '#cc66ff'];
        regions.forEach((r, idx) => {
            const cells = [];
            for (let k = 0; k < 2; k++) {
                const [x0, x1] = k === 0 ? [r[0], r[1]] : [r[2], r[3]];
                for (let t = 0; t < 60; t++) {
                    const c = { x: x0 + Math.floor(Math.random() * (x1 - x0 + 1)), y: 2 + Math.floor(Math.random() * (ROWS - 4)) };
                    if (isOccupied(c.x, c.y)) continue;
                    if (x0 < 12 && Math.abs(c.y - midY) <= 1) continue;
                    if (cells.length && cells[0].x === c.x && cells[0].y === c.y) continue;
                    cells.push(c);
                    break;
                }
            }
            if (cells.length === 2) portals.push({ a: cells[0], b: cells[1], color: colors[idx] });
        });
    }
    
    function startPortal() {
        startSimple('portal', CONFIG.BASE_SPEED, { high: records.portal, levelLabel: 'HIZ' });
        document.getElementById('hudLevel').textContent = '1';
        // iki duvar, her birinde iki boşluk
        [11, 22].forEach(wx => {
            const gaps = [2 + Math.floor(Math.random() * 6), 14 + Math.floor(Math.random() * 6)];
            for (let y = 1; y < ROWS - 1; y++) {
                if (gaps.some(g => y >= g && y < g + 3)) continue;
                obstacles.push({ x: wx, y });
            }
        });
        engelCesit();
        placePortals();
        spawnFood();
        showBanner('PORTALLARDAN GEÇ!');
        showGame();
        beginLoop();
        playSound('start');
    }
    
    function startChaos() {
        startSimple('chaos', 120, { high: records.chaos, levelLabel: 'KURAL' });
        document.getElementById('hudLevel').textContent = '-';
        showBanner('KAOS: KURALLAR DEĞİŞİR');
        showGame();
        beginLoop();
        playSound('start');
    }
    
    function tronReset() {
        const midY = Math.floor(ROWS / 2);
        snake = [{ x: 5, y: midY }, { x: 4, y: midY }, { x: 3, y: midY }];
        dir = { x: 1, y: 0 };
        nextDir = { x: 1, y: 0 }; turnQ.length = 0;
        tron.ai = [{ x: COLS - 6, y: midY }, { x: COLS - 5, y: midY }, { x: COLS - 4, y: midY }];
        tron.aiDir = { x: -1, y: 0 };
        tron.p2Next = { x: -1, y: 0 };
        tron.gaps = new Set(); tron.gapN = 0; tron.enerji = 0; tron.sicra = false;
    }
    const TRON_HEDEF = 5; // 2 oyuncuda ilk 5 turu alan kazanır
    
    function startTron() {
        const twoP = !!settings.tron2p;
        startSimple('tron', 105, twoP ? { levelLabel: 'TUR', targetLabel: 'P1 - P2' } : { high: records.tron, levelLabel: 'TUR' });
        food = { x: -5, y: -5, type: 'normal' };
        tron.round = 1;
        tron.twoP = twoP;
        tron.p2Wins = 0;
        tronReset();
        document.getElementById('hudLevel').textContent = 1;
        if (twoP) document.getElementById('hudTarget').textContent = '0 - 0';
        showBanner(twoP ? 'P1: WASD   P2: OK TUŞLARI' : 'DÜŞMANI KAPAT!');
        showGame();
        beginLoop();
        playSound('start');
    }
    
    function initGameState() {
        document.body.dataset.mod = state.mode; // dokunmatik Atılım düğmesi yalnız tapınakta görünür (CSS)
        state.score = 0;
        state.paused = false;
        state.over = false;
        state.complete = false;
        state.running = true;
        
        const midY = Math.floor(ROWS / 2);
        snake = [
            { x: 5, y: midY },
            { x: 4, y: midY },
            { x: 3, y: midY }
        ];
        
        dir = { x: 1, y: 0 };
        nextDir = { x: 1, y: 0 }; turnQ.length = 0;
        
        obstacles = [];
        movingObs = [];
        bullets = [];
        powerups = [];
        bulletTimer = 0;
        patterns = [];
        lasers = [];
        boss = null;
        waveTick = 0;
        playerShots = [];
        enemies = [];
        shotCooldown = 0;
        state.wave = 1;
        banner = { text: '', until: 0 };
        food = null;
        portals = [];
        tron = { ai: [], aiDir: { x: -1, y: 0 }, round: 1, twoP: false, p2Next: { x: -1, y: 0 }, p2Wins: 0, gaps: new Set(), gapN: 0 };
        chaos = { rule: null, left: 0, next: 120, saved: 0, pending: null, kisa: '' };
        state.timeLeft = 60;
        state.ragnarok = false; state.kusursuz = 0; state.waveHit = false; state.rekorDone = false; state.ekYem = null; state.avSay = 0; state.svKill = 0; state.yemSay = 0; state.esikCool = 0; state.kabukLeft = 0; state.kabukHazir = false; state.takasCool = 0; state.yansitCool = 0; state.mevsim = null; state.tikSay = 0; state.mevsimSon = 0; state.isi = null; state.yanki = null; state.yemRenk = []; state.kapiLeft = 0; state.kapiRenk = null; state.cekimLeft = 0; state.sonYem = 0; state.seri = 0; state.yonler = []; state.grazeChain = 0; state.grazeLast = -999; // 0.9.6: Ragnarök dakikası, kusursuz dalga sayacı/bayrağı
        document.getElementById('hudTarget').classList.remove('ragnarok');
        state.bolumTik = 0;
        rand = state.mode === 'daily' ? seededRand(todayKey()) : Math.random;
        state.tohum = null; state.mayinlar = []; state.mayinCool = 0;
        state.hRec = []; state.hEat = []; state.hayGecti = false; state.hay = (state.mode === 'classic' && ek('hayalet') && records.hay) ? records.hay : null;
        if (state.mode === 'classic' && ek('tohum')) { // Tohum kodu: yalnız yem konumları bu akıştan gelir
            state.tohum = state.tohumSonraki || Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
            state.tohumSonraki = null;
            rand = seededRand('T' + state.tohum);
        }
        
        powers = { shield: false, speed: false, invincible: false };
        Object.values(powerTimers).forEach(t => clearTimeout(t));
        powerTimers = {};
        powerMeta = {};
        refreshPowerDisplay();
        
        applyMirasPerks();
        temaBaslat();
        spawnFood();
        updateHUD();
    }
    
    // Miras yetenekleri oyun başında (tron'da yok; Günlük'te adil kalsın diye yalnız can/kalkan/sakin)
    function applyMirasPerks() {
        state.calm = 0; state.istahAcc = 0; state.mirasSonuc = null; state.mirasVerildi = false;
        if (state.mode === 'tron') return;
        if (state.lives > 1) state.lives += Miras.value('can');
        const ks = Miras.value('kalkan');
        if (ks > 0) {
            powers.shield = true;
            armTimer('shield', ks * 1000, () => { powers.shield = false; refreshPowerDisplay(); });
            refreshPowerDisplay();
        }
        if (Miras.value('sakin') > 0) state.calm = 3;
    }
    
    function setupLevel(level) {
        // Static obstacles
        const obsCount = Math.floor(level / 1.5);
        for (let i = 0; i < Math.min(obsCount, 22); i++) {
            const pos = findEmpty();
            if (pos) obstacles.push(pos);
        }
        
        // Moving obstacles from level 8
        if (level >= 8) {
            const movCount = Math.min(Math.floor((level - 8) / 3) + 1, 7);
            for (let i = 0; i < movCount; i++) {
                const pos = findEmpty();
                if (pos) {
                    movingObs.push({
                        x: pos.x,
                        y: pos.y,
                        dx: (Math.random() > 0.5 ? 1 : -1) * (0.04 + level * 0.004),
                        dy: (Math.random() > 0.5 ? 1 : -1) * (0.04 + level * 0.004)
                    });
                }
            }
        }
        engelCesit(); // biyom engel çeşitleri (kendi tohumu; rand/Math.random tüketmez)
    }

    // Tema engel çeşitleri (src/engel.js): yalnız görsel/şekil; Bölüm'de ek küme/şerit, Günlük/Portal'da yalnız mevcut engeller etiketlenir
    function engelCesit() {
        if (typeof Engel === 'undefined') return;
        Engel.uret(obstacles, { tema: Tema.etkin(state.mode, state.level), COLS, ROWS, yilan: snake, yem: food, hareketli: movingObs, seviye: state.level, ek: state.mode === 'campaign', tohum: state.mode === 'daily' ? state.dailyKey : null });
    }
    
    // ======================== GAME LOOP ========================
    function beginLoop() {
        stopGame();
        state.running = true; // stopGame bayrağı düşürüyordu; döngü başlarken oyun gerçekten çalışıyor
        if (typeof fitDpr === 'function') fitDpr();
        loopInterval = setInterval(tick, effSpeed());
        renderFrame();
        startMusic();
    }
    
    // menüye dönüşte/yeni oyunda süreli güçlerin sahipsiz setTimeout'ları kalmasın
    function clearPowerTimers() {
        Object.values(powerTimers).forEach(t => clearTimeout(t));
        powerTimers = {};
        powerMeta = {};
    }
    
    function stopGame() {
        state.running = false;
        if (loopInterval) clearInterval(loopInterval);
        if (frameRequest) cancelAnimationFrame(frameRequest);
        loopInterval = null;
        frameRequest = null;
    }
    
    function startFx() {
        let n = 0;
        const loop = () => {
            if (++n > 100) return;
            draw();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
    
    function renderFrame() {
        if (frameRequest) cancelAnimationFrame(frameRequest); // togglePause devamında ikinci rAF döngüsü birikmesin
        frameRequest = null;
        if (!state.over && !state.complete) {
            draw();
            frameRequest = requestAnimationFrame(renderFrame);
        }
    }
    
    const RAGNAROK_SN = 10;
    function tick() {
        if (state.paused || state.over || state.complete) return;
        if (state.mode === 'survivor' && sv.choosing) return;
        
        prevSnake = snake.map(c => ({ x: c.x, y: c.y }));
        lastTickAt = performance.now();
        if (state.mode === 'tron') { tickTron(); return; }
        if (state.mode === 'tapinak') { tickTapinak(); return; }
        if (state.mode === 'timeattack') {
            state.timeLeft -= effSpeed() / 1000; // gerçek tik aralığı (hız ayarı/sakin dahil) = gerçek saniye
            if (state.timeLeft <= 0) { state.timeLeft = 0; updateHUD(); endGame(); return; }
            if (!state.ragnarok && state.timeLeft <= RAGNAROK_SN) { state.ragnarok = true; showBanner('RAGNARÖK! SKOR x2', true); playSound('powerup'); } // son 10 sn: kalıcı (yemle süre uzasa da sönmez)
            updateHUD();
        }
        
        if (state.mode === 'campaign') state.bolumTik++;
        if (!Tema.kaymaBekle(dir, nextDir)) { // Buzul: dönüş bir tik gecikir
            dir = { ...nextDir };
            if (turnQ.length) { const q = turnQ.shift(); if (!(q.x === -dir.x && q.y === -dir.y)) nextDir = q; } // dönüş tamponu: sıradaki dönüş bir sonraki tikte
        }
        if (state.mode === 'daily') { state.yonler.push({ ...dir }); if (state.yonler.length > 3) state.yonler.shift(); }
        
        let head = {
            x: snake[0].x + dir.x,
            y: snake[0].y + dir.y
        };
        
        if (state.mode === 'portal') {
            for (const p of portals) if (p.cool > 0) p.cool--; // soğuyan portal: kullanılan çift 8 tik uyur
            for (const p of portals) {
                if (p.cool > 0 && ek('soguyan')) continue;
                if (head.x === p.a.x && head.y === p.a.y) { head = { ...p.b }; playSound('powerup'); if (ek('soguyan')) p.cool = 8; if (ek('renkkapi')) { state.kapiLeft = 12; state.kapiRenk = p.color; } break; }
                if (head.x === p.b.x && head.y === p.b.y) { head = { ...p.a }; playSound('powerup'); if (ek('soguyan')) p.cool = 8; if (ek('renkkapi')) { state.kapiLeft = 12; state.kapiRenk = p.color; } break; }
            }
        }
        
        if (state.kapiLeft > 0) state.kapiLeft--;
        if (state.mode === 'daily') state.tikSay = (state.tikSay || 0) + 1;
        if (state.kabukLeft > 0) state.kabukLeft--;
        if (state.takasCool > 0) state.takasCool--;
        if (state.yansitCool > 0) state.yansitCool--;
        if (state.esikCool > 0) state.esikCool--;
        // Ölüm eşiği: ölümcül hamlede tik bir kez beklenir (60 tikte bir), oyuncu dönebilsin
        if (ek('olum') && state.esikCool <= 0 && ['classic', 'portal', 'timeattack'].includes(state.mode)
            && (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || snake.some(s => s.x === head.x && s.y === head.y) || obstacles.some(o => o.x === head.x && o.y === head.y))) {
            state.esikCool = 60; showBanner('SON ŞANS', false, 900, 'soluk');
            return;
        }
        // Wall collision
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
            damage();
            return;
        }
        
        // Self collision
        if (snake.some(s => s.x === head.x && s.y === head.y)) {
            damage();
            return;
        }
        
        // Static obstacle
        if (obstacles.some(o => o.x === head.x && o.y === head.y)) {
            damage();
            return;
        }
        
        // Tema: yanan lav hücresi (Lav Ocağı kuralı)
        if (Tema.tehlike(head.x, head.y)) { Tema.vurdu(); damage(); return; }
        
        // Moving obstacle
        for (const o of movingObs) {
            if (Math.abs(o.x - head.x) < 0.8 && Math.abs(o.y - head.y) < 0.8) {
                damage();
                return;
            }
        }
        
        snake.unshift(head);
        if (state.mode === 'classic' && ek('hayalet') && state.hRec.length < 5000) { state.hRec.push(head.y * COLS + head.x); hayaletKontrol(); }
        if (ek('isi')) { if (!state.isi) state.isi = new Uint16Array(COLS * ROWS); const ix = head.y * COLS + head.x; if (ix >= 0 && ix < state.isi.length && state.isi[ix] < 65535) state.isi[ix]++; }
        
        // Eat food
        if ((head.x === food.x && head.y === food.y) || magnetHit(head)) {
            eatFood();
        } else {
            snake.pop();
        }
        
        temaAdim(head);
        ekYemAdim(head);
        if (state.over) return;
        
        // Mode updates
        if (state.mode === 'bullet') {
            tickBullets();
            tickPowerups();
            checkBulletHit();
        }
        
        if (state.mode === 'tailgun') tickTailgun();
        if (state.mode === 'survivor') tickSurvivor();
        if (state.mode === 'chaos') tickChaos();
        
        if (state.mode === 'campaign') {
            tickMovingObs();
            if (state.score >= state.target) {
                winLevel();
            }
        }
        
        // Klasik benzeri modlarda hız kademesi: her 5 yemde bir, 1-10 (eski kod skor 5'in katıyken her tikte hızlanıyordu)
        if (CLASSIC_LIKE.includes(state.mode)) applySpeedLevel();
    }
    // Miras: Mıknatıs Kemer - yalnız klasik benzeri modlarda (Günlük hariç), yeme komşu hücreden çeker
    function magnetHit(head) {
        const k = Miras.value('miknatis');
        if (!k || state.mode === 'daily' || !CLASSIC_LIKE.includes(state.mode) || !food) return false;
        const dx = food.x - head.x, dy = food.y - head.y;
        if (Math.abs(dx) + Math.abs(dy) === 1) return true;
        if (k >= 2 && Math.abs(dx) === 1 && Math.abs(dy) === 1) return true;
        if (k >= 3 && dx === dir.x * 2 && dy === dir.y * 2) return true;
        return false;
    }
    function speedLevel() { return Math.min(10, 1 + Math.floor(state.score / 5)); }
    function applySpeedLevel() {
        const lv = speedLevel();
        if (lv === state.speedLv) return;
        state.speedLv = lv;
        setSpeed(Math.max(50, Math.round(CONFIG.BASE_SPEED * Math.pow(0.9, lv - 1)))); // geometrik: her kademe %10 (140 -> 54 ms)
        document.getElementById('hudLevel').textContent = lv;
        if (lv > 1) showBanner('HIZ ' + lv);
    }
    
    // ======================== DAMAGE & COLLISION ========================
    // Kabuk değiştirme: kuyruk 5 halkaya iner, 40 tik puan x2 (isteğe bağlı risk/ödül)
    function kabukAt() {
        for (let i = 5; i < snake.length; i++) burst(snake[i].x + 0.5, snake[i].y + 0.5, '#7ad7ff', 3, 0.8);
        snake.length = 5; prevSnake.length = Math.min(prevSnake.length, 5);
        state.kabukLeft = 40; state.kabukHazir = false;
        showBanner('KABUK DEĞİŞTİ x2', true, 1400, 'altin'); playSound('powerup'); addShake(3);
    }

    // Baş-kuyruk takası: çıkmaza girince yön tersine döner (120 tik bekleme)
    function takasYap() {
        snake.reverse();
        prevSnake = snake.map(c => ({ x: c.x, y: c.y }));
        const dx = Math.sign(snake[0].x - snake[1].x), dy = Math.sign(snake[0].y - snake[1].y);
        if (!dx && !dy) { snake.reverse(); return; }
        dir = { x: dx, y: dy }; nextDir = { x: dx, y: dy }; turnQ.length = 0;
        state.takasCool = 120;
        showBanner('TAKAS!', false, 900, 'soluk'); playSound('powerup'); burst(snake[0].x + 0.5, snake[0].y + 0.5, '#7ad7ff', 14, 1.2);
    }
    // Yansıtma halkası: önündeki en yakın mermiyi geri yansıtır, 1 kuyruk halkası harcar
    function yansitYap() {
        const h = snake[0];
        let best = null, bd = 6;
        bullets.forEach(b => {
            const fx = (b.x - h.x) * dir.x + (b.y - h.y) * dir.y; // baş yönünde ilerisi
            const d = Math.hypot(b.x - h.x, b.y - h.y);
            if (fx > -0.5 && d < bd) { bd = d; best = b; }
        });
        if (!best || snake.length <= 3) return;
        best.dx = -best.dx * 1.3; best.dy = -best.dy * 1.3; best.grazed = true; best.homing = false;
        snake.pop(); prevSnake.length = Math.min(prevSnake.length, snake.length);
        state.yansitCool = 40;
        showBanner('YANSITTI!', false, 800, 'soluk'); playSound('shield'); burst(best.x + 0.5, best.y + 0.5, '#7ad7ff', 14, 1.2);
    }

    function damage() {
        if (powers.invincible) return;
        state.waveHit = true; // kusursuz dalga: kalkan emse de vuruş sayılır
        
        if (powers.shield) {
            powers.shield = false;
            refreshPowerDisplay();
            playSound('shield');
            flashCanvas('#00ccff');
            return;
        }
        
        state.lives--;
        updateHUD();
        playSound('hit');
        burst(snake[0].x + 0.5, snake[0].y + 0.5, '#ff2244', 26, 1.4);
        addShake(7);
        isikOlay('hasar');
        
        if (state.lives <= 0) {
            endGame();
        } else {
            // Respawn
            const midY = Math.floor(ROWS / 2);
            snake = [
                { x: 5, y: midY },
                { x: 4, y: midY },
                { x: 3, y: midY }
            ];
            dir = { x: 1, y: 0 };
            nextDir = { x: 1, y: 0 }; turnQ.length = 0;
            
            // Temp invincibility
            powers.invincible = true;
            refreshPowerDisplay();
            // armTimer: yeni oyunda/menüde temizlenir, seviye seçiminde durur (eskiden sahipsiz setTimeout'tu)
            armTimer('invincible', 2000, () => {
                powers.invincible = false;
                refreshPowerDisplay();
            });
            
            flashCanvas('#ff0033');
        }
    }
    
    function flashCanvas(color) {
        canvas.style.boxShadow = `inset 0 0 100px ${color}`;
        setTimeout(() => canvas.style.boxShadow = '', 180);
    }
    
    // ======================== FOOD ========================
    function spawnFood() {
        const pos = findEmpty();
        if (!pos) {
            food = { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2), type: 'normal' };
            return;
        }
        const r = rand();
        // Kaos: ara sıra çürük yem (kural bozma ruhu); Bataklık teması da seyrek çürük yem getirir
        const bc = Tema.curukOran();
        food = { ...pos, age: 0, type: (state.mode === 'chaos' && r < 0.15) || r < bc ? 'curuk' : r < 0.12 + bc + (state.mode === 'chaos' ? 0.15 : 0) ? 'super' : 'normal' };
    }
    
    function eatFood() {
        if (typeof YilanAnim !== 'undefined' && food.type !== 'curuk' && ek('surunme')) YilanAnim.yedi(performance.now());
        if (food.type === 'curuk') {
            burst(food.x + 0.5, food.y + 0.5, '#7a4ea8', 16, 1.2);
            snake.splice(Math.max(3, snake.length - 3)); // yeni baş eklendi: büyüme yok + 2 halka kısalır, en az 3 kalır
            showBanner('ÇÜRÜK YEM! -2');
            playSound('hit');
            addShake(4);
            spawnFood();
            return;
        }
        let pts = food.type === 'super' ? 5 : 1;
        if (chaos.rule === 'triple') pts *= 3;
        pts = Tema.yemPuan(pts) * Tema.carpan() * (state.ragnarok ? 2 : 1); // Ragnarök x2 ile çarpılır (Rün x2 ile x4); Tema kuralları: Kaya +%50, Rün x2 (kural yoksa değişmez)
        if (state.mode !== 'daily' && state.mode !== 'tron') { // Miras: Altın İştah (kesirler birikir)
            state.istahAcc = (state.istahAcc || 0) + pts * Miras.value('istah');
            const ek = Math.floor(state.istahAcc + 1e-9);
            state.istahAcc -= ek; pts += ek;
        }
        state.gulpAt = performance.now();
        burst(food.x + 0.5, food.y + 0.5, food.type === 'super' ? '#ffdd00' : '#ffbf2e', food.type === 'super' ? 22 : 12);
        if (state.mode === 'daily' && ek('kivrim') && state.yonler.length >= 3 && new Set(state.yonler.map(d => d.x + ',' + d.y)).size === 3) { // kıvrım: son 3 hareket 3 farklı yön
            pts *= 2; showBanner('KIVRIM x2'); burst(food.x + 0.5, food.y + 0.5, '#7ad7ff', 14, 1.2);
        }
        if (state.mode === 'portal' && state.kapiLeft > 0 && ek('renkkapi')) { pts *= 2; showBanner('KAPI x2'); state.kapiLeft = 0; }
        if (state.kabukLeft > 0 && ek('kabuk')) pts *= 2;
        if (state.mode === 'daily' && state.mevsim) { // Mevsim çarkı: rastgelelik tüketmez
            const n = state.yemSay + 1, id = state.mevsim.id, now = state.tikSay || 0;
            if (id === 'cifte' && n % 4 === 0) { pts *= 2; showBanner('MEVSİM x2'); }
            else if (id === 'bonus' && n % 6 === 0) { pts += 3; showBanner('MEVSİM +3'); }
            else if (id === 'seri' && state.mevsimSon > 0 && now - state.mevsimSon <= 12) { pts += 1; showBanner('MEVSİM SERİ +1'); }
            state.mevsimSon = now;
        }
        state.score += pts;
        rekorKontrol();
        state.yemSay++;
        if (state.hEat && state.mode === 'classic' && state.hEat.length < 500) state.hEat.push(state.hRec.length);
        if (state.mode === 'classic' && ek('kabuk') && snake.length >= 30 && !state.kabukHazir) { state.kabukHazir = true; showBanner('KABUK HAZIR: K', false, 1500, 'soluk'); }
        if (ek('kuyrukrenk')) { state.yemRenk.unshift(food.type === 'super' ? '#ffdd00' : '#ff7a45'); if (state.yemRenk.length > 10) state.yemRenk.pop(); }
        if (state.mode === 'classic' && ek('yanki') && !state.yanki) state.yanki = { x: food.x, y: food.y, wait: 4, left: 4 };
        if (state.mode === 'classic' && ek('zbonus') && state.yemSay % 5 === 0 && !state.ekYem) ekYemUret('bonus', 56);
        if (state.mode === 'timeattack') {
            state.timeLeft += food.type === 'super' ? 5 : 2;
            if (ek('zseri')) { // seri: 2 sn içinde art arda 3 yem +1 sn
                const now = performance.now();
                state.seri = now - state.sonYem <= 2000 ? state.seri + 1 : 1; state.sonYem = now;
                if (state.seri >= 3) { state.seri = 0; state.timeLeft += 1; showBanner('SERİ! +1 sn'); }
            }
        }
        if (state.mode === 'portal' && state.score % 5 === 0) placePortals();
        if (state.mode === 'daily' && !state.pacerDone) {
            const dun = dunkuSkor();
            if (dun && state.score > dun) {
                state.pacerDone = true; showBanner('DÜNKÜ SKORU GEÇTİN!', true); burst(food.x + 0.5, food.y + 0.5, '#e8c46a', 30, 1.8); playSound('ach');
                document.getElementById('hudTarget').classList.add('gecildi'); // HUD'daki DÜN kutusu kalıcı yeşile döner (reduced: animasyonsuz)
            }
        }
        if (state.calm > 0 && --state.calm === 0 && loopInterval) { clearInterval(loopInterval); loopInterval = setInterval(tick, effSpeed()); }
        updateHUD();
        playSound(food.type === 'super' ? 'supereat' : 'eat');
        checkAch('eat');
        if (state.mode === 'bullet' && boss) hurtBoss(food.type === 'super' ? 3 : 1);
        spawnFood();
    }
    
    // Rekor ışıltısı: kendi rekorunu (kayıtlıysa) bu oyunda ilk kez geçince; Günlük'ün dünkü skor çizgisi ayrıdır
    function rekorKontrol() {
        if (!ek('rekor') || state.rekorDone || state.mode === 'daily' || state.mode === 'tron') return;
        const rk = records[state.mode];
        if (typeof rk !== 'number' || rk <= 0 || state.score <= rk) return;
        state.rekorDone = true;
        showBanner('YENİ REKOR!', true, 1500, 'altin'); playSound('ach');
        const h = snake[0]; burst(h.x + 0.5, h.y + 0.5, '#e8c46a', 28, 1.6);
    }

    // Ek yem: tek yuvalı, süreli (Klasik bonus yıldızı, Kaos çekim yemi); ana yemden bağımsız, sayacı bitince kendiliğinden kaybolur
    function ekYemUret(tur, ms) {
        const pos = findEmpty();
        if (!pos || (food && pos.x === food.x && pos.y === food.y)) return;
        state.ekYem = { x: pos.x, y: pos.y, left: ms, max: ms, tur };
        showBanner(tur === 'bonus' ? 'BONUS YEM!' : 'ÇEKİM YEMİ!', false, 1200, 'soluk');
    }
    function ekYemAdim(head) {
        if (state.cekimLeft > 0 && food) { // çekim: ana yem baş yönüne bir hücre kayar (boş hücreye)
            state.cekimLeft--;
            const dx = head.x - food.x, dy = head.y - food.y;
            const st = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
            const nx = food.x + st.x, ny = food.y + st.y;
            if ((st.x || st.y) && !snake.some(c => c.x === nx && c.y === ny) && !obstacles.some(o => o.x === nx && o.y === ny)) { food.x = nx; food.y = ny; }
        }
        const yk = state.yanki;
        if (yk) {
            if (yk.wait > 0) yk.wait--;
            else if (head.x === yk.x && head.y === yk.y) { state.yanki = null; state.score += 1; rekorKontrol(); updateHUD(); showBanner('YANKI +1', false, 900, 'soluk'); playSound('eat'); burst(yk.x + 0.5, yk.y + 0.5, '#cfd8ff', 12, 1.1); }
            else if (--yk.left <= 0) state.yanki = null;
        }
        const e = state.ekYem;
        if (!e) return;
        if (head.x === e.x && head.y === e.y) {
            state.ekYem = null;
            if (e.tur === 'bonus') {
                const p = 5 + Math.floor(e.left / 14); // erken yenirse 5..9
                state.score += p; rekorKontrol(); updateHUD(); showBanner('BONUS +' + p, true, 1300, 'altin'); playSound('supereat');
                burst(e.x + 0.5, e.y + 0.5, '#ffdd00', 24, 1.6);
            } else {
                state.cekimLeft = 8; showBanner('ÇEKİM!'); playSound('powerup'); burst(e.x + 0.5, e.y + 0.5, '#b07cff', 20, 1.4);
            }
            return;
        }
        if (--e.left <= 0) state.ekYem = null;
    }
    function drawEkYem() {
        const yk = state.yanki;
        if (yk && yk.wait <= 0) {
            const S = CONFIG.CELL, t = performance.now() / 1000;
            ctx.save(); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 8); ctx.strokeStyle = '#cfd8ff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(yk.x * S + S / 2, yk.y * S + S / 2, 7 + (4 - yk.left), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        const e = state.ekYem;
        if (!e) return;
        const S = CONFIG.CELL, t = performance.now() / 1000, cx = e.x * S + S / 2, cy = e.y * S + S / 2, k = e.left / e.max;
        if (e.tur === 'bonus' && G25()) G25().drawFood(ctx, { x: e.x, y: e.y, type: 'super' }, t, gfxOpts());
        else {
            const col = e.tur === 'bonus' ? '#ffdd00' : '#b07cff';
            ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fillStyle = col;
            ctx.beginPath(); ctx.arc(cx, cy, 7 + Math.sin(t * 6) * 1.2, 0, Math.PI * 2); ctx.fill();
            if (e.tur === 'cekim') { ctx.shadowBlur = 0; ctx.strokeStyle = '#ece0ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.stroke(); }
            ctx.restore();
        }
        ctx.save(); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = e.tur === 'bonus' ? '#e8c46a' : '#b07cff';
        ctx.globalAlpha = k < 0.25 && Math.floor(t * 8) % 2 ? 0.35 : 0.9;
        ctx.beginPath(); ctx.arc(cx, cy, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke(); ctx.restore();
    }

    // Güç halkası: aktif güçlendirmelerin kalan süresi (kalkan altın, hız mavi, yenilmezlik mor)
    const GUC_SURE = { shield: 12000, speed: 6500, invincible: 5000 };
    const GUC_RENK = { shield: '#e8c46a', speed: '#5ad2ff', invincible: '#c58bff' };
    // Alacakaranlık saati: skor arttıkça ekran kararır, baş çevresi aydınlık kalır (yalnız çizim)
    function hayaletKontrol() { // oyuncu, hayaletin aynı tikteki yem sayısını aşarsa bir kez haber verir
        const h = state.hay; if (!h || state.hayGecti) return;
        const t = state.hRec.length;
        if (state.hEat.length > h.e.filter(n => n <= t).length && h.e.length > 0) { state.hayGecti = true; showBanner('HAYALETİ GEÇTİN', false, 1400); }
    }
    function drawHayalet() {
        const h = state.hay; if (!h || !ek('hayalet') || state.mode !== 'classic') return;
        const t = Math.min(state.hRec.length, h.p.length - 1), S = CONFIG.CELL;
        ctx.save(); ctx.fillStyle = '#9fd8ff';
        for (let k = 0; k < 6; k++) { const i = t - k; if (i < 0) break; const c = h.p.charCodeAt(i) - 48; ctx.globalAlpha = 0.28 - k * 0.04; ctx.beginPath(); ctx.arc((c % COLS + 0.5) * S, (Math.floor(c / COLS) + 0.5) * S, S * (0.42 - k * 0.04), 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
    }
    function drawAlaca(rp) {
        if (!ek('alaca') || state.mode !== 'classic' || !rp || !rp[0]) return;
        const k = Math.min(1, state.score / 100) * 0.6;
        if (k < 0.02) return;
        const S = CONFIG.CELL, cx = (rp[0].x + 0.5) * S, cy = (rp[0].y + 0.5) * S;
        const g = ctx.createRadialGradient(cx, cy, S * 5, cx, cy, S * 24);
        g.addColorStop(0, 'rgba(6,8,22,0)'); g.addColorStop(1, 'rgba(6,8,22,' + k.toFixed(3) + ')');
        ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT); ctx.restore();
    }
    function drawGucHalka() {
        if (!ek('guc') || !snake.length) return;
        const S = CONFIG.CELL, h = snake[0], cx = h.x * S + S / 2, cy = h.y * S + S / 2;
        let r = S * 0.95;
        Object.keys(powerMeta).forEach(t => {
            if (!GUC_SURE[t]) return;
            const m = powerMeta[t], left = state.paused && m.left ? m.left : Math.max(0, m.end - Date.now()), k = Math.min(1, left / GUC_SURE[t]);
            ctx.save(); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = GUC_RENK[t]; ctx.globalAlpha = k < 0.2 && Math.floor(performance.now() / 120) % 2 ? 0.3 : 0.85;
            ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke(); ctx.restore();
            r += 4;
        });
    }

    function findEmpty() {
        for (let i = 0; i < 100; i++) {
            const pos = {
                x: Math.floor(rand() * (COLS - 4)) + 2,
                y: Math.floor(rand() * (ROWS - 4)) + 2
            };
            if (!isOccupied(pos.x, pos.y)) return pos;
        }
        return null;
    }
    
    function isOccupied(x, y) {
        if (snake.some(s => s.x === x && s.y === y)) return true;
        if (obstacles.some(o => o.x === x && o.y === y)) return true;
        if (food && food.x === x && food.y === y) return true;
        if (portals.some(p => (p.a.x === x && p.a.y === y) || (p.b.x === x && p.b.y === y))) return true;
        return false;
    }
    
    // ======================== BULLETS ========================
    function showBanner(text, onemli, ms, stil) { // onemli: süresi dolana dek sıradan bir afiş (ör. 'HIZ 2') üstüne yazamaz
        if (!onemli && banner.onemli && performance.now() < banner.until) return;
        banner = { text, until: performance.now() + (ms || 1600), onemli: !!onemli, stil: stil || '' };
    }

    // ======================== TEMA KURALLARI (src/tema.js) ========================
    // Oyun başında: kural temasını kur ve başlangıç afişini sıraya al (mod afişi bitince 2 sn gösterilir)
    function temaBaslat() {
        tmHiz = 1; tmBekle = null;
        const kuralId = Tema.baslat(state.mode, state.level);
        if (state.mode === 'tapinak') return;
        const tema = Tema.etkin(state.mode, state.level);
        // Taş + Otomatik'te afiş yok (eski oyun); açık seçimde ya da kural varsa tema adı
        if (kuralId || (Tema.secili() !== Tema.OTOMATIK && tema !== 'tas')) tmBekle = Tema.afis(tema, !!kuralId);
    }
    function temaEnv() {
        return { COLS, ROWS, bos: (x, y) => !isOccupied(x, y) && !movingObs.some(o => Math.abs(o.x - x) < 1.2 && Math.abs(o.y - y) < 1.2), rand: Math.random, bas: snake[0], yon: dir };
    }
    function temaAralik() { // çamur: tik aralığını yeniden kur
        if (loopInterval) { clearInterval(loopInterval); loopInterval = setInterval(tick, effSpeed()); }
    }
    // Her tikte (baş hareket ettikten sonra): kural zamanlayıcısı, lav/rün olayları, çamur yavaşlığı
    function temaAdim(head) {
        if (!Tema.aktif()) return;
        const ev = Tema.adim(effSpeed(), temaEnv());
        ev.forEach(e => {
            if (e === 'uyari') { showBanner('LAV: TURUNCU HÜCRELER YANACAK!', false, 1400); playSound('shield'); }
            else if (e === 'yanik') { addShake(4); playSound('hit'); isikOlay('sok', head.x + 0.5, head.y + 0.5, '#ff6a2a'); }
            else if (e === 'run') { showBanner('RÜN! 5 SN SKOR x2', false, 1400); playSound('powerup'); isikOlay('guc', head.x + 0.5, head.y + 0.5, '#7af0e8'); }
        });
        if (Tema.tehlike(head.x, head.y)) { Tema.vurdu(); damage(); return; } // yanış tam başın altında başladıysa
        const hz = Tema.hizCarpan(head);
        if (hz !== tmHiz) { tmHiz = hz; temaAralik(); }
    }
    
    function rnd(a, b) { return a + Math.random() * (b - a); }
    
    function emitBullet(x, y, ang, spd, color) {
        bullets.push({ x, y, dx: Math.cos(ang) * spd, dy: Math.sin(ang) * spd, homing: false, color, grazed: false });
    }
    
    function tickBullets() {
        tickWaves();
        
        // seyrek rastgele mermi (dalga arttıkça artar)
        bulletTimer++;
        const rate = Math.max(18, 60 - state.wave * 4);
        if (bulletTimer >= rate) {
            bulletTimer = 0;
            spawnBullet();
        }
        
        const head = snake[0];
        bullets = bullets.filter(b => {
            b.x += b.dx;
            b.y += b.dy;
            
            if (b.homing && Math.random() < 0.07) {
                const ang = Math.atan2(head.y - b.y, head.x - b.x);
                b.dx += Math.cos(ang) * 0.012;
                b.dy += Math.sin(ang) * 0.012;
                const spd = Math.hypot(b.dx, b.dy);
                if (spd > 0.32) {
                    b.dx = (b.dx / spd) * 0.32;
                    b.dy = (b.dy / spd) * 0.32;
                }
            }
            
            // yakın geçiş (graze) puanı
            if (!b.grazed && Math.hypot(head.x - b.x, head.y - b.y) < 1.8) {
                b.grazed = true;
                if (ek('vizz')) playSound('graze');
                if (!powers.invincible) {
                    let g = 1;
                    if (ek('siyrilma')) { // zincir: 90 tik içinde art arda sıyrılma x2, x3 puan
                        state.grazeChain = waveTick - state.grazeLast <= 90 ? state.grazeChain + 1 : 1;
                        state.grazeLast = waveTick; g = Math.min(3, state.grazeChain);
                        if (g > 1) showBanner('SIYRILMA x' + g);
                    }
                    state.score += g;
                    updateHUD();
                }
            }
            
            return b.x >= -3 && b.x <= COLS + 3 && b.y >= -3 && b.y <= ROWS + 3;
        });
        
        if (Math.random() < 0.006) spawnPowerup();
    }
    
    function spawnBullet() {
        const side = Math.floor(Math.random() * 4);
        const b = { x: 0, y: 0, dx: 0, dy: 0, homing: false, grazed: false };
        const spd = Math.min(0.3, 0.15 + state.wave * 0.012);
        
        switch (side) {
            case 0: b.x = Math.random() * COLS; b.y = -1; b.dy = spd + Math.random() * 0.08; b.dx = (Math.random() - 0.5) * 0.12; break;
            case 1: b.x = Math.random() * COLS; b.y = ROWS; b.dy = -(spd + Math.random() * 0.08); b.dx = (Math.random() - 0.5) * 0.12; break;
            case 2: b.x = -1; b.y = Math.random() * ROWS; b.dx = spd + Math.random() * 0.08; b.dy = (Math.random() - 0.5) * 0.12; break;
            default: b.x = COLS; b.y = Math.random() * ROWS; b.dx = -(spd + Math.random() * 0.08); b.dy = (Math.random() - 0.5) * 0.12; break;
        }
        
        if (state.wave >= 3 && Math.random() < 0.18) b.homing = true;
        bullets.push(b);
    }
    
    // ---- dalgalar ve desenler ----
    const WAVE_TICKS = 150;
    
    function tickWaves() {
        waveTick++;
        
        if (!boss && waveTick % WAVE_TICKS === 0) {
            const biten = state.wave, kusursuz = !state.waveHit;
            state.wave++; state.waveHit = false;
            document.getElementById('hudLevel').textContent = state.wave;
            if (state.wave % 5 === 0) {
                spawnBoss();
            } else {
                showBanner('DALGA ' + state.wave);
            }
            if (kusursuz) { // hasarsız dalga: dalga no x5 puan (sıyrılma +1 ayrıdır)
                state.kusursuz++; state.score += biten * 5; updateHUD();
                showBanner('KUSURSUZ! +' + biten * 5, true, 1800, 'altin'); playSound('ach');
            }
        }
        
        if (boss) {
            tickBoss();
        } else {
            const gap = Math.max(26, 72 - state.wave * 4);
            if (waveTick % gap === 0) startPattern(pickPattern());
        }
        
        patterns = patterns.filter(stepPattern);
        lasers = lasers.filter(l => { l.t++; return l.t < l.warn + l.live; });
    }
    
    function pickPattern() {
        const pool = ['aimed', 'rain'];
        if (state.wave >= 2) pool.push('ring');
        if (state.wave >= 3) pool.push('spiral');
        if (state.wave >= 4) pool.push('laser');
        return pool[Math.floor(Math.random() * pool.length)];
    }
    
    function turretPos() {
        const spots = [
            { x: COLS / 2, y: 2.5 }, { x: COLS / 2, y: ROWS - 3.5 },
            { x: 2.5, y: ROWS / 2 }, { x: COLS - 3.5, y: ROWS / 2 }
        ];
        return spots[Math.floor(Math.random() * spots.length)];
    }
    
    function startPattern(type) {
        const spd = Math.min(0.34, 0.17 + state.wave * 0.008);
        
        if (type === 'spiral') {
            const t = turretPos();
            patterns.push({ x: t.x, y: t.y, t: 0, warn: 10, n: 0, run(p) {
                emitBullet(p.x, p.y, p.n * 0.5, spd, '#ff3df0');
                emitBullet(p.x, p.y, p.n * 0.5 + Math.PI, spd, '#ff3df0');
                p.n++;
                return p.n >= 34;
            }});
        } else if (type === 'ring') {
            const t = turretPos();
            const count = Math.min(24, 14 + state.wave);
            patterns.push({ x: t.x, y: t.y, t: 0, warn: 10, n: 0, run(p) {
                if ((p.t - p.warn) % 12 === 1) {
                    const off = p.n * (Math.PI / count);
                    for (let i = 0; i < count; i++) emitBullet(p.x, p.y, off + (i / count) * Math.PI * 2, spd * 0.9, '#ffd400');
                    p.n++;
                }
                return p.n >= 3;
            }});
        } else if (type === 'aimed') {
            const t = turretPos();
            patterns.push({ x: t.x, y: t.y, t: 0, warn: 6, n: 0, run(p) {
                if ((p.t - p.warn) % 8 === 1) {
                    const h = snake[0];
                    const a = Math.atan2(h.y - p.y, h.x - p.x);
                    for (const d of [-0.22, 0, 0.22]) emitBullet(p.x, p.y, a + d, spd + 0.04, '#ff7a00');
                    p.n++;
                }
                return p.n >= 3;
            }});
        } else if (type === 'laser') {
            const n = Math.min(3, 1 + Math.floor(state.wave / 4));
            const h = snake[0];
            for (let i = 0; i < n; i++) {
                const horizontal = Math.random() < 0.5;
                const idx = horizontal
                    ? Math.max(0, Math.min(ROWS - 1, Math.round(h.y + rnd(-6, 6))))
                    : Math.max(0, Math.min(COLS - 1, Math.round(h.x + rnd(-8, 8))));
                lasers.push({ horizontal, idx, t: 0, warn: 12, live: 5 });
            }
        } else {
            // rain: bir kenardan sıralı mermi perdesi
            const vertical = Math.random() < 0.5;
            const gapAt = Math.floor(rnd(2, (vertical ? COLS : ROWS) - 2));
            const len = vertical ? COLS : ROWS;
            for (let i = 0; i < len; i += 2) {
                if (Math.abs(i - gapAt) <= 2) continue;
                if (vertical) bullets.push({ x: i, y: -1, dx: 0, dy: spd, homing: false, color: '#00e5ff', grazed: false });
                else bullets.push({ x: -1, y: i, dx: spd, dy: 0, homing: false, color: '#00e5ff', grazed: false });
            }
        }
    }
    
    function stepPattern(p) {
        p.t++;
        if (p.t <= p.warn) return true;
        return !p.run(p);
    }
    
    // ---- patron ----
    function spawnBoss() {
        const hp = 8 + state.wave;
        boss = { x: COLS / 2, y: 2.5, hp, max: hp, t: 0, hit: 0 };
        bullets = [];
        patterns = [];
        showBanner('PATRON! YEM YE, CANINI AZALT');
        playSound('start');
    }
    
    function tickBoss() {
        boss.t++;
        if (boss.hit > 0) boss.hit--;
        boss.x = COLS / 2 + Math.sin(boss.t * 0.04) * (COLS / 3);
        const spd = Math.min(0.28, 0.17 + state.wave * 0.006);
        const rage = boss.hp <= boss.max / 2;
        
        if (boss.t % 44 === 0) {
            const count = rage ? 22 : 16;
            for (let i = 0; i < count; i++) emitBullet(boss.x, boss.y, (i / count) * Math.PI * 2 + boss.t * 0.01, spd * 0.9, '#ffd400');
        }
        if (rage && boss.t % 5 === 0) emitBullet(boss.x, boss.y, boss.t * 0.35, spd, '#ff3df0');
        if (boss.t % 100 === 50) {
            const h = snake[0];
            const a = Math.atan2(h.y - boss.y, h.x - boss.x);
            for (const d of [-0.3, -0.15, 0, 0.15, 0.3]) emitBullet(boss.x, boss.y, a + d, spd + 0.05, '#ff7a00');
        }
        if (boss.t % 120 === 90) {
            const h = snake[0];
            lasers.push({ horizontal: false, idx: Math.max(0, Math.min(COLS - 1, Math.round(h.x))), t: 0, warn: 12, live: 5 });
        }
        
        if (boss.t > 700) {
            boss = null;
            bullets = [];
            showBanner('PATRON KAÇTI');
        }
    }
    
    function hurtBoss(dmg) {
        boss.hp -= dmg;
        boss.hit = 6;
        if (boss.hp <= 0) {
            boss = null;
            bullets = [];
            patterns = [];
            lasers = [];
            state.score += 25;
            updateHUD();
            activatePower('shield');
            flashCanvas('#ffd400');
            showBanner('PATRON YENİLDİ +25');
            unlockAch('boss');
            playSound('complete');
        }
    }
    
    function checkBulletHit() {
        if (powers.invincible) return;
        
        const head = snake[0];
        for (const l of lasers) {
            if (l.t < l.warn) continue;
            if (l.horizontal ? head.y === l.idx : head.x === l.idx) {
                damage();
                return;
            }
        }
        for (const b of bullets) {
            if (Math.hypot(head.x - b.x, head.y - b.y) < 1.05) {
                damage();
                return;
            }
        }
    }
    
    // ---- çizim ----
    function drawBulletLayer() {
        const CELL = CONFIG.CELL;
        const now = performance.now();
        
        // taret uyarıları
        patterns.forEach(p => {
            if (p.t > p.warn) return;
            const r = 8 + Math.abs(Math.sin(now / 90)) * 6;
            ctx.strokeStyle = '#ff3355';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x * CELL + CELL / 2, p.y * CELL + CELL / 2, r, 0, Math.PI * 2);
            ctx.stroke();
        });
        
        // lazerler
        lasers.forEach(l => {
            const live = l.t >= l.warn;
            // Yıldırım: uyarıda soluk buz mavisi çizgi, canlıyken beyaz çekirdekli şimşek bandı
            const rx = l.horizontal ? 0 : l.idx * CELL + (live ? 2 : 8);
            const ry = l.horizontal ? l.idx * CELL + (live ? 2 : 8) : 0;
            const rw = l.horizontal ? CONFIG.WIDTH : (live ? CELL - 4 : 4);
            const rh = l.horizontal ? (live ? CELL - 4 : 4) : CONFIG.HEIGHT;
            ctx.fillStyle = live ? 'rgba(120,190,255,0.85)' : 'rgba(120,190,255,' + (0.12 + 0.12 * Math.abs(Math.sin(now / 70))) + ')';
            ctx.shadowColor = '#7ec8ff';
            ctx.shadowBlur = live ? 20 : 0;
            ctx.fillRect(rx, ry, rw, rh);
            ctx.shadowBlur = 0;
            if (live) {
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                if (l.horizontal) ctx.fillRect(0, ry + rh / 2 - 1.5, CONFIG.WIDTH, 3);
                else ctx.fillRect(rx + rw / 2 - 1.5, 0, 3, CONFIG.HEIGHT);
            }
        });
        
        // patron
        if (boss) {
            const bx = boss.x * CELL - CELL, by = boss.y * CELL - CELL;
            // Jörmungandr: kor gözlü deniz yılanı başı
            const bcx = bx + CELL * 1.5, bcy = by + CELL * 1.5;
            const bt = now / 1000;
            ctx.shadowColor = '#3ad6c0';
            ctx.shadowBlur = 20;
            const bg = ctx.createRadialGradient(bcx - 8, bcy - 8, 4, bcx, bcy, CELL * 2);
            bg.addColorStop(0, boss.hit > 0 ? '#ffffff' : '#2fa89a');
            bg.addColorStop(1, boss.hit > 0 ? '#ffd6d6' : '#0b3b46');
            ctx.fillStyle = bg;
            ctx.beginPath();
            ctx.ellipse(bcx, bcy, CELL * 1.55, CELL * 1.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(255,208,100,0.75)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(bcx, bcy, CELL * 1.55, CELL * 1.4, 0, 0, Math.PI * 2);
            ctx.stroke();
            for (let k = -2; k <= 2; k++) {
                ctx.beginPath();
                ctx.arc(bcx + k * 9, bcy - 17, 4, Math.PI, 0);
                ctx.stroke();
            }
            [-1, 1].forEach(sd => {
                ctx.shadowColor = '#ff6a00';
                ctx.shadowBlur = 14;
                ctx.fillStyle = '#ffb347';
                ctx.beginPath();
                ctx.ellipse(bcx + sd * 12, bcy - 3, 5.5, 4, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#1a0800';
                ctx.fillRect(bcx + sd * 12 - 1, bcy - 7, 2, 8);
            });
            if (Math.sin(bt * 3) > 0.2) {
                ctx.strokeStyle = '#ff4466';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(bcx, bcy + 14);
                ctx.lineTo(bcx, bcy + 24);
                ctx.moveTo(bcx, bcy + 24);
                ctx.lineTo(bcx - 5, bcy + 29);
                ctx.moveTo(bcx, bcy + 24);
                ctx.lineTo(bcx + 5, bcy + 29);
                ctx.stroke();
            }
            // can çubuğu
            ctx.fillStyle = '#0d1424';
            ctx.fillRect(40, CONFIG.HEIGHT - 12, CONFIG.WIDTH - 80, 6);
            ctx.fillStyle = '#ffb347';
            ctx.fillRect(40, CONFIG.HEIGHT - 12, (CONFIG.WIDTH - 80) * Math.max(0, boss.hp) / boss.max, 6);
        }
    }
    
    function drawBanner() {
        if (performance.now() > banner.until) return;
        ctx.save();
        ctx.font = '18px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        const soluk = banner.stil === 'soluk', altin = banner.stil === 'altin';
        if (soluk) ctx.globalAlpha = 0.72; // ön uyarı/ipucu: soluk yazı
        ctx.fillStyle = altin ? '#ffe27a' : '#fff';
        ctx.shadowColor = altin ? (settings.cb ? PALET.yem : '#ffb300') : '#00ff66';
        ctx.shadowBlur = soluk ? 0 : 14;
        ctx.fillText((altin ? '★ ' : '') + banner.text + (altin ? ' ★' : ''), CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 90, CONFIG.WIDTH - 40);
        ctx.restore();
    }

            // ======================== KUYRUK SİLAHI ========================
    function fire() {
        if (state.mode === 'tapinak') { tapinakAtes(); return; }
        if (state.mode !== 'tailgun' || state.paused || state.over || state.complete) return;
        if (snake.length <= 3 || shotCooldown > 0) return;
        const tail = snake.pop();
        const h = snake[0];
        playerShots.push({ x: h.x, y: h.y, dx: dir.x, dy: dir.y, from: tail });
        shotCooldown = 3;
        playSound('shield');
    }
    
    // Saf Survivor/düşman mantığı src/core/survivor.js içinde (window.YilanCore.survivor)
    const SvCore = window.YilanCore.survivor;
    function spawnEnemy() { SvCore.spawnEnemy(enemies, state.wave, COLS, ROWS, Math.random); }
    
    // oyuncu mermileri: 3 alt adımda ilerler, her adımda çarpışma bakar
    function moveShots(onKill) {
        const r = SvCore.moveShots(playerShots, enemies, COLS, ROWS, onKill);
        playerShots = r.shots;
        enemies = r.enemies;
    }
    // Survivor: Rust/wasm çekirdeği (src/core/survivor-wasm.js) hazırsa mermi/çarpışma ve kafa çarpması onunla; sonuç JS ile
    // birebir aynı (test/survivor-wasm.test.js), ölçümde ~2-3 kat hızlı (core/test/bench-survivor.js). Yüklenmediyse, ?js=1
    // ya da girdi geçersizse (null) JS yedeği. moveEnemies JS'te kalır (wasm'da daha yavaş ölçüldü). Geri almak için
    // tickSurvivor'da svMoveShots -> moveShots, svHeadHit(head) -> SvCore.headHit(enemies, head) yeter.
    function svMoveShots(onKill) {
        const W = window.YilanCore.svWasm;
        const r = W ? W.moveShots(playerShots, enemies, COLS, ROWS, onKill) : null;
        if (!r) return moveShots(onKill);
        playerShots = r.shots;
        enemies = r.enemies;
    }
    function svHeadHit(head) {
        const W = window.YilanCore.svWasm;
        const i = W ? W.headHit(enemies, head) : null;
        return i === null ? SvCore.headHit(enemies, head) : i;
    }

    function tickTailgun() {
        waveTick++;
        if (shotCooldown > 0) shotCooldown--;
        if (waveTick % 200 === 0) {
            state.wave++;
            document.getElementById('hudLevel').textContent = state.wave;
            showBanner('DALGA ' + state.wave);
        }
        
        const gap = Math.max(14, 42 - state.wave * 3);
        if (waveTick % gap === 0) spawnEnemy();
        
        const head = snake[0];
        const espd = Math.min(0.2, 0.09 + state.wave * 0.008);
        
        moveShots(() => {
            state.score += 2;
            updateHUD();
            playSound('eat');
            if (ek('avpayi') && ++state.avSay % 3 === 0) { // av payı: her 3. vuruşta bir kuyruk halkası geri gelir
                snake.push({ ...snake[snake.length - 1] }); showBanner('AV PAYI +1', false, 1000, 'soluk');
            }
        });
        enemies = enemies.filter(e => e.hp > 0);
        
        enemies.forEach(e => {
            const a = Math.atan2(head.y - e.y, head.x - e.x);
            e.x += Math.cos(a) * espd;
            e.y += Math.sin(a) * espd;
        });
        
        if (!powers.invincible) {
            for (let i = 0; i < enemies.length; i++) {
                if (Math.hypot(head.x - enemies[i].x, head.y - enemies[i].y) < 1.0) {
                    enemies.splice(i, 1);
                    damage();
                    return;
                }
            }
        }
        
        mayinAdim();
        if (Math.random() < 0.004) spawnPowerup();
        tickPowerups();
    }
    
    function mayinAdim() { // Kuyruk Mayını: süre azalır, yaklaşan düşman mayını patlatır (yarıçap 2)
        if (state.mayinCool > 0) state.mayinCool--;
        if (!state.mayinlar || !state.mayinlar.length) return;
        state.mayinlar = state.mayinlar.filter(m => {
            if (--m.left <= 0) return false;
            if (!enemies.some(e => Math.hypot(e.x - m.x, e.y - m.y) < 1.0)) return true;
            let n = 0;
            enemies = enemies.filter(e => { if (Math.hypot(e.x - m.x, e.y - m.y) < 2.0) { n++; return false; } return true; });
            state.score += 2 * n; updateHUD();
            burst(m.x + 0.5, m.y + 0.5, '#ffb347', 20, 1.4); addShake(4); playSound('hit');
            return false;
        });
    }
    function mayinBirak() {
        if (state.mode !== 'tailgun' || !ek('mayin') || !state.running || state.paused || state.over || state.mayinCool > 0 || snake.length <= 3) return;
        const t = snake.pop();
        state.mayinlar.push({ x: t.x, y: t.y, left: 30 });
        state.mayinCool = 8;
        playSound('shield');
    }
    
    function drawTailgunLayer() {
        const CELL = CONFIG.CELL;
        (state.mayinlar || []).forEach(m => {
            const on = m.left > 8 || Math.floor(m.left / 2) % 2 === 0;
            ctx.save(); ctx.globalAlpha = on ? 0.95 : 0.4; ctx.fillStyle = '#ffb347'; ctx.strokeStyle = '#fff3d0'; ctx.lineWidth = 2;
            const cx = (m.x + 0.5) * CELL, cy = (m.y + 0.5) * CELL, r = CELL * 0.34;
            ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        });
        const lazer = settings.cb ? PALET.ton(PALET.yilan, 0.45) : Tema.ton('mermi', '#00e5ff', Tema.etkin(state.mode, state.level), false); // tema tonu; cb: PALET
        playerShots.forEach(s => {
            ctx.shadowColor = lazer;
            ctx.shadowBlur = 10;
            ctx.fillStyle = lazer;
            ctx.fillRect(s.x * CELL + 6, s.y * CELL + 6, 8, 8);
            ctx.shadowBlur = 0;
        });
        enemies.forEach(e => {
            const px = e.x * CELL, py = e.y * CELL;
            const tt = Tema.etkin(state.mode, state.level);
            ctx.shadowColor = settings.cb ? PALET.dusman : Tema.ton('dusman', '#ff3355', tt, false);
            ctx.shadowBlur = 10;
            // cb: düşman tek renk (#CC79A7), dayanıklı olan açık tonu; aksi halde tema tonuna kaydırılır
            ctx.fillStyle = settings.cb ? (e.hp > 1 ? PALET.ton(PALET.dusman, 0.35) : PALET.dusman) : Tema.ton('dusman', e.hp > 1 ? '#ff7a00' : '#ff3355', tt, false);
            ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
            ctx.fillStyle = '#fff';
            ctx.fillRect(px + 5, py + 6, 3, 3);
            ctx.fillRect(px + 12, py + 6, 3, 3);
            ctx.shadowBlur = 0;
        });
    }
    
    // ======================== SURVIVOR ========================
    const UPGRADES = SvCore.UPGRADES;
    
    function startSurvivor() {
        document.getElementById('fireBtn').style.display = 'none';
        state.mode = 'survivor';
        state.lives = 3;
        state.speed = 115;
        
        document.getElementById('hudHighBox').style.display = '';
        document.getElementById('hudLevelBox').style.display = '';
        document.getElementById('hudLevelLabel').textContent = 'SEVİYE';
        document.getElementById('hudTargetBox').style.display = '';
        document.getElementById('hudTargetLabel').textContent = 'XP';
        document.getElementById('hudLivesBox').style.display = '';
        document.getElementById('hudHigh').textContent = records.survivor;
        
        initGameState();
        sv = SvCore.newSv();
        gems = [];
        document.getElementById('hudLevel').textContent = sv.level;
        document.getElementById('hudTarget').textContent = '0/' + sv.need;
        showBanner('OTOMATİK ATEŞ! XP TOPLA');
        showGame();
        beginLoop();
        playSound('start');
    }
    
    function tickSurvivor() {
        if (sv.choosing) return;
        waveTick++;
        if (SvCore.waveAdvances(waveTick)) {
            state.wave++;
            showBanner('DÜŞMANLAR GÜÇLENİYOR');
        }

        // Denge sayıları (üretim aralığı, grup, HP ölçeği, hız tavanı) core/survivor.js içinde
        if (waveTick % SvCore.spawnGap(state.wave) === 0) SvCore.spawnWaveStep(enemies, state.wave, COLS, ROWS, Math.random);

        const head = snake[0];
        const espd = SvCore.enemySpeed(state.wave);

        SvCore.autoFire(sv, head, enemies, playerShots);

        svMoveShots(enemy => { // onKill mermi/düşman dizilerine dokunmaz: wasm yolunda döngü sonrası, aynı sırayla çağrılır
            state.score += 2;
            updateHUD();
            if (ek('elit') && ++state.svKill % 20 === 0) { // elit sandık: tam seviyelik altın elmas
                gems.push({ x: enemy.x, y: enemy.y, v: Math.max(1, sv.need - sv.xp), elit: true });
                showBanner('ELİT SANDIK!', false, 1200, 'altin');
            } else SvCore.addGem(gems, enemy.x, enemy.y); // 80 üstünde eski elmas XP'siyle birleşir, silinmez
        });

        SvCore.moveEnemies(enemies, head, espd);
        if (ek('diken')) govdeDikeni();

        gems = SvCore.collectGems(gems, head, sv, levelUp, () => {
            document.getElementById('hudTarget').textContent = sv.xp + '/' + sv.need;
        });

        if (!powers.invincible) {
            const i = svHeadHit(head);
            if (i >= 0) {
                enemies.splice(i, 1);
                damage();
                return;
            }
        }
    }
    
    // Gövde dikeni: baştan 3 halka sonrası gövdeye değen düşman tikte 0,2 hasar alır; ölürse elmas bırakır
    function govdeDikeni() {
        let oldu = false;
        for (const e of enemies) {
            if (e.hp <= 0) continue;
            for (let i = 3; i < snake.length; i++) {
                if (Math.abs(snake[i].x - e.x) < 0.75 && Math.abs(snake[i].y - e.y) < 0.75) {
                    e.hp -= 0.2;
                    if (e.hp <= 0) { oldu = true; state.score += 2; SvCore.addGem(gems, e.x, e.y); burst(e.x + 0.5, e.y + 0.5, '#7CFF6B', 6, 0.8); }
                    break;
                }
            }
        }
        if (oldu) { enemies = enemies.filter(e => e.hp > 0); updateHUD(); }
    }
    function levelUp() {
        SvCore.levelUpStats(sv, Math.random);
        document.getElementById('hudLevel').textContent = sv.level;
        if (sv.level >= 5) unlockAch('sv5');
        if (sv.level >= 10) unlockAch('sv10');
        pausePowerTimers();
        playSound('powerup');
    }
    
    function pickUpgrade(i) {
        if (state.mode !== 'survivor' || !sv.choosing || !sv.choices[i]) return;
        if (SvCore.applyUpgrade(sv, state, sv.choices[i].id)) updateHUD();
        sv.choosing = false;
        resumePowerTimers();
        document.getElementById('hudTarget').textContent = sv.xp + '/' + sv.need;
    }
    
    function onCanvasClick(e) {
        if (state.mode !== 'survivor' || !sv.choosing) return;
        const r = canvas.getBoundingClientRect();
        const y = (e.clientY - r.top) / r.height * CONFIG.HEIGHT;
        const x = (e.clientX - r.left) / r.width * CONFIG.WIDTH;
        if (y < 110 || y > 350) return;
        const w = CONFIG.WIDTH / 3;
        const i = Math.min(2, Math.floor(x / w));
        if (x < i * w + 14 || x > i * w + w - 14) return; // kartlar arası boşluk seçmez
        pickUpgrade(i);
    }
    
    function drawSurvivorLayer() {
        const CELL = CONFIG.CELL;
        gems.forEach(g => {
            const ec = g.elit ? '#ffd45e' : '#7CFF6B';
            ctx.shadowColor = ec;
            ctx.shadowBlur = g.elit ? 16 : 8;
            ctx.fillStyle = ec;
            if (g.elit) { ctx.fillRect(g.x * CELL + 3, g.y * CELL + 3, 14, 14); ctx.fillStyle = '#fff6cf'; ctx.fillRect(g.x * CELL + 7, g.y * CELL + 7, 6, 6); } // büyük altın elmas
            else ctx.fillRect(g.x * CELL + 7, g.y * CELL + 7, 6, 6);
            ctx.shadowBlur = 0;
        });
        drawTailgunLayer();
        
    }
    
    function drawLevelUp() {
        if (sv.choosing) {
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
            ctx.textAlign = 'center';
            ctx.font = (settings.bigHud ? 16 : 14) + 'px "Press Start 2P", monospace';
            ctx.fillStyle = '#ffd400';
            ctx.fillText('SEVİYE ATLADIN! SEÇ: 1-2-3', CONFIG.WIDTH / 2, 70);
            const w = CONFIG.WIDTH / 3;
            sv.choices.forEach((c, i) => {
                ctx.fillStyle = 'rgba(20, 34, 54, 0.9)';
                ctx.fillRect(i * w + 14, 110, w - 28, 240);
                ctx.strokeStyle = '#a9d6f0';
                ctx.lineWidth = 2;
                ctx.strokeRect(i * w + 14, 110, w - 28, 240);
                ctx.fillStyle = '#fff';
                ctx.font = '22px "Press Start 2P", monospace';
                ctx.fillText(String(i + 1), i * w + w / 2, 160);
                ctx.font = (settings.bigHud ? 12 : 10) + 'px "Press Start 2P", monospace';
                const words = c.text.split(' ');
                words.forEach((word, k) => ctx.fillText(word, i * w + w / 2, 230 + k * 22));
            });
        }
    }
    
    // ======================== POWERUPS ========================
    function spawnPowerup() {
        const types = ['shield', 'speed', 'invincible', 'clear'];
        const type = types[Math.floor(Math.random() * types.length)];
        const pos = findEmpty();
        if (pos) powerups.push({ ...pos, type, life: 320 });
    }
    
    function tickPowerups() {
        const head = snake[0];
        
        powerups = powerups.filter(p => {
            p.life--;
            
            if (head.x === p.x && head.y === p.y) {
                activatePower(p.type);
                return false;
            }
            
            return p.life > 0;
        });
    }
    
    // güç süreleri: seviye seçimi sırasında durdurulabilsin diye kalan süre tutulur
    let powerMeta = {};
    
    function armTimer(type, ms, fn) {
        if (powerTimers[type]) clearTimeout(powerTimers[type]);
        powerMeta[type] = { fn, end: Date.now() + ms };
        powerTimers[type] = setTimeout(() => { delete powerMeta[type]; fn(); }, ms);
    }
    
    function pausePowerTimers() {
        Object.keys(powerMeta).forEach(t => {
            clearTimeout(powerTimers[t]);
            powerMeta[t].left = Math.max(50, powerMeta[t].end - Date.now());
        });
    }
    
    function resumePowerTimers() {
        Object.keys(powerMeta).forEach(t => {
            const m = powerMeta[t];
            armTimer(t, m.left || 1000, m.fn);
        });
    }
    
    function activatePower(type) {
        if (powerTimers[type]) clearTimeout(powerTimers[type]);
        
        playSound('powerup');
        isikOlay('guc', snake[0].x + 0.5, snake[0].y + 0.5, CONFIG.COLORS['power' + type.charAt(0).toUpperCase() + type.slice(1)]);
        
        switch (type) {
            case 'shield':
                powers.shield = true;
                armTimer('shield', 12000, () => {
                    powers.shield = false;
                    refreshPowerDisplay();
                });
                break;
                
            case 'speed':
                if (!powers.speed) {
                    powers.speed = true;
                    state.speed = Math.max(30, state.speed - 35);
                    clearInterval(loopInterval);
                    loopInterval = setInterval(tick, effSpeed());
                }
                armTimer('speed', 6500, () => {
                    powers.speed = false;
                    state.speed += 35;
                    // oyun bitmiş/menüye dönülmüşse (loopInterval null) hayalet tick döngüsü başlatma
                    if (loopInterval) { clearInterval(loopInterval); loopInterval = setInterval(tick, effSpeed()); }
                    refreshPowerDisplay();
                });
                break;
                
            case 'invincible':
                powers.invincible = true;
                armTimer('invincible', 5000, () => {
                    powers.invincible = false;
                    refreshPowerDisplay();
                });
                break;
                
            case 'clear':
                bullets = [];
                enemies = [];
                flashCanvas('#00ff66');
                return;
        }
        
        refreshPowerDisplay();
    }
    
    function refreshPowerDisplay() {
        document.getElementById('powerShield').classList.toggle('active', powers.shield);
        document.getElementById('powerSpeed').classList.toggle('active', powers.speed);
        document.getElementById('powerInvincible').classList.toggle('active', powers.invincible);
    }
    
    // ======================== MOVING OBSTACLES ========================
    function tickMovingObs() {
        movingObs.forEach(o => {
            o.x += o.dx;
            o.y += o.dy;
            
            if (o.x <= 0 || o.x >= COLS - 1) {
                o.dx *= -1;
                o.x = Math.max(0, Math.min(COLS - 1, o.x));
            }
            if (o.y <= 0 || o.y >= ROWS - 1) {
                o.dy *= -1;
                o.y = Math.max(0, Math.min(ROWS - 1, o.y));
            }
        });
    }
    
    // ======================== GAME END ========================
    function endGame() {
        state.over = true;
        stopGame();
        playSound('gameover');
        burst(snake[0].x + 0.5, snake[0].y + 0.5, '#00ff88', 40, 1.6);
        addShake(10);
        startFx();
        
        let isRecord = false;
        const kayitYok = state.mode === 'tron' && tron.twoP; // 2 oyuncu: rekor tutulmaz
        if (!kayitYok && typeof records[state.mode] === 'number' && state.score > records[state.mode]) {
            records[state.mode] = state.score;
            if (state.mode === 'daily') records.dailyDate = state.dailyKey || todayKey();
            isRecord = true;
        }
        
        if (state.mode === 'classic' && ek('hayalet') && state.hRec && state.hRec.length > 5 && state.score > (records.hay ? records.hay.s : 0)) records.hay = { s: state.score, p: state.hRec.map(i => String.fromCharCode(48 + i)).join(''), e: state.hEat.slice() };
        if (!records.top) records.top = {};
        const entry = { s: state.score, d: Date.now() };
        let top = records.top[state.mode] || [];
        if (!kayitYok) {
            top = top.concat([entry]).sort((a, b) => b.s - a.s).slice(0, 5);
            records.top[state.mode] = top;
            saveData();
            checkAch('end');
        }
        stopMusic();
        document.getElementById('topList').innerHTML = kayitYok
            ? `<li class="me">P1 ${state.score} - ${tron.p2Wins} P2</li>`
            : top.map((t, i) => `<li class="${t === entry ? 'me' : ''}">${i + 1}. ${t.s}</li>`).join('');
        
        document.getElementById('finalScore').textContent = kayitYok ? (state.score >= TRON_HEDEF ? 'P1' : 'P2') : state.score;
        document.getElementById('finalLabel').textContent = kayitYok ? 'KAZANAN:' : 'SKOR:';
        document.getElementById('gameoverTitle').textContent = kayitYok ? 'DÜELLO BİTTİ' : 'OYUN BİTTİ';
        document.getElementById('newRecordMsg').style.display = isRecord ? 'flex' : 'none';
        const thm = document.getElementById('tohumMsg'); if (thm) thm.textContent = state.tohum ? 'TOHUM ' + state.tohum + ' · T' : '';
        mirasVer('kulMsg', !kayitYok, state.mode === 'tapinak' && !!(tp && tp.kazandi));
        if (state.mode === 'tapinak') { const gTitle = document.getElementById('gameoverTitle'); if (gTitle) gTitle.textContent = tp && tp.kazandi ? 'TAPINAKTAN ÇIKTIN' : 'KOŞU BİTTİ'; }
        const kb = document.getElementById('copyBtn'); // Günlük: sonucu panoya kopyala (yalnız tıklamayla)
        document.getElementById('copyHint').textContent = '';
        kb.style.display = state.mode === 'daily' ? '' : 'none';
        isiCiz();
        document.getElementById('gameoverOverlay').classList.add('active');
    }
    // Koşu ısı haritası: oyun sonu ekranında yılanın en çok geçtiği hücreler (yalnız çizim)
    function isiCiz() {
        const cv = document.getElementById('isiHarita');
        if (!cv) return;
        const a = state.isi;
        if (!ek('isi') || !a || state.mode === 'tron' || state.mode === 'tapinak') { cv.style.display = 'none'; return; }
        let mx = 1; for (let i = 0; i < a.length; i++) if (a[i] > mx) mx = a[i];
        cv.width = COLS * 2; cv.height = ROWS * 2; cv.style.display = '';
        const c = cv.getContext('2d');
        c.fillStyle = '#0b0d14'; c.fillRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < a.length; i++) if (a[i]) {
            const k = Math.sqrt(a[i] / mx);
            c.fillStyle = 'rgb(' + Math.round(60 + 195 * k) + ',' + Math.round(40 + 150 * k * k) + ',' + Math.round(30 * (1 - k)) + ')';
            c.fillRect((i % COLS) * 2, Math.floor(i / COLS) * 2, 2, 2);
        }
    }
    function sonucMetni() { return 'Twilight of the Serpents · Günlük ' + (state.dailyKey || todayKey()) + ' · Skor ' + state.score; }
    function kopyalaSonuc() {
        const ipucu = t => { document.getElementById('copyHint').textContent = t; };
        if (state.mode !== 'daily') return;
        try { navigator.clipboard.writeText(sonucMetni()).then(() => ipucu('Kopyalandı'), () => ipucu('Kopyalanamadı')); } catch (e) { ipucu('Kopyalanamadı'); } // pano yok/izin yok: sessiz
    }
    
    // ======================== TAPINAK (mantık ve çizim: tapinak.js) ========================
    let tp = null, tpMeta = null;
    function startTapinak(seed) {
        if (typeof Tapinak === 'undefined') return;
        startSimple('tapinak', 110, { high: records.tapinak, levelLabel: 'ODA', lives: true });
        document.getElementById('fireBtn').style.display = '';
        food = { x: -50, y: -50, type: 'normal' }; // tapınakta yem yok; düşmanların ruh özleri büyütür
        tpMeta = Tapinak.yukle();
        tpMeta.kosu++;
        Tapinak.kaydet(tpMeta);
        tp = Tapinak.yeniKosu(typeof seed === 'number' && isFinite(seed) ? seed : (Date.now() ^ (Math.random() * 1e9)) >>> 0, tpMeta.yetenek);
        tapinakSenkron();
        prevSnake = snake.map(c => ({ x: c.x, y: c.y }));
        tapinakOlaylar(Tapinak.olaylariAl(tp));
        showBanner('TAPINAK · SPACE: ATEŞ' + (tp.yetenek.atilim ? ' · SHIFT: ATILIM' : ''), true);
        showGame();
        beginLoop();
        playSound('start');
    }
    function tapinakSenkron() {
        snake = tp.snake;
        dir = { ...tp.dir };
        nextDir = { ...tp.want };
        state.score = tp.skor;
        state.lives = tp.can;
        document.body.dataset.atilim = tp.yetenek.atilim ? '1' : '0'; // Atılım düğmesi: öğrenilene dek soluk
    }
    function tickTapinak() {
        if (!tp) return;
        if (nextDir.x !== dir.x || nextDir.y !== dir.y) tp.want = { ...nextDir };
        Tapinak.adim(tp);
        tapinakSenkron();
        tapinakOlaylar(Tapinak.olaylariAl(tp));
    }
    function tapinakEylem(f) {
        if (!tp || state.paused || state.over || state.complete) return false;
        const ok = f(tp);
        tapinakSenkron();
        tapinakOlaylar(Tapinak.olaylariAl(tp));
        return ok;
    }
    function tapinakAtes() { return tapinakEylem(r => Tapinak.ates(r)); }
    function tapinakAtil() { return tapinakEylem(r => Tapinak.atil(r)); }
    function tapinakSec(i) { return tapinakEylem(r => Tapinak.sec(r, i)); }
    function tapinakOlaylar(evs) {
        let bitis = null;
        evs.forEach(e => {
            switch (e.t) {
                case 'oda': {
                    const n = Object.keys(tp.odalar).filter(k => tp.odalar[k].ziyaret).length;
                    document.getElementById('hudLevel').textContent = n + '/9';
                    showBanner(e.ad, true);
                    break;
                }
                case 'ates': playSound('shield'); break;
                case 'oldu': burst(e.x, e.y, '#9fe8ff', 14, 1.1); playSound('eat'); break;
                case 'govde': spark(e.x, e.y); break;
                case 'oz': playSound('eat'); break;
                case 'hasar': burst(e.x, e.y, '#ff2244', 22, 1.3); addShake(7); flashCanvas('#ff0033'); playSound('hit'); isikOlay('hasar'); break;
                case 'kalkan': flashCanvas('#00ccff'); playSound('shield'); break;
                case 'temiz': isikOlay('kapi'); showBanner(e.tur === 'savas' ? 'ODA TEMİZLENDİ · ARMAĞAN SEÇ' : e.tur === 'boss' ? 'KÜL JARLI DÜŞTÜ · SUNAK VE ÇIKIŞ' : 'ODA TEMİZLENDİ · SUNAĞA DOKUN', true); playSound('powerup'); break;
                case 'armagan': showBanner(e.ad + ': ' + e.acik, true); playSound('supereat'); break;
                case 'yetenek':
                    tpMeta.yetenek[e.id] = true;
                    Tapinak.kaydet(tpMeta);
                    showBanner('YENİ YETENEK: ' + e.ad, true);
                    showToast('🏛️ ' + e.ad + ' · ' + e.acik);
                    playSound('ach');
                    break;
                case 'lutuf': showBanner('ŞİFA SUNAĞI: CAN DOLDU', true); playSound('powerup'); break;
                case 'sandik': showBanner('ALTIN KASA: +1 CAN', true); playSound('supereat'); break;
                case 'kirildi': burst(e.x, e.y, '#c08a5a', 24, 1.4); addShake(5); playSound('hit'); break;
                case 'kilit': burst(e.x, e.y, '#e8c46a', 20, 1.2); playSound('powerup'); break;
                case 'atilim': burst(e.x1, e.y1, '#7fe3ff', 10, 0.9); playSound('powerup'); break;
                case 'ipucu': showBanner(e.metin); break;
                case 'faz': { const b = tp.odalar[tp.oda].boss; if (b) isikOlay('sok', b.x, b.y); showBanner('KÜL JARLI · FAZ ' + e.faz, true); addShake(8); playSound('hit'); break; }
                case 'sarsinti': addShake(6); break;
                case 'bossOldu': burst(e.x, e.y, '#ffb347', 60, 2.2); isikOlay('sok', e.x, e.y); addShake(12); playSound('complete'); break;
                case 'bitti': bitis = e; break;
            }
        });
        state.score = tp.skor;
        state.lives = tp.can;
        updateHUD();
        if (bitis && !state.over) tapinakBitir(!!bitis.won);
    }
    function tapinakBitir(won) {
        state.score = tp.skor;
        if (won) tpMeta.zafer++;
        Tapinak.kaydet(tpMeta);
        endGame();
    }
    function drawTapinakLayer() {
        if (tp) Tapinak.ciz(ctx, tp, { dpr, t: performance.now() / 1000, reduced: REDUCED, cb: settings.cb, dusmanRenk: PALET.dusman, zemin: isikZemin });
    }
    function drawTapinakTop() {
        if (tp) Tapinak.cizUst(ctx, tp, { dpr, t: performance.now() / 1000, reduced: REDUCED, bas: renderPos[0], ust: isikUst });
    }
    
    function winLevel() {
        state.complete = true;
        stopGame();
        playSound('complete');
        
        // Stars
        const ratio = snake.length / (state.target + 3);
        let stars = 1;
        if (ratio >= 1.35) stars = 3;
        else if (ratio >= 1.12) stars = 2;
        const hizli = ek('par') && state.bolumTik <= state.target * 14; // süre yıldızı: par = hedef x 14 tik
        if (hizli && stars < 3) stars++;
        
        // Save progress
        if (!progress.stars[state.level] || progress.stars[state.level] < stars) {
            progress.stars[state.level] = stars;
        }
        if (state.level >= progress.unlocked && state.level < 30) {
            progress.unlocked = state.level + 1;
        }
        if (stars === 3) unlockAch('star3');
        if (state.level >= 10) unlockAch('bolum10');
        if (state.level >= 30) unlockAch('bolum30');
        saveData();
        stopMusic();
        
        document.getElementById('starsDisplay').innerHTML = yildizlar(stars, 3);
        document.getElementById('starsDisplay').setAttribute('aria-label', stars + ' yıldız' + (hizli ? ', hızlı bitiriş' : ''));
        document.getElementById('levelEndScore').textContent = state.score + (hizli ? ' ⚡' : '');
        mirasVer('kulMsgWin', true, true);
        document.getElementById('completeOverlay').classList.add('active');
    }
    
    function restart() {
        closeOverlays();
        const starters = { classic: startClassic, bullet: startBullet, tailgun: startTailgun, survivor: startSurvivor, timeattack: startTimeAttack, portal: startPortal, tron: startTron, chaos: startChaos, daily: startDaily, tapinak: () => startTapinak() };
        if (starters[state.mode]) starters[state.mode]();
        else startCampaign(state.level);
    }
    
    function nextLevel() {
        closeOverlays();
        if (state.level < 30) startCampaign(state.level + 1);
        else showLevels();
    }
    
    // ======================== INPUT ========================
    function onKey(e) {
        const key = e.key.toLowerCase();
        
        if (key === 'escape' && closeOpenPanel()) return;
        // Panel açıkken oyun tuşları (M, yön, ateş) çalışmaz; odaktaki düğmede Boşluk/Enter düğmeyi tıklar
        if (document.querySelector('.panel-overlay.active')) return;
        if (key === ' ' && e.target && e.target.closest && e.target.closest('button')) return;
        if (key === 'p' || key === 'escape') {
            togglePause();
            return;
        }
        
        if (key === 'o' && state.mode === 'tailgun') { mayinBirak(); return; }
        if (key === 'o' && state.mode === 'tron' && ek('parlama') && state.running && !state.paused && !state.over && !tron.twoP && tron.enerji >= 30) {
            tron.sicra = true;
            return;
        }
        if (key === 't' && state.over && state.tohum && ek('tohum')) {
            state.tohumSonraki = state.tohum;
            restart();
            return;
        }
        if (key === 'r' && state.over) {
            restart();
            return;
        }
        if (key === 'r' && ek('rtekrar') && (state.running || state.complete) && document.body.classList.contains('oyun-acik')) {
            restart();
            return;
        }
        
        if (key === 'm') {
            showMenu();
            return;
        }
        
        if (key === 'k' && state.mode === 'classic' && ek('kabuk') && state.kabukHazir && state.running && !state.paused && !state.over && snake.length >= 30) {
            kabukAt();
            return;
        }
        if (key === 'x' && state.mode === 'portal' && ek('takas') && state.running && !state.paused && !state.over && snake.length >= 3 && !(state.takasCool > 0)) {
            takasYap();
            return;
        }
        if (key === 'z' && state.mode === 'bullet' && ek('yansit') && state.running && !state.paused && !state.over && !(state.yansitCool > 0)) {
            yansitYap();
            return;
        }
        if (key === 'n') {
            toggleSound();
            return;
        }
        if (key === 'b') {
            toggleMusic();
            return;
        }
        
        if (state.paused || state.over || state.complete) return;
        
        if (state.mode === 'survivor' && sv.choosing && ['1', '2', '3'].includes(key)) {
            pickUpgrade(Number(key) - 1);
            return;
        }
        
        if (state.mode === 'tapinak') {
            if (key === 'shift') { tapinakAtil(); e.preventDefault(); return; }
            if (key === '1' || key === '2') { tapinakSec(Number(key) - 1); return; }
        }
        
        if (key === ' ') {
            fire();
            e.preventDefault();
            return;
        }
        
        if (state.mode === 'tron' && tron.twoP) {
            switch (key) {
                case 'w': steer(0, -1); break;
                case 's': steer(0, 1); break;
                case 'a': steer(-1, 0); break;
                case 'd': steer(1, 0); break;
                case 'arrowup': steerP2(0, -1); e.preventDefault(); break;
                case 'arrowdown': steerP2(0, 1); e.preventDefault(); break;
                case 'arrowleft': steerP2(-1, 0); e.preventDefault(); break;
                case 'arrowright': steerP2(1, 0); e.preventDefault(); break;
            }
            return;
        }
        switch (key) {
            case 'arrowup': case 'w': steer(0, -1); e.preventDefault(); break;
            case 'arrowdown': case 's': steer(0, 1); e.preventDefault(); break;
            case 'arrowleft': case 'a': steer(-1, 0); e.preventDefault(); break;
            case 'arrowright': case 'd': steer(1, 0); e.preventDefault(); break;
        }
    }
    function steerP2(dx, dy) {
        const d = tron.aiDir;
        if (dx !== 0 && d.x !== -dx) tron.p2Next = { x: dx, y: 0 };
        if (dy !== 0 && d.y !== -dy) tron.p2Next = { x: 0, y: dy };
    }
    
    // ======================== GAMEPAD ========================
    // Klavye eşlemesinin aynısı: çubuk/d-pad yön, A ateş, Start duraklat. 2 oyuncuda pad 0 → P1 (WASD), pad 1 → P2 (oklar).
    const padPrev = {};
    let padCountPrev = 0, padInfoEl = null;
    function padKeys(gp, idx) {
        const out = [];
        let ax = Number(gp.axes[0]) || 0, ay = Number(gp.axes[1]) || 0;
        // Ölü bölge 0.5; çapraz itişte yalnız baskın eksen sayılır (iki yön birden gönderilip biri yutulmasın)
        if (Math.abs(ax) >= Math.abs(ay)) ay = 0; else ax = 0;
        const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
        const twoP = state.mode === 'tron' && tron.twoP;
        const arrows = !(twoP && idx === 0);
        const K = arrows ? { u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight' } : { u: 'w', d: 's', l: 'a', r: 'd' };
        if (ay < -0.5 || b(12)) out.push(K.u);
        if (ay > 0.5 || b(13)) out.push(K.d);
        if (ax < -0.5 || b(14)) out.push(K.l);
        if (ax > 0.5 || b(15)) out.push(K.r);
        if (b(0)) out.push(' ');
        if (b(4) || b(5) || b(7)) out.push('Shift'); // LB/RB/RT: Tapınak Atılım (onKey küçük harfe çevirir)
        if (b(9)) out.push('p');
        if (b(1) || b(2) || b(3)) out.push(idx === 0 ? '1' : '2');
        return out;
    }
    function pollPads() {
        if (!navigator.getGamepads) return;
        const slots = navigator.getGamepads() || [];
        let count = 0;
        for (let i = 0; i < slots.length; i++) if (slots[i]) count++;
        if (!count && !padPrev[0] && !padPrev[1] && !padCountPrev) return; // kol yok ve durum zaten temiz: ucuz çık
        if (count !== padCountPrev || padInfoEl === null && count) {
            padInfoEl = padInfoEl || document.getElementById('padInfo');
            if (padInfoEl) padInfoEl.textContent = count ? count + ' KOL BAĞLI' : 'BAĞLI DEĞİL';
            padCountPrev = count;
        }
        // Yuva sırası korunur: 1. kol çıkınca 2. kol P1 olmaz; boş yuvanın önceki durumu silinir
        for (let i = 0; i < 2; i++) if (!slots[i]) delete padPrev[i]; // dizi kısalırsa (kol çıkınca) eski durum da silinir
        slots.slice(0, 2).forEach((gp, idx) => {
            if (!gp) return;
            const now = padKeys(gp, idx);
            const prev = padPrev[idx] || [];
            const live = document.body.classList.contains('oyun-acik') && !state.over;
            now.forEach(k => { if (!prev.includes(k) && live) onKey({ key: k, preventDefault() {} }); });
            padPrev[idx] = now;
        });
    }
    
    function steer(dx, dy) {
        if (chaos.rule === 'reverse') { dx = -dx; dy = -dy; }
        const pending = nextDir.x !== dir.x || nextDir.y !== dir.y; // bu tik içinde zaten bir dönüş bekliyor
        if (pending && ek('donus') && state.running && state.mode !== 'tron' && state.mode !== 'tapinak') {
            const n = dx !== 0 ? { x: dx, y: 0 } : { x: 0, y: dy };
            if (!(n.x === -nextDir.x && n.y === -nextDir.y) && !(n.x === nextDir.x && n.y === nextDir.y) && turnQ.length < 1) turnQ.push(n);
            return;
        }
        if (dx !== 0 && dir.x !== -dx) nextDir = { x: dx, y: 0 };
        if (dy !== 0 && dir.y !== -dy) nextDir = { x: 0, y: dy };
    }
    
    function input(dx, dy) {
        if (state.paused || state.over || state.complete) return;
        steer(dx, dy);
    }
    
    function togglePause() {
        if (!state.running || state.over || state.complete) return; // menüde (oyun başlamamışken) duraklatma yok
        state.paused = !state.paused;
        if (state.paused) pausePowerTimers(); else resumePowerTimers(); // güç süreleri duraklamada akmasın
        document.getElementById('pauseOverlay').classList.toggle('active', state.paused);
        if (!state.paused) renderFrame();
    }

    // Odak kaybında otomatik duraklat: yalnız oyun çalışıyorken ve henüz duraklı değilken (Tron 2P dahil). Otomatik devam yok.
    function autoPause() {
        if (!state.running || state.paused || state.over || state.complete) return;
        togglePause();
    }

    // ======================== HUD ========================
    function updateHUD() {
        document.getElementById('hudScore').textContent = state.score;
        
        if (state.mode !== 'classic') {
            let hearts = '';
            for (let i = 0; i < Math.max(3, state.lives); i++) {
                hearts += ikon('heart', 'kalp' + (i < state.lives ? '' : ' bos'));
            }
            document.getElementById('hudLives').innerHTML = hearts;
            document.getElementById('hudLives').setAttribute('aria-label', 'Can: ' + state.lives);
        }
        
        if (state.mode === 'campaign') {
            document.getElementById('hudTarget').textContent = `${state.score}/${state.target}`;
        }
        if (state.mode === 'timeattack') {
            const ht = document.getElementById('hudTarget'), sn = Math.max(0, Math.ceil(state.timeLeft)) + ' sn';
            ht.classList.toggle('ragnarok', !!state.ragnarok); // kırmızı + tarama deseni + alev ikonu + "x2" (renk körü: PALET.curuk)
            if (state.ragnarok) ht.innerHTML = ikon('flame') + sn + ' <b>x2</b>'; else ht.textContent = sn;
        }
    }
    
    // ======================== RENDERING ========================
    function draw() {
        const C = CONFIG.COLORS;
        const CELL = CONFIG.CELL;
        
        const nowT = performance.now();
        const dt = Math.min(0.05, (nowT - (lastFrameAt || nowT)) / 1000);
        lastFrameAt = nowT;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        updateFx(dt);
        ctx.save();
        if (shake.mag > 0.2 && !REDUCED) ctx.translate((Math.random() - 0.5) * shake.mag, (Math.random() - 0.5) * shake.mag);
        drawBackground(nowT);
        if (state.mode !== 'tapinak') isikZemin(ctx); // ışık haritası/sis/iz: tüm nesnelerin altında (Tapınak: tapinak.js kancası)
        if (Tema.aktif()) drawTemaKatman(nowT / 1000); // Bataklık çamuru, Lav uyarı/yanış hücreleri, Rün hücreleri
        
        // Static obstacles
        if (G25()) G25().drawBlocks(ctx, obstacles, settings.cb ? PALET.engel : C.obstacle, false, nowT / 1000, CELL, false, settings.cb);
        else obstacles.forEach(o => drawBlock(o.x, o.y, settings.cb ? PALET.engel : C.obstacle, '#55557a'));
        
        // Moving obstacles
        if (G25()) G25().drawBlocks(ctx, movingObs, C.movingObs, true, nowT / 1000, CELL, true);
        else movingObs.forEach(o => drawBlock(Math.floor(o.x), Math.floor(o.y), C.movingObs, '#ffaa44', true));
        
        // Powerups
        powerups.forEach(p => drawPowerup(p));
        
        portals.forEach(drawPortal);
        
        // Food
        if (state.mode !== 'tron') { drawFood(); drawEkYem(); }
        drawGucHalka();
        if (state.mode === 'tron') drawTronLayer();
        
        // Lasers, warnings, boss
        if (state.mode === 'bullet') drawBulletLayer();
        if (state.mode === 'tailgun') drawTailgunLayer();
        if (state.mode === 'tapinak') drawTapinakLayer();
        if (state.mode === 'survivor') drawSurvivorLayer();
        
        // Bullets
        bullets.forEach(b => drawBullet(b));
        
        // Snake
        // ilerleme gerçek tik aralığına (hız ayarı, Sakin, Bataklık dahil) bölünür: eskiden state.speed kullanılıyordu, ayar 1,5x iken yılan her tikte bekleyip titriyordu
        const prog = state.paused || state.over ? 1 : Math.max(0, Math.min(1, (nowT - lastTickAt) / Math.max(40, effSpeed())));
        const total = snake.length;
        renderPos = snake.map((c, i) => lerpPos(prevSnake[i], c, prog));
        // Gövde: gfx25 varsa tek parça şerit (hayalet kuralında gövde gizli); yoksa parça parça
        const seritli = !!(G25() && G25().drawSnakeRibbon && chaos.rule !== 'ghost' && total > 1 && G25().drawSnakeRibbon(ctx, renderPos, dir, nowT / 1000, gfxOpts()));
        for (let i = total - 1; i >= 0; i--) {
            if (seritli && i > 0) continue;
            if (chaos.rule === 'ghost' && i > 0) continue;
            const pos = renderPos[i];
            if (i === 0) {
                const gk = ek('yutma') && !REDUCED && state.gulpAt ? (nowT - state.gulpAt) / 240 : 2; // yutma: baş kısa süre şişer (0..1 arası)
                if (gk >= 0 && gk < 1) {
                    const hx = (pos.x + 0.5) * CELL, hy = (pos.y + 0.5) * CELL, sc = 1 + 0.2 * Math.sin(Math.PI * gk);
                    ctx.save(); ctx.translate(hx, hy); ctx.scale(sc, sc); ctx.translate(-hx, -hy);
                    drawSnakeHead(pos);
                    ctx.restore();
                } else drawSnakeHead(pos);
                if (!REDUCED && state.running && Math.random() < 0.35) spark(pos.x + 0.5, pos.y + 0.5);
            } else drawSnakeBody(pos, i, total);
        }
        
        if (ek('kuyrukrenk') && state.yemRenk && state.yemRenk.length && total > 1 && chaos.rule !== 'ghost') {
            const S = CONFIG.CELL;
            for (let i = 0; i < state.yemRenk.length && i + 1 < total; i++) {
                const q = renderPos[i + 1];
                ctx.save(); ctx.fillStyle = state.yemRenk[i]; ctx.globalAlpha = 0.9;
                ctx.beginPath(); ctx.arc((q.x + 0.5) * S, (q.y + 0.5) * S, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            }
        }
        if (state.mode === 'portal' && state.kapiLeft > 0 && state.kapiRenk && ek('renkkapi')) {
            const S = CONFIG.CELL, h = renderPos[0];
            ctx.save(); ctx.strokeStyle = state.kapiRenk; ctx.lineWidth = 3; ctx.globalAlpha = 0.5 + 0.4 * (state.kapiLeft / 12);
            ctx.beginPath(); ctx.arc((h.x + 0.5) * S, (h.y + 0.5) * S, S * 0.75, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        // Market efekti (kostüme özgü parçacıklar; reduced / fx kapalı / renk körü / Tapınak'ta yok)
        if (typeof Market !== 'undefined' && state.mode !== 'tapinak') {
            const mp = chaos.rule === 'ghost' ? renderPos.slice(0, 1) : renderPos;
            Market.efekt(ctx, { pts: mp, S: CONFIG.CELL, t: nowT / 1000, aktif: state.running && !state.paused && !state.over, cb: settings.cb, reduced: REDUCED, fx: settings.fx, yon: dir });
        }

        drawHayalet();
        drawAlaca(renderPos);
        // Auras
        if (powers.invincible) drawAura(snake[0], '#ff00ff', 26);
        if (powers.shield) drawAura(snake[0], '#00ccff', 22);
        if (state.mode === 'tapinak') drawTapinakTop();
        
        if (tmBekle && nowT > banner.until) { showBanner(tmBekle, true, 2000); tmBekle = null; } // Tema adı/ipucu: 2 sn
        if (['classic', 'bullet', 'tailgun', 'survivor', 'chaos', 'portal', 'timeattack', 'tron', 'daily', 'tapinak'].includes(state.mode)) drawBanner(); // daily eksikti: Günlük afişleri hiç çizilmiyordu
        drawParticles();
        if (state.mode !== 'tapinak') isikUst(ctx);
        if (Tema.carpan() > 1) drawRunSayac();
        drawVignette();
        if (state.mode === 'survivor' && sv.choosing) drawLevelUp();
        ctx.restore();
    }
    
    // ---- Tema kural katmanı: renk körü açıkken PALET renkleri; ayrım desenle (tarama / çarpı / nokta) de verilir ----
    function drawTemaKatman(t) {
        const S = CONFIG.CELL, cb = settings.cb, titre = REDUCED ? 0.5 : 0.5 + 0.5 * Math.sin(t * 7);
        ctx.save();
        // Bataklık çamuru: koyu çamur zemini + açık nokta deseni (renk bağımsız) + kabarcık
        Tema.camurlar().forEach((m, i) => {
            const x = m.x * S, y = m.y * S;
            ctx.fillStyle = cb ? 'rgba(150,115,60,0.92)' : 'rgba(92,68,30,0.92)';
            ctx.fillRect(x, y, S, S);
            ctx.fillStyle = cb ? 'rgba(255,255,255,0.55)' : 'rgba(205,215,130,0.62)';
            for (let k = 0; k < 4; k++) ctx.fillRect(x + 3 + (k % 2) * 8 + (i % 2), y + 4 + Math.floor(k / 2) * 8, 2, 2);
            ctx.strokeStyle = cb ? 'rgba(255,255,255,0.6)' : 'rgba(170,190,90,0.7)'; ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 1, y + 1, S - 2, S - 2);
            if (!REDUCED) { const b = (t * 0.6 + i * 0.37) % 1; ctx.globalAlpha = 0.5 * (1 - b); ctx.strokeStyle = '#c9d98a'; ctx.beginPath(); ctx.arc(x + 6 + (i * 7) % 9, y + 14 - b * 8, 1 + b * 2, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
        });
        // Lav: uyarı = turuncu zemin + ÇAPRAZ TARAMA, yanış = kızıl zemin + KALIN ÇARPI
        const L = Tema.lavDurum();
        if (L && L.hucre.length) {
            L.hucre.forEach(h => {
                const x = h.x * S, y = h.y * S;
                // belirgin hale: uyarıda soluk turuncu, yanışta kızıl (additive)
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                const hg = ctx.createRadialGradient(x + S / 2, y + S / 2, 2, x + S / 2, y + S / 2, 30);
                hg.addColorStop(0, L.faz === 'uyari' ? 'rgba(255,170,40,0.55)' : 'rgba(255,70,20,0.7)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.globalAlpha = 0.5 + 0.5 * titre; ctx.fillStyle = hg; ctx.fillRect(x + S / 2 - 30, y + S / 2 - 30, 60, 60); ctx.restore();
                if (L.faz === 'uyari') {
                    ctx.fillStyle = cb ? PALET.yem : '#ffae2b';
                    ctx.globalAlpha = 0.28 + 0.3 * titre; ctx.fillRect(x, y, S, S); ctx.globalAlpha = 1;
                    ctx.strokeStyle = cb ? '#ffffff' : '#ffe27a'; ctx.lineWidth = 2;
                    ctx.beginPath();
                    for (let k = 4; k < S * 2; k += 7) { ctx.moveTo(x + Math.min(k, S), y + Math.max(0, k - S)); ctx.lineTo(x + Math.max(0, k - S), y + Math.min(k, S)); }
                    ctx.stroke();
                    ctx.setLineDash([4, 3]); ctx.strokeStyle = cb ? '#ffffff' : '#ffae2b'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, S - 2, S - 2); ctx.setLineDash([]);
                    ctx.fillStyle = '#2a1200'; ctx.fillRect(x + S / 2 - 2, y + 4, 4, 8); ctx.fillRect(x + S / 2 - 2, y + 14, 4, 3); // ünlem: renkten bağımsız
                } else {
                    ctx.fillStyle = cb ? PALET.curuk : '#ff3a10';
                    ctx.globalAlpha = 0.8 + 0.2 * titre; ctx.fillRect(x, y, S, S); ctx.globalAlpha = 1;
                    ctx.strokeStyle = cb ? '#ffffff' : '#fff0c0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + S - 4, y + S - 4); ctx.moveTo(x + S - 4, y + 4); ctx.lineTo(x + 4, y + S - 4); ctx.stroke();
                }
            });
        }
        // Rün: ışıklı kristal rün (cb: sarı); şekil (elmas + çizgi) renkten bağımsız
        Tema.runeler().forEach((r, i) => {
            const cx = r.x * S + S / 2, cy = r.y * S + S / 2, p = REDUCED ? 0.7 : 0.6 + 0.4 * Math.sin(t * 3 + i * 2);
            const col = cb ? PALET.tron : '#5ff0e8', col2 = cb ? '#ffffff' : '#b48cff';
            ctx.globalCompositeOperation = 'lighter';
            const gr = ctx.createRadialGradient(cx, cy, 1, cx, cy, 16); gr.addColorStop(0, cb ? 'rgba(240,228,66,0.5)' : 'rgba(110,240,230,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = p; ctx.fillStyle = gr; ctx.fillRect(cx - 16, cy - 16, 32, 32);
            ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
            ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx, cy + 8); ctx.lineTo(cx - 6, cy); ctx.closePath(); ctx.stroke();
            ctx.strokeStyle = col2; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 5); ctx.moveTo(cx - 3, cy - 1); ctx.lineTo(cx + 3, cy - 4); ctx.stroke();
        });
        ctx.restore();
    }
    // Rün çarpanı kalan süresi (sağ üst, tuval içi)
    function drawRunSayac() {
        const k = Math.max(0, Math.min(1, Tema.runKalan() / Tema.RUN_SURE)), cb = settings.cb;
        ctx.save();
        ctx.font = '13px "Press Start 2P", monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = cb ? PALET.tron : '#7af7ee';
        ctx.shadowColor = cb ? PALET.tron : '#7af7ee'; ctx.shadowBlur = REDUCED ? 0 : 8;
        ctx.fillText('RÜN x2  ' + (Tema.runKalan() / 1000).toFixed(1) + ' SN', CONFIG.WIDTH - 22, 52);
        ctx.shadowBlur = 0;
        ctx.fillRect(CONFIG.WIDTH - 22 - 150 * k, 58, 150 * k, 4);
        ctx.restore();
    }
    const G25 = () => (typeof Gfx25 !== 'undefined' ? Gfx25 : null);
    // ---- IŞIK (src/isik.js): dinamik aydınlatma/atmosfer/efekt; yalnız çizim, yoksa atlanır ----
    const ISIK = () => (typeof Isik !== 'undefined' ? Isik : null);
    const isikO = { W: CONFIG.WIDTH, H: CONFIG.HEIGHT, S: CONFIG.CELL, gucRenk: null, mermiMerkez: true, torches: null };
    const isikTor = [34, 34, CONFIG.WIDTH - 34, 34, 34, CONFIG.HEIGHT - 34, CONFIG.WIDTH - 34, CONFIG.HEIGHT - 34]; // zemindeki meşale havuzları (gfx25)
    const isikTorTp = [30, 20, 930, 20, 30, 600, 930, 600]; // Tapınak meşaleleri (hücre 1/46, 1/30)
    function isikOpts() {
        const o = isikO;
        o.t = performance.now() / 1000; o.dpr = dpr; o.fx = settings.fx; o.reduced = REDUCED; o.cb = settings.cb;
        o.tema = Tema.etkin(state.mode, state.level);
        o.karanlik = Tema.karanlik();
        const yt = settings.cb ? null : Tema.yemTon(o.tema);
        o.bas = (chaos.rule === 'ghost' || !renderPos.length) ? (snake[0] || null) : renderPos[0];
        o.yem = state.mode === 'tron' || state.mode === 'tapinak' ? null : food;
        o.yemRenk = food && food.type === 'super' ? '#ffdd00' : (yt ? yt.renk : '#ffbf2e');
        o.guclar = powerups; o.engeller = obstacles; o.korlar = movingObs; o.portallar = portals; o.mermiler = bullets;
        if (!o.gucRenk) o.gucRenk = { shield: CONFIG.COLORS.powerShield, speed: CONFIG.COLORS.powerSpeed, invincible: CONFIG.COLORS.powerInvincible, clear: CONFIG.COLORS.powerClear };
        o.hiz = !!powers.speed;
        o.tapinak = state.mode === 'tapinak' ? tp : null;
        o.torches = o.tapinak ? isikTorTp : isikTor;
        return o;
    }
    function isikZemin(c) { if (ISIK()) ISIK().zemin(c, isikOpts()); }
    function isikUst(c) { if (ISIK()) ISIK().ust(c, isikO); }
    function isikOlay(t, x, y, renk) { if (ISIK()) ISIK().olay(t, x, y, renk); }
    let nors = { bg: null, key: '' };
    let renderPos = [];

    function buildNorsBackground() {
        const W = CONFIG.WIDTH, H = CONFIG.HEIGHT, CELL = CONFIG.CELL;
        const c = document.createElement('canvas');
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
        const g = c.getContext('2d');
        g.scale(dpr, dpr);
        const sky = g.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#0a1226');
        sky.addColorStop(1, '#05080f');
        g.fillStyle = sky;
        g.fillRect(0, 0, W, H);
        // Taş plaka dokusu
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                g.fillStyle = (x + y) % 2 === 0 ? 'rgba(120,160,220,0.045)' : 'rgba(0,0,0,0.12)';
                g.fillRect(x * CELL, y * CELL, CELL, CELL);
            }
        }
        g.strokeStyle = 'rgba(110,170,255,0.09)';
        g.lineWidth = 1;
        g.beginPath();
        for (let x = 0; x <= W; x += CELL) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
        for (let y = 0; y <= H; y += CELL) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
        g.stroke();
        // Köşe rünleri
        g.strokeStyle = 'rgba(255,208,100,0.3)';
        g.lineWidth = 2;
        g.lineCap = 'round';
        const runes = [
            [[0, 0, 0, 10], [0, 0, 6, 5], [6, 5, 0, 10]],
            [[0, 0, 0, 10], [0, 5, 6, 0], [0, 5, 6, 10]],
            [[0, 0, 6, 10], [6, 0, 0, 10]],
            [[3, 0, 3, 10], [0, 3, 3, 0], [6, 3, 3, 0]]
        ];
        [[10, 10], [W - 22, 10], [10, H - 22], [W - 22, H - 22]].forEach((p, i) => {
            g.beginPath();
            runes[i].forEach(s => { g.moveTo(p[0] + s[0], p[1] + s[1]); g.lineTo(p[0] + s[2], p[1] + s[3]); });
            g.stroke();
        });
        // Altın çerçeve
        g.strokeStyle = 'rgba(255,208,100,0.35)';
        g.lineWidth = 2;
        g.strokeRect(1, 1, W - 2, H - 2);
        return c;
    }

    // Market kostümü: Tapınak karakteri etkilenmez, renk körüyken ve hatada eski yeşil görünüm
    function skinNow() {
        if (state.mode === 'tapinak' || typeof Market === 'undefined') return null;
        try { return Market.skinFor({ cb: settings.cb }); } catch (e) { return null; }
    }
    function gfxOpts() {
        return { yanim: ek('surunme'), hizMs: state.speed, calisiyor: state.running && !state.paused && !state.over, CELL: CONFIG.CELL, W: CONFIG.WIDTH, H: CONFIG.HEIGHT, COLS, ROWS, cb: settings.cb, pal: PALET, reduced: REDUCED, skin: skinNow(), all: renderPos, theme: Tema.etkin(state.mode, state.level), yemTema: settings.cb ? null : Tema.yemTon(Tema.etkin(state.mode, state.level)) };
    }
    function drawBackground(now) {
        const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
        if (G25()) { G25().drawBackground(ctx, now, gfxOpts()); return; }
        const key = dpr + ':' + W + 'x' + H;
        if (!nors.bg || nors.key !== key) { nors.bg = buildNorsBackground(); nors.key = key; }
        ctx.drawImage(nors.bg, 0, 0, W, H);
        const t = now / 1000;
        // Yıldızlar (0.3.0'ın kayan yıldızları korunur)
        STARS.forEach(st => {
            const x = (st.x + t * st.s * 6) % W;
            ctx.globalAlpha = 0.2 + 0.25 * Math.sin(t * st.s * 2 + st.p);
            ctx.fillStyle = st.p % 4 === 0 ? '#aad4ff' : '#ffffff';
            ctx.fillRect(x, st.y, st.r, st.r);
        });
        ctx.globalAlpha = 1;
        // Kuzey ışıkları
        if (!REDUCED) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 3; i++) {
                const cx = W * (0.2 + 0.3 * i) + Math.sin(t * 0.25 + i * 2) * 60;
                const cy = 40 + Math.sin(t * 0.18 + i) * 25;
                const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 190);
                const hue = i === 1 ? '90,255,200' : '80,160,255';
                g.addColorStop(0, `rgba(${hue},0.07)`);
                g.addColorStop(1, `rgba(${hue},0)`);
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, W, H);
            }
            ctx.restore();
        }
    }

    function drawBlock(x, y, color, highlight, ember) {
        const s = CONFIG.CELL;
        const px = x * s;
        const py = y * s;
        const t = performance.now() / 1000;
        if (ember) {
            ctx.shadowColor = '#ff6a00';
            ctx.shadowBlur = 10 + Math.sin(t * 5 + x) * 3;
        }
        const g = ctx.createLinearGradient(px, py, px + s, py + s);
        g.addColorStop(0, ember ? '#ffb347' : '#6d7192');
        g.addColorStop(1, ember ? '#b33a00' : '#2a2d44');
        ctx.fillStyle = g;
        ctx.fillRect(px + 1, py + 1, s - 2, s - 2);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(px + 1, py + 1, s - 2, 2);
        ctx.fillRect(px + 1, py + 1, 2, s - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(px + 1, py + s - 3, s - 2, 2);
        ctx.fillRect(px + s - 3, py + 1, 2, s - 2);
        const v = (x * 7 + y * 13) % 4;
        ctx.strokeStyle = ember ? 'rgba(80,20,0,0.65)' : 'rgba(180,215,255,0.55)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const cx = px + s / 2, cy = py + s / 2;
        if (v === 0) { ctx.moveTo(cx - 2, cy - 5); ctx.lineTo(cx - 2, cy + 5); ctx.moveTo(cx - 2, cy - 5); ctx.lineTo(cx + 3, cy - 1); ctx.lineTo(cx - 2, cy + 2); }
        else if (v === 1) { ctx.moveTo(cx - 3, cy - 5); ctx.lineTo(cx - 3, cy + 5); ctx.moveTo(cx - 3, cy); ctx.lineTo(cx + 3, cy - 5); ctx.moveTo(cx - 3, cy); ctx.lineTo(cx + 3, cy + 5); }
        else if (v === 2) { ctx.moveTo(cx - 4, cy - 5); ctx.lineTo(cx + 4, cy + 5); ctx.moveTo(cx + 4, cy - 5); ctx.lineTo(cx - 4, cy + 5); }
        else { ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5); ctx.moveTo(cx - 4, cy - 1); ctx.lineTo(cx, cy - 5); ctx.lineTo(cx + 4, cy - 1); }
        ctx.stroke();
    }

    function lerpPos(a, b, t) {
        if (!a || Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 1.5) return { x: b.x, y: b.y };
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }

    function rr(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    }

    function drawSnakeHead(pos) {
        if (G25()) { G25().drawSnakeHead(ctx, pos, dir, performance.now() / 1000, gfxOpts()); return; }
        const S = CONFIG.CELL;
        const t = performance.now() / 1000;
        const cx = pos.x * S + S / 2;
        const cy = pos.y * S + S / 2;
        const fx = dir.x, fy = dir.y;
        const px = -fy, py = fx;

        if ((t * 2.2) % 1 < 0.35) {
            const bx = cx + fx * 9, by = cy + fy * 9;
            const tx = cx + fx * 15, ty = cy + fy * 15;
            ctx.strokeStyle = '#ff4466';
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(tx, ty);
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + fx * 3 + px * 2.5, ty + fy * 3 + py * 2.5);
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + fx * 3 - px * 2.5, ty + fy * 3 - py * 2.5);
            ctx.stroke();
        }

        ctx.shadowColor = settings.cb ? PALET.yilan : '#00ffaa';
        ctx.shadowBlur = 18;
        const g = ctx.createRadialGradient(cx - fx * 2, cy - fy * 2, 1, cx, cy, 11);
        // eski (cb dahil): '#9dffd0' → '#13c27a'
        g.addColorStop(0, settings.cb ? PALET.ton(PALET.yilan, 0.45) : '#9dffd0');
        g.addColorStop(1, settings.cb ? PALET.yilan : '#13c27a');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(cx + fx * 1.5, cy + fy * 1.5, fx ? 10.5 : 9.5, fy ? 10.5 : 9.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = 'rgba(255,214,102,0.8)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - fx * 5 + px * 5, cy - fy * 5 + py * 5);
        ctx.lineTo(cx + fx * 4 + px * 5.5, cy + fy * 4 + py * 5.5);
        ctx.moveTo(cx - fx * 5 - px * 5, cy - fy * 5 - py * 5);
        ctx.lineTo(cx + fx * 4 - px * 5.5, cy + fy * 4 - py * 5.5);
        ctx.stroke();

        [1, -1].forEach(side => {
            const ex = cx + fx * 3 + px * 4.6 * side;
            const ey = cy + fy * 3 + py * 4.6 * side;
            ctx.shadowColor = '#ffd24a';
            ctx.shadowBlur = 6;
            ctx.fillStyle = '#ffd24a';
            ctx.beginPath();
            ctx.arc(ex, ey, 2.9, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#10110a';
            ctx.beginPath();
            ctx.ellipse(ex, ey, fx ? 0.8 : 1.5, fy ? 0.8 : 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function drawSnakeBody(pos, idx, total) {
        if (G25()) { G25().drawSnakeBody(ctx, pos, idx, total, gfxOpts()); return; }
        const S = CONFIG.CELL;
        const k = total > 1 ? idx / (total - 1) : 0;
        const r = Math.max(5.2, 8.6 - k * 3.2);
        // eski cb: `hsl(${208 - 10 * k} ${90 - 10 * k}% ${58 - 22 * k}%)`
        const col = settings.cb ? PALET.ton(PALET.yilan, -0.4 * k) : `hsl(${158 - 16 * k} ${88 - 14 * k}% ${50 - 22 * k}%)`;
        const cx = pos.x * S + S / 2, cy = pos.y * S + S / 2;
        const prev = renderPos[idx - 1];
        ctx.fillStyle = col;
        ctx.strokeStyle = col;
        ctx.lineCap = 'round';
        if (prev && Math.abs(prev.x - pos.x) + Math.abs(prev.y - pos.y) <= 1.5) {
            ctx.lineWidth = r * 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(prev.x * S + S / 2, prev.y * S + S / 2);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        }
        // Pul ve altın sırt elması
        ctx.strokeStyle = 'rgba(0,30,20,0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy + 1.5, r * 0.55, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        if (idx % 3 === 1) {
            ctx.fillStyle = `rgba(255,214,102,${Math.max(0.25, 0.9 - idx * 0.03)})`;
            ctx.beginPath();
            ctx.moveTo(cx, cy - 3);
            ctx.lineTo(cx + 2.6, cy);
            ctx.lineTo(cx, cy + 3);
            ctx.lineTo(cx - 2.6, cy);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawRottenFood(cx, cy, t) {
        // Çürük yem: koyu mor elma, yeşil duman; renk körü paletinde X işareti
        ctx.save();
        for (let i = 0; i < 3; i++) {
            const ph = (t * 0.8 + i * 0.33) % 1;
            ctx.globalAlpha = 0.35 * (1 - ph);
            ctx.fillStyle = '#7CFF6B';
            ctx.beginPath(); ctx.arc(cx - 4 + i * 4, cy - 8 - ph * 14, 2 + ph * 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        const g = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 9);
        g.addColorStop(0, '#9b6cc7'); g.addColorStop(1, '#3a1f52');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a1238';
        ctx.beginPath(); ctx.arc(cx + 3, cy + 1, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx + 2, cy - 12); ctx.stroke();
        if (settings.cb) {
            ctx.strokeStyle = PALET.curuk; ctx.lineWidth = 3; // eski: '#ffffff', 2
            ctx.beginPath(); ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5); ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx - 5, cy + 5); ctx.stroke();
        }
        ctx.restore();
    }
    function drawFood() {
        if (G25()) { G25().drawFood(ctx, food, performance.now() / 1000, gfxOpts()); return; }
        const S = CONFIG.CELL;
        const t = performance.now() / 1000;
        const isSuper = food.type === 'super';
        const cx = food.x * S + S / 2, cy = food.y * S + S / 2;
        const pulse = 1 + Math.sin(t * 5) * 0.1;
        if (food.type === 'curuk') { drawRottenFood(cx, cy, t); return; }
        const col = isSuper ? '#ffdd00' : (settings.cb ? PALET.yem : '#ffbf2e');

        const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, 20 * pulse);
        // cb: PALET.yem (#E69F00) = rgb(230,159,0); eski 'rgba(255,191,46,0.38)'
        halo.addColorStop(0, isSuper ? 'rgba(255,221,0,0.45)' : (settings.cb ? 'rgba(230,159,0,0.38)' : 'rgba(255,191,46,0.38)'));
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(cx - 22, cy - 22, 44, 44);
        if (settings.cb) { // şekil ipucu: beyaz halka
            ctx.strokeStyle = PALET.yemHalka; /* eski: '#ffffff' */ ctx.lineWidth = 2; ctx.setLineDash(isSuper ? [3, 3] : []);
            ctx.beginPath(); ctx.arc(cx, cy, 11 * pulse, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }

        if (isSuper) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(t * 1.5);
            ctx.shadowColor = '#ffdd00';
            ctx.shadowBlur = 18;
            const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 10);
            g.addColorStop(0, '#fffbe0');
            g.addColorStop(1, '#ffb800');
            ctx.fillStyle = g;
            ctx.beginPath();
            for (let i = 0; i < 12; i++) {
                const a = (i * 30 - 90) * Math.PI / 180;
                const r = (i % 2 === 0 ? 10 : 4.5) * pulse;
                const x = Math.cos(a) * r, y = Math.sin(a) * r;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            ctx.shadowBlur = 0;
        } else {
            ctx.shadowColor = '#ffb347';
            ctx.shadowBlur = 14 + Math.sin(t * 4) * 4;
            const g = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy + 1, 9 * pulse);
            g.addColorStop(0, '#fff2a8');
            g.addColorStop(0.55, '#ffbf2e');
            g.addColorStop(1, '#d4541a');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(cx, cy + 1.5, 7.6 * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#5a3a1a';
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(cx, cy - 5);
            ctx.lineTo(cx + 1, cy - 8.5);
            ctx.stroke();
            ctx.fillStyle = '#4ad36b';
            ctx.beginPath();
            ctx.ellipse(cx + 4, cy - 7, 3.6, 1.7, -0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.65)';
            ctx.beginPath();
            ctx.ellipse(cx - 3, cy - 1, 1.8, 2.8, -0.5, 0, Math.PI * 2);
            ctx.fill();
        }
        if (!REDUCED) {
            ctx.fillStyle = col;
            for (let k = 0; k < 3; k++) {
                const a = t * 2.2 + k * 2.094;
                ctx.globalAlpha = 0.7;
                ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, 1.4, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
    }
    
    // ---- efektler ----
    function burst(x, y, color, n, speed) {
        if (ISIK()) ISIK().patla(x, y, color, n);
        n = Math.round(n * settings.fx);
        if (REDUCED) n = Math.ceil(n / 3);
        for (let i = 0; i < n && particles.length < 400; i++) {
            const a = Math.random() * Math.PI * 2;
            const v = (1.5 + Math.random() * 4) * (speed || 1);
            const pp = { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.5, max: 1, color, r: 1.5 + Math.random() * 2.5 };
            if (typeof Parcacik !== 'undefined' && ek('pspr')) Parcacik.ekle(pp, 'patla');
            particles.push(pp);
        }
    }
    
    function spark(x, y) {
        if (particles.length > 380 || Math.random() > settings.fx) return;
        const sp = { x, y, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, life: 0.45, max: 0.45, color: '#00ffaa', r: 1.2 };
        if (typeof Parcacik !== 'undefined' && ek('pspr')) Parcacik.ekle(sp, 'kivilcim');
        particles.push(sp);
    }
    
    function addShake(m) { if (!REDUCED && settings.shake) shake.mag = Math.max(shake.mag, m); }
    
    function updateFx(dt) {
        shake.mag *= Math.pow(0.002, dt);
        if (shake.mag < 0.2) shake.mag = 0;
        // Yerinde sıkıştırma: her karede yeni dizi üretme
        let j = 0;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.97;
            p.vy *= 0.97;
            if (p.life > 0) particles[j++] = p;
        }
        particles.length = j;
    }
    
    function drawParticles() {
        const S = CONFIG.CELL;
        ctx.globalCompositeOperation = 'lighter';
        particles.forEach(p => {
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life / (p.max || 1)));
            if (p.s !== undefined && Parcacik.ciz(ctx, p, p.x * S, p.y * S, ctx.globalAlpha, 0.016)) return;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x * S, p.y * S, p.r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }
    
    let vigCache = { c: null, key: '' };
    function drawVignette() {
        const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
        // Her karede yeniden gradyan üretmek yerine bir kez çizilip önbelleğe alınır (görünüm aynı).
        const key = dpr + ':' + W + 'x' + H;
        if (!vigCache.c || vigCache.key !== key) {
            const c = document.createElement('canvas');
            c.width = Math.round(W * dpr);
            c.height = Math.round(H * dpr);
            const g = c.getContext('2d');
            g.scale(dpr, dpr);
            const v = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.65);
            v.addColorStop(0, 'rgba(0,0,0,0)');
            v.addColorStop(1, 'rgba(0,0,0,0.45)');
            g.fillStyle = v;
            g.fillRect(0, 0, W, H);
            vigCache = { c, key };
        }
        ctx.drawImage(vigCache.c, 0, 0, W, H);
    }
    
    function drawBullet(b) {
        const S = CONFIG.CELL;
        const cx = b.x * S + S / 2;
        const cy = b.y * S + S / 2;
        const t = performance.now() / 1000;
        const bc = Tema.ton('mermi', b.color || (b.homing ? CONFIG.COLORS.bulletHoming : CONFIG.COLORS.bullet), Tema.etkin(state.mode, state.level), settings.cb);

        // Ateş topu: dış hale + sıcak çekirdek + titreşen kıvılcım
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const halo = ctx.createRadialGradient(cx, cy, 1, cx, cy, 12);
        halo.addColorStop(0, bc);
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.72;
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.shadowColor = bc;
        ctx.shadowBlur = 10;
        ctx.fillStyle = bc;
        ctx.beginPath();
        ctx.arc(cx, cy, 5.2 + Math.sin(t * 18 + b.x) * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff6d8';
        ctx.beginPath();
        ctx.arc(cx - 1, cy - 1, 2.2, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawPowerup(p) {
        if (G25()) {
            const o = gfxOpts();
            o.colors = { shield: CONFIG.COLORS.powerShield, speed: CONFIG.COLORS.powerSpeed, invincible: CONFIG.COLORS.powerInvincible, clear: CONFIG.COLORS.powerClear };
            G25().drawPowerup(ctx, p, performance.now() / 1000, o);
            return;
        }
        const S = CONFIG.CELL;
        const px = p.x * S;
        const py = p.y * S;
        const cx = px + S / 2, cy = py + S / 2;
        const t = performance.now() / 1000;

        const colors = {
            shield: CONFIG.COLORS.powerShield,
            speed: CONFIG.COLORS.powerSpeed,
            invincible: CONFIG.COLORS.powerInvincible,
            clear: CONFIG.COLORS.powerClear
        };
        const icons = { shield: '🛡️', speed: '⚡', invincible: '🌟', clear: '💥' };
        const col = colors[p.type];

        // Rün taşı: dönen elmas çerçeve + içte yumuşak ışık
        ctx.save();
        ctx.translate(cx, cy);
        ctx.shadowColor = col;
        ctx.shadowBlur = 12 + Math.sin(t * 6) * 4;
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 10);
        g.addColorStop(0, 'rgba(255,255,255,0.55)');
        g.addColorStop(1, col);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = g;
        ctx.rotate(Math.PI / 4 + Math.sin(t * 2) * 0.12);
        ctx.fillRect(-7, -7, 14, 14);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.strokeRect(-7, -7, 14, 14);
        ctx.restore();
        ctx.shadowBlur = 0;

        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icons[p.type], cx, cy + 0.5);
    }

    function drawAura(pos, color, radius) {
        const S = CONFIG.CELL;
        const cx = pos.x * S + S / 2;
        const cy = pos.y * S + S / 2;
        const t = performance.now() / 1000;

        // Dönen kesikli rün halkası + yumuşak parıltı
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius * 1.3);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, color);
        ctx.globalAlpha = 0.22 + Math.sin(t * 6) * 0.08;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6 + Math.sin(t * 6) * 0.25;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -t * 30;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
    }

    function drawPortal(p) {
        if (p.cool > 0 && ek('soguyan')) { ctx.save(); ctx.globalAlpha = 0.3; drawPortalAsil(p); ctx.restore(); return; }
        drawPortalAsil(p);
    }
    function drawPortalAsil(p) {
        if (G25()) { G25().drawPortal(ctx, p, performance.now() / 1000, gfxOpts()); return; }
        const S = CONFIG.CELL;
        const t = performance.now() / 1000;
        [p.a, p.b].forEach(c => {
            const cx = c.x * S + S / 2, cy = c.y * S + S / 2;

            // Girdap: iç parıltı + ters yönde dönen iki halka + merkez noktası
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, 14);
            g.addColorStop(0, p.color);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 0.4 + Math.sin(t * 4) * 0.1;
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(cx, cy, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.shadowColor = p.color;
            ctx.shadowBlur = 12;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(cx, cy, 8.5, t * 3, t * 3 + Math.PI * 1.6);
            ctx.stroke();
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 4.5, -t * 4, -t * 4 + Math.PI * 1.4);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(cx - 1, cy - 1, 2, 2);
        });
    }

    function drawTronLayer() {
        const S = CONFIG.CELL;
        if (tron.gaps && tron.gaps.size) { // geçit işareti: izin üstünde soluk altın halka
            ctx.save(); ctx.strokeStyle = 'rgba(232,196,106,0.85)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
            tron.gaps.forEach(k => { const [gx, gy] = k.split(',').map(Number); ctx.beginPath(); ctx.arc(gx * S + S / 2, gy * S + S / 2, 10, 0, Math.PI * 2); ctx.stroke(); });
            ctx.restore();
        }
        // Rakip yılan: kor/bakır renkli, aynı kesintisiz gövde diliyle
        ctx.lineCap = 'round';
        for (let i = tron.ai.length - 1; i >= 0; i--) {
            const c = tron.ai[i];
            const cx = c.x * S + S / 2, cy = c.y * S + S / 2;
            const k = tron.ai.length > 1 ? i / (tron.ai.length - 1) : 0;
            const r = i === 0 ? 9 : Math.max(5, 8 - k * 3);
            // cb: Tron rakibi sarı (#F0E442); eski '#ffd27a' / `hsl(${28 - 8 * k} 90% ${52 - 20 * k}%)`
            ctx.fillStyle = settings.cb ? (i === 0 ? PALET.ton(PALET.tron, 0.3) : PALET.ton(PALET.tron, -0.4 * k)) : (i === 0 ? '#ffd27a' : `hsl(${28 - 8 * k} 90% ${52 - 20 * k}%)`);
            if (i === 0) { ctx.shadowColor = settings.cb ? PALET.tron : '#ff8a00'; ctx.shadowBlur = 12; }
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            if (i > 0) {
                const n = tron.ai[i - 1];
                if (Math.abs(n.x - c.x) + Math.abs(n.y - c.y) === 1) {
                    ctx.strokeStyle = ctx.fillStyle;
                    ctx.lineWidth = r * 2;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.lineTo(n.x * S + S / 2, n.y * S + S / 2);
                    ctx.stroke();
                }
            }
        }
        // Kor çizgisi: gövde ortasında ince parlak sırt, başta yönlü göz ve çatal dil (oyuncu yılanıyla aynı dil)
        if (tron.ai.length > 1) {
            ctx.lineWidth = 2;
            ctx.strokeStyle = settings.cb ? PALET.ton(PALET.tron, 0.35) : 'rgba(255,225,150,0.55)';
            ctx.beginPath();
            for (let i = tron.ai.length - 1; i >= 0; i--) {
                const c = tron.ai[i], px = c.x * S + S / 2, py = c.y * S + S / 2;
                const p = tron.ai[i + 1];
                if (i === tron.ai.length - 1 || Math.abs(p.x - c.x) + Math.abs(p.y - c.y) !== 1) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }
        const h = tron.ai[0], d = tron.aiDir || { x: -1, y: 0 };
        const hx = h.x * S + S / 2, hy = h.y * S + S / 2, sx = -d.y, sy = d.x; // yan eksen
        ctx.fillStyle = '#1a0f05';
        for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(hx + d.x * 3 + sx * s * 4, hy + d.y * 3 + sy * s * 4, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.strokeStyle = '#ff5e5e'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hx + d.x * 9, hy + d.y * 9);
        ctx.lineTo(hx + d.x * 14, hy + d.y * 14);
        ctx.moveTo(hx + d.x * 14, hy + d.y * 14); ctx.lineTo(hx + d.x * 17 + sx * 2.5, hy + d.y * 17 + sy * 2.5);
        ctx.moveTo(hx + d.x * 14, hy + d.y * 14); ctx.lineTo(hx + d.x * 17 - sx * 2.5, hy + d.y * 17 - sy * 2.5);
        ctx.stroke();
    }

    // ======================== TRON ========================
    // Saf Tron YZ mantığı src/core/tron.js içinde (window.YilanCore.tron)
    const TronCore = window.YilanCore.tron;
    // İz boşluğu: geçit hücreleri duvar sayılmaz (hem oyuncu hem YZ için; çekirdeğe filtrelenmiş diziler gider)
    function tronArr(a) { return tron.gaps && tron.gaps.size ? a.filter(c => !tron.gaps.has(c.x + ',' + c.y)) : a; }
    function tronBlocked(x, y) { return TronCore.tronBlocked(x, y, COLS, ROWS, tronArr(snake), tronArr(tron.ai), null); }
    function aiChooseDir() {
        const args = { COLS, ROWS, snake: tronArr(snake), ai: tronArr(tron.ai), aiDir: tron.aiDir, nextDir, wins: state.score };
        // Rust/wasm çekirdeği hazırsa onu kullan; yüklenmediyse ya da girdi geçersizse JS yedeği.
        const W = window.YilanCore.wasm;
        if (W) { const d = W.aiChooseDir(args, Math.random(), Math.random()); if (d) return d; }
        return TronCore.aiChooseDir({ ...args, rand: Math.random });
    }

    function tronWin() {
        state.score++;
        state.round = (state.round || 1) + 1;
        tron.round++;
        updateHUD();
        document.getElementById('hudLevel').textContent = tron.round;
        playSound('complete');
        setSpeed(Math.max(60, 105 - state.score * 3));
        if (tron.twoP) {
            document.getElementById('hudTarget').textContent = state.score + ' - ' + tron.p2Wins;
            if (state.score >= TRON_HEDEF) { showBanner('P1 KAZANDI!'); endGame(); return; }
            tronReset();
            showBanner('P1 TURU ALDI');
            return;
        }
        if (state.score >= 3) unlockAch('tron3');
        tronReset();
        showBanner('TUR KAZANDIN! SIRADAKİ TUR');
    }
    function tronP2Win() {
        tron.p2Wins++;
        tron.round++;
        document.getElementById('hudLevel').textContent = tron.round;
        document.getElementById('hudTarget').textContent = state.score + ' - ' + tron.p2Wins;
        playSound('complete');
        if (tron.p2Wins >= TRON_HEDEF) { showBanner('P2 KAZANDI!'); endGame(); return; }
        tronReset();
        showBanner('P2 TURU ALDI');
    }
    
    function tickTron() {
        dir = { ...nextDir };
        tron.aiDir = tron.twoP ? { ...tron.p2Next } : aiChooseDir();
        let ph = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        const ah = { x: tron.ai[0].x + tron.aiDir.x, y: tron.ai[0].y + tron.aiDir.y };
        if (ek('parlama')) { // Parlama Atılımı: araya giren 2 hücre iz bırakmaz; iniş hücresi doluysa atılım iptal
            if (tron.sicra) {
                tron.sicra = false;
                const l = { x: snake[0].x + dir.x * 3, y: snake[0].y + dir.y * 3 };
                if (!tronBlocked(l.x, l.y) && !(l.x === ah.x && l.y === ah.y)) { ph = l; tron.enerji = 0; tron.atildi = performance.now(); showBanner('PARLAMA!', false, 600); playSound('start'); }
            } else if (tron.enerji < 30 && ++tron.enerji === 30) showBanner('ATILIM HAZIR · O', false, 1200);
        }
        const pDead = tronBlocked(ph.x, ph.y) || (ph.x === ah.x && ph.y === ah.y);
        const aDead = tronBlocked(ah.x, ah.y) || (ph.x === ah.x && ph.y === ah.y);
        if (pDead && aDead) {
            tronReset();
            showBanner('BERABERE! TUR YENİLENDİ');
            return;
        }
        if (pDead) { if (tron.twoP) tronP2Win(); else endGame(); return; }
        if (aDead) { tronWin(); return; }
        snake.unshift(ph);
        tron.ai.unshift(ah);
        if (ek('tizbos') && ++tron.gapN % 30 === 0 && snake.length > 8 && tron.ai.length > 8) { // her 30 tikte iki izde 2 hücrelik geçit
            for (const a of [snake, tron.ai]) for (const i of [4, 5]) tron.gaps.add(a[i].x + ',' + a[i].y);
        }
    }
    
    const CHAOS_KURALLAR = [
        ['reverse', 'TERS KONTROL!', 'TERS'],
        ['fast', 'HIZLANDIN!', 'HIZLI'],
        ['slow', 'YAVAŞLADIN', 'YAVAŞ'],
        ['ghost', 'GÖVDE GÖRÜNMEZ', 'HAYALET'],
        ['triple', 'YEMLER x3 SKOR', 'x3']
    ];
    function tickChaos() {
        // Çürük yem tek yem olup oyunu kilitlemesin: 60 tik sonra normal yeme döner
        if (food && food.type === 'curuk' && ++food.age >= 60) food.type = 'normal';
        if (ek('cekim') && !state.ekYem && Math.random() < 0.006) ekYemUret('cekim', 70);
        if (chaos.rule) {
            chaos.left--;
            if (chaos.left === 10) showBanner(chaos.kisa + ' BİTİYOR', false, 1200, 'soluk'); // bitiş ipucu
            if (chaos.left <= 0) {
                if (chaos.rule === 'fast' || chaos.rule === 'slow') setSpeed(chaos.saved);
                chaos.rule = null;
                document.getElementById('hudLevel').textContent = '-';
                showBanner('KURAL BİTTİ');
            }
            return;
        }
        chaos.next--;
        if (chaos.next === 15 && !chaos.pending) { // ön uyarı: kural şimdi seçilir (tek rastgele çağrı, yalnız erken), gelince aynısı uygulanır
            chaos.pending = CHAOS_KURALLAR[Math.floor(Math.random() * CHAOS_KURALLAR.length)];
            showBanner('YAKINDA: ' + chaos.pending[2], false, 1500, 'soluk');
        }
        if (chaos.next > 0) return;
        const [rule, label, kisa] = chaos.pending || CHAOS_KURALLAR[Math.floor(Math.random() * CHAOS_KURALLAR.length)];
        chaos.pending = null;
        chaos.rule = rule;
        chaos.kisa = kisa;
        chaos.left = 70;
        chaos.next = 140;
        chaos.saved = state.speed;
        if (rule === 'fast') setSpeed(Math.round(state.speed * 0.65));
        if (rule === 'slow') setSpeed(Math.round(state.speed * 1.5));
        document.getElementById('hudLevel').textContent = kisa;
        showBanner(label);
        playSound('powerup');
    }
    
    // ======================== AUDIO ========================
    function toggleSound() {
        soundOn = !soundOn;
        try { localStorage.setItem('twilightSound', soundOn ? '1' : '0'); } catch (e) {}
        refreshSoundBtn();
        if (soundOn) playSound('eat');
    }
    
    function refreshSoundBtn() {
        const b = document.getElementById('soundBtn');
        if (b) b.innerHTML = ikon(soundOn ? 'sound' : 'soundoff') + (soundOn ? 'Ses: açık' : 'Ses: kapalı');
        if (!soundOn) stopMusic(); else if (state.running) startMusic();
    }
    
    // Odak kaybında ses bağlamı askıya alınır (arka planda zamanlayıcı kısıldığı için müzik kesik çalmasın); dönüşte devam eder
    let audioHeld = false;
    function holdAudio(hold) {
        audioHeld = !!hold;
        if (!audio) return;
        try { (hold ? audio.suspend() : audio.resume()).catch(() => {}); } catch (e) {}
    }
    function ensureAudio() {
        if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
        if (audio.state === 'suspended' && !audioHeld) audio.resume().catch(() => {});
        if (!masterGain) { masterGain = audio.createGain(); masterGain.gain.value = settings.vol; masterGain.connect(audio.destination); }
        return audio;
    }
    
    function tone(freq, wave, dur, vol, when, slideTo) {
        const a = ensureAudio();
        const t = when || a.currentTime;
        const osc = a.createOscillator();
        const g = a.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(freq, t);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g); g.connect(masterGain);
        osc.start(t); osc.stop(t + dur + 0.02);
    }
    
    function playSound(type) {
        if (!soundOn) return;
        try {
            const a = ensureAudio();
            const t = a.currentTime;
            switch (type) {
                case 'eat': tone(520, 'square', 0.07, 0.12, t); tone(780, 'square', 0.08, 0.08, t + 0.06); break;
                case 'supereat': [660, 880, 1100, 1320].forEach((f, i) => tone(f, 'triangle', 0.1, 0.12, t + i * 0.05)); break;
                case 'hit': tone(160, 'sawtooth', 0.2, 0.16, t, 60); tone(90, 'square', 0.25, 0.1, t); break;
                case 'powerup': [440, 554, 659, 880].forEach((f, i) => tone(f, 'sine', 0.12, 0.12, t + i * 0.06)); break;
                case 'graze': tone(1500, 'sine', 0.05, 0.05, t, 2200); break;
                case 'shield': tone(320, 'triangle', 0.15, 0.12, t, 480); break;
                case 'start': tone(440, 'square', 0.08, 0.1, t); tone(660, 'square', 0.1, 0.1, t + 0.1); break;
                case 'gameover': tone(220, 'sawtooth', 0.5, 0.16, t, 55); tone(110, 'triangle', 0.7, 0.12, t + 0.1, 40); break;
                case 'complete': [523, 659, 784, 1047].forEach((f, i) => tone(f, 'triangle', 0.18, 0.14, t + i * 0.09)); break;
                case 'ach': [784, 988, 1175, 1568].forEach((f, i) => tone(f, 'sine', 0.2, 0.12, t + i * 0.07)); break;
                default: tone(440, 'square', 0.08, 0.1, t);
            }
        } catch (e) {}
    }
    
    // ======================== MÜZİK (prosedürel) ========================
    let musicTimer = null, musicNext = 0, musicStep = 0, musicDrone = null;
    const SCALE = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 293.66, 329.63];
    function startMusic() {
        if (!soundOn || !settings.music || musicTimer) return;
        try {
            const a = ensureAudio();
            musicNext = a.currentTime + 0.1;
            musicStep = 0;
            const d = a.createOscillator(), dg = a.createGain(), lp = a.createBiquadFilter();
            const mz = Tema.muzik(Tema.etkin(state.mode, state.level)); // Tema: perde ve davul filtresi
            d.type = 'sawtooth'; d.frequency.value = 55 * mz.carp; lp.type = 'lowpass'; lp.frequency.value = mz.lp;
            dg.gain.setValueAtTime(0.0001, a.currentTime); dg.gain.exponentialRampToValueAtTime(0.035, a.currentTime + 0.3);
            d.connect(lp); lp.connect(dg); dg.connect(masterGain); d.start();
            musicDrone = { osc: d, gain: dg };
            musicTimer = setInterval(scheduleMusic, 200);
        } catch (e) {}
    }
    function scheduleMusic() {
        if (!audio) return;
        const beat = 60 / 96;
        while (musicNext < audio.currentTime + 0.5) {
            const bar = Math.floor(musicStep / 8) % 4;
            const inBar = musicStep % 8;
            let idx = [0, 2, 4, 5][bar] + [0, 2, 4, 2, 5, 4, 2, 0][inBar];
            if (Math.random() < 0.25) idx += Math.random() < 0.5 ? 1 : -1;
            idx = Math.max(0, Math.min(SCALE.length - 1, idx));
            const vol = inBar === 0 ? 0.07 : 0.045;
            const pc = Tema.muzik(Tema.etkin(state.mode, state.level)).carp;
            tone(SCALE[idx] * pc, 'triangle', beat * 0.9, vol, musicNext);
            if (inBar === 0 || inBar === 4) tone(SCALE[idx] * pc / 2, 'sine', beat * 1.8, 0.05, musicNext);
            musicNext += beat * (inBar % 2 === 0 ? 1 : 0.5);
            musicStep++;
        }
    }
    function stopMusic() {
        if (musicTimer) clearInterval(musicTimer);
        musicTimer = null;
        if (musicDrone) {
            try {
                const now = audio.currentTime, gp = musicDrone.gain.gain;
                gp.cancelScheduledValues(now); gp.setValueAtTime(Math.max(gp.value, 0.0001), now);
                gp.exponentialRampToValueAtTime(0.0001, now + 0.4); musicDrone.osc.stop(now + 0.5);
            } catch (e) {}
            musicDrone = null;
        }
    }
    function toggleMusic() {
        setSetting('music', !settings.music);
        if (!settings.music) stopMusic(); else if (state.running) startMusic();
    }
    
    // ======================== AYARLAR ========================
    function loadSettings() {
        try {
            const raw = JSON.parse(localStorage.getItem('twilightSettings')) || {};
            const num = (k, lo, hi) => { const v = Number(raw[k]); if (Number.isFinite(v) && v >= lo && v <= hi) settings[k] = v; };
            const bool = k => { if (typeof raw[k] === 'boolean') settings[k] = raw[k]; };
            num('speed', 0.7, 1.5); num('fx', 0, 1.5); num('vol', 0, 1);
            ['reduced', 'shake', 'music', 'bigHud', 'cb', 'tron2p'].forEach(bool);
            if (raw.ek && typeof raw.ek === 'object') EK_LISTE.forEach(([id]) => { if (typeof raw.ek[id] === 'boolean') settings.ek[id] = raw.ek[id]; });
        } catch (e) {}
        applySettings();
    }
    function applySettings() {
        REDUCED = SYS_REDUCED || !!settings.reduced;
        document.documentElement.classList.toggle('reduced', REDUCED);
        document.documentElement.classList.toggle('buyuk-hud', !!settings.bigHud);
        document.documentElement.classList.toggle('cb', !!settings.cb);
        const t2 = document.getElementById('tron2pBtn');
        if (t2) { t2.textContent = settings.tron2p ? '👥 2P: AÇIK' : '👤 2P: KAPALI'; t2.classList.toggle('on', !!settings.tron2p); }
        if (masterGain && audio) masterGain.gain.setTargetAtTime(settings.vol, audio.currentTime, 0.02);
        if (state.running && !state.paused && loopInterval) { clearInterval(loopInterval); loopInterval = setInterval(tick, effSpeed()); }
        const $ = id => document.getElementById(id);
        if ($('setSpeed')) {
            $('setSpeed').value = settings.speed; $('valSpeed').textContent = settings.speed.toFixed(2).replace(/0$/, '') + 'x';
            $('setFx').value = settings.fx; $('valFx').textContent = Math.round(settings.fx * 100) + '%';
            $('setVol').value = settings.vol; $('valVol').textContent = Math.round(settings.vol * 100) + '%';
            const tg = (id, on) => { $(id).textContent = on ? 'AÇIK' : 'KAPALI'; $(id).classList.toggle('on', on); $(id).setAttribute('aria-pressed', on ? 'true' : 'false'); };
            tg('setReduced', !!settings.reduced); tg('setShake', !!settings.shake); tg('setMusic', !!settings.music); tg('setBigHud', !!settings.bigHud); tg('setCb', !!settings.cb);
            ekCiz();
            const mb = $('musicBtn'); if (mb) mb.innerHTML = ikon('music') + (settings.music ? 'Müzik: açık' : 'Müzik: kapalı');
        }
    }
    function ekCiz() {
        const kap = document.getElementById('ekRows');
        if (!kap) return;
        if (!kap.dataset.cizildi) {
            kap.innerHTML = EK_LISTE.map(([id, ad, acik]) => '<div class="row"><label>' + ad + '<small>' + acik + '</small></label><button class="toggle" id="ek_' + id + '" data-act="ekToggle" data-key="' + id + '">AÇIK</button></div>').join('');
            kap.dataset.cizildi = '1';
        }
        EK_LISTE.forEach(([id]) => { const b = document.getElementById('ek_' + id), on = ek(id); if (b) { b.textContent = on ? 'AÇIK' : 'KAPALI'; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); } });
    }
    function ekSet(id, on) { settings.ek[id] = !!on; setSetting('ek', settings.ek); }
    function setSetting(k, v) {
        settings[k] = v;
        try { localStorage.setItem('twilightSettings', JSON.stringify(settings)); } catch (e) {}
        applySettings();
    }
    function getSettings() { return { ...settings }; }
    function openSettings() {
        applySettings();
        const $ = id => document.getElementById(id);
        if (!$('setSpeed').dataset.bound) {
            $('setSpeed').oninput = e => setSetting('speed', Number(e.target.value));
            $('setFx').oninput = e => setSetting('fx', Number(e.target.value));
            $('setVol').oninput = e => setSetting('vol', Number(e.target.value));
            $('setSpeed').dataset.bound = '1';
        }
        $('settingsPanel').classList.add('active');
        panelOpen('settingsPanel');
    }
    function closeSettings() { document.getElementById('settingsPanel').classList.remove('active'); panelClosed(); }
    // Panel odak yönetimi: açılınca ilk düğmeye, kapanınca açan öğeye dön; Escape açık paneli kapatır
    let panelOpener = null;
    function panelOpen(id) { panelOpener = document.activeElement; const b = document.querySelector('#' + id + ' button:not(:disabled)'); if (b) b.focus(); }
    function panelClosed() { if (panelOpener && panelOpener.focus) panelOpener.focus(); panelOpener = null; }
    function closeOpenPanel() {
        if (document.getElementById('settingsPanel').classList.contains('active')) { closeSettings(); return true; }
        if (document.getElementById('achPanel').classList.contains('active')) { closeAchievements(); return true; }
        if (document.getElementById('mirasPanel').classList.contains('active')) { closeMiras(); return true; }
        if (document.getElementById('marketPanel').classList.contains('active')) { closeMarket(); return true; }
        return false;
    }
    
    // ======================== BAŞARIMLAR ========================
    const ACH = [
        { id: 'ilkyem', ic: '🍎', t: 'İlk Lokma', d: 'İlk yemi ye.' },
        { id: 'klasik50', ic: '🐍', t: 'Uzun Yılan', d: 'Klasik modda 50 skor.' },
        { id: 'klasik100', ic: '👑', t: 'Jörmungandr', d: 'Klasik modda 100 skor.' },
        { id: 'boss', ic: '💀', t: 'Patron Avcısı', d: "Mermi Manyağı'nda bir patronu yen." },
        { id: 'sv5', ic: '🧟', t: 'Hayatta Kalan', d: "Hayatta Kalma'da 5. seviyeye ulaş." },
        { id: 'sv10', ic: '⚔️', t: 'Einherjar', d: "Hayatta Kalma'da 10. seviyeye ulaş." },
        { id: 'tron3', ic: '🏍️', t: 'Düellocu', d: "Tron Düellosu'nda 3 tur kazan." },
        { id: 'zaman30', ic: '⏱️', t: 'Zamanı Bük', d: "Zamana Karşı'da 30 skor." },
        { id: 'portal20', ic: '🌀', t: 'Bifröst', d: 'Portal modunda 20 skor.' },
        { id: 'kaos15', ic: '🌪️', t: "Loki'nin Oyunu", d: 'Kaos modunda 15 skor.' },
        { id: 'gunluk', ic: '📅', t: 'Günün Yılanı', d: "Günlük Meydan Okuma'yı oyna." },
        { id: 'star3', ic: '⭐', t: 'Üç Yıldız', d: 'Bir bölümü 3 yıldızla bitir.' },
        { id: 'bolum10', ic: '🏔️', t: 'Midgard', d: '10. bölümü bitir.' },
        { id: 'bolum30', ic: '🌅', t: 'Alacakaranlık', d: '30. bölümü bitir.' }
    ];
    function unlockAch(id) {
        if (unlocked[id]) return false;
        unlocked[id] = Date.now();
        saveData();
        refreshAchCount();
        const a = ACH.find(x => x.id === id);
        if (a) showToast(a.ic + ' BAŞARIM: ' + a.t.toLocaleUpperCase('tr-TR'));
        playSound('ach');
        return true;
    }
    function checkAch(ev) {
        if (state.score >= 1) unlockAch('ilkyem');
        const m = state.mode, sc = state.score;
        if (m === 'classic' && sc >= 50) unlockAch('klasik50');
        if (m === 'classic' && sc >= 100) unlockAch('klasik100');
        if (m === 'timeattack' && sc >= 30) unlockAch('zaman30');
        if (m === 'portal' && sc >= 20) unlockAch('portal20');
        if (m === 'chaos' && sc >= 15) unlockAch('kaos15');
    }
    function refreshAchCount() {
        const el = document.getElementById('achCount');
        if (el) el.textContent = Object.keys(unlocked).length + '/' + ACH.length;
    }
    let toastTimer = null;
    function showToast(text) {
        const t = document.getElementById('toast');
        if (!t) return;
        t.textContent = text;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
    }
    function rozetler() {
        const r = records, bol = Math.max(0, progress.unlocked - 1), yil = Object.keys(progress.stars || {}).reduce((a, k) => a + (progress.stars[k] || 0), 0), moda = ['classic', 'bullet', 'tailgun', 'survivor', 'timeattack', 'portal', 'tron', 'chaos', 'daily', 'tapinak'].filter(k => (r[k] || 0) > 0).length;
        return [
            { ic: '🥉', t: 'Bronz Yılan', d: 'Klasik modda 25 skor.', on: (r.classic || 0) >= 25 },
            { ic: '🥈', t: 'Gümüş Yılan', d: 'Klasik modda 75 skor.', on: (r.classic || 0) >= 75 },
            { ic: '🥇', t: 'Altın Yılan', d: 'Klasik modda 150 skor.', on: (r.classic || 0) >= 150 },
            { ic: '🧭', t: 'Gezgin', d: '5 farklı modda skor yap.', on: moda >= 5 },
            { ic: '🌍', t: 'Dokuz Diyar', d: 'Tüm modlarda skor yap.', on: moda >= 10 },
            { ic: '🏞️', t: 'Yol Arkadaşı', d: '5 bölüm bitir.', on: bol >= 5 },
            { ic: '🗻', t: 'Dağ Aşan', d: '20 bölüm bitir.', on: bol >= 20 },
            { ic: '✨', t: 'Yıldız Toplayıcı', d: 'Toplam 30 yıldız topla.', on: yil >= 30 },
            { ic: '🏆', t: 'Koleksiyoncu', d: '10 başarım aç.', on: Object.keys(unlocked).length >= 10 },
            { ic: '🔥', t: 'Ateşli', d: 'Mermi Manyağı veya Hayatta Kalma\'da 50 skor.', on: (r.bullet || 0) >= 50 || (r.survivor || 0) >= 50 }
        ];
    }
    function openAchievements() {
        const acik = ACH.filter(a => unlocked[a.id]).length;
        document.getElementById('achSum').innerHTML = `<span><b>${acik}</b> / ${ACH.length} açıldı</span><div class="ach-bar" aria-hidden="true"><div style="width:${Math.round(acik / ACH.length * 100)}%"></div></div>`;
        document.getElementById('achList').innerHTML = ACH.map(a => `<div class="ach ${unlocked[a.id] ? 'on' : ''}"><span class="ic">${unlocked[a.id] ? a.ic : ikon('lock', 'kilit')}</span><div><b>${a.t}</b><span>${a.d}</span></div></div>`).join('');
        if (ek('rozet')) document.getElementById('achList').innerHTML += '<h3 class="rozet-bas">ROZETLER</h3>' + rozetler().map(r => `<div class="ach ${r.on ? 'on' : ''}"><span class="ic">${r.on ? r.ic : ikon('lock', 'kilit')}</span><div><b>${r.t}</b><span>${r.d}</span></div></div>`).join('');
        document.getElementById('achPanel').classList.add('active');
        panelOpen('achPanel');
    }
    function closeAchievements() { document.getElementById('achPanel').classList.remove('active'); panelClosed(); }
    
    // ======================== MİRAS (kalıcı tecrübe) ========================
    function mirasVer(elId, ver, won) {
        const el = document.getElementById(elId);
        if (state.mirasVerildi || !ver) {
            if (el && !ver) { el.textContent = ''; const m0 = document.getElementById(elId + 'Market'); if (m0) m0.textContent = ''; }
            return;
        }
        state.mirasVerildi = true;
        const r = Miras.award({ mode: state.mode, score: state.score, won: !!won });
        state.mirasSonuc = r;
        if (el) el.innerHTML = '<svg class="ik kul-ik" aria-hidden="true" focusable="false"><use href="#i-flame"/></svg> +' + r.gained + ' KÜL';
        const mm = document.getElementById(elId + 'Market'); // bakiye bir kostüme yetiyorsa küçük ipucu
        if (mm) mm.textContent = (typeof Market !== 'undefined' && Market.affordableNew()) ? "Market'te yeni kostüm alabilirsin" : '';
        if (r.levelUp) showToast('🔥 MİRAS SEVİYE ' + r.level + '!');
        refreshMirasBtn();
    }
    function refreshMirasBtn() {
        const el = document.getElementById('mirasInfo');
        if (el) el.textContent = 'Sv.' + Miras.seviye + ' · ' + Miras.kul;
        const mk = document.getElementById('marketInfo');
        if (mk) mk.textContent = Miras.kul;
    }
    function renderMiras() {
        const $ = id => document.getElementById(id);
        const p = Miras.progress();
        $('mirasLevel').textContent = p.seviye;
        $('mirasKul').textContent = Miras.kul;
        $('mirasBar').style.width = Math.round(p.mevcut / p.gerek * 100) + '%';
        $('mirasBarWrap').setAttribute('aria-valuenow', Math.round(p.mevcut / p.gerek * 100));
        $('mirasBarWrap').setAttribute('aria-valuetext', p.mevcut + ' / ' + p.gerek);
        $('mirasBarTxt').textContent = p.mevcut + ' / ' + p.gerek;
        $('mirasList').innerHTML = Miras.YETENEK.map(t => {
            const k = Miras.tier(t.id), c = Miras.cost(t.id);
            let pips = '';
            for (let q = 0; q < Miras.MAX_TIER; q++) pips += '<i class="pip' + (q < k ? ' on' : '') + '"></i>';
            const sonraki = c === null ? 'TAM' : t.fmt(t.etki[k + 1]);
            const d = c === null ? 'disabled' : (Miras.kul < c ? 'disabled' : '');
            return `<div class="miras-card ${k ? 'on' : ''}"><span class="ic" aria-hidden="true">${t.ic}</span><div class="mi"><b>${t.ad}<em class="pips" role="img" aria-label="Kademe ${k} / ${Miras.MAX_TIER}">${pips}</em></b><span>${t.acik}</span><span class="now">${k ? 'Şimdi: ' + t.fmt(t.etki[k]) : 'Alınmadı'}${c === null ? '' : ' → ' + sonraki}</span></div><button class="toggle buy${c === null ? ' tam' : (d ? '' : ' can')}" data-act="mirasBuy" data-id="${t.id}" ${d}>${c === null ? ikon('check') + 'TAM' : ikon('flame') + c + ' KÜL'}</button></div>`;
        }).join('');
    }
    function mirasBuy(id) {
        if (Miras.buy(id)) playSound('powerup');
        renderMiras();
        refreshMirasBtn();
        const yb = document.querySelector('#mirasList [data-id="' + id + '"]:not(:disabled)') || document.querySelector('#mirasPanel .close');
        if (yb) yb.focus();
    }
    function openMiras() { renderMiras(); document.getElementById('mirasPanel').classList.add('active'); panelOpen('mirasPanel'); }
    function closeMiras() { document.getElementById('mirasPanel').classList.remove('active'); panelClosed(); }
    
    // ======================== MARKET (kostümler ve efektler) ========================
    let marketSekme = 'skin'; // 'skin' | 'tema'
    function marketSekmeSec(k) {
        marketSekme = k === 'tema' ? 'tema' : 'skin';
        renderMarket();
        const b = document.getElementById(marketSekme === 'tema' ? 'mkSekTema' : 'mkSekSkin');
        if (b) b.focus();
    }
    // Temalar bölümü: zemin dokusu önizlemesi, ad, kural özeti, fiyat / Seç / Seçili
    function renderTemalar() {
        const sec = Market.temaSecili();
        let h = '<section class="mk-grup" aria-label="Harita temaları"><h3 style="color:#e8c46a">Harita temaları</h3><div class="mk-izgara">';
        Tema.hepsi().forEach(t => {
            const sahip = Market.temaSahip(t.id), on = t.id === sec, yeter = Market.temaYeter(t.id);
            let dugme;
            if (on) dugme = `<button class="toggle buy giyili" disabled aria-pressed="true">${ikon('check')}Seçili</button>`;
            else if (sahip) dugme = `<button class="toggle buy giy" data-act="temaSec" data-id="${t.id}" aria-label="${t.ad} temasını seç">Seç</button>`;
            else dugme = `<button class="toggle buy${yeter ? ' can' : ''}" data-act="temaBuy" data-id="${t.id}" ${yeter ? '' : 'disabled'} aria-label="${t.ad} temasını ${t.fiyat} Kül karşılığında al${yeter ? '' : ', Kül yetersiz'}">${ikon('flame')}${t.fiyat} Kül</button>`;
            h += `<article class="mk-kart mk-tema${on ? ' on' : ''}" data-tema="${t.id}"><canvas class="mk-onizle mk-tonizle" data-tema="${t.id}" role="img" aria-label="${t.ad} önizleme"></canvas><div class="mk-alt"><div class="mk-bilgi"><b>${t.ad}</b><em>${t.ozet}</em></div>${dugme}</div></article>`;
        });
        h += '</div></section>';
        document.getElementById('marketList').innerHTML = h;
        const dpr2 = Math.min(2, window.devicePixelRatio || 1);
        document.querySelectorAll('#marketList canvas.mk-tonizle').forEach(c => {
            c.width = Math.round(208 * dpr2); c.height = Math.round(76 * dpr2);
            temaOnizle(c, c.dataset.tema);
        });
        Market.temaOnizleBaslat([...document.querySelectorAll('#marketList canvas.mk-tonizle')].map(c => ({ canvas: c, id: c.dataset.tema })), { reduced: REDUCED, fx: settings.fx }); // canlı ışık/parçacık
    }
    // Statik önizleme: boyalı zemin dokusu + yem + temanın kuralını anlatan küçük simge
    function temaOnizle(c, id) {
        const t = Tema.get(id) || Tema.hepsi()[0];
        const zemin = id === 'otomatik' ? 'tas' : id;
        if (typeof Doku !== 'undefined') Doku.onizle(c, zemin, t.onizle, 1);
        const g = c.getContext('2d'), k = c.width / 208;
        g.save(); g.scale(k, k);
        const yt = id === 'otomatik' ? null : t.yem;
        // yem noktası
        g.fillStyle = yt ? yt.renk : '#ffbf2e'; g.shadowColor = g.fillStyle; g.shadowBlur = 10;
        g.beginPath(); g.arc(150, 40, 6, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
        // kural simgesi (renk körü için şekil): kaya=karanlık daire, buz=ok, lav=çarpı, bataklık=nokta, rün=elmas
        g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = 'rgba(255,255,255,0.85)';
        const cx = 54, cy = 38;
        g.beginPath();
        if (id === 'kaya') { g.arc(cx, cy, 14, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fill(); }
        else if (id === 'buz') { g.moveTo(cx - 16, cy + 6); g.lineTo(cx + 4, cy + 6); g.lineTo(cx + 4, cy - 10); g.moveTo(cx - 3, cy - 4); g.lineTo(cx + 4, cy - 11); g.lineTo(cx + 11, cy - 4); g.stroke(); }
        else if (id === 'lav') { g.moveTo(cx - 12, cy - 12); g.lineTo(cx + 12, cy + 12); g.moveTo(cx + 12, cy - 12); g.lineTo(cx - 12, cy + 12); g.stroke(); }
        else if (id === 'bat') { [[-8, -4], [4, -8], [10, 4], [-2, 6]].forEach(([dx, dy]) => { g.moveTo(cx + dx + 4, cy + dy); g.arc(cx + dx, cy + dy, 4, 0, Math.PI * 2); }); g.stroke(); }
        else if (id === 'run') { g.moveTo(cx, cy - 14); g.lineTo(cx + 10, cy); g.lineTo(cx, cy + 14); g.lineTo(cx - 10, cy); g.closePath(); g.moveTo(cx, cy - 6); g.lineTo(cx, cy + 7); g.stroke(); }
        else if (id === 'tas') { g.rect(cx - 12, cy - 10, 24, 20); g.moveTo(cx - 12, cy); g.lineTo(cx + 12, cy); g.stroke(); }
        else { g.arc(cx, cy, 12, 0.3, Math.PI * 1.6); g.stroke(); }
        g.restore();
    }
    function temaBuy(id) {
        if (typeof id !== 'string') return false;
        const ok = Market.temaAl(id);
        if (ok) { playSound('powerup'); Market.temaSec(id); }
        refreshMirasBtn();
        if (document.getElementById('marketPanel').classList.contains('active')) {
            renderMarket();
            const yb = document.querySelector('#marketList .mk-kart.on button') || document.querySelector('#marketPanel .close');
            if (yb) yb.focus();
        }
        return ok;
    }
    function temaSec(id) {
        if (typeof id !== 'string') return false;
        const ok = Market.temaSec(id);
        if (ok) playSound('start');
        if (document.getElementById('marketPanel').classList.contains('active')) {
            renderMarket();
            const yb = document.querySelector('#marketList .mk-kart.on button') || document.querySelector('#marketPanel .close');
            if (yb) yb.focus();
        }
        return ok;
    }
    function renderMarket() {
        const $ = id => document.getElementById(id);
        $('marketKul').textContent = Miras.kul;
        ['skin', 'tema'].forEach(k => {
            const b = $(k === 'tema' ? 'mkSekTema' : 'mkSekSkin');
            if (b) { b.classList.toggle('on', marketSekme === k); b.setAttribute('aria-selected', marketSekme === k ? 'true' : 'false'); b.tabIndex = 0; }
        });
        if (marketSekme === 'tema') { Market.onizleDurdur(); renderTemalar(); return; }
        const giyili = Market.equipped();
        let h = '';
        Object.keys(Market.NADIRLIK).sort((a, b) => Market.NADIRLIK[a].sira - Market.NADIRLIK[b].sira).forEach(nk => {
            const N = Market.NADIRLIK[nk];
            const liste = Market.SKINS.filter(s => s.nadir === nk);
            if (!liste.length) return;
            h += `<section class="mk-grup" aria-label="${N.ad}"><h3 style="color:${N.renk}">${N.ad}</h3><div class="mk-izgara">`;
            liste.forEach(s => {
                const sahip = Market.owned(s.id), on = s.id === giyili, yeter = Market.canAfford(s.id);
                let dugme;
                if (on) dugme = `<button class="toggle buy giyili" disabled aria-pressed="true">${ikon('check')}Giyili</button>`;
                else if (sahip) dugme = `<button class="toggle buy giy" data-act="marketEquip" data-id="${s.id}" aria-label="${s.ad} kostümünü giy">Giy</button>`;
                else dugme = `<button class="toggle buy${yeter ? ' can' : ''}" data-act="marketBuy" data-id="${s.id}" ${yeter ? '' : 'disabled'} aria-label="${s.ad} kostümünü ${s.fiyat} Kül karşılığında al${yeter ? '' : ', Kül yetersiz'}">${ikon('flame')}${s.fiyat} Kül</button>`;
                h += `<article class="mk-kart${on ? ' on' : ''}" data-nadir="${nk}" style="--nd:${N.renk}"><canvas class="mk-onizle" data-id="${s.id}" role="img" aria-label="${s.ad} önizleme"></canvas><div class="mk-alt"><div class="mk-bilgi"><b>${s.ad}</b><span class="mk-nadir">${N.ad}</span><em>${s.acik}</em></div>${dugme}</div></article>`;
            });
            h += '</div></section>';
        });
        $('marketList').innerHTML = h;
        Market.onizleBaslat([...document.querySelectorAll('#marketList canvas.mk-onizle')].map(c => ({ canvas: c, id: c.dataset.id })), { reduced: REDUCED, fx: settings.fx });
    }
    function marketBuy(id) {
        if (typeof id !== 'string') return false;
        const ok = Market.buy(id);
        if (ok) { playSound('powerup'); Market.equip(id); }
        refreshMirasBtn();
        if (document.getElementById('marketPanel').classList.contains('active')) {
            renderMarket();
            const yb = document.querySelector('#marketList [data-id="' + id + '"][data-act]:not(:disabled)') || document.querySelector('#marketPanel .close');
            if (yb) yb.focus();
        }
        return ok;
    }
    function marketEquip(id) {
        if (typeof id !== 'string') return false;
        const ok = Market.equip(id);
        if (ok) playSound('start');
        if (document.getElementById('marketPanel').classList.contains('active')) {
            renderMarket();
            const yb = document.querySelector('#marketList .mk-kart.on button') || document.querySelector('#marketPanel .close');
            if (yb) yb.focus();
        }
        return ok;
    }
    function openMarket() { refreshMirasBtn(); renderMarket(); document.getElementById('marketPanel').classList.add('active'); panelOpen('marketPanel'); }
    function closeMarket() { Market.onizleDurdur(); marketSekme = 'skin'; document.getElementById('marketPanel').classList.remove('active'); panelClosed(); }

    // ======================== PERSISTENCE ========================
    function saveData() {
        try {
            localStorage.setItem('pixelSnakeArcade', JSON.stringify({ records, progress, unlocked }));
        } catch (e) {
            // kayıt yazılamadı (kota dolu / depolama kapalı): oturum başına bir kez uyar
            if (!saveData.uyardi) { saveData.uyardi = true; setTimeout(() => showToast('⚠ Kayıt yazılamadı: rekorlar bu oturumda saklanmayabilir'), 120); } // başarım bildirimini ezmesin
        }
    }
    
    function loadSavedData() {
        try {
            const data = JSON.parse(localStorage.getItem('pixelSnakeArcade'));
            if (data && typeof data === 'object') {
                const r = data.records && typeof data.records === 'object' ? data.records : {};
                const skor = v => typeof v === 'number' && isFinite(v) && v >= 0 && v <= 1e9; // fuzz: negatif/aşırı büyük skor reddedilir
                Object.keys(records).forEach(k => { if (k !== 'top' && k !== 'dailyDate' && skor(r[k])) records[k] = r[k]; });
                if (typeof r.dailyDate === 'string') records.dailyDate = r.dailyDate;
                if (r.dailyPrev && typeof r.dailyPrev.d === 'string' && typeof r.dailyPrev.s === 'number' && isFinite(r.dailyPrev.s)) records.dailyPrev = { d: r.dailyPrev.d, s: r.dailyPrev.s };
                records.hay = null;
                if (r.hay && typeof r.hay === 'object' && skor(r.hay.s) && typeof r.hay.p === 'string' && r.hay.p.length >= 6 && r.hay.p.length <= 5000 && Array.isArray(r.hay.e) && r.hay.e.length <= 500 && r.hay.e.every(n => Number.isInteger(n) && n >= 0 && n <= 5000)) records.hay = { s: r.hay.s, p: r.hay.p, e: r.hay.e.slice() };
                records.top = {};
                if (r.top && typeof r.top === 'object') Object.keys(r.top).forEach(m => { if (m !== '__proto__' && Array.isArray(r.top[m])) records.top[m] = r.top[m].filter(t => t && skor(t.s)).slice(0, 5); }); // fuzz: __proto__ anahtarı prototipi bozmasın
                const pr = data.progress && typeof data.progress === 'object' ? data.progress : {};
                progress.unlocked = Math.min(30, Math.max(1, parseInt(pr.unlocked, 10) || 1));
                progress.stars = {};
                if (pr.stars && typeof pr.stars === 'object') Object.keys(pr.stars).forEach(l => { const v = parseInt(pr.stars[l], 10); if (v >= 1 && v <= 3) progress.stars[l] = v; });
                unlocked = {};
                if (data.unlocked && typeof data.unlocked === 'object') ACH.forEach(a => { if (data.unlocked[a.id] === true) unlocked[a.id] = true; });
            }
        } catch (e) {}
    }
    
    // ======================== PUBLIC API ========================
    const PUBLIC = {
        init,
        showMenu,
        showLevels,
        showModes,
        startClassic,
        startBullet,
        startTailgun,
        startSurvivor,
        startTimeAttack,
        startPortal,
        startTron,
        startChaos,
        startDaily,
        startTapinak,
        toggleSound,
        fire,
        pickUpgrade,
        startCampaign,
        restart,
        nextLevel,
        input,
        kopyalaSonuc,
        togglePause,
        openSettings, closeSettings, setSetting, getSettings, openAchievements, closeAchievements, toggleMusic, openMiras, closeMiras, openMarket, closeMarket, marketBuy, marketEquip, marketSekmeSec, temaBuy, temaSec,
        ...(TEST_MODE ? { _tapinak: { run: () => tp, meta: () => tpMeta, tick: () => tick(), atil: () => tapinakAtil(), sec: i => tapinakSec(i) } } : {}),
        // Test API'si (_debug, _ach) yalnız ?test=1 ile açılan sayfada; paketli oyunda yok.
        ...(TEST_MODE ? { _miras: { buy: mirasBuy, render: renderMiras }, _ach: { list: ACH, unlocked: () => ({ ...unlocked }), unlock: unlockAch, check: checkAch },
        _debug: { fx: () => ({ burst, particles }), tick, power: (t) => activatePower(t), powers: () => ({ ...powers }), get: () => ({ sv, gems, state, snake, dir, nextDir, bullets, lasers, boss, patterns, enemies, playerShots }), jump: (w) => { state.wave = w - 1; waveTick = WAVE_TICKS - 1; }, grow: (n) => { for (let i = 0; i < n; i++) snake.push({ ...snake[snake.length - 1] }); }, godMode: () => { powers.invincible = true; }, tronWin: () => tronWin(), draw: () => draw(), extra: () => ({ tmHiz, tmBekle, effSpeed: effSpeed(), portals, tron, chaos, obstacles, food, records, palet: PALET, banner, bugun: todayKey(), dunku: dunkuSkor() }) } } : {})
    };
    return PUBLIC;
})();

// Initialize
document.addEventListener('DOMContentLoaded', SnakeGame.init);
