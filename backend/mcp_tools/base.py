"""
MCP 工具基类与数据结构
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class ToolParameter:
    type: str
    description: str
    default: Any = None
    optional: bool = False
    enum: Optional[List[str]] = None
    items: Optional[Dict[str, Any]] = None

    def to_schema_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {"type": self.type, "description": self.description}
        if self.default is not None:
            d["default"] = self.default
        if self.optional:
            d["optional"] = True
        if self.enum is not None:
            d["enum"] = self.enum
        if self.items is not None:
            d["items"] = self.items
        return d


class ToolResult:
    def __init__(self, content: Optional[List[Dict[str, Any]]] = None, isError: bool = False):
        self.content = content or []
        self.isError = isError

    @classmethod
    def text(cls, text: str, error: bool = False) -> "ToolResult":
        return cls(content=[{"type": "text", "text": text}], isError=error)

    @classmethod
    def json(cls, data: Any, error: bool = False) -> "ToolResult":
        return cls(content=[{"type": "text", "text": json.dumps(data, ensure_ascii=False, indent=2)}], isError=error)

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {"content": self.content}
        if self.isError:
            d["isError"] = True
        return d


class BaseTool(ABC):
    name: str = ""
    description: str = ""
    group: str = "other"
    parameters: Dict[str, ToolParameter] = field(default_factory=dict)

    @abstractmethod
    async def execute(self, **kwargs: Any) -> ToolResult:
        ...

    def input_schema(self) -> Dict[str, Any]:
        properties: Dict[str, Any] = {}
        for param_name, param in self.parameters.items():
            properties[param_name] = param.to_schema_dict()
        required = [k for k, v in self.parameters.items() if not v.optional]
        return {"type": "object", "properties": properties, "required": required}

    def tool_definition(self) -> Dict[str, Any]:
        return {"name": self.name, "description": self.description, "inputSchema": self.input_schema(), "group": self.group}
