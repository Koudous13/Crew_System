from __future__ import annotations

import json
import os
import socket
import time
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
from crew_system.llm.base import LLMAPIError, LLMConfigurationError
from crew_system.llm.deepseek import (
    build_json_system_prompt,
    compact_provider_input,
    minimal_json_example,
    read_nearest_dotenv,
    trim_error,
)

ENV_GEMINI_API_KEY = "GEMINI_API_KEY"
ENV_GEMINI_BASE_URL = "GEMINI_BASE_URL"
ENV_GEMINI_MODEL = "GEMINI_MODEL"
ENV_GEMINI_TIMEOUT_SECONDS = "GEMINI_TIMEOUT_SECONDS"
ENV_GEMINI_MAX_RETRIES = "GEMINI_MAX_RETRIES"
ENV_GEMINI_MAX_OUTPUT_TOKENS = "GEMINI_MAX_OUTPUT_TOKENS"
ENV_GEMINI_TEMPERATURE = "GEMINI_TEMPERATURE"
ENV_GEMINI_RESPONSE_SCHEMA = "GEMINI_RESPONSE_SCHEMA"

DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_GEMINI_MODEL = "gemma-4-26b-a4b-it"
DEFAULT_GEMINI_TIMEOUT_SECONDS = 240
DEFAULT_GEMINI_MAX_RETRIES = 3
DEFAULT_GEMINI_MAX_OUTPUT_TOKENS: int | None = None
DEFAULT_GEMINI_TEMPERATURE = 0.3
DEFAULT_GEMINI_RESPONSE_SCHEMA = False


class GeminiConfigurationError(LLMConfigurationError):
    """Raised when Gemini settings are missing or invalid."""


class GeminiAPIError(LLMAPIError):
    """Raised when Gemini returns an unusable response."""


@dataclass(slots=True)
class GeminiSettings(RuntimeModel):
    api_key: str
    base_url: str = DEFAULT_GEMINI_BASE_URL
    model: str = DEFAULT_GEMINI_MODEL
    timeout_seconds: int = DEFAULT_GEMINI_TIMEOUT_SECONDS
    max_retries: int = DEFAULT_GEMINI_MAX_RETRIES
    max_output_tokens: int | None = DEFAULT_GEMINI_MAX_OUTPUT_TOKENS
    temperature: float = DEFAULT_GEMINI_TEMPERATURE
    response_schema_enabled: bool = DEFAULT_GEMINI_RESPONSE_SCHEMA

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "GeminiSettings":
        env_map = merged_env_with_dotenv(os.environ) if env is None else env
        api_key = env_map.get(ENV_GEMINI_API_KEY, "").strip()
        if not api_key:
            raise GeminiConfigurationError(f"{ENV_GEMINI_API_KEY} is required")
        return cls(
            api_key=api_key,
            base_url=env_map.get(ENV_GEMINI_BASE_URL, DEFAULT_GEMINI_BASE_URL).strip(),
            model=env_map.get(ENV_GEMINI_MODEL, DEFAULT_GEMINI_MODEL).strip(),
            timeout_seconds=parse_positive_int(
                env_map.get(ENV_GEMINI_TIMEOUT_SECONDS),
                DEFAULT_GEMINI_TIMEOUT_SECONDS,
                ENV_GEMINI_TIMEOUT_SECONDS,
            ),
            max_retries=parse_positive_int(
                env_map.get(ENV_GEMINI_MAX_RETRIES),
                DEFAULT_GEMINI_MAX_RETRIES,
                ENV_GEMINI_MAX_RETRIES,
            ),
            max_output_tokens=parse_optional_positive_int(
                env_map.get(ENV_GEMINI_MAX_OUTPUT_TOKENS),
                ENV_GEMINI_MAX_OUTPUT_TOKENS,
            ),
            temperature=parse_temperature(
                env_map.get(ENV_GEMINI_TEMPERATURE),
                DEFAULT_GEMINI_TEMPERATURE,
            ),
            response_schema_enabled=parse_bool(
                env_map.get(ENV_GEMINI_RESPONSE_SCHEMA),
                DEFAULT_GEMINI_RESPONSE_SCHEMA,
                ENV_GEMINI_RESPONSE_SCHEMA,
            ),
        )

    def validate(self) -> None:
        require_non_empty(self.api_key, "GeminiSettings.api_key")
        require_non_empty(self.base_url, "GeminiSettings.base_url")
        require_non_empty(self.model, "GeminiSettings.model")
        require_positive_int(self.timeout_seconds, "GeminiSettings.timeout_seconds")
        require_positive_int(self.max_retries, "GeminiSettings.max_retries")
        if self.max_output_tokens is not None:
            require_positive_int(self.max_output_tokens, "GeminiSettings.max_output_tokens")
        if type(self.temperature) not in {float, int} or self.temperature < 0 or self.temperature > 2:
            raise ModelValidationError("GeminiSettings.temperature must be between 0 and 2")
        if type(self.response_schema_enabled) is not bool:
            raise ModelValidationError("GeminiSettings.response_schema_enabled must be a boolean")


