"""Brand marks for both sites, read from marks.json (the cycling rule's candidate list).

The build renders the first live candidate so pages work without JavaScript; brand.js then
picks one at random per browser session, never the previous session's pick, and swaps
light and dark files with the theme. Docs: jeby team Drive > Branding assets > READ ME.
"""
import html
import json
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
MANIFEST = json.loads((HERE / "marks.json").read_text(encoding="utf-8"))


def _live(cands):
    return [c for c in cands if c[3] != "retired"]


def candidates(pid):
    return _live(MANIFEST["products"].get(pid, []))


def tile(pid, themed, prefix="assets/brand/"):
    """HTML for a product mark, or None when the product has no candidates yet."""
    cands = candidates(pid)
    if not cands:
        return None
    first = cands[0]
    data = html.escape(json.dumps([[c[1], c[2]] for c in cands]), quote=True)
    imgs = f'<img class="m-l" src="{prefix}{first[1]}" alt="">'
    if themed:
        imgs += f'<img class="m-d" src="{prefix}{first[2]}" alt="">'
    return f'<span class="mark brand" data-brand="{pid}" data-cands="{data}" data-prefix="{prefix}">{imgs}</span>'


def favicon_links(site, prefix="assets/brand/", default_theme=None):
    """Static icons for both OS themes (first candidate), plus the list brand.js rotates."""
    fav = MANIFEST["favicons"][site]
    cands = candidates(fav) if isinstance(fav, str) else _live(fav)
    first = cands[0]
    data = html.escape(json.dumps([[c[1], c[2]] for c in cands]), quote=True)
    product = f' data-product="{fav}"' if isinstance(fav, str) else ""  # the favicon shares the pick of this product's mark on the page
    default = f' data-default="{default_theme}"' if default_theme else ""  # a site with its own toggle names the theme it starts in
    return (f'<link rel="icon" type="image/svg+xml" href="{prefix}{first[1]}" media="(prefers-color-scheme: light)" data-fav="light">'
            f'<link rel="icon" type="image/svg+xml" href="{prefix}{first[2]}" media="(prefers-color-scheme: dark)" data-fav="dark">'
            f'<meta name="jeby-favicons" content="{data}" data-site="{site}" data-prefix="{prefix}"{product}{default}>')


def copy_assets(dest_assets):
    """Copy every live candidate's files and brand.js into a site's assets folder."""
    out = Path(dest_assets) / "brand"
    out.mkdir(parents=True, exist_ok=True)
    names = set()
    for cands in list(MANIFEST["products"].values()) + [c for c in MANIFEST["favicons"].values() if not isinstance(c, str)]:
        for c in _live(cands):
            names.update((c[1], c[2]))
    for n in sorted(names):
        shutil.copy(HERE / "marks" / n, out / n)
    shutil.copy(HERE / "brand.js", Path(dest_assets) / "brand.js")
    return len(names)


def check_coverage(ids):
    """Stop the build when a project shown on the sites has no mark candidates (lesson of 2026-11-08:
    the brand set existed in Drive while the pages still showed letter placeholders)."""
    missing = [i for i in ids if not candidates(i)]
    if missing:
        raise SystemExit("brand: no mark candidates in _src/brand/marks.json for: " + ", ".join(missing)
                         + ". Add at least two (light and dark) before building; see Branding assets in the jeby team Drive.")
