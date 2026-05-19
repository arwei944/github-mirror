"""
API Key 认证中间件
"""
import hmac
import logging
from fastapi import Request, Response
from fastapi.responses import JSONResponse

from ..config import settings

logger = logging.getLogger("github-mirror.auth")

API_KEY_HEADER = "X-API-Key"

# 白名单路径（无需认证）
PUBLIC_PATHS = {
    "/", "/health", "/docs", "/openapi.json", "/redoc",
    "/api/v1/health",
}


def is_public_path(path: str) -> bool:
    """检查路径是否在白名单中"""
    if path in PUBLIC_PATHS:
        return True
    # MCP SSE 端点通过 query param 传递 session_id
    if path.startswith("/mcp/sse"):
        return True
    # MCP Streamable HTTP 端点
    if path == "/mcp":
        return True
    # 静态文件
    if path.startswith("/assets/"):
        return True
    return False


def setup_auth_middleware(app):
    """注册 API Key 认证中间件"""

    @app.middleware("http")
    async def api_key_middleware(request: Request, call_next):
        # 如果未配置 API_KEY，跳过认证
        if not settings.api_key:
            return await call_next(request)

        path = request.url.path
        if is_public_path(path):
            return await call_next(request)

        # 检查 API Key（header 或 query param）
        api_key = request.headers.get(API_KEY_HEADER, "")
        if not api_key:
            api_key = request.query_params.get("api_key", "")

        if not hmac.compare_digest(api_key, settings.api_key):
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing API key. Provide X-API-Key header."},
            )

        return await call_next(request)