class GeminiJsonClient:
    """Gemini generateContent client that implements the runner LLMClient protocol."""

    def __init__(self, settings: GeminiSettings) -> None:
        self.settings = settings

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "GeminiJsonClient":
        return cls(GeminiSettings.from_env(env))

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
        content_text = extract_generate_content_text(response_payload)
        try:
            return parse_gemini_json_text(content_text, output_schema=output_schema)
        except GeminiAPIError as first_error:
            repair_payload = self._repair_request_payload(
                raw_content=content_text,
                output_schema=output_schema,
            )
            repair_response_payload = self._post_json(repair_payload)
            repair_text = extract_generate_content_text(repair_response_payload)
            try:
                return parse_gemini_json_text(repair_text, output_schema=output_schema)
            except GeminiAPIError as repair_error:
                raise GeminiAPIError(
                    "Gemini API content is not valid JSON after repair. "
                    f"first_error={first_error}; repair_error={repair_error}"
                ) from repair_error

    def _request_payload(
        self,
        *,
        system_prompt: str,
        input_payload: dict[str, Any],
        output_schema: dict[str, Any],
    ) -> dict[str, Any]:
        schema_name = str(output_schema.get("title") or "AgentOutput")
        provider_input = compact_provider_input(input_payload)
        generation_config: dict[str, Any] = {
            "responseMimeType": "application/json",
            "temperature": float(self.settings.temperature),
        }
        if self.settings.response_schema_enabled:
            generation_config["responseJsonSchema"] = sanitize_json_schema(output_schema)
        if self.settings.max_output_tokens is not None:
            generation_config["maxOutputTokens"] = self.settings.max_output_tokens

        return {
            "systemInstruction": {
                "parts": [
                    {
                        "text": build_json_system_prompt(
                            system_prompt=system_prompt,
                            schema_name=schema_name,
                            example_payload=minimal_json_example(output_schema),
                        )
                    }
                ]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": json.dumps(
                                {
                                    "agent_input": provider_input,
                                    "output_schema": output_schema,
                                },
                                ensure_ascii=False,
                                sort_keys=True,
                            )
                        }
                    ],
                }
            ],
            "generationConfig": generation_config,
        }

    def _repair_request_payload(
        self,
        *,
        raw_content: str,
        output_schema: dict[str, Any],
    ) -> dict[str, Any]:
        schema_name = str(output_schema.get("title") or "AgentOutput")
        generation_config: dict[str, Any] = {
            "responseMimeType": "application/json",
            "temperature": 0,
        }
        if self.settings.response_schema_enabled:
            generation_config["responseJsonSchema"] = sanitize_json_schema(output_schema)
        return {
            "systemInstruction": {
                "parts": [
                    {
                        "text": (
                            "Tu es un reparateur JSON strict. Convertis la sortie brute en un unique "
                            "objet JSON valide, sans Markdown, sans commentaire, sans texte avant ou "
                            f"apres. La sortie doit respecter le schema {schema_name}."
                        )
                    }
                ]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": json.dumps(
                                {
                                    "raw_content": raw_content[:12000],
                                    "output_schema": output_schema,
                                    "expected_example": minimal_json_example(output_schema),
                                },
                                ensure_ascii=False,
                                sort_keys=True,
                            )
                        }
                    ],
                }
            ],
            "generationConfig": generation_config,
        }

    def _post_json(self, payload: dict[str, Any]) -> dict[str, Any]:
        url = gemini_generate_content_url(
            base_url=self.settings.base_url,
            model=self.settings.model,
        )
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "x-goog-api-key": self.settings.api_key,
            },
            method="POST",
        )
        attempts = max(self.settings.max_retries, 1)
        last_error: Exception | None = None
        for attempt in range(1, attempts + 1):
            try:
                with urllib.request.urlopen(request, timeout=self.settings.timeout_seconds) as response:
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as exc:
                error_body = exc.read().decode("utf-8", errors="replace")
                if exc.code < 500 or attempt == attempts:
                    raise GeminiAPIError(
                        f"Gemini API error {exc.code}: {trim_error(error_body)}"
                    ) from exc
                last_error = exc
            except urllib.error.URLError as exc:
                if attempt == attempts:
                    raise GeminiAPIError(f"Gemini API request failed: {exc.reason}") from exc
                last_error = exc
            except (TimeoutError, socket.timeout) as exc:
                if attempt == attempts:
                    raise GeminiAPIError("Gemini API request timed out") from exc
                last_error = exc
            except json.JSONDecodeError as exc:
                raise GeminiAPIError(f"Gemini API returned invalid JSON envelope: {exc}") from exc
            time.sleep(min(3 * attempt, 20))
        raise GeminiAPIError(f"Gemini API request failed after retries: {last_error}")


