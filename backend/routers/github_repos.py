"""
GitHub Repos 路由
仓库 CRUD / star / fork / contents / branches / tags / releases /
hooks / labels / milestones / discussions / environments / pages /
packages / deployments / git data / stats / dependabot / code-scanning / reactions
"""
import asyncio
import base64
import concurrent.futures
import logging
import os
import urllib.parse
from datetime import datetime, timedelta

from fastapi import APIRouter, Query, Request, HTTPException
from fastapi.responses import JSONResponse

from ..config import settings
from ..routers.github_proxy import gh_get, gh_post, gh_put, gh_delete, gh_patch, gh_request

logger = logging.getLogger("github-mirror.routers.github_repos")
router = APIRouter(prefix="/api/github", tags=["github-repos"])


# ═══════════════════════════════════════════════════════════
#  辅助函数
# ═══════════════════════════════════════════════════════════

REPO_FIELDS = [
    "name", "full_name", "description", "language", "visibility",
    "default_branch", "updated_at", "html_url", "topics",
    "stargazers_count", "forks_count", "open_issues_count", "size",
    "license", "created_at", "pushed_at", "archived", "homepage",
    "watchers_count",
]


def filter_repo_fields(repo: dict) -> dict:
    """只保留需要的仓库字段"""
    filtered = {}
    for key in REPO_FIELDS:
        if key in repo:
            filtered[key] = repo[key]
    return filtered


# ═══════════════════════════════════════════════════════════
#  GitHub Repos API
# ═══════════════════════════════════════════════════════════

@router.get("/repos")
async def list_github_repos(
    sort: str = Query("updated", description="排序字段: updated, stars, name, size, created, pushed"),
    direction: str = Query("desc", description="排序方向: asc, desc"),
    q: str = Query("", description="搜索关键词（按名称/描述过滤）"),
    type: str = Query("all", description="仓库类型: all, public, private, archived"),
):
    """
    获取 GitHub 仓库列表
    """
    if not settings.github_token:
        logger.warning("未配置 GITHUB_TOKEN，返回空仓库列表")
        return []

    # 构建查询参数
    params = {
        "sort": sort if sort != "stars" else "updated",
        "direction": direction,
        "per_page": 100,
        "type": type,
    }
    query_string = urllib.parse.urlencode(params)
    path = f"/user/repos?{query_string}"

    status, data = gh_get(path)
    if status != 200:
        logger.warning(f"获取仓库列表失败: {status} - {data}")
        return []

    if not isinstance(data, list):
        raise HTTPException(status_code=500, detail="GitHub API 返回数据格式异常")

    # 过滤字段
    repos = [filter_repo_fields(repo) for repo in data]

    # 按类型过滤
    if type == "public":
        repos = [r for r in repos if r.get("visibility") == "public"]
    elif type == "private":
        repos = [r for r in repos if r.get("visibility") == "private"]
    elif type == "archived":
        repos = [r for r in repos if r.get("archived") is True]

    # 按关键词搜索
    if q:
        q_lower = q.lower()
        repos = [
            r for r in repos
            if q_lower in (r.get("name") or "").lower()
            or q_lower in (r.get("description") or "").lower()
        ]

    # 本地排序
    if sort == "stars":
        repos.sort(key=lambda r: r.get("stargazers_count", 0), reverse=(direction == "desc"))
    elif sort == "name":
        repos.sort(key=lambda r: (r.get("name") or "").lower(), reverse=(direction == "desc"))
    elif sort == "size":
        repos.sort(key=lambda r: r.get("size", 0), reverse=(direction == "desc"))
    elif sort == "created":
        repos.sort(key=lambda r: r.get("created_at", ""), reverse=(direction == "desc"))
    elif sort == "pushed":
        repos.sort(key=lambda r: r.get("pushed_at", ""), reverse=(direction == "desc"))
    elif sort == "updated":
        repos.sort(key=lambda r: r.get("updated_at", ""), reverse=(direction == "desc"))

    return repos


@router.get("/repos/{repo_name}/detail")
async def get_repo_detail(repo_name: str):
    """
    获取仓库详情（聚合：基本信息、README、提交、分支、贡献者、语言）
    """
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")

    # 并行获取各项数据
    full_repo = repo_name if "/" in repo_name else f"{settings.github_user}/{repo_name}"
    repo_path = f"/repos/{full_repo}"
    readme_path = f"/repos/{full_repo}/readme"
    commits_path = f"/repos/{full_repo}/commits?per_page=15"
    branches_path = f"/repos/{full_repo}/branches"
    contributors_path = f"/repos/{full_repo}/contributors?per_page=10"
    languages_path = f"/repos/{full_repo}/languages"

    status, repo_data = gh_get(repo_path)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取仓库信息失败: {repo_data}")

    # README（请求 HTML 格式）
    readme_status, readme_data = gh_get(
        readme_path, accept="application/vnd.github.v3.html"
    )
    readme_html = ""
    if readme_status == 200:
        if isinstance(readme_data, bytes):
            readme_html = readme_data.decode("utf-8", errors="replace")
        elif isinstance(readme_data, str):
            readme_html = readme_data

    # 提交记录
    commits_status, commits_data = gh_get(commits_path)
    commits = []
    if commits_status == 200 and isinstance(commits_data, list):
        for c in commits_data:
            commits.append({
                "sha": c.get("sha", ""),
                "message": c.get("commit", {}).get("message", ""),
                "author": c.get("commit", {}).get("author", {}).get("name", ""),
                "date": c.get("commit", {}).get("author", {}).get("date", ""),
                "avatar_url": c.get("author", {}).get("avatar_url", "") if c.get("author") else "",
            })

    # 分支列表
    branches_status, branches_data = gh_get(branches_path)
    branches = []
    if branches_status == 200 and isinstance(branches_data, list):
        branches = [b.get("name", "") for b in branches_data]

    # 贡献者
    contributors_status, contributors_data = gh_get(contributors_path)
    contributors = []
    if contributors_status == 200 and isinstance(contributors_data, list):
        for c in contributors_data:
            contributors.append({
                "login": c.get("login", ""),
                "avatar_url": c.get("avatar_url", ""),
                "contributions": c.get("contributions", 0),
                "html_url": c.get("html_url", ""),
            })

    # 语言统计
    languages_status, languages_data = gh_get(languages_path)
    languages = {}
    if languages_status == 200 and isinstance(languages_data, dict):
        languages = languages_data

    return {
        "repo": repo_data,
        "readme_html": readme_html,
        "commits": commits,
        "branches": branches,
        "contributors": contributors,
        "languages": languages,
    }


@router.put("/repos/{repo_name}/star")
async def star_repo(repo_name: str):
    """
    Star 一个仓库
    """
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")

    status, data = gh_put(f"/user/starred/{settings.github_user}/{repo_name}")
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"Star 操作失败: {data}")


@router.delete("/repos/{repo_name}/star")
async def unstar_repo(repo_name: str):
    """
    取消 Star 一个仓库
    """
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")

    status, data = gh_delete(f"/user/starred/{settings.github_user}/{repo_name}")
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"取消 Star 操作失败: {data}")


@router.get("/repos/{repo_name}/star/status")
async def check_star_status(repo_name: str):
    """
    检查仓库是否已 Star
    """
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")

    status, data = gh_get(f"/user/starred/{settings.github_user}/{repo_name}")
    if status == 204:
        return {"starred": True}
    elif status == 404:
        return {"starred": False}
    raise HTTPException(status_code=status, detail=f"检查 Star 状态失败: {data}")


@router.post("/repos/{repo_name}/forks")
async def fork_repo(repo_name: str):
    """
    Fork 一个仓库
    """
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")

    status, data = gh_post(f"/repos/{settings.github_user}/{repo_name}/forks")
    if status == 202:
        return data
    raise HTTPException(status_code=status, detail=f"Fork 操作失败: {data}")


@router.post("/repos/{repo_name}/sync")
async def sync_repo_files(repo_name: str):
    """同步仓库文件到本地"""
    if not settings.github_token:
        raise HTTPException(status_code=401, detail="未配置 GITHUB_TOKEN")

    full_name = f"{settings.github_user}/{repo_name}" if "/" not in repo_name else repo_name

    # 获取仓库文件树
    status, tree_data = gh_get(f"/repos/{full_name}/git/trees/main?recursive=1")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取文件树失败: {tree_data}")

    tree = tree_data.get("tree", [])
    files = [item for item in tree if item["type"] == "blob"]

    # 保存到本地
    sync_dir = os.path.join(settings.data_dir, "sync", full_name)
    os.makedirs(sync_dir, exist_ok=True)

    synced = []
    for file_info in files[:500]:  # 限制最多同步 500 个文件
        file_path = file_info["path"]
        local_path = os.path.join(sync_dir, file_path)

        # 获取文件内容
        f_status, f_data = gh_get(f"/repos/{full_name}/contents/{file_path}")
        if f_status == 200 and f_data.get("content"):
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            content = base64.b64decode(f_data["content"])
            with open(local_path, "wb") as f:
                f.write(content)
            synced.append(file_path)

    return {
        "status": "ok",
        "repo": full_name,
        "total_files": len(files),
        "synced_files": len(synced),
        "sync_dir": sync_dir,
    }


# ═══════════════════════════════════════════════════════════
#  GitHub Repository CRUD API
# ═══════════════════════════════════════════════════════════

@router.post("/repos")
async def create_repository(request: Request):
    """创建新仓库"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {
        "name": body.get("name", ""),
        "description": body.get("description", ""),
        "homepage": body.get("homepage", ""),
        "private": body.get("private", False),
        "auto_init": body.get("auto_init", False),
        "has_issues": body.get("has_issues", True),
        "has_projects": body.get("has_projects", True),
        "has_wiki": body.get("has_wiki", True),
    }
    if body.get("gitignore_template"):
        data["gitignore_template"] = body["gitignore_template"]
    if body.get("license_template"):
        data["license_template"] = body["license_template"]
    status, result = gh_post("/user/repos", data=data)
    if status == 201:
        return filter_repo_fields(result)
    raise HTTPException(status_code=status, detail=f"创建仓库失败: {result}")


@router.delete("/repos/{repo_name}")
async def delete_repository(repo_name: str):
    """删除仓库"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_delete(f"/repos/{settings.github_user}/{repo_name}")
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"删除仓库失败: {data}")


@router.patch("/repos/{repo_name}/settings")
async def update_repository_settings(repo_name: str, request: Request):
    """更新仓库设置"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {}
    for key in ["name", "description", "homepage", "private", "visibility", "default_branch",
                 "has_issues", "has_projects", "has_wiki", "is_template", "archived",
                 "allow_squash_merge", "allow_merge_commit", "allow_rebase_merge", "delete_branch_on_merge"]:
        if key in body:
            data[key] = body[key]
    status, result = gh_request(f"/repos/{settings.github_user}/{repo_name}", method="PATCH", data=data)
    if status == 200:
        return filter_repo_fields(result)
    raise HTTPException(status_code=status, detail=f"更新仓库设置失败: {result}")


@router.put("/repos/{repo_name}/topics")
async def update_repository_topics(repo_name: str, request: Request):
    """更新仓库 Topics"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    status, result = gh_put(
        f"/repos/{settings.github_user}/{repo_name}/topics",
        data={"names": body.get("names", [])},
        headers={"Accept": "application/vnd.github+json"}
    )
    if status == 200:
        return result
    raise HTTPException(status_code=status, detail=f"更新 Topics 失败: {result}")


