"""Fails (exit 1) if any internal link in the built sites points at a file that does not exist.

    python3 _src/check_links.py     (run after python3 _src/build.py)

Checks every href and src in jeby/out and jai/out, plus the family-strip links that family.js wires at
runtime from data-x="jeby|jai" data-p="page.html" (and the pages named inside family.js itself).
Absolute https://jeby.us/... and https://jainsights.com/... URLs map to the matching build folder.
Other external URLs, mailto:, tel:, data: and #-only links are skipped.
"""
import pathlib, re, sys
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote

HERE = pathlib.Path(__file__).resolve().parent
SITES = {"jeby": HERE / "jeby" / "out", "jai": HERE / "jai" / "out"}
HOSTS = {"jeby.us": "jeby", "www.jeby.us": "jeby", "jainsights.com": "jai", "www.jainsights.com": "jai"}

def resolve(site, path):
    """Return the file a URL path would serve in `site`, or None."""
    root = SITES[site]
    p = unquote(path).lstrip("/")
    cands = [p] if p else []
    if not p or p.endswith("/"): cands = [p + "index.html"]
    else: cands += [p + ".html", p + "/index.html"]
    for c in cands:
        f = (root / c)
        if f.is_file(): return f
    return None

class Links(HTMLParser):
    def __init__(self): super().__init__(); self.found = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for k in ("href", "src"):
            if a.get(k): self.found.append((k, a[k]))
        if a.get("data-x"): self.found.append(("family", (a["data-x"], a.get("data-p") or "index.html")))
        if a.get("srcset"):
            for part in a["srcset"].split(","):
                if part.strip(): self.found.append(("src", part.strip().split()[0]))

def main():
    dead, count = [], 0
    for site, root in SITES.items():
        if not root.is_dir(): print(f"missing {root}: run the build first"); return 1
        files = [f for f in root.rglob("*.html")]
        for f in files:
            p = Links(); p.feed(f.read_text(encoding="utf-8"))
            for kind, v in p.found:
                count += 1
                if kind == "family":
                    tgt, path = v
                    if tgt not in SITES: dead.append((f, f"data-x={tgt}", "unknown site")); continue
                    if not resolve(tgt, path.split("#")[0]): dead.append((f, f"{tgt}:{path}", f"no such page in {tgt} build"))
                    continue
                u = urlsplit(v)
                if u.scheme in ("mailto", "tel", "data", "javascript") or (not u.scheme and not u.netloc and not u.path): continue
                if u.scheme in ("http", "https") or u.netloc:
                    t = HOSTS.get(u.netloc.lower())
                    if not t: continue
                    if not resolve(t, u.path): dead.append((f, v, f"no such file in {t} build"))
                    continue
                if u.path.startswith("/"): tgt = resolve(site, u.path)
                else:
                    base = (f.parent / unquote(u.path)).resolve()
                    tgt = base if base.is_file() else (base / "index.html" if (base / "index.html").is_file() else None)
                if not tgt: dead.append((f, v, "target not found"))
    fam = HERE / "family" / "family.js"                      # pages the strip names directly
    for site, pg in re.findall(r'data-x="(jeby|jai)"\s+data-p="([^"]+)"', fam.read_text(encoding="utf-8")):
        if "$" in pg: continue                               # template placeholder, not a page
        count += 1
        if not resolve(site, pg): dead.append((fam, f"{site}:{pg}", "family.js names a page that does not exist"))
    if dead:
        print(f"{len(dead)} dead link(s) out of {count} checked:")
        for f, v, why in dead: print(f"  {f.relative_to(HERE)}: {v}  ({why})")
        return 1
    print(f"ok: {count} links checked in {len(SITES)} sites, none dead")
    return 0

if __name__ == "__main__": sys.exit(main())
