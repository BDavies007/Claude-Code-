# Voltarc · Clean-Tech Command Centre

An animated **business operational command centre** for a clean-tech energy
company — a premium executive dashboard that visually maps the business from
**strategy to execution**. Bloomberg terminal meets strategy war room.

Built with **Next.js · React · Tailwind CSS · Framer Motion · Recharts · React Flow**.

![stack](https://img.shields.io/badge/Next.js-14-black) ![stack](https://img.shields.io/badge/React-18-blue) ![stack](https://img.shields.io/badge/Tailwind-3-teal)

---

## ✨ Features

| # | Module | What it does |
|---|--------|--------------|
| 1 | **Animated Business Map** | Nine divisions (Development, EPC, Finance, SPVs, Asset Ownership, O&M, Energy Trading, Carbon, Client Reporting) as animated React Flow nodes with live value flows. Click any node for KPIs, risks, owners and active projects. |
| 2 | **Project Pipeline** | Kanban across all ten stages (Lead → Operation). Each project shows value, MWp, client, status, margin, blockers, probability and next action. Filter by active / blocked. |
| 3 | **Revenue Waterfall** | Eight monetisation streams as an animated waterfall chart with Base / Upside / Downside scenario toggles. |
| 4 | **Risk Cockpit** | Nine risk categories scored 1–5 on likelihood × impact, plotted on a 5×5 heat matrix with mitigation actions and owners. |
| 5 | **Financial Scenario Engine** | Ten live input sliders (PPA price, grid price, capex, system size, battery, debt %, interest, carbon price, inflation, O&M) driving IRR, NPV, EBITDA, client savings, payback, carbon value and equity return — recomputed live over a 25-year model. |
| 6 | **CEO Command Centre** | Critical decisions, blocked projects, highest-value opportunities, cash impact, risk alerts, team actions and investor-ready metrics. |
| 7 | **Premium design** | Dark war-room aesthetic, neon-green / teal / electric-blue accents, animated transitions throughout. |
| 8 | **Modular & DB-ready** | Mock data isolated in `src/data/*`, typed contracts in `src/types`, reusable UI in `src/components/ui`. |
| 9 | **Extras** | Export report button, Investor / Client / Operations / Executive view toggles, AI recommendations panel (placeholder). |

---

## 🚀 Run locally

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev

# 3. Open the dashboard
#    http://localhost:3000
```

Other scripts:

```bash
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```

> Requires Node.js 18.18+ (Node 20 LTS recommended).

---

## 🗂 Project structure

```
src/
├── app/
│   ├── layout.tsx            # Root layout, fonts, ViewMode provider
│   ├── page.tsx              # Shell: sidebar + topbar + animated section switch
│   └── globals.css           # Tailwind layers + war-room theme + React Flow overrides
│
├── components/
│   ├── providers/
│   │   └── ViewModeProvider.tsx   # Executive / Investor / Client / Operations lens
│   ├── layout/
│   │   ├── Sidebar.tsx            # Section nav + nav item registry
│   │   └── TopBar.tsx             # Live ticker, view toggles, export, AI button
│   ├── ui/                        # Reusable primitives
│   │   ├── Panel.tsx              # Animated card surface
│   │   ├── SectionHeader.tsx
│   │   ├── Badge.tsx
│   │   └── Stat.tsx
│   ├── business-map/              # (1) Animated business map
│   │   ├── BusinessMap.tsx
│   │   ├── DivisionNode.tsx       # Custom React Flow node
│   │   └── NodeDetailPanel.tsx    # Slide-over KPI/risk/owner panel
│   ├── pipeline/                  # (2) Project pipeline
│   │   ├── ProjectPipeline.tsx
│   │   └── ProjectCard.tsx
│   ├── revenue/                   # (3) Revenue waterfall
│   │   └── RevenueWaterfall.tsx
│   ├── risk/                      # (4) Risk cockpit
│   │   └── RiskCockpit.tsx
│   ├── scenario/                  # (5) Financial scenario engine
│   │   ├── ScenarioEngine.tsx
│   │   └── Slider.tsx
│   ├── ceo/                       # (6) CEO command centre
│   │   └── CommandCentre.tsx
│   └── panels/                    # (9) Extras
│       ├── AIRecommendations.tsx  # Slide-over AI panel (placeholder)
│       └── ExportToast.tsx        # Export confirmation (placeholder)
│
├── data/                     # 🔌 Mock data — swap for DB/API here
│   ├── divisions.ts
│   ├── projects.ts
│   ├── revenue.ts
│   ├── risks.ts
│   └── ceo.ts
│
├── lib/
│   ├── finance.ts            # 25-yr project-finance model (IRR/NPV/EBITDA/…)
│   └── format.ts             # Currency / percent / number formatters
│
└── types/
    └── index.ts              # All domain types (DB-schema-aligned)
```

---

## 🔌 Wiring real data later

The app is structured so mock data can be replaced without touching component
code:

1. **Types are the contract.** Everything in `src/data/*` conforms to the
   interfaces in `src/types/index.ts`. Keep your database rows mapping to these
   shapes.
2. **Swap the data modules.** Replace the static exports in `src/data/*` with
   async fetchers (Next.js Server Components, route handlers, or a typed API
   client). For example, turn `export const projects = [...]` into a
   `getProjects()` that queries your DB and returns `Project[]`.
3. **The finance engine is pure.** `src/lib/finance.ts` takes `ScenarioInputs`
   and returns `ScenarioOutputs` + cashflows — move it server-side or back it
   with a more detailed model without changing the UI.
4. **AI + Export are placeholders.** `AIRecommendations` reads from
   `src/data/ceo.ts`; point it at an LLM/analytics service. `ExportToast` marks
   where to generate a real PDF / board pack.

---

## 🎨 Design system

- **Surface:** deep `base-900 → 500` greys with subtle teal/blue radial glows.
- **Accents:** `neon` (#39ff8b), `teal` (#1fe0c8), `electric` (#3da9ff).
- **Motion:** Framer Motion entrance staggers, layout animations on toggles,
  animated React Flow edges, live-updating chart transitions.
- Tokens live in `tailwind.config.ts`; component classes in `globals.css`.

---

## 🧱 Tech stack

| Concern | Library |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS 3 |
| Animation | Framer Motion 11 |
| Charts | Recharts 2 |
| Node/flow graph | React Flow (`reactflow`) 11 |

---

*All figures are illustrative mock data for demonstration purposes.*