# ═══════════════════════════════════════════════════════════
#  GitHub Branches API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/branches")
async def list_branches(repo_name: str):
    """获取仓库分支列表"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/branches?per_page=100")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取分支失败: {data}")
    if not isinstance(data, list):
        return []
    # Get default branch from repo info
    _, repo_data = gh_get(f"/repos/{settings.github_user}/{repo_name}")
    default_branch = repo_data.get("default_branch", "main") if isinstance(repo_data, dict) else "main"
    return [{"name": b.get("name", ""), "default": b.get("name", "") == default_branch} for b in data]


@router.post("/repos/{repo_name}/branches")
async def create_branch(repo_name: str, request: Request):
    """创建分支"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    branch_name = body.get("name", "")
    from_sha = body.get("from", "main")
    # Get the SHA of the source ref
    _, ref_data = gh_get(f"/repos/{settings.github_user}/{repo_name}/git/ref/heads/{from_sha}")
    if not isinstance(ref_data, dict) or "object" not in ref_data:
        raise HTTPException(status_code=404, detail=f"源分支 '{from_sha}' 不存在")
    sha = ref_data["object"]["sha"]
    status, result = gh_post(f"/repos/{settings.github_user}/{repo_name}/git/refs", data={"ref": f"refs/heads/{branch_name}", "sha": sha})
    if status == 201:
        return {"name": branch_name, "sha": sha}
    raise HTTPException(status_code=status, detail=f"创建分支失败: {result}")


@router.delete("/repos/{repo_name}/branches/{branch_name}")
async def delete_branch(repo_name: str, branch_name: str):
    """删除分支"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, result = gh_delete(f"/repos/{settings.github_user}/{repo_name}/git/refs/heads/{branch_name}")
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"删除分支失败: {result}")


@router.post("/repos/{repo_name}/branches/{branch_name}/rename")
async def rename_branch(repo_name: str, branch_name: str, request: Request):
    """重命名分支"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    status, result = gh_post(f"/repos/{settings.github_user}/{repo_name}/branches/{branch_name}/rename", data={"new_name": body.get("new_name", "")})
    if status == 200:
        return result
    raise HTTPException(status_code=status, detail=f"重命名分支失败: {result}")


# ═══════════════════════════════════════════════════════════
#  GitHub Branch Protection API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/branches/{branch}/protection")
async def get_branch_protection(repo_name: str, branch: str):
    """获取分支保护规则"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/branches/{branch}/protection")
    if status == 404:
        return {"enabled": False}
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取分支保护失败: {data}")
    return data


@router.put("/repos/{repo_name}/branches/{branch}/protection")
async def update_branch_protection(repo_name: str, branch: str, request: Request):
    """更新分支保护规则"""
    body = await request.json()
    status, data = gh_put(f"/repos/{settings.github_user}/{repo_name}/branches/{branch}/protection", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"更新分支保护失败: {data}")
    return data


@router.delete("/repos/{repo_name}/branches/{branch}/protection")
async def delete_branch_protection(repo_name: str, branch: str):
    """删除分支保护规则"""
    status, data = gh_delete(f"/repos/{settings.github_user}/{repo_name}/branches/{branch}/protection")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"删除分支保护失败: {data}")
    return {"message": f"已删除 {branch} 分支保护规则"}


# ═══════════════════════════════════════════════════════════
#  GitHub File Read/Write API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/contents")
@router.get("/repos/{repo_name}/contents/")
@router.get("/repos/{repo_name}/contents/{path:path}")
async def get_repo_contents(repo_name: str, path: str = "", ref: str = Query("", description="分支名或 SHA")):
    """获取仓库文件/目录内容"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    qs = f"?ref={ref}" if ref else ""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/contents/{path}{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取内容失败: {data}")
    if isinstance(data, list):
        # Directory listing
        return [{"name": item.get("name", ""), "path": item.get("path", ""), "type": item.get("type", "file"), "size": item.get("size", 0), "download_url": item.get("download_url", "")} for item in data]
    elif isinstance(data, dict):
        # Single file
        content = data.get("content", "")
        if content and data.get("encoding") == "base64":
            try:
                content = base64.b64decode(content).decode("utf-8", errors="replace")
            except Exception:
                pass
        return {"name": data.get("name", ""), "path": data.get("path", ""), "type": "file", "size": data.get("size", 0), "content": content, "encoding": data.get("encoding", ""), "download_url": data.get("download_url", "")}
    return data


@router.put("/repos/{repo_name}/contents/{path:path}")
async def create_or_update_file(repo_name: str, path: str, request: Request):
    """创建或更新文件"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    content = body.get("content", "")
    encoded = base64.b64encode(content.encode("utf-8")).decode("utf-8")
    data = {
        "message": body.get("message", f"Update {path}"),
        "content": encoded,
    }
    if body.get("sha"):
        data["sha"] = body["sha"]
    if body.get("branch"):
        data["branch"] = body["branch"]
    if body.get("committer"):
        data["committer"] = body["committer"]
    status, result = gh_put(f"/repos/{settings.github_user}/{repo_name}/contents/{path}", data=data)
    if status in (200, 201):
        return result
    raise HTTPException(status_code=status, detail=f"文件操作失败: {result}")


@router.delete("/repos/{repo_name}/contents/{path:path}")
async def delete_file(repo_name: str, path: str, request: Request):
    """删除文件"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {
        "message": body.get("message", f"Delete {path}"),
        "sha": body.get("sha", ""),
    }
    if body.get("branch"):
        data["branch"] = body["branch"]
    status, result = gh_delete(f"/repos/{settings.github_user}/{repo_name}/contents/{path}", data=data)
    if status == 200:
        return result
    raise HTTPException(status_code=status, detail=f"删除文件失败: {result}")


# ═══════════════════════════════════════════════════════════
#  GitHub Commits API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/commits")
async def list_commits(repo_name: str, sha: str = Query("", description="分支名或 SHA"), page: int = Query(1, ge=1), per_page: int = Query(30, ge=1, le=100)):
    """获取仓库提交历史"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    qs = urllib.parse.urlencode({"page": page, "per_page": per_page})
    ref = sha if sha else "main"
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/commits?sha={ref}&{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取提交历史失败: {data}")
    if not isinstance(data, list):
        return []
    # 批量获取前 15 个 commit 的 stats（GitHub 列表 API 不返回 stats）
    def fetch_stats(c):
        s, d = gh_get(f"/repos/{settings.github_user}/{repo_name}/commits/{c.get('sha', '')}")
        if s == 200 and isinstance(d, dict):
            return c.get("sha", ""), d.get("stats", {})
        return c.get("sha", ""), {}

    stats_map = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_stats, c): c for c in data[:15]}
        for f in concurrent.futures.as_completed(futures):
            try:
                sha_val, st = f.result()
                if st:
                    stats_map[sha_val] = st
            except Exception:
                pass

    return [{"sha": c.get("sha", "")[:7], "sha_full": c.get("sha", ""), "message": c.get("commit", {}).get("message", "").split("\n")[0], "author": {"name": c.get("commit", {}).get("author", {}).get("name", ""), "date": c.get("commit", {}).get("author", {}).get("date", ""), "avatar_url": c.get("author", {}).get("avatar_url", "")} if c.get("author") else {}, "stats": stats_map.get(c.get("sha", ""), {}), "html_url": c.get("html_url", "")} for c in data]


@router.get("/repos/{repo_name}/commits/{ref}")
async def get_commit_detail(repo_name: str, ref: str):
    """获取提交详情"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/commits/{ref}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取提交详情失败: {data}")
    return {"sha": data.get("sha", ""), "message": data.get("commit", {}).get("message", ""), "author": {"name": data.get("commit", {}).get("author", {}).get("name", ""), "date": data.get("commit", {}).get("author", {}).get("date", "")}, "stats": {"additions": data.get("stats", {}).get("additions", 0), "deletions": data.get("stats", {}).get("deletions", 0), "total": data.get("stats", {}).get("total", 0)}, "files": [{"filename": f.get("filename", ""), "status": f.get("status", ""), "additions": f.get("additions", 0), "deletions": f.get("deletions", 0), "patch": f.get("patch", "")} for f in (data.get("files") or [])], "html_url": data.get("html_url", "")}


@router.get("/repos/{repo_name}/commits/{ref}/status")
async def get_commit_status(repo_name: str, ref: str):
    """获取提交的 CI 状态"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/commits/{ref}/status")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取提交状态失败: {data}")
    return data


# ═══════════════════════════════════════════════════════════
#  GitHub Issues API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/issues")
async def list_issues(
    repo_name: str,
    state: str = Query("open", description="Issue 状态: open, closed, all"),
    sort: str = Query("created", description="排序: created, updated, comments"),
    direction: str = Query("desc", description="排序方向: asc, desc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    labels: str = Query("", description="逗号分隔的标签名"),
):
    """获取仓库 Issue 列表"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    params = {"state": state, "sort": sort, "direction": direction, "page": page, "per_page": per_page}
    if labels:
        params["labels"] = labels
    qs = urllib.parse.urlencode(params)
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/issues?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Issue 列表失败: {data}")
    if not isinstance(data, list):
        raise HTTPException(status_code=500, detail="数据格式异常")
    issues = []
    for i in data:
        # Skip pull requests (GitHub returns PRs in issues API)
        if "pull_request" in i:
            continue
        issues.append({
            "id": i.get("id"),
            "number": i.get("number"),
            "title": i.get("title", ""),
            "body": i.get("body", "") or "",
            "state": i.get("state", "open"),
            "user": {"login": i.get("user", {}).get("login", ""), "avatar_url": i.get("user", {}).get("avatar_url", "")} if i.get("user") else {},
            "labels": [{"name": l.get("name", ""), "color": l.get("color", "")} for l in (i.get("labels") or [])],
            "assignees": [{"login": a.get("login", "")} for a in (i.get("assignees") or [])],
            "milestone": {"number": i.get("milestone", {}).get("number"), "title": i.get("milestone", {}).get("title", "")} if i.get("milestone") else None,
            "comments": i.get("comments", 0),
            "created_at": i.get("created_at", ""),
            "updated_at": i.get("updated_at", ""),
            "html_url": i.get("html_url", ""),
        })
    return issues


@router.get("/repos/{repo_name}/issues/{issue_number}")
async def get_issue(repo_name: str, issue_number: int):
    """获取 Issue 详情（含评论）"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/issues/{issue_number}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Issue 详情失败: {data}")
    # Get comments
    _, comments = gh_get(f"/repos/{settings.github_user}/{repo_name}/issues/{issue_number}/comments?per_page=100")
    comment_list = []
    if isinstance(comments, list):
        for c in comments:
            comment_list.append({
                "id": c.get("id"),
                "body": c.get("body", "") or "",
                "user": {"login": c.get("user", {}).get("login", ""), "avatar_url": c.get("user", {}).get("avatar_url", "")} if c.get("user") else {},
                "created_at": c.get("created_at", ""),
                "updated_at": c.get("updated_at", ""),
            })
    return {
        "id": data.get("id"),
        "number": data.get("number"),
        "title": data.get("title", ""),
        "body": data.get("body", "") or "",
        "state": data.get("state", "open"),
        "user": {"login": data.get("user", {}).get("login", ""), "avatar_url": data.get("user", {}).get("avatar_url", "")} if data.get("user") else {},
        "labels": [{"name": l.get("name", ""), "color": l.get("color", "")} for l in (data.get("labels") or [])],
        "assignees": [{"login": a.get("login", "")} for a in (data.get("assignees") or [])],
        "milestone": {"number": data.get("milestone", {}).get("number"), "title": data.get("milestone", {}).get("title", "")} if data.get("milestone") else None,
        "comments": data.get("comments", 0),
        "created_at": data.get("created_at", ""),
        "updated_at": data.get("updated_at", ""),
        "html_url": data.get("html_url", ""),
        "comment_list": comment_list,
    }


@router.post("/repos/{repo_name}/issues")
async def create_issue(repo_name: str, request: Request):
    """创建 Issue"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {
        "title": body.get("title", ""),
        "body": body.get("body", ""),
    }
    if body.get("labels"):
        data["labels"] = body["labels"]
    if body.get("assignees"):
        data["assignees"] = body["assignees"]
    if body.get("milestone"):
        data["milestone"] = body["milestone"]
    status, result = gh_post(f"/repos/{settings.github_user}/{repo_name}/issues", data=data)
    if status == 201:
        return result
    raise HTTPException(status_code=status, detail=f"创建 Issue 失败: {result}")


