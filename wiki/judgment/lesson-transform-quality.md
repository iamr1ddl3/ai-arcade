---
title: Lesson Transform Quality
type: judgment
tags: [scoring, rubric, evaluation]
domain: ai-ml
applies_to: [[../modules/arcade-transform]]
sources: []
updated: 2026-07-04
---

# Lesson Transform Quality

Machine-readable rubric for judging a GLM-rewritten lesson before it ships to the public
arcade. A rewrite must be **high-quality teaching**, **technically correct**, and
**defensibly its own derivative work** (not a verbatim copy of the purchased source). The
transform pipeline ([[../modules/arcade-transform]]) calls this rubric via its judge (Sonnet or
GLM) and ships only lessons that pass. Exists as a rubric so the accept/retry gate is objective
and identical across judge models.

## Definition of Good

A good transformed lesson answers the same question the source lesson posed, is technically
accurate, and reads as clear original teaching a learner would benefit from — while being
reworded and restructured enough that it is not recognizable as a copy of the source's wording
or sentence structure. It must satisfy the parser contract (an `# H1` question title plus
≥20 chars of answerable prose under a `##` section) so the downstream generator can build a
playable card from it.

## Scoring Criteria

The judge returns `{quality: 0-10, defensibility: 0-10, correctness: pass|fail, notes}`.

| # | Criterion | Weight | What scores high | What scores low |
|---|-----------|--------|------------------|-----------------|
| 1 | Correctness | pass/fail (gate) | Every technical claim is accurate; no facts invented, dropped, or distorted vs. the source concept | Any incorrect, hallucinated, or misleading claim → `fail` |
| 2 | Quality (pedagogy) | 0-10 | Clear, well-structured, easy to learn from; includes a concrete example/analogy; a learner would understand the concept | Vague, disorganized, padded, or harder to follow than a plain definition |
| 3 | Defensibility (derivative) | 0-10 | Reworded in fresh phrasing and reorganized structure; distinct sentence construction from the source; feels like original teaching | Sentences echo the source nearly verbatim; same structure and phrasing → close to a copy |
| 4 | Format compliance | folded into quality | Has `# H1` title + `##` sections incl. a concise answer; parser will accept it | Missing title or answerable section (would be dropped as a stub) |

**Pass threshold (accept for deploy):** `correctness == pass` AND `quality >= 7` AND
`defensibility >= 7`. Anything below → retry (up to 2×) → exclude + log.

## Edge Cases

- **Very short source lessons:** a faithful rewrite may still be brief. Judge quality on
  clarity, not length — but it must still clear ≥20 chars of real answer prose.
- **Code-heavy lessons:** correctness includes the code. A rewrite that changes code so it no
  longer runs or teaches the wrong pattern → `correctness: fail`, regardless of prose quality.
- **Over-rewriting:** if the rewrite is so transformed it now answers a *different* question or
  drifts off the source concept, that's a correctness fail (fidelity lost), not high
  defensibility.

## Anti-Patterns (Auto-Fail)

- Any factual error, invented citation, or distorted claim → `correctness: fail`.
- Near-verbatim copy of the source (defensibility purpose defeated) → force `defensibility <= 3`.
- Missing an `# H1` title or any answerable `##` section → format fail (would be dropped
  downstream; treat as quality < 7).
- Output contains meta-commentary ("Here is the rewritten lesson…") instead of clean lesson
  markdown.

## Source of Authority

Derived from the project's goal (publish *derivative* learning material, per
[[../decisions/adr-3-transform-then-publish]]) and the verified parser contract in
[[../modules/arcade-generator]]. The thresholds are conservative on purpose: the whole point of
the judge is to keep low-quality or too-close-to-source content off the public URL.

## Related

- [[../modules/arcade-transform]] — the pipeline that calls this rubric
- [[../decisions/adr-3-transform-then-publish]] — why derivative-first publishing
- [[../modules/arcade-generator]] — the parser contract the output must satisfy
