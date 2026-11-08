/* Free report tests, part 2: nominal baselines (CONS-0058), duplicates and repeat sales (CONS-0059), Insights and QA (CONS-0062),
   the QA sample (CONS-0060), timelines (CONS-0061), domain checks (CONS-0063), the worker protocol (CONS-0043).
   Loaded by run.js with its helpers. Synthetic fixtures only (made by make_fixtures.py). */
"use strict";
module.exports = function (h) {
  const { test, assert, R, Rec, Dom, load, truth, plain, outFlags, read } = h;
  const county = load("sales_county.csv"), CT = truth("sales_county.truth.json"), aC = R.analyse(county);
  const cafeA = R.analyse({ name: "cafe", rows: R.cafeSample() });
  const planted = load("sales_planted.csv"), aP = R.analyse(planted);
  const textOf = (a, d) => [...a.findingsAll.flatMap(f => [f.title, f.detail]), ...[...a.flags.values()].map(f => f.why), ...R.pickNotable(a, R.makeStore(d, a)).map(w => w.reason)].map(plain);
  const PI = aC.header.indexOf("sale_price");

  // ---------- CONS-0058
  console.log("nominal transfers and baselines (CONS-0058)");
  test("county sales: the nominal cluster ($100, $10, $1, $0) is one QA finding with its count, set aside", () => {
    const f = aC.findingsAll.find(x => x.id === "nominal"); assert(f, "no nominal finding: " + aC.findingsAll.map(x => x.id));
    assert.strictEqual(f.kind, "qa"); assert.strictEqual(f.n, CT.nominal.length); assert.deepStrictEqual(f.rows, [...CT.nominal].sort((x, y) => x - y));
    assert(/^280 nominal transfers \(price \$1,000 or less\), set aside$/.test(f.title), f.title);
    assert(/\$100/.test(f.detail) && /left out of every baseline/.test(f.detail), f.detail);
  });
  test("county sales: nominal rows are never judged as outliers and never move a baseline", () => {
    const nom = new Set(CT.nominal), flagged = outFlags(aC).map(([k]) => +k.split(":")[0]);
    assert(!flagged.some(r => nom.has(r)), "a nominal row was flagged as an outlier");
    CT.x100.forEach(r => assert(flagged.includes(r), "x100 price not flagged: row index " + r));
    const planted_ = new Set([...CT.x100, ...CT.over_100m]), extra = new Set(flagged.filter(r => !planted_.has(r)));
    assert(extra.size <= aC.N * 0.02, `${extra.size} other rows flagged as outliers: ` + [...extra].slice(0, 3).map(r => plain(aC.flags.get(`${r}:${PI}`) ? aC.flags.get(`${r}:${PI}`).why : "?")).join(" | "));
  });
  test("county sales: a flagged price says what it was compared with, with n and the method", () => {
    const why = plain(aC.flags.get(`${CT.x100[0]}:${PI}`).why);
    assert(/Baseline: median of [\d,]+ non-nominal values in city “[A-Za-z ]+”\./.test(why), why);
    const n = +why.match(/median of ([\d,]+)/)[1].replace(/,/g, ""); assert(n >= 8 && n < aC.N - CT.nominal.length, "n " + n);
  });
  test("nobody is told a ratio above 20x; big gaps read 'far above' and show both numbers", () => {
    const bad = /(\b|\$)(2[1-9]|[3-9]\d|\d{3,}|\d,\d{3})(\.\d+)?x\b/;
    [[aC, county], [aP, planted], [cafeA, { name: "cafe", rows: R.cafeSample() }]].forEach(([a, d]) => textOf(a, d).forEach(t => assert(!bad.test(t), "ratio wording: " + t)));
    const far = plain(aC.flags.get(`${CT.x100[0]}:${PI}`).why); assert(/is far above this city's usual \$[\d,]+/.test(far), far);
  });
  test("a small group falls back to the whole file's non-nominal median and says so", () => {
    const rows = [["id", "city", "sale_price"]]; for (let i = 0; i < 120; i++) rows.push(["R" + i, i < 112 ? "Bigtown" : "Tinyville", String(300000 + (i * 7919) % 90000)]);
    rows[120][2] = "9000000"; const a = R.analyse({ name: "t", rows }), w = a.flags.get("119:2");
    assert(w, "the 9,000,000 row in a 8-row group should be compared with the whole file or its group: " + [...a.flags.keys()].join());
    assert(/Baseline: median of [\d,]+ (non-nominal )?values/.test(plain(w.why)), plain(w.why));
    const rows2 = [["id", "city", "sale_price"]]; for (let i = 0; i < 120; i++) rows2.push(["R" + i, i < 114 ? "Bigtown" : "Tinyville", String(300000 + (i * 7919) % 90000)]);
    rows2[120][2] = "9000000"; const w2 = R.analyse({ name: "t", rows: rows2 }).flags.get("119:2");
    assert(w2 && /across the file \(city “Tinyville” has fewer than 8\)/.test(plain(w2.why)), w2 && plain(w2.why));
  });
  test("money columns are recognized by name or by format, and the Columns table says which", () => {
    const price = aC.cols.find(c => c.name === "sale_price"); assert.strictEqual(price.role, "price"); assert.strictEqual(price.moneyBy, "name");
    const rows = [["a", "val"]]; for (let i = 0; i < 40; i++) rows.push(["r" + i, "$" + (1000 + i * 37) + ".50"]);
    const v = R.analyse({ name: "t", rows }).cols.find(c => c.name === "val"); assert.strictEqual(v.role, "money"); assert.strictEqual(v.moneyBy, "format");
    assert.strictEqual(Dom.roleLabel(v), "money (by format)"); assert.strictEqual(Dom.roleLabel(price), "money (by name)");
  });
};
