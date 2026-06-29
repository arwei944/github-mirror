"""
Webhook 路由
接收 GitHub / HuggingFace Webhook 事件
"""
import json
import logging
import threading
from datetime import datetime

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..core.shared_state import (
    _webhook_events, _WEBHOOK_MAX_EVENTS, _state_lock,
    event_queue, ws_manager, api_cache,
    verify_webhook_signature, load_projects, WEBHOOK_SECRET,
)

logger = logging.getLogger("github-mirror.routers.webhooks")

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/github")
async def github_webhook(request: Request):
    """接收 GitHub Webhook 事件，支持自动部署"""
    try:
        body = await request.body()

        # 签名验证
        sig = request.headers.get("X-Hub-Signature-256", "")
        if not verify_webhook_signature(body, sig):
            return JSONResponse(status_code=401, content={"detail": "Invalid signature"})

        payload = json.loads(body)
        event_type = request.headers.get("X-GitHub-Event", "unknown")

        repo_full_name = payload.get("repository", {}).get("full_name", "")
        ref = payload.get("ref", "")
        branch = ref.replace("refs/heads/", "") if ref else ""

        event = {
            "id": payload.get("action", "") + "-" + str(len(_webhook_events)),
            "source": "github",
            "type": event_type,
            "action": payload.get("action", ""),
            "repo": repo_full_name,
            "branch": branch,
            "sender": payload.get("sender", {}).get("login", ""),
            "payload": payload,
            "received_at": datetime.now().isoformat(),
        }

        async with _state_lock:
            _webhook_events.insert(0, event)
            if len(_webhook_events) > _WEBHOOK_MAX_EVENTS:
                _webhook_events.pop()

        # 实时广播
        event_data = {
            "type": event_type, "repo": repo_full_name, "branch": branch,
            "sender": payload.get("sender", {}).get("login", ""),
            "action": payload.get("action", ""),
            "received_at": event["received_at"],
        }
        if event_type == "PushEvent":
            event_data["commits_count"] = len(payload.get("commits", []))
            event_data["pusher"] = payload.get("pusher", {}).get("name", "")
        elif event_type == "IssuesEvent":
            event_data["issue_title"] = payload.get("issue", {}).get("title", "")
        elif event_type == "PullRequestEvent":
            event_data["pr_title"] = payload.get("pull_request", {}).get("title", "")
        event_queue.append(event_data)
        try:
            await ws_manager.broadcast({"type": "event", "data": event_data})
        except Exception:
            pass

        # 缓存失效
        try:
            api_cache.invalidate("GET:/api/github/repos")
            api_cache.invalidate("GET:/api/github/activity")
            api_cache.invalidate("GET:/api/github/activity/aggregated")
            if repo_full_name:
                short_name = repo_full_name.split("/")[-1]
                api_cache.invalidate(f"GET:/api/github/repos/{short_name}")
                api_cache.invalidate(f"GET:/api/github/repos/{short_name}/detail")
        except Exception:
            pass

        # 自动部署
        if event_type == "push" and repo_full_name and branch:
            projects = load_projects()
            for project_name, project in projects.items():
                if project.get("github_repo") == repo_full_name and project.get("branch") == branch:
                    if project.get("auto_deploy", False) and project.get("status") != "deploying":
                        logger.info(f"[Webhook] 自动触发部署: {project_name}")
                        from ..services.deploy_service import start_deploy_thread
                        from ..config import settings
                        start_deploy_thread(
                            {"github_user": settings.github_user, "hf_user": settings.hf_user,
                             "github_token": settings.github_token, "hf_token": settings.hf_token},
                            project_name, project_name,
                        )
                        return {"status": "received", "event_id": event["id"],
                                "auto_deploy": True, "project": project_name}

        return {"status": "received", "event_id": event["id"]}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/huggingface")
async def huggingface_webhook(request: Request):
    """接收 HuggingFace Webhook 事件"""
    try:
        body = await request.body()
        payload = json.loads(body)

        event = {
            "id": "hf-" + str(len(_webhook_events)),
            "source": "huggingface",
            "type": payload.get("event", "unknown"),
            "action": payload.get("action", ""),
            "repo": payload.get("repo", {}).get("name", ""),
            "sender": payload.get("user", ""),
            "payload": payload,
            "received_at": datetime.now().isoformat(),
        }

        async with _state_lock:
            _webhook_events.insert(0, event)
            if len(_webhook_events) > _WEBHOOK_MAX_EVENTS:
                _webhook_events.pop()

        return {"status": "received", "event_id": event["id"]}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/events")
async def get_webhook_events(per_page: int = 50):
    """获取 Webhook 事件列表"""
    return _webhook_events[:per_page]


@router.delete("/events")
async def clear_webhook_events():
    """清空 Webhook 事件"""
    _webhook_events.clear()
    return {"status": "cleared"}
