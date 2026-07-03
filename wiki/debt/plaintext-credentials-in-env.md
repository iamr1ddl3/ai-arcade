---
title: Plaintext credentials in .env
type: debt
severity: medium
area: [[../modules/scrape_trainercentral]]
created: 2026-07-03
sources: []
updated: 2026-07-03
---

# Plaintext credentials in .env

TrainerCentral login credentials (`TC_EMAIL`, `TC_PASSWORD`) are read from a `.env` file at the project root, stored in plaintext.

## Root Cause

Simplest possible credential-passing mechanism for a personal single-user CLI script; no secrets manager or keychain integration was in scope.

## Impact

If `.env` were ever committed or the project directory synced/backed up somewhere less trusted, the TrainerCentral account password would leak. Mitigated today by `.gitignore` excluding `.env` (verified during bootstrap 2026-07-03), but the risk is structural, not just a gitignore rule.

## Remediation

Low priority for a personal utility — acceptable as-is given `--no-login` mode exists for public content and the file is gitignored. If this script is ever shared or the credentials become higher-value, move to OS keychain (`keyring` package) or prompt-only (drop `.env` support entirely, rely on `getpass`).

## Related

- [[../modules/scrape_trainercentral]]
