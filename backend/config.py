"""
WebIntel — Configuration Module
Manages all environment variables and settings via Pydantic Settings.
"""

from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    APP_NAME: str = "WebIntel"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database (SQLite for local dev, PostgreSQL for production)
    DATABASE_URL: str = f"sqlite+aiosqlite:///{os.path.join(os.path.dirname(os.path.abspath(__file__)), 'webintel.db')}"

    # Redis
    # Redis (optional — set to empty string to disable)
    REDIS_URL: str = ""
    CACHE_TTL_SECONDS: int = 3600  # 1 hour

    # CORS — allow the Chrome extension
    CORS_ORIGINS: list[str] = [
        "chrome-extension://*",
        "http://localhost:3000",
        "http://localhost:5173",
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

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Singleton
settings = Settings()
