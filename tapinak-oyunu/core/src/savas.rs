//! Aşama 4b: oyuncu saldırıları (savur, köz atışı) ve düşman hasarı. `src/mantik.js` savur/kozAt/dusmanHasar/oldur ile aynı sayılar.
use crate::oda::{Izgara, CATLAK, DUVAR, H, KAPIK, SUTUN, W};
use crate::oyuncu::{Armagan, Oyuncu};

#[derive(Clone, Debug)]
pub struct Dusman {
    pub tip: String, pub x: f64, pub y: f64, pub r: f64, pub hp: f64, pub dogum: f64, pub faz: String, pub ac: f64,
    pub etki: Option<String>, pub mini: bool, pub kul: f64, pub boss: bool,
    pub kx: f64, pub ky: f64, pub flas: f64, pub yanik: f64, pub olu: bool,
}

#[derive(Clone, Debug)]
pub struct Mermi { pub x: f64, pub y: f64, pub vx: f64, pub vy: f64, pub hasar: f64, pub r: f64, pub omur: f64, pub delme: i32, pub dost: bool, pub dusman: bool, pub vuruldu: Vec<usize> }

#[derive(Clone, Debug)]
pub struct Tuzak { pub x: f64, pub y: f64, pub r: f64, pub t: f64, pub hasar: f64 }

pub struct Savas {
    pub grid: Izgara, pub tuzaklar: Vec<Tuzak>, pub zaman: f64,
    pub p: Oyuncu, pub arm: Armagan, pub dusmanlar: Vec<Dusman>, pub mermiler: Vec<Mermi>,
    pub kul: f64, pub oldurme: u32, pub risk: bool, pub kul_seviye: f64, pub guc: f64, pub alev: bool,
}

impl Savas {
    pub fn hasar_carpan(&self) -> f64 { (1.0 + 0.08 * self.guc) * (1.0 + 0.2 * self.arm.keskin) * if self.p.aclik < 25.0 { 0.85 } else { 1.0 } }
    fn swing_cd(&self) -> f64 { 0.4 * 0.85f64.powf(self.arm.bilek) }

    pub fn savur(&mut self, aci: f64) {
        self.p.swing_t = 0.2; self.p.swing_cd = self.swing_cd(); self.p.swing_yon = aci; self.p.swing_id += 1;
        let hasar = 22.0 * self.hasar_carpan();
        let menzil = 1.75;
        for i in 0..self.dusmanlar.len() {
            let e = &self.dusmanlar[i];
            if e.olu || e.dogum > 0.0 { continue; }
            let d = (e.x - self.p.x).hypot(e.y - self.p.y);
            if d > menzil + e.r { continue; }
            let mut fark = (e.y - self.p.y).atan2(e.x - self.p.x) - aci;
            fark = fark.sin().atan2(fark.cos());
            if fark.abs() < 1.15 || d < e.r + 0.6 { self.dusman_hasar(i, hasar, aci); }
        }
    }

    pub fn koz_at(&mut self, aci: f64) {
        if self.p.koz_yuk < 1 { return; }
        self.p.koz_yuk -= 1;
        let h = 15.0 * self.hasar_carpan();
        self.mermiler.push(Mermi { x: self.p.x, y: self.p.y, vx: aci.cos() * 11.0, vy: aci.sin() * 11.0, hasar: h, r: 0.2, omur: 1.4, delme: if self.arm.kivilcim != 0.0 { 2 } else { 0 }, dost: true, dusman: false, vuruldu: vec![] });
    }

    pub fn dusman_hasar(&mut self, i: usize, mut d: f64, aci: f64) {
        {
            let e = &self.dusmanlar[i];
            if e.dogum > 0.0 || e.olu || e.faz == "hayalet" { return; }
        }
        let alev = self.alev;
        let e = &mut self.dusmanlar[i];
        if e.tip == "demirci" && (aci - (e.ac + std::f64::consts::PI)).cos() > 0.45 { d *= 0.15; }
        if e.etki.as_deref() == Some("zirh") { d *= 0.6; }
        e.hp -= d; e.flas = 0.12;
        let kuvvet = if e.boss { 0.6 } else if e.tip == "demirci" || e.tip == "buzdev" { 1.5 } else { 4.0 };
        e.kx = aci.cos() * kuvvet; e.ky = aci.sin() * kuvvet;
        if alev { e.yanik = 3.0; }
        if e.hp <= 0.0 { self.oldur(i); }
    }

    fn hucre(&self, x: f64, y: f64) -> u8 {
        let (ix, iy) = (x.floor(), y.floor());
        if ix < 0.0 || iy < 0.0 || ix >= W as f64 || iy >= H as f64 { return DUVAR; }
        self.grid[iy as usize][ix as usize]
    }

    fn oyuncu_hasar(&mut self, d: f64) {
        if self.p.inv > 0.0 || self.p.dash_t > 0.0 { return; }
        self.p.hp -= d; self.p.inv = 0.8;
    }

