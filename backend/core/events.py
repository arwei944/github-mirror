"""
异步事件总线
替代全局可变状态，实现发布/订阅模式
"""
import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, Optional, List, Any, Dict

logger = logging.getLogger("github-mirror.events")


# ═══════════════════════════════════════════════════════════
#  事件类型常量
# ═══════════════════════════════════════════════════════════

class EventType:
    GITHUB_WEBHOOK = "github.webhook"
    HF_WEBHOOK = "hf.webhook"
    MCP_TOOL_CALL = "mcp.tool_call"
    MCP_SHELL_EXEC = "mcp.shell_exec"
    MCP_PROXY_REQUEST = "mcp.proxy_request"
    DEPLOY_START = "deploy.start"
    DEPLOY_COMPLETE = "deploy.complete"
    SYNC_START = "sync.start"
    SYNC_COMPLETE = "sync.complete"
    CACHE_INVALIDATE = "cache.invalidate"
    SYSTEM_ERROR = "system.error"
    SYSTEM_STARTUP = "system.startup"
    SYSTEM_SHUTDOWN = "system.shutdown"


# ═══════════════════════════════════════════════════════════
#  事件对象
# ═══════════════════════════════════════════════════════════

@dataclass
class Event:
    """事件对象"""
    type: str
    data: Dict[str, Any]
    source: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    id: str = field(default="")

    def __post_init__(self):
        if not self.id:
            import uuid
            self.id = uuid.uuid4().hex[:12]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "data": self.data,
            "source": self.source,
            "timestamp": self.timestamp,
        }


# ═══════════════════════════════════════════════════════════
#  事件总线
# ═══════════════════════════════════════════════════════════

class EventBus:
    """异步事件总线 - 单例模式"""

    def __init__(self, max_history: int = 500):
        self._handlers: Dict[str, List[Callable]] = defaultdict(list)
        self._wildcard_handlers: List[Callable] = []
        self._history: List[Event] = []
        self._max_history = max_history
        self._lock = asyncio.Lock()

    def subscribe(self, event_type: str, handler: Callable):
        """订阅指定类型的事件"""
        self._handlers[event_type].append(handler)
        logger.debug(f"事件订阅: {event_type} -> {handler.__name__}")

    def subscribe_all(self, handler: Callable):
        """订阅所有事件（通配符）"""
        self._wildcard_handlers.append(handler)

    def unsubscribe(self, event_type: str, handler: Callable):
        """取消订阅"""
        if handler in self._handlers.get(event_type, []):
            self._handlers[event_type].remove(handler)

    async def publish(self, event: Event):
        """
        发布事件
        异步调用所有订阅者，错误不影响其他订阅者
        """
        # 记录历史
        async with self._lock:
            self._history.insert(0, event)
            if len(self._history) > self._max_history:
                self._history = self._history[:self._max_history]

        # 通知特定类型订阅者
        handlers = self._handlers.get(event.type, [])
        # 通知通配符订阅者
        all_handlers = handlers + self._wildcard_handlers

        if all_handlers:
            tasks = [self._safe_call(handler, event) for handler in all_handlers]
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _safe_call(self, handler: Callable, event: Event):
        """安全调用事件处理器"""
        try:
            result = handler(event)
            if asyncio.iscoroutine(result):
                await result
        except Exception as e:
            logger.error(f"事件处理器错误 [{event.type}]: {e}")

    def get_history(
        self,
        event_type: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """获取事件历史"""
        events = self._history
        if event_type:
            events = [e for e in events if e.type == event_type]
        return [e.to_dict() for e in events[:limit]]

    def get_recent(self, limit: int = 20) -> List[Dict[str, Any]]:
        """获取最近的事件"""
        return [e.to_dict() for e in self._history[:limit]]

    @property
    def event_types(self) -> List[str]:
        """获取所有已注册的事件类型"""
        return list(self._handlers.keys())

    def clear_history(self):
        """清空事件历史"""
        self._history.clear()


# 全局单例
event_bus = EventBus()
