"""The lead scoring model.

Produces a 0-100 ``lead_score`` as a weighted, normalized blend of seven
signals, then derives tier, opportunity value, recommended offering and a short
rationale. All weights are named constants and asserted to sum to 1.0.
"""

from __future__ import annotations

import math
from typing import Dict, Tuple

from .benchmarks import (
    SECTOR_ADDRESSABLE_SHARE,
    SECTOR_FIT_WEIGHT,
    VALUE_PER_MWH_USD,
)
from .schema import BuyingStage, Lead, Sector, Tier

# --------------------------------------------------------------------------- #
# Scoring weights (must sum to 1.0)
# --------------------------------------------------------------------------- #
W_CONSUMPTION = 0.30          # consumption volume (log-scaled)
W_DECARB_GAP = 0.20           # 100 - renewable%
W_GRID_CARBON = 0.15          # dirtier grid -> more to gain by greening
W_SECTOR_FIT = 0.10           # sector tractability / fit for our offerings
W_ESG_PRESSURE = 0.10         # regulatory / investor pressure
W_BUYING_WINDOW = 0.10        # nearer contract renewal -> hotter
W_FINANCIAL_CAPACITY = 0.05   # ability-to-pay proxy

WEIGHTS: Dict[str, float] = {
    "consumption": W_CONSUMPTION,
    "decarbonization_gap": W_DECARB_GAP,
    "grid_carbon": W_GRID_CARBON,
    "sector_fit": W_SECTOR_FIT,
    "esg_pressure": W_ESG_PRESSURE,
    "buying_window": W_BUYING_WINDOW,
    "financial_capacity": W_FINANCIAL_CAPACITY,
}

# Fail fast if the model is ever mis-edited.
assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9, "scoring weights must sum to 1.0"

# Tier thresholds.
TIER_A_THRESHOLD = 70.0
TIER_B_THRESHOLD = 50.0

# Normalization anchors for the log-scaled consumption signal. A facility at or
# below LOW maps to ~0; at or above HIGH maps to ~1.
CONSUMPTION_LOG_LOW_MWH = 50_000.0
CONSUMPTION_LOG_HIGH_MWH = 60_000_000.0

# Grid carbon intensity normalization anchors (gCO2/kWh).
GRID_CARBON_LOW = 50.0
GRID_CARBON_HIGH = 750.0

# Buying-window: months until renewal mapped to a 0-1 "hotness" (nearer = hotter).
RENEWAL_HOT_MONTHS = 3.0    # <= this -> ~1.0 (in window now)
RENEWAL_COLD_MONTHS = 36.0  # >= this -> ~0.0 (long horizon)


# --------------------------------------------------------------------------- #
# Component normalizers (each returns a value in [0, 1])
# --------------------------------------------------------------------------- #
def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def consumption_signal(mwh: float) -> float:
    """Log-scaled consumption volume normalized to [0, 1]."""
    mwh = max(mwh, 1.0)
    lo = math.log10(CONSUMPTION_LOG_LOW_MWH)
    hi = math.log10(CONSUMPTION_LOG_HIGH_MWH)
    return _clamp01((math.log10(mwh) - lo) / (hi - lo))


def decarb_gap_signal(renewable_pct: float) -> float:
    """Decarbonization gap = (100 - renewable%) / 100, in [0, 1]."""
    return _clamp01((100.0 - renewable_pct) / 100.0)


def grid_carbon_signal(gco2_kwh: float) -> float:
    """Grid carbon intensity normalized to [0, 1]."""
    return _clamp01((gco2_kwh - GRID_CARBON_LOW) / (GRID_CARBON_HIGH - GRID_CARBON_LOW))


def sector_fit_signal(sector: Sector) -> float:
    """Sector tractability / fit, already in [0, 1]."""
    return _clamp01(SECTOR_FIT_WEIGHT.get(sector, 0.5))


def esg_signal(esg_pressure: float) -> float:
    """ESG / regulatory pressure, already in [0, 1]."""
    return _clamp01(esg_pressure)


def buying_window_signal(renewal_months: float) -> float:
    """Map months-to-renewal to [0, 1] hotness (nearer = hotter)."""
    if renewal_months <= RENEWAL_HOT_MONTHS:
        return 1.0
    if renewal_months >= RENEWAL_COLD_MONTHS:
        return 0.0
    span = RENEWAL_COLD_MONTHS - RENEWAL_HOT_MONTHS
    return _clamp01(1.0 - (renewal_months - RENEWAL_HOT_MONTHS) / span)


def financial_capacity_signal(mwh: float, sector: Sector) -> float:
    """Ability-to-pay proxy: blends scale (log consumption) with sector value.

    Larger consumers and higher-addressable-share sectors are assumed to have
    more budget for green procurement. Returns [0, 1].
    """
    scale = consumption_signal(mwh)
    share = SECTOR_ADDRESSABLE_SHARE.get(sector, 0.4)
    return _clamp01(0.6 * scale + 0.4 * share)


# --------------------------------------------------------------------------- #
# Buying stage
# --------------------------------------------------------------------------- #
def derive_buying_stage(renewal_months: float) -> BuyingStage:
    if renewal_months <= 6:
        return BuyingStage.IN_RENEWAL_WINDOW
    if renewal_months <= 18:
        return BuyingStage.EVALUATING
    if renewal_months <= 36:
        return BuyingStage.EARLY
    return BuyingStage.LOCKED_IN


