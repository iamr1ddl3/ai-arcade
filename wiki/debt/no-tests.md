---
title: No automated tests
type: debt
severity: low
area: [[../modules/scrape_trainercentral]]
created: 2026-07-03
sources: []
updated: 2026-07-03
---

# No automated tests

`scrape_trainercentral.py` has zero automated tests — no unit tests for `slugify`/`html_to_md`, no integration test (even mocked) for the login or scrape-walk logic.

## Root Cause

Personal single-purpose scraper written to solve an immediate need; correctness was validated by running it against real courses, not by a test suite.

## Impact

Low — the script is idempotent per-course (skips courses with an existing `_combined.md`) and failures are visible immediately via stdout, so regressions are easy to notice on next run. Low blast radius since it's a personal, non-shared tool.

## Remediation

Not planned. If the script grows (more site support, more output formats), add unit tests for the pure functions (`slugify`, `html_to_md`) first — they need no network mocking.

## Related

- [[../modules/scrape_trainercentral]]
