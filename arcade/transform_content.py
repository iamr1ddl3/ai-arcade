#!/usr/bin/env python3
"""Transform scraped course lessons into original derivative learning material.

Stage 1 of the transform → generate → deploy pipeline (see arcade/DEPLOY.md).

For each lesson in tc_scrape_output/, GLM rewrites it substantially (reword +
restructure + add a fresh example), a judge (Sonnet or GLM) scores it for
quality / defensibility / correctness, and only passing lessons are written to
transformed/ — mirroring the source layout, preserving filenames so lesson IDs
(and therefore user progress) stay stable. Cached and incremental: re-runs skip
unchanged lessons, so adding content later only pays for new lessons.

The rewritten markdown is shaped to satisfy the generate_content.py parser
contract (H1 title + `## Definition` / `## Short interview-ready answer`), so
`python3 arcade/generate_content.py --root transformed` needs no changes.

SECURITY: runs OFFLINE on your machine. Reads keys from the environment / .env
(both gitignored). The deployed site never holds a key and never calls an LLM.

Usage:
    python3 arcade/transform_content.py --course advanced-rag --dry-run
    python3 arcade/transform_content.py --course advanced-rag --estimate-only
    python3 arcade/transform_content.py --course advanced-rag --judge sonnet
    python3 arcade/transform_content.py --judge glm --max-lessons 50
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path

# --- config ---
PROMPT_VERSION = "v2"                       # bump to deliberately invalidate the cache
GLM_BASE_URL = "https://api.z.ai/api/paas/v4"
GLM_MODEL = "glm-5.2"
SONNET_MODEL = "claude-sonnet-5"            # per claude-api model catalog
ACCEPT = {"quality": 7, "defensibility": 7}  # + correctness == pass
MAX_RETRIES = 2
NET_RETRIES = 4                              # transient network/rate-limit retries per API call
NET_BACKOFF_SECS = 5                         # linear backoff base: 5s, 10s, 15s, 20s
# Rough price estimate ($/1M tokens) — GLM pricing varies by plan; used only for the
# pre-run projection so a run can't silently drain quota. Not billing-accurate.
EST_GLM_PER_1M = 2.50
CHARS_PER_TOKEN = 4                          # coarse heuristic for the estimate only

REWRITE_SYSTEM = (
    "You are an expert AI/ML educator rewriting interview-prep lessons as your own "
    "original teaching material. Reword thoroughly — do not reuse the source's phrasing or "
    "sentence structure. Reorganize the explanation and add one fresh example or analogy of "
    "your own. Keep every technical claim correct. Output ONLY clean markdown, no preamble.\n"
    "If the lesson contains CODE, rewrite it too: use your own variable/function names, "
    "structure, and comments — never copy the source's code verbatim. But keep it correct and "
    "runnable: preserve exact library/import names (e.g. PyPDF2, not PyDF2), valid syntax, and "
    "correct string/JSON literals. Do not invent facts, names, dates, or citations. "
    "Keep the H1 title an accurate, correctly-spelled restatement of the source's question."
)
REWRITE_TEMPLATE = """Rewrite the following lesson in your own words as original derivative teaching material.

Output markdown in EXACTLY this shape (this is required):
# <the question as an H1 title>

## Definition
<a clear, reworded explanation>

## How it works
<reworded step-by-step or mechanism>

## Short interview-ready answer
<a concise 2-4 sentence answer in fresh wording>

SOURCE LESSON:
{source}
"""

JUDGE_SYSTEM = (
    "You are a strict reviewer. Score a rewritten AI/ML lesson against the source concept. "
    "Return ONLY JSON: {\"quality\": 0-10, \"defensibility\": 0-10, "
    "\"correctness\": \"pass\"|\"fail\", \"notes\": \"...\"}. "
    "quality = clarity/pedagogy; defensibility = how far the wording/structure is from the "
    "source (low = too close to a copy); correctness = fail if any claim is wrong, invented, "
    "or the rewrite drifts off the source question."
)
JUDGE_TEMPLATE = """SOURCE LESSON:
{source}

REWRITTEN LESSON:
{rewrite}

