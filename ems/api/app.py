"""FastAPI application exposing the EMS engine over HTTP and WebSocket."""
from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

from ems.core import EMSEngine
from ems.models import ControlMode, EngineStatus, Forecast, KPIs, SiteConfig, Telemetry
from ems.presets import PRESETS, demo_warehouse

__all__ = ["create_app", "STATIC_DIR", "ResetRequest", "ModeRequest", "SimRequest",
           "StepRequest"]

logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).resolve().parent.parent / "dashboard" / "static"
"""Directory holding the dashboard's index.html, app.js and styles.css."""

MAX_STEPS_PER_REQUEST = 2016


class _Request(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ResetRequest(_Request):
    """Body of ``POST /api/reset``: optionally switch to a named preset."""

    preset: str | None = None


class ModeRequest(_Request):
    """Body of ``POST /api/mode``."""

    mode: ControlMode


class SimRequest(_Request):
    """Body of ``POST /api/sim``: change sim speed and/or pause/resume."""

    speed: float | None = Field(default=None, ge=1, le=86400)
    running: bool | None = None


class StepRequest(_Request):
    """Body of ``POST /api/step``: run this many control steps immediately."""

    steps: int = Field(default=1, ge=1, le=MAX_STEPS_PER_REQUEST)


def create_app(engine: EMSEngine | None = None, autostart: bool = True) -> FastAPI:
    """Build the EMS web application.

    Args:
        engine: the engine to serve; defaults to ``EMSEngine(demo_warehouse())``.
        autostart: start the engine's background loop during application lifespan.
    """
    eng = engine if engine is not None else EMSEngine(demo_warehouse())

    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if autostart:
            eng.start()
        try:
            yield
        finally:
            if autostart:
                await eng.stop()

    app = FastAPI(title="Site EMS", version="0.1.0", lifespan=lifespan)
    app.state.engine = eng

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        """Liveness probe."""
        return {"status": "ok"}

    @app.get("/api/status", response_model=EngineStatus)
    async def status() -> EngineStatus:
        """Current engine state, latest telemetry and last command."""
        return eng.status()

    @app.get("/api/config", response_model=SiteConfig)
    async def config() -> SiteConfig:
        """The active site configuration."""
        return eng.config

    @app.get("/api/presets", response_model=list[str])
    async def presets() -> list[str]:
        """Names of the built-in site presets."""
        return sorted(PRESETS)

    @app.post("/api/reset", response_model=EngineStatus)
    async def reset(body: ResetRequest | None = None) -> EngineStatus:
        """Restart the simulation, optionally switching to a preset site."""
        new_config: SiteConfig | None = None
        if body is not None and body.preset is not None:
            factory = PRESETS.get(body.preset)
            if factory is None:
                raise HTTPException(status_code=404, detail=f"unknown preset '{body.preset}'")
            new_config = factory()
        await asyncio.to_thread(eng.reset, new_config)
        return eng.status()

    @app.get("/api/history", response_model=list[Telemetry])
    async def history(limit: int = Query(default=288, ge=1, le=1_000_000)) -> list[Telemetry]:
        """The newest ``limit`` telemetry samples, oldest first."""
        return eng.history(limit)

    @app.get("/api/kpis", response_model=KPIs)
    async def kpis(hours: float | None = Query(default=None, gt=0, le=24 * 366)) -> KPIs:
        """KPIs over the whole history or its final ``hours``; 409 if no history yet."""
        try:
            return await asyncio.to_thread(eng.kpis, hours)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.get("/api/forecast", response_model=Forecast)
    async def forecast(hours: float = Query(default=24, gt=0, le=168)) -> Forecast:
        """Forecast of PV, load and prices from the current sim time."""
        return await asyncio.to_thread(eng.forecast, hours)

    @app.post("/api/mode", response_model=EngineStatus)
    async def set_mode(body: ModeRequest) -> EngineStatus:
        """Switch the control mode (422 on an unknown mode)."""
        eng.set_mode(body.mode)
        return eng.status()

    @app.post("/api/sim", response_model=EngineStatus)
    async def set_sim(body: SimRequest) -> EngineStatus:
        """Change simulation speed and/or pause/resume automatic stepping."""
        if body.speed is not None:
            eng.set_speed(body.speed)
        if body.running is not None:
            eng.set_running(body.running)
        return eng.status()

    @app.post("/api/step", response_model=EngineStatus)
    async def step(body: StepRequest | None = None) -> EngineStatus:
        """Run ``steps`` control intervals now (in a worker thread)."""
        steps = body.steps if body is not None else 1
        await asyncio.to_thread(eng.run, steps)
        return eng.status()

    @app.websocket("/ws/telemetry")
    async def ws_telemetry(websocket: WebSocket) -> None:
        """Push ``{"type": "telemetry", "data": Telemetry}`` for every engine step."""
        await websocket.accept()
        queue = eng.subscribe()
        receiver = asyncio.create_task(_drain_client(websocket))
        getter: asyncio.Task[Telemetry] | None = None
        try:
            while True:
                getter = asyncio.create_task(queue.get())
                done, _ = await asyncio.wait({getter, receiver},
                                             return_when=asyncio.FIRST_COMPLETED)
                if receiver in done:
                    break
                telemetry = getter.result()
                await websocket.send_json(
                    {"type": "telemetry", "data": telemetry.model_dump(mode="json")})
        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            eng.unsubscribe(queue)
            for task in (getter, receiver):
                if task is not None and not task.done():
                    task.cancel()
                    with contextlib.suppress(asyncio.CancelledError, Exception):
                        await task

    if STATIC_DIR.is_dir():
        app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/", include_in_schema=False)
    async def index() -> FileResponse:
        """Serve the dashboard."""
        path = STATIC_DIR / "index.html"
        if not path.is_file():
            raise HTTPException(status_code=404, detail="dashboard not installed")
        return FileResponse(path, media_type="text/html")

    return app


async def _drain_client(websocket: WebSocket) -> None:
    """Consume (and ignore) client messages until the socket disconnects."""
    while True:
        message = await websocket.receive()
        if message.get("type") == "websocket.disconnect":
            return
