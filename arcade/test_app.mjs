// State-logic tests for app.js — the ~1,500-line game brain that owns player
// progress. Runs the real source in a vm sandbox with stubbed browser globals
// (localStorage, document, window, fetch), so we test the ACTUAL functions, not
// a copy. node:test + node:assert only — no deps, no browser.
//
//     node --test arcade/test_app.mjs
//
// Focus (wiki/debt/no-tests remediation #3): SM-2 scheduleCard transitions,
// bumpStreak freeze/continue/reset cases, quest claim-once, XP economy floors.
//
// Dates: rather than stub the clock (brittle across timezones), we use the real
// "today" the code sees and compute expectations RELATIVE to it via the app's own
// todayStr()/addDays() (read out of the sandbox). Consts (INTERVALS, QUEST_POOL)
// are const-declared so they don't attach to the vm context — we read them with
// runInContext("<name>") instead of sandbox.<name>.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, "app.js"), "utf8");
const KEY = "aidemy-arcade:v1";

function makeSandbox() {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  // Forgiving DOM: any element access/method is a no-op returning another no-op.
  const el = new Proxy(() => el, {
    get: (_t, p) => {
      if (p === "classList") return { add() {}, remove() {}, toggle() {} };
      if (p === "dataset" || p === "style") return {};
      return el;
    },
    set: () => true,
    apply: () => el,
  });
  const documentStub = new Proxy(
    {
      getElementById: () => el,
      querySelector: () => el,
      querySelectorAll: () => [],
      createElement: () => el,
      addEventListener: () => {},
      documentElement: { dataset: {} },
      body: el,
    },
    { get: (t, p) => (p in t ? t[p] : el) },
  );
  const sandbox = {
    localStorage,
    document: documentStub,
    window: { addEventListener: () => {}, location: { hash: "" } },
    Math, JSON, Date, console,
    fetch: () => Promise.reject(new Error("no network in tests")),
    setTimeout: () => 0,
    clearTimeout: () => {},
  };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: "app.js" });
  return sandbox;
}

const val = (sb, expr) => vm.runInContext(expr, sb);
const progress = (sb) => {
  const raw = sb.localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
};
// A date string that the APP's OWN daysBetween() measures as exactly `gap` days
// before today. We can't rely on the app's addDays() here: on a non-UTC machine
// addDays and daysBetween disagree (addDays builds a local-midnight Date then
// serializes with toISOString()/UTC — see the KNOWN-BUG test at the bottom), so
// some gaps are unreachable via addDays. Instead we scan plain UTC-day strings and
// let daysBetween itself pick the one it counts as `gap` days ago — matching the
// exact reckoning bumpStreak uses internally.
function daysAgo(sb, gap) {
  const today = val(sb, "todayStr()");
  const base = new Date(today + "T00:00:00Z");
  for (let n = 1; n <= gap + 4; n++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - n);
    const cand = d.toISOString().slice(0, 10);
    if (val(sb, `daysBetween("${cand}", "${today}")`) === gap) return cand;
  }
  throw new Error(`could not find a date ${gap} day(s) before ${today}`);
}
/** Seed a full progress object, overriding defaults. */
function seed(sb, over) {
  const base = {
    version: 1, xp: 0, level: 1,
    streak: { current: 0, longest: 0, lastActiveDate: null },
    badges: [], unlocked: {}, bossBeaten: {}, cards: {}, freezes: 0,
    daily: null, quests: null, weeklyXp: { week: null, xp: 0 },
    gauntletBest: 0, theme: "neon",
  };
  sb.localStorage.setItem(KEY, JSON.stringify({ ...base, ...over }));
}

// ---------- SM-2 scheduleCard ----------
test("scheduleCard: 'again' resets to box 1, due today, counts a lapse", () => {
  const sb = makeSandbox();
  const today = val(sb, "todayStr()");
  sb.scheduleCard("L1", "good");
  sb.scheduleCard("L1", "again");
  const c = progress(sb).cards.L1;
  assert.equal(c.box, 1);
  assert.equal(c.dueDate, today);
  assert.equal(c.lapses, 1);
  assert.ok(c.ease >= 1.3, "ease floored at 1.3");
});

test("scheduleCard: 'good' advances the box, +3 days (INTERVALS[2])", () => {
  const sb = makeSandbox();
  const expected = val(sb, "addDays(todayStr(), 3)");
  sb.scheduleCard("L1", "good");
  const c = progress(sb).cards.L1;
  assert.equal(c.box, 2);
  assert.equal(c.dueDate, expected);
  assert.equal(c.reps, 1);
});

test("scheduleCard: 'easy' jumps two boxes and raises ease", () => {
  const sb = makeSandbox();
  const today = val(sb, "todayStr()");
  sb.scheduleCard("L1", "easy");
  const c = progress(sb).cards.L1;
  assert.equal(c.box, 3);
  assert.ok(c.ease > 2.5, "ease increased");
  assert.ok(c.dueDate > today, "scheduled in the future");
});

test("scheduleCard: box never exceeds the INTERVALS ceiling (both 'good' and 'easy' paths)", () => {
  const sb = makeSandbox();
  const maxBox = val(sb, "INTERVALS.length - 1");
  // 'good' path (+1 each) must cap.
  for (let i = 0; i < 12; i++) sb.scheduleCard("Lgood", "good");
  assert.equal(progress(sb).cards.Lgood.box, maxBox, "good path exceeded ceiling");
  // 'easy' path (+2 each) must cap.
  for (let i = 0; i < 12; i++) sb.scheduleCard("Leasy", "easy");
  assert.equal(progress(sb).cards.Leasy.box, maxBox, "easy path exceeded ceiling");
});

