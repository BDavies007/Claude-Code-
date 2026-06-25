"""Pipeline orchestration: load -> score -> rank -> segment.

A small dataclass result bundle (:class:`PipelineResult`) carries the ranked
leads plus segment summaries so :mod:`lead_gen.export` and the CLI can render
them without recomputation.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .generator import DEFAULT_SEED, generate_leads
from .schema import Lead, read_leads_csv
from .scoring import score_all


@dataclass
class SegmentStat:
    """Aggregate stats for one segment (tier / sector / region)."""

    key: str
    count: int = 0
    total_consumption_mwh: float = 0.0
    total_opportunity_value: float = 0.0
    avg_lead_score: float = 0.0


@dataclass
class PipelineResult:
    """Bundle of ranked leads and segment summaries."""

    leads: List[Lead]
    by_tier: Dict[str, SegmentStat] = field(default_factory=dict)
    by_sector: Dict[str, SegmentStat] = field(default_factory=dict)
    by_region: Dict[str, SegmentStat] = field(default_factory=dict)
    total_opportunity_value: float = 0.0
    total_consumption_mwh: float = 0.0

    @property
    def count(self) -> int:
        return len(self.leads)


def _segment(leads: List[Lead], key_fn) -> Dict[str, SegmentStat]:
    """Aggregate leads by a key function into SegmentStat objects."""
    buckets: Dict[str, List[Lead]] = defaultdict(list)
    for lead in leads:
        buckets[key_fn(lead)].append(lead)

    stats: Dict[str, SegmentStat] = {}
    for key, group in buckets.items():
        n = len(group)
        total_mwh = sum(l.annual_consumption_mwh for l in group)
        total_val = sum(l.estimated_annual_opportunity_value for l in group)
        avg_score = sum(l.lead_score for l in group) / n if n else 0.0
        stats[key] = SegmentStat(
            key=key,
            count=n,
            total_consumption_mwh=round(total_mwh, 1),
            total_opportunity_value=round(total_val, 2),
            avg_lead_score=round(avg_score, 2),
        )
    # Stable, descending-by-opportunity ordering for readability.
    return dict(sorted(stats.items(), key=lambda kv: kv[1].total_opportunity_value, reverse=True))


def segment_and_rank(leads: List[Lead]) -> PipelineResult:
    """Score-rank (desc) and build all segment summaries."""
    ranked = sorted(leads, key=lambda l: l.lead_score, reverse=True)
    result = PipelineResult(leads=ranked)
    result.by_tier = _segment(ranked, lambda l: l.tier)
    result.by_sector = _segment(ranked, lambda l: l.sector)
    result.by_region = _segment(ranked, lambda l: l.region)
    result.total_opportunity_value = round(
        sum(l.estimated_annual_opportunity_value for l in ranked), 2
    )
    result.total_consumption_mwh = round(sum(l.annual_consumption_mwh for l in ranked), 1)
    return result


def run_generate(count: int = 10_000, seed: Optional[int] = DEFAULT_SEED) -> PipelineResult:
    """Generate synthetic+curated leads, score, rank and segment."""
    leads = generate_leads(count=count, seed=seed)
    score_all(leads)
    return segment_and_rank(leads)


def run_score_csv(input_path: str) -> PipelineResult:
    """Ingest a user CSV of real prospects, score, rank and segment."""
    leads = read_leads_csv(input_path)
    score_all(leads)
    return segment_and_rank(leads)
