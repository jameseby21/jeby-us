/* jeby brand rotation (the cycling rule, Branding assets READ ME).
   1-2 One candidate per slot at random per browser session, never the previous session's pick, kept for the whole session.
   3   Clicking a mark moves to the next candidate; a hand pick sticks in this browser (localStorage) and replaces the random pick.
   4   The favicon follows the logo: a favicon whose product has a mark on the page shares that mark's pick.
   5   Light and dark files follow the site's own toggle (data-theme on <html>), else the default the build names, else the OS.
   Storage is a convenience: when it is blocked, the first candidate stays, which is what the build rendered. */
(() => {
  const get = (s, k) => { try { return s.getItem(k); } catch (e) { return null; } };
  const set = (s, k, v) => { try { s.setItem(k, v); } catch (e) {} };
  const root = document.documentElement;
  const HAND = "jeby-hand:";
  function pick(key, n) {
    if (n < 2) return 0;
    const hand = get(localStorage, HAND + key);
    if (hand !== null && +hand < n) return +hand;
    const cur = get(sessionStorage, key);
    if (cur !== null && +cur < n) return +cur;
    const last = get(localStorage, key + ":last");
    let i = Math.floor(Math.random() * n);
    if (last !== null && i === +last) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    set(sessionStorage, key, String(i)); set(localStorage, key + ":last", String(i));
    return i;
  }
  function cycle(key, n) {
    const next = (pick(key, n) + 1) % n;
    set(localStorage, HAND + key, String(next)); set(sessionStorage, key, String(next));
    return next;
  }
  const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };
  const meta = document.querySelector('meta[name="jeby-favicons"]');
  const theme = () => root.dataset.theme === "light" || root.dataset.theme === "dark" ? root.dataset.theme
    : meta && meta.dataset.default ? meta.dataset.default : matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";

  const favKey = () => meta ? (meta.dataset.product ? "jeby-mark:" + meta.dataset.product : "jeby-fav:" + meta.dataset.site) : null;
  function paintFavicon() {
    const c = meta && parse(meta.content); if (!c || !c.length) return;
    const [light, dark] = c[pick(favKey(), c.length)];
    document.querySelectorAll('link[data-fav]').forEach(l => l.remove());
    const l = document.createElement("link"); l.rel = "icon"; l.type = "image/svg+xml"; l.dataset.fav = theme();
    l.href = (meta.dataset.prefix || "assets/brand/") + (theme() === "light" ? light : dark);
    document.head.appendChild(l);
  }
  function paintMark(el) {
    const c = parse(el.dataset.cands); if (!c) return;
    const [light, dark] = c[pick("jeby-mark:" + el.dataset.brand, c.length)];
    const p = el.dataset.prefix || "assets/brand/";
    const l = el.querySelector(".m-l"), d = el.querySelector(".m-d");
    if (l) l.src = p + light; if (d) d.src = p + dark;
  }
  const marks = [...document.querySelectorAll(".mark.brand[data-cands]")];
  marks.forEach(el => {
    paintMark(el);
    const c = parse(el.dataset.cands); if (!c || c.length < 2) return;
    el.style.cursor = "pointer"; el.title = "Click to try the next mark";
    el.addEventListener("click", ev => {
      ev.preventDefault(); ev.stopPropagation(); // inside a <summary> the click would also open the row
      cycle("jeby-mark:" + el.dataset.brand, c.length);
      marks.filter(m => m.dataset.brand === el.dataset.brand).forEach(paintMark);
      paintFavicon();
    });
  });
  paintFavicon();
  new MutationObserver(paintFavicon).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", paintFavicon);
})();
