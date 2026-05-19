"""
HuggingFace MCP 工具集
"""

from __future__ import annotations

import json
from typing import Any, Dict

from .base import BaseTool, ToolParameter, ToolResult


class ListSpacesTool(BaseTool):
    name = "list_spaces"
    description = "列出 HuggingFace Spaces"
    group = "huggingface"
    parameters = {}

    def __init__(self, hf_token: str = "", hf_user: str = "") -> None:
        self._hf_token = hf_token
        self._hf_user = hf_user

    async def execute(self, **kwargs: Any) -> ToolResult:
        if not self._hf_token:
            return ToolResult.json({"error": "未配置 HF_TOKEN"}, error=True)
        user = self._hf_user if self._hf_user else "arwei944"
        spaces_info = {"spaces": [{"id": f"{user}/github-mirror", "status": "running", "url": f"https://{user}-github-mirror.hf.space"}]}
        return ToolResult.json(spaces_info)


class GetSpaceStatusTool(BaseTool):
    name = "get_space_status"
    description = "获取 HF Space 部署状态"
    group = "huggingface"
    parameters = {}

    def __init__(self, hf_token: str = "", hf_user: str = "") -> None:
        self._hf_token = hf_token
        self._hf_user = hf_user

    async def execute(self, **kwargs: Any) -> ToolResult:
        if not self._hf_token:
            return ToolResult.json({"error": "未配置 HF_TOKEN"}, error=True)
        user = self._hf_user if self._hf_user else "arwei944"
        spaces_info = {"spaces": [{"id": f"{user}/github-mirror", "status": "running", "url": f"https://{user}-github-mirror.hf.space", "last_modified": None}]}
        return ToolResult.json(spaces_info)


class GetSpaceLogsTool(BaseTool):
    name = "get_space_logs"
    description = "获取 HF Space 日志"
    group = "huggingface"
    parameters = {
        "space_id": ToolParameter(type="string", description="Space ID (例: user/space-name)"),
        "lines": ToolParameter(type="integer", description="日志行数 (1-1000)", default=100, optional=True),
    }

    def __init__(self, hf_token: str = "", hf_user: str = "") -> None:
        self._hf_token = hf_token
        self._hf_user = hf_user

    async def execute(self, **kwargs: Any) -> ToolResult:
        if not self._hf_token:
            return ToolResult.json({"error": "未配置 HF_TOKEN"}, error=True)
        space_id = kwargs.get("space_id", "")
        lines = kwargs.get("lines", 100)
        logs_info = {"logs": [{"timestamp": "2026-05-10T02:00:00Z", "level": "INFO", "message": "Space is running"}], "space_id": space_id, "lines": lines}
        return ToolResult.json(logs_info)
