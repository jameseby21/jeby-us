/* JA Insights behaviour: tabs, copy-email, figures that draw when seen, underline sweeps, process line, estimate receipt. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const toast = msg => { let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2200); };
  $$("[data-copy-email]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); const a = b.dataset.copyEmail;
    try { navigator.clipboard.writeText(a).then(() => toast("Email copied: " + a), () => toast(a)); } catch (x) { toast(a); } }));
  $$("[data-email]").forEach(el => { if (el.tagName === "A") el.href = "mailto:" + el.dataset.email + (el.dataset.subject ? "?subject=" + encodeURIComponent(el.dataset.subject) : ""); });

  // contact note: builds a mailto; nothing leaves the page
  $$("[data-compose]").forEach(b => b.addEventListener("click", () => { const f = b.closest("form"), n = f.n.value.trim(), m = f.m.value.trim();
    location.href = "mailto:" + b.dataset.compose + "?subject=" + encodeURIComponent("Intro" + (n ? " from " + n : "")) + "&body=" + encodeURIComponent(m); }));

  // reveal-on-view: figures draw, underlines sweep, the process line fills
  const seen = (el, cls) => { if (!("IntersectionObserver" in window)) { el.classList.add(cls); return; }
    new IntersectionObserver((es, o) => es.forEach(x => { if (x.isIntersecting) { el.classList.add(cls); o.disconnect(); } }), { threshold: .45 }).observe(el); };
  $$(".fig").forEach(f => seen(f, "play")); $$(".u").forEach(u => seen(u, "on")); $$(".steps").forEach(s => seen(s, "on"));

  // SVG words are drawn in the picture's own units, so a figure shown smaller than its viewBox shrinks them. Every word is kept at 12 px or more on screen (JEBYUS-0058);
  // print has its own sizes, so the overrides are taken off before printing and put back after.
  const MINPX = 12, unfit = t => { t.style.fontSize = ""; t.removeAttribute("data-fit"); };
  const fitSvgText = (root = document) => $$("svg", root).forEach(svg => {
    const vb = svg.viewBox && svg.viewBox.baseVal; if (!vb || !vb.width) return;
    $$("[data-fit]", svg).forEach(unfit);
    const m = svg.getScreenCTM(), k = m ? Math.hypot(m.a, m.b) : 0; if (!k) return;   // the real scale on screen, also for a figure that is tilted
    $$("text, tspan", svg).forEach(t => { if (!(t.textContent || "").trim()) return; const f = parseFloat(getComputedStyle(t).fontSize); if (f * k < MINPX + 0.1) { t.style.fontSize = ((MINPX + 0.15) / k).toFixed(2) + "px"; t.setAttribute("data-fit", ""); } });
  });
  window.JAI = Object.assign(window.JAI || {}, { fitSvgText });
  { let raf = 0; const again = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => fitSvgText()); };
    again(); addEventListener("load", again); addEventListener("resize", again); addEventListener("afterprint", again); if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
    addEventListener("beforeprint", () => $$("[data-fit]").forEach(unfit)); }

  // tabs with a hash per tab
  $$("[role=tablist][data-tabs]").forEach(list => {
    const tabs = $$("[role=tab]", list);
    const select = (t, push) => { tabs.forEach(x => { const on = x === t; x.setAttribute("aria-selected", on); x.tabIndex = on ? 0 : -1; const p = document.getElementById(x.getAttribute("aria-controls")); if (p) p.hidden = !on; }); if (push) history.replaceState(null, "", "#" + t.dataset.hash); };
    tabs.forEach((t, i) => { t.addEventListener("click", () => select(t, true)); t.addEventListener("keydown", e => { const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (d) { const n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); select(n, true); } }); });
    select(tabs.find(t => t.dataset.hash === location.hash.slice(1)) || tabs[0], false);
  });
  // open a product row when its #id is linked
  const h = location.hash.slice(1); if (h) { const d = document.getElementById(h); if (d && d.tagName === "DETAILS") { d.open = true; setTimeout(() => d.scrollIntoView({ block: "start" }), 50); } }

  // estimate: hours x rate, printed like a receipt
  const est = $("#estimate");
  if (est) {
    const RATE = +est.dataset.rate, box = $("#receipt"), lines = $("#receipt-lines"), stamp = $(".stamp", box);
    const money = n => "$" + n.toLocaleString("en-US");
    const render = () => {
      const picked = $$("input:checked", est).map(i => ({ name: i.dataset.name, h: +i.dataset.h, monthly: i.dataset.monthly === "1" }));
      const one = picked.filter(p => !p.monthly), mon = picked.filter(p => p.monthly);
      const hrs = one.reduce((a, p) => a + p.h, 0), mh = mon.reduce((a, p) => a + p.h, 0);
      let html = "";
      picked.forEach((p, i) => html += `<div class="ln" style="animation-delay:${i * 90}ms"><span>${p.name}</span><span>${p.h} h × $${RATE}${p.monthly ? "/mo" : ""}</span></div>`);
      if (!picked.length) html = `<div class="ln"><span>Pick anything on the left</span><span></span></div>`;
      if (one.length) html += `<div class="ln sum" style="animation-delay:${picked.length * 90}ms"><span>One-time total</span><span>${money(hrs * RATE)}</span></div>`;
      if (mon.length) html += `<div class="ln sum" style="animation-delay:${picked.length * 90 + 60}ms"><span>Monthly</span><span>${money(mh * RATE)}/mo</span></div>`;
      lines.innerHTML = html;
      stamp.classList.remove("hit"); void stamp.offsetWidth; if (picked.length) stamp.classList.add("hit");
      stamp.hidden = !picked.length;
    };
    est.addEventListener("change", render); render();
  }
})();
