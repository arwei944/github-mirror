"""
Config MCP 工具
应用配置查询和更新
"""
from .base import BaseTool, ToolParameter, ToolResult


class GetConfigTool(BaseTool):
    name = "get_config"
    description = "获取应用配置信息"
    group = "config"
    parameters = {}

    async def execute(self, **kwargs) -> ToolResult:
        config = {
            "github_user": self._github_user,
            "github_token_set": bool(self._github_client),
            "hf_user": self._hf_user,
            "hf_token_set": bool(self._hf_token),
            "version": "7.7.0",
        }
        return ToolResult.json(config)


class UpdateConfigTool(BaseTool):
    name = "update_config"
    description = "更新应用配置 (仅限用户名等非敏感配置)"
    group = "config"
    parameters = {
        "github_user": ToolParameter(type="string", description="GitHub 用户名", optional=True),
        "hf_user": ToolParameter(type="string", description="HuggingFace 用户名", optional=True),
    }

    async def execute(self, **kwargs) -> ToolResult:
        new_github_user = kwargs.get("github_user")
        new_hf_user = kwargs.get("hf_user")
        if new_github_user:
            self._github_user = new_github_user
        if new_hf_user:
            self._hf_user = new_hf_user
        return ToolResult.json({
            "status": "saved",
            "github_user": self._github_user,
            "hf_user": self._hf_user,
        })


ALL_CONFIG_TOOLS = [GetConfigTool, UpdateConfigTool]
