from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from crew_system.core.models import RuntimeModel
from crew_system.registry.loader import AgentRegistry, RegistryError, load_registry

DEPENDENCY_MARKERS = {
    "platform_agents",
    "content_or_strategy_generated",
    "performance_data_available",
    "hook_master_by_angle_group",
    "copywriter_by_content_group",
}


@dataclass(slots=True)
class RegistryValidationReport(RuntimeModel):
    ok: bool
    agent_count: int
    draft_agent_count: int
    active_agent_count: int
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def validate(self) -> None:
        if type(self.ok) is not bool:
            raise RegistryError("RegistryValidationReport.ok must be boolean")
        if self.agent_count < 0:
            raise RegistryError("RegistryValidationReport.agent_count cannot be negative")

    def raise_for_errors(self) -> None:
        if self.errors:
            joined = "\n".join(self.errors)
            raise RegistryError(f"Registry validation failed:\n{joined}")


class RegistryValidator:
    def __init__(self, registry: AgentRegistry) -> None:
        self.registry = registry
        self.root = registry.root_path
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def validate(self) -> RegistryValidationReport:
        self.errors = []
        self.warnings = []

        self._validate_manifest()
        self._validate_agents()
        self._validate_routing()
        self._validate_dependencies()
        self._validate_quality_gates()

        draft_agents = [
            agent_id for agent_id, entry in self.registry.agents.items() if entry.status == "draft"
        ]
        active_agents = [
            agent_id for agent_id, entry in self.registry.agents.items() if entry.status == "active"
        ]

        return RegistryValidationReport(
            ok=not self.errors,
            agent_count=len(self.registry.agents),
            draft_agent_count=len(draft_agents),
            active_agent_count=len(active_agents),
            errors=self.errors,
            warnings=self.warnings,
        )

    def _validate_manifest(self) -> None:
        manifest = self.registry.manifest
        required_keys = [
            "registry_id",
            "version",
            "schema_version",
            "agents_root",
            "schemas_root",
            "prompts_root",
            "evals_root",
            "routing_root",
        ]
        for key in required_keys:
            if not manifest.get(key):
                self.errors.append(f"manifest missing {key}")

        declared_agents = set()
        for key in ["active_agents", "draft_agents", "disabled_agents", "deprecated_agents"]:
            value = manifest.get(key, [])
            if not isinstance(value, list):
                self.errors.append(f"manifest {key} must be a list")
                continue
            declared_agents.update(value)

        loaded_agents = set(self.registry.agents)
        missing_from_manifest = loaded_agents - declared_agents
        missing_files = declared_agents - loaded_agents
        if missing_from_manifest:
            self.errors.append(f"agents missing from manifest: {sorted(missing_from_manifest)}")
        if missing_files:
            self.errors.append(f"manifest references unloaded agents: {sorted(missing_files)}")

    def _validate_agents(self) -> None:
        index_agents = self.registry.agents_index.get("agents", [])
        if len(index_agents) != len(self.registry.agents):
            self.errors.append("agents_index count does not match loaded agents")

        for agent_id, entry in self.registry.agents.items():
            if entry.status not in {"draft", "active", "disabled", "deprecated"}:
                self.errors.append(f"{agent_id} has invalid status {entry.status}")

            for relative_path in [
                entry.entry_path,
                entry.prompt_path,
                entry.schema_path,
                entry.eval_path,
            ]:
                self._require_file(relative_path)

            prompt_path = self.root / entry.prompt_path
            if prompt_path.exists() and not prompt_path.read_text(encoding="utf-8").strip():
                self.errors.append(f"{agent_id} prompt is empty")

            self._validate_schema(agent_id, entry.schema_path)
            self._validate_eval(agent_id, entry.eval_path, entry.schema_name)

            try:
                entry.to_agent_definition()
            except Exception as exc:
                self.errors.append(f"{agent_id} cannot become AgentDefinition: {exc}")

    def _validate_schema(self, agent_id: str, relative_path: str) -> None:
        path = self.root / relative_path
        if not path.exists():
            return
        try:
            schema = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            self.errors.append(f"{agent_id} schema is invalid JSON: {exc}")
            return
        if schema.get("type") != "object":
            self.errors.append(f"{agent_id} schema must be an object schema")

    def _validate_eval(self, agent_id: str, relative_path: str, schema_name: str) -> None:
        try:
            eval_body = self.registry.get_eval(agent_id).get("agent_eval", {})
        except Exception as exc:
            self.errors.append(f"{agent_id} eval cannot be loaded: {exc}")
            return
        if eval_body.get("agent_id") != agent_id:
            self.errors.append(f"{agent_id} eval agent_id mismatch")
        if eval_body.get("target_schema") != schema_name:
            self.errors.append(f"{agent_id} eval target_schema mismatch")

    def _validate_routing(self) -> None:
        routing = self.registry.routing
        intent_routing = routing.get("intent_routing")
        if not isinstance(intent_routing, dict) or not intent_routing:
            self.errors.append("intent_routing is missing")
            return

        for intent_type, selection in intent_routing.items():
            if not isinstance(selection, dict):
                self.errors.append(f"routing for {intent_type} must be an object")
                continue
            referenced = collect_agent_ids(selection)
            for agent_id in referenced:
                if agent_id not in self.registry.agents:
                    self.errors.append(f"routing {intent_type} references unknown agent {agent_id}")

        platform_routing = routing.get("platform_routing", {})
        for platform, config in platform_routing.items():
            agent_id = config.get("required_agent") if isinstance(config, dict) else None
            if agent_id not in self.registry.agents:
                self.errors.append(f"platform {platform} references unknown agent {agent_id}")

    def _validate_dependencies(self) -> None:
        rules = self.registry.dependencies.get("dependency_rules", {})
        if not isinstance(rules, dict):
            self.errors.append("dependency_rules must be an object")
            return

        for agent_id, dependency_rule in rules.items():
            if agent_id not in self.registry.agents:
                self.errors.append(f"dependencies reference unknown agent {agent_id}")
                continue
            if not isinstance(dependency_rule, dict):
                self.errors.append(f"dependency rule for {agent_id} must be an object")
                continue
            for dependency in dependency_rule.get("should_run_after", []):
                if dependency in DEPENDENCY_MARKERS:
                    continue
                if dependency not in self.registry.agents:
                    self.errors.append(
                        f"dependency for {agent_id} references unknown agent {dependency}"
                    )

    def _validate_quality_gates(self) -> None:
        gates = self.registry.quality_gates.get("quality_gates", {})
        if not isinstance(gates, dict) or not gates:
            self.errors.append("quality_gates is missing")
            return
        for required_gate in [
            "schema_gate",
            "context_gate",
            "intensity_preservation_gate",
            "risk_gate",
            "handoff_gate",
        ]:
            if required_gate not in gates:
                self.errors.append(f"quality gate missing {required_gate}")

    def _require_file(self, relative_path: str) -> None:
        try:
            path = self.registry.registry_path(relative_path)
        except RegistryError as exc:
            self.errors.append(str(exc))
            return
        if not path.exists():
            self.errors.append(f"missing registry file: {relative_path}")


def validate_registry(repo_root: str | Path) -> RegistryValidationReport:
    registry = load_registry(repo_root)
    return RegistryValidator(registry).validate()


def collect_agent_ids(value: Any) -> list[str]:
    found: list[str] = []
    if isinstance(value, str):
        found.append(value)
    elif isinstance(value, list):
        for item in value:
            found.extend(collect_agent_ids(item))
    elif isinstance(value, dict):
        for item in value.values():
            found.extend(collect_agent_ids(item))
    return found
