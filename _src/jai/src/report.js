/* JA Insights one-page report. Everything runs here, on the visitor's device: the file is read with FileReader,
   analysed in memory and drawn as SVG. Nothing is uploaded, stored or sent. Closing the tab discards it.
   The reading and analysing functions are pure (no DOM) and are exported for the Node tests: node _src/jai/tests/run.js */
(() => {
  const HAS_DOM = typeof document !== "undefined";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = HAS_DOM ? $("#report-app") : null;
  let RATE = 95, MAXR = 10000, MAXC = 12;
  if (root) { RATE = +root.dataset.rate || RATE; MAXR = +root.dataset.maxRows || MAXR; MAXC = +root.dataset.maxCols || MAXC; }
  const Rec = typeof module !== "undefined" && module.exports ? require("./records.js") : self.JAIRecords;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (v, d = 0) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + "M" : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(1) + "K" : v.toLocaleString("en-US", { maximumFractionDigits: d }));
  const full = (v, d = 2) => v.toLocaleString("en-US", { maximumFractionDigits: d });
  const pct = (a, b) => b ? (100 * a / b) : 0;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dstr = t => { const d = new Date(t); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
  const plain = s => String(s).replace(/<\/?b>/g, "");
  const setLimits = (rows, cols) => { MAXR = rows; MAXC = cols; };

  // ---------- reading
  function parseDelimited(text) {
    let bom = false; if (text.charCodeAt(0) === 0xFEFF) { bom = true; text = text.slice(1); }
    const first = text.slice(0, 5000).split(/\r?\n/)[0] || "";
    const delim = [",", "\t", ";", "|"].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const eol = (text.match(/\r\n|\n|\r/) || ["\n"])[0], finalEol = /[\r\n]$/.test(text);
    const rows = [], masks = []; let row = [], mk = [], cell = "", q = false, wasQ = false;
    const endCell = () => { row.push(cell); mk.push(wasQ ? 1 : 0); cell = ""; wasQ = false; };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
      if (c === '"' && cell === "" && !wasQ) { q = true; wasQ = true; }
      else if (c === delim) endCell();
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; endCell(); rows.push(row); masks.push(mk); row = []; mk = []; }
      else cell += c;
    }
    if (cell !== "" || row.length || wasQ) { endCell(); rows.push(row); masks.push(mk); }
    const keep = rows.map(r => r.some(c => c.trim() !== "")), out = rows.filter((_, i) => keep[i]);
    out.mask = masks.filter((_, i) => keep[i]); out.fmt = { delim, eol, finalEol, bom };
    return out;
  }
  let xlsxReady = null;
  const loadXLSX = () => xlsxReady || (xlsxReady = new Promise((res, rej) => {
    if (window.XLSX) return res(window.XLSX);
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => res(window.XLSX); s.onerror = () => { xlsxReady = null; rej(new Error("Excel reader didn't load")); }; document.head.appendChild(s);
  }));

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
  const mk = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1000 && y <= 2999) ? Date.UTC(y, m - 1, d) : null;
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
  const NOT_MEASURE = /year|zip|postal|phone|lat|lon|lng/i;

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
    const numShare = k ? nNum / k : 0, wasText = type === "text";
    if (idLike) type = "id";
    return { name, n, filled: k, empty: n - k, distinct, type, bad: type === "number" ? k - nNum : 0, badEx: type === "number" ? ne.find(v => isNaN(num(v))) : null,
      mixed: wasText && !idLike && numShare >= .5 && numShare < .9 ? k - nNum : 0, mixedId: idLike && numShare >= .05 && numShare < .95 ? Math.min(nNum, k - nNum) : 0, avgLen };
  }
  const median = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  // ---------- outliers (CONS-0048): robust tests, per group and per ratio, with the unit and scale checks and a reason in words
  const LN3 = Math.log(3), LN8 = Math.log(8), KSIG = 5;
  const MONEY_RE = /price|amount|total|cost|revenue|sales?\b|value|income|profit|paid|fee|spend|rent|tax/i;
  const human = n => String(n).replace(/[_-]+/g, " ").trim().toLowerCase();
  const money = v => "$" + (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const fv = (isMoney, v) => isMoney ? money(v) : full(v, Math.abs(v) < 10 ? 2 : 1);
  const xs = r => { r = r >= 1 ? r : 1 / r; return (r >= 9.5 ? String(Math.round(r)) : (Math.round(r * 10) / 10).toString()) + "x"; };
  const logStats = l => { const med = median(l); return { med, sig: Math.max(1.4826 * median(l.map(v => Math.abs(v - med))), 0.02), n: l.length }; };
  const CAUSE = {
    1: "Likely an extra zero or a misplaced decimal point.", "-1": "Likely a missing digit.",
    2: "Likely cents entered as dollars, or two extra digits.", "-2": "Likely two digits missing, or dollars entered as cents.",
    3: "Likely a unit mix-up (for example thousands), or three extra digits.", "-3": "Likely a unit mix-up or three missing digits.",
  };

  function detectOutliers(body, cols, o = {}) {
    const N = body.length, items = new Map(), claimed = new Map(), calc = o.calc;
    const numCols = cols.filter(c => c.type === "number" && !NOT_MEASURE.test(c.name));
    const vals = new Map(); const V = c => vals.get(c.i) || (vals.set(c.i, Float64Array.from(body, r => num(r[c.i]))), vals.get(c.i));
    const groupCols = cols.filter(c => c.type === "category" && c.distinct >= 2 && c.distinct <= 40);
    const G = groupCols.map(c => { const ids = new Map(), gid = new Int32Array(N).fill(-1), names = []; body.forEach((r, ri) => { const k = r[c.i].trim(); if (!k) return; if (!ids.has(k)) { ids.set(k, names.length); names.push(k); } gid[ri] = ids.get(k); }); return { col: c, gid, names }; });
    const gstat = new Map();
    const statsFor = (key, v, g) => { const k = key + "|" + g.col.i; if (gstat.has(k)) return gstat.get(k);
      const buckets = g.names.map(() => []); for (let i = 0; i < N; i++) if (g.gid[i] >= 0 && v[i] > 0) buckets[g.gid[i]].push(Math.log(v[i]));
      const st = buckets.map(b => ({ ...logStats(b), l: b })); gstat.set(k, st); return st; };
    const isCount = c => { const v = V(c); let ints = true, pos = []; for (let i = 0; i < N; i++) { if (v[i] !== v[i]) continue; if (v[i] !== Math.floor(v[i])) { ints = false; break; } if (v[i] > 0) pos.push(v[i]); } return ints && median(pos) <= 12; };

    // metrics: every numeric column, then ratios when the columns exist. Ratios go first so a short living area is named for what it is.
    const find = (re, not) => numCols.find(c => re.test(c.name) && !(not && not.test(c.name)));
    const priceC = find(/price|sold/i, /per|psf|sq/i) || find(/amount|value|cost/i, /per|psf|sq/i);
    const areaC = find(/living|sq.?ft|sqft|square|(^|[_\s])area|size/i, /lot/i), lotC = find(/lot/i), bedC = find(/bed/i);
    const metrics = [];
    if (priceC && areaC && priceC !== areaC) metrics.push({ label: "price per sq ft", a: priceC, b: areaC, money: true });
    if (priceC && lotC && priceC !== lotC) metrics.push({ label: "price per lot sq ft", a: priceC, b: lotC, money: true });
    if (priceC && bedC && priceC !== bedC) metrics.push({ label: "price per bedroom", a: priceC, b: bedC, money: true });
    // a total that is qty x price is judged through the qty and the price, so it is left out here
    numCols.filter(c => !(calc && c.i === calc.total)).forEach(c => metrics.push({ label: human(c.name), col: c, money: MONEY_RE.test(c.name), count: isCount(c) }));
    metrics.forEach(m => { const cs = m.col ? [m.col] : [m.a, m.b]; m.key = cs.map(c => c.i).join("/"); if (m.col) m.v = V(m.col); else { const a = V(m.a), b = V(m.b); m.v = Float64Array.from(a, (x, i) => (b[i] > 0 && x > 0 ? x / b[i] : NaN)); } });

    const claim = (ri, ci) => claimed.has(ri + ":" + ci);
    function addCell(id, kind, cell) {
      const k = cell.ri + ":" + cell.ci; if (claimed.has(k)) return false;
      if (calc && cell.ci === calc.total && (claimed.has(cell.ri + ":" + calc.qty) || claimed.has(cell.ri + ":" + calc.price))) return false;
      claimed.set(k, id); let it = items.get(id); if (!it) items.set(id, it = { id, kind, cells: [], via: new Set(), metrics: new Set() }); it.cells.push(cell); return true;
    }
    function unitK(r, sig) { const k = Math.log10(r), kr = Math.round(k); return kr && Math.abs(kr) <= 3 && Math.abs(k - kr) <= Math.max(.07, 2 * sig / Math.LN10) ? kr : 0; }
    // the culprit of a ratio is whichever of the two numbers sits further from its own usual
    function culprit(m, ri, ref) { // ref(c) -> {med(ln), sig}
      const ca = V(m.a)[ri], cb = V(m.b)[ri], sa = ref(m.a), sb = ref(m.b);
      const da = ca > 0 && sa ? Math.abs(Math.log(ca) - sa.med) : 0, db = cb > 0 && sb ? Math.abs(Math.log(cb) - sb.med) : 0;
      return da >= db ? { c: m.a, v: ca, st: sa } : { c: m.b, v: cb, st: sb };
    }
    const metricName = m => m.col ? human(m.col.name) : m.label;
    function reasonFor(m, ri, c, v, st, scope, how) { // how: "group" (its own group's usual), "shift" (the rest of the file), "all" (the whole file)
      const r = v / Math.exp(st.med), k = unitK(r, st.sig), money = MONEY_RE.test(c.name) || (m.money && c === m.a), refv = Math.exp(st.med);
      const usual = how === "group" ? `this ${human(scope)}'s usual` : "the usual", tail = how === "shift" ? " in the rest of the file" : how === "all" ? " across the file" : "";
      let t = `<b>${fv(money, v)} is ${xs(r)}${r >= 1 ? "" : " below"} ${usual} ${fv(money, refv)}${tail}.</b>`;
      if (m.a) t += ` ${m.label[0].toUpperCase() + m.label.slice(1)} comes out at ${fv(true, V(m.a)[ri] / V(m.b)[ri])}.`;
      t += " " + (k ? CAUSE[k] : (r >= 10 || r <= .1) ? "Check it against the source." : "A typo, or a real exception?");
      return { why: t, k, r, refv };
    }
    function flag(m, ri, c, v, st, scope, how, extra) {
      if (!(v > 0)) return; const rs = reasonFor(m, ri, c, v, st, scope, how), r = rs.r, fix = rs.k !== 0 || r >= 10 || r <= .1 || how === "shift";
      const id = how === "shift" ? extra.id : rs.k ? "unit:" + c.name : m.a ? "ratio:" + m.label : "out:" + c.name;
      const rowM = o.measure && o.measure !== c ? V(o.measure)[ri] : NaN;
      const eff = o.measure === c ? Math.abs(v - rs.refv) : (rowM > 0 ? rowM * Math.min(50, Math.abs(1 - 1 / r)) : 0);
      const ok = addCell(id, how === "shift" ? "shift" : rs.k ? "unit" : m.a ? "ratio" : "out", { ri, ci: c.i, sev: fix ? "fix" : "look", why: rs.why, v, ref: rs.refv, r, k: rs.k, eff, label: m.label });
      if (ok) { const it = items.get(id); if (m.a) it.via.add(m.label); it.metrics.add(metricName(m)); if (how === "shift") Object.assign(it, { group: extra.group, gcol: extra.gcol, medG: extra.medG, rest: extra.rest }); if (!it.col) it.col = c; if (!it.scope) it.scope = scope; }
    }

    const medCache = new Map(); const cacheMed = (c, gi, g, l) => { const k = c.i + "|" + g.col.i + "|" + gi; if (!medCache.has(k)) medCache.set(k, l.length ? { med: median(l), sig: .02 } : null); return medCache.get(k); };
    // pass 1: a whole group sitting far from the rest of the file (a city entered with an extra zero)
    metrics.forEach(m => { if (m.count) return;
      const glob = []; for (let i = 0; i < N; i++) if (m.v[i] > 0) glob.push(Math.log(m.v[i]));
      if (glob.length < 30) return; const gm = median(glob);
      G.forEach(g => { if (g.names.length < 3) return; const st = statsFor(m.key, m.v, g), big = st.filter(x => x.n >= 8);
        // a price fixed by the item, say, differs from group to group by nature; only compare groups whose spread inside is not tiny next to the spread between them
        if (big.length < 3) return; const between = Math.max(logStats(big.map(x => x.med)).sig, .1), within = median(big.map(x => x.sig)); if (within < .2 * between) return;
        st.forEach((s, gi) => {
          if (s.n < 8 || s.n > glob.length * .5 || Math.abs(s.med - gm) < Math.log(2)) return;
          const rest = []; for (let i = 0; i < N; i++) if (m.v[i] > 0 && g.gid[i] !== gi) rest.push(Math.log(m.v[i]));
          const restMed = median(rest), d = s.med - restMed; if (Math.abs(d) < LN3) return;
          const dev = []; for (let i = 0; i < N; i++) if (g.gid[i] === gi && m.v[i] > 0 && (d > 0 ? Math.log(m.v[i]) - restMed >= LN3 : restMed - Math.log(m.v[i]) >= LN3)) dev.push(i);
          if (dev.length < .6 * s.n) return;
          const id = `shift:${g.col.name}=${g.names[gi]}`, medAll = exp => exp;
          dev.forEach(ri => {
            if (m.col) flag(m, ri, m.col, m.v[ri], { med: restMed, sig: between }, g.col.name, "shift", { id, group: g.names[gi], gcol: g.col.name, medG: Math.exp(s.med), rest: Math.exp(restMed) });
            else { const cu = culprit(m, ri, c => { const l = []; for (let i = 0; i < N; i++) if (V(c)[i] > 0 && g.gid[i] !== gi) l.push(Math.log(V(c)[i])); return cacheMed(c, gi, g, l); });
              flag(m, ri, cu.c, cu.v, cu.st ? { med: cu.st.med, sig: between } : { med: restMed, sig: between }, g.col.name, "shift", { id, group: g.names[gi], gcol: g.col.name, medG: Math.exp(s.med), rest: Math.exp(restMed) }); }
          });
        });
      });
    });

    // pass 2: a value far from its own group's usual, or (with no group to compare with) from the whole file
    metrics.forEach(m => {
      const floor = m.count ? LN8 : LN3;
      // the group that explains this metric best (the smallest spread inside its groups) is the one a value is judged against
      const usable = G.map(g => { const st = statsFor(m.key, m.v, g), big = st.filter(x => x.n >= 8); return { g, st, w: big.length ? median(big.map(x => x.sig)) : Infinity }; }).filter(u => u.w < Infinity).sort((x, y) => x.w - y.w);
      const globalL = []; if (!usable.length) for (let i = 0; i < N; i++) if (m.v[i] > 0) globalL.push(Math.log(m.v[i]));
      const gs = globalL.length >= 20 ? logStats(globalL) : null;
      for (let ri = 0; ri < N; ri++) {
        const v = m.v[ri]; if (!(v > 0)) continue; const l = Math.log(v); let best = null;
        let judged = false;
        for (const { g, st } of usable) { const gi = g.gid[ri]; if (gi < 0) continue; const s = st[gi]; if (s.n < 8) continue; judged = true;
          const dev = Math.abs(l - s.med), thr = Math.max(floor, KSIG * s.sig); if (dev >= thr) best = { g, gi, s }; break; }
        if (judged && !best) continue;
        if (best) {
          if (m.col) flag(m, ri, m.col, v, best.s, best.g.col.name, "group");
          else { const cu = culprit(m, ri, c => statsFor(c.i, V(c), best.g)[best.g.gid[ri]]); flag(m, ri, cu.c, cu.v, cu.st || best.s, best.g.col.name, "group"); }
        } else if (gs && Math.abs(l - gs.med) >= Math.max(floor, (KSIG + 1) * gs.sig)) {
          if (m.col) flag(m, ri, m.col, v, gs, "", "all");
          else { const cu = culprit(m, ri, c => { const q = []; for (let i = 0; i < N; i++) if (V(c)[i] > 0) q.push(Math.log(V(c)[i])); return logStats(q); }); flag(m, ri, cu.c, cu.v, cu.st || gs, "", "all"); }
        }
      }
    });
    return items;
  }

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
    const measureCands = numCols.filter(c => !NOT_MEASURE.test(c.name));
    const sumAbs = c => body.reduce((a, r) => a + Math.abs(num(r[c.i]) || 0), 0);
    const measure = (choice.measure && cols.find(c => c.name === choice.measure)) || measureCands.find(c => /total|amount|revenue|sales/i.test(c.name)) || measureCands.find(c => MEASURE_RE.test(c.name) && !/qty|quantity|units/i.test(c.name)) || measureCands.find(c => MEASURE_RE.test(c.name)) || [...measureCands].sort((a, b) => sumAbs(b) - sumAbs(a))[0] || null;
    const dateCol = pick(cols.filter(c => c.type === "date"), DATE_RE, choice.date);
    const catCands = cols.filter(c => c.type === "category" && c.distinct >= 2);
    const cat = choice.cat === "" ? null : pick(catCands, CAT_RE, choice.cat);

    // quantity x price = total, when the file has those three columns and the rule holds for nearly every row
    let calc = null;
    { const q = numCols.find(c => /(^|[_\s])(qty|quantity|units|count)$|^(qty|quantity|units)/i.test(c.name)), p = numCols.find(c => /unit.?price|^price$|rate/i.test(c.name)), t = numCols.find(c => /total|line.?amount|extended/i.test(c.name));
      if (q && p && t && new Set([q.i, p.i, t.i]).size === 3) { let ok = 0, n = 0; body.forEach(r => { const a = num(r[q.i]), b = num(r[p.i]), c = num(r[t.i]); if (![a, b, c].some(isNaN)) { n++; if (Math.abs(a * b - c) <= .0051) ok++; } });
        if (n && ok / n >= .9) calc = { qty: q.i, price: p.i, total: t.i }; } }

    const checks = [], findings = [], flags = new Map(), fr = new Map();
    const link = (id, ri, ci, sev, why, fam, eff = 0) => { const k = ri + ":" + ci; if (flags.has(k)) return; flags.set(k, { sev, why, id, fam: fam || "", eff }); (fr.get(id) || fr.set(id, new Set()).get(id)).add(ri); };
    const add = (sev, title, detail, score, solo = true, id = null, crumb = null, noCheck = false) => { if (!noCheck) checks.push({ sev, title, detail }); if (sev !== "ok" && solo) findings.push({ id, sev, title, detail, score, crumb: crumb || title }); };
    const total = measure ? body.reduce((a, r) => a + (num(r[measure.i]) || 0), 0) : 0, mval = ri => measure ? num(body[ri][measure.i]) : NaN;
    const idCols = cols.filter(c => c.type === "id"), firstCol = idCols[0] ? idCols[0].i : 0;

    // duplicates
    const seen = new Map(); let dupRows = 0, dupValue = 0;
    body.forEach((r, ri) => { const k = r.join("\u0001"); if (seen.has(k)) { dupRows++; if (measure) dupValue += num(r[measure.i]) || 0; const first = seen.get(k), v = Math.abs(mval(ri)) || 0;
        link("dup", ri, firstCol, "fix", `<b>Exact copy of row ${first + 2}.</b> Entered twice.`, "", v); link("dup", first, firstCol, "fix", `<b>Has an exact copy in row ${ri + 2}.</b> Entered twice.`, "", 0); } else seen.set(k, ri); });
    let nearDup = 0, nearExample = null;
    if (idCols.length) {
      const m2 = new Map(), near = [];
      body.forEach((r, ri) => { const k = r.filter((_, i) => !idCols.some(c => c.i === i)).join("\u0001");
        if (m2.has(k)) { near.push([m2.get(k), ri]); if (!nearExample) nearExample = [m2.get(k), ri]; } else m2.set(k, ri); });
      nearDup = Math.max(0, near.length - dupRows);
      if (near.length > N * .02 || nearDup === 0) { nearDup = 0; nearExample = null; }   // so many matches that they are chance, not double entry
      else near.forEach(([a, b]) => { if (body[a].join("\u0001") !== body[b].join("\u0001")) link("dup", b, firstCol, "fix", `<b>Matches row ${a + 2} on everything except ${idCols.map(c => c.name).join(", ")}.</b> The same record under a new ID.`, "", Math.abs(mval(b)) || 0); });
    }
    const both = dupRows && nearDup, ex = nearExample ? ` (rows ${nearExample[0] + 2} and ${nearExample[1] + 2}, for example)` : "";
    if (dupRows) add("fix", `${dupRows} row${dupRows > 1 ? "s appear" : " appears"} twice`, `Identical in every column.${measure && total ? ` Together they add ${full(dupValue)} to ${measure.name}, ${pct(dupValue, total).toFixed(1)}% of the total.` : ""}`, 90, !both, "dup", "Rows entered twice");
    if (nearDup) add("fix", `${nearDup} likely double entr${nearDup > 1 ? "ies" : "y"}`, `Rows that match on everything except ${idCols.map(c => c.name).join(", ")}${ex}. Same record, two IDs.`, 95, !both, "dup", "Rows entered twice");
    if (both) findings.push({ id: "dup", sev: "fix", title: `${dupRows + nearDup} rows look entered twice`, detail: `${dupRows} are exact copies. ${nearDup} more match on everything except ${idCols.map(c => c.name).join(", ")}${ex}: the same record under a new ID.`, score: 95, crumb: "Rows entered twice" });
    if (!dupRows && !nearDup) add("ok", "No duplicate rows", "Every row is unique.");

    // empties: whole columns with gaps, then the odd blank in a column that is otherwise full
    const emptyCells = cols.reduce((a, c) => a + c.empty, 0), totalCells = N * cols.length;
    const gappy = cols.filter(c => c.type !== "empty" && !(c.type === "text" && c.avgLen > 12) && c.empty / N > .02).sort((a, b) => b.empty - a.empty);
    const oddBlank = cols.filter(c => (c.type === "category" || c.type === "number" || c.type === "date") && c.empty > 0 && c.empty / N <= .02).sort((a, b) => b.empty - a.empty);
    const emptyCols = cols.filter(c => c.type === "empty");
    gappy.concat(oddBlank).slice(0, 6).forEach(c => body.forEach((r, ri) => { if (r[c.i].trim() === "") link("gaps", ri, c.i, "look", `<b>${esc(c.name)} is blank.</b> ${c.empty.toLocaleString("en-US")} rows are missing it.`, "", 0); }));
    if (gappy.length) add(gappy[0].empty / N > .1 ? "fix" : "look", `${gappy.length === 1 ? gappy[0].name + " has" : gappy.length + " columns have"} gaps`, gappy.slice(0, 3).map(c => `${c.name} ${pct(c.empty, N).toFixed(1)}% empty`).join(" · ") + ".", 60 + Math.min(30, pct(gappy[0].empty, N)), true, "gaps", "Blank cells");
    else if (oddBlank.length) add("look", `${oddBlank[0].name} is blank in ${oddBlank[0].empty} row${oddBlank[0].empty > 1 ? "s" : ""}`, oddBlank.slice(0, 3).map(c => `${c.name} ${c.empty}`).join(" · ") + `. The rest of the column is filled, so these are probably missed entries.`, 52, true, "gaps", "Blank cells");
    else add("ok", "Few empty cells", `${pct(emptyCells, totalCells).toFixed(1)}% of all cells are blank.`);
    if (emptyCols.length) add("look", `${emptyCols.length} empty column${emptyCols.length > 1 ? "s" : ""}`, emptyCols.map(c => c.name).join(", ") + " never has a value.", 30);

    // spelling variants: the same value with different capitals, spaces or punctuation, or two names at one address
    const variants = []; let varRows = 0;
    const normKey = s => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    cols.filter(c => c.type === "category" || c.type === "text").forEach(c => {
      const g = new Map(); body.forEach((r, ri) => { const raw = r[c.i]; if (!raw.trim()) return; const k = normKey(raw) || raw.trim().toLowerCase(); if (!g.has(k)) g.set(k, new Map()); const m = g.get(k); if (!m.has(raw)) m.set(raw, []); m.get(raw).push(ri); });
      g.forEach(m => { if (m.size > 1) { const forms = [...m.entries()].sort((a, b) => b[1].length - a[1].length); const top = forms[0][0];
        variants.push({ col: c.name, forms: forms.map(f => [f[0], f[1].length]), rows: forms.slice(1).reduce((x, f) => x + f[1].length, 0) });
        forms.slice(1).forEach(([raw, rs]) => rs.forEach(ri => link("variant", ri, c.i, "look", `<b>“${esc(raw)}” is also written “${esc(top)}” (${forms[0][1].length} rows).</b> It is counted separately in every report.`))); } });
    });
    { const nameC = cols.find(c => (c.type === "text" || c.type === "category") && /name|venue|business|store|place/i.test(c.name)), addrC = cols.find(c => /address|street|addr/i.test(c.name) && c.type !== "number"), postC = cols.find(c => /zip|postal/i.test(c.name));
      if (nameC && addrC) { const at = new Map(); body.forEach((r, ri) => { const a = normKey(r[addrC.i]) + "|" + (postC ? r[postC.i].trim() : ""), n = normKey(r[nameC.i]); if (!normKey(r[addrC.i]) || !n) return; if (!at.has(a)) at.set(a, new Map()); const m = at.get(a); if (!m.has(n)) m.set(n, []); m.get(n).push(ri); });
        at.forEach(m => { if (m.size < 2) return; const names = [...m.entries()].sort((a, b) => b[1].length - a[1].length), top = names[0], tw = new Set(top[0].split(" "));
          names.slice(1).forEach(([n, rs]) => { const w = new Set(n.split(" ")), sub = [...w].every(x => tw.has(x)) || [...tw].every(x => w.has(x)); if (!sub) return;
            variants.push({ col: nameC.name, forms: [[top[0], top[1].length], [n, rs.length]], rows: rs.length });
            rs.forEach(ri => link("variant", ri, nameC.i, "look", `<b>“${esc(body[ri][nameC.i])}” is probably the same place as “${esc(body[top[1][0]][nameC.i])}”.</b> Both are at ${esc(body[ri][addrC.i])}, so they are counted as two places.`)); }); }); } }
    if (variants.length) { const v = variants.sort((a, b) => b.rows - a.rows)[0], vr = fr.get("variant") ? fr.get("variant").size : 0;
      add("look", `${variants.length} value${variants.length > 1 ? "s are" : " is"} spelled more than one way`, `In ${v.col}: ${v.forms.slice(0, 3).map(f => `“${f[0]}”`).join(", ")} count as different ${v.col} values in every report. ${vr} rows affected.`, 80, true, "variant", "Spelling variants"); }
    else add("ok", "Consistent spelling", "No values that differ only by capitals or spaces.");

    // mixed types
    const bad = cols.filter(c => c.bad).sort((a, b) => b.bad - a.bad);
    bad.forEach(c => body.forEach((r, ri) => { if (r[c.i].trim() !== "" && isNaN(num(r[c.i]))) link("badnum", ri, c.i, "look", `<b>“${esc(r[c.i].slice(0, 30))}” is not a number.</b> Sums and averages skip it.`); }));
    if (bad.length) add("look", `${bad[0].name} has ${bad[0].bad} value${bad[0].bad > 1 ? "s" : ""} that aren't numbers`, `Like “${String(bad[0].badEx).slice(0, 20)}”. Sums and averages quietly skip ${bad[0].bad > 1 ? "them" : "it"}.`, 58, true, "badnum", "Values that are not numbers");
    const mixed = cols.filter(c => c.mixed);
    if (mixed.length) add("look", `${mixed[0].name} mixes numbers and text`, `${mixed[0].mixed} values in a mostly numeric column aren't numbers, so sums and averages skip them.`, 55);
    cols.filter(c => c.mixedId).forEach(c => {
      const isN = r => !isNaN(num(r[c.i])), nn = body.filter(r => r[c.i].trim() !== "" && isN(r)).length, minorityNum = nn < c.filled - nn, form = n => n ? "digits only" : "letters and digits";
      body.forEach((r, ri) => { if (r[c.i].trim() !== "" && isN(r) === minorityNum) link("mixedid", ri, c.i, "look", `<b>${esc(r[c.i])} is in a different ID format.</b> Most ${esc(c.name)} values are ${form(!minorityNum)}.`); });
      const ex = body.find(r => r[c.i].trim() !== "" && isN(r) === minorityNum);
      add("look", `${c.name} mixes two ID formats`, `${Math.max(nn, c.filled - nn).toLocaleString("en-US")} are ${form(!minorityNum)} and ${c.mixedId.toLocaleString("en-US")} are ${form(minorityNum)} (for example “${esc(ex ? ex[c.i] : "")}”). A join on this column will miss matches.`, 56, true, "mixedid", `Mixed ${c.name} formats`);
    });

    // quantity x price = total
    if (calc) { const bad2 = []; body.forEach((r, ri) => { const q = num(r[calc.qty]), p = num(r[calc.price]), t = num(r[calc.total]);
        if (![q, p, t].some(isNaN) && Math.abs(q * p - t) > .0051) { bad2.push(ri); link("sum", ri, calc.total, "fix", `<b>Qty × price is ${money(q * p)}, but the total says ${money(t)}.</b>`, "", Math.abs(t - q * p)); } });
      if (bad2.length) add("fix", `${bad2.length} total${bad2.length > 1 ? "s don't" : " doesn't"} add up`, `${cols[calc.qty].name} × ${cols[calc.price].name} differs from ${cols[calc.total].name}${bad2.length ? ` (row${bad2.length > 1 ? "s" : ""} ${bad2.slice(0, 3).map(i => i + 2).join(", ")}${bad2.length > 3 ? " and more" : ""})` : ""}.`, 88, true, "sum", "Totals that don't add up"); }

    // negatives
    let negNote = false;
    numCols.filter(c => !NOT_MEASURE.test(c.name)).forEach(c => {
      const v = body.map(r => num(r[c.i])), ok = v.filter(x => !isNaN(x)), pos = ok.filter(x => x > 0).length / (ok.length || 1), negs = ok.filter(x => x < 0).length;
      if (pos >= .95 && negs && c.type !== "id") { v.forEach((x, ri) => { if (x < 0) link("neg", ri, c.i, "look", `<b>Negative ${esc(human(c.name))}.</b> A refund entered as a sale, or a typo.`, "", 0); });
        if (!negNote) { negNote = true; add("look", `${negs} negative ${c.name}${negs > 1 ? " values" : ""}`, `Almost every ${c.name} is positive. Refunds or returns are fine if they're meant to be here.`, 35, true, "neg", "Negative values"); } }
    });

    // dates first (so a typo in the year does not stretch the trend), then outliers
    let dateInfo = null;
    if (dateCol) {
      const now = Date.now(), ds = body.map((r, ri) => [dt(r[dateCol.i]), ri]).filter(x => x[0] != null);
      const bounds = t => t > now + 864e5 ? "future" : t < Date.UTC(1900, 0, 1) ? "ancient" : null;
      const okDates = ds.filter(x => !bounds(x[0])).map(x => x[0]).sort((a, b) => a - b), restMax = okDates[okDates.length - 1], restMin = okDates[0];
      const odd = ds.filter(x => bounds(x[0]));
      odd.forEach(([t, ri]) => { const f = bounds(t) === "future", yrs = Math.round(Math.abs(f ? (t - restMax) : (restMin - t)) / 31557600000), raw = body[ri][dateCol.i];
        link("date", ri, dateCol.i, "fix", `<b>${esc(raw)} is ${yrs >= 1 ? `${yrs} year${yrs > 1 ? "s" : ""} ${f ? "after" : "before"} the rest of the file` : `in the future`}.</b> Likely a typing slip in the year.`, "out"); });
      dateInfo = { odd, okDates };
      if (odd.length) { const fut = odd.filter(x => bounds(x[0]) === "future").length, anc = odd.length - fut;
        add("fix", `${odd.length} date${odd.length > 1 ? "s" : ""} outside a sensible range`, `${fut ? fut + " in the future" : ""}${fut && anc ? ", " : ""}${anc ? anc + " before 1900" : ""}. For example row ${odd[0][1] + 2}: ${body[odd[0][1]][dateCol.i]}.`, 85, true, "date", "Dates far outside the file"); }
    }

    // outliers (CONS-0048)
    const items = detectOutliers(body, cols, { calc, measure });
    const outItems = [...items.values()];
    outItems.forEach(it => {
      const fix = it.cells.some(c => c.sev === "fix"), n = it.cells.length, ex = it.cells[0], rowsTxt = it.cells.slice(0, 3).map(c => c.ri + 2).join(", ") + (n > 3 ? ` and ${n - 3} more` : "");
      it.cells.forEach(c => link(it.id, c.ri, c.ci, c.sev, c.why, "out", c.eff));
      const via = it.via.size ? ` Found through ${[...it.via].join(" and ")}.` : "", name = human(it.col.name);
      let title, detail, score, crumb;
      if (it.kind === "shift") {
        const hi = it.medG > it.rest, mult = hi ? it.medG / it.rest : it.rest / it.medG, rs = it.cells.map(c => c.r), lo = Math.min(...rs.map(r => r >= 1 ? r : 1 / r)), up = Math.max(...rs.map(r => r >= 1 ? r : 1 / r));
        const unitN = it.cells.filter(c => c.k).length, ks = it.cells.filter(c => c.k).map(c => c.k), kk = ks.length ? ks.sort((a, b) => ks.filter(x => x === b).length - ks.filter(x => x === a).length)[0] : 0;
        title = `${it.group}: ${n} records at ${Math.round(lo)} to ${Math.round(up)} times the rest of the file`;
        detail = `${[...it.metrics].join(" and ")} in ${human(it.gcol)} “${it.group}” runs ${xs(mult)} ${hi ? "above" : "below"} everywhere else (typical ${fv(MONEY_RE.test(it.col.name) || it.via.size > 0, it.medG)} against ${fv(MONEY_RE.test(it.col.name) || it.via.size > 0, it.rest)}). ${unitN >= n * .6 ? `Most look like a unit error (${CAUSE[kk].replace(/^Likely /, "").replace(/\.$/, "")}).` : "Check the units and the source for this group."}${via} Rows ${rowsTxt}.`;
        score = 97; crumb = `${it.group}: ${[...it.metrics][0]} far ${hi ? "above" : "below"} the rest`;
      } else if (it.kind === "unit") {
        const kk = Math.round(Math.log10(ex.r)), big = ex.r >= 1;
        const ks = new Set(it.cells.map(c => c.k)), mult = ks.size === 1 ? `${10 ** Math.abs(kk)}x` : "10x, 100x or 1,000x";
        title = `${n} ${name} value${n > 1 ? "s" : ""} look ${mult} too ${big ? "large" : "small"}`;
        detail = `For example row ${ex.ri + 2}: ${plain(ex.why)}${via} Rows ${rowsTxt}.`; score = 94; crumb = `${name} off by a factor of ten`;
      } else if (it.kind === "ratio") {
        title = `${n} record${n > 1 ? "s" : ""} with an unusual ${it.via.size ? [...it.via][0] : name}`; detail = `For example row ${ex.ri + 2}: ${plain(ex.why)} Rows ${rowsTxt}.`; score = fix ? 90 : 72; crumb = `Unusual ${[...it.via][0] || name}`;
      } else {
        const big = ex.r >= 1; title = `${n} unusually ${big ? "large" : "small"} ${name} value${n > 1 ? "s" : ""}`; detail = `For example row ${ex.ri + 2}: ${plain(ex.why)} Rows ${rowsTxt}.`; score = fix ? 86 : 72; crumb = `${name[0].toUpperCase() + name.slice(1)} far from the usual`;
      }
      add(fix ? "fix" : "look", title, detail, score, true, it.id, crumb, true);
    });
    if (outItems.length) { const nrows = new Set(outItems.flatMap(it => it.cells.map(c => c.ri))).size; checks.push({ sev: outItems.some(it => it.cells.some(c => c.sev === "fix")) ? "fix" : "look", title: `${nrows} record${nrows > 1 ? "s" : ""} far from the usual`, detail: "" }); }
    else checks.push({ sev: "ok", title: "No extreme values", detail: "Nothing far outside the normal range." });

    // trend (dates outside a sensible range are left out so they do not stretch the chart)
    let trend = null;
    if (dateCol && dateInfo && dateInfo.okDates.length) {
      const ds = dateInfo.okDates, lo = ds[0], hi = ds[ds.length - 1], span = (hi - lo) / 864e5;
      const unit = span > 150 ? "month" : span > 28 ? "week" : "day";
      const key = t => { const d = new Date(t); if (unit === "month") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); if (unit === "week") return t - ((d.getUTCDay() + 6) % 7) * 864e5; return t; };
      const okSet = new Set(dateInfo.odd.map(x => x[1])), agg = new Map(); body.forEach((r, ri) => { if (okSet.has(ri)) return; const t = dt(r[dateCol.i]); if (t == null) return; const k = key(t); agg.set(k, (agg.get(k) || 0) + (measure ? (num(r[measure.i]) || 0) : 1)); });
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
      if (spike) findings.push({ id: null, sev: "look", title: `${unit === "month" ? new Date(spike.t).toLocaleString("en-US", { month: "long", timeZone: "UTC" }) : "The " + unit + " of " + label(spike.t)} is ${spike.r.toFixed(1)}× a typical ${unit}`, detail: `${measure ? measure.name : "Rows"}: ${full(spike.v, 0)} against a typical ${full(pm, 0)}. Worth knowing why.`, score: 70 });
    }

    // breakdown
    let breakdown = null;
    if (cat) {
      const g = new Map(); body.forEach(r => { const k = r[cat.i].trim() || "(blank)", e = g.get(k) || [0, 0]; e[0] += measure ? (num(r[measure.i]) || 0) : 1; e[1]++; g.set(k, e); });
      let items2 = [...g.entries()].sort((a, b) => b[1][0] - a[1][0]); const top = items2.slice(0, 7).map(([k, e]) => [k, e[0], false, e[1]]), rest = items2.slice(7);
      if (rest.length) top.push([`Other (${rest.length})`, rest.reduce((a, x) => a + x[1][0], 0), true, rest.reduce((a, x) => a + x[1][1], 0)]);
      breakdown = { col: cat.name, ci: cat.i, items: top, total: items2.reduce((a, x) => a + x[1][0], 0) };
      if (items2.length > 1 && items2[0][1][0] / breakdown.total >= .5) findings.push({ id: null, sev: "look", title: `${items2[0][0]} is ${pct(items2[0][1][0], breakdown.total).toFixed(0)}% of ${measure ? measure.name : "rows"}`, detail: `One ${cat.name} carries most of the total. Good to know before you plan around averages.`, score: 40 });
    }

    findings.sort((a, b) => b.score - a.score);
    findings.forEach(f => { if (f.id) { f.rows = [...(fr.get(f.id) || [])].sort((a, b) => a - b); f.n = f.rows.length; } });
    const findingsAll = findings.filter(f => f.id && f.n > 0);
    const rank = { fix: 0, look: 1, ok: 2 }; checks.sort((a, b) => rank[a.sev] - rank[b.sev]);
    const needsCleanup = checks.some(c => c.sev === "fix");
    return { name: data.name, sheet: data.sheet, N, truncated, allRows, allCols, cols, header, measure, dateCol, cat, total, checks, findings: findings.slice(0, 5), findingsAll, flags, calc, trend, breakdown, needsCleanup, numCols, catCands, dateCands: cols.filter(c => c.type === "date"), rev: (analyse.rev = (analyse.rev || 0) + 1) };
  }

  // ---------- records worth a look (CONS-0050): up to ten, most serious first, one reason each
  const SEVRANK = { fix: 2, look: 1, ctx: 0 }, PER_FINDING = 4;
  function pickNotable(a, store) {
    const rows = store.rows, byRow = new Map(), findEff = new Map();
    a.flags.forEach((f, k) => { const [ri, ci] = k.split(":").map(Number); const r = byRow.get(ri) || byRow.set(ri, []).get(ri); r.push({ ci, f }); findEff.set(f.id, (findEff.get(f.id) || 0) + f.eff); });
    const cand = [];
    byRow.forEach((cells, ri) => {
      cells.sort((x, y) => SEVRANK[y.f.sev] - SEVRANK[x.f.sev] || y.f.eff - x.f.eff || x.ci - y.ci);
      const top = cells[0], eff = cells.reduce((s, c) => s + c.f.eff, 0);
      cand.push({ ri, ci: top.ci, sev: top.f.sev, id: top.f.id, fe: findEff.get(top.f.id) || 0, eff, n: cells.length, why: top.f.why });
    });
    cand.sort((x, y) => SEVRANK[y.sev] - SEVRANK[x.sev] || y.fe - x.fe || y.eff - x.eff || y.n - x.n || x.ri - y.ri);
    const out = [], used = new Map(), picked = new Set();
    const where = ri => a.cat ? ` · ${rows[ri][a.cat.i].trim() || "(blank)"}` : "";
    const entry = (c, reason, sev) => ({ ri: c.ri, col: c.ci, sev, id: c.id || null, title: `Row ${(c.ri + 2).toLocaleString("en-US")} · ${a.header[c.ci]}${where(c.ri)}`, reason });
    for (const c of cand) { if (out.length >= 10) break; if (c.id === "gaps") continue; /* a blank cell is a column-wide matter, not a record to read */ if ((used.get(c.id) || 0) >= PER_FINDING) continue; used.set(c.id, (used.get(c.id) || 0) + 1); picked.add(c.ri); out.push(entry(c, plain(c.why), c.sev)); }
    if (out.length < 10 && a.measure && a.cat) {   // a record that would change the order of the groups if it were removed
      const mi = a.measure.i, ci = a.cat.i, sums = new Map(); rows.forEach(r => { const k = r[ci].trim() || "(blank)"; sums.set(k, (sums.get(k) || 0) + (num(r[mi]) || 0)); });
      const order = m => [...m.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).map(e => e[0]);
      const base = order(sums), top = cand.filter(c => c.sev === "fix").sort((x, y) => y.eff - x.eff || x.ri - y.ri).slice(0, 60);
      for (const c of top) { if (out.length >= 10 || picked.has(c.ri)) continue; const v = num(rows[c.ri][mi]); if (!(v > 0)) continue;
        const k = rows[c.ri][ci].trim() || "(blank)", m2 = new Map(sums); m2.set(k, m2.get(k) - v); const o2 = order(m2);
        const i = base.indexOf(k), j = o2.indexOf(k); if (i !== j) { picked.add(c.ri); out.push(entry({ ...c, id: "rank" }, `Without this row, ${k} moves from ${i + 1}${["st", "nd", "rd"][i] || "th"} to ${j + 1}${["st", "nd", "rd"][j] || "th"} in ${a.measure.name} by ${a.cat.name}.`, "look")); } }
    }
    if (out.length < 10 && a.measure) {   // the largest value of the measure
      const mi = a.measure.i, med = median(rows.map(r => num(r[mi])).filter(x => x > 0)); let best = -1, bv = -Infinity;
      rows.forEach((r, ri) => { const v = num(r[mi]); if (v > bv && !picked.has(ri)) { bv = v; best = ri; } });
      if (best >= 0 && med > 0 && bv >= 3 * med) { picked.add(best); out.push(entry({ ri: best, ci: mi, id: "largest" }, `Largest ${a.measure.name} in the file: ${fv(MONEY_RE.test(a.measure.name), bv)}, ${xs(bv / med)} the median ${fv(MONEY_RE.test(a.measure.name), med)}.`, "ctx")); }
    }
    if (out.length < 10 && a.dateCol) {   // the most recent record
      const now = Date.now(); let best = -1, bt = -Infinity; rows.forEach((r, ri) => { const t = dt(r[a.dateCol.i]); if (t != null && t <= now + 864e5 && t > bt && !picked.has(ri)) { bt = t; best = ri; } });
      if (best >= 0) { picked.add(best); out.push(entry({ ri: best, ci: a.dateCol.i, id: "recent" }, `Most recent record in the file: ${dstr(bt)}.`, "ctx")); }
    }
    return out;
  }

  // ---------- the table's store, and the made-up sample
  function makeStore(data, a) {
    const raw = data.rows, nc = a.header.length;
    return Rec.createStore({ header: raw[0].slice(0, nc).map(String), names: a.header, rows: raw.slice(1, MAXR + 1).map(r => a.header.map((_, i) => r[i] == null ? "" : String(r[i]))),
      mask: raw.mask ? raw.mask.slice(1, MAXR + 1).map(m => a.header.map((_, i) => m[i] || 0)) : null, headerMask: raw.mask ? a.header.map((_, i) => raw.mask[0][i] || 0) : null,
      fmt: raw.fmt || { delim: ",", eol: "\n", finalEol: true }, isNum: a.cols.map(c => c.type === "number"), num, calc: a.calc, name: data.name });
  }
  // A made-up café's sales: seeded, with the usual problems planted (the twelve $115.00 sandwiches are the headline).
  function cafeSample(n = 5000) {
    let seed = 20261108; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const LOCS = ["Brickell", "Wynwood", "Coral Gables", "Little Havana", "Sunny Isles Beach"];
    const ITEMS = [["Cortadito", 3.25], ["Café con leche", 4.50], ["Cold brew", 5.25], ["Guava pastelito", 2.75], ["Croqueta", 1.75], ["Cuban sandwich", 11.50], ["Catering tray", 145.00]];
    const PAYS = ["Card", "Card", "Card", "Cash", "Apple Pay"], base = n - 9, rs = [];
    for (let i = 0; i < base; i++) {
      const d = new Date(Date.UTC(2026, 0, 1) + Math.floor(R() * 181) * 864e5), [item, price] = R() < .006 ? ITEMS[6] : ITEMS[Math.floor(R() * 6)];
      const qty = item === "Catering tray" ? 1 + Math.floor(R() * 5) : 1 + Math.floor(R() * 3);
      rs.push({ order: "A" + (10400 + i), date: d.toISOString().slice(0, 10), loc: LOCS[Math.floor(R() * 5)], item, qty, price, total: +(qty * price).toFixed(2), pay: PAYS[Math.floor(R() * 5)] });
    }
    const at = k => rs[k % base], put = (k, o) => Object.assign(at(k), o);
    for (let k = 3411; k < 3423; k++) put(k, { date: "2026-04-18", loc: "Sunny Isles Beach", item: "Cuban sandwich", qty: 4, price: 115.00, total: 460.00 });
    at(1206).date = "2062-03-14";
    at(2201).qty = -2; at(2201).total = +(at(2201).price * -2).toFixed(2); at(4007).qty = -1; at(4007).total = +(at(4007).price * -1).toFixed(2);
    at(812).total = +(at(812).total + 10).toFixed(2); at(2950).total = +(at(2950).total * 10).toFixed(2); at(4400).total = 0;
    [90, 455, 1300, 1980, 2405, 3333, 3809, 4120, 4700, 18, 2020, 2777, 3999, 4501].forEach(k => at(k).pay = "");
    [150, 1777, 3021].forEach(k => at(k).loc = "Coral gables"); [260, 2608].forEach(k => at(k).loc = "Wynwood "); at(999).loc = "Sunny Isles";
    [120, 640, 1024, 1500, 2048, 2600, 3100, 3700, 4444].forEach(k => rs.push(Object.assign({}, at(k))));
    return [["order_id", "date", "location", "item", "qty", "unit_price", "total", "payment"], ...rs.map(r => [r.order, r.date, r.loc, r.item, String(r.qty), r.price.toFixed(2), r.total.toFixed(2), r.pay])];
  }

  const API = { parseDelimited, num, dt, profileCol, analyse, detectOutliers, pickNotable, makeStore, cafeSample, setLimits };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else if (typeof self !== "undefined") self.JAIReport = API;
  if (!root) return;

  // warm the Excel reader up front so the offline check holds for .xlsx too
  ("requestIdleCallback" in window ? requestIdleCallback : setTimeout)(() => loadXLSX().catch(() => {}));

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
    return `<svg viewBox="0 0 ${W} ${H}" class="chart bars" role="img" aria-label="Totals by ${esc(bd.col)}">` + bd.items.map(([k, v, other, n], i) => {
      const y = i * rowH + 6, w = Math.max(2, (W - L - R) * Math.max(0, v) / max), h = 18, r = Math.min(4, w / 2);
      const norm = k.trim().toLowerCase().replace(/\s+/g, " "), variant = !other && bd.items.some(([k2, v2], j) => j !== i && k2.trim().toLowerCase().replace(/\s+/g, " ") === norm && (v2 > v || (v2 === v && j < i)));
      const lab = (variant ? k.replace(/ {2,}/g, m => "·".repeat(m.length)) : k).slice(0, variant ? 12 : 18) + (k.length > (variant ? 12 : 18) ? "…" : "");
      return `<g data-tip="${tipSafe(k)}: <b>${esc(full(v, 0))}</b> · ${pct(v, bd.total).toFixed(1)}% · ${n.toLocaleString("en-US")} rows · average <b>${esc(full(v / (n || 1), 2))}</b>${other ? "" : "<br>Click to show these rows"}"${other ? "" : ` data-g="${esc(k)}" class="pick"`}><rect x="0" y="${y - 6}" width="${W}" height="${rowH}" fill="transparent"/>
        <text x="${L - 10}" y="${y + 13}" text-anchor="end" class="bl">${esc(lab)}${variant ? `<tspan class="var"> variant</tspan>` : ""}</text>
        <path class="${other ? "bar other" : "bar"}" d="M${L} ${y}h${w - r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 -${r} ${r}h-${w - r}z"/>
        <text x="${L + w + 6}" y="${y + 13}" class="bv">${esc(fmt(v))}</text></g>`; }).join("") + "</svg>";
  }

  const tipSafe = s => esc(esc(s));
  const ICON = { ok: "✓", look: "!", fix: "×" }, SEVL = { ok: "Fine", look: "Look", fix: "Fix" };
  const fmtCount = n => n.toLocaleString("en-US");
  function controlsHTML(a) {
    const opt = (list, cur, none) => (none ? `<option value=""${cur ? "" : " selected"}>${none}</option>` : "") + list.map(c => `<option${cur && c.name === cur.name ? " selected" : ""}>${esc(c.name)}</option>`).join("");
    return `<div class="report-controls print-hide" role="group" aria-label="Report settings">
  <label>Measure <select data-ch="measure">${opt(a.numCols, a.measure, a.numCols.length ? "" : "Row count")}</select></label>
  <label>Date <select data-ch="date">${opt(a.dateCands, a.dateCol, a.dateCands.length ? "" : "None")}</select></label>
  <label>Group by <select data-ch="cat">${opt(a.catCands, a.cat, "None")}</select></label>
  <span class="sp"></span><button class="btn small" type="button" data-print>Print or save as PDF</button><button class="btn small" type="button" data-reset>Start over</button>
</div>`;
  }
  function sheetHTML(a, notable, edits) {
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const yr = t => new Date(t).getUTCFullYear(), md = t => { const d = new Date(t); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`; }, my = t => { const d = new Date(t); return `${MON[d.getUTCMonth()]} ${yr(t)}`; };
    const range = !a.trend ? "No date column" : yr(a.trend.lo) === yr(a.trend.hi) ? `${md(a.trend.lo)} – ${md(a.trend.hi)}, ${yr(a.trend.hi)}` : `${my(a.trend.lo)} – ${my(a.trend.hi)}`;
    const kpi = [["Rows", a.N.toLocaleString("en-US")], ["Columns", a.cols.length], ["Dates", range], [a.measure ? "Total " + a.measure.name : "Measure", a.measure ? full(a.total, 0) : "None found"]];
    const prof = a.cols.slice(0, 12).map(c => `<tr><td>${esc(c.name)}</td><td>${c.type}</td><td>${pct(c.filled, a.N).toFixed(0)}%</td><td>${c.distinct.toLocaleString("en-US")}</td></tr>`).join("") + (a.cols.length > 12 ? `<tr><td colspan="4" class="more">+${a.cols.length - 12} more columns</td></tr>` : "");
    const next = a.needsCleanup ? ["Data health check", 8, "a person reads the data and writes down what to fix first"] : ["Focused analysis", 20, "one question answered properly, with the uncertainty stated"];
    const trendSvg = a.trend && a.trend.series.length > 1 ? lineSVG(a.trend, a.measure ? a.measure.name : "Rows") : "";
    const tableRows = (a.trend ? a.trend.series.map(p => `<tr><td>${a.trend.label(p.t)}</td><td>${full(p.v, 0)}</td></tr>`).join("") : "");
    const finds = a.findings.length ? `<ol class="finds">${a.findings.map(f => `<li><b>${esc(f.title)}</b><span>${esc(f.detail)}</span>${f.id && f.n ? `<button class="rec-link print-hide" type="button" data-find="${esc(f.id)}">Show ${fmtCount(f.n)} ${f.n === 1 ? "row" : "rows"}</button>` : ""}</li>`).join("")}</ol>` : `<p class="calm">Nothing jumped out. That's rarer than you'd think.</p>`;
    const worth = notable.length ? `<section class="sh-worth"><h3>Records worth a look <span class="hint print-hide">Click one to find it in the table.</span></h3><ol class="worth">${notable.map(w => `<li><button class="wrow" type="button" data-row="${w.ri}"><i class="sev ${w.sev}" aria-hidden="true">${w.sev === "fix" ? "×" : w.sev === "look" ? "!" : "·"}</i><span><b>${esc(w.title)}</b><span class="wreason">${esc(w.reason)}</span></span></button></li>`).join("")}</ol></section>` : "";
    return `<article class="sheet${edits ? "" : ""}" aria-label="One-page report">
  <header class="sh-head"><div><span class="wm"><b>JA</b>Insights</span><span class="label">One-page report</span></div>
    <div class="sh-meta"><b>${esc(a.name)}${a.sheet ? " · " + esc(a.sheet) : ""}</b><span>${today} · made in your browser, nothing uploaded${a.truncated ? ` · free limit: ${Math.min(a.allRows, MAXR).toLocaleString("en-US")} rows × ${Math.min(a.allCols, MAXC)} columns` : ""}</span></div></header>
  <div class="sh-kpis">${kpi.map(([l, v]) => `<div><span class="label">${esc(l)}</span><b${String(v).length > 14 ? ' class="long"' : ""}>${esc(v)}</b></div>`).join("")}</div>
  <div class="sh-two">
    <section><h3>What stands out</h3>${finds}</section>
    <section><h3>Data health</h3><ul class="checks">${a.checks.slice(0, 8).map(c => `<li class="${c.sev}"><i aria-hidden="true">${ICON[c.sev]}</i><span><b>${esc(c.title)}</b><em class="sr">${SEVL[c.sev]}. </em></span></li>`).join("")}</ul></section>
  </div>
  ${worth}
  ${trendSvg ? `<section class="sh-trend"><h3>${esc(a.measure ? a.measure.name : "Rows")} by ${a.trend.unit}</h3><div class="chart-wrap">${trendSvg}<div class="tip" hidden></div></div></section>` : `<section class="sh-trend"><h3>Trend</h3><p class="calm">No date column found. Add one and this space shows the trend.</p></section>`}
  <div class="sh-two">
    <section>${a.breakdown ? `<h3>${esc(a.measure ? a.measure.name : "Rows")} by ${esc(a.breakdown.col)}</h3><div class="chart-wrap">${barsSVG(a.breakdown)}<div class="tip" hidden></div></div>` : `<h3>Breakdown</h3><p class="calm">No column with a short list of repeating values to group by.</p>`}</section>
    <section><h3>Columns</h3><table class="prof"><thead><tr><th>Column</th><th>Type</th><th>Filled</th><th>Distinct</th></tr></thead><tbody>${prof}</tbody></table></section>
  </div>
  ${edits ? `<p class="print-only edit-note">${edits} cell${edits > 1 ? "s were" : " was"} corrected in this browser session; the findings above are recalculated from the corrected values.</p>` : ""}
  <footer class="sh-foot"><div><span class="label">What I'd do next</span><p><b>${next[0]}</b>, ${next[1]} h × $${RATE} = $${(next[1] * RATE).toLocaleString("en-US")}: ${next[2]}. This page is an automatic first pass; that's the human one.</p></div>
    <span class="stamp">Checked</span></footer>
</article>
${tableRows ? `<details class="tableview print-hide"><summary>Chart data as a table</summary><table class="prof"><thead><tr><th>${a.trend.unit}</th><th>${esc(a.measure ? a.measure.name : "Rows")}</th></tr></thead><tbody>${tableRows}</tbody></table></details>` : ""}
${a.truncated ? `<p class="calm limit print-hide">The free report reads the first ${MAXR.toLocaleString("en-US")} rows and ${MAXC} columns. This file has ${a.allRows.toLocaleString("en-US")} rows and ${a.allCols} columns. The Data health check reads all of it.</p>` : ""}`;
  }

  // ---------- wiring
  let current = null, choice = {}, store = null, table = null, last = null;
  const out = $("#report-out"), status = msg => { $("#report-status").textContent = msg; };
  function paint(a, first) {
    last = a; const edits = store ? store.edited.size : 0, notable = pickNotable(a, store);
    $("#rep-sheet").innerHTML = sheetHTML(a, notable, edits); if (!first) $(".sheet", out).style.animation = "none";
    $$(".chart-wrap", out).forEach(wrap => {
      const tip = $(".tip", wrap), svg = $("svg", wrap), xh = $(".xh", wrap);
      const show = (el, ev) => { tip.innerHTML = el.dataset.tip; tip.hidden = false; const r = wrap.getBoundingClientRect(); tip.style.left = Math.min(r.width - 10, Math.max(10, ev.clientX - r.left)) + "px"; tip.style.top = (ev.clientY - r.top) + "px";
        if (xh && el.dataset.x) { xh.setAttribute("x1", el.dataset.x); xh.setAttribute("x2", el.dataset.x); xh.style.opacity = 1; } };
      $$("[data-tip]", svg).forEach(el => { el.addEventListener("pointermove", e => show(el, e)); el.addEventListener("pointerleave", () => { tip.hidden = true; if (xh) xh.style.opacity = 0; }); });
    });
    const st = $(".stamp", out); if (st) requestAnimationFrame(() => st.classList.add("hit"));
    if (table) table.update(a);
  }
  function show(a) {
    $("#rep-controls").innerHTML = controlsHTML(a); $("#rep-records").innerHTML = ""; table = null;
    store = makeStore(current, a);
    out.hidden = false; $("#report-intake").hidden = true;
    paint(a, true);
    table = Rec.mountTable($("#rep-records"), { store, analysis: a, fileName: a.name, truncated: a.truncated, onChange: reanalyse, say: status });
    out.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }
  // an edit changes the rows, so every finding, the chart and the worth-a-look list are worked out again from them
  function reanalyse() {
    const t0 = performance.now(), a = analyse({ name: current.name, sheet: current.sheet, rows: [current.rows[0], ...store.rows] }, choice);
    paint(a, false); status(`${store.edits.length} edit${store.edits.length === 1 ? "" : "s"}. Findings recalculated in ${Math.round(performance.now() - t0)} ms, on this device.`);
  }
  async function run(data) {
    try { const t0 = performance.now(); current = data; choice = {}; const a = analyse(data); show(a); status(`Read ${a.N.toLocaleString("en-US")} rows in ${Math.round(performance.now() - t0)} ms, on this device.`); }
    catch (e) { status(e.message || "That file couldn't be read."); }
  }
  out.innerHTML = `<div id="rep-controls"></div><div id="rep-sheet"></div><section class="records print-hide" id="rep-records" aria-label="All records"></section>`;
  out.addEventListener("change", e => { const s = e.target.closest("[data-ch]"); if (!s || !current) return; choice[s.dataset.ch] = s.value; show2(); });
  function show2() { const a = analyse({ name: current.name, sheet: current.sheet, rows: [current.rows[0], ...store.rows] }, choice); $("#rep-controls").innerHTML = controlsHTML(a); paint(a, false); }
  out.addEventListener("click", e => {
    if (e.target.closest("[data-print]")) window.print();
    if (e.target.closest("[data-reset]")) { current = null; store = null; table = null; out.hidden = true; $("#rep-sheet").innerHTML = ""; $("#rep-records").innerHTML = ""; $("#report-intake").hidden = false; $("#report-file").value = ""; status(""); }
    const f = e.target.closest("[data-find]"); if (f && table) table.showFinding(f.dataset.find);
    const w = e.target.closest("[data-row]"); if (w && table && w.classList.contains("wrow")) table.jumpTo(+w.dataset.row);
    const g = e.target.closest("[data-g]"); if (g && table && last && last.breakdown) table.showGroup(last.breakdown.ci, g.dataset.g);
  });
  const file = $("#report-file"), drop = $("#report-drop");
  file.addEventListener("change", async () => { if (file.files[0]) { status("Reading…"); try { run(await readFile(file.files[0])); } catch (e) { status(e.message); } } });
  ["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", async e => { const f = e.dataTransfer.files[0]; if (f) { status("Reading…"); try { run(await readFile(f)); } catch (x) { status(x.message); } } });
  $("#report-sample").addEventListener("click", () => run({ name: "cafe-sales-sample.csv (made up)", rows: cafeSample() }));
  if (location.hash === "#sample") $("#report-sample").click();
  window.JAIReportDebug = { get table() { return table; }, get store() { return store; }, get analysis() { return last; }, setLimits };
})();
