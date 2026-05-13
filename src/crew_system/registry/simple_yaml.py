from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


class SimpleYamlError(ValueError):
    """Raised when a registry YAML file uses an unsupported shape."""


def load_yaml_file(path: str | Path) -> Any:
    return loads_yaml(Path(path).read_text(encoding="utf-8"))


def loads_yaml(content: str) -> Any:
    lines = _prepare_lines(content)
    if not lines:
        return {}

    result, index = _parse_block(lines, 0, lines[0][0])
    if index != len(lines):
        raise SimpleYamlError(f"Could not parse YAML near line {index + 1}")
    return result


def _prepare_lines(content: str) -> list[tuple[int, str]]:
    prepared: list[tuple[int, str]] = []
    for line_number, raw_line in enumerate(content.splitlines(), start=1):
        if not raw_line.strip():
            continue
        if raw_line.lstrip().startswith("#"):
            continue
        if "\t" in raw_line:
            raise SimpleYamlError(f"Tabs are not supported in YAML line {line_number}")
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        prepared.append((indent, raw_line.strip()))
    return prepared


def _parse_block(
    lines: list[tuple[int, str]],
    index: int,
    indent: int,
) -> tuple[Any, int]:
    if index >= len(lines):
        return {}, index

    current_indent, content = lines[index]
    if current_indent != indent:
        raise SimpleYamlError(
            f"Unexpected indentation at line {index + 1}: expected {indent}, got {current_indent}"
        )

    if content.startswith("-"):
        return _parse_list(lines, index, indent)
    return _parse_mapping(lines, index, indent)


def _parse_mapping(
    lines: list[tuple[int, str]],
    index: int,
    indent: int,
) -> tuple[dict[str, Any], int]:
    result: dict[str, Any] = {}

    while index < len(lines):
        current_indent, content = lines[index]
        if current_indent < indent:
            break
        if current_indent > indent:
            raise SimpleYamlError(f"Unexpected nested mapping at line {index + 1}")
        if content.startswith("-"):
            break

        key, raw_value = _split_key_value(content, index)
        if raw_value == "":
            next_index = index + 1
            if next_index >= len(lines) or lines[next_index][0] <= indent:
                result[key] = {}
                index = next_index
                continue
            child, index = _parse_block(lines, next_index, lines[next_index][0])
            result[key] = child
        else:
            result[key] = _parse_scalar(raw_value)
            index += 1

    return result, index


def _parse_list(
    lines: list[tuple[int, str]],
    index: int,
    indent: int,
) -> tuple[list[Any], int]:
    result: list[Any] = []

    while index < len(lines):
        current_indent, content = lines[index]
        if current_indent < indent:
            break
        if current_indent > indent:
            raise SimpleYamlError(f"Unexpected nested list at line {index + 1}")
        if not content.startswith("-"):
            break

        raw_item = content[1:].strip()
        next_index = index + 1

        if raw_item == "":
            if next_index >= len(lines) or lines[next_index][0] <= indent:
                result.append({})
                index = next_index
                continue
            child, index = _parse_block(lines, next_index, lines[next_index][0])
            result.append(child)
            continue

        if _looks_like_mapping_item(raw_item):
            key, raw_value = _split_key_value(raw_item, index)
            item: dict[str, Any] = {key: _parse_scalar(raw_value) if raw_value else {}}
            if next_index < len(lines) and lines[next_index][0] > indent:
                child, next_index = _parse_block(lines, next_index, lines[next_index][0])
                if isinstance(child, dict):
                    item.update(child)
                else:
                    raise SimpleYamlError(f"List mapping expected object at line {index + 1}")
            result.append(item)
            index = next_index
            continue

        result.append(_parse_scalar(raw_item))
        index += 1

    return result, index


def _split_key_value(content: str, index: int) -> tuple[str, str]:
    if ":" not in content:
        raise SimpleYamlError(f"Missing ':' in mapping line {index + 1}")
    key, raw_value = content.split(":", 1)
    key = key.strip()
    if not key:
        raise SimpleYamlError(f"Empty mapping key at line {index + 1}")
    return key, raw_value.strip()


def _looks_like_mapping_item(value: str) -> bool:
    if value.startswith('"') or value.startswith("'"):
        return False
    return bool(re.match(r"^[A-Za-z0-9_:-]+:", value))


def _parse_scalar(value: str) -> Any:
    if value == "[]":
        return []
    if value == "{}":
        return {}
    if value in {"true", "false"}:
        return value == "true"
    if value in {"null", "~"}:
        return None
    if value.startswith('"') and value.endswith('"'):
        return json.loads(value)
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1]
    if re.match(r"^-?[0-9]+$", value):
        return int(value)
    return value
