/* JA Insights free report: what shape a file has (CONS-0071). Is the first row a header, or data? Are there title rows above it? When there is no header, what is each column
   (a Date, an Amount, a Description, a Type, a Balance)? And the self-check that a column name is never a value.
   Pure logic, no page: it runs in the browser, in the worker and in Node. The rules it reads are in rules.js. Nothing is uploaded or stored. */
(function (root) {
  "use strict";
  const Rules = typeof module !== "undefined" && module.exports ? require("./rules.js") : root.JAIRules;
  const H = Rules.HEADER;
  const blank = v => String(v == null ? "" : v).trim() === "";
  const cellOf = (r, j) => String(r[j] == null ? "" : r[j]).trim();
  const count = r => r.filter(c => !blank(c)).length;
  const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const YEAR_RE = /^(1[89]|20)\d\d$/;

  const dateish = (s, T) => T.dt(s) != null && (/^\d/.test(s) || /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(s));   // “Year 2022” is a name; “Nov 19, 2018” and “11/19/2018” are values
  // ---------- a name that is really a value: a number, a date, money or a sentence. A finding never quotes one.
  function looksLikeValue(name, T) {
    const s = String(name == null ? "" : name).trim(); if (!s) return false;
    if (!isNaN(T.num(s)) || dateish(s, T)) return true;
    if (s.length > H.nameMaxLength) return true;
    const words = s.split(/\s+/);
    if (words.length >= H.nameMaxWords) return true;
    if (words.length >= H.wordsWithNumbers && words.filter(w => /^[\d.,#$-]+$/.test(w) && /\d/.test(w)).length >= 2) return true;
    return false;
  }
  const looksName = s => { const t = String(s).trim(); return t.length > 0 && t.length <= H.nameMaxLength && t.split(/\s+/).length <= 4 && !/^[\d.,#$()-]+$/.test(t); };

  // ---------- title rows: leading rows with far fewer filled cells than a typical row
  function leadSkip(rows) {
    const typical = median(rows.slice(0, 60).map(count).filter(n => n > 0));
    let k = 0; while (k < Math.min(H.maxTitleRows, rows.length - 2) && typical >= 3 && count(rows[k]) < typical / 2) k++;
    return k;
  }

  // ---------- running balance: previous balance plus amount is this balance (file order newest-first or oldest-first)
  function balanceLink(amount, balance) {
    let asc = 0, desc = 0, n = 0;
    for (let i = 1; i < amount.length; i++) {
      const a = amount[i], b = balance[i], pa = amount[i - 1], pb = balance[i - 1]; if ([a, b, pa, pb].some(x => x !== x)) continue; n++;
      if (Math.abs(pb + a - b) <= 0.005) asc++;          // oldest first: the row above is the earlier one
      if (Math.abs(b + pa - pb) <= 0.005) desc++;        // newest first: this row is the earlier one
    }
    return n < 5 ? { rate: 0, dir: "asc", n } : desc > asc ? { rate: desc / n, dir: "desc", n } : { rate: asc / n, dir: "asc", n };
  }

  // ---------- header or data: compare the first row with the rows below it, column by column
  function detectHeader(rows, s, width, T) {
    const row = rows[s] || [], below = rows.slice(s + 1, s + 1 + H.sample);
    const cells = []; for (let j = 0; j < width; j++) { const v = cellOf(row, j); if (v) cells.push([v, j]); }
    if (cells.length >= 2 && cells.every(([v]) => YEAR_RE.test(v)) && new Set(cells.map(x => x[0])).size === cells.length) {   // a header of years over amounts
      const yearish = cells.filter(([, j]) => { const vs = below.map(r => cellOf(r, j)).filter(Boolean); return vs.length && vs.filter(v => YEAR_RE.test(v)).length / vs.length >= 0.5; }).length;
      if (yearish < cells.length / 2) return { isHeader: true, conf: "medium", dataEv: 0, hdrEv: 3 * cells.length, why: "the first row is made of years above other numbers" };
    }
    let dataEv = 0, hdrEv = 0;
    for (const [cell, j] of cells) {
      const vals = below.map(r => cellOf(r, j)).filter(Boolean); if (vals.length < 3) continue;
      const nNum = vals.filter(v => !isNaN(T.num(v))).length, nDate = vals.filter(v => T.dt(v) != null).length;
      const bt = nNum / vals.length >= 0.9 ? "number" : nDate / vals.length >= 0.9 ? "date" : "text";
      const ct = !isNaN(T.num(cell)) ? "number" : T.dt(cell) != null ? "date" : "text";
      if (bt !== "text") { if (ct === bt) dataEv += 2; else if (ct === "text") hdrEv += 2; else dataEv += 1; }
      else if (ct !== "text") dataEv += 1;
      else if (vals.filter(v => v.toLowerCase() === cell.toLowerCase()).length >= 2) dataEv += 1;
      else if (looksName(cell)) hdrEv += 0.5;
    }
    if (dataEv > hdrEv && dataEv >= 2) return { isHeader: false, conf: hdrEv === 0 && dataEv >= 4 ? "high" : "medium", dataEv, hdrEv, why: "the first row holds values of the same kind as the rows below it" };
    return { isHeader: true, conf: hdrEv >= 2 && dataEv === 0 ? "high" : hdrEv < 1 ? "low" : "medium", dataEv, hdrEv, why: hdrEv >= 1 ? "the first row is text above columns of numbers or dates" : "nothing in the first row looks like a value" };
  }

  // ---------- names by role, for a file with no header (or a header cell that is a value)
  function nameByRole(bodyRows, width, T) {
    const names = new Array(width).fill(null), prof = [];
    for (let j = 0; j < width; j++) prof.push(T.profileCol(`Column ${j + 1}`, bodyRows.map(r => cellOf(r, j))));
    const vals = j => bodyRows.map(r => T.num(cellOf(r, j)));
    const moneyish = prof.map((p, j) => { if (p.type !== "number") return false; const raw = bodyRows.map(r => cellOf(r, j)).filter(Boolean);
      return raw.length >= 5 && raw.filter(v => /^\s*[-(]?\$/.test(v) || /^\s*-?[\d,]+\.\d\d\s*$/.test(v)).length >= raw.length * H.moneyColumn; });
    const free = j => names[j] == null;
    const date = prof.findIndex((p, j) => p.type === "date" && free(j)); if (date >= 0) names[date] = H.names.date;
    const mj = prof.map((_, j) => j).filter(j => moneyish[j]);
    let amount = mj.find(j => vals(j).some(v => v < 0)); if (amount == null) amount = mj[0];
    if (amount != null) {
      names[amount] = H.names.amount;
      const av = vals(amount), bal = mj.filter(j => j !== amount).map(j => ({ j, l: balanceLink(av, vals(j)) })).filter(x => x.l.rate >= H.balanceMatch).sort((x, y) => y.l.rate - x.l.rate)[0];
      if (bal) names[bal.j] = H.names.balance;
    }
    const desc = prof.map((p, j) => [p, j]).filter(([p, j]) => free(j) && ["text", "id", "category"].includes(p.type) && p.avgLen >= H.descriptionMinLength).sort((x, y) => y[0].avgLen - x[0].avgLen)[0];
    if (desc) names[desc[1]] = H.names.description;
    const type = prof.findIndex((p, j) => free(j) && p.type === "category" && p.distinct <= H.typeMaxDistinct); if (type >= 0) names[type] = H.names.type;
    return names.map((n, j) => n || `Column ${j + 1}`);
  }

  // ---------- the frame of a file: title rows, header or not, the names, and the first row of data.
  // choice.header: "header" | "data" overrides the detection. Returns { skip, titleRows, width, isHeader, forced, conf, note, names, bodyStart, replaced }
  function frame(rows, choice, T) {
    const skip = leadSkip(rows), width = Math.max(1, ...rows.slice(skip, skip + 50).map(r => r.length));
    const det = detectHeader(rows, skip, width, T), forced = choice.header === "header" || choice.header === "data";
    const isHeader = choice.header === "header" ? true : choice.header === "data" ? false : det.isHeader;
    const bodyStart = skip + (isHeader ? 1 : 0), byRole = nameByRole(rows.slice(bodyStart, bodyStart + 400), width, T), replaced = [];
    const names = byRole.map((rn, j) => {
      if (!isHeader) return rn;
      const raw = cellOf(rows[skip], j); if (!raw) return `Column ${j + 1}`;
      if (!looksLikeValue(raw, T)) return raw;
      const nm = YEAR_RE.test(raw) ? `Year ${raw}` : rn; replaced.push({ was: raw, now: nm }); return nm;
    });
    const titleRows = rows.slice(0, skip).map(r => r.filter(c => !blank(c)).join(" ").slice(0, 80));
    const conf = forced ? "chosen by you" : det.conf;
    const note = (isHeader ? `The first row is read as the header (${conf}${forced ? "" : " confidence"}).` : `No header row detected${forced ? " (you chose this)" : ` (${det.conf} confidence)`}; names below are ours.`)
      + (skip ? ` ${skip} title row${skip > 1 ? "s" : ""} above ${isHeader ? "it" : "the data"} skipped.` : "")
      + (replaced.length ? ` ${replaced.length} header cell${replaced.length > 1 ? "s" : ""} looked like a value, so the column is named by its role.` : "");
    return { skip, titleRows, width, isHeader, detected: det.isHeader, forced, conf, why: det.why, note, names, bodyStart, replaced };
  }

  // =====================================================================================================
  // Names (CONS-0073). makeNormalizer(values) -> raw => { key, name, clean, alias }.
  //   key: what two spellings of one merchant share (case, punctuation, store numbers, cities and processor prefixes gone); name: the best single spelling; clean: this row's cleaned text.
  // The rules are data (rules.js, NORMALIZE). Places are those in the data plus any run of one or two words that sits before a state on several rows with different names.
  const NZ = Rules.NORMALIZE, STATE = new Set(NZ.states), PLACES0 = new Set(NZ.places);
  const compact = s => String(s).replace(/\s+/g, " ").trim();
  const keyOfText = s => compact(String(s).toLowerCase().replace(/[^a-z0-9]+/g, " "));
  const aliasOf = s => { const hit = NZ.aliases.find(([re]) => re.test(s)); return hit ? hit[1] : null; };
  function stripTail(text) {   // zip and state off the end; returns { text, state }
    let t = compact(text).replace(NZ.zip, ""); const m = t.match(/^(.*\S)\s+([A-Za-z]{2})$/);
    if (m && STATE.has(m[2].toUpperCase()) && m[1].split(" ").length >= 1 && (m[2] === m[2].toUpperCase())) return { text: m[1], state: true };
    return { text: t, state: false };
  }
  function learnPlaces(values) {
    const seen = new Map();   // run of words -> { rows, names }
    values.forEach(raw => { let t = compact(String(raw)); if (!t) return; t = t.replace(/^[a-z]{2,3}\s*\*\s*/i, ""); t = t.replace(NZ.referenceCode, ""); const tail = stripTail(t); if (!tail.state) return;
      const w = tail.text.split(" "); [1, 2].forEach(n => { if (w.length <= n) return; const run = w.slice(-n).join(" ").toLowerCase(), lead = w.slice(0, -n).join(" ").toLowerCase().replace(/[^a-z]+/g, " ").trim(); const e = seen.get(run) || seen.set(run, { rows: 0, names: new Set() }).get(run); e.rows++; e.names.add(lead); }); });
    const out = new Set(); seen.forEach((e, run) => { if (e.rows >= NZ.learn.minRows && e.names.size >= NZ.learn.minNames && !/\d/.test(run)) out.add(run); }); return out;
  }
  function makeNormalizer(values) {
    const places = new Set([...PLACES0, ...learnPlaces(values || [])]), memo = new Map();
    const clean = raw => {
      let t = compact(raw); const first = aliasOf(t); if (first) return { text: first, alias: first };
      let prev; do { prev = t; NZ.prefixes.forEach(re => { t = t.replace(re, ""); }); } while (t !== prev);
      t = compact(t.replace(NZ.referenceCode, ""));
      const tail = stripTail(t); t = tail.text;
      const w = t.split(" "), cut = w.findIndex((tok, i) => i > 0 && NZ.storeNumber.some(re => re.test(tok)));
      let hadStore = false; if (cut > 0) { t = w.slice(0, cut).join(" "); hadStore = true; }
      if (!hadStore && tail.state) { const ws = t.split(" "); for (const n of [2, 1]) if (ws.length > n && places.has(ws.slice(-n).join(" ").toLowerCase())) { t = ws.slice(0, -n).join(" "); break; } }
      t = compact(t.replace(/[\s*#-]+$/, ""));
      const second = aliasOf(t); if (second) return { text: second, alias: second };
      return { text: t || compact(raw), alias: null };
    };
    return raw => { const r = String(raw); if (memo.has(r)) return memo.get(r); const c = clean(r), key = keyOfText(c.text) || keyOfText(r) || r.toLowerCase().trim(), v = { key, name: c.alias || titleCase(c.text), clean: c.text, alias: c.alias }; memo.set(r, v); return v; };
  }
  // the best single spelling of a merchant across its variants: an alias; else the most common cleaned spelling that mixes upper and lower case; else title case
  function canonicalName(cleans, alias) {
    if (alias) return alias;
    const sorted = [...cleans.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    const mixed = sorted.find(([t]) => /[a-z]/.test(t) && /[A-Z]/.test(t)); return mixed ? mixed[0] : titleCase(sorted[0][0]);
  }

  // =====================================================================================================
  // Ledgers (CONS-0072). A date, a signed money column and a description, often with a type and a running balance, is a list of transactions.
  const LD = Rules.LEDGER, DAY = 864e5, MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const NOT_AMOUNT = ["postal", "year", "code", "phone", "identifier", "coordinates", "unit"];
  const placeRole = c => ["address", "unit", "city", "state", "postal"].includes(c.role);
  const titleCase = s => s.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, a, b) => a + b.toUpperCase());

  // cols: the profiled columns with their roles. Returns the columns of a ledger (as indexes), or null when the file is not one.
  function detectLedger(cols, body, T) {
    if (body.length < LD.minRows) return null;
    const dateC = cols.find(c => c.type === "date"); if (!dateC) return null;
    const vals = c => body.map(r => T.num(cellOf(r, c.i)));
    const nums = cols.filter(c => c.type === "number" && !NOT_AMOUNT.includes(c.role) && c.filled >= body.length * 0.5);
    const negShare = c => vals(c).filter(x => x < 0).length / Math.max(1, c.filled);
    const words = c => { const seen = new Set(body.map(r => cellOf(r, c.i).toLowerCase())); return [...seen].some(v => LD.directionWords.out.test(v)) && [...seen].some(v => LD.directionWords.in.test(v)); };
    const typeC = cols.find(c => c.type === "category" && c.distinct <= H.typeMaxDistinct && words(c)) || null;
    // the amount is the money column the running balance is built from; with no balance, the signed money column
    let amount = null, balance = null, link = null;
    for (const a of nums.filter(c => negShare(c) >= LD.minNegativeShare || typeC)) for (const b of nums.filter(c => c !== a)) {
      const l = balanceLink(vals(a), vals(b)); if (l.rate >= H.balanceMatch && (!link || l.rate > link.rate)) { amount = a; balance = b; link = l; } }
    if (!amount) amount = nums.filter(c => negShare(c) >= LD.minNegativeShare).sort((x, y) => (y.role === "money") - (x.role === "money") || negShare(y) - negShare(x))[0] || (typeC ? nums.find(c => c.role === "money") : null) || null;
    if (!amount) return null;
    const dirByType = negShare(amount) < LD.minNegativeShare && !!typeC;
    if (!dirByType && negShare(amount) < LD.minNegativeShare) return null;
    if (!balance) { const b = nums.find(c => c !== amount && /balance/i.test(c.name)); if (b) { balance = b; link = balanceLink(vals(amount), vals(b)); } }
    const descCands = cols.filter(c => ["text", "id", "category"].includes(c.type) && c !== typeC && c !== amount && !placeRole(c) && c.avgLen >= LD.descriptionMinLength && c.distinct >= Math.min(body.length * 0.05, 8));
    const desc = descCands.find(c => LD.descriptionName.test(c.name)) || descCands.sort((x, y) => y.avgLen - x.avgLen)[0] || null;
    if (!desc) return null;
    return { date: dateC.i, amount: amount.i, desc: desc.i, type: typeC ? typeC.i : null, balance: balance ? balance.i : null, dirByType, order: balance && link ? link.dir : null, balanceRate: link ? link.rate : null };
  }

  // Everything a statement is asked: flows, months, merchants, recurring charges, the biggest items, weekdays, the checks. Plain data; nothing here draws.
  // names: a function raw -> { key, name } (the merchant behind a description); defaults to the simple one.
  function ledgerData(L, body, T, names) {
    const N = body.length, amtRaw = body.map(r => T.num(cellOf(r, L.amount))), flow = new Float64Array(N), tm = new Array(N);
    const nameOf = names || makeNormalizer(body.map(r => cellOf(r, L.desc)));
    const typeOut = ri => L.type != null && LD.directionWords.out.test(cellOf(body[ri], L.type)), typeIn = ri => L.type != null && LD.directionWords.in.test(cellOf(body[ri], L.type));
    for (let ri = 0; ri < N; ri++) { const a = amtRaw[ri]; tm[ri] = T.dt(cellOf(body[ri], L.date));
      flow[ri] = isNaN(a) ? NaN : L.dirByType ? (typeOut(ri) ? -Math.abs(a) : typeIn(ri) ? Math.abs(a) : a) : a; }
    const who = body.map(r => nameOf(cellOf(r, L.desc))), live = []; for (let i = 0; i < N; i++) if (!isNaN(flow[i]) && tm[i] != null) live.push(i);
    const out = live.filter(i => flow[i] < 0), inn = live.filter(i => flow[i] > 0), sum = a => a.reduce((x, i) => x + Math.abs(flow[i]), 0);
    const outflow = sum(out), inflow = sum(inn), times = live.map(i => tm[i]), first = Math.min(...times), last = Math.max(...times);
    // months
    const mk = t => { const d = new Date(t); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }, months = new Map();
    live.forEach(i => { const k = mk(tm[i]), m = months.get(k) || months.set(k, { k, out: 0, in: 0, n: 0 }).get(k); m.n++; if (flow[i] < 0) m.out += -flow[i]; else m.in += flow[i]; });
    const lf = new Date(first), ll = new Date(last), dim = (y, mo) => new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const partialFirst = lf.getUTCDate() > 5, partialLast = ll.getUTCDate() < dim(ll.getUTCFullYear(), ll.getUTCMonth()) - 5;
    const monthList = [...months.values()].sort((a, b) => a.k - b.k).map(m => ({ ...m, label: `${MONS[m.k % 12]} ${Math.floor(m.k / 12)}`, partial: (partialFirst && m.k === mk(first)) || (partialLast && m.k === mk(last)) }));
    // merchants (outflow), under one canonical name each
    const mer = new Map();
    out.forEach(i => { const w = who[i], m = mer.get(w.key) || mer.set(w.key, { key: w.key, alias: w.alias, out: 0, n: 0, rows: [], variants: new Map(), cleans: new Map() }).get(w.key); m.out += -flow[i]; m.n++; m.rows.push(i); const raw = cellOf(body[i], L.desc); m.variants.set(raw, (m.variants.get(raw) || 0) + 1); m.cleans.set(w.clean, (m.cleans.get(w.clean) || 0) + 1); });
    const merchants = [...mer.values()].map(m => ({ ...m, name: canonicalName(m.cleans, m.alias) })).sort((a, b) => b.out - a.out || (a.name < b.name ? -1 : 1)).map(m => ({ key: m.key, name: m.name, out: m.out, n: m.n, rows: m.rows, variants: [...m.variants.entries()].sort((a, b) => b[1] - a[1]) }));
    // recurring: same merchant, same amount, a regular interval
    const R = LD.recurring, recurring = [];
    merchants.forEach(m => { const byAmt = new Map(); m.rows.forEach(i => { const k = Math.round(-flow[i] * 100); (byAmt.get(k) || byAmt.set(k, []).get(k)).push(i); });
      byAmt.forEach((rows, k) => { if (rows.length < R.minCount) return; rows.sort((a, b) => tm[a] - tm[b]);
        const gaps = []; for (let j = 1; j < rows.length; j++) gaps.push((tm[rows[j]] - tm[rows[j - 1]]) / DAY); const g = median(gaps);
        if (g < R.minDays || g > R.maxDays) return; const tol = Math.max(R.toleranceDays, R.toleranceShare * g);
        if (gaps.filter(x => Math.abs(x - g) <= tol).length < gaps.length * R.intervalShare) return;
        const lastT = tm[rows[rows.length - 1]], monthly = g >= 27 && g <= 34, d = new Date(lastT), next = monthly ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, Math.min(d.getUTCDate(), dim(d.getUTCFullYear(), d.getUTCMonth() + 1))) : lastT + Math.round(g) * DAY;
        recurring.push({ name: m.name, key: m.key, amount: k / 100, every: Math.round(g), monthly, n: rows.length, rows, last: lastT, next, perMonth: (k / 100) * 30.44 / g }); }); });
    recurring.sort((a, b) => b.perMonth - a.perMonth);
    // the biggest single items and the weekday pattern
    const nameByKey = new Map(merchants.map(m => [m.key, m.name])), largest = [...out].sort((a, b) => flow[a] - flow[b] || a - b).slice(0, LD.largest).map(i => ({ ri: i, amount: -flow[i], date: tm[i], name: nameByKey.get(who[i].key) }));
    const wd = new Array(7).fill(0); out.forEach(i => { wd[new Date(tm[i]).getUTCDay()] += -flow[i]; });
    const weeks = (last - first) / (7 * DAY), wdMax = wd.indexOf(Math.max(...wd));
    const weekday = { weeks, n: out.length, totals: wd, top: wdMax, share: outflow ? wd[wdMax] / outflow : 0, standsOut: outflow ? wd[wdMax] / outflow >= LD.weekday.standsOut / 7 : false, names: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] };
    // duplicates: same date, same signed amount, same merchant. A refund is the opposite sign, so it never matches.
    const dk = new Map(); live.forEach(i => { const k = tm[i] + "|" + Math.round(flow[i] * 100) + "|" + who[i].key; (dk.get(k) || dk.set(k, []).get(k)).push(i); });
    const dupPairs = []; dk.forEach(rows => { if (rows.length > 1) rows.slice(1).forEach(i => dupPairs.push([rows[0], i])); });
    const rk = new Map(); live.forEach(i => { const k = tm[i] + "|" + who[i].key; (rk.get(k) || rk.set(k, []).get(k)).push(i); });
    const refundPairs = []; rk.forEach(rows => { const pos = rows.filter(i => flow[i] > 0), neg = rows.filter(i => flow[i] < 0), used = new Set();
      pos.forEach(p => { const n = neg.find(q => !used.has(q) && Math.abs(flow[q] + flow[p]) < 0.005); if (n != null) { used.add(n); refundPairs.push([n, p]); } }); });
    // the running balance: previous balance plus this amount is this balance, in the order the file is written
    let balanceBreaks = null;
    if (L.balance != null) {
      const bal = body.map(r => T.num(cellOf(r, L.balance))), ord = L.order === "desc" ? [...Array(N).keys()].reverse() : [...Array(N).keys()], br = [];
      const tol = LD.balanceTolerance; let j = 1;
      while (j < ord.length) {
        const e = ord[j], p = ord[j - 1]; if ([bal[e], bal[p], flow[e]].some(x => x !== x)) { j++; continue; }
        if (Math.abs(bal[e] - (bal[p] + flow[e])) <= tol) { j++; continue; }
        const e2 = ord[j + 1];
        if (e2 != null && !isNaN(bal[e2]) && !isNaN(flow[e2]) && Math.abs(bal[e2] - (bal[e] + flow[e2])) > tol && Math.abs(bal[e2] - (bal[p] + flow[e] + flow[e2])) <= tol) { br.push({ ri: e, expected: bal[p] + flow[e], found: bal[e], kind: "cell" }); j += 2; continue; }   // one balance typed wrong: this row and the next both disagree, but the next follows from the row before this one
        br.push({ ri: e, expected: bal[p] + flow[e], found: bal[e], kind: "jump" }); j++;
      }
      balanceBreaks = br;
    }
    // gaps in the dates longer than the usual
    const days = [...new Set(times)].sort((a, b) => a - b), dg = []; for (let j = 1; j < days.length; j++) dg.push((days[j] - days[j - 1]) / DAY);
    const typical = median(dg), limit = Math.max(LD.gap.minDays, LD.gap.factor * typical), gaps = [];
    for (let j = 1; j < days.length; j++) if ((days[j] - days[j - 1]) / DAY > limit) gaps.push({ from: days[j - 1], to: days[j], days: Math.round((days[j] - days[j - 1]) / DAY), ri: live.find(i => tm[i] === days[j]) });
    return { N, flow, outflow, inflow, net: inflow - outflow, nOut: out.length, nIn: inn.length, first, last, months: monthList, merchants, recurring, largest, weekday, dupPairs, refundPairs, balanceBreaks, gaps, typicalGap: typical, who, tm, unreadable: N - live.length };
  }

  // The findings a statement gets, as items in the shape the report already uses: { id, kind (insight | qa | fyi), cls, sev, title, detail, rule, todo, score, crumb, cells, why }.
  // L: the ledger's column indexes; D: ledgerData(); cn: the column names; RB: the file row of the first row of data. Returns { items, held } (held: candidates the data cannot support, with the reason).
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const usd0 = v => (v < 0 ? "-$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-US");
  const usd2 = v => (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dlong = t => { const d = new Date(t); return `${MONS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
  const plural = (n, one, many) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many || one + "s"}`;
  function ledgerItems(L, D, cn, RB) {
    const items = [], held = [], amtName = cn[L.amount], descName = cn[L.desc], dateName = cn[L.date], live = D.nOut + D.nIn, pc = (a, b) => (b ? Math.round(100 * a / b) : 0);
    const add = (it) => items.push({ cls: null, sev: "look", rule: "", todo: "", cells: [], crumb: it.title, ...it });
    const base = (o) => ({ n: live, names: [amtName], roles: ["amount"], valueKind: "money", aggregate: "sum", ...o });

    // insights: what a person wants from a statement
    add({ id: "ledger-flow", kind: "insight", score: 80, title: `Money out ${usd0(D.outflow)}, money in ${usd0(D.inflow)}: net ${D.net < 0 ? "-" : "+"}${usd0(Math.abs(D.net))}`,
      detail: `${plural(D.nOut, "outflow row")} and ${plural(D.nIn, "inflow row")} from ${dlong(D.first)} to ${dlong(D.last)}. A negative amount is money out and a positive one is money in: the sign is the direction, not an error.`, crumb: "Money out and in",
      why: base({ method: "sum of the negative and of the positive amounts" }) });
    const full = D.months.filter(m => !m.partial);
    if (D.months.length) { const sorted = [...full].sort((a, b) => a.out - b.out), lo = sorted[0], hi = sorted[sorted.length - 1], med = full.length ? [...full].map(m => m.out).sort((a, b) => a - b)[full.length >> 1] : 0;
      add({ id: "ledger-months", kind: "insight", score: 78, title: full.length ? `Money out runs from ${usd0(lo.out)} (${lo.label}) to ${usd0(hi.out)} (${hi.label}) a month` : "Money out by month",
        detail: full.length ? `Typical complete month ${usd0(med)}, over ${plural(full.length, "month")}.${D.months.some(m => m.partial) ? ` ${D.months.filter(m => m.partial).map(m => m.label).join(" and ")} ${D.months.filter(m => m.partial).length > 1 ? "are" : "is"} only part of a month, so ${D.months.filter(m => m.partial).length > 1 ? "they are" : "it is"} left out of this range.` : ""}` : "There is no complete month in this file.",
        crumb: "Money out by month", why: base({ method: "money out added up by calendar month, complete months only", kind: "months", n: full.length }) }); }
    if (D.merchants.length) { const top = D.merchants.slice(0, Rules.LEDGER.topMerchants), t0 = top[0];
      add({ id: "ledger-merchants", kind: "insight", score: 76, title: `${t0.name} is the biggest merchant: ${usd0(t0.out)}, ${pc(t0.out, D.outflow)}% of money out`,
        detail: `Top ${top.length} of ${D.merchants.length.toLocaleString("en-US")}: ${top.map(m => `${m.name} ${usd0(m.out)} (${m.n})`).join("; ")}.`, crumb: "Top merchants",
        why: base({ method: "money out added up by merchant", kind: "share", groups: D.merchants.length, n: D.nOut, names: [amtName, descName], roles: ["amount", "description"] }) }); }
    if (D.recurring.length) { const r = D.recurring, per = r.reduce((a, x) => a + x.perMonth, 0), cells = [];
      r.forEach(x => x.rows.forEach((ri, k) => cells.push({ ri, ci: L.amount, sev: "ctx", why: `<b>Part of a recurring charge: ${esc(x.name)}, ${usd2(x.amount)} about every ${x.every} days.</b> ${k === x.rows.length - 1 ? `The last one; the next is expected ${dlong(x.next)}.` : `Charge ${k + 1} of ${x.n}.`}`, eff: 0 })));
      cells.sort((a, b) => a.ri - b.ri);
      add({ id: "ledger-recurring", kind: "insight", score: 77, title: `${plural(r.length, "recurring charge")}, about ${usd0(per)} a month`,
        detail: r.map(x => `${x.name} ${usd2(x.amount)} ${x.monthly ? "monthly" : `every ${x.every} days`} (${x.n} times, last ${dlong(x.last)}, next expected ${dlong(x.next)})`).join("; ") + ".", crumb: "Recurring charges", cells,
        why: base({ method: "same merchant, same amount, a regular interval", kind: "recurring", n: cells.length, names: [amtName, descName, dateName], roles: ["amount", "description", "date"] }) }); }
    if (D.largest.length) { const cells = D.largest.map((x, k) => ({ ri: x.ri, ci: L.amount, sev: "ctx", why: `<b>#${k + 1} largest single item: ${usd2(x.amount)}.</b> ${esc(x.name)} on ${dlong(x.date)}.`, eff: x.amount }));
      add({ id: "ledger-largest", kind: "insight", score: 60, title: `The largest single item is ${usd2(D.largest[0].amount)} at ${D.largest[0].name}`,
        detail: D.largest.map(x => `${usd2(x.amount)} ${x.name}, ${dlong(x.date)}`).join("; ") + ".", crumb: "Largest single items", cells, why: base({ method: "the five largest outflows", n: D.nOut }) }); }
    const w = D.weekday;
    if (D.nOut) {
      if (w.standsOut || w.weeks < Rules.LEDGER.weekday.minWeeks || w.n < Rules.LEDGER.weekday.minOutflowRows) {
        add({ id: "ledger-weekday", kind: "insight", score: 40, title: `${w.names[w.top]} is the busiest day for spending: ${Math.round(w.share * 100)}% of money out`, detail: `Across ${Math.round(w.weeks)} weeks; an even spread would be ${Math.round(100 / 7)}% a day.`, crumb: "Spending by weekday",
          why: base({ method: "money out added up by weekday", kind: "weekday", n: w.n, weeks: w.weeks, groups: 7, valueKind: "share" }) }); }
      else held.push({ id: "ledger-weekday", title: "Spending by weekday", check: "weekday-even", reason: `No weekday stands out: the busiest, ${w.names[w.top]}, has ${Math.round(w.share * 100)}% of money out against an even ${Math.round(100 / 7)}%.` });
    }

    // QA: the checks a statement can fail
    if (D.dupPairs.length) { const cells = []; D.dupPairs.forEach(([x, y]) => { cells.push({ ri: y, ci: L.desc, sev: "fix", why: `<b>Duplicate of row ${x + RB}.</b> Same date, amount and merchant.`, eff: Math.abs(D.flow[y]) }); cells.push({ ri: x, ci: L.desc, sev: "fix", why: `<b>Has a duplicate in row ${y + RB}.</b> Same date, amount and merchant.`, eff: 0 }); });
      cells.sort((a, b) => a.ri - b.ri); const sum = D.dupPairs.reduce((a, [, y]) => a + Math.abs(D.flow[y]), 0), ex = D.dupPairs[0];
      add({ id: "dup", kind: "qa", cls: "duplicate", sev: "fix", score: 93, title: `${plural(D.dupPairs.length, "duplicate row")}`, detail: `Same ${dateName}, ${amtName} and merchant (rows ${ex[0] + RB} and ${ex[1] + RB}, for example). Together the extra copies are ${usd2(sum)}. A refund of the same amount on the same day is not a duplicate: it has the opposite sign.`,
        rule: "Rows with the same date, the same signed amount and the same merchant are one transaction entered twice; a refund has the opposite sign, so it never matches.", todo: "Delete the extra row, or keep both if you really paid twice.", crumb: "Duplicate rows", cells }); }
    if (D.balanceBreaks && D.balanceBreaks.length) { const b = D.balanceBreaks, cells = b.map(x => ({ ri: x.ri, ci: L.balance, sev: "fix", eff: Math.abs(x.found - x.expected),
        why: x.kind === "cell" ? `<b>The balance is ${usd2(x.found)}; the row before plus this amount makes ${usd2(x.expected)}.</b> The next row agrees with the one before, so this balance looks mistyped.` : `<b>The balance jumps ${usd2(x.found - x.expected)} here.</b> The row before plus this amount makes ${usd2(x.expected)}; the file says ${usd2(x.found)}. A transaction may be missing.` }));
      add({ id: "ledger-balance", kind: "qa", cls: "source-conflict", sev: "fix", score: 89, title: `${plural(b.length, "row")} where the balance does not follow from the one before`, detail: `Previous balance plus this amount should equal this balance${L.order === "desc" ? " (the file is newest first, so the row below is the earlier one)" : ""}. First at row ${b[0].ri + RB}: expected ${usd2(b[0].expected)}, found ${usd2(b[0].found)}.`,
        rule: "In a running balance, the previous balance plus this amount is this balance.", todo: "Compare with the statement: a missing transaction, a mistyped balance or an edited amount.", crumb: "Running balance", cells }); }
    if (D.gaps.length) { const g = [...D.gaps].sort((a, b) => b.days - a.days);
      add({ id: "ledger-gaps", kind: "qa", cls: "missing", sev: "look", score: 58, title: `${plural(D.gaps.length, "gap")} in the dates longer than the usual`, detail: `Rows are usually ${D.typicalGap <= 1 ? "a day or less" : Math.round(D.typicalGap) + " days"} apart. Longest: ${g[0].days} days, ${dlong(g[0].from)} to ${dlong(g[0].to)}.`,
        rule: "A stretch with no transactions much longer than the usual spacing is a missing part of the export or a real pause.", todo: "Ask whether the export skipped those dates.", crumb: "Gaps in the dates",
        cells: D.gaps.filter(x => x.ri != null).map(x => ({ ri: x.ri, ci: L.date, sev: "look", why: `<b>Nothing is dated in the ${x.days} days before this row.</b> The row before is dated ${dlong(x.from)}.`, eff: x.days })) }); }

    // FYI: true, useful, not a defect
    add({ id: "ledger-ends", kind: "fyi", score: 30, title: `The export ends on ${dlong(D.last)}`, detail: `The newest row is dated ${dlong(D.last)} and the oldest ${dlong(D.first)}. For a historical export that is expected, so it is not counted as out of date.`, crumb: "Where the export ends" });
    if (D.refundPairs.length) { const cells = []; D.refundPairs.forEach(([n, p]) => { cells.push({ ri: n, ci: L.amount, sev: "ctx", why: `<b>Refunded the same day (row ${p + RB}).</b> A charge and a refund of the same amount are not a duplicate.`, eff: 0 }); cells.push({ ri: p, ci: L.amount, sev: "ctx", why: `<b>Refund of row ${n + RB}, the same day.</b> Opposite sign, so it is not a duplicate.`, eff: 0 }); });
      cells.sort((a, b) => a.ri - b.ri);
      add({ id: "ledger-refunds", kind: "fyi", score: 29, title: `${plural(D.refundPairs.length, "charge")} refunded the same day`, detail: `A charge and a refund of the same amount on the same day have opposite signs, so they are not a duplicate (rows ${D.refundPairs[0][0] + RB} and ${D.refundPairs[0][1] + RB}, for example).`, crumb: "Same-day refunds", cells }); }
    return { items, held };
  }

  const API = { frame, detectHeader, nameByRole, leadSkip, looksLikeValue, balanceLink, detectLedger, ledgerData, ledgerItems, makeNormalizer, canonicalName, titleCase, usd0, usd2, dlong };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.JAIShape = API;
})(typeof self !== "undefined" ? self : this);
