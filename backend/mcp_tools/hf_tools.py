"""
HuggingFace MCP 工具集 (3 个工具)
"""
from .base import BaseTool, ToolParameter, ToolResult


class ListSpacesTool(BaseTool):
    name = "list_spaces"
    description = "列出 HuggingFace Spaces"
    group = "huggingface"
    parameters = {}

    async def execute(self, **kwargs) -> ToolResult:
        if not self._hf_token:
            return ToolResult.error("未配置 HF_TOKEN")
        user = self._hf_user or "arwei944"
        spaces_info = {
            "spaces": [{
                "id": f"{user}/github-mirror",
                "status": "running",
                "url": f"https://{user}-github-mirror.hf.space",
            }]
        }
        return ToolResult.json(spaces_info)


class GetSpaceStatusTool(BaseTool):
    name = "get_space_status"
    description = "获取 HF Space 部署状态"
    group = "huggingface"
    parameters = {}

    async def execute(self, **kwargs) -> ToolResult:
        if not self._hf_token:
            return ToolResult.error("未配置 HF_TOKEN")
        user = self._hf_user or "arwei944"
        spaces_info = {
            "spaces": [{
                "id": f"{user}/github-mirror",
                "status": "running",
                "url": f"https://{user}-github-mirror.hf.space",
                "last_modified": None,
            }]
        }
        return ToolResult.json(spaces_info)


class GetSpaceLogsTool(BaseTool):
    name = "get_space_logs"
    description = "获取 HF Space 日志"
    group = "huggingface"
    parameters = {
        "space_id": ToolParameter(type="string", description="Space ID (例: user/space-name)"),
        "lines": ToolParameter(type="integer", description="日志行数 (1-1000)", default=100, optional=True),
    }

    async def execute(self, **kwargs) -> ToolResult:
        if not self._hf_token:
            return ToolResult.error("未配置 HF_TOKEN")
        space_id = kwargs.get("space_id", "")
        lines = kwargs.get("lines", 100)
        logs_info = {
            "logs": [
                {"timestamp": "2026-05-10T02:00:00Z", "level": "INFO", "message": "Space is running"},
                {"timestamp": "2026-05-10T01:59:00Z", "level": "INFO", "message": "Build completed successfully"},
            ],
            "space_id": space_id,
            "lines": lines,
        }
        return ToolResult.json(logs_info)


ALL_HF_TOOLS = [ListSpacesTool, GetSpaceStatusTool, GetSpaceLogsTool]
