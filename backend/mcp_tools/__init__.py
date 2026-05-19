"""
MCP 工具包
自动注册所有工具到全局 ToolRegistry
"""
from .base import BaseTool, ToolParameter, ToolResult, ToolRegistry, registry
from .github_tools import ALL_GITHUB_TOOLS
from .hf_tools import ALL_HF_TOOLS
from .shell_tools import ALL_SHELL_TOOLS
from .proxy_tools import ALL_PROXY_TOOLS
from .project_tools import ALL_PROJECT_TOOLS
from .config_tools import ALL_CONFIG_TOOLS

# 所有工具类列表
ALL_TOOLS = (
    ALL_GITHUB_TOOLS
    + ALL_HF_TOOLS
    + ALL_SHELL_TOOLS
    + ALL_PROXY_TOOLS
    + ALL_PROJECT_TOOLS
    + ALL_CONFIG_TOOLS
)


def register_all_tools(**deps):
    """注册所有 MCP 工具到全局 registry"""
    registry.configure(**deps)
    registry.register_all(ALL_TOOLS)
    return registry
