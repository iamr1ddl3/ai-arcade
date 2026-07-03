# Activity Log

Append-only. Newest entries at top. Never edit past entries.

---

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
