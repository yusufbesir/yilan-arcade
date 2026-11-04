//! Aşama 2: oda ızgarası üretimi. `src/mantik.js` içindeki `odaUret` ızgara kısmıyla birebir aynı
//! RNG tüketimi ve aynı sonuç (dalga ve ödül üretimi sonraki aşamada).
use crate::Rng;

pub const W: usize = 22;
pub const H: usize = 14;
pub const KAPI_X: [usize; 2] = [6, 15];
pub const SON_DERINLIK: i32 = 12;

pub const ZEMIN: u8 = 0;
pub const DUVAR: u8 = 1;
pub const UCURUM: u8 = 3;
pub const CATLAK: u8 = 4;
pub const SUTUN: u8 = 5;
pub const KAPIK: u8 = 7;
pub const GERI: u8 = 9;
pub const SIVRI: u8 = 10;
pub const LAV: u8 = 11;
const KAPI: u8 = 6;

pub type Izgara = [[u8; W]; H];

pub const SABLON_ADLARI: [&str; 11] = [
    "acik", "izgara", "halka", "koridor", "capraz", "ada", "nehir", "bolmeli", "sivriAlan", "dar", "kose",
];
// JS tarafında 12. şablon (kume) da var; sıra Object.keys ile aynı olmalı.
const TUM: [&str; 12] = [
    "acik", "izgara", "halka", "koridor", "capraz", "ada", "nehir", "bolmeli", "sivriAlan", "dar", "kose", "kume",
];

fn rint(r: &mut Rng, n: f64) -> i32 { (r.next() * n) as i32 }

pub fn biyom_of(d: i32) -> usize { if d <= 0 { 0 } else { ((d - 1) / 4).min(2) as usize } }
pub fn bolum_of(d: i32) -> i32 { if d <= 0 { 0 } else { (d - 1) % 4 } }
pub fn boss_mu(d: i32) -> bool { d > 0 && d % 4 == 0 }

fn bos(x: i32, y: i32) -> bool { (9..=13).contains(&x) && y >= 10 }
fn serbest(x: i32, y: i32) -> bool {
    ((5..=8).contains(&x) && y <= 3) || ((13..=17).contains(&x) && y <= 3) || (x <= 2 && (5..=8).contains(&y)) || bos(x, y)
}
fn koy(g: &mut Izgara, x: i32, y: i32, t: u8) {
    if x < 1 || y < 1 || x > 20 || y > 12 || serbest(x, y) { return; }
    g[y as usize][x as usize] = t;
}

pub fn izgara() -> Izgara {
    let mut g = [[ZEMIN; W]; H];
    for y in 0..H { for x in 0..W { if x == 0 || y == 0 || x == W - 1 || y == H - 1 { g[y][x] = DUVAR; } } }
    g
}

