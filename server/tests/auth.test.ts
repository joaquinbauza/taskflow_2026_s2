import request from 'supertest';
import { app } from './helpers';

describe('Auth', () => {
  it('acepta y normaliza emails con alias en registro y recuperacion', async () => {
    const email = ' Alias+test@TEST.com ';
    const registration = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password1' });
    expect(registration.status).toBe(201);
    expect(registration.body.user.email).toBe('alias+test@test.com');

    const reset = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(reset.status).toBe(200);
    expect(reset.body.token).toEqual(expect.any(String));
  });

  it('registra un usuario nuevo', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ana@test.com', password: 'Password1' });

    expect(res.status).toBe(201);
  });

  it('inicia sesión con credenciales válidas', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'login@test.com', password: 'Password1' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'Password1' });

    expect(res.status).toBe(200);
  });

  it('rechaza el login con contraseña incorrecta', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'wrong@test.com', password: 'Password1' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@test.com', password: 'Otracosa9' });

    expect(res.status).toBe(401);
  });
});
