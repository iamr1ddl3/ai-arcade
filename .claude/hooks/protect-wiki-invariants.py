#!/usr/bin/env python3
"""
protect-wiki-invariants.py
Pre-tool-use hook for Edit / Write / MultiEdit. Enforces two invariants:

  1. raw/ is IMMUTABLE — never modify any file under raw/
  2. wiki/log.md is APPEND-ONLY — never modify or remove an existing line

Exit 0 = allow. Exit 1 = block (with reason on stderr).

If your wiki lives at a different path (e.g. ../wiki/), update the LOG_PATHS
set near the bottom of main().
"""

import json
import os
import sys
from pathlib import Path


def block(reason: str, path: str) -> None:
    sys.stderr.write(
        f"BLOCKED by .claude/hooks/protect-wiki-invariants.py: {reason}\n"
        f"Target path: {path}\n"
    )
    sys.exit(1)


def normalize(path: str) -> str:
    """Return a forward-slash relative path from the project root, lowercased."""
    try:
        p = Path(path).resolve()
        cwd = Path(os.getcwd()).resolve()
        try:
            rel = p.relative_to(cwd)
        except ValueError:
            rel = p
        return str(rel).replace("\\", "/").lower()
    except Exception:
        return path.replace("\\", "/").lower()


def is_under(rel: str, prefix: str) -> bool:
    prefix = prefix.rstrip("/").lower()
    return rel == prefix or rel.startswith(prefix + "/")


def check_log_append_only(path: str, new_content: str) -> None:
    """For Write tool on log.md: ensure existing content is preserved as a prefix."""
    try:
        existing = Path(path).read_text(encoding="utf-8")
    except FileNotFoundError:
        return  # creating the file for the first time is fine
    except Exception:
        return  # can't read — let it through, other safeguards apply
    if not new_content.startswith(existing):
        block(
            "wiki/log.md is append-only — existing content must be preserved verbatim "
            "as a prefix of the new content. Use Write with full file content including "
            "all existing entries followed by the new entry.",
            path,
        )


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    tool_name = payload.get("tool_name", "")
    tool_input = payload.get("tool_input", {}) or {}

    # Resolve the target path (Edit/Write use file_path; some variants use path)
    target = tool_input.get("file_path") or tool_input.get("path") or ""
    if not target:
        sys.exit(0)

    rel = normalize(target)

    # ── Invariant 1: raw/ is immutable ───────────────────────────────────────
    if is_under(rel, "raw"):
        block("raw/ is immutable — source inputs must never be modified", target)

    # ── Invariant 2: append-only files ───────────────────────────────────────
    # Files that must never have their existing content modified. Writes are
    # allowed only when new content starts with the existing content verbatim.
    # Add "../wiki/log.md" etc here if your wiki is one level up (shared setup).
    LOG_PATHS = {"wiki/log.md", "wiki/milestones.md"}

    if rel in LOG_PATHS:
        if tool_name in ("Edit", "MultiEdit"):
            block(
                f"{rel} is append-only — use the Write tool to append a new entry. "
                f"Never use Edit on this file.",
                target,
            )
        if tool_name == "Write":
            new_content = tool_input.get("content", "") or ""
            check_log_append_only(target, new_content)

    sys.exit(0)


if __name__ == "__main__":
    main()
