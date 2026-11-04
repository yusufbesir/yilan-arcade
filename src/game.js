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
    let tron = { ai: [], aiDir: { x: -1, y: 0 }, round: 1, twoP: false, p2Next: { x: -1, y: 0 }, p2Wins: 0 };
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
    let settings = { speed: 1, fx: 1, vol: 0.6, reduced: false, shake: true, music: true, bigHud: false, cb: false, tron2p: false };
    const effSpeed = () => Math.max(30, Math.round(state.speed * (state.calm > 0 ? 1 + Miras.value('sakin') : 1) / settings.speed)); // Miras: Sakin Başlangıç
    const STARS = Array.from({ length: 46 }, (_, i) => ({ x: (i * 97.13) % 960, y: (i * 53.71) % 640, r: 0.6 + (i % 3) * 0.5, s: 0.4 + (i % 5) * 0.25, p: i }));
    const CLASSIC_LIKE = ['classic', 'portal', 'daily'];
    
    let powers = { shield: false, speed: false, invincible: false };
    let powerTimers = {};
    
    let loopInterval = null;
    let frameRequest = null;
    
    // Saved Data
    let records = { classic: 0, bullet: 0, tailgun: 0, survivor: 0, timeattack: 0, portal: 0, tron: 0, chaos: 0, daily: 0, tapinak: 0, dailyDate: '', top: {} };
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
            if (act === 'toggle') { setSetting(el.dataset.key, !settings[el.dataset.key]); return; }
            if (act === 'mirasBuy') { mirasBuy(el.dataset.id); return; }
            if (act === 'input') { input(Number(el.dataset.dx), Number(el.dataset.dy)); return; }
            if (Object.prototype.hasOwnProperty.call(PUBLIC, act) && typeof PUBLIC[act] === 'function') PUBLIC[act]();
        });
        // Dokunmatik yön/ateş: basar basmaz (click beklemeden); satır içi ontouchstart/onpointerdown CSP'ye takılıyordu
        document.addEventListener('pointerdown', e => {
            const el = e.target.closest('.dpad-btn[data-act="input"], [data-press="fire"]');
            if (!el) return;
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
        document.body.classList.toggle('menu-acik', id === 'menuScreen');
        document.body.classList.toggle('oyun-acik', id !== 'menuScreen');
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
    
    function buildLevelGrid() {
        const grid = document.getElementById('levelsGrid');
        grid.innerHTML = '';
        
        for (let i = 1; i <= 30; i++) {
            const btn = document.createElement('button');
            btn.className = 'level-btn';
            
            if (i <= progress.unlocked) {
                btn.innerHTML = `<span>${i}</span>`;
                
                if (progress.stars[i]) {
                    const starsEl = document.createElement('div');
                    starsEl.className = 'level-stars';
                    starsEl.textContent = '⭐'.repeat(progress.stars[i]);
                    btn.appendChild(starsEl);
                }
                
                if (i < progress.unlocked) btn.classList.add('completed');
                
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
                btn.innerHTML = '🔒';
                btn.classList.add('locked');
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
        showBanner('GÜNLÜK ' + state.dailyKey.slice(5) + (dun ? ' · DÜN: ' + dun : ''));
        const midY = Math.floor(ROWS / 2);
        for (let i = 0; i < 9; i++) {
            for (let t = 0; t < 30; t++) {
                const pos = findEmpty();
                if (pos && !(Math.abs(pos.y - midY) <= 1 && pos.x < 14)) { obstacles.push(pos); break; }
            }
        }
        if (isOccupied(food.x, food.y) && obstacles.some(o => o.x === food.x && o.y === food.y)) spawnFood();
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
        nextDir = { x: 1, y: 0 };
        tron.ai = [{ x: COLS - 6, y: midY }, { x: COLS - 5, y: midY }, { x: COLS - 4, y: midY }];
        tron.aiDir = { x: -1, y: 0 };
        tron.p2Next = { x: -1, y: 0 };
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
        nextDir = { x: 1, y: 0 };
        
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
        tron = { ai: [], aiDir: { x: -1, y: 0 }, round: 1, twoP: false, p2Next: { x: -1, y: 0 }, p2Wins: 0 };
        chaos = { rule: null, left: 0, next: 120, saved: 0 };
        state.timeLeft = 60;
        rand = state.mode === 'daily' ? seededRand(todayKey()) : Math.random;
        
        powers = { shield: false, speed: false, invincible: false };
        Object.values(powerTimers).forEach(t => clearTimeout(t));
        powerTimers = {};
        powerMeta = {};
        refreshPowerDisplay();
        
        applyMirasPerks();
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
            updateHUD();
        }
        
        dir = { ...nextDir };
        
        let head = {
            x: snake[0].x + dir.x,
            y: snake[0].y + dir.y
        };
        
        if (state.mode === 'portal') {
            for (const p of portals) {
                if (head.x === p.a.x && head.y === p.a.y) { head = { ...p.b }; playSound('powerup'); break; }
                if (head.x === p.b.x && head.y === p.b.y) { head = { ...p.a }; playSound('powerup'); break; }
            }
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
        
        // Moving obstacle
        for (const o of movingObs) {
            if (Math.abs(o.x - head.x) < 0.8 && Math.abs(o.y - head.y) < 0.8) {
                damage();
                return;
            }
        }
        
        snake.unshift(head);
        
        // Eat food
        if ((head.x === food.x && head.y === food.y) || magnetHit(head)) {
            eatFood();
        } else {
            snake.pop();
        }
        
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
    function damage() {
        if (powers.invincible) return;
        
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
            nextDir = { x: 1, y: 0 };
            
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
        // Kaos: ara sıra çürük yem (kural bozma ruhu); diğer modlara girmez
        food = { ...pos, age: 0, type: state.mode === 'chaos' && r < 0.15 ? 'curuk' : r < 0.12 + (state.mode === 'chaos' ? 0.15 : 0) ? 'super' : 'normal' };
    }
    
    function eatFood() {
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
        if (state.mode !== 'daily' && state.mode !== 'tron') { // Miras: Altın İştah (kesirler birikir)
            state.istahAcc = (state.istahAcc || 0) + pts * Miras.value('istah');
            const ek = Math.floor(state.istahAcc + 1e-9);
            state.istahAcc -= ek; pts += ek;
        }
        burst(food.x + 0.5, food.y + 0.5, food.type === 'super' ? '#ffdd00' : '#ffbf2e', food.type === 'super' ? 22 : 12);
        state.score += pts;
        if (state.mode === 'timeattack') state.timeLeft += food.type === 'super' ? 5 : 2;
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
    function showBanner(text, onemli) { // onemli: süresi dolana dek sıradan bir afiş (ör. 'HIZ 2') üstüne yazamaz
        if (!onemli && banner.onemli && performance.now() < banner.until) return;
        banner = { text, until: performance.now() + 1600, onemli: !!onemli };
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
                if (!powers.invincible) {
                    state.score += 1;
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
            state.wave++;
            document.getElementById('hudLevel').textContent = state.wave;
            if (state.wave % 5 === 0) {
                spawnBoss();
            } else {
                showBanner('DALGA ' + state.wave);
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
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 14;
        ctx.fillText(banner.text, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 90);
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
    
    function spawnEnemy() {
        if (enemies.length >= 60) return;
        const side = Math.floor(Math.random() * 4);
        const e = { x: 0, y: 0, hp: state.wave >= 4 && Math.random() < 0.25 ? 2 : 1 };
        if (side === 0) { e.x = Math.random() * COLS; e.y = -1; }
        else if (side === 1) { e.x = Math.random() * COLS; e.y = ROWS; }
        else if (side === 2) { e.x = -1; e.y = Math.random() * ROWS; }
        else { e.x = COLS; e.y = Math.random() * ROWS; }
        enemies.push(e);
    }
    
    // oyuncu mermileri: 3 alt adımda ilerler, her adımda çarpışma bakar
    function moveShots(onKill) {
        playerShots = playerShots.filter(s => {
            for (let i = 0; i < 3; i++) {
                s.x += s.dx * 0.5;
                s.y += s.dy * 0.5;
                for (const e of enemies) {
                    if (e.hp > 0 && Math.hypot(e.x - s.x, e.y - s.y) < 0.9) {
                        e.hp -= s.dmg || 1;
                        if (e.hp <= 0) onKill(e);
                        return false;
                    }
                }
            }
            return s.x > -2 && s.x < COLS + 2 && s.y > -2 && s.y < ROWS + 2;
        });
        enemies = enemies.filter(e => e.hp > 0);
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
        
        if (Math.random() < 0.004) spawnPowerup();
        tickPowerups();
    }
    
    function drawTailgunLayer() {
        const CELL = CONFIG.CELL;
        playerShots.forEach(s => {
            ctx.shadowColor = '#00e5ff';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(s.x * CELL + 6, s.y * CELL + 6, 8, 8);
            ctx.shadowBlur = 0;
        });
        enemies.forEach(e => {
            const px = e.x * CELL, py = e.y * CELL;
            ctx.shadowColor = settings.cb ? PALET.dusman : '#ff3355';
            ctx.shadowBlur = 10;
            // cb: düşman tek renk (#CC79A7), dayanıklı olan açık tonu
            ctx.fillStyle = settings.cb ? (e.hp > 1 ? PALET.ton(PALET.dusman, 0.35) : PALET.dusman) : (e.hp > 1 ? '#ff7a00' : '#ff3355');
            ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
            ctx.fillStyle = '#fff';
            ctx.fillRect(px + 5, py + 6, 3, 3);
            ctx.fillRect(px + 12, py + 6, 3, 3);
            ctx.shadowBlur = 0;
        });
    }
    
    // ======================== SURVIVOR ========================
    const UPGRADES = [
        { id: 'dmg', text: 'HASAR +1' },
        { id: 'rate', text: 'ATEŞ HIZI +25%' },
        { id: 'multi', text: 'ÇOKLU ATIŞ +1' },
        { id: 'magnet', text: 'MIKNATIS +1.5' },
        { id: 'life', text: 'CANI DOLDUR' }
    ];
    
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
        sv = { level: 1, xp: 0, need: 5, dmg: 1, cd: 10, multi: 1, magnet: 2.5, timer: 0, choosing: false, choices: [] };
        gems = [];
        document.getElementById('hudLevel').textContent = sv.level;
        document.getElementById('hudTarget').textContent = '0/' + sv.need;
        showBanner('OTOMATİK ATEŞ! XP TOPLA');
        showGame();
        beginLoop();
        playSound('start');
    }
    
    function nearestEnemy(h) {
        let best = null, bd = 1e9;
        for (const e of enemies) {
            const d = Math.hypot(e.x - h.x, e.y - h.y);
            if (d < bd) { bd = d; best = e; }
        }
        return bd <= 11 ? best : null;
    }
    
    function tickSurvivor() {
        if (sv.choosing) return;
        waveTick++;
        if (waveTick % 200 === 0) {
            state.wave++;
            showBanner('DÜŞMANLAR GÜÇLENİYOR');
        }
        
        // Denge: dalga 10'dan sonra da zorluk artar (eskiden gap/hız tavanı yüzünden bot hiç ölmüyordu)
        const gap = Math.max(3, 22 - state.wave * 2);
        if (waveTick % gap === 0) {
            const grup = state.wave >= 12 ? 1 + Math.floor((state.wave - 12) / 8) : 0;
            for (let k = 0; k <= Math.min(grup, 3); k++) {
                const n0 = enemies.length;
                spawnEnemy();
                if (enemies.length === n0) break;
                const ne = enemies[enemies.length - 1];
                if (state.wave >= 3 && Math.random() < 0.3) ne.hp = 1 + Math.floor(state.wave / 3);
                if (state.wave >= 10) ne.hp = Math.max(ne.hp, 1 + Math.floor((state.wave - 6) / 3));
            }
        }
        
        const head = snake[0];
        const espd = Math.min(0.36, 0.08 + state.wave * 0.006);
        
        sv.timer++;
        if (sv.timer >= sv.cd) {
            const t = nearestEnemy(head);
            if (t) {
                sv.timer = 0;
                const a = Math.atan2(t.y - head.y, t.x - head.x);
                for (let i = 0; i < sv.multi; i++) {
                    const off = (i - (sv.multi - 1) / 2) * 0.25;
                    playerShots.push({ x: head.x, y: head.y, dx: Math.cos(a + off), dy: Math.sin(a + off), dmg: sv.dmg });
                }
            }
        }
        
        moveShots(enemy => {
            state.score += 2;
            updateHUD();
            gems.push({ x: enemy.x, y: enemy.y, v: 1 });
            if (gems.length > 80) { const o = gems.shift(); gems[0].v = (gems[0].v || 1) + (o.v || 1); } // eski elmas XP'siyle birleşir, silinmez
        });
        
        enemies.forEach(e => {
            const a = Math.atan2(head.y - e.y, head.x - e.x);
            e.x += Math.cos(a) * espd;
            e.y += Math.sin(a) * espd;
        });
        
        gems = gems.filter(g => {
            const d = Math.hypot(head.x - g.x, head.y - g.y);
            if (d < sv.magnet) {
                sv.xp += g.v || 1;
                if (sv.xp >= sv.need) { const artan = sv.xp - sv.need; levelUp(); sv.xp = artan; }
                document.getElementById('hudTarget').textContent = sv.xp + '/' + sv.need;
                return false;
            }
            return true;
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
    }
    
    function levelUp() {
        sv.level++;
        sv.xp = 0;
        sv.need = 5 + sv.level * 3;
        document.getElementById('hudLevel').textContent = sv.level;
        const pool = UPGRADES.slice().sort(() => Math.random() - 0.5);
        sv.choices = pool.slice(0, 3);
        sv.choosing = true;
        if (sv.level >= 5) unlockAch('sv5');
        if (sv.level >= 10) unlockAch('sv10');
        pausePowerTimers();
        playSound('powerup');
    }
    
    function pickUpgrade(i) {
        if (state.mode !== 'survivor' || !sv.choosing || !sv.choices[i]) return;
        switch (sv.choices[i].id) {
            case 'dmg': sv.dmg += 1; break;
            case 'rate': sv.cd = Math.max(3, Math.round(sv.cd * 0.8)); break;
            case 'multi': sv.multi = Math.min(5, sv.multi + 1); break;
            case 'magnet': sv.magnet = Math.min(8, sv.magnet + 1.5); break;
            case 'life': state.lives = 3; updateHUD(); break;
        }
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
            ctx.shadowColor = '#7CFF6B';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#7CFF6B';
            ctx.fillRect(g.x * CELL + 7, g.y * CELL + 7, 6, 6);
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
        document.getElementById('gameoverTitle').textContent = kayitYok ? '🏁 DÜELLO BİTTİ' : '💀 OYUN BİTTİ';
        document.getElementById('newRecordMsg').style.display = isRecord ? 'block' : 'none';
        mirasVer('kulMsg', !kayitYok, state.mode === 'tapinak' && !!(tp && tp.kazandi));
        if (state.mode === 'tapinak') { const gTitle = document.getElementById('gameoverTitle'); if (gTitle) gTitle.textContent = tp && tp.kazandi ? '🏛️ TAPINAKTAN ÇIKTIN' : '💀 KOŞU BİTTİ'; }
        document.getElementById('gameoverOverlay').classList.add('active');
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
                case 'hasar': burst(e.x, e.y, '#ff2244', 22, 1.3); addShake(7); flashCanvas('#ff0033'); playSound('hit'); break;
                case 'kalkan': flashCanvas('#00ccff'); playSound('shield'); break;
                case 'temiz': showBanner(e.tur === 'savas' ? 'ODA TEMİZLENDİ · ARMAĞAN SEÇ' : e.tur === 'boss' ? 'KÜL JARLI DÜŞTÜ · SUNAK VE ÇIKIŞ' : 'ODA TEMİZLENDİ · SUNAĞA DOKUN', true); playSound('powerup'); break;
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
                case 'faz': showBanner('KÜL JARLI · FAZ ' + e.faz, true); addShake(8); playSound('hit'); break;
                case 'sarsinti': addShake(6); break;
                case 'bossOldu': burst(e.x, e.y, '#ffb347', 60, 2.2); addShake(12); playSound('complete'); break;
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
        if (tp) Tapinak.ciz(ctx, tp, { dpr, t: performance.now() / 1000, reduced: REDUCED, cb: settings.cb, dusmanRenk: PALET.dusman });
    }
    function drawTapinakTop() {
        if (tp) Tapinak.cizUst(ctx, tp, { dpr, t: performance.now() / 1000, reduced: REDUCED, bas: renderPos[0] });
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
        
        document.getElementById('starsDisplay').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
        document.getElementById('levelEndScore').textContent = state.score;
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
        if (key === 'p' || key === 'escape') {
            togglePause();
            return;
        }
        
        if (key === 'r' && state.over) {
            restart();
            return;
        }
        
        if (key === 'm') {
            showMenu();
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
        if (dx !== 0 && dir.x !== -dx) nextDir = { x: dx, y: 0 };
        if (dy !== 0 && dir.y !== -dy) nextDir = { x: 0, y: dy };
    }
    
    function input(dx, dy) {
        if (state.paused || state.over || state.complete) return;
        steer(dx, dy);
    }
    
    function togglePause() {
        if (state.over || state.complete) return;
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
                hearts += i < state.lives ? '❤️' : '🖤';
            }
            document.getElementById('hudLives').textContent = hearts;
            document.getElementById('hudLives').setAttribute('aria-label', 'Can: ' + state.lives);
        }
        
        if (state.mode === 'campaign') {
            document.getElementById('hudTarget').textContent = `${state.score}/${state.target}`;
        }
        if (state.mode === 'timeattack') {
            document.getElementById('hudTarget').textContent = Math.max(0, Math.ceil(state.timeLeft)) + ' sn';
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
        if (state.mode !== 'tron') drawFood();
        if (state.mode === 'tron') drawTronLayer();
        
        // Lasers, warnings, boss
        if (state.mode === 'bullet') drawBulletLayer();
        if (state.mode === 'tailgun') drawTailgunLayer();
        if (state.mode === 'tapinak') drawTapinakLayer();
        if (state.mode === 'survivor') drawSurvivorLayer();
        
        // Bullets
        bullets.forEach(b => drawBullet(b));
        
        // Snake
        const prog = state.paused || state.over ? 1 : Math.max(0, Math.min(1, (nowT - lastTickAt) / Math.max(40, state.speed)));
        const total = snake.length;
        renderPos = snake.map((c, i) => lerpPos(prevSnake[i], c, prog));
        for (let i = total - 1; i >= 0; i--) {
            if (chaos.rule === 'ghost' && i > 0) continue;
            const pos = renderPos[i];
            if (i === 0) {
                drawSnakeHead(pos);
                if (!REDUCED && state.running && Math.random() < 0.35) spark(pos.x + 0.5, pos.y + 0.5);
            } else drawSnakeBody(pos, i, total);
        }
        
        // Auras
        if (powers.invincible) drawAura(snake[0], '#ff00ff', 26);
        if (powers.shield) drawAura(snake[0], '#00ccff', 22);
        if (state.mode === 'tapinak') drawTapinakTop();
        
        if (['classic', 'bullet', 'tailgun', 'survivor', 'chaos', 'portal', 'timeattack', 'tron', 'daily', 'tapinak'].includes(state.mode)) drawBanner(); // daily eksikti: Günlük afişleri hiç çizilmiyordu
        drawParticles();
        drawVignette();
        if (state.mode === 'survivor' && sv.choosing) drawLevelUp();
        ctx.restore();
    }
    
    const G25 = () => (typeof Gfx25 !== 'undefined' ? Gfx25 : null);
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

    function gfxOpts() {
        return { CELL: CONFIG.CELL, W: CONFIG.WIDTH, H: CONFIG.HEIGHT, COLS, ROWS, cb: settings.cb, pal: PALET, reduced: REDUCED, all: renderPos, theme: (typeof Doku !== 'undefined') ? Doku.themeFor(state.mode, state.level) : 'tas' };
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
        n = Math.round(n * settings.fx);
        if (REDUCED) n = Math.ceil(n / 3);
        for (let i = 0; i < n && particles.length < 400; i++) {
            const a = Math.random() * Math.PI * 2;
            const v = (1.5 + Math.random() * 4) * (speed || 1);
            particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.5, max: 1, color, r: 1.5 + Math.random() * 2.5 });
        }
    }
    
    function spark(x, y) {
        if (particles.length > 380 || Math.random() > settings.fx) return;
        particles.push({ x, y, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, life: 0.45, max: 0.45, color: '#00ffaa', r: 1.2 });
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
        const bc = b.color || (b.homing ? CONFIG.COLORS.bulletHoming : CONFIG.COLORS.bullet);

        // Ateş topu: dış hale + sıcak çekirdek + titreşen kıvılcım
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const halo = ctx.createRadialGradient(cx, cy, 1, cx, cy, 12);
        halo.addColorStop(0, bc);
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.55;
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
    }
    
    // ======================== TRON ========================
    const DIRS4 = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    
    function tronBlocked(x, y) {
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
        if (tronGrid) return tronGrid.has(x * 64 + y);
        return snake.some(c => c.x === x && c.y === y) || tron.ai.some(c => c.x === x && c.y === y);
    }
    let tronGrid = null; // karar boyunca izler değişmez: O(1) arama, string anahtar yok
    
    function floodCount(sx, sy) {
        const seen = new Set([sx * 64 + sy]);
        const stack = [[sx, sy]];
        let n = 0;
        while (stack.length && n < COLS * ROWS) {
            const [x, y] = stack.pop();
            n++;
            for (const d of DIRS4) {
                const nx = x + d.x, ny = y + d.y, k = nx * 64 + ny;
                if (seen.has(k) || tronBlocked(nx, ny)) continue;
                seen.add(k);
                stack.push([nx, ny]);
            }
        }
        return n;
    }
    
    function aiChooseDir() {
        const h = tron.ai[0];
        const wins = state.score;
        const opts = DIRS4.filter(d => !(d.x === -tron.aiDir.x && d.y === -tron.aiDir.y))
            .map(d => ({ d, ok: !tronBlocked(h.x + d.x, h.y + d.y) }))
            .filter(o => o.ok);
        if (!opts.length) return tron.aiDir;
        // Oyuncunun bir sonraki başı: kafa kafaya (berabere) hücresinden kaçın
        const pn = { x: snake[0].x + nextDir.x, y: snake[0].y + nextDir.y };
        const dumb = Math.max(0.02, 0.2 - wins * 0.03);
        if (Math.random() < dumb) {
            // "Dalgın" hamle: yine de boş ve kafa kafaya olmayan bir yön
            const pool = opts.filter(o => !(h.x + o.d.x === pn.x && h.y + o.d.y === pn.y));
            const src = pool.length ? pool : opts;
            return src[Math.floor(Math.random() * src.length)].d;
        }
        let best = [], bestN = -Infinity;
        tronGrid = new Set();
        snake.forEach(c => tronGrid.add(c.x * 64 + c.y));
        tron.ai.forEach(c => tronGrid.add(c.x * 64 + c.y));
        opts.forEach(o => {
            const nx = h.x + o.d.x, ny = h.y + o.d.y;
            let n = floodCount(nx, ny);
            if (o.d.x === tron.aiDir.x && o.d.y === tron.aiDir.y) n += 0.5;
            if (nx === pn.x && ny === pn.y) n -= 1000;
            if (n > bestN) { bestN = n; best = [o]; }
            else if (n === bestN) best.push(o); // eşitlik: rastgele seç
        });
        tronGrid = null;
        return best[Math.floor(Math.random() * best.length)].d;
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
        const ph = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        const ah = { x: tron.ai[0].x + tron.aiDir.x, y: tron.ai[0].y + tron.aiDir.y };
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
    }
    
    function tickChaos() {
        // Çürük yem tek yem olup oyunu kilitlemesin: 60 tik sonra normal yeme döner
        if (food && food.type === 'curuk' && ++food.age >= 60) food.type = 'normal';
        if (chaos.rule) {
            chaos.left--;
            if (chaos.left <= 0) {
                if (chaos.rule === 'fast' || chaos.rule === 'slow') setSpeed(chaos.saved);
                chaos.rule = null;
                document.getElementById('hudLevel').textContent = '-';
                showBanner('KURAL BİTTİ');
            }
            return;
        }
        chaos.next--;
        if (chaos.next > 0) return;
        const rules = [
            ['reverse', 'TERS KONTROL!', 'TERS'],
            ['fast', 'HIZLANDIN!', 'HIZLI'],
            ['slow', 'YAVAŞLADIN', 'YAVAŞ'],
            ['ghost', 'GÖVDE GÖRÜNMEZ', 'HAYALET'],
            ['triple', 'YEMLER x3 SKOR', 'x3']
        ];
        const [rule, label, kisa] = rules[Math.floor(Math.random() * rules.length)];
        chaos.rule = rule;
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
        if (b) b.textContent = soundOn ? '🔊 SES: AÇIK' : '🔇 SES: KAPALI';
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
            d.type = 'sawtooth'; d.frequency.value = 55; lp.type = 'lowpass'; lp.frequency.value = 220;
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
            tone(SCALE[idx], 'triangle', beat * 0.9, vol, musicNext);
            if (inBar === 0 || inBar === 4) tone(SCALE[idx] / 2, 'sine', beat * 1.8, 0.05, musicNext);
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
        } catch (e) {}
        applySettings();
    }
    function applySettings() {
        REDUCED = SYS_REDUCED || !!settings.reduced;
        document.documentElement.classList.toggle('reduced', REDUCED);
        document.documentElement.classList.toggle('buyuk-hud', !!settings.bigHud);
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
            const mb = $('musicBtn'); if (mb) mb.textContent = settings.music ? '🎵 MÜZİK: AÇIK' : '🎵 MÜZİK: KAPALI';
        }
    }
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
    function panelOpen(id) { panelOpener = document.activeElement; const b = document.querySelector('#' + id + ' button'); if (b) b.focus(); }
    function panelClosed() { if (panelOpener && panelOpener.focus) panelOpener.focus(); panelOpener = null; }
    function closeOpenPanel() {
        if (document.getElementById('settingsPanel').classList.contains('active')) { closeSettings(); return true; }
        if (document.getElementById('achPanel').classList.contains('active')) { closeAchievements(); return true; }
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
    function openAchievements() {
        document.getElementById('achList').innerHTML = ACH.map(a => `<div class="ach ${unlocked[a.id] ? 'on' : ''}"><span class="ic">${unlocked[a.id] ? a.ic : '🔒'}</span><div><b>${a.t}</b><span>${a.d}</span></div></div>`).join('');
        document.getElementById('achPanel').classList.add('active');
        panelOpen('achPanel');
    }
    function closeAchievements() { document.getElementById('achPanel').classList.remove('active'); panelClosed(); }
    
    // ======================== MİRAS (kalıcı tecrübe) ========================
    function mirasVer(elId, ver, won) {
        const el = document.getElementById(elId);
        if (state.mirasVerildi || !ver) { if (el && !ver) el.textContent = ''; return; }
        state.mirasVerildi = true;
        const r = Miras.award({ mode: state.mode, score: state.score, won: !!won });
        state.mirasSonuc = r;
        if (el) el.textContent = '🔥 +' + r.gained + ' KÜL';
        if (r.levelUp) showToast('🔥 MİRAS SEVİYE ' + r.level + '!');
        refreshMirasBtn();
    }
    function refreshMirasBtn() {
        const el = document.getElementById('mirasInfo');
        if (el) el.textContent = 'Sv.' + Miras.seviye + ' · ' + Miras.kul;
    }
    function renderMiras() {
        const $ = id => document.getElementById(id);
        const p = Miras.progress();
        $('mirasLevel').textContent = p.seviye;
        $('mirasKul').textContent = Miras.kul;
        $('mirasBar').style.width = Math.round(p.mevcut / p.gerek * 100) + '%';
        $('mirasBarTxt').textContent = p.mevcut + ' / ' + p.gerek;
        $('mirasList').innerHTML = Miras.YETENEK.map(t => {
            const k = Miras.tier(t.id), c = Miras.cost(t.id);
            const pips = '●'.repeat(k) + '○'.repeat(Miras.MAX_TIER - k);
            const sonraki = c === null ? 'TAM' : t.fmt(t.etki[k + 1]);
            const d = c === null ? 'disabled' : (Miras.kul < c ? 'disabled' : '');
            return `<div class="miras-card ${k ? 'on' : ''}"><span class="ic">${t.ic}</span><div class="mi"><b>${t.ad} <i>${pips}</i></b><span>${t.acik}</span><span class="now">${k ? 'Şimdi: ' + t.fmt(t.etki[k]) : 'Alınmadı'}${c === null ? '' : ' → ' + sonraki}</span></div><button class="toggle" data-act="mirasBuy" data-id="${t.id}" ${d}>${c === null ? 'TAM' : c + ' KÜL'}</button></div>`;
        }).join('');
    }
    function mirasBuy(id) {
        if (Miras.buy(id)) playSound('powerup');
        renderMiras();
        refreshMirasBtn();
    }
    function openMiras() { renderMiras(); document.getElementById('mirasPanel').classList.add('active'); }
    function closeMiras() { document.getElementById('mirasPanel').classList.remove('active'); }
    
    // ======================== PERSISTENCE ========================
    function saveData() {
        try {
            localStorage.setItem('pixelSnakeArcade', JSON.stringify({ records, progress, unlocked }));
        } catch (e) {}
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
        togglePause,
        openSettings, closeSettings, setSetting, getSettings, openAchievements, closeAchievements, toggleMusic, openMiras, closeMiras,
        ...(TEST_MODE ? { _tapinak: { run: () => tp, meta: () => tpMeta, tick: () => tick(), atil: () => tapinakAtil(), sec: i => tapinakSec(i) } } : {}),
        // Test API'si (_debug, _ach) yalnız ?test=1 ile açılan sayfada; paketli oyunda yok.
        ...(TEST_MODE ? { _miras: { buy: mirasBuy, render: renderMiras }, _ach: { list: ACH, unlocked: () => ({ ...unlocked }), unlock: unlockAch, check: checkAch },
        _debug: { tick, power: (t) => activatePower(t), powers: () => ({ ...powers }), get: () => ({ sv, gems, state, snake, dir, nextDir, bullets, lasers, boss, patterns, enemies, playerShots }), jump: (w) => { state.wave = w - 1; waveTick = WAVE_TICKS - 1; }, grow: (n) => { for (let i = 0; i < n; i++) snake.push({ ...snake[snake.length - 1] }); }, godMode: () => { powers.invincible = true; }, tronWin: () => tronWin(), extra: () => ({ portals, tron, chaos, obstacles, food, records, palet: PALET, banner, bugun: todayKey(), dunku: dunkuSkor() }) } } : {})
    };
    return PUBLIC;
})();

// Initialize
document.addEventListener('DOMContentLoaded', SnakeGame.init);
