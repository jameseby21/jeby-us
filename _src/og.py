"""Regenerates the jeby.us share image (og.png, 1200 x 630) from the built Home page. Python 3.10+, no other dependencies.

    python _src/build.py            first, so _src/jeby/out is current
    python _src/og.py               writes _src/jeby/static/og.png (what the build publishes as og.png)
    python _src/og.py --check       renders to a temporary file and only prints its size (writes nothing in the repo)

Headless Edge or Chrome (JAI_BROWSER overrides the search) screenshots the first screen of Home in the dark theme at 1200 x 630,
served from 127.0.0.1 on a free port and driven over the DevTools protocol. One temporary profile; the browser is stopped by that profile and the folder removed afterwards.
Without a browser it prints NOT RUN and exits 0. Docs: docs/COMMANDS.md.
"""
import argparse, base64, os, pathlib, shutil, struct, sys, tempfile, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import check_text as CT

SRC = pathlib.Path(__file__).resolve().parent
OUT = SRC / "jeby" / "out"; TARGET = SRC / "jeby" / "static" / "og.png"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0]); ap.add_argument("--check", action="store_true", help="render to a temporary file, change nothing in the repo")
    a = ap.parse_args()
    exe = next((p for p in CT.CANDIDATES if p and os.path.exists(p)), None)
    if not exe: print("NOT RUN: no Edge or Chrome found (set JAI_BROWSER to a browser executable)."); return 0
    if not (OUT / "index.html").exists(): print(f"NOT RUN: build first (python _src/build.py): {OUT}"); return 0
    work = pathlib.Path(tempfile.mkdtemp(prefix="og-")); profile = work / "profile"; shot = work / "og.png"; srv = None; br = None
    try:
        srv = CT.serve(OUT); url = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
        br = CT.Browser(exe, profile); br.call("Page.enable"); br.call("Runtime.enable")
        br.call("Emulation.setDeviceMetricsOverride", width=1200, height=630, deviceScaleFactor=1, mobile=False)
        br.call("Page.navigate", url=url)
        for _ in range(100):
            if br.js("document.readyState === 'complete'"): break
            time.sleep(0.1)
        br.js("document.fonts.ready.then(() => true)")
        br.js("document.documentElement.setAttribute('data-theme', 'dark')"); br.js("scrollTo(0, 0)")
        time.sleep(2.5)   # the reveal animations on the first screen finish
        shot.write_bytes(base64.b64decode(br.call("Page.captureScreenshot", format="png", clip={"x": 0, "y": 0, "width": 1200, "height": 630, "scale": 1})["data"]))
        w, h = struct.unpack(">II", shot.read_bytes()[16:24])
        if (w, h) != (1200, 630): print(f"FAIL: screenshot is {w} x {h}, expected 1200 x 630"); return 1
        if a.check: print(f"ok: rendered {w} x {h}, {shot.stat().st_size} bytes (temporary file, nothing written)"); return 0
        shutil.copy(shot, TARGET); print(f"wrote {TARGET} ({w} x {h}, {TARGET.stat().st_size} bytes)"); return 0
    finally:
        if br: br.close()
        if srv: srv.shutdown()
        CT.stop_profile(profile); shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
