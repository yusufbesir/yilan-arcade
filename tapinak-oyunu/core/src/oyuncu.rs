//! Aşama 4a: oyuncu adımı (hareket, çarpışma, atılım, zamanlayıcılar, açlık/susuzluk, zemin tehlikeleri).
//! `src/mantik.js` içindeki `adim` oyuncu kısmıyla aynı sayısal davranış (düşman/mermi sonraki parça).
use crate::oda::{Izgara, CATLAK, DUVAR, H, KAPIK, LAV, SIVRI, SUTUN, UCURUM, W};

#[derive(Clone, Debug, Default)]
pub struct Girdi { pub mx: f64, pub my: f64, pub nisan: Option<(f64, f64)>, pub atilim: bool, pub savur: bool, pub koz: bool }

#[derive(Clone, Debug, Default)]
pub struct Armagan { pub ruzgar: f64, pub bilek: f64, pub golge: f64, pub tilsim: f64, pub keskin: f64, pub kivilcim: f64 }

#[derive(Clone, Debug, Default)]
pub struct Ayar { pub iase: f64, pub guc: f64, pub kitlik: bool, pub sicrama: bool, pub gizli_oda: bool }

#[derive(Clone, Debug)]
pub struct Oyuncu {
    pub x: f64, pub y: f64, pub r: f64, pub dir: f64, pub hp: f64, pub max_hp: f64,
    pub swing_t: f64, pub swing_cd: f64, pub dash_t: f64, pub dash_cd: f64, pub dash_x: f64, pub dash_y: f64, pub inv: f64,
    pub koz_yuk: i32, pub koz_maks: i32, pub koz_sayac: f64, pub aclik: f64, pub susuz: f64, pub lav_t: f64, pub swing_id: u32, pub swing_yon: f64,
}

impl Oyuncu {
    pub fn yeni(hp: f64, koz: i32) -> Oyuncu {
        Oyuncu { x: 11.0, y: 11.4, r: 0.32, dir: -std::f64::consts::FRAC_PI_2, hp, max_hp: hp, swing_t: 0.0, swing_cd: 0.0, dash_t: 0.0, dash_cd: 0.0, dash_x: 0.0, dash_y: 0.0, inv: 0.0,
            koz_yuk: koz, koz_maks: koz, koz_sayac: 0.0, aclik: 100.0, susuz: 100.0, lav_t: 0.0, swing_id: 0, swing_yon: 0.0 }
    }
}

pub struct Sim { pub grid: Izgara, pub zaman: f64, pub p: Oyuncu, pub arm: Armagan, pub ayar: Ayar, pub bitti: bool }

impl Sim {
    pub fn hucre(&self, x: f64, y: f64) -> u8 {
        let (ix, iy) = (x.floor(), y.floor());
        if ix < 0.0 || iy < 0.0 || ix >= W as f64 || iy >= H as f64 { return DUVAR; }
        self.grid[iy as usize][ix as usize]
    }
    fn engelli(&self, t: u8) -> bool {
        match t {
            DUVAR | SUTUN | CATLAK | KAPIK => true,
            UCURUM => !(self.p.dash_t > 0.0 && self.ayar.sicrama),
            _ => false,
        }
    }
    fn carpisir(&self, x: f64, y: f64) -> bool {
        let r = self.p.r;
        self.engelli(self.hucre(x - r, y - r)) || self.engelli(self.hucre(x + r, y - r)) || self.engelli(self.hucre(x - r, y + r)) || self.engelli(self.hucre(x + r, y + r))
    }
    fn hareket(&mut self, dx: f64, dy: f64) {
        if !self.carpisir(self.p.x + dx, self.p.y) { self.p.x += dx; }
        if !self.carpisir(self.p.x, self.p.y + dy) { self.p.y += dy; }
    }
    fn hiz_carpan(&self) -> f64 { (1.0 + 0.12 * self.arm.ruzgar) * if self.p.susuz < 25.0 { 0.88 } else { 1.0 } }
    fn ac_hizi(&self) -> f64 { (1.0 - 0.15 * self.ayar.iase) * if self.arm.tilsim > 0.0 { 0.75f64.powf(self.arm.tilsim.min(2.0)) } else { 1.0 } * if self.ayar.kitlik { 1.6 } else { 1.0 } }
    fn oyuncu_hasar(&mut self, d: f64) {
        if self.p.inv > 0.0 || self.p.dash_t > 0.0 || self.bitti { return; }
        self.p.hp -= d; self.p.inv = 0.8;
        if self.p.hp <= 0.0 { self.p.hp = 0.0; self.bitti = true; }
    }
    pub fn sivri_durum(zaman: f64, x: f64, y: f64) -> u8 {
        let ph = (zaman + ((x * 7.0 + y * 13.0) % 5.0) * 0.3) % 3.0;
        if ph > 2.2 { 2 } else if ph > 1.6 { 1 } else { 0 }
    }

