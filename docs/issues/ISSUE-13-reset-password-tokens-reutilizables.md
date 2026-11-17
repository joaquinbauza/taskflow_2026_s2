# ISSUE-13 · BUG-15

> Etiqueta: `critica` · Bug: [BUG-15](../bugs.md#bug-15)

**Título:** [Auth] reset-password acepta tokens usados, invalidados o vencidos
**Criterio violado:** US-17 c5: "Un token vencido, inexistente o ya utilizado devuelve HTTP 400"; c6: "los tokens anteriores del mismo usuario quedan invalidados"
**Entorno:** Windows 11 Pro · Node 22.23.5 · API Express + SQLite (Jest/Supertest, sin navegador) · TZ America/Montevideo (UTC-3) · commit `390b4bf` (rama `entrega-final`)
**Datos / precondiciones:** Usuario registrado.
**Pasos:** 1. Pedir token T1 y usarlo; volver a usarlo. 2. Usar un token de hace 61 minutos. 3. Pedir T1 y T2; usar T1.
**Esperado:** HTTP 400 en los tres casos.
**Obtenido:** HTTP 200 en los tres; la contraseña cambia.
**Reproducibilidad:** 3 de 3.
**Evidencia:** Respuestas 200.
**Test que lo reproduce:** server/tests/bugs.test.ts › BUG-15 (3); auth.integration.test.ts (3)
**Severidad:** crítica
