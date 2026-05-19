"""
GitHub MCP 工具集

包含 21 个 GitHub 相关的 MCP 工具类，每个工具的参数定义和执行逻辑
与 app.py 中 ``_register_tool()`` 和 ``_mcp_call_tool()`` 完全一致。
"""

from __future__ import annotations

import json
import urllib.parse
from typing import Any, Dict, List, Tuple

from .activity import enrich_event
from .base import BaseTool, ToolParameter, ToolResult

REPO_FIELDS: List[str] = [
    "name", "full_name", "description", "language", "visibility",
    "default_branch", "updated_at", "html_url", "topics",
    "stargazers_count", "forks_count", "open_issues_count", "size",
    "license", "created_at", "pushed_at", "archived", "homepage", "watchers_count",
]


def filter_repo_fields(repo: dict) -> dict:
    filtered = {}
    for key in REPO_FIELDS:
        if key in repo:
            filtered[key] = repo[key]
    return filtered


class ListReposTool(BaseTool):
    name = "list_repos"
    description = "列出 GitHub 仓库列表，支持分页、排序和类型过滤"
    group = "github"
    parameters = {
        "type": ToolParameter(type="string", description="仓库类型: all, owner, member", default="all", optional=True),
        "sort": ToolParameter(type="string", description="排序: updated, created, pushed, full_name", default="updated", optional=True),
        "per_page": ToolParameter(type="integer", description="每页数量 (1-100)", default=30, optional=True),
        "page": ToolParameter(type="integer", description="页码", default=1, optional=True),
    }
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        params = {"type": kwargs.get("type", "all"), "sort": kwargs.get("sort", "updated"), "per_page": str(kwargs.get("per_page", 30)), "page": str(kwargs.get("page", 1))}
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        status, data = self._client.get(f"/user/repos?{qs}")
        if status == 200 and isinstance(data, list):
            return ToolResult.json([filter_repo_fields(r) for r in data])
        return ToolResult.json({"error": f"请求失败 (HTTP {status})", "detail": str(data)}, error=True)


class GetRepoDetailTool(BaseTool):
    name = "get_repo_detail"
    description = "获取指定仓库的详细信息"
    group = "github"
    parameters = {"repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)")}
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        status, data = self._client.get(f"/repos/{repo_name}")
        if status == 200:
            return ToolResult.json(filter_repo_fields(data))
        return ToolResult.json({"error": f"获取失败 (HTTP {status})", "detail": str(data)}, error=True)


class CreateRepoTool(BaseTool):
    name = "create_repo"
    description = "创建新的 GitHub 仓库"
    group = "github"
    parameters = {
        "name": ToolParameter(type="string", description="仓库名称"),
        "description": ToolParameter(type="string", description="仓库描述", optional=True),
        "private": ToolParameter(type="boolean", description="是否私有", default=False, optional=True),
        "auto_init": ToolParameter(type="boolean", description="是否自动初始化 README", default=True, optional=True),
    }
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        payload = {"name": kwargs.get("name", ""), "description": kwargs.get("description", ""), "private": kwargs.get("private", False), "auto_init": kwargs.get("auto_init", True)}
        status, data = self._client.post("/user/repos", data=payload)
        if status in (200, 201):
            return ToolResult.json(filter_repo_fields(data))
        return ToolResult.json({"error": f"创建失败 (HTTP {status})", "detail": str(data)}, error=True)


class DeleteRepoTool(BaseTool):
    name = "delete_repo"
    description = "删除指定的 GitHub 仓库"
    group = "github"
    parameters = {"repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)")}
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        status, data = self._client.delete(f"/repos/{repo_name}")
        if status == 204:
            return ToolResult.json({"status": "deleted", "repo": repo_name})
        return ToolResult.json({"error": f"删除失败 (HTTP {status})", "detail": str(data)}, error=True)


