/* Free report tests: plain Node, no dependencies.   node _src/jai/tests/run.js
   Loads the pure logic from report.js and records.js (no DOM) and checks it against synthetic fixtures.
   Browser checks live in browser.js and say "not run" when no Edge or Chrome is found. */
"use strict";
const fs = require("fs"), path = require("path"), assert = require("assert");
const R = require("../src/report.js"), Rec = require("../src/records.js");
const FX = path.join(__dirname, "fixtures");
const read = n => fs.readFileSync(path.join(FX, n), "utf8");
const truth = n => JSON.parse(read(n));
const load = (n, name = n) => ({ name, rows: R.parseDelimited(read(n)) });

let passed = 0, failed = 0; const failures = [];
function test(name, fn) {
  const t0 = process.hrtime.bigint();
  try { fn(); passed++; console.log(`  ok   ${name} (${Number(process.hrtime.bigint() - t0) / 1e6 | 0} ms)`); }
  catch (e) { failed++; failures.push(name); console.log(`  FAIL ${name}\n       ${String(e.message).split("\n").join("\n       ")}`); }
}
const outFlags = a => [...a.flags.entries()].filter(([, f]) => f.fam === "out");
const outRows = a => new Set(outFlags(a).map(([k]) => +k.split(":")[0]));
const plain = s => s.replace(/<\/?b>/g, "");

R.setLimits(10000, 12);

