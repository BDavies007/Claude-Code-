"""Command-line interface: ``python -m ems serve`` and ``python -m ems simulate``."""
from __future__ import annotations

import argparse
import logging
import sys
from collections.abc import Sequence
from dataclasses import dataclass

from ems.models import ControlMode, KPIs

__all__ = ["main", "build_parser", "simulate", "simulate_runs", "ModeRun",
           "format_battery_inventory"]


def _preset_names() -> list[str]:
    from ems.presets import PRESETS
    return sorted(PRESETS)


def build_parser() -> argparse.ArgumentParser:
    """Build the argument parser for the ``ems`` CLI."""
    presets = _preset_names()
    parser = argparse.ArgumentParser(prog="python -m ems",
                                     description="Site energy management system.")
    sub = parser.add_subparsers(dest="command", required=True)

    serve = sub.add_parser("serve", help="run the API server and dashboard")
    serve.add_argument("--host", default="0.0.0.0", help="bind address (default 0.0.0.0)")
    serve.add_argument("--port", type=int, default=8000, help="port (default 8000)")
    serve.add_argument("--site", choices=presets, default="demo-warehouse",
                       help="site preset (default demo-warehouse)")
    serve.add_argument("--speed", type=_speed, default=300.0,
                       help="sim seconds per real second, 1..86400 (default 300)")
    serve.add_argument("--mode", type=ControlMode, choices=list(ControlMode),
                       default=ControlMode.OPTIMISED, metavar="MODE",
                       help="initial control mode (default optimised)")
    serve.add_argument("--log-level", default="info",
                       choices=["critical", "error", "warning", "info", "debug"])

    sim = sub.add_parser("simulate", help="compare control modes offline and print KPIs")
    sim.add_argument("--site", choices=presets, default="demo-warehouse",
                     help="site preset (default demo-warehouse)")
    sim.add_argument("--days", type=_positive_float, default=7.0,
                     help="simulated days per mode (default 7)")
    sim.add_argument("--mode", type=ControlMode, choices=list(ControlMode), default=None,
                     metavar="MODE",
                     help="only run this mode (plus the idle baseline); one of "
                          + ", ".join(m.value for m in ControlMode))
    sim.add_argument("--step-seconds", type=_positive_float, default=300.0,
                     help="control interval in seconds (default 300)")
    return parser


def _positive_float(text: str) -> float:
    try:
        value = float(text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"not a number: {text!r}") from exc
    if not value > 0 or value != value or value == float("inf"):
        raise argparse.ArgumentTypeError("must be a positive finite number")
    return value


def _speed(text: str) -> float:
    value = _positive_float(text)
    if not 1 <= value <= 86400:
        raise argparse.ArgumentTypeError("speed must be within 1..86400")
    return value


@dataclass(frozen=True)
class ModeRun:
    """Outcome of one offline simulation run of a single control mode.

    Attributes:
        kpis: KPIs over the whole run (``savings_gbp`` includes the stored-energy change).
        soc_start: battery state of charge at the start of the run (0..1).
        soc_end: battery state of charge at the end of the run (0..1).
        stored_delta_kwh: change in stored battery energy over the run (kWh).
        inventory_value_gbp: value of that change included in ``kpis.savings_gbp``.
    """

    kpis: KPIs
    soc_start: float
    soc_end: float
    stored_delta_kwh: float
    inventory_value_gbp: float


def simulate_runs(site: str, days: float, mode: ControlMode | None = None,
                  step_seconds: float = 300.0) -> dict[str, ModeRun]:
    """Run each control mode (or ``mode`` plus IDLE) on a fresh engine for ``days``.

    Returns a :class:`ModeRun` per mode value, in :class:`ControlMode` declaration order.
    """
    from ems.core import EMSEngine
    from ems.presets import PRESETS
    from ems.reporting import battery_inventory

    modes = list(ControlMode) if mode is None else [m for m in ControlMode
                                                    if m in (ControlMode.IDLE, mode)]
    steps = max(1, round(days * 86400 / step_seconds))
    results: dict[str, ModeRun] = {}
    for m in modes:
        engine = EMSEngine(PRESETS[site](), mode=m, step_seconds=step_seconds)
        soc_start = engine.soc
        history = engine.run(steps)
        inventory = battery_inventory(history, engine.config, step_seconds)
        results[m.value] = ModeRun(kpis=engine.kpis(), soc_start=soc_start,
                                   soc_end=history[-1].battery_soc,
                                   stored_delta_kwh=inventory.stored_delta_kwh,
                                   inventory_value_gbp=inventory.value_gbp)
    return results


def simulate(site: str, days: float, mode: ControlMode | None = None,
             step_seconds: float = 300.0) -> dict[str, KPIs]:
    """Run each control mode (or ``mode`` plus IDLE) on a fresh engine for ``days``.

    Returns KPIs keyed by mode value, in :class:`ControlMode` declaration order.
    """
    return {name: run.kpis for name, run in
            simulate_runs(site, days, mode, step_seconds).items()}


def format_battery_inventory(runs: dict[str, ModeRun]) -> str:
    """Render each run's start/end SoC and the stored-energy value counted in savings."""
    width = max(len(n) for n in runs) if runs else 0
    lines = ["Battery SoC start -> end (stored-energy change, valued in Savings):"]
    for name, run in runs.items():
        lines.append(f"  {name.ljust(width)}  {run.soc_start:.2f} -> {run.soc_end:.2f}  "
                     f"({run.stored_delta_kwh:+,.1f} kWh, {run.inventory_value_gbp:+,.2f} GBP)")
    return "\n".join(lines)


def _serve(args: argparse.Namespace) -> int:
    import uvicorn

    from ems.api import create_app, websocket_supported
    from ems.core import EMSEngine
    from ems.presets import PRESETS

    if not websocket_supported():
        logging.getLogger("ems").warning(
            "No WebSocket library installed: /ws/telemetry is unavailable and the dashboard "
            "will poll instead. Install one with: pip install -e '.[live]'")
    engine = EMSEngine(PRESETS[args.site](), mode=args.mode, sim_speed=args.speed)
    app = create_app(engine, autostart=True)
    uvicorn.run(app, host=args.host, port=args.port, log_level=args.log_level)
    return 0


def _simulate(args: argparse.Namespace) -> int:
    from ems.presets import PRESETS
    from ems.reporting import compare_kpis

    site = PRESETS[args.site]()
    print(f"Site: {site.name} ({args.site}) | {args.days:g} day(s) | "
          f"step {args.step_seconds:g} s")
    runs = simulate_runs(args.site, args.days, args.mode, args.step_seconds)
    print(compare_kpis({name: run.kpis for name, run in runs.items()}))
    print()
    print(format_battery_inventory(runs))
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    """CLI entry point; returns a process exit code."""
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
    args = build_parser().parse_args(argv)
    if args.command == "serve":
        return _serve(args)
    return _simulate(args)


if __name__ == "__main__":
    sys.exit(main())
