# Taller de refinamiento (Clase 2) — Épica C "Organización del trabajo"

> **Épica C:** "Como equipo, necesitamos asignar, etiquetar y priorizar tareas según su fecha límite".

En la especificación ([`taskflow_especificacion_requerimientos.docx`](../taskflow_especificacion_requerimientos.docx), fuente de verdad) esta épica es la **Épica 4 — Organización del trabajo del equipo**, con US-14 (asignar, Alta / 3 SP), US-15 (etiquetar, Media / 2 SP) y US-16 (fecha de vencimiento, Media / 3 SP). El taller la descompone en 6 historias más chicas, todas consistentes con esos criterios: no agregan comportamiento que la spec no pida. Lo que la épica sugiere y la spec no define está en [Huecos para el Product Owner](#huecos-para-el-product-owner).

Convenciones de la API usadas en los criterios: rutas bajo `/api`, ids prefijados (`task-1`, `user-2`), errores `{ error: { code, message } }`.

## Historias

### RT-01 · Asignar una tarea a un miembro

**Como** miembro del proyecto **quiero** asignar una tarea sin asignado a otro miembro **para** que quede claro quién se ocupa de ella.

**INVEST:** independiente de etiquetas y fechas; negociable en la UI (selector o API); valiosa porque reparte el trabajo; estimable (un campo y una validación); chica (≈2 SP, mitad de US-14); testeable con un PATCH y su status.

Criterios de aceptación:
1. `PATCH /tasks/:id` con `assigneeId` de un miembro del proyecto responde **200** y `GET /tasks/:id` devuelve ese `assigneeId` (US-14 c1).
2. Si el `assigneeId` no es miembro del proyecto, responde **400** `VALIDATION_ERROR` y la tarea sigue sin asignado (US-14 c1).
3. Cualquier miembro puede asignar, no solo el owner: un miembro no owner recibe **200** (US-14 c4).
4. Asignar una tarea inexistente responde **404** `NOT_FOUND` (US-14 c6).

```gherkin
Scenario: Asignar una tarea a un miembro del proyecto
  Given que "bob@test.com" es miembro del proyecto de la tarea "task-1"
  And la tarea "task-1" no tiene asignado
  When envío PATCH /tasks/task-1 con assigneeId "user-2"
  Then la respuesta tiene status 200
  And la tarea "task-1" queda asignada a "bob@test.com"
```

### RT-02 · Reasignar o desasignar una tarea

**Como** miembro del proyecto **quiero** cambiar el asignado de una tarea o dejarla sin asignado **para** redistribuir el trabajo cuando cambian las prioridades.

**INVEST:** depende solo de que exista la asignación (RT-01), no de su UI; valiosa porque el reparto cambia durante el sprint; chica (≈1 SP); cada criterio se decide con un PATCH y un GET.

Criterios de aceptación:
1. Una tarea asignada a un miembro se reasigna a otro miembro: **200** y el `assigneeId` nuevo (US-14 c2).
2. `assigneeId: null` deja la tarea sin asignado: **200** y `assigneeId: null` (US-14 c3).
3. Asignar, reasignar o desasignar **no cambia** el `status` de la tarea (US-14 c5).

```gherkin
Scenario: Desasignar una tarea
  Given que la tarea "task-1" está asignada a "bob@test.com"
  And la tarea "task-1" está en estado "IN_PROGRESS"
  When envío PATCH /tasks/task-1 con assigneeId nulo
  Then la respuesta tiene status 200
  And la tarea "task-1" queda sin asignado
  And la tarea "task-1" sigue en estado "IN_PROGRESS"
```

### RT-03 · Etiquetar una tarea

**Como** miembro del proyecto **quiero** agregar etiquetas a una tarea **para** categorizarla y encontrarla más rápido.

**INVEST:** independiente de asignación y fechas; valiosa para organizar el tablero; estimable (normalización + unicidad + límites); chica (≈1-2 SP); los 4 criterios se verifican con POST y GET.

Criterios de aceptación:
1. `POST /tasks/:id/tags` con `"  Backend "` responde **201** y la tarea queda con la etiqueta `backend`: minúsculas y sin espacios en los extremos (US-15 c1).
2. Agregar `bug` o `BUG` a una tarea que ya tiene `bug` responde **200** y la tarea sigue con **exactamente 1** etiqueta `bug` (US-15 c2, c3).
3. Una etiqueta vacía o de más de 30 caracteres responde **400**; una de 30 se acepta (US-15 c4).
4. Con 10 etiquetas, agregar la 11.ª responde **400** y la tarea sigue con 10 (US-15 c5).

```gherkin
Scenario: Agregar la misma etiqueta con otra capitalización no la duplica
  Given que la tarea "task-1" ya tiene la etiqueta "bug"
  When envío POST /tasks/task-1/tags con nombre "BUG"
  Then la respuesta tiene status 200
  And la tarea "task-1" tiene exactamente 1 etiqueta
  And esa etiqueta se llama "bug"
```

### RT-04 · Quitar una etiqueta de una tarea

**Como** miembro del proyecto **quiero** quitar una etiqueta que ya no corresponde **para** que la categorización de la tarea siga siendo correcta.

**INVEST:** independiente de cómo se agregó la etiqueta (puede prepararse por API); valiosa para corregir errores; muy chica (≈0,5 SP); verificable con DELETE y GET.

Criterios de aceptación:
1. `DELETE /tasks/:id/tags/:tagId` de una etiqueta que la tarea tiene responde **204** y la etiqueta ya no aparece en `GET /tasks/:id` (US-15 c6, caso feliz).
2. Quitar una etiqueta que la tarea no tiene responde **404** (US-15 c6).
3. Un usuario que no es miembro del proyecto recibe **403** al agregar o quitar etiquetas, y las etiquetas no cambian (US-15 c7).

```gherkin
Scenario: Quitar una etiqueta que la tarea no tiene
  Given que la tarea "task-1" tiene solo la etiqueta "backend"
  When envío DELETE /tasks/task-1/tags/tag-99
  Then la respuesta tiene status 404
  And la tarea "task-1" sigue teniendo la etiqueta "backend"
```

### RT-05 · Cargar la fecha de vencimiento

**Como** miembro del proyecto **quiero** cargarle a una tarea su fecha límite **para** priorizar el trabajo según urgencia.

**INVEST:** independiente de asignación y etiquetas; valiosa porque es la base de "priorizar según fecha límite"; estimable; chica (≈2 SP); testeable con PATCH + GET, incluida la zona horaria.

Criterios de aceptación:
1. `PATCH /tasks/:id` con `dueDate: "2026-09-15"` responde **200** y la fecha se devuelve como día calendario ISO, sin hora (US-16 c1, c2).
2. `GET /tasks/:id` devuelve **exactamente** `"2026-09-15"` con el servidor en `America/Montevideo` (UTC-3) y en UTC (US-16 c3).
3. Una fecha con formato inválido (`15/09/2026`, `2026-02-30`, `2026-13-01`, `""`) responde **400** (US-16 c6).
4. Un usuario que no es miembro recibe **403** y la fecha de la tarea no cambia (US-16 c8).

```gherkin
Scenario: La fecha no cambia según la zona horaria
  Given que el servidor corre en la zona horaria "America/Montevideo"
  And soy miembro del proyecto de la tarea "task-1"
  When envío PATCH /tasks/task-1 con dueDate "2026-09-15"
  And consulto la tarea "task-1"
  Then la respuesta tiene status 200
  And la fecha de vencimiento que recibo es "2026-09-15"
```

### RT-06 · Tareas sin vencimiento, quitar la fecha y fechas pasadas

**Como** miembro del proyecto **quiero** poder dejar una tarea sin fecha, quitarle la que tenía o cargarle una ya pasada **para** reflejar tareas sin plazo y registrar las que ya están vencidas.

**INVEST:** independiente de RT-05 en el código de test (se prepara la fecha por API); valiosa porque no todo tiene plazo; chica (≈1 SP); cada criterio es un status y un valor.

Criterios de aceptación:
1. Una tarea creada sin `dueDate` devuelve `dueDate: null` (US-16 c4).
2. `PATCH /tasks/:id` con `dueDate: null` responde **200** y `GET /tasks/:id` devuelve `dueDate: null` (US-16 c5).
3. Una fecha pasada (`2020-01-01`) se acepta: **200** y se devuelve `"2020-01-01"` (US-16 c7).

```gherkin
Scenario: Quitar la fecha de vencimiento
  Given que la tarea "task-1" tiene dueDate "2026-09-15"
  When envío PATCH /tasks/task-1 con dueDate nulo
  Then la respuesta tiene status 200
  And la tarea "task-1" no tiene fecha de vencimiento
```

## Trazabilidad

| Historia del taller | US de la spec (criterios) | Tests que ya la cubren en el repo | Estado |
|---|---|---|---|
| RT-01 Asignar | US-14 c1, c4, c6 | `server/tests/tareas.integration.test.ts › crear › rechaza asignar a alguien que no es miembro (400)` y `› editar y asignar › cualquier miembro puede asignar y desasignar, sin cambiar el estado`; `server/tests/characterization/tasks-service.characterization.test.ts › assigneeId al crear y al editar`; E2E `e2e/tests/e2e/us-14-asignar.spec.ts › US-14 c1 · el owner asigna…`, `› US-14 c1 · error: asignar a alguien que no es miembro…`, `› US-14 c4 · un miembro que no es owner también puede asignar`; 404: `tareas.integration.test.ts › editar y asignar › editar una tarea inexistente devuelve 404` | ✅ cubierta (c6 se cubre por la misma ruta PATCH) |
| RT-02 Reasignar / desasignar | US-14 c2, c3, c5 | `tareas.integration.test.ts › cualquier miembro puede asignar y desasignar, sin cambiar el estado`; E2E `us-14-asignar.spec.ts › US-14 c2 · una tarea asignada se reasigna…`, `› US-14 c3 · borde: se desasigna eligiendo "Sin asignar"`, `› US-14 c5 · asignar no modifica el estado` | ✅ cubierta |
| RT-03 Etiquetar | US-15 c1-c5 | `tareas.integration.test.ts › etiquetas › agrega una etiqueta (201)…`, `› no admite más de 10 etiquetas (400)`; `server/tests/bugs.test.ts › BUG-17` (3 `knownBug`); E2E `e2e/tests/e2e/us-15-etiquetas.spec.ts › US-15 c1`, `› US-15 c4 · borde: se acepta una etiqueta de 30 caracteres y se rechaza una de 31 (400)`, `› US-15 c5 · error: con 10 etiquetas, agregar la 11.ª devuelve 400…` y 3 `test.fail` (c1, c2, c3) | ⚠️ c1-c3 fallan por **BUG-17** ([#3](https://github.com/joaquinbauza/taskflow_2026_s2/issues/3)) |
| RT-04 Quitar etiqueta | US-15 c6, c7 | `tareas.integration.test.ts › etiquetas › quita una etiqueta (204) y quitar una que no tiene devuelve 404`; E2E `us-15-etiquetas.spec.ts › US-15 c6 · quitar una etiqueta la saca de la tarea (204)` | ⚠️ c7 (403 en etiquetas) **sin test específico**: lo cubre indirectamente el middleware `requireTaskProjectMember` (control verificado en [`clase12-m2-reporte.md`](clase12-m2-reporte.md#42-control-verificado-autorización-por-membresía-idor-y-validación-del-jwt)) |
| RT-05 Cargar fecha | US-16 c1, c2, c3, c6, c8 | `server/tests/us16-ia.integration.test.ts` (c1, c2, c3, c6 ×6, c8 ×3); `server/tests/unit/ids.test.ts › [BUG-03]`, `› [BUG-04]`; `tareas.integration.test.ts › crear › rechaza una fecha de vencimiento con formato inválido (400)`, `› la fecha devuelta es la misma que se cargó…`; E2E `e2e/tests/e2e/us-16-vencimiento.spec.ts › US-16 c3`, `› US-16 c2` (`test.fail`), `› US-16 c8 · error: un ex-miembro no puede cambiar la fecha (403)` | ⚠️ c2/c3 fallan por **BUG-03** ([#2](https://github.com/joaquinbauza/taskflow_2026_s2/issues/2)); `2026-02-30` por **BUG-04** ([#5](https://github.com/joaquinbauza/taskflow_2026_s2/issues/5)) |
| RT-06 Sin fecha / quitar / pasada | US-16 c4, c5, c7 | `tareas.integration.test.ts › editar y asignar › permite quitar la fecha de vencimiento enviando null`; `us16-ia.integration.test.ts › US-16 c4`, `› US-16 c5` (×2), `› US-16 c7 · una fecha pasada se acepta…`; E2E `us-16-vencimiento.spec.ts › US-16 c4`, `› US-16 c5 · borde: vaciar el campo…`, `› US-16 c7` (×2) | ⚠️ c7 (fecha pasada devuelta igual) falla por **BUG-03** |

## Huecos para el Product Owner

La épica dice "**priorizar** tareas según su fecha límite", pero la spec no lo define más allá de cargar la fecha. Quedan como preguntas para el próximo refinamiento, no como historias (agregarlas sería inventar requisitos):

1. **Orden por vencimiento.** US-07 permite filtrar por `status`, `priority`, `assignedTo` y `search`, pero no ordenar ni filtrar por `dueDate`. ¿El tablero debe mostrar primero lo que vence antes?
2. **Tarea vencida.** US-16 c7 dice que con una fecha pasada "la tarea se considera vencida", pero no dice cómo se expone (campo, filtro, color en la UI). El test generado por IA que esperaba `overdue: true` se marcó como alucinado ([`clase12-ej2-ia.md`](clase12-ej2-ia.md)) justamente por esto.
3. **Lista de miembros para asignar.** No existe `GET /projects/:id/members`: el selector de asignado de la UI se arma con un caché en `localStorage` (ver Observaciones de [`bugs.md`](bugs.md)). RT-01 se puede cumplir por API, pero en la UI un miembro agregado desde otro navegador no aparece para asignar.
