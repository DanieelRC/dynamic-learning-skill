# Module: algorithms (coding-interview problems)

Follow these steps in order. Keep a short task list. A typical run produces 2–4 decks.

## Step 1 — Intake

Read `intake.md`. In short:

```bash
mkdir -p /tmp/dl && python3 <skill>/scripts/fetch_problem.py "<url>" -o /tmp/dl/problem.json
```

- `ok` → continue.
- `partial` → check the gaps (missing examples or constraints). Fill them from the page with WebFetch
  if you can; otherwise show the user what you got and ask them to paste the rest.
- `paid_only` → premium problem. Ask the user to **paste the statement, examples and constraints**.
  Do not try to work around the paywall.
- `failed` → first try WebFetch on the URL once. If that still fails, ask the user to paste the statement.
- A pasted statement with no URL → build `problem.json` yourself with the same fields
  (`platform: "custom"`, a slug made from the title).

## Step 2 — Understand and classify

1. Restate the problem in one sentence. List the inputs, outputs and the guarantees that matter.
2. Use the constraints to work out the **target complexity** (table in `patterns.md`).
3. Pick the pattern(s) from `patterns.md`. That choice decides **which visualizers** the traces use.
4. Decide the folder: `dynamic-learning/algorithms/<difficulty>/<id>-<slug>/`. Move `problem.json` into its `src/`.

## Step 3 — Plan the approaches

- Always start with **brute force**. It is what you say first in an interview, even when it is obviously too slow.
- Add each meaningful improvement as its own deck, usually 1–2 more. Examples: brute → sort + two pointers
  → hash map; recursion → memoization → bottom-up DP → O(1)-space DP. Skip intermediate steps that teach nothing.
- File names: `01-brute-force.html`, then `02-<technique>.html` …, with the last one as `0N-optimal.html`.
  With only one improvement, it is `02-optimal.html`.

## Step 4 — Write and verify the solutions

For each approach, write `src/solution_<approach>.<ext>` in the user's programming language:

- Use the platform's exact signature (LeetCode's `class Solution` and method) so it can be pasted and submitted.
- It is displayed **as is**, so make it readable: at most about 25 lines and 75 columns, clear names, and
  1–3 short comments in the user's language. No dead code and no debug prints.
- Write `src/test_solutions.<ext or py>` with the examples, edge cases (empty or minimal input, duplicates,
  negatives, extremes, all-equal, already-sorted) and a **randomized cross-check against brute force**.
  Run it. If the language's toolchain is not available, write a faithful Python mirror, test that, and
  report that the original was not executed.
- Fix and re-run until it passes. Never build decks over failing tests.

## Step 5 — Record the traces

For each approach, write `src/trace_<approach>.py` with `scripts/tracekit.py` (usage in its docstring):

- Choose a **small example** that still shows the interesting behavior: 3–8 elements, 8–30 frames.
  Reuse the same example across decks so they can be compared. For brute force, choose one that ends
  quickly but shows the waste.
- Mirror the displayed code. Call `t.step(line, note, vars, viz)` at the lines that matter (decision
  points, updates, returns) instead of at every line. `line` is the 1-based line number **of the
  displayed listing**, even when that listing is Java and the mirror is Python.
- Each **note** is one sentence that says *why*, not just *what*, in the user's language, with
  `code` for values. Notes are also the video's narration.
- Use semantic highlights: `highlight` = being looked at now, `seen` = already processed,
  `ok` = found or accepted, `bad` = rejected, `dim` = discarded for good (binary search halves),
  `window` = the current range.
- Long algorithm (more than about 20 lines, more than about 30 frames, or clear phases)? Call `t.part("<phase>")` before
  each phase. Each part becomes its own trace slide, with the code and the diagram still side by side
  (see "Long algorithms" in `slide-flows.md`).
- Run it to produce `src/frames-<approach>.json`.

## Step 6 — Write the deck specs and build

Follow `slide-flows.md` for which slides go in each deck, and `reference/deck-spec.md` for the format.
Use `"sourceFile"` and `"framesFile"` so the deck shows exactly the code that was tested.

```bash
cd <exercise>/src
python3 <skill>/scripts/build_deck.py 01-brute-force.json ../01-brute-force.html
node <skill>/scripts/snapshot.cjs ../01-brute-force.html /tmp/dl/snap-01
```

Fix every validation error and warning, and every LAYOUT warning. `auto-fit: …` counts too: it means the
engine had to shrink or collapse text, so shorten it at the source. Re-run until both commands are clean, then open the PNGs of the trace slides and any
dense slide with the Read tool. Check four things:
- the highlighted line matches the diagram;
- nothing is clipped;
- text is legible;
- the story makes sense from the first frame to the last.

## Step 7 — Finish

1. Run `python3 <skill>/scripts/update_index.py dynamic-learning`.
2. If `--video` was requested, follow `reference/video.md` for every deck.
3. Reply as described in `SKILL.md` §7.

## Practice mode

Same steps 1–4: the solutions are still written and tested, because the deck has a spoiler slide and
you will review the learner's code. Then follow `practice.md`. It covers the `00-practice.html` deck
(no traces of the solution) and the live coaching loop in chat.
