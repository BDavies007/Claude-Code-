"""Rule-based controllers: IDLE, SELF_CONSUMPTION, PEAK_SHAVING and TOU_ARBITRAGE."""
from __future__ import annotations

from ems.models import ControlMode, ControllerContext, DispatchCommand, SiteConfig

from .base import (_EPS, decision_time, describe_kw, power_limits, self_consumption_command,
                   site_net_kw)

#: Fraction of the import limit used as the shaving target when the site has none.
DEFAULT_PEAK_TARGET_FRACTION = 0.8
#: Below this fraction of the usable SoC window, peak shaving tops up from the grid
#: (under the target) even outside the cheapest band, to keep a shaving reserve.
PEAK_RESERVE_FRACTION = 0.5
#: Grid top-up rate (fraction of max charge) used to rebuild the reserve off-cheap-band.
PEAK_RESERVE_CHARGE_FRACTION = 0.25


class IdleController:
    """Battery does nothing: the no-battery baseline."""

    mode = ControlMode.IDLE

    def __init__(self, config: SiteConfig) -> None:
        self.config = config

    def decide(self, ctx: ControllerContext) -> DispatchCommand:
        """Always command 0 kW."""
        return DispatchCommand(battery_kw=0.0, reason="idle: battery held at 0 kW")


class SelfConsumptionController:
    """Charge from PV surplus and discharge to cover the site deficit."""

    mode = ControlMode.SELF_CONSUMPTION

    def __init__(self, config: SiteConfig) -> None:
        self.config = config

    def decide(self, ctx: ControllerContext) -> DispatchCommand:
        """Drive grid flow toward zero using measured net demand."""
        return self_consumption_command(ctx)


def peak_target_kw(config: SiteConfig) -> float:
    """Peak-shaving import target: the site's ``peak_target_kw`` or 80% of the import limit."""
    if config.peak_target_kw is not None:
        return config.peak_target_kw
    return DEFAULT_PEAK_TARGET_FRACTION * config.grid.import_limit_kw


def _cheapest_price(config: SiteConfig) -> float:
    return min(b.import_price_gbp_per_kwh for b in config.tariff.bands)


def _dearest_price(config: SiteConfig) -> float:
    return max(b.import_price_gbp_per_kwh for b in config.tariff.bands)


class PeakShavingController:
    """Hold grid import at or below ``peak_target_kw``.

    Discharges whenever net demand (measured, or the forecast for the coming interval
    if that is higher) exceeds the target. Below the target it recharges,
    preferring PV surplus, then the cheapest tariff band (up to the target), and only
    tops up gently from the grid elsewhere when the reserve is low.
    """

    mode = ControlMode.PEAK_SHAVING

    def __init__(self, config: SiteConfig) -> None:
        self.config = config
        self.target_kw = peak_target_kw(config)

    def decide(self, ctx: ControllerContext) -> DispatchCommand:
        """Shave import above target or recharge below it."""
        cfg = ctx.config
        target = peak_target_kw(cfg)
        net = site_net_kw(ctx)
        fc = ctx.forecast
        if fc is not None and fc.load_kw and fc.pv_kw:
            # Anticipate a step up in demand in the coming interval (e.g. a shift start
            # or EV arrivals) rather than reacting one interval late.
            net = max(net, fc.load_kw[0] - fc.pv_kw[0])
        lim = power_limits(ctx, net)
        if net > target + _EPS:
            sp = lim.clamp(net - target)
            if sp + _EPS < net - target:
                reason = (f"peak shaving: discharging {describe_kw(sp)} (limited); "
                          f"import {net - sp:.0f} kW above {target:.0f} kW target")
            else:
                reason = f"peak shaving: discharging {describe_kw(sp)} to hold import at {target:.0f} kW"
            return DispatchCommand(battery_kw=sp, reason=reason)

        # At or below target: recharge without pushing import above target.
        headroom = max(0.0, target - net)          # extra charge before hitting target
        if net < 0:
            sp = lim.clamp(net)                    # absorb PV surplus first
            if sp < -_EPS:
                return DispatchCommand(battery_kw=sp,
                                       reason=f"peak shaving: charging {describe_kw(sp)} from PV surplus")
            return DispatchCommand(battery_kw=0.0, reason="peak shaving: PV surplus, battery full")

        price = cfg.tariff.import_price_at(decision_time(ctx), cfg.timezone)
        if price <= _cheapest_price(cfg) + _EPS:
            sp = lim.clamp(-headroom)
            if sp < -_EPS:
                return DispatchCommand(battery_kw=sp,
                                       reason=f"peak shaving: recharging {describe_kw(sp)} in cheap band")
            return DispatchCommand(battery_kw=0.0, reason="peak shaving: cheap band, battery full")

        bat = cfg.battery
        window = max(bat.max_soc - bat.min_soc, _EPS)
        reserve = (ctx.telemetry.battery_soc - bat.min_soc) / window
        if reserve < PEAK_RESERVE_FRACTION:
            sp = lim.clamp(-min(headroom, PEAK_RESERVE_CHARGE_FRACTION * bat.max_charge_kw))
            if sp < -_EPS:
                return DispatchCommand(battery_kw=sp,
                                       reason=f"peak shaving: rebuilding reserve at {describe_kw(sp)}")
        return DispatchCommand(battery_kw=0.0,
                               reason=f"peak shaving: import {max(net, 0):.0f} kW within target; holding")


class TouArbitrageController:
    """Time-of-use arbitrage.

    Charges at full power (toward ``max_soc``) in the cheapest band, discharges to cover
    site demand in the dearest band, and self-consumes in every other band.
    """

    mode = ControlMode.TOU_ARBITRAGE

    def __init__(self, config: SiteConfig) -> None:
        self.config = config

    def decide(self, ctx: ControllerContext) -> DispatchCommand:
        """Act on the tariff band the next interval falls in."""
        cfg = ctx.config
        band = cfg.tariff.band_at(decision_time(ctx), cfg.timezone)
        price = band.import_price_gbp_per_kwh
        cheap, dear = _cheapest_price(cfg), _dearest_price(cfg)
        if dear - cheap <= _EPS:
            return self_consumption_command(ctx, prefix="TOU (flat tariff)")
        net = site_net_kw(ctx)
        lim = power_limits(ctx, net)
        if price <= cheap + _EPS:
            charge = lim.max_charge_kw
            if cfg.peak_target_kw is not None:
                # Grid charging must not create a new import peak above the target.
                charge = min(charge, max(0.0, cfg.peak_target_kw - net, -net))
            sp = -charge
            if sp < -_EPS:
                return DispatchCommand(battery_kw=sp,
                                       reason=f"TOU: charging {describe_kw(sp)} in cheapest band ({band.name})")
            return DispatchCommand(battery_kw=0.0,
                                   reason=f"TOU: cheapest band ({band.name}), battery full")
        if price >= dear - _EPS:
            return self_consumption_command(ctx, prefix=f"TOU dearest band ({band.name})")
        return self_consumption_command(ctx, prefix=f"TOU {band.name} band")
