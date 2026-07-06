---
title: Arcade Generator
type: module
tags: [tooling, python]
language: python
entry_point: arcade/generate_content.py
sources: []
updated: 2026-07-06
---

# Arcade Generator

A stdlib-only Python script that turns the scraped course markdown in `tc_scrape_output/`
into a single `arcade/data/content.json` file consumed by [[modules/arcade-app]]. It parses
each lesson into a flashcard and — for courses with enough answerable lessons — a
multiple-choice quiz whose distractors are the answers of other lessons in the same course.

## Responsibility

Owns: reading `tc_scrape_output/<course>/<section>/<NN>-<slug>.md` + each course's
`_combined.md`; parsing lesson titles, sections, and answers; rule-based distractor
selection; emitting the versioned `content.json` schema; printing a per-course completeness
report.

Does NOT own: scraping (it never touches the network — [[modules/scrape_trainercentral]] does
that) and never modifies anything under `tc_scrape_output/` (read-only). It does not render
or run the game — that's [[modules/arcade-app]].

## Public Interface

- CLI: `python3 arcade/generate_content.py [--root DIR] [--out FILE]`.
- `slugify(s)` — copied from [[modules/scrape_trainercentral]] so section-dir names match
  `_combined.md` module display names.
- `extract_answer(sections) -> (text, source)` — ordered fallback chain: `short interview-ready
  answer` → `definition` first paragraph → first prose paragraph. **LLM extension seam.**
- `build_distractors(lesson, course_pool, rng) -> [str, str, str]` — picks 3 same-course
  answers, same-section siblings preferred. **LLM extension seam.**
- `extract_steps(sections) -> [str] | None` (2026-07-06) — pulls 3–5 numbered steps from a
  "how it works"-style section, stored in **correct order** (the app shuffles at play time, so
  content.json stays deterministic). Feeds order-the-steps questions.
- `cloze_term(answer, title)` + `build_cloze(lesson, course_pool, rng)` (2026-07-06) — masks the
  most distinctive word in the answer (prefers a term also in the title, then longest;
  `CLOZE_STOPWORDS` filters generic words); distractor words = other lessons' cloze terms.
  Emits `lesson.cloze` with the same 4-distinct-options/answerIndex invariants as the MCQ.
  Only when `quiz_enabled` (needs the course pool for distractors).
- `parse_sections(body)`, `parse_combined(course_dir)`, `strip_markdown`, `truncate`.

## Dependencies

- Python stdlib only (`pathlib`, `re`, `json`, `random`, `datetime`, `argparse`) — no pip deps.
- Reads the output of [[modules/scrape_trainercentral]] as its input corpus, OR the derivative
  tree from [[modules/arcade-transform]] via `--root transformed` (verified: no code change needed
  — nothing branches on the source path).

## Dependents

- [[modules/arcade-app]] — consumes the emitted `content.json`.
- [[modules/arcade-transform]] — upstream producer of the `transformed/` tree the generator reads
  when publishing derivative content.

## Data Flow

`tc_scrape_output/**/*.md` (read-only) → parse + rule-based question generation →
`arcade/data/content.json` (gitignored — derives from gitignored scraped content). Seeded RNG
(`random.Random(1337)`) makes output byte-identical across runs.

## Key Decisions

- Zero-build, offline, rule-based, deterministic generation — see
  [[decisions/adr-2-zero-build-vanilla-js-rule-based-distractors]].
- Lenient stub rule: a lesson is kept if it has ≥5 non-blank lines and an extractable answer
  (both `##` and `###` section styles count). Only genuinely empty lessons are dropped.
- Per-course quiz gating: quizzes are enabled only for courses with ≥4 answerable lessons
  (need a distractor pool); thinner courses ship as flashcards only.

## Known Issues / Debt

- [[debt/incomplete-scrapes-empty-lessons]] — ~199/1192 lessons in the RAW scrape root are
  empty stubs and skipped (the production `--root transformed` tree contains only playable
  lessons, so builds from it report 0 stubs);
  two courses (`autogen-essentials`, `statistics-math-for-aiml-interviews`) come out empty and
  are dropped from the map. Content grows automatically once the scrape completes and this
  script is re-run.
- No automated tests (see [[debt/no-tests]] for the project-wide gap).

## Related

- [[modules/arcade-app]]
- [[decisions/adr-2-zero-build-vanilla-js-rule-based-distractors]]
