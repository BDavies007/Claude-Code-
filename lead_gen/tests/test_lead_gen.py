"""Unit tests for the lead-generation & scoring model.

Written with the stdlib ``unittest`` framework so they run with no pip deps::

    python3 -m unittest discover -s lead_gen/tests
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from lead_gen import benchmarks as bm
from lead_gen import export
from lead_gen.generator import build_curated_leads, generate_leads
from lead_gen.pipeline import run_generate, run_score_csv, segment_and_rank
from lead_gen.schema import (
    DataQuality,
    Lead,
    REQUIRED_INPUT_COLUMNS,
    read_leads_csv,
    write_leads_csv,
)
from lead_gen.scoring import (
    TIER_A_THRESHOLD,
    TIER_B_THRESHOLD,
    WEIGHTS,
    compute_lead_score,
    score_lead,
    score_to_tier,
)
from lead_gen.schema import Tier


REQUIRED_LEAD_FIELDS = [
    "id", "organization", "sector", "region", "country",
    "annual_consumption_mwh", "current_renewable_pct",
    "grid_carbon_intensity_gco2_kwh", "esg_pressure",
    "contract_renewal_months", "data_quality",
]


class TestWeights(unittest.TestCase):
    def test_weights_sum_to_one(self):
        self.assertAlmostEqual(sum(WEIGHTS.values()), 1.0, places=9)

    def test_all_weights_positive(self):
        for k, v in WEIGHTS.items():
            self.assertGreater(v, 0.0, f"weight {k} must be positive")


class TestScoringBounds(unittest.TestCase):
    def test_scores_within_bounds_for_generated_leads(self):
        result = run_generate(count=500, seed=7)
        for lead in result.leads:
            self.assertGreaterEqual(lead.lead_score, 0.0)
            self.assertLessEqual(lead.lead_score, 100.0)

    def test_extreme_low_profile_scores_low(self):
        lead = Lead(
            id="X", organization="x", sector="Retail / E-commerce",
            region="Europe", country="Sweden",
            annual_consumption_mwh=10_000, current_renewable_pct=100.0,
            grid_carbon_intensity_gco2_kwh=20.0, esg_pressure=0.0,
            contract_renewal_months=60.0, data_quality="synthetic",
        )
        score, _ = compute_lead_score(lead)
        self.assertGreaterEqual(score, 0.0)
        self.assertLess(score, 40.0)

    def test_extreme_high_profile_scores_high(self):
        lead = Lead(
            id="Y", organization="y", sector="Data Center / Hyperscaler",
            region="India", country="India",
            annual_consumption_mwh=50_000_000, current_renewable_pct=0.0,
            grid_carbon_intensity_gco2_kwh=750.0, esg_pressure=1.0,
            contract_renewal_months=1.0, data_quality="synthetic",
        )
        score, _ = compute_lead_score(lead)
        self.assertLessEqual(score, 100.0)
        self.assertGreater(score, 70.0)


class TestTierMapping(unittest.TestCase):
    def test_tier_thresholds(self):
        self.assertEqual(score_to_tier(TIER_A_THRESHOLD), Tier.A)
        self.assertEqual(score_to_tier(95.0), Tier.A)
        self.assertEqual(score_to_tier(TIER_B_THRESHOLD), Tier.B)
        self.assertEqual(score_to_tier(69.9), Tier.B)
        self.assertEqual(score_to_tier(49.9), Tier.C)
        self.assertEqual(score_to_tier(0.0), Tier.C)


class TestGenerator(unittest.TestCase):
    def test_generates_exactly_n(self):
        for n in (100, 1000, 10_000):
            leads = generate_leads(count=n, seed=42)
            self.assertEqual(len(leads), n)

    def test_required_fields_present_and_nonempty(self):
        leads = generate_leads(count=200, seed=1)
        for lead in leads:
            d = lead.to_dict()
            for f in REQUIRED_LEAD_FIELDS:
                self.assertIn(f, d)
                self.assertNotEqual(d[f], "", f"field {f} empty")

    def test_data_quality_split(self):
        n = 5000
        leads = generate_leads(count=n, seed=42)
        n_public = sum(1 for l in leads if l.data_quality == DataQuality.PUBLIC_ESTIMATE.value)
        n_synth = sum(1 for l in leads if l.data_quality == DataQuality.SYNTHETIC.value)
        self.assertEqual(n_public, bm.curated_count())
        self.assertEqual(n_synth, n - bm.curated_count())

    def test_curated_all_public_estimate(self):
        curated = build_curated_leads()
        self.assertGreaterEqual(len(curated), 60)
        for lead in curated:
            self.assertEqual(lead.data_quality, DataQuality.PUBLIC_ESTIMATE.value)

    def test_synthetic_names_are_generic(self):
        # Synthetic names must end with a numeric index (clearly templated).
        leads = generate_leads(count=500, seed=3)
        synth = [l for l in leads if l.data_quality == DataQuality.SYNTHETIC.value]
        self.assertTrue(synth)
        for lead in synth[:50]:
            self.assertRegex(lead.organization, r"\d{4}$")

    def test_deterministic_given_seed(self):
        a = generate_leads(count=1000, seed=123)
        b = generate_leads(count=1000, seed=123)
        self.assertEqual([l.organization for l in a], [l.organization for l in b])
        self.assertEqual(
            [l.annual_consumption_mwh for l in a],
            [l.annual_consumption_mwh for l in b],
        )

    def test_different_seed_differs(self):
        a = generate_leads(count=1000, seed=1)
        b = generate_leads(count=1000, seed=2)
        # Curated prefix is identical; synthetic tail should differ somewhere.
        self.assertNotEqual(
            [l.annual_consumption_mwh for l in a],
            [l.annual_consumption_mwh for l in b],
        )


class TestPipeline(unittest.TestCase):
    def test_ranked_descending(self):
        result = run_generate(count=500, seed=9)
        scores = [l.lead_score for l in result.leads]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_tiers_populated(self):
        result = run_generate(count=300, seed=9)
        for lead in result.leads:
            self.assertIn(lead.tier, ("A", "B", "C"))

    def test_segments_cover_all_leads(self):
        result = run_generate(count=400, seed=9)
        tier_total = sum(s.count for s in result.by_tier.values())
        self.assertEqual(tier_total, result.count)


class TestCsvRoundTrip(unittest.TestCase):
    def test_required_columns_constant(self):
        for c in REQUIRED_INPUT_COLUMNS:
            self.assertIn(c, Lead.field_names())

    def test_ingestion_round_trip(self):
        leads = generate_leads(count=50, seed=5)
        for l in leads:
            score_lead(l)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "in.csv"
            write_leads_csv(str(path), leads)
            reloaded = read_leads_csv(str(path))
            self.assertEqual(len(reloaded), len(leads))
            # Key numeric input survives the round trip.
            self.assertAlmostEqual(
                reloaded[0].annual_consumption_mwh,
                leads[0].annual_consumption_mwh,
                places=1,
            )

    def test_score_csv_path(self):
        leads = generate_leads(count=30, seed=5)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "prospects.csv"
            write_leads_csv(str(path), leads)
            result = run_score_csv(str(path))
            self.assertEqual(result.count, 30)
            for lead in result.leads:
                self.assertGreaterEqual(lead.lead_score, 0.0)
                self.assertLessEqual(lead.lead_score, 100.0)


class TestExport(unittest.TestCase):
    def test_export_files_created(self):
        result = run_generate(count=200, seed=11)
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            paths = export.write_all(result, out, top_n=50, report_top_n=10)
            for name, p in paths.items():
                self.assertTrue(Path(p).exists(), f"{name} not written")
                self.assertGreater(Path(p).stat().st_size, 0)
            # Ranked CSV has exactly count+1 lines (header + rows).
            ranked = (out / "leads_ranked.csv").read_text(encoding="utf-8").strip().splitlines()
            self.assertEqual(len(ranked) - 1, result.count)
            # Segment JSON parses and reports the right total.
            data = json.loads((out / "segment_summary.json").read_text(encoding="utf-8"))
            self.assertEqual(data["total_leads"], result.count)

    def test_report_mentions_data_integrity(self):
        result = run_generate(count=100, seed=11)
        md = export.build_markdown_report(result)
        self.assertIn("Data integrity", md)
        self.assertIn("public-estimate", md)
        self.assertIn("synthetic", md)


if __name__ == "__main__":
    unittest.main()
