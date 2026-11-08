"""Tests for _src/check_docs.py.  Run: python _src/test_check_docs.py
Each test protects one rule of the ownership map (JEBYUS-0062): a file without an owner, a rule without a file
and a link to a heading that does not exist are all caught, and the repository itself has 0 unowned files."""
import pathlib, sys, tempfile, unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import check_docs


def repo(rules, files, readme="see docs/doc-ownership.yaml\n"):
    tmp = tempfile.TemporaryDirectory(); root = pathlib.Path(tmp.name)
    (root / "docs").mkdir(); (root / "docs" / "doc-ownership.yaml").write_text(rules, encoding="utf-8")
    (root / "README.md").write_text(readme, encoding="utf-8")
    (root / "docs" / "A.md").write_text("# A\n\n## Build, release\n", encoding="utf-8")
    for f in files: (root / f).parent.mkdir(parents=True, exist_ok=True); (root / f).write_text("x", encoding="utf-8")
    return tmp, root


class Ownership(unittest.TestCase):
    def run_check(self, rules, files, **kw):
        tmp, root = repo(rules, files, **kw); self.addCleanup(tmp.cleanup)
        return check_docs.check(root, files)

    def test_clean_map(self):
        """Protects the pass case: every file owned, anchors real, README links the map."""
        n, problems = self.run_check('- {glob: "_src/**", doc: "docs/A.md#build-release"}\n', ["_src/a.py", "_src/x/b.js"])
        self.assertEqual((n, problems), (2, []))

    def test_unowned_file_is_named(self):
        """Protects rule 20: a file with no owning section is listed by name."""
        _, problems = self.run_check('- {glob: "_src/*.py", doc: "docs/A.md"}\n', ["_src/a.py", "_src/b.js"])
        self.assertEqual(problems, ["unowned: _src/b.js"])

    def test_rule_matching_nothing_and_missing_heading(self):
        """Protects against a stale map: a dead glob and a link to a heading that is gone are errors."""
        _, problems = self.run_check('- {glob: "_src/*.py", doc: "docs/A.md#nope"}\n- {glob: "gone/**", doc: "docs/A.md"}\n', ["_src/a.py"])
        self.assertEqual(len(problems), 2); self.assertTrue(any("no heading #nope" in p for p in problems)); self.assertTrue(any("matches no file" in p for p in problems))

    def test_braces_and_readme_link(self):
        """Protects the {a,b} glob and the README link requirement."""
        _, problems = self.run_check('- {glob: "_src/check_{links,text}.py", doc: "docs/A.md"}\n', ["_src/check_links.py", "_src/check_text.py"], readme="nothing\n")
        self.assertEqual(problems, ["README.md does not link docs/doc-ownership.yaml"])

    def test_this_repository(self):
        """Protects the real map: 0 unowned files and 0 problems in this checkout."""
        n, problems = check_docs.check(check_docs.ROOT)
        self.assertEqual(problems, []); self.assertGreater(n, 100)


if __name__ == "__main__":
    unittest.main(verbosity=2)
