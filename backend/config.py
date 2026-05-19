"""
GitHub Mirror - Configuration
Pydantic Settings based configuration, fully compatible with existing env vars.
"""

import os
from pathlib import Path
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────
    app_version: str = "7.2.0"
    debug: bool = False

    # ── GitHub ───────────────────────────────────
    github_token: str = Field(default="", alias="GITHUB_TOKEN")
    github_user: str = Field(default="", alias="GITHUB_USER")
    github_api_base: str = Field(
        default="https://api.github.com", alias="GITHUB_API_BASE"
    )

    # ── HuggingFace ──────────────────────────────
    hf_token: str = Field(default="", alias="HF_TOKEN")
    hf_user: str = Field(default="", alias="HF_USER")

    # ── Webhook ──────────────────────────────────
    webhook_secret: str = Field(default="", alias="WEBHOOK_SECRET")

    # ── Data ─────────────────────────────────────
    data_dir: str = Field(
        default=os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "..", "data"
        ),
        alias="DATA_DIR",
    )

    # ── API & CORS ───────────────────────────────
    api_key: str = Field(default="", alias="API_KEY")
    cors_origins: str = Field(default="*", alias="CORS_ORIGINS")

    # ── Rate Limiting ────────────────────────────
    rate_limit_enabled: bool = Field(
        default=True, alias="RATE_LIMIT_ENABLED"
    )
    rate_limit_max: int = Field(default=120, alias="RATE_LIMIT_MAX")
    rate_limit_window: int = Field(default=60, alias="RATE_LIMIT_WINDOW")

    # ── Cache ────────────────────────────────────
    cache_default_ttl: int = Field(default=300, alias="CACHE_DEFAULT_TTL")
    cache_max_size: int = Field(default=2000, alias="CACHE_MAX_SIZE")

    # ── Computed Properties ──────────────────────

    @property
    def static_dir(self) -> str:
        return str(Path(__file__).resolve().parent / "static")

    @property
    def sync_db_path(self) -> str:
        return os.path.join(self.data_dir, "sync.db")

    @property
    def projects_file(self) -> str:
        return os.path.join(self.data_dir, "projects.json")

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @field_validator("rate_limit_enabled", mode="before")
    @classmethod
    def parse_rate_limit_enabled(cls, v):
        if isinstance(v, str):
            return v.lower() == "true"
        return v


# Global settings singleton
settings = Settings()