@router.patch("/repos/{repo_name}/issues/{issue_number}")
async def update_issue(repo_name: str, issue_number: int, request: Request):
    """更新 Issue（标题、正文、状态、标签等）"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {}
    if "title" in body:
        data["title"] = body["title"]
    if "body" in body:
        data["body"] = body["body"]
    if "state" in body:
        data["state"] = body["state"]
    if "labels" in body:
        data["labels"] = body["labels"]
    if "assignees" in body:
        data["assignees"] = body["assignees"]
    if "milestone" in body:
        data["milestone"] = body["milestone"]
    status, result = gh_request(f"/repos/{settings.github_user}/{repo_name}/issues/{issue_number}", method="PATCH", data=data)
    if status == 200:
        return result
    raise HTTPException(status_code=status, detail=f"更新 Issue 失败: {result}")


@router.put("/repos/{repo_name}/issues/{issue_number}/lock")
async def lock_issue(repo_name: str, issue_number: int, request: Request):
    """锁定 Issue"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {"lock_reason": body.get("lock_reason", "resolved")}
    status, result = gh_put(f"/repos/{settings.github_user}/{repo_name}/issues/{issue_number}/lock", data=data)
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"锁定失败: {result}")


@router.delete("/repos/{repo_name}/issues/{issue_number}/lock")
async def unlock_issue(repo_name: str, issue_number: int):
    """解锁 Issue"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, result = gh_delete(f"/repos/{settings.github_user}/{repo_name}/issues/{issue_number}/lock")
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"解锁失败: {result}")


@router.post("/repos/{repo_name}/issues/{issue_number}/comments")
async def create_issue_comment(repo_name: str, issue_number: int, request: Request):
    """评论 Issue"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    status, result = gh_post(
        f"/repos/{settings.github_user}/{repo_name}/issues/{issue_number}/comments",
        data={"body": body.get("body", "")}
    )
    if status == 201:
        return result
    raise HTTPException(status_code=status, detail=f"评论失败: {result}")


@router.patch("/repos/{repo_name}/issues/comments/{comment_id}")
async def update_issue_comment(repo_name: str, comment_id: int, request: Request):
    """更新 Issue 评论"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    status, result = gh_request(f"/repos/{settings.github_user}/{repo_name}/issues/comments/{comment_id}", method="PATCH", data={"body": body.get("body", "")})
    if status == 200:
        return result
    raise HTTPException(status_code=status, detail=f"更新评论失败: {result}")


@router.delete("/repos/{repo_name}/issues/comments/{comment_id}")
async def delete_issue_comment(repo_name: str, comment_id: int):
    """删除 Issue 评论"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, result = gh_delete(f"/repos/{settings.github_user}/{repo_name}/issues/comments/{comment_id}")
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"删除评论失败: {result}")


@router.get("/repos/{repo_name}/issues/{issue_number}/timeline")
async def get_issue_timeline(repo_name: str, issue_number: int):
    """获取 Issue 时间线事件"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/issues/{issue_number}/timeline?per_page=100", headers={"Accept": "application/vnd.github.mockingbird-preview+json"})
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取时间线失败: {data}")
    if not isinstance(data, list):
        return []
    events = []
    for e in data:
        events.append({
            "event": e.get("event", ""),
            "actor": e.get("actor", {}).get("login", "") if e.get("actor") else "",
            "created_at": e.get("created_at", ""),
            "commit_id": e.get("commit_id", ""),
            "commit_url": e.get("commit_url", ""),
            "label": {"name": e.get("label", {}).get("name", ""), "color": e.get("label", {}).get("color", "")} if e.get("label") else None,
            "assignee": e.get("assignee", {}).get("login", "") if e.get("assignee") else None,
            "milestone": {"title": e.get("milestone", {}).get("title", "")} if e.get("milestone") else None,
            "source": {"issue": {"number": e.get("source", {}).get("issue", {}).get("number")}} if e.get("source") else None,
            "body": e.get("body", ""),
        })
    return events


# ═══════════════════════════════════════════════════════════
#  GitHub Labels API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/labels")
async def list_labels(repo_name: str):
    """获取仓库标签列表"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/labels?per_page=100")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取标签失败: {data}")
    if not isinstance(data, list):
        return []
    return [{"id": l.get("id"), "name": l.get("name", ""), "color": l.get("color", ""), "description": l.get("description", "")} for l in data]


@router.post("/repos/{repo_name}/labels")
async def create_label(repo_name: str, request: Request):
    """创建标签"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    status, result = gh_post(
        f"/repos/{settings.github_user}/{repo_name}/labels",
        data={"name": body.get("name", ""), "color": body.get("color", ""), "description": body.get("description", "")}
    )
    if status == 201:
        return result
    raise HTTPException(status_code=status, detail=f"创建标签失败: {result}")


@router.patch("/repos/{repo_name}/labels/{label_name}")
async def update_label(repo_name: str, label_name: str, request: Request):
    """更新标签"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {}
    if "new_name" in body:
        data["new_name"] = body["new_name"]
    if "color" in body:
        data["color"] = body["color"]
    if "description" in body:
        data["description"] = body["description"]
    status, result = gh_request(f"/repos/{settings.github_user}/{repo_name}/labels/{label_name}", method="PATCH", data=data)
    if status == 200:
        return result
    raise HTTPException(status_code=status, detail=f"更新标签失败: {result}")


@router.delete("/repos/{repo_name}/labels/{label_name}")
async def delete_label(repo_name: str, label_name: str):
    """删除标签"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, result = gh_delete(f"/repos/{settings.github_user}/{repo_name}/labels/{label_name}")
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"删除标签失败: {result}")


# ═══════════════════════════════════════════════════════════
#  GitHub Milestones API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/milestones")
async def list_milestones(repo_name: str, state: str = Query("all", description="状态: open, closed, all")):
    """获取仓库里程碑列表"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/milestones?state={state}&per_page=100")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取里程碑失败: {data}")
    if not isinstance(data, list):
        return []
    return [{"id": m.get("id"), "number": m.get("number"), "title": m.get("title", ""), "description": m.get("description", ""), "state": m.get("state", "open"), "open_issues": m.get("open_issues", 0), "closed_issues": m.get("closed_issues", 0), "created_at": m.get("created_at", "")} for m in data]


@router.post("/repos/{repo_name}/milestones")
async def create_milestone(repo_name: str, request: Request):
    """创建里程碑"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    status, result = gh_post(
        f"/repos/{settings.github_user}/{repo_name}/milestones",
        data={"title": body.get("title", ""), "description": body.get("description", ""), "state": body.get("state", "open")}
    )
    if status == 201:
        return result
    raise HTTPException(status_code=status, detail=f"创建里程碑失败: {result}")


@router.patch("/repos/{repo_name}/milestones/{milestone_number}")
async def update_milestone(repo_name: str, milestone_number: int, request: Request):
    """更新里程碑"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {}
    for key in ["title", "description", "state", "due_on"]:
        if key in body:
            data[key] = body[key]
    status, result = gh_request(f"/repos/{settings.github_user}/{repo_name}/milestones/{milestone_number}", method="PATCH", data=data)
    if status == 200:
        return result
    raise HTTPException(status_code=status, detail=f"更新里程碑失败: {result}")


@router.delete("/repos/{repo_name}/milestones/{milestone_number}")
async def delete_milestone(repo_name: str, milestone_number: int):
    """删除里程碑"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, result = gh_delete(f"/repos/{settings.github_user}/{repo_name}/milestones/{milestone_number}")
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"删除里程碑失败: {result}")


# ═══════════════════════════════════════════════════════════
#  GitHub Pull Requests API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/pulls")
async def list_pull_requests(
    repo_name: str,
    state: str = Query("open", description="PR 状态: open, closed, all"),
    sort: str = Query("created", description="排序: created, updated, popularity"),
    direction: str = Query("desc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
):
    """获取 PR 列表"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    qs = urllib.parse.urlencode({"state": state, "sort": sort, "direction": direction, "page": page, "per_page": per_page})
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/pulls?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 PR 列表失败: {data}")
    if not isinstance(data, list):
        return []
    prs = []
    for p in data:
        prs.append({
            "id": p.get("id"),
            "number": p.get("number"),
            "title": p.get("title", ""),
            "body": p.get("body", "") or "",
            "state": p.get("state", "open"),
            "user": {"login": p.get("user", {}).get("login", ""), "avatar_url": p.get("user", {}).get("avatar_url", "")} if p.get("user") else {},
            "head": {"ref": p.get("head", {}).get("ref", ""), "label": p.get("head", {}).get("label", "")},
            "base": {"ref": p.get("base", {}).get("ref", ""), "label": p.get("base", {}).get("label", "")},
            "merged": p.get("merged", False),
            "mergeable": p.get("mergeable"),
            "draft": p.get("draft", False),
            "comments": p.get("comments", 0),
            "review_comments": p.get("review_comments", 0),
            "additions": p.get("additions", 0),
            "deletions": p.get("deletions", 0),
            "changed_files": p.get("changed_files", 0),
            "created_at": p.get("created_at", ""),
            "updated_at": p.get("updated_at", ""),
            "html_url": p.get("html_url", ""),
        })
    return prs


@router.get("/repos/{repo_name}/pulls/{pr_number}")
async def get_pull_request(repo_name: str, pr_number: int):
    """获取 PR 详情（含评论和审查）"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/pulls/{pr_number}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 PR 详情失败: {data}")
    # Get comments
    _, comments = gh_get(f"/repos/{settings.github_user}/{repo_name}/issues/{pr_number}/comments?per_page=100")
    comment_list = []
    if isinstance(comments, list):
        for c in comments:
            comment_list.append({
                "id": c.get("id"), "body": c.get("body", "") or "",
                "user": {"login": c.get("user", {}).get("login", ""), "avatar_url": c.get("user", {}).get("avatar_url", "")} if c.get("user") else {},
                "created_at": c.get("created_at", ""),
            })
    # Get reviews
    _, reviews = gh_get(f"/repos/{settings.github_user}/{repo_name}/pulls/{pr_number}/reviews?per_page=100")
    review_list = []
    if isinstance(reviews, list):
        for r in reviews:
            review_list.append({
                "id": r.get("id"), "state": r.get("state", ""),
                "body": r.get("body", "") or "",
                "user": {"login": r.get("user", {}).get("login", ""), "avatar_url": r.get("user", {}).get("avatar_url", "")} if r.get("user") else {},
                "submitted_at": r.get("submitted_at", ""),
            })
    return {
        "id": data.get("id"), "number": data.get("number"),
        "title": data.get("title", ""), "body": data.get("body", "") or "",
        "state": data.get("state", "open"),
        "user": {"login": data.get("user", {}).get("login", ""), "avatar_url": data.get("user", {}).get("avatar_url", "")} if data.get("user") else {},
        "head": {"ref": data.get("head", {}).get("ref", ""), "label": data.get("head", {}).get("label", "")},
        "base": {"ref": data.get("base", {}).get("ref", ""), "label": data.get("base", {}).get("label", "")},
        "merged": data.get("merged", False), "mergeable": data.get("mergeable"),
        "draft": data.get("draft", False),
        "additions": data.get("additions", 0), "deletions": data.get("deletions", 0),
        "changed_files": data.get("changed_files", 0),
        "created_at": data.get("created_at", ""), "updated_at": data.get("updated_at", ""),
        "html_url": data.get("html_url", ""),
        "comment_list": comment_list, "review_list": review_list,
    }


@router.get("/repos/{repo_name}/pulls/{pr_number}/files")
async def get_pull_request_files(repo_name: str, pr_number: int):
    """获取 PR 变更文件列表"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/pulls/{pr_number}/files?per_page=100")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 PR 文件失败: {data}")
    if not isinstance(data, list):
        return []
    return [{"filename": f.get("filename", ""), "status": f.get("status", ""), "additions": f.get("additions", 0), "deletions": f.get("deletions", 0), "changes": f.get("changes", 0), "patch": f.get("patch", "")} for f in data]


