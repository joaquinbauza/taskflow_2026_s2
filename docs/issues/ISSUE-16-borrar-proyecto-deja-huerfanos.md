# ISSUE-16 · BUG-20

> Etiqueta: `alta` · Bug: [BUG-20](../bugs.md#bug-20)

**Título:** [Proyectos] Borrar un proyecto deja comentarios e historial huérfanos
**Criterio violado:** US-10 c5: "Después de la eliminación no queda en el sistema ningún registro asociado al proyecto ni a sus tareas"
**Entorno:** Windows 11 Pro · Node 22.23.5 · API Express + SQLite (Jest/Supertest, sin navegador) · TZ America/Montevideo (UTC-3) · commit `390b4bf` (rama `entrega-final`)
**Datos / precondiciones:** Proyecto con una tarea con 2 comentarios y un cambio de estado.
**Pasos:** 1. `DELETE /api/projects/:id` → 204. 2. Consultar `comments` y `task_history` por el id de la tarea.
**Esperado:** 0 comentarios y 0 historial.
**Obtenido:** Quedan 2 comentarios y 2 entradas de historial.
**Reproducibilidad:** 3 de 3.
**Evidencia:** Consulta a la base en el test.
**Test que lo reproduce:** server/tests/bugs.test.ts › BUG-20; proyectos.integration.test.ts › al eliminar el proyecto no quedan comentarios ni historial…
**Severidad:** alta
