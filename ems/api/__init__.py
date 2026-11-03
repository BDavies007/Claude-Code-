"""HTTP/WebSocket API (FastAPI) for the EMS engine and dashboard."""
from .app import create_app

__all__ = ["create_app"]
