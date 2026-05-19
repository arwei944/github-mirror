"""
项目 MCP 工具
"""

from __future__ import annotations

import json
import threading
from typing import Any, Callable, Dict

from .base import BaseTool, ToolParameter, ToolResult


class ListProjectsTool(BaseTool):
    name = "list_projects"
    description = "列出所有部署项目"
    group = "project"
    parameters = {}

    def __init__(self, load_projects_fn: Callable[[], Dict[str, Any]]) -> None:
        self._load_projects = load_projects_fn

    async def execute(self, **kwargs: Any) -> ToolResult:
        projects = self._load_projects()
        return ToolResult.json(list(projects.values()))


class DeployProjectTool(BaseTool):
    name = "deploy_project"
    description = "触发项目部署"
    group = "project"
    parameters = {"name": ToolParameter(type="string", description="项目名称")}

    def __init__(self, load_projects_fn: Callable[[], Dict[str, Any]], run_deploy_fn: Callable[[str, Dict[str, Any]], None]) -> None:
        self._load_projects = load_projects_fn
        self._run_deploy = run_deploy_fn

    async def execute(self, **kwargs: Any) -> ToolResult:
        proj_name = kwargs.get("name", "")
        projects = self._load_projects()
        if proj_name not in projects:
            return ToolResult.json({"error": f"项目 {proj_name} 不存在"}, error=True)
        thread = threading.Thread(target=self._run_deploy, args=(proj_name, projects[proj_name]), daemon=True)
        thread.start()
        return ToolResult.json({"message": f"项目 {proj_name} 部署已触发", "status": "deploying"})
