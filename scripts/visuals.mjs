/**
 * Visual asset generator.
 *
 * Emits brand-consistent standalone SVG infographics for the Lightsummit
 * Opportunity Assessing Engine into docs/visuals/. SVGs open directly in any
 * browser and embed cleanly in decks, docs and the README.
 */

import { writeFileSync, mkdirSync } from "node:fs";

const OUT = new URL("../docs/visuals/", import.meta.url);
mkdirSync(OUT, { recursive: true });

// --- Palette ----------------------------------------------------------------
const C = {
  bg: "#0a0f1c", card: "#0e1628", card2: "#111c33", border: "#1e293b",
  text: "#e2e8f0", muted: "#64748b", sub: "#94a3b8",
  green: "#22c55e", blue: "#0ea5e9", violet: "#a78bfa", amber: "#f59e0b", red: "#ef4444",
};
const FONT = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";

// --- Primitives -------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rect = (x, y, w, h, o = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 12}" fill="${o.fill ?? C.card}" stroke="${o.stroke ?? C.border}" stroke-width="${o.sw ?? 1}"${o.opacity ? ` opacity="${o.opacity}"` : ""}/>`;
const text = (x, y, s, o = {}) =>
  `<text x="${x}" y="${y}" fill="${o.fill ?? C.text}" font-family="${FONT}" font-size="${o.size ?? 14}" font-weight="${o.weight ?? 400}" text-anchor="${o.anchor ?? "start"}"${o.spacing ? ` letter-spacing="${o.spacing}"` : ""}>${esc(s)}</text>`;
const line = (x1, y1, x2, y2, o = {}) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.stroke ?? C.border}" stroke-width="${o.sw ?? 1.5}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}${o.marker ? ` marker-end="url(#arrow)"` : ""}/>`;

function frame(w, h, title, subtitle, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${FONT}">
  <defs>
    <linearGradient id="bggrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a0f1c"/><stop offset="1" stop-color="#0c1424"/>
    </linearGradient>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${C.green}"/><stop offset="0.5" stop-color="${C.blue}"/><stop offset="1" stop-color="${C.violet}"/>
    </linearGradient>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="${C.muted}"/>
    </marker>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000" flood-opacity="0.4"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bggrad)"/>
  <circle cx="${w - 80}" cy="60" r="220" fill="${C.green}" opacity="0.06"/>
  <circle cx="120" cy="${h - 60}" r="200" fill="${C.blue}" opacity="0.06"/>
  <!-- header -->
  <rect x="40" y="34" width="34" height="34" rx="9" fill="${C.green}" opacity="0.15"/>
  <text x="57" y="58" text-anchor="middle" font-size="18">☀️</text>
  ${text(86, 50, "Lightsummit Opportunity Assessing Engine", { size: 15, weight: 700 })}
  ${text(86, 67, title, { size: 12, fill: C.green, weight: 600, spacing: 1.5 })}
  <rect x="0" y="92" width="${w}" height="2" fill="url(#grad)" opacity="0.5"/>
  ${subtitle ? text(40, 118, subtitle, { size: 13, fill: C.sub }) : ""}
  ${body}
  ${text(40, h - 22, "Figures illustrative · not financial advice", { size: 11, fill: C.muted })}
  ${text(w - 40, h - 22, "lightsummit · decentralised energy platform", { size: 11, fill: C.muted, anchor: "end" })}
</svg>`;
}

