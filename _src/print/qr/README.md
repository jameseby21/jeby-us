# Drew QR, off-centre options (BRAND-0051)

James, 2026-11-17: "a version of the balanced QR code that shows more of Drew off center. He's centered now but that means that he gets most blocked in the middle of his face."

- `raster.js` renders Drew's engraving from `_src/jeby/static/drew-tongue.svg` (the one Drew, BRAND-0045) and its tongue mask into `build/`.
- `qr_drew.py` writes each option as a halftone QR for https://jeby.us at error correction H: data modules are dots at their centres, finder and alignment squares are solid, and Drew is placed so no square lands on his face. Option windows leave his eyes and nose without dots, and error correction carries them.
- Every option goes through the same decode battery as today's `../drew-qr-balanced.png`: OpenCV, OpenCV ArUco and WeChat readers at 900, 600, 450, 350 and 280 px, plus blur and JPEG. An option ships only if it reads at least as well as today's code (18 of 21), unless it is marked for a phone test.

Today: 18 of 21. Option 1 (lower right, clear face): 19. Option 2 (left, clear face): 18. Option 3 (bigger, right, clear face): 7, WeChat only, so phone test first.
Option 4 (biggest, top left, jeby wordmark in the bottom-right gap; James, 2026-11-17 19:38): 17. Option 5 (the same, a size down): 19.
Option 6 (bigger, jeby low between the bottom squares; squares may touch his cheeks, never eyes, nose or tongue; James, 2026-11-17 19:46): 16, scan first. Option 7 (the same, a little smaller): 18; James chose it for Bri's artifact (2026-11-18). Option 8 (7 with jeby.us, so the code carries its own URL; 2026-11-18 21:28): 18.
`wordmark.js` renders the jeby wordmark from the site's own .wordmark CSS (Instrument Sans 700, dotless j, red dot) for options 4 and 5.
Rendered options and the report: Drive, Chaz's Deliverables, "BRAND-0051 Drew QR off-centre options (for James's pick)".

## Official v1 (James, 2026-11-18 23:52: option 8 is "the official one jeby-wide")

The official set is option 8 rebuilt as vectors: `jeby-qr-official-v1` PDF and SVG (100 mm, text outlined) plus PNGs at 4096, 2048, 1000 and 512 px, with a JSON record of layout, hashes and scan results. The files and their usage spec live in Drive, Branding assets, "QR · official v1 (jeby.us)"; they are built here and not committed.

```
node raster.js && node wordmark.js
python3 master.py && node master.js        # master.html, then Chromium PDF and PNGs in out-master/
python3 master_trim.py && python3 master_svg.py && python3 master_finalize.py   # exact 100 mm PDF/SVG, tests, hashes in official-v1/
```

- `master.py` takes the layout from `OPTIONS["8-jeby-us"]`, so the master cannot drift from the picked option. Dots are 0.80 of a module and small squares 0.76: that is what the option-8 raster measured (its anti-aliased circles add about half a pixel of radius; the report's 0.76 is nominal). Vectors at the nominal size failed most classic-reader trials.
- `master_trim.py` cuts Chromium's 100.16 mm page to the drawing's 100 mm; `master_svg.py` puts pdftocairo's SVG (0.19% small) back on the exact module grid and makes the PDF from that SVG, with a fixed date so the bytes repeat.
- `jitter.py` is the scan bar from now on: 60 seeded camera-like trials (260-900 px, sub-pixel shift, up to 4 degrees, perspective, blur or JPEG) per file; WeChat 60 of 60 and each classic reader at least 50. The fixed 21-read battery flips on a single module, so it is reported but no longer decides.
- Variants (James, 2026-11-18 23:55) change only the target URL or page, the print profile and the image, are generated from these rules and named `jeby-qr-<page>-<medium>-v<N>`.
