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


class PartsTest(unittest.TestCase):
    FRAMES = [
        {"line": 1, "note": "a", "part": 1, "partLabel": "one", "vars": {"x": 1}, "viz": [{"type": "array", "name": "a", "values": [1]}]},
        {"line": 2, "note": "b", "part": 1, "viz": [{"type": "map", "name": "m", "entries": []}]},
        {"line": 3, "note": "c", "part": 2, "partLabel": "two", "vars": {"y": 2}},
    ]

    def _spec(self, tmp, **slide):
        (Path(tmp) / "f.json").write_text(json.dumps(self.FRAMES))
        spec = {"lang": "en", "slides": [dict({"type": "trace", "source": "a\nb\nc", "framesFile": "f.json"}, **slide)]}
        bd.resolve_includes(spec, Path(tmp))
        return spec

    def test_part_gets_full_state_and_fresh_vars(self):
        with tempfile.TemporaryDirectory() as tmp:
            s = self._spec(tmp, part=2)["slides"][0]
        self.assertEqual(s["parts"], 2)
        self.assertEqual(s["partLabel"], "two")
        self.assertEqual(len(s["frames"]), 1)
        self.assertEqual([c["name"] for c in s["frames"][0]["viz"]], ["a", "m"])
        self.assertEqual(s["frames"][0]["vars"], {"y": 2})

    def test_frame_on_folded_line_is_an_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            spec = self._spec(tmp, part=1, folds=[{"lines": [2, 3], "label": "rest"}])
        errors, _ = bd.validate(spec)
        self.assertTrue(any("folded" in e for e in errors), errors)


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
