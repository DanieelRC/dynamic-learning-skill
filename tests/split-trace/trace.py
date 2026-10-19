"""Frames in two parts (tracekit t.part). Line numbers are those of solution.py."""
import sys
from collections import deque
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from tracekit import Tracer, array, graph, queue  # noqa: E402

n, prereq = 4, [[1, 0], [2, 0], [3, 1], [3, 2]]
nodes = [{"id": 0, "x": 0, "y": 0.5}, {"id": 1, "x": 0.5, "y": 0}, {"id": 2, "x": 0.5, "y": 1}, {"id": 3, "x": 1, "y": 0.5}]
t = Tracer()
adj = [[] for _ in range(n)]
indeg = [0] * n
edges = []

t.part("Construir el grafo")
t.step([4, 5], "Un grafo vacío y `indegree` en ceros: cuántos requisitos le faltan a cada curso.",
       viz=[graph("cursos", nodes, [], directed=True), array("indegree", indeg)])
for course, pre in prereq:
    adj[pre].append(course)
    indeg[course] += 1
    edges.append([pre, course])
    t.step([7, 8], f"`{pre} → {course}`: para tomar {course} primero hay que tomar {pre}. Sube `indegree[{course}]`.",
           vars={"course": course, "pre": pre},
           viz=[graph("cursos", nodes, list(edges), directed=True, highlight=[course], edge_classes={f"{pre}-{course}": "hl"}),
                array("indegree", indeg, highlight=[course])])

t.part("BFS por capas (Kahn)")
q = deque(i for i in range(n) if indeg[i] == 0)
taken = 0
done = []
t.step(11, f"A la cola entran los cursos sin requisitos: `{list(q)}`.", vars={"taken": 0},
       viz=[graph("cursos", nodes, list(edges), directed=True, highlight=list(q)), array("indegree", indeg, ok=list(q)), queue("queue", list(q))])
while q:
    node = q.popleft()
    taken += 1
    done.append(node)
    t.step([14, 15], f"Tomamos el curso `{node}` (`taken = {taken}`).", vars={"node": node, "taken": taken},
           viz=[graph("cursos", nodes, list(edges), directed=True, highlight=[node], seen=done[:-1]),
                array("indegree", indeg), queue("queue", list(q))])
    for nxt in adj[node]:
        indeg[nxt] -= 1
        free = indeg[nxt] == 0
        if free:
            q.append(nxt)
        t.step([17, 18, 19] if free else 17,
               f"Quitamos el requisito `{node} → {nxt}`: `indegree[{nxt}] = {indeg[nxt]}`." + (" ¡Libre! Entra a la cola." if free else ""),
               vars={"nxt": nxt},
               viz=[graph("cursos", nodes, list(edges), directed=True, highlight=[nxt], seen=done, edge_classes={f"{node}-{nxt}": "seen"}),
                    array("indegree", indeg, ok=[nxt] if free else None, highlight=None if free else [nxt]), queue("queue", list(q))])
t.step(22, f"`taken = {taken} == {n}`: se pueden tomar todos, no hay ciclo → `True`.", vars={"resultado": taken == n},
       viz=[graph("cursos", nodes, list(edges), directed=True, ok=done), array("indegree", indeg, ok=list(range(n))), queue("queue", [])])
t.save(Path(__file__).with_name("frames.json"))
