/* Free report tests, part 3: round 3 (CONS-0071 headers, CONS-0070 roles, CONS-0074 the insight gate, CONS-0072 ledgers, CONS-0073 names).
   Loaded by run.js with its helpers. Synthetic fixtures only (made by make_fixtures.py): no real rows are in this repository. */
"use strict";
module.exports = function (h) {
  const { test, assert, R, Rec, Dom, load, truth, plain, read, outFlags } = h;
  const fs = require("fs"), path = require("path"), FX = path.join(__dirname, "fixtures"), Shape = require("../src/shape.js"), T = { num: R.num, dt: R.dt, profileCol: R.profileCol };
  const everyText = (a, d) => [...a.findingsAll.flatMap(f => [f.title, f.detail]), ...[...a.flags.values()].map(f => f.why), ...R.pickNotable(a, R.makeStore(d, a)).map(w => w.reason + " " + w.title)].map(plain);

  // ---------- CONS-0071
  console.log("headerless and mis-headered files (CONS-0071)");
  const LH = load("ledger_headerless.csv"), LD = load("ledger_header.csv"), LT = load("ledger_title.csv"), NH = load("numeric_header.csv"), LG = truth("ledger.truth.json");
  const aNone = R.analyse(LH), aHead = R.analyse(LD), aTitle = R.analyse(LT), aNum = R.analyse(NH);
  test("header detection, four shapes: a header, none, a title row above a header, a header made of years", () => {
    assert.strictEqual(aHead.hdr.isHeader, true); assert.strictEqual(aHead.hdr.conf, "high"); assert.strictEqual(aHead.hdr.titleRows.length, 0);
    assert.strictEqual(aNone.hdr.isHeader, false); assert.strictEqual(aNone.hdr.conf, "high");
    assert.strictEqual(aTitle.hdr.isHeader, true); assert.strictEqual(aTitle.hdr.titleRows.length, 1); assert(/Synthetic checking activity/.test(aTitle.hdr.titleRows[0]));
    assert.strictEqual(aNum.hdr.isHeader, true); assert.deepStrictEqual(aNum.header, ["Year 2022", "Year 2023", "Year 2024"]);
  });
  test("a headerless file says so and names its columns by role: Date, Amount, Description, Type, Balance, Column N", () => {
    assert(/^No header row detected \(high confidence\); names below are ours\./.test(aNone.hdr.note), aNone.hdr.note);
    assert.deepStrictEqual(aNone.header, ["Type", "Date", "Description", "Amount", "Column 5", "Balance", "Column 7", "Column 8"]);
    assert.strictEqual(aNone.N, LG.rows); assert.strictEqual(aHead.N, LG.rows); assert.strictEqual(aTitle.N, LG.rows);
    assert.deepStrictEqual(aHead.header.slice(0, 6), ["Details", "Posting Date", "Description", "Amount", "Type", "Balance"]);
    assert.deepStrictEqual(aTitle.header, aHead.header);
  });
  test("the screenshot's naming defects are gone: no column named by a value, no 'aren't numbers' finding on a column named by a value", () => {
    [aNone, aHead, aTitle, aNum].forEach(a => assert(a.header.every(n => !Shape.looksLikeValue(n, T)), "value-like name in " + a.header.join("|")));
    const bad = aNone.findingsAll.filter(f => /aren't numbers/.test(f.title)); assert.strictEqual(bad.length, 0, bad.map(f => f.title).join(" | "));
  });
  test("flip the switch: the first row becomes the header and the report is worked out again; flip back and it is the same", () => {
    const f = R.analyse(LH, { header: "header" });
    assert.strictEqual(f.hdr.isHeader, true); assert.strictEqual(f.hdr.forced, true); assert.strictEqual(f.N, aNone.N - 1);
    assert(f.header.every(n => !Shape.looksLikeValue(n, T)), "names: " + f.header.join("|")); assert(/looked like a value/.test(f.hdr.note), f.hdr.note);
    assert.notDeepStrictEqual(f.header, aNone.header);
    const g = R.analyse(LD, { header: "data" }); assert.strictEqual(g.hdr.isHeader, false); assert.strictEqual(g.N, aHead.N + 1);
    const back = R.analyse(LH, { header: "data" }); assert.deepStrictEqual(back.header, aNone.header); assert.strictEqual(back.N, aNone.N);
  });
  test("self-check: no finding, flag or worth-a-look line quotes a column name that looks like a value (every shape, both switch positions)", () => {
    const runs = [[LH, {}], [LH, { header: "header" }], [LD, {}], [LD, { header: "data" }], [LT, {}], [NH, {}], [load("sales_planted.csv"), {}], [load("venues.csv"), {}]];
    runs.forEach(([d, c]) => { const a = R.analyse(d, c); assert(a.header.every(n => !Shape.looksLikeValue(n, T)), "header: " + a.header.join("|"));
      everyText(a, d).forEach(t => a.header.forEach(n => assert(!(Shape.looksLikeValue(n, T) && t.includes(n)), `text quotes “${n}”: ${t}`))); });
  });
  test("what looks like a value and what does not", () => {
    ["11/19/2018", "-1862.94", "$5.00", "2019", "KROGER 710 COLUMBUS IN 50910", "this is a whole sentence of words here"].forEach(v => assert(Shape.looksLikeValue(v, T), v));
    ["Posting Date", "Sales (#)", "Amount", "DEBIT_CARD", "Q1 2023 revenue", "sale_price", "Column 7"].forEach(v => assert(!Shape.looksLikeValue(v, T), v));
  });
  test("row numbers are the file's own: 1 for the first row of a headerless file, 2 under a header, 3 under a title row and a header", () => {
    assert.deepStrictEqual([aNone.rowBase, aHead.rowBase, aTitle.rowBase], [1, 2, 3]);
    const w = R.pickNotable(aNone, R.makeStore(LH, aNone)); w.forEach(x => assert(new RegExp("^Row " + (x.ri + 1).toLocaleString("en-US") + " ").test(x.title), x.title));
  });
  test("export gives the file back byte for byte, whether it has no header, a header or a title row; the change log uses the file's row numbers", () => {
    for (const [n, d, a] of [["ledger_headerless.csv", LH, aNone], ["ledger_header.csv", LD, aHead], ["ledger_title.csv", LT, aTitle]]) { const s = R.makeStore(d, a); assert.strictEqual(Rec.exportCSV(s), read(n), n); }
    const s = R.makeStore(LH, aNone); Rec.commitEdit(s, 0, 2, "PAYROLL ACME", new Date("2026-11-08T12:00:00Z"));
    assert.deepStrictEqual(R.parseDelimited(Rec.changeLogCSV(s))[1].slice(0, 2), ["1", "Description"]);
    assert.strictEqual(R.parseDelimited(Rec.exportCSV(s)).length, LG.rows);
  });
  test("the delimiter is decided by the first lines together, so a title row with commas does not break it", () => {
    const rows = R.parseDelimited('"Report, run Nov 8, for Q3"\nA;B;C\n1;2;3\n4;5;6\n'); assert.deepStrictEqual(rows[1], ["A", "B", "C"]);
    assert.strictEqual(rows.fmt.delim, ";");
  });

  // ---------- CONS-0070
  console.log("roles: a year, a zip, a phone and an id are not measures (CONS-0070)");
  const SR = load("sales_roles.csv"), aSR = R.analyse(SR), roleOf = (a, n) => a.cols.find(c => c.name === n).role;
  const mk = (name, vals) => ({ name, rows: [[name, "x"], ...vals.map((v, i) => [String(v), "r" + i])] });
  const solo = (name, vals) => { const a = R.analyse({ name: "t", rows: [[name, "other"], ...vals.map((v, i) => [String(v), "r" + (i % 3)])] }); return a.cols[0].role; };
  test("role detection: years, zips, phones, codes and ids by name or by their values; areas, prices and counts stay what they are", () => {
    assert.deepStrictEqual(["Parcel", "Zip", "Year built", "Living area sqft", "Beds", "Sale price", "Sales (#)"].map(n => roleOf(aSR, n)), ["identifier", "postal", "year", "measure", "measure", "money", "measure"]);
    const yrs = Array.from({ length: 40 }, (_, i) => 1950 + (i * 7) % 70);
    assert.strictEqual(solo("built", yrs), "year"); assert.strictEqual(solo("col", yrs), "year", "years found by their values alone");
    assert.strictEqual(solo("yr_founded", yrs), "year"); assert.strictEqual(solo("fiscal year", yrs), "year");
    assert.strictEqual(solo("phone", Array.from({ length: 20 }, (_, i) => 3055550100 + i * 13)), "phone");
    assert.strictEqual(solo("contact", Array.from({ length: 20 }, (_, i) => `(305) 555-${String(1000 + i * 7)}`)), "phone", "phone numbers written with separators are not numbers at all, but are not a measure either");
    assert.strictEqual(solo("sku", Array.from({ length: 30 }, (_, i) => 40000 + i * 3)), "identifier");
    assert.strictEqual(solo("order number", Array.from({ length: 30 }, (_, i) => 90100 + i)), "identifier");
    assert.strictEqual(solo("ticket", Array.from({ length: 30 }, (_, i) => 5000 + i * 2 + (i % 2))), "identifier", "an all-different, ever-increasing whole number is a row number");
    assert.strictEqual(solo("living area", Array.from({ length: 40 }, (_, i) => 1800 + (i * 37) % 301)), "measure", "an area that happens to sit between 1800 and 2100 is still an area");
    assert.strictEqual(solo("quantity", Array.from({ length: 40 }, (_, i) => 1900 + (i * 11) % 150)), "measure");
    assert.strictEqual(solo("sale_price", Array.from({ length: 40 }, (_, i) => 100000 + i * 5000)), "money", "a price that rises by a constant is still a price");
  });
  test("units: the only ratio on the sales fixture is money over area, named 'price per square foot'; never per year, per zip, per id", () => {
    const pairs = Dom.ratioPairs(aSR.cols); assert.deepStrictEqual(pairs.map(p => p.label), ["price per square foot"]);
    const c = Dom.ratioCandidates(aSR.cols); assert.deepStrictEqual(c.held.map(x => x.col).sort(), ["Beds", "Parcel", "Sales (#)", "Year built", "Zip"]);
    assert(c.held.find(x => x.col === "Year built").reason.includes("year, not a quantity"), JSON.stringify(c.held));
    assert(c.held.find(x => x.col === "Beds").reason.includes("no unit"), JSON.stringify(c.held));
  });
  test("sales fixture: no insight, finding, flag or worth-a-look line mentions price per year built, per zip or per parcel", () => {
    const t = everyText(aSR, SR).join("\n"); assert(!/per (year|zip|parcel)/i.test(t), t.match(/.{40}per (year|zip|parcel).{20}/i));
    assert(!/year built.{0,12}(highest|lowest|unusual)|(highest|lowest|unusual).{0,30}year built/i.test(t));
    assert(aSR.findingsAll.some(f => f.id === "extremes" && /price per square foot/.test(f.title)), aSR.findingsAll.map(f => f.id));
    assert.strictEqual(aSR.measure.name, "Sale price", "the measure is the price, not the year or the zip");
  });
  test("a year or an id is never a measure, an extreme or a metric, even with no help from the name", () => {
    const rows = [["a", "c", "d"]]; for (let i = 0; i < 200; i++) rows.push([String(1900 + (i * 13) % 120), String(700000 + i * 3), String(Math.round(300000 + ((i * 7919) % 1000) * 400))]);
    const a = R.analyse({ name: "t", rows }); assert.deepStrictEqual(a.cols.map(c => c.role), ["year", "identifier", "measure"]);
    assert.strictEqual(a.measure.name, "d", "measure is " + (a.measure && a.measure.name));
  });
  test("a person can change a role in the Columns table and the report recomputes", () => {
    const b = R.analyse(SR, { roles: { "Year built": "measure", Beds: "identifier", Zip: "category" } });
    assert.strictEqual(roleOf(b, "Year built"), "measure"); assert.strictEqual(roleOf(b, "Beds"), "identifier"); assert.strictEqual(roleOf(b, "Zip"), "category");
    assert.strictEqual(b.cols.find(c => c.name === "Zip").type, "category"); assert.strictEqual(b.cols.find(c => c.name === "Zip").roleBy, "you");
    const c = R.analyse(SR, { roles: { "Living area sqft": "year" } }); assert.strictEqual(roleOf(c, "Living area sqft"), "year");
    assert.deepStrictEqual(Dom.ratioPairs(c.cols), [], "no area, no ratio");
    assert(!c.findingsAll.some(f => f.id === "extremes"), "the top and bottom by area goes away with the area");
    const d = R.analyse(SR, { roles: { "Year built": "auto" } }); assert.strictEqual(roleOf(d, "Year built"), "year");
  });

  // ---------- CONS-0074
  console.log("the insight gate (CONS-0074)");
  const Rules = require("../src/rules.js"), cand = (id, why, title = "A candidate", detail = "") => ({ id, kind: "insight", title, detail, why });
  const gateOf = (c) => { const g = Dom.gate([c], { looksLikeValue: n => Shape.looksLikeValue(n, T) }); return { ok: g.shown.length === 1, reason: g.held[0] && g.held[0].reason, check: g.held[0] && g.held[0].check }; };
  const ratioWhy = (o) => ({ method: "ratio", numeratorRole: "money", denominatorRole: "measure", units: "square foot", n: 100, names: ["Sale price", "Living area sqft"], valueKind: "money", aggregate: "ratio", ...o });
  test("the gate's checks are data: every check in rules.js has a rule sentence and a function, and the minimums are numbers", () => {
    assert(Rules.GATE.checks.length >= 6); Rules.GATE.checks.forEach(c => { assert(c.id && c.label && c.rule.length > 20, c.id); assert.strictEqual(typeof Dom.GATE_FN[c.id], "function", "no function for " + c.id); });
    assert.deepStrictEqual(Rules.GATE.minimums, { extremes: 30, share: 3, concentration: 5, months: 3 });
  });
  test("gate: a ratio needs money over a measure with a unit (fails and passes)", () => {
    assert.strictEqual(gateOf(cand("extremes", ratioWhy())).ok, true);
    const noUnit = gateOf(cand("extremes", ratioWhy({ units: null }))); assert.strictEqual(noUnit.ok, false); assert.strictEqual(noUnit.check, "ratio-unit");
    const perYear = gateOf(cand("extremes", ratioWhy({ denominatorRole: "year" }))); assert.strictEqual(perYear.ok, false); assert.strictEqual(perYear.check, "ratio-unit");
    assert.strictEqual(gateOf(cand("extremes", ratioWhy({ numeratorRole: "measure" }))).ok, false);
  });
  test("gate: top and bottom needs 30 non-nominal rows; a share needs 3 groups; concentration needs 5 (each fails below and passes at the minimum)", () => {
    assert.strictEqual(gateOf(cand("extremes", ratioWhy({ n: 29 }))).ok, false); assert(/at least 30/.test(gateOf(cand("extremes", ratioWhy({ n: 29 }))).reason)); assert.strictEqual(gateOf(cand("extremes", ratioWhy({ n: 30 }))).ok, true);
    assert.strictEqual(gateOf(cand("share", { kind: "share", groups: 2, n: 50, names: ["Region"], valueKind: "measure", aggregate: "sum" })).ok, false);
    assert.strictEqual(gateOf(cand("share", { kind: "share", groups: 3, n: 50, names: ["Region"], valueKind: "measure", aggregate: "sum" })).ok, true);
    assert.strictEqual(gateOf(cand("concentration", { kind: "concentration", groups: 4, n: 50, names: ["City"], valueKind: "count", aggregate: "count" })).ok, false);
    assert.strictEqual(gateOf(cand("concentration", { kind: "concentration", groups: 5, n: 50, names: ["City"], valueKind: "count", aggregate: "count" })).ok, true);
  });
  test("gate: labels. 'Total <column>' only for a sum; a count never carries a money sign; a finding never names a column that looks like a value", () => {
    const base = { kind: "share", groups: 5, n: 50, names: ["Orders (#)"], valueKind: "count", aggregate: "count" };
    assert.strictEqual(gateOf(cand("share", base, "Retail is 52% of total Orders (#)")).ok, false); assert.strictEqual(gateOf(cand("share", base, "Retail is 52% of rows")).ok, true);
    assert.strictEqual(gateOf(cand("share", base, "Retail is 52% of rows", "$1,200 of 40 orders")).ok, false);
    assert.strictEqual(gateOf(cand("share", { ...base, aggregate: "sum", valueKind: "measure" }, "Retail is 52% of total Orders (#)")).ok, true);
    assert.strictEqual(gateOf(cand("share", { ...base, names: ["11/19/2018"] })).ok, false); assert.strictEqual(gateOf(cand("share", { ...base, names: ["Region"] })).ok, true);
  });
  test("the sales fixture: the header tile reads Rows 1,200 and no Total Sales (#); no insight per year built; every shown insight carries its justification", () => {
    assert.strictEqual(aSR.kpi.find(k => k[0] === "Rows")[1], "1,200"); assert(!aSR.kpi.some(k => /sales \(#\)/i.test(k[0])), JSON.stringify(aSR.kpi));
    assert.strictEqual(aSR.kpi[3][0], "Total Sale price"); assert(/^\$/.test(aSR.kpi[3][1]), "money carries its sign: " + aSR.kpi[3][1]);
    const ins = aSR.findingsList.filter(f => f.kind === "insight"); assert(ins.length >= 2);
    ins.forEach(f => { assert(f.why && f.why.method && "n" in f.why && Array.isArray(f.why.names), "no justification on " + f.title); });
    const ex = ins.find(f => f.id === "extremes"); assert.strictEqual(ex.why.units, "square foot"); assert.deepStrictEqual(ex.why.names, ["Sale price", "Living area sqft"]); assert.strictEqual(ex.why.n, 1200);
  });
  test("Not shown: what was held back and why (a ratio per year built, a top-and-bottom with too few rows, a share with two groups)", () => {
    const held = aSR.notShown.map(h => h.title + " | " + h.reason).join("\n");
    assert(/price per year built/i.test(held) && /Year built is a year, not a quantity/.test(held), held); assert(/price per zip/i.test(held) && /price per sales \(#\)/i.test(held), held);
    const rows = [["id", "price", "area sqft", "region"]]; for (let i = 0; i < 20; i++) rows.push(["r" + i, String(200000 + i * 1000), String(1000 + i * 10), i % 2 ? "East" : "West"]);
    const small = R.analyse({ name: "t", rows }); assert(!small.findingsList.some(f => f.id === "extremes"));
    const x = small.notShown.find(h => h.id === "extremes"); assert(x && x.check === "min-rows" && /at least 30 non-nominal rows/.test(x.reason) && /has 20/.test(x.reason), JSON.stringify(small.notShown));
    assert([...small.flags.values()].every(f => f.id !== "extremes"), "a held insight leaves no flags in the table");
  });

  // ---------- CONS-0072
  console.log("ledgers: signs are direction (CONS-0072)");
  const money = x => Math.round(x * 100) / 100, fileRows = LD.rows.slice(1), sumOf = f => money(fileRows.map(r => parseFloat(r[3])).filter(f).reduce((a, b) => a + Math.abs(b), 0));
  const byId = (a, id) => a.findingsList.find(f => f.id === id);
  test("ledger detection: a date, a signed money column and a description make kind 'transactions', with or without a header; nothing else in the fixtures does", () => {
    [aNone, aHead, aTitle].forEach(a => { assert.strictEqual(a.kind, "transactions"); assert.strictEqual(a.cols.find(c => c.role === "amount").name, a.header[3]); assert.strictEqual(a.cols.find(c => c.role === "balance").name, "Balance"); });
    assert.deepStrictEqual(aNone.ledger.cols, { date: "Date", amount: "Amount", description: "Description", type: "Type", balance: "Balance" });
    assert.deepStrictEqual(aHead.ledger.cols, { date: "Posting Date", amount: "Amount", description: "Description", type: "Details", balance: "Balance" });
    for (const [n, d] of [["sales_planted", load("sales_planted.csv")], ["venues", load("venues.csv")], ["county", load("sales_county.csv")], ["cafe", { name: "c", rows: R.cafeSample() }], ["sales_roles", SR], ["mixed", load("records_mixed.csv")]]) assert.strictEqual(R.analyse(d).kind, "records", n);
  });
  test("the header says transactions; the tiles are Rows, Dates, Money out, Money in; the balance is never summed", () => {
    assert.deepStrictEqual(aHead.kpi.map(k => k[0]), ["Rows", "Dates", "Money out", "Money in"]); assert.strictEqual(aHead.measure, null); assert.strictEqual(aHead.measureName, "Outflow");
    assert.strictEqual(aHead.kpi[2][1], "$" + Math.round(sumOf(x => x < 0)).toLocaleString("en-US"));
    assert(!aHead.cols.some(c => c.role === "measure" || c.role === "money"), "no money or measure column is left to sum: " + aHead.cols.map(c => c.role));
  });
  test("signs are direction: outflow and inflow are added up separately and match the file to the cent; headerless, headed and title-row files agree", () => {
    for (const a of [aNone, aHead, aTitle]) { assert.strictEqual(money(a.ledger.outflow), sumOf(x => x < 0)); assert.strictEqual(money(a.ledger.inflow), sumOf(x => x > 0)); assert.strictEqual(money(a.ledger.net), money(sumOf(x => x > 0) - sumOf(x => x < 0))); }
    assert.strictEqual(byId(aHead, "ledger-flow").kind, "insight"); assert(/Money out \$[\d,]+, money in \$[\d,]+: net [+-]\$[\d,]+/.test(byId(aHead, "ledger-flow").title), byId(aHead, "ledger-flow").title);
    const un = LD.rows.slice(1).map(r => [r[0], r[1], r[2], String(Math.abs(parseFloat(r[3]))), r[4], r[5], r[6], r[7]]), u = R.analyse({ name: "u", rows: [LD.rows[0], ...un] });
    assert.strictEqual(u.kind, "transactions"); assert.strictEqual(u.ledger.signedBy, "type"); assert.strictEqual(money(u.ledger.outflow), sumOf(x => x < 0), "unsigned amounts: the DEBIT and CREDIT column gives the direction");
  });
  test("the sales rules do not run on a ledger: no nominal, repeated-value, missing-digit, price or negative-value finding; 'newest date is N months old' is an FYI, not a defect", () => {
    [aNone, aHead, aTitle].forEach(a => { const ids = a.findingsAll.map(f => f.id); assert(!ids.some(i => /^(nominal|neg|stale|rv:|unit:|out:|ratio:|shift:|tlgaps|extremes|repeat)/.test(i)), ids.join()); assert.strictEqual(outFlags(a).length, 0); });
    const f = byId(aHead, "ledger-ends"); assert(f && f.kind === "fyi" && /ends on Nov 19, 2018/.test(f.title), f && f.title); assert(!aHead.findingsList.some(x => /months old/.test(x.title)));
    assert(aHead.notChecked.off.map(x => x.id).includes("nominal") && aHead.notChecked.off.length >= 5, JSON.stringify(aHead.notChecked.off)); assert(!aHead.notChecked.missing.some(m => m.id === "nominal" || m.id === "ratio"));
    assert.strictEqual(aHead.checks.some(c => /nominal|extreme/i.test(c.title)), false);
  });
  test("insights: money out by month, top merchants, the largest single items; each carries its justification", () => {
    const m = byId(aHead, "ledger-months"); assert(m && m.kind === "insight" && /Money out runs from \$[\d,]+ \((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) 2018\) to \$[\d,]+/.test(m.title), m && m.title); assert(m.why.kind === "months" && m.why.n >= 3);
    const t = byId(aHead, "ledger-merchants"); assert(t && /is the biggest merchant: \$[\d,]+, \d+% of money out/.test(t.title), t && t.title); assert(t.detail.split(";").length <= 10, "at most ten merchants");
    const big = byId(aHead, "ledger-largest"); assert(/largest single item is \$1,862\.94 at Best Buy/.test(big.title), big.title); assert.deepStrictEqual(big.rows.includes(LG.big_purchase[0]), true);
    aHead.findingsList.filter(f => f.kind === "insight").forEach(f => assert(f.why && f.why.method, f.id));
    assert.strictEqual(aHead.breakdown.col, "merchant"); assert.strictEqual(aHead.breakdown.noPick, true); assert(aHead.breakdown.items.length <= 8);
    assert(aHead.trend && aHead.trend.series.length >= 10, "the timeline is money out by month");
  });
  test("recurring charges: same merchant, same amount, regular interval, with the next expected date; the repeated amount is an insight, not a defect", () => {
    const r = aHead.ledger.recurring; assert.deepStrictEqual(r.map(x => x.amount).sort(), [10.99, 15.49]);
    const nf = r.find(x => x.amount === 15.49), sp = r.find(x => x.amount === 10.99); assert(nf.monthly && sp.monthly && nf.n >= 9 && sp.n >= 10, JSON.stringify(r.map(x => [x.name, x.n])));
    assert.strictEqual(new Date(nf.next).toISOString().slice(0, 10), "2018-11-19", "the last Netflix charge is Oct 19, so the next is Nov 19"); assert.strictEqual(new Date(sp.next).toISOString().slice(0, 10), "2018-12-03");
    const f = byId(aHead, "ledger-recurring"); assert(/^2 recurring charges, about \$\d+ a month$/.test(f.title), f.title); assert(/next expected Nov 19, 2018/.test(f.detail) && /next expected Dec 3, 2018/.test(f.detail), f.detail);
    assert.strictEqual(aHead.findingsAll.filter(x => x.id.startsWith("rv:")).length, 0, "22 payroll deposits of 2,150.00 are not a repeated-value defect");
  });
  test("duplicates vs refunds: the same charge entered twice is the one duplicate; a refund the same day is opposite in sign and is not", () => {
    const d = byId(aHead, "dup"); assert(d && d.kind === "qa" && d.n === 2 && /^1 duplicate row$/.test(d.title), d && d.title); assert.deepStrictEqual(d.rows, LG.duplicate_rows);
    LG.refund_pair.forEach(r => assert(!d.rows.includes(r), "a refund row is in the duplicates"));
    const f = byId(aHead, "ledger-refunds"); assert(f && f.kind === "fyi" && f.rows.join() === LG.refund_pair.join() && /not a duplicate/.test(f.detail), f && f.detail);
    assert.strictEqual(R.analyse(LH).findingsAll.find(x => x.id === "dup").rows.join(), LG.duplicate_rows.join());
  });
  test("the running balance: the clean file holds; a mistyped balance is one finding at that row; a missing transaction is a jump; the same either way round", () => {
    assert.strictEqual(aHead.ledger.balanceBreaks, 0); assert(!byId(aHead, "ledger-balance")); assert(aHead.checks.some(c => /running balance holds/i.test(c.title) && c.sev === "ok"));
    const rows = LD.rows.map(r => r.slice()); rows[11][5] = "9999.99";   // body row 10 (file row 12)
    const typo = R.analyse({ name: "t", rows }), f = byId(typo, "ledger-balance"); assert(f && f.n === 1 && f.rows[0] === 10 && f.kind === "qa" && f.cls === "source-conflict", f && JSON.stringify([f.n, f.rows]));
    assert(/mistyped/.test(typo.flags.get("10:5").why) && /expected \$[\d,.]+, found \$9,999\.99/.test(f.detail), f.detail);
    const gone = LD.rows.filter((_, i) => i !== 30), jump = R.analyse({ name: "t", rows: gone }), g = byId(jump, "ledger-balance"); assert(g && g.n === 1, g && g.detail); assert(/A transaction may be missing/.test(jump.flags.get(g.rows[0] + ":5").why));
    const asc = [LD.rows[0], ...LD.rows.slice(1).reverse()], up = R.analyse({ name: "t", rows: asc }); assert.strictEqual(up.ledger.balanceBreaks, 0); assert.strictEqual(up.ledger.order, "asc"); assert.strictEqual(aHead.ledger.order, "desc");
    const asc2 = asc.map(r => r.slice()); asc2[40][5] = "1.00"; assert.strictEqual(byId(R.analyse({ name: "t", rows: asc2 }), "ledger-balance").n, 1);
  });
  test("gaps in the dates longer than the usual are a QA finding; the clean file has none", () => {
    assert.strictEqual(aHead.ledger.gaps.length, 0); assert(!byId(aHead, "ledger-gaps"));
    const keep = LD.rows.filter((r, i) => i === 0 || !/^(0[3-5])\//.test(r[1])), gappy = R.analyse({ name: "t", rows: keep }), f = byId(gappy, "ledger-gaps");
    assert(f && f.kind === "qa" && /gap/.test(f.title) && /Longest: \d+ days/.test(f.detail), f && f.title); assert(f.n >= 1);
  });
  test("the weekday pattern needs eight weeks and 60 outflow rows; a pattern that does not stand out is listed under Not shown", () => {
    const w = byId(aHead, "ledger-weekday"), held = aHead.notShown.find(x => x.id === "ledger-weekday");
    assert(w || held, "either shown or held back with a reason"); if (held) assert(/stands out/.test(held.reason), held.reason);
    const short = R.analyse({ name: "t", rows: [LD.rows[0], ...LD.rows.slice(1, 30)] }), x = short.notShown.find(h => h.id === "ledger-weekday" || h.id === "ledger-months"); assert(x && /needs at least/.test(x.reason), JSON.stringify(short.notShown.map(h => h.reason)));
  });
  test("a ledger's worth-a-look list and flags use the file's own row numbers and never include an FYI", () => {
    const w = R.pickNotable(aNone, R.makeStore(LH, aNone)); assert(w.length >= 3 && w.length <= 10, w.length); assert(w.every(x => x.kind !== "fyi"));
    assert.strictEqual(aNone.findingsAll.find(f => f.id === "dup").rows.map(r => r + aNone.rowBase).join(), LG.duplicate_rows.map(r => r + 1).join());
  });

  // ---------- CONS-0073
  console.log("names behind descriptions: one merchant, one name (CONS-0073)");
  const norm = Shape.makeNormalizer([]), nameOf = raw => norm(raw).name;
  test("normalization cases: store numbers, cities, states, zips, processor prefixes, reference codes, aliases; digits alone and a leading number stay", () => {
    const cases = [["KROGER 710 COLUMBUS IN 50910", "Kroger"], ["Kroger #710", "Kroger"], ["KROGER", "Kroger"], ["NETFLIX.COM", "Netflix.com"], ["SHELL OIL 574446 CHICAGO IL", "Shell Oil"], ["BEST BUY 000123 COLUMBUS IN", "Best Buy"],
      ["SQ *BLUE BOTTLE COFFEE SAN FRANCISCO CA", "Blue Bottle Coffee"], ["SQ *BLUE BOTTLE COFFEE", "Blue Bottle Coffee"], ["TST* TACO PLACE 0042 COLUMBUS IN", "Taco Place"], ["PAYPAL *EBAY", "Ebay"],
      ["VENMO*PAYMENT", "Venmo"], ["VENMO* JORDAN", "Venmo"], ["AMZN Mktp US*1A2B3", "Amazon"], ["AMAZON.COM*2K4TT1 SEATTLE WA", "Amazon"], ["WAL-MART #1234", "Walmart"],
      ["7-ELEVEN 23456", "7-Eleven"], ["Studio 54 Bar", "Studio 54 Bar"], ["12345", "12345"]];
    cases.forEach(([raw, want]) => assert.strictEqual(nameOf(raw), want, raw));
    assert.strictEqual(norm("NETFLIX.COM").key, norm("Netflix.com").key); assert.notStrictEqual(norm("KROGER").key, norm("SHELL OIL").key);
  });
  test("the rules are one data file: prefixes, suffixes, store-number patterns, places and aliases are in rules.js and no merchant is named anywhere else in the code", () => {
    const N = require("../src/rules.js").NORMALIZE; ["aliases", "prefixes", "referenceCode", "zip", "states", "storeNumber", "places", "columns", "learn"].forEach(k => assert(N[k] !== undefined, "rules.js NORMALIZE." + k));
    const dir = path.join(FX, "..", "..", "src"); fs.readdirSync(dir).filter(f => /\.js$/.test(f) && f !== "rules.js").forEach(f => { const t = fs.readFileSync(path.join(dir, f), "utf8"); assert(!/kroger|netflix|venmo|walmart|wal-mart|amazon|starbucks/i.test(t), f + " names a merchant: " + (t.match(/.{20}(kroger|netflix|venmo|walmart|wal-mart|amazon|starbucks).{20}/i) || [""])[0]); });
  });
  test("a place that follows a state on several rows with different names is learned from the file", () => {
    const vals = ["TRADER JOES CORAL GABLES FL", "PUBLIX CORAL GABLES FL", "CVS CORAL GABLES FL", "TRADER JOES CORAL GABLES FL"], n = Shape.makeNormalizer(vals);
    assert.strictEqual(n("TRADER JOES CORAL GABLES FL").name, "Trader Joes"); assert.strictEqual(Shape.makeNormalizer([])("TRADER JOES CORAL GABLES FL").name, "Trader Joes Coral Gables");
  });
  test("grouping uses the canonical name: the ledger's top merchants show Kroger once with its variants under it, and Netflix, Amazon, Venmo and Walmart once each", () => {
    const m = aHead.ledger.merchants, names = m.map(x => x.name); assert.strictEqual(new Set(names).size, names.length, names.join());
    const k = m.find(x => x.name === "Kroger"); assert(k && k.variants.length >= 4 && k.n >= 40, JSON.stringify(k && [k.n, k.variants.length]));
    assert(k.variants.some(v => v[0] === "KROGER 4005 COLUMBUS IN 50910") || k.variants.some(v => /^KROGER \d+ COLUMBUS IN 50910$/.test(v[0])), "a raw variant is listed under the name"); assert(k.variants.some(v => /^Kroger #\d+$/.test(v[0])));
    ["Netflix.com", "Amazon", "Venmo", "Walmart", "Blue Bottle Coffee", "Taco Place"].forEach(n => assert(names.includes(n), n + " in " + names.join()));
    const t = byId(aHead, "ledger-merchants"); assert.strictEqual((t.detail.match(/Kroger/g) || []).length, 1, t.detail); assert(/^Kroger is the biggest merchant/.test(t.title), t.title);
    assert.strictEqual(aHead.ledger.merchants[0].name, "Kroger"); assert(aHead.breakdown.items.some(i => i[0] === "Kroger"));
  });
  test("'spelled more than one way' is an FYI with a Merge, not a defect: no Fix, no class count, no QA check, for the ledger's merchants including Netflix.com and NETFLIX.COM", () => {
    const v = byId(aHead, "variant"); assert(v && v.kind === "fyi" && !v.hard && /written more than one way/.test(v.title), v && v.title);
    assert(v.merge && v.merge.n >= 20 && v.merge.col === "Description" && v.merge.map.some(p => p[0] === "NETFLIX.COM" && p[1] === "Netflix.com"), JSON.stringify(v.merge && v.merge.map.slice(0, 3)));
    assert(!aHead.classCounts.some(c => c.cls === "source-conflict"), JSON.stringify(aHead.classCounts)); assert(!aHead.checks.some(c => c.sev !== "ok" && /spelled|spelling/i.test(c.title)));
    assert(!R.sections(aHead, []).qa.findings.some(f => f.id === "variant")); assert(R.sections(aHead, []).fyi.findings.some(f => f.id === "variant"));
    assert(!R.pickNotable(aHead, R.makeStore(LD, aHead)).some(w => w.id === "variant"), "an FYI is not a record to read");
  });
  test("Merge writes the canonical name in the table as edits (logged, undoable) and the report is clean afterwards", () => {
    const s = R.makeStore(LD, aHead), v = byId(aHead, "variant"), ci = v.merge.ci, n = Rec.mergeCells(s, ci, v.merge.map);
    assert(n >= 20 && s.edits.length === n, n + " vs " + s.edits.length);
    assert(s.rows.every(r => !/^NETFLIX\.COM$/.test(r[ci]))); assert(s.rows.some(r => r[ci] === "Netflix.com") && s.rows.some(r => r[ci] === "Kroger"));
    const again = R.analyse({ name: "m", rows: [LD.rows[0], ...s.rows] }); assert(!again.findingsAll.some(f => f.id === "variant"), "no variants left: " + (byId(again, "variant") || {}).title);
    assert.strictEqual(money(again.ledger.outflow), money(aHead.ledger.outflow), "the totals do not move"); assert.strictEqual(again.ledger.merchants.length > 0, true);
    const log = R.parseDelimited(Rec.changeLogCSV(s)); assert.strictEqual(log.length, n + 1); Rec.undoEdit(s); assert.strictEqual(s.edits.length, n - 1);
  });
  test("QA only when the variants change a group's rank in the top ten: Boston and 'boston ' do; a one-row stray 'eugene ' does not", () => {
    const city = (spec) => { const rows = [["id", "city"]]; let i = 0; spec.forEach(([v, k]) => { for (let j = 0; j < k; j++) rows.push(["r" + i++, v]); }); return R.analyse({ name: "c", rows }); };
    const moves = city([["Austin", 30], ["Boston", 25], ["boston ", 10], ["Denver", 20], ["Eugene", 15]]), v1 = byId(moves, "variant");
    assert(v1 && v1.kind === "qa" && v1.cls === "source-conflict" && /spelled more than one way/.test(v1.title), v1 && v1.kind);
    const stays = city([["Austin", 30], ["Boston", 25], ["Denver", 20], ["Eugene", 15], ["eugene ", 1]]), v2 = byId(stays, "variant");
    assert(v2 && v2.kind === "fyi" && v2.merge && v2.merge.n === 1 && !/Fix|Check/.test(v2.cls || ""), v2 && v2.kind);
    assert(R.analyse({ name: "c", rows: R.cafeSample() }).findingsList.find(f => f.id === "variant").kind === "fyi", "the café's 'Coral gables' does not change a rank");
  });
  test("a description-like column outside a ledger is compared by the name behind it too (vendor): store numbers and cities are one vendor, an FYI", () => {
    const rows = [["id", "vendor", "amount"]]; ["STAPLES 0123 MIAMI FL 33101", "Staples #55", "staples", "OFFICE DEPOT 4411 DORAL FL", "OFFICE DEPOT 4412 DORAL FL", "Office Depot"].forEach((v, i) => { for (let k = 0; k < 8; k++) rows.push(["r" + i + "_" + k, v, String(10 + k)]); });
    const a = R.analyse({ name: "v", rows }), f = byId(a, "variant"); assert(f && f.kind === "fyi" && /Staples/.test(f.detail) && /Office Depot/.test(f.detail), f && f.detail);
  });
};
