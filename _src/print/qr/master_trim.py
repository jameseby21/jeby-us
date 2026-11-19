"""Trim the Chromium PDF to exactly 100 mm square and make the SVG from it.

Chromium rounds the page to 283.92 pt (100.16 mm) and anchors the 100 mm drawing top-left, leaving a 0.16 mm
white strip on the right and bottom. The print master must be the drawing's own size, so the media and crop
boxes are set to the drawing: 283.465 pt square, from the top-left corner.
"""
import subprocess
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
out = Path(__file__).parent / "out-master"
r = PdfReader(out / "master.pdf"); w = PdfWriter()
pg = r.pages[0]
H = float(pg.mediabox.top); S = 100 / 25.4 * 72  # 283.465 pt
box = RectangleObject([0, H - S, S, H])
pg.mediabox = box; pg.cropbox = box; pg.trimbox = box; pg.bleedbox = box
w.add_page(pg); w.add_metadata({"/Title": "jeby.us QR, official v1 (https://jeby.us)", "/Author": "jeby Industries (Chaz, Creative Director)"})
with open(out / "jeby-qr-official-v1.pdf", "wb") as f:
    w.write(f)
subprocess.run(["pdftocairo", "-svg", str(out / "jeby-qr-official-v1.pdf"), str(out / "pdftocairo-raw.svg")], check=True)
print("page pt", S, "from", H)
