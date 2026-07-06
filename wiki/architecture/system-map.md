---
title: System Map
type: architecture
updated: 2026-07-06
---

# System Map

`aidemy-bundle` is a four-module content pipeline ending in a static web game. Data flows one way: vendor API → scraped markdown → LLM-rewritten derivative markdown → generated game JSON → browser. No backend, no database — progress lives in the player's `localStorage`. See [[flows/content-pipeline]] for the end-to-end walk.

## Components

| Component | Role | Connections |
|---|---|---|
| [[../modules/scrape_trainercentral]] | Login (Playwright/Zoho IAM), API walk, HTML→MD | Talks to `aidemy.trainercentralsite.in`; writes `tc_scrape_output/` (gitignored) |
| [[../modules/arcade-transform]] | GLM-5.2 rewrite + judge gate; resumable content cache | Reads `tc_scrape_output/`, calls `api.z.ai` (and optionally Anthropic API); writes `transformed/` (gitignored) |
| [[../modules/arcade-generator]] | Deterministic markdown → `content.json` (flashcards, MCQ, cloze, ordered steps) | Reads `tc_scrape_output/` or `transformed/` via `--root`; writes `arcade/data/content.json` (gitignored) |
| [[../modules/arcade-app]] | Zero-build SPA game: 8 play modes, XP/streak/quest economy, themes, mobile tab bar | Fetches `data/content.json`; persists to `localStorage` only |

## Boundaries

- **Vendor API:** `showtime/api/v4/viewer/*` — undocumented, has had multi-day authenticated outages ([[../debt/incomplete-scrapes-empty-lessons]]).
- **LLM APIs (offline only):** GLM via `api.z.ai` (rewrites), Claude (independent judge pass, run as agent batches, not in-pipeline). No key ever reaches the deployed site — the browser app makes zero LLM calls.
- **Auth boundary:** Zoho IAM via Playwright; credentials in `.env` (gitignored).
- **Publish boundary (the legal one):** only `transformed/`-derived content may go public, per [[../decisions/adr-3-transform-then-publish]]; every published lesson passed an independent Claude judge against [[../judgment/lesson-transform-quality]].
- **Data stores:** local files + browser `localStorage` (`aidemy-arcade:v1`). Future: Cloudflare Workers/D1 for accounts/leaderboards (planned, not built).

## Related

- [[../overview]]
- [[../flows/content-pipeline]]
- [[../decisions/adr-1-playwright-over-requests]] · [[../decisions/adr-2-zero-build-vanilla-js-rule-based-distractors]] · [[../decisions/adr-3-transform-then-publish]]
- [[../debt/plaintext-credentials-in-env]] · [[../debt/no-tests]] · [[../debt/undocumented-api-dependency]] · [[../debt/incomplete-scrapes-empty-lessons]]
