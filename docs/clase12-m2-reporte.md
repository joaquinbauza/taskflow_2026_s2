# Práctico de Seguridad y Accesibilidad — Clase 11, Módulo 2 · TaskFlow

**Fecha:** 16/11/2026 · **Rama:** `entrega-final` · **Entorno:** Windows 11 Pro, Node 22.23.5, API local `http://localhost:3000/api` (seed: `ana@test.com`, `bob@test.com`, `caro@test.com` / `Password1`), Chromium 131 (Playwright 1.49.1), axe-core vía `@axe-core/playwright` 4.14.

Adaptación de la guía: `apps/api` → `server/` (puerto 3000, prefijo `/api`), `apps/web` → `client/` (5173), `e2e/playwright/tests` → `e2e/tests/`, alice/bob → ana/bob.

Evidencia: [`evidencias/seguridad/pruebas-api.md`](evidencias/seguridad/pruebas-api.md) (cada comando con su expectativa escrita antes y la respuesta HTTP real), script reproducible [`pruebas-api.sh`](evidencias/seguridad/pruebas-api.sh), salidas de `npm audit` en [`evidencias/seguridad/`](evidencias/seguridad/), informe axe en [`evidencias/a11y-informe.txt`](evidencias/a11y-informe.txt) y verificación de la corrección en [`a11y-verificacion-antes.txt`](evidencias/a11y-verificacion-antes.txt) / [`a11y-verificacion-despues.txt`](evidencias/a11y-verificacion-despues.txt).

## Herramientas

