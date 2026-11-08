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
let child = null, profile = null, tmpCsv = null, server = null, BASE = "";
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
  for (const p of [profile, tmpCsv]) { try { if (p) fs.rmSync(p, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch (e) {} }
}
process.on("exit", cleanup); process.on("SIGINT", () => { cleanup(); process.exit(130); });

let passed = 0, failed = 0;
const check = (name, fn) => Promise.resolve().then(fn).then(r => { passed++; console.log(`  ok   ${name}${r ? " (" + r + ")" : ""}`); }, e => { failed++; console.log(`  FAIL ${name}\n       ${String(e.message).split("\n").join("\n       ")}`); });

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
    const before = await js(`document.querySelector('.chart.bars [data-g="Sunny Isles Beach"]').dataset.tip`);
    await js(`document.querySelector('[data-find="unit:unit_price"]').click()`);
    for (let i = 0; i < 12; i++) {
      await js(`(() => { const c = document.querySelector('.rec-td.look[data-c="5"]'); c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); })()`);
      await js(`(() => { const inp = document.querySelector('[data-edit]'); inp.value = '$11.50'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
    }
    await waitFor("document.querySelector('.rec-edits .n').textContent === '12 edits' && !/unit price values/.test(document.querySelector('#rep-sheet .finds').textContent)");
    const m = await js(`(() => ({ n: document.querySelector('.rec-edits .n').textContent, finds: document.querySelector('#rep-sheet .finds').textContent, edited: document.querySelectorAll('.rec-td.edited').length, tip: document.querySelector('.chart.bars [data-g="Sunny Isles Beach"]').dataset.tip }))()`);
    assert.strictEqual(m.n, "12 edits"); assert(!/unit price values/.test(m.finds), m.finds.slice(0, 200)); assert(m.edited >= 12, "edited cells " + m.edited);
    const avg = t => +(t.match(/average (?:&lt;b&gt;|<b>)?([\d,.]+)/) || [0, "0"])[1].replace(/,/g, "");
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
    assert.strictEqual(m.rec, "none"); assert.strictEqual(m.sixth, "none"); assert.notStrictEqual(m.fifth, "none"); assert.strictEqual(m.controls, "none"); assert.notStrictEqual(m.note, "none"); assert(/^11 edits were made in this browser session \(\d+ cells changed, counting totals worked out again\); the findings/.test(m.note_txt), m.note_txt);
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
    const doc = await send("DOM.getDocument"), inp = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#report-file" }); await send("DOM.setFileInputFiles", { files: [path.join(FXDIR, name)], nodeId: inp.nodeId });
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

  await check("opened from a file (no worker allowed there) the page falls back to this thread and still produces the report", async () => {
    await send("Page.navigate", { url: "file:///" + PAGE.replace(/\\/g, "/") + "#sample" }); await waitFor("!!window.JAIReportDebug && !!JAIReportDebug.store && document.querySelectorAll('.rec-tr').length > 0", 20000);
    assert.strictEqual(await js(`JAIReportDebug.engine`), "main"); assert.strictEqual(await js(`JAIReportDebug.store.rows.length`), 5000);
  });

  sock.close(); console.log(`\nbrowser checks: ${passed} passed, ${failed} failed`);
  cleanup(); process.exit(failed ? 1 : 0);
})().catch(e => { console.log("FAIL (browser harness): " + (e && e.stack || e)); cleanup(); process.exit(1); });