class ListIssuesTool(BaseTool):
    name = "list_issues"
    description = "列出仓库的 Issues"
    group = "github"
    parameters = {
        "repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"),
        "state": ToolParameter(type="string", description="状态: open, closed, all", default="open", optional=True),
        "sort": ToolParameter(type="string", description="排序: created, updated, comments", default="created", optional=True),
        "per_page": ToolParameter(type="integer", description="每页数量", default=30, optional=True),
        "page": ToolParameter(type="integer", description="页码", default=1, optional=True),
    }
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        params = {"state": kwargs.get("state", "open"), "sort": kwargs.get("sort", "created"), "per_page": str(kwargs.get("per_page", 30)), "page": str(kwargs.get("page", 1))}
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        status, data = self._client.get(f"/repos/{repo_name}/issues?{qs}")
        if status == 200 and isinstance(data, list):
            return ToolResult.json(data)
        return ToolResult.json({"error": f"请求失败 (HTTP {status})", "detail": str(data)}, error=True)


class CreateIssueTool(BaseTool):
    name = "create_issue"
    description = "创建新的 Issue"
    group = "github"
    parameters = {
        "repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"),
        "title": ToolParameter(type="string", description="Issue 标题"),
        "body": ToolParameter(type="string", description="Issue 内容 (Markdown)", optional=True),
        "assignees": ToolParameter(type="array", description="指派人列表", optional=True, items={"type": "string"}),
        "labels": ToolParameter(type="array", description="标签列表", optional=True, items={"type": "string"}),
    }
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        payload: Dict[str, Any] = {"title": kwargs.get("title", ""), "body": kwargs.get("body", "")}
        assignees = kwargs.get("assignees")
        if assignees: payload["assignees"] = assignees
        labels = kwargs.get("labels")
        if labels: payload["labels"] = labels
        status, data = self._client.post(f"/repos/{repo_name}/issues", data=payload)
        if status == 201: return ToolResult.json(data)
        return ToolResult.json({"error": f"创建失败 (HTTP {status})", "detail": str(data)}, error=True)


class ListPullsTool(BaseTool):
    name = "list_pulls"
    description = "列出仓库的 Pull Requests"
    group = "github"
    parameters = {
        "repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"),
        "state": ToolParameter(type="string", description="状态: open, closed, all", default="open", optional=True),
        "sort": ToolParameter(type="string", description="排序: created, updated, popularity", default="created", optional=True),
        "per_page": ToolParameter(type="integer", description="每页数量", default=30, optional=True),
        "page": ToolParameter(type="integer", description="页码", default=1, optional=True),
    }
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        params = {"state": kwargs.get("state", "open"), "sort": kwargs.get("sort", "created"), "per_page": str(kwargs.get("per_page", 30)), "page": str(kwargs.get("page", 1))}
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        status, data = self._client.get(f"/repos/{repo_name}/pulls?{qs}")
        if status == 200 and isinstance(data, list): return ToolResult.json(data)
        return ToolResult.json({"error": f"请求失败 (HTTP {status})", "detail": str(data)}, error=True)


class CreatePRTool(BaseTool):
    name = "create_pr"
    description = "创建 Pull Request"
    group = "github"
    parameters = {
        "repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"),
        "title": ToolParameter(type="string", description="PR 标题"),
        "body": ToolParameter(type="string", description="PR 描述 (Markdown)", optional=True),
        "head": ToolParameter(type="string", description="源分支"),
        "base": ToolParameter(type="string", description="目标分支", default="main", optional=True),
    }
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        payload = {"title": kwargs.get("title", ""), "body": kwargs.get("body", ""), "head": kwargs.get("head", ""), "base": kwargs.get("base", "main")}
        status, data = self._client.post(f"/repos/{repo_name}/pulls", data=payload)
        if status == 201: return ToolResult.json(data)
        return ToolResult.json({"error": f"创建失败 (HTTP {status})", "detail": str(data)}, error=True)


