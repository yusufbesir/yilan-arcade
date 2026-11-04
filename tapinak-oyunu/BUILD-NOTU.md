---
description: Emberwake 0.2.1 Windows kurulum exe derleme notu
sahip: Claude (PC derleme oturumu), [İP:TEZDENEME]
---
# Emberwake 0.2.0 derleme notu (2026-11-04)

- Dosya: `D:\Programlar\Emberwake\Emberwake-Setup-0.2.0.exe` (NSIS, imzasız, varsayılan Electron simgesi)
- Boyut: 121118254 bayt
- SHA256: `30BC571B9D3D3711C6FBD9458436C46593A210FC714F1E3C4CBBCDA6F8134409`
- Kaynak: dal `claude/project-thread-4r8dz5`, commit 9545553
- Araçlar: Node v24.21.0, npm 11.19.0, Electron 45.2.2, electron-builder 26.18.0
- `node test/mantik.test.js`: 23 test geçti
- `win-unpacked\Emberwake.exe`: açıldı, menü düğmeleri (Koşuya Başla, Miras Sunağı, Nasıl Oynanır, Ses, Çıkış) ve canvas var; konsol/CSP hatası yok
- `cargo test`: çalıştırılamadı, bu PC'de rustc/cargo kurulu değil

## 0.2.1 (2026-11-04, özellik paketi)

- Sürüm 0.2.0 → 0.2.1 (aynı adlı iki exe karışmasın diye). Hedef: `D:\Programlar\Emberwake\Emberwake-Setup-0.2.1.exe`; eski 0.2.0 exe'leri `D:\Programlar\Emberwake\eski\` altında, silinmez.
- Yeni: Köz Sınavı, Köz Ocağı, Risk kapısı, Karşılık, Boss Provası, Sisli Oda Mührü, Armağan satışı, ölüm raporu, diyara özel şablon, biyoma özgü engel görünümü. Hepsi menüde "Özellikler"den kapatılır.
- `node test/mantik.test.js`: 33 test geçti.
