"""
系统管理路由
config / stats / cache / projects / self-update / events / HF spaces
"""
import json
import logging
import os
import subprocess
import threading
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Request, Query
from fastapi.responses import JSONResponse, StreamingResponse

from ..config import settings
from ..core.shared_state import (
    load_projects, save_projects, api_cache,
    event_queue, ws_manager,
)
from ..core.cache_v2 import cache as lru_cache
from ..core.events import event_bus
from ..core.audit import audit_log

logger = logging.getLogger("github-mirror.routers.system")

router = APIRouter(tags=["system"])


# ═══════════════════════════════════════════════════════════
#  Config
# ═══════════════════════════════════════════════════════════

@router.get("/api/config")
async def get_config():
    """获取应用配置"""
    return {
        "github_user": settings.github_user,
        "github_token_set": bool(settings.github_token),
        "hf_user": settings.hf_user,
        "hf_token_set": bool(settings.hf_token),
    }


@router.post("/api/config")
async def update_config(request: Request):
    """更新应用配置（仅限用户名等非敏感配置）"""
    try:
        data = await request.json()
        if data.get("github_user"):
            settings.github_user = data["github_user"]
        if data.get("hf_user"):
            settings.hf_user = data["hf_user"]
        return {"status": "saved", "github_user": settings.github_user, "hf_user": settings.hf_user}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ═══════════════════════════════════════════════════════════
#  Stats
# ═══════════════════════════════════════════════════════════

@router.get("/api/stats")
async def get_stats():
    """获取应用统计"""
    projects = load_projects()
    total = len(projects)
    success = sum(1 for p in projects.values() if p.get("status") == "success")
    error = sum(1 for p in projects.values() if p.get("status") == "error")
    deploying = sum(1 for p in projects.values() if p.get("status") == "deploying")
    return {"total": total, "success": success, "error": error, "deploying": deploying}


# ═══════════════════════════════════════════════════════════
#  Cache
# ═══════════════════════════════════════════════════════════

@router.post("/api/cache/clear")
async def cache_clear():
    """清空缓存"""
    api_cache.clear()
    lru_cache.clear()
    return {"status": "cleared"}


@router.get("/api/cache/stats")
async def cache_stats():
    """获取缓存统计"""
    return api_cache.stats


# ═══════════════════════════════════════════════════════════
#  Projects
# ═══════════════════════════════════════════════════════════

@router.get("/api/projects")
async def list_projects():
    """列出所有项目"""
    return list(load_projects().values())


@router.post("/api/projects/{name}")
async def create_project(name: str, request: Request):
    """创建项目"""
    try:
        data = await request.json()
        projects = load_projects()
        if name in projects:
            return JSONResponse(status_code=409, content={"detail": f"项目 {name} 已存在"})
        projects[name] = data
        save_projects(projects)
        return {"status": "created", "name": name}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.delete("/api/projects/{name}")
async def delete_project(name: str):
    """删除项目"""
    projects = load_projects()
    if name not in projects:
        return JSONResponse(status_code=404, content={"detail": f"项目 {name} 不存在"})
    del projects[name]
    save_projects(projects)
    return {"status": "deleted", "name": name}


@router.post("/api/projects/{name}/deploy")
async def deploy_project(name: str):
    """触发项目部署"""
    projects = load_projects()
    if name not in projects:
        return JSONResponse(status_code=404, content={"detail": f"项目 {name} 不存在"})

    project = projects[name]
    project["status"] = "deploying"
    save_projects(projects)

    def _run():
        try:
            from ..services.deploy_service import deploy_repo
            deploy_repo(
                {"github_user": settings.github_user, "hf_user": settings.hf_user,
                 "github_token": settings.github_token, "hf_token": settings.hf_token},
                name, name,
            )
            p = load_projects()
            if name in p:
                p[name]["status"] = "success"
                save_projects(p)
        except Exception as e:
            p = load_projects()
            if name in p:
                p[name]["status"] = "error"
                p[name]["error"] = str(e)[:200]
                save_projects(p)

    threading.Thread(target=_run, daemon=True).start()
    return {"status": "deploying", "name": name}


# ═══════════════════════════════════════════════════════════
#  HF Spaces
# ═══════════════════════════════════════════════════════════

@router.get("/api/hf/spaces")
async def list_hf_spaces():
    """列出 HF Spaces"""
    user = settings.hf_user or "arwei944"
    spaces = [{"id": f"{user}/github-mirror", "status": "running",
              "url": f"https://{user}-github-mirror.hf.space"}]
    return spaces


@router.get("/api/hf/spaces/status")
async def get_hf_space_status():
    """获取 HF Space 状态"""
    user = settings.hf_user or "arwei944"
    return {"spaces": [{"id": f"{user}/github-mirror", "status": "running"}]}


@router.get("/api/hf/spaces/{space_id}/logs")
async def get_hf_space_logs(space_id: str, lines: int = Query(100, ge=1, le=1000)):
    """获取 HF Space 日志"""
    return {"logs": [], "space_id": space_id, "lines": lines}


# ═══════════════════════════════════════════════════════════
#  Events (SSE + WebSocket)
# ═══════════════════════════════════════════════════════════

@router.get("/api/events/stream")
async def events_stream():
    """SSE 事件流"""
    import asyncio
    async def generate():
        # 先发送历史事件
        for event in list(event_queue):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        # 持续推送新事件
        last_len = len(event_queue)
        while True:
            await asyncio.sleep(2)
            if len(event_queue) > last_len:
                for event in list(event_queue)[last_len:]:
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                last_len = len(event_queue)
            else:
                yield f": keepalive\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/api/events/recent")
async def events_recent(limit: int = Query(20, ge=1, le=100)):
    """获取最近事件"""
    return list(event_queue)[-limit:]


# ═══════════════════════════════════════════════════════════
#  WebSocket
# ═══════════════════════════════════════════════════════════

@router.websocket("/ws/events")
async def ws_events(websocket):
    """WebSocket 事件推送"""
    await ws_manager.connect(websocket)
    try:
        # 发送最近事件
        for event in list(event_queue)[-20:]:
            await websocket.send_json({"type": "event", "data": event})
        # 持续接收
        while True:
            await websocket.receive_text()
    except Exception:
        pass
    finally:
        ws_manager.disconnect(websocket)


# ═══════════════════════════════════════════════════════════
#  Self Update
# ═══════════════════════════════════════════════════════════

@router.post("/api/self-update")
async def self_update():
    """触发自更新"""
    def _run():
        try:
            subprocess.run(["git", "fetch", "--all"], capture_output=True, timeout=60)
            subprocess.run(["git", "reset", "--hard", "origin/main"], capture_output=True, timeout=60)
            subprocess.run(["pip", "install", "-r", "requirements.txt", "--break-system-packages"],
                           capture_output=True, timeout=300)
            subprocess.run(["npm", "install", "--legacy-peer-deps"], capture_output=True,
                           timeout=300, cwd=os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))
            subprocess.run(["npm", "run", "build"], capture_output=True, timeout=120,
                           cwd=os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))
            os.kill(os.getpid(), 15)  # SIGTERM
        except Exception as e:
            logger.error(f"自更新失败: {e}")

    threading.Thread(target=_run, daemon=True).start()
    return {"status": "updating"}


@router.get("/api/self-update/status")
async def self_update_status():
    """获取当前版本信息"""
    try:
        r = subprocess.run(["git", "log", "-1", "--format=%h %s %ci"],
                           capture_output=True, text=True, timeout=10)
        return {"version": r.stdout.strip() if r.returncode == 0 else "unknown"}
    except Exception:
        return {"version": "unknown"}


# ═══════════════════════════════════════════════════════════
#  Webhook Receiver (通用)
# ═══════════════════════════════════════════════════════════

@router.post("/api/webhook/receiver")
async def webhook_receiver(request: Request):
    """通用 Webhook 接收器"""
    try:
        body = await request.body()
        sig = request.headers.get("X-Hub-Signature-256", "")
        from ..core.shared_state import verify_webhook_signature
        if not verify_webhook_signature(body, sig):
            return JSONResponse(status_code=401, content={"detail": "Invalid signature"})

        payload = json.loads(body)
        event_data = {
            "type": "webhook",
            "source": request.headers.get("X-GitHub-Event", "unknown"),
            "received_at": datetime.now().isoformat(),
            "payload_keys": list(payload.keys())[:10],
        }
        event_queue.append(event_data)
        try:
            await ws_manager.broadcast({"type": "event", "data": event_data})
        except Exception:
            pass

        return {"status": "received"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
