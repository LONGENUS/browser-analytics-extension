"""
TailorResume — Groq AI Provider Implementation
Connects to the official Groq API using its OpenAI-compatible interface.
Base URL: https://api.groq.com/openai/v1
Docs: https://console.groq.com/docs/models
Key Management: https://console.groq.com/keys

Strict Guarantees:
- Server-side only: Key is never exposed to client, logs, or responses.
- Bounded retries on transient errors (429, 503) with exponential backoff.
- Structured JSON output mode enabled.
- Token usage and request latency recorded on every invocation.
- Deterministic error classification (auth, rate limits, model availability).
"""

import asyncio
import json
import time
from typing import Dict, Any, List, Optional, Tuple

import httpx

from config import settings
from services.ai.base import (
    BaseAIProvider,
    AICompletionResult,
    TokenUsage,
    AIProviderError,
    AIAuthenticationError,
    AIRateLimitError,
    AIModelNotFoundError,
    AITimeoutError,
)


class GroqProvider(BaseAIProvider):
    """Official Groq API client with OpenAI-compatible chat completions interface."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
        max_retries: Optional[int] = None,
    ):
        self._api_key = api_key or settings.GROQ_API_KEY or ""
        self._default_model = model or settings.GROQ_MODEL or "llama-3.3-70b-versatile"
        self._base_url = (base_url or settings.GROQ_BASE_URL or "https://api.groq.com/openai/v1").rstrip("/")
        self._timeout = timeout_seconds or settings.AI_REQUEST_TIMEOUT_SECONDS or 30
        self._max_retries = max_retries if max_retries is not None else settings.AI_MAX_RETRIES

    @property
    def provider_name(self) -> str:
        return "groq"

    @property
    def is_configured(self) -> bool:
        """Determines if a usable API key is configured."""
        if not self._api_key:
            return False
        val = self._api_key.strip()
        if not val or val.lower() in ("your_groq_api_key_here", "placeholder", "none", ""):
            return False
        if "your_groq" in val.lower():
            return False
        return len(val) >= 20

    @property
    def default_model(self) -> str:
        return self._default_model

    def _get_headers(self) -> Dict[str, str]:
        if not self.is_configured:
            raise AIAuthenticationError(
                "Groq API key is not configured. Add your GROQ_API_KEY in .env.local",
                provider=self.provider_name,
                status_code=401,
            )
        return {
            "Authorization": f"Bearer {self._api_key.strip()}",
            "Content-Type": "application/json",
            "User-Agent": f"TailorResume/{settings.APP_VERSION}",
        }

    async def list_available_models(self) -> List[str]:
        """
        Queries the Groq API /models endpoint to list all available model IDs.
        Useful for dynamic model validation and discovery.
        """
        if not self.is_configured:
            raise AIAuthenticationError("Cannot query models: GROQ_API_KEY not configured.", provider=self.provider_name)

        url = f"{self._base_url}/models"
        headers = self._get_headers()

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 401:
                    raise AIAuthenticationError("Invalid Groq API key.", provider=self.provider_name, status_code=401)
                resp.raise_for_status()
                data = resp.json()
                models = [m.get("id") for m in data.get("data", []) if m.get("id")]
                return models
            except httpx.HTTPStatusError as e:
                raise AIProviderError(f"Failed to list Groq models: {e.response.status_code}", provider=self.provider_name, status_code=e.response.status_code)
            except httpx.RequestError as e:
                raise AIProviderError(f"Network error querying Groq models: {str(e)}", provider=self.provider_name)

    async def verify_model(self, model_id: str) -> Tuple[bool, Optional[str]]:
        """
        Verifies if the specified model is supported and available in the Groq account.
        Returns (is_available, error_message).
        """
        if not self.is_configured:
            return False, "GROQ_API_KEY is not configured in .env.local"

        try:
            available_models = await self.list_available_models()
            if model_id in available_models:
                return True, None
            return False, f"Model '{model_id}' was not found in available Groq models ({', '.join(available_models[:5])}...)"
        except Exception as e:
            return False, f"Could not verify model with Groq API: {str(e)}"

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        response_format: Optional[Dict[str, Any]] = None,
        temperature: float = 0.2,
        max_tokens: int = 4096,
    ) -> AICompletionResult:
        """
        Sends an OpenAI-compatible chat completion request to the Groq API.
        Includes bounded retries for rate limits (HTTP 429) and server overloads (HTTP 503).
        """
        if not self.is_configured:
            raise AIAuthenticationError(
                "GROQ_API_KEY is not configured in server environment (.env.local). Live inference is blocked.",
                provider=self.provider_name,
                status_code=401,
            )

        selected_model = model or self._default_model
        url = f"{self._base_url}/chat/completions"
        headers = self._get_headers()

        payload: Dict[str, Any] = {
            "model": selected_model,
            "messages": messages,
            "temperature": max(0.0, min(1.0, temperature)),
            "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format

        retry_count = 0
        backoff_delay = 1.0
        start_time = time.perf_counter()

        while True:
            try:
                async with httpx.AsyncClient(timeout=float(self._timeout)) as client:
                    resp = await client.post(url, headers=headers, json=payload)

                elapsed_ms = (time.perf_counter() - start_time) * 1000

                # 1. Success (200 OK)
                if resp.status_code == 200:
                    data = resp.json()
                    choices = data.get("choices") or []
                    if not choices:
                        raise AIProviderError("Empty choices returned from Groq API", provider=self.provider_name)

                    message_obj = choices[0].get("message", {})
                    content_str = message_obj.get("content", "")

                    # Extract usage
                    usage_data = data.get("usage") or {}
                    token_usage = TokenUsage(
                        prompt_tokens=usage_data.get("prompt_tokens", 0),
                        completion_tokens=usage_data.get("completion_tokens", 0),
                        total_tokens=usage_data.get("total_tokens", 0),
                    )

                    # Attempt JSON parsing if JSON mode requested
                    parsed_json = None
                    if response_format and response_format.get("type") == "json_object":
                        try:
                            parsed_json = json.loads(content_str)
                        except json.JSONDecodeError as json_err:
                            # Try to strip markdown code fences if model enclosed JSON in ```json
                            cleaned = content_str.strip()
                            if cleaned.startswith("```"):
                                lines = cleaned.split("\n")
                                if len(lines) >= 3 and lines[0].startswith("```"):
                                    cleaned = "\n".join(lines[1:-1]).strip()
                                parsed_json = json.loads(cleaned)
                            else:
                                raise AIProviderError(
                                    f"Failed to parse structured JSON from Groq output: {json_err}",
                                    provider=self.provider_name,
                                )

                    return AICompletionResult(
                        content=content_str,
                        parsed_json=parsed_json,
                        model=selected_model,
                        provider=self.provider_name,
                        token_usage=token_usage,
                        latency_ms=elapsed_ms,
                        retry_count=retry_count,
                        success=True,
                    )

                # 2. Authentication Error (401)
                elif resp.status_code == 401:
                    raise AIAuthenticationError(
                        "Groq API authentication failed. Verify that your replacement GROQ_API_KEY in .env.local is valid.",
                        provider=self.provider_name,
                        status_code=401,
                    )

                # 3. Model Not Found / Invalid (404 or 400 with model error)
                elif resp.status_code in (404, 400) and "model" in resp.text.lower():
                    raise AIModelNotFoundError(
                        f"Configured Groq model '{selected_model}' is not available or invalid. Check https://console.groq.com/docs/models",
                        provider=self.provider_name,
                        status_code=resp.status_code,
                    )

                # 4. Rate Limiting / Quota (429) or Service Overload (503)
                elif resp.status_code in (429, 503):
                    if retry_count < self._max_retries:
                        retry_count += 1
                        # Check Retry-After header if provided
                        retry_after = resp.headers.get("Retry-After")
                        sleep_time = float(retry_after) if retry_after and retry_after.isdigit() else backoff_delay
                        await asyncio.sleep(sleep_time)
                        backoff_delay *= 2.0
                        continue
                    else:
                        raise AIRateLimitError(
                            f"Groq API rate limit or quota exceeded after {retry_count} retries.",
                            provider=self.provider_name,
                            status_code=429,
                        )

                # 5. Other HTTP Errors
                else:
                    error_detail = "Unknown Groq error"
                    try:
                        err_json = resp.json()
                        error_detail = err_json.get("error", {}).get("message") or resp.text
                    except Exception:
                        error_detail = resp.text[:200]
                    raise AIProviderError(
                        f"Groq API error ({resp.status_code}): {error_detail}",
                        provider=self.provider_name,
                        status_code=resp.status_code,
                    )

            except httpx.TimeoutException:
                if retry_count < self._max_retries:
                    retry_count += 1
                    await asyncio.sleep(backoff_delay)
                    backoff_delay *= 2.0
                    continue
                raise AITimeoutError(
                    f"Groq API request timed out after {self._timeout}s.",
                    provider=self.provider_name,
                )
            except (AIProviderError, AIAuthenticationError, AIRateLimitError, AIModelNotFoundError):
                raise
            except Exception as e:
                raise AIProviderError(
                    f"Unexpected error communicating with Groq API: {type(e).__name__}",
                    provider=self.provider_name,
                )
