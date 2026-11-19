"""Tests for the font coverage check (W26): `python _src/test_check_fonts.py`.

Three methods catch the dotless-j defect (the jeby.us wordmark fell back to Segoe UI Black because the Latin subset lacked U+0237):
  1. cmap lookup: the check flags a font set without the extension slice and passes the shipped one (no browser);
  2. a fixture page whose text holds a character outside the subset fails the whole check, a clean one passes (headless browser);
  3. DevTools CSS.getPlatformFontsForNode on `.wordmark .j` of the built jeby.us home page names the custom font (browser and a build).
Edge cases: a character covered only by a second unicode-range slice; text in an element with a different font family; a stale upstream-gaps entry.
Tests that need a browser or a build are skipped, and say so, when there is none. Temporary folders and one temporary browser profile, removed after."""
import json, os, pathlib, shutil, sys, tempfile, unittest

SRC = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(SRC))
import check_fonts as CF
import fontcopy
from check_text import Browser, CANDIDATES, serve, stop_profile

try:
    import fontTools  # noqa: F401
    HAVE_FT = True
except ImportError:
    HAVE_FT = False
EXE = next((p for p in CANDIDATES if p and os.path.exists(p)), None)
FONTS = SRC / "fonts"


def site(tmp, css_name="jeby-fonts.css", drop_ext=False, body=""):
    """A throw-away built site: pages, assets/fonts.css and only the font files that CSS names."""
    tmp = pathlib.Path(tmp); (tmp / "assets").mkdir(parents=True, exist_ok=True)
    css = (FONTS / css_name).read_text(encoding="utf-8")
    if drop_ext:   # the old state: no extension slice
        css = fontcopy.FACE.sub(lambda m: "" if "instrument-sans-ext" in m.group(0) else m.group(0), css)
    (tmp / "assets" / "fonts.css").write_text(css, encoding="utf-8")
    (tmp / "assets" / "fonts").mkdir(exist_ok=True)
    for f in {x["file"] for x in fontcopy.parse_faces(css)}: shutil.copy(FONTS / f, tmp / "assets" / "fonts" / f)
    if body:
        (tmp / "index.html").write_text('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="assets/fonts.css">'
            '<style>body{font:400 20px "Instrument Sans",sans-serif}h1{font:700 30px "Fraunces",serif}</style>' + body, encoding="utf-8")
    return tmp


@unittest.skipUnless(HAVE_FT, "fontTools not installed")
class Cmap(unittest.TestCase):
    """Method 1: cmap lookup, no browser."""
    def test_old_file_is_flagged(self):
        """Protects: a font set without the U+0237 slice is reported (the original defect)."""
        with tempfile.TemporaryDirectory() as t:
            faces = CF.load_faces(site(t, drop_ext=True))
            g = CF.gaps([('"Instrument Sans", sans-serif', "normal", 800, "eby\u0237")], faces)
            self.assertEqual([x[3] for x in g], ["\u0237"])

    def test_shipped_files_cover_the_wordmark(self):
        """Protects: the shipped slice covers the dotless j at the wordmark's weight (800 clamps to the 400-700 face)."""
        with tempfile.TemporaryDirectory() as t:
            faces = CF.load_faces(site(t))
            for w in (400, 700, 800): self.assertEqual(CF.gaps([('"Instrument Sans", sans-serif', "normal", w, "\u0237")], faces), [])

    def test_second_slice_only(self):
        """Edge: U+0237 is in no cmap of the Latin file and not in its unicode-range; only the second slice covers it, and that counts."""
        with tempfile.TemporaryDirectory() as t:
            faces = CF.load_faces(site(t)); base = [f for f in faces if f["file"] == "instrument-sans.woff2"][0]; ext = [f for f in faces if f["file"] == "instrument-sans-ext.woff2"][0]
            self.assertNotIn(0x237, base["cover"]); self.assertIn(0x237, ext["cover"]); self.assertEqual(ext["cover"], {0x237})
            self.assertEqual(CF.gaps([('"Instrument Sans"', "normal", 500, "\u0237")], faces), [])

    def test_other_family_in_other_element(self):
        """Edge: the same character in a Fraunces heading is judged by Fraunces' files, not Instrument Sans'."""
        with tempfile.TemporaryDirectory() as t:
            faces = CF.load_faces(site(t))
            g = CF.gaps([('Fraunces, "Iowan Old Style", serif', "normal", 400, "\u0237"), ('"Instrument Sans", sans-serif', "normal", 400, "\u0237")], faces)
            self.assertEqual([(x[0], x[3]) for x in g], [("Fraunces", "\u0237")])

    def test_system_font_stack_is_not_ours(self):
        """Edge: a stack that starts with a system font is not checked."""
        with tempfile.TemporaryDirectory() as t:
            self.assertEqual(CF.gaps([("ui-monospace, monospace", "normal", 400, "\u0237")], CF.load_faces(site(t))), [])

    def test_upstream_gap_and_stale_entry(self):
        """Edge: a char the upstream family lacks is a fallback by design; one listed but covered is a stale entry."""
        with tempfile.TemporaryDirectory() as t:
            faces = CF.load_faces(site(t)); up = {"Instrument Sans": {0x2192, 0x41}}
            g = CF.gaps([('"Instrument Sans"', "normal", 400, "\u2192A")], faces, up)
            self.assertEqual(len(g), 1); self.assertIn("stale", g[0][3])

    def test_shipped_upstream_list_matches_the_files(self):
        """Protects: every entry of fonts/upstream-gaps.json is really absent from the served files."""
        with tempfile.TemporaryDirectory() as t:
            for css in ("jeby-fonts.css", "jai-fonts.css"):
                faces = CF.load_faces(site(t, css)); up = CF.load_upstream_gaps()
                for fam, cps in up.items():
                    for f in (x for x in faces if x["family"] == fam): self.assertFalse(cps & f["cover"], (fam, f["file"]))


