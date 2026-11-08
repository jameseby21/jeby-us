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

  const API = { frame, detectHeader, nameByRole, leadSkip, looksLikeValue, balanceLink };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.JAIShape = API;
})(typeof self !== "undefined" ? self : this);
