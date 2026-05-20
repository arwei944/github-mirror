"""
FastAPI 应用入口
v7.5.0 - 完全独立路由架构（移除 app.py 桥接层）

启动方式:
    uvicorn backend.main:app --host 0.0.0.0 --port 7860 --reload
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .core.errors import setup_error_handlers

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("github-mirror")

# 全局 GitHub 客户端实例
github_client = None


# ═══════════════════════════════════════════════════════════
#  生命周期管理
# ═══════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理 - 启动和关闭时执行初始化/清理"""
    global github_client

    logger.info(f"GitHub Mirror v{settings.app_version} 启动中...")

    # 1. 初始化 GitHub 客户端
    if settings.github_token:
        from .clients.github_client import GitHubClient
        github_client = GitHubClient(
            token=settings.github_token,
            base_url=settings.github_api_base,
        )
        await github_client.start()
        logger.info("GitHub 客户端已启动")
    else:
        logger.warning("未配置 GITHUB_TOKEN，GitHub API 功能将不可用")

    # 2. 初始化数据库
    from .db.connection import init_db
    init_db()

    # 2.5 初始化同步数据库（兼容旧逻辑）
    from .core.shared_state import init_sync_db
    init_sync_db()

    # 3. 注册 MCP 工具
    from .mcp_tools import register_all_tools, registry
    register_all_tools(
        github_client=github_client,
        github_user=settings.github_user,
        hf_token=settings.hf_token,
        hf_user=settings.hf_user,
        settings=settings,
    )
    logger.info(f"MCP 工具已注册: {registry.count} 个工具")

    # 4. 发射启动事件
    from .core.events import event_bus, Event, EventType
    await event_bus.publish(Event(
        type=EventType.SYSTEM_STARTUP,
        data={"version": settings.app_version},
        source="lifespan",
    ))

    logger.info("GitHub Mirror 启动完成！")
    yield

    # 关闭
    await event_bus.publish(Event(
        type=EventType.SYSTEM_SHUTDOWN,
        data={"version": settings.app_version},
        source="lifespan",
    ))
    if github_client:
        await github_client.stop()
    logger.info("GitHub Mirror 已关闭")


# ═══════════════════════════════════════════════════════════
#  应用工厂
# ═══════════════════════════════════════════════════════════

def create_app() -> FastAPI:
    """创建并配置 FastAPI 应用"""

    app = FastAPI(
        version=settings.app_version,
        title="GitHub Mirror",
        description="GitHub API 代理服务",
        lifespan=lifespan,
    )

    # ── CORS ──
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── 中间件（顺序：auth → rate_limit → cache）──
    from .core.auth import setup_auth_middleware
    from .core.rate_limit import setup_rate_limit_middleware
    from .core.cache import setup_cache_middleware
    setup_auth_middleware(app)
    setup_rate_limit_middleware(app)
    setup_cache_middleware(app)

    # ── 路由挂载 ──
    from .routers.deploy import router as deploy_router
    from .routers.github_proxy import router as github_proxy_router
    from .routers.github_repos import router as github_repos_router
    from .routers.github_actions import router as github_actions_router
    from .routers.github_misc import router as github_misc_router
    from .routers.mcp import router as mcp_router
    from .routers.webhooks import router as webhooks_router
    from .routers.sync import router as sync_router
    from .routers.system import router as system_router
    app.include_router(deploy_router)
    app.include_router(github_proxy_router)
    app.include_router(github_repos_router)
    app.include_router(github_actions_router)
    app.include_router(github_misc_router)
    app.include_router(mcp_router)
    app.include_router(webhooks_router)
    app.include_router(sync_router)
    app.include_router(system_router)

    # ── 错误处理 ──
    setup_error_handlers(app)

    # ── 健康检查 ──
    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "version": settings.app_version,
        }

    @app.get("/api/v1/health")
    async def api_health():
        return {
            "status": "ok",
            "version": settings.app_version,
        }

    # ── 静态文件 ──
    static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
    if os.path.isdir(static_dir):
        assets_dir = os.path.join(static_dir, "assets")
        if os.path.isdir(assets_dir):
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # ── 根路由 ──
    @app.get("/")
    async def root():
        index_path = os.path.join(static_dir, "index.html")
        if os.path.isfile(index_path):
            from fastapi.responses import FileResponse
            return FileResponse(index_path)
        return {
            "name": "GitHub Mirror",
            "version": settings.app_version,
            "docs": "/docs",
        }

    # ── 事件总线 API ──
    @app.get("/api/events")
    async def get_events(event_type: str = None, limit: int = 50):
        from .core.events import event_bus
        return event_bus.get_history(event_type=event_type, limit=limit)

    @app.get("/api/events/types")
    async def get_event_types():
        from .core.events import event_bus
        return {"types": event_bus.event_types}

    # ── 审计日志 API ──
    @app.get("/api/audit")
    async def get_audit_log(action: str = None, status: str = None, limit: int = 50):
        from .core.audit import audit_log
        return audit_log.get_entries(action=action, status=status, limit=limit)

    @app.get("/api/audit/stats")
    async def get_audit_stats():
        from .core.audit import audit_log
        return audit_log.get_stats()

    # ── 缓存统计 API ──
    @app.get("/api/cache/info")
    async def get_cache_info():
        from .core.cache_v2 import cache
        return cache.stats

    return app


# ═══════════════════════════════════════════════════════════
#  应用实例
# ═══════════════════════════════════════════════════════════

app = create_app()
