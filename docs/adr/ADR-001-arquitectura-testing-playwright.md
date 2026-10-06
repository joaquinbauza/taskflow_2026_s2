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
├── fixtures/          # loggedInPage, apiContext, seedProject
├── page-objects/      # LoginPage, ProjectsPage, BoardPage, TaskDetailPage, MembersPage
├── components/        # TaskCard, CommentItem, MemberItem, AppHeader
├── api/
│   ├── clients/       # AuthClient, ProjectsClient, TasksClient, CommentsClient
│   └── schemas/       # forma esperada de cada respuesta
├── tests/
│   ├── e2e/           # flujos completos por UI
│   ├── api/           # contrato de la API
│   └── hybrid/        # preparan por API y validan por UI
├── test-data/         # factories (usuario, proyecto, tarea)
├── utils/
├── .env.example
└── playwright.config.ts
```

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

**Por qué:** casi todos los tests necesitan estado previo (contexto, punto 1). Si cada test hiciera su propio login y su propio setup, el boilerplate crecería con cada test nuevo, que es justamente el límite de POM puro que se vio en clase. El teardown automático deja cada test independiente, y eso es lo que permite `fullyParallel: true`.

### 2.5 Patrón híbrido: preparar por API, validar por UI

1. Un `globalSetup` hace `POST /api/auth/login` con el usuario de prueba y obtiene el token.
2. Guarda un `storageState` con el `localStorage` del origen del front (`taskflow_token` y `taskflow_user`).
3. Los tests de UI arrancan con ese `storageState`: la página **nace autenticada**, sin pasar por el formulario.
4. Los datos que el test necesita (proyectos, tareas, comentarios) se crean por API en el fixture.

El formulario de login se prueba **una sola vez**, en `tests/e2e/login.spec.ts`. El resto de los tests no paga ese costo.

**Por qué:** el login por UI tarda unos 3 s por test y por API unos 0,2 s. En una suite de 200 tests eso es ≈10 min contra ≈40 s. La UI renderiza, ejecuta JS y hace requests para lograr un efecto que **no es lo que se está probando**.

### 2.6 Tests de API: validar el contrato completo

Los tests en `tests/api/` validan, para cada endpoint:

- el **status exacto** (por ejemplo `201`, no solo `ok()`);
- el header `Content-Type`;
- la **forma del body** contra un schema de `api/schemas/`, incluyendo el formato de error `{ error: { code, message, details } }`;
- **casos negativos** con los códigos documentados: `VALIDATION_ERROR` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409 e `INVALID_TRANSITION` 422.

**Por qué:** un test que solo mira el status deja pasar respuestas con la forma incorrecta. Los clients de `api/clients/` se reutilizan en los fixtures, así que no hay dos formas distintas de llamar a la API.

### 2.7 Locators: `data-testid` primero

Orden de preferencia: `getByTestId` → `getByRole` / `getByLabel` → `getByText`. **No se usan clases CSS ni XPath estructural.**

**Por qué:** la app ya tiene `data-testid` en todos los elementos relevantes, y esos atributos existen solo para testing, así que no cambian con un rediseño de estilos. El auto-waiting de Playwright reemplaza cualquier `sleep()`.

### 2.8 Configuración por ambiente

- `.env.dev`, `.env.staging`… se eligen con `TEST_ENV`. Contienen `BASE_URL` (`http://localhost:5173`), `API_URL` (`http://localhost:3000/api`), `TEST_USER_EMAIL` y `TEST_USER_PASSWORD`.
- Se commitea **`.env.example`** con las keys vacías. Los `.env` reales ya están en el `.gitignore` del repo.
- Ningún test tiene URLs ni credenciales escritas a mano.

### 2.9 Robustez en CI

```ts
retries: process.env.CI ? 2 : 0,
workers: process.env.CI ? 4 : undefined,
fullyParallel: true,
use: {
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
},
reporter: [['html'], ['junit', { outputFile: 'results/junit.xml' }]],
```

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
- La suite es rápida, porque el setup va por API y los tests corren en paralelo de forma independiente.
- Cuando algo falla en CI quedan traces y reportes para investigar.
- El mismo framework cubre tests de API, E2E e híbridos.

### Negativas / riesgos

- **Hay más archivos y más indirección** que en una suite plana. Alguien nuevo en el equipo tiene que entender fixtures y la composición POM + COM antes de escribir un test.
- **Los tests de UI dependen de que la API de login y de creación funcione.** Si `/auth/login` se rompe, fallan casi todos los tests. Se mitiga con el test de API de login, que falla primero y deja claro el origen.
- **Hay acoplamiento a los `data-testid`.** Si alguien los cambia o los saca del front, se rompen los locators. Igual se corrigen en un solo lugar.
- **Los datos tienen que estar aislados.** Cada test crea sus propios datos con nombres únicos y los limpia. Si no, el paralelismo genera flakiness.
- La base SQLite es compartida. Los tests no deberían depender de los datos del seed, salvo de los usuarios de prueba.

## 4. Referencias

- `client/src/App.tsx`: rutas y `RequireAuth`.
- `client/src/lib/api.ts`: dónde se guarda la sesión en `localStorage`.
- `client/src/pages/*.tsx`: `data-testid` de cada pantalla.
- `README.md`: endpoints, códigos de error y usuarios de prueba.
- Clase 6: "Arquitectura y Patrones de Diseño para Frameworks de Testing con Playwright".
