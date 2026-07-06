# aidemy-bundle — Wiki Index

Master table of contents for the aidemy-bundle wiki.

## Page types

- `modules/` — code modules (4)
- `apis/` — API endpoints (0)
- `data-models/` — schemas and types (0)
- `flows/` — end-to-end flows (1)
- `decisions/` — ADRs (3)
- `debt/` — known issues / tech debt (4)
- `scaling/` — scaling plans (0)
- `concepts/` — cross-cutting lore (0)
- `analyses/` — investigations, backtests, audits (1)
- `judgment/` — scoring rubrics (1)
- `architecture/system-map.md` — top-level system map

## Pages

### modules/
- [[modules/scrape_trainercentral]] — the entire script: login, API walk, HTML→MD conversion, file output
- [[modules/arcade-generator]] — stdlib Python script that turns scraped markdown into the arcade's content.json
- [[modules/arcade-app]] — zero-build vanilla-JS learning game: quizzes, flashcards, XP, boss battles
- [[modules/arcade-transform]] — GLM rewrite + judge pipeline that turns scraped lessons into derivative content for public deploy

### flows/
- [[flows/content-pipeline]] — scrape → transform → judge → generate → play, the end-to-end path from vendor API to the deployed game

### decisions/
- [[decisions/adr-1-playwright-over-requests]] — why Playwright drives login while data fetch uses raw JSON API calls
- [[decisions/adr-2-zero-build-vanilla-js-rule-based-distractors]] — why the arcade is zero-build vanilla JS with rule-based offline question generation
- [[decisions/adr-3-transform-then-publish]] — why we rewrite purchased content into derivative material (GLM + judge) before deploying to Cloudflare Pages

### debt/
- [[debt/plaintext-credentials-in-env]] — TC_EMAIL/TC_PASSWORD stored in plaintext .env
- [[debt/no-tests]] — no automated tests for slugify/html_to_md or the scrape walk
- [[debt/undocumented-api-dependency]] — reliance on undocumented showtime/api/v4 endpoints
- [[debt/incomplete-scrapes-empty-lessons]] — 144/1192 (12%) locally scraped lessons have empty bodies; 2 courses 0% complete despite existing _combined.md

### analyses/
- [[analyses/backtest-initial-map-2026-07-03]] — 100% structural/accuracy/coverage/Q&A backtest, all findings fixed same session

### judgment/
- [[judgment/lesson-transform-quality]] — rubric for scoring GLM-rewritten lessons (quality/defensibility/correctness) before public deploy

## Entry points

- [[overview]] — project overview
- [[architecture/system-map]] — high-level system map
- [[log]] — chronological activity log
- [[MILESTONES]] — milestone tags
