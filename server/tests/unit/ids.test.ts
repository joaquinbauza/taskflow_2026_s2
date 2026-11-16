import { knownBug } from '../knownBug';
import { execFileSync } from 'child_process';
import path from 'path';
import { formatDueDate, parseDueDate, parsePublicId, toPublicId } from '../../src/lib/ids';

describe('toPublicId / parsePublicId', () => {
  it('genera ids prefijados', () => {
    expect(toPublicId('user', 1)).toBe('user-1');
    expect(toPublicId('task', 42)).toBe('task-42');
  });

  it('ida y vuelta', () => {
    expect(parsePublicId(toPublicId('proj', 7), 'proj')).toBe(7);
  });

  it.each([
    ['task-3', 'task', 3],
    [' task-3 ', 'task', 3],
    ['3', 'task', 3],
    [5, 'task', 5],
  ] as const)('parsea %p con prefijo %s → %p', (value, prefix, expected) => {
    expect(parsePublicId(value, prefix)).toBe(expected);
  });

  it.each([
    ['proj-3', 'task'],
    ['task-0', 'task'],
    ['task--1', 'task'],
    ['task-abc', 'task'],
    ['task-1.5', 'task'],
    ['', 'task'],
    [null, 'task'],
    [undefined, 'task'],
  ] as const)('devuelve null para %p con prefijo %s', (value, prefix) => {
    expect(parsePublicId(value, prefix)).toBeNull();
  });
});

/**
 * La zona horaria de Node se fija al arrancar el proceso y Jest no deja
 * cambiarla desde un test, así que el ida y vuelta se corre en un proceso hijo
 * con la variable TZ que corresponda.
 */
function roundTripIn(tz: string, value: string): string {
  const idsModule = path.join(__dirname, '..', '..', 'src', 'lib', 'ids.ts');
  const script = `
    require('ts-node').register({ transpileOnly: true });
    const { parseDueDate, formatDueDate } = require(${JSON.stringify(idsModule)});
    process.stdout.write(String(formatDueDate(parseDueDate(${JSON.stringify(value)}))));
  `;
  return execFileSync(process.execPath, ['-e', script], {
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  });
}

describe('parseDueDate / formatDueDate (US-16)', () => {
  it('acepta null para quitar la fecha', () => {
    expect(parseDueDate(null)).toBeNull();
    expect(formatDueDate(null)).toBeNull();
  });

  it.each(['15/09/2026', '2026-9-15', '2026-09-15T10:00:00Z', '', 20260915])(
    'rechaza el formato inválido %p (undefined → 400 en el servicio)',
    (value) => {
      expect(parseDueDate(value)).toBeUndefined();
    },
  );

  it.each(['UTC', 'Asia/Tokyo'])('devuelve la misma fecha que se cargó con el servidor en %s', (tz) => {
    expect(roundTripIn(tz, '2026-09-15')).toBe('2026-09-15');
  });

  // BUG-03: parseDueDate crea medianoche UTC y formatDueDate lee la fecha en hora
  // local; con el servidor al oeste de UTC (Uruguay, UTC-3) vuelve un día antes.
  knownBug('[BUG-03] devuelve la misma fecha que se cargó con el servidor en UTC-3', () => {
    expect(roundTripIn('America/Montevideo', '2026-09-15')).toBe('2026-09-15');
  });

  // BUG-04: new Date('2026-02-30') no es inválido en V8: se corre al 2 de marzo.
  knownBug('[BUG-04] rechaza una fecha de calendario inexistente (2026-02-30)', () => {
    expect(parseDueDate('2026-02-30')).toBeUndefined();
  });
});
