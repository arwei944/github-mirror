"""
MCP 传输层路由
JSON-RPC 处理 + SSE 传输 + Streamable HTTP
使用 ToolRegistry 分发工具调用（替代旧 if-elif 链）
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

# SSE 会话管理
_mcp_sessions: Dict[str, asyncio.Queue] = {}

# 工具调用历史
_mcp_tool_calls: list = []
_MCP_TOOL_CALLS_MAX = 200

# 事件类型标签
EVENT_TYPE_LABELS = {
    "McpToolCallEvent": "MCP 工具调用",
    "McpShellEvent": "MCP Shell 执行",
    "McpProxyEvent": "MCP 代理请求",
}


def _record_tool_call(tool_name: str, arguments: dict, result: dict,
                      session_id: str = ""):
    """记录 MCP 工具调用到历史"""
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


async def _handle_jsonrpc(body: dict, session_id: str = "") -> JSONResponse:
    """处理 MCP JSON-RPC 请求"""
    jsonrpc = body.get("jsonrpc", "2.0")
    method = body.get("method", "")
    params = body.get("params", {})
    msg_id = body.get("id")

    if method == "initialize":
        result = {
            "protocolVersion": "2025-11-25",
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {
                "name": "github-mirror-mcp",
                "version": settings.app_version,
            },
        }
        return JSONResponse(content={"jsonrpc": jsonrpc, "result": result, "id": msg_id})

    elif method == "notifications/initialized":
        return JSONResponse(content={})

    elif method == "tools/list":
        tools_list = [
            {
                "name": t["name"],
                "description": t["description"],
                "inputSchema": t["inputSchema"],
            }
            for t in registry.list_tools()
        ]
        return JSONResponse(content={"jsonrpc": jsonrpc, "result": {"tools": tools_list}, "id": msg_id})

    elif method == "tools/call":
        tool_name = params.get("name", "")
        tool_args = params.get("arguments", {})

        # 使用 ToolRegistry 分发（替代旧 if-elif 链）
        result = await registry.call(tool_name, tool_args)

        # 记录工具调用
        _record_tool_call(tool_name, tool_args, result, session_id=session_id)

        # SSE 会话推送
        if session_id and session_id in _mcp_sessions:
            try:
                _mcp_sessions[session_id].put_nowait({
                    "jsonrpc": jsonrpc, "result": result, "id": msg_id,
                })
            except asyncio.QueueFull:
                pass

        return JSONResponse(content={"jsonrpc": jsonrpc, "result": result, "id": msg_id})

    elif method == "ping":
        return JSONResponse(content={"jsonrpc": jsonrpc, "result": {}, "id": msg_id})

    else:
        return JSONResponse(content={
            "jsonrpc": jsonrpc,
            "error": {"code": -32601, "message": f"Method not found: {method}"},
            "id": msg_id,
        })


async def _sse_generator(session_id: str, base_url: str):
    """SSE 事件生成器"""
    queue = asyncio.Queue()
    _mcp_sessions[session_id] = queue
    try:
        yield f"event: endpoint\ndata: {base_url}/mcp/sse/message?session_id={session_id}\n\n"
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=30.0)
                yield f"data: {json.dumps(msg, ensure_ascii=False)}\n\n"
            except asyncio.TimeoutError:
                yield f": keepalive\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        _mcp_sessions.pop(session_id, None)


# ═══════════════════════════════════════════════════════════
#  端点定义
# ═══════════════════════════════════════════════════════════

@router.get("/mcp/sse")
async def mcp_sse(request: Request):
    """MCP SSE 端点"""
    session_id = str(uuid.uuid4())
    base_url = str(request.base_url).rstrip('/')
    return StreamingResponse(
        _sse_generator(session_id, base_url),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/mcp/sse/message")
async def mcp_sse_message(request: Request):
    """MCP SSE 消息处理"""
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(
            status_code=400,
            content={"jsonrpc": "2.0", "error": {"code": -32700, "message": "Parse error"}, "id": None},
        )
    session_id = request.query_params.get("session_id", "")
    return await _handle_jsonrpc(body, session_id=session_id)


@router.post("/mcp")
async def mcp_streamable(request: Request):
    """MCP Streamable HTTP 端点"""
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(
            status_code=400,
            content={"jsonrpc": "2.0", "error": {"code": -32700, "message": "Parse error"}, "id": None},
        )
    return await _handle_jsonrpc(body)


@router.get("/mcp")
@router.get("/mcp/sse/message")
async def mcp_probe():
    """MCP 探测端点"""
    return JSONResponse(
        status_code=405,
        content={"error": "Method Not Allowed", "message": "Use POST for MCP requests"},
    )


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
