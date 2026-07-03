---
title: aidemy-bundle — Overview
type: overview
updated: 2026-07-03
---

# aidemy-bundle — Overview

`aidemy-bundle` is a single-purpose CLI tool that scrapes the user's own AIdemy course content, hosted on TrainerCentral (`aidemy.trainercentralsite.in`), and saves it locally as Markdown — organized by course and module, ready to feed to an LLM for study or reference. It exists so course material the user has paid for and is enrolled in can be read/searched/queried offline instead of only through the TrainerCentral web viewer.

It is one script ([[modules/scrape_trainercentral]]): log in via Playwright (handles the Zoho IAM nested-iframe password step), recursively walk a bundle or course through TrainerCentral's undocumented JSON API, convert each lesson's HTML to Markdown, and write per-lesson files plus a combined per-course file. Scraping is idempotent — a course already scraped (its `_combined.md` exists) is skipped on rerun.

This is a personal utility, not portfolio/showcase material — see the "Scope note" in the project's `CLAUDE.md`. Login credentials live in `.env` and scraped course content lives in `tc_scrape_output/`; both are gitignored and must never be committed or published, since the former is a live account password and the latter is the vendor's copyrighted course content.

## Domain

`tooling` — cross-cutting personal dev-workflow utility, not AI/ML showcase work.

## Status

`maintenance` — the script works and is run on demand to pull new/updated course content; no active feature development planned.

## Key entry points

- [[architecture/system-map]]
- [[modules/scrape_trainercentral]]
- [[index]]

## Open questions

1. Should credential handling move off `.env` to `keyring`/OS keychain, or is prompt-only (`getpass`) sufficient given this is single-user? See [[debt/plaintext-credentials-in-env]].
2. If TrainerCentral's `showtime/api/v4` endpoints change shape, how will breakage be detected — only at next manual run? See [[debt/undocumented-api-dependency]].
3. Is there a need to re-scrape courses whose content has been updated since the last scrape (currently skipped entirely if `_combined.md` exists)?
4. Should output support formats beyond Markdown (e.g. plain text, JSON) for different downstream LLM ingestion pipelines?
5. Is broader TrainerCentral/AIdemy-specific parsing (quizzes, video transcripts, attachments) in scope, or is lesson text-only permanently sufficient?
