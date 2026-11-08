/* JA Insights free report: HOW TO SUPPLEMENT YOUR DATA (CONS-0042).
   THIS FILE IS DATA. Joe and Chaz edit the list in the first block, SOURCES, without touching code: add, change or remove a source, or a whole group.
   Every report ends with this section, chosen from what the report detected about the file: the kind (records or transactions) and the roles of its columns.

   A group:   { id, title, why, when, items }
     when     which files it is for: "places" (an address, city or coordinates column), "dates" (a date column), "money" (a money column or a measure that is money),
              "transactions" (a ledger: a date, a signed money column and a description), or "any" (every file). A group shows when its "when" holds.
   A source:  { name, url, cost, access, adds }
     cost     "free" or "paid"            (paid includes a free trial or a free allowance that ends: say so in "adds")
     access   "open" or "licensed"        (open: anyone may reuse it under an open licence; licensed: use is bound by the provider's terms)
     adds     one plain line on what it adds to your file. No claims about quality, no superlatives.
   The wording is checked for the brand voice by Chaz. Listing a source is not an endorsement, and the line below the title says so.
   Nothing from the visitor's file is sent to any of these: they are links the visitor chooses to open.
   Pure logic and data, no page: it runs in the browser and in Node (node _src/jai/tests/run.js). */
(function (root) {
  "use strict";

  // =====================================================================================================
  // SOURCES: edit here
  const SOURCES = {
    title: "How to supplement your data",
    lead: "What is in your file is only part of the picture. These sources can add what is around it. They are suggestions to explore on your own: nothing from your file is sent to any of them, JA Insights is not affiliated with them, listing one is not an endorsement, and prices and terms change, so read each licence before you combine it with your data.",
    groups: [
      { id: "places", title: "For places and venues", when: "places", why: "your file has addresses, cities or coordinates",
        items: [
          { name: "OpenStreetMap", url: "https://www.openstreetmap.org/", cost: "free", access: "open", adds: "Community-edited names, addresses and categories of places, to compare with yours." },
          { name: "Overture Maps", url: "https://overturemaps.org/", cost: "free", access: "open", adds: "Open place records with names, addresses and categories, merged from several sources." },
          { name: "U.S. Census Bureau data", url: "https://data.census.gov/", cost: "free", access: "open", adds: "Population, income and housing for the ZIP code, tract or county around each place." },
          { name: "Google Places API", url: "https://developers.google.com/maps/documentation/places/web-service", cost: "paid", access: "licensed", adds: "Current details and a place id for each venue; billed per request, and its terms limit how long results may be stored." },
          { name: "Foursquare Places", url: "https://docs.foursquare.com/", cost: "paid", access: "licensed", adds: "Place categories and details by location; a free allowance, then billed by use." },
          { name: "Yelp Fusion API", url: "https://docs.developer.yelp.com/", cost: "paid", access: "licensed", adds: "Business listings and categories for a location; a trial period, then billed, with display rules." },
          { name: "TDLinx (NIQ)", url: "https://nielseniq.com/", cost: "paid", access: "licensed", adds: "A licensed retail-outlet identifier, an example of a vendor id: it needs a licence before you store or share it." },
        ] },
      { id: "dates", title: "For dates", when: "dates", why: "your file has a date column",
        items: [
          { name: "U.S. federal holidays (OPM)", url: "https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/", cost: "free", access: "open", adds: "The dates of federal holidays, to see whether a quiet or busy day follows the calendar." },
          { name: "Nager.Date", url: "https://date.nager.at/", cost: "free", access: "open", adds: "Public holidays by country and year, for files that span more than one country." },
          { name: "NOAA Climate Data Online", url: "https://www.ncei.noaa.gov/cdo-web/", cost: "free", access: "open", adds: "Daily weather by station, to test whether weather moves your numbers." },
          { name: "Visual Crossing Weather", url: "https://www.visualcrossing.com/", cost: "paid", access: "licensed", adds: "Historical weather by address or coordinates; a free daily allowance, then billed." },
        ] },
      { id: "money", title: "For money", when: "money", why: "your file has amounts of money",
        items: [
          { name: "BLS Consumer Price Index", url: "https://www.bls.gov/cpi/", cost: "free", access: "open", adds: "Price indexes to put amounts from different years on the same footing." },
          { name: "FRED (Federal Reserve Bank of St. Louis)", url: "https://fred.stlouisfed.org/", cost: "free", access: "open", adds: "Economic series such as interest rates and regional indicators to set beside your totals." },
        ] },
      { id: "transactions", title: "For a ledger of transactions", when: "transactions", why: "your file reads as a ledger: a date, a signed amount and a description",
        items: [
          { name: "U.S. Census retail trade data", url: "https://www.census.gov/retail/index.html", cost: "free", access: "open", adds: "Monthly retail sales by kind of business, to compare your spending with the market." },
        ] },
      { id: "any", title: "For any file", when: "any", why: "any file can be set beside public data",
        items: [
          { name: "Data.gov", url: "https://data.gov/", cost: "free", access: "open", adds: "The U.S. government's open data catalog: datasets by topic, agency and place." },
          { name: "U.S. Census Bureau data", url: "https://data.census.gov/", cost: "free", access: "open", adds: "Population, income, housing and business statistics by geography." },
          { name: "State and local open-data portals", url: "https://www.data.gov/open-gov/", cost: "free", access: "open", adds: "Permits, licences, inspections and sales published by states, counties and cities." },
          { name: "Datarade", url: "https://datarade.ai/", cost: "paid", access: "licensed", adds: "A directory and marketplace of commercial datasets, each under its provider's licence and price." },
          { name: "Dun & Bradstreet", url: "https://www.dnb.com/", cost: "paid", access: "licensed", adds: "Business records with industry codes and company size, for files that list businesses." },
        ] },
    ],
  };

  // =====================================================================================================
  // Which groups fit a file. The analysis is what the report detected: its kind, the roles of its columns, the date column and whether its measure is money.
  function detect(a) {
    const roles = new Set((a.cols || []).map(c => c.role)), has = r => roles.has(r);
    return {
      places: ["address", "city", "coordinates", "postal"].some(has),
      dates: !!a.dateCol || (a.cols || []).some(c => c.type === "date"),
      money: !!a.measureMoney || has("money"),
      transactions: a.kind === "transactions",
      any: true,
    };
  }
  // The groups for a file, most specific first, with a source that an earlier group already listed left out of a later one.
  function pick(a) {
    const on = detect(a), seen = new Set(), out = [];
    SOURCES.groups.filter(g => on[g.when]).forEach(g => {
      const items = g.items.filter(s => { const k = s.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
      if (items.length) out.push({ id: g.id, title: g.title, why: g.why, items });
    });
    return out;
  }
  const COST = { free: "Free", paid: "Paid" }, ACCESS = { open: "Open", licensed: "Licensed" };
  const API = { SOURCES, detect, pick, COST, ACCESS };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.JAISources = API;
})(typeof self !== "undefined" ? self : this);
