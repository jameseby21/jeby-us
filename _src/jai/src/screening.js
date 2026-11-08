/* JA Insights free report: SCREENING COLUMNS BEFORE ANY STATISTICS (CONS-0045).
   Before a value enters the report, every column is screened for what the report must not process: licensed identifiers (a data vendor's ids), personal data,
   government ids, card numbers, credentials and anything about minors. A flagged column is left out by default and the report says so. Some classes can be kept
   when the visitor confirms they hold the rights; the classes marked never have no override at all.
   THE PATTERN LIST IS THE FIRST BLOCK, SCREEN: one line per pattern, with its class and the reason shown to the visitor. Add a line to add a pattern; nothing else changes.
     name     a regular expression tested against the column name after it is lower-cased with camelCase split and every run of other characters made one space
              ("td_linxID" is "td linx id"); \b works on whole words
     values   a value test, by key (ssn, luhn, secret, grade): the column's values are tested when its name says nothing
     near     "names": the pattern only counts when a column of people's names is beside it (age, grade)
   Pure logic, no page. It reads column names and a sample of values only to decide, keeps only the names of what it flagged, and never sends anything anywhere:
   it runs in the browser, in the worker and in Node (node _src/jai/tests/run.js). The same list is the reference for the standards rule STD-0041. */
