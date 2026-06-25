# Lead Generation & Scoring Model

A self-contained, **zero-dependency** Python package that identifies, scores,
ranks and segments the world's largest energy consumers as sales prospects for
**Beyond Green Group** (green-energy / decarbonization). It produces a
prioritized list of up to ~10,000 energy-consuming organizations as leads, plus
ready-to-use CSV / JSON / Markdown deliverables.

Runs with a bare `python3` (standard library only — `csv`, `json`,
`dataclasses`, `enum`, `random`, `argparse`, `statistics`, `math`, `datetime`,
`pathlib`). No pandas, no numpy, no pip install.

---

## ⚠️ Data integrity — read this first

**There is no reliable free public list of the actual top 10,000 global energy
consumers** — that data is licensed / proprietary. This package does **not**
fabricate 10,000 real company records and pass them off as fact. Instead it
blends two clearly-separated kinds of records, and **every export carries a
`data_quality` column**:

| `data_quality` | What it is |
|---|---|
| `public-estimate` | A small **curated** set (~83) of genuinely large, well-known real energy consumers (hyperscalers, semiconductors, steel, aluminium, cement, chemicals, mining, automotive, retail, telecom, oil & gas, paper, food & beverage, pharma, logistics). Consumption figures are **approximate, publicly-estimable** order-of-magnitude numbers for relative prioritization — **not** audited data. |
| `synthetic` | The remainder, generated from realistic per-sector / per-region energy benchmarks. **Names are deliberately generic and templated** (e.g. `China Steel Works 2285`) so no synthetic record can be mistaken for a real named firm. |
| `user-provided` | Records ingested from a user-supplied CSV via the `score` subcommand (your real prospect data). |

Synthetic generation is **reproducible** (fixed default seed `42`, overridable
with `--seed`). Use the output for **relative prioritization**, not as a factual
register of any company's energy use.

---

## Quick start

```bash
# 1) Generate, score, rank and export a full 10,000-lead list
python3 -m lead_gen.cli generate --count 10000

# 2) Score YOUR real prospects instead (same model, real data)
python3 -m lead_gen.cli score --input my_prospects.csv

# 3) Re-render just the Markdown report
python3 -m lead_gen.cli report --top 50

# Run the tests (no pip deps)
python3 -m unittest discover -s lead_gen/tests
```

Artifacts land in `lead_gen/output/`:

- `leads_ranked.csv` — full ranked list (all records).
- `top_100_leads.csv` — top-N highlights.
- `segment_summary.json` — totals + by-tier / by-sector / by-region breakdowns.
- `leads.json` — top-N leads as JSON.
- `lead_report.md` — methodology recap, headline stats, top-leads table, segment breakdowns.

---

## Scoring methodology

`lead_score` is a **0–100 weighted, normalized blend** of seven signals. Each
component is normalized to `[0, 1]`, multiplied by its weight, summed, and scaled
to 100. Weights are named constants in `scoring.py` and **asserted to sum to 1.0**.

| Signal | Weight | Normalization | Why it matters |
|---|---:|---|---|
| Consumption volume | **30%** | log10 of MWh, anchored 50k → 60M MWh | Bigger load = bigger prize |
| Decarbonization gap | **20%** | `(100 − renewable%) / 100` | Headroom to green |
| Grid carbon intensity | **15%** | linear, anchored 50 → 750 gCO₂/kWh | Dirtier grid = more CO₂ to displace |
| Sector fit / tractability | **10%** | per-sector weight | Ease of serving with our offerings |
| ESG / regulatory pressure | **10%** | 0–1 pressure proxy | Compliance / investor push to act |
| Buying window | **10%** | nearer renewal → hotter (≤3 mo ≈ 1.0, ≥36 mo ≈ 0.0) | Timing of the procurement decision |
| Financial capacity | **5%** | blend of scale + sector addressable share | Ability to pay |

**Tiers:** `A` ≥ 70, `B` 50–69, `C` < 50.

**Opportunity value (USD/yr)** =
`consumption × sector addressable share × effective decarbonization gap × value-per-MWh`,
where the effective gap is floored at 0.25 so even green leaders retain residual
opportunity. `value-per-MWh` is a coarse planning figure (`$8/MWh` default).

**Recommended offering** is rule-mapped from sector + profile across:
Corporate PPA, On-site Solar, Battery Storage, Energy Efficiency Retrofit, RECs,
Decarbonization Advisory, EV Fleet Electrification. A short `rationale` string
summarizes the drivers (consumption, gap, grid, buying stage, ESG).

---

## Data model

`schema.Lead` (a `@dataclass`) carries input attributes and scored attributes:

| Field | Type | Notes |
|---|---|---|
| `id` | str | `REAL-####`, `SYN-######`, or `USER-#####` |
| `organization` | str | name (real, or generic templated synthetic) |
| `sector` | str | `Sector` enum value |
| `region` | str | `Region` enum value |
| `country` | str | |
| `annual_consumption_mwh` | float | MWh / year |
| `current_renewable_pct` | float | 0–100 |
| `grid_carbon_intensity_gco2_kwh` | float | gCO₂/kWh |
| `esg_pressure` | float | 0–1 (also exposed as Low/Med/High label) |
| `contract_renewal_months` | float | months until next renewal |
| `data_quality` | str | `public-estimate` / `synthetic` / `user-provided` |
| `lead_score` | float | 0–100 (scored) |
| `tier` | str | A / B / C (scored) |
| `buying_stage` | str | derived from renewal months |
| `estimated_annual_opportunity_value` | float | USD (scored) |
| `recommended_offering` | str | scored |
| `rationale` | str | scored |

Enums: `Sector`, `Region`, `BuyingStage`, `Tier`, `DataQuality`.

---

## Ingesting real prospects (`score`)

Provide a CSV with at least these columns (header row required):

```
organization,sector,region,country,annual_consumption_mwh,current_renewable_pct,grid_carbon_intensity_gco2_kwh,esg_pressure,contract_renewal_months
```

- `sector` / `region` should match the `Sector` / `Region` enum values (e.g.
  `Steel`, `Data Center / Hyperscaler`, `Europe`). Unknown sectors fall back to a
  neutral profile.
- `esg_pressure` is a 0–1 float.
- Optional columns (`id`, `data_quality`, scored fields) are honored if present;
  otherwise `data_quality` defaults to `user-provided` and ids are auto-assigned.

```bash
python3 -m lead_gen.cli score --input my_prospects.csv --output-dir ./out
```

The same scoring model runs, so synthetic and real prospects are directly
comparable.

---

## Package layout

```
lead_gen/
  __init__.py
  schema.py       # Lead dataclass, enums, CSV read/write helpers
  benchmarks.py   # sector/region benchmarks + curated real-consumer seed list
  generator.py    # deterministic curated + synthetic lead generation
  scoring.py      # the scoring model (weights, normalizers, offering map)
  pipeline.py     # load -> score -> rank -> segment
  export.py       # CSV / JSON / segment summary / Markdown report writers
  cli.py          # argparse CLI: generate / score / report
  tests/test_lead_gen.py
  output/         # generated artifacts
```

---

## Extending

- **Add real consumers:** append tuples to `CURATED_REAL_CONSUMERS` in
  `benchmarks.py` (keep figures as honest public estimates).
- **Tune the model:** edit the `W_*` weight constants in `scoring.py` (the
  module-level assert keeps them summing to 1.0) or the normalization anchors.
- **Add a sector/region:** extend the `Sector` / `Region` enums and the matching
  benchmark dicts in `benchmarks.py`.
- **New offerings:** extend `OFFERINGS` and the `recommend_offering` rules.
