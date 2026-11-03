"""Tests for ems.core.EMSEngine: control loop invariants, history, pub/sub, background loop."""
from __future__ import annotations

import asyncio
import subprocess
import sys
from datetime import timedelta
from pathlib import Path

import pytest

from ems.core import DEFAULT_START, EMSEngine
from ems.core.engine import FORECAST_MODES
from ems.models import POWER_BALANCE_TOLERANCE_KW, ControlMode, Telemetry
from ems.presets import demo_office, demo_warehouse

REPO_ROOT = Path(__file__).resolve().parent.parent
SOC_TOL = 1e-9


def _dump(samples: list[Telemetry]) -> list[dict]:
    return [s.model_dump() for s in samples]


# --------------------------------------------------------------------------- invariants

@pytest.mark.parametrize("mode", list(ControlMode))
def test_power_balance_and_soc_over_two_days(mode: ControlMode) -> None:
    config = demo_warehouse()
    engine = EMSEngine(config, mode=mode, step_seconds=900)
    samples = engine.run(2 * 96)
    assert len(samples) == 192
    bat = config.battery
    for i, t in enumerate(samples):
        assert abs(t.balance_error_kw()) <= POWER_BALANCE_TOLERANCE_KW
        assert bat.min_soc - SOC_TOL <= t.battery_soc <= bat.max_soc + SOC_TOL
        assert t.mode == mode
        assert t.timestamp == DEFAULT_START + timedelta(seconds=900 * i)
        assert -bat.max_charge_kw - 1e-6 <= t.battery_kw <= bat.max_discharge_kw + 1e-6
    assert engine.sim_time == DEFAULT_START + timedelta(days=2)
    if mode == ControlMode.IDLE:
        assert all(t.battery_kw == 0 for t in samples)
    else:
        assert any(abs(t.battery_kw) > 1 for t in samples)


def test_determinism_same_config_same_output() -> None:
    a = EMSEngine(demo_warehouse(), mode=ControlMode.OPTIMISED)
    b = EMSEngine(demo_warehouse(), mode=ControlMode.OPTIMISED)
    assert _dump(a.run(60)) == _dump(b.run(60))


def test_reset_replays_identically() -> None:
    engine = EMSEngine(demo_warehouse(), mode=ControlMode.TOU_ARBITRAGE)
    first = _dump(engine.run(50))
    engine.reset()
    assert engine.history() == []
    assert engine.sim_time == DEFAULT_START
    assert engine.status().latest is None and engine.last_command is None
    assert _dump(engine.run(50)) == first


def test_reset_with_new_config_switches_site() -> None:
    engine = EMSEngine(demo_warehouse(), mode=ControlMode.SELF_CONSUMPTION)
    engine.run(5)
    engine.reset(demo_office())
    assert engine.config.site_id == "demo-office"
    assert engine.status().site_id == "demo-office"
    assert engine.mode == ControlMode.SELF_CONSUMPTION
    t = engine.step()
    assert t.battery_soc <= demo_office().battery.max_soc + SOC_TOL


def test_custom_start_naive_is_utc() -> None:
    engine = EMSEngine(demo_warehouse(), start=DEFAULT_START.replace(tzinfo=None, month=1))
    assert engine.sim_time.utcoffset() == timedelta(0)
    assert engine.step().timestamp.month == 1


@pytest.mark.parametrize("kwargs", [{"step_seconds": 0}, {"step_seconds": -5},
                                    {"history_limit": 0}, {"sim_speed": 0}])
def test_invalid_constructor_args(kwargs: dict) -> None:
    with pytest.raises(ValueError):
        EMSEngine(demo_warehouse(), **kwargs)


# --------------------------------------------------------------------------- history

def test_history_is_bounded() -> None:
    engine = EMSEngine(demo_warehouse(), mode=ControlMode.IDLE, history_limit=10)
    samples = engine.run(25)
    hist = engine.history()
    assert len(hist) == 10
    assert hist == samples[-10:]
    assert engine.history(3) == samples[-3:]
    assert engine.history(0) == []
    assert engine.history(100) == samples[-10:]


def test_run_rejects_negative_steps() -> None:
    engine = EMSEngine(demo_warehouse())
    assert engine.run(0) == []
    with pytest.raises(ValueError):
        engine.run(-1)


