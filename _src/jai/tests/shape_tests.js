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
};
