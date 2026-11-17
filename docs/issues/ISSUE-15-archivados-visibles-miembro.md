# ISSUE-15 · BUG-19

> Etiqueta: `media` · Bug: [BUG-19](../bugs.md#bug-19)

**Título:** [Proyectos] Un miembro (no owner) ve los proyectos archivados
**Criterio violado:** US-04 c2: "Los proyectos archivados NO aparecen en este listado, sea el usuario owner o miembro"
**Entorno:** Windows 11 Pro · Node 22.23.5 · API Express + SQLite (Jest/Supertest, sin navegador) · TZ America/Montevideo (UTC-3) · commit `390b4bf` (rama `entrega-final`)
**Datos / precondiciones:** Bob miembro de un proyecto archivado de Ana.
**Pasos:** 1. Como Bob, `GET /api/projects`.
**Esperado:** El proyecto archivado no aparece.
**Obtenido:** Aparece.
**Reproducibilidad:** 3 de 3.
**Evidencia:** Respuesta 200.
**Test que lo reproduce:** server/tests/bugs.test.ts › BUG-19; proyectos.integration.test.ts › no muestra a un miembro (no owner) los proyectos archivados
**Severidad:** media
