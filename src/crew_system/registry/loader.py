from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from crew_system.core.models import (
    AgentDefinition,
    AgentDefinitionStatus,
    IntentType,
    RuntimeModel,
)
from crew_system.registry.simple_yaml import load_yaml_file


class RegistryError(RuntimeError):
    """Raised when the agent registry cannot be loaded."""


@dataclass(slots=True)
class AgentRegistryEntry(RuntimeModel):
    agent_id: str
    name: str
    version: str
    status: str
    entry_path: str
    prompt_path: str
    schema_path: str
    eval_path: str
    schema_name: str
    capabilities: list[str]
    required_inputs: list[str]
    raw: dict[str, Any] = field(default_factory=dict)

    def validate(self) -> None:
        for field_name in [
            "agent_id",
            "name",
            "version",
            "status",
            "entry_path",
            "prompt_path",
            "schema_path",
            "eval_path",
            "schema_name",
        ]:
            value = getattr(self, field_name)
            if not isinstance(value, str) or not value.strip():
                raise RegistryError(f"AgentRegistryEntry.{field_name} is required")
        if not isinstance(self.capabilities, list):
            raise RegistryError("AgentRegistryEntry.capabilities must be a list")
        if not isinstance(self.required_inputs, list):
            raise RegistryError("AgentRegistryEntry.required_inputs must be a list")

    def to_agent_definition(self) -> AgentDefinition:
        return AgentDefinition(
            agent_id=self.agent_id,
            name=self.name,
            version=self.version,
            status=AgentDefinitionStatus(self.status),
            prompt_path=self.prompt_path,
            schema_path=self.schema_path,
            eval_path=self.eval_path,
            capabilities=self.capabilities,
            required_inputs=self.required_inputs,
            output_schema_name=self.schema_name,
            default_mode=self.raw.get("execution", {}).get("default_mode", "deep_work"),
            max_iterations=self.raw.get("execution", {}).get("max_iterations", 3),
        )


@dataclass(slots=True)
class AgentSelection(RuntimeModel):
    intent_type: str
    platforms: list[str] = field(default_factory=list)
    required: list[str] = field(default_factory=list)
    platform_required: dict[str, list[str]] = field(default_factory=dict)
    optional: list[str] = field(default_factory=list)
    conditional: dict[str, list[str]] = field(default_factory=dict)

    def validate(self) -> None:
        if not isinstance(self.intent_type, str) or not self.intent_type:
            raise RegistryError("AgentSelection.intent_type is required")

    @property
    def all_agent_ids(self) -> list[str]:
        result: list[str] = []
        for agent_id in self.required:
            append_unique(result, agent_id)
        for platform in self.platforms:
            for agent_id in self.platform_required.get(platform, []):
                append_unique(result, agent_id)
        for agent_id in self.optional:
            append_unique(result, agent_id)
        for agent_ids in self.conditional.values():
            for agent_id in agent_ids:
                append_unique(result, agent_id)
        return result


@dataclass(slots=True)
class AgentRegistry(RuntimeModel):
    root: str
    manifest: dict[str, Any]
    agents_index: dict[str, Any]
    agents: dict[str, AgentRegistryEntry]
    routing: dict[str, Any]
    capabilities: dict[str, Any]
    dependencies: dict[str, Any]
    quality_gates: dict[str, Any]

    def validate(self) -> None:
        if not self.agents:
            raise RegistryError("AgentRegistry.agents cannot be empty")

    @property
    def root_path(self) -> Path:
        return Path(self.root)

    def agent_ids(self) -> list[str]:
        return sorted(self.agents)

    def get_agent(self, agent_id: str) -> AgentRegistryEntry:
        try:
            return self.agents[agent_id]
        except KeyError as exc:
            raise RegistryError(f"Unknown agent: {agent_id}") from exc

    def get_agent_definition(self, agent_id: str) -> AgentDefinition:
        return self.get_agent(agent_id).to_agent_definition()

    def get_prompt(self, agent_id: str) -> str:
        entry = self.get_agent(agent_id)
        return self._read_text(entry.prompt_path)

    def get_schema(self, agent_id: str) -> dict[str, Any]:
        entry = self.get_agent(agent_id)
        return json.loads(self._read_text(entry.schema_path))

    def get_eval(self, agent_id: str) -> dict[str, Any]:
        entry = self.get_agent(agent_id)
        return load_yaml_file(self.registry_path(entry.eval_path))

    def agents_for_intent(
        self,
        intent_type: str | IntentType,
        *,
        platforms: Iterable[str] | None = None,
        include_optional: bool = False,
        include_conditional: bool = False,
    ) -> AgentSelection:
        intent_value = intent_type.value if isinstance(intent_type, IntentType) else intent_type
        intent_routing = self.routing.get("intent_routing", {})
        if intent_value not in intent_routing:
            raise RegistryError(f"Unknown intent routing: {intent_value}")

        raw_selection = intent_routing[intent_value]
        platform_list = list(platforms or [])

        required = list(raw_selection.get("required", []))
        platform_required = raw_selection.get("platform_required", {})
        for platform in platform_list:
            if platform_required and platform not in platform_required:
                raise RegistryError(
                    f"Unknown platform '{platform}' for intent {intent_value}"
                )
        optional = list(raw_selection.get("optional", [])) if include_optional else []
        conditional = raw_selection.get("conditional", {}) if include_conditional else {}

        return AgentSelection(
            intent_type=intent_value,
            platforms=platform_list,
            required=required,
            platform_required=platform_required,
            optional=optional,
            conditional=conditional,
        )

    def agent_definitions_for_intent(
        self,
        intent_type: str | IntentType,
        *,
        platforms: Iterable[str] | None = None,
        include_optional: bool = False,
        include_conditional: bool = False,
    ) -> list[AgentDefinition]:
        selection = self.agents_for_intent(
            intent_type,
            platforms=platforms,
            include_optional=include_optional,
            include_conditional=include_conditional,
        )
        return [self.get_agent_definition(agent_id) for agent_id in selection.all_agent_ids]

    def _read_text(self, relative_path: str) -> str:
        path = self.registry_path(relative_path)
        if not path.exists():
            raise RegistryError(f"Registry path not found: {relative_path}")
        return path.read_text(encoding="utf-8")

    def registry_path(self, relative_path: str) -> Path:
        candidate = Path(relative_path)
        if candidate.is_absolute():
            raise RegistryError(f"Registry path must be relative: {relative_path}")
        resolved = (self.root_path / candidate).resolve()
        try:
            resolved.relative_to(self.root_path)
        except ValueError as exc:
            raise RegistryError(f"Registry path escapes repo root: {relative_path}") from exc
        return resolved


