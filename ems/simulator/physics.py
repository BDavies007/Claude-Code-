"""Vectorised physical models: clear-sky PV with cloud cover, and building load.

All functions take absolute UTC epoch seconds (numpy arrays) and are pure:
results depend only on the inputs and the seed.
"""
from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo

import numpy as np
from numpy.typing import NDArray

from ..models import LoadConfig, PVConfig
from ._noise import hash_uniform, value_noise

# Plane-of-array gain of a modestly tilted south-facing array over horizontal GHI.
TILT_GAIN = 1.08

# Noise streams (arbitrary distinct integers).
_S_CLOUD_DAY = 101
_S_CLOUD_LEVEL = 102
_S_CLOUD_INTRADAY = 103
_S_LOAD_SLOW = 201
_S_LOAD_FAST = 202

# Piecewise-linear load shapes: (local hour, fraction of the base->peak range).
_SHAPES: dict[str, tuple[tuple[float, float], ...]] = {
    "warehouse_weekday": ((0, 0), (6, 0), (7, 1), (17, 1), (19, 0.45), (22, 0.45), (23, 0), (24, 0)),
    "warehouse_weekend": ((0, 0), (6, 0), (7, 0.35), (17, 0.35), (19, 0.15), (22, 0.1), (23, 0), (24, 0)),
    "office_weekday": ((0, 0), (7, 0), (8, 0.85), (12, 1), (13, 0.9), (14, 1), (17, 0.9), (18, 0.35),
                       (19, 0.1), (24, 0)),
    "office_weekend": ((0, 0), (9, 0), (10, 0.1), (16, 0.1), (17, 0), (24, 0)),
    "retail_weekday": ((0, 0), (8, 0), (9, 0.8), (13, 1), (17, 1), (20, 0.85), (21, 0.2), (22, 0), (24, 0)),
    "retail_sunday": ((0, 0), (9, 0), (10, 0.75), (16, 0.95), (17, 0.2), (18, 0), (24, 0)),
}


@lru_cache(maxsize=65536)
def _utc_offset_for_hour(tz_name: str, epoch_hour: int) -> float:
    ts = datetime.fromtimestamp(epoch_hour * 3600, tz=timezone.utc)
    off = ts.astimezone(ZoneInfo(tz_name)).utcoffset()
    return off.total_seconds() if off is not None else 0.0


def local_epoch(t: NDArray[np.float64], tz_name: str) -> NDArray[np.float64]:
    """Shift UTC epoch seconds to "local wall-clock epoch" seconds (DST aware)."""
    hours, inverse = np.unique(np.floor(t / 3600.0).astype(np.int64), return_inverse=True)
    offsets = np.array([_utc_offset_for_hour(tz_name, int(h)) for h in hours], dtype=np.float64)
    return t + offsets[inverse.reshape(t.shape)]


def standard_longitude(tz_name: str, at: datetime) -> float:
    """Approximate site longitude (deg E) from the timezone's standard UTC offset."""
    local = at.astimezone(ZoneInfo(tz_name))
    off = local.utcoffset()
    dst = local.dst()
    std = (off.total_seconds() if off else 0.0) - (dst.total_seconds() if dst else 0.0)
    return std / 3600.0 * 15.0


def cos_zenith(t: NDArray[np.float64], latitude_deg: float, longitude_deg: float) -> NDArray[np.float64]:
    """Cosine of the solar zenith angle (NOAA approximations)."""
    # Fractional day of the tropical year, 0-based from 1 January (2000-01-01 = epoch day 10957).
    doy = np.mod(t / 86400.0 - 10957.0, 365.2422)
    g = 2.0 * np.pi / 365.0 * doy
    decl = (0.006918 - 0.399912 * np.cos(g) + 0.070257 * np.sin(g) - 0.006758 * np.cos(2 * g)
            + 0.000907 * np.sin(2 * g) - 0.002697 * np.cos(3 * g) + 0.00148 * np.sin(3 * g))
    eot_min = 229.18 * (0.000075 + 0.001868 * np.cos(g) - 0.032077 * np.sin(g)
                        - 0.014615 * np.cos(2 * g) - 0.040849 * np.sin(2 * g))
    utc_min = np.mod(t, 86400.0) / 60.0
    true_solar_min = utc_min + eot_min + 4.0 * longitude_deg
    hour_angle = np.deg2rad(true_solar_min / 4.0 - 180.0)
    lat = np.deg2rad(latitude_deg)
    return np.sin(lat) * np.sin(decl) + np.cos(lat) * np.cos(decl) * np.cos(hour_angle)


