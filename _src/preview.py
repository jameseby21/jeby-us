"""Local preview of the family sites, windowless, one process.

Usage (from the repo root):
    python _src/preview.py                 build, then serve both: jeby.us on 8080, JA Insights on 8081
    python _src/preview.py jai             serve only JA Insights
    python _src/preview.py jeby            serve only jeby.us
    python _src/preview.py --no-serve      build only, start nothing
    python _src/preview.py --no-build jai  serve the existing build without rebuilding
    python _src/preview.py --live-links    keep the real https://jeby.us and https://jainsights.com links
Ctrl+C stops every server it started. James's rules (2026-11-08): the test version hosts both sites by default, or only one
or neither depending on the tags given; and a test page never points at the live sites. The family strip (assets/family.js)
and a few pages name the live origins, so the preview rewrites those origins to the local ports while serving HTML, JS and
CSS. The built files on disk are not changed. Docs: docs/COMMANDS.md, docs/RELEASE.md step 3.
"""
import argparse, functools, subprocess, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITES = {"jeby": (8080, ROOT / "_src" / "jeby" / "out", "jeby.us"), "jai": (8081, ROOT / "_src" / "jai" / "out", "JA Insights")}
LIVE = {"https://jeby.us/": "http://127.0.0.1:8080/", "https://jainsights.com/": "http://127.0.0.1:8081/",
        "https://jeby.us\"": "http://127.0.0.1:8080\"", "https://jainsights.com\"": "http://127.0.0.1:8081\""}
TEXT = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8"}


class Quiet(SimpleHTTPRequestHandler):
    rewrite = True

    def log_message(self, *args):  # the terminal stays readable; errors still raise
        pass

    def do_GET(self):
        path = Path(self.translate_path(self.path.split("?", 1)[0]))
        if path.is_dir():
            path = path / "index.html"
        if not path.suffix and not path.exists() and path.with_suffix(".html").is_file():
            path = path.with_suffix(".html")  # GitHub Pages serves /report as report.html; the preview must too
        if path.suffix in TEXT and path.is_file() and not self.rewrite:
            return self._send_file(path)
        if self.rewrite and path.suffix in TEXT and path.is_file():
            body = path.read_bytes()
            for live, local in LIVE.items():
                body = body.replace(live.encode(), local.encode())
            self.send_response(200)
            self.send_header("Content-Type", TEXT[path.suffix])
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Preview", "local links")
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def _send_file(self, path):
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", TEXT[path.suffix])
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def serve(port, directory):
    ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Quiet, directory=str(directory))).serve_forever()


def main(argv=None):
    ap = argparse.ArgumentParser(description="Build and preview the family sites.")
    ap.add_argument("sites", nargs="*", choices=sorted(SITES), help="which sites to serve; none given means both")
    ap.add_argument("--no-build", action="store_true", help="serve the existing build")
    ap.add_argument("--no-serve", action="store_true", help="build only; start no server")
    ap.add_argument("--live-links", action="store_true", help="do not rewrite the live origins to the local ports")
    a = ap.parse_args(argv)
    if not a.no_build:
        r = subprocess.run([sys.executable, str(ROOT / "_src" / "build.py")])
        if r.returncode != 0:
            return r.returncode
    if a.no_serve:
        print("built; nothing served (--no-serve)")
        return 0
    Quiet.rewrite = not a.live_links
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
    print(("Family links point at the local ports. " if Quiet.rewrite else "Family links point at the live sites. ") + "Ctrl+C stops " + ("both." if len(chosen) == 2 else "it."))
    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    sys.exit(main())
