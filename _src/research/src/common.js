/* Shared pieces for the galaxy-cluster visuals: RNG, cluster model, canvas sizing, colors. */
const GX = (() => {
  const C = {
    void: "#050507", plate: "#0d0d11", seam: "#22212a", chalk: "#eeecf2", ash: "#9b98a8",
    neon: [255, 43, 61], blue: [64, 132, 255], silver: "#cfcdd8",
    mono: '"IBM Plex Mono", ui-monospace, Menlo, monospace',
    body: '"Figtree", ui-sans-serif, system-ui, sans-serif',
    display: '"Archivo", "Arial Narrow", system-ui, sans-serif',
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.gauss = () => { let u = 0, v = 0; while (!u) u = f(); while (!v) v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    return f;
  }

  /* Calibration used everywhere on screen: the poster's estimates.
     log10 σ = β0 + β1 log10 M, written as σ = σ15 (M / 10^15)^β1.  */
  const B1 = 0.39, SIG15 = 1289;
  const sigmaFor = logM => SIG15 * Math.pow(10, B1 * (logM - 15));
  const massFrom = sig => 1e15 * Math.pow(sig / SIG15, 1 / B1);      // solar masses
  const logMassFrom = sig => 15 + Math.log10(sig / SIG15) / B1;

  // Unit vectors spread over a sphere (Fibonacci), then randomly turned.
  function sightlines(r, k) {
    const out = [], g = Math.PI * (3 - Math.sqrt(5)), off = r() * 6.28;
    for (let i = 0; i < k; i++) {
      const y = 1 - (i + 0.5) / k * 2, rad = Math.sqrt(1 - y * y), th = g * i + off;
      out.push([Math.cos(th) * rad, y * 0.85, Math.sin(th) * rad]);
    }
    return out.map(normalize);
  }
  function normalize(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const sd = xs => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)); };

  /* A mock cluster: a triaxial cloud of member galaxies with anisotropic velocities,
     so the measured dispersion depends on the direction you look from.
     opt.subs adds infalling groups (subhalos) with their own bulk velocity. */
  function makeCluster(seed, logM, n, k = 8, opt = {}) {
    const r = rng(seed), sig = sigmaFor(logM);
    const ax = [1.0, 0.72 + r() * 0.12, 0.55 + r() * 0.1];
    const an = [1.18, 1.0, 0.82], norm = Math.sqrt((an[0] ** 2 + an[1] ** 2 + an[2] ** 2) / 3);
    const gal = [];
    const add = (p, v, s, extra) => { const l = Math.hypot(...v) || 1; gal.push({ p, v, vh: [v[0] / l, v[1] / l, v[2] / l], ph: r() * 6.28, s, ...extra }); };
    for (let i = 0; i < n; i++) {
      let p;
      do { p = [r.gauss() * ax[0] * 0.42, r.gauss() * ax[1] * 0.42, r.gauss() * ax[2] * 0.42]; } while (Math.hypot(...p) > 1.15);
      add(p, [r.gauss() * an[0] / norm * sig, r.gauss() * an[1] / norm * sig, r.gauss() * an[2] / norm * sig], 0.6 + Math.pow(r(), 3) * 2.2);
    }
    (opt.subs || []).forEach(sub => {
      for (let i = 0; i < sub.n; i++) {
        const p = [sub.c[0] + r.gauss() * sub.scale, sub.c[1] + r.gauss() * sub.scale, sub.c[2] + r.gauss() * sub.scale];
        add(p, [sub.bulk[0] * sig + r.gauss() * sig * 0.35, sub.bulk[1] * sig + r.gauss() * sig * 0.35, sub.bulk[2] * sig + r.gauss() * sig * 0.35], 0.6 + Math.pow(r(), 3) * 1.8, { sub: true });
      }
      add(sub.c, [sub.bulk[0] * sig, sub.bulk[1] * sig, sub.bulk[2] * sig], 2.4, { bcg: true, sub: true });
    });
    // rescale so the average one-dimensional dispersion over the three axes equals the calibrated σ for this mass
    const mem = gal.filter(g => !g.bcg), s3 = Math.sqrt([0, 1, 2].reduce((acc, a) => acc + sd(mem.map(g => g.v[a])) ** 2, 0) / 3), sc = sig / s3;
    gal.forEach(g => { g.v = g.v.map(x => x * sc); });
    add([0, 0, 0], [0, 0, 0], 3.4, { bcg: true }); // brightest cluster galaxy at the core
    const los = sightlines(r, k);
    const sig_los = los.map(nv => sd(gal.filter(g => !g.bcg).map(g => dot(g.v, nv))));
    return { logM, sig, gal, los, sig_los, tilt: 0.35 + r() * 0.4, spin0: r() * 6.28 };
  }

  // body rotation: tilt about x, then spin about y
  function rot(p, spin, tilt) {
    const cs = Math.cos(spin), sn = Math.sin(spin), ct = Math.cos(tilt), st = Math.sin(tilt);
    const x = p[0] * cs + p[2] * sn, z = -p[0] * sn + p[2] * cs;
    const y = p[1] * ct - z * st, z2 = p[1] * st + z * ct;
    return [x, y, z2];
  }

  /* Draw a cluster centred at (cx,cy) with radius R.
     opt.vfun(g, vWorld, i) returns the galaxy's line-of-sight velocity (km/s) for colouring:
     red = moving away (redshift), blue = moving toward the observer (blueshift).
     opt.t animates a small drift of each galaxy along its own velocity. */
  function drawCluster(ctx, cl, cx, cy, R, spin, opt = {}) {
    const tilt = opt.tilt ?? cl.tilt, t = opt.t || 0;
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.25);
    halo.addColorStop(0, "rgba(255,90,100,0.13)"); halo.addColorStop(0.45, "rgba(255,43,61,0.05)"); halo.addColorStop(1, "rgba(255,43,61,0)");
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R * 1.25, 0, 6.283); ctx.fill();
    const pts = cl.gal.map((g, i) => {
      const d = opt.t ? 0.05 * Math.sin(t * 0.55 + g.ph) : 0;
      const p = d ? [g.p[0] + g.vh[0] * d, g.p[1] + g.vh[1] * d, g.p[2] + g.vh[2] * d] : g.p;
      return { g, i, q: rot(p, spin, tilt) };
    }).sort((a, b) => a.q[2] - b.q[2]);
    const prev = ctx.globalCompositeOperation; ctx.globalCompositeOperation = "lighter";
    for (const { g, i, q } of pts) {
      const x = cx + q[0] * R, y = cy + q[1] * R, depth = 0.65 + 0.35 * (q[2] + 1.1) / 2.2;
      let col = [225, 223, 232], a = 0.5 * depth;
      if (opt.vfun && !g.bcg) {
        const vw = rot(g.v, spin, tilt);
        const s = Math.max(-1, Math.min(1, opt.vfun(g, vw, i) / (2 * cl.sig)));
        const tgt = s >= 0 ? C.neon : C.blue, k = Math.min(1, Math.abs(s) * 1.7);
        col = [col[0] + (tgt[0] - col[0]) * k, col[1] + (tgt[1] - col[1]) * k, col[2] + (tgt[2] - col[2]) * k];
        a = (0.28 + 0.72 * Math.min(1, Math.abs(s) * 1.3)) * depth;
      }
      const rr = g.s * (R / 110) * (g.bcg ? 1.4 : 1) * depth + 0.6;
      if (rr > 1.6) { ctx.fillStyle = rgba(col, a * 0.18); ctx.beginPath(); ctx.arc(x, y, rr * 2.6, 0, 6.283); ctx.fill(); }
      ctx.fillStyle = rgba(col, Math.min(1, a + (g.bcg ? 0.45 : 0))); ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = prev;
  }

  /* A sightline beam through the cluster. dir is in the cluster's body frame unless world = true,
     in which case it is already a screen-space direction (x right, y down, z toward the viewer). */
  function drawBeam(ctx, cl, cx, cy, R, spin, dir, alpha = 1, label, world = false, tilt, maxLen = Infinity) {
    const d = world ? dir : rot(dir, spin, tilt ?? cl.tilt), L = Math.hypot(d[0], d[1]);
    const ux = L > 0.05 ? d[0] / L : 1, uy = L > 0.05 ? d[1] / L : 0, len = Math.min(maxLen, R * (0.45 + 1.25 * L));
    const x0 = cx - ux * len, y0 = cy - uy * len, x1 = cx + ux * len, y1 = cy + uy * len;
    const gr = ctx.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, rgba(C.neon, 0)); gr.addColorStop(0.5, rgba(C.neon, 0.55 * alpha)); gr.addColorStop(1, rgba(C.neon, 0.95 * alpha));
    ctx.save();
    ctx.strokeStyle = gr; ctx.lineWidth = 1.4; ctx.shadowColor = rgba(C.neon, 0.9 * alpha); ctx.shadowBlur = alpha > 0.5 ? 10 : 0;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    // observer end: a small eyepiece ring
    ctx.shadowBlur = 0; ctx.fillStyle = C.void; ctx.strokeStyle = rgba(C.neon, alpha); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x1, y1, 4.5, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.fillStyle = rgba(C.neon, alpha); ctx.beginPath(); ctx.arc(x1, y1, 1.6, 0, 6.283); ctx.fill();
    if (label) {
      ctx.font = `500 10.5px ${C.mono}`; ctx.fillStyle = rgba([238, 236, 242], Math.min(1, 0.4 + alpha));
      ctx.textAlign = ux >= 0 ? "left" : "right"; ctx.textBaseline = "middle";
      ctx.fillText(label, x1 + (ux >= 0 ? 9 : -9), y1);
    }
    ctx.restore();
    return [x1, y1];
  }

  function fit(canvas) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { ctx, w, h };
  }

  // Run only while visible on screen and while the tab is in front.
  function loop(el, frame) {
    let on = true, raf = 0, last = performance.now(), t = 0;
    const tick = now => { const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; t += dt; frame(t, dt); raf = on ? requestAnimationFrame(tick) : 0; };
    const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    if ("IntersectionObserver" in window) new IntersectionObserver(es => { on = es[0].isIntersecting && !document.hidden; on ? start() : 0; }, { threshold: 0.02 }).observe(el);
    document.addEventListener("visibilitychange", () => { on = !document.hidden; if (on) start(); });
    start();
    return { get t() { return t; }, set t(v) { t = v; } };
  }

  const fmtInt = v => Math.round(v).toLocaleString("en-US");
  const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const massLabel = (m, digits = 1) => { const e = Math.floor(Math.log10(m)), c = m / Math.pow(10, e); return `${c.toFixed(digits)} × 10${String(e).split("").map(ch => SUP[ch]).join("")} M☉`; };
  const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  return { C, rgba, rng, B1, SIG15, sigmaFor, massFrom, logMassFrom, makeCluster, rot, dot, sd, drawCluster, drawBeam, fit, loop, fmtInt, massLabel, reduced, ease, normalize, roundRect };
})();
