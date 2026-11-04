#!/usr/bin/env python3
"""Bir klasördeki jpg/png dosyalarını küçültür (en uzun kenar 512 px).

Kullanım: python3 -I tools/varlik/kucult.py KAYNAK_DIZIN HEDEF_DIZIN [--boyut 512]

Pillow gerekir (yoksa açık hata verip çıkar). Kaynak dosyalar silinmez ya da
değiştirilmez; sonuçlar HEDEF_DIZIN'e aynı adla yazılır. Hedef kaynakla aynı
olamaz; hedefte var olan dosyanın üzerine yazılmaz.
"""
import argparse
import sys
from pathlib import Path

UZANTILAR = {".jpg", ".jpeg", ".png"}


def main(argv=None):
    ap = argparse.ArgumentParser(description="jpg/png küçültücü")
    ap.add_argument("kaynak", type=Path)
    ap.add_argument("hedef", type=Path)
    ap.add_argument("--boyut", type=int, default=512, help="en uzun kenar (px), varsayılan 512")
    a = ap.parse_args(argv)
    try:
        from PIL import Image
    except ImportError:
        print("Hata: Pillow kurulu değil. Kurmak için: python3 -m pip install Pillow", file=sys.stderr)
        return 3
    if not a.kaynak.is_dir():
        print(f"Hata: kaynak klasör yok: {a.kaynak}", file=sys.stderr)
        return 2
    if a.kaynak.resolve() == a.hedef.resolve():
        print("Hata: hedef klasör kaynakla aynı olamaz.", file=sys.stderr)
        return 2
    a.hedef.mkdir(parents=True, exist_ok=True)
    n = 0
    for f in sorted(a.kaynak.iterdir()):
        if not f.is_file() or f.suffix.lower() not in UZANTILAR:
            continue
        cikis = a.hedef / f.name
        if cikis.exists():
            print(f"Atlandı (hedefte var): {cikis}")
            continue
        with Image.open(f) as im:
            im.thumbnail((a.boyut, a.boyut))
            if f.suffix.lower() in (".jpg", ".jpeg"):
                im.convert("RGB").save(cikis, "JPEG", quality=85, optimize=True)
            else:
                im.save(cikis, "PNG", optimize=True)
        print(f"{f.name} -> {cikis}")
        n += 1
    print(f"{n} dosya küçültüldü.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
