/* JA Insights free report: what a column is, and the checks that follow from it (CONS-0059, CONS-0058, CONS-0063, CONS-0064).
   THE RULES YOU CAN EDIT ARE IN THE FIRST BLOCK, DOMAIN: which column names mean which role, thresholds, the eight data-quality classes, and every check with its
   one-sentence rule and what to do. Nothing in it names a topic: the report starts every file knowing nothing about it. Topic-specific rules live in optional
   rule packs (_src/jai/packs/, CONS-0068), never here.
   Pure logic, no page: it runs in the browser, in the worker and in Node (node _src/jai/tests/run.js). Nothing is uploaded or stored. */
(function (root) {
  "use strict";
  const Rules = typeof module !== "undefined" && module.exports ? require("./rules.js") : root.JAIRules;

  // =====================================================================================================
  // DOMAIN: edit here
  const DOMAIN = {
    // First matching name wins; names are compared lower-case with spaces, dashes and underscores treated alike.
    // Roles that come from the name: identifier, coordinates, postal, city, state, unit, address. Money, measure, date, category and text come from the values.
    roles: [
      ["identifier", /(^|[_\s-])(id|uuid|guid)$|^id([_\s-]|$)|^(row|rownum|record|observation|ref|reference)([_\s-]?(no|num|number|id))?$/],
      ["coordinates", /(^|[_\s-])(lat|latitude|lon|lng|long|longitude)($|[_\s-])/],
      ["unit", /^(address[_\s-]*)?(unit|apt|apartment|suite|ste)([_\s-]*(no|num|number))?$/],
      ["postal", /zip|postal|post[_\s-]?code/],
      ["city", /(^|[_\s-])(city|town|municipality)($|[_\s-])/],
      ["state", /^state([_\s-]|$)|province/],
      ["address", /address|street|addr/],
    ],
    countName: /\(#\)|(^|[\s_-])#($|[\s_-])|(^|[\s_-])(count|number of|num of|no of)($|[\s_-])/i,   // a name that says "how many", not "how much": Sales (#), order count
    moneyName: /price|amount|total|cost|revenue|sales?\b|value|income|profit|paid|fee|spend|rent|tax|consideration/,
    notMeasure: ["identifier", "coordinates", "unit", "postal", "year", "code", "phone", "amount", "balance"],   // numbers that are labels, not quantities
    placeRoles: ["address", "unit", "city", "state", "postal"],
    // A repeated tiny value in a money column is a placeholder, not an amount (CONS-0058).
    nominal: { floor: 1000, minTypical: 20000, minRest: 20, typicalShare: 0.01 },
    baselineMin: 8,           // a group needs this many non-nominal values to be its own baseline
    staleMonths: 18,          // the newest date in the file is older than this many months: the file may be out of date
    optionalShare: 0.5,       // a column empty in more than this share of rows is optional, not "missing"
    // The eight data-quality classes (CONS-0064) and whether a failure in one is hard (invalid: Fix, red) or advisory (Look, slate).
    classes: {
      malformed: { hard: true, label: "Malformed", means: "cannot be read as the kind of value its column holds" },
      duplicate: { hard: true, label: "Duplicate", means: "the same record entered more than once" },
      "repeated-value": { hard: false, label: "Repeated value", means: "one exact value repeated far more than chance allows" },
      missing: { hard: false, label: "Missing", means: "a blank in a column that is otherwise filled" },
      "contextual-outlier": { hard: false, label: "Outlier", means: "far from the usual for its own group; advisory" },
      "source-conflict": { hard: true, label: "Conflict", means: "two values for the same thing disagree" },
      stale: { hard: false, label: "Stale", means: "older than the rest of the file or than today" },
      "optional-field": { hard: false, label: "Optional field", means: "a column that is mostly empty on purpose" },
    },
    // Every check: id, the roles it needs, kind (qa = something to fix or confirm, insight = something the data says), its class, the rule in one sentence, what to do.
    checks: [
      { id: "nominal", label: "repeated tiny values in a money column", needs: ["money"], kind: "qa", cls: "repeated-value", rule: "A money value at or below $1,000 repeated many times in a column whose other values are far larger is a nominal amount, not a real one.", todo: "Confirm what these are; they are left out of every baseline." },
      { id: "dup", label: "duplicates", needs: [], kind: "qa", cls: "duplicate", rule: "Rows equal on every place field plus date and money are one record entered twice; identifiers never count as a match.", todo: "Delete the extra row or merge the two." },
      { id: "dupnear", label: "near-duplicates", needs: ["place"], kind: "qa", cls: "duplicate", rule: "Rows that match once the place is written the same way (case, punctuation, St and Street, unit formats) are probably one record.", todo: "Check the two rows and delete the extra." },
      { id: "ratio", label: "a money column over a measure column", needs: ["money", "measure"], kind: "qa", cls: "contextual-outlier", rule: "Money divided by a measure is compared with the median of the other non-nominal rows in the same group (at least 8 of them).", todo: "Check both numbers against the source." },
      { id: "dates", label: "impossible dates", needs: ["date"], kind: "qa", cls: "malformed", rule: "A date in the future or before 1900 cannot be right.", todo: "Correct the year from the source." },
      { id: "stale", label: "freshness", needs: ["date"], kind: "qa", cls: "stale", rule: "If the newest date is more than 18 months old, the file may be out of date.", todo: "Ask for a newer export." },
      { id: "idunique", label: "identifier uniqueness", needs: ["identifier"], kind: "qa", cls: "source-conflict", rule: "One identifier on two rows that are not copies of each other means two records share a key.", todo: "Find out which row owns the identifier." },
      { id: "coords", label: "coordinates", needs: ["coordinates"], kind: "qa", cls: "malformed", rule: "Latitude must be between -90 and 90, longitude between -180 and 180, and 0,0 means missing.", todo: "Look the place up again." },
      { id: "range", label: "plausible range for the topic", needs: ["topic"], kind: "qa", cls: "contextual-outlier", rule: "Values are judged against a reference range for the topic once the lookup (CONS-0065) exists.", todo: "Until then, baselines come from your file only." },
      { id: "repeat", label: "the same place over time", needs: ["address", "date", "money"], kind: "insight", cls: null, rule: "The same place on different dates; the money change is measured between the first and last non-nominal row.", todo: "Use them as a change-over-time sample." },
      { id: "extremes", label: "top and bottom by the chosen ratio", needs: ["money", "measure"], kind: "insight", cls: null, rule: "The five highest and five lowest ratio among non-nominal rows.", todo: "Read them first; they set the range." },
      { id: "concentration", label: "concentration by place", needs: ["city"], kind: "insight", cls: null, rule: "The share of rows in the three busiest places.", todo: "Know where the file is thin before comparing places." },
    ],
  };
  const CHK = Object.fromEntries(DOMAIN.checks.map(c => [c.id, c]));

  // =====================================================================================================
  // Roles
  const keyName = n => String(n).toLowerCase().replace(/[_\s-]+/g, " ").trim();
  const isCountValues = v => { let ints = true; const pos = []; for (const x of v) { if (x !== x) continue; if (x !== Math.floor(x)) { ints = false; break; } if (x > 0) pos.push(x); } if (!ints || !pos.length) return false; pos.sort((a, b) => a - b); return pos[pos.length >> 1] <= 12; };
  const unitOf = name => Rules.UNITS.find(u => u.re.test(String(name))) || null;
  // A number that names something rather than measures it: a phone number, a year, a row number (CONS-0070). Judged on the values when the name says nothing.
  function roleByValues(c, body, num) {
    const nm = keyName(c.name), moneyOrUnit = DOMAIN.moneyName.test(nm) || unitOf(c.name);
    const raw = body.map(r => String(r[c.i]).trim()).filter(Boolean); if (raw.length < 3) return null;
    if (raw.filter(v => Rules.ROLES.phone.test(v) && v.replace(/\D/g, "").length >= 10).length >= raw.length * 0.9) return "phone";
    if (c.type !== "number" || moneyOrUnit) return null;
    const v = raw.map(num), Y = Rules.ROLES.year;
    if (v.filter(x => Number.isInteger(x) && x >= Y.min && x <= Y.max).length >= raw.length * Y.share && c.distinct <= Y.maxDistinct) return "year";
    const S = Rules.ROLES.sequence;
    if (raw.length >= S.minRows && v.every(Number.isInteger) && c.distinct >= raw.length * S.distinct) {
      let up = 0, down = 0; for (let i = 1; i < v.length; i++) { if (v[i] > v[i - 1]) up++; else if (v[i] < v[i - 1]) down++; }
      if (Math.max(up, down) >= (v.length - 1) * S.ordered) return "identifier";
    }
    return null;
  }
  // overrides: { "<column name>": role } from the Columns table; "auto" or nothing leaves the detected role (CONS-0070)
  function assignRoles(cols, body, num, overrides) {
    cols.forEach(c => {
      const nm = keyName(c.name), nmRaw = String(c.name).toLowerCase(); c.role = null; c.roleBy = null; c.moneyBy = null; c.count = false;
      for (const [role, re] of DOMAIN.roles) { if (re.test(nm) || re.test(nmRaw)) { c.role = role; c.roleBy = "name"; break; } }
      if (!c.role && c.type === "number") { for (const [role, re] of Rules.ROLES.byName) { if (re.test(nm)) { c.role = role; c.roleBy = "name"; break; } } }
      if (!c.role) { const r = roleByValues(c, body, num); if (r) { c.role = r; c.roleBy = "values"; } }
      if (!c.role && c.type === "id") { c.role = "identifier"; c.roleBy = "values"; }
      if (c.role === "identifier" && c.type !== "id" && c.type !== "number" && c.distinct < c.filled * 0.9) { c.role = null; c.roleBy = null; }   // a column called id that repeats is a key to something else, not this row's id
      if (c.type === "number" && !c.role) {
        const byName = DOMAIN.moneyName.test(nm) && !/(^|\s)(per|psf)(\s|$)/.test(nm) && !DOMAIN.countName.test(nmRaw), raw = body.map(r => r[c.i]).filter(v => String(v).trim() !== "");
        const byFormat = raw.length >= 10 && raw.filter(v => /^\s*[-(]?\$/.test(v) || /^\s*-?[\d,]+\.\d\d\s*$/.test(v)).length >= raw.length * 0.9;
        if (byName || byFormat) { c.role = "money"; c.moneyBy = byName ? "name" : "format"; c.roleBy = c.moneyBy; }
        else { c.role = "measure"; c.count = isCountValues(body.map(r => num(r[c.i]))); }
      }
      if (!c.role) c.role = c.type === "date" ? "date" : c.type === "category" ? "category" : c.type === "empty" ? "empty" : "text";
      c.detected = c.role;
    });
    const ov = overrides || {};
    cols.forEach(c => {
      const o = ov[c.name]; if (!o || o === "auto") return;
      const allowed = Rules.ROLES.userRoles[c.type === "number" ? "number" : c.type === "date" ? "date" : "other"]; if (!allowed.includes(o)) return;
      c.role = o; c.roleBy = "you"; c.moneyBy = o === "money" ? "you" : null; c.count = false;
      if (o === "measure") c.count = isCountValues(body.map(r => num(r[c.i])));
      if (o === "category" || o === "text") { c.type = o; c.bad = 0; c.mixed = 0; c.mixedId = 0; }
    });
    return cols;
  }
  const byRole = (cols, role) => cols.filter(c => c.role === role);
  const roleLabel = c => (c.role === "money" ? (c.moneyBy === "format" ? "money (by format)" : c.moneyBy === "you" ? "money" : "money (by name)") : c.role === "identifier" ? "identifier (not matched)" : c.role === "measure" ? "measure" + (c.count ? " (count)" : "") : ["year", "code", "phone"].includes(c.role) ? c.role + " (not a quantity)" : DOMAIN.placeRoles.includes(c.role) || c.role === "coordinates" ? "place: " + c.role : c.role) + (c.roleBy === "you" ? ", set by you" : "");
  // Money over a measure, offered only when the measure carries a unit (CONS-0063, CONS-0070). The ones held back are returned with a reason, for the Not shown list.
  // The money columns that make up a quantity x price = total line are left out.
  const why = { year: "a year", code: "a code", phone: "a phone number", identifier: "an identifier", postal: "a postal code", coordinates: "a coordinate", unit: "a unit number" };
  function ratioCandidates(cols, calc) {
    const moneys = cols.filter(c => c.role === "money" && c.type === "number" && !(calc && (c.i === calc.total || c.i === calc.price)));
    const money = moneys.find(c => /price|amount|value|cost/i.test(c.name)) || moneys[0]; if (!money) return { pairs: [], held: [] };
    const noun = /price/i.test(money.name) ? "price" : keyName(money.name), pairs = [], held = [];
    cols.filter(c => c.type === "number" && c !== money && c.role !== "money" && c.role !== "balance").forEach(c => {
      const label = `${noun} per ${keyName(c.name)}`;
      if (c.role !== "measure") { held.push({ col: c.name, label, reason: `${c.name} is ${why[c.role] || "not a quantity"}, not a quantity, so a price per ${keyName(c.name)} means nothing.` }); return; }
      const u = unitOf(c.name);
      if (!u) { held.push({ col: c.name, label, reason: `${c.name} has no unit in its name (area, quantity, hours, miles, weight), so a ratio to it would not say what it is per.` }); return; }
      pairs.push({ a: money, b: c, unit: u.per, basis: `${keyName(money.name)} over ${keyName(c.name)}`, label: `${noun} per ${u.per}` });
    });
    const seen = new Map(); pairs.forEach(p => seen.set(p.label, (seen.get(p.label) || 0) + 1)); pairs.forEach(p => { if (seen.get(p.label) > 1) p.label += ` (${keyName(p.b.name)})`; });
    return { pairs: pairs.slice(0, 2), held };
  }
  const ratioPairs = (cols, calc) => ratioCandidates(cols, calc).pairs;

  // =====================================================================================================
  // Places: write the same place the same way
  const SUF = { street: "st", st: "st", avenue: "ave", ave: "ave", av: "ave", boulevard: "blvd", blvd: "blvd", road: "rd", rd: "rd", drive: "dr", dr: "dr", lane: "ln", ln: "ln", court: "ct", ct: "ct", place: "pl", pl: "pl", terrace: "ter", ter: "ter", circle: "cir", cir: "cir", highway: "hwy", hwy: "hwy", parkway: "pkwy", pkwy: "pkwy", trail: "trl", trl: "trl" };
  const DIR = { north: "n", south: "s", east: "e", west: "w", northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw", n: "n", s: "s", e: "e", w: "w", ne: "ne", nw: "nw", se: "se", sw: "sw" };
  const normAddress = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean).map(t => SUF[t] || DIR[t] || t).join(" ");
  const normUnit = s => String(s).toLowerCase().replace(/\b(apt|apartment|unit|suite|ste|no|number)\b|#/g, " ").replace(/[^a-z0-9]+/g, "").replace(/^0+(?=\d)/, "");
  const normPostal = s => String(s).trim().slice(0, 5);
  const normText = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  // =====================================================================================================
  // Nominal transfers (CONS-0058): set aside, counted, never part of a baseline
  function findNominal(body, cols, num, median) {
    const out = new Map();
    cols.filter(c => c.type === "number" && c.role === "money").forEach(c => {
      const v = body.map(r => num(r[c.i])), pos = v.filter(x => x > 0);
      if (pos.length < 30) return;
      const big = pos.filter(x => x > DOMAIN.nominal.floor), typical = big.length >= DOMAIN.nominal.minRest ? median(big) : median(pos);
      const floor = typical >= DOMAIN.nominal.minTypical ? DOMAIN.nominal.floor : typical * DOMAIN.nominal.typicalShare;
      const rows = []; v.forEach((x, ri) => { if (x >= 0 && x <= floor && !isNaN(x)) rows.push(ri); });
      if (rows.length < 3 || rows.length > body.length * 0.5) return;
      const rest = v.filter(x => x > floor), vals = new Map(); rows.forEach(ri => vals.set(v[ri], (vals.get(v[ri]) || 0) + 1));
      out.set(c.i, { col: c, rows, set: new Set(rows), floor, typical: median(rest), nRest: rest.length, values: [...vals.entries()].sort((a, b) => b[1] - a[1]) });
    });
    return out;
  }

  // =====================================================================================================
  // Duplicates and repeat occurrences (CONS-0059). ctx: { body, cols, num, dt, dateCol, measure, nominal }
  function duplicates(ctx) {
    const { body, cols, num, dt } = ctx, ids = byRole(cols, "identifier");
    const place = DOMAIN.placeRoles.flatMap(r => byRole(cols, r));
    const dateC = ctx.dateCol || byRole(cols, "date")[0] || null;
    const moneyC = byRole(cols, "money").find(c => /price|amount|value|cost/i.test(c.name)) || byRole(cols, "money")[0] || (ctx.measure && ctx.measure.type === "number" ? ctx.measure : null);
    if (!byRole(cols, "address").length || (!dateC && !moneyC)) return { mode: "row", ids };
    const keyCols = [...place, ...(dateC ? [dateC] : []), ...(moneyC ? [moneyC] : [])];
    const norm = (c, r) => { const v = r[c.i]; if (c === dateC) { const t = dt(v); return t == null ? String(v).trim() : String(t); } if (c === moneyC) { const x = num(v); return isNaN(x) ? String(v).trim() : String(x); }
      switch (c.role) { case "address": return normAddress(v); case "unit": return normUnit(v); case "postal": return normPostal(v); default: return normText(v); } };
    const rawKey = r => keyCols.map(c => String(r[c.i]).trim()).join("\u0001"), nrmKey = r => keyCols.map(c => norm(c, r)).join("\u0001");
    const exact = new Map();
    body.forEach((r, ri) => { if (keyCols.every(c => String(r[c.i]).trim() === "")) return; const k = rawKey(r); (exact.get(k) || exact.set(k, []).get(k)).push(ri); });
    const exactPairs = [], nearPairs = [];
    exact.forEach(rows => { if (rows.length > 1) rows.slice(1).forEach(ri => exactPairs.push([rows[0], ri])); });
    const rep = new Map(); exact.forEach(rows => { const k = nrmKey(body[rows[0]]); (rep.get(k) || rep.set(k, []).get(k)).push(rows[0]); });
    rep.forEach(rows => { if (rows.length > 1) rows.slice(1).forEach(ri => nearPairs.push([rows[0], ri])); });
    return { mode: "place", ids, keyCols, fields: keyCols.map(c => c.name), exactPairs, nearPairs, dateC, moneyC, placeCols: place };
  }
  const listWords = a => a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

  function repeatOccurrences(ctx, dups) {
    const { body, num, dt, nominal } = ctx;
    if (!dups || dups.mode !== "place" || !dups.dateC) return null;
    const dateC = dups.dateC, moneyC = dups.moneyC, pc = dups.placeCols, nomSet = moneyC && nominal && nominal.get(moneyC.i) ? nominal.get(moneyC.i).set : new Set();
    const by = new Map();
    body.forEach((r, ri) => { const t = dt(r[dateC.i]); if (t == null) return; const k = pc.map(c => (c.role === "address" ? normAddress(r[c.i]) : c.role === "unit" ? normUnit(r[c.i]) : c.role === "postal" ? normPostal(r[c.i]) : normText(r[c.i]))).join("|");
      if (!k.replace(/\|/g, "")) return; (by.get(k) || by.set(k, []).get(k)).push({ ri, t }); });
    const groups = [];
    by.forEach(list => {
      if (new Set(list.map(x => x.t)).size < 2) return;
      const seen = new Set(), occ = list.filter(x => { if (seen.has(x.t)) return false; seen.add(x.t); return true; }).sort((a, b) => a.t - b.t);
      const priced = moneyC ? occ.filter(x => !nomSet.has(x.ri) && num(body[x.ri][moneyC.i]) > 0) : [];
      let change = null;
      if (priced.length >= 2) { const a = priced[0], b = priced[priced.length - 1], p1 = num(body[a.ri][moneyC.i]), p2 = num(body[b.ri][moneyC.i]), days = (b.t - a.t) / 864e5; if (days >= 30) change = { pct: p2 / p1 - 1, annual: Math.pow(p2 / p1, 365 / days) - 1, days }; }
      groups.push({ rows: occ.map(x => x.ri), change });
    });
    return groups.length ? groups : null;
  }

  // =====================================================================================================
  // Role-driven items. Each: { id, kind, cls, sev, title, detail, rule, todo, score, crumb, cells:[{ri,ci,sev,why,eff}] }
  const nf = n => n.toLocaleString("en-US");
  const mon = v => "$" + Math.round(v).toLocaleString("en-US");
  const pctS = x => (x >= 0 ? "+" : "") + Math.round(x * 100) + "%";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  function domainItems(ctx, dups, repeats) {
    const { body, cols, num, nominal } = ctx, items = [], RB = ctx.rowBase || 2;   // RB: the file row of the first row of data
    const first = r => byRole(cols, r)[0] || null, rowList = (cells, k = 3) => cells.slice(0, k).map(c => c.ri + RB).join(", ") + (cells.length > k ? ` and ${cells.length - k} more` : "");
    const push = (id, sev, title, detail, score, cells, crumb) => { const chk = CHK[id] || {}; items.push({ id, kind: chk.kind || "qa", cls: chk.cls || null, sev, title, detail, rule: chk.rule || "", todo: chk.todo || "", score, crumb: crumb || title, cells }); };

    byRole(cols, "identifier").filter(c => c.type === "id" || c.roleBy === "name").forEach(c => {   // an identifier on two rows that are not copies of each other
      const m = new Map(); body.forEach((r, ri) => { const v = String(r[c.i]).trim(); if (v) (m.get(v) || m.set(v, []).get(v)).push(ri); });
      const cells = []; m.forEach((rows, v) => { if (rows.length < 2) return; const distinct = new Set(rows.map(ri => body[ri].filter((_, i) => i !== c.i).join("\u0001"))); if (distinct.size > 1) rows.forEach(ri => cells.push({ ri, ci: c.i, sev: "fix", why: `<b>${esc(v)} is on ${rows.length} rows that differ from each other.</b> Two records share one ${esc(keyName(c.name))}.`, eff: 0 })); });
      cells.sort((a, b) => a.ri - b.ri); if (cells.length) push("idunique", "fix", `${nf(cells.length)} rows share a ${keyName(c.name)} with a different record`, `Rows ${rowList(cells)}.`, 83, cells, `Shared ${keyName(c.name)}`);
    });
    const lat = byRole(cols, "coordinates").find(c => /lat/i.test(c.name)), lon = byRole(cols, "coordinates").find(c => /lon|lng|long/i.test(c.name));
    if (lat && lon) {
      const cells = []; body.forEach((r, ri) => { const a = num(r[lat.i]), b = num(r[lon.i]); if (isNaN(a) || isNaN(b)) return; if (Math.abs(a) > 90 || Math.abs(b) > 180 || (a === 0 && b === 0)) cells.push({ ri, ci: lat.i, sev: "fix", why: `<b>${esc(r[lat.i])}, ${esc(r[lon.i])} is not a place on Earth</b>${a === 0 && b === 0 ? " (0, 0 usually means missing)" : ""}.`, eff: 0 }); });
      if (cells.length) push("coords", "fix", `${nf(cells.length)} impossible coordinate${cells.length > 1 ? "s" : ""}`, `Rows ${rowList(cells)}.`, 84, cells, "Impossible coordinates");
    }
    if (repeats && repeats.length) {
      const cells = [], ch = repeats.filter(g => g.change), moneyC = dups.moneyC, addrC = first("address");
      repeats.forEach(g => g.rows.forEach((ri, k) => { if (k === 0) return; const pr = g.rows[k - 1], nomSet = moneyC && nominal.get(moneyC.i) ? nominal.get(moneyC.i).set : new Set();
        const ch2 = moneyC && num(body[ri][moneyC.i]) > 0 && num(body[pr][moneyC.i]) > 0 && !nomSet.has(ri) && !nomSet.has(pr) ? num(body[ri][moneyC.i]) / num(body[pr][moneyC.i]) - 1 : null;
        cells.push({ ri, ci: addrC.i, sev: "ctx", why: `<b>Seen again on ${esc(body[ri][dups.dateC.i])}${ch2 != null ? `, ${esc(moneyC.name)} ${pctS(ch2)} against row ${pr + RB}` : ""}.</b> The same place appears on ${g.rows.length} different dates.`, eff: 0 });
        if (k === 1) cells.push({ ri: pr, ci: addrC.i, sev: "ctx", why: `<b>Seen again later (row ${ri + RB}).</b> The same place appears on ${g.rows.length} different dates.`, eff: 0 }); }));
      cells.sort((a, b) => a.ri - b.ri);
      const detail = ch.length ? `Between the first and last row, ${moneyC.name} changed by a median of ${pctS(median(ch.map(g => g.change.pct)))} (about ${pctS(median(ch.map(g => g.change.annual)))} a year) across ${nf(ch.length)} of them. Nominal rows are left out of the comparison.` : "";
      push("repeat", "ctx", `${nf(repeats.length)} place${repeats.length > 1 ? "s" : ""} appear${repeats.length > 1 ? "" : "s"} on more than one date`, `${detail} Rows ${rowList(cells)}.`, 50, cells, "The same place over time");
      items[items.length - 1].repeat = { n: repeats.length, pct: ch.length ? median(ch.map(g => g.change.pct)) : null, annual: ch.length ? median(ch.map(g => g.change.annual)) : null, nPriced: ch.length };
      items[items.length - 1].why = { method: "same place on more than one date, change between the first and last non-nominal row", n: repeats.length, names: [addrC.name, dups.dateC.name, ...(moneyC ? [moneyC.name] : [])], roles: ["address", "date", ...(moneyC ? ["money"] : [])], valueKind: "change", aggregate: "median" };
    }
    const rp = ratioPairs(cols, ctx.calc)[0];
    if (rp) {
      const nomSet = nominal.get(rp.a.i) ? nominal.get(rp.a.i).set : new Set(), L = [];
      body.forEach((r, ri) => { const p = num(r[rp.a.i]), a = num(r[rp.b.i]); if (p > 0 && a > 0 && !nomSet.has(ri)) L.push({ ri, v: p / a }); });
      if (L.length >= 1) {
        L.sort((a, b) => a.v - b.v || a.ri - b.ri); const lo = L.slice(0, 5), hi = L.slice(-5).reverse(), fmt = v => (v >= 100 ? mon(v) : "$" + v.toFixed(2)), cells = [];
        hi.forEach((x, k) => cells.push({ ri: x.ri, ci: rp.a.i, sev: "ctx", why: `<b>#${k + 1} highest ${rp.label}: ${fmt(x.v)}.</b> Among the five highest of ${nf(L.length)} non-nominal rows.`, eff: 0 }));
        lo.forEach((x, k) => cells.push({ ri: x.ri, ci: rp.a.i, sev: "ctx", why: `<b>#${k + 1} lowest ${rp.label}: ${fmt(x.v)}.</b> Among the five lowest of ${nf(L.length)} non-nominal rows.`, eff: 0 }));
        push("extremes", "ctx", `The five highest and lowest ${rp.label}`, `Highest ${hi.map(x => fmt(x.v)).join(", ")}; lowest ${lo.map(x => fmt(x.v)).join(", ")}. Based on ${rp.basis}.`, 45, cells, `Highest and lowest ${rp.label}`);
        items[items.length - 1].why = { method: "ratio", numeratorRole: rp.a.role, denominatorRole: rp.b.role, units: rp.unit, denominator: rp.b.name, n: L.length, names: [rp.a.name, rp.b.name], roles: [`${rp.a.role}:${rp.a.name}`, `${rp.b.role}:${rp.b.name}`], valueKind: "money", aggregate: "ratio" };
      }
    }
    const cityC = first("city");
    if (cityC) {
      const m = new Map(); body.forEach(r => { const c = String(r[cityC.i]).trim(); if (c) m.set(c, (m.get(c) || 0) + 1); }); const tot = [...m.values()].reduce((a, b) => a + b, 0), top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (m.size >= 1 && tot) items.push({ id: "concentration", kind: "insight", cls: null, sev: "look", why: { method: "share of rows in the three busiest values", kind: "concentration", groups: m.size, n: tot, names: [cityC.name], roles: ["city"], valueKind: "count", aggregate: "count" }, title: `${Math.round(top.reduce((a, x) => a + x[1], 0) / tot * 100)}% of the rows are in three ${keyName(cityC.name)} values`, detail: `${top.map(x => `${x[0]} (${nf(x[1])})`).join(", ")} of ${nf(m.size)}.`, rule: CHK.concentration.rule, todo: CHK.concentration.todo, score: 42, crumb: "Concentration by place", cells: [] });
    }
    return items;
  }

  // =====================================================================================================
  // The insight gate (CONS-0074). A candidate is { id, kind, title, detail, why: { method, kind?, numeratorRole?, denominatorRole?, units?, n, groups?, names[], valueKind, aggregate } }.
  // Each function returns null when the candidate passes and a sentence (the reason) when it does not. The checks and the minimums are data in rules.js (GATE).
  const GATE_FN = {
    "ratio-unit": (c, g) => { const w = c.why; if (w.method !== "ratio") return null;
      return w.numeratorRole === "money" && w.denominatorRole === "measure" && w.units ? null : `A ratio is money over a measure that carries a unit; ${w.denominator || "the denominator"} is ${w.denominatorRole === "measure" ? "a measure with no unit" : "a " + w.denominatorRole + ", not a quantity"}.`; },
    "min-rows": (c) => { const w = c.why, m = Rules.GATE.minimums.extremes; return w.method === "ratio" && c.id === "extremes" && w.n < m ? `Top and bottom needs at least ${m} non-nominal rows and the file has ${w.n}.` : null; },
    "min-groups": (c) => { const w = c.why, M = Rules.GATE.minimums;
      if (w.kind === "share" && w.groups < M.share) return `A share needs at least ${M.share} groups and ${w.names[0] || "the column"} has ${w.groups}.`;
      if (w.kind === "concentration" && w.groups < M.concentration) return `A concentration needs at least ${M.concentration} groups and ${w.names[0] || "the column"} has ${w.groups}.`; return null; },
    "min-periods": (c) => { const w = c.why, M = Rules.GATE.minimums, W = Rules.LEDGER.weekday;
      if (w.kind === "months" && w.n < M.months) return `A by-month insight needs at least ${M.months} complete months and the file has ${w.n}.`;
      if (w.kind === "weekday" && (w.weeks < W.minWeeks || w.n < W.minOutflowRows)) return `A weekday pattern needs at least ${W.minWeeks} weeks and ${W.minOutflowRows} outflow rows; the file has ${Math.floor(w.weeks)} weeks and ${w.n} rows.`; return null; },
    "label-vocab": (c) => { const w = c.why, text = c.title + " " + (c.detail || ""); if (w.aggregate === "sum") return null;
      const bad = (w.names || []).find(n => new RegExp("\\btotal\\s+" + String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)); return bad ? `“Total ${bad}” is for a sum; this is a ${w.aggregate}. It reads Rows.` : null; },
    "count-not-money": (c) => { const w = c.why, text = c.title + " " + (c.detail || "");
      if (w.valueKind === "count" && /\$\s?\d/.test(text)) return "A count is shown with a money sign."; if (w.valueKind === "money" && /\d/.test(text) && !/\$/.test(text)) return "A money value is shown without its money sign."; return null; },
    "value-name": (c, g) => { const bad = (c.why.names || []).find(n => g.looksLikeValue && g.looksLikeValue(n)); return bad ? `The column name “${bad}” looks like a value, so it is not quoted.` : null; },
  };
  function gate(cands, g) {
    const shown = [], held = [];
    cands.forEach(c => { if (!c.why) { shown.push(c); return; }
      const fail = Rules.GATE.checks.map(k => [k.id, GATE_FN[k.id](c, g || {})]).find(x => x[1]);
      if (fail) held.push({ id: c.id, title: c.title, check: fail[0], reason: fail[1], why: c.why }); else shown.push(c); });
    return { shown, held };
  }

  // What the file could not be checked for: every check whose roles are missing
  function notChecked(cols, ledger) {
    const has = r => cols.some(c => c.role === r) || (r === "place" && cols.some(c => DOMAIN.placeRoles.includes(c.role)));
    const off = c => ledger && Rules.LEDGER.off.includes(c.id);   // a ledger is not asked for these, by design (CONS-0072)
    const miss = DOMAIN.checks.filter(c => c.needs.length && !c.needs.every(has) && !off(c));
    const why = n => ({ money: "a money column", measure: "a measure column", date: "a date column", place: "a place column (address, city, state or postal code)", address: "an address column", city: "a city column", identifier: "an identifier column", coordinates: "latitude and longitude columns", topic: "a topic reference (lookup, CONS-0065)" }[n] || `a ${n} column`);
    return { missing: miss.map(c => ({ id: c.id, label: c.label, because: c.needs.filter(n => !has(n)).map(why) })), off: DOMAIN.checks.filter(off).map(c => ({ id: c.id, label: c.label })) };
  }
  const classOf = id => (CHK[id] ? CHK[id].cls : null);

  const API = { DOMAIN, GATE_FN, gate, assignRoles, roleLabel, ratioPairs, ratioCandidates, unitOf, normAddress, normUnit, normPostal, findNominal, duplicates, repeatOccurrences, domainItems, notChecked, listWords, classOf, CHK, byRole };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.JAIDomain = API;
})(typeof self !== "undefined" ? self : this);
