//! yilan-core: Yılan Arcade Rust çekirdeği (Aşama 1-2, 4: Survivor döngüleri). Bağımlılık yok.
//! WebAssembly için ham `extern "C"` ihracı (wasm-bindgen gerekmez); aynı
//! fonksiyonlar yerel .so/.dll olarak ctypes ile de çağrılır.

pub mod rng;
pub mod survivor;
pub mod tron;

use rng::Pcg32;
use std::alloc::{alloc as raw_alloc, dealloc as raw_dealloc, Layout};

/// Sürüm: 0x00MMmmpp
#[no_mangle]
pub extern "C" fn yc_version() -> u32 {
    0x0000_0200
}

/// JS/Python için bellek ayır (bayt). Başarısızsa 0 (null) döner.
#[no_mangle]
pub extern "C" fn yc_alloc(bytes: usize) -> *mut u8 {
    if bytes == 0 {
        return std::ptr::null_mut();
    }
    unsafe { raw_alloc(Layout::from_size_align_unchecked(bytes, 8)) }
}

/// # Safety
/// `ptr`, aynı `bytes` ile `yc_alloc`'tan gelmiş olmalı.
#[no_mangle]
pub unsafe extern "C" fn yc_free(ptr: *mut u8, bytes: usize) {
    if !ptr.is_null() && bytes != 0 {
        raw_dealloc(ptr, Layout::from_size_align_unchecked(bytes, 8));
    }
}

unsafe fn cells(p: *const i32, n: usize) -> Vec<(i32, i32)> {
    if p.is_null() || n == 0 {
        return Vec::new();
    }
    let s = std::slice::from_raw_parts(p, n * 2);
    s.chunks_exact(2).map(|c| (c[0], c[1])).collect()
}

/// Tron YZ kararı. snake/ai: [x0,y0,x1,y1,...] i32 dizisi (baş ilk). len = hücre sayısı.
/// r1, r2 in [0,1): dışarıdan verilen rastgele sayılar (JS Math.random sırasıyla).
/// Dönüş: yön indeksi (0 sağ, 1 sol, 2 aşağı, 3 yukarı) ya da -1 (geçersiz girdi).
///
/// # Safety
/// snake ve ai, en az len*2 adet i32 içeren geçerli bellek olmalı.
#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub unsafe extern "C" fn yc_tron_choose(
    cols: i32, rows: i32,
    snake: *const i32, snake_len: usize,
    ai: *const i32, ai_len: usize,
    ai_dx: i32, ai_dy: i32, next_dx: i32, next_dy: i32,
    wins: i32, r1: f64, r2: f64,
) -> i32 {
    if cols <= 0 || rows <= 0 || cols > 4096 || rows > 4096 {
        return -1;
    }
    if snake_len == 0 || ai_len == 0 || snake.is_null() || ai.is_null() {
        return -1;
    }
    if !(0.0..1.0).contains(&r1) || !(0.0..1.0).contains(&r2) {
        return -1;
    }
    let s = cells(snake, snake_len);
    let a = cells(ai, ai_len);
    tron::ai_choose_dir(cols, rows, &s, &a, (ai_dx, ai_dy), (next_dx, next_dy), wins, r1, r2) as i32
}

/// Aynı karar, rastgelelik tohumdan (PCG32): r1, r2 sırayla çekilir.
/// seed 64 bit (JS için lo/hi iki u32 parçası).
///
/// # Safety
/// `yc_tron_choose` ile aynı.
#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub unsafe extern "C" fn yc_tron_choose_seeded(
    cols: i32, rows: i32,
    snake: *const i32, snake_len: usize,
    ai: *const i32, ai_len: usize,
    ai_dx: i32, ai_dy: i32, next_dx: i32, next_dy: i32,
    wins: i32, seed_lo: u32, seed_hi: u32,
) -> i32 {
    let mut rng = Pcg32::new(((seed_hi as u64) << 32) | seed_lo as u64, 54);
    let r1 = rng.next_f64();
    let r2 = rng.next_f64();
    yc_tron_choose(cols, rows, snake, snake_len, ai, ai_len, ai_dx, ai_dy, next_dx, next_dy, wins, r1, r2)
}

/// Başlangıçtan erişilebilir hücre sayısı (engel listesi verilir).
///
/// # Safety
/// blocked, en az blocked_len*2 adet i32 içermeli.
#[no_mangle]
pub unsafe extern "C" fn yc_flood_count(
    cols: i32, rows: i32, blocked: *const i32, blocked_len: usize, sx: i32, sy: i32,
) -> i32 {
    if cols <= 0 || rows <= 0 || cols > 4096 || rows > 4096 {
        return -1;
    }
    let mut g = tron::Grid::new(cols, rows);
    for (x, y) in cells(blocked, blocked_len) {
        g.set(x, y);
    }
    g.flood_count(sx, sy)
}

