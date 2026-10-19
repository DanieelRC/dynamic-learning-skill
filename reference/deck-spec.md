# Deck spec reference

A deck is one JSON file. `scripts/build_deck.py` validates it and inlines the engine, producing a
single offline HTML file.

```json
{
  "lang": "es",
  "ui": { "step": "Paso" },
  "meta": {
    "module": "algorithms",
    "kind": "solution | practice",
    "order": 1,
    "approach": "Hash map en una pasada",
    "language": "python",
    "time": "O(n)", "space": "O(n)",
    "patterns": ["arrays-hashing"],
    "problem": { "platform": "LeetCode", "id": "1", "title": "Two Sum", "slug": "two-sum",
                 "difficulty": "Easy", "tags": ["Array"], "url": "https://leetcode.com/problems/two-sum/" }
  },
  "slides": [ { "type": "title" }, ... ]
}
```

- `lang` selects the built-in UI labels (`es`, `en`, `pt`, `fr`). For any other language, supply
  every label in `ui`; the keys are in `engine/core.js` → `I18N.en`.
- `meta` drives the footer, the title slide defaults, `meta.json` and the history index.
- Every slide accepts `eyebrow` (small label above the title; there is a sensible default per type)
  and `title`.

## Inline text format

All text fields accept: `` `code` ``, `**bold**`, `*em*` (cyan), `==mark==`, `[link](https://…)`,
`10^4` → 10⁴ (exponents glued to the base), and `\n` for line breaks.

## Slide types

| type | fields | notes |
|---|---|---|
| `title` | `subtitle`, `approach`, `badges[]`, `number` | defaults come from `meta.problem` |
| `statement` | `body`, `points[]`, `signature` (code), `callout` | |
| `examples` | `examples[{input, output, explanation}]`, `callout`, `stacked` | long inputs stack automatically |
| `constraints` | `items[{rule, insight}]`, `ops[{label, value, note}]`, `takeaway` | `value` = estimated operations at max n; the bar turns red above 10⁸ |
| `bullets` / `idea` / `intuition` / `pattern` / `interview` | `lead`, `items[]`, `numbered`, `code` *or* `aside` (callout), `callout` | `code`/`aside` opens a right-hand column |
| `diagram` | `viz[components]`, `lead`, `caption` | one static picture; see `visualizers.md` |
| `trace` | `source` *or* `sourceFile`, `language`, `frames` *or* `framesFile` | the animated walk: code on the left, diagram on the right, narration at the bottom |
| `code` | `source` *or* `sourceFile`, `language`, `notes[{lines: [a, b] \| n, text}]`, `spoiler` | arrows step through the notes and highlight their lines; `spoiler` blurs until revealed |
| `complexity` | `time`, `space`, `timeWhy`, `spaceWhy`, `ops`, `callout` | |
| `compare` | `rows[{approach, time, space, note, current}]`, `callout` | |
| `quiz` | `question`, `options[]`, `answer` (0-based index), `explanation` | click an option, or press → to reveal |
| `hints` | `intro`, `hints[{title, body}]` | each → reveals the next hint |
| `checkpoint` / `next` | `body`, `checklist[]`, `links[{label, href}]`, `callout` | checklist items toggle on click |
| `related` | `items[{title, url, difficulty, pattern, why}]` | |
| `summary` | `items[]`, `takeaway`, `links[]` | |

`callout` everywhere is either a string or `{icon, text, tone}`, where `tone` is `accent | info | ok | bad`.

## Trace frames

```json
{ "line": 5,
  "note": "Para llegar a 6 nos falta `need = 6 - 3 = 3`.",
  "vars": { "i": 0, "need": 3 },
  "viz": [ { "type": "array", "name": "nums", "values": [3,2,4], "pointers": {"i": 0}, "highlight": [0] } ] }
```

- `line` is an int or a list of ints, 1-based, in the displayed source. The active line is highlighted
  and the previous one is softly marked.
- Components **carry over** from the previous frame by `name` + `type`. A frame only needs the
  components that changed. `{"name": "x", "type": "map", "remove": true}` drops one, and
  `"reset": true` starts from an empty diagram.
- `vars` merge into the previous frame's vars (chips that changed glow); `"resetVars": true` replaces them.
- Recommended: generate frames with `scripts/tracekit.py` (`framesFile`), not by hand.
- Limits: up to 32 code lines and 40 frames per trace (the validator warns earlier).

## Fitting on screen

Everything is laid out on a fixed 1920×1080 stage. When text does not fit, the engine protects the slide:
- code notes shrink, then the inactive ones collapse to one line, and the active note is always kept in view;
- open hints collapse except the newest one;
- any other slide scales its content down to 70% at most.

Each of these sets an `auto-fit` LAYOUT warning in `snapshot.cjs`. Treat that as a bug in the spec and
shorten the text. Budgets: code notes ≤ 5 × 100 characters, bullets ≤ 5 × 90, hints ≤ 5 × 140.
`build_deck.py` warns about long notes before you even build.

## Viewer controls

→ / space / Enter: next step or slide · ← back · `P` play or pause the trace · `F` full screen ·
Home / End · swipe on touch screens. `#5` in the URL opens slide 5. `?autoplay=1&speed=1.25` plays
the whole deck by itself (this is what the video export uses).
