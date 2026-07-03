---
title: "ADR-1: Playwright for login, raw JSON API for data"
type: decision
status: accepted
date: 2026-07-03
sources: []
updated: 2026-07-03
---

# ADR-1: Playwright for login, raw JSON API for data

## Status
Accepted

## Context

TrainerCentral's login flow renders the password field inside a nested Zoho IAM iframe, and session establishment depends on cookies/redirects that are easier to drive through a real browser than to replicate with a plain HTTP client (`requests`/`httpx`). Once authenticated, however, all course/section/session data is available through plain JSON endpoints under `showtime/api/v4/viewer/*`.

## Decision

Use Playwright (headless Chromium) only to perform the interactive login and obtain a cookie-bearing browser `context`. After login, use `context.request.get(...)` directly against the JSON API endpoints rather than navigating pages — this avoids the cost of rendering/parsing HTML pages for data that's already available as JSON.

## Consequences

- **Good:** avoids reimplementing the Zoho IAM iframe login flow with raw HTTP; reuses Playwright's cookie jar for authenticated API calls without extra session-management code.
- **Bad:** Playwright + Chromium is a heavy dependency (~300MB) for what is otherwise a pure API-walking script.
- **Neutral:** the API endpoints are undocumented and could change without notice — see [[../debt/undocumented-api-dependency]].

## Alternatives Considered

- Plain `requests`/`httpx` session replicating the login POST(s) — rejected because the password step is inside a nested iframe with a Zoho-managed IAM flow, making it fragile to hand-replicate.

## Related

- [[../modules/scrape_trainercentral]]
