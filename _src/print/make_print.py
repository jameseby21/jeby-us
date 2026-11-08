#!/usr/bin/env python3
"""Print artwork for the jeby business card and the Drew QR sticker.

Builds two print-ready CMYK PDFs from the original Drew QR and the brand fonts:

  out/jeby-card-3.5x2-cmyk.pdf      2 pages (front, back), 3.75 x 2.25 in with 0.125 in bleed
  out/drew-sticker-3x3-cmyk.pdf     1 page, 3.25 x 3.25 in with bleed, CutContour die line

Specs: docs/DESIGN.md#print. Rerun after changing anything here; the PDFs are build
output and live in the owner's Drive, not in git.

    pip install reportlab fonttools pillow numpy
    python3 _src/print/make_print.py            # writes _src/print/out/
    python3 _src/print/make_print.py --out DIR

Inputs (next to this file):
  drew-qr-balanced.png   the original 1300 px Drew QR (decodes to https://jeby.us). Never a screenshot.
  fonts/                 Fraunces and Instrument Sans variable TTFs from google/fonts, with OFL.txt
"""
from __future__ import annotations

import argparse
import io
from pathlib import Path

import numpy as np
from fontTools.ttLib import TTFont as FTFont
from fontTools.varLib import instancer
from PIL import Image
from reportlab.lib.colors import CMYKColor, CMYKColorSep
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

HERE = Path(__file__).resolve().parent
IN = 72.0  # points per inch
BLEED = 0.125

# Colors. Rich black per the spec; white is unprinted stock; red is the brand
# #E3262F taken to process CMYK (check it against the vendor's proof).
RICH_BLACK = CMYKColor(0.60, 0.40, 0.40, 1.00)
PAPER = CMYKColor(0, 0, 0, 0)
RED = CMYKColor(0, 0.95, 0.85, 0)
CUT = CMYKColorSep(0, 1, 0, 0, spotName="CutContour", density=1)

# The QR source: 1300 px square, 57 modules of 20 px, 4-module quiet zone built in.
QR_PX, QR_CODE_PX = 1300, 1140

COPY = {
    "name": "James Eby",
    "invite": ("Scan Drew.", "He’ll show you what", "I’m building."),
    "url": "jeby.us",
    "email": "jeby@jainsights.com",
}


# ---------------------------------------------------------------- fonts
def static_font(src: Path, axes: dict, name: str) -> str:
    """Instance one weight from a variable font and register it with reportlab."""
    tt = instancer.instantiateVariableFont(FTFont(str(src)), axes)
    for rec in tt["name"].names:  # unique names so viewers never merge the instances
        if rec.nameID in (1, 4, 6, 16):
            rec.string = name
    buf = io.BytesIO()
    tt.save(buf)
    buf.seek(0)
    pdfmetrics.registerFont(TTFont(name, buf))
    return name


def load_fonts(fdir: Path) -> dict:
    fr = fdir / "Fraunces[SOFT,WONK,opsz,wght].ttf"
    ins = fdir / "InstrumentSans[wdth,wght].ttf"
    return {
        # The site sets display type with SOFT 100; the wordmark is Instrument Sans at
        # its heaviest (CSS asks for 800, the font tops out at 700).
        "name": static_font(fr, {"wght": 440, "opsz": 28, "SOFT": 100, "WONK": 0}, "JebyFraunces"),
        "mark": static_font(ins, {"wght": 700, "wdth": 100}, "JebyInstrumentBold"),
        "semi": static_font(ins, {"wght": 600, "wdth": 100}, "JebyInstrumentSemi"),
        "med": static_font(ins, {"wght": 500, "wdth": 100}, "JebyInstrumentMedium"),
    }


