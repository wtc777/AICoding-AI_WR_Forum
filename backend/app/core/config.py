from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional

import yaml
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]  # backend/
PROJECT_ROOT = Path(__file__).resolve().parents[3]  # repo root


class AIConfig(BaseModel):
    provider: str = "qwen"
    base_url: str
    model: str
    chat_completion_path: str | None = None
    default_params: Dict[str, Any] = Field(default_factory=dict)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "AI Card Master"
    api_prefix: str = "/api"
    database_url: str = Field(default_factory=lambda: f"sqlite:///{(BASE_DIR / 'db.sqlite3').as_posix()}")
    jwt_secret: str = "CHANGE_ME"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    rate_limit_login_per_minute: int = 5
    rate_limit_ai_per_hour: int = 20
    ai_api_key: Optional[str] = Field(default=None, alias="AI_API_KEY")

    upload_dir: Path = Field(default_factory=lambda: BASE_DIR / "uploads")
    ai_config_path: Path = Field(default_factory=lambda: PROJECT_ROOT / "config" / "ai.yaml")

    def load_ai_config(self) -> Optional[AIConfig]:
        if not self.ai_config_path.exists():
            return None
        with open(self.ai_config_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return AIConfig(**data)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    os.makedirs(settings.upload_dir, exist_ok=True)
    return settings
