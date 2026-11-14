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

/* Illustrative data + the two fits. Every number on screen in visual 2 is computed here. */
const GXM = (() => {
  const TRUE_B1 = 0.40, TRUE_B0 = Math.log10(1285) - 0.40 * 15, SU = 0.04, SE = 0.02;
  const RHO_TRUE = SU * SU / (SU * SU + SE * SE);

  function gen(seed) {
    const r = GX.rng(seed), K = 36, cl = [];
    for (let c = 0; c < K; c++) {
      const x = 14.17 + Math.min(1.12, -Math.log(1 - r()) * 0.33);
      const m = r() < 0.28 ? 12 + Math.floor(r() * 9) : 2 + Math.floor(r() * 5);
      const u = r.gauss() * SU, ys = [];
      for (let k = 0; k < m; k++) ys.push(TRUE_B0 + TRUE_B1 * x + u + r.gauss() * SE);
      cl.push({ x, m, ys, ybar: ys.reduce((a, b) => a + b, 0) / m });
    }
    cl.sort((a, b) => a.x - b.x);
    cl.forEach((c, i) => c.id = i);
    return cl;
  }

  // weighted least squares on (x, y) with weights w; returns b0, b1, covariance scaled by s2
  function wls(xs, ys, ws, s2) {
    let S = 0, Sx = 0, Sxx = 0, Sy = 0, Sxy = 0;
    for (let i = 0; i < xs.length; i++) { const w = ws[i]; S += w; Sx += w * xs[i]; Sxx += w * xs[i] * xs[i]; Sy += w * ys[i]; Sxy += w * xs[i] * ys[i]; }
    const det = S * Sxx - Sx * Sx, b1 = (S * Sxy - Sx * Sy) / det, b0 = (Sy - b1 * Sx) / S;
    return { b0, b1, cov: [[s2 * Sxx / det, -s2 * Sx / det], [-s2 * Sx / det, s2 * S / det]] };
  }

  function fits(cl) {
    const X = [], Y = [];
    cl.forEach(c => c.ys.forEach(y => { X.push(c.x); Y.push(y); }));
    const N = X.length;
    // ordinary: every sightline counts once, as if independent
    const o0 = wls(X, Y, X.map(() => 1), 1);
    const rss = Y.reduce((a, y, i) => a + (y - o0.b0 - o0.b1 * X[i]) ** 2, 0), s2 = rss / (N - 2);
    const ols = wls(X, Y, X.map(() => 1), s2);
    // estimate the within-cluster correlation from the data
    let wss = 0; cl.forEach(c => c.ys.forEach(y => wss += (y - c.ybar) ** 2));
    const within = wss / (N - cl.length), rho = Math.max(0, Math.min(0.97, 1 - within / s2));
    // weighted (GLS with block-diagonal Σ, equal correlation inside a block):
    // a cluster of m sightlines reduces exactly to one point at its mean with weight m / (1 + (m-1)ρ)
    cl.forEach(c => { c.w = c.m / (1 + (c.m - 1) * rho); c.wPoint = 1 / (1 + (c.m - 1) * rho); });
    const gls = wls(cl.map(c => c.x), cl.map(c => c.ybar), cl.map(c => c.w), s2);
    const nEff = cl.reduce((a, c) => a + c.w, 0);
    return { N, K: cl.length, s2, rho, ols, gls, nEff };
  }

  const se = f => Math.sqrt(f.cov[1][1]);
  function pick() {
    for (let seed = 1; seed < 4000; seed++) {
      const cl = gen(seed), F = fits(cl);
      const d = F.gls.b1 - F.ols.b1;
      if (F.ols.b1 > 0.34 && F.ols.b1 < 0.366 && F.gls.b1 > 0.396 && F.gls.b1 < 0.42 && d > 4 * se(F.ols) && Math.abs(F.gls.b1 - TRUE_B1) < 1.5 * se(F.gls)) return { seed, cl, F };
    }
    const cl = gen(1); return { seed: 1, cl, F: fits(cl) };
  }
  return { gen, fits, pick, se, TRUE_B1, RHO_TRUE };
})();
if (typeof module !== "undefined") module.exports = GXM;

/* Visual 1: one supercluster tumbling in front of a fixed observer. Eight viewpoints around it;
   the active one cycles. Galaxies redshift / blueshift by their speed along the active sightline,
   and the panel turns the measured dispersion into a mass estimate. */
