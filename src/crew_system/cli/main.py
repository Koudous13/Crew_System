from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterable, Mapping

from crew_system import __version__
from crew_system.agents import AgentRunner, MockAgentRunner, deepseek_agent_runner_from_env
from crew_system.config import CrewSystemSettings
from crew_system.filesystem import WorkspaceEngine
from crew_system.jobs import JobStore, JobStoreError, LocalWorker
from crew_system.llm import DeepSeekConfigurationError
from crew_system.registry import validate_registry


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="crew-system",
        description="Crew_System local command line tools.",
    )
    subparsers = parser.add_subparsers(dest="command")

    doctor = subparsers.add_parser(
        "doctor",
        help="Check the local Crew_System foundation.",
    )
    doctor.add_argument(
        "--repo-root",
        default=None,
        help="Repository root to inspect. Defaults to auto-discovery.",
    )
    doctor.add_argument(
        "--json",
        action="store_true",
        help="Print machine-readable JSON.",
    )
    doctor.set_defaults(handler=run_doctor)

    init_workspace = subparsers.add_parser(
        "init-workspace",
        help="Initialize a Crew_System workspace.",
    )
    add_runtime_options(init_workspace)
    init_workspace.set_defaults(handler=run_init_workspace)

    create_project = subparsers.add_parser(
        "create-project",
        help="Create a project in the workspace.",
    )
    create_project.add_argument("name", help="Human project name.")
    create_project.add_argument("--description", default="", help="Project description.")
    add_runtime_options(create_project)
    create_project.set_defaults(handler=run_create_project)

    registry = subparsers.add_parser("registry", help="Registry commands.")
    registry_subparsers = registry.add_subparsers(dest="registry_command")
    registry_validate = registry_subparsers.add_parser("validate", help="Validate registry files.")
    add_runtime_options(registry_validate)
    registry_validate.set_defaults(handler=run_registry_validate)

    project = subparsers.add_parser("project", help="Project commands.")
    project_subparsers = project.add_subparsers(dest="project_command")
    project_inspect = project_subparsers.add_parser("inspect", help="Inspect a project manifest.")
    project_inspect.add_argument("project_slug")
    add_runtime_options(project_inspect)
    project_inspect.set_defaults(handler=run_project_inspect)

    job = subparsers.add_parser("job", help="Job commands.")
    job_subparsers = job.add_subparsers(dest="job_command")
    job_status = job_subparsers.add_parser("status", help="Read a job status from project logs.")
    job_status.add_argument("job_id")
    job_status.add_argument("--project", required=True, help="Project slug.")
    add_runtime_options(job_status)
    job_status.set_defaults(handler=run_job_status)

    run = subparsers.add_parser("run", help="Run a local job.")
    run_subparsers = run.add_subparsers(dest="run_command")
    for command_name in ["campaign-pack", "annual-calendar", "content-batch"]:
        run_command = run_subparsers.add_parser(command_name, help=f"Run {command_name}.")
        run_command.add_argument("--project", required=True, help="Project slug.")
        run_command.add_argument("--message", default="", help="Override user request message.")
        run_command.add_argument("--mock", action="store_true", help="Use deterministic mock runner.")
        run_command.add_argument(
            "--provider",
            choices=["auto", "mock", "deepseek"],
            default="auto",
            help="Runner provider. auto uses DeepSeek when configured, otherwise mock.",
        )
        if command_name == "content-batch":
            run_command.add_argument("--platform", default="facebook", choices=["facebook", "linkedin"])
            run_command.add_argument("--count", type=int, default=10)
        add_runtime_options(run_command)
        run_command.set_defaults(handler=run_local_job, run_kind=command_name)

    return parser


def run_doctor(args: argparse.Namespace) -> int:
    try:
        settings = CrewSystemSettings.discover(start=args.repo_root)
        payload = build_doctor_payload(settings)
    except Exception as exc:  # pragma: no cover - defensive CLI boundary
        payload = {
            "ok": False,
            "version": __version__,
            "error": str(exc),
            "checks": [],
        }

    if args.json:
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        print_human_doctor(payload)

    return 0 if payload["ok"] else 1


