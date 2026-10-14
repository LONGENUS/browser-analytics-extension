"""
TailorResume — AI Provider Services Module
Exports clean interfaces for context-aware resume tailoring.
"""

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
from services.ai.groq_provider import GroqProvider
from services.ai.registry import get_ai_provider, register_provider
from services.ai.prompt_builder import build_tailoring_prompt, format_master_resume_context, format_job_context
from services.ai.output_validator import validate_and_filter_ai_output, AIOutputValidationError
from services.ai.tailoring_orchestrator import execute_ai_tailoring_pipeline

__all__ = [
    "BaseAIProvider",
    "AICompletionResult",
    "TokenUsage",
    "AIProviderError",
    "AIAuthenticationError",
    "AIRateLimitError",
    "AIModelNotFoundError",
    "AITimeoutError",
    "GroqProvider",
    "get_ai_provider",
    "register_provider",
    "build_tailoring_prompt",
    "format_master_resume_context",
    "format_job_context",
    "validate_and_filter_ai_output",
    "AIOutputValidationError",
    "execute_ai_tailoring_pipeline",
]
