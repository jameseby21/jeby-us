"""Tests for the publish and drift steps in build.py.  Run: python _src/test_build.py
Each test protects one rule: publish never deletes a folder (JEBYUS-0060) and the drift check names every
file that differs from the build (JEBYUS-0061)."""
import pathlib, sys, tempfile, unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build


def tree(base, files):
    for name, text in files.items():
        p = base / name; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(text)


class PublishAndDrift(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory(); self.addCleanup(self._tmp.cleanup)
        self.out, self.root = pathlib.Path(self._tmp.name, "out"), pathlib.Path(self._tmp.name, "root")
        tree(self.out, {"index.html": "new", "assets/site.css": "new css", "assets/same.js": "same"})
        tree(self.root, {"index.html": "old", "assets/site.css": "old css", "assets/same.js": "same", "README.md": "keep"})

    def test_publish_with_a_file_held_open(self):
        """Protects JEBYUS-0060: an open file in the root's assets folder must not break publish."""
        held = open(self.root / "assets" / "same.js", "rb")      # unchanged file held open: left alone
        self.addCleanup(held.close)
        changed = build.publish(self.out, self.root)
        self.assertEqual(changed, ["assets/site.css", "index.html"])
        self.assertEqual(build.differing(self.out, self.root), [])
        self.assertEqual((self.root / "README.md").read_text(), "keep")   # files outside the build survive

    def test_publish_when_a_changing_file_is_held_open(self):
        """Protects JEBYUS-0060: the old code died here on Windows (rmtree failed, copytree raised)."""
        held = open(self.root / "assets" / "site.css", "rb"); self.addCleanup(held.close)
        build.publish(self.out, self.root)
        self.assertEqual((self.root / "assets" / "site.css").read_text(), "new css")

    def test_publish_creates_missing_folders(self):
        """Protects a clean tree: a folder the root does not have yet is created."""
        tree(self.out, {"research/a.html": "r"})
        build.publish(self.out, self.root)
        self.assertEqual((self.root / "research" / "a.html").read_text(), "r")

    def test_drift_names_the_edited_file(self):
        """Protects JEBYUS-0061: edit one root file and the check names it, and only it."""
        build.publish(self.out, self.root)
        self.assertEqual(build.differing(self.out, self.root), [])
        (self.root / "assets" / "site.css").write_text("hand edit")
        self.assertEqual(build.differing(self.out, self.root), ["assets/site.css"])

    def test_drift_names_a_missing_file(self):
        """Protects JEBYUS-0061: a built file absent from the root counts as drift."""
        (self.root / "index.html").unlink()
        self.assertIn("index.html", build.differing(self.out, self.root))

    def test_check_names_a_site_without_a_404(self):
        """Protects the audit fix: a site build with no 404.html is named, one with it is not."""
        tree(self.root, {"404.html": "x"})
        self.assertEqual(build.missing_404([self.out, self.root]), [str(self.out)])


if __name__ == "__main__":
    unittest.main(verbosity=2)
