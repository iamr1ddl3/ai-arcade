# aidemy-bundle — Wiki Index

Master table of contents for the aidemy-bundle wiki.

## Page types

- `modules/` — code modules (1)
- `apis/` — API endpoints (0)
- `data-models/` — schemas and types (0)
- `flows/` — end-to-end flows (0)
- `decisions/` — ADRs (1)
- `debt/` — known issues / tech debt (3)
- `scaling/` — scaling plans (0)
- `concepts/` — cross-cutting lore (0)
- `analyses/` — investigations, backtests, audits (0)
- `architecture/system-map.md` — top-level system map

## Pages

### modules/
- [[modules/scrape_trainercentral]] — the entire script: login, API walk, HTML→MD conversion, file output

### decisions/
- [[decisions/adr-1-playwright-over-requests]] — why Playwright drives login while data fetch uses raw JSON API calls

### debt/
- [[debt/plaintext-credentials-in-env]] — TC_EMAIL/TC_PASSWORD stored in plaintext .env
- [[debt/no-tests]] — no automated tests for slugify/html_to_md or the scrape walk
- [[debt/undocumented-api-dependency]] — reliance on undocumented showtime/api/v4 endpoints

## Entry points

- [[overview]] — project overview
- [[architecture/system-map]] — high-level system map
- [[log]] — chronological activity log
- [[MILESTONES]] — milestone tags
