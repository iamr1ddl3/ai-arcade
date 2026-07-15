# Activity Log

Append-only. Newest entries at top. Never edit past entries.

---

## 2026-07-16 — brand logo integrated (header mark, favicon, OG image)

- User supplied `arcade/assets/logo.png` (1786×1420, isometric joystick + stacked "PIXEL / PLAYGROUND" wordmark, brand purple `#351780`). Wired it in three places per user's pick (header + favicon + OG).
- **Derived assets from the one source** (Pillow, in `.venv`): scanned content bands to locate the joystick (y 224–862) vs wordmark, cropped a centered 790×790 **`logo-mark.png`** (joystick only — the full square wordmark is illegible at header/favicon size). From the mark: `favicon-32.png`, `apple-touch-icon.png` (180), `favicon.ico` (16/32/48). From the full logo: `og-image.png` (1200×630, centered on brand purple).
- **Header:** replaced the `🎮 PixelPlayground` text link with `<img class="brand-mark">` (28px, 7px radius, 1px edge ring) + `PixelPlayground` text; `.brand` → inline-flex. **Favicon + apple-touch-icon + OG/Twitter meta** added to `<head>`; assets bumped `?v=11`. `_headers` caches `/assets/*` for a day.
- **CI fix (important):** the deploy job assembles a `dist/` by copying named files — it did **not** copy `assets/` or `favicon.ico`, so the logo would have shipped broken. Updated the assembly to copy `favicon.ico` + `assets/*.png`, added a `test -s dist/assets/logo-mark.png` guard (fails the deploy if the mark is missing), and added `arcade/assets/**` + `favicon.ico` to the `paths:` trigger.
- `.DS_Store` in assets/ confirmed gitignored (not committed); dropped the 512px preview crop (unreferenced). Verified all assets serve 200 with correct MIME types locally (browser preview tool was unavailable, so verified via curl + direct image inspection of the crop/OG).

## 2026-07-15 — app.js state-logic tests ([[debt/no-tests]] #3 done) + timezone bug found

