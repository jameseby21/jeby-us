"""The copy ledger check (JEBYUS-0084, the copy skill section 1).  Plain Python, no install.

    python _src/check_copy.py              after a build: every visible line on a ledger page has a row in
                                           docs/COPY-LEDGER.md, and every row's text is still on its page
    python _src/check_copy.py --missing    also prints a ready-to-fill table row for each unlisted line

A line is the text of a p, h1 to h4, figcaption, dt, dd, small, pre, an li with no such line inside it, anything
with class "eyebrow", every link in the header nav, and, outside those, every b, button and element with
class go, btn, lead, when, status or who (labels, buttons, Lab rows, story dates).  Text inside aria-hidden,
script, style, svg and template is not read.  Header and footer lines are listed once with page "all" and must appear on every ledger page.
A ledger text ending in "…" matches any line that starts with the text before it (for long blocks).
Exit 0 when nothing is unlisted and nothing is stale, 1 otherwise.  Docs: docs/COMMANDS.md#daily
"""
import html.parser, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "_src" / "jeby" / "out"
LEDGER = ROOT / "docs" / "COPY-LEDGER.md"
BLOCKS = {"p", "h1", "h2", "h3", "h4", "figcaption", "dt", "dd", "small", "li", "pre"}
SKIP = {"script", "style", "svg", "template"}
ORPHAN_TAGS = {"b", "button"}                       # labels and buttons outside any line above
ORPHAN_CLASSES = {"go", "btn", "lead", "when", "status", "who"}
INLINE = {"a", "span", "b", "em", "i", "strong", "small", "code", "abbr", "sup", "sub"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


def norm(text):
    return re.sub(r"\s+", " ", text).strip()


class Lines(html.parser.HTMLParser):
    """Collects (region, text) for every visible line; region is header, main or footer."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.region, self.out = [], "main", []

    def handle_starttag(self, tag, attrs):
        if tag in VOID: return
        a = dict(attrs); cls = set((a.get("class") or "").split())
        up = self.stack[-1] if self.stack else {"hidden": False, "nav": False, "covered": False}
        hidden = up["hidden"] or tag in SKIP or a.get("aria-hidden") == "true"
        nav = up["nav"] or tag == "nav" or "nav-pop" in cls
        block = not hidden and (tag in BLOCKS or "eyebrow" in cls or (tag == "a" and nav))
        orphan = not hidden and not block and not up["covered"] and (tag in ORPHAN_TAGS or bool(cls & ORPHAN_CLASSES))
        covered = up["covered"] or orphan or (block and tag != "li")
        if tag in ("header", "footer"): self.region = tag
        self.stack.append({"tag": tag, "block": block, "capture": block or orphan, "hidden": hidden, "nav": nav,
                           "covered": covered, "buf": [], "child": False, "orphans": []})

    def handle_endtag(self, tag):
        if tag in VOID or not any(e["tag"] == tag for e in self.stack): return
        while self.stack:
            e = self.stack.pop(); raw = "".join(e["buf"]); text = norm(raw)
            if e["capture"] and text and not (e["tag"] == "li" and e["child"]):
                if e["tag"] == "li":                   # a kept li already says what its labels say
                    for i in e["orphans"]: self.out[i] = None
                elif not e["block"]:
                    li = next((s for s in reversed(self.stack) if s["tag"] == "li"), None)
                    if li: li["orphans"].append(len(self.out))
                self.out.append((self.region, text))
            if self.stack and not e["hidden"]:
                up = self.stack[-1]; prev = "".join(up["buf"][-1:])
                if e["tag"] not in INLINE: raw = f" {raw} "
                elif e["tag"] in ("b", "span", "small") and prev[-1:].strip() and raw[:1].strip(): raw = " " + raw   # <b>Label</b><span>text</span>
                up["buf"].append(raw)
                up["child"] = up["child"] or e["block"] or e["child"]
            if e["tag"] in ("header", "footer"): self.region = "main"
            if e["tag"] == tag: break

    def handle_data(self, data):
        if self.stack and not self.stack[-1]["hidden"]: self.stack[-1]["buf"].append(data)


def page_lines(path):
    p = Lines(); p.feed(path.read_text(encoding="utf-8")); p.close()
    seen, out = set(), []
    for region, text in filter(None, p.out):
        key = ("all" if region in ("header", "footer") else path.stem, text)
        if key not in seen: seen.add(key); out.append(key)
    return out


def read_ledger(path):
    """Rows of the ledger table as dicts; a row is any table line whose first cell is a number."""
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.startswith("|"): continue
        cells = [c.strip().replace("\\|", "|") for c in re.split(r"(?<!\\)\|", line.strip())[1:-1]]
        if len(cells) >= 6 and cells[0].isdigit():
            rows.append({"n": int(cells[0]), "page": cells[1], "text": cells[2], "who": cells[3], "command": cells[4], "state": cells[5]})
    return rows


def ledger_pages(path):
    """The pages the ledger covers, from its line 'Pages: index, about, ...'."""
    m = re.search(r"^Pages:\s*(.+)$", path.read_text(encoding="utf-8"), re.M)
    return [p.strip() for p in m.group(1).split(",")] if m else []


def matches(row_text, text):
    return text.startswith(row_text[:-1].rstrip()) if row_text.endswith("…") else row_text == text


def check(out, ledger):
    """Returns (unlisted, stale): page lines with no row, and rows whose text is gone from their page."""
    pages = ledger_pages(ledger); rows = read_ledger(ledger)
    found = {}
    for name in pages:
        f = out / ("index.html" if name == "index" else f"{name}.html")
        if not f.is_file(): continue
        for page, text in page_lines(f):
            found.setdefault((page, text), set()).add(name)
    present = [n for n in pages if (out / ("index.html" if n == "index" else f"{n}.html")).is_file()]
    unlisted = sorted({(p, t) for (p, t) in found if not any(r["page"] == p and matches(r["text"], t) for r in rows)})
    stale = []
    for r in rows:
        if r["page"] == "all":
            missing = [n for n in present if not any(p == "all" and n in where and matches(r["text"], t) for (p, t), where in found.items())]
            if missing: stale.append((r, missing))
        elif r["page"] in present and not any(p == r["page"] and matches(r["text"], t) for (p, t) in found):
            stale.append((r, [r["page"]]))
        elif r["page"] not in pages:
            stale.append((r, [r["page"] + " (not a ledger page)"]))
        elif r["page"] not in present:
            stale.append((r, [r["page"] + " (page not built)"]))
    return unlisted, stale


def main(argv):
    if hasattr(sys.stdout, "reconfigure"): sys.stdout.reconfigure(encoding="utf-8")
    if not LEDGER.is_file(): sys.exit(f"no ledger at {LEDGER}")
    if not OUT.is_dir(): sys.exit("no build: run python _src/build.py first")
    if not ledger_pages(LEDGER): sys.exit(f"no 'Pages:' line in {LEDGER}")
    unlisted, stale = check(OUT, LEDGER)
    for page, text in unlisted: print(f"unlisted: {page}: {text}")
    for r, where in stale: print(f"stale: row {r['n']} ({r['page']}): {r['text']} (not on {', '.join(where)})")
    if "--missing" in argv:
        for page, text in unlisted: print(f"| 0 | {page} | {text.replace('|', chr(92) + '|')} | no record | no record | draft awaiting his word |")
    print(f"{len(read_ledger(LEDGER))} ledger rows, {len(unlisted)} unlisted lines, {len(stale)} stale rows")
    return 1 if unlisted or stale else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
