---
title: No automated tests
type: debt
severity: low
area: [[../modules/scrape_trainercentral]]
created: 2026-07-03
sources: []
updated: 2026-07-15
---

# No automated tests

Nothing in the project has automated tests. Originally this covered only `scrape_trainercentral.py`; the scope has since grown to the whole pipeline: `arcade/generate_content.py` (question generation with invariants worth locking in), `arcade/transform_content.py` (cache keys, verdict parsing, network retry), and `arcade/app.js` (~1,600 lines of game logic: SM-2 scheduling, streak/freeze rules, quest counters, gauntlet state, boss HP, betting XP math).

## Root Cause

Personal single-purpose scraper written to solve an immediate need; correctness validated by running it against real data. The arcade grew the same way — every feature was verified manually in a real browser (documented per-session in [[../log]]), but none of those checks are repeatable.

## Impact

Was bumped to **medium** (2026-07-06) ahead of the public deploy, since the game-state rules (XP economy, streak freezes, spaced-repetition scheduling) have edge cases that a regression could silently corrupt. **Reduced to low (2026-07-15)** once all three layers were covered and CI-gated (see Remediation). Residual risk is browser-integration only.

## Remediation

Highest-value first, all runnable without network:
1. ✅ **Done (2026-07-15)** — Generator invariants in `arcade/test_generate_content.py` (stdlib `unittest`, no pytest dep to match the generator's stdlib-only rule). Builds a synthetic course tree → runs the generator via subprocess → asserts MCQ/cloze invariants (4 distinct options, answerIndex correctness, blank present), flashcard presence, step order, unique IDs, and determinism. Sabotage-verified (breaking `answerIndex` turns it red). Wired into CI as a `test` job that gates `deploy` (`needs: test`) — a broken generator can no longer reach Cloudflare.
2. ✅ **Done (2026-07-15)** — `transform_content.py` pure parts in `arcade/test_transform_content.py` (19 tests, stdlib `unittest`, imports the module directly since LLM SDKs are lazy-loaded). Covers `cache_key` stability (deterministic; changes with text/id/PROMPT_VERSION → correct re-billing), `parse_verdict` tolerance (plain/fenced/prose JSON, fails-closed on unparseable/invalid/missing keys), `passes` thresholds + string-score tolerance, and the end-to-end "garbage judge output → never ships" path. Also in the CI `test` gate.
3. ✅ **Done (2026-07-15)** — `app.js` state rules in `arcade/test_app.mjs` (15 tests, `node:test`, no deps). Runs the **real** `app.js` in a `vm` sandbox with stubbed browser globals (localStorage/document/window/fetch), then calls the actual functions — no copy, no refactor of the live file. Covers `scheduleCard` SM-2 transitions (again/hard/good/easy, box ceiling on **both** good and easy paths, ease floor, lapse count, due-date math), `bumpStreak` (first/same-day/consecutive/reset/freeze-bridge/milestone-badge-once), XP economy floors (`awardXp` level recompute, `loseXp` floored at 0), and `questEvent` claim-once. **Sabotage-verified** (removing the freeze decrement, the XP floor, or either box-ceiling cap each turns it red). Surfaced a pre-existing timezone bug → [[date-timezone-drift]]. In the CI `test` gate (adds a Node step).
Playwright E2E for the game flows only if regressions actually start appearing.

Severity → **low**: all three pure/state layers are now tested and CI-gated. What remains is only browser-integration behavior (routing, rendering, timers), which Playwright would cover if regressions appear — not worth building preemptively.

## Related

- [[../modules/scrape_trainercentral]] · [[../modules/arcade-generator]] · [[../modules/arcade-transform]] · [[../modules/arcade-app]]
