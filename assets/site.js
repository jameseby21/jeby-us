/* jeby.us shared behaviour: theme, header, mobile menu, tabs, copy-email, Drew, the dot, the timeline. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  /* theme: dark is the brand; light is opt-in */
  const root = document.documentElement;
  const saved = store.get("jeby-theme"); if (saved === "light" && !root.dataset.theme) root.dataset.theme = "light";
  $$("[data-theme-toggle]").forEach(b => b.addEventListener("click", () => {
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next; store.set("jeby-theme", next);
  }));

  /* header border on scroll */
  const head = $(".site-header");
  const onScroll = () => head && head.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* email: assembled here, copy on click */
  const toast = (msg) => { let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2200); };
  $$("[data-email]").forEach(el => {
    const addr = el.dataset.email;
    if (el.tagName === "A") el.href = "mailto:" + addr + (el.dataset.subject ? "?subject=" + encodeURIComponent(el.dataset.subject) : "");
    if (el.hasAttribute("data-show")) el.textContent = addr;
  });
  $$("[data-copy-email]").forEach(b => b.addEventListener("click", e => {
    const addr = b.dataset.copyEmail;
    e.preventDefault();
    try { navigator.clipboard.writeText(addr).then(() => toast("Email copied: " + addr), () => toast(addr)); } catch (err) { toast(addr); }
  }));

  /* share: the system share sheet where there is one, otherwise copy the link */
  $$("[data-share]").forEach(b => b.addEventListener("click", async () => {
    const url = b.dataset.share, title = b.dataset.title || document.title;
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (err) { if (err && err.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(url); toast("Link copied: " + url); } catch (err) { toast(url); }
  }));
  $$(".btn.pending").forEach(b => b.addEventListener("click", () => toast("Not set up yet")));
  $$("[data-copy-text]").forEach(b => b.addEventListener("click", async () => {
    const el = document.getElementById(b.dataset.copyText); if (!el) return;
    try { await navigator.clipboard.writeText(el.textContent); toast("Prompt copied"); }
    catch (err) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Selected: press Ctrl+C or ⌘C"); }
  }));

  /* story: the rail fills with reading progress and each chapter lights as you reach it */
  $$(".story").forEach(list => {
    const chs = $$(".ch", list);
    const update = () => { const r = list.getBoundingClientRect(), line = innerHeight * .55;
      list.style.setProperty("--p", Math.max(0, Math.min(1, (line - r.top) / r.height)).toFixed(4));
      chs.forEach(c => c.classList.toggle("on", c.getBoundingClientRect().top + 14 < line)); };
    addEventListener("scroll", () => requestAnimationFrame(update), { passive: true }); addEventListener("resize", update); update();
  });

  /* tabs (role=tablist), with a hash per tab */
  $$("[role=tablist][data-tabs]").forEach(list => {
    const tabs = $$("[role=tab]", list);
    const select = (tab, push) => {
      tabs.forEach(t => { const on = t === tab; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; const p = document.getElementById(t.getAttribute("aria-controls")); if (p) p.hidden = !on; });
      if (push) history.replaceState(null, "", "#" + tab.dataset.hash);
      dispatchEvent(new Event("tabchange"));
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t, true));
      t.addEventListener("keydown", e => { const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (d) { const n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); select(n, true); } });
    });
    const fromHash = tabs.find(t => t.dataset.hash === location.hash.slice(1));
    select(fromHash || tabs[0], false);
    $$("[data-goto-tab]").forEach(a => a.addEventListener("click", e => { const t = tabs.find(x => x.dataset.hash === a.dataset.gotoTab); if (t) { e.preventDefault(); select(t, true); list.scrollIntoView({ block: "start", behavior: reduced() ? "auto" : "smooth" }); } }));
  });

  /* Drew blep: once when he scrolls into view, again on hover or tap */
  $$(".drew-art").forEach(el => {
    const play = () => { el.classList.remove("drew-play"); void el.offsetWidth; el.classList.add("drew-play"); };
    el.addEventListener("mouseenter", play); el.addEventListener("click", play);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); play(); } });
    if ("IntersectionObserver" in window && !reduced()) new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { setTimeout(play, 500); o.disconnect(); } }, { threshold: .6 }).observe(el);
  });

  /* the dot: hops across the disciplines, squashes on landing, settles as the full stop */
  const hero = $(".hero"), slot = $(".dot-slot"), words = $$(".disciplines li");
  if (hero && slot) {
    const dot = document.createElement("div"); dot.className = "jdot"; dot.setAttribute("aria-hidden", "true"); hero.appendChild(dot);
    let size = 16, pos = { x: 0, y: 0 }, busy = false, home = null;
    const rel = el => { const a = el.getBoundingClientRect(), b = hero.getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }; };
    const slotPos = () => { const r = rel(slot); size = Math.max(10, r.w); return { x: r.x + r.w / 2, y: r.y + r.h - size / 2 - size * 0.02 }; };
    const wordPos = w => { const r = rel(w); return { x: r.x + Math.min(r.w / 2, 40), y: r.y + 2 }; };
    const place = (p, sx = 1, sy = 1) => { pos = p; dot.style.width = dot.style.height = size + "px"; dot.style.transform = `translate(${p.x - size / 2}px,${p.y - size / 2}px) scale(${sx},${sy})`; };
    const hop = (to, dur = 480) => new Promise(res => {
      const from = { ...pos }, peak = Math.min(from.y, to.y) - Math.max(60, Math.abs(to.x - from.x) * 0.25), t0 = performance.now();
      const step = now => {
        const k = Math.min(1, (now - t0) / dur), x = from.x + (to.x - from.x) * k;
        const y = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * peak + k * k * to.y;   // quadratic arc
        const stretch = 1 + 0.22 * Math.sin(Math.PI * k);                             // stretch in flight
        place({ x, y }, 1 / Math.sqrt(stretch), stretch);
        if (k < 1) requestAnimationFrame(step); else squash(to).then(res);
      };
      requestAnimationFrame(step);
    });
    const squash = to => new Promise(res => {
      const t0 = performance.now(), dur = 260;
      const step = now => { const k = Math.min(1, (now - t0) / dur), s = Math.sin(Math.PI * k) * Math.exp(-2 * k);
        place({ x: to.x, y: to.y + size * 0.18 * s }, 1 + 0.45 * s, 1 - 0.38 * s); if (k < 1) requestAnimationFrame(step); else { place(to); res(); } };
      requestAnimationFrame(step);
    });
    const light = w => { words.forEach(x => x.classList.toggle("on", x === w)); };
    async function intro() {
      home = slotPos(); dot.style.opacity = 1;
      if (reduced() || !words.length) { place(home); return; }
      busy = true;
      const first = wordPos(words[0]); place({ x: first.x - 80, y: first.y - 120 });
      for (const w of words) { await hop(wordPos(w), 420); light(w); }
      light(null); await hop(home, 640); busy = false;
    }
    let back;
    words.forEach(w => w.addEventListener("mouseenter", async () => { if (busy) return; clearTimeout(back); busy = true; light(w); await hop(wordPos(w), 380); busy = false;
      back = setTimeout(async () => { if (busy) return; busy = true; light(null); await hop(slotPos(), 520); busy = false; }, 1100); }));
    addEventListener("resize", () => { if (!busy) { home = slotPos(); place(home); } });
    const start = () => intro();
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(start, 250));
  }

  /* old #tab links from the first version of the site */
  const OLD = { resume: "professional.html#timeline", "resume-standard": "professional.html#resume", research: "research.html" };
  if (document.body.dataset.page === "home" && OLD[location.hash.slice(1)]) location.replace(OLD[location.hash.slice(1)]);

  /* timeline (professional page) */
  const tl = $("#tl");
  if (tl && window.TIMELINE) {
    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], NOW = [2026, 11];
    const fmt = d => d ? `${MON[d[1] - 1]} ${d[0]}` : "Present";
    const dur = (a, b) => { const e = b || NOW, m = (e[0] - a[0]) * 12 + e[1] - a[1] + 1, y = Math.floor(m / 12), r = m % 12; return [y ? `${y} yr` : "", r ? `${r} mo` : ""].filter(Boolean).join(" ") || "1 mo"; };
    const items = [...window.TIMELINE].sort((a, b) => (b.start[0] * 12 + b.start[1]) - (a.start[0] * 12 + a.start[1]));
    let html = '<div class="spine"><b></b></div>', yr = null;
    items.forEach(e => {
      if (e.start[0] !== yr) { yr = e.start[0]; html += `<div class="tl-year" data-y="${yr}"><span>${yr}</span></div>`; }
      html += `<article class="tl-item" data-kind="${e.kind}"><div class="when">${fmt(e.start)} – ${fmt(e.end)}<br>${dur(e.start, e.end)}</div><span class="node"></span>
        <div class="tl-card"><h3>${e.org}</h3><div class="t">${e.title}</div><p>${e.lead}</p></div></article>`;
    });
    tl.innerHTML = html;
    $$(".tl-filters button").forEach(b => b.addEventListener("click", () => {
      $$(".tl-filters button").forEach(x => x.setAttribute("aria-pressed", x === b));
      const k = b.dataset.k;
      $$(".tl-item", tl).forEach(n => n.hidden = !(k === "all" || n.dataset.kind === k));
      $$(".tl-year", tl).forEach(y => { let n = y.nextElementSibling, any = false; while (n && !n.classList.contains("tl-year")) { if (!n.hidden) any = true; n = n.nextElementSibling; } y.hidden = !any; });
      update();
    }));
    const update = () => {
      if (tl.offsetParent === null) return;
      const r = tl.getBoundingClientRect(), mark = innerHeight * 0.6;
      tl.style.setProperty("--fill", (Math.max(0, Math.min(1, (mark - r.top) / r.height)) * 100).toFixed(1) + "%");
      $$(".tl-item,.tl-year", tl).forEach(n => n.classList.toggle("lit", !n.hidden && n.getBoundingClientRect().top < mark));
    };
    addEventListener("scroll", update, { passive: true }); addEventListener("resize", update); addEventListener("tabchange", () => requestAnimationFrame(update)); update();
  }

  $$("[data-year]").forEach(e => e.textContent = new Date().getFullYear());
})();
