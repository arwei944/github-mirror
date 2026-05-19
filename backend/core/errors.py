"""
统一错误处理模块
提供 AppError 异常体系和全局异常处理器
"""
import logging
from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("github-mirror.errors")


# ═══════════════════════════════════════════════════════════
#  异常体系
# ═══════════════════════════════════════════════════════════

class AppError(Exception):
    """应用基础异常"""

    def __init__(self, code: str, message: str, status: int = 500):
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


class GitHubTokenMissing(AppError):
    def __init__(self):
        super().__init__("GITHUB_TOKEN_MISSING", "未配置 GITHUB_TOKEN 环境变量", 500)


class GitHubAPIError(AppError):
    def __init__(self, status: int, detail: str):
        super().__init__("GITHUB_API_ERROR", f"GitHub API 错误: {detail}", status)


class GitHubRateLimit(AppError):
    def __init__(self, reset_at: str = ""):
        msg = "GitHub API 速率限制已耗尽"
        if reset_at:
            msg += f"，重置于 {reset_at}"
        super().__init__("GITHUB_RATE_LIMIT", msg, 429)


class ResourceNotFound(AppError):
    def __init__(self, resource: str):
        super().__init__("NOT_FOUND", f"资源不存在: {resource}", 404)


class ValidationError(AppError):
    def __init__(self, detail: str):
        super().__init__("VALIDATION_ERROR", detail, 400)


class RateLimitExceeded(AppError):
    def __init__(self, max_requests: int, window: int):
        super().__init__(
            "RATE_LIMIT_EXCEEDED",
            f"速率限制: 每 {window} 秒最多 {max_requests} 次请求",
            429,
        )


class ShellCommandRejected(AppError):
    def __init__(self, reason: str):
        super().__init__("SHELL_REJECTED", f"Shell 命令被拒绝: {reason}", 403)


class ProxyURLRejected(AppError):
    def __init__(self, reason: str):
        super().__init__("PROXY_REJECTED", f"代理 URL 被拒绝: {reason}", 403)


# ═══════════════════════════════════════════════════════════
#  错误码映射
# ═══════════════════════════════════════════════════════════

ERROR_CODES = {
    "GITHUB_TOKEN_MISSING": 1001,
    "GITHUB_API_ERROR": 1002,
    "GITHUB_RATE_LIMIT": 1003,
    "VALIDATION_ERROR": 1004,
    "NOT_FOUND": 1005,
    "RATE_LIMIT_EXCEEDED": 1006,
    "SHELL_REJECTED": 1007,
    "PROXY_REJECTED": 1008,
}


# ═══════════════════════════════════════════════════════════
#  全局异常处理器
# ═══════════════════════════════════════════════════════════

def setup_error_handlers(app):
    """注册全局异常处理器到 FastAPI 应用"""

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        logger.warning(f"AppError: [{exc.code}] {exc.message}")
        return JSONResponse(
            status_code=exc.status,
            content={
                "error": {
                    "code": ERROR_CODES.get(exc.code, 9999),
                    "type": exc.code,
                    "message": exc.message,
                },
                "status_code": exc.status,
            },
        )

    @app.exception_handler(Exception)
    async def general_error_handler(request: Request, exc: Exception):
        logger.exception(f"未处理异常: {request.url.path}")
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": 9999,
                    "type": "INTERNAL_ERROR",
                    "message": "Internal server error",
                },
            },
        )
