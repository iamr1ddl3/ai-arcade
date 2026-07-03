---
name: wiki-trace
description: Use this skill to follow a flow end-to-end through code and wiki, or to produce a structural synthesis (scale plan, roadmap). Triggers on phrases like "trace the X flow", "how does Y work end to end", "follow the path of Z", "scale-plan", "scaling roadmap", or any deep structural read that should result in a flow page or scaling page.
---

# wiki-trace

Walk a flow or structural slice through the codebase + wiki, then produce or update the corresponding `flows/` or `scaling/` page. This is for deep structural reads, not quick lookups (use `wiki-read` for those).

## When to use

- "How does a request get from user input to response?" — flow trace
- "What happens during data ingest end to end?" — flow trace
- "What are our top scaling bottlenecks and what should we do?" — scale-plan
- An existing flow/scaling page is stale, missing, or contradicted by new evidence

## Steps

### For flow tracing

1. **Identify the trigger.** What starts this flow? User action, scheduled job, external event.

2. **Read relevant module pages** via `wiki/index.md` to understand the participating modules at a high level first.

3. **Read source files** in your code directory to follow the actual path. Note module-to-module handoffs, data transformations, and error paths.

4. **Read `wiki/SCHEMAS.md`** for the Flow page template.

5. **Write or update `wiki/flows/<name>.md`**:
   - Trigger
   - Numbered steps with `[[modules/x]]` references at each hop
   - Data involved (`[[data-models/x]]` references)
   - Error paths
   - Performance characteristics

6. **Flag gaps.** If the trace breaks down (missing source, unclear handoff), say so in the page with a `<!-- gap -->` marker.

7. **Update `wiki/index.md`** if a new flow page was created.

8. **Append to `wiki/log.md`** with operation `trace`.

### For scale-plan

1. **Read** `wiki/overview.md`, `wiki/architecture/`, `wiki/modules/`, `wiki/debt/`, existing `wiki/scaling/` pages.

2. **Identify the 3-5 most critical bottlenecks** based on debt severity, scaling page urgency, and module coupling.

3. **For each bottleneck**, write or update a page in `wiki/scaling/` (per Scaling schema): current state → ceiling → strategy → milestones.

4. **Write `wiki/scaling/roadmap.md`** synthesizing the full picture with a prioritized action list.

5. **Update `wiki/index.md`** and **append to `wiki/log.md`** with operation `scale-plan`.

## What good looks like

- Every step in a flow page references the participating module via `[[modules/x]]`.
- Data transformations are explicit ("query string → embedding via [[apis/openai-embeddings]]").
- Gaps are marked, not invented.
- Scaling pages are forward-looking — they say what should change and when.

## What to avoid

- Writing a flow page from imagination — always verify against source.
- Conflating "what is" (module page) with "what should be" (scaling page).
- Producing a wall of prose. Use the schema sections.
