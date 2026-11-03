"""Tests for ems.control: rule-based modes, the DP optimiser and a savings check."""
from __future__ import annotations

import math
import time
from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

from ems.control import (Controller, OptimisedController, make_controller, power_limits,
                         solve_schedule)
from ems.control.base import GRID_CHARGE_MARGIN_FRACTION
from ems.models import ControlMode, ControllerContext, DispatchCommand, Forecast, SiteConfig, Telemetry
from ems.presets import demo_warehouse

UTC = timezone.utc
DAY0 = datetime(2026, 6, 1, tzinfo=UTC)          # Europe/London is UTC+1 in June


def cfg_() -> SiteConfig:
    return demo_warehouse()


def telem(cfg: SiteConfig, ts: datetime, *, pv: float = 0.0, load: float = 100.0, ev: float = 0.0,
          soc: float = 0.5, curtailed: float = 0.0) -> Telemetry:
    price = cfg.tariff.import_price_at(ts, cfg.timezone)
    return Telemetry(timestamp=ts, pv_kw=pv, pv_curtailed_kw=curtailed, load_kw=load, ev_kw=ev,
                     battery_kw=0.0, battery_soc=soc, grid_kw=load + ev - pv, mode=ControlMode.IDLE,
                     import_price_gbp_per_kwh=price,
                     export_price_gbp_per_kwh=cfg.tariff.export_price_gbp_per_kwh)


def ctx_(cfg: SiteConfig, t: Telemetry, forecast: Forecast | None = None,
         step_seconds: float = 300) -> ControllerContext:
    return ControllerContext(telemetry=t, forecast=forecast, config=cfg, step_seconds=step_seconds)


def make_forecast(cfg: SiteConfig, start: datetime, pv, load, step_minutes: int = 15) -> Forecast:
    n = len(load)
    times = [start + timedelta(minutes=step_minutes * i) for i in range(n)]
    return Forecast(start=start, step_minutes=step_minutes, pv_kw=[float(x) for x in pv],
                    load_kw=[float(x) for x in load],
                    import_price=[cfg.tariff.import_price_at(t, cfg.timezone) for t in times],
                    export_price=[cfg.tariff.export_price_gbp_per_kwh] * n)


# ------------------------------------------------------------------ factory / protocol

@pytest.mark.parametrize("mode", list(ControlMode))
def test_make_controller_all_modes(mode: ControlMode) -> None:
    c = make_controller(mode, cfg_())
    assert isinstance(c, Controller)
    assert c.mode is mode
    cmd = c.decide(ctx_(cfg_(), telem(cfg_(), DAY0 + timedelta(hours=11), pv=50, load=150)))
    assert isinstance(cmd, DispatchCommand) and cmd.reason


def test_make_controller_accepts_string_and_rejects_unknown() -> None:
    assert make_controller("peak_shaving", cfg_()).mode is ControlMode.PEAK_SHAVING
    with pytest.raises(ValueError):
        make_controller("bogus", cfg_())


# ------------------------------------------------------------------ rule-based modes

def test_idle_is_zero() -> None:
    cfg = cfg_()
    cmd = make_controller(ControlMode.IDLE, cfg).decide(ctx_(cfg, telem(cfg, DAY0, pv=400, load=50)))
    assert cmd.battery_kw == 0.0


def test_self_consumption_charges_on_surplus_and_discharges_on_deficit() -> None:
    cfg = cfg_()
    c = make_controller(ControlMode.SELF_CONSUMPTION, cfg)
    ts = DAY0 + timedelta(hours=12)
    surplus = c.decide(ctx_(cfg, telem(cfg, ts, pv=300, load=120, ev=30)))
    assert surplus.battery_kw == pytest.approx(-150.0)
    deficit = c.decide(ctx_(cfg, telem(cfg, ts, pv=20, load=120, ev=10)))
    assert deficit.battery_kw == pytest.approx(110.0)
    # curtailed PV counts as available surplus
    curt = c.decide(ctx_(cfg, telem(cfg, ts, pv=200, curtailed=50, load=100)))
    assert curt.battery_kw == pytest.approx(-150.0)


