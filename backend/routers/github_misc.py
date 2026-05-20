"""
GitHub 杂项路由
search / activity / notifications / graphql / trending
"""
import hashlib
import logging
import os
import re
import time
import urllib.parse
from datetime import datetime, timedelta
from typing import Dict

import httpx
from fastapi import APIRouter, Query, Request, HTTPException
from fastapi.responses import JSONResponse

from ..config import settings
from ..routers.github_proxy import gh_get, gh_post, gh_request
from ..core.shared_state import api_cache

logger = logging.getLogger("github-mirror.routers.github_misc")
router = APIRouter(prefix="/api/github", tags=["github-misc"])


# ═══════════════════════════════════════════════════════════
#  辅助函数
# ═══════════════════════════════════════════════════════════

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
    "McpToolCallEvent": "MCP 工具调用",
    "McpShellEvent": "Shell 命令执行",
    "McpProxyEvent": "HTTP 代理请求",
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
        if commit_count == 0:
            head = payload.get("head", "")
            before = payload.get("before", "")
            if head and before and head != before:
                commit_count = 1
        ref = payload.get("ref", "").replace("refs/heads/", "")
        enriched["action"] = "push"
        enriched["detail"] = f"推送了 {commit_count} 个提交到 {ref}" if commit_count > 0 else f"推送到 {ref}"
        enriched["commit_count"] = commit_count
        enriched["ref"] = payload.get("ref", "")
        enriched["commit_messages"] = [
            {"sha": c.get("sha", "")[:7], "message": c.get("message", "").split("\n")[0]}
            for c in (commits or [])[:5]
        ]
        enriched["head_sha"] = payload.get("head", "")[:7]

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
        enriched["issue_body"] = (issue.get("body", "") or "")[:200]
        enriched["issue_state"] = issue.get("state", "")
        enriched["issue_labels"] = [l.get("name", "") for l in (issue.get("labels", []) or [])[:5]]

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
        enriched["pr_body"] = (pr.get("body", "") or "")[:200]
        enriched["pr_state"] = pr.get("state", "")
        enriched["pr_additions"] = pr.get("additions", 0)
        enriched["pr_deletions"] = pr.get("deletions", 0)
        enriched["pr_changed_files"] = pr.get("changed_files", 0)

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
        enriched["release_body"] = (release.get("body", "") or "")[:200]
        enriched["release_prerelease"] = release.get("prerelease", False)
        enriched["release_draft"] = release.get("draft", False)

    elif event_type == "CreateEvent":
        ref_type = payload.get("ref_type", "")
        ref_name = (payload.get("ref", "") or "").replace("refs/heads/", "")
        enriched["action"] = "created"
        type_map = {"branch": "分支", "tag": "标签", "repository": "仓库"}
        type_label = type_map.get(ref_type, ref_type)
        enriched["detail"] = f"创建了{type_label}: {ref_name}" if ref_name else f"创建了{type_label}"
        enriched["ref_type"] = ref_type
        enriched["ref_name"] = ref_name
        enriched["master_branch"] = payload.get("master_branch", "")

    elif event_type == "DeleteEvent":
        ref_type = payload.get("ref_type", "")
        ref_name = (payload.get("ref", "") or "").replace("refs/heads/", "")
        enriched["action"] = "deleted"
        type_map = {"branch": "分支", "tag": "标签"}
        type_label = type_map.get(ref_type, ref_type)
        enriched["detail"] = f"删除了{type_label}: {ref_name}" if ref_name else f"删除了{type_label}"
        enriched["ref_type"] = ref_type
        enriched["ref_name"] = ref_name

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


