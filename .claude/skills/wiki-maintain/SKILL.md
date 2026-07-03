---
name: wiki-maintain
description: Use this skill to health-check the wiki — bundles audit, lint, and backtest. Triggers on phrases like "audit the wiki", "lint the wiki", "backtest the wiki", "check wiki health", "wiki integrity check", or before relying on the wiki for a major decision.
---

# wiki-maintain

Verify the wiki is internally consistent and accurate against source. Three depths: `lint` (fast, structural), `audit` (medium, ownership/coverage), `backtest` (deep, accuracy + Q&A probe). Pick the depth based on the user's request; default to `audit` if unspecified.

## When to use

- Before a big decision that depends on wiki facts
- After a batch of `wiki-write` operations to validate the result
- After a `wiki-map` run on a new codebase
- Periodic health check (every 1-2 weeks of active wiki use)

## Depth: LINT (structural, ~5 min)

1. Extract every `[[wikilink]]` across all wiki pages and compare to actual file paths.
2. Report: **broken links**, **orphan pages** (exist but never linked), **contradictions** between pages.
3. Propose fixes. Apply with user confirmation.
4. Append to `wiki/log.md` with operation `lint`.

## Depth: AUDIT (medium, ~15 min)

1. Read all module, flow, data-model, and debt pages.
2. Report:
   - **Circular dependencies** between modules
   - **Ownership gaps** — functionality mentioned but no clear owning module
   - **Stale ADRs** — decisions that appear reversed or superseded but not marked
   - **Undocumented flows** — major features with no flow page
   - **Data model inconsistencies** — entities referenced but not defined
   - **Debt hot-spots** — modules with multiple debt items
3. For each finding, propose a new debt page or ask if one should be created.
4. Append summary to `wiki/log.md` with operation `audit`.

## Depth: BACKTEST (deep, ~30 min)

Run all four passes:

1. **Pass 1 — Lint (structural).** Same as LINT above.

2. **Pass 2 — Accuracy spot-check.** Pick 10-20 specific factual claims (constants, counts, field names, API names, schema fields). Verify each against actual source. Tabulate: claim | source location | pass/fail.

3. **Pass 3 — Coverage gap analysis.** Read source files not yet fully ingested. Identify: (a) code patterns documented nowhere, (b) debt visible in code but not filed, (c) decisions implied by code but not captured as ADRs.

4. **Pass 4 — Q&A probe.** Formulate 5 representative developer questions. Answer using only the wiki. Verify each answer against source. Record pass/fail.

5. **File results** at `wiki/analyses/backtest-<slug>-<date>.md` with a scorecard table: structural %, accuracy %, coverage %, Q&A fidelity %.

6. **Fix all failures immediately.** Correct factual errors, file new debt/ADR pages for gaps, fix broken links. Do not leave known errors unfixed.

7. Update `wiki/index.md`, append to `wiki/log.md` with operation `backtest`.

## What good looks like

- Every finding has a concrete location (file + line or page + section).
- Fixes are applied in the same session as the audit, not deferred.
- The backtest scorecard is real — no padding the numbers.
- New debt pages or ADRs created during the audit follow `wiki/SCHEMAS.md`.

## What to avoid

- Reporting findings without proposing fixes.
- Marking a scorecard row "pass" when only spot-checked.
- Leaving broken `[[wikilinks]]` "for later".