def test_self_consumption_respects_soc_window() -> None:
    cfg = cfg_()
    c = make_controller(ControlMode.SELF_CONSUMPTION, cfg)
    ts = DAY0 + timedelta(hours=12)
    full = c.decide(ctx_(cfg, telem(cfg, ts, pv=300, load=100, soc=cfg.battery.max_soc)))
    assert full.battery_kw == pytest.approx(0.0)
    empty = c.decide(ctx_(cfg, telem(cfg, ts, pv=0, load=100, soc=cfg.battery.min_soc)))
    assert empty.battery_kw == pytest.approx(0.0)
    # nearly empty: discharge limited by remaining energy over the 5-minute interval
    soc = cfg.battery.min_soc + 0.01            # 5 kWh above min
    near = c.decide(ctx_(cfg, telem(cfg, ts, pv=0, load=200, soc=soc)))
    eta = math.sqrt(cfg.battery.round_trip_efficiency)
    assert near.battery_kw == pytest.approx(5.0 * eta / (300 / 3600))


def test_peak_shaving_holds_import_at_target() -> None:
    cfg = cfg_()
    target = cfg.peak_target_kw
    c = make_controller(ControlMode.PEAK_SHAVING, cfg)
    ts = DAY0 + timedelta(hours=10)
    cmd = c.decide(ctx_(cfg, telem(cfg, ts, pv=20, load=360, ev=40, soc=0.8)))
    grid = 360 + 40 - 20 - cmd.battery_kw
    assert grid == pytest.approx(target)
    # demand beyond target + max discharge: discharge at the limit
    big = c.decide(ctx_(cfg, telem(cfg, ts, pv=0, load=600, soc=0.8)))
    assert big.battery_kw == pytest.approx(cfg.battery.max_discharge_kw)


def test_peak_shaving_recharges_below_target() -> None:
    cfg = cfg_()
    c = make_controller(ControlMode.PEAK_SHAVING, cfg)
    # PV surplus during the day -> absorb it
    day = c.decide(ctx_(cfg, telem(cfg, DAY0 + timedelta(hours=11), pv=300, load=150, soc=0.6)))
    assert day.battery_kw == pytest.approx(-150.0)
    # cheapest (night) band -> recharge up to the target without exceeding it
    night = c.decide(ctx_(cfg, telem(cfg, DAY0 + timedelta(hours=1), pv=0, load=100, soc=0.3)))
    assert night.battery_kw < 0
    assert 100 - night.battery_kw <= cfg.peak_target_kw + 1e-6
    # day band, healthy reserve, net under target -> hold
    hold = c.decide(ctx_(cfg, telem(cfg, DAY0 + timedelta(hours=11), pv=0, load=150, soc=0.9)))
    assert hold.battery_kw == pytest.approx(0.0)


def test_tou_charges_at_night_and_discharges_at_peak() -> None:
    cfg = cfg_()
    c = make_controller(ControlMode.TOU_ARBITRAGE, cfg)
    # 01:00 UTC = 02:00 BST, night band: charge from grid, capped so import stays a
    # small margin under the peak target (300 kW) ...
    night = c.decide(ctx_(cfg, telem(cfg, DAY0 + timedelta(hours=1), pv=0, load=100, soc=0.3)))
    margin = GRID_CHARGE_MARGIN_FRACTION * cfg.peak_target_kw
    assert night.battery_kw == pytest.approx(-(cfg.peak_target_kw - margin - 100))
    assert "cheapest" in night.reason
    # ... and at full power when the site has no peak target
    free = cfg.model_copy(update={"peak_target_kw": None})
    night_free = make_controller(ControlMode.TOU_ARBITRAGE, free).decide(
        ctx_(free, telem(free, DAY0 + timedelta(hours=1), pv=0, load=100, soc=0.3)))
    assert night_free.battery_kw == pytest.approx(-cfg.battery.max_charge_kw)
    # 16:00 UTC = 17:00 BST, peak band: discharge to cover the deficit
    peak = c.decide(ctx_(cfg, telem(cfg, DAY0 + timedelta(hours=16), pv=30, load=230, soc=0.8)))
    assert peak.battery_kw == pytest.approx(200.0)
    # target max_soc: no charging when full
    full = c.decide(ctx_(cfg, telem(cfg, DAY0 + timedelta(hours=1), pv=0, load=100,
                                     soc=cfg.battery.max_soc)))
    assert full.battery_kw == pytest.approx(0.0)


