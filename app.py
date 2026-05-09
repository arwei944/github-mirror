"""
GitHub Mirror - GitHub API 代理服务
FastAPI 后端，提供 GitHub API 代理、活动流、通知、部署等功能
"""

import json
import os
import subprocess
import threading
import time
import urllib.request
import urllib.parse
import urllib.error
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

__version__ = "2.4.0"

app = FastAPI(
    version=__version__,
    title="GitHub Mirror",
    description="GitHub API 代理服务，提供增强功能",
)

# ──────────────────────────────────────────────
# 环境变量
# ──────────────────────────────────────────────
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_USER = os.environ.get("GITHUB_USER", "")
HF_TOKEN = os.environ.get("HF_TOKEN", "")
HF_USER = os.environ.get("HF_USER", "")
DATA_DIR = os.environ.get("DATA_DIR", "/data/user/work/github-mirror/data")

# 确保数据目录存在
Path(DATA_DIR).mkdir(parents=True, exist_ok=True)

# 静态文件目录
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

# ──────────────────────────────────────────────
# GitHub API 请求工具
# ──────────────────────────────────────────────
GITHUB_API_BASE = "https://api.github.com"


def github_request(
    path: str,
    method: str = "GET",
    data: Optional[dict] = None,
    headers: Optional[dict] = None,
    accept: str = "application/vnd.github.v3+json",
) -> tuple:
    """
    向 GitHub API 发送请求
    返回 (status_code, response_dict_or_bytes)
    """
    url = f"{GITHUB_API_BASE}{path}"
    req_headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": accept,
        "User-Agent": "GitHub-Mirror/2.0.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if headers:
        req_headers.update(headers)

    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        req_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            content_type = resp.headers.get("Content-Type", "")
            raw = resp.read()
            if "application/json" in content_type:
                return resp.status, json.loads(raw)
            return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            body = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            body = raw.decode("utf-8", errors="replace")
        return e.code, body


def github_api_get(path: str, **kwargs) -> tuple:
    """GET 请求"""
    return github_request(path, method="GET", **kwargs)


def github_api_put(path: str, data: Optional[dict] = None, **kwargs) -> tuple:
    """PUT 请求"""
    return github_request(path, method="PUT", data=data, **kwargs)


def github_api_post(path: str, data: Optional[dict] = None, **kwargs) -> tuple:
    """POST 请求"""
    return github_request(path, method="POST", data=data, **kwargs)


def github_api_delete(path: str, **kwargs) -> tuple:
    """DELETE 请求"""
    return github_request(path, method="DELETE", **kwargs)


# ──────────────────────────────────────────────
# 数据持久化
# ──────────────────────────────────────────────
PROJECTS_FILE = os.path.join(DATA_DIR, "projects.json")


def load_projects() -> dict:
    """加载项目数据"""
    if os.path.exists(PROJECTS_FILE):
        try:
            with open(PROJECTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_projects(projects: dict):
    """保存项目数据"""
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
    with open(PROJECTS_FILE, "w", encoding="utf-8") as f:
        json.dump(projects, f, ensure_ascii=False, indent=2)


# ──────────────────────────────────────────────
# GitHub Repos API
# ──────────────────────────────────────────────
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


@app.get("/api/github/repos")
async def list_github_repos(
    sort: str = Query("updated", description="排序字段: updated, stars, name, size, created, pushed"),
    direction: str = Query("desc", description="排序方向: asc, desc"),
    q: str = Query("", description="搜索关键词（按名称/描述过滤）"),
    type: str = Query("all", description="仓库类型: all, public, private, archived"),
):
    """
    获取 GitHub 仓库列表
    """
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")

    # 构建查询参数
    params = {
        "sort": sort if sort != "stars" else "updated",
        "direction": direction,
        "per_page": 100,
        "type": type,
    }
    query_string = urllib.parse.urlencode(params)
    path = f"/user/repos?{query_string}"

    status, data = github_api_get(path)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取仓库列表失败: {data}")

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


@app.get("/api/github/repos/{repo_name}/detail")
async def get_repo_detail(repo_name: str):
    """
    获取仓库详情（聚合：基本信息、README、提交、分支、贡献者、语言）
    """
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")

    # 并行获取各项数据
    repo_path = f"/repos/{GITHUB_USER}/{repo_name}"
    readme_path = f"/repos/{GITHUB_USER}/{repo_name}/readme"
    commits_path = f"/repos/{GITHUB_USER}/{repo_name}/commits?per_page=15"
    branches_path = f"/repos/{GITHUB_USER}/{repo_name}/branches"
    contributors_path = f"/repos/{GITHUB_USER}/{repo_name}/contributors?per_page=10"
    languages_path = f"/repos/{GITHUB_USER}/{repo_name}/languages"

    status, repo_data = github_api_get(repo_path)
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取仓库信息失败: {repo_data}")

    # README（请求 HTML 格式）
    readme_status, readme_data = github_api_get(
        readme_path, accept="application/vnd.github.v3.html"
    )
    readme_html = ""
    if readme_status == 200:
        if isinstance(readme_data, bytes):
            readme_html = readme_data.decode("utf-8", errors="replace")
        elif isinstance(readme_data, str):
            readme_html = readme_data

    # 提交记录
    commits_status, commits_data = github_api_get(commits_path)
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
    branches_status, branches_data = github_api_get(branches_path)
    branches = []
    if branches_status == 200 and isinstance(branches_data, list):
        branches = [b.get("name", "") for b in branches_data]

    # 贡献者
    contributors_status, contributors_data = github_api_get(contributors_path)
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
    languages_status, languages_data = github_api_get(languages_path)
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


@app.put("/api/github/repos/{repo_name}/star")
async def star_repo(repo_name: str):
    """
    Star 一个仓库
    """
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")

    status, data = github_api_put(f"/user/starred/{GITHUB_USER}/{repo_name}")
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"Star 操作失败: {data}")


