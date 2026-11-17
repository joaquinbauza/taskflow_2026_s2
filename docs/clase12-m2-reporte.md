# Práctico de Seguridad y Accesibilidad — Clase 11, Módulo 2 · TaskFlow

**Fecha:** 16/11/2026 · **Rama:** `entrega-final` · **Entorno:** Windows 11 Pro, Node 22.23.5, API local `http://localhost:3000/api` (seed: `ana@test.com`, `bob@test.com`, `caro@test.com` / `Password1`), Chromium 131 (Playwright 1.49.1), axe-core vía `@axe-core/playwright` 4.14.

Adaptación de la guía: `apps/api` → `server/` (puerto 3000, prefijo `/api`), `apps/web` → `client/` (5173), `e2e/playwright/tests` → `e2e/tests/`, alice/bob → ana/bob.

Evidencia: [`evidencias/seguridad/pruebas-api.md`](evidencias/seguridad/pruebas-api.md) (cada comando con su expectativa escrita antes y la respuesta HTTP real), script reproducible [`pruebas-api.sh`](evidencias/seguridad/pruebas-api.sh), salidas de `npm audit` en [`evidencias/seguridad/`](evidencias/seguridad/), informe axe en [`evidencias/a11y-informe.txt`](evidencias/a11y-informe.txt) y verificación de la corrección en [`a11y-verificacion-antes.txt`](evidencias/a11y-verificacion-antes.txt) / [`a11y-verificacion-despues.txt`](evidencias/a11y-verificacion-despues.txt).

## Análisis de dependencias (`npm audit`)

| Alcance | Resultado | HIGH/CRITICAL | ¿Afecta producción? |
|---|---|---|---|
| Raíz, todo | 10 (7 moderate, 2 high, 1 critical) | `shell-quote` (critical, inyección de comandos en `quote()`), `playwright <1.55.1` (high, descarga navegadores sin verificar TLS) | **No**: son devDependencies (`concurrently`, `@playwright/test`). `npm audit --omit=dev` en la raíz: **0 vulnerabilidades** |
| `server/` producción (`--omit=dev`) | 7 (1 moderate, 6 high) | `body-parser` y `path-to-regexp` vía `express@4.21.2` (DoS / ReDoS), `deepmerge-ts` vía `@prisma/config` | **Sí**: `express` es dependencia de runtime de la API. Fix: `express@4.22.3` (fuera del rango fijado) |
| `client/` producción (`--omit=dev`) | 3 high | `@remix-run/router` ≤1.23.2 (XSS vía open redirect) vía `react-router-dom` | **Sí**, va en el bundle. Fix: `react-router-dom@6.30.6` |

Conclusión: sí hay 2+ vulnerabilidades HIGH/CRITICAL. Las de la raíz son de desarrollo (no llegan a producción); las de `express` y `react-router-dom` **sí** afectan producción y conviene actualizarlas (no se hizo: el práctico es de testeo y reporte).

## 4.1 Hallazgos de seguridad

### SEC-01 · Inyección SQL en la búsqueda de tareas expone tareas de cualquier proyecto

