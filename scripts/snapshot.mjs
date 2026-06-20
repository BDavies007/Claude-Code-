/**
 * Static preview generator.
 *
 * Re-implements the engine's core math (mirroring src/services) against the
 * seed opportunity and emits a self-contained, dependency-free HTML snapshot
 * of the Executive Dashboard, Scoring and Scenario modules. Open the output in
 * any browser — no server or install required.
 */

import { writeFileSync } from "node:fs";

// --- Seed opportunity (mirrors src/data/sampleOpportunity.ts) ---------------
const input = {
  client: { companyName: "Northgate Logistics Group", sector: "Logistics", country: "United Kingdom", creditRating: "A", esgUrgency: "High", decisionTimeline: "3-6 months", ownershipStatus: "Owner-occupier" },
  site: { region: "Midlands, UK", siteType: "Warehouse / Distribution", roofAreaM2: 32000, roofCondition: "Good", availableLandHa: 1.5, gridConnection: "Constrained export", annualConsumptionMWh: 9800, peakDemandMW: 3.2, operatingHoursPerDay: 18, evFleetPotential: true, highIntensityLoad: true },
  commercial: { currentGridPrice: 0.245, gridPriceEscalation: 0.04, ppaTargetPrice: 0.165, ppaTermYears: 25, takeOrPayPct: 0.85, inflationIndexation: 0.03, clientSavingsTargetPct: 0.15, contractRisk: "Low" },
  technology: { solarMwp: 3.0, batteryPowerMW: 2.0, batteryEnergyMWh: 4.0, evChargers: 12, bemsRequired: true, flexibilityEligible: true, exportConstrained: true, capexPerKwp: 750, bessCostPerKwh: 320, omCostPerKwpYear: 12, performanceRatio: 0.85, degradationRate: 0.0045 },
  carbon: { gridEmissionsFactor: 0.21, carbonPrice: 75, carbonPriceGrowth: 0.06, mrvRequired: true, scopeRelevance: ["Scope 1", "Scope 2", "Scope 3"], esgReportingPressure: "High", supplierTransparencyNeed: true, biodiversityCircularity: true },
};
const global = { discountRate: 0.08, inflation: 0.03, developerMarginPerKwh: 0.01, debtRatio: 0.6, debtCostRate: 0.06, debtTermYears: 15 };

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// --- Financial math (mirrors src/services/financialCalculator.ts) -----------
const annualGeneration = (mwp, pr, deg, year, sy = 950) =>
  mwp <= 0 ? 0 : (mwp * 1000 * (sy * pr) * Math.pow(1 - deg, Math.max(0, year - 1))) / 1000;
