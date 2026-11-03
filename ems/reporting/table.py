"""Fixed-width text rendering of KPIs for side-by-side comparison (used by the CLI)."""
from __future__ import annotations

from typing import Callable, Mapping

from ems.models import KPIs

_Row = tuple[str, Callable[[KPIs], float], str]

_ROWS: tuple[_Row, ...] = (
    ("Cost (GBP)", lambda k: k.cost_gbp, "{:,.2f}"),
    ("Baseline cost (GBP)", lambda k: k.baseline_cost_gbp, "{:,.2f}"),
    ("Savings (GBP)", lambda k: k.savings_gbp, "{:,.2f}"),
    ("Import (kWh)", lambda k: k.energy_import_kwh, "{:,.1f}"),
    ("Export (kWh)", lambda k: k.energy_export_kwh, "{:,.1f}"),
    ("PV generation (kWh)", lambda k: k.pv_generation_kwh, "{:,.1f}"),
    ("PV curtailed (kWh)", lambda k: k.pv_curtailed_kwh, "{:,.1f}"),
    ("Site demand (kWh)", lambda k: k.load_kwh, "{:,.1f}"),
    ("Self-consumption (%)", lambda k: k.self_consumption_pct, "{:.1f}"),
    ("Self-sufficiency (%)", lambda k: k.self_sufficiency_pct, "{:.1f}"),
    ("Peak import (kW)", lambda k: k.peak_import_kw, "{:,.1f}"),
    ("Baseline peak (kW)", lambda k: k.baseline_peak_import_kw, "{:,.1f}"),
    ("CO2 (kg)", lambda k: k.co2_kg, "{:,.1f}"),
    ("Baseline CO2 (kg)", lambda k: k.baseline_co2_kg, "{:,.1f}"),
    ("Battery throughput (kWh)", lambda k: k.battery_throughput_kwh, "{:,.1f}"),
    ("Equivalent cycles", lambda k: k.battery_equivalent_cycles, "{:.2f}"),
)


def compare_kpis(results: Mapping[str, KPIs]) -> str:
    """Render KPIs for several runs as a fixed-width text table.

    Rows are metrics and columns are the keys of ``results`` (typically control
    mode names), in insertion order. Numbers are right-aligned.

    Args:
        results: Mapping of column label to KPIs.

    Returns:
        The table as a multi-line string (no trailing newline). If ``results``
        is empty a short placeholder line is returned.
    """
    if not results:
        return "(no results)"
    names = list(results)
    label_w = max(len("Metric"), *(len(r[0]) for r in _ROWS))
    cells = [[fmt.format(get(results[n])) for n in names] for _, get, fmt in _ROWS]
    col_w = [max(len(n), *(len(row[i]) for row in cells)) for i, n in enumerate(names)]

    def line(label: str, values: list[str]) -> str:
        parts = [label.ljust(label_w)] + [v.rjust(w) for v, w in zip(values, col_w)]
        return "  ".join(parts).rstrip()

    header = line("Metric", names)
    rule = "  ".join(["-" * label_w] + ["-" * w for w in col_w])
    body = [line(label, row) for (label, _, _), row in zip(_ROWS, cells)]
    return "\n".join([header, rule, *body])
