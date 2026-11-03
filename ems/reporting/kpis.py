"""KPI computation over a telemetry history.

All energy figures are derived from per-sample average power multiplied by the
sample length (``step_seconds / 3600`` hours). Sign conventions follow
:mod:`ems.models`: ``grid_kw`` +import / -export, ``battery_kw`` +discharge.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import timedelta
from typing import Sequence

import numpy as np

from ems.models import KPIs, SiteConfig, Telemetry

HOURS_PER_MONTH = 730.0
"""Hours per billing month used to prorate the demand charge."""

HOURS_PER_DAY = 24.0


def _pct(numerator: float, denominator: float) -> float:
    """Return ``numerator / denominator * 100`` clamped to [0, 100]; 0 if denominator <= 0."""
    if denominator <= 1e-12:
        return 0.0
    return float(min(100.0, max(0.0, numerator / denominator * 100.0)))


def _cost(import_kw: np.ndarray, export_kw: np.ndarray, import_price: np.ndarray,
          export_price: np.ndarray, h: float, hours: float, config: SiteConfig) -> float:
    """Total cost for a grid trace: energy - export credit + prorated demand + standing."""
    tariff = config.tariff
    energy = float(np.sum(import_kw * import_price) * h)
    credit = float(np.sum(export_kw * export_price) * h)
    peak = float(np.max(import_kw)) if import_kw.size else 0.0
    demand = tariff.demand_charge_gbp_per_kw_month * peak * (hours / HOURS_PER_MONTH)
    standing = tariff.standing_charge_gbp_per_day * (hours / HOURS_PER_DAY)
    return energy - credit + demand + standing


@dataclass(frozen=True)
class BatteryInventory:
    """Change in energy stored in the battery over a telemetry history.

    Attributes:
        stored_delta_kwh: stored (DC-side) energy at the end minus at the start of
            the period; +ve when the battery ends fuller than it started.
        reference_price_gbp_per_kwh: price per stored kWh used to value the change
            (cheapest import price times the one-way discharge efficiency).
        value_gbp: ``stored_delta_kwh * reference_price_gbp_per_kwh``.
    """

    stored_delta_kwh: float
    reference_price_gbp_per_kwh: float
    value_gbp: float


def battery_inventory(history: Sequence[Telemetry], config: SiteConfig,
                      step_seconds: float) -> BatteryInventory:
    """Value the change in stored battery energy between the start and end of ``history``.

    The change is integrated from the battery power trace with the simulator's
    efficiency model (charging stores ``kW * eta``, discharging draws ``kW / eta``,
    ``eta = sqrt(round_trip_efficiency)``), so it does not depend on the SoC before
    the first sample being recorded. Stored energy is valued at the cheapest import
    price times ``eta``: what it would cost to put it back in the cheapest band,
    expressed as AC energy it can deliver. This matches the optimiser's terminal value.

    Args:
        history: telemetry samples of ``step_seconds`` each.
        config: site configuration (tariff, battery efficiency and capacity).
        step_seconds: length of each sample interval in seconds.
    """
    if config.battery.capacity_kwh <= 0 or not history:
        return BatteryInventory(0.0, 0.0, 0.0)
    h = step_seconds / 3600.0
    eta = math.sqrt(config.battery.round_trip_efficiency)
    battery = np.array([t.battery_kw for t in history], dtype=float)
    stored = np.where(battery > 0, -battery / eta, -battery * eta) * h
    delta = float(np.sum(stored))
    price = min(b.import_price_gbp_per_kwh for b in config.tariff.bands) * eta
    return BatteryInventory(delta, price, delta * price)


def compute_kpis(history: Sequence[Telemetry], config: SiteConfig, step_seconds: float) -> KPIs:
    """Compute site KPIs, including a no-battery baseline, over a telemetry history.

    Args:
        history: Telemetry samples, each the average over one interval of
            ``step_seconds`` starting at its ``timestamp``.
        config: Site configuration (tariff, export limit, battery capacity).
        step_seconds: Length of each sample interval in seconds.

    Returns:
        The aggregated :class:`~ems.models.KPIs`.

    Raises:
        ValueError: If ``history`` is empty or ``step_seconds`` is not positive.

    Notes:
        * The baseline assumes the same PV (delivered + curtailed), load and EV,
          with no battery: ``baseline_grid = load + ev - (pv + pv_curtailed)``,
          with export capped at ``config.grid.export_limit_kw``.
        * ``self_consumption_pct`` uses on-site PV = ``max(pv - export, 0)`` per
          sample (energy into the battery counts as used on site).
        * ``self_sufficiency_pct`` = ``(1 - import / (load + ev)) * 100``,
          clamped to [0, 100] (grid-charging a battery can push import above demand).
        * Percentages are 0 when their denominator is 0.
        * ``savings_gbp`` = ``baseline_cost_gbp - cost_gbp`` plus the value of the
          change in stored battery energy over the period (see
          :func:`battery_inventory`). Without it a run that ends with a fuller
          battery is charged for energy it still holds, and one that drains the
          battery is credited with energy bought before the period. ``cost_gbp``
          remains the plain bill.
    """
    if not history:
        raise ValueError("cannot compute KPIs from an empty history")
    if not step_seconds > 0:
        raise ValueError(f"step_seconds must be positive, got {step_seconds!r}")

    h = step_seconds / 3600.0
    n = len(history)
    hours = n * h

    pv = np.array([t.pv_kw for t in history], dtype=float)
    curtailed = np.array([t.pv_curtailed_kw for t in history], dtype=float)
    demand = np.array([t.load_kw + t.ev_kw for t in history], dtype=float)
    battery = np.array([t.battery_kw for t in history], dtype=float)
    grid = np.array([t.grid_kw for t in history], dtype=float)
    import_price = np.array([t.import_price_gbp_per_kwh for t in history], dtype=float)
    export_price = np.array([t.export_price_gbp_per_kwh for t in history], dtype=float)

    imp = np.clip(grid, 0.0, None)
    exp = np.clip(-grid, 0.0, None)

    base_grid = demand - (pv + curtailed)
    base_grid = np.maximum(base_grid, -config.grid.export_limit_kw)
    base_imp = np.clip(base_grid, 0.0, None)
    base_exp = np.clip(-base_grid, 0.0, None)

    import_kwh = float(np.sum(imp) * h)
    export_kwh = float(np.sum(exp) * h)
    pv_kwh = float(np.sum(pv) * h)
    curtailed_kwh = float(np.sum(curtailed) * h)
    demand_kwh = float(np.sum(demand) * h)
    pv_used_kwh = float(np.sum(np.clip(pv - exp, 0.0, None)) * h)
    base_import_kwh = float(np.sum(base_imp) * h)

    cost = _cost(imp, exp, import_price, export_price, h, hours, config)
    baseline_cost = _cost(base_imp, base_exp, import_price, export_price, h, hours, config)

    throughput = float(np.sum(np.clip(battery, 0.0, None)) * h)
    capacity = config.battery.capacity_kwh
    cycles = throughput / capacity if capacity > 0 else 0.0

    carbon = config.tariff.carbon_kg_per_kwh
    timestamps = [t.timestamp for t in history]

    return KPIs(
        period_start=min(timestamps),
        period_end=max(timestamps) + timedelta(seconds=step_seconds),
        hours=hours,
        energy_import_kwh=import_kwh,
        energy_export_kwh=export_kwh,
        pv_generation_kwh=pv_kwh,
        pv_curtailed_kwh=curtailed_kwh,
        load_kwh=demand_kwh,
        self_consumption_pct=_pct(pv_used_kwh, pv_kwh),
        self_sufficiency_pct=(_pct(demand_kwh - import_kwh, demand_kwh)),
        peak_import_kw=float(np.max(imp)),
        baseline_peak_import_kw=float(np.max(base_imp)),
        cost_gbp=cost,
        baseline_cost_gbp=baseline_cost,
        savings_gbp=baseline_cost - cost + battery_inventory(history, config, step_seconds).value_gbp,
        co2_kg=import_kwh * carbon,
        baseline_co2_kg=base_import_kwh * carbon,
        battery_throughput_kwh=throughput,
        battery_equivalent_cycles=cycles,
    )
