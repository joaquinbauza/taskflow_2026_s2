# ISSUE-08 · BUG-10

> Etiqueta: `media` · Bug: [BUG-10](../bugs.md#bug-10)

**Título:** [Tareas] La búsqueda por texto distingue mayúsculas de minúsculas
**Criterio violado:** US-07 c4: "La búsqueda por texto busca en título y descripción, sin distinguir mayúsculas de minúsculas"
**Entorno:** Windows 11 Pro · Node 22.23.5 · API Express + SQLite (Jest/Supertest, sin navegador) · TZ America/Montevideo (UTC-3) · commit `390b4bf` (rama `entrega-final`)
**Datos / precondiciones:** Tarea "Implementar Login".
**Pasos:** 1. `GET /api/projects/:id/tasks?search=login`.
**Esperado:** Se devuelve la tarea.
**Obtenido:** Lista vacía.
**Reproducibilidad:** 3 de 3.
**Evidencia:** Respuesta 200 con `items: []`.
**Test que lo reproduce:** server/tests/bugs.test.ts › BUG-10; tareas.integration.test.ts › la búsqueda no distingue mayúsculas de minúsculas
**Severidad:** media
