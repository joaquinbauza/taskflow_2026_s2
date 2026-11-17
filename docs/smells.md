# Code smells del backend y su refactor

**Refactor:** commit [`18e7f19`](https://github.com/joaquinbauza/taskflow_2026_s2/commit/18e7f19) "refactor(backend): corregir cinco code smells" (09/09/2026). Las líneas de "Dónde estaba" son las del archivo en `18e7f19^` (justo antes del refactor). **Tests de caracterización:** [`server/tests/characterization/`](../server/tests/characterization/) (17 tests, 14 snapshots).

## Tabla de smells

| # | Smell (catálogo) | Dónde estaba (antes de `18e7f19`) | Refactor que lo resolvió | Commit | Estado hoy | Test de caracterización |
|---|---|---|---|---|---|---|
| 1 | **Duplicated Code** (Fowler): tres validaciones de email distintas, cada una con su regex | `server/src/modules/auth/auth.service.ts:9-16` (`EMAIL_PATTERN` + `checkEmail`, usado en `:40` y `:90`); `server/src/modules/projects/projects.controller.ts:7` y `:143-144` (`EMAIL_CHECK` en `addMember`); la versión común ya existía en `server/src/lib/validation.ts:3-14` (`assertEmail`) | *Substitute Algorithm* + reemplazo por llamada a la función existente: `register`, `forgotPassword` y `addMember` llaman a `assertEmail`, que recibe el mensaje como parámetro opcional (`validation.ts`) para conservar `"email must be a valid address"` en miembros. Efecto lateral buscado: `checkEmail` rechazaba direcciones con `+` que `assertEmail` acepta | `18e7f19` | ✅ Resuelto. El código viejo quedó comentado y se borró en el commit `refactor: eliminar código comentado del refactor de smells` | `email-validation.characterization.test.ts` |
| 2 | **Magic Number** (Fowler: *Replace Magic Literal*): `10`, `5`, `15 * 60 * 1000`, `24`, `60 * 60 * 1000` sueltos en la lógica de autenticación | `auth.service.ts:48` y `:123` (rondas de bcrypt), `:72` (intentos), `:73` (bloqueo), `:100` (bytes del token), `:105` (vigencia del token) | *Replace Magic Literal*: constantes `PASSWORD_HASH_ROUNDS`, `MAX_LOGIN_ATTEMPTS`, `ACCOUNT_LOCK_DURATION_MS`, `RESET_TOKEN_BYTES` y `RESET_TOKEN_DURATION_MS` | `18e7f19` | ⚠️ **Revertido.** El commit `de67599` ("mas cambios", un minuto después) volvió a poner los literales en `auth.service.ts` y sacó las constantes. El smell está presente hoy en `main` | `auth-constants.characterization.test.ts` |
| 3 | **Tipado débil con `any`** (smell propio de TypeScript; regla `@typescript-eslint/no-explicit-any`) | `server/src/modules/comments/comments.service.ts:7` (`serialize(c: any)`) y `:26` (`create(..., body: any)`, con `body?.body`) | Reemplazar `any` por el tipo de Prisma `Comment` en `serialize` y por `unknown` en `create`, con *narrowing* explícito (`typeof body === 'object' && 'body' in body`) | `18e7f19` | ✅ Resuelto | `comments.characterization.test.ts` (tabla de cuerpos aceptados y forma de `serialize`) |
| 4 | **Swallowed Exception** (*error hiding*, "Dummy Handler"): `catch (e) { return null; }` | `comments.service.ts:8-18` (`try`/`catch` en `serialize`) | Quitar el `try`/`catch`: el error se propaga y lo atiende el middleware `errorHandler` (500 `INTERNAL`) en lugar de devolver `null` en la lista | `18e7f19` | ✅ Resuelto (queda un comentario explicativo en `serialize`, que documenta el cambio) | `comments.characterization.test.ts › serialize() propaga el error` |
| 5 | **Long Method** con **condicionales anidados** (*Arrow Code*) y lógica duplicada entre `createTask` y `updateTask` | `server/src/modules/tasks/tasks.service.ts:48-56` (asignado en `createTask`), `:115-131` (asignado en `updateTask`, 4 niveles de `if/else`) y `:133-154` (cambio de estado, con dos ramas que repetían `assertTransition` + `nextStatus = requested` y dos `throw forbidden` iguales) | *Extract Function* (`parseAssigneeId`, `resolveStatusChange`) + *Consolidate Conditional Expression* (`!membership \|\| (role !== 'OWNER' && role !== 'ADMIN')`) + *Replace Nested Conditional with Guard Clauses* | `18e7f19` | ✅ Resuelto | `tasks-service.characterization.test.ts` |

Además, `18e7f19` unificó la validación del nombre de proyecto en `validateProjectName` (`projects.controller.ts`, antes duplicada en `create:31` y `update:90`). `de67599` también revirtió eso: hoy `create` y `update` vuelven a tener cada uno su copia (Duplicated Code). Lo cubre `project-name.characterization.test.ts`, que verifica que las dos copias se comportan igual.

## Tests de caracterización

**Aclaración honesta:** estos tests se escribieron **después** del refactor (17/11/2026), no antes. El refactor de `18e7f19` se hizo sin una red de seguridad propia (su mensaje dice "Tests de integración pendientes por un fallo de Prisma"). Por eso no prueban que `18e7f19` haya preservado el comportamiento: **fijan el comportamiento actual** del código que tocó cada smell, para que el próximo refactor (por ejemplo, volver a extraer las constantes del smell 2 o unificar otra vez el nombre de proyecto) se pueda hacer con la garantía de que nada observable cambia.

Técnica: *golden master*. Cada test recorre una tabla de entradas (emails, cuerpos de comentario, valores de `assigneeId`, actores, pares de estados, nombres) contra la API real (`createApp()` + Supertest, una base SQLite por archivo) y guarda status y body en `server/tests/characterization/__snapshots__/*.snap`, versionados en el repo. Las fechas y los tokens se reemplazan por marcadores (`<fecha ISO>`, `<48 hex>`) para que el resultado sea determinista. Si un cambio de comportamiento es **intencional**, se regenera con `npx jest tests/characterization -u` (desde `server/`) y se revisa el diff del `.snap` en el PR.

| Archivo | Qué fija |
|---|---|
| `email-validation.characterization.test.ts` | 13 emails en `register`, `forgot-password` y `members`: cuáles se aceptan, normalización (minúsculas, `trim`), mensaje de error de cada ruta |
| `auth-constants.characterization.test.ts` | bcrypt con costo 10 (`$2a$10$`); bloqueo en el 5.º fallo y por 15 min; token de 48 hex con vigencia de 60 min; qué pasa con el contador tras un login exitoso y tras un bloqueo vencido |
| `comments.characterization.test.ts` | 13 cuerpos de comentario (límites 1/1000, tipos no string, campo equivocado, array); forma de `serialize`; orden del listado; que un error de serialización se propaga |
| `tasks-service.characterization.test.ts` | 9 valores de `assigneeId` al crear y al editar; quién puede cambiar el estado (owner, admin, asignado, no asignado, ajeno); matriz completa de transiciones con estados inválidos y filas de historial |
| `project-name.characterization.test.ts` | 9 nombres en `POST` y `PATCH` (vacío, espacios, 2/3/100/101 caracteres, no string) |

### Comportamientos fijados que contradicen la especificación

Los tests registran el comportamiento **actual**, también cuando está mal. No se ajustaron ni se arreglaron (no es el objetivo de un test de caracterización); se anotan acá:

| Comportamiento actual (fijado en el snapshot) | Spec | Bug |
|---|---|---|
| `forgot-password` con un email no registrado responde **404** "No account found for that email"; con uno registrado, 200 **con el token** en el body | US-17 c2: respuesta idéntica exista o no la cuenta | BUG-14 |
| Tras 2 fallos y un login correcto, `failedAttempts` sigue en **2** | US-02 c5: el contador se reinicia tras cada login exitoso | BUG-16 |
| Con el bloqueo vencido, el login correcto entra pero `failedAttempts` queda en **5**: el próximo fallo vuelve a bloquear la cuenta de inmediato | US-02 c4-c6: bloqueo tras 5 fallos **consecutivos** | Consecuencia de BUG-16 |
| `GET /tasks/:id/comments` devuelve **del más nuevo al más viejo** (tercero, segundo, primero) | US-08 c4: orden ascendente por fecha | BUG-13 |
| El owner puede pasar una tarea de **TODO a DONE** (200, se escribe historial) | US-06 c2: no está permitido ir de TODO directamente a DONE | BUG-01 |
| `assigneeId: 1` (número, sin prefijo) se acepta como `user-1` al crear y al editar | Identificadores 1: los recursos se exponen como `'user-1'` | Observación nueva, sin bug registrado: `parsePublicId` acepta enteros y strings sin prefijo |

Comportamientos que llaman la atención pero **sí** cumplen la spec: un miembro no asignado puede editar el título si el `status` que manda es el mismo que el actual (US-12 c5 permite editar a cualquier miembro y solo el cambio de estado está restringido); los mensajes de error de email difieren en mayúscula según la ruta (`Email must…` en auth, `email must…` en miembros), algo que el refactor conservó a propósito.
