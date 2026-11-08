/* JA Insights free report: the Web Worker (CONS-0043). Reading the file, parsing it and every statistic run here, so the page stays responsive while a 10,000-row file is read.
   The worker is the same code the page uses (records.js, domain.js, pack.js, report.js), loaded side by side; nothing is uploaded and nothing is stored. */
importScripts("records.js", "domain.js", "pack.js", "report.js");
self.JAIReport.serve(self);
