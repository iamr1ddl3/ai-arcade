#!/usr/bin/env python3
"""Generate content.json for aidemy-arcade from scraped course markdown.

Walks tc_scrape_output/<course>/<section>/<NN>-<slug>.md, parses each lesson into
a flashcard (always) and — for courses with enough answerable lessons — a
multiple-choice quiz whose distractors are the short-answers of OTHER lessons in
the SAME course (topically related but wrong).

Rule-based, offline, deterministic (seeded RNG). Stdlib only — no pip deps.
Does NOT scrape and never modifies tc_scrape_output/.

Usage:
    python3 arcade/generate_content.py
    python3 arcade/generate_content.py --root <dir> --out <file>
"""

import argparse
import datetime
import json
import random
import re
from pathlib import Path

SEED = 1337
ANSWER_MAX_CHARS = 280
MIN_ANSWERS_FOR_QUIZ = 4  # a course needs >= this many answerable lessons to enable quizzes
STEP_MAX_CHARS = 90       # per-step display cap for order-the-steps questions
MAX_STEPS = 5             # ordering more than this is tedious; take the first N

# Generic words never worth masking in a cloze question.
CLOZE_STOPWORDS = {
    "about", "across", "after", "against", "always", "answer", "around", "because",
    "become", "becomes", "before", "behind", "between", "cannot", "certain", "changes",
    "common", "compare", "compared", "consider", "correct", "could", "different",
    "directly", "during", "either", "enough", "every", "example", "expensive", "first",
    "getting", "having", "however", "important", "instead", "itself", "larger", "little",
    "longer", "making", "meaning", "method", "might", "multiple", "needed", "often",
    "others", "otherwise", "output", "overall", "particular", "process", "provide",
    "provides", "rather", "results", "returns", "second", "several", "should", "simple",
    "simply", "single", "smaller", "specific", "system", "systems", "their", "there",
    "these", "things", "think", "third", "those", "through", "together", "toward",
    "typically", "usually", "value", "values", "version", "where", "whether", "which",
    "while", "within", "without", "would",
}

# Words that should keep a specific casing instead of str.title()'s "Rag"/"Llm" mangling.
ACRONYMS = {
    "rag": "RAG", "llm": "LLM", "llms": "LLMs", "ai": "AI", "ml": "ML",
    "nlp": "NLP", "crag": "CRAG", "flare": "FLARE", "rrf": "RRF",
    "colbert": "ColBERT", "api": "API", "sql": "SQL", "gpu": "GPU",
    "aiml": "AI/ML", "qa": "QA", "llmops": "LLMOps", "crewai": "CrewAI",
    "fastapi": "FastAPI", "langchain": "LangChain", "langgraph": "LangGraph",
}
# Fix known misspellings in source directory names for display only.
DISPLAY_FIXES = {"tranformer": "Transformer"}


def titleize(slug: str) -> str:
    """Human title from a hyphen-slug, preserving known acronym casing."""
    words = []
    for w in slug.split("-"):
        if not w:
            continue
        w = DISPLAY_FIXES.get(w, w)
        words.append(ACRONYMS.get(w.lower(), w[:1].upper() + w[1:]))
    return " ".join(words)


def slugify(s: str) -> str:
    # Mirrors scrape_trainercentral.py so section-dir names match _combined.md module names.
    s = re.sub(r"[^\w\s-]", "", s or "").strip().lower()
    return re.sub(r"[-\s]+", "-", s)[:80] or "untitled"


def strip_markdown(text: str) -> str:
    """Flatten markdown prose into a clean single-line-ish string for an answer/option."""
    text = re.sub(r"`{1,3}([^`]*)`{1,3}", r"\1", text)      # inline/code fences
    text = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", text)    # bold/italic
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.M)    # bullet markers
    text = re.sub(r"^\s*\d+[.)]\s+", "", text, flags=re.M)  # ordered-list markers
    text = re.sub(r"^\s*#{1,6}\s+", "", text, flags=re.M)   # stray headings
    text = re.sub(r"\s+", " ", text)                         # collapse whitespace/newlines
    return text.strip()