class TTLCache:
    """带 TTL 的内存缓存"""
    def __init__(self, default_ttl=300, max_size=1000):
        self._cache: Dict[str, tuple] = {}
        self._default_ttl = default_ttl
        self._max_size = max_size

    def get(self, key: str):
        if key in self._cache:
            value, expire_at = self._cache[key]
            if time.time() < expire_at:
                return value
            del self._cache[key]
        return None

    def set(self, key: str, value, ttl=None):
        if len(self._cache) >= self._max_size and key not in self._cache:
            oldest_key = min(self._cache, key=lambda k: self._cache[k][1])
            del self._cache[oldest_key]
        expire_at = time.time() + (ttl if ttl is not None else self._default_ttl)
        self._cache[key] = (value, expire_at)

    def invalidate(self, prefix: str):
        keys_to_delete = [k for k in self._cache if k.startswith(prefix)]
        for k in keys_to_delete:
            del self._cache[k]

    def clear(self):
        self._cache.clear()


def calculate_query_depth(query_str: str, max_depth: int = 10) -> int:
    """计算 GraphQL 查询深度"""
    depth = 0
    max_seen = 0
    for char in query_str:
        if char == '{':
            depth += 1
            max_seen = max(max_seen, depth)
        elif char == '}':
            depth -= 1
    return max_seen


def calculate_query_complexity(query_str: str, max_complexity: int = 500) -> int:
    """计算 GraphQL 查询复杂度"""
    complexity = 0
    cleaned = re.sub(r'"(?:[^"\\]|\\.)*"', '', query_str)
    cleaned = re.sub(r'#.*$', '', cleaned, flags=re.MULTILINE)
    connections = len(re.findall(r'\b\w+(?:Connection|edges|nodes)\b', cleaned))
    complexity += connections * 10
    objects = len(re.findall(r'\b[A-Z]\w*\b', cleaned))
    complexity += objects * 5
    scalars = len(re.findall(r'\b[a-z_]\w*\s*(?:\(|:|\{|$)', cleaned))
    complexity += scalars * 1
    return complexity


# ═══════════════════════════════════════════════════════════
#  GitHub Activity API
# ═══════════════════════════════════════════════════════════

@router.get("/activity")
async def get_github_activity(
    per_page: int = Query(30, ge=1, le=100),
    page: int = Query(1, ge=1),
):
    """
    获取 GitHub 活动流
    """
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")
    if not settings.github_user:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_USER 环境变量")

    path = f"/users/{settings.github_user}/events?per_page={per_page}&page={page}"
    status, data = gh_get(path)

    if status != 200:
        raise HTTPException(status_code=status, detail=f"获取活动流失败: {data}")

    if not isinstance(data, list):
        raise HTTPException(status_code=500, detail="GitHub API 返回数据格式异常")

    events = [enrich_event(event) for event in data]
    return events