Score the rewrite. Return only the JSON object."""


# --- markdown helpers (shared contract with generate_content.py) ---
def non_blank_lines(text: str) -> int:
    return sum(1 for line in text.splitlines() if line.strip())


def is_stub(text: str) -> bool:
    return non_blank_lines(text) < 5


def cache_key(lesson_id: str, raw_text: str) -> str:
    h = hashlib.sha256()
    h.update(f"{PROMPT_VERSION}\0{lesson_id}\0{raw_text}".encode("utf-8"))
    return h.hexdigest()


def load_cache(path: Path) -> dict:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_cache(path: Path, cache: dict) -> None:
    path.write_text(json.dumps(cache, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def est_tokens(text: str) -> int:
    return max(1, len(text) // CHARS_PER_TOKEN)


def load_dotenv() -> None:
    """Load KEY=VALUE lines from the project-root .env into os.environ (no override)."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


# --- LLM clients (imported lazily so --estimate-only / --dry-run / tests work w/o SDKs) ---
def _require(mod: str, pip_name: str):
    try:
        return __import__(mod)
    except ImportError:
        sys.exit(f"error: '{pip_name}' not installed. Run: pip install {pip_name}")


def glm_client():
    openai = _require("openai", "openai")
    key = os.environ.get("GLM_API_KEY")
    if not key:
        sys.exit("error: GLM_API_KEY not set (put it in .env or the environment).")
    return openai.OpenAI(api_key=key, base_url=GLM_BASE_URL)


def _with_network_retry(fn, what: str):
    """Retry a network call through transient errors with linear backoff.

    Distinct from the quality-retry in transform_one: this guards against dropped
    connections / rate limits so a single blip can't kill a whole batch run.
    Deterministic content is unaffected — only the API transport is retried.
    """
    last = None
    for attempt in range(NET_RETRIES):
        try:
            return fn()
        except Exception as err:  # noqa: BLE001 — SDK raises several transient types
            name = type(err).__name__
            if not any(k in name for k in ("Connection", "Timeout", "RateLimit", "APIStatus", "InternalServer")):
                raise
            last = err
            wait = NET_BACKOFF_SECS * (attempt + 1)
            print(f"  ! {what}: {name}, retry {attempt + 1}/{NET_RETRIES} in {wait}s", flush=True)
            time.sleep(wait)
    raise last


def glm_complete(client, system: str, user: str) -> str:
    resp = _with_network_retry(lambda: client.chat.completions.create(
        model=GLM_MODEL,
        temperature=0.5,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
    ), "GLM call")
    return resp.choices[0].message.content or ""


def anthropic_client():
    _require("anthropic", "anthropic")
    import anthropic
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("error: ANTHROPIC_API_KEY not set (needed for --judge sonnet).")
    return anthropic.Anthropic()


def sonnet_judge_json(client, system: str, user: str) -> str:
    # Strict JSON via output_config.format; adaptive thinking; no temperature/budget_tokens.
    resp = _with_network_retry(lambda: client.messages.create(
        model=SONNET_MODEL,
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"format": {"type": "json_schema", "schema": {
            "type": "object",
            "properties": {
                "quality": {"type": "integer"},
                "defensibility": {"type": "integer"},
                "correctness": {"type": "string", "enum": ["pass", "fail"]},
                "notes": {"type": "string"},
            },
            "required": ["quality", "defensibility", "correctness", "notes"],
            "additionalProperties": False,
        }}},
    ), "Sonnet judge call")
    return next((b.text for b in resp.content if b.type == "text"), "")


def parse_verdict(raw: str) -> dict:
    """Extract the judge JSON; tolerant of code fences / surrounding prose."""
    m = re.search(r"\{.*\}", raw, flags=re.S)
    if not m:
        return {"quality": 0, "defensibility": 0, "correctness": "fail",
                "notes": "unparseable judge output"}
    try:
        v = json.loads(m.group(0))
    except json.JSONDecodeError:
        return {"quality": 0, "defensibility": 0, "correctness": "fail",
                "notes": "invalid judge JSON"}
    v.setdefault("quality", 0)
    v.setdefault("defensibility", 0)
    v.setdefault("correctness", "fail")
    v.setdefault("notes", "")
    return v


