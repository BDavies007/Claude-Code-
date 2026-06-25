"""Deterministic lead generation.

Builds a list of :class:`Lead` records: the curated real consumers first (flagged
``public-estimate``), then synthetic records drawn from the benchmark
distributions in :mod:`lead_gen.benchmarks`. Given a fixed seed, output is
fully reproducible.
"""

from __future__ import annotations

import random
from typing import List, Optional

from . import benchmarks as bm
from .schema import DataQuality, Lead, Region, Sector

DEFAULT_SEED = 42


# --------------------------------------------------------------------------- #
# Curated real consumers
# --------------------------------------------------------------------------- #
def build_curated_leads() -> List[Lead]:
    """Materialize the curated real-consumer seed list into Lead objects.

    Grid carbon and ESG pressure come from the region benchmarks; consumption,
    renewable % and renewal months come from the curated seed tuple. Every record
    is flagged ``data_quality = "public-estimate"``.
    """
    leads: List[Lead] = []
    for i, (org, sector, region, country, mwh, renewable, renewal_months) in enumerate(
        bm.CURATED_REAL_CONSUMERS, start=1
    ):
        leads.append(
            Lead(
                id=f"REAL-{i:04d}",
                organization=org,
                sector=sector.value,
                region=region.value,
                country=country,
                annual_consumption_mwh=float(mwh),
                current_renewable_pct=float(renewable),
                grid_carbon_intensity_gco2_kwh=bm.REGION_GRID_CARBON_GCO2_KWH[region],
                esg_pressure=bm.REGION_ESG_PRESSURE[region],
                contract_renewal_months=float(renewal_months),
                data_quality=DataQuality.PUBLIC_ESTIMATE.value,
            )
        )
    return leads


# --------------------------------------------------------------------------- #
# Weighted choice helpers (seeded RNG)
# --------------------------------------------------------------------------- #
def _weighted_choice(rng: random.Random, weights: dict):
    keys = list(weights.keys())
    vals = [weights[k] for k in keys]
    return rng.choices(keys, weights=vals, k=1)[0]


def _triangular_consumption(rng: random.Random, sector: Sector) -> float:
    low, typical, high = bm.SECTOR_CONSUMPTION_MWH[sector]
    # Triangular draw skewed toward the typical value; clamp into [low, high].
    val = rng.triangular(low, high, typical)
    return float(max(low, min(high, val)))


def _renewable_pct(rng: random.Random, sector: Sector) -> float:
    lo, hi = bm.SECTOR_RENEWABLE_PCT[sector]
    return round(rng.uniform(lo, hi), 1)


def _grid_carbon(rng: random.Random, region: Region) -> float:
    base = bm.REGION_GRID_CARBON_GCO2_KWH[region]
    # +/- 12% jitter around the regional average.
    return round(base * rng.uniform(0.88, 1.12), 1)


def _esg_pressure(rng: random.Random, region: Region) -> float:
    base = bm.REGION_ESG_PRESSURE[region]
    return round(max(0.0, min(1.0, base + rng.uniform(-0.1, 0.1))), 3)


def _renewal_months(rng: random.Random) -> float:
    # Most contracts sit 0-60 months out; bias toward mid-range with a triangular.
    return round(rng.triangular(0.0, 60.0, 18.0), 1)


def build_synthetic_leads(count: int, rng: random.Random, *, start_index: int = 1) -> List[Lead]:
    """Generate ``count`` clearly-labelled synthetic leads using benchmarks."""
    leads: List[Lead] = []
    for i in range(start_index, start_index + count):
        sector = _weighted_choice(rng, bm.SECTOR_WEIGHT)
        region = _weighted_choice(rng, bm.REGION_WEIGHT)
        country = rng.choice(bm.REGION_COUNTRIES[region])
        stem = rng.choice(bm.SECTOR_NAME_STEMS[sector])
        # Clearly generic / templated name so it is never mistaken for a real firm.
        org = f"{region.value.split('(')[0].strip()} {stem} {i:04d}"

        leads.append(
            Lead(
                id=f"SYN-{i:06d}",
                organization=org,
                sector=sector.value,
                region=region.value,
                country=country,
                annual_consumption_mwh=round(_triangular_consumption(rng, sector), 1),
                current_renewable_pct=_renewable_pct(rng, sector),
                grid_carbon_intensity_gco2_kwh=_grid_carbon(rng, region),
                esg_pressure=_esg_pressure(rng, region),
                contract_renewal_months=_renewal_months(rng),
                data_quality=DataQuality.SYNTHETIC.value,
            )
        )
    return leads


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #
def generate_leads(count: int = 10_000, seed: Optional[int] = DEFAULT_SEED) -> List[Lead]:
    """Generate exactly ``count`` leads: curated reals first, then synthetic.

    Deterministic for a given ``seed``. If ``count`` is smaller than the curated
    set, only the first ``count`` curated records are returned.
    """
    if count <= 0:
        return []

    rng = random.Random(seed)
    curated = build_curated_leads()

    if count <= len(curated):
        return curated[:count]

    synthetic_needed = count - len(curated)
    synthetic = build_synthetic_leads(synthetic_needed, rng, start_index=1)
    return curated + synthetic
