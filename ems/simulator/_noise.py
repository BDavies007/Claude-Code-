"""Stateless, time-keyed deterministic noise.

The simulator's "truth" signals (cloud cover, load noise) are pure functions of
``(seed, stream, time)``. This makes them independent of how the clock is
stepped (one 1-hour step or twelve 5-minute steps see the same weather) and lets
the forecaster evaluate the truth without touching any mutable RNG state.
"""
from __future__ import annotations

import numpy as np
from numpy.typing import ArrayLike, NDArray

_MASK64 = (1 << 64) - 1
_GOLDEN = np.uint64(0x9E3779B97F4A7C15)
_MIX1 = np.uint64(0xBF58476D1CE4E5B9)
_MIX2 = np.uint64(0x94D049BB133111EB)


def hash_uniform(seed: int, stream: int, keys: ArrayLike) -> NDArray[np.float64]:
    """Map integer ``keys`` to uniform floats in [0, 1) via a splitmix64 hash.

    Same ``(seed, stream, key)`` always yields the same value.
    """
    k = np.asarray(keys, dtype=np.int64).astype(np.uint64)
    s = np.uint64(seed & _MASK64)
    st = np.uint64(stream & _MASK64)
    with np.errstate(over="ignore"):
        x = k * _GOLDEN ^ (s * _MIX1) ^ (st * _MIX2 + _GOLDEN)
        x = x ^ (x >> np.uint64(30))
        x = x * _MIX1
        x = x ^ (x >> np.uint64(27))
        x = x * _MIX2
        x = x ^ (x >> np.uint64(31))
    return (x >> np.uint64(11)).astype(np.float64) * (1.0 / (1 << 53))


def value_noise(seed: int, stream: int, t: ArrayLike, period_s: float) -> NDArray[np.float64]:
    """Smooth noise in [-1, 1]: smoothstep interpolation between random knots
    placed every ``period_s`` seconds of absolute (epoch) time ``t``."""
    x = np.asarray(t, dtype=np.float64) / period_s
    k = np.floor(x)
    f = x - k
    f = f * f * (3.0 - 2.0 * f)
    a = hash_uniform(seed, stream, k) * 2.0 - 1.0
    b = hash_uniform(seed, stream, k + 1) * 2.0 - 1.0
    return a + (b - a) * f
