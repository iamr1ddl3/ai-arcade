# PixelPlayground 🎮

> **Level up your AI/ML interview prep by *playing* it.**
> Study material becomes quizzes, flashcards, boss battles, and a roguelike gauntlet —
> with XP, levels, streaks, badges, and three themes. No frameworks, no npm, no build step.

<p>
  <img alt="Content: 20 courses" src="https://img.shields.io/badge/📚_courses-20-6c5ce7">
  <img alt="Lessons: 1022" src="https://img.shields.io/badge/🎯_lessons-1022-ffd23f">
  <img alt="Build step: none" src="https://img.shields.io/badge/⚙️_build_step-none-2ecc71">
  <img alt="Backend: none" src="https://img.shields.io/badge/💾_backend-localStorage-4fc3f7">
  <img alt="Dependencies: zero" src="https://img.shields.io/badge/📦_runtime_deps-0-ff5c72">
</p>

**▶️ PLAY NOW → https://ai-arcade-13g.pages.dev**

---

## 🕹️ Insert coin

One HTML file, one JS file, one CSS file, plus a stdlib-only Python generator that emits
the game data as a single `content.json`. Runs entirely in the browser; your progress saves
to `localStorage` — no backend, no account, no lives lost to a lost session.

## 🎲 Game modes

| Mode | What you do | Reward |
|------|-------------|--------|
| 🗺️ **World Map** | Each course a continent, each section a zone — clear them in order | Unlock the next zone |
| ⚔️ **Practice Quiz** | Untimed multiple-choice drilling | +10 XP / correct |
| 🃏 **Flashcards** | Anki-style spaced repetition (SM-2-lite), self-rated | Cards graduate as you master them |
| 👑 **Boss Battle** | Timed 60s section quiz — land **≥70%** to win | +100 XP · badge · next section |
| 💀 **Roguelike Gauntlet** | Endless cross-course rapid-fire, 3 lives, relics every 5 survived | High score & bragging rights |
| 🎰 **Confidence Bets** | Wager on your own answer | Double or nothing |

Plus **daily challenges** and three unlockable themes — ⚡ Cyber Neon · 🌌 Nebula · ☀️ Daylight.

## ⭐ Level up your stats

Every action feeds one progression system: **XP → levels → streaks → 🏅 badges.** Miss a day
and your streak drops — unless you've banked a freeze. It's study material with a scoreboard.

## ▶️ Run it locally

```bash
python3 -m http.server 8000 --directory arcade
open http://localhost:8000/
```

> A static server is required — browsers block `fetch()` from `file://`, so double-clicking
> `index.html` won't load the content. Always serve over `http://`.

> **Note:** the live game's `content.json` is not in this repo (see *Content* below), so a
> fresh clone serves the app shell without lessons. The repo is the app + tooling; the
> content is supplied separately at deploy time.

## 🏗️ Architecture

```
scrape → transform (LLM rewrite + judge) → generate → play
```

- **`scrape_trainercentral.py`** — Playwright login + JSON-API walk → markdown (source stays local).
- **`arcade/transform_content.py`** — LLM rewrite + independent judge → derivative content.
- **`arcade/generate_content.py`** — stdlib generator → `content.json` (deterministic; rule-based
  distractors: wrong answers are drawn from *other* lessons in the same course).
- **`arcade/{index.html,app.js,styles.css}`** — the vanilla-JS single-page game.

Deep-dive design notes, ADRs, and flow docs live in [`wiki/`](wiki/).

## 🚀 Deploy (CI/CD)

Deploys run in **GitHub Actions** → **Cloudflare Pages** ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)):

- **Code change** → `git push` → auto-deploys the app shell.
- **Content change** → `./deploy-content.sh` → regenerates and deploys content.

The deployable bundle is a clean `dist/` of just the static files + `content.json`.
Full runbook: **[arcade/DEPLOY.md](arcade/DEPLOY.md)**.

## 📦 Content

The course content this game was built from is **not** included in this repository. The
generated `content.json` and all intermediate content are kept private and are supplied to
the deploy pipeline separately. Only the application code, generator/scraper tooling, and
project wiki are public here.

## 📜 License

**All rights reserved.** This repository is published for viewing/reference; no license to
use, copy, modify, or redistribute the code is granted. (Intentionally omitting a `LICENSE`
file — adding one would grant rights this project does not intend to.)
