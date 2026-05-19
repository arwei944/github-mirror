"""
缓存中间件
基于内存的 TTL 缓存，用于缓存 GitHub API 响应
"""
import time
import hashlib
import json
import logging
from typing import Optional, Any, Dict, Tuple

from fastapi import Request, Response
from fastapi.responses import JSONResponse

from ..config import settings
from .auth import is_public_path

logger = logging.getLogger("github-mirror.cache")

# 缓存存储: key -> (expiry_timestamp, response_bytes)
_cache: Dict[str, Tuple[float, bytes]] = {}


def _cache_key(request: Request) -> str:
    """生成缓存键"""
    raw = f"{request.method}:{request.url.path}:{request.url.query}"
    return hashlib.md5(raw.encode()).hexdigest()


def setup_cache_middleware(app):
    """注册缓存中间件（仅缓存 GET 请求）"""

    @app.middleware("http")
    async def cache_middleware(request: Request, call_next):
        # 仅缓存 GET 请求
        if request.method != "GET":
            return await call_next(request)

        path = request.url.path
        # 仅缓存 GitHub API 代理请求
        if not path.startswith("/api/github/"):
            return await call_next(request)

        key = _cache_key(request)
        now = time.time()

        # 检查缓存命中
        if key in _cache:
            expiry, cached_body = _cache[key]
            if now < expiry:
                return Response(
                    content=cached_body,
                    media_type="application/json",
                    headers={"X-Cache": "HIT"},
                )
            else:
                del _cache[key]

        # 执行请求
        response = await call_next(request)

        # 缓存成功响应
        if response.status_code == 200:
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            ttl = settings.cache_default_ttl
            _cache[key] = (now + ttl, body)

            # 淘汰超容量条目
            if len(_cache) > settings.cache_max_size:
                oldest_key = min(_cache, key=lambda k: _cache[k][0])
                del _cache[oldest_key]

            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

        return response
