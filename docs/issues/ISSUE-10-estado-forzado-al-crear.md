# ISSUE-10 · BUG-12

> Etiqueta: `alta` · Bug: [BUG-12](../bugs.md#bug-12)

**Título:** [Tareas] Al crear una tarea se puede forzar el estado (asignación masiva)
**Criterio violado:** US-05 c3: "El estado inicial de toda tarea es siempre TODO, aunque la solicitud incluya otro estado"
**Entorno:** Windows 11 Pro · Node 22.23.5 · API Express + SQLite (Jest/Supertest, sin navegador) · TZ America/Montevideo (UTC-3) · commit `390b4bf` (rama `entrega-final`)
**Datos / precondiciones:** Owner con un proyecto.
**Pasos:** 1. `POST /api/projects/:id/tasks` con `{ "title": "Nueva tarea", "status": "DONE" }`.
**Esperado:** 201 con `status: "TODO"`.
**Obtenido:** 201 con `status: "DONE"`.
**Reproducibilidad:** 3 de 3.
**Evidencia:** Respuesta 201.
**Test que lo reproduce:** server/tests/bugs.test.ts › BUG-12; tareas.integration.test.ts › el estado inicial es TODO…
**Severidad:** alta