@app.delete("/api/github/repos/{repo_name}/star")
async def unstar_repo(repo_name: str):
    """
    取消 Star 一个仓库
    """
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")

    status, data = github_api_delete(f"/user/starred/{GITHUB_USER}/{repo_name}")
    if status == 204:
        return JSONResponse(status_code=204, content=None)
    raise HTTPException(status_code=status, detail=f"取消 Star 操作失败: {data}")


@app.get("/api/github/repos/{repo_name}/star/status")
async def check_star_status(repo_name: str):
    """
    检查仓库是否已 Star
    """
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")

    status, data = github_api_get(f"/user/starred/{GITHUB_USER}/{repo_name}")
    if status == 204:
        return {"starred": True}
    elif status == 404:
        return {"starred": False}
    raise HTTPException(status_code=status, detail=f"检查 Star 状态失败: {data}")


@app.post("/api/github/repos/{repo_name}/forks")
async def fork_repo(repo_name: str):
    """
    Fork 一个仓库
    """
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")

    status, data = github_api_post(f"/repos/{GITHUB_USER}/{repo_name}/forks")
    if status == 202:
        return data
    raise HTTPException(status_code=status, detail=f"Fork 操作失败: {data}")


# ──────────────────────────────────────────────
# GitHub Activity API
# ──────────────────────────────────────────────
EVENT_TYPE_LABELS = {
    "PushEvent": "推送代码",
    "IssuesEvent": "工单操作",
    "IssueCommentEvent": "工单评论",
    "PullRequestEvent": "拉取请求",
    "PullRequestReviewEvent": "代码审查",
    "ReleaseEvent": "发布版本",
    "CreateEvent": "创建资源",
    "DeleteEvent": "删除资源",
    "WatchEvent": "关注仓库",
    "ForkEvent": "Fork 仓库",
    "PublicEvent": "公开仓库",
}


