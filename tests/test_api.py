"""Tests for ems.api.create_app: every endpoint, error codes, static dashboard and WebSocket."""
from __future__ import annotations

import threading
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from ems.api import create_app, websocket_supported
from ems.core import DEFAULT_START, EMSEngine
from ems.models import (ControlMode, EngineStatus, Forecast, KPIs, SiteConfig, Telemetry)
from ems.presets import PRESETS, demo_warehouse


@pytest.fixture
def engine() -> EMSEngine:
    return EMSEngine(demo_warehouse(), mode=ControlMode.SELF_CONSUMPTION)


@pytest.fixture
def client(engine: EMSEngine):
    with TestClient(create_app(engine, autostart=False)) as c:
        yield c


def test_default_engine_is_demo_warehouse() -> None:
    app = create_app(autostart=False)
    with TestClient(app) as c:
        status = EngineStatus.model_validate(c.get("/api/status").json())
    assert status.site_id == "demo-warehouse"
    assert status.mode == ControlMode.OPTIMISED
    assert app.state.engine.running is False


def test_health(client: TestClient) -> None:
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "websocket": websocket_supported()}


@pytest.mark.parametrize("flag", [True, False])
def test_health_reports_websocket_override(flag: bool) -> None:
    with TestClient(create_app(EMSEngine(demo_warehouse()), autostart=False,
                               websocket=flag)) as c:
        assert c.get("/api/health").json() == {"status": "ok", "websocket": flag}


def test_status_initial(client: TestClient) -> None:
    s = EngineStatus.model_validate(client.get("/api/status").json())
    assert s.sim_time == DEFAULT_START
    assert s.running is False and s.latest is None and s.last_command is None
    assert s.mode == ControlMode.SELF_CONSUMPTION


def test_config(client: TestClient) -> None:
    cfg = SiteConfig.model_validate(client.get("/api/config").json())
    assert cfg == demo_warehouse()


def test_presets(client: TestClient) -> None:
    assert client.get("/api/presets").json() == sorted(PRESETS)


def test_step_then_history(client: TestClient) -> None:
    r = client.post("/api/step", json={"steps": 12})
    assert r.status_code == 200
    s = EngineStatus.model_validate(r.json())
    assert s.sim_time == DEFAULT_START + timedelta(hours=1)
    assert s.latest is not None and s.last_command is not None

    hist = client.get("/api/history").json()
    assert len(hist) == 12
    samples = [Telemetry.model_validate(h) for h in hist]
    assert samples[0].timestamp == DEFAULT_START
    assert all(abs(t.balance_error_kw()) < 1e-6 for t in samples)

    assert len(client.get("/api/history", params={"limit": 5}).json()) == 5
    assert client.get("/api/history", params={"limit": 5}).json() == hist[-5:]

    # default body = 1 step
    r = client.post("/api/step")
    assert r.status_code == 200
    assert len(client.get("/api/history").json()) == 13


@pytest.mark.parametrize("body", [{"steps": 0}, {"steps": 2017}, {"steps": "many"},
                                  {"steps": 1, "extra": True}])
def test_step_invalid(client: TestClient, body: dict) -> None:
    assert client.post("/api/step", json=body).status_code == 422


def test_history_invalid_limit(client: TestClient) -> None:
    assert client.get("/api/history", params={"limit": 0}).status_code == 422
    assert client.get("/api/history", params={"limit": "x"}).status_code == 422


def test_kpis_409_then_200(client: TestClient) -> None:
    r = client.get("/api/kpis")
    assert r.status_code == 409
    client.post("/api/step", json={"steps": 24})
    k = KPIs.model_validate(client.get("/api/kpis").json())
    assert k.hours == pytest.approx(2.0)
    k1 = KPIs.model_validate(client.get("/api/kpis", params={"hours": 1}).json())
    assert k1.hours == pytest.approx(1.0)
    # A window shorter than one control step still covers the latest interval.
    short = client.get("/api/kpis", params={"hours": 0.0001})
    assert short.status_code == 200
    assert KPIs.model_validate(short.json()).hours == pytest.approx(300 / 3600)
    assert client.get("/api/kpis", params={"hours": 0}).status_code == 422
    assert client.get("/api/kpis", params={"hours": "abc"}).status_code == 422


def test_forecast(client: TestClient) -> None:
    fc = Forecast.model_validate(client.get("/api/forecast").json())
    assert fc.start == DEFAULT_START and fc.step_minutes == 15
    assert len(fc.pv_kw) == len(fc.load_kw) == len(fc.import_price) == 96
    fc6 = Forecast.model_validate(client.get("/api/forecast", params={"hours": 6}).json())
    assert len(fc6.pv_kw) == 24
    assert client.get("/api/forecast", params={"hours": -1}).status_code == 422


