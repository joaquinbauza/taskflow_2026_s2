# Clase 12 · Ejercicios 2a y 2b — Tests de US-16 generados con IA

**Herramienta:** Claude Code (asistente de IA). **Prompts:** [2a](ia/prompt-us16.md) (rol, contexto, los 8 criterios copiados de la spec, helpers y formato de salida) y [2b](ia/prompt-us16-2b.md) (revisión encadenada contra los criterios). **Archivo:** `server/tests/us16-ia.integration.test.ts` (el código se pegó tal cual; después solo se cambió `it` → `knownBug` / `it.skip` con un comentario, según la clasificación). Corridas del 16/11/2026, Windows 11, Node 22.23.5, TZ America/Montevideo.

## Cobertura (Jest, `npm run test:coverage`)

| | Líneas global | Ramas global | `ids.ts` líneas / ramas | `tasks.service.ts` líneas / ramas | `tasks.controller.ts` líneas / ramas |
|---|---|---|---|---|---|
| Antes | 96,72 % | 85,34 % | 100 % / 95,65 % | 100 % / 93,47 % | 94,44 % / 66,66 % |
| Después (2a + 2b) | 96,72 % | **85,77 %** | 100 % / **100 %** | 100 % / 93,47 % | 94,44 % / 66,66 % |

La suite ya estaba muy cubierta: los 21 tests nuevos solo suman la rama de `parseDueDate` que faltaba (`typeof value !== 'string'`, el caso del número). Los tests de IA **no** mejoran la cobertura de forma relevante; su valor está en los criterios que verifican (ver trazabilidad).

## Clasificación 2a (14 tests)

Resultado crudo: `Tests: 5 failed, 9 passed, 14 total`.

| Test | Resultado | Clasificación | Observación |
|---|---|---|---|
| c1 · sin componente de hora | ✅ | verde pero no prueba nada (casi) | Solo chequea el regex `YYYY-MM-DD`: pasaría igual con BUG-03 (devuelve un día equivocado con el formato correcto) |
| c2 · ISO 8601 (2026-09-15) | ❌ `2026-09-14` | rojo por bug real | **BUG-03** → `knownBug` |
| c3 · misma fecha en UTC-3 | ❌ `2025-12-31` | rojo por bug real | **BUG-03** → `knownBug`. Además no chequea el status antes del body |
| c3 · al crear con dueDate | ❌ `2026-12-30` | rojo por bug real | **BUG-03** → `knownBug` |
| c4 · creada sin vencimiento → null | ✅ | verde y correcto | |
| c5 · null quita la fecha | ✅ | verde y correcto | Solo mira la respuesta del PATCH, no lo persistido (lo marcó 2b) |
| c6 · `15/09/2026` → 400 | ✅ | verde y correcto | |
| c6 · `2026-02-30` → 400 | ❌ 200 | rojo por bug real | **BUG-04** → `knownBug` |
| c6 · con hora → 400 | ✅ | verde y correcto | |
| c6 · número → 400 | ✅ | verde y correcto | Cubre una rama nueva de `ids.ts` |
| c7 · fecha pasada, `overdue: true` | ❌ `undefined` | **alucinado** | El campo `overdue` no existe en la API ni en el prompt → `it.skip` con comentario |
| c8 · no-miembro → 403 | ✅ | verde y correcto | No verifica que la fecha no cambie (lo marcó 2b) |
| c8 · miembro puede cambiarla | ✅ | verde y correcto | |
| sin token → 401 | ✅ | verde y correcto | Fuera de los criterios de US-16 (es de autenticación) |

Totales 2a: **8 verdes y correctos · 1 verde que no prueba nada · 4 rojos por bug real · 0 rojos por test mal escrito · 1 alucinado.**

## Clasificación 2b (7 tests nuevos)

El segundo prompt marcó: c5 y c8 sin verificar persistencia, c3 sin chequeo de status, c7 dependiendo de un campo inexistente (lo señaló como sospechoso de alucinación), y faltantes de string vacío, mes inválido, conservar la fecha al editar otro campo y ex-miembro.

