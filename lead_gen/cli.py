"""Command-line interface for the lead-generation model.

Subcommands:
  generate  -- generate synthetic + curated leads, score, rank, export.
  score     -- ingest a user CSV of real prospects, score, rank, export.
  report    -- re-generate just the Markdown report from a fresh run.

Run, e.g.::

    python3 -m lead_gen.cli generate --count 10000
    python3 -m lead_gen.cli score --input my_prospects.csv
    python3 -m lead_gen.cli report --top 50
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import List, Optional

from . import export
from .generator import DEFAULT_SEED
from .pipeline import PipelineResult, run_generate, run_score_csv

DEFAULT_OUTPUT_DIR = export.DEFAULT_OUTPUT_DIR


def _print_headline(result: PipelineResult, top: int = 5) -> None:
    """Print a concise headline summary to stdout."""
    print(f"\nLeads: {result.count:,}")
    n_public = sum(1 for l in result.leads if l.data_quality == "public-estimate")
    n_synth = sum(1 for l in result.leads if l.data_quality == "synthetic")
    n_user = sum(1 for l in result.leads if l.data_quality == "user-provided")
    print(f"  public-estimate: {n_public:,} | synthetic: {n_synth:,} | user-provided: {n_user:,}")

    print("\nTier distribution:")
    for tier in ("A", "B", "C"):
        stat = result.by_tier.get(tier)
        if stat:
            print(f"  Tier {tier}: {stat.count:,} leads | avg score {stat.avg_lead_score:.1f}")

    print(f"\nTotal annual consumption: {result.total_consumption_mwh:,.0f} MWh")
    print(f"Total addressable opportunity value: ${result.total_opportunity_value:,.0f}")

    print(f"\nTop {top} leads:")
    for i, lead in enumerate(result.leads[:top], start=1):
        print(
            f"  {i}. {lead.organization} [{lead.sector}] "
            f"score={lead.lead_score:.1f} tier={lead.tier} "
            f"offering={lead.recommended_offering} "
            f"opp=${lead.estimated_annual_opportunity_value:,.0f} "
            f"({lead.data_quality})"
        )


def _write_and_report(result: PipelineResult, output_dir: Path, *, top_n: int, report_top_n: int) -> None:
    paths = export.write_all(result, output_dir, top_n=top_n, report_top_n=report_top_n)
    _print_headline(result)
    print("\nArtifacts written:")
    for name, path in paths.items():
        print(f"  {name}: {path}")


def cmd_generate(args: argparse.Namespace) -> int:
    result = run_generate(count=args.count, seed=args.seed)
    _write_and_report(result, Path(args.output_dir), top_n=args.top, report_top_n=args.report_top)
    return 0


def cmd_score(args: argparse.Namespace) -> int:
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"error: input CSV not found: {input_path}", file=sys.stderr)
        return 2
    result = run_score_csv(str(input_path))
    _write_and_report(result, Path(args.output_dir), top_n=args.top, report_top_n=args.report_top)
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    result = run_generate(count=args.count, seed=args.seed)
    path = export.write_markdown_report(result, Path(args.output_dir), top_n=args.top)
    _print_headline(result)
    print(f"\nReport written: {path}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lead_gen.cli",
        description="Lead-generation & scoring model for large energy consumers (Beyond Green Group).",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # generate
    g = sub.add_parser("generate", help="Generate synthetic + curated leads and score them.")
    g.add_argument("--count", type=int, default=10_000, help="Number of leads to generate (default 10000).")
    g.add_argument("--seed", type=int, default=DEFAULT_SEED, help=f"Random seed (default {DEFAULT_SEED}).")
    g.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Directory for artifacts.")
    g.add_argument("--top", type=int, default=100, help="Top-N highlights CSV/JSON size (default 100).")
    g.add_argument("--report-top", type=int, default=25, help="Rows in the report's top-leads table (default 25).")
    g.set_defaults(func=cmd_generate)

    # score (ingest real prospects)
    s = sub.add_parser("score", help="Score a user-supplied CSV of real prospects.")
    s.add_argument("--input", required=True, help="Path to a CSV of prospects to score.")
    s.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Directory for artifacts.")
    s.add_argument("--top", type=int, default=100, help="Top-N highlights CSV/JSON size (default 100).")
    s.add_argument("--report-top", type=int, default=25, help="Rows in the report's top-leads table (default 25).")
    s.set_defaults(func=cmd_score)

    # report
    r = sub.add_parser("report", help="Generate just the Markdown report from a fresh run.")
    r.add_argument("--count", type=int, default=10_000, help="Number of leads to generate (default 10000).")
    r.add_argument("--seed", type=int, default=DEFAULT_SEED, help=f"Random seed (default {DEFAULT_SEED}).")
    r.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Directory for artifacts.")
    r.add_argument("--top", type=int, default=25, help="Rows in the report's top-leads table (default 25).")
    r.set_defaults(func=cmd_report)

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
