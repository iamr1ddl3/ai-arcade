#!/usr/bin/env python3
"""
wiki-edit-log.py
Post-tool-use hook for Edit / Write / MultiEdit. Non-blocking.

Logs every file edit to .claude/edit-log.txt with:
  [ISO-8601 UTC timestamp] ToolName -> file/path

Provides a lightweight audit trail for wiki and code changes within the session.
No user-visible output — errors are silently swallowed so Claude is never blocked.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    tool_name = payload.get("tool_name", "unknown")
    tool_input = payload.get("tool_input", {}) or {}
    file_path = tool_input.get("file_path") or tool_input.get("path") or "unknown"

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    log_path = Path(".claude") / "edit-log.txt"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with log_path.open("a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] {tool_name} -> {file_path}\n")
    except Exception:
        pass  # non-blocking — never raise

    sys.exit(0)


if __name__ == "__main__":
    main()
