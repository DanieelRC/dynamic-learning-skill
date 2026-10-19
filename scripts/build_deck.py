#!/usr/bin/env python3
"""Build a self-contained HTML deck from a Dynamic Learning deck spec (JSON).

Usage:
    python3 build_deck.py SPEC.json OUT.html [--no-meta]
    python3 build_deck.py SPEC.json --check        # validate only

The engine (CSS + JS) is inlined, so the resulting file works offline and
can be opened by double-clicking. Unless --no-meta is given, the exercise
folder's meta.json (next to OUT.html) is created or updated with this deck.
"""
import argparse
import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENGINE = ROOT / "engine"

SLIDE_TYPES = {
    "title", "statement", "examples", "constraints", "bullets", "intuition", "idea", "pattern",
    "interview", "diagram", "trace", "code", "complexity", "compare", "quiz", "hints",
    "checkpoint", "next", "related", "summary",
}
VIZ_TYPES = {
    "array", "string", "list", "bits", "map", "dict", "hashmap", "set", "counter", "stack",
    "callstack", "queue", "deque", "linkedlist", "tree", "heap", "trie", "graph", "grid",
    "matrix", "dp", "table", "intervals", "text",
}
REQUIRED = {
    "trace": ["source", "frames"],
    "code": ["source"],
    "quiz": ["question", "options", "answer"],
    "hints": ["hints"],
    "examples": ["examples"],
    "constraints": ["items"],
    "complexity": ["time", "space"],
    "compare": ["rows"],
    "diagram": ["viz"],
}
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700'
         '&family=Space+Grotesk:wght@400;500;600;700&display=swap">')


def validate(spec):
    errors, warnings = [], []
    if not isinstance(spec.get("slides"), list) or not spec["slides"]:
        return ["spec.slides must be a non-empty list"], warnings
    if "lang" not in spec:
        warnings.append("spec.lang missing: UI labels default to English")
    for i, s in enumerate(spec["slides"], 1):
        where = f"slide {i} ({s.get('type', '?')})"
        t = s.get("type")
        if t not in SLIDE_TYPES:
            errors.append(f"{where}: unknown type. Valid: {sorted(SLIDE_TYPES)}")
            continue
        for key in REQUIRED.get(t, []):
            if key not in s:
                errors.append(f"{where}: missing '{key}'")
        if t == "quiz" and isinstance(s.get("answer"), int):
            if not 0 <= s["answer"] < len(s.get("options", [])):
                errors.append(f"{where}: answer index out of range")
        if t in ("trace", "code") and "source" in s:
            n_lines = len(str(s["source"]).rstrip().split("\n"))
            if len(visible_lines(s, n_lines)) > 32:
                warnings.append(f"{where}: {n_lines} code lines shown; >32 gets small. Fold parts with \"lines\"/\"folds\" or split.")
            notes = s.get("notes", [])
            note_chars = sum(len(str(n.get("text", ""))) for n in notes)
            if len(notes) > 5 or note_chars > 480:
                warnings.append(f"{where}: {len(notes)} notes / {note_chars} chars; they will not fit at full size. Keep <= 5 notes, <= 100 chars each")
            for j, n in enumerate(notes, 1):
                if len(str(n.get("text", ""))) > 130:
                    warnings.append(f"{where} note {j}: {len(str(n['text']))} chars; keep it under ~100")
                for ln in ([n.get("lines")] if isinstance(n.get("lines"), int) else n.get("lines", [])):
                    if not 1 <= ln <= n_lines:
                        errors.append(f"{where} note {j}: line {ln} outside 1..{n_lines}")
                    elif ln not in visible_lines(s, n_lines):
                        errors.append(f"{where} note {j}: line {ln} is folded/hidden on this slide")
        if t == "trace":
            n_lines = len(str(s.get("source", "")).rstrip().split("\n"))
            frames = s.get("frames", [])
            if not frames:
                errors.append(f"{where}: frames is empty")
            if len(frames) > 40:
                warnings.append(f"{where}: {len(frames)} frames; consider a smaller example (<= 30)")
            shown = visible_lines(s, n_lines)
            if len(shown) > 24:
                warnings.append(f"{where}: {len(shown)} visible code lines. Split the trace into parts "
                                "(tracekit t.part() + \"part\": n) and show each phase with \"lines\"/\"folds\"")
            if "part" in s and not frames:
                errors.append(f"{where}: no frames recorded for part {s['part']} (check t.part() in the tracer)")
            for j, f in enumerate(frames, 1):
                lines = f.get("line")
                for ln in ([lines] if isinstance(lines, int) else (lines or [])):
                    if not isinstance(ln, int) or not 1 <= ln <= n_lines:
                        errors.append(f"{where} frame {j}: line {ln} outside 1..{n_lines}")
                    elif ln not in shown:
                        errors.append(f"{where} frame {j}: line {ln} is folded/hidden on this slide; "
                                      "show it with \"lines\" or move the frame to another part")
                if not f.get("note"):
                    warnings.append(f"{where} frame {j}: no note (narration helps learners and video)")
                check_viz(f.get("viz", []), f"{where} frame {j}", errors)
        if t == "diagram":
            check_viz(s.get("viz", []), where, errors)
    return errors, warnings


