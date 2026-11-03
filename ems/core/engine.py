"""The EMS control loop: forecast -> decide -> simulate -> record -> publish.

Concurrency model
-----------------
All engine state (simulator, controller, history, mode) is guarded by a single
re-entrant :class:`threading.Lock` so the engine can be driven from the asyncio
event loop *and* from worker threads (the API runs long batches of steps in a
thread so the event loop stays responsive). Telemetry is published to
``asyncio.Queue`` subscribers on the loop that created each queue; publishing
from another thread is marshalled with ``loop.call_soon_threadsafe``. Publishing
never blocks: when a subscriber's queue is full the oldest sample is dropped.
"""
from __future__ import annotations

import asyncio
import logging
import math
import threading
import time
from collections import deque
from datetime import datetime, timedelta, timezone

from ems.control import Controller, make_controller
from ems.models import (ControlMode, ControllerContext, DispatchCommand, EngineStatus,
                        Forecast, KPIs, SiteConfig, Telemetry)
from ems.reporting import compute_kpis
from ems.simulator import SiteSimulator

__all__ = ["EMSEngine", "DEFAULT_START"]

logger = logging.getLogger(__name__)

DEFAULT_START = datetime(2026, 6, 1, tzinfo=timezone.utc)
"""Deterministic default simulation start (2026-06-01T00:00Z)."""

FORECAST_HORIZON_HOURS = 24.0
FORECAST_STEP_MINUTES = 15
SUBSCRIBER_QUEUE_SIZE = 256
_PAUSE_POLL_SECONDS = 0.1
_ERROR_BACKOFF_SECONDS = 1.0


