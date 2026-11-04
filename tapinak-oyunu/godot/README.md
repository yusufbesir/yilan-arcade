# Emberwake Godot önizlemesi

Godot 4.7 + Rust (gdext). Oyun mantığı `../core` (emberwake-core) içinde kalır; `rust/` yalnız ince köprüdür.

## Derleme ve çalıştırma (Windows)
```
cd rust; cargo build            # target\debug\emberwake_godot.dll
mkdir ..\proje\bin; copy target\debug\emberwake_godot.dll ..\proje\bin\
D:\Programlar\Godot\4.7.2\Godot_v4.7.2-stable_win64.exe --path ..\proje
```
Tuşlar: WASD/oklar, R yeni oda, 1 savaş, 2 elit, 3 boss, 4 pazar.
Önizleme: oda ızgarası Rust'tan gelir (JS ile birebir parite), 2.5D eğik çizim; savaş çekirdeği Rust'a taşındıkça eklenir.