def run_init_workspace(args: argparse.Namespace) -> int:
    settings, workspace_root = runtime_settings(args)
    manifest = WorkspaceEngine(workspace_root).initialize_workspace()
    payload = {
        "ok": True,
        "workspace_root": str(workspace_root),
        "manifest": manifest.to_dict(),
        "repo_root": str(settings.repo_root),
    }
    print_payload(payload, args.json)
    return 0


def run_create_project(args: argparse.Namespace) -> int:
    _, workspace_root = runtime_settings(args)
    project = WorkspaceEngine(workspace_root).create_project(
        args.name,
        description=args.description,
    )
    payload = {
        "ok": True,
        "project": project.to_dict(),
        "workspace_root": str(workspace_root),
    }
    print_payload(payload, args.json)
    return 0


def run_registry_validate(args: argparse.Namespace) -> int:
    settings, _ = runtime_settings(args)
    report = validate_registry(settings.repo_root)
    payload = report.to_dict()
    payload["ok"] = report.ok
    print_payload(payload, args.json)
    return 0 if report.ok else 1


def run_project_inspect(args: argparse.Namespace) -> int:
    _, workspace_root = runtime_settings(args)
    manifest = WorkspaceEngine(workspace_root).load_project_manifest(args.project_slug)
    payload = {
        "ok": True,
        "project": manifest.to_dict(),
    }
    print_payload(payload, args.json)
    return 0


def run_job_status(args: argparse.Namespace) -> int:
    _, workspace_root = runtime_settings(args)
    engine = WorkspaceEngine(workspace_root)
    store = JobStore(engine)
    store_error = ""
    try:
        stored = store.load(args.project, args.job_id)
        payload = {"ok": True, "job": stored.to_dict()}
        print_payload(payload, args.json)
        return 0
    except JobStoreError as exc:
        store_error = str(exc)

    project_root = engine.project_path(args.project)
    job_log = project_root / "logs/jobs.jsonl"
    if not job_log.exists():
        payload = {"ok": False, "error": f"No job log found for project {args.project}"}
        print_payload(payload, args.json)
        return 1
    matches = [
        json.loads(line)
        for line in job_log.read_text(encoding="utf-8").splitlines()
        if line.strip() and json.loads(line).get("job_id") == args.job_id
    ]
    if not matches:
        payload = {"ok": False, "error": f"Job not found: {args.job_id}", "store_error": store_error}
        print_payload(payload, args.json)
        return 1
    payload = {"ok": True, "job": matches[-1]}
    print_payload(payload, args.json)
    return 0


def run_local_job(args: argparse.Namespace) -> int:
    settings, workspace_root = runtime_settings(args)
    try:
        runner, provider_used = runner_for_provider(args.provider, args.mock)
    except DeepSeekConfigurationError as exc:
        payload = {"ok": False, "error": str(exc), "provider": "deepseek"}
        print_payload(payload, args.json)
        return 1
    worker = LocalWorker(
        repo_root=settings.repo_root,
        workspace_root=workspace_root,
        runner=runner,
    )
    stored = worker.enqueue(
        project_slug=args.project,
        message=message_for_run(args),
        active_project_hint=args.project,
    )
    worker_result = worker.run(project_slug=args.project, job_id=stored.job_id)
    result = worker_result.local_result
    stored = worker_result.stored_job
    if result is None:
        payload = {
            "ok": False,
            "job": stored.to_dict(),
            "final_response": {},
            "agents_used": stored.agents_used,
            "provider": provider_used,
            "artifacts": [],
            "errors": [stored.error] if stored.error else [],
        }
        print_payload(payload, args.json)
        return 1
    payload = {
        "ok": result.job.status.value in {"completed", "needs_revision"},
        "job": stored.to_dict(),
        "final_response": result.final_response.to_dict(),
        "agents_used": result.agents_used,
        "provider": provider_used,
        "artifacts": [
            artifact.to_dict()
            for artifact in (result.write_result.artifacts if result.write_result else [])
        ],
        "errors": result.errors,
    }
    print_payload(payload, args.json)
    return 0 if payload["ok"] else 1


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
    try:
        return deepseek_agent_runner_from_env(env), "deepseek"
    except DeepSeekConfigurationError:
        return MockAgentRunner(), "mock"


