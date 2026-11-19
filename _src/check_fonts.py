"""Font coverage check (W26): every character a page renders in a self-hosted family is in that family's files.

    python _src/build.py        then        python _src/check_fonts.py [--site jeby|jai] [--root DIR] [--list]

A self-hosted Latin subset silently drops any character it lacks, and the browser falls back to a system font for just that glyph (the dotless j of
the jeby.us wordmark fell to Segoe UI Black this way). This check loads every built page of jeby.us (_src/jeby/out) and jainsights.com (_src/jai/out)
in headless Edge or Chrome, reads the computed font family, style and weight of every text node (text-transform applied, ::before and ::after content
included), and for the first family of each stack, when the site serves that family from assets/fonts.css, looks every character up in the cmap
(fontTools) of the face files that family offers for that style and weight, limited to each face's unicode-range. A character covered only by a
second slice counts as covered; one the upstream family itself lacks (fonts/upstream-gaps.json) is a fallback by design. Prints `<n> pages, <m> characters not covered`, exit 1 when m is above 0.
`--root DIR` checks one folder that holds pages and assets/fonts.css (the tests use it). Needs `pip install fonttools brotli`; prints NOT RUN with
exit 0 when fontTools or a browser is missing. One temporary browser profile, removed afterwards with only the processes that carry it stopped."""
import argparse, json, os, pathlib, shutil, sys, tempfile, time, unicodedata

SRC = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(SRC))
import fontcopy
from check_text import Browser, CANDIDATES, pages_of, serve, stop_profile

UPSTREAM_GAPS = SRC / "fonts" / "upstream-gaps.json"
SITES = {"jeby": SRC / "jeby" / "out", "jai": SRC / "jai" / "out"}

COLLECT = r"""(() => {
const out = {}, skip = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "TITLE"]);
const add = (el, text) => {
  const cs = getComputedStyle(el); const tt = cs.textTransform;
  if (tt === "uppercase") text = text.toUpperCase(); else if (tt === "lowercase") text = text.toLowerCase();
  const k = JSON.stringify([cs.fontFamily, cs.fontStyle === "normal" ? "normal" : "italic", parseInt(cs.fontWeight, 10) || 400]);
  (out[k] = out[k] || new Set()); for (const ch of text) out[k].add(ch);
};
const w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
for (let n; (n = w.nextNode());) { const p = n.parentElement; if (p && !skip.has(p.tagName) && n.nodeValue.trim()) add(p, n.nodeValue); }
for (const el of document.querySelectorAll("*")) for (const ps of ["::before", "::after"]) {
  const c = getComputedStyle(el, ps).content; const m = c && c.match(/^"(.*)"$/s);
  if (m) add(el, m[1].replace(/\\(?:([0-9a-fA-F]{1,6})\s?|(.))/g, (_, h, ch) => h ? String.fromCodePoint(parseInt(h, 16)) : ch));
}
return JSON.stringify(Object.entries(out).map(([k, v]) => [...JSON.parse(k), [...v].join("")]));
})()"""


def load_faces(root):
    """Faces of a built site: the CSS at assets/fonts.css and, for each face, the code points its file has (cmap) inside its unicode-range."""
    from fontTools.ttLib import TTFont
    root = pathlib.Path(root); faces = fontcopy.parse_faces((root / "assets" / "fonts.css").read_text(encoding="utf-8"))
    for f in faces:
        cmap = set(TTFont(str(root / "assets" / "fonts" / f["file"])).getBestCmap())
        f["cover"] = cmap if f["ranges"] is None else {c for c in cmap if any(lo <= c <= hi for lo, hi in f["ranges"])}
    return faces


def split_stack(stack):
    """'"Fraunces", "Iowan Old Style", serif' -> ['Fraunces', 'Iowan Old Style', 'serif']"""
    return [p.strip().strip("'\"") for p in stack.split(",") if p.strip()]


def load_upstream_gaps(path=UPSTREAM_GAPS):
    """{family: {code points}} the upstream family itself lacks (a fallback by design, not a subsetting loss)."""
    if not pathlib.Path(path).exists(): return {}
    return {k: {int(x[2:], 16) for x in v} for k, v in json.loads(pathlib.Path(path).read_text(encoding="utf-8")).items() if isinstance(v, list)}


