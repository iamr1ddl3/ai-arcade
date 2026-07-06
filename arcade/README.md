# AIdemy Arcade 🎮

A self-contained, offline, browser-based learning **game** generated from the scraped
AIdemy course content in `../tc_scrape_output/`. Turns ~1000 AI/ML interview-prep Q&A
lessons into quizzes, flashcards, and boss battles with XP, levels, streaks, and badges.

No frameworks, no npm, no build step — one HTML file, one JS file, one CSS file, plus a
Python generator that emits the game data.

## Quick start

```bash
# 1. Build the game data from the scraped markdown (writes arcade/data/content.json)
python3 arcade/generate_content.py

# 2. Serve the app (a static server is REQUIRED — see caveat below)
python3 -m http.server 8000 --directory arcade

# 3. Open it
open http://localhost:8000/
```

> **Why a server?** Browsers block `fetch()` from `file://`, so double-clicking
> `index.html` will show a "couldn't load content" screen. Always serve over `http://`.

## Game mechanics

- **World Map** — each course is a continent, each section a zone. Sections unlock in order.
- **Practice quiz** — untimed multiple-choice over a section. +10 XP per correct answer.
- **Flashcards + spaced repetition** — flip a card, self-rate Again / Hard / Good / Easy.
  Cards you miss resurface (Anki-style, SM-2-lite scheduling). +2 XP per card.
- **Boss Battle** — a **timed** (60s) quiz over a whole section. Score ≥70% to beat it,
  which **unlocks the next section**, awards +100 XP and a badge. Retry on fail/timeout.
- **XP / Levels / Streaks / Badges** — all saved in your browser's `localStorage`
  (key `aidemy-arcade:v1`). No backend, no account. Reset from the Profile screen.

## How questions are made

Rule-based and fully offline (deterministic — same input, same output):

- **Question** = the lesson's title (`# What is ...?`).
- **Correct answer** = the lesson's "Short interview-ready answer", or its Definition /
  first paragraph as a fallback.
- **Wrong answers** = the answers of 3 *other* lessons from the **same course** — topically
  related but wrong, which makes for non-trivial distractors.

The generator isolates `extract_answer()` and `build_distractors()` so an LLM-powered
variant (better distractors, generated summaries) can be added later behind a `--llm` flag
without changing the JSON schema or the frontend.

## Data quality caveat

Of 1192 scraped lessons, **~199 are empty stubs** (title only) from an incomplete
authenticated scrape — these are skipped, and two courses (`autogen-essentials`,
`statistics-math-for-aiml-interviews`) come out empty and don't appear on the map.
This is tracked in `../wiki/debt/incomplete-scrapes-empty-lessons`. When the scrape is
completed, just re-run `generate_content.py` and the game grows automatically.

## Publishing online (derivative content)

To put the arcade on a public URL, don't publish the raw scraped content — transform it into
your own derivative material first. The pipeline is **transform (GLM rewrite + judge) → generate
→ deploy (Cloudflare Pages)**. Full runbook: **[DEPLOY.md](DEPLOY.md)**.

```bash
python3 arcade/transform_content.py --course advanced-rag --judge glm   # → transformed/
python3 arcade/generate_content.py  --root transformed                  # → data/content.json
wrangler pages deploy ./arcade --project-name aidemy-arcade             # → public URL
```

## Files

| File | Committed? | Purpose |
|------|-----------|---------|
| `generate_content.py` | ✅ | Stdlib-only generator: parses `tc_scrape_output/` (or `transformed/`), emits `data/content.json`. Never scrapes, never modifies source files. |
| `transform_content.py` | ✅ | GLM rewrite + judge pipeline → `transformed/` derivative content. Offline; reads keys from `.env`. |
| `index.html` / `app.js` / `styles.css` | ✅ | The vanilla-JS single-page game. |
| `_headers` / `DEPLOY.md` | ✅ | Cloudflare Pages cache/security headers + deploy runbook. |
| `data/content.json` | ❌ gitignored | Generated game data — derived from gitignored content, so never published as source. |
| `transformed/` · `.transform_cache.json` | ❌ gitignored | Rewritten lessons + LLM cache — source-derived, local only. |
