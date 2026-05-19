"""
Proxy MCP 工具
代理 HTTP 请求，带 SSRF 防护
"""
import ipaddress
import json
import logging
import re
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from .base import BaseTool, ToolParameter, ToolResult

logger = logging.getLogger("github-mirror.mcp_tools.proxy")

# SSRF 防护：禁止访问内网地址
_BLOCKED_HOSTS = [
    "localhost", "127.0.0.1", "0.0.0.0", "::1",
    "metadata.google.internal", "169.254.169.254",
    "10.0.0.0", "172.16.0.0", "192.168.0.0",
]

_ALLOWED_SCHEMES = {"http", "https"}


def _is_proxy_url_allowed(url: str):
    """检查 URL 是否允许代理（SSRF 防护）"""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
            return False, f"不支持的协议: {parsed.scheme}"
        host = parsed.hostname
        if not host:
            return False, "无法解析主机名"
        if host in _BLOCKED_HOSTS:
            return False, f"禁止访问内网地址: {host}"
        # 检查私有 IP
        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback or ip.is_reserved:
                return False, f"禁止访问私有 IP: {host}"
        except ValueError:
            pass  # 域名，不是 IP
        return True, ""
    except Exception as e:
        return False, str(e)


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

    async def execute(self, **kwargs) -> ToolResult:
        url = kwargs.get("url", "")
        method = kwargs.get("method", "GET").upper()
        headers = kwargs.get("headers", {})
        body = kwargs.get("body")

        allowed, reason = _is_proxy_url_allowed(url)
        if not allowed:
            return ToolResult.error(f"URL 被拒绝: {reason}")

        if method not in ("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"):
            return ToolResult.error(f"不支持的 HTTP 方法: {method}")

        try:
            req = Request(url, method=method)
            for k, v in headers.items():
                req.add_header(k, v)
            if body and method in ("POST", "PUT", "PATCH"):
                req.data = body.encode("utf-8")
                if "Content-Type" not in headers:
                    req.add_header("Content-Type", "application/json")

            # 在线程池中执行同步 IO
            import asyncio
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(None, lambda: urlopen(req, timeout=30))
            raw = await loop.run_in_executor(None, resp.read)
            ct = resp.headers.get("Content-Type", "")
            if "application/json" in ct:
                resp_body = json.loads(raw)
            else:
                resp_body = raw.decode("utf-8", errors="replace")
            return ToolResult.json({
                "status": resp.status,
                "headers": dict(resp.headers),
                "body": resp_body,
            })
        except HTTPError as e:
            raw = e.read()
            try:
                detail = json.loads(raw)
            except (json.JSONDecodeError, ValueError):
                detail = raw.decode("utf-8", errors="replace")
            return ToolResult.json({"error": f"HTTP {e.code}", "detail": detail}, is_error=True)
        except Exception as e:
            return ToolResult.error(str(e))


ALL_PROXY_TOOLS = [ProxyRequestTool]
