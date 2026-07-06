/* AIdemy Arcade — vanilla SPA game logic.
 * Loads data/content.json, drives a hash-router SPA, persists progress in localStorage.
 *
 * XSS note: lesson text comes from scraped markdown (semi-trusted). Every dynamic value
 * interpolated into an innerHTML template MUST pass through esc() (escapes & < > ").
 * The only literal markup injected around content is fixed wrapper tags (<strong>, <br>);
 * the content inside them is still esc()'d. Do not interpolate raw content without esc().
 */
"use strict";

// ---------- constants ----------
const STORAGE_KEY = "aidemy-arcade:v1";
const INTERVALS = [0, 1, 3, 7, 16, 35]; // Leitner box -> days (box index)
const BOSS_SECONDS = 60;
const BOSS_PASS = 0.7; // 70% to beat
const XP = { quizCorrect: 10, orderCorrect: 15, matchPair: 5, flashcard: 2, boss: 100, dailyBonus: 30 };
const COMBO_MIN = 3; // consecutive correct answers before the 2x XP multiplier kicks in
const SIM_QUESTIONS = 15;
const SIM_SECONDS = 120;
const DAILY_QUESTIONS = 10;
// Interview Simulator grade ladder: [min correct ratio, label] — first match wins.
const SIM_GRADES = [
  [0.9, "Staff Engineer 🏆"], [0.75, "Senior Engineer 🌟"],
  [0.6, "Mid-level Engineer 💪"], [0.4, "Junior Engineer 🌱"], [0, "Intern 📚"],
];
const MAX_FREEZES = 3;        // streak freezes cap (earned by beating bosses)
const MASTERED_BOX = 3;       // SM-2 box at which a card counts as "mastered" (7-day interval)
const QUEST_XP = 50;          // reward per completed weekly quest
const GAUNTLET_LIVES = 3;     // starting lives in a gauntlet run
const GAUNTLET_MAX_LIVES = 5;
const GAUNTLET_RELIC_EVERY = 5; // offer a relic choice every N questions survived

// Gauntlet relics: one choice of three offered every GAUNTLET_RELIC_EVERY survived questions.
const RELICS = [
  { id: "life",   label: "❤️ Extra Life",                 desc: "One more mistake allowed (max 5)" },
  { id: "double", label: "✨ XP Doubler",                  desc: "2× XP for the rest of this run" },
  { id: "skip",   label: "⏭️ Skip Token",                 desc: "Skip a question without penalty" },
  { id: "fifty",  label: "🔮 50/50 Charm",                desc: "Remove two wrong options once" },
  { id: "shield", label: "🛡️ Shield",                    desc: "Absorbs your next wrong answer" },
];

// World-map zones: course ids grouped into themed regions. Unlisted courses land in Frontier.
const ZONES = [
  { id: "foundations", title: "🏰 Foundations Keep", courses: [
    "machine-learning-foundations", "deep-learning-essentials",
    "python-essentials-for-ai-engineer", "fastapi-essentials"] },
  { id: "llm", title: "🧠 LLM Highlands", courses: [
    "llms-deep-dive", "tranformer-architecture-qa", "fine-tuning-for-llms",
    "prompt-engineering-mastery"] },
  { id: "rag", title: "🌋 RAG Valley", courses: [
    "rag-systems", "advanced-rag", "langchain-mastery", "llm-evaluation"] },
  { id: "agents", title: "🏯 Agent Dojo", courses: [
    "agentic-ai-patterns", "langgraph-agents", "crewai-multi-agents",
    "agents-tools-interview-prep"] },
  { id: "production", title: "🚀 Production Peaks", courses: [
    "llmops-deployment", "ai-safety-guardrails", "live-coding-interview-prep",
    "scenerio-based-questions"] },
];

// Weekly quest templates: `event` names are emitted by questEvent() around the app.
const QUEST_POOL = [
  { id: "quiz20",  label: "Answer 20 quiz questions correctly", target: 20, event: "quizCorrect" },
  { id: "boss2",   label: "Beat 2 boss battles",                target: 2,  event: "bossBeaten" },
  { id: "cards30", label: "Review 30 flashcards",               target: 30, event: "cardReviewed" },
  { id: "match8",  label: "Match 8 correct pairs",              target: 8,  event: "matchPair" },
  { id: "combo5",  label: "Reach a 5-answer combo",             target: 1,  event: "combo5" },
  { id: "daily2",  label: "Complete 2 daily challenges",        target: 2,  event: "dailyDone" },
  { id: "sim1",    label: "Finish an Interview Simulator run",  target: 1,  event: "simDone" },
  { id: "recall10", label: "Nail 10 due-card recalls",          target: 10, event: "recallHit" },
];
const STREAK_MILESTONES = { 3: "streak-3", 7: "streak-7", 30: "streak-30" };

let CONTENT = null;              // parsed content.json
const COURSE_BY_ID = new Map();  // id -> course
const SECTION_BY_KEY = new Map();// "courseId/sectionId" -> section
let ACTIVE_TIMER = null;         // boss-battle interval id; cleared on every navigation

// ---------- date helpers (local day) ----------
function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + Math.round(days));
  return todayStr(d);
}
function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}

// ---------- persistence ----------
function defaultProgress() {
  return {
    version: 1, xp: 0, level: 1,
    streak: { current: 0, longest: 0, lastActiveDate: null },
    badges: [], unlocked: {}, bossBeaten: {}, cards: {},
    muted: false, daily: null, // daily: {date, score, total} — one bonus per local day
    freezes: 0,                 // streak freezes (earned per boss, auto-consumed on a missed day)
    lastActivity: null,         // {hash, label} — powers the "Continue" hero card
    quests: null,               // {week, counters:{event:n}, claimed:[questId]}
    weeklyXp: { week: null, xp: 0 },
    gauntletBest: 0,            // most questions survived in a single gauntlet run
    theme: "neon",              // "neon" | "nebula" | "daylight" — see THEMES
  };
}

// ---------- themes ----------
const THEMES = [
  { id: "neon", label: "⚡ Cyber Neon", metaColor: "#0d0d14" },
  { id: "nebula", label: "🌌 Nebula", metaColor: "#0a0c1e" },
  { id: "daylight", label: "☀️ Daylight", metaColor: "#faf9f5" },
];
function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  // "neon" is the :root default — no data-theme attribute needed.
  if (theme.id === "neon") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme.metaColor;
}
function setTheme(id) {
  const p = getProgress();
  p.theme = id;
  saveProgress(p);
  applyTheme(id);
}
function getProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    return Object.assign(defaultProgress(), JSON.parse(raw));
  } catch (e) {
    return defaultProgress();
  }
}
function saveProgress(p) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  renderStatsStrip();
}

// ---------- game state helpers ----------
function levelForXp(xp) { return Math.max(1, Math.floor(Math.sqrt(xp / 50)) + 1); }
function xpForLevel(level) { return 50 * (level - 1) * (level - 1); }

// Monday of the current local week — the key for weekly quests / weekly XP.
function weekKey(d = new Date()) {
  const day = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  return todayStr(monday);
}

function awardXp(n) {
  const p = getProgress();
  const before = p.level;
  p.xp += n;
  p.level = levelForXp(p.xp);
  const wk = weekKey();
  if (p.weeklyXp.week !== wk) p.weeklyXp = { week: wk, xp: 0 };
  p.weeklyXp.xp += n;
  saveProgress(p);
  xpFloat(n);
  if (p.level > before) { toast(`⬆️ Level ${p.level}!`); sfx("win"); confetti(); }
  return p;
}

// Confidence-bet losses: XP can go down (floored at 0), level recomputed honestly.
function loseXp(n) {
  const p = getProgress();
  p.xp = Math.max(0, p.xp - n);
  p.level = levelForXp(p.xp);
  const wk = weekKey();
  if (p.weeklyXp.week === wk) p.weeklyXp.xp = Math.max(0, p.weeklyXp.xp - n);
  saveProgress(p);
}

