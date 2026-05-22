from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Mapping, Protocol

from crew_system.core.models import (
    AgentRun,
    AgentRunStatus,
    ContextSnapshot,
    ModelValidationError,
    NormalizedRequest,
    RuntimeModel,
    TaskNode,
    TaskType,
    require_bool,
    require_model,
    require_non_empty,
    validate_agent_id,
    validate_identifier,
    validate_score,
    validate_string_list,
)
from crew_system.filesystem.workspace import utc_now
from crew_system.registry.loader import AgentRegistry


class AgentRunnerError(RuntimeError):
    """Raised when an agent runner cannot execute a task."""


class RunnerNotConfiguredError(AgentRunnerError):
    """Raised when a real provider runner is requested without a provider."""


class AgentExecutionMode(str, Enum):
    DRAFT = "draft"
    DEEP_WORK = "deep_work"
    CRITIC = "critic"
    REVISION = "revision"
    BENCHMARK = "benchmark"


@dataclass(slots=True)
class SchemaValidationResult(RuntimeModel):
    valid: bool
    schema_name: str
    errors: list[str] = field(default_factory=list)

    def validate(self) -> None:
        require_bool(self.valid, "SchemaValidationResult.valid")
        require_non_empty(self.schema_name, "SchemaValidationResult.schema_name")
        validate_string_list(self.errors, "SchemaValidationResult.errors")
        if self.valid and self.errors:
            raise ModelValidationError("SchemaValidationResult.valid cannot have errors")


@dataclass(slots=True)
class AgentInput(RuntimeModel):
    job_id: str
    task_id: str
    agent_id: str
    agent_version: str
    execution_mode: str
    prompt: str
    output_schema_name: str
    output_schema: dict[str, Any]
    normalized_request: dict[str, Any]
    context_snapshot: dict[str, Any]
    input_artifacts: list[str] = field(default_factory=list)
    upstream_outputs: dict[str, dict[str, Any]] = field(default_factory=dict)
    instructions: list[str] = field(default_factory=list)

    def validate(self) -> None:
        validate_identifier(self.job_id, "AgentInput.job_id")
        validate_identifier(self.task_id, "AgentInput.task_id")
        validate_agent_id(self.agent_id, "AgentInput.agent_id")
        require_non_empty(self.agent_version, "AgentInput.agent_version")
        require_non_empty(self.execution_mode, "AgentInput.execution_mode")
        require_non_empty(self.prompt, "AgentInput.prompt")
        require_non_empty(self.output_schema_name, "AgentInput.output_schema_name")
        if not isinstance(self.output_schema, dict):
            raise ModelValidationError("AgentInput.output_schema must be an object")
        if not isinstance(self.normalized_request, dict):
            raise ModelValidationError("AgentInput.normalized_request must be an object")
        if not isinstance(self.context_snapshot, dict):
            raise ModelValidationError("AgentInput.context_snapshot must be an object")
        if not isinstance(self.upstream_outputs, dict):
            raise ModelValidationError("AgentInput.upstream_outputs must be an object")
        validate_string_list(self.input_artifacts, "AgentInput.input_artifacts")
        validate_string_list(self.instructions, "AgentInput.instructions")


@dataclass(slots=True)
class AgentOutput(RuntimeModel):
    agent_id: str
    schema_name: str
    payload: dict[str, Any]
    output_artifacts: list[str] = field(default_factory=list)
    quality_score: int = 0
    confidence_score: int = 0
    risk_flags: list[str] = field(default_factory=list)
    weakest_point: str = ""
    next_improvement: str = ""
    raw_text: str = ""

    def validate(self) -> None:
        validate_agent_id(self.agent_id, "AgentOutput.agent_id")
        require_non_empty(self.schema_name, "AgentOutput.schema_name")
        if not isinstance(self.payload, dict):
            raise ModelValidationError("AgentOutput.payload must be an object")
        validate_string_list(self.output_artifacts, "AgentOutput.output_artifacts")
        validate_score(self.quality_score, "AgentOutput.quality_score")
        validate_score(self.confidence_score, "AgentOutput.confidence_score")
        validate_string_list(self.risk_flags, "AgentOutput.risk_flags")


