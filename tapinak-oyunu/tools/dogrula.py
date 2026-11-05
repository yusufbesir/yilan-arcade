#!/usr/bin/env python3
"""Veri tablolarını doğrular (Python üst katman). Kullanım: python3 tools/dogrula.py"""
import json, pathlib, sys

d = pathlib.Path(__file__).resolve().parent.parent / "core" / "data"
yuk = lambda a: json.loads((d / f"{a}.json").read_text(encoding="utf-8"))
biyom, dusman, arm, muhur, miras, nadir, sablon = (yuk(a) for a in ["biyomlar", "dusmanlar", "armaganlar", "muhurler", "miras", "nadirlik", "sablonlar"])
hata = []
for b in biyom:
    for rol in ("kucuk", "menzil", "agir", "ozel"):
        for t in b[rol]:
            if t not in dusman: hata.append(f"{b['id']}.{rol}: bilinmeyen düşman {t}")
            elif dusman[t].get("boss"): hata.append(f"{b['id']}.{rol}: boss havuza girmiş {t}")
    if b["boss"] not in dusman or not dusman[b["boss"]].get("boss"): hata.append(f"{b['id']}: boss geçersiz")
    if len(b["bolum"]) != 4: hata.append(f"{b['id']}: 4 bölüm adı olmalı")
for ad, t in dusman.items():
    for k in ("ad", "hp", "hiz", "r", "kul", "temas", "ai"):
        if k not in t: hata.append(f"düşman {ad}: {k} eksik")
for a in arm["sira"]:
    if a not in arm["tablo"]: hata.append(f"armağan sırası: {a} tabloda yok")
if set(arm["sira"]) != set(arm["tablo"]): hata.append("armağan sırası tabloyla uyuşmuyor")
for x, y, _ in arm["eslesme"]:
    if x not in arm["tablo"] or y not in arm["tablo"]: hata.append(f"eşleşme geçersiz: {x}+{y}")
for k, m in miras.items():
    if m["maliyet"] != sorted(m["maliyet"]): hata.append(f"miras {k}: maliyet artmıyor")
if [n["guc"] for n in nadir] != sorted(n["guc"] for n in nadir): hata.append("nadirlik gücü artmıyor")
if len(set(sablon)) != len(sablon): hata.append("şablon adı tekrar")
print("\n".join(hata) if hata else f"tamam: {len(dusman)} düşman, {len(arm['tablo'])} armağan, {len(muhur)} mühür, {len(miras)} miras, {len(sablon)} şablon")
sys.exit(1 if hata else 0)