class MergePRTool(BaseTool):
    name = "merge_pr"
    description = "合并 Pull Request"
    group = "github"
    parameters = {
        "repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"),
        "pr_number": ToolParameter(type="integer", description="PR 编号"),
        "commit_title": ToolParameter(type="string", description="合并提交标题", optional=True),
        "merge_method": ToolParameter(type="string", description="合并方式: merge, squash, rebase", default="merge", optional=True),
    }
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        pr_number = kwargs.get("pr_number", 0)
        payload = {"commit_title": kwargs.get("commit_title", ""), "merge_method": kwargs.get("merge_method", "merge")}
        status, data = self._client.put(f"/repos/{repo_name}/pulls/{pr_number}/merge", data=payload)
        if status == 200: return ToolResult.json(data)
        return ToolResult.json({"error": f"合并失败 (HTTP {status})", "detail": str(data)}, error=True)


class SearchCodeTool(BaseTool):
    name = "search_code"
    description = "在 GitHub 上搜索代码"
    group = "github"
    parameters = {
        "q": ToolParameter(type="string", description="搜索查询 (例: className repo:owner/repo)"),
        "per_page": ToolParameter(type="integer", description="每页数量", default=30, optional=True),
        "page": ToolParameter(type="integer", description="页码", default=1, optional=True),
    }
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        q = kwargs.get("q", "")
        params = {"q": q, "per_page": str(kwargs.get("per_page", 30)), "page": str(kwargs.get("page", 1))}
        qs = urllib.parse.urlencode(params)
        status, data = self._client.get(f"/search/code?{qs}")
        if status == 200: return ToolResult.json(data)
        return ToolResult.json({"error": f"搜索失败 (HTTP {status})", "detail": str(data)}, error=True)


class SearchReposTool(BaseTool):
    name = "search_repos"
    description = "在 GitHub 上搜索仓库"
    group = "github"
    parameters = {
        "q": ToolParameter(type="string", description="搜索查询 (例: language:python stars:>100)"),
        "sort": ToolParameter(type="string", description="排序: stars, forks, updated", default="stars", optional=True),
        "per_page": ToolParameter(type="integer", description="每页数量", default=30, optional=True),
        "page": ToolParameter(type="integer", description="页码", default=1, optional=True),
    }
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        q = kwargs.get("q", "")
        params = {"q": q, "sort": kwargs.get("sort", "stars"), "per_page": str(kwargs.get("per_page", 30)), "page": str(kwargs.get("page", 1))}
        qs = urllib.parse.urlencode(params)
        status, data = self._client.get(f"/search/repositories?{qs}")
        if status == 200: return ToolResult.json(data)
        return ToolResult.json({"error": f"搜索失败 (HTTP {status})", "detail": str(data)}, error=True)


class GetActivityTool(BaseTool):
    name = "get_activity"
    description = "获取 GitHub 活动流"
    group = "github"
    parameters = {"per_page": ToolParameter(type="integer", description="每页数量 (1-100)", default=30, optional=True)}
    def __init__(self, github_client: Any, github_user: str = "") -> None:
        self._client = github_client
        self._github_user = github_user
    async def execute(self, **kwargs: Any) -> ToolResult:
        per_page = kwargs.get("per_page", 30)
        status, data = self._client.get(f"/users/{self._github_user}/events?per_page={per_page}")
        if status == 200 and isinstance(data, list):
            return ToolResult.json([enrich_event(e) for e in data])
        return ToolResult.json({"error": f"获取失败 (HTTP {status})", "detail": str(data)}, error=True)


class GetUserTool(BaseTool):
    name = "get_user"
    description = "获取当前 GitHub 用户资料"
    group = "github"
    parameters = {}
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        status, data = self._client.get("/user")
        if status == 200: return ToolResult.json(data)
        return ToolResult.json({"error": f"获取失败 (HTTP {status})", "detail": str(data)}, error=True)


class GetNotificationsTool(BaseTool):
    name = "get_notifications"
    description = "获取 GitHub 通知列表"
    group = "github"
    parameters = {"per_page": ToolParameter(type="integer", description="每页数量 (1-100)", default=20, optional=True)}
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        per_page = kwargs.get("per_page", 20)
        status, data = self._client.get(f"/notifications?per_page={per_page}")
        if status == 200 and isinstance(data, list): return ToolResult.json(data)
        return ToolResult.json({"error": f"获取失败 (HTTP {status})", "detail": str(data)}, error=True)