def test_tou_charging_respects_import_limit() -> None:
    cfg = cfg_()
    c = make_controller(ControlMode.TOU_ARBITRAGE, cfg)
    cmd = c.decide(ctx_(cfg, telem(cfg, DAY0 + timedelta(hours=1), pv=0, load=400, soc=0.3)))
    assert 400 - cmd.battery_kw <= cfg.grid.import_limit_kw + 1e-6


@pytest.mark.parametrize("mode", list(ControlMode))
@pytest.mark.parametrize("hour,pv,load,soc", [(1, 0, 900, 0.5), (12, 1200, 50, 0.5),
                                               (17, 0, 900, 0.9), (2, 0, 10, 0.12)])
def test_commands_respect_power_limits(mode, hour, pv, load, soc) -> None:
    cfg = cfg_()
    ts = DAY0 + timedelta(hours=hour)
    fc = make_forecast(cfg, ts, [pv] * 96, [load] * 96)
    ctx = ctx_(cfg, telem(cfg, ts, pv=pv, load=load, soc=soc), fc)
    cmd = make_controller(mode, cfg).decide(ctx)
    assert -cfg.battery.max_charge_kw - 1e-6 <= cmd.battery_kw <= cfg.battery.max_discharge_kw + 1e-6
    lim = power_limits(ctx, respect_grid=False)
    assert -lim.max_charge_kw - 1e-6 <= cmd.battery_kw <= lim.max_discharge_kw + 1e-6
    assert math.isfinite(cmd.battery_kw)


# ------------------------------------------------------------------ optimiser

def test_optimised_falls_back_without_forecast() -> None:
    cfg = cfg_()
    c = make_controller(ControlMode.OPTIMISED, cfg)
    cmd = c.decide(ctx_(cfg, telem(cfg, DAY0 + timedelta(hours=12), pv=300, load=100)))
    assert cmd.battery_kw == pytest.approx(-200.0)
    assert "no forecast" in cmd.reason


def test_optimised_charges_overnight_before_peak_evening() -> None:
    cfg = cfg_()
    start = DAY0 + timedelta(hours=4)           # 05:00 BST: 2 h of night band left
    n = 96
    fc = make_forecast(cfg, start, [0.0] * n, [100.0] * n)
    c = make_controller(ControlMode.OPTIMISED, cfg)
    t = telem(cfg, start - timedelta(minutes=5), pv=0, load=100, soc=cfg.battery.min_soc)
    cmd = c.decide(ctx_(cfg, t, fc))
    assert cmd.battery_kw < -100.0
    assert isinstance(c, OptimisedController) and c.last_plan is not None
    plan = c.last_plan
    times = [start + timedelta(minutes=15 * i) for i in range(n)]
    peak_idx = [i for i, ts in enumerate(times)
                if cfg.tariff.band_at(ts, cfg.timezone).name == "peak"]
    assert plan.battery_kw[peak_idx].sum() > 0     # discharges in the peak band
    assert np.all(plan.soc >= cfg.battery.min_soc - 1e-9)
    assert np.all(plan.soc <= cfg.battery.max_soc + 1e-9)


def test_optimised_does_not_charge_from_grid_at_peak_price() -> None:
    cfg = cfg_()
    start = DAY0 + timedelta(hours=15, minutes=30)   # 16:30 BST, peak band
    fc = make_forecast(cfg, start, [0.0] * 96, [150.0] * 96)
    cmd = make_controller(ControlMode.OPTIMISED, cfg).decide(
        ctx_(cfg, telem(cfg, start, pv=0, load=150, soc=0.6), fc))
    assert cmd.battery_kw > 0