def passes(verdict: dict) -> bool:
    return (verdict.get("correctness") == "pass"
            and int(verdict.get("quality", 0)) >= ACCEPT["quality"]
            and int(verdict.get("defensibility", 0)) >= ACCEPT["defensibility"])


# --- lesson discovery ---
def discover_lessons(root: Path, only_course: str | None):
    """Yield (lesson_id, source_path, dest_rel) for every non-stub lesson."""
    for course_dir in sorted(d for d in root.iterdir() if d.is_dir() and ".bak" not in d.name):
        if only_course and course_dir.name != only_course:
            continue
        for section_dir in sorted(d for d in course_dir.iterdir() if d.is_dir()):
            for lf in sorted(section_dir.glob("*.md")):
                if lf.name == "_combined.md":
                    continue
                text = lf.read_text(encoding="utf-8", errors="replace")
                if is_stub(text):
                    continue
                lesson_id = f"{course_dir.name}/{section_dir.name}/{lf.stem}"
                dest_rel = Path(course_dir.name) / section_dir.name / lf.name
                yield lesson_id, lf, dest_rel


def transform_one(lesson_id, source_text, judge, glm, judge_client):
    """Rewrite + judge with retry. Returns (accepted_markdown|None, verdict, attempts).

    judge == "none": rewrite only, NO inline judge — accept any non-stub rewrite. Used when
    an external judge (e.g. an independent Claude pass) is the sole quality gate, so GLM never
    scores its own output. The stub check still applies so unparseable output is rejected.
    """
    notes = ""
    verdict = {}
    for attempt in range(MAX_RETRIES + 1):
        user = REWRITE_TEMPLATE.format(source=source_text)
        if notes:
            user += f"\n\nA previous attempt was rejected by review with notes: {notes}\n" \
                    f"Address them in this rewrite."
        rewrite = glm_complete(glm, REWRITE_SYSTEM, user).strip()
        # strip stray code fences around the whole doc, if any
        rewrite = re.sub(r"^```(?:markdown)?\s*|\s*```$", "", rewrite).strip()

        if judge == "none":
            if not is_stub(rewrite):
                return rewrite, {"judge": "none"}, attempt + 1
            notes = "output was too short / not a valid lesson; produce a full lesson"
            continue

        judge_user = JUDGE_TEMPLATE.format(source=source_text, rewrite=rewrite)
        if judge == "sonnet":
            raw = sonnet_judge_json(judge_client, JUDGE_SYSTEM, judge_user)
        else:
            raw = glm_complete(glm, JUDGE_SYSTEM, judge_user)
        verdict = parse_verdict(raw)

        if passes(verdict) and not is_stub(rewrite):
            return rewrite, verdict, attempt + 1
        notes = verdict.get("notes", "")
    return None, verdict, MAX_RETRIES + 1


