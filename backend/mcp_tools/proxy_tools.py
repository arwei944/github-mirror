"""
代理 MCP 工具
"""

from __future__ import annotations

import ipaddress
import json
import re
import socket
import urllib.parse
from typing import Any, Dict, List, Tuple

import httpx

from .base import BaseTool, ToolParameter, ToolResult

try:
    from backend.core.security import is_proxy_url_allowed as _check_proxy_url
except ImportError:
    _check_proxy_url = None

_PROXY_URL_BLACKLIST: List[str] = [
    r"localhost", r"127\.0\.0\.\d+", r"0\.0\.0\.0", r"\[::1\]", r"\[0:0:0:0:0:0:0:1\]",
    r"10\.\d+\.\d+\.\d+", r"172\.(1[6-9]|2\d|3[01])\.\d+\.\d+", r"192\.168\.\d+\.\d+",
    r"169\.254\.\d+\.\d+", r"fe80::", r"metadata\.google\.internal", r"169\.254\.169\.254",
    r"\.internal\b", r"ec2\.amazonaws\.com.*\/meta-data", r"100\.100\.100\.200", r"metadata\.tencentcloudapi\.com",
]

_PROXY_URL_WHITELIST: List[str] = []


def _inline_is_proxy_url_allowed(url: str) -> Tuple[bool, str]:
    if _PROXY_URL_WHITELIST:
        for pattern in _PROXY_URL_WHITELIST:
            if re.search(pattern, url, re.IGNORECASE):
                return True, ""
        return False, "URL 不在白名单中"
    for pattern in _PROXY_URL_BLACKLIST:
        if re.search(pattern, url, re.IGNORECASE):
            return False, f"URL 匹配黑名单模式: {pattern}"
    try:
        parsed = urllib.parse.urlparse(url)
        hostname = parsed.hostname
        if hostname:
            try:
                resolved_ips = socket.getaddrinfo(hostname, None)
                for _, _, _, _, sockaddr in resolved_ips:
                    ip = ipaddress.ip_address(sockaddr[0])
                    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                        return False, f"URL 解析到私有/保留 IP: {ip}"
            except (socket.gaierror, ValueError):
                pass
    except Exception:
        pass
    return True, ""


def is_proxy_url_allowed(url: str) -> Tuple[bool, str]:
    if _check_proxy_url is not None:
        return _check_proxy_url(url)
    return _inline_is_proxy_url_allowed(url)


class ProxyRequestTool(BaseTool):
    name = "proxy_request"
    description = "代理 HTTP 请求，支持 GET/POST/PUT/DELETE。目标 URL 必须不在黑名单中"
    group = "proxy"
    parameters = {
        "url": ToolParameter(type="string", description="目标 URL"),
        "method": ToolParameter(type="string", description="HTTP 方法: GET, POST, PUT, DELETE", default="GET", optional=True),
        "headers": ToolParameter(type="object", description="请求头 (JSON 对象)", optional=True),
        "body": ToolParameter(type="string", description="请求体 (字符串)", optional=True),
    }

    async def execute(self, **kwargs: Any) -> ToolResult:
        url = kwargs.get("url", "")
        method = kwargs.get("method", "GET").upper()
        headers = kwargs.get("headers", {}) or {}
        body = kwargs.get("body")
        allowed, reason = is_proxy_url_allowed(url)
        if not allowed:
            return ToolResult.json({"error": f"URL 被拒绝: {reason}"}, error=True)
        if method not in ("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"):
            return ToolResult.json({"error": f"不支持的 HTTP 方法: {method}"}, error=True)
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                req_headers = dict(headers)
                req_content = None
                if body and method in ("POST", "PUT", "PATCH"):
                    req_content = body.encode("utf-8")
                    if "Content-Type" not in req_headers:
                        req_headers["Content-Type"] = "application/json"
                response = await client.request(method=method, url=url, headers=req_headers if req_headers else None, content=req_content)
                ct = response.headers.get("Content-Type", "")
                if "application/json" in ct:
                    try:
                        resp_body = response.json()
                    except (json.JSONDecodeError, ValueError):
                        resp_body = response.text
                else:
                    resp_body = response.text
                return ToolResult.json({"status": response.status_code, "headers": dict(response.headers), "body": resp_body})
        except httpx.HTTPStatusError as e:
            try:
                detail = e.response.json()
            except (json.JSONDecodeError, ValueError):
                detail = e.response.text
            return ToolResult.json({"error": f"HTTP {e.response.status_code}", "detail": detail}, error=True)
        except Exception as e:
            return ToolResult.json({"error": str(e)}, error=True)
