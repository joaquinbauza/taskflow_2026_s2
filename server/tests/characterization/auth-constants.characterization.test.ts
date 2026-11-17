/**
 * Caracterización · Smell 2 (Magic Number): números de autenticación.
 * auth.service.ts usa 10 (rondas de bcrypt), 5 (intentos), 15 min (bloqueo),
 * 24 bytes (token de reseteo) y 60 min (vigencia del token). Se fija el
 * efecto observable de cada número, para poder volver a extraerlos a
 * constantes sin cambiar el comportamiento.
 */
import request from 'supertest';
import { db } from '../../src/lib/db';
import { app, registerUser } from '../helpers';
import { resumen } from './golden';

const MINUTO = 60 * 1000;

function login(email: string, password: string) {
  return request(app).post('/api/auth/login').send({ email, password });
}

describe('Caracterización · constantes de autenticación', () => {
  it('bcrypt usa 10 rondas al registrar y al resetear la contraseña', async () => {
    await registerUser('rondas@test.com');
    const antes = await db.user.findUniqueOrThrow({ where: { email: 'rondas@test.com' } });

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: 'rondas@test.com' });
    await request(app).post('/api/auth/reset-password').send({ token: forgot.body.token, newPassword: 'NuevaClave1' });
    const despues = await db.user.findUniqueOrThrow({ where: { email: 'rondas@test.com' } });

    expect(antes.passwordHash.slice(0, 7)).toBe('$2a$10$');
    expect(despues.passwordHash.slice(0, 7)).toBe('$2a$10$');
  });

  it('el 5.º intento fallido bloquea la cuenta 15 minutos', async () => {
    await registerUser('bloqueo@test.com');
    const respuestas = [];
    for (let i = 1; i <= 5; i++) {
      const res = await login('bloqueo@test.com', 'Incorrecta1');
      const u = await db.user.findUniqueOrThrow({ where: { email: 'bloqueo@test.com' } });
      respuestas.push({ intento: i, ...resumen(res), failedAttempts: u.failedAttempts, bloqueada: u.lockedUntil !== null });
    }
    const conLaCorrecta = await login('bloqueo@test.com', 'Password1');
    respuestas.push({ intento: 'correcta tras el bloqueo', ...resumen(conLaCorrecta) });
    expect(respuestas).toMatchSnapshot();

    const u = await db.user.findUniqueOrThrow({ where: { email: 'bloqueo@test.com' } });
    const restante = u.lockedUntil!.getTime() - Date.now();
    expect(restante).toBeGreaterThan(14 * MINUTO);
    expect(restante).toBeLessThanOrEqual(15 * MINUTO);
  });

  it('con el bloqueo vencido, la contraseña correcta vuelve a entrar', async () => {
    await registerUser('bloqueo-vencido@test.com');
    await db.user.update({
      where: { email: 'bloqueo-vencido@test.com' },
      data: { failedAttempts: 5, lockedUntil: new Date(Date.now() - MINUTO) },
    });
    const res = await login('bloqueo-vencido@test.com', 'Password1');
    const u = await db.user.findUniqueOrThrow({ where: { email: 'bloqueo-vencido@test.com' } });
    expect({ status: res.status, failedAttempts: u.failedAttempts, lockedUntil: u.lockedUntil }).toMatchSnapshot();
  });

  it('un login exitoso no reinicia el contador de intentos fallidos', async () => {
    await registerUser('contador@test.com');
    await login('contador@test.com', 'Incorrecta1');
    await login('contador@test.com', 'Incorrecta1');
    const ok = await login('contador@test.com', 'Password1');
    const u = await db.user.findUniqueOrThrow({ where: { email: 'contador@test.com' } });
    expect({ status: ok.status, failedAttempts: u.failedAttempts }).toMatchSnapshot();
  });

  it('el token de reseteo tiene 24 bytes (48 hex) y vence a los 60 minutos', async () => {
    await registerUser('token@test.com');
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'token@test.com' });
    expect(resumen(res)).toMatchSnapshot();
    expect(res.body.token).toMatch(/^[0-9a-f]{48}$/);

    const registro = await db.passwordResetToken.findUniqueOrThrow({ where: { token: res.body.token } });
    const vigencia = registro.expiresAt.getTime() - registro.createdAt.getTime();
    expect(Math.abs(vigencia - 60 * MINUTO)).toBeLessThan(5 * 1000);
  });
});