def check_viz(comps, where, errors):
    if not isinstance(comps, list):
        errors.append(f"{where}: viz must be a list of components")
        return
    for c in comps:
        if not isinstance(c, dict):
            errors.append(f"{where}: viz component must be an object")
            continue
        typ = str(c.get("type", "array")).lower()
        if typ not in VIZ_TYPES and not c.get("remove"):
            errors.append(f"{where}: unknown viz type '{typ}'. Valid: {sorted(VIZ_TYPES)}")


def materialize(frames):
    """Resolve component/var carry-over so every frame holds the full state (needed to split parts)."""
    out, carry, cvars, part = [], [], {}, None
    key = lambda c: (c.get("name") or c.get("type"), c.get("type", "array"))
    for f in frames:
        if f.get("part") != part:
            cvars, part = {}, f.get("part")
        comps = [] if f.get("reset") else list(carry)
        for c in f.get("viz") or []:
            idx = next((i for i, x in enumerate(comps) if key(x) == key(c)), None)
            if c.get("remove"):
                if idx is not None:
                    comps.pop(idx)
                continue
            if idx is None:
                comps.append(c)
            else:
                comps[idx] = c
        v = dict(f.get("vars") or {}) if f.get("resetVars") else {**cvars, **(f.get("vars") or {})}
        g = {k: val for k, val in f.items() if k not in ("viz", "vars", "reset", "resetVars")}
        g.update(viz=comps, vars=v, reset=True, resetVars=True)
        out.append(g)
        carry, cvars = comps, v
    return out


def resolve_includes(spec, base):
    """Load "framesFile" / "sourceFile" and split traces by "part" (frames recorded with tracekit's t.part())."""
    cache = {}
    for s in spec.get("slides", []):
        if s.get("type") in ("trace", "code") and "sourceFile" in s and "source" not in s:
            s["source"] = (base / s.pop("sourceFile")).read_text(encoding="utf-8")
        if s.get("type") == "trace" and "framesFile" in s and "frames" not in s:
            name = s.pop("framesFile")
            if name not in cache:
                cache[name] = json.loads((base / name).read_text(encoding="utf-8"))
            frames = cache[name]
            if "part" in s:
                parts = sorted({f.get("part") for f in frames if f.get("part")})
                full = materialize(frames)
                mine = [f for f in full if f.get("part") == s["part"]]
                s["parts"] = len(parts)
                if mine and not s.get("partLabel"):
                    s["partLabel"] = mine[0].get("partLabel")
                s["frames"] = mine
            else:
                s["frames"] = frames


