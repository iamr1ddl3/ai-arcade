---
title: Arcade Transform
type: module
tags: [tooling, python]
language: python
entry_point: arcade/transform_content.py
sources: []
updated: 2026-07-06
---

# Arcade Transform

An offline pipeline that rewrites scraped course lessons into original derivative learning
material so the arcade can be published publicly without republishing purchased content. For
each lesson, GLM (`glm-5.2`) does a substantial rewrite and a judge (Sonnet or GLM) scores it;
only passing lessons are written to `transformed/`, which then feeds [[arcade-generator]]
unchanged.

## Responsibility

Owns: reading `tc_scrape_output/` lessons, GLM rewriting, judge scoring against
[[../judgment/lesson-transform-quality]], the accept/retry/exclude gate, a resumable content
cache, cost estimation/caps, and writing derivative markdown to `transformed/` (filenames
preserved so lesson IDs — and user progress — stay stable).

Does NOT own: scraping (never touches the network for content — [[scrape_trainercentral]] does),
game-data generation or the JSON schema ([[arcade-generator]]), rendering ([[arcade-app]]), or
deployment (see `arcade/DEPLOY.md`). It never runs inside the deployed site and no API key ever
reaches the published bundle.

## Public Interface

- CLI: `python3 arcade/transform_content.py [--course SLUG | --all-courses] [--judge sonnet|glm|none]
  [--max-lessons N] [--estimate-only] [--dry-run] [--root DIR] [--out DIR] [--cache FILE]`.
- **Judge is pluggable:** `--judge glm` (second GLM call, reuses the one key), `--judge sonnet`
  (independent Anthropic-API judge, needs `ANTHROPIC_API_KEY`), or `--judge none` (rewrite only,
  accept any non-stub — added 2026-07-06 so GLM never self-judges when an **external** judge, e.g.
  an independent Claude sub-agent pass, is the sole quality gate). glm/sonnet return the same JSON
  verdict `{quality, defensibility, correctness, notes}`; none returns `{judge: "none"}`.
- **Rewrite prompt (`REWRITE_SYSTEM`) also governs code:** rewrite code with your own
  identifiers/structure but keep exact import names (PyPDF2 not PyDF2), valid syntax, and correct
  string/JSON literals; no invented facts; correctly-spelled title. Strengthened 2026-07-06 after
  the Claude judge caught 3 code/fact errors + 4 verbatim-code echoes in the 688-lesson batch.
- **Cost guard:** prints a token/cost projection before any paid call; `--estimate-only` stops
  there; `--max-lessons` caps API calls; `--dry-run` transforms one lesson and exits.
- Key seams: `transform_one()` (rewrite+judge+retry), `sonnet_judge_json()` / `glm_complete()`,
  `parse_verdict()` / `passes()`. SDKs are imported lazily so estimate/dry-run/tests run without
  `openai`/`anthropic` installed.
- **Two distinct retry layers:** `transform_one()`'s `MAX_RETRIES` retries *quality* rejections
  (feeds the judge's notes back into the next rewrite). `_with_network_retry()` wraps every API
  transport call (`glm_complete` + `sonnet_judge_json`) to survive *transient* errors
  (Connection/Timeout/RateLimit/APIStatus/InternalServer), `NET_RETRIES=4` with linear backoff.
  Added 2026-07-05 after a single `APIConnectionError` crashed a 70-lesson run at lesson 61; the
  cache made recovery free (re-run skipped the 61 done). Transport-only — deterministic content
  is unaffected.

## Dependencies

- `openai` SDK → GLM's OpenAI-compatible endpoint (`https://api.z.ai/api/paas/v4`, `glm-5.2`).
- `anthropic` SDK → Sonnet judge (`claude-sonnet-5`, strict JSON via `output_config.format`),
  only when `--judge sonnet`.
- Reads `GLM_API_KEY` / `ANTHROPIC_API_KEY` from env/`.env` (gitignored) — the script's own
  `load_dotenv()` loads the project-root `.env` (stdlib, `setdefault` so a real env var wins).
- Rubric: [[../judgment/lesson-transform-quality]].

## Dependents

- [[arcade-generator]] — consumes `transformed/` via `--root` to emit `content.json`.

## Data Flow

`tc_scrape_output/**/*.md` (read-only) → GLM rewrite → judge → accept/retry/exclude →
`transformed/**/*.md` (gitignored). A `.transform_cache.json` (gitignored) keyed by
`sha256(prompt_version + lesson_id + raw_text)` makes re-runs skip unchanged lessons and persists
after each lesson (resumable). Excluded lessons are logged, never shipped. Verified end-to-end
without API calls: a mock transformed tree flows through the unmodified generator to a valid,
invariant-clean `content.json`.

## Key Decisions

- Transform-then-publish (derivative content only) and Cloudflare Pages hosting — see
  [[../decisions/adr-3-transform-then-publish]].
- Substantial rewrite, exclude-and-log failures, mandatory cache for cheap incremental re-runs.

## Known Issues / Debt

- Non-deterministic by nature (LLM); reproducibility comes from committing the cache + output as a
  frozen content version, not from a seed.
- Cost estimate is coarse (char-based heuristic, GLM-only) — a projection, not billing-accurate.
- Capped playable scope inherited from [[../debt/incomplete-scrapes-empty-lessons]] (empty source
  lessons are skipped before transform).

## Related

- [[arcade-generator]] · [[arcade-app]]
- [[../judgment/lesson-transform-quality]]
- [[../decisions/adr-3-transform-then-publish]]
