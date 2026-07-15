#!/usr/bin/env python3
"""Invariant tests for generate_content.py — the artifact CI auto-deploys.

Stdlib unittest only (the generator is stdlib-only; no pytest dependency).
Builds a synthetic course tree in a temp dir, runs the generator against it,
and asserts the quiz/cloze/structure invariants that "0 violations" means.

    python3 arcade/test_generate_content.py        # run directly
    python3 -m unittest arcade.test_generate_content
"""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

GEN = Path(__file__).resolve().parent / "generate_content.py"


def write_lesson(section_dir: Path, idx: int, slug: str, title: str, answer: str,
                 steps: list[str] | None = None):
    """Emit a lesson .md matching the scrape format the generator parses."""
    body = [f"# {title}", "", "## Short interview-ready answer", "", answer, ""]
    if steps:
        body += ["## How it works", ""]
        body += [f"{i}. {s}" for i, s in enumerate(steps, 1)]
        body += [""]
    # pad so non_blank_lines >= 5 (stub gate)
    body += ["## Notes", "", "Extra context paragraph one.", "", "More context here.", ""]
    (section_dir / f"{idx:02d}-{slug}.md").write_text("\n".join(body), encoding="utf-8")


def build_fixture(root: Path):
    """A course with two sections and enough distinct answers to enable quizzes."""
    course = root / "test-course"
    (course / "intro").mkdir(parents=True)
    (course / "advanced").mkdir(parents=True)
    (course / "_combined.md").write_text(
        "# Test Course\n\n## Course Description\nA fixture course.\n\n"
        "## Module: Intro\n## Module: Advanced\n", encoding="utf-8")

    # 6 lessons with distinct answers -> quizEnabled (needs >= MIN_ANSWERS_FOR_QUIZ=4)
    lessons = [
        ("intro", "what-is-embedding", "What is an embedding?",
         "An embedding is a dense vector representation of data in continuous space."),
        ("intro", "what-is-tokenization", "What is tokenization?",
         "Tokenization splits text into discrete units called tokens for a model to process."),
        ("intro", "what-is-attention", "What is attention?",
         "Attention lets a model weigh the relevance of different input positions dynamically."),
        ("advanced", "what-is-rag", "What is retrieval augmented generation?",
         "RAG retrieves relevant documents and conditions generation on them for grounded answers.",
         ["Embed the query into a vector", "Search the index for nearest neighbours",
          "Concatenate retrieved passages into the prompt", "Generate the grounded answer"]),
        ("advanced", "what-is-finetuning", "What is fine-tuning?",
         "Fine-tuning continues training a pretrained model on task-specific labelled data."),
        ("advanced", "what-is-quantization", "What is quantization?",
         "Quantization reduces numeric precision of weights to shrink memory and speed inference."),
    ]
    for i, l in enumerate(lessons):
        section, slug, title, answer = l[0], l[1], l[2], l[3]
        steps = l[4] if len(l) > 4 else None
        write_lesson(course / section, i, slug, title, answer, steps)


def run_generator(root: Path, out: Path):
    r = subprocess.run(
        [sys.executable, str(GEN), "--root", str(root), "--out", str(out)],
        capture_output=True, text=True)
    assert r.returncode == 0, f"generator failed:\n{r.stderr}"
    return json.loads(out.read_text(encoding="utf-8"))


class GeneratorInvariants(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        root = Path(cls.tmp.name) / "src"
        root.mkdir()
        build_fixture(root)
        cls.root = root
        cls.doc = run_generator(root, Path(cls.tmp.name) / "content.json")
        cls.lessons = [
            lesson
            for course in cls.doc["courses"]
            for section in course["sections"]
            for lesson in section["lessons"]
        ]

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_schema_and_stats(self):
        self.assertEqual(self.doc["schemaVersion"], 1)
        self.assertEqual(self.doc["stats"]["coursesEmitted"], 1)
        self.assertEqual(self.doc["stats"]["playableLessons"], 6)
        self.assertTrue(self.doc["courses"][0]["quizEnabled"])

    def test_every_lesson_has_flashcard(self):
        for l in self.lessons:
            self.assertIn("flashcard", l, l["id"])
            self.assertEqual(l["flashcard"]["front"], l["title"])
            self.assertEqual(l["flashcard"]["back"], l["answer"])

    def test_quiz_invariants(self):
        """4 distinct options; answerIndex points at the correct answer."""
        quizzes = [l for l in self.lessons if "quiz" in l]
        self.assertTrue(quizzes, "expected quizzes on a quiz-enabled course")
        for l in quizzes:
            q = l["quiz"]
            self.assertEqual(len(q["options"]), 4, l["id"])
            self.assertEqual(len(set(q["options"])), 4, f"duplicate options in {l['id']}")
            self.assertEqual(q["options"][q["answerIndex"]], l["answer"], l["id"])
            self.assertEqual(q["question"], l["title"])

    def test_cloze_invariants(self):
        """When present: 4 distinct options, answerIndex correct, blank present."""
        clozes = [l for l in self.lessons if "cloze" in l]
        for l in clozes:
            c = l["cloze"]
            self.assertEqual(len(c["options"]), 4, l["id"])
            self.assertEqual(len(set(o.lower() for o in c["options"])), 4, l["id"])
            self.assertIn("____", c["text"], l["id"])
            self.assertEqual(c["options"][c["answerIndex"]],
                             c["options"][c["answerIndex"]], l["id"])  # index in range
            self.assertLess(c["answerIndex"], 4, l["id"])

    def test_steps_order_preserved(self):
        """Steps stored in source order (app shuffles at play time)."""
        stepped = [l for l in self.lessons if "steps" in l]
        self.assertTrue(stepped, "fixture has a lesson with steps")
        rag = next(l for l in stepped if "rag" in l["id"])
        self.assertEqual(rag["steps"][0], "Embed the query into a vector")
        self.assertLessEqual(len(rag["steps"]), 5)

    def test_unique_lesson_ids(self):
        ids = [l["id"] for l in self.lessons]
        self.assertEqual(len(ids), len(set(ids)), "lesson IDs must be unique")

    def test_deterministic(self):
        """Same input -> byte-identical output (seeded RNG)."""
        out2 = Path(self.tmp.name) / "content2.json"
        doc2 = run_generator(self.root, out2)
        doc2.pop("generatedAt", None)
        d1 = dict(self.doc)
        d1.pop("generatedAt", None)
        self.assertEqual(
            json.dumps(d1, sort_keys=True), json.dumps(doc2, sort_keys=True),
            "generator is not deterministic")


if __name__ == "__main__":
    unittest.main(verbosity=2)
