"""
GitHub Mirror - Cache Layer
Extracted from app.py (lines 297-389).
"""

import json as _json
import logging
import time
from typing import Any, Dict, Optional, Tuple

from fastapi import FastAPI, Request
from starlette.responses import Response

from backend.config import settings

logger = logging.getLogger("github-mirror.cache")


class TTLCache:
    def __init__(self, default_ttl: int = 300, max_size: int = 1000) -> None:
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self._default_ttl = default_ttl
        self._max_size = max_size

    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            value, expire_at = self._cache[key]
            if time.time() < expire_at:
                return value
            del self._cache[key]
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        if len(self._cache) >= self._max_size and key not in self._cache:
            oldest_key = min(self._cache, key=lambda k: self._cache[k][1])
            del self._cache[oldest_key]
        expire_at = time.time() + (ttl if ttl is not None else self._default_ttl)
        self._cache[key] = (value, expire_at)

    def invalidate(self, prefix: str) -> None:
        keys_to_delete = [k for k in self._cache if k.startswith(prefix)]
        for k in keys_to_delete:
            del self._cache[k]

    def clear(self) -> None:
        self._cache.clear()

    def stats(self) -> Dict[str, int]:
        return {"entries": len(self._cache), "max_size": self._max_size}


api_cache = TTLCache(default_ttl=settings.cache_default_ttl, max_size=settings.cache_max_size)

CACHE_CONFIG: Dict[str, int] = {
    "/api/github/user": 300,
    "/api/github/repos": 120,
    "/api/github/rate_limit": 60,
}


def setup_cache_middleware(app: FastAPI) -> None:
    @app.middleware("http")
    async def cache_middleware(request: Request, call_next):
        path = request.url.path
        method = request.method
        if method in ("POST", "PUT", "PATCH", "DELETE"):
            for prefix in list(CACHE_CONFIG.keys()):
                if path.startswith(prefix) or "/repos" in path:
                    api_cache.invalidate(prefix)
            return await call_next(request)
        if method == "GET":
            for prefix, ttl in CACHE_CONFIG.items():
                if path.startswith(prefix):
                    cache_key = f"{method}:{path}:{request.url.query}"
                    cached = api_cache.get(cache_key)
                    if cached is not None:
                        return Response(content=_json.dumps(cached), media_type="application/json", status_code=200)
                    response = await call_next(request)
                    if response.status_code == 200:
                        try:
                            body = await response.body()
                            try:
                                data = _json.loads(body)
                                api_cache.set(cache_key, data, ttl)
                            except (_json.JSONDecodeError, ValueError):
                                pass
                            return Response(content=body, media_type=response.media_type, status_code=response.status_code)
                        except Exception:
                            return response
                    return response
        return await call_next(request)
