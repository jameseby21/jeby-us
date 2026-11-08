"""Local preview of the family sites, windowless, one process.

Usage (from the repo root):
    python _src/preview.py                 build, then serve both: jeby.us on 8080, JA Insights on 8081
    python _src/preview.py jai             serve only JA Insights
    python _src/preview.py jeby            serve only jeby.us
    python _src/preview.py --no-serve      build only, start nothing
    python _src/preview.py --no-build jai  serve the existing build without rebuilding
Ctrl+C stops every server it started. James's rule (2026-11-08): the test version hosts both sites by default,
or only one or neither depending on the tags given. Docs: docs/COMMANDS.md, docs/RELEASE.md step 3.
"""
import argparse, functools, subprocess, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITES = {"jeby": (8080, ROOT / "_src" / "jeby" / "out", "jeby.us"), "jai": (8081, ROOT / "_src" / "jai" / "out", "JA Insights")}


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):  # the terminal stays readable; errors still raise
        pass


def serve(port, directory):
    ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Quiet, directory=str(directory))).serve_forever()


def main(argv=None):
    ap = argparse.ArgumentParser(description="Build and preview the family sites.")
    ap.add_argument("sites", nargs="*", choices=sorted(SITES), help="which sites to serve; none given means both")
    ap.add_argument("--no-build", action="store_true", help="serve the existing build")
    ap.add_argument("--no-serve", action="store_true", help="build only; start no server")
    a = ap.parse_args(argv)
    if not a.no_build:
        r = subprocess.run([sys.executable, str(ROOT / "_src" / "build.py")])
        if r.returncode != 0:
            return r.returncode
    if a.no_serve:
        print("built; nothing served (--no-serve)")
        return 0
    chosen = a.sites or sorted(SITES)
    threads = []
    for key in chosen:
        port, out, name = SITES[key]
        if not out.exists():
            print(f"{name}: no build at {out}; run without --no-build", file=sys.stderr)
            return 1
        t = threading.Thread(target=serve, args=(port, out), daemon=True)
        t.start(); threads.append(t)
        print(f"{name:12} http://127.0.0.1:{port}")
    print("Ctrl+C stops " + ("both." if len(chosen) == 2 else "it."))
    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    sys.exit(main())
