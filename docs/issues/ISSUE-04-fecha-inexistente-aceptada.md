# ISSUE-04 · BUG-04

> Etiqueta: `media` · Bug: [BUG-04](../bugs.md#bug-04)

**Título:** [Tareas] Se aceptan fechas de vencimiento inexistentes (2026-02-30)
**Criterio violado:** US-16 c6: "Una fecha con formato inválido devuelve HTTP 400"
**Entorno:** Windows 11 Pro · Node 22.23.5 · API Express + SQLite (Jest/Supertest, sin navegador) · TZ America/Montevideo (UTC-3) · commit `390b4bf` (rama `entrega-final`)
**Datos / precondiciones:** Owner con una tarea.
**Pasos:** 1. `PATCH /api/tasks/:id` con `{ "dueDate": "2026-02-30" }`.
**Esperado:** HTTP 400.
**Obtenido:** HTTP 200 y se guarda el 2 de marzo (1 de marzo en UTC-3).
**Reproducibilidad:** 3 de 3 · todos los entornos (desde la UI no se puede cargar: el input nativo la sanea).
**Evidencia:** Respuesta 200.
**Test que lo reproduce:** server/tests/unit/ids.test.ts › [BUG-04]
**Severidad:** media
