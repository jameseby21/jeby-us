/* Free report tests, part 5: interactive findings, filters and drill-down (CONS-0051).
   Loaded by run.js with its helpers. Synthetic fixtures only (made by make_fixtures.py): no real rows are in this repository.
   The browser half of CONS-0051 (click the CA bar, breadcrumb, hover, Compare, keyboard, print) is in browser.js. */
"use strict";
module.exports = function (h) {
  const { test, assert, R, Rec, load, truth, plain } = h;

  console.log("interactive findings: slices, compare and the URL hash (CONS-0051)");
  const states = load("sales_states.csv"), ST = truth("sales_states.truth.json");
  const aS = R.analyse(states, { cat: "state" }), sS = R.makeStore(states, aS);
  const CA = ST.ca_rows, stateCol = aS.header.indexOf("state");
  const lead = states.rows.length - sS.rows.length;   // the header row: 1
  const sliceOf = (idx, extra = {}) => R.analyseSlice({ name: states.name, rows: [...sS.lead, ...sS.rows] }, idx, sS.lead.length, { cat: "state", ...extra });

  test("filter recompute: a slice for CA holds only the CA rows, and its totals are the CA totals", () => {
    const { a } = sliceOf(CA); assert.strictEqual(lead, 1);
    assert.strictEqual(a.N, CA.length); assert.strictEqual(a.grouping.rows.length, 1); assert.strictEqual(a.grouping.rows[0].k, "CA");
    const want = CA.reduce((t, ri) => t + Number(sS.rows[ri][aS.measure.i]), 0); assert.strictEqual(a.total, want, "total sale_price of the CA rows");
    assert(aS.total > a.total, "the whole file is larger than its CA slice");
    assert.strictEqual(a.kpi[0][1], CA.length.toLocaleString("en-US"), "the Rows tile counts the slice");
  });
  test("filter recompute: the findings, flags, worth-a-look rows and QA sample of a slice point at rows of the whole file", () => {
    const { a, notable } = sliceOf(CA), inCA = new Set(CA);
    assert(a.findingsAll.length >= 1, "the extra-zero prices are a CA finding"); a.findingsAll.forEach(f => { assert(f.rows.length === f.n && f.n > 0); f.rows.forEach(r => assert(inCA.has(r), `${f.id}: row ${r} is not a CA row`)); });
    assert(a.flags.size > 0); [...a.flags.keys()].forEach(k => assert(inCA.has(+k.split(":")[0]), "flag outside the slice: " + k));
    a.qaSample.rows.forEach(r => assert(inCA.has(r))); [...a.qaSample.info.keys()].forEach(r => assert(inCA.has(r)));
    a.worth.items.forEach(x => assert(inCA.has(x.ri))); notable.forEach(w => assert(inCA.has(w.ri), "worth a look outside the slice"));
    ST.ca_x10.forEach(r => assert([...a.flags.keys()].some(k => k.startsWith(r + ":")), "planted CA row " + r + " is flagged in the slice"));
    assert.strictEqual(a.sliceMap, undefined, "the index map is not left on the result");
  });
  test("filter recompute: row numbers in the words are the file's own rows, not positions in the slice", () => {
    const { a, notable } = sliceOf(CA), f = a.findingsAll.find(x => x.id === "unit:sale_price"); assert(f, a.findingsAll.map(x => x.id).join());
    const first = f.rows[0], fileRow = first + aS.rowBase, m = /For example row ([\d,]+)/.exec(f.detail);
    assert(m && +m[1].replace(/,/g, "") === fileRow, `detail says row ${m && m[1]}, the file row is ${fileRow}: ${f.detail}`);
    const w = notable.find(x => /^Row \d/.test(x.title)); assert(w, "a worth-a-look row"); assert.strictEqual(+w.title.match(/^Row ([\d,]+)/)[1].replace(/,/g, ""), w.ri + aS.rowBase, "worth-a-look title: " + w.title);
  });
  test("filter recompute: a finding's rows are a slice too (the duplicates of the whole file)", () => {
    const dup = aS.findingsAll.find(f => f.id === "dup"); assert(dup && dup.n === 6, dup && dup.n);
    const { a } = sliceOf(dup.rows); assert.strictEqual(a.N, 6);
  });
  test("filter recompute: the slice of every row is the whole file", () => {
    const all = sS.rows.map((_, i) => i), { a } = sliceOf(all);
    assert.strictEqual(a.N, aS.N); assert.strictEqual(a.total, aS.total); assert.deepStrictEqual(a.findingsAll.map(f => [f.id, f.rows]), aS.findingsAll.map(f => [f.id, f.rows]));
    assert.deepStrictEqual([...a.flags.keys()].sort(), [...aS.flags.keys()].sort());
  });
  test("filter recompute: the venues fixture, Restaurant", () => {
    const v = load("venues.csv"), av = R.analyse(v, { cat: "category" }), sv = R.makeStore(v, av), idx = []; sv.rows.forEach((r, i) => { if (r[av.cat.i] === "Restaurant") idx.push(i); });
    const { a } = R.analyseSlice({ name: "venues.csv", rows: [...sv.lead, ...sv.rows] }, idx, sv.lead.length, { cat: "category" });
    assert.strictEqual(a.N, 139); assert.deepStrictEqual(a.grouping.rows.map(r => [r.k, r.n]), [["Restaurant", 139]]);
    assert(a.N < av.N);
  });

  test("hover numbers: each group carries its row count, share, mean and how many of its rows are flagged", () => {
    const flagged = new Set([...aS.flags.keys()].map(k => +k.split(":")[0]));
    aS.grouping.rows.filter(r => !r.other).forEach(r => {
      const rows = sS.rows.map((x, i) => [x, i]).filter(([x]) => (x[aS.cat.i].trim() || "(blank)") === r.k);
      assert.strictEqual(r.n, rows.length, r.k); assert.strictEqual(r.flagged, rows.filter(([, i]) => flagged.has(i)).length, r.k + " flagged");
      assert(Math.abs(r.mean - r.v / r.n) < 1e-6);
    });
    const ca = aS.grouping.rows.find(r => r.k === "CA"); assert(ca.flagged >= ST.ca_x10.length, "CA has the four extra-zero prices: " + ca.flagged);
    assert.strictEqual(aS.grouping.rows.reduce((t, r) => t + r.flagged, 0), flagged.size, "flagged counts add up to the flagged rows");
  });

  test("compare: the slice's value for every group of the whole file, and nothing for the groups it does not touch", () => {
    const c = R.compareGroups(aS, sS.rows, CA); assert.strictEqual(c.length, aS.grouping.rows.length);
    const caTotal = CA.reduce((t, ri) => t + Number(sS.rows[ri][aS.measure.i]), 0);
    assert.strictEqual(c.reduce((t, x) => t + x.v, 0), caTotal, "the slice's values add up to the slice total"); assert.strictEqual(c.reduce((t, x) => t + x.n, 0), CA.length);
    const aState = R.analyse(states, { cat: "state" }), byState = R.compareGroups(aState, sS.rows, CA);
    assert.deepStrictEqual(byState.filter(x => x.n > 0).map(x => x.k), ["CA"], "a CA slice touches only the CA group");
    assert(byState.every((x, i) => x.v <= aState.grouping.rows[i].v + 1e-9), "the slice never exceeds the whole file");
  });


  test("a slice of a later piece keeps the file's own row numbers (the piece's offset plus the place in the file)", () => {
    const { a } = R.analyseSlice({ name: states.name, rows: [...sS.lead, ...sS.rows] }, CA, sS.lead.length, { cat: "state", pieceCarry: { k: 2, n: 3, offset: 10000, total: 25000, size: 10000 } });
    const f = a.findingsAll.find(x => x.id === "unit:sale_price"), m = /For example row ([\d,]+)/.exec(f.detail);
    assert.strictEqual(+m[1].replace(/,/g, ""), f.rows[0] + 10000 + aS.rowBase, f.detail);
  });
  test("a slice of 10,000 rows is worked out inside 3 seconds (cafe sample, one location)", () => {
    const d = { name: "big.csv", rows: R.cafeSample(10000) }, a0 = R.analyse(d), s0 = R.makeStore(d, a0), idx = []; s0.rows.forEach((r, i) => { if (r[a0.cat.i] === "Sunny Isles Beach") idx.push(i); });
    const t0 = Date.now(), { a } = R.analyseSlice({ name: "big.csv", rows: [...s0.lead, ...s0.rows] }, idx, s0.lead.length, {}); const ms = Date.now() - t0;
    assert.strictEqual(a.N, idx.length); assert(idx.length > 1500, idx.length); assert(ms < 3000, ms + " ms");
  });

  // ---------- the URL hash
  const rt = (view, sample) => R.decodeView(R.encodeView(view, sample));
  test("hash: a view round-trips through the URL (finding, group, search, sort, compare, pickers)", () => {
    const v = { f: "unit:sale_price", g: { col: "state", val: "CA" }, q: "Palm Ave", s: { col: "sale_price", dir: -1 }, cmp: true, choice: { measure: "sale_price", date: "sale_date", cat: "state", cat2: "property_type", topN: 10, measure2: "beds", split: "source", distinct: "city" } };
    const out = rt(v, false); assert.deepStrictEqual(out.view, v); assert.strictEqual(out.sample, false);
  });
  test("hash: a nested group, a section, a column and the sample flag survive; characters that break a URL are escaped", () => {
    const v = { g: { col: "city & state", val: "A=B #1 ?%ü", col2: "category", val2: "Café/Bar" }, f: "sec:qa" }, out = rt(v, true);
    assert.deepStrictEqual(out.view, v); assert.strictEqual(out.sample, true);
    const hash = R.encodeView(v, true); assert(/^sample&/.test(hash), hash); assert(!/[ #?]/.test(hash), "no raw space, # or ? in " + hash);
    assert.deepStrictEqual(rt({ f: "col:beds" }).view, { f: "col:beds" });
  });
  test("hash: an empty view is an empty hash, and the old #sample link still means the sample", () => {
    assert.strictEqual(R.encodeView({}, false), ""); assert.strictEqual(R.encodeView({}, true), "sample");
    assert.deepStrictEqual(R.decodeView("#sample"), { sample: true, view: {} }); assert.deepStrictEqual(R.decodeView(""), { sample: false, view: {} });
  });
  test("hash: no data in the URL: a view built from clicking a row holds no cell value, and a filter on rows is left out", () => {
    const view = { f: "rows:QA sample", g: { col: "state", val: "CA" } };   // a row list is not shareable: it names rows, so it is never written
    const hash = R.encodeView(view, false); assert(!/rows|QA/.test(hash), hash); assert(/g=state&gv=CA/.test(hash), hash);
    const cell = sS.rows[CA[0]][aS.header.indexOf("address")]; assert(!R.encodeView({ f: "unit:sale_price", g: { col: "state", val: "CA" } }, true).includes(encodeURIComponent(cell)));
    assert(R.encodeView({ q: "x".repeat(500) }, false).length < 200, "a long search is cut");
  });
  test("hash: garbage is ignored, never run: unknown keys, bad numbers, a bad sort direction and broken escapes", () => {
    const out = R.decodeView("#evil=<script>&top=abc&sd=7&s=beds&g=state&gv=%E0%A4%A&q=ok&f=" + "y".repeat(400) + "&m=sale_price");
    assert.strictEqual(out.view.evil, undefined); assert.strictEqual(out.view.choice && out.view.choice.topN, undefined); assert(!out.view.s || out.view.s.dir === 1, JSON.stringify(out.view.s));
    assert.strictEqual(out.view.q, "ok"); assert.strictEqual(out.view.choice.measure, "sale_price"); assert(!out.view.f || out.view.f.length <= 120);
    assert.doesNotThrow(() => R.decodeView("#%%%&&==&=&a")); assert.deepStrictEqual(R.decodeView("#top=3").view.choice, { topN: 3 });
  });

  // ---------- the table model: a nested group is one filter
  test("table model: a group filter can name a second column, and a column's marked rows are a filter", () => {
    const s = sS, ci = aS.header.indexOf("state"), c2 = aS.header.indexOf("property_type");
    const v = Rec.computeView(s, { group: { col: ci, val: "CA", col2: c2, val2: "Condo" } });
    assert(v.length > 0 && v.length < CA.length); v.forEach(i => { assert.strictEqual(s.rows[i][ci], "CA"); assert.strictEqual(s.rows[i][c2], "Condo"); });
    assert.strictEqual(Rec.computeView(s, { group: { col: ci, val: "CA" } }).length, CA.length);
  });
};
