//! Aşama 3: veri tabloları (`core/data/*.json`). Yeni içerik veri satırı olarak eklenir.
use serde::Deserialize;
use std::collections::BTreeMap;

#[derive(Debug, Deserialize, Clone)]
pub struct Biyom {
    pub id: String, pub ad: String, pub alt: String, pub bolum: Vec<String>, pub boss: String,
    pub kucuk: Vec<String>, pub menzil: Vec<String>, pub agir: Vec<String>, pub ozel: Vec<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Dusman {
    pub ad: String, pub hp: f64, pub hiz: f64, pub r: f64, pub kul: f64, pub temas: f64, pub ai: String,
    #[serde(default)] pub boss: bool, #[serde(default)] pub ucar: bool,
    #[serde(default)] pub atilim: Option<f64>, #[serde(default)] pub uluma: bool,
    #[serde(default)] pub saldiri: Vec<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Armagan { pub ad: String, pub acik: String, pub renk: String, pub ic: String }

#[derive(Debug, Deserialize)]
pub struct Armaganlar { pub sira: Vec<String>, pub tablo: BTreeMap<String, Armagan>, pub eslesme: Vec<(String, String, String)> }

#[derive(Debug, Deserialize, Clone)]
pub struct Miras { pub ad: String, pub acik: String, pub maks: u32, pub maliyet: Vec<u32> }

#[derive(Debug, Deserialize, Clone)]
pub struct Nadirlik { pub ad: String, pub guc: f64, pub renk: String }

pub struct Veri {
    pub biyomlar: Vec<Biyom>,
    pub dusmanlar: BTreeMap<String, Dusman>,
    pub armaganlar: Armaganlar,
    pub miras: BTreeMap<String, Miras>,
    pub nadirlik: Vec<Nadirlik>,
    pub sablonlar: Vec<String>,
}

impl Veri {
    pub fn yukle() -> Result<Veri, String> {
        fn p<T: for<'a> Deserialize<'a>>(ad: &str, s: &str) -> Result<T, String> { serde_json::from_str(s).map_err(|e| format!("{ad}: {e}")) }
        let v = Veri {
            biyomlar: p("biyomlar", include_str!("../data/biyomlar.json"))?,
            dusmanlar: p("dusmanlar", include_str!("../data/dusmanlar.json"))?,
            armaganlar: p("armaganlar", include_str!("../data/armaganlar.json"))?,
            miras: p("miras", include_str!("../data/miras.json"))?,
            nadirlik: p("nadirlik", include_str!("../data/nadirlik.json"))?,
            sablonlar: p("sablonlar", include_str!("../data/sablonlar.json"))?,
        };
        v.dogrula()?;
        Ok(v)
    }

    /// Çapraz doğrulama (Python `tools/dogrula.py` ile aynı kurallar).
    pub fn dogrula(&self) -> Result<(), String> {
        for b in &self.biyomlar {
            if b.bolum.len() != 4 { return Err(format!("{}: 4 bölüm adı olmalı", b.id)); }
            match self.dusmanlar.get(&b.boss) { Some(d) if d.boss => {} _ => return Err(format!("{}: boss geçersiz", b.id)) }
            for t in b.kucuk.iter().chain(&b.menzil).chain(&b.agir).chain(&b.ozel) {
                match self.dusmanlar.get(t) { Some(d) if !d.boss => {} _ => return Err(format!("{}: geçersiz düşman {}", b.id, t)) }
            }
        }
        for a in &self.armaganlar.sira { if !self.armaganlar.tablo.contains_key(a) { return Err(format!("armağan yok: {a}")); } }
        for (x, y, _) in &self.armaganlar.eslesme { if !self.armaganlar.tablo.contains_key(x) || !self.armaganlar.tablo.contains_key(y) { return Err(format!("eşleşme geçersiz {x}+{y}")); } }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn veri_yuklenir_ve_dogrulanir() {
        let v = Veri::yukle().unwrap();
        assert_eq!(v.biyomlar.len(), 3);
        assert_eq!(v.dusmanlar.len(), 15);
        assert_eq!(v.armaganlar.tablo.len(), 10);
        assert_eq!(v.sablonlar.len(), 12);
    }

    #[test]
    fn oda_kodundaki_biyom_listeleri_veriyle_ayni() {
        let v = Veri::yukle().unwrap();
        for (i, b) in v.biyomlar.iter().enumerate() {
            let k = crate::oda::biyom_havuzu(i);
            assert_eq!(k.0, b.kucuk.iter().map(String::as_str).collect::<Vec<_>>());
            assert_eq!(k.1, b.menzil.iter().map(String::as_str).collect::<Vec<_>>());
            assert_eq!(k.2, b.agir.iter().map(String::as_str).collect::<Vec<_>>());
            assert_eq!(k.3, b.ozel.iter().map(String::as_str).collect::<Vec<_>>());
            assert_eq!(k.4, b.boss);
        }
    }
}