@router.post("/repos/{repo_name}/pulls")
async def create_pull_request(repo_name: str, request: Request):
    """创建 PR"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {"title": body.get("title", ""), "head": body.get("head", ""), "base": body.get("base", "main"), "body": body.get("body", "")}
    status, result = gh_post(f"/repos/{settings.github_user}/{repo_name}/pulls", data=data)
    if status == 201:
        return result
    raise HTTPException(status_code=status, detail=f"创建 PR 失败: {result}")


@router.patch("/repos/{repo_name}/pulls/{pull_number}")
async def update_pull_request(repo_name: str, pull_number: int, request: Request):
    """更新 PR（标题、正文、状态）"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {}
    for key in ["title", "body", "state", "base"]:
        if key in body:
            data[key] = body[key]
    status, result = gh_request(f"/repos/{settings.github_user}/{repo_name}/pulls/{pull_number}", method="PATCH", data=data)
    if status == 200:
        return result
    raise HTTPException(status_code=status, detail=f"更新 PR 失败: {result}")


@router.post("/repos/{repo_name}/pulls/{pr_number}/reviews")
async def create_review(repo_name: str, pr_number: int, request: Request):
    """提交 PR 审查"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {"event": body.get("event", "COMMENT"), "body": body.get("body", "")}
    status, result = gh_post(f"/repos/{settings.github_user}/{repo_name}/pulls/{pr_number}/reviews", data=data)
    if status == 200:
        return result
    raise HTTPException(status_code=status, detail=f"提交审查失败: {result}")


@router.put("/repos/{repo_name}/pulls/{pr_number}/merge")
async def merge_pull_request(repo_name: str, pr_number: int, request: Request):
    """合并 PR"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json() if hasattr(request, 'body') else {}
    merge_method = body.get("merge_method", "merge_commit")
    method_map = {"merge_commit": "merge", "squash": "squash", "rebase": "rebase"}
    data = {"merge_method": method_map.get(merge_method, "merge")}
    if body.get("commit_title"):
        data["commit_title"] = body["commit_title"]
    if body.get("commit_message"):
        data["commit_message"] = body["commit_message"]
    status, result = gh_put(f"/repos/{settings.github_user}/{repo_name}/pulls/{pr_number}/merge", data=data)
    if status == 200:
        return result
    raise HTTPException(status_code=status, detail=f"合并 PR 失败: {result}")


@router.get("/repos/{repo_name}/pulls/{pull_number}/comments")
async def list_pull_request_comments(repo_name: str, pull_number: int):
    """获取 PR 评论列表"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/pulls/{pull_number}/comments?per_page=100")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 PR 评论失败: {data}")
    if not isinstance(data, list):
        return []
    return [{"id": c.get("id"), "body": c.get("body", "") or "", "path": c.get("path", ""), "position": c.get("position"), "original_position": c.get("original_position"), "diff_hunk": c.get("diff_hunk", ""), "user": {"login": c.get("user", {}).get("login", ""), "avatar_url": c.get("user", {}).get("avatar_url", "")} if c.get("user") else {}, "created_at": c.get("created_at", ""), "in_reply_to_id": c.get("in_reply_to_id")} for c in data]


@router.post("/repos/{repo_name}/pulls/{pull_number}/comments")
async def create_pull_request_comment(repo_name: str, pull_number: int, request: Request):
    """创建 PR 评论"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {"body": body.get("body", "")}
    if body.get("commit_id"):
        data["commit_id"] = body["commit_id"]
    if body.get("path"):
        data["path"] = body["path"]
    if body.get("position") is not None:
        data["position"] = body["position"]
    if body.get("side"):
        data["side"] = body["side"]
    if body.get("start_side"):
        data["start_side"] = body["start_side"]
    if body.get("start_line"):
        data["start_line"] = body["start_line"]
    if body.get("line"):
        data["line"] = body["line"]
    if body.get("in_reply_to"):
        data["in_reply_to"] = body["in_reply_to"]
    status, result = gh_post(f"/repos/{settings.github_user}/{repo_name}/pulls/{pull_number}/comments", data=data)
    if status == 201:
        return result
    raise HTTPException(status_code=status, detail=f"创建 PR 评论失败: {result}")


@router.patch("/repos/{repo_name}/pulls/comments/{comment_id}")
async def update_pull_request_comment(repo_name: str, comment_id: int, request: Request):
    """更新 PR 评论"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    status, result = gh_request(f"/repos/{settings.github_user}/{repo_name}/pulls/comments/{comment_id}", method="PATCH", data={"body": body.get("body", "")})
    if status == 200:
        return result
    raise HTTPException(status_code=status, detail=f"更新 PR 评论失败: {result}")


@router.delete("/repos/{repo_name}/pulls/comments/{comment_id}")
async def delete_pull_request_comment(repo_name: str, comment_id: int):
    """删除 PR 评论"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, result = gh_delete(f"/repos/{settings.github_user}/{repo_name}/pulls/comments/{comment_id}")
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"删除 PR 评论失败: {result}")


@router.get("/repos/{repo_name}/pulls/{pull_number}/commits")
async def list_pull_request_commits(repo_name: str, pull_number: int):
    """获取 PR 提交列表"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/pulls/{pull_number}/commits?per_page=100")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 PR 提交失败: {data}")
    if not isinstance(data, list):
        return []
    return [{"sha": c.get("sha", ""), "message": c.get("commit", {}).get("message", ""), "author": {"name": c.get("commit", {}).get("author", {}).get("name", ""), "date": c.get("commit", {}).get("author", {}).get("date", "")}, "html_url": c.get("html_url", "")} for c in data]


@router.post("/repos/{repo_name}/pulls/{pull_number}/requested_reviewers")
async def request_reviewers(repo_name: str, pull_number: int, request: Request):
    """请求审查者"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {}
    if body.get("reviewers"):
        data["reviewers"] = body["reviewers"]
    if body.get("team_reviewers"):
        data["team_reviewers"] = body["team_reviewers"]
    status, result = gh_post(f"/repos/{settings.github_user}/{repo_name}/pulls/{pull_number}/requested_reviewers", data=data)
    if status == 201:
        return result
    raise HTTPException(status_code=status, detail=f"请求审查者失败: {result}")


@router.delete("/repos/{repo_name}/pulls/{pull_number}/requested_reviewers")
async def remove_requested_reviewers(repo_name: str, pull_number: int, request: Request):
    """移除请求的审查者"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {}
    if body.get("reviewers"):
        data["reviewers"] = body["reviewers"]
    if body.get("team_reviewers"):
        data["team_reviewers"] = body["team_reviewers"]
    status, result = gh_delete(f"/repos/{settings.github_user}/{repo_name}/pulls/{pull_number}/requested_reviewers", data=data)
    if status == 200:
        return result
    raise HTTPException(status_code=status, detail=f"移除审查者失败: {result}")


@router.put("/repos/{repo_name}/pulls/{pull_number}/update-branch")
async def update_pull_request_branch(repo_name: str, pull_number: int, request: Request = None):
    """更新 PR 分支（同步上游）"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    data = {"update_method": "merge"}
    status, result = gh_put(f"/repos/{settings.github_user}/{repo_name}/pulls/{pull_number}/update-branch", data=data)
    if status == 202:
        return {"message": "分支更新已触发", "result": result}
    raise HTTPException(status_code=status, detail=f"更新分支失败: {result}")


# ═══════════════════════════════════════════════════════════
#  GitHub PR Auto-Merge API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/pulls/{pull_number}/auto-merge")
async def get_pr_auto_merge(repo_name: str, pull_number: int):
    """获取 PR 自动合并状态"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/pulls/{pull_number}/auto-merge")
    if status == 404:
        return {"enabled": False, "merge_method": None}
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取自动合并状态失败: {data}")
    return data


@router.put("/repos/{repo_name}/pulls/{pull_number}/auto-merge")
async def enable_pr_auto_merge(repo_name: str, pull_number: int, request: Request):
    """启用 PR 自动合并"""
    body = await request.json()
    status, data = gh_put(f"/repos/{settings.github_user}/{repo_name}/pulls/{pull_number}/auto-merge", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"启用自动合并失败: {data}")
    return data


@router.delete("/repos/{repo_name}/pulls/{pull_number}/auto-merge")
async def disable_pr_auto_merge(repo_name: str, pull_number: int):
    """禁用 PR 自动合并"""
    status, data = gh_delete(f"/repos/{settings.github_user}/{repo_name}/pulls/{pull_number}/auto-merge")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"禁用自动合并失败: {data}")
    return {"message": "已禁用自动合并"}


# ═══════════════════════════════════════════════════════════
#  GitHub Releases API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/releases")
async def list_releases(repo_name: str, per_page: int = Query(20, ge=1, le=100)):
    """获取仓库 Release 列表"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/releases?per_page={per_page}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Releases 失败: {data}")
    if not isinstance(data, list):
        return []
    return [{"id": r.get("id"), "tag_name": r.get("tag_name", ""), "name": r.get("name", ""), "body": r.get("body", "") or "", "draft": r.get("draft", False), "prerelease": r.get("prerelease", False), "created_at": r.get("created_at", ""), "published_at": r.get("published_at", ""), "html_url": r.get("html_url", ""), "assets": [{"name": a.get("name", ""), "size": a.get("size", 0), "download_url": a.get("browser_download_url", "")} for a in (r.get("assets") or [])]} for r in data]


@router.post("/repos/{repo_name}/releases")
async def create_release(repo_name: str, request: Request):
    """创建 Release"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {"tag_name": body.get("tag_name", ""), "name": body.get("name", ""), "body": body.get("body", ""), "draft": body.get("draft", False), "prerelease": body.get("prerelease", False)}
    if body.get("target_commitish"):
        data["target_commitish"] = body["target_commitish"]
    status, result = gh_post(f"/repos/{settings.github_user}/{repo_name}/releases", data=data)
    if status == 201:
        return result
    raise HTTPException(status_code=status, detail=f"创建 Release 失败: {result}")


@router.get("/repos/{repo_name}/releases/latest")
async def get_latest_release(repo_name: str):
    """获取最新 Release"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/releases/latest")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取最新 Release 失败: {data}")
    return {"id": data.get("id"), "tag_name": data.get("tag_name", ""), "name": data.get("name", ""), "body": data.get("body", "") or "", "draft": data.get("draft", False), "prerelease": data.get("prerelease", False), "created_at": data.get("created_at", ""), "published_at": data.get("published_at", ""), "html_url": data.get("html_url", ""), "assets": [{"name": a.get("name", ""), "size": a.get("size", 0), "download_url": a.get("browser_download_url", "")} for a in (data.get("assets") or [])]}


