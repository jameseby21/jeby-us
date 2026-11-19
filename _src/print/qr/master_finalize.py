"""Name, stamp, test and hash the official set (jeby-qr-official-v1).

Runs both scan tests on every file people will use, and on renders of the SVG and the PDF:
- the fixed 21-read battery (3 readers x 5 sizes + blur + JPEG), the bar used to pick option 8;
- jitter.py, 60 seeded camera-like trials per file (size, sub-pixel shift, rotation, perspective, blur, JPEG).
"""
import hashlib, json, shutil, subprocess, sys
from pathlib import Path
import cv2
from PIL import Image
HERE = Path(__file__).parent; out = HERE / "out-master"; fin = HERE / "official-v1"
fin.mkdir(exist_ok=True)
sys.path.insert(0, str(HERE)); import qr_drew as q, jitter as J
base = "jeby-qr-official-v1"
for px in (4096, 2048, 1000, 512):
    im = Image.open(out / f"master-{px}.png").convert("RGB")
    dpi = px / (100 / 25.4)                      # placed at 100 mm by default
    im.save(fin / f"{base}-{px}px.png", dpi=(dpi, dpi), optimize=True)
for ext in ("svg", "pdf"):
    shutil.copy(out / f"{base}.{ext}", fin / f"{base}.{ext}")
subprocess.run(["rsvg-convert", "-w", "2048", "-h", "2048", "-o", str(out / "t-svg.png"), str(fin / f"{base}.svg")], check=True)
subprocess.run(["pdftoppm", "-r", "600", "-png", "-singlefile", str(fin / f"{base}.pdf"), str(out / "t-pdf")], check=True)
tests = {f"{base}-{px}px.png": fin / f"{base}-{px}px.png" for px in (4096, 2048, 1000, 512)}
tests[f"{base}.svg (rendered 2048 px)"] = out / "t-svg.png"
tests[f"{base}.pdf (rendered 600 dpi)"] = out / "t-pdf.png"
tests["today's code (reference)"] = HERE / "../drew-qr-balanced.png"
tests["option 8 as picked (reference)"] = HERE / "out/drew-qr-8-jeby-us.png"
dec = {}
for name, p in tests.items():
    img = cv2.imread(str(p)); b = q.decode_battery(img); j = J.run(str(p))
    dec[name] = {"battery": f'{b["reads"]}/{b["reads_possible"]}', "conditions": f'{b["conditions_passed"]}/{b["conditions"]}',
                 "trials_60": {k: j[k] for k in ("opencv", "aruco", "wechat", "any_reader")}}
    print(f"{name:42s} battery {dec[name]['battery']}  trials opencv {j['opencv']}/60 aruco {j['aruco']}/60 wechat {j['wechat']}/60")
meta = json.loads((HERE / "master.json").read_text()) if (HERE / "master.json").exists() else {}
files = {}
for f in sorted(fin.iterdir()):
    if f.name.endswith(".json") or f.name.endswith(".md"): continue
    files[f.name] = {"bytes": f.stat().st_size, "sha256": hashlib.sha256(f.read_bytes()).hexdigest()}
rec = {"name": base, "encodes": "https://jeby.us", "decided": "2026-11-18, James: option 8 is the official code jeby-wide",
       "layout": meta, "files": files, "decode": dec}
(fin / f"{base}.json").write_text(json.dumps(rec, indent=1))
for k, v in files.items(): print(v["sha256"][:16], v["bytes"], k)
