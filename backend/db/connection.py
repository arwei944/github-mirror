"""
GitHub Mirror - Database Connection
Extracted from app.py (lines 160-216).
"""

import logging
import os
import sqlite3
import threading
from pathlib import Path

from backend.config import settings

logger = logging.getLogger("github-mirror.db")

_sync_db_lock = threading.Lock()


def get_sync_db() -> sqlite3.Connection:
    db_path = settings.sync_db_path
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_sync_db() -> None:
    data_dir = settings.data_dir
    Path(data_dir).mkdir(parents=True, exist_ok=True)
    with _sync_db_lock:
        conn = get_sync_db()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sync_status (
                repo_name TEXT PRIMARY KEY, status TEXT DEFAULT 'idle',
                total_files INTEGER DEFAULT 0, synced_files INTEGER DEFAULT 0,
                sync_dir TEXT, last_sync TEXT, error TEXT,
                started_at TEXT, completed_at TEXT
            );
            CREATE TABLE IF NOT EXISTS repo_data (
                repo_name TEXT PRIMARY KEY, data_json TEXT, updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS issues_data (
                repo_name TEXT, issue_number INTEGER, data_json TEXT,
                updated_at TEXT, PRIMARY KEY (repo_name, issue_number)
            );
            CREATE TABLE IF NOT EXISTS prs_data (
                repo_name TEXT, pr_number INTEGER, data_json TEXT,
                updated_at TEXT, PRIMARY KEY (repo_name, pr_number)
            );
            CREATE TABLE IF NOT EXISTS commits_data (
                repo_name TEXT, sha TEXT, data_json TEXT,
                updated_at TEXT, PRIMARY KEY (repo_name, sha)
            );
        """)
        conn.commit()
        conn.close()
        logger.info("Sync database initialized at %s", settings.sync_db_path)