function bumpStreak() {
  const p = getProgress();
  const today = todayStr();
  const last = p.streak.lastActiveDate;
  if (last === today) { /* already counted today */ }
  else if (last && daysBetween(last, today) === 1) p.streak.current += 1;
  else if (last && daysBetween(last, today) === 2 && p.freezes > 0) {
    // Missed exactly one day but a freeze covers it — streak survives.
    p.freezes -= 1;
    p.streak.current += 1;
    toast(`🧊 Streak freeze used! ${p.freezes} left`);
  }
  else p.streak.current = 1;
  p.streak.lastActiveDate = today;
  p.streak.longest = Math.max(p.streak.longest, p.streak.current);
  const badge = STREAK_MILESTONES[p.streak.current];
  if (badge && !p.badges.includes(badge)) p.badges.push(badge);
  saveProgress(p);
}

function awardBadge(id, label) {
  const p = getProgress();
  if (!p.badges.includes(id)) {
    p.badges.push(id);
    saveProgress(p);
    toast(`🏅 Badge: ${label}`);
  }
}

// ---------- sound effects (Web Audio, synthesized — no asset files) ----------
let AUDIO_CTX = null;
const SFX = {
  // [frequency Hz, start offset s, duration s] per note
  correct: [[660, 0, 0.07], [880, 0.07, 0.10]],
  wrong:   [[165, 0, 0.18]],
  combo:   [[523, 0, 0.06], [659, 0.06, 0.06], [784, 0.12, 0.10]],
  win:     [[523, 0, 0.10], [659, 0.10, 0.10], [784, 0.20, 0.10], [1047, 0.30, 0.22]],
};
function sfx(name) {
  if (getProgress().muted) return;
  const notes = SFX[name];
  if (!notes) return;
  try {
    AUDIO_CTX = AUDIO_CTX || new (window.AudioContext || window.webkitAudioContext)();
    const now = AUDIO_CTX.currentTime;
    notes.forEach(([freq, t, dur]) => {
      const osc = AUDIO_CTX.createOscillator();
      const gain = AUDIO_CTX.createGain();
      osc.type = name === "wrong" ? "square" : "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + dur);
      osc.connect(gain).connect(AUDIO_CTX.destination);
      osc.start(now + t);
      osc.stop(now + t + dur);
    });
  } catch (e) { /* audio unavailable (autoplay policy etc.) — game plays silently */ }
}
function toggleMute() {
  const p = getProgress();
  p.muted = !p.muted;
  saveProgress(p);
  if (!p.muted) sfx("correct"); // audible confirmation
}

// ---------- weekly quests ----------
/* 3 quests per week, picked deterministically from QUEST_POOL by week key.
 * Counters accumulate via questEvent(); completion auto-awards QUEST_XP once. */
function activeQuests() {
  const wk = weekKey();
  const picks = seededSample(QUEST_POOL, 3, mulberry32(hashStr("quests:" + wk)));
  return { week: wk, picks };
}
function questState() {
  const p = getProgress();
  const wk = weekKey();
  if (!p.quests || p.quests.week !== wk) {
    p.quests = { week: wk, counters: {}, claimed: [] };
    saveProgress(p);
  }
  return p.quests;
}
function questEvent(event, n = 1) {
  const { picks } = activeQuests();
  if (!picks.some((q) => q.event === event)) return; // nothing this week cares
  const p = getProgress();
  const wk = weekKey();
  if (!p.quests || p.quests.week !== wk) p.quests = { week: wk, counters: {}, claimed: [] };
  p.quests.counters[event] = (p.quests.counters[event] || 0) + n;
  for (const q of picks) {
    if (q.event === event && !p.quests.claimed.includes(q.id)
        && p.quests.counters[event] >= q.target) {
      p.quests.claimed.push(q.id);
      saveProgress(p);
      awardXp(QUEST_XP);
      toast(`🎯 Quest complete: ${q.label} +${QUEST_XP} XP`);
      sfx("win");
      return;
    }
  }
  saveProgress(p);
}

// ---------- juice: floating XP + confetti ----------
function xpFloat(n) {
  if (n <= 0) return;
  const el = document.createElement("div");
  el.className = "xp-float";
  el.textContent = `+${n} ✨`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}
function confetti() {
  const colors = ["#ffd23f", "#6c5ce7", "#2ecc71", "#ff5c72", "#4fc3f7"];
  for (let i = 0; i < 28; i++) {
    const c = document.createElement("i");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = (Math.random() * 0.4) + "s";
    c.style.animationDuration = (0.9 + Math.random() * 0.8) + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 2200);
  }
}

// "Continue where you left off" — remember the last activity screen.
function saveLastActivity(hash, label) {
  const p = getProgress();
  p.lastActivity = { hash, label };
  saveProgress(p);
}

// ---------- spaced repetition (SM-2-lite) ----------
function getCard(p, lessonId) {
  if (!p.cards[lessonId]) {
    p.cards[lessonId] = { box: 1, ease: 2.5, dueDate: todayStr(), reps: 0, lapses: 0, lastRating: null };
  }
  return p.cards[lessonId];
}
function scheduleCard(lessonId, rating) {
  const p = getProgress();
  const c = getCard(p, lessonId);
  const today = todayStr();
  c.reps += 1;
  c.lastRating = rating;
  if (rating === "again") {
    c.box = 1; c.ease = Math.max(1.3, c.ease - 0.2); c.lapses += 1; c.dueDate = today;
  } else if (rating === "hard") {
    c.ease = Math.max(1.3, c.ease - 0.15); c.dueDate = addDays(today, 1);
  } else if (rating === "good") {
    c.box = Math.min(INTERVALS.length - 1, c.box + 1);
    c.dueDate = addDays(today, INTERVALS[c.box]);
  } else if (rating === "easy") {
    c.box = Math.min(INTERVALS.length - 1, c.box + 2);
    c.ease = c.ease + 0.15;
    c.dueDate = addDays(today, Math.max(1, Math.round(INTERVALS[c.box] * c.ease)));
  }
  saveProgress(p);
}
// Due cards for a section: "again" (box 1, due today) first, then other due, then new.
function dueLessons(section) {
  const p = getProgress();
  const today = todayStr();
  const withMeta = section.lessons.map((l) => ({ lesson: l, card: p.cards[l.id] }));
  const due = withMeta.filter(({ card }) => !card || card.dueDate <= today);
  due.sort((a, b) => {
    const ra = a.card && a.card.lastRating === "again" ? 0 : 1;
    const rb = b.card && b.card.lastRating === "again" ? 0 : 1;
    if (ra !== rb) return ra - rb;
    const da = a.card ? a.card.dueDate : "0000";
    const db = b.card ? b.card.dueDate : "0000";
    return da.localeCompare(db);
  });
  return due.map((x) => x.lesson);
}

// ---------- unlock / progression ----------
function unlockedIndex(courseId) { return getProgress().unlocked[courseId] || 0; }
function isSectionUnlocked(course, sectionIdx) { return sectionIdx <= unlockedIndex(course.id); }
function bossKey(courseId, sectionId) { return `${courseId}/${sectionId}`; }
function isBossBeaten(courseId, sectionId) { return !!getProgress().bossBeaten[bossKey(courseId, sectionId)]; }

function beatBoss(course, section, sectionIdx) {
  const p = getProgress();
  p.bossBeaten[bossKey(course.id, section.id)] = true;
  // Unlock the next section in this course.
  if (sectionIdx + 1 < course.sections.length) {
    p.unlocked[course.id] = Math.max(p.unlocked[course.id] || 0, sectionIdx + 1);
  }
  if (p.freezes < MAX_FREEZES) {
    p.freezes += 1;
    toast(`🧊 Streak freeze earned! (${p.freezes}/${MAX_FREEZES})`);
  }
  saveProgress(p);
  questEvent("bossBeaten");
  confetti();
  awardBadge(`boss-${course.id}-${section.id}`, `${section.title} cleared`);
  if (!getProgress().badges.includes("first-boss")) awardBadge("first-boss", "First Boss Down");
  // Course completion badge.
  const allBeaten = course.sections.every((s) => isBossBeaten(course.id, s.id));
  if (allBeaten) awardBadge(`course-${course.id}`, `${course.title} mastered`);
}

