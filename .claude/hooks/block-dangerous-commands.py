#!/usr/bin/env python3
"""
block-dangerous-commands.py
Pre-tool-use hook for the Bash tool. Blocks dangerous commands before they run.

Reads JSON from stdin (Claude Code hook input format).
Exit 0 = allow. Exit 1 = block (with reason on stderr).

Add domain-specific patterns to the relevant sections below.
"""

import json
import sys
import re


def block(reason: str, command: str) -> None:
    sys.stderr.write(
        f"BLOCKED by .claude/hooks/block-dangerous-commands.py: {reason}\n"
        f"Command attempted: {command}\n"
        f"If you're sure, run it manually outside Claude Code.\n"
    )
    sys.exit(1)


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    command = payload.get("tool_input", {}).get("command", "") or ""
    if not command:
        sys.exit(0)

    # ── Filesystem destruction ───────────────────────────────────────────────
    fs_patterns = [
        (r"rm\s+-rf?\s+/(\s|$)", "rm -rf on root"),
        (r"rm\s+-rf?\s+~/?(\s|$)", "rm -rf on home directory"),
        (r"rm\s+-rf?\s+/\*", "rm -rf on /*"),
        (r"rm\s+-rf?\s+\.\.?/?(\s|$)", "rm -rf on current or parent directory"),
    ]
    for pattern, reason in fs_patterns:
        if re.search(pattern, command):
            block(reason, command)

    # ── Git footguns ─────────────────────────────────────────────────────────
    if re.search(r"git\s+push\s+(-f|--force)\b", command):
        if "--force-with-lease" not in command:
            block("git push --force without --force-with-lease", command)
    if re.search(r"git\s+reset\s+--hard\s+(origin|HEAD~)", command):
        block("destructive git reset --hard", command)
    if re.search(r"git\s+clean\s+-[fd]*x[fd]*", command):
        block("git clean -x deletes untracked AND ignored files (env, secrets)", command)

    # ── Database destruction ─────────────────────────────────────────────────
    if re.search(r"\b(DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE\s+TABLE|DELETE\s+FROM)\b",
                 command, re.IGNORECASE):
        block("destructive SQL detected — use a migration tool, not raw SQL", command)
    if re.search(r"redis-cli\s+(FLUSHALL|FLUSHDB)", command, re.IGNORECASE):
        block("Redis FLUSH would wipe all data", command)

    # ── Cloud / infra footguns ───────────────────────────────────────────────
    if re.search(r"kubectl\s+delete\s+(namespace|pv)\b", command):
        block("destructive kubectl on namespace or persistent volume", command)
    if re.search(r"aws\s+s3\s+(rm.*--recursive|rb)", command):
        block("recursive S3 deletion or bucket removal", command)
    if "terraform destroy" in command:
        block("terraform destroy — run manually after confirming the plan", command)

    # ── Docker volume wipes ──────────────────────────────────────────────────
    if re.search(r"docker(-compose|\s+compose)\s+down\b.*\s-v\b", command):
        block("docker compose down -v wipes named volumes (persistent data)", command)
    if re.search(r"docker\s+volume\s+(rm|prune)\b", command):
        block("docker volume rm/prune — wipes persistent volume data", command)

    # ── Credential / secret exposure ─────────────────────────────────────────
    if re.search(r"cat\s+.*\.env\b", command):
        block("reading .env file — describe what you need from it instead", command)
    if re.search(r"cat\s+~?/?\.aws/credentials", command):
        block("reading AWS credentials file", command)
    if re.search(r"cat\s+~?/?\.ssh/id_", command):
        block("reading SSH private key", command)

    # ── Add your domain-specific patterns here ───────────────────────────────
    # Example: block dropping a specific critical table
    # if re.search(r"DROP\s+TABLE\s+users", command, re.IGNORECASE):
    #     block("dropping the users table requires manual confirmation", command)

    sys.exit(0)


if __name__ == "__main__":
    main()
