"""
GitHub Mirror - Security Policies
Extracted from app.py (lines 5084-5221).
"""

import ipaddress
import logging
import re
import socket
import urllib.parse
from typing import List, Tuple

logger = logging.getLogger("github-mirror.security")

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

_SHELL_MAX_TIMEOUT = 30


def is_shell_command_safe(cmd: str) -> Tuple[bool, str]:
    stripped = cmd.strip()
    if not stripped:
        return False, "Command cannot be empty"
    for pattern in _SHELL_DANGEROUS_PATTERNS:
        if re.search(pattern, stripped, re.IGNORECASE):
            return False, f"Command matches dangerous pattern: {pattern}"
    allowed = any(re.match(p, stripped) for p in _SHELL_ALLOWED_COMMANDS)
    if not allowed:
        return False, "Command not in allowed list."
    return True, ""

_PROXY_URL_BLACKLIST: List[str] = [
    r"localhost", r"127\.0\.0\.\d+", r"0\.0\.0\.0", r"\[::1\]",
    r"10\.\d+\.\d+\.\d+", r"172\.(1[6-9]|2\d|3[01])\.\d+\.\d+",
    r"192\.168\.\d+\.\d+", r"169\.254\.\d+\.\d+",
    r"metadata\.google\.internal", r"169\.254\.169\.254",
    r"\.internal\b", r"ec2\.amazonaws\.com.*\/meta-data",
    r"100\.100\.100\.200", r"metadata\.tencentcloudapi\.com",
]

_PROXY_URL_WHITELIST: List[str] = []


def is_proxy_url_allowed(url: str) -> Tuple[bool, str]:
    if _PROXY_URL_WHITELIST:
        for pattern in _PROXY_URL_WHITELIST:
            if re.search(pattern, url, re.IGNORECASE):
                return True, ""
        return False, "URL not in whitelist"
    for pattern in _PROXY_URL_BLACKLIST:
        if re.search(pattern, url, re.IGNORECASE):
            return False, f"URL matches blacklist pattern: {pattern}"
    try:
        parsed = urllib.parse.urlparse(url)
        hostname = parsed.hostname
        if hostname:
            try:
                resolved_ips = socket.getaddrinfo(hostname, None)
                for _, _, _, _, sockaddr in resolved_ips:
                    ip = ipaddress.ip_address(sockaddr[0])
                    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                        return False, f"URL resolves to private/reserved IP: {ip}"
            except (socket.gaierror, ValueError):
                pass
    except Exception:
        pass
    return True, ""