# --------------------------------------------------------------------------- modes

def test_mode_switch_takes_effect_next_step() -> None:
    engine = EMSEngine(demo_warehouse(), mode=ControlMode.IDLE)
    engine.run(3)
    engine.set_mode(ControlMode.PEAK_SHAVING)
    assert engine.mode == ControlMode.PEAK_SHAVING
    assert engine.status().mode == ControlMode.PEAK_SHAVING
    t = engine.step()
    assert t.mode == ControlMode.PEAK_SHAVING
    assert [s.mode for s in engine.history()] == [ControlMode.IDLE] * 3 + [
        ControlMode.PEAK_SHAVING]
    engine.set_mode("optimised")
    assert engine.mode == ControlMode.OPTIMISED
    with pytest.raises(ValueError):
        engine.set_mode("turbo")
    assert engine.mode == ControlMode.OPTIMISED


def test_first_step_bootstraps_from_meter_reading() -> None:
    engine = EMSEngine(demo_warehouse(), mode=ControlMode.SELF_CONSUMPTION)
    boot = engine._initial_telemetry()
    assert boot.timestamp == DEFAULT_START - timedelta(seconds=engine.step_seconds)
    assert boot.load_kw > 0 and boot.battery_kw == 0
    assert boot.balance_error_kw() == pytest.approx(0.0, abs=1e-9)
    t = engine.step()
    assert t.timestamp == DEFAULT_START
    assert engine.last_command is not None
    assert engine.last_command.reason


@pytest.mark.parametrize("make_cfg", [demo_warehouse, demo_office])
@pytest.mark.parametrize("mode", [ControlMode.PEAK_SHAVING, ControlMode.TOU_ARBITRAGE])
def test_first_grid_charging_step_does_not_create_a_peak(make_cfg, mode: ControlMode) -> None:
    """The first decision must see the real site load, not a zero-flow placeholder.

    Regression: a zero-flow bootstrap let the first (cheap-band) step grid-charge at
    the full 250 kW on top of ~83 kW of load, importing 333 kW and setting the run's
    peak and demand charge.
    """
    cfg = make_cfg()
    assert cfg.peak_target_kw is not None
    engine = EMSEngine(cfg, mode=mode)
    t = engine.step()
    assert t.grid_kw <= cfg.peak_target_kw


@pytest.mark.parametrize("mode", list(ControlMode))
def test_forecast_supplied_to_modes_that_use_it(mode: ControlMode) -> None:
    """PEAK_SHAVING and TOU read ctx.forecast too, so the engine must supply it."""
    engine = EMSEngine(demo_warehouse(), mode=mode)
    seen: list[bool] = []
    controller = engine._controller
    original = controller.decide

    def spy(ctx):
        seen.append(ctx.forecast is not None)
        return original(ctx)

    controller.decide = spy  # type: ignore[method-assign]
    engine.run(2)
    assert seen == [mode in FORECAST_MODES] * 2
    assert (mode in FORECAST_MODES) == (mode in (ControlMode.OPTIMISED, ControlMode.PEAK_SHAVING,
                                                 ControlMode.TOU_ARBITRAGE))


def test_forecast_requested_only_in_forecast_modes() -> None:
    engine = EMSEngine(demo_warehouse(), mode=ControlMode.IDLE)
    calls: list[tuple[float, int]] = []
    sim = engine._sim
    original = sim.forecast

    def spy(horizon_hours: float = 24, step_minutes: int = 15):
        calls.append((horizon_hours, step_minutes))
        return original(horizon_hours, step_minutes)

    sim.forecast = spy  # type: ignore[method-assign]
    engine.run(3)
    assert calls == []
    engine.set_mode(ControlMode.OPTIMISED)
    engine.run(2)
    assert calls == [(24, 15), (24, 15)]


def test_peak_shaving_week_stays_near_target() -> None:
    """With the forecast, peak shaving anticipates shift starts (regression).

    Reactive-only shaving (no forecast) peaked at 315.8 kW against the 300 kW target
    with 50 intervals over it; grid charging also overshot the target 32 times.
    """
    cfg = demo_warehouse()
    target = cfg.peak_target_kw
    assert target is not None
    engine = EMSEngine(cfg, mode=ControlMode.PEAK_SHAVING)
    history = engine.run(7 * 288)
    over = [t for t in history if t.grid_kw > target + 0.5]
    assert engine.kpis().peak_import_kw < 312.0
    assert len(over) < 25
    assert not [t for t in history if t.battery_kw < -1e-6 and t.grid_kw > target]


