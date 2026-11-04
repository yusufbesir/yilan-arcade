#!/usr/bin/env python3
"""Denge botu (iskelet): Rust çekirdeğini (yilan-core .so/.dll) ctypes ile çağırır.

Tohumlu Tron karar koşusu ve sonuç özeti. Bağımlılık yok (yalnız standart kütüphane).
Çalıştırma:  python3 -I tools/denge-bot/kosu.py [--kosu 200] [--tohum 1] [--kutuphane YOL] [--hiz 10000]
Önce:        cd core && cargo build --release
"""
import argparse
import ctypes
import os
import random
import sys
import time

COLS, ROWS = 48, 32  # game.js: 960/20, 640/20
DIRS4 = [(1, 0), (-1, 0), (0, 1), (0, -1)]
AD = ["sağ", "sol", "aşağı", "yukarı"]
DEPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def kutuphane_yolu(verilen):
    if verilen:
        return verilen
    ad = {"win32": "yilan_core.dll", "darwin": "libyilan_core.dylib"}.get(sys.platform, "libyilan_core.so")
    return os.path.join(DEPO, "core", "target", "release", ad)


def yukle(yol):
    if not os.path.exists(yol):
        sys.exit(f"Kütüphane yok: {yol}\nÖnce: cd core && cargo build --release")
    lib = ctypes.CDLL(yol)
    i32, u32, f64, sz, p = ctypes.c_int32, ctypes.c_uint32, ctypes.c_double, ctypes.c_size_t, ctypes.c_void_p
    lib.yc_version.restype = u32
    lib.yc_tron_choose.restype = i32
    lib.yc_tron_choose.argtypes = [i32, i32, p, sz, p, sz, i32, i32, i32, i32, i32, f64, f64]
    lib.yc_tron_choose_seeded.restype = i32
    lib.yc_tron_choose_seeded.argtypes = [i32, i32, p, sz, p, sz, i32, i32, i32, i32, i32, u32, u32]
    return lib


def durum_uret(rng):
    """Kendini kesmeyen iki iz üretir (rastgele yürüyüş)."""
    dolu = set()

    def yuru(en_cok):
        while True:
            x, y = rng.randrange(COLS), rng.randrange(ROWS)
            if (x, y) not in dolu:
                break
        hucre = [(x, y)]
        benim = {(x, y)}
        while len(hucre) < en_cok:
            hx, hy = hucre[-1]
            aday = [(hx + dx, hy + dy) for dx, dy in DIRS4
                    if 0 <= hx + dx < COLS and 0 <= hy + dy < ROWS
                    and (hx + dx, hy + dy) not in dolu and (hx + dx, hy + dy) not in benim]
            if not aday:
                break
            c = rng.choice(aday)
            hucre.append(c)
            benim.add(c)
        dolu.update(benim)
        return hucre

    yilan = yuru(1 + rng.randrange(400 if rng.random() < 0.3 else 60))
    ai = yuru(1 + rng.randrange(400 if rng.random() < 0.3 else 60))
    return yilan, ai, rng.choice(DIRS4), rng.choice(DIRS4), rng.randrange(8)


def dizi(hucreler):
    duz = [v for c in hucreler for v in c]
    return (ctypes.c_int32 * len(duz))(*duz)


def karar(lib, durum, tohum):
    yilan, ai, ai_dir, next_dir, galibiyet = durum
    s, a = dizi(yilan), dizi(ai)
    return lib.yc_tron_choose_seeded(COLS, ROWS, s, len(yilan), a, len(ai),
                                     ai_dir[0], ai_dir[1], next_dir[0], next_dir[1],
                                     galibiyet, tohum & 0xFFFFFFFF, (tohum >> 32) & 0xFFFFFFFF)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--kosu", type=int, default=200)
    ap.add_argument("--tohum", type=int, default=1)
    ap.add_argument("--kutuphane", default=None)
    ap.add_argument("--hiz", type=int, default=0, help="N kararlık süre ölçümü (yerel .so)")
    args = ap.parse_args()

    lib = yukle(kutuphane_yolu(args.kutuphane))
    print(f"yilan-core sürüm 0x{lib.yc_version():06x}, ızgara {COLS}x{ROWS}, tohum {args.tohum}")

    def kos():
        rng = random.Random(args.tohum)
        return [karar(lib, durum_uret(rng), args.tohum * 1000003 + i) for i in range(args.kosu)]

    ilk = kos()
    ikinci = kos()
    gecersiz = sum(1 for d in ilk if d < 0)
    sayac = [ilk.count(i) for i in range(4)]
    print(f"{args.kosu} karar; geçersiz (-1): {gecersiz}; tekrarlanabilir: {'EVET' if ilk == ikinci else 'HAYIR'}")
    for i, ad in enumerate(AD):
        print(f"  {ad:7s} {sayac[i]:4d}  %{100 * sayac[i] / max(1, args.kosu):5.1f}")
    if ilk != ikinci or gecersiz:
        sys.exit(1)

    if args.hiz:
        rng = random.Random(args.tohum + 99)
        durumlar = [durum_uret(rng) for _ in range(args.hiz)]
        t0 = time.perf_counter()
        for i, d in enumerate(durumlar):
            karar(lib, d, i)
        ms = (time.perf_counter() - t0) * 1000
        print(f"hız: {args.hiz} karar {ms:.1f} ms ({ms * 1000 / args.hiz:.2f} us/karar, ctypes sarma dahil)")


if __name__ == "__main__":
    main()
