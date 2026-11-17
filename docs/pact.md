# Contract testing con Pact (Clase 8 · Rúbrica C)

Pact se agregó **al lado** del verificador de contrato casero (`client/src/contracts/api.contract.ts` + `server/tests/contract/`), que no se tocó.

| Rol | Nombre | Archivo |
|-----|--------|---------|
| Consumer | `TaskFlowWeb` (el frontend React) | `server/contract-tests/consumer/projects.pact.test.ts` |
| Provider | `TaskFlowAPI` (la API Express real) | `server/contract-tests/provider/verify.pact.test.ts` |
| Contrato generado | — | `server/pacts/TaskFlowWeb-TaskFlowAPI.json` (versionado: es entregable) |
| Config de Jest | — | `server/jest.pact.config.js` (separada: `npm test` no levanta estos archivos) |

Versión: `@pact-foundation/pact@17.1.4` (exacta, en `server/devDependencies`).

## Cómo correrlo

Siempre el consumer primero: el provider lee el archivo que el consumer genera.

```bash
npm run test:pact                 # desde la raíz: consumer y después provider
# o, desde server/:
npm run test:pact:consumer        # genera pacts/TaskFlowWeb-TaskFlowAPI.json
npm run test:pact:provider        # levanta la API real en un puerto libre y la verifica
```

No hace falta levantar la API ni tener `.env`: el provider arranca `createApp().listen(0)` con la base SQLite temporal de `tests/setup.ts` (vacía), y cada `given` tiene un *state handler* que crea los datos.

En CI corre en el job `pact` de `.github/workflows/ci.yml`.

## Interacciones

| # | Request | Estado (`given`) | Respuesta esperada | Campos del contrato (usados por el front) |
|---|---------|------------------|--------------------|---------------------------------------------|
| 1 | `GET /api/projects` con token | `ana tiene un proyecto` | 200, lista | `id`, `name`, `description`, `archived` (`ProjectsPage.tsx`) |
| 2 | `GET /api/projects` sin token | — | 401 `{ error: { code: 'UNAUTHORIZED', message } }` | `error.code`, `error.message` |
| 3 | `POST /api/projects` con nombre de 101 caracteres | `ana tiene una sesión válida` | 400 `VALIDATION_ERROR` | `error.code`, `error.message` |
| 4 | `POST /api/auth/login` `ana@test.com` / `Password1` (Ej. 3) | `existe ana@test.com con contraseña Password1` | 200 | `token` (string), `user.id`, `user.email`, `user.name` (`lib/auth.tsx`, `App.tsx`, `MembersPage.tsx`) |
| 5 | `GET /api/tasks/task-1/comments` (Ej. 3) | `la tarea task-1 tiene comentarios` | 200, lista | `id`, `taskId`, `authorId`, `body`, `createdAt` (`TaskDetailPage.tsx`, tipo `Comment`) |

Decisiones:

- Se usan `like` / `eachLike` (y `regex` para `taskId`) para que el contrato fije **la forma**, no los valores. `ownerId` y `createdAt` de proyecto quedan afuera a propósito: el front no los lee en `ProjectsPage`.
- **`task-1` fijo en el path.** Los ids son autoincrementales de SQLite con prefijo (`server/src/lib/ids.ts`). Para garantizar que exista `task-1`, el state handler crea la tarea con `id: 1` explícito si no existe (y si existe, la reutiliza): es idempotente y no hizo falta `regex` en el path.
- **Estados idempotentes.** Cada estado crea un usuario con email único (`prefijo-timestamp-secuencia@test.com`), así no hay 409 aunque el verificador llame al mismo estado varias veces. El estado del login hace `upsert` de `ana@test.com` con `bcrypt.hash('Password1', 10)` (igual que `auth.service.ts`) y limpia `failedAttempts`/`lockedUntil`.
- El `requestFilter` cambia el token falso del contrato (`Bearer abc`) por uno real firmado con `signToken`, solo si la request trae `Authorization` (la interacción 2 no se toca).
- Errata del handout: el provider apunta a `pacts/TaskFlowWebTaskFlowAPI.json`; el archivo real es `pacts/TaskFlowWeb-TaskFlowAPI.json`.

## Evidencia de la ruptura

### 1. Proyectos: `name` → `title`

Cambio en `server/src/modules/projects/projects.controller.ts`, dentro de `serialize`: `name: p.name` → `title: p.name`.

