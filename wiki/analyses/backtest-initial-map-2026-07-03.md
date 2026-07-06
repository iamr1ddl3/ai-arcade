---
title: Backtest — initial map (2026-07-03)
type: analysis
tags: [backtest]
sources: []
updated: 2026-07-03
---

# Backtest — initial map (2026-07-03)

Post-`wiki-map` health check on aidemy-bundle's wiki, run per `wiki-maintain` at backtest depth.

## Context

The wiki was cold-start mapped earlier the same day (1 module, 1 ADR, 3 debt pages, system-map + overview). This backtest validates it before it becomes load-bearing for future sessions.

## Method

Four passes against `scrape_trainercentral.py` (263 lines, the only source file) and all 8 content wiki pages (`overview`, `index`, `log`, `architecture/system-map`, `modules/scrape_trainercentral`, `decisions/adr-1-playwright-over-requests`, `debt/plaintext-credentials-in-env`, `debt/no-tests`, `debt/undocumented-api-dependency`).

## Results

| Pass | Metric | Score | Notes |
|---|---|---|---|
| 1. Lint (structural) | Broken links / orphans / contradictions | 1 broken link found, fixed | `wiki/overview.md:13` linked ``../CLAUDE.md`` — a project file outside the wiki tree, violating wikilink convention. Rewrote as plain-text reference. No orphan pages; no contradictions. |
| 2. Accuracy spot-check | 12/12 claims verified | **100%** | Line counts, function signatures, retry/backoff values, endpoint URLs, idempotency behavior, iframe selector — all matched source exactly. |
| 3. Coverage gap analysis | Undocumented patterns found | 2 minor gaps found, fixed | `login()`'s ambiguous-URL double-check via `userInfos.json`, and the empty-lesson-count user hint, were real behavior not yet in the module page. Added to Data Flow section. No unfiled debt or hidden decisions found beyond the 3 existing debt pages + ADR-1. |
| 4. Q&A probe | 5/5 questions answered correctly from wiki alone | **100%** | Covered: no-login usage, Playwright-over-requests rationale, idempotency, credential storage/safety, API-breakage risk. |

### Scorecard

| Dimension | Score |
|---|---|
| Structural | 100% (after 1 fix) |
| Accuracy | 100% (12/12) |
| Coverage | 100% (after 2 additions) |
| Q&A fidelity | 100% (5/5) |

## Conclusions

Wiki is accurate and complete relative to the single-file source it describes. All findings were fixed in this session:
- Fixed broken wikilink in `overview.md`.
- Enriched `modules/scrape_trainercentral.md` Data Flow section with 2 previously-undocumented behaviors (ambiguous-login double-check, empty-lesson hint).

No new debt or ADR pages were warranted — the coverage gaps were documentation completeness issues, not undiscovered problems. Given the project's small size (1 script), this wiki should stay accurate with normal `wiki-write` discipline on future changes; no periodic re-backtest is scheduled unless the script grows materially.

## Related

- [[../overview]]
- [[../modules/scrape_trainercentral]]
