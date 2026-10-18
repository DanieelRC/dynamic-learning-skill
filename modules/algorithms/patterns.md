# Patterns → diagrams

## From constraints to a target complexity (about 10^8 simple operations per second)

| Largest n | Target | Typical techniques |
|---|---|---|
| n ≤ 10–12 | O(n!), O(2^n · n) | permutations, backtracking |
| n ≤ 20–25 | O(2^n) | subsets, bitmask DP, meet in the middle |
| n ≤ 100–500 | O(n^3) | Floyd–Warshall, interval DP |
| n ≤ 10^3–5·10^3 | O(n^2) | 2-D DP, all pairs |
| n ≤ 10^5–10^6 | O(n log n) or O(n) | sorting, heap, binary search, two pointers, hashing, prefix sums, greedy |
| n ≥ 10^9 or a huge value range | O(log n) or O(1) | binary search on the answer, math, bit tricks |

Put this reasoning on the **constraints** slide. `ops` bars make it visible: give the estimated
operation count of each approach at the maximum n.

## Catalog

For each pattern: **signals** (how to recognize it in an interview), the **components** to animate
and **what moves** from frame to frame. Component types are documented in `reference/visualizers.md`.

| Pattern (`meta.patterns` id) | Signals | Components | What moves |
|---|---|---|---|
| Arrays & hashing (`arrays-hashing`) | "find a pair / duplicate / count", "anagram", O(1) lookup needed | `array` + `map` / `set` | pointer `i`; map entries appear; the hit turns `ok` |
| Two pointers (`two-pointers`) | sorted input, pairs/triplets, palindrome, "in place" | `array` with `L`/`R` pointers | pointers move toward each other; discarded side turns `dim` |
| Sliding window (`sliding-window`) | contiguous subarray/substring, "longest/shortest with ≤ k" | `array`/`string` with `window` + `map` (counts) | window grows right, shrinks left; counts update |
| Prefix sums (`prefix-sum`) | many range-sum queries, "subarray sum equals k" | two `array`s (nums, prefix) + `map` | prefix fills in; the range highlights as prefix[r]−prefix[l] |
| Binary search (`binary-search`) | sorted / monotonic predicate, "minimum x such that", log n | `array` with `lo`, `mid`, `hi` | eliminated halves turn `dim`; mid jumps |
| Stack (`stack`) | matching brackets, "next greater", undo, evaluate expression | `array`/`string` + `stack` | push/pop; matched items `ok` |
| Monotonic stack/queue (`monotonic-stack`) | next greater/smaller, sliding-window max | `array` + `stack`/`queue` of indices | items pop while the invariant breaks |
| Linked list (`linked-list`) | reverse, merge, cycle, k-th from end | `linkedlist` with `prev`/`curr`/`next` or `slow`/`fast` | `next` arrows re-point (use `next` map); pointers hop |
| Trees: DFS (`tree-dfs`) | depth, path sum, validate BST, LCA | `tree` + `callstack` | current node `highlight`, finished `seen`, return values in `labels` |
| Trees: BFS (`tree-bfs`) | level order, right view, min depth | `tree` + `queue` | the queue drains one level at a time; the level becomes `seen` |
| Heap / top-k (`heap`) | "k largest/smallest", merge k lists, scheduling, median stream | `heap` + `array` (heap array) | sift up/down swaps |
| Graphs: BFS/DFS (`graph-traversal`) | islands, connected components, shortest path unweighted | `graph` or `grid` + `queue`/`stack` + `set` visited | frontier `highlight`, visited `seen` |
| Topological sort (`topo-sort`) | prerequisites, ordering with dependencies, cycle in DAG | `graph` (directed) + `map` indegree + `queue` | indegree drops; nodes leave the queue into the result |
| Shortest paths (`shortest-path`) | weighted edges, Dijkstra / Bellman-Ford | `graph` with weights + `map` dist + `heap` | edge relax `hl`, dist labels update |
| Union-find (`union-find`) | "are connected", merging groups, redundant edge | `array` parent + `graph` forest | parent pointers change; roots `ok` |
| Backtracking (`backtracking`) | all combinations/permutations/subsets, n ≤ 20 | `tree` (decision tree, n-ary `children`) + `array` path | explore `highlight`, pruned `bad`/`dim`, solutions `ok` |
| 1-D DP (`dp-1d`) | "number of ways", "min cost", choices at each step, overlapping subproblems | `array` dp (+ input `array`) | dp[i] fills; the cells it depends on turn `seen` |
| 2-D DP (`dp-2d`) | two strings/sequences, grid paths, knapsack | `grid` dp with `rowLabels`/`colLabels` | `current` cell; dependency cells `seen` |
| Greedy (`greedy`) | local choice provably optimal, sort-then-scan, jump game | `array` / `intervals` | the chosen element `ok`, skipped ones `dim` |
| Intervals (`intervals`) | merge/insert intervals, meeting rooms, overlaps | `intervals` (+ `heap`) | merged result grows; the overlap `hl` |
| Matrix (`matrix`) | rotate, spiral, set zeroes, search 2-D | `grid` | traversal order `seen`, current `current` |
| Bit manipulation (`bits`) | XOR tricks, single number, subsets as masks, power of two | `bits` (string of 0/1) + `vars` | bits flip; result builds up |
| Trie (`trie`) | prefix search, word dictionary, autocomplete | `tree` with n-ary `children` (val = char) | path down the trie `highlight`; word ends `ok` |
| Math / simulation (`math`) | digits, modular arithmetic, step-by-step rules | `array` / `text` / `vars` | values update |

### Choosing well

- Show **at most 3 components** per frame. Anything else goes in `vars` (chips under the diagram).
- Recursion: show the call stack as `callstack` (items like `dfs(3)`) next to the tree. For memoization,
  show the `map` cache filling up.
- Brute force usually uses the same components as the optimal solution, so the waste is visible
  (for example the many pairs it checks).
- If no catalog entry fits, combine `array` + `text` + `vars`. The diagram must still show the mechanism.

## Interview framing for each pattern

On the `pattern` slide, list 2–4 **signals** from the statement that point at the pattern, and give
the 3–6 line **template** of the technique as `code`. In `related`, name 3–4 problems that use the
same pattern, with at least one harder variant.
