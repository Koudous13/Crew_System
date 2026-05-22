from __future__ import annotations

from typing import Mapping

from crew_system.agents.runner import (
    AgentRunner,
    MockAgentRunner,
    deepseek_agent_runner_from_env,
    gemini_agent_runner_from_env,
)
from crew_system.llm import LLMConfigurationError


def runner_for_provider(
    provider: str,
    use_mock: bool = False,
    *,
    env: Mapping[str, str] | None = None,
) -> tuple[AgentRunner, str]:
    if use_mock or provider == "mock":
        return MockAgentRunner(), "mock"
    if provider == "gemini":
        return gemini_agent_runner_from_env(env), "gemini"
    if provider == "deepseek":
        return deepseek_agent_runner_from_env(env), "deepseek"
    if provider != "auto":
        raise LLMConfigurationError(f"Unknown provider: {provider}")
    try:
        return gemini_agent_runner_from_env(env), "gemini"
    except LLMConfigurationError as exc:
        raise LLMConfigurationError(
            "Auto provider requires GEMINI_API_KEY. "
            "DeepSeek is explicit-only and mock is test-only."
        ) from exc
