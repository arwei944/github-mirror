"""
MCP 路由模块 - SSE + Streamable HTTP 双传输协议
"""

from __future__ import annotations
import asyncio, json, logging, uuid
from typing import TYPE_CHECKING, Dict
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

if TYPE_CHECKING:
    from ..mcp_tools.registry import ToolRegistry

logger = logging.getLogger(__name__)
router = APIRouter(tags=["MCP"])
_sessions: Dict[str, asyncio.Queue] = {}
_registry: "ToolRegistry" = None


def set_registry(registry: "ToolRegistry") -> None:
    global _registry
    _registry = registry


async def _handle_mcp_jsonrpc(body: dict, session_id: str = "") -> JSONResponse:
    jsonrpc = body.get("jsonrpc", "2.0")
    method = body.get("method", "")
    params = body.get("params", {})
    msg_id = body.get("id")
    if method == "initialize":
        result = {"protocolVersion": "2025-11-25", "capabilities": {"tools": {"listChanged": False}}, "serverInfo": {"name": "github-mirror-mcp", "version": "7.2.0"}}
        return JSONResponse(content={"jsonrpc": jsonrpc, "result": result, "id": msg_id})
    elif method == "notifications/initialized":
        return JSONResponse(content={})
    elif method == "tools/list":
        tools_list = [{"name": t["name"], "description": t["description"], "inputSchema": t["inputSchema"]} for t in _registry.list_tools()]
        return JSONResponse(content={"jsonrpc": jsonrpc, "result": {"tools": tools_list}, "id": msg_id})
    elif method == "tools/call":
        tool_name = params.get("name", "")
        tool_args = params.get("arguments", {})
        result = await _registry.call(tool_name, tool_args)
        result_dict = result.to_dict()
        try:
            from ..mcp_tools.activity import record_mcp_tool_call
            record_mcp_tool_call(tool_name=tool_name, arguments=tool_args, result=result_dict, session_id=session_id)
        except Exception as e:
            logger.warning("Failed to record MCP tool call: %s", e)
        if session_id and session_id in _sessions:
            try: _sessions[session_id].put_nowait({"jsonrpc": jsonrpc, "result": result_dict, "id": msg_id})
            except asyncio.QueueFull: pass
        return JSONResponse(content={"jsonrpc": jsonrpc, "result": result_dict, "id": msg_id})
    elif method == "ping":
        return JSONResponse(content={"jsonrpc": jsonrpc, "result": {}, "id": msg_id})
    else:
        return JSONResponse(content={"jsonrpc": jsonrpc, "error": {"code": -32601, "message": f"Method not found: {method}"}, "id": msg_id})


async def _mcp_sse_generator(session_id: str, base_url: str):
    queue: asyncio.Queue = asyncio.Queue()
    _sessions[session_id] = queue
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
        _sessions.pop(session_id, None)


@router.get("/mcp/sse")
async def mcp_sse_endpoint(request: Request):
    session_id = str(uuid.uuid4())
    base_url = str(request.base_url).rstrip('/')
    return StreamingResponse(_mcp_sse_generator(session_id, base_url), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})


@router.post("/mcp/sse/message")
async def mcp_message_endpoint(request: Request):
    try: body = await request.json()
    except Exception: return JSONResponse(status_code=400, content={"jsonrpc": "2.0", "error": {"code": -32700, "message": "Parse error"}, "id": None})
    session_id = request.query_params.get("session_id", "")
    return await _handle_mcp_jsonrpc(body, session_id=session_id)


@router.post("/mcp")
async def mcp_streamable_endpoint(request: Request):
    try: body = await request.json()
    except Exception: return JSONResponse(status_code=400, content={"jsonrpc": "2.0", "error": {"code": -32700, "message": "Parse error"}, "id": None})
    return await _handle_mcp_jsonrpc(body)


@router.get("/mcp")
@router.get("/mcp/sse/message")
async def mcp_get_probe():
    return JSONResponse(status_code=405, content={"error": "Method Not Allowed", "message": "Use POST for MCP requests"})
