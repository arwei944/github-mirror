"""
部署管理 API 路由
GitHub 仓库 → HF Space 部署、批量部署、历史、Space 状态
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/deploy", tags=["deploy"])


# ═══════════════════════════════════════════════════════════
#  请求模型
# ═══════════════════════════════════════════════════════════

class DeployRequest(BaseModel):
    github_user: str = ""
    hf_user: str = ""
    github_token: str = ""
    hf_token: str = ""
    proxy: str = ""
    repo_name: str = ""
    space_name: str = ""

class BatchDeployRequest(BaseModel):
    github_user: str = ""
    hf_user: str = ""
    github_token: str = ""
    hf_token: str = ""
    proxy: str = ""
    repos: List[dict] = []


# ═══════════════════════════════════════════════════════════
#  部署端点
# ═══════════════════════════════════════════════════════════

@router.post("")
async def deploy_single(req: DeployRequest):
    """部署单个仓库到 HF Space"""
    if not req.github_token or not req.hf_token:
        raise HTTPException(400, detail="请填写 GitHub Token 和 HF Token")
    if not req.repo_name:
        raise HTTPException(400, detail="请指定仓库名")

    space_name = req.space_name or req.repo_name

    from ..services.deploy_service import start_deploy_thread
    start_deploy_thread(req.model_dump(), req.repo_name, space_name)

    return {"status": "started", "repo": req.repo_name, "space": space_name}


@router.post("/batch")
async def deploy_batch(req: BatchDeployRequest):
    """批量部署多个仓库"""
    if not req.github_token or not req.hf_token:
        raise HTTPException(400, detail="请填写 Token")
    if not req.repos:
        raise HTTPException(400, detail="请选择要部署的仓库")

    from ..services.deploy_service import start_batch_deploy_thread
    start_batch_deploy_thread(req.model_dump(), req.repos)

    return {"status": "started", "total": len(req.repos)}


# ═══════════════════════════════════════════════════════════
#  状态查询
# ═══════════════════════════════════════════════════════════

@router.get("/status/{repo_name}")
async def get_deploy_status(repo_name: str):
    """获取指定仓库的部署状态"""
    from ..services.deploy_service import get_deploy_state
    state = get_deploy_state(repo_name)
    if not state:
        raise HTTPException(404, detail=f"仓库 {repo_name} 没有活跃的部署任务")
    return state


@router.get("/active")
async def get_active_deploys():
    """获取所有活跃的部署任务"""
    from ..services.deploy_service import get_all_active_deploys
    return get_all_active_deploys()


# ═══════════════════════════════════════════════════════════
#  历史记录
# ═══════════════════════════════════════════════════════════

@router.get("/history")
async def get_history(limit: int = 50):
    """获取部署历史"""
    from ..services.deploy_service import deploy_history
    return deploy_history.list(limit=limit)


@router.delete("/history")
async def clear_history():
    """清空部署历史"""
    from ..services.deploy_service import deploy_history
    deploy_history.clear()
    return {"status": "cleared"}


# ═══════════════════════════════════════════════════════════
#  Space 状态
# ═══════════════════════════════════════════════════════════

@router.get("/spaces")
async def get_spaces(hf_user: str = "", hf_token: str = "", proxy: str = ""):
    """获取已部署的 Space 状态列表"""
    from ..services.deploy_service import get_deployed_spaces
    return get_deployed_spaces(hf_token=hf_token, proxy=proxy)


@router.get("/spaces/{space_name}/status")
async def get_space_status(space_name: str, hf_user: str = "",
                            hf_token: str = "", proxy: str = ""):
    """检查指定 Space 的运行状态"""
    from ..services.deploy_service import check_space_status
    return check_space_status(hf_user, space_name, hf_token, proxy)