@router.get("/activity/aggregated")
async def get_aggregated_activity(
    per_page: int = Query(50, ge=1, le=100),
):
    """
    获取聚合活动流 - 用户事件 + 所有仓库事件 (v5.4.5)
    """
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")
    if not settings.github_user:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_USER 环境变量")

    all_events = []
    seen_ids = set()

    # 1. 获取用户事件（带 Token 可获取私有仓库的公开活动）
    status, user_events = gh_get(f"/users/{settings.github_user}/events?per_page=30")
    if status == 200 and isinstance(user_events, list):
        for event in user_events:
            if event.get("id") not in seen_ids:
                all_events.append(enrich_event(event))
                seen_ids.add(event.get("id"))

    # 2. 获取用户仓库列表（包含私有仓库）
    status, repos = gh_get(f"/user/repos?per_page=30&sort=updated&type=all")
    if status == 200 and isinstance(repos, list):
        for repo in repos[:10]:
            repo_name = repo.get("name", "")
            if not repo_name:
                continue
            status, repo_events = gh_get(f"/repos/{settings.github_user}/{repo_name}/events?per_page=5")
            if status == 200 and isinstance(repo_events, list):
                for event in repo_events:
                    event_id = event.get("id")
                    if event_id and event_id not in seen_ids:
                        all_events.append(enrich_event(event))
                        seen_ids.add(event_id)

    # 3. 对私有仓库，尝试通过 commits API 获取最近提交作为补充
    status, repos = gh_get(f"/user/repos?per_page=30&sort=updated&type=private")
    if status == 200 and isinstance(repos, list):
        for repo in repos[:5]:
            repo_name = repo.get("name", "")
            if not repo_name:
                continue
            has_events = any(e.get("repo_name") == repo_name for e in all_events)
            if has_events:
                continue
            status, commits = gh_get(f"/repos/{settings.github_user}/{repo_name}/commits?per_page=3")
            if status == 200 and isinstance(commits, list):
                for commit in commits:
                    fake_event = {
                        "id": f"commit-{repo_name}-{commit.get('sha', '')[:8]}",
                        "type": "PushEvent",
                        "repo": {"name": f"{settings.github_user}/{repo_name}"},
                        "payload": {
                            "ref": "refs/heads/main",
                            "head": commit.get("sha", ""),
                            "before": "0000000000000000000000000000000000000000",
                            "commits": [{"message": commit.get("commit", {}).get("message", "")}],
                            "size": 1,
                        },
                        "created_at": commit.get("commit", {}).get("author", {}).get("date", ""),
                        "actor": {"login": commit.get("commit", {}).get("author", {}).get("name", settings.github_user)},
                    }
                    event_id = fake_event["id"]
                    if event_id not in seen_ids:
                        all_events.append(enrich_event(fake_event))
                        seen_ids.add(event_id)

    # 4. 合并 MCP 工具调用事件
    from ..routers.mcp import _mcp_tool_calls
    mcp_events = []
    for call in _mcp_tool_calls[:20]:
        mcp_events.append({
            "id": call["id"],
            "type": call["type"],
            "type_label": call["type_label"],
            "repo_name": call.get("repo_name", ""),
            "full_repo_name": call.get("full_repo_name", ""),
            "created_at": call["created_at"],
            "action": call["action"],
            "detail": call["detail"],
            "url": "",
            "source": "mcp",
            "tool_name": call.get("tool_name", ""),
            "is_error": call.get("is_error", False),
        })
    all_events.extend(mcp_events)

    # 5. 按时间排序
    all_events.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    return all_events[:per_page]


# ═══════════════════════════════════════════════════════════
#  GitHub Notifications API
# ═══════════════════════════════════════════════════════════

@router.get("/notifications")
async def get_github_notifications(
    per_page: int = Query(20, ge=1, le=100),
):
    """
    获取 GitHub 通知列表
    """
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN 环境变量")

    path = f"/notifications?per_page={per_page}"
    status, data = gh_get(path)

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


# ═══════════════════════════════════════════════════════════
#  GitHub Search API (未在 github_repos.py 中的部分)
# ═══════════════════════════════════════════════════════════

