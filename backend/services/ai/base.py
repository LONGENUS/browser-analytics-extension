"""
TailorResume — AI Provider Base Architecture
Abstract interfaces and data models for pluggable LLM inference providers.
Strictly isolates provider-specific logic (Groq, Gemini, OpenRouter, etc.).
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Tuple


@dataclass
class TokenUsage:
    """Tracks token consumption for LLM requests."""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

    def to_dict(self) -> Dict[str, int]:
        return {
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
        }


@dataclass
class AICompletionResult:
    """Normalized structured response from an AI provider."""
    content: str
    parsed_json: Optional[Dict[str, Any]] = None
    model: str = ""
    provider: str = ""
    token_usage: TokenUsage = field(default_factory=TokenUsage)
    latency_ms: float = 0.0
    retry_count: int = 0
    success: bool = True
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model": self.model,
            "provider": self.provider,
            "token_usage": self.token_usage.to_dict(),
            "latency_ms": round(self.latency_ms, 2),
            "retry_count": self.retry_count,
            "success": self.success,
            "error_message": self.error_message,
        }


# --- Provider Exceptions ---

class AIProviderError(Exception):
    """Base exception for AI provider operations."""
    def __init__(self, message: str, provider: str = "", status_code: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.status_code = status_code


class AIAuthenticationError(AIProviderError):
    """Raised when API credentials are missing, invalid, or revoked."""
    pass


class AIRateLimitError(AIProviderError):
    """Raised when rate limit or quota is exhausted."""
    pass


class AIModelNotFoundError(AIProviderError):
    """Raised when the specified model ID is not available to the account."""
    pass


class AITimeoutError(AIProviderError):
    """Raised when provider request exceeds deadline."""
    pass


# --- Abstract Base Provider ---

class BaseAIProvider(ABC):
    """
    Abstract Base Class for server-side AI inference providers.
    All providers (Groq, Gemini, OpenRouter) implement this interface.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Identifier of the provider (e.g. 'groq', 'gemini')."""
        pass

    @property
    @abstractmethod
    def is_configured(self) -> bool:
        """Returns True if the provider has valid credentials."""
        pass

    @abstractmethod
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        response_format: Optional[Dict[str, Any]] = None,
        temperature: float = 0.2,
        max_tokens: int = 2048,
    ) -> AICompletionResult:
        """
        Executes a chat completion request with structured token usage tracking
        and bounded retries.
        """
        pass

    @abstractmethod
    async def verify_model(self, model_id: str) -> Tuple[bool, Optional[str]]:
        """
        Verifies whether the specified model ID is active and available to the account.
        Returns (is_available, error_or_reason).
        """
        pass

    @abstractmethod
    async def list_available_models(self) -> List[str]:
        """Queries the provider API for available model IDs."""
        pass
