import { knownBug } from '../knownBug';
import { ApiError } from '../../src/lib/http';
import type { Status } from '../../src/lib/validation';
import { assertTransition } from '../../src/modules/tasks/transitions';

/**
 * US-06 — Reglas de transición de estado.
 * Válidas: TODO→IN_PROGRESS, IN_PROGRESS→DONE, IN_PROGRESS→TODO.
 * Prohibidas: TODO→DONE y cualquier salida desde DONE (HTTP 422).
 */

function transitionError(from: Status, to: Status): ApiError | null {
  try {
    assertTransition(from, to);
    return null;
  } catch (err) {
    return err as ApiError;
  }
}

describe('assertTransition (US-06)', () => {
  it.each<[Status, Status]>([
    ['TODO', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'DONE'],
    ['IN_PROGRESS', 'TODO'],
  ])('permite %s → %s', (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each<Status>(['TODO', 'IN_PROGRESS', 'DONE'])(
    'mantener el mismo estado (%s) no es una transición y no falla',
    (status) => {
      expect(() => assertTransition(status, status)).not.toThrow();
    },
  );

  it.each<[Status, Status]>([
    ['DONE', 'TODO'],
    ['DONE', 'IN_PROGRESS'],
  ])('rechaza %s → %s con INVALID_TRANSITION (422)', (from, to) => {
    const err = transitionError(from, to);
    expect(err).toBeInstanceOf(ApiError);
    expect(err?.code).toBe('INVALID_TRANSITION');
    expect(err?.status).toBe(422);
    expect(err?.message).toContain(from);
    expect(err?.message).toContain(to);
  });

  // BUG-01: TODO → DONE no está en la lista de transiciones prohibidas.
  knownBug('[BUG-01] rechaza TODO → DONE con INVALID_TRANSITION (422)', () => {
    const err = transitionError('TODO', 'DONE');
    expect(err).toBeInstanceOf(ApiError);
    expect(err?.code).toBe('INVALID_TRANSITION');
    expect(err?.status).toBe(422);
  });
});
