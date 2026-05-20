"""
GitHub Actions 路由
workflows / runs / jobs / secrets / artifacts / variables / caches / runners
"""
import logging
from fastapi import APIRouter, Query, Request, HTTPException
from fastapi.responses import JSONResponse

from ..config import settings
from ..routers.github_proxy import gh_get, gh_post, gh_put, gh_delete, gh_patch

logger = logging.getLogger("github-mirror.routers.github_actions")
router = APIRouter(prefix="/api/github", tags=["github-actions"])


# ──────────────────────────────────────────────
# Workflows / Runs / Jobs
# ──────────────────────────────────────────────

@router.get("/repos/{repo_name}/actions/workflows")
async def list_workflows(repo_name: str):
    """获取仓库 Workflow 列表"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/actions/workflows")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Workflows 失败: {data}")
    workflows = data.get("workflows", []) if isinstance(data, dict) else []
    return [{"id": w.get("id"), "name": w.get("name", ""), "path": w.get("path", ""), "state": w.get("state", ""), "badge_url": w.get("badge_url", ""), "created_at": w.get("created_at", ""), "updated_at": w.get("updated_at", "")} for w in workflows]


@router.get("/repos/{repo_name}/actions/runs")
async def list_workflow_runs(repo_name: str, per_page: int = Query(20, ge=1, le=100)):
    """获取仓库 Workflow 运行记录"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/actions/runs?per_page={per_page}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取运行记录失败: {data}")
    runs = data.get("workflow_runs", []) if isinstance(data, dict) else []
    return [{"id": r.get("id"), "name": r.get("name", ""), "display_title": r.get("display_title", ""), "status": r.get("status", ""), "conclusion": r.get("conclusion"), "workflow_id": r.get("workflow_id"), "created_at": r.get("created_at", ""), "updated_at": r.get("updated_at", ""), "html_url": r.get("html_url", ""), "run_number": r.get("run_number"), "event": r.get("event", ""), "head_branch": r.get("head_branch", "")} for r in runs]


@router.get("/repos/{repo_name}/actions/runs/{run_id}/jobs")
async def list_run_jobs(repo_name: str, run_id: int):
    """获取运行中的 Job 列表"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/actions/runs/{run_id}/jobs")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Jobs 失败: {data}")
    jobs = data.get("jobs", []) if isinstance(data, dict) else []
    return [{"id": j.get("id"), "name": j.get("name", ""), "status": j.get("status", ""), "conclusion": j.get("conclusion"), "started_at": j.get("started_at", ""), "completed_at": j.get("completed_at", ""), "steps": [{"name": s.get("name", ""), "status": s.get("status", ""), "conclusion": s.get("conclusion"), "number": s.get("number")} for s in (j.get("steps") or [])]} for j in jobs]


# ──────────────────────────────────────────────
# Actions Operations
# ──────────────────────────────────────────────

@router.post("/repos/{repo_name}/actions/workflows/{workflow_id}/dispatches")
async def trigger_workflow(repo_name: str, workflow_id: str, request: Request):
    """手动触发 Workflow"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {"ref": body.get("ref", "main")}
    if body.get("inputs"):
        data["inputs"] = body["inputs"]
    status, result = gh_post(f"/repos/{settings.github_user}/{repo_name}/actions/workflows/{workflow_id}/dispatches", data=data)
    if status == 204:
        return {"message": "Workflow 触发成功"}
    raise HTTPException(status_code=status, detail=f"触发 Workflow 失败: {result}")


@router.post("/repos/{repo_name}/actions/runs/{run_id}/cancel")
async def cancel_workflow_run(repo_name: str, run_id: int):
    """取消运行"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, result = gh_post(f"/repos/{settings.github_user}/{repo_name}/actions/runs/{run_id}/cancel")
    if status == 202:
        return {"message": "运行已取消"}
    raise HTTPException(status_code=status, detail=f"取消运行失败: {result}")


@router.post("/repos/{repo_name}/actions/runs/{run_id}/rerun")
async def rerun_workflow(repo_name: str, run_id: int):
    """重新运行"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, result = gh_post(f"/repos/{settings.github_user}/{repo_name}/actions/runs/{run_id}/rerun")
    if status == 201:
        return {"message": "重新运行已触发"}
    raise HTTPException(status_code=status, detail=f"重新运行失败: {result}")


@router.post("/repos/{repo_name}/actions/runs/{run_id}/rerun-failed")
async def rerun_failed_jobs(repo_name: str, run_id: int):
    """重新运行失败的 Jobs"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, result = gh_post(f"/repos/{settings.github_user}/{repo_name}/actions/runs/{run_id}/rerun-failed-jobs")
    if status == 201:
        return {"message": "失败任务重新运行已触发"}
    raise HTTPException(status_code=status, detail=f"重新运行失败任务失败: {result}")


@router.put("/repos/{repo_name}/actions/workflows/{workflow_id}/enable")
async def enable_workflow(repo_name: str, workflow_id: str):
    """启用 Workflow"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, result = gh_put(f"/repos/{settings.github_user}/{repo_name}/actions/workflows/{workflow_id}/enable")
    if status == 204:
        return {"message": "Workflow 已启用"}
    raise HTTPException(status_code=status, detail=f"启用失败: {result}")