Salida completa: [`evidencias/pact-ruptura.txt`](evidencias/pact-ruptura.txt). Capturas: [`evidencias/pact-ruptura.png`](evidencias/pact-ruptura.png) (la interacción en `FAILED`) y [`evidencias/pact-ruptura-detalle.png`](evidencias/pact-ruptura-detalle.png) (`missing the following keys: name`). Resultado:

```
  un GET a /api/projects (1ms loading, 102ms verification)
     Given ana tiene un proyecto
    returns a response which
      has status code 200 (OK)
      has a matching body (FAILED)

1) Verifying a pact between TaskFlowWeb and TaskFlowAPI Given ana tiene un proyecto - un GET a /api/projects
    1.1) has a matching body
           $[0] -> Actual map is missing the following keys: name
There were 1 pact failures
Tests: 1 failed, 1 total      (exit code 1)
```

Las otras 4 interacciones siguieron en OK: Pact señala exactamente cuál se rompe.

`npm test` con el mismo cambio: **6 fallos** (`Tests: 6 failed, 240 passed, 246 total`):

- `tests/contract/api.contract.test.ts › Contrato frontend → API › Proyectos › GET /projects` (el verificador casero también lo detecta).
- 4 tests de integración que leen `body.name` (`proyectos.integration.test.ts › crear …`, `editar …` ×2; `projects.test.ts › rechaza nombres cortos…`).
- `proyectos.integration.test.ts › no muestra a un miembro (no owner) los proyectos archivados` (es `knownBug` de BUG-19: al no existir `name`, la aserción pasa "por casualidad" y el `it.failing` se pone rojo). Es un falso positivo del test, no un arreglo del bug.

### 2. Comentarios: `body` → `text`

Cambio en `server/src/modules/comments/comments.service.ts`, `serialize`: `body: c.body` → `text: c.body`.

Salida completa: [`evidencias/pact-ruptura-comentarios.txt`](evidencias/pact-ruptura-comentarios.txt). Resultado: `un GET a /api/tasks/task-1/comments … has a matching body (FAILED)` · `$[0] -> Actual map is missing the following keys: body` · exit code 1.

`npm test` con el cambio: **2 fallos** (`comentarios.integration.test.ts › registra al autor y la fecha` y `api.contract.test.ts › GET /tasks/:taskId/comments`).

Los dos cambios se revirtieron; `npm run test:pact` volvió a verde (consumer 5/5, provider 1/1) y `npm test` a 246/246.

## ¿Quién se habría enterado de este quiebre sin Pact, y cuándo?

- **En este repo, sí había red**: el verificador casero y varios tests de integración también fallan, porque casualmente leen `name` y `body`. Pero eso es accidental: los tests de integración verifican lo que *el backend* decidió devolver, no lo que *el frontend* necesita. Si el dev del backend renombra el campo, lo más probable es que "arregle" esos tests cambiando `name` por `title` en la aserción y siga, y el CI queda verde.
- **Sin ninguno de los dos contratos**, el primero en enterarse sería alguien mirando la UI: en `ProjectsPage` las tarjetas aparecen **sin nombre** (React renderiza `undefined` como vacío, sin error en consola), y en el detalle de tarea los comentarios aparecen vacíos. TypeScript del cliente no lo detecta, porque `types.ts` sigue declarando `name`: el tipo no se valida en runtime. Los E2E lo detectarían solo si asertan sobre el nombre o el texto del comentario (el golden path sí lo hace, pero corre al final del pipeline y con el stack completo).
- **Cuándo:** en el mejor caso en el job E2E del PR; en el peor, en producción, reportado por un usuario.
- **Con Pact**, el provider falla en el mismo PR del backend, en segundos, sin navegador, diciendo qué consumer (`TaskFlowWeb`), qué interacción y qué campo (`$[0] … missing the following keys: name`). Y el contrato lo escribe el consumer: el backend no puede "acomodar" el test sin hablar con el front.

## Captura pendiente (la rúbrica la pide)

Para reproducir el provider fallando y sacar la captura de la terminal:

```bash
cd server
# 1) romper el contrato (o editar a mano la línea name: p.name → title: p.name)
sed -i 's/^    name: p.name,$/    title: p.name,/' src/modules/projects/projects.controller.ts
# 2) correr el provider (debe mostrar "has a matching body (FAILED)")
npm run test:pact:consumer && npm run test:pact:provider
# 3) captura de pantalla de la terminal y luego revertir
git checkout -- src/modules/projects/projects.controller.ts
npm run test:pact
```

En PowerShell, en lugar del `sed`, editá la línea a mano en VS Code (línea `name: p.name,` dentro de `serialize`).
