"""Deterministic site simulator: PV, building load, EV charging, battery and grid."""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

import numpy as np

from ..models import ControlMode, DispatchCommand, Forecast, SiteConfig, Telemetry
from .ev import EVFleet
from .physics import building_load_kw, pv_available_kw, sample_grid, standard_longitude

# Forecast error model: relative 1-sigma error = base + growth * min(lead_h / 24, 1.5).
_PV_ERR_BASE, _PV_ERR_GROWTH = 0.03, 0.20
_LOAD_ERR_BASE, _LOAD_ERR_GROWTH = 0.02, 0.06
_ERR_AUTOCORR_HOURS = 3.0
_FORECAST_STREAM = 11
_SEED_MASK = (1 << 63) - 1


class SiteSimulator:
    """Simulates one site's energy flows, enforcing physical and grid limits.

    The simulator is fully deterministic given ``config.seed`` and ``start``.
    Weather and building-load noise are pure functions of absolute time, so the
    stepping pattern does not change the underlying truth; EV charging state and
    battery SoC evolve with the commands applied.
    """

    def __init__(self, config: SiteConfig, start: datetime) -> None:
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        self.config: SiteConfig = config
        self._now: datetime = start.astimezone(timezone.utc)
        b = config.battery
        self._soc_lo = min(b.min_soc, b.max_soc)
        self._soc_hi = max(b.min_soc, b.max_soc)
        self._soc: float = float(min(max(b.initial_soc, self._soc_lo), self._soc_hi))
        self._eta: float = math.sqrt(b.round_trip_efficiency)
        self._longitude: float = standard_longitude(config.timezone, self._now)
        self._ev = EVFleet(config.ev, config.seed, config.timezone, self._now.timestamp())

    # ------------------------------------------------------------ properties

    @property
    def now(self) -> datetime:
        """Current simulation time (timezone-aware UTC)."""
        return self._now

    @property
    def soc(self) -> float:
        """Current battery state of charge (0..1)."""
        return self._soc

    # ------------------------------------------------------------ truth models

    def _pv_kw(self, t: np.ndarray) -> np.ndarray:
        c = self.config
        return pv_available_kw(t, c.pv, c.latitude, self._longitude, c.seed)

    def _load_kw(self, t: np.ndarray) -> np.ndarray:
        c = self.config
        return building_load_kw(t, c.load, c.timezone, c.seed)

    # ------------------------------------------------------------ battery

    def _battery_limits(self, dt_h: float) -> tuple[float, float]:
        """(max discharge kW, max charge kW) achievable over ``dt_h`` hours."""
        b = self.config.battery
        if b.capacity_kwh <= 0:
            return 0.0, 0.0
        max_dis = max(0.0, (self._soc - self._soc_lo) * b.capacity_kwh * self._eta / dt_h)
        max_ch = max(0.0, (self._soc_hi - self._soc) * b.capacity_kwh / (self._eta * dt_h))
        return min(b.max_discharge_kw, max_dis), min(b.max_charge_kw, max_ch)

    def _apply_battery(self, battery_kw: float, dt_h: float) -> None:
        cap = self.config.battery.capacity_kwh
        if cap <= 0 or battery_kw == 0.0:
            return
        if battery_kw > 0:
            stored_delta = -battery_kw * dt_h / self._eta
        else:
            stored_delta = -battery_kw * dt_h * self._eta
        self._soc = min(max(self._soc + stored_delta / cap, self._soc_lo), self._soc_hi)

    # ------------------------------------------------------------ public API

    def step(self, command: DispatchCommand, dt_seconds: float, mode: ControlMode) -> Telemetry:
        """Advance the clock by ``dt_seconds`` applying ``command``.

        Returns telemetry averaged over the interval, timestamped at its start.
        ``battery_soc`` is the state of charge at the END of the interval.
        """
        if not dt_seconds > 0 or not math.isfinite(dt_seconds):
            raise ValueError("dt_seconds must be a positive finite number")
        cfg = self.config
        t0 = self._now.timestamp()
        t1 = t0 + dt_seconds
        dt_h = dt_seconds / 3600.0
        samples = sample_grid(t0, dt_seconds)
        pv_avail = float(np.mean(self._pv_kw(samples)))
        load = float(np.mean(self._load_kw(samples)))

        # Battery: clamp to power and SoC-window energy limits.
        max_dis, max_ch = self._battery_limits(dt_h)
        req = command.battery_kw if math.isfinite(command.battery_kw) else 0.0
        battery = min(max(req, -max_ch), max_dis)

        # EV: unconstrained demand, capped by the commanded limit.
        ev_demand = self._ev.demand_kw(t0, t1)
        ev = ev_demand if command.ev_kw_limit is None else min(ev_demand, max(command.ev_kw_limit, 0.0))

        # Import limit: shed EV first, then battery charging.
        excess = load + ev - pv_avail - battery - cfg.grid.import_limit_kw
        if excess > 0:
            cut = min(ev, excess)
            ev -= cut
            excess -= cut
            if excess > 0 and battery < 0:
                battery += min(-battery, excess)

        # Export limit: curtail PV first, then battery discharge.
        pv = pv_avail
        over_export = -(load + ev - pv - battery) - cfg.grid.export_limit_kw
        if over_export > 0:
            cut = min(pv, over_export)
            pv -= cut
            over_export -= cut
            if over_export > 0 and battery > 0:
                battery -= min(battery, over_export)

        ev = self._ev.deliver(t0, t1, ev)
        self._apply_battery(battery, dt_h)
        grid = load + ev - pv - battery

        telemetry = Telemetry(
            timestamp=self._now,
            pv_kw=pv,
            pv_curtailed_kw=pv_avail - pv,
            load_kw=load,
            ev_kw=ev,
            battery_kw=battery,
            battery_soc=self._soc,
            grid_kw=grid,
            import_price_gbp_per_kwh=cfg.tariff.import_price_at(self._now, cfg.timezone),
            export_price_gbp_per_kwh=cfg.tariff.export_price_gbp_per_kwh,
            mode=mode,
        )
        self._now = self._now + timedelta(seconds=dt_seconds)
        return telemetry

    def forecast(self, horizon_hours: float = 24, step_minutes: int = 15) -> Forecast:
        """Noisy forecast of the next ``horizon_hours`` starting at ``now``.

        PV is available (pre-curtailment) generation; load includes expected
        unconstrained EV demand. Errors are autocorrelated and grow with lead
        time; they come from a dedicated RNG keyed on ``(seed, now)`` so calling
        this never changes the simulator state or subsequent ``step`` output.
        """
        if not horizon_hours > 0 or step_minutes <= 0:
            raise ValueError("horizon_hours and step_minutes must be positive")
        cfg = self.config
        step_s = step_minutes * 60.0
        n = max(1, int(round(horizon_hours * 60.0 / step_minutes)))
        t0 = self._now.timestamp()
        starts = t0 + np.arange(n, dtype=np.float64) * step_s
        offsets = sample_grid(0.0, step_s)
        grid_t = starts[:, None] + offsets[None, :]
        pv_true = self._pv_kw(grid_t).mean(axis=1)
        load_true = self._load_kw(grid_t).mean(axis=1)

        fleet = self._ev.clone()
        ev_true = np.array([fleet.deliver(s, s + step_s, None) for s in starts])

        rng = np.random.default_rng([cfg.seed & _SEED_MASK, _FORECAST_STREAM, int(t0)])
        lead_h = (np.arange(n) + 0.5) * step_minutes / 60.0
        growth = np.minimum(lead_h / 24.0, 1.5)
        rho = math.exp(-(step_minutes / 60.0) / _ERR_AUTOCORR_HOURS)
        pv_err = self._ar1(rng, n, rho)
        load_err = self._ar1(rng, n, rho)
        pv_sigma = _PV_ERR_BASE + _PV_ERR_GROWTH * growth
        load_sigma = _LOAD_ERR_BASE + _LOAD_ERR_GROWTH * growth
        pv_fc = np.clip(pv_true * (1.0 + pv_sigma * pv_err), 0.0, cfg.pv.capacity_kwp)
        load_fc = np.clip((load_true + ev_true) * (1.0 + load_sigma * load_err), 0.0, None)

        tariff = cfg.tariff
        start_dt = self._now
        prices = [tariff.import_price_at(start_dt + timedelta(seconds=i * step_s), cfg.timezone)
                  for i in range(n)]
        return Forecast(
            start=start_dt,
            step_minutes=step_minutes,
            pv_kw=[float(x) for x in pv_fc],
            load_kw=[float(x) for x in load_fc],
            import_price=prices,
            export_price=[tariff.export_price_gbp_per_kwh] * n,
        )

    @staticmethod
    def _ar1(rng: np.random.Generator, n: int, rho: float) -> np.ndarray:
        """Unit-variance AR(1) sequence."""
        z = rng.standard_normal(n)
        out = np.empty(n)
        out[0] = z[0]
        k = math.sqrt(1.0 - rho * rho)
        for i in range(1, n):
            out[i] = rho * out[i - 1] + k * z[i]
        return out
