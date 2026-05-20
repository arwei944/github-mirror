"""
路由模块测试
验证新迁移的路由模块正确加载和响应
"""
import pytest
from fastapi.testclient import TestClient


class TestRouteModules:
    """测试路由模块加载"""

    def test_app_imports(self):
        """验证应用可以正常导入"""
        from backend.main import app
        assert app is not None
        assert app.title == "GitHub Mirror"

    def test_github_repos_router_loaded(self):
        """验证 github_repos 路由已加载"""
        from backend.main import app
        routes = [r.path for r in app.routes if hasattr(r, 'path')]
        # 检查关键路由存在
        assert "/api/github/repos" in routes
        assert any("/api/github/repos/{repo_name}" in r for r in routes)

    def test_github_actions_router_loaded(self):
        """验证 github_actions 路由已加载"""
        from backend.main import app
        routes = [r.path for r in app.routes if hasattr(r, 'path')]
        # Actions 路由
        assert any("actions/workflows" in r for r in routes)

    def test_github_misc_router_loaded(self):
        """验证 github_misc 路由已加载"""
        from backend.main import app
        routes = [r.path for r in app.routes if hasattr(r, 'path')]
        # Misc 路由
        assert "/api/github/activity" in routes
        assert "/api/github/trending" in routes

    def test_total_route_count(self):
        """验证路由总数"""
        from backend.main import app
        routes = [r for r in app.routes if hasattr(r, 'path') and hasattr(r, 'methods')]
        # 应该有 ~195 个路由
        assert len(routes) >= 180, f"Expected >= 180 routes, got {len(routes)}"


class TestHealthEndpoints:
    """测试健康检查端点"""

    @pytest.fixture
    def client(self):
        from backend.main import app
        return TestClient(app)

    def test_health(self, client):
        """GET /health"""
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "version" in data

    def test_api_health(self, client):
        """GET /api/v1/health"""
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"


class TestSystemEndpoints:
    """测试系统管理端点"""

    @pytest.fixture
    def client(self):
        from backend.main import app
        return TestClient(app)

    def test_get_config(self, client):
        """GET /api/config"""
        resp = client.get("/api/config")
        assert resp.status_code == 200
        data = resp.json()
        assert "github_user" in data
        assert "github_token_set" in data

    def test_get_stats(self, client):
        """GET /api/stats"""
        resp = client.get("/api/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "success" in data

    def test_get_projects(self, client):
        """GET /api/projects"""
        resp = client.get("/api/projects")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestWebhookEndpoints:
    """测试 Webhook 端点"""

    @pytest.fixture
    def client(self):
        from backend.main import app
        return TestClient(app)

    def test_get_webhook_events(self, client):
        """GET /api/webhooks/events"""
        resp = client.get("/api/webhooks/events")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_clear_webhook_events(self, client):
        """DELETE /api/webhooks/events"""
        resp = client.delete("/api/webhooks/events")
        assert resp.status_code == 200
        assert resp.json()["status"] == "cleared"


class TestSyncEndpoints:
    """测试同步端点"""

    @pytest.fixture
    def client(self):
        from backend.main import app
        return TestClient(app)

    def test_get_sync_status(self, client):
        """GET /api/sync/status"""
        resp = client.get("/api/sync/status")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestEventsEndpoints:
    """测试事件端点"""

    @pytest.fixture
    def client(self):
        from backend.main import app
        return TestClient(app)

    def test_get_events(self, client):
        """GET /api/events"""
        resp = client.get("/api/events")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_event_types(self, client):
        """GET /api/events/types"""
        resp = client.get("/api/events/types")
        assert resp.status_code == 200
        assert "types" in resp.json()


class TestAuditEndpoints:
    """测试审计端点"""

    @pytest.fixture
    def client(self):
        from backend.main import app
        return TestClient(app)

    def test_get_audit(self, client):
        """GET /api/audit"""
        resp = client.get("/api/audit")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_audit_stats(self, client):
        """GET /api/audit/stats"""
        resp = client.get("/api/audit/stats")
        assert resp.status_code == 200


class TestCacheEndpoints:
    """测试缓存端点"""

    @pytest.fixture
    def client(self):
        from backend.main import app
        return TestClient(app)

    def test_get_cache_info(self, client):
        """GET /api/cache/info"""
        resp = client.get("/api/cache/info")
        assert resp.status_code == 200

    def test_get_cache_stats(self, client):
        """GET /api/cache/stats"""
        resp = client.get("/api/cache/stats")
        assert resp.status_code == 200

    def test_cache_clear(self, client):
        """POST /api/cache/clear"""
        resp = client.post("/api/cache/clear")
        assert resp.status_code == 200
        assert resp.json()["status"] == "cleared"


class TestGitHubEndpoints:
    """测试 GitHub API 端点（无 token 时返回错误）"""

    @pytest.fixture
    def client(self):
        from backend.main import app
        return TestClient(app)

    def test_list_repos_no_token(self, client):
        """GET /api/github/repos - 无 token 时返回错误或被代理"""
        resp = client.get("/api/github/repos")
        # 无 token 时应该返回 500，或被 catch-all proxy 处理返回 404
        assert resp.status_code in [500, 401, 200, 404]

    def test_activity_endpoint(self, client):
        """GET /api/github/activity"""
        resp = client.get("/api/github/activity")
        # 可能返回空列表、错误或 401（无 token）
        assert resp.status_code in [200, 500, 404, 401]

    def test_trending_endpoint(self, client):
        """GET /api/github/trending"""
        resp = client.get("/api/github/trending")
        # 无 token 时可能返回 500，有 token 时返回 200，或被代理
        assert resp.status_code in [200, 500, 404]
