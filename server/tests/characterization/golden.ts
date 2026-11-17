/**
 * Utilidades de los tests de caracterización (golden master).
 *
 * Estos tests NO describen la especificación: fijan el comportamiento ACTUAL
 * del código que tocó el refactor de smells (commit 18e7f19) para que un
 * refactor futuro no lo cambie sin darse cuenta. Ver docs/smells.md.
 *
 * El "golden master" son los snapshots de __snapshots__/, versionados en el
 * repo. Si un cambio de comportamiento es intencional, se regeneran con
 * `npx jest tests/characterization -u` y se revisa el diff del .snap.
 */
import type { Response } from 'supertest';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Reemplaza lo que cambia entre corridas (fechas, tokens) por un marcador estable. */
function estabilizar(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) return value.map((v) => estabilizar(v));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, estabilizar(v, k)]),
    );
  }
  if (typeof value === 'string') {
    if (ISO_DATE.test(value)) return '<fecha ISO>';
    if (key === 'token') {
      if (/^[0-9a-f]{48}$/.test(value)) return '<48 hex>';
      if (value.split('.').length === 3) return '<JWT>';
    }
  }
  return value;
}

/** Status + body de una respuesta, listo para el snapshot. */
export function resumen(res: Response): { status: number; body: unknown } {
  return { status: res.status, body: estabilizar(res.body) };
}

/** Describe una entrada de la tabla de casos de forma legible en el snapshot. */
export function etiqueta(value: unknown): string {
  if (typeof value === 'string' && value.length > 40) return `"${value.slice(0, 3)}…" (${value.length} caracteres)`;
  return JSON.stringify(value) ?? 'undefined';
}