/// Tohumlu dizinin `index`. sayısı, [0,1) (test/uyum için).
#[no_mangle]
pub extern "C" fn yc_rng_f64(seed_lo: u32, seed_hi: u32, index: u32) -> f64 {
    let mut r = Pcg32::new(((seed_hi as u64) << 32) | seed_lo as u64, 54);
    let mut v = 0.0;
    for _ in 0..=index {
        v = r.next_f64();
    }
    v
}

// ---------------- Survivor (Aşama 4) ----------------
// Tamponlar: düşman [x,y,hp] f64 (adım 3), mermi [x,y,dx,dy,dmg] f64 (adım 5). Uzunluklar öğe sayısıdır.
// Geçersiz girdi (null işaretçi, aşırı uzunluk, sonlu olmayan sayı) -> -1, tampona dokunulmaz.

const SV_MAX: usize = 1 << 20;

unsafe fn en_slice<'a>(p: *mut f64, n: usize) -> Option<&'a mut [f64]> {
    if n > SV_MAX || (n > 0 && p.is_null()) {
        return None;
    }
    if n == 0 {
        return Some(&mut []);
    }
    Some(std::slice::from_raw_parts_mut(p, n * survivor::EN_STRIDE))
}

/// Düşmanları başa doğru ilerletir (yerinde). Dönüş: n ya da -1.
///
/// # Safety
/// `en` en az n*3 f64 içermeli.
#[no_mangle]
pub unsafe extern "C" fn yc_sv_move_enemies(en: *mut f64, n: usize, hx: f64, hy: f64, espd: f64) -> i32 {
    if !hx.is_finite() || !hy.is_finite() || !espd.is_finite() {
        return -1;
    }
    match en_slice(en, n) {
        Some(e) => {
            survivor::move_enemies(e, hx, hy, espd);
            n as i32
        }
        None => -1,
    }
}

/// Mermileri ilerletir, çarpışmaları işler. Mermi x/y ve düşman hp yerinde güncellenir.
/// keep: m adet i32 (1 kalır / 0 silinir), dead: n adet i32 (ölen düşman indeksleri, ölüm sırasıyla).
/// Dönüş: ölen düşman sayısı ya da -1.
///
/// # Safety
/// shots >= m*5 f64, en >= n*3 f64, keep >= m i32, dead >= n i32.
#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub unsafe extern "C" fn yc_sv_move_shots(
    shots: *mut f64, m: usize, en: *mut f64, n: usize, cols: f64, rows: f64, keep: *mut i32, dead: *mut i32,
) -> i32 {
    if !cols.is_finite() || !rows.is_finite() || m > SV_MAX {
        return -1;
    }
    if m > 0 && (shots.is_null() || keep.is_null()) {
        return -1;
    }
    if n > 0 && dead.is_null() {
        return -1;
    }
    let e = match en_slice(en, n) {
        Some(e) => e,
        None => return -1,
    };
    if m == 0 {
        return 0;
    }
    let s = std::slice::from_raw_parts_mut(shots, m * survivor::SHOT_STRIDE);
    let k = std::slice::from_raw_parts_mut(keep, m);
    let d: &mut [i32] = if n == 0 { &mut [] } else { std::slice::from_raw_parts_mut(dead, n) };
    survivor::move_shots(s, e, cols, rows, k, d) as i32
}

/// En yakın düşman (<= 11) indeksi; yoksa -1, geçersiz girdide -2.
///
/// # Safety
/// `en` en az n*3 f64 içermeli.
#[no_mangle]
pub unsafe extern "C" fn yc_sv_nearest(en: *mut f64, n: usize, hx: f64, hy: f64) -> i32 {
    if !hx.is_finite() || !hy.is_finite() {
        return -2;
    }
    match en_slice(en, n) {
        Some(e) => survivor::nearest_enemy(e, hx, hy),
        None => -2,
    }
}

/// Kafaya (< 1) değen ilk düşman indeksi; yoksa -1, geçersiz girdide -2.
///
/// # Safety
/// `en` en az n*3 f64 içermeli.
#[no_mangle]
pub unsafe extern "C" fn yc_sv_head_hit(en: *mut f64, n: usize, hx: f64, hy: f64) -> i32 {
    if !hx.is_finite() || !hy.is_finite() {
        return -2;
    }
    match en_slice(en, n) {
        Some(e) => survivor::head_hit(e, hx, hy),
        None => -2,
    }
}
