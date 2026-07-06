---
title: aidemy-bundle — Overview
type: overview
updated: 2026-07-06
---

# aidemy-bundle — Overview

`aidemy-bundle` started as a single-purpose CLI tool that scrapes the user's own AIdemy course content (hosted on TrainerCentral, `aidemy.trainercentralsite.in`) to local Markdown. It has since grown into a **content pipeline + game**: the scraped lessons are rewritten into original derivative material by an LLM pipeline, and served as **AIdemy Arcade** — a zero-build, gamified interview-prep web app (quizzes, flashcards with spaced repetition, boss battles, roguelike gauntlet, daily challenges) covering 20 courses / 1022 playable lessons.

Four modules, one pipeline (see [[flows/content-pipeline]]):

1. [[modules/scrape_trainercentral]] — Playwright login + API walk → `tc_scrape_output/` (immutable-ish source corpus, gitignored).
2. [[modules/arcade-transform]] — GLM-5.2 substantial rewrite (+ pluggable judge; the production gate is an independent Claude judge pass) → `transformed/` derivative content, per [[decisions/adr-3-transform-then-publish]].
3. [[modules/arcade-generator]] — stdlib, deterministic: markdown → `content.json` (MCQ/cloze/steps per lesson), per [[decisions/adr-2-zero-build-vanilla-js-rule-based-distractors]].
4. [[modules/arcade-app]] — vanilla-JS SPA game; localStorage progress; themable (Cyber Neon default); mobile tab-bar navigation.

Privacy invariants: `.env` (credentials), `tc_scrape_output/` (purchased content), `transformed/`, `content.json`, and the transform cache are all gitignored. Only app code and the wiki are tracked. The public deploy (Cloudflare Pages, pending) ships **only derivative content** that passed an independent LLM judge.

## Domain

`tooling` — personal dev-workflow utility grown into a personal learning product; still not portfolio/showcase material (see CLAUDE.md scope note).

## Status

`active` — content pipeline complete for all fully-scraped courses; game feature-complete for v1; remaining: git commit of the arcade work, Cloudflare Pages deploy (user-gated), 2 courses blocked on a vendor API outage ([[debt/incomplete-scrapes-empty-lessons]]).

## Key entry points

- [[architecture/system-map]]
- [[flows/content-pipeline]]
- [[modules/arcade-app]]
- [[index]]

## Open questions

1. Credential handling (`.env` vs keychain) — see [[debt/plaintext-credentials-in-env]].
2. Vendor-API breakage detection is still "notice at next manual run" — see [[debt/undocumented-api-dependency]]; the 2026-07 outage showed a read-only probe pattern that could be scripted.
3. Re-scrape-on-update remains unsolved (idempotency skips any course with `_combined.md`); blocked-course recovery also waits on the vendor.
4. When the Workers/D1 backend lands (accounts/leaderboards), does progress migrate from localStorage or start fresh?
5. Should the remaining 2 blocked courses ship later as an incremental content drop (generator supports this with zero code changes)?
