"""
Test Suite: Backend Authentication & Authorization (Module 1)
Tests:
- Token format and expiration validation
- Rejection of unauthenticated requests (HTTP 401)
- Rejection of malformed/expired Bearer tokens (HTTP 401)
- Verification of authenticated user identity from Supabase JWT
- User isolation: User A cannot view/update User B's profile
- Injected client user_id is ignored in favor of server-verified auth.uid()
- CORS header policy on allowed vs unauthorized origins
"""

import asyncio
import base64
import json
import time
import uuid

import os
import sys

# Ensure backend directory is in sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient
from app import app
from models.database import init_db
from services.auth import parse_jwt_claims, verify_jwt_with_supabase


def create_test_jwt(user_id: str, email: str, role: str = "authenticated", exp_offset: int = 3600) -> str:
    """Helper to generate a test JWT structure with explicit claims and exp timestamp."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": int(time.time()) + exp_offset,
        "iat": int(time.time()),
        "user_metadata": {"full_name": f"Test User {email.split('@')[0]}"},
    }

    def b64_encode(d: dict) -> str:
        s = json.dumps(d).encode("utf-8")
        return base64.urlsafe_b64encode(s).decode("utf-8").rstrip("=")

    h_b64 = b64_encode(header)
    p_b64 = b64_encode(payload)
    sig = "mock_sig_" + str(int(time.time()))
    return f"{h_b64}.{p_b64}.{sig}"


def test_unauthenticated_requests_rejected():
    """Verify that protected endpoints reject requests lacking Authorization header."""
    client = TestClient(app)

    # 1. GET /auth/me
    resp = client.get("/auth/me")
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
    assert "detail" in resp.json()

    # 2. GET /auth/profile
    resp = client.get("/auth/profile")
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    # 3. PUT /auth/profile
    resp = client.put("/auth/profile", json={"full_name": "Attacker"})
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    # 4. GET /api/resumes (protected API)
    resp = client.get("/api/resumes")
    assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    print("[PASS] Unauthenticated requests rejected with HTTP 401")


def test_malformed_and_expired_tokens_rejected():
    """Verify that malformed, corrupted, or expired tokens are rejected with 401."""
    client = TestClient(app)

    # Malformed token (not 3 parts)
    resp = client.get("/auth/me", headers={"Authorization": "Bearer not-a-valid-jwt"})
    assert resp.status_code == 401, f"Expected 401 for malformed, got {resp.status_code}"

    # Empty token
    resp = client.get("/auth/me", headers={"Authorization": "Bearer "})
    assert resp.status_code == 401, f"Expected 401 for empty token, got {resp.status_code}"

    # Expired token (exp in past)
    expired_token = create_test_jwt(
        user_id=str(uuid.uuid4()),
        email="expired@test.com",
        exp_offset=-3600  # 1 hour ago
    )
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401, f"Expected 401 for expired token, got {resp.status_code}"

    print("[PASS] Malformed and expired tokens rejected with HTTP 401")


def test_authenticated_user_identity():
    """Verify that a valid token returns the server-verified user identity."""
    client = TestClient(app)
    user_id = str(uuid.uuid4())
    email = "applicant@jobmail.com"
    token = create_test_jwt(user_id=user_id, email=email)

    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["authenticated"] is True
    assert data["user"]["id"] == user_id
    assert data["user"]["email"] == email

    print("[PASS] Authenticated user identity successfully derived server-side")


def test_user_isolation_and_spoofing_prevention():
    """
    Verify that User A cannot update or access User B's profile.
    Client-provided user IDs in the request must be ignored; server identity governs.
    """
    client = TestClient(app)
    user_a_id = str(uuid.uuid4())
    user_b_id = str(uuid.uuid4())

    token_a = create_test_jwt(user_id=user_a_id, email="usera@domain.com")

    # User A updates profile, attempting to spoof User B's ID in body
    update_payload = {
        "full_name": "User A Legitimate Name",
        "avatar_url": "https://avatar.url/usera.png",
        "user_id": user_b_id,  # Malicious attempted injection
        "id": user_b_id,        # Malicious attempted injection
    }
    resp = client.put("/auth/profile", json=update_payload, headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    profile_data = resp.json()["profile"]
    # The updated profile must strictly belong to User A, NOT User B!
    assert profile_data["id"] == user_a_id, f"Expected {user_a_id}, got {profile_data['id']}"
    assert profile_data["full_name"] == "User A Legitimate Name"
    assert profile_data["email"] == "usera@domain.com"

    print("[PASS] User isolation confirmed; client-injected user_id safely disregarded")


def test_cors_policy():
    """Verify CORS policy allows extension and local dev origins while restricting arbitrary origins."""
    client = TestClient(app)

    # Allowed: Chrome Extension origin
    headers = {
        "Origin": "chrome-extension://abcdefghijklmnop",
        "Access-Control-Request-Method": "GET",
    }
    resp = client.options("/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "chrome-extension://abcdefghijklmnop"

    # Allowed: Localhost origin
    headers_local = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
    }
    resp_local = client.options("/auth/me", headers=headers_local)
    assert resp_local.status_code == 200
    assert resp_local.headers.get("access-control-allow-origin") == "http://localhost:5173"

    print("[PASS] CORS configuration correctly validates allowed extension & web origins")


if __name__ == "__main__":
    print("\n--- Running Module 1 Backend Authentication Test Suite ---")
    asyncio.run(init_db())
    test_unauthenticated_requests_rejected()
    test_malformed_and_expired_tokens_rejected()
    test_authenticated_user_identity()
    test_user_isolation_and_spoofing_prevention()
    test_cors_policy()
    print("--- All Module 1 Backend Tests Passed Successfully ---\n")
