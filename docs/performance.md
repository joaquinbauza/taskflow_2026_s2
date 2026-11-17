# Performance con k6 (Clase 10)

## Qué hay

| Archivo | Qué es |
|---|---|
| `performance/scenarios/api-load.k6.js` | Escenario de carga: login una vez en `setup()`, después cada VU hace `GET /api/projects/:id/tasks` + `sleep(1)`. Thresholds: `http_req_duration p(95)<500` y `http_req_failed rate<0.01`. Elige solo el proyecto `[Carga] Proyecto grande` si existe |
| `server/prisma/seed-large.ts` | Seed de carga: 1 proyecto con **5.000 tareas y 20.000 comentarios** + 199 proyectos vacíos. Re-ejecutable (borra lo que tenga prefijo `[Carga]`) |
| `npm run db:seed:large` | Script nuevo en la raíz (`npm --prefix server run db:seed:large`) |

## Cómo correrlo

```bash
# seed chica
npm run db:reset
npm run dev:server                      # en otra terminal
k6 run -e VUS=1 -e DURATION=30s performance/scenarios/api-load.k6.js | tee docs/evidencias/k6-seed-chica.txt

# seed grande (no hace falta reiniciar la API)
npm --prefix server run db:seed:large
k6 run -e VUS=20 -e DURATION=1m performance/scenarios/api-load.k6.js | tee docs/evidencias/k6-seed-grande.txt
```

> **Corridas de k6 del 16/11/2026 (22:40, UTC-3):** k6 v2.4.0, después de `npm run db:reset` (seed chica) y de `npm --prefix server run db:seed:large` sobre la misma API, sin reiniciarla. Salidas completas: [`evidencias/k6-seed-chica.txt`](evidencias/k6-seed-chica.txt) y [`evidencias/k6-seed-grande.txt`](evidencias/k6-seed-grande.txt). Antes de tener k6 se tomó una medición con curl (20 requests secuenciales, 1 usuario): [`evidencias/perf-curl-preliminar.txt`](evidencias/perf-curl-preliminar.txt).
>
> Las métricas `http_req_*` de k6 incluyen las 2 requests de `setup()` (login y `GET /projects`), por eso el mínimo de la seed grande es 6 ms; no cambian el p95.

## Entorno

AMD Ryzen 5 4500 (6 núcleos), 16 GB RAM · Windows 11 Pro 10.0.26200 · Node 22.23.5 · API en modo dev (`ts-node-dev --transpile-only`), SQLite en `server/dev.db`, TZ America/Montevideo · cliente y servidor en la misma máquina (localhost).

## Resultados

| | Seed chica (k6, 1 VU, 30 s) | Seed grande (k6, 20 VUs, 1 min) |
|---|---|---|
| Proyecto medido | "Rediseño del sitio" (seed de `db:reset`) | `proj-4` "[Carga] Proyecto grande" (5.000 tareas, 20.000 comentarios) |
| Tamaño de la respuesta | ~2 KB (63 kB recibidos en 32 requests) | **~1,86 MB** (112 MB recibidos en 62 requests) |
| **p95** `http_req_duration` | **17,68 ms** | **25.590 ms (25,6 s)** |
| Mediana / promedio | 11,67 ms / 13,18 ms | 22.760 ms / 22.490 ms |
| Máximo | 67,23 ms | 26.050 ms |
| **Error rate** `http_req_failed` | **0,00 %** (0 de 32) | **0,00 %** (0 de 62) |
| **Iteraciones/s** | **0,99** (30 iteraciones) | **0,81** (60 iteraciones) |
| Requests/s | 1,05 | 0,84 |
| Duración de la iteración (p95) | 1,01 s | 26,59 s |
| **¿Pasa los thresholds?** | ✅ Sí: `p(95)<500` (17,68 ms) y `rate<0.01` (0 %) | ❌ **No**: `p(95)<500` falla (25,59 s, **51 veces el umbral**); `rate<0.01` pasa. k6 termina con exit code 99 |
| curl, 1 usuario, 20 requests (preliminar): p95 | 16 ms | 5.633 ms |

**Lectura.** Con 20 VUs el sistema **no escala**: hay 20 veces más usuarios pero el throughput baja de 0,99 a 0,81 iteraciones/s. Cada request de la seed grande cuesta ~1,1 s del único proceso de Node (5.000 tareas × 2 consultas), así que las 20 requests concurrentes se encolan: 20 × ~1,1 s ≈ 22 s, que coincide con la mediana medida (22,8 s). No hay errores HTTP porque nada corta la request (no hay timeout), pero para el usuario el tablero no carga.

Crecimiento con 1 usuario (curl): ×350 en el p95 para ×555 en cantidad de tareas. Con 20 usuarios (k6): p95 ×1.450 respecto de la seed chica. El tiempo crece **linealmente con los datos** y además se multiplica con la concurrencia, cuando el criterio de la spec pide que no dependa del tamaño del resultado.

## Hipótesis: qué crece con los datos

Mirando `server/src/modules/tasks/tasks.controller.ts`, `tasks.repository.ts` y `schema.prisma`:

1. **No pagina (BUG-11).** `listByProject` calcula `limit`/`offset` pero `findTasks` no los usa (`take`/`skip` ausentes): trae y serializa las 5.000 tareas. Respuesta de 1,86 MB.
2. **N+1 consultas.** Por **cada** tarea hace `db.user.findUnique` (asignado) y `db.comment.count`: 1 + 2×5.000 ≈ **10.001 consultas por request**. Es lo que más pesa: cada consulta a SQLite vía Prisma cuesta ~0,4 ms → ~4 s, que coincide con lo medido.
3. **`total` mal calculado**: es `rows.length` (no hay `COUNT` aparte), consecuencia de lo mismo.
4. **Índices:** existen `@@index([projectId])` en `Task` y `@@index([taskId])` en `Comment` y `TaskHistory`, así que cada consulta individual es barata; el problema es la cantidad, no la falta de índice. No hay índice compuesto para los filtros (`projectId, status`), que importará cuando se pagine.

Criterios de Rendimiento de la spec que se violan:

- **Rendimiento 1:** "Todo endpoint de listado devuelve resultados paginados; ningún endpoint devuelve una colección completa sin límite." → devuelve las 5.000.
- **Rendimiento 2:** "Con un volumen de 5.000 tareas y 20.000 comentarios, el tiempo de respuesta del listado de tareas (percentil 95) no supera los 500 ms." → p95 **25.590 ms** con 20 VUs (k6) y 5.633 ms con 1 usuario (curl).
- **Rendimiento 3:** "El número de consultas a la base de datos por request no depende de la cantidad de resultados devueltos." → 2 consultas por tarea.

Issue: [ISSUE-18](issues/ISSUE-18-listado-tareas-lento-con-volumen.md).

## Propuesta (no implementada)

Pasar `take: limit, skip: offset` a `findMany` y calcular `total` con `db.task.count(where)`; traer el asignado con `include: { assignee: { select: { id, email } } }` y la cantidad de comentarios con `_count: { select: comments: true }` (requiere declarar la relación `Comment.task` en el schema, que de paso arregla BUG-20) o con un `groupBy` por `taskId` sobre los ids de la página. Queda en 3 consultas por request, independientes del volumen.
