---
title: "ADR-3: Transform purchased content into derivative material before public deploy"
type: decision
status: accepted
date: 2026-07-04
sources: []
updated: 2026-07-04
---

# ADR-3: Transform purchased content into derivative material before public deploy

## Status

Accepted

## Context

The user wants to publish the arcade ([[../modules/arcade-app]]) online so others can learn from
it. But the course content was **purchased** from TrainerCentral/AIdemy and the project's
`CLAUDE.md` marks it **"never publish"** — republishing paid third-party course material verbatim
is a copyright/ToS risk. The user chose to publish *their own derivative* material instead:
reword and restructure each lesson enough that it is defensibly original, then deploy that. Hosting
must be free/cheap now but scale to accounts + leaderboards later without re-platforming.

## Decision

- **Transform before publish.** A new offline pipeline ([[../modules/arcade-transform]]) uses GLM
  (`glm-4.6`, OpenAI-compatible API) to **substantially rewrite** each lesson, and a pluggable
  judge (`--judge sonnet|glm`) scores it against [[../judgment/lesson-transform-quality]] for
  quality, defensibility (distance from source wording), and correctness. Only lessons passing the
  gate (`quality≥7 ∧ defensibility≥7 ∧ correctness=pass`) ship; failures are excluded and logged.
- **Same generator, no schema change.** The rewrites are shaped to satisfy the verified parser
  contract, so `generate_content.py --root transformed` produces the identical `content.json`
  schema — [[../modules/arcade-generator]], [[../modules/arcade-app]], and the frontend files are
  unchanged. Filenames are preserved so lesson IDs (and localStorage progress) stay stable.
- **Cache for incremental cost.** A `sha256`-keyed content cache means re-runs and later course
  additions only pay for new/changed lessons.
- **Host on Cloudflare Pages** (static, zero-build, `wrangler pages deploy ./arcade`), with
  Cloudflare Workers + D1/KV as the same-platform upgrade path for future accounts/leaderboards.
- **Keys never ship.** The transform runs offline; only the static bundle (app + derivative
  `content.json`) is deployed. `transformed/`, the cache, `content.json`, and `.env` are gitignored.

## Consequences

- **Good:** respects the "never publish" rule by shipping derivative content; independent-judge
  option (different model family) raises trust; incremental cache keeps re-runs cheap; zero
  frontend/generator changes; free hosting with a clean scale path; no secret ever reaches the deploy.
- **Bad:** transformation costs API tokens and time; quality/defensibility depend on the judge
  threshold and can need tuning; the pipeline is non-deterministic (reproducibility via committed
  cache/output, not a seed).
- **Neutral:** starting with one pilot course (`advanced-rag`, ~38 lessons) keeps first exposure
  small and reviewable before scaling to all courses.

## Alternatives Considered

- **Publish the scraped content as-is:** rejected — violates "never publish" and carries direct
  copyright risk.
- **Ship the app empty and let users upload content:** rejected — the user wants to serve *their*
  content, not host a generic engine.
- **Rule-based paraphrase (no LLM):** rejected — weaker as a derivative work and lower learning
  quality than a substantial LLM rewrite.
- **GitHub Pages / Vercel:** viable, but Cloudflare Pages + Workers/D1 was chosen for cost-at-scale
  and a single-platform path to leaderboards.

## Honest caveat

Rewriting + a defensibility judge *reduces* copyright risk but does not eliminate it; the judge is
a quality tool, not legal clearance. The decision to publish remains the user's.

## Related

- [[../modules/arcade-transform]] · [[../modules/arcade-app]] · [[../modules/arcade-generator]]
- [[../judgment/lesson-transform-quality]]
- [[adr-2-zero-build-vanilla-js-rule-based-distractors]]
- [[../debt/incomplete-scrapes-empty-lessons]]
