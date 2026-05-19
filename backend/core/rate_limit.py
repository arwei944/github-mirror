"""
速率限制中间件
基于内存的滑动窗口速率限制
"""
import time
import logging
from collections import defaultdict
from typing import Dict

from fastapi import Request
from fastapi.responses import JSONResponse

from ..config import settings
from .auth import is_public_path

logger = logging.getLogger("github-mirror.rate_limit")

_rate_limit_store: Dict[str, list] = defaultdict(list)


def setup_rate_limit_middleware(app):
    """注册速率限制中间件"""

    @app.middleware("http")
    async def rate_limit_middleware(request: Request, call_next):
        if not settings.rate_limit_enabled:
            return await call_next(request)

        path = request.url.path
        if is_public_path(path):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()

        # 清理过期记录
        window = settings.rate_limit_window
        _rate_limit_store[client_ip] = [
            t for t in _rate_limit_store[client_ip] if now - t < window
        ]

        if len(_rate_limit_store[client_ip]) >= settings.rate_limit_max:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded. Max {settings.rate_limit_max} requests per {settings.rate_limit_window}s."
                },
            )

        _rate_limit_store[client_ip].append(now)
        return await call_next(request)