def clear_sky_ghi(cosz: NDArray[np.float64]) -> NDArray[np.float64]:
    """Haurwitz clear-sky global horizontal irradiance (W/m^2)."""
    c = np.clip(cosz, 0.0, None)
    with np.errstate(divide="ignore", invalid="ignore"):
        ghi = 1098.0 * c * np.exp(-0.059 / np.where(c > 0, c, 1.0))
    return np.where(c > 0.0, ghi, 0.0)


def cloud_factor(t: NDArray[np.float64], seed: int) -> NDArray[np.float64]:
    """Fraction of clear-sky irradiance reaching the array (0.05..1).

    Each UTC day is drawn as clear, mixed or dull, with smooth intra-day variation.
    """
    day = np.floor(t / 86400.0).astype(np.int64)
    u_kind = hash_uniform(seed, _S_CLOUD_DAY, day)
    u_lvl = hash_uniform(seed, _S_CLOUD_LEVEL, day)
    clear = u_kind < 0.40
    mixed = (u_kind >= 0.40) & (u_kind < 0.75)
    level = np.where(clear, 0.90 + 0.10 * u_lvl, np.where(mixed, 0.55 + 0.30 * u_lvl, 0.15 + 0.30 * u_lvl))
    var = np.where(clear, 0.03, np.where(mixed, 0.25, 0.08))
    wobble = value_noise(seed, _S_CLOUD_INTRADAY, t, 1200.0)
    return np.clip(level + var * wobble, 0.05, 1.0)


def pv_available_kw(t: NDArray[np.float64], pv: PVConfig, latitude: float, longitude: float,
                    seed: int) -> NDArray[np.float64]:
    """Available (pre-curtailment) PV power at instants ``t``."""
    if pv.capacity_kwp <= 0:
        return np.zeros_like(t, dtype=np.float64)
    ghi = clear_sky_ghi(cos_zenith(t, latitude, longitude))
    kw = pv.capacity_kwp * ghi / 1000.0 * pv.performance_ratio * TILT_GAIN * cloud_factor(t, seed)
    return np.clip(kw, 0.0, pv.capacity_kwp)


def _shape_fraction(profile: str, local_t: NDArray[np.float64]) -> NDArray[np.float64]:
    hour = np.mod(local_t, 86400.0) / 3600.0
    weekday = (np.floor(local_t / 86400.0).astype(np.int64) + 3) % 7  # Monday = 0
    out = np.empty_like(hour)
    if profile == "retail":
        groups = (("retail_weekday", weekday < 6), ("retail_sunday", weekday == 6))
    else:
        groups = ((f"{profile}_weekday", weekday < 5), (f"{profile}_weekend", weekday >= 5))
    for key, mask in groups:
        xs, ys = zip(*_SHAPES[key])
        out[mask] = np.interp(hour[mask], xs, ys)
    return out


def building_load_kw(t: NDArray[np.float64], load: LoadConfig, tz_name: str, seed: int) -> NDArray[np.float64]:
    """Building load (excluding EV) at instants ``t``, with smooth seeded noise."""
    frac = _shape_fraction(load.profile, local_epoch(t, tz_name))
    span = max(load.peak_load_kw - load.base_load_kw, 0.0)
    kw = load.base_load_kw + frac * span
    noise = 1.0 + 0.05 * value_noise(seed, _S_LOAD_SLOW, t, 900.0) + 0.02 * value_noise(seed, _S_LOAD_FAST, t, 300.0)
    return np.clip(kw * noise, 0.0, None)


def sample_grid(t0: float, dt_seconds: float, max_sub_s: float = 300.0) -> NDArray[np.float64]:
    """Midpoints of equal sub-intervals (each <= ``max_sub_s``) of [t0, t0+dt)."""
    n = max(1, int(np.ceil(dt_seconds / max_sub_s - 1e-9)))
    return t0 + (np.arange(n, dtype=np.float64) + 0.5) * (dt_seconds / n)
