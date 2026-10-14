"""
TailorResume — Rate Limiting & Abuse Prevention Service (Module 11)
Provides in-memory sliding window rate limiting for sensitive and resource-intensive endpoints.

Features:
- Per-user rate limiting for authenticated requests (based on current_user['id']).
- Per-IP rate limiting fallback for unauthenticated requests.
- Automatic cleanup of expired timestamps to prevent memory growth.
- Standard HTTP 429 Too Many Requests response with Retry-After header.
- Zero external dependencies (no Redis required for V1 in-process operation).
"""

import time
from collections import defaultdict
from typing import Dict, List, Optional
from fastapi import Request, HTTPException, status


class SlidingWindowRateLimiter:
    """
    Sliding window rate limiter that tracks timestamps of requests per client key.
    """

    def __init__(self, requests_per_minute: int, name: str = "default"):
        self.limit = requests_per_minute
        self.window_seconds = 60
        self.name = name
        self.client_records: Dict[str, List[float]] = defaultdict(list)
        self.enabled: bool = True

    def _get_client_key(self, request: Request, user_id: Optional[str] = None) -> str:
        if user_id:
            return f"user:{user_id}"
        client_host = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_host = forwarded.split(",")[0].strip()
        return f"ip:{client_host}"

    def check(self, request: Request, user_id: Optional[str] = None) -> None:
        """
        Validates whether the incoming request is within the allowed limit.
        Raises HTTP 429 if limit is exceeded.
        """
        if not self.enabled or self.limit <= 0:
            return

        now = time.time()
        client_key = self._get_client_key(request, user_id)
        cutoff = now - self.window_seconds

        # Clean old timestamps
        timestamps = self.client_records[client_key]
        valid_timestamps = [ts for ts in timestamps if ts > cutoff]
        self.client_records[client_key] = valid_timestamps

        if len(valid_timestamps) >= self.limit:
            oldest_in_window = valid_timestamps[0]
            retry_after = max(1, int(oldest_in_window + self.window_seconds - now))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded for {self.name}. Please wait {retry_after} seconds before retrying.",
                headers={"Retry-After": str(retry_after)},
            )

        # Record this request
        valid_timestamps.append(now)

    def reset(self) -> None:
        """Clears all tracked client records (useful for test isolation)."""
        self.client_records.clear()


# Pre-configured rate limiters for key workload tiers
upload_rate_limiter = SlidingWindowRateLimiter(requests_per_minute=20, name="Resume Upload & Parsing")
tailor_rate_limiter = SlidingWindowRateLimiter(requests_per_minute=30, name="Resume Tailoring")
match_rate_limiter = SlidingWindowRateLimiter(requests_per_minute=40, name="Job Match Analysis")
export_rate_limiter = SlidingWindowRateLimiter(requests_per_minute=40, name="Resume Export")
auth_rate_limiter = SlidingWindowRateLimiter(requests_per_minute=60, name="Authentication & Profile")
general_rate_limiter = SlidingWindowRateLimiter(requests_per_minute=120, name="General API")
