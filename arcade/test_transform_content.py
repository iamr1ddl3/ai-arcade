#!/usr/bin/env python3
"""Unit tests for the pure, network-free parts of transform_content.py.

These functions gate what SHIPS (parse_verdict/passes — a mis-parse could publish
un-judged content) and what gets RE-BILLED (cache_key — an unstable key re-pays GLM
for unchanged lessons). Stdlib unittest; imports the module directly (LLM SDKs are
lazy-loaded, so no network/keys needed).

    python3 arcade/test_transform_content.py
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import transform_content as tc  # noqa: E402


class CacheKey(unittest.TestCase):
    def test_deterministic(self):
        self.assertEqual(tc.cache_key("a/b/c", "hello"), tc.cache_key("a/b/c", "hello"))

    def test_changes_with_text(self):
        self.assertNotEqual(tc.cache_key("a/b/c", "hello"), tc.cache_key("a/b/c", "hello!"))

    def test_changes_with_id(self):
        self.assertNotEqual(tc.cache_key("a/b/c", "x"), tc.cache_key("a/b/d", "x"))

    def test_changes_with_prompt_version(self):
        """Bumping PROMPT_VERSION must invalidate the cache (its stated purpose)."""
        base = tc.cache_key("id", "text")
        orig = tc.PROMPT_VERSION
        try:
            tc.PROMPT_VERSION = orig + "-bumped"
            self.assertNotEqual(base, tc.cache_key("id", "text"))
        finally:
            tc.PROMPT_VERSION = orig


class ParseVerdict(unittest.TestCase):
    def test_plain_json(self):
        v = tc.parse_verdict('{"quality": 8, "defensibility": 9, "correctness": "pass"}')
        self.assertEqual(v["quality"], 8)
        self.assertEqual(v["correctness"], "pass")

    def test_code_fenced(self):
        raw = 'Here is my verdict:\n```json\n{"quality": 7, "correctness": "pass"}\n```\nDone.'
        v = tc.parse_verdict(raw)
        self.assertEqual(v["quality"], 7)
        self.assertEqual(v["defensibility"], 0)  # defaulted

    def test_surrounding_prose(self):
        v = tc.parse_verdict('The answer is {"quality": 6, "correctness": "fail"} overall.')
        self.assertEqual(v["quality"], 6)

    def test_unparseable_fails_closed(self):
        """No JSON at all -> a failing verdict, never an exception."""
        v = tc.parse_verdict("I cannot produce JSON, sorry.")
        self.assertEqual(v["correctness"], "fail")
        self.assertEqual(v["quality"], 0)

    def test_invalid_json_fails_closed(self):
        v = tc.parse_verdict('{"quality": 8, "correctness": pass}')  # unquoted value
        self.assertEqual(v["correctness"], "fail")

    def test_missing_keys_defaulted(self):
        v = tc.parse_verdict("{}")
        self.assertEqual(v, {"quality": 0, "defensibility": 0,
                             "correctness": "fail", "notes": ""})


class Passes(unittest.TestCase):
    def test_accepts_at_threshold(self):
        self.assertTrue(tc.passes({"correctness": "pass", "quality": 7, "defensibility": 7}))

    def test_rejects_below_quality(self):
        self.assertFalse(tc.passes({"correctness": "pass", "quality": 6, "defensibility": 9}))

    def test_rejects_below_defensibility(self):
        self.assertFalse(tc.passes({"correctness": "pass", "quality": 9, "defensibility": 6}))

    def test_rejects_correctness_fail(self):
        self.assertFalse(tc.passes({"correctness": "fail", "quality": 10, "defensibility": 10}))

    def test_rejects_empty(self):
        self.assertFalse(tc.passes({}))

    def test_string_scores_tolerated(self):
        """Judge may emit numbers as strings; passes() ints them."""
        self.assertTrue(tc.passes({"correctness": "pass", "quality": "8", "defensibility": "8"}))

    def test_end_to_end_fail_never_ships(self):
        """Unparseable judge output -> parse_verdict -> passes == False (fails closed)."""
        self.assertFalse(tc.passes(tc.parse_verdict("garbage, no json")))


class StubAndTokens(unittest.TestCase):
    def test_stub_detection(self):
        self.assertTrue(tc.is_stub("# Title\n\nonly two lines"))
        self.assertFalse(tc.is_stub("\n".join(f"line {i}" for i in range(6))))

    def test_est_tokens_floor(self):
        self.assertEqual(tc.est_tokens(""), 1)      # never zero
        self.assertEqual(tc.est_tokens("a" * 40), 10)


if __name__ == "__main__":
    unittest.main(verbosity=2)
