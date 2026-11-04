import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "paketle"))
import paketle  # noqa: E402


def sahte_repo(kok):
    (kok / "src" / "img" / "tex" / "Rock064").mkdir(parents=True)
    (kok / "package.json").write_text(json.dumps({"version": "1.2.3"}))
    (kok / "BUILD-NOTU.md").write_text("# not\n")
    (kok / "CHANGELOG.md").write_text("# c\n")
    (kok / "CREDITS.md").write_text("| Rock064 doku | ambientCG | CC0 |\n")
    (kok / "src" / "index.html").write_text("<button id=a>x</button>")
    (kok / "src" / "img" / "tex" / "Rock064" / "c.jpg").write_bytes(b"x" * 100)


def calistir(kok, **kw):
    cikti = []
    hata = paketle.kontrol(kok, yaz=cikti.append, **kw)
    return hata, "\n".join(cikti)


class PaketleTest(unittest.TestCase):
    def setUp(self):
        self._t = tempfile.TemporaryDirectory()
        self.kok = Path(self._t.name)
        sahte_repo(self.kok)

    def tearDown(self):
        self._t.cleanup()

    def test_temiz_repo_gecer(self):
        hata, cikti = calistir(self.kok)
        self.assertEqual(hata, 0, cikti)
        self.assertIn("SONUÇ: hazır", cikti)
        self.assertIn("1.2.3", cikti)

    def test_package_json_yok(self):
        (self.kok / "package.json").unlink()
        hata, cikti = calistir(self.kok)
        self.assertEqual(hata, 1)
        self.assertIn("package.json yok", cikti)

    def test_gecersiz_surum(self):
        (self.kok / "package.json").write_text(json.dumps({"version": "abc"}))
        hata, _ = calistir(self.kok)
        self.assertEqual(hata, 1)

    def test_build_notu_yok(self):
        (self.kok / "BUILD-NOTU.md").unlink()
        hata, cikti = calistir(self.kok)
        self.assertEqual(hata, 1)
        self.assertIn("[HATA ] BUILD-NOTU.md", cikti)

    def test_changelog_ve_readme_yok(self):
        (self.kok / "CHANGELOG.md").unlink()
        hata, _ = calistir(self.kok)
        self.assertEqual(hata, 1)

    def test_changelog_yerine_readme_kabul(self):
        (self.kok / "CHANGELOG.md").unlink()
        (self.kok / "README.md").write_text("# r\n")
        hata, _ = calistir(self.kok)
        self.assertEqual(hata, 0)

    def test_satir_ici_isleyici_sayilir(self):
        (self.kok / "src" / "index.html").write_text(
            '<button onclick="x()">a</button>\n<div onmouseover=\'y()\'></div>')
        n, ornek = paketle.satir_ici_say(self.kok)
        self.assertEqual(n, 2)
        self.assertTrue(ornek[0].startswith("src/index.html:1"))
        hata, _ = calistir(self.kok)
        self.assertEqual(hata, 1)

    def test_js_atamasi_satir_ici_sayilmaz(self):
        (self.kok / "src" / "game.js").write_text("btn.onclick = () => 1;\nwindow.onload=f;\n")
        self.assertEqual(paketle.satir_ici_say(self.kok)[0], 0)

    def test_img_boyut_siniri(self):
        (self.kok / "src" / "img" / "buyuk.png").write_bytes(b"x" * (2 * 1024 * 1024))
        hata, cikti = calistir(self.kok, img_sinir_mb=1)
        self.assertEqual(hata, 1)
        self.assertIn("src/img toplam boyutu", cikti)

    def test_credits_kaynak_eksik(self):
        (self.kok / "src" / "img" / "tex" / "Lava004").mkdir()
        (self.kok / "src" / "img" / "tex" / "Lava004" / "c.jpg").write_bytes(b"x")
        self.assertEqual(paketle.kaynaksiz_doku(self.kok), ["Lava004"])
        hata, _ = calistir(self.kok)
        self.assertEqual(hata, 1)

    def test_credits_kismi_ad_eslesmez(self):
        (self.kok / "CREDITS.md").write_text("Rock0641 baska\n")
        self.assertEqual(paketle.kaynaksiz_doku(self.kok), ["Rock064"])

    def test_sifir_bayt_dosya(self):
        (self.kok / "src" / "bos.js").write_bytes(b"")
        hata, cikti = calistir(self.kok)
        self.assertEqual(hata, 1)
        self.assertIn("src/bos.js", cikti)

    def test_ozet_sha_ve_boyut(self):
        exe = self.kok / "k.exe"
        exe.write_bytes(b"abc")
        cikti = []
        paketle.ozet(self.kok, exe, yaz=cikti.append)
        metin = "\n".join(cikti)
        self.assertIn("3 bayt", metin)
        self.assertIn("BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD", metin)
        self.assertIn("1.2.3", metin)
        self.assertEqual((self.kok / "BUILD-NOTU.md").read_text(), "# not\n")

    def test_ozet_dosya_yok(self):
        with self.assertRaises(FileNotFoundError):
            paketle.ozet(self.kok, self.kok / "yok.exe", yaz=lambda s: None)

    def test_main_cikis_kodlari(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(paketle.main(["--kontrol", "--kok", str(self.kok)]), 0)
            (self.kok / "BUILD-NOTU.md").unlink()
            self.assertEqual(paketle.main(["--kontrol", "--kok", str(self.kok)]), 1)


if __name__ == "__main__":
    unittest.main()