def test_solve_schedule_plan_is_consistent() -> None:
    cfg = cfg_()
    start = DAY0
    pv = [max(0.0, 350 * math.sin(math.pi * (i / 4 - 5) / 15)) for i in range(96)]
    fc = make_forecast(cfg, start, pv, [150.0] * 96)
    plan = solve_schedule(cfg, fc, 0.5)
    eta = math.sqrt(cfg.battery.round_trip_efficiency)
    de = np.diff(plan.soc) * cfg.battery.capacity_kwh
    implied = np.where(de > 0, -de / eta, -de * eta) / 0.25
    np.testing.assert_allclose(plan.battery_kw, implied, atol=1e-6)
    assert np.all(plan.battery_kw <= cfg.battery.max_discharge_kw + 1e-6)
    assert np.all(-plan.battery_kw <= cfg.battery.max_charge_kw + 1e-6)
    assert np.all(plan.grid_kw >= -cfg.grid.export_limit_kw - 1e-9)


def test_optimised_timing_under_200ms() -> None:
    cfg = cfg_()
    pv = [max(0.0, 350 * math.sin(math.pi * (i / 4 - 5) / 15)) for i in range(96)]
    fc = make_forecast(cfg, DAY0, pv, [150.0 + 50 * math.sin(i / 10) for i in range(96)])
    c = make_controller(ControlMode.OPTIMISED, cfg)
    ctx = ctx_(cfg, telem(cfg, DAY0, pv=0, load=150, soc=0.4), fc)
    c.decide(ctx)                                    # warm-up
    best = min(_timed(c, ctx) for _ in range(5))
    assert best < 0.2, f"optimiser took {best * 1000:.0f} ms"


def _timed(c: Controller, ctx: ControllerContext) -> float:
    t0 = time.perf_counter()
    c.decide(ctx)
    return time.perf_counter() - t0


# ------------------------------------------------------------------ savings on a synthetic loop

STEP_MIN = 15
DAYS = 3
PV_SCALE = (1.0, 0.6, 0.85)                     # sunny, cloudy, mixed days


