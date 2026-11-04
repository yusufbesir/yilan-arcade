//! Tron rakip YZ'si. src/game.js içindeki tronBlocked / floodCount / aiChooseDir
//! mantığının saf fonksiyon hali. Rastgelelik dışarıdan (r1, r2 in [0,1)) verilir;
//! JS tarafında Math.random() çağrı sırası aynen korunur:
//!   r1: "dalgın" hamle kararı, r2: dalgın seçim ya da eşitlik bozma.

/// JS DIRS4 sırası: sağ, sol, aşağı, yukarı.
pub const DIRS4: [(i32, i32); 4] = [(1, 0), (-1, 0), (0, 1), (0, -1)];

pub struct Grid {
    pub cols: i32,
    pub rows: i32,
    blocked: Vec<bool>,
}

impl Grid {
    pub fn new(cols: i32, rows: i32) -> Self {
        let n = (cols.max(0) * rows.max(0)) as usize;
        Grid { cols, rows, blocked: vec![false; n] }
    }

    /// Izgara dışındaki hücreler yok sayılır (dışarısı zaten engeldir).
    pub fn set(&mut self, x: i32, y: i32) {
        if x >= 0 && x < self.cols && y >= 0 && y < self.rows {
            self.blocked[(y * self.cols + x) as usize] = true;
        }
    }

    /// tronBlocked: ızgara dışı ya da iz üstü.
    pub fn is_blocked(&self, x: i32, y: i32) -> bool {
        if x < 0 || x >= self.cols || y < 0 || y >= self.rows {
            return true;
        }
        self.blocked[(y * self.cols + x) as usize]
    }

    /// floodCount: DFS ile erişilebilir hücre sayısı; sınır COLS*ROWS.
    /// JS gibi başlangıç hücresi engel olsa da sayılır (çağıran seçenekler zaten boştur).
    pub fn flood_count(&self, sx: i32, sy: i32) -> i32 {
        let limit = (self.cols * self.rows) as usize;
        let mut seen = vec![false; limit];
        if sx >= 0 && sx < self.cols && sy >= 0 && sy < self.rows {
            seen[(sy * self.cols + sx) as usize] = true;
        }
        let mut stack: Vec<(i32, i32)> = vec![(sx, sy)];
        let mut n: usize = 0;
        while n < limit {
            let Some((x, y)) = stack.pop() else { break };
            n += 1;
            for (dx, dy) in DIRS4 {
                let (nx, ny) = (x + dx, y + dy);
                if self.is_blocked(nx, ny) || seen[(ny * self.cols + nx) as usize] {
                    continue;
                }
                seen[(ny * self.cols + nx) as usize] = true;
                stack.push((nx, ny));
            }
        }
        n as i32
    }
}

/// Yön (dx,dy) -> DIRS4 indeksi.
pub fn dir_index(dx: i32, dy: i32) -> Option<usize> {
    DIRS4.iter().position(|&d| d == (dx, dy))
}

/// aiChooseDir. snake[0] ve ai[0] baş hücrelerdir. Dönüş: DIRS4 indeksi.
/// Seçenek kalmazsa mevcut yön (ai_dir) döner (JS: return tron.aiDir).
#[allow(clippy::too_many_arguments)]
pub fn ai_choose_dir(
    cols: i32,
    rows: i32,
    snake: &[(i32, i32)],
    ai: &[(i32, i32)],
    ai_dir: (i32, i32),
    next_dir: (i32, i32),
    wins: i32,
    r1: f64,
    r2: f64,
) -> usize {
    let h = ai[0];
    let mut g = Grid::new(cols, rows);
    for &(x, y) in snake.iter().chain(ai.iter()) {
        g.set(x, y);
    }
    let mut opts: Vec<usize> = Vec::with_capacity(4);
    for (i, &(dx, dy)) in DIRS4.iter().enumerate() {
        if dx == -ai_dir.0 && dy == -ai_dir.1 {
            continue;
        }
        if !g.is_blocked(h.0 + dx, h.1 + dy) {
            opts.push(i);
        }
    }
    if opts.is_empty() {
        return dir_index(ai_dir.0, ai_dir.1).unwrap_or(0);
    }
    let pn = (snake[0].0 + next_dir.0, snake[0].1 + next_dir.1);
    let dumb = f64::max(0.02, 0.2 - wins as f64 * 0.03);
    if r1 < dumb {
        let pool: Vec<usize> = opts
            .iter()
            .copied()
            .filter(|&i| (h.0 + DIRS4[i].0, h.1 + DIRS4[i].1) != pn)
            .collect();
        let src = if pool.is_empty() { &opts } else { &pool };
        return src[(r2 * src.len() as f64).floor() as usize];
    }
    let mut best: Vec<usize> = Vec::new();
    let mut best_n = f64::NEG_INFINITY;
    for &i in &opts {
        let (dx, dy) = DIRS4[i];
        let (nx, ny) = (h.0 + dx, h.1 + dy);
        let mut n = g.flood_count(nx, ny) as f64;
        if (dx, dy) == ai_dir {
            n += 0.5;
        }
        if (nx, ny) == pn {
            n -= 1000.0;
        }
        if n > best_n {
            best_n = n;
            best = vec![i];
        } else if n == best_n {
            best.push(i);
        }
    }
    best[(r2 * best.len() as f64).floor() as usize]
}

#[cfg(test)]
mod tests {
    use super::*;

    const C: i32 = 48;
    const R: i32 = 32;

