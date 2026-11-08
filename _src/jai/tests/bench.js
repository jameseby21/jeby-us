/* Benchmark: what does the generic report engine find on a file, what does a rule pack add or disagree with?   (CONS-0068)
       node _src/jai/tests/bench.js <path-to-csv> [--pack real-estate]
   Runs the report engine on the file with no pack and, with --pack, again with that pack from _src/jai/packs/. Prints finding counts by class (rows), the overlap between the
   two, the pack-only findings and the generic-only findings, each with up to three example reasons. The output never contains a row's text: addresses, ids and names are
   redacted from the reasons ("..."), row numbers are dropped, and only counts, column names and rule wording are printed. The CSV path is an argument and is never written anywhere.
   Plain Node, no install; reads the file, writes nothing. */
"use strict";
const fs = require("fs"), path = require("path");
const R = require("../src/report.js");
const args = process.argv.slice(2), pi = args.indexOf("--pack"), packName = pi >= 0 ? args[pi + 1] : null, file = args.find((a, i) => !a.startsWith("--") && (pi < 0 || i !== pi + 1));
if (!file) { console.log("usage: node _src/jai/tests/bench.js <path-to-csv> [--pack real-estate]"); process.exit(2); }
if (packName && !/^[a-z0-9-]+$/.test(packName)) { console.log("pack names are lower-case words, for example real-estate"); process.exit(2); }

// Reasons are rule wording plus numbers. Strip anything that could be a row's own text: quoted values, row numbers, the values of the first column.
function redact(text) {
  return String(text).replace(/<\/?b>/g, "").replace(/[“"'‘][^”"'’]{1,80}[”"'’]/g, "“…”").replace(/\b[Rr]ows? \d[\d,]*( (and|to|,) \d[\d,]*)*( and \d+ more)?/g, "row …").replace(/\(rows? [^)]*\)/g, "(rows …)")
    .replace(/Rows [\d, ]+(and \d+ more)?\.?/g, "Rows ….").replace(/\b\d{1,5} [A-Z][a-z]+ (St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Ln|Lane|Ct|Court|Way)\b/g, "…").replace(/\s+/g, " ").trim().slice(0, 220);
}
const rowsOf = (a, f) => (f.rows ? new Set(f.rows) : new Set());
function summarize(a) {
  const by = {}; a.findingsList.filter(f => f.kind === "qa" && f.rows && f.rows.length).forEach(f => { const k = f.cls || "unclassified"; (by[k] = by[k] || new Set()); f.rows.forEach(r => by[k].add(r)); });
  return by;
}
const text = fs.readFileSync(file, "utf8"); R.setLimits(10000, 12);
const data = { name: path.basename(file).replace(/[^A-Za-z0-9._-]/g, "_"), rows: R.parseDelimited(text) };
const t0 = Date.now(), generic = R.analyse(data), t1 = Date.now();
let packed = null, pack = null;
if (packName) { pack = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "packs", packName + ".json"), "utf8")); packed = R.analyse(data, { pack }); }

const out = []; const line = s => out.push(s);
line(`Benchmark of the report engine on a file with ${generic.N.toLocaleString("en-US")} rows and ${generic.cols.length} columns (${t1 - t0} ms generic).`);
line(`Columns by role: ${Object.entries(generic.cols.reduce((m, c) => (m[c.role] = (m[c.role] || 0) + 1, m), {})).map(([k, v]) => `${k} ${v}`).join(", ")}.`);
const gBy = summarize(generic), pf = packed ? packed.findingsList.filter(f => f.pack) : [];
const pBy = {}; pf.forEach(f => { (pBy[f.cls] = pBy[f.cls] || new Set()); f.rows.forEach(r => pBy[f.cls].add(r)); });
const classes = [...new Set([...Object.keys(gBy), ...Object.keys(pBy)])].sort();
line(""); line(`Rows flagged by class${pack ? "" : " (generic engine only; add --pack real-estate to compare)"}:`);
line(`  ${"class".padEnd(20)} ${"generic".padStart(8)} ${pack ? "pack".padStart(8) + " overlap".padStart(9) + " pack-only".padStart(10) + " generic-only".padStart(14) : ""}`);
classes.forEach(c => { const g = gBy[c] || new Set(), p = pBy[c] || new Set(), both = [...p].filter(r => g.has(r)).length;
  line(`  ${c.padEnd(20)} ${String(g.size).padStart(8)} ${pack ? String(p.size).padStart(8) + String(both).padStart(9) + String(p.size - both).padStart(10) + String(g.size - both).padStart(14) : ""}`); });
if (pack) {
  const gAll = new Set(Object.values(gBy).flatMap(s => [...s])), pAll = new Set(Object.values(pBy).flatMap(s => [...s])), both = [...pAll].filter(r => gAll.has(r)).length;
  line(`  ${"all classes".padEnd(20)} ${String(gAll.size).padStart(8)}${String(pAll.size).padStart(8)}${String(both).padStart(9)}${String(pAll.size - both).padStart(10)}${String(gAll.size - both).padStart(14)}`);
  line(""); line(`Pack "${pack.id}" (${pack.name}): ${packed.pack.found} of ${pack.checks.length} checks found something; ${packed.pack.skipped.length} could not run for lack of a column${packed.pack.skipped.length ? " (" + packed.pack.skipped.map(s => `${s.id} needs ${s.missing.join("/")}`).join("; ") + ")" : ""}.`);
  line(""); line("Pack findings:");
  pf.forEach(f => { const g = new Set(Object.values(gBy).flatMap(s => [...s])), rows = rowsOf(packed, f), both2 = [...rows].filter(r => g.has(r)).length;
    line(`  ${f.id.replace("pack:", "")} [${f.cls}, ${f.hard ? "hard" : "advisory"}]: ${rows.size} rows; ${both2} also flagged by the generic engine, ${rows.size - both2} pack-only`);
    const ex = packed.flags; const seen = new Set(), examples = [];
    [...rows].forEach(r => { for (const [k, fl] of ex) { if (fl.id === f.id && k.startsWith(r + ":")) { const t = redact(fl.why); if (!seen.has(t) && examples.length < 3) { seen.add(t); examples.push(t); } } } });
    examples.forEach(e => line(`      e.g. ${e}`)); });
  line(""); line("Generic findings the pack did not flag at all:");
  const pAll2 = new Set(Object.values(pBy).flatMap(s => [...s]));
  generic.findingsList.filter(f => f.kind === "qa" && f.rows && f.rows.length).forEach(f => { const only = f.rows.filter(r => !pAll2.has(r)).length; if (only) line(`  ${f.id} [${f.cls}]: ${f.rows.length} rows, ${only} generic-only`); });
}
line(""); line("Generic findings:");
generic.findingsList.forEach(f => { const ex = []; if (f.id) for (const [, fl] of generic.flags) { if (fl.id === f.id) { const t = redact(fl.why); if (!ex.includes(t) && ex.length < 3) ex.push(t); } }
  line(`  ${(f.id || "(timeline)").replace(/[:].*$/, "")} [${f.kind}${f.cls ? ", " + f.cls : ""}${f.hard != null ? ", " + (f.hard ? "hard" : "advisory") : ""}]: ${f.rows ? f.rows.length + " rows" : "no rows"} - ${redact(f.title)}`); ex.forEach(e => line(`      e.g. ${e}`)); });
console.log(out.join("\n"));
