from __future__ import annotations

from typing import Mapping

from crew_system.agents.runner import (
    AgentRunner,
    MockAgentRunner,
    deepseek_agent_runner_from_env,
)
from crew_system.llm import DeepSeekConfigurationError


def runner_for_provider(
    provider: str,
    use_mock: bool = False,
    *,
    env: Mapping[str, str] | None = None,
) -> tuple[AgentRunner, str]:
    if use_mock or provider == "mock":
        return MockAgentRunner(), "mock"
    if provider == "deepseek":
        return deepseek_agent_runner_from_env(env), "deepseek"
    if provider != "auto":
        raise DeepSeekConfigurationError(f"Unknown provider: {provider}")
    try:
        return deepseek_agent_runner_from_env(env), "deepseek"
    except DeepSeekConfigurationError:
        return MockAgentRunner(), "mock"