@dataclass(slots=True)
class AgentRunResult(RuntimeModel):
    agent_run: AgentRun
    schema_validation: SchemaValidationResult
    output: AgentOutput | None = None
    error: str = ""

    def validate(self) -> None:
        require_model(self.agent_run, AgentRun, "AgentRunResult.agent_run")
        require_model(
            self.schema_validation,
            SchemaValidationResult,
            "AgentRunResult.schema_validation",
        )
        if self.output is not None:
            require_model(self.output, AgentOutput, "AgentRunResult.output")
        if self.agent_run.status is AgentRunStatus.COMPLETED and self.output is None:
            raise ModelValidationError("AgentRunResult.output is required when completed")
        if self.agent_run.status is AgentRunStatus.FAILED and not self.error:
            raise ModelValidationError("AgentRunResult.error is required when failed")


class AgentRunner(ABC):
    @abstractmethod
    def run(self, agent_input: AgentInput) -> AgentRunResult:
        raise NotImplementedError


class LLMClient(Protocol):
    def generate_json(
        self,
        *,
        system_prompt: str,
        input_payload: dict[str, Any],
        output_schema: dict[str, Any],
    ) -> dict[str, Any]:
        ...


class AgentInputBuilder:
    def __init__(self, registry: AgentRegistry) -> None:
        self.registry = registry

    def build(
        self,
        *,
        task_node: TaskNode,
        request: NormalizedRequest,
        context: ContextSnapshot,
        upstream_outputs: dict[str, AgentOutput] | None = None,
        instructions: list[str] | None = None,
    ) -> AgentInput:
        if task_node.task_type is not TaskType.AGENT_RUN:
            raise AgentRunnerError("AgentInputBuilder only accepts agent_run tasks")
        definition = self.registry.get_agent_definition(task_node.agent_id)
        return AgentInput(
            job_id=task_node.job_id,
            task_id=task_node.task_id,
            agent_id=definition.agent_id,
            agent_version=definition.version,
            execution_mode=definition.default_mode,
            prompt=self.registry.get_prompt(definition.agent_id),
            output_schema_name=definition.output_schema_name,
            output_schema=self.registry.get_schema(definition.agent_id),
            normalized_request=request.to_dict(),
            context_snapshot=context.to_dict(),
            input_artifacts=task_node.input_artifacts or definition.required_inputs,
            upstream_outputs={
                agent_id: output.payload
                for agent_id, output in (upstream_outputs or {}).items()
            },
            instructions=instructions or [],
        )


class MockAgentRunner(AgentRunner):
    def run(self, agent_input: AgentInput) -> AgentRunResult:
        started_at = utc_now()
        payload = build_mock_payload(agent_input)
        return build_run_result(
            agent_input,
            payload,
            started_at=started_at,
            raw_text="deterministic_mock_output",
        )


class LLMAgentRunner(AgentRunner):
    def __init__(self, client: LLMClient | None = None) -> None:
        self.client = client

    def run(self, agent_input: AgentInput) -> AgentRunResult:
        if self.client is None:
            return build_failed_result(
                agent_input,
                "LLMAgentRunner requires an LLMClient before real execution",
            )
        started_at = utc_now()
        try:
            payload = self.client.generate_json(
                system_prompt=agent_input.prompt,
                input_payload=agent_input.to_dict(),
                output_schema=agent_input.output_schema,
            )
            validation = validate_output_against_schema(payload, agent_input.output_schema)
            if not validation.valid:
                payload = self.client.generate_json(
                    system_prompt=build_schema_repair_prompt(agent_input, validation),
                    input_payload=build_schema_repair_input(agent_input, payload, validation),
                    output_schema=agent_input.output_schema,
                )
        except Exception as exc:  # pragma: no cover - provider boundary
            return build_failed_result(agent_input, f"LLM provider failed: {exc}")
        return build_run_result(agent_input, payload, started_at=started_at)