// ---------- routing ----------
function router() {
  const errBox = document.getElementById("loadError");
  const app = document.getElementById("app");
  if (!CONTENT) return; // still loading / errored
  // Kill any running boss timer so a quit/navigated-away battle can't fire finish()
  // and hijack the new screen or mutate progress after the fact.
  if (ACTIVE_TIMER) { clearInterval(ACTIVE_TIMER); ACTIVE_TIMER = null; }
  errBox.hidden = true;
  app.hidden = false;

  const hash = location.hash || "#/home";
  const [, route, ...rest] = hash.split("/"); // "#" , route, params...
  window.scrollTo(0, 0);

  // Bottom tab bar active state (course/quiz/etc. screens highlight the Map tab).
  const tabFor = { home: "home", daily: "daily", gauntlet: "gauntlet", profile: "profile" };
  const active = tabFor[route] || "home";
  document.querySelectorAll("#tabbar a").forEach((a) => {
    a.classList.toggle("active", a.dataset.tab === active);
  });

  if (route === "home" || route === "" || !route) return renderHome();
  if (route === "course") return renderCourse(rest[0]);
  if (route === "quiz") return renderQuiz(rest[0], rest[1]);
  if (route === "match") return renderMatch(rest[0], rest[1]);
  if (route === "simulator") return renderSimulator();
  if (route === "daily") return renderDaily();
  if (route === "gauntlet") return renderGauntlet();
  if (route === "flashcards") return renderFlashcards(rest[0], rest[1]);
  if (route === "boss") return renderBoss(rest[0], rest[1]);
  if (route === "profile") return renderProfile();
  return renderHome();
}

// ---------- rendering: stats strip ----------
function renderStatsStrip() {
  const p = getProgress();
  const el = document.getElementById("statsStrip");
  if (!el) return;
  const cur = xpForLevel(p.level);
  const next = xpForLevel(p.level + 1);
  const pct = next > cur ? Math.min(100, Math.round(((p.xp - cur) / (next - cur)) * 100)) : 100;
  // Values are numbers from our own state — no untrusted content here.
  el.innerHTML = `
    <span class="pill">⭐ <span class="lbl">Lvl</span> ${p.level}</span>
    <span class="xpbar" title="${p.xp} XP"><i style="width:${pct}%"></i></span>
    <span class="pill">✨ ${p.xp} <span class="lbl">XP</span></span>
    <span class="pill">🔥 ${p.streak.current} <span class="lbl">streak</span></span>
    <span class="pill">🏅 ${p.badges.length}</span>
    <button class="pill mute" id="muteBtn" title="Toggle sound">${p.muted ? "🔇" : "🔊"}</button>`;
  document.getElementById("muteBtn").onclick = toggleMute;
}

// ---------- rendering: home / world map ----------
function courseProgressPct(course) {
  const total = course.sections.length;
  if (!total) return 0;
  const beaten = course.sections.filter((s) => isBossBeaten(course.id, s.id)).length;
  return Math.round((beaten / total) * 100);
}

/* Mastery stars per section: ★ boss beaten · ★★ every card mastered (box>=MASTERED_BOX) ·
 * ★★★ flawless boss. Returns 0..3. */
function sectionStars(course, section) {
  const p = getProgress();
  let stars = 0;
  if (isBossBeaten(course.id, section.id)) stars = 1;
  if (stars >= 1 && section.lessons.every((l) => {
    const c = p.cards[l.id];
    return c && c.box >= MASTERED_BOX;
  })) stars = 2;
  if (stars >= 2 && p.badges.includes(`flawless-${course.id}-${section.id}`)) stars = 3;
  return stars;
}
function courseStars(course) {
  return course.sections.reduce((n, s) => n + sectionStars(course, s), 0);
}
function starIcons(n, max = 3) {
  return "★".repeat(n) + "☆".repeat(max - n);
}

/* Per-lesson mastery dots for a section: new (grey) / learning (amber) / mastered (green). */
function lessonDots(section) {
  const p = getProgress();
  return section.lessons.map((l) => {
    const c = p.cards[l.id];
    const cls = !c ? "new" : c.box >= MASTERED_BOX ? "mastered" : "learning";
    return `<i class="dot ${cls}" title="${esc(l.title)}"></i>`;
  }).join("");
}

function courseCard(c) {
  const lessons = c.sections.reduce((n, s) => n + s.lessons.length, 0);
  const pct = courseProgressPct(c);
  const stars = courseStars(c);
  const maxStars = c.sections.length * 3;
  return `
    <div class="course-card" onclick="location.hash='#/course/${esc(c.id)}'">
      <h3>${esc(c.title)}</h3>
      <p>${esc(c.description || "Interview-prep questions and answers.")}</p>
      <div class="course-meta">
        <span class="tag">${c.sections.length} sections</span>
        <span class="tag">${lessons} lessons</span>
        <span class="tag stars">★ ${stars}/${maxStars}</span>
      </div>
      <div class="progress-line"><i style="width:${pct}%"></i></div>
    </div>`;
}

function renderQuestBoard() {
  const { picks } = activeQuests();
  const q = questState();
  const rows = picks.map((quest) => {
    const done = q.claimed.includes(quest.id);
    const n = Math.min(q.counters[quest.event] || 0, quest.target);
    const pct = Math.round((n / quest.target) * 100);
    return `
      <div class="quest-row ${done ? "done" : ""}">
        <span class="quest-label">${done ? "✅" : "🎯"} ${esc(quest.label)}</span>
        <div class="quest-bar"><i style="width:${done ? 100 : pct}%"></i></div>
        <span class="quest-count">${done ? `+${QUEST_XP} XP` : `${n}/${quest.target}`}</span>
      </div>`;
  }).join("");
  return `<div class="quest-board"><h2>Weekly Quests</h2>${rows}</div>`;
}

function renderHome() {
  const app = document.getElementById("app");
  const s = CONTENT.stats;
  const p = getProgress();
  const dailyDone = p.daily && p.daily.date === todayStr();

  // Continue hero — jump straight back into the last activity.
  const cont = p.lastActivity
    ? `<a class="continue-card" href="${esc(p.lastActivity.hash)}">
         <span class="cont-play">▶</span>
         <span><span class="cont-lbl">Continue where you left off</span><br>${esc(p.lastActivity.label)}</span>
       </a>`
    : "";

  // Themed zones; any course not listed in ZONES lands in the Frontier.
  const placed = new Set();
  const zoneHtml = ZONES.map((z) => {
    const cs = z.courses.map((id) => COURSE_BY_ID.get(id)).filter(Boolean);
    cs.forEach((c) => placed.add(c.id));
    if (!cs.length) return "";
    return `<section class="zone zone-${esc(z.id)}">
      <h2 class="zone-title">${esc(z.title)}</h2>
      <div class="course-grid">${cs.map(courseCard).join("")}</div>
    </section>`;
  }).join("");
  const frontier = CONTENT.courses.filter((c) => !placed.has(c.id));
  const frontierHtml = frontier.length
    ? `<section class="zone zone-frontier"><h2 class="zone-title">🗺️ Frontier</h2>
       <div class="course-grid">${frontier.map(courseCard).join("")}</div></section>`
    : "";

  app.innerHTML = `
    <h1>World Map</h1>
    <p class="sub">${plural(CONTENT.courses.length, "course")} · ${plural(s.playableLessons, "playable lesson")}.
      Beat a section's boss to unlock the next.</p>
    ${cont}
    <div class="mode-row">
      <a class="btn lg" href="#/simulator">🎤 Interview Simulator</a>
      <a class="btn lg ${dailyDone ? "ghost" : ""}" href="#/daily">📅 Daily Challenge${dailyDone ? " ✓" : ""}</a>
      <a class="btn lg boss" href="#/gauntlet">💀 Gauntlet${p.gauntletBest ? ` · best ${p.gauntletBest}` : ""}</a>
    </div>
    ${renderQuestBoard()}
    ${zoneHtml}${frontierHtml}`;
  renderStatsStrip();
}

