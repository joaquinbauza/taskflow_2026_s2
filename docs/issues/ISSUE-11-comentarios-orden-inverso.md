# ISSUE-11 · BUG-13

> Etiqueta: `media` · Bug: [BUG-13](../bugs.md#bug-13)

**Título:** [Comentarios] Los comentarios se devuelven del más nuevo al más viejo
**Criterio violado:** US-08 c4: "Los comentarios se devuelven ordenados por fecha ascendente, del más antiguo al más reciente"
**Entorno:** Windows 11 Pro · Node 22.23.5 · API Express + SQLite (Jest/Supertest, sin navegador) · TZ America/Montevideo (UTC-3) · commit `390b4bf` (rama `entrega-final`)
**Datos / precondiciones:** Tarea con comentarios "Primero", "Segundo", "Tercero".
**Pasos:** 1. `GET /api/tasks/:id/comments`.
**Esperado:** Primero, Segundo, Tercero.
**Obtenido:** Tercero, Segundo, Primero.
**Reproducibilidad:** 3 de 3.
**Evidencia:** Respuesta 200.
**Test que lo reproduce:** server/tests/bugs.test.ts › BUG-13; comentarios.integration.test.ts › los comentarios se devuelven del más antiguo al más reciente
**Severidad:** media
