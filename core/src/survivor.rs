//! Survivor (ve Kuyruk Silahı ile paylaşılan düşman) ağır döngüleri: `src/core/survivor.js` içindeki
//! `moveEnemies`, `moveShots`, `nearestEnemy`, `headHit` ile BİREBİR aynı sonuç (aynı işlem sırası, f64).
//!
//! Kayan nokta eşliği:
//! - `js_hypot`: V8'in `Math.hypot` algoritmasının (src/builtins/math.tq: en büyüğe bölme + Kahan toplamı +
//!   sqrt * max) birebir kopyası. Rust'ın `f64::hypot`'u (libm) V8 ile ~%30 durumda son bitte ayrışıyor.
//! - `atan2` / `cos` / `sin`: wasm'da JS'in kendi `Math.atan2/cos/sin`'i içe aktarılır (modül `yc_math`).
//!   Rust libm'in sin/cos'u Node 22'nin Math.sin/cos'undan ~%0,8 durumda son bitte ayrışıyor (ölçüldü),
//!   ayrıca Chromium/Electron derlemesine göre V8'in trig gerçeklemesi değişebilir; içe aktarma, hangi V8
//!   olursa olsun JS ile aynı sonucu garanti eder. Yerel (.so, cargo test) derlemede std kullanılır:
//!   mantık aynı, son bit JS ile garanti değildir.
//!
//! Düzen: düşman tamponu `[x, y, hp]` (f64, adım 3), mermi tamponu `[x, y, dx, dy, dmg]` (f64, adım 5).
//! `dmg`, JS'teki `s.dmg || 1` sonucudur (sarmalayıcı hesaplar).

pub const EN_STRIDE: usize = 3;
pub const SHOT_STRIDE: usize = 5;

#[cfg(target_arch = "wasm32")]
mod jsmath {
    #[link(wasm_import_module = "yc_math")]
    extern "C" {
        fn atan2(y: f64, x: f64) -> f64;
        fn cos(x: f64) -> f64;
        fn sin(x: f64) -> f64;
    }
    #[inline]
    pub fn js_atan2(y: f64, x: f64) -> f64 { unsafe { atan2(y, x) } }
    #[inline]
    pub fn js_cos(x: f64) -> f64 { unsafe { cos(x) } }
    #[inline]
    pub fn js_sin(x: f64) -> f64 { unsafe { sin(x) } }
}

#[cfg(not(target_arch = "wasm32"))]
mod jsmath {
    #[inline]
    pub fn js_atan2(y: f64, x: f64) -> f64 { y.atan2(x) }
    #[inline]
    pub fn js_cos(x: f64) -> f64 { x.cos() }
    #[inline]
    pub fn js_sin(x: f64) -> f64 { x.sin() }
}

pub use jsmath::{js_atan2, js_cos, js_sin};

/// V8 `Math.hypot(a, b)` ile bit düzeyinde aynı (math.tq MathHypot).
#[inline]
pub fn js_hypot(a: f64, b: f64) -> f64 {
    let mut nan = false;
    let mut max = 0.0f64;
    let mut abs = [0.0f64; 2];
    for (i, v) in [a, b].into_iter().enumerate() {
        if v.is_nan() {
            nan = true;
        } else {
            let av = v.abs();
            abs[i] = av;
            if av > max {
                max = av;
            }
        }
    }
    if max == f64::INFINITY {
        return f64::INFINITY;
    } else if nan {
        return f64::NAN;
    } else if max == 0.0 {
        return 0.0;
    }
    let mut sum = 0.0f64;
    let mut comp = 0.0f64;
    for av in abs {
        let n = av / max;
        let summand = n * n - comp;
        let pre = sum + summand;
        comp = (pre - sum) - summand;
        sum = pre;
    }
    sum.sqrt() * max
}

/// moveEnemies: her düşman başa doğru `espd` kadar ilerler (yerinde).
pub fn move_enemies(en: &mut [f64], hx: f64, hy: f64, espd: f64) {
    for e in en.chunks_exact_mut(EN_STRIDE) {
        let a = js_atan2(hy - e[1], hx - e[0]);
        e[0] += js_cos(a) * espd;
        e[1] += js_sin(a) * espd;
    }
}

/// moveShots: mermiler 3 alt adımda (0,5) ilerler; her adımda düşmanlara (sırayla, hp>0) bakar.
/// Mermi x/y ve düşman hp yerinde güncellenir. `keep[i]` = 1 kalan, 0 silinen mermi.
/// Ölen düşman indeksleri ölüm sırasıyla `dead`'e yazılır; dönüş ölü sayısı.
pub fn move_shots(shots: &mut [f64], en: &mut [f64], cols: f64, rows: f64, keep: &mut [i32], dead: &mut [i32]) -> usize {
    let n = en.len() / EN_STRIDE;
    let mut nd = 0usize;
    for (si, s) in shots.chunks_exact_mut(SHOT_STRIDE).enumerate() {
        let mut vurdu = false;
        'adim: for _ in 0..3 {
            s[0] += s[2] * 0.5;
            s[1] += s[3] * 0.5;
            for ei in 0..n {
                let b = ei * EN_STRIDE;
                if en[b + 2] > 0.0 && js_hypot(en[b] - s[0], en[b + 1] - s[1]) < 0.9 {
                    en[b + 2] -= s[4];
                    if en[b + 2] <= 0.0 {
                        dead[nd] = ei as i32;
                        nd += 1;
                    }
                    vurdu = true;
                    break 'adim;
                }
            }
        }
        keep[si] = if !vurdu && s[0] > -2.0 && s[0] < cols + 2.0 && s[1] > -2.0 && s[1] < rows + 2.0 { 1 } else { 0 };
    }
    nd
}