def build_doctor_payload(settings: CrewSystemSettings) -> dict[str, Any]:
    checks = [
        check_path("repo_root", settings.repo_root),
        check_path("docs_root", settings.docs_root),
        check_path("registry_root", settings.registry_root),
        check_path("registry_manifest", settings.registry_root / "manifest.yaml"),
        check_path("agent_machine_registry_doc", settings.docs_root / "AGENT_MACHINE_REGISTRY.md"),
        check_path("implementation_plan", settings.docs_root / "SYSTEM_IMPLEMENTATION_PLAN.md"),
    ]
    return {
        "ok": all(check["exists"] for check in checks),
        "version": __version__,
        "repo_root": str(settings.repo_root),
        "workspace_root": str(settings.workspace_root),
        "registry_root": str(settings.registry_root),
        "docs_root": str(settings.docs_root),
        "checks": checks,
    }


def add_runtime_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--repo-root",
        default=None,
        help="Repository root. Defaults to auto-discovery.",
    )
    parser.add_argument(
        "--workspace-root",
        default=None,
        help="Workspace root. Defaults to settings discovery.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print machine-readable JSON.",
    )


def runtime_settings(args: argparse.Namespace) -> tuple[CrewSystemSettings, Path]:
    settings = CrewSystemSettings.discover(start=getattr(args, "repo_root", None))
    workspace_root = (
        Path(args.workspace_root).expanduser().resolve()
        if getattr(args, "workspace_root", None)
        else settings.workspace_root
    )
    return settings, workspace_root


def message_for_run(args: argparse.Namespace) -> str:
    if args.run_kind == "campaign-pack":
        return args.message or f"Cree le campaign pack pour le projet {args.project}."
    if args.run_kind == "annual-calendar":
        return args.message or f"Cree le calendrier editorial annuel pour le projet {args.project}."
    base_message = args.message or f"Genere des publications pour le projet {args.project}."
    return (
        f"{base_message} "
        f"Volume cible: {args.count} publications {args.platform}. "
        f"Plateforme cible: {args.platform}."
    )


def check_path(name: str, path: Any) -> dict[str, Any]:
    path_string = str(path)
    exists = path.exists()
    return {
        "name": name,
        "path": path_string,
        "exists": exists,
    }


def print_human_doctor(payload: dict[str, Any]) -> None:
    status = "OK" if payload["ok"] else "FAILED"
    print(f"Crew_System doctor: {status}")
    print(f"version: {payload.get('version', 'unknown')}")

    if payload.get("error"):
        print(f"error: {payload['error']}")
        return

    print(f"repo_root: {payload['repo_root']}")
    print(f"workspace_root: {payload['workspace_root']}")
    for check in payload["checks"]:
        marker = "OK" if check["exists"] else "MISSING"
        print(f"- {marker} {check['name']}: {check['path']}")


def print_payload(payload: dict[str, Any], as_json: bool) -> None:
    if as_json:
        print(json.dumps(payload, indent=2, sort_keys=True))
        return
    status = "OK" if payload.get("ok") else "FAILED"
    print(f"Crew_System: {status}")
    if payload.get("error"):
        print(f"error: {payload['error']}")
    if payload.get("workspace_root"):
        print(f"workspace_root: {payload['workspace_root']}")
    if payload.get("project"):
        project = payload["project"]
        print(f"project: {project.get('project_slug', project.get('project_name', 'unknown'))}")
    if payload.get("job"):
        job = payload["job"]
        print(f"job_id: {job.get('job_id')}")
        print(f"status: {job.get('status')}")
    if payload.get("agents_used"):
        print(f"agents_used: {', '.join(payload['agents_used'])}")
    if payload.get("artifacts"):
        print("artifacts:")
        for artifact in payload["artifacts"]:
            print(f"- {artifact['path']}")


def main(argv: Iterable[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)

    if not hasattr(args, "handler"):
        args = parser.parse_args(["doctor"])

    return args.handler(args)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
