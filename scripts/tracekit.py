"""tracekit: record animation frames by actually running the algorithm.

Write a tiny Python script that mirrors the solution, call `t.step(...)`
wherever the displayed code would be on a given line, then `t.save(...)`.
The line numbers refer to the code shown in the deck (whatever language
the learner chose), so keep the mirror in sync with that listing.

    import sys; sys.path.insert(0, "<skill>/scripts")
    from tracekit import Tracer, array, hashmap

    t = Tracer()
    seen = {}
    for i, num in enumerate(nums):
        t.step(4, f"Leemos `nums[{i}] = {num}`", vars={"i": i, "num": num},
               viz=[array("nums", nums, pointers={"i": i}, highlight=[i]), hashmap("seen", seen)])
        ...
    t.save("frames-optimal.json")

Components are plain dicts, so anything the engine supports can also be
passed directly. Values are deep-copied at every step.

Long algorithms: call `t.part("Construir el grafo")` before each phase. Each part
becomes its own trace slide ("part": 1, 2, ... in the deck spec, same framesFile);
the diagram state carries over from one part to the next.
"""
import copy
import json
from pathlib import Path


def _clean(d):
    return {k: v for k, v in d.items() if v is not None}


def array(name, values, pointers=None, highlight=None, seen=None, ok=None, bad=None, dim=None,
          window=None, label=None, classes=None, show_index=True):
    """Array or string with pointers (i, j, left, right, mid...) and an optional window [l, r]."""
    return _clean({"type": "string" if isinstance(values, str) else "array", "name": name,
                   "values": list(values) if not isinstance(values, str) else values,
                   "pointers": pointers, "highlight": highlight, "seen": seen, "ok": ok, "bad": bad,
                   "dim": dim, "window": list(window) if window else None, "label": label,
                   "classes": classes, "showIndex": None if show_index else False})


def hashmap(name, mapping, highlight=None, ok=None, bad=None, label=None):
    """dict / Counter / defaultdict. Keys are shown in insertion order."""
    return _clean({"type": "map", "name": name, "entries": [[k, v] for k, v in dict(mapping).items()],
                   "highlight": highlight, "ok": ok, "bad": bad, "label": label})


def hashset(name, values, highlight=None, ok=None, label=None):
    return _clean({"type": "set", "name": name, "values": list(values), "highlight": highlight, "ok": ok, "label": label})


def stack(name, items, highlight=None, ok=None, label=None):
    """Bottom -> top, left to right."""
    return _clean({"type": "stack", "name": name, "items": list(items), "highlight": highlight, "ok": ok, "label": label})


def queue(name, items, highlight=None, ok=None, label=None):
    """Front -> back, left to right."""
    return _clean({"type": "queue", "name": name, "items": list(items), "highlight": highlight, "ok": ok, "label": label})


def linkedlist(name, values=None, nodes=None, next=None, pointers=None, highlight=None, ok=None, seen=None,
               dim=None, edge_classes=None, label=None):
    """Either values=[1,2,3] (ids are indices) or nodes=[{id,val}] plus next={id: id|None}."""
    nodes = nodes if nodes is not None else [{"id": i, "val": v} for i, v in enumerate(values or [])]
    return _clean({"type": "linkedlist", "name": name, "nodes": nodes,
                   "next": {str(k): v for k, v in next.items()} if next is not None else None,
                   "pointers": pointers, "highlight": highlight, "ok": ok, "seen": seen, "dim": dim,
                   "edgeClasses": edge_classes, "label": label})


def tree(name, level=None, nodes=None, root=None, pointers=None, highlight=None, seen=None, ok=None, bad=None,
         dim=None, labels=None, edge_classes=None, label=None):
    """Binary tree from LeetCode level order (level=[3,9,20,None,None,15,7]; ids = positions in that list)
    or explicit nodes=[{id,val,left,right}] / n-ary nodes=[{id,val,children:[...]}]."""
    return _clean({"type": "tree", "name": name, "level": level, "nodes": nodes, "root": root,
                   "pointers": pointers, "highlight": highlight, "seen": seen, "ok": ok, "bad": bad, "dim": dim,
                   "labels": labels, "edgeClasses": edge_classes, "label": label})


def heap(name, values, highlight=None, ok=None, label=None):
    """Binary heap drawn as a tree (ids are array indices). Pair it with array() to show both views."""
    return _clean({"type": "heap", "name": name, "values": list(values), "highlight": highlight, "ok": ok, "label": label})


def graph(name, nodes, edges, directed=False, highlight=None, seen=None, ok=None, bad=None, dim=None,
          labels=None, edge_classes=None, pointers=None, label=None):
    """nodes: ids or {id,label,x,y} with x,y in 0..1 (omit for a circular layout).
    edges: [a, b] or [a, b, weight]. edge_classes: {"a-b": "hl"|"seen"|"ok"|"dim"}."""
    return _clean({"type": "graph", "name": name, "nodes": nodes, "edges": edges, "directed": directed or None,
                   "highlight": highlight, "seen": seen, "ok": ok, "bad": bad, "dim": dim, "labels": labels,
                   "edgeClasses": edge_classes, "pointers": pointers, "label": label})


def grid(name, rows, current=None, highlight=None, seen=None, ok=None, bad=None, dim=None, classes=None,
         row_labels=None, col_labels=None, label=None):
    """Matrix / DP table. Cell refs are [r, c]. classes: {"r,c": "wall"|...}."""
    return _clean({"type": "grid", "name": name, "rows": [list(r) for r in rows], "current": current,
                   "highlight": highlight, "seen": seen, "ok": ok, "bad": bad, "dim": dim, "classes": classes,
                   "rowLabels": row_labels, "colLabels": col_labels, "label": label})


def intervals(name, items, highlight=None, ok=None, seen=None, dim=None, lanes=True, lo=None, hi=None, label=None):
    return _clean({"type": "intervals", "name": name, "items": [list(x) for x in items], "highlight": highlight,
                   "ok": ok, "seen": seen, "dim": dim, "lanes": None if lanes else False, "min": lo, "max": hi,
                   "label": label})


def text(name, value, label=None):
    return _clean({"type": "text", "name": name, "value": value, "label": label})


class Tracer:
    def __init__(self, max_frames=40):
        self.frames = []
        self.max_frames = max_frames  # per part
        self._part = 0
        self._label = None
        self._in_part = 0

    def part(self, label):
        """Start a new phase; it becomes its own trace slide."""
        self._part += 1
        self._label = label
        self._in_part = 0

    def step(self, line, note, vars=None, viz=None, reset=False):
        """line: int or [int, ...] of the displayed listing (1-based)."""
        if self._in_part >= self.max_frames:
            raise RuntimeError(f"More than {self.max_frames} frames in one part: use a smaller example or split with t.part()")
        self._in_part += 1
        frame = {"line": line, "note": note}
        if self._part:
            frame["part"] = self._part
            if self._in_part == 1:
                frame["partLabel"] = self._label
        if vars:
            frame["vars"] = copy.deepcopy(vars)
        if viz:
            frame["viz"] = copy.deepcopy(viz)
        if reset:
            frame["reset"] = True
        self.frames.append(frame)
        return frame

    def save(self, path):
        Path(path).write_text(json.dumps(self.frames, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{len(self.frames)} frames -> {path}")