// ===========================================================================
// 1. System architecture
// ===========================================================================
function architecture() {
  const w = 1200, h = 760;
  const layers = [
    { y: 150, title: "Presentation", color: C.green, items: ["Landing /", "Executive Dashboard", "Site Intake", "Scoring", "Financial", "Scenarios", "Pipeline", "Market Map", "Risk Matrix"] },
    { y: 320, title: "State", color: C.blue, items: ["Zustand store", "Live derived state", "Active scenario", "Global assumptions"] },
    { y: 470, title: "Services (pure)", color: C.violet, items: ["financialCalculator", "scoringEngine", "scenarioEngine", "exportService"] },
    { y: 620, title: "Data & Types", color: C.amber, items: ["sampleOpportunity", "pipeline", "marketProfiles", "riskMatrix", "types · Supabase-ready"] },
  ];
  let body = "";
  layers.forEach((L, li) => {
    body += rect(40, L.y, w - 80, 110, { fill: C.card, stroke: L.color, sw: 1, r: 16, opacity: 0.98 });
    body += `<rect x="40" y="${L.y}" width="6" height="110" rx="3" fill="${L.color}"/>`;
    body += text(64, L.y + 30, L.title, { size: 15, weight: 700, fill: L.color });
    const bx = 64, bw = (w - 80 - 48) / Math.max(L.items.length, 5);
    L.items.forEach((it, i) => {
      const x = bx + i * bw;
      body += rect(x, L.y + 48, bw - 14, 46, { fill: C.card2, stroke: C.border, r: 9 });
      body += text(x + (bw - 14) / 2, L.y + 75, it, { size: 11.5, anchor: "middle", fill: C.text });
    });
    if (li < layers.length - 1) {
      body += line(w / 2, L.y + 110, w / 2, layers[li + 1].y, { stroke: C.muted, sw: 1.5, marker: true });
    }
  });
  return frame(w, h, "SYSTEM ARCHITECTURE", "Modular Next.js 14 app: UI → state → pure calculation services → data, isolated for a Supabase swap.", body);
}

// ===========================================================================
// 2. Assessment workflow
// ===========================================================================
function workflow() {
  const w = 1200, h = 600;
  const steps = [
    ["Site Intake", "Client, site, commercial,\ntech & ESG inputs", C.green],
    ["Scoring Engine", "7 weighted categories\n→ 0–100 score", C.blue],
    ["Financial Model", "NPV · IRR · DSCR\nrisk-adjusted returns", C.violet],
    ["Scenario Engine", "6 cases stress-test\nthe opportunity", C.amber],
    ["Recommendation", "Reject → Watchlist →\nFeasibility → Priority", C.green],
  ];
  let body = "";
  const n = steps.length, gap = 30, bw = (w - 80 - gap * (n - 1)) / n, y = 170, bh = 150;
  steps.forEach((s, i) => {
    const x = 40 + i * (bw + gap);
    body += rect(x, y, bw, bh, { fill: C.card, stroke: s[2], r: 16 });
    body += `<circle cx="${x + 26}" cy="${y + 30}" r="15" fill="${s[2]}" opacity="0.18"/>`;
    body += text(x + 26, y + 35, String(i + 1), { size: 14, weight: 700, anchor: "middle", fill: s[2] });
    body += text(x + 52, y + 35, s[0], { size: 14.5, weight: 700 });
    s[1].split("\n").forEach((ln, k) => (body += text(x + 18, y + 70 + k * 18, ln, { size: 11.5, fill: C.sub })));
    if (i < n - 1) body += line(x + bw + 4, y + bh / 2, x + bw + gap - 4, y + bh / 2, { stroke: C.muted, marker: true });
  });
  // pipeline ribbon
  const stages = ["Lead", "Qualified", "Desktop", "Feasibility", "Structuring", "IC", "Contracting", "Build", "Operational"];
  body += text(40, 400, "OPPORTUNITY PIPELINE", { size: 12, weight: 600, fill: C.muted, spacing: 1.5 });
  const sw2 = (w - 80) / stages.length;
  stages.forEach((st, i) => {
    const x = 40 + i * sw2;
    const t = i / (stages.length - 1);
    const col = i < 3 ? C.muted : i < 6 ? C.blue : C.green;
    body += rect(x + 4, 418, sw2 - 8, 44, { fill: C.card2, stroke: col, r: 9 });
    body += text(x + sw2 / 2, 445, st, { size: 11, anchor: "middle", fill: C.text });
    if (i < stages.length - 1) body += text(x + sw2 - 4, 445, "›", { size: 16, anchor: "middle", fill: C.muted });
  });
  body += rect(40, 500, w - 80, 50, { fill: C.card, stroke: C.border, r: 12 });
  body += text(60, 530, "Zero-capex client offer", { size: 12.5, fill: C.green, weight: 600 });
  body += text(330, 530, "10–25 yr PPA · fixed price + inflation", { size: 12.5, fill: C.sub });
  body += text(720, 530, "Digital MRV + carbon value", { size: 12.5, fill: C.sub });
  body += text(1010, 530, "Recurring developer margin", { size: 12.5, fill: C.blue, weight: 600 });
  return frame(w, h, "ASSESSMENT WORKFLOW", "From raw site intake to an investment-committee-ready recommendation and pipeline stage.", body);
}

