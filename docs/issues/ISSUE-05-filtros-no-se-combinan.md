# ISSUE-05 · BUG-05

> Etiqueta: `alta` · Bug: [BUG-05](../bugs.md#bug-05)

**Título:** [Tareas] Los filtros del listado de tareas no se combinan
**Criterio violado:** US-07 c5: "Los filtros son combinables entre sí y se aplican todos simultáneamente"
**Entorno:** Windows 11 Pro · Node 22.23.5 · API Express + SQLite (Jest/Supertest, sin navegador) · TZ America/Montevideo (UTC-3) · commit `390b4bf` (rama `entrega-final`)
**Datos / precondiciones:** Proyecto con 3 tareas TODO/HIGH, 4 TODO/LOW y 1 DONE/HIGH.
**Pasos:** 1. `GET /api/projects/:id/tasks?status=TODO&priority=HIGH`.
**Esperado:** Las 3 tareas TODO/HIGH.
**Obtenido:** Las 4 HIGH, incluida la DONE: solo se aplica el último filtro.
**Reproducibilidad:** 3 de 3.
**Evidencia:** Respuesta 200 con `total: 4`.
**Test que lo reproduce:** server/tests/bugs.test.ts › BUG-05; server/tests/unit/task-filters.test.ts › [BUG-05]; tareas.integration.test.ts › los filtros se combinan entre sí
**Severidad:** alta
