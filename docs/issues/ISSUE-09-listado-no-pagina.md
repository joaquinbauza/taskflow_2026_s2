# ISSUE-09 · BUG-11

> Etiqueta: `alta` · Bug: [BUG-11](../bugs.md#bug-11)

**Título:** [Tareas] El listado de tareas no pagina (devuelve todas)
**Criterio violado:** US-07 c7: "El listado se devuelve paginado: 20 tareas por página por defecto, configurable con limit y offset, con un limit máximo de 100"
**Entorno:** Windows 11 Pro · Node 22.23.5 · API Express + SQLite (Jest/Supertest, sin navegador) · TZ America/Montevideo (UTC-3) · commit `390b4bf` (rama `entrega-final`)
**Datos / precondiciones:** Proyecto con 25 tareas.
**Pasos:** 1. `GET /api/projects/:id/tasks`. 2. `GET /api/projects/:id/tasks?limit=5&offset=20`.
**Esperado:** 20 tareas con `total: 25`; luego las tareas 21 a 25.
**Obtenido:** Siempre las 25 tareas.
**Reproducibilidad:** 3 de 3.
**Evidencia:** Ver también docs/performance.md (5.000 tareas en una sola respuesta).
**Test que lo reproduce:** server/tests/bugs.test.ts › BUG-11 (2); tareas.integration.test.ts › el listado viene paginado…
**Severidad:** alta