@router.get("/repos/{repo_name}/releases/{release_id}")
async def get_release(repo_name: str, release_id: int):
    """获取 Release 详情"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/releases/{release_id}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Release 详情失败: {data}")
    return {"id": data.get("id"), "tag_name": data.get("tag_name", ""), "name": data.get("name", ""), "body": data.get("body", "") or "", "draft": data.get("draft", False), "prerelease": data.get("prerelease", False), "created_at": data.get("created_at", ""), "published_at": data.get("published_at", ""), "html_url": data.get("html_url", ""), "assets": [{"name": a.get("name", ""), "size": a.get("size", 0), "download_url": a.get("browser_download_url", "")} for a in (data.get("assets") or [])]}


@router.patch("/repos/{repo_name}/releases/{release_id}")
async def update_release(repo_name: str, release_id: int, request: Request):
    """更新 Release"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {}
    for key in ["tag_name", "name", "body", "draft", "prerelease", "target_commitish"]:
        if key in body:
            data[key] = body[key]
    status, result = gh_request(f"/repos/{settings.github_user}/{repo_name}/releases/{release_id}", method="PATCH", data=data)
    if status == 200:
        return result
    raise HTTPException(status_code=status, detail=f"更新 Release 失败: {result}")


@router.delete("/repos/{repo_name}/releases/{release_id}")
async def delete_release(repo_name: str, release_id: int):
    """删除 Release"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, result = gh_delete(f"/repos/{settings.github_user}/{repo_name}/releases/{release_id}")
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"删除 Release 失败: {result}")


@router.get("/repos/{repo_name}/tags")
async def list_tags(repo_name: str, per_page: int = Query(30, ge=1, le=100)):
    """获取仓库 Tag 列表"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/tags?per_page={per_page}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Tags 失败: {data}")
    if not isinstance(data, list):
        return []
    return [{"name": t.get("name", ""), "commit": {"sha": t.get("commit", {}).get("sha", "")}, "zipball_url": t.get("zipball_url", ""), "tarball_url": t.get("tarball_url", "")} for t in data]


# ═══════════════════════════════════════════════════════════
#  GitHub Webhooks API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/hooks")
async def list_webhooks(repo_name: str):
    """获取仓库 Webhook 列表"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/hooks?per_page=100")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Webhooks 失败: {data}")
    if not isinstance(data, list):
        return []
    return [{"id": h.get("id"), "name": h.get("name", ""), "url": h.get("config", {}).get("url", ""), "active": h.get("active", False), "events": h.get("events", []), "created_at": h.get("created_at", ""), "updated_at": h.get("updated_at", "")} for h in data]


@router.post("/repos/{repo_name}/hooks")
async def create_webhook(repo_name: str, request: Request):
    """创建 Webhook"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    # 支持两种格式：body.url 或 body.config.url
    webhook_url = body.get("url") or body.get("config", {}).get("url", "")
    webhook_secret = body.get("secret") or body.get("config", {}).get("secret", "")
    data = {
        "name": "web",
        "config": {
            "url": webhook_url,
            "content_type": body.get("content_type") or body.get("config", {}).get("content_type", "json"),
        },
        "events": body.get("events", ["push"]),
        "active": body.get("active", True),
    }
    if webhook_secret:
        data["config"]["secret"] = webhook_secret
    status, result = gh_post(f"/repos/{settings.github_user}/{repo_name}/hooks", data=data)
    if status == 201:
        return result
    raise HTTPException(status_code=status, detail=f"创建 Webhook 失败: {result}")


@router.patch("/repos/{repo_name}/hooks/{hook_id}")
async def update_webhook(repo_name: str, hook_id: int, request: Request):
    """更新 Webhook"""
    body = await request.json()
    status, data = gh_patch(f"/repos/{settings.github_user}/{repo_name}/hooks/{hook_id}", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"更新 Webhook 失败: {data}")
    return data


@router.delete("/repos/{repo_name}/hooks/{hook_id}")
async def delete_webhook(repo_name: str, hook_id: int):
    """删除 Webhook"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = gh_delete(f"/repos/{settings.github_user}/{repo_name}/hooks/{hook_id}")
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"删除 Webhook 失败: {data}")


@router.post("/repos/{repo_name}/hooks/{hook_id}/ping")
async def ping_webhook(repo_name: str, hook_id: int):
    """触发 Webhook ping"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, result = gh_post(f"/repos/{settings.github_user}/{repo_name}/hooks/{hook_id}/pings")
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"Ping Webhook 失败: {result}")


@router.get("/repos/{repo_name}/hooks/{hook_id}/deliveries")
async def list_webhook_deliveries(repo_name: str, hook_id: int, per_page: int = Query(30, ge=1, le=100)):
    """获取 Webhook 投递记录"""
    qs = urllib.parse.urlencode({"per_page": per_page})
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/hooks/{hook_id}/deliveries?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取投递记录失败: {data}")
    return data


@router.get("/repos/{repo_name}/hooks/{hook_id}/deliveries/{delivery_id}")
async def get_webhook_delivery(repo_name: str, hook_id: int, delivery_id: int):
    """获取单条 Webhook 投递详情"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/hooks/{hook_id}/deliveries/{delivery_id}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取投递详情失败: {data}")
    return data


# ═══════════════════════════════════════════════════════════
#  GitHub Notifications API
# ═══════════════════════════════════════════════════════════

@router.patch("/notifications/threads/{thread_id}")
async def mark_notification_read(repo_name: str, thread_id: str, request: Request):
    """标记通知已读"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json() if hasattr(request, 'body') else {}
    data = {}
    if body.get("read") is not None:
        data["read"] = body["read"]
    status, result = gh_request(f"/notifications/threads/{thread_id}", method="PATCH", data=data)
    if status == 205:
        return {"message": "通知已更新"}
    raise HTTPException(status_code=status, detail=f"更新通知失败: {result}")


@router.get("/repos/{repo_name}/notifications")
async def list_repo_notifications(repo_name: str, all: bool = Query(False), page: int = Query(1, ge=1), per_page: int = Query(30, ge=1, le=100)):
    """获取仓库通知"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    qs = urllib.parse.urlencode({"all": str(all).lower(), "page": page, "per_page": per_page})
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/notifications?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取仓库通知失败: {data}")
    if not isinstance(data, list):
        return []
    return [{"id": n.get("id"), "subject": {"title": n.get("subject", {}).get("title", ""), "type": n.get("subject", {}).get("type", ""), "url": n.get("subject", {}).get("url", "")}, "reason": n.get("reason", ""), "unread": n.get("unread", False), "updated_at": n.get("updated_at", ""), "repository": {"full_name": n.get("repository", {}).get("full_name", ""), "name": n.get("repository", {}).get("name", "")} if n.get("repository") else {}, "thread_id": n.get("id")} for n in data]


# ═══════════════════════════════════════════════════════════
#  GitHub Search API
# ═══════════════════════════════════════════════════════════

@router.get("/search/issues")
async def search_issues(q: str = Query(..., description="搜索关键词"), per_page: int = Query(30, ge=1, le=100)):
    """搜索 Issues 和 PR"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    scoped_q = f"{q} user:{settings.github_user}"
    qs = urllib.parse.urlencode({"q": scoped_q, "per_page": per_page})
    status, data = gh_get(f"/search/issues?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"搜索失败: {data}")
    items = data.get("items", []) if isinstance(data, dict) else []
    return {"total_count": data.get("total_count", 0), "items": [{"id": i.get("id"), "number": i.get("number"), "title": i.get("title", ""), "state": i.get("state", ""), "html_url": i.get("html_url", ""), "repository_url": i.get("repository_url", ""), "labels": [{"name": l.get("name", ""), "color": l.get("color", "")} for l in (i.get("labels") or [])], "created_at": i.get("created_at", ""), "updated_at": i.get("updated_at", "")} for i in items]}


@router.get("/search/commits")
async def search_commits(q: str = Query(..., description="搜索关键词"), per_page: int = Query(30, ge=1, le=100)):
    """搜索 Commits"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    scoped_q = f"{q} user:{settings.github_user}"
    qs = urllib.parse.urlencode({"q": scoped_q, "per_page": per_page})
    status, data = gh_get(f"/search/commits?{qs}", headers={"Accept": "application/vnd.github.cloak-preview+json"})
    if status != 200:
        raise HTTPException(status_code=status, detail=f"搜索失败: {data}")
    items = data.get("items", []) if isinstance(data, dict) else []
    return {"total_count": data.get("total_count", 0), "items": [{"sha": i.get("sha", "")[:7], "sha_full": i.get("sha", ""), "message": i.get("commit", {}).get("message", "").split("\n")[0], "author": i.get("commit", {}).get("author", {}).get("name", ""), "date": i.get("commit", {}).get("author", {}).get("date", ""), "html_url": i.get("html_url", "")} for i in items]}


@router.get("/search/repositories")
async def search_repositories(q: str = Query(..., description="搜索关键词"), per_page: int = Query(30, ge=1, le=100)):
    """搜索仓库"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    scoped_q = f"{q} user:{settings.github_user}"
    qs = urllib.parse.urlencode({"q": scoped_q, "per_page": per_page})
    status, data = gh_get(f"/search/repositories?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"搜索失败: {data}")
    items = data.get("items", []) if isinstance(data, dict) else []
    return {"total_count": data.get("total_count", 0), "items": [filter_repo_fields(i) for i in items]}


# ═══════════════════════════════════════════════════════════
#  GitHub Repository Enhanced API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/subscription")
async def get_repo_subscription(repo_name: str):
    """获取仓库订阅状态"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/subscription")
    if status == 404:
        return {"subscribed": False, "ignored": False, "reason": None, "created_at": None, "thread_url": None}
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取订阅状态失败: {data}")
    return data


@router.put("/repos/{repo_name}/subscription")
async def set_repo_subscription(repo_name: str, request: Request):
    """设置仓库订阅"""
    body = await request.json()
    status, data = gh_put(f"/repos/{settings.github_user}/{repo_name}/subscription", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"设置订阅失败: {data}")
    return data


@router.delete("/repos/{repo_name}/subscription")
async def delete_repo_subscription(repo_name: str):
    """取消仓库订阅"""
    status, data = gh_delete(f"/repos/{settings.github_user}/{repo_name}/subscription")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"取消订阅失败: {data}")
    return {"message": "已取消订阅"}


@router.get("/repos/{repo_name}/forks")
async def list_forks(repo_name: str, per_page: int = Query(30, ge=1, le=100)):
    """获取仓库 Fork 列表"""
    qs = urllib.parse.urlencode({"per_page": per_page, "sort": "newest"})
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/forks?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Fork 列表失败: {data}")
    return [{"id": f.get("id", 0), "name": f.get("name", ""), "full_name": f.get("full_name", ""), "owner": f.get("owner", {}).get("login", ""), "html_url": f.get("html_url", ""), "description": f.get("description", ""), "created_at": f.get("created_at", ""), "updated_at": f.get("updated_at", "")} for f in (data if isinstance(data, list) else [])]


@router.get("/repos/{repo_name}/collaborators")
async def list_collaborators(repo_name: str, per_page: int = Query(30, ge=1, le=100)):
    """获取仓库协作者列表"""
    qs = urllib.parse.urlencode({"per_page": per_page})
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/collaborators?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取协作者列表失败: {data}")
    return [{"login": c.get("login", ""), "id": c.get("id", 0), "avatar_url": c.get("avatar_url", ""), "html_url": c.get("html_url", ""), "permissions": c.get("permissions", {}), "role_name": c.get("role_name", "")} for c in (data if isinstance(data, list) else [])]


@router.put("/repos/{repo_name}/collaborators/{username}")
async def add_collaborator(repo_name: str, username: str, request: Request):
    """添加仓库协作者"""
    body = await request.json()
    status, data = gh_put(f"/repos/{settings.github_user}/{repo_name}/collaborators/{username}", body)
    if status != 201 and status != 204:
        raise HTTPException(status_code=status, detail=f"添加协作者失败: {data}")
    return {"message": f"已添加协作者 {username}"}


@router.delete("/repos/{repo_name}/collaborators/{username}")
async def remove_collaborator(repo_name: str, username: str):
    """移除仓库协作者"""
    status, data = gh_delete(f"/repos/{settings.github_user}/{repo_name}/collaborators/{username}")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"移除协作者失败: {data}")
    return {"message": f"已移除协作者 {username}"}


@router.get("/repos/{repo_name}/stargazers")
async def list_stargazers(repo_name: str, per_page: int = Query(30, ge=1, le=100)):
    """获取仓库 Star 用户列表"""
    qs = urllib.parse.urlencode({"per_page": per_page})
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/stargazers?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Star 列表失败: {data}")
    return [{"login": s.get("login", ""), "id": s.get("id", 0), "avatar_url": s.get("avatar_url", ""), "html_url": s.get("html_url", ""), "starred_at": s.get("starred_at", "")} for s in (data if isinstance(data, list) else [])]


@router.get("/repos/{repo_name}/contributors")
async def list_contributors(repo_name: str, per_page: int = Query(30, ge=1, le=100)):
    """获取仓库贡献者列表"""
    qs = urllib.parse.urlencode({"per_page": per_page})
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/contributors?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取贡献者失败: {data}")
    return [{"login": c.get("login", ""), "id": c.get("id", 0), "avatar_url": c.get("avatar_url", ""), "contributions": c.get("contributions", 0), "html_url": c.get("html_url", "")} for c in (data if isinstance(data, list) else [])]


@router.get("/repos/{repo_name}/languages")
async def get_repo_languages(repo_name: str):
    """获取仓库语言分布"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/languages")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取语言分布失败: {data}")
    return data if isinstance(data, dict) else {}


# ═══════════════════════════════════════════════════════════
#  GitHub User & Rate Limit API
# ═══════════════════════════════════════════════════════════

@router.get("/user")
async def get_user_profile():
    """获取当前用户资料"""
    status, data = gh_get("/user")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取用户资料失败: {data}")
    return data


@router.patch("/user")
async def update_user_profile(request: Request):
    """更新当前用户资料"""
    body = await request.json()
    status, data = gh_patch("/user", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"更新用户资料失败: {data}")
    return data


@router.get("/rate_limit")
async def get_rate_limit():
    """获取 API 配额"""
    status, data = gh_get("/rate_limit")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 API 配额失败: {data}")
    return data


@router.get("/user/starred")
async def get_starred_repos(request: Request):
    """获取星标仓库列表 - 用户收藏的他人项目"""
    params = dict(request.query_params)
    params.setdefault("per_page", "30")
    params.setdefault("sort", "updated")
    # 将 params 转换为 URL 查询字符串
    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    path = f"/user/starred?{query_string}" if query_string else "/user/starred"
    status, data = gh_get(path)
    if status == 200 and isinstance(data, list):
        return data
    return []


@router.get("/user/keys")
async def list_ssh_keys(per_page: int = Query(30, ge=1, le=100)):
    """列出 SSH 密钥"""
    qs = urllib.parse.urlencode({"per_page": per_page})
    status, data = gh_get(f"/user/keys?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 SSH 密钥失败: {data}")
    return data if isinstance(data, list) else []


@router.post("/user/keys")
async def create_ssh_key(request: Request):
    """添加 SSH 密钥"""
    body = await request.json()
    status, data = gh_post("/user/keys", body)
    if status != 201:
        raise HTTPException(status_code=status, detail=f"添加 SSH 密钥失败: {data}")
    return data


@router.delete("/user/keys/{key_id}")
async def delete_ssh_key(key_id: int):
    """删除 SSH 密钥"""
    status, data = gh_delete(f"/user/keys/{key_id}")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"删除 SSH 密钥失败: {data}")
    return {"message": "已删除 SSH 密钥"}


