//! Emberwake çekirdeği. Aşama 1: JS `mulberry` ile birebir aynı RNG.

/// mulberry32: `src/mantik.js` içindeki `mulberry(a)` ile aynı sayı dizisini üretir.
pub mod oda;
pub mod oyuncu;
pub mod veri;

pub struct Rng {
    a: u32,
}

impl Rng {
    pub fn new(seed: u32) -> Self {
        Rng { a: seed }
    }

    /// [0, 1) aralığında sayı (JS: ((t ^ (t >>> 14)) >>> 0) / 4294967296)
    pub fn next(&mut self) -> f64 {
        self.a = self.a.wrapping_add(0x6D2B_79F5);
        let mut t = self.a;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        ((t ^ (t >> 14)) as f64) / 4294967296.0
    }

    pub fn secim<'a, T>(&mut self, d: &'a [T]) -> &'a T {
        &d[(self.next() * d.len() as f64) as usize]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Değerler `node -e "const TK=require('../src/mantik.js');const r=TK.mulberry(...)"` ile üretildi.
    #[test]
    fn js_ile_ayni_dizi() {
        let mut r = Rng::new(42);
        let beklenen = include_str!("../testdata/mulberry42.txt");
        for satir in beklenen.lines() {
            let b: f64 = satir.parse().unwrap();
            assert_eq!(r.next().to_bits(), b.to_bits());
        }
    }

    #[test]
    fn aralik_ve_tekrarlanabilirlik() {
        let mut a = Rng::new(7);
        let mut b = Rng::new(7);
        for _ in 0..1000 {
            let x = a.next();
            assert!((0.0..1.0).contains(&x));
            assert_eq!(x.to_bits(), b.next().to_bits());
        }
    }
}