const consumed = (gen) => Math.min(gen, input.site.annualConsumptionMWh) * input.commercial.takeOrPayPct;
const ppaRevenue = (gen, y) => input.commercial.ppaTargetPrice * Math.pow(1 + input.commercial.inflationIndexation, y - 1) * consumed(gen) * 1000;
const clientSavings = (gen, y) => {
  const grid = input.commercial.currentGridPrice * Math.pow(1 + input.commercial.gridPriceEscalation, y - 1);
  const ppa = input.commercial.ppaTargetPrice * Math.pow(1 + input.commercial.inflationIndexation, y - 1);
  return Math.max(0, (grid - ppa) * consumed(gen) * 1000);
};
const developerMargin = (gen, m, y) => m * Math.pow(1 + input.commercial.inflationIndexation, y - 1) * consumed(gen) * 1000;
const carbonValue = (gen, y) => {
  const t = gen * input.carbon.gridEmissionsFactor;
  return { tonnes: t, value: t * input.carbon.carbonPrice * Math.pow(1 + input.carbon.carbonPriceGrowth, y - 1) };
};
const bessArb = (mwh) => (mwh <= 0 ? 0 : mwh * 1000 * 0.08 * 350 * 0.88);
const flexRev = (mw, ok) => (!ok || mw <= 0 ? 0 : mw * 45000);
const exportRev = (gen, y) => {
  if (input.technology.exportConstrained) return 0;
  const surplus = Math.max(0, gen - input.site.annualConsumptionMWh);
  return surplus * 1000 * 0.05 * Math.pow(1 + input.commercial.inflationIndexation, y - 1);
};
const totalCapex = () => input.technology.solarMwp * 1000 * input.technology.capexPerKwp + input.technology.batteryEnergyMWh * 1000 * input.technology.bessCostPerKwh;
const opex = (y) => (input.technology.solarMwp * 1000 * input.technology.omCostPerKwpYear + input.technology.batteryEnergyMWh * 1000 * input.technology.bessCostPerKwh * 0.015) * Math.pow(1 + global.inflation, y - 1);
const debtServiceAnnual = (capex) => {
  const p = capex * global.debtRatio, r = global.debtCostRate, n = global.debtTermYears;
  if (p <= 0 || n <= 0) return 0;
  return r === 0 ? p / n : p * ((r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
};
const npv = (rate, out, flows) => flows.reduce((a, cf, i) => a + cf / Math.pow(1 + rate, i + 1), -out);
const irr = (out, flows) => {
  const f = (r) => flows.reduce((a, cf, i) => a + cf / Math.pow(1 + r, i + 1), -out);
  let lo = -0.9, hi = 1.5, flo = f(lo);
  if (flo * f(hi) > 0) return NaN;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2, fm = f(mid); if (Math.abs(fm) < 1) return mid; if (flo * fm < 0) hi = mid; else { lo = mid; flo = fm; } }
  return (lo + hi) / 2;
};
const payback = (out, flows) => { let c = -out; for (let i = 0; i < flows.length; i++) { const p = c; c += flows[i]; if (c >= 0) return i + (p < 0 ? -p / flows[i] : 0); } return Infinity; };

function runModel(curtailment = 0.02, riskScore = 40) {
  const capex = totalCapex();
  const ds = debtServiceAnnual(capex);
  const flows = [];
  let cum = -capex * (1 - global.debtRatio);
  for (let y = 1; y <= input.commercial.ppaTermYears; y++) {
    const gen = annualGeneration(input.technology.solarMwp, input.technology.performanceRatio, input.technology.degradationRate, y) * (1 - curtailment);
    const ppa = ppaRevenue(gen, y), sav = clientSavings(gen, y), marg = developerMargin(gen, global.developerMarginPerKwh, y);
    const cv = carbonValue(gen, y), bess = bessArb(input.technology.batteryEnergyMWh), flex = flexRev(input.technology.batteryPowerMW, input.technology.flexibilityEligible), exp = exportRev(gen, y);
    const gross = ppa + cv.value + bess + flex + exp, ox = opex(y), ebitda = gross - ox, net = ebitda - ds;
    cum += net;
    flows.push({ year: y, gen, ppa, sav, marg, carbon: cv.value, tonnes: cv.tonnes, bess, flex, exp, gross, opex: ox, ebitda, net, cum, dscr: ds > 0 ? ebitda / ds : Infinity });
  }
  const equity = capex * (1 - global.debtRatio);
  const net = flows.map((f) => f.net);
  const dscrs = flows.map((f) => f.dscr).filter(isFinite);
  const premium = (riskScore / 100) * 0.05;
  return {
    capex, flows,
    npv: npv(global.discountRate, equity, net),
    raNpv: npv(global.discountRate + premium, equity, net),
    irr: irr(equity, net),
    payback: payback(equity, net),
    minDscr: Math.min(...dscrs), avgDscr: dscrs.reduce((a, b) => a + b, 0) / dscrs.length,
    revenue25: flows.reduce((a, f) => a + f.gross, 0),
    clientYr: flows.reduce((a, f) => a + f.sav, 0) / flows.length,
    marginYr: flows.reduce((a, f) => a + f.marg, 0) / flows.length,
    tonnes: flows.reduce((a, f) => a + f.tonnes, 0),
    genLife: flows.reduce((a, f) => a + f.gen, 0),
  };
}

// --- Scoring (mirrors src/services/scoringEngine.ts) ------------------------
const CREDIT = { AAA: 100, AA: 92, A: 82, BBB: 70, BB: 50, B: 32, Unrated: 20 };
const SECTOR = { "Data Centre": 100, Logistics: 90, Manufacturing: 85, "Cold Storage": 80, Industrial: 75, Retail: 65, "Commercial Office": 55, "Public Sector": 60 };
const s100 = (v, lo, hi) => (hi === lo ? 50 : clamp(((v - lo) / (hi - lo)) * 100, 0, 100));
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

function score(irrVal, minDscr) {
  const c = input.commercial, st = input.site, cl = input.client, t = input.technology, cb = input.carbon;
  const energy = avg([s100(st.annualConsumptionMWh, 500, 50000), s100(c.currentGridPrice, 0.12, 0.35), s100(c.currentGridPrice - c.ppaTargetPrice, 0, 0.12), s100(c.gridPriceEscalation, 0, 0.08)]);
  const roofCond = { "New / Excellent": 100, Good: 80, Fair: 50, "Poor / Requires works": 15 }[st.roofCondition];
  const gridC = { "Strong import & export": 100, "Import only": 75, "Constrained export": 60, "Heavily constrained": 35, "Connection required": 20 }[st.gridConnection];
  const site = avg([s100(st.roofAreaM2, 1000, 40000), s100(st.availableLandHa, 0, 10), roofCond, gridC]);
  const tenure = { "Owner-occupier": 100, "Long lease": 85, "Multi-let": 45, "Short lease": 25 }[cl.ownershipStatus];
  const crisk = { Low: 100, Medium: 65, High: 30 }[c.contractRisk];
  const contract = avg([CREDIT[cl.creditRating], tenure, s100(c.takeOrPayPct, 0.5, 1), s100(c.ppaTermYears, 5, 25), crisk]);
  const esgU = { Mandatory: 100, High: 80, Moderate: 50, Low: 25 }[cl.esgUrgency];
  const carbon = avg([esgU, s100(cb.carbonPrice, 30, 150), cb.mrvRequired ? 100 : 40, s100(cb.scopeRelevance.length, 0, 3), (cb.supplierTransparencyNeed ? 50 : 0) + (cb.biodiversityCircularity ? 50 : 0)]);
  const gridConstraint = { "Heavily constrained": 100, "Constrained export": 80, "Import only": 50 }[st.gridConnection] ?? 30;
  const flex = avg([s100(t.batteryEnergyMWh, 0, 20), gridConstraint, t.flexibilityEligible ? 100 : 30, clamp((st.highIntensityLoad ? 60 : 20) + (st.evFleetPotential ? 40 : 0), 0, 100)]);
  const tline = { "<3 months": 100, "3-6 months": 80, "6-12 months": 55, "12+ months": 30 }[cl.decisionTimeline];
  const strategic = avg([SECTOR[cl.sector], tline]);
  const finance = avg([isFinite(irrVal) ? s100(irrVal, 0.06, 0.25) : 30, isFinite(minDscr) ? s100(minDscr, 1, 2) : 50, CREDIT[cl.creditRating]]);
  const cats = [
    { label: "Energy economics", weight: 0.25, score: energy },
    { label: "Site technical viability", weight: 0.15, score: site },
    { label: "Contractability", weight: 0.15, score: contract },
    { label: "Carbon / ESG value", weight: 0.15, score: carbon },
    { label: "Flexibility / grid value", weight: 0.1, score: flex },
    { label: "Strategic sector value", weight: 0.1, score: strategic },
    { label: "Financeability", weight: 0.1, score: finance },
  ];
  const overall = cats.reduce((a, c2) => a + c2.score * c2.weight, 0);
  const risk = clamp(100 - avg([contract, site, finance]), 0, 100);
  const action = overall < 35 ? "Reject" : overall < 50 ? "Watchlist" : overall < 65 ? "Feasibility" : overall < 80 ? (risk < 55 ? "Priority" : "Priority") : risk < 55 ? "Strategic Flagship" : "Priority";
  return { cats, overall, risk, action, energy, carbon, flex, finance, financialAttractiveness: energy * 0.6 + finance * 0.4 };
}

// --- Scenarios --------------------------------------------------------------
const SCN = [
  { label: "Base Case", curt: 0.02, risk: 1 },
  { label: "Conservative", curt: 0.04, risk: 1.2 },
  { label: "Downside", curt: 0.08, risk: 1.5 },
  { label: "Upside", curt: 0.01, risk: 0.85 },
  { label: "Aggressive Growth", curt: 0.0, risk: 0.75 },
];

// --- Compute ----------------------------------------------------------------
const prelim = runModel(0.02, 40);
const sc = score(prelim.irr, prelim.minDscr);
const fin = runModel(0.02, sc.risk);
const scenarios = SCN.map((s) => {
  const p = runModel(s.curt, 40);
  const sscore = score(p.irr, p.minDscr);
  const f = runModel(s.curt, sscore.risk * s.risk);
  return { label: s.label, score: sscore.overall, irr: f.irr, npv: f.npv, raNpv: f.raNpv * (s.risk <= 1 ? 1.0 : 0.95), payback: f.payback, action: sscore.action };
});

// --- Formatters -------------------------------------------------------------
const gbp = (v, c = true) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", notation: c ? "compact" : "standard", maximumFractionDigits: c ? 1 : 0 }).format(v);
const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;
const num = (v, d = 0) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: d }).format(v);
const scoreCol = (s) => (s >= 75 ? "#22c55e" : s >= 60 ? "#0ea5e9" : s >= 45 ? "#f59e0b" : "#ef4444");
const actCol = (a) => ({ "Strategic Flagship": "#22c55e", Priority: "#0ea5e9", Feasibility: "#94a3b8", Watchlist: "#f59e0b", Reject: "#ef4444" }[a] || "#94a3b8");