# --------------------------------------------------------------------------- KPIs

def test_kpis_require_history_then_available() -> None:
    engine = EMSEngine(demo_warehouse(), mode=ControlMode.SELF_CONSUMPTION)
    with pytest.raises(ValueError):
        engine.kpis()
    engine.run(288)
    k = engine.kpis()
    assert k.hours == pytest.approx(24.0)
    assert k.period_start == DEFAULT_START
    assert k.load_kwh > 0 and k.pv_generation_kwh > 0
    k6 = engine.kpis(last_hours=6)
    assert k6.hours == pytest.approx(6.0)
    assert k6.period_start == DEFAULT_START + timedelta(hours=18)
    assert k6.period_end == k.period_end
    with pytest.raises(ValueError):
        engine.kpis(last_hours=0)


@pytest.mark.parametrize("hours", [0.0001, 0.05, 5 / 60])
def test_kpis_window_shorter_than_a_step_returns_latest_interval(hours: float) -> None:
    """Regression: a window under one step used to come back empty (-> HTTP 409)."""
    engine = EMSEngine(demo_warehouse(), mode=ControlMode.SELF_CONSUMPTION)
    latest = engine.run(3)[-1]
    k = engine.kpis(last_hours=hours)
    assert k.period_start == latest.timestamp
    assert k.hours == pytest.approx(engine.step_seconds / 3600)


def test_status_snapshot() -> None:
    engine = EMSEngine(demo_warehouse(), sim_speed=600)
    s = engine.status()
    assert s.site_id == "demo-warehouse" and s.mode == ControlMode.OPTIMISED
    assert s.sim_time == DEFAULT_START and s.sim_speed == 600 and s.running is False
    assert s.latest is None and s.last_command is None
    t = engine.step()
    s = engine.status()
    assert s.latest == t and s.last_command is not None
    assert s.sim_time == DEFAULT_START + timedelta(seconds=300)


def test_forecast_does_not_disturb_simulation() -> None:
    a = EMSEngine(demo_warehouse(), mode=ControlMode.SELF_CONSUMPTION)
    b = EMSEngine(demo_warehouse(), mode=ControlMode.SELF_CONSUMPTION)
    fc = a.forecast(6)
    assert fc.start == DEFAULT_START and len(fc.pv_kw) == 24
    assert _dump(a.run(20)) == _dump(b.run(20))


def test_savings_ordering_demo_warehouse_seven_days() -> None:
    """OPTIMISED must beat IDLE and at least match SELF_CONSUMPTION on cost."""
    costs: dict[ControlMode, float] = {}
    for mode in (ControlMode.IDLE, ControlMode.SELF_CONSUMPTION, ControlMode.OPTIMISED):
        engine = EMSEngine(demo_warehouse(), mode=mode, step_seconds=900)
        engine.run(7 * 96)
        costs[mode] = engine.kpis().cost_gbp
    assert costs[ControlMode.OPTIMISED] < costs[ControlMode.IDLE]
    assert costs[ControlMode.OPTIMISED] <= costs[ControlMode.SELF_CONSUMPTION]


# --------------------------------------------------------------------------- pub/sub

def test_subscribers_receive_and_drop_oldest_when_full() -> None:
    async def scenario() -> None:
        engine = EMSEngine(demo_warehouse(), mode=ControlMode.IDLE)
        q = engine.subscribe(maxsize=3)
        assert engine.subscriber_count == 1
        samples = engine.run(5)
        assert q.qsize() == 3
        got = [q.get_nowait() for _ in range(3)]
        assert got == samples[-3:]
        engine.unsubscribe(q)
        engine.unsubscribe(q)  # idempotent
        assert engine.subscriber_count == 0
        engine.step()
        assert q.empty()

    asyncio.run(scenario())


def test_publish_from_worker_thread_reaches_loop_queue() -> None:
    async def scenario() -> None:
        engine = EMSEngine(demo_warehouse(), mode=ControlMode.IDLE)
        q = engine.subscribe()
        t = await asyncio.to_thread(engine.step)
        assert await asyncio.wait_for(q.get(), timeout=2) == t

    asyncio.run(scenario())