// ---------- rendering: course -> sections ----------
function renderCourse(courseId) {
  const app = document.getElementById("app");
  const course = COURSE_BY_ID.get(courseId);
  if (!course) return renderHome();
  const rows = course.sections.map((section, idx) => {
    const unlocked = isSectionUnlocked(course, idx);
    const beaten = isBossBeaten(course.id, section.id);
    const cls = beaten ? "done" : unlocked ? "" : "locked";
    let actions;
    if (!unlocked) {
      actions = `<span class="muted">🔒 Beat the previous boss to unlock</span>`;
    } else {
      const quizBtn = course.quizEnabled
        ? `<a class="btn ghost" href="#/quiz/${esc(course.id)}/${esc(section.id)}">⚔️ Practice</a>`
        : "";
      const matchBtn = new Set(section.lessons.map((l) => l.answer)).size >= 4
        ? `<a class="btn ghost" href="#/match/${esc(course.id)}/${esc(section.id)}">🧩 Match</a>`
        : "";
      const bossLabel = course.quizEnabled ? "👑 Boss Battle" : "👑 Complete";
      actions = `
        <a class="btn ghost" href="#/flashcards/${esc(course.id)}/${esc(section.id)}">🃏 Flashcards</a>
        ${quizBtn}
        ${matchBtn}
        <a class="btn boss" href="#/boss/${esc(course.id)}/${esc(section.id)}">${bossLabel}</a>`;
    }
    const stars = sectionStars(course, section);
    return `
      <div class="section-row ${cls}">
        <div class="section-num">${beaten ? "✓" : idx + 1}</div>
        <div class="section-body">
          <h4>${esc(section.title)} <span class="stars" title="★ boss · ★★ all cards mastered · ★★★ flawless">${starIcons(stars)}</span></h4>
          <div class="muted">${section.lessons.length} lessons ${beaten ? "· cleared" : ""}</div>
          <div class="lesson-dots">${lessonDots(section)}</div>
        </div>
        <div class="section-actions">${actions}</div>
      </div>`;
  }).join("");
  app.innerHTML = `
    <a class="back" href="#/home">← World Map</a>
    <h1>${esc(course.title)}</h1>
    <p class="sub">${esc(course.description || "")}</p>
    <div class="section-list">${rows}</div>`;
}

// ---------- rendering: quiz (untimed practice) ----------
function renderQuiz(courseId, sectionId) {
  const course = COURSE_BY_ID.get(courseId);
  const section = SECTION_BY_KEY.get(`${courseId}/${sectionId}`);
  if (!course || !section) return renderHome();
  const questions = buildMixedQuestions(section);
  if (!questions.length) {
    return infoScreen("No quiz questions for this section.", `#/course/${courseId}`);
  }
  saveLastActivity(`#/quiz/${courseId}/${sectionId}`, `⚔️ Practice — ${course.title}: ${section.title}`);
  runQuiz({
    course, backHash: `#/course/${courseId}`, title: `Practice — ${section.title}`,
    questions, timed: false,
    onFinish: () => {
      bumpStreak();
      if (!getProgress().badges.includes("first-quiz")) awardBadge("first-quiz", "First Quiz");
    },
  });
}

// ---------- rendering: boss battle (timed) ----------
function renderBoss(courseId, sectionId) {
  const course = COURSE_BY_ID.get(courseId);
  const section = SECTION_BY_KEY.get(`${courseId}/${sectionId}`);
  if (!course || !section) return renderHome();
  const sectionIdx = course.sections.findIndex((s) => s.id === sectionId);
  if (!isSectionUnlocked(course, sectionIdx)) return renderCourse(courseId);

  // Quiz-disabled course: boss degrades to a "review all cards once" gate.
  if (!course.quizEnabled) {
    return renderFlashcards(courseId, sectionId, {
      bossGate: true, course, section, sectionIdx,
    });
  }

  saveLastActivity(`#/boss/${courseId}/${sectionId}`, `👑 Boss — ${course.title}: ${section.title}`);
  const questions = section.lessons.filter((l) => l.quiz).map((l) => l.quiz);
  runQuiz({
    course, backHash: `#/course/${courseId}`,
    title: `👑 Boss — ${section.title}`, questions, timed: true,
    bossHp: Math.ceil(questions.length * BOSS_PASS), // deplete to 0 == hit the 70% pass bar
    onFinish: (correct, total) => {
      bumpStreak();
      const ratio = total ? correct / total : 0;
      if (ratio >= BOSS_PASS) {
        beatBoss(course, section, sectionIdx);
        awardXp(XP.boss);
        sfx("win");
        if (ratio === 1) awardBadge(`flawless-${course.id}-${section.id}`, "Flawless Boss");
        return { passed: true };
      }
      return { passed: false };
    },
  });
}

/* One question per lesson, cycling through the types it supports (mcq/cloze/order)
 * so a practice run has variety without getting longer. Boss battles don't use this —
 * they stay pure MCQ so the 70% pass semantics are unchanged. */
function buildMixedQuestions(section) {
  const questions = [];
  section.lessons.forEach((l, idx) => {
    const variants = [];
    if (l.quiz) variants.push({ type: "mcq", lessonId: l.id, question: l.quiz.question, options: l.quiz.options, answerIndex: l.quiz.answerIndex });
    if (l.cloze) variants.push({ type: "cloze", lessonId: l.id, question: l.cloze.text, options: l.cloze.options, answerIndex: l.cloze.answerIndex });
    if (l.steps) variants.push({ type: "order", lessonId: l.id, question: l.title, steps: l.steps });
    if (variants.length) questions.push(variants[idx % variants.length]);
  });
  return questions;
}

/* Shared quiz engine used by practice, boss, simulator, and daily modes.
 * Optional: seconds (timer length), resultTitle, banner(correct,total) -> html for
 * a custom result line (falls back to the boss pass/fail banner when timed).
 * bossHp: hit points — each correct answer deals 1 damage; phases at 2/3 and 1/3 HP.
 * Betting (untimed only): wager 2× base XP per question; a loss deducts the base
 * and reschedules the lesson's card as weak. */