def truncate(text: str, limit: int = ANSWER_MAX_CHARS) -> str:
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(",.;:")
    return cut + "…"  # ellipsis


def non_blank_lines(text: str) -> int:
    return sum(1 for line in text.splitlines() if line.strip())


def parse_sections(body: str) -> dict:
    """Split a lesson body on ## or ### headings; key by lowercased heading text.

    Returns {heading_lower: section_text}. Text before the first heading is stored
    under the empty-string key so first-paragraph fallback can reach it.
    """
    sections = {}
    current_key = ""
    current_lines = []
    for line in body.splitlines():
        m = re.match(r"^#{2,3}\s+(.*)$", line)
        if m:
            sections[current_key] = "\n".join(current_lines).strip()
            current_key = m.group(1).strip().lower()
            current_lines = []
        else:
            current_lines.append(line)
    sections[current_key] = "\n".join(current_lines).strip()
    return sections


def first_paragraph(text: str) -> str:
    for block in re.split(r"\n\s*\n", text.strip()):
        block = block.strip()
        if block:
            return block
    return ""


def extract_answer(sections: dict) -> tuple[str, str] | tuple[None, None]:
    """Ordered fallback: interview answer -> definition -> first prose paragraph.

    Returns (answer_text, source) or (None, None) if nothing usable.
    Isolated so a future --llm mode can swap this out without touching the walker.
    """
    for key in ("short interview-ready answer", "interview-ready answer", "interview ready answer"):
        if sections.get(key):
            ans = strip_markdown(first_paragraph(sections[key]))
            if ans:
                return truncate(ans), "interview"
    if sections.get("definition"):
        ans = strip_markdown(first_paragraph(sections["definition"]))
        if ans:
            return truncate(ans), "definition"
    # First real prose paragraph anywhere (preamble first, then any section).
    for key in [""] + [k for k in sections if k]:
        para = first_paragraph(sections.get(key, ""))
        ans = strip_markdown(para)
        if len(ans) >= 20:  # skip trivial fragments
            return truncate(ans), "firstpara"
    return None, None


def extract_steps(sections: dict) -> list | None:
    """Pull an ordered step list from a "how it works"-style section.

    Returns 3..MAX_STEPS cleaned step strings in source order, or None. Stored in
    correct order — the app shuffles at play time, so content.json stays deterministic.
    """
    for key, text in sections.items():
        if "how it works" not in key and "step-by-step" not in key:
            continue
        items = re.findall(r"^\s*\d+[.)]\s+(.+)$", text, flags=re.M)
        steps = [truncate(strip_markdown(it), STEP_MAX_CHARS) for it in items]
        steps = [s for s in steps if len(s) >= 10]
        if len(steps) >= 3:
            return steps[:MAX_STEPS]
    return None


def cloze_term(answer: str, title: str) -> str | None:
    """Pick the most distinctive maskable word in an answer.

    Prefers a term that also appears in the lesson title (concept-central), then the
    longest remaining candidate. Returns the word as it appears in the answer, or None.
    """
    words = re.findall(r"[A-Za-z][A-Za-z-]{5,}", answer)
    cands = [w for w in words if w.lower() not in CLOZE_STOPWORDS]
    if not cands:
        return None
    title_l = title.lower()
    cands.sort(key=lambda w: (w.lower() in title_l, len(w)), reverse=True)
    return cands[0]


def build_cloze(lesson, course_pool, rng) -> dict | None:
    """Mask the lesson's cloze term; distractor words = other lessons' cloze terms.

    Mirrors the MCQ invariants: 4 distinct options, answerIndex points at the answer.
    """
    term = lesson.get("clozeTerm")
    if not term:
        return None
    others = [l for l in course_pool if l is not lesson and l.get("clozeTerm")]
    rng.shuffle(others)
    picks, seen = [], {term.lower()}
    for cand in others:
        if len(picks) == 3:
            break
        t = cand["clozeTerm"]
        if t.lower() not in seen:
            picks.append(t)
            seen.add(t.lower())
    if len(picks) < 3:
        return None
    masked = re.sub(rf"\b{re.escape(term)}\b", "____", lesson["answer"], flags=re.I)
    if "____" not in masked:
        return None
    options = [term] + picks
    rng.shuffle(options)
    return {"text": masked, "options": options, "answerIndex": options.index(term)}


