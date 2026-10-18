"""Tests for build_deck.py: validation rules and a full build of the Two Sum example."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import build_deck as bd  # noqa: E402

GALLERY = ROOT / "tests/viz-gallery.json"


class ValidateTest(unittest.TestCase):
    def test_unknown_type(self):
        errors, _ = bd.validate({"lang": "en", "slides": [{"type": "nope"}]})
        self.assertTrue(any("unknown type" in e for e in errors))

    def test_trace_line_out_of_range(self):
        spec = {"lang": "en", "slides": [{"type": "trace", "source": "a\nb", "frames": [{"line": 3, "note": "x"}]}]}
        errors, _ = bd.validate(spec)
        self.assertTrue(any("outside 1..2" in e for e in errors))

    def test_quiz_answer_range(self):
        errors, _ = bd.validate({"lang": "en", "slides": [{"type": "quiz", "question": "q", "options": ["a"], "answer": 2}]})
        self.assertTrue(any("answer index" in e for e in errors))

    def test_unknown_viz(self):
        spec = {"lang": "en", "slides": [{"type": "diagram", "viz": [{"type": "hologram"}]}]}
        errors, _ = bd.validate(spec)
        self.assertTrue(any("unknown viz type" in e for e in errors))

    def test_script_close_is_escaped(self):
        html = bd.build_html({"lang": "en", "slides": [{"type": "bullets", "items": ["</script><b>x"]}]})
        self.assertNotIn("</script><b>", html)


class GalleryBuildTest(unittest.TestCase):
    def test_gallery_builds_and_writes_meta(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "01-gallery.html"
            r = subprocess.run([sys.executable, str(ROOT / "scripts/build_deck.py"), str(GALLERY), str(out)],
                               capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertNotIn("error:", r.stderr)
            self.assertIn('id="deck-spec"', out.read_text())
            meta = json.loads((Path(tmp) / "meta.json").read_text())
            self.assertEqual([f["file"] for f in meta["files"]], ["01-gallery.html"])


if __name__ == "__main__":
    unittest.main()
