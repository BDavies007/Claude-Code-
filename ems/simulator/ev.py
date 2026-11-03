"""EV / fleet charging sessions.

Sessions are generated per local calendar day from a seeded RNG keyed on
``(seed, date)``, so the arrival pattern is deterministic and independent of
stepping. Charging state (energy remaining per session) is mutable and lives in
:class:`EVFleet`, which can be cloned for look-ahead without disturbing the
original.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo

import numpy as np

from ..models import EVConfig

_EPS_KWH = 1e-9
_SEED_MASK = (1 << 63) - 1


@dataclass
class EVSession:
    """One vehicle visit: arrives, charges until done or departure."""

    arrival: float        # UTC epoch seconds
    departure: float      # UTC epoch seconds
    remaining_kwh: float


@lru_cache(maxsize=4096)
def _sessions_for_date(seed: int, tz_name: str, ordinal: int, sessions_per_day: int,
                       kwh_per_session: float) -> tuple[tuple[float, float, float], ...]:
    """Immutable (arrival, departure, kwh) tuples for one local calendar day."""
    if sessions_per_day <= 0 or kwh_per_session <= 0:
        return ()
    rng = np.random.default_rng([seed & _SEED_MASK, 3, ordinal])
    d = date.fromordinal(ordinal)
    midnight = datetime.combine(d, time(0), tzinfo=ZoneInfo(tz_name)).timestamp()
    n = int(rng.poisson(sessions_per_day))
    out: list[tuple[float, float, float]] = []
    for _ in range(n):
        u = rng.random()
        if u < 0.70:        # fleet returning in the evening, stays overnight
            arr_h = rng.triangular(17.0, 18.5, 23.0)
            dep_h = 24.0 + rng.uniform(6.0, 8.0)
        elif u < 0.90:      # early-morning top-up before the day's routes
            arr_h = rng.uniform(5.0, 8.0)
            dep_h = arr_h + rng.uniform(2.0, 5.0)
        else:               # daytime opportunistic charge
            arr_h = rng.uniform(9.0, 16.0)
            dep_h = arr_h + rng.uniform(1.5, 4.0)
        kwh = kwh_per_session * rng.uniform(0.6, 1.4)
        out.append((midnight + arr_h * 3600.0, midnight + dep_h * 3600.0, float(kwh)))
    out.sort()
    return tuple(out)


class EVFleet:
    """Mutable charging state for a site's EV chargers."""

    def __init__(self, config: EVConfig, seed: int, tz_name: str, start_epoch: float) -> None:
        self.config = config
        self.seed = seed
        self.tz_name = tz_name
        self.start_epoch = start_epoch
        self.sessions: list[EVSession] = []
        self._next_ordinal = self._local_ordinal(start_epoch)

    def _local_ordinal(self, epoch: float) -> int:
        return datetime.fromtimestamp(epoch, tz=timezone.utc).astimezone(ZoneInfo(self.tz_name)).date().toordinal()

    def clone(self) -> "EVFleet":
        """Independent copy (for look-ahead simulation)."""
        other = EVFleet.__new__(EVFleet)
        other.config = self.config
        other.seed = self.seed
        other.tz_name = self.tz_name
        other.start_epoch = self.start_epoch
        other.sessions = [EVSession(s.arrival, s.departure, s.remaining_kwh) for s in self.sessions]
        other._next_ordinal = self._next_ordinal
        return other

    def _ensure_generated(self, until_epoch: float) -> None:
        last = self._local_ordinal(until_epoch)
        while self._next_ordinal <= last:
            for arr, dep, kwh in _sessions_for_date(self.seed, self.tz_name, self._next_ordinal,
                                                    self.config.sessions_per_day,
                                                    float(self.config.kwh_per_session)):
                if arr >= self.start_epoch:
                    self.sessions.append(EVSession(arr, dep, kwh))
            self._next_ordinal += 1

    def _plugged_in(self, t0: float, t1: float) -> list[tuple[EVSession, float]]:
        """Sessions occupying a charger in [t0, t1) and the fraction of the interval present."""
        self._ensure_generated(t1)
        self.sessions = [s for s in self.sessions if s.departure > t0 and s.remaining_kwh > _EPS_KWH]
        dt = t1 - t0
        out: list[tuple[EVSession, float]] = []
        for s in sorted(self.sessions, key=lambda s: s.arrival):
            if len(out) >= self.config.num_chargers:
                break
            if s.arrival >= t1:
                break
            frac = (min(t1, s.departure) - max(t0, s.arrival)) / dt
            if frac > 0:
                out.append((s, min(frac, 1.0)))
        return out

    def _demands(self, t0: float, t1: float) -> list[tuple[EVSession, float]]:
        dt_h = (t1 - t0) / 3600.0
        kw = self.config.charger_kw
        return [(s, min(kw * frac, s.remaining_kwh / dt_h)) for s, frac in self._plugged_in(t0, t1)]

    def demand_kw(self, t0: float, t1: float) -> float:
        """Average unconstrained charging demand over [t0, t1) (does not deliver energy)."""
        return float(sum(d for _, d in self._demands(t0, t1)))

    def deliver(self, t0: float, t1: float, limit_kw: float | None) -> float:
        """Charge plugged-in vehicles over [t0, t1), capped at ``limit_kw`` total.

        Returns the average power delivered (kW). Curtailment is shared pro rata.
        """
        demands = self._demands(t0, t1)
        total = sum(d for _, d in demands)
        if total <= 0:
            return 0.0
        delivered = total if limit_kw is None else min(total, max(limit_kw, 0.0))
        scale = delivered / total
        dt_h = (t1 - t0) / 3600.0
        for s, d in demands:
            s.remaining_kwh = max(0.0, s.remaining_kwh - d * scale * dt_h)
        return float(delivered)


__all__ = ["EVFleet", "EVSession"]
