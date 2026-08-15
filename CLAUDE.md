# Cómo trabajar en este proyecto

## Principios de trabajo

El orden importa. Cuando dos reglas choquen, gana la de más arriba:

1. Corrección
2. Verificación
3. Cambios mínimos
4. Claridad
5. Mantenibilidad

### Comprobar la realidad primero

- No dar por supuesto el estado del sistema de archivos, ni que existan APIs, esquemas o
  dependencias.
- Leer los archivos antes de editarlos.
- Distinguir lo observado de lo supuesto, y decir en voz alta lo que no se sabe.

### Corrección antes que terminar

- No dar algo por bueno sin haberlo verificado.
- Verificar el comportamiento ejecutando, probando o inspeccionando directamente.
- Preferir la evidencia reproducible a la afirmación confiada.

### Cambios acotados

- Ceñirse a lo que se ha pedido.
- No refactorizar código ajeno a la tarea ni reescribir lo que ya funciona sin motivo.
- Nada de cambios arquitectónicos amplios si no se han pedido explícitamente.

### Preferir lo simple

- La solución más simple que resuelva bien el problema.
- Sin abstracciones especulativas ni funcionalidad de más.

---

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

Este proyecto tiene un grafo de conocimiento del código (`.code-review-graph/graph.db`,
fuera del repositorio, se reconstruye con `scripts/grafo.sh build`). Para algunas
preguntas es más barato que leer archivos: da contexto estructural —quién llama a qué,
qué depende de qué— sin cargar el código entero.

No sustituye a Grep/Glob/Read. Úsalo donde gana, y lee los archivos donde no.

### Dónde gana

- **Revisar cambios**: `detect_changes_tool` + `get_review_context_tool`. Es su mejor
  caso: en un commit real, 2.328 tokens de contexto completo frente a 70 con el grafo.
- **Radio de impacto**: `get_impact_radius_tool` en vez de rastrear imports a mano.
- **Relaciones dentro de `src/`**: `query_graph_tool` con `callers_of`, `callees_of`,
  `importers_of`.
- **Estructura general**: `get_architecture_overview_tool`, `list_communities_tool`.

### Dónde no es fiable en este repositorio

Medido el 15 de agosto de 2026 con la versión 2.3.7.

- **`pruebas/` no está en el grafo.** El parser no reconoce la extensión `.mts`, así que
  las dos suites (`pruebas/limite-medico.mts`, `pruebas/lectura.mts`) son invisibles.
  **`tests_for` devuelve 0 para todo**, incluido `src/lib/devolucion/lectura.ts`, que sí
  está probado a fondo. Para saber qué hay cubierto, lee `pruebas/` y `package.json`.
- **`dead-code` da falsos positivos en masa.** Marca como muertas las tablas de las
  migraciones SQL, los `export default` de las páginas de Next.js, los handlers `GET` de
  las rutas y los server actions: no modela que ahí quien llama es el framework.
- **El proyecto es pequeño** (60 archivos). Para explorar, un Grep suele salir igual de
  barato y no arrastra estos huecos.

### Mantenimiento

- `scripts/grafo.sh` resuelve el binario por `CRG_BIN`, PATH, venvs habituales o `uvx`.
  Los hooks de `.claude/settings.json` y el pre-commit pasan por él.
- El grafo se actualiza solo al editar archivos y antes de cada commit.
- El `cwd` de `.mcp.json` es una ruta absoluta del contenedor donde se instaló. En otra
  máquina hay que volver a correr `code-review-graph install`.
- Ese mismo comando reinyecta su versión de este archivo. Si se vuelve a ejecutar,
  revisar que estas advertencias sigan aquí.