# ---------------------------------------------------------------- QR to CMYK
def qr_cmyk(src: Path) -> ImageReader:
    """Convert the RGB Drew QR to CMYK with neutrals on black ink only.

    A plain RGB-to-CMYK conversion builds blacks from all four inks, which smears
    module edges when plates shift. Here every neutral pixel goes to K alone, near
    white goes to bare stock, near black to K 100, and the few colored pixels
    (the tongue) use full gray-component replacement.
    """
    im = Image.open(src).convert("RGB")
    assert im.size == (QR_PX, QR_PX), f"expected the {QR_PX} px original, got {im.size}"
    a = np.asarray(im).astype(np.float64) / 255.0
    mx, mn = a.max(2), a.min(2)
    k = 1.0 - mx
    denom = np.where(k < 1.0, 1.0 - k, 1.0)
    cmy = (1.0 - a - k[..., None]) / denom[..., None]
    neutral = (mx - mn) <= 12 / 255
    cmy[neutral] = 0.0
    k = np.where(neutral, 1.0 - a.mean(2), k)
    k = np.where(k < 0.04, 0.0, k)                 # near white: no ink
    k = np.where(neutral & (k > 0.90), 1.0, k)     # near black: solid K
    out = np.dstack([cmy, k]).clip(0, 1)
    return ImageReader(Image.fromarray((out * 255 + 0.5).astype(np.uint8), "CMYK"))


# ---------------------------------------------------------------- helpers
def page(c: canvas.Canvas, w: float, h: float) -> None:
    """Page = trim + bleed; TrimBox and BleedBox tell the printer which is which."""
    W, H = (w + 2 * BLEED) * IN, (h + 2 * BLEED) * IN
    c.setPageSize((W, H))
    c.setBleedBox((0, 0, W, H))
    c.setTrimBox((BLEED * IN, BLEED * IN, W - BLEED * IN, H - BLEED * IN))
    c.setArtBox((BLEED * IN, BLEED * IN, W - BLEED * IN, H - BLEED * IN))


def at(x: float) -> float:
    """Trim-space inches to page points."""
    return (x + BLEED) * IN


def text(c, x, y, s, font, size, color=PAPER, tracking=0.0, anchor="left"):
    w = pdfmetrics.stringWidth(s, font, size) + tracking * size * (len(s) - 1)
    if anchor == "center":
        x -= w / IN / 2
    t = c.beginText(at(x), at(y))
    t.setFont(font, size)
    t.setCharSpace(tracking * size)
    t.setFillColor(color)
    t.textOut(s)
    c.drawText(t)
    return w / IN


def wordmark(c, x_center, baseline, size, F):
    """The ȷeby wordmark: dotless j, red dot, tracking -0.03 em.

    Dot geometry measured from the site CSS (.wordmark .j i): 0.21 em across, centred
    0.124 em right of the j's origin and 0.776 em above the baseline.
    """
    s, track = "ȷeby", -0.03
    w = pdfmetrics.stringWidth(s, F["mark"], size) + track * size * (len(s) - 1)
    x0 = x_center - w / IN / 2
    text(c, x0, baseline, s, F["mark"], size, PAPER, tracking=track)
    em = size / IN
    c.setFillColor(RED)
    c.circle(at(x0 + 0.124 * em), at(baseline + 0.776 * em), 0.105 * em * IN, stroke=0, fill=1)


def qr_plate(c, x, y, code_in, pad_in, radius_in, img):
    """White rounded plate with the QR. The image already holds a 4-module quiet zone."""
    img_in = code_in * QR_PX / QR_CODE_PX
    side = img_in + 2 * pad_in
    c.setFillColor(PAPER)
    c.roundRect(at(x), at(y), side * IN, side * IN, radius_in * IN, stroke=0, fill=1)
    c.drawImage(img, at(x + pad_in), at(y + pad_in), img_in * IN, img_in * IN)
    return side


# ---------------------------------------------------------------- card
CARD_W, CARD_H = 3.5, 2.0
CODE = 1.20       # QR code width (modules only), inches; spec minimum 1.0, preferred 1.2
PAD = 0.045       # plate margin outside the built-in quiet zone
GAP_URL = 0.075   # plate bottom to the cap top of "jeby.us"