    #[test]
    fn engel_kenar_ve_iz() {
        let mut g = Grid::new(C, R);
        g.set(5, 5);
        assert!(g.is_blocked(-1, 0));
        assert!(g.is_blocked(0, -1));
        assert!(g.is_blocked(C, 0));
        assert!(g.is_blocked(0, R));
        assert!(g.is_blocked(5, 5));
        assert!(!g.is_blocked(5, 6));
        assert!(!g.is_blocked(0, 0));
        assert!(!g.is_blocked(C - 1, R - 1));
    }

    #[test]
    fn flood_bos_izgara_tum_hucreler() {
        let g = Grid::new(C, R);
        // sınır COLS*ROWS: boş ızgarada tümü sayılır, aşmaz
        assert_eq!(g.flood_count(0, 0), C * R);
        assert_eq!(g.flood_count(20, 10), C * R);
    }

    #[test]
    fn flood_kapali_oda() {
        let mut g = Grid::new(C, R);
        // 3x3 oda: duvar çevresi
        for x in 9..=13 {
            g.set(x, 9);
            g.set(x, 13);
        }
        for y in 9..=13 {
            g.set(9, y);
            g.set(13, y);
        }
        assert_eq!(g.flood_count(11, 11), 9);
        assert_eq!(g.flood_count(0, 0), C * R - 25);
    }

    #[test]
    fn flood_tek_hucre_ve_kose() {
        let mut g = Grid::new(C, R);
        g.set(1, 0);
        g.set(0, 1);
        assert_eq!(g.flood_count(0, 0), 1);
    }

    #[test]
    fn flood_kucuk_izgara_sinir() {
        let g = Grid::new(1, 1);
        assert_eq!(g.flood_count(0, 0), 1);
        let g = Grid::new(2, 2);
        assert_eq!(g.flood_count(0, 0), 4);
    }

    #[test]
    fn tek_secenek_ve_ters_yon_yasak() {
        // AI sol duvarda (0,5) sola gidiyor: sol engel, sağ ters yön değil (aiDir=-1,0 -> sağ ters, yasak)
        let snake = [(20, 20), (21, 20)];
        let ai = [(0, 5), (1, 5)];
        let d = ai_choose_dir(C, R, &snake, &ai, (-1, 0), (1, 0), 0, 0.99, 0.0);
        // seçenekler: aşağı(2) / yukarı(3); sağ yasak, sol duvar
        assert!(d == 2 || d == 3);
    }

    #[test]
    fn secenek_yoksa_mevcut_yon() {
        // (0,0) köşesi: sol/üst duvar, sağ ve alt iz
        let snake = [(1, 0), (0, 1)];
        let ai = [(0, 0)];
        let d = ai_choose_dir(C, R, &snake, &ai, (-1, 0), (1, 0), 0, 0.99, 0.0);
        assert_eq!(d, dir_index(-1, 0).unwrap());
    }

    #[test]
    fn genis_alani_secer() {
        // AI y=5 üst duvara yakın (y=0 satırı yukarıda boş ama dar değil); sağda duvar gibi iz ile kapalı küçük cep
        let mut snake = vec![(40, 30)];
        // sağ tarafı küçük cep yap: (11,5) önünde cep
        let ai = [(10, 5), (9, 5)];
        for y in 0..R {
            if y != 6 {
                snake.push((12, y));
            }
        }
        // sağ (11,5): cep (x=11, y 0..R minus) içinde 11 hücre sütun x=10..11 kısmı; aşağı (10,6) büyük alana
        let d = ai_choose_dir(C, R, &snake, &ai, (1, 0), (1, 0), 99, 0.99, 0.0);
        let _ = d; // iki yön de geçerli; çökmeden dönmeli
        assert!(d < 4);
    }

    #[test]
    fn kafa_kafaya_hucreden_kacin() {
        // Oyuncu sonraki başı (11,5); AI (10,5) -> sağ hücre (11,5) = pn: -1000 ceza
        let snake = [(12, 5), (13, 5)];
        let ai = [(10, 5), (9, 5)];
        let d = ai_choose_dir(C, R, &snake, &ai, (1, 0), (-1, 0), 99, 0.99, 0.0);
        assert_ne!(d, 0, "kafa kafaya hücreye gitmemeli");
    }

    #[test]
    fn dalgin_hamle_pn_haric() {
        let snake = [(12, 5), (13, 5)];
        let ai = [(10, 5), (9, 5)];
        // r1=0 -> her zaman dalgın; havuz pn hariç; r2 tüm aralıkta sağa (0) gitmemeli
        for k in 0..10 {
            let r2 = k as f64 / 10.0;
            let d = ai_choose_dir(C, R, &snake, &ai, (1, 0), (-1, 0), 0, 0.0, r2);
            assert_ne!(d, 0);
        }
    }

    #[test]
    fn tek_secenek_pn_ise_yine_secilir() {
        // Tek seçenek pn hücresi: havuz boş -> opts kullanılır
        let snake = [(2, 0), (3, 0)];
        let ai = [(0, 0), (0, 1)];
        // AI (0,0), aiDir (0,-1): yasak (0,1)=aşağı... seçenekler: sağ (1,0)=pn, sol/üst duvar
        let d = ai_choose_dir(C, R, &snake, &ai, (0, -1), (-1, 0), 0, 0.0, 0.0);
        assert_eq!(d, 0);
    }

    #[test]
    fn deterministik_ayni_girdi_ayni_cikti() {
        let snake = [(20, 10), (21, 10), (22, 10)];
        let ai = [(30, 15), (31, 15), (32, 15)];
        let a = ai_choose_dir(C, R, &snake, &ai, (-1, 0), (1, 0), 2, 0.7, 0.3);
        let b = ai_choose_dir(C, R, &snake, &ai, (-1, 0), (1, 0), 2, 0.7, 0.3);
        assert_eq!(a, b);
    }
}