Resultado crudo (21 tests): `Tests: 6 failed, 15 passed, 21 total` (los 5 rojos de 2a + 1 nuevo).

| Test nuevo | Resultado | Clasificación |
|---|---|---|
| c7 · fecha pasada se acepta y se devuelve igual | ❌ `2019-12-31` | rojo por bug real (**BUG-03**) → `knownBug`. Reemplaza al alucinado con algo que la spec sí define |
| c5 · después de quitar, el GET devuelve null | ✅ | verde y correcto |
| c6 · string vacío → 400 | ✅ | verde y correcto |
| c6 · `2026-13-01` → 400 | ✅ | verde y correcto |
| c4 · editar otro campo conserva la fecha | ✅ | verde y correcto (compara contra lo devuelto por el primer PATCH, así no depende de BUG-03) |
| c8 · el no-miembro no altera la fecha | ✅ | verde y correcto |
| c8 · ex-miembro → 403 | ✅ | verde y correcto |

Totales 2b: **6 verdes y correctos · 1 rojo por bug real · 0 mal escritos · 0 alucinados.**

## Comparación 2a vs 2b

| | 2a | 2b (acumulado) |
|---|---|---|
| Tests | 14 | 21 |
| Verdes y correctos | 8 (57 %) | 14 (67 %) |
| Verdes que no prueban nada | 1 | 1 |
| Rojos por bug real | 4 (BUG-03 ×3, BUG-04) | 5 (BUG-03 ×4, BUG-04) |
| Alucinados | 1 | 1 (sigue en `it.skip`, ya no es el único test de c7) |
| Criterios con al menos un test útil | 7 de 8 (c7 solo con el alucinado) | **8 de 8** |
| Bugs nuevos encontrados | 0 (ya conocidos) | 0 |

Conclusión: el primer prompt rinde rápido para casos felices y formatos inválidos, pero inventa API (`overdue`) y escribe asserts débiles (c1, c5, c8 sin persistencia). El prompt encadenado de revisión corrige esos huecos sin alucinaciones nuevas. Los dos encontraron los bugs reales que ya estaban reportados (BUG-03, BUG-04); ninguno encontró uno nuevo. El estado final de la suite: `Tests: 1 skipped, 266 passed, 267 total`.

## Trazabilidad US-16

| Historia | Criterio | Test (`us16-ia.integration.test.ts`) | Resultado |
|---|---|---|---|
| US-16 | c1 día calendario sin hora | c1 · sin componente de hora | ✅ (débil) |
| US-16 | c2 formato ISO | c2 · ISO 8601 (2026-09-15) | ❌ BUG-03 (`knownBug`) |
| US-16 | c3 misma fecha en cualquier TZ | c3 · misma fecha en UTC-3; c3 · al crear con dueDate | ❌ BUG-03 (`knownBug`) |
| US-16 | c4 opcional | c4 · creada sin vencimiento; c4 · editar otro campo conserva la fecha | ✅ |
| US-16 | c5 quitar con null | c5 · null quita la fecha; c5 · el GET devuelve null | ✅ |
| US-16 | c6 formato inválido → 400 | c6 · dd/mm/aaaa; c6 · con hora; c6 · número; c6 · string vacío; c6 · mes 13 | ✅ |
| US-16 | c6 fecha inexistente → 400 | c6 · 2026-02-30 | ❌ BUG-04 (`knownBug`) |
| US-16 | c7 fecha pasada aceptada | c7 · fecha pasada se acepta y se devuelve igual; (c7 · `overdue`, `it.skip`, alucinado) | ❌ BUG-03 (`knownBug`) |
| US-16 | c8 solo miembros (403) | c8 · no-miembro 403; c8 · el no-miembro no altera la fecha; c8 · ex-miembro 403; c8 · miembro puede | ✅ |
