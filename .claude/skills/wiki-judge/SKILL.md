---
name: wiki-judge
description: Use this skill to codify "what good looks like" for a topic as a machine-readable scoring rubric. Triggers on phrases like "build a scorer for X", "codify quality criteria", "make this judgeable", "define the rubric for X", "what does good copy/code/deck look like", or whenever turning expert judgment into a callable evaluation.
---

# wiki-judge

Codify expert judgment for a topic as a scoring rubric. Output is a judgment page that a skill page can call at runtime.

## When to use

- Need to turn expert taste into an eval ("score this deck", "is this copy good", "is this PR safe to merge")
- Existing knowledge pages describe WHAT — need to add HOW WELL
- Before building a skill, pin down the scoring criteria
- After reading expert source material (book, talk, internal SME notes) — extract the rubric

## Steps

1. **Identify the topic.** What is being judged? A pitch deck, a refund decision, an API design, a piece of copy? Be narrow — one rubric per topic.

2. **Read `wiki/SCHEMAS.md` §Judgment Page** for the schema.

3. **Source of authority.** Where does this rubric come from? Cite the book, expert, real outcomes, or internal SME. Without authority, the rubric is opinion not judgment.

4. **Define "good" in 3-5 sentences.** Concrete, testable. Not "high quality" — "scores 80+ on rubric below."

5. **List criteria.** 5-15 weighted dimensions. Each criterion needs: name, weight (0-10), what scores high, what scores low. Avoid vague labels.

6. **Edge cases.** Hard cases reviewers disagree on. Document how to score them.

7. **Anti-patterns (auto-fail).** Conditions that override the rubric and force fail regardless of weighted score (e.g., "claims a specific VC is interested = auto-fail").

8. **Write page** at `wiki/judgment/<topic>.md` (or `wiki/<domain>/judgment/<topic>.md` for domain-scoped).

9. **Cross-link the quad.** Reference: the skill that will call this, the eval set, the guardrails. Stub the other 3 if they don't exist yet.

10. **Append `wiki/log.md`** via `wiki-write` conventions. Operation: `judgment-codify`.

## What good looks like

- Two independent reviewers applying the rubric to the same artifact land within 10 points.
- Every criterion has concrete "high vs low" examples, not adjectives.
- Anti-patterns are listed — judgment can override its own score.
- Source of authority is named, not implied.
- Total max + pass threshold are explicit numbers, not vibes.

## What to avoid

- Single-criterion rubrics (collapse to one dimension = bad judgment).
- Vague criteria like "is it good" or "is it clear" with no scoring anchors.
- No source of authority → "because I think so" rubric.
- Burying scoring logic inside a skill page instead of filing a judgment page.
- Skipping anti-patterns. Without auto-fail rules, weighted scores can hide disqualifying flaws.

## Reference templates

- `templates/judgment-template.md` — boilerplate
- 100x Ogilvy copy reviewer pattern — example of well-scoped 15-criterion rubric
