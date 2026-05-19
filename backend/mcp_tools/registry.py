"""
MCP 工具注册表
"""

from __future__ import annotations

import json
import logging
from typing import Any, Callable, Dict, List, Optional

from .base import BaseTool, ToolResult

logger = logging.getLogger(__name__)

MiddlewareFunc = Callable[[str, Dict[str, Any], Callable], Any]


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: Dict[str, BaseTool] = {}
        self._middleware: List[MiddlewareFunc] = []

    def register(self, tool: BaseTool) -> None:
        self._tools[tool.name] = tool
        logger.debug("Registered MCP tool: %s (group=%s)", tool.name, tool.group)

    def get_tool(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name)

    def list_tools(self, group: Optional[str] = None) -> List[Dict[str, Any]]:
        tools = self._tools.values()
        if group is not None:
            tools = [t for t in tools if t.group == group]
        return [t.tool_definition() for t in tools]

    def list_groups(self) -> List[str]:
        return sorted({t.group for t in self._tools.values()})

    async def call(self, name: str, arguments: Optional[Dict[str, Any]] = None) -> ToolResult:
        if name not in self._tools:
            return ToolResult.text(json.dumps({"error": f"未知工具: {name}"}, ensure_ascii=False), error=True)
        arguments = arguments or {}
        tool = self._tools[name]

        async def final_call(_name: str, _args: Dict[str, Any]) -> ToolResult:
            return await tool.execute(**_args)

        chain = final_call
        for mw in reversed(self._middleware):
            chain = self._wrap_middleware(mw, chain)
        return await chain(name, arguments)

    @staticmethod
    def _wrap_middleware(middleware: MiddlewareFunc, next_fn: Callable) -> Callable:
        async def wrapped(tool_name: str, arguments: Dict[str, Any]) -> ToolResult:
            return await middleware(tool_name, arguments, next_fn)
        return wrapped

    def add_middleware(self, middleware: MiddlewareFunc) -> None:
        self._middleware.append(middleware)
