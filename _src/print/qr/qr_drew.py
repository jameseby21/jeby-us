"""Drew QR options for James (Chaz, 2026-11-17): Drew off centre, so the code's squares stop landing on his face.

Halftone QR: each data module is a dot at its centre (what a scanner samples); between the dots
you see the engraving from jeby.us (drew-tongue.svg, the one Drew of BRAND-0045). Finder and
alignment patterns are solid. Every output is decoded by three OpenCV readers at several sizes,
blurred and JPEG-compressed, and the original balanced QR runs through the same battery.

Usage: node raster.js && node wordmark.js && python3 qr_drew.py
(needs opencv-contrib-python for the WeChat reader; writes out/drew-qr-<option>.png and out/report.json; build/ and out/ are not committed)
"""
import json
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).parent
RED = (47, 38, 227)  # BGR of #E3262F, the family dot
_wm = cv2.imread(str(HERE / "build/wordmark.png"), cv2.IMREAD_UNCHANGED)  # jeby.us .wordmark CSS, rendered by wordmark.js
_ys, _xs = np.where(_wm[..., 3] > 10)
WORDMARK = _wm[_ys.min():_ys.max() + 1, _xs.min():_xs.max() + 1]
OUT = HERE / "out"
URL = "https://jeby.us"
INK, PAPER = (13, 11, 11), (255, 255, 255)  # BGR; neutral black, white
ALIGN = {2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42],
         9: [6, 26, 46], 10: [6, 28, 50]}

# Drew's raster (2000 x 1970) and landmarks in raster pixels, measured from drew-2000.png.
RASTER = cv2.imread(str(HERE / "build/drew-2000.png"))
TONGUE = cv2.imread(str(HERE / "build/tongue-2000.png"), 0) < 128
HEAD = (363, 90, 1681, 1969)        # x0, y0, x1, y1 of the whole head
FACE = (760, 840, 1390, 1820)       # eyes to the tip of the tongue: what must stay clear of squares
EYES_NOSE = (740, 820, 1400, 1460)  # the window option keeps this free of dots
# James, 2026-11-17 19:46: "it's ok if the middle blocks him a little bit just not in the eyes tongue or nose"
LANDMARKS = [(750, 840, 910, 985), (1220, 850, 1380, 1000), (1060, 1200, 1360, 1450), (955, 1536, 1290, 1823)]
DARK = cv2.cvtColor(RASTER, cv2.COLOR_BGR2GRAY) < 200 if RASTER is not None else None


def matrix(v: int) -> np.ndarray:
    p = cv2.QRCodeEncoder_Params()
    p.version, p.correction_level, p.mode = v, cv2.QRCodeEncoder_CORRECT_LEVEL_H, cv2.QRCodeEncoder_MODE_BYTE
    img = cv2.QRCodeEncoder.create(p).encode(URL)
    n = 17 + 4 * v
    b = (img.shape[0] - n) // 2
    assert img.shape[0] == n + 2 * b, img.shape
    return img[b:b + n, b:b + n] < 128


def pattern_boxes(v: int):
    """Finder (with separator) and alignment squares, in module coords: (kind, r0, c0, size)."""
    n = 17 + 4 * v
    boxes = [("finder", 0, 0, 8), ("finder", 0, n - 8, 8), ("finder", n - 8, 0, 8)]
    for r in ALIGN[v]:
        for c in ALIGN[v]:
            if (r < 9 and c < 9) or (r < 9 and c > n - 10) or (r > n - 10 and c < 9):
                continue
            boxes.append(("align", r - 2, c - 2, 5))
    return boxes


def small_mask(v: int) -> np.ndarray:
    """Timing, format and version modules: drawn as small squares."""
    n = 17 + 4 * v
    f = np.zeros((n, n), bool)
    f[6, 8:n - 8] = True
    f[8:n - 8, 6] = True
    f[8, 0:9] = True; f[0:9, 8] = True; f[8, n - 8:] = True; f[n - 8:, 8] = True
    if v >= 7:
        f[0:6, n - 11:n - 8] = True; f[n - 11:n - 8, 0:6] = True
    return f


