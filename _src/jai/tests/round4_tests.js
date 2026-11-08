/* Free report tests, part 4: round 4 (CONS-0042 supplement sources, CONS-0045 screening, CONS-0041 grouping, CONS-0047 worth a look, CONS-0053 pieces).
   Loaded by run.js with its helpers. Synthetic fixtures only (made by make_fixtures.py): no real rows are in this repository. */
"use strict";
module.exports = function (h) {
  const { test, assert, R, Rec, Dom, load, truth, plain, read } = h;
  const fs = require("fs"), path = require("path"), Src = require("../src/sources.js");

  // ---------- CONS-0042
  console.log("how to supplement your data (CONS-0042)");
  const fxNames = fs.readdirSync(path.join(__dirname, "fixtures")).filter(n => n.endsWith(".csv"));
  const everyFile = [...fxNames.map(n => [n, R.analyse(load(n))]), ["cafe sample", R.analyse({ name: "cafe", rows: R.cafeSample() })]];
  const flat = a => Src.pick(a).flatMap(g => g.items);
  test("the source list is data: every source has a name, an https link, free or paid, open or licensed, and one line on what it adds", () => {
    const seen = new Set();
    Src.SOURCES.groups.forEach(g => { assert(g.id && g.title && g.why && ["places", "dates", "money", "transactions", "any"].includes(g.when), "group " + g.id);
      g.items.forEach(s => { assert(s.name && /^https:\/\/[a-z0-9.-]+\//.test(s.url), "link of " + s.name); assert(["free", "paid"].includes(s.cost), s.name + " cost"); assert(["open", "licensed"].includes(s.access), s.name + " access");
        assert(s.adds && s.adds.length > 20 && s.adds.length < 200 && !/best|leading|world-class|#1/i.test(s.adds), s.name + " adds: " + s.adds); seen.add(g.id + "|" + s.name); }); });
    assert.strictEqual(seen.size, Src.SOURCES.groups.reduce((n, g) => n + g.items.length, 0), "a source is listed twice in one group");
  });
  test("every fixture, even one with no findings, gets at least three free and two paid sources, each listed once", () => {
    everyFile.forEach(([n, a]) => { const l = flat(a); assert(l.filter(s => s.cost === "free").length >= 3 && l.filter(s => s.cost === "paid").length >= 2, `${n}: ${l.map(s => s.cost).join()}`);
      assert.strictEqual(new Set(l.map(s => s.name)).size, l.length, n + " repeats a source"); });
  });
  test("sources follow the detected shape: places for venues, holidays and weather for dates, price indexes for money, retail data for a ledger", () => {
    const names = a => flat(a).map(s => s.name).join("|"), V = R.analyse(load("venues.csv")), C = everyFile.find(x => x[0] === "cafe sample")[1], L = R.analyse(load("ledger_header.csv"));
    assert(/OpenStreetMap/.test(names(V)) && /Overture/.test(names(V)) && /Google Places/.test(names(V)) && /Foursquare/.test(names(V)) && /Yelp/.test(names(V)) && /TDLinx/.test(names(V)) && /Census/.test(names(V)), names(V));
    assert(!/holidays|NOAA/.test(names(V)), "venues has no date column, so no calendar sources: " + names(V));
    assert(/holidays/.test(names(C)) && /NOAA/.test(names(C)) && /Consumer Price/.test(names(C)) && !/OpenStreetMap/.test(names(C)), names(C));
    assert(/retail trade/.test(names(L)) && /Consumer Price/.test(names(L)), names(L));
    assert(/Data\.gov/.test(names(V)) && /Data\.gov/.test(names(C)) && /Data\.gov/.test(names(L)), "the general sources are always there");
  });
  test("the first group is the most specific one, and the general group comes last", () => {
    const g = Src.pick(R.analyse(load("venues.csv"))).map(x => x.id); assert.strictEqual(g[0], "places"); assert.strictEqual(g[g.length - 1], "any");
  });

  // ---------- CONS-0041: stronger grouping
  console.log("stronger grouping (CONS-0041)");
  const cafeD = { name: "cafe", rows: R.cafeSample() }, num = R.num;
  const sumBy = (d, a, gcol, mcol) => { const gi = a.header.indexOf(gcol), mi = a.header.indexOf(mcol), m = new Map(); d.rows.slice(1).forEach(r => m.set(r[gi].trim() || "(blank)", (m.get(r[gi].trim() || "(blank)") || 0) + (num(r[mi]) || 0))); return m; };
  test("grouping: one level by default with count, share of total, sum and mean on each row; the shares add up to the whole", () => {
    const a = R.analyse(cafeD), g = a.grouping; assert(g && g.cat === a.cat.name && g.cat2 === null && g.agg === "sum", JSON.stringify(g && { c: g.cat, a: g.agg }));
    const want = sumBy(cafeD, a, g.cat, a.measure.name); assert(g.rows.length <= 8);
    g.rows.filter(r => !r.other).forEach(r => { assert(Math.abs(r.v - want.get(r.k)) < 0.01, r.k); assert(r.n > 0 && Math.abs(r.mean - r.v / r.n) < 1e-9, "mean " + r.k); assert(Math.abs(r.share - r.v / g.total) < 1e-9, "share " + r.k); });
    assert(Math.abs(g.rows.reduce((t, r) => t + r.share, 0) - 1) < 1e-9, "shares add to 1"); assert.strictEqual(g.rows.reduce((t, r) => t + r.n, 0), a.N, "every row is in one group");
  });
  test("grouping: a second group-by column nests the biggest groups under each parent, with its own Other bucket and shares of the parent and of the total", () => {
    const d = load("venues.csv"), a = R.analyse(d, { cat: "city", cat2: "category" }), g = a.grouping; assert(g.cat === "city" && g.cat2 === "category" && g.rows.length === 5, JSON.stringify(g.rows.map(r => r.k)));
    g.rows.forEach(p => { assert(p.kids.length >= 1 && p.kids.length <= 4, p.k + " kids " + p.kids.length); assert.strictEqual(p.kids.reduce((t, k) => t + k.n, 0), p.n, p.k + ": the children hold every row of the parent");
      p.kids.forEach(k => { assert(Math.abs(k.within - k.n / p.n) < 1e-9, "share within the parent"); assert(Math.abs(k.share - k.n / a.N) < 1e-9, "share of the total"); }); });
    assert(g.rows.some(p => p.kids.some(k => k.other)), "a parent with more than three kinds has an Other child");
    assert.strictEqual(R.analyse(d, { cat: "city", cat2: "city" }).grouping.cat2, null, "a column cannot be nested under itself");
  });
  test("grouping: top N with an Other bucket, N adjustable, and nothing is lost", () => {
    const g3 = R.analyse(cafeD, { cat: "item", topN: 3 }).grouping, g5 = R.analyse(cafeD, { cat: "item", topN: 5 }).grouping;
    assert.strictEqual(g3.rows.length, 4); assert(g3.rows[3].other && /^Other \(4\)$/.test(g3.rows[3].k), g3.rows[3].k); assert.strictEqual(g5.rows.length, 6);
    assert.strictEqual(g3.rows.reduce((t, r) => t + r.n, 0), R.analyse(cafeD).N); assert(Math.abs(g3.rows.reduce((t, r) => t + r.v, 0) - g3.total) < 0.01, "Other holds the rest of the total");
    const all = R.analyse(cafeD, { cat: "item", topN: 20 }).grouping; assert(!all.rows.some(r => r.other), "no Other when everything fits");
  });
  test("grouping: count distinct is a measure, and the distinct count is not added across groups", () => {
    const a = R.analyse(cafeD, { cat: "location", distinct: "order_id" }), g = a.grouping; assert.strictEqual(g.agg, "distinct"); assert.strictEqual(g.measureName, "Distinct order_id");
    const gi = a.header.indexOf("location"), oi = a.header.indexOf("order_id"), m = new Map(); cafeD.rows.slice(1).forEach(r => { const k = r[gi].trim() || "(blank)"; (m.get(k) || m.set(k, new Set()).get(k)).add(r[oi]); });
    g.rows.filter(r => !r.other).forEach(r => assert.strictEqual(r.v, m.get(r.k).size, r.k)); assert(g.rows.some(r => !r.other && r.v < r.n), "the nine repeated order ids make a distinct count smaller than a row count");
    assert.strictEqual(g.total, new Set(cafeD.rows.slice(1).map(r => r[oi])).size, "the share is of the distinct count of the whole file");
  });
  test("grouping: a second measure is summed beside the first, per group", () => {
    const a = R.analyse(cafeD, { cat: "location", measure2: "qty" }), g = a.grouping, want = sumBy(cafeD, a, "location", "qty"); assert.strictEqual(g.measure2Name, "qty");
    g.rows.filter(r => !r.other).forEach(r => assert(Math.abs(r.v2 - want.get(r.k)) < 0.01, r.k)); assert.strictEqual(R.analyse(cafeD, { cat: "location", measure2: a.measure.name }).grouping.measure2Name, null, "the second measure differs from the first");
  });
  test("grouping: with no measure the groups are counted, a ledger keeps its merchant list, and the controls offer the new choices", () => {
    const v = R.analyse(load("venues.csv"), { cat: "city" }).grouping; assert.strictEqual(v.agg, "rows"); assert.strictEqual(v.measureName, "Rows"); assert.strictEqual(v.rows[0].mean, null);
    assert.strictEqual(R.analyse(load("ledger_header.csv")).grouping, null, "a ledger's grouping is its merchant list");
    const a = R.analyse(cafeD); assert(a.catCands.length >= 2 && a.distinctCands.some(c => c.name === "order_id") && a.numCols.length >= 2, "choices for the second column, count distinct and the second measure");
  });
};
