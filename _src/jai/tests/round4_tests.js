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
};