fn sablon(ad: &str, g: &mut Izgara, r: &mut Rng, hz: u8) {
    match ad {
        "acik" => { let n = 3 + rint(r, 4.0); for _ in 0..n { let x = 3 + rint(r, 16.0); let y = 3 + rint(r, 8.0); koy(g, x, y, SUTUN); } }
        "izgara" => { let o = rint(r, 2.0); for x in [4 + o, 8 + o, 13 + o, 17] { for y in [4, 8] { koy(g, x, y, SUTUN); } } }
        "halka" => { for i in 0..12 { if i % 4 == 0 { continue; } let a = i as f64 * std::f64::consts::PI / 6.0; koy(g, (11.0 + a.cos() * 4.5).round() as i32, (6.5 + a.sin() * 3.2).round() as i32, SUTUN); } }
        "koridor" => { let k1 = 3 + rint(r, 12.0); let k2 = 3 + rint(r, 12.0); for x in 2..=19 { if !(x >= k1 && x <= k1 + 1) { koy(g, x, 4, SUTUN); } if !(x >= k2 && x <= k2 + 1) { koy(g, x, 9, SUTUN); } } }
        "capraz" => { for i in 0..8 { koy(g, 4 + i * 2, 3 + i, SUTUN); koy(g, 18 - i * 2, 3 + i, SUTUN); } }
        "ada" => { for y in 4..=9 { for x in 8..=14 { if x == 11 || x == 10 || y == 6 || y == 7 { continue; } koy(g, x, y, hz); } } }
        "nehir" => { let b1 = 2 + rint(r, 3.0); let b2 = 8 + rint(r, 3.0); for y in 1..=12 { if (y >= b1 && y <= b1 + 1) || (y >= b2 && y <= b2 + 1) { continue; } koy(g, 10, y, hz); koy(g, 11, y, hz); } }
        "bolmeli" => { let k = 4 + rint(r, 3.0); for y in 1..=12 { if !(y >= k && y <= k + 3) { koy(g, 11, y, SUTUN); } } }
        "sivriAlan" => { for _ in 0..3 { let cx = 3 + rint(r, 14.0); let cy = 3 + rint(r, 6.0); for y in 0..3 { for x in 0..3 { if (x + y) % 2 == 0 { koy(g, cx + x, cy + y, SIVRI); } } } } }
        "dar" => { let mut y = 3; while y <= 10 { koy(g, 3, y, SUTUN); koy(g, 4, y, SUTUN); koy(g, 18, y, SUTUN); koy(g, 19, y, SUTUN); y += 2; } }
        "kose" => { for (cx, cy) in [(2, 2), (18, 2), (2, 10), (18, 10)] { for y in 0..2 { for x in 0..3 { koy(g, cx + x, cy + y, SUTUN); } } } }
        "kume" => { for _ in 0..3 { let cx = 3 + rint(r, 15.0); let cy = 3 + rint(r, 7.0); koy(g, cx, cy, SUTUN); koy(g, cx + 1, cy, SUTUN); koy(g, cx, cy + 1, SUTUN); koy(g, cx + 1, cy + 1, SUTUN); } }
        _ => unreachable!(),
    }
}

pub fn ulasilir(g: &Izgara) -> bool {
    let gec = |x: usize, y: usize| matches!(g[y][x], ZEMIN | SIVRI | LAV | KAPI | KAPIK | GERI);
    let mut gor = [[false; W]; H];
    let mut q = vec![(11usize, 12usize)];
    gor[12][11] = true;
    while let Some((x, y)) = q.pop() {
        for (dx, dy) in [(1i32, 0i32), (-1, 0), (0, 1), (0, -1)] {
            let nx = x as i32 + dx; let ny = y as i32 + dy;
            if nx < 0 || ny < 0 || nx >= W as i32 || ny >= H as i32 { continue; }
            let (nx, ny) = (nx as usize, ny as usize);
            if gor[ny][nx] || !gec(nx, ny) { continue; }
            gor[ny][nx] = true; q.push((nx, ny));
        }
    }
    KAPI_X.iter().all(|&x| gor[1][x]) && gor[6][1]
}

fn hazard_sec(r: &mut Rng, biyom: usize) -> u8 { match biyom { 0 => UCURUM, 1 => LAV, _ => if r.next() < 0.5 { LAV } else { UCURUM } } }

fn tehlike_ekle(g: &mut Izgara, r: &mut Rng, biyom: usize, bolum: i32) {
    let say = match biyom { 0 => bolum, 1 => 1 + bolum, _ => 2 + bolum };
    let tip = match biyom { 0 => SIVRI, 1 => LAV, _ => if r.next() < 0.5 { SIVRI } else { LAV } };
    for _ in 0..say {
        let cx = 3 + rint(r, 16.0); let cy = 3 + rint(r, 8.0);
        for (dx, dy) in [(0, 0), (1, 0), (0, 1)] {
            let (x, y) = (cx + dx, cy + dy);
            if (y as usize) < H && (x as usize) < W && g[y as usize][x as usize] == ZEMIN { koy(g, x, y, tip); }
        }
    }
}

