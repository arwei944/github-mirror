"""
共享状态模块
集中管理从 app.py 迁移出的全局状态和辅助函数
供 webhook/sync/system 等路由模块引用
"""
import asyncio
import hashlib
import hmac
import json
import logging
import os
import shutil
import sqlite3
import subprocess
import threading
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

from ..config import settings

logger = logging.getLogger("github-mirror.shared_state")

# ═══════════════════════════════════════════════════════════
#  路径常量
# ═══════════════════════════════════════════════════════════

DATA_DIR = settings.data_dir
SYNC_DB_PATH = os.path.join(DATA_DIR, "sync.db")
PROJECTS_FILE = os.path.join(DATA_DIR, "projects.json")


# ═══════════════════════════════════════════════════════════
#  Webhook 状态
# ═══════════════════════════════════════════════════════════

_webhook_events: list = []
_WEBHOOK_MAX_EVENTS = 100
_state_lock = asyncio.Lock()

# 事件队列（供 SSE/WebSocket 消费）
event_queue: deque = deque(maxlen=100)


# ═══════════════════════════════════════════════════════════
#  WebSocket 管理器
# ═══════════════════════════════════════════════════════════

class ConnectionManager:
    """WebSocket 连接管理器"""

    def __init__(self):
        self.active_connections: list = []

    async def connect(self, websocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        disconnected = []
        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except Exception:
                disconnected.append(conn)
        for conn in disconnected:
            self.disconnect(conn)

    @property
    def count(self):
        return len(self.active_connections)


ws_manager = ConnectionManager()


# ═══════════════════════════════════════════════════════════
#  缓存
# ═══════════════════════════════════════════════════════════

class SimpleTTLCache:
    """简单 TTL 缓存（兼容 app.py 的 api_cache 接口）"""

    def __init__(self, default_ttl: int = 300, max_size: int = 2000):
        self._store: dict = {}
        self._default_ttl = default_ttl
        self._max_size = max_size

    def get(self, key: str):
        entry = self._store.get(key)
        if entry is None:
            return None
        if entry["expires"] < time.time():
            del self._store[key]
            return None
        return entry["value"]

    def set(self, key: str, value, ttl: int = None):
        import time
        if len(self._store) >= self._max_size:
            self._store.pop(next(iter(self._store)))
        self._store[key] = {
            "value": value,
            "expires": time.time() + (ttl or self._default_ttl),
        }

    def invalidate(self, pattern: str):
        """按前缀失效"""
        keys_to_delete = [k for k in self._store if k.startswith(pattern)]
        for k in keys_to_delete:
            del self._store[k]

    def clear(self):
        self._store.clear()

    @property
    def stats(self):
        import time
        now = time.time()
        valid = sum(1 for e in self._store.values() if e["expires"] > now)
        return {"size": valid, "max_size": self._max_size}


api_cache = SimpleTTLCache()


# ═══════════════════════════════════════════════════════════
#  数据库
# ═══════════════════════════════════════════════════════════

_sync_db_lock = threading.Lock()


def get_sync_db() -> sqlite3.Connection:
    """获取同步数据库连接"""
    conn = sqlite3.connect(SYNC_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_sync_db():
    """初始化同步数据库表"""
    with _sync_db_lock:
        conn = get_sync_db()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sync_status (
                repo_name TEXT PRIMARY KEY,
                status TEXT DEFAULT 'idle',
                total_files INTEGER DEFAULT 0,
                synced_files INTEGER DEFAULT 0,
                sync_dir TEXT,
                last_sync TEXT,
                error TEXT,
                started_at TEXT,
                completed_at TEXT
            );
            CREATE TABLE IF NOT EXISTS repo_data (
                repo_name TEXT PRIMARY KEY,
                data_json TEXT,
                updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS issues_data (
                repo_name TEXT,
                issue_number INTEGER,
                data_json TEXT,
                updated_at TEXT,
                PRIMARY KEY (repo_name, issue_number)
            );
            CREATE TABLE IF NOT EXISTS prs_data (
                repo_name TEXT,
                pr_number INTEGER,
                data_json TEXT,
                updated_at TEXT,
                PRIMARY KEY (repo_name, pr_number)
            );
            CREATE TABLE IF NOT EXISTS commits_data (
                repo_name TEXT,
                sha TEXT,
                data_json TEXT,
                updated_at TEXT,
                PRIMARY KEY (repo_name, sha)
            );
            CREATE INDEX IF NOT EXISTS idx_issues_repo ON issues_data(repo_name);
            CREATE INDEX IF NOT EXISTS idx_prs_repo ON prs_data(repo_name);
            CREATE INDEX IF NOT EXISTS idx_commits_repo ON commits_data(repo_name);
        """)
        conn.commit()
        conn.close()


# ═══════════════════════════════════════════════════════════
#  项目管理
# ═══════════════════════════════════════════════════════════

_projects_lock = threading.Lock()


def load_projects() -> dict:
    """加载项目数据"""
    with _projects_lock:
        if os.path.exists(PROJECTS_FILE):
            try:
                with open(PROJECTS_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return {}
        return {}


def save_projects(projects: dict):
    """保存项目数据"""
    with _projects_lock:
        Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
        with open(PROJECTS_FILE, "w", encoding="utf-8") as f:
            json.dump(projects, f, ensure_ascii=False, indent=2)


# ═══════════════════════════════════════════════════════════
#  Webhook 签名验证
# ═══════════════════════════════════════════════════════════

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """验证 GitHub Webhook HMAC 签名"""
    if not WEBHOOK_SECRET:
        return True
    if not signature:
        return False
    expected = "sha256=" + hmac.new(
        WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)


# ═══════════════════════════════════════════════════════════
#  同步逻辑
# ═══════════════════════════════════════════════════════════

async def sync_single_repo(repo_name: str) -> dict:
    """同步单个仓库（git clone）"""
    gh_user = settings.github_user
    if not settings.github_token:
        raise HTTPException(status_code=401, detail="未配置 GITHUB_TOKEN")

    full_name = f"{gh_user}/{repo_name}" if "/" not in repo_name else repo_name
    sync_dir = os.path.join(DATA_DIR, "sync", full_name)
    now = datetime.now(timezone.utc).isoformat()

    conn = get_sync_db()
    conn.execute("INSERT OR REPLACE INTO sync_status VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                 (full_name, "syncing", 0, 0, sync_dir, None, None, now, None))
    conn.commit()
    conn.close()

    try:
        if os.path.exists(sync_dir):
            shutil.rmtree(sync_dir)
        os.makedirs(sync_dir, exist_ok=True)

        clone_url = f"https://{settings.github_token}@github.com/{full_name}.git"
        env = os.environ.copy()

        result = subprocess.run(
            ["git", "clone", "--depth", "1", clone_url, sync_dir],
            capture_output=True, text=True, timeout=600, env=env,
        )
        if result.returncode != 0:
            raise Exception(f"git clone 失败: {result.stderr[:500]}")

        total_files = sum(1 for _, _, files in os.walk(sync_dir) for f in files)

        conn = get_sync_db()
        conn.execute("UPDATE sync_status SET status=?, total_files=?, synced_files=?, last_sync=?, completed_at=?, error=? WHERE repo_name=?",
                     ("completed", total_files, total_files, now, now, None, full_name))
        conn.commit()
        conn.close()

        return {"repo": full_name, "status": "completed", "total_files": total_files, "sync_dir": sync_dir}

    except Exception as e:
        conn = get_sync_db()
        conn.execute("UPDATE sync_status SET status=?, error=?, completed_at=? WHERE repo_name=?",
                     ("error", str(e)[:500], now, full_name))
        conn.commit()
        conn.close()
        raise


async def sync_repo_data(repo_name: str) -> dict:
    """同步仓库 API 数据到本地 SQLite"""
    from .github_proxy import gh_get

    gh_user = settings.github_user
    if not settings.github_token:
        raise HTTPException(status_code=401, detail="未配置 GITHUB_TOKEN")

    full_name = f"{gh_user}/{repo_name}" if "/" not in repo_name else repo_name
    conn = get_sync_db()
    now = datetime.now(timezone.utc).isoformat()

    # 1. 仓库基本信息
    s, repo_data = gh_get(f"/repos/{full_name}")
    if s == 200:
        conn.execute("INSERT OR REPLACE INTO repo_data VALUES (?, ?, ?)",
                     (full_name, json.dumps(repo_data), now))

    # 2. Issues（最近 100 条）
    s, issues = gh_get(f"/repos/{full_name}/issues", params={"state": "all", "per_page": 100, "sort": "updated", "direction": "desc"})
    if s == 200 and isinstance(issues, list):
        for issue in issues:
            if "pull_request" not in issue:
                conn.execute("INSERT OR REPLACE INTO issues_data VALUES (?, ?, ?, ?)",
                             (full_name, issue["number"], json.dumps(issue), now))

    # 3. PRs（最近 100 条）
    s, prs = gh_get(f"/repos/{full_name}/pulls", params={"state": "all", "per_page": 100, "sort": "updated", "direction": "desc"})
    if s == 200 and isinstance(prs, list):
        for pr in prs:
            conn.execute("INSERT OR REPLACE INTO prs_data VALUES (?, ?, ?, ?)",
                         (full_name, pr["number"], json.dumps(pr), now))

    # 4. Commits（最近 100 条）
    s, commits = gh_get(f"/repos/{full_name}/commits", params={"per_page": 100})
    if s == 200 and isinstance(commits, list):
        for c in commits:
            sha = c.get("sha", "")
            conn.execute("INSERT OR REPLACE INTO commits_data VALUES (?, ?, ?, ?)",
                         (full_name, sha, json.dumps(c), now))

    conn.commit()
    conn.close()
    return {"status": "ok", "repo": full_name, "synced_at": now}
