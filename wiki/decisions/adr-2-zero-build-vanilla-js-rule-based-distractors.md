---
title: "ADR-2: Zero-build vanilla JS + rule-based distractors for the arcade"
type: decision
status: accepted
date: 2026-07-04
sources: []
updated: 2026-07-04
---

# ADR-2: Zero-build vanilla JS + rule-based distractors for the arcade

## Status

Accepted

## Context

The user wanted to gamify the scraped AIdemy course content (~1192 Q&A lessons). The content
is gitignored and derives from a personal scrape; it must never be published (CLAUDE.md hard
rule). This is a solo, local-only project with no existing frontend, and the global
`karpathy-guidelines` mandate simplicity-first for code. Question generation needed to work
offline and for free at the outset, with room to improve later. The lessons contain no
pre-written wrong answers, so multiple-choice distractors have to be manufactured somehow.

## Decision

- **Frontend:** a zero-build vanilla HTML/CSS/JS single-page app ([[modules/arcade-app]]) —
  no framework, no npm, no bundler. It `fetch()`es a static `content.json` and hash-routes.
- **Generator:** a single stdlib-only Python script ([[modules/arcade-generator]]) that emits
  `content.json`. The generator *code* is committed; its *output* is gitignored
  (`arcade/data/`) because it derives from gitignored scraped content.
- **Question generation:** rule-based and deterministic (seeded RNG). Correct answer = the
  lesson's interview-ready answer / definition; the 3 distractors = other lessons' answers
  from the **same course** (topically related but wrong). Answer-extraction and distractor
  functions are isolated so an LLM variant can be added later behind a `--llm` flag without
  changing the JSON schema or the frontend.

## Consequences

- **Good:** zero dependencies, zero build/supply-chain surface, runs offline and for free,
  fully deterministic (byte-identical rebuilds), trivially auditable. Matches the repo's
  single-script ethos and the simplicity mandate.
- **Bad:** distractors are real-but-wrong sibling answers, not tuned — occasionally too easy
  or oddly close. Courses with <4 answerable lessons get flashcards only (no quiz). Opening
  `index.html` via `file://` fails (CORS on `fetch`); a static server is required.
- **Neutral:** playable scope is capped by scrape completeness (currently ~993 lessons / 20
  courses; two empty courses are dropped) — see [[debt/incomplete-scrapes-empty-lessons]].

## Alternatives Considered

- **React/Vite (or any framework + bundler):** rejected — build tooling and an npm dependency
  tree are pure overhead for 5 static screens in a solo local app.
- **LLM-generated questions now:** rejected for the first version — adds API cost,
  non-determinism, and an online dependency. Deferred behind a clean seam instead.
- **Committing `content.json`:** rejected — it embeds scraped Q&A text, which must never be
  published.

## Related

- [[modules/arcade-app]]
- [[modules/arcade-generator]]
- [[debt/incomplete-scrapes-empty-lessons]]
- [[decisions/adr-1-playwright-over-requests]]
