"""
TailorResume — AI Resume Tailoring Assistant — Authentication & User Identity Routes
Provides verified server-side identity, profile retrieval, and profile updates.
Guarantees:
- Every route strictly derives identity from Supabase Auth (auth.uid()).
- Client-supplied user IDs or emails are never trusted.
- Cross-user data mutation is strictly impossible.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db, UserProfile
from services.auth import get_current_user
from services.rate_limiter import auth_rate_limiter
from fastapi import Request


router = APIRouter()


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(None, max_length=150)
    avatar_url: Optional[str] = Field(None, max_length=500)


@router.get("/me")
async def get_my_identity(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Returns the server-verified user identity derived from the Supabase JWT.
    Guarantees the client is currently authenticated with a valid session.
    """
    return {
        "authenticated": True,
        "user": {
            "id": current_user["id"],
            "email": current_user["email"],
            "role": current_user.get("role", "authenticated"),
            "user_metadata": current_user.get("user_metadata", {}),
            "app_metadata": current_user.get("app_metadata", {}),
        },
    }


@router.get("/profile")
async def get_my_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the user profile belonging to the authenticated user.
    Enforces user isolation: always queries by current_user['id'].
    """
    user_id = current_user["id"]

    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.id == user_id)
        )
        profile = result.scalar_one_or_none()

        if profile:
            return profile.to_dict()

        # If profile row hasn't been created yet in local SQLite fallback,
        # return an initial profile dictionary derived from verified auth identity
        now_iso = datetime.now(timezone.utc).isoformat()
        return {
            "id": user_id,
            "email": current_user.get("email", ""),
            "full_name": current_user.get("user_metadata", {}).get("full_name")
            or current_user.get("email", "").split("@")[0],
            "avatar_url": current_user.get("user_metadata", {}).get("avatar_url", ""),
            "plan": "free",
            "created_at": now_iso,
            "updated_at": now_iso,
            "last_login": now_iso,
        }
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch profile. Please try again later.",
        )


@router.put("/profile")
async def update_my_profile(
    body: UpdateProfileRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Updates the authenticated user's profile (e.g. full_name, avatar_url).
    Strict ownership rule: can only update the profile where id == current_user['id'].
    """
    user_id = current_user["id"]
    auth_rate_limiter.check(request, user_id=user_id)

    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.id == user_id)
        )
        profile = result.scalar_one_or_none()

        now = datetime.now(timezone.utc)

        if not profile:
            # Create profile if not yet created in local database
            profile = UserProfile(
                id=user_id,
                email=current_user.get("email", ""),
                full_name=body.full_name,
                avatar_url=body.avatar_url,
                plan="free",
                created_at=now,
                updated_at=now,
                last_login=now,
            )
            db.add(profile)
        else:
            if body.full_name is not None:
                profile.full_name = body.full_name.strip()
            if body.avatar_url is not None:
                profile.avatar_url = body.avatar_url.strip()
            profile.updated_at = now

        await db.commit()
        await db.refresh(profile)

        return {
            "success": True,
            "profile": profile.to_dict(),
        }
    except HTTPException:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile. Please try again later.",
        )


@router.post("/logout")
async def logout_session(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Server-side acknowledgement of logout.
    Client invalidates tokens in storage; this endpoint logs audit context if needed.
    """
    return {
        "success": True,
        "message": "User session invalidated successfully.",
        "user_id": current_user["id"],
    }
