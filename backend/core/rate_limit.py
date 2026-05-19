"""
GitHub Mirror - Rate Limit Middleware
Extracted from app.py (lines 111-144).
"""

import logging
import time
from collections import defaultdict
from typing import Dict, List

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.core.auth import _is_public_path

logger = logging.getLogger("github-mirror.rate_limit")

_rate_limit_store: Dict[str, List[float]] = defaultdict(list)


def setup_rate_limit_middleware(app: FastAPI) -> None:
    @app.middleware("http")
    async def rate_limit_middleware(request: Request, call_next):
        if not settings.rate_limit_enabled:
            return await call_next(request)
        path = request.url.path
        if _is_public_path(path):
            return await call_next(request)
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        _rate_limit_store[client_ip] = [t for t in _rate_limit_store[client_ip] if now - t < settings.rate_limit_window]
        if len(_rate_limit_store[client_ip]) >= settings.rate_limit_max:
            return JSONResponse(status_code=429, content={"detail": f"Rate limit exceeded. Max {settings.rate_limit_max} requests per {settings.rate_limit_window}s."})
        _rate_limit_store[client_ip].append(now)
        return await call_next(request)
