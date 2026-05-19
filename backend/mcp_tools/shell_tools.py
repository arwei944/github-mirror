"""
Shell MCP 工具
"""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any, Dict, List, Tuple

from .base import BaseTool, ToolParameter, ToolResult

try:
    from backend.core.security import is_shell_command_safe as _check_shell_safe
except ImportError:
    _check_shell_safe = None

_SHELL_ALLOWED_COMMANDS: List[str] = [
    r"^git\s", r"^docker\s", r"^ls\s", r"^cat\s", r"^head\s",
    r"^tail\s", r"^grep\s", r"^find\s", r"^wc\s", r"^echo\s",
    r"^pwd\s*$", r"^whoami\s*$", r"^date\s*$", r"^uname\s",
    r"^df\s", r"^free\s", r"^ps\s", r"^python3?\s",
    r"^node\s", r"^npm\s", r"^pip3?\s", r"^curl\s",
    r"^wget\s", r"^tar\s", r"^zip\s", r"^unzip\s",
    r"^mkdir\s", r"^cp\s", r"^mv\s", r"^touch\s",
    r"^chmod\s", r"^env\s*$", r"^which\s", r"^stat\s", r"^file\s",
]

_SHELL_DANGEROUS_PATTERNS: List[str] = [
    r">\s*/dev/", r"\bmkfs\b", r"\bdd\s+.*of=/dev/",
    r"\bshutdown\b", r"\breboot\b", r"\binit\s+[06]\b",
    r"\b:()\s*\{\s*:\|:&\s*};:", r"\bsudo\s", r"\bsu\s",
    r"\bchmod\s+(-R\s+)?777\s+/", r"\bcrontab\b",
    r"\bnohup\b", r"\|\s*(ba)?sh\b", r"`.*`", r"\$\(\s*",
]

_SHELL_MAX_TIMEOUT: int = 30


def _inline_is_shell_command_safe(cmd: str) -> Tuple[bool, str]:
    stripped = cmd.strip()
    if not stripped:
        return False, "命令不能为空"
    for pattern in _SHELL_DANGEROUS_PATTERNS:
        if re.search(pattern, stripped, re.IGNORECASE):
            return False, f"命令匹配危险模式: {pattern}"
    allowed = any(re.match(p, stripped) for p in _SHELL_ALLOWED_COMMANDS)
    if not allowed:
        return False, "命令不在允许列表中。允许的命令: git, docker, ls, cat, grep, find, python, node, npm, pip 等"
    return True, ""


def is_shell_command_safe(cmd: str) -> Tuple[bool, str]:
    if _check_shell_safe is not None:
        return _check_shell_safe(cmd)
    return _inline_is_shell_command_safe(cmd)


class ExecuteShellTool(BaseTool):
    name = "execute_shell"
    description = "执行 Shell 命令。超时 30 秒，禁止危险命令 (rm -rf /, mkfs, dd, > /dev/sda 等)"
    group = "shell"
    parameters = {
        "command": ToolParameter(type="string", description="要执行的 Shell 命令"),
        "timeout": ToolParameter(type="integer", description="超时秒数 (最大 30)", default=30, optional=True),
    }

    async def execute(self, **kwargs: Any) -> ToolResult:
        cmd = kwargs.get("command", "")
        timeout = min(kwargs.get("timeout", 30), _SHELL_MAX_TIMEOUT)
        safe, reason = is_shell_command_safe(cmd)
        if not safe:
            return ToolResult.json({"error": f"命令被拒绝: {reason}"}, error=True)
        try:
            proc = await asyncio.create_subprocess_shell(cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            stdout_bytes, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            output = {"stdout": stdout_bytes.decode("utf-8", errors="replace"), "stderr": stderr_bytes.decode("utf-8", errors="replace"), "returncode": proc.returncode}
            return ToolResult.json(output)
        except asyncio.TimeoutError:
            return ToolResult.json({"error": f"命令超时 ({timeout}秒)"}, error=True)
        except Exception as e:
            return ToolResult.json({"error": str(e)}, error=True)
