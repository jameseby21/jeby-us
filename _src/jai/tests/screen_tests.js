/* Free report tests, part 5: screening columns before any statistics (CONS-0045). One test per class, plus the default (leave it out), the confirmation, the never-process classes, and that nothing flagged is processed.
   Loaded by run.js with its helpers. Synthetic data only: no real rows, ids or numbers are in this repository (the card numbers are the public test numbers). */
"use strict";
module.exports = function (h) {
  const { test, assert, R, Rec, load } = h;
  const fs = require("fs"), path = require("path");

  console.log("screening columns before any statistics (CONS-0045)");
  const csv = (header, rows) => ({ name: "screen.csv", rows: R.parseDelimited([header, ...rows].map(r => r.join(",")).join("\n") + "\n") });
  const fill = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  const scrOf = (header, rows, choice) => R.analyse(csv(header, rows), choice || {}).screen;
  const flaggedAs = (scr, name) => scr.flagged.find(f => f.name === name);
  const col3 = (name, mk) => scrOf(["name", name, "city"], fill(12, i => ["Cafe " + i, mk ? mk(i) : "v" + i, "Miami"]));

  test("licensed identifiers: td_linxID on the venues fixture is a licensing question, the report builds without it, and no value of it enters the analysis", () => {
    const a = R.analyse(load("venues.csv")), f = flaggedAs(a.screen, "td_linxID");
    assert(f && f.cls === "licensed" && f.never === false && /licen[cs]/i.test(f.why) && f.excluded === true, JSON.stringify(f));
    assert(!a.header.includes("td_linxID") && a.cols.length === 11 && !a.cols.some(c => c.name === "td_linxID"), a.header.join());
    assert.strictEqual(a.screen.excluded.length, 1); assert.strictEqual(a.screen.excluded[0].name, "td_linxID");
    assert(!JSON.stringify(R.cleanA(a)).includes("LX769928629"), "no value of the flagged column may be in the analysis");
  });
  test("licensed identifiers: TDLinx, D-U-N-S, MLS, credit-bureau and Nielsen columns are each flagged, and may be confirmed", () => {
    ["td_linx_id", "TDLinx", "DUNS number", "d-u-n-s", "mls_id", "MLS Number", "equifax_id", "Experian ID", "transunion", "nielsen_code", "NIQ id"].forEach(n => {
      const f = flaggedAs(col3(n, i => "X" + i), n); assert(f && f.cls === "licensed" && f.never === false, n); });
  });
  test("personal data: dates of birth, account numbers and health terms are flagged, and may be confirmed", () => {
    ["dob", "date_of_birth", "Birth Date", "bank_account_number", "routing_number", "iban", "diagnosis", "patient", "medication", "mrn"].forEach(n => {
      const f = flaggedAs(col3(n), n); assert(f && f.cls === "personal" && f.never === false, n); });
  });
  test("government ids are never processed: by column name, and by value when the name says nothing; there is no override", () => {
    ["ssn", "Social Security Number", "passport_number", "drivers_license", "national_id", "tax id"].forEach(n => { const f = flaggedAs(col3(n), n); assert(f && f.cls === "government-id" && f.never === true, n); });
    const scr = scrOf(["name", "ref", "city"], fill(30, i => ["Cafe " + i, `${100 + i}-${10 + i % 80}-${1000 + i}`, "Miami"])), f = flaggedAs(scr, "ref");
    assert(f && f.cls === "government-id" && f.by === "values", JSON.stringify(scr.flagged));
    const c = scrOf(["name", "ssn", "city"], fill(12, i => ["Cafe " + i, `${100 + i}-45-${1000 + i}`, "Miami"]), { confirm: ["ssn"] });
    assert(c.excluded.some(x => x.name === "ssn") && !c.confirmed.length, "a never-process class has no override");
  });
  test("card numbers are never processed: by column name, and by value when a column holds Luhn-valid card numbers", () => {
    ["card_number", "Credit Card", "cc_number", "cvv", "pan"].forEach(n => { const f = flaggedAs(col3(n), n); assert(f && f.cls === "card" && f.never === true, n); });
    const cards = ["4111111111111111", "5555555555554444", "378282246310005", "6011111111111117"];
    const scr = scrOf(["name", "ref", "city"], fill(24, i => ["Cafe " + i, cards[i % 4], "Miami"])), f = flaggedAs(scr, "ref"); assert(f && f.cls === "card" && f.by === "values", JSON.stringify(scr.flagged));
    const notCards = scrOf(["name", "ref", "city"], fill(24, i => ["Cafe " + i, String(4000000000000000 + i * 7), "Miami"])); assert(!flaggedAs(notCards, "ref"), "long numbers that fail the Luhn check are left alone");
  });
  test("credentials and tokens are never processed: by column name, and by value when a cell holds a key, a token or a private key", () => {
    ["password", "api_key", "access_token", "client_secret", "private key", "auth token"].forEach(n => { const f = flaggedAs(col3(n), n); assert(f && f.cls === "credential" && f.never === true, n); });
    const vals = ["AKIAIOSFODNN7EXAMPLE", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk", "sk_live_abcdefghijklmnop1234", "ghp_abcdefghijklmnopqrstuvwxyz0123456789"];
    vals.forEach(v => { const scr = scrOf(["name", "notes", "city"], fill(12, i => ["Cafe " + i, i === 5 ? v : "ok", "Miami"])), f = flaggedAs(scr, "notes"); assert(f && f.cls === "credential" && f.by === "values", v + ": " + JSON.stringify(scr.flagged)); });
  });
  test("minors are never processed: an age under 18 or a grade next to names; adults' ages and ages with no names are left alone; there is no override", () => {
    const kids = scrOf(["first_name", "last_name", "age", "city"], fill(30, i => ["Ana" + i, "Diaz", String(6 + i % 12), "Miami"])), f = flaggedAs(kids, "age");
    assert(f && f.cls === "minor" && f.never === true, JSON.stringify(kids.flagged)); assert(flaggedAs(kids, "first_name") && flaggedAs(kids, "last_name"), "the names beside a minor's age are left out too: " + kids.excluded.map(x => x.name));
    assert(flaggedAs(scrOf(["student_name", "grade", "city"], fill(30, i => ["Ana" + i, String(1 + i % 12), "Miami"])), "grade").cls === "minor");
    assert(!flaggedAs(scrOf(["first_name", "age", "city"], fill(30, i => ["Ana" + i, String(30 + i), "Miami"])), "age"), "ages of adults are not a minors question");
    assert(!flaggedAs(scrOf(["store", "age", "city"], fill(30, i => ["Cafe " + i, String(2 + i % 8), "Miami"])), "age"), "an age with no names beside it is the age of a store, not a minor");
    const c = scrOf(["first_name", "age"], fill(30, i => ["Ana" + i, String(6 + i % 12)]), { confirm: ["age", "first_name"] }); assert(c.excluded.some(x => x.name === "age") && !c.confirmed.length, "no override for minors");
  });
  test("a confirmed licensed column is kept and the confirmation is recorded; the default is to leave it out", () => {
    const d = load("venues.csv"), left = R.analyse(d), kept = R.analyse(d, { confirm: ["td_linxID"] });
    assert(left.header.length === 11 && kept.header.length === 12 && kept.header.includes("td_linxID"), kept.header.join());
    assert.strictEqual(kept.screen.confirmed.length, 1); assert.strictEqual(kept.screen.confirmed[0].name, "td_linxID"); assert.strictEqual(kept.screen.excluded.length, 0);
  });
  test("flagged columns do not use up the twelve-column limit, and the table and the export are built without them", () => {
    const hd = ["a", "b", "c", "d", "e", "f", "ssn", "g", "h", "i", "j", "k", "l"], d = csv(hd, fill(12, i => hd.map((_, j) => (j === 6 ? `${100 + i}-45-${1000 + i}` : "v" + ((i + j) % 4)))));
    const a = R.analyse(d); assert.strictEqual(a.header.join(""), "abcdefghijkl"); assert.strictEqual(a.truncated, false, "twelve kept columns fit the limit");
    const s = R.makeStore(d, a); assert.strictEqual(s.rows[0].length, 12); const out = Rec.exportCSV(s); assert(!/ssn|45-/.test(out), "the export has no flagged column: " + out.split("\n")[0]);
  });
  test("an unflagged file is untouched: only venues is flagged among the fixtures", () => {
    ["ledger_header.csv", "ledger_headerless.csv", "ledger_title.csv", "numeric_header.csv", "records_mixed.csv", "sales_clean.csv", "sales_county.csv", "sales_planted.csv", "sales_roles.csv"].forEach(n => {
      const a = R.analyse(load(n)); assert.strictEqual(a.screen.flagged.length, 0, n + ": " + JSON.stringify(a.screen.flagged)); });
    assert.strictEqual(R.analyse({ name: "cafe", rows: R.cafeSample() }).screen.flagged.length, 0);
  });
  test("screening stays in the browser: the pattern file makes no network call, and no value of a flagged column reaches anything the analysis returns", () => {
    const code = fs.readFileSync(path.join(__dirname, "../src/screening.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert(!/\bfetch\b|XMLHttpRequest|sendBeacon|WebSocket|importScripts|\bimport\s*\(|EventSource/.test(code), "screening.js must not talk to a network");
    const secret = "SENTINEL-9f3a", d = csv(["name", "api_key", "city"], fill(12, i => ["Cafe " + i, secret + i, "Miami"])), a = R.analyse(d);
    assert(!JSON.stringify(R.cleanA(a)).includes(secret), "a flagged column's values must not appear in the analysis");
    assert(!JSON.stringify(R.pickNotable(a, R.makeStore(d, a))).includes(secret)); assert(!R.makeStore(d, a).rows.some(r => r.join().includes(secret)), "or in the table");
  });
  test("the pattern list is a data file, one line per pattern: each has an id, a class and a reason; each class has a label and says whether it can be confirmed", () => {
    const S = require("../src/screening.js"), ids = new Set(); assert(S.SCREEN.patterns.length >= 25, S.SCREEN.patterns.length);
    S.SCREEN.patterns.forEach(p => { assert(p.id && !ids.has(p.id) && S.SCREEN.classes[p.cls] && p.why && (p.name || p.values), p.id); ids.add(p.id); });
    ["licensed", "personal", "government-id", "card", "credential", "minor"].forEach(k => assert(S.SCREEN.classes[k] && S.SCREEN.classes[k].label && typeof S.SCREEN.classes[k].never === "boolean" && S.SCREEN.patterns.some(p => p.cls === k), k));
    assert.deepStrictEqual(Object.keys(S.SCREEN.classes).filter(k => S.SCREEN.classes[k].never).sort(), ["card", "credential", "government-id", "minor"]);
  });
};
