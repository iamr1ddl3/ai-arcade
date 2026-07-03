---
name: wiki-read
description: Use this skill to look up information from the wiki and answer questions with citations. Triggers on phrases like "what does the wiki say about", "look up X in the wiki", "did we decide on Y", "is there a debt page for Z", "what was the rationale for", or any question whose answer might already be filed in the wiki.
---

# wiki-read

Look up information from the existing wiki and answer with `[[wikilink]]` citations. Stops the user from re-explaining context they already documented.

## When to use

- Any question about the codebase that might be answered in the wiki
- Before starting work on a module — read its page first
- When the user asks "did we already decide..." / "is there a page for..."
- Cross-checking a memory against the recorded source of truth

## Steps

1. **Read `wiki/index.md` first** to locate which pages are relevant. The index is the catalog — start there, not by guessing filenames.

2. **Read those pages in full.** Do not skim. The schema sections (Responsibility, Dependencies, Known Issues, etc.) all carry signal.

3. **Follow `[[wikilinks]]`** to related pages when the answer spans multiple entities (e.g., a question about a flow may need module + data-model + ADR pages).

4. **Synthesize an answer** with `[[wikilink]]` citations for every claim. Format wikilinks as `[[modules/name]]`, `[[decisions/adr-N-slug]]`, etc.

5. **Note gaps explicitly.** If the wiki doesn't contain the answer, say so plainly. Do NOT make something up. Suggest invoking `wiki-trace` (for flows) or `wiki-write` (to file what you learn).

6. **Offer to file reusable answers.** If the question is non-trivial and likely to recur, offer to save the answer as `wiki/analyses/<slug>.md`. If the user accepts, follow `wiki-write` steps to file it and update the index + log.

## What good looks like

- Every factual claim has a `[[wikilink]]` citation.
- Gaps are flagged, not papered over.
- Answer length matches question complexity — no padding.
- Reusable answers are offered for filing under `analyses/`.

## What to avoid

- Answering from memory without consulting the wiki.
- Bare text mentions of entities that have their own page (use wikilinks).
- Inventing facts when the wiki is silent — say "wiki doesn't cover this" instead.
- Re-reading the same page multiple times in one session.
