"""
MCP Server - 使用官方 FastMCP SDK
将现有 ToolRegistry 中的 30 个工具桥接到 FastMCP
"""
import json
import logging
from typing import Any

from mcp.server.fastmcp import FastMCP, Context
from mcp.server.fastmcp.tools.base import Tool
from mcp.server.fastmcp.exceptions import ToolError
from mcp.types import TextContent

from .config import settings

logger = logging.getLogger("github-mirror.mcp_server")

# ═══════════════════════════════════════════════════════════
#  FastMCP 实例（stateless 模式，适合 HF Spaces 等代理环境）
#  streamable_http_path="/" 因为会被挂载到 FastAPI 的 /mcp 下
# ═══════════════════════════════════════════════════════════

mcp = FastMCP(
    name="github-mirror-mcp",
    instructions="GitHub Mirror MCP 服务 - 提供 GitHub/HuggingFace/Shell/代理/项目/配置工具",
    stateless_http=True,
    streamable_http_path="/",
)


# ═══════════════════════════════════════════════════════════
#  工具注册：将 ToolRegistry 桥接到 FastMCP
# ═══════════════════════════════════════════════════════════

def register_tools_from_registry(registry):
    """将 ToolRegistry 中已注册的工具桥接到 FastMCP"""
    for tool in registry._tools.values():
        _bridge_tool(mcp, tool)

    logger.info(f"已桥接 {registry.count} 个工具到 FastMCP")


def _bridge_tool(fast_mcp: FastMCP, tool):
    """将单个 BaseTool 桥接为 FastMCP 工具（使用底层 API 保留原始 schema）"""

    # 构建原始 JSON Schema
    properties = {}
    required = []
    for param_name, param in tool.parameters.items():
        prop: dict[str, Any] = {
            "type": param.type,
            "description": param.description,
        }
        if param.default is not None:
            prop["default"] = param.default
        if param.items:
            prop["items"] = param.items
        if not param.optional:
            required.append(param_name)
        properties[param_name] = prop

    input_schema = {
        "type": "object",
        "properties": properties,
        "required": required,
    }

    # 创建异步包装函数（接收 arguments dict，直接透传给原始工具）
    async def tool_fn(arguments: dict = None) -> str:
        try:
            args = arguments or {}
            result = await tool.execute(**args)
            if result.content:
                return result.content[0].get("text", "")
            return json.dumps({"error": "empty result"})
        except Exception as e:
            logger.exception(f"MCP tool error: {tool.name}")
            return json.dumps({"error": str(e)})

    tool_fn.__name__ = tool.name
    tool_fn.__doc__ = tool.description

    # 用 Tool.from_function 创建基础 Tool
    mcp_tool = Tool.from_function(tool_fn, name=tool.name, description=tool.description)
    # 覆盖自动生成的 schema，使用原始工具的 schema
    mcp_tool.parameters = input_schema

    # 注册到 ToolManager
    fast_mcp._tool_manager._tools[tool.name] = mcp_tool

    logger.debug(f"桥接工具: {tool.name} (group={tool.group})")