def enrich_event(event: dict) -> dict:
    """丰富事件数据，添加中文标签和详细信息"""
    event_type = event.get("type", "")
    payload = event.get("payload", {})
    repo = event.get("repo", {})
    repo_name = repo.get("name", "").split("/")[-1] if repo.get("name") else ""
    full_repo_name = repo.get("name", "")
    created_at = event.get("created_at", "")

    enriched = {
        "id": event.get("id", ""),
        "type": event_type,
        "type_label": EVENT_TYPE_LABELS.get(event_type, event_type),
        "repo_name": repo_name,
        "full_repo_name": full_repo_name,
        "created_at": created_at,
        "action": "",
        "detail": "",
        "url": "",
    }

    if event_type == "PushEvent":
        commits = payload.get("commits", [])
        commit_count = len(commits) if commits else payload.get("size", 0)
        enriched["action"] = "push"
        enriched["detail"] = f"推送了 {commit_count} 个提交到 {payload.get('ref', '')}"
        enriched["commit_count"] = commit_count
        enriched["ref"] = payload.get("ref", "")

    elif event_type == "IssuesEvent":
        action = payload.get("action", "")
        issue = payload.get("issue", {})
        enriched["action"] = action
        action_map = {"opened": "打开", "closed": "关闭", "reopened": "重新打开"}
        action_label = action_map.get(action, action)
        enriched["detail"] = f"{action_label}了工单 #{issue.get('number', '')}: {issue.get('title', '')}"
        enriched["issue_number"] = issue.get("number")
        enriched["issue_title"] = issue.get("title", "")
        enriched["url"] = issue.get("html_url", "")

    elif event_type == "IssueCommentEvent":
        action = payload.get("action", "")
        issue = payload.get("issue", {})
        comment = payload.get("comment", {})
        enriched["action"] = action
        action_map = {"created": "发表", "edited": "编辑", "deleted": "删除"}
        action_label = action_map.get(action, action)
        enriched["detail"] = f"{action_label}了工单 #{issue.get('number', '')} 的评论"
        enriched["issue_number"] = issue.get("number")
        enriched["comment_body"] = (comment.get("body", "") or "")[:200]
        enriched["url"] = comment.get("html_url", "")

    elif event_type == "PullRequestEvent":
        action = payload.get("action", "")
        pr = payload.get("pull_request", {})
        enriched["action"] = action
        action_map = {"opened": "打开", "closed": "关闭", "reopened": "重新打开", "merged": "合并"}
        action_label = action_map.get(action, action)
        enriched["detail"] = f"{action_label}了 PR #{pr.get('number', '')}: {pr.get('title', '')}"
        enriched["pr_number"] = pr.get("number")
        enriched["pr_title"] = pr.get("title", "")
        enriched["merged"] = pr.get("merged", False)
        enriched["url"] = pr.get("html_url", "")

    elif event_type == "PullRequestReviewEvent":
        action = payload.get("action", "")
        review = payload.get("review", {})
        pr = payload.get("pull_request", {})
        enriched["action"] = action
        action_map = {"submitted": "提交", "edited": "编辑", "dismissed": "驳回"}
        action_label = action_map.get(action, action)
        state = review.get("state", "")
        state_map = {"approved": "通过", "changes_requested": "请求修改", "commented": "评论"}
        state_label = state_map.get(state, state)
        enriched["detail"] = f"{action_label}了 PR #{pr.get('number', '')} 的审查（{state_label}）"
        enriched["pr_number"] = pr.get("number")
        enriched["review_state"] = state
        enriched["url"] = review.get("html_url", "")

    elif event_type == "ReleaseEvent":
        action = payload.get("action", "")
        release = payload.get("release", {})
        enriched["action"] = action
        action_map = {"published": "发布", "created": "创建", "edited": "编辑", "deleted": "删除", "prereleased": "预发布"}
        action_label = action_map.get(action, action)
        enriched["detail"] = f"{action_label}了版本 {release.get('tag_name', '')}: {release.get('name', '')}"
        enriched["tag_name"] = release.get("tag_name", "")
        enriched["release_name"] = release.get("name", "")
        enriched["url"] = release.get("html_url", "")

    elif event_type == "CreateEvent":
        ref_type = payload.get("ref_type", "")
        ref = payload.get("ref", "")
        enriched["action"] = "create"
        type_map = {"branch": "分支", "tag": "标签", "repository": "仓库"}
        type_label = type_map.get(ref_type, ref_type)
        enriched["detail"] = f"创建了{type_label}: {ref}"
        enriched["ref_type"] = ref_type
        enriched["ref"] = ref

    elif event_type == "DeleteEvent":
        ref_type = payload.get("ref_type", "")
        ref = payload.get("ref", "")
        enriched["action"] = "delete"
        type_map = {"branch": "分支", "tag": "标签"}
        type_label = type_map.get(ref_type, ref_type)
        enriched["detail"] = f"删除了{type_label}: {ref}"
        enriched["ref_type"] = ref_type
        enriched["ref"] = ref

    elif event_type == "WatchEvent":
        enriched["action"] = "starred"
        enriched["detail"] = f"关注了仓库 {full_repo_name}"

    elif event_type == "ForkEvent":
        forkee = payload.get("forkee", {})
        enriched["action"] = "forked"
        enriched["detail"] = f"Fork 了仓库 {full_repo_name}"
        enriched["fork_full_name"] = forkee.get("full_name", "")
        enriched["fork_url"] = forkee.get("html_url", "")

    elif event_type == "PublicEvent":
        enriched["action"] = "publicized"
        enriched["detail"] = f"将仓库 {full_repo_name} 设为公开"

    return enriched


@app.get("/api/github/activity")
async def get_github_activity(
    per_page: int = Query(30, ge=1, le=100),
    page: int = Query(1, ge=1),
):
    """
    获取 GitHub 活动流
    """
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")
    if not GITHUB_USER:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_USER 环境变量")

    path = f"/users/{GITHUB_USER}/events?per_page={per_page}&page={page}"
    status, data = github_api_get(path)

    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取活动流失败: {data}")

    if not isinstance(data, list):
        raise HTTPException(status_code=500, detail="GitHub API 返回数据格式异常")

    events = [enrich_event(event) for event in data]
    return events


# ──────────────────────────────────────────────
# GitHub Notifications API
# ──────────────────────────────────────────────
@app.get("/api/github/notifications")
async def get_github_notifications(
    per_page: int = Query(20, ge=1, le=100),
):
    """
    获取 GitHub 通知列表
    """
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")

    path = f"/notifications?per_page={per_page}"
    status, data = github_api_get(path)

    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取通知失败: {data}")

    if not isinstance(data, list):
        raise HTTPException(status_code=500, detail="GitHub API 返回数据格式异常")

    notifications = []
    for n in data:
        subject = n.get("subject", {})
        repository = n.get("repository", {})
        notifications.append({
            "id": n.get("id", ""),
            "unread": n.get("unread", False),
            "reason": n.get("reason", ""),
            "subject": {
                "title": subject.get("title", ""),
                "type": subject.get("type", ""),
                "url": subject.get("url", ""),
                "latest_comment_url": subject.get("latest_comment_url", ""),
            },
            "repository": {
                "full_name": repository.get("full_name", ""),
                "name": repository.get("name", ""),
                "owner": repository.get("owner", {}).get("login", "") if repository.get("owner") else "",
            },
            "updated_at": n.get("updated_at", ""),
            "url": n.get("html_url", ""),
        })

    return notifications


# ──────────────────────────────────────────────
# GitHub Issues API (v2.1.0)
# ──────────────────────────────────────────────
@app.get("/api/github/repos/{repo_name}/issues")
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
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    params = {"state": state, "sort": sort, "direction": direction, "page": page, "per_page": per_page}
    if labels:
        params["labels"] = labels
    qs = urllib.parse.urlencode(params)
    status, data = github_api_get(f"/repos/{GITHUB_USER}/{repo_name}/issues?{qs}")
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


