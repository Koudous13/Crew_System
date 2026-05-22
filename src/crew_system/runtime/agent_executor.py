from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from crew_system.agents.runner import (
    AgentInputBuilder,
    AgentOutput,
    AgentRunResult,
    AgentRunner,
    build_failed_result,
    build_run_result,
)
from crew_system.core.models import ContextSnapshot, JobStatus, NormalizedRequest, Platform, RequestedVolume, TaskNode
from crew_system.filesystem.workspace import WorkspaceEngine, utc_now
from crew_system.registry.loader import AgentRegistry

COPYWRITER_CHUNK_SIZE = 1
ProgressCallback = Callable[[JobStatus, str, int, str, list[str]], None]


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
        progress_callback: ProgressCallback | None = None,
        progress_start_percent: int = 24,
        progress_done_percent: int = 80,
    ) -> AgentRunResult:
        if should_chunk_copywriter(task_node, request):
            result = self._execute_copywriter_chunks(
                project_slug=project_slug,
                task_node=task_node,
                request=request,
                context=context,
                upstream_outputs=upstream_outputs,
                progress_callback=progress_callback,
                progress_start_percent=progress_start_percent,
                progress_done_percent=progress_done_percent,
            )
            self._log_result(project_slug, task_node, result)
            return result

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

        self._log_result(project_slug, task_node, result)
        return result

    def _execute_copywriter_chunks(
        self,
        *,
        project_slug: str,
        task_node: TaskNode,
        request: NormalizedRequest,
        context: ContextSnapshot,
        upstream_outputs: dict[str, AgentOutput] | None,
        progress_callback: ProgressCallback | None,
        progress_start_percent: int,
        progress_done_percent: int,
    ) -> AgentRunResult:
        builder = AgentInputBuilder(self.registry)
        base_input = builder.build(
            task_node=task_node,
            request=request,
            context=context,
            upstream_outputs=upstream_outputs,
        )
        chunks = copywriter_chunks(request)
        combined_units: dict[str, Any] = {}
        chunk_errors: list[str] = []
        sequence = 1
        report_progress(
            progress_callback,
            "Le copywriter découpe la production pour rédiger chaque publication séparément.",
            progress_start_percent,
            "agent:copywriter:chunking",
        )
        for chunk_index, chunk in enumerate(chunks, start=1):
            chunk_start_percent = chunk_progress_percent(
                chunk_index - 1,
                len(chunks),
                progress_start_percent,
                progress_done_percent,
            )
            chunk_done_percent = chunk_progress_percent(
                chunk_index,
                len(chunks),
                progress_start_percent,
                progress_done_percent,
            )
            report_progress(
                progress_callback,
                copywriter_chunk_message(chunk, chunk_index, len(chunks), done=False),
                chunk_start_percent,
                f"agent:copywriter:chunk:{chunk_index:03d}:running",
            )
            chunk_task = TaskNode(
                task_id=f"{task_node.task_id}_chunk_{chunk_index:03d}",
                job_id=task_node.job_id,
                task_type=task_node.task_type,
                agent_id=task_node.agent_id,
                reason=f"{task_node.reason}; copywriter_chunk:{chunk_index}/{len(chunks)}",
                input_artifacts=task_node.input_artifacts,
                output_artifacts=task_node.output_artifacts,
                max_retries=task_node.max_retries,
            )
            chunk_request = request_for_copywriter_chunk(request, chunk, chunk_index, len(chunks))
            chunk_input = builder.build(
                task_node=chunk_task,
                request=chunk_request,
                context=context,
                upstream_outputs=upstream_outputs,
            )
            try:
                chunk_result = self.runner.run(chunk_input)
            except Exception as exc:
                chunk_result = build_failed_result(chunk_input, f"Runner crashed for copywriter chunk: {exc}")
            self._log_result(project_slug, chunk_task, chunk_result)
            if chunk_result.error:
                chunk_errors.append(f"chunk_{chunk_index:03d}: {chunk_result.error}")
                report_progress(
                    progress_callback,
                    copywriter_chunk_message(chunk, chunk_index, len(chunks), done=True, failed=True),
                    chunk_done_percent,
                    f"agent:copywriter:chunk:{chunk_index:03d}:failed",
                )
                continue
            if chunk_result.output is None:
                chunk_errors.append(f"chunk_{chunk_index:03d}: missing output")
                report_progress(
                    progress_callback,
                    copywriter_chunk_message(chunk, chunk_index, len(chunks), done=True, failed=True),
                    chunk_done_percent,
                    f"agent:copywriter:chunk:{chunk_index:03d}:failed",
                )
                continue
            units = content_units_from_payload(chunk_result.output.payload)
            if not units:
                chunk_errors.append(f"chunk_{chunk_index:03d}: no content_units")
                report_progress(
                    progress_callback,
                    copywriter_chunk_message(chunk, chunk_index, len(chunks), done=True, failed=True),
                    chunk_done_percent,
                    f"agent:copywriter:chunk:{chunk_index:03d}:failed",
                )
                continue
            for _, unit in sorted(units.items()):
                if not isinstance(unit, dict):
                    continue
                platform = chunk.platform or clean_platform(unit.get("platform", ""))
                unit_id = f"{platform or 'unit'}_{sequence:03d}"
                combined_units[unit_id] = {**unit, "platform": platform or unit.get("platform", "")}
                sequence += 1
            report_progress(
                progress_callback,
                copywriter_chunk_message(chunk, chunk_index, len(chunks), done=True),
                chunk_done_percent,
                f"agent:copywriter:chunk:{chunk_index:03d}:done",
            )

        if not combined_units:
            return build_failed_result(
                base_input,
                "Copywriter chunks produced no usable content_units"
                + (": " + "; ".join(chunk_errors) if chunk_errors else ""),
            )
        payload = {
            "content_units": combined_units,
            "self_evaluation": {
                "quality_score": 8 if not chunk_errors else 6,
                "confidence_score": 8 if not chunk_errors else 6,
                "weakest_point": "chunked_generation" if not chunk_errors else "; ".join(chunk_errors[:3]),
                "next_improvement": (
                    "review generated units for consistency"
                    if not chunk_errors
                    else "rerun failed copywriter chunks before final approval"
                ),
            },
        }
        return build_run_result(base_input, payload, started_at=utc_now())

    def _log_result(
        self,
        project_slug: str,
        task_node: TaskNode,
        result: AgentRunResult,
    ) -> None:
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