function runQuiz({ course, backHash, title, questions, timed, onFinish, seconds, resultTitle, banner, bossHp }) {
  const app = document.getElementById("app");
  let i = 0, correct = 0, answered = false, combo = 0, betActive = false;
  let hp = bossHp || 0;
  const totalSeconds = seconds || BOSS_SECONDS;
  let remaining = totalSeconds;

  function bossPhase() {
    if (!bossHp) return 1;
    if (hp <= bossHp / 3) return 3;
    if (hp <= (2 * bossHp) / 3) return 2;
    return 1;
  }
  function bossBarHtml() {
    if (!bossHp) return "";
    const faces = { 1: "👹", 2: "😡", 3: "🔥" };
    const pct = Math.round((hp / bossHp) * 100);
    return `
      <div class="boss-bar">
        <span class="boss-face">${faces[bossPhase()]}</span>
        <div class="hpbar phase-${bossPhase()}"><i style="width:${pct}%"></i></div>
        <span class="hp-text">${hp} HP</span>
      </div>`;
  }

  // Timer id lives on the module-level ACTIVE_TIMER so router() can stop it on nav-away.
  function stopTimer() { if (ACTIVE_TIMER) { clearInterval(ACTIVE_TIMER); ACTIVE_TIMER = null; } }

  function finish() {
    stopTimer();
    const res = onFinish ? onFinish(correct, questions.length) : {};
    const pct = Math.round((correct / questions.length) * 100);
    let bannerHtml = "";
    if (banner) {
      bannerHtml = banner(correct, questions.length);
    } else if (timed) {
      bannerHtml = res && res.passed
        ? `<p class="verdict ok">✅ Boss defeated! Next section unlocked. +${XP.boss} XP</p>`
        : `<p class="verdict no">❌ Need ${Math.round(BOSS_PASS * 100)}% to win. Try again!</p>`;
    }
    app.innerHTML = `
      <div class="card-panel result-screen">
        <h1>${esc(resultTitle || (timed ? "Boss Result" : "Practice Complete"))}</h1>
        <div class="score">${correct}/${questions.length}</div>
        <p class="sub">${pct}% correct</p>
        ${bannerHtml}
        <div class="rate-row">
          <a class="btn lg" href="${esc(backHash)}">${backHash === "#/home" ? "Back to map" : "Back to course"}</a>
          <button class="btn ghost lg" id="retryBtn">Retry</button>
        </div>
      </div>`;
    const retry = document.getElementById("retryBtn");
    if (retry) retry.onclick = () => { i = 0; correct = 0; combo = 0; hp = bossHp || 0; draw(); if (timed) startTimer(); };
  }

  function draw() {
    answered = false;
    betActive = false;
    const q = questions[i];
    const timerHtml = timed
      ? `<span class="timer" id="timer">${remaining}s</span>`
      : `<span></span>`;
    const comboHtml = combo >= COMBO_MIN ? `<span class="combo-chip">🔥 Combo x${combo}</span>` : "";
    // Confidence bet: untimed practice only (boss/sim have their own stakes).
    const betHtml = !timed
      ? `<button class="bet-toggle" id="betBtn" title="Wager: correct = 2× XP, wrong = lose the base XP and this card resurfaces">🎲 Bet 2×</button>`
      : "";
    const label = q.type === "cloze" ? "Fill in the blank:"
                : q.type === "order" ? "Put the steps in order (tap them in sequence):"
                : "";
    // XSS note: q.question / q.steps / options are lesson content — all esc()'d below.
    const body = q.type === "order"
      ? `<div class="order-list" id="orderList">
           ${shuffledIdx(q.steps.length).map((orig) =>
             `<button class="order-step" data-orig="${orig}"><span class="pick-badge"></span>${esc(q.steps[orig])}</button>`).join("")}
         </div>
         <div class="rate-row">
           <button class="btn ghost" id="orderReset">Reset</button>
           <button class="btn" id="orderCheck" disabled>Check order</button>
         </div>`
      : `<div class="options" id="options">
           ${q.options.map((o, idx) => `<button class="option" data-idx="${idx}">${esc(o)}</button>`).join("")}
         </div>`;
    app.innerHTML = `
      <a class="back" href="${esc(backHash)}">← Quit</a>
      <div class="card-panel">
        ${bossBarHtml()}
        <div class="q-progress"><span>${esc(title)}</span><span>Q ${i + 1}/${questions.length}</span></div>
        <div class="q-progress"><span>Score: ${correct} ${comboHtml}</span>${timerHtml}</div>
        ${label ? `<p class="q-label">${label}</p>` : ""}
        <p class="q-text">${esc(q.question)}</p>
        ${body}
        ${betHtml}
        <div class="feedback" id="feedback" hidden>
          <span class="verdict" id="verdict"></span>
          <button class="btn" id="nextBtn">${i + 1 < questions.length ? "Next →" : "Finish"}</button>
        </div>
      </div>`;
    if (q.type === "order") wireOrder(q);
    else document.querySelectorAll(".option").forEach((btn) => {
      btn.onclick = () => choose(parseInt(btn.dataset.idx, 10));
    });
    const betBtn = document.getElementById("betBtn");
    if (betBtn) betBtn.onclick = () => {
      if (answered) return;
      betActive = !betActive;
      betBtn.classList.toggle("active", betActive);
    };
    document.getElementById("nextBtn").onclick = next;
  }

  /* Shared result handling: bet, combo multiplier, boss HP, XP award, verdict line. */
  function markResult(ok, baseXp) {
    const q = questions[i];
    if (ok) {
      correct += 1;
      combo += 1;
      const betMult = betActive ? 2 : 1;
      const comboMult = combo >= COMBO_MIN ? 2 : 1;
      const gained = baseXp * betMult * comboMult;
      awardXp(gained);
      sfx(comboMult > 1 ? "combo" : "correct");
      questEvent("quizCorrect");
      if (combo === 5) questEvent("combo5");
      const parts = [];
      if (betActive) parts.push("🎲 bet won");
      if (comboMult > 1) parts.push(`🔥x${combo} combo`);
      setVerdict(`✅ Correct ${parts.length ? parts.join(" · ") + " = " : ""}+${gained} XP`, true);
      if (bossHp) {
        const before = bossPhase();
        hp = Math.max(0, hp - 1);
        updateBossBar();
        if (hp === 0) {
          // Required hits landed — the pass ratio is already secured; end the fight now.
          document.getElementById("nextBtn").textContent = "Finish him! →";
        } else if (bossPhase() > before) {
          toast(`⚡ Phase ${bossPhase()} — the boss ${bossPhase() === 3 ? "is enraged!" : "fights harder!"}`);
          sfx("combo");
        }
      }
    } else {
      combo = 0;
      sfx("wrong");
      if (betActive) {
        loseXp(baseXp);
        toast(`🎲 Bet lost −${baseXp} XP`);
        // A confidently-wrong answer is the weakest kind of knowledge — resurface it first.
        if (q.lessonId) scheduleCard(q.lessonId, "again");
        setVerdict(`❌ Incorrect — bet lost, −${baseXp} XP, card resurfaces`, false);
      } else {
        setVerdict("❌ Incorrect", false);
      }
    }
    document.getElementById("feedback").hidden = false;
  }
  function updateBossBar() {
    const bar = document.querySelector(".boss-bar");
    if (!bar || !bossHp) return;
    const faces = { 1: "👹", 2: "😡", 3: "🔥" };
    bar.querySelector(".boss-face").textContent = faces[bossPhase()];
    const hpbar = bar.querySelector(".hpbar");
    hpbar.className = `hpbar phase-${bossPhase()}`;
    hpbar.querySelector("i").style.width = Math.round((hp / bossHp) * 100) + "%";
    bar.querySelector(".hp-text").textContent = `${hp} HP`;
  }
  function setVerdict(text, ok) {
    const verdict = document.getElementById("verdict");
    verdict.textContent = text;
    verdict.className = "verdict " + (ok ? "ok" : "no");
  }

  function choose(idx) {
    if (answered) return;
    answered = true;
    const q = questions[i];
    const opts = document.querySelectorAll(".option");
    opts.forEach((b) => (b.disabled = true));
    opts[q.answerIndex].classList.add("correct");
    const ok = idx === q.answerIndex;
    if (!ok) opts[idx].classList.add("wrong");
    markResult(ok, XP.quizCorrect);
  }

  /* Order-the-steps: tap steps in believed order; badges show pick position. */
  function wireOrder(q) {
    const picked = []; // original indices, in tap order
    const stepsEls = () => [...document.querySelectorAll(".order-step")];
    const checkBtn = document.getElementById("orderCheck");
    stepsEls().forEach((el) => {
      el.onclick = () => {
        if (answered || el.classList.contains("picked")) return;
        picked.push(parseInt(el.dataset.orig, 10));
        el.classList.add("picked");
        el.querySelector(".pick-badge").textContent = picked.length;
        checkBtn.disabled = picked.length !== q.steps.length;
      };
    });
    document.getElementById("orderReset").onclick = () => {
      if (answered) return;
      picked.length = 0;
      checkBtn.disabled = true;
      stepsEls().forEach((el) => {
        el.classList.remove("picked");
        el.querySelector(".pick-badge").textContent = "";
      });
    };
    checkBtn.onclick = () => {
      if (answered || picked.length !== q.steps.length) return;
      answered = true;
      checkBtn.disabled = true;
      const ok = picked.every((orig, pos) => orig === pos);
      stepsEls().forEach((el) => {
        const orig = parseInt(el.dataset.orig, 10);
        el.disabled = true;
        el.classList.add(picked.indexOf(orig) === orig ? "correct" : "wrong");
        el.querySelector(".pick-badge").textContent = orig + 1; // reveal true order
      });
      markResult(ok, XP.orderCorrect);
    };
  }

  function next() {
    if (bossHp && hp === 0) return finish(); // boss slain — no need to fight the leftovers
    i += 1;
    if (i >= questions.length) return finish();
    draw();
  }

  function startTimer() {
    stopTimer();
    remaining = totalSeconds;
    ACTIVE_TIMER = setInterval(() => {
      remaining -= 1;
      const t = document.getElementById("timer");
      if (t) {
        t.textContent = remaining + "s";
        if (remaining <= 10) t.classList.add("danger");
      }
      if (remaining <= 0) finish();
    }, 1000);
  }

  draw();
  if (timed) startTimer();
}

// ---------- rendering: interview simulator + daily challenge ----------
/* Flat rapid-fire pool across ALL courses: mcq + cloze only (order questions are
 * too slow for timed play). Built from CONTENT in iteration order — stable, so the
 * daily challenge's seeded pick is the same all day for everyone with this content. */
function rapidFirePool() {
  const pool = [];
  CONTENT.courses.forEach((c) => c.sections.forEach((s) => s.lessons.forEach((l) => {
    if (l.quiz) pool.push({ type: "mcq", question: l.quiz.question, options: l.quiz.options, answerIndex: l.quiz.answerIndex });
    if (l.cloze) pool.push({ type: "cloze", question: l.cloze.text, options: l.cloze.options, answerIndex: l.cloze.answerIndex });
  })));
  return pool;
}

