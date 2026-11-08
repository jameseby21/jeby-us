"""Doc-ownership check (standards rule 20, JEBYUS-0062).  Python 3.10+, no other dependencies.

    python3 _src/check_docs.py   every file under _src/, docs/ and .github/ has an owner in docs/doc-ownership.yaml,
                                 every rule matches a file and names a document (and heading) that exists,
                                 and README.md links the map.  Prints "<n> files, 0 unowned" and exits 0, else exits 1.

The map's shape and the glob rules follow the Desk (`desk/src/desk/docs.py`) and jRE maps; this script is the
dependency-free check for a repo with no PyYAML.  Docs: docs/COMMANDS.md#build-release-docs
"""
import pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAP = "docs/doc-ownership.yaml"
SCOPE = ("_src/", "docs/", ".github/")


def glob_body(glob):
    """`**/` any folders, `**` anything, `*` within a folder, `?` one character, `{a,b}` alternatives."""
    out, i = [], 0
    while i < len(glob):
        if glob.startswith("**/", i): out.append("(?:.*/)?"); i += 3; continue
        if glob.startswith("**", i): out.append(".*"); i += 2; continue
        c = glob[i]
        if c == "*": out.append("[^/]*")
        elif c == "?": out.append("[^/]")
        elif c == "{" and glob.find("}", i) > i:
            j = glob.find("}", i); out.append("(?:" + "|".join(glob_body(a) for a in glob[i + 1:j].split(",")) + ")"); i = j + 1; continue
        else: out.append(re.escape(c))
        i += 1
    return "".join(out)


def glob_re(glob):
    return re.compile(glob_body(glob) + r"\Z")


def parse_rules(text):
    """One rule per `- {key: value, ...}` line; values are double-quoted strings or bare words."""
    rules = []
    for n, line in enumerate(text.splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"): continue
        if not (line.startswith("- {") and line.endswith("}")): raise ValueError(f"{MAP}:{n}: not a rule line: {line[:60]}")
        pairs = dict((k, q if q is not None else b.strip()) for k, q, b in re.findall(r'(\w+):\s*(?:"([^"]*)"|([^,}]+))', line[3:-1]))
        if "glob" not in pairs or "doc" not in pairs: raise ValueError(f"{MAP}:{n}: a rule needs glob and doc")
        rules.append({"glob": pairs["glob"], "doc": pairs["doc"], "re": glob_re(pairs["glob"]), "line": n})
    return rules


def slug(heading):
    """GitHub's heading anchor: lower case, punctuation dropped, spaces to hyphens."""
    return re.sub(r"[^\w\- ]", "", heading.strip().lower()).replace(" ", "-")


def anchors(path):
    text = path.read_text(encoding="utf-8")
    return {slug(m.group(1)) for m in re.finditer(r"^#{1,6}\s+(.*?)\s*#*\s*$", text, re.M)}


def repo_files(root):
    """Tracked and untracked-but-not-ignored files in scope, as posix paths."""
    r = subprocess.run(["git", "ls-files", "-co", "--exclude-standard"], cwd=root, capture_output=True, text=True)
    names = r.stdout.splitlines() if r.returncode == 0 else [p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()]
    return sorted(n for n in names if n.startswith(SCOPE) and (root / n).is_file())


def check(root, files=None):
    """Returns (file count, list of problems)."""
    problems = []
    rules = parse_rules((root / MAP).read_text(encoding="utf-8"))
    files = repo_files(root) if files is None else files
    used = set()
    for f in files:
        hits = [i for i, r in enumerate(rules) if r["re"].match(f)]
        if hits: used.update(hits)
        else: problems.append(f"unowned: {f}")
    for i, r in enumerate(rules):
        if i not in used: problems.append(f"{MAP}:{r['line']}: rule matches no file: {r['glob']}")
        path, _, anchor = r["doc"].partition("#")
        if not (root / path).is_file(): problems.append(f"{MAP}:{r['line']}: document not found: {path}")
        elif anchor and anchor not in anchors(root / path): problems.append(f"{MAP}:{r['line']}: no heading #{anchor} in {path}")
    readme = root / "README.md"
    if not readme.is_file() or MAP not in readme.read_text(encoding="utf-8"): problems.append(f"README.md does not link {MAP}")
    return len(files), problems


if __name__ == "__main__":
    n, problems = check(ROOT)
    for p in problems: print(p)
    print(f"{n} files, {sum(p.startswith('unowned') for p in problems)} unowned, {len(problems)} problems")
    sys.exit(1 if problems else 0)
