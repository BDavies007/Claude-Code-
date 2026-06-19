# Lightsummit Opportunity Assessing Engine

An intelligent opportunity assessment platform for **European decentralised
energy projects**. The engine evaluates commercial, industrial, logistics,
retail, data centre and public-sector sites for solar PV, battery storage,
BEMS/HEMS, EV charging, flexibility services, PPAs, carbon value, ESG/MRV and
long-term portfolio aggregation.

It is built around Lightsummit's strategy: zero-capex client offers, 10–25 year
PPAs (fixed price + inflation), digital MRV, diversified revenue streams and
recurring developer margins, scaling from developer → co-investor → platform →
asset owner.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** with shadcn/ui-style component primitives
- **Recharts** for visualisation
- **Zustand** for state (live recomputation of model + score on every input)
- **Supabase-ready** architecture (currently backed by local mock data)
- Modular `services/` folder for all calculations
- Export-ready data objects for future Excel / PDF / report generation

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # strict TS check
npm run build      # production build
```

## Product modules

1. **Executive Dashboard** — total opportunity score, financial attractiveness,
   carbon impact, grid/flexibility value, client savings, investor return,
   risk-adjusted NPV, IRR, payback, 25-year revenue, client benefit/yr,
   Lightsummit recurring margin and the recommended action (Reject → Watchlist
   → Feasibility → Priority → Strategic Flagship).
2. **Site Intake Form** — five sections (client, site, commercial, technology,
   carbon/ESG) feeding the model in real time.
3. **Opportunity Scoring Engine** — weighted 0–100 score across seven
   categories (energy economics 25%, site viability 15%, contractability 15%,
   carbon/ESG 15%, flexibility/grid 10%, strategic sector 10%, financeability
   10%), each with explainable sub-scores.
4. **Financial Calculator** — reusable, pure functions: `annualGeneration`,
   `clientSavings`, `ppaRevenue`, `developerMargin`, `carbonValue`,
   `bessArbitrageValue`, `flexibilityRevenue`, `opex`, `projectCashFlows`,
   `npv`, `irr`, `payback`, `dscr`, `riskAdjustedNPV`, `portfolioValue`.
5. **Scenario Engine** — Base, Conservative, Downside, Upside, Aggressive
   Growth and Custom, each perturbing price, capex, carbon, load, financing,
   construction delay and curtailment.
6. **Opportunity Pipeline** — filterable table across nine deal stages.
7. **European Market Opportunity Map** — attractiveness, grid constraint, PPA
   maturity, carbon/ESG pressure, BESS opportunity, regulatory complexity and
   recommended entry strategy for nine markets.
8. **Risk Matrix** — likelihood × impact heat-map with a mitigated risk
   register.

## Project structure

```
src/
  app/                 Next.js App Router (layout, page, globals)
  components/
    ui/                shadcn-style primitives (card, button, badge, …)
    shared/            MetricCard, form fields
    modules/           the eight product modules
    AppShell.tsx       navigation + layout
  services/            financialCalculator, scoringEngine, scenarioEngine, exportService
  store/               Zustand store (live derived state)
  data/                mock data (sample opportunity, pipeline, markets, risk)
  types/               domain model
  lib/                 utils + display helpers
```

## Default model assumptions

PPA term 25y · inflation 3% · developer margin 1p/kWh · take-or-pay 85% ·
performance ratio 82–92% · degradation 0.45%/yr · discount rate, carbon price,
debt/equity all editable in the UI.

## Supabase readiness

State and mock data are isolated in `store/` and `data/`. Swapping to Supabase
means replacing the `data/` loaders and persisting `OpportunityInput` /
`PipelineEntry` rows — the services and components are unchanged.

> All figures are illustrative defaults for assessment purposes and not
> financial advice.