    /// `adim` içindeki sayaç düşüşü + tuzak + mermi bölümü (düşman yapay zekâsı ayrı parça).
    pub fn mermi_tuzak_adim(&mut self, dt: f64) {
        self.zaman += dt;
        self.p.inv = (self.p.inv - dt).max(0.0);
        for i in 0..self.tuzaklar.len() {
            self.tuzaklar[i].t -= dt;
            let t = self.tuzaklar[i].clone();
            if t.t <= 0.0 && (self.p.x - t.x).hypot(self.p.y - t.y) < t.r + self.p.r { self.oyuncu_hasar(t.hasar); }
        }
        self.tuzaklar.retain(|t| t.t > 0.0);
        for mi in 0..self.mermiler.len() {
            {
                let m = &mut self.mermiler[mi];
                m.omur -= dt; m.x += m.vx * dt; m.y += m.vy * dt;
            }
            let (mx, my) = (self.mermiler[mi].x, self.mermiler[mi].y);
            let z = self.hucre(mx, my);
            if z == DUVAR || z == SUTUN || z == CATLAK || z == KAPIK { self.mermiler[mi].omur = 0.0; continue; }
            if self.mermiler[mi].dusman {
                if (mx - self.p.x).hypot(my - self.p.y) < self.p.r + self.mermiler[mi].r { let h = self.mermiler[mi].hasar; self.oyuncu_hasar(h); self.mermiler[mi].omur = 0.0; }
            } else {
                for ei in 0..self.dusmanlar.len() {
                    let (olu, dogum, er, ex, ey) = { let e = &self.dusmanlar[ei]; (e.olu, e.dogum, e.r, e.x, e.y) };
                    let m = &self.mermiler[mi];
                    if olu || dogum > 0.0 || m.vuruldu.contains(&ei) || (m.x - ex).hypot(m.y - ey) > er + m.r { continue; }
                    let (h, aci) = (m.hasar, m.vy.atan2(m.vx));
                    self.mermiler[mi].vuruldu.push(ei);
                    self.dusman_hasar(ei, h, aci);
                    if self.mermiler[mi].delme > 0 { self.mermiler[mi].delme -= 1; } else { self.mermiler[mi].omur = 0.0; break; }
                }
            }
        }
        self.mermiler.retain(|m| m.omur > 0.0);
    }

