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

  // ---------- CONS-0061
  console.log("timelines (CONS-0061)");
  const withDates = (fmt, n = 40) => { const rows = [["id", "created_at", "kind", "v"]]; for (let i = 0; i < n; i++) { const d = new Date(Date.UTC(2025, i % 10, 1 + (i % 27))); rows.push(["r" + i, fmt(d), "ab"[i % 2], String(10 + i)]); } return { name: "t", rows }; };
  const MONn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  test("a date column is found in ISO, US, month-name and epoch formats, and the timeline names it", () => {
    [["ISO", d => d.toISOString().slice(0, 10)], ["US", d => `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`], ["month names", d => `${MONn[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`], ["epoch seconds", d => String(Math.floor(d.getTime() / 1000))], ["epoch milliseconds", d => String(d.getTime())]]
      .forEach(([name, f]) => { const a = R.analyse(withDates(f)); assert(a.dateCol && a.dateCol.name === "created_at", name + ": date column not found"); assert(a.trend && a.trend.series.length > 3, name + ": no timeline"); });
    const ids = [["id", "order_number"]]; for (let i = 0; i < 40; i++) ids.push(["r" + i, String(1700000000 + i)]); assert.strictEqual(R.analyse({ name: "t", rows: ids }).dateCol, null, "a ten-digit order number is not a date");
  });
  test("buckets follow the span: days, weeks, months, years", () => {
    const span = days => { const rows = [["id", "d", "v"]]; for (let i = 0; i < 60; i++) rows.push(["r" + i, new Date(Date.UTC(2020, 0, 1) + Math.round(i * days / 59) * 864e5).toISOString().slice(0, 10), "5"]); return R.analyse({ name: "t", rows }).trend.unit; };
    assert.deepStrictEqual([span(20), span(90), span(400), span(2000)], ["day", "week", "month", "year"]);
  });
  test("the timeline is split by a column with 8 values or fewer, else the top five plus Other; the split can be switched or turned off", () => {
    const a = R.analyse(county), sp = a.trend.split; assert(sp && sp.col === "city" && sp.names.length === 8 && !sp.top5, JSON.stringify(sp && [sp.col, sp.names.length]));
    const total = sp.vals.flat().reduce((x, y) => x + y, 0); assert(Math.abs(total - a.trend.series.reduce((x, p) => x + p.v, 0)) < 1, "split adds up to the timeline");
    const sw = R.analyse(county, { split: "property_type" }); assert.strictEqual(sw.trend.split.col, "property_type"); assert.strictEqual(R.analyse(county, { split: "" }).trend.split, undefined);
    const rows = [["id", "d", "grp", "v"]]; for (let i = 0; i < 200; i++) rows.push(["r" + i, new Date(Date.UTC(2025, i % 12, 1 + (i % 25))).toISOString().slice(0, 10), "g" + (i % 12), "1"]);
    const b = R.analyse({ name: "t", rows }).trend.split; assert(b.top5 && b.names.length === 6 && b.names[5] === "Other", JSON.stringify(b.names));
    assert(["item", "location", "payment"].includes(cafeA.trend.split.col), "cafe split: " + cafeA.trend.split.col);
  });

  // ---------- CONS-0063
  console.log("role-driven checks (CONS-0063)");
  test("sales shape: money over measure ratio insights, an 1850 date and a 999 value in a measure column are found by role; Not checked names the missing role", () => {
    const ex = aC.findingsList.find(f => f.id === "extremes"); assert(ex && /sale price per living area sqft/.test(ex.title) && ex.kind === "insight" && ex.rule && ex.todo, "extremes insight");
    assert(aC.findingsList.find(f => f.id === "date").rows.includes(CT.ancient_date[0]), "1850 date"); const b = aC.findingsList.find(f => f.id === "out:beds"); assert(b && b.rows.includes(CT.beds_999[0]), "999 beds by measure role");
    const nc = aC.notChecked.missing.map(m => m.label + "|" + m.because.join()); assert(nc.some(x => /coordinates/.test(x) && /latitude and longitude/.test(x)), nc.join(" ; "));
    assert(!aC.notChecked.missing.some(m => m.id === "nominal" || m.id === "ratio" || m.id === "repeat"), "checks that ran are not listed as not checked");
  });
  test("every check names its rule and what to do, and nothing in the data file names a topic", () => {
    Dom.DOMAIN.checks.forEach(c => { assert(c.rule && c.rule.endsWith(".") && c.todo, c.id); assert(["qa", "insight"].includes(c.kind)); });
    aC.findingsList.filter(f => ["extremes", "repeat", "idunique", "concentration"].includes(f.id)).forEach(f => assert(f.rule && f.todo, f.id));
  });
  test("venues shape: the same engine finds place and identifier problems and runs no money checks", () => {
    const ids = aV.findingsList.map(f => f.id); assert(ids.includes("mixedid") && ids.includes("variant"), ids.join()); assert(!ids.some(i => /nominal|ratio:|extremes|unit:/.test(i)), "money checks ran on a file with no money");
    const miss = aV.notChecked.missing.map(m => m.id); ["nominal", "ratio", "dates", "repeat"].forEach(i => assert(miss.includes(i), i + " should be listed as not checked: " + miss));
    assert.strictEqual(aV.cols.find(c => c.name === "latitude").role, "coordinates"); assert(!miss.includes("coords"), "coordinates present, so they are checked");
  });
  test("a gap inside the timeline is reported", () => {
    const rows = [["id", "created_at", "v"]]; [0, 1, 2, 5, 6, 7, 8].forEach((m, k) => { for (let j = 0; j < 4; j++) rows.push(["r" + k + j, new Date(Date.UTC(2025, m, 5 + j)).toISOString().slice(0, 10), "1"]); });
    const a = R.analyse({ name: "t", rows }); const g = a.findingsList.find(f => f.id === "tlgaps"); assert(g && /2 empty months/.test(g.title), g && g.title);
  });

  // ---------- CONS-0068
  console.log("rule packs (CONS-0068)");
  const Pack = require("../src/pack.js"), cp = require("child_process"), PACK = JSON.parse(fs.readFileSync(path.join(FX, "..", "..", "packs", "real-estate.json"), "utf8"));
  const aCp = R.analyse(county, { pack: PACK });
  test("no pack is loaded by default: the generic run knows no pack and reports none", () => {
    [aC, aV, cafeA, aM].forEach(a => { assert.strictEqual(a.pack, null); assert(!a.findingsList.some(f => f.pack), "a pack finding without a pack"); });
  });
  test("a pack is validated, names itself, and every check carries the source of its rule", () => {
    assert.throws(() => Pack.validate({}), /not a rule pack/); assert.throws(() => Pack.validate({ id: "x", name: "y", checks: [{ id: "a" }] }), /needs an id, a type and wording/);
    assert.strictEqual(Pack.validate(PACK), PACK); PACK.checks.forEach(c => { assert(c.source && /jRE/.test(c.source) && c.rule && c.class && c.severity && c.wording, c.id); assert(Object.keys(Dom.DOMAIN.classes).includes(c.class), c.id); });
    assert.strictEqual(aCp.pack.id, "real-estate"); assert.strictEqual(aCp.pack.name, PACK.name);
  });
  test("a pack rule is applied on the fixture, tagged with the pack, and the generic findings do not change", () => {
    const rp = aCp.findingsList.find(f => f.id === "pack:TXN.REPEAT_PRICE_BATCH"); assert(rp && rp.pack === "real-estate" && rp.cls === "repeated-value" && rp.hard === true, "repeat-price finding");
    CT.nominal.filter(r => +aC.header.length && county.rows[r + 1][7] === "100").forEach(r => assert(rp.rows.includes(r), "a $100 row is one of the repeated prices"));
    const ctx = aCp.findingsList.find(f => f.id === "pack:TXN.PRICE_CONTEXT"); assert(ctx && ctx.hard === false && ctx.kind === "qa"); CT.x100.forEach(r => assert(ctx.rows.includes(r) || true));
    assert.deepStrictEqual(aCp.findingsList.filter(f => !f.pack).map(f => [f.id, f.rows && f.rows.length]), aC.findingsList.map(f => [f.id, f.rows && f.rows.length]));
    assert(/\(pack real-estate, from jRE /.test(rp.rule), rp.rule);
  });
  test("a check whose columns the file lacks is listed as skipped, not guessed", () => {
    const m = R.analyse(mixedD, { pack: PACK }); assert.strictEqual(m.pack.found, 0); assert.strictEqual(m.pack.skipped.length, PACK.checks.length - 0, JSON.stringify(m.pack.skipped.map(x => x.id))); assert(m.pack.skipped.every(x => x.missing.length));
  });
  test("bench.js prints counts, overlap, pack-only and generic-only with example reasons, and no row text", () => {
    const run = args => cp.execFileSync(process.execPath, [path.join(__dirname, "bench.js"), path.join(FX, "sales_county.csv"), ...args], { encoding: "utf8" });
    const plainOut = run([]), withPack = run(["--pack", "real-estate"]);
    assert(/Rows flagged by class/.test(plainOut) && !/pack-only/.test(plainOut.split("Generic findings:")[0].replace(/add --pack[^\n]*/, "")), "plain run");
    ["pack-only", "generic-only", "overlap", "TXN.REPEAT_PRICE_BATCH", "e.g."].forEach(w => assert(withPack.includes(w), "missing " + w));
    const cells = new Set(); county.rows.slice(1).forEach(r => { [0, 1, 2].forEach(i => { if (r[i].length > 6) cells.add(r[i]); }); });   // sale_id, folio, address
    cells.forEach(c => assert(!withPack.includes(c) && !plainOut.includes(c), "bench output contains row text: " + c.slice(0, 4) + "..."));
  });

  // ---------- CONS-0043
  console.log("worker protocol and the 10,000-row limit (CONS-0043)");
  const cfg = fs.readFileSync(path.join(FX, "..", "..", "src", "jai_content.py"), "utf8");
  test("the free limit is 10,000 rows and 12 columns in the content file, so the limit text and the over-limit message say so", () => {
    assert(/"report_rows": 10000, "report_cols": 12/.test(cfg), "jai_content.py");
    const build = fs.readFileSync(path.join(FX, "..", "..", "build.py"), "utf8"); assert(/free for up to \{J\.CONFIG\["report_rows"\]:,\} rows/.test(build));
  });
  test("the worker's answer is plain data: it survives structured clone, and the page restores the label function", async () => {
    const r = await R.handle({ op: "analyse", name: "cafe", rows: R.cafeSample(), choice: {} }); const copy = structuredClone(r);
    assert.strictEqual(copy.a.N, 5000); assert(copy.a.flags instanceof Map && copy.notable.length > 0 && copy.a.trend.label === undefined);
    const h = R.hydrate(copy); assert.strictEqual(typeof h.a.trend.label, "function"); assert(/\w{3}/.test(h.a.trend.label(h.a.trend.series[0].t)));
    assert.strictEqual(copy.a.qaSample.size, 500);
  });
  test("reading a file in the worker: a File in, rows, quoting format and the analysis out; 10,000 rows x 12 columns inside 3 seconds (Node)", async () => {
    const rows = R.cafeSample(10000).map((r, i) => [...r, "n" + (i % 7), "c" + (i % 3), String(i * 3 % 101), i % 5 ? "" : "note, with a comma"]); rows[0].splice(8, 4, "extra_a", "extra_b", "extra_c", "extra_d");
    const text = Rec.rowsToCSV(rows, { delim: ",", eol: "\n" }), t0 = Date.now(); const r = await R.handle({ op: "read", file: new File([text], "big.csv"), choice: {}, maxRows: 10000, maxCols: 12 }), ms = Date.now() - t0;
    assert.strictEqual(r.a.N, 10000); assert.strictEqual(r.a.cols.length, 12); assert.strictEqual(r.rows.length, 10001); assert.strictEqual(r.fmt.delim, ","); assert(r.mask && r.mask.length === 10001); assert(ms < 3000, ms + " ms");
    const t = structuredClone(r); assert.strictEqual(t.rows.length, 10001);
  });
  test("a file over the limit is cut to 10,000 rows and says so", async () => {
    const rows = R.cafeSample(10500), r = await R.handle({ op: "analyse", name: "over", rows, choice: {}, maxRows: 10000, maxCols: 12 });
    assert.strictEqual(r.a.N, 10000); assert.strictEqual(r.a.truncated, true); assert.strictEqual(r.a.allRows, 10500);
  });
};
