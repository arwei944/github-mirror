"""
升级版缓存层
支持 LRU 淘汰策略、TTL 过期、可选 Redis 后端
"""
import time
import hashlib
import json
import logging
import threading
from collections import OrderedDict
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger("github-mirror.cache")


class CacheEntry:
    """缓存条目"""
    __slots__ = ("value", "expiry", "created_at", "access_count", "last_access")

    def __init__(self, value: bytes, ttl: int):
        self.value = value
        self.expiry = time.time() + ttl
        self.created_at = time.time()
        self.access_count = 0
        self.last_access = time.time()

    @property
    def is_expired(self) -> bool:
        return time.time() > self.expiry

    def touch(self):
        self.access_count += 1
        self.last_access = time.time()


class MemoryCache:
    """
    内存缓存 - LRU + TTL
    线程安全，支持并发读写
    """

    def __init__(self, max_size: int = 2000, default_ttl: int = 300):
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._store: OrderedDict[str, CacheEntry] = OrderedDict()
        self._lock = threading.Lock()
        self._stats = {"hits": 0, "misses": 0, "evictions": 0}

    def get(self, key: str) -> Optional[bytes]:
        """获取缓存值"""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._stats["misses"] += 1
                return None
            if entry.is_expired:
                del self._store[key]
                self._stats["misses"] += 1
                return None
            # LRU: 移动到末尾
            self._store.move_to_end(key)
            entry.touch()
            self._stats["hits"] += 1
            return entry.value

    def set(self, key: str, value: bytes, ttl: Optional[int] = None):
        """设置缓存值"""
        if ttl is None:
            ttl = self._default_ttl
        with self._lock:
            if key in self._store:
                del self._store[key]
            elif len(self._store) >= self._max_size:
                self._evict()
            self._store[key] = CacheEntry(value, ttl)

    def delete(self, key: str):
        """删除缓存值"""
        with self._lock:
            self._store.pop(key, None)

    def clear(self):
        """清空缓存"""
        with self._lock:
            self._store.clear()
            self._stats = {"hits": 0, "misses": 0, "evictions": 0}

    def _evict(self):
        """LRU 淘汰：移除最久未访问的条目"""
        if self._store:
            self._store.popitem(last=False)
            self._stats["evictions"] += 1

    def cleanup_expired(self) -> int:
        """清理所有过期条目，返回清理数量"""
        count = 0
        with self._lock:
            expired_keys = [
                k for k, v in self._store.items() if v.is_expired
            ]
            for k in expired_keys:
                del self._store[k]
                count += 1
        if count:
            logger.debug(f"清理过期缓存: {count} 条")
        return count

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._store)

    @property
    def stats(self) -> Dict[str, Any]:
        with self._lock:
            total = self._stats["hits"] + self._stats["misses"]
            hit_rate = self._stats["hits"] / total if total > 0 else 0
            return {
                **self._stats,
                "size": len(self._store),
                "max_size": self._max_size,
                "hit_rate": round(hit_rate, 4),
            }


def make_cache_key(method: str, path: str, query: str = "") -> str:
    """生成缓存键"""
    raw = f"{method}:{path}:{query}"
    return hashlib.md5(raw.encode()).hexdigest()


# 全局缓存实例
cache = MemoryCache()