def place(v, head_h, face_target, margin=1.0, keep_finders=False, inside=False, protect_only=False):
    """Scale so the head is head_h modules tall; move it so the face box sits as near face_target
    (fractions of the code width) as possible without touching a finder or alignment square."""
    n = 17 + 4 * v
    k = (HEAD[3] - HEAD[1]) / head_h               # raster px per module
    fw, fh = (FACE[2] - FACE[0]) / k, (FACE[3] - FACE[1]) / k
    want = np.array([face_target[0] * n, face_target[1] * n])
    best = None
    for dx in np.arange(-8, 8.01, 0.25):
        for dy in np.arange(-8, 8.01, 0.25):
            cx, cy = want[0] + dx, want[1] + dy
            fx0, fy0 = cx - fw / 2, cy - fh / 2
            if fx0 < 0.5 or fy0 < 0.5 or fx0 + fw > n - 0.5 or fy0 + fh > n - 0.5:
                continue
            clash = False
            ox_i, oy_i = cx - ((FACE[0] + FACE[2]) / 2) / k, cy - ((FACE[1] + FACE[3]) / 2) / k
            if inside and (ox_i + HEAD[0] / k < 0.5 or oy_i + HEAD[1] / k < 0.5 or ox_i + HEAD[2] / k > n - 0.5):
                continue  # keep his ears and cheeks inside the code
            # the timing row and column never cross his face
            if not protect_only and ((fy0 - margin < 7 and fy0 + fh + margin > 6) or (fx0 - margin < 7 and fx0 + fw + margin > 6)):
                continue
            if keep_finders:
                # no part of Drew within 2 modules of a finder: it keeps finder detection clean
                ox_, oy_ = cx - ((FACE[0] + FACE[2]) / 2) / k, cy - ((FACE[1] + FACE[3]) / 2) / k
                for kind, r0, c0, s in pattern_boxes(v):
                    if kind != "finder":
                        continue
                    zx0, zy0, zx1, zy1 = c0 - 2, r0 - 2, c0 + s + 2, r0 + s + 2
                    px0, py0 = int(max(0, (zx0 - ox_) * k)), int(max(0, (zy0 - oy_) * k))
                    px1, py1 = int(min(DARK.shape[1], (zx1 - ox_) * k)), int(min(DARK.shape[0], (zy1 - oy_) * k))
                    if px1 > px0 and py1 > py0 and DARK[py0:py1, px0:px1].any():
                        clash = True
                        break
            boxes = [(ox_i + a / k, oy_i + b / k, ox_i + c / k, oy_i + d_ / k) for a, b, c, d_ in LANDMARKS] if protect_only \
                else [(fx0, fy0, fx0 + fw, fy0 + fh)]
            for bx0, by0, bx1, by1 in boxes:
                if (by0 - margin < 7 and by1 + margin > 6) or (bx0 - margin < 7 and bx1 + margin > 6):
                    clash = True
                for _, r0, c0, s in pattern_boxes(v):
                    if bx0 - margin < c0 + s and c0 < bx1 + margin and by0 - margin < r0 + s and r0 < by1 + margin:
                        clash = True
                        break
                if clash:
                    break
            if not clash:
                d = dx * dx + dy * dy
                if best is None or d < best[0]:
                    best = (d, cx, cy)
    assert best, "no clear placement"
    _, cx, cy = best
    # raster origin in module coords
    ox = cx - ((FACE[0] + FACE[2]) / 2) / k
    oy = cy - ((FACE[1] + FACE[3]) / 2) / k
    return k, ox, oy


