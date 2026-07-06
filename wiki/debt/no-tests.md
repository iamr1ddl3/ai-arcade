---
title: No automated tests
type: debt
severity: medium
area: [[../modules/scrape_trainercentral]]
created: 2026-07-03
sources: []
updated: 2026-07-06
---

# No automated tests

Nothing in the project has automated tests. Originally this covered only `scrape_trainercentral.py`; the scope has since grown to the whole pipeline: `arcade/generate_content.py` (question generation with invariants worth locking in), `arcade/transform_content.py` (cache keys, verdict parsing, network retry), and `arcade/app.js` (~1,600 lines of game logic: SM-2 scheduling, streak/freeze rules, quest counters, gauntlet state, boss HP, betting XP math).

## Root Cause

Personal single-purpose scraper written to solve an immediate need; correctness validated by running it against real data. The arcade grew the same way — every feature was verified manually in a real browser (documented per-session in [[../log]]), but none of those checks are repeatable.

## Impact

Bumped to **medium** (2026-07-06): the app is heading to a public deploy, and the game-state rules (XP economy, streak freezes, spaced-repetition scheduling) now have enough edge cases that a regression could silently corrupt player progress. The generator's quiz invariants (4 distinct options, answerIndex correctness) are re-checked ad hoc after every build rather than by a test.

## Remediation

Highest-value first, all runnable without network:
1. Generator invariants as a pytest (parse a fixture course → assert option/answer/cloze/steps invariants + determinism).
2. `transform_content.py` pure parts: `cache_key` stability, `parse_verdict` tolerance, `extract_steps`/`cloze_term`.
3. `app.js` state rules via a thin node harness (`scheduleCard` transitions, `bumpStreak` freeze cases, quest claim-once).
Playwright E2E for the game flows only if regressions actually start appearing.

## Related

- [[../modules/scrape_trainercentral]] · [[../modules/arcade-generator]] · [[../modules/arcade-transform]] · [[../modules/arcade-app]]