@dataclass(slots=True)
class CopywriterChunk:
    platform: str
    index: int
    total_for_platform: int
    global_index: int
    total: int


def should_chunk_copywriter(task_node: TaskNode, request: NormalizedRequest) -> bool:
    return task_node.agent_id == "copywriter" and len(copywriter_chunks(request)) > 1


def report_progress(
    progress_callback: ProgressCallback | None,
    message: str,
    percent_estimate: int,
    current_phase: str,
) -> None:
    if progress_callback is None:
        return
    progress_callback(
        JobStatus.RUNNING,
        message,
        max(1, min(99, percent_estimate)),
        current_phase,
        ["copywriter"],
    )


def chunk_progress_percent(
    completed_chunks: int,
    total_chunks: int,
    start_percent: int,
    done_percent: int,
) -> int:
    if total_chunks <= 0:
        return start_percent
    span = max(done_percent - start_percent, 1)
    return start_percent + round((completed_chunks / total_chunks) * span)


def copywriter_chunk_message(
    chunk: CopywriterChunk,
    chunk_index: int,
    chunk_count: int,
    *,
    done: bool,
    failed: bool = False,
) -> str:
    platform = f" {chunk.platform}" if chunk.platform else ""
    if failed:
        return (
            f"Copywriter n'a pas pu stabiliser la publication {chunk.index}/{chunk.total_for_platform}"
            f"{platform}. Chunk {chunk_index}/{chunk_count} à reprendre."
        )
    if done:
        return (
            f"Copywriter a terminé la publication {chunk.index}/{chunk.total_for_platform}"
            f"{platform}. Chunk {chunk_index}/{chunk_count} intégré."
        )
    return (
        f"Copywriter rédige la publication {chunk.index}/{chunk.total_for_platform}"
        f"{platform}. Chunk {chunk_index}/{chunk_count}."
    )


def copywriter_chunks(request: NormalizedRequest) -> list[CopywriterChunk]:
    per_platform = request.intent.requested_volume.per_platform
    chunks: list[CopywriterChunk] = []
    total = requested_total_items(request)
    global_index = 1
    if per_platform:
        for platform, count in per_platform.items():
            safe_count = max(int(count), 0)
            for index in range(1, safe_count + 1):
                chunks.append(
                    CopywriterChunk(
                        platform=clean_platform(platform),
                        index=index,
                        total_for_platform=safe_count,
                        global_index=global_index,
                        total=total,
                    )
                )
                global_index += 1
        return chunks

    platform = request.intent.platforms[0].value if len(request.intent.platforms) == 1 else ""
    for index in range(1, total + 1):
        chunks.append(
            CopywriterChunk(
                platform=platform,
                index=index,
                total_for_platform=total,
                global_index=index,
                total=total,
            )
        )
    return chunks


def requested_total_items(request: NormalizedRequest) -> int:
    volume = request.intent.requested_volume
    if volume.total_items > 0:
        return volume.total_items
    if volume.per_platform:
        return sum(max(int(count), 0) for count in volume.per_platform.values())
    return 1


def request_for_copywriter_chunk(
    request: NormalizedRequest,
    chunk: CopywriterChunk,
    chunk_index: int,
    chunk_count: int,
) -> NormalizedRequest:
    data = request.to_dict()
    data["request_id"] = f"{request.request_id}_copy_{chunk_index:03d}"
    platform_label = f" {chunk.platform}" if chunk.platform else ""
    data["normalized_message"] = (
        f"{request.normalized_message}\n\n"
        "CONTRAINTE D'EXECUTION: redige uniquement 1 publication"
        f"{platform_label}. Chunk {chunk_index}/{chunk_count}. "
        f"Publication {chunk.index}/{chunk.total_for_platform} pour cette plateforme. "
        "Ne redige pas les autres publications. La sortie doit rester ContentUnits."
    )
    data["intent"]["requested_volume"] = RequestedVolume(
        total_items=COPYWRITER_CHUNK_SIZE,
        per_platform={chunk.platform: COPYWRITER_CHUNK_SIZE} if chunk.platform else {},
    ).to_dict()
    if chunk.platform in {platform.value for platform in Platform}:
        data["intent"]["platforms"] = [chunk.platform]
    return NormalizedRequest.from_dict(data)


def content_units_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    units = payload.get("content_units")
    if isinstance(units, dict):
        return normalize_content_units(units)
    if isinstance(units, list):
        return list_to_unit_dict(units)
    return {}


def normalize_content_units(units: dict[str, Any]) -> dict[str, Any]:
    for key in ["items", "posts", "publications", "units"]:
        value = units.get(key)
        if isinstance(value, list):
            return list_to_unit_dict(value)
    return units


def list_to_unit_dict(items: list[Any]) -> dict[str, Any]:
    return {
        f"unit_{index:03d}": item if isinstance(item, dict) else {"value": item}
        for index, item in enumerate(items, start=1)
    }


def clean_platform(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {platform.value for platform in Platform}:
        return normalized
    return normalized