class EMSEngine:
    """Runs a site's energy-management control loop against the site simulator.

    Each :meth:`step` builds a :class:`ControllerContext` from the latest telemetry
    (plus a forecast when the mode is OPTIMISED), asks the active controller for a
    :class:`DispatchCommand`, advances the simulator by ``step_seconds`` and records
    the resulting :class:`Telemetry` in a bounded history.

    Args:
        config: site configuration.
        start: simulation start time (UTC); defaults to :data:`DEFAULT_START`.
        mode: initial control mode.
        step_seconds: control interval in simulated seconds.
        history_limit: maximum number of telemetry samples kept in memory.
        sim_speed: simulated seconds per real second for :meth:`run_forever`.
    """

    def __init__(self, config: SiteConfig, start: datetime | None = None,
                 mode: ControlMode = ControlMode.OPTIMISED, step_seconds: float = 300,
                 history_limit: int = 288 * 30, sim_speed: float = 300.0) -> None:
        if not (math.isfinite(step_seconds) and step_seconds > 0):
            raise ValueError("step_seconds must be a positive finite number")
        if history_limit < 1:
            raise ValueError("history_limit must be >= 1")
        if not (math.isfinite(sim_speed) and sim_speed > 0):
            raise ValueError("sim_speed must be a positive finite number")
        start = DEFAULT_START if start is None else start
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        self._lock = threading.RLock()
        self.config: SiteConfig = config
        self.mode: ControlMode = ControlMode(mode)
        self.step_seconds: float = float(step_seconds)
        self.sim_speed: float = float(sim_speed)
        self.running: bool = False
        self.history_limit: int = int(history_limit)
        self._start: datetime = start.astimezone(timezone.utc)
        self._sim = SiteSimulator(config, self._start)
        self._controller: Controller = make_controller(self.mode, config)
        self._history: deque[Telemetry] = deque(maxlen=self.history_limit)
        self._last_command: DispatchCommand | None = None
        self._subscribers: dict[asyncio.Queue[Telemetry], asyncio.AbstractEventLoop | None] = {}
        self._sub_lock = threading.Lock()
        self._task: asyncio.Task[None] | None = None
        self._wake_generation = 0

    # ------------------------------------------------------------------ state

    @property
    def sim_time(self) -> datetime:
        """Current simulation time (UTC)."""
        return self._sim.now

    @property
    def start_time(self) -> datetime:
        """Simulation start time used by :meth:`reset`."""
        return self._start

    @property
    def last_command(self) -> DispatchCommand | None:
        """The most recent dispatch command, if any step has run."""
        return self._last_command

    @property
    def is_looping(self) -> bool:
        """True while the background :meth:`run_forever` task is alive."""
        return self._task is not None and not self._task.done()

    def set_mode(self, mode: ControlMode | str) -> None:
        """Switch control mode; takes effect from the next step.

        Raises:
            ValueError: if ``mode`` is not a valid :class:`ControlMode`.
        """
        m = ControlMode(mode)
        with self._lock:
            if m != self.mode:
                self._controller = make_controller(m, self.config)
                self.mode = m

    def set_speed(self, sim_speed: float) -> None:
        """Set simulated seconds per real second for the background loop."""
        if not (math.isfinite(sim_speed) and sim_speed > 0):
            raise ValueError("sim_speed must be a positive finite number")
        self.sim_speed = float(sim_speed)
        self._wake_generation += 1

    def set_running(self, running: bool) -> None:
        """Pause (False) or resume (True) automatic stepping by :meth:`run_forever`."""
        self.running = bool(running)
        self._wake_generation += 1

    def reset(self, config: SiteConfig | None = None) -> None:
        """Restart the simulation from the start time, optionally with a new site.

        History and the last command are cleared; mode, speed and the running
        flag are kept. Subscribers stay subscribed.
        """
        with self._lock:
            if config is not None:
                self.config = config
            self._sim = SiteSimulator(self.config, self._start)
            self._controller = make_controller(self.mode, self.config)
            self._history.clear()
            self._last_command = None
        self._wake_generation += 1

    # ------------------------------------------------------------------ stepping

    def _initial_telemetry(self) -> Telemetry:
        """Synthesise a zero-flow sample for the interval just before ``now``.

        Its timestamp is ``now - step_seconds`` so that controllers which derive
        the decision time as ``telemetry.timestamp + step_seconds`` act on ``now``.
        """
        ts = self._sim.now - timedelta(seconds=self.step_seconds)
        tariff = self.config.tariff
        return Telemetry(
            timestamp=ts, pv_kw=0.0, pv_curtailed_kw=0.0, load_kw=0.0, ev_kw=0.0,
            battery_kw=0.0, battery_soc=self._sim.soc, grid_kw=0.0,
            import_price_gbp_per_kwh=tariff.import_price_at(ts, self.config.timezone),
            export_price_gbp_per_kwh=tariff.export_price_gbp_per_kwh, mode=self.mode)

    def step(self) -> Telemetry:
        """Run one control interval and return the resulting telemetry."""
        with self._lock:
            latest = self._history[-1] if self._history else self._initial_telemetry()
            forecast: Forecast | None = None
            if self.mode == ControlMode.OPTIMISED:
                forecast = self._sim.forecast(FORECAST_HORIZON_HOURS, FORECAST_STEP_MINUTES)
            ctx = ControllerContext(telemetry=latest, forecast=forecast, config=self.config,
                                    step_seconds=self.step_seconds)
            command = self._controller.decide(ctx)
            telemetry = self._sim.step(command, self.step_seconds, self.mode)
            self._history.append(telemetry)
            self._last_command = command
        self._publish(telemetry)
        return telemetry

    def run(self, steps: int) -> list[Telemetry]:
        """Run ``steps`` control intervals back-to-back and return their telemetry."""
        if steps < 0:
            raise ValueError("steps must be >= 0")
        return [self.step() for _ in range(steps)]

    # ------------------------------------------------------------------ queries

    def history(self, limit: int | None = None) -> list[Telemetry]:
        """Recorded telemetry, oldest first; ``limit`` keeps only the newest samples."""
        with self._lock:
            items = list(self._history)
        if limit is not None:
            if limit <= 0:
                return []
            items = items[-limit:]
        return items

    def kpis(self, last_hours: float | None = None) -> KPIs:
        """KPIs over the recorded history, or over its final ``last_hours`` of sim time.

        Raises:
            ValueError: if there is no history (in the requested window).
        """
        with self._lock:
            items = list(self._history)
            config = self.config
        if last_hours is not None:
            if not last_hours > 0:
                raise ValueError("last_hours must be > 0")
            if items:
                end = items[-1].timestamp + timedelta(seconds=self.step_seconds)
                cutoff = end - timedelta(hours=last_hours)
                items = [t for t in items if t.timestamp >= cutoff]
        if not items:
            raise ValueError("no telemetry history yet")
        return compute_kpis(items, config, self.step_seconds)

    def forecast(self, horizon_hours: float = FORECAST_HORIZON_HOURS,
                 step_minutes: int = FORECAST_STEP_MINUTES) -> Forecast:
        """Forecast from the current sim time (does not disturb the simulation)."""
        with self._lock:
            return self._sim.forecast(horizon_hours, step_minutes)

    def status(self) -> EngineStatus:
        """Snapshot of the engine state."""
        with self._lock:
            return EngineStatus(
                site_id=self.config.site_id, site_name=self.config.name, mode=self.mode,
                sim_time=self._sim.now, sim_speed=self.sim_speed, running=self.running,
                step_seconds=self.step_seconds,
                latest=self._history[-1] if self._history else None,
                last_command=self._last_command)

    # ------------------------------------------------------------------ pub/sub

    def subscribe(self, maxsize: int = SUBSCRIBER_QUEUE_SIZE) -> asyncio.Queue[Telemetry]:
        """Register a queue that receives every new telemetry sample.

        If called from a running event loop, samples produced on other threads
        are delivered via that loop thread-safely.
        """
        queue: asyncio.Queue[Telemetry] = asyncio.Queue(maxsize=max(1, maxsize))
        try:
            loop: asyncio.AbstractEventLoop | None = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        with self._sub_lock:
            self._subscribers[queue] = loop
        return queue

    def unsubscribe(self, queue: asyncio.Queue[Telemetry]) -> None:
        """Stop delivering telemetry to ``queue`` (no-op if not subscribed)."""
        with self._sub_lock:
            self._subscribers.pop(queue, None)

    @property
    def subscriber_count(self) -> int:
        """Number of active subscriber queues."""
        with self._sub_lock:
            return len(self._subscribers)

    @staticmethod
    def _offer(queue: asyncio.Queue[Telemetry], telemetry: Telemetry) -> None:
        """put_nowait, dropping the oldest item if the queue is full."""
        while True:
            try:
                queue.put_nowait(telemetry)
                return
            except asyncio.QueueFull:
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:  # pragma: no cover - race with consumer
                    pass

    def _publish(self, telemetry: Telemetry) -> None:
        with self._sub_lock:
            subs = list(self._subscribers.items())
        if not subs:
            return
        try:
            current: asyncio.AbstractEventLoop | None = asyncio.get_running_loop()
        except RuntimeError:
            current = None
        for queue, loop in subs:
            try:
                if loop is None or loop is current:
                    self._offer(queue, telemetry)
                elif loop.is_closed():
                    self.unsubscribe(queue)
                else:
                    loop.call_soon_threadsafe(self._offer, queue, telemetry)
            except Exception:  # never let a subscriber break the control loop
                logger.exception("failed to publish telemetry to a subscriber")

    # ------------------------------------------------------------------ background loop

    async def run_forever(self) -> None:
        """Step every ``step_seconds / sim_speed`` real seconds while ``running``.

        Steps run in a worker thread so the event loop stays responsive. Errors
        are logged and the loop continues. Cancel the task (see :meth:`stop`) to exit.
        """
        while True:
            if not self.running:
                await asyncio.sleep(_PAUSE_POLL_SECONDS)
                continue
            began = time.monotonic()
            try:
                await asyncio.to_thread(self.step)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("EMS step failed; continuing")
                await asyncio.sleep(_ERROR_BACKOFF_SECONDS)
                continue
            generation = self._wake_generation
            while self.running and generation == self._wake_generation:
                remaining = self.step_seconds / self.sim_speed - (time.monotonic() - began)
                if remaining <= 0:
                    break
                await asyncio.sleep(min(remaining, _PAUSE_POLL_SECONDS))
            await asyncio.sleep(0)

    def start(self) -> asyncio.Task[None]:
        """Set ``running`` and start the background loop on the current event loop.

        Idempotent: returns the existing task if the loop is already alive.
        Must be called from within a running event loop.
        """
        self.set_running(True)
        if self._task is None or self._task.done():
            self._task = asyncio.get_running_loop().create_task(
                self.run_forever(), name="ems-engine-loop")
        return self._task

    async def stop(self) -> None:
        """Clear ``running`` and cancel the background loop, waiting for it to exit."""
        self.set_running(False)
        task, self._task = self._task, None
        if task is None or task.done():
            return
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
