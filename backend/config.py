"""
WebIntel — Configuration Module
Manages all environment variables and settings via Pydantic Settings.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator, field_validator
from typing import Optional, Union, List, Any
import os
import json


def _get_default_database_url() -> str:
    # If running in serverless environment (Vercel / Lambda) without custom DATABASE_URL,
    # use /tmp which is the only writable directory.
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return "sqlite+aiosqlite:////tmp/webintel.db"
    return f"sqlite+aiosqlite:///{os.path.join(os.path.dirname(os.path.abspath(__file__)), 'webintel.db')}"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # App
    APP_NAME: str = "WebIntel"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    API_BASE_URL: str = "http://localhost:8000"

    # Database (SQLite for local dev, PostgreSQL for production)
    DATABASE_URL: str = _get_default_database_url()

    # Supabase credentials (optional for SQLite, active in production)
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_JWT_SECRET: Optional[str] = None

    # Redis (optional — set to empty string to disable)
    REDIS_URL: str = ""
    CACHE_TTL_SECONDS: int = 3600  # 1 hour

    # CORS — allow the Chrome extension & frontend domains
    CORS_ORIGINS: Union[str, List[str]] = [
        "chrome-extension://*",
        "http://localhost:3000",
        "http://localhost:5173",
        "https://*.vercel.app",
    ]

    # Crawl4AI
    CRAWL_HEADLESS: bool = True
    CRAWL_VIEWPORT_WIDTH: int = 1920
    CRAWL_VIEWPORT_HEIGHT: int = 1080
    CRAWL_MAX_CONCURRENT: int = 3
    CRAWL_TIMEOUT_SECONDS: int = 30

    # AI Summary (optional — set to enable)
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Rate Limiting
    FREE_ANALYSES_PER_DAY: int = 50

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v: Any) -> Any:
        default_cors = [
            "chrome-extension://*",
            "http://localhost:3000",
            "http://localhost:5173",
            "https://*.vercel.app",
        ]
        if not v:
            return default_cors
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return default_cors
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [x.strip() for x in v.split(",") if x.strip()]
        return v

    @model_validator(mode="before")
    @classmethod
    def strip_empty_strings(cls, values: Any) -> Any:
        if isinstance(values, dict):
            return {
                k: v for k, v in values.items()
                if not (isinstance(v, str) and not v.strip())
            }
        return values

    @property
    def async_database_url(self) -> str:
        """Ensure PostgreSQL connection string uses the asyncpg driver."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            return "postgresql+asyncpg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            return "postgresql+asyncpg://" + url[len("postgresql://"):]
        return url


# Singleton
settings = Settings()

