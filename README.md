# TaskFlow

Gestor de tareas colaborativo. Los usuarios crean proyectos, invitan miembros, cargan tareas con prioridad y fecha de vencimiento, las mueven entre estados y comentan sobre ellas.

Este es el proyecto sobre el que vas a trabajar durante todo el semestre en **Testing y Calidad de Software**.

## Requisitos

- **Node.js 20 o superior** y **npm 10 o superior** (verificá con `node -v` y `npm -v`)
- **Git**

No hace falta Docker ni instalar una base de datos: TaskFlow usa SQLite, que es un archivo.

Funciona igual en macOS, Linux y Windows. El único paso que cambia según el
sistema operativo es la copia del archivo de configuración `server/.env`; el
resto (`npm install`, `npm run db:setup`, `npm run dev`) es idéntico en todos.

## Puesta en marcha

### macOS / Linux

```bash
git clone <url-del-repo>
cd taskflow
npm install
cp server/.env.example server/.env
npm run db:setup
npm run dev
```

### Windows (PowerShell)

```powershell
git clone <url-del-repo>
cd taskflow
npm install
Copy-Item server\.env.example server\.env
npm run db:setup
npm run dev
```

En `cmd.exe`, reemplazá la línea del `.env` por `copy server\.env.example server\.env`.

### Verificar que levantó

`npm run dev` arranca dos procesos a la vez: la API en `http://localhost:3000/api`
y el frontend en `http://localhost:5173`. Se cortan con `Ctrl+C`.

Abrí `http://localhost:5173` en el navegador o consultá la API:

```bash
curl http://localhost:3000/api/health
```

En Windows, `curl` dentro de PowerShell es un alias de `Invoke-WebRequest`; para
que se comporte como en el ejemplo usá `curl.exe http://localhost:3000/api/health`
o abrí la URL en el navegador.

## Usuarios de prueba

El comando `db:setup` carga datos de ejemplo. Los tres usuarios comparten la contraseña `Password1`:

| Email | Rol en los datos de ejemplo |
|-------|------------------------------|
| `ana@test.com` | Owner de "Rediseño del sitio", miembro de "Migración legacy" |
| `bob@test.com` | Owner de "App móvil", miembro de "Rediseño del sitio" |
| `caro@test.com` | Miembro de "App móvil" |

