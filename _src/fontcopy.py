"""Self-hosted fonts, per site (W26): read a site's @font-face CSS and copy only the files and licences that CSS names.

Used by both builds (`copy_site_fonts`) and by `check_fonts.py` (`parse_faces`, `parse_ranges`). Plain Python, no install."""
import pathlib, re, shutil

FACE = re.compile(r"@font-face\s*\{(.*?)\}", re.S)


def parse_ranges(text):
    """'U+0000-00FF, U+0131, U+4??' -> list of (lo, hi) code points."""
    out = []
    for part in text.split(","):
        part = part.strip().upper().removeprefix("U+")
        if not part: continue
        if "?" in part: out.append((int(part.replace("?", "0"), 16), int(part.replace("?", "F"), 16)))
        elif "-" in part: a, b = part.split("-"); out.append((int(a, 16), int(b, 16)))
        else: out.append((int(part, 16),) * 2)
    return out


def parse_faces(css):
    """Every @font-face in a CSS text: family, style, weight range, file name, unicode ranges (None = all)."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S); faces = []
    for body in FACE.findall(css):
        d = {k.strip(): v.strip() for k, v in (x.split(":", 1) for x in body.split(";") if ":" in x)}
        w = d.get("font-weight", "400").split(); lo, hi = int(w[0]), int(w[-1])
        faces.append({"family": d["font-family"].strip("'\""), "style": d.get("font-style", "normal"), "weight": (lo, hi),
                      "file": re.search(r"url\(\s*(?:fonts/)?([^)\s]+?)\s*\)", d["src"]).group(1),
                      "ranges": parse_ranges(d["unicode-range"]) if "unicode-range" in d else None})
    return faces


def licence_name(family):
    return "OFL-" + re.sub(r"\s+", "", family).lower() + ".txt"


def copy_site_fonts(src_dir, css_name, dest_assets):
    """Copy <src_dir>/<css_name> to <dest_assets>/fonts.css and only its font files and licence texts to <dest_assets>/fonts/."""
    src_dir, dest_assets = pathlib.Path(src_dir), pathlib.Path(dest_assets)
    css = (src_dir / css_name).read_text(encoding="utf-8"); faces = parse_faces(css)
    out = dest_assets / "fonts"; out.mkdir(parents=True, exist_ok=True)
    shutil.copy(src_dir / css_name, dest_assets / "fonts.css")
    for name in sorted({f["file"] for f in faces} | {licence_name(f["family"]) for f in faces} | {"LICENSES.md"}):
        shutil.copy(src_dir / name, out / name)