@unittest.skipUnless(HAVE_FT and EXE, "fontTools or a browser is missing")
class Pages(unittest.TestCase):
    """Method 2: fixture pages through the whole check, in a headless browser."""
    def run_check(self, body, **kw):
        with tempfile.TemporaryDirectory() as t:
            root = site(t, body=body, **kw); out = CF.run([("fixture", root)])
            return out

    def test_char_outside_the_subset_fails(self):
        """Protects: a page with a Cyrillic letter in Instrument Sans fails the check (exit 1)."""
        code, pages, bad = self.run_check("<p>eby \u0416</p>"); self.assertEqual((code, pages), (1, 1)); self.assertGreaterEqual(bad, 1)

    def test_clean_page_passes(self):
        """Protects: Latin text plus the wordmark's dotless j passes."""
        code, pages, bad = self.run_check("<p>Hello <b>\u0237eby</b> caf\u00e9</p>"); self.assertEqual((code, bad), (0, 0))

    def test_old_files_fail_the_page(self):
        """Protects: the same wordmark markup fails when the extension slice is missing."""
        code, pages, bad = self.run_check('<p style="font-weight:800">\u0237eby</p>', drop_ext=True); self.assertEqual((code, bad), (1, 1))

    def test_different_family_element(self):
        """Edge: a dotless j in a Fraunces heading fails while the one in the Instrument Sans paragraph does not."""
        code, pages, bad = self.run_check("<h1>\u0237</h1><p>\u0237</p>"); self.assertEqual((code, bad), (1, 1))

    def test_text_transform_and_pseudo_content(self):
        """Edge: text-transform and ::before content are measured (\u00df uppercases to SS, a Cyrillic ::before is flagged)."""
        code, pages, bad = self.run_check('<style>p::before{content:"\\0416"}</style><p style="text-transform:uppercase">\u00df</p>'); self.assertEqual((code, bad), (1, 1))


@unittest.skipUnless(EXE and (SRC / "jeby" / "out" / "index.html").exists(), "no browser or no build (python _src/build.py)")
class Cdp(unittest.TestCase):
    """Method 3: the browser's own report of the platform font used for the wordmark's j."""
    def test_wordmark_j_uses_the_custom_font(self):
        """Protects: `.wordmark .j` renders in Instrument Sans (a custom font), not a system font, on the built home page."""
        profile = pathlib.Path(tempfile.mkdtemp(prefix="test-fonts-")); br = None; srv = serve(SRC / "jeby" / "out")
        try:
            br = Browser(EXE, profile); br.call("Page.enable"); br.call("DOM.enable"); br.call("CSS.enable")
            br.call("Page.navigate", url=f"http://127.0.0.1:{srv.server_address[1]}/index.html")
            import time
            for _ in range(100):
                if br.js("document.readyState === 'complete'"): break
                time.sleep(0.1)
            br.js("document.fonts.ready.then(() => true)"); time.sleep(0.3)
            root = br.call("DOM.getDocument")["root"]["nodeId"]
            nid = br.call("DOM.querySelector", nodeId=root, selector=".wordmark .j")["nodeId"]
            fonts = br.call("CSS.getPlatformFontsForNode", nodeId=nid)["fonts"]
            self.assertTrue(fonts, "no platform font reported")
            for f in fonts:
                self.assertEqual(f["familyName"], "Instrument Sans", fonts); self.assertTrue(f["isCustomFont"], fonts)
            print("    CDP .wordmark .j fonts:", [(f["familyName"], f["isCustomFont"]) for f in fonts])
        finally:
            srv.shutdown()
            if br: br.close()
            if br and br.proc.poll() is None: br.proc.kill()
            stop_profile(profile); shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
