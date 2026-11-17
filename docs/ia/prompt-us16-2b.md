# Prompt 2b — revisión encadenada de los tests de US-16

**Herramienta usada:** Claude Code, en la misma conversación que el prompt 2a (encadenado: recibe como contexto el prompt 2a, el archivo generado y la salida de `npm test`).

---

Revisá los tests que generaste para US-16 (`server/tests/us16-ia.integration.test.ts`) contra los 8 criterios de aceptación del prompt anterior. Para cada criterio, marcá:

1. Qué tests lo cubren y si la aserción realmente lo verifica (¿pasaría igual si el sistema estuviera mal?).
2. Qué casos faltan: felices, de error y de borde. Prestá atención a: si lo que se guarda se **persiste** (verificar con un GET y no solo con la respuesta del PATCH), si un usuario sin permiso **no altera** los datos (no alcanza con el 403), los ex-miembros, el string vacío y otros formatos inválidos, y si editar otro campo conserva la fecha.
3. Asserts que dependan de campos o comportamientos que **no están en la especificación ni en el contexto** que te di (marcalos como sospechosos de alucinación).
4. Tests que no chequean el status antes del body.

Devolvé: una tabla criterio → tests → observación, y el código de los tests nuevos para agregar al final del mismo `describe`, con el mismo estilo y nombres `'US-16 cN · …'`. Para el criterio de ex-miembro podés usar `DELETE /api/projects/:id/members/:userId` como owner.
