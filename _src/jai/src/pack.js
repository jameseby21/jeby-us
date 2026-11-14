/* JA Insights free report: optional rule packs (CONS-0068).
   The default report loads no pack and knows nothing about a file's topic. A pack is a JSON file (_src/jai/packs/*.json) of checks: the column names it looks for,
   a check type, a threshold, a class, wording and the source of the rule. This file only holds the generic evaluators that read those packs, so a pack can be added
   or edited without touching code. Pure logic: runs in the page, the worker and Node. Nothing is uploaded. */
(function (root) {
  "use strict";
  const nf = n => n.toLocaleString("en-US");
  const fmtV = (v, money) => (money ? "$" + Math.round(v).toLocaleString("en-US") : String(Math.round(v * 100) / 100));
  const fill = (t, o) => String(t).replace(/\{(\w+)\}/g, (_, k) => (o[k] != null ? o[k] : ""));
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const pstdev = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) * (x - m)))); };

  function validate(pack) {
    if (!pack || typeof pack !== "object" || !Array.isArray(pack.checks)) throw new Error("That is not a rule pack: it needs an id, a name and a list of checks.");
    if (!pack.id || !pack.name) throw new Error("A rule pack needs an id and a name.");
    pack.checks.forEach(c => { if (!c.id || !c.type || !c.wording) throw new Error(`Check ${c.id || "?"} needs an id, a type and wording.`); });
    return pack;
  }

  // Resolve the pack's column names against the file's header.
  function resolve(pack, cols) {
    const out = {}; Object.entries(pack.select || {}).forEach(([role, re]) => { const rx = new RegExp(re, "i"); out[role] = cols.find(c => rx.test(c.name)) || null; });
    return out;
  }

  // ctx: { body, cols, num }; returns [{ id, kind, cls, sev, hard, pack, title, detail, rule, todo, score, crumb, cells:[{ri,ci,why}] }]
  function run(pack, ctx) {
    const { body, cols, num } = ctx, N = body.length, sel = resolve(pack, cols), items = [];
    pack.checks.forEach(chk => {
      const needs = (chk.needs || []).map(r => sel[r]); if (needs.some(c => !c)) { items.push({ skipped: true, id: chk.id, missing: (chk.needs || []).filter(r => !sel[r]) }); return; }
      const t = chk.threshold || {}, money = sel.money && needs.includes(sel.money), cells = [], put = (ri, ci, why) => cells.push({ ri, ci, why, sev: chk.severity === "critical" ? "fix" : "look", eff: 0 });
      if (chk.type === "repeat-exact") {
        const c = needs[0], m = new Map(); body.forEach((r, ri) => { const v = num(r[c.i]); if (!isNaN(v)) (m.get(v) || m.set(v, []).get(v)).push(ri); });
        m.forEach((rows, v) => { if (rows.length >= (t.minCount || 4)) rows.forEach(ri => put(ri, c.i, `<b>${fill(chk.reason || chk.wording, { count: nf(rows.length), field: c.name, value: fmtV(v, money) })}</b>`)); });
      } else if (chk.type === "neighbors-z" || chk.type === "neighbors-abs") {
        const c = needs[0], by = sel[chk.neighbor_by], grp = sel[chk.within], k = t.neighbors || 3, groups = new Map();
        if (!by) { items.push({ skipped: true, id: chk.id, missing: [chk.neighbor_by] }); return; }
        body.forEach((r, ri) => { const v = num(r[c.i]), a = num(r[by.i]); if (isNaN(v) || isNaN(a)) return; const g = grp ? r[grp.i].trim() : ""; (groups.get(g) || groups.set(g, []).get(g)).push({ ri, v, a }); });
        groups.forEach(list => {
          list.sort((x, y) => x.a - y.a || x.ri - y.ri);
          list.forEach((me, i) => {
            const pick = []; let l = i - 1, r2 = i + 1;
            while (pick.length < k && (l >= 0 || r2 < list.length)) { const dl = l >= 0 ? Math.abs(list[l].a - me.a) : Infinity, dr = r2 < list.length ? Math.abs(list[r2].a - me.a) : Infinity; if (dl <= dr) pick.push(list[l--]); else pick.push(list[r2++]); }
            const sample = pick.map(x => x.v).filter(v => (chk.type === "neighbors-z" ? v > 0 : v >= 0)); if (sample.length < (t.minNeighbors || k)) return;
            const avg = mean(sample), spread = pstdev(sample), dist = Math.abs(me.v - avg);
            const flagged = chk.type === "neighbors-abs" ? dist > (t.tolerance || 2) : !(spread ? dist <= spread * (t.z || 2) : dist === 0);
            if (flagged) put(me.ri, c.i, `<b>${fill(chk.wording, { field: c.name, dir: me.v > avg ? "high" : "low", k: sample.length, avg: fmtV(avg, money), value: fmtV(me.v, money), by: by.name })}</b>`);
          });
        });
      } else if (chk.type === "required") {
        needs.forEach(c => body.forEach((r, ri) => { if (String(r[c.i]).trim() === "") put(ri, c.i, `<b>${fill(chk.wording, { field: c.name })}</b>`); }));
      } else if (chk.type === "numeric-parse") {
        const c = needs[0]; body.forEach((r, ri) => { const raw = String(r[c.i]).trim(); if (raw !== "" && isNaN(num(raw))) put(ri, c.i, `<b>${fill(chk.wording, { field: c.name })}</b>`); });
      }
      if (cells.length) {
        const rows = new Set(cells.map(c => c.ri));
        items.push({ id: "pack:" + chk.id, kind: chk.kind || "qa", cls: chk.class, sev: chk.severity === "critical" ? "fix" : "look", hard: chk.severity === "critical", pack: pack.id,
          title: `${nf(rows.size)} row${rows.size > 1 ? "s" : ""}: ${fill(chk.title, { field: needs[0].name })}`, detail: chk.summary || chk.title, rule: `${chk.rule || ""} (pack ${pack.id}, from ${chk.source})`, todo: chk.todo || "Check it against the source.",
          score: 60, crumb: `Pack: ${chk.title}`, cells });
      }
    });
    return items;
  }

  const API = { validate, run, resolve };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.JAIPack = API;
})(typeof self !== "undefined" ? self : this);
