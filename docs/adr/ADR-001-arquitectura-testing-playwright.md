# ADR-001: Arquitectura del framework de testing de TaskFlow con Playwright

- **Estado:** Aceptado
- **Fecha:** 2026-10-05
- **Curso:** Testing y Calidad de Software 2026 · Clase 6

---

## 1. Contexto

TaskFlow es un gestor de tareas colaborativo:

- **Frontend:** SPA en React 18 + Vite (`client/`). Tiene 5 pantallas: Login, Proyectos, Tablero, Detalle de tarea y Miembros.
- **Backend:** API REST en Express + Prisma/SQLite (`server/`), en `http://localhost:3000/api`. Salvo `/auth/*`, todos los endpoints piden `Authorization: Bearer <token>`.
- **Sesión en el front:** el token se guarda en `localStorage` (`taskflow_token` y `taskflow_user`, ver `client/src/lib/api.ts`).
- **Datos de prueba:** `npm run db:setup` carga a `ana@test.com`, `bob@test.com` y `caro@test.com`, todos con la contraseña `Password1`.
- **Tests existentes:** solo hay tests de integración del backend con Jest (`server/tests/`). **No hay ningún test de UI ni E2E.**

Hay varios hechos del código que condicionan la arquitectura:

1. **Casi todo requiere sesión.** Cuatro de las cinco pantallas están detrás de `RequireAuth` (`App.tsx`), así que casi todos los tests necesitan un usuario logueado y, en general, un proyecto con tareas ya creados.
2. **Hay piezas de UI que se repiten** y ninguna está extraída como componente reutilizable:

   | Pieza | Dónde aparece | `data-testid` |
   |---|---|---|
   | Tarjeta de tarea | Tablero, en las 3 columnas (TODO / IN_PROGRESS / DONE) | `task-card` |
   | Comentario | Detalle de tarea, en la lista de comentarios | `comment-item` |
   | Miembro | Pantalla Miembros, en la lista | `member-item` |
   | Header | Las 4 pantallas autenticadas | `app-header` |

3. **Todos los elementos interactivos ya tienen `data-testid`** (por ejemplo `login-email-input`, `task-create-submit` o `board-column-TODO`).
4. **La app expone una API completa.** Todo lo que se hace por UI también se puede hacer por API: login, crear proyecto, crear tarea, comentar y agregar miembros.
5. **Tiene que correr en local y en CI**, con URLs y credenciales que cambian según el ambiente.

## 2. Decisión

Se construye un framework de testing con **Playwright + TypeScript** en una carpeta `e2e/` en la raíz del repo, separada de `client/` y `server/`. Se combinan **cuatro patrones que no compiten entre sí**: POM, COM, Fixtures y el patrón híbrido API + UI.

### 2.1 Estructura de carpetas: por capa

```
e2e/
├── config/            # constantes y lectura del .env
├── fixtures/          # apiContext, auth, owner, seedProject, loggedInPage y los Page Objects
├── page-objects/      # LoginPage, ProjectsPage, BoardPage, TaskDetailPage, MembersPage
├── components/        # TaskCard, CommentItem, MemberItem, AppHeader
├── api/
│   ├── clients/       # AuthClient, ProjectsClient, TasksClient, CommentsClient (preparan datos)
│   └── schemas/       # forma esperada de user/project/task/error (hoy ningún spec lo importa)
├── tests/
│   ├── e2e/           # flujos por UI (Arrange por API con fixtures, Act y Assert por UI)
│   └── a11y.spec.ts   # auditoría de accesibilidad con axe-core
├── test-data/         # factories (usuario, proyecto, tarea)
├── global-setup.ts    # crea la base SQLite propia de E2E (e2e/.tmp/e2e.db)
└── .env.example

playwright.config.ts   # en la raíz del repo (lo usa `npm run test:e2e`)
```

> **Implementación (actualizado 17/11/2026).** El árbol de arriba es exactamente el de `e2e/`. Playwright **no** tiene tests de API propios: el contrato de la API lo cubren Jest + Supertest y Pact (ver §2.6). Todos los specs de `tests/e2e/` son híbridos en el sentido de §2.5 y `tests/a11y.spec.ts` es la auditoría de accesibilidad.