def gaps(usage, faces, upstream=None):
    """usage: [(font-family stack, style, weight, chars)]. Returns [(family, style, weight, char)] not covered by the first family of its stack.
    A character the upstream family lacks (upstream) is not a gap; one listed there that the files do cover is one (the list is stale)."""
    served = {f["family"] for f in faces}; out = []; upstream = upstream or {}
    for stack, style, weight, chars in usage:
        names = split_stack(stack)
        if not names or names[0] not in served: continue   # the stack starts with a system font: not ours to check
        mine = [f for f in faces if f["family"] == names[0]]
        same = [f for f in mine if f["style"] == style] or mine
        fit = [f for f in same if f["weight"][0] <= weight <= f["weight"][1]] or same
        cover = set().union(*(f["cover"] for f in fit))
        for ch in chars:
            if ch.isspace() or unicodedata.category(ch) in ("Cf", "Cc"): continue
            listed = ord(ch) in upstream.get(names[0], ())
            if ord(ch) not in cover and not listed: out.append((names[0], style, weight, ch))
            elif ord(ch) in cover and listed: out.append((names[0], style, weight, ch + " (listed in upstream-gaps.json but covered: stale entry)"))
    return out


def check_root(br, root, label, listing=False):
    """Check every page under one built folder. Returns (pages, uncovered count)."""
    root = pathlib.Path(root); faces = load_faces(root); srv = serve(root); n = bad = 0
    try:
        base = f"http://127.0.0.1:{srv.server_address[1]}"
        for pg in pages_of(root):
            br.call("Page.navigate", url=f"{base}/{pg}")
            for _ in range(100):
                if br.js("document.readyState === 'complete'"): break
                time.sleep(0.1)
            br.js("document.fonts.ready.then(() => true)"); time.sleep(0.2)
            g = gaps([tuple(u) for u in json.loads(br.js(COLLECT))], faces, load_upstream_gaps()); n += 1
            uniq = sorted(set(g), key=lambda x: (x[0], x[3])); bad += len(uniq)
            print(f"{'ok  ' if not uniq else 'FAIL'} {label}/{pg}: {len(uniq)} characters not covered")
            for f, s, w, c in uniq[: None if listing else 12]: print(f"       {f} {s} {w}: U+{ord(c[0]):04X} {ascii(c)}")
    finally:
        srv.shutdown(); srv.server_close()
    return n, bad


def run(roots, listing=False):
    """roots: [(label, folder)]. Returns (exit code, pages, uncovered) or None when not run."""
    try: import fontTools  # noqa: F401
    except ImportError: print("NOT RUN: fontTools is not installed (pip install fonttools brotli)."); return None
    exe = next((p for p in CANDIDATES if p and os.path.exists(p)), None)
    if not exe: print("NOT RUN: no Edge or Chrome found (set JAI_BROWSER to a browser executable)."); return None
    profile = pathlib.Path(tempfile.mkdtemp(prefix="check-fonts-")); br = None; pages = bad = 0
    try:
        br = Browser(exe, profile); br.call("Page.enable"); br.call("Runtime.enable")
        for label, root in roots:
            n, b = check_root(br, root, label, listing); pages += n; bad += b
    finally:
        if br: br.close()
        if br and br.proc.poll() is None: br.proc.kill()
        if br: br.proc.wait(10)
        stop_profile(profile); shutil.rmtree(profile, ignore_errors=True)
    return (1 if bad else 0), pages, bad


def main():
    try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--site", choices=["jeby", "jai"], action="append"); ap.add_argument("--root", help="one built folder with pages and assets/fonts.css")
    ap.add_argument("--list", action="store_true"); a = ap.parse_args()
    roots = [("root", a.root)] if a.root else [(s, SITES[s]) for s in (a.site or ["jeby", "jai"])]
    for _, r in roots:
        if not pathlib.Path(r).exists(): print(f"NOT RUN: build first (python _src/build.py): {r}"); return 0
    res = run(roots, a.list)
    if res is None: return 0
    code, pages, bad = res; print(f"\n{pages} pages, {bad} characters not covered by their font's files"); return code


if __name__ == "__main__":
    sys.exit(main())
