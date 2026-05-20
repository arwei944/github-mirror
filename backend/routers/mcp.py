"""
MCP 工具调用历史 API
注意：MCP 协议端点（/mcp）已迁移到官方 FastMCP SDK（见 mcp_server.py）
本模块仅保留工具调用历史查询等管理 API
"""
import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Dict

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from ..config import settings
from ..mcp_tools import registry

logger = logging.getLogger("github-mirror.routers.mcp")

router = APIRouter(tags=["mcp"])

# 工具调用历史
_mcp_tool_calls: list = []
_MCP_TOOL_CALLS_MAX = 200

# 事件类型标签
EVENT_TYPE_LABELS = {
    "McpToolCallEvent": "MCP 工具调用",
    "McpShellEvent": "MCP Shell 执行",
    "McpProxyEvent": "MCP 代理请求",
}


def record_tool_call(tool_name: str, arguments: dict, result: dict,
                     session_id: str = ""):
    """记录 MCP 工具调用到历史（供外部调用）"""
    if tool_name == "execute_shell":
        event_type = "McpShellEvent"
    elif tool_name == "proxy_request":
        event_type = "McpProxyEvent"
    else:
        event_type = "McpToolCallEvent"

    result_text = ""
    if result.get("content"):
        result_text = result["content"][0].get("text", "")[:200] if result["content"] else ""
    is_error = result.get("isError", False)

    arg_summary = ""
    if tool_name == "execute_shell":
        arg_summary = arguments.get("command", "")[:100]
    elif tool_name == "proxy_request":
        arg_summary = f"{arguments.get('method', 'GET')} {arguments.get('url', '')}"
    elif "repo_name" in arguments:
        arg_summary = arguments["repo_name"]
    elif "q" in arguments:
        arg_summary = arguments["q"][:80]

    event = {
        "id": f"mcp-{tool_name}-{len(_mcp_tool_calls)}",
        "source": "mcp",
        "type": event_type,
        "type_label": EVENT_TYPE_LABELS.get(event_type, event_type),
        "tool_name": tool_name,
        "arguments": {k: v for k, v in arguments.items()
                      if k not in ("token", "password", "secret")},
        "result_summary": result_text,
        "is_error": is_error,
        "success": not is_error,
        "session_id": session_id,
        "arg_summary": arg_summary,
        "detail": f"调用工具 {tool_name}" + (f": {arg_summary}" if arg_summary else ""),
        "created_at": datetime.now().isoformat(),
    }

    _mcp_tool_calls.insert(0, event)
    if len(_mcp_tool_calls) > _MCP_TOOL_CALLS_MAX:
        _mcp_tool_calls.pop()

    # 发射事件
    try:
        from ..core.events import event_bus, Event, EventType
        evt = Event(
            type=EventType.MCP_TOOL_CALL,
            data={"tool": tool_name, "is_error": is_error, "session_id": session_id},
            source="mcp_router",
        )
        loop = asyncio.get_running_loop()
        loop.create_task(event_bus.publish(evt))
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════
#  MCP 工具调用历史 API
# ═══════════════════════════════════════════════════════════

@router.get("/api/mcp/tool-calls")
async def get_mcp_tool_calls(tool_name: str = "", limit: int = 50):
    """获取 MCP 工具调用历史"""
    calls = _mcp_tool_calls
    if tool_name:
        calls = [c for c in calls if c.get("tool_name") == tool_name]
    return calls[:limit]


@router.get("/api/mcp/tools")
async def get_mcp_tools():
    """获取 MCP 工具列表（按组分组）"""
    tools = registry.list_tools()
    groups: Dict[str, list] = {}
    for t in tools:
        g = t.get("group", "other")
        groups.setdefault(g, []).append(t)
    return groups