// ===========================================================================
// 3. Revenue model / value stack
// ===========================================================================
function revenueModel() {
  const w = 1200, h = 680;
  const streams = [
    ["PPA energy", 46, C.green],
    ["Carbon value", 14, C.blue],
    ["Flexibility & BESS", 18, C.amber],
    ["EV & optimisation", 10, C.violet],
    ["Export", 6, C.blue],
    ["Developer margin", 6, C.green],
  ];
  let body = "";
  // Stacked bar
  body += text(40, 150, "DIVERSIFIED REVENUE STACK", { size: 12, weight: 600, fill: C.muted, spacing: 1.5 });
  const bx = 40, by = 175, bw = 560, bh = 70;
  let cx = bx;
  streams.forEach((s) => {
    const sw2 = (s[1] / 100) * bw;
    body += `<rect x="${cx}" y="${by}" width="${sw2}" height="${bh}" fill="${s[2]}" opacity="0.85"/>`;
    if (sw2 > 40) body += text(cx + sw2 / 2, by + bh / 2 + 5, s[1] + "%", { size: 13, weight: 700, anchor: "middle", fill: "#06210f" });
    cx += sw2;
  });
  body += rect(bx, by, bw, bh, { fill: "none", stroke: C.border, r: 0 });
  // Legend
  streams.forEach((s, i) => {
    const ly = 290 + i * 32;
    body += `<rect x="40" y="${ly}" width="14" height="14" rx="3" fill="${s[2]}"/>`;
    body += text(64, ly + 12, s[0], { size: 13, fill: C.text });
    body += text(360, ly + 12, s[1] + "%", { size: 13, anchor: "end", fill: C.sub, weight: 600 });
  });
  // Flow to beneficiaries
  const cardX = 680, cw = 480;
  const benes = [
    ["Client", "Lower, fixed energy cost · ~£0.8m/yr saved · Scope 1/2/3 cuts · ESG/CSRD reporting", C.green],
    ["Investor", "Risk-adjusted NPV · 12–25%+ IRR · contracted long-term cash flows · DSCR headroom", C.blue],
    ["Lightsummit", "Recurring 1p/kWh developer margin · platform & MRV fees · portfolio aggregation value", C.violet],
  ];
  body += text(cardX, 150, "WHERE THE VALUE GOES", { size: 12, weight: 600, fill: C.muted, spacing: 1.5 });
  benes.forEach((b, i) => {
    const y = 170 + i * 150;
    body += rect(cardX, y, cw, 130, { fill: C.card, stroke: b[2], r: 14 });
    body += `<rect x="${cardX}" y="${y}" width="6" height="130" rx="3" fill="${b[2]}"/>`;
    body += text(cardX + 24, y + 34, b[0], { size: 16, weight: 700, fill: b[2] });
    // wrap description
    const words = b[1].split(" · ");
    words.forEach((ln, k) => body += text(cardX + 24, y + 62 + k * 22, "• " + ln, { size: 12, fill: C.sub }));
  });
  return frame(w, h, "REVENUE MODEL", "Six stacked income streams; predictable contracted revenue plus optionality, shared across client, investor and platform.", body);
}

