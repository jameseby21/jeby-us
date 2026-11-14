"""Text-size and contrast check for both sites (JEBYUS-0058).

    python _src/build.py        then        python _src/check_text.py [--site jeby|jai] [--list] [--widths 1440 390]

Renders every built page of jeby.us (_src/jeby/out) and jainsights.com (_src/jai/out) in headless Edge or Chrome at 1440 and 390 px
and counts the visible text that renders under 12 px (SVG text is measured after its viewBox scaling). It also checks the contrast of
every piece of visible text against the colour behind it: 4.5:1 for normal text, 3:1 for large text. The free report is measured with the
made-up cafe sample loaded, so the sheet, charts and records table are included. jeby.us is measured in both its dark and light themes.
Exit 0 when nothing is under 12 px and no text falls short of its contrast; 1 otherwise; 0 with "NOT RUN" when there is no browser.
The report's print stylesheet is not measured: it sets its own sizes for paper (the check renders on screen).
It serves the two build folders from 127.0.0.1 on free ports, uses one temporary browser profile, and removes the profile and stops
every process that carries it when done; nothing else on the machine is touched."""
import argparse, http.server, json, os, pathlib, re, shutil, socket, subprocess, sys, tempfile, threading, time

SRC = pathlib.Path(__file__).resolve().parent
SITES = {"jeby": SRC / "jeby" / "out", "jai": SRC / "jai" / "out"}
CANDIDATES = [os.environ.get("JAI_BROWSER"), "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
              "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
MIN_PX, NORMAL, LARGE = 12, 4.5, 3.0

MEASURE = r"""(() => {
const MIN = %MIN%, NORMAL = %NORMAL%, LARGE = %LARGE%;
const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
const parse = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
const over = (top, bot) => { const a = top[3] + bot[3] * (1 - top[3]); return a ? [(top[0] * top[3] + bot[0] * bot[3] * (1 - top[3])) / a, (top[1] * top[3] + bot[1] * bot[3] * (1 - top[3])) / a, (top[2] * top[3] + bot[2] * bot[3] * (1 - top[3])) / a, a] : [0, 0, 0, 0]; };
const bgOf = el => {   // the colour behind an element: translucent backgrounds are laid over what is below them; an image or gradient makes it unknown (null)
  const stack = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage && cs.backgroundImage !== "none") return null; const c = parse(cs.backgroundColor); if (c && c[3] > 0) { stack.push(c); if (c[3] >= 1) break; } }
  let acc = stack.length && stack[stack.length - 1][3] >= 1 ? stack.pop() : [255, 255, 255, 1]; while (stack.length) acc = over(stack.pop(), acc); return acc; };
const res = { small: [], contrast: [], texts: 0 };
for (const el of document.body.querySelectorAll("*")) {
  const tag = el.tagName.toLowerCase(); if (["script", "style", "noscript", "title", "meta", "link", "head", "template"].includes(tag)) continue;
  for (const ps of ["::before", "::after"]) {   // text drawn by CSS (content: "edited")
    const pc = getComputedStyle(el, ps), ct = pc.content; if (!ct || ["none", "normal", '""', "''"].includes(ct) || /^(url|counter|attr)\(/.test(ct) === false && !/^["']/.test(ct) || pc.display === "none") continue;
    const px0 = parseFloat(pc.fontSize); res.texts++; if (px0 < MIN - 0.01) res.small.push({ sel: el.tagName.toLowerCase() + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).join(".") : "") + ps, px: Math.round(px0 * 10) / 10, text: ct.slice(0, 40) });
  }
  let own = ""; for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue; own = own.replace(/\s+/g, " ").trim(); if (!own) continue;
  const isSvg = el instanceof SVGElement, cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) continue;
  if (el.closest("[hidden],.sr-only,[inert],template")) continue;
  const r = el.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) continue;
  let px = parseFloat(cs.fontSize); if (isSvg && el.getScreenCTM) { const m = el.getScreenCTM(); if (m) px *= Math.hypot(m.a, m.b); }
  res.texts++;
  const cn = el.className && typeof el.className === "string" ? el.className : (el.className && el.className.baseVal) || "", sel = tag + (cn.trim() ? "." + cn.trim().split(/\s+/).join(".") : "");
  if (px < MIN - 0.01) res.small.push({ sel, px: Math.round(px * 10) / 10, text: own.slice(0, 40) });
  const fg = parse(isSvg ? cs.fill : cs.color), bg = bgOf(el); if (!fg || !bg) continue;
  const f = fg[3] < 1 ? over(fg, bg) : fg, L1 = lum(f), L2 = lum(bg), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05), bold = +cs.fontWeight >= 700, large = px >= 24 || (px >= 18.66 && bold);
  if (ratio < (large ? LARGE : NORMAL) - 0.005) res.contrast.push({ sel, ratio: Math.round(ratio * 100) / 100, px: Math.round(px * 10) / 10, text: own.slice(0, 40), fg: cs.color, bg: "rgb(" + bg.slice(0, 3).map(Math.round).join(",") + ")" });
}
return JSON.stringify(res); })()""".replace("%MIN%", str(MIN_PX)).replace("%NORMAL%", str(NORMAL)).replace("%LARGE%", str(LARGE))


class Browser:
    """One headless Edge or Chrome driven over the DevTools protocol, with a minimal WebSocket client (standard library only)."""
    def __init__(self, exe, profile):
        import base64, urllib.request
        s = socket.socket(); s.bind(("127.0.0.1", 0)); self.port = s.getsockname()[1]; s.close()
        self.proc = subprocess.Popen([exe, "--headless=new", "--disable-gpu", f"--remote-debugging-port={self.port}", f"--user-data-dir={profile}", "--no-first-run", "--no-default-browser-check",
                                      "--disable-extensions", "--disable-background-networking", "--hide-scrollbars", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        target = None
        for _ in range(80):
            time.sleep(0.25)
            try:
                lst = json.load(urllib.request.urlopen(f"http://127.0.0.1:{self.port}/json/list", timeout=2)); target = next((t for t in lst if t.get("type") == "page"), None)
                if target: break
            except Exception: pass
        if not target: raise RuntimeError("the browser did not start")
        u = re.match(r"ws://([^/:]+):(\d+)(/.*)", target["webSocketDebuggerUrl"]); self.sock = socket.create_connection((u.group(1), int(u.group(2))), timeout=60)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall((f"GET {u.group(3)} HTTP/1.1\r\nHost: {u.group(1)}:{u.group(2)}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        buf = b""
        while b"\r\n\r\n" not in buf: buf += self.sock.recv(4096)
        self.buf = buf.split(b"\r\n\r\n", 1)[1]; self.n = 0
    def _read(self, k):
        while len(self.buf) < k:
            d = self.sock.recv(65536)
            if not d: raise RuntimeError("the browser closed the connection")
            self.buf += d
        out, self.buf = self.buf[:k], self.buf[k:]; return out
    def _frame(self):
        msg = b""
        while True:
            b0, b1 = self._read(2); n = b1 & 127
            if n == 126: n = int.from_bytes(self._read(2), "big")
            elif n == 127: n = int.from_bytes(self._read(8), "big")
            msg += self._read(n)
            if b0 & 0x80: return msg
    def call(self, method, **params):
        self.n += 1; data = json.dumps({"id": self.n, "method": method, "params": params}).encode(); mask = os.urandom(4); n = len(data)
        head = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + n.to_bytes(2, "big") if n < 65536 else bytes([0x80 | 127]) + n.to_bytes(8, "big"))
        self.sock.sendall(head + mask + bytes(c ^ mask[i % 4] for i, c in enumerate(data)))
        while True:
            m = json.loads(self._frame())
            if m.get("id") == self.n:
                if "error" in m: raise RuntimeError(m["error"].get("message"))
                return m["result"]
    def js(self, expr):
        r = self.call("Runtime.evaluate", expression=expr, awaitPromise=True, returnByValue=True)
        if r.get("exceptionDetails"): raise RuntimeError(r["exceptionDetails"].get("text"))
        return r["result"].get("value")
    def close(self):
        try: self.sock.close()
        except Exception: pass


def serve(root):
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k): super().__init__(*a, directory=str(root), **k)
        def log_message(self, *a): pass
    class S(http.server.ThreadingHTTPServer):
        def handle_error(self, *a): pass   # a browser that closes a connection early is not an error here
    srv = S(("127.0.0.1", 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start(); return srv


def stop_profile(profile):
    """Stop every process whose command line carries our temporary profile folder, and nothing else."""
    try:
        if os.name == "nt":
            subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
                            f"Get-CimInstance Win32_Process | Where-Object {{ $_.CommandLine -like '*{str(profile).replace(chr(39), chr(39) * 2)}*' }} | ForEach-Object {{ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }}"],
                           capture_output=True, timeout=60)
        else:
            subprocess.run(["pkill", "-f", str(profile)], capture_output=True, timeout=30)
    except Exception:
        pass


def pages_of(root):
    return sorted(p.relative_to(root).as_posix() for p in root.rglob("*.html") if "assets" not in p.relative_to(root).parts)


def main():
    try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # page text carries characters a Windows console cannot print
    except Exception: pass
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--site", choices=["jeby", "jai"], action="append", help="only this site (default: both)")
    ap.add_argument("--widths", type=int, nargs="+", default=[1440, 390]); ap.add_argument("--list", action="store_true", help="print every offender, not only the first twelve per page")
    a = ap.parse_args()
    exe = next((p for p in CANDIDATES if p and os.path.exists(p)), None)
    if not exe: print("NOT RUN: no Edge or Chrome found (set JAI_BROWSER to a browser executable)."); return 0
    sites = a.site or ["jeby", "jai"]
    for s in sites:
        if not SITES[s].exists(): print(f"NOT RUN: build first (python _src/build.py): {SITES[s]}"); return 0
    profile = pathlib.Path(tempfile.mkdtemp(prefix="check-text-")); servers = []; br = None; bad_small = bad_contrast = 0; npages = 0; errors = []
    try:
        br = Browser(exe, profile); br.call("Page.enable"); br.call("Runtime.enable")
        for s in sites:
            srv = serve(SITES[s]); servers.append(srv); base = f"http://127.0.0.1:{srv.server_address[1]}"
            pgs = pages_of(SITES[s]); pgs_run = pgs + (["report.html#sample"] if "report.html" in pgs else [])
            for w in a.widths:
                br.call("Emulation.setDeviceMetricsOverride", width=w, height=900, deviceScaleFactor=1, mobile=w <= 500)
                for pg in pgs_run:
                    try:
                        br.call("Page.navigate", url=f"{base}/{pg}")
                        for _ in range(100):   # the document is complete and the web fonts are in (or have failed)
                            if br.js("document.readyState === 'complete'"): break
                            time.sleep(0.1)
                        br.js("document.fonts.ready.then(() => true)")
                        if pg.endswith("#sample"):   # the report: wait for the sheet and the records table of the made-up sample
                            for _ in range(150):
                                if br.js("!!document.querySelector('.sheet') && document.querySelectorAll('.rec-tr').length > 0"): break
                                time.sleep(0.2)
                        time.sleep(0.4)
                        for th in (["dark", "light"] if s == "jeby" and not pg.endswith("#sample") else [""]):
                            if th: br.js(f"document.documentElement.setAttribute('data-theme', '{th}')"); time.sleep(0.15)
                            r = json.loads(br.js(MEASURE)); ns, nc = len(r["small"]), len(r["contrast"]); bad_small += ns; bad_contrast += nc; npages += 1
                            print(f"{'ok  ' if not (ns or nc) else 'FAIL'} {s}/{pg}{' [' + th + ']' if th else ''} @{w}: {r['texts']} text elements, {ns} under {MIN_PX} px, {nc} below contrast")
                            lim = None if a.list else 12
                            for x in r["small"][:lim]: print(f"       small    {x['px']} px  {x['sel']}  \"{x['text']}\"")
                            for x in r["contrast"][:lim]: print(f"       contrast {x['ratio']}:1  {x['px']} px  {x['sel']}  \"{x['text']}\"  {x['fg']} on {x['bg']}")
                    except Exception as e:
                        errors.append(f"{s}/{pg} @{w}: {e}")
        br.call("Emulation.clearDeviceMetricsOverride")
    except Exception as e:
        errors.append(str(e))
    finally:
        for srv in servers: srv.shutdown()
        if br: br.close()
        if br and br.proc.poll() is None: br.proc.kill()
        stop_profile(profile); shutil.rmtree(profile, ignore_errors=True)
        if profile.exists(): shutil.rmtree(profile, ignore_errors=True)
    for e in errors: print("ERROR " + e)
    print(f"\n{npages} page renders checked: {bad_small} text elements under {MIN_PX} px, {bad_contrast} below {NORMAL}:1 (3:1 for large text)" + (f", {len(errors)} errors" if errors else ""))
    return 1 if (bad_small or bad_contrast or errors) else 0


if __name__ == "__main__":
    sys.exit(main())
