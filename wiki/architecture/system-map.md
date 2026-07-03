---
title: System Map
type: architecture
updated: 2026-07-03
---

# System Map

`aidemy-bundle` is a single-file CLI utility: it logs into the TrainerCentral-hosted AIdemy course platform with Playwright, walks a course or bundle's API, and writes each lesson's HTML content to Markdown on disk. There is one module because there is one script.

## Components

| Component | Role | Connections |
|---|---|---|
| [[../modules/scrape_trainercentral]] | Login, API walk, HTML→MD conversion, file output | Talks to `aidemy.trainercentralsite.in` (Playwright browser + authenticated `context.request` calls); writes to `tc_scrape_output/` |

## Boundaries

- **External API:** `aidemy.trainercentralsite.in/showtime/api/v4/viewer/*` — undocumented, vendor-controlled JSON endpoints (course/bundle/section/session data). A legacy anonymous-only fallback endpoint exists for bundle listing.
- **Auth boundary:** Zoho IAM login flow (nested iframe), driven via Playwright; credentials sourced from `.env` (`TC_EMAIL`/`TC_PASSWORD`) or interactive prompt.
- **Data store:** none — output is local Markdown files under `tc_scrape_output/`, gitignored (scraped course content must never be published).

## Related

- [[../overview]]
- [[../debt/plaintext-credentials-in-env]]
- [[../debt/no-tests]]
- [[../debt/undocumented-api-dependency]]
- [[../decisions/adr-1-playwright-over-requests]]
