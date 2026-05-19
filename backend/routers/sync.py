"""
仓库同步路由
git clone + SQLite 数据同步
"""
import json
import logging

from fastapi import APIRouter, HTTPException, Query, Request

from ..config import settings
from ..core.shared_state import (
    get_sync_db, sync_single_repo, sync_repo_data,
)

logger = logging.getLogger("github-mirror.routers.sync")

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("/repos")
async def sync_repos(request: Request):
    """批量同步仓库源代码到本地"""
    body = await request.json()
    repo_names = body.get("repos", [])
    if not repo_names:
        raise HTTPException(status_code=400, detail="请指定要同步的仓库列表")

    results = []
    for repo_name in repo_names:
        try:
            result = await sync_single_repo(repo_name)
            results.append(result)
        except Exception as e:
            results.append({"repo": repo_name, "status": "error", "error": str(e)})
    return {"results": results}


@router.post("/repos/{repo_name}")
async def sync_single(repo_name: str):
    """同步单个仓库源代码到本地"""
    return await sync_single_repo(repo_name)


@router.get("/status")
async def get_sync_status():
    """获取所有仓库的同步状态"""
    conn = get_sync_db()
    rows = conn.execute("SELECT * FROM sync_status ORDER BY last_sync DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/status/{repo_name}")
async def get_repo_sync_status(repo_name: str):
    """获取单个仓库的同步状态"""
    conn = get_sync_db()
    row = conn.execute("SELECT * FROM sync_status WHERE repo_name = ?", (repo_name,)).fetchone()
    conn.close()
    if not row:
        return {"repo_name": repo_name, "status": "not_synced"}
    return dict(row)


@router.post("/data/{repo_name}")
async def sync_data(repo_name: str):
    """同步仓库 API 数据到本地 SQLite"""
    return await sync_repo_data(repo_name)


@router.get("/data/{repo_name}")
async def get_synced_data(repo_name: str, data_type: str = Query("repo", pattern="^(repo|issues|prs|commits)$")):
    """从本地 SQLite 获取已同步的数据"""
    gh_user = settings.github_user
    full_name = f"{gh_user}/{repo_name}" if "/" not in repo_name else repo_name
    conn = get_sync_db()

    if data_type == "repo":
        row = conn.execute("SELECT * FROM repo_data WHERE repo_name = ?", (full_name,)).fetchone()
        conn.close()
        return json.loads(row["data_json"]) if row else {"error": "未找到数据"}

    table_map = {"issues": "issues_data", "prs": "prs_data", "commits": "commits_data"}
    table = table_map.get(data_type)
    if not table:
        conn.close()
        return {"error": f"未知数据类型: {data_type}"}

    rows = conn.execute(f"SELECT * FROM {table} WHERE repo_name = ? ORDER BY updated_at DESC", (full_name,)).fetchall()
    conn.close()
    return [json.loads(r["data_json"]) for r in rows]
