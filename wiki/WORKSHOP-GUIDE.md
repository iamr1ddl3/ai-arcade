# Workshop Guide

_Human-readable reference for the LLM wiki system. Read this once to understand the system; then rely on skills and hooks to run it automatically._

---

## Philosophy

Every conversation with Claude starts blank. Without a wiki, you spend the first 5 minutes of every session re-explaining what you built last week. The wiki solves this: Claude reads `log.md` + `index.md` at the start of every session and resumes exactly where you left off.

The system has two jobs:

| Job | Tool | When |
|-----|------|------|
| **Library** | `wiki-*` skills | Before and after every meaningful change |
| **Workshop** | `code-review` + `implement-change` | During coding |

The library exists to serve the workshop. If the library doesn't save you time in the workshop, you're over-investing in it.

---

## Folder Layout

```
your-project/
├── CLAUDE.md                    ← loads every session; 30-line pointer
├── .claude/
│   ├── settings.json            ← hook wiring
│   ├── edit-log.txt             ← auto-generated audit trail
│   ├── hooks/                   ← Python scripts that fire automatically
│   └── skills/                  ← on-demand instruction sets
├── raw/                         ← immutable source inputs
└── wiki/                        ← institutional memory
    ├── SCHEMAS.md               ← page type templates
    ├── WORKSHOP-GUIDE.md        ← this file
    ├── index.md                 ← page catalog
    ├── log.md                   ← append-only activity log
    └── <page-type>/             ← modules, decisions, debt, flows, ...
```

---

## Skills Cheat Sheet

Invoke a skill by saying its trigger phrase. Claude loads the full `SKILL.md` instruction set and follows it for that procedure.

### wiki-map
**Trigger:** "map this codebase", "do a MAP", "wikify this project"
**When:** Once per project, on cold start
**Produces:** system-map, overview, stub module pages, initial debt + ADR pages
**Always follow with:** "audit the wiki" at backtest depth

### wiki-write
**Trigger:** "save this to the wiki", "wiki this change", "log this decision", "ingest this PR"
**When:** After any meaningful change or decision
**Produces:** Updated page(s) + index entry + log entry
**Note:** Auto-invoked inside `implement-change` — you rarely need to call this manually

### wiki-read
**Trigger:** "what does the wiki say about X", "did we decide on Y", "is there a page for Z"
**When:** Before starting work, or to answer a historical question
**Produces:** Cited answer with `[[wikilinks]]`; gap report if wiki is silent

### wiki-trace
**Trigger:** "trace the X flow", "how does Y work end to end", "scale-plan"
**When:** Need to understand a multi-module flow, or produce a scaling roadmap
**Produces:** `wiki/flows/<name>.md` or `wiki/scaling/<slug>.md`

### wiki-maintain
**Trigger:** "audit the wiki", "lint the wiki", "backtest the wiki", "check wiki health"
**When:** After a batch of writes, or before a major decision
**Depths:**
- `lint` (~5 min) — broken links, orphan pages
- `audit` (~15 min) — stale ADRs, ownership gaps, undocumented flows
- `backtest` (~30 min) — accuracy spot-check, coverage gaps, Q&A probe

### code-review
**Trigger:** "review this", "check for security issues", "audit this code"
**When:** Before any merge, or auto-invoked inside `implement-change`
**Produces:** Structured review with verdict, blocking/non-blocking issues, file:line citations

### implement-change
**Trigger:** "implement X", "add a feature", "fix this bug", "refactor Y"
**When:** Any non-trivial code change
**Auto-chains:** `wiki-read` → implement → `code-review` → `wiki-write`

---

## Hooks Reference

Hooks fire automatically — you don't invoke them. They enforce rules Claude might otherwise accidentally break.

### block-dangerous-commands.py
- **Event:** PreToolUse on Bash
- **Blocks:** `rm -rf` variants, `git push --force`, DROP TABLE, terraform destroy, docker volume wipes, reading `.env` / credentials
- **On block:** Claude sees the error and must ask you to run it manually

### protect-wiki-invariants.py
- **Event:** PreToolUse on Edit/Write/MultiEdit
- **Blocks:**
  - Any write to `raw/` (source inputs are immutable)
  - Any Edit/MultiEdit to `wiki/log.md` (must use Write with full content)
  - Any Write to `wiki/log.md` that doesn't start with the existing content (append-only check)

### wiki-edit-log.py
- **Event:** PostToolUse on Edit/Write/MultiEdit
- **Does:** Appends `[timestamp] ToolName -> file/path` to `.claude/edit-log.txt`
- **Non-blocking:** Never stops Claude; just logs

