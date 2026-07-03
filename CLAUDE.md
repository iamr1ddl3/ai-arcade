---
project: aidemy-bundle
domain: tooling
updated: 2026-07-03
---

# Project Instructions

You are working on **aidemy-bundle**, with a persistent **LLM wiki** in `wiki/` that records everything we build, decide, and change.

Two systems, two jobs:
- **Workshop** — `.claude/skills/code-review/` and `.claude/skills/implement-change/` for effective coding.
- **Library** — `.claude/skills/wiki-*` for institutional memory. Read before re-explaining; write to preserve.

## Hard rules (also enforced by hooks)

- `raw/**` is **immutable** — never modify any file under it.
- `wiki/log.md` is **append-only** — never edit past entries.
- `wiki/MILESTONES.md` is **append-only**.
- Every entity mention with its own wiki page uses `[[wikilink]]` syntax.
- Page schemas live in `wiki/SCHEMAS.md` — consult before creating any wiki page.

## Skills (load on demand by name)

- `wiki-write` · `wiki-read` · `wiki-trace` · `wiki-maintain` · `wiki-map`
- `code-review` · `implement-change` (auto-chains code-review + wiki-write)

## Session start

1. Read `wiki/log.md` (last 10 entries).
2. Read `wiki/index.md`.
3. Greet with: page count, last activity date, open work from the most recent log entries.

## Domain

Set the `domain:` field in the frontmatter above to one of:
- `ai-ml` — AI/ML, agents, code intelligence, knowledge mgmt
- `social-growth` — content, growth, social media pipelines
- `tooling` — cross-cutting dev workflow lore (helpers, scrapers, CLI utilities)
- `other` — unclassified

This tag controls which central hub (`~/Documents/Projects/wiki/<domain>/`) receives cross-project lore.

## Scope note

This is a personal utility (TrainerCentral/AIdemy course-content scraper), not portfolio/showcase material.
`.env` (login creds) and `tc_scrape_output/` (scraped course content) are gitignored — never commit or push either.