@app.get("/api/github/repos/{repo_name}/issues/{issue_number}")
async def get_issue(repo_name: str, issue_number: int):
    """获取 Issue 详情（含评论）"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = github_api_get(f"/repos/{GITHUB_USER}/{repo_name}/issues/{issue_number}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Issue 详情失败: {data}")
    # Get comments
    _, comments = github_api_get(f"/repos/{GITHUB_USER}/{repo_name}/issues/{issue_number}/comments?per_page=100")
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


@app.post("/api/github/repos/{repo_name}/issues")
async def create_issue(repo_name: str, request: Request):
    """创建 Issue"""
    if not GITHUB_TOKEN:
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
    status, result = github_api_post(f"/repos/{GITHUB_USER}/{repo_name}/issues", data=data)
    if status == 201:
        return result
    raise HTTPException(status_code=status, detail=f"创建 Issue 失败: {result}")


@app.patch("/api/github/repos/{repo_name}/issues/{issue_number}")
async def update_issue(repo_name: str, issue_number: int, request: Request):
    """更新 Issue（标题、正文、状态、标签等）"""
    if not GITHUB_TOKEN:
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
    status, result = github_request(f"/repos/{GITHUB_USER}/{repo_name}/issues/{issue_number}", method="PATCH", data=data)
    if status == 200:
        return result
    raise HTTPException(status_code=status, detail=f"更新 Issue 失败: {result}")


@app.post("/api/github/repos/{repo_name}/issues/{issue_number}/comments")
async def create_issue_comment(repo_name: str, issue_number: int, request: Request):
    """评论 Issue"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    status, result = github_api_post(
        f"/repos/{GITHUB_USER}/{repo_name}/issues/{issue_number}/comments",
        data={"body": body.get("body", "")}
    )
    if status == 201:
        return result
    raise HTTPException(status_code=status, detail=f"评论失败: {result}")


@app.get("/api/github/repos/{repo_name}/labels")
async def list_labels(repo_name: str):
    """获取仓库标签列表"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = github_api_get(f"/repos/{GITHUB_USER}/{repo_name}/labels?per_page=100")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取标签失败: {data}")
    if not isinstance(data, list):
        return []
    return [{"id": l.get("id"), "name": l.get("name", ""), "color": l.get("color", ""), "description": l.get("description", "")} for l in data]


@app.post("/api/github/repos/{repo_name}/labels")
async def create_label(repo_name: str, request: Request):
    """创建标签"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    status, result = github_api_post(
        f"/repos/{GITHUB_USER}/{repo_name}/labels",
        data={"name": body.get("name", ""), "color": body.get("color", ""), "description": body.get("description", "")}
    )
    if status == 201:
        return result
    raise HTTPException(status_code=status, detail=f"创建标签失败: {result}")


@app.get("/api/github/repos/{repo_name}/milestones")
async def list_milestones(repo_name: str, state: str = Query("all", description="状态: open, closed, all")):
    """获取仓库里程碑列表"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = github_api_get(f"/repos/{GITHUB_USER}/{repo_name}/milestones?state={state}&per_page=100")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取里程碑失败: {data}")
    if not isinstance(data, list):
        return []
    return [{"id": m.get("id"), "number": m.get("number"), "title": m.get("title", ""), "description": m.get("description", ""), "state": m.get("state", "open"), "open_issues": m.get("open_issues", 0), "closed_issues": m.get("closed_issues", 0), "created_at": m.get("created_at", "")} for m in data]


@app.post("/api/github/repos/{repo_name}/milestones")
async def create_milestone(repo_name: str, request: Request):
    """创建里程碑"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    status, result = github_api_post(
        f"/repos/{GITHUB_USER}/{repo_name}/milestones",
        data={"title": body.get("title", ""), "description": body.get("description", ""), "state": body.get("state", "open")}
    )
    if status == 201:
        return result
    raise HTTPException(status_code=status, detail=f"创建里程碑失败: {result}")


