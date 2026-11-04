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

pub struct Dusman { pub tip: String, pub rol: String, pub etki: Option<String>, pub elit: bool }

pub struct Oda {
    pub grid: Izgara,
    pub sablon: String,
    pub gizli: bool,
    pub lanet: bool,
    pub dalgalar: Vec<Vec<Dusman>>,
    pub kadro: String,
    pub odul: String,
}

struct Biyom { kucuk: &'static [&'static str], menzil: &'static [&'static str], agir: &'static [&'static str], ozel: &'static [&'static str], boss: &'static str }
const BIYOMLAR: [Biyom; 3] = [
    Biyom { kucuk: &["draugr", "kurt", "kargaci"], menzil: &["seidr"], agir: &["buzdev"], ozel: &["draugr"], boss: "hrolf" },
    Biyom { kucuk: &["kor", "demirkurt", "kurt"], menzil: &["kargaci", "seidr"], agir: &["demirci"], ozel: &["albasti"], boss: "tepegoz" },
    Biyom { kucuk: &["yilan", "draugr", "kor"], menzil: &["golge", "seidr"], agir: &["demirci", "buzdev"], ozel: &["kok", "albasti"], boss: "erlik" },
];
/// Veri paritesi testi için: (küçük, menzil, ağır, özel, boss).
pub fn biyom_havuzu(i: usize) -> (Vec<&'static str>, Vec<&'static str>, Vec<&'static str>, Vec<&'static str>, &'static str) {
    let b = &BIYOMLAR[i];
    (b.kucuk.to_vec(), b.menzil.to_vec(), b.agir.to_vec(), b.ozel.to_vec(), b.boss)
}
const ETKILER: [&str; 4] = ["hizli", "zirh", "bolen", "vampir"];
const KADROLAR: [&str; 5] = ["karisik", "surunu", "nisanci", "agir", "pusu"];

fn rol_liste(bi: &Biyom, rol: &str) -> &'static [&'static str] {
    match rol { "kucuk" => bi.kucuk, "menzil" => bi.menzil, "ozel" => bi.ozel, _ => bi.agir }
}
fn sec_s<'a>(r: &mut Rng, d: &[&'a str]) -> &'a str { d[(r.next() * d.len() as f64) as usize] }

fn dalgalar_uret(r: &mut Rng, tur: &str, d: i32, kadro_gecmis: &[String]) -> (Vec<Vec<Dusman>>, String) {
    let bi = &BIYOMLAR[biyom_of(d)];
    let bolum = bolum_of(d) as f64;
    let son = kadro_gecmis.last();
    let adaylar: Vec<&str> = KADROLAR.iter().copied().filter(|k| Some(&k.to_string()) != son).collect();
    let kadro = sec_s(r, &adaylar);
    let toplam = 3.5 + d as f64 * 0.6 + if tur == "elit" { 2.0 } else { 0.0 };
    let dalga_say = if d >= 5 { 3 } else { 2 };
    // roller(): ağırlıklı havuz
    let mut havuz: Vec<(&str, f64)> = vec![];
    for rol in ["kucuk", "menzil", "ozel", "agir"] {
        let mut w = match rol {
            "kucuk" => 4.0,
            "menzil" => 2.5,
            "ozel" => 1.0 + bolum * 0.6,
            _ => if bolum >= 1.0 || d >= 3 { 1.0 + bolum * 0.5 } else { 0.0 },
        };
        if kadro == "surunu" { w = match rol { "kucuk" => 10.0, "menzil" => 0.5, _ => w * 0.3 }; }
        if kadro == "nisanci" { w = match rol { "menzil" => 8.0, "kucuk" => 2.0, _ => w }; }
        if kadro == "agir" { w = match rol { "agir" => 7.0, "kucuk" => 1.5, _ => w }; }
        if !rol_liste(bi, rol).is_empty() && w > 0.0 { havuz.push((rol, w)); }
    }
    let maliyet = |rol: &str| match rol { "kucuk" => 1.0, "menzil" => 1.4, "ozel" => 1.8, _ => 2.6 };
    let mut dalgalar: Vec<Vec<Dusman>> = vec![];
    for _ in 0..dalga_say {
        let mut dalga = vec![];
        let mut b = toplam / dalga_say as f64;
        let mut koruma = 0;
        while b > 0.0 && koruma < 30 {
            koruma += 1;
            let mut t = havuz.iter().fold(0.0, |a, x| a + x.1) * r.next();
            let mut rol = havuz[0].0;
            for (ad, wt) in &havuz { t -= wt; if t <= 0.0 { rol = ad; break; } }
            let tip = sec_s(r, rol_liste(bi, rol));
            let mut e = Dusman { tip: tip.into(), rol: rol.into(), etki: None, elit: false };
            if tur != "elit" && d >= 6 && bolum >= 1.0 && r.next() < 0.08 { e.etki = Some(sec_s(r, &ETKILER).into()); }
            dalga.push(e); b -= maliyet(rol);
        }
        dalgalar.push(dalga);
    }
    if tur == "elit" {
        let mut ad: Vec<&str> = bi.agir.to_vec(); ad.extend(bi.ozel.iter().copied());
        let t = sec_s(r, &ad); let et = sec_s(r, &ETKILER);
        dalgalar[0].insert(0, Dusman { tip: t.into(), rol: "agir".into(), etki: Some(et.into()), elit: true });
        if d >= 7 {
            let t = sec_s(r, &ad); let et = sec_s(r, &ETKILER);
            dalgalar[1].insert(0, Dusman { tip: t.into(), rol: "agir".into(), etki: Some(et.into()), elit: true });
        }
    }
    (dalgalar, kadro.to_string())
}

