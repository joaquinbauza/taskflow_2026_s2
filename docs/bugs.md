# Reporte de bugs — TaskFlow

**Rama:** `feat/e2e-tests` · **Fecha:** 26/10/2026 · **Referencia:** `taskflow_especificacion_requerimientos.docx` (v1.0), que es la fuente de verdad.

**Entorno:** Node ≥ 20, API Express + Prisma + SQLite, frontend React + Vite. Los pasos asumen la API en `http://localhost:3000/api` y el header `Authorization: Bearer <token>` en todo lo que no sea `/auth/*`.

Cada bug tiene al menos un test automatizado que lo reproduce (columna **Test**). Esos tests describen el comportamiento correcto y corren como *falla esperada* (`knownBug` en Jest, `test.fail` en Playwright): la suite queda en verde mientras el bug exista y se pone en rojo cuando se arregla. Para ver las fallas reales:

```bash
SHOW_BUGS=1 npm test              # macOS / Linux
$env:SHOW_BUGS=1; npm test        # Windows PowerShell
```

## Resumen

| ID | Título | Severidad | Historia | Nivel del test |
|----|--------|-----------|----------|----------------|
| [BUG-06](#bug-06) | No se puede agregar ningún miembro a un proyecto | Crítica | US-11 | Contrato + E2E |
| [BUG-07](#bug-07) | Cualquier usuario puede editar o borrar tareas de proyectos ajenos | Crítica | US-12, US-13 | Integración |
| [BUG-09](#bug-09) | Inyección SQL en la búsqueda de tareas | Crítica | US-07 | Integración |
| [BUG-14](#bug-14) | `forgot-password` revela si la cuenta existe y devuelve el token | Crítica | US-17 | Integración |
| [BUG-15](#bug-15) | `reset-password` acepta tokens usados, invalidados o vencidos | Crítica | US-17 | Integración |
| [BUG-08](#bug-08) | Un ex-miembro conserva sus tareas y puede seguir operándolas | Alta | US-11 | Integración |
| [BUG-01](#bug-01) | Se permite pasar una tarea de TODO a DONE | Alta | US-06 | Unitario |
| [BUG-03](#bug-03) | La fecha de vencimiento vuelve un día antes en UTC-3 | Alta | US-16 | Unitario |
| [BUG-05](#bug-05) | Los filtros del listado de tareas no se combinan | Alta | US-07 | Unitario + Integración |
| [BUG-11](#bug-11) | El listado de tareas no pagina | Alta | US-07 | Integración |
| [BUG-12](#bug-12) | Al crear una tarea se puede forzar el estado (asignación masiva) | Alta | US-05 | Integración |
| [BUG-16](#bug-16) | El contador de intentos fallidos no se reinicia tras un login exitoso | Alta | US-02 | Integración |
| [BUG-20](#bug-20) | Borrar un proyecto deja comentarios e historial huérfanos | Alta | US-10 | Integración |
| [BUG-02](#bug-02) | Se aceptan contraseñas de 7 caracteres | Media | US-01, US-17 | Unitario |
| [BUG-04](#bug-04) | Se aceptan fechas de vencimiento inexistentes (2026-02-30) | Media | US-16 | Unitario |
| [BUG-10](#bug-10) | La búsqueda distingue mayúsculas de minúsculas | Media | US-07 | Integración |
| [BUG-13](#bug-13) | Los comentarios se devuelven del más nuevo al más viejo | Media | US-08 | Integración |
| [BUG-17](#bug-17) | Las etiquetas no se normalizan y se duplican | Media | US-15 | Integración |
| [BUG-18](#bug-18) | Se pueden crear proyectos con nombre vacío o de menos de 3 caracteres | Media | US-03 | Integración (test existente) |
| [BUG-19](#bug-19) | Un miembro ve los proyectos archivados | Media | US-04 | Integración |

Criterio de severidad: **Crítica** = seguridad o funcionalidad principal inutilizable; **Alta** = incumple una regla de negocio o pierde/corrompe datos; **Media** = incumple un criterio de aceptación sin pérdida de datos.

---

## Críticos

### BUG-06
**No se puede agregar ningún miembro a un proyecto** · Severidad: Crítica · US-11 (criterios 2, 3)

- **Precondiciones:** usuario A owner del proyecto `proj-1`; existe el usuario `bob@test.com`.
- **Pasos:** como A, `POST /projects/proj-1/members` con `{ "email": "bob@test.com" }` (o desde la pantalla *Miembros*).
- **Esperado:** HTTP 201 con `{ projectId, userId, email, role: "MEMBER" }`; Bob ve el proyecto en `GET /projects`.
- **Obtenido:** HTTP 400 `VALIDATION_ERROR` "email must be a valid address" para cualquier email válido. En la UI aparece el error y el miembro no se agrega.
- **Evidencia:** [captura del E2E](evidencias/BUG-06-miembros.png).
- **Test:** `server/tests/contract/api.contract.test.ts › [BUG-06] POST /projects/:projectId/members`, `e2e/tests/members.spec.ts`. También rompe el test existente `tasks.test.ts › permite al owner cambiar estado y rechaza a un miembro no asignado`.
- **Causa probable:** `projects.controller.ts:145` — `if (assertEmail(...)) throw badRequest(...)`. `assertEmail` devuelve el email normalizado (truthy) cuando es válido, así que la condición es siempre verdadera.

### BUG-07
**Cualquier usuario autenticado puede editar o borrar tareas de proyectos ajenos** · Severidad: Crítica · US-12 (criterio 5), US-13 (criterio 1), Seguridad 2

- **Precondiciones:** A es owner de un proyecto con la tarea `task-1`; B está registrado y no es miembro.
- **Pasos:** como B, `PATCH /tasks/task-1` con `{ "title": "Cambiado" }`; luego `DELETE /tasks/task-1`.
- **Esperado:** HTTP 403 en ambos casos; la tarea conserva el título y sigue existiendo.
- **Obtenido:** PATCH → 200 y el título cambia; DELETE → 204 y la tarea se borra.
- **Test:** `server/tests/bugs.test.ts › BUG-07` (2 tests).
- **Causa probable:** `tasks.routes.ts:14-15` — `PATCH /:taskId` y `DELETE /:taskId` no usan el middleware `requireTaskProjectMember`, a diferencia de las demás rutas del router.

### BUG-09
**Inyección SQL en la búsqueda de tareas** · Severidad: Crítica · US-07, Seguridad 1

- **Precondiciones:** A tiene un proyecto con la tarea "Plan secreto de la víctima". B tiene su propio proyecto `proj-B`.
- **Pasos:** como B, `GET /projects/proj-B/tasks?search=') > 0) OR 1=1 --`
- **Esperado:** el texto se trata como dato: HTTP 200 sin resultados.
- **Obtenido:** HTTP 200 con **todas las tareas de todos los proyectos**, incluida la de A.
- **Test:** `server/tests/bugs.test.ts › BUG-09`.
- **Causa probable:** `tasks.repository.ts:33-50` — la búsqueda arma el SQL concatenando `search` y usa `$queryRawUnsafe`. Debe usarse una consulta parametrizada (`$queryRaw` con template o `contains` de Prisma).

### BUG-14
**`forgot-password` revela si la cuenta existe y devuelve el token de reseteo** · Severidad: Crítica · US-17 (criterio 2), Seguridad 3

- **Pasos:** `POST /auth/forgot-password` con un email registrado y después con `nadie@test.com`.
- **Esperado:** HTTP 200 y el mismo cuerpo genérico en ambos casos.
- **Obtenido:** email registrado → 200 con `{ message, token }`; email inexistente → 404 "No account found for that email". Además, como el token viaja en la respuesta, cualquiera que conozca un email puede resetear esa contraseña (combinado con BUG-15, sin límite).
- **Test:** `server/tests/bugs.test.ts › BUG-14`.
- **Causa probable:** `auth.service.ts:95` lanza `notFound` y el `return` final incluye `token`.

### BUG-15
**`reset-password` acepta tokens usados, invalidados o vencidos** · Severidad: Crítica · US-17 (criterios 3, 4, 5, 6)

- **Pasos:**
  1. `POST /auth/forgot-password` → token T1. `POST /auth/reset-password` con T1 → 200. Repetir con T1.
  2. Generar un token y dejarlo vencer (más de 60 minutos) → usarlo.
  3. Generar T1, luego T2 → usar T1.
- **Esperado:** HTTP 400 en los tres casos.
- **Obtenido:** HTTP 200 en los tres casos; la contraseña se cambia.
- **Test:** `server/tests/bugs.test.ts › BUG-15` (3 tests).
- **Causa probable:** `auth.service.ts:119` — solo se busca el token; no se valida `usedAt` ni `expiresAt` y no se marca como usado al consumirlo.

## Altos

### BUG-08
**Al quitar un miembro, sus tareas siguen asignadas y puede seguir cambiándoles el estado** · Severidad: Alta · US-11 (criterios 6, 7)

- **Precondiciones:** Bob es miembro de `proj-1` y tiene asignada `task-1` (por BUG-06 el alta se hace directo en la base).
- **Pasos:** el owner hace `DELETE /projects/proj-1/members/<bob>`; luego Bob hace `PATCH /tasks/task-1` con `{ "status": "IN_PROGRESS" }`.
- **Esperado:** `task-1` queda con `assigneeId: null`; el PATCH de Bob devuelve 403.
- **Obtenido:** `task-1` sigue asignada a Bob; el PATCH devuelve 200 y cambia el estado.
- **Test:** `server/tests/bugs.test.ts › BUG-08` (2 tests).
- **Causa probable:** `projects.controller.ts:188` borra la membresía sin desasignar tareas; `tasks.service.ts:58` saltea la verificación cuando el usuario es el asignado, y la ruta PATCH no verifica membresía (ver BUG-07).

### BUG-01
**Se permite pasar una tarea de TODO directamente a DONE** · Severidad: Alta · US-06 (criterio 2)

- **Pasos:** con una tarea en TODO, `PATCH /tasks/task-1` con `{ "status": "DONE" }`.
- **Esperado:** HTTP 422 `INVALID_TRANSITION`.
- **Obtenido:** HTTP 200; la tarea queda en DONE.
- **Test:** `server/tests/unit/transitions.test.ts › [BUG-01]`.
- **Causa probable:** `transitions.ts:8-11` — la lista `FORBIDDEN_TRANSITIONS` no incluye `['TODO', 'DONE']`. Conviene invertir el enfoque a una lista de transiciones *permitidas*.

### BUG-03
**La fecha de vencimiento vuelve un día antes con el servidor en UTC-3** · Severidad: Alta · US-16 (criterio 3)

- **Precondiciones:** servidor corriendo con zona horaria America/Montevideo (cualquier zona al oeste de UTC).
- **Pasos:** `PATCH /tasks/task-1` con `{ "dueDate": "2026-09-15" }`; luego `GET /tasks/task-1`.
- **Esperado:** `dueDate: "2026-09-15"`.
- **Obtenido:** `dueDate: "2026-09-14"`. En UTC o al este de UTC funciona, por eso puede pasar inadvertido en CI.
- **Test:** `server/tests/unit/ids.test.ts › [BUG-03]` (corre la conversión en un proceso con `TZ=America/Montevideo`).
- **Causa probable:** `ids.ts:38` crea la fecha a medianoche UTC (`new Date('2026-09-15')`) y `ids.ts:44-46` la formatea con `getFullYear/getMonth/getDate` en hora local. Usar los métodos `getUTC*`.

### BUG-05
**Los filtros del listado de tareas no se combinan** · Severidad: Alta · US-07 (criterio 5)

- **Precondiciones:** 3 tareas TODO/HIGH, 4 TODO/LOW y 1 DONE/HIGH en el proyecto.
- **Pasos:** `GET /projects/proj-1/tasks?status=TODO&priority=HIGH`
- **Esperado:** las 3 tareas TODO/HIGH.
- **Obtenido:** las 4 HIGH, incluida la DONE: solo se aplica el último filtro.
- **Test:** `server/tests/unit/task-filters.test.ts › [BUG-05]` (2), `server/tests/bugs.test.ts › BUG-05`.
- **Causa probable:** `tasks.repository.ts:16-22` — cada `if` reemplaza el objeto `where` en lugar de agregarle la condición.

### BUG-11
**El listado de tareas no pagina** · Severidad: Alta · US-07 (criterio 7), Rendimiento 1

- **Precondiciones:** proyecto con 25 tareas.
- **Pasos:** `GET /projects/proj-1/tasks` y `GET /projects/proj-1/tasks?limit=5&offset=20`.
- **Esperado:** 20 tareas con `total: 25`; luego las tareas 21 a 25.
- **Obtenido:** siempre las 25 tareas; `limit` y `offset` solo se repiten en la respuesta.
- **Test:** `server/tests/bugs.test.ts › BUG-11` (2 tests).
- **Causa probable:** `tasks.controller.ts:30-46` calcula `limit`/`offset` pero no los pasa a `findTasks` (`take`/`skip`).

### BUG-12
**Al crear una tarea se puede forzar el estado (asignación masiva)** · Severidad: Alta · US-05 (criterio 3)

- **Pasos:** `POST /projects/proj-1/tasks` con `{ "title": "Nueva tarea", "status": "DONE" }`.
- **Esperado:** HTTP 201 con `status: "TODO"`.
- **Obtenido:** HTTP 201 con `status: "DONE"`. Se saltea las reglas de transición de US-06 y el historial registra `null → DONE`.
- **Test:** `server/tests/bugs.test.ts › BUG-12`.
- **Causa probable:** `tasks.service.ts:85` — `...(body as object)` copia el cuerpo completo de la solicitud al `create`; cualquier columna (`status`, `id`, `createdAt`...) se puede escribir desde afuera.

### BUG-16
**El contador de intentos fallidos no se reinicia tras un login exitoso** · Severidad: Alta · US-02 (criterio 5)

- **Pasos:** 3 logins con contraseña incorrecta → 1 login correcto (200) → 3 logins incorrectos → login correcto.
- **Esperado:** el último login responde 200 (la cuenta no se bloquea).
- **Obtenido:** 401 "Account temporarily locked": los fallos se acumularon en 6.
- **Test:** `server/tests/bugs.test.ts › BUG-16`.
- **Causa probable:** `auth.service.ts:81-83` — tras el login exitoso solo se limpia `lockedUntil`, no `failedAttempts`.

### BUG-20
**Borrar un proyecto deja comentarios e historial huérfanos** · Severidad: Alta · US-10 (criterios 4, 5)

- **Precondiciones:** proyecto con una tarea que tiene 2 comentarios y un cambio de estado.
- **Pasos:** `DELETE /projects/proj-1` → 204. Consultar las tablas `comments` y `task_history` por el id de la tarea.
- **Esperado:** 0 comentarios y 0 entradas de historial.
- **Obtenido:** quedan 2 comentarios y 2 entradas de historial.
- **Test:** `server/tests/bugs.test.ts › BUG-20`.
- **Causa probable:** en `schema.prisma`, `Comment` y `TaskHistory` no tienen relación con `Task`, así que el `onDelete: Cascade` del proyecto borra las tareas pero no lo que cuelga de ellas. `projects.controller.ts:127` hace un `delete` directo sin limpiar.

## Medios

### BUG-02
**Se aceptan contraseñas de 7 caracteres** · Severidad: Media · US-01 (criterio 3), US-17 (criterio 7)

- **Pasos:** `POST /auth/register` con `{ "email": "x@test.com", "password": "Passwo1" }`.
- **Esperado:** HTTP 400 (mínimo 8 caracteres). El propio mensaje de error dice "at least 8 characters".
- **Obtenido:** HTTP 201.
- **Test:** `server/tests/unit/validation.test.ts › [BUG-02]`.
- **Causa probable:** `validation.ts:20` — `password.length >= 7`.

### BUG-04
**Se aceptan fechas de vencimiento inexistentes** · Severidad: Media · US-16 (criterio 6)

- **Pasos:** `PATCH /tasks/task-1` con `{ "dueDate": "2026-02-30" }`.
- **Esperado:** HTTP 400.
- **Obtenido:** HTTP 200 y se guarda el 2 de marzo (el 1 de marzo en UTC-3, ver BUG-03).
- **Test:** `server/tests/unit/ids.test.ts › [BUG-04]`.
- **Causa probable:** `ids.ts:38` — `new Date('2026-02-30')` no es `Invalid Date` en V8 sino que se desborda al mes siguiente. Hay que comparar año/mes/día de la fecha creada con los del string.

### BUG-10
**La búsqueda por texto distingue mayúsculas de minúsculas** · Severidad: Media · US-07 (criterio 4)

- **Pasos:** con la tarea "Implementar Login", `GET /projects/proj-1/tasks?search=login`.
- **Esperado:** se devuelve la tarea.
- **Obtenido:** lista vacía.
- **Test:** `server/tests/bugs.test.ts › BUG-10`.
- **Causa probable:** `tasks.repository.ts:49` — `instr()` de SQLite es sensible a mayúsculas.

### BUG-13
**Los comentarios se devuelven del más nuevo al más viejo** · Severidad: Media · US-08 (criterio 4)

- **Pasos:** comentar "primero", "segundo", "tercero" y hacer `GET /tasks/task-1/comments`.
- **Esperado:** `primero, segundo, tercero`.
- **Obtenido:** `tercero, segundo, primero`.
- **Test:** `server/tests/bugs.test.ts › BUG-13`.
- **Causa probable:** `comments.repository.ts:6` — `orderBy: { createdAt: 'desc' }`.

### BUG-17
**Las etiquetas no se normalizan y se duplican** · Severidad: Media · US-15 (criterios 1, 2, 3)

- **Pasos:** `POST /tasks/task-1/tags` con `"  Backend "`; con `"bug"` dos veces; con `"bug"` y `"BUG"`.
- **Esperado:** se guarda `backend`; el segundo `bug` responde 200 sin duplicar; `BUG` es la misma etiqueta que `bug`.
- **Obtenido:** se guarda `Backend`; el segundo `bug` responde 201 y la tarea queda con dos `bug`; `BUG` se crea como etiqueta aparte.
- **Test:** `server/tests/bugs.test.ts › BUG-17` (3 tests).
- **Causa probable:** `tasks.service.ts:187-190` — no se pasa el nombre a minúsculas y no se controla si la tarea ya tiene la etiqueta (`task_tags` tampoco tiene índice único).

### BUG-18
**Se pueden crear proyectos con nombre vacío o de menos de 3 caracteres** · Severidad: Media · US-03 (criterio 1)

- **Pasos:** `POST /projects` con `{ "name": "" }`, `"  "` o `" ab "`.
- **Esperado:** HTTP 400.
- **Obtenido:** HTTP 201.
- **Test:** test existente `server/tests/projects.test.ts › rechaza nombres cortos y acepta el minimo luego de quitar espacios` (falla).
- **Causa probable:** `projects.controller.ts:32` — solo se valida el máximo (`> 100`), falta el mínimo de 3. El `update` sí lo valida.

### BUG-19
**Un miembro ve los proyectos archivados** · Severidad: Media · US-04 (criterio 2)

- **Precondiciones:** B es miembro (no owner) del proyecto `proj-9`, que está archivado.
- **Pasos:** como B, `GET /projects`.
- **Esperado:** `proj-9` no aparece.
- **Obtenido:** `proj-9` aparece.
- **Test:** `server/tests/bugs.test.ts › BUG-19`.
- **Causa probable:** `projects.controller.ts:60` — la rama del `OR` para miembros no filtra `archived: false`.

---

## Observaciones (sin test, para discutir)

- **El frontend no puede listar miembros.** No existe `GET /projects/:id/members`; `client/src/lib/members.ts` reconstruye la lista con el owner, los asignados de las tareas y un caché en `localStorage`. Un miembro sin tareas agregado desde otro navegador no aparece. Es un hueco del contrato: la UI necesita un dato que la API no ofrece.
- **Rendimiento 3 (consultas por request).** `tasks.controller.ts:32-43` hace 2 consultas por cada tarea del listado (asignado y cantidad de comentarios): N+1.
- **`GET /tasks/:id/comments` no pagina** (Rendimiento 1).
