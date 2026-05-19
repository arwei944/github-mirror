"""
数据库连接与初始化模块
管理 SQLite 数据库连接和表结构
"""
import os
import sqlite3
import threading
import logging
from pathlib import Path

logger = logging.getLogger("github-mirror.db")

_db_path: str = ""
_db_lock = threading.Lock()


def init_db(data_dir: str = ""):
    """
    初始化数据库，创建必要的表结构
    从 app.py 的 init_sync_db() 迁移而来
    """
    global _db_path
    if not data_dir:
        from ..config import settings
        data_dir = settings.data_dir

    Path(data_dir).mkdir(parents=True, exist_ok=True)
    _db_path = os.path.join(data_dir, "sync.db")

    with _db_lock:
        conn = get_connection()
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
            CREATE INDEX IF NOT EXISTS idx_issues_repo ON issues_data(repo_name);
        """)
        conn.commit()
        conn.close()
        logger.info(f"数据库已初始化: {_db_path}")


def get_connection() -> sqlite3.Connection:
    """获取数据库连接"""
    conn = sqlite3.connect(_db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn
