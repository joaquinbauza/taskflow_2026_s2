# ISSUE-14 · BUG-16

> Etiqueta: `alta` · Bug: [BUG-16](../bugs.md#bug-16)

**Título:** [Auth] El contador de intentos fallidos no se reinicia tras un login exitoso
**Criterio violado:** US-02 c5: "El contador de intentos fallidos se reinicia después de cada login exitoso"
**Entorno:** Windows 11 Pro · Node 22.23.5 · API Express + SQLite (Jest/Supertest, sin navegador) · TZ America/Montevideo (UTC-3) · commit `390b4bf` (rama `entrega-final`)
**Datos / precondiciones:** Usuario registrado.
**Pasos:** 1. 3 logins con contraseña incorrecta. 2. 1 login correcto (200). 3. 3 logins incorrectos. 4. Login correcto.
**Esperado:** El último login responde 200.
**Obtenido:** 401 "Account temporarily locked".
**Reproducibilidad:** 3 de 3.
**Evidencia:** Respuesta 401.
**Test que lo reproduce:** server/tests/bugs.test.ts › BUG-16; auth.integration.test.ts › el contador de intentos fallidos se reinicia…
**Severidad:** alta
