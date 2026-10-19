class Solution:
    def canFinish(self, numCourses: int, prerequisites: List[List[int]]) -> bool:
        # Fase 1: grafo y grados de entrada
        graph = [[] for _ in range(numCourses)]
        indegree = [0] * numCourses
        for course, pre in prerequisites:
            graph[pre].append(course)
            indegree[course] += 1

        # Fase 2: BFS desde los cursos sin requisitos
        queue = deque(i for i in range(numCourses) if indegree[i] == 0)
        taken = 0
        while queue:
            node = queue.popleft()
            taken += 1
            for nxt in graph[node]:
                indegree[nxt] -= 1
                if indegree[nxt] == 0:
                    queue.append(nxt)

        # Si tomamos todos, no hay ciclo
        return taken == numCourses