def test_mode(client: TestClient, engine: EMSEngine) -> None:
    r = client.post("/api/mode", json={"mode": "peak_shaving"})
    assert r.status_code == 200
    assert r.json()["mode"] == "peak_shaving"
    assert engine.mode == ControlMode.PEAK_SHAVING
    client.post("/api/step", json={"steps": 1})
    assert client.get("/api/history").json()[-1]["mode"] == "peak_shaving"
    for bad in ({"mode": "turbo"}, {}, {"mode": None}):
        assert client.post("/api/mode", json=bad).status_code == 422
    assert engine.mode == ControlMode.PEAK_SHAVING


def test_sim(client: TestClient, engine: EMSEngine) -> None:
    r = client.post("/api/sim", json={"speed": 600})
    assert r.status_code == 200 and r.json()["sim_speed"] == 600
    assert r.json()["running"] is False
    r = client.post("/api/sim", json={"running": True})
    assert r.json()["running"] is True and r.json()["sim_speed"] == 600
    r = client.post("/api/sim", json={})
    assert r.status_code == 200
    r = client.post("/api/sim", json={"speed": 3600, "running": False})
    assert r.json()["sim_speed"] == 3600 and r.json()["running"] is False
    assert engine.sim_speed == 3600
    for bad in ({"speed": 0}, {"speed": 86401}, {"running": "maybe"}, {"speed": "fast"}):
        assert client.post("/api/sim", json=bad).status_code == 422
    assert engine.sim_speed == 3600


def test_reset(client: TestClient, engine: EMSEngine) -> None:
    client.post("/api/step", json={"steps": 5})
    r = client.post("/api/reset")
    assert r.status_code == 200
    s = EngineStatus.model_validate(r.json())
    assert s.sim_time == DEFAULT_START and s.latest is None
    assert client.get("/api/history").json() == []

    client.post("/api/step", json={"steps": 2})
    r = client.post("/api/reset", json={"preset": "demo-office"})
    assert r.status_code == 200
    assert r.json()["site_id"] == "demo-office"
    assert client.get("/api/config").json()["site_id"] == "demo-office"
    assert client.get("/api/history").json() == []

    r = client.post("/api/reset", json={})
    assert r.status_code == 200 and r.json()["site_id"] == "demo-office"


def test_reset_unknown_preset_404(client: TestClient) -> None:
    r = client.post("/api/reset", json={"preset": "nowhere"})
    assert r.status_code == 404
    assert client.get("/api/config").json()["site_id"] == "demo-warehouse"
    assert client.post("/api/reset", json={"preset": 5}).status_code == 422


def test_dashboard_served(client: TestClient) -> None:
    r = client.get("/")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    assert "<html" in r.text.lower()
    for name, ctype in (("app.js", "javascript"), ("styles.css", "text/css"),
                        ("index.html", "text/html")):
        rs = client.get(f"/static/{name}")
        assert rs.status_code == 200 and ctype in rs.headers["content-type"]
    assert client.get("/static/missing.js").status_code == 404


def test_websocket_receives_telemetry_after_step(client: TestClient,
                                                 engine: EMSEngine) -> None:
    with client.websocket_connect("/ws/telemetry") as ws:
        # wait for the handler to subscribe before driving a step
        for _ in range(200):
            if engine.subscriber_count:
                break
            threading.Event().wait(0.01)
        assert engine.subscriber_count == 1
        r = client.post("/api/step", json={"steps": 2})
        assert r.status_code == 200
        msgs = [ws.receive_json(), ws.receive_json()]
        for msg in msgs:
            assert msg["type"] == "telemetry"
            Telemetry.model_validate(msg["data"])
        hist = client.get("/api/history").json()
        assert [m["data"] for m in msgs] == hist[-2:]
    for _ in range(200):
        if engine.subscriber_count == 0:
            break
        threading.Event().wait(0.01)
    assert engine.subscriber_count == 0


def test_autostart_runs_and_stops_loop() -> None:
    engine = EMSEngine(demo_warehouse(), mode=ControlMode.IDLE, sim_speed=30000)
    with TestClient(create_app(engine, autostart=True)) as c:
        assert c.get("/api/status").json()["running"] is True
        for _ in range(300):
            if len(c.get("/api/history").json()) >= 2:
                break
            threading.Event().wait(0.01)
        assert len(c.get("/api/history").json()) >= 2
    assert engine.running is False and not engine.is_looping