**Por qué "por capa" y no "por feature":** las features de TaskFlow comparten piezas de UI y de API. El header aparece en todas las pantallas, y el login y la creación de proyecto los necesitan casi todos los tests. Con una estructura por feature esas piezas quedarían duplicadas, o en una carpeta "común" que termina siendo la estructura por capa igual. Una estructura plana deja de servir apenas la suite crece.

### 2.2 Page Object Model: una clase por pantalla

| Page Object | Ruta | Responsabilidad |
|---|---|---|
| `LoginPage` | `/login` | login, registro y toggle de modo |
| `ProjectsPage` | `/projects` | crear proyecto y abrir uno |
| `BoardPage` | `/projects/:id` | crear tarea, filtrar, buscar y leer columnas |
| `TaskDetailPage` | `/projects/:id/tasks/:taskId` | editar, cambiar estado, etiquetas, comentarios e historial |
| `MembersPage` | `/projects/:id/members` | agregar y quitar miembros |

**Por qué:** cada pantalla tiene lógica propia que no se repite en otra. El formulario de creación de tarea, por ejemplo, solo existe en el Tablero. Ese es el criterio de "cuándo conviene POM": una pantalla con lógica propia y poca repetición. Además, si cambia un locator se corrige en un solo lugar.

### 2.3 Component Object Model: las piezas que se repiten

| Component Object | Lo usan | Por qué es componente y no parte de la página |
|---|---|---|
| `TaskCard` | `BoardPage` (3 columnas) | La misma pieza se repite N veces en 3 contenedores distintos |
| `CommentItem` | `TaskDetailPage` | Se repite N veces en la lista de comentarios |
| `MemberItem` | `MembersPage` | Se repite N veces en la lista de miembros |
| `AppHeader` | Las 4 páginas autenticadas | Igual en todas las pantallas (es el caso "NavBar" de la clase) |

Cada Component Object recibe un `Locator` raíz, por ejemplo `page.getByTestId('task-card').filter({ hasText: 'Diseñar logo' })`, y busca sus elementos **dentro** de ese root (`task-card-title`, `task-card-priority`, `task-card-status-select`…). Así un mismo `TaskCard` sirve para cualquier tarjeta de cualquier columna.

**Por qué:** se cumplen los criterios de la clase. La pieza se repite, el frontend ya está organizado en componentes de React, y duplicar sus locators en cada test o página sale caro. Un Page Object se **compone** de Component Objects: `BoardPage.card('Diseñar logo')` devuelve un `TaskCard`.

### 2.4 Fixtures: el estado previo lo arma el framework

Con `test.extend()` se definen:

- `apiContext`: un `APIRequestContext` ya autenticado contra `API_URL`.
- `seedProject`: crea por API un proyecto con tareas y lo **borra al terminar** el test, después de `use()`.
- `loggedInPage`: una `page` que ya arranca con sesión iniciada (ver 2.5).
- Los Page Objects como fixtures (`boardPage`, `taskDetailPage`…), para que el test los reciba listos.

**Por qué:** casi todos los tests necesitan estado previo (contexto, punto 1). Si cada test hiciera su propio login y su propio setup, el boilerplate crecería con cada test nuevo, que es justamente el límite de POM puro que se vio en clase. El teardown automático deja cada test independiente (requisito para paralelizar en el futuro; hoy se corre con 1 worker, ver §2.9).

### 2.5 Patrón híbrido: preparar por API, validar por UI

1. El fixture `owner` registra por API (`POST /api/auth/register`) un usuario nuevo con email único y obtiene el token. (La base de E2E se crea vacía en `e2e/global-setup.ts`, sin seed, así que no se depende de `ana@test.com`.)
2. El fixture `loggedInPage` inyecta con `page.addInitScript` el `localStorage` del front (`taskflow_token` y `taskflow_user`).
3. La página **nace autenticada**, sin pasar por el formulario. Se eligió `addInitScript` por test en lugar de un `storageState` global porque cada test usa su propio usuario (aislamiento de datos, §3).
4. Los datos que el test necesita (proyectos, tareas, miembros, etiquetas) se crean por API en el fixture `seedProject`, que borra el proyecto al terminar.