@router.get("/user/gpg_keys")
async def list_gpg_keys(per_page: int = Query(30, ge=1, le=100)):
    """列出 GPG 密钥"""
    qs = urllib.parse.urlencode({"per_page": per_page})
    status, data = gh_get(f"/user/gpg_keys?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 GPG 密钥失败: {data}")
    return data if isinstance(data, list) else []


@router.post("/user/gpg_keys")
async def create_gpg_key(request: Request):
    """添加 GPG 密钥"""
    body = await request.json()
    status, data = gh_post("/user/gpg_keys", body)
    if status != 201:
        raise HTTPException(status_code=status, detail=f"添加 GPG 密钥失败: {data}")
    return data


@router.delete("/user/gpg_keys/{gpg_key_id}")
async def delete_gpg_key(gpg_key_id: int):
    """删除 GPG 密钥"""
    status, data = gh_delete(f"/user/gpg_keys/{gpg_key_id}")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"删除 GPG 密钥失败: {data}")
    return {"message": "已删除 GPG 密钥"}


@router.get("/user/orgs")
async def list_user_orgs(per_page: int = Query(30, ge=1, le=100)):
    """获取用户所属组织列表"""
    qs = urllib.parse.urlencode({"per_page": per_page})
    status, data = gh_get(f"/user/orgs?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取组织列表失败: {data}")
    return [{"id": o.get("id", 0), "login": o.get("login", ""), "description": o.get("description", ""), "avatar_url": o.get("avatar_url", ""), "url": o.get("url", "")} for o in (data if isinstance(data, list) else [])]


@router.get("/user/packages")
async def list_user_packages(package_type: str = Query("npm", description="npm/maven/docker/rubygems/nuget"), per_page: int = Query(30, ge=1, le=100)):
    """获取用户包列表"""
    qs = urllib.parse.urlencode({"package_type": package_type, "per_page": per_page})
    status, data = gh_get(f"/user/packages?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取包列表失败: {data}")
    return data if isinstance(data, list) else []


@router.delete("/user/packages/{package_type}/{package_name}")
async def delete_package(package_type: str, package_name: str):
    """删除包"""
    status, data = gh_delete(f"/user/packages/{package_type}/{package_name}")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"删除包失败: {data}")
    return {"message": f"已删除包 {package_name}"}


# ═══════════════════════════════════════════════════════════
#  GitHub Reactions API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/issues/{issue_number}/reactions")
async def list_issue_reactions(repo_name: str, issue_number: int):
    """获取 Issue 表情反应列表"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/issues/{issue_number}/reactions")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取表情反应失败: {data}")
    return data if isinstance(data, list) else []


@router.post("/repos/{repo_name}/issues/{issue_number}/reactions")
async def create_issue_reaction(repo_name: str, issue_number: int, request: Request):
    """给 Issue 添加表情反应"""
    body = await request.json()
    status, data = gh_post(f"/repos/{settings.github_user}/{repo_name}/issues/{issue_number}/reactions", body)
    if status != 201:
        raise HTTPException(status_code=status, detail=f"添加表情反应失败: {data}")
    return data


@router.delete("/repos/{repo_name}/issues/{issue_number}/reactions/{reaction_id}")
async def delete_issue_reaction(repo_name: str, issue_number: int, reaction_id: int):
    """删除 Issue 表情反应"""
    status, data = gh_delete(f"/repos/{settings.github_user}/{repo_name}/issues/{issue_number}/reactions/{reaction_id}")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"删除表情反应失败: {data}")
    return {"message": "已删除表情反应"}


@router.get("/repos/{repo_name}/issues/comments/{comment_id}/reactions")
async def list_comment_reactions(repo_name: str, comment_id: int):
    """获取评论表情反应列表"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/issues/comments/{comment_id}/reactions")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取评论表情反应失败: {data}")
    return data if isinstance(data, list) else []


@router.post("/repos/{repo_name}/issues/comments/{comment_id}/reactions")
async def create_comment_reaction(repo_name: str, comment_id: int, request: Request):
    """给评论添加表情反应"""
    body = await request.json()
    status, data = gh_post(f"/repos/{settings.github_user}/{repo_name}/issues/comments/{comment_id}/reactions", body)
    if status != 201:
        raise HTTPException(status_code=status, detail=f"添加评论表情反应失败: {data}")
    return data


@router.delete("/repos/{repo_name}/issues/comments/{comment_id}/reactions/{reaction_id}")
async def delete_comment_reaction(repo_name: str, comment_id: int, reaction_id: int):
    """删除评论表情反应"""
    status, data = gh_delete(f"/repos/{settings.github_user}/{repo_name}/issues/comments/{comment_id}/reactions/{reaction_id}")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"删除评论表情反应失败: {data}")
    return {"message": "已删除评论表情反应"}


@router.get("/repos/{repo_name}/pulls/{pull_number}/comments/{comment_id}/reactions")
async def list_pr_comment_reactions(repo_name: str, pull_number: int, comment_id: int):
    """获取 PR 评论表情反应"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/pulls/comments/{comment_id}/reactions")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 PR 评论表情反应失败: {data}")
    return data if isinstance(data, list) else []


@router.post("/repos/{repo_name}/pulls/{pull_number}/comments/{comment_id}/reactions")
async def create_pr_comment_reaction(repo_name: str, pull_number: int, comment_id: int, request: Request):
    """给 PR 评论添加表情反应"""
    body = await request.json()
    status, data = gh_post(f"/repos/{settings.github_user}/{repo_name}/pulls/comments/{comment_id}/reactions", body)
    if status != 201:
        raise HTTPException(status_code=status, detail=f"添加 PR 评论表情反应失败: {data}")
    return data


@router.delete("/repos/{repo_name}/pulls/{pull_number}/comments/{comment_id}/reactions/{reaction_id}")
async def delete_pr_comment_reaction(repo_name: str, pull_number: int, comment_id: int, reaction_id: int):
    """删除 PR 评论表情反应"""
    status, data = gh_delete(f"/repos/{settings.github_user}/{repo_name}/pulls/comments/{comment_id}/reactions/{reaction_id}")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"删除 PR 评论表情反应失败: {data}")
    return {"message": "已删除 PR 评论表情反应"}


# ═══════════════════════════════════════════════════════════
#  GitHub Discussions API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/discussions")
async def list_discussions(repo_name: str, per_page: int = Query(30, ge=1, le=100)):
    """获取仓库讨论列表（需要 GraphQL，此处用 Search API 替代）"""
    qs = urllib.parse.urlencode({"q": f"repo:{settings.github_user}/{repo_name} is:open", "per_page": per_page})
    status, data = gh_get(f"/search/issues?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取讨论列表失败: {data}")
    items = data.get("items", []) if isinstance(data, dict) else []
    discussions = [i for i in items if i.get("html_url", "").split("/").count("/") >= 7 and "discussions" in (i.get("html_url") or "")]
    return {"total_count": len(discussions), "items": discussions}


@router.get("/repos/{repo_name}/discussions/categories")
async def list_discussion_categories(repo_name: str):
    """获取讨论分类列表"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/discussions/categories")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取讨论分类失败: {data}")
    return data if isinstance(data, list) else []


