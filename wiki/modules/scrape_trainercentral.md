---
title: scrape_trainercentral
type: module
tags: [shared]
language: python
entry_point: scrape_trainercentral.py
sources: []
updated: 2026-07-03
---

# scrape_trainercentral

Single-file CLI that logs into AIdemy's TrainerCentral site, recursively walks a course or bundle, and dumps every lesson's text content to local Markdown files organized by course/module.

## Responsibility

Owns: authentication against TrainerCentral's Zoho-IAM-backed login, recursive bundle/course/section/session traversal via undocumented JSON endpoints, HTML→Markdown conversion, and idempotent file output (skips a course whose `_combined.md` already exists).

Does NOT own: rate limiting/backoff beyond a fixed 3-retry/3s backoff on `get_json`; retrying at the bundle/course level (module-level fetch failures are logged and skipped, not retried); any output format beyond Markdown; UI or interactive review of scraped content.

## Public Interface

- `main()` — CLI entry point. `python3 scrape_trainercentral.py <course_or_bundle_id> [--no-login] [--unique-key=<key>]`.
- `login(context, page, email, password) -> bool` — drives the login form (including the nested Zoho IAM iframe for the password step).
- `scrape_course(context, course_id, out_root, seen=None, unique_key=None)` — recursive entry; detects bundle vs. leaf course and recurses or writes output.
- `fetch_bundle_courses`, `fetch_sessions`, `fetch_course_info`, `get_json` — thin wrappers around TrainerCentral's `showtime/api/v4/viewer/*` JSON endpoints, with a legacy anonymous-endpoint fallback for bundles.
- `slugify(s) -> str`, `html_to_md(html) -> str` — formatting helpers.

## Dependencies

- Playwright (`sync_playwright`, `chromium`) — browser automation for the login step only.
- `html2text` — HTML→Markdown conversion (links preserved, no body-width wrapping).
- TrainerCentral's `showtime/api/v4/viewer/*` endpoints (undocumented, versioned by the vendor, not by this project).

## Dependents

None — this is a standalone leaf script, invoked directly from the CLI.

## Data Flow

CLI ID → `scrape_course` → `fetch_course_info` (resolves bundle vs. leaf course) → if bundle: `fetch_bundle_courses` recurses per sub-course; if leaf: `fetch_sessions` per section → `html_to_md` per lesson → per-lesson `.md` file + course-level `_combined.md`, all under `tc_scrape_output/<course-slug>/<module-slug>/`.

## Key Decisions

- See [[../decisions/adr-1-playwright-over-requests]] for why Playwright drives login instead of a plain HTTP client.

## Known Issues / Debt

- [[../debt/plaintext-credentials-in-env]]
- [[../debt/no-tests]]
- [[../debt/undocumented-api-dependency]]

## Related

- [[../architecture/system-map]]
