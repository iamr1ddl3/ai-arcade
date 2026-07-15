# PixelPlayground 🎮

A zero-build, browser-based **learning game** for AI/ML interview prep. Turns study
material into quizzes, flashcards, boss battles, and a roguelike gauntlet — with XP,
levels, streaks, badges, and three themes. No frameworks, no npm, no build step.

**▶️ Live:** https://ai-arcade-13g.pages.dev

---

## What it is

One HTML file, one JS file, one CSS file, plus a stdlib-only Python generator that emits
the game data as a single `content.json`. Runs entirely in the browser; progress is saved
to `localStorage` (no backend, no account).

- **20 courses / 1022 lessons** of AI/ML interview-prep content.
- **World Map** — each course a continent, each section a zone; sections unlock in order.
- **Practice quiz** — untimed multiple-choice. +10 XP per correct answer.
- **Flashcards + spaced repetition** — Anki-style (SM-2-lite) self-rated review.
- **Boss Battle** — timed 60s section quiz; ≥70% unlocks the next section (+100 XP, badge).
- **Roguelike Gauntlet** — endless cross-course rapid-fire, 3 lives, relics every 5 survived.
- **Confidence betting, daily challenges, themes** (Cyber Neon / Nebula / Daylight).

## Run it locally

```bash
python3 -m http.server 8000 --directory arcade
open http://localhost:8000/
```

> A static server is required — browsers block `fetch()` from `file://`, so double-clicking
> `index.html` won't load the content. Always serve over `http://`.

> **Note:** the live game's `content.json` is not in this repo (see *Content* below), so a
> fresh clone serves the app shell without lessons. The repo is the app + tooling; the
> content is supplied separately at deploy time.

## Architecture

```
scrape → transform (LLM rewrite + judge) → generate → play
```

- **`scrape_trainercentral.py`** — Playwright login + JSON-API walk → markdown (source stays local).
- **`arcade/transform_content.py`** — LLM rewrite + independent judge → derivative content.
- **`arcade/generate_content.py`** — stdlib generator → `content.json` (deterministic; rule-based
  distractors: wrong answers are drawn from *other* lessons in the same course).
- **`arcade/{index.html,app.js,styles.css}`** — the vanilla-JS single-page game.

Deep-dive design notes, ADRs, and flow docs live in [`wiki/`](wiki/).

## Deploy (CI/CD)

Deploys run in **GitHub Actions** → **Cloudflare Pages** ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)):

- **Code change** → `git push` → auto-deploys the app shell.
- **Content change** → `./deploy-content.sh` → regenerates and deploys content.

The deployable bundle is a clean `dist/` of just the static files + `content.json`.
Full runbook: **[arcade/DEPLOY.md](arcade/DEPLOY.md)**.

## Content

The course content this game was built from is **not** included in this repository. The
generated `content.json` and all intermediate content are kept private and are supplied to
the deploy pipeline separately. Only the application code, generator/scraper tooling, and
project wiki are public here.

## License

**All rights reserved.** This repository is published for viewing/reference; no license to
use, copy, modify, or redistribute the code is granted. (Intentionally omitting a `LICENSE`
file — adding one would grant rights this project does not intend to.)
