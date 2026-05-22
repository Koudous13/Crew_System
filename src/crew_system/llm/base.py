"""Shared provider errors for LLM integrations."""


class LLMConfigurationError(RuntimeError):
    """Raised when an LLM provider is missing required configuration."""


class LLMAPIError(RuntimeError):
    """Raised when an LLM provider returns an unusable response."""