El formulario de login se prueba **una sola vez**, en `tests/e2e/login.spec.ts`. El resto de los tests no paga ese costo.

**Por qué:** el login por UI tarda unos 3 s por test y por API unos 0,2 s. En una suite de 200 tests eso es ≈10 min contra ≈40 s. La UI renderiza, ejecuta JS y hace requests para lograr un efecto que **no es lo que se está probando**.

### 2.6 Contrato de la API: Jest + Supertest y Pact, no Playwright

El contrato de la API **no** se prueba con Playwright. Lo cubren dos suites del backend:

- **Jest + Supertest** (`server/tests/`, `npm test`): tests de integración contra la app Express real (`createApp()`) con una base SQLite por archivo de test. Verifican el **status exacto**, la forma del body y los casos negativos con el formato de error `{ error: { code, message, details } }` (`VALIDATION_ERROR` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `INVALID_TRANSITION` 422). En `server/tests/contract/` está además el verificador de contrato casero (`client/src/contracts/api.contract.ts`).
- **Pact** (`server/contract-tests/`, `npm run test:pact`, detalle en `docs/pact.md`): el consumer `TaskFlowWeb` genera `server/pacts/TaskFlowWeb-TaskFlowAPI.json` y el provider verifica ese contrato contra la API real.

En Playwright, `e2e/api/clients/` (`AuthClient`, `ProjectsClient`, `TasksClient`, `CommentsClient`) se usa **solo para preparar datos** en los fixtures (§2.4 y §2.5): registrar el usuario, crear proyectos, tareas, miembros, etiquetas y comentarios. `esperar()` exige el status esperado de cada llamada para que un setup roto falle en el Arrange y no en el Assert. `e2e/api/schemas/` tiene la forma de las respuestas, pero hoy ningún spec lo importa.

**Por qué:** probar el contrato con Jest y Pact es más rápido (sin navegador ni Vite), corre en cada `npm test` y en el job `pact` de CI, y deja a Playwright lo que solo él puede probar: la UI. Duplicar los mismos casos en Playwright sería pagar dos veces por la misma cobertura. Como los fixtures usan siempre los mismos clients, no hay dos formas distintas de llamar a la API dentro de `e2e/`.

### 2.7 Locators: `data-testid` primero

Orden de preferencia: `getByTestId` → `getByRole` / `getByLabel` → `getByText`. **No se usan clases CSS ni XPath estructural.**

**Por qué:** la app ya tiene `data-testid` en todos los elementos relevantes, y esos atributos existen solo para testing, así que no cambian con un rediseño de estilos. El auto-waiting de Playwright reemplaza cualquier `sleep()`.

### 2.8 Configuración por ambiente

- `e2e/config/env.ts` lee `e2e/.env` o, si se define `TEST_ENV`, `e2e/.env.<TEST_ENV>` (por ejemplo `TEST_ENV=staging` → `e2e/.env.staging`); las variables del proceso tienen prioridad. Las keys son `BASE_URL` (`http://localhost:5173`), `API_URL` (`http://localhost:3000/api`), `TEST_USER_PASSWORD` y `TEST_TIMEZONE` (`America/Montevideo`), con esos valores por defecto. No hay email de usuario fijo: cada test registra el suyo (§2.5).
- Se commitea **`e2e/.env.example`** con las keys vacías. Los `.env` reales ya están en el `.gitignore` del repo.
- Ningún test tiene URLs ni credenciales escritas a mano.

### 2.9 Robustez en CI

```ts
retries: process.env.CI ? 2 : 0,
workers: 1,
fullyParallel: false,
use: {
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
},
reporter: [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'results/junit.xml' }]],
// proyecto chromium: timezoneId 'America/Montevideo'; webServer de la API con TZ igual
```