# --------------------------------------------------------------------------- #
# Opportunity value
# --------------------------------------------------------------------------- #
def opportunity_value(mwh: float, sector: Sector, renewable_pct: float) -> float:
    """Estimate annual opportunity value (USD).

    = consumption x addressable share x (decarbonization gap) x value-per-MWh.
    Scaling by the decarbonization gap reflects that already-green consumers
    have less *incremental* opportunity for our offerings.
    """
    share = SECTOR_ADDRESSABLE_SHARE.get(sector, 0.4)
    gap = decarb_gap_signal(renewable_pct)
    # Floor the gap so even green leaders retain some residual opportunity.
    effective_gap = 0.25 + 0.75 * gap
    return mwh * share * effective_gap * VALUE_PER_MWH_USD


# --------------------------------------------------------------------------- #
# Offering recommendation
# --------------------------------------------------------------------------- #
def recommend_offering(lead: Lead, sector: Sector) -> str:
    """Map sector + profile to a primary recommended offering."""
    renewable = lead.current_renewable_pct
    mwh = lead.annual_consumption_mwh
    grid = lead.grid_carbon_intensity_gco2_kwh

    # Very large, dirty-grid loads -> Corporate PPA is the headline lever.
    if mwh >= 3_000_000 and renewable < 50 and grid >= 350:
        return "Corporate PPA"
    if sector in (Sector.DATA_CENTER, Sector.SEMICONDUCTOR) and renewable < 70:
        return "Corporate PPA"
    if sector in (Sector.RETAIL, Sector.LOGISTICS) and renewable < 60:
        return "On-site Solar"
    if sector in (Sector.STEEL, Sector.CEMENT, Sector.ALUMINIUM, Sector.OIL_AND_GAS):
        # Hard-to-abate: advisory-led entry, then storage/efficiency.
        if renewable < 20:
            return "Decarbonization Advisory"
        return "Battery Storage"
    if sector == Sector.AUTOMOTIVE:
        return "EV Fleet Electrification"
    if renewable >= 70:
        return "RECs"
    if grid >= 500:
        return "Corporate PPA"
    return "Energy Efficiency Retrofit"


def build_rationale(lead: Lead, components: Dict[str, float]) -> str:
    """Short human-readable explanation of why the lead scored as it did."""
    parts = []
    parts.append(f"{lead.annual_consumption_mwh:,.0f} MWh/yr")
    gap = 100.0 - lead.current_renewable_pct
    parts.append(f"{gap:.0f}% decarbonization gap")
    parts.append(f"grid {lead.grid_carbon_intensity_gco2_kwh:.0f} gCO2/kWh")
    stage = derive_buying_stage(lead.contract_renewal_months)
    parts.append(f"{stage.value.lower()} (~{lead.contract_renewal_months:.0f} mo to renewal)")
    parts.append(f"ESG pressure {lead.esg_pressure_label.lower()}")
    return "; ".join(parts) + "."


# --------------------------------------------------------------------------- #
# Top-level scoring entry point
# --------------------------------------------------------------------------- #
def score_components(lead: Lead) -> Dict[str, float]:
    """Return the seven normalized [0,1] signal components for ``lead``."""
    sector = _sector_of(lead)
    return {
        "consumption": consumption_signal(lead.annual_consumption_mwh),
        "decarbonization_gap": decarb_gap_signal(lead.current_renewable_pct),
        "grid_carbon": grid_carbon_signal(lead.grid_carbon_intensity_gco2_kwh),
        "sector_fit": sector_fit_signal(sector),
        "esg_pressure": esg_signal(lead.esg_pressure),
        "buying_window": buying_window_signal(lead.contract_renewal_months),
        "financial_capacity": financial_capacity_signal(lead.annual_consumption_mwh, sector),
    }


def compute_lead_score(lead: Lead) -> Tuple[float, Dict[str, float]]:
    """Compute the 0-100 weighted lead score and return (score, components)."""
    comps = score_components(lead)
    raw = sum(comps[k] * WEIGHTS[k] for k in WEIGHTS)  # in [0,1]
    return _clamp01(raw) * 100.0, comps


def score_to_tier(score: float) -> Tier:
    if score >= TIER_A_THRESHOLD:
        return Tier.A
    if score >= TIER_B_THRESHOLD:
        return Tier.B
    return Tier.C


def _sector_of(lead: Lead) -> Sector:
    """Resolve a Lead.sector string back to the Sector enum (tolerant)."""
    for s in Sector:
        if lead.sector == s.value or lead.sector == s.name:
            return s
    return Sector.CHEMICALS  # neutral fallback


def score_lead(lead: Lead) -> Lead:
    """Score a single lead *in place* and return it (filled scored fields)."""
    sector = _sector_of(lead)
    score, comps = compute_lead_score(lead)
    lead.lead_score = round(score, 2)
    lead.tier = score_to_tier(score).value
    lead.buying_stage = derive_buying_stage(lead.contract_renewal_months).value
    lead.estimated_annual_opportunity_value = round(
        opportunity_value(lead.annual_consumption_mwh, sector, lead.current_renewable_pct), 2
    )
    lead.recommended_offering = recommend_offering(lead, sector)
    lead.rationale = build_rationale(lead, comps)
    return lead


def score_all(leads) -> list:
    """Score every lead in an iterable (in place); returns the list."""
    out = list(leads)
    for lead in out:
        score_lead(lead)
    return out
