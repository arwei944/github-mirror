"""
GitHub MCP 工具集 (21 个工具)
所有 GitHub API 相关的 MCP 工具
"""
from .base import BaseTool, ToolParameter, ToolResult


def _filter_repo_fields(r: dict) -> dict:
    """精简仓库字段（兼容旧逻辑）"""
    return {
        "id": r.get("id"),
        "name": r.get("name"),
        "full_name": r.get("full_name"),
        "description": r.get("description"),
        "html_url": r.get("html_url"),
        "language": r.get("language"),
        "stargazers_count": r.get("stargazers_count"),
        "forks_count": r.get("forks_count"),
        "open_issues_count": r.get("open_issues_count"),
        "private": r.get("private"),
        "default_branch": r.get("default_branch"),
        "updated_at": r.get("updated_at"),
        "created_at": r.get("created_at"),
        "topics": r.get("topics", []),
        "size": r.get("size"),
    }


def _enrich_event(e: dict) -> dict:
    """丰富事件信息（兼容旧逻辑）"""
    return {
        "id": e.get("id"),
        "type": e.get("type"),
        "repo": e.get("repo", {}).get("name", ""),
        "payload": e.get("payload", {}),
        "created_at": e.get("created_at"),
    }


# ═══════════════════════════════════════════════════════════

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

    async def execute(self, **kwargs) -> ToolResult:
        params = {
            "type": kwargs.get("type", "all"),
            "sort": kwargs.get("sort", "updated"),
            "per_page": kwargs.get("per_page", 30),
            "page": kwargs.get("page", 1),
        }
        status, data = await self._github_client.get("/user/repos", params=params)
        if status == 200 and isinstance(data, list):
            return ToolResult.json([_filter_repo_fields(r) for r in data])
        return ToolResult.error(f"请求失败 (HTTP {status})")


class GetRepoDetailTool(BaseTool):
    name = "get_repo_detail"
    description = "获取指定仓库的详细信息"
    group = "github"
    parameters = {
        "repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"),
    }

    async def execute(self, **kwargs) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        status, data = await self._github_client.get(f"/repos/{repo_name}")
        if status == 200:
            return ToolResult.json(_filter_repo_fields(data))
        return ToolResult.error(f"获取失败 (HTTP {status})")


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

    async def execute(self, **kwargs) -> ToolResult:
        payload = {
            "name": kwargs.get("name", ""),
            "description": kwargs.get("description", ""),
            "private": kwargs.get("private", False),
            "auto_init": kwargs.get("auto_init", True),
        }
        status, data = await self._github_client.post("/user/repos", json=payload)
        if status in (200, 201):
            return ToolResult.json(_filter_repo_fields(data))
        return ToolResult.error(f"创建失败 (HTTP {status})")


class DeleteRepoTool(BaseTool):
    name = "delete_repo"
    description = "删除指定的 GitHub 仓库"
    group = "github"
    parameters = {
        "repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"),
    }

    async def execute(self, **kwargs) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        status, data = await self._github_client.delete(f"/repos/{repo_name}")
        if status == 204:
            return ToolResult.json({"status": "deleted", "repo": repo_name})
        return ToolResult.error(f"删除失败 (HTTP {status})")


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

    async def execute(self, **kwargs) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        params = {
            "state": kwargs.get("state", "open"),
            "sort": kwargs.get("sort", "created"),
            "per_page": kwargs.get("per_page", 30),
            "page": kwargs.get("page", 1),
        }
        status, data = await self._github_client.get(f"/repos/{repo_name}/issues", params=params)
        if status == 200 and isinstance(data, list):
            return ToolResult.json(data)
        return ToolResult.error(f"请求失败 (HTTP {status})")


