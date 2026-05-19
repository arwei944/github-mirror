# 🪞 GitHub Mirror v7.0 开发文档

> **项目**: [arwei944/github-mirror](https://github.com/arwei944/github-mirror)  
> **当前版本**: v6.5.0 → **目标版本**: v7.5.0  
> **文档日期**: 2026-05-19  
> **前置文档**: [架构分析报告](./architecture-analysis.md)

---

## 目录

1. [项目背景与目标](#1-项目背景与目标)
2. [版本规划与分支策略](#2-版本规划与分支策略)
3. [开发环境搭建](#3-开发环境搭建)
4. [Phase 1: 基础重构 (v7.1.0)](#4-phase-1-基础重构-v710)
5. [Phase 2: MCP 服务重构 (v7.2.0)](#5-phase-2-mcp-服务重构-v720)
6. [Phase 3: API 路由拆分 (v7.3.0)](#6-phase-3-api-路由拆分-v730)
7. [Phase 4: 基础设施升级 (v7.4.0)](#7-phase-4-基础设施升级-v740)
8. [Phase 5: 前端优化 (v7.5.0)](#8-phase-5-前端优化-v750)
9. [发布流程](#9-发布流程)
10. [风险与回滚](#10-风险与回滚)

---

## 1. 项目背景与目标

### 1.1 为什么要重构

当前 v6.5.0 存在以下核心问题：

| 问题 | 严重性 | 影响 |
|------|--------|------|
| 单文件巨石（6450 行 `app.py`） | 🔴 P0 | 不可维护、无法并行开发 |
| 同步阻塞 HTTP（`urllib.request`） | 🔴 P0 | 聚合 API 延迟高，无法利用 asyncio |
| 全局可变状态 | 🔴 P0 | 重启丢失、无法水平扩展 |
| MCP 384 行 if-elif 分发器 | 🟠 P1 | 违反开闭原则 |
| 无数据模型层 | 🟠 P1 | 无输入验证、无类型安全 |
| 错误处理不统一 | 🟠 P1 | 4 种错误处理方式混用 |

### 1.2 重构目标

- **可维护性**: 单文件 → 模块化分层，代码可维护性提升 5 倍
- **性能**: 同步阻塞 → 异步非阻塞，聚合 API 延迟降低 60%
- **可扩展性**: 全局状态 → 事件驱动，支持水平扩展
- **开发效率**: 插件式 MCP 工具，添加新工具从改 2 处 → 新建 1 个文件
- **质量保障**: Pydantic 模型 + 统一错误处理 + 单元测试

### 1.3 兼容性承诺

- **API 向后兼容**: 所有 227+ REST API 端点路径和参数保持不变
- **MCP 协议兼容**: SSE + Streamable HTTP 双传输协议保持不变
- **前端无需修改**: 重构仅影响后端，前端 API 层无需改动
- **配置兼容**: 所有环境变量保持不变

---

## 2. 版本规划与分支策略

### 2.1 版本规划

```
v6.5.0 (当前) ──→ v7.1.0 ──→ v7.2.0 ──→ v7.3.0 ──→ v7.4.0 ──→ v7.5.0
                   Phase 1    Phase 2    Phase 3    Phase 4    Phase 5
                   基础重构   MCP重构    路由拆分    基础设施    前端优化
```

| 版本 | 阶段 | 核心变更 | 预计工期 |
|------|------|----------|----------|
| v7.1.0 | Phase 1 | 目录结构、异步客户端、统一错误 | 1-2 周 |
| v7.2.0 | Phase 2 | 插件式 MCP 工具架构 | 1 周 |
| v7.3.0 | Phase 3 | 227+ 端点拆分到独立模块 | 1-2 周 |
| v7.4.0 | Phase 4 | 事件总线、缓存升级、审计日志 | 1 周 |
| v7.5.0 | Phase 5 | 前端组件化、状态管理、类型化 | 1 周 |

### 2.2 分支策略

```
main (生产)
  │
  ├── refactor/phase-1-base    → merge → tag v7.1.0
  ├── refactor/phase-2-mcp     → merge → tag v7.2.0
  ├── refactor/phase-3-routers → merge → tag v7.3.0
  ├── refactor/phase-4-infra   → merge → tag v7.4.0
  └── refactor/phase-5-frontend→ merge → tag v7.5.0
```

**规则**：
1. 每个阶段从 `main` 创建 `refactor/phase-N-*` 分支
2. 阶段内开发在该分支进行，完成后创建 PR 合并到 `main`
3. 合并后打 git tag 发布新版本
4. 下一阶段从最新的 `main` 创建新分支

### 2.3 Git Commit 规范

```
<type>(<scope>): <description>

[optional body]
```

**类型**：
- `feat`: 新功能
- `refactor`: 重构（不改变外部行为）
- `fix`: 修复 bug
- `docs`: 文档
- `test`: 测试
- `chore`: 构建/工具链

**示例**：
```
feat(mcp): 实现插件式工具注册表
refactor(github): 将 GitHub API 调用迁移到异步客户端
fix(cache): 修复 TTLCache 淘汰策略 O(n) 性能问题
docs(phase1): 添加 Phase 1 开发指南
```

---

## 3. 开发环境搭建

### 3.1 环境要求

| 工具 | 版本 |
|------|------|
| Python | 3.11+ |
| Node.js | 20+ |
| Git | 2.40+ |
| Docker | 24+ (可选) |

### 3.2 初始化开发环境

```bash
# 1. 克隆仓库
git clone https://github.com/arwei944/github-mirror.git
cd github-mirror

# 2. 创建开发分支（以 Phase 1 为例）
git checkout -b refactor/phase-1-base

# 3. 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

# 4. 安装依赖
pip install -r requirements.txt

# 5. 安装开发依赖
pip install pytest pytest-asyncio httpx ruff mypy

# 6. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 GITHUB_TOKEN、GITHUB_USER 等

# 7. 启动开发服务器
uvicorn app:app --host 0.0.0.0 --port 7860 --reload
```

### 3.3 新目录结构（Phase 1 创建）

```
github-mirror/
├── backend/                      # ← 新建
│   ├── __init__.py
│   ├── main.py                   # FastAPI 入口（从 app.py 迁移）
│   ├── config.py                 # 配置管理
│   ├── routers/                  # 路由层
│   ├── services/                 # 业务逻辑层
│   ├── mcp_tools/                # MCP 工具
│   ├── models/                   # Pydantic 模型
│   ├── clients/                  # 外部服务客户端
│   ├── core/                     # 核心基础设施
│   └── db/                       # 数据库层
├── app.py                        # ← 保留（兼容，逐步废弃）
├── frontend/
├── tests/
├── docs/                         # ← 新建
│   ├── architecture-analysis.md
│   └── development-guide.md      # 本文档
├── Dockerfile
├── requirements.txt
└── README.md
```

---

## 4. Phase 1: 基础重构 (v7.1.0)

> **分支**: `refactor/phase-1-base`  
> **目标**: 建立新目录结构，实现异步客户端和统一错误处理  
> **兼容性**: `app.py` 保留为兼容入口，新代码在 `backend/` 中开发

### 4.1 任务清单

| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|----------|
| 1.1 | 创建 `backend/` 目录结构 | P0 | 所有 `__init__.py` 就位 |
| 1.2 | 实现 `backend/config.py` | P0 | Pydantic Settings，所有环境变量集中管理 |
| 1.3 | 实现异步 `GitHubClient` | P0 | httpx AsyncClient，支持 GET/POST/PUT/DELETE/PATCH |
| 1.4 | 实现统一错误处理 `core/errors.py` | P0 | AppError 体系 + 全局异常处理器 |
| 1.5 | 提取中间件到 `core/` | P1 | auth、rate_limit、cache 独立模块 |
| 1.6 | 实现 `backend/main.py` | P0 | FastAPI 应用入口，挂载所有中间件 |
| 1.7 | 更新 `Dockerfile` | P1 | 入口改为 `backend.main:app` |
| 1.8 | 编写单元测试 | P1 | config、GitHubClient、errors 覆盖率 > 80% |

### 4.2 详细实现指南

#### 4.2.1 配置管理 (`backend/config.py`)

```python
"""
配置管理模块
使用 Pydantic Settings 从环境变量加载配置
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from pathlib import Path


class AppSettings(BaseSettings):
    """应用配置"""
    # 应用
    app_version: str = "7.1.0"
    debug: bool = False

    # GitHub
    github_token: str = ""
    github_user: str = ""
    github_api_base: str = "https://api.github.com"

    # HuggingFace
    hf_token: str = ""
    hf_user: str = ""

    # 安全
    api_key: str = ""
    webhook_secret: str = ""
    cors_origins: str = "*"

    # 速率限制
    rate_limit_enabled: bool = True
    rate_limit_max: int = 120
    rate_limit_window: int = 60

    # 数据
    data_dir: str = Field(default_factory=lambda: str(Path(__file__).parent.parent / "data"))

    # 缓存
    cache_default_ttl: int = 300
    cache_max_size: int = 2000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = AppSettings()
```

#### 4.2.2 异步 GitHub 客户端 (`backend/clients/github_client.py`)

```python
"""
异步 GitHub API 客户端
基于 httpx.AsyncClient，支持连接池和自动重试
"""
import httpx
import logging
from typing import Optional, Any, Tuple

logger = logging.getLogger("github-mirror.github_client")


class GitHubClient:
    """异步 GitHub API 客户端"""

    def __init__(self, token: str, base_url: str = "https://api.github.com"):
        self._token = token
        self._base_url = base_url
        self._client: Optional[httpx.AsyncClient] = None

    async def start(self):
        """启动客户端（创建连接池）"""
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "GitHub-Mirror/7.0.0",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            timeout=30.0,
            follow_redirects=True,
        )
        logger.info("GitHub 客户端已启动")

    async def stop(self):
        """关闭客户端"""
        if self._client:
            await self._client.aclose()
            logger.info("GitHub 客户端已关闭")

    @property
    def client(self) -> httpx.AsyncClient:
        if not self._client:
            raise RuntimeError("GitHub 客户端未启动，请先调用 start()")
        return self._client

    async def request(
        self,
        method: str,
        path: str,
        *,
        json: Optional[dict] = None,
        params: Optional[dict] = None,
        headers: Optional[dict] = None,
    ) -> Tuple[int, Any]:
        """发送请求到 GitHub API，返回 (status_code, response_data)"""
        req_headers = {}
        if headers:
            req_headers.update(headers)
        try:
            resp = await self.client.request(
                method, path, json=json, params=params, headers=req_headers
            )
            content_type = resp.headers.get("content-type", "")
            if "application/json" in content_type:
                return resp.status_code, resp.json()
            return resp.status_code, resp.text
        except httpx.HTTPStatusError as e:
            return e.response.status_code, e.response.text
        except httpx.RequestError as e:
            logger.error(f"GitHub API 请求失败: {e}")
            return 0, {"error": str(e)}

    async def get(self, path: str, **kwargs) -> Tuple[int, Any]:
        return await self.request("GET", path, **kwargs)

    async def post(self, path: str, json: dict = None, **kwargs) -> Tuple[int, Any]:
        return await self.request("POST", path, json=json, **kwargs)

    async def put(self, path: str, json: dict = None, **kwargs) -> Tuple[int, Any]:
        return await self.request("PUT", path, json=json, **kwargs)

    async def patch(self, path: str, json: dict = None, **kwargs) -> Tuple[int, Any]:
        return await self.request("PATCH", path, json=json, **kwargs)

    async def delete(self, path: str, **kwargs) -> Tuple[int, Any]:
        return await self.request("DELETE", path, **kwargs)

    async def get_many(self, paths: list[str]) -> list[Tuple[int, Any]]:
        """并行请求多个 API"""
        import asyncio
        tasks = [self.get(path) for path in paths]
        return await asyncio.gather(*tasks, return_exceptions=True)
```

#### 4.2.3 统一错误处理 (`backend/core/errors.py`)

```python
"""
统一错误处理模块
"""
from fastapi import Request
from fastapi.responses import JSONResponse


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


def setup_error_handlers(app):
    """注册全局异常处理器"""
    from fastapi import HTTPException

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
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

    @app.exception_handler(HTTPException)
    async def http_error_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail, "status_code": exc.status_code},
        )

    @app.exception_handler(Exception)
    async def general_error_handler(request: Request, exc: Exception):
        import logging
        logging.exception(f"未处理异常: {request.url.path}")
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
```

#### 4.2.4 应用入口 (`backend/main.py`)

```python
"""
FastAPI 应用入口
v7.1.0 - 从 app.py 迁移的核心入口
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .core.errors import setup_error_handlers


github_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    global github_client
    logging.info(f"GitHub Mirror v{settings.app_version} 启动中...")

    if settings.github_token:
        from .clients.github_client import GitHubClient
        github_client = GitHubClient(settings.github_token)
        await github_client.start()

    from .db.connection import init_db
    init_db()

    logging.info("GitHub Mirror 启动完成！")
    yield

    if github_client:
        await github_client.stop()
    logging.info("GitHub Mirror 已关闭")


def create_app() -> FastAPI:
    """创建 FastAPI 应用"""
    app = FastAPI(
        version=settings.app_version,
        title="GitHub Mirror",
        description="GitHub API 代理服务",
        lifespan=lifespan,
    )

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

    from .core.auth import setup_auth_middleware
    from .core.rate_limit import setup_rate_limit_middleware
    from .core.cache import setup_cache_middleware
    setup_auth_middleware(app)
    setup_rate_limit_middleware(app)
    setup_cache_middleware(app)

    setup_error_handlers(app)

    import os
    static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
    if os.path.isdir(static_dir):
        app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")

    return app


app = create_app()
```

### 4.3 Phase 1 验收检查

```bash
# 1. 单元测试
pytest tests/unit/test_config.py tests/unit/test_github_client.py tests/unit/test_errors.py -v

# 2. 启动验证
uvicorn backend.main:app --host 0.0.0.0 --port 7860 --reload
# 访问 http://localhost:7860/health 确认服务正常

# 3. Docker 构建
docker build -t github-mirror:v7.1.0 .

# 4. 兼容性验证
curl http://localhost:7860/api/github/repos  # 应返回仓库列表
```

### 4.4 Phase 1 完成后的 Git 操作

```bash
git add .
git commit -m "refactor(base): Phase 1 基础重构

- 创建 backend/ 目录结构
- 实现 Pydantic Settings 配置管理
- 实现异步 GitHubClient (httpx)
- 实现统一错误处理 AppError 体系
- 提取中间件到 core/ 模块
- 实现 FastAPI lifespan 生命周期管理
- 更新 Dockerfile 入口

BREAKING CHANGE: 应用入口从 app:app 改为 backend.main:app"

git push origin refactor/phase-1-base
gh pr create --title "refactor: Phase 1 基础重构" --base main

# 合并后打 tag
git checkout main && git pull
git tag v7.1.0 -a -m "v7.1.0 - 基础重构"
gh release create v7.1.0 --title "v7.1.0 - 基础重构" --generate-notes
git push origin v7.1.0
```

---

## 5. Phase 2: MCP 服务重构 (v7.2.0)

> **分支**: `refactor/phase-2-mcp` (从 main 创建)  
> **目标**: 将 MCP 服务从 if-elif 链重构为插件式架构

### 5.1 任务清单

| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|----------|
| 2.1 | 实现 `BaseTool` 基类 | P0 | name、description、parameters、execute() |
| 2.2 | 实现 `ToolRegistry` 注册表 | P0 | register()、call()、list_tools() |
| 2.3 | 迁移 GitHub 工具 (21个) | P0 | 每个 GitHub MCP 工具一个类 |
| 2.4 | 迁移 HF 工具 (3个) | P0 | list_spaces、get_space_status、get_space_logs |
| 2.5 | 迁移 Shell 工具 | P0 | asyncio.create_subprocess_shell |
| 2.6 | 迁移 Proxy 工具 | P0 | 保留 SSRF 防护 |
| 2.7 | 迁移 Project + Config 工具 | P0 | list_projects、deploy_project、get/update_config |
| 2.8 | 重构 MCP 传输层 | P0 | JSON-RPC 使用 ToolRegistry.call() |
| 2.9 | 添加工具调用中间件 | P1 | 日志、审计、限流 |
| 2.10 | 编写 MCP 工具单元测试 | P1 | 每个工具至少 1 正向 + 1 异常测试 |

### 5.2 工具迁移对照表

| 原始 if-elif 分支 | 新工具类 | 文件 |
|-------------------|----------|------|
| `name == "list_repos"` | `ListReposTool` | `mcp_tools/github_tools.py` |
| `name == "get_repo_detail"` | `GetRepoDetailTool` | `mcp_tools/github_tools.py` |
| `name == "create_repo"` | `CreateRepoTool` | `mcp_tools/github_tools.py` |
| `name == "delete_repo"` | `DeleteRepoTool` | `mcp_tools/github_tools.py` |
| `name == "list_issues"` | `ListIssuesTool` | `mcp_tools/github_tools.py` |
| `name == "create_issue"` | `CreateIssueTool` | `mcp_tools/github_tools.py` |
| `name == "list_pulls"` | `ListPullsTool` | `mcp_tools/github_tools.py` |
| `name == "create_pr"` | `CreatePRTool` | `mcp_tools/github_tools.py` |
| `name == "merge_pr"` | `MergePRTool` | `mcp_tools/github_tools.py` |
| `name == "search_code"` | `SearchCodeTool` | `mcp_tools/github_tools.py` |
| `name == "search_repos"` | `SearchReposTool` | `mcp_tools/github_tools.py` |
| `name == "get_activity"` | `GetActivityTool` | `mcp_tools/github_tools.py` |
| `name == "get_user"` | `GetUserTool` | `mcp_tools/github_tools.py` |
| `name == "get_notifications"` | `GetNotificationsTool` | `mcp_tools/github_tools.py` |
| `name == "get_repo_contents"` | `GetRepoContentsTool` | `mcp_tools/github_tools.py` |
| `name == "get_commits"` | `GetCommitsTool` | `mcp_tools/github_tools.py` |
| `name == "get_repo_tags"` | `GetRepoTagsTool` | `mcp_tools/github_tools.py` |
| `name == "get_repo_branches"` | `GetRepoBranchesTool` | `mcp_tools/github_tools.py` |
| `name == "get_repo_releases"` | `GetRepoReleasesTool` | `mcp_tools/github_tools.py` |
| `name == "get_repo_stargazers"` | `GetRepoStargazersTool` | `mcp_tools/github_tools.py` |
| `name == "fork_repo"` | `ForkRepoTool` | `mcp_tools/github_tools.py` |
| `name == "list_spaces"` | `ListSpacesTool` | `mcp_tools/hf_tools.py` |
| `name == "get_space_status"` | `GetSpaceStatusTool` | `mcp_tools/hf_tools.py` |
| `name == "get_space_logs"` | `GetSpaceLogsTool` | `mcp_tools/hf_tools.py` |
| `name == "execute_shell"` | `ExecuteShellTool` | `mcp_tools/shell_tools.py` |
| `name == "proxy_request"` | `ProxyRequestTool` | `mcp_tools/proxy_tools.py` |
| `name == "list_projects"` | `ListProjectsTool` | `mcp_tools/project_tools.py` |
| `name == "deploy_project"` | `DeployProjectTool` | `mcp_tools/project_tools.py` |
| `name == "get_config"` | `GetConfigTool` | `mcp_tools/config_tools.py` |
| `name == "update_config"` | `UpdateConfigTool` | `mcp_tools/config_tools.py` |

### 5.3 MCP 工具编写模板

```python
# backend/mcp_tools/<category>_tools.py
from .base import BaseTool, ToolParameter, ToolResult


class XxxTool(BaseTool):
    """工具描述"""

    name = "xxx"
    description = "工具的详细描述"
    group = "github"  # github / huggingface / shell / proxy / project / config
    parameters = {
        "param1": ToolParameter(
            type="string",
            description="参数描述",
            optional=False,
        ),
    }

    def __init__(self, github_client=None):
        self._client = github_client

    async def execute(self, **kwargs) -> ToolResult:
        param1 = kwargs["param1"]
        # 业务逻辑...
        return ToolResult.json(data)
```

### 5.4 Phase 2 验收检查

```bash
# 1. 单元测试
pytest tests/unit/mcp_tools/ -v

# 2. MCP 协议兼容性测试
curl -X POST http://localhost:7860/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
# 应返回 30 个工具定义

# 3. 工具调用测试
curl -X POST http://localhost:7860/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_repos","arguments":{"per_page":5}}}'
```

### 5.5 Phase 2 完成后的 Git 操作

```bash
git add .
git commit -m "refactor(mcp): Phase 2 MCP 服务重构

- 实现 BaseTool 基类和 ToolRegistry 注册表
- 将 30 个 MCP 工具从 if-elif 链迁移到独立类
- Shell 工具改用 asyncio.create_subprocess_shell
- 添加工具调用中间件（日志、审计）
- MCP 传输层使用 ToolRegistry.call() 分发
- 编写 MCP 工具单元测试"

git push origin refactor/phase-2-mcp
gh pr create --title "refactor: Phase 2 MCP 服务重构" --base main

git checkout main && git pull
git tag v7.2.0 -a -m "v7.2.0 - MCP 服务重构"
gh release create v7.2.0 --title "v7.2.0 - MCP 服务重构" --generate-notes
git push origin v7.2.0
```

---

## 6. Phase 3: API 路由拆分 (v7.3.0)

> **分支**: `refactor/phase-3-routers` (从 main 创建)  
> **目标**: 将 227+ API 端点从 `app.py` 拆分到独立路由模块

### 6.1 任务清单

| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|----------|
| 3.1 | 创建 `routers/` 目录和所有路由文件 | P0 | 12 个路由文件就位 |
| 3.2 | 迁移仓库相关端点 (~40个) | P0 | `github_repos.py` |
| 3.3 | 迁移 Issue 相关端点 (~30个) | P0 | `github_issues.py` |
| 3.4 | 迁移 PR 相关端点 (~35个) | P0 | `github_pulls.py` |
| 3.5 | 迁移 Actions 相关端点 (~25个) | P0 | `github_actions.py` |
| 3.6 | 迁移搜索相关端点 (~10个) | P0 | `github_search.py` |
| 3.7 | 迁移其他 GitHub 端点 (~40个) | P0 | `github_misc.py` |
| 3.8 | 迁移 MCP 路由 | P0 | `mcp.py` |
| 3.9 | 迁移部署/同步/Webhook 端点 | P0 | `deploy.py`、`sync.py`、`webhooks.py` |
| 3.10 | 迁移系统端点 | P0 | `system.py` |
| 3.11 | 实现 Pydantic 数据模型 | P1 | `models/github.py` 等 |
| 3.12 | 实现 Service 层 | P1 | `services/github_service.py` 等 |
| 3.13 | 废弃 `app.py` | P0 | 保留为重定向或兼容层 |

### 6.2 路由模块拆分方案

| 路由文件 | 端点前缀 | 端点数量 | 包含功能 |
|----------|----------|----------|----------|
| `github_repos.py` | `/api/github/repos` | ~40 | 仓库 CRUD、Star、Fork、同步、文件浏览 |
| `github_issues.py` | `/api/github/repos/*/issues` | ~30 | Issue CRUD、评论、标签 |
| `github_pulls.py` | `/api/github/repos/*/pulls` | ~35 | PR CRUD、Review、合并 |
| `github_actions.py` | `/api/github/repos/*/actions` | ~25 | Workflows、Runs、Jobs |
| `github_search.py` | `/api/github/search` | ~10 | 代码/仓库/Issue/用户搜索 |
| `github_misc.py` | `/api/github/*` | ~40 | 用户、通知、组织、讨论 |
| `mcp.py` | `/mcp` | 4 | SSE、Streamable HTTP |
| `deploy.py` | `/api/deploy` | 3 | HF Space 部署 |
| `sync.py` | `/api/sync` | 6 | 仓库同步 |
| `webhooks.py` | `/api/webhooks` | 4 | GitHub/HF Webhook |
| `system.py` | `/health`, `/api/*` | 5 | 健康检查、配置、统计 |

### 6.3 Phase 3 完成后的 Git 操作

```bash
git add .
git commit -m "refactor(routers): Phase 3 API 路由拆分

- 将 227+ 端点从 app.py 拆分到 11 个路由模块
- 实现 Pydantic 数据模型
- 实现 Service 业务逻辑层
- 废弃 app.py（保留兼容层）
- 所有端点路径和参数保持不变

BREAKING CHANGE: app.py 不再作为主入口"

git push origin refactor/phase-3-routers
# 合并、打 tag v7.3.0、发布 Release...
```

---

## 7. Phase 4: 基础设施升级 (v7.4.0)

> **分支**: `refactor/phase-4-infra` (从 main 创建)  
> **目标**: 事件总线、缓存升级、审计日志、安全增强

### 7.1 任务清单

| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|----------|
| 4.1 | 实现事件总线 `core/events.py` | P0 | publish/subscribe/异步通知 |
| 4.2 | 替换全局状态为事件总线 | P0 | webhook_events、mcp_tool_calls |
| 4.3 | 升级缓存层 | P1 | LRU 淘汰、可选 Redis 后端 |
| 4.4 | 实现审计日志 | P1 | MCP 工具调用、Shell 执行、代理请求 |
| 4.5 | 增强安全策略 | P1 | Shell 沙箱、SSRF 防护增强 |
| 4.6 | WebSocket 实时通知 | P2 | 替代 SSE 推送 |

### 7.2 事件总线设计

```python
# backend/core/events.py
import asyncio
from collections import defaultdict
from typing import Callable
from datetime import datetime


class Event:
    """事件对象"""
    def __init__(self, type: str, data: dict, source: str = ""):
        self.type = type
        self.data = data
        self.source = source
        self.timestamp = datetime.now().isoformat()


class EventBus:
    """异步事件总线"""
    def __init__(self):
        self._handlers: dict[str, list[Callable]] = defaultdict(list)
        self._history: list[Event] = []
        self._max_history = 500

    def subscribe(self, event_type: str, handler: Callable):
        self._handlers[event_type].append(handler)

    async def publish(self, event: Event):
        self._history.insert(0, event)
        if len(self._history) > self._max_history:
            self._history.pop()
        for handler in self._handlers.get(event.type, []):
            try:
                await handler(event)
            except Exception as e:
                import logging
                logging.error(f"事件处理器错误 [{event.type}]: {e}")

    def get_history(self, event_type: str = None, limit: int = 50) -> list[Event]:
        events = self._history
        if event_type:
            events = [e for e in events if e.type == event_type]
        return events[:limit]


event_bus = EventBus()


class EventType:
    GITHUB_WEBHOOK = "github.webhook"
    HF_WEBHOOK = "hf.webhook"
    MCP_TOOL_CALL = "mcp.tool_call"
    MCP_SHELL_EXEC = "mcp.shell_exec"
    MCP_PROXY_REQUEST = "mcp.proxy_request"
    DEPLOY_START = "deploy.start"
    DEPLOY_COMPLETE = "deploy.complete"
    SYNC_START = "sync.start"
    SYNC_COMPLETE = "sync.complete"
    CACHE_INVALIDATE = "cache.invalidate"
```

### 7.3 Phase 4 完成后的 Git 操作

```bash
git add .
git commit -m "feat(infra): Phase 4 基础设施升级

- 实现异步事件总线替代全局可变状态
- 升级缓存层（LRU 淘汰策略）
- 实现审计日志（MCP/Shell/Proxy）
- 增强 Shell 沙箱和 SSRF 防护
- 添加 WebSocket 实时通知"

git push origin refactor/phase-4-infra
# 合并、打 tag v7.4.0、发布 Release...
```

---

## 8. Phase 5: 前端优化 (v7.5.0)

> **分支**: `refactor/phase-5-frontend` (从 main 创建)  
> **目标**: 前端组件化、状态管理、类型化

### 8.1 任务清单

| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|----------|
| 5.1 | 提取图标组件库 | P1 | `components/icons/` 独立模块 |
| 5.2 | 添加状态管理 | P1 | Zustand 或 Jotai |
| 5.3 | API 层类型化 | P2 | TypeScript 或 JSDoc 类型注解 |
| 5.4 | 提取通用 Hook | P2 | useFetch、usePagination 等 |
| 5.5 | 优化构建配置 | P2 | 代码分割、Tree Shaking |

### 8.2 Phase 5 完成后的 Git 操作

```bash
git add .
git commit -m "refactor(frontend): Phase 5 前端优化

- 提取图标组件库到独立模块
- 添加 Zustand 状态管理
- API 层添加 JSDoc 类型注解
- 提取通用 Hook (useFetch, usePagination)
- 优化 Vite 构建配置"

git push origin refactor/phase-5-frontend
# 合并、打 tag v7.5.0、发布 Release...
```

---

## 9. 发布流程

### 9.1 标准 Release 流程

```bash
#!/bin/bash
# scripts/release.sh <version> <title>

VERSION=$1
TITLE=$2

if [ -z "$VERSION" ] || [ -z "$TITLE" ]; then
    echo "Usage: ./scripts/release.sh <version> <title>"
    exit 1
fi

# 1. 确认在 main 分支且已同步
git checkout main && git pull

# 2. 更新版本号
# backend/config.py: app_version = "$VERSION"

# 3. 提交版本号变更
git add .
git commit -m "chore: bump version to $VERSION"

# 4. 打 tag
git tag "$VERSION" -a -m "$VERSION - $TITLE"

# 5. 推送
git push origin main
git push origin "$VERSION"

# 6. 创建 GitHub Release
gh release create "$VERSION" \
    --title "$VERSION - $TITLE" \
    --generate-notes
```

### 9.2 Release Notes 模板

```markdown
## v{version} - {title}

### 🎯 核心变更
- 变更 1
- 变更 2

### 📊 影响范围
- 涉及文件: {files_changed}
- 新增代码: {lines_added}+
- 删除代码: {lines_removed}-

### ✅ 兼容性
- API 端点: {compatible/breaking}
- MCP 协议: {compatible/breaking}
- 前端: {compatible/breaking}
- 环境变量: {compatible/breaking}

### 🧪 测试
- 单元测试: {pass}/{total}
- 集成测试: {pass}/{total}

### 📦 部署
\`\`\`bash
docker pull ghcr.io/arwei944/github-mirror:{version}
docker run -d -p 7860:7860 ghcr.io/arwei944/github-mirror:{version}
\`\`\`
```

### 9.3 CI/CD 自动化

建议在 `.github/workflows/release.yml` 中添加：

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker Image
        run: docker build -t github-mirror:${{ github.ref_name }} .

      - name: Run Tests
        run: docker run github-mirror:${{ github.ref_name }} pytest /app/tests

      - name: Push to GHCR
        run: |
          echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          docker tag github-mirror:${{ github.ref_name }} ghcr.io/arwei944/github-mirror:${{ github.ref_name }}
          docker push ghcr.io/arwei944/github-mirror:${{ github.ref_name }}
```

---

## 10. 风险与回滚

### 10.1 风险矩阵

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| API 行为不一致 | 中 | 高 | 每阶段编写集成测试，对比新旧响应 |
| MCP 客户端不兼容 | 低 | 高 | 保持 JSON-RPC 协议不变，SSE/HTTP 双传输不变 |
| 性能回退 | 低 | 中 | 基准测试对比，异步客户端预期提升 |
| 依赖冲突 | 低 | 中 | 锁定依赖版本，使用虚拟环境 |

### 10.2 回滚策略

```bash
# 快速回滚到上一版本
git checkout v6.5.0
docker build -t github-mirror:rollback .
docker run -d -p 7860:7860 github-mirror:rollback

# 或使用 Docker tag
docker pull ghcr.io/arwei944/github-mirror:v6.5.0
```

### 10.3 灰度发布建议

1. **内部测试**: 每阶段完成后在开发环境验证 1-2 天
2. **Beta 发布**: 先发布 `-beta.1` 版本到测试 Space
3. **正式发布**: 确认无问题后发布正式版本
4. **监控**: 发布后监控错误日志和 API 响应时间

---

> **文档维护**: 本文档应随开发进度同步更新。每阶段完成后，在对应章节添加「完成日期」和「实际变更记录」。
