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

  // ---------- CONS-0047: Worth a look, five items, with a Search news button that sends only a name, a street, a city or a category
  console.log("worth a look and Search news (CONS-0047)");
  const V = load("venues.csv"), aVen = R.analyse(V), fixRows = a => new Set([...a.flags.entries()].filter(([, f]) => f.sev === "fix").map(([k]) => +k.split(":")[0]));
  const vq = a => a.worth.items.map(x => x.query);
  test("worth a look: five items, a seeded random sample by default, the seed shown, the same file gives the same five and another seed gives others", () => {
    const w = aVen.worth; assert.strictEqual(w.items.length, 5); assert.strictEqual(w.by, "random"); assert(Number.isInteger(w.seed) && w.seed >= 0 && w.seed < 10000, w.seed);
    assert.deepStrictEqual(R.analyse(V).worth.items.map(x => x.ri), w.items.map(x => x.ri), "the same file gives the same five");
    const other = R.analyse(V, { worthSeed: w.seed + 1 }).worth; assert.strictEqual(other.seed, w.seed + 1); assert.notDeepStrictEqual(other.items.map(x => x.ri), w.items.map(x => x.ri));
    assert.strictEqual(new Set(w.items.map(x => x.query)).size, 5, "five different searches"); assert(w.items.every(x => x.title && x.reason && x.ri >= 0 && x.ri < aVen.N));
  });
  test("worth a look: rows that QA marks Fix are never sampled, under any seed", () => {
    const fx = fixRows(aVen); assert(fx.size >= 6, "the venues fixture has Fix rows (the CVS duplicates): " + fx.size);
    for (let sd = 0; sd < 200; sd++) R.analyse(V, { worthSeed: sd }).worth.items.forEach(x => assert(!fx.has(x.ri), `seed ${sd} sampled Fix row ${x.ri}`));
    const c = R.analyse({ name: "cafe", rows: R.cafeSample() }); const fc = fixRows(c); assert(fc.size > 10); for (let sd = 0; sd < 30; sd++) R.analyse({ name: "cafe", rows: R.cafeSample() }, { worthSeed: sd }).worth.items.forEach(x => assert(!fc.has(x.ri)));
  });
  test("worth a look: with a measure chosen the five are the most prominent, largest first", () => {
    const d = { name: "cafe", rows: R.cafeSample() }, a = R.analyse(d, { worthBy: "largest" }), mi = a.header.indexOf(a.measure.name), fx = fixRows(a);
    assert.strictEqual(a.worth.by, "largest"); const vals = a.worth.items.map(x => R.num(d.rows[x.ri + 1][mi])); assert.deepStrictEqual(vals, [...vals].sort((x, y) => y - x));
    const best = d.rows.slice(1).map((r, i) => [R.num(r[mi]), i]).filter(([, i]) => !fx.has(i)).sort((x, y) => y[0] - x[0] || x[1] - y[1])[0]; assert.strictEqual(vals[0], best[0], "the largest eligible row comes first");
    assert.strictEqual(R.analyse(d, { measure: a.measure.name }).worth.by, "largest", "choosing a measure picks the prominent rows"); assert.strictEqual(R.analyse(d).worth.by, "random");
    assert.strictEqual(R.analyse(V, { worthBy: "largest" }).worth.by, "random", "a file with no measure cannot be sampled by size");
  });
  test("the news query uses only a name, a street, a city or a category: the house number is dropped, and no owner, phone, email, id or amount is ever in it", () => {
    aVen.worth.items.forEach(x => { const row = V.rows[x.ri + 1]; assert(x.query.includes('"' + row[0] + '"') && x.query.includes(row[4]), x.query); assert(!x.query.includes(row[2]) && !x.query.includes(row[6]), "no house number or postal code in " + x.query); assert(!x.query.includes(row[9]) && !x.query.includes(row[10]) && !x.query.includes(row[7]), "no id or coordinate"); });
    const rows = [["name", "street", "city", "owner_name", "phone", "email", "sale_price", "notes"]];
    for (let i = 0; i < 12; i++) rows.push(["Cafe Uno " + i, (100 + i) + " Ocean Dr", "Miami", "Ana Pérez" + i, "305-555-01" + (10 + i), "ana" + i + "@example.com", String(1000 + i * 17), "free text " + i]);
    const w = R.analyse({ name: "q.csv", rows }).worth; assert.strictEqual(w.items.length, 5);
    w.items.forEach(x => { assert(/^"Cafe Uno \d+" "Ocean Dr" Miami$/.test(x.query), x.query); assert(!/Ana|305|example|1[01]\d\d|free text/.test(x.query), "private fields leaked: " + x.query); assert.deepStrictEqual(Object.keys(x.parts).sort(), ["city", "name", "street"]); });
  });
  test("with no name, street or city the query is built from category columns; with none of them there is nothing to search and the block says why", () => {
    const c = R.analyse({ name: "cafe", rows: R.cafeSample() }); assert.strictEqual(c.worth.items.length, 5); c.worth.items.forEach(x => assert(/^"[^"]+"( [A-Za-z ]+)?$/.test(x.query) && !/\d/.test(x.query), x.query));
    const none = R.analyse({ name: "n.csv", rows: [["a", "b"], ...Array.from({ length: 20 }, (_, i) => [String(i * 3.5), String(i * 7)])] }).worth; assert.strictEqual(none.items.length, 0); assert(/name, street, city or category/.test(none.why), none.why);
  });
  test("the worth-a-look pick sees no flagged column: a screened-out name is never searched", () => {
    const rows = [["name", "ssn", "city"]]; for (let i = 0; i < 12; i++) rows.push(["Cafe " + i, `${100 + i}-45-${1000 + i}`, "Miami"]);
    const w = R.analyse({ name: "s.csv", rows }).worth; w.items.forEach(x => assert(!/\d{3}-45/.test(x.query + x.title + x.reason)));
  });

  // ---------- CONS-0053: a file over the limit runs as pieces
  console.log("a big file runs as pieces (CONS-0053)");
  const big23 = R.cafeSample(23000), piece = (k, rows, lim, choice = {}) => { const p = R.handle({ op: "analyse", name: "big.csv", rows, choice, maxRows: lim, maxCols: 12, piece: k }); R.setLimits(10000, 12); return p; };   // the analysis runs inside the call, so the shared limit is put back right after it
  const three = [1, 2, 3].map(k => piece(k, big23, 10000));   // started once, shared by the tests below: three analyses of 10,000 rows are the whole cost
  test("pieces: a 23,000-row file is read as piece 1 of 3, 2 of 3 and 3 of 3, with no error; the piece sizes are the limit, the limit and the rest", async () => {
    const [r1, r2, r3] = await Promise.all(three);
    [[r1, 1, 10000], [r2, 2, 10000], [r3, 3, 3000]].forEach(([r, k, n]) => { assert.strictEqual(r.a.N, n, "rows in piece " + k); assert.deepStrictEqual({ k: r.a.piece.k, n: r.a.piece.n, total: r.a.piece.total, size: r.a.piece.size }, { k, n: 3, total: 23000, size: 10000 }); assert.strictEqual(r.a.allRows, 23000); assert.strictEqual(r.a.truncated, false, "the rows are not cut: they are pieces"); });
    assert.strictEqual(r1.a.rowBase, 2); assert.strictEqual(r2.a.rowBase, 10002, "row numbers are the file's own"); assert.strictEqual(r3.a.rowBase, 20002);
    assert.strictEqual(r2.rows[1][0], big23[10001][0], "piece 2 starts at the 10,001st row of data"); assert.strictEqual(r3.rows[r3.rows.length - 1][0], big23[23000][0], "piece 3 ends at the last row");
  });
  test("pieces: only one piece is held at a time: what the worker returns is the header and that piece, never the whole file", async () => {
    const [, r2, r3] = await Promise.all(three); assert.strictEqual(r2.rows.length, 1 + 10000); assert.strictEqual(r2.rows[0][0], big23[0][0], "the header row comes with every piece");
    assert.strictEqual(r3.rows.length, 1 + 3000); assert.strictEqual(R.makeStore({ name: "b", rows: r3.rows }, r3.a).rows.length, 3000);
  });
  test("pieces: each piece is reported on its own (piece 2 has different findings from piece 1)", async () => {
    const [r1, r2] = await Promise.all(three), t = r => r.a.findingsList.map(f => f.title).join("|"); assert.notStrictEqual(t(r1), t(r2), "the planted problems of the cafe sample live in piece 1 only");
  });
  test("pieces: a piece number out of range goes to the nearest piece; exactly the limit is one piece with no counter, one row more is two pieces", async () => {
    const rows = R.cafeSample(250); assert.strictEqual((await piece(99, rows, 100)).a.piece.k, 3); assert.strictEqual((await piece(0, rows, 100)).a.piece.k, 1); assert.strictEqual((await piece(undefined, rows, 100)).a.piece.k, 1, "no piece number means piece 1");
    const exact = await piece(1, R.cafeSample(100), 100); assert.strictEqual(exact.a.piece, null); assert.strictEqual(exact.a.N, 100);
    const more = R.cafeSample(101), a = await piece(1, more, 100), b = await piece(2, more, 100); assert.strictEqual(a.a.piece.n, 2); assert.strictEqual(b.a.N, 1); assert.strictEqual(b.a.piece.k, 2);
  });
  test("pieces: screening runs on every piece and a column flagged in one piece stays out of the others", async () => {
    const src = R.cafeSample(500), rows = src.map((r, i) => (i === 0 ? [...r, "ref"] : [...r, i <= 200 ? `${100 + (i % 800)}-45-${1000 + (i % 8000)}` : "plain"]));
    const r1 = await piece(1, rows, 200); assert(r1.a.screen.excluded.some(x => x.name === "ref" && x.cls === "government-id"), JSON.stringify(r1.a.screen.excluded)); assert(!r1.a.header.includes("ref"));
    const alone = await piece(2, rows, 200); assert(alone.a.header.includes("ref"), "without the carry, piece 2 on its own shows nothing odd in this column");
    const r2 = await piece(2, rows, 200, { pieceScreen: r1.a.screen.flagged }); assert(!r2.a.header.includes("ref"), "flagged columns stay excluded across pieces"); assert(r2.a.screen.excluded.some(x => x.name === "ref")); assert(!JSON.stringify(R.cleanA(r2.a)).includes("-45-"), "no value of it anywhere");
    const ssn = src.map((r, i) => (i === 0 ? [...r, "ssn"] : [...r, `${100 + (i % 800)}-45-${1000 + (i % 8000)}`])), r3 = await piece(3, ssn, 200); assert(r3.a.screen.excluded.some(x => x.name === "ssn"), "screening ran on piece 3 as well");
  });
  test("pieces: the counter text and the paid note come from one place, and the note is one plain sentence", () => {
    assert(/all pieces at once/i.test(R.PIECE_NOTE) && R.PIECE_NOTE.split(/[.!?]/).filter(x => x.trim()).length === 1, R.PIECE_NOTE); assert.strictEqual(R.pieceLabel({ k: 2, n: 3 }), "piece 2 of 3");
  });
};
