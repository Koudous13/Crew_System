from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Iterable

from crew_system import __version__
from crew_system.config import CrewSystemSettings


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


def main(argv: Iterable[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)

    if not hasattr(args, "handler"):
        args = parser.parse_args(["doctor"])

    return args.handler(args)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
