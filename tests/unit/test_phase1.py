"""
Phase 1 单元测试
覆盖 config、errors、github_client、db
"""
import os
import pytest
from pathlib import Path


# ═══════════════════════════════════════════════════════════
#  config 测试
# ═══════════════════════════════════════════════════════════

class TestConfig:
    def test_default_version(self):
        from backend.config import settings
        assert settings.app_version == "7.5.0"

    def test_load_from_env(self, monkeypatch):
        monkeypatch.setenv("GITHUB_TOKEN", "test_token_123")
        monkeypatch.setenv("GITHUB_USER", "testuser")
        monkeypatch.setenv("HF_TOKEN", "hf_test")
        # 需要重新导入以触发 BaseSettings 加载
        import importlib
        from backend import config
        importlib.reload(config)
        assert config.settings.github_token == "test_token_123"
        assert config.settings.github_user == "testuser"
        assert config.settings.hf_token == "hf_test"

    def test_rate_limit_defaults(self):
        from backend.config import settings
        assert settings.rate_limit_enabled is True
        assert settings.rate_limit_max == 120
        assert settings.rate_limit_window == 60

    def test_data_dir_default(self):
        from backend.config import settings
        assert "data" in settings.data_dir

    def test_cors_origins_default(self):
        from backend.config import settings
        assert settings.cors_origins == "*"


# ═══════════════════════════════════════════════════════════
#  errors 测试
# ═══════════════════════════════════════════════════════════

class TestErrors:
    def test_app_error_base(self):
        from backend.core.errors import AppError
        err = AppError("TEST_ERROR", "test message", 400)
        assert err.code == "TEST_ERROR"
        assert err.message == "test message"
        assert err.status == 400

    def test_github_token_missing(self):
        from backend.core.errors import GitHubTokenMissing
        err = GitHubTokenMissing()
        assert err.code == "GITHUB_TOKEN_MISSING"
        assert err.status == 500

    def test_github_api_error(self):
        from backend.core.errors import GitHubAPIError
        err = GitHubAPIError(404, "Not Found")
        assert err.code == "GITHUB_API_ERROR"
        assert err.status == 404
        assert "Not Found" in err.message

    def test_resource_not_found(self):
        from backend.core.errors import ResourceNotFound
        err = ResourceNotFound("repo/test")
        assert err.code == "NOT_FOUND"
        assert err.status == 404

    def test_validation_error(self):
        from backend.core.errors import ValidationError
        err = ValidationError("invalid input")
        assert err.status == 400

    def test_rate_limit_exceeded(self):
        from backend.core.errors import RateLimitExceeded
        err = RateLimitExceeded(100, 60)
        assert err.status == 429

    def test_shell_command_rejected(self):
        from backend.core.errors import ShellCommandRejected
        err = ShellCommandRejected("dangerous command")
        assert err.status == 403

    def test_error_codes_mapping(self):
        from backend.core.errors import ERROR_CODES
        assert ERROR_CODES["GITHUB_TOKEN_MISSING"] == 1001
        assert ERROR_CODES["GITHUB_API_ERROR"] == 1002
        assert ERROR_CODES["NOT_FOUND"] == 1005

    def test_setup_error_handlers(self):
        from fastapi import FastAPI
        from backend.core.errors import setup_error_handlers
        app = FastAPI()
        setup_error_handlers(app)
        # 验证异常处理器已注册（不抛异常即通过）
        assert True


# ═══════════════════════════════════════════════════════════
#  github_client 测试
# ═══════════════════════════════════════════════════════════

class TestGitHubClient:
    def test_init(self):
        from backend.clients.github_client import GitHubClient
        client = GitHubClient(token="test_token", base_url="https://api.github.com")
        assert client._token == "test_token"
        assert client._client is None

    def test_client_property_raises_before_start(self):
        from backend.clients.github_client import GitHubClient
        client = GitHubClient(token="test_token")
        with pytest.raises(RuntimeError, match="未启动"):
            _ = client.client

    @pytest.mark.asyncio
    async def test_start_stop(self):
        from backend.clients.github_client import GitHubClient
        client = GitHubClient(token="test_token")
        await client.start()
        assert client._client is not None
        await client.stop()
        assert client._client is None


# ═══════════════════════════════════════════════════════════
#  db 测试
# ═══════════════════════════════════════════════════════════

class TestDatabase:
    def test_init_db(self, tmp_path):
        from backend.db.connection import init_db, get_connection
        init_db(str(tmp_path))
        conn = get_connection()
        # 验证表已创建
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        table_names = [t["name"] for t in tables]
        assert "sync_status" in table_names
        assert "repo_data" in table_names
        assert "issues_data" in table_names
        conn.close()

    def test_get_connection(self, tmp_path):
        from backend.db.connection import init_db, get_connection
        init_db(str(tmp_path))
        conn = get_connection()
        assert conn is not None
        conn.close()


# ═══════════════════════════════════════════════════════════
#  main app 测试
# ═══════════════════════════════════════════════════════════

class TestMainApp:
    def test_app_creation(self):
        from backend.main import app
        assert app.version == "7.5.0"
        assert app.title == "GitHub Mirror"

    def test_health_endpoint(self, monkeypatch):
        from backend.main import app
        from fastapi.testclient import TestClient
        # 设置临时数据目录
        monkeypatch.setenv("DATA_DIR", "/tmp/test_github_mirror_data")
        client = TestClient(app)
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["version"] == "7.5.0"

    def test_api_health_endpoint(self, monkeypatch):
        from backend.main import app
        from fastapi.testclient import TestClient
        monkeypatch.setenv("DATA_DIR", "/tmp/test_github_mirror_data")
        client = TestClient(app)
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