def build():
    parser = argparse.ArgumentParser(description="Transform lessons into derivative content")
    repo = Path(__file__).resolve().parent.parent
    parser.add_argument("--root", default=str(repo / "tc_scrape_output"))
    parser.add_argument("--out", default=str(repo / "transformed"))
    parser.add_argument("--cache", default=str(repo / "arcade" / ".transform_cache.json"))
    parser.add_argument("--course", default="advanced-rag",
                        help="limit to one course slug (default: advanced-rag pilot)")
    parser.add_argument("--all-courses", action="store_true",
                        help="transform every course (overrides --course)")
    parser.add_argument("--judge", choices=["sonnet", "glm", "none"], default="glm",
                        help="inline judge gate: glm (self-judge), sonnet, or none "
                             "(rewrite only — use an external judge as the quality gate)")
    parser.add_argument("--max-lessons", type=int, default=None,
                        help="cost cap: stop after N lessons need an API call")
    parser.add_argument("--estimate-only", action="store_true",
                        help="print token/cost projection and exit — no API calls")
    parser.add_argument("--dry-run", action="store_true",
                        help="transform ONE lesson, print result, exit")
    args = parser.parse_args()
    load_dotenv()

    root = Path(args.root)
    out = Path(args.out)
    cache_path = Path(args.cache)
    only_course = None if args.all_courses else args.course

    lessons = list(discover_lessons(root, only_course))
    if not lessons:
        sys.exit(f"no non-stub lessons found under {root} for course={only_course!r}")

    cache = load_cache(cache_path)

    # --- cost guard: estimate before any paid call ---
    todo = [(lid, sp, dr) for (lid, sp, dr) in lessons
            if cache_key(lid, sp.read_text(encoding="utf-8", errors="replace")) not in cache]
    sample = todo[:10] or lessons[:10]
    avg_in = sum(est_tokens(sp.read_text(encoding='utf-8', errors='replace'))
                 for _, sp, _ in sample) // max(1, len(sample))
    # rewrite ≈ input in, ~1.2x out; judge ≈ input+rewrite in, small out
    per_lesson_tokens = int(avg_in * (1 + 1.2 + 2.2 + 0.1))
    total_tokens = per_lesson_tokens * len(todo)
    est_cost = total_tokens / 1_000_000 * EST_GLM_PER_1M

    print(f"course:        {only_course or 'ALL'}")
    print(f"lessons:       {len(lessons)} total, {len(todo)} need transforming "
          f"({len(lessons) - len(todo)} cached)")
    print(f"judge:         {args.judge}")
    print(f"est tokens:    ~{total_tokens:,} (GLM rewrite+judge; ~{per_lesson_tokens:,}/lesson)")
    print(f"est cost:      ~${est_cost:,.2f} (GLM only, rough; judge=sonnet adds Anthropic cost)")
    if args.estimate_only:
        print("\n--estimate-only: no API calls made.")
        return

    # --- clients (constructed lazily; will exit with a clear message if keys/SDKs missing) ---
    glm = glm_client()
    judge_client = anthropic_client() if args.judge == "sonnet" else None

    # --- dry run: one lesson, show everything, don't write ---
    if args.dry_run:
        lid, sp, _ = todo[0] if todo else lessons[0]
        src = sp.read_text(encoding="utf-8", errors="replace")
        print(f"\n=== DRY RUN: {lid} ===")
        rewrite, verdict, attempts = transform_one(lid, src, args.judge, glm, judge_client)
        print(f"\n--- verdict (attempts={attempts}) ---\n{json.dumps(verdict, indent=2)}")
        print(f"\n--- rewrite ---\n{rewrite or '(rejected — see verdict)'}")
        print("\n--dry-run: nothing written.")
        return

    # --- main loop ---
    written = cached = excluded = api_calls = 0
    needs_review = []
    for lid, sp, dest_rel in lessons:
        src = sp.read_text(encoding="utf-8", errors="replace")
        key = cache_key(lid, src)
        entry = cache.get(key)

        if entry and entry.get("accepted"):
            markdown, verdict = entry["markdown"], entry["verdict"]
            cached += 1
        else:
            if args.max_lessons is not None and api_calls >= args.max_lessons:
                print(f"\n--max-lessons {args.max_lessons} reached; stopping.")
                break
            api_calls += 1
            markdown, verdict, _ = transform_one(lid, src, args.judge, glm, judge_client)
            cache[key] = {"accepted": markdown is not None, "markdown": markdown,
                          "verdict": verdict}
            save_cache(cache_path, cache)  # persist after each — resumable

        if markdown is None:
            excluded += 1
            needs_review.append((lid, verdict.get("notes", "")))
            continue

        dest = out / dest_rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(markdown.rstrip() + "\n", encoding="utf-8")
        written += 1

    # --- report ---
    print(f"\n{'=' * 50}\nTransform complete")
    print(f"  written (accepted): {written}")
    print(f"  from cache:         {cached}")
    print(f"  excluded (review):  {excluded}")
    print(f"  API calls this run: {api_calls}")
    if needs_review:
        print("\n  needs review (excluded from deploy):")
        for lid, notes in needs_review:
            print(f"    - {lid}: {notes[:100]}")
    print(f"\n  output: {out}")
    print("  next:   python3 arcade/generate_content.py --root transformed "
          "--out arcade/data/content.json")


if __name__ == "__main__":
    build()
