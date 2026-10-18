# Visualizer components

Used in `diagram.viz` and `trace.frames[].viz`. Each component is an object with a `type` and a
`name`. `name` is the panel caption (override with `label`) and the identity used to animate
between frames. `scripts/tracekit.py` has one constructor per type with the same fields.

## Common state fields

| field | meaning | color |
|---|---|---|
| `highlight` | what the algorithm looks at **now** | amber |
| `seen` | already processed or visited | cyan |
| `ok` | found, accepted, part of the answer | green |
| `bad` | checked and rejected | red |
| `dim` | discarded for good | faded |
| `classes` | `{key: "hl" \| "seen" \| "ok" \| "bad" \| "dim" \| "wall"}` per element | — |
| `pointers` | `{label: index-or-id}`; `null` hides it | each label keeps its own color |

Keys are indices for arrays, keys for maps, node ids for trees and graphs, and `[r, c]` for grids.

## Types

| type | data fields | extras |
|---|---|---|
| `array` (`list`) | `values: []` | `window: [l, r]`, `showIndex: false`, `cellSize` |
| `string` (`bits`) | `values: "abc"` (or `value`) | same as array, one cell per char |
| `map` (`dict`, `hashmap`, `counter`) | `entries: [[k, v], ...]` or `{k: v}` | new keys pop in |
| `set` | `values: []` | |
| `stack` (`callstack`) | `items: []` bottom → top | only pushed items animate |
| `queue` (`deque`) | `items: []` front → back | detects pops from the front |
| `linkedlist` | `nodes: [{id, val}]` in display order, `next: {id: id \| null}` | omit `next` for a plain chain; `edgeClasses: {"a-b": "ok"}` |
| `tree` | `level: [3, 9, 20, null, null, 15, 7]` (LeetCode order, ids = positions) **or** `nodes: [{id, val, left, right}]` / `{id, val, children: []}` | `root`, `labels: {id: "h=2"}`, `edgeClasses` |
| `heap` | `values: []` (drawn as a tree, ids = indices) | pair it with an `array` for the array view |
| `trie` | like `tree` with `children` | |
| `graph` | `nodes: [id \| {id, label, x, y}]` (x, y in 0..1; omit for a circle), `edges: [[a, b] \| [a, b, w]]` | `directed`, `labels` (e.g. distances), `edgeClasses: {"a-b": "hl"}` |
| `grid` (`matrix`, `dp`, `table`) | `rows: [[...], ...]` | `current: [r, c]`, `rowLabels`, `colLabels`, `classes: {"r,c": "wall"}` |
| `intervals` | `items: [[s, e], ...]` or `[{s, e, label}]` | `lanes: false` puts them on one line; `min` / `max` |
| `text` | `value` (inline markdown) | a formula, the current result, a one-line explanation |

## Layout rules

- The diagram area is about 780 px wide. Arrays stay readable up to about 14 cells and grids up to about
  10 × 10. Use smaller examples instead of shrinking.
- At most 3 components per frame. Compact panels (array, map, stack, queue, text) take their natural
  height; drawings (tree, graph, grid, list) share the rest.
- Keep every component in every frame (or rely on carry-over), so the layout does not jump.
- `snapshot.cjs` reports `viz card (clipped)` when components do not fit. Remove one, or split the slide.
