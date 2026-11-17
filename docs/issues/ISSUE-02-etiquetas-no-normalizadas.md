# ISSUE-02 · BUG-17

> Etiqueta: `media` · Bug: [BUG-17](../bugs.md#bug-17)

**Título:** [Etiquetas] Las etiquetas no se normalizan y se duplican al agregarlas desde el detalle de tarea
**Criterio violado:** US-15 c1/c2/c3: "Las etiquetas se guardan normalizadas a minúsculas y sin espacios al inicio ni al final" · "'Bug', 'BUG' y 'bug' son la misma etiqueta" · "volver a agregarla devuelve HTTP 200 y no genera un duplicado"
**Entorno:** Windows 11 Pro · Chromium 131 (Playwright 1.49.1) · navegador y servidor en America/Montevideo (UTC-3) · commit `390b4bf` (rama `entrega-final`)
**Datos / precondiciones:** Owner con un proyecto y una tarea (con la etiqueta `bug` ya cargada por API para los casos 2 y 3).
**Pasos:** 1. Abrir el detalle de la tarea. 2. Agregar `  Backend `. 3. Agregar `bug` (ya existe) y luego `BUG`.
**Esperado:** Se ve `backend`; el segundo `bug` responde 200 sin duplicar; `BUG` no agrega otra etiqueta.
**Obtenido:** Se ve `Backend`; el segundo `bug` responde 201 y aparecen dos chips `bug`; `BUG` se agrega como etiqueta aparte.
**Reproducibilidad:** 4 de 4 corridas · en todos los entornos.
**Evidencia:** POST /api/tasks/:id/tags → 201 en el duplicado; dos `tag-chip` con el mismo texto.
**Test que lo reproduce:** e2e/tests/e2e/us-15-etiquetas.spec.ts › US-15 c1/c2/c3 · BUG-17 …; server/tests/bugs.test.ts › BUG-17 (3)
**Severidad:** media
