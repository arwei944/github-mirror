"""
路由注册器
从 app.py 提取所有路由并注册到新的 FastAPI 应用
Phase 3 桥接层 - 确保所有 244 个端点路径不变
"""
import logging
import importlib
from fastapi import FastAPI

logger = logging.getLogger("github-mirror.routers")


def register_app_routes(target_app: FastAPI, app_module=None):
    """
    从 app.py 模块提取所有路由，注册到 target_app。
    这是 Phase 3 的桥接方案，确保端点路径完全兼容。
    """
    if app_module is None:
        import app as app_module

    # 获取源 app 的所有路由
    source_routes = []
    for route in app_module.app.routes:
        source_routes.append(route)

    # 统计
    api_routes = [r for r in source_routes if hasattr(r, 'methods')]
    static_routes = [r for r in source_routes if hasattr(r, 'app')]
    other_routes = [r for r in source_routes if r not in api_routes and r not in static_routes]

    logger.info(f"从 app.py 提取路由: {len(api_routes)} 个 API 路由, "
                f"{len(static_routes)} 个静态路由, {len(other_routes)} 个其他路由")

    # 注册 API 路由
    for route in api_routes:
        # 跳过已被 target_app 定义的路由（health, root 等）
        if route.path in ("/health", "/api/v1/health", "/"):
            continue
        try:
            target_app.routes.append(route)
        except Exception as e:
            logger.warning(f"注册路由失败 {route.path}: {e}")

    # 注册静态文件挂载
    for route in static_routes:
        if route.path not in ("/assets",):
            try:
                target_app.routes.append(route)
            except Exception as e:
                logger.warning(f"注册静态路由失败 {route.path}: {e}")

    # 注册中间件（从 app.py 复制）
    # 注意：中间件在源 app 上已通过 @app.middleware 注册
    # 新架构的中间件在 main.py 中独立配置，无需重复

    return len(api_routes)
