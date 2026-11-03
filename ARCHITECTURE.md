# Site EMS — Architecture & Module Contracts

A site energy management system for commercial & industrial sites with rooftop PV,
a battery (BESS), EV/fleet charging and a grid connection. v0.1 runs end-to-end on a
built-in deterministic site simulator; hardware adapters are out of scope.

`ems/models.py` is the single source of truth for data types and **sign conventions**
(battery +discharge, grid +import, power balance `grid = load + ev - pv - battery`).
Do not redefine these types elsewhere. If a module needs a helper type, keep it private
to that module.

```
           +-------------------+      DispatchCommand      +-------------------+
           |  ems.control      | <------------------------ |                   |
           |  make_controller  |  ControllerContext ------>|   ems.core        |
           +-------------------+                           |   EMSEngine       |
           +-------------------+   step(cmd, dt)->Telemetry|   (control loop,  |
           |  ems.simulator    | <------------------------>|    history)       |
           |  SiteSimulator    |   forecast()->Forecast    |                   |
           +-------------------+                           +---------+---------+
           +-------------------+   compute_kpis(history)             |
           |  ems.reporting    | <-----------------------------------+
           +-------------------+                                     |
                                                           +---------v---------+
                         browser  <---- HTTP / WebSocket --|  ems.api (FastAPI)|
                     ems/dashboard/static (served by api)  +-------------------+
```

## Module ownership & public interfaces

### `ems/simulator/` — `ems.simulator.SiteSimulator`
```python
class SiteSimulator:
    def __init__(self, config: SiteConfig, start: datetime): ...
    @property
    def now(self) -> datetime: ...          # sim clock (UTC, tz-aware)
    @property
    def soc(self) -> float: ...
    def step(self, command: DispatchCommand, dt_seconds: float, mode: ControlMode) -> Telemetry: ...
    def forecast(self, horizon_hours: float = 24, step_minutes: int = 15) -> Forecast: ...
```
- `step` advances the clock by `dt_seconds`, and returns the Telemetry **averaged over that
  interval** with `timestamp` = START of the interval. (So `now` after the call = timestamp + dt.)
- Physics: PV from clear-sky irradiance by latitude/day-of-year × deterministic cloud factor;
  load profile by `LoadConfig.profile` with weekday/weekend shape; EV sessions arrive in a
  seeded pattern (fleet: mostly overnight/early-morning arrivals). All deterministic given `seed`.
- Battery: clamp setpoint to power limits and to energy available within [min_soc, max_soc]
  over `dt`; charge efficiency = discharge efficiency = sqrt(round_trip_efficiency).
- EV: deliver min(demand, ev_kw_limit if set).
- Grid: if import would exceed `import_limit_kw`, reduce EV first, then (if still over) reduce
  battery charging; report what actually happened. If export would exceed `export_limit_kw`,
  curtail PV (`pv_curtailed_kw`). Power balance must hold exactly.
- `forecast` returns the next `horizon_hours` of PV, load (+expected EV) and prices, with
  seeded noise that grows with lead time (forecast ≠ truth). Must NOT advance the clock or
  disturb the RNG stream used by `step` (use a separate RNG).

### `ems/control/` — `ems.control.make_controller`
```python
class Controller(Protocol):
    mode: ControlMode
    def decide(self, ctx: ControllerContext) -> DispatchCommand: ...

def make_controller(mode: ControlMode, config: SiteConfig) -> Controller: ...
```
- IDLE: battery 0.
- SELF_CONSUMPTION: net = load+ev-pv from latest telemetry; charge on surplus, discharge on deficit.
- PEAK_SHAVING: discharge to keep grid import ≤ `peak_target_kw`; recharge below target, preferring PV surplus/cheap hours.
  In the dearest tariff band, energy above a shaving reserve (half the usable SoC window) covers site demand.
- TOU_ARBITRAGE: charge at max in the cheapest band (target max_soc), discharge in the dearest band; self-consume otherwise.
- OPTIMISED: model-predictive control. Each call solves a cost-minimising schedule over the forecast
  horizon (dynamic programming over a discretised SoC grid, numpy only) with objective
  import cost − export revenue + penalty on import above `peak_target_kw` + small degradation cost
  (£0.02/kWh throughput), and returns the first interval's setpoint. Must run in < 200 ms for a
  24 h / 15 min horizon. Falls back to SELF_CONSUMPTION if `ctx.forecast` is None.
- Controllers command; the simulator enforces physics. Controllers should still respect SoC
  limits sensibly so commands are realistic. `reason` must explain the decision in a short phrase.