function mountOrbit(root, opt = {}) {
  const { C, rgba, makeCluster, drawCluster, drawBeam, fit, loop, fmtInt, massLabel, reduced, ease, normalize, rot, dot, sd, massFrom, SIG15, B1, roundRect } = GX;
  const canvas = root.querySelector("canvas");
  const LOGM = opt.logM ?? 15.08, DM = 0.85;                       // 1.2 × 10^15 solar masses; ~85 % of it dark matter
  const cl = makeCluster(41, LOGM, 210, 8, { subs: [
    { c: [0.62, 0.28, -0.3], n: 34, scale: 0.13, bulk: [-0.7, -0.2, 0.75] },
    { c: [-0.55, -0.42, 0.25], n: 28, scale: 0.12, bulk: [0.55, 0.3, -0.8] },
    { c: [-0.2, 0.6, 0.55], n: 22, scale: 0.1, bulk: [0.2, -0.6, -0.65] },
  ] });
  const mIdx = cl.gal.map((g, i) => g.bcg ? -1 : i).filter(i => i >= 0);
  const MTRUE = Math.pow(10, LOGM);
  // eight observers around the cluster, in screen space, each a little above or below the screen plane
  const K = 8, DIRS = Array.from({ length: K }, (_, i) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / K + 0.32, z = (i % 2 ? -1 : 1) * 0.5;
    return normalize([Math.cos(a), Math.sin(a) * 0.8, z]);
  });
  const r = GX.rng(5), stars = Array.from({ length: 260 }, () => ({ x: r(), y: r(), s: r() * 0.9 + 0.2, a: r() * 0.35 + 0.05 }));
  const P = 4.4;                                                    // seconds per sightline
  // fixed axis ranges, so the ticks move and the axes stay still
  const SR = [cl.sig * 0.74, cl.sig * 1.3], MR = [massFrom(SR[0]), massFrom(SR[1])];

  if (opt.title) {
    const ov = document.createElement("div"); ov.className = "orbit-overlay";
    ov.innerHTML = `<div class="orbit-eyebrow">${opt.eyebrow || ""}</div><h2 class="orbit-title">${opt.title}</h2>${opt.sub ? `<p class="orbit-sub">${opt.sub}</p>` : ""}`;
    root.appendChild(ov);
  }

  function frame(t) {
    const { ctx, w, h } = fit(canvas), still = reduced(), wide = w >= 880;
    if (!w || !h) return;
    ctx.fillStyle = C.void; ctx.fillRect(0, 0, w, h);
    for (const s of stars) { ctx.fillStyle = `rgba(230,228,240,${s.a})`; ctx.fillRect(((s.x + (still ? 0 : t * 0.0012)) % 1) * w, s.y * h, s.s, s.s); }

    // the cluster tumbles; the observers stay put
    const spin = cl.spin0 + (still ? 0 : t * 0.085), tilt = cl.tilt + (still ? 0 : 0.38 * Math.sin(t * 0.047));
    const vw = cl.gal.map(g => rot(g.v, spin, tilt));
    const sig = DIRS.map(d => sd(mIdx.map(i => dot(vw[i], d))));
    const u = t / P, k = Math.floor(u) % K, k2 = (k + 1) % K, f = still ? 0 : ease((u - Math.floor(u) - 0.78) / 0.22);
    const dir = normalize([DIRS[k][0] + (DIRS[k2][0] - DIRS[k][0]) * f, DIRS[k][1] + (DIRS[k2][1] - DIRS[k][1]) * f, DIRS[k][2] + (DIRS[k2][2] - DIRS[k][2]) * f]);
    const cur = f > 0.5 ? k2 : k, sigCur = sig[k] + (sig[k2] - sig[k]) * f, mCur = massFrom(sigCur);

    const panelW = wide ? Math.min(372, w * 0.34) : w - 32, panelH = 262;
    const px = 16, py = h - panelH - 16;
    const cx = wide ? w * 0.66 : w / 2, cy = wide ? h * 0.5 : (py - 16) * 0.56 + 40;
    const R = wide ? Math.min(w * 0.2, h * 0.36) : Math.min(w * 0.3, (py - 90) * 0.42);

    const maxLen = 0.86 * Math.min(cx, w - cx, cy - (wide ? 0 : 36), wide ? h - cy : py - 12 - cy);
    for (let i = 0; i < K; i++) if (i !== cur) drawBeam(ctx, cl, cx, cy, R, spin, DIRS[i], 0.14, String(i + 1), true, undefined, maxLen);
    drawCluster(ctx, cl, cx, cy, R, spin, { tilt, t: still ? 0 : t, vfun: (g, v) => dot(v, dir) });
    drawBeam(ctx, cl, cx, cy, R, spin, dir, 1, `LOS ${cur + 1}`, true, undefined, maxLen);

    /* ---------------- measurement panel ---------------- */
    ctx.save();
    roundRect(ctx, px, py, panelW, panelH, 14); ctx.fillStyle = "rgba(13,13,17,0.78)"; ctx.fill(); ctx.strokeStyle = C.seam; ctx.lineWidth = 1; ctx.stroke();
    const L = px + 18, Wd = panelW - 36; let y = py + 24;
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    ctx.font = `600 10.5px ${C.mono}`; ctx.fillStyle = rgba(C.neon, 1); ctx.fillText(`SIGHTLINE ${cur + 1} OF ${K}`, L, y);
    ctx.textAlign = "right"; ctx.fillStyle = C.ash; ctx.font = `400 10.5px ${C.mono}`; ctx.fillText("velocity dispersion", L + Wd, y);
    y += 30;
    ctx.textAlign = "left"; ctx.font = `800 26px ${C.display}`; ctx.fillStyle = C.chalk; ctx.fillText(`σ = ${fmtInt(sigCur)} km/s`, L, y);

    // σ axis
    y += 20;
    const SX = v => L + Math.max(0, Math.min(1, (v - SR[0]) / (SR[1] - SR[0]))) * Wd;
    ctx.strokeStyle = C.seam; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + Wd, y); ctx.stroke();
    ctx.font = `400 9.5px ${C.mono}`; ctx.fillStyle = C.ash; ctx.textAlign = "left"; ctx.fillText(`${fmtInt(SR[0])} km/s`, L, y + 13); ctx.textAlign = "right"; ctx.fillText(fmtInt(SR[1]), L + Wd, y + 13);
    // mass axis (linear), fed by the σ ticks
    const ym = y + 44, MX = v => L + Math.max(0, Math.min(1, (v - MR[0]) / (MR[1] - MR[0]))) * Wd;
    ctx.strokeStyle = C.seam; ctx.beginPath(); ctx.moveTo(L, ym); ctx.lineTo(L + Wd, ym); ctx.stroke();
    ctx.fillStyle = C.ash; ctx.textAlign = "left"; ctx.fillText(massLabel(MR[0]), L, ym + 13); ctx.textAlign = "right"; ctx.fillText(massLabel(MR[1]), L + Wd, ym + 13);
    sig.forEach((v, j) => {
      const on = j === cur, m = massFrom(v);
      ctx.strokeStyle = on ? rgba(C.neon, 1) : "rgba(200,198,210,0.28)"; ctx.lineWidth = on ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(SX(v), y + 5); ctx.lineTo(MX(m), ym - 5); ctx.stroke();   // connector: σ → mass
      ctx.strokeStyle = on ? rgba(C.neon, 1) : "rgba(200,198,210,0.5)";
      if (on) { ctx.shadowColor = rgba(C.neon, 0.9); ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.moveTo(SX(v), y - (on ? 7 : 4)); ctx.lineTo(SX(v), y + (on ? 7 : 4)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(MX(m), ym - (on ? 7 : 4)); ctx.lineTo(MX(m), ym + (on ? 7 : 4)); ctx.stroke(); ctx.shadowBlur = 0;
    });
    // the halo's true mass in the simulation
    ctx.fillStyle = C.chalk; ctx.beginPath(); ctx.moveTo(MX(MTRUE), ym + 8); ctx.lineTo(MX(MTRUE) - 4, ym + 15); ctx.lineTo(MX(MTRUE) + 4, ym + 15); ctx.closePath(); ctx.fill();
    ctx.textAlign = "center"; ctx.font = `400 9.5px ${C.mono}`; ctx.fillStyle = C.ash; ctx.fillText("simulation", MX(MTRUE), ym + 26);
    ctx.textAlign = "left"; ctx.fillStyle = C.ash; ctx.font = `400 9.5px ${C.mono}`;
    ctx.fillText("mass", L, ym - 10);

    // estimates
    y = ym + 50;
    const row = (lab, val, col) => { ctx.textAlign = "left"; ctx.font = `400 12px ${C.body}`; ctx.fillStyle = C.ash; ctx.fillText(lab, L, y); ctx.textAlign = "right"; ctx.font = `500 12px ${C.mono}`; ctx.fillStyle = col; ctx.fillText(val, L + Wd, y); y += 19; };
    const err = (mCur / MTRUE - 1) * 100;
    row("Mass from this sightline", massLabel(mCur, 2), C.chalk);
    row(`Dark matter, about ${Math.round(DM * 100)}% of it`, massLabel(mCur * DM, 2), C.chalk);
    row("Against the simulation's mass", `${err >= 0 ? "+" : "−"}${Math.abs(err).toFixed(0)}%`, Math.abs(err) < 8 ? C.chalk : rgba(err > 0 ? C.neon : C.blue, 1));

    // colour scale
    y += 2;
    const g = ctx.createLinearGradient(L, 0, L + Wd, 0);
    g.addColorStop(0, rgba(C.blue, 1)); g.addColorStop(0.5, "rgba(225,223,232,0.55)"); g.addColorStop(1, rgba(C.neon, 1));
    ctx.fillStyle = g; ctx.fillRect(L, y, Wd, 4);
    ctx.font = `400 9.5px ${C.mono}`; ctx.fillStyle = C.ash; ctx.textAlign = "left"; ctx.fillText(`← toward you  −${fmtInt(2 * cl.sig)} km/s`, L, y + 15);
    ctx.textAlign = "right"; ctx.fillText(`+${fmtInt(2 * cl.sig)} km/s  away →`, L + Wd, y + 15);
    ctx.restore();

    // calibration note, bottom right
    if (wide) { ctx.textAlign = "right"; ctx.font = `400 10px ${C.mono}`; ctx.fillStyle = "rgba(155,152,168,0.8)"; ctx.fillText(`σ = ${SIG15} km/s · (M / 10¹⁵ M☉)^${B1}   ·   calibration from the poster`, w - 18, h - 14); }
  }
  loop(root, frame);
}

/* Research slideshow: one slide per section of the 2015 poster, each with its own animation.
   Slide 0 is the supercluster cover (mountOrbit). Every other slide draws on one shared canvas. */
