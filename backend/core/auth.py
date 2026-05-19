"""
GitHub Mirror - API Key Authentication Middleware
Extracted from app.py (lines 62-108).
"""

import hmac
import logging
from typing import Set

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from backend.config import settings

logger = logging.getLogger("github-mirror.auth")

API_KEY_HEADER = "X-API-Key"

_PUBLIC_PATHS: Set[str] = {
    "/", "/health", "/docs", "/openapi.json", "/redoc",
}


def _is_public_path(path: str) -> bool:
    if path in _PUBLIC_PATHS:
        return True
    if path.startswith("/mcp/sse"):
        return True
    if path == "/mcp":
        return True
    if path.startswith("/assets/"):
        return True
    return False


def setup_auth_middleware(app: FastAPI) -> None:
    @app.middleware("http")
    async def api_key_middleware(request: Request, call_next):
        api_key_value = settings.api_key
        if not api_key_value:
            return await call_next(request)
        path = request.url.path
        if _is_public_path(path):
            return await call_next(request)
        api_key = request.headers.get(API_KEY_HEADER, "")
        if not api_key:
            api_key = request.query_params.get("api_key", "")
        if not hmac.compare_digest(api_key, api_key_value):
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing API key. Provide X-API-Key header."},
            )
        return await call_next(request)