class RegistryLoader:
    def __init__(self, repo_root: str | Path) -> None:
        self.repo_root = Path(repo_root).expanduser().resolve()

    def load(self) -> AgentRegistry:
        manifest = load_yaml_file(self.repo_root / "registry/manifest.yaml")
        agents_index = json.loads(
            (self.repo_root / "registry/agents/agents_index.json").read_text(encoding="utf-8")
        )

        manifest_body = require_mapping(manifest, "manifest").get("agent_registry")
        if not isinstance(manifest_body, dict):
            raise RegistryError("manifest.yaml must contain agent_registry")

        agents: dict[str, AgentRegistryEntry] = {}
        raw_agents = agents_index.get("agents")
        if not isinstance(raw_agents, list):
            raise RegistryError("agents_index.json must contain an agents list")

        seen_agent_ids: set[str] = set()
        for raw_index_entry in raw_agents:
            agent_id = raw_index_entry["agent_id"]
            if agent_id in seen_agent_ids:
                raise RegistryError(f"Duplicate agent in index: {agent_id}")
            seen_agent_ids.add(agent_id)
            entry_path = raw_index_entry["entry_path"]
            raw_agent = load_yaml_file(_registry_path(self.repo_root, entry_path))
            entry = build_agent_entry(entry_path, raw_agent)
            if entry.agent_id != agent_id:
                raise RegistryError(f"Agent index mismatch for {agent_id}")
            agents[agent_id] = entry

        routing = load_yaml_file(self.repo_root / "registry/routing/intents.yaml")
        capabilities = load_yaml_file(self.repo_root / "registry/routing/capabilities.yaml")
        dependencies = load_yaml_file(self.repo_root / "registry/routing/dependencies.yaml")
        quality_gates = load_yaml_file(self.repo_root / "registry/routing/quality_gates.yaml")

        return AgentRegistry(
            root=str(self.repo_root),
            manifest=manifest_body,
            agents_index=agents_index,
            agents=agents,
            routing=require_mapping(routing, "routing"),
            capabilities=require_mapping(capabilities, "capabilities"),
            dependencies=require_mapping(dependencies, "dependencies"),
            quality_gates=require_mapping(quality_gates, "quality_gates"),
        )


def load_registry(repo_root: str | Path) -> AgentRegistry:
    return RegistryLoader(repo_root).load()


def _registry_path(root: Path, relative_path: str) -> Path:
    candidate = Path(relative_path)
    if candidate.is_absolute():
        raise RegistryError(f"Registry path must be relative: {relative_path}")
    resolved = (root / candidate).resolve()
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise RegistryError(f"Registry path escapes repo root: {relative_path}") from exc
    return resolved


def build_agent_entry(entry_path: str, raw_agent: dict[str, Any]) -> AgentRegistryEntry:
    body = raw_agent.get("agent_registry_entry")
    if not isinstance(body, dict):
        raise RegistryError(f"Agent file has no agent_registry_entry: {entry_path}")

    identity = require_mapping(body.get("identity"), f"{entry_path}.identity")
    source = require_mapping(body.get("source"), f"{entry_path}.source")
    capabilities = require_mapping(body.get("capabilities"), f"{entry_path}.capabilities")
    inputs = require_mapping(body.get("inputs"), f"{entry_path}.inputs")
    outputs = require_mapping(body.get("outputs"), f"{entry_path}.outputs")

    primary_capabilities = list(capabilities.get("primary", []))
    secondary_capabilities = list(capabilities.get("secondary", []))

    return AgentRegistryEntry(
        agent_id=identity["agent_id"],
        name=identity["name"],
        version=identity["version"],
        status=identity["status"],
        entry_path=entry_path,
        prompt_path=source["prompt_path"],
        schema_path=source["schema_path"],
        eval_path=source["eval_path"],
        schema_name=outputs["schema_name"],
        capabilities=primary_capabilities + secondary_capabilities,
        required_inputs=list(inputs.get("required", [])),
        raw=body,
    )


def require_mapping(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise RegistryError(f"{label} must be an object")
    return value


def append_unique(values: list[str], item: str) -> None:
    if item not in values:
        values.append(item)
