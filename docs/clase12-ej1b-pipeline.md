# Clase 12 · Ejercicio 1B — Clasificación del pipeline en rojo

**Repo:** `joaquinbauza/taskflow_2026_s2` · **PR:** #1 (`agregar-ci` → `main`) · **Workflow:** `.github/workflows/ci.yml` · **Fecha:** 16/11/2026

Categorías: **a.** bug real · **b.** falta de tests · **c.** calidad de código · **d.** pipeline o entorno.

## Resultado de la corrida

El workflow corrió dos veces (una por el `push` y otra por el `pull_request`), con el mismo resultado: **4 checks en rojo y 8 en verde**.

| Job | Resultado |
|---|---|
| Build del server (tsc) | ✅ |
| Lint (ESLint) | ✅ |
| Tests unitarios, contrato e integración (Jest) | ❌ |
| Cobertura (umbral de jest.config.js) | ❌ |
| Build del cliente (tsc + vite) | ✅ |
| E2E (Playwright) | ✅ |

## Etapas en rojo

| Etapa en rojo | Categoría | Línea del log que lo demuestra |
|---|---|---|
| Tests (Jest) — `push` y `pull_request` | **a. Bug real** | `Tests: 16 failed, 230 passed, 246 total` · `Error: Process completed with exit code 1.` |
| Cobertura — `push` y `pull_request` | **a. Bug real** | Corre los mismos tests: falla por los mismos 16. El umbral de `jest.config.js` (líneas 70 %, ramas 40 %) se cumple, así que **no** es b. |

Los 16 tests en rojo describen el comportamiento de la especificación y fallan porque la app no lo cumple. Cada uno corresponde a un bug de [`docs/bugs.md`](bugs.md):

| Test que falla | Bug |
|---|---|
| Auth › el contador de intentos fallidos se reinicia tras un login exitoso | BUG-16 |
| Auth › la respuesta no revela si el email existe | BUG-14 |
| Auth › un token ya utilizado no se puede reutilizar (400) | BUG-15 |
| Auth › un token vencido no sirve (400) | BUG-15 |
| Auth › al pedir un token nuevo, el anterior queda invalidado (400) | BUG-15 |
| Comentarios › se devuelven del más antiguo al más reciente | BUG-13 |
| Proyectos › no muestra a un miembro (no owner) los proyectos archivados | BUG-19 |
| Proyectos › al eliminar el proyecto no quedan comentarios ni historial | BUG-20 |
| Proyectos › al quitar un miembro sus tareas quedan sin asignado | BUG-08 |
| Tareas › no permite ir de TODO directamente a DONE (422) | BUG-01 |
| Tareas › el estado inicial es TODO aunque la solicitud mande otro | BUG-12 |
| Tareas › agregar la misma etiqueta dos veces no la duplica | BUG-17 |
| Tareas › las etiquetas se normalizan a minúsculas | BUG-17 |
| Tareas › el listado viene paginado: 20 por defecto | BUG-11 |
| Tareas › la búsqueda no distingue mayúsculas de minúsculas | BUG-10 |
| Tareas › los filtros se combinan entre sí | BUG-05 |

No se arregló nada: un test rojo contra la spec no se borra ni se ajusta.

## Hallazgo: un bug que el pipeline no veía (d. entorno)

En las computadoras del equipo fallan **17** tests; en el pipeline fallaron **16**. El que cambia es:

> `Tareas › editar y asignar › la fecha devuelta es la misma que se cargó, sin importar la zona horaria` — **BUG-03**

BUG-03 (la fecha de vencimiento vuelve un día antes) solo se reproduce con el servidor en una zona horaria negativa como Montevideo (UTC-3). Los runners de GitHub corren en UTC, así que ahí el test pasa y el pipeline **no detecta** un bug que sí existe en el entorno real.

- **Cómo se confirmó:** se corrió la suite en la misma máquina con `TZ=UTC` → 16 fallos; con la zona local → 17. La única diferencia es ese test.
- **Categoría:** d. pipeline o entorno. No es un problema del código de testing sino de dónde corre.
- **Corrección:** se fijó `TZ: America/Montevideo` en `ci.yml`, así el pipeline prueba con la zona horaria de producción. Con ese cambio se espera `17 failed` también en CI.