# ──────────────────────────────────────────────
# GitHub Pull Requests API (v2.2.0)
# ──────────────────────────────────────────────
@app.get("/api/github/repos/{repo_name}/pulls")
async def list_pull_requests(
    repo_name: str,
    state: str = Query("open", description="PR 状态: open, closed, all"),
    sort: str = Query("created", description="排序: created, updated, popularity"),
    direction: str = Query("desc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
):
    """获取 PR 列表"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    qs = urllib.parse.urlencode({"state": state, "sort": sort, "direction": direction, "page": page, "per_page": per_page})
    status, data = github_api_get(f"/repos/{GITHUB_USER}/{repo_name}/pulls?{qs}")
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


@app.get("/api/github/repos/{repo_name}/pulls/{pr_number}")
async def get_pull_request(repo_name: str, pr_number: int):
    """获取 PR 详情（含评论和审查）"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = github_api_get(f"/repos/{GITHUB_USER}/{repo_name}/pulls/{pr_number}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 PR 详情失败: {data}")
    # Get comments
    _, comments = github_api_get(f"/repos/{GITHUB_USER}/{repo_name}/issues/{pr_number}/comments?per_page=100")
    comment_list = []
    if isinstance(comments, list):
        for c in comments:
            comment_list.append({
                "id": c.get("id"), "body": c.get("body", "") or "",
                "user": {"login": c.get("user", {}).get("login", ""), "avatar_url": c.get("user", {}).get("avatar_url", "")} if c.get("user") else {},
                "created_at": c.get("created_at", ""),
            })
    # Get reviews
    _, reviews = github_api_get(f"/repos/{GITHUB_USER}/{repo_name}/pulls/{pr_number}/reviews?per_page=100")
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


@app.get("/api/github/repos/{repo_name}/pulls/{pr_number}/files")
async def get_pull_request_files(repo_name: str, pr_number: int):
    """获取 PR 变更文件列表"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = github_api_get(f"/repos/{GITHUB_USER}/{repo_name}/pulls/{pr_number}/files?per_page=100")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 PR 文件失败: {data}")
    if not isinstance(data, list):
        return []
    return [{"filename": f.get("filename", ""), "status": f.get("status", ""), "additions": f.get("additions", 0), "deletions": f.get("deletions", 0), "changes": f.get("changes", 0), "patch": f.get("patch", "")} for f in data]


@app.post("/api/github/repos/{repo_name}/pulls")
async def create_pull_request(repo_name: str, request: Request):
    """创建 PR"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {"title": body.get("title", ""), "head": body.get("head", ""), "base": body.get("base", "main"), "body": body.get("body", "")}
    status, result = github_api_post(f"/repos/{GITHUB_USER}/{repo_name}/pulls", data=data)
    if status == 201:
        return result
    raise HTTPException(status_code=status, detail=f"创建 PR 失败: {result}")


@app.post("/api/github/repos/{repo_name}/pulls/{pr_number}/reviews")
async def create_review(repo_name: str, pr_number: int, request: Request):
    """提交 PR 审查"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {"event": body.get("event", "COMMENT"), "body": body.get("body", "")}
    status, result = github_api_post(f"/repos/{GITHUB_USER}/{repo_name}/pulls/{pr_number}/reviews", data=data)
    if status == 200:
        return result
    raise HTTPException(status_code=status, detail=f"提交审查失败: {result}")


@app.put("/api/github/repos/{repo_name}/pulls/{pr_number}/merge")
async def merge_pull_request(repo_name: str, pr_number: int, request: Request):
    """合并 PR"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json() if hasattr(request, 'body') else {}
    merge_method = body.get("merge_method", "merge_commit")
    method_map = {"merge_commit": "merge", "squash": "squash", "rebase": "rebase"}
    data = {"merge_method": method_map.get(merge_method, "merge")}
    if body.get("commit_title"):
        data["commit_title"] = body["commit_title"]
    if body.get("commit_message"):
        data["commit_message"] = body["commit_message"]
    status, result = github_api_put(f"/repos/{GITHUB_USER}/{repo_name}/pulls/{pr_number}/merge", data=data)
    if status == 200:
        return result
    raise HTTPException(status_code=status, detail=f"合并 PR 失败: {result}")


# ──────────────────────────────────────────────
# GitHub Actions & Releases API (v2.3.0)
# ──────────────────────────────────────────────
@app.get("/api/github/repos/{repo_name}/actions/workflows")
async def list_workflows(repo_name: str):
    """获取仓库 Workflow 列表"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = github_api_get(f"/repos/{GITHUB_USER}/{repo_name}/actions/workflows")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Workflows 失败: {data}")
    workflows = data.get("workflows", []) if isinstance(data, dict) else []
    return [{"id": w.get("id"), "name": w.get("name", ""), "path": w.get("path", ""), "state": w.get("state", ""), "badge_url": w.get("badge_url", ""), "created_at": w.get("created_at", ""), "updated_at": w.get("updated_at", "")} for w in workflows]


@app.get("/api/github/repos/{repo_name}/actions/runs")
async def list_workflow_runs(repo_name: str, per_page: int = Query(20, ge=1, le=100)):
    """获取仓库 Workflow 运行记录"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = github_api_get(f"/repos/{GITHUB_USER}/{repo_name}/actions/runs?per_page={per_page}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取运行记录失败: {data}")
    runs = data.get("workflow_runs", []) if isinstance(data, dict) else []
    return [{"id": r.get("id"), "name": r.get("name", ""), "display_title": r.get("display_title", ""), "status": r.get("status", ""), "conclusion": r.get("conclusion"), "workflow_id": r.get("workflow_id"), "created_at": r.get("created_at", ""), "updated_at": r.get("updated_at", ""), "html_url": r.get("html_url", ""), "run_number": r.get("run_number"), "event": r.get("event", ""), "head_branch": r.get("head_branch", "")} for r in runs]


@app.get("/api/github/repos/{repo_name}/actions/runs/{run_id}/jobs")
async def list_run_jobs(repo_name: str, run_id: int):
    """获取运行中的 Job 列表"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = github_api_get(f"/repos/{GITHUB_USER}/{repo_name}/actions/runs/{run_id}/jobs")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Jobs 失败: {data}")
    jobs = data.get("jobs", []) if isinstance(data, dict) else []
    return [{"id": j.get("id"), "name": j.get("name", ""), "status": j.get("status", ""), "conclusion": j.get("conclusion"), "started_at": j.get("started_at", ""), "completed_at": j.get("completed_at", ""), "steps": [{"name": s.get("name", ""), "status": s.get("status", ""), "conclusion": s.get("conclusion"), "number": s.get("number")} for s in (j.get("steps") or [])]} for j in jobs]


@app.get("/api/github/repos/{repo_name}/releases")
async def list_releases(repo_name: str, per_page: int = Query(20, ge=1, le=100)):
    """获取仓库 Release 列表"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = github_api_get(f"/repos/{GITHUB_USER}/{repo_name}/releases?per_page={per_page}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Releases 失败: {data}")
    if not isinstance(data, list):
        return []
    return [{"id": r.get("id"), "tag_name": r.get("tag_name", ""), "name": r.get("name", ""), "body": r.get("body", "") or "", "draft": r.get("draft", False), "prerelease": r.get("prerelease", False), "created_at": r.get("created_at", ""), "published_at": r.get("published_at", ""), "html_url": r.get("html_url", ""), "assets": [{"name": a.get("name", ""), "size": a.get("size", 0), "download_url": a.get("browser_download_url", "")} for a in (r.get("assets") or [])]} for r in data]


@app.post("/api/github/repos/{repo_name}/releases")
async def create_release(repo_name: str, request: Request):
    """创建 Release"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    body = await request.json()
    data = {"tag_name": body.get("tag_name", ""), "name": body.get("name", ""), "body": body.get("body", ""), "draft": body.get("draft", False), "prerelease": body.get("prerelease", False)}
    if body.get("target_commitish"):
        data["target_commitish"] = body["target_commitish"]
    status, result = github_api_post(f"/repos/{GITHUB_USER}/{repo_name}/releases", data=data)
    if status == 201:
        return result
    raise HTTPException(status_code=status, detail=f"创建 Release 失败: {result}")


@app.get("/api/github/repos/{repo_name}/tags")
async def list_tags(repo_name: str, per_page: int = Query(30, ge=1, le=100)):
    """获取仓库 Tag 列表"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    status, data = github_api_get(f"/repos/{GITHUB_USER}/{repo_name}/tags?per_page={per_page}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取 Tags 失败: {data}")
    if not isinstance(data, list):
        return []
    return [{"name": t.get("name", ""), "commit": {"sha": t.get("commit", {}).get("sha", "")}, "zipball_url": t.get("zipball_url", ""), "tarball_url": t.get("tarball_url", "")} for t in data]


# ──────────────────────────────────────────────
# GitHub Code Browse & Search API (v2.4.0)
# ──────────────────────────────────────────────
@app.get("/api/github/repos/{repo_name}/contents/{path:path}")
async def get_repo_contents(repo_name: str, path: str = "", ref: str = Query("", description="分支名或 SHA")):
    """获取仓库文件/目录内容"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    qs = f"?ref={ref}" if ref else ""
    status, data = github_api_get(f"/repos/{GITHUB_USER}/{repo_name}/contents/{path}{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取内容失败: {data}")
    if isinstance(data, list):
        # Directory listing
        return [{"name": item.get("name", ""), "path": item.get("path", ""), "type": item.get("type", "file"), "size": item.get("size", 0), "download_url": item.get("download_url", "")} for item in data]
    elif isinstance(data, dict):
        # Single file
        content = data.get("content", "")
        if content and data.get("encoding") == "base64":
            import base64
            try:
                content = base64.b64decode(content).decode("utf-8", errors="replace")
            except Exception:
                pass
        return {"name": data.get("name", ""), "path": data.get("path", ""), "type": "file", "size": data.get("size", 0), "content": content, "encoding": data.get("encoding", ""), "download_url": data.get("download_url", "")}
    return data


@app.get("/api/github/search/code")
async def search_code(q: str = Query(..., description="搜索关键词"), per_page: int = Query(30, ge=1, le=100)):
    """搜索代码"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    # Scope to user's repos
    scoped_q = f"{q} user:{GITHUB_USER}"
    qs = urllib.parse.urlencode({"q": scoped_q, "per_page": per_page})
    status, data = github_api_get(f"/search/code?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"搜索失败: {data}")
    items = data.get("items", []) if isinstance(data, dict) else []
    return {"total_count": data.get("total_count", 0), "items": [{"name": i.get("name", ""), "path": i.get("path", ""), "repository": {"full_name": i.get("repository", {}).get("full_name", ""), "name": i.get("repository", {}).get("name", "")}, "html_url": i.get("html_url", "")} for i in items]}


@app.get("/api/github/search/repositories")
async def search_repositories(q: str = Query(..., description="搜索关键词"), per_page: int = Query(30, ge=1, le=100)):
    """搜索仓库"""
    if not GITHUB_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    scoped_q = f"{q} user:{GITHUB_USER}"
    qs = urllib.parse.urlencode({"q": scoped_q, "per_page": per_page})
    status, data = github_api_get(f"/search/repositories?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"搜索失败: {data}")
    items = data.get("items", []) if isinstance(data, dict) else []
    return {"total_count": data.get("total_count", 0), "items": [filter_repo_fields(i) for i in items]}


# ──────────────────────────────────────────────
# Deploy Engine（部署引擎）
# ──────────────────────────────────────────────
deploy_locks: dict = {}  # repo_name -> Lock
deploy_locks_mutex = threading.Lock()


def get_deploy_lock(repo_name: str) -> threading.Lock:
    """获取指定仓库的部署锁"""
    with deploy_locks_mutex:
        if repo_name not in deploy_locks:
            deploy_locks[repo_name] = threading.Lock()
        return deploy_locks[repo_name]


def run_deploy(project_name: str, project_config: dict):
    """
    执行部署流程：
    1. 从 GitHub 克隆仓库
    2. 推送到 HuggingFace Space
    3. 使用 rsync 同步文件
    """
    lock = get_deploy_lock(project_name)

    if not lock.acquire(blocking=False):
        print(f"[部署] {project_name} 正在部署中，跳过重复请求")
        return

    try:
        projects = load_projects()
        if project_name not in projects:
            print(f"[部署] 项目 {project_name} 不存在")
            return

        projects[project_name]["status"] = "deploying"
        projects[project_name]["last_deploy"] = datetime.now(timezone.utc).isoformat()
        save_projects(projects)

        github_repo = project_config.get("github_repo", "")
        hf_space = project_config.get("hf_space", "")
        branch = project_config.get("branch", "main")

        if not github_repo or not hf_space:
            print(f"[部署] {project_name} 配置不完整: github_repo={github_repo}, hf_space={hf_space}")
            projects = load_projects()
            projects[project_name]["status"] = "error"
            projects[project_name]["error"] = "配置不完整，缺少 github_repo 或 hf_space"
            save_projects(projects)
            return

        # 工作目录
        work_dir = os.path.join(DATA_DIR, "work", project_name)
        repo_dir = os.path.join(work_dir, "repo")

        # 清理旧的工作目录
        if os.path.exists(work_dir):
            shutil.rmtree(work_dir)
        os.makedirs(work_dir, exist_ok=True)

        # Step 1: 从 GitHub 克隆
        clone_url = f"https://{GITHUB_TOKEN}@github.com/{github_repo}.git"
        print(f"[部署] {project_name} 正在克隆 {github_repo} ...")

        clone_result = subprocess.run(
            ["git", "clone", "--depth", "1", "--branch", branch, clone_url, repo_dir],
            capture_output=True, text=True, timeout=300,
        )
        if clone_result.returncode != 0:
            print(f"[部署] {project_name} 克隆失败: {clone_result.stderr}")
            projects = load_projects()
            projects[project_name]["status"] = "error"
            projects[project_name]["error"] = f"克隆失败: {clone_result.stderr[:500]}"
            save_projects(projects)
            return

        print(f"[部署] {project_name} 克隆成功")

        # Step 2: 推送到 HuggingFace Space
        hf_url = f"https://{HF_USER}:{HF_TOKEN}@huggingface.co/spaces/{hf_space}"
        print(f"[部署] {project_name} 正在推送到 {hf_space} ...")

        # 配置 git
        subprocess.run(
            ["git", "config", "user.email", "github-mirror@bot.com"],
            cwd=repo_dir, capture_output=True, text=True,
        )
        subprocess.run(
            ["git", "config", "user.name", "GitHub Mirror Bot"],
            cwd=repo_dir, capture_output=True, text=True,
        )

        # 添加 HuggingFace 远程
        subprocess.run(
            ["git", "remote", "add", "hf", hf_url],
            cwd=repo_dir, capture_output=True, text=True,
        )

        # 强制推送到 HF
        push_result = subprocess.run(
            ["git", "push", "hf", f"{branch}:main", "--force"],
            cwd=repo_dir, capture_output=True, text=True, timeout=300,
        )
        if push_result.returncode != 0:
            print(f"[部署] {project_name} 推送到 HF 失败: {push_result.stderr}")
            projects = load_projects()
            projects[project_name]["status"] = "error"
            projects[project_name]["error"] = f"推送失败: {push_result.stderr[:500]}"
            save_projects(projects)
            return

        print(f"[部署] {project_name} 推送到 HF 成功")

        # Step 3: rsync 同步（如果配置了目标路径）
        rsync_target = project_config.get("rsync_target", "")
        if rsync_target:
            print(f"[部署] {project_name} 正在 rsync 到 {rsync_target} ...")
            rsync_result = subprocess.run(
                ["rsync", "-avz", "--delete", f"{repo_dir}/", rsync_target],
                capture_output=True, text=True, timeout=300,
            )
            if rsync_result.returncode != 0:
                print(f"[部署] {project_name} rsync 失败: {rsync_result.stderr}")
                projects = load_projects()
                projects[project_name]["status"] = "error"
                projects[project_name]["error"] = f"rsync 失败: {rsync_result.stderr[:500]}"
                save_projects(projects)
                return
            print(f"[部署] {project_name} rsync 成功")

        # 更新状态为成功
        projects = load_projects()
        projects[project_name]["status"] = "success"
        projects[project_name]["error"] = ""
        projects[project_name]["last_deploy"] = datetime.now(timezone.utc).isoformat()
        save_projects(projects)
        print(f"[部署] {project_name} 部署完成")

    except subprocess.TimeoutExpired:
        print(f"[部署] {project_name} 部署超时")
        projects = load_projects()
        if project_name in projects:
            projects[project_name]["status"] = "error"
            projects[project_name]["error"] = "部署超时"
            save_projects(projects)
    except Exception as e:
        print(f"[部署] {project_name} 部署异常: {str(e)}")
        projects = load_projects()
        if project_name in projects:
            projects[project_name]["status"] = "error"
            projects[project_name]["error"] = str(e)
            save_projects(projects)
    finally:
        # 清理工作目录
        work_dir = os.path.join(DATA_DIR, "work", project_name)
        if os.path.exists(work_dir):
            try:
                shutil.rmtree(work_dir)
            except Exception:
                pass
        lock.release()


# ──────────────────────────────────────────────
# Deploy Projects API
# ──────────────────────────────────────────────
@app.get("/api/projects")
async def list_projects():
    """
    获取所有部署项目
    """
    projects = load_projects()
    return list(projects.values())


@app.post("/api/projects/{name}")
async def create_project(name: str, request: Request):
    """
    创建部署项目
    """
    body = await request.json()
    projects = load_projects()

    if name in projects:
        raise HTTPException(status_code=409, detail=f"项目 {name} 已存在")

    project = {
        "name": name,
        "github_repo": body.get("github_repo", ""),
        "hf_space": body.get("hf_space", ""),
        "branch": body.get("branch", "main"),
        "rsync_target": body.get("rsync_target", ""),
        "status": "created",
        "error": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_deploy": "",
    }

    projects[name] = project
    save_projects(projects)
    return project


@app.delete("/api/projects/{name}")
async def delete_project(name: str):
    """
    删除部署项目
    """
    projects = load_projects()

    if name not in projects:
        raise HTTPException(status_code=404, detail=f"项目 {name} 不存在")

    del projects[name]
    save_projects(projects)
    return {"message": f"项目 {name} 已删除"}


@app.post("/api/projects/{name}/deploy")
async def deploy_project(name: str):
    """
    触发项目部署（异步）
    """
    projects = load_projects()

    if name not in projects:
        raise HTTPException(status_code=404, detail=f"项目 {name} 不存在")

    project_config = projects[name]

    # 在后台线程中执行部署
    thread = threading.Thread(
        target=run_deploy,
        args=(name, project_config),
        daemon=True,
    )
    thread.start()

    return {"message": f"项目 {name} 部署已触发", "status": "deploying"}


# ──────────────────────────────────────────────
# HuggingFace Spaces API
# ──────────────────────────────────────────────
@app.get("/api/hf/spaces")
async def list_hf_spaces():
    """
    获取 HuggingFace Spaces 列表
    """
    if not HF_TOKEN:
        raise HTTPException(status_code=500, detail="未配置 HF_TOKEN 环境变量")
    if not HF_USER:
        raise HTTPException(status_code=500, detail="未配置 HF_USER 环境变量")

    url = f"https://huggingface.co/api/spaces?author={HF_USER}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {HF_TOKEN}",
            "User-Agent": "GitHub-Mirror/2.0.0",
        },
    )

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            spaces = []
            for s in data:
                spaces.append({
                    "id": s.get("id", ""),
                    "name": s.get("id", "").split("/")[-1] if s.get("id") else "",
                    "author": s.get("author", ""),
                    "sha": s.get("sha", ""),
                    "last_modified": s.get("lastModified", ""),
                    "private": s.get("private", False),
                    "sdk": s.get("sdk", ""),
                    "url": f"https://huggingface.co/spaces/{s.get('id', '')}",
                })
            return spaces
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=e.code, detail=f"获取 HF Spaces 失败: {raw}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取 HF Spaces 异常: {str(e)}")


