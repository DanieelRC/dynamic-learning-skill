# Module: concepts (experimental)

`/dynamic-learning concept <topic>` explains a programming concept such as recursion, Big-O,
hash tables, pointers and references, closures, the event loop, memory (stack vs heap),
or how a dynamic array grows. It uses the same engine and style as the algorithms module.

## Output

`dynamic-learning/concepts/<level>/<slug>/` with `01-<slug>.html`, `src/`, and `meta.json`
(`meta.module = "concepts"`). `<level>` is `easy | medium | hard` (beginner / intermediate / advanced),
so the history index groups concepts the same way as problems.

## Flow (10–14 slides)

1. `title`, then a `bullets` slide "Why it matters in interviews" (where it shows up, typical questions).
2. `idea`: the mental model in plain words, with one analogy as `aside`.
3. `diagram`: a static picture of the model.
4. `trace` over a tiny program in the user's programming language that **shows the mechanism**:
   - recursion → `callstack` + `tree`;
   - hash table → `array` of buckets + `map`;
   - dynamic array → `array` with capacity growth;
   - event loop → `stack` + two `queue`s.
   Frames come from a tracekit script, exactly as in the algorithms module.
5. `code`: an annotated idiomatic example.
6. `bullets`: common mistakes and misconceptions.
7. `compare`: when to use it and when not (alternatives with trade-offs; `time`/`space` columns can
   hold short words).
8. 1–2 `quiz` slides, then `related` with 3–4 practice problems that exercise the concept.
9. `summary`.

Follow the same non-negotiables (tested code, real traces, validation, snapshot QA). This module will
grow its own pattern catalog. Until then, pick components from `reference/visualizers.md`.
