---
title: Incomplete scrapes — empty lesson bodies in tc_scrape_output/
type: debt
severity: high
area: [[../modules/scrape_trainercentral]]
created: 2026-07-04
sources: []
updated: 2026-07-04
---

# Incomplete scrapes — empty lesson bodies in tc_scrape_output/

12.1% of all locally scraped lessons (144/1192) have a title but zero body text. All 22 courses in bundle `23022000000014019` were attempted and have a `_combined.md`, so the script's own idempotency check (skip if `_combined.md` exists) treats every one of them as "done" — but several are badly incomplete underneath that marker.

## Description

Per-course completeness (lesson files with non-empty body / total lesson files):

| Course | Lessons | Empty | % complete |
|---|---|---|---|
| autogen-essentials | 28 | 28 | **0%** |
| statistics-math-for-aiml-interviews | 30 | 30 | **0%** |
| langchain-mastery | 109 | 63 | **42%** |
| deep-learning-essentials | 61 | 12 | 80% |
| langgraph-agents | 49 | 6 | 88% |
| prompt-engineering-mastery | 32 | 2 | 94% |
| llms-deep-dive | 40 | 1 | 98% |
| rag-systems | 66 | 1 | 98% |
| scenerio-based-questions | 144 | 1 | 99% |
| all other 13 courses | — | 0 | 100% |

## Root Cause

Reproduced live on 2026-07-04: the authenticated `showtime/api/v4/viewer/courses.json?uniqueKey=autogen` endpoint returns HTTP 500 (`ST_94 INVALID_COURSE`) consistently (5/5 retries), for the `autogen-essentials` course specifically, even though:
- The same course resolves fine **anonymously** at the structural level (7 sections, sessions listed) — but `description` is `null` when anonymous, confirming lesson text requires an authenticated session.
- Login itself still works correctly (verified live — reaches `my-courses` post-login).

This matches the exact fragility already flagged in [[undocumented-api-dependency]] and the `courseId=` 500-once-authenticated quirk noted in [[../modules/scrape_trainercentral]] — except here even the `uniqueKey=` path (the one the code relies on specifically to avoid that quirk) is 500ing for this course. The other partially-empty courses (langchain-mastery 42%, deep-learning-essentials 80%, etc.) likely hit the same intermittent 500 on a subset of their sections/sessions during the original scrape run, and `get_json`'s 3x/3s retry gave up before the endpoint recovered — `scrape_course` does not retry at the section/course level, only within `get_json`'s single call.

## Impact

~12% of scraped course content is unusable (empty text) despite `_combined.md` existing and the script reporting the course as already scraped. The idempotency check (`if (course_dir / "_combined.md").exists(): skip`) means **re-running the scraper for these courses today does nothing** — the folders must be deleted first to force a re-scrape, and even then, `autogen-essentials` will still fail while the endpoint 500s.

Two most affected courses (`autogen-essentials`, `statistics-math-for-aiml-interviews`) are 100% empty — effectively not scraped at all despite having a folder and combined file.

## Remediation

1. **Delete and retry** the fully/mostly-empty course folders (`autogen-essentials`, `statistics-math-for-aiml-interviews`, `langchain-mastery`, `deep-learning-essentials`) and re-run the scraper — the API may recover on its own (undocumented, vendor-side).
2. If `autogen-essentials` still 500s on retry, this is a live vendor-side issue outside this script's control; no code fix will help until the endpoint recovers.
3. Optional low-effort fix for the general class of problem: add a lightweight post-scrape completeness check (e.g. a `--verify` flag or separate script) that flags any course whose `_combined.md` exists but contains a high ratio of headers-with-no-body, rather than relying purely on file-existence for idempotency. Not implemented — flagged here for future consideration, not committed to.

## Retry Attempt — 2026-07-04

Before retrying, `tc_scrape_output/` was fully backed up to `tc_scrape_output.bak.20260704/` (gitignored, same as the primary output dir).

The 9 incomplete course folders were deleted and the scraper re-run against bundle `23022000000014019`. Result: **the authenticated bundle-level fetch itself failed entirely** — `courses.json?courseId=`, `getBundleCourses.json` (v4), and the legacy `trainercentral/viewer/.../getBundleCourses.json` fallback all returned HTTP 500 (`ST_94 INVALID_COURSE` / `ST_01 GENERAL_FAILURE`), even via real page navigation (ruling out a `context.request` header/cookie quirk). Anonymous access to the same bundle endpoint returned 200 with all 22 courses, confirming this is an **authenticated-session-specific** vendor-side outage, worse than the single-course 500 seen during initial diagnosis — the whole bundle is currently unreachable while logged in.

Since the scraper produced no output for the 9 deleted folders, they were restored from the backup — verified via `diff -rq` against the backup with zero differences. **No data was lost; state is identical to before the retry attempt.**

**Next steps:** retry later once TrainerCentral's authenticated API recovers. No further attempts should be made in rapid succession — the endpoint has now failed consistently across two separate sessions/attempts (2026-07-03 single-course check, 2026-07-04 full retry), suggesting this may take longer than a transient blip to resolve.

## Related

- [[../modules/scrape_trainercentral]]
- [[undocumented-api-dependency]]
