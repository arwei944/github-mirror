"""
审计日志模块
记录 MCP 工具调用、Shell 执行、代理请求等关键操作
"""
import logging
import threading
from collections import deque
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, List, Dict, Any

logger = logging.getLogger("github-mirror.audit")


@dataclass
class AuditEntry:
    """审计日志条目"""
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    action: str = ""           # tool_call / shell_exec / proxy_request / api_access
    actor: str = ""            # 执行者 (IP / user / system)
    target: str = ""           # 目标 (工具名 / 命令 / URL)
    status: str = "success"    # success / error / rejected
    detail: str = ""           # 详情
    duration_ms: int = 0       # 执行耗时
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class AuditLog:
    """
    审计日志 - 线程安全的环形缓冲区
    保留最近 N 条记录
    """

    def __init__(self, max_entries: int = 1000):
        self._entries: deque = deque(maxlen=max_entries)
        self._lock = threading.Lock()

    def log(
        self,
        action: str,
        target: str,
        status: str = "success",
        actor: str = "system",
        detail: str = "",
        duration_ms: int = 0,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """记录审计日志"""
        entry = AuditEntry(
            action=action,
            actor=actor,
            target=target,
            status=status,
            detail=detail,
            duration_ms=duration_ms,
            metadata=metadata or {},
        )
        with self._lock:
            self._entries.append(entry)

        # 同时写入标准日志
        level = logging.INFO if status == "success" else logging.WARNING
        logger.log(level, f"[AUDIT] {action} | {target} | {status} | {detail[:100]}")

    def get_entries(
        self,
        action: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """查询审计日志"""
        with self._lock:
            entries = list(self._entries)

        if action:
            entries = [e for e in entries if e.action == action]
        if status:
            entries = [e for e in entries if e.status == status]

        return [e.to_dict() for e in entries[-limit:]]

    def get_stats(self) -> Dict[str, Any]:
        """获取审计统计"""
        with self._lock:
            entries = list(self._entries)

        total = len(entries)
        by_action: Dict[str, int] = {}
        by_status: Dict[str, int] = {}
        for e in entries:
            by_action[e.action] = by_action.get(e.action, 0) + 1
            by_status[e.status] = by_status.get(e.status, 0) + 1

        return {
            "total_entries": total,
            "by_action": by_action,
            "by_status": by_status,
        }

    def clear(self):
        """清空审计日志"""
        with self._lock:
            self._entries.clear()


# 全局审计日志实例
audit_log = AuditLog()