// Deterministic PRNG for the daily pick (same 10 questions all day).
function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededSample(pool, n, rand) {
  const idx = Array.from({ length: pool.length }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, n).map((i) => pool[i]);
}

function renderSimulator() {
  const pool = rapidFirePool();
  if (pool.length < SIM_QUESTIONS) {
    return infoScreen("Not enough questions for the simulator yet.", "#/home");
  }
  const questions = seededSample(pool, SIM_QUESTIONS, Math.random);
  runQuiz({
    backHash: "#/home", title: "🎤 Interview Simulator",
    questions, timed: true, seconds: SIM_SECONDS, resultTitle: "Interview Result",
    banner: (correct, total) => {
      const ratio = total ? correct / total : 0;
      const grade = SIM_GRADES.find(([min]) => ratio >= min)[1];
      return `<p class="verdict ${ratio >= 0.6 ? "ok" : "no"}">Grade: ${esc(grade)}</p>`;
    },
    onFinish: (correct, total) => {
      bumpStreak();
      questEvent("simDone");
      if (!getProgress().badges.includes("first-sim")) awardBadge("first-sim", "First Interview Sim");
      if (total && correct / total >= 0.9) {
        awardBadge("sim-staff", "Staff-grade Interview");
        sfx("win");
        confetti();
      }
      return {};
    },
  });
}

function renderDaily() {
  const today = todayStr();
  const pool = rapidFirePool();
  if (pool.length < DAILY_QUESTIONS) {
    return infoScreen("Not enough questions for a daily challenge yet.", "#/home");
  }
  const questions = seededSample(pool, DAILY_QUESTIONS, mulberry32(hashStr("daily:" + today)));
  let awardedThisRun = false;
  runQuiz({
    backHash: "#/home", title: `📅 Daily Challenge`, questions, timed: false,
    resultTitle: "Daily Challenge",
    banner: (correct, total) => awardedThisRun
      ? `<p class="verdict ok">Daily complete! +${XP.dailyBonus} XP bonus 📅</p>`
      : `<p class="verdict ok">Score ${correct}/${total} — daily bonus already claimed today ✓</p>`,
    onFinish: (correct, total) => {
      bumpStreak();
      const p = getProgress();
      if (!(p.daily && p.daily.date === today)) {
        p.daily = { date: today, score: correct, total };
        saveProgress(p);
        awardXp(XP.dailyBonus);
        awardedThisRun = true;
        sfx("win");
        questEvent("dailyDone");
        if (correct === total) { awardBadge("daily-perfect", "Perfect Daily"); confetti(); }
      }
      return {};
    },
  });
}

// ---------- rendering: roguelike gauntlet ----------
/* Endless cross-course run: 3 lives, wrong answers cost one, a relic choice every
 * GAUNTLET_RELIC_EVERY survived questions. Run ends at 0 lives — XP earned is kept,
 * relics are lost (roguelite: failure still pays, power does not persist). */
function renderGauntlet() {
  const app = document.getElementById("app");
  const pool = rapidFirePool();
  if (pool.length < 20) return infoScreen("Not enough questions for the gauntlet yet.", "#/home");
  const order = shuffledIdx(pool.length); // this run's question order, no repeats
  const s = {
    lives: GAUNTLET_LIVES, skips: 0, fifties: 0, shield: false, xpMult: 1,
    survived: 0, qi: 0, xpEarned: 0,
  };

  function hud() {
    return `
      <div class="gauntlet-hud">
        <span class="pill">❤️ ${s.lives}</span>
        <span class="pill">🏃 ${s.survived}</span>
        <span class="pill">✨ ${s.xpEarned} XP${s.xpMult > 1 ? " (2×)" : ""}</span>
        ${s.shield ? `<span class="pill">🛡️</span>` : ""}
        ${s.skips ? `<span class="pill">⏭️ ${s.skips}</span>` : ""}
        ${s.fifties ? `<span class="pill">🔮 ${s.fifties}</span>` : ""}
      </div>`;
  }

  function drawQuestion() {
    if (s.qi >= order.length) return runOver(true); // cleared the entire pool (!)
    const q = pool[order[s.qi]];
    let answered = false;
    app.innerHTML = `
      <a class="back" href="#/home">← Quit run</a>
      <div class="card-panel">
        <div class="q-progress"><span>💀 Gauntlet</span>${hud()}</div>
        ${q.type === "cloze" ? `<p class="q-label">Fill in the blank:</p>` : ""}
        <p class="q-text">${esc(q.question)}</p>
        <div class="options">
          ${q.options.map((o, idx) => `<button class="option" data-idx="${idx}">${esc(o)}</button>`).join("")}
        </div>
        <div class="rate-row">
          ${s.skips ? `<button class="btn ghost" id="skipBtn">⏭️ Skip (${s.skips})</button>` : ""}
          ${s.fifties ? `<button class="btn ghost" id="fiftyBtn">🔮 50/50 (${s.fifties})</button>` : ""}
        </div>
        <div class="feedback" id="feedback" hidden>
          <span class="verdict" id="verdict"></span>
          <button class="btn" id="nextBtn">Next →</button>
        </div>
      </div>`;
    const opts = [...document.querySelectorAll(".option")];
    opts.forEach((btn) => { btn.onclick = () => answer(parseInt(btn.dataset.idx, 10)); });
    const skipBtn = document.getElementById("skipBtn");
    if (skipBtn) skipBtn.onclick = () => { if (answered) return; s.skips -= 1; s.qi += 1; drawQuestion(); };
    const fiftyBtn = document.getElementById("fiftyBtn");
    if (fiftyBtn) fiftyBtn.onclick = () => {
      if (answered || fiftyBtn.disabled) return;
      s.fifties -= 1;
      fiftyBtn.disabled = true;
      // grey out two wrong options
      const wrong = opts.map((_, idx) => idx).filter((idx) => idx !== q.answerIndex);
      shuffledIdx(wrong.length).slice(0, 2).forEach((wi) => {
        opts[wrong[wi]].disabled = true;
        opts[wrong[wi]].classList.add("eliminated");
      });
    };

    function answer(idx) {
      if (answered) return;
      answered = true;
      opts.forEach((b) => (b.disabled = true));
      opts[q.answerIndex].classList.add("correct");
      const ok = idx === q.answerIndex;
      const verdict = document.getElementById("verdict");
      if (ok) {
        s.survived += 1;
        const gained = XP.quizCorrect * s.xpMult;
        s.xpEarned += gained;
        awardXp(gained);
        sfx("correct");
        questEvent("quizCorrect");
        verdict.textContent = `✅ +${gained} XP — ${s.survived} survived`;
        verdict.className = "verdict ok";
      } else {
        opts[idx].classList.add("wrong");
        if (s.shield) {
          s.shield = false;
          sfx("combo");
          verdict.textContent = "🛡️ Shield absorbed the hit!";
          verdict.className = "verdict ok";
        } else {
          s.lives -= 1;
          sfx("wrong");
          verdict.textContent = `💔 −1 life (${s.lives} left)`;
          verdict.className = "verdict no";
        }
      }
      document.getElementById("feedback").hidden = false;
      document.getElementById("nextBtn").onclick = () => {
        if (s.lives <= 0) return runOver(false);
        s.qi += 1;
        if (ok && s.survived % GAUNTLET_RELIC_EVERY === 0) return offerRelic();
        drawQuestion();
      };
    }
  }

  function offerRelic() {
    const picks = seededSample(RELICS, 3, Math.random);
    app.innerHTML = `
      <div class="card-panel result-screen">
        <h1>🎁 Choose a relic</h1>
        <p class="sub">${s.survived} survived — pick your boon</p>
        <div class="relic-row">
          ${picks.map((r, idx) => `
            <button class="relic-card" data-idx="${idx}">
              <span class="relic-icon">${esc(r.label)}</span>
              <span class="relic-desc">${esc(r.desc)}</span>
            </button>`).join("")}
        </div>
      </div>`;
    document.querySelectorAll(".relic-card").forEach((el) => {
      el.onclick = () => {
        const r = picks[parseInt(el.dataset.idx, 10)];
        if (r.id === "life") s.lives = Math.min(GAUNTLET_MAX_LIVES, s.lives + 1);
        else if (r.id === "double") s.xpMult = 2;
        else if (r.id === "skip") s.skips += 1;
        else if (r.id === "fifty") s.fifties += 1;
        else if (r.id === "shield") s.shield = true;
        toast(`${r.label} claimed`);
        sfx("win");
        drawQuestion();
      };
    });
  }

  function runOver(clearedPool) {
    bumpStreak();
    const p = getProgress();
    const isBest = s.survived > (p.gauntletBest || 0);
    if (isBest) { p.gauntletBest = s.survived; saveProgress(p); }
    if (s.survived >= 10) awardBadge("gauntlet-10", "Gauntlet Runner (10+)");
    if (s.survived >= 25) awardBadge("gauntlet-25", "Gauntlet Slayer (25+)");
    if (isBest && s.survived > 0) confetti();
    app.innerHTML = `
      <div class="card-panel result-screen">
        <h1>${clearedPool ? "🏆 Pool cleared?!" : "💀 Run over"}</h1>
        <div class="score">${s.survived}</div>
        <p class="sub">questions survived · +${s.xpEarned} XP kept
          ${isBest ? "· 🏅 new best!" : `· best: ${getProgress().gauntletBest}`}</p>
        <div class="rate-row">
          <a class="btn lg" href="#/home">Back to map</a>
          <button class="btn ghost lg" id="againBtn">Run again</button>
        </div>
      </div>`;
    document.getElementById("againBtn").onclick = () => renderGauntlet();
  }

  drawQuestion();
}

