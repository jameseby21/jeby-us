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
