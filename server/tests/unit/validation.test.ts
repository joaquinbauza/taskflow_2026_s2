import { knownBug } from '../knownBug';
import { ApiError } from '../../src/lib/http';
import {
  assertEmail,
  assertOptionalString,
  assertPassword,
  assertPriority,
  assertStatus,
  assertString,
  normalizeEmail,
} from '../../src/lib/validation';

function errorOf(fn: () => unknown): ApiError | null {
  try {
    fn();
    return null;
  } catch (err) {
    return err as ApiError;
  }
}

describe('assertEmail / normalizeEmail (US-01)', () => {
  it('normaliza a minúsculas y quita espacios', () => {
    expect(normalizeEmail('  Ana@Test.COM ')).toBe('ana@test.com');
    expect(assertEmail('Ana@Test.com')).toBe('ana@test.com');
  });

  it.each(['ana@test.com', 'ana.perez+tf@mail.example.uy'])('acepta %s', (email) => {
    expect(() => assertEmail(email)).not.toThrow();
  });

  it.each([['sin-arroba.com'], ['ana@'], ['ana@test'], ['ana @test.com'], [''], [42], [undefined]])(
    'rechaza %p con VALIDATION_ERROR (400)',
    (email) => {
      const err = errorOf(() => assertEmail(email));
      expect(err?.code).toBe('VALIDATION_ERROR');
      expect(err?.status).toBe(400);
    },
  );
});

describe('assertPassword (US-01 / US-17)', () => {
  it.each(['Password1', 'Passw0rd', 'ABCDEFG1'])('acepta %s (≥8, número y mayúscula)', (pwd) => {
    expect(assertPassword(pwd)).toBe(pwd);
  });

  it.each([
    ['abc', 'muy corta'],
    ['password1', 'sin mayúscula'],
    ['Password', 'sin número'],
    ['', 'vacía'],
  ])('rechaza "%s" (%s) y el mensaje menciona el requisito', (pwd) => {
    const err = errorOf(() => assertPassword(pwd));
    expect(err?.status).toBe(400);
    expect(err?.message).toMatch(/8 characters/);
  });

  it('rechaza un valor que no es string', () => {
    expect(errorOf(() => assertPassword(undefined))?.status).toBe(400);
  });

  // BUG-02: la validación usa length >= 7 en vez de >= 8.
  knownBug('[BUG-02] rechaza una contraseña de 7 caracteres aunque tenga número y mayúscula', () => {
    const err = errorOf(() => assertPassword('Passwo1'));
    expect(err?.status).toBe(400);
  });
});

describe('assertString', () => {
  it('recorta espacios antes de medir la longitud', () => {
    expect(assertString('  abc  ', 'title', 3, 200)).toBe('abc');
    expect(errorOf(() => assertString(' ab ', 'title', 3, 200))?.status).toBe(400);
  });

  it('respeta los bordes del rango', () => {
    expect(assertString('a'.repeat(200), 'title', 3, 200)).toHaveLength(200);
    expect(errorOf(() => assertString('a'.repeat(201), 'title', 3, 200))?.status).toBe(400);
  });

  it('exige que sea string', () => {
    expect(errorOf(() => assertString(undefined, 'title', 3, 200))?.message).toBe('title is required');
  });
});

describe('assertOptionalString', () => {
  it('distingue ausente (undefined), nulo y valor', () => {
    expect(assertOptionalString(undefined, 'description', 500)).toBeUndefined();
    expect(assertOptionalString(null, 'description', 500)).toBeNull();
    expect(assertOptionalString('  hola ', 'description', 500)).toBe('hola');
  });

  it('rechaza más de 500 caracteres', () => {
    expect(errorOf(() => assertOptionalString('x'.repeat(501), 'description', 500))?.status).toBe(400);
  });
});

describe('assertPriority / assertStatus (US-05 / US-06)', () => {
  it.each(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])('acepta la prioridad %s', (p) => {
    expect(assertPriority(p)).toBe(p);
  });

  it('rechaza una prioridad inválida y lista los valores válidos', () => {
    const err = errorOf(() => assertPriority('URGENTE'));
    expect(err?.status).toBe(400);
    expect(err?.message).toContain('LOW, MEDIUM, HIGH, CRITICAL');
  });

  it('es sensible a mayúsculas en la prioridad', () => {
    expect(errorOf(() => assertPriority('high'))?.status).toBe(400);
  });

  it.each(['TODO', 'IN_PROGRESS', 'DONE'])('acepta el estado %s', (s) => {
    expect(assertStatus(s)).toBe(s);
  });

  it('rechaza un estado inválido', () => {
    expect(errorOf(() => assertStatus('BLOCKED'))?.status).toBe(400);
  });
});
