# Informe de estado — TaskFlow · 16/11/2026

**Rama:** `entrega-final` · **Entorno de las corridas:** Windows 11, Node 22.23.5, TZ America/Montevideo, Chromium 131 · **Fuente:** corridas de hoy, [`clase12-ej1b-pipeline.md`](clase12-ej1b-pipeline.md), [`clase12-ej2-ia.md`](clase12-ej2-ia.md), [`bugs.md`](bugs.md), [`performance.md`](performance.md), [`clase12-m2-reporte.md`](clase12-m2-reporte.md).

**Resumen.** Todas las verificaciones automáticas terminan en exit 0, pero porque **45 tests de Jest y 6 de Playwright corren como falla esperada**: describen la spec y la app no la cumple. Quedan **18 defectos abiertos, 3 críticos de seguridad** (inyección SQL, reseteo de contraseña) y el listado de tareas incumple el p95 de 500 ms por 51 veces con 20 usuarios.

## Estado vs. criterios de salida

| Criterio | Umbral | Hoy | ¿Cumple? |
|---|---|---|---|
| Build server / cliente | compila | `tsc` OK · `vite build` OK | ✅ |
| Lint | 0 errores | 0 errores (server y raíz) | ✅ |
| Unitarios + integración + contrato (Jest) | 100 % verde | 266 passed, 1 skipped (alucinado IA), 267 total · 45 son `knownBug` | ✅ técnico / ❌ funcional |
| Cobertura | líneas ≥ 70 %, ramas ≥ 40 % | líneas **96,72 %**, ramas **85,77 %** | ✅ |
| E2E (Playwright) | 100 % verde | 36 passed (26 de US-12/14/15/16, 4 previos, 6 a11y) · 6 `test.fail` (BUG-03 ×3, BUG-17 ×3) | ✅ técnico / ❌ funcional |
| Contrato (Pact) | provider verifica el pact | 5/5 interacciones OK; rompiendo `name` o `body` falla en segundos | ✅ |
| Accesibilidad (axe WCAG 2.1 A/AA) | 0 violaciones | 0 en 5 vistas (era 1 regla `label`, 2 elementos; corregida) + 2 hallazgos manuales abiertos (ACC-02, ACC-03) | ⚠️ |
| Rendimiento (spec) | p95 ≤ 500 ms con 5.000 tareas | k6, 20 VUs: p95 **25.590 ms**, 0 % errores (seed chica: 17,68 ms) | ❌ |
| Pipeline CI | — | En el PR #1: 4 de 12 checks en rojo por bugs reales (Ej. 1B); con esta rama, los mismos pasan a fallas esperadas | — |

## Métricas elegidas (3) y descartada (1)

1. **Defectos abiertos por severidad** — es lo que decide liberar: un solo crítico de seguridad bloquea. Hoy: **3 críticos · 10 altos · 5 medios** (18).
2. **Criterios de aceptación con test que falla (fallas esperadas)** — mide la distancia a la spec, no la calidad de la suite: 45 + 6 = **51 tests** sobre 17 historias. Baja solo cuando se arregla código.
3. **p95 del listado de tareas con volumen de la spec** — único criterio no funcional con número en la spec: **25.590 ms vs 500 ms** (k6, 20 VUs).
- **Descartada: cobertura de código.** 96,72 % de líneas convive con 18 defectos abiertos y los tests de IA no la movieron (+0,43 pp en ramas) aunque verificaron 8 criterios. Dice qué se ejecutó, no qué se verificó; se mantiene solo como umbral mínimo.

## Defectos abiertos por severidad

| Severidad | Cant. | IDs |
|---|---|---|
| Crítica | 3 | BUG-09 inyección SQL en búsqueda (SEC-01), BUG-14 `forgot-password` revela cuentas y devuelve el token, BUG-15 tokens de reseteo reutilizables/vencidos |
| Alta | 10 | BUG-01 TODO→DONE, BUG-03 fecha −1 día en UTC-3, BUG-05 filtros, BUG-08 ex-miembro conserva tareas (parcial), BUG-11 sin paginación, BUG-12 estado forzado al crear, BUG-16 contador de intentos, BUG-20 huérfanos al borrar, **BUG-21** secreto JWT por defecto (SEC-02), **BUG-22** p95 5,6 s |
| Media | 5 | BUG-04 fecha inexistente, BUG-10 búsqueda case-sensitive, BUG-13 orden de comentarios, BUG-17 etiquetas, BUG-19 archivados visibles |

Issues: 18 en [`docs/issues/`](issues/) (sin `gh` disponible, pendientes de cargar en GitHub).

## Riesgos sin mitigar

- **Confidencialidad:** BUG-09 + BUG-21 permiten leer tareas de cualquier proyecto y suplantar a cualquier usuario; BUG-14 + BUG-15 permiten tomar cuentas conociendo solo el email.
- **Dependencias de producción** con HIGH: `express` (body-parser, path-to-regexp) y `react-router-dom`; sin rate limit por IP ni headers de seguridad.
- **Rendimiento:** con datos reales y 20 usuarios el tablero tarda 25,6 s (p95) y transfiere 1,86 MB por carga; el throughput baja al aumentar usuarios (0,99 → 0,81 iteraciones/s).
- **Entorno:** BUG-03 solo aparece al oeste de UTC; si se saca `TZ` del CI vuelve a ser invisible.
- **Sin probar:** concurrencia (2 RNF de la spec), revisión con teclado real.

## Recomendación: **NO LIBERAR**

Hay 3 defectos críticos y 1 alto de seguridad explotables por cualquier usuario autenticado (o sin cuenta, en BUG-14/15/21), y el criterio de rendimiento falla por un factor de 51. Condición mínima para reconsiderar: BUG-09, 14, 15 y 21 cerrados (sus tests `knownBug` pasan a `it`), paginación + N+1 resueltos con p95 ≤ 500 ms en k6 con 20 VUs, y `express`/`react-router-dom` actualizados. Los altos funcionales restantes pueden liberarse con riesgo aceptado y documentado.