class CrewAIRunner(AgentRunner):
    def __init__(self, crew: Any | None = None) -> None:
        self.crew = crew

    def run(self, agent_input: AgentInput) -> AgentRunResult:
        if self.crew is None:
            return build_failed_result(
                agent_input,
                "CrewAIRunner requires a configured CrewAI crew before execution",
            )
        return build_failed_result(
            agent_input,
            "CrewAIRunner adapter is reserved until the runtime execution contract is stable",
        )


def deepseek_agent_runner_from_env(env: Mapping[str, str] | None = None) -> LLMAgentRunner:
    from crew_system.llm.deepseek import DeepSeekJsonClient

    return LLMAgentRunner(client=DeepSeekJsonClient.from_env(env))


def gemini_agent_runner_from_env(env: Mapping[str, str] | None = None) -> LLMAgentRunner:
    from crew_system.llm.gemini import GeminiJsonClient

    return LLMAgentRunner(client=GeminiJsonClient.from_env(env))


def build_run_result(
    agent_input: AgentInput,
    payload: dict[str, Any],
    *,
    started_at: str,
    raw_text: str = "",
) -> AgentRunResult:
    payload = normalize_payload_to_schema(payload, agent_input.output_schema)
    validation = validate_output_against_schema(payload, agent_input.output_schema)
    if not validation.valid:
        return build_failed_result(
            agent_input,
            "Schema validation failed: " + "; ".join(validation.errors),
            validation=validation,
            started_at=started_at,
        )

    evaluation = payload.get("self_evaluation", {}) if isinstance(payload, dict) else {}
    quality_score = score_from_evaluation(evaluation, "quality_score")
    confidence_score = score_from_evaluation(evaluation, "confidence_score")

    output = AgentOutput(
        agent_id=agent_input.agent_id,
        schema_name=agent_input.output_schema_name,
        payload=payload,
        output_artifacts=[agent_input.output_schema_name],
        quality_score=quality_score,
        confidence_score=confidence_score,
        risk_flags=list(payload.get("risk_flags", [])) if isinstance(payload.get("risk_flags", []), list) else [],
        weakest_point=str(evaluation.get("weakest_point", "")) if isinstance(evaluation, dict) else "",
        next_improvement=str(evaluation.get("next_improvement", "")) if isinstance(evaluation, dict) else "",
        raw_text=raw_text,
    )
    ended_at = utc_now()
    agent_run = AgentRun(
        agent_run_id=agent_run_id(agent_input),
        job_id=agent_input.job_id,
        agent_id=agent_input.agent_id,
        status=AgentRunStatus.COMPLETED,
        agent_version=agent_input.agent_version,
        task_id=agent_input.task_id,
        execution_mode=agent_input.execution_mode,
        input_artifacts=agent_input.input_artifacts,
        output_artifacts=output.output_artifacts,
        started_at=started_at,
        ended_at=ended_at,
        quality_score=output.quality_score,
        confidence_score=output.confidence_score,
        risk_flags=output.risk_flags,
    )
    return AgentRunResult(
        agent_run=agent_run,
        output=output,
        schema_validation=validation,
    )