fn sablon_uret(r: &mut Rng, biyom: usize, bolum: i32, gecmis: &[String]) -> (Izgara, String) {
    for _ in 0..10 {
        let son: Vec<&String> = gecmis.iter().rev().take(3).collect();
        let mut ad: Vec<&str> = TUM.iter().copied().filter(|a| !son.iter().any(|s| s.as_str() == *a)).collect();
        if biyom == 0 { ad.retain(|a| *a != "sivriAlan" || bolum > 0); }
        let liste: &[&str] = if ad.is_empty() { &TUM } else { &ad };
        let adi = liste[(r.next() * liste.len() as f64) as usize];
        let mut g = izgara();
        let hz = hazard_sec(r, biyom);
        sablon(adi, &mut g, r, hz);
        tehlike_ekle(&mut g, r, biyom, bolum);
        if ulasilir(&g) { return (g, adi.to_string()); }
    }
    (izgara(), "acik".to_string())
}

pub struct Oda { pub grid: Izgara, pub sablon: String, pub gizli: bool }

/// `tur`: savas | elit | dinlenme | pazar | baslangic | boss | gizli
pub fn oda_uret(seed: u32, tur: &str, derinlik: i32, gecmis_sablon: &[String]) -> Oda {
    let mut r = Rng::new(seed);
    let bi = biyom_of(derinlik); let bolum = bolum_of(derinlik);
    if tur == "gizli" {
        let mut g = izgara(); g[H - 1][11] = GERI;
        return Oda { grid: g, sablon: String::new(), gizli: false };
    }
    if tur == "boss" {
        let mut g = izgara();
        sablon(["halka", "kose", "dar", "izgara"][bi], &mut g, &mut r, UCURUM);
        if bi >= 1 { for (x, y) in [(3, 3), (18, 3), (3, 10), (18, 10)] { koy(&mut g, x, y, if bi == 1 { LAV } else { SIVRI }); } }
        if derinlik < SON_DERINLIK { for x in KAPI_X { g[0][x] = KAPIK; } }
        return Oda { grid: g, sablon: "boss".into(), gizli: false };
    }
    let (mut g, ad) = if matches!(tur, "dinlenme" | "pazar" | "baslangic") {
        (izgara(), if tur == "baslangic" { "acik".to_string() } else { "duz".to_string() })
    } else { sablon_uret(&mut r, bi, bolum, gecmis_sablon) };
    if tur == "baslangic" { sablon("acik", &mut g, &mut r, 0); }
    let mut gizli = false;
    if tur == "savas" && derinlik >= 2 && r.next() < 0.35 {
        for y in 4..=9 { g[y][15] = UCURUM; g[y][16] = UCURUM; for x in [14, 17, 18, 19] { g[y][x] = ZEMIN; } }
    }
    if (tur == "savas" || tur == "elit") && derinlik >= 1 && (derinlik == 2 || r.next() < 0.25) { g[6][0] = CATLAK; gizli = true; }
    if derinlik < SON_DERINLIK { for x in KAPI_X { g[0][x] = KAPIK; } }
    Oda { grid: g, sablon: ad, gizli }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ser(g: &Izgara) -> String {
        g.iter().map(|r| r.iter().map(|v| format!("{:x}", v)).collect::<String>()).collect::<Vec<_>>().join("/")
    }

    #[test]
    fn js_ile_ayni_izgara() {
        let veri = include_str!("../testdata/odalar.txt");
        let mut say = 0;
        for satir in veri.lines() {
            let p: Vec<&str> = satir.split(' ').collect();
            let seed: u32 = p[0].parse().unwrap();
            let derinlik: i32 = p[2].parse().unwrap();
            let gecmis: Vec<String> = if p[3].is_empty() { vec![] } else { p[3].split(',').map(String::from).collect() };
            let o = oda_uret(seed, p[1], derinlik, &gecmis);
            let ad = if o.sablon.is_empty() { "-" } else { o.sablon.as_str() };
            assert_eq!(ad, p[4], "şablon: {}", satir);
            assert_eq!(o.gizli as u8, p[5].parse::<u8>().unwrap(), "gizli: {}", satir);
            assert_eq!(ser(&o.grid), p[6], "ızgara: {}", satir);
            say += 1;
        }
        assert!(say > 20000);
    }
}
