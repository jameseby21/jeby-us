"""Official jeby QR master (James, 2026-11-18 23:52: option 8 is "the official one jeby-wide").

Builds the option-8 layout as vectors: Drew's engraving from drew-tongue.svg, every module as a circle or a
square, and the jeby.us wordmark set by Chromium from the site's own .wordmark CSS. Writes:
  master.html  the composition (SVG plus the wordmark element), 650 px = 65 modules
  out-master/  PDF (vector, Chromium), SVG (vector, outlined text, via pdftocairo) and PNGs, built by master.js
The layout numbers come from qr_drew.OPTIONS["8-jeby-us"], so this file never drifts from the tested option.
"""
import json
import re
from pathlib import Path

import cv2
import numpy as np

import qr_drew as q

HERE = Path(__file__).parent
OPT = next(o for o in q.OPTIONS if o["key"] == "8-jeby-us")
QZ = 4          # quiet zone, modules
PX = 10         # px per module in master.html
INK, PAPER = "#0B0B0D", "#FFFFFF"


def build():
    v = OPT["version"]
    n = 17 + 4 * v
    M = q.matrix(v)
    k, ox, oy = q.place(v, OPT["head_h"], OPT["face_at"], inside=True, protect_only=True)
    # Measured, not nominal: the raster renderer's anti-aliased cv2.circle adds about half a pixel of radius at
    # 26 px a module, so the option-8 file that passed the scan tests has dots 0.80 of a module across (labelled
    # 0.76) and timing/format squares about 0.76. Vectors at the nominal sizes read in under half the camera-like
    # trials (jitter.py), so the master uses the measured sizes.
    dot = 0.40
    sq = 0.76
    # window over eyes and nose, and the wordmark box: the same arithmetic as qr_drew.render
    wx0, wy0, wx1, wy1 = ox + q.EYES_NOSE[0] / k, oy + q.EYES_NOSE[1] / k, ox + q.EYES_NOSE[2] / k, oy + q.EYES_NOSE[3] / k
    mark = q.load_wordmark("wordmark-us.png")
    cx, cy, hm = OPT["wordmark"]
    wm = hm * mark.shape[1] / mark.shape[0]
    tx0, ty0, tx1, ty1 = cx - wm / 2, cy - hm / 2, cx + wm / 2, cy + hm / 2
    func = np.zeros((n, n), bool)
    for _, r0, c0, s in q.pattern_boxes(v):
        func[r0:r0 + s, c0:c0 + s] = True
    small = q.small_mask(v)

    # Drew's engraving, static (the tongue at rest), inner content only
    svg = (HERE / "../../jeby/static/drew-tongue.svg").read_text()
    inner = re.sub(r"^.*?<svg[^>]*>", "", svg, flags=re.S)
    inner = re.sub(r"</svg>\s*$", "", inner, flags=re.S)
    inner = re.sub(r"<style>.*?</style>", "", inner, flags=re.S)
    s = 2.0 / k  # one SVG unit of drew-tongue.svg is 2 px of the 2000 px raster; k raster px make one module

    parts = [f'<rect width="{n + 2 * QZ}" height="{n + 2 * QZ}" fill="{PAPER}"/>',
             f'<clipPath id="code"><rect x="{QZ}" y="{QZ}" width="{n}" height="{n}"/></clipPath>',
             f'<g clip-path="url(#code)"><g transform="translate({QZ + ox:.5f} {QZ + oy:.5f}) scale({s:.7f})">{inner}</g></g>']
    dots, squares = [], []
    for i in range(n):
        for j in range(n):
            if func[i, j]:
                continue
            if tx0 - 0.5 <= j + 0.5 <= tx1 + 0.5 and ty0 - 0.5 <= i + 0.5 <= ty1 + 0.5:
                continue
            if (((j + 0.5 - (wx0 + wx1) / 2) / ((wx1 - wx0) / 2)) ** 2 + ((i + 0.5 - (wy0 + wy1) / 2) / ((wy1 - wy0) / 2)) ** 2) <= 1:
                continue
            col = INK if M[i, j] else PAPER
            x, y = QZ + j + 0.5, QZ + i + 0.5
            if small[i, j]:
                squares.append(f'<rect x="{x - sq / 2:.2f}" y="{y - sq / 2:.2f}" width="{sq}" height="{sq}" fill="{col}"/>')
            else:
                dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{dot}" fill="{col}"/>')
    parts += dots + squares
    for kind, r0, c0, sz in q.pattern_boxes(v):
        X, Y = QZ + c0, QZ + r0
        if kind == "finder":
            parts.append(f'<rect x="{X}" y="{Y}" width="8" height="8" fill="{PAPER}"/>')
            fx = X if c0 == 0 else X + 1
            fy = Y if r0 == 0 else Y + 1
            for t, col in ((0, INK), (1, PAPER), (2, INK)):
                parts.append(f'<rect x="{fx + t}" y="{fy + t}" width="{7 - 2 * t}" height="{7 - 2 * t}" fill="{col}"/>')
        else:
            for t, col in ((0, INK), (1, PAPER), (2, INK)):
                parts.append(f'<rect x="{X + t}" y="{Y + t}" width="{5 - 2 * t}" height="{5 - 2 * t}" fill="{col}"/>')
    # knockout behind the wordmark (pad 0.5 module), then the wordmark element sits on top in HTML
    parts.append(f'<rect x="{QZ + tx0 - 0.5:.4f}" y="{QZ + ty0 - 0.5:.4f}" width="{wm + 1:.4f}" height="{hm + 1:.4f}" fill="{PAPER}"/>')
    side = n + 2 * QZ
    body_svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side} {side}" width="{side * PX}" height="{side * PX}" '
                f'shape-rendering="geometricPrecision">{"".join(parts)}</svg>')

    # map the wordmark's ink box (measured in the 400 px render) onto the target box
    full = cv2.imread(str(HERE / "build/wordmark-us.png"), cv2.IMREAD_UNCHANGED)
    ys, xs = np.where(full[..., 3] > 10)
    ix0, iy0, ix1, iy1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    X0, Y0, X1, Y1 = (QZ + tx0) * PX, (QZ + ty0) * PX, (QZ + tx1) * PX, (QZ + ty1) * PX
    sc = (Y1 - Y0) / (iy1 - iy0)
    left, top = X0 - ix0 * sc, Y0 - iy0 * sc
    wm_css = (HERE / "wordmark-us.html").read_text()
    style = re.search(r"<style>(.*?)</style>", wm_css, re.S).group(1)
    span = re.search(r'(<span class="wordmark" id="w">.*?</span>[^<]*</span>)', wm_css, re.S).group(1)
    html = f'''<!doctype html><html><head><meta charset="utf-8"><title>jeby QR official v1 (jeby.us)</title><style>{style}
html,body{{margin:0;background:#fff}} #stage{{position:relative;width:{side * PX}px;height:{side * PX}px;overflow:hidden}}
#stage svg{{position:absolute;left:0;top:0}} #w{{position:absolute;left:0;top:0;transform-origin:0 0;transform:translate({left:.3f}px,{top:.3f}px) scale({sc:.6f})}}
</style></head><body><div id="stage">{body_svg}{span}</div></body></html>'''
    (HERE / "master.html").write_text(html)
    meta = {"url": q.URL, "version": v, "error_correction": "H", "modules": n, "quiet_zone_modules": QZ,
            "side_modules": side, "dot_diameter_of_module": round(2 * dot, 2), "ink": INK, "paper": PAPER,
            "wordmark_box_modules": [round(QZ + tx0, 3), round(QZ + ty0, 3), round(QZ + tx1, 3), round(QZ + ty1, 3)],
            "drew_transform": {"translate_modules": [round(QZ + ox, 4), round(QZ + oy, 4)], "scale": round(s, 7)}}
    (HERE / "master.json").write_text(json.dumps(meta, indent=1))
    print("wrote master.html", len(html) // 1024, "KB;", len(dots), "dots,", len(squares), "squares")


if __name__ == "__main__":
    build()