@router.put("/repos/{repo_name}/actions/workflows/{workflow_id}/disable")
async def disable_workflow(repo_name: str, workflow_id: str):
    """禁用 Workflow"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, result = gh_put(f"/repos/{settings.github_user}/{repo_name}/actions/workflows/{workflow_id}/disable")
    if status == 204:
        return {"message": "Workflow 已禁用"}
    raise HTTPException(status_code=status, detail=f"禁用失败: {result}")


@router.get("/repos/{repo_name}/actions/runs/{run_id}/logs")
async def get_workflow_run_logs(repo_name: str, run_id: int):
    """获取运行日志（返回下载 URL）"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/actions/runs/{run_id}/logs")
    if status == 302:
        return {"download_url": data}
    elif status == 200:
        return {"download_url": "日志已下载"}
    raise HTTPException(status_code=status, detail=f"获取日志失败")


# ──────────────────────────────────────────────
# Secrets
# ──────────────────────────────────────────────

@router.get("/repos/{repo_name}/actions/secrets")
async def list_secrets(repo_name: str):
    """获取仓库 Secrets 列表"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/actions/secrets")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Secrets 失败: {data}")
    secrets = data.get("secrets", []) if isinstance(data, dict) else []
    return [{"name": s.get("name", ""), "created_at": s.get("created_at", ""), "updated_at": s.get("updated_at", "")} for s in secrets]


@router.get("/repos/{repo_name}/actions/secrets/public-key")
async def get_secret_public_key(repo_name: str):
    """获取仓库公钥（用于加密 Secret）"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/actions/secrets/public-key")
    if status == 200:
        return {"key_id": data.get("key_id", ""), "key": data.get("key", "")}
    raise HTTPException(status_code=status, detail=f"获取公钥失败: {data}")


@router.put("/repos/{repo_name}/actions/secrets/{secret_name}")
async def create_or_update_secret(repo_name: str, secret_name: str, request: Request):
    """创建或更新 Secret"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {"key_id": body.get("key_id", ""), "encrypted_value": body.get("encrypted_value", "")}
    status, result = gh_put(f"/repos/{settings.github_user}/{repo_name}/actions/secrets/{secret_name}", data=data)
    if status in (201, 204):
        return {"message": f"Secret '{secret_name}' 已保存"}
    raise HTTPException(status_code=status, detail=f"保存 Secret 失败: {result}")


@router.delete("/repos/{repo_name}/actions/secrets/{secret_name}")
async def delete_secret(repo_name: str, secret_name: str):
    """删除 Secret"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, result = gh_delete(f"/repos/{settings.github_user}/{repo_name}/actions/secrets/{secret_name}")
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"删除 Secret 失败: {result}")


# ──────────────────────────────────────────────
# Artifacts
# ──────────────────────────────────────────────

@router.get("/repos/{repo_name}/actions/artifacts")
async def list_artifacts(repo_name: str):
    """获取仓库 Artifacts 列表"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/actions/artifacts")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Artifacts 失败: {data}")
    artifacts = data.get("artifacts", []) if isinstance(data, dict) else []
    return [{"id": a.get("id"), "name": a.get("name", ""), "size_in_bytes": a.get("size_in_bytes", 0), "expired": a.get("expired", False), "created_at": a.get("created_at", ""), "archive_download_url": a.get("archive_download_url", "")} for a in artifacts]


@router.delete("/repos/{repo_name}/actions/artifacts/{artifact_id}")
async def delete_artifact(repo_name: str, artifact_id: int):
    """删除 Artifact"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, result = gh_delete(f"/repos/{settings.github_user}/{repo_name}/actions/artifacts/{artifact_id}")
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"删除 Artifact 失败: {result}")


# ──────────────────────────────────────────────
# Runners
# ──────────────────────────────────────────────

@router.get("/repos/{repo_name}/actions/runners")
async def list_runners(repo_name: str):
    """获取仓库 Runner 列表"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/actions/runners")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Runner 列表失败: {data}")
    return data


@router.get("/repos/{repo_name}/actions/runners/{runner_id}")
async def get_runner(repo_name: str, runner_id: int):
    """获取 Runner 详情"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/actions/runners/{runner_id}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Runner 详情失败: {data}")
    return data


@router.delete("/repos/{repo_name}/actions/runners/{runner_id}")
async def delete_runner(repo_name: str, runner_id: int):
    """删除 Runner"""
    status, data = gh_delete(f"/repos/{settings.github_user}/{repo_name}/actions/runners/{runner_id}")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"删除 Runner 失败: {data}")
    return {"message": f"已删除 Runner {runner_id}"}


@router.get("/repos/{repo_name}/actions/runners/downloads")
async def list_runner_downloads(repo_name: str):
    """获取 Runner 下载链接"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/actions/runners/downloads")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Runner 下载链接失败: {data}")
    return data if isinstance(data, list) else []


@router.post("/repos/{repo_name}/actions/runners/registration-token")
async def create_runner_token(repo_name: str):
    """创建 Runner 注册令牌"""
    status, data = gh_post(f"/repos/{settings.github_user}/{repo_name}/actions/runners/registration-token")
    if status != 201:
        raise HTTPException(status_code=status, detail=f"创建 Runner 令牌失败: {data}")
    return data
