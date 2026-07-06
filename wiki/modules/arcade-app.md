---
title: Arcade App
type: module
tags: [frontend]
language: javascript
entry_point: arcade/index.html
sources: []
updated: 2026-07-06
---

# Arcade App

A zero-build, vanilla HTML/CSS/JS single-page game that turns the AIdemy course content into
an interactive learning arcade: mixed-type quizzes (MCQ / fill-in-the-blank cloze /
order-the-steps), a match-the-pairs mode, flashcards with spaced repetition,
XP/levels/streaks/badges with a combo multiplier, and timed boss battles that gate
section-by-section progression. It loads the JSON emitted by [[modules/arcade-generator]] and
persists all progress in browser `localStorage`.

## Responsibility

Owns: the SPA UI and all game logic — hash routing, the world map, quiz/boss engine, flashcard
review + SM-2-lite scheduling, XP/level/streak/badge rules, unlock progression, and
`localStorage` persistence (key `aidemy-arcade:v1`).

Does NOT own: content generation or parsing (that's [[modules/arcade-generator]]) and has no
backend — there is no server-side state, no account, no network calls beyond fetching the
static `content.json`.

## Public Interface

- `arcade/index.html` — SPA shell (top bar, `#app` mount, mobile bottom tab bar
  Map/Daily/Gauntlet/Profile shown ≤640px with the router toggling the active tab,
  load-error fallback; `theme-color`/apple web-app metas for app-like mobile rendering).
- `arcade/app.js` — hash router (`#/home`, `#/course/:id`, `#/quiz/:c/:s`, `#/match/:c/:s`,
  `#/flashcards/:c/:s`, `#/boss/:c/:s`, `#/profile`) + screen renderers + game helpers
  (`awardXp`, `bumpStreak`, `scheduleCard`, `beatBoss`, `getProgress`/`saveProgress`).
- **Question types (2026-07-06):** Practice mixes types via `buildMixedQuestions()` — one
  question per lesson, cycling mcq → cloze → order across the lesson's available variants.
  Order-the-steps is tap-in-sequence (shuffled at play time from `lesson.steps`, which is stored
  in correct order). **Boss battles stay pure MCQ** so the 70% pass semantics are unchanged.
- **Match-the-pairs** (`renderMatch`): 4 runtime-sampled distinct lessons per round,
  tap-question-then-answer pairing, +5 XP per correct pair; course page shows 🧩 Match when a
  section has ≥4 distinct answers.
- **Combo:** 3+ consecutive correct answers in a quiz run = 2× XP for that question (🔥 chip in
  the header, reset on wrong answer and on retry).
- **Interview Simulator** (`#/simulator`, 2026-07-06): 15 random mcq/cloze questions across ALL
  courses (`rapidFirePool()` — order questions excluded as too slow for rapid-fire), 120s total
  timer, grade ladder Intern→Staff Engineer (`SIM_GRADES`), `first-sim`/`sim-staff` badges.
- **Daily Challenge** (`#/daily`, 2026-07-06): 10 questions picked by a date-seeded PRNG
  (`mulberry32(hashStr("daily:"+date))` over the stable pool) — same set all day. +30 XP bonus
  once per local day (guarded by `progress.daily.date`); replays allowed, no re-award;
  `daily-perfect` badge on 10/10 first run. Home shows both modes; daily gets a ✓ when claimed.
- **Sound effects** (2026-07-06): synthesized Web Audio tones (`sfx()` — correct/wrong/combo/win,
  no asset files, zero-build preserved) wired into answers, boss wins, match results, level-ups,
  daily/sim milestones. 🔊/🔇 toggle in the stats strip, persisted as `progress.muted`;
  gesture-created AudioContext, try/caught so blocked audio degrades silently.
- `runQuiz` accepts optional `seconds`, `resultTitle`, `banner(correct,total)` so simulator/daily
  reuse the engine; boss pass/fail banner is the fallback when `banner` is absent.
- **Retention layer (2026-07-06, research-driven):**
  - **Streak freezes** — earned per boss (cap `MAX_FREEZES=3`), auto-consumed in `bumpStreak()`
    when exactly one day was missed; toast on earn/use; shown in profile.
  - **Recall-bonus XP** — the forgetting-curve alignment: rating good/easy on a card that was
    DUE at box≥2 pays `box*5` bonus XP (box 5 = +25 vs base 2), computed from the card state
    BEFORE `scheduleCard` reschedules it. This makes long-interval recall the top per-action
    reward in the game, per the spaced-repetition × gamification research.
  - **Weekly quests** — 3 picked per week from `QUEST_POOL` via the date-seeded PRNG
    (`weekKey()` = Monday); counters accumulate through `questEvent()` calls sprinkled at
    quiz/boss/match/daily/sim/recall sites; completion auto-awards `QUEST_XP=50` once.
  - **Mastery stars** — per section: ★ boss beaten · ★★ every card box≥`MASTERED_BOX`(3) ·
    ★★★ flawless badge; course cards show `★ n/max`; drives return visits to "done" sections.
  - **Weekly XP counter** — `progress.weeklyXp` (prep for future leagues on Workers/D1).
- **Game-logic wave (2026-07-06):**
  - **Roguelike Gauntlet** (`#/gauntlet`, `renderGauntlet` — its own engine, not `runQuiz`):
    endless cross-course run, `GAUNTLET_LIVES=3`, wrong answer −1 life (or consumes a 🛡️
    shield), relic choice every `GAUNTLET_RELIC_EVERY=5` survived (`RELICS`: extra life /
    XP doubler / skip token / 50-50 charm / shield). Run ends at 0 lives — XP earned is kept,
    relics are lost (roguelite loop). `progress.gauntletBest` + `gauntlet-10/25` badges;
    best shown on the home mode button.
  - **Boss phases** — the 70% pass bar is reframed as **boss HP** (`bossHp =
    ceil(questions × BOSS_PASS)` passed into `runQuiz`): each correct answer deals 1 damage,
    visible HP bar + boss face escalate 👹→😡→🔥 at HP thirds with phase toasts; at 0 HP the
    next button becomes "Finish him! →" and the fight ends early (pass ratio already secured).
    Pass semantics unchanged; retry resets HP.
  - **Confidence betting** (untimed practice only) — per-question 🎲 Bet 2× toggle: win pays
    2× base XP (stacks with combo → up to 4×), loss deducts the base (`loseXp`, floor 0) AND
    reschedules the lesson's card as `again` (confidently-wrong = weakest knowledge, resurfaces
    first). Trains calibration; `buildMixedQuestions` carries `lessonId` for this.
