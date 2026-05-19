"""
Phase 2 单元测试
覆盖 BaseTool、ToolRegistry、各工具类
"""
import pytest
from backend.mcp_tools.base import (
    BaseTool, ToolParameter, ToolResult, ToolRegistry
)
from backend.mcp_tools import register_all_tools, registry


# ═══════════════════════════════════════════════════════════
#  ToolResult 测试
# ═══════════════════════════════════════════════════════════

class TestToolResult:
    def test_text_result(self):
        r = ToolResult.text("hello")
        assert r.is_error is False
        assert r.content[0]["type"] == "text"
        assert r.content[0]["text"] == "hello"

    def test_json_result(self):
        r = ToolResult.json({"key": "value"})
        assert r.is_error is False
        import json
        data = json.loads(r.content[0]["text"])
        assert data["key"] == "value"

    def test_error_result(self):
        r = ToolResult.error("something failed")
        assert r.is_error is True


# ═══════════════════════════════════════════════════════════
#  ToolRegistry 测试
# ═══════════════════════════════════════════════════════════

class TestToolRegistry:
    def test_register_and_get(self):
        reg = ToolRegistry()
        reg.configure(github_client=None, github_user="test")
        reg.register_all([
            type("T1", (BaseTool,), {
                "name": "test_tool",
                "description": "test",
                "group": "test",
                "parameters": {},
                "execute": lambda self, **kw: ToolResult.text("ok"),
            }),
        ])
        assert reg.count == 1
        assert reg.get("test_tool") is not None

    def test_call_unknown_tool(self):
        reg = ToolRegistry()
        import asyncio
        result = asyncio.get_event_loop().run_until_complete(
            reg.call("nonexistent", {})
        )
        assert result["isError"] is True

    def test_list_tools(self):
        reg = ToolRegistry()
        reg.configure(github_client=None, github_user="test")
        from backend.mcp_tools.github_tools import ListReposTool
        reg.register(ListReposTool)
        tools = reg.list_tools()
        assert len(tools) == 1
        assert tools[0]["name"] == "list_repos"
        assert "inputSchema" in tools[0]

    def test_list_tools_by_group(self):
        reg = ToolRegistry()
        reg.configure(github_client=None, github_user="test")
        from backend.mcp_tools.github_tools import ListReposTool
        from backend.mcp_tools.hf_tools import ListSpacesTool
        reg.register(ListReposTool)
        reg.register(ListSpacesTool)
        gh = reg.list_tools_by_group("github")
        hf = reg.list_tools_by_group("huggingface")
        assert len(gh) == 1
        assert len(hf) == 1


# ═══════════════════════════════════════════════════════════
#  Shell 安全策略测试
# ═══════════════════════════════════════════════════════════

class TestShellSafety:
    def test_safe_commands(self):
        from backend.mcp_tools.shell_tools import _is_shell_command_safe
        safe, _ = _is_shell_command_safe("git status")
        assert safe is True
        safe, _ = _is_shell_command_safe("ls -la")
        assert safe is True
        safe, _ = _is_shell_command_safe("python3 app.py")
        assert safe is True

    def test_blocked_commands(self):
        from backend.mcp_tools.shell_tools import _is_shell_command_safe
        safe, reason = _is_shell_command_safe("rm -rf /")
        assert safe is False
        safe, reason = _is_shell_command_safe("shutdown -h now")
        assert safe is False

    def test_empty_command(self):
        from backend.mcp_tools.shell_tools import _is_shell_command_safe
        safe, _ = _is_shell_command_safe("")
        assert safe is False


# ═══════════════════════════════════════════════════════════
#  Proxy SSRF 防护测试
# ═══════════════════════════════════════════════════════════

class TestProxySSRF:
    def test_allowed_url(self):
        from backend.mcp_tools.proxy_tools import _is_proxy_url_allowed
        allowed, _ = _is_proxy_url_allowed("https://api.github.com/repos")
        assert allowed is True

    def test_blocked_localhost(self):
        from backend.mcp_tools.proxy_tools import _is_proxy_url_allowed
        allowed, _ = _is_proxy_url_allowed("http://localhost:8080")
        assert allowed is False

    def test_blocked_metadata(self):
        from backend.mcp_tools.proxy_tools import _is_proxy_url_allowed
        allowed, _ = _is_proxy_url_allowed("http://169.254.169.254/latest/meta-data/")
        assert allowed is False

    def test_blocked_private_ip(self):
        from backend.mcp_tools.proxy_tools import _is_proxy_url_allowed
        allowed, _ = _is_proxy_url_allowed("http://192.168.1.1")
        assert allowed is False


# ═══════════════════════════════════════════════════════════
#  全量注册测试
# ═══════════════════════════════════════════════════════════

class TestFullRegistration:
    def test_all_30_tools_registered(self):
        # 使用新的 registry 实例避免冲突
        from backend.mcp_tools.base import ToolRegistry
        from backend.mcp_tools import ALL_TOOLS
        reg = ToolRegistry()
        reg.configure(
            github_client=None,
            github_user="test",
            hf_token="hf_test",
            hf_user="testuser",
            settings=None,
        )
        reg.register_all(ALL_TOOLS)
        assert reg.count == 30

    def test_tool_schemas_valid(self):
        reg = ToolRegistry()
        reg.configure(
            github_client=None,
            github_user="test",
            hf_token="hf_test",
            hf_user="testuser",
            settings=None,
        )
        from backend.mcp_tools import ALL_TOOLS
        reg.register_all(ALL_TOOLS)
        for tool_schema in reg.list_tools():
            assert "name" in tool_schema
            assert "description" in tool_schema
            assert "inputSchema" in tool_schema
            assert tool_schema["inputSchema"]["type"] == "object"
