# ISSUE-17 · BUG-21 (SEC-02)

> Etiqueta: `critica` · Bug: [BUG-21](../bugs.md#bug-21) · Reporte: [SEC-02](../clase12-m2-reporte.md#sec-02--secreto-jwt-por-defecto-embebido-en-el-código-cualquiera-puede-forjar-tokens)

**Título:** [Auth · API] Con la configuración del README, los JWT se firman con un secreto público del código y cualquiera puede forjar un token de otro usuario
**Criterio violado:** US-02 c1/c7 ("Login exitoso devuelve HTTP 200 y un JWT…", "El token incluye el userId en su payload"): solo la API debe poder emitir tokens válidos. RNF de Seguridad de la spec.
**Entorno:** Windows 11 Pro · Node 22.23.5 · API `npm run dev:server` con `server/.env` copiado de `.env.example` (sin `JWT_SECRET`) · commit de la rama `entrega-final`
**Datos / precondiciones:** seed (`npm run db:setup`): ana@test.com es `user-1`.
**Pasos:** 1. `cp server/.env.example server/.env` y `npm run dev:server`. 2. `node -e "console.log(require('jsonwebtoken').sign({userId:1,email:'ana@test.com'},'taskflow-dev-secret',{expiresIn:'24h'}))"`. 3. `curl -i http://localhost:3000/api/projects -H "Authorization: Bearer <token>"`.
**Esperado:** 401 UNAUTHORIZED (el token no lo emitió la API).
**Obtenido:** `HTTP/1.1 200 OK` con los proyectos de ana.
**Reproducibilidad:** 5 de 5 (22/11/2026, un token forjado nuevo por corrida: [`BUG-21-reproducibilidad.txt`](../evidencias/seguridad/BUG-21-reproducibilidad.txt)) · en cualquier entorno sin `JWT_SECRET` (el `.env.example` no lo define).
**Evidencia:** `docs/evidencias/seguridad/pruebas-api.md` › "JWT forjado con el secreto por defecto".
**Test que lo reproduce:** `docs/evidencias/seguridad/pruebas-api.sh` (sección 5). Pendiente: test automatizado que verifique que la app no arranca sin `JWT_SECRET`.
**Severidad:** crítica (seguridad, según el criterio de `bugs.md`; CVSS 3.1 9.1). Antes figuraba como alta; se cambió el 22/11/2026 junto con la etiqueta del issue #18.
