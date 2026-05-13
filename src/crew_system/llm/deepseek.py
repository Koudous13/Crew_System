from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from crew_system.core.models import (
    ModelValidationError,
    RuntimeModel,
    require_non_empty,
    require_positive_int,
)

ENV_DEEPSEEK_API_KEY = "DEEPSEEK_API_KEY"
ENV_DEEPSEEK_BASE_URL = "DEEPSEEK_BASE_URL"
ENV_DEEPSEEK_MODEL = "DEEPSEEK_MODEL"
ENV_DEEPSEEK_TIMEOUT_SECONDS = "DEEPSEEK_TIMEOUT_SECONDS"
ENV_DEEPSEEK_MAX_TOKENS = "DEEPSEEK_MAX_TOKENS"
ENV_DEEPSEEK_TEMPERATURE = "DEEPSEEK_TEMPERATURE"
ENV_DEEPSEEK_THINKING = "DEEPSEEK_THINKING"

DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-pro"
DEFAULT_DEEPSEEK_TIMEOUT_SECONDS = 90
DEFAULT_DEEPSEEK_MAX_TOKENS = 4096
DEFAULT_DEEPSEEK_TEMPERATURE = 0.3
DEFAULT_DEEPSEEK_THINKING = False
DEFAULT_ENV_FILE_NAME = ".env"


class DeepSeekConfigurationError(RuntimeError):
    """Raised when DeepSeek settings are missing or invalid."""


class DeepSeekAPIError(RuntimeError):
    """Raised when DeepSeek returns an unusable response."""


@dataclass(slots=True)
class DeepSeekSettings(RuntimeModel):
    api_key: str
    base_url: str = DEFAULT_DEEPSEEK_BASE_URL
    model: str = DEFAULT_DEEPSEEK_MODEL
    timeout_seconds: int = DEFAULT_DEEPSEEK_TIMEOUT_SECONDS
    max_tokens: int = DEFAULT_DEEPSEEK_MAX_TOKENS
    temperature: float = DEFAULT_DEEPSEEK_TEMPERATURE
    thinking_enabled: bool = DEFAULT_DEEPSEEK_THINKING

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "DeepSeekSettings":
        env_map = merged_env_with_dotenv(os.environ) if env is None else env
        api_key = env_map.get(ENV_DEEPSEEK_API_KEY, "").strip()
        if not api_key:
            raise DeepSeekConfigurationError(f"{ENV_DEEPSEEK_API_KEY} is required")
        return cls(
            api_key=api_key,
            base_url=env_map.get(ENV_DEEPSEEK_BASE_URL, DEFAULT_DEEPSEEK_BASE_URL).strip(),
            model=env_map.get(ENV_DEEPSEEK_MODEL, DEFAULT_DEEPSEEK_MODEL).strip(),
            timeout_seconds=parse_positive_int(
                env_map.get(ENV_DEEPSEEK_TIMEOUT_SECONDS),
                DEFAULT_DEEPSEEK_TIMEOUT_SECONDS,
                ENV_DEEPSEEK_TIMEOUT_SECONDS,
            ),
            max_tokens=parse_positive_int(
                env_map.get(ENV_DEEPSEEK_MAX_TOKENS),
                DEFAULT_DEEPSEEK_MAX_TOKENS,
                ENV_DEEPSEEK_MAX_TOKENS,
            ),
            temperature=parse_temperature(
                env_map.get(ENV_DEEPSEEK_TEMPERATURE),
                DEFAULT_DEEPSEEK_TEMPERATURE,
            ),
            thinking_enabled=parse_bool(
                env_map.get(ENV_DEEPSEEK_THINKING),
                DEFAULT_DEEPSEEK_THINKING,
                ENV_DEEPSEEK_THINKING,
            ),
        )

    def validate(self) -> None:
        require_non_empty(self.api_key, "DeepSeekSettings.api_key")
        require_non_empty(self.base_url, "DeepSeekSettings.base_url")
        require_non_empty(self.model, "DeepSeekSettings.model")
        require_positive_int(self.timeout_seconds, "DeepSeekSettings.timeout_seconds")
        require_positive_int(self.max_tokens, "DeepSeekSettings.max_tokens")
        if type(self.temperature) not in {float, int} or self.temperature < 0 or self.temperature > 2:
            raise ModelValidationError("DeepSeekSettings.temperature must be between 0 and 2")
        if type(self.thinking_enabled) is not bool:
            raise ModelValidationError("DeepSeekSettings.thinking_enabled must be a boolean")