// ---------- rendering: match-the-pairs ----------
/* 4 random lessons from the section: match each question to its answer.
 * Tap a question, then an answer, to pair them. +XP per correct pair on check. */
function renderMatch(courseId, sectionId) {
  const app = document.getElementById("app");
  const course = COURSE_BY_ID.get(courseId);
  const section = SECTION_BY_KEY.get(`${courseId}/${sectionId}`);
  if (!course || !section) return renderHome();

  // 4 lessons with distinct answers (sampled at runtime — variety across plays).
  const pool = shuffledIdx(section.lessons.length).map((i) => section.lessons[i]);
  const picked = [];
  const seen = new Set();
  for (const l of pool) {
    if (picked.length === 4) break;
    if (!seen.has(l.answer)) { picked.push(l); seen.add(l.answer); }
  }
  if (picked.length < 4) {
    return infoScreen("This section needs at least 4 distinct lessons for Match.", `#/course/${courseId}`);
  }
  saveLastActivity(`#/match/${courseId}/${sectionId}`, `🧩 Match — ${course.title}: ${section.title}`);
  const answerOrder = shuffledIdx(4); // display order of answers (right column)
  const pairs = new Map();            // qIdx -> aDisplayIdx
  let selectedQ = null, checked = false;

  function draw() {
    const qBtns = picked.map((l, qi) => {
      const paired = pairs.has(qi) ? `<span class="pair-num">${pairs.get(qi) + 1}</span>` : "";
      return `<button class="match-item q ${selectedQ === qi ? "selected" : ""} ${pairs.has(qi) ? "paired" : ""}"
        data-q="${qi}">${paired}${esc(trunc(l.title, 80))}</button>`;
    }).join("");
    const aBtns = answerOrder.map((origIdx, ai) => {
      const takenBy = [...pairs.entries()].find(([, a]) => a === ai);
      return `<button class="match-item a ${takenBy ? "paired" : ""}" data-a="${ai}">
        <span class="pair-num">${ai + 1}</span>${esc(trunc(picked[origIdx].answer, 110))}</button>`;
    }).join("");
    app.innerHTML = `
      <a class="back" href="#/course/${esc(courseId)}">← Quit</a>
      <div class="card-panel">
        <div class="q-progress"><span>🧩 Match — ${esc(section.title)}</span><span>${pairs.size}/4 paired</span></div>
        <p class="q-label">Tap a question, then tap its matching answer.</p>
        <div class="match-grid">
          <div class="match-col">${qBtns}</div>
          <div class="match-col">${aBtns}</div>
        </div>
        <div class="rate-row">
          <button class="btn ghost" id="matchReset">Reset</button>
          <button class="btn" id="matchCheck" ${pairs.size === 4 ? "" : "disabled"}>Check pairs</button>
        </div>
        <div class="feedback" id="feedback" hidden>
          <span class="verdict" id="verdict"></span>
          <button class="btn" id="againBtn">Play again</button>
        </div>
      </div>`;
    if (!checked) {
      document.querySelectorAll(".match-item.q").forEach((el) => {
        el.onclick = () => { selectedQ = parseInt(el.dataset.q, 10); if (pairs.has(selectedQ)) pairs.delete(selectedQ); draw(); };
      });
      document.querySelectorAll(".match-item.a").forEach((el) => {
        el.onclick = () => {
          if (selectedQ === null) return;
          const ai = parseInt(el.dataset.a, 10);
          for (const [qi, a] of pairs) if (a === ai) pairs.delete(qi); // answer can hold one pair
          pairs.set(selectedQ, ai);
          selectedQ = null;
          draw();
        };
      });
      document.getElementById("matchReset").onclick = () => { pairs.clear(); selectedQ = null; draw(); };
      document.getElementById("matchCheck").onclick = check;
    }
    document.getElementById("againBtn") && (document.getElementById("againBtn").onclick = () => renderMatch(courseId, sectionId));
  }

  function check() {
    if (checked || pairs.size !== 4) return;
    checked = true;
    let right = 0;
    document.querySelectorAll(".match-item.q").forEach((el) => {
      const qi = parseInt(el.dataset.q, 10);
      const ok = answerOrder[pairs.get(qi)] === qi; // paired answer's original lesson == this question
      el.classList.add(ok ? "correct" : "wrong");
      if (ok) right += 1;
    });
    document.querySelectorAll(".match-item").forEach((el) => (el.disabled = true));
    document.getElementById("matchReset").disabled = true; // board is final; use Play again
    if (right) awardXp(right * XP.matchPair);
    if (right) questEvent("matchPair", right);
    sfx(right === 4 ? "win" : right ? "correct" : "wrong");
    bumpStreak();
    const v = document.getElementById("verdict");
    v.textContent = right === 4 ? `🎯 Perfect! 4/4 +${4 * XP.matchPair} XP`
                                : `${right}/4 pairs correct${right ? ` +${right * XP.matchPair} XP` : ""}`;
    v.className = "verdict " + (right === 4 ? "ok" : "no");
    document.getElementById("feedback").hidden = false;
    document.getElementById("matchCheck").disabled = true;
  }

  draw();
}

