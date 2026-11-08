/* JA Insights free report: the records table (CONS-0049), editing and export (CONS-0054).
   Part 1 is pure logic (store, view, edits, export) and runs in Node for the tests. Part 2 draws the table in the browser.
   Everything happens in the visitor's browser: nothing is uploaded, stored or sent. Closing the tab forgets the edits. */
(function (root) {
  "use strict";
  const COLL = typeof Intl !== "undefined" ? new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }) : { compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0) };
  const decOf = s => { const m = String(s).trim().match(/\.(\d+)\s*$/); return m ? m[1].length : 0; };
  const fixed = (n, dec) => (dec > 0 && dec <= 8 ? n.toFixed(dec) : String(n));

  // ---------- CSV out (original delimiter, line ending and quoting are kept)
  function csvField(v, delim, wasQuoted) {
    v = String(v);
    return wasQuoted || v.indexOf(delim) >= 0 || v.indexOf('"') >= 0 || v.indexOf("\n") >= 0 || v.indexOf("\r") >= 0 ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function rowsToCSV(rows, fmt = {}, masks = null) {
    const d = fmt.delim || ",", eol = fmt.eol || "\n";
    return (fmt.bom ? "﻿" : "") + rows.map((r, i) => r.map((v, j) => csvField(v, d, masks && masks[i] && masks[i][j])).join(d)).join(eol) + (fmt.finalEol === false ? "" : eol);
  }

  // ---------- the store: current values, the file as read, and the edit history
  function createStore(o) {
    const rows = o.rows.map(r => r.slice());
    return { header: o.header, lead: o.lead || (o.header ? [o.header] : []), leadMask: o.leadMask || (o.headerMask ? [o.headerMask] : null), rowBase: o.rowBase || 2, names: o.names || o.header, rows, orig: o.rows.map(r => r.slice()), mask: o.mask || null, fmt: o.fmt || { delim: ",", eol: "\n", finalEol: true },
      isNum: o.isNum || [], num: o.num, calc: o.calc || null, edits: [], edited: new Set(), hay: [], rev: 0, name: o.name || "records" };
  }
  const syncEdited = (s, ri, ci) => { const k = ri + ":" + ci; if (s.rows[ri][ci] !== s.orig[ri][ci]) s.edited.add(k); else s.edited.delete(k); };

  // Enter saves. Numbers parse "$1,150.00". Editing qty or price recomputes the total, but only on rows whose total was right before.
  function commitEdit(s, ri, ci, raw, at = new Date()) {
    const before = s.rows[ri][ci]; let v = String(raw).trim();
    if (s.isNum[ci] && v !== "") {
      const n = s.num(v); if (isNaN(n)) return { ok: false, reason: "That is not a number. Use digits, for example 11.50 or $1,150.00." };
      v = fixed(n, Math.max(decOf(before), decOf(String(n))));
    }
    if (v === before) return { ok: true, changed: false };
    const derived = [], c = s.calc, row = s.rows[ri];
    if (c && (ci === c.qty || ci === c.price)) {
      const q0 = s.num(ci === c.qty ? before : row[c.qty]), p0 = s.num(ci === c.price ? before : row[c.price]), t0 = s.num(row[c.total]);
      const q1 = s.num(ci === c.qty ? v : row[c.qty]), p1 = s.num(ci === c.price ? v : row[c.price]);
      if (![q0, p0, t0, q1, p1].some(isNaN) && Math.abs(q0 * p0 - t0) <= 0.0051) {
        const t1 = Math.round(q1 * p1 * 100) / 100, tb = row[c.total], ts = fixed(t1, Math.max(decOf(tb), decOf(String(t1))));
        if (ts !== tb) derived.push({ ci: c.total, before: tb, after: ts });
      }
    }
    row[ci] = v; s.hay[ri] = null; syncEdited(s, ri, ci);
    derived.forEach(d => { row[d.ci] = d.after; syncEdited(s, ri, d.ci); });
    s.edits.push({ ri, ci, before, after: v, at: at.toISOString(), derived }); s.rev++;
    return { ok: true, changed: true };
  }
  // Merge (CONS-0073): write each spelling in the map the way the map says, in one column. Every cell is an edit of its own, so the change log shows it and Undo takes it back.
  function mergeCells(s, ci, pairs) {
    const m = new Map(pairs), at = new Date(); let n = 0;
    for (let ri = 0; ri < s.rows.length; ri++) { const to = m.get(s.rows[ri][ci]); if (to != null && to !== s.rows[ri][ci] && commitEdit(s, ri, ci, to, at).changed) n++; }
    return n;
  }
  function undoEdit(s) {
    const e = s.edits.pop(); if (!e) return null;
    const row = s.rows[e.ri]; row[e.ci] = e.before; s.hay[e.ri] = null; syncEdited(s, e.ri, e.ci);
    e.derived.forEach(d => { row[d.ci] = d.before; syncEdited(s, e.ri, d.ci); }); s.rev++; return e;
  }

  // ---------- the view: filter, search, sort (all rows, not just the ones on screen)
  function computeView(s, f = {}) {
    let idx;
    if (f.rows) { idx = [...f.rows].sort((a, b) => a - b); } else { idx = new Array(s.rows.length); for (let i = 0; i < idx.length; i++) idx[i] = i; }
    if (f.group) { const G = f.group, key = (i, c) => s.rows[i][c].trim() || "(blank)"; idx = idx.filter(i => key(i, G.col) === G.val && (G.col2 == null || key(i, G.col2) === G.val2)); }
    if (f.q) {
      const q = f.q.toLowerCase(), hay = s.hay;
      idx = idx.filter(i => (hay[i] || (hay[i] = s.rows[i].join("\u0001").toLowerCase())).indexOf(q) >= 0);
    }
    const c = f.sortCol;
    if (c != null && c !== "" && f.sortDir) {
      const dir = f.sortDir, nan = [];
      if (c === -1) { if (dir < 0) idx.reverse(); return idx; }
      if (s.isNum[c]) {
        const key = new Float64Array(s.rows.length); for (const i of idx) key[i] = s.num(s.rows[i][c]);
        const have = idx.filter(i => !isNaN(key[i])); idx.forEach(i => { if (isNaN(key[i])) nan.push(i); });
        have.sort((a, b) => (key[a] - key[b]) * dir); return have.concat(nan);
      }
      const vals = [...new Set(idx.map(i => s.rows[i][c]))].sort((a, b) => COLL.compare(a, b)), rank = new Map(vals.map((v, k) => [v, k]));
      idx.sort((a, b) => (rank.get(s.rows[a][c]) - rank.get(s.rows[b][c])) * dir);
    }
    return idx;
  }
  // only these rows are drawn: the ones in the window plus a few either side
  function visibleRange(scrollTop, viewH, total, rowH, headH = 37, pad = 4) {
    const top = Math.max(0, scrollTop - headH);
    return { first: Math.max(0, Math.min(total, Math.floor(top / rowH) - pad)), last: Math.min(total, Math.ceil((top + viewH) / rowH) + pad) };
  }

  // ---------- export
  const exportCSV = s => rowsToCSV([...s.lead, ...s.rows], s.fmt, s.mask ? [...(s.leadMask || s.lead.map(r => [])), ...s.mask] : null);   // title rows and the header (when the file has them) come first, as read
  function changeLogCSV(s) {
    const L = [["row", "column", "before", "after", "edited_at"]];
    s.edits.forEach(e => { L.push([e.ri + s.rowBase, s.names[e.ci], e.before, e.after, e.at]); e.derived.forEach(d => L.push([e.ri + s.rowBase, s.names[d.ci], d.before, d.after, e.at])); });
    return rowsToCSV(L, { delim: ",", eol: "\n" });
  }

  // the QA sample as its own file: the original columns, then why the row is there and what to do (accept, reject or defer)
  function qaSampleCSV(s, q) {
    const head = ["row", ...s.names, "qa_basis", "qa_class", "qa_issue", "qa_suggestion"];
    const rows = q.rows.map(ri => { const i = q.info.get(ri); return [ri + s.rowBase, ...s.rows[ri], i.basis, i.cls || "", i.issue, i.suggestion]; });
    return rowsToCSV([head, ...rows], { delim: ",", eol: "\n" });
  }

  const api = { qaSampleCSV, rowsToCSV, createStore, commitEdit, mergeCells, undoEdit, computeView, visibleRange, exportCSV, changeLogCSV };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.JAIRecords = api;
  if (typeof document === "undefined") return;

  // =====================================================================================================
  // Part 2: the table in the page. A fixed-height window; only the rows in view exist in the DOM.
  const RH = 34, HEAD = 37;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const plain = s => String(s).replace(/<\/?b>/g, "");

  api.mountTable = function mountTable(host, o) {
    const s = o.store; let a = o.analysis;
    const NC = s.names.length, widths = [74], numCol = s.isNum;
    for (let c = 0; c < NC; c++) { let m = String(s.names[c]).length + 3; for (let i = 0, n = Math.min(300, s.rows.length); i < n; i++) m = Math.max(m, s.rows[i][c].length); widths.push(Math.max(70, Math.min(260, Math.round(m * 7.9 + 28)))); }
    const template = widths.map(w => w + "px").join(" "), totalW = widths.reduce((x, y) => x + y, 0);
    host.innerHTML = `
<div class="rec-head"><h2>All records</h2><span class="rec-hint">Every row the report read. Double-click a cell to correct it (on a phone, tap it). Nothing you change leaves this tab.</span></div>
<div class="rec-tools"><label class="rec-search"><span aria-hidden="true">⌕</span><input type="search" data-q placeholder="Search every column" aria-label="Search the records"></label><div class="rec-edits" data-edits></div></div>
<div class="rec-tools"><nav class="rec-crumbs" data-crumbs aria-label="Filter"></nav><span class="rec-count" data-count aria-live="polite"></span></div>
<div class="rec-win" data-win role="grid" aria-label="Records" aria-rowcount="${s.rows.length + 1}" tabindex="0"><div class="rec-thead" data-thead role="row"></div><div class="rec-tbody" data-tbody></div></div>
<div class="rec-legend"><span><i class="fix"></i>Fix: almost certainly wrong</span><span><i class="look"></i>Look: unusual, may be right</span><span><i class="edit"></i>Edited by you</span>
  <span class="rec-hint">Hover or Tab to a marked cell for the reason; Enter edits it. Drag the bottom edge to make the window taller.</span></div>
<div class="rec-tip" data-tip role="tooltip"></div>
<div class="rec-back" data-modal hidden><div class="rec-modal" role="dialog" aria-modal="true" aria-label="Export">
  <header><div class="rec-tabs"><button class="btn small" data-tab="csv" aria-selected="true">Corrected CSV</button><button class="btn small" data-tab="log" aria-selected="false">Change log</button></div>
    <button class="btn small" data-dl style="margin-left:auto">Download</button><button class="btn small" data-copy>Copy</button><button class="btn small" data-close>Close</button></header>
  <p class="rec-note" data-note></p><pre data-pre></pre></div></div>`;
    const $ = k => host.querySelector(`[data-${k}]`), win = $("win"), thead = $("thead"), tbody = $("tbody"), tip = $("tip"), modal = $("modal");
    thead.style.gridTemplateColumns = template; thead.style.width = tbody.style.width = totalW + "px";
    let filt = { finding: null, group: null, q: "", sortCol: null, sortDir: 0 }, view = [], hl = null, editing = null, lastKey = "", flags = a.flags;

    const sortLabel = c => (filt.sortCol === c ? (filt.sortDir > 0 ? "▲" : "▼") : "↕");
    function drawHead() {
      thead.innerHTML = [-1, ...s.names.keys()].map(c => {
        const on = filt.sortCol === c, name = c === -1 ? "Row" : s.names[c];
        return `<button data-k="${c}" role="columnheader" aria-sort="${on ? (filt.sortDir > 0 ? "ascending" : "descending") : "none"}" class="${c === -1 ? "first" : numCol[c] ? "num" : ""}" title="${c === -1 ? "Row in your file" : "Sort by " + esc(name)}"><span>${esc(name)}</span><i>${c === -1 && !on ? "" : sortLabel(c)}</i></button>`;
      }).join("");
    }
    function recompute() {
      view = computeView(s, { rows: filt.finding && filt.finding.rows, group: filt.group, q: filt.q, sortCol: filt.sortCol, sortDir: filt.sortDir });
      tbody.style.height = view.length * RH + "px"; lastKey = "";
    }
    const showVal = (v, fl) => v === "" ? `<span class="rec-blank">${fl ? "blank" : ""}</span>` : esc(v.replace(/ $/, "␣").replace(/^ /, "␣"));
    function draw(force) {
      const { first, last } = visibleRange(win.scrollTop, win.clientHeight, view.length, RH, HEAD);
      const key = first + ":" + last + ":" + s.rev + ":" + hl + ":" + (editing ? editing.ri + "," + editing.ci : "") + ":" + a.rev;
      if (!force && key === lastKey) return; lastKey = key;
      let h = "";
      for (let i = first; i < last; i++) {
        const ri = view[i], row = s.rows[ri];
        h += `<div class="rec-tr${ri === hl ? " hl" : ""}" role="row" aria-rowindex="${i + 2}" style="top:${i * RH}px;grid-template-columns:${template}"><div class="rec-td first" role="rowheader">${(ri + s.rowBase).toLocaleString("en-US")}</div>`;
        for (let c = 0; c < NC; c++) {
          const fl = flags.get(ri + ":" + c), ed = s.edited.has(ri + ":" + c), cls = "rec-td" + (numCol[c] ? " num" : "") + (ed ? " edited" : fl ? " " + fl.sev : "");
          const inner = editing && editing.ri === ri && editing.ci === c ? `<input data-edit value="${esc(row[c])}" aria-label="Edit ${esc(s.names[c])}, row ${ri + s.rowBase}">` : showVal(row[c], fl);
          h += `<div class="${cls}" role="gridcell" tabindex="${fl || ed ? 0 : -1}" data-r="${ri}" data-c="${c}"${fl ? ` aria-label="${esc(plain(fl.why))}"` : ""}>${inner}</div>`;
        }
        h += "</div>";
      }
      tbody.innerHTML = h;
      const inp = tbody.querySelector("[data-edit]"); if (inp) { inp.focus(); inp.select(); }
    }
    function crumbs() {
      const p = ['<button class="rec-link" data-all>All records</button>'];
      if (filt.finding) p.push("›", `<span class="here">${esc(filt.finding.crumb)}</span>`);
      if (filt.group) p.push("›", `<span class="here">${esc(s.names[filt.group.col])}: ${esc(filt.group.val)}</span>`);
      if (filt.q) p.push("›", `<span class="here">Search: “${esc(filt.q)}”</span>`);
      if (filt.finding || filt.group || filt.q) p.push('<button class="rec-x" data-all>Back to all ✕</button>');
      $("crumbs").innerHTML = p.join(" ");
      $("count").textContent = `Showing ${view.length.toLocaleString("en-US")} of ${s.rows.length.toLocaleString("en-US")}`;
    }
    function toolbar() {
      const n = s.edits.length;
      $("edits").innerHTML = (n ? `<span class="n">${n} ${n === 1 ? "edit" : "edits"}</span><button class="btn small" data-undo>Undo</button>` : '<span class="rec-hint">No edits yet</span>') +
        `<button class="btn small dark" data-export ${n ? "" : "disabled"}>Export corrected CSV and change log</button>`;
    }
    function refresh(resetScroll) { recompute(); if (resetScroll) win.scrollTop = 0; drawHead(); toolbar(); crumbs(); draw(true); }

    // ----- hover and focus reasons
    function showWhy(cell) {
      if (!cell || cell.dataset.c == null) return void (tip.style.opacity = 0);
      const ri = +cell.dataset.r, ci = +cell.dataset.c, fl = flags.get(ri + ":" + ci), ed = s.edited.has(ri + ":" + ci);
      if (!fl && !ed) return void (tip.style.opacity = 0);
      const last = ed ? s.edits.filter(e => e.ri === ri && (e.ci === ci || e.derived.some(d => d.ci === ci))).pop() : null;
      const was = last ? (last.ci === ci ? last.before : last.derived.find(d => d.ci === ci).before) : "";
      tip.innerHTML = ed ? `<b>Edited by you.</b> Was ${was === "" ? "blank" : esc(was)}, now ${s.rows[ri][ci] === "" ? "blank" : esc(s.rows[ri][ci])}.` + (fl ? `<br>Still marked: ${fl.why}` : "") : `${fl.why}<br><span class="dim">Double-click to correct it.</span>`;
      const b = cell.getBoundingClientRect(); tip.style.left = Math.min(innerWidth - 320, Math.max(8, b.left)) + "px"; tip.style.top = Math.min(innerHeight - 90, b.bottom + 6) + "px"; tip.style.opacity = 1;
    }
    tbody.addEventListener("pointerover", e => showWhy(e.target.closest(".rec-td")));
    tbody.addEventListener("pointerleave", () => (tip.style.opacity = 0));
    tbody.addEventListener("focusin", e => showWhy(e.target.closest(".rec-td")));
    win.addEventListener("scroll", () => { tip.style.opacity = 0; if (!editing) draw(); }, { passive: true });
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => draw()).observe(win);

    // ----- editing: double-click or Enter, Enter saves, Esc cancels
    function startEdit(cell) { if (!cell || cell.dataset.c == null) return; editing = { ri: +cell.dataset.r, ci: +cell.dataset.c }; tip.style.opacity = 0; draw(true); }
    function stopEdit(focus) { const e = editing; editing = null; draw(true); if (focus && e) { const c = tbody.querySelector(`[data-r="${e.ri}"][data-c="${e.ci}"]`); if (c) c.focus(); } }
    tbody.addEventListener("dblclick", e => startEdit(e.target.closest(".rec-td")));
    // ----- on a phone one field is edited at a time, in a sheet at the bottom of the screen (CONS-0056): a double-tap is hard to do, a tap is not
    const narrow = () => typeof matchMedia === "function" && matchMedia("(max-width: 760px)").matches;
    const sheet = document.createElement("div"); sheet.className = "rec-sheet"; sheet.hidden = true; host.appendChild(sheet);
    let sheetAt = null;
    function closeSheet(focus) { const at = sheetAt; sheetAt = null; sheet.hidden = true; sheet.innerHTML = ""; if (focus && at) { const c = tbody.querySelector(`[data-r="${at.ri}"][data-c="${at.ci}"]`); if (c) c.focus({ preventScroll: true }); } }
    function openSheet(ri, ci) {
      const row = s.rows[ri], fl = flags.get(ri + ":" + ci); sheetAt = { ri, ci };
      sheet.innerHTML = `<form class="rec-sheet-in" novalidate><label>Row ${(ri + s.rowBase).toLocaleString("en-US")} · ${esc(s.names[ci])}<input data-sedit value="${esc(row[ci])}" inputmode="${s.isNum[ci] ? "decimal" : "text"}" autocomplete="off" aria-label="Edit ${esc(s.names[ci])}, row ${ri + s.rowBase}"></label>${fl ? `<p class="rec-why">${fl.why}</p>` : ""}<p class="rec-msg" role="alert"></p>
        <div class="rec-sheet-btns"><button type="submit" class="btn red">Save</button><button type="button" class="btn" data-scancel>Cancel</button></div></form>`;
      sheet.hidden = false; const inp = sheet.querySelector("input"); inp.focus(); inp.select();
    }
    tbody.addEventListener("click", e => { if (!narrow() || editing) return; const c = e.target.closest(".rec-td"); if (!c || c.dataset.c == null) return; openSheet(+c.dataset.r, +c.dataset.c); });
    sheet.addEventListener("submit", e => { e.preventDefault(); if (!sheetAt) return; const inp = sheet.querySelector("input"), at = sheetAt, r = commitEdit(s, at.ri, at.ci, inp.value);
      if (!r.ok) { sheet.querySelector(".rec-msg").textContent = r.reason; o.say && o.say(r.reason); return; }
      closeSheet(true); draw(true); if (r.changed) { toolbar(); o.onChange(); } });
    sheet.addEventListener("click", e => { if (e.target.closest("[data-scancel]")) closeSheet(true); });
    sheet.addEventListener("keydown", e => { if (e.key === "Escape") { e.preventDefault(); closeSheet(true); } });
    tbody.addEventListener("keydown", e => {
      const inp = e.target.closest("[data-edit]");
      if (inp) {
        if (e.key === "Enter") { e.preventDefault(); const e0 = editing, r = commitEdit(s, e0.ri, e0.ci, inp.value); if (!r.ok) { inp.setCustomValidity(r.reason); inp.title = r.reason; inp.classList.add("bad"); o.say && o.say(r.reason); return; } stopEdit(true); if (r.changed) { toolbar(); o.onChange(); } }
        else if (e.key === "Escape") { e.preventDefault(); stopEdit(true); }
        return;
      }
      if (e.key === "Enter") { e.preventDefault(); startEdit(e.target.closest(".rec-td")); }
    });
    tbody.addEventListener("focusout", e => { if (e.target.matches && e.target.matches("[data-edit]") && editing) setTimeout(() => { if (editing && !(document.activeElement && document.activeElement.matches("[data-edit]"))) stopEdit(false); }, 0); });

    // ----- filters, search, sort
    thead.addEventListener("click", e => {
      const b = e.target.closest("[data-k]"); if (!b) return; const k = +b.dataset.k;
      if (filt.sortCol !== k) { filt.sortCol = k; filt.sortDir = 1; } else if (filt.sortDir === 1) filt.sortDir = -1; else { filt.sortCol = null; filt.sortDir = 0; }
      refresh(true);
    });
    $("q").addEventListener("input", e => { filt.q = e.target.value.trim(); refresh(true); });
    function clearFilters() { filt = { finding: null, group: null, q: "", sortCol: null, sortDir: 0 }; hl = null; $("q").value = ""; }
    $("crumbs").addEventListener("click", e => { if (e.target.closest("[data-all]")) { clearFilters(); refresh(true); } });
    host.addEventListener("click", e => {
      if (e.target.closest("[data-undo]")) { undoEdit(s); toolbar(); draw(true); o.onChange(); }
      else if (e.target.closest("[data-export]")) openExport();
    });

    // ----- export (two files: the corrected CSV and the change log; both made here, never sent anywhere)
    let tab = "csv";
    const base = () => String(o.fileName || "records").replace(/\.[^.]*$/, "");
    const text = t => (t === "csv" ? exportCSV(s) : changeLogCSV(s));
    function setTab(t) {
      tab = t; host.querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
      const full = text(t), lines = full.split("\n"); $("pre").textContent = lines.length > 60 ? lines.slice(0, 60).join("\n") + `\n… ${lines.length - 60} more lines in the download` : full;
      $("note").textContent = t === "csv" ? `${base()}-corrected.csv · ${s.rows.length.toLocaleString("en-US")} rows in your original column order and quoting${o.piece ? ` · piece ${o.piece.k} of ${o.piece.n} only: the rows in the other pieces are not in this file` : o.truncated ? " · the columns beyond the free limit were not read, so they are not in this file" : ""}` : `${base()}-change-log.csv · row, column, before, after, edited_at (row 1 is the header)`;
    }
    function openExport() { modal.hidden = false; setTab("csv"); modal.querySelector("[data-close]").focus(); }
    const closeExport = () => { modal.hidden = true; };
    modal.addEventListener("click", e => {
      const t = e.target.closest("[data-tab]"); if (t) setTab(t.dataset.tab);
      if (e.target === modal || e.target.closest("[data-close]")) closeExport();
      if (e.target.closest("[data-dl]")) {
        const url = URL.createObjectURL(new Blob([text(tab)], { type: "text/csv;charset=utf-8" })), link = document.createElement("a");
        link.href = url; link.download = `${base()}-${tab === "csv" ? "corrected" : "change-log"}.csv`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
      if (e.target.closest("[data-copy]")) { const b = e.target.closest("[data-copy]"); (navigator.clipboard ? navigator.clipboard.writeText(text(tab)) : Promise.reject()).then(() => (b.textContent = "Copied"), () => { const sel = getSelection(), rg = document.createRange(); rg.selectNodeContents($("pre")); sel.removeAllRanges(); sel.addRange(rg); b.textContent = "Selected: press Ctrl C"; }); }
    });
    host.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) closeExport(); });

    // ----- what the rest of the page can ask of the table
    const self = {
      update(next) { a = next; flags = a.flags; refresh(false); },
      showFinding(id) {
        const f = a.findingsAll.find(x => x.id === id); if (!f) return;
        clearFilters(); filt.finding = { id, rows: new Set(f.rows), crumb: f.crumb || f.title }; refresh(true);
        host.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      },
      showSection(kind) {   // every row behind an Insight, or every row behind a QA finding
        const fs = a.findingsAll.filter(f => (f.kind === "insight") === (kind === "insight")), rows = new Set(fs.flatMap(f => f.rows));
        clearFilters(); filt.finding = { id: "sec:" + kind, rows, crumb: kind === "insight" ? "Insight rows" : "QA rows" }; refresh(true);
        host.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      },
      showRows(rows, crumb) { clearFilters(); filt.finding = { id: "rows:" + crumb, rows: new Set(rows), crumb }; refresh(true); host.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); },
      showGroup(col, val) { clearFilters(); filt.group = { col, val }; refresh(true); host.scrollIntoView({ block: "nearest", behavior: "smooth" }); },
      jumpTo(ri) {
        clearFilters(); hl = ri; recompute(); drawHead(); toolbar(); crumbs();
        win.scrollTop = Math.max(0, view.indexOf(ri) * RH - RH * 4); draw(true);
        win.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        const c = tbody.querySelector(`[data-r="${ri}"] .rec-td[tabindex="0"]`); if (c) c.focus({ preventScroll: true });
      },
      state: () => ({ shown: view.length, drawn: tbody.querySelectorAll(".rec-tr").length, highlighted: hl, filter: filt }),
    };
    refresh(true);
    return self;
  };
})(typeof self !== "undefined" ? self : this);
