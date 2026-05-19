"""
Phase 4 单元测试
覆盖事件总线、升级版缓存、审计日志
"""
import asyncio
import pytest
from backend.core.events import EventBus, Event, EventType, event_bus
from backend.core.cache_v2 import MemoryCache, make_cache_key, cache
from backend.core.audit import AuditLog, audit_log


# ═══════════════════════════════════════════════════════════
#  事件总线测试
# ═══════════════════════════════════════════════════════════

class TestEventBus:
    def test_event_creation(self):
        e = Event(type="test.event", data={"key": "value"})
        assert e.type == "test.event"
        assert e.data == {"key": "value"}
        assert e.timestamp
        assert e.id
        assert len(e.id) == 12

    def test_event_to_dict(self):
        e = Event(type="test", data={"a": 1}, source="test_src")
        d = e.to_dict()
        assert d["type"] == "test"
        assert d["data"]["a"] == 1
        assert d["source"] == "test_src"
        assert "timestamp" in d
        assert "id" in d

    @pytest.mark.asyncio
    async def test_publish_subscribe(self):
        bus = EventBus()
        received = []
        async def handler(event):
            received.append(event)
        bus.subscribe("test.event", handler)
        await bus.publish(Event(type="test.event", data={"msg": "hello"}))
        assert len(received) == 1
        assert received[0].data["msg"] == "hello"

    @pytest.mark.asyncio
    async def test_subscribe_all(self):
        bus = EventBus()
        received = []
        async def handler(event):
            received.append(event.type)
        bus.subscribe_all(handler)
        await bus.publish(Event(type="event.a", data={}))
        await bus.publish(Event(type="event.b", data={}))
        assert len(received) == 2

    @pytest.mark.asyncio
    async def test_handler_error_doesnt_break_others(self):
        bus = EventBus()
        received = []
        async def bad_handler(event):
            raise ValueError("oops")
        async def good_handler(event):
            received.append("ok")
        bus.subscribe("test", bad_handler)
        bus.subscribe("test", good_handler)
        await bus.publish(Event(type="test", data={}))
        assert len(received) == 1

    def test_get_history(self):
        bus = EventBus()
        bus._history = [
            Event(type="a", data={}),
            Event(type="b", data={}),
            Event(type="a", data={}),
        ]
        all_events = bus.get_history(limit=10)
        assert len(all_events) == 3
        a_events = bus.get_history(event_type="a")
        assert len(a_events) == 2

    def test_max_history(self):
        bus = EventBus(max_history=3)
        # 通过截断模拟 publish 的行为
        for i in range(5):
            bus._history.insert(0, Event(type="test", data={"i": i}))
            bus._history = bus._history[:bus._max_history]
        assert len(bus._history) == 3
        assert bus._history[0].data["i"] == 4  # 最新的在前

    def test_event_types(self):
        bus = EventBus()
        bus.subscribe("type.a", lambda e: None)
        bus.subscribe("type.b", lambda e: None)
        types = bus.event_types
        assert "type.a" in types
        assert "type.b" in types

    def test_unsubscribe(self):
        bus = EventBus()
        handler = lambda e: None
        bus.subscribe("test", handler)
        bus.unsubscribe("test", handler)
        assert len(bus._handlers["test"]) == 0

    def test_clear_history(self):
        bus = EventBus()
        bus._history.append(Event(type="test", data={}))
        bus.clear_history()
        assert len(bus._history) == 0


# ═══════════════════════════════════════════════════════════
#  缓存测试
# ═══════════════════════════════════════════════════════════

class TestMemoryCache:
    def test_set_get(self):
        c = MemoryCache(max_size=10)
        c.set("key1", b"value1")
        assert c.get("key1") == b"value1"

    def test_miss(self):
        c = MemoryCache()
        assert c.get("nonexistent") is None

    def test_delete(self):
        c = MemoryCache()
        c.set("key1", b"value1")
        c.delete("key1")
        assert c.get("key1") is None

    def test_clear(self):
        c = MemoryCache()
        c.set("a", b"1")
        c.set("b", b"2")
        c.clear()
        assert c.size == 0

    def test_lru_eviction(self):
        c = MemoryCache(max_size=3)
        c.set("a", b"1")
        c.set("b", b"2")
        c.set("c", b"3")
        c.set("d", b"4")  # 应淘汰 "a"
        assert c.get("a") is None
        assert c.get("d") == b"4"

    def test_ttl_expiry(self):
        c = MemoryCache(default_ttl=0)  # 立即过期
        c.set("key", b"value", ttl=0)
        import time
        time.sleep(0.01)
        assert c.get("key") is None

    def test_custom_ttl(self):
        c = MemoryCache(default_ttl=300)
        c.set("key", b"value", ttl=100)
        assert c.get("key") == b"value"

    def test_stats(self):
        c = MemoryCache()
        c.set("a", b"1")
        c.get("a")  # hit
        c.get("b")  # miss
        stats = c.stats
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["size"] == 1

    def test_cleanup_expired(self):
        c = MemoryCache(default_ttl=0)
        c.set("a", b"1", ttl=0)
        c.set("b", b"2", ttl=0)
        import time
        time.sleep(0.01)
        count = c.cleanup_expired()
        assert count == 2
        assert c.size == 0

    def test_make_cache_key(self):
        key = make_cache_key("GET", "/api/test", "page=1")
        assert isinstance(key, str)
        assert len(key) == 32  # MD5 hex


# ═══════════════════════════════════════════════════════════
#  审计日志测试
# ═══════════════════════════════════════════════════════════

class TestAuditLog:
    def test_log_and_get(self):
        al = AuditLog()
        al.log("tool_call", "list_repos", status="success")
        entries = al.get_entries()
        assert len(entries) == 1
        assert entries[0]["action"] == "tool_call"
        assert entries[0]["target"] == "list_repos"

    def test_filter_by_action(self):
        al = AuditLog()
        al.log("tool_call", "a", status="success")
        al.log("shell_exec", "b", status="success")
        entries = al.get_entries(action="tool_call")
        assert len(entries) == 1
        assert entries[0]["target"] == "a"

    def test_filter_by_status(self):
        al = AuditLog()
        al.log("tool_call", "a", status="success")
        al.log("tool_call", "b", status="error")
        entries = al.get_entries(status="error")
        assert len(entries) == 1

    def test_stats(self):
        al = AuditLog()
        al.log("tool_call", "a", status="success")
        al.log("tool_call", "b", status="error")
        al.log("shell_exec", "c", status="success")
        stats = al.get_stats()
        assert stats["total_entries"] == 3
        assert stats["by_action"]["tool_call"] == 2
        assert stats["by_status"]["success"] == 2
        assert stats["by_status"]["error"] == 1

    def test_max_entries(self):
        al = AuditLog(max_entries=5)
        for i in range(10):
            al.log("test", str(i))
        assert len(al.get_entries(limit=100)) == 5

    def test_clear(self):
        al = AuditLog()
        al.log("test", "a")
        al.clear()
        assert len(al.get_entries()) == 0

    def test_entry_to_dict(self):
        from backend.core.audit import AuditEntry
        e = AuditEntry(action="test", target="t", status="ok")
        d = e.to_dict()
        assert d["action"] == "test"
        assert "timestamp" in d
