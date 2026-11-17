# ISSUE-06 · BUG-08

> Etiqueta: `alta` · Bug: [BUG-08](../bugs.md#bug-08)

**Título:** [Miembros] Al quitar un miembro sus tareas siguen asignadas a él
**Criterio violado:** US-11 c6: "Al quitar un miembro, las tareas que tenía asignadas quedan sin asignado"
**Entorno:** Windows 11 Pro · Node 22.23.5 · API Express + SQLite (Jest/Supertest, sin navegador) · TZ America/Montevideo (UTC-3) · commit `390b4bf` (rama `entrega-final`)
**Datos / precondiciones:** Bob miembro del proyecto con una tarea asignada.
**Pasos:** 1. El owner hace `DELETE /api/projects/:id/members/<bob>`. 2. `GET /api/tasks/:id`.
**Esperado:** `assigneeId: null`.
**Obtenido:** `assigneeId` sigue siendo Bob.
**Reproducibilidad:** 3 de 3.
**Evidencia:** Respuesta del GET con `assigneeId: "user-N"`.
**Test que lo reproduce:** server/tests/bugs.test.ts › BUG-08 › la tarea del miembro quitado queda sin asignado; proyectos.integration.test.ts › al quitar un miembro sus tareas quedan sin asignado
**Severidad:** alta
