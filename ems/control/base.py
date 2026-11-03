"""Shared controller protocol and helpers for battery dispatch.

Sign conventions follow :mod:`ems.models`: ``battery_kw`` is +ve when discharging,
``grid_kw`` is +ve when importing, and ``grid = load + ev - pv - battery``.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol, runtime_checkable

from ems.models import ControlMode, ControllerContext, DispatchCommand, SiteConfig

_EPS = 1e-9

#: Safety margin (fraction of the peak target) kept below the target when charging
#: from the grid, so load noise within an interval does not push import over it.
GRID_CHARGE_MARGIN_FRACTION = 0.03


@runtime_checkable
class Controller(Protocol):
    """A battery dispatch strategy: turns the current context into a command."""

    mode: ControlMode

    def decide(self, ctx: ControllerContext) -> DispatchCommand:
        """Return the dispatch command for the next control interval."""
        ...


def one_way_efficiency(config: SiteConfig) -> float:
    """Charge (= discharge) efficiency, the square root of round-trip efficiency."""
    return math.sqrt(config.battery.round_trip_efficiency)


@dataclass(frozen=True)
class PowerLimits:
    """Feasible battery power envelope for one control interval (both values >= 0).

    ``max_charge_kw`` / ``max_discharge_kw`` combine the inverter rating, the energy
    headroom inside the [min_soc, max_soc] window over the interval, and the grid
    connection limits (import limit when charging, export limit when discharging).
    """

    max_charge_kw: float
    max_discharge_kw: float

    def clamp(self, battery_kw: float) -> float:
        """Clamp a signed setpoint (+discharge / -charge) into the envelope."""
        return min(max(battery_kw, -self.max_charge_kw), self.max_discharge_kw)


def site_net_kw(ctx: ControllerContext) -> float:
    """Measured site net demand before the battery: load + ev - available PV.

    Curtailed PV is added back because it would be available to the battery.
    """
    t = ctx.telemetry
    return t.load_kw + t.ev_kw - (t.pv_kw + t.pv_curtailed_kw)


def forecast_net_kw(ctx: ControllerContext) -> float | None:
    """Forecast site net demand (load + EV - available PV) for the coming interval.

    Returns ``None`` when the context carries no usable forecast.
    """
    fc = ctx.forecast
    if fc is None or not fc.load_kw or not fc.pv_kw:
        return None
    return fc.load_kw[0] - fc.pv_kw[0]


def expected_net_kw(ctx: ControllerContext) -> float:
    """Conservative (higher) estimate of next-interval net demand.

    The larger of the measured net demand of the last interval and the forecast for
    the coming one, so a step up in demand is anticipated rather than seen one
    interval late. Falls back to the measured value without a forecast.
    """
    net = site_net_kw(ctx)
    fc = forecast_net_kw(ctx)
    return net if fc is None else max(net, fc)


def grid_charge_cap_kw(ctx: ControllerContext, target_kw: float | None,
                       margin_fraction: float = GRID_CHARGE_MARGIN_FRACTION) -> float:
    """Largest charge power (>= 0) that keeps expected import below the peak target.

    Uses :func:`expected_net_kw` and keeps ``margin_fraction`` of the target as
    headroom; also respects the grid import limit against that estimate. PV surplus
    (negative expected net demand) can always be absorbed. With no target only the
    import limit applies.
    """
    est = expected_net_kw(ctx)
    cap = max(0.0, ctx.config.grid.import_limit_kw - est)
    if target_kw is not None:
        margin = margin_fraction * max(target_kw, 0.0)
        cap = min(cap, max(0.0, target_kw - margin - est, -est))
    return cap


def power_limits(ctx: ControllerContext, net_kw: float | None = None,
                 respect_grid: bool = True) -> PowerLimits:
    """Compute the battery power envelope for the coming interval of ``ctx.step_seconds``.

    Args:
        ctx: controller context (config, SoC, interval length).
        net_kw: site net demand (load + ev - pv) to check grid limits against;
            defaults to the measured value from ``ctx.telemetry``.
        respect_grid: also keep the resulting grid flow within the import/export limits.
    """
    cfg = ctx.config
    bat = cfg.battery
    if bat.capacity_kwh <= 0:
        return PowerLimits(0.0, 0.0)
    eta = one_way_efficiency(cfg)
    dt_h = max(ctx.step_seconds, 1.0) / 3600.0
    soc = ctx.telemetry.battery_soc
    # Energy headroom inside the SoC window, converted to terminal (AC) power.
    charge_room_kw = max(0.0, (bat.max_soc - soc) * bat.capacity_kwh) / eta / dt_h
    discharge_room_kw = max(0.0, (soc - bat.min_soc) * bat.capacity_kwh) * eta / dt_h
    max_c = min(bat.max_charge_kw, charge_room_kw)
    max_d = min(bat.max_discharge_kw, discharge_room_kw)
    if respect_grid:
        net = site_net_kw(ctx) if net_kw is None else net_kw
        # grid = net + charge  <= import_limit
        max_c = min(max_c, max(0.0, cfg.grid.import_limit_kw - net))
        # grid = net - discharge >= -export_limit
        max_d = min(max_d, max(0.0, net + cfg.grid.export_limit_kw))
    return PowerLimits(max(0.0, max_c), max(0.0, max_d))


def decision_time(ctx: ControllerContext) -> datetime:
    """Start of the interval the command will apply to.

    Uses the forecast start when available; otherwise the end of the latest
    telemetry interval (telemetry timestamps mark the START of their interval).
    """
    if ctx.forecast is not None:
        return ctx.forecast.start
    return ctx.telemetry.timestamp + timedelta(seconds=ctx.step_seconds)


def self_consumption_setpoint(ctx: ControllerContext, net_kw: float | None = None) -> float:
    """Battery setpoint that drives grid flow toward zero (clamped to limits).

    Positive net demand is covered by discharging; PV surplus is absorbed by charging.
    """
    net = site_net_kw(ctx) if net_kw is None else net_kw
    return power_limits(ctx, net).clamp(net)


def describe_kw(value: float) -> str:
    """Format a power value for a reason string."""
    return f"{abs(value):.0f} kW"


def self_consumption_command(ctx: ControllerContext, prefix: str = "") -> DispatchCommand:
    """Build a self-consumption command with a human-readable reason."""
    net = site_net_kw(ctx)
    sp = self_consumption_setpoint(ctx, net)
    lead = f"{prefix}: " if prefix else ""
    if sp < -_EPS:
        reason = f"{lead}charging {describe_kw(sp)} from PV surplus"
    elif sp > _EPS:
        reason = f"{lead}discharging {describe_kw(sp)} to cover site deficit"
    elif net < 0:
        reason = f"{lead}PV surplus but battery full; exporting"
    elif net > 0:
        reason = f"{lead}site deficit but battery at minimum SoC; importing"
    else:
        reason = f"{lead}site balanced; holding"
    return DispatchCommand(battery_kw=sp, reason=reason)
