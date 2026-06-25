"""Artifact writers: ranked CSV, top-N CSV, JSON, segment summary, Markdown report."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

from .pipeline import PipelineResult, SegmentStat
from .schema import Lead, write_leads_csv
from .scoring import WEIGHTS

DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "output"


def _ensure_dir(output_dir: Path) -> Path:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def write_ranked_csv(result: PipelineResult, output_dir: Path) -> Path:
    path = _ensure_dir(output_dir) / "leads_ranked.csv"
    write_leads_csv(str(path), result.leads)
    return path


def write_top_n_csv(result: PipelineResult, output_dir: Path, n: int = 100) -> Path:
    path = _ensure_dir(output_dir) / f"top_{n}_leads.csv"
    write_leads_csv(str(path), result.leads[:n])
    return path


def _segments_to_json(segments: Dict[str, SegmentStat]) -> List[dict]:
    return [
        {
            "key": s.key,
            "count": s.count,
            "total_consumption_mwh": s.total_consumption_mwh,
            "total_opportunity_value": s.total_opportunity_value,
            "avg_lead_score": s.avg_lead_score,
        }
        for s in segments.values()
    ]


def write_segment_summary_json(result: PipelineResult, output_dir: Path) -> Path:
    path = _ensure_dir(output_dir) / "segment_summary.json"
    payload = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "total_leads": result.count,
        "total_consumption_mwh": result.total_consumption_mwh,
        "total_opportunity_value_usd": result.total_opportunity_value,
        "weights": WEIGHTS,
        "by_tier": _segments_to_json(result.by_tier),
        "by_sector": _segments_to_json(result.by_sector),
        "by_region": _segments_to_json(result.by_region),
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


def write_leads_json(result: PipelineResult, output_dir: Path, n: int = 0) -> Path:
    """Write leads as JSON. ``n=0`` writes all; otherwise the top N."""
    path = _ensure_dir(output_dir) / "leads.json"
    leads = result.leads if n <= 0 else result.leads[:n]
    payload = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "count": len(leads),
        "leads": [l.to_dict() for l in leads],
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


def _fmt_usd(v: float) -> str:
    return f"${v:,.0f}"


def _fmt_mwh(v: float) -> str:
    return f"{v:,.0f}"


def _segment_table(title: str, segments: Dict[str, SegmentStat]) -> str:
    lines = [
        f"### {title}",
        "",
        "| Segment | Leads | Total MWh/yr | Avg Score | Total Opportunity (USD) |",
        "|---|---:|---:|---:|---:|",
    ]
    for s in segments.values():
        lines.append(
            f"| {s.key} | {s.count:,} | {_fmt_mwh(s.total_consumption_mwh)} | "
            f"{s.avg_lead_score:.1f} | {_fmt_usd(s.total_opportunity_value)} |"
        )
    lines.append("")
    return "\n".join(lines)


def build_markdown_report(result: PipelineResult, top_n: int = 25) -> str:
    """Render the full Markdown report string."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    n_public = sum(1 for l in result.leads if l.data_quality == "public-estimate")
    n_synth = sum(1 for l in result.leads if l.data_quality == "synthetic")
    n_user = sum(1 for l in result.leads if l.data_quality == "user-provided")

    lines: List[str] = []
    lines.append("# Beyond Green Group — Lead Generation Report")
    lines.append("")
    lines.append(f"_Generated {now}_")
    lines.append("")

    # Data-integrity caveat (prominent).
    lines.append("> **Data integrity:** This report blends a small CURATED set of real, "
                 "well-known large energy consumers (flagged `public-estimate`, with "
                 "APPROXIMATE publicly-estimable consumption) and a larger body of clearly "
                 "labelled SYNTHETIC records (`synthetic`) generated from sector/region "
                 "benchmarks. Synthetic organizations have generic templated names and are "
                 "**not** real companies. No fabricated entity is presented as a factual "
                 "named energy consumer. Use for relative prioritization, not as audited data.")
    lines.append("")

    # Headline stats.
    lines.append("## Headline stats")
    lines.append("")
    lines.append(f"- **Total leads:** {result.count:,}")
    lines.append(f"  - public-estimate (real): {n_public:,}")
    lines.append(f"  - synthetic: {n_synth:,}")
    if n_user:
        lines.append(f"  - user-provided: {n_user:,}")
    lines.append(f"- **Total annual consumption:** {_fmt_mwh(result.total_consumption_mwh)} MWh")
    lines.append(f"- **Total addressable annual opportunity:** {_fmt_usd(result.total_opportunity_value)}")
    lines.append("")

    # Methodology recap.
    lines.append("## Scoring methodology")
    lines.append("")
    lines.append("Lead score (0-100) is a weighted, normalized blend of seven signals:")
    lines.append("")
    lines.append("| Signal | Weight | Meaning |")
    lines.append("|---|---:|---|")
    lines.append(f"| Consumption volume (log-scaled) | {WEIGHTS['consumption']:.0%} | Bigger load = bigger prize |")
    lines.append(f"| Decarbonization gap (100 − renewable %) | {WEIGHTS['decarbonization_gap']:.0%} | Room to green |")
    lines.append(f"| Grid carbon intensity | {WEIGHTS['grid_carbon']:.0%} | Dirtier grid = more to gain |")
    lines.append(f"| Sector fit / tractability | {WEIGHTS['sector_fit']:.0%} | Ease of serving with our offerings |")
    lines.append(f"| ESG / regulatory pressure | {WEIGHTS['esg_pressure']:.0%} | Compliance / investor push |")
    lines.append(f"| Buying window (months to renewal) | {WEIGHTS['buying_window']:.0%} | Nearer renewal = hotter |")
    lines.append(f"| Financial capacity proxy | {WEIGHTS['financial_capacity']:.0%} | Ability to pay |")
    lines.append("")
    lines.append("Tiers: **A** ≥ 70, **B** 50–69, **C** < 50. "
                 "Opportunity value = consumption × addressable share × decarbonization gap × value-per-MWh.")
    lines.append("")

    # Tier / sector / region breakdowns.
    lines.append("## Segment breakdowns")
    lines.append("")
    lines.append(_segment_table("By tier", result.by_tier))
    lines.append(_segment_table("By sector", result.by_sector))
    lines.append(_segment_table("By region", result.by_region))

    # Top leads table.
    lines.append(f"## Top {top_n} leads")
    lines.append("")
    lines.append("| # | Organization | Sector | Region | Score | Tier | Offering | Opportunity (USD) | Data |")
    lines.append("|---:|---|---|---|---:|:--:|---|---:|:--:|")
    for i, lead in enumerate(result.leads[:top_n], start=1):
        lines.append(
            f"| {i} | {lead.organization} | {lead.sector} | {lead.region} | "
            f"{lead.lead_score:.1f} | {lead.tier} | {lead.recommended_offering} | "
            f"{_fmt_usd(lead.estimated_annual_opportunity_value)} | {lead.data_quality} |"
        )
    lines.append("")
    return "\n".join(lines)


def write_markdown_report(result: PipelineResult, output_dir: Path, top_n: int = 25) -> Path:
    path = _ensure_dir(output_dir) / "lead_report.md"
    path.write_text(build_markdown_report(result, top_n=top_n), encoding="utf-8")
    return path


def write_all(result: PipelineResult, output_dir: Path, *, top_n: int = 100, report_top_n: int = 25) -> Dict[str, Path]:
    """Write the full artifact set and return a name->path map."""
    output_dir = _ensure_dir(output_dir)
    return {
        "ranked_csv": write_ranked_csv(result, output_dir),
        "top_csv": write_top_n_csv(result, output_dir, n=top_n),
        "segment_json": write_segment_summary_json(result, output_dir),
        "leads_json": write_leads_json(result, output_dir, n=top_n),
        "report_md": write_markdown_report(result, output_dir, top_n=report_top_n),
    }