# ═══════════════════════════════════════════════════════════
#  GitHub Projects V2 API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/projects")
async def list_repo_projects(repo_name: str, state: str = Query("open", description="open/closed/all")):
    """获取仓库项目列表"""
    qs = urllib.parse.urlencode({"state": state})
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/projects?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取项目列表失败: {data}")
    return data if isinstance(data, list) else []


@router.post("/repos/{repo_name}/projects")
async def create_repo_project(repo_name: str, request: Request):
    """创建仓库项目"""
    body = await request.json()
    status, data = gh_post(f"/repos/{settings.github_user}/{repo_name}/projects", body)
    if status != 201:
        raise HTTPException(status_code=status, detail=f"创建项目失败: {data}")
    return data


@router.get("/projects/{project_id}")
async def get_project(project_id: int):
    """获取项目详情"""
    status, data = gh_get(f"/projects/{project_id}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取项目详情失败: {data}")
    return data


@router.patch("/projects/{project_id}")
async def update_project(project_id: int, request: Request):
    """更新项目"""
    body = await request.json()
    status, data = gh_patch(f"/projects/{project_id}", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"更新项目失败: {data}")
    return data


@router.delete("/projects/{project_id}")
async def delete_project_v2(project_id: int):
    """删除项目"""
    status, data = gh_delete(f"/projects/{project_id}")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"删除项目失败: {data}")
    return {"message": f"已删除项目 {project_id}"}


@router.get("/projects/{project_id}/columns")
async def list_project_columns(project_id: int):
    """获取项目列"""
    status, data = gh_get(f"/projects/{project_id}/columns")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取项目列失败: {data}")
    return data if isinstance(data, list) else []


@router.get("/projects/columns/{column_id}/cards")
async def list_column_cards(column_id: int):
    """获取列中的卡片"""
    status, data = gh_get(f"/projects/columns/{column_id}/cards")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取卡片列表失败: {data}")
    return data if isinstance(data, list) else []


# ═══════════════════════════════════════════════════════════
#  GitHub Checks API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/commits/{ref}/check-runs")
async def list_check_runs(repo_name: str, ref: str):
    """获取提交的 Check Runs"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/commits/{ref}/check-runs")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Check Runs 失败: {data}")
    return data


@router.get("/repos/{repo_name}/commits/{ref}/check-suites")
async def list_check_suites(repo_name: str, ref: str):
    """获取提交的 Check Suites"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/commits/{ref}/check-suites")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Check Suites 失败: {data}")
    return data


@router.get("/repos/{repo_name}/check-runs/{check_run_id}")
async def get_check_run(repo_name: str, check_run_id: int):
    """获取 Check Run 详情"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/check-runs/{check_run_id}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Check Run 详情失败: {data}")
    return data


@router.get("/repos/{repo_name}/check-runs/{check_run_id}/annotations")
async def get_check_run_annotations(repo_name: str, check_run_id: int):
    """获取 Check Run 注解"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/check-runs/{check_run_id}/annotations")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Check Run 注解失败: {data}")
    return data if isinstance(data, list) else []


# ═══════════════════════════════════════════════════════════
#  GitHub Dependabot & Code Scanning API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/dependabot/alerts")
async def list_dependabot_alerts(repo_name: str, state: str = Query("open", description="open/dismissed/fixed")):
    """获取 Dependabot 告警列表"""
    qs = urllib.parse.urlencode({"state": state})
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/dependabot/alerts?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Dependabot 告警失败: {data}")
    return data if isinstance(data, list) else []


@router.patch("/repos/{repo_name}/dependabot/alerts/{alert_number}")
async def update_dependabot_alert(repo_name: str, alert_number: int, request: Request):
    """更新 Dependabot 告警状态"""
    body = await request.json()
    status, data = gh_patch(f"/repos/{settings.github_user}/{repo_name}/dependabot/alerts/{alert_number}", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"更新 Dependabot 告警失败: {data}")
    return data


@router.get("/repos/{repo_name}/code-scanning/alerts")
async def list_code_scanning_alerts(repo_name: str, state: str = Query("open", description="open/dismissed/fixed")):
    """获取代码扫描告警列表"""
    qs = urllib.parse.urlencode({"state": state})
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/code-scanning/alerts?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取代码扫描告警失败: {data}")
    return data if isinstance(data, list) else []


@router.get("/repos/{repo_name}/code-scanning/alerts/{alert_number}")
async def get_code_scanning_alert(repo_name: str, alert_number: int):
    """获取代码扫描告警详情"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/code-scanning/alerts/{alert_number}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取代码扫描告警详情失败: {data}")
    return data


# ═══════════════════════════════════════════════════════════
#  GitHub Actions Variables & Cache API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/actions/variables")
async def list_variables(repo_name: str):
    """获取 Actions Variables 列表"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/actions/variables")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Variables 失败: {data}")
    return data


@router.get("/repos/{repo_name}/actions/variables/{name}")
async def get_variable(repo_name: str, name: str):
    """获取单个 Variable"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/actions/variables/{name}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Variable 失败: {data}")
    return data


@router.post("/repos/{repo_name}/actions/variables")
async def create_variable(repo_name: str, request: Request):
    """创建 Variable"""
    body = await request.json()
    status, data = gh_post(f"/repos/{settings.github_user}/{repo_name}/actions/variables", body)
    if status != 201:
        raise HTTPException(status_code=status, detail=f"创建 Variable 失败: {data}")
    return {"message": f"已创建 Variable"}


@router.patch("/repos/{repo_name}/actions/variables/{name}")
async def update_variable(repo_name: str, name: str, request: Request):
    """更新 Variable"""
    body = await request.json()
    status, data = gh_patch(f"/repos/{settings.github_user}/{repo_name}/actions/variables/{name}", body)
    if status != 204:
        raise HTTPException(status_code=status, detail=f"更新 Variable 失败: {data}")
    return {"message": f"已更新 Variable {name}"}


@router.delete("/repos/{repo_name}/actions/variables/{name}")
async def delete_variable(repo_name: str, name: str):
    """删除 Variable"""
    status, data = gh_delete(f"/repos/{settings.github_user}/{repo_name}/actions/variables/{name}")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"删除 Variable 失败: {data}")
    return {"message": f"已删除 Variable {name}"}


@router.get("/repos/{repo_name}/actions/caches")
async def list_caches(repo_name: str):
    """获取 Actions 缓存列表"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/actions/caches")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取缓存列表失败: {data}")
    return data


@router.delete("/repos/{repo_name}/actions/caches/{cache_id}")
async def delete_cache(repo_name: str, cache_id: int):
    """删除 Actions 缓存"""
    status, data = gh_delete(f"/repos/{settings.github_user}/{repo_name}/actions/caches/{cache_id}")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"删除缓存失败: {data}")
    return {"message": "已删除缓存"}


@router.delete("/repos/{repo_name}/actions/caches")
async def delete_all_caches(repo_name: str):
    """删除仓库所有 Actions 缓存"""
    status, data = gh_delete(f"/repos/{settings.github_user}/{repo_name}/actions/caches")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"删除所有缓存失败: {data}")
    return {"message": "已删除所有缓存"}


# ═══════════════════════════════════════════════════════════
#  GitHub Organizations & Teams API
# ═══════════════════════════════════════════════════════════

@router.get("/orgs/{org}/repos")
async def list_org_repos(org: str, per_page: int = Query(30, ge=1, le=100)):
    """获取组织仓库列表"""
    qs = urllib.parse.urlencode({"per_page": per_page, "sort": "updated"})
    status, data = gh_get(f"/orgs/{org}/repos?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取组织仓库失败: {data}")
    return [filter_repo_fields(r) for r in (data if isinstance(data, list) else [])]


@router.get("/orgs/{org}/members")
async def list_org_members(org: str, per_page: int = Query(30, ge=1, le=100)):
    """获取组织成员列表"""
    qs = urllib.parse.urlencode({"per_page": per_page})
    status, data = gh_get(f"/orgs/{org}/members?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取组织成员失败: {data}")
    return [{"login": m.get("login", ""), "id": m.get("id", 0), "avatar_url": m.get("avatar_url", ""), "url": m.get("url", "")} for m in (data if isinstance(data, list) else [])]


@router.get("/orgs/{org}/teams")
async def list_org_teams(org: str, per_page: int = Query(30, ge=1, le=100)):
    """获取组织团队列表"""
    qs = urllib.parse.urlencode({"per_page": per_page})
    status, data = gh_get(f"/orgs/{org}/teams?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取团队列表失败: {data}")
    return [{"id": t.get("id", 0), "name": t.get("name", ""), "slug": t.get("slug", ""), "description": t.get("description", ""), "privacy": t.get("privacy", ""), "members_count": t.get("members_count", 0), "repos_count": t.get("repos_count", 0)} for t in (data if isinstance(data, list) else [])]


@router.get("/orgs/{org}/teams/{team_slug}/members")
async def list_team_members(org: str, team_slug: str, per_page: int = Query(30, ge=1, le=100)):
    """获取团队成员列表"""
    qs = urllib.parse.urlencode({"per_page": per_page})
    status, data = gh_get(f"/orgs/{org}/teams/{team_slug}/members?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取团队成员失败: {data}")
    return [{"login": m.get("login", ""), "id": m.get("id", 0), "avatar_url": m.get("avatar_url", ""), "role": m.get("role", "")} for m in (data if isinstance(data, list) else [])]


@router.get("/orgs/{org}/teams/{team_slug}/repos")
async def list_team_repos(org: str, team_slug: str, per_page: int = Query(30, ge=1, le=100)):
    """获取团队仓库列表"""
    qs = urllib.parse.urlencode({"per_page": per_page})
    status, data = gh_get(f"/orgs/{org}/teams/{team_slug}/repos?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取团队仓库失败: {data}")
    return [filter_repo_fields(r) for r in (data if isinstance(data, list) else [])]


# ═══════════════════════════════════════════════════════════
#  GitHub Environments API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/environments")
async def list_environments(repo_name: str):
    """获取仓库环境列表"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/environments")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取环境列表失败: {data}")
    return data


@router.get("/repos/{repo_name}/environments/{environment_name}")
async def get_environment(repo_name: str, environment_name: str):
    """获取环境详情"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/environments/{environment_name}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取环境详情失败: {data}")
    return data


@router.put("/repos/{repo_name}/environments/{environment_name}")
async def create_or_update_environment(repo_name: str, environment_name: str, request: Request):
    """创建或更新环境"""
    body = await request.json()
    status, data = gh_put(f"/repos/{settings.github_user}/{repo_name}/environments/{environment_name}", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"创建/更新环境失败: {data}")
    return data


@router.delete("/repos/{repo_name}/environments/{environment_name}")
async def delete_environment(repo_name: str, environment_name: str):
    """删除环境"""
    status, data = gh_delete(f"/repos/{settings.github_user}/{repo_name}/environments/{environment_name}")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"删除环境失败: {data}")
    return {"message": f"已删除环境 {environment_name}"}


# ═══════════════════════════════════════════════════════════
#  GitHub Pages API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/pages")
async def get_pages_info(repo_name: str):
    """获取 GitHub Pages 信息"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/pages")
    if status == 404:
        return {"enabled": False}
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Pages 信息失败: {data}")
    return data


@router.post("/repos/{repo_name}/pages")
async def enable_pages(repo_name: str, request: Request):
    """启用 GitHub Pages"""
    body = await request.json()
    status, data = gh_post(f"/repos/{settings.github_user}/{repo_name}/pages", body)
    if status != 201:
        raise HTTPException(status_code=status, detail=f"启用 Pages 失败: {data}")
    return data


@router.delete("/repos/{repo_name}/pages")
async def disable_pages(repo_name: str):
    """禁用 GitHub Pages"""
    status, data = gh_delete(f"/repos/{settings.github_user}/{repo_name}/pages")
    if status != 204:
        raise HTTPException(status_code=status, detail=f"禁用 Pages 失败: {data}")
    return {"message": "已禁用 GitHub Pages"}


@router.get("/repos/{repo_name}/pages/builds")
async def list_pages_builds(repo_name: str):
    """获取 Pages 构建列表"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/pages/builds")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Pages 构建列表失败: {data}")
    return data if isinstance(data, list) else []


