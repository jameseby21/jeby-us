"""Make the official SVG and PDF from the Chromium drawing, at exact size.

pdftocairo outlines the wordmark (no font needed downstream), but its SVG comes out 0.19% small: the finder
squares sit 4.35282 units a module apart instead of 283.465/65 = 4.36100. The content is wrapped in one scale
that puts every finder and alignment square back on its exact module, and the page is set to 100 mm square.
The PDF is then made from that SVG, so the SVG and the PDF are the same drawing.
"""
import os, re, subprocess
from pathlib import Path
out = Path(__file__).parent / "out-master"
src = (out / "pdftocairo-raw.svg").read_text()
S = 100 / 25.4 * 72                       # 283.465 pt
u_want = S / 65
# measure the module pitch from the finder squares (outer 7x7, ink)
fs = []
for m in re.finditer(r'<path[^>]*d="([^"]+)"', src):
    n = list(map(float, re.findall(r"-?\d+\.?\d*", m.group(1))))
    xs, ys = n[0::2], n[1::2]
    if xs and abs((max(xs) - min(xs)) - 7 * u_want) < 0.5 and abs((max(ys) - min(ys)) - 7 * u_want) < 0.5:
        fs.append((round(min(xs), 3), round(min(ys), 3)))
fs = sorted(f for f in set(fs) if all(c < 30 or c > 220 for c in f)); assert len(fs) == 3, fs
xs = sorted(x for x, _ in fs)
u_have = (xs[-1] - xs[0]) / 50           # top-left finder at module 4, top-right at module 54
off = xs[0] - 4 * u_have
k = u_want / u_have
print("finders", fs, "pitch", round(u_have, 5), "offset", round(off, 4), "scale", round(k, 6))
open_tag = src[:src.index(">", src.index("<svg")) + 1]
body = src[len(open_tag):src.rindex("</svg>")]
new_open = (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="100mm" height="100mm" viewBox="0 0 {S:.6f} {S:.6f}">')
title = ("<title>jeby.us QR, official v1: encodes https://jeby.us (version 10, error correction H, 57 modules, "
         "4-module quiet zone)</title>")
wrapped = f'{new_open}\n{title}\n<rect width="{S:.6f}" height="{S:.6f}" fill="#FFFFFF"/>\n<g transform="translate({-off * k:.5f} {-off * k:.5f}) scale({k:.7f})">{body}</g>\n</svg>\n'
pre = src[:src.index("<svg")]
(out / "jeby-qr-official-v1.svg").write_text(pre + wrapped)
subprocess.run(["rsvg-convert", "-f", "pdf", "-o", str(out / "jeby-qr-official-v1.pdf"), str(out / "jeby-qr-official-v1.svg")], check=True,
               env={**os.environ, "SOURCE_DATE_EPOCH": "1795003200"})  # 2026-11-18, the decision date: same bytes on every build
print("wrote svg and pdf")