def build_distractors(lesson, course_pool, rng) -> list:
    """Pick 3 other lessons' answers from the same course as wrong options.

    Prefers same-section siblings, then fills from the rest of the course.
    Isolated so a future --llm mode can generate tuned distractors instead.
    """
    same_section = [l for l in course_pool if l is not lesson and l["section_id"] == lesson["section_id"]]
    other = [l for l in course_pool if l is not lesson and l["section_id"] != lesson["section_id"]]
    rng.shuffle(same_section)
    rng.shuffle(other)
    picks, seen = [], {lesson["answer"]}
    for cand in same_section + other:
        if len(picks) == 3:
            break
        if cand["answer"] not in seen:
            picks.append(cand["answer"])
            seen.add(cand["answer"])
    return picks  # may be <3 if the course has too few DISTINCT answers; caller handles that


def parse_combined(course_dir: Path):
    """Return (course_title, description, [module_display_names_in_order])."""
    combined = course_dir / "_combined.md"
    title = titleize(course_dir.name)
    description = ""
    modules = []
    if not combined.exists():
        return title, description, modules
    text = combined.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    title_found = False
    for i, line in enumerate(lines):
        if not title_found and line.startswith("# "):
            title = line[2:].strip()
            title_found = True
        if line.strip() == "## Course Description":
            description = first_paragraph("\n".join(lines[i + 1:i + 6]))
        m = re.match(r"^## Module:\s*(.*)$", line)
        if m:
            modules.append(m.group(1).strip())
    return title, strip_markdown(description), modules


