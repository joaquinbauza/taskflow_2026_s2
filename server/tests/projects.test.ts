import request from 'supertest';
import { app, auth, registerUser } from './helpers';

describe('Proyectos', () => {
  it('rechaza nombres cortos y acepta el minimo luego de quitar espacios', async () => {
    const { token } = await registerUser('project-name-length@test.com');
    for (const name of ['', '  ', ' ab ']) {
      const response = await request(app).post('/api/projects').set(auth(token)).send({ name });
      expect(response.status).toBe(400);
    }
    const response = await request(app).post('/api/projects').set(auth(token)).send({ name: ' abc ' });
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('abc');
  });

  it('crea un proyecto', async () => {
    const { token } = await registerUser('proj1@test.com');

    const res = await request(app)
      .post('/api/projects')
      .set(auth(token))
      .send({ name: 'Mi Proyecto', description: 'Descripción' });

    expect(res.status).toBe(201);
  });

  it('lista los proyectos del usuario', async () => {
    const { token } = await registerUser('proj2@test.com');
    await request(app).post('/api/projects').set(auth(token)).send({ name: 'Proyecto A' });
    await request(app).post('/api/projects').set(auth(token)).send({ name: 'Proyecto B' });

    const res = await request(app).get('/api/projects').set(auth(token));

    expect(res.body).toHaveLength(2);
  });

  it('rechaza crear un proyecto sin autenticación', async () => {
    const res = await request(app).post('/api/projects').send({ name: 'Sin token' });

    expect(res.status).toBe(401);
  });
});
