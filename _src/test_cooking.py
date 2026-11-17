"""Unit tests for the recipe loader and renderer in _src/jeby/cooking.py (JEBYUS-0083). Plain unittest, temporary folders only.

    python _src/test_cooking.py

Docs: docs/COMMANDS.md#build-release-docs."""
import json, pathlib, shutil, sys, tempfile, unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "jeby"))
import cooking as CK

REAL = CK.DIR


def copy_tree():
    d = pathlib.Path(tempfile.mkdtemp(prefix="recipes-")); shutil.copytree(REAL, d / "recipes"); return d


class Loader(unittest.TestCase):
    def test_repo_data_validates(self):
        """Protects: the recipes shipped in the repo pass the schema, brisket comes first, and both variants load."""
        cats = CK.load()
        self.assertEqual(cats[0]["category"], "brisket")
        self.assertEqual([v["slug"] for v in cats[0]["variants"]], ["smoked", "al-horno"])

    def test_missing_required_field_fails_the_build(self):
        """Protects: a recipe without a required step field (applies_to) is refused, not rendered."""
        d = copy_tree()
        try:
            f = d / "recipes/brisket/smoked/en.json"; r = json.loads(f.read_text(encoding="utf-8"))
            del r["steps"][0]["applies_to"]; f.write_text(json.dumps(r), encoding="utf-8")
            with self.assertRaises(CK.RecipeError) as e: CK.load(d / "recipes")
            self.assertIn("missing required field 'applies_to'", str(e.exception))
        finally: shutil.rmtree(d, ignore_errors=True)

    def test_string_quantity_and_bad_enum_fail(self):
        """Protects: quantities stay {value, unit} (never a string) and enums are enforced."""
        d = copy_tree()
        try:
            f = d / "recipes/brisket/smoked/en.json"; r = json.loads(f.read_text(encoding="utf-8"))
            r["ingredients"][0]["amount"] = "10 lb"; r["steps"][0]["elasticity"] = "stretchy"; f.write_text(json.dumps(r), encoding="utf-8")
            with self.assertRaises(CK.RecipeError) as e: CK.load(d / "recipes")
            self.assertIn("expected object, got str", str(e.exception)); self.assertIn("'stretchy' is not one of", str(e.exception))
        finally: shutil.rmtree(d, ignore_errors=True)

    def test_id_must_match_path(self):
        """Protects: a file's id and lang agree with where it lives, so URLs cannot drift from the data."""
        d = copy_tree()
        try:
            f = d / "recipes/brisket/smoked/en.json"; r = json.loads(f.read_text(encoding="utf-8"))
            r["id"] = "brisket/other/en"; f.write_text(json.dumps(r), encoding="utf-8")
            with self.assertRaises(CK.RecipeError): CK.load(d / "recipes")
        finally: shutil.rmtree(d, ignore_errors=True)


class Render(unittest.TestCase):
    def setUp(self):
        self.cats = CK.load(); self.pages = {k: (lang, body) for k, lang, _t, _d, body in CK.pages(self.cats)}

    def test_quantities_as_text(self):
        """Protects: {value, unit} renders in the data's own unit, with ranges, fractions and count units."""
        self.assertEqual(CK.qty({"value": 10, "unit": "lb"}, "en"), "10 lb")
        self.assertEqual(CK.qty({"value": 1.5, "unit": "tbsp"}, "en"), "1½ tbsp")
        self.assertEqual(CK.qty({"value": 2, "max": 2.5, "unit": "kg"}, "es"), "2–2½ kg")
        self.assertEqual(CK.qty({"value": 3.5, "unit": "cup"}, "es"), "3½ tazas")
        self.assertEqual(CK.qty({"value": 3, "unit": "clove"}, "es"), "3")
        self.assertEqual(CK.qty({"value": 255, "unit": "F"}, "en"), "255 °F")

    def test_gated_step_leads_with_condition(self):
        """Protects: a temperature or feel gate shows the condition first and the clock only as an estimate."""
        body = self.pages["cooking-brisket-smoked"][1]
        s6 = body[body.index('id="s6"'):body.index('id="s7"')]
        self.assertLess(s6.index("When the probe reads 165 °F"), s6.index("Time estimate: 7 h"))
        s8 = body[body.index('id="s8"'):body.index('id="s9"')]
        self.assertLess(s8.index("Go by feel"), s8.index("Time estimate"))

    def test_null_verdict_renders_nothing(self):
        """Protects: verdict and would_change are James's words; when null there is no heading and no placeholder."""
        for _lang, body in self.pages.values():
            self.assertNotIn("Verdict", body); self.assertNotIn("Veredicto", body); self.assertNotIn("What I'd change", body)

    def test_attribution_rendered_where_the_data_says(self):
        """Protects: the source block is always rendered (header by default, footer when the data says footer)."""
        es = self.pages["cooking-brisket-al-horno"][1]
        self.assertIn('href="https://comiendoconlau.com"', es); self.assertIn("Adaptada", es)
        self.assertLess(es.index('class="attrib"'), es.index('id="r-steps"'))
        en = self.pages["cooking-brisket-smoked"][1]
        self.assertGreater(en.index('class="attrib"'), en.index('id="r-steps"'))

    def test_spanish_only_recipe_stays_spanish(self):
        """Protects: the Spanish-only recipe renders in Spanish (lang es) and is marked Spanish on the index; no translation."""
        lang, body = self.pages["cooking-brisket-al-horno"]
        self.assertEqual(lang, "es"); self.assertIn("Ingredientes", body); self.assertIn("Brisket al horno", body)
        idx = CK.index_body(self.cats, "x")
        self.assertIn('<span class="chip lang" lang="en">Spanish</span>', idx)
        self.assertLess(idx.index("cooking-brisket-smoked.html"), idx.index("cooking-brisket-al-horno.html"))

    def test_unusable_photos_are_not_shown(self):
        """Protects: photos reach the page only when usable is true and the file exists."""
        for _lang, body in self.pages.values(): self.assertNotIn("assets/recipes/", body)
        self.assertEqual(CK.usable_photos({"photos": [{"file": "x.jpg", "published": True}]}), [])


if __name__ == "__main__":
    unittest.main(verbosity=1)
