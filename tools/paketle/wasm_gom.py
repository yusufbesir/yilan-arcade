#!/usr/bin/env python3
"""Rust wasm çıktısını src/core/yilan_core.wasm.js içine base64 gömer.

Neden: Electron/Chromium'da file:// üzerinden wasm dosyası çekmek (XHR/fetch) güvenilmez; betik etiketiyle
yüklenen gömülü sürüm her yerde çalışır ve ek ağ/CSP izni gerektirmez.

Kullanım:
  python3 -I tools/paketle/wasm_gom.py            # core/target/... wasm'ını göm (önce cargo build)
  python3 -I tools/paketle/wasm_gom.py --kontrol  # gömülü sürüm güncel mi (çıkış 1: değil)
"""
import base64, os, sys

KOK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
WASM = os.path.join(KOK, 'core', 'target', 'wasm32-unknown-unknown', 'release', 'yilan_core.wasm')
HEDEF = os.path.join(KOK, 'src', 'core', 'yilan_core.wasm.js')

def uret(ham: bytes) -> str:
    b64 = base64.b64encode(ham).decode('ascii')
    return ("'use strict';\n// OTOMATİK ÜRETİLDİ: tools/paketle/wasm_gom.py (core/ Rust çekirdeği). Elle düzenlemeyin.\n"
            "(function (kok, b64) {\n"
            "    if (typeof module === 'object' && module.exports) { module.exports = b64; return; }\n"
            "    kok.YilanCore = kok.YilanCore || {}; kok.YilanCore.wasmB64 = b64;\n"
            "})(typeof self !== 'undefined' ? self : this, '" + b64 + "');\n")

def main(argv):
    if not os.path.exists(WASM):
        print('wasm yok, önce: cd core && cargo build --release --target wasm32-unknown-unknown', file=sys.stderr)
        return 2
    beklenen = uret(open(WASM, 'rb').read())
    if '--kontrol' in argv:
        mevcut = open(HEDEF, encoding='utf-8').read() if os.path.exists(HEDEF) else ''
        print('güncel' if mevcut == beklenen else 'ESKİ: wasm_gom.py çalıştırın')
        return 0 if mevcut == beklenen else 1
    open(HEDEF, 'w', encoding='utf-8', newline='\n').write(beklenen)
    print('yazıldı:', HEDEF, len(beklenen), 'bayt')
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
