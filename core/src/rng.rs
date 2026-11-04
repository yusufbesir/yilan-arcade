//! Bağımlılıksız tohumlu RNG: PCG32 (XSH-RR). Aynı tohum -> aynı dizi.

#[derive(Clone, Debug)]
pub struct Pcg32 {
    state: u64,
    inc: u64,
}

impl Pcg32 {
    pub fn new(seed: u64, stream: u64) -> Self {
        let mut r = Pcg32 { state: 0, inc: (stream << 1) | 1 };
        r.next_u32();
        r.state = r.state.wrapping_add(seed);
        r.next_u32();
        r
    }

    pub fn next_u32(&mut self) -> u32 {
        let old = self.state;
        self.state = old.wrapping_mul(6364136223846793005).wrapping_add(self.inc);
        let xorshifted = (((old >> 18) ^ old) >> 27) as u32;
        let rot = (old >> 59) as u32;
        xorshifted.rotate_right(rot)
    }

    /// [0, 1) aralığında f64 (53 bit).
    pub fn next_f64(&mut self) -> f64 {
        let hi = (self.next_u32() >> 5) as u64; // 27 bit
        let lo = (self.next_u32() >> 6) as u64; // 26 bit
        ((hi << 26) | lo) as f64 / 9007199254740992.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ayni_tohum_ayni_dizi() {
        let mut a = Pcg32::new(42, 54);
        let mut b = Pcg32::new(42, 54);
        for _ in 0..100 {
            assert_eq!(a.next_u32(), b.next_u32());
        }
    }

    #[test]
    fn farkli_tohum_farkli_dizi() {
        let mut a = Pcg32::new(1, 54);
        let mut b = Pcg32::new(2, 54);
        let same = (0..20).filter(|_| a.next_u32() == b.next_u32()).count();
        assert!(same < 3);
    }

    #[test]
    fn pcg32_referans_degerleri() {
        // pcg32 demo (seed 42, seq 54) resmi çıktısı
        let mut r = Pcg32::new(42, 54);
        let got: Vec<u32> = (0..6).map(|_| r.next_u32()).collect();
        assert_eq!(got, vec![0xa15c02b7, 0x7b47f409, 0xba1d3330, 0x83d2f293, 0xbfa4784b, 0xcbed606e]);
    }

    #[test]
    fn f64_aralik() {
        let mut r = Pcg32::new(7, 54);
        for _ in 0..10000 {
            let v = r.next_f64();
            assert!((0.0..1.0).contains(&v));
        }
    }
}
