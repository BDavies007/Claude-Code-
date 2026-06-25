"""Core data model: the :class:`Lead` dataclass and supporting enums.

Everything here is standard-library only. The :class:`Lead` carries both the
raw *input* attributes (consumption, renewable mix, grid carbon, etc.) and the
*scored* attributes filled in later by :mod:`lead_gen.scoring`.
"""

from __future__ import annotations

import csv
from dataclasses import asdict, dataclass, field, fields
from enum import Enum
from typing import Any, Dict, Iterable, List, Optional


class Sector(str, Enum):
    """High-energy industrial / commercial sectors we target."""

    DATA_CENTER = "Data Center / Hyperscaler"
    SEMICONDUCTOR = "Semiconductor"
    STEEL = "Steel"
    ALUMINIUM = "Aluminium"
    CEMENT = "Cement"
    CHEMICALS = "Chemicals"
    MINING = "Mining & Metals"
    AUTOMOTIVE = "Automotive Manufacturing"
    RETAIL = "Retail / E-commerce"
    TELECOM = "Telecom"
    OIL_AND_GAS = "Oil & Gas"
    PAPER = "Pulp & Paper"
    FOOD_BEVERAGE = "Food & Beverage"
    PHARMA = "Pharmaceuticals"
    LOGISTICS = "Logistics & Warehousing"


class Region(str, Enum):
    """Coarse geographic / grid regions."""

    NORTH_AMERICA = "North America"
    EUROPE = "Europe"
    CHINA = "China"
    INDIA = "India"
    EAST_ASIA = "East Asia (ex-China)"
    SOUTHEAST_ASIA = "Southeast Asia"
    MIDDLE_EAST = "Middle East"
    LATIN_AMERICA = "Latin America"
    AFRICA = "Africa"
    OCEANIA = "Oceania"


class BuyingStage(str, Enum):
    """Where a prospect sits in the procurement / buying window."""

    IN_RENEWAL_WINDOW = "In Renewal Window"  # contract up for renewal soon -> hot
    EVALUATING = "Evaluating"
    EARLY = "Early / Long Horizon"
    LOCKED_IN = "Locked-in (long contract)"


class Tier(str, Enum):
    """Lead priority tier derived from the lead score."""

    A = "A"  # score >= 70
    B = "B"  # 50 - 69
    C = "C"  # < 50


class DataQuality(str, Enum):
    """Provenance of a record. Critical for honesty / data integrity."""

    PUBLIC_ESTIMATE = "public-estimate"  # real, publicly-estimable consumer
    SYNTHETIC = "synthetic"  # generated from benchmark distributions
    USER_PROVIDED = "user-provided"  # ingested from a user-supplied CSV


# Recommended offerings (kept as plain strings for easy CSV/JSON round-trip).
OFFERINGS = [
    "Corporate PPA",
    "On-site Solar",
    "Battery Storage",
    "Energy Efficiency Retrofit",
    "RECs",
    "Decarbonization Advisory",
    "EV Fleet Electrification",
]


@dataclass
class Lead:
    """A single prospect organization (real or synthetic).

    Input fields describe the organization's energy / decarbonization profile.
    Scored fields (``lead_score`` onward) are populated by the scoring model and
    default to neutral/empty values until then.
    """

    # --- identity / classification ---
    id: str
    organization: str
    sector: str
    region: str
    country: str

    # --- energy / decarbonization profile (scoring inputs) ---
    annual_consumption_mwh: float
    current_renewable_pct: float  # 0-100
    grid_carbon_intensity_gco2_kwh: float
    esg_pressure: float  # normalized 0-1 (see esg_pressure_label for Low/Med/High)
    contract_renewal_months: float  # months until next contract renewal
    data_quality: str  # one of DataQuality values

    # --- scored / derived fields ---
    lead_score: float = 0.0  # 0-100
    tier: str = ""  # A / B / C
    buying_stage: str = ""
    estimated_annual_opportunity_value: float = 0.0  # USD
    recommended_offering: str = ""
    rationale: str = ""

    # ------------------------------------------------------------------ #
    # Convenience helpers
    # ------------------------------------------------------------------ #
    @property
    def esg_pressure_label(self) -> str:
        """Human-friendly Low/Med/High bucket for the 0-1 ESG pressure value."""
        if self.esg_pressure >= 0.66:
            return "High"
        if self.esg_pressure >= 0.33:
            return "Medium"
        return "Low"

    def to_dict(self) -> Dict[str, Any]:
        """Flat dict suitable for JSON / CSV export (adds the ESG label)."""
        d = asdict(self)
        d["esg_pressure_label"] = self.esg_pressure_label
        return d

    @classmethod
    def field_names(cls) -> List[str]:
        """Ordered list of dataclass field names (export column order)."""
        return [f.name for f in fields(cls)]


# --------------------------------------------------------------------------- #
# CSV ingestion / round-trip helpers
# --------------------------------------------------------------------------- #

# Columns a user CSV must provide to be scored. Scored columns are optional.
REQUIRED_INPUT_COLUMNS = [
    "organization",
    "sector",
    "region",
    "country",
    "annual_consumption_mwh",
    "current_renewable_pct",
    "grid_carbon_intensity_gco2_kwh",
    "esg_pressure",
    "contract_renewal_months",
]

_FLOAT_FIELDS = {
    "annual_consumption_mwh",
    "current_renewable_pct",
    "grid_carbon_intensity_gco2_kwh",
    "esg_pressure",
    "contract_renewal_months",
    "lead_score",
    "estimated_annual_opportunity_value",
}


def _coerce(name: str, value: Any) -> Any:
    """Coerce a raw CSV string into the appropriate Python type for ``name``."""
    if value is None or value == "":
        return 0.0 if name in _FLOAT_FIELDS else ""
    if name in _FLOAT_FIELDS:
        return float(value)
    return value


def lead_from_row(row: Dict[str, str], *, fallback_id: str) -> Lead:
    """Build a :class:`Lead` from a (possibly partial) CSV row.

    Missing optional/scored columns are defaulted. ``data_quality`` defaults to
    ``user-provided`` when ingesting external CSVs. Raises ``KeyError`` if a
    required input column is absent.
    """
    for col in REQUIRED_INPUT_COLUMNS:
        if col not in row or row[col] in (None, ""):
            raise KeyError(f"missing required column: {col}")

    valid = set(Lead.field_names())
    kwargs: Dict[str, Any] = {}
    for name in valid:
        if name in row and row[name] not in (None, ""):
            kwargs[name] = _coerce(name, row[name])

    kwargs.setdefault("id", row.get("id") or fallback_id)
    kwargs.setdefault("data_quality", DataQuality.USER_PROVIDED.value)
    return Lead(**kwargs)  # type: ignore[arg-type]


def read_leads_csv(path: str) -> List[Lead]:
    """Read a CSV of prospects into a list of :class:`Lead` objects."""
    leads: List[Lead] = []
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for i, row in enumerate(reader, start=1):
            leads.append(lead_from_row(row, fallback_id=f"USER-{i:05d}"))
    return leads


def write_leads_csv(path: str, leads: Iterable[Lead], *, columns: Optional[List[str]] = None) -> int:
    """Write ``leads`` to ``path`` as CSV. Returns the number of rows written."""
    leads = list(leads)
    cols = columns or (Lead.field_names() + ["esg_pressure_label"])
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        writer.writeheader()
        for lead in leads:
            writer.writerow(lead.to_dict())
    return len(leads)
