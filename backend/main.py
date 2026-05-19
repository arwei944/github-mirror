"""
GitHub Mirror v7.2.0 - FastAPI Application Entry Point
"""

import logging, os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.clients.github_client import GitHubClient
from backend.config import settings
from backend.core.auth import setup_auth_middleware
from backend.core.cache import setup_cache_middleware
from backend.core.errors import setup_error_handlers
from backend.core.rate_limit import setup_rate_limit_middleware
from backend.db.connection import init_sync_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
logger = logging.getLogger("github-mirror")
github_client = GitHubClient()
mcp_registry = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    global mcp_registry
    logger.info("GitHub Mirror v%s starting up...", settings.app_version)
    Path(settings.data_dir).mkdir(parents=True, exist_ok=True)
    init_sync_db()
    if settings.github_token:
        await github_client.start()
        logger.info("GitHub API client started")
    else:
        logger.warning("GITHUB_TOKEN not set, GitHub API client disabled")
    from backend.mcp_tools import create_registry
    from backend.routers import mcp as mcp_router
    try:
        from app import load_projects, run_deploy
        load_projects_fn, run_deploy_fn = load_projects, run_deploy
    except ImportError:
        load_projects_fn, run_deploy_fn = None, None
    mcp_registry = create_registry(github_client=github_client if settings.github_token else None, hf_token=settings.hf_token, hf_user=settings.hf_user, load_projects_fn=load_projects_fn, run_deploy_fn=run_deploy_fn, settings=settings)
    mcp_router.set_registry(mcp_registry)
    logger.info("MCP registry initialized with %d tools", len(mcp_registry.list_tools()))
    logger.info("GitHub Mirror is ready!")
    yield
    logger.info("GitHub Mirror shutting down...")
    if settings.github_token:
        await github_client.stop()


def create_app() -> FastAPI:
    app = FastAPI(version=settings.app_version, title="GitHub Mirror", description="GitHub API proxy service", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
    setup_error_handlers(app)
    setup_auth_middleware(app)
    setup_rate_limit_middleware(app)
    setup_cache_middleware(app)
    from backend.routers import mcp as mcp_router
    app.include_router(mcp_router.router)
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static")
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    @app.get("/health")
    async def health():
        return {"status": "ok", "version": settings.app_version}
    return app

app = create_app()