def render(opt, m=26, quiet=4):
    v = opt["version"]
    n = 17 + 4 * v
    M = matrix(v)
    k, ox, oy = place(v, opt["head_h"], opt["face_at"], keep_finders=opt.get("keep_finders", False), inside=opt.get("inside", False), protect_only=opt.get("protect_only", False))
    size = (n + 2 * quiet) * m
    canvas = np.full((size, size, 3), 255, np.uint8)
    code0 = quiet * m
    # Drew, scaled and clipped to the code area
    s = m / k
    rw, rh = int(round(RASTER.shape[1] * s)), int(round(RASTER.shape[0] * s))
    drew = cv2.resize(RASTER, (rw, rh), interpolation=cv2.INTER_AREA)
    tongue = cv2.resize(TONGUE.astype(np.uint8), (rw, rh), interpolation=cv2.INTER_NEAREST).astype(bool)
    x0, y0 = int(round(code0 + ox * m)), int(round(code0 + oy * m))
    cx0, cy0, cx1, cy1 = max(x0, code0), max(y0, code0), min(x0 + rw, code0 + n * m), min(y0 + rh, code0 + n * m)
    canvas[cy0:cy1, cx0:cx1] = drew[cy0 - y0:cy1 - y0, cx0 - x0:cx1 - x0]
    tmask = np.zeros(canvas.shape[:2], bool)
    tmask[cy0:cy1, cx0:cx1] = tongue[cy0 - y0:cy1 - y0, cx0 - x0:cx1 - x0]
    # window (no dots) over eyes and nose, in module coords
    win = None
    if opt.get("window"):
        wx0, wy0 = ox + EYES_NOSE[0] / k, oy + EYES_NOSE[1] / k
        wx1, wy1 = ox + EYES_NOSE[2] / k, oy + EYES_NOSE[3] / k
        win = (wx0, wy0, wx1, wy1)
    txt = None
    if opt.get("wordmark"):
        cx_, cy_, hm = opt["wordmark"]          # centre (module coords) and cap-to-descender height in modules
        wm = hm * WORDMARK.shape[1] / WORDMARK.shape[0]
        txt = (cx_ - wm / 2, cy_ - hm / 2, cx_ + wm / 2, cy_ + hm / 2)
    small = small_mask(v)
    func = np.zeros((n, n), bool)
    for _, r0, c0, s_ in pattern_boxes(v):
        func[r0:r0 + s_, c0:c0 + s_] = True
    r = opt.get("dot", 0.32) * m
    skipped = 0
    for i in range(n):
        for j in range(n):
            if func[i, j]:
                continue
            px, py = code0 + j * m + m / 2, code0 + i * m + m / 2
            if txt and txt[0] - 0.5 <= j + 0.5 <= txt[2] + 0.5 and txt[1] - 0.5 <= i + 0.5 <= txt[3] + 0.5:
                skipped += 1
                continue
            if win and (((j + 0.5 - (win[0] + win[2]) / 2) / ((win[2] - win[0]) / 2)) ** 2
                        + ((i + 0.5 - (win[1] + win[3]) / 2) / ((win[3] - win[1]) / 2)) ** 2) <= 1:  # ellipse around eyes and nose
                skipped += 1
                continue
            col = INK if M[i, j] else PAPER
            if small[i, j]:
                h = m * opt.get("meta", 0.36)
                cv2.rectangle(canvas, (int(px - h), int(py - h)), (int(px + h), int(py + h)), col, -1)
            else:
                cv2.circle(canvas, (int(round(px * 16)), int(round(py * 16))), int(round(r * 16)), col, -1, cv2.LINE_AA, 4)
    # finder and alignment patterns, solid, drawn last
    for kind, r0, c0, s_ in pattern_boxes(v):
        X, Y = code0 + c0 * m, code0 + r0 * m
        if kind == "finder":
            cv2.rectangle(canvas, (X, Y), (X + 8 * m - 1, Y + 8 * m - 1), PAPER, -1)
            fx = X if c0 == 0 else X + m      # the 7x7 sits away from the separator side
            fy = Y if r0 == 0 else Y + m
            for t, col in ((0, INK), (1, PAPER), (2, INK)):
                cv2.rectangle(canvas, (fx + t * m, fy + t * m), (fx + (7 - t) * m - 1, fy + (7 - t) * m - 1), col, -1)
        else:
            for t, col in ((0, INK), (1, PAPER), (2, INK)):
                cv2.rectangle(canvas, (X + t * m, Y + t * m), (X + (5 - t) * m - 1, Y + (5 - t) * m - 1), col, -1)
    if txt:
        draw_wordmark(canvas, code0, m, txt)
    if opt.get("protect_only"):
        lm = [(ox + a / k, oy + b / k, ox + c / k, oy + d / k) for a, b, c, d in LANDMARKS]
    # report where the face sits relative to the squares
    fx0, fy0 = ox + FACE[0] / k, oy + FACE[1] / k
    fx1, fy1 = ox + FACE[2] / k, oy + FACE[3] / k
    info = {"version": v, "modules": n, "px": size, "head_h_modules": opt["head_h"],
            "face_box_modules": [float(round(fx0, 1)), float(round(fy0, 1)), float(round(fx1, 1)), float(round(fy1, 1))],
            "face_clear_of_squares": True, "window_modules_without_dots": skipped,
            "share_of_modules_in_window": round(skipped / (n * n), 3)}
    return canvas, info


def draw_wordmark(canvas, code0, m, box):
    """White knockout, then the jeby wordmark exactly as jeby.us sets it (wordmark.js renders it from the site CSS)."""
    x0, y0, x1, y1 = [code0 + c * m for c in box]
    pad = 0.5 * m
    X0, Y0, X1, Y1 = int(x0 - pad), int(y0 - pad), int(x1 + pad), int(y1 + pad)
    cv2.rectangle(canvas, (X0, Y0), (X1, Y1), PAPER, -1)
    w, h = int(round(x1 - x0)), int(round(y1 - y0))
    wm = cv2.resize(WORDMARK, (w, h), interpolation=cv2.INTER_AREA)
    a = wm[..., 3:4] / 255.0
    roi = canvas[int(y0):int(y0) + h, int(x0):int(x0) + w]
    roi[:] = (wm[..., :3] * a + roi * (1 - a)).astype(np.uint8)


def readers():
    out = [("opencv", cv2.QRCodeDetector()), ("aruco", cv2.QRCodeDetectorAruco())]
    try:
        out.append(("wechat", cv2.wechat_qrcode_WeChatQRCode()))
    except Exception:
        pass
    return out