// ---------- CONS-0048: outliers
console.log("outliers (CONS-0048)");
const planted = load("sales_planted.csv"), PT = truth("sales_planted.truth.json");
const aP = R.analyse(planted);
test("planted fixture: every planted record is flagged", () => {
  const got = outRows(aP);
  for (const [kind, rows] of Object.entries(PT)) rows.forEach(r => assert(got.has(r), `${kind}: row index ${r} not flagged`));
});
test("planted fixture: at most 2 percent false flags on the clean rows", () => {
  const planted_ = new Set(Object.values(PT).flat()), clean = aP.N - planted_.size;
  const falseRows = [...outRows(aP)].filter(r => !planted_.has(r));
  assert(falseRows.length / clean <= 0.02, `${falseRows.length} of ${clean} clean rows flagged (${(100 * falseRows.length / clean).toFixed(2)}%)`);
});
test("planted fixture: the city is named as a group with its record count", () => {
  const f = aP.findingsAll.find(x => x.id.startsWith("shift:") && /Sunny Isles Beach/.test(x.id));
  assert(f, "no group finding for Sunny Isles Beach: " + aP.findingsAll.map(x => x.id));
  assert.strictEqual(f.n, PT.city_unit_error.length);
  assert(/Sunny Isles Beach/.test(f.title) && /\d+x/.test(f.detail + f.title), "title or detail should name the city and the multiple: " + f.title + " / " + f.detail);
  assert(/unit error|extra zero/i.test(f.detail), "detail should name the likely cause: " + f.detail);
});
test("planted fixture: x100 and x1000 rows are unit findings with plain reasons", () => {
  const f = aP.findingsAll.find(x => x.id === "unit:sale_price");
  assert(f, "no unit finding on sale_price: " + aP.findingsAll.map(x => x.id));
  assert.strictEqual(f.rows.filter(r => PT.x100.includes(r) || PT.x1000.includes(r)).length, 4);
  const why = plain(aP.flags.get(`${PT.x100[0]}:1`).why);
  assert(/is (1\d\d)x/.test(why) && /cents/.test(why) && /\$/.test(why), why);
});
test("planted fixture: area typos are found through price per square foot", () => {
  PT.area_typo.forEach(r => assert([...aP.flags.entries()].some(([k, f]) => k.startsWith(r + ":") && f.fam === "out"), "area typo row not flagged"));
  assert(aP.findingsAll.some(x => /per sq/.test(x.title + x.detail)), "no per-ratio finding: " + aP.findingsAll.map(x => x.title).join(" | "));
});
test("planted fixture: future and ancient dates are named", () => {
  const f = aP.findingsAll.find(x => x.id === "date"); assert(f && f.n === 3, f && f.n);
  assert(/years after/.test(aP.flags.get(`${PT.future_date[0]}:2`).why));
  assert(/before/.test(aP.flags.get(`${PT.ancient_date[0]}:2`).why));
});
test("clean fixture: no extreme values", () => {
  const a = R.analyse(load("sales_clean.csv"));
  assert.strictEqual(outFlags(a).length, 0, "flags: " + outFlags(a).slice(0, 3).map(([k, f]) => k + " " + f.why).join(" | "));
  assert(a.checks.some(c => c.title === "No extreme values" && c.sev === "ok"));
});
test("cafe sample: the twelve $115.00 prices are found by comparing each item with itself; catering trays are not", () => {
  const a = R.analyse({ name: "cafe", rows: R.cafeSample() });
  const priceCol = a.header.indexOf("unit_price");
  const hits = outFlags(a).filter(([k]) => +k.split(":")[1] === priceCol);
  assert.strictEqual(hits.length, 12, "price hits: " + hits.length);
  assert(/\$115\.00 is 10x this item's usual \$11\.50\./.test(plain(hits[0][1].why)), hits[0][1].why);
  const totalCol = a.header.indexOf("total"), falseTotals = outFlags(a).filter(([k]) => +k.split(":")[1] === totalCol).length;
  assert(falseTotals <= a.N * 0.02, "total column flags: " + falseTotals);
});
test("venues fixture: latitude, longitude and postal codes are not tested as outliers", () => {
  assert.strictEqual(outFlags(R.analyse(load("venues.csv"))).length, 0);
});

// ---------- finding-to-rows
console.log("findings to rows (CONS-0049)");
const venues = load("venues.csv"), VT = truth("venues.truth.json"), aV = R.analyse(venues);
test("venues: the spelling finding maps to the CVS rows", () => {
  const f = aV.findingsAll.find(x => x.id === "variant");
  assert(f, "no spelling finding: " + aV.findingsAll.map(x => x.id));
  assert(f.rows.length >= 2 && f.rows.every(r => VT.cvs_all.includes(r)), f.rows.join());
  assert(f.rows.includes(VT.cvs_spacing[0]) && f.rows.includes(VT.cvs_short[0]), "both spellings expected: " + f.rows);
});
test("venues: mixed id types are reported", () => {
  assert(aV.findingsAll.some(x => x.id === "mixedid" && /vip_id/.test(x.title)), "no vip_id finding: " + aV.findingsAll.map(x => x.id));
});
test("cafe sample: every finding has rows and every row exists", () => {
  const a = R.analyse({ name: "cafe", rows: R.cafeSample() });
  a.findingsAll.forEach(f => { assert(f.rows.length === f.n && f.n > 0, f.id); assert(f.rows.every(r => r >= 0 && r < a.N), f.id); });
  ["unit:unit_price", "date", "sum", "dup", "neg", "variant", "gaps"].forEach(id => assert(a.findingsAll.some(f => f.id === id), "missing finding " + id + " in " + a.findingsAll.map(f => f.id)));
});

// ---------- CONS-0049: table model on 10,000 rows
console.log("table model (CONS-0049)");
const big = { name: "big.csv", rows: R.cafeSample(10000) };
test("10,000 rows: parse and analyse inside 3 seconds (Node; the browser run is in browser.js)", () => {
  const text = Rec.rowsToCSV(big.rows, { delim: ",", eol: "\n" });
  const t0 = Date.now(); const d = { name: "big.csv", rows: R.parseDelimited(text) }; const a = R.analyse(d); const ms = Date.now() - t0;
  assert.strictEqual(a.N, 10000); assert(ms < 3000, ms + " ms");
});
const aB = R.analyse(big), storeB = R.makeStore(big, aB);
test("view: sort ascending, descending, off", () => {
  const ci = aB.header.indexOf("total");
  const asc = Rec.computeView(storeB, { sortCol: ci, sortDir: 1 }), desc = Rec.computeView(storeB, { sortCol: ci, sortDir: -1 }), off = Rec.computeView(storeB, {});
  const v = i => R.num(storeB.rows[i][ci]);
  for (let i = 1; i < asc.length; i++) assert(v(asc[i - 1]) <= v(asc[i]));
  assert.strictEqual(v(desc[0]), v(asc[asc.length - 1]));
  assert.strictEqual(off.length, 10000); assert.strictEqual(off[0], 0); assert.strictEqual(off[9999], 9999);
});
test("view: text sort, row sort, search over every column, finding filter, all combined", () => {
  const loc = aB.header.indexOf("location");
  const s = Rec.computeView(storeB, { sortCol: loc, sortDir: 1 });
  for (let i = 1; i < s.length; i++) assert(storeB.rows[s[i - 1]][loc].localeCompare(storeB.rows[s[i]][loc], undefined, { sensitivity: "base", numeric: true }) <= 0);
  const r = Rec.computeView(storeB, { sortCol: -1, sortDir: -1 }); assert.strictEqual(r[0], 9999);
  const q = Rec.computeView(storeB, { q: "sunny isles" }); assert(q.length > 1000 && q.every(i => storeB.rows[i].join("|").toLowerCase().includes("sunny isles")));
  const f = aB.findingsAll.find(x => x.id === "unit:unit_price"), both = Rec.computeView(storeB, { rows: new Set(f.rows), q: "Sunny", sortCol: aB.header.indexOf("total"), sortDir: -1 });
  assert.strictEqual(both.length, 12); assert(both.every(i => f.rows.includes(i)));
});
test("view: 10,000 rows filter and sort in under 150 ms", () => {
  const t0 = process.hrtime.bigint();
  Rec.computeView(storeB, { q: "cuban", sortCol: aB.header.indexOf("item"), sortDir: 1 });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6; assert(ms < 150, ms + " ms");
});
test("virtualization: only the rows in view are drawn", () => {
  const w = Rec.visibleRange(0, 12 * 34 + 37, 10000, 34); assert(w.last - w.first <= 12 + 2 * 4 + 2, JSON.stringify(w));
  const m = Rec.visibleRange(5000 * 34, 12 * 34 + 37, 10000, 34); assert(m.first > 4900 && m.last < 5100 && m.last - m.first <= 22, JSON.stringify(m));
  const e = Rec.visibleRange(10000 * 34, 500, 10000, 34); assert.strictEqual(e.last, 10000);
});

// ---------- CONS-0054: editing, recompute, undo, export
console.log("editing and export (CONS-0054)");
const cafe = () => { const d = { name: "cafe.csv", rows: R.cafeSample() }; const a = R.analyse(d); return { d, a, s: R.makeStore(d, a) }; };
test("numbers parse: '$1,150.00' becomes 1150.00 and text in a number column is refused", () => {
  const { a, s } = cafe(), pc = a.header.indexOf("unit_price");
  assert.strictEqual(Rec.commitEdit(s, 0, pc, "$1,150.00").ok, true); assert.strictEqual(s.rows[0][pc], "1150.00");
  const bad = Rec.commitEdit(s, 0, pc, "abc"); assert.strictEqual(bad.ok, false); assert(/number/.test(bad.reason)); assert.strictEqual(s.rows[0][pc], "1150.00");
});
test("editing quantity or price recomputes the total; undo restores both", () => {
  const { a, s } = cafe(), q = a.header.indexOf("qty"), p = a.header.indexOf("unit_price"), t = a.header.indexOf("total");
  const before = s.rows[5].slice(); Rec.commitEdit(s, 5, q, "7");
  assert.strictEqual(R.num(s.rows[5][t]), +(7 * R.num(before[p])).toFixed(2)); assert.strictEqual(s.edits.length, 1);
  Rec.undoEdit(s); assert.deepStrictEqual(s.rows[5], before); assert.strictEqual(s.edits.length, 0);
});
test("a row whose total was already wrong keeps its total (the mistake stays visible)", () => {
  const { a, s } = cafe(), sum = a.findingsAll.find(f => f.id === "sum"), ri = sum.rows[0], t = a.header.indexOf("total"), q = a.header.indexOf("qty");
  const tot = s.rows[ri][t]; Rec.commitEdit(s, ri, q, String(R.num(s.rows[ri][q]) + 1)); assert.strictEqual(s.rows[ri][t], tot);
});
test("fixing the twelve $115.00 rows removes the price finding and lowers the location average; the report recalculates", () => {
  const { d, a, s } = cafe(), p = a.header.indexOf("unit_price"), loc = a.header.indexOf("location"), t = a.header.indexOf("total");
  const pf = a.findingsAll.find(f => f.id === "unit:unit_price"); assert(pf && pf.n === 12, "price finding with 12 rows");
  const avg = st => { let n = 0, sum = 0; st.rows.forEach(r => { if (r[loc] === "Sunny Isles Beach") { n++; sum += R.num(r[t]); } }); return sum / n; };
  const avg0 = avg(s); pf.rows.forEach(ri => Rec.commitEdit(s, ri, p, "11.50"));
  const a2 = R.analyse({ name: d.name, rows: [d.rows[0], ...s.rows] });
  assert(!a2.findingsAll.some(f => /unit_price/.test(f.id)), "price finding still present: " + a2.findingsAll.map(f => f.id));
  assert.strictEqual(s.edits.length, 12); assert(avg(s) < avg0 - 1, `${avg0} -> ${avg(s)}`);
  const sumN = x => (x.findingsAll.find(f => f.id === "sum") || { n: 0 }).n;
  assert.strictEqual(sumN(a2), sumN(a), "recomputed totals must not create new mismatches");
});
test("export: an untouched file exports byte for byte, including quotes, CRLF and no final newline", () => {
  const txt = 'id,name,note\r\n1,"Smith, A",plain\r\n2,"say ""hi""",\r\n3,x,"multi\nline"';
  const d = { name: "q.csv", rows: R.parseDelimited(txt) }; const s = R.makeStore(d, R.analyse(d));
  assert.strictEqual(Rec.exportCSV(s), txt);
  for (const n of ["sales_planted.csv", "venues.csv", "sales_clean.csv"]) { const dd = load(n), ss = R.makeStore(dd, R.analyse(dd)); assert.strictEqual(Rec.exportCSV(ss), read(n), n); }
});
test("export round trip: edit, export, re-import, compare; change log has row, column, before, after, edited_at", () => {
  const dd = load("venues.csv"), a = R.analyse(dd), s = R.makeStore(dd, a), f = a.findingsAll.find(x => x.id === "variant"), ri = f.rows[0], ci = a.header.indexOf("venue_name");
  const was = s.rows[ri][ci]; Rec.commitEdit(s, ri, ci, "CVS Pharmacy", new Date("2026-11-08T12:00:00Z"));
  const out = Rec.exportCSV(s), again = R.parseDelimited(out);
  assert.strictEqual(again.length, dd.rows.length); assert.strictEqual(again[ri + 1][ci], "CVS Pharmacy");
  again.forEach((row, i) => row.forEach((v, j) => { if (!(i === ri + 1 && j === ci)) assert.strictEqual(v, dd.rows[i][j]); }));
  assert.deepStrictEqual(again[0], dd.rows[0]);
  const log = R.parseDelimited(Rec.changeLogCSV(s)); assert.deepStrictEqual(log[0], ["row", "column", "before", "after", "edited_at"]);
  assert.deepStrictEqual(log[1], [String(ri + 2), "venue_name", was, "CVS Pharmacy", "2026-11-08T12:00:00.000Z"]);
  const a2 = R.analyse({ name: "v", rows: again }), v2 = a2.findingsAll.find(x => x.id === "variant");
  assert(!v2 || v2.n === f.n - 1, "spelling count should drop by one: " + f.n + " -> " + (v2 && v2.n));
});

// ---------- CONS-0050: records worth a look
console.log("records worth a look (CONS-0050)");
test("cafe sample: at most ten, one reason each, price rows first, ordered by severity", () => {
  const { a, s } = cafe(), w = R.pickNotable(a, s); assert(w.length <= 10 && w.length >= 5, w.length);
  w.forEach(x => assert(x.reason && x.reason.length > 10 && !/<b>/.test(x.reason), JSON.stringify(x)));
  const pf = a.findingsAll.find(f => f.id === "unit:unit_price"); assert(pf.rows.includes(w[0].ri), "first is not a price row: " + JSON.stringify(w[0]));
  const rank = { fix: 2, look: 1, ctx: 0 }; for (let i = 1; i < w.length; i++) assert(rank[w[i - 1].sev] >= rank[w[i].sev], "severity order at " + i);
});
test("planted fixture: unit-error rows come first", () => {
  const w = R.pickNotable(aP, R.makeStore(planted, aP)), ue = new Set([...PT.city_unit_error, ...PT.x100, ...PT.x1000]);
  assert(w.slice(0, 4).every(x => ue.has(x.ri)), JSON.stringify(w.slice(0, 4).map(x => [x.ri, x.reason])));
});
test("deterministic: the same file gives the same list every time", () => {
  const w1 = R.pickNotable(aP, R.makeStore(planted, aP)), a2 = R.analyse(load("sales_planted.csv")), w2 = R.pickNotable(a2, R.makeStore(planted, a2));
  assert.deepStrictEqual(w1, w2);
});
test("recalculates after an edit: fixing a record removes it from the list", () => {
  const { d, a, s } = cafe(), w = R.pickNotable(a, s), p = a.header.indexOf("unit_price"); Rec.commitEdit(s, w[0].ri, p, "11.50");
  const a2 = R.analyse({ name: d.name, rows: [d.rows[0], ...s.rows] }); assert(!R.pickNotable(a2, s).some(x => x.ri === w[0].ri && x.col === p));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log("failed: " + failures.join("; ")); process.exit(1); }