// ---------- rendering: flashcards ----------
function renderFlashcards(courseId, sectionId, bossCtx) {
  const app = document.getElementById("app");
  const course = COURSE_BY_ID.get(courseId);
  const section = SECTION_BY_KEY.get(`${courseId}/${sectionId}`);
  if (!course || !section) return renderHome();

  const isBossGate = bossCtx && bossCtx.bossGate;
  if (!isBossGate) saveLastActivity(`#/flashcards/${courseId}/${sectionId}`, `🃏 Flashcards — ${course.title}: ${section.title}`);
  // Boss-gate mode reviews every card once; normal mode reviews due cards (wrong-first).
  let queue = isBossGate ? section.lessons.slice() : dueLessons(section);
  if (!queue.length) queue = section.lessons.slice(); // nothing due -> free review
  let pos = 0, flipped = false, reviewedThisRun = 0;

  function finish() {
    if (isBossGate) {
      beatBoss(course, section, bossCtx.sectionIdx);
      awardXp(XP.boss);
      bumpStreak();
    }
    // Session summary: connect game actions to the learning schedule.
    const p = getProgress();
    const today = todayStr();
    const soon = addDays(today, 3);
    let dueNow = 0, dueSoon = 0, mastered = 0;
    section.lessons.forEach((l) => {
      const c = p.cards[l.id];
      if (!c) return;
      if (c.box >= MASTERED_BOX) mastered += 1;
      if (c.dueDate <= today) dueNow += 1;
      else if (c.dueDate <= soon) dueSoon += 1;
    });
    app.innerHTML = `
      <div class="card-panel result-screen">
        <h1>${isBossGate ? "Section Cleared! 👑" : "Review Done 🃏"}</h1>
        <p class="sub">${reviewedThisRun} card${reviewedThisRun === 1 ? "" : "s"} reviewed</p>
        ${isBossGate ? `<p class="verdict ok">Next section unlocked. +${XP.boss} XP</p>` : ""}
        <p class="sub session-summary">🧠 ${mastered}/${section.lessons.length} mastered ·
          ${dueNow ? `${dueNow} still due` : dueSoon ? `${dueSoon} due in the next 3 days` : "nothing due soon — nice!"}</p>
        <div class="rate-row">
          <a class="btn lg" href="#/course/${esc(courseId)}">Back to course</a>
        </div>
      </div>`;
  }

  function draw() {
    if (pos >= queue.length) return finish();
    const lesson = queue[pos];
    flipped = false;
    app.innerHTML = `
      <a class="back" href="#/course/${esc(courseId)}">← Quit</a>
      <div class="card-panel">
        <div class="q-progress">
          <span>${esc(isBossGate ? "👑 " + section.title : section.title)}</span>
          <span>${pos + 1}/${queue.length}</span>
        </div>
        <div class="flashcard" id="fc">
          <div>
            <div id="fcText">${esc(lesson.flashcard.front)}</div>
            <div class="hint">click to flip</div>
          </div>
        </div>
        <div class="rate-row" id="rateRow" hidden>
          <button class="btn warn" data-r="again">Again</button>
          <button class="btn ghost" data-r="hard">Hard</button>
          <button class="btn" data-r="good">Good</button>
          <button class="btn good" data-r="easy">Easy</button>
        </div>
      </div>`;
    document.getElementById("fc").onclick = flip;
    document.querySelectorAll("#rateRow .btn").forEach((b) => {
      b.onclick = () => rate(lesson, b.dataset.r);
    });
  }

  function flip() {
    if (flipped) return;
    flipped = true;
    const lesson = queue[pos];
    // Build the flipped face with DOM nodes so content stays escaped (no innerHTML of raw text).
    const text = document.getElementById("fcText");
    text.textContent = "";
    const q = document.createElement("strong");
    q.textContent = lesson.flashcard.front;
    text.appendChild(q);
    text.appendChild(document.createElement("br"));
    text.appendChild(document.createElement("br"));
    text.appendChild(document.createTextNode(lesson.flashcard.back));
    document.querySelector(".flashcard .hint").textContent = "rate how well you knew it";
    document.getElementById("rateRow").hidden = false;
  }

  function rate(lesson, rating) {
    // Recall bonus BEFORE rescheduling: successfully recalling a card that was due at a
    // long interval pays big — rewards aligned with the forgetting curve, not completion.
    const prior = getProgress().cards[lesson.id];
    const wasDue = prior && prior.dueDate <= todayStr();
    const goodRecall = rating === "good" || rating === "easy";
    scheduleCard(lesson.id, rating);
    let xp = XP.flashcard;
    if (wasDue && goodRecall && prior.box >= 2) {
      const bonus = prior.box * 5; // box 2=+10 … box 5=+25 (vs base 2 — long recall pays 5-12x)
      xp += bonus;
      toast(`🧠 Recall bonus +${bonus} XP`);
      questEvent("recallHit");
    }
    awardXp(xp);
    questEvent("cardReviewed");
    reviewedThisRun += 1;
    // In normal mode, "again" requeues the card at the end of this run.
    if (!isBossGate && rating === "again") queue.push(lesson);
    pos += 1;
    if (!isBossGate) bumpStreak();
    draw();
  }

  draw();
}

// ---------- rendering: profile ----------
function renderProfile() {
  const app = document.getElementById("app");
  const p = getProgress();
  const badgeHtml = p.badges.length
    ? p.badges.map((b) => `<span class="badge">🏅 ${esc(prettyBadge(b))}</span>`).join("")
    : `<span class="empty-note">No badges yet — beat a boss to earn one.</span>`;
  const courseRows = CONTENT.courses.map((c) => {
    const pct = courseProgressPct(c);
    return `<div class="section-row"><div class="section-body">
      <h4>${esc(c.title)}</h4>
      <div class="progress-line"><i style="width:${pct}%"></i></div>
    </div><div class="muted">${pct}%</div></div>`;
  }).join("");
  app.innerHTML = `
    <a class="back" href="#/home">← World Map</a>
    <h1>Profile</h1>
    <div class="grid-2">
      <div class="stat-box"><div class="big">${p.level}</div><div class="lbl">Level</div></div>
      <div class="stat-box"><div class="big">${p.xp}</div><div class="lbl">Total XP</div></div>
      <div class="stat-box"><div class="big">🔥 ${p.streak.current}</div><div class="lbl">Current streak</div></div>
      <div class="stat-box"><div class="big">${p.streak.longest}</div><div class="lbl">Longest streak</div></div>
      <div class="stat-box"><div class="big">🧊 ${p.freezes || 0}</div><div class="lbl">Streak freezes</div></div>
      <div class="stat-box"><div class="big">${p.weeklyXp && p.weeklyXp.week === weekKey() ? p.weeklyXp.xp : 0}</div><div class="lbl">XP this week</div></div>
    </div>
    <h1 style="margin-top:28px;font-size:20px">Theme</h1>
    <div class="theme-row">
      ${THEMES.map((t) => `
        <button class="btn ${p.theme === t.id ? "" : "ghost"} theme-pick" data-theme-id="${t.id}">${t.label}</button>`).join("")}
    </div>
    <h1 style="margin-top:28px;font-size:20px">Badges</h1>
    <div class="badges">${badgeHtml}</div>
    <h1 style="margin-top:28px;font-size:20px">Course progress</h1>
    <div class="section-list">${courseRows}</div>
    <div style="margin-top:24px">
      <button class="btn ghost" id="resetBtn">Reset all progress</button>
    </div>`;
  document.querySelectorAll(".theme-pick").forEach((b) => {
    b.onclick = () => {
      setTheme(b.dataset.themeId);
      toast(`Theme: ${THEMES.find((t) => t.id === b.dataset.themeId).label}`);
      renderProfile(); // refresh active-button state
    };
  });
  document.getElementById("resetBtn").onclick = () => {
    if (confirm("Erase all XP, streaks, badges and card history?")) {
      localStorage.removeItem(STORAGE_KEY);
      applyTheme("neon"); // theme lives in progress — reset returns to default
      renderStatsStrip();
      renderProfile();
      toast("Progress reset");
    }
  };
}

// ---------- small helpers ----------
function infoScreen(msg, backHash) {
  document.getElementById("app").innerHTML = `
    <a class="back" href="${esc(backHash)}">← Back</a>
    <div class="card-panel"><p class="sub">${esc(msg)}</p></div>`;
}
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
function shuffledIdx(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function trunc(s, n) {
  return s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, "") + "…";
}
function prettyBadge(id) {
  const map = {
    "first-quiz": "First Quiz", "first-boss": "First Boss Down",
    "streak-3": "3-Day Streak", "streak-7": "7-Day Streak", "streak-30": "30-Day Streak",
    "first-sim": "First Interview Sim", "sim-staff": "Staff-grade Interview",
    "daily-perfect": "Perfect Daily",
    "gauntlet-10": "Gauntlet Runner (10+)", "gauntlet-25": "Gauntlet Slayer (25+)",
  };
  if (map[id]) return map[id];
  if (id.startsWith("course-")) return "Course mastered";
  if (id.startsWith("boss-")) return "Boss cleared";
  if (id.startsWith("flawless-")) return "Flawless boss";
  return id;
}
let toastTimer = null;
function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

// ---------- boot ----------
async function boot() {
  try {
    const res = await fetch("data/content.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    CONTENT = await res.json();
  } catch (e) {
    document.getElementById("app").hidden = true;
    document.getElementById("loadError").hidden = false;
    return;
  }
  CONTENT.courses.forEach((c) => {
    COURSE_BY_ID.set(c.id, c);
    c.sections.forEach((s) => SECTION_BY_KEY.set(`${c.id}/${s.id}`, s));
  });
  // Ensure the first section of each course starts unlocked.
  const p = getProgress();
  let changed = false;
  CONTENT.courses.forEach((c) => {
    if (p.unlocked[c.id] === undefined) { p.unlocked[c.id] = 0; changed = true; }
  });
  if (changed) saveProgress(p);

  applyTheme(getProgress().theme);
  renderStatsStrip();
  window.addEventListener("hashchange", router);
  router();
}

boot();
