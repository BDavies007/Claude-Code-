"""OPTIMISED mode: model-predictive control via dynamic programming over SoC.

Each call solves a cost-minimising battery schedule over the forecast horizon and
applies the first interval's setpoint (receding horizon). The state is the stored
energy discretised onto an evenly spaced grid across [min_soc, max_soc]; every
transition between grid levels is a candidate battery action, constrained by the
inverter power limits. Stage cost per interval (GBP):

    import_kwh * import_price - export_kwh * export_price
    + PEAK_PENALTY * max(import_kw - peak_target_kw, 0) * dt_h
    + IMPORT_LIMIT_PENALTY * max(import_kw - import_limit_kw, 0) * dt_h
    + DEGRADATION * |battery_kw| * dt_h

Export beyond ``export_limit_kw`` is curtailed (earns nothing). Stored energy left
at the end of the horizon is valued at the cheapest import price times the
discharge efficiency, so the plan neither dumps the battery nor hoards it.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from ems.models import ControlMode, ControllerContext, DispatchCommand, Forecast, SiteConfig

from .base import _EPS, describe_kw, one_way_efficiency, power_limits, self_consumption_command, site_net_kw
from .rules import peak_target_kw

#: Penalty on import above the peak target, GBP per kW per hour above target.
PEAK_PENALTY_GBP_PER_KWH = 0.50
#: Penalty on import above the supply capacity, GBP per kWh (effectively a hard limit).
IMPORT_LIMIT_PENALTY_GBP_PER_KWH = 5.0
#: Battery degradation cost per kWh of AC throughput (charge and discharge).
DEGRADATION_GBP_PER_KWH = 0.02
#: Default number of SoC levels in the DP grid.
DEFAULT_SOC_LEVELS = 81

FloatArray = NDArray[np.float64]


@dataclass(frozen=True)
class Plan:
    """Result of one DP solve.

    Attributes:
        battery_kw: planned battery power per forecast interval (+discharge).
        grid_kw: planned grid flow per interval (+import), after export curtailment.
        soc: planned SoC at the start of each interval plus the final SoC (len N+1).
        cost_gbp: optimal objective value from the current state.
        step_kw: power resolution implied by the SoC grid (charge side, kW).
    """

    battery_kw: FloatArray
    grid_kw: FloatArray
    soc: FloatArray
    cost_gbp: float
    step_kw: float


def solve_schedule(config: SiteConfig, forecast: Forecast, soc: float,
                   levels: int = DEFAULT_SOC_LEVELS) -> Plan:
    """Solve the battery schedule over ``forecast`` from initial ``soc``.

    Args:
        config: site configuration (battery, grid limits, peak target).
        forecast: per-interval PV, load (incl. EV) and prices; ``step_minutes`` sets dt.
        soc: current state of charge (0..1); may lie outside the SoC window.
        levels: number of discretised SoC levels (>= 2).

    Returns:
        The optimal :class:`Plan`.

    Raises:
        ValueError: if the forecast is empty or ``levels`` < 2.
    """
    n = min(len(forecast.pv_kw), len(forecast.load_kw),
            len(forecast.import_price), len(forecast.export_price))
    if n == 0:
        raise ValueError("forecast has no intervals")
    if levels < 2:
        raise ValueError("levels must be >= 2")
    bat, grid = config.battery, config.grid
    dt_h = forecast.step_minutes / 60.0
    eta = one_way_efficiency(config)

    net = np.asarray(forecast.load_kw[:n], float) - np.asarray(forecast.pv_kw[:n], float)
    p_imp = np.asarray(forecast.import_price[:n], float)
    p_exp = np.asarray(forecast.export_price[:n], float)

    e_min, e_max = bat.min_soc * bat.capacity_kwh, bat.max_soc * bat.capacity_kwh
    e_max = max(e_max, e_min)
    energy = np.linspace(e_min, e_max, levels)               # (K,) stored kWh
    step_kw = (energy[1] - energy[0]) / eta / dt_h

    def battery_power(delta: FloatArray) -> FloatArray:
        """Terminal power (+discharge) that changes stored energy by ``delta`` over dt."""
        return np.where(delta > 0, -delta / eta, -delta * eta) / dt_h

    def feasible(b: FloatArray) -> NDArray[np.bool_]:
        return (b <= bat.max_discharge_kw + 1e-6) & (-b <= bat.max_charge_kw + 1e-6)

    target = peak_target_kw(config) if config.peak_target_kw is not None else None

    def stage_cost(b: FloatArray, net_t: FloatArray, pi: FloatArray, pe: FloatArray) -> FloatArray:
        """Stage cost (GBP); ``b`` broadcasts against per-interval arrays."""
        g = np.maximum(net_t - b, -grid.export_limit_kw)     # curtail export over limit
        imp = np.maximum(g, 0.0)
        exp_ = np.maximum(-g, 0.0)
        c = imp * pi - exp_ * pe
        c = c + IMPORT_LIMIT_PENALTY_GBP_PER_KWH * np.maximum(imp - grid.import_limit_kw, 0.0)
        if target is not None:
            c = c + PEAK_PENALTY_GBP_PER_KWH * np.maximum(imp - target, 0.0)
        c = c + DEGRADATION_GBP_PER_KWH * np.abs(b)
        return c * dt_h

    # Transition (i -> j) battery power, shared by every interval.
    b_mat = battery_power(energy[None, :] - energy[:, None])            # (K, K)
    infeasible = ~feasible(b_mat)
    costs = stage_cost(b_mat[None, :, :], net[:, None, None],
                       p_imp[:, None, None], p_exp[:, None, None])       # (N, K, K)
    costs[:, infeasible] = np.inf

    terminal_price = float(p_imp.min()) * eta
    value = -(energy - e_min) * terminal_price                           # V_N
    policy = np.empty((n, levels), dtype=np.intp)
    values = np.empty((n + 1, levels))
    values[n] = value
    for t in range(n - 1, -1, -1):
        total = costs[t] + value[None, :]
        policy[t] = np.argmin(total, axis=1)
        value = total[np.arange(levels), policy[t]]
        values[t] = value

    # First step from the exact (possibly off-grid) current state.
    e0 = float(soc) * bat.capacity_kwh
    cand_e = np.append(energy, e0)                                       # last = hold
    cand_v = np.append(values[1], np.interp(e0, energy, values[1]))
    b0 = battery_power(cand_e - e0)
    c0 = stage_cost(b0, net[0], p_imp[0], p_exp[0]) + cand_v
    c0[~feasible(b0)] = np.inf
    c0[-1] = stage_cost(np.zeros(1), net[0], p_imp[0], p_exp[0])[0] + cand_v[-1]
    k0 = int(np.argmin(c0))

    # Roll the policy forward to report the whole plan.
    b_plan = np.empty(n)
    e_plan = np.empty(n + 1)
    e_plan[0] = e0
    b_plan[0] = b0[k0]
    if k0 < levels:
        idx = k0
    else:  # held off-grid: continue from the nearest grid level
        idx = int(np.argmin(np.abs(energy - e0)))
    e_plan[1] = cand_e[k0]
    for t in range(1, n):
        nxt = int(policy[t, idx])
        b_plan[t] = b_mat[idx, nxt]
        e_plan[t + 1] = energy[nxt]
        idx = nxt
    g_plan = np.maximum(net - b_plan, -grid.export_limit_kw)
    cap = bat.capacity_kwh if bat.capacity_kwh > 0 else 1.0
    return Plan(battery_kw=b_plan, grid_kw=g_plan, soc=e_plan / cap,
                cost_gbp=float(c0[k0]), step_kw=float(step_kw))


class OptimisedController:
    """Forecast-driven MPC; falls back to self-consumption without a forecast.

    The DP plan fixes the intent for the coming interval. When the plan is to hold
    the grid at zero (self-consume) or at the peak target (shave), the setpoint
    tracks the *measured* net demand so forecast error and SoC-grid quantisation do
    not leak to the grid; otherwise the planned power is applied directly.
    """

    mode = ControlMode.OPTIMISED

    def __init__(self, config: SiteConfig, levels: int = DEFAULT_SOC_LEVELS) -> None:
        self.config = config
        self.levels = levels
        self.last_plan: Plan | None = None

    def decide(self, ctx: ControllerContext) -> DispatchCommand:
        """Solve over ``ctx.forecast`` and return the first-interval setpoint (kW)."""
        cfg = ctx.config
        fc = ctx.forecast
        if fc is None or not fc.load_kw or not fc.pv_kw or cfg.battery.capacity_kwh <= 0:
            self.last_plan = None
            return self_consumption_command(ctx, prefix="optimised (no forecast) self-consumption")
        plan = solve_schedule(cfg, fc, ctx.telemetry.battery_soc, self.levels)
        self.last_plan = plan

        net_meas = site_net_kw(ctx)
        lim = power_limits(ctx, net_meas)
        planned_b = float(plan.battery_kw[0])
        planned_g = float(plan.grid_kw[0])
        tol = plan.step_kw + _EPS
        target = cfg.peak_target_kw

        if abs(planned_b) <= _EPS:
            return DispatchCommand(battery_kw=0.0,
                                   reason=f"optimised: holding; plan imports {planned_g:.0f} kW")
        if abs(planned_g) <= tol:
            sp = lim.clamp(net_meas)
            verb = "charging" if sp < 0 else "discharging"
            return DispatchCommand(battery_kw=sp,
                                   reason=f"optimised: self-consuming, {verb} {describe_kw(sp)}")
        if target is not None and planned_b > 0 and abs(planned_g - target) <= tol and net_meas > target:
            sp = lim.clamp(net_meas - target)
            return DispatchCommand(battery_kw=sp,
                                   reason=f"optimised: shaving import to {target:.0f} kW, "
                                          f"discharging {describe_kw(sp)}")
        sp = lim.clamp(planned_b)
        if sp < 0:
            price = fc.import_price[0]
            reason = f"optimised: charging {describe_kw(sp)} at £{price:.2f}/kWh ahead of dearer periods"
        else:
            reason = f"optimised: discharging {describe_kw(sp)} to offset £{fc.import_price[0]:.2f}/kWh import"
        return DispatchCommand(battery_kw=sp, reason=reason)
