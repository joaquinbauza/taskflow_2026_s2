# ISSUE-19 · Performance (BUG-11 + N+1)

> Etiqueta: `alta` · Relacionado: [BUG-11](../bugs.md#bug-11), [docs/performance.md](../performance.md)

**Título:** [Tareas · API] El listado de tareas tarda más de 5 s (p95) con 5.000 tareas porque no pagina y hace 2 consultas por tarea
**Criterio violado:** Rendimiento 2: "Con un volumen de 5.000 tareas y 20.000 comentarios, el tiempo de respuesta del listado de tareas (percentil 95) no supera los 500 ms" · Rendimiento 1 (paginación) · Rendimiento 3: "El número de consultas a la base de datos por request no depende de la cantidad de resultados devueltos"
**Entorno:** AMD Ryzen 5 4500, 16 GB · Windows 11 Pro · Node 22.23.5 · API `npm run dev` + SQLite · TZ America/Montevideo · commit de la rama `entrega-final`
**Datos / precondiciones:** `npm run db:setup` y luego `npm --prefix server run db:seed:large` (proyecto "[Carga] Proyecto grande", 5.000 tareas, 20.000 comentarios, owner ana@test.com)
**Pasos:** 1. Levantar la API (`npm run dev:server`). 2. Login como ana@test.com / Password1. 3. `GET /api/projects/<proyecto grande>/tasks` 20 veces (o `k6 run -e VUS=20 -e DURATION=1m performance/scenarios/api-load.k6.js`).
**Esperado:** p95 ≤ 500 ms, respuesta paginada (20 por defecto) y una cantidad de consultas fija por request.
**Obtenido:** con 1 usuario: p50 4.082 ms, **p95 5.633 ms**, 1,86 MB por respuesta (las 5.000 tareas). Con la seed chica: p95 16 ms. El tiempo crece linealmente con la cantidad de tareas.
**Reproducibilidad:** 20 de 20 requests por encima de 3,8 s · en esta máquina; k6 pendiente de correr (no instalado).
**Evidencia:** `docs/evidencias/perf-curl-preliminar.txt` (y `docs/evidencias/k6-seed-grande.txt` cuando se corra k6).
**Hipótesis:** `tasks.controller.ts › listByProject` no pasa `limit`/`offset` a `findTasks` (BUG-11) y en el loop hace `db.user.findUnique` + `db.comment.count` por tarea → ~10.001 consultas por request (N+1). Los índices por `projectId`/`taskId` existen: el problema es la cantidad de consultas.
**Test que lo reproduce:** `performance/scenarios/api-load.k6.js` (thresholds `p(95)<500`); `server/tests/bugs.test.ts › BUG-11` (paginación).
**Severidad:** alta
