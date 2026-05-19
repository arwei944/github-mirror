"""
MCP 活动记录模块

从 app.py 中提取的 EVENT_TYPE_LABELS、enrich_event 和 _record_mcp_tool_call，
供 MCP 工具调用后记录活动流使用。
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional


# ── 事件类型中文标签 (app.py line 691-706) ──────────────────────────

EVENT_TYPE_LABELS: Dict[str, str] = {
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


# ── enrich_event (app.py line 709-860) ──────────────────────────────

def enrich_event(event: dict) -> dict:
    """丰富事件数据，添加中文标签和详细信息。"""
    event_type = event.get("type", "")
    payload = event.get("payload", {})
    repo = event.get("repo", {})
    repo_name = repo.get("name", "").split("/")[-1] if repo.get("name") else ""
    full_repo_name = repo.get("name", "")
    created_at = event.get("created_at", "")

    enriched: Dict[str, Any] = {
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


# ── MCP 工具调用记录 (app.py line 5226-5281) ────────────────────────

MCP_TOOL_CALLS_MAX: int = 200


def record_mcp_tool_call(
    tool_name: str,
    arguments: dict,
    result: dict,
    session_id: str = "",
    mcp_tool_calls_list: Optional[List[dict]] = None,
    success: bool = True,
) -> dict:
    """记录 MCP 工具调用到活动流。"""
    if mcp_tool_calls_list is None:
        mcp_tool_calls_list = []

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
    elif "name" in arguments:
        arg_summary = arguments["name"]

    event = {
        "id": f"mcp-{tool_name}-{len(mcp_tool_calls_list)}",
        "source": "mcp",
        "type": event_type,
        "type_label": EVENT_TYPE_LABELS.get(event_type, event_type),
        "tool_name": tool_name,
        "arguments": {k: v for k, v in arguments.items() if k not in ("token", "password", "secret")},
        "result_summary": result_text,
        "is_error": is_error,
        "success": success and not is_error,
        "session_id": session_id,
        "arg_summary": arg_summary,
        "detail": f"调用工具 {tool_name}" + (f": {arg_summary}" if arg_summary else ""),
        "repo_name": arguments.get("repo_name", ""),
        "full_repo_name": arguments.get("repo_name", ""),
        "created_at": datetime.now().isoformat(),
        "action": "called" if success else "failed",
    }

    mcp_tool_calls_list.insert(0, event)
    if len(mcp_tool_calls_list) > MCP_TOOL_CALLS_MAX:
        mcp_tool_calls_list.pop()

    return event
