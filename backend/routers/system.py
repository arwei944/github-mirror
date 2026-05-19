"""
系统端点路由
health, config, stats, cache, projects, hf/spaces, events, self-update
"""
from fastapi import APIRouter

router = APIRouter(tags=["system"])

# ═══════════════════════════════════════════════════════════
#  Phase 3 桥接层：从 app.py 导入现有路由函数
#  后续迭代中将函数体逐步迁移到本模块
# ═══════════════════════════════════════════════════════════

# 延迟导入 app 模块中的路由函数，避免循环依赖
def _register_routes(app_module):
    """从 app 模块注册所有系统路由到本 router"""
    import inspect

    # 系统端点映射：路径 -> (方法, 函数名)
    system_endpoints = {
        "GET /health": "health_check",
        "GET /": "root_page",
        "GET /api/stats": "get_stats",
        "GET /api/config": "get_config",
        "POST /api/config": "update_config",
        "GET /api/mcp/tool-calls": "get_mcp_tool_calls",
        "GET /api/mcp/tools": "get_mcp_tools",
        "GET /api/projects": "list_projects",
        "POST /api/projects/{name}": "create_project",
        "DELETE /api/projects/{name}": "delete_project",
        "POST /api/projects/{name}/deploy": "deploy_project",
        "GET /api/hf/spaces": "list_hf_spaces",
        "GET /api/hf/spaces/status": "get_hf_space_status",
        "GET /api/hf/spaces/{space_id}/logs": "get_hf_space_logs",
        "GET /api/events/stream": "events_stream",
        "GET /api/events/recent": "events_recent",
        "POST /api/cache/clear": "cache_clear",
        "GET /api/cache/stats": "cache_stats",
        "POST /api/self-update": "self_update",
        "GET /api/self-update/status": "self_update_status",
    }

    for endpoint_key, func_name in system_endpoints.items():
        method, path = endpoint_key.split(" ", 1)
        func = getattr(app_module, func_name, None)
        if func:
            router.add_api_route(path, func, methods=[method])
        else:
            import logging
            logging.getLogger("github-mirror.routers.system").warning(
                f"Function {func_name} not found in app module"
            )
