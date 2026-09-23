"""
WebIntel — Database Models
SQLAlchemy 2.0 async models for PostgreSQL.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Column, String, Float, Integer, Text, DateTime, ForeignKey, JSON,
)
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, relationship, Mapped, mapped_column

from config import settings


# --- Engine & Session ---
# Detect if using SQLite (no pool_size/max_overflow needed)
_db_url = settings.async_database_url
_is_sqlite = _db_url.startswith("sqlite")

_engine_kwargs = {
    "echo": settings.DEBUG,
}
if not _is_sqlite:
    _engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 10,
        "pool_pre_ping": True,
    })

engine = create_async_engine(
    _db_url,
    **_engine_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# --- Base ---
class Base(DeclarativeBase):
    pass


# --- Models ---

class Analysis(Base):
    """Stores a complete website analysis result."""
    __tablename__ = "analyses"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True, index=True
    )
    url: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="completed")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Stored as JSONB for flexibility
    summary: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    analytics: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    seo_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    raw_products: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Relationship
    products: Mapped[list["Product"]] = relationship(
        "Product", back_populates="analysis", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "url": self.url,
            "domain": self.domain,
            "title": self.title,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "summary": self.summary,
            "analytics": self.analytics,
            "seo": self.seo_data,
            "products": self.raw_products or [],
        }


class Product(Base):
    """Individual product extracted from a page."""
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    analysis_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reviews: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    brand: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    asin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Relationship
    analysis: Mapped["Analysis"] = relationship("Analysis", back_populates="products")

    def to_dict(self):
        return {
            "title": self.title,
            "price": self.price,
            "rating": self.rating,
            "reviews": self.reviews,
            "brand": self.brand,
            "url": self.url,
            "image_url": self.image_url,
            "asin": self.asin,
        }


# --- Database Init ---
async def init_db():
    """Create all tables if they don't exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] Database tables initialized")


# --- Dependency ---
async def get_db():
    """FastAPI dependency that yields a database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
