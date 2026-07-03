---
title: Dependency on undocumented TrainerCentral API
type: debt
severity: medium
area: [[../modules/scrape_trainercentral]]
created: 2026-07-03
sources: []
updated: 2026-07-03
---

# Dependency on undocumented TrainerCentral API

All data fetching goes through `showtime/api/v4/viewer/*` JSON endpoints that are not a published/versioned API — they were discovered by inspecting the site's own network traffic. A legacy anonymous-only endpoint fallback exists for `fetch_bundle_courses`, suggesting the primary endpoint already changed once.

## Root Cause

No official TrainerCentral API is available for this use case; the script relies on the same internal endpoints the TrainerCentral web app itself calls.

## Impact

The vendor can change these endpoints' shape or remove them without notice, silently breaking the scraper. `get_json` already retries 3x on non-200 to absorb transient 500s, but a genuine endpoint/schema change would need code updates, not just a retry.

## Remediation

No proactive fix planned — accept as inherent to scraping an undocumented API. If breakage occurs, re-inspect the site's network calls and update the endpoint URLs/response parsing accordingly.

## Related

- [[../modules/scrape_trainercentral]]
- [[../decisions/adr-1-playwright-over-requests]]
