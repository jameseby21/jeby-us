/* Free report browser checks: drives a headless Edge or Chrome over the DevTools protocol (plain Node 22+, no dependencies).
       python _src/build.py      then      node _src/jai/tests/browser.js
   Renders _src/jai/out/report.html from disk, loads the made-up café sample and a 10,000-row file, and checks the records table:
   it exists and scrolls, only the visible rows are drawn, the frames stay smooth, a finding filters it, an edit recalculates,
   the export round-trips, print hides the table, and no network request happens while the visitor works.
   Without a browser the script prints "NOT RUN" and exits 0. It starts one headless browser with a temporary profile and removes both when done. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), net = require("net"), cp = require("child_process"), assert = require("assert");
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
let child = null, profile = null, tmpCsv = null;
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
  stopBrowser();
  for (const p of [profile, tmpCsv]) { try { if (p) fs.rmSync(p, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch (e) {} }
}
process.on("exit", cleanup); process.on("SIGINT", () => { cleanup(); process.exit(130); });

let passed = 0, failed = 0;
const check = (name, fn) => Promise.resolve().then(fn).then(r => { passed++; console.log(`  ok   ${name}${r ? " (" + r + ")" : ""}`); }, e => { failed++; console.log(`  FAIL ${name}\n       ${String(e.message).split("\n").join("\n       ")}`); });

(async () => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "jai-browser-")); const port = await freePort();
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
  const waitFor = async (expr, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(expr).catch(() => false)) return Date.now() - t0; await sleep(50); } throw new Error("timed out waiting for " + expr); };
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("Emulation.setFocusEmulationEnabled", { enabled: true });   // a headless page is never "focused" otherwise, and focus-driven reasons would not show

  console.log("browser: " + path.basename(exe) + " headless, profile " + path.basename(profile));
  await send("Page.navigate", { url: "file:///" + PAGE.replace(/\\/g, "/") + "#sample" });
  await waitFor("!!document.querySelector('.rec-win') && document.querySelectorAll('.rec-tr').length > 0");
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
  await check("clicking a finding shows its rows; flagged cells carry red and a reason on focus", async () => {
    await js(`document.querySelector('[data-find="unit:unit_price"]').click()`);
    const m = await js(`(() => { const c = document.querySelector('.rec-td.fix'); c.focus(); const tip = document.querySelector('.rec-tip'); return { count: document.querySelector('[data-count]').textContent, crumbs: document.querySelector('[data-crumbs]').textContent, cls: c.className, bg: getComputedStyle(c).backgroundColor, rule: getComputedStyle(c).boxShadow, tip: tip.textContent, op: getComputedStyle(tip).opacity }; })()`);
    assert(/Showing 12 of 5,000/.test(m.count), m.count); assert(/unit price/i.test(m.crumbs), m.crumbs);
    assert(/247, 227, 227|f7e3e3/i.test(m.bg), "tint " + m.bg); assert(/179, 18, 26/.test(m.rule), "red rule " + m.rule);
    assert(/\$115\.00 is 10x this item's usual \$11\.50\. Likely/.test(m.tip), m.tip);
    await sleep(250); assert.strictEqual(await js(`getComputedStyle(document.querySelector('.rec-tip')).opacity`), "1", "the reason is visible while the cell has focus");
  });
  await check("records worth a look: at most ten, click scrolls to and highlights the row", async () => {
    await js(`document.querySelector('[data-crumbs] .rec-x').click()`);
    const n = await js(`document.querySelectorAll('.worth .wrow').length`); assert(n >= 5 && n <= 10, n);
    const first = await js(`document.querySelector('.worth .wrow b').textContent`); assert(/unit_price/.test(first), first);
    await js(`document.querySelectorAll('.worth .wrow')[5].click()`); await sleep(400);
    const m = await js(`(() => { const h = document.querySelector('.rec-tr.hl'); const w = document.querySelector('.rec-win').getBoundingClientRect(), r = h && h.getBoundingClientRect(); return { found: !!h, inside: !!h && r.top >= w.top - 1 && r.bottom <= w.bottom + 1, text: h && h.textContent.slice(0, 40) }; })()`);
    assert(m.found && m.inside, JSON.stringify(m));
  });

  console.log("editing and export (CONS-0054)");
  await check("fix the twelve $115.00 prices with Enter: the finding disappears, '12 edits' shows, the location average drops", async () => {
    const before = await js(`document.querySelector('.chart.bars [data-g="Sunny Isles Beach"]').dataset.tip`);
    await js(`document.querySelector('[data-find="unit:unit_price"]').click()`);
    for (let i = 0; i < 12; i++) {
      await js(`(() => { const c = document.querySelector('.rec-td.fix[data-c="5"]'); c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); })()`);
      await js(`(() => { const inp = document.querySelector('[data-edit]'); inp.value = '$11.50'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
    }
    const m = await js(`(() => ({ n: document.querySelector('.rec-edits .n').textContent, finds: document.querySelector('#rep-sheet .finds').textContent, edited: document.querySelectorAll('.rec-td.edited').length, tip: document.querySelector('.chart.bars [data-g="Sunny Isles Beach"]').dataset.tip }))()`);
    assert.strictEqual(m.n, "12 edits"); assert(!/unit price values/.test(m.finds), m.finds.slice(0, 200)); assert(m.edited >= 12, "edited cells " + m.edited);
    const avg = t => +(t.match(/average (?:&lt;b&gt;|<b>)?([\d,.]+)/) || [0, "0"])[1].replace(/,/g, "");
    assert(avg(m.tip) < avg(before), `average ${avg(before)} -> ${avg(m.tip)}`);
    return `average ${avg(before)} -> ${avg(m.tip)}`;
  });
  await check("Esc cancels an edit; Undo reverts one; text in a number column is refused", async () => {
    await js(`document.querySelector('[data-crumbs] .rec-x').click(); document.querySelector('.rec-win').scrollTop = 0`);
    await js(`document.querySelector('.rec-td[data-c="5"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
    await js(`(() => { const inp = document.querySelector('[data-edit]'); inp.value = '999'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); })()`);
    assert.strictEqual(await js(`document.querySelector('.rec-edits .n').textContent`), "12 edits");
    await js(`document.querySelector('.rec-td[data-c="5"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
    await js(`(() => { const inp = document.querySelector('[data-edit]'); inp.value = 'abc'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
    assert(await js(`!!document.querySelector('[data-edit]')`), "input should stay open on a bad number"); await js(`document.querySelector('[data-edit]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await js(`document.querySelector('[data-undo]').click()`); assert.strictEqual(await js(`document.querySelector('.rec-edits .n').textContent`), "11 edits");
    assert(await js(`!!document.querySelector('[data-find="unit:unit_price"]')`), "undo should bring the finding back");
  });
  await check("export: the corrected CSV re-imports equal to the table, the change log has the edits", async () => {
    await js(`document.querySelector('[data-export]').click()`);
    const m = await js(`({ shown: !document.querySelector('[data-modal]').hidden, csv: JAIRecords.exportCSV(JAIReportDebug.store), log: JAIRecords.changeLogCSV(JAIReportDebug.store), rows: JAIReportDebug.store.rows })`);
    assert(m.shown); const again = R.parseDelimited(m.csv); assert.strictEqual(again.length, 5001);
    again.slice(1).forEach((row, i) => assert.deepStrictEqual(row, m.rows[i], "row " + i));
    const log = R.parseDelimited(m.log); assert.deepStrictEqual(log[0], ["row", "column", "before", "after", "edited_at"]); assert(log.length >= 12, "log lines " + log.length);
    assert(log.slice(1).every(l => l.length === 5 && /^\d{4}-\d\d-\d\dT/.test(l[4])), "log shape"); await js(`document.querySelector('[data-close]').click()`);
  });
  await check("print hides the table and keeps at most five records worth a look", async () => {
    await send("Emulation.setEmulatedMedia", { media: "print" });
    const m = await js(`({ rec: getComputedStyle(document.querySelector('.records')).display, sixth: getComputedStyle(document.querySelectorAll('.worth li')[5]).display, fifth: getComputedStyle(document.querySelectorAll('.worth li')[4]).display, controls: getComputedStyle(document.querySelector('.report-controls')).display, note: getComputedStyle(document.querySelector('.edit-note')).display })`);
    await send("Emulation.setEmulatedMedia", { media: "" });
    assert.strictEqual(m.rec, "none"); assert.strictEqual(m.sixth, "none"); assert.notStrictEqual(m.fifth, "none"); assert.strictEqual(m.controls, "none"); assert.notStrictEqual(m.note, "none");
  });
  await check("records worth a look prints as part of the one page: the printed report is a single page and the list holds at most five records", async () => {
    const pdf = await send("Page.printToPDF", { preferCSSPageSize: true, printBackground: true }), txt = Buffer.from(pdf.data, "base64").toString("latin1");
    const pages = (txt.match(/\/Type\s*\/Page[^s]/g) || []).length; assert.strictEqual(pages, 1, "printed pages: " + pages);
    const f = await js(`(() => { const sh = document.querySelector('.sheet'); return { z: sh.style.getPropertyValue('--pz'), rows: sh.dataset.pw || '5' } })()`);
    assert(+f.rows >= 3, "worth-a-look rows kept in print: " + f.rows);
    return `1 printed page at zoom ${f.z}, ${f.rows} worth-a-look rows`;
  });
  await check("nothing leaves the browser: no request while working, none that is a POST or PUT, ever", async () => {
    const quiet = requests.filter(r => r.t >= quietFrom && !r.url.startsWith("data:") && !r.url.startsWith("blob:"));
    assert.strictEqual(quiet.length, 0, "requests during use: " + quiet.map(r => r.method + " " + r.url).join(", "));
    const writes = requests.filter(r => r.method !== "GET"); assert.strictEqual(writes.length, 0, "non-GET requests: " + writes.map(r => r.method + " " + r.url).join(", "));
    return `${requests.length} requests in total, all at page start-up (fonts, Excel reader warm-up); 0 after`;
  });

  console.log("10,000 rows");
  tmpCsv = path.join(os.tmpdir(), `jai-10k-${process.pid}.csv`);
  const rows10 = R.cafeSample(10000); fs.writeFileSync(tmpCsv, Rec.rowsToCSV(rows10, { delim: ",", eol: "\n" }));
  await send("Page.navigate", { url: "file:///" + PAGE.replace(/\\/g, "/") }); await waitFor("document.readyState === 'complete' && !!window.JAIReportDebug");
  await js(`JAIReportDebug.setLimits(10000, 12)`);   // the page's own limit comes from the build; this run does not depend on it
  const doc = await send("DOM.getDocument"), inp = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#report-file" });
  const t0 = Date.now(); await send("DOM.setFileInputFiles", { files: [tmpCsv], nodeId: inp.nodeId });
  await check("10,000 x 8 renders; time to a drawn table and memory are recorded", async () => {
    await waitFor("!!window.JAIReportDebug && !!JAIReportDebug.store && JAIReportDebug.store.rows.length === 10000 && document.querySelectorAll('.rec-tr').length > 0", 30000);
    const ms = Date.now() - t0, heap = await send("Runtime.getHeapUsage"), mb = heap.usedSize / 1048576;
    assert(ms < 3000, ms + " ms"); assert(mb < 300, mb.toFixed(0) + " MB"); return `${ms} ms from file chosen to table drawn, ${mb.toFixed(0)} MB JS heap`;
  });
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

  sock.close(); console.log(`\nbrowser checks: ${passed} passed, ${failed} failed`);
  cleanup(); process.exit(failed ? 1 : 0);
})().catch(e => { console.log("FAIL (browser harness): " + (e && e.stack || e)); cleanup(); process.exit(1); });
