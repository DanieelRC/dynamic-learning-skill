"""Offline tests for fetch_problem.py (network calls are stubbed with fixtures)."""
import json
import sys
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))
import fetch_problem as fp  # noqa: E402


class LeetCodeTest(unittest.TestCase):
    def setUp(self):
        self.payload = (HERE / "fixtures" / "leetcode_two_sum.json").read_text()

    def test_parses_two_sum(self):
        with mock.patch.object(fp, "http", return_value=self.payload):
            res = fp.fetch("https://leetcode.com/problems/two-sum/description/")
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["id"], "1")
        self.assertEqual(res["difficulty"], "easy")
        self.assertEqual(len(res["examples"]), 2)
        self.assertEqual(res["examples"][0]["input"], "nums = [2,7,11,15], target = 9")
        self.assertEqual(res["examples"][0]["output"], "[0,1]")
        self.assertIn("2 <= nums.length <= 10^4", res["constraints"])
        self.assertTrue(res["follow_up"].startswith("Can you come up"))
        self.assertEqual(res["similar"][0]["slug"], "3sum")
        self.assertIn("python3", res["snippets"])

    def test_paid_only(self):
        data = json.loads(self.payload)
        data["data"]["question"].update(isPaidOnly=True, content=None)
        with mock.patch.object(fp, "http", return_value=json.dumps(data)):
            res = fp.fetch("https://leetcode.com/problems/two-sum/")
        self.assertEqual(res["status"], "paid_only")

    def test_network_failure_reports_failed(self):
        with mock.patch.object(fp, "http", side_effect=fp.urllib.error.URLError("blocked")):
            res = fp.fetch("two-sum")
        self.assertEqual(res["status"], "failed")
        self.assertIn("blocked", res["error"])


class CodeforcesTest(unittest.TestCase):
    def test_rating_buckets(self):
        self.assertEqual(fp.cf_rating_to_difficulty(800), "easy")
        self.assertEqual(fp.cf_rating_to_difficulty(1600), "medium")
        self.assertEqual(fp.cf_rating_to_difficulty(2400), "hard")


if __name__ == "__main__":
    unittest.main()
