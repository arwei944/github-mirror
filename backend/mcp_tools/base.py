"""
MCP 工具基类和注册表
提供 BaseTool 抽象基类和 ToolRegistry 单例
"""
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger("github-mirror.mcp_tools")


# ═══════════════════════════════════════════════════════════
#  数据结构
# ═══════════════════════════════════════════════════════════

@dataclass
class ToolParameter:
    """工具参数定义"""
    type: str = "string"
    description: str = ""
    optional: bool = False
    default: Any = None
    items: Optional[dict] = None  # 用于 array 类型


@dataclass
class ToolResult:
    """工具执行结果"""
    content: List[Dict[str, Any]]
    is_error: bool = False

    @classmethod
    def text(cls, text: str, is_error: bool = False) -> "ToolResult":
        """创建文本结果"""
        return cls(
            content=[{"type": "text", "text": text}],
            is_error=is_error,
        )

    @classmethod
    def json(cls, data: Any, is_error: bool = False) -> "ToolResult":
        """创建 JSON 结果"""
        import json
        return cls(
            content=[{"type": "text", "text": json.dumps(data, ensure_ascii=False, indent=2)}],
            is_error=is_error,
        )

    @classmethod
    def error(cls, message: str) -> "ToolResult":
        """创建错误结果"""
        return cls.text(f'{{"error": "{message}"}}', is_error=True)


# ═══════════════════════════════════════════════════════════
#  BaseTool 基类
# ═══════════════════════════════════════════════════════════

class BaseTool(ABC):
    """MCP 工具抽象基类"""

    # 子类必须定义这些类属性
    name: str = ""
    description: str = ""
    group: str = "github"  # github / huggingface / shell / proxy / project / config
    parameters: Dict[str, ToolParameter] = {}

    def __init__(self, **deps):
        """
        初始化工具，接收依赖注入
        常见依赖: github_client, hf_token, hf_user, github_user
        """
        self._github_client = deps.get("github_client")
        self._hf_token = deps.get("hf_token", "")
        self._hf_user = deps.get("hf_user", "")
        self._github_user = deps.get("github_user", "")
        self._settings = deps.get("settings")

    @abstractmethod
    async def execute(self, **kwargs) -> ToolResult:
        """执行工具逻辑，子类必须实现"""
        ...

    def to_mcp_schema(self) -> Dict[str, Any]:
        """转换为 MCP tools/list 所需的 schema"""
        properties = {}
        required = []
        for param_name, param in self.parameters.items():
            prop: Dict[str, Any] = {
                "type": param.type,
                "description": param.description,
            }
            if param.default is not None:
                prop["default"] = param.default
            if param.items:
                prop["items"] = param.items
            if not param.optional:
                required.append(param_name)
            properties[param_name] = prop

        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
            "group": self.group,
        }


# ═══════════════════════════════════════════════════════════
#  ToolRegistry 注册表
# ═══════════════════════════════════════════════════════════

class ToolRegistry:
    """MCP 工具注册表 - 单例模式"""

    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        self._deps: Dict[str, Any] = {}

    def configure(self, **deps):
        """配置全局依赖（github_client, settings 等）"""
        self._deps.update(deps)

    def register(self, tool_class: type) -> BaseTool:
        """注册一个工具类"""
        tool = tool_class(**self._deps)
        if not tool.name:
            raise ValueError(f"Tool class {tool_class.__name__} must define 'name'")
        self._tools[tool.name] = tool
        logger.debug(f"Registered MCP tool: {tool.name} (group={tool.group})")
        return tool

    def register_all(self, tool_classes: List[type]):
        """批量注册工具类"""
        for cls in tool_classes:
            self.register(cls)

    def get(self, name: str) -> Optional[BaseTool]:
        """获取工具实例"""
        return self._tools.get(name)

    def list_tools(self) -> List[Dict[str, Any]]:
        """列出所有工具的 MCP schema"""
        return [tool.to_mcp_schema() for tool in self._tools.values()]

    def list_tools_by_group(self, group: str) -> List[Dict[str, Any]]:
        """按组列出工具"""
        return [
            tool.to_mcp_schema()
            for tool in self._tools.values()
            if tool.group == group
        ]

    async def call(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        调用工具并返回 MCP 格式结果
        """
        tool = self._tools.get(name)
        if not tool:
            return {
                "content": [{"type": "text", "text": f'{{"error": "未知工具: {name}"}}'}],
                "isError": True,
            }

        logger.info(f"MCP tool call: {name}")
        try:
            result = await tool.execute(**arguments)
            return {
                "content": result.content,
                "isError": result.is_error,
            }
        except Exception as e:
            logger.exception(f"MCP tool error: {name}")
            return {
                "content": [{"type": "text", "text": f'{{"error": "{e}"}}'}],
                "isError": True,
            }

    @property
    def count(self) -> int:
        return len(self._tools)


# 全局单例
registry = ToolRegistry()