class DeepSeekJsonClient:
    """DeepSeek chat-completions client that implements the runner LLMClient protocol."""

    def __init__(self, settings: DeepSeekSettings) -> None:
        self.settings = settings

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "DeepSeekJsonClient":
        return cls(DeepSeekSettings.from_env(env))

    def generate_json(
        self,
        *,
        system_prompt: str,
        input_payload: dict[str, Any],
        output_schema: dict[str, Any],
    ) -> dict[str, Any]:
        request_payload = self._request_payload(
            system_prompt=system_prompt,
            input_payload=input_payload,
            output_schema=output_schema,
        )
        response_payload = self._post_json(request_payload)
        return parse_chat_completion_json(response_payload)

    def _request_payload(
        self,
        *,
        system_prompt: str,
        input_payload: dict[str, Any],
        output_schema: dict[str, Any],
    ) -> dict[str, Any]:
        schema_name = str(output_schema.get("title") or "AgentOutput")
        example_payload = minimal_json_example(output_schema)
        provider_input = compact_provider_input(input_payload)
        return {
            "model": self.settings.model,
            "messages": [
                {
                    "role": "system",
                    "content": build_json_system_prompt(
                        system_prompt=system_prompt,
                        schema_name=schema_name,
                        example_payload=example_payload,
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "agent_input": provider_input,
                            "output_schema": output_schema,
                        },
                        ensure_ascii=False,
                        sort_keys=True,
                    ),
                },
            ],
            "response_format": {"type": "json_object"},
            "thinking": {"type": "enabled" if self.settings.thinking_enabled else "disabled"},
            "max_tokens": self.settings.max_tokens,
            "temperature": float(self.settings.temperature),
            "stream": False,
        }

    def _post_json(self, payload: dict[str, Any]) -> dict[str, Any]:
        url = self.settings.base_url.rstrip("/") + "/chat/completions"
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=body,
            headers={
                "Authorization": f"Bearer {self.settings.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.settings.timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")
            raise DeepSeekAPIError(f"DeepSeek API error {exc.code}: {trim_error(error_body)}") from exc
        except urllib.error.URLError as exc:
            raise DeepSeekAPIError(f"DeepSeek API request failed: {exc.reason}") from exc
        except TimeoutError as exc:
            raise DeepSeekAPIError("DeepSeek API request timed out") from exc
        except json.JSONDecodeError as exc:
            raise DeepSeekAPIError(f"DeepSeek API returned invalid JSON envelope: {exc}") from exc


def build_json_system_prompt(
    *,
    system_prompt: str,
    schema_name: str,
    example_payload: dict[str, Any],
) -> str:
    return (
        f"{system_prompt.strip()}\n\n"
        "Tu dois repondre uniquement en json valide, sans Markdown, sans commentaire, "
        "sans texte avant ou apres l'objet JSON.\n"
        f"La sortie doit respecter le schema {schema_name}.\n"
        "Exemple de format JSON attendu:\n"
        f"{json.dumps(example_payload, ensure_ascii=False, indent=2, sort_keys=True)}"
    )


def parse_chat_completion_json(response_payload: dict[str, Any]) -> dict[str, Any]:
    choices = response_payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise DeepSeekAPIError("DeepSeek API response has no choices")

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        raise DeepSeekAPIError("DeepSeek API first choice is invalid")

    finish_reason = first_choice.get("finish_reason")
    if finish_reason == "length":
        raise DeepSeekAPIError("DeepSeek response was truncated by max_tokens")

    message = first_choice.get("message")
    if not isinstance(message, dict):
        raise DeepSeekAPIError("DeepSeek API choice has no message")

    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise DeepSeekAPIError("DeepSeek API returned empty content")

    return parse_json_content(content)