class CreateIssueTool(BaseTool):
    name = "create_issue"
    description = "创建新的 Issue"
    group = "github"
    parameters = {
        "repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"),
        "title": ToolParameter(type="string", description="Issue 标题"),
        "body": ToolParameter(type="string", description="Issue 内容 (Markdown)", optional=True),
        "assignees": ToolParameter(type="array", description="指派人列表", items={"type": "string"}, optional=True),
        "labels": ToolParameter(type="array", description="标签列表", items={"type": "string"}, optional=True),
    }

    async def execute(self, **kwargs) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        payload = {"title": kwargs.get("title", ""), "body": kwargs.get("body", "")}
        if kwargs.get("assignees"):
            payload["assignees"] = kwargs["assignees"]
        if kwargs.get("labels"):
            payload["labels"] = kwargs["labels"]
        status, data = await self._github_client.post(f"/repos/{repo_name}/issues", json=payload)
        if status == 201:
            return ToolResult.json(data)
        return ToolResult.error(f"创建失败 (HTTP {status})")


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

    async def execute(self, **kwargs) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        params = {
            "state": kwargs.get("state", "open"),
            "sort": kwargs.get("sort", "created"),
            "per_page": kwargs.get("per_page", 30),
            "page": kwargs.get("page", 1),
        }
        status, data = await self._github_client.get(f"/repos/{repo_name}/pulls", params=params)
        if status == 200 and isinstance(data, list):
            return ToolResult.json(data)
        return ToolResult.error(f"请求失败 (HTTP {status})")


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

    async def execute(self, **kwargs) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        payload = {
            "title": kwargs.get("title", ""),
            "body": kwargs.get("body", ""),
            "head": kwargs.get("head", ""),
            "base": kwargs.get("base", "main"),
        }
        status, data = await self._github_client.post(f"/repos/{repo_name}/pulls", json=payload)
        if status == 201:
            return ToolResult.json(data)
        return ToolResult.error(f"创建失败 (HTTP {status})")


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

    async def execute(self, **kwargs) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        pr_number = kwargs.get("pr_number", 0)
        payload = {
            "commit_title": kwargs.get("commit_title", ""),
            "merge_method": kwargs.get("merge_method", "merge"),
        }
        status, data = await self._github_client.put(
            f"/repos/{repo_name}/pulls/{pr_number}/merge", json=payload
        )
        if status == 200:
            return ToolResult.json(data)
        return ToolResult.error(f"合并失败 (HTTP {status})")


class SearchCodeTool(BaseTool):
    name = "search_code"
    description = "在 GitHub 上搜索代码"
    group = "github"
    parameters = {
        "q": ToolParameter(type="string", description="搜索查询 (例: className repo:owner/repo)"),
        "per_page": ToolParameter(type="integer", description="每页数量", default=30, optional=True),
        "page": ToolParameter(type="integer", description="页码", default=1, optional=True),
    }

    async def execute(self, **kwargs) -> ToolResult:
        params = {"q": kwargs.get("q", ""), "per_page": kwargs.get("per_page", 30), "page": kwargs.get("page", 1)}
        status, data = await self._github_client.get("/search/code", params=params)
        if status == 200:
            return ToolResult.json(data)
        return ToolResult.error(f"搜索失败 (HTTP {status})")


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

    async def execute(self, **kwargs) -> ToolResult:
        params = {
            "q": kwargs.get("q", ""),
            "sort": kwargs.get("sort", "stars"),
            "per_page": kwargs.get("per_page", 30),
            "page": kwargs.get("page", 1),
        }
        status, data = await self._github_client.get("/search/repositories", params=params)
        if status == 200:
            return ToolResult.json(data)
        return ToolResult.error(f"搜索失败 (HTTP {status})")


class GetActivityTool(BaseTool):
    name = "get_activity"
    description = "获取 GitHub 活动流"
    group = "github"
    parameters = {
        "per_page": ToolParameter(type="integer", description="每页数量 (1-100)", default=30, optional=True),
    }

    async def execute(self, **kwargs) -> ToolResult:
        per_page = kwargs.get("per_page", 30)
        user = self._github_user or "arwei944"
        status, data = await self._github_client.get(f"/users/{user}/events", params={"per_page": per_page})
        if status == 200 and isinstance(data, list):
            return ToolResult.json([_enrich_event(e) for e in data])
        return ToolResult.error(f"获取失败 (HTTP {status})")


class GetUserTool(BaseTool):
    name = "get_user"
    description = "获取当前 GitHub 用户资料"
    group = "github"
    parameters = {}

    async def execute(self, **kwargs) -> ToolResult:
        status, data = await self._github_client.get("/user")
        if status == 200:
            return ToolResult.json(data)
        return ToolResult.error(f"获取失败 (HTTP {status})")


class GetNotificationsTool(BaseTool):
    name = "get_notifications"
    description = "获取 GitHub 通知列表"
    group = "github"
    parameters = {
        "per_page": ToolParameter(type="integer", description="每页数量 (1-100)", default=20, optional=True),
    }

    async def execute(self, **kwargs) -> ToolResult:
        per_page = kwargs.get("per_page", 20)
        status, data = await self._github_client.get("/notifications", params={"per_page": per_page})
        if status == 200 and isinstance(data, list):
            return ToolResult.json(data)
        return ToolResult.error(f"获取失败 (HTTP {status})")


