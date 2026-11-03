"""Tests for ems.reporting with hand-computed expectations."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from ems.models import (BatteryConfig, ControlMode, GridConfig, LoadConfig, PVConfig,
                        SiteConfig, Tariff, TariffBand, Telemetry)
from ems.reporting import compare_kpis, compute_kpis

T0 = datetime(2026, 6, 1, tzinfo=timezone.utc)
HOUR = 3600.0


def make_config(*, import_price: float = 0.20, export_price: float = 0.05,
                demand: float = 0.0, standing: float = 0.0, export_limit: float = 100.0,
                carbon: float = 0.2, capacity: float = 10.0) -> SiteConfig:
    return SiteConfig(
        site_id="t", name="Test", timezone="UTC",
        pv=PVConfig(capacity_kwp=10),
        battery=BatteryConfig(capacity_kwh=capacity, max_charge_kw=5, max_discharge_kw=5),
        load=LoadConfig(base_load_kw=1, peak_load_kw=5),
        grid=GridConfig(import_limit_kw=100, export_limit_kw=export_limit),
        tariff=Tariff(
            bands=[TariffBand(name="flat", start_hour=0, end_hour=24,
                              import_price_gbp_per_kwh=import_price)],
            export_price_gbp_per_kwh=export_price,
            demand_charge_gbp_per_kw_month=demand,
            standing_charge_gbp_per_day=standing,
            carbon_kg_per_kwh=carbon,
        ),
    )


def sample(i: int, *, pv: float = 0.0, load: float = 0.0, ev: float = 0.0,
           battery: float = 0.0, curtailed: float = 0.0, price: float = 0.20,
           export_price: float = 0.05, step: float = HOUR) -> Telemetry:
    grid = load + ev - pv - battery
    return Telemetry(
        timestamp=T0 + timedelta(seconds=i * step), pv_kw=pv, pv_curtailed_kw=curtailed,
        load_kw=load, ev_kw=ev, battery_kw=battery, battery_soc=0.5, grid_kw=grid,
        import_price_gbp_per_kwh=price, export_price_gbp_per_kwh=export_price,
        mode=ControlMode.IDLE,
    )


def test_empty_history_raises() -> None:
    with pytest.raises(ValueError):
        compute_kpis([], make_config(), HOUR)


def test_nonpositive_step_raises() -> None:
    with pytest.raises(ValueError):
        compute_kpis([sample(0, load=1)], make_config(), 0)


def test_pure_import() -> None:
    # 2 h at 10 kW load, no PV: 20 kWh import @0.20 = 4.00
    hist = [sample(0, load=10), sample(1, load=10)]
    k = compute_kpis(hist, make_config(), HOUR)
    assert k.hours == pytest.approx(2.0)
    assert k.period_start == T0
    assert k.period_end == T0 + timedelta(hours=2)
    assert k.energy_import_kwh == pytest.approx(20.0)
    assert k.energy_export_kwh == pytest.approx(0.0)
    assert k.load_kwh == pytest.approx(20.0)
    assert k.cost_gbp == pytest.approx(4.0)
    assert k.baseline_cost_gbp == pytest.approx(4.0)
    assert k.savings_gbp == pytest.approx(0.0)
    assert k.self_sufficiency_pct == pytest.approx(0.0)
    assert k.peak_import_kw == pytest.approx(10.0)


def test_pure_export() -> None:
    # 1 h PV 8 kW, load 2 kW -> export 6 kWh @0.05 = -0.30
    k = compute_kpis([sample(0, pv=8, load=2)], make_config(), HOUR)
    assert k.energy_import_kwh == pytest.approx(0.0)
    assert k.energy_export_kwh == pytest.approx(6.0)
    assert k.pv_generation_kwh == pytest.approx(8.0)
    assert k.cost_gbp == pytest.approx(-0.30)
    assert k.self_consumption_pct == pytest.approx(25.0)   # 2/8
    assert k.self_sufficiency_pct == pytest.approx(100.0)
    assert k.peak_import_kw == pytest.approx(0.0)


def test_battery_shifting_saves_vs_baseline() -> None:
    # Hour 0: PV 6, load 2, battery charges 4 -> grid 0 (baseline exports 4 @0.05)
    # Hour 1: PV 0, load 4, battery discharges 4 -> grid 0 (baseline imports 4 @0.30)
    hist = [sample(0, pv=6, load=2, battery=-4, price=0.30),
            sample(1, load=4, battery=4, price=0.30)]
    k = compute_kpis(hist, make_config(), HOUR)
    assert k.cost_gbp == pytest.approx(0.0)
    assert k.baseline_cost_gbp == pytest.approx(4 * 0.30 - 4 * 0.05)  # 1.00
    assert k.savings_gbp == pytest.approx(1.00)
    assert k.self_consumption_pct == pytest.approx(100.0)
    assert k.self_sufficiency_pct == pytest.approx(100.0)
    assert k.battery_throughput_kwh == pytest.approx(4.0)
    assert k.battery_equivalent_cycles == pytest.approx(0.4)
    assert k.peak_import_kw == pytest.approx(0.0)
    assert k.baseline_peak_import_kw == pytest.approx(4.0)


def test_demand_charge_proration() -> None:
    # 4 x 15 min samples, peak 20 kW, demand 7.30/kW-month over 1 h:
    # demand = 7.30 * 20 * 1/730 = 0.20 ; energy = (10+20+10+10)*0.25*0.20 = 2.50
    step = 900.0
    loads = [10, 20, 10, 10]
    hist = [sample(i, load=v, step=step) for i, v in enumerate(loads)]
    k = compute_kpis(hist, make_config(demand=7.30), step)
    assert k.hours == pytest.approx(1.0)
    assert k.energy_import_kwh == pytest.approx(12.5)
    assert k.cost_gbp == pytest.approx(2.50 + 0.20)


def test_standing_charge() -> None:
    # 6 h at 0 kW, standing 4.00/day -> 1.00
    hist = [sample(i) for i in range(6)]
    k = compute_kpis(hist, make_config(standing=4.0), HOUR)
    assert k.cost_gbp == pytest.approx(1.0)
    assert k.baseline_cost_gbp == pytest.approx(1.0)
    assert k.savings_gbp == pytest.approx(0.0)


def test_peak_shaving_vs_baseline_peak_and_demand_savings() -> None:
    # Load 50 kW, battery discharges 20 -> grid 30. Baseline peak 50.
    hist = [sample(0, load=50, battery=20, price=0.0), sample(1, load=10, price=0.0)]
    k = compute_kpis(hist, make_config(demand=73.0), HOUR)
    assert k.peak_import_kw == pytest.approx(30.0)
    assert k.baseline_peak_import_kw == pytest.approx(50.0)
    # demand: 73 * peak * 2/730 = 0.2 * peak
    assert k.cost_gbp == pytest.approx(6.0)
    assert k.baseline_cost_gbp == pytest.approx(10.0)
    assert k.savings_gbp == pytest.approx(4.0)


def test_zero_pv_and_zero_demand_percentages() -> None:
    k = compute_kpis([sample(0), sample(1)], make_config(), HOUR)
    assert k.self_consumption_pct == 0.0
    assert k.self_sufficiency_pct == 0.0
    assert k.pv_generation_kwh == 0.0
    assert k.battery_equivalent_cycles == 0.0


def test_curtailment_counted_and_baseline_capped() -> None:
    # Available PV 10 = 6 delivered + 4 curtailed; load 1, battery charges 3 -> export 2 (= limit)
    # Baseline: 1 - 10 = -9 -> capped at -2 export.
    cfg = make_config(export_limit=2.0)
    k = compute_kpis([sample(0, pv=6, curtailed=4, load=1, battery=-3)], cfg, HOUR)
    assert k.pv_generation_kwh == pytest.approx(6.0)
    assert k.pv_curtailed_kwh == pytest.approx(4.0)
    assert k.energy_export_kwh == pytest.approx(2.0)
    assert k.self_consumption_pct == pytest.approx(4 / 6 * 100)
    assert k.cost_gbp == pytest.approx(-0.10)
    assert k.baseline_cost_gbp == pytest.approx(-0.10)  # baseline export also capped at 2


def test_baseline_uses_available_pv() -> None:
    # Battery charging caused no curtailment, but simulator curtailed 2 kW anyway:
    # baseline should see PV 5 (3+2) against load 5 -> zero import.
    k = compute_kpis([sample(0, pv=3, curtailed=2, load=5)], make_config(), HOUR)
    assert k.energy_import_kwh == pytest.approx(2.0)
    assert k.baseline_peak_import_kw == pytest.approx(0.0)
    assert k.baseline_cost_gbp == pytest.approx(0.0)


def test_co2() -> None:
    # import 5 kWh vs baseline 8 kWh at 0.2 kg/kWh
    hist = [sample(0, load=8, battery=3)]
    k = compute_kpis(hist, make_config(carbon=0.2), HOUR)
    assert k.co2_kg == pytest.approx(1.0)
    assert k.baseline_co2_kg == pytest.approx(1.6)


def test_self_sufficiency_partial_with_ev() -> None:
    # load 6 + ev 4 = 10 demand, pv 4 -> import 6 -> 40 % self-sufficient
    k = compute_kpis([sample(0, pv=4, load=6, ev=4)], make_config(), HOUR)
    assert k.load_kwh == pytest.approx(10.0)
    assert k.self_sufficiency_pct == pytest.approx(40.0)
    assert k.self_consumption_pct == pytest.approx(100.0)


def test_grid_charging_clamps_self_sufficiency() -> None:
    # load 2, battery charges 5 from grid -> import 7 > demand -> clamp to 0
    k = compute_kpis([sample(0, load=2, battery=-5)], make_config(), HOUR)
    assert k.self_sufficiency_pct == 0.0
    assert k.battery_throughput_kwh == 0.0


def test_compare_kpis_table() -> None:
    a = compute_kpis([sample(0, load=10)], make_config(), HOUR)
    b = compute_kpis([sample(0, load=10, battery=5)], make_config(), HOUR)
    text = compare_kpis({"idle": a, "optimised": b})
    lines = text.splitlines()
    assert lines[0].split() == ["Metric", "idle", "optimised"]
    assert set(lines[1].replace(" ", "")) == {"-"}
    cost_line = next(line for line in lines if line.startswith("Cost (GBP)"))
    assert cost_line.split()[-2:] == ["2.00", "1.00"]
    assert any(line.startswith("Savings (GBP)") for line in lines)
    widths = {len(line) for line in lines[2:]}
    assert max(widths) == len(lines[1])  # columns align to the rule
    assert compare_kpis({}) == "(no results)"
