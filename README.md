# Dynamic Learning

Skill de Claude Code para **preparar entrevistas técnicas**. Le pasas un link de LeetCode (o de
Codeforces, AtCoder o HackerRank, o el enunciado pegado) y genera presentaciones HTML animadas
que explican el problema paso a paso. Mientras el diagrama se mueve, se resalta la línea de código
que se está ejecutando.

```
/dynamic-learning https://leetcode.com/problems/two-sum/
/dynamic-learning practicar https://leetcode.com/problems/two-sum/ --lang java
```

## Qué genera

Una carpeta por ejercicio, separada por dificultad:

```
dynamic-learning/
├── index.html                    ← tu historial, agrupado por dificultad
└── algorithms/easy/0001-two-sum/
    ├── 00-practice.html          ← modo pistas: preguntas, pistas progresivas, esqueleto
    ├── 01-brute-force.html       ← solución de fuerza bruta
    ├── 02-optimal.html           ← solución optimizada (puede haber 02, 03, …)
    ├── video/                    ← opcional: MP4 de cada explicación
    └── src/                      ← soluciones probadas, tracers y specs
```

Cada presentación de solución incluye:

- el problema en palabras simples;
- ejemplos;
- una diapositiva de **restricciones**, con lo que permite cada una y qué complejidad necesitas;
- preguntas para hacerle al entrevistador;
- cómo reconocer el patrón;
- la **animación paso a paso**, con el código resaltado línea por línea;
- el código anotado, la complejidad y una comparación entre enfoques;
- cómo contarlo en la entrevista, un quiz y problemas relacionados.

## Comandos

| Comando | Qué hace |
|---|---|
| `/dynamic-learning <link>` o `/dynamic-learning explicar <link>` | Soluciones completas: fuerza bruta y una o más optimizadas |
| `/dynamic-learning practicar <link>` | Te guía con preguntas y pistas sin darte la respuesta, y revisa tu código |
| `/dynamic-learning video <carpeta o .html>` | Exporta las explicaciones a MP4 |
| `/dynamic-learning historial` | Regenera `index.html` |
| `/dynamic-learning concepto <tema>` | *(experimental)* explica un concepto (recursión, hash tables…) |

Opciones: `--lang <lenguaje>` (Python, Java, C++, JavaScript, Go…). También vale decirlo en frase,
como "en Java". Si no lo indicas, te pregunta una vez y lo recuerda. `--video` exporta al terminar.

Todo se genera **en el idioma en que le escribes**.

## Instalación

```bash
git clone https://github.com/DanieelRC/dynamic-learning-skill ~/.claude/skills/dynamic-learning
```

Reinicia Claude Code y escribe `/dynamic-learning`. Para instalarla en un solo proyecto, clónala en
`.claude/skills/dynamic-learning` dentro del proyecto.

**Requisitos**

| | Para qué | ¿Obligatorio? |
|---|---|---|
| Python 3.9+ | descargar el problema, construir los decks, tests | sí |
| Node 18+ con [Playwright](https://playwright.dev) (`npm i -g playwright && npx playwright install chromium`) | revisión visual automática y video | recomendado |
| ffmpeg | video en MP4 (sin él queda en WebM) | solo para video |

Las presentaciones son **un solo archivo HTML sin dependencias**: funcionan sin conexión. Solo cargan
fuentes de Google Fonts y, si no hay internet, usan las del sistema.

## Controles de las presentaciones

`→` / `espacio` para avanzar (dentro de una animación avanza paso a paso) · `←` para regresar ·
`P` para reproducir la animación · `F` para pantalla completa · `?autoplay=1` para que se presente sola.

## Cómo funciona por dentro

```
SKILL.md                      instrucciones de la skill (router de comandos)
modules/algorithms/           flujo de problemas: intake, patrones → diagramas, estructura de slides, modo práctica
modules/concepts/             módulo de conceptos (experimental, para crecer)
reference/                    formato del deck, visualizadores, video
engine/                       motor: tema único, navegación, reproductor y visualizadores (JS/CSS puros)
scripts/
  fetch_problem.py            LeetCode (GraphQL oficial), Codeforces, AtCoder y genérico
  tracekit.py                 graba los frames ejecutando el algoritmo de verdad
  build_deck.py               valida el spec JSON y genera el HTML autocontenido
  snapshot.cjs                capturas de cada slide y avisos de layout (QA visual)
  export_video.cjs            graba el autoplay a 1920×1080
  update_index.py             historial por dificultad
```

Reglas que sigue la skill:

1. Las soluciones **se ejecutan contra tests**: ejemplos, casos borde y verificación aleatoria contra la fuerza bruta.
2. Los diagramas **salen de ejecutar** el algoritmo, no se escriben a mano.
3. Usa **un solo estilo visual**, igual para todos los problemas.
4. Revisa las capturas antes de entregarte nada.

Visualizadores disponibles: arrays/strings con punteros y ventanas, hash maps/sets, pilas, colas,
listas enlazadas, árboles (orden de LeetCode), heaps, tries, grafos (dirigidos y con pesos),
matrices/tablas DP e intervalos.

## Desarrollo

```bash
python3 -m unittest discover -s tests          # tests de fetch y build
python3 scripts/build_deck.py tests/viz-gallery.json /tmp/gallery.html --no-meta
node scripts/snapshot.cjs /tmp/gallery.html /tmp/shots
python3 tests/split-trace/trace.py && python3 scripts/build_deck.py tests/split-trace/spec.json /tmp/split.html --no-meta   # traza dividida en partes
```

## Créditos

El escenario 16:9 y el patrón del controlador de slides están adaptados de
[frontend-slides](https://github.com/zarazhangrui/frontend-slides) de Zara Zhang (MIT). Ver
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Licencia: MIT.