def parse_json_content(content: str) -> dict[str, Any]:
    stripped = content.strip()
    try:
        payload = json.loads(stripped)
    except json.JSONDecodeError:
        fenced = extract_fenced_json(stripped)
        if fenced is None:
            raise DeepSeekAPIError("DeepSeek API content is not valid JSON")
        try:
            payload = json.loads(fenced)
        except json.JSONDecodeError as exc:
            raise DeepSeekAPIError(f"DeepSeek API fenced JSON is invalid: {exc}") from exc
    if not isinstance(payload, dict):
        raise DeepSeekAPIError("DeepSeek API JSON content must be an object")
    return payload


def extract_fenced_json(content: str) -> str | None:
    match = re.search(r"```(?:json)?\s*(?P<body>.*?)```", content, flags=re.DOTALL | re.IGNORECASE)
    if match:
        return match.group("body").strip()
    return None


def minimal_json_example(schema: dict[str, Any]) -> dict[str, Any]:
    properties = schema.get("properties", {})
    required = schema.get("required", [])
    example: dict[str, Any] = {}
    for key in required:
        child_schema = properties.get(key, {}) if isinstance(properties, dict) else {}
        example[key] = example_for_schema(child_schema)
    if isinstance(properties, dict) and "self_evaluation" in properties:
        example["self_evaluation"] = {
            "quality_score": 8,
            "confidence_score": 8,
            "weakest_point": "point faible principal",
            "next_improvement": "amelioration prioritaire",
        }
    return example


def example_for_schema(schema: dict[str, Any]) -> Any:
    expected_type = schema.get("type") if isinstance(schema, dict) else None
    if expected_type == "object":
        return {}
    if expected_type == "array":
        return []
    if expected_type == "integer":
        return 0
    if expected_type == "number":
        return 0.0
    if expected_type == "boolean":
        return False
    return ""


def compact_provider_input(input_payload: dict[str, Any]) -> dict[str, Any]:
    compacted = dict(input_payload)
    compacted.pop("prompt", None)
    compacted.pop("output_schema", None)
    return compacted


def parse_positive_int(value: str | None, default: int, field_name: str) -> int:
    if value is None or not str(value).strip():
        return default
    try:
        parsed = int(value)
    except ValueError as exc:
        raise DeepSeekConfigurationError(f"{field_name} must be an integer") from exc
    if parsed <= 0:
        raise DeepSeekConfigurationError(f"{field_name} must be positive")
    return parsed


def parse_temperature(value: str | None, default: float) -> float:
    if value is None or not str(value).strip():
        return default
    try:
        parsed = float(value)
    except ValueError as exc:
        raise DeepSeekConfigurationError(f"{ENV_DEEPSEEK_TEMPERATURE} must be a number") from exc
    if parsed < 0 or parsed > 2:
        raise DeepSeekConfigurationError(f"{ENV_DEEPSEEK_TEMPERATURE} must be between 0 and 2")
    return parsed


def parse_bool(value: str | None, default: bool, field_name: str) -> bool:
    if value is None or not str(value).strip():
        return default
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "on", "enabled"}:
        return True
    if normalized in {"0", "false", "no", "off", "disabled"}:
        return False
    raise DeepSeekConfigurationError(f"{field_name} must be true or false")


def trim_error(value: str, limit: int = 600) -> str:
    normalized = " ".join(value.split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3] + "..."


def merged_env_with_dotenv(env: Mapping[str, str]) -> dict[str, str]:
    merged = dict(read_nearest_dotenv(Path.cwd()))
    merged.update(env)
    return merged


def read_nearest_dotenv(start: Path) -> dict[str, str]:
    for candidate_root in [start.resolve(), *start.resolve().parents]:
        dotenv_path = candidate_root / DEFAULT_ENV_FILE_NAME
        if dotenv_path.exists():
            return parse_dotenv(dotenv_path)
    return {}


def parse_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key:
            continue
        values[key] = clean_dotenv_value(value.strip())
    return values


def clean_dotenv_value(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value
