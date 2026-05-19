"""
配置管理模块
使用 Pydantic Settings 从环境变量加载配置
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from pathlib import Path


class AppSettings(BaseSettings):
    """应用配置 - 集中管理所有环境变量"""

    # ── 应用 ──
    app_version: str = "7.3.0"
    debug: bool = False

    # ── GitHub ──
    github_token: str = ""
    github_user: str = ""
    github_api_base: str = "https://api.github.com"

    # ── HuggingFace ──
    hf_token: str = ""
    hf_user: str = ""

    # ── 安全 ──
    api_key: str = ""
    webhook_secret: str = ""
    cors_origins: str = "*"

    # ── 速率限制 ──
    rate_limit_enabled: bool = True
    rate_limit_max: int = 120
    rate_limit_window: int = 60

    # ── 数据 ──
    data_dir: str = Field(
        default_factory=lambda: str(Path(__file__).parent.parent / "data")
    )

    # ── 缓存 ──
    cache_default_ttl: int = 300
    cache_max_size: int = 2000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = AppSettings()
