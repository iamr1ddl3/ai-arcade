---
title: Date helpers mix local construction with UTC serialization
type: debt
severity: resolved
area: [[../modules/arcade-app]]
created: 2026-07-15
sources: []
updated: 2026-07-16
---

# Date helpers mix local construction with UTC serialization

> **RESOLVED 2026-07-16.** `addDays`/`daysBetween` now parse `"T00:00:00Z"` and use
> `setUTCDate`; `weekKey` switched to `getUTCDay`/`setUTCDate`. All four helpers reckon
> in UTC, so they agree in any host timezone. Verified: the app.js suite (15 tests)
> passes under UTC, IST (+5:30), Samoa (+13), and Hawaii (-10); the pinned "KNOWN BUG"
> test was flipped to assert exact round-trip (`date helpers: addDays/daysBetween
> round-trip exactly`). Proof of the pre-fix defect: in IST, old `addDays(today, -1)`
> returned a date **two** days back, read by `daysBetween` as `-2` (4/4 round-trips
> failed); post-fix, 0 failures.

`app.js` date helpers build `Date`s at **local** midnight but serialize them as **UTC**, so on a machine whose timezone is not UTC, `addDays()` and `daysBetween()` can disagree by a day. Surfaced while writing the app.js state tests ([[no-tests]] remediation #3), not introduced by them.

## Description

- `todayStr(d = new Date())` returns `d.toISOString().slice(0, 10)` — a **UTC** calendar day.
- `addDays(dateStr, days)` does `new Date(dateStr + "T00:00:00")` — **local** midnight — then `.setDate(...)`, then serializes via `todayStr()` (UTC).

On a non-UTC host the local→UTC shift can move the serialized day. Observed on IST (+5:30): `addDays("2026-07-15", -1)` returns `2026-07-13`, and `daysBetween` counts gaps such that a true "1 day ago" is unreachable via `addDays`. The two helpers use different reckonings, so streak math across a day boundary (`bumpStreak`'s consecutive-day / freeze-bridge branches) can be off by one in zones far from UTC.

## Root Cause

Written and verified in the author's local browser, where same-day comparisons are usually self-cancelling, so the local/UTC mismatch never showed. It only appears when the host TZ offset pushes local midnight across the UTC date line.

## Impact

**Low.** For most users near UTC it's invisible; players in far-offset zones could occasionally see a streak increment/reset off by a day, or a freeze consumed on the wrong boundary. No data loss or crash; purely a gamification-accuracy edge. Not on the deploy hot path.

The app.js tests ([[no-tests]] #3) work *around* this by deriving seed dates from the app's own `daysBetween()` (its internal reckoning), and one test (`KNOWN BUG: addDays/daysBetween can disagree off-UTC`) pins the current behavior so a future fix is a deliberate, visible change.

## Remediation

Make both helpers use the **same** reckoning — cleanest is all-UTC: build dates with `Date.UTC(...)` / `setUTCDate(...)` and keep `toISOString()` serialization, or switch to a small local-day formatter (`getFullYear`/`getMonth`/`getDate`) everywhere and drop `toISOString`. Small change (~5 lines across `todayStr`/`addDays`/`daysBetween`), but it shifts streak/scheduling behavior, so it needs the app.js test suite green afterward and a note that the pinned "KNOWN BUG" test flips. Effort: ~30 min incl. re-verification.

## Related

- [[no-tests]] · [[../modules/arcade-app]]