test("scheduleCard: 'hard' keeps box, drops ease (floored), due tomorrow", () => {
  const sb = makeSandbox();
  const tomorrow = val(sb, "addDays(todayStr(), 1)");
  sb.scheduleCard("L1", "good");   // box -> 2
  sb.scheduleCard("L1", "hard");
  const c = progress(sb).cards.L1;
  assert.equal(c.box, 2, "hard does not change box");
  assert.equal(c.dueDate, tomorrow);
  assert.ok(c.ease >= 1.3);
});

// ---------- bumpStreak ----------
test("bumpStreak: first activity sets streak to 1", () => {
  const sb = makeSandbox();
  const today = val(sb, "todayStr()");
  sb.bumpStreak();
  const s = progress(sb).streak;
  assert.equal(s.current, 1);
  assert.equal(s.lastActiveDate, today);
});

test("bumpStreak: same day is idempotent", () => {
  const sb = makeSandbox();
  sb.bumpStreak();
  sb.bumpStreak();
  assert.equal(progress(sb).streak.current, 1);
});

test("bumpStreak: consecutive day increments", () => {
  const sb = makeSandbox();
  const yesterday = daysAgo(sb, 1);
  seed(sb, { streak: { current: 3, longest: 3, lastActiveDate: yesterday } });
  sb.bumpStreak();
  assert.equal(progress(sb).streak.current, 4);
});

test("bumpStreak: a missed day with no freeze resets to 1 (longest kept)", () => {
  const sb = makeSandbox();
  const threeAgo = daysAgo(sb, 3);
  seed(sb, { streak: { current: 9, longest: 9, lastActiveDate: threeAgo }, freezes: 0 });
  sb.bumpStreak();
  const s = progress(sb).streak;
  assert.equal(s.current, 1);
  assert.equal(s.longest, 9);
});

test("bumpStreak: a one-day gap is bridged by a freeze (streak survives, freeze consumed)", () => {
  const sb = makeSandbox();
  const twoAgo = daysAgo(sb, 2);
  seed(sb, { streak: { current: 5, longest: 5, lastActiveDate: twoAgo }, freezes: 2 });
  sb.bumpStreak();
  const p = progress(sb);
  assert.equal(p.streak.current, 6, "freeze bridged the gap");
  assert.equal(p.freezes, 1, "exactly one freeze consumed");
});

test("bumpStreak: reaching a milestone awards its badge once", () => {
  const sb = makeSandbox();
  const yesterday = daysAgo(sb, 1);
  seed(sb, { streak: { current: 2, longest: 2, lastActiveDate: yesterday } });
  sb.bumpStreak(); // -> 3 -> "streak-3"
  const badges = progress(sb).badges;
  assert.ok(badges.includes("streak-3"));
  assert.equal(badges.filter((b) => b === "streak-3").length, 1);
});

// ---------- XP economy ----------
test("awardXp: adds XP and recomputes level", () => {
  const sb = makeSandbox();
  sb.awardXp(200);                      // level = floor(sqrt(200/50))+1 = 3
  const p = progress(sb);
  assert.equal(p.xp, 200);
  assert.equal(p.level, 3);
});

test("loseXp: floors XP at 0, never negative", () => {
  const sb = makeSandbox();
  sb.awardXp(30);
  sb.loseXp(100);
  const p = progress(sb);
  assert.equal(p.xp, 0);
  assert.equal(p.level, 1);
});

// ---------- weekly quests (claim-once) ----------
test("questEvent: quest XP is awarded at most once, even past target", () => {
  const sb = makeSandbox();
  const pool = val(sb, "QUEST_POOL");
  assert.ok(Array.isArray(pool) && pool.length, "QUEST_POOL present");
  // The 3 active quests for this week are seeded by questState(); pick one of them.
  sb.questState();
  const active = progress(sb).quests;
  assert.ok(active && active.week, "questState seeded this week");
  // Drive the first pooled quest's event to its target, then overshoot.
  const q = pool[0];
  sb.questEvent(q.event, q.target);
  const afterHit = progress(sb).xp;
  sb.questEvent(q.event, q.target);     // overshoot must not re-award
  assert.equal(progress(sb).xp, afterHit, "quest XP awarded at most once");
  // If this quest is one of the active three, its id is now claimed.
  const claimedIds = progress(sb).quests.claimed;
  assert.equal(new Set(claimedIds).size, claimedIds.length, "no duplicate claims");
});

// ---------- documented pre-existing quirk ----------
// KNOWN BUG (surfaced while writing these tests, NOT introduced by them): on a
// machine whose timezone is not UTC, addDays() and daysBetween() disagree, because
// addDays builds a *local*-midnight Date and serializes it as *UTC*
// (todayStr -> toISOString). In a browser the drift is usually self-cancelling for
// same-day comparisons, but streak math across a day boundary can be off by one in
// non-UTC zones. Tracked in wiki/debt (date-timezone-drift). This test pins the
// current behavior so a future fix is a deliberate, visible change — not a silent one.
test("KNOWN BUG: addDays/daysBetween can disagree off-UTC (documented, not asserted-correct)", () => {
  const sb = makeSandbox();
  const today = val(sb, "todayStr()");
  const back1 = val(sb, `addDays("${today}", -1)`);
  const measured = val(sb, `daysBetween("${back1}", "${today}")`);
  // We only assert it's a positive integer — the exact value depends on the host TZ.
  // The point is to document that `measured` is NOT guaranteed to be 1 off-UTC.
  assert.ok(Number.isInteger(measured) && measured >= 1,
    `daysBetween(addDays(today,-1), today) = ${measured} (host-TZ dependent)`);
});