@router.get("/search/code")
async def search_code(q: str = Query(..., description="搜索关键词"), per_page: int = Query(30, ge=1, le=100)):
    """搜索代码"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    scoped_q = f"{q} user:{settings.github_user}"
    qs = urllib.parse.urlencode({"q": scoped_q, "per_page": per_page})
    status, data = gh_get(f"/search/code?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"搜索失败: {data}")
    items = data.get("items", []) if isinstance(data, dict) else []
    return {"total_count": data.get("total_count", 0), "items": [{"name": i.get("name", ""), "path": i.get("path", ""), "repository": {"full_name": i.get("repository", {}).get("full_name", ""), "name": i.get("repository", {}).get("name", "")}, "html_url": i.get("html_url", "")} for i in items]}


@router.get("/search")
async def search_github(q: str = Query(..., description="搜索关键词"), per_page: int = Query(30, ge=1, le=100)):
    """通用搜索入口 - 默认搜索仓库（向后兼容 /api/github/search/repositories）"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    scoped_q = f"{q} user:{settings.github_user}"
    qs = urllib.parse.urlencode({"q": scoped_q, "per_page": per_page})
    status, data = gh_get(f"/search/repositories?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"搜索失败: {data}")
    items = data.get("items", []) if isinstance(data, dict) else []
    # 简化的仓库字段过滤
    return {"total_count": data.get("total_count", 0), "items": [{"id": i.get("id"), "name": i.get("name", ""), "full_name": i.get("full_name", ""), "description": i.get("description", ""), "html_url": i.get("html_url", ""), "language": i.get("language", ""), "stargazers_count": i.get("stargazers_count", 0), "forks_count": i.get("forks_count", 0), "private": i.get("private", False), "updated_at": i.get("updated_at", "")} for i in items]}


@router.get("/search/users")
async def search_users(q: str = Query(..., description="搜索关键词"), per_page: int = Query(30, ge=1, le=100)):
    """搜索用户"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    qs = urllib.parse.urlencode({"q": q, "per_page": per_page})
    status, data = gh_get(f"/search/users?{qs}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"搜索失败: {data}")
    items = data.get("items", []) if isinstance(data, dict) else []
    return {"total_count": data.get("total_count", 0), "items": [{"login": i.get("login", ""), "id": i.get("id", 0), "avatar_url": i.get("avatar_url", ""), "html_url": i.get("html_url", ""), "type": i.get("type", ""), "score": i.get("score", 0)} for i in items]}


@router.get("/search/labels")
async def search_labels(repo_name: str, q: str = Query(..., description="搜索关键词"), per_page: int = Query(30, ge=1, le=100)):
    """搜索仓库标签"""
    if not settings.github_token:
        raise HTTPException(status_code=500, detail="未配置 GITHUB_TOKEN")
    owner = settings.github_user
    status, data = gh_get(f"/search/labels?q={urllib.parse.quote(q)}&repository_id={owner}%2F{repo_name}&per_page={per_page}")
    if status != 200:
        raise HTTPException(status_code=status, detail=f"搜索失败: {data}")
    items = data.get("items", []) if isinstance(data, dict) else []
    return {"total_count": data.get("total_count", 0), "items": [{"id": i.get("id", 0), "name": i.get("name", ""), "color": i.get("color", ""), "description": i.get("description", "")} for i in items]}


# ═══════════════════════════════════════════════════════════
#  GitHub GraphQL Proxy
# ═══════════════════════════════════════════════════════════

GITHUB_GRAPHQL_URL = "https://api.github.com/graphql"
GRAPHQL_CACHE = TTLCache(default_ttl=60)


@router.post("/graphql")
async def graphql_proxy(request: Request):
    """GraphQL 代理端点 (v5.1.0)"""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    query = body.get("query", "")
    variables = body.get("variables", {})
    operation_name = body.get("operationName")

    if not query:
        raise HTTPException(status_code=400, detail="Missing 'query' field")

    # Depth check
    depth = calculate_query_depth(query)
    if depth > 10:
        raise HTTPException(status_code=400, detail={
            "error": "Query too deep",
            "code": 1006,
            "detail": f"depth: {depth}, max: 10"
        })

    # Complexity check
    complexity = calculate_query_complexity(query)
    if complexity > 500:
        raise HTTPException(status_code=400, detail={
            "error": "Query too complex",
            "code": 1006,
            "detail": f"complexity: {complexity}, max: 500"
        })

    # Cache check
    import json as _json
    cache_key = hashlib.md5(f"{query}{_json.dumps(variables, sort_keys=True)}".encode()).hexdigest()
    cached = GRAPHQL_CACHE.get(cache_key)
    if cached is not None:
        return cached

    # Forward to GitHub GraphQL API
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise HTTPException(status_code=500, detail="GITHUB_TOKEN not configured")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    if operation_name:
        payload["operationName"] = operation_name

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(GITHUB_GRAPHQL_URL, json=payload, headers=headers)

    data = resp.json()
    GRAPHQL_CACHE.set(cache_key, data, ttl=60)
    return data


# ═══════════════════════════════════════════════════════════
#  GitHub Trending API
# ═══════════════════════════════════════════════════════════

@router.get("/trending")
async def get_trending_repos(
    language: str = Query("", description="编程语言过滤"),
    since: str = Query("daily", description="时间范围: daily, weekly, monthly"),
):
    """获取 GitHub 热门项目 (v5.4.2) - 通过搜索 API 模拟"""
    query_parts = ["stars:>100", "fork:true"]
    if language:
        query_parts.append(f"language:{language}")

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
