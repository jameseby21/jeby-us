/* JA Insights free report: what a column is, and the checks that follow from it (CONS-0059, CONS-0058, CONS-0063).
   THE RULES YOU CAN EDIT ARE IN THE FIRST BLOCK, DOMAIN: column roles (which names mean what), thresholds, and every check with its one-sentence rule,
   what to do about it and the roles it needs. The code below the block only reads that data. Joe and Chaz: change words and numbers there.
   Pure logic, no page: it runs in the browser, in the worker and in Node (node _src/jai/tests/run.js). Nothing is uploaded or stored. */
(function (root) {
  "use strict";

  // =====================================================================================================
  // DOMAIN: edit here
  const DOMAIN = {
    // First matching name wins. Names are compared lower-case with spaces, dashes and underscores treated alike.
    roles: [
      ["identifier", /(^|[_\s-])(id|uuid|guid)$|^id([_\s-]|$)|^(row|rownum|record|observation)([_\s-]?(no|num|number|id))?$/],
      ["parcel", /parcel|folio|\bapn\b|\bpin\b|tax[_\s-]?id/],
      ["coordinates", /(^|[_\s-])(lat|latitude|lon|lng|long|longitude)($|[_\s-])/],
      ["unit", /^(address[_\s-]*)?(unit|apt|apartment|suite|ste)([_\s-]*(no|num|number))?$/],
      ["zip", /zip|postal/],
      ["city", /(^|[_\s-])(city|town|municipality)($|[_\s-])/],
      ["state", /^state([_\s-]|$)|province/],
      ["address", /address|street|addr/],
      ["beds", /(^|[_\s-])beds?($|[_\s-])|bedroom/],
      ["baths", /(^|[_\s-])baths?($|[_\s-])|bathroom/],
      ["lot", /lot/],
      ["area", /living|sq[_\s-]?ft|sqft|square|(^|[_\s-])area($|[_\s-])|(^|[_\s-])size($|[_\s-])/],
      ["price", /price|sold|sale[_\s-]?(amount|value)|consideration/],
    ],
    moneyName: /price|amount|total|cost|revenue|sales?\b|value|income|profit|paid|fee|spend|rent|tax|consideration/,
    notMeasure: ["identifier", "parcel", "coordinates", "unit", "zip"],   // numbers that are labels, not quantities
    // Nominal transfers (CONS-0058): deeds between family, trusts, foreclosures are recorded at $100, $10, $1 or $0.
    nominal: { floor: 1000, minTypical: 20000, minRest: 20, typicalShare: 0.01 },   // at or below `floor` when the other sales are typically at least `minTypical`; else below 1% of the median
    baselineMin: 8,           // a group needs this many non-nominal values to be its own baseline
    maxPrice: 100000000,      // a sale above this is checked against the source
    maxBeds: 20,              // beds or baths above this are not real
    sameAddressAreaRatio: 3,  // one address with living areas this many times apart is two different homes or a typo
    zipMajority: 0.8, parcelMajority: 0.8, minZipRows: 5,
    // Every check: id, what it needs, kind (qa = something to fix or confirm, insight = something the data says), the rule, what to do.
    checks: [
      { id: "nominal", label: "nominal transfers", needs: ["price"], kind: "qa", rule: "A price at or below $1,000 in a file where the other sales are far larger is a nominal transfer (family, trust, foreclosure), not a market sale.", todo: "Keep them out of price averages; confirm with the deed if one matters." },
      { id: "dup", label: "duplicates", needs: [], kind: "qa", rule: "The same address, parcel, date and price on two rows is one sale entered twice; ids never count as a match.", todo: "Delete the extra row or merge the two." },
      { id: "dupnear", label: "near-duplicates", needs: ["address"], kind: "qa", rule: "Rows that match once the address is written the same way (case, punctuation, St and Street, unit formats) are probably one sale.", todo: "Check the two rows and delete the extra." },
      { id: "ppsf", label: "price per area against the city's usual", needs: ["price", "area"], kind: "qa", rule: "Price divided by living area is compared with the median of the other non-nominal sales in the same city (at least 8 of them).", todo: "Check the price and the living area against the source." },
      { id: "pricerange", label: "price range", needs: ["price"], kind: "qa", rule: "A sale price above $100 million is checked against the source.", todo: "Confirm the price and its units." },
      { id: "dates", label: "dates", needs: ["date"], kind: "qa", rule: "A date in the future or before 1900 is a typing slip in the year.", todo: "Correct the year from the source." },
      { id: "zipfmt", label: "zip format", needs: ["zip"], kind: "qa", rule: "A zip code is 5 digits (or 5+4).", todo: "Restore the leading zeros or the missing digits." },
      { id: "cityzip", label: "city and zip agree", needs: ["zip", "city"], kind: "qa", rule: "When almost every row with a zip code names one city, a row that names another city with that zip is suspect.", todo: "Check the city and the zip against the address." },
      { id: "parcelfmt", label: "parcel or folio format", needs: ["parcel"], kind: "qa", rule: "Most parcel numbers share one shape (digits and dashes in the same places); a different shape is probably mistyped.", todo: "Compare with the county record." },
      { id: "bedsbaths", label: "beds and baths", needs: ["beds"], kind: "qa", rule: "More than 20 beds or baths, or a negative count, is not a real home.", todo: "Correct from the listing." },
      { id: "areadiff", label: "same address, different areas", needs: ["address", "area"], kind: "qa", rule: "One address with living areas more than 3 times apart is two different homes or a typo.", todo: "Check the living area for both rows." },
      { id: "coords", label: "coordinates", needs: ["coordinates"], kind: "qa", rule: "Latitude must be between -90 and 90, longitude between -180 and 180, and 0,0 means missing.", todo: "Geocode the address again." },
      { id: "repeat", label: "repeat sales", needs: ["address", "date", "price"], kind: "insight", rule: "The same address sold on different dates; the change is measured between the first and last non-nominal sale.", todo: "Use them as a price-change sample." },
      { id: "extremes", label: "most and least expensive per area", needs: ["price", "area"], kind: "insight", rule: "The five highest and the five lowest price per living area among non-nominal sales.", todo: "Read them first; they set the range." },
      { id: "concentration", label: "concentration", needs: ["city"], kind: "insight", rule: "The share of sales in the three busiest cities.", todo: "Know where the file is thin before comparing places." },
    ],
  };

  // =====================================================================================================
  // Roles
  const keyName = n => String(n).toLowerCase().replace(/[_\s-]+/g, " ").trim();
  function assignRoles(cols, body, num) {
    cols.forEach(c => {
      const nm = keyName(c.name), nmRaw = String(c.name).toLowerCase(); c.role = null; c.roleBy = null; c.moneyBy = null;
      for (const [role, re] of DOMAIN.roles) {
        if (!(re.test(nm) || re.test(nmRaw))) continue;
        if (role === "area" && /lot/.test(nm)) continue;
        if (role === "price" && c.type !== "number") continue;
        if ((role === "beds" || role === "baths" || role === "area" || role === "lot") && c.type !== "number") continue;
        c.role = role; c.roleBy = "name"; break;
      }
      if (!c.role && c.type === "id") { c.role = "identifier"; c.roleBy = "values"; }
      if (c.role === "identifier" && c.type !== "id" && c.distinct < c.filled * 0.9) { c.role = null; c.roleBy = null; }   // a column called id that repeats is a key to something else, not this row's id
      if (c.type === "number" && (!c.role || c.role === "price" || c.role === "area" || c.role === "lot")) {
        const byName = DOMAIN.moneyName.test(nm), raw = body.map(r => r[c.i]).filter(v => String(v).trim() !== "");
        const byFormat = raw.length >= 10 && raw.filter(v => /^\s*[-(]?\$/.test(v) || /^\s*-?[\d,]+\.\d\d\s*$/.test(v)).length >= raw.length * 0.9;
        if (c.role === "price" || ((byName || byFormat) && !c.role)) { c.moneyBy = byName || c.role === "price" ? "name" : "format"; if (!c.role && /per|psf|sq/.test(nm)) c.moneyBy = null; }
        if (c.role === "area" || c.role === "lot") c.moneyBy = null;
      }
      if (!c.role) c.role = c.moneyBy ? "money" : c.type === "date" ? "date" : c.type === "category" ? "category" : c.type === "empty" ? "empty" : c.type === "number" ? "number" : "text";
    });
    return cols;
  }
  const byRole = (cols, role) => cols.filter(c => c.role === role);
  const roleLabel = c => c.role === "money" || c.role === "price" ? (c.moneyBy === "format" ? "money (by format)" : "money (by name)") : c.role === "identifier" ? "identifier (not matched)" : c.role === "number" ? "number" : c.role;

  // =====================================================================================================
  // Addresses: write the same place the same way
  const SUF = { street: "st", st: "st", avenue: "ave", ave: "ave", av: "ave", boulevard: "blvd", blvd: "blvd", road: "rd", rd: "rd", drive: "dr", dr: "dr", lane: "ln", ln: "ln", court: "ct", ct: "ct", place: "pl", pl: "pl", terrace: "ter", ter: "ter", circle: "cir", cir: "cir", highway: "hwy", hwy: "hwy", parkway: "pkwy", pkwy: "pkwy", trail: "trl", trl: "trl" };
  const DIR = { north: "n", south: "s", east: "e", west: "w", northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw", n: "n", s: "s", e: "e", w: "w", ne: "ne", nw: "nw", se: "se", sw: "sw" };
  const normAddress = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean).map(t => SUF[t] || DIR[t] || t).join(" ");
  const normUnit = s => String(s).toLowerCase().replace(/\b(apt|apartment|unit|suite|ste|no|number)\b|#/g, " ").replace(/[^a-z0-9]+/g, "").replace(/^0+(?=\d)/, "");
  const normZip = s => String(s).trim().slice(0, 5);
  const normText = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const normParcel = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

  // =====================================================================================================
  // Nominal transfers (CONS-0058): set aside, counted, never part of a baseline
  function findNominal(body, cols, num, median) {
    const out = new Map();
    cols.filter(c => c.type === "number" && c.role === "price").forEach(c => {
      const v = body.map(r => num(r[c.i])), pos = v.filter(x => x > 0);
      if (pos.length < 30) return;
      const big = pos.filter(x => x > DOMAIN.nominal.floor), typical = big.length >= DOMAIN.nominal.minRest ? median(big) : median(pos);
      const floor = typical >= DOMAIN.nominal.minTypical ? DOMAIN.nominal.floor : typical * DOMAIN.nominal.typicalShare;
      const rows = []; v.forEach((x, ri) => { if (x >= 0 && x <= floor && !isNaN(x)) rows.push(ri); });
      if (rows.length < 3 || rows.length > body.length * 0.5) return;
      const rest = v.filter(x => x > floor), restMed = median(rest), vals = new Map(); rows.forEach(ri => vals.set(v[ri], (vals.get(v[ri]) || 0) + 1));
      out.set(c.i, { col: c, rows, set: new Set(rows), floor, typical: restMed, nRest: rest.length, values: [...vals.entries()].sort((a, b) => b[1] - a[1]) });
    });
    return out;
  }

  // =====================================================================================================
  // Duplicates and repeat sales (CONS-0059)
  // ctx: { body, cols, num, dt, nominal, measure }
  function duplicates(ctx) {
    const { body, cols, num, dt } = ctx, ids = byRole(cols, "identifier");
    const addrParts = ["address", "unit", "city", "state", "zip"].flatMap(r => byRole(cols, r)), parcel = byRole(cols, "parcel");
    const dateC = ctx.dateCol || byRole(cols, "date")[0] || null;
    const moneyC = byRole(cols, "price")[0] || (ctx.measure && ctx.measure.type === "number" ? ctx.measure : null) || byRole(cols, "money")[0] || null;
    const hasAddr = byRole(cols, "address").length > 0 || parcel.length > 0;
    if (!hasAddr || (!dateC && !moneyC)) return { mode: "row", ids };
    const keyCols = [...parcel, ...addrParts, ...(dateC ? [dateC] : []), ...(moneyC ? [moneyC] : [])];
    const norm = (c, r) => { const v = r[c.i]; switch (c.role) { case "address": return normAddress(v); case "unit": return normUnit(v); case "zip": return normZip(v); case "parcel": return normParcel(v); case "city": case "state": return normText(v); default: if (c === dateC) { const t = dt(v); return t == null ? String(v).trim() : String(t); } if (c === moneyC) { const x = num(v); return isNaN(x) ? String(v).trim() : String(x); } return String(v).trim().toLowerCase(); } };
    const rawKey = r => keyCols.map(c => String(r[c.i]).trim()).join("\u0001"), nrmKey = r => keyCols.map(c => norm(c, r)).join("\u0001");
    const blank = r => keyCols.every(c => String(r[c.i]).trim() === "");
    const exact = new Map(), near = new Map();
    body.forEach((r, ri) => { if (blank(r)) return; const k = rawKey(r); (exact.get(k) || exact.set(k, []).get(k)).push(ri); });
    const exactPairs = [], nearPairs = [], inExact = new Set();
    exact.forEach(rows => { if (rows.length > 1) { rows.slice(1).forEach(ri => exactPairs.push([rows[0], ri])); rows.forEach(ri => inExact.add(ri)); } });
    // near: one representative per exact group, grouped by normalized key; skip groups that are already exact copies of each other
    const rep = new Map(); exact.forEach(rows => { const r0 = rows[0]; const k = nrmKey(body[r0]); (rep.get(k) || rep.set(k, []).get(k)).push(r0); });
    rep.forEach(rows => { if (rows.length > 1) rows.slice(1).forEach(ri => nearPairs.push([rows[0], ri])); });
    const fields = keyCols.map(c => c.name), parts = { address: addrParts.map(c => c.name), parcel: parcel.map(c => c.name), date: dateC && dateC.name, money: moneyC && moneyC.name };
    return { mode: "address", ids, keyCols, fields, parts, exactPairs, nearPairs, dateC, moneyC };
  }
  const listWords = a => a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

  function repeatSales(ctx, dups) {
    const { body, cols, num, dt, nominal } = ctx;
    if (!dups || dups.mode !== "address") return null;
    const addr = byRole(cols, "address"); const dateC = dups.dateC, moneyC = dups.moneyC; if (!addr.length || !dateC) return null;
    const idKey = ["address", "unit", "city", "state", "zip"].flatMap(r => byRole(cols, r));
    const nomSet = moneyC && nominal && nominal.get(moneyC.i) ? nominal.get(moneyC.i).set : new Set();
    const by = new Map();
    body.forEach((r, ri) => { const a = normAddress(r[addr[0].i]); if (!a) return; const t = dt(r[dateC.i]); if (t == null) return;
      const k = idKey.map(c => (c.role === "address" ? normAddress(r[c.i]) : c.role === "unit" ? normUnit(r[c.i]) : c.role === "zip" ? normZip(r[c.i]) : normText(r[c.i]))).join("|");
      (by.get(k) || by.set(k, []).get(k)).push({ ri, t }); });
    const groups = [];
    by.forEach(list => {
      const dates = new Set(list.map(x => x.t)); if (dates.size < 2) return;
      const seen = new Set(), sales = list.filter(x => { if (seen.has(x.t)) return false; seen.add(x.t); return true; }).sort((a, b) => a.t - b.t);
      const priced = moneyC ? sales.filter(x => !nomSet.has(x.ri) && num(body[x.ri][moneyC.i]) > 0) : [];
      let change = null;
      if (priced.length >= 2) { const a = priced[0], b = priced[priced.length - 1], p1 = num(body[a.ri][moneyC.i]), p2 = num(body[b.ri][moneyC.i]), days = (b.t - a.t) / 864e5; if (days >= 30) change = { pct: p2 / p1 - 1, annual: Math.pow(p2 / p1, 365 / days) - 1, days, from: a.ri, to: b.ri, p1, p2 }; }
      groups.push({ rows: sales.map(x => x.ri), change });
    });
    return groups.length ? groups : null;
  }

  // =====================================================================================================
  // The domain checks: each returns items { id, kind, sev, title, detail, score, crumb, cells:[{ri,ci,sev,why,eff}] }
  const nf = n => n.toLocaleString("en-US");
  const mon = v => "$" + Math.round(v).toLocaleString("en-US");
  const pctS = x => (x >= 0 ? "+" : "") + Math.round(x * 100) + "%";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const CHK = Object.fromEntries(DOMAIN.checks.map(c => [c.id, c]));

  function domainItems(ctx, dups, repeats) {
    const { body, cols, num, dt, nominal } = ctx, N = body.length, items = [];
    const R = r => byRole(cols, r), first = r => R(r)[0] || null;
    const priceC = first("price"), areaC = first("area"), zipC = first("zip"), cityC = first("city"), parcelC = first("parcel"), bedsC = first("beds"), bathsC = first("baths"), addrC = first("address");
    const nomSet = priceC && nominal.get(priceC.i) ? nominal.get(priceC.i).set : new Set();
    const rowList = (cells, k = 3) => cells.slice(0, k).map(c => c.ri + 2).join(", ") + (cells.length > k ? ` and ${cells.length - k} more` : "");
    const push = (id, sev, title, detail, score, cells, crumb) => { const chk = CHK[id]; items.push({ id, kind: chk ? chk.kind : "qa", sev, title, detail, rule: chk ? chk.rule : "", todo: chk ? chk.todo : "", score, crumb: crumb || title, cells }); };

    if (priceC) {   // a price above the range
      const cells = []; body.forEach((r, ri) => { const v = num(r[priceC.i]); if (v > DOMAIN.maxPrice) cells.push({ ri, ci: priceC.i, sev: "look", why: `<b>${mon(v)} is above ${mon(DOMAIN.maxPrice)}.</b> Likely an extra digit or the wrong units. Check it against the source.`, eff: v }); });
      if (cells.length) push("pricerange", "look", `${nf(cells.length)} ${priceC.name} value${cells.length > 1 ? "s" : ""} above ${mon(DOMAIN.maxPrice)}`, `For example row ${cells[0].ri + 2}: ${mon(num(body[cells[0].ri][priceC.i]))}. Rows ${rowList(cells)}.`, 66, cells, "Prices above $100 million");
    }
    if (zipC) {
      const cells = []; body.forEach((r, ri) => { const z = String(r[zipC.i]).trim(); if (z && !/^\d{5}(-\d{4})?$/.test(z)) cells.push({ ri, ci: zipC.i, sev: "look", why: `<b>“${esc(z.slice(0, 12))}” is not a 5-digit zip code.</b> ${/^\d{3,4}$/.test(z) ? "A leading zero or digit was probably dropped." : "Check the value."}`, eff: 0 }); });
      if (cells.length) push("zipfmt", "look", `${nf(cells.length)} ${zipC.name} value${cells.length > 1 ? "s" : ""} not in zip format`, `For example row ${cells[0].ri + 2}: “${body[cells[0].ri][zipC.i]}”. Rows ${rowList(cells)}.`, 62, cells, "Zip codes in the wrong format");
    }
    if (zipC && cityC) {
      const m = new Map(); body.forEach((r, ri) => { const z = normZip(r[zipC.i]), c = normText(r[cityC.i]); if (!/^\d{5}$/.test(z) || !c) return; const e = m.get(z) || m.set(z, new Map()).get(z); (e.get(c) || e.set(c, []).get(c)).push(ri); });
      const cells = []; m.forEach((e, z) => { let tot = 0, top = null; e.forEach((rows, c) => { tot += rows.length; if (!top || rows.length > top[1].length) top = [c, rows]; });
        if (tot < DOMAIN.minZipRows || top[1].length / tot < DOMAIN.zipMajority) return;
        e.forEach((rows, c) => { if (c === top[0]) return; rows.forEach(ri => cells.push({ ri, ci: cityC.i, sev: "look", why: `<b>${esc(body[ri][cityC.i])} with zip ${z}.</b> ${nf(top[1].length)} of the ${nf(tot)} rows with this zip say ${esc(body[top[1][0]][cityC.i])}. One of them is wrong.`, eff: 0 })); }); });
      cells.sort((a, b) => a.ri - b.ri);
      if (cells.length) push("cityzip", "look", `${nf(cells.length)} row${cells.length > 1 ? "s" : ""} where the city does not match the zip`, `For example row ${cells[0].ri + 2}. Rows ${rowList(cells)}.`, 64, cells, "City and zip disagree");
    }
    if (parcelC) {
      const shape = s => String(s).trim().replace(/[0-9]/g, "9").replace(/[A-Za-z]/g, "A"), m = new Map(); body.forEach((r, ri) => { const s = shape(r[parcelC.i]); if (s) (m.get(s) || m.set(s, []).get(s)).push(ri); });
      const tot = [...m.values()].reduce((a, l) => a + l.length, 0), top = [...m.entries()].sort((a, b) => b[1].length - a[1].length)[0];
      if (top && tot >= 20 && top[1].length / tot >= DOMAIN.parcelMajority && m.size > 1) { const cells = []; m.forEach((rows, s) => { if (s !== top[0]) rows.forEach(ri => cells.push({ ri, ci: parcelC.i, sev: "look", why: `<b>“${esc(body[ri][parcelC.i])}” has a different shape from the other ${esc(parcelC.name)} values</b> (most look like ${esc(body[top[1][0]][parcelC.i])}).`, eff: 0 })); });
        cells.sort((a, b) => a.ri - b.ri); push("parcelfmt", "look", `${nf(cells.length)} ${parcelC.name} value${cells.length > 1 ? "s" : ""} in a different format`, `${nf(top[1].length)} of ${nf(tot)} look like ${body[top[1][0]][parcelC.i]}. Rows ${rowList(cells)}.`, 60, cells, `Mixed ${parcelC.name} formats`); }
    }
    if (bedsC || bathsC) {
      const cells = []; [bedsC, bathsC].filter(Boolean).forEach(c => body.forEach((r, ri) => { const v = num(r[c.i]); if (!isNaN(v) && (v > DOMAIN.maxBeds || v < 0)) cells.push({ ri, ci: c.i, sev: "fix", why: `<b>${esc(r[c.i])} ${esc(keyName(c.name))} is not a real home.</b> Likely a typo (an extra digit).`, eff: 0 }); }));
      if (cells.length) push("bedsbaths", "fix", `${nf(cells.length)} impossible ${keyName((bedsC || bathsC).name)} value${cells.length > 1 ? "s" : ""}`, `For example row ${cells[0].ri + 2}: ${body[cells[0].ri][cells[0].ci]}. Rows ${rowList(cells)}.`, 84, cells, "Impossible bed or bath counts");
    }
    if (addrC && areaC) {
      const by = new Map(); body.forEach((r, ri) => { const a = normAddress(r[addrC.i]), u = R("unit")[0] ? normUnit(r[R("unit")[0].i]) : "", z = zipC ? normZip(r[zipC.i]) : "", v = num(r[areaC.i]); if (!a || !(v > 0)) return; const k = a + "|" + u + "|" + z; (by.get(k) || by.set(k, []).get(k)).push({ ri, v }); });
      const cells = []; by.forEach(list => { if (list.length < 2) return; const lo = Math.min(...list.map(x => x.v)), hi = Math.max(...list.map(x => x.v)); if (hi / lo > DOMAIN.sameAddressAreaRatio) list.forEach(x => cells.push({ ri: x.ri, ci: areaC.i, sev: "look", why: `<b>${nf(x.v)} sq ft, but the same address appears with ${nf(lo)} to ${nf(hi)}.</b> Two different homes, or a typo.`, eff: 0 })); });
      cells.sort((a, b) => a.ri - b.ri); if (cells.length) push("areadiff", "look", `${cells.length / 2 | 0 || 1} address${cells.length > 3 ? "es" : ""} with living areas far apart`, `The same address with areas more than ${DOMAIN.sameAddressAreaRatio} times apart. Rows ${rowList(cells)}.`, 58, cells, "Same address, different areas");
    }
    const lat = R("coordinates").find(c => /lat/i.test(c.name)), lon = R("coordinates").find(c => /lon|lng|long/i.test(c.name));
    if (lat && lon) {
      const cells = []; body.forEach((r, ri) => { const a = num(r[lat.i]), b = num(r[lon.i]); if (isNaN(a) || isNaN(b)) return; if (Math.abs(a) > 90 || Math.abs(b) > 180 || (a === 0 && b === 0)) cells.push({ ri, ci: lat.i, sev: "look", why: `<b>${esc(r[lat.i])}, ${esc(r[lon.i])} is not a place on Earth</b>${a === 0 && b === 0 ? " (0, 0 usually means missing)" : ""}.`, eff: 0 }); });
      if (cells.length) push("coords", "look", `${nf(cells.length)} impossible coordinate${cells.length > 1 ? "s" : ""}`, `Rows ${rowList(cells)}.`, 60, cells, "Impossible coordinates");
    }

    // insights
    if (repeats && repeats.length) {
      const cells = [], ch = repeats.filter(g => g.change), moneyC = dups.moneyC, med = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
      repeats.forEach(g => g.rows.forEach((ri, k) => { if (k === 0) return; const pr = g.rows[k - 1], dText = body[ri][dups.dateC.i], ch2 = moneyC && num(body[ri][moneyC.i]) > 0 && num(body[pr][moneyC.i]) > 0 && !nomSet.has(ri) && !nomSet.has(pr) ? num(body[ri][moneyC.i]) / num(body[pr][moneyC.i]) - 1 : null;
        cells.push({ ri, ci: addrC.i, sev: "ctx", why: `<b>Sold again on ${esc(dText)}${ch2 != null ? `, ${pctS(ch2)} against row ${pr + 2}` : ""}.</b> The same address sold on ${g.rows.length} different dates.`, eff: 0 });
        if (k === 1) cells.push({ ri: pr, ci: addrC.i, sev: "ctx", why: `<b>Sold again later (row ${ri + 2}).</b> The same address sold on ${g.rows.length} different dates.`, eff: 0 }); }));
      const detail = ch.length ? `Between the first and last sale the price changed by a median of ${pctS(med(ch.map(g => g.change.pct)))} (about ${pctS(med(ch.map(g => g.change.annual)))} a year) across ${nf(ch.length)} of them${moneyC ? "" : ""}. Nominal transfers are left out of the comparison.` : "";
      push("repeat", "ctx", `${nf(repeats.length)} address${repeats.length > 1 ? "es" : ""} sold more than once`, `${detail} Rows ${rowList(cells.sort((a, b) => a.ri - b.ri))}.`, 50, cells.sort((a, b) => a.ri - b.ri), "Repeat sales");
      items[items.length - 1].repeat = { n: repeats.length, pct: ch.length ? med(ch.map(g => g.change.pct)) : null, annual: ch.length ? med(ch.map(g => g.change.annual)) : null, nPriced: ch.length };
    }
    if (priceC && areaC) {
      const L = []; body.forEach((r, ri) => { const p = num(r[priceC.i]), a = num(r[areaC.i]); if (p > 0 && a > 0 && !nomSet.has(ri) && p <= DOMAIN.maxPrice) L.push({ ri, v: p / a }); });
      if (L.length >= 40) { L.sort((a, b) => a.v - b.v || a.ri - b.ri); const lo = L.slice(0, 5), hi = L.slice(-5).reverse(), cells = [];
        hi.forEach((x, k) => cells.push({ ri: x.ri, ci: priceC.i, sev: "ctx", why: `<b>#${k + 1} most expensive per ${keyName(areaC.name).replace(/ ?(sq ?ft|sqft|square feet)$/, "") || "area"}: ${mon(x.v)} a square foot.</b> Among the five highest of ${nf(L.length)} non-nominal sales.`, eff: 0 }));
        lo.forEach((x, k) => cells.push({ ri: x.ri, ci: priceC.i, sev: "ctx", why: `<b>#${k + 1} least expensive per area: ${mon(x.v)} a square foot.</b> Among the five lowest of ${nf(L.length)} non-nominal sales.`, eff: 0 }));
        push("extremes", "ctx", "The five most and least expensive per square foot", `Highest ${hi.map(x => mon(x.v)).join(", ")}; lowest ${lo.map(x => mon(x.v)).join(", ")} a square foot (rows ${hi.concat(lo).map(x => x.ri + 2).slice(0, 4).join(", ")} and more).`, 45, cells, "Most and least expensive per area"); }
    }
    if (cityC) {
      const m = new Map(); body.forEach(r => { const c = String(r[cityC.i]).trim(); if (c) m.set(c, (m.get(c) || 0) + 1); }); const tot = [...m.values()].reduce((a, b) => a + b, 0), top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (m.size > 4 && tot) { const sh = top.reduce((a, x) => a + x[1], 0) / tot; items.push({ id: "concentration", kind: "insight", sev: "look", title: `${Math.round(sh * 100)}% of the rows are in three ${keyName(cityC.name)} values`, detail: `${top.map(x => `${x[0]} (${nf(x[1])})`).join(", ")} of ${nf(m.size)} places.`, rule: CHK.concentration.rule, todo: CHK.concentration.todo, score: 42, crumb: "Concentration", cells: [] }); }
    }
    return items;
  }

  // What the file could not be checked for: every check whose roles are missing, when the file looks like a sales or property file
  function notChecked(cols) {
    const has = r => cols.some(c => c.role === r || (r === "date" && c.type === "date") || (r === "price" && c.role === "money"));
    if (!(has("price") || has("money")) || !(has("address") || has("parcel") || has("zip") || has("city"))) return null;
    const miss = DOMAIN.checks.filter(c => c.needs.length && !c.needs.every(has));
    return { active: true, missing: miss.map(c => ({ id: c.id, label: c.label, because: c.needs.filter(n => !has(n)).map(n => n === "coordinates" ? "latitude and longitude columns" : n === "area" ? "a living-area column" : n === "beds" ? "a beds column" : n === "parcel" ? "a parcel or folio column" : `a ${n} column`) })) };
  }

  const API = { DOMAIN, assignRoles, roleLabel, normAddress, normUnit, findNominal, duplicates, repeatSales, domainItems, notChecked, listWords, CHK };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.JAIDomain = API;
})(typeof self !== "undefined" ? self : this);