---

## Wiki Page Types

| Type | Path | Use for |
|------|------|---------|
| Module | `wiki/modules/<name>.md` | A logical unit of code with clear inputs/outputs |
| API | `wiki/apis/<name>.md` | An external or internal API surface |
| Data Model | `wiki/data-models/<name>.md` | An entity, schema, or DTO |
| ADR | `wiki/decisions/adr-N-<slug>.md` | An architecture decision with context + rationale |
| Debt | `wiki/debt/<slug>.md` | A known problem, limitation, or shortcut |
| Flow | `wiki/flows/<name>.md` | An end-to-end process across multiple modules |
| Scaling | `wiki/scaling/<slug>.md` | A scaling bottleneck or strategy |
| Concept | `wiki/concepts/<name>.md` | A domain concept worth explaining once |
| Analysis | `wiki/analyses/<slug>.md` | A one-off evaluation, benchmark, or report |

---

## The Debt-ADR-Module Triangle

Every significant issue, decision, and component forms a triangle of cross-linked pages:

```
   [debt/issue]  ←──────────  [modules/owner]
        │                            │
        │                            │
        └──────→  [decisions/adr-N]  ┘
```

- Every **debt** page references its owning module (`area: [[modules/x]]`)
- Every **ADR** page lists the modules it affects in `## Related`
- Every **module** page lists its debt items in `## Known Issues / Debt` and its relevant ADRs in `## Key Decisions`

If you file a debt item without updating the module page, or file an ADR without linking the module, the triangle is broken. `wiki-maintain` will catch this.

---

## Log Operations Reference

Valid `<operation>` values for `wiki/log.md` entries:

| Operation | When |
|-----------|------|
| `map` | Cold-start wiki-map of a codebase |
| `ingest-module` | Added/updated a module page from source |
| `ingest-pr` | Ingested a PR from `raw/prs/` |
| `ingest-doc` | Ingested a design doc from `raw/docs/` |
| `update` | Modified pages after a code change |
| `analysis` | Filed an analysis, evaluation, or report |
| `trace` | Produced a flow or scaling page |
| `audit` | wiki-maintain audit run |
| `lint` | wiki-maintain lint run |
| `backtest` | wiki-maintain backtest run |

---

## Worked Example — Adding a New Feature

```
You:    implement the payment webhook handler

Claude: [invokes implement-change]

Step 1  UNDERSTAND
        → reads wiki/index.md
        → reads wiki/modules/payment-service.md
        → reads wiki/decisions/adr-3-stripe-over-braintree.md
        → confirms: "I understand we're adding a Stripe webhook handler
          in payment-service.py. Should it go in the existing file or a new module?"

Step 2  PLAN
        → lists 6 bullet changes, flags that this touches the payments flow page
        → you confirm

Step 3  IMPLEMENT
        → writes payment-service.py changes
        → updates payments/webhook_handler.py

Step 4  CODE REVIEW (auto)
        → APPROVE WITH CHANGES: 1 blocking issue (missing HMAC signature verification)
        → you approve fixing it
        → fix applied

Step 5  TEST
        → runs existing payment tests
        → recommends: "run integration test suite before deploying"

Step 6  WIKI-WRITE (auto)
        → updates wiki/modules/payment-service.md (new webhook section)
        → files wiki/decisions/adr-7-webhook-hmac-verification.md
        → updates wiki/flows/payment-flow.md (new webhook step)
        → updates wiki/index.md (ADR count 6→7)
        → appends to wiki/log.md

Step 7  SUMMARY
        → "Added Stripe webhook handler with HMAC verification.
           1 blocking security issue found and fixed (missing signature check).
           ADR-7 filed. Payment flow page updated. Recommend running integration tests."
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Hook not blocking `raw/` edits | Hook not running | Check `settings.json` paths; verify Python 3 is available |
| `log.md` getting edited instead of appended | `protect-wiki-invariants` not wired | Verify `settings.json` `matcher` includes `Write` |
| Skills not triggering | Trigger phrase not matching | Say the skill name explicitly: "use wiki-write to..." |
| Wiki answers are stale | Pages not updated after code changes | Run "audit the wiki"; use `implement-change` for future changes |
| Context window filling up fast | Too many full pages loaded | Start a fresh session; the log + index reload gives full orientation in ~2000 tokens |
| Broken wikilinks after rename | File renamed without updating links | Run "lint the wiki" to find all broken links |
