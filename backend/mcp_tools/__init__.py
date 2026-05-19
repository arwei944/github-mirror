"""
MCP Tools Package - Phase 2 Refactoring
"""

from .base import BaseTool, ToolParameter, ToolResult
from .registry import ToolRegistry


def create_registry(github_client=None, hf_token="", hf_user="",
                    load_projects_fn=None, run_deploy_fn=None, settings=None) -> ToolRegistry:
    from .github_tools import (
        ListReposTool, GetRepoDetailTool, CreateRepoTool, DeleteRepoTool,
        ListIssuesTool, CreateIssueTool, ListPullsTool, CreatePRTool,
        MergePRTool, SearchCodeTool, SearchReposTool, GetActivityTool,
        GetUserTool, GetNotificationsTool, GetRepoContentsTool,
        GetCommitsTool, GetRepoTagsTool, GetRepoBranchesTool,
        GetRepoReleasesTool, GetRepoStargazersTool, ForkRepoTool,
    )
    from .hf_tools import ListSpacesTool, GetSpaceStatusTool, GetSpaceLogsTool
    from .shell_tools import ExecuteShellTool
    from .proxy_tools import ProxyRequestTool
    from .project_tools import ListProjectsTool, DeployProjectTool
    from .config_tools import GetConfigTool, UpdateConfigTool

    registry = ToolRegistry()

    if github_client:
        github_user = getattr(settings, 'github_user', '') if settings else ''
        for tool_cls in [
            ListReposTool, GetRepoDetailTool, CreateRepoTool, DeleteRepoTool,
            ListIssuesTool, CreateIssueTool, ListPullsTool, CreatePRTool,
            MergePRTool, SearchCodeTool, SearchReposTool,
            GetUserTool, GetNotificationsTool, GetRepoContentsTool,
            GetCommitsTool, GetRepoTagsTool, GetRepoBranchesTool,
            GetRepoReleasesTool, GetRepoStargazersTool, ForkRepoTool,
        ]:
            registry.register(tool_cls(github_client))
        registry.register(GetActivityTool(github_client, github_user=github_user))

    for tool_cls in [ListSpacesTool, GetSpaceStatusTool, GetSpaceLogsTool]:
        registry.register(tool_cls(hf_token=hf_token, hf_user=hf_user))

    registry.register(ExecuteShellTool())
    registry.register(ProxyRequestTool())
    registry.register(ListProjectsTool(load_projects_fn=load_projects_fn))
    registry.register(DeployProjectTool(load_projects_fn=load_projects_fn, run_deploy_fn=run_deploy_fn))
    registry.register(GetConfigTool(settings=settings))
    registry.register(UpdateConfigTool(settings=settings))

    return registry


__all__ = ["BaseTool", "ToolParameter", "ToolResult", "ToolRegistry", "create_registry"]