def build():
    parser = argparse.ArgumentParser(description="Generate aidemy-arcade content.json")
    repo = Path(__file__).resolve().parent.parent
    parser.add_argument("--root", default=str(repo / "tc_scrape_output"))
    parser.add_argument("--out", default=str(repo / "arcade" / "data" / "content.json"))
    args = parser.parse_args()

    root = Path(args.root)
    out = Path(args.out)
    rng = random.Random(SEED)

    total_lessons = 0
    skipped_stubs = 0
    playable_lessons = 0
    report_rows = []
    courses_json = []

    course_dirs = sorted(
        d for d in root.iterdir()
        if d.is_dir() and ".bak" not in d.name
    )

    for c_order, course_dir in enumerate(course_dirs):
        course_id = course_dir.name
        title, description, module_names = parse_combined(course_dir)

        # Map each module display name -> section dir slug, preserving _combined order.
        # Any section dir not listed in _combined.md is appended afterwards (alpha).
        section_dirs = {d.name: d for d in course_dir.iterdir() if d.is_dir()}
        ordered_slugs = []
        display_by_slug = {}
        for name in module_names:
            slug = slugify(name)
            if slug in section_dirs and slug not in display_by_slug:
                ordered_slugs.append(slug)
                display_by_slug[slug] = name
        for slug in sorted(section_dirs):
            if slug not in display_by_slug:
                ordered_slugs.append(slug)
                display_by_slug[slug] = titleize(slug)

        course_pool = []       # flat list of answerable lessons (for distractors)
        sections_data = []     # ordered sections -> lessons

        for s_order, slug in enumerate(ordered_slugs):
            section_dir = section_dirs[slug]
            lesson_files = sorted(
                f for f in section_dir.glob("*.md") if f.name != "_combined.md"
            )
            lessons = []
            for l_order, lf in enumerate(lesson_files):
                total_lessons += 1
                text = lf.read_text(encoding="utf-8", errors="replace")
                if non_blank_lines(text) < 5:
                    skipped_stubs += 1
                    continue

                m = re.search(r"^#\s+(.*)$", text, flags=re.M)
                lesson_title = m.group(1).strip() if m else lf.stem
                body = text[m.end():] if m else text
                sections = parse_sections(body)
                answer, source = extract_answer(sections)
                if not answer:
                    skipped_stubs += 1
                    continue

                playable_lessons += 1
                lesson = {
                    "id": f"{course_id}/{slug}/{lf.stem}",
                    "title": lesson_title,
                    "order": l_order,
                    "section_id": slug,
                    "answer": answer,
                    "answerSource": source,
                    "steps": extract_steps(sections),
                    "clozeTerm": cloze_term(answer, lesson_title),
                }
                lessons.append(lesson)
                course_pool.append(lesson)

            if lessons:
                sections_data.append({
                    "id": slug,
                    "title": display_by_slug[slug],
                    "order": s_order,
                    "lessons": lessons,
                })

        if not sections_data:
            report_rows.append((course_id, 0, 0, False))
            continue

        # Gate on DISTINCT answers: a 4-option MCQ needs 1 correct + 3 unique distractors.
        distinct_answers = len({l["answer"] for l in course_pool})
        quiz_enabled = distinct_answers >= MIN_ANSWERS_FOR_QUIZ

        # Emit lessons; attach quiz where eligible.
        out_sections = []
        for section in sections_data:
            out_lessons = []
            for lesson in section["lessons"]:
                entry = {
                    "id": lesson["id"],
                    "title": lesson["title"],
                    "order": lesson["order"],
                    "answer": lesson["answer"],
                    "answerSource": lesson["answerSource"],
                    "flashcard": {"front": lesson["title"], "back": lesson["answer"]},
                }
                if lesson["steps"]:
                    entry["steps"] = lesson["steps"]
                if quiz_enabled:
                    distractors = build_distractors(lesson, course_pool, rng)
                    if len(distractors) == 3:
                        options = [lesson["answer"]] + distractors
                        rng.shuffle(options)
                        entry["quiz"] = {
                            "question": lesson["title"],
                            "options": options,
                            "answerIndex": options.index(lesson["answer"]),
                        }
                    cloze = build_cloze(lesson, course_pool, rng)
                    if cloze:
                        entry["cloze"] = cloze
                out_lessons.append(entry)
            out_sections.append({
                "id": section["id"],
                "title": section["title"],
                "order": section["order"],
                "lessons": out_lessons,
            })

        courses_json.append({
            "id": course_id,
            "title": title,
            "description": description,
            "order": c_order,
            "quizEnabled": quiz_enabled,
            "sections": out_sections,
        })
        report_rows.append((course_id, len(course_pool), len(course_pool), quiz_enabled))

    # Re-number course order after any empties were dropped.
    for i, course in enumerate(courses_json):
        course["order"] = i

    doc = {
        "schemaVersion": 1,
        "generatedAt": datetime.datetime.now(datetime.timezone.utc)
            .replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "stats": {
            "totalLessons": total_lessons,
            "playableLessons": playable_lessons,
            "skippedStubs": skipped_stubs,
            "coursesEmitted": len(courses_json),
        },
        "courses": courses_json,
    }

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # Completeness report so the stub caveat is visible on every build.
    print(f"Wrote {out}")
    print(f"  total lessons:    {total_lessons}")
    print(f"  playable:         {playable_lessons}")
    print(f"  skipped stubs:    {skipped_stubs}")
    print(f"  courses emitted:  {len(courses_json)}")
    print()
    print(f"  {'course':<34} {'playable':>8}  {'quiz'}")
    print(f"  {'-' * 34} {'-' * 8}  {'-' * 4}")
    for course_id, _total, playable, quiz in sorted(report_rows, key=lambda r: -r[2]):
        print(f"  {course_id:<34} {playable:>8}  {'yes' if quiz else 'no'}")


if __name__ == "__main__":
    build()
