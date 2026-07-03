---
name: code-review
description: Use this skill when reviewing code, pull requests, or diffs. Triggers on phrases like "review this", "check for security issues", "audit this code", "review this PR", or before any commit.
---

# code-review

Reviews code with a structured pass: correctness → security → domain-specific risks → maintainability. Returns one review with prioritized findings and a verdict.

## When to use

- Reviewing a PR or diff before merge
- Sanity-checking your own code before pushing
- Auditing existing code that wasn't reviewed
- Auto-invoked as a step inside `implement-change`

## Steps

1. **Read the code carefully.** Identify change scope. For diffs, read 20 lines of context above and below each change.

2. **Correctness pass.** Does the code do what the description says? Note logic errors, off-by-one mistakes, race conditions, missing edge cases, broken control flow.

3. **Security pass.** Check for:
   - Input validation gaps (SQL injection, command injection, path traversal)
   - Auth/authz holes (missing checks, weak comparisons, timing attacks)
   - Secrets in code, configs, or logs
   - Unsafe deserialization
   - Insecure crypto (weak hashes, hardcoded keys)
   - SSRF risk in code that fetches URLs
   - Dangerous defaults (open storage, debug mode in prod, permissive CORS)

4. **Domain-specific pass.** [CUSTOMIZE THIS FOR YOUR STACK — examples below]
   - Web apps: XSS, CSRF, insecure direct object references, missing rate limiting
   - Data pipelines: schema drift, idempotency, cost regression (scan sizes), PII in logs
   - ML systems: prompt injection, embedding leakage, cost regression (model tier changes)
   - Mobile: hardcoded keys, sensitive data in local storage, deep link parameter validation

5. **Maintainability pass.** Note:
   - Functions over 50 lines
   - Magic numbers without comment
   - Missing or misleading names
   - Duplicated logic
   - Tests missing for non-trivial logic

6. **Output the review** in the format below. Always include file path + line number.

## Output format

```
### Code Review

**Verdict:** [APPROVE / APPROVE WITH CHANGES / REQUEST CHANGES]

**Summary:** [2-3 sentences. What does this change do, and what's the headline concern if any?]

#### Blocking issues (must fix before merge)
- `path/to/file.py:42` — [issue]. [why it matters]. [suggested fix]

#### Non-blocking issues (worth addressing)
- `path/to/file.py:88` — [issue]. [why]. [suggested fix]

#### Nits (optional)
- `path/to/file.py:103` — [issue]. [suggestion]

#### What I liked
- [1-2 things done well — always include something]
```

## What good looks like

- Verdict is one of three options. Don't hedge.
- Every issue has file path AND line number. No "somewhere in this function".
- Blocking vs non-blocking is honest.
- "What I liked" is real, even on rough PRs.

## What to avoid

- Padding the review with theoretical concerns.
- Vague suggestions ("consider refactoring this") — be specific.
- Skipping the security pass and just saying "no security surface" without checking.
