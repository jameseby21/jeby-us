/* Free report tests, part 3: round 3 (CONS-0071 headers, CONS-0070 roles, CONS-0074 the insight gate, CONS-0072 ledgers, CONS-0073 names).
   Loaded by run.js with its helpers. Synthetic fixtures only (made by make_fixtures.py): no real rows are in this repository. */
"use strict";
module.exports = function (h) {
  const { test, assert, R, Rec, Dom, load, truth, plain, read } = h;
  const Shape = require("../src/shape.js"), T = { num: R.num, dt: R.dt, profileCol: R.profileCol };
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
};

