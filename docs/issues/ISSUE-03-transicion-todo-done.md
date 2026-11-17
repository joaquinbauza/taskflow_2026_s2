# ISSUE-03 · BUG-01

> Etiqueta: `alta` · Bug: [BUG-01](../bugs.md#bug-01)

**Título:** [Tareas] Se permite pasar una tarea de TODO directamente a DONE
**Criterio violado:** US-06 c2: "NO está permitido ir de TODO directamente a DONE"
**Entorno:** Windows 11 Pro · Node 22.23.5 · API Express + SQLite (Jest/Supertest, sin navegador) · TZ America/Montevideo (UTC-3) · commit `390b4bf` (rama `entrega-final`)
**Datos / precondiciones:** Owner con una tarea en TODO.
**Pasos:** 1. `PATCH /api/tasks/:id` con `{ "status": "DONE" }`.
**Esperado:** HTTP 422 `INVALID_TRANSITION`.
**Obtenido:** HTTP 200 y la tarea queda en DONE.
**Reproducibilidad:** 3 de 3 · todos los entornos.
**Evidencia:** Respuesta 200 con `status: "DONE"`.
**Test que lo reproduce:** server/tests/unit/transitions.test.ts › [BUG-01]; server/tests/tareas.integration.test.ts › no permite ir de TODO directamente a DONE (422)
**Severidad:** alta
