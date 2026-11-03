"""Built-in site presets. Generic demo sites only — no real customer data."""
from __future__ import annotations

from .models import (BatteryConfig, EVConfig, GridConfig, LoadConfig, PVConfig,
                     SiteConfig, Tariff, TariffBand)

UK_COMMERCIAL_TOU = Tariff(
    bands=[
        TariffBand(name="night", start_hour=0, end_hour=7, import_price_gbp_per_kwh=0.15),
        TariffBand(name="day", start_hour=7, end_hour=16, import_price_gbp_per_kwh=0.24),
        TariffBand(name="peak", start_hour=16, end_hour=19, import_price_gbp_per_kwh=0.38),
        TariffBand(name="evening", start_hour=19, end_hour=24, import_price_gbp_per_kwh=0.24),
    ],
    export_price_gbp_per_kwh=0.08,
    demand_charge_gbp_per_kw_month=4.50,
    standing_charge_gbp_per_day=6.00,
    carbon_kg_per_kwh=0.207,
)


def demo_warehouse() -> SiteConfig:
    """A mid-sized logistics warehouse with rooftop PV, a BESS and fleet charging."""
    return SiteConfig(
        site_id="demo-warehouse",
        name="Demo Logistics Warehouse",
        pv=PVConfig(capacity_kwp=500),
        battery=BatteryConfig(capacity_kwh=500, max_charge_kw=250, max_discharge_kw=250),
        load=LoadConfig(profile="warehouse", base_load_kw=80, peak_load_kw=320),
        ev=EVConfig(num_chargers=8, charger_kw=22, sessions_per_day=12, kwh_per_session=40),
        grid=GridConfig(import_limit_kw=500, export_limit_kw=200),
        tariff=UK_COMMERCIAL_TOU,
        peak_target_kw=300,
    )


def demo_office() -> SiteConfig:
    return SiteConfig(
        site_id="demo-office",
        name="Demo Office Campus",
        pv=PVConfig(capacity_kwp=150),
        battery=BatteryConfig(capacity_kwh=200, max_charge_kw=100, max_discharge_kw=100),
        load=LoadConfig(profile="office", base_load_kw=25, peak_load_kw=140),
        ev=EVConfig(num_chargers=4, charger_kw=7.4, sessions_per_day=6, kwh_per_session=20),
        grid=GridConfig(import_limit_kw=200, export_limit_kw=50),
        tariff=UK_COMMERCIAL_TOU,
        peak_target_kw=110,
    )


PRESETS = {"demo-warehouse": demo_warehouse, "demo-office": demo_office}
