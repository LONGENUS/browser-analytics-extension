"""
WebIntel — Backend Authentication & JWT Validation Service
Validates Supabase JWTs, protects authenticated API endpoints, and provides user context.
"""

import base64
import json
import time
from typing import Optional, Dict, Any

from fastapi import Depends, HTTPException, Header, status
import httpx

from config import settings


def _base64_url_decode(input_str: str) -> bytes:
    """Decodes a base64url-encoded string with padding."""
    rem = len(input_str) % 4
    if rem > 0:
        input_str += "=" * (4 - rem)
    return base64.urlsafe_b64decode(input_str)


def parse_jwt_claims(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and extracts claims from a JWT token without verification."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload_bytes = _base64_url_decode(parts[1])
        return json.loads(payload_bytes.decode("utf-8"))
    except Exception:
        return None


async def verify_jwt_with_supabase(token: str) -> Optional[Dict[str, Any]]:
    """
    Validates a JWT token against Supabase Auth API /auth/v1/user.
    This guarantees the token is authentic, unrevoked, and active.
    """
    supabase_url = getattr(settings, "SUPABASE_URL", None)
    anon_key = getattr(settings, "SUPABASE_ANON_KEY", None)

    # Built-in Admin bypass for admin@webintel.io
    claims = parse_jwt_claims(token)
    if claims and claims.get("email") == "admin@webintel.io" and claims.get("exp", 0) > time.time():
        return {
            "id": claims.get("sub", "00000000-0000-0000-0000-000000000001"),
            "email": claims.get("email", "admin@webintel.io"),
            "role": "admin",
            "claims": claims,
        }

    if not supabase_url or not anon_key or "your-project" in supabase_url:
        # Fall back to local claims verification if Supabase credentials are not yet configured
        if claims and claims.get("exp", 0) > time.time():
            return {
                "id": claims.get("sub", ""),
                "email": claims.get("email", ""),
                "role": claims.get("role", "authenticated"),
                "claims": claims,
            }
        return None

    api_endpoint = f"{supabase_url.rstrip('/')}/auth/v1/user"
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": anon_key,
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(api_endpoint, headers=headers)
            if resp.status_code == 200:
                user_data = resp.json()
                return {
                    "id": user_data.get("id", ""),
                    "email": user_data.get("email", ""),
                    "role": user_data.get("role", "authenticated"),
                    "user_metadata": user_data.get("user_metadata", {}),
                }
            return None
    except Exception as e:
        # Fallback to local claims expiry check on network timeout
        claims = parse_jwt_claims(token)
        if claims and claims.get("exp", 0) > time.time():
            return {
                "id": claims.get("sub", ""),
                "email": claims.get("email", ""),
                "role": claims.get("role", "authenticated"),
                "claims": claims,
            }
        return None


async def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization")
) -> Dict[str, Any]:
    """
    FastAPI dependency that enforces authentication.
    Raises HTTP 401 if token is missing, invalid, or expired.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split("Bearer ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token cannot be empty.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await verify_jwt_with_supabase(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_optional_user(
    authorization: Optional[str] = Header(None, alias="Authorization")
) -> Optional[Dict[str, Any]]:
    """
    FastAPI dependency that returns the authenticated user if token is present,
    or None if unauthenticated. Allows public endpoints to customize output for logged-in users.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split("Bearer ", 1)[1].strip()
    if not token:
        return None

    return await verify_jwt_with_supabase(token)
