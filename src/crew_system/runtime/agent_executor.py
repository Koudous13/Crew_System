from __future__ import annotations

from dataclasses import dataclass

from crew_system.agents.runner import (
    AgentInputBuilder,
    AgentOutput,
    AgentRunResult,
    AgentRunner,
)
from crew_system.core.models import ContextSnapshot, NormalizedRequest, TaskNode
from crew_system.filesystem.workspace import WorkspaceEngine, utc_now
from crew_system.registry.loader import AgentRegistry


class AgentExecutionError(RuntimeError):
    """Raised when the runtime cannot execute or log an agent task."""


@dataclass(slots=True)
class AgentTaskExecutor:
    workspace: WorkspaceEngine
    registry: AgentRegistry
    runner: AgentRunner

    def execute(
        self,
        *,
        project_slug: str,
        task_node: TaskNode,
        request: NormalizedRequest,
        context: ContextSnapshot,
        upstream_outputs: dict[str, AgentOutput] | None = None,
    ) -> AgentRunResult:
        builder = AgentInputBuilder(self.registry)
        agent_input = builder.build(
            task_node=task_node,
            request=request,
            context=context,
            upstream_outputs=upstream_outputs,
        )
        try:
            result = self.runner.run(agent_input)
        except Exception as exc:
            raise AgentExecutionError(f"Runner crashed for {task_node.agent_id}: {exc}") from exc

        self.workspace.append_agent_run_log(
            project_slug,
            {
                **result.agent_run.to_dict(),
                "schema_validation": result.schema_validation.to_dict(),
                "logged_at": utc_now(),
            },
        )
        if result.error:
            self.workspace.append_error_log(
                project_slug,
                {
                    "job_id": task_node.job_id,
                    "task_id": task_node.task_id,
                    "agent_id": task_node.agent_id,
                    "error": result.error,
                    "logged_at": utc_now(),
                },
            )
        return result
