"""
Shell MCP 工具
执行 Shell 命令，带安全策略
"""
import asyncio
import logging
import re
from .base import BaseTool, ToolParameter, ToolResult

logger = logging.getLogger("github-mirror.mcp_tools.shell")

_SHELL_MAX_TIMEOUT = 30

# Shell 安全策略：白名单模式
_SHELL_ALLOWED_COMMANDS = [
    r"^git\s",
    r"^docker\s",
    r"^ls\s",
    r"^cat\s",
    r"^head\s",
    r"^tail\s",
    r"^grep\s",
    r"^find\s",
    r"^wc\s",
    r"^echo\s",
    r"^pwd$",
    r"^whoami$",
    r"^date$",
    r"^uname\s",
    r"^python3?\s",
    r"^pip3?\s",
    r"^npm\s",
    r"^node\s",
    r"^npx\s",
    r"^uvicorn\s",
    r"^pytest\s",
    r"^curl\s",
    r"^wget\s",
    r"^tar\s",
    r"^zip\s",
    r"^unzip\s",
    r"^mkdir\s",
    r"^cp\s",
    r"^mv\s",
    r"^touch\s",
    r"^chmod\s",
    r"^df\s",
    r"^free$",
    r"^ps\s",
    r"^env$",
    r"^printenv",
    r"^which\s",
    r"^gh\s",
]

# 黑名单模式（优先级高于白名单）
_SHELL_BLOCKED_PATTERNS = [
    r"rm\s+-rf\s+/",
    r"mkfs",
    r"dd\s+if=",
    r">\s*/dev/sd",
    r"chmod\s+777\s+/",
    r"shutdown",
    r"reboot",
    r"init\s+0",
    r":\(\)\{\s*:\|:&\s*\};:",  # fork bomb
]


def _is_shell_command_safe(cmd: str):
    """检查 Shell 命令是否安全"""
    cmd_stripped = cmd.strip()
    if not cmd_stripped:
        return False, "空命令"

    # 检查黑名单
    for pattern in _SHELL_BLOCKED_PATTERNS:
        if re.search(pattern, cmd_stripped, re.IGNORECASE):
            return False, f"匹配黑名单模式: {pattern}"

    # 检查白名单
    for pattern in _SHELL_ALLOWED_COMMANDS:
        if re.match(pattern, cmd_stripped):
            return True, ""
    return False, f"命令不在白名单中: {cmd_stripped.split()[0]}"


class ExecuteShellTool(BaseTool):
    name = "execute_shell"
    description = "执行 Shell 命令。超时 30 秒，禁止危险命令 (rm -rf /, mkfs, dd, > /dev/sda 等)"
    group = "shell"
    parameters = {
        "command": ToolParameter(type="string", description="要执行的 Shell 命令"),
        "timeout": ToolParameter(type="integer", description="超时秒数 (最大 30)", default=30, optional=True),
    }

    async def execute(self, **kwargs) -> ToolResult:
        cmd = kwargs.get("command", "")
        timeout = min(kwargs.get("timeout", 30), _SHELL_MAX_TIMEOUT)

        safe, reason = _is_shell_command_safe(cmd)
        if not safe:
            return ToolResult.error(f"命令被拒绝: {reason}")

        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            output = {
                "stdout": stdout.decode("utf-8", errors="replace"),
                "stderr": stderr.decode("utf-8", errors="replace"),
                "returncode": proc.returncode,
            }
            return ToolResult.json(output)
        except asyncio.TimeoutError:
            return ToolResult.error(f"命令超时 ({timeout}秒)")
        except Exception as e:
            return ToolResult.error(str(e))


ALL_SHELL_TOOLS = [ExecuteShellTool]
