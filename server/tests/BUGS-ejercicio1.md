# Ejercicio 1: hallazgos

Estos tests de integración fallan porque el sistema no cumple la especificación (`taskflow_especificacion_requerimientos.docx`). **No se ajustaron para que pasen.** Quedan anotados para registrarlos como bugs en la Etapa 2.

## Cobertura

| | Antes | Después |
|---|---|---|
| Ramas | 33,6 % | **80,9 %** |
| Líneas | 66,6 % | **95,9 %** |
| Tests | 14 | 117 (90 en verde y 27 en rojo por bugs) |

El threshold que se agregó en `jest.config.js` (`lines: 70, branches: 40`) se cumple.

## Bugs encontrados

| # | Historia | Test que falla | Qué pasa | Dónde |
|---|---|---|---|---|
| 1 | US-11 | `miembros › el owner agrega un miembro…`, `…email sin usuario 404`, `…ya es miembro 409`. También falla `tasks.test.ts › permite al owner cambiar estado…` | `POST /projects/:id/members` devuelve **400 siempre** que el email es válido. La condición quedó invertida: `if (assertEmail(...)) throw badRequest(...)` | `projects.controller.ts` → `addMember` |
| 2 | US-03 | `crear › rechaza un nombre de 2 caracteres`. También falla `projects.test.ts › rechaza nombres cortos…` | Se pueden crear proyectos con nombre vacío o de menos de 3 caracteres, porque solo se valida el máximo | `projects.controller.ts` → `create` |
| 3 | US-04 | `listar › no muestra a un miembro (no owner) los proyectos archivados` | Un miembro sigue viendo los proyectos archivados. El filtro `archived: false` solo se aplica al owner | `projects.controller.ts` → `list` |
| 4 | US-10 | `eliminar › al eliminar el proyecto no quedan comentarios ni historial` | Al borrar un proyecto quedan huérfanos los comentarios y el historial de sus tareas, porque no tienen relación en cascada con la tarea | `schema.prisma` (`Comment`, `TaskHistory`) |
| 5 | US-11 | `miembros › al quitar un miembro sus tareas quedan sin asignado` | Al quitar un miembro, sus tareas siguen asignadas a él | `projects.controller.ts` → `removeMember` |
| 6 | US-01 | `registro › rechaza una contraseña de 7 caracteres…` | Acepta contraseñas de 7 caracteres (`length >= 7`) y el mínimo es 8 | `validation.ts` → `assertPassword` |
| 7 | US-02 | `login › el contador de intentos fallidos se reinicia…` | Un login exitoso no reinicia `failedAttempts`, así que 3 fallos + éxito + 3 fallos bloquean la cuenta | `auth.service.ts` → `login` |
| 8 | US-17 | `token ya utilizado`, `token vencido`, `el anterior queda invalidado` | `reset-password` no chequea `usedAt` ni `expiresAt` y tampoco marca el token como usado. Cualquier token sirve para siempre | `auth.service.ts` → `resetPassword` |
| 9 | US-17 | `la respuesta no revela si el email existe` | `forgot-password` devuelve 404 si el email no existe, y eso revela qué cuentas están registradas | `auth.service.ts` → `forgotPassword` |
| 10 | US-08 | `los comentarios se devuelven del más antiguo al más reciente` | Los comentarios vienen ordenados del más nuevo al más viejo (`desc`) | `comments.repository.ts` → `listByTask` |
| 11 | US-05 | `crear › el estado inicial es TODO aunque la solicitud mande otro estado` | Si al crear se manda `status: 'DONE'`, la tarea nace en DONE. El `...body` se copia entero a la base | `tasks.service.ts` → `createTask` |
| 12 | US-06 | `cambiar estado › no permite ir de TODO directamente a DONE` | Permite TODO → DONE, porque la transición no está en la lista de prohibidas | `transitions.ts` |
| 13 | US-12 / US-11 | `un usuario ajeno… no puede editar la tarea`, `un ex-miembro no puede cambiar el estado…` | `PATCH /tasks/:id` no verifica membresía: cualquier usuario autenticado edita tareas de proyectos ajenos | `tasks.routes.ts` (le falta `requireTaskProjectMember`) |
| 14 | US-13 | `eliminar › un usuario ajeno… no puede eliminar la tarea` | `DELETE /tasks/:id` no verifica membresía: cualquier usuario autenticado borra cualquier tarea | `tasks.routes.ts` |
| 15 | US-16 | `la fecha devuelta es la misma que se cargó…` | En UTC-3, si se carga `2026-09-15` se devuelve `2026-09-14`. Se parsea en UTC y se formatea en hora local | `ids.ts` → `parseDueDate` / `formatDueDate` |
| 16 | US-07 | `la búsqueda no distingue mayúsculas…` | La búsqueda distingue mayúsculas: `instr` es case-sensitive | `tasks.repository.ts` → `findTasks` |
| 17 | US-07 | `los filtros se combinan entre sí` | Los filtros no se combinan: cada uno pisa al anterior en `buildFilters` | `tasks.repository.ts` → `buildFilters` |
| 18 | US-07 | `el listado viene paginado…` | No hay paginación: `limit` y `offset` se ignoran y `total` es la cantidad devuelta | `tasks.controller.ts` → `listByProject` |
| 19 | US-15 | `agregar la misma etiqueta dos veces no la duplica` | Agregar la misma etiqueta dos veces devuelve 201 y la duplica | `tasks.service.ts` → `addTag` |
| 20 | US-15 | `las etiquetas se normalizan a minúsculas` | Las etiquetas no se pasan a minúsculas | `tasks.service.ts` → `addTag` |

### Observado, sin test que falle

- **SQL injection en la búsqueda:** `findTasks` arma el SQL concatenando `search` con `$queryRawUnsafe`. Viola el RNF de Seguridad 1.

## Ramas que no se pueden alcanzar

- `membership.ts`: los `if (!req.user)` nunca se ejecutan, porque `authenticate` corre antes y ya corta con 401.
- `tasks.controller.ts`: los `if (taskId === null)` de `getOne` y `history`, porque el middleware de membresía ya devolvió 404 antes.
