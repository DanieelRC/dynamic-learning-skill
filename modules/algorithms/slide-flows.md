# Slide flows

Keep decks short: 10–14 slides each. One idea per slide, with at most 4–5 bullets of one line each.

## `01-brute-force.html` (kind `solution`, order 1)

| # | type | content |
|---|---|---|
| 1 | `title` | subtitle: why we start here |
| 2 | `statement` | plain-language restatement, 2–4 key `points`, the `signature` |
| 3 | `examples` | 1–3 examples, each with a short `explanation`; point out a tricky one |
| 4 | `constraints` | **every** constraint with its `insight` (what it allows or forbids), `ops` bars, `takeaway` with the target complexity |
| 5 | `interview` | clarifying questions to ask the interviewer (duplicates? empty input? sorted? return format?) |
| 6 | `idea` | the brute-force idea in 3 bullets plus a `callout` on the key detail |
| 7 | `trace` | animated walk on the small example (`sourceFile` + `framesFile`); split it into parts for long algorithms (see below) |
| 8 | `code` | the listing with 3–5 `notes` on line ranges, each note ≤ 100 characters (one idea) |
| 9 | `complexity` | time and space with a *why* for each, plus `ops` |
| 10 | `bullets` "Why isn't it enough?" | the bottleneck, named precisely; the bridge to the next idea |
| 11 | `quiz` | 1 question on the subtle detail (4 options, one correct, with an explanation) |
| 12 | `next` | links to `02-…html` and `00-practice.html` |

## `02-…html` … `0N-optimal.html` (kind `solution`, order 2…N)

| # | type | content |
|---|---|---|
| 1 | `title` | subtitle: the trade-off in one line |
| 2 | `constraints` | short reminder of what must be beaten, plus `ops` comparing the approaches |
| 3 | `pattern` | how to **recognize** the pattern (signals) plus a `code` template and a `callout` on where else it appears |
| 4 | `diagram` | the key insight as one static picture (`viz`) with `lead` and `caption` |
| 5 | `trace` | the animated walk (same example as brute force, when possible); one slide per phase for long algorithms |
| 6 | `code` | annotated listing (3–5 notes, ≤ 100 characters each) |
| 7 | `bullets` | edge cases and what the code does with each |
| 8 | `complexity` | time and space with explanations |
| 9 | `compare` | every approach so far, with the current one marked `current: true` |
| 10 | `interview` | how to narrate it: numbered steps, plus `aside` with likely follow-ups |
| 11 | `quiz` | 1–2 questions on the invariant or ordering detail |
| 12 | `related` | 3–4 problems with the same pattern (prefer `problem.json.similar`) |
| 13 | `summary` | 4 numbered takeaways, a one-line `takeaway`, and links to the other decks |

An intermediate approach (neither brute nor final) can drop `related` and `summary` and end with `next`.

## Long algorithms: split the trace by phases

The learner must always see **the code and its behavior side by side**. When an algorithm is too big for one
trace slide, split it into parts instead of shrinking it. Never move the code to one slide and the diagram
to another.

Split when any of these is true:
- more than about 20 lines would be visible;
- more than about 30 frames;
- the algorithm has clear phases (build the graph → BFS; preprocess or sort → main loop; helper `dfs` → caller;
  fill the DP table → reconstruct the answer).

How:
1. In the tracer, call `t.part("<phase name>")` before each phase. The diagram state carries over, so part 2
   starts exactly where part 1 ended.
2. Write one `trace` slide per part, all with the same `sourceFile` and `framesFile`, plus `"part": n`.
3. On each one, show only that phase's code. Use `"lines": [a, b]` to show a range, or
   `"folds": [{"lines": [a, b], "label": "…"}]` to collapse the other phases into one labeled row
   (`⋯ L3–8 · build the graph (part 1)`). Keep the function signature visible for context.
   Line numbers stay those of the full listing.
4. Give each part a title that states the phase. The eyebrow shows `Part 1/3 · <phase>` automatically.
5. After the parts, the `code` slide shows the full listing, with notes on each phase.

2–4 parts per approach, 5–15 frames each. `build_deck.py` rejects a frame whose line is folded on its slide,
and warns when more than 24 lines are visible.

## `00-practice.html` (kind `practice`, order 0)

See `practice.md`. Statement → examples → constraints with *questions* in the insight → 2–3 guided
quizzes → `hints` (3–5 progressive hints) → `code` skeleton with `___` blanks and notes → `checkpoint`
checklist with links to the solutions → optional final `code` slide with `"spoiler": true`.

## Writing rules

- Use the user's language everywhere, `**bold**` the one word that matters per bullet, and `code` for
  identifiers and values. Exponents go as `10^4`.
- Titles are statements, not labels: "Probamos todas las parejas" beats "Fuerza bruta".
- No filler slides and no repeating the statement in every deck. Solution decks after the first one
  open with the constraints reminder.
- Write numbers the way the learner will see them on the platform (0-indexed and so on).
- The deck footer and title come from `meta`; always fill in `meta.problem`, `meta.approach`,
  `meta.time` and `meta.space`.
