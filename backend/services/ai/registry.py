"""
TailorResume — AI Provider Registry
Factory pattern for creating and configuring AI inference providers.
Isolates provider instantiations so switching to Gemini or OpenRouter
does not require touching the resume-tailoring engine.
"""

from typing import Dict, Type, Optional

from config import settings
from services.ai.base import BaseAIProvider, AIProviderError
from services.ai.groq_provider import GroqProvider

_PROVIDER_REGISTRY: Dict[str, Type[BaseAIProvider]] = {
    "groq": GroqProvider,
}


def register_provider(name: str, provider_cls: Type[BaseAIProvider]) -> None:
    """Registers an AI provider class under a name."""
    _PROVIDER_REGISTRY[name.lower()] = provider_cls


def get_ai_provider(provider_name: Optional[str] = None) -> BaseAIProvider:
    """
    Returns an instance of the configured AI provider.
    Defaults to settings.AI_PROVIDER (or 'groq').
    Does not automatically switch providers or silently fall back to paid models.
    """
    selected = (provider_name or settings.AI_PROVIDER or "groq").lower().strip()

    if selected not in _PROVIDER_REGISTRY:
        raise AIProviderError(
            f"Unsupported AI provider '{selected}'. Available: {list(_PROVIDER_REGISTRY.keys())}",
            provider=selected,
        )

    provider_cls = _PROVIDER_REGISTRY[selected]
    return provider_cls()
