//! yilan-core: Yılan Arcade Rust çekirdeği (Aşama 1-2). Bağımlılık yok.
//! WebAssembly için ham `extern "C"` ihracı (wasm-bindgen gerekmez); aynı
//! fonksiyonlar yerel .so/.dll olarak ctypes ile de çağrılır.

pub mod rng;
pub mod tron;

use rng::Pcg32;
use std::alloc::{alloc as raw_alloc, dealloc as raw_dealloc, Layout};

/// Sürüm: 0x00MMmmpp
#[no_mangle]
pub extern "C" fn yc_version() -> u32 {
    0x0000_0100
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
