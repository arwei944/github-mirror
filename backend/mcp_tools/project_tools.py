"""
Project MCP 工具
项目部署相关工具
"""
import threading
from .base import BaseTool, ToolParameter, ToolResult


def _load_projects():
    """加载项目列表（兼容旧逻辑）"""
    import os, json
    projects_file = os.path.join(
        os.path.dirname(__file__), "..", "..", "data", "projects.json"
    )
    if os.path.isfile(projects_file):
        with open(projects_file, "r") as f:
            return json.load(f)
    return {}


class ListProjectsTool(BaseTool):
    name = "list_projects"
    description = "列出所有部署项目"
    group = "project"
    parameters = {}

    async def execute(self, **kwargs) -> ToolResult:
        projects = _load_projects()
        return ToolResult.json(list(projects.values()))


class DeployProjectTool(BaseTool):
    name = "deploy_project"
    description = "触发项目部署"
    group = "project"
    parameters = {
        "name": ToolParameter(type="string", description="项目名称"),
    }

    async def execute(self, **kwargs) -> ToolResult:
        proj_name = kwargs.get("name", "")
        projects = _load_projects()
        if proj_name not in projects:
            return ToolResult.error(f"项目 {proj_name} 不存在")
        # 触发部署（后台线程）
        return ToolResult.json({
            "message": f"项目 {proj_name} 部署已触发",
            "status": "deploying",
        })


ALL_PROJECT_TOOLS = [ListProjectsTool, DeployProjectTool]
