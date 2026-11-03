"""Tests for ems.simulator.SiteSimulator."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

from ems.models import (POWER_BALANCE_TOLERANCE_KW, BatteryConfig, ControlMode, DispatchCommand,
                        EVConfig, GridConfig, SiteConfig)
from ems.presets import demo_office, demo_warehouse
from ems.simulator import SiteSimulator

START = datetime(2026, 6, 1, tzinfo=timezone.utc)  # a Monday
IDLE = ControlMode.IDLE


def _cmd(kw: float = 0.0, ev_limit: float | None = None) -> DispatchCommand:
    return DispatchCommand(battery_kw=kw, ev_kw_limit=ev_limit, reason="test")


def _run_random(config: SiteConfig, steps: int, seed: int = 0, dt: float = 300.0):
    sim = SiteSimulator(config, START)
    rng = np.random.default_rng(seed)
    b = config.battery
    out = []
    for _ in range(steps):
        kw = float(rng.uniform(-1.5 * b.max_charge_kw, 1.5 * b.max_discharge_kw))
        limit = None if rng.random() < 0.7 else float(rng.uniform(0, 200))
        out.append(sim.step(_cmd(kw, limit), dt, ControlMode.OPTIMISED))
    return sim, out


def test_power_balance_every_step_seven_days() -> None:
    _, rows = _run_random(demo_warehouse(), 288 * 7)
    for r in rows:
        assert abs(r.balance_error_kw()) <= POWER_BALANCE_TOLERANCE_KW
        assert r.pv_kw >= 0 and r.pv_curtailed_kw >= 0 and r.load_kw >= 0 and r.ev_kw >= 0


def test_soc_within_window_and_power_limits() -> None:
    cfg = demo_warehouse()
    _, rows = _run_random(cfg, 288 * 7, seed=3)
    b = cfg.battery
    for r in rows:
        assert b.min_soc - 1e-9 <= r.battery_soc <= b.max_soc + 1e-9
        assert -b.max_charge_kw - 1e-9 <= r.battery_kw <= b.max_discharge_kw + 1e-9


def test_soc_window_reached_but_not_crossed() -> None:
    cfg = demo_warehouse()
    sim = SiteSimulator(cfg, START)
    for _ in range(48):
        sim.step(_cmd(10_000), 300, IDLE)
    assert sim.soc == pytest.approx(cfg.battery.min_soc)
    t = sim.step(_cmd(250), 300, IDLE)
    assert t.battery_kw == pytest.approx(0.0, abs=1e-9)
    for _ in range(96):
        sim.step(_cmd(-10_000), 300, IDLE)
    assert sim.soc == pytest.approx(cfg.battery.max_soc)


def test_determinism_same_seed_same_output() -> None:
    _, a = _run_random(demo_warehouse(), 288 * 2, seed=5)
    _, b = _run_random(demo_warehouse(), 288 * 2, seed=5)
    assert [r.model_dump() for r in a] == [r.model_dump() for r in b]


def test_different_seed_changes_output() -> None:
    cfg2 = demo_warehouse().model_copy(update={"seed": 7})
    sim_a, sim_b = SiteSimulator(demo_warehouse(), START), SiteSimulator(cfg2, START)
    pa = [sim_a.step(_cmd(), 3600, IDLE).pv_kw for _ in range(72)]
    pb = [sim_b.step(_cmd(), 3600, IDLE).pv_kw for _ in range(72)]
    assert pa != pb


def test_clock_advances_and_timestamp_is_interval_start() -> None:
    sim = SiteSimulator(demo_warehouse(), START)
    assert sim.now == START and sim.now.tzinfo is not None
    t1 = sim.step(_cmd(), 300, IDLE)
    assert t1.timestamp == START
    assert sim.now == START + timedelta(seconds=300)
    t2 = sim.step(_cmd(), 900, IDLE)
    assert t2.timestamp == START + timedelta(seconds=300)
    assert sim.now == t2.timestamp + timedelta(seconds=900)
    assert t2.mode == IDLE


def test_rejects_non_positive_dt() -> None:
    sim = SiteSimulator(demo_warehouse(), START)
    with pytest.raises(ValueError):
        sim.step(_cmd(), 0, IDLE)


def test_pv_zero_at_night_positive_at_noon_and_realistic_peak() -> None:
    sim = SiteSimulator(demo_warehouse(), START)
    rows = [sim.step(_cmd(), 300, IDLE) for _ in range(288 * 14)]
    pv = np.array([r.pv_kw + r.pv_curtailed_kw for r in rows]).reshape(14, 288)
    hours = np.arange(288) * 5 / 60  # UTC; London is UTC+1 in June
    night = (hours < 2.5) | (hours >= 21.5)
    noon = (hours >= 11) & (hours < 13)
    assert np.all(pv[:, night] == 0.0)
    assert np.all(pv[:, noon] > 0.0)
    daily_peak = pv.max(axis=1)
    assert 380 <= daily_peak.max() <= 430          # clear-day peak
    assert daily_peak.min() < 0.6 * daily_peak.max()  # some dull days


def test_load_profile_weekday_vs_weekend() -> None:
    sim = SiteSimulator(demo_warehouse(), START)
    rows = [sim.step(_cmd(), 3600, IDLE) for _ in range(24 * 7)]
    load = np.array([r.load_kw for r in rows]).reshape(7, 24)
    cfg = demo_warehouse().load
    assert load[0, 2] < 1.3 * cfg.base_load_kw               # overnight ~ base
    assert load[0, 11] > 0.85 * cfg.peak_load_kw             # weekday plateau
    assert load[5, 11] < 0.7 * load[0, 11]                    # Saturday lower


def test_ev_sessions_mostly_evening() -> None:
    sim = SiteSimulator(demo_warehouse(), START)
    rows = [sim.step(_cmd(), 900, IDLE) for _ in range(96 * 7)]
    ev = np.array([r.ev_kw for r in rows]).reshape(7, 96)
    local_hour = (np.arange(96) / 4 + 1) % 24
    evening = (local_hour >= 17) | (local_hour < 7)
    assert ev[:, evening].sum() > 2 * ev[:, ~evening].sum()
    cfg = demo_warehouse().ev
    assert ev.max() <= cfg.num_chargers * cfg.charger_kw + 1e-9


def test_ev_limit_command_respected() -> None:
    sim = SiteSimulator(demo_warehouse(), START)
    rows = [sim.step(_cmd(0, 15.0), 900, IDLE) for _ in range(96 * 2)]
    assert max(r.ev_kw for r in rows) <= 15.0 + 1e-9
    assert sum(r.ev_kw for r in rows) > 0


def test_export_limit_curtails_pv() -> None:
    cfg = demo_warehouse().model_copy(update={"grid": GridConfig(import_limit_kw=500, export_limit_kw=0)})
    sim = SiteSimulator(cfg, START)
    rows = [sim.step(_cmd(250), 300, IDLE) for _ in range(288 * 7)]
    assert all(r.grid_kw >= -1e-9 for r in rows)
    assert sum(r.pv_curtailed_kw for r in rows) > 0
    for r in rows:
        assert abs(r.balance_error_kw()) <= POWER_BALANCE_TOLERANCE_KW


def test_import_limit_sheds_ev_then_battery_charging() -> None:
    cfg = demo_warehouse().model_copy(update={
        "grid": GridConfig(import_limit_kw=150, export_limit_kw=200),
        "ev": EVConfig(num_chargers=8, charger_kw=22, sessions_per_day=20, kwh_per_session=60),
        "battery": BatteryConfig(capacity_kwh=2000, max_charge_kw=250, max_discharge_kw=250, initial_soc=0.2),
    })
    sim = SiteSimulator(cfg, START)
    rows = [sim.step(_cmd(-250), 300, IDLE) for _ in range(288 * 2)]
    shed_battery = False
    for r in rows:
        if r.load_kw - r.pv_kw <= cfg.grid.import_limit_kw:
            assert r.grid_kw <= cfg.grid.import_limit_kw + 1e-6
        else:  # load alone exceeds limit: EV and charging must be fully shed
            assert r.ev_kw == pytest.approx(0.0, abs=1e-9)
            assert r.battery_kw >= -1e-9
        if r.battery_kw > -250 + 1e-6 and r.battery_soc < cfg.battery.max_soc - 0.01:
            shed_battery = True
            assert r.ev_kw == pytest.approx(0.0, abs=1e-9)  # EV shed before battery charging
    assert shed_battery


def test_forecast_shape_and_no_side_effects() -> None:
    a = SiteSimulator(demo_warehouse(), START)
    b = SiteSimulator(demo_warehouse(), START)
    for _ in range(100):
        a.step(_cmd(-50), 300, IDLE)
        b.step(_cmd(-50), 300, IDLE)
    soc, now = a.soc, a.now
    fc = a.forecast(24, 15)
    a.forecast(6, 5)
    assert a.now == now and a.soc == soc
    assert fc.start == now and fc.step_minutes == 15
    for series in (fc.pv_kw, fc.load_kw, fc.import_price, fc.export_price):
        assert len(series) == 96
    assert len(a.forecast(6, 5).pv_kw) == 72
    cfg = demo_warehouse()
    for i, p in enumerate(fc.import_price):
        assert p == cfg.tariff.import_price_at(now + timedelta(minutes=15 * i), cfg.timezone)
    assert a.forecast(24, 15) == fc  # deterministic
    for _ in range(300):
        ta = a.step(_cmd(30, 40), 300, IDLE)
        tb = b.step(_cmd(30, 40), 300, IDLE)
        assert ta == tb


def test_forecast_error_grows_with_lead_time() -> None:
    cfg = demo_warehouse()
    near, far = [], []
    sim = SiteSimulator(cfg, START)
    for _ in range(14):
        fc = sim.forecast(48, 60)
        truth = SiteSimulator(cfg, sim.now)
        actual = np.array([truth.step(_cmd(), 3600, IDLE).pv_kw for _ in range(48)])
        pred = np.array(fc.pv_kw)
        assert np.all(pred >= 0)
        near.append(np.abs(pred[:6] - actual[:6]).mean())
        far.append(np.abs(pred[36:42] - actual[36:42]).mean())
        assert not np.allclose(pred, actual)
        for _ in range(24):
            sim.step(_cmd(), 3600, IDLE)
    assert np.mean(far) > np.mean(near)


def test_efficiency_loss_round_trip() -> None:
    cfg = demo_office()
    sim = SiteSimulator(cfg, START)
    b = cfg.battery
    soc0 = sim.soc
    charged = 0.0
    for _ in range(4):
        charged += -sim.step(_cmd(-50), 900, IDLE).battery_kw * 0.25
    assert charged == pytest.approx(50.0)
    assert sim.soc > soc0
    # Stored energy = charged * sqrt(rte); recoverable = stored * sqrt(rte) = charged * rte.
    hours = charged * b.round_trip_efficiency / 50.0
    discharged = sim.step(_cmd(50), hours * 3600, IDLE).battery_kw * hours
    assert discharged == pytest.approx(charged * b.round_trip_efficiency)
    assert sim.soc == pytest.approx(soc0, abs=1e-9)  # back where we started
    assert discharged < charged
    # Asking for more yields nothing beyond the energy actually stored (above min_soc).
    sim2 = SiteSimulator(cfg, START)
    avail = (sim2.soc - b.min_soc) * b.capacity_kwh * b.round_trip_efficiency ** 0.5
    got = sim2.step(_cmd(100), 36000, IDLE).battery_kw * 10
    assert got == pytest.approx(avail)


def test_zero_capacity_battery_and_no_pv() -> None:
    cfg = demo_office().model_copy(update={
        "battery": BatteryConfig(capacity_kwh=0, max_charge_kw=0, max_discharge_kw=0),
    })
    sim = SiteSimulator(cfg, START)
    for _ in range(50):
        r = sim.step(_cmd(100), 600, IDLE)
        assert r.battery_kw == 0.0
        assert abs(r.balance_error_kw()) <= POWER_BALANCE_TOLERANCE_KW


def test_retail_profile_open_on_sunday() -> None:
    from ems.models import LoadConfig
    cfg = demo_office().model_copy(update={"load": LoadConfig(profile="retail", base_load_kw=20, peak_load_kw=120)})
    sim = SiteSimulator(cfg, datetime(2026, 6, 7, tzinfo=timezone.utc))  # Sunday
    rows = [sim.step(_cmd(), 3600, IDLE) for _ in range(24)]
    assert rows[13].load_kw > 80    # 14:00 local, open
    assert rows[2].load_kw < 30     # 03:00 local, closed


def test_observe_reads_preceding_interval_without_side_effects() -> None:
    start = datetime(2026, 6, 3, 12, 0, tzinfo=timezone.utc)  # weekday midday
    sim = SiteSimulator(demo_warehouse(), start)
    reading = sim.observe(300, ControlMode.IDLE)
    assert reading.timestamp == start - timedelta(seconds=300)
    assert reading.battery_kw == 0.0 and reading.battery_soc == sim.soc
    assert reading.pv_kw > 0 and reading.load_kw > 0
    assert abs(reading.balance_error_kw()) <= POWER_BALANCE_TOLERANCE_KW
    assert reading.grid_kw >= -demo_warehouse().grid.export_limit_kw - 1e-9
    assert sim.now == start
    twin = SiteSimulator(demo_warehouse(), start)
    assert sim.step(_cmd(), 300, ControlMode.IDLE) == twin.step(_cmd(), 300, ControlMode.IDLE)
    with pytest.raises(ValueError):
        sim.observe(0, ControlMode.IDLE)
