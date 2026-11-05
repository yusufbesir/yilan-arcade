//! Emberwake Godot uzantısı. Oyun mantığı `emberwake-core` (Rust) içinde kalır;
//! burada yalnız Godot'un çağıracağı ince bir köprü vardır.
use emberwake_core::oda::{self, H, W};
use godot::prelude::*;

struct EmberwakeUzanti;

#[gdextension]
unsafe impl ExtensionLibrary for EmberwakeUzanti {}

/// GDScript'ten: `var c = EmberCore.new(); var g = c.oda(seed, "savas", 3)`
#[derive(GodotClass)]
#[class(base = RefCounted, init)]
struct EmberCore {
    base: Base<RefCounted>,
}

#[godot_api]
impl EmberCore {
    #[func]
    fn genislik(&self) -> i64 { W as i64 }

    #[func]
    fn yukseklik(&self) -> i64 { H as i64 }

    /// Oda ızgarasını düz bayt dizisi (satır satır, W*H) olarak döndürür.
    #[func]
    fn oda(&self, seed: i64, tur: GString, derinlik: i64) -> PackedByteArray {
        let o = oda::oda_uret(seed as u32, &tur.to_string(), derinlik as i32, &[], &[]);
        let mut v = Vec::with_capacity(W * H);
        for y in 0..H { for x in 0..W { v.push(o.grid[y][x]); } }
        PackedByteArray::from(v.as_slice())
    }

    /// Dalgalar: her düşman "tip:rol:etki:elit" metni; dalgalar `|` ile ayrılır.
    #[func]
    fn dalgalar(&self, seed: i64, tur: GString, derinlik: i64) -> GString {
        let o = oda::oda_uret(seed as u32, &tur.to_string(), derinlik as i32, &[], &[]);
        let s = o.dalgalar.iter().map(|w| w.iter().map(|e| format!("{}:{}:{}:{}", e.tip, e.rol, e.etki.clone().unwrap_or_default(), e.elit as u8)).collect::<Vec<_>>().join(",")).collect::<Vec<_>>().join("|");
        GString::from(s.as_str())
    }
}