    fn oldur(&mut self, i: usize) {
        if self.dusmanlar[i].olu { return; }
        let e = &mut self.dusmanlar[i];
        e.olu = true; self.oldurme += 1;
        let kazan = (e.kul * if e.mini { 0.4 } else { 1.0 } * if e.etki.is_some() { 1.6 } else { 1.0 } * if self.risk { 2.0 } else { 1.0 } * (1.0 + 0.15 * self.kul_seviye)).round();
        self.kul += kazan;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn f(s: &str) -> f64 { s.parse().unwrap() }
    // sin/cos libm farkı (1 ulp) olabilir: göreli 1e-12 tolerans
    fn yakin(a: f64, b: f64, m: &str) { assert!((a - b).abs() <= 1e-12 * (1.0 + b.abs()), "{m}: {a} != {b}"); }

    #[test]
    fn js_ile_ayni_savas() {
        let veri = include_str!("../testdata/savas.txt");
        let mut satir_say = 0;
        for satir in veri.lines() {
            let p: Vec<&str> = satir.split(' ').collect();
            let (guc, kul_s, risk, bilek, keskin, kivilcim, alev, aclik) = (f(p[1]), f(p[2]), p[3] == "1", f(p[4]), f(p[5]), f(p[6]), p[7] == "1", f(p[8]));
            let mut p0 = Oyuncu::yeni(100.0, 2); p0.x = 11.0; p0.y = 7.0; p0.aclik = aclik;
            let mut s = Savas { grid: [[0; W]; H], tuzaklar: vec![], zaman: 0.0, p: p0, arm: Armagan { bilek, keskin, kivilcim, ..Default::default() }, dusmanlar: vec![], mermiler: vec![], kul: 0.0, oldurme: 0, risk, kul_seviye: kul_s, guc, alev };
            for e in p[9].split(';') {
                let a: Vec<&str> = e.split(',').collect();
                s.dusmanlar.push(Dusman { tip: a[0].into(), x: f(a[1]), y: f(a[2]), r: f(a[3]), hp: f(a[4]), dogum: f(a[5]), faz: a[6].into(), ac: f(a[7]),
                    etki: if a[8] == "-" { None } else { Some(a[8].into()) }, mini: a[9] == "1", kul: f(a[10]), boss: false, kx: 0.0, ky: 0.0, flas: 0.0, yanik: 0.0, olu: false });
            }
            let sonuclar: Vec<&str> = p[10].split(';').collect();
            // açılar JS'te rg() ile üretildi; satırda yok: aynı mulberry dizisini yeniden üret
            let sc = p[0].parse::<u32>().unwrap();
            let mut rg = crate::Rng::new(2000 + sc);
            // dump sırası: düşman başına 4 sayı çekildi (tip, x, y, etki + dogum/faz/ac/mini) -> aşağıda JS ile aynı sayıda çek
            for _ in 0..s.dusmanlar.len() { for _ in 0..8 { rg.next(); } }
            for (k, beklenen) in sonuclar.iter().enumerate() {
                let aci = rg.next() * 6.28;
                let b: Vec<&str> = beklenen.split(',').collect();
                if k % 3 == 2 {
                    s.p.koz_yuk = 2; s.mermiler.clear(); s.koz_at(aci);
                    let m = &s.mermiler[0];
                    let got = [s.p.koz_yuk as f64, m.x, m.y, m.vx, m.vy, m.hasar, m.omur, m.delme as f64];
                    for (j, g) in got.iter().enumerate() { yakin(*g, f(b[j + 1]), &format!("sc {sc} k {k} koz alan {j}")); }
                } else {
                    s.p.swing_cd = 0.0; s.savur(aci);
                    let mut got = vec![s.p.swing_t, s.p.swing_cd, s.p.swing_yon, s.p.swing_id as f64, s.kul, s.oldurme as f64];
                    for e in &s.dusmanlar { got.extend([e.hp, e.kx, e.ky, e.flas, e.yanik, if e.olu { 1.0 } else { 0.0 }]); }
                    for (j, g) in got.iter().enumerate() { yakin(*g, f(b[j + 1]), &format!("sc {sc} k {k} savur alan {j}")); }
                }
            }
            satir_say += 1;
        }
        assert_eq!(satir_say, 80);
    }

    #[test]
    fn js_ile_ayni_mermi_ve_tuzak() {
        let veri = include_str!("../testdata/mermi.txt");
        let mut say = 0;
        for satir in veri.lines() {
            let p: Vec<&str> = satir.split(' ').collect();
            let sc: u32 = p[0].parse().unwrap();
            let mut grid = [[0u8; W]; H];
            for (y, row) in p[6].split('/').enumerate() { for (x, ch) in row.chars().enumerate() { grid[y][x] = ch.to_digit(16).unwrap() as u8; } }
            let mut p0 = Oyuncu::yeni(1000.0, 2); p0.x = 11.0; p0.y = 8.0;
            let mut s = Savas { grid, tuzaklar: vec![], zaman: 0.0, p: p0, arm: Armagan { keskin: f(p[4]), ..Default::default() }, dusmanlar: vec![], mermiler: vec![], kul: 0.0, oldurme: 0, risk: p[3] == "1", kul_seviye: f(p[2]), guc: f(p[1]), alev: p[5] == "1" };
            for e in p[7].split(';') {
                let a: Vec<&str> = e.split(',').collect();
                s.dusmanlar.push(Dusman { tip: a[0].into(), x: f(a[1]), y: f(a[2]), r: f(a[3]), hp: f(a[4]), dogum: 0.0, faz: "bekle".into(), ac: f(a[5]), etki: None, mini: false, kul: f(a[6]), boss: false, kx: 0.0, ky: 0.0, flas: 0.0, yanik: 0.0, olu: false });
            }
            for m in p[8].split(';') {
                let a: Vec<&str> = m.split(',').collect();
                s.mermiler.push(Mermi { x: f(a[0]), y: f(a[1]), vx: f(a[2]), vy: f(a[3]), dusman: f(a[4]) == 1.0, hasar: f(a[5]), r: 0.2, omur: f(a[6]), delme: f(a[7]) as i32, dost: f(a[4]) != 1.0, vuruldu: vec![] });
            }
            for t in p[9].split(';') { let a: Vec<&str> = t.split(',').collect(); s.tuzaklar.push(Tuzak { x: f(a[0]), y: f(a[1]), r: f(a[2]), t: f(a[3]), hasar: f(a[4]) }); }
            let durumlar: Vec<&str> = p[10].split(';').collect();
            for i in 1..=120 {
                s.mermi_tuzak_adim(1.0 / 60.0);
                if i % 20 == 0 {
                    let b: Vec<f64> = durumlar[i / 20 - 1].split(',').map(f).collect();
                    let mut got = vec![s.p.hp, s.p.inv, s.kul, s.oldurme as f64, s.mermiler.len() as f64, s.tuzaklar.len() as f64];
                    for m in &s.mermiler { got.extend([m.x, m.y, m.omur, m.delme as f64]); }
                    for e in &s.dusmanlar { got.extend([e.hp, if e.olu { 1.0 } else { 0.0 }]); }
                    assert_eq!(got.len(), b.len(), "sc {sc} adim {i} uzunluk");
                    for (j, g) in got.iter().enumerate() { yakin(*g, b[j], &format!("sc {sc} adim {i} alan {j}")); }
                }
            }
            say += 1;
        }
        assert_eq!(say, 60);
    }
}