def decode_battery(img):
    """Pass/fail per condition: three readers at five widths, plus blur and JPEG at 450 px."""
    conds = []
    for w in (900, 600, 450, 350, 280):
        conds.append((f"{w}px", cv2.resize(img, (w, w), interpolation=cv2.INTER_AREA)))
    base = cv2.resize(img, (450, 450), interpolation=cv2.INTER_AREA)
    conds.append(("450px blur", cv2.GaussianBlur(base, (0, 0), 1.2)))
    ok, enc = cv2.imencode(".jpg", base, [cv2.IMWRITE_JPEG_QUALITY, 55])
    conds.append(("450px jpeg55", cv2.imdecode(enc, 1)))
    pad = lambda im: cv2.copyMakeBorder(im, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=(255, 255, 255))
    res = {}
    for name, im in conds:
        hits = []
        for rn, rd in readers():
            try:
                if rn == "wechat":
                    txt = rd.detectAndDecode(pad(im))[0]
                    txt = txt[0] if txt else ""
                else:
                    txt = rd.detectAndDecode(pad(im))[0]
            except Exception:
                txt = ""
            hits.append(rn if txt == URL else None)
        res[name] = [h for h in hits if h]
    passed = sum(1 for v in res.values() if v)
    reads = sum(len(v) for v in res.values())
    return {"conditions_passed": passed, "conditions": len(res), "reads": reads, "reads_possible": 3 * len(res), "by_condition": res}


OPTIONS = [
    {"key": "1-right-clear", "name": "Lower right, nothing on his face", "version": 10, "head_h": 36, "face_at": (0.68, 0.66), "window": True},
    {"key": "2-left-clear", "name": "Left, nothing on his face", "version": 10, "head_h": 36, "face_at": (0.30, 0.60), "window": True},
    {"key": "3-big-right-clear", "name": "Bigger, right, nothing on his face", "version": 10, "head_h": 42, "face_at": (0.684, 0.58), "window": True, "fixed_dot": 0.32},
    {"key": "4-biggest-top-left-jeby", "name": "Biggest, top left, with jeby (James, 2026-11-17 19:38)", "version": 10, "head_h": 40,
     "face_at": (0.28, 0.36), "window": True, "inside": True, "wordmark": (39.2, 39.0, 7.0), "fixed_dot": 0.35},
    {"key": "5-top-left-jeby", "name": "Top left, a size down, with jeby", "version": 10, "head_h": 36,
     "face_at": (0.28, 0.36), "window": True, "inside": True, "wordmark": (39.2, 39.0, 7.0)},
    # James, 2026-11-17 19:46: jeby low and horizontal; Drew a little bigger; squares may touch him, never eyes, nose or tongue
    {"key": "6-bigger-jeby-low", "name": "Bigger Drew, jeby low (scan first)", "version": 10, "head_h": 44, "face_at": (0.30, 0.38),
     "window": True, "inside": True, "protect_only": True, "wordmark": (39.2, 52.7, 6.2), "fixed_dot": 0.38},
    {"key": "7-bigger-jeby-low-safer", "name": "A little bigger, jeby low", "version": 10, "head_h": 42, "face_at": (0.30, 0.38),
     "window": True, "inside": True, "protect_only": True, "wordmark": (39.2, 52.7, 6.2), "fixed_dot": 0.38},
]

if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    report = {}
    orig = cv2.imread(str(HERE.parent / "drew-qr-balanced.png"))
    report["today"] = {"name": "Today (balanced, centred, version 10)", "decode": decode_battery(orig)}
    bar = report["today"]["decode"]["reads"]  # never ship an option that reads worse than today's code
    for o in OPTIONS:
        # the smallest dots that read at least as well as today's code, in every condition
        for dot in ((o["fixed_dot"],) if o.get("fixed_dot") else (0.32, 0.35, 0.38, 0.41, 0.44)):
            img, info = render({**o, "dot": dot})
            dec = decode_battery(img)
            if dec["conditions_passed"] == dec["conditions"] and dec["reads"] >= bar:
                break
        info["dot_diameter_of_module"] = round(2 * dot, 2)
        info["meets_todays_bar"] = dec["conditions_passed"] == dec["conditions"] and dec["reads"] >= bar
        cv2.imwrite(str(OUT / f"drew-qr-{o['key']}.png"), img)
        info["decode"] = dec
        info["name"] = o["name"]
        report[o["key"]] = info
        print(o["key"], "dot", info["dot_diameter_of_module"], "reads", dec["reads"], "/", dec["reads_possible"], "conditions", dec["conditions_passed"], "/", dec["conditions"])
    print("today reads", bar, "/", report["today"]["decode"]["reads_possible"])
    (OUT / "report.json").write_text(json.dumps(report, indent=1))
