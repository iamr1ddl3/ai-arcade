---
title: Content Pipeline (scrape → transform → judge → generate → play)
type: flow
tags: [data-flow]
sources: []
updated: 2026-07-06
---

# Content Pipeline (scrape → transform → judge → generate → play)

The end-to-end path that turns purchased TrainerCentral course content into a publicly deployable, gamified derivative. Manual, run-on-demand; each stage is idempotent/cached so partial re-runs are cheap. As of 2026-07-06 it has processed 20 courses / 1022 playable lessons.

## Trigger

Manual CLI runs by the owner — after new content is scraped, or after a transform-prompt change.

## Steps

1. [[../modules/scrape_trainercentral]] logs in (Playwright), walks the bundle API → writes `tc_scrape_output/<course>/<section>/<NN>-<slug>.md` + per-course `_combined.md`. Idempotent per course (skips if `_combined.md` exists — see the false-done caveat in [[../debt/incomplete-scrapes-empty-lessons]]).
2. [[../modules/arcade-transform]] (`--course X --judge none`) rewrites each non-stub lesson with GLM-5.2 → `transformed/<same path>` (filenames preserved so lesson IDs and player progress stay stable). Content-keyed cache (`sha256(prompt_version + lesson_id + raw_text)`) means editing one source lesson re-runs exactly that lesson.
3. **Independent judge pass** (not in the script): Claude sub-agent batches score every rewrite vs its source against [[../judgment/lesson-transform-quality]] (correctness / quality ≥7 / defensibility ≥7). Failures are re-transformed (cache-evict → re-run) or excluded (file deleted + cache-evicted). This replaced GLM self-judging after it passed defects Claude caught.
4. [[../modules/arcade-generator]] (`--root transformed`) parses every lesson → `arcade/data/content.json`: flashcard + MCQ (same-course distractors) + cloze + ordered steps per lesson. Deterministic (seed 1337); only `generatedAt` differs between runs.
5. [[../modules/arcade-app]] fetches `content.json` at boot and serves all 8 play modes; progress persists in `localStorage` (`aidemy-arcade:v1`).

## Data Involved

- Scraped lesson markdown (gitignored, never published) → derivative markdown (gitignored, publishable once judged) → `content.json` (gitignored; the deploy artifact).
- No `data-models/` pages yet — `content.json`'s shape is documented in [[../modules/arcade-generator]].

## Error Paths

- **Vendor 500s** (stage 1): scraper retries 3×/call; course-level gaps become empty-body lessons — filed in [[../debt/incomplete-scrapes-empty-lessons]]; a read-only probe (login + raw status check) verifies recovery before any re-scrape.
- **Transient API errors** (stage 2): `_with_network_retry()` (4 attempts, linear backoff) after a real crash lost 9 lessons mid-run; the cache made recovery free.
- **Judge failures** (stage 3): re-transform (typos/factual slips usually fix on a fresh sample) or exclude (1 of 688 was inherently un-rewritable tool-definition code).
- **Stub lessons** (stage 4): <5 non-blank lines or no extractable answer → skipped, counted in the build report.

## Performance Characteristics

- Transform: ~3.3 lessons/min without inline judge (~1.8 with); 688 lessons ≈ 3.5 h wall-clock, ~$0.01/lesson GLM-5.2.
- Judge: ~19-lesson Claude batches, 8 in parallel ≈ 150 lessons/2 min.
- Generate: full 1022-lesson build < 5 s. App boot: one `content.json` fetch (~2 MB).

## Related

- [[../architecture/system-map]] · [[../decisions/adr-3-transform-then-publish]] · [[../judgment/lesson-transform-quality]]