# ──────────────────────────────────────────────
# Stats API
# ──────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "version": __version__}


@app.get("/api/stats")
async def get_stats():
    """
    获取服务统计信息
    """
    projects = load_projects()
    total = len(projects)
    success = sum(1 for p in projects.values() if p.get("status") == "success")
    error = sum(1 for p in projects.values() if p.get("status") == "error")
    deploying = sum(1 for p in projects.values() if p.get("status") == "deploying")

    return {
        "projects_total": total,
        "projects_success": success,
        "projects_error": error,
        "projects_deploying": deploying,
        "version": __version__,
    }


# ──────────────────────────────────────────────
# Static Files & Index
# ──────────────────────────────────────────────
# 挂载静态文件目录
if os.path.isdir(STATIC_DIR):
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/", response_class=HTMLResponse)
async def serve_index():
    """
    提供前端入口页面
    """
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse(content="<h1>GitHub Mirror</h1><p>前端文件未找到，请构建前端项目。</p>", status_code=200)


# ──────────────────────────────────────────────
# 全局异常处理
# ──────────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"服务器内部错误: {str(exc)}", "status_code": 500},
    )


# ──────────────────────────────────────────────
# 启动事件
# ──────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    print(f"GitHub Mirror v{__version__} 启动中...")
    print(f"GitHub 用户: {GITHUB_USER or '未配置'}")
    print(f"HF 用户: {HF_USER or '未配置'}")
    print(f"数据目录: {DATA_DIR}")
    print(f"静态文件目录: {STATIC_DIR}")
    print("GitHub Mirror 启动完成！")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
