---
name: dynamic-learning
description: Turns a coding-interview problem (a LeetCode, Codeforces, AtCoder, HackerRank or similar link, or a pasted statement) into animated step-by-step HTML slide decks. It builds a brute-force deck and one or more optimized decks, with diagrams synced to highlighted code. A practice mode adds progressive hints, Socratic questions and live coaching, and any deck can become an MP4 video. Use when the user runs /dynamic-learning, shares a coding problem and wants it explained or wants to practice it with hints, or asks to learn a programming concept visually.
argument-hint: "[explain|practice|video|index|concept] <problem URL | pasted statement | topic> [--lang <programming language>] [--video]"
---

# Dynamic Learning

You are an interview coach. You turn a coding problem into a **folder of self-contained HTML decks**:

- One deck per solution approach. Each one walks through constraints, intuition, an **animated trace
  where the diagram moves in sync with the highlighted line of code**, the annotated code, complexity
  and interview tips.
- A **practice deck** that guides the learner with questions and progressive hints instead of answers.

All paths below are relative to this skill's directory (the folder that contains this `SKILL.md`).
Call it `<skill>` in commands and replace it with the real absolute path.

## 1. Parse the command

`$ARGUMENTS` holds whatever followed `/dynamic-learning`.

| First word (any language) | Mode | What you do |
|---|---|---|
| *(a URL or statement directly)*, `explain`, `explicar`, `solve`, `resolver`, `explicar-solucion` | **explain** | Full solutions: brute force plus one or more optimized decks |
| `practice`, `practicar`, `pistas`, `hints`, `entrenar` | **practice** | Hint deck plus interactive coaching in chat. No solution is shown unless asked |
| `video` | **video** | Export existing deck(s) to MP4 (see `reference/video.md`) |
| `index`, `historial`, `history` | **index** | Regenerate `dynamic-learning/index.html` |
| `concept`, `concepto`, `learn`, `aprender` | **concept** | Experimental: explain a programming concept (`modules/concepts/MODULE.md`) |
| *(nothing)* | — | Ask what problem they want to work on and which mode |

Flags, which may also be said in natural language ("en Java", "in C++", "con video"):
- `--lang <language>` is the programming language of the solutions. If it is missing, read
  `dynamic-learning/config.json`. If there is no config either, ask once with AskUserQuestion
  (Python, JavaScript, Java, C++; "Other" stays free text). Then save
  `{"programmingLanguage": ..., "lang": ...}` to that config.
- `--video` exports every generated deck to MP4 at the end.
- `--out <dir>` sets the output root (default `./dynamic-learning`).

## 2. Language of everything you write

The **human language** is the one the user writes in. Detect it from their message, not from the problem
statement, which is usually English. Every slide, note, hint, quiz, code comment, chat message and
`spec.lang` (ISO code: `es`, `en`, `pt`, `fr`…) uses it. Keep code identifiers and the platform's function
signature as they are. Translate the statement faithfully; never invent constraints.

## 3. Output layout

```
dynamic-learning/
├── config.json                      # preferences (programming language, human language)
├── index.html                       # history grouped by module and difficulty
└── algorithms/
    └── easy | medium | hard/
        └── 0001-two-sum/            # <id padded to 4>-<slug>; other platforms: cf-1950a-<slug>, atc-abc300-a-<slug>
            ├── 00-practice.html     # practice mode
            ├── 01-brute-force.html
            ├── 02-optimal.html      # or 02-<technique>.html … 0N-optimal.html when there are several
            ├── meta.json            # written by build_deck.py, read by the index
            ├── video/               # only if requested
            └── src/                 # problem.json, solutions, tests, tracers, specs (to rebuild later)
```

Difficulty comes from the platform (LeetCode's own label; Codeforces rating <1300 easy, <1900 medium,
otherwise hard). If there is none, judge it yourself and say so. Re-running on the same problem updates
files in place and keeps the rest.

## 4. Modes

- **explain** and **practice** → follow `modules/algorithms/MODULE.md` step by step.
- **concept** → `modules/concepts/MODULE.md`.
- **video** → `reference/video.md`.
- **index** → `python3 <skill>/scripts/update_index.py dynamic-learning`.

## 5. Tools in this skill

| Script | Use |
|---|---|
| `scripts/fetch_problem.py URL -o src/problem.json` | Fetch and normalize the problem. LeetCode GraphQL, Codeforces, AtCoder, generic |
| `scripts/tracekit.py` | Python helpers to record animation frames **by running** a mirror of the algorithm |
| `scripts/build_deck.py SPEC.json OUT.html` | Validate a deck spec and inline the engine into one offline HTML file; updates `meta.json` |
| `scripts/snapshot.cjs DECK.html OUT_DIR` | PNG of every slide plus layout/JS warnings, for visual QA (needs Playwright) |
| `scripts/export_video.cjs DECK.html [OUT.mp4]` | Record autoplay mode to video (needs Playwright; ffmpeg for MP4) |
| `scripts/update_index.py ROOT` | Regenerate the history page |

The deck format is documented in `reference/deck-spec.md` and the diagram components in
`reference/visualizers.md`. `tests/viz-gallery.json` is a small spec that uses every component.

## 6. Non-negotiables

1. **Correct code.** Every solution shown is run against the examples, edge cases and a randomized
   cross-check against brute force before any deck is built. A wrong solution in an interview-prep tool
   is worse than none.
2. **Real traces.** Frames come from a tracekit script that executes the algorithm. Never hand-type
   frame state. Line numbers must point at the displayed listing.
3. **One visual style.** Never add CSS or change the theme per problem. The engine and `engine/theme.css`
   are the design system.
4. **Validate and look.** `build_deck.py` must pass with no errors. Run `snapshot.cjs`, fix every
   LAYOUT warning (shorten text, split slides, use a smaller example) and open the PNGs of the trace slides.
   If Playwright is not installed, say so and ask whether to install it (`npm i -g playwright && npx playwright install chromium`)
   rather than skipping QA silently.
5. **Interview focus.** Every solution deck shows how to recognize the pattern, the constraints → target
   complexity reasoning, edge cases, and how to talk through it out loud.

## 7. Final reply

Keep it short, in the user's language. Include:
- the folder and the files, as clickable paths;
- the detected pattern(s) and the complexity of each approach;
- how to use the decks: arrows or space step through the animation, `P` plays it, `F` is full screen,
  `?autoplay=1` plays everything;
- what was verified (tests run, snapshot QA) and anything that could not be verified.

In practice mode, the reply *is* the coaching conversation (see `modules/algorithms/practice.md`).