def card(c, F, qr):
    url_size, small = 8.0, 8.0
    cap = 0.72 * url_size / IN                       # Instrument Sans cap height 720/1000
    plate = CODE * QR_PX / QR_CODE_PX + 2 * PAD
    margin = (CARD_H - (plate + GAP_URL + cap)) / 2  # centre the plate+url block
    px, py = margin, CARD_H - margin - plate
    url_base = py - GAP_URL - cap

    # Front: name, invitation, email on the right; plate with jeby.us under it on the left.
    page(c, CARD_W, CARD_H)
    c.setFillColor(RICH_BLACK)
    c.rect(0, 0, (CARD_W + 2 * BLEED) * IN, (CARD_H + 2 * BLEED) * IN, stroke=0, fill=1)
    qr_plate(c, px, py, CODE, PAD, 0.11, qr)
    text(c, px + plate / 2, url_base, COPY["url"], F["semi"], url_size, anchor="center", tracking=0.01)

    # Text column: centred in the space right of the plate, so the ragged right edge
    # doesn't leave the card left-heavy. Lines stay left-aligned on one edge.
    name_size = 17.0
    widest = max(pdfmetrics.stringWidth(COPY["name"], F["name"], name_size),
                 pdfmetrics.stringWidth(COPY["email"], F["med"], small)) / IN
    room_l, room_r = px + plate, CARD_W - margin
    col = room_l + (room_r - room_l - widest) / 2
    name_cap = 0.66 * name_size / IN                 # Fraunces cap height ≈ 0.66 em
    name_base = py + plate - name_cap
    text(c, col, name_base, COPY["name"], F["name"], name_size, tracking=-0.01)

    # Invitation block sits midway between the name and the email line.
    lead = 11.0 / IN
    inv_cap = 0.72 * 9.0 / IN
    block = inv_cap + 2 * lead
    hi = name_base - 0.22 * name_size / IN           # below the name's descenders
    lo = url_base + cap
    inv_top = (hi + lo) / 2 + block / 2 - inv_cap    # baseline of "Scan Drew."
    c.setFillColor(RED)
    dot = 0.062
    c.circle(at(col + dot / 2), at(inv_top + 0.034), dot / 2 * IN, stroke=0, fill=1)
    text(c, col + dot + 0.06, inv_top, COPY["invite"][0], F["semi"], 9.0)
    for i, line in enumerate(COPY["invite"][1:], 1):
        text(c, col, inv_top - i * lead, line, F["med"], small)
    text(c, col, url_base, COPY["email"], F["med"], small, tracking=0.005)
    c.showPage()

    # Back: the wordmark alone, optically centred on the x-height band.
    page(c, CARD_W, CARD_H)
    c.setFillColor(RICH_BLACK)
    c.rect(0, 0, (CARD_W + 2 * BLEED) * IN, (CARD_H + 2 * BLEED) * IN, stroke=0, fill=1)
    size = 46.0
    wordmark(c, CARD_W / 2, CARD_H / 2 - 0.30 * size / IN, size, F)
    c.showPage()


# ---------------------------------------------------------------- sticker
ST = 3.0
ST_CODE = 2.30    # code width on the sticker, inches
ST_RADIUS = 0.25


def sticker(c, qr):
    page(c, ST, ST)
    # The plate is the sticker: bare white stock to the die line and through the bleed.
    img_in = ST_CODE * QR_PX / QR_CODE_PX
    off = (ST - img_in) / 2
    c.drawImage(qr, at(off), at(off), img_in * IN, img_in * IN)
    # Die line: a separate CutContour spot colour, hairline, overprinting, never printed.
    c.setStrokeColor(CUT)
    c.setStrokeOverprint(True)
    c.setLineWidth(0.25)
    c.roundRect(at(0), at(0), ST * IN, ST * IN, ST_RADIUS * IN, stroke=1, fill=0)
    c.showPage()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", type=Path, default=HERE / "out")
    ap.add_argument("--qr", type=Path, default=HERE / "drew-qr-balanced.png")
    ap.add_argument("--fonts", type=Path, default=HERE / "fonts")
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    F = load_fonts(a.fonts)
    qr = qr_cmyk(a.qr)

    meta = dict(author="Chaz (Creative Director), jeby team", creator="_src/print/make_print.py")
    cpath = a.out / "jeby-card-3.5x2-cmyk.pdf"
    c = canvas.Canvas(str(cpath), pageCompression=1, initialFontName=F["med"], initialFontSize=8)
    c.setTitle("jeby business card, 3.5 x 2 in, 0.125 in bleed, CMYK")
    c.setAuthor(meta["author"]); c.setCreator(meta["creator"])
    card(c, F, qr)
    c.save()

    spath = a.out / "drew-sticker-3x3-cmyk.pdf"
    c = canvas.Canvas(str(spath), pageCompression=1, initialFontName=F["med"], initialFontSize=8)
    c.setTitle("Drew QR sticker, 3 x 3 in die-cut, CMYK")
    c.setAuthor(meta["author"]); c.setCreator(meta["creator"])
    sticker(c, qr)
    c.save()
    print(cpath)
    print(spath)


if __name__ == "__main__":
    main()
