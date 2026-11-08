/* JEBYUS-0040: browser check for the jeby.us favicon and mark rotation (the cycling rule). Plain Node 22+, no dependencies.
       python _src/build.py      then      node _src/brand/check_brand.js
   Serves _src/jeby/out on 127.0.0.1 and drives one headless Edge or Chrome with a temporary profile; both are removed when done.
   Without a browser it prints "NOT RUN" and exits 0. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), net = require("net"), http = require("http"), cp = require("child_process"), assert = require("assert");
const OUT = path.resolve(__dirname, "../jeby/out");
const exe = [process.env.JAI_BROWSER, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"].filter(Boolean).find(p => fs.existsSync(p));
if (!exe) { console.log("NOT RUN: no Edge or Chrome found (set JAI_BROWSER)."); process.exit(0); }
if (!fs.existsSync(path.join(OUT, "lab.html"))) { console.log("NOT RUN: build first (python _src/build.py)"); process.exit(0); }
if (typeof WebSocket === "undefined") { console.log("NOT RUN: this Node has no WebSocket (use Node 22 or newer)."); process.exit(0); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg" };
let child = null, profile = null, server = null, BASE = "";
function cleanup() {
  try { if (server) server.close(); } catch (e) {} server = null;
  try {
    // Edge re-launches itself, so stop every process whose command line carries our temporary profile folder (and nothing else)
    if (profile && process.platform === "win32") cp.spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*" + path.basename(profile) + "*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"], { stdio: "ignore" });
    else if (profile) cp.spawnSync("pkill", ["-f", profile], { stdio: "ignore" });
    if (child && child.pid) { if (process.platform === "win32") cp.spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }); else child.kill("SIGKILL"); }
  } catch (e) {} child = null;
  try { if (profile) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch (e) {}
}
process.on("exit", cleanup); process.on("SIGINT", () => { cleanup(); process.exit(130); });
let passed = 0, failed = 0;
const check = (name, fn) => Promise.resolve().then(fn).then(r => { passed++; console.log("  ok   " + name + (r ? " (" + r + ")" : "")); }, e => { failed++; console.log("  FAIL " + name + "\n       " + String(e.message || e).split("\n").join("\n       ")); });

(async () => {
  await new Promise(res => { server = http.createServer((req, rsp) => { const u = decodeURIComponent(req.url.split("?")[0]).replace(/^[/]+/, "") || "index.html"; const f = path.join(OUT, u);
    if (!f.startsWith(OUT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.statusCode = 404; return rsp.end("no"); } rsp.setHeader("content-type", TYPES[path.extname(f)] || "application/octet-stream"); rsp.end(fs.readFileSync(f)); });
    server.listen(0, "127.0.0.1", () => { BASE = "http://127.0.0.1:" + server.address().port; res(); }); });
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "brand-check-")); const port = await freePort();
  child = cp.spawn(exe, ["--headless=new", "--remote-debugging-port=" + port, "--user-data-dir=" + profile, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-background-networking", "about:blank"], { stdio: "ignore" });
  let ws = null;
  for (let i = 0; i < 60 && !ws; i++) { await sleep(250); try { const list = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json(); const pg = list.find(t => t.type === "page"); if (pg) ws = pg.webSocketDebuggerUrl; } catch (e) {} }
  if (!ws) throw new Error("browser did not start");
  const sock = new WebSocket(ws); await new Promise((res, rej) => { sock.onopen = res; sock.onerror = rej; });
  let id = 0; const pending = new Map();
  sock.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); sock.send(JSON.stringify({ id: i, method, params })); });
  const js = async expr => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text); return r.result.value; };
  const waitFor = async (expr, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(expr).catch(() => false)) return; await sleep(40); } throw new Error("timed out waiting for " + expr); };
  const READY = "document.readyState === 'complete' && !!document.querySelector('link[data-fav]')";
  const open = async (page, fresh) => { await send("Page.navigate", { url: BASE + "/" + page }); await waitFor(READY);
    if (fresh) { await js("sessionStorage.clear()"); await send("Page.navigate", { url: BASE + "/" + page }); await waitFor(READY); } await sleep(60); };
  const fav = () => js("(() => { const l = [...document.querySelectorAll('link[data-fav]')]; return { n: l.length, file: l.map(x => x.getAttribute('href').split('/').pop()) } })()");
  const J = ["jeby-us-j-light.svg", "jeby-us-j-dark.svg"], DOT = "jeby-us-dot.svg";
  await send("Page.enable"); await send("Runtime.enable");
  console.log("jeby.us favicon and marks (JEBYUS-0040)");

  await check("the favicon is one of the two candidates (j tile or red dot) in the file the dark site needs", async () => {
    await open("lab.html", true); const f = await fav();
    assert.strictEqual(f.n, 1, "one live icon link: " + f.n); assert([J[1], DOT].includes(f.file[0]), f.file[0]); return f.file[0];
  });
  await check("a new session never gets the previous session's pick, and over six sessions both candidates appear", async () => {
    const seq = []; for (let i = 0; i < 6; i++) { await open("lab.html", true); seq.push((await fav()).file[0] === DOT ? "dot" : "j"); }
    for (let i = 1; i < seq.length; i++) assert.notStrictEqual(seq[i], seq[i - 1], "same twice running: " + seq.join(" "));
    assert(seq.includes("dot") && seq.includes("j"), seq.join(" ")); return seq.join(" ");
  });
  await check("the pick is kept for the whole session: navigating between pages does not change it", async () => {
    await open("lab.html", true); const a = (await fav()).file[0];
    for (const p of ["index.html", "about.html", "lab.html"]) { await open(p, false); assert.strictEqual((await fav()).file[0], a, p); } return a;
  });
  await check("the favicon follows the logo: the visible jeby.us mark on the Lab page is the file in the tab", async () => {
    await open("lab.html", true); const m = await js("(() => { const e = document.querySelector('#jebyus .mark.brand'), v = [...e.querySelectorAll('img')].find(i => getComputedStyle(i).display !== 'none'); return v.getAttribute('src').split('/').pop(); })()");
    assert.strictEqual(m, (await fav()).file[0]); return m;
  });
  await check("the favicon follows the light toggle: the j candidate switches between its dark and light file, and back", async () => {
    await open("lab.html", true); await js("localStorage.removeItem('jeby-theme'); delete document.documentElement.dataset.theme");
    for (let i = 0; i < 3 && (await fav()).file[0] === DOT; i++) { await js("document.querySelector('#jebyus .mark.brand').click()"); await sleep(80); }
    assert.strictEqual((await fav()).file[0], J[1], "j in dark");
    await js("document.querySelector('[data-theme-toggle]').click()"); await sleep(120); assert.strictEqual((await fav()).file[0], J[0], "j in light");
    await js("document.querySelector('[data-theme-toggle]').click()"); await sleep(120); assert.strictEqual((await fav()).file[0], J[1], "j in dark again"); return "dark -> light -> dark";
  });
  await check("a click on the mark moves to the next candidate, the favicon follows, the row does not open, and the hand pick sticks in new sessions", async () => {
    await open("lab.html", true); const before = (await fav()).file[0];
    await js("document.querySelector('#jebyus .mark.brand').click()"); await sleep(100);
    const after = (await fav()).file[0]; assert.notStrictEqual(after, before, "the icon changed");
    assert.strictEqual(await js("document.querySelector('#jebyus').open"), false, "the click must not open the row");
    for (let i = 0; i < 3; i++) { await open("lab.html", true); assert.strictEqual((await fav()).file[0], after, "new session " + i); }
    return before + " -> " + after + ", kept over three new sessions";
  });
  await check("with browser storage blocked the page still renders a candidate and raises no script error", async () => {
    await send("Page.addScriptToEvaluateOnNewDocument", { source: "const th = () => { throw new Error('blocked'); }; Storage.prototype.getItem = th; Storage.prototype.setItem = th; window.__errs = []; addEventListener('error', e => window.__errs.push(e.message));" });
    await open("lab.html", false); const f = await fav(); const errs = await js("window.__errs");
    assert.deepStrictEqual(errs, [], "script errors: " + errs); assert.strictEqual(f.n, 1); assert([J[1], DOT].includes(f.file[0])); return f.file[0];
  });
  sock.close(); console.log("\nbrand checks: " + passed + " passed, " + failed + " failed"); cleanup(); process.exit(failed ? 1 : 0);
})().catch(e => { console.log("FAIL (harness): " + (e && e.stack || e)); cleanup(); process.exit(1); });