function mountDeck(root, opt = {}) {
  const { C, rgba, rng, makeCluster, drawCluster, drawBeam, fit, loop, fmtInt, massLabel, reduced, ease, normalize, rot, dot, sd, roundRect } = GX;
  const NEON = C.neon, BLUE = C.blue, CHALK = C.chalk, ASH = C.ash;
  const mono = (s, wt = 500) => `${wt} ${s}px ${C.mono}`, body = (s, wt = 400) => `${wt} ${s}px ${C.body}`;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const sup = n => String(n).split("").map(c => ({ "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" })[c]).join("");

  /* ---------- poster numbers (2015) ---------- */
  const NT = { b1: 0.375, s15: 1249 };                          // Ntampaka et al. (2014)
  const LOS1 = { b1: 0.38961, b1se: 0.00012, s15: 1288.869, s15se: 0.19573, reps: 2000 };
  // Figure 3, read off the poster: sample size → [mean, low, high]; null = beyond the plotted range
  const FIG3 = {
    n: [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    b1: [[0.424, null, null], [0.457, 0.409, null], [0.440, 0.417, 0.463], [0.422, 0.402, 0.443], [0.436, 0.418, 0.454], [0.436, 0.420, 0.453],
         [0.436, 0.421, 0.451], [0.437, 0.422, 0.452], [0.440, 0.426, 0.454], [0.430, 0.417, 0.442], [0.441, 0.430, 0.453]],
    s15: [[null, null, null], [1384, 1295, null], [1306, 1272, 1341], [1266, 1240, 1294], [1281, 1257, 1304], [1274, 1254, 1294],
          [1276, 1257, 1295], [1277, 1261, 1293], [1276, 1259, 1294], [1271, 1257, 1286], [1270, 1255, 1284]],
  };
  const FIG2 = [0.02, 0.06, 0.1, 0.14, 0.18, 0.22, 0.26, 0.3, 0.34, 0.38, 0.44, 0.5, 0.58, 0.68, 0.8, 0.98, 1.2, 1.65, 2.6, 8.6];

  const SLIDES = [
    { key: "cover", tab: "Title", cover: true },
    { key: "background", tab: "Background", eyebrow: "Background",
      title: "A cluster's mass is hidden. Its galaxies' speeds aren't.",
      body: ["A galaxy cluster is hundreds of galaxies held together by gravity, mostly the gravity of dark matter nobody can see. What a telescope can measure is how fast each galaxy moves toward us or away, from how far its light shifts blue or red.",
             "Heavier clusters pull harder, so their galaxies move faster. The spread of those speeds, the velocity dispersion σ, works as a scale once it's calibrated. Ntampaka et al. (2014) calibrated it on simulated clusters, where the true mass is known, each measured from several directions."],
      watch: "One galaxy's speed, the spread of all of them, and the curve that turns the spread into a mass.",
      improveLabel: "The question", improve: "The calibration treated every direction as a separate cluster. Does that bias the answer?",
      facts: ["log₁₀ σ = β₀ + β₁ log₁₀ M"] },
    { key: "data", tab: "Data", eyebrow: "Data",
      title: "2,514 clusters, seen from 24,451 directions",
      body: ["The clusters come from MultiDark, a public simulation that follows 3,840³ dark-matter particles while gravity pulls them into clumps. Following Ntampaka et al., a clump counts as a cluster if it holds more than 1.47 × 10¹⁴ solar masses and at least 20 member galaxies of 1.47 × 10¹² or more.",
             "Each line of sight gives one row: the true mass, which the simulation knows, and the dispersion an observer would measure from there."],
      watch: "The two cuts that turn clumps into clusters, then each cluster becoming about ten rows with one mass.",
      improve: "The same cluster shows up about ten times with the same mass, and the standard fit reads that as ten clusters.",
      facts: ["Predictor: log₁₀ M · Response: log₁₀ σ"] },
    { key: "correlation", tab: "Correlation", eyebrow: "The correlation between lines of sight",
      title: "Ten views of one cluster aren't ten clusters",
      body: ["Every line of sight through a cluster passes through the same galaxies, so turn the cluster and the dispersions from two nearby directions rise and fall together.",
             "The poster tested it directly: 2,000 lines of sight through one 20,000-galaxy cluster, and most pairs correlated close to 1. Counting them separately is like asking one person the same question ten times and calling it a survey."],
      watch: "Two sightlines through one turning cluster, their σ moving in step, and what 24,451 rows are really worth.",
      improve: "24,451 rows hold far less information than their count suggests, so the standard fit is more confident than it has any right to be.",
      facts: [] },
    { key: "weighted", tab: "Weighted fit", eyebrow: "Weighted linear regression",
      title: "Let each cluster count for what it actually tells you",
      body: ["Weighted (generalized) least squares uses the covariance between sightlines. The matrix Σ has one block per cluster and zeros everywhere else, so sightlines through the same cluster share their weight instead of each counting in full.",
             "The full matrix would be 24,451 × 24,451, too large to work with, so the method was tested two ways, on the next two slides."],
      watch: "Σ block by block, the five most-sampled clusters losing their grip on the fit, and the slope moving.",
      formula: "β = (XᵀΣ⁻¹X)⁻¹ XᵀΣ⁻¹Y",
      improve: "Often-measured clusters stop running the fit, the slope moves, and the error bars start telling the truth.",
      facts: ["X: 24,451 × 2 · Y: log₁₀ σ · 36 mock clusters"] },
    { key: "single", tab: "One sightline", eyebrow: "Single line of sight",
      title: "One random direction per cluster, 2,000 times",
      body: ["The bluntest fix: keep one random line of sight from each of the 2,514 clusters, so no two points share galaxies, and fit an ordinary regression. Then do it again, 2,000 times.",
             "The repetitions pile up well to the right of the published values (the red lines)."],
      watch: "2,000 refits building two histograms, one for the slope and one for σ₁₅, both landing to the right of the published values.",
      improve: "Without shared galaxies, the slope lands about 120 standard errors above the published value, and σ₁₅ about 200. That's not noise.",
      facts: ["β₁ = 0.38961 (SE 0.00012) vs 0.375", "σ₁₅ = 1,288.869 km/s (SE 0.196) vs 1,249"] },
    { key: "subsets", tab: "Subsets", eyebrow: "Cluster subset sample",
      title: "The weighted fit, from 5 clusters to 100",
      body: ["Weighted regression with the covariance included, run on random subsets: 100 simulated datasets at each size from 5 clusters to 100, each with a 95% interval.",
             "Past about 30 clusters the answer stops wandering. The slope settles between 0.42 and 0.445 and σ₁₅ between 1,270 and 1,285 km/s, both above the published values (red line)."],
      watch: "Estimates and 95% intervals as the subset grows; highlighted ones clear the published value.",
      improve: "Every slope interval from 10 clusters up clears the published value, and every σ₁₅ interval from 40 up.",
      facts: ["σ₁₅: the dispersion of a 10¹⁵ solar-mass cluster", "Points read from the poster's Figure 3"] },
    { key: "conclusions", tab: "Conclusions", eyebrow: "Conclusions",
      title: "Counted honestly, clusters come out a little lighter",
      body: ["Both approaches gave a larger slope and a larger normalization than Ntampaka et al., by margins many standard errors wide. They don't agree exactly with each other, most likely because the covariance estimate was imperfect. That's the loose end.",
             "In practice: measure the same σ, and the corrected calibration gives a mass a few percent lower. Cluster masses are one of the ways cosmologists count how much matter is out there, so a few percent is worth getting right."],
      watch: "Pick a σ and compare the mass each calibration gives it (one-sightline fit).",
      improve: "A calibration whose error bars mean what they say: for the same measured σ, a few percent less mass.",
      facts: [] },
    { key: "refs", tab: "References", eyebrow: "References",
      title: "Credits",
      body: ["James Eby, Department of Statistics, Carnegie Mellon University. Advisor: Peter Freeman. Poster, May 2015."],
      links: [["Ntampaka, M., et al. 2014, arXiv:1410.0686", "https://arxiv.org/abs/1410.0686"],
              ["MultiDark simulation, CosmoSim", "https://www.cosmosim.org"],
              ["Bolshoi and MultiDark simulations, HIPACC", "http://hipacc.ucsc.edu/Bolshoi/"],
              ["The original poster (PDF)", opt.poster || "research/poster.pdf"]] },
  ];

  /* ---------- markup ---------- */
  root.classList.add("deck");
  root.tabIndex = 0;
  root.setAttribute("role", "region");
  root.setAttribute("aria-roledescription", "slideshow");
  root.setAttribute("aria-label", "Research slideshow");
  root.innerHTML = `
    <div class="deck-stage">
      <div class="gx orbit deck-cover" role="img" aria-label="A simulated galaxy supercluster tumbles in front of eight fixed viewpoints; galaxies glow red moving away and blue moving toward the active sightline."><canvas></canvas></div>
      <div class="deck-split" hidden>
        <div class="deck-text" aria-live="polite"></div>
        <div class="deck-canvas"><canvas aria-hidden="true"></canvas></div>
      </div>
    </div>
    <div class="deck-nav">
      <button type="button" class="deck-arrow" data-a="prev" aria-label="Previous slide">‹</button>
      <div class="deck-chips" role="tablist" aria-label="Slides">${SLIDES.map((s, i) => `<button type="button" role="tab" data-i="${i}"><span>${String(i).padStart(2, "0")}</span>${s.tab}</button>`).join("")}</div>
      <button type="button" class="deck-arrow" data-a="next" aria-label="Next slide">›</button>
    </div>`;
  const cover = root.querySelector(".deck-cover"), split = root.querySelector(".deck-split");
  const text = root.querySelector(".deck-text"), canvas = root.querySelector(".deck-canvas canvas");
  const chips = [...root.querySelectorAll(".deck-chips button")];
  mountOrbit(cover, opt.cover || {});

  let cur = 0, local = 0;
  function show(i) {
    cur = (i + SLIDES.length) % SLIDES.length; local = 0;
    const s = SLIDES[cur];
    cover.hidden = !s.cover; split.hidden = !!s.cover;
    chips.forEach((b, j) => { b.setAttribute("aria-selected", j === cur); b.classList.toggle("done", j < cur); });
    const active = chips[cur]; if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest", inline: "center", behavior: reduced() ? "auto" : "smooth" });
    if (!s.cover) {
      text.innerHTML = `<div class="deck-eyebrow"><b>${String(cur).padStart(2, "0")}</b> · ${s.eyebrow}</div>
        <h3>${s.title}</h3>
        ${s.body.map(p => `<p>${p}</p>`).join("")}
        ${s.watch ? `<p class="deck-watch"><b>In the animation</b>${s.watch}</p>` : ""}
        ${s.improve ? `<div class="deck-improve"><b>${s.improveLabel || "What the method changes"}</b>${s.improve}</div>` : ""}
        ${s.formula ? `<div class="deck-formula">${s.formula}</div>` : ""}
        ${s.facts && s.facts.length ? `<ul class="deck-facts">${s.facts.map(f => `<li>${f}</li>`).join("")}</ul>` : ""}
        ${s.links ? `<ul class="deck-links">${s.links.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${t}</a></li>`).join("")}</ul>` : ""}`;
    }
  }
  chips.forEach(b => b.onclick = () => show(+b.dataset.i));
  root.querySelector('[data-a="prev"]').onclick = () => show(cur - 1);
  root.querySelector('[data-a="next"]').onclick = () => show(cur + 1);
  root.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") { show(cur + 1); e.preventDefault(); }
    if (e.key === "ArrowLeft") { show(cur - 1); e.preventDefault(); }
  });
  let sx = null;
  root.querySelector(".deck-stage").addEventListener("pointerdown", e => { sx = e.clientX; });
  root.querySelector(".deck-stage").addEventListener("pointerup", e => { if (sx !== null && Math.abs(e.clientX - sx) > 60) show(cur + (e.clientX < sx ? 1 : -1)); sx = null; });

  /* ---------- shared drawing helpers ---------- */
  const r0 = rng(5), stars = Array.from({ length: 200 }, () => ({ x: r0(), y: r0(), s: r0() * 0.9 + 0.2, a: r0() * 0.3 + 0.05 }));
  function ground(ctx, w, h) {
    ctx.fillStyle = C.void; ctx.fillRect(0, 0, w, h);
    for (const s of stars) { ctx.fillStyle = `rgba(230,228,240,${s.a})`; ctx.fillRect(s.x * w, s.y * h, s.s, s.s); }
  }
  function label(ctx, txt, x, y, opt2 = {}) {
    ctx.font = opt2.font || mono(10.5); ctx.fillStyle = opt2.color || ASH; ctx.textAlign = opt2.align || "left"; ctx.textBaseline = opt2.base || "alphabetic";
    ctx.fillText(txt, x, y);
  }
  // A plot frame: returns scale functions. r = {x, y, w, h}
  function frame(ctx, r, xr, yr, o = {}) {
    const X = v => r.x + (v - xr[0]) / (xr[1] - xr[0]) * r.w, Y = v => r.y + r.h - (v - yr[0]) / (yr[1] - yr[0]) * r.h;
    ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
    (o.yt || []).forEach(v => { ctx.beginPath(); ctx.moveTo(r.x, Y(v)); ctx.lineTo(r.x + r.w, Y(v)); ctx.stroke(); label(ctx, o.yf ? o.yf(v) : v, r.x - 6, Y(v) + 3.5, { align: "right", font: mono(9.5) }); });
    (o.xt || []).forEach(v => label(ctx, o.xf ? o.xf(v) : v, X(v), r.y + r.h + 14, { align: "center", font: mono(9.5) }));
    ctx.strokeStyle = C.seam; ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h); ctx.lineTo(r.x + r.w, r.y + r.h); ctx.stroke();
    if (o.xl) label(ctx, o.xl, r.x + r.w / 2, r.y + r.h + 30, { align: "center", font: mono(10) });
    if (o.yl) { ctx.save(); ctx.translate(r.x - (o.ylOff || 40), r.y + r.h / 2); ctx.rotate(-Math.PI / 2); label(ctx, o.yl, 0, 0, { align: "center", font: mono(10) }); ctx.restore(); }
    if (o.title) label(ctx, o.title, r.x, r.y - 10, { font: body(12.5, 600), color: CHALK });
    return { X, Y };
  }
  function refLine(ctx, r, y, txt) {
    ctx.save(); ctx.strokeStyle = rgba(NEON, 0.85); ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke(); ctx.restore();
    if (txt) label(ctx, txt, r.x + r.w - 2, y - 5, { align: "right", color: rgba(NEON, 1), font: mono(9.5) });
  }
  const halo = (ctx, x, y, rad, col, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.283); ctx.fill(); };

  /* ---------- 1. Background: every galaxy's speed -> their spread (sigma) -> mass ---------- */
  const bgCl = makeCluster(7, 14.95, 150, 4);
  const bgMembers = bgCl.gal.map((g, i) => i).filter(i => !bgCl.gal[i].bcg);
  const bgPick = [...bgMembers].sort((a, b) => Math.hypot(...bgCl.gal[b].v) - Math.hypot(...bgCl.gal[a].v)).slice(0, 8);
  const ntM = s => 1e15 * Math.pow(s / NT.s15, 1 / NT.b1);
  function drawBackground(ctx, w, h, t) {
    ground(ctx, w, h);
    const wide = w >= 560;
    const cR = wide ? { x: 0, y: 0, w: w * 0.5, h } : { x: 0, y: 0, w, h: h * 0.42 };
    const cx = cR.x + cR.w / 2, cy = cR.y + cR.h * 0.5, R = Math.min(cR.w, cR.h) * 0.3;
    const spin = bgCl.spin0 + (reduced() ? 0 : t * 0.12), tilt = bgCl.tilt;
    const dm = ease((t - 0.8) / 2);
    if (dm > 0) {
      halo(ctx, cx, cy, R * 1.75, [150, 140, 200], 0.2 * dm);
      ctx.save(); ctx.globalAlpha = dm; ctx.setLineDash([3, 5]); ctx.strokeStyle = "rgba(190,182,230,0.5)"; ctx.beginPath(); ctx.arc(cx, cy, R * 1.5, 0, 6.283); ctx.stroke(); ctx.restore();
      label(ctx, "dark matter: most of the mass, invisible", cx, cy - R * 1.5 - 8, { align: "center", color: `rgba(200,194,236,${0.9 * dm})` });
    }
    drawCluster(ctx, bgCl, cx, cy, R, spin, { tilt, t: reduced() ? 0 : t, vfun: (g, v) => -v[2] });
    const gi = bgPick[Math.floor(t / 2.6) % bgPick.length], g = bgCl.gal[gi];
    const q = rot(g.p, spin, tilt), vA = -rot(g.v, spin, tilt)[2], gx = cx + q[0] * R, gy = cy + q[1] * R;
    ctx.strokeStyle = CHALK; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(gx, gy, 9, 0, 6.283); ctx.stroke();
    label(ctx, `${vA >= 0 ? "+" : "−"}${fmtInt(Math.abs(vA))} km/s ${vA >= 0 ? "away (redshift)" : "toward us (blueshift)"}`, gx + 14, gy + 4, { color: rgba(vA >= 0 ? NEON : BLUE, 1), font: mono(10.5) });

    // every member's line-of-sight speed drops into a histogram; its width is sigma
    const vz = bgMembers.map(i => -rot(bgCl.gal[i].v, spin, tilt)[2]), sig = sd(vz), mean = vz.reduce((a, b) => a + b, 0) / vz.length;
    const hR = wide ? { x: w * 0.56, y: h * 0.1, w: w * 0.4, h: h * 0.34 } : { x: 36, y: h * 0.47, w: w - 56, h: h * 0.2 };
    const VR = 3400, bins = 24, shown = Math.floor(ease(t / 4) * vz.length), cnt = new Array(bins).fill(0);
    for (let i = 0; i < shown; i++) { const b2 = Math.floor((vz[i] + VR) / (2 * VR) * bins); if (b2 >= 0 && b2 < bins) cnt[b2]++; }
    const ymax = Math.max(8, Math.ceil(vz.length / 6));
    const f = frame(ctx, hR, [-VR, VR], [0, ymax], { xt: [-3000, -1500, 0, 1500, 3000], xf: v => (v > 0 ? "+" : "") + fmtInt(v), title: "Each galaxy's speed along our line of sight (km/s)" });
    cnt.forEach((c, i) => { const v0 = -VR + i / bins * 2 * VR, x0 = f.X(v0), x1 = f.X(v0 + 2 * VR / bins), y = f.Y(Math.min(c, ymax));
      ctx.fillStyle = rgba(v0 + VR / bins < 0 ? BLUE : NEON, 0.8); ctx.fillRect(x0 + 1, y, x1 - x0 - 2, f.Y(0) - y); });
    const sk = ease((t - 3.6) / 0.8);
    if (sk > 0) {
      const yb = hR.y + 10, xa = f.X(mean - sig * sk), xb = f.X(mean + sig * sk);
      ctx.strokeStyle = CHALK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xa, yb); ctx.lineTo(xb, yb); ctx.moveTo(xa, yb - 5); ctx.lineTo(xa, yb + 5); ctx.moveTo(xb, yb - 5); ctx.lineTo(xb, yb + 5); ctx.stroke();
      label(ctx, `σ = ${fmtInt(sig)} km/s, the spread`, (xa + xb) / 2, yb - 8, { align: "center", color: CHALK, font: mono(10.5) });
    }
    // sigma -> mass through the calibration line
    const pR = wide ? { x: w * 0.56 + 40, y: h * 0.6, w: w * 0.4 - 44, h: h * 0.26 } : { x: 70, y: h * 0.77, w: w - 96, h: h * 0.14 };
    const M = ntM(sig);
    const g2 = frame(ctx, pR, [14, 15.6], [Math.log10(500), Math.log10(1900)], { xt: wide ? [14, 14.5, 15, 15.5] : [14, 15], xf: v => "10" + sup(Math.floor(v)) + (v % 1 ? "·⁵" : ""), yt: [Math.log10(600), Math.log10(1000), Math.log10(1600)], yf: v => fmtInt(Math.pow(10, v)), title: wide ? "The calibration turns σ into mass" : "", xl: wide ? "cluster mass (solar masses)" : "", yl: wide ? "σ (km/s)" : "", ylOff: 44 });
    ctx.strokeStyle = "rgba(238,236,242,0.65)"; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let lm = 14; lm <= 15.6; lm += 0.02) { const y = g2.Y(Math.log10(NT.s15) + NT.b1 * (lm - 15)); lm === 14 ? ctx.moveTo(g2.X(lm), y) : ctx.lineTo(g2.X(lm), y); }
    ctx.stroke();
    if (sk > 0) {
      const lm = Math.log10(M), ly = Math.log10(sig);
      ctx.save(); ctx.globalAlpha = sk; ctx.setLineDash([2, 3]); ctx.strokeStyle = rgba(NEON, 0.8);
      ctx.beginPath(); ctx.moveTo(pR.x, g2.Y(ly)); ctx.lineTo(g2.X(lm), g2.Y(ly)); ctx.lineTo(g2.X(lm), pR.y + pR.h); ctx.stroke(); ctx.restore();
      ctx.fillStyle = rgba(NEON, sk); ctx.beginPath(); ctx.arc(g2.X(lm), g2.Y(ly), 4.5, 0, 6.283); ctx.fill();
      label(ctx, `M ≈ ${massLabel(M)}`, wide ? pR.x : 24, wide ? pR.y + pR.h + 48 : h - 6, { color: CHALK, font: mono(10.5) });
    }
  }

  /* ---------- 2. Data: halos -> selection cuts -> one row per sightline, mass repeated ---------- */
  const halos = (() => { const r = rng(314), out = [];
    for (let i = 0; i < 60; i++) { const lm = 13.45 + Math.pow(r(), 1.5) * 1.9, subs = Math.round(6 + (lm - 13.45) * 34 + r() * 14);
      const u = r.gauss() * 0.035, los = 4 + Math.floor(r() * 12);
      out.push({ lm, subs, u, los, ys: Array.from({ length: los }, () => Math.log10(NT.s15) + NT.b1 * (lm - 15) + u + r.gauss() * 0.018) }); }
    return out; })();
  const LMCUT = Math.log10(1.47e14);
  halos.forEach(hh => { hh.massOK = hh.lm > LMCUT; hh.keep = hh.massOK && hh.subs >= 20; });
  const kept = halos.filter(hh => hh.keep);
  function drawData(ctx, w, h, t0) {
    ctx.fillStyle = C.plate; ctx.fillRect(0, 0, w, h);
    const t = t0 % 16, wide = w >= 560;
    const L = wide ? { x: 20, y: 46, w: w * 0.42, h: h - 110 } : { x: 16, y: 40, w: w - 32, h: h * 0.36 };
    const cols = 10, rowsN = Math.ceil(halos.length / cols), cw = L.w / cols, ch = L.h / rowsN;
    const k1 = ease((t - 1.6) / 1.2), k2 = ease((t - 3.6) / 1.2), k3 = ease((t - 5.4) / 0.8);
    label(ctx, t < 1.6 ? "Dark-matter halos in the simulation" : t < 3.6 ? "Cut 1: mass above 1.47 × 10¹⁴ M☉" : t < 5.4 ? "Cut 2: at least 20 member galaxies" : "Kept as clusters", L.x, L.y - 14, { font: body(12.5, 600), color: CHALK });
    halos.forEach((hh, i) => {
      const x = L.x + (i % cols + 0.5) * cw, y = L.y + (Math.floor(i / cols) + 0.5) * ch, rr = Math.min(cw, ch) * (0.12 + (hh.lm - 13.45) * 0.17);
      let a = 0.75; if (!hh.massOK) a = lerp(0.75, 0.12, k1); else if (!hh.keep) a = lerp(0.75, 0.12, k2);
      ctx.fillStyle = `rgba(238,236,242,${a * 0.5})`; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.fill();
      if (hh.keep && k3 > 0) { ctx.strokeStyle = rgba(NEON, k3); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, rr + 3, 0, 6.283); ctx.stroke(); }
    });
    if (k3 > 0) label(ctx, `the real sample: 2,514 clusters`, L.x, L.y + L.h + 22, { color: rgba(NEON, k3), font: mono(10.5) });

    // every kept cluster becomes several rows: same mass, one dispersion per sightline
    const r = wide ? { x: w * 0.5 + 44, y: 46, w: w * 0.5 - 70, h: h - 120 } : { x: 56, y: L.y + L.h + 74, w: w - 72, h: h - (L.y + L.h + 74) - 50 };
    const f = frame(ctx, r, [14.1, 15.4], [2.75, 3.32], { xt: [14.2, 14.6, 15.0, 15.4], xf: v => v.toFixed(1), yt: [2.8, 3.0, 3.2], yf: v => v.toFixed(1), title: "One row per sightline", xl: "log₁₀ M", yl: "log₁₀ σ", ylOff: 36 });
    const k4 = clamp((t - 6.4) / 5.5, 0, 1), nShow = k4 * kept.length;
    let rowsShown = 0;
    kept.forEach((hh, j) => { const part = clamp(nShow - j, 0, 1); if (part <= 0) return; const m = Math.ceil(part * hh.los); rowsShown += m;
      for (let k = 0; k < m; k++) { ctx.fillStyle = "rgba(238,236,242,0.75)"; ctx.beginPath(); ctx.arc(f.X(hh.lm), f.Y(hh.ys[k]), 2.4, 0, 6.283); ctx.fill(); } });
    const big = kept.reduce((a, b) => (b.los > a.los ? b : a), kept[0]);
    if (k4 >= 1 && big) {
      const top = Math.max(...big.ys), bot = Math.min(...big.ys), xx = f.X(big.lm);
      ctx.strokeStyle = rgba(NEON, 0.95); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(xx - 7, f.Y(top) - 6); ctx.lineTo(xx + 7, f.Y(top) - 6); ctx.lineTo(xx + 7, f.Y(bot) + 6); ctx.lineTo(xx - 7, f.Y(bot) + 6); ctx.closePath(); ctx.stroke();
      label(ctx, `1 cluster · ${big.los} rows · same mass`, xx + 12, f.Y((top + bot) / 2), { color: rgba(NEON, 1), font: mono(10.5), align: xx > r.x + r.w * 0.6 ? "right" : "left" });
    }
    label(ctx, `rows: ${fmtInt(24451 * k4)}`, r.x + r.w, r.y - 14, { align: "right", color: CHALK, font: mono(11) });
  }

  /* ---------- 3. Correlation ---------- */
  const coCl = makeCluster(19, 15.0, 170, 2);
  const coIdx = coCl.gal.map((g, i) => i).filter(i => !coCl.gal[i].bcg);
  const dA = normalize([1, 0.05, 0.28]), dB = normalize([Math.cos(0.42), Math.sin(0.42), 0.28]);
  const hist = [];
  function drawCorrelation(ctx, w, h, t) {
    ground(ctx, w, h);
    const wide = w >= 560;
    const lw = wide ? w * 0.52 : w, lh = wide ? h : h * 0.56;
    const cx = lw * 0.38, cy = lh * 0.4, R = Math.min(lw, lh) * 0.24;
    const spin = coCl.spin0 + (reduced() ? 0 : t * 0.45), tilt = coCl.tilt + 0.3 * Math.sin(t * 0.21);
    const vw = coCl.gal.map(g => rot(g.v, spin, tilt));
    const sA = sd(coIdx.map(i => dot(vw[i], dA))), sB = sd(coIdx.map(i => dot(vw[i], dB)));
    drawCluster(ctx, coCl, cx, cy, R, spin, { tilt, vfun: (g, v) => dot(v, dA) });
    drawBeam(ctx, coCl, cx, cy, R, spin, dA, 1, "A", true);
    drawBeam(ctx, coCl, cx, cy, R, spin, dB, 0.8, "B", true);
    // trailing trace of both dispersions
    hist.push([t, sA, sB]); while (hist.length && t - hist[0][0] > 12) hist.shift();
    if (hist.length > 1 && hist[hist.length - 1][0] < hist[hist.length - 2][0]) hist.length = 0;
    const tr = { x: 40, y: lh * 0.74, w: lw - 64, h: lh * 0.17 };
    const lo = coCl.sig * 0.7, hi = coCl.sig * 1.3;
    const f = frame(ctx, tr, [t - 12, t], [lo, hi], { title: "σ along A and B, last 12 seconds" });
    [[1, NEON, "A"], [2, [238, 236, 242], "B"]].forEach(([k, col]) => {
      ctx.strokeStyle = rgba(col, k === 1 ? 1 : 0.75); ctx.lineWidth = 1.8; ctx.beginPath();
      hist.forEach((p, j) => { const x = f.X(p[0]), y = f.Y(clamp(p[k], lo, hi)); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    });
    let corr = NaN;
    if (hist.length > 30) { const a = hist.map(p => p[1]), b = hist.map(p => p[2]), ma = a.reduce((x, y) => x + y) / a.length, mb = b.reduce((x, y) => x + y) / b.length;
      let num = 0, da = 0, db = 0; a.forEach((v, i) => { num += (v - ma) * (b[i] - mb); da += (v - ma) ** 2; db += (b[i] - mb) ** 2; }); corr = num / Math.sqrt(da * db); }
    label(ctx, `A ${fmtInt(sA)} km/s · B ${fmtInt(sB)} km/s${isFinite(corr) ? ` · correlation ${corr.toFixed(2)}` : ""}`, tr.x, tr.y + tr.h + 18, { color: CHALK, font: mono(10.5) });

    // Figure 2
    const hR = wide ? { x: w * 0.6, y: h * 0.12, w: w * 0.36, h: h * 0.4 } : { x: 44, y: h * 0.64, w: w - 64, h: h * 0.26 };
    const g = frame(ctx, hR, [0, 1], [0, 9], { xt: [0, 0.2, 0.4, 0.6, 0.8, 1], xf: v => v.toFixed(1), yt: [0, 2, 4, 6, 8], title: "Correlation between pairs of sightlines", xl: wide ? "correlation" : "", yl: wide ? "density" : "", ylOff: 30 });
    FIG2.forEach((d, i) => {
      const k = ease((t - 0.4 - i * 0.12) / 0.7), x0 = g.X(i / 20), x1 = g.X((i + 1) / 20), bh = (g.Y(0) - g.Y(d)) * k;
      ctx.fillStyle = i >= 18 ? rgba(NEON, 0.9) : "rgba(238,236,242,0.55)"; ctx.fillRect(x0 + 1, g.Y(0) - bh, x1 - x0 - 2, bh);
    });
    if (wide) {
      label(ctx, "poster Fig. 2", hR.x + hR.w, hR.y + hR.h + 30, { font: mono(9.5), align: "right" });
      const rho = isFinite(corr) ? clamp(corr, 0, 0.999) : 0.9, nEff = 2514 * 9.73 / (1 + 8.73 * rho), k = ease((t - 2) / 1.5);
      const bx = hR.x, by = h * 0.7, bw = hR.w;
      label(ctx, "How much independent information?", bx, by - 14, { font: body(12.5, 600), color: CHALK });
      ctx.fillStyle = "rgba(238,236,242,0.7)"; ctx.fillRect(bx, by, bw * k, 14);
      label(ctx, "rows counted: 24,451", bx, by + 30, { color: CHALK, font: mono(10.5) });
      ctx.fillStyle = rgba(NEON, 0.95); ctx.fillRect(bx, by + 44, bw * (nEff / 24451) * k, 14);
      label(ctx, `worth about ${fmtInt(nEff)} independent ones`, bx, by + 74, { color: rgba(NEON, 1), font: mono(10.5) });
      label(ctx, `at the live correlation (${rho.toFixed(2)}), 9.7 sightlines per cluster`, bx, by + 92, { font: mono(9) });
    }
  }

  /* ---------- 4. Weighted regression (illustration with mock clusters) ---------- */
  const { cl: mock, F } = GXM.pick();
  const sig = document.createElement("canvas"); sig.width = sig.height = F.N;
  { const g = sig.getContext("2d"), im = g.createImageData(F.N, F.N); let o = 0;
    mock.forEach(c => { for (let i = 0; i < c.m; i++) for (let j = 0; j < c.m; j++) { const p = ((o + i) * F.N + o + j) * 4; im.data[p] = 255; im.data[p + 1] = i === j ? 220 : 43; im.data[p + 2] = i === j ? 225 : 61; im.data[p + 3] = Math.round(255 * (i === j ? 1 : F.rho)); } o += c.m; });
    g.putImageData(im, 0, 0); }
  const blockEnd = []; { let o = 0; mock.forEach(c => { o += c.m; blockEnd.push(o); }); }
  const XR = [14.1, 15.36], YR = [2.63, 3.33];
  const lineAt = (f, x) => f.b0 + f.b1 * x, bandAt = (f, x) => 1.96 * Math.sqrt(f.cov[0][0] + 2 * x * f.cov[0][1] + x * x * f.cov[1][1]);
  const mixF = (a, b, k) => ({ b0: lerp(a.b0, b.b0, k), b1: lerp(a.b1, b.b1, k), cov: a.cov.map((r, i) => r.map((v, j) => lerp(v, b.cov[i][j], k))) });
  function scatterFrame(ctx, r, title) {
    return frame(ctx, r, XR, YR, { xt: [14.2, 14.6, 15.0], xf: v => v.toFixed(1), yt: [2.7, 2.9, 3.1, 3.3], yf: v => v.toFixed(1), title, xl: "log₁₀ M", yl: "log₁₀ σ", ylOff: 36 });
  }
  function fitLine(ctx, f, fit, col, wdt, bandCol) {
    if (bandCol) { ctx.fillStyle = bandCol; ctx.beginPath(); for (let x = XR[0] + 0.02; x <= XR[1] - 0.02; x += 0.02) ctx.lineTo(f.X(x), f.Y(lineAt(fit, x) + bandAt(fit, x)));
      for (let x = XR[1] - 0.02; x >= XR[0] + 0.02; x -= 0.02) ctx.lineTo(f.X(x), f.Y(lineAt(fit, x) - bandAt(fit, x))); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.beginPath(); ctx.moveTo(f.X(XR[0] + 0.02), f.Y(lineAt(fit, XR[0] + 0.02))); ctx.lineTo(f.X(XR[1] - 0.02), f.Y(lineAt(fit, XR[1] - 0.02))); ctx.stroke();
  }
  function drawWeighted(ctx, w, h, t0) {
    ctx.fillStyle = C.plate; ctx.fillRect(0, 0, w, h);
    const t = t0 % 16, wide = w >= 560;
    const mR = wide ? { x: 22, y: 44, s: Math.min(w * 0.34, h * 0.5) } : { x: 22, y: 40, s: Math.min(w - 44, h * 0.3) };
    label(ctx, `Σ: one block per cluster (${F.N} × ${F.N} here)`, mR.x, mR.y - 12, { font: body(12.5, 600), color: CHALK });
    const k1 = ease(t / 3), upto = Math.floor(k1 * mock.length), px = blockEnd[Math.max(0, upto - 1)] || 0;
    ctx.strokeStyle = C.seam; ctx.strokeRect(mR.x - 0.5, mR.y - 0.5, mR.s + 1, mR.s + 1);
    ctx.imageSmoothingEnabled = false; if (px > 0) ctx.drawImage(sig, 0, 0, px, px, mR.x, mR.y, px / F.N * mR.s, px / F.N * mR.s); ctx.imageSmoothingEnabled = true;
    label(ctx, `estimated correlation inside a block: ${F.rho.toFixed(2)}`, mR.x, mR.y + mR.s + 16, { font: mono(10) });
    label(ctx, "the real one: 24,451 × 24,451", mR.x, mR.y + mR.s + 31, { font: mono(10) });
    if (wide) {
      const top5 = [...mock].sort((a, b) => b.m - a.m).slice(0, 5), sw = mock.reduce((a, c) => a + c.w, 0);
      const so = top5.reduce((a, c) => a + c.m, 0) / F.N, sg = top5.reduce((a, c) => a + c.w, 0) / sw, k = ease((t - 3.5) / 2.5);
      const bx = mR.x, by = mR.y + mR.s + 66, bw = mR.s;
      label(ctx, "Share of the fit held by the 5 most-sampled clusters", bx, by - 10, { font: body(12, 600), color: CHALK });
      ctx.fillStyle = "rgba(207,205,216,0.8)"; ctx.fillRect(bx, by, bw * so, 12); label(ctx, `ordinary ${(so * 100).toFixed(0)}%`, bx + bw * so + 8, by + 10, { color: C.silver, font: mono(10) });
      ctx.fillStyle = rgba(NEON, 0.95); ctx.fillRect(bx, by + 22, bw * lerp(so, sg, k), 12);
      if (k > 0.05) label(ctx, `weighted ${(lerp(so, sg, k) * 100).toFixed(0)}%`, bx + bw * lerp(so, sg, k) + 8, by + 32, { color: rgba(NEON, 1), font: mono(10) });
      label(ctx, `an equal share would be ${(500 / mock.length).toFixed(0)}%`, bx, by + 54, { font: mono(9.5) });
    }

    const r = wide ? { x: w * 0.46, y: 44, w: w * 0.5, h: h - 140 } : { x: 56, y: mR.y + mR.s + 70, w: w - 72, h: h - (mR.y + mR.s + 70) - 86 };
    const f = scatterFrame(ctx, r, "36 mock clusters (illustration)");
    const shrink = ease((t - 3.5) / 2.5), swing = ease((t - 6) / 2.5);
    fitLine(ctx, f, F.ols, "rgba(207,205,216,0.85)", 1.8, "rgba(207,205,216,0.16)");
    if (swing > 0) fitLine(ctx, f, mixF(F.ols, F.gls, swing), rgba(NEON, 1), 2.4, rgba(NEON, 0.14));
    mock.forEach(c => c.ys.forEach((y, k) => {
      const jx = (k - (c.m - 1) / 2) * Math.min(0.0045, 0.05 / c.m), rr = Math.max(1.05, 2.6 * (1 + (Math.sqrt(c.wPoint) - 1) * shrink));
      ctx.fillStyle = shrink > 0.5 ? "rgba(255,130,140,0.9)" : "rgba(238,236,242,0.75)"; ctx.beginPath(); ctx.arc(f.X(c.x + jx), f.Y(y), rr, 0, 6.283); ctx.fill();
    }));
    label(ctx, `ordinary β₁ = ${F.ols.b1.toFixed(3)} ± ${(1.96 * GXM.se(F.ols)).toFixed(3)}`, r.x, r.y + r.h + 52, { color: C.silver, font: mono(10.5) });
    if (swing > 0.5) label(ctx, `weighted β₁ = ${F.gls.b1.toFixed(3)} ± ${(1.96 * GXM.se(F.gls)).toFixed(3)}`, r.x, r.y + r.h + 68, { color: rgba(NEON, 1), font: mono(10.5) });
    const stage = t < 3.5 ? "building Σ" : t < 6 ? "points shrink to their weight" : "the line follows the weights";
    label(ctx, stage, w - 14, 22, { align: "right", font: mono(10), color: CHALK });
  }

  /* ---------- 5. Single line of sight ---------- */
  const rs = rng(77), draws = Array.from({ length: LOS1.reps }, () => [LOS1.b1 + rs.gauss() * LOS1.b1se * Math.sqrt(LOS1.reps), LOS1.s15 + rs.gauss() * LOS1.s15se * Math.sqrt(LOS1.reps)]);
  const picks = []; let lastPick = -1;
  function drawSingle(ctx, w, h, t0) {
    ctx.fillStyle = C.plate; ctx.fillRect(0, 0, w, h);
    const t = t0 % 13, wide = w >= 560;
    const r = wide ? { x: 56, y: 44, w: w * 0.4, h: h - 120 } : { x: 56, y: 40, w: w - 72, h: h * 0.34 };
    const f = scatterFrame(ctx, r, "Keep one sightline per cluster");
    const step = Math.floor(t / 0.45);
    if (step !== lastPick) { lastPick = step; const rr = rng(1000 + step); picks.unshift(mock.map(c => Math.floor(rr() * c.m))); if (picks.length > 24) picks.length = 24; if (t < 0.45) picks.length = 1; }
    const cur = picks[0] || mock.map(() => 0);
    picks.forEach((p, j) => { if (!j) return; const xs = mock.map(c => c.x), ys = mock.map((c, i) => c.ys[p[i]]);
      const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n; let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
      const b1 = sxy / sxx, b0 = my - b1 * mx; ctx.strokeStyle = `rgba(255,43,61,${0.22 * (1 - j / 24)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.X(XR[0] + 0.02), f.Y(b0 + b1 * (XR[0] + 0.02))); ctx.lineTo(f.X(XR[1] - 0.02), f.Y(b0 + b1 * (XR[1] - 0.02))); ctx.stroke(); });
    mock.forEach((c, i) => c.ys.forEach((y, k) => { const on = k === cur[i], jx = (k - (c.m - 1) / 2) * Math.min(0.0045, 0.05 / c.m);
      ctx.fillStyle = on ? rgba(NEON, 1) : "rgba(238,236,242,0.14)"; ctx.beginPath(); ctx.arc(f.X(c.x + jx), f.Y(y), on ? 3 : 2, 0, 6.283); ctx.fill(); }));

    const n = Math.min(LOS1.reps, Math.floor(ease(t / 8) * LOS1.reps));
    const hw = wide ? w * 0.42 : w - 72, hx = wide ? w * 0.54 : 56, hh = wide ? (h - 150) / 2 : h * 0.17;
    const panels = [
      { k: 0, r: { x: hx, y: wide ? 44 : r.y + r.h + 64, w: hw, h: hh }, lo: 0.365, hi: 0.41, ref: NT.b1, refT: "Ntampaka 0.375", ticks: [0.37, 0.38, 0.39, 0.40, 0.41], fmt: v => v.toFixed(2), title: "β₁ over repetitions", mean: LOS1.b1.toFixed(5), gap: (LOS1.b1 - NT.b1) / LOS1.b1se },
      { k: 1, r: { x: hx, y: wide ? 44 + hh + 64 : r.y + r.h + 64 + hh + 58, w: hw, h: hh }, lo: 1240, hi: 1330, ref: NT.s15, refT: "Ntampaka 1,249", ticks: [1240, 1270, 1300, 1330], fmt: v => fmtInt(v), title: "σ₁₅ over repetitions (km/s)", mean: LOS1.s15.toFixed(3), gap: (LOS1.s15 - NT.s15) / LOS1.s15se },
    ];
    panels.forEach(p => {
      const bins = 30, cnt = new Array(bins).fill(0);
      for (let i = 0; i < n; i++) { const b = Math.floor((draws[i][p.k] - p.lo) / (p.hi - p.lo) * bins); if (b >= 0 && b < bins) cnt[b]++; }
      const ymax = LOS1.reps * 0.16;
      const g = frame(ctx, p.r, [p.lo, p.hi], [0, ymax], { xt: p.ticks, xf: p.fmt, title: p.title });
      cnt.forEach((c, i) => { const x0 = g.X(p.lo + i / bins * (p.hi - p.lo)), x1 = g.X(p.lo + (i + 1) / bins * (p.hi - p.lo)), y = g.Y(Math.min(c, ymax)); ctx.fillStyle = "rgba(238,236,242,0.7)"; ctx.fillRect(x0 + 0.5, y, x1 - x0 - 1, g.Y(0) - y); });
      const xr = g.X(p.ref); ctx.save(); ctx.strokeStyle = rgba(NEON, 0.95); ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(xr, p.r.y); ctx.lineTo(xr, p.r.y + p.r.h); ctx.stroke(); ctx.restore();
      label(ctx, p.refT, xr + 5, p.r.y + 10, { color: rgba(NEON, 1), font: mono(9.5) });
      if (n === LOS1.reps) { label(ctx, `mean ${p.mean}`, p.r.x + p.r.w, p.r.y - 10, { align: "right", color: CHALK, font: mono(10) });
        const xm = g.X(p.k ? LOS1.s15 : LOS1.b1), ya = p.r.y + p.r.h * 0.42;
        ctx.strokeStyle = rgba(NEON, 0.95); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(xr, ya); ctx.lineTo(xm, ya); ctx.lineTo(xm - 5, ya - 4); ctx.moveTo(xm, ya); ctx.lineTo(xm - 5, ya + 4); ctx.stroke();
        label(ctx, `≈ ${Math.round(p.gap / 10) * 10} standard errors`, (xr + xm) / 2, ya - 6, { align: "center", color: rgba(NEON, 1), font: mono(9.5) }); }
    });
    label(ctx, `repetitions: ${fmtInt(n)} / 2,000`, w - 14, h - 12, { align: "right", color: CHALK, font: mono(10.5) });
    label(ctx, "histograms redrawn from the poster's mean and standard error", 14, wide ? h - 12 : h - 28, { font: mono(9.5) });
  }

  /* ---------- 6. Cluster subsets (poster Fig. 3) ---------- */
  function drawSubsets(ctx, w, h, t0) {
    ctx.fillStyle = C.plate; ctx.fillRect(0, 0, w, h);
    const t = t0 % 14, wide = w >= 560;
    const pw = wide ? (w - 120) / 2 : w - 80, ph = wide ? h - 130 : (h - 160) / 2;
    const defs = [
      { key: "b1", r: { x: 56, y: 46, w: pw, h: ph }, yr: [0.30, 0.50], yt: [0.30, 0.35, 0.40, 0.45, 0.50], yf: v => v.toFixed(2), ref: NT.b1, refT: "Ntampaka 0.375", title: "Slope β₁" },
      { key: "s15", r: wide ? { x: 56 + pw + 64, y: 46, w: pw, h: ph } : { x: 56, y: 46 + ph + 70, w: pw, h: ph }, yr: [1100, 1400], yt: [1100, 1200, 1300, 1400], yf: v => fmtInt(v), ref: NT.s15, refT: "Ntampaka 1,249", title: "σ₁₅ (km/s)" },
    ];
    defs.forEach(d => {
      const f = frame(ctx, d.r, [0, 105], d.yr, { xt: [5, 20, 40, 60, 80, 100], yt: d.yt, yf: d.yf, title: d.title, xl: "clusters in the subset", ylOff: 42 });
      refLine(ctx, d.r, f.Y(d.ref), d.refT);
      FIG3.n.forEach((n, i) => {
        const at = 0.4 + i * 0.75, k = (t - at) / 0.6; if (k < 0) return;
        const [m, lo, hi] = FIG3[d.key][i], x = f.X(n), top = d.r.y, bot = d.r.y + d.r.h;
        if (m === null) { if (k > 0.5) { label(ctx, "↑", x, top + 12, { align: "center", font: mono(13), color: ASH }); label(ctx, "off scale", x, top + 24, { align: "center", font: mono(8.5) }); } return; }
        // a flurry of 100 simulated estimates collapsing onto the summary
        if (k < 1) { const rr = rng(n * 31 + (d.key === "b1" ? 1 : 2)), sp = ((hi ?? m + (m - (lo ?? m))) - (lo ?? m - ((hi ?? m) - m))) / 3.92 || (d.yr[1] - d.yr[0]) * 0.08;
          for (let j = 0; j < 100; j++) { const v = m + rr.gauss() * sp * (1 - k) * 1.6; ctx.fillStyle = "rgba(238,236,242,0.35)"; ctx.fillRect(x + rr.gauss() * 6 * (1 - k) - 1, clamp(f.Y(v), top, bot) - 1, 2, 2); } }
        const a = clamp(k, 0, 1);
        const clears = lo !== null && lo > d.ref;
        ctx.globalAlpha = a; ctx.strokeStyle = clears ? rgba(NEON, 1) : CHALK; ctx.lineWidth = clears ? 2 : 1.4;
        const yLo = lo === null ? bot : f.Y(lo), yHi = hi === null ? top : f.Y(hi);
        ctx.beginPath(); ctx.moveTo(x, clamp(yLo, top, bot)); ctx.lineTo(x, clamp(yHi, top, bot)); ctx.stroke();
        const yM = f.Y(m); if (yM >= top && yM <= bot) { ctx.fillStyle = C.plate; ctx.beginPath(); ctx.arc(x, yM, 3.6, 0, 6.283); ctx.fill(); ctx.stroke(); }
        ctx.globalAlpha = 1;
      });
    });
    label(ctx, "points and 95% intervals read from poster Fig. 3 · 100 simulated datasets per size", 14, h - 12, { font: mono(9.5) });
  }

  /* ---------- 7. Conclusions ---------- */
  const thisM = s => 1e15 * Math.pow(s / LOS1.s15, 1 / LOS1.b1);
  function drawConclusions(ctx, w, h, t) {
    ctx.fillStyle = C.plate; ctx.fillRect(0, 0, w, h);
    const wide = w >= 560;
    // coefficient comparison
    const rows = [["Ntampaka et al. (2014)", [NT.b1], [NT.s15], "rgba(207,205,216,0.95)"], ["One sightline per cluster", [LOS1.b1], [LOS1.s15], rgba(NEON, 1)], ["Weighted, cluster subsets", [0.42, 0.445], [1270, 1285], rgba(NEON, 1)]];
    const cw = wide ? w * 0.44 : w - 40, charts = [["Slope β₁", 1, 0.36, 0.46, [0.36, 0.38, 0.40, 0.42, 0.44, 0.46], v => v.toFixed(2)], ["σ₁₅ (km/s)", 2, 1240, 1300, [1240, 1260, 1280, 1300], v => fmtInt(v)]];
    const blockH = wide ? (h - 60) / 2 : 128;
    charts.forEach(([name, ki, lo, hi, ticks, ff], ci) => {
      const top = 34 + ci * blockH, X = v => 20 + (v - lo) / (hi - lo) * cw;
      label(ctx, name, 20, top, { font: body(12.5, 600), color: CHALK });
      rows.forEach((r, ri) => {
        const y = top + 26 + ri * 26, g = ease((t - 0.3 - ci * 0.7 - ri * 0.35) / 0.6), v = r[ki];
        ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(20 + cw, y); ctx.stroke();
        ctx.globalAlpha = g; ctx.fillStyle = r[3]; ctx.strokeStyle = r[3];
        if (v.length === 1) { ctx.beginPath(); ctx.arc(X(v[0]), y, 4.5, 0, 6.283); ctx.fill(); }
        else { ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(X(v[0]), y); ctx.lineTo(X(v[1]), y); ctx.stroke(); ctx.lineWidth = 1; ctx.lineCap = "butt"; }
        label(ctx, `${r[0]} · ${v.length === 1 ? (ki === 1 ? v[0].toFixed(4).replace(/0+$/, "") : fmtInt(v[0])) : ff(v[0]) + "–" + ff(v[1])}`, 20, y - 8, { font: mono(10) });
        ctx.globalAlpha = 1;
      });
      ticks.forEach(v => label(ctx, ff(v), X(v), top + 26 + 3 * 26 - 4, { align: "center", font: mono(9) }));
    });
    // same σ, different mass
    const r = wide ? { x: w * 0.56 + 40, y: 46, w: w * 0.44 - 64, h: h - 140 } : { x: 60, y: 34 + 2 * blockH + 30, w: w - 80, h: h - (34 + 2 * blockH + 30) - 74 };
    const f = frame(ctx, r, [600, 1500], [13.9, 15.25], { xt: [600, 900, 1200, 1500], xf: v => fmtInt(v), yt: [14, 14.5, 15], yf: v => "10" + sup(Math.floor(v)) + (v % 1 ? "·⁵" : ""), title: "Same σ, implied mass", xl: "measured σ (km/s)", yl: "mass (solar masses)", ylOff: 44 });
    [[ntM, "rgba(207,205,216,0.95)"], [thisM, rgba(NEON, 1)]].forEach(([fn, col]) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); for (let s = 600; s <= 1500; s += 10) { const y = f.Y(Math.log10(fn(s))); s === 600 ? ctx.moveTo(f.X(s), y) : ctx.lineTo(f.X(s), y); } ctx.stroke(); });
    const s = 1050 + 400 * Math.sin(t * 0.35), m1 = ntM(s), m2 = thisM(s);
    ctx.save(); ctx.setLineDash([2, 3]); ctx.strokeStyle = "rgba(238,236,242,0.5)"; ctx.beginPath(); ctx.moveTo(f.X(s), r.y); ctx.lineTo(f.X(s), r.y + r.h); ctx.stroke(); ctx.restore();
    [[m1, "rgba(207,205,216,1)"], [m2, rgba(NEON, 1)]].forEach(([m, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(f.X(s), f.Y(Math.log10(m)), 4.2, 0, 6.283); ctx.fill(); });
    const y0 = r.y + r.h + 44;
    label(ctx, `σ = ${fmtInt(s)} km/s`, r.x, y0, { color: CHALK, font: mono(10.5) });
    label(ctx, `Ntampaka: ${massLabel(m1, 2)}`, r.x, y0 + 15, { color: C.silver, font: mono(10.5) });
    label(ctx, `this work: ${massLabel(m2, 2)}  (${((m2 / m1 - 1) * 100).toFixed(1)}%)`, r.x, y0 + 30, { color: rgba(NEON, 1), font: mono(10.5) });
  }

  /* ---------- 8. References ---------- */
  const refCl = makeCluster(41, 15.08, 130, 4);
  function drawRefs(ctx, w, h, t) {
    ground(ctx, w, h);
    drawCluster(ctx, refCl, w / 2, h / 2, Math.min(w, h) * 0.3, refCl.spin0 + (reduced() ? 0 : t * 0.08), { t: reduced() ? 0 : t, vfun: (g, v) => -v[2] });
    label(ctx, "Carnegie Mellon University · Department of Statistics · 2015", w / 2, h - 18, { align: "center", font: mono(10) });
  }

  const DRAW = { background: drawBackground, data: drawData, correlation: drawCorrelation, weighted: drawWeighted, single: drawSingle, subsets: drawSubsets, conclusions: drawConclusions, refs: drawRefs };
  show(0);
  loop(root, (t, dt) => {
    local += dt;
    const s = SLIDES[cur]; if (s.cover) return;
    const { ctx, w, h } = fit(canvas); if (!w || !h) return;
    DRAW[s.key](ctx, w, h, reduced() ? 12 : local);
  });
  return { show };
}