def gemini_generate_content_url(*, base_url: str, model: str) -> str:
    model_path = model.strip().lstrip("/")
    if not model_path.startswith("models/"):
        model_path = f"models/{model_path}"
    return f"{base_url.rstrip('/')}/{model_path}:generateContent"


def parse_generate_content_json(response_payload: dict[str, Any]) -> dict[str, Any]:
    return parse_gemini_json_text(extract_generate_content_text(response_payload))


def extract_generate_content_text(response_payload: dict[str, Any]) -> str:
    candidates = response_payload.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise GeminiAPIError("Gemini API response has no candidates")
    first_candidate = candidates[0]
    if not isinstance(first_candidate, dict):
        raise GeminiAPIError("Gemini API first candidate is invalid")
    finish_reason = first_candidate.get("finishReason")
    if finish_reason in {"MAX_TOKENS", "SAFETY", "RECITATION", "MALFORMED_FUNCTION_CALL"}:
        raise GeminiAPIError(f"Gemini response stopped before usable JSON: {finish_reason}")

    content = first_candidate.get("content")
    if not isinstance(content, dict):
        raise GeminiAPIError("Gemini API candidate has no content")
    parts = content.get("parts")
    if not isinstance(parts, list) or not parts:
        raise GeminiAPIError("Gemini API candidate has no text parts")

    text_chunks = [part.get("text", "") for part in parts if isinstance(part, dict)]
    content_text = "\n".join(chunk for chunk in text_chunks if isinstance(chunk, str)).strip()
    if not content_text:
        raise GeminiAPIError("Gemini API returned empty content")
    return content_text


