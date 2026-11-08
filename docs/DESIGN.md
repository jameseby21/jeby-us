# Design notes: jeby-us

Design specs that the code doesn't show on its own. The site's colours and type live in `_src/jeby/src/site.css`; this file covers what leaves the screen.

## Print

James hands out two printed pieces that carry the Drew QR: a business card and a 3 × 3 in die-cut sticker. Both come from one script, `_src/print/make_print.py`, which builds them from the original 1300 px Drew QR (`_src/print/drew-qr-balanced.png`, never a screenshot; it decodes to https://jeby.us, QR version 10, 57 modules) and the site's two typefaces, Fraunces and Instrument Sans (OFL, in `_src/print/fonts/` with their licences). It writes `jeby-card-3.5x2-cmyk.pdf` (front and back) and `drew-sticker-3x3-cmyk.pdf` to `_src/print/out/`. The PDFs are build output: git ignores them, and James keeps the copies that go to the printer. To rebuild, run `pip install reportlab fonttools pillow numpy`, then `python3 _src/print/make_print.py`.

"Black matte" means a full-bleed black design printed on soft-touch or matte stock, not black paper. Black stocks can't carry the Drew image, and the code needs dark modules on a light ground. Each card page is 3.75 × 2.25 in: the 3.5 × 2 in trim plus a 0.125 in bleed on every side, with the PDF's TrimBox and BleedBox set so the printer knows which is which. The background is rich black, C60 M40 Y40 K100, and runs into the bleed; plain K100 prints grayish.

The front puts the code on the left. The code itself is 1.2 in wide (the floor is 1.0 in), set on a white rounded plate that is bare stock. The plate holds the code's own four-module quiet zone plus 0.045 in, and nothing (text, foil or spot gloss) overlaps it. "jeby.us" is written out under the plate. The right column has the name in Fraunces, the invitation "Scan Drew. He'll show you what I'm building." with the brand's red dot, and the email address on the same baseline as "jeby.us". There is no phone number unless James asks for one. The back carries the ȷeby wordmark alone: Instrument Sans at its heaviest weight, tracked −0.03 em, with the red dot sized and placed as the site's CSS places it. All type is white knocked out of the black, at 8 pt or larger and medium weight or heavier, so a slight shift between the four inks can't fill it in.

The code is converted to CMYK by hand rather than by a stock profile. Every neutral pixel goes to black ink alone, near-white to bare stock and near-black to solid K100, so module edges stay sharp when the plates drift. Only the pink tongue uses all four inks. The brand red #E3262F is set as C0 M95 Y85 K0; check it on the vendor's proof.

The sticker is the plate itself. Its page is 3.25 in square (the 3 in trim plus bleed), the code is 2.3 in wide and centred, and nothing else is on it. The die line is a rounded square with a 0.25 in corner radius on the trim, drawn as a 0.25 pt overprinting stroke in a spot colour named CutContour, which cutters read and presses never print. It is meant for white vinyl, so the plate prints as the vinyl's own white.

Code size sets scanning distance. A common rule of thumb is a distance of up to ten times the code's width: about 30 cm (a foot) for the card's 1.2 in code and about 60 cm for the sticker's 2.3 in code. Before the files went out, a decoder (zxing-cpp) read renders of both down to about 160 camera pixels across the code, with blur, a 9° tilt, perspective, dim light and noise. That is a check, not a phone test. Before upload, and again on the printed test run, scan each piece with an iPhone camera, an Android camera and Google Lens, at arm's length, in daylight and in a dim room, five times each. Every scan has to land on jeby.us.

The vendor, the stock and the test-run results go here after the test run.