class GetRepoContentsTool(BaseTool):
    name = "get_repo_contents"
    description = "获取仓库文件/目录内容"
    group = "github"
    parameters = {
        "repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"),
        "path": ToolParameter(type="string", description="文件/目录路径", default="", optional=True),
    }

    async def execute(self, **kwargs) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        path = kwargs.get("path", "")
        api_path = f"/repos/{repo_name}/contents"
        if path:
            api_path += f"/{path}"
        status, data = await self._github_client.get(api_path)
        if status == 200:
            return ToolResult.json(data if data else [])
        return ToolResult.error(f"获取失败 (HTTP {status})")


class GetCommitsTool(BaseTool):
    name = "get_commits"
    description = "获取仓库提交历史"
    group = "github"
    parameters = {
        "repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"),
        "branch": ToolParameter(type="string", description="分支名", optional=True),
        "per_page": ToolParameter(type="integer", description="每页数量", default=20, optional=True),
    }

    async def execute(self, **kwargs) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        params = {"per_page": kwargs.get("per_page", 20)}
        branch = kwargs.get("branch")
        if branch:
            params["sha"] = branch
        status, data = await self._github_client.get(f"/repos/{repo_name}/commits", params=params)
        if status == 200 and isinstance(data, list):
            return ToolResult.json(data)
        return ToolResult.error(f"获取失败 (HTTP {status})")


class GetRepoTagsTool(BaseTool):
    name = "get_repo_tags"
    description = "获取仓库标签列表"
    group = "github"
    parameters = {
        "repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"),
        "per_page": ToolParameter(type="integer", description="每页数量", default=30, optional=True),
    }

    async def execute(self, **kwargs) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        per_page = kwargs.get("per_page", 30)
        status, data = await self._github_client.get(f"/repos/{repo_name}/tags", params={"per_page": per_page})
        if status == 200 and isinstance(data, list):
            return ToolResult.json(data)
        return ToolResult.error(f"获取失败 (HTTP {status})")


class GetRepoBranchesTool(BaseTool):
    name = "get_repo_branches"
    description = "获取仓库分支列表"
    group = "github"
    parameters = {
        "repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"),
    }

    async def execute(self, **kwargs) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        status, data = await self._github_client.get(f"/repos/{repo_name}/branches")
        if status == 200 and isinstance(data, list):
            return ToolResult.json(data)
        return ToolResult.error(f"获取失败 (HTTP {status})")


class GetRepoReleasesTool(BaseTool):
    name = "get_repo_releases"
    description = "获取仓库发布版本列表"
    group = "github"
    parameters = {
        "repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"),
        "per_page": ToolParameter(type="integer", description="每页数量", default=10, optional=True),
    }

    async def execute(self, **kwargs) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        per_page = kwargs.get("per_page", 10)
        status, data = await self._github_client.get(f"/repos/{repo_name}/releases", params={"per_page": per_page})
        if status == 200 and isinstance(data, list):
            return ToolResult.json(data)
        return ToolResult.error(f"获取失败 (HTTP {status})")


class GetRepoStargazersTool(BaseTool):
    name = "get_repo_stargazers"
    description = "获取仓库 Star 用户列表"
    group = "github"
    parameters = {
        "repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"),
        "per_page": ToolParameter(type="integer", description="每页数量", default=30, optional=True),
    }

    async def execute(self, **kwargs) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        per_page = kwargs.get("per_page", 30)
        status, data = await self._github_client.get(f"/repos/{repo_name}/stargazers", params={"per_page": per_page})
        if status == 200 and isinstance(data, list):
            return ToolResult.json(data)
        return ToolResult.error(f"获取失败 (HTTP {status})")


class ForkRepoTool(BaseTool):
    name = "fork_repo"
    description = "Fork 一个仓库"
    group = "github"
    parameters = {
        "repo_name": ToolParameter(type="string", description="仓库名称 (owner/repo 格式)"),
    }

    async def execute(self, **kwargs) -> ToolResult:
        repo_name = kwargs.get("repo_name", "")
        status, data = await self._github_client.post(f"/repos/{repo_name}/forks")
        if status == 202:
            return ToolResult.json(data)
        return ToolResult.error(f"Fork 失败 (HTTP {status})")


# ═══════════════════════════════════════════════════════════
#  导出所有 GitHub 工具类
# ═══════════════════════════════════════════════════════════

ALL_GITHUB_TOOLS = [
    ListReposTool, GetRepoDetailTool, CreateRepoTool, DeleteRepoTool,
    ListIssuesTool, CreateIssueTool, ListPullsTool, CreatePRTool, MergePRTool,
    SearchCodeTool, SearchReposTool, GetActivityTool, GetUserTool,
    GetNotificationsTool, GetRepoContentsTool, GetCommitsTool,
    GetRepoTagsTool, GetRepoBranchesTool, GetRepoReleasesTool,
    GetRepoStargazersTool, ForkRepoTool,
]