class GetRepoContentsTool(BaseTool):
    name = "get_repo_contents"
    description = "获取仓库文件/目录内容"
    group = "github"
    parameters = {"repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"), "path": ToolParameter(type="string", description="文件/目录路径", default="", optional=True)}
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        path = kwargs.get("path", "")
        api_path = f"/repos/{repo_name}/contents"
        if path: api_path += f"/{path}"
        status, data = self._client.get(api_path)
        if status == 200: return ToolResult.json(data if data else [])
        return ToolResult.json({"error": f"获取失败 (HTTP {status})", "detail": str(data)}, error=True)


class GetCommitsTool(BaseTool):
    name = "get_commits"
    description = "获取仓库提交历史"
    group = "github"
    parameters = {"repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"), "branch": ToolParameter(type="string", description="分支名", optional=True), "per_page": ToolParameter(type="integer", description="每页数量", default=20, optional=True)}
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        params: Dict[str, str] = {"per_page": str(kwargs.get("per_page", 20))}
        branch = kwargs.get("branch")
        if branch: params["sha"] = branch
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        status, data = self._client.get(f"/repos/{repo_name}/commits?{qs}")
        if status == 200 and isinstance(data, list): return ToolResult.json(data)
        return ToolResult.json({"error": f"获取失败 (HTTP {status})", "detail": str(data)}, error=True)


class GetRepoTagsTool(BaseTool):
    name = "get_repo_tags"
    description = "获取仓库标签列表"
    group = "github"
    parameters = {"repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"), "per_page": ToolParameter(type="integer", description="每页数量", default=30, optional=True)}
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        per_page = kwargs.get("per_page", 30)
        status, data = self._client.get(f"/repos/{repo_name}/tags?per_page={per_page}")
        if status == 200 and isinstance(data, list): return ToolResult.json(data)
        return ToolResult.json({"error": f"获取失败 (HTTP {status})", "detail": str(data)}, error=True)


class GetRepoBranchesTool(BaseTool):
    name = "get_repo_branches"
    description = "获取仓库分支列表"
    group = "github"
    parameters = {"repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)")}
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        status, data = self._client.get(f"/repos/{repo_name}/branches")
        if status == 200 and isinstance(data, list): return ToolResult.json(data)
        return ToolResult.json({"error": f"获取失败 (HTTP {status})", "detail": str(data)}, error=True)


class GetRepoReleasesTool(BaseTool):
    name = "get_repo_releases"
    description = "获取仓库发布版本列表"
    group = "github"
    parameters = {"repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"), "per_page": ToolParameter(type="integer", description="每页数量", default=10, optional=True)}
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        per_page = kwargs.get("per_page", 10)
        status, data = self._client.get(f"/repos/{repo_name}/releases?per_page={per_page}")
        if status == 200 and isinstance(data, list): return ToolResult.json(data)
        return ToolResult.json({"error": f"获取失败 (HTTP {status})", "detail": str(data)}, error=True)


class GetRepoStargazersTool(BaseTool):
    name = "get_repo_stargazers"
    description = "获取仓库 Star 用户列表"
    group = "github"
    parameters = {"repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"), "per_page": ToolParameter(type="integer", description="每页数量", default=30, optional=True)}
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        per_page = kwargs.get("per_page", 30)
        status, data = self._client.get(f"/repos/{repo_name}/stargazers?per_page={per_page}")
        if status == 200 and isinstance(data, list): return ToolResult.json(data)
        return ToolResult.json({"error": f"获取失败 (HTTP {status})", "detail": str(data)}, error=True)


class ForkRepoTool(BaseTool):
    name = "fork_repo"
    description = "Fork 一个仓库"
    group = "github"
    parameters = {"repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)")}
    def __init__(self, github_client: Any) -> None:
        self._client = github_client
    async def execute(self, **kwargs: Any) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        status, data = self._client.post(f"/repos/{repo_name}/forks")
        if status == 202: return ToolResult.json(data)
        return ToolResult.json({"error": f"Fork 失败 (HTTP {status})", "detail": str(data)}, error=True)