// --- Revenue stack SVG ------------------------------------------------------
function revenueChart() {
  const W = 900, H = 280, pad = { l: 60, r: 20, t: 20, b: 30 };
  const series = [
    { key: "ppa", col: "#22c55e", label: "PPA" },
    { key: "carbon", col: "#0ea5e9", label: "Carbon" },
    { key: "flexbess", col: "#f59e0b", label: "Flex+BESS" },
    { key: "exp", col: "#a78bfa", label: "Export" },
  ];
  const data = fin.flows.map((f) => ({ year: f.year, ppa: f.ppa, carbon: f.carbon, flexbess: f.flex + f.bess, exp: f.exp }));
  const maxY = Math.max(...data.map((d) => d.ppa + d.carbon + d.flexbess + d.exp)) * 1.1;
  const x = (i) => pad.l + (i / (data.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => H - pad.b - (v / maxY) * (H - pad.t - pad.b);
  let paths = "";
  let baseline = data.map(() => 0);
  for (const s of series) {
    const top = data.map((d, i) => baseline[i] + d[s.key]);
    let p = `M ${x(0)} ${y(baseline[0])}`;
    top.forEach((v, i) => (p += ` L ${x(i)} ${y(v)}`));
    for (let i = data.length - 1; i >= 0; i--) p += ` L ${x(i)} ${y(baseline[i])}`;
    p += " Z";
    paths += `<path d="${p}" fill="${s.col}" fill-opacity="0.5" stroke="${s.col}" stroke-width="1"/>`;
    baseline = top;
  }
  let grid = "";
  for (let g = 0; g <= 4; g++) { const v = (maxY / 4) * g; grid += `<line x1="${pad.l}" y1="${y(v)}" x2="${W - pad.r}" y2="${y(v)}" stroke="#1e293b"/><text x="${pad.l - 6}" y="${y(v) + 4}" fill="#64748b" font-size="10" text-anchor="end">${gbp(v)}</text>`; }
  let xlabels = "";
  [1, 5, 10, 15, 20, 25].forEach((yr) => { const i = yr - 1; xlabels += `<text x="${x(i)}" y="${H - 8}" fill="#64748b" font-size="10" text-anchor="middle">Yr ${yr}</text>`; });
  const legend = series.map((s, i) => `<g transform="translate(${pad.l + i * 110},${pad.t})"><rect width="10" height="10" fill="${s.col}" rx="2"/><text x="14" y="9" fill="#94a3b8" font-size="11">${s.label}</text></g>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:100%">${grid}${paths}${xlabels}${legend}</svg>`;
}

// --- Score gauge SVG --------------------------------------------------------
function gauge(val) {
  const r = 70, cx = 90, cy = 90, circ = Math.PI * r; // semicircle-ish
  const frac = val / 100;
  const start = 220, end = -40, sweep = start - end;
  const a0 = (start * Math.PI) / 180;
  const a1 = ((start - sweep * frac) * Math.PI) / 180;
  const pt = (ang) => [cx + r * Math.cos(ang), cy - r * Math.sin(ang)];
  const [sx, sy] = pt(a0), [ex, ey] = pt(a1);
  const large = sweep * frac > 180 ? 1 : 0;
  const [bx, by] = pt((end * Math.PI) / 180);
  return `<svg viewBox="0 0 180 150" width="200">
    <path d="M ${sx} ${sy} A ${r} ${r} 0 1 1 ${bx} ${by}" fill="none" stroke="#1e293b" stroke-width="14" stroke-linecap="round"/>
    <path d="M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}" fill="none" stroke="${scoreCol(val)}" stroke-width="14" stroke-linecap="round"/>
    <text x="90" y="92" fill="${scoreCol(val)}" font-size="40" font-weight="700" text-anchor="middle">${val.toFixed(0)}</text>
    <text x="90" y="112" fill="#64748b" font-size="11" text-anchor="middle">out of 100</text>
  </svg>`;
}

const metric = (label, value, sub, col = "#e2e8f0") =>
  `<div class="card metric"><div class="mlabel">${label}</div><div class="mvalue" style="color:${col}">${value}</div>${sub ? `<div class="msub">${sub}</div>` : ""}</div>`;

// --- HTML -------------------------------------------------------------------
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lightsummit Opportunity Engine — Preview</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0f1c;color:#e2e8f0;padding:24px;line-height:1.4}
.wrap{max-width:1200px;margin:0 auto}
.banner{background:#0e1628;border:1px solid #1e293b;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#94a3b8}
.head{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.logo{width:40px;height:40px;border-radius:10px;background:rgba(34,197,94,.15);display:flex;align-items:center;justify-content:center;font-size:20px}
h1{font-size:18px;font-weight:700}
.sub{font-size:12px;color:#64748b}
h2{font-size:14px;font-weight:600;margin:24px 0 12px;color:#cbd5e1}
.card{background:#0e1628;border:1px solid #1e293b;border-radius:10px;padding:16px}
.grid{display:grid;gap:12px}
.g6{grid-template-columns:repeat(6,1fr)}.g4{grid-template-columns:repeat(4,1fr)}.g3{grid-template-columns:repeat(3,1fr)}
@media(max-width:900px){.g6,.g4,.g3{grid-template-columns:repeat(2,1fr)}}
.metric .mlabel{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
.metric .mvalue{font-size:22px;font-weight:700;margin-top:6px}
.metric .msub{font-size:11px;color:#64748b;margin-top:2px}
.top{display:grid;grid-template-columns:280px 1fr;gap:12px;align-items:stretch}
@media(max-width:900px){.top{grid-template-columns:1fr}}
.gaugecard{display:flex;flex-direction:column;align-items:center;justify-content:center}
.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:12px}
th{text-align:right;color:#64748b;font-weight:500;padding:8px;border-bottom:1px solid #1e293b;font-size:11px}
th:first-child,td:first-child{text-align:left}
td{padding:8px;border-bottom:1px solid #16203285}
.bar{height:8px;background:#1e293b;border-radius:999px;overflow:hidden;margin-top:4px}
.bar>div{height:100%;border-radius:999px}
.catrow{margin-bottom:12px}
.catrow .top2{display:flex;justify-content:space-between;font-size:13px}
.foot{margin-top:28px;font-size:11px;color:#475569;text-align:center}
</style></head><body><div class="wrap">

<div class="banner">📸 <b>Static preview</b> generated from the Lightsummit engine's model logic against the seed opportunity (Base Case). The live Next.js app is fully interactive — this snapshot is for viewing without running a server.</div>

<div class="head"><div class="logo">☀️</div><div><h1>Lightsummit Opportunity Assessing Engine</h1><div class="sub">${input.client.companyName} · ${input.client.sector} · ${input.client.country}</div></div></div>

<h2>Executive Dashboard</h2>
<div class="top">
  <div class="card gaugecard">
    <div class="sub" style="margin-bottom:8px">Total Opportunity Score</div>
    ${gauge(sc.overall)}
    <div style="margin-top:8px"><span class="badge" style="background:${actCol(sc.action)}22;color:${actCol(sc.action)}">${sc.action}</span></div>
  </div>
  <div class="grid g3" style="align-content:start">
    ${metric("Financial attractiveness", sc.financialAttractiveness.toFixed(0) + "/100", null, "#22c55e")}
    ${metric("Carbon impact", sc.carbon.toFixed(0) + "/100", num(fin.tonnes) + " tCO₂ life", "#0ea5e9")}
    ${metric("Grid / flexibility value", sc.flex.toFixed(0) + "/100", null, "#0ea5e9")}
    ${metric("Risk-adjusted NPV", gbp(fin.raNpv), "Base " + gbp(fin.npv), fin.raNpv >= 0 ? "#22c55e" : "#ef4444")}
    ${metric("Project IRR", pct(fin.irr), null, "#22c55e")}
    ${metric("Payback period", fin.payback.toFixed(1) + " yrs", null)}
  </div>
</div>

<div class="grid g6" style="margin-top:12px">
  ${metric("Client savings / yr", gbp(fin.clientYr), null, "#22c55e")}
  ${metric("Investor return (IRR)", pct(fin.irr), null, "#0ea5e9")}
  ${metric("25-yr total revenue", gbp(fin.revenue25), null)}
  ${metric("Lightsummit margin / yr", gbp(fin.marginYr), "Recurring", "#22c55e")}
  ${metric("Lifetime generation", num(fin.genLife) + " MWh", null, "#0ea5e9")}
  ${metric("Min DSCR", fin.minDscr.toFixed(2), "Avg " + fin.avgDscr.toFixed(2), fin.minDscr >= 1.3 ? "#22c55e" : "#f59e0b")}
</div>

<h2>Revenue stack over PPA term</h2>
<div class="card">${revenueChart()}</div>

<h2>Scoring engine — category breakdown</h2>
<div class="card">
  ${sc.cats.map((c) => `<div class="catrow"><div class="top2"><span>${c.label} <span style="color:#64748b;font-size:11px">${(c.weight * 100).toFixed(0)}% weight</span></span><span style="color:${scoreCol(c.score)};font-weight:600">${c.score.toFixed(0)}</span></div><div class="bar"><div style="width:${c.score}%;background:${scoreCol(c.score)}"></div></div></div>`).join("")}
</div>

<h2>Scenario engine — comparison</h2>
<div class="card"><table>
  <thead><tr><th>Scenario</th><th>Score</th><th>IRR</th><th>NPV</th><th>RA-NPV</th><th>Payback</th><th style="text-align:center">Action</th></tr></thead>
  <tbody>${scenarios.map((s) => `<tr><td>${s.label}</td><td style="text-align:right;color:${scoreCol(s.score)};font-weight:600">${s.score.toFixed(0)}</td><td style="text-align:right">${isFinite(s.irr) ? pct(s.irr) : "n/a"}</td><td style="text-align:right">${gbp(s.npv)}</td><td style="text-align:right">${gbp(s.raNpv)}</td><td style="text-align:right">${isFinite(s.payback) ? s.payback.toFixed(1) + "y" : ">term"}</td><td style="text-align:center"><span class="badge" style="background:${actCol(s.action)}22;color:${actCol(s.action)}">${s.action}</span></td></tr>`).join("")}</tbody>
</table></div>

<div class="foot">Lightsummit Opportunity Assessing Engine · static preview · figures illustrative, not financial advice.<br>Full interactive app: <code>npm install &amp;&amp; npm run dev</code> → Dashboard, Intake, Scoring, Financial, Scenarios, Pipeline, Market Map, Risk Matrix.</div>
</div></body></html>`;

writeFileSync(new URL("../preview.html", import.meta.url), html);

// ---------------------------------------------------------------------------
// Landing preview (mirrors src/components/landing) — high-end front visual
// ---------------------------------------------------------------------------
const modules = [
  ["▦", "Executive Dashboard", "Score, NPV, IRR, payback, carbon and action at a glance."],
  ["▤", "Site Intake", "Five-section intake: client, site, commercial, tech, ESG."],
  ["◎", "Scoring Engine", "Weighted 0–100 score across seven categories."],
  ["∑", "Financial Model", "NPV, IRR, DSCR, risk-adjusted returns, 25-yr cash flows."],
  ["⇄", "Scenario Engine", "Base, conservative, downside, upside, aggressive."],
  ["▥", "Opportunity Pipeline", "Nine-stage pipeline from lead to operational."],
  ["◰", "European Market Map", "Nine markets ranked with entry strategy."],
  ["⚠", "Risk Matrix", "Likelihood × impact heat-map with mitigations."],
];
const streams = [
  ["⚡", "PPAs", "10–25 yr fixed price + inflation, zero-capex offers."],
  ["▮", "Storage & flexibility", "BESS arbitrage, DSR, capacity, balancing."],
  ["♻", "Carbon value", "Verified abatement monetised via digital MRV."],
  ["⌁", "EV & optimisation", "EV charging, BEMS/HEMS, behind-the-meter."],
  ["◷", "Developer margin", "Recurring 1p/kWh on every delivered unit."],
  ["▤", "ESG / MRV", "ISSB/CSRD reporting and Scope 1/2/3 disclosure."],
];
const markets = [["United Kingdom", 88], ["Germany", 84], ["Netherlands", 82], ["Spain", 80], ["Ireland", 78], ["Italy", 76], ["Nordics", 74], ["Poland", 72], ["France", 70]];
const journey = [["01", "Developer", "Originate and structure zero-capex PPA opportunities."], ["02", "Co-investor", "Take equity alongside strategic finance partners."], ["03", "Platform", "Aggregate sites, data and MRV into a scalable platform."], ["04", "Asset owner", "Own hybrid solar-battery portfolios with diversified income."]];
const ticker = ["ETS expansion", "ISSB / CSRD", "Grid constraints", "Flexible demand", "Zero-capex offers", "Digital MRV", "Risk-adjusted NPV", "Portfolio aggregation", "Scope 3 pressure", "PPA structuring", "BESS arbitrage", "Carbon value"];

const landing = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lightsummit Opportunity Engine — Front Visual</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0f1c;color:#e2e8f0;line-height:1.45;overflow-x:hidden}
a{color:inherit;text-decoration:none}
.bg{position:fixed;inset:0;z-index:-1;overflow:hidden}
.blob{position:absolute;border-radius:9999px;filter:blur(80px);opacity:.5;animation:drift 18s ease-in-out infinite}
@keyframes drift{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(6%,-4%) scale(1.1)}66%{transform:translate(-5%,5%) scale(.95)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes fade{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.grid-overlay{position:absolute;inset:0;background-image:linear-gradient(rgba(100,116,139,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(100,116,139,.16) 1px,transparent 1px);background-size:46px 46px;-webkit-mask-image:radial-gradient(ellipse 80% 60% at 50% 0,#000 40%,transparent 100%);mask-image:radial-gradient(ellipse 80% 60% at 50% 0,#000 40%,transparent 100%)}
.glass{background:rgba(14,22,40,.6);backdrop-filter:blur(14px);border:1px solid rgba(51,65,85,.7)}
.wrap{max-width:1100px;margin:0 auto;padding:0 24px}
.nav{position:sticky;top:12px;z-index:50}
.navin{display:flex;align-items:center;justify-content:space-between;border-radius:999px;padding:10px 18px;margin-top:12px}
.brand{display:flex;align-items:center;gap:10px}
.logo{width:32px;height:32px;border-radius:9px;background:rgba(34,197,94,.15);display:flex;align-items:center;justify-content:center}
.navlinks{display:flex;gap:24px;color:#94a3b8;font-size:14px}
.btn{display:inline-flex;align-items:center;gap:6px;background:#22c55e;color:#0a0f1c;font-weight:600;border-radius:999px;padding:9px 18px;font-size:14px}
.btn.lg{padding:14px 30px;font-size:15px}
.btn.ghost{background:transparent;color:#e2e8f0;border:1px solid #334155}
.hero{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;padding:70px 0}
@media(max-width:880px){.hero{grid-template-columns:1fr}.navlinks{display:none}}
.pill{display:inline-flex;align-items:center;gap:8px;border:1px solid #334155;background:rgba(30,41,59,.4);border-radius:999px;padding:5px 12px;font-size:12px;color:#94a3b8;margin-bottom:20px}
h1{font-size:clamp(34px,5vw,60px);line-height:1.05;font-weight:700;letter-spacing:-.02em}
.grad{background:linear-gradient(100deg,#22c55e,#0ea5e9 45%,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{margin-top:20px;max-width:560px;color:#94a3b8;font-size:18px}
.ctarow{margin-top:32px;display:flex;gap:12px;flex-wrap:wrap}
.stats{margin-top:40px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.stats .v{font-size:24px;font-weight:700}.stats .l{font-size:12px;color:#64748b}
.fade{animation:fade .7s ease-out both}
.mock{animation:float 6s ease-in-out infinite;border-radius:18px;padding:16px;box-shadow:0 30px 60px -20px rgba(0,0,0,.6)}
.dots{display:flex;gap:6px;align-items:center;margin-bottom:12px}
.dot{width:10px;height:10px;border-radius:50%}
.mgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.mcard{border:1px solid #1e293b;background:rgba(14,22,40,.6);border-radius:12px;padding:12px}
.mcap{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
.chart{display:flex;align-items:flex-end;gap:5px;height:90px;margin-top:8px}
.chart>span{flex:1;border-radius:4px 4px 0 0;background:linear-gradient(180deg,#22c55e,#0ea5e9 60%,transparent);opacity:.85}
.tick{border-top:1px solid rgba(51,65,85,.6);border-bottom:1px solid rgba(51,65,85,.6);background:rgba(10,15,28,.4);padding:12px 0;overflow:hidden}
.tickrow{display:flex;gap:32px;white-space:nowrap;color:#94a3b8;font-size:14px;animation:marquee 28s linear infinite;width:max-content}
.tickrow span{display:inline-flex;align-items:center;gap:8px}
.ey{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.2em;color:#22c55e;margin-bottom:12px}
section{padding:80px 0}
.sh{max-width:620px;margin:0 auto;text-align:center}
.sh h2{font-size:clamp(26px,3.5vw,38px);font-weight:700;letter-spacing:-.02em}
.sh p{margin-top:16px;color:#94a3b8}
.cards{margin-top:48px;display:grid;gap:16px}
.c4{grid-template-columns:repeat(4,1fr)}.c3{grid-template-columns:repeat(3,1fr)}
@media(max-width:880px){.c4,.c3{grid-template-columns:repeat(2,1fr)}.stats{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.c4,.c3{grid-template-columns:1fr}}
.tile{border:1px solid #1e293b;background:rgba(14,22,40,.5);border-radius:16px;padding:20px;transition:transform .25s,border-color .25s}
.tile:hover{transform:translateY(-4px);border-color:rgba(34,197,94,.5)}
.ic{width:42px;height:42px;border-radius:12px;background:rgba(34,197,94,.1);display:flex;align-items:center;justify-content:center;color:#22c55e;font-size:18px;margin-bottom:12px}
.ic.acc{background:rgba(14,165,233,.1);color:#0ea5e9}
.tile h3{font-size:14px;font-weight:600}.tile p{margin-top:6px;font-size:12px;color:#94a3b8}
.flow{display:flex;gap:14px}
.band{border-top:1px solid rgba(51,65,85,.6);border-bottom:1px solid rgba(51,65,85,.6);background:rgba(10,15,28,.3)}
.mrow{display:flex;align-items:center;justify-content:space-between;border:1px solid #1e293b;background:rgba(14,22,40,.5);border-radius:12px;padding:14px 18px;transition:transform .25s,border-color .25s}
.mrow:hover{transform:translateY(-3px);border-color:rgba(34,197,94,.5)}
.mbar{width:64px;height:6px;border-radius:999px;background:#1e293b;overflow:hidden}
.mbar>div{height:100%;background:linear-gradient(90deg,#22c55e,#0ea5e9)}
.cta{position:relative;overflow:hidden;border-radius:24px;padding:64px 24px;text-align:center}
.foot{border-top:1px solid rgba(51,65,85,.6);padding:28px 0;font-size:12px;color:#64748b}
.footin{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
.banner{position:fixed;top:0;left:0;right:0;z-index:60;background:#0e1628;border-bottom:1px solid #1e293b;padding:8px 16px;font-size:12px;color:#94a3b8;text-align:center}
.shift{padding-top:40px}
</style></head><body>
<div class="banner">📸 Static preview of the high-end front visual (animated in-browser). Live React version at route <b>/</b> · the engine at <b>/app</b>.</div>
<div class="bg"><div class="blob" style="left:-10%;top:2%;width:480px;height:480px;background:#22c55e44"></div><div class="blob" style="right:-8%;top:8%;width:420px;height:420px;background:#0ea5e944;animation-delay:-6s"></div><div class="blob" style="left:30%;top:42%;width:460px;height:460px;background:#8b5cf633;animation-delay:-12s"></div><div class="grid-overlay"></div></div>

<div class="shift"></div>
<header class="nav"><div class="wrap"><div class="navin glass">
  <div class="brand"><div class="logo">☀️</div><div><div style="font-weight:700;font-size:14px">Lightsummit</div><div style="font-size:9px;color:#64748b">Opportunity Engine</div></div></div>
  <nav class="navlinks"><a href="#platform">Platform</a><a href="#revenue">Revenue</a><a href="#markets">Markets</a><a href="#journey">Strategy</a></nav>
  <a class="btn">Launch Engine →</a>
</div></div></header>

<div class="wrap"><section class="hero">
  <div class="fade">
    <div class="pill">✦ Decentralised energy · carbon · MRV · flexibility</div>
    <h1>Assess every <span class="grad">energy opportunity</span> with institutional rigour.</h1>
    <p class="lead">The Lightsummit Opportunity Assessing Engine evaluates European commercial, industrial and data-centre sites for solar, storage, flexibility, PPAs and carbon value — scoring, modelling and ranking each one in seconds.</p>
    <div class="ctarow"><a class="btn lg">Launch the engine →</a><a class="btn lg ghost">Explore the platform</a></div>
    <div class="stats">
      <div><div class="v">12–25%+</div><div class="l">Target portfolio IRR</div></div>
      <div><div class="v">10–25 yr</div><div class="l">Contracted PPA revenue</div></div>
      <div><div class="v">9</div><div class="l">European markets</div></div>
      <div><div class="v">8</div><div class="l">Integrated modules</div></div>
    </div>
  </div>
  <div class="fade" style="animation-delay:.15s">
    <div class="mock glass">
      <div class="dots"><span class="dot" style="background:#ef444499"></span><span class="dot" style="background:#f59e0b99"></span><span class="dot" style="background:#22c55e99"></span><span style="margin-left:10px;font-size:10px;color:#64748b">Executive Dashboard · ${input.client.companyName}</span></div>
      <div class="mgrid">
        <div class="mcard"><div class="mcap">Opportunity score</div><div style="display:flex;align-items:end;gap:8px;margin-top:4px"><span style="font-size:30px;font-weight:700;color:#22c55e">${sc.overall.toFixed(0)}</span><span style="margin-bottom:5px;background:rgba(14,165,233,.15);color:#0ea5e9;border-radius:999px;padding:2px 8px;font-size:9px;font-weight:600">${sc.action}</span></div><div class="mbar" style="width:100%;margin-top:8px"><div style="width:${sc.overall}%"></div></div></div>
        <div class="mcard"><div class="mcap">Project IRR</div><div style="font-size:30px;font-weight:700;color:#0ea5e9;margin-top:4px">${pct(fin.irr)}</div><div style="font-size:9px;color:#64748b">Payback ${fin.payback.toFixed(1)} yrs</div></div>
        <div class="mcard"><div class="mcap">Risk-adj NPV</div><div style="font-size:30px;font-weight:700;color:#22c55e;margin-top:4px">${gbp(fin.raNpv)}</div><div style="font-size:9px;color:#64748b">25-yr rev ${gbp(fin.revenue25)}</div></div>
      </div>
      <div class="mcard" style="margin-top:10px"><div class="mcap">Revenue stack over PPA term</div><div class="chart">${[42, 58, 51, 70, 64, 82, 76, 90, 85, 96].map((h) => `<span style="height:${h}%"></span>`).join("")}</div></div>
    </div>
  </div>
</section></div>

<div class="tick"><div class="tickrow">${[...ticker, ...ticker].map((t) => `<span>• ${t}</span>`).join("")}</div></div>

<section id="platform"><div class="wrap"><div class="sh"><div class="ey">The platform</div><h2>Eight modules, one decision engine</h2><p>From raw site intake to investment-committee-ready output — every stage of opportunity assessment in a single, integrated workflow.</p></div>
  <div class="cards c4">${modules.map((m) => `<div class="tile"><div class="ic">${m[0]}</div><h3>${m[1]}</h3><p>${m[2]}</p></div>`).join("")}</div></div></section>

<div class="band"><section id="revenue"><div class="wrap"><div class="sh"><div class="ey">Diversified income</div><h2>Six revenue streams, stacked</h2><p>Predictable contracted revenue plus optionality — the engine models each stream and the recurring developer margin across the full asset life.</p></div>
  <div class="cards c3">${streams.map((s) => `<div class="tile" style="display:flex;gap:14px"><div class="ic acc">${s[0]}</div><div><h3>${s[1]}</h3><p>${s[2]}</p></div></div>`).join("")}</div></div></section></div>

<section id="markets"><div class="wrap"><div class="sh"><div class="ey">European coverage</div><h2>Nine markets, ranked and ready</h2><p>Attractiveness scoring across grid constraint, PPA maturity, carbon pressure, BESS opportunity and regulatory complexity.</p></div>
  <div class="cards c3">${markets.map((m, i) => `<div class="mrow"><div style="display:flex;align-items:center;gap:12px"><span style="font-size:12px;color:#64748b;font-family:monospace">${String(i + 1).padStart(2, "0")}</span><span style="font-size:14px;font-weight:500">${m[0]}</span></div><div style="display:flex;align-items:center;gap:8px"><div class="mbar"><div style="width:${m[1]}%"></div></div><span style="font-weight:700;color:#22c55e;width:26px;text-align:right">${m[1]}</span></div></div>`).join("")}</div></div></section>

<div class="band"><section id="journey"><div class="wrap"><div class="sh"><div class="ey">The strategy</div><h2>From developer to asset owner</h2><p>An asset-light path that compounds: originate, co-invest, build the platform, then own diversified hybrid portfolios.</p></div>
  <div class="cards c4">${journey.map((j, i) => `<div class="tile"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="font-size:24px;font-weight:700" class="grad">${j[0]}</span>${i < 3 ? '<span style="color:#64748b">→</span>' : ""}</div><h3>${j[1]}</h3><p>${j[2]}</p></div>`).join("")}</div></div></section></div>

<section><div class="wrap"><div class="cta glass"><div class="blob" style="left:50%;top:-40px;width:300px;height:300px;background:#22c55e33;transform:translateX(-50%)"></div>
  <h2 style="position:relative;font-size:clamp(28px,4vw,40px);font-weight:700">Turn sites into a <span class="grad">contracted portfolio</span>.</h2>
  <p style="position:relative;max-width:540px;margin:16px auto 0;color:#94a3b8">Score, model and prioritise your next decentralised energy opportunity in seconds. Everything runs locally on sample data — no sign-up required.</p>
  <div style="position:relative;margin-top:28px"><a class="btn lg">Launch the engine →</a></div>
</div></div></section>

<footer class="foot"><div class="wrap footin"><div>☀️ Lightsummit Opportunity Assessing Engine</div><div>Figures illustrative · not financial advice · built for assessment.</div></div></footer>
</body></html>`;

writeFileSync(new URL("../landing-preview.html", import.meta.url), landing);

console.log("Wrote preview.html + landing-preview.html");
console.log("Score:", sc.overall.toFixed(1), "| IRR:", pct(fin.irr), "| RA-NPV:", gbp(fin.raNpv), "| Payback:", fin.payback.toFixed(1) + "y", "| Action:", sc.action);
