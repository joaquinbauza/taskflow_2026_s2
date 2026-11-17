# Prompt 2a — tests de US-16 generados con IA

**Herramienta usada:** Claude Code (asistente de IA en la terminal/VS Code), 16/11/2026. El resultado se pegó **tal cual** en `server/tests/us16-ia.integration.test.ts` (solo se cambiaron después `it` → `knownBug`/`it.skip` según la clasificación, con un comentario en cada caso).

---

**Rol.** Sos un QA automation engineer senior que escribe tests de integración de APIs REST en TypeScript con Jest y Supertest.

**Contexto.** TaskFlow es un gestor de tareas colaborativo (Express + Prisma + SQLite). Todas las rutas cuelgan de `/api` y, salvo `/auth/*`, piden `Authorization: Bearer <token>`. Los recursos tienen ids prefijados (`user-1`, `proj-1`, `task-1`). Errores: `{ "error": { "code": "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND", "message", "details" } }`. La fecha de vencimiento se modifica con `PATCH /api/tasks/:id` con `{ "dueDate": "YYYY-MM-DD" | null }` y se lee con `GET /api/tasks/:id`; al crear (`POST /api/projects/:id/tasks`) también se puede mandar `dueDate`. Cada archivo de test corre contra su propia base SQLite vacía (no hay seed). El servidor de tests corre con `TZ=America/Montevideo` (UTC-3).

Helpers disponibles en `server/tests/helpers.ts` (importar desde `./helpers`):
`app` (la app de Express), `registerUser(email, password = 'Password1')` → `{ token, id, res }`, `auth(token)` → headers, `createProject(token, name)` → body del proyecto, `createTask(token, projectId, body)` → body de la tarea, `addMember(token, projectId, email)` → respuesta de Supertest. Los emails tienen que ser únicos por test.

**Historia US-16 — Fecha de vencimiento de tarea.** Como miembro del proyecto quiero asignar una fecha de vencimiento a una tarea para poder priorizar el trabajo según urgencia.

Criterios de aceptación (copiados de la especificación):
1. La fecha de vencimiento es un día calendario, sin hora
2. Se envía y se devuelve en formato ISO 8601 de fecha, por ejemplo '2026-09-15'
3. La fecha que se devuelve es siempre la misma que se cargó, sin importar la zona horaria del cliente ni la del servidor
4. La fecha de vencimiento es opcional: una tarea puede no tener vencimiento
5. Se puede quitar la fecha de vencimiento enviando el campo en nulo
6. Una fecha con formato inválido devuelve HTTP 400
7. Se admite cargar una fecha pasada; el sistema no la rechaza y la tarea se considera vencida
8. Solo los miembros del proyecto pueden modificar la fecha de vencimiento (HTTP 403)

**Formato de salida.** Un único archivo TypeScript con tests Jest + Supertest (`import request from 'supertest'`), un `describe('US-16 …')`, y un `it` por caso con el nombre `'US-16 cN · …'`. Incluí casos felices, de error y de borde para cada criterio. Cada test arma sus propios datos con los helpers (Arrange), hace una request (Act) y verifica status y body (Assert). No uses mocks ni accedas a la base directamente. Devolvé solo el código.
