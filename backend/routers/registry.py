"""
路由注册器
从 app.py 提取所有路由并注册到新的 FastAPI 应用
Phase 3 桥接层 - 仅保留尚未迁移的自定义逻辑端点
"""
import logging
from fastapi import FastAPI

logger = logging.getLogger("github-mirror.routers")

# 已被新路由模块接管的端点路径
_OWNED_PATHS = {
    # main.py 内置
    "/", "/health", "/api/v1/health",
    # deploy 路由
    "/api/deploy", "/api/deploy/batch", "/api/deploy/status/{repo_name}",
    "/api/deploy/active", "/api/deploy/history", "/api/deploy/spaces",
    "/api/deploy/spaces/{space_name}/status",
    # 新架构 API (events/audit/cache-info)
    "/api/events", "/api/events/types",
    "/api/audit", "/api/audit/stats",
    "/api/cache/info",
    # MCP 路由
    "/mcp", "/mcp/sse", "/mcp/sse/message",
    "/api/mcp/tool-calls", "/api/mcp/tools",
    # GitHub 代理 (catch-all)
    "/api/github/{path:path}",
    # Webhook 路由
    "/api/webhooks/github", "/api/webhooks/huggingface",
    "/api/webhooks/events",
    # Sync 路由
    "/api/sync/repos", "/api/sync/repos/{repo_name}",
    "/api/sync/status", "/api/sync/status/{repo_name}",
    "/api/sync/data/{repo_name}",
    # System 路由
    "/api/config",
    "/api/stats",
    "/api/cache/clear", "/api/cache/stats",
    "/api/projects", "/api/projects/{name}",
    "/api/projects/{name}/deploy",
    "/api/hf/spaces", "/api/hf/spaces/status",
    "/api/hf/spaces/{space_id}/logs",
    "/api/events/stream", "/api/events/recent",
    "/ws/events",
    "/api/self-update", "/api/self-update/status",
    "/api/webhook/receiver",
}


def register_app_routes(target_app: FastAPI, app_module=None):
    """
    从 app.py 模块提取所有路由，注册到 target_app。
    跳过已被新架构接管的端点。
    """
    if app_module is None:
        import app as app_module

    source_routes = list(app_module.app.routes)
    api_routes = [r for r in source_routes if hasattr(r, 'methods')]
    static_routes = [r for r in source_routes if hasattr(r, 'app')]

    registered = 0
    skipped = 0

    for route in api_routes:
        if route.path in _OWNED_PATHS:
            skipped += 1
            continue
        try:
            target_app.routes.append(route)
            registered += 1
        except Exception as e:
            logger.warning(f"注册路由失败 {route.path}: {e}")

    for route in static_routes:
        if route.path not in ("/assets",):
            try:
                target_app.routes.append(route)
            except Exception:
                pass

    logger.info(f"桥接 app.py: 注册 {registered} 个, 跳过 {skipped} 个 (已由新架构接管)")
    return registered