/// nearestEnemy: en yakın düşmanın indeksi (11 birimden uzaksa ya da yoksa -1). Eşitlikte ilk.
pub fn nearest_enemy(en: &[f64], hx: f64, hy: f64) -> i32 {
    let mut best = -1i32;
    let mut bd = 1e9f64;
    for (i, e) in en.chunks_exact(EN_STRIDE).enumerate() {
        let d = js_hypot(e[0] - hx, e[1] - hy);
        if d < bd {
            bd = d;
            best = i as i32;
        }
    }
    if bd <= 11.0 { best } else { -1 }
}

/// headHit: kafaya (< 1,0) değen ilk düşmanın indeksi, yoksa -1.
pub fn head_hit(en: &[f64], hx: f64, hy: f64) -> i32 {
    for (i, e) in en.chunks_exact(EN_STRIDE).enumerate() {
        if js_hypot(hx - e[0], hy - e[1]) < 1.0 {
            return i as i32;
        }
    }
    -1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hypot_temel() {
        assert_eq!(js_hypot(3.0, 4.0), 5.0);
        assert_eq!(js_hypot(0.0, -0.0), 0.0);
        assert_eq!(js_hypot(f64::NAN, f64::INFINITY), f64::INFINITY);
        assert!(js_hypot(f64::NAN, 1.0).is_nan());
        assert_eq!(js_hypot(-2.0, 0.0), 2.0);
    }

    #[test]
    fn dusman_basa_yaklasir() {
        let mut en = vec![10.0, 0.0, 1.0, 0.0, 10.0, 2.0];
        move_enemies(&mut en, 0.0, 0.0, 0.5);
        assert!((en[0] - 9.5).abs() < 1e-12 && en[1].abs() < 1e-12);
        assert!(en[3].abs() < 1e-12 && (en[4] - 9.5).abs() < 1e-12);
        assert_eq!(en[2], 1.0);
        assert_eq!(en[5], 2.0);
    }

    #[test]
    fn mermi_vurur_ve_oldurur() {
        // mermi (0,0) sağa; düşman (1,0) hp1 -> ilk alt adımda (0.5,0) mesafe 0.5 < 0.9: ölür
        let mut shots = vec![0.0, 0.0, 1.0, 0.0, 1.0, 0.0, 5.0, 1.0, 0.0, 1.0];
        let mut en = vec![1.0, 0.0, 1.0, 20.0, 20.0, 2.0];
        let mut keep = vec![9; 2];
        let mut dead = vec![-1; 2];
        let nd = move_shots(&mut shots, &mut en, 48.0, 32.0, &mut keep, &mut dead);
        assert_eq!(nd, 1);
        assert_eq!(dead[0], 0);
        assert_eq!(keep, vec![0, 1]);
        assert_eq!(en[2], 0.0);
        assert_eq!(en[5], 2.0);
        assert_eq!(shots[0], 0.5); // vuruştan sonra ilerlemez
        assert_eq!(shots[5], 1.5); // ikinci mermi 3 adım
    }

    #[test]
    fn mermi_hasar_olmeden() {
        let mut shots = vec![0.0, 0.0, 1.0, 0.0, 1.0];
        let mut en = vec![1.0, 0.0, 3.0];
        let (mut keep, mut dead) = (vec![1], vec![-1]);
        assert_eq!(move_shots(&mut shots, &mut en, 48.0, 32.0, &mut keep, &mut dead), 0);
        assert_eq!(en[2], 2.0);
        assert_eq!(keep[0], 0);
    }

    #[test]
    fn mermi_sinir_disi() {
        let mut shots = vec![48.5, 3.0, 1.0, 0.0, 1.0];
        let mut en: Vec<f64> = vec![];
        let (mut keep, mut dead) = (vec![1], vec![]);
        assert_eq!(move_shots(&mut shots, &mut en, 48.0, 32.0, &mut keep, &mut dead), 0);
        assert_eq!(shots[0], 50.0);
        assert_eq!(keep[0], 0); // 50 < 50 değil
    }

    #[test]
    fn olu_dusmana_carpmaz() {
        let mut shots = vec![0.0, 0.0, 1.0, 0.0, 1.0];
        let mut en = vec![1.0, 0.0, 0.0, 1.5, 0.0, 1.0];
        let (mut keep, mut dead) = (vec![1], vec![-1; 2]);
        assert_eq!(move_shots(&mut shots, &mut en, 48.0, 32.0, &mut keep, &mut dead), 1);
        assert_eq!(dead[0], 1);
    }

    #[test]
    fn en_yakin_ve_kafa() {
        let en = vec![5.0, 0.0, 1.0, 3.0, 0.0, 1.0, 3.0, 0.0, 1.0, 0.5, 0.5, 1.0];
        assert_eq!(nearest_enemy(&en, 0.0, 0.0), 3);
        assert_eq!(nearest_enemy(&en[..9], 0.0, 0.0), 1); // eşitlikte ilk
        assert_eq!(nearest_enemy(&[20.0, 0.0, 1.0], 0.0, 0.0), -1);
        assert_eq!(nearest_enemy(&[11.0, 0.0, 1.0], 0.0, 0.0), 0);
        assert_eq!(nearest_enemy(&[], 0.0, 0.0), -1);
        assert_eq!(head_hit(&en, 0.0, 0.0), 3);
        assert_eq!(head_hit(&en[..9], 0.0, 0.0), -1);
    }
}
