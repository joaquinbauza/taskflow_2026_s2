# ISSUE-12 · BUG-14

> Etiqueta: `critica` · Bug: [BUG-14](../bugs.md#bug-14)

**Título:** [Auth] forgot-password revela si la cuenta existe y devuelve el token en la respuesta
**Criterio violado:** US-17 c2: "La respuesta es idéntica exista o no un usuario con ese email (HTTP 200 y el mismo mensaje genérico)"
**Entorno:** Windows 11 Pro · Node 22.23.5 · API Express + SQLite (Jest/Supertest, sin navegador) · TZ America/Montevideo (UTC-3) · commit `390b4bf` (rama `entrega-final`)
**Datos / precondiciones:** Usuario registrado ana@test.com.
**Pasos:** 1. `POST /api/auth/forgot-password` con `ana@test.com`. 2. Lo mismo con `nadie@test.com`.
**Esperado:** 200 y el mismo cuerpo genérico en ambos.
**Obtenido:** 200 con `{ message, token }` para el registrado; 404 para el inexistente.
**Reproducibilidad:** 3 de 3.
**Evidencia:** Respuestas HTTP en docs/evidencias/seguridad/.
**Test que lo reproduce:** server/tests/bugs.test.ts › BUG-14; auth.integration.test.ts › la respuesta no revela si el email existe
**Severidad:** crítica
