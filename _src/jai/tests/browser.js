/* Free report browser checks: drives a headless Edge or Chrome over the DevTools protocol (plain Node 22+, no dependencies).
       python _src/build.py      then      node _src/jai/tests/browser.js
   Renders _src/jai/out/report.html from disk, loads the made-up café sample and a 10,000-row file, and checks the records table:
   it exists and scrolls, only the visible rows are drawn, the frames stay smooth, a finding filters it, an edit recalculates,
   the export round-trips, print hides the table, and no network request happens while the visitor works.
   Without a browser the script prints "NOT RUN" and exits 0. It starts one headless browser with a temporary profile and removes both when done. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), net = require("net"), http = require("http"), cp = require("child_process"), assert = require("assert");
const R = require("../src/report.js"), Rec = require("../src/records.js");
const PAGE = path.resolve(__dirname, "../out/report.html");
const CANDIDATES = [process.env.JAI_BROWSER, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"].filter(Boolean);
const exe = CANDIDATES.find(p => fs.existsSync(p));
if (!exe) { console.log("NOT RUN: no Edge or Chrome found (set JAI_BROWSER to a browser executable)."); process.exit(0); }
if (!fs.existsSync(PAGE)) { console.log("NOT RUN: build first (python _src/build.py): " + PAGE); process.exit(0); }
if (typeof WebSocket === "undefined") { console.log("NOT RUN: this Node has no WebSocket (use Node 22 or newer)."); process.exit(0); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
let child = null, profile = null, tmpCsv = null, tmpScreen = null, tmpPieces = null, server = null, BASE = "";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const OUT = path.dirname(PAGE);
function startServer() {   // serves only _src/jai/out, on 127.0.0.1 and a free port; closed in cleanup
  return new Promise(res => { server = http.createServer((req, rsp) => { const f = path.join(OUT, decodeURIComponent(req.url.split("?")[0].split("#")[0]).replace(/^[/]+/, "") || "report.html"); if (!f.startsWith(OUT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.statusCode = 404; return rsp.end("not found"); }
      rsp.setHeader("content-type", TYPES[path.extname(f)] || "application/octet-stream"); rsp.end(fs.readFileSync(f)); });
    server.listen(0, "127.0.0.1", () => { BASE = "http://127.0.0.1:" + server.address().port; res(); }); });
}
// Edge re-launches itself, so the pid we spawned is not the browser's. Stop every process whose command line carries our temporary profile folder (and nothing else).
function stopBrowser() {
  try {
    if (profile) {
      if (process.platform === "win32") cp.spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${profile.replace(/'/g, "''")}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: "ignore", windowsHide: true });
      else cp.spawnSync("pkill", ["-f", profile], { stdio: "ignore" });
    }
    if (child && child.pid) { if (process.platform === "win32") cp.spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }); else child.kill("SIGKILL"); }
  } catch (e) {}
  child = null;
}
function cleanup() {
  try { if (server) server.close(); } catch (e) {} server = null;
  stopBrowser();
  for (const p of [profile, tmpCsv, tmpScreen, tmpPieces]) { try { if (p) fs.rmSync(p, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch (e) {} }
}
process.on("exit", cleanup); process.on("SIGINT", () => { cleanup(); process.exit(130); });

let passed = 0, failed = 0;
const check = (name, fn) => Promise.resolve().then(fn).then(r => { passed++; console.log(`  ok   ${name}${r ? " (" + r + ")" : ""}`); }, e => { failed++; console.log(`  FAIL ${name}\n       ${String(e.message || (e && e.stack) || e).split("\n").join("\n       ")}`); });

(async () => {
  await startServer(); profile = fs.mkdtempSync(path.join(os.tmpdir(), "jai-browser-")); const port = await freePort();
  child = cp.spawn(exe, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-background-networking", "--window-size=1280,1000", "about:blank"], { stdio: "ignore", windowsHide: true });
  let ws = null;
  for (let i = 0; i < 60 && !ws; i++) { await sleep(250); try { const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const pg = list.find(t => t.type === "page"); if (pg) ws = pg.webSocketDebuggerUrl; } catch (e) {} }
  if (!ws) throw new Error("browser did not start");
  const sock = new WebSocket(ws); await new Promise((res, rej) => { sock.onopen = res; sock.onerror = rej; });
  let id = 0; const pending = new Map(), requests = [];
  sock.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); }
    else if (d.method === "Network.requestWillBeSent") requests.push({ t: Date.now(), url: d.params.request.url, method: d.params.request.method }); };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); sock.send(JSON.stringify({ id: i, method, params })); });
  const js = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text); return r.result.value; };
  const waitFor = async (expr, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(expr).catch(() => false)) return Date.now() - t0; await sleep(50); } const why = await js("(document.querySelector('#report-status') || {}).textContent + ' | engine ' + (window.JAIReportDebug ? JAIReportDebug.engine : 'no debug')").catch(() => "?"); throw new Error("timed out waiting for " + expr + " (page says: " + why + ")"); };
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("Emulation.setFocusEmulationEnabled", { enabled: true });   // a headless page is never "focused" otherwise, and focus-driven reasons would not show

  console.log("browser: " + path.basename(exe) + " headless, profile " + path.basename(profile));
  await send("Page.navigate", { url: BASE + "/report.html#sample" });
  await waitFor("!!document.querySelector('.rec-win') && document.querySelectorAll('.rec-tr').length > 0");
  await check("the report runs its work in a Web Worker when the page is served", async () => { assert.strictEqual(await js(`JAIReportDebug.engine`), "worker"); });
  await sleep(1500);   // let the page's own start-up work (fonts, the Excel reader warm-up) finish before the quiet window starts
  const quietFrom = Date.now();

  console.log("records table, café sample (5,000 rows)");
  await check("the table exists, is 12 rows tall and holds every row", async () => {
    const m = await js(`(() => { const w = document.querySelector('.rec-win'), cs = getComputedStyle(w); return { h: w.clientHeight, sh: w.scrollHeight, resize: cs.resize, count: document.querySelector('[data-count]').textContent, drawn: document.querySelectorAll('.rec-tr').length, sticky: getComputedStyle(document.querySelector('.rec-thead')).position, first: getComputedStyle(document.querySelector('.rec-td.first')).position, rows: window.JAIReportDebug.store.rows.length } })()`);
    assert(Math.abs(m.h - (12 * 34 + 37)) <= 4, "window height " + m.h); assert.strictEqual(m.resize, "vertical"); assert.strictEqual(m.sticky, "sticky"); assert.strictEqual(m.first, "sticky");
    assert(m.sh > 5000 * 34, "scroll height " + m.sh); assert(m.drawn <= 24, "drawn " + m.drawn); assert(/Showing 5,000 of 5,000/.test(m.count), m.count); assert.strictEqual(m.rows, 5000);
    return `${m.drawn} rows drawn of ${m.rows}`;
  });
  await check("scrolling keeps frames inside the budget and only the visible rows are drawn (5,000 rows)", async () => {
    const m = await js(`(async () => { const w = document.querySelector('.rec-win'); const gaps = []; let last = performance.now(); let maxDrawn = 0;
      for (let i = 0; i < 150; i++) { w.scrollTop = (i * 241) % (w.scrollHeight - w.clientHeight); await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); gaps.push(n - last); last = n; maxDrawn = Math.max(maxDrawn, document.querySelectorAll('.rec-tr').length); }
      gaps.sort((a, b) => a - b); return { p50: gaps[75], p95: gaps[142], max: gaps[149], maxDrawn }; })()`);
    assert(m.p95 < 20, "p95 frame " + m.p95.toFixed(1) + " ms"); assert(m.maxDrawn <= 24, "drawn " + m.maxDrawn);
    return `frame p50 ${m.p50.toFixed(1)} ms, p95 ${m.p95.toFixed(1)} ms, max ${m.max.toFixed(1)} ms, at most ${m.maxDrawn} rows in the DOM`;
  });
  await check("header click cycles ascending, descending, off", async () => {
    const st = async () => js(`document.querySelector('.rec-thead [data-k="6"]').getAttribute('aria-sort')`);
    const click = () => js(`document.querySelector('.rec-thead [data-k="6"]').click()`);
    assert.strictEqual(await st(), "none"); await click(); assert.strictEqual(await st(), "ascending");
    const first = await js(`document.querySelector('.rec-tr .rec-td:nth-child(8)').textContent`); assert(parseFloat(first) <= 0.01 || first === "0.00" || parseFloat(first) < 2, "smallest total first: " + first);
    await click(); assert.strictEqual(await st(), "descending"); await click(); assert.strictEqual(await st(), "none");
  });
  await check("search matches any column and the breadcrumb shows it with Back to all", async () => {
    await js(`(() => { const q = document.querySelector('[data-q]'); q.value = 'Sunny'; q.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    const m = await js(`({ crumbs: document.querySelector('[data-crumbs]').textContent, count: document.querySelector('[data-count]').textContent })`);
    assert(/All records.*Search: “Sunny”.*Back to all/.test(m.crumbs), m.crumbs); assert(!/of 5,000/.test(m.count) || !/Showing 5,000/.test(m.count), m.count);
    await js(`document.querySelector('[data-crumbs] .rec-x').click()`); assert(/Showing 5,000 of 5,000/.test(await js(`document.querySelector('[data-count]').textContent`)));
  });
  await check("clicking a finding shows its rows; an advisory outlier cell is slate (Look) and carries its reason on focus", async () => {
    await js(`document.querySelector('[data-find="unit:unit_price"]').click()`);
    const m = await js(`(() => { const c = document.querySelector('.rec-td.look'); c.focus(); const tip = document.querySelector('.rec-tip'); return { count: document.querySelector('[data-count]').textContent, crumbs: document.querySelector('[data-crumbs]').textContent, cls: c.className, bg: getComputedStyle(c).backgroundColor, rule: getComputedStyle(c).boxShadow, tip: tip.textContent, op: getComputedStyle(tip).opacity }; })()`);
    assert(/Showing 12 of 5,000/.test(m.count), m.count); assert(/unit price/i.test(m.crumbs), m.crumbs);
    assert(/230, 234, 240/.test(m.bg), "slate tint (an outlier is advisory: Look) " + m.bg); assert(/47, 59, 75/.test(m.rule), "slate rule " + m.rule);
    assert(/\$115\.00 is 10x this item's usual \$11\.50\. Likely/.test(m.tip), m.tip);
    await sleep(250); assert.strictEqual(await js(`getComputedStyle(document.querySelector('.rec-tip')).opacity`), "1", "the reason is visible while the cell has focus");
  });
  await check("records worth a look: at most ten, click scrolls to and highlights the row", async () => {
    await js(`document.querySelector('[data-crumbs] .rec-x').click()`);
    const n = await js(`document.querySelectorAll('.sh-qa .worth .wrow').length`); assert(n >= 5 && n <= 7, n);
    const first = await js(`document.querySelector('.sh-qa .worth .wrow b').textContent`); assert(/unit_price/.test(first), first);
    await js(`document.querySelectorAll('.sh-qa .worth .wrow')[5].click()`); await sleep(400);
    const m = await js(`(() => { const h = document.querySelector('.rec-tr.hl'); const w = document.querySelector('.rec-win').getBoundingClientRect(), r = h && h.getBoundingClientRect(); return { found: !!h, inside: !!h && r.top >= w.top - 1 && r.bottom <= w.bottom + 1, text: h && h.textContent.slice(0, 40) }; })()`);
    assert(m.found && m.inside, JSON.stringify(m));
  });

  await check("the report has two sections, Insights then QA, each with a count, and each finding sits in one of them; the table filters to either", async () => {
    const m = await js(`(() => { const h = [...document.querySelectorAll('.sheet .sh-sec > h2')].map(e => e.firstChild.textContent.trim() + ' ' + e.querySelector('.sec-n').textContent); const lis = [...document.querySelectorAll('.sheet .finds li b')].map(e => e.textContent); return { h, dup: lis.length - new Set(lis).size, ins: document.querySelectorAll('.sh-insights .finds li').length, qa: document.querySelectorAll('.sh-qa .finds li').length }; })()`);
    assert.strictEqual(m.h.length, 2); assert(/^Insights \d+$/.test(m.h[0]) && /^QA \d+$/.test(m.h[1]), m.h.join()); assert.strictEqual(m.dup, 0, "a finding appears twice"); assert(m.qa >= 3, "qa findings " + m.qa);
    await js(`document.querySelector('[data-sec="qa"]').click()`); const c = await js(`document.querySelector('[data-crumbs]').textContent`); assert(/QA rows/.test(c), c);
    await js(`document.querySelector('[data-crumbs] .rec-x').click()`); return m.h.join(" / ");
  });

  await check("QA sample: 500 rows, flagged first; Show filters the table, Resample changes only the random part and the seed, the CSV has the issue and suggestion columns", async () => {
    const info = () => js(`(() => { const q = JAIReportDebug.analysis.qaSample; return { size: q.size, flagged: q.flagged, seed: q.seed, rows: q.rows.slice(), text: document.querySelector('.qa-sample').textContent }; })()`);
    const a = await info(); assert.strictEqual(a.size, 500); assert(/500 rows.*flagged.*random/.test(a.text), a.text.slice(0, 200));
    await js(`document.querySelector('[data-qs="show"]').click()`); assert(/Showing 500 of 5,000/.test(await js(`document.querySelector('[data-count]').textContent`))); await js(`document.querySelector('[data-crumbs] .rec-x').click()`);
    await js(`document.querySelector('[data-qs="resample"]').click()`); await waitFor(`JAIReportDebug.analysis.qaSample.seed !== ${a.seed}`); const b = await info(); assert.notStrictEqual(b.seed, a.seed); assert.deepStrictEqual(b.rows.slice(0, b.flagged), a.rows.slice(0, a.flagged)); assert.notDeepStrictEqual(b.rows.slice(b.flagged), a.rows.slice(a.flagged));
    await js(`(() => { window.__qs = null; const real = URL.createObjectURL.bind(URL); URL.createObjectURL = b => { window.__qs = b; return real(b); }; HTMLAnchorElement.prototype.click = function () { window.__qsName = this.download; }; })()`);
    await js(`document.querySelector('[data-qs="csv"]').click()`); const csv = await js(`window.__qs.text()`), name = await js(`window.__qsName`);
    const rows = R.parseDelimited(csv); assert.strictEqual(name, "QA sample.csv"); assert.strictEqual(rows.length, 501); assert.deepStrictEqual(rows[0].slice(-2), ["qa_issue", "qa_suggestion"]);
    return `seed ${a.seed} -> ${b.seed}`;
  });

  await check("the timeline is a stacked chart split by a small category; switching the split redraws it", async () => {
    const before = await js(`(() => { const svg = document.querySelector('.sh-trend svg.stack'); return svg ? svg.textContent : null; })()`); assert(before, "no stacked timeline");
    await js(`(() => { const sel = document.querySelector('[data-ch="split"]'); sel.value = 'payment'; sel.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor(`/Apple Pay/.test(document.querySelector('.sh-trend svg.stack').textContent)`);
    const after = await js(`document.querySelector('.sh-trend svg.stack').textContent`), head = await js(`document.querySelector('.sh-trend h3').textContent`);
    assert(/Apple Pay/.test(after) && after !== before, "legend after the switch: " + after.slice(-80)); assert(/split by payment/.test(head), head);
    await js(`(() => { const sel = document.querySelector('[data-ch="split"]'); sel.value = ''; sel.dispatchEvent(new Event('change', { bubbles: true })); })()`); await waitFor(`!!document.querySelector('.sh-trend svg.line') && !document.querySelector('.sh-trend svg.stack')`);
    await js(`(() => { const sel = document.querySelector('[data-ch="split"]'); sel.value = 'location'; sel.dispatchEvent(new Event('change', { bubbles: true })); })()`); await waitFor(`!!document.querySelector('.sh-trend svg.stack')`);
  });

  console.log("editing and export (CONS-0054)");
  await check("fix the twelve $115.00 prices with Enter: the finding disappears, '12 edits' shows, the location average drops", async () => {
    const before = await js(`document.querySelector('.grp [data-g="Sunny Isles Beach"] .grp-mean').textContent`);
    await js(`document.querySelector('[data-find="unit:unit_price"]').click()`);
    for (let i = 0; i < 12; i++) {
      await js(`(() => { const c = document.querySelector('.rec-td.look[data-c="5"]'); c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); })()`);
      await js(`(() => { const inp = document.querySelector('[data-edit]'); inp.value = '$11.50'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
    }
    // Changed on purpose (CONS-0051): the table is showing the finding's twelve rows, so the panels are worked out for those twelve rows and, once fixed, they have no finding at all.
    // The whole file's numbers are the base analysis, which is where the finding and the group's average are read from.
    await waitFor("document.querySelector('.rec-edits .n').textContent === '12 edits' && JAIReportDebug.pending === 0 && /Nothing jumped out/.test(document.querySelector('#rep-sheet').textContent) && !JAIReportDebug.base.findingsAll.some(f => f.id === 'unit:unit_price')");
    const m = await js(`(() => ({ n: document.querySelector('.rec-edits .n').textContent, finds: document.querySelector('#rep-sheet').textContent.includes('Nothing jumped out') ? 'none in the slice' : 'findings', edited: document.querySelectorAll('.rec-td.edited').length, tip: String(JAIReportDebug.base.grouping.rows.find(r => r.k === 'Sunny Isles Beach').mean) }))()`);
    assert.strictEqual(m.n, "12 edits"); assert.strictEqual(m.finds, "none in the slice"); assert(m.edited >= 12, "edited cells " + m.edited);
    const avg = t => +String(t).replace(/,/g, "");
    assert(avg(m.tip) < avg(before), `average ${avg(before)} -> ${avg(m.tip)}`);
    return `average ${avg(before)} -> ${avg(m.tip)}`;
  });
  await waitFor("JAIReportDebug.pending === 0");
  await check("Esc cancels an edit; Undo reverts one; text in a number column is refused", async () => {
    await js(`document.querySelector('[data-crumbs] .rec-x').click(); document.querySelector('.rec-win').scrollTop = 0`);
    await js(`document.querySelector('.rec-td[data-c="5"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
    await js(`(() => { const inp = document.querySelector('[data-edit]'); inp.value = '999'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); })()`);
    assert.strictEqual(await js(`document.querySelector('.rec-edits .n').textContent`), "12 edits");
    await js(`document.querySelector('.rec-td[data-c="5"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
    await js(`(() => { const inp = document.querySelector('[data-edit]'); inp.value = 'abc'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
    assert(await js(`!!document.querySelector('[data-edit]')`), "input should stay open on a bad number"); await js(`document.querySelector('[data-edit]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await js(`document.querySelector('[data-undo]').click()`); assert.strictEqual(await js(`document.querySelector('.rec-edits .n').textContent`), "11 edits");
    await waitFor(`!!document.querySelector('[data-find="unit:unit_price"]')`);
  });
  await waitFor("JAIReportDebug.pending === 0");
  await check("keyboard: Enter opens the editor on a focused cell, '$1,150.00' is kept as 1150.00, a quantity edit recomputes the total, Undo puts both back", async () => {
    await js(`document.querySelector('[data-crumbs] .rec-x') && document.querySelector('[data-crumbs] .rec-x').click(); document.querySelector('.rec-win').scrollTop = 0`);
    const before = await js(`JAIReportDebug.store.rows[0].slice()`), hdr = await js(`JAIReportDebug.store.names`), q = hdr.indexOf("qty"), t = hdr.indexOf("total"), pr = hdr.indexOf("unit_price");
    const n0 = +(await js(`document.querySelector('.rec-edits .n').textContent`)).split(" ")[0];
    const type = async (c, v) => { await js(`(() => { const cell = document.querySelector('.rec-tr [data-r="0"][data-c="${c}"]'); cell.focus(); cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
      assert(await js(`!!document.querySelector('[data-edit]')`), "Enter should open the editor on column " + c);
      await js(`(() => { const inp = document.querySelector('[data-edit]'); inp.value = ${JSON.stringify(v)}; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`); };
    await type(pr, "$1,150.00"); assert.strictEqual(await js(`JAIReportDebug.store.rows[0][${pr}]`), "1150.00");
    await js(`JAIReportDebug.store.edits.length`); const qty0 = +before[q], newQ = String(qty0 + 2); await type(q, newQ);
    const row = await js(`JAIReportDebug.store.rows[0].slice()`); assert.strictEqual(row[t], (Math.round((qty0 + 2) * 1150 * 100) / 100).toFixed(2), "total " + row[t]);
    assert.strictEqual(await js(`document.querySelector('.rec-edits .n').textContent`), `${n0 + 2} edits`);
    await js(`document.querySelector('[data-undo]').click(); document.querySelector('[data-undo]').click()`);
    assert.deepStrictEqual(await js(`JAIReportDebug.store.rows[0].slice()`), before); assert.strictEqual(await js(`document.querySelector('.rec-edits .n').textContent`), `${n0} edits`);
  });
  await check("Download hands the visitor the corrected CSV and the change log as files, made here (no network)", async () => {
    await js(`(() => { window.__dl = []; const real = URL.createObjectURL.bind(URL); URL.createObjectURL = b => { window.__dl.push(b); return real(b); }; HTMLAnchorElement.prototype.click = function () { window.__names = (window.__names || []).concat(this.download); }; })()`);
    await js(`document.querySelector('[data-export]').click()`);
    await js(`document.querySelector('[data-dl]').click()`); await js(`document.querySelector('[data-tab="log"]').click()`); await js(`document.querySelector('[data-dl]').click()`);
    const m = await js(`(async () => ({ names: window.__names, texts: await Promise.all(window.__dl.map(b => b.text())), csv: JAIRecords.exportCSV(JAIReportDebug.store), log: JAIRecords.changeLogCSV(JAIReportDebug.store) }))()`);
    await js(`document.querySelector('[data-close]').click()`);
    assert.deepStrictEqual(m.names, ["cafe-sales-sample-corrected.csv", "cafe-sales-sample-change-log.csv"]); assert.strictEqual(m.texts[0], m.csv); assert.strictEqual(m.texts[1], m.log);
  });
  await waitFor("JAIReportDebug.pending === 0");
  await check("export: the corrected CSV re-imports equal to the table, the change log has the edits", async () => {
    await js(`document.querySelector('[data-export]').click()`);
    const m = await js(`({ shown: !document.querySelector('[data-modal]').hidden, csv: JAIRecords.exportCSV(JAIReportDebug.store), log: JAIRecords.changeLogCSV(JAIReportDebug.store), rows: JAIReportDebug.store.rows })`);
    assert(m.shown); const again = R.parseDelimited(m.csv); assert.strictEqual(again.length, 5001);
    again.slice(1).forEach((row, i) => assert.deepStrictEqual(row, m.rows[i], "row " + i));
    const log = R.parseDelimited(m.log); assert.deepStrictEqual(log[0], ["row", "column", "before", "after", "edited_at"]); assert(log.length >= 12, "log lines " + log.length);
    assert(log.slice(1).every(l => l.length === 5 && /^\d{4}-\d\d-\d\dT/.test(l[4])), "log shape"); await js(`document.querySelector('[data-close]').click()`);
  });
  await waitFor("JAIReportDebug.pending === 0");
  await check("print hides the table and keeps at most five records worth a look", async () => {
    await send("Emulation.setEmulatedMedia", { media: "print" });
    const m = await js(`({ rec: getComputedStyle(document.querySelector('.records')).display, sixth: getComputedStyle(document.querySelectorAll('.sh-qa .worth li')[5]).display, fifth: getComputedStyle(document.querySelectorAll('.sh-qa .worth li')[4]).display, controls: getComputedStyle(document.querySelector('.report-controls')).display, note: getComputedStyle(document.querySelector('.edit-note')).display, note_txt: document.querySelector('.edit-note').textContent })`);
    await send("Emulation.setEmulatedMedia", { media: "" });
    assert.strictEqual(m.rec, "none"); assert.strictEqual(m.sixth, "none"); assert.notStrictEqual(m.fifth, "none"); assert.strictEqual(m.controls, "none"); assert.notStrictEqual(m.note, "none"); assert(/^\d+ cells corrected in this browser session \(11 edits, counting totals worked out again\); the findings/.test(m.note_txt), m.note_txt);   // CONS-0055: the footnote says how many cells were corrected
  });
  await waitFor("JAIReportDebug.pending === 0");
  await check("records worth a look prints as part of the one page: the printed report is a single page and the list holds at most five records", async () => {
    const pdf = await send("Page.printToPDF", { preferCSSPageSize: true, printBackground: true }), txt = Buffer.from(pdf.data, "base64").toString("latin1");
    const pages = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length; const dbg = await js(`(() => { const sh = document.querySelector('.sheet'); return { pz: sh.style.getPropertyValue('--pz'), pw: sh.dataset.pw, ph: sh.dataset.ph, h: sh.offsetHeight, fit: JAIReportDebug.fitLog.join(' ') }; })()`); assert.strictEqual(pages, 1, "printed pages: " + pages + " " + JSON.stringify(dbg));
    const f = await js(`(() => { const sh = document.querySelector('.sheet'); return { z: sh.style.getPropertyValue('--pz'), rows: sh.dataset.pw || '5', health: !sh.dataset.ph, drop: sh.dataset.ph || '0' } })()`);
    assert(+f.rows >= 3, "worth-a-look rows kept in print: " + f.rows + " " + (await js(`JAIReportDebug.fitLog.join(" ")`)));
    return `1 printed page at zoom ${f.z}, ${f.rows} worth-a-look rows, print detail level ${f.drop} (0 = everything kept)`;
  });
  await check("nothing leaves the browser: no request while working, none that is a POST or PUT, ever", async () => {
    // a web font the page's own stylesheet asks for the first time a glyph style is drawn is a plain GET for a public file, carrying nothing of the visitor's
    const quiet = requests.filter(r => r.t >= quietFrom && !r.url.startsWith("data:") && !r.url.startsWith("blob:") && !(r.method === "GET" && /^https:\/\/fonts\.(gstatic|googleapis)\.com\//.test(r.url)));
    assert.strictEqual(quiet.length, 0, "requests during use: " + quiet.map(r => r.method + " " + r.url).join(", "));
    const writes = requests.filter(r => r.method !== "GET"); assert.strictEqual(writes.length, 0, "non-GET requests: " + writes.map(r => r.method + " " + r.url).join(", "));
    return `${requests.length} requests in total, the page start-up and public font files only; nothing else, no POST or PUT`;
  });

  await check("rule pack: none by default; loading one names it on the page and marks its findings; it can also be fetched with ?pack= from a served page", async () => {
    assert.strictEqual(await js(`document.querySelector('#pack-name').textContent`), "none"); assert.strictEqual(await js(`JAIReportDebug.pack`), null);
    const pack = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../packs/real-estate.json"), "utf8"));
    await js(`JAIReportDebug.usePack(${JSON.stringify(pack)})`); await waitFor(`/rule pack: Real estate/.test(document.querySelector('.sh-meta').textContent)`);
    const m = await js(`({ name: document.querySelector('#pack-name').textContent, meta: document.querySelector('.sh-meta').textContent, tags: [...document.querySelectorAll('.sheet .finds li b')].map(e => e.textContent), skipped: JAIReportDebug.analysis.pack.skipped.length })`);
    assert(/Real estate/.test(m.name) && /rule pack: Real estate/.test(m.meta), JSON.stringify(m)); assert.strictEqual(m.skipped, 4, "the café file has no area, beds, baths or address columns for four of the six checks");
    return `pack named: ${m.name}`;
  });

  console.log("10,000 rows x 12 columns (CONS-0043)");
  tmpCsv = path.join(os.tmpdir(), `jai-10k-${process.pid}.csv`);
  const rows10 = R.cafeSample(10000).map((r, i) => [...r, "n" + (i % 7), "c" + (i % 3), String(i * 3 % 101), i % 5 ? "" : "note, with a comma"]); rows10[0].splice(8, 4, "extra_a", "extra_b", "extra_c", "extra_d");
  fs.writeFileSync(tmpCsv, Rec.rowsToCSV(rows10, { delim: ",", eol: "\n" }));
  const memMB = () => { if (process.platform !== "win32") return null; try { const o = cp.spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$ids = (Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${profile.replace(/'/g, "''")}*' }).ProcessId; (Get-Process -Id $ids -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum / 1MB`], { encoding: "utf8", windowsHide: true }); return Math.round(parseFloat(o.stdout)); } catch (e) { return null; } };
  async function loadBig(label, throttle) {
    await send("Page.navigate", { url: BASE + "/report.html" }); await waitFor("document.readyState === 'complete' && !!window.JAIReportDebug && JAIReportDebug.engine === 'worker'");
    await js(`JAIReportDebug.setLimits(10000, 12); window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(Math.round(e.duration)))).observe({ entryTypes: ['longtask'] }); } catch (e) {}`);
    if (throttle) await send("Emulation.setCPUThrottlingRate", { rate: throttle });
    const before = memMB(), doc = await send("DOM.getDocument"), inp = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#report-file" });
    const t0 = Date.now(); await send("DOM.setFileInputFiles", { files: [tmpCsv], nodeId: inp.nodeId });
    await waitFor("!!JAIReportDebug.store && JAIReportDebug.store.rows.length === 10000 && document.querySelectorAll('.rec-tr').length > 0", 60000);
    const ms = Date.now() - t0; if (throttle) await send("Emulation.setCPUThrottlingRate", { rate: 1 });
    const lt = await js(`window.__lt.slice()`), after = memMB(), cols = await js(`JAIReportDebug.analysis.cols.length`), heap = (await send("Runtime.getHeapUsage")).usedSize / 1048576;
    return { ms, longest: Math.max(0, ...lt), nLong: lt.length, before, after, cols, heap };
  }
  let big = null;
  await check("10,000 x 12 renders in a worker: under 3 s on this computer, main thread free, memory under 300 MB", async () => {
    big = await loadBig("desktop", 0); assert.strictEqual(big.cols, 12); assert(big.ms < 3000, big.ms + " ms");
    assert(big.longest < 150, `the page's main thread was blocked for ${big.longest} ms`);
    const delta = big.after != null && big.before != null ? big.after - big.before : null; if (delta != null) assert(delta < 300, "memory grew " + delta + " MB"); assert(big.heap < 300, big.heap.toFixed(0) + " MB heap");
    return `${big.ms} ms from file chosen to table drawn, longest main-thread task ${big.longest} ms (${big.nLong} long tasks), JS heap ${big.heap.toFixed(0)} MB${big.after != null ? `, browser memory ${big.before} -> ${big.after} MB` : ""}`;
  });
  await check("10,000 x 12 with the CPU slowed 4x (a stand-in for a mid-range phone, not a phone): under 8 s", async () => {
    const t = await loadBig("slow", 4); assert(t.ms < 8000, t.ms + " ms"); return `${t.ms} ms at 4x CPU slowdown, longest main-thread task ${t.longest} ms`;
  });
  await send("Page.navigate", { url: BASE + "/report.html" }); await waitFor("document.readyState === 'complete' && !!window.JAIReportDebug && JAIReportDebug.engine === 'worker'");
  await js(`JAIReportDebug.setLimits(10000, 12)`);
  {   const doc = await send("DOM.getDocument"), inp = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#report-file" }); await send("DOM.setFileInputFiles", { files: [tmpCsv], nodeId: inp.nodeId });
      await waitFor("!!JAIReportDebug.store && JAIReportDebug.store.rows.length === 10000 && document.querySelectorAll('.rec-tr').length > 0", 60000); }
  await check("10,000 rows scroll without dropped frames", async () => {
    const m = await js(`(async () => { const w = document.querySelector('.rec-win'); const gaps = []; let last = performance.now(), maxDrawn = 0;
      for (let i = 0; i < 200; i++) { w.scrollTop = (i * 1733) % (w.scrollHeight - w.clientHeight); await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); gaps.push(n - last); last = n; maxDrawn = Math.max(maxDrawn, document.querySelectorAll('.rec-tr').length); }
      gaps.sort((a, b) => a - b); return { p50: gaps[100], p95: gaps[190], max: gaps[199], maxDrawn, height: w.scrollHeight }; })()`);
    assert(m.height >= 10000 * 34); assert(m.p95 < 20, "p95 " + m.p95.toFixed(1)); assert(m.maxDrawn <= 24);
    return `frame p50 ${m.p50.toFixed(1)} ms, p95 ${m.p95.toFixed(1)} ms, max ${m.max.toFixed(1)} ms`;
  });

  await check("phone width (390 px): the page does not scroll sideways; the table scrolls inside its window with the header and Row column staying put", async () => {
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 800, deviceScaleFactor: 2, mobile: true }); await sleep(400);
    const m = await js(`(() => { const w = document.querySelector('.rec-win'), r = w.getBoundingClientRect(); return { page: document.documentElement.scrollWidth, view: innerWidth, win: Math.round(r.width), inner: w.scrollWidth, left: r.left, right: r.right } })()`);
    const st = await js(`(async () => { const w = document.querySelector('.rec-win'); w.scrollTop = 40 * 34; w.scrollLeft = 220; await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r));
      const wb = w.getBoundingClientRect(), f = document.querySelector('.rec-td.first').getBoundingClientRect(), h = document.querySelector('.rec-thead').getBoundingClientRect(); return { dx: Math.abs(f.left - wb.left), dy: Math.abs(h.top - wb.top), sl: w.scrollLeft, st: w.scrollTop }; })()`);
    assert(st.sl > 0 && st.st > 0, JSON.stringify(st)); assert(st.dx <= 2, "Row column moved " + st.dx); assert(st.dy <= 2, "header moved " + st.dy);
    await send("Emulation.clearDeviceMetricsOverride");
    assert(m.page <= m.view + 1, "page is " + m.page + " wide in a " + m.view + " viewport"); assert(m.right <= m.view + 1 && m.left >= -1, "window leaves the screen: " + JSON.stringify(m)); assert(m.inner > m.win, "table scrolls inside its window");
    return `window ${m.win} px wide, table ${m.inner} px`;
  });

  console.log("round 3: headers, roles, ledgers, names, the insight gate (CONS-0070 to 0074)");
  const FXDIR = path.resolve(__dirname, "fixtures");   // read only; the fixtures are made up
  async function loadFx(name) {
    await send("Page.navigate", { url: BASE + "/report.html" }); await waitFor("document.readyState === 'complete' && !!window.JAIReportDebug && JAIReportDebug.engine === 'worker'");
    const doc = await send("DOM.getDocument"), inp = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#report-file" }); await send("DOM.setFileInputFiles", { files: [path.isAbsolute(name) ? name : path.join(FXDIR, name)], nodeId: inp.nodeId });
    await waitFor("!!JAIReportDebug.store && JAIReportDebug.store.rows.length > 0 && document.querySelectorAll('.rec-tr').length > 0", 30000);
  }
  const pick = async (sel, value) => { await js(`(() => { const s = document.querySelector('${sel}'); s.value = '${value}'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); };
  await check("a file with no header row says so, names its columns by role, and the First row switch flips it and back", async () => {
    await loadFx("ledger_headerless.csv");
    const m = await js(`({ note: document.querySelector('.hdr-note').textContent, names: JAIReportDebug.analysis.header.join('|'), n: JAIReportDebug.store.rows.length, sel: document.querySelector('[data-ch="header"]').value, first: document.querySelector('.rec-tr .rec-td:nth-child(2)').textContent })`);
    assert(/No header row detected/.test(m.note) && /names below are ours/.test(m.note), m.note); assert.strictEqual(m.names, "Type|Date|Description|Amount|Column 5|Balance|Column 7|Column 8"); assert.strictEqual(m.sel, "data");
    const n0 = m.n; await pick('[data-ch="header"]', "header"); await waitFor(`JAIReportDebug.store.rows.length === ${n0 - 1}`);
    const f = await js(`({ note: document.querySelector('.hdr-note').textContent, names: JAIReportDebug.analysis.header.join('|'), sel: document.querySelector('[data-ch="header"]').value })`);
    assert(/^.{0,3}Header: The first row is read as the header/.test(f.note) && f.sel === "header", f.note); assert.notStrictEqual(f.names, m.names);
    await pick('[data-ch="header"]', "data"); await waitFor(`JAIReportDebug.store.rows.length === ${n0}`); assert.strictEqual(await js(`JAIReportDebug.analysis.header.join('|')`), m.names);
    return `${n0} rows; flipped to ${n0 - 1} and back`;
  });
  await check("a title row above the header is skipped and said so; row numbers in the table are the file's own", async () => {
    await loadFx("ledger_title.csv");
    const m = await js(`({ note: document.querySelector('.hdr-note').textContent, names: JAIReportDebug.analysis.header.slice(0, 4).join('|'), row: document.querySelector('.rec-tr .rec-td.first').textContent })`);
    assert(/1 title row above it skipped/.test(m.note) && /Synthetic checking activity/.test(m.note), m.note); assert.strictEqual(m.names, "Details|Posting Date|Description|Amount"); assert.strictEqual(m.row, "3");
  });

  await check("sales fixture: year built is a year, no line mentions price per year built, and a role changed in the Columns table recomputes the report", async () => {
    await loadFx("sales_roles.csv");
    const m = await js(`({ sheet: (() => { const c = document.querySelector('.sheet').cloneNode(true); c.querySelectorAll('details.not-shown').forEach(e => e.remove()); return c.textContent; })(), roles: JAIReportDebug.analysis.cols.map(c => c.name + ':' + c.role).join('|'), sel: document.querySelector('[data-role="Year built"]').selectedOptions[0].textContent })`);
    assert(/Year built:year/.test(m.roles) && /Zip:postal/.test(m.roles) && /year \(not a quantity\)/.test(m.sel), m.roles + " | " + m.sel); assert(!/per year built|per zip|year built.{0,6}(highest|lowest)/i.test(m.sheet), "a ratio on year built is still on the page (outside Not shown)");
    assert(/price per square foot/.test(m.sheet), "the area ratio is missing");
    await pick('[data-role="Beds"]', "identifier"); await waitFor(`JAIReportDebug.analysis.cols.find(c => c.name === 'Beds').role === 'identifier'`);
    const after = await js(`({ role: document.querySelector('[data-role="Beds"]').value, by: JAIReportDebug.analysis.cols.find(c => c.name === 'Beds').roleBy })`); assert.deepStrictEqual(after, { role: "identifier", by: "you" });
    return "Beds set to identifier by the picker; the page recomputed";
  });

  await check("the header tile reads Rows, the money total carries its sign, and 'Not shown' is collapsed and explains what the gate held back", async () => {
    await loadFx("sales_roles.csv");
    const m = await js(`(() => { const k = [...document.querySelectorAll('.sh-kpis > div')].map(d => d.querySelector('.label').textContent + '=' + d.querySelector('b').textContent); const d = document.querySelector('details.not-shown');
      return { k, open: d && d.open, summary: d && d.querySelector('summary').textContent, text: d && d.textContent, sections: [...document.querySelectorAll('.sheet .sh-sec > h2')].length }; })()`);
    assert.strictEqual(m.k[0], "Rows=1,200"); assert(/^Total Sale price=\$/.test(m.k[3]), m.k.join()); assert(!m.k.some(x => /sales \(#\)/i.test(x)), m.k.join());
    assert.strictEqual(m.open, false); assert(/^Not shown \(\d+\)$/.test(m.summary), m.summary); assert(/Year built is a year, not a quantity/.test(m.text) && /Zip is a postal code/.test(m.text), m.text.slice(0, 300));
    await js(`document.querySelector('details.not-shown summary').click()`); assert.strictEqual(await js(`document.querySelector('details.not-shown').open`), true);
    return m.summary;
  });

  await check("ledger: the header says transactions; tiles read Money out and Money in; recurring charges, the one duplicate and the FYIs show; the sales rules are listed as not run", async () => {
    await loadFx("ledger_header.csv");
    const m = await js(`({ meta: document.querySelector('.sh-meta').textContent, tiles: [...document.querySelectorAll('.sh-kpis > div')].map(d => d.querySelector('.label').textContent + '=' + d.querySelector('b').textContent), ins: [...document.querySelectorAll('.sh-insights .finds li b')].map(e => e.textContent), qa: [...document.querySelectorAll('.sh-qa .finds li b')].map(e => e.textContent), fyi: [...document.querySelectorAll('.sh-fyi .finds li b')].map(e => e.textContent), off: (document.querySelector('.sh-qa .not-checked + .not-checked, .sh-qa .not-checked') || {}).textContent, measureCtl: !!document.querySelector('[data-ch="measure"]'), bars: document.querySelectorAll('.sh-insights svg.bars .pick').length })`);
    assert(/kind: transactions/.test(m.meta), m.meta); assert.deepStrictEqual(m.tiles.map(t => t.split("=")[0]), ["Rows", "Dates", "Money out", "Money in"]);
    assert(m.ins.some(t => /^2 recurring charges/.test(t)) && m.ins.some(t => /^Money out runs from/.test(t)) && m.ins.some(t => /biggest merchant/.test(t)), m.ins.join(" | "));
    assert(m.qa.some(t => /1 duplicate row$/.test(t)) && !m.qa.some(t => /nominal|months old|negative/i.test(t)), m.qa.join(" | ")); assert(m.fyi.some(t => /^The export ends on Nov 19, 2018/.test(t)) && m.fyi.some(t => /refunded the same day/.test(t)), m.fyi.join(" | "));
    assert(/Not run on a ledger, by design/.test(await js(`document.querySelector('.sh-qa').textContent`))); assert.strictEqual(m.measureCtl, false); assert.strictEqual(m.bars, 0);
    return `${m.ins.length} insights, ${m.qa.length} QA, ${m.fyi.length} FYI`;
  });

  await check("names: Kroger once with its variants, 'written more than one way' is an FYI with a Merge button; Merge rewrites the cells as edits, the FYI goes away and the totals do not move", async () => {
    await loadFx("ledger_header.csv");
    const m = await js(`({ bars: [...document.querySelectorAll('.sh-insights svg.bars text.bl')].map(t => t.textContent), fyi: [...document.querySelectorAll('.sh-fyi .finds li')].map(l => l.textContent), merge: !!document.querySelector('[data-merge="variant"]'), out: document.querySelector('.sh-kpis div:nth-child(3) b').textContent })`);
    assert(m.bars.includes("Kroger") && m.bars.filter(b => /kroger/i.test(b)).length === 1, m.bars.join()); assert(m.merge && m.fyi.some(t => /written more than one way/.test(t) && /Merge \d+ spellings/.test(t)), m.fyi.join(" | "));
    await js(`document.querySelector('[data-merge="variant"]').click()`); await waitFor(`!document.querySelector('[data-merge="variant"]') && JAIReportDebug.store.edits.length > 20`);
    const a = await js(`({ edits: JAIReportDebug.store.edits.length, cells: [...new Set(JAIReportDebug.store.rows.map(r => r[2]))].filter(v => /^NETFLIX\.COM$|^KROGER \d/.test(v)).length, out: document.querySelector('.sh-kpis div:nth-child(3) b').textContent, status: document.querySelector('#report-status').textContent })`);
    assert.strictEqual(a.cells, 0); assert.strictEqual(a.out, m.out); assert(/^Merged \d+ cells? in Description/.test(a.status), a.status);
    return `${a.edits} cells merged; money out ${a.out} before and after`;
  });

  console.log("round 4: site and report fixes (CONS-0076, JEBYUS-0058, CONS-0042 to 0056)");
  await check("CONS-0076: the rate label and the $95 numeral do not touch at 1440, 1024 and 390 px, on Home and on Approach; the fact tiles do not overlap either", async () => {
    const out = [];
    for (const [w, h, mobile] of [[1440, 900, false], [1024, 800, false], [390, 800, true]]) {
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
      for (const pg of ["index.html", "approach.html"]) {
        await send("Page.navigate", { url: BASE + "/" + pg }); await waitFor("document.readyState === 'complete'"); await sleep(250);
        const m = await js(`(async () => { await document.fonts.ready; const rate = document.querySelector('.bigrate'); const lab = rate.querySelector('.label').getBoundingClientRect(), b = rate.querySelector('b'), cs = getComputedStyle(b);
          const probe = document.createElement('span'); probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; b.insertBefore(probe, b.firstChild); const base = probe.getBoundingClientRect().bottom; probe.remove();
          const c = document.createElement('canvas').getContext('2d'); c.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; const ink = c.measureText(b.firstChild.textContent.trim()), inkTop = base - ink.actualBoundingBoxAscent;   // where the tallest mark of the numeral really starts, not its line box
          const tiles = [...document.querySelectorAll('.facts > div')].flatMap(d => [...d.children].map(c => c.getBoundingClientRect())); let tileOverlap = 0; for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) { const a = tiles[i], c2 = tiles[j]; if (a.left < c2.right - .5 && c2.left < a.right - .5 && a.top < c2.bottom - .5 && c2.top < a.bottom - .5) tileOverlap++; }
          return { labBottom: lab.bottom, numTop: inkTop, font: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).join('/'), tileOverlap, page: document.documentElement.scrollWidth, view: innerWidth }; })()`);
        assert(m.labBottom <= m.numTop + 0.01, `${pg} at ${w}: the label ends at ${m.labBottom.toFixed(1)} but the numeral starts at ${m.numTop.toFixed(1)}`);
        assert.strictEqual(m.tileOverlap, 0, `${pg} at ${w}: fact tiles overlap`); assert(m.page <= m.view + 1, `${pg} at ${w}: page scrolls sideways`);
        out.push(`${pg}@${w} gap ${(m.numTop - m.labBottom).toFixed(1)}${/Newsreader/.test(m.font) ? "" : " (web font not loaded)"}`);
      }
    }
    await send("Emulation.clearDeviceMetricsOverride"); return out.join(", ");
  });

  await check("CONS-0042: every report ends with How to supplement your data: at least three free and two paid sources, each a link that opens in a new tab, chosen by shape; it is not printed", async () => {
    const out = [];
    for (const [fx, want, not] of [["venues.csv", /OpenStreetMap/, /NOAA/], ["sales_clean.csv", /NOAA/, /retail trade/], ["ledger_header.csv", /retail trade/, /OpenStreetMap/], ["numeric_header.csv", /Data\.gov/, /OpenStreetMap|NOAA|Consumer Price/]]) {
      await loadFx(fx);
      const m = await js(`(() => { const s = document.querySelector('.sheet .sh-supp'), secs = [...document.querySelectorAll('.sheet > section')], items = [...s.querySelectorAll('.supp-list li')];
        return { last: secs[secs.length - 1] === s, h: s.querySelector('h2').textContent, free: items.filter(l => l.querySelector('.chip.free')).length, paid: items.filter(l => l.querySelector('.chip.paid')).length, open: items.filter(l => l.querySelector('.chip.open')).length, licensed: items.filter(l => l.querySelector('.chip.licensed')).length,
          links: items.every(l => { const a = l.querySelector('a'); return a && /^https:/.test(a.href) && a.target === '_blank' && /noopener/.test(a.rel); }), text: s.textContent, printHidden: s.classList.contains('print-hide') }; })()`);
      assert(m.last && m.h === "How to supplement your data", fx + ": the section is not the last one"); assert(m.free >= 3 && m.paid >= 2, `${fx}: ${m.free} free, ${m.paid} paid`); assert(m.links, fx + ": links must open in a new tab");
      assert(m.open + m.licensed === m.free + m.paid && m.licensed >= 2, fx + ": every source is marked open or licensed"); assert(want.test(m.text) && !not.test(m.text), fx + ": sources do not follow the shape"); assert(m.printHidden, "the section must not print");
      await send("Emulation.setEmulatedMedia", { media: "print" }); const shown = await js(`getComputedStyle(document.querySelector('.sh-supp')).display`); await send("Emulation.setEmulatedMedia", { media: "" }); assert.strictEqual(shown, "none", "hidden in print");
      out.push(`${fx}: ${m.free} free, ${m.paid} paid`);
    }
    return out.join("; ");
  });

  await check("CONS-0045: td_linxID is screened out before any statistics with its reason and a choice; the table and export are built without it; confirming brings it back and the footer records it; a never-process column has no button", async () => {
    await loadFx("venues.csv");
    const m = await js(`(() => ({ panel: document.querySelector('.sh-screen') && document.querySelector('.sh-screen').textContent, btn: [...document.querySelectorAll('.sh-screen [data-confirm]')].map(b => b.dataset.confirm), heads: [...document.querySelectorAll('.rec-thead .rec-th, .rec-thead button')].map(x => x.textContent).join('|'), cols: JAIReportDebug.analysis.header.length, rowLen: JAIReportDebug.store.rows[0].length, note: document.querySelector('.screen-note').textContent, kpiCols: [...document.querySelectorAll('.sh-kpis > div')].map(d => d.textContent).join('|'), printHidden: document.querySelector('.sh-screen').classList.contains('print-hide'), tablehas: JSON.stringify(JAIReportDebug.store.rows.slice(0, 50)).includes('LX7') }))()`);
    assert(m.panel && /td_linxID/.test(m.panel) && /Licensed identifier/.test(m.panel) && /licen[cs]e/i.test(m.panel) && /nothing leaves this browser/.test(m.panel), m.panel); assert.deepStrictEqual(m.btn, ["td_linxID"]);
    assert.strictEqual(m.cols, 11); assert.strictEqual(m.rowLen, 11); assert(!m.tablehas, "no flagged value in the table"); assert(/Left out before any statistics: td_linxID \(licensed identifier\)/.test(m.note), m.note); assert(m.printHidden, "the panel does not print; the footer line does");
    await js(`document.querySelector('[data-confirm="td_linxID"]').click()`); await waitFor(`JAIReportDebug.analysis.header.length === 12 && JAIReportDebug.store.rows[0].length === 12 && !JAIReportDebug.analysis.screen.excluded.length`);
    const k = await js(`({ note: document.querySelector('.screen-note').textContent, panel: document.querySelector('.sh-screen').textContent, btn: document.querySelectorAll('.sh-screen [data-confirm]').length, status: document.querySelector('#report-status').textContent })`);
    assert(/Kept on the visitor's confirmation that they hold the rights, recorded .*td_linxID \(licensed identifier\)/.test(k.note), k.note); assert(/Included/.test(k.panel) && k.btn === 0, k.panel); assert(/td_linxID is included on your confirmation/.test(k.status), k.status);
    tmpScreen = path.join(os.tmpdir(), `jai-screen-${process.pid}.csv`); fs.writeFileSync(tmpScreen, "name,ssn,age,city\n" + Array.from({ length: 40 }, (_, i) => `Cafe ${i},${100 + i}-45-${1000 + i},${30 + i},Miami`).join("\n") + "\n");
    await loadFx(tmpScreen);
    const n = await js(`({ items: [...document.querySelectorAll('.sh-screen .scr-list li')].map(l => l.dataset.col + ':' + (l.querySelector('[data-confirm]') ? 'button' : 'none') + ':' + l.textContent.includes('Never processed')), cols: JAIReportDebug.analysis.header.join('|') })`);
    assert.deepStrictEqual(n.items, ["ssn:none:true"]); assert.strictEqual(n.cols, "name|age|city");
    return "venues: 11 of 12 columns, confirm brings it back, ssn has no button; nothing was requested from the network (checked by the quiet-window test)";
  });

  await check("CONS-0041: group by two columns without a reload: nested rows with shares, Top N with Other, count distinct and a second measure are offered; clicking a nested row filters the table; the report still prints on one page", async () => {
    await loadFx("venues.csv");
    await pick('[data-ch="cat"]', "city"); await waitFor(`document.querySelectorAll('.grp-parent').length === 5`); await pick('[data-ch="cat2"]', "category"); await waitFor(`document.querySelectorAll('.grp-child').length > 5`);
    const m = await js(`(() => ({ head: document.querySelector('table.grp thead').textContent, parents: [...document.querySelectorAll('.grp-parent')].map(r => r.querySelector('.grp-name').textContent), kids: document.querySelectorAll('.grp-child').length, share: document.querySelector('.grp-parent .grp-share').textContent, within: document.querySelector('.grp-child .grp-within').textContent, ctl: ['cat2', 'topN'].map(k => !!document.querySelector('[data-ch="' + k + '"]')), pending: JAIReportDebug.pending }))()`);
    assert(/then category/.test(m.head) && /Share of total/.test(m.head) && /Of group/.test(m.head), m.head); assert(/%$/.test(m.share) && /%$/.test(m.within), m.share + " " + m.within); assert(m.ctl.every(Boolean), "controls");
    await js(`document.querySelector('.grp-child[data-g2]').click()`); await waitFor(`/·/.test(document.querySelector('[data-crumbs]').textContent)`);
    const crumb = await js(`document.querySelector('[data-crumbs]').textContent`); await js(`document.querySelector('[data-crumbs] .rec-x').click()`);
    const pdf = await send("Page.printToPDF", { preferCSSPageSize: true, printBackground: true }), txt = Buffer.from(pdf.data, "base64").toString("latin1"), pages = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length;
    assert.strictEqual(pages, 1, "the nested grouping must still print on one page, got " + pages);
    await pick('[data-ch="topN"]', "3"); await waitFor(`document.querySelectorAll('.grp-parent').length === 4`);
    const t = await js(`({ other: document.querySelector('.grp-parent.other .grp-name').textContent, hint: document.querySelector('.sh-insights h3 .hint, .grp-wrap').parentElement.textContent.slice(0, 120) })`); assert(/^Other \(2\)$/.test(t.other), t.other);
    await loadFx("sales_roles.csv");
    const c = await js(`({ distinct: [...document.querySelectorAll('[data-ch="measure"] optgroup option')].length, m2: !!document.querySelector('[data-ch="measure2"]') })`); assert(c.distinct >= 2 && c.m2, JSON.stringify(c));
    await pick('[data-ch="measure"]', "distinct:" + (await js(`document.querySelector('[data-ch="measure"] optgroup option').value.slice(9)`))); await waitFor(`/Distinct counts do not add up/.test(document.querySelector('.sh-insights').textContent)`);
    return `nested by city then category, ${m.kids} child rows, crumb "${crumb.slice(0, 40)}", printed on ${pages} page, Top 3 gives ${t.other}, ${c.distinct} columns offered for count distinct`;
  });

  await check("CONS-0047: Worth a look is five items and the last block of Insights; Search news shows its query on focus or hover, opens a new tab only when pressed, and nothing is requested before that", async () => {
    await loadFx("venues.csv"); const reqBefore = requests.length;
    const m = await js(`(() => { const blocks = [...document.querySelectorAll('.sh-insights > section, .sh-insights > details')], last = blocks[blocks.length - 1], items = [...document.querySelectorAll('.sh-worth.news .worth li')];
      return { lastIsWorth: !!last && last.classList.contains('sh-worth'), n: items.length, btns: document.querySelectorAll('.sh-worth.news [data-news]').length, seed: (document.querySelector('.seedtag') || {}).textContent, toggle: !!document.querySelector('.pickby'), info: document.querySelector('.news-info').textContent, q: items[0].querySelector('.news-tip code').textContent, title: items[0].querySelector('b').textContent }; })()`);
    assert(m.lastIsWorth, "Worth a look must be the last block of Insights"); assert.strictEqual(m.n, 5); assert.strictEqual(m.btns, 5); assert(/^seed \d+$/.test(m.seed), m.seed); assert(!m.toggle, "venues has no measure, so no Picked by choice");
    assert(/Searches only start when you press a button/.test(m.info), m.info); assert(/^".+" ".+" .+$/.test(m.q), m.q);
    await js(`document.querySelector('[data-news]').focus()`); const tip = await js(`(() => { const t = document.querySelector('.news-tip'); return { d: getComputedStyle(t).display, text: t.textContent }; })()`);
    assert.strictEqual(tip.d, "block", "the query is shown on focus (and on hover)"); assert(tip.text.includes(m.q) && /Never used: owner, phone, email or any amount/.test(tip.text) && /Nothing is sent until you click/.test(tip.text), tip.text);
    assert.strictEqual(requests.slice(reqBefore).filter(r => /news\.google|google\./.test(r.url)).length, 0, "no request to a news site before a click");
    await js(`window.__opens = []; window.open = (u, t, f) => { window.__opens.push([u, t, f]); return null; }; document.querySelector('[data-news]').click()`);
    const o = await js(`({ opens: window.__opens, label: document.querySelector('button.news.done').textContent, done: document.querySelector('.news-done').textContent, status: document.querySelector('#report-status').textContent })`);
    assert.strictEqual(o.opens.length, 1); assert(o.opens[0][0].startsWith("https://news.google.com/search?q=") && decodeURIComponent(o.opens[0][0].split("q=")[1]) === m.q, o.opens[0][0]); assert(/_blank/.test(o.opens[0][1]) && /noopener/.test(o.opens[0][2]));
    assert(/^Searched/.test(o.label) && /Opened Google News in a new tab at/.test(o.done), o.label + " | " + o.done);
    const before = await js(`[...document.querySelectorAll('.sh-worth.news .worth li')].map(l => l.dataset.ri).join()`); await js(`document.querySelector('[data-reseed]').click()`);
    await waitFor(`JAIReportDebug.pending === 0 && [...document.querySelectorAll('.sh-worth.news .worth li')].map(l => l.dataset.ri).join() !== '${before}'`);
    const fixes = await js(`(() => { const fx = new Set([...JAIReportDebug.analysis.flags.entries()].filter(([, f]) => f.sev === 'fix').map(([k]) => +k.split(':')[0])); return [...document.querySelectorAll('.sh-worth.news .worth li')].filter(l => fx.has(+l.dataset.ri)).length; })()`);
    assert.strictEqual(fixes, 0, "a row QA marks Fix is never sampled");
    await send("Emulation.setEmulatedMedia", { media: "print" }); const pr = await js(`getComputedStyle(document.querySelector('.wnews')).display`); await send("Emulation.setEmulatedMedia", { media: "" }); assert.strictEqual(pr, "none", "the buttons do not print");
    await loadFx("sales_clean.csv");
    const t = await js(`({ toggle: [...document.querySelectorAll('.pickby .seg')].map(b => b.textContent + ':' + b.getAttribute('aria-pressed')).join('|') })`); assert(/^Random:true\|Largest .+:false$/.test(t.toggle), t.toggle);
    await js(`document.querySelector('[data-by="largest"]').click()`); await waitFor(`JAIReportDebug.pending === 0 && document.querySelector('[data-by="largest"]').getAttribute('aria-pressed') === 'true'`);
    const l = await js(`[...document.querySelectorAll('.sh-worth.news .wreason')].map(x => x.textContent)`); assert(l.length === 5 && l.every(x => /^Largest /.test(x) || x.length > 0), l.join(" | "));
    return `five items, query "${m.q}", the tab opens on click (window.open stubbed, so no real tab was opened), Pick five others changes the five`;
  });

  await check("CONS-0055: print to PDF is one Letter page with and without edits: no records table, at most five worth-a-look rows, and an edits footnote only when there were edits", async () => {
    const pdfOf = async () => { const pdf = await send("Page.printToPDF", { preferCSSPageSize: true, printBackground: true }), txt = Buffer.from(pdf.data, "base64").toString("latin1");
      return { pages: (txt.match(/\/Type\s*\/Page[^s]/g) || []).length, letter: /\/MediaBox\s*\[\s*0\s+0\s+612(\.0+)?\s+792(\.0+)?\s*\]/.test(txt) }; };
    const inPrint = async () => { await send("Emulation.setEmulatedMedia", { media: "print" });
      const m = await js(`(() => { const vis = e => !!e && e.getClientRects().length > 0, worth = [...document.querySelectorAll('.sh-worth.ins .worth li')].filter(l => vis(l)).length; return { table: getComputedStyle(document.querySelector('.records')).display, worth, note: vis(document.querySelector('.edit-note')) ? document.querySelector('.edit-note').textContent : null, buttons: [...document.querySelectorAll('[data-news]')].filter(vis).length }; })()`);
      await send("Emulation.setEmulatedMedia", { media: "" }); return m; };
    await loadFx("sales_clean.csv"); const plain0 = await pdfOf(), p0 = await inPrint();
    assert.strictEqual(plain0.pages, 1, "without edits: " + plain0.pages + " pages"); assert(plain0.letter, "Letter paper"); assert.strictEqual(p0.table, "none"); assert(p0.worth >= 1 && p0.worth <= 5, "worth-a-look rows in print: " + p0.worth); assert.strictEqual(p0.note, null, "no footnote without edits"); assert.strictEqual(p0.buttons, 0, "no buttons in print");
    await js(`document.querySelector('.rec-td[data-c="1"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`); await js(`(() => { const inp = document.querySelector('[data-edit]'); inp.value = '123456'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
    await waitFor(`JAIReportDebug.pending === 0 && JAIReportDebug.store.edits.length === 1`); const edited = await pdfOf(), p1 = await inPrint();
    assert.strictEqual(edited.pages, 1, "with edits: " + edited.pages + " pages"); assert(edited.letter); assert.strictEqual(p1.table, "none"); assert(p1.worth <= 5); assert(p1.note && /^\d+ cells? corrected in this browser session/.test(p1.note), p1.note);
    return `without edits ${plain0.pages} page (${p0.worth} worth-a-look rows), with one edit ${edited.pages} page; footnote: "${p1.note.slice(0, 60)}"`;
  });

  await check("CONS-0056: at 390 x 844 no state of the report scrolls the page sideways; the Row column stays pinned; worth-a-look items are cards; editing opens one field at a time", async () => {
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    // CONS-0077: measured against the fixed 390 px layout width, never innerWidth (a page that overflows grows innerWidth to fit, which hid the rotated Checked stamp at 414 px). Every element's right edge counts, except the two windows that scroll inside themselves.
    const out = [], overflow = async tag => { const m = await js(`({ sw: document.documentElement.scrollWidth, wide: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > 391 && !e.closest('.rec-win') && !e.closest('.grp-wrap') && getComputedStyle(e).position !== 'fixed' && getComputedStyle(e).display !== 'none').slice(0, 6).map(e => e.tagName + '.' + e.className + ':' + Math.round(e.getBoundingClientRect().right)) })`); assert(m.sw === 390, `${tag}: the page is ${m.sw} px wide in a 390 px layout`); assert.strictEqual(m.wide.length, 0, `${tag}: these reach past 390 px: ${m.wide.join(' ')}`); out.push(`${tag} ${m.sw}/390`); };
    try {
      for (const fx of ["venues.csv", "sales_clean.csv", "sales_planted.csv", "ledger_header.csv", "records_mixed.csv"]) { await loadFx(fx); await overflow(fx);
        if (fx === "venues.csv") { await pick('[data-ch="cat"]', "city"); await waitFor(`document.querySelectorAll('.grp-parent').length === 5`); await pick('[data-ch="cat2"]', "category"); await waitFor(`document.querySelectorAll('.grp-child').length > 5`); await overflow("venues nested grouping"); await js(`document.querySelector('details.not-shown') && (document.querySelector('details.not-shown').open = true)`); } }
      await loadFx("sales_clean.csv"); await js(`document.querySelector('.rec-win').scrollTop = 0; document.querySelector('.rec-win').scrollLeft = 300`); await sleep(150);
      const st = await js(`(() => { const w = document.querySelector('.rec-win'), wb = w.getBoundingClientRect(), f = document.querySelector('.rec-td.first'), h = document.querySelector('.rec-thead'); return { pos: getComputedStyle(f).position, dx: Math.abs(f.getBoundingClientRect().left - wb.left), sl: w.scrollLeft, hpos: getComputedStyle(h).position, h: innerHeight }; })()`);
      assert.strictEqual(st.pos, "sticky"); assert(st.sl > 0 && st.dx <= 2, "the Row column moved " + JSON.stringify(st)); assert.strictEqual(st.h, 844);
      const cards = await js(`(() => [...document.querySelectorAll('.sh-worth .worth li')].map(l => { const cs = getComputedStyle(l), r = l.getBoundingClientRect(); return { br: parseFloat(cs.borderTopLeftRadius), bw: parseFloat(cs.borderTopWidth), pad: parseFloat(cs.paddingLeft), fits: r.left >= 0 && r.right <= innerWidth + 1 }; }))()`);
      assert(cards.length >= 5, "cards: " + cards.length); cards.forEach(c => { assert(c.br >= 8 && c.bw >= 1 && c.pad >= 8 && c.fits, JSON.stringify(c)); });
      await js(`document.querySelector('.rec-win').scrollLeft = 0; document.querySelector('.rec-td[data-c="1"]').scrollIntoView({ block: 'center' })`); await sleep(150);
      await js(`document.querySelector('.rec-td[data-c="1"]').click()`); await waitFor(`!!document.querySelector('.rec-sheet:not([hidden]) input[data-sedit]')`);
      const e1 = await js(`({ inputs: document.querySelectorAll('.rec-sheet input').length, td: document.querySelectorAll('.rec-td input').length, label: document.querySelector('.rec-sheet label').textContent, mode: document.querySelector('.rec-sheet input').inputMode, box: (() => { const r = document.querySelector('.rec-sheet').getBoundingClientRect(); return { l: r.left, r: r.right, b: r.bottom, h: innerHeight }; })() })`);
      assert.strictEqual(e1.inputs, 1, "one field at a time"); assert.strictEqual(e1.td, 0, "no inline editor in the table on a phone"); assert(/Row \d+ . /.test(e1.label), e1.label); assert.strictEqual(e1.mode, "decimal"); assert(e1.box.l >= 0 && e1.box.r <= 391 && e1.box.b <= e1.box.h + 1, JSON.stringify(e1.box));
      await js(`(() => { const i = document.querySelector('.rec-sheet input'); i.value = '$98,765'; document.querySelector('.rec-sheet form').requestSubmit(); })()`);
      await waitFor(`JAIReportDebug.store.edits.length === 1 && !!document.querySelector('.rec-sheet[hidden]')`); assert(/98,?765/.test(await js(`JSON.stringify(JAIReportDebug.store.edits[0])`)), "the edit was saved");
      await js(`document.querySelector('.rec-td[data-c="1"]').click()`); await waitFor(`!!document.querySelector('.rec-sheet:not([hidden]) input')`); await js(`document.querySelector('[data-scancel]').click()`);
      await waitFor(`!!document.querySelector('.rec-sheet[hidden]')`); assert.strictEqual(await js(`JAIReportDebug.store.edits.length`), 1, "Cancel changes nothing");
      await overflow("after editing");
    } finally { await send("Emulation.clearDeviceMetricsOverride"); }
    return out.join(", ") + "; Row column pinned; cards; the editor opens one field in a bottom sheet";
  });

  await check("CONS-0053: a 23,000-row file is read as piece 1 of 3 with Next and Previous piece; each piece is reported on its own, only one piece is held, a column flagged in piece 1 stays out, and the print says which piece it is", async () => {
    tmpPieces = path.join(os.tmpdir(), `jai-pieces-${process.pid}.csv`);
    const rows23 = R.cafeSample(23000).map((r, i) => [...r, i === 0 ? "ref" : i <= 10000 ? `${100 + (i % 800)}-45-${1000 + (i % 8000)}` : "plain"]); fs.writeFileSync(tmpPieces, Rec.rowsToCSV(rows23, { delim: ",", eol: "\n" }));
    const state = () => js(`({ bar: (document.querySelector('.sh-pieces') || {}).textContent, k: JAIReportDebug.analysis.piece && JAIReportDebug.analysis.piece.k, held: JAIReportDebug.store.rows.length, base: JAIReportDebug.analysis.rowBase, hasRef: JAIReportDebug.analysis.header.includes('ref'), excluded: JAIReportDebug.analysis.screen.excluded.map(x => x.name).join(), prevOff: document.querySelector('[data-piece="prev"]').disabled, nextOff: document.querySelector('[data-piece="next"]').disabled, qa: [...document.querySelectorAll('.sh-qa .finds li b')].map(b => b.textContent).join('|'), meta: document.querySelector('.sh-meta').textContent })`);
    await loadFx(tmpPieces); const p1 = await state();
    assert(/^Piece 1 of 3 . rows 1 to 10,000 of 23,000/.test(p1.bar), p1.bar); assert(/all pieces at once/.test(p1.bar), "the one-line paid note"); assert.strictEqual(p1.held, 10000, "one piece in memory"); assert(p1.prevOff && !p1.nextOff); assert(!p1.hasRef && /ref/.test(p1.excluded), "screening ran on piece 1: " + p1.excluded); assert(/piece 1 of 3/.test(p1.meta));
    await js(`document.querySelector('[data-piece="next"]').click()`); await waitFor(`JAIReportDebug.analysis.piece && JAIReportDebug.analysis.piece.k === 2 && !!document.querySelector('.rec-tr')`, 60000); const p2 = await state();
    assert(/^Piece 2 of 3 . rows 10,001 to 20,000 of 23,000/.test(p2.bar), p2.bar); assert.strictEqual(p2.held, 10000); assert.strictEqual(p2.base, 10002, "row numbers are the file's own"); assert(!p2.hasRef && /ref/.test(p2.excluded), "a column flagged in piece 1 stays out of piece 2: " + p2.excluded); assert.notStrictEqual(p2.qa, p1.qa, "piece 2 has different findings");
    assert(!p2.prevOff && !p2.nextOff); assert(await js(`document.querySelector('.rec-tr .rec-td.first').textContent.replace(/,/g, '').trim() === '10002'`), "the table's first row number");
    await send("Emulation.setEmulatedMedia", { media: "print" }); const pn = await js(`(() => { const e = document.querySelector('.piece-note'); return { shown: e.getClientRects().length > 0, text: e.textContent, bar: document.querySelector('.sh-pieces').getClientRects().length }; })()`); await send("Emulation.setEmulatedMedia", { media: "" });
    assert(pn.shown && /piece 2 of 3/.test(pn.text) && /The paid edition reports across all pieces at once\./.test(pn.text) && pn.bar === 0, JSON.stringify(pn));
    const pdf = await send("Page.printToPDF", { preferCSSPageSize: true, printBackground: true }), pages = (Buffer.from(pdf.data, "base64").toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length; assert.strictEqual(pages, 1, "the print of piece 2 is one page, got " + pages);
    await js(`document.querySelector('[data-piece="next"]').click()`); await waitFor(`JAIReportDebug.analysis.piece && JAIReportDebug.analysis.piece.k === 3 && !!document.querySelector('.rec-tr')`, 60000); const p3 = await state();
    assert(/^Piece 3 of 3 . rows 20,001 to 23,000 of 23,000/.test(p3.bar), p3.bar); assert.strictEqual(p3.held, 3000); assert(p3.nextOff && !p3.prevOff); assert(!p3.hasRef);
    await js(`document.querySelector('[data-piece="prev"]').click()`); await waitFor(`JAIReportDebug.analysis.piece && JAIReportDebug.analysis.piece.k === 2 && JAIReportDebug.store.rows.length === 10000`, 60000);
    return `piece 1 of 3 (10,000 held), piece 2 (rows from 10,002, different findings, ref still out, prints piece 2 of 3 on one page), piece 3 (3,000 held), Previous returns to piece 2`;
  });

  // ---------- CONS-0051: interactive findings, filters and drill-down
  console.log("interactive findings, filters and drill-down (CONS-0051)");
  const ST = JSON.parse(fs.readFileSync(path.join(FXDIR, "sales_states.truth.json"), "utf8")), CAN = ST.ca_rows.length, TOTAL_ST = 803;
  const quiet = () => waitFor("JAIReportDebug.pending === 0");
  const text = sel => js(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ""`);
  const rowsTile = () => js(`[...document.querySelectorAll('.sh-kpis > div')].find(d => /Rows/.test(d.textContent)).querySelector('b').textContent`);
  const key = async (k, code) => { const vk = code === "Tab" ? 9 : 13; await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, text: k === "Enter" ? "\r" : "" }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk }); };
  const sliceOn = () => waitFor("!!JAIReportDebug.slice && JAIReportDebug.pending === 0"), sliceOff = () => waitFor("!JAIReportDebug.slice && JAIReportDebug.pending === 0");
  async function openStates() { await loadFx("sales_states.csv"); await pick('[data-ch="cat"]', "state"); await waitFor(`document.querySelectorAll('.grp-parent').length === 4`); await quiet(); }

  await check("CONS-0051: click the CA bar: the table, the columns panel and the health lines recompute for CA; the breadcrumb says CA; clearing restores the whole file", async () => {
    await openStates();
    const whole = await js(`({ rows: document.querySelector('.sh-kpis').textContent, health: document.querySelector('.sh-health').textContent, cols: document.querySelector('.sh-cols').textContent, count: document.querySelector('[data-count]').textContent })`);
    assert(/Showing 803 of 803/.test(whole.count) && /duplicate rows/.test(whole.health), whole.count + " / " + whole.health);
    await js(`document.querySelector('tr.grp-parent[data-g="CA"]').click()`); await sliceOn();
    const ca = await js(`({ rows: document.querySelector('.sh-kpis').textContent, health: document.querySelector('.sh-health').textContent, cols: document.querySelector('.sh-cols').textContent, count: document.querySelector('[data-count]').textContent,
      crumb: document.querySelector('#rep-slice .here').textContent, n: document.querySelector('#rep-slice .sb-n').textContent, grp: [...document.querySelectorAll('.grp-parent .grp-name')].map(e => e.textContent), hash: location.hash, status: document.querySelector('#report-status').textContent, tbl: document.querySelector('[data-crumbs]').textContent })`);
    assert(/CA/.test(ca.crumb) && ca.n === `${CAN} of ${TOTAL_ST} rows`, ca.crumb + " / " + ca.n); assert(new RegExp("Showing " + CAN + " of " + TOTAL_ST).test(ca.count), ca.count);
    assert(ca.rows.includes(String(CAN)) && ca.rows !== whole.rows, "the Rows tile is the CA count: " + ca.rows); assert.deepStrictEqual(ca.grp, ["CA"]);
    assert(ca.health !== whole.health && !/\d duplicate rows/.test(ca.health) && /far from the usual/.test(ca.health), "the health lines are CA's own: " + ca.health);
    assert(ca.cols !== whole.cols, "the Columns panel is CA's own"); assert(/state: CA/.test(ca.tbl), ca.tbl); assert(/g=state&gv=CA/.test(ca.hash), ca.hash); assert(/of 803 rows/.test(ca.status), ca.status);
    await js(`document.querySelector('[data-slice-clear]').click()`); await sliceOff(); await waitFor(`document.querySelectorAll('.grp-parent').length === 4`);
    const back = await js(`({ rows: document.querySelector('.sh-kpis').textContent, health: document.querySelector('.sh-health').textContent, cols: document.querySelector('.sh-cols').textContent, hash: location.hash, count: document.querySelector('[data-count]').textContent, help: !!document.querySelector('.slice-help') })`);
    assert.strictEqual(back.rows, whole.rows); assert.strictEqual(back.health, whole.health); assert.strictEqual(back.cols, whole.cols); assert(!/gv=/.test(back.hash), back.hash); assert(/Showing 803 of 803/.test(back.count) && back.help);
    return `CA ${CAN} of ${TOTAL_ST} rows; health "${ca.health.slice(0, 50)}..." instead of "${whole.health.slice(0, 40)}..."; hash ${ca.hash}`;
  });

  await check("CONS-0051: Back and Forward step through the views by the URL hash", async () => {
    await openStates();
    await js(`document.querySelector('tr.grp-parent[data-g="CA"]').click()`); await sliceOn();
    await js(`history.back()`); await sliceOff(); await waitFor(`/Showing 803 of 803/.test(document.querySelector('[data-count]').textContent)`);
    assert(!/gv=/.test(await js(`location.hash`)), "Back clears the CA filter");
    await js(`history.forward()`); await sliceOn(); assert(/state: CA/.test(await text('[data-crumbs]')) && /g=state&gv=CA/.test(await js(`location.hash`)));
    await js(`history.back()`); await sliceOff();
  });

  await check("CONS-0051: a finding, a health line and a column name each filter the table and work the report out for those rows", async () => {
    await openStates();
    const f = await js(`(() => { const b = document.querySelector('.finds [data-find="unit:sale_price"]'); return b && b.parentElement.querySelector('b').textContent; })()`); assert(/4 sale price values/.test(f), f);
    await js(`document.querySelector('.finds [data-find="unit:sale_price"]').click()`); await sliceOn();
    assert.strictEqual(await rowsTile(), "4"); assert(/10x too large|Unusual|sale price/i.test(await text('#rep-slice .here')), await text('#rep-slice .here')); assert(/Showing 4 of 803/.test(await text('[data-count]')));
    await js(`document.querySelector('[data-slice-clear]').click()`); await sliceOff();
    const hl = await js(`[...document.querySelectorAll('.sh-health .hl-btn')].map(b => b.dataset.find + '=' + b.textContent)`); assert(hl.length >= 2, "health lines that are buttons: " + hl);
    assert.strictEqual(await js(`document.querySelector('.sh-health .hl-btn[data-find="dup"]') ? 1 : 0`), 1, "the duplicate rows health line is a button: " + hl);
    await js(`document.querySelector('.sh-health .hl-btn[data-find="dup"]').click()`); await sliceOn();
    assert.strictEqual(await rowsTile(), "6"); assert(/Showing 6 of 803/.test(await text('[data-count]')));
    await js(`document.querySelector('[data-slice-clear]').click()`); await sliceOff();
    await js(`document.querySelector('[data-colflag="sale_price"]').click()`); await sliceOn();
    const n = await js(`JAIReportDebug.slice.length`); assert(n >= 4 && n < 803, "rows with a marked cell in sale_price: " + n); assert.strictEqual(await rowsTile(), String(n)); assert(/Marked cells in sale_price/.test(await text('#rep-slice .here')));
    await js(`document.querySelector('[data-slice-clear]').click()`); await sliceOff();
    return `finding 4 rows, health line "duplicate rows" 6 rows, column sale_price ${n} rows`;
  });

  await check("CONS-0051: searching the records is a slice too, and the Rows tile follows", async () => {
    await openStates();
    await js(`(() => { const q = document.querySelector('[data-q]'); q.value = 'Austin'; q.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await sliceOn(); const n = await js(`JAIReportDebug.slice.length`); assert(n > 20 && n < 400, n);
    assert.strictEqual(await rowsTile(), String(n)); assert(/Search: “Austin”/.test(await text('#rep-slice .here'))); assert(/q=Austin/.test(await js(`location.hash`)));
    await js(`document.querySelector('[data-crumbs] .rec-x').click()`); await sliceOff(); assert(!/q=/.test(await js(`location.hash`)));
  });

  await check("CONS-0051: hover on a bar shows the row count, share, average and flagged count; Tab reaches the bars; Enter filters; the focus ring is visible", async () => {
    await openStates();
    await js(`document.querySelector('tr.grp-parent[data-g="CA"]').scrollIntoView({ block: 'center', behavior: 'instant' })`); await sleep(300);
    const r = await js(`(() => { const e = document.querySelector('tr.grp-parent[data-g="CA"]'), b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x, y: r.y }); await sleep(150);
    const t = await js(`(() => { const g = document.querySelector('.gtip'); return { hidden: g.hidden, text: g.innerText, vis: getComputedStyle(g).display }; })()`);
    assert(!t.hidden && t.vis !== "none", JSON.stringify(t)); assert(/^CA/.test(t.text) && /\d+ rows? · \d+% of the total/.test(t.text) && /average [\d,.]+/.test(t.text) && /\d+ of \d+ rows flagged/.test(t.text), t.text);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5 }); await sleep(100); assert.strictEqual(await js(`document.querySelector('.gtip').hidden`), true);
    await js(`document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0)`); let reached = 0;
    for (let i = 0; i < 160 && !reached; i++) { await key("Tab", "Tab"); reached = await js(`document.activeElement && document.activeElement.matches('table.grp tr.grp-parent[data-g]') ? 1 : 0`); }
    assert(reached, "Tab never reached a bar");
    const ring = await js(`(() => { const e = document.activeElement, cs = getComputedStyle(e); return { name: e.dataset.g, w: parseFloat(cs.outlineWidth), st: cs.outlineStyle, tip: document.querySelector('.gtip').hidden, label: e.getAttribute('aria-label') }; })()`);
    assert(ring.w >= 2 && ring.st !== "none", "focus ring " + JSON.stringify(ring)); assert.strictEqual(ring.tip, false, "the numbers show on keyboard focus too"); assert(/rows flagged/.test(ring.label), ring.label);
    await key("Enter", "Enter"); await sliceOn(); assert(await js(`document.querySelector('#rep-slice .here').textContent.includes(${JSON.stringify(ring.name)})`), "Enter filtered to " + ring.name);
    await js(`document.querySelector('[data-slice-clear]').click()`); await sliceOff();
    return `tooltip "${t.text.replace(/\n/g, " | ").slice(0, 110)}"; Tab reached ${ring.name}, ring ${ring.w}px, Enter filtered`;
  });

  await check("CONS-0051: Compare: with no slice it says to filter first; with a slice the whole file is outlined bars and the slice is red bars; it does not print", async () => {
    await openStates();
    await js(`document.querySelector('[data-compare]').click()`); await sleep(100);
    assert.strictEqual((await text('.cmp-note')).trim(), "Filter or search the records to compare a slice with the whole file.");
    assert.strictEqual(await js(`document.querySelectorAll('.grp-track').length`), 0, "no compare bars without a slice");
    await js(`document.querySelector('tr.grp-parent[data-g="CA"]').click()`); await waitFor(`!!JAIReportDebug.slice && JAIReportDebug.pending === 0 && document.querySelectorAll('table.grp.cmp .grp-track').length === 4`);
    const c = await js(`(() => { const rows = [...document.querySelectorAll('table.grp.cmp tr.grp-parent')].map(r => ({ k: r.dataset.g, whole: r.querySelector('i.whole').getBoundingClientRect().width, part: r.querySelector('i.part').getBoundingClientRect().width, inSlice: r.querySelector('.grp-slice').textContent })), w = document.querySelector('table.grp.cmp i.whole'), p = document.querySelector('table.grp.cmp i.part');
      return { rows, wbg: getComputedStyle(w).backgroundColor, wborder: getComputedStyle(w).borderTopColor, pbg: getComputedStyle(p).backgroundColor, key: document.querySelector('.cmp-key').textContent, hash: location.hash }; })()`);
    assert.deepStrictEqual(c.rows.map(r => r.k).sort(), ["CA", "FL", "NY", "TX"]); const ca = c.rows.find(r => r.k === "CA");
    assert(ca.part > 0 && ca.part <= ca.whole + 1, "CA slice bar is inside its whole-file bar: " + JSON.stringify(ca)); assert(Math.abs(ca.part - ca.whole) < 2, "CA's slice is all of CA's bar"); assert(c.rows.filter(r => r.k !== "CA").every(r => r.part === 0 && r.whole > 0 && r.inSlice === "0"), JSON.stringify(c.rows));
    assert.strictEqual(c.wbg, "rgba(0, 0, 0, 0)", "whole file: outlined, not filled"); assert(/47, 59, 75/.test(c.wborder), c.wborder); assert.strictEqual(c.pbg, "rgb(179, 18, 26)", "slice: red"); assert(/cmp=1/.test(c.hash), c.hash); assert(/whole file/.test(c.key) && /state: CA/.test(c.key), c.key);
    const pdf = await send("Page.printToPDF", { preferCSSPageSize: true, printBackground: true }), pages = (Buffer.from(pdf.data, "base64").toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    assert.strictEqual(pages, 1, "a printed slice with Compare on is one page, got " + pages); await sleep(200); assert.strictEqual(await js(`JAIReportDebug.compare`), true, "Compare is back on after the print");
    await send("Emulation.setEmulatedMedia", { media: "print" }); const pr = await js(`({ tools: getComputedStyle(document.querySelector('.grp-tools')).display, bar: getComputedStyle(document.querySelector('#rep-slice')).display, meta: document.querySelector('.sh-meta').textContent })`); await send("Emulation.setEmulatedMedia", { media: "" });
    assert.strictEqual(pr.tools, "none"); assert.strictEqual(pr.bar, "none"); assert(/slice: state: CA \(\d+ of 803 rows\)/.test(pr.meta), "the printed report says which slice it is: " + pr.meta);
    await js(`document.querySelector('[data-compare]').click()`); await sleep(100); assert.strictEqual(await js(`document.querySelectorAll('.grp-track').length`), 0, "Compare off");
    await js(`document.querySelector('[data-slice-clear]').click()`); await sliceOff();
    return `CA bar ${Math.round(ca.part)}/${Math.round(ca.whole)} px, others 0; printed on ${pages} page`;
  });

  await check("CONS-0051: Measure, Date and Group by react without a reload, and a slice stays while they change", async () => {
    await openStates(); await js(`window.__noReload = 1`);
    await js(`document.querySelector('tr.grp-parent[data-g="CA"]').click()`); await sliceOn();
    await pick('[data-ch="measure"]', "living_area_sqft"); await waitFor(`/living_area_sqft by state/.test(document.querySelector('.sh-insights').textContent) && JAIReportDebug.pending === 0`);
    assert.strictEqual(await js(`window.__noReload`), 1, "no reload"); assert(!!(await js(`JAIReportDebug.slice`)), "the slice stays"); assert(/m=living_area_sqft/.test(await js(`location.hash`)));
    await pick('[data-ch="cat"]', "property_type"); await waitFor(`/by property_type/.test(document.querySelector('.sh-insights').textContent) && JAIReportDebug.pending === 0`);
    const dateSel = await js(`(() => { const s = document.querySelector('[data-ch="date"]'); return s ? s.value : null; })()`); assert(dateSel, "a Date picker"); await pick('[data-ch="date"]', dateSel); await quiet();
    assert.strictEqual(await js(`window.__noReload`), 1, "no reload"); assert(/by=property_type/.test(await js(`location.hash`)));
    return "Measure -> living_area_sqft, Group by -> property_type, Date picker answers, slice CA kept, page not reloaded";
  });

  await check("CONS-0051: the view survives a reload from its link (names and clicked values only), and the link holds no row", async () => {
    await send("Page.navigate", { url: "about:blank" }); await sleep(200);
    await send("Page.navigate", { url: BASE + "/report.html#sample&g=location&gv=Wynwood&cmp=1&m=total" });
    await waitFor("!!window.JAIReportDebug && !!JAIReportDebug.store && document.querySelectorAll('.rec-tr').length > 0 && !!JAIReportDebug.slice && JAIReportDebug.pending === 0", 30000);
    const m = await js(`({ crumb: document.querySelector('#rep-slice .here').textContent, cmp: JAIReportDebug.compare, tracks: document.querySelectorAll('table.grp.cmp .grp-track').length, count: document.querySelector('[data-count]').textContent, hash: location.hash, rows: document.querySelector('.sh-kpis').textContent })`);
    assert(/location: Wynwood/.test(m.crumb), m.crumb); assert.strictEqual(m.cmp, true); assert(m.tracks >= 5, "compare bars " + m.tracks); assert(/^Showing [\d,]+ of 5,000$/.test(m.count) && !/Showing 5,000/.test(m.count), m.count);
    assert(/^#sample&/.test(m.hash) && m.hash.length < 120 && !/A10\d\d\d|2026-\d\d-\d\d|Cuban|\$/.test(decodeURIComponent(m.hash)), "no row in the address: " + m.hash);
    return `reloaded at ${m.hash}: "${m.crumb}", ${m.count}, compare on`;
  });

  await check("CONS-0051: a ledger keeps its whole-file panels and says so while the table filters; the text of the new controls is at least 12 px", async () => {
    await loadFx("ledger_header.csv"); const before = await js(`document.querySelector('.sh-kpis').textContent`);
    await js(`document.querySelector('.finds [data-find]').click()`); await waitFor(`!!document.querySelector('#rep-slice .slicebar')`); await sleep(400); await quiet();
    const m = await js(`({ kpis: document.querySelector('.sh-kpis').textContent, note: (document.querySelector('.sb-note') || {}).textContent, slice: JAIReportDebug.slice, count: document.querySelector('[data-count]').textContent })`);
    assert.strictEqual(m.kpis, before, "a ledger's panels are not recomputed"); assert(/panels keep showing the whole file for a ledger/.test(m.note), m.note); assert.strictEqual(m.slice, null); assert(!/Showing (\d+) of \1$/.test(m.count), m.count);
    await js(`document.querySelector('[data-slice-clear]').click()`); await sleep(200);
    await openStates(); await js(`document.querySelector('tr.grp-parent[data-g="CA"]').click()`); await sliceOn(); await js(`document.querySelector('[data-compare]').click()`); await sleep(150);
    const small = await js(`[...document.querySelectorAll('#rep-slice *, .grp-tools *, .grp-tools, .gtip, td.grp-slice')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 12).map(e => e.className + ':' + getComputedStyle(e).fontSize)`);
    assert.deepStrictEqual(small, [], "text under 12 px: " + small);
    await js(`document.querySelector('[data-slice-clear]').click()`); await sliceOff();
    return "ledger: " + m.note;
  });

  await check("CONS-0051: at 390 px a slice with Compare on does not scroll the page sideways and the slice bar wraps", async () => {
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    try {
      await openStates(); await js(`document.querySelector('tr.grp-parent[data-g="CA"]').click()`); await sliceOn();
      await js(`document.querySelector('[data-compare]').click()`); await waitFor(`document.querySelectorAll('table.grp.cmp .grp-track').length === 4`);
      const m = await js(`({ sw: document.documentElement.scrollWidth, vw: innerWidth, bar: document.querySelector('.slicebar').getBoundingClientRect().right, wide: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > 391 && !e.closest('.rec-win') && !e.closest('.grp-wrap') && getComputedStyle(e).position !== 'fixed').slice(0, 6).map(e => e.tagName + '.' + e.className + ':' + Math.round(e.getBoundingClientRect().right)) })`);
      assert.strictEqual(m.wide.length, 0, `these reach past the 390 px layout width: ${m.wide.join(' ')}`); assert(m.bar <= 391, "the slice bar fits: " + m.bar); assert.strictEqual(m.sw, 390, "scrollWidth " + m.sw);
      return `nothing reaches past 390 px, the Checked stamp included (page ${m.sw})`;
    } finally { await send("Emulation.clearDeviceMetricsOverride"); }
  });

  await check("CONS-0077: the rotated Checked stamp sits inside a 390 px layout (right edge, whole box) and is still shown in the print", async () => {
    // protects: the stamp once reached 414 px and made the page scroll sideways on a phone; the stamp must also survive in print.
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    try {
      await loadFx("sales_clean.csv");
      // the overflow was the stamp-in animation (it starts at 2.4x and overshoots), so replay it and sample every frame for 0.8 s, then once at rest
      const m = await js(`new Promise(res => { const st = document.querySelector('.stamp'); st.classList.remove('hit'); void st.offsetWidth; st.classList.add('hit'); let l = 1e9, r = -1e9, sw = 0; const t0 = performance.now(); (function f() { const b = st.getBoundingClientRect(); l = Math.min(l, b.left); r = Math.max(r, b.right); sw = Math.max(sw, document.documentElement.scrollWidth); if (performance.now() - t0 < 800) requestAnimationFrame(f); else res({ l, r, sw, shown: b.width > 0 }); })(); })`);
      assert(m.shown && m.l >= 0 && m.r <= 390 && m.sw === 390, "stamp over the animation " + JSON.stringify(m));
      await send("Emulation.setEmulatedMedia", { media: "print" });
      const pr = await js(`document.querySelector('.stamp').getClientRects().length`); await send("Emulation.setEmulatedMedia", { media: "" });
      assert(pr > 0, "the stamp is shown in print");
      return `stamp ${Math.round(m.l)} to ${Math.round(m.r)} px, page ${m.sw}; shown in print`;
    } finally { await send("Emulation.clearDeviceMetricsOverride"); await send("Emulation.setEmulatedMedia", { media: "" }); }
  });

  await check("opened from a file (no worker allowed there) the page falls back to this thread and still produces the report", async () => {
    await send("Page.navigate", { url: "file:///" + PAGE.replace(/\\/g, "/") + "#sample" }); await waitFor("!!window.JAIReportDebug && !!JAIReportDebug.store && document.querySelectorAll('.rec-tr').length > 0", 20000);
    assert.strictEqual(await js(`JAIReportDebug.engine`), "main"); assert.strictEqual(await js(`JAIReportDebug.store.rows.length`), 5000);
  });

  sock.close(); console.log(`\nbrowser checks: ${passed} passed, ${failed} failed`);
  cleanup(); process.exit(failed ? 1 : 0);
})().catch(e => { console.log("FAIL (browser harness): " + (e && e.stack || e)); cleanup(); process.exit(1); });
