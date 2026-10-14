"""
TailorResume — Configuration Module
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
        return "sqlite+aiosqlite:////tmp/tailorresume.db"
    return f"sqlite+aiosqlite:///{os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tailorresume.db')}"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local", "../.env", "../.env.local"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # App
    APP_NAME: str = "TailorResume"
    APP_VERSION: str = "2.0.0"
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

    # AI & Groq Configuration (Server-side only — Module 6 AI Provider)
    # Model catalog: https://console.groq.com/docs/models
    # Key management: https://console.groq.com/keys
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    AI_PROVIDER: str = "groq"
    AI_REQUEST_TIMEOUT_SECONDS: int = 30
    AI_MAX_RETRIES: int = 2

    # Legacy / Alternative Tailoring Settings
    TAILORING_LLM_PROVIDER: str = "groq"
    TAILORING_LLM_MODEL: str = "llama-3.3-70b-versatile"
    TAILORING_LLM_ENABLED: bool = True
    HUGGINGFACE_API_KEY: Optional[str] = None
    TAILORING_MAX_REWRITE_CANDIDATES: int = 3
    TAILORING_REQUEST_TIMEOUT_SECONDS: int = 30

    @property
    def is_groq_configured(self) -> bool:
        """Determines if a valid Groq API key is present on the server without logging the key."""
        if not self.GROQ_API_KEY:
            return False
        val = self.GROQ_API_KEY.strip()
        if not val or val.lower() in ("your_groq_api_key_here", "placeholder", "none", ""):
            return False
        if "your_groq" in val.lower():
            return False
        return len(val) >= 20

    # CORS — allow the Chrome extension & frontend domains
    CORS_ORIGINS: Union[str, List[str]] = [
        "chrome-extension://*",
        "http://localhost:3000",
        "http://localhost:5173",
        "https://*.vercel.app",
    ]

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