- **`arcade/test_app.mjs`** (15 tests, `node:test`, no deps) closes the last no-tests remediation item. Runs the **real** `app.js` in a `vm` sandbox with stubbed browser globals (localStorage/document/window/fetch) and calls the actual functions — no copy, no refactor of the 1,532-line live file (it calls `boot()` at load, but that's `async` and starts with `await fetch(...)`, so the DOM stubs never get hit synchronously; `const`s like INTERVALS/QUEST_POOL don't attach to the vm context, so they're read via `runInContext("<name>")`). Covers `scheduleCard` SM-2 (again/hard/good/easy, box ceiling on **both** good+easy paths, ease floor, lapses, due dates), `bumpStreak` (first/same-day/consecutive/reset/freeze-bridge/milestone-once), XP floors (`awardXp`/`loseXp`), `questEvent` claim-once.
- **Sabotage-verified** three ways: removing the freeze decrement, the XP `Math.max(0,…)` floor, or either box-ceiling `Math.min` each turns the suite red. First ceiling sabotage *passed* — exposed that my test only drove the `easy` path; fixed the test to drive both paths, re-verified it now catches a good-path regression too.
- **Pre-existing bug found (not introduced):** on a non-UTC host, `app.js` `addDays()`/`daysBetween()` disagree — `addDays` builds *local* midnight but serializes *UTC* (`toISOString`). On IST (+5:30), `addDays(today,-1)` → `2026-07-13` and a true "1 day ago" is unreachable via addDays. Streak math across a day boundary can be off-by-one far from UTC. Recorded as [[debt/date-timezone-drift]] (severity low); tests derive seed dates from the app's own `daysBetween` reckoning to sidestep it, and a `KNOWN BUG` test pins current behavior so a fix is a visible change. Debt count 4→5 in [[index]].
- **CI:** `test` job gains a Node step (`setup-node@20` + `node --test arcade/test_app.mjs`); `test_app.mjs` added to `paths:`. [[debt/no-tests]] severity **medium→low** — all three pure/state layers now tested + gated; only browser-integration (routing/render/timers) remains, Playwright-if-needed. All three suites green locally.

## 2026-07-15 — backlog sweep: README, generator tests, transform tests (autonomous)

User said "go for next and complete all, don't wait for me" after the CI/CD landed. Worked the remaining backlog with judgment on each item:

- **#1 README + LICENSE (done):** Added top-level `README.md` as the public front page (product, live link, architecture, CI/CD) with an explicit **All rights reserved** section; deliberately **no `LICENSE` file** (user chose all-rights-reserved — adding one would grant rights). Fixed the stale `wrangler pages deploy ./arcade` command in `arcade/README.md` (the exact deploy trap).
- **#2 no-tests debt, remediation #1 + #2 (done):** `arcade/test_generate_content.py` (7 tests, stdlib `unittest` — chosen over pytest to honor the generator's stdlib-only rule) drives the generator via subprocess over a synthetic fixture and asserts MCQ/cloze invariants, flashcard presence, step order, unique IDs, determinism; **sabotage-verified** (breaking `answerIndex` turns it red). `arcade/test_transform_content.py` (19 tests, imports the module directly — SDKs lazy-load) locks `cache_key` stability, `parse_verdict` fail-closed tolerance, `passes` thresholds. **Wired into CI**: new `test` job, `deploy` gated by `needs: test` — a broken generator/judge can never reach Cloudflare. Verified green in real CI (run 29433652826: test → deploy).
- **#3 content-gap topics (NOT actioned — deliberately):** Completing this autonomously would mean either fabricating course content (new courses need real source material through the transform pipeline — none exists) or spending the user's GLM API budget on freshness re-transforms (irreversible cost, needs keys + raw source). "Don't wait for me" covers code decisions, not spending money or inventing curriculum. The one cheap win (model-ref sweep) was already done 2026-07-10. Left for a user go-ahead. Instead redirected the effort into no-tests remediation #2 (real, free, network-free hardening).
- **#4 vendor-blocked courses (NOT actionable):** blocked on the TrainerCentral API outage — nothing to build, retry when the vendor is back.
- Remaining after this sweep: `app.js` game-state tests (no-tests #3), content freshness/new courses (user-gated on API $), 2 blocked courses (vendor).

## 2026-07-15 — public repo + Cloudflare deploy + CI/CD pipeline

- **Published to GitHub** (`iamr1ddl3/ai-arcade`, public). Pre-publish safety verified: only 50 tracked files (app code, wiki, skills, hooks); `tc_scrape_output/`, `transformed/`, `arcade/data/`, `.env` all gitignored + confirmed absent from remote; secret scan = only false positives. Later removed `.claude/` from the repo (private workflow tooling — gitignored; still in history, no secrets so accepted).
- **Deployed to Cloudflare Pages** — live at `https://ai-arcade-13g.pages.dev` (free tier, $0; static site). Project name `ai-arcade`.
- **Deploy-bundle trap found + fixed:** `wrangler pages deploy ./arcade` uploads the *whole* folder incl. `.transform_cache.json` (3.9 MB derivative state) + Python scripts. `.assetsignore` does **NOT** apply to Pages deploys (Workers-Assets only) — removed it as dead weight. Fix = always deploy a clean `dist/` of just the 5 static files. Also chased a phantom "leak": `curl -o /dev/null` showed 200 on `/.transform_cache.json`, but that's Pages' SPA fallback serving `index.html` (1.8 KB) for any unknown path — verified by body/size, no actual exposure.
- **CI/CD built** (user chose full pipeline w/ private content repo over local `deploy.sh`): private repo `iamr1ddl3/ai-arcade-content` holds `content.json` only (derived content stays off the public repo but on GitHub — a deliberate relaxation of "content never leaves the machine", raw source + keys still local-only). `.github/workflows/deploy.yml` = on code push (or manual dispatch) → checkout public app shell → pull content.json from private repo via `CONTENT_REPO_TOKEN` → assemble clean `dist/` (fails fast if content empty) → `cloudflare/wrangler-action@v3` deploy. `deploy-content.sh` = local one-command content path (generate → push private → trigger). Secrets (user-set): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CONTENT_REPO_TOKEN`.
- **Pipeline green** (run 29432723716): all steps pass, uploads exactly the 5 static files, live site serves real 3.6 MB content. Token setup took several iterations (Not Found → Bad credentials → 200/404 repo-access → 200/200) — root cause was the fine-grained PAT's Repository access not including `ai-arcade-content`. **Security note:** user pasted a token value inline into a shell command once (exposed in history + chat); advised revoke + recreate, which was done.
- `DEPLOY.md` rewritten for the CI/CD flow (warns against `wrangler pages deploy ./arcade`). Still pending: 2 vendor-blocked courses, [[debt/no-tests]], content-gap topics from [[analyses/content-gap-ai-field-2026-07-07]].

## 2026-07-10 — model-reference freshness sweep (surgical, not catalog-wide)

- Actioned the "cheapest single win" from [[analyses/content-gap-ai-field-2026-07-07]]. On inspection the sweep is far smaller than the analysis implied ("touches nearly every course"): of ~46 model-name matches in `transformed/`, **most are legitimate and were deliberately kept** — `Mixtral` (7×, real MoE architecture example), `Llama-2-7b-hf` (runnable HF model ID in a QLoRA `bitsandbytesconfig`), `claude-3-5-sonnet-latest` (valid ID in a provider-switch code sample), `gpt-4.1-mini` (7×, already a 2025-era model), and two lesson **titles** that are *about migrating off* old models (`…distill-gpt-4-into-a-7b…`, `…migrate-from-gpt-4-turbo…`) — renaming would break the lesson's point and drift the filename/progress key.
- **Only 4 genuinely-dated illustrative prose refs edited** (baseline: GPT-5.5 / Claude Opus 4.8 / Gemini 3): `agentic-ai-patterns/…/06` "GPT-4 or Claude"→"GPT-5.5 or Claude Opus 4.8"; `scenerio-based-questions/…advanced-architectures…/01` "GPT-4o, Gemini"→"GPT-5.5, Gemini 3"; `…llm-prompting-cost-latency/04` determinism example `gpt-4`→`gpt-5.5`; `python-essentials/…/02` dict-literal `{"model":"gpt-4"}`→`gpt-5.5`.
- **Applied by hand-editing the `transformed/` .md files** (user-chosen over cache-evict + re-transform — trivial noun swaps a judge would pass, and GLM re-transform wouldn't deterministically produce these names anyway). These 4 lines are now **hand-tuned post-judge**: they no longer match the GLM rewrite the independent Claude judge signed off on, but the change is factual model-name modernization only, not a content rewrite. Cache untouched (a future re-transform of these lessons would silently revert them — acceptable, documented here).
- **Regenerated `content.json`** (`generate_content.py --root ../transformed`): 20 courses / 1022 playable / **0 quiz-invariant violations**. Browser-verified served JSON + console clean (0 errors).
- **Reach caveat (important):** the generator only extracts `answer`/`answerSource`/`flashcard`/`quiz`/`cloze` from each lesson — **not** the full body prose. Only 1 of the 4 edits (the determinism `gpt-5.5`, which sits in that lesson's answer body) actually surfaces in the app; the other 3 live in "how it works" prose the generator drops. They were corrected in `transformed/` anyway (derivative source of record + future-proof if field extraction widens), but user-visible impact = one line. The `analyses` page's "touches nearly every course" framing was over-stated; the real dated-prose surface is tiny.
- Untouched: 2 vendor-blocked courses, Cloudflare deploy (still user-gated), [[debt/no-tests]].

## 2026-07-06 — committed: arcade v1 + wiki (milestone arcade-v1)

- Committed the full week's work. Code commit `85f9817` — `arcade/` (transform pipeline, generator, SPA game, deploy runbook) + `.claude/launch.json` + `.gitignore`, 10 files / 3,170 insertions. Pre-commit checks: `.env`, `tc_scrape_output/`, `transformed/`, `arcade/data/`, transform cache all confirmed gitignored; `__pycache__` ignored; dry-run add showed only app code tracked.
- Wiki committed separately (this commit): all module/ADR/debt/judgment/flow/analysis pages plus the fresh audit fixes, so code and wiki land consistent with each other.
- Milestone appended: **arcade-v1** (`wiki/milestone/2026-07-06-arcade-v1`).
- Still pending: Cloudflare Pages deploy (user-gated), 2 vendor-blocked courses, [[debt/no-tests]] remediation.

## 2026-07-06 — audit (wiki-maintain)

- Ran `wiki-maintain` at audit depth after the week's heavy write batch. **Lint:** 2 broken `[[../CLAUDE.md]]` links — both historical quotes of the original backtest finding; fixed in [[analyses/backtest-initial-map-2026-07-03]] (de-linked to backticks), the one inside a past log entry is accepted as-is (log is append-only). 0 orphans. Post-fix lint: 0 broken.
- **Stale pages found + rewritten:** [[overview]] and [[architecture/system-map]] still described a "single-script scraper" project (2026-07-03 vintage) — rewritten for the 4-module pipeline + arcade reality; status maintenance→active; open questions refreshed (added localStorage→D1 migration question, incremental content drops).
- **Undocumented flow (biggest gap):** the core end-to-end path had no flow page. Created [[flows/content-pipeline]] (trigger, 5 steps, error paths incl. vendor-outage probe / network retry / judge-failure handling, measured performance). Registered in [[index]] (flows 0→1).
- **Stale facts fixed:** [[modules/arcade-app]] "~993 lessons" → 1022 with the two blocked courses named; [[modules/arcade-generator]] stub-skip figure clarified (applies to the RAW scrape root; the production `--root transformed` build reports 0 stubs).
- **Debt refresh:** [[debt/no-tests]] severity low→**medium** and scope expanded from the scraper to the whole pipeline + ~1,600-line game app (public deploy raises the stakes; remediation list prioritized: generator invariants pytest first).
- **Clean checks:** no circular module dependencies (scrape→transform→generator→app is acyclic); no stale/reversed ADRs (ADR-2's rule-based stance extends cleanly to cloze/steps; ADR-3 current); no data-model inconsistencies (content.json shape documented in the generator page; separate data-model page not warranted at this size); debt hot-spot = incomplete-scrapes (linked from all 4 modules — appropriately, it caps everything).
- All fixes applied in-session, none deferred.

## 2026-07-06 — theme switcher (Cyber Neon / Nebula / Daylight)

- Follow-up the user approved: a persisted theme switcher. Themes are pure token blocks — `:root` = Cyber Neon (default), `[data-theme="nebula"]` and `[data-theme="daylight"]` override the same ~30 variables. To make this clean, the last hardcoded accent/chrome references were converted to tokens (`--chrome` for topbar/tabbar, `--on-accent` for text-on-gradient, `--bg-glow-1/2` for the body radials) and accent tints now derive via `color-mix(in srgb, var(--accent) N%, transparent)` — so any future theme is JUST a variable block. Track backgrounds (progress/quest/HP bars, tags, dots) switched from white-rgba to ink-derived mixes so the light theme renders them correctly.
- **Daylight specifics:** light paper bg `#faf9f5`, white cards, violet accent, darkened semantic hues (gold `#b45309` so stars stay readable on light), no glow, softer shadows.
- **JS:** `THEMES` list + `applyTheme()` (sets/clears `data-theme`, updates the `theme-color` meta per theme) + `setTheme()` persisted as `progress.theme` (default "neon"); applied on boot; switcher = three buttons in Profile with active state; progress-reset returns the theme to default. Assets → `?v=10`.
- **Verified live:** all three switch instantly (computed body bg `rgb(13,13,20)` / `rgb(10,12,30)` / `rgb(250,249,245)` with dark ink on light); choice survives reload (Daylight world-map screenshot confirmed); meta theme-color follows; console clean. Left in the Cyber Neon default.

## 2026-07-06 — theme: Cyber Neon applied (user-selected from visual candidates)

- Researched 2026 UI theme trends, presented 6 candidates as visual mini-mockups of the actual arcade UI (Nebula/current, Zinc Pro, Cyber Neon, Sunset Coral, Emerald Scholar, Daylight light-mode). **User chose Cyber Neon** — the "controlled micro-glow" cyberpunk direction (deep black + electric mint + hot magenta).
- Because the makeover had fully tokenized the CSS, the swap was a palette-layer edit: `:root` tokens (bg `#0d0d14`, accent mint `#2ee6a8`, accent-2 cyan `#4dc3ff`, new `--hot` magenta `#ff4d9d`, `--glow`/`--glow-hot` micro-glow shadows), neonized zone hues, body radial tints, and every hardcoded rgba tied to the old violet (order-picked, tabbar-active, continue-card, boss phase-3 bar now magenta). Boss buttons = magenta gradient + hot glow; primary buttons = mint→cyan gradient with **dark text** `#06251a` (mint is bright — white text would fail contrast; verified computed `rgb(6,37,26)`). `theme-color` meta → `#0d0d14`. Assets → `?v=9`.
- Verified desktop + mobile screenshots (glowing continue card, neon mode buttons, magenta Gauntlet, zone accents, tab bar) and quiz correct-state (mint border). Console clean.
- Note for future: the other 5 candidate palettes are recorded in this entry's context; a theme *switcher* (multiple `:root` blocks + a toggle persisted like `muted`) was offered and remains an easy follow-up since everything is variable-driven.

## 2026-07-06 — UI makeover: modern design system + mobile app-style navigation

- User asked for a full UI modernization with real mobile support. Rewrote `styles.css` as one coherent design system (every pre-existing class preserved; assets → `?v=8`).
- **Design language:** deeper OLED-friendly palette (`#0a0c1e`), glass surfaces (backdrop-blur + 1px inner top highlight `--edge`), violet→cyan gradient accent (`--grad`) on primary buttons/XP bars/score numbers, radius 18, layered shadows, fluid type (`clamp()` on h1/q-text), `rise-in` entry animation on every screen (disabled under `prefers-reduced-motion`), sheen sweep on the continue card.
- **Per-zone accents:** each world-map zone sets `--zone-accent` (amber/violet/rose/green/sky) — card top borders + gradient rule after the zone title. `renderHome` adds `zone-<id>` classes.
- **Quiz polish:** A/B/C/D letter badges on options via pure CSS counters (zero JS), badges recolor on correct/wrong; options/steps/match items now ≥48px touch targets.
- **Mobile (the headline):** bottom tab bar (Map / Daily / Gauntlet / Profile) fixed with blur + `safe-area-inset-bottom`, replaces the top nav ≤640px; router toggles the active tab (non-tab screens highlight Map); toast + XP float repositioned above it; `viewport-fit=cover`, `theme-color`, apple web-app metas added to `index.html`.
- **Verified in-browser:** desktop world map (zone accents, gradient buttons, quest board) and mobile (375px: two-row header, full-width mode buttons, tab bar navigation works — tapping Profile navigates + activates; quiz shows letter badges; no horizontal overflow); console clean.
- [[modules/arcade-app]] covers the modes; this entry is the styling/nav system of record.

## 2026-07-06 — game-logic wave: Gauntlet, boss phases, confidence betting

- Third and final approved wave from the expert review. All app-layer, assets → `?v=7`.
- **💀 Roguelike Gauntlet** (`#/gauntlet`, dedicated engine): endless cross-course rapid-fire, 3 lives, relic choice every 5 survived (❤️ extra life / ✨ XP doubler / ⏭️ skip / 🔮 50-50 / 🛡️ shield), XP kept on death, relics lost, best-run persisted + on the home button, `gauntlet-10/25` badges. **Verified live:** 5 correct → relic offer (3 choices), 50/50 eliminated exactly 2 wrong options, 3 misses → run over "5 survived · +50 XP kept · 🏅 new best", best persisted.
- **👑 Boss phases**: pass bar reframed as boss HP (`ceil(n×0.7)` hits to win) — HP bar depletes per correct answer, boss face escalates 👹→😡→🔥 at thirds with phase toasts, "Finish him! →" ends the fight early at 0 HP. Same 70% semantics. **Verified live:** 9 HP for a 12-question boss, phase faces flipped exactly at 6 and 3 HP, early finish at 9/12 = 75% pass, unlock + freeze awarded. Found+fixed in self-review: Retry wasn't resetting HP (boss would start half-dead).
- **🎲 Confidence betting** (untimed practice): per-question Bet 2× toggle — win 2× base XP (stacks with combo), loss deducts base XP (`loseXp`, new) and reschedules the card as `again` so confidently-wrong concepts resurface first (calibration training). **Verified live:** win +20 exact, loss −10 exact + card → box 1 / due today / lastRating "again".
- Console clean throughout. [[modules/arcade-app]] updated. New progress field: `gauntletBest`. The arcade now has 8 modes; full mechanics stack: mixed question types, combos, quests, freezes, recall bonuses, stars, zones, sim, daily, gauntlet, phased bosses, betting.

## 2026-07-06 — UI/UX + retention layer (research-driven gamification wave)

- User approved the expert-review gaps (UI/UX + gamification; game-logic wave deferred). Research grounding: Duolingo case studies (streak-freeze cut churn 21%, +48% streak length) and the spaced-repetition × gamification literature (align the BIGGEST rewards with long-interval recall, 3-5×, not completion).
- **Retention mechanics shipped:** streak freezes (earn per boss, cap 3, auto-consume on a 1-day gap — verified live: seeded a missed day, streak 5→6, freeze 1→0); **recall-bonus XP** (due card at box≥2 rated good/easy pays box×5 — verified +17 XP for a box-3 recall and box advanced to 4); weekly quests (3/week, date-seeded from `QUEST_POOL`, counters via `questEvent()`, +50 XP auto-claim — verified counter 3/20 on the board after 3 correct answers); mastery stars (★ boss / ★★ all cards mastered / ★★★ flawless) on sections + course cards; weekly-XP counter in profile (league prep).
- **UI/UX shipped:** world map re-organized into 5 themed zones (Foundations Keep / LLM Highlands / RAG Valley / Agent Dojo / Production Peaks, Frontier fallback for future courses); "Continue where you left off" hero card; per-lesson mastery dots (grey/amber/green) on section rows; flashcard session summary ("x/y mastered · n due soon"); floating +XP indicator + CSS confetti (boss wins, level-ups, perfect dailies, staff-grade sims); **mobile fix** — topbar wrapped into two rows ≤520px (stats strip was collapsing into a 34px vertical column; now a full-width 31px row, no horizontal overflow, verified at 375px).
- One test-harness false alarm during verification: recall bonus initially looked broken, but `dueLessons` correctly sorts NEW cards before previously-seen due ones — the test had rated the wrong card. Re-tested with the target as the only due card → bonus exact.
- All verified in-browser (desktop + mobile), console clean. [[modules/arcade-app]] updated. Assets → `?v=6`. New progress fields: `freezes`, `lastActivity`, `quests`, `weeklyXp` (old saves merge cleanly via `Object.assign(defaultProgress(), …)`).
- Deferred (wave 3, needs Workers/D1): leagues/leaderboards, friend streaks. Deferred (game-logic wave): roguelike gauntlet, boss phases, confidence betting, adaptive difficulty, explain-then-reveal.

## 2026-07-06 — Interview Simulator, Daily Challenge, sound effects

- Second mechanics batch (user-approved follow-up to the trio). All app-layer — zero generator changes, zero new assets, ADR-2's zero-build rule preserved.
- **Interview Simulator** (`#/simulator`): 15 random mcq/cloze questions drawn across all 20 courses, one 120s timer, grade ladder Intern→Staff Engineer. Badges: `first-sim`, `sim-staff` (≥90%).
- **Daily Challenge** (`#/daily`): 10 questions via date-seeded PRNG (mulberry32 over a stable content pool) — identical set all day, verified deterministic across visits. +30 XP bonus once per local day; replay allowed with "already claimed" banner (verified no re-award). `daily-perfect` badge.
- **Sound effects**: Web Audio synthesized tones (correct/wrong/combo/win) — no audio files. Wired into quiz answers, boss wins, match results, level-ups, daily/sim completions. Persistent 🔊/🔇 toggle in the stats strip.
- **Engine change:** `runQuiz` gained optional `seconds`/`resultTitle`/`banner(c,t)` so both new modes reuse it; boss banner is the fallback — boss result screen regression-verified (title, 70% fail banner, back label). Home page gained a mode row (daily shows ✓ once claimed). Assets → `?v=5`.
- **Verified in-browser:** sim timer 120s + grade ladder + badge; daily determinism, one-time bonus (+70 XP incl. a combo, exact), replay guard, home ✓ state; mute toggles + persists (🔇 icon); console clean. Self-review: no blocking issues; banner-after-onFinish ordering (needed by daily's first-run flag) confirmed live.
- [[modules/arcade-app]] updated. The arcade now has 7 play modes: quiz (mixed mcq/cloze/order), match, flashcards, boss, simulator, daily, profile-tracked progression.

## 2026-07-06 — new game mechanics: cloze, order-the-steps, match-the-pairs, combo XP

- User wanted the text-only arcade to be more engaging; approved the trio: **cloze** (fill-in-the-blank), **order-the-steps**, **match-the-pairs**, plus **combo XP** juice. Built via implement-change (karpathy guidelines: rule-based, offline, no runtime LLM, surgical).
- **[[modules/arcade-generator]]:** new `extract_steps()` (3–5 numbered steps from "how it works" sections, stored in correct order — app shuffles at play time so content.json stays deterministic) and `cloze_term()`/`build_cloze()` (mask the most distinctive answer word, prefer title-overlap then longest, `CLOZE_STOPWORDS` filter; distractors = other lessons' cloze terms; same 4-option invariants as MCQ). Coverage on real content: **1021/1022 lessons get a cloze, 817 get steps; 0 invariant violations; output still byte-deterministic.**
- **[[modules/arcade-app]]:** Practice now mixes types via `buildMixedQuestions()` (one question per lesson, cycling mcq→cloze→order). **Boss battles stay pure MCQ** — 70% pass semantics untouched. New `#/match/:course/:section` mode (4 runtime-sampled lessons, tap-question-then-answer, +5 XP/pair, 🧩 button when a section has ≥4 distinct answers). Combo: 3+ consecutive correct = 2× XP with an animated 🔥 chip; resets on wrong and on retry. XP additions: order=15, matchPair=5. Asset cache-bust → `?v=4`.
- **Verified in-browser:** type rotation (mcq→cloze→order), order win path, combo math (+10, +10, 🔥x3 +30 for order, 🔥x4 +20 = 70 XP exactly), match 4/4 perfect and 2/4 partial credit, boss regression (timer + pure MCQ), flashcard flip/rate regression, console clean.
- **Code review (self, via code-review skill): APPROVE** after 2 in-loop fixes — combo now resets on quiz retry; Match's Reset disables after check (was leaving an inert board). All lesson-derived strings `esc()`'d per the app's XSS discipline.
- Not built (discussed, deferred): Interview Simulator mode, daily challenge, sounds — candidates for a next session.

## 2026-07-06 — full rollout: all 20 courses transformed + Claude-judged (1022 lessons)

- User directive: transform the remaining fully-scraped courses with **GLM-5.2 rewrite only, then judge with Claude — NOT GLM self-judge**. (2 courses still blocked by the [[debt/incomplete-scrapes-empty-lessons]] outage, correctly excluded.)
- **Code change:** added `--judge none` mode to [[modules/arcade-transform]] (`transform_one` accepts any non-stub rewrite, no inline judge) so GLM never scores its own output — the independent Claude pass is the sole gate. Also strengthened `REWRITE_SYSTEM`: rewrite CODE too (own identifiers/structure, but keep exact import names like PyPDF2, valid syntax/JSON), no invented facts, correctly-spelled title. (System-prompt edits don't change the cache key, so only re-run lessons pick them up.)
- **Transform:** 14 courses / **688 lessons** with `--judge none`, sequential background run, ~3.3 lessons/min, **0 errors** (the network-retry from the prior session held across the whole run).
- **Independent Claude judge pass:** all 688 lessons judged rewrite-vs-source via ~37 parallel sub-agent batches. **680 pass / 8 fail** first round (avg quality 8.92, defensibility 8.23). Failures categorized: 3 correctness (a fabricated cortisone/Merck/Basel chain; a `PyDF2` import typo; a broken JSON literal), 4 defensibility (verbatim CODE blocks — prose reworded but code copied), 1 quality (garbled title typo "be use used").
- **Re-transform failures:** evicted the 8 from cache (content-derived key → surgical), re-ran their courses (only the 8 made fresh API calls). Re-judged: **7 of 8 pass.** The 8th (`scenerio-based-questions/langchain/02-scenario-2-incorrect-tool-selection`) is inherently tool-definition JSON/code with little room to vary — failed defensibility on 2 re-transforms (renamed vars only). **Excluded** it (removed transformed file + evicted cache; section still has 9 lessons) rather than ship near-verbatim source code publicly — the pipeline's exclude-and-log path.
- **Final:** `content.json` regenerated → **20 courses, 1022 playable lessons, 0 quiz-invariant violations, 0 bad titles.** Browser-verified: full world map renders "20 courses · 1022 playable lessons", all titles acronym-correct, quiz playable on new courses, console clean.
- **Net across the whole project:** every one of the 1022 published lessons has passed an independent Claude judge (advanced-rag + first-5 in prior sessions, these 14 now). 1 lesson excluded for un-fixable code-defensibility. GLM-5.2 was rewrite-only throughout this batch — no self-judging.
- Remaining: 2 scrape-blocked courses (vendor outage), the pre-existing #09/#10 near-duplicate in llm-evaluation, and the final Cloudflare Pages deploy (awaiting user go-ahead). The arcade generator/frontend needed zero changes to scale 1→20 courses, per [[decisions/adr-3-transform-then-publish]].

## 2026-07-05 — scrape recovery probe (still down, vendor-side)

- Before starting more transform batches, user asked to check for pending scrape work and complete it first. Confirmed **144 empty-body lessons across 9 courses** still pending (unchanged from debt page): `autogen-essentials` 0%, `statistics-math-for-aiml-interviews` 0%, `langchain-mastery` 42%, + 6 smaller.
- Ran a **read-only** live probe (login + raw HTTP status, no writes). Auth works (userInfos 200) but **all authenticated course-content fetches return 500 `ST_01 GENERAL_FAILURE`** — including `advanced-rag`, a course we already have, proving it's a general vendor outage not course-specific. Third consecutive failure (07-03/07-04/07-05).
- Gotcha recorded: the `get_json()` wrapper returns `None` without raising on the 500, so a "did it throw?" check falsely reads as recovered — must inspect raw status code. Documented in [[debt/incomplete-scrapes-empty-lessons]].
- Decision: **do not re-scrape** (endpoint down, would risk local data for nothing). Proceed transforming the 12 fully-scraped courses; re-probe (zero-risk) before any future scrape attempt.

## 2026-07-05 — fixed the 1 mislabeled lesson

- Fixed `llm-evaluation/…/09-when-is-self-evaluation-useful…`: hand-corrected the SOURCE title (`tc_scrape_output/`, confirmed NOT under immutable `raw/`) from "When is self-evaluation useful…" to "Why should AI evaluation be treated as a system rather than a single metric?" to match the body. Re-transformed the course: **1 fresh API call, 49 cache-hits** (content-derived cache key auto-missed only the edited lesson). Independently re-judged by Claude → **pass, quality 9, defensibility 9, title matches body** (was a quality fail). Regenerated `content.json`: 6 courses / 335 lessons / 0 invariant violations.
- Fixing the title surfaced a **pre-existing near-duplicate**: lesson #09 now overlaps #10 (`…rather-than-just-a-model`) — both teach "evaluation as a system." Source redundancy, not caused by the fix (#09 was mislabeled so the overlap was hidden). Low severity, flagged in [[debt/incomplete-scrapes-empty-lessons]], not actioned.

## 2026-07-05 — full independent (Claude) judge pass over the 5 new courses

- Gap correction: the prior scale-up judged the 5 new courses only via GLM-self-judge (the pipeline gate) plus a 10-lesson Claude spot-check — NOT the full independent Claude pass that advanced-rag got. User expected the advanced-rag treatment (whole-course independent cross-model judge). Ran it now.
- **Judged all 297 lessons** in the 5 new courses with Claude sub-agents (16 parallel batches), each reading rewrite-vs-source against the [[judgment/lesson-transform-quality]] rubric. Result: **296 pass / 1 fail, 0 correctness failures.** Avg quality 8.95, avg defensibility 8.43. (Consolidated from raw per-batch JSON, not verbal summaries.)
- **The 1 fail is a source defect, not a transform defect:** `llm-evaluation/…/09-when-is-self-evaluation-useful…` — the scraped SOURCE lesson's title asks about self-evaluation but its body answers "why treat AI evaluation as a system." The GLM rewrite faithfully mirrored the mislabeled source (correctness pass, quality fails title/body coherence). Re-transforming can't fix it. Filed as a new sub-class of scrape defect in [[debt/incomplete-scrapes-empty-lessons]]; options = exclude that 1 lesson or hand-fix the source title. Low impact (1/335).
- Net: across all 6 courses, advanced-rag (38, v2) + these 5 (297) have now had a full independent Claude judge pass; only defects found were the 2 in advanced-rag (already re-transformed) and this 1 source-mislabel. Content is clean for deploy modulo that single lesson decision.
- Also noted the mild "order-echo" pattern again (defensibility 7 on some list-heavy lessons) but all ≥ threshold; no action taken.

## 2026-07-05 — scaled transform to 5 more courses (6 total, 335 lessons)

- User: transform 5 more courses the same way as advanced-rag. Picked 5 fully-scraped courses (confirmed via completeness count, avoiding the known-incomplete ones in [[debt/incomplete-scrapes-empty-lessons]]): `rag-systems` (65), `machine-learning-foundations` (70), `tranformer-architecture-qa` (60), `fine-tuning-for-llms` (52), `llm-evaluation` (50). Estimated ~$2.16 total, user approved the set.
- Ran all 5 sequentially (GLM-5.2 rewrite + GLM judge). Result: **297/297 accepted, 0 excluded.** Combined with advanced-rag: **6 courses, 335 playable lessons, 0 quiz-invariant violations.**
- **Robustness bug found + fixed:** `machine-learning-foundations` crashed mid-run on a transient `openai.APIConnectionError` — the script had NO network-level retry (its `MAX_RETRIES` only covers quality rejections), so one blip lost 9 of 70 lessons and killed the process. The other 4 courses survived only by luck. Fix: added `_with_network_retry()` (4 attempts, linear 5/10/15/20s backoff, matches on Connection/Timeout/RateLimit/APIStatus/InternalServer error-type names) wrapping both `glm_complete()` and `sonnet_judge_json()`. The transform **cache made recovery free** — re-running skipped the 61 done and only transformed the missing 9. Deterministic content unaffected (transport-only retry). See [[modules/arcade-transform]].
- **Independent judge spot-check** (2 lessons × 5 courses = 10, via sub-agents, rewrite-vs-source): **all 10 pass** (quality 8–9, defensibility 7–9, 0 correctness fails). Judges flagged an "order-echo" pattern on list-heavy lessons (same item ordering as source but reworded prose + new analogies) — real but ≥7 threshold. No verbatim sentences or factual errors in the sample.
- **Polish:** extended `titleize()` ACRONYMS map (LLMs, QA, LLMOps, CrewAI, FastAPI, LangChain, LangGraph) + `DISPLAY_FIXES` to correct the source-dir typo "tranformer"→"Transformer" for display only. Bumped asset cache-bust to `?v=3`. Verified all 6 titles render correctly in-browser ("Fine Tuning For LLMs", "Transformer Architecture QA"), quiz playable on new courses, console clean.
- Content grows automatically as more courses are transformed — generator/frontend unchanged, per [[decisions/adr-3-transform-then-publish]].

## 2026-07-05 — local polish pass (verified in-browser, pre-deploy)

- User directive: polish/clean the content and make sure everything runs **smoothly locally** before deployment (deploy stays as the last step). Ran the arcade locally (`python3 -m http.server`, added `.claude/launch.json` for the `arcade` server) and drove it in a real browser.
- **Verified working end-to-end:** world map renders "Advanced RAG · 1 course · 38 playable lessons"; quiz renders 4 options and highlights the correct one green on click; boss battle runs, scores, and correctly gates at the 70% threshold (fail path shows "Need 70% to win"); console clean (0 errors); `content.json` = 38/38 playable, 0 quiz-invariant violations; generator output deterministic (only `generatedAt` timestamp differs between runs, content byte-identical).
- **Polish fixes (all in [[modules/arcade-generator]] / [[modules/arcade-app]]):**
  - Acronym-aware `titleize()` in `generate_content.py` replaces `str.title()` — fixes "Advanced Rag"→"Advanced RAG", "Rag Concepts…"→"RAG Concepts…", CRAG/LLM/etc. preserved via an `ACRONYMS` map.
  - `plural()` helper in `app.js` fixes "1 courses"→"1 course" (and lessons).
  - **Cache-busting:** `index.html` now loads `styles.css?v=2` and `app.js?v=2`. Surfaced during verification — Python's static server let the browser serve a stale `app.js` after edits; without versioned assets, returning users would keep running old JS after any deploy. `content.json` was already `cache: no-store`.
- No content re-transform needed — the v2 rewrites were already clean; this pass was UI/generator polish only.

## 2026-07-05 — independent re-judge + full v2 re-transform (advanced-rag)

- After the pilot, ran an **independent LLM-as-judge cross-check** (4 parallel sub-agents, each rewrite vs. its source) instead of trusting GLM's self-scores. Result: 36/38 pass, but **2 real defects GLM had passed** — self-preference bias confirmed:
  - `rag-concepts-architectures/12` (KG vs RAG): interview answer near-verbatim echoed the source closer → defensibility below threshold.
  - `system-design-scaling/11` (long-context vs RAG): **correctness fail** — "data volatility" paragraph inverted the source (claimed daily-changing data favors long-context; source says dynamic data favors RAG) and contradicted its own closing rule.
- User asked to **re-run all**. Bumped `PROMPT_VERSION` v1→v2 to invalidate the whole cache, re-ran the full 38-lesson transform (all fresh rewrites + GLM judge, 38/38 accepted, 0 excluded). Regenerated `content.json`: 38/38 playable, 0 quiz-invariant violations.
- **Re-judged the two previously-failing lessons independently — both now PASS.** Lesson 12's echo is reworded ("better suited"→"better choice" + qualifying clause, plus original subway-map analogy); lesson 11's data-volatility claim now correctly places frequently-changing data under "Favoring RAG," consistent with the source and its own closing rule.
- Takeaway recorded for the rollout: GLM-judging-GLM misses defensibility echoes and subtle inversions; a second-model or independent judge pass is worth keeping in the loop before public deploy.

## 2026-07-05 — pilot transform ran for real (advanced-rag, GLM-5.2)

- User provided a z.ai pay-as-you-go `GLM_API_KEY` (chosen over the Coding Plan subscription after a pricing comparison — plan endpoint is coding-tools-only, not a general API key; PAYG ~$0.37 pilot / ~$10 full rollout at GLM-5.2 rates).
- Bumped [[modules/arcade-transform]] to `glm-5.2` (was `glm-4.6`) and raised `EST_GLM_PER_1M` to 2.50 to keep `--estimate-only` honest.
- **Bug found+fixed:** `transform_content.py` docstring promised `.env` support but never loaded it — only read `os.environ`, so the first real run died with "GLM_API_KEY not set". Added stdlib `load_dotenv()` (project-root `.env`, `setdefault` so real env wins), wired into `main()`.
- **Pilot result:** 38/38 `advanced-rag` lessons rewritten and judge-accepted (GLM judge), 0 excluded, 38 API calls, est ~$0.37. Spot check confirmed genuinely derivative output (fresh analogy/table/structure vs source) with the required H1/Definition/How-it-works/interview-answer shape.
- Ran `generate_content.py --root transformed` unmodified → `arcade/data/content.json`: 38/38 playable, 1 course, 0 quiz-invariant violations — confirms ADR-3's zero-generator-change claim on real (not mock) transformed output.
- Next: local playtest, then deploy pilot to Cloudflare Pages per `arcade/DEPLOY.md` (awaiting user go-ahead — public deploy).

- End of the arcade build session. Recap of what shipped today: [[modules/arcade-app]] + [[modules/arcade-generator]] (the gamified learning game, 993 playable lessons / 20 courses, [[decisions/adr-2-zero-build-vanilla-js-rule-based-distractors]]), then the publish pipeline [[modules/arcade-transform]] ([[decisions/adr-3-transform-then-publish]], [[judgment/lesson-transform-quality]]) — all self-tested without API keys.
- Created a Linear project for aidemy-arcade under the personal team to track this work: issues filed for what's DONE (game build, generator, transform pipeline, wiki) and what's PENDING (run the pilot transform once a GLM key is provided, generate + local playtest, deploy to Cloudflare Pages, then scale to all courses + future accounts/leaderboards on Workers/D1).
- Next working session: run the pilot end-to-end once `GLM_API_KEY` is in `.env`, review rewrite quality, deploy the pilot course, then plan the full rollout.

## 2026-07-04 — built transform pipeline (publish derivative content online)

- User wants the arcade online but the course content is purchased ("never publish"). Planned in plan mode, approved, then built the transform → generate → deploy pipeline that publishes *derivative* material instead. Followed the `claude-api` skill for judge model IDs (Sonnet = `claude-sonnet-5`, strict JSON via `output_config.format`; GLM = `glm-4.6` via `openai` SDK at `https://api.z.ai/api/paas/v4`).
- New files (committed): `arcade/transform_content.py` (GLM substantial-rewrite + pluggable `--judge sonnet|glm`, cache, cost guard `--estimate-only`/`--max-lessons`/`--dry-run`, exclude-and-log), `arcade/_headers` (Cloudflare cache/security), `arcade/DEPLOY.md` (runbook). Updated `arcade/README.md` and `.gitignore` (`transformed/`, `.transform_cache.json`). SDKs imported lazily so estimate/dry-run/tests run without them.
- **Verified WITHOUT API keys:** (a) `--estimate-only` finds all 38 `advanced-rag` lessons, projects ~149k tokens/~$0.09 (GLM); (b) cache key deterministic + text-sensitive; verdict parser tolerant of fences, safe-fails on junk; (c) **integration proof** — a mock `transformed/` tree in the GLM output shape flows through the UNMODIFIED `generate_content.py --root` to a valid `content.json` (5/5 playable, quiz invariants clean), confirming the plan's "zero generator/frontend changes" claim; (d) filenames preserved → lesson IDs stable → user progress survives re-transforms; (e) privacy: `transformed/`, cache, `content.json`, `.env` all `git check-ignore` IGNORED; only app code + wiki are tracked.
- **User decisions locked in during planning:** substantial rewrite · exclude-and-log failures · cost estimate + cap · judge chosen at run time · pilot = `advanced-rag` (~38 lessons) · host = Cloudflare Pages (→ Workers/D1 later for accounts/leaderboards). Honest copyright caveat recorded: rewriting reduces but doesn't eliminate risk; judge is a quality tool, not legal clearance.
- Wiki: created [[modules/arcade-transform]], [[decisions/adr-3-transform-then-publish]], [[judgment/lesson-transform-quality]] (new `judgment/` page-type); registered in [[index]] (bumped counts); cross-linked [[modules/arcade-generator]] / [[modules/arcade-app]] / [[debt/incomplete-scrapes-empty-lessons]].
- **Not yet run for real** — awaiting the user's `GLM_API_KEY` (and `ANTHROPIC_API_KEY` if `--judge sonnet`) to transform the pilot course and deploy.

## 2026-07-04 — built AIdemy Arcade (gamified learning app)

- User asked to gamify the scraped course content. Built `arcade/` — a zero-build vanilla HTML/CSS/JS single-page game generated from `tc_scrape_output/`. Mechanics: MCQ quizzes, flashcards + spaced repetition (SM-2-lite), XP/levels/streaks/badges, and timed boss battles that gate section-by-section unlock progression. Persistence via browser `localStorage` (`aidemy-arcade:v1`), no backend.
- New files (committed): `arcade/generate_content.py` (stdlib-only generator), `arcade/index.html`, `arcade/app.js`, `arcade/styles.css`, `arcade/README.md`. Gitignored `arcade/data/` (the generated `content.json` derives from gitignored scraped content — never published).
- **Question generation:** rule-based, offline, deterministic (seeded RNG `1337`). Correct answer = lesson's interview-ready answer / definition (ordered fallback chain); 3 distractors = other lessons' answers from the **same course**. `extract_answer()` and `build_distractors()` isolated as an LLM-extension seam behind a future `--llm` flag.
- **Content scope decision (with user):** lenient stub rule — keep any lesson with ≥5 non-blank lines + an extractable answer (both `##` and `###` section styles count). Measured: 1192 total → **993 playable across 20 courses**, ~199 empty stubs skipped. Two courses (`autogen-essentials`, `statistics-math-for-aiml-interviews`) come out 0% and drop off the map — consistent with [[debt/incomplete-scrapes-empty-lessons]]. Content grows automatically when the scrape completes and the generator re-runs.
- **Verified end-to-end via Playwright:** world map renders 20 courses; boss battle win path → 15/15, +100 XP, next section unlocked, 3 badges awarded; fail path (<70%) correctly does NOT unlock; quiz feedback (+10 XP correct); flashcard "Again" resurfaces same session + "Good" pushes dueDate +3 days. JSON invariants (4 options, valid answerIndex, correct==answer, no dup options) 0 violations; generator output byte-identical across runs.
- Wiki: created [[modules/arcade-app]], [[modules/arcade-generator]], [[decisions/adr-2-zero-build-vanilla-js-rule-based-distractors]]; registered in [[index]] (bumped module/ADR counts); cross-linked [[debt/incomplete-scrapes-empty-lessons]] to both new modules. `.gitignore` updated with `arcade/data/`.

## 2026-07-04 — retry attempt (blocked, no data loss)

- User approved re-scrape of the 9 incomplete courses, with an explicit requirement to back up existing data first.
- Backed up `tc_scrape_output/` (9.7M, 22 courses) to `tc_scrape_output.bak.20260704/` before any deletion; added `tc_scrape_output.bak.*/` to `.gitignore` (never publish scraped content, including backups).
- Deleted the 9 incomplete course folders identified in [[debt/incomplete-scrapes-empty-lessons]], re-ran `scrape_trainercentral.py 23022000000014019`.
- Result: the authenticated bundle-level fetch failed entirely this time — `courses.json`, `getBundleCourses.json` (v4), and the legacy fallback all 500'd, worse than the single-course failure seen 2026-07-03. Anonymous access to the same bundle endpoint still returns 200, confirming an authenticated-session-specific vendor outage, not a credentials or script problem.
- Restored the 9 deleted folders from the backup; `diff -rq` against backup shows zero differences — confirmed no data loss, state identical to before the attempt.
- Updated [[debt/incomplete-scrapes-empty-lessons]] with the retry attempt and outcome. Recommend waiting before the next retry — endpoint has now failed on two separate occasions.

## 2026-07-04 — scrape completeness check

- User asked whether scraping worked for all pending courses. Rebuilt `.venv` (previous one was a stale Windows venv — `Scripts/*.exe`, unusable on macOS); installed playwright/beautifulsoup4/html2text + `playwright install chromium`.
- Confirmed bundle `23022000000014019` has exactly 22 courses (live API), matching all 22 local folders — no course is entirely un-attempted.
- Counted real per-lesson `.md` files (not `_combined.md` header counts, which double-count nested markdown headers inside lesson bodies) and checked for empty body content per lesson.
- Result: 144/1192 lessons (12.1%) across 9 of 22 courses have a title but empty body. `autogen-essentials` and `statistics-math-for-aiml-interviews` are **0% complete** despite having a `_combined.md` (so the idempotency skip-check treats them as done). `langchain-mastery` is 42% complete.
- Reproduced root cause live: authenticated `courses.json?uniqueKey=autogen` consistently 500s (`ST_94 INVALID_COURSE`, 5/5 retries) even though login itself still works and the course resolves fine anonymously at the structural level (description empty when anonymous, as expected).
- Filed [[debt/incomplete-scrapes-empty-lessons]] with full per-course completeness table and root cause.
- Recommended: delete + retry the affected course folders; `autogen-essentials` may still fail until the vendor endpoint recovers (outside script's control).

## 2026-07-03 — backtest

- Ran `wiki-maintain` at backtest depth (4 passes) on the post-map wiki.
- Pass 1 (lint): 1 broken wikilink found (`overview.md` → `[[../CLAUDE.md]]`, pointed outside the wiki tree) — fixed. No orphans, no contradictions.
- Pass 2 (accuracy): 12/12 factual claims verified against source — 100%.
- Pass 3 (coverage): 2 minor undocumented behaviors found in `login()`'s ambiguous-URL double-check and the empty-lesson hint — added to [[modules/scrape_trainercentral]]. No unfiled debt or hidden decisions.
- Pass 4 (Q&A probe): 5/5 representative questions answered correctly from wiki alone — 100%.
- Scorecard filed at [[analyses/backtest-initial-map-2026-07-03]]: 100% structural / 100% accuracy / 100% coverage / 100% Q&A fidelity.
- All findings fixed same session, none deferred.

## 2026-07-03 — map

- Ran `wiki-map` cold-start on the codebase: single-file scraper (`scrape_trainercentral.py`, 263 lines).
- Wrote: [[architecture/system-map]], [[modules/scrape_trainercentral]], [[decisions/adr-1-playwright-over-requests]], [[debt/plaintext-credentials-in-env]], [[debt/no-tests]], [[debt/undocumented-api-dependency]], [[overview]].
- Domain set to `tooling` in CLAUDE.md — personal utility, not portfolio/showcase material.
- Confirmed `.env` and `tc_scrape_output/` gitignored before any commit.
- 5 open questions logged in [[overview]] (credential handling, API-breakage detection, re-scrape-on-update, output format, deeper content-type support).
- Next: run `wiki-maintain` at backtest depth to validate before this wiki becomes load-bearing.

## 2026-07-03 — wiki initialized

- Bootstrapped via `init-wiki-skeleton`.
- Project: aidemy-bundle.
- Next: run "map this codebase" in Claude Code.

## 2026-07-07 — content gap & freshness research

- User asked which current AI topics to add and whether existing content is still up to date (incl. MCP/protocols).
- Ran 6 web searches (in-demand skills, MCP/A2A, context engineering, evals/observability, reasoning+SLM/edge, agent security) vs. the 20-course catalog.
- Findings: 5 missing table-stakes topics (MCP & A2A, Context Engineering, Agent Security/Red-Teaming, SLMs & Edge AI, Reasoning/Test-Time Compute); 6 existing courses need freshness pass (RAG→hybrid, prompt→context framing, eval→Agent-as-Judge, llmops→OTel, agentic→MCP cross-ref, model-name sweep to GPT-5.5/Opus 4.8/Gemini 3).
- Recommendation: do freshness-pass (B) before new courses (A); model-reference sweep is cheapest single win.
- Filed [[analyses/content-gap-ai-field-2026-07-07]]. User elected research-brief-only — no drafting/audit this session.
- Next: on request, either regenerate stale courses via transform pipeline or draft new-course source material for gaps 1–3.