(function (root) {
  "use strict";

  // =====================================================================================================
  // SCREEN: edit here
  const SCREEN = {
    classes: {
      licensed: { label: "Licensed identifier", never: false, means: "an identifier owned by a data vendor; using or sharing it may need a licence" },
      personal: { label: "Personal data", never: false, means: "data about a person that is private by law or by custom" },
      "government-id": { label: "Government ID", never: true, means: "a number a government issues to a person" },
      card: { label: "Card number", never: true, means: "a payment card number or its security code" },
      credential: { label: "Credential or token", never: true, means: "a password, key or token that opens something" },
      minor: { label: "Minor", never: true, means: "a record about a child" },
    },
    patterns: [
      // licensed identifiers: the visitor may confirm they hold the rights
      { id: "tdlinx", cls: "licensed", name: /\btd ?linx/, why: "TDLinx is a retail-outlet identifier owned by a data vendor (NIQ). Using or sharing it generally needs a licence." },
      { id: "duns", cls: "licensed", name: /\b(duns|d u n s|dun ?(and|&)? ?bradstreet)\b/, why: "A D-U-N-S number is a business identifier owned by Dun & Bradstreet and licensed to its customers." },
      { id: "mls", cls: "licensed", name: /\bmls\b|multiple listing/, why: "An MLS id belongs to a listing service whose members' terms limit how it may be used and shared." },
      { id: "credit-bureau", cls: "licensed", name: /\b(equifax|experian|trans ?union)\b/, why: "A credit-bureau id comes from a licensed credit file and is covered by the bureau's terms and by consumer-reporting law." },
      { id: "nielsen", cls: "licensed", name: /\b(nielsen|niq)\b/, why: "A Nielsen or NIQ code is a licensed market-data identifier." },
      { id: "property-vendor", cls: "licensed", name: /\b(corelogic|attom|costar|loopnet|zpid)\b/, why: "A property-data vendor's id (CoreLogic, ATTOM, CoStar, Zillow) is licensed with that vendor's data." },
      // personal data: the visitor may confirm they hold the rights
      { id: "dob", cls: "personal", name: /\b(dob|date of birth|birth date|birthdate|birthday|born)\b/, why: "A date of birth identifies a person and is private data in most places." },
      { id: "bank-account", cls: "personal", name: /\b(bank account|account (number|no|num|nbr)|acct (number|no|num|nbr)|routing( number| no)?|iban|swift( code)?|sort code)\b/, why: "A bank account or routing number gives access to a person's money." },
      { id: "health", cls: "personal", name: /\b(diagnosis|diagnoses|icd ?(9|10)?( code)?|patient|medical record|mrn|medication|prescription|health (condition|status|plan)|disability|allerg\w*|hiv|pregnan\w*)\b/, why: "Health information is private by law in most places (in the U.S., HIPAA covers some of it)." },
      { id: "sensitive-traits", cls: "personal", name: /\b(ethnicity|religion|sexual orientation|political party|union member\w*)\b/, why: "A person's ethnicity, religion, orientation or politics is a sensitive category of personal data." },
      // government ids: never processed
      { id: "ssn", cls: "government-id", name: /\b(ssn|social security( number| no)?|itin)\b/, why: "A social security number must not be processed here." },
      { id: "passport", cls: "government-id", name: /\bpassport( number| no| num)?\b/, why: "A passport number must not be processed here." },
      { id: "license", cls: "government-id", name: /\b(drivers? licen[cs]e|dl number|dl no|state id)\b/, why: "A driver's licence or state id number must not be processed here." },
      { id: "national-id", cls: "government-id", name: /\b(national id|national insurance|tax id|taxpayer id|tax payer id|nino)\b/, why: "A national or tax id number must not be processed here." },
      { id: "ssn-values", cls: "government-id", values: "ssn", why: "Most values in this column are shaped like social security numbers (three digits, two digits, four digits)." },
      // card numbers: never processed
      { id: "card-number", cls: "card", name: /\b(card (number|no|num|nbr)|credit card|debit card|cc (number|no|num)|ccnum|payment card)\b/, why: "A payment card number must not be processed here." },
      { id: "card-code", cls: "card", name: /\b(cvv|cvc|cvn|card verification|security code)\b/, why: "A card security code must not be processed here." },
      { id: "pan", cls: "card", name: /\b(pan|primary account number)\b/, why: "A primary account number is a payment card number and must not be processed here." },
      { id: "card-values", cls: "card", values: "luhn", why: "Most values in this column are 13 to 19 digits that pass the card-number check, so they look like payment card numbers." },
      // credentials and tokens: never processed
      { id: "password", cls: "credential", name: /\b(password|passwd|pwd|passphrase|passcode)\b/, why: "A password must not be processed here." },
      { id: "secret", cls: "credential", name: /\b(secret|client secret|security answer)\b/, why: "A secret must not be processed here." },
      { id: "api-key", cls: "credential", name: /\b(api ?key|access key|private key|secret key|signing key|ssh key)\b/, why: "A key that opens a service must not be processed here." },
      { id: "token", cls: "credential", name: /\b(token|bearer|otp|credentials?)\b/, why: "A token or credential must not be processed here." },
      { id: "secret-values", cls: "credential", values: "secret", why: "A value in this column looks like a key, a token or a private key." },
      // minors: never processed
      { id: "minor-age", cls: "minor", name: /^(age|age in years|student age|child age)$/, near: "names", under: 18, why: "An age under 18 beside names suggests records about children." },
      { id: "minor-grade", cls: "minor", name: /^(grade|grade level|school grade|school year)$/, near: "names", values: "grade", why: "A school grade beside names suggests records about children." },
      { id: "minor-word", cls: "minor", name: /\b(student|pupil|juvenile|minor|child|children|kindergarten)\b/, near: "names", why: "A column about students or children beside names suggests records about children." },
    ],
    // a column of people's names (what "beside names" means for the minor patterns)
    personName: /\b(first|last|middle|given|sur|full|legal|student|child|parent|guardian|patient|customer|client|contact|employee|member|person) ?names?\b|\b(firstname|lastname|fname|lname)\b|^student$/,
    sample: 400,        // values tested per column for the value patterns
    secretScan: 1000,   // rows scanned for a credential-shaped value in any column
  };

  // =====================================================================================================
  // The value tests the patterns name by key
  const luhn = d => { let sum = 0, alt = false; for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; } return sum % 10 === 0; };
  const SECRET_RE = [/^AKIA[0-9A-Z]{16}$/, /^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.?[A-Za-z0-9_-]*$/, /^(sk|pk|rk)_(live|test)_[A-Za-z0-9]{10,}/, /^gh[pousr]_[A-Za-z0-9]{30,}$/, /^xox[baprs]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /^AIza[0-9A-Za-z_-]{30,}$/];
  const VALUE_TESTS = {
    ssn: vals => vals.length >= 5 && vals.filter(v => /^\d{3}-\d{2}-\d{4}$/.test(v)).length / vals.length >= 0.6,
    luhn: vals => { if (vals.length < 5) return false; const ok = vals.filter(v => { const d = v.replace(/[ -]/g, ""); return /^\d{13,19}$/.test(d) && luhn(d); }); return ok.length / vals.length >= 0.6; },
    secret: vals => vals.some(v => v.length >= 16 && SECRET_RE.some(re => re.test(v))),
    grade: vals => vals.length >= 5 && vals.filter(v => /^(k|pk|pre-?k|kindergarten|[1-9]|1[0-2])(st|nd|rd|th)?( grade)?$|^(freshman|sophomore|junior|senior)$/i.test(v)).length / vals.length >= 0.6,
  };
  const normName = n => " " + String(n).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " ";
  const nm = n => normName(n).trim();

  // =====================================================================================================
  // screen(names, rows, { confirm }): names are the column names, rows the data rows (cells in the same order). Returns what was flagged and what was left out; it holds names, never values.
  function screen(names, rows, opts = {}) {
    const confirm = new Set((opts.confirm || []).map(String)), flagged = [], flaggedAt = new Set();
    const add = (i, p, by, extra) => { if (flaggedAt.has(i)) return; flaggedAt.add(i); const c = SCREEN.classes[p.cls];
      flagged.push({ i, name: names[i], cls: p.cls, label: c.label, never: c.never, why: extra || p.why, rule: p.id, by }); };
    const norm = names.map(nm), sample = i => { const out = []; for (let r = 0; r < rows.length && out.length < SCREEN.sample; r++) { const v = rows[r][i]; if (v != null && String(v).trim() !== "") out.push(String(v).trim()); } return out; };
    const nameCols = norm.map((n, i) => (SCREEN.personName.test(n) ? i : -1)).filter(i => i >= 0);
    // 1. by the column's name
    norm.forEach((n, i) => { for (const p of SCREEN.patterns) { if (!p.name || !p.name.test(n)) continue;
      if (p.near === "names") { if (!nameCols.some(j => j !== i)) continue;   // an age or a grade with no names beside it is not a record about a person
        const vals = sample(i); if (p.under != null) { const ages = vals.map(Number).filter(x => !isNaN(x) && x >= 0 && x <= 120); if (!ages.length || !ages.some(x => x < p.under)) continue; }
        if (p.values && !VALUE_TESTS[p.values](vals)) continue; }
      add(i, p, "name"); break; } });
    // 2. by the column's values, when the name says nothing
    SCREEN.patterns.filter(p => p.values && !p.name).forEach(p => { names.forEach((_, i) => { if (flaggedAt.has(i)) return; if (p.values === "secret") return; if (VALUE_TESTS[p.values](sample(i))) add(i, p, "values"); }); });
    const secretP = SCREEN.patterns.find(p => p.values === "secret");
    if (secretP) { const n = Math.min(rows.length, SCREEN.secretScan); for (let r = 0; r < n; r++) { const row = rows[r]; for (let i = 0; i < names.length; i++) { if (flaggedAt.has(i)) continue; const v = row[i]; if (v && v.length >= 16 && VALUE_TESTS.secret([String(v).trim()])) add(i, secretP, "values"); } } }
    // 3. the names beside a minor's age or grade are left out with it
    if (flagged.some(f => f.cls === "minor")) { const p = SCREEN.patterns.find(x => x.id === "minor-word"); nameCols.forEach(i => add(i, p, "names", "A name beside a child's age or grade identifies the child.")); }
    flagged.sort((a, b) => a.i - b.i);
    flagged.forEach(f => { f.confirmed = !f.never && confirm.has(f.name); f.excluded = !f.confirmed; });
    return { flagged, excluded: flagged.filter(f => f.excluded).map(({ i, name, cls, label, never, why, by, rule }) => ({ i, name, cls, label, never, why, by, rule })),
      confirmed: flagged.filter(f => f.confirmed).map(({ i, name, cls, label, why, rule }) => ({ i, name, cls, label, why, rule })), excludedIdx: flagged.filter(f => f.excluded).map(f => f.i) };
  }

  const API = { SCREEN, screen, VALUE_TESTS };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.JAIScreening = API;
})(typeof self !== "undefined" ? self : this);