// ===========================================================================
// 4. Scoring weights
// ===========================================================================
function scoringWeights() {
  const w = 1200, h = 640;
  const cats = [
    ["Energy economics", 25, C.green, "consumption · grid price · PPA spread"],
    ["Site technical viability", 15, C.blue, "roof · land · condition · grid connection"],
    ["Contractability", 15, C.violet, "credit · tenure · take-or-pay · term"],
    ["Carbon / ESG value", 15, C.amber, "ESG urgency · carbon price · MRV · scopes"],
    ["Flexibility / grid value", 10, C.blue, "BESS scale · constraint · eligibility"],
    ["Strategic sector value", 10, C.green, "sector fit · decision timeline"],
    ["Financeability", 10, C.violet, "IRR · min DSCR · counterparty credit"],
  ];
  let body = "";
  // Donut
  const ccx = 250, ccy = 360, R = 150, r2 = 95;
  let a0 = -Math.PI / 2;
  cats.forEach((c) => {
    const ang = (c[1] / 100) * Math.PI * 2;
    const a1 = a0 + ang;
    const large = ang > Math.PI ? 1 : 0;
    const p = (a, r) => [ccx + r * Math.cos(a), ccy + r * Math.sin(a)];
    const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [x2, y2] = p(a1, r2), [x3, y3] = p(a0, r2);
    body += `<path d="M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r2} ${r2} 0 ${large} 0 ${x3} ${y3} Z" fill="${c[2]}" opacity="0.85"/>`;
    const mid = (a0 + a1) / 2, [lx, ly] = p(mid, (R + r2) / 2);
    body += text(lx, ly + 4, c[1] + "%", { size: 12, weight: 700, anchor: "middle", fill: "#06210f" });
    a0 = a1;
  });
  body += text(ccx, ccy - 6, "100", { size: 34, weight: 700, anchor: "middle", fill: C.text });
  body += text(ccx, ccy + 18, "weighted score", { size: 11, anchor: "middle", fill: C.muted });
  // Bars on the right
  const bx = 500, bw = 600, y0 = 165, rowH = 60;
  cats.forEach((c, i) => {
    const y = y0 + i * rowH;
    body += text(bx, y, c[0], { size: 13.5, weight: 600 });
    body += text(bx + bw, y, c[1] + "%", { size: 13.5, weight: 700, anchor: "end", fill: c[2] });
    body += rect(bx, y + 10, bw, 12, { fill: C.card2, stroke: "none", r: 6 });
    body += `<rect x="${bx}" y="${y + 10}" width="${(c[1] / 25) * bw}" height="12" rx="6" fill="${c[2]}"/>`;
    body += text(bx, y + 40, c[3], { size: 11, fill: C.muted });
  });
  return frame(w, h, "SCORING WEIGHTS", "The opportunity score blends seven explainable categories at fixed weights, each built from transparent sub-scores.", body);
}

// --- Write ------------------------------------------------------------------
const assets = {
  "01-architecture.svg": architecture(),
  "02-workflow.svg": workflow(),
  "03-revenue-model.svg": revenueModel(),
  "04-scoring-weights.svg": scoringWeights(),
};
for (const [name, svg] of Object.entries(assets)) {
  writeFileSync(new URL(name, OUT), svg);
}

// Index viewer
const index = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lightsummit — Visuals</title>
<style>body{margin:0;background:#0a0f1c;color:#e2e8f0;font-family:${FONT};padding:28px}
h1{font-size:20px}p{color:#64748b;font-size:13px;margin:6px 0 24px}
.g{display:grid;gap:24px;max-width:1240px;margin:0 auto}
.card{background:#0e1628;border:1px solid #1e293b;border-radius:14px;padding:14px}
img{width:100%;height:auto;border-radius:8px;display:block}
.cap{font-size:13px;color:#94a3b8;margin-top:10px}</style></head>
<body><div class="g"><div><h1>☀️ Lightsummit Opportunity Engine — Visuals</h1><p>Brand-consistent infographics. Open any SVG directly, or embed in decks / the README.</p></div>
${Object.keys(assets).map((n) => `<div class="card"><img src="${n}" alt="${n}"><div class="cap">${n}</div></div>`).join("\n")}
</div></body></html>`;
writeFileSync(new URL("index.html", OUT), index);

console.log("Wrote " + (Object.keys(assets).length + 1) + " files to docs/visuals/");
Object.keys(assets).forEach((n) => console.log("  · " + n));
