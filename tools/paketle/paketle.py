#!/usr/bin/env python3
"""Yılan Arcade paketleme yardımcısı (yalnız standart kütüphane).

Kullanım:
  python3 -I tools/paketle/paketle.py --kontrol [--kok DIZIN] [--img-sinir-mb 30]
  python3 -I tools/paketle/paketle.py --ozet <exe yolu> [--kok DIZIN]

Hiçbir dosyayı değiştirmez; yalnız okur ve stdout'a yazar.
"""
import argparse
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

SATIR_ICI = re.compile(r"""\son[a-z]{3,}\s*=\s*["']""", re.I)
UZANTILAR = {".html", ".htm", ".js"}


def varsayilan_kok():
    return Path(__file__).resolve().parents[2]


def surum_oku(kok):
    p = kok / "package.json"
    if not p.is_file():
        return None, "package.json yok"
    try:
        s = json.loads(p.read_text(encoding="utf-8")).get("version")
    except (ValueError, OSError) as e:
        return None, f"package.json okunamadı: {e}"
    if not isinstance(s, str) or not re.fullmatch(r"\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?", s):
        return None, f"geçersiz sürüm: {s!r}"
    return s, None


def satir_ici_say(kok):
    """src/ altında on*= satır içi işleyici sayısı ve örnek konumlar."""
    sayi, ornek = 0, []
    src = kok / "src"
    if not src.is_dir():
        return 0, ornek
    for f in sorted(src.rglob("*")):
        if f.suffix.lower() not in UZANTILAR or not f.is_file():
            continue
        try:
            metin = f.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for no, satir in enumerate(metin.splitlines(), 1):
            n = len(SATIR_ICI.findall(satir))
            if n:
                sayi += n
                if len(ornek) < 5:
                    ornek.append(f"{f.relative_to(kok).as_posix()}:{no}")
    return sayi, ornek


def img_toplam(kok):
    img = kok / "src" / "img"
    if not img.is_dir():
        return 0
    return sum(f.stat().st_size for f in img.rglob("*") if f.is_file())


def kaynaksiz_doku(kok):
    tex = kok / "src" / "img" / "tex"
    if not tex.is_dir():
        return []
    cr = kok / "CREDITS.md"
    metin = cr.read_text(encoding="utf-8", errors="replace") if cr.is_file() else ""
    return [d.name for d in sorted(tex.iterdir())
            if d.is_dir() and not re.search(r"(?<![0-9A-Za-z])" + re.escape(d.name) + r"(?![0-9A-Za-z])", metin)]


def sifir_bayt(kok):
    out = []
    for alt in ("src", "build"):
        d = kok / alt
        if d.is_dir():
            out += [f.relative_to(kok).as_posix() for f in sorted(d.rglob("*"))
                    if f.is_file() and f.stat().st_size == 0]
    return out


def kontrol(kok, img_sinir_mb=30.0, yaz=print):
    """Denetimleri çalıştırır; başarısız denetim sayısını döner."""
    hata = 0

    def sonuc(ok, ad, ayrinti=""):
        nonlocal hata
        if not ok:
            hata += 1
        yaz(f"[{'TAMAM' if ok else 'HATA '}] {ad}" + (f": {ayrinti}" if ayrinti else ""))

    s, e = surum_oku(kok)
    sonuc(s is not None, "package.json sürümü", s if s else e)

    sonuc((kok / "BUILD-NOTU.md").is_file(), "BUILD-NOTU.md var")
    sonuc((kok / "CHANGELOG.md").is_file() or (kok / "README.md").is_file(),
          "CHANGELOG.md (ya da README.md sürüm geçmişi) var")

    n, ornek = satir_ici_say(kok)
    sonuc(n == 0, "satır içi on*= işleyici sayısı 0", f"{n}" + (f" ({', '.join(ornek)})" if n else ""))

    toplam = img_toplam(kok)
    mb = toplam / (1024 * 1024)
    sonuc(mb <= img_sinir_mb, "src/img toplam boyutu", f"{toplam} bayt ({mb:.2f} MB, sınır {img_sinir_mb:g} MB)")

    eksik = kaynaksiz_doku(kok)
    sonuc(not eksik, "CREDITS.md'de her src/img/tex/<ID> için kaynak satırı var",
          ", ".join(eksik) if eksik else "")

    sifir = sifir_bayt(kok)
    sonuc(not sifir, "sıfır baytlık dosya yok", ", ".join(sifir[:10]) if sifir else "")

    yaz("SONUÇ: " + ("hazır" if hata == 0 else f"{hata} denetim başarısız"))
    return hata


def sha256_ve_boyut(yol):
    h, boyut = hashlib.sha256(), 0
    with open(yol, "rb") as f:
        for blok in iter(lambda: f.read(1 << 20), b""):
            h.update(blok)
            boyut += len(blok)
    return boyut, h.hexdigest().upper()


def ozet(kok, exe, yaz=print):
    exe = Path(exe)
    if not exe.is_file():
        raise FileNotFoundError(str(exe))
    boyut, sha = sha256_ve_boyut(exe)
    s, _ = surum_oku(kok)
    s = s or "?"
    mb = boyut / (1024 * 1024)
    yaz(f"## Yılan Arcade {s} — Yerel Paketleme Notu (TASLAK)")
    yaz("")
    yaz(f"- Tarih: {date.today().isoformat()}")
    yaz(f"- Çıktı: `{exe.name}`")
    yaz(f"- Boyut: {boyut:,} bayt (yaklaşık {mb:.1f} MB)".replace(",", "."))
    yaz(f"- SHA256: `{sha}`")
    yaz("- Konum (yerel): `<doldurulacak>` (exe depoya girmedi)")
    yaz("- Komutlar: `<doldurulacak>`")
    yaz("")
    yaz("Not: bu çıktı taslaktır; BUILD-NOTU.md otomatik değiştirilmedi.")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Yılan Arcade paketleme yardımcısı")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--kontrol", action="store_true", help="paketleme öncesi denetimler")
    g.add_argument("--ozet", metavar="EXE", help="exe için boyut, SHA256 ve BUILD-NOTU taslağı")
    ap.add_argument("--kok", type=Path, default=None, help="depo kökü (varsayılan: bu betiğin deposu)")
    ap.add_argument("--img-sinir-mb", type=float, default=30.0, help="src/img toplam sınırı (MB)")
    a = ap.parse_args(argv)
    kok = (a.kok or varsayilan_kok()).resolve()
    if a.kontrol:
        return 0 if kontrol(kok, a.img_sinir_mb) == 0 else 1
    try:
        ozet(kok, a.ozet)
    except FileNotFoundError as e:
        print(f"Hata: dosya bulunamadı: {e}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
