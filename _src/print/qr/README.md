# Drew QR, off-centre options (BRAND-0051)

James, 2026-11-17: "a version of the balanced QR code that shows more of Drew off center. He's centered now but that means that he gets most blocked in the middle of his face."

- `raster.js` renders Drew's engraving from `_src/jeby/static/drew-tongue.svg` (the one Drew, BRAND-0045) and its tongue mask into `build/`.
- `qr_drew.py` writes each option as a halftone QR for https://jeby.us at error correction H: data modules are dots at their centres, finder and alignment squares are solid, and Drew is placed so no square lands on his face. Option windows leave his eyes and nose without dots, and error correction carries them.
- Every option goes through the same decode battery as today's `../drew-qr-balanced.png`: OpenCV, OpenCV ArUco and WeChat readers at 900, 600, 450, 350 and 280 px, plus blur and JPEG. An option ships only if it reads at least as well as today's code (18 of 21), unless it is marked for a phone test.

Today: 18 of 21. Option 1 (lower right, clear face): 19. Option 2 (left, clear face): 18. Option 3 (bigger, right, clear face): 7, WeChat only, so phone test first.
Option 4 (biggest, top left, jeby wordmark in the bottom-right gap; James, 2026-11-17 19:38): 17. Option 5 (the same, a size down): 19.
Option 6 (bigger, jeby low between the bottom squares; squares may touch his cheeks, never eyes, nose or tongue; James, 2026-11-17 19:46): 16, scan first. Option 7 (the same, a little smaller): 18.
`wordmark.js` renders the jeby wordmark from the site's own .wordmark CSS (Instrument Sans 700, dotless j, red dot) for options 4 and 5.
Rendered options and the report: Drive, Chaz's Deliverables, "BRAND-0051 Drew QR off-centre options (for James's pick)".
