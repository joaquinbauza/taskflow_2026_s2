# ISSUE-07 · BUG-09

> Etiqueta: `critica` · Bug: [BUG-09](../bugs.md#bug-09)

**Título:** [Tareas] Inyección SQL en la búsqueda: expone tareas de todos los proyectos
**Criterio violado:** Seguridad 1: "Toda entrada del usuario se trata como dato y nunca se concatena a una consulta a la base de datos"
**Entorno:** Windows 11 Pro · Node 22.23.5 · API Express + SQLite (Jest/Supertest, sin navegador) · TZ America/Montevideo (UTC-3) · commit `390b4bf` (rama `entrega-final`)
**Datos / precondiciones:** Ana con una tarea privada; Bob con su propio proyecto.
**Pasos:** 1. Como Bob, `GET /api/projects/<proyecto-de-bob>/tasks?search=') > 0) OR 1=1 --`.
**Esperado:** HTTP 200 sin resultados.
**Obtenido:** HTTP 200 con todas las tareas de todos los proyectos, incluida la de Ana.
**Reproducibilidad:** 3 de 3.
**Evidencia:** Ver docs/evidencias/seguridad/ (SEC-01).
**Test que lo reproduce:** server/tests/bugs.test.ts › BUG-09
**Severidad:** crítica
