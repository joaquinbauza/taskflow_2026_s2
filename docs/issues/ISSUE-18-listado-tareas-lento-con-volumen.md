# ISSUE-18 · BUG-22 (performance; relacionado con BUG-11)

> Etiqueta: `alta` · Bug: [BUG-22](../bugs.md#bug-22) · Relacionado: [BUG-11](../bugs.md#bug-11), [docs/performance.md](../performance.md)

**Título:** [Tareas · API] El listado de tareas tarda 25,6 s (p95) con 5.000 tareas y 20 usuarios porque no pagina y hace 2 consultas por tarea
**Criterio violado:** Rendimiento 2: "Con un volumen de 5.000 tareas y 20.000 comentarios, el tiempo de respuesta del listado de tareas (percentil 95) no supera los 500 ms" · Rendimiento 1 (paginación) · Rendimiento 3: "El número de consultas a la base de datos por request no depende de la cantidad de resultados devueltos"
**Entorno:** AMD Ryzen 5 4500, 16 GB · Windows 11 Pro · Node 22.23.5 · k6 v2.4.0 · API `npm run dev` + SQLite · TZ America/Montevideo · commit de la rama `entrega-final`
**Datos / precondiciones:** `npm run db:setup` y luego `npm --prefix server run db:seed:large` (proyecto "[Carga] Proyecto grande", 5.000 tareas, 20.000 comentarios, owner ana@test.com)
**Pasos:** 1. Levantar la API (`npm run dev:server`). 2. `k6 run -e VUS=20 -e DURATION=1m performance/scenarios/api-load.k6.js` (el script hace login como ana@test.com y elige el proyecto grande).
**Esperado:** p95 ≤ 500 ms, respuesta paginada (20 por defecto) y una cantidad de consultas fija por request.
**Obtenido:** k6 con 20 VUs durante 1 min: **p95 25.590 ms**, mediana 22.760 ms, máximo 26.050 ms, 0,81 iteraciones/s, 0 % de errores; el threshold `p(95)<500` falla (exit code 99). Cada respuesta pesa ~1,86 MB (las 5.000 tareas). Con la seed chica y 1 VU: p95 17,68 ms y 0,99 iteraciones/s, pasa los thresholds. Con 20 veces más usuarios el throughput **baja**: las requests se encolan.
**Reproducibilidad:** 1 de 1 corridas de k6 (las 60 requests del escenario por encima de 21 s; solo las 2 de setup son rápidas) · coincide con la medición previa con curl (20 de 20 requests por encima de 3,8 s con 1 usuario) · en esta máquina.
**Evidencia:** `docs/evidencias/k6-seed-grande.txt` (salida completa de k6), `docs/evidencias/k6-seed-chica.txt` (línea de base) y `docs/evidencias/perf-curl-preliminar.txt`.
**Hipótesis:** `tasks.controller.ts › listByProject` no pasa `limit`/`offset` a `findTasks` (BUG-11) y en el loop hace `db.user.findUnique` + `db.comment.count` por tarea → ~10.001 consultas por request (N+1). Los índices por `projectId`/`taskId` existen: el problema es la cantidad de consultas.
**Test que lo reproduce:** `performance/scenarios/api-load.k6.js` (thresholds `p(95)<500`); `server/tests/bugs.test.ts › BUG-11` (paginación).
**Severidad:** alta