- **UI/UX layer (2026-07-06):** world map grouped into themed `ZONES` (Foundations Keep /
  LLM Highlands / RAG Valley / Agent Dojo / Production Peaks; unlisted courses → Frontier);
  "Continue where you left off" hero card (`progress.lastActivity`, saved by the four
  course-activity renderers); per-lesson mastery dots on section rows (grey/amber/green from
  card box state); flashcard finish shows a session summary (mastered count + due-soon);
  floating `+N ✨` XP indicator and CSS confetti on boss wins / level-ups / perfect dailies;
  mobile pass (topbar wraps, stats strip becomes a full-width compact row ≤520px).
- `arcade/styles.css` — theming/layout. No framework, no bundler.
- Run: `python3 -m http.server 8000 --directory arcade` (a static server is required — `fetch()`
  is blocked under `file://`).

## Dependencies

- [[modules/arcade-generator]] — produces `arcade/data/content.json`, the app's only data source.

## Dependents

- None (top of the stack; user-facing).

## Data Flow

On boot, `fetch('data/content.json')` → in-memory course/section/lesson maps. User actions
(answering questions, rating flashcards, beating bosses) mutate a single `localStorage` object:
`{ xp, level, streak, badges, unlocked, bossBeaten, cards }`. Cards hold SM-2-lite scheduling
state (`box`, `ease`, `dueDate`, `reps`, `lapses`). Sections unlock when the previous section's
boss is beaten (≥70% on a timed quiz).

## Key Decisions

- Vanilla zero-build SPA + rule-based content, no framework/npm — see
  [[decisions/adr-2-zero-build-vanilla-js-rule-based-distractors]].
- For public deploy, the `content.json` it loads is built from *derivative* content produced by
  [[modules/arcade-transform]] — see [[decisions/adr-3-transform-then-publish]]. The app is
  unchanged either way; it just loads whatever `content.json` is shipped.
- Untrusted lesson text is always escaped (`esc()`) before HTML interpolation; the flashcard
  flipped-face is built with DOM nodes to avoid injecting raw content.

## Known Issues / Debt

- [[debt/incomplete-scrapes-empty-lessons]] — the playable scope (currently 1022 lessons /
  20 courses from the transformed tree) is capped by the incomplete scrape; two courses
  (`autogen-essentials`, `statistics-math-for-aiml-interviews`) don't appear until the vendor
  API recovers.
- No automated tests ([[debt/no-tests]]); verified manually via Playwright (world map, boss
  win/fail/unlock, quiz feedback, flashcard spaced-repetition).

## Related

- [[modules/arcade-generator]]
- [[decisions/adr-2-zero-build-vanilla-js-rule-based-distractors]]
