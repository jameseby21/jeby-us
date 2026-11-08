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
  const Dom = typeof module !== "undefined" && module.exports ? require("./domain.js") : self.JAIDomain;
  const Pack = typeof module !== "undefined" && module.exports ? require("./pack.js") : self.JAIPack;
  const Shape = typeof module !== "undefined" && module.exports ? require("./shape.js") : self.JAIShape;
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
    const head = text.slice(0, 20000).split(/\r?\n/).slice(0, 25).filter(l => l.trim() !== "");   // the delimiter with the most columns that the first lines agree on; a title row above the header does not decide
    const delim = [",", "\t", ";", "|"].map(d => { const tally = new Map(); head.map(l => l.split(d).length).filter(n => n > 1).forEach(n => tally.set(n, (tally.get(n) || 0) + 1)); const top = [...tally.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]; return [d, top ? top[0] * top[1] / head.length : 0]; }).sort((a, b) => b[1] - a[1])[0][0];
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
  const XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  const loadXLSX = () => typeof importScripts === "function" ? (xlsxReady || (xlsxReady = new Promise((res, rej) => { try { if (!self.XLSX) importScripts(XLSX_URL); res(self.XLSX); } catch (e) { xlsxReady = null; rej(new Error("Excel reader didn't load")); } }))) : xlsxReady || (xlsxReady = new Promise((res, rej) => {
    if (window.XLSX) return res(window.XLSX);
    const s = document.createElement("script"); s.src = XLSX_URL;
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
  // "x times" only up to 20; beyond that a ratio is "far above" or "far below", with both numbers beside it (CONS-0058)
  const FAR = 20, isFar = r => (r >= 1 ? r : 1 / r) > FAR;
  const rel = (r, hi) => isFar(r) ? `far ${hi ? "above" : "below"}` : `${xs(r)} ${hi ? "above" : "below"}`;
  const logStats = l => { const med = median(l); return { med, sig: Math.max(1.4826 * median(l.map(v => Math.abs(v - med))), 0.02), n: l.length }; };
  const CAUSE = {
    1: "Likely an extra zero or a misplaced decimal point.", "-1": "Likely a missing digit.",
    2: "Likely cents entered as dollars, or two extra digits.", "-2": "Likely two digits missing, or dollars entered as cents.",
    3: "Likely a unit mix-up (for example thousands), or three extra digits.", "-3": "Likely a unit mix-up or three missing digits.",
  };

  function detectOutliers(body, cols, o = {}) {
    const N = body.length, items = new Map(), claimed = new Map(), calc = o.calc;
    const numCols = cols.filter(c => c.type === "number" && !NOT_MEASURE.test(c.name) && !Dom.DOMAIN.notMeasure.includes(c.role));
    const nominal = o.nominal || new Map();
    const vals = new Map(); const V = c => vals.get(c.i) || (vals.set(c.i, Float64Array.from(body, (r, ri) => (nominal.has(c.i) && nominal.get(c.i).set.has(ri) ? NaN : num(r[c.i])))), vals.get(c.i));
    const nomWord = c => (nominal.has(c.i) ? "non-nominal " : "");
    const groupCols = cols.filter(c => c.type === "category" && c.distinct >= 2 && c.distinct <= 40);
    const G = groupCols.map(c => { const ids = new Map(), gid = new Int32Array(N).fill(-1), names = []; body.forEach((r, ri) => { const k = r[c.i].trim(); if (!k) return; if (!ids.has(k)) { ids.set(k, names.length); names.push(k); } gid[ri] = ids.get(k); }); return { col: c, gid, names }; });
    const gstat = new Map();
    const statsFor = (key, v, g) => { const k = key + "|" + g.col.i; if (gstat.has(k)) return gstat.get(k);
      const buckets = g.names.map(() => []); for (let i = 0; i < N; i++) if (g.gid[i] >= 0 && v[i] > 0) buckets[g.gid[i]].push(Math.log(v[i]));
      const st = buckets.map((b, gi) => ({ ...logStats(b), l: b, sv: g.names[gi] })); gstat.set(k, st); return st; };
    const countCache = new Map(); const isCountCol = c => (countCache.has(c.i) ? countCache.get(c.i) : (countCache.set(c.i, isCount(c)), countCache.get(c.i)));
    const isCount = c => { const v = V(c); let ints = true, pos = []; for (let i = 0; i < N; i++) { if (v[i] !== v[i]) continue; if (v[i] !== Math.floor(v[i])) { ints = false; break; } if (v[i] > 0) pos.push(v[i]); } return ints && median(pos) <= 12; };

    // metrics: every numeric column, then ratios when the columns exist. Ratios go first so a short living area is named for what it is.
    const metrics = Dom.ratioPairs(cols, calc).map(p => ({ label: p.label, a: p.a, b: p.b, money: true }));   // any money column over any measure column; named by the columns (CONS-0063)
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
      let t = isFar(r) ? `<b>${fv(money, v)} is far ${r >= 1 ? "above" : "below"} ${usual} ${fv(money, refv)}${tail}.</b>` : `<b>${fv(money, v)} is ${xs(r)}${r >= 1 ? "" : " below"} ${usual} ${fv(money, refv)}${tail}.</b>`;
      if (m.a) t += ` ${m.label[0].toUpperCase() + m.label.slice(1)} comes out at ${fv(true, V(m.a)[ri] / V(m.b)[ri])}.`;
      t += " " + (k ? CAUSE[k] : (r >= 10 || r <= .1) ? "Check it against the source." : "A typo, or a real exception?");
      const nw = nomWord(c), n = st.n != null ? st.n.toLocaleString("en-US") : null;
      if (n) t += how === "group" && st.sv != null ? ` Baseline: median of ${n} ${nw}values in ${human(scope)} “${st.sv}”.`
        : how === "shift" ? ` Baseline: median of ${n} ${nw}values in the rest of the file.`
        : ` Baseline: median of ${n} ${nw}values across the file${st.fb ? ` (${human(st.fb.col)} “${st.fb.val}” has fewer than ${Dom.DOMAIN.baselineMin})` : ""}.`;
      return { why: t, k, r, refv };
    }
    function flag(m, ri, c, v, st, scope, how, extra) {
      if (!(v > 0)) return; const rs = reasonFor(m, ri, c, v, st, scope, how), r = rs.r;
      if (m.a && isCountCol(c) && r < 8 && r > 1 / 8) return;   // a bedroom count one or two off is not a finding; only a count far from its usual is
      const fix = rs.k !== 0 || r >= 10 || r <= .1 || how === "shift";
      const id = how === "shift" ? extra.id : rs.k ? "unit:" + c.name : m.a ? "ratio:" + m.label : "out:" + c.name;
      const rowM = o.measure && o.measure !== c ? V(o.measure)[ri] : NaN;
      const eff = o.measure === c ? Math.abs(v - rs.refv) : (rowM > 0 ? rowM * Math.min(50, Math.abs(1 - 1 / r)) : 0);
      const ok = addCell(id, how === "shift" ? "shift" : rs.k ? "unit" : m.a ? "ratio" : "out", { ri, ci: c.i, sev: fix ? "fix" : "look", why: rs.why, v, ref: rs.refv, r, k: rs.k, eff, label: m.label });
      if (ok) { const it = items.get(id); if (m.a) it.via.add(m.label); it.metrics.add(metricName(m)); if (how === "shift") Object.assign(it, { group: extra.group, gcol: extra.gcol, medG: extra.medG, rest: extra.rest }); if (!it.col) it.col = c; if (!it.scope) it.scope = scope; }
    }

    const medCache = new Map(); const cacheMed = (c, gi, g, l) => { const k = c.i + "|" + g.col.i + "|" + gi; if (!medCache.has(k)) medCache.set(k, l.length ? { med: median(l), sig: .02, n: l.length } : null); return medCache.get(k); };
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
            if (m.col) flag(m, ri, m.col, m.v[ri], { med: restMed, sig: between, n: rest.length }, g.col.name, "shift", { id, group: g.names[gi], gcol: g.col.name, medG: Math.exp(s.med), rest: Math.exp(restMed) });
            else { const cu = culprit(m, ri, c => { const l = []; for (let i = 0; i < N; i++) if (V(c)[i] > 0 && g.gid[i] !== gi) l.push(Math.log(V(c)[i])); return cacheMed(c, gi, g, l); });
              flag(m, ri, cu.c, cu.v, cu.st ? { med: cu.st.med, sig: between, n: cu.st.n } : { med: restMed, sig: between, n: rest.length }, g.col.name, "shift", { id, group: g.names[gi], gcol: g.col.name, medG: Math.exp(s.med), rest: Math.exp(restMed) }); }
          });
        });
      });
    });

    // pass 2: a value far from its own group's usual, or (with no group to compare with) from the whole file
    metrics.forEach(m => {
      const floor = m.count ? LN8 : LN3;
      // the group that explains this metric best (the smallest spread inside its groups) is the one a value is judged against
      const usable = G.map(g => { const st = statsFor(m.key, m.v, g), big = st.filter(x => x.n >= 8); return { g, st, w: big.length ? median(big.map(x => x.sig)) : Infinity }; }).filter(u => u.w < Infinity).sort((x, y) => x.w - y.w);
      const globalL = []; for (let i = 0; i < N; i++) if (m.v[i] > 0) globalL.push(Math.log(m.v[i]));
      const gs = globalL.length >= 20 ? logStats(globalL) : null;
      for (let ri = 0; ri < N; ri++) {
        const v = m.v[ri]; if (!(v > 0)) continue; const l = Math.log(v); let best = null;
        let judged = false, small = null;
        for (const { g, st } of usable) { const gi = g.gid[ri]; if (gi < 0) continue; const s = st[gi]; if (s.n < Dom.DOMAIN.baselineMin) { if (!small) small = { col: g.col.name, val: g.names[gi] }; continue; } judged = true;
          const dev = Math.abs(l - s.med), thr = Math.max(floor, KSIG * s.sig); if (dev >= thr) best = { g, gi, s }; break; }
        if (judged && !best) continue;
        if (best) {
          if (m.col) flag(m, ri, m.col, v, best.s, best.g.col.name, "group");
          else { const cu = culprit(m, ri, c => statsFor(c.i, V(c), best.g)[best.g.gid[ri]]); flag(m, ri, cu.c, cu.v, cu.st || best.s, best.g.col.name, "group"); }
        } else if (gs && Math.abs(l - gs.med) >= Math.max(floor, (KSIG + 1) * gs.sig)) {
          const gsf = small ? { ...gs, fb: small } : gs;
          if (m.col) flag(m, ri, m.col, v, gsf, "", "all");
          else { const cu = culprit(m, ri, c => { const q = []; for (let i = 0; i < N; i++) if (V(c)[i] > 0) q.push(Math.log(V(c)[i])); return logStats(q); }); flag(m, ri, cu.c, cu.v, cu.st ? (small ? { ...cu.st, fb: small } : cu.st) : gsf, "", "all"); }
        }
      }
    });
    return items;
  }

  // ---------- analysis
  const spanUnit = days => (days > 1460 ? "year" : days > 150 ? "month" : days > 28 ? "week" : "day");
  function analyse(data, choice = {}) {
    const rows = data.rows; if (rows.length < 2) throw new Error("That file needs at least two rows: a header and a row of data, or two rows of data.");
    const frm = Shape.frame(rows, choice, { num, dt, profileCol }), RB = frm.bodyStart + 1;   // RB: the row of the file where the first row of data sits (1 when there is no header; 3 with a title row and a header)
    const allCols = frm.width, allRows = rows.length - frm.bodyStart;
    let header = frm.names.slice(0, MAXC);
    const seenH = {}; header = header.map(h => (seenH[h] = (seenH[h] || 0) + 1) > 1 ? `${h} (${seenH[h]})` : h);
    const body = rows.slice(frm.bodyStart, frm.bodyStart + MAXR).map(r => header.map((_, i) => r[i] == null ? "" : String(r[i])));
    const truncated = allRows > MAXR || allCols > MAXC;
    const N = body.length;
    header.forEach((h, i) => {   // epoch seconds (10 digits) or milliseconds (13 digits) in a column whose name says it is a date or a time
      if (!/date|time|created|updated|stamp|(^|[_\s-])(at|ts|on)$|sold|posted/i.test(h)) return; const vals = body.map(r => r[i].trim()).filter(Boolean);
      if (vals.length >= 5 && vals.every(v => /^\d{10}(\d{3})?$/.test(v)) && vals.every(v => v.length === vals[0].length)) body.forEach(r => { const v = r[i].trim(); if (v) r[i] = new Date(v.length === 13 ? +v : +v * 1000).toISOString().slice(0, 10); });
    });
    const cols = header.map((h, i) => ({ ...profileCol(h, body.map(r => r[i])), i }));
    Dom.assignRoles(cols, body, num);
    const nominal = Dom.findNominal(body, cols, num, median);   // set aside before any baseline is drawn (CONS-0058)

    const pick = (list, re, want) => (want && list.find(c => c.name === want)) || list.find(c => re.test(c.name)) || list[0] || null;
    const numCols = cols.filter(c => c.type === "number");
    const measureCands = numCols.filter(c => !NOT_MEASURE.test(c.name) && !Dom.DOMAIN.notMeasure.includes(c.role));
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

    // duplicates (CONS-0059): rows equal on every place field plus date and money; identifiers are never a matching column
    const dctx = { body, cols, num, dt, dateCol, measure, nominal, calc, rowBase: RB }, dups = Dom.duplicates(dctx), meta = new Map();
    let dupRows = 0, dupValue = 0, nearDup = 0;
    if (dups.mode === "place") {
      const addrC = Dom.byRole(cols, "address")[0], ids = dups.ids, same = Dom.listWords(dups.fields), diff = ids.length ? `; different ${Dom.listWords(ids.map(c => c.name))}` : "";
      dups.exactPairs.forEach(([x, y]) => { dupRows++; if (measure) dupValue += num(body[y][measure.i]) || 0; const v = Math.abs(mval(y)) || 0;
        link("dup", y, addrC.i, "fix", `<b>Duplicate of row ${x + RB}.</b> Same ${esc(same)}${esc(diff)}.`, "", v); link("dup", x, addrC.i, "fix", `<b>Has a duplicate in row ${y + RB}.</b> Same ${esc(same)}${esc(diff)}.`, "", 0); });
      dups.nearPairs.forEach(([x, y]) => { nearDup++; const v = Math.abs(mval(y)) || 0;
        link("dupnear", y, addrC.i, "fix", `<b>Probably a duplicate of row ${x + RB}.</b> The address matches once case, punctuation, St and Street and unit formats are written the same way; same ${esc(Dom.listWords(dups.fields.filter(f => f !== addrC.name)))}${esc(diff)}.`, "", v);
        link("dupnear", x, addrC.i, "fix", `<b>Probably has a duplicate in row ${y + RB}.</b> The address matches after normalizing it.`, "", 0); });
      const ex = p => `rows ${p[0] + RB} and ${p[1] + RB}`;
      if (dupRows) add("fix", `${dupRows.toLocaleString("en-US")} duplicate row${dupRows > 1 ? "s" : ""}`, `Same ${same}${diff} (${ex(dups.exactPairs[0])}, for example).${measure && total ? ` Together they add ${full(dupValue)} to ${measure.name}, ${pct(dupValue, total).toFixed(1)}% of the total.` : ""}`, 93, true, "dup", "Duplicate rows");
      if (nearDup) add("fix", `${nearDup.toLocaleString("en-US")} likely duplicate${nearDup > 1 ? "s" : ""} after writing the address the same way`, `Same ${same} once case, punctuation, St and Street and unit formats are normalized${diff} (${ex(dups.nearPairs[0])}, for example).`, 91, true, "dupnear", "Likely duplicates");
      if (!dupRows && !nearDup) add("ok", "No duplicate rows", `No two rows share ${same}.`);
    } else {
      const seen = new Map(); let nearExample = null;
      body.forEach((r, ri) => { const k = r.join("\u0001"); if (seen.has(k)) { dupRows++; if (measure) dupValue += num(r[measure.i]) || 0; const first = seen.get(k), v = Math.abs(mval(ri)) || 0;
          link("dup", ri, firstCol, "fix", `<b>Exact copy of row ${first + RB}.</b> Entered twice.`, "", v); link("dup", first, firstCol, "fix", `<b>Has an exact copy in row ${ri + RB}.</b> Entered twice.`, "", 0); } else seen.set(k, ri); });
      if (idCols.length) {
        const m2 = new Map(), near = [];
        body.forEach((r, ri) => { const k = r.filter((_, i) => !idCols.some(c => c.i === i)).join("\u0001"); if (m2.has(k)) { near.push([m2.get(k), ri]); if (!nearExample) nearExample = [m2.get(k), ri]; } else m2.set(k, ri); });
        nearDup = Math.max(0, near.length - dupRows);
        if (near.length > N * .02 || nearDup === 0) { nearDup = 0; nearExample = null; }   // so many matches that they are chance, not double entry
        else near.forEach(([a, b]) => { if (body[a].join("\u0001") !== body[b].join("\u0001")) link("dup", b, firstCol, "fix", `<b>Matches row ${a + RB} on every column except ${idCols.map(c => esc(c.name)).join(", ")}.</b> The same record under a new ID.`, "", Math.abs(mval(b)) || 0); });
      }
      const both = dupRows && nearDup, ex = nearExample ? ` (rows ${nearExample[0] + RB} and ${nearExample[1] + RB}, for example)` : "";
      if (dupRows) add("fix", `${dupRows} row${dupRows > 1 ? "s appear" : " appears"} twice`, `Identical in every column.${measure && total ? ` Together they add ${full(dupValue)} to ${measure.name}, ${pct(dupValue, total).toFixed(1)}% of the total.` : ""}`, 90, !both, "dup", "Rows entered twice");
      if (nearDup) add("fix", `${nearDup} likely double entr${nearDup > 1 ? "ies" : "y"}`, `Rows that match on every column except ${idCols.map(c => c.name).join(", ")}${ex}. Same record, two IDs.`, 95, !both, "dup", "Rows entered twice");
      if (both) findings.push({ id: "dup", sev: "fix", title: `${dupRows + nearDup} rows look entered twice`, detail: `${dupRows} are exact copies. ${nearDup} more match on every column except ${idCols.map(c => c.name).join(", ")}${ex}: the same record under a new ID.`, score: 95, crumb: "Rows entered twice" });
      if (!dupRows && !nearDup) add("ok", "No duplicate rows", "Every row is unique.");
    }

    // empties: whole columns with gaps, then the odd blank in a column that is otherwise full
    const emptyCells = cols.reduce((a, c) => a + c.empty, 0), totalCells = N * cols.length;
    const optionalCols = cols.filter(c => c.type !== "empty" && c.empty / N > Dom.DOMAIN.optionalShare), isOpt = c => c.empty / N > Dom.DOMAIN.optionalShare;
    const gappy = cols.filter(c => c.type !== "empty" && !isOpt(c) && !(c.type === "text" && c.avgLen > 12) && c.empty / N > .02).sort((a, b) => b.empty - a.empty);
    const oddBlank = cols.filter(c => (c.type === "category" || c.type === "number" || c.type === "date") && c.empty > 0 && c.empty / N <= .02).sort((a, b) => b.empty - a.empty);
    const emptyCols = cols.filter(c => c.type === "empty");
    if (optionalCols.length) add("look", `${optionalCols.length} optional column${optionalCols.length > 1 ? "s are" : " is"} mostly empty`, `${optionalCols.slice(0, 3).map(c => `${c.name} ${pct(c.empty, N).toFixed(0)}% empty`).join(" · ")}. Blank is expected here, so these are not counted as missing values.`, 20, true, null, "Optional columns");
    if (findings.length && findings[findings.length - 1].title.endsWith("mostly empty")) findings[findings.length - 1].cls = "optional-field";
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
      if (bad2.length) add("fix", `${bad2.length} total${bad2.length > 1 ? "s don't" : " doesn't"} add up`, `${cols[calc.qty].name} × ${cols[calc.price].name} differs from ${cols[calc.total].name}${bad2.length ? ` (row${bad2.length > 1 ? "s" : ""} ${bad2.slice(0, 3).map(i => i + RB).join(", ")}${bad2.length > 3 ? " and more" : ""})` : ""}.`, 88, true, "sum", "Totals that don't add up"); }

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

    // an exact value repeated far more than chance in a column of otherwise varied numbers (CONS-0064: repeated-value)
    cols.filter(c => c.type === "number" && (c.role === "money" || c.role === "measure") && !c.count && c.distinct > c.filled * 0.4 && c.filled >= 40).forEach(c => {
      const m = new Map(); body.forEach((r, ri) => { const v = r[c.i].trim(); if (v) (m.get(v) || m.set(v, []).get(v)).push(ri); });
      const top = [...m.entries()].sort((x, y) => y[1].length - x[1].length)[0]; if (!top) return; const nomSet = nominal.has(c.i) ? nominal.get(c.i).set : null;
      if (top[1].length >= Math.max(8, N * 0.03) && !(nomSet && top[1].every(ri => nomSet.has(ri)))) {
        top[1].forEach(ri => link("rv:" + c.name, ri, c.i, "look", `<b>${esc(top[0])} appears ${top[1].length.toLocaleString("en-US")} times in ${esc(c.name)}.</b> Most values in this column are different, so one value this common is probably a default or a copy.`, "", 0));
        add("look", `${top[1].length.toLocaleString("en-US")} rows share one ${human(c.name)} (${top[0]})`, `Most ${human(c.name)} values are different, so ${top[1].length.toLocaleString("en-US")} identical ones are probably a default value or a copied entry.`, 74, true, "rv:" + c.name, `Repeated ${human(c.name)}`);
        meta.set("rv:" + c.name, { cls: "repeated-value", rule: "A value repeated in a column of otherwise varied numbers is a placeholder or a copy.", todo: "Check where these rows came from." });
      }
    });
    if (dateCol) { const ok = dateInfo ? dateInfo.okDates : []; if (ok.length) { const newest = ok[ok.length - 1], months = (Date.now() - newest) / 2629800000;
      if (months > Dom.DOMAIN.staleMonths) { add("look", `The newest date is ${Math.round(months)} months old`, `The latest ${human(dateCol.name)} is ${dstr(newest)}. The file may be out of date.`, 55, true, "stale", "Possibly out of date"); meta.set("stale", { cls: "stale", rule: Dom.CHK.stale.rule, todo: Dom.CHK.stale.todo }); } } }

    // nominal transfers (CONS-0058): their own QA finding, never part of a baseline
    nominal.forEach(nm => {
      const n = nm.rows.length, fl = nm.floor >= 1000 ? "$" + Math.round(nm.floor).toLocaleString("en-US") : "$" + nm.floor.toFixed(2), vs = nm.values.slice(0, 4).map(([v, k]) => `${money(v)} (${k.toLocaleString("en-US")})`).join(", ");
      nm.rows.forEach(ri => link("nominal", ri, nm.col.i, "look", `<b>${money(num(body[ri][nm.col.i]))} is a nominal price.</b> Typical value here is ${money(nm.typical)}. Likely a placeholder or a transfer between related parties, not a market amount. It is left out of every baseline.`, "", 0));
      add("look", `${n.toLocaleString("en-US")} nominal transfers (price ${fl} or less), set aside`, `${vs}. Typical value is ${money(nm.typical)} (median of ${nm.nRest.toLocaleString("en-US")} other rows). Repeated tiny amounts are usually placeholders, test entries or transfers between related parties. They are left out of every baseline.`, 92, true, "nominal", "Nominal transfers");
    });

    // outliers (CONS-0048)
    const items = detectOutliers(body, cols, { calc, measure, nominal });
    const outItems = [...items.values()];
    outItems.forEach(it => {
      const fix = it.cells.some(c => c.sev === "fix"), n = it.cells.length, ex = it.cells[0], rowsTxt = it.cells.slice(0, 3).map(c => c.ri + RB).join(", ") + (n > 3 ? ` and ${n - 3} more` : "");
      it.cells.forEach(c => link(it.id, c.ri, c.ci, c.sev, c.why, "out", c.eff));
      const via = it.via.size ? ` Found through ${[...it.via].join(" and ")}.` : "", name = human(it.col.name);
      let title, detail, score, crumb;
      if (it.kind === "shift") {
        const hi = it.medG > it.rest, mult = hi ? it.medG / it.rest : it.rest / it.medG, rs = it.cells.map(c => c.r), lo = Math.min(...rs.map(r => r >= 1 ? r : 1 / r)), up = Math.max(...rs.map(r => r >= 1 ? r : 1 / r));
        const unitN = it.cells.filter(c => c.k).length, ks = it.cells.filter(c => c.k).map(c => c.k), kk = ks.length ? ks.sort((a, b) => ks.filter(x => x === b).length - ks.filter(x => x === a).length)[0] : 0;
        title = up > FAR ? `${it.group}: ${n} records far ${hi ? "above" : "below"} the rest of the file` : `${it.group}: ${n} records at ${Math.round(lo)} to ${Math.round(up)} times the rest of the file`;
        detail = `${[...it.metrics].join(" and ")} in ${human(it.gcol)} “${it.group}” runs ${rel(mult, hi)} everywhere else (typical ${fv(MONEY_RE.test(it.col.name) || it.via.size > 0, it.medG)} against ${fv(MONEY_RE.test(it.col.name) || it.via.size > 0, it.rest)}). ${unitN >= n * .6 ? `Most look like a unit error (${CAUSE[kk].replace(/^Likely /, "").replace(/\.$/, "")}).` : "Check the units and the source for this group."}${via} Rows ${rowsTxt}.`;
        score = 97; crumb = `${it.group}: ${[...it.metrics][0]} far ${hi ? "above" : "below"} the rest`;
      } else if (it.kind === "unit") {
        const kk = Math.round(Math.log10(ex.r)), big = ex.r >= 1;
        const ks = new Set(it.cells.map(c => c.k)), mult = ks.size === 1 ? (Math.abs(kk) === 1 ? "10x" : `${["", "", "two", "three"][Math.abs(kk)]} digits`) : "one to three digits";
        title = `${n} ${name} value${n > 1 ? "s" : ""} look ${mult} too ${big ? "large" : "small"}`;
        detail = `For example row ${ex.ri + RB}: ${plain(ex.why)}${via} Rows ${rowsTxt}.`; score = 94; crumb = `${name} off by a factor of ten`;
      } else if (it.kind === "ratio") {
        title = `${n} record${n > 1 ? "s" : ""} with an unusual ${it.via.size ? [...it.via][0] : name}`; detail = `For example row ${ex.ri + RB}: ${plain(ex.why)} Rows ${rowsTxt}.`; score = fix ? 90 : 72; crumb = `Unusual ${[...it.via][0] || name}`;
      } else {
        const big = ex.r >= 1; title = `${n} unusually ${big ? "large" : "small"} ${name} value${n > 1 ? "s" : ""}`; detail = `For example row ${ex.ri + RB}: ${plain(ex.why)} Rows ${rowsTxt}.`; score = fix ? 86 : 72; crumb = `${name[0].toUpperCase() + name.slice(1)} far from the usual`;
      }
      add(fix ? "fix" : "look", title, detail, score, true, it.id, crumb, true);
    });
    if (outItems.length) { const nrows = new Set(outItems.flatMap(it => it.cells.map(c => c.ri))).size; checks.push({ sev: outItems.some(it => it.cells.some(c => c.sev === "fix")) ? "fix" : "look", title: `${nrows} record${nrows > 1 ? "s" : ""} far from the usual`, detail: "" }); }
    else checks.push({ sev: "ok", title: "No extreme values", detail: "Nothing far outside the normal range." });

    // role-driven checks and insights (CONS-0063): repeat occurrences of a place over time, identifier uniqueness, coordinates, top and bottom by ratio, concentration
    const repeats = Dom.repeatOccurrences(dctx, dups);
    Dom.domainItems(dctx, dups, repeats).forEach(it => {
      it.cells.forEach(c => link(it.id, c.ri, c.ci, c.sev, c.why, "", c.eff));
      meta.set(it.id, { kind: it.kind, cls: it.cls, rule: it.rule, todo: it.todo, repeat: it.repeat });
      if (it.kind === "qa") add(it.sev, it.title, it.detail, it.score, true, it.id, it.crumb);
      else findings.push({ id: it.id, kind: "insight", sev: it.sev, title: it.title, detail: it.detail, score: it.score, crumb: it.crumb });
    });

    // an optional rule pack (CONS-0068): none unless the visitor loads one; its findings are tagged with the pack and never change the generic ones
    let packInfo = null;
    if (choice.pack) {
      Pack.validate(choice.pack); const its = Pack.run(choice.pack, { body, cols, num }); packInfo = { id: choice.pack.id, name: choice.pack.name, version: choice.pack.version, found: 0, skipped: [] };
      its.forEach(it => {
        if (it.skipped) { packInfo.skipped.push({ id: it.id, missing: it.missing }); return; }
        packInfo.found++; it.cells.forEach(c => { const k = c.ri + ":" + c.ci; if (!flags.has(k)) flags.set(k, { sev: c.sev, why: c.why, id: it.id, fam: "", eff: 0 }); (fr.get(it.id) || fr.set(it.id, new Set()).get(it.id)).add(c.ri); });
        checks.push({ sev: it.sev, title: it.title, detail: it.detail }); findings.push({ id: it.id, kind: it.kind, cls: it.cls, sev: it.sev, hard: it.hard, pack: it.pack, title: it.title, detail: it.detail, rule: it.rule, todo: it.todo, score: it.score, crumb: it.crumb });
      });
    }

    // trend (dates outside a sensible range are left out so they do not stretch the chart)
    let trend = null;
    if (dateCol && dateInfo && dateInfo.okDates.length) {
      const ds = dateInfo.okDates, lo = ds[0], hi = ds[ds.length - 1], span = (hi - lo) / 864e5;
      const unit = spanUnit(span);
      const key = t => { const d = new Date(t); if (unit === "year") return Date.UTC(d.getUTCFullYear(), 0, 1); if (unit === "month") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); if (unit === "week") return t - ((d.getUTCDay() + 6) % 7) * 864e5; return t; };
      const okSet = new Set(dateInfo.odd.map(x => x[1])), agg = new Map(); body.forEach((r, ri) => { if (okSet.has(ri)) return; const t = dt(r[dateCol.i]); if (t == null) return; const k = key(t); agg.set(k, (agg.get(k) || 0) + (measure ? (num(r[measure.i]) || 0) : 1)); });
      const keys = [...agg.keys()].sort((a, b) => a - b), step = unit === "month" || unit === "year" ? null : (unit === "week" ? 7 : 1) * 864e5;
      const series = []; if (keys.length) { let k = keys[0]; while (k <= keys[keys.length - 1]) { series.push({ t: k, v: agg.get(k) || 0 }); if (step) k += step; else { const d = new Date(k); k = unit === "year" ? Date.UTC(d.getUTCFullYear() + 1, 0, 1) : Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0 + 1); } } }
      const lastEnd = unit === "year" ? Date.UTC(new Date(hi).getUTCFullYear(), 11, 31) : unit === "month" ? Date.UTC(new Date(hi).getUTCFullYear(), new Date(hi).getUTCMonth() + 1, 0) : unit === "week" ? key(hi) + 6 * 864e5 : hi;
      const partialLast = series.length > 2 && hi < lastEnd - 2 * 864e5;
      const firstStart = series.length ? series[0].t : lo, partialFirst = series.length > 2 && lo > firstStart + 2 * 864e5;
      const core = series.filter((_, i) => !(partialFirst && i === 0) && !(partialLast && i === series.length - 1));
      const pm = median(core.map(p => p.v)); let spike = null;
      core.forEach(p => { const r = pm ? p.v / pm : 0; if (r >= 1.5 && (!spike || r > spike.r)) spike = { ...p, r }; });
      const label = t => { const d = new Date(t); return unit === "year" ? String(d.getUTCFullYear()) : unit === "month" ? `${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` : `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`; };
      trend = { unit, series, label, spike, partialFirst, partialLast, lo, hi, median: pm };
      // a small category split (CONS-0061): a column with 8 values or fewer, else the top five values of the most informative category column, plus Other
      const entropy = c => { const m = new Map(); let n = 0; body.forEach(r => { const v = r[c.i].trim(); if (v) { m.set(v, (m.get(v) || 0) + 1); n++; } }); let h = 0; m.forEach(k => { const q = k / n; h -= q * Math.log(q); }); return m.size > 1 ? h / Math.log(m.size) : 0; };
      const sCands = catCands.filter(c => c.empty / N < 0.3 && c.distinct <= 60), low = sCands.filter(c => c.distinct <= 8);
      const sCol = choice.split === "" ? null : (choice.split && cols.find(c => c.name === choice.split && c.type === "category")) || [...(low.length ? low : sCands)].sort((x, y) => (CAT_RE.test(y.name) - CAT_RE.test(x.name)) || entropy(y) - entropy(x))[0] || null;
      if (sCol && series.length > 1) {
        const tot = new Map(); body.forEach(r => { const v = r[sCol.i].trim() || "(blank)"; tot.set(v, (tot.get(v) || 0) + 1); });
        const ranked = [...tot.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).map(e => e[0]), top5 = ranked.length > 8, names = top5 ? ranked.slice(0, 5).concat(["Other"]) : ranked, keep = new Set(top5 ? ranked.slice(0, 5) : ranked), ix = new Map(series.map((p, i) => [p.t, i]));
        const vals = names.map(() => series.map(() => 0));
        body.forEach((r, ri) => { if (okSet.has(ri)) return; const t = dt(r[dateCol.i]); if (t == null) return; const i = ix.get(key(t)); if (i == null) return; const v = r[sCol.i].trim() || "(blank)", g = keep.has(v) ? names.indexOf(v) : names.length - 1; vals[g][i] += measure ? (num(r[measure.i]) || 0) : 1; });
        trend.split = { col: sCol.name, ci: sCol.i, names, vals, top5 };
      }
      { const inner = series.slice(partialFirst ? 1 : 0, series.length - (partialLast ? 1 : 0)), empty = inner.filter(p => p.v === 0 && !agg.has(p.t));
        if (series.length >= 6 && empty.length) { findings.push({ id: "tlgaps", kind: "qa", cls: "missing", sev: "look", title: `${empty.length} empty ${unit}${empty.length > 1 ? "s" : ""} inside the timeline`, detail: `No rows in ${empty.slice(0, 4).map(p => label(p.t)).join(", ")}${empty.length > 4 ? " and more" : ""}, between months that have data. A gap in the export, or a quiet period?`, score: 57, crumb: "Gaps in the timeline", rule: "A period with no rows between periods that have rows is a gap in the data or a real pause.", todo: "Ask whether the export skipped those dates." }); } }
      if (spike) findings.push({ id: null, kind: "insight", sev: "look", title: `${unit === "month" ? new Date(spike.t).toLocaleString("en-US", { month: "long", timeZone: "UTC" }) : "The " + unit + " of " + label(spike.t)} is ${spike.r.toFixed(1)}× a typical ${unit}`, detail: `${measure ? measure.name : "Rows"}: ${full(spike.v, 0)} against a typical ${full(pm, 0)}. Worth knowing why.`, score: 70 });
    }

    // breakdown
    let breakdown = null;
    if (cat) {
      const g = new Map(); body.forEach(r => { const k = r[cat.i].trim() || "(blank)", e = g.get(k) || [0, 0]; e[0] += measure ? (num(r[measure.i]) || 0) : 1; e[1]++; g.set(k, e); });
      let items2 = [...g.entries()].sort((a, b) => b[1][0] - a[1][0]); const top = items2.slice(0, 7).map(([k, e]) => [k, e[0], false, e[1]]), rest = items2.slice(7);
      if (rest.length) top.push([`Other (${rest.length})`, rest.reduce((a, x) => a + x[1][0], 0), true, rest.reduce((a, x) => a + x[1][1], 0)]);
      breakdown = { col: cat.name, ci: cat.i, items: top, total: items2.reduce((a, x) => a + x[1][0], 0) };
      if (items2.length > 1 && items2[0][1][0] / breakdown.total >= .5) findings.push({ id: null, kind: "insight", sev: "look", title: `${items2[0][0]} is ${pct(items2[0][1][0], breakdown.total).toFixed(0)}% of ${measure ? measure.name : "rows"}`, detail: `One ${cat.name} carries most of the total. Good to know before you plan around averages.`, score: 40 });
    }

    findings.forEach(f => { Object.assign(f, meta.get(f.id) || {}); if (!f.kind) f.kind = "qa"; if (f.kind === "qa" && !f.cls) f.cls = classOfFinding(f); });
    const byFid = new Map(findings.filter(f => f.id).map(f => [f.id, f])), CL = Dom.DOMAIN.classes;
    findings.forEach(f => { if (f.kind === "qa" && f.cls && CL[f.cls] && f.sev !== "ok" && !f.pack) { f.hard = CL[f.cls].hard; f.pri = f.sev; f.sev = f.hard ? "fix" : "look"; const ck = checks.find(c => c.title === f.title); if (ck) ck.sev = f.sev; } });
    flags.forEach(fl => { const fd = byFid.get(fl.id); if (fd && fd.kind === "qa" && fd.cls && CL[fd.cls] && !fd.pack) { fl.pri = fl.pri || fl.sev; fl.sev = CL[fd.cls].hard ? "fix" : "look"; } });
    const classCounts = Object.keys(CL).map(k => { const fs = findings.filter(f => f.kind === "qa" && f.cls === k); const rows = new Set(fs.flatMap(f => (fr.get(f.id) ? [...fr.get(f.id)] : []))); return { cls: k, label: CL[k].label, hard: CL[k].hard, n: k === "optional-field" ? optionalCols.length : rows.size }; }).filter(c => c.n > 0);
    findings.sort((a, b) => b.score - a.score);
    findings.forEach(f => { if (f.id) { f.rows = [...(fr.get(f.id) || [])].sort((a, b) => a - b); f.n = f.rows.length; } });
    const findingsAll = findings.filter(f => f.id && f.n > 0);
    const rank = { fix: 0, look: 1, ok: 2 }; checks.sort((a, b) => rank[a.sev] - rank[b.sev]);
    const needsCleanup = checks.some(c => c.sev === "fix");
    const qaSample = N >= 10 ? qaSampleOf({ N, header, cat, flags, findingsList: findings }, body, choice.seed) : null;
    return { name: data.name, sheet: data.sheet, N, hdr: { isHeader: frm.isHeader, detected: frm.detected, forced: frm.forced, conf: frm.conf, why: frm.why, note: frm.note, titleRows: frm.titleRows, bodyStart: frm.bodyStart, replaced: frm.replaced }, rowBase: RB, truncated, allRows, allCols, cols, header, measure, dateCol, cat, total, checks, findings: findings.slice(0, 5), findingsList: findings, findingsAll, pack: packInfo, classCounts, qaSample, notChecked: Dom.notChecked(cols), flags, calc, trend, breakdown, needsCleanup, numCols, catCands, dateCands: cols.filter(c => c.type === "date"), rev: (analyse.rev = (analyse.rev || 0) + 1) };
  }

  // ---------- classes and review verbs
  const classOfFinding = (f, cols) => {
    const id = f.id || "";
    if (id === "dup" || id === "dupnear") return "duplicate";
    if (id === "nominal") return "repeated-value";
    if (/^(unit|out|ratio|shift):/.test(id) || id === "neg") return "contextual-outlier";
    if (id === "date" || id === "badnum" || id === "mixedid" || id === "coords") return "malformed";
    if (id === "sum" || id === "variant" || id === "idunique") return "source-conflict";
    if (id === "stale") return "stale";
    if (id === "gaps") { const worst = f.optional; return worst ? "optional-field" : "missing"; }
    return null;
  };
  // accept = the record is right as it is, reject = it is wrong and should not be used, defer = cannot tell without the source
  const SUGGEST = {
    duplicate: "Reject the extra copy and accept the other; compare the two rows first.",
    "repeated-value": "Defer: confirm what these amounts are; accept if real, reject if placeholders.",
    "contextual-outlier": "Defer until checked against the source; reject if it is a typo, accept if it is real.",
    malformed: "Reject until it is corrected from the source.",
    "source-conflict": "Defer: find out which record is right, then accept it and reject the other.",
    missing: "Defer: fill it in from the source, or accept the blank if it is allowed.",
    stale: "Defer: ask for a newer export.",
    "optional-field": "Accept: this column is mostly empty on purpose.",
    random: "Accept if it matches the source; reject or defer if it does not.",
  };

  // ---------- the QA sample (CONS-0060): min(500, 10 percent of the rows); every flagged row first, then a stratified random fill
  const mulberry = seed => { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };
  const hashStr = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  function qaSampleOf(a, body, seedIn) {
    const N = a.N, size = Math.min(500, Math.ceil(N * 0.1)), seed = seedIn != null ? seedIn >>> 0 : hashStr(a.header.join("|") + "|" + N) % 1000000;
    const fin = new Map(a.findingsList.map(f => [f.id, f])), byRow = new Map();
    a.flags.forEach((f, k) => { const fd = fin.get(f.id); if (!fd || fd.kind !== "qa") return; const ri = +k.split(":")[0]; const r = byRow.get(ri) || byRow.set(ri, []).get(ri); r.push({ f, fd, ci: +k.split(":")[1] }); });
    const SEV = { fix: 0, look: 1, ctx: 2 }, flagged = [];
    byRow.forEach((cells, ri) => { cells.sort((x, y) => (x.fd.id === "gaps") - (y.fd.id === "gaps") || SEV[x.f.pri || x.f.sev] - SEV[y.f.pri || y.f.sev] || (x.fd.n || 0) - (y.fd.n || 0) || y.f.eff - x.f.eff || x.ci - y.ci); flagged.push({ ri, top: cells[0], cells }); });
    flagged.sort((x, y) => (x.top.fd.id === "gaps") - (y.top.fd.id === "gaps") || SEV[x.top.f.pri || x.top.f.sev] - SEV[y.top.f.pri || y.top.f.sev] || (x.top.fd.n || 0) - (y.top.fd.n || 0) || y.top.f.eff - x.top.f.eff || x.ri - y.ri);
    const take = flagged.slice(0, size), taken = new Set(take.map(x => x.ri)), rest = []; for (let i = 0; i < N; i++) if (!byRow.has(i)) rest.push(i);
    const need = Math.max(0, size - take.length), rnd = mulberry(seed), groups = new Map(), gi = a.cat ? a.cat.i : -1;
    rest.forEach(ri => { const k = gi >= 0 ? (body[ri][gi].trim() || "(blank)") : ""; (groups.get(k) || groups.set(k, []).get(k)).push(ri); });
    const keys = [...groups.keys()].sort(), quota = new Map(); let given = 0; const rem = [];
    keys.forEach(k => { const exact = need * groups.get(k).length / (rest.length || 1), q = Math.floor(exact); quota.set(k, q); given += q; rem.push([exact - q, k]); });
    rem.sort((x, y) => y[0] - x[0] || (x[1] < y[1] ? -1 : 1)); for (let i = 0; given < need && i < rem.length; i++, given++) quota.set(rem[i][1], quota.get(rem[i][1]) + 1);
    const randomRows = []; keys.forEach(k => { const g = groups.get(k).slice(); for (let i = g.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [g[i], g[j]] = [g[j], g[i]]; } randomRows.push(...g.slice(0, Math.min(quota.get(k), g.length))); });
    const rows = take.map(x => x.ri).concat(randomRows.sort((x, y) => x - y)), info = new Map();
    take.forEach(x => { const cls = classOfFinding(x.top.fd), verb = SUGGEST[cls] || SUGGEST["contextual-outlier"]; info.set(x.ri, { basis: "flagged", cls, issue: plain(x.top.f.why), suggestion: verb }); });
    randomRows.forEach(ri => info.set(ri, { basis: "random check", cls: null, issue: "Random check: no rule flagged this row.", suggestion: SUGGEST.random }));
    const cover = a.findingsList.filter(f => f.kind === "qa" && f.rows && f.rows.length && f.id !== "gaps").map(f => ({ id: f.id, title: f.title, n: f.rows.length, inSample: f.rows.filter(r => taken.has(r)).length })).sort((x, y) => y.n - x.n).slice(0, 6);
    return { size, seed, rows, flagged: take.length, random: randomRows.length, flaggedTotal: flagged.length, info, coverage: cover, strata: a.cat ? a.cat.name : null };
  }
  function qaSampleHTML(q) {
    const cov = q.coverage.map(c => `${esc(c.title.replace(/^[\d,]+ /, ""))} ${Math.round(100 * c.inSample / c.n)}%`).join(" · ");
    return `<section class="qa-sample"><h3>QA sample <span class="hint print-hide">Rows to read against the source, with a suggestion for each.</span></h3>
      <p><b>${fmtCount(q.size)} rows</b> (the smaller of 500 and 10 percent): ${fmtCount(q.flagged)} flagged, ${fmtCount(q.random)} chosen at random${q.strata ? ` across ${esc(q.strata)}` : ""}${q.flaggedTotal > q.flagged ? ` (${fmtCount(q.flaggedTotal)} rows are flagged; the most serious and the rarest findings come first)` : ""}. Seed ${q.seed}.${cov ? ` Coverage of each finding: ${cov}.` : ""}</p>
      <p class="print-hide"><button class="btn small" type="button" data-qs="show">Show the sample</button> <button class="btn small" type="button" data-qs="resample">Resample the random part</button> <button class="btn small" type="button" data-qs="csv">Download QA sample.csv</button></p></section>`;
  }

  // ---------- the two sections (CONS-0062): every finding is an insight or a QA finding, and appears in exactly one section
  function sections(a, notable) {
    const list = a.findingsList || a.findings || [], ins = list.filter(f => f.kind === "insight"), qa = list.filter(f => f.kind !== "insight");
    return { insights: { findings: ins, notable: (notable || []).filter(w => w.kind === "insight") }, qa: { findings: qa, notable: (notable || []).filter(w => w.kind !== "insight"), checks: a.checks } };
  }

  // ---------- records worth a look (CONS-0050): up to ten, most serious first, one reason each
  const SEVRANK = { fix: 2, look: 1, ctx: 0 }, PER_FINDING = 4;
  function pickNotable(a, store) {
    const rows = store.rows, byRow = new Map(), findEff = new Map();
    a.flags.forEach((f, k) => { const [ri, ci] = k.split(":").map(Number); const r = byRow.get(ri) || byRow.set(ri, []).get(ri); r.push({ ci, f }); findEff.set(f.id, (findEff.get(f.id) || 0) + f.eff); });
    const cand = [];
    byRow.forEach((cells, ri) => {
      cells.sort((x, y) => SEVRANK[y.f.pri || y.f.sev] - SEVRANK[x.f.pri || x.f.sev] || y.f.eff - x.f.eff || x.ci - y.ci);
      const top = cells[0], eff = cells.reduce((s, c) => s + c.f.eff, 0);
      cand.push({ ri, ci: top.ci, sev: top.f.sev, pri: top.f.pri || top.f.sev, id: top.f.id, fe: findEff.get(top.f.id) || 0, eff, n: cells.length, why: top.f.why });
    });
    cand.sort((x, y) => SEVRANK[y.pri] - SEVRANK[x.pri] || y.fe - x.fe || y.eff - x.eff || y.n - x.n || x.ri - y.ri);
    const out = [], used = new Map(), picked = new Set();
    const where = ri => a.cat ? ` · ${rows[ri][a.cat.i].trim() || "(blank)"}` : "";
    const kindOf = id => { const f = a.findingsList && a.findingsList.find(x => x.id === id); return f ? f.kind : (id === "rank" || id === "largest" || id === "recent") ? "insight" : "qa"; };
    const entry = (c, reason, sev) => ({ ri: c.ri, col: c.ci, sev, pri: c.pri || sev, kind: kindOf(c.id), id: c.id || null, title: `Row ${(c.ri + a.rowBase).toLocaleString("en-US")} · ${a.header[c.ci]}${where(c.ri)}`, reason: reason + (oneOf(c.id) > 1 ? ` One of ${oneOf(c.id).toLocaleString("en-US")} rows with this problem.` : "") });
    const oneOf = id => { const f = a.findingsAll.find(x => x.id === id); return f ? f.n : 0; };   // a list of ten cannot hold every row of a big finding, so each entry says how many there are
    const qaCap = 7, nIn = k => out.filter(w => w.kind === k).length;
    for (const c of cand) { if (out.length >= 10) break; if (kindOf(c.id) === "qa" && nIn("qa") >= qaCap) continue; if (kindOf(c.id) === "insight" && nIn("insight") >= 10 - qaCap) continue; if (c.id === "gaps") continue; /* a blank cell is a column-wide matter, not a record to read */ if ((used.get(c.id) || 0) >= PER_FINDING) continue; used.set(c.id, (used.get(c.id) || 0) + 1); picked.add(c.ri); out.push(entry(c, plain(c.why), c.sev)); }
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
      if (best >= 0 && med > 0 && bv >= 3 * med) { picked.add(best); out.push(entry({ ri: best, ci: mi, id: "largest" }, `Largest ${a.measure.name} in the file: ${fv(MONEY_RE.test(a.measure.name), bv)}, ${isFar(bv / med) ? "far above" : xs(bv / med)} the median ${fv(MONEY_RE.test(a.measure.name), med)}.`, "ctx")); }
    }
    if (out.length < 10 && a.dateCol) {   // the most recent record
      const now = Date.now(); let best = -1, bt = -Infinity; rows.forEach((r, ri) => { const t = dt(r[a.dateCol.i]); if (t != null && t <= now + 864e5 && t > bt && !picked.has(ri)) { bt = t; best = ri; } });
      if (best >= 0) { picked.add(best); out.push(entry({ ri: best, ci: a.dateCol.i, id: "recent" }, `Most recent record in the file: ${dstr(bt)}.`, "ctx")); }
    }
    return out;
  }

  // ---------- the table's store, and the made-up sample
  function makeStore(data, a) {
    const raw = data.rows, nc = a.header.length, bs = a.hdr.bodyStart, hasHdr = a.hdr.isHeader, lead = raw.slice(0, bs).map((r, i) => (hasHdr && i === bs - 1 ? r.slice(0, nc) : r).map(String));   // title rows and the header, kept as read so the export is the file as it came
    return Rec.createStore({ header: hasHdr ? lead[bs - 1] : a.header, lead, leadMask: raw.mask ? raw.mask.slice(0, bs).map((m, i) => (hasHdr && i === bs - 1 ? m.slice(0, nc) : m)) : null, rowBase: a.rowBase, names: a.header, rows: raw.slice(bs, bs + MAXR).map(r => a.header.map((_, i) => r[i] == null ? "" : String(r[i]))),
      mask: raw.mask ? raw.mask.slice(bs, bs + MAXR).map(m => a.header.map((_, i) => m[i] || 0)) : null,
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

  // ---------- the engine seen from outside: messages in, plain data out. A Web Worker runs this; so does the page itself if a worker cannot start.
  const cleanA = a => ({ ...a, trend: a.trend ? { ...a.trend, label: undefined } : a.trend });
  const labelFor = unit => t => { const d = new Date(t); return unit === "year" ? String(d.getUTCFullYear()) : unit === "month" ? `${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` : `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`; };
  const hydrate = r => { if (r.a.trend) r.a.trend.label = labelFor(r.a.trend.unit); return r; };
  async function handle(m) {
    if (m.maxRows) setLimits(m.maxRows, m.maxCols || MAXC);
    if (m.op === "warm") { try { await loadXLSX(); } catch (e) {} return { warm: true }; }
    let data;
    if (m.op === "read") data = await readFile(m.file); else data = { name: m.name, sheet: m.sheet, rows: m.rows };
    const a = analyse(data, m.choice || {}), notable = pickNotable(a, makeStore(data, a));
    const out = { a: cleanA(a), notable };
    if (m.op === "read") { out.name = data.name; out.sheet = data.sheet; out.rows = Array.from(data.rows, r => r); out.mask = data.rows.mask || null; out.fmt = data.rows.fmt || null; }
    return out;
  }
  function serve(scope) {
    scope.onmessage = async e => { const m = e.data; try { scope.postMessage({ id: m.id, ok: true, r: await handle(m) }); } catch (err) { scope.postMessage({ id: m.id, ok: false, error: err && err.message || "That file couldn't be read." }); } };
    scope.postMessage({ ready: true });
  }

  const API = { handle, serve, hydrate, cleanA, labelFor, parseDelimited, num, dt, profileCol, analyse, detectOutliers, pickNotable, sections, qaSampleOf, classOfFinding, makeStore, cafeSample, setLimits };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else if (typeof self !== "undefined") self.JAIReport = API;
  if (!root) return;


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
  const SPLITC = ["#2f3b4b", "#b3121a", "#2f5e9e", "#8a6d3b", "#4f7a5c", "#9a998f", "#6b5b95", "#c2792b"];
  function stackSVG(tr, measureName) {
    const W = 680, H = 230, L = 56, R = 18, T = 14, B = 52, sp = tr.split, n = tr.series.length; if (n < 2) return "";
    const totals = tr.series.map((_, i) => sp.vals.reduce((a, row) => a + row[i], 0)), max = niceMax(Math.max(...totals) * 1.05) || 1, bw = (W - L - R) / n, Y = v => T + (H - T - B) * (1 - v / max);
    let g = ""; for (let i = 0; i <= 4; i++) { const v = max * i / 4; g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/><text x="${L - 8}" y="${Y(v) + 3.5}" text-anchor="end" class="tk">${fmt(v)}</text>`; }
    const every = Math.ceil(n / 12); let bars = "";
    tr.series.forEach((p, i) => { let acc = 0; const x = L + i * bw + bw * 0.12, w = bw * 0.76, part = (tr.partialFirst && i === 0) || (tr.partialLast && i === n - 1);
      if (i % every === 0 || i === n - 1) g += `<text x="${x + w / 2}" y="${H - B + 14}" text-anchor="middle" class="tk">${tr.label(p.t)}</text>`;
      const tip = `${tipSafe(tr.label(p.t))}${part ? " (partial)" : ""}: <b>${esc(full(totals[i], 0))}</b>` + sp.names.map((nm, k) => (sp.vals[k][i] ? `<br>${tipSafe(nm)} ${esc(full(sp.vals[k][i], 0))}` : "")).join("");
      bars += `<g data-tip="${tip}"><rect x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent"/>` + sp.names.map((nm, k) => { const v = sp.vals[k][i]; if (!v) return ""; const y1 = Y(acc + v), y0 = Y(acc); acc += v; return `<rect x="${x}" y="${y1}" width="${w}" height="${Math.max(0.5, y0 - y1)}" fill="${nm === "Other" ? SPLITC[5] : SPLITC[k % SPLITC.length]}" opacity="${part ? 0.55 : 1}"/>`; }).join("") + `</g>`; });
    const legend = sp.names.map((nm, k) => `<g transform="translate(${L + (k % 4) * 150} ${H - 22 + Math.floor(k / 4) * 14})"><rect width="10" height="10" y="-9" fill="${nm === "Other" ? SPLITC[5] : SPLITC[k % SPLITC.length]}"/><text x="14" y="0" class="tk">${esc(nm.slice(0, 18))}</text></g>`).join("");
    return `<svg viewBox="0 0 ${W} ${H + (sp.names.length > 4 ? 14 : 0)}" class="chart stack" role="img" aria-label="${esc(measureName)} by ${tr.unit}, split by ${esc(sp.col)}">${g}${bars}${legend}</svg>`;
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
  <label>First row <select data-ch="header" title="Is the first row of the file column names, or data?"><option value="header"${a.hdr.isHeader ? " selected" : ""}>is a header</option><option value="data"${a.hdr.isHeader ? "" : " selected"}>is data</option></select></label>
  <label>Measure <select data-ch="measure">${opt(a.numCols, a.measure, a.numCols.length ? "" : "Row count")}</select></label>
  <label>Date <select data-ch="date">${opt(a.dateCands, a.dateCol, a.dateCands.length ? "" : "None")}</select></label>
  <label>Group by <select data-ch="cat">${opt(a.catCands, a.cat, "None")}</select></label>
  ${a.trend ? `<label>Split timeline by <select data-ch="split">${opt(a.catCands.filter(c => c.distinct <= 60), a.trend.split ? { name: a.trend.split.col } : null, "None")}</select></label>` : ""}
  <span class="sp"></span><button class="btn small" type="button" data-print>Print or save as PDF</button><button class="btn small" type="button" data-reset>Start over</button>
</div>`;
  }
  function sheetHTML(a, notable, ed) {
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const yr = t => new Date(t).getUTCFullYear(), md = t => { const d = new Date(t); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`; }, my = t => { const d = new Date(t); return `${MON[d.getUTCMonth()]} ${yr(t)}`; };
    const range = !a.trend ? "No date column" : yr(a.trend.lo) === yr(a.trend.hi) ? `${md(a.trend.lo)} – ${md(a.trend.hi)}, ${yr(a.trend.hi)}` : `${my(a.trend.lo)} – ${my(a.trend.hi)}`;
    const kpi = [["Rows", a.N.toLocaleString("en-US")], ["Columns", a.cols.length], ["Dates", range], [a.measure ? "Total " + a.measure.name : "Measure", a.measure ? full(a.total, 0) : "None found"]];
    const prof = a.cols.slice(0, 12).map(c => `<tr><td>${esc(c.name)}</td><td>${c.type}${Dom.roleLabel(c) && Dom.roleLabel(c) !== c.type ? ` · ${esc(Dom.roleLabel(c))}` : ""}</td><td>${pct(c.filled, a.N).toFixed(0)}%</td></tr>`).join("") + (a.cols.length > 12 ? `<tr><td colspan="3" class="more">+${a.cols.length - 12} more columns</td></tr>` : "");
    const next = a.needsCleanup ? ["Data health check", 8, "a person reads the data and writes down what to fix first"] : ["Focused analysis", 20, "one question answered properly, with the uncertainty stated"];
    const trendSvg = a.trend && a.trend.series.length > 1 ? (a.trend.split ? stackSVG(a.trend, a.measure ? a.measure.name : "Rows") : lineSVG(a.trend, a.measure ? a.measure.name : "Rows")) : "";
    const rep = (a.findingsList || []).find(f => f.id === "repeat" && f.repeat), repNote = rep && trendSvg ? `<p class="trend-note">Repeat occurrences: ${fmtCount(rep.repeat.n)} places appear on more than one date${rep.repeat.pct != null ? `; the median change between their first and last row is ${rep.repeat.pct >= 0 ? "+" : ""}${Math.round(rep.repeat.pct * 100)}%` : ""}.</p>` : "";
    const tableRows = (a.trend ? a.trend.series.map(p => `<tr><td>${a.trend.label(p.t)}</td><td>${full(p.v, 0)}</td></tr>`).join("") : "");
    const sec = sections(a, notable);
    const tag = f => f.cls && Dom.DOMAIN.classes[f.cls] ? `<em class="cls ${f.hard ? "hard" : "adv"}" title="${esc(Dom.DOMAIN.classes[f.cls].means)}">${f.hard ? "Invalid" : "Check"} · ${esc(Dom.DOMAIN.classes[f.cls].label)}</em> ` : "";
    const li = f => `<li><b>${tag(f)}${esc(f.title)}</b><span>${esc(f.detail)}</span>${f.rule ? `<small class="rule print-hide">Rule: ${esc(f.rule)} To do: ${esc(f.todo)}</small>` : ""}${f.id && f.n ? `<button class="rec-link print-hide" type="button" data-find="${esc(f.id)}">Show ${fmtCount(f.n)} ${f.n === 1 ? "row" : "rows"}</button>` : ""}</li>`;
    const listHTML = (fs, none) => fs.length ? `<ol class="finds">${fs.slice(0, 6).map(li).join("")}</ol>` : `<p class="calm">${none}</p>`;
    const worthHTML = (list, title, cls) => list.length ? `<section class="sh-worth ${cls}"><h3>${title} <span class="hint print-hide">Click one to find it in the table.</span></h3><ol class="worth">${list.map(w => `<li><button class="wrow" type="button" data-row="${w.ri}"><i class="sev ${w.sev}" aria-hidden="true">${w.sev === "fix" ? "×" : w.sev === "look" ? "!" : "·"}</i><span><b>${esc(w.title)}</b><span class="wreason">${esc(w.reason)}</span></span></button></li>`).join("")}</ol></section>` : "";
    const qaRows = new Set(sec.qa.findings.flatMap(f => f.rows || [])), insRows = new Set(sec.insights.findings.flatMap(f => f.rows || []));
    const nc = a.notChecked && a.notChecked.missing.length ? `<p class="not-checked"><b>Not checked:</b> ${a.notChecked.missing.map(m => `${esc(m.label)} (needs ${esc(m.because.join(" and "))})`).join("; ")}.</p>` : "";
    const classRow = a.classCounts && a.classCounts.length ? `<p class="class-counts"><b>By class:</b> ${a.classCounts.map(c => `<span class="cls ${c.hard ? "hard" : "adv"}">${esc(c.label)} ${c.n}</span>`).join(" ")}</p>` : "";
    const qaSample = a.qaSample && typeof qaSampleHTML === "function" ? qaSampleHTML(a.qaSample) : "";
    return `<article class="sheet" aria-label="One-page report">
  <header class="sh-head"><div><span class="wm"><b>JA</b>Insights</span><span class="label">One-page report</span></div>
    <div class="sh-meta"><b>${esc(a.name)}${a.sheet ? " · " + esc(a.sheet) : ""}</b><span>${today} · made in your browser, nothing uploaded${a.truncated ? ` · free limit: ${Math.min(a.allRows, MAXR).toLocaleString("en-US")} rows × ${Math.min(a.allCols, MAXC)} columns` : ""}${a.pack ? ` · rule pack: ${esc(a.pack.name)}` : ""}</span></div></header>
  <div class="sh-kpis">${kpi.map(([l, v]) => `<div><span class="label">${esc(l)}</span><b${String(v).length > 14 ? ' class="long"' : ""}>${esc(v)}</b></div>`).join("")}</div>
  <section class="sh-sec sh-insights" aria-label="Insights"><h2>Insights <span class="sec-n">${sec.insights.findings.length}</span><button class="rec-link print-hide" type="button" data-sec="insight">Show ${fmtCount(insRows.size)} insight rows</button></h2>
    <div class="sh-two">
      <section><h3>What the data says</h3>${listHTML(sec.insights.findings, "Nothing stands out yet. Add a date, a place or a category column and this space fills.")}</section>
      <section>${a.breakdown ? `<h3>${esc(a.measure ? a.measure.name : "Rows")} by ${esc(a.breakdown.col)}</h3><div class="chart-wrap">${barsSVG(a.breakdown)}<div class="tip" hidden></div></div>` : `<h3>Breakdown</h3><p class="calm">No column with a short list of repeating values to group by.</p>`}</section>
    </div>
    ${trendSvg ? `<section class="sh-trend"><h3>${esc(a.measure ? a.measure.name : "Rows")} by ${a.trend.unit}${a.trend.split ? `, split by ${esc(a.trend.split.col)}${a.trend.split.top5 ? " (top five and Other)" : ""}` : ""} <span class="hint">date column: ${esc(a.dateCol.name)}</span></h3><div class="chart-wrap">${trendSvg}<div class="tip" hidden></div></div>${repNote}</section>` : `<section class="sh-trend"><h3>Timeline</h3><p class="calm">No date column found. Add one and this space shows the timeline.</p></section>`}
    ${worthHTML(sec.insights.notable, "Worth a look", "ins")}
  </section>
  <section class="sh-sec sh-qa" aria-label="QA"><h2>QA <span class="sec-n">${sec.qa.findings.length}</span><button class="rec-link print-hide" type="button" data-sec="qa">Show ${fmtCount(qaRows.size)} QA rows</button></h2>
    <div class="sh-two">
      <section><h3>What to check</h3>${listHTML(sec.qa.findings, "Nothing jumped out. That's rarer than you'd think.")}</section>
      <section class="sh-health"><h3>Data health</h3><ul class="checks">${a.checks.slice(0, 8).map(c => `<li class="${c.sev}"><i aria-hidden="true">${ICON[c.sev]}</i><span><b>${esc(c.title)}</b><em class="sr">${SEVL[c.sev]}. </em></span></li>`).join("")}</ul></section>
    </div>
    ${worthHTML(sec.qa.notable, "Check these", "qa")}
    ${qaSample}
    <div class="sh-two">
      <section class="sh-cols"><h3>Columns</h3>${classRow}<table class="prof"><thead><tr><th>Column</th><th>Type · role</th><th>Filled</th></tr></thead><tbody>${prof}</tbody></table></section>
      <section>${nc}</section>
    </div>
    <p class="hdr-note"><b>Header:</b> ${esc(a.hdr.note)}${a.hdr.titleRows.length ? ` Skipped: “${esc(a.hdr.titleRows[0])}”${a.hdr.titleRows.length > 1 ? ` and ${a.hdr.titleRows.length - 1} more` : ""}.` : ""} <span class="print-hide">Wrong? Change “First row” at the top.</span></p>
  </section>
  ${ed && ed.n ? `<p class="print-only edit-note">${ed.n} edit${ed.n > 1 ? "s were" : " was"} made in this browser session${ed.cells !== ed.n ? ` (${ed.cells} cells changed, counting totals worked out again)` : ""}; the findings above are recalculated from the corrected values.</p>` : ""}
  <footer class="sh-foot"><div><span class="label">What I'd do next</span><p><b>${next[0]}</b>, ${next[1]} h × $${RATE} = $${(next[1] * RATE).toLocaleString("en-US")}: ${next[2]}. This page is an automatic first pass; that's the human one.</p></div>
    <span class="stamp">Checked</span></footer>
</article>
${tableRows ? `<details class="tableview print-hide"><summary>Chart data as a table</summary><table class="prof"><thead><tr><th>${a.trend.unit}</th><th>${esc(a.measure ? a.measure.name : "Rows")}</th></tr></thead><tbody>${tableRows}</tbody></table></details>` : ""}
${a.truncated ? `<p class="calm limit print-hide">The free report reads the first ${MAXR.toLocaleString("en-US")} rows and ${MAXC} columns. This file has ${a.allRows.toLocaleString("en-US")} rows and ${a.allCols} columns. The Data health check reads all of it.</p>` : ""}`;
  }

  // ---------- wiring
  let current = null, choice = {}, store = null, table = null, last = null;
  let activePack = null;
  const packName = () => { const el = $("#pack-name"); if (el) el.textContent = activePack ? `${activePack.name} (${activePack.version || "no version"})` : "none"; };
  const usePack = p => { activePack = Pack.validate(p); packName(); if (current) { choice.pack = activePack; show2(); } status(`Rule pack loaded: ${activePack.name}. Its findings are marked with the pack; the generic ones are unchanged.`); };
  { const q = new URLSearchParams(location.search).get("pack");   // ?pack=real-estate loads packs/real-estate.json from this site
    if (q && /^[a-z0-9-]+$/.test(q)) fetch(`assets/packs/${q}.json`).then(r => { if (!r.ok) throw new Error("not found"); return r.json(); }).then(usePack).catch(() => status("That rule pack could not be loaded, so the report runs without one.")); }
  { const pk = $("#report-pack"); if (pk) pk.addEventListener("change", async () => { try { usePack(JSON.parse(await pk.files[0].text())); } catch (e) { status(e.message || "That file is not a rule pack."); } pk.value = ""; }); }
  const out = $("#report-out"), status = msg => { $("#report-status").textContent = msg; };
  function paint(a, first, nb) {
    last = a; const ed = store ? { n: store.edits.length, cells: store.edited.size } : null, notable = nb || pickNotable(a, store);
    $("#rep-sheet").innerHTML = sheetHTML(a, notable, ed); if (!first) $(".sheet", out).style.animation = "none";
    $$(".chart-wrap", out).forEach(wrap => {
      const tip = $(".tip", wrap), svg = $("svg", wrap), xh = $(".xh", wrap);
      const show = (el, ev) => { tip.innerHTML = el.dataset.tip; tip.hidden = false; const r = wrap.getBoundingClientRect(); tip.style.left = Math.min(r.width - 10, Math.max(10, ev.clientX - r.left)) + "px"; tip.style.top = (ev.clientY - r.top) + "px";
        if (xh && el.dataset.x) { xh.setAttribute("x1", el.dataset.x); xh.setAttribute("x2", el.dataset.x); xh.style.opacity = 1; } };
      $$("[data-tip]", svg).forEach(el => { el.addEventListener("pointermove", e => show(el, e)); el.addEventListener("pointerleave", () => { tip.hidden = true; if (xh) xh.style.opacity = 0; }); });
    });
    const st = $(".stamp", out); if (st) requestAnimationFrame(() => st.classList.add("hit"));
    if (table) table.update(a);
  }
  // The engine: a Web Worker when one can start (https, same origin), else this thread. Either way the work is the same handle() above.
  const engine = (() => {
    let worker = null, mode = "main", id = 0; const pending = new Map();
    const ready = new Promise(res => {
      try { worker = new Worker("assets/report-worker.js"); } catch (e) { return res(false); }
      const t = setTimeout(() => { if (mode !== "worker") { try { worker.terminate(); } catch (e) {} worker = null; res(false); } }, 3000);
      worker.onmessage = e => { const d = e.data; if (d.ready) { clearTimeout(t); mode = "worker"; return res(true); } const p = pending.get(d.id); if (p) { pending.delete(d.id); d.ok ? p.res(d.r) : p.rej(new Error(d.error)); } };
      worker.onerror = () => { clearTimeout(t); if (mode !== "worker") { worker = null; res(false); } };
    });
    return { get mode() { return mode; }, ready,
      async call(m) { m.maxRows = MAXR; m.maxCols = MAXC; const ok = await ready; if (!ok) return handle(m); return new Promise((res, rej) => { m.id = ++id; pending.set(m.id, { res, rej }); worker.postMessage(m); }); } };
  })();
  ("requestIdleCallback" in window ? requestIdleCallback : setTimeout)(() => engine.ready.then(() => engine.call({ op: "warm" })).catch(() => {}));   // warm the Excel reader so the offline check holds for .xlsx too
  let seq = 0, inflight = 0;
  function show(a, notable) {
    $("#rep-controls").innerHTML = controlsHTML(a); $("#rep-records").innerHTML = ""; table = null;
    store = makeStore(current, a);
    out.hidden = false; $("#report-intake").hidden = true;
    paint(a, true, notable);
    table = Rec.mountTable($("#rep-records"), { store, analysis: a, fileName: a.name, truncated: a.truncated, onChange: reanalyse, say: status });
    out.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }
  // the findings, chart and worth-a-look list are worked out again from the current rows (after an edit, a setting change or a resample), off the main thread
  async function recompute(note, rebuild) {
    const my = ++seq, t0 = performance.now(); inflight++;
    try { const rows = rebuild ? current.rows : [...current.rows.slice(0, last.hdr.bodyStart), ...store.rows];   // flipping the header changes which rows are data, so the table is built again from the file as read
      const r = hydrate(await engine.call({ op: "analyse", name: current.name, sheet: current.sheet, rows, choice })); if (my !== seq || !current) return;
      if (rebuild) { const edits = store ? store.edits.length : 0; show(r.a, r.notable); status(note(Math.round(performance.now() - t0)) + (edits ? ` Your ${edits} edit${edits > 1 ? "s were" : " was"} cleared: the table starts again from the file.` : "")); return; }
      $("#rep-controls").innerHTML = controlsHTML(r.a); paint(r.a, false, r.notable); status(note(Math.round(performance.now() - t0))); } catch (e) { status(e.message || "That could not be worked out."); } finally { inflight--; }
  }
  function reanalyse() { recompute(ms => `${store.edits.length} edit${store.edits.length === 1 ? "" : "s"}. Findings recalculated in ${ms} ms, on this device.`); }
  function show2(rebuild) { recompute(ms => `Updated in ${ms} ms, on this device.`, rebuild); }
  function begin(r, t0, given = {}) {
    current = { name: r.name || given.name, sheet: r.sheet || given.sheet, rows: r.rows || given.rows }; if (r.mask) current.rows.mask = r.mask; if (r.fmt) current.rows.fmt = r.fmt;
    show(r.a, r.notable); status(`Read ${r.a.N.toLocaleString("en-US")} rows in ${Math.round(performance.now() - t0)} ms, on this device${engine.mode === "worker" ? " (in a background worker, so the page stayed responsive)" : ""}.`);
  }
  async function run(data) {
    try { const t0 = performance.now(); choice = activePack ? { pack: activePack } : {}; status("Reading…"); begin(hydrate(await engine.call({ op: "analyse", name: data.name, sheet: data.sheet, rows: data.rows, choice })), t0, data); }
    catch (e) { status(e.message || "That file couldn't be read."); }
  }
  async function runFile(f) {
    try { const t0 = performance.now(); choice = activePack ? { pack: activePack } : {}; status("Reading…"); begin(hydrate(await engine.call({ op: "read", file: f, choice })), t0); }
    catch (e) { status(e.message || "That file couldn't be read."); }
  }
  out.innerHTML = `<div id="rep-controls"></div><div id="rep-sheet"></div><section class="records print-hide" id="rep-records" aria-label="All records"></section>`;
  out.addEventListener("change", e => { const s = e.target.closest("[data-ch]"); if (!s || !current) return; choice[s.dataset.ch] = s.value;
    if (s.dataset.ch === "header") { delete choice.measure; delete choice.date; delete choice.cat; delete choice.split; delete choice.roles; show2(true); } else show2(); });
  out.addEventListener("click", e => {
    if (e.target.closest("[data-print]")) window.print();
    if (e.target.closest("[data-reset]")) { current = null; store = null; table = null; out.hidden = true; $("#rep-sheet").innerHTML = ""; $("#rep-records").innerHTML = ""; $("#report-intake").hidden = false; $("#report-file").value = ""; status(""); }
    const f = e.target.closest("[data-find]"); if (f && table) table.showFinding(f.dataset.find);
    const sc = e.target.closest("[data-sec]"); if (sc && table) table.showSection(sc.dataset.sec);
    const qs = e.target.closest("[data-qs]");
    if (qs && table && last && last.qaSample) {
      if (qs.dataset.qs === "show") table.showRows(last.qaSample.rows, "QA sample");
      else if (qs.dataset.qs === "resample") { choice.seed = Math.floor(Math.random() * 1000000); show2(); status(`New random part drawn (seed ${choice.seed}); the flagged rows stay.`); }
      else if (qs.dataset.qs === "csv") { const url = URL.createObjectURL(new Blob([Rec.qaSampleCSV(store, last.qaSample)], { type: "text/csv;charset=utf-8" })), link = document.createElement("a"); link.href = url; link.download = "QA sample.csv"; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
    }
    const w = e.target.closest("[data-row]"); if (w && table && w.classList.contains("wrow")) table.jumpTo(+w.dataset.row);
    const g = e.target.closest("[data-g]"); if (g && table && last && last.breakdown) table.showGroup(last.breakdown.ci, g.dataset.g);
  });
  // One printed page: letter paper with .4in margins is 739 x 979 css px. Lay the sheet out at the printed width, then keep the most worth-a-look rows (5, then 3, then none)
  // at the largest zoom that fits. The floor is .6 (about 6 pt): a dense sheet with five findings only fits that small, and the list gives way before the report does.
  const fitLog = [];
  function fitPrint() {
    const sh = $(".sheet", out); if (!sh || out.hidden) return; const PW = 739, PH = 975, body = document.body; fitLog.length = 0;
    body.classList.add("print-fit"); sh.style.zoom = "1";
    try {
      let set = false;
      fit: for (const rows of [5, 3, 0]) for (const drop of [0, 1, 2]) {   // keep everything if it fits; else give up the Columns table and shrink the chart (1), then worth-a-look rows, before the type gets smaller than 0.6
        if (rows === 5) sh.removeAttribute("data-pw"); else sh.dataset.pw = rows;
        if (!drop) sh.removeAttribute("data-ph"); else sh.dataset.ph = drop;
        for (let z = 0.76; z >= 0.595 && !set; z -= 0.02) { sh.style.width = PW / z + "px"; if (z < 0.61) fitLog.push(`${rows}/${drop}:${Math.round(sh.offsetHeight * z)}`); if (sh.offsetHeight * z <= PH) { sh.style.setProperty("--pz", z.toFixed(2)); set = true; } }
        if (set) break fit;
      }
      if (!set) sh.style.setProperty("--pz", "0.6");
    } finally { sh.style.width = ""; sh.style.zoom = ""; body.classList.remove("print-fit"); }
  }
  window.addEventListener("beforeprint", fitPrint);
  const file = $("#report-file"), drop = $("#report-drop");
  file.addEventListener("change", () => { if (file.files[0]) runFile(file.files[0]); });
  ["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if (f) runFile(f); });
  $("#report-sample").addEventListener("click", () => run({ name: "cafe-sales-sample.csv (made up)", rows: cafeSample() }));
  if (location.hash === "#sample") $("#report-sample").click();
  window.JAIReportDebug = { get pending() { return inflight; }, get engine() { return engine.mode; }, usePack, get pack() { return activePack; }, get table() { return table; }, get store() { return store; }, get analysis() { return last; }, get fitLog() { return fitLog; }, setLimits };
})();
