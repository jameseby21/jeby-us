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
