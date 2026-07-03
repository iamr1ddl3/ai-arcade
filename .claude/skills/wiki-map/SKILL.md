---
name: wiki-map
description: Use this skill to map an unfamiliar codebase from cold start — produces system-map, stub module pages, and overview synthesis. Triggers on phrases like "map this codebase", "do a MAP", "wikify this new project", "I just dropped new code in raw/code/, build the wiki". Rare — typically run once per project.
---

# wiki-map

Cold-start mapping of a codebase. Produces a complete first-cut wiki: system-map, stub module pages for every component, and an overview synthesis. Used once per project.

## When to use

- A new codebase has been added that isn't in the wiki yet
- Existing wiki is so out of date that incremental ingest isn't worth it (rare)
- The user explicitly asks to "MAP" the codebase

## Steps

1. **Read every source file** in the target code directory. Do not skim.

2. **Identify top-level modules** and their relationships. A module is a coherent unit with clear inputs/outputs.

3. **Read `wiki/SCHEMAS.md`** for module, flow, and architecture page templates.

4. **Write `wiki/architecture/system-map.md`**: prose overview + table of every major component, its role, and its connections. This is the "you are here" map.

5. **Write stub module pages** for each identified module at `wiki/modules/<name>.md`:
   - Fill in what you can confidently extract from source (responsibility, public interface, dependencies).
   - Mark unfilled sections with `<!-- stub -->`.
   - Better to have 10 stubs than 3 complete pages and 7 missing.

6. **Write `wiki/overview.md`** as a first synthesis: what is this system, what are its phases, what are the key integrations, what are the open questions.

7. **Identify obvious debt** during the read (TODOs, hardcoded values, missing tests, duplication). File debt pages immediately at `wiki/debt/<slug>.md`.

8. **Identify obvious decisions** that an ADR should capture (chosen library, architecture style, key tradeoff). File ADRs at `wiki/decisions/adr-<N>-<slug>.md`.

9. **Update `wiki/index.md`** with every new page. Set the per-section counts accurately.

10. **Propose the 5 most important questions** to answer next. List them in the log entry.

11. **Append to `wiki/log.md`** with operation `map`.

12. **Recommend a backtest.** After MAP completes, suggest invoking `wiki-maintain` at backtest depth to validate the new wiki before it becomes load-bearing.

## What good looks like

- Every module in the source has a page (even if it's a stub).
- The system-map can answer "where does X happen?" by pointing at a module.
- Stubs are honest — marked as such, not faked.
- Debt and ADR pages are filed during the map, not deferred.
- The overview reads like a real synthesis, not a regurgitation of file names.

## What to avoid

- Skipping files because they "look unimportant" — read everything.
- Producing prose-only pages without the schema sections.
- Inventing module boundaries that don't exist in source.
- Skipping the post-MAP backtest recommendation.
