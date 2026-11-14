/* family.js: how jeby.us and jainsights.com point at each other.
   Three modes, one switch:
     A  one site    JA Insights lives inside jeby.us at /insights
     B  sisters     two separate sites that link to each other
     C  family bar  two separate sites sharing a thin bar across the top (recommended)
   Inside the prototype the mode comes from the parent page; on the live sites it comes from FAMILY_DEFAULT. */
(() => {
  const FAMILY_DEFAULT = "C";
  const ORIGINS = { jeby: "https://jeby.us/", jai: "https://jainsights.com/" };
  const me = document.currentScript && document.currentScript.dataset.site || "jeby";
  const proto = (() => { try { return window.parent !== window && window.parent.JEBY_FAMILY ? window.parent.JEBY_FAMILY : null; } catch (e) { return null; } })();
  const mode = () => (proto ? proto.mode : FAMILY_DEFAULT);
  const page = () => (location.pathname.split("/").pop() || "index.html");

  // where a cross-site link goes
  function href(site, pg) {
    pg = pg || "index.html";
    if (proto) return proto.base(site) + pg;
    if (site === me) return pg;
    if (mode() === "A" && site === "jai") return ORIGINS.jeby + "insights/" + (pg === "index.html" ? "" : pg.replace(".html", ""));
    return ORIGINS[site] + (pg === "index.html" ? "" : pg.replace(".html", ""));
  }
  function go(e, site, pg) {
    if (!proto) return;                                     // live site: let the link work normally
    e.preventDefault();
    proto.open(site, pg, mode() === "B" && site !== me);    // sisters open in a new tab, like a normal external link
  }

  const css = `
  .fam-bar{position:relative;z-index:70;display:flex;align-items:center;gap:6px;height:34px;padding:0 max(16px,env(safe-area-inset-left,0px));font:500 12px/1 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;background:#060606;color:#bdb8b0;border-bottom:1px solid #1f1e1c;overflow-x:auto;scrollbar-width:none}
  .fam-bar::-webkit-scrollbar{display:none}
  .fam-bar .lbl{font:600 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:#9a958c;margin-right:8px;white-space:nowrap}
  .fam-bar a{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border-radius:999px;color:#d9d4cc;text-decoration:none;white-space:nowrap;transition:background .15s,color .15s}
  .fam-bar a:hover{background:#1a1917;color:#fff}
  .fam-bar a[aria-current="true"]{background:#1d1c1a;color:#fff}
  .fam-bar a i{width:7px;height:7px;border-radius:50%;background:#e3262f;flex:none;transform:scale(.6);opacity:.5;transition:transform .25s,opacity .25s}
  .fam-bar a[aria-current="true"] i{transform:scale(1);opacity:1}
  .fam-bar a small{color:#9a958c;font-size:12px}
  .fam-bar .sp{flex:1}
  .fam-bar a.free{margin-left:auto;background:#d11f29;color:#fff;font-weight:500}
  .fam-bar a.free:hover,.fam-bar a.free[aria-current="true"]{background:#b8141e;color:#fff}
  .fam-bar a.free b{font:700 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;background:#fff;color:#e3262f;border-radius:999px;padding:3px 6px}
  .fam-host{position:relative;z-index:71;display:flex;align-items:center;gap:18px;height:46px;padding:0 max(16px,env(safe-area-inset-left,0px));background:#0c0b0a;color:#cdc8bf;font:500 14px/1 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;border-bottom:1px solid #2a2825;overflow-x:auto;scrollbar-width:none}
  .fam-host::-webkit-scrollbar{display:none}
  .fam-host .wm{font:800 20px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:-.03em;color:#f3f0ea;text-decoration:none;position:relative}
  .fam-host .wm b{position:absolute;left:.06em;top:-.02em;width:.21em;height:.21em;border-radius:50%;background:#e3262f}
  .fam-host a{color:#cdc8bf;text-decoration:none;white-space:nowrap}
  .fam-host a:hover,.fam-host a[aria-current="true"]{color:#fff}
  .fam-host a[aria-current="true"]{box-shadow:inset 0 -2px 0 #e3262f;padding-bottom:12px;margin-bottom:-12px}
  @media (max-width:560px){.fam-bar .lbl,.fam-bar a small{display:none}.fam-bar{gap:2px;justify-content:center}.fam-host{gap:14px;font-size:13px}}
  [data-family-only]{display:none!important}
  html[data-fam="A"] [data-family-only~="A"],html[data-fam="B"] [data-family-only~="B"],html[data-fam="C"] [data-family-only~="C"]{display:revert!important}`;

  function apply() {
    const m = mode();
    document.documentElement.dataset.fam = m;
    if (!document.getElementById("fam-css")) { const s = document.createElement("style"); s.id = "fam-css"; s.textContent = css; document.head.appendChild(s); }
    document.querySelectorAll(".fam-bar,.fam-host").forEach(n => n.remove());
    const top = document.body.firstElementChild;

    if (m === "C") {                                        // shared family bar on both sites
      const bar = document.createElement("nav"); bar.className = "fam-bar"; bar.setAttribute("aria-label", "jeby family of sites");
      bar.innerHTML = `<span class="lbl">jeby family</span>
        <a data-x="jeby" ${me === "jeby" && page() !== "lab.html" ? 'aria-current="true"' : ""}><i></i>jeby.us <small>James Eby</small></a>
        <a data-x="jai" ${me === "jai" && page() !== "report.html" ? 'aria-current="true"' : ""}><i></i>JA Insights <small>Data consulting</small></a>
        <a data-x="jeby" data-p="lab.html" ${me === "jeby" && page() === "lab.html" ? 'aria-current="true"' : ""}><i></i>jebyLabs <small>Open source</small></a>
        <a class="free" data-x="jai" data-p="report.html" ${me === "jai" && page() === "report.html" ? 'aria-current="true"' : ""}><b>Free</b> data report</a>`;
      document.body.insertBefore(bar, top);
    }
    if (m === "A" && me === "jai") {                       // JA Insights shown as a section of jeby.us
      const host = document.createElement("nav"); host.className = "fam-host"; host.setAttribute("aria-label", "jeby.us");
      const items = [["index.html", "Home"], ["professional.html", "Professional"], ["teach.html", "Teach"], ["lab.html", "Lab"], ["insights", "Insights"], ["research.html", "Research"], ["about.html", "About"]];
      host.innerHTML = `<a class="wm" data-x="jeby" data-p="index.html">ȷeby<b></b></a>` + items.slice(1).map(([p, n]) =>
        p === "insights" ? `<a data-x="jai" data-p="index.html" aria-current="true">${n}</a>` : `<a data-x="jeby" data-p="${p}">${n}</a>`).join("");
      document.body.insertBefore(host, top);
    }
    // wire every cross-site link
    document.querySelectorAll("[data-x]").forEach(a => {
      const site = a.dataset.x; if (site === "lab") return;
      const pg = a.dataset.p || "index.html";
      a.href = href(site, pg);
      if (proto && !a._fam) { a._fam = true; a.addEventListener("click", e => go(e, a.dataset.x, a.dataset.p || "index.html")); }
    });
  }
  window.familyApply = apply;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
  if (proto && proto.loaded) proto.loaded(me, page(), document.title);
})();
