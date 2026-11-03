"""Battery dispatch controllers for every :class:`~ems.models.ControlMode`.

Use :func:`make_controller` to build the controller for a mode; every controller
satisfies the :class:`Controller` protocol (``mode`` + ``decide(ctx)``).
"""
from __future__ import annotations

from ems.models import ControlMode, SiteConfig

from .base import Controller, PowerLimits, power_limits, site_net_kw
from .optimiser import OptimisedController, Plan, solve_schedule
from .rules import (IdleController, PeakShavingController, SelfConsumptionController,
                    TouArbitrageController, peak_target_kw)

_REGISTRY: dict[ControlMode, type] = {
    ControlMode.IDLE: IdleController,
    ControlMode.SELF_CONSUMPTION: SelfConsumptionController,
    ControlMode.PEAK_SHAVING: PeakShavingController,
    ControlMode.TOU_ARBITRAGE: TouArbitrageController,
    ControlMode.OPTIMISED: OptimisedController,
}


def make_controller(mode: ControlMode | str, config: SiteConfig) -> Controller:
    """Create the controller implementing ``mode`` for the given site.

    Args:
        mode: a :class:`ControlMode` or its string value (e.g. ``"peak_shaving"``).
        config: the site configuration.

    Raises:
        ValueError: if ``mode`` is not a known control mode.
    """
    m = ControlMode(mode)
    controller: Controller = _REGISTRY[m](config)
    return controller


__all__ = [
    "Controller", "make_controller", "IdleController", "SelfConsumptionController",
    "PeakShavingController", "TouArbitrageController", "OptimisedController",
    "solve_schedule", "Plan", "PowerLimits", "power_limits", "site_net_kw", "peak_target_kw",
]
