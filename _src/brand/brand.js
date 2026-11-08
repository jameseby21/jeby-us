/* jeby brand rotation (the cycling rule). Each product mark and the favicon pick one candidate at random
   per browser session, never the same as the previous session's pick, and keep it for the whole session.
   Light and dark files follow the page theme (jeby.us toggle) or the OS theme (favicons).
   Storage is a convenience: when it is blocked, the first candidate stays, which is what the build rendered. */
(() => {
  const get = (s, k) => { try { return s.getItem(k); } catch (e) { return null; } };
  const set = (s, k, v) => { try { s.setItem(k, v); } catch (e) {} };
  function pick(key, n) {
    if (n < 2) return 0;
    const cur = get(sessionStorage, key);
    if (cur !== null && +cur < n) return +cur;
    const last = get(localStorage, key + ":last");
    let i = Math.floor(Math.random() * n);
    if (last !== null && i === +last) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    set(sessionStorage, key, String(i)); set(localStorage, key + ":last", String(i));
    return i;
  }
  document.querySelectorAll(".mark.brand[data-cands]").forEach(el => {
    let c; try { c = JSON.parse(el.dataset.cands); } catch (e) { return; }
    const [light, dark] = c[pick("jeby-mark:" + el.dataset.brand, c.length)];
    const p = el.dataset.prefix || "assets/brand/";
    const l = el.querySelector(".m-l"), d = el.querySelector(".m-d");
    if (l) l.src = p + light; if (d) d.src = p + dark;
  });
  const meta = document.querySelector('meta[name="jeby-favicons"]');
  if (meta) {
    let c; try { c = JSON.parse(meta.content); } catch (e) { c = null; }
    if (c && c.length) {
      const [light, dark] = c[pick("jeby-fav:" + meta.dataset.site, c.length)];
      const p = meta.dataset.prefix || "assets/brand/";
      const lf = document.querySelector('link[data-fav="light"]'), df = document.querySelector('link[data-fav="dark"]');
      if (lf) lf.href = p + light; if (df) df.href = p + dark;
    }
  }
})();