    pub fn adim(&mut self, g: &Girdi, dt: f64) {
        if self.bitti { return; }
        self.zaman += dt;
        let p = &mut self.p;
        for v in [&mut p.swing_t, &mut p.swing_cd, &mut p.dash_cd, &mut p.inv] { *v = (*v - dt).max(0.0); }
        if p.koz_yuk < p.koz_maks { p.koz_sayac += dt; if p.koz_sayac >= 2.6 { p.koz_sayac = 0.0; p.koz_yuk += 1; } } else { p.koz_sayac = 0.0; }
        let ah = self.ac_hizi();
        let p = &mut self.p;
        if !self.ayar.gizli_oda { p.aclik = (p.aclik - dt * 0.2 * ah).max(0.0); p.susuz = (p.susuz - dt * 0.26 * ah).max(0.0); }
        if (p.aclik <= 0.0 || p.susuz <= 0.0) && p.hp > 1.0 { p.hp = (p.hp - dt * 1.2).max(1.0); }
        if let Some((hx, hy)) = g.nisan { p.dir = (hy - p.y).atan2(hx - p.x); }
        if self.p.dash_t > 0.0 {
            self.p.dash_t -= dt;
            let v = 14.5 * dt;
            let (dx, dy) = (self.p.dash_x * v, self.p.dash_y * v);
            self.hareket(dx, dy);
            if self.p.dash_t <= 0.0 && self.hucre(self.p.x, self.p.y) == UCURUM { self.p.dash_t = 0.04; }
        } else {
            let (mut mx, mut my) = (g.mx, g.my);
            let l = mx.hypot(my);
            if l > 1.0 { mx /= l; my /= l; }
            let v = 4.6 * self.hiz_carpan() * dt * if self.p.swing_t > 0.0 { 0.55 } else { 1.0 };
            self.hareket(mx * v, my * v);
        }
        if g.atilim { self.atilim(g.mx, g.my); }
        if g.savur && self.p.swing_cd <= 0.0 && self.p.dash_t <= 0.0 {
            self.p.swing_t = 0.2; self.p.swing_cd = 0.4 * 0.85f64.powf(self.arm.bilek); self.p.swing_id += 1;
        }
        if g.koz && self.p.koz_yuk >= 1 { self.p.koz_yuk -= 1; }
        let zt = self.hucre(self.p.x, self.p.y);
        if zt == SIVRI && Self::sivri_durum(self.zaman, self.p.x.floor(), self.p.y.floor()) == 2 { self.oyuncu_hasar(12.0); }
        if zt == LAV {
            self.p.lav_t -= dt;
            if self.p.lav_t <= 0.0 && self.p.dash_t <= 0.0 { self.p.lav_t = 0.6; self.oyuncu_hasar(8.0); }
        }
    }

    fn atilim(&mut self, mx: f64, my: f64) {
        if self.p.dash_cd > 0.0 || self.p.dash_t > 0.0 { return; }
        let (mut dx, mut dy) = (mx, my);
        let l = dx.hypot(dy);
        if l < 0.1 { dx = self.p.dir.cos(); dy = self.p.dir.sin(); } else { dx /= l; dy /= l; }
        self.p.dash_x = dx; self.p.dash_y = dy; self.p.dash_t = 0.18; self.p.dash_cd = 0.7 * 0.8f64.powf(self.arm.golge);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Rng;

    fn ayristir(g: &str) -> Izgara {
        let mut o = [[0u8; W]; H];
        for (y, satir) in g.split('/').enumerate() { for (x, c) in satir.chars().enumerate() { o[y][x] = c.to_digit(16).unwrap() as u8; } }
        o
    }

    #[test]
    fn js_ile_ayni_oyuncu_adimi() {
        let veri = include_str!("../testdata/oyuncu.txt");
        let mut say = 0;
        for satir in veri.lines() {
            let p: Vec<&str> = satir.split(' ').collect();
            let sc: u32 = p[0].parse().unwrap();
            let f = |i: usize| -> f64 { p[i].parse().unwrap() };
            let mut sim = Sim {
                grid: ayristir(p[9]), zaman: 0.0, p: Oyuncu::yeni(100.0, 2),
                arm: Armagan { ruzgar: f(5), bilek: f(6), golge: f(7), tilsim: f(8), ..Default::default() },
                ayar: Ayar { iase: f(1), guc: f(2), sicrama: p[3] == "1", kitlik: p[4] == "1", gizli_oda: false }, bitti: false,
            };
            let mut r = Rng::new(1000 + sc);
            let beklenen: Vec<&str> = p[10].split(';').collect();
            for i in 1..=900 {
                let mx = r.next() * 2.0 - 1.0; let my = r.next() * 2.0 - 1.0;
                let atilim = r.next() < 0.02; let savur = r.next() < 0.05; let koz = r.next() < 0.03;
                let hx = 11.0 + (r.next() - 0.5) * 10.0; let hy = 7.0 + (r.next() - 0.5) * 8.0;
                sim.adim(&Girdi { mx, my, nisan: Some((hx, hy)), atilim, savur, koz }, 1.0 / 60.0);
                if i % 100 == 0 {
                    let b: Vec<f64> = beklenen[i / 100 - 1].split(',').map(|v| v.parse().unwrap()).collect();
                    let q = &sim.p;
                    let o = [q.x, q.y, q.dir, q.hp, q.aclik, q.susuz, q.dash_t, q.dash_cd, q.swing_t, q.swing_cd, q.inv, q.koz_yuk as f64, sim.bitti as u8 as f64];
                    for (k, (a, e)) in o.iter().zip(&b).enumerate() {
                        assert!((a - e).abs() <= 1e-9 * (1.0 + e.abs()), "sc {sc} adım {i} alan {k}: rust {a} js {e}");
                    }
                }
            }
            say += 1;
        }
        assert_eq!(say, 60);
    }
}