def normalize_payload_to_schema(payload: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return payload
    properties = schema.get("properties", {})
    if isinstance(properties, dict) and "self_evaluation" in properties and "self_evaluation" not in payload:
        evaluation = find_self_evaluation(payload)
        if isinstance(evaluation, dict):
            payload = {**payload, "self_evaluation": evaluation}
    required_keys = [key for key in schema.get("required", []) if isinstance(key, str)]
    missing_required = [key for key in required_keys if key not in payload]
    if len(missing_required) != 1 or not isinstance(properties, dict):
        return payload

    required_key = missing_required[0]
    required_schema = properties.get(required_key, {})
    if not isinstance(required_schema, dict) or required_schema.get("type") != "object":
        return payload

    content = {key: value for key, value in payload.items() if key != "self_evaluation"}
    if not content:
        return payload
    normalized: dict[str, Any] = {required_key: normalize_required_object_content(required_key, content)}
    evaluation = payload.get("self_evaluation") or find_self_evaluation(content)
    if isinstance(evaluation, dict):
        normalized["self_evaluation"] = evaluation
    return normalized


def normalize_required_object_content(required_key: str, content: dict[str, Any]) -> dict[str, Any]:
    if required_key != "content_units":
        return content
    for list_key in ["content_units", "posts", "publications", "items", "units"]:
        value = content.get(list_key)
        if isinstance(value, list):
            return list_to_unit_dict(value)
    if len(content) == 1:
        only_value = next(iter(content.values()))
        if isinstance(only_value, list):
            return list_to_unit_dict(only_value)
    return content


def list_to_unit_dict(items: list[Any]) -> dict[str, Any]:
    return {
        f"unit_{index:03d}": item if isinstance(item, dict) else {"value": item}
        for index, item in enumerate(items, start=1)
    }


def find_self_evaluation(value: Any) -> dict[str, Any] | None:
    if isinstance(value, dict):
        candidate = value.get("self_evaluation")
        if isinstance(candidate, dict):
            return candidate
        if "quality_score" in value and "confidence_score" in value:
            return value
        for child in value.values():
            found = find_self_evaluation(child)
            if found is not None:
                return found
    if isinstance(value, list):
        for item in value:
            found = find_self_evaluation(item)
            if found is not None:
                return found
    return None


def build_schema_repair_prompt(agent_input: AgentInput, validation: SchemaValidationResult) -> str:
    return (
        f"{agent_input.prompt.strip()}\n\n"
        "CORRECTION OBLIGATOIRE: ta sortie precedente etait un JSON valide, "
        "mais elle ne respectait pas le schema attendu. Reponds maintenant avec "
        "un seul objet JSON strict, sans Markdown, sans commentaire, sans texte "
        "avant ou apres. Tu dois corriger exactement ces erreurs: "
        + "; ".join(validation.errors)
    )


def build_schema_repair_input(
    agent_input: AgentInput,
    invalid_payload: dict[str, Any],
    validation: SchemaValidationResult,
) -> dict[str, Any]:
    repair_input = agent_input.to_dict()
    repair_input["previous_invalid_output"] = invalid_payload
    repair_input["schema_validation_errors"] = validation.errors
    repair_input["repair_instruction"] = (
        "Conserve les idees utiles de previous_invalid_output, mais renomme et "
        "structure les champs pour respecter strictement output_schema."
    )
    return repair_input


def build_failed_result(
    agent_input: AgentInput,
    error: str,
    *,
    validation: SchemaValidationResult | None = None,
    started_at: str | None = None,
) -> AgentRunResult:
    now = utc_now()
    agent_run = AgentRun(
        agent_run_id=agent_run_id(agent_input),
        job_id=agent_input.job_id,
        agent_id=agent_input.agent_id,
        status=AgentRunStatus.FAILED,
        agent_version=agent_input.agent_version,
        task_id=agent_input.task_id,
        execution_mode=agent_input.execution_mode,
        input_artifacts=agent_input.input_artifacts,
        started_at=started_at or now,
        ended_at=now,
        error=error,
    )
    return AgentRunResult(
        agent_run=agent_run,
        schema_validation=validation
        or SchemaValidationResult(valid=False, schema_name=agent_input.output_schema_name, errors=[error]),
        error=error,
    )


def score_from_evaluation(evaluation: Any, key: str) -> int:
    if not isinstance(evaluation, dict):
        return 0
    value = evaluation.get(key, 0)
    return value if type(value) is int else 0


def build_mock_payload(agent_input: AgentInput) -> dict[str, Any]:
    schema = agent_input.output_schema
    required_keys = schema.get("required", [])
    payload: dict[str, Any] = {}
    for key in required_keys:
        payload[key] = {
            "agent_id": agent_input.agent_id,
            "schema_name": agent_input.output_schema_name,
            "mode": agent_input.execution_mode,
            "summary": f"Mock output for {agent_input.agent_id}",
            "context_files": [
                context_file.get("path", "")
                for context_file in agent_input.context_snapshot.get("files_loaded", [])
                if isinstance(context_file, dict) and not context_file.get("missing")
            ],
            "upstream_agents": sorted(agent_input.upstream_outputs.keys()),
        }

    if "self_evaluation" in schema.get("properties", {}):
        payload["self_evaluation"] = {
            "quality_score": 8,
            "confidence_score": 8,
            "weakest_point": "mock output has structure only",
            "next_improvement": "replace MockAgentRunner with LLMAgentRunner for real substance",
        }
    return payload


def validate_output_against_schema(
    payload: dict[str, Any],
    schema: dict[str, Any],
) -> SchemaValidationResult:
    schema_name = str(schema.get("title") or schema.get("$id") or "unknown_schema")
    errors: list[str] = []
    validate_schema_node(payload, schema, "$", errors)
    return SchemaValidationResult(valid=not errors, schema_name=schema_name, errors=errors)


def validate_schema_node(
    value: Any,
    schema: dict[str, Any],
    path: str,
    errors: list[str],
) -> None:
    expected_type = schema.get("type")
    if expected_type and not value_matches_json_type(value, expected_type):
        errors.append(f"{path} must be {expected_type}")
        return

    if expected_type == "object" or isinstance(value, dict):
        if not isinstance(value, dict):
            errors.append(f"{path} must be object")
            return
        for required_key in schema.get("required", []):
            if required_key not in value:
                errors.append(f"{path}.{required_key} is required")
        properties = schema.get("properties", {})
        if isinstance(properties, dict):
            if "self_evaluation" in properties and "self_evaluation" not in value:
                errors.append(f"{path}.self_evaluation is required")
            for key, child_schema in properties.items():
                if key in value and isinstance(child_schema, dict):
                    validate_schema_node(value[key], child_schema, f"{path}.{key}", errors)
        if schema.get("additionalProperties") is False and isinstance(properties, dict):
            allowed = set(properties)
            for key in value:
                if key not in allowed:
                    errors.append(f"{path}.{key} is not allowed")

    if expected_type == "array" and isinstance(value, list):
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, item in enumerate(value):
                validate_schema_node(item, item_schema, f"{path}[{index}]", errors)

    if (
        isinstance(expected_type, str)
        and expected_type in {"integer", "number"}
        and isinstance(value, (int, float))
        and type(value) is not bool
    ):
        minimum = schema.get("minimum")
        maximum = schema.get("maximum")
        if isinstance(minimum, (int, float)) and value < minimum:
            errors.append(f"{path} must be >= {minimum}")
        if isinstance(maximum, (int, float)) and value > maximum:
            errors.append(f"{path} must be <= {maximum}")


def value_matches_json_type(value: Any, expected_type: Any) -> bool:
    if isinstance(expected_type, list):
        return any(value_matches_json_type(value, item) for item in expected_type)
    if expected_type == "object":
        return isinstance(value, dict)
    if expected_type == "array":
        return isinstance(value, list)
    if expected_type == "string":
        return isinstance(value, str)
    if expected_type == "integer":
        return type(value) is int
    if expected_type == "number":
        return (type(value) is int or type(value) is float) and type(value) is not bool
    if expected_type == "boolean":
        return type(value) is bool
    if expected_type == "null":
        return value is None
    return True


def agent_run_id(agent_input: AgentInput) -> str:
    return f"run_{agent_input.job_id}_{agent_input.task_id}"
