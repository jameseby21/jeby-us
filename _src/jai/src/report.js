/* JA Insights one-page report. Everything runs here, on the visitor's device: the file is read with FileReader,
   analysed in memory and drawn as SVG. Nothing is uploaded, stored or sent. Closing the tab discards it. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = $("#report-app"); if (!root) return;
  const RATE = +root.dataset.rate || 95, MAXR = +root.dataset.maxRows || 200000, MAXC = +root.dataset.maxCols || 1e6;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (v, d = 0) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + "M" : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(1) + "K" : v.toLocaleString("en-US", { maximumFractionDigits: d }));
  const full = (v, d = 2) => v.toLocaleString("en-US", { maximumFractionDigits: d });
  const pct = (a, b) => b ? (100 * a / b) : 0;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dstr = t => { const d = new Date(t); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };

  // ---------- reading
  function parseDelimited(text) {
    text = text.replace(/^﻿/, "");
    const first = text.slice(0, 5000).split(/\r?\n/)[0] || "";
    const delim = [",", "\t", ";", "|"].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
      if (c === '"' && cell === "") q = true;
      else if (c === delim) { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ""));
  }
  let xlsxReady = null;
  const loadXLSX = () => xlsxReady || (xlsxReady = new Promise((res, rej) => {
    if (window.XLSX) return res(window.XLSX);
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => res(window.XLSX); s.onerror = () => { xlsxReady = null; rej(new Error("Excel reader didn't load")); }; document.head.appendChild(s);
  }));
  // warm the Excel reader up front so the offline check holds for .xlsx too
  ("requestIdleCallback" in window ? requestIdleCallback : setTimeout)(() => loadXLSX().catch(() => {}));

  async function readFile(file) {
    const name = file.name, ext = name.split(".").pop().toLowerCase();
    if (["xlsx", "xlsm", "xls"].includes(ext)) {
      const X = await loadXLSX(); const wb = X.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }).map(r => r.map(v => v instanceof Date ? v.toISOString().slice(0, 10) : String(v)));
      return { name, sheet: wb.SheetNames[0], rows: rows.filter(r => r.some(c => c.trim() !== "")) };
    }
    return { name, rows: parseDelimited(await file.text()) };
  }

  // ---------- typing
  const num = s => {
    let t = String(s).trim(); if (!t) return NaN; let neg = false;
    if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
    t = t.replace(/[$€£\s]/g, ""); if (t.endsWith("%")) t = t.slice(0, -1);
    if (!/\d/.test(t) || !/^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?$/.test(t)) return NaN;
    const v = parseFloat(t.replace(/,/g, "")); return neg ? -v : v;
  };
  const mk = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) ? Date.UTC(y, m - 1, d) : null;
  const dt = s => {
    const t = String(s).trim(); let m;
    if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T ])/))) return mk(+m[1], +m[2], +m[3]);
    if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:$|\s)/))) { let y = +m[3]; if (y < 100) y += y < 50 ? 2000 : 1900; return mk(y, +m[1], +m[2]); }
    if (/[a-z]{3}/i.test(t) && /\d{4}/.test(t)) { const d = new Date(t); if (!isNaN(d)) return mk(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
    return null;
  };
  const ID_RE = /(^|[_\s-])(id|uuid|guid|sku|code|no|num|number|#)$|^id[_\s-]|_id$/i;
  const MEASURE_RE = /amount|total|revenue|sales|price|cost|value|spend|income|profit|paid|qty|quantity|units|hours/i;
  const DATE_RE = /date|time|day|month|created|ordered|posted|period/i;
  const CAT_RE = /category|type|region|store|location|branch|product|item|channel|segment|status|department|city|state|team|source|payment|method/i;

  function profileCol(name, vals) {
    const n = vals.length, ne = [];
    vals.forEach(v => { if (String(v).trim() !== "") ne.push(String(v)); });
    const k = ne.length, distinct = new Set(ne).size;
    const nums = ne.map(num), nNum = nums.filter(x => !isNaN(x)).length;
    const dates = ne.map(dt), nDate = dates.filter(x => x != null).length;
    let type = "empty";
    if (k) {
      if (nNum / k >= .9 && !(DATE_RE.test(name) && nDate / k >= .9)) type = "number";
      else if (nDate / k >= .9) type = "date";
      else if (distinct <= Math.max(30, k * .05) && distinct <= k * .6) type = "category";
      else type = "text";
    }
    const avgLen = k ? ne.reduce((a, s) => a + s.length, 0) / k : 0;
    const idLike = k >= 10 && distinct >= k * .98 && (ID_RE.test(name.trim()) || (type === "text" && avgLen <= 24));
    if (idLike) type = "id";
    return { name, n, filled: k, empty: n - k, distinct, type, bad: type === "number" ? k - nNum : 0, badEx: type === "number" ? ne.find(v => isNaN(num(v))) : null, mixed: type === "text" && nNum / k >= .5 && nNum / k < .9 ? k - nNum : 0, avgLen };
  }
  const median = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  // ---------- analysis
  function analyse(data, choice = {}) {
    let rows = data.rows; if (rows.length < 2) throw new Error("That file doesn't have a header row and at least one row of data.");
    const allCols = rows[0].length, allRows = rows.length - 1;
    let header = rows[0].slice(0, MAXC).map((h, i) => String(h).trim() || `Column ${i + 1}`);
    const seenH = {}; header = header.map(h => (seenH[h] = (seenH[h] || 0) + 1) > 1 ? `${h} (${seenH[h]})` : h);
    const body = rows.slice(1, MAXR + 1).map(r => header.map((_, i) => r[i] == null ? "" : String(r[i])));
    const truncated = allRows > MAXR || allCols > MAXC;
    const N = body.length, cols = header.map((h, i) => ({ ...profileCol(h, body.map(r => r[i])), i }));

    const pick = (list, re, want) => (want && list.find(c => c.name === want)) || list.find(c => re.test(c.name)) || list[0] || null;
    const numCols = cols.filter(c => c.type === "number");
    const measureCands = numCols.filter(c => !/year|zip|postal|phone|lat|lon/i.test(c.name));
    const sumAbs = c => body.reduce((a, r) => a + Math.abs(num(r[c.i]) || 0), 0);
    const measure = (choice.measure && cols.find(c => c.name === choice.measure)) || measureCands.find(c => MEASURE_RE.test(c.name) && !/qty|quantity|units/i.test(c.name)) || measureCands.find(c => MEASURE_RE.test(c.name)) || [...measureCands].sort((a, b) => sumAbs(b) - sumAbs(a))[0] || null;
    const dateCol = pick(cols.filter(c => c.type === "date"), DATE_RE, choice.date);
    const catCands = cols.filter(c => c.type === "category" && c.distinct >= 2);
    const cat = choice.cat === "" ? null : pick(catCands, CAT_RE, choice.cat);

    const checks = [], findings = [];
    const add = (sev, title, detail, score, solo = true) => { checks.push({ sev, title, detail }); if (sev !== "ok" && solo) findings.push({ title, detail, score }); };
    const total = measure ? body.reduce((a, r) => a + (num(r[measure.i]) || 0), 0) : 0;

    // duplicates
    const seen = new Map(); let dupRows = 0, dupValue = 0;
    body.forEach(r => { const k = r.join("\u0001"); if (seen.has(k)) { dupRows++; if (measure) dupValue += num(r[measure.i]) || 0; } else seen.set(k, 1); });
    const idCols = cols.filter(c => c.type === "id");
    let nearDup = 0, nearExample = null;
    if (idCols.length) {
      const m2 = new Map();
      body.forEach((r, ri) => { const k = r.filter((_, i) => !idCols.some(c => c.i === i)).join("\u0001");
        if (m2.has(k)) { nearDup++; if (!nearExample) nearExample = [m2.get(k), ri]; } else m2.set(k, ri); });
      nearDup = Math.max(0, nearDup - dupRows);
    }
    const both = dupRows && nearDup, ex = nearExample ? ` (rows ${nearExample[0] + 2} and ${nearExample[1] + 2}, for example)` : "";
    if (dupRows) add("fix", `${dupRows} row${dupRows > 1 ? "s appear" : " appears"} twice`, `Identical in every column.${measure && total ? ` Together they add ${full(dupValue)} to ${measure.name}, ${pct(dupValue, total).toFixed(1)}% of the total.` : ""}`, 90, !both);
    if (nearDup) add("fix", `${nearDup} likely double entr${nearDup > 1 ? "ies" : "y"}`, `Rows that match on everything except ${idCols.map(c => c.name).join(", ")}${ex}. Same record, two IDs.`, 95, !both);
    if (both) findings.push({ title: `${dupRows + nearDup} rows look entered twice`, detail: `${dupRows} are exact copies. ${nearDup} more match on everything except ${idCols.map(c => c.name).join(", ")}${ex}: the same record under a new ID.`, score: 95 });
    if (!dupRows && !nearDup) add("ok", "No duplicate rows", "Every row is unique.");

    // empties
    const emptyCells = cols.reduce((a, c) => a + c.empty, 0), totalCells = N * cols.length;
    const gappy = cols.filter(c => c.type !== "empty" && !(c.type === "text" && c.avgLen > 12) && c.empty / N > .02).sort((a, b) => b.empty - a.empty);
    const emptyCols = cols.filter(c => c.type === "empty");
    if (gappy.length) add(gappy[0].empty / N > .1 ? "fix" : "look", `${gappy.length === 1 ? gappy[0].name + " has" : gappy.length + " columns have"} gaps`, gappy.slice(0, 3).map(c => `${c.name} ${pct(c.empty, N).toFixed(1)}% empty`).join(" · ") + ".", 60 + Math.min(30, pct(gappy[0].empty, N)));
    else add("ok", "Few empty cells", `${pct(emptyCells, totalCells).toFixed(1)}% of all cells are blank.`);
    if (emptyCols.length) add("look", `${emptyCols.length} empty column${emptyCols.length > 1 ? "s" : ""}`, emptyCols.map(c => c.name).join(", ") + " never has a value.", 30);

    // spelling variants in categories
    const variants = [];
    cols.filter(c => c.type === "category" || c.type === "text").forEach(c => {
      const g = new Map(); body.forEach(r => { const raw = r[c.i]; if (!raw.trim()) return; const k = raw.trim().toLowerCase().replace(/\s+/g, " "); if (!g.has(k)) g.set(k, new Map()); const m = g.get(k); m.set(raw, (m.get(raw) || 0) + 1); });
      g.forEach(m => { if (m.size > 1) { const forms = [...m.entries()].sort((a, b) => b[1] - a[1]); variants.push({ col: c.name, forms, rows: forms.slice(1).reduce((a, f) => a + f[1], 0) }); } });
    });
    if (variants.length) { const v = variants.sort((a, b) => b.rows - a.rows)[0];
      add("fix", `${variants.length} value${variants.length > 1 ? "s are" : " is"} spelled more than one way`, `In ${v.col}: ${v.forms.slice(0, 3).map(f => `“${f[0]}”`).join(", ")} count as different ${v.col} values in every report. ${variants.reduce((a, x) => a + x.rows, 0)} rows affected.`, 80); }
    else add("ok", "Consistent spelling", "No values that differ only by capitals or spaces.");

    // mixed types
    const bad = cols.filter(c => c.bad).sort((a, b) => b.bad - a.bad);
    if (bad.length) add("look", `${bad[0].name} has ${bad[0].bad} value${bad[0].bad > 1 ? "s" : ""} that aren't numbers`, `Like “${String(bad[0].badEx).slice(0, 20)}”. Sums and averages quietly skip ${bad[0].bad > 1 ? "them" : "it"}.`, 58);
    const mixed = cols.filter(c => c.mixed);
    if (mixed.length) add("look", `${mixed[0].name} mixes numbers and text`, `${mixed[0].mixed} values in a mostly numeric column aren't numbers, so sums and averages skip them.`, 55);

    // outliers and odd signs
    let outlierNote = null;
    numCols.forEach(c => {
      const vals = []; body.forEach((r, ri) => { const v = num(r[c.i]); if (!isNaN(v)) vals.push([v, ri]); });
      const xs = vals.map(v => v[0]), med = median(xs), mad = median(xs.map(x => Math.abs(x - med)));
      const pos = xs.filter(x => x > 0).length / (xs.length || 1);
      const srt = [...xs].sort((a, b) => a - b), q = srt[Math.floor((srt.length - 1) * (srt.length >= 200 ? .99 : .95))];
      const odd = vals.filter(([x]) => q > 0 && x > 4 * q).sort((a, b) => b[0] - a[0]);
      if (odd.length && c.type !== "id" && !(/year|zip|phone/i.test(c.name)) && !outlierNote) {
        const [x, ri] = odd[0], when = dateCol ? ` on ${dstr(dt(body[ri][dateCol.i]))}` : "";
        outlierNote = { col: c.name, x, ri, ratio: med ? x / med : 0 };
        add("look", `An unusually large ${c.name}`, `Row ${ri + 2} has ${full(x)}${when}, ${med ? (x / med).toFixed(0) + "× the typical value" : "far from the rest"}. A typo, or a real big one?`, 75);
      }
      const negs = xs.filter(x => x < 0).length;
      if (pos >= .95 && negs) add("look", `${negs} negative ${c.name}${negs > 1 ? " values" : ""}`, `Almost every ${c.name} is positive. Refunds or returns are fine if they're meant to be here.`, 35);
    });
    if (!outlierNote) add("ok", "No extreme values", "Nothing far outside the normal range.");

    // dates
    let trend = null;
    if (dateCol) {
      const ds = body.map(r => dt(r[dateCol.i])).filter(x => x != null), now = Date.now();
      const future = ds.filter(x => x > now + 864e5).length, ancient = ds.filter(x => x < Date.UTC(1950, 0, 1)).length;
      if (future || ancient) add("look", "Dates outside a sensible range", `${future ? future + " in the future" : ""}${future && ancient ? ", " : ""}${ancient ? ancient + " before 1950" : ""}.`, 50);
      const lo = Math.min(...ds), hi = Math.max(...ds), span = (hi - lo) / 864e5;
      const unit = span > 150 ? "month" : span > 28 ? "week" : "day";
      const key = t => { const d = new Date(t); if (unit === "month") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); if (unit === "week") return t - ((d.getUTCDay() + 6) % 7) * 864e5; return t; };
      const agg = new Map(); body.forEach(r => { const t = dt(r[dateCol.i]); if (t == null) return; const k = key(t); agg.set(k, (agg.get(k) || 0) + (measure ? (num(r[measure.i]) || 0) : 1)); });
      const keys = [...agg.keys()].sort((a, b) => a - b), step = unit === "month" ? null : (unit === "week" ? 7 : 1) * 864e5;
      const series = []; if (keys.length) { let k = keys[0]; while (k <= keys[keys.length - 1]) { series.push({ t: k, v: agg.get(k) || 0 }); if (step) k += step; else { const d = new Date(k); k = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); } } }
      const lastEnd = unit === "month" ? Date.UTC(new Date(hi).getUTCFullYear(), new Date(hi).getUTCMonth() + 1, 0) : unit === "week" ? key(hi) + 6 * 864e5 : hi;
      const partialLast = series.length > 2 && hi < lastEnd - 2 * 864e5;
      const firstStart = series.length ? series[0].t : lo, partialFirst = series.length > 2 && lo > firstStart + 2 * 864e5;
      const core = series.filter((_, i) => !(partialFirst && i === 0) && !(partialLast && i === series.length - 1));
      const pm = median(core.map(p => p.v)); let spike = null;
      core.forEach(p => { const r = pm ? p.v / pm : 0; if (r >= 1.5 && (!spike || r > spike.r)) spike = { ...p, r }; });
      const label = t => { const d = new Date(t); return unit === "month" ? `${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` : `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`; };
      trend = { unit, series, label, spike, partialFirst, partialLast, lo, hi, median: pm };
      if (spike) findings.push({ title: `${unit === "month" ? new Date(spike.t).toLocaleString("en-US", { month: "long", timeZone: "UTC" }) : "The " + unit + " of " + label(spike.t)} is ${spike.r.toFixed(1)}× a typical ${unit}`, detail: `${measure ? measure.name : "Rows"}: ${full(spike.v, 0)} against a typical ${full(pm, 0)}. Worth knowing why${outlierNote && dateCol && key(dt(body[outlierNote.ri][dateCol.i])) === spike.t ? ", and the large value above falls in it" : ""}.`, score: 70 });
    }

    // breakdown
    let breakdown = null;
    if (cat) {
      const g = new Map(); body.forEach(r => { const k = r[cat.i].trim() || "(blank)"; g.set(k, (g.get(k) || 0) + (measure ? (num(r[measure.i]) || 0) : 1)); });
      let items = [...g.entries()].sort((a, b) => b[1] - a[1]); const top = items.slice(0, 7), rest = items.slice(7);
      if (rest.length) top.push([`Other (${rest.length})`, rest.reduce((a, x) => a + x[1], 0), true]);
      breakdown = { col: cat.name, items: top, total: items.reduce((a, x) => a + x[1], 0) };
      if (items.length > 1 && items[0][1] / breakdown.total >= .5) findings.push({ title: `${items[0][0]} is ${pct(items[0][1], breakdown.total).toFixed(0)}% of ${measure ? measure.name : "rows"}`, detail: `One ${cat.name} carries most of the total. Good to know before you plan around averages.`, score: 40 });
    }

    findings.sort((a, b) => b.score - a.score);
    const needsCleanup = checks.some(c => c.sev === "fix");
    return { name: data.name, sheet: data.sheet, N, truncated, allRows, allCols, cols, header, measure, dateCol, cat, total, checks, findings: findings.slice(0, 3), trend, breakdown, needsCleanup, numCols, catCands, dateCands: cols.filter(c => c.type === "date") };
  }

  // ---------- drawing
  const niceMax = m => { if (m <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(m))), f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
  function lineSVG(tr, measureName) {
    const W = 680, H = 210, L = 56, R = 18, T = 26, B = 26, s = tr.series; if (s.length < 2) return "";
    const max = niceMax(Math.max(...s.map(p => p.v)) * 1.05), min = Math.min(0, ...s.map(p => p.v));
    const X = i => L + i * (W - L - R) / (s.length - 1), Y = v => T + (H - T - B) * (1 - (v - min) / (max - min));
    let g = ""; for (let i = 0; i <= 4; i++) { const v = min + (max - min) * i / 4; g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/><text x="${L - 8}" y="${Y(v) + 3.5}" text-anchor="end" class="tk">${fmt(v)}</text>`; }
    const every = Math.ceil(s.length / 12);
    s.forEach((p, i) => { if (i % every === 0 || i === s.length - 1) g += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle" class="tk">${tr.label(p.t)}</text>`; });
    const d = s.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join("");
    let marks = ""; s.forEach((p, i) => { const part = (tr.partialFirst && i === 0) || (tr.partialLast && i === s.length - 1);
      marks += `<circle cx="${X(i)}" cy="${Y(p.v)}" r="4" class="${part ? "pt part" : "pt"}"/>`; });
    let note = "";
    if (tr.spike) { const i = s.findIndex(p => p.t === tr.spike.t), cx = X(i), cy = Y(tr.spike.v), left = cx > W * .6;
      note = `<path class="ring" d="M${cx - 15} ${cy + 3}C${cx - 16} ${cy - 15} ${cx + 15} ${cy - 17} ${cx + 16} ${cy - 1}C${cx + 17} ${cy + 15} ${cx - 11} ${cy + 17} ${cx - 17} ${cy - 4}"/><text class="note" x="${left ? cx - 24 : cx + 24}" y="${Math.max(16, cy - 8)}" text-anchor="${left ? "end" : "start"}">${tr.spike.r.toFixed(1)}× typical</text>`; }
    if (tr.partialLast) { const i = s.length - 1; note += `<text class="tk" x="${X(i)}" y="${Y(s[i].v) - 10}" text-anchor="end">partial</text>`; }
    const hits = s.map((p, i) => { const w = (W - L - R) / Math.max(1, s.length - 1); return `<rect x="${X(i) - w / 2}" y="${T}" width="${w}" height="${H - T - B}" fill="transparent" data-x="${X(i)}" data-tip="${tipSafe(tr.label(p.t))}${(tr.partialFirst && i === 0) || (tr.partialLast && i === s.length - 1) ? " (partial)" : ""}: <b>${esc(full(p.v, 0))}</b>"/>`; }).join("");
    return `<svg viewBox="0 0 ${W} ${H}" class="chart line" role="img" aria-label="${esc(measureName)} by ${tr.unit}">${g}<line class="xh" x1="0" x2="0" y1="${T}" y2="${H - B}"/><path d="${d}" class="ln"/>${marks}${note}${hits}</svg>`;
  }
  function barsSVG(bd) {
    const rowH = 30, W = 420, L = 150, R = 64, H = bd.items.length * rowH + 4, max = Math.max(...bd.items.map(x => x[1]), 1);
    return `<svg viewBox="0 0 ${W} ${H}" class="chart bars" role="img" aria-label="Totals by ${esc(bd.col)}">` + bd.items.map(([k, v, other], i) => {
      const y = i * rowH + 6, w = Math.max(2, (W - L - R) * Math.max(0, v) / max), h = 18, r = Math.min(4, w / 2);
      const norm = k.trim().toLowerCase().replace(/\s+/g, " "), variant = !other && bd.items.some(([k2, v2], j) => j !== i && k2.trim().toLowerCase().replace(/\s+/g, " ") === norm && (v2 > v || (v2 === v && j < i)));
      const lab = (variant ? k.replace(/ {2,}/g, m => "·".repeat(m.length)) : k).slice(0, variant ? 12 : 18) + (k.length > (variant ? 12 : 18) ? "…" : "");
      return `<g data-tip="${tipSafe(k)}: <b>${esc(full(v, 0))}</b> · ${pct(v, bd.total).toFixed(1)}%"><rect x="0" y="${y - 6}" width="${W}" height="${rowH}" fill="transparent"/>
        <text x="${L - 10}" y="${y + 13}" text-anchor="end" class="bl">${esc(lab)}${variant ? `<tspan class="var"> variant</tspan>` : ""}</text>
        <path class="${other ? "bar other" : "bar"}" d="M${L} ${y}h${w - r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 -${r} ${r}h-${w - r}z"/>
        <text x="${L + w + 6}" y="${y + 13}" class="bv">${esc(fmt(v))}</text></g>`; }).join("") + "</svg>";
  }

  const tipSafe = s => esc(esc(s));
  const ICON = { ok: "✓", look: "!", fix: "×" }, SEVL = { ok: "Fine", look: "Look", fix: "Fix" };
  function render(a) {
    const out = $("#report-out"), today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const yr = t => new Date(t).getUTCFullYear(), md = t => { const d = new Date(t); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`; }, my = t => { const d = new Date(t); return `${MON[d.getUTCMonth()]} ${yr(t)}`; };
    const range = !a.trend ? "No date column" : yr(a.trend.lo) === yr(a.trend.hi) ? `${md(a.trend.lo)} – ${md(a.trend.hi)}, ${yr(a.trend.hi)}` : `${my(a.trend.lo)} – ${my(a.trend.hi)}`;
    const kpi = [["Rows", a.N.toLocaleString("en-US")], ["Columns", a.cols.length], ["Dates", range], [a.measure ? "Total " + a.measure.name : "Measure", a.measure ? full(a.total, 0) : "None found"]];
    const opt = (list, cur, none) => (none ? `<option value=""${cur ? "" : " selected"}>${none}</option>` : "") + list.map(c => `<option${cur && c.name === cur.name ? " selected" : ""}>${esc(c.name)}</option>`).join("");
    const prof = a.cols.slice(0, 12).map(c => `<tr><td>${esc(c.name)}</td><td>${c.type}</td><td>${pct(c.filled, a.N).toFixed(0)}%</td><td>${c.distinct.toLocaleString("en-US")}</td></tr>`).join("") + (a.cols.length > 12 ? `<tr><td colspan="4" class="more">+${a.cols.length - 12} more columns</td></tr>` : "");
    const next = a.needsCleanup ? ["Data health check", 8, "a person reads the data and writes down what to fix first"] : ["Focused analysis", 20, "one question answered properly, with the uncertainty stated"];
    const trendSvg = a.trend && a.trend.series.length > 1 ? lineSVG(a.trend, a.measure ? a.measure.name : "Rows") : "";
    const tableRows = (a.trend ? a.trend.series.map(p => `<tr><td>${a.trend.label(p.t)}</td><td>${full(p.v, 0)}</td></tr>`).join("") : "");
    out.innerHTML = `
<div class="report-controls" role="group" aria-label="Report settings">
  <label>Measure <select data-ch="measure">${opt(a.numCols, a.measure, a.numCols.length ? "" : "Row count")}</select></label>
  <label>Date <select data-ch="date">${opt(a.dateCands, a.dateCol, a.dateCands.length ? "" : "None")}</select></label>
  <label>Group by <select data-ch="cat">${opt(a.catCands, a.cat, "None")}</select></label>
  <span class="sp"></span><button class="btn small" type="button" data-print>Print or save as PDF</button><button class="btn small" type="button" data-reset>Start over</button>
</div>
<article class="sheet" aria-label="One-page report">
  <header class="sh-head"><div><span class="wm"><b>JA</b>Insights</span><span class="label">One-page report</span></div>
    <div class="sh-meta"><b>${esc(a.name)}${a.sheet ? " · " + esc(a.sheet) : ""}</b><span>${today} · made in your browser, nothing uploaded${a.truncated ? ` · free limit: ${Math.min(a.allRows, MAXR).toLocaleString("en-US")} rows × ${Math.min(a.allCols, MAXC)} columns` : ""}</span></div></header>
  <div class="sh-kpis">${kpi.map(([l, v]) => `<div><span class="label">${esc(l)}</span><b${String(v).length > 14 ? ' class="long"' : ""}>${esc(v)}</b></div>`).join("")}</div>
  <div class="sh-two">
    <section><h3>What stands out</h3>${a.findings.length ? `<ol class="finds">${a.findings.map(f => `<li><b>${esc(f.title)}</b><span>${esc(f.detail)}</span></li>`).join("")}</ol>` : `<p class="calm">Nothing jumped out. That's rarer than you'd think.</p>`}</section>
    <section><h3>Data health</h3><ul class="checks">${a.checks.slice(0, 7).map(c => `<li class="${c.sev}"><i aria-hidden="true">${ICON[c.sev]}</i><span><b>${esc(c.title)}</b><em class="sr">${SEVL[c.sev]}. </em></span></li>`).join("")}</ul></section>
  </div>
  ${trendSvg ? `<section class="sh-trend"><h3>${esc(a.measure ? a.measure.name : "Rows")} by ${a.trend.unit}</h3><div class="chart-wrap">${trendSvg}<div class="tip" hidden></div></div></section>` : `<section class="sh-trend"><h3>Trend</h3><p class="calm">No date column found. Add one and this space shows the trend.</p></section>`}
  <div class="sh-two">
    <section>${a.breakdown ? `<h3>${esc(a.measure ? a.measure.name : "Rows")} by ${esc(a.breakdown.col)}</h3><div class="chart-wrap">${barsSVG(a.breakdown)}<div class="tip" hidden></div></div>` : `<h3>Breakdown</h3><p class="calm">No column with a short list of repeating values to group by.</p>`}</section>
    <section><h3>Columns</h3><table class="prof"><thead><tr><th>Column</th><th>Type</th><th>Filled</th><th>Distinct</th></tr></thead><tbody>${prof}</tbody></table></section>
  </div>
  <footer class="sh-foot"><div><span class="label">What I'd do next</span><p><b>${next[0]}</b>, ${next[1]} h × $${RATE} = $${(next[1] * RATE).toLocaleString("en-US")}: ${next[2]}. This page is an automatic first pass; that's the human one.</p></div>
    <span class="stamp">Checked</span></footer>
</article>
${tableRows ? `<details class="tableview"><summary>Chart data as a table</summary><table class="prof"><thead><tr><th>${a.trend.unit}</th><th>${esc(a.measure ? a.measure.name : "Rows")}</th></tr></thead><tbody>${tableRows}</tbody></table></details>` : ""}
${a.truncated ? `<p class="calm limit">The free report reads the first ${MAXR.toLocaleString("en-US")} rows and ${MAXC} columns. This file has ${a.allRows.toLocaleString("en-US")} rows and ${a.allCols} columns. The Data health check reads all of it.</p>` : ""}`;
    $$(".chart-wrap", out).forEach(wrap => {
      const tip = $(".tip", wrap), svg = $("svg", wrap), xh = $(".xh", wrap);
      const show = (el, ev) => { tip.innerHTML = el.dataset.tip; tip.hidden = false; const r = wrap.getBoundingClientRect(); tip.style.left = Math.min(r.width - 10, Math.max(10, ev.clientX - r.left)) + "px"; tip.style.top = (ev.clientY - r.top) + "px";
        if (xh && el.dataset.x) { xh.setAttribute("x1", el.dataset.x); xh.setAttribute("x2", el.dataset.x); xh.style.opacity = 1; } };
      $$("[data-tip]", svg).forEach(el => { el.addEventListener("pointermove", e => show(el, e)); el.addEventListener("pointerleave", () => { tip.hidden = true; if (xh) xh.style.opacity = 0; }); });
    });
    const st = $(".stamp", out); requestAnimationFrame(() => st.classList.add("hit"));
    out.hidden = false; $("#report-intake").hidden = true;
    out.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  // ---------- wiring
  let current = null, choice = {};
  const status = msg => { $("#report-status").textContent = msg; };
  async function run(data) {
    try { const t0 = performance.now(); current = data; choice = {}; const a = analyse(data); render(a); status(`Read ${a.N.toLocaleString("en-US")} rows in ${Math.round(performance.now() - t0)} ms, on this device.`); }
    catch (e) { status(e.message || "That file couldn't be read."); }
  }
  $("#report-out").addEventListener("change", e => { const s = e.target.closest("[data-ch]"); if (!s || !current) return; choice[s.dataset.ch] = s.value; render(analyse(current, choice)); });
  $("#report-out").addEventListener("click", e => {
    if (e.target.closest("[data-print]")) window.print();
    if (e.target.closest("[data-reset]")) { current = null; $("#report-out").hidden = true; $("#report-out").innerHTML = ""; $("#report-intake").hidden = false; $("#report-file").value = ""; status(""); }
  });
  const file = $("#report-file"), drop = $("#report-drop");
  file.addEventListener("change", async () => { if (file.files[0]) { status("Reading…"); try { run(await readFile(file.files[0])); } catch (e) { status(e.message); } } });
  ["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", async e => { const f = e.dataTransfer.files[0]; if (f) { status("Reading…"); try { run(await readFile(f)); } catch (x) { status(x.message); } } });

  // made-up sample: a year of café sales with the usual problems planted in it
  $("#report-sample").addEventListener("click", () => {
    let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const stores = ["Brickell", "Wynwood", "Coral Gables", "Little Havana"], cats = [["Coffee", 4.5, 2], ["Pastry", 3.75, 1.5], ["Sandwich", 9.5, 3], ["Merch", 18, 8], ["Catering", 85, 40]];
    const rows = [["order_id", "date", "store", "category", "qty", "amount", "payment"]]; let id = 10000;
    for (let d = Date.UTC(2025, 0, 1); d <= Date.UTC(2025, 11, 31); d += 864e5) {
      const m = new Date(d).getUTCMonth(), n = 2 + Math.floor(rnd() * 3) + (m === 11 ? 2 : 0);
      for (let k = 0; k < n; k++) {
        const c = cats[Math.min(4, Math.floor(Math.pow(rnd(), 1.6) * 5))], q = 1 + Math.floor(rnd() * 3), amt = +(q * (c[1] + rnd() * c[2])).toFixed(2);
        let st = stores[Math.floor(rnd() * stores.length)]; const r = rnd(); if (st === "Brickell" && r < .08) st = "brickell"; if (st === "Coral Gables" && r < .06) st = "Coral  Gables";
        rows.push([`ORD-${id++}`, new Date(d).toISOString().slice(0, 10), st, c[0], String(q), rnd() < .015 ? "" : amt.toFixed(2), rnd() < .7 ? "Card" : "Cash"]);
      }
    }
    for (let i = 0; i < 5; i++) rows.push([...rows[40 + i * 97]]);                                          // exact duplicates
    for (let i = 0; i < 4; i++) { const r = [...rows[300 + i * 151]]; r[0] = `ORD-${id++}`; rows.push(r); } // same sale, new ID
    rows[512][5] = "4180.00";                                                                                // 41.80 typed without the point
    rows[640][5] = "-12.50";                                                                                 // a refund
    run({ name: "cafe-sales-sample.csv (made up)", rows });
  });
  if (location.hash === "#sample") $("#report-sample").click();
})();