## Comandos

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Levanta la API y el frontend juntos, con recarga automática |
| `npm run dev:server` | Levanta solo la API |
| `npm run dev:client` | Levanta solo el frontend |
| `npm run build` | Compila TypeScript a `server/dist` |
| `npm run build:client` | Compila el frontend a `client/dist` |
| `npm start` | Corre la versión compilada |
| `npm run db:setup` | Aplica las migraciones y carga los datos de ejemplo |
| `npm run db:reset` | Borra la base y la vuelve a crear desde cero |
| `npm test` | Corre todos los tests de Jest: unitarios, contrato e integración |
| `npm run test:unit` | Solo los tests unitarios (`server/tests/unit/`) |
| `npm run test:contract` | Solo la verificación del contrato frontend → API (`server/tests/contract/`) |
| `npm run test:bugs` | Solo los tests que reproducen los bugs de `docs/bugs.md` |
| `npm run test:coverage` | Corre la suite de Jest con reporte de cobertura |
| `npm run test:e2e` | Corre los tests end-to-end con Playwright |
| `npm run test:e2e:ui` | Corre los tests end-to-end en modo interactivo (UI mode) |
| `npm run test:pact` | Contract testing con Pact: consumer (genera `server/pacts/`) y después provider (ver [`docs/pact.md`](docs/pact.md)) |
| `npx playwright test a11y --project chromium` | Auditoría de accesibilidad WCAG 2.1 A/AA con axe-core (`e2e/tests/a11y.spec.ts`) |
| `npm run db:seed:large` | Agrega a la base de desarrollo un proyecto con 5.000 tareas y 20.000 comentarios (para k6) |
| `k6 run -e VUS=20 -e DURATION=1m performance/scenarios/api-load.k6.js` | Prueba de carga del listado de tareas (requiere [k6](https://k6.io) y la API levantada; ver [`docs/performance.md`](docs/performance.md)) |

## Frontend

En `client/` hay una interfaz web en React 18 + TypeScript + Vite. Se levanta
junto con la API con `npm run dev` y queda en `http://localhost:5173`; el
servidor de Vite hace proxy de `/api` hacia `http://localhost:3000`. El token
de sesión se guarda en `localStorage`.

Pantallas:

- **Login / registro**: un formulario con un toggle entre iniciar sesión y
  crear cuenta.
- **Lista de proyectos**: los proyectos del usuario y un formulario para crear
  uno nuevo.
- **Tablero del proyecto**: columnas TODO, IN_PROGRESS y DONE con las tareas,
  filtros por prioridad y asignado, buscador por texto y alta de tareas.
- **Detalle de tarea**: edición de título, descripción, prioridad, asignado y
  fecha de vencimiento; cambio de estado; etiquetas; comentarios; historial de
  estados.
- **Miembros del proyecto**: alta por email y baja de miembros (solo el owner).

## Endpoints

Todas las rutas cuelgan de `/api`. Salvo las de autenticación, todas requieren la cabecera `Authorization: Bearer <token>`.

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/register` | Registro de usuario |
| POST | `/auth/login` | Login, devuelve JWT |
| POST | `/auth/forgot-password` | Solicita el reseteo de contraseña |
| POST | `/auth/reset-password` | Cambia la contraseña con el token |

### Proyectos
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/projects` | Crear proyecto |
| GET | `/projects` | Listar mis proyectos |
| PATCH | `/projects/:id` | Editar proyecto |
| DELETE | `/projects/:id` | Eliminar proyecto |
| POST | `/projects/:id/members` | Agregar miembro por email |
| DELETE | `/projects/:id/members/:userId` | Quitar miembro |

### Tareas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/projects/:id/tasks` | Listar tareas. Filtros: `status`, `priority`, `assignedTo`, `search`, `limit`, `offset` |
| POST | `/projects/:id/tasks` | Crear tarea |
| GET | `/tasks/:id` | Detalle de una tarea |
| PATCH | `/tasks/:id` | Editar tarea (título, descripción, prioridad, asignado, vencimiento, estado) |
| DELETE | `/tasks/:id` | Eliminar tarea |
| GET | `/tasks/:id/history` | Historial de cambios de estado |
| POST | `/tasks/:id/tags` | Agregar etiqueta |
| DELETE | `/tasks/:id/tags/:tagId` | Quitar etiqueta |

### Comentarios
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/tasks/:id/comments` | Listar comentarios de una tarea |
| POST | `/tasks/:id/comments` | Comentar en una tarea |
| DELETE | `/comments/:id` | Borrar un comentario propio |

## Identificadores

La API expone los recursos con identificadores prefijados: `user-1`, `proj-1`, `task-1`, `comment-1`.

## Formato de errores

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

Códigos: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `INVALID_TRANSITION` (422), `INTERNAL` (500).

## Estado de los tests

El proyecto viene con una suite de tests que cubre los flujos principales de autenticación, proyectos, tareas y comentarios. Corre en verde:

```bash
npm test
```

Está lejos de ser exhaustiva — ampliarla es parte del trabajo del semestre.

## Tests end-to-end

Además de la suite de integración (`npm test`, en `server/tests/`, que corre
contra una base SQLite real pero sin levantar procesos ni navegador), hay una
suite end-to-end en `e2e/` que usa [Playwright](https://playwright.dev/) para
manejar un Chromium real contra la aplicación completa: API + frontend +
base de datos, igual que la usaría una persona.

Para correrla:

```bash
npx playwright install chromium   # una sola vez, descarga el navegador
npm run test:e2e
```

Playwright levanta la API (puerto 3000) y el frontend (puerto 5173) con una
base SQLite propia en `e2e/.tmp/` (no toca `server/dev.db`), espera a que
ambos respondan, y recién ahí corre los tests. Cada test espera la respuesta
HTTP de la acción que dispara (registro, alta de proyecto/tarea, cambio de
estado) antes de asertar sobre la UI, para evitar falsos verdes por
condiciones de carrera.

La suite sigue la arquitectura de
[`docs/adr/ADR-001`](docs/adr/ADR-001-arquitectura-testing-playwright.md):
Page Objects (`e2e/page-objects/`), Component Objects (`e2e/components/`:
`TaskCard`, `CommentItem`, `MemberItem`, `AppHeader`), fixtures
(`e2e/fixtures/`: `apiContext`, `owner`, `seedProject`, `loggedInPage` y los
page objects) y clients de la API (`e2e/api/`). Arrange por API, Act y Assert
por UI; el login por formulario se prueba una sola vez (`tests/e2e/login.spec.ts`).
Navegador y API corren en `America/Montevideo` (BUG-03). Reportes: `list`,
HTML (`playwright-report/`) y JUnit (`results/junit.xml`). Configuración por
ambiente en `e2e/.env.example`.

## Pirámide de tests

Lo que se puede probar abajo se prueba abajo:

| Nivel | Dónde | Qué cubre |
|-------|-------|-----------|
| Unitarios | `server/tests/unit/` | Lógica pura sin base ni HTTP: transiciones de estado, validaciones, ids y fechas, armado de filtros |
| Contrato | `client/src/contracts/api.contract.ts` + `server/tests/contract/`; Pact en `server/contract-tests/` | El frontend declara qué status y qué campos espera de cada endpoint que usa; la API real se verifica contra eso. Pact: el consumer genera `server/pacts/*.json` y la API real lo verifica |
| Integración | `server/tests/*.test.ts` | Endpoints con Supertest contra SQLite, incluidas las reglas de negocio y permisos |
| E2E | `e2e/tests/e2e/` | Flujos en el navegador: golden path, login, alta de miembros y US-12, US-14, US-15, US-16 (feliz, error y borde por historia) |
| Accesibilidad | `e2e/tests/a11y.spec.ts` | axe-core, WCAG 2.1 A/AA en Login, Registro, Proyectos, Tablero y Detalle de tarea |
| Performance | `performance/scenarios/` | Carga del listado de tareas con k6 (p95 ≤ 500 ms con 5.000 tareas) |

### Contrato frontend → API

`client/src/contracts/api.contract.ts` es del frontend. Está atado a los tipos
de `client/src/types.ts` con `satisfies`, así que si se agrega o quita un campo
en los tipos sin actualizar el contrato, `tsc` del cliente falla. El test
`server/tests/contract/api.contract.test.ts` ejecuta cada interacción contra
la API y termina verificando que no haya quedado ninguna sin probar. Si el
frontend necesita algo nuevo de la API, se agrega primero al contrato.

### Contrato con Pact (consumer-driven)

Al lado del verificador casero hay contract testing con
[Pact](https://docs.pact.io/) (`@pact-foundation/pact` 17.1.4). El consumer
`TaskFlowWeb` (`server/contract-tests/consumer/`) declara 5 interacciones
(proyectos con y sin token, nombre de más de 100 caracteres, login y
comentarios) y genera `server/pacts/TaskFlowWeb-TaskFlowAPI.json`; el provider
`TaskFlowAPI` (`server/contract-tests/provider/`) levanta la API real y la
verifica contra ese archivo. Se corre con `npm run test:pact` (consumer y
después provider) y no forma parte de `npm test`. Detalle, evidencia de la
ruptura y discusión en [`docs/pact.md`](docs/pact.md).

### Bugs conocidos

Los bugs encontrados están en [`docs/bugs.md`](docs/bugs.md), cada uno con su
reporte y al menos un test que lo reproduce. Esos tests describen el
comportamiento correcto y corren como falla esperada (`knownBug` en Jest,
`test.fail` en Playwright): quedan en verde mientras el bug exista y pasan a
rojo cuando se arregla, momento en el que hay que convertirlos en tests
normales. Para ver las fallas reales: `SHOW_BUGS=1 npm test`
(en PowerShell: `$env:SHOW_BUGS=1; npm test`).

## Estructura

```
taskflow/
├── server/
│   ├── prisma/          # esquema, migraciones y datos de ejemplo
│   ├── src/
│   │   ├── middleware/  # autenticación, membresía, manejo de errores
│   │   ├── modules/     # auth, projects, tasks, comments
│   │   └── lib/         # base de datos, validaciones, utilidades
│   ├── tests/           # Jest: unitarios, contrato casero, integración, bugs
│   ├── contract-tests/  # Pact: consumer/ y provider/
│   └── pacts/           # contrato generado (TaskFlowWeb-TaskFlowAPI.json)
├── client/
│   └── src/
│       ├── pages/       # login, proyectos, tablero, detalle, miembros
│       └── lib/         # cliente HTTP, sesión, helpers
├── e2e/
│   ├── config/          # lectura del .env por ambiente
│   ├── fixtures/        # test.extend(): apiContext, seedProject, loggedInPage…
│   ├── page-objects/    # LoginPage, ProjectsPage, BoardPage, TaskDetailPage, MembersPage
│   ├── components/      # TaskCard, CommentItem, MemberItem, AppHeader
│   ├── api/             # clients/ y schemas/ de la API
│   ├── test-data/       # factories con nombres únicos
│   └── tests/           # e2e/*.spec.ts y a11y.spec.ts
├── performance/
│   └── scenarios/       # api-load.k6.js
├── docs/                # ver índice abajo
├── playwright.config.ts
└── README.md
```

## Documentación (`docs/`)

| Documento | Contenido |
|---|---|
| [`bugs.md`](docs/bugs.md) | Reporte de bugs (BUG-01 a BUG-22) con estado y tests |
| [`issues/`](docs/issues/) | Issues en formato de plantilla (ISSUE-01 a ISSUE-18), cargados en GitHub como [#2 a #19](https://github.com/joaquinbauza/taskflow_2026_s2/issues) con etiqueta de severidad (`critica`, `alta`, `media`, `baja`); ISSUE-NN es el #NN+1 |
| [`adr/ADR-001-…`](docs/adr/ADR-001-arquitectura-testing-playwright.md) | Arquitectura del framework de Playwright |
| [`e2e-us-12-14-15-16.md`](docs/e2e-us-12-14-15-16.md) | Trazabilidad y mutaciones de los E2E de US-12/14/15/16 |
| [`pact.md`](docs/pact.md) | Contract testing con Pact, evidencia de ruptura |
| [`clase12-m2-reporte.md`](docs/clase12-m2-reporte.md) | Práctico de seguridad y accesibilidad (SEC, ACC, user stories) |
| [`performance.md`](docs/performance.md) | k6, seed grande, resultados e hipótesis |
| [`clase12-ej1b-pipeline.md`](docs/clase12-ej1b-pipeline.md) | Clasificación del pipeline en rojo |
| [`clase12-ej2-ia.md`](docs/clase12-ej2-ia.md) · [`ia/`](docs/ia/) | Tests de US-16 generados con IA, prompts y clasificación |
| [`clase12-ej3-informe.md`](docs/clase12-ej3-informe.md) · [`clase12-ej3-detalle.md`](docs/clase12-ej3-detalle.md) | Informe de estado de una página (métricas y recomendación) y su anexo con criterios de salida, defectos por severidad y riesgos |
| [`evidencias/`](docs/evidencias/) | Salidas de Pact, axe, npm audit, curl de seguridad y performance |

## Especificación

Los requerimientos completos —las 17 historias de usuario con sus criterios de aceptación y escenarios BDD— están en `taskflow_especificacion_requerimientos.docx`, entregado aparte. **Esa es la fuente de verdad**: cuando el comportamiento del sistema y la especificación no coincidan, la especificación tiene razón.
