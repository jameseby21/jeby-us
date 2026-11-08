/* JA Insights free report: the data the engine reads, in one place. DATA ONLY, no logic: edit a list here and the report changes (CONS-0071, 0072, 0073, 0074).
   Sections so far: HEADER (is the first row a header, and what are the columns called when it is not). Later tickets add UNITS, GATE, LEDGER and NORMALIZE here.
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

  const API = { HEADER };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.JAIRules = API;
})(typeof self !== "undefined" ? self : this);