# --------------------------------------------------------------------------- background loop

def test_background_loop_start_pause_stop() -> None:
    async def scenario() -> None:
        # 300 s steps at 30000x => one step every 10 ms of real time.
        engine = EMSEngine(demo_warehouse(), mode=ControlMode.SELF_CONSUMPTION,
                           sim_speed=30000)
        q = engine.subscribe()
        task = engine.start()
        assert engine.start() is task  # idempotent
        assert engine.running and engine.is_looping
        await asyncio.wait_for(q.get(), timeout=5)
        for _ in range(200):
            if len(engine.history()) >= 3:
                break
            await asyncio.sleep(0.02)
        assert len(engine.history()) >= 3

        # mode switch and reset are safe while running
        engine.set_mode(ControlMode.PEAK_SHAVING)
        engine.reset()
        await asyncio.sleep(0.1)
        assert all(t.mode == ControlMode.PEAK_SHAVING for t in engine.history())

        engine.set_running(False)
        await asyncio.sleep(0.15)
        n = len(engine.history())
        await asyncio.sleep(0.15)
        assert len(engine.history()) == n
        assert engine.is_looping

        await engine.stop()
        assert not engine.running and not engine.is_looping
        await engine.stop()  # idempotent

    asyncio.run(scenario())


def test_background_loop_survives_step_errors() -> None:
    async def scenario() -> None:
        engine = EMSEngine(demo_warehouse(), mode=ControlMode.IDLE, sim_speed=30000)
        original = engine.step
        failures = {"n": 0}

        def flaky():
            if failures["n"] == 0:
                failures["n"] += 1
                raise RuntimeError("boom")
            return original()

        engine.step = flaky  # type: ignore[method-assign]
        engine.start()
        for _ in range(200):
            if engine.history():
                break
            await asyncio.sleep(0.02)
        await engine.stop()
        assert failures["n"] == 1
        assert engine.history()

    asyncio.run(scenario())


# --------------------------------------------------------------------------- CLI

def test_cli_simulate_smoke() -> None:
    proc = subprocess.run([sys.executable, "-m", "ems", "simulate", "--days", "1"],
                          cwd=REPO_ROOT, capture_output=True, text=True, timeout=180)
    assert proc.returncode == 0, proc.stderr
    out = proc.stdout
    for mode in ControlMode:
        assert mode.value in out
    assert "Cost (GBP)" in out and "Savings (GBP)" in out
    assert "Battery SoC start -> end" in out


def test_cli_simulate_runs_report_soc_and_inventory() -> None:
    from ems.__main__ import simulate_runs
    runs = simulate_runs("demo-office", 0.25, ControlMode.TOU_ARBITRAGE, step_seconds=900)
    idle, tou = runs["idle"], runs["tou_arbitrage"]
    cfg = demo_office()
    assert idle.soc_start == pytest.approx(cfg.battery.initial_soc)
    assert idle.soc_end == pytest.approx(idle.soc_start)
    assert idle.inventory_value_gbp == 0.0
    # The stored-energy change matches the SoC change.
    assert tou.stored_delta_kwh == pytest.approx(
        (tou.soc_end - tou.soc_start) * cfg.battery.capacity_kwh, abs=1e-6)
    k = tou.kpis
    assert k.savings_gbp == pytest.approx(k.baseline_cost_gbp - k.cost_gbp + tou.inventory_value_gbp)


def test_cli_simulate_single_mode_includes_idle_baseline() -> None:
    from ems.__main__ import simulate
    results = simulate("demo-office", 0.25, ControlMode.TOU_ARBITRAGE, step_seconds=900)
    assert list(results) == ["idle", "tou_arbitrage"]
    assert results["idle"].hours == pytest.approx(6.0)


def test_cli_rejects_bad_args() -> None:
    from ems.__main__ import build_parser
    parser = build_parser()
    for argv in (["simulate", "--days", "0"], ["simulate", "--mode", "turbo"],
                 ["simulate", "--site", "nowhere"], ["serve", "--speed", "0"], []):
        with pytest.raises(SystemExit):
            parser.parse_args(argv)
    args = parser.parse_args(["simulate", "--mode", "optimised", "--days", "2"])
    assert args.mode == ControlMode.OPTIMISED and args.days == 2