| Herramienta | Versión | Para qué | Evidencia |
|---|---|---|---|
| `npm audit` | npm 10 (Node 22.23.5) | Dependencias con vulnerabilidades conocidas (raíz, `server/`, `client/`) | [`evidencias/seguridad/npm-audit*.txt`](evidencias/seguridad/) |
| `curl` + [`pruebas-api.sh`](evidencias/seguridad/pruebas-api.sh) | curl 8 (Git Bash) | Pruebas manuales de la API: headers, CORS, IDOR, inyección SQL, XSS, JWT, fuerza bruta | [`pruebas-api.md`](evidencias/seguridad/pruebas-api.md) |
| **OWASP ZAP** (baseline scan) | **2.17.0** (imagen `ghcr.io/zaproxy/zaproxy:stable`) | Escaneo pasivo y sin autenticar del front y de la API | [`zap-baseline-web.html`](evidencias/seguridad/zap-baseline-web.html) / [`.json`](evidencias/seguridad/zap-baseline-web.json), [`zap-baseline-api.html`](evidencias/seguridad/zap-baseline-api.html) / [`.json`](evidencias/seguridad/zap-baseline-api.json), salida de consola en `zap-baseline-*.txt` |
| Calculadora CVSS 3.1 | fórmula oficial de FIRST | Puntajes de SEC-01, SEC-02, BUG-14, BUG-15 | [`cvss31.js`](evidencias/seguridad/cvss31.js) → [`cvss31-salida.txt`](evidencias/seguridad/cvss31-salida.txt) |
| `@axe-core/playwright` | 4.14 | Accesibilidad automática (WCAG 2.1 A/AA) | [`evidencias/a11y-informe.txt`](evidencias/a11y-informe.txt) |

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
| Severidad | **HIGH** (CVSS 3.1 8.1; antes figuraba como CRITICAL, que no corresponde a 8.1) |
| CVSS 3.1 | **8.1** — [CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N](https://www.first.org/cvss/calculator/3.1#CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N) (ver [Puntajes CVSS 3.1](#puntajes-cvss-31)) |
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
| Severidad | **CRITICAL** (CVSS 3.1 9.1) |
| CVSS 3.1 | **9.1** — [CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N](https://www.first.org/cvss/calculator/3.1#CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N) cuando falta `JWT_SECRET` (caso del `.env.example` actual). Corregido: antes decía 8.8, pero ese vector da 9.1 |
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

### Puntajes CVSS 3.1

Calculados con la fórmula oficial de FIRST (especificación CVSS v3.1, §7.1 y función *Roundup* del Apéndice A), implementada en [`evidencias/seguridad/cvss31.js`](evidencias/seguridad/cvss31.js) (`node docs/evidencias/seguridad/cvss31.js`; salida en [`cvss31-salida.txt`](evidencias/seguridad/cvss31-salida.txt)). Para validar la implementación, el script también puntúa dos vectores de referencia: `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` → 9.8 y `AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N` → 6.1, los mismos valores que da la calculadora de FIRST. Calculadora: <https://www.first.org/cvss/calculator/3.1> (cada vector de la tabla abre la calculadora precargada).

| ID | Vector | Puntaje | Severidad | Justificación |
|---|---|---|---|---|
| SEC-01 (BUG-09) | [CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N](https://www.first.org/cvss/calculator/3.1#CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N) | **8.1** | HIGH | **AV:N** por HTTP a la API · **AC:L** un único payload en `search`, sin condiciones · **PR:L** hace falta cualquier cuenta (el registro es abierto) y ser miembro de algún proyecto · **UI:N** no participa otra persona · **S:U** el impacto queda en la base de la propia API · **C:H** lee tareas de todos los proyectos y, con `UNION`, otras tablas (`users.passwordHash`) · **I:H** se mantiene la valoración original del equipo: `$queryRawUnsafe` ejecuta SQL armado con la entrada · **A:N** no se demostró denegación de servicio |
| SEC-02 (BUG-21) | [CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N](https://www.first.org/cvss/calculator/3.1#CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N) | **9.1** | CRITICAL | **AV:N** por HTTP · **AC:L** el secreto `taskflow-dev-secret` está en el repo y los ids son secuenciales · **PR:N** se forja el token sin tener cuenta · **UI:N** · **S:U** · **C:H** lee todos los datos de cualquier usuario · **I:H** edita y borra como cualquier usuario · **A:N** no afecta la disponibilidad |
| BUG-14 | [CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N](https://www.first.org/cvss/calculator/3.1#CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N) | **9.1** | CRITICAL | **AV:N** `POST /api/auth/forgot-password` es público · **AC:L** basta conocer o adivinar un email (el 404 de los inexistentes confirma cuáles existen) · **PR:N** el endpoint no pide sesión · **UI:N** el token vuelve en la respuesta, la víctima no recibe ni abre ningún email · **S:U** · **C:H** con el token se hace `reset-password` y se entra a la cuenta: acceso a todos sus datos · **I:H** toma de la cuenta (cambia la contraseña y opera como la víctima) · **A:N** la víctima pierde el acceso a su cuenta, pero el servicio sigue disponible |
| BUG-15 | [CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N](https://www.first.org/cvss/calculator/3.1#CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N) | **7.4** | HIGH | Puntuado **aislado de BUG-14** (mientras el token se devuelva en la respuesta, el camino de ataque es BUG-14, 9.1) · **AV:N** `POST /api/auth/reset-password` es público · **AC:H** el atacante tiene que conseguir un token viejo (usado, invalidado o vencido) por un canal ajeno a la app: un email reenviado, un log, el historial · **PR:N** · **UI:N** · **S:U** · **C:H / I:H** el token viejo sigue cambiando la contraseña: toma de la cuenta (los 3 tests de `bugs.test.ts › BUG-15`) · **A:N** |

Con 9.1, SEC-02 pasa de HIGH a CRITICAL. En [`bugs.md`](bugs.md), BUG-21 (el mismo hallazgo) todavía figura con severidad **Alta**: queda pendiente alinearlo (lo corrige otro integrante en su rama).

## Escaneo OWASP ZAP (baseline)

**Herramienta:** OWASP ZAP **2.17.0**, imagen Docker `ghcr.io/zaproxy/zaproxy:stable`, script `zap-baseline.py` (spider tradicional de 1 minuto + reglas **pasivas**; no envía ataques y no se autentica). Fecha: 17/11/2026, Docker 28.3.3 (Docker Desktop) sobre Windows 11.

**Preparación.** `npm run db:setup` (base nueva con seed), API con `npm run dev:server` y front con `npm --prefix client run dev -- --host 0.0.0.0`. El `--host` hace falta porque Vite, por defecto, escucha solo en `[::1]` y el contenedor llega al host por `host.docker.internal`. La API ya escucha en `0.0.0.0:3000`.

**Comandos exactos** (PowerShell, desde la raíz del repo):

```powershell
docker run --rm -v "${PWD}/docs/evidencias/seguridad:/zap/wrk" -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://host.docker.internal:5173 -r zap-baseline-web.html -J zap-baseline-web.json -I
docker run --rm -v "${PWD}/docs/evidencias/seguridad:/zap/wrk" -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://host.docker.internal:3000/api/projects -r zap-baseline-api.html -J zap-baseline-api.json -I
```

`-I` hace que las advertencias no den exit ≠ 0. La salida de consola de cada corrida está en `zap-baseline-web.txt` y `zap-baseline-api.txt`.

**URLs escaneadas.** Front: `http://host.docker.internal:5173` (7 URLs; el spider de una SPA solo ve `/`, `/@vite/client`, `/src/main.tsx`, `robots.txt` y `sitemap.xml`). API: `http://host.docker.internal:3000/api/projects` (6 URLs: `/api/projects` responde 401 sin token; `/`, `/api`, `robots.txt` y `sitemap.xml` responden 404).

**Resultado:** 0 FAIL. Front: **8 reglas en WARN** (10 alertas en el reporte, porque la regla 90004 se reporta por separado para COEP y COOP). API: **3 reglas en WARN** (4 alertas: la regla 10049 aparece en dos variantes). 60 y 65 reglas pasivas en PASS.

#### Alertas del front (`:5173`, servidor de desarrollo de Vite)

| Alerta (id) | Riesgo (confianza) | Cantidad | URL de ejemplo |
|---|---|---|---|
| Content Security Policy (CSP) Header Not Set (10038) | Medium (High) | 3 | `http://host.docker.internal:5173` |
| Cross-Domain Misconfiguration (10098): `Access-Control-Allow-Origin: *` | Medium (Medium) | 5 | `http://host.docker.internal:5173/src/main.tsx` |
| Missing Anti-clickjacking Header (10020) | Medium (Medium) | 3 | `http://host.docker.internal:5173` |
| Cross-Origin-Embedder-Policy Header Missing or Invalid (90004) | Low (Medium) | 3 | `http://host.docker.internal:5173` |
| Cross-Origin-Opener-Policy Header Missing or Invalid (90004) | Low (Medium) | 3 | `http://host.docker.internal:5173` |
| Permissions Policy Header Not Set (10063) | Low (Medium) | 5 | `http://host.docker.internal:5173/@vite/client` |
| X-Content-Type-Options Header Missing (10021) | Low (Medium) | 5 | `http://host.docker.internal:5173/src/main.tsx` |
| Modern Web Application (10109) | Informational (Medium) | 3 | `http://host.docker.internal:5173` |
| Storable but Non-Cacheable Content (10049) | Informational (Medium) | 5 | `http://host.docker.internal:5173` |

#### Alertas de la API (`:3000`)

| Alerta (id) | Riesgo (confianza) | Cantidad | URL de ejemplo |
|---|---|---|---|
| Cross-Domain Misconfiguration (10098): `Access-Control-Allow-Origin: *` | Medium (Medium) | 4 | `http://host.docker.internal:3000/api/projects` |
| Server Leaks Information via "X-Powered-By" HTTP Response Header Field(s) (10037): `X-Powered-By: Express` | Low (Medium) | 5 | `http://host.docker.internal:3000/api/projects` |
| Non-Storable Content (10049) | Informational (Medium) | 1 | `http://host.docker.internal:3000/api/projects` (401) |
| Storable and Cacheable Content (10049) | Informational (Medium) | 4 | `http://host.docker.internal:3000/api` (404) |

#### Cruce hallazgo ZAP ↔ prueba con curl / SEC-xx

| Hallazgo | ZAP | curl ([`pruebas-api.md`](evidencias/seguridad/pruebas-api.md)) | Comentario |
|---|---|---|---|
| `X-Powered-By: Express` | ✅ API (10037) | ✅ §2 "Headers de /api/health" | Lo vieron los dos. En el front no aparece: Vite no manda ese header |
| CORS `Access-Control-Allow-Origin: *` | ✅ API y front (10098) | ✅ §2 "CORS desde un origen ajeno" (`Origin: https://evil.example` recibe `*`) | Coinciden en la API. Sobre el front solo lo vio ZAP (es el servidor de desarrollo de Vite) |
| Faltan CSP, `X-Frame-Options` y `X-Content-Type-Options` | ✅ solo en el **front** (10038, 10020, 10021) | ✅ en la **API** (§2) | Se complementan: curl miró la API y ZAP los encontró en el front. ZAP no los marca en la API porque 10038 y 10020 solo evalúan respuestas HTML y 10021 ignora las respuestas 4xx/5xx (todo lo que la API le devolvió sin token fue 401 o 404). El arreglo es el mismo: `helmet` en Express y headers en el servidor que sirva el build del front |
| Falta `Strict-Transport-Security` | ❌ | ✅ §2 (anotado "en prod con TLS") | ZAP solo evalúa HSTS (regla 10035) sobre HTTPS, y el entorno local es HTTP |
| Faltan `Permissions-Policy`, COEP y COOP | ✅ solo ZAP (10063, 90004) | ❌ | curl no los buscaba. Riesgo bajo: endurecimiento del navegador |
| Cache-Control de las respuestas (10049) y "Modern Web Application" (10109) | ✅ solo ZAP (informativos) | ❌ | No son vulnerabilidades; 10109 avisa que un spider tradicional no recorre bien una SPA |
| **SEC-01** inyección SQL en `search` | ❌ | ✅ §4 | Necesita token y enviar un payload: el baseline es **pasivo** (no ataca) y **no está autenticado** (todo `/api/projects/*` le dio 401) |
| IDOR (control 4.2) | ❌ | ✅ §3 (verificado: 403/404) | Necesita dos usuarios autenticados y comparar sus permisos: fuera del alcance de un escaneo sin sesión |
| **SEC-02** JWT forjado con el secreto por defecto; `alg: none`, firma alterada y vencido | ❌ | ✅ §5 | Requiere conocer el código (el secreto está en el repo) y armar tokens; un escaneo pasivo no genera tokens |
| XSS almacenado (no se ejecuta en el front) | ❌ | ✅ §4 | Requiere crear tareas y comentarios autenticado |
| Fuerza bruta / sin rate limit por IP | ❌ | ✅ §6 | Requiere enviar muchos logins; el baseline no lo hace |
| BUG-14 / BUG-15 (forgot / reset password) | ❌ | Tests de integración (`server/tests/bugs.test.ts`) | Requieren POST con cuerpos específicos; el spider no envía datos a la API |

**Conclusión.** ZAP confirmó de forma automática y reproducible los problemas de configuración (headers y CORS) que curl había encontrado a mano, y agregó los del front y tres headers de endurecimiento que no se habían revisado. Los dos hallazgos más graves (SEC-01 y SEC-02) no los puede ver un baseline, porque es un escaneo pasivo sobre lo que el spider encuentra sin sesión. Para cubrirlos con ZAP haría falta un *full scan* (reglas activas) con un contexto autenticado (header `Authorization: Bearer`) y la definición OpenAPI de la API; aun así, el JWT con secreto por defecto y el IDOR se detectan mejor con pruebas dirigidas como las de curl. Los resultados del front corresponden al servidor de desarrollo de Vite: el build de producción tendrá los headers que le ponga el servidor que lo sirva.

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
- [x] OWASP ZAP 2.17.0 baseline contra el front (`:5173`) y la API (`:3000/api/projects`); reportes HTML y JSON en `docs/evidencias/seguridad/` y hallazgos cruzados con los de curl.
- [x] CVSS 3.1 calculado con la fórmula oficial (script) para SEC-01, SEC-02, BUG-14 y BUG-15; SEC-02 corregido a 9.1 (CRITICAL).
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
