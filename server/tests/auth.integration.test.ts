import request from 'supertest';
import { app, registerUser } from './helpers';
import { db } from './db-helpers';

const login = (email: string, password: string) =>
  request(app).post('/api/auth/login').send({ email, password });

async function fallar(email: string, veces: number) {
  for (let i = 0; i < veces; i++) await login(email, 'Incorrecta9');
}

describe('Auth (US-01, US-02, US-17)', () => {
  describe('registro', () => {
    it('rechaza un email ya registrado (409)', async () => {
      await registerUser('ra-dup@test.com');

      const res = await request(app).post('/api/auth/register').send({ email: 'RA-DUP@test.com', password: 'Password1' });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe('Email already registered');
    });

    it('rechaza una contraseña débil (400) y menciona el requisito', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'ra-debil@test.com', password: 'abc' });
      const sinPassword = await request(app).post('/api/auth/register').send({ email: 'ra-debil2@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/8 characters/);
      expect(sinPassword.status).toBe(400);
    });

    it('rechaza una contraseña de 7 caracteres aunque tenga número y mayúscula (400)', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'ra-7@test.com', password: 'Passwo1' });

      expect(res.status).toBe(400);
    });

    it('rechaza un email inválido (400)', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'sin-arroba', password: 'Password1' });

      expect(res.status).toBe(400);
    });

    it('guarda el nombre y no devuelve la contraseña', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'ra-nombre@test.com', password: 'Password1', name: '  Ana  ' });

      expect(res.status).toBe(201);
      expect(res.body.user.name).toBe('Ana');
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    });
  });

  describe('login y bloqueo', () => {
    it('email inexistente y contraseña incorrecta devuelven el mismo mensaje (401)', async () => {
      await registerUser('la-msg@test.com');

      const noExiste = await login('nadie@test.com', 'Password1');
      const malPass = await login('la-msg@test.com', 'Incorrecta9');

      expect(noExiste.status).toBe(401);
      expect(malPass.status).toBe(401);
      expect(noExiste.body.error.message).toBe(malPass.body.error.message);
    });

    it('a los 5 intentos fallidos la cuenta se bloquea, incluso con la contraseña correcta', async () => {
      await registerUser('la-bloqueo@test.com');
      await fallar('la-bloqueo@test.com', 5);

      const res = await login('la-bloqueo@test.com', 'Password1');

      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/locked/i);
    });

    it('el bloqueo se levanta solo cuando pasan los 15 minutos', async () => {
      await registerUser('la-expira@test.com');
      await fallar('la-expira@test.com', 5);
      // Arrange: en vez de esperar 15 minutos, movemos el vencimiento al pasado.
      await db.user.update({
        where: { email: 'la-expira@test.com' },
        data: { lockedUntil: new Date(Date.now() - 1000) },
      });

      const res = await login('la-expira@test.com', 'Password1');

      expect(res.status).toBe(200);
    });

    it('el contador de intentos fallidos se reinicia tras un login exitoso', async () => {
      await registerUser('la-reinicio@test.com');
      await fallar('la-reinicio@test.com', 3);
      await login('la-reinicio@test.com', 'Password1');
      await fallar('la-reinicio@test.com', 3);

      const res = await login('la-reinicio@test.com', 'Password1');

      expect(res.status).toBe(200);
    });

    it('login con body vacío devuelve 401', async () => {
      const res = await request(app).post('/api/auth/login').send({});

      expect(res.status).toBe(401);
    });
  });

  describe('recuperar contraseña', () => {
    async function pedirToken(email: string) {
      const res = await request(app).post('/api/auth/forgot-password').send({ email });
      return res.body.token as string;
    }

    it('un reseteo exitoso permite entrar con la nueva contraseña y desbloquea la cuenta', async () => {
      await registerUser('rp-ok@test.com');
      await fallar('rp-ok@test.com', 5);
      const token = await pedirToken('rp-ok@test.com');

      const res = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'Nueva1234' });
      const entrar = await login('rp-ok@test.com', 'Nueva1234');

      expect(res.status).toBe(200);
      expect(entrar.status).toBe(200);
    });

    it('un token inexistente devuelve 400', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({ token: 'no-existe', newPassword: 'Nueva1234' });

      expect(res.status).toBe(400);
    });

    it('la nueva contraseña debe cumplir las reglas (400)', async () => {
      await registerUser('rp-debil@test.com');
      const token = await pedirToken('rp-debil@test.com');

      const res = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'abc' });

      expect(res.status).toBe(400);
    });

    it('un token ya utilizado no se puede reutilizar (400)', async () => {
      await registerUser('rp-reuso@test.com');
      const token = await pedirToken('rp-reuso@test.com');
      await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'Nueva1234' });

      const res = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'Otra12345' });

      expect(res.status).toBe(400);
    });

    it('un token vencido no sirve (400)', async () => {
      await registerUser('rp-vencido@test.com');
      const token = await pedirToken('rp-vencido@test.com');
      await db.passwordResetToken.update({
        where: { token },
        data: { expiresAt: new Date(Date.now() - 60 * 1000) },
      });

      const res = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'Nueva1234' });

      expect(res.status).toBe(400);
    });

    it('al pedir un token nuevo, el anterior queda invalidado (400)', async () => {
      await registerUser('rp-viejo@test.com');
      const viejo = await pedirToken('rp-viejo@test.com');
      await pedirToken('rp-viejo@test.com');

      const res = await request(app).post('/api/auth/reset-password').send({ token: viejo, newPassword: 'Nueva1234' });

      expect(res.status).toBe(400);
    });

    it('la respuesta no revela si el email existe', async () => {
      await registerUser('rp-existe@test.com');

      const existe = await request(app).post('/api/auth/forgot-password').send({ email: 'rp-existe@test.com' });
      const noExiste = await request(app).post('/api/auth/forgot-password').send({ email: 'nadie@test.com' });

      expect(noExiste.status).toBe(200);
      expect(noExiste.body.message).toBe(existe.body.message);
    });
  });
});