### `ems/reporting/` — `ems.reporting.compute_kpis`
```python
def compute_kpis(history: list[Telemetry], config: SiteConfig, step_seconds: float) -> KPIs: ...
```
- Energy = power × step_seconds/3600 per sample. Import = positive grid; export = negative grid.
- Baseline (no battery): `baseline_grid = load + ev - (pv + pv_curtailed)`, with export capped at
  `export_limit_kw` (excess curtailed). Price with each sample's prices.
- Cost = Σ import×price − Σ export×export_price + demand_charge × peak_import_kw × (hours / 730)
  + standing_charge × (hours / 24). Baseline uses identical formula with baseline grid.
- CO2 = import_kwh × carbon_kg_per_kwh.
- Empty history → raise ValueError.

### `ems/core/` — `ems.core.EMSEngine`
```python
class EMSEngine:
    def __init__(self, config: SiteConfig, start: datetime | None = None,
                 mode: ControlMode = ControlMode.OPTIMISED, step_seconds: float = 300,
                 history_limit: int = 288 * 30): ...
    config: SiteConfig; mode: ControlMode; step_seconds: float; sim_speed: float
    def set_mode(self, mode: ControlMode) -> None
    def step(self) -> Telemetry                  # forecast -> decide -> simulate -> record
    def run(self, steps: int) -> list[Telemetry]
    def history(self, limit: int | None = None) -> list[Telemetry]
    def kpis(self, last_hours: float | None = None) -> KPIs
    def status(self) -> EngineStatus
    def subscribe(self) -> asyncio.Queue[Telemetry]; def unsubscribe(q) -> None
    async def run_forever(self) -> None          # steps every step_seconds / sim_speed real seconds
    def start(self) / async stop(self)           # manage the background task
    def reset(self, config: SiteConfig | None = None) -> None
```
Default start = 2026-06-01T00:00Z (deterministic). Before the first step the engine
bootstraps the controller with `SiteSimulator.observe(step_seconds, mode)`: a meter reading
of the preceding interval with the battery idle, timestamped `now - step_seconds`. Also `ems/__main__.py` CLI:
- `python -m ems serve [--host 0.0.0.0 --port 8000 --site demo-warehouse --speed 300]`
- `python -m ems simulate --site demo-warehouse --days 7 --mode optimised` → prints KPI table
  comparing every ControlMode on the same site (each run with a fresh engine).

### `ems/api/` — `ems.api.create_app`
```python
def create_app(engine: EMSEngine | None = None, autostart: bool = True,
               websocket: bool | None = None) -> FastAPI
```
`websocket` is reported by `/api/health` (auto-detected when `None`: true if uvicorn has a
WebSocket backend, i.e. `websockets` or `wsproto`, installed via the optional `[live]` extra).
The dashboard polls `/api/status` + `/api/history` instead of opening the socket when it is false.
JSON endpoints (all under `/api`), payloads are the models' JSON:
| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/health` | | `{"status":"ok","websocket":true}` |
| GET | `/api/status` | | `EngineStatus` |
| GET | `/api/config` | | `SiteConfig` |
| GET | `/api/presets` | | `list[str]` |
| POST | `/api/reset` | `{"preset": "demo-office"}` (optional) | `EngineStatus` |
| GET | `/api/history` | `?limit=288` | `list[Telemetry]` |
| GET | `/api/kpis` | `?hours=24` (optional) | `KPIs` (409 if no history yet) |
| GET | `/api/forecast` | `?hours=24` | `Forecast` |
| POST | `/api/mode` | `{"mode": "peak_shaving"}` | `EngineStatus` (422 on bad mode) |
| POST | `/api/sim` | `{"speed": 600, "running": true}` (both optional, speed 1..86400) | `EngineStatus` |
| POST | `/api/step` | `{"steps": 12}` (1..2016) | `EngineStatus` |
| WS | `/ws/telemetry` | | pushes `{"type":"telemetry","data":Telemetry}` each step |
`GET /` serves `ems/dashboard/static/index.html`; `/static/*` serves that directory.

### `ems/dashboard/static/` — `index.html`, `app.js`, `styles.css`
Vanilla JS, no build step, Chart.js 4.4.1 from cdnjs (exact version pinned). Shows: live
power-flow tiles (PV, load, EV, battery+SoC, grid), mode selector, sim speed/run controls,
24 h power chart (unstacked lines, since battery and grid are signed) + SoC line, tariff price band, KPI panel (cost vs baseline, savings,
self-sufficiency, peak import vs baseline, CO2), last decision reason. Light/dark via
`prefers-color-scheme`. Works at phone width. Uses only the endpoints above.

## Testing
`pytest` from the repo root. Each module owns `tests/test_<module>.py`. Invariants every
test suite must respect: power balance per sample, SoC within [min_soc, max_soc], determinism
(same seed → same output), and controller savings ordering on the demo site (OPTIMISED ≥ IDLE).