| Campo | Valor |
|---|---|
| Severidad | **CRITICAL** |
| CVSS 3.1 (estimado) | 8.1 — AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N |
| Criterio | Seguridad 1: "Toda entrada del usuario se trata como dato y nunca se concatena a una consulta a la base de datos" · US-07 |
| Relacionado | BUG-09, [ISSUE-07](issues/ISSUE-07-sql-injection-busqueda.md), GitHub [#8](https://github.com/joaquinbauza/taskflow_2026_s2/issues/8) |

**Descripción.** `GET /api/projects/:id/tasks?search=…` arma el SQL concatenando `search` y lo ejecuta con `$queryRawUnsafe` (`server/src/modules/tasks/tasks.repository.ts`). Un usuario autenticado puede salir del filtro del proyecto.

**Pasos.**
1. ana crea el proyecto privado `proj-4` con la tarea "Plan secreto de ana" (bob no es miembro).
2. Como bob, `curl -G http://localhost:3000/api/projects/proj-1/tasks --data-urlencode "search=') > 0) OR 1=1 --" -H "Authorization: Bearer $BOB"`.

**Expectativa (escrita antes):** 200 con `items: []`. **Obtenido:** 200 con las tareas de `proj-1`, `proj-2` y `proj-4`, incluida "Plan secreto de ana".

**Impacto.** Confidencialidad total de las tareas de todos los usuarios; con `$queryRawUnsafe` también es posible leer otras tablas (p. ej. `users.passwordHash`) con `UNION`. Anula el control de acceso de SEC-control (abajo).

**Remediación.** Reemplazar `$queryRawUnsafe` por el query builder de Prisma (`title: { contains: search }` / `OR` con `description`) o por `$queryRaw` con template parametrizado. Agregar el test de regresión (ya existe como `knownBug` en `server/tests/bugs.test.ts › BUG-09`).

### SEC-02 · Secreto JWT por defecto embebido en el código: cualquiera puede forjar tokens

| Campo | Valor |
|---|---|
| Severidad | **HIGH** |
| CVSS 3.1 (estimado) | 8.8 — AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N cuando falta `JWT_SECRET` (caso del `.env.example` actual) |
| Criterio | Seguridad (autenticación): solo la API emite tokens válidos; US-02 c7 |
| Relacionado | BUG-21, [ISSUE-17](issues/ISSUE-17-secreto-jwt-por-defecto.md), GitHub [#18](https://github.com/joaquinbauza/taskflow_2026_s2/issues/18) |

**Descripción.** `server/src/middleware/auth.ts`: `export const JWT_SECRET = process.env.JWT_SECRET ?? 'taskflow-dev-secret'`. `server/.env.example` no define `JWT_SECRET`, así que una instalación siguiendo el README firma con un secreto público (está en el repo).

**Pasos.**
1. `cp server/.env.example server/.env` y `npm run dev:server` (como indica el README).
2. Forjar: `node -e "console.log(require('jsonwebtoken').sign({userId:1,email:'ana@test.com'},'taskflow-dev-secret',{expiresIn:'24h'}))"`.
3. `curl -i http://localhost:3000/api/projects -H "Authorization: Bearer <token forjado>"`.

**Expectativa (escrita antes):** 401. **Obtenido:** `HTTP/1.1 200 OK` con los proyectos de ana. Sin conocer su contraseña se suplanta a cualquier usuario (basta con su id numérico, que es secuencial).

**Impacto.** Toma de cuenta de cualquier usuario en cualquier despliegue que no configure `JWT_SECRET`.

**Remediación.** Quitar el fallback y hacer fallar el arranque si `JWT_SECRET` no está definido (o es corto); agregar `JWT_SECRET=` a `.env.example` con instrucción de generarlo; rotar el secreto.

### Otras observaciones (sin ID, prioridad menor)

- **Headers:** `X-Powered-By: Express` presente; faltan `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security` (no hay `helmet`). **CORS** `Access-Control-Allow-Origin: *` incluso para `Origin: https://evil.example` (mitigado porque el token va en header, no en cookie).
- **Fuerza bruta:** la cuenta se bloquea a los 5 fallos (control que funciona), pero **no hay rate limit por IP**: 30 logins seguidos a cuentas distintas responden 401, nunca 429 → enumeración/credential stuffing distribuido sin freno. Además el bloqueo por cuenta permite bloquear a propósito a un usuario (DoS dirigido).
- **XSS almacenado:** `<img src=x onerror=alert(1)>` se guarda tal cual en título y comentario (201). En el front **no se ejecuta**: React escapa el texto en JSX y no hay `dangerouslySetInnerHTML`/`innerHTML` en `client/src` (revisado por código). Riesgo latente si otro consumidor renderiza HTML.

## 4.2 Control verificado: autorización por membresía (IDOR) y validación del JWT

| Qué se probó | Esperado | Obtenido |
|---|---|---|
| bob `GET /projects/proj-4/tasks` (proyecto privado de ana) | 403 | **403** FORBIDDEN |
| bob `GET /tasks/task-14` | 403 | **403** |
| bob `PATCH /tasks/task-14` `{title:"Hackeado por bob"}` | 403 y título intacto | **403**; `GET` de ana devuelve "Plan secreto de ana" |
| bob `DELETE /tasks/task-14` | 403 | **403** |
| bob `GET /tasks/task-14/comments` | 403 | **403** |
| bob `PATCH`/`DELETE /projects/proj-4` | 403/404 | **404** (no revela que existe) |
| JWT `alg: none` / firma alterada / vencido | 401 | **401** en los tres |

**Qué parte del código lo explica.** `server/src/middleware/membership.ts`: `requireProjectMember` y `requireTaskProjectMember` buscan la tarea/proyecto y llaman a `isMember(userId, projectId)` antes del controlador; las rutas de tareas (`tasks.routes.ts`, incluidas PATCH/DELETE desde el arreglo de BUG-07) y de comentarios (`comments.task-routes.ts`, `router.use(requireTaskProjectMember('taskId'))`) los aplican. El JWT se valida con `jwt.verify(token, JWT_SECRET)` (`middleware/auth.ts`), que rechaza `alg: none` (no está en los algoritmos permitidos para un secreto HMAC), firmas inválidas y `exp` vencido. El control falla solo si se combina con SEC-01 (la inyección saltea el filtro) o SEC-02 (el token forjado es "válido").

## 4.3 Hallazgos de accesibilidad

Resultado automático (axe, WCAG 2.1 A + AA): Login 0, Registro 0, Proyectos 0, Detalle de proyecto (tablero) 0, **Detalle de tarea 1 regla (2 elementos)**. Los otros dos hallazgos salen de la revisión manual del código.

| ID | SC WCAG 2.1 | Nivel | POUR | Cómo se detectó | Vista | Descripción | Fix |
|---|---|---|---|---|---|---|---|
| **ACC-01** | 4.1.2 Nombre, función, valor (y 1.3.1) | A | Robusto | axe, regla `label` (impacto *critical*) | Detalle de tarea | El input "agregar etiqueta" (`tag-add-input`) y el textarea de comentario (`comment-add-input`) no tienen `<label>` ni `aria-label`: un lector de pantalla anuncia "edit text" sin propósito | **Corregido**: `aria-label="Nueva etiqueta"` y `aria-label="Nuevo comentario"` en `TaskDetailPage.tsx` (sin tocar `data-testid`). `VERIFICAR.regla = 'label'` pasó de rojo a verde |
| **ACC-02** | 1.3.5 Identificar el propósito de la entrada | AA | Perceptible | Revisión manual de `LoginPage.tsx` (axe no lo detecta: solo valida `autocomplete` inválidos, no ausentes) | Login y Registro | Email es `type="text"` sin `autocomplete="email"`; contraseña sin `autocomplete="current-password"` / `"new-password"`; nombre sin `autocomplete="name"`. Gestores de contraseñas y usuarios con dificultades motoras/cognitivas no reciben autocompletado | `type="email"` + `autoComplete` correspondiente en cada campo |
| **ACC-03** | 3.3.1 Identificación de errores (y 1.3.1) | A | Comprensible | Revisión manual (`lib/ui.tsx`, `TaskDetailPage.tsx`, `LoginPage.tsx`) | Detalle de tarea, Login | Los errores (`ErrorMessage`, `role="alert"`) se anuncian pero no se asocian al campo: no hay `aria-invalid` ni `aria-describedby`, y el texto es el de la API en inglés ("title must be between 3 and 200 characters"). Quien usa lector no sabe qué campo corregir | `aria-invalid` + `aria-describedby` apuntando al mensaje; mensajes en español que nombren el campo |

Observación adicional (best-practice, no WCAG A/AA en axe): el Detalle de tarea no tiene `<h1>` (`page-has-heading-one`), dificulta la navegación por encabezados (relacionado con 2.4.6/1.3.1).

**Para confirmar a mano con Tab / Enter / Shift+Tab** (no lo pude hacer con teclado real):
1. Login: Tab recorre Email → Contraseña → Ingresar → "No tengo cuenta"; Enter en el toggle cambia de modo y el foco no se pierde.
2. El foco es visible en todos los controles: `client/src/styles.css` **no** tiene `outline: none` (se usa el anillo por defecto del navegador); verificar que se vea sobre los fondos de las tarjetas.
3. Tablero: el `<select>` de estado de cada tarjeta se puede cambiar con flechas y dispara el PATCH; los títulos de tarjeta son `<Link>` (enfocables con Tab).
4. Detalle de tarea: después de un error al guardar, ¿el lector anuncia el `role="alert"`? ¿El foco queda en el botón Guardar?
5. No hay elementos clickeables que no sean `<button>`/`<a>` (revisado: los `onClick` están solo en `<button>`).

**Resultado de la confirmación manual (16/11/2026, solo teclado, sin mouse):**
- ✅ **Login:** se completa y se envía el formulario solo con Tab / Shift+Tab / Enter (`ana@test.com`).
- ✅ **Navegación:** con Tab y Shift+Tab se recorren todos los controles de Proyectos, Tablero y Miembros, y se entra al tablero y a la pantalla de miembros con Enter.
- ✅ **Foco visible (SC 2.4.7, AA):** en todo momento se ve qué elemento tiene el foco.
- No se probó con teclado: agregar un miembro, cambiar el estado de una tarea con las flechas ni guardar en el Detalle de tarea (puntos 3 y 4 de la lista).
- No se encontraron problemas nuevos: la navegación por teclado no agrega hallazgos a ACC-01..03.

## 4.4 User Stories de remediación

### US-SEC-01 · Búsqueda de tareas sin inyección SQL (SEC-01)

**Como** miembro de un proyecto **quiero** que lo que escribo en el buscador se trate siempre como texto **para** que nadie pueda ver ni alterar tareas de proyectos a los que no pertenece.

Criterios de aceptación (testeables):
1. `GET /projects/:id/tasks?search=') > 0) OR 1=1 --` responde 200 con `items: []` y `total: 0` cuando ninguna tarea del proyecto contiene ese texto (test de integración `BUG-09` pasa de `knownBug` a `it`).
2. Para cualquier `search`, todos los `items` devueltos tienen `projectId` igual al `:id` de la ruta (test parametrizado con al menos 10 payloads de inyección: `'`, `"`, `--`, `UNION SELECT`, `%`, `_`, `\`).
3. `grep -rn "queryRawUnsafe\|executeRawUnsafe" server/src` no devuelve resultados (chequeo en el pipeline).

### US-ACC-01 · Campos del detalle de tarea con nombre accesible (ACC-01)

**Como** persona que usa lector de pantalla **quiero** que cada campo del detalle de tarea anuncie su propósito **para** poder agregar etiquetas y comentarios sin adivinar qué escribir.

Criterios de aceptación (testeables):
1. La auditoría axe (`e2e/tests/a11y.spec.ts`, WCAG 2.1 A/AA) de la vista "Detalle de tarea" reporta 0 violaciones de la regla `label`.
2. `page.getByRole('textbox', { name: 'Nueva etiqueta' })` y `page.getByRole('textbox', { name: 'Nuevo comentario' })` encuentran exactamente un elemento cada uno.
3. Todo `<input>`, `<select>` y `<textarea>` de `client/src/pages/*.tsx` tiene nombre accesible: axe con la regla `label` y `select-name` da 0 violaciones en las 5 vistas auditadas.

## Checklist de entrega

- [x] `npm audit` y `npm audit --omit=dev` analizados (raíz, server, client) con impacto en producción.
- [x] Tokens de ana y bob obtenidos con `curl` a `/api/auth/login`.
- [x] Headers de seguridad y CORS revisados con `curl -I`.
- [x] Control de acceso (IDOR) probado con dos usuarios sobre proyectos, tareas y comentarios.
- [x] Inyecciones (SQL, XSS almacenado), JWT manipulado (`alg: none`, firma alterada, vencido) y fuerza bruta, con la expectativa escrita antes.
- [x] 2 hallazgos de seguridad (SEC-01, SEC-02) con todos los campos + 1 control verificado.
- [x] `@axe-core/playwright` instalado y `e2e/tests/a11y.spec.ts` adaptado (Login, Registro, Proyectos, Detalle de proyecto + Detalle de tarea).
- [x] Informe guardado en `docs/evidencias/a11y-informe.txt`.
- [x] Revisión manual por código (teclado, foco, labels, errores); 2 de 3 hallazgos vienen de ahí.
- [x] 1 violación corregida (`label`) sin cambiar `data-testid`; `VERIFICAR.regla` rojo → verde; E2E siguen pasando (36/36).
- [x] 3 hallazgos de accesibilidad (ACC-01..03) con SC, nivel, POUR, detección, vista, descripción y fix.
- [x] 2 User Stories de remediación con 3 criterios testeables cada una.
- [x] Confirmación manual con teclado: login, navegación por Proyectos, Tablero y Miembros, y foco visible (ver resultado arriba).