- **`workers: 1` y `fullyParallel: false` (cambio respecto de la versión original de este ADR).** La suite corre contra **un solo** proceso de API, un solo Vite y **una sola base SQLite** (`e2e/.tmp/e2e.db`). SQLite serializa las escrituras con un lock de archivo: con varios workers escribiendo a la vez aparecen `SQLITE_BUSY`/timeouts que no son bugs de la app sino del entorno de test (flakiness). Además, la cuenta se bloquea tras 5 logins fallidos y el caché de miembros vive en `localStorage`, dos fuentes más de interferencia. Con 1 worker la suite completa tarda ≈1 minuto, así que hoy el paralelismo no paga su costo. Para habilitarlo habría que dar una base (y una API) por worker.
- **Zona horaria fija.** El navegador (`timezoneId`) y el server (`TZ` en `webServer.env`) corren en `America/Montevideo`: BUG-03 solo aparece al oeste de UTC.
- `retries` vale 0 en local para no esconder un bug detrás de un segundo intento.
- Traces, capturas y video se guardan solo cuando algo falla.
- Se usan dos reporters: HTML para que el equipo investigue y JUnit para que el pipeline interprete el resultado.

### 2.10 Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| **POM puro**, sin fixtures ni COM | Cada test repetiría su login y su setup, y las tarjetas, comentarios y miembros duplicarían locators en cada página |
| **Screenplay Pattern** | Tiene un costo de setup alto que solo se justifica en frameworks enterprise con muchos equipos. Para un equipo chico y un proyecto de un semestre no conviene |
| **Estructura por feature** | Las features comparten header, login y datos, así que terminaría duplicando o con una carpeta "común" |
| **Login por UI en cada test** | Es ≈15 veces más lento y prueba el formulario de login cientos de veces sin aportar nada |

## 3. Consecuencias

### Positivas

- Si cambia un locator se corrige en **un solo lugar** (Page Object o Component Object).
- Los tests se leen como una historia: `boardPage.card('Diseñar logo').moveTo('DONE')`.
- La suite es rápida, porque el setup va por API. Los tests son independientes (cada uno crea y borra sus datos), así que se podrían paralelizar el día que haya una base por worker; hoy corren en serie (§2.9).
- Cuando algo falla en CI quedan traces y reportes para investigar.
- Playwright se concentra en la UI (E2E híbridos y accesibilidad); el contrato de la API queda en Jest + Supertest y Pact (§2.6), que son más rápidos y no necesitan navegador.

### Negativas / riesgos

- **Hay más archivos y más indirección** que en una suite plana. Alguien nuevo en el equipo tiene que entender fixtures y la composición POM + COM antes de escribir un test.
- **Los tests de UI dependen de que la API de login y de creación funcione.** Si `/auth/login` se rompe, fallan casi todos los tests. Se mitiga con los tests de `server/tests/` (`npm test`, job propio en CI), que señalan el endpoint roto sin pasar por la UI, y con `esperar()` en los clients: si el setup por API falla, el test cae en el fixture con el status recibido y queda claro el origen.
- **Hay acoplamiento a los `data-testid`.** Si alguien los cambia o los saca del front, se rompen los locators. Igual se corrigen en un solo lugar.
- **Los datos tienen que estar aislados.** Cada test crea sus propios datos con nombres únicos y los limpia. Si no, el paralelismo genera flakiness.
- La base SQLite es compartida. Los tests no dependen de los datos del seed (la base E2E no tiene seed): cada uno registra su propio usuario.
- **Sin paralelismo** mientras la base sea una sola (§2.9): la suite escala linealmente con la cantidad de tests.

## 4. Referencias

- `client/src/App.tsx`: rutas y `RequireAuth`.
- `client/src/lib/api.ts`: dónde se guarda la sesión en `localStorage`.
- `client/src/pages/*.tsx`: `data-testid` de cada pantalla.
- `README.md`: endpoints, códigos de error y usuarios de prueba.
- `server/tests/` y `server/contract-tests/` + `docs/pact.md`: contrato de la API (§2.6).
- `e2e/api/clients/index.ts`, `e2e/fixtures/index.ts`, `e2e/config/env.ts`, `playwright.config.ts`.
- Clase 6: "Arquitectura y Patrones de Diseño para Frameworks de Testing con Playwright".
