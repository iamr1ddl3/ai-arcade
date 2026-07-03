---
name: implement-change
description: Use this skill to make any non-trivial code change to the project. Wraps the full discipline loop — understand, plan, implement, review, record. Triggers on phrases like "implement X", "add a feature", "fix this bug", "refactor Y", "let's make this change". Auto-invokes code-review and wiki-write so context is preserved without manual effort.
---

# implement-change

The disciplined coding loop for this project. Use for any change worth a wiki entry: new features, refactors, non-trivial bug fixes. Automatically chains `code-review` and `wiki-write` so the library stays current without effort.

## When to use

- Adding a new feature
- Non-trivial bug fixes (>1 file, or behaviour change)
- Refactors that affect a module's public interface
- Resolving a debt item

**Skip this skill for:** typo fixes, single-line tweaks, comment edits. Those go straight to `code-review` or just commit.

## Steps

1. **Understand.** Read the relevant wiki pages first via `wiki-read` (modules, ADRs, debt). If the wiki is silent on the area, read the source directly. State back to the user what you understand the task to be — confirm before coding.

2. **Plan.** Write a short plan: which files change, what the change is, what could go wrong, what tests to run after. Keep it under 10 bullets. Get user confirmation if the plan is non-obvious.

3. **Implement.** Make the changes file by file. Match existing code style. Don't expand scope beyond the plan — flag any "while I'm here" temptations and ask first.

4. **Self-review via `code-review`.** Auto-invoke the `code-review` skill on the diff. Address all blocking issues before continuing. Surface non-blocking issues to the user.

5. **Test.** Run any project tests touched by the change. Recommend (don't auto-run) eval/regression suites that cover the changed functionality.

6. **Record via `wiki-write`.** Auto-invoke the `wiki-write` skill to:
   - Update the affected `wiki/modules/*.md` page(s)
   - File an ADR at `wiki/decisions/adr-<N>-<slug>.md` if this was a meaningful design choice
   - Update `wiki/debt/*.md` — close items resolved, file new items introduced
   - Update `wiki/flows/*.md` if a flow changed
   - Update `wiki/index.md`
   - Append to `wiki/log.md` with operation `update`

7. **Summarize.** Tell the user: what changed, what was reviewed, what was recorded in the wiki, what (if anything) needs follow-up.

## Auto-chain summary

```
implement-change
  └─> wiki-read         (understand existing context)
  └─> [plan + implement]
  └─> code-review       (auto)
  └─> [tests / eval recommendation]
  └─> wiki-write        (auto — updates pages, index, log)
```

## What good looks like

- Steps 1-2 (understand, plan) happen BEFORE any file edit. No coding without confirmed scope.
- The user is told what's in the wiki BEFORE implementation starts.
- Code review issues are addressed in-loop, not deferred.
- The wiki update is automatic — the user never has to remember to record context.
- The final summary is scannable in 30 seconds.

## What to avoid

- Skipping the read-wiki-first step — wastes tokens and risks contradicting recorded decisions.
- Scope creep without asking.
- Auto-running evals or migrations — recommend, don't execute, unless user explicitly approves.
- Marking the change "done" before the wiki entry is written and the log is appended.
