//! Aşama 4b: oyuncu saldırıları (savur, köz atışı) ve düşman hasarı. `src/mantik.js` savur/kozAt/dusmanHasar/oldur ile aynı sayılar.
use crate::oyuncu::{Armagan, Oyuncu};

#[derive(Clone, Debug)]
pub struct Dusman {
    pub tip: String, pub x: f64, pub y: f64, pub r: f64, pub hp: f64, pub dogum: f64, pub faz: String, pub ac: f64,
    pub etki: Option<String>, pub mini: bool, pub kul: f64, pub boss: bool,
    pub kx: f64, pub ky: f64, pub flas: f64, pub yanik: f64, pub olu: bool,
}

#[derive(Clone, Debug)]
pub struct Mermi { pub x: f64, pub y: f64, pub vx: f64, pub vy: f64, pub hasar: f64, pub r: f64, pub omur: f64, pub delme: i32, pub dost: bool }

pub struct Savas {
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
        self.mermiler.push(Mermi { x: self.p.x, y: self.p.y, vx: aci.cos() * 11.0, vy: aci.sin() * 11.0, hasar: h, r: 0.2, omur: 1.4, delme: if self.arm.kivilcim != 0.0 { 2 } else { 0 }, dost: true });
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
            let mut s = Savas { p: p0, arm: Armagan { bilek, keskin, kivilcim, ..Default::default() }, dusmanlar: vec![], mermiler: vec![], kul: 0.0, oldurme: 0, risk, kul_seviye: kul_s, guc, alev };
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
}
