# ISSUE-01 · BUG-03

> Etiqueta: `alta` · Bug: [BUG-03](../bugs.md#bug-03)

**Título:** [Tareas] La fecha de vencimiento vuelve un día antes con el servidor en UTC-3 (detalle y tablero)
**Criterio violado:** US-16 c3: "La fecha que se devuelve es siempre la misma que se cargó, sin importar la zona horaria del cliente ni la del servidor"
**Entorno:** Windows 11 Pro · Chromium 131 (Playwright 1.49.1) · navegador y servidor en America/Montevideo (UTC-3) · commit `390b4bf` (rama `entrega-final`)
**Datos / precondiciones:** Owner con un proyecto y una tarea sin vencimiento, creados por API.
**Pasos:** 1. Abrir el detalle de la tarea. 2. Cargar 2026-09-15 en *Vencimiento* y tocar *Guardar*. 3. Recargar la página y mirar *Vencimiento actual* (y la tarjeta en el tablero).
**Esperado:** Se muestra `2026-09-15` (y la API devuelve `dueDate: "2026-09-15"`).
**Obtenido:** Se muestra `2026-09-14`; la API devuelve `2026-09-14`. Con 2020-01-01 devuelve `2019-12-31`.
**Reproducibilidad:** 4 de 4 corridas con TZ America/Montevideo · 0 de 4 con TZ=UTC (por eso no se veía en CI antes de fijar TZ).
**Evidencia:** PATCH /api/tasks/:id → 200 con body `dueDate: "2026-09-14"`; para ver el diff en Playwright, quitar el `test.fail` y correr `npx playwright test us-16 --trace on`.
**Test que lo reproduce:** e2e/tests/e2e/us-16-vencimiento.spec.ts › US-16 c3 · BUG-03 … / US-16 c2 · BUG-03 … / US-16 c7 · BUG-03 …; server/tests/unit/ids.test.ts › [BUG-03]
**Severidad:** alta