def visible_lines(s, n_lines):
    """Lines shown on a slide that uses "lines" and/or "folds"."""
    def rng(spec):
        if spec is None:
            return []
        if isinstance(spec, int):
            return [(spec, spec)]
        if spec and isinstance(spec[0], int):
            return [(spec[0], spec[-1])]
        return [(r, r) if isinstance(r, int) else (r[0], r[-1]) for r in spec]
    shown = set(range(1, n_lines + 1)) if s.get("lines") is None else {l for a, b in rng(s["lines"]) for l in range(a, b + 1)}
    for f in s.get("folds", []):
        for a, b in rng(f.get("lines")):
            shown -= set(range(a, b + 1))
    return shown


def safe_json(obj):
    # Embedding JSON inside <script>: never let a string close the tag
    return (json.dumps(obj, ensure_ascii=False)
            .replace("</", "<\\/").replace("<!--", "<\\!--").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def build_html(spec):
    css = (ENGINE / "viewport-base.css").read_text(encoding="utf-8") + "\n" + (ENGINE / "theme.css").read_text(encoding="utf-8")
    js = "\n".join((ENGINE / f).read_text(encoding="utf-8") for f in ("core.js", "visualizers.js", "deck.js"))
    meta = spec.get("meta", {})
    problem = meta.get("problem", {})
    title = spec.get("title") or " · ".join(x for x in [problem.get("title"), meta.get("approach")] if x) or "Dynamic Learning"
    esc = lambda s: str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    return f"""<!DOCTYPE html>
<html lang="{esc(spec.get('lang', 'en'))}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content="dynamic-learning">
<title>{esc(title)}</title>
{FONTS}
<style>
{css}
</style>
</head>
<body>
<div class="deck-viewport"><main class="deck-stage" id="deckStage" aria-live="polite"></main></div>
<script type="application/json" id="deck-spec">{safe_json(spec)}</script>
<script>
{js}
</script>
</body>
</html>
"""


def update_meta(spec, out_path):
    meta = spec.get("meta", {})
    problem = meta.get("problem")
    if not problem:
        return None
    meta_path = out_path.parent / "meta.json"
    data = {}
    if meta_path.exists():
        try:
            data = json.loads(meta_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}
    now = dt.datetime.now().isoformat(timespec="seconds")
    data.setdefault("created", now)
    data["updated"] = now
    data["module"] = meta.get("module", data.get("module", "algorithms"))
    data["lang"] = spec.get("lang", data.get("lang"))
    data["problem"] = {**data.get("problem", {}), **problem}
    if meta.get("language"):
        data["language"] = meta["language"]
    if meta.get("patterns"):
        data["patterns"] = meta["patterns"]
    files = [f for f in data.get("files", []) if f.get("file") != out_path.name]
    files.append({
        "file": out_path.name,
        "kind": meta.get("kind", "solution"),
        "approach": meta.get("approach"),
        "time": meta.get("time"),
        "space": meta.get("space"),
        "order": meta.get("order", len(files) + 1),
    })
    data["files"] = sorted(files, key=lambda f: (99 if f.get("order") is None else f["order"], f["file"]))
    meta_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return meta_path


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("spec")
    ap.add_argument("out", nargs="?")
    ap.add_argument("--check", action="store_true", help="validate only")
    ap.add_argument("--no-meta", action="store_true", help="do not touch meta.json")
    args = ap.parse_args()

    try:
        spec = json.loads(Path(args.spec).read_text(encoding="utf-8"))
        resolve_includes(spec, Path(args.spec).resolve().parent)
    except json.JSONDecodeError as e:
        sys.exit(f"Invalid JSON: {e}")
    except FileNotFoundError as e:
        sys.exit(f"Missing file: {e.filename}")
    errors, warnings = validate(spec)
    for w in warnings:
        print("warning:", w, file=sys.stderr)
    if errors:
        for e in errors:
            print("error:", e, file=sys.stderr)
        sys.exit(1)
    if args.check:
        print(f"ok: {len(spec['slides'])} slides")
        return
    if not args.out:
        sys.exit("OUT.html is required unless --check is given")
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build_html(spec), encoding="utf-8")
    print(f"built {out} ({len(spec['slides'])} slides, {out.stat().st_size // 1024} KB)")
    if not args.no_meta:
        m = update_meta(spec, out)
        if m:
            print(f"updated {m}")


if __name__ == "__main__":
    main()
