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
console.log("Wrote preview.html");
console.log("Score:", sc.overall.toFixed(1), "| IRR:", pct(fin.irr), "| RA-NPV:", gbp(fin.raNpv), "| Payback:", fin.payback.toFixed(1) + "y", "| Action:", sc.action);
