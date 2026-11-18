"""Tests for _src/check_copy.py.  Run: python _src/test_check_copy.py
Each test protects one rule of the copy ledger (JEBYUS-0084, the copy skill section 1): a line on a page with no
ledger row is caught, a row whose text left its page is caught, and a page that matches its ledger passes."""
import pathlib, sys, tempfile, unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import check_copy

PAGE = """<!doctype html><html><body>
<header class="site-header"><nav class="nav"><a href="lab.html">Lab</a></nav></header>
<main><div class="eyebrow">Miami, FL</div><h1>Interdisciplinary <span><em>problem-solver</em><span aria-hidden="true">.</span></span></h1>
<p>Super serious about my silliness.</p>{extra}</main>
<footer class="site-footer"><p class="sig">No trackers and no pop-ups. Just pages.</p></footer>
</body></html>"""
ROWS = ["| 1 | all | Lab | drafted for James | 6a9d762 | draft awaiting his word |",
        "| 2 | all | No trackers and no pop-ups. Just pages. | Chaz | b46c863 | draft awaiting his word |",
        "| 3 | index | Miami, FL | Chaz | b46c863 | draft awaiting his word |",
        "| 4 | index | Interdisciplinary problem-solver | James | JEBYUS-0082 | owner-written |",
        "| 5 | index | Super serious… | James | JEBYUS-0071 | owner-written |"]


class Ledger(unittest.TestCase):
    def run_check(self, extra="", rows=ROWS):
        tmp = tempfile.TemporaryDirectory(); self.addCleanup(tmp.cleanup); root = pathlib.Path(tmp.name)
        (root / "index.html").write_text(PAGE.format(extra=extra), encoding="utf-8")
        ledger = root / "COPY-LEDGER.md"
        ledger.write_text("# Copy ledger\n\nPages: index\n\n| # | Page | Text | Who | Command | State |\n| --- | --- | --- | --- | --- | --- |\n" + "\n".join(rows) + "\n", encoding="utf-8")
        return check_copy.check(root, ledger)

    def test_clean(self):
        """Protects the pass case: every visible line has a row (aria-hidden text ignored, a long block by its start)."""
        self.assertEqual(self.run_check(), ([], []))

    def test_missing_row(self):
        """Protects the copy skill: a line added to a page without a ledger row is named, with its page."""
        unlisted, stale = self.run_check(extra="<p>Hi, I'm James.</p>")
        self.assertEqual((unlisted, stale), ([("index", "Hi, I'm James.")], []))

    def test_stale_row(self):
        """Protects against a quiet change: a row whose text is no longer on its page is reported."""
        unlisted, stale = self.run_check(rows=ROWS + ["| 6 | index | James Eby · Miami, FL | Patch | 498e6bf | draft awaiting his word |"])
        self.assertEqual(unlisted, []); self.assertEqual([(r["n"], where) for r, where in stale], [(6, ["index"])])

    def test_this_repository(self):
        """Protects the real ledger: after a build, 0 unlisted lines and 0 stale rows (skipped without a build)."""
        if not check_copy.OUT.is_dir(): self.skipTest("no build: run python _src/build.py")
        self.assertEqual(check_copy.check(check_copy.OUT, check_copy.LEDGER), ([], []))


if __name__ == "__main__":
    unittest.main(verbosity=2)
