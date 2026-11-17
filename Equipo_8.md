# Equipo 8 — Calificaciones por equipo, Testing y Calidad de Software 2026

**Repo:** https://github.com/joaquinbauza/taskflow_2026_s2

Este archivo tiene solo las tareas calificadas por equipo. Las notas individuales (cuestionario de la clase 1, cuestionarios de Moodle y participación) se llevan aparte.

_Escala de las notas: 0-100._

## Tareas por equipo

| Tarea | Clase | Peso | Puntos del curso (máx., de 100) | Nota | Aporta a la final (puntos) | Observaciones |
|---|---|---|---|---|---|---|
| Taller de refinamiento | 2 | 5,3 | 2,65 | pendiente |  | Pendiente de entrega: no figura en el repo. |
| Integration + cobertura + refactor (código pestilente + Ej. 1 de clase 7) | 3 y 7 | 10,6 | 5,30 | 92 | 4,88 | Refactor de 5 smells y cobertura real de 96,72 % de líneas y 85,77 % de ramas, con umbral en Jest. Los smells solo están listados en el mensaje del commit y quedó código comentado. |
| Postman + Supertest, caza de bugs | 5 | 5,3 | 2,65 | 90 | 2,39 | Supertest completo (AAA, status y cuerpo, casos negativos; 266 pasan, 0 fallan). Postman no se cuenta. Los reportes de docs/bugs.md no tienen reproducibilidad y casi no tienen evidencia. |
| ADR | 6 | 5,3 | 2,65 | 97 | 2,57 | ADR completo con alternativas descartadas y costos, y Component Object implementado. El ADR describe tests/api/, que no existe. |
| E2E + bugs | 7 y 8 | 10,6 | 5,30 | 100 | 5,30 | 26 tests E2E (6 a 7 por historia) y 18 GitHub issues (#2 a #19) con el formato completo. |
| Performance (k6: tabla seed chica vs grande + issue) | 9 | 5,3 | 2,65 | 100 | 2,65 | Tabla seed chica vs. grande, hipótesis (sin paginación y N+1) e issue #19 con los criterios de la spec. Números declarados, no verificados con k6. |
| Seguridad + accesibilidad (ZAP, axe-core, CVSS) | 11 | 5,3 | 2,65 | 87 | 2,31 | Pruebas manuales con curl y npm audit, axe-core con fix verificado y user stories de remediación. No usaron OWASP ZAP y el CVSS de SEC-02 está mal calculado (el vector da 9.1, no 8.8). |
| Pipeline (`ci.yml` y job de E2E) | 12 | 10,6 | 5,30 | 100 | 5,30 | ci.yml con 7 jobs independientes, cache de npm y job de E2E, todos en verde en el run #16 de main. |
| Presentación (por definir) | 16 | 15,9 | 7,95 | pendiente |  | Pendiente: todavía no se definió. |
| Informe de una página | 12 | 12,8 | 6,40 | 85 | 5,44 | Tabla de métricas y recomendación explícita (NO LIBERAR), con números que coinciden con el repo. Tiene unas 830 palabras y 3 tablas: no entra en una página. |
| **Total por equipo** | | **87,0** (65,8 ya calificados) | **43,50** | 93,70 (promedio ponderado de lo calificado) | **30,83** | Faltan: Taller de refinamiento (pendiente de entrega) y Presentación (no definida). |
| Tareas individuales (Moodle 6, participación 5, cuestionario clase 1 2; pesos provisorios) |  | 13 | 6,50 |  | pendiente | Se llevan aparte, ver `Calificacion_final.md`. |
| **Proyecto final corregido** |  |  | **50,00** | pendiente | pendiente | Vale el 50 % de la nota final. Se califica después de que arreglen lo señalado en las tareas. |
| **Total del curso** |  |  | **100,00** |  | **30,83** de 100 (hasta ahora; faltan individuales y proyecto final) | 43,50 (equipo) + 6,50 (individuales) + 50,00 (proyecto) |

_Los 13 de peso restantes de las tareas (6,5 puntos del curso: Moodle 6, participación 5, cuestionario clase 1 2) son individuales. Pesos provisorios, pendientes de confirmar._

## Proyecto corregido

| Concepto | Nota | Observaciones |
|---|---|---|
| Nota del proyecto corregido (incluye Rúbrica C de Pact) | | |

## Sugerencias de arreglo para el equipo (2026-11-17)

Notas en escala 0-100. Los "GitHub issues" son los tickets de la pestaña Issues del repo.

### Informe de una página
- **No entra en una página:** `docs/clase12-ej3-informe.md` tiene unas 830 palabras y 3 tablas. Dejar solo la tabla de métricas, 3 o 4 líneas de contexto y la recomendación (unas 400 palabras) y mover el detalle de defectos y riesgos a `docs/`. Hasta 15 puntos.

### Seguridad + accesibilidad
- **Falta OWASP ZAP:** correr un baseline scan contra la app local (`zap-baseline.py -t http://localhost:5173`, o con la imagen `ghcr.io/zaproxy/zaproxy:stable`), guardar el reporte en `docs/evidencias/seguridad/` y cruzar sus hallazgos con los de curl. Hasta 10 puntos.
- **CVSS de SEC-02:** el vector AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N da 9.1 y no 8.8. Corregir el número o el vector (calculadora de first.org/cvss/calculator/3.1) y puntuar también BUG-14 y BUG-15. Hasta 3 puntos.

### Postman + Supertest
- **Reportes de bug de `docs/bugs.md`:** agregar el campo "Reproducibilidad: N de N" y un link a la evidencia (salida del test o captura) en cada bug, como ya hicieron en los issues. Hasta 10 puntos.

### Integration + cobertura + refactor
- **Smells sin documentar y código comentado:** crear `docs/smells.md` con una tabla "smell, dónde estaba, refactor que lo resolvió, commit", escribir los tests de caracterización antes de refactorizar y borrar el código comentado (`auth.service.ts:10`, `projects.controller.ts:8`). Hasta 8 puntos.

### ADR
- **Alinear el ADR con lo implementado:** el §2.6 describe `tests/api/`, que no existe. Quitarlo o aclarar que el contrato lo cubren Jest y Pact. Hasta 3 puntos.

### Pendientes de entrega
- Taller de refinamiento y Presentación.
