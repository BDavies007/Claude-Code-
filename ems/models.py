"""Shared data contracts for the EMS. Every module builds against these types.

SIGN CONVENTIONS (binding for all modules):
  pv_kw            >= 0   PV generation actually delivered (after curtailment)
  pv_curtailed_kw  >= 0   PV that was available but curtailed
  load_kw          >= 0   site building load (excluding EV charging)
  ev_kw            >= 0   EV charging power actually delivered
  battery_kw       +ve = DISCHARGING (battery -> site), -ve = CHARGING (site -> battery)
  grid_kw          +ve = IMPORT from grid, -ve = EXPORT to grid

POWER BALANCE (must hold for every Telemetry sample, to within 1e-6 kW):
  grid_kw = load_kw + ev_kw - pv_kw - battery_kw

All timestamps are timezone-aware UTC datetimes. Tariff bands use the site's
local hour (SiteConfig.timezone), resolved via Tariff.import_price_at().
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, model_validator

POWER_BALANCE_TOLERANCE_KW = 1e-6


class ControlMode(str, Enum):
    IDLE = "idle"                          # battery does nothing; baseline behaviour
    SELF_CONSUMPTION = "self_consumption"  # charge from PV surplus, discharge to cover deficit
    PEAK_SHAVING = "peak_shaving"          # hold grid import under peak_target_kw
    TOU_ARBITRAGE = "tou_arbitrage"        # charge in cheapest band, discharge in dearest
    OPTIMISED = "optimised"                # forecast-driven cost-minimising MPC


# ---------------------------------------------------------------- configuration

class TariffBand(BaseModel):
    name: str
    start_hour: int = Field(ge=0, le=23)   # inclusive, local time
    end_hour: int = Field(ge=1, le=24)     # exclusive, local time; start < end (no wrap)
    import_price_gbp_per_kwh: float = Field(ge=0)

    @model_validator(mode="after")
    def _check(self) -> "TariffBand":
        if self.start_hour >= self.end_hour:
            raise ValueError("start_hour must be < end_hour (split wrapping bands in two)")
        return self


class Tariff(BaseModel):
    bands: list[TariffBand]                 # must cover hours 0..24 exactly once
    export_price_gbp_per_kwh: float = Field(ge=0)
    demand_charge_gbp_per_kw_month: float = Field(default=0.0, ge=0)  # on peak import kW
    standing_charge_gbp_per_day: float = Field(default=0.0, ge=0)
    carbon_kg_per_kwh: float = Field(default=0.207, ge=0)  # grid import intensity

    @model_validator(mode="after")
    def _cover(self) -> "Tariff":
        hours = [0] * 24
        for b in self.bands:
            for h in range(b.start_hour, b.end_hour):
                hours[h] += 1
        if any(c != 1 for c in hours):
            raise ValueError("tariff bands must cover every hour 0-23 exactly once")
        return self

    def band_at(self, ts: datetime, timezone: str) -> TariffBand:
        hour = ts.astimezone(ZoneInfo(timezone)).hour
        for b in self.bands:
            if b.start_hour <= hour < b.end_hour:
                return b
        raise AssertionError("unreachable: bands validated to cover all hours")

    def import_price_at(self, ts: datetime, timezone: str) -> float:
        return self.band_at(ts, timezone).import_price_gbp_per_kwh


class PVConfig(BaseModel):
    capacity_kwp: float = Field(ge=0)
    performance_ratio: float = Field(default=0.85, gt=0, le=1)


class BatteryConfig(BaseModel):
    capacity_kwh: float = Field(ge=0)
    max_charge_kw: float = Field(ge=0)
    max_discharge_kw: float = Field(ge=0)
    round_trip_efficiency: float = Field(default=0.90, gt=0, le=1)  # split sqrt each way
    min_soc: float = Field(default=0.10, ge=0, le=1)
    max_soc: float = Field(default=0.95, ge=0, le=1)
    initial_soc: float = Field(default=0.50, ge=0, le=1)


class LoadConfig(BaseModel):
    profile: Literal["warehouse", "office", "retail"] = "warehouse"
    base_load_kw: float = Field(ge=0)   # overnight / minimum load
    peak_load_kw: float = Field(ge=0)   # typical weekday daytime maximum


class EVConfig(BaseModel):
    num_chargers: int = Field(default=0, ge=0)
    charger_kw: float = Field(default=22.0, ge=0)
    sessions_per_day: int = Field(default=0, ge=0)
    kwh_per_session: float = Field(default=40.0, ge=0)


class GridConfig(BaseModel):
    import_limit_kw: float = Field(gt=0)   # agreed supply capacity
    export_limit_kw: float = Field(ge=0)   # export cap; excess PV is curtailed


class SiteConfig(BaseModel):
    site_id: str
    name: str
    timezone: str = "Europe/London"
    latitude: float = 52.5
    pv: PVConfig
    battery: BatteryConfig
    load: LoadConfig
    ev: EVConfig = EVConfig()
    grid: GridConfig
    tariff: Tariff
    peak_target_kw: float | None = None    # used by PEAK_SHAVING (and as a soft cap by OPTIMISED)
    seed: int = 42                          # simulator determinism


# ---------------------------------------------------------------- runtime data

class Telemetry(BaseModel):
    timestamp: datetime
    pv_kw: float
    pv_curtailed_kw: float = 0.0
    load_kw: float
    ev_kw: float
    battery_kw: float
    battery_soc: float           # 0..1
    grid_kw: float
    import_price_gbp_per_kwh: float
    export_price_gbp_per_kwh: float
    mode: ControlMode

    def balance_error_kw(self) -> float:
        return self.grid_kw - (self.load_kw + self.ev_kw - self.pv_kw - self.battery_kw)


class DispatchCommand(BaseModel):
    battery_kw: float = 0.0              # requested setpoint, sign as Telemetry.battery_kw
    ev_kw_limit: float | None = None     # cap on total EV charging; None = unconstrained
    reason: str = ""                     # human-readable rationale, shown on dashboard


class Forecast(BaseModel):
    start: datetime                      # timestamp of first interval
    step_minutes: int
    pv_kw: list[float]                   # available PV (pre-curtailment)
    load_kw: list[float]                 # building load + expected EV demand
    import_price: list[float]            # GBP/kWh
    export_price: list[float]            # GBP/kWh


class ControllerContext(BaseModel):
    telemetry: Telemetry                 # latest measured state
    forecast: Forecast | None
    config: SiteConfig
    step_seconds: float                  # control interval length


class KPIs(BaseModel):
    period_start: datetime
    period_end: datetime
    hours: float
    energy_import_kwh: float
    energy_export_kwh: float
    pv_generation_kwh: float
    pv_curtailed_kwh: float
    load_kwh: float                      # building + EV
    self_consumption_pct: float          # share of PV used on site (incl. into battery)
    self_sufficiency_pct: float          # share of site demand not met from grid
    peak_import_kw: float
    baseline_peak_import_kw: float
    cost_gbp: float                      # energy + export credit + prorated demand + standing
    baseline_cost_gbp: float             # same site, same PV, no battery (IDLE)
    savings_gbp: float                   # baseline_cost_gbp - cost_gbp
    co2_kg: float
    baseline_co2_kg: float
    battery_throughput_kwh: float        # total discharged energy
    battery_equivalent_cycles: float     # throughput / capacity


class EngineStatus(BaseModel):
    site_id: str
    site_name: str
    mode: ControlMode
    sim_time: datetime
    sim_speed: float                     # sim-seconds per real second
    running: bool
    step_seconds: float
    latest: Telemetry | None
    last_command: DispatchCommand | None
