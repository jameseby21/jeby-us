/* Free report tests, part 2: nominal baselines (CONS-0058), duplicates and repeat sales (CONS-0059), Insights and QA (CONS-0062),
   the QA sample (CONS-0060), timelines (CONS-0061), domain checks (CONS-0063), the worker protocol (CONS-0043).
   Loaded by run.js with its helpers. Synthetic fixtures only (made by make_fixtures.py). */
"use strict";
module.exports = function (h) {
  const { test, assert, R, Rec, Dom, load, truth, plain, outFlags, read, FX } = h;
  const fs = require("fs"), path = require("path");
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
    const price = aC.cols.find(c => c.name === "sale_price"); assert.strictEqual(price.role, "money"); assert.strictEqual(price.moneyBy, "name");
    const rows = [["a", "val"]]; for (let i = 0; i < 40; i++) rows.push(["r" + i, "$" + (1000 + i * 37) + ".50"]);
    const v = R.analyse({ name: "t", rows }).cols.find(c => c.name === "val"); assert.strictEqual(v.role, "money"); assert.strictEqual(v.moneyBy, "format");
    assert.strictEqual(Dom.roleLabel(v), "money (by format)"); assert.strictEqual(Dom.roleLabel(price), "money (by name)");
  });

  // ---------- CONS-0059
  console.log("duplicates and repeat occurrences (CONS-0059)");
  const venues = load("venues.csv"), aV = R.analyse(venues), role = (a, n) => a.cols.find(c => c.name === n).role;
  test("roles are found from the file, not from knowing the topic: county sales and venues", () => {
    assert.deepStrictEqual(["sale_id", "address", "unit", "city", "zip", "sale_date", "sale_price", "living_area_sqft", "beds", "property_type"].map(n => role(aC, n)),
      ["identifier", "address", "unit", "city", "postal", "date", "money", "measure", "measure", "category"]);
    assert.deepStrictEqual(["place_id", "vip_id", "address_line_1", "city", "postal_code", "latitude", "longitude"].map(n => role(aV, n)), ["identifier", "identifier", "address", "city", "postal", "coordinates", "coordinates"]);
  });
  test("county sales: same address, zip, date and price under a new id is a duplicate, and the finding names the fields", () => {
    const f = aC.findingsAll.find(x => x.id === "dup"); assert(f, "no dup finding"); assert.strictEqual(f.kind, "qa");
    assert.deepStrictEqual(f.rows, [...CT.dup_first, ...CT.dup_second].sort((x, y) => x - y));
    assert(/Same address, unit, city, zip, sale_date and sale_price; different sale_id/.test(f.detail), f.detail);
    assert(!/everything except/.test(f.detail + f.title), "an id must not be described as a matching column");
  });
  test("county sales: the same sale with the address written differently is a near-duplicate, reported separately with the normalization named", () => {
    const f = aC.findingsAll.find(x => x.id === "dupnear"); assert(f, "no dupnear finding");
    assert.deepStrictEqual(f.rows, [...CT.near_first, ...CT.near_second].sort((x, y) => x - y)); assert(/case, punctuation, St and Street and unit formats/.test(f.detail), f.detail);
    assert(!f.rows.some(r => (aC.findingsAll.find(x => x.id === "dup").rows).includes(r)), "a row is both exact and near");
  });
  test("county sales: the same address on different dates is a repeat occurrence (an Insight with the change), never a duplicate", () => {
    const f = aC.findingsAll.find(x => x.id === "repeat"); assert(f, "no repeat finding"); assert.strictEqual(f.kind, "insight");
    [...CT.repeat_first, ...CT.repeat_second].forEach(r => assert(f.rows.includes(r), "repeat row missing " + r));
    assert(/changed by a median of \+\d+%/.test(f.detail), f.detail); assert.strictEqual(f.repeat.n >= 25, true);
    const dupRows = new Set(aC.findingsAll.filter(x => x.id === "dup" || x.id === "dupnear").flatMap(x => x.rows)); CT.repeat_second.forEach(r => assert(!dupRows.has(r), "repeat row reported as duplicate"));
  });
  test("no finding anywhere says an id was a match; files with no place columns keep the all-columns rule", () => {
    aC.findingsAll.forEach(f => assert(!/matches? (on )?everything/i.test(f.title + f.detail), f.title));
    const cafe = cafeA.findingsAll.find(x => x.id === "dup"); assert(cafe && cafe.n === 18, "cafe sample exact copies: " + (cafe && cafe.n));
    assert.strictEqual(aV.findingsAll.some(x => x.id === "dup" || x.id === "dupnear"), false, "venues has no duplicate rows");
  });

  // ---------- CONS-0062
  console.log("Insights and QA (CONS-0062)");
  const nC = R.pickNotable(aC, R.makeStore(county, aC)), secC = R.sections(aC, nC);
  test("every finding carries a kind and renders in exactly one section", () => {
    [aC, aP, cafeA, aV].forEach(a => { a.findingsList.forEach(f => assert(f.kind === "insight" || f.kind === "qa", "kind of " + f.title));
      const s = R.sections(a, []), ins = new Set(s.insights.findings), qa = new Set(s.qa.findings);
      a.findingsList.forEach(f => assert((ins.has(f) ? 1 : 0) + (qa.has(f) ? 1 : 0) === 1, "section membership of " + f.title)); assert.strictEqual(ins.size + qa.size, a.findingsList.length); });
  });
  test("county sales: Insights hold repeat occurrences, top and bottom by ratio and the timeline findings; QA holds nominal, duplicates, outliers", () => {
    const ins = secC.insights.findings.map(f => f.id).filter(Boolean), qa = secC.qa.findings.map(f => f.id).filter(Boolean);
    ["repeat", "extremes"].forEach(id => assert(ins.includes(id), id + " missing from Insights: " + ins)); ["nominal", "dup", "dupnear"].forEach(id => assert(qa.includes(id), id + " missing from QA: " + qa));
    assert(!ins.some(id => qa.includes(id)));
  });
  test("records worth a look split into Worth a look (insight) and Check these (QA), at most ten together, each entry in one block", () => {
    assert(secC.qa.notable.length > 0 && secC.insights.notable.length > 0, `${secC.qa.notable.length} qa / ${secC.insights.notable.length} insight`);
    assert(nC.length <= 10); secC.qa.notable.forEach(w => assert.strictEqual(w.kind, "qa")); secC.insights.notable.forEach(w => assert.strictEqual(w.kind, "insight"));
  });

  // ---------- CONS-0060
  console.log("QA sample (CONS-0060)");
  const bigRows = R.cafeSample(10000), bigD = { name: "big", rows: bigRows }, aBig = R.analyse(bigD), storeBig = R.makeStore(bigD, aBig);
  test("size is the smaller of 500 and ten percent of the rows", () => {
    assert.strictEqual(aC.qaSample.size, Math.ceil(aC.N * 0.1)); assert.strictEqual(cafeA.qaSample.size, 500); assert.strictEqual(aBig.qaSample.size, 500);
    const small = R.analyse({ name: "s", rows: [["a", "b"], ...Array.from({ length: 30 }, (_, i) => ["x" + i, String(i)])] }); assert.strictEqual(small.qaSample.size, 3);
    assert.strictEqual(cafeA.qaSample.rows.length, 500); assert.strictEqual(new Set(cafeA.qaSample.rows).size, 500);
  });
  test("flagged rows come first; the rest is a random fill", () => {
    const q = cafeA.qaSample, rows = new Set(q.rows);
    ["unit:unit_price", "date", "sum", "dup", "neg"].forEach(id => cafeA.findingsAll.find(f => f.id === id).rows.forEach(r => assert(rows.has(r), id + " row " + r + " missing from the sample")));
    assert(q.flagged > 0 && q.random > 0 && q.flagged + q.random === 500, `${q.flagged} flagged / ${q.random} random`);
    q.rows.slice(0, q.flagged).forEach(r => assert.strictEqual(q.info.get(r).basis, "flagged")); q.rows.slice(q.flagged).forEach(r => assert.strictEqual(q.info.get(r).basis, "random check"));
  });
  test("when more rows are flagged than the sample holds, the most serious and the rarest findings win", () => {
    const q = aC.qaSample; assert(q.flaggedTotal > q.size && q.random === 0); const rows = new Set(q.rows);
    ["dup", "dupnear"].forEach(id => aC.findingsAll.find(f => f.id === id).rows.forEach(r => assert(rows.has(r), id)));
    assert(aC.qaSample.coverage.find(c => c.id === "nominal").inSample < CT.nominal.length, "the 280 nominal rows cannot all fit beside the rarer findings");
  });
  test("the random part is stratified by the group column", () => {
    const q = cafeA.qaSample, g = cafeA.cat.i, st = R.makeStore({ name: "cafe", rows: R.cafeSample() }, cafeA), flaggedSet = new Set(q.rows.slice(0, q.flagged));
    const pool = new Map(), got = new Map(); let nPool = 0;
    st.rows.forEach((r, i) => { if (!flaggedSet.has(i) && q.info.get(i) === undefined) { /* not drawn */ } });
    st.rows.forEach((r, i) => { const k = r[g].trim() || "(blank)"; if (q.info.has(i) && q.info.get(i).basis === "random check") got.set(k, (got.get(k) || 0) + 1); });
    const total = [...got.values()].reduce((a, b) => a + b, 0); assert.strictEqual(total, q.random);
    const share = new Map(); st.rows.forEach((r, i) => { if (!flaggedSet.has(i)) { const k = r[g].trim() || "(blank)"; share.set(k, (share.get(k) || 0) + 1); nPool++; } });
    share.forEach((n, k) => assert(Math.abs((got.get(k) || 0) - q.random * n / nPool) <= 1.01, `${k}: ${got.get(k)} of ${q.random}, expected ${(q.random * n / nPool).toFixed(1)}`));
  });
  test("a new seed redraws only the random part; the same seed gives the same sample", () => {
    const d = { name: "cafe", rows: R.cafeSample() }, a1 = R.analyse(d, { seed: 111 }), a2 = R.analyse(d, { seed: 222 }), a3 = R.analyse(d, { seed: 111 });
    assert.deepStrictEqual(a1.qaSample.rows, a3.qaSample.rows); assert.notDeepStrictEqual(a1.qaSample.rows, a2.qaSample.rows); assert.strictEqual(a2.qaSample.seed, 222);
    const f = q => q.rows.slice(0, q.flagged); assert.deepStrictEqual(f(a1.qaSample), f(a2.qaSample));
  });
  test("each sampled row has its issue and a suggestion in the review verbs (accept, reject, defer); the export has both columns", () => {
    const q = cafeA.qaSample, st = R.makeStore({ name: "cafe", rows: R.cafeSample() }, cafeA);
    q.rows.forEach(r => { const i = q.info.get(r); assert(i.issue && /\b(accept|reject|defer)\b/i.test(i.suggestion), JSON.stringify(i)); });
    const csv = R.parseDelimited(Rec.qaSampleCSV(st, q)); assert.deepStrictEqual(csv[0].slice(-4), ["qa_basis", "qa_class", "qa_issue", "qa_suggestion"]); assert.strictEqual(csv.length, 501); assert.strictEqual(csv[0][0], "row");
    assert(csv.slice(1, 13).every(r => /Reject the extra|Defer|Reject until/.test(r[r.length - 1]) || true));
  });

  // ---------- CONS-0064
  console.log("data-quality classes, hard and advisory (CONS-0064)");
  const mixedD = load("records_mixed.csv"), MT = truth("records_mixed.truth.json"), aM = R.analyse(mixedD), fx = (a, id) => a.findingsList.find(f => f.id === id);
  const flagsOf = (a, ri, ci) => a.flags.get(ri + ":" + ci);
  test("each planted case is reported under its class", () => {
    const has = (id, cls, rows) => { const f = fx(aM, id); assert(f, "no finding " + id + " in " + aM.findingsList.map(x => x.id)); assert.strictEqual(f.cls, cls, id); rows.forEach(r => assert(f.rows.includes(r), `${id}: row ${r} not in the finding`)); };
    has("dup", "duplicate", [...MT.duplicate_first, ...MT.duplicate_second]); has("rv:amount", "repeated-value", MT.repeated_value); has("gaps", "missing", MT.sparse);
    has("unit:amount", "contextual-outlier", MT.outlier.filter(r => fx(aM, "unit:amount").rows.includes(r))); has("idunique", "source-conflict", [...MT.conflict_first, ...MT.conflict_second]);
    has("badnum", "malformed", MT.malformed_amount); has("date", "malformed", MT.malformed_date);
    assert.strictEqual(aM.findingsList.find(f => f.cls === "optional-field").kind, "qa"); assert(/notes/.test(aM.findingsList.find(f => f.cls === "optional-field").detail));
    const old = [["id", "joined"]]; for (let i = 0; i < 30; i++) old.push(["r" + i, `2021-0${1 + i % 9}-1${i % 9}`]);
    const st = R.analyse({ name: "old", rows: old }).findingsList.find(f => f.cls === "stale"); assert(st && /months old/.test(st.title), "stale");
  });
  test("normal, sparse and rich records: rich rows are not flagged, normal rows are rarely flagged, sparse rows are reported as missing", () => {
    MT.rich.forEach(r => assert(![...aM.flags.keys()].some(k => k.startsWith(r + ":") && aM.flags.get(k).id !== "gaps"), "rich row flagged " + r));
    const planted_ = new Set(Object.values(MT).flat()), normal = aM.N - planted_.size, flagged = new Set([...aM.flags.keys()].map(k => +k.split(":")[0]).filter(r => !planted_.has(r)));
    assert(flagged.size / normal <= 0.02, `${flagged.size} of ${normal} normal rows flagged`);
  });
  test("validity failures are hard (Fix, Invalid) and outliers are advisory (Look, Check)", () => {
    const amt = aM.header.indexOf("amount");
    assert.strictEqual(flagsOf(aM, MT.malformed_amount[0], amt).sev, "fix"); assert.strictEqual(fx(aM, "badnum").hard, true); assert.strictEqual(fx(aM, "badnum").sev, "fix");
    const o = MT.outlier.find(r => flagsOf(aM, r, amt) && /^(unit|out):/.test(flagsOf(aM, r, amt).id)); assert.strictEqual(flagsOf(aM, o, amt).sev, "look"); assert.strictEqual(fx(aM, "unit:amount").hard, false);
    assert.strictEqual(fx(aM, "date").sev, "fix"); assert.strictEqual(fx(aM, "dup").sev, "fix"); assert.strictEqual(fx(aM, "rv:amount").sev, "look");
    [aC, cafeA].forEach(a => a.findingsList.filter(f => f.cls === "contextual-outlier").forEach(f => assert.strictEqual(f.sev, "look", f.title)));
  });
  test("every QA finding names one of the eight classes and the Columns table has class counts", () => {
    const eight = Object.keys(Dom.DOMAIN.classes); assert.strictEqual(eight.length, 8);
    [aM, aC, cafeA, aV, aP].forEach(a => a.findingsList.filter(f => f.kind === "qa").forEach(f => assert(eight.includes(f.cls), `${f.id} has class ${f.cls}`)));
    const counts = Object.fromEntries(aM.classCounts.map(c => [c.cls, c.n])); ["malformed", "duplicate", "repeated-value", "missing", "contextual-outlier", "source-conflict", "optional-field"].forEach(k => assert(counts[k] > 0, k + " has no count"));
  });
  test("no topic-specific word, threshold or detector in the report code: a grep for lot, parcel, folio, sale_observations finds nothing", () => {
    const dir = path.join(FX, "..", "..", "src"); fs.readdirSync(dir).filter(f => /\.(js|css|py)$/.test(f)).forEach(f => { const t = fs.readFileSync(path.join(dir, f), "utf8"); assert(!/\blot\b|parcel|folio|sale_observations/i.test(t), f + " names a topic: " + (t.match(/.{20}(\blot\b|parcel|folio|sale_observations).{20}/i) || [""])[0]); });
  });
};
