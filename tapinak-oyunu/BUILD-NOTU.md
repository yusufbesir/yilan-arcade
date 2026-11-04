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
- Derleme: kaynak commit a76c526 (dal `claude/project-thread-4r8dz5`), `npm run dist` başarılı.
- Boyut: 121121697 bayt (`Emberwake-Setup-0.2.1.exe`)
- SHA256: `C0C6C0C48B1DE3C3B6631ED2B06F032DD1BB89B83E6AA6D582AA851DC6D05108`
- Eski 0.2.0 exe'leri `D:\Programlar\Emberwake\eski\` altında: `Emberwake-Setup-0.2.0-9545553.exe`, `Emberwake-Setup-0.2.0-eb03016.exe` (eb03016 derlemesi, aynı adlı 0.2.0; SHA256 2FC5F2EA098859CB63DE432877F7662912C8A17B0815430D69ED43833DAF2FF4).