# ═══════════════════════════════════════════════════════════
#  GitHub Packages API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/packages")
async def list_repo_packages(repo_name: str, package_type: str = Query("npm", description="npm/maven/docker/rubygems/nuget"), per_page: int = Query(30, ge=1, le=100)):
    """获取仓库包列表"""
    qs = urllib.parse.urlencode({"package_type": package_type, "per_page": per_page})
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/packages?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取仓库包列表失败: {data}")
    return data if isinstance(data, list) else []


# ═══════════════════════════════════════════════════════════
#  GitHub Runners API
# ═══════════════════════════════════════════════════════════

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


# ═══════════════════════════════════════════════════════════
#  GitHub Deployments API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/deployments")
async def list_deployments(repo_name: str, per_page: int = Query(30, ge=1, le=100)):
    """获取部署列表"""
    qs = urllib.parse.urlencode({"per_page": per_page})
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/deployments?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取部署列表失败: {data}")
    return data if isinstance(data, list) else []


@router.post("/repos/{repo_name}/deployments")
async def create_deployment(repo_name: str, request: Request):
    """创建部署"""
    body = await request.json()
    status, data = gh_post(f"/repos/{settings.github_user}/{repo_name}/deployments", body)
    if status != 201:
        raise HTTPException(status_code=status, detail=f"创建部署失败: {data}")
    return data


@router.get("/repos/{repo_name}/deployments/{deployment_id}/statuses")
async def list_deployment_statuses(repo_name: str, deployment_id: int):
    """获取部署状态列表"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/deployments/{deployment_id}/statuses")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取部署状态失败: {data}")
    return data if isinstance(data, list) else []


@router.post("/repos/{repo_name}/deployments/{deployment_id}/statuses")
async def create_deployment_status(repo_name: str, deployment_id: int, request: Request):
    """创建部署状态"""
    body = await request.json()
    status, data = gh_post(f"/repos/{settings.github_user}/{repo_name}/deployments/{deployment_id}/statuses", body)
    if status != 201:
        raise HTTPException(status_code=status, detail=f"创建部署状态失败: {data}")
    return data


# ═══════════════════════════════════════════════════════════
#  GitHub Git Data API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/git/trees/{sha}")
async def get_tree(repo_name: str, sha: str, recursive: int = Query(1, description="1 for flat, 1 for recursive")):
    """获取 Git Tree"""
    qs = urllib.parse.urlencode({"recursive": recursive})
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/git/trees/{sha}?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Tree 失败: {data}")
    return data


@router.get("/repos/{repo_name}/git/blobs/{sha}")
async def get_blob(repo_name: str, sha: str):
    """获取 Git Blob"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/git/blobs/{sha}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Blob 失败: {data}")
    return data


@router.get("/repos/{repo_name}/git/refs")
async def list_refs(repo_name: str):
    """获取 Git 引用列表"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/git/refs")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取引用列表失败: {data}")
    return data if isinstance(data, list) else []


@router.get("/repos/{repo_name}/git/commits/{sha}")
async def get_git_commit(repo_name: str, sha: str):
    """获取 Git Commit 对象"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/git/commits/{sha}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Git Commit 失败: {data}")
    return data


@router.post("/repos/{repo_name}/git/commits")
async def create_git_commit(repo_name: str, request: Request):
    """创建 Git 提交对象"""
    body = await request.json()
    status, data = gh_post(f"/repos/{settings.github_user}/{repo_name}/git/commits", body)
    if status != 201:
        raise HTTPException(status_code=status, detail=f"创建 Git 提交失败: {data}")
    return data


@router.post("/repos/{repo_name}/git/trees")
async def create_git_tree(repo_name: str, request: Request):
    """创建 Git 树对象"""
    body = await request.json()
    status, data = gh_post(f"/repos/{settings.github_user}/{repo_name}/git/trees", body)
    if status != 201:
        raise HTTPException(status_code=status, detail=f"创建 Git 树失败: {data}")
    return data


@router.post("/repos/{repo_name}/git/blobs")
async def create_git_blob(repo_name: str, request: Request):
    """创建 Git Blob 对象"""
    body = await request.json()
    status, data = gh_post(f"/repos/{settings.github_user}/{repo_name}/git/blobs", body)
    if status != 201:
        raise HTTPException(status_code=status, detail=f"创建 Git Blob 失败: {data}")
    return data


# ═══════════════════════════════════════════════════════════
#  GitHub Edge Endpoints
# ═══════════════════════════════════════════════════════════

@router.put("/repos/{repo_name}/transfer")
async def transfer_repo(repo_name: str, request: Request):
    """转移仓库所有权"""
    body = await request.json()
    status, data = gh_post(f"/repos/{settings.github_user}/{repo_name}/transfer", body)
    if status != 202:
        raise HTTPException(status_code=status, detail=f"转移仓库失败: {data}")
    return data


@router.get("/repos/{repo_name}/community/profile")
async def get_community_profile(repo_name: str):
    """获取社区健康度指标"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/community/profile")
    if status == 404:
        return {"health_percentage": 0, "files": {}, "updated_at": None}
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取社区资料失败: {data}")
    return data


@router.get("/repos/{repo_name}/license")
async def get_repo_license(repo_name: str):
    """获取仓库许可证信息"""
    status, data = gh_get(f"/repos/{settings.github_user}/{repo_name}/license")
    if status == 404:
        return {"key": None, "name": None, "spdx_id": None}
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取许可证失败: {data}")
    return data


@router.post("/markdown")
async def render_markdown(request: Request):
    """渲染 Markdown 为 HTML"""
    body = await request.json()
    status, data = gh_post("/markdown", body)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"Markdown 渲染失败: {data}")
    return {"html": data}


# ═══════════════════════════════════════════════════════════
#  GitHub Stats API (带重试)
# ═══════════════════════════════════════════════════════════

async def _fetch_stats_with_retry(path: str, max_retries: int = 5, interval: int = 3):
    """GitHub Stats API 首次请求可能返回 202，需轮询等待"""
    for attempt in range(max_retries):
        status, data = gh_get(path)
        if status == 200 and data is not None:
            return data
        if status == 202:
            await asyncio.sleep(interval)
            continue
        # Other errors: return as-is
        return data or []
    return []


# 简单内存缓存（10 分钟 TTL）
_stats_cache: dict = {}
_stats_cache_ttl: dict = {}


def _stats_cache_get(key: str):
    import time
    if key in _stats_cache:
        if time.time() < _stats_cache_ttl.get(key, 0):
            return _stats_cache[key]
        del _stats_cache[key]
    return None


def _stats_cache_set(key: str, value, ttl: int = 600):
    import time
    _stats_cache[key] = value
    _stats_cache_ttl[key] = time.time() + ttl


@router.get("/repos/{repo_name}/stats/commit-activity")
async def stats_commit_activity(repo_name: str):
    """提交活动统计"""
    cache_key = f"stats:commit-activity:{repo_name}"
    cached = _stats_cache_get(cache_key)
    if cached is not None:
        return cached
    data = await _fetch_stats_with_retry(f"/repos/{repo_name}/stats/commit_activity")
    _stats_cache_set(cache_key, data, ttl=600)
    return data


@router.get("/repos/{repo_name}/stats/code-frequency")
async def stats_code_frequency(repo_name: str):
    """代码频率统计"""
    cache_key = f"stats:code-frequency:{repo_name}"
    cached = _stats_cache_get(cache_key)
    if cached is not None:
        return cached
    data = await _fetch_stats_with_retry(f"/repos/{repo_name}/stats/code_frequency")
    _stats_cache_set(cache_key, data, ttl=600)
    return data


@router.get("/repos/{repo_name}/stats/participation")
async def stats_participation(repo_name: str):
    """参与者统计"""
    cache_key = f"stats:participation:{repo_name}"
    cached = _stats_cache_get(cache_key)
    if cached is not None:
        return cached
    data = await _fetch_stats_with_retry(f"/repos/{repo_name}/stats/participation")
    _stats_cache_set(cache_key, data, ttl=600)
    return data


@router.get("/repos/{repo_name}/stats/punch-card")
async def stats_punch_card(repo_name: str):
    """提交时间分布"""
    cache_key = f"stats:punch-card:{repo_name}"
    cached = _stats_cache_get(cache_key)
    if cached is not None:
        return cached
    data = await _fetch_stats_with_retry(f"/repos/{repo_name}/stats/punch_card")
    _stats_cache_set(cache_key, data, ttl=600)
    return data


# ═══════════════════════════════════════════════════════════
#  GitHub Trending API
# ═══════════════════════════════════════════════════════════

@router.get("/trending")
async def get_trending_repos(
    language: str = Query("", description="编程语言过滤"),
    since: str = Query("daily", description="时间范围: daily, weekly, monthly"),
):
    """获取 GitHub 热门项目 - 通过搜索 API 模拟"""
    # GitHub 没有 official trending API，使用搜索 API 模拟
    # 搜索最近创建/更新的热门项目
    query_parts = ["stars:>100", "fork:true"]
    if language:
        query_parts.append(f"language:{language}")

    # 根据时间范围调整
    if since == "weekly":
        since_date = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
        query_parts.append(f"pushed:>{since_date}")
    elif since == "monthly":
        since_date = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
        query_parts.append(f"pushed:>{since_date}")
    else:  # daily
        since_date = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
        query_parts.append(f"pushed:>{since_date}")

    query = " ".join(query_parts)
    query_string = urllib.parse.urlencode({
        "q": query,
        "sort": "stars",
        "order": "desc",
        "per_page": "10",
    })

    status, data = gh_get(f"/search/repositories?{query_string}")
    if status == 200 and data:
        items = data.get("items", [])
        # 格式化返回数据
        return [{
            "name": item.get("name", ""),
            "full_name": item.get("full_name", ""),
            "description": item.get("description", ""),
            "language": item.get("language", ""),
            "stargazers_count": item.get("stargazers_count", 0),
            "forks_count": item.get("forks_count", 0),
            "open_issues_count": item.get("open_issues_count", 0),
            "html_url": item.get("html_url", ""),
            "owner": {
                "login": item.get("owner", {}).get("login", ""),
                "avatar_url": item.get("owner", {}).get("avatar_url", ""),
            },
            "pushed_at": item.get("pushed_at", ""),
        } for item in items]
    return []


# ═══════════════════════════════════════════════════════════
#  GitHub Readme API
# ═══════════════════════════════════════════════════════════

@router.get("/repos/{repo_name}/readme")
async def get_readme(repo_name: str):
    """获取仓库 README 原始内容"""
    status, data = gh_get(f"/repos/{repo_name}/readme")
    if status != 200 or not data:
        return {"content": None, "name": None, "path": None}
    content = data.get("content", "")
    if data.get("encoding") == "base64" and content:
        try:
            content = base64.b64decode(content).decode("utf-8")
        except Exception:
            pass
    return {
        "content": content,
        "name": data.get("name", "README.md"),
        "path": data.get("path", ""),
        "sha": data.get("sha", ""),
    }
