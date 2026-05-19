"""
GitHub API 通用代理路由
用一个 catch-all 路由处理所有 /api/github/* 的简单转发
对有自定义逻辑的端点在独立模块中单独定义（优先匹配）
"""
import json
import logging
import urllib.parse
import urllib.request
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse, Response

from ..config import settings

logger = logging.getLogger("github-mirror.routers.github_proxy")

router = APIRouter(prefix="/api/github", tags=["github"])


def _gh_headers(accept: str = "application/vnd.github.v3+json") -> dict:
    """构建 GitHub API 请求头"""
    return {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": accept,
        "User-Agent": "GitHub-Mirror/7.4.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _gh_request(path: str, method: str = "GET",
                data: dict = None, headers: dict = None,
                accept: str = "application/vnd.github.v3+json") -> tuple:
    """
    向 GitHub API 发送请求
    返回 (status_code, response_data)
    """
    url = f"{settings.github_api_base}{path}"
    req_headers = _gh_headers(accept)
    if headers:
        req_headers.update(headers)

    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        req_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            content_type = resp.headers.get("Content-Type", "")
            raw = resp.read()
            if "application/json" in content_type:
                return resp.status, json.loads(raw)
            return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            body_data = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            body_data = raw.decode("utf-8", errors="replace")
        return e.code, body_data


# 导出供其他路由模块使用
gh_request = _gh_request
gh_get = lambda path, **kw: _gh_request(path, "GET", **kw)
gh_post = lambda path, data=None, **kw: _gh_request(path, "POST", data=data, **kw)
gh_put = lambda path, data=None, **kw: _gh_request(path, "PUT", data=data, **kw)
gh_patch = lambda path, data=None, **kw: _gh_request(path, "PATCH", data=data, **kw)
gh_delete = lambda path, **kw: _gh_request(path, "DELETE", **kw)


def _check_token():
    """检查 GitHub Token 是否配置"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")


# ═══════════════════════════════════════════════════════════
#  Catch-all 代理：处理所有未被单独定义的 /api/github/* 请求
# ═══════════════════════════════════════════════════════════

@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def github_proxy(path: str, request: Request):
    """
    GitHub API 通用代理
    将 /api/github/* 的请求转发到 https://api.github.com/*
    查询参数和请求体原样传递
    """
    _check_token()

    # 构建查询参数
    query_params = dict(request.query_params)
    if query_params:
        qs = urllib.parse.urlencode(query_params)
        gh_path = f"/{path}?{qs}"
    else:
        gh_path = f"/{path}"

    # 读取请求体
    body = None
    if request.method in ("POST", "PUT", "PATCH"):
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                body = await request.json()
            except Exception:
                body = None

    # 自定义 Accept 头
    accept = request.headers.get("accept", "application/vnd.github.v3+json")
    extra_headers = {}
    if accept != "application/vnd.github.v3+json":
        extra_headers["Accept"] = accept

    # 转发请求
    status, data = _gh_request(
        gh_path,
        method=request.method,
        data=body,
        headers=extra_headers if extra_headers else None,
        accept=accept,
    )

    # 返回响应
    if isinstance(data, bytes):
        return Response(content=data, status_code=status)
    return JSONResponse(content=data, status_code=status)
