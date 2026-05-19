"""
GitHub Mirror - Unified Error Handling
"""

import logging
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("github-mirror.errors")

ERROR_CODES: Dict[str, str] = {
    "GITHUB_TOKEN_MISSING": "GITHUB_TOKEN_MISSING",
    "GITHUB_API_ERROR": "GITHUB_API_ERROR",
    "RESOURCE_NOT_FOUND": "RESOURCE_NOT_FOUND",
    "VALIDATION_ERROR": "VALIDATION_ERROR",
    "RATE_LIMIT_EXCEEDED": "RATE_LIMIT_EXCEEDED",
    "SHELL_COMMAND_REJECTED": "SHELL_COMMAND_REJECTED",
    "PROXY_URL_REJECTED": "PROXY_URL_REJECTED",
}


class AppError(Exception):
    def __init__(self, message: str = "An unexpected error occurred", code: str = "INTERNAL_ERROR", status: int = 500, details: Optional[Dict[str, Any]] = None) -> None:
        self.message = message
        self.code = code
        self.status = status
        self.details = details or {}
        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {"error": self.code, "message": self.message}
        if self.details:
            result["details"] = self.details
        return result


class GitHubTokenMissing(AppError):
    def __init__(self) -> None:
        super().__init__(message="GitHub token is not configured.", code=ERROR_CODES["GITHUB_TOKEN_MISSING"], status=500)


class GitHubAPIError(AppError):
    def __init__(self, message: str = "GitHub API request failed", status_code: int = 502, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(message=message, code=ERROR_CODES["GITHUB_API_ERROR"], status=status_code, details=details)


class ResourceNotFound(AppError):
    def __init__(self, resource: str = "Resource", identifier: str = "") -> None:
        msg = f"{resource} not found" if not identifier else f"{resource} '{identifier}' not found"
        super().__init__(message=msg, code=ERROR_CODES["RESOURCE_NOT_FOUND"], status=404)


class ValidationError(AppError):
    def __init__(self, message: str = "Validation failed", details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(message=message, code=ERROR_CODES["VALIDATION_ERROR"], status=422, details=details)


class RateLimitExceeded(AppError):
    def __init__(self, message: str = "Rate limit exceeded") -> None:
        super().__init__(message=message, code=ERROR_CODES["RATE_LIMIT_EXCEEDED"], status=429)


class ShellCommandRejected(AppError):
    def __init__(self, reason: str = "Command rejected by security policy") -> None:
        super().__init__(message=f"Shell command rejected: {reason}", code=ERROR_CODES["SHELL_COMMAND_REJECTED"], status=403)


class ProxyURLRejected(AppError):
    def __init__(self, reason: str = "URL rejected by security policy") -> None:
        super().__init__(message=f"Proxy URL rejected: {reason}", code=ERROR_CODES["PROXY_URL_REJECTED"], status=403)


def setup_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        logger.warning("AppError [%s] %s - %s %s", exc.code, exc.message, request.method, request.url.path)
        return JSONResponse(status_code=exc.status, content=exc.to_dict())

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        logger.warning("HTTPException [%d] %s - %s %s", exc.status_code, exc.detail, request.method, request.url.path)
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error("Unhandled exception: %s - %s %s", str(exc), request.method, request.url.path, exc_info=True)
        return JSONResponse(status_code=500, content={"error": "INTERNAL_ERROR", "message": "An unexpected internal error occurred"})