def parse_gemini_json_text(content_text: str, output_schema: dict[str, Any] | None = None) -> dict[str, Any]:
    parsed = parse_json_value(content_text)
    if parsed is None:
        extracted = extract_first_json_value(content_text)
        if extracted:
            parsed = parse_json_value(extracted)
    if parsed is None:
        raise GeminiAPIError(f"content is not valid JSON: {trim_error(content_text)}")
    if isinstance(parsed, dict):
        return parsed
    if output_schema is not None:
        coerced = coerce_json_value_to_schema_payload(parsed, output_schema)
        if coerced is not None:
            return coerced
    raise GeminiAPIError("content JSON root must be an object")


def parse_json_value(content_text: str) -> Any | None:
    try:
        return json.loads(content_text)
    except json.JSONDecodeError:
        return None


def coerce_json_value_to_schema_payload(value: Any, output_schema: dict[str, Any]) -> dict[str, Any] | None:
    required_keys = [key for key in output_schema.get("required", []) if isinstance(key, str)]
    properties = output_schema.get("properties", {})
    if len(required_keys) != 1 or not isinstance(properties, dict):
        return None
    required_key = required_keys[0]
    required_schema = properties.get(required_key, {})
    if not isinstance(required_schema, dict):
        return None
    if isinstance(value, list) and required_schema.get("type") == "array":
        return {required_key: value}
    if isinstance(value, list) and required_schema.get("type") == "object":
        return {
            required_key: {
                f"unit_{index:03d}": item if isinstance(item, dict) else {"value": item}
                for index, item in enumerate(value, start=1)
            }
        }
    return None


def extract_first_json_value(content: str) -> str | None:
    starts = [index for index in (content.find("{"), content.find("[")) if index >= 0]
    if not starts:
        return None
    start = min(starts)
    opening = content[start]
    closing = "}" if opening == "{" else "]"
    depth = 0
    in_string = False
    escape = False
    for index in range(start, len(content)):
        char = content[index]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == opening:
            depth += 1
        elif char == closing:
            depth -= 1
            if depth == 0:
                return content[start : index + 1]
    return None


def sanitize_json_schema(schema: dict[str, Any]) -> dict[str, Any]:
    return sanitize_schema_node(schema)


def sanitize_schema_node(value: Any) -> Any:
    if isinstance(value, list):
        return [sanitize_schema_node(item) for item in value]
    if not isinstance(value, dict):
        return value
    sanitized: dict[str, Any] = {}
    for key, child in value.items():
        if key in {"$schema", "$id", "$defs", "definitions"}:
            continue
        sanitized[key] = sanitize_schema_node(child)
    return sanitized


def parse_positive_int(value: str | None, default: int, field_name: str) -> int:
    if value is None or not str(value).strip():
        return default
    try:
        parsed = int(value)
    except ValueError as exc:
        raise GeminiConfigurationError(f"{field_name} must be an integer") from exc
    if parsed <= 0:
        raise GeminiConfigurationError(f"{field_name} must be positive")
    return parsed


def parse_optional_positive_int(value: str | None, field_name: str) -> int | None:
    if value is None or not str(value).strip():
        return None
    return parse_positive_int(value, 1, field_name)


def parse_temperature(value: str | None, default: float) -> float:
    if value is None or not str(value).strip():
        return default
    try:
        parsed = float(value)
    except ValueError as exc:
        raise GeminiConfigurationError(f"{ENV_GEMINI_TEMPERATURE} must be a number") from exc
    if parsed < 0 or parsed > 2:
        raise GeminiConfigurationError(f"{ENV_GEMINI_TEMPERATURE} must be between 0 and 2")
    return parsed


def parse_bool(value: str | None, default: bool, field_name: str) -> bool:
    if value is None or not str(value).strip():
        return default
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "on", "enabled"}:
        return True
    if normalized in {"0", "false", "no", "off", "disabled"}:
        return False
    raise GeminiConfigurationError(f"{field_name} must be true or false")


def merged_env_with_dotenv(env: Mapping[str, str]) -> dict[str, str]:
    merged = dict(read_nearest_dotenv(Path.cwd()))
    merged.update(env)
    return merged
