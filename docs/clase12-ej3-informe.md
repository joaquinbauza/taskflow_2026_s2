# Informe de estado — TaskFlow

**Fecha:** 22/11/2026 · **Rama:** `main` · Windows 11, Node 22.23.5, TZ America/Montevideo.

Build, lint, Jest (283 passed), Pact y Playwright (36 passed) terminan en verde, pero porque 51 tests corren como falla esperada: describen la spec y la app no la cumple. Quedan 18 defectos abiertos, 4 de ellos críticos de seguridad. Con el volumen que pide la spec, el listado de tareas incumple el tiempo de respuesta por 51 veces.

## Métricas

| Métrica | Valor hoy | Umbral | Por qué |
|---|---|---|---|
| **Defectos abiertos por severidad** | **4 críticos · 9 altos · 5 medios** (18) | 0 críticos | Decide la liberación: un solo crítico de seguridad la bloquea |
| **Tests que fallan contra la spec** (`knownBug` + `test.fail`) | **51** (45 Jest + 6 Playwright) | 0 | Mide la distancia a la spec, no la calidad de la suite; baja solo cuando se arregla código |
| **p95 del listado de tareas** (5.000 tareas, k6, 20 VUs) | **25.590 ms** | ≤ 500 ms | Único requisito no funcional con número en la spec |
| ~~Cobertura de código~~ (descartada) | líneas 96,76 %, ramas 86,34 % | 70 % / 40 % | Convive con 18 defectos: dice qué se ejecutó, no qué se verificó. Se mantiene solo como umbral mínimo |

## Recomendación: **NO LIBERAR**

Los 4 críticos (BUG-09 inyección SQL, BUG-14 y BUG-15 reseteo de contraseña, BUG-21 secreto JWT forjable) permiten leer datos de otros proyectos y tomar cuentas, en tres casos sin tener cuenta. Se reconsidera cuando esos 4 estén cerrados y el p95 baje de 500 ms.

Detalle de criterios de salida, defectos y riesgos: [`clase12-ej3-detalle.md`](clase12-ej3-detalle.md).
