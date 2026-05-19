"""
配置 MCP 工具
"""

from __future__ import annotations

import json
from typing import Any, Dict

from .base import BaseTool, ToolParameter, ToolResult


class GetConfigTool(BaseTool):
    name = "get_config"
    description = "获取应用配置信息"
    group = "config"
    parameters = {}

    def __init__(self, settings: Any) -> None:
        self._settings = settings

    async def execute(self, **kwargs: Any) -> ToolResult:
        config = {
            "github_user": getattr(self._settings, "github_user", ""),
            "github_token_set": bool(getattr(self._settings, "github_token", "")),
            "hf_user": getattr(self._settings, "hf_user", ""),
            "hf_token_set": bool(getattr(self._settings, "hf_token", "")),
            "version": getattr(self._settings, "app_version", getattr(self._settings, "__version__", "unknown")),
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

    def __init__(self, settings: Any) -> None:
        self._settings = settings

    async def execute(self, **kwargs: Any) -> ToolResult:
        new_github_user = kwargs.get("github_user")
        new_hf_user = kwargs.get("hf_user")
        if new_github_user:
            self._settings.github_user = new_github_user
        if new_hf_user:
            self._settings.hf_user = new_hf_user
        return ToolResult.json({"status": "saved", "github_user": getattr(self._settings, "github_user", ""), "hf_user": getattr(self._settings, "hf_user", "")})
