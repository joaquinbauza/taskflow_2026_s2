# Informe de estado — detalle (anexo de la Clase 12, Ejercicio 3)

Anexo del [informe de una página](clase12-ej3-informe.md). Acá quedan los criterios de salida, los defectos abiertos por severidad y los riesgos sin mitigar que no entran en la página.

**Rama:** `main` · **Entorno de las corridas:** Windows 11, Node 22.23.5, TZ America/Montevideo, Chromium 131 · **Fuentes:** [`clase12-ej1b-pipeline.md`](clase12-ej1b-pipeline.md), [`clase12-ej2-ia.md`](clase12-ej2-ia.md), [`bugs.md`](bugs.md), [`performance.md`](performance.md), [`clase12-m2-reporte.md`](clase12-m2-reporte.md).

## Estado vs. criterios de salida

| Criterio | Umbral | Hoy | ¿Cumple? |
|---|---|---|---|
| Build server / cliente | compila | `tsc` OK · `vite build` OK | ✅ |
| Lint | 0 errores | 0 errores (server y raíz) | ✅ |
| Unitarios + integración + contrato + caracterización (Jest) | 100 % verde | 283 passed, 1 skipped (alucinado IA), 284 total · 45 son `knownBug` | ✅ técnico / ❌ funcional |
| Cobertura | líneas ≥ 70 %, ramas ≥ 40 % | líneas **96,76 %**, ramas **86,34 %** | ✅ |
| E2E (Playwright) | 100 % verde | 36 passed (26 de US-12/14/15/16, 4 previos, 6 a11y) · 6 `test.fail` (BUG-03 ×3, BUG-17 ×3) | ✅ técnico / ❌ funcional |
| Contrato (Pact) | provider verifica el pact | 5/5 interacciones OK; rompiendo `name` o `body` falla en segundos | ✅ |
| Accesibilidad (axe WCAG 2.1 A/AA) | 0 violaciones | 0 en 5 vistas (era 1 regla `label`, 2 elementos; corregida) + 2 hallazgos manuales abiertos (ACC-02, ACC-03) | ⚠️ |
| Rendimiento (spec) | p95 ≤ 500 ms con 5.000 tareas | k6, 20 VUs: p95 **25.590 ms**, 0 % errores (seed chica: 17,68 ms) | ❌ |
| Pipeline CI | — | En el PR #1: 4 de 12 checks en rojo por bugs reales (Ej. 1B); hoy los mismos tests corren como fallas esperadas | — |

## Defectos abiertos por severidad

Criterio del equipo ([`bugs.md`](bugs.md)): **Crítica** = seguridad o funcionalidad principal inutilizable; **Alta** = incumple una regla de negocio o pierde/corrompe datos; **Media** = incumple un criterio de aceptación sin pérdida de datos.

| Severidad | Cant. | IDs |
|---|---|---|
| Crítica | 4 | BUG-09 inyección SQL en búsqueda (SEC-01), BUG-14 `forgot-password` revela cuentas y devuelve el token, BUG-15 tokens de reseteo reutilizables/vencidos, **BUG-21** secreto JWT por defecto (SEC-02, CVSS 9.1) |
| Alta | 9 | BUG-01 TODO→DONE, BUG-03 fecha −1 día en UTC-3, BUG-05 filtros, BUG-08 ex-miembro conserva tareas (parcial), BUG-11 sin paginación, BUG-12 estado forzado al crear, BUG-16 contador de intentos, BUG-20 huérfanos al borrar, BUG-22 p95 25,6 s con 20 usuarios |
| Media | 5 | BUG-04 fecha inexistente, BUG-10 búsqueda case-sensitive, BUG-13 orden de comentarios, BUG-17 etiquetas, BUG-19 archivados visibles |

Issues: los 18 defectos abiertos están cargados en GitHub como **#2 a #19** con etiqueta de severidad (`critica` 4, `alta` 9, `media` 5). Críticos: BUG-09 [#8](https://github.com/joaquinbauza/taskflow_2026_s2/issues/8), BUG-14 [#13](https://github.com/joaquinbauza/taskflow_2026_s2/issues/13), BUG-15 [#14](https://github.com/joaquinbauza/taskflow_2026_s2/issues/14), BUG-21 [#18](https://github.com/joaquinbauza/taskflow_2026_s2/issues/18). La correspondencia completa bug → issue está en la columna "Issue" de [`bugs.md`](bugs.md); las plantillas, en [`docs/issues/`](issues/).

## Riesgos sin mitigar

- **Confidencialidad:** BUG-09 + BUG-21 permiten leer tareas de cualquier proyecto y suplantar a cualquier usuario; BUG-14 + BUG-15 permiten tomar cuentas conociendo solo el email.
- **Dependencias de producción** con HIGH: `express` (body-parser, path-to-regexp) y `react-router-dom`; sin rate limit por IP ni headers de seguridad.
- **Rendimiento:** con datos reales y 20 usuarios el tablero tarda 25,6 s (p95) y transfiere 1,86 MB por carga; el throughput baja al aumentar usuarios (0,99 → 0,81 iteraciones/s).
- **Entorno:** BUG-03 solo aparece al oeste de UTC; si se saca `TZ` del CI vuelve a ser invisible.
- **Sin probar:** concurrencia (2 RNF de la spec).

## Condición para reconsiderar la liberación

BUG-09, 14, 15 y 21 cerrados (sus tests `knownBug` pasan a `it`), paginación + N+1 resueltos con p95 ≤ 500 ms en k6 con 20 VUs, y `express`/`react-router-dom` actualizados. Los altos funcionales restantes pueden liberarse con riesgo aceptado y documentado.
