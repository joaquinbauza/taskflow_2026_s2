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

> **Estado al 16/11/2026 23:10:** k6 **no está instalado** en la máquina (`k6 version` → no encontrado), así que las corridas de k6 quedan pendientes (`winget install k6 --source winget`). Para no dejar la sección sin datos se tomó una **medición preliminar con curl** (20 requests secuenciales, 1 usuario) contra la misma API y el mismo endpoint: [`evidencias/perf-curl-preliminar.txt`](evidencias/perf-curl-preliminar.txt). No reemplaza a k6 (no hay concurrencia ni error rate bajo carga), pero ya muestra la tendencia.
>
> Además, `npm run db:reset` fue **bloqueado por Prisma** (pide consentimiento explícito del usuario cuando lo ejecuta un agente de IA). La "seed chica" medida fue la base de `npm run db:setup` más los datos que dejaron las pruebas de seguridad (unas pocas tareas extra). Al correr k6, hacer el `db:reset` a mano.

## Entorno

AMD Ryzen 5 4500 (6 núcleos), 16 GB RAM · Windows 11 Pro 10.0.26200 · Node 22.23.5 · API en modo dev (`ts-node-dev --transpile-only`), SQLite en `server/dev.db`, TZ America/Montevideo · cliente y servidor en la misma máquina (localhost).

## Resultados

| | Seed chica | Seed grande |
|---|---|---|
| Datos del proyecto medido | `proj-1` "Rediseño del sitio" (~9 tareas) | `proj-5` "[Carga] Proyecto grande" (5.000 tareas, 20.000 comentarios) |
| Tamaño de la respuesta | 2,3 KB | **1,86 MB** (las 5.000 tareas en una sola respuesta) |
| curl, 1 usuario, 20 requests: p50 | 13 ms | **4.082 ms** |
| curl, 1 usuario, 20 requests: p95 | 16 ms | **5.633 ms** |
| curl: errores | 0 / 20 (todas 200) | 0 / 20 (todas 200) |
| k6 p95 (`http_req_duration`) | pendiente (k6) | pendiente (k6) |
| k6 error rate (`http_req_failed`) | pendiente | pendiente |
| k6 iteraciones/s | pendiente | pendiente |
| ¿Pasa los thresholds? | Con 16 ms de p95 en curl, se espera que **sí** | **No**: ya con 1 usuario el p95 es 11 veces el umbral de 500 ms; con 20 VUs va a ser peor (las requests se encolan en el único proceso de Node y en SQLite) |

Crecimiento: ×580 en tiempo para ×555 en cantidad de tareas → el tiempo crece **linealmente con los datos**, cuando el criterio de la spec pide que no dependa del tamaño del resultado.

## Hipótesis: qué crece con los datos

Mirando `server/src/modules/tasks/tasks.controller.ts`, `tasks.repository.ts` y `schema.prisma`:

1. **No pagina (BUG-11).** `listByProject` calcula `limit`/`offset` pero `findTasks` no los usa (`take`/`skip` ausentes): trae y serializa las 5.000 tareas. Respuesta de 1,86 MB.
2. **N+1 consultas.** Por **cada** tarea hace `db.user.findUnique` (asignado) y `db.comment.count`: 1 + 2×5.000 ≈ **10.001 consultas por request**. Es lo que más pesa: cada consulta a SQLite vía Prisma cuesta ~0,4 ms → ~4 s, que coincide con lo medido.
3. **`total` mal calculado**: es `rows.length` (no hay `COUNT` aparte), consecuencia de lo mismo.
4. **Índices:** existen `@@index([projectId])` en `Task` y `@@index([taskId])` en `Comment` y `TaskHistory`, así que cada consulta individual es barata; el problema es la cantidad, no la falta de índice. No hay índice compuesto para los filtros (`projectId, status`), que importará cuando se pagine.

Criterios de Rendimiento de la spec que se violan:

- **Rendimiento 1:** "Todo endpoint de listado devuelve resultados paginados; ningún endpoint devuelve una colección completa sin límite." → devuelve las 5.000.
- **Rendimiento 2:** "Con un volumen de 5.000 tareas y 20.000 comentarios, el tiempo de respuesta del listado de tareas (percentil 95) no supera los 500 ms." → p95 5.633 ms con 1 usuario.
- **Rendimiento 3:** "El número de consultas a la base de datos por request no depende de la cantidad de resultados devueltos." → 2 consultas por tarea.

Issue: [ISSUE-19](issues/ISSUE-19-listado-tareas-lento-con-volumen.md).

## Propuesta (no implementada)

Pasar `take: limit, skip: offset` a `findMany` y calcular `total` con `db.task.count(where)`; traer el asignado con `include: { assignee: { select: { id, email } } }` y la cantidad de comentarios con `_count: { select: comments: true }` (requiere declarar la relación `Comment.task` en el schema, que de paso arregla BUG-20) o con un `groupBy` por `taskId` sobre los ids de la página. Queda en 3 consultas por request, independientes del volumen.