/// `tur`: savas | elit | dinlenme | pazar | baslangic | boss | gizli
pub fn oda_uret(seed: u32, tur: &str, derinlik: i32, gecmis_sablon: &[String], gecmis_kadro: &[String]) -> Oda {
    let mut r = Rng::new(seed);
    let bi = biyom_of(derinlik); let bolum = bolum_of(derinlik);
    if tur == "gizli" {
        let mut g = izgara(); g[H - 1][11] = GERI;
        return Oda { grid: g, sablon: String::new(), gizli: false, lanet: false, dalgalar: vec![], kadro: String::new(), odul: String::new() };
    }
    if tur == "boss" {
        let mut g = izgara();
        sablon(["halka", "kose", "dar", "izgara"][bi], &mut g, &mut r, UCURUM);
        if bi >= 1 { for (x, y) in [(3, 3), (18, 3), (3, 10), (18, 10)] { koy(&mut g, x, y, if bi == 1 { LAV } else { SIVRI }); } }
        if derinlik < SON_DERINLIK { for x in KAPI_X { g[0][x] = KAPIK; } }
        let odul = if derinlik >= SON_DERINLIK { "yok" } else { "armagan" };
        let boss = Dusman { tip: BIYOMLAR[bi].boss.into(), rol: "boss".into(), etki: None, elit: false };
        return Oda { grid: g, sablon: "boss".into(), gizli: false, lanet: false, dalgalar: vec![vec![boss]], kadro: String::new(), odul: odul.into() };
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
    let lanet = tur == "savas" && derinlik >= 3 && r.next() < 0.18;
    if derinlik < SON_DERINLIK { for x in KAPI_X { g[0][x] = KAPIK; } }
    let (mut dalgalar, mut kadro, mut odul) = (vec![], String::new(), String::new());
    if tur == "savas" || tur == "elit" {
        let (dl, k) = dalgalar_uret(&mut r, tur, derinlik, gecmis_kadro);
        dalgalar = dl; kadro = k;
        odul = if tur == "elit" { "armagan".into() } else if r.next() < 0.62 { "armagan".into() } else { "kul".into() };
    }
    Oda { grid: g, sablon: ad, gizli, lanet, dalgalar, kadro, odul }
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
            let kg: Vec<String> = if p[8].is_empty() { vec![] } else { p[8].split(',').map(String::from).collect() };
            let o = oda_uret(seed, p[1], derinlik, &gecmis, &kg);
            let ad = if o.sablon.is_empty() { "-" } else { o.sablon.as_str() };
            assert_eq!(ad, p[4], "şablon: {}", satir);
            assert_eq!(o.gizli as u8, p[5].parse::<u8>().unwrap(), "gizli: {}", satir);
            assert_eq!(ser(&o.grid), p[6], "ızgara: {}", satir);
            assert_eq!(o.lanet as u8, p[7].parse::<u8>().unwrap(), "lanet: {}", satir);
            let kd = if o.kadro.is_empty() { "-".to_string() } else { o.kadro.clone() };
            let dl = o.dalgalar.iter().map(|w| w.iter().map(|e| format!("{}:{}:{}:{}", e.tip, e.rol, e.etki.clone().unwrap_or_default(), e.elit as u8)).collect::<Vec<_>>().join(",")).collect::<Vec<_>>().join("|");
            let od = if o.odul.is_empty() { "-" } else { o.odul.as_str() };
            assert_eq!(format!("{} {} {}", kd, od, dl), p[9..].join(" "), "dalga: {}", satir);
            say += 1;
        }
        assert!(say > 20000);
    }
}
