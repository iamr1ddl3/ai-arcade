# Activity Log

Append-only. Newest entries at top. Never edit past entries.

---

## 2026-07-04 — scrape completeness check

- User asked whether scraping worked for all pending courses. Rebuilt `.venv` (previous one was a stale Windows venv — `Scripts/*.exe`, unusable on macOS); installed playwright/beautifulsoup4/html2text + `playwright install chromium`.
- Confirmed bundle `23022000000014019` has exactly 22 courses (live API), matching all 22 local folders — no course is entirely un-attempted.
- Counted real per-lesson `.md` files (not `_combined.md` header counts, which double-count nested markdown headers inside lesson bodies) and checked for empty body content per lesson.
- Result: 144/1192 lessons (12.1%) across 9 of 22 courses have a title but empty body. `autogen-essentials` and `statistics-math-for-aiml-interviews` are **0% complete** despite having a `_combined.md` (so the idempotency skip-check treats them as done). `langchain-mastery` is 42% complete.
- Reproduced root cause live: authenticated `courses.json?uniqueKey=autogen` consistently 500s (`ST_94 INVALID_COURSE`, 5/5 retries) even though login itself still works and the course resolves fine anonymously at the structural level (description empty when anonymous, as expected).
- Filed [[debt/incomplete-scrapes-empty-lessons]] with full per-course completeness table and root cause.
- Recommended: delete + retry the affected course folders; `autogen-essentials` may still fail until the vendor endpoint recovers (outside script's control).

## 2026-07-03 — backtest

- Ran `wiki-maintain` at backtest depth (4 passes) on the post-map wiki.
- Pass 1 (lint): 1 broken wikilink found (`overview.md` → `[[../CLAUDE.md]]`, pointed outside the wiki tree) — fixed. No orphans, no contradictions.
- Pass 2 (accuracy): 12/12 factual claims verified against source — 100%.
- Pass 3 (coverage): 2 minor undocumented behaviors found in `login()`'s ambiguous-URL double-check and the empty-lesson hint — added to [[modules/scrape_trainercentral]]. No unfiled debt or hidden decisions.
- Pass 4 (Q&A probe): 5/5 representative questions answered correctly from wiki alone — 100%.
- Scorecard filed at [[analyses/backtest-initial-map-2026-07-03]]: 100% structural / 100% accuracy / 100% coverage / 100% Q&A fidelity.
- All findings fixed same session, none deferred.

## 2026-07-03 — map

- Ran `wiki-map` cold-start on the codebase: single-file scraper (`scrape_trainercentral.py`, 263 lines).
- Wrote: [[architecture/system-map]], [[modules/scrape_trainercentral]], [[decisions/adr-1-playwright-over-requests]], [[debt/plaintext-credentials-in-env]], [[debt/no-tests]], [[debt/undocumented-api-dependency]], [[overview]].
- Domain set to `tooling` in CLAUDE.md — personal utility, not portfolio/showcase material.
- Confirmed `.env` and `tc_scrape_output/` gitignored before any commit.
- 5 open questions logged in [[overview]] (credential handling, API-breakage detection, re-scrape-on-update, output format, deeper content-type support).
- Next: run `wiki-maintain` at backtest depth to validate before this wiki becomes load-bearing.

## 2026-07-03 — wiki initialized

- Bootstrapped via `init-wiki-skeleton`.
- Project: aidemy-bundle.
- Next: run "map this codebase" in Claude Code.
