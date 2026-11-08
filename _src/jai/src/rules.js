/* JA Insights free report: the data the engine reads, in one place. DATA ONLY, no logic: edit a list here and the report changes (CONS-0070 to 0074).
   Sections so far: HEADER (is the first row a header, and what are the columns called when it is not), ROLES (which numbers are labels, not quantities) and UNITS (which measure columns carry a unit a ratio may use) GATE (the checks every insight passes before it is shown) and LEDGER (what a bank or card statement looks like and what is asked of it). Name normalization (NORMALIZE) is added by CONS-0073.
   Runs in the page, the worker and Node (node _src/jai/tests/run.js). Nothing is uploaded. */
(function (root) {
  "use strict";

  // =====================================================================================================
  // HEADER (CONS-0071)
  const HEADER = {
    maxTitleRows: 10,          // rows above the header (a report title, an account line) are skipped when they have fewer than half the cells of a typical row
    sample: 200,               // rows below the first row that are compared with it
    nameMaxLength: 40,         // a column name longer than this is a sentence, not a name
    nameMaxWords: 5,           // five or more words is a sentence
    wordsWithNumbers: 3,       // three or more words with two or more bare numbers in them is a value ("KROGER 710 COLUMBUS IN 50910")
    yearHeader: [1800, 2100],  // a header made of years is a header
    moneyColumn: 0.8,          // share of a number column that must look like money (cents, or a $) to be named Amount or Balance
    descriptionMinLength: 10,  // average text length of a Description column
    typeMaxDistinct: 12,       // a Type column has few distinct values
    balanceMatch: 0.5,         // share of consecutive rows where previous balance plus amount equals this balance
    // The names given to columns of a file with no header row. Anything else is "Column N".
    names: { date: "Date", amount: "Amount", balance: "Balance", description: "Description", type: "Type" },
  };

  // =====================================================================================================
  // ROLES (CONS-0070): numbers that are labels, not quantities. A year, a code or an id is never a measure, never a ratio denominator and never in the extremes.
  // Names are compared lower-case with spaces, dashes and underscores treated alike. These apply to number columns only; the first match wins.
  const ROLES = {
    byName: [
      ["phone", /phone|(^|[_\s-])(tel|fax|mobile|cell)($|[_\s-])/],
      ["year", /(^|[_\s-])(year|yr)($|[_\s-])|yearbuilt|built|founded|(^|[_\s-])yob($|[_\s-])/],
      ["code", /(^|[_\s-])(code|routing|acct|account|naics|sic|fips)($|[_\s-])/],
      ["identifier", /(^|[_\s-])(sku|upc|ean|isbn|vin|order|invoice|ticket|case|record|txn|transaction)($|[_\s-])/],
    ],
    year: { min: 1800, max: 2100, share: 0.9, maxDistinct: 300 },   // a column whose values are mostly whole numbers in this range is a year
    sequence: { minRows: 10, distinct: 0.98, ordered: 0.95 },        // whole numbers, all different, only ever rising (or falling) down the file: a row number, not a quantity
    phone: /^\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
    userRoles: { number: ["money", "measure", "year", "code", "identifier", "category", "text"], date: ["date", "category", "text"], other: ["text", "category", "identifier", "code"] },
  };

  // =====================================================================================================
  // UNITS (CONS-0070, 0074): a ratio is money over a measure, and only when the measure carries a unit. The first matching rule names the unit.
  const UNITS = [
    { re: /sq(uare)?[\s_-]*(f(ee|oo)?t|ft)|sqft|living[\s_-]*area|floor[\s_-]*area|(^|[\s_-])area($|[\s_-])/i, per: "square foot", kind: "area" },
    { re: /acre/i, per: "acre", kind: "area" },
    { re: /(^|[\s_-])(qty|quantity|units?|items?|pieces|pcs)($|[\s_-])/i, per: "unit", kind: "quantity" },
    { re: /(^|[\s_-])(hours?|hrs?)($|[\s_-])/i, per: "hour", kind: "time" },
    { re: /(^|[\s_-])(miles?|mi)($|[\s_-])/i, per: "mile", kind: "distance" },
    { re: /(^|[\s_-])(km|kilometers?)($|[\s_-])/i, per: "kilometer", kind: "distance" },
    { re: /(^|[\s_-])(lbs?|pounds?)($|[\s_-])/i, per: "pound", kind: "weight" },
    { re: /(^|[\s_-])(kg|kilograms?)($|[\s_-])/i, per: "kilogram", kind: "weight" },
  ];

  // =====================================================================================================
  // GATE (CONS-0074): every candidate insight carries its justification (roles, units, n, method) and passes these checks before it is shown. A failed candidate is
  // listed under "Not shown" with the reason. The functions that run the checks are in domain.js (GATE_FN), one per id here; the numbers are here.
  const GATE = {
    minimums: { extremes: 30, share: 3, concentration: 5, months: 3 },   // non-nominal rows for a top-and-bottom; groups for a share; groups for a concentration
    checks: [
      { id: "ratio-unit", label: "ratios have a unit", rule: "A ratio is money over a measure that carries a unit (area, quantity, hours, miles, weight) and is named price per <unit>; never per year, per zip code or per id." },
      { id: "min-rows", label: "top and bottom has enough rows", rule: "A top-and-bottom list needs at least 30 non-nominal rows." },
      { id: "min-groups", label: "a share or concentration has enough groups", rule: "A share insight needs at least 3 groups and a concentration insight at least 5." },
      { id: "min-periods", label: "a by-month insight has enough months", rule: "A by-month insight needs at least 3 months of data, and a weekday pattern at least 8 weeks and 60 outflow rows." },
      { id: "label-vocab", label: "Rows versus Total", rule: "Rows names a count of rows; Total <column> is used only for a sum of that column." },
      { id: "count-not-money", label: "a count is not money", rule: "A count is never shown with a money sign, and a money value always carries one." },
      { id: "value-name", label: "no column named by a value", rule: "A finding never names a column whose name looks like a value (a number, a date, a sentence); the column is named by its role instead." },
    ],
  };

  // =====================================================================================================
  // LEDGER (CONS-0072): a date, a signed money column and a description (often a type and a running balance) is a ledger, kind "transactions". Signs are direction, not quality.
  const LEDGER = {
    minRows: 15,                 // fewer rows than this is not a statement
    minNegativeShare: 0.05,      // at least this share of the amounts is negative (money out), or a type column says debit and credit
    descriptionMinLength: 8,     // the description column holds text this long on average
    descriptionName: /description|memo|merchant|payee|details?|narrative|name/i,
    directionWords: { out: /debit|withdraw|purchase|payment|charge|fee|payout/i, in: /credit|deposit|refund|interest|payroll/i },   // when the amounts are not signed, a type column says which way they go
    recurring: { minCount: 3, intervalShare: 0.7, toleranceDays: 3, toleranceShare: 0.15, minDays: 6, maxDays: 400, amountTolerance: 0.005 },   // same merchant, same amount, regular interval
    gap: { minDays: 14, factor: 5 },              // a gap in the dates is longer than this many days and this many typical gaps
    weekday: { minWeeks: 8, minOutflowRows: 60, standsOut: 1.4 },   // a weekday pattern needs eight weeks of data; it stands out at 1.4 times an even share
    topMerchants: 10, largest: 5, minMonths: 3,
    balanceTolerance: 0.005,
    off: ["nominal", "ratio", "extremes", "repeat", "dupnear", "concentration"],   // checks that do not run on a ledger, by design
  };

  const API = { HEADER, ROLES, UNITS, GATE, LEDGER };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.JAIRules = API;
})(typeof self !== "undefined" ? self : this);