def _profile(cfg: SiteConfig, i: int, day_load_kw: float = 180.0) -> tuple[float, float]:
    """Deterministic (pv, load) for interval i since DAY0 (UTC)."""
    h = (i * STEP_MIN / 60.0) % 24
    day = (i * STEP_MIN // 60) // 24
    pv = cfg.pv.capacity_kwp * 0.8 * PV_SCALE[day % len(PV_SCALE)] * max(0.0, math.sin(math.pi * (h - 4) / 16))
    load = 140.0 + (day_load_kw if 6 <= h < 18 else 0.0) + 15.0 * math.sin(2 * math.pi * h / 24)
    return pv, load


def _run_loop(mode: ControlMode, day_load_kw: float = 180.0) -> tuple[float, float]:
    """Run a 3-day closed loop; return (cost incl. prorated demand charge, peak import kW)."""
    cfg = cfg_()
    bat, grid = cfg.battery, cfg.grid
    eta = math.sqrt(bat.round_trip_efficiency)
    dt_h = STEP_MIN / 60.0
    ctrl = make_controller(mode, cfg)
    soc = bat.initial_soc
    n = DAYS * 24 * 60 // STEP_MIN
    pv0, load0 = _profile(cfg, 0, day_load_kw)
    last = telem(cfg, DAY0 - timedelta(minutes=STEP_MIN), pv=pv0, load=load0, soc=soc)
    cost = 0.0
    peak = 0.0
    for i in range(n):
        ts = DAY0 + timedelta(minutes=STEP_MIN * i)
        fc_pv, fc_load = zip(*(_profile(cfg, j, day_load_kw) for j in range(i, i + 96)))
        fc = make_forecast(cfg, ts, fc_pv, fc_load, STEP_MIN)
        cmd = ctrl.decide(ControllerContext(telemetry=last, forecast=fc, config=cfg,
                                            step_seconds=STEP_MIN * 60))
        pv, load = _profile(cfg, i, day_load_kw)
        # physics: power and SoC clamping with sqrt efficiencies
        b = min(max(cmd.battery_kw, -bat.max_charge_kw), bat.max_discharge_kw)
        if b > 0:
            b = min(b, max(0.0, (soc - bat.min_soc) * bat.capacity_kwh) * eta / dt_h)
            soc -= b * dt_h / eta / bat.capacity_kwh
        else:
            b = max(b, -max(0.0, (bat.max_soc - soc) * bat.capacity_kwh) / eta / dt_h)
            soc += -b * dt_h * eta / bat.capacity_kwh
        g = load - pv - b
        curtailed = 0.0
        if g < -grid.export_limit_kw:
            curtailed = -grid.export_limit_kw - g
            g = -grid.export_limit_kw
        assert bat.min_soc - 1e-9 <= soc <= bat.max_soc + 1e-9
        price = cfg.tariff.import_price_at(ts, cfg.timezone)
        exp_price = cfg.tariff.export_price_gbp_per_kwh
        cost += (max(g, 0) * price - max(-g, 0) * exp_price) * dt_h
        peak = max(peak, g)
        last = Telemetry(timestamp=ts, pv_kw=pv - curtailed, pv_curtailed_kw=curtailed, load_kw=load,
                         ev_kw=0.0, battery_kw=b, battery_soc=soc, grid_kw=g, mode=mode,
                         import_price_gbp_per_kwh=price, export_price_gbp_per_kwh=exp_price)
        assert abs(last.balance_error_kw()) < 1e-6
    hours = n * dt_h
    # Credit (or charge) the change in stored energy at the cheapest import price so a
    # mode is not rewarded for draining, or penalised for filling, the battery.
    cheapest = min(b.import_price_gbp_per_kwh for b in cfg.tariff.bands)
    stored_delta = (soc - bat.initial_soc) * bat.capacity_kwh
    cost -= stored_delta * cheapest
    return cost + cfg.tariff.demand_charge_gbp_per_kw_month * peak * hours / 730, peak


@pytest.fixture(scope="module")
def loop_costs() -> dict[ControlMode, float]:
    return {m: _run_loop(m)[0] for m in ControlMode}


def test_savings_ordering(loop_costs: dict[ControlMode, float]) -> None:
    idle = loop_costs[ControlMode.IDLE]
    sc = loop_costs[ControlMode.SELF_CONSUMPTION]
    opt = loop_costs[ControlMode.OPTIMISED]
    assert sc < idle
    assert opt < idle
    assert opt <= sc * 1.02


def test_tou_beats_idle(loop_costs: dict[ControlMode, float]) -> None:
    assert loop_costs[ControlMode.TOU_ARBITRAGE] < loop_costs[ControlMode.IDLE]


def test_peak_shaving_loop_caps_import() -> None:
    cfg = cfg_()
    heavy = 280.0                                   # baseline import well above target
    _, idle_peak = _run_loop(ControlMode.IDLE, heavy)
    _, ps_peak = _run_loop(ControlMode.PEAK_SHAVING, heavy)
    assert idle_peak > cfg.peak_target_kw + 40
    assert ps_peak <= cfg.peak_target_kw + 1e-6
    _, opt_peak = _run_loop(ControlMode.OPTIMISED, heavy)
    assert opt_peak < idle_peak


def test_peak_shaving_spends_energy_above_reserve_in_dearest_band() -> None:
    """Above the shaving reserve, peak shaving covers demand in the dearest band."""
    from datetime import datetime, timezone

    from ems.control import make_controller
    from ems.models import ControlMode, ControllerContext, Telemetry
    from ems.presets import demo_warehouse

    cfg = demo_warehouse()
    ctrl = make_controller(ControlMode.PEAK_SHAVING, cfg)

    def ctx(soc: float, hour_utc: int) -> ControllerContext:
        ts = datetime(2026, 6, 3, hour_utc, 0, tzinfo=timezone.utc)
        t = Telemetry(timestamp=ts, pv_kw=0.0, pv_curtailed_kw=0.0, load_kw=150.0, ev_kw=0.0,
                      battery_kw=0.0, battery_soc=soc, grid_kw=150.0,
                      import_price_gbp_per_kwh=0.38, export_price_gbp_per_kwh=0.08,
                      mode=ControlMode.PEAK_SHAVING)
        return ControllerContext(telemetry=t, forecast=None, config=cfg, step_seconds=300)

    # 16:00 UTC -> 17:05 BST decision time: dearest (peak) band.
    full = ctrl.decide(ctx(0.95, 16))
    assert 0 < full.battery_kw <= 150.0 + 1e-9
    # At or below the reserve the battery is held for shaving.
    held = ctrl.decide(ctx(0.50, 16))
    assert held.battery_kw <= 1e-9
    # Outside the dearest band (day band, 10:00 BST) a full battery just holds.
    day = ctrl.decide(ctx(0.95, 9))
    assert day.battery_kw == 0.0


# ------------------------------------------------------------------ peak-target guards on grid charging

def test_peak_shaving_grid_charging_keeps_margin_below_target() -> None:
    """Cheap-band recharging must leave headroom for load noise (regression)."""
    cfg = cfg_()
    target = cfg.peak_target_kw
    assert target is not None
    c = make_controller(ControlMode.PEAK_SHAVING, cfg)
    ts = DAY0 + timedelta(hours=1)                          # night (cheapest) band
    cmd = c.decide(ctx_(cfg, telem(cfg, ts, pv=0, load=100, soc=0.3)))
    assert cmd.battery_kw == pytest.approx(-(target * (1 - GRID_CHARGE_MARGIN_FRACTION) - 100))
    # With a forecast of higher demand for the coming interval, charge less.
    fc = make_forecast(cfg, ts + timedelta(minutes=5), [0.0] * 96, [180.0] * 96)
    cmd_fc = c.decide(ctx_(cfg, telem(cfg, ts, pv=0, load=100, soc=0.3), fc))
    assert cmd_fc.battery_kw == pytest.approx(-(target * (1 - GRID_CHARGE_MARGIN_FRACTION) - 180))


def test_peak_shaving_uses_forecast_to_anticipate_step_up() -> None:
    """Measured demand under target but forecast above it: shave in advance."""
    cfg = cfg_()
    target = cfg.peak_target_kw
    assert target is not None
    c = make_controller(ControlMode.PEAK_SHAVING, cfg)
    ts = DAY0 + timedelta(hours=5)
    t = telem(cfg, ts, pv=0, load=280, soc=0.9)
    assert c.decide(ctx_(cfg, t)).battery_kw <= 0          # reactive: sees 280 < 300
    fc = make_forecast(cfg, ts + timedelta(minutes=5), [0.0] * 96, [330.0] * 96)
    assert c.decide(ctx_(cfg, t, fc)).battery_kw == pytest.approx(330 - target)


def test_tou_grid_charging_uses_forecast_net_and_margin() -> None:
    cfg = cfg_()
    target = cfg.peak_target_kw
    assert target is not None
    c = make_controller(ControlMode.TOU_ARBITRAGE, cfg)
    ts = DAY0 + timedelta(hours=1)
    fc = make_forecast(cfg, ts + timedelta(minutes=5), [0.0] * 96, [150.0] * 96)
    cmd = c.decide(ctx_(cfg, telem(cfg, ts, pv=0, load=100, soc=0.3), fc))
    assert cmd.battery_kw == pytest.approx(-(target * (1 - GRID_CHARGE_MARGIN_FRACTION) - 150))


def test_optimised_grid_charging_capped_by_measured_demand() -> None:
    """Open-loop planned charging must not push import over the target (regression).

    The forecast says 100 kW, so the plan charges hard overnight; but the last meter
    reading was 250 kW, so only 300 - 250 = 50 kW of charging fits under the target.
    """
    cfg = cfg_()
    target = cfg.peak_target_kw
    assert target is not None
    start = DAY0 + timedelta(hours=4)                       # 05:00 BST, night band
    fc = make_forecast(cfg, start, [0.0] * 96, [100.0] * 96)
    c = make_controller(ControlMode.OPTIMISED, cfg)
    low = c.decide(ctx_(cfg, telem(cfg, start - timedelta(minutes=5), load=100,
                                   soc=cfg.battery.min_soc), fc))
    assert low.battery_kw < -(target - 250)                 # plan wants more than 50 kW
    high = c.decide(ctx_(cfg, telem(cfg, start - timedelta(minutes=5), load=250,
                                    soc=cfg.battery.min_soc), fc))
    assert high.battery_kw == pytest.approx(-(target - 250))
    # Forecast above the measurement: the forecast bounds charging instead.
    fc_high = make_forecast(cfg, start, [0.0] * 96, [270.0] * 96)
    cmd = c.decide(ctx_(cfg, telem(cfg, start - timedelta(minutes=5), load=100,
                                   soc=cfg.battery.min_soc), fc_high))
    assert -(target - 270) - 1e-6 <= cmd.battery_kw <= 0
