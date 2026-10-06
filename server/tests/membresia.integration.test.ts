import request from 'supertest';
import { app, auth, createProject, createTask, registerUser } from './helpers';
import { addMemberDb } from './db-helpers';

// Cubre middleware/membership.ts: requireProjectMember y requireTaskProjectMember.
describe('Membresía (middleware)', () => {
  it('un no-miembro no puede listar las tareas de un proyecto ajeno (403)', async () => {
    // Arrange
    const owner = await registerUser('mem-owner1@test.com');
    const ajeno = await registerUser('mem-ajeno1@test.com');
    const p = await createProject(owner.token, 'Privado');
    // Act
    const res = await request(app).get(`/api/projects/${p.id}/tasks`).set(auth(ajeno.token));
    // Assert
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('un no-miembro no puede crear tareas en un proyecto ajeno (403)', async () => {
    const owner = await registerUser('mem-owner2@test.com');
    const ajeno = await registerUser('mem-ajeno2@test.com');
    const p = await createProject(owner.token, 'Privado');

    const res = await request(app)
      .post(`/api/projects/${p.id}/tasks`)
      .set(auth(ajeno.token))
      .send({ title: 'Intrusa' });

    expect(res.status).toBe(403);
  });

  it('devuelve 404 si el proyecto no existe', async () => {
    const u = await registerUser('mem-404@test.com');

    const res = await request(app).get('/api/projects/proj-9999/tasks').set(auth(u.token));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('devuelve 404 si el id del proyecto tiene otro prefijo', async () => {
    const u = await registerUser('mem-prefijo@test.com');

    const res = await request(app).get('/api/projects/task-1/tasks').set(auth(u.token));

    expect(res.status).toBe(404);
  });

  it('un miembro (no owner) sí puede listar las tareas del proyecto', async () => {
    const owner = await registerUser('mem-owner3@test.com');
    const miembro = await registerUser('mem-miembro3@test.com');
    const p = await createProject(owner.token, 'Compartido');
    await addMemberDb(p.id, miembro.id);
    await createTask(owner.token, p.id, { title: 'Visible' });

    const res = await request(app).get(`/api/projects/${p.id}/tasks`).set(auth(miembro.token));

    expect(res.status).toBe(200);
    expect(res.body.items.map((t: { title: string }) => t.title)).toEqual(['Visible']);
  });

  it('un no-miembro no puede ver el detalle de una tarea ajena (403)', async () => {
    const owner = await registerUser('mem-owner4@test.com');
    const ajeno = await registerUser('mem-ajeno4@test.com');
    const p = await createProject(owner.token, 'Privado');
    const t = await createTask(owner.token, p.id, { title: 'Secreta' });

    const res = await request(app).get(`/api/tasks/${t.id}`).set(auth(ajeno.token));

    expect(res.status).toBe(403);
  });

  it('devuelve 404 al pedir una tarea inexistente', async () => {
    const u = await registerUser('mem-task404@test.com');

    const inexistente = await request(app).get('/api/tasks/task-9999').set(auth(u.token));
    const malFormado = await request(app).get('/api/tasks/proj-1').set(auth(u.token));

    expect(inexistente.status).toBe(404);
    expect(malFormado.status).toBe(404);
  });

  it('un no-miembro no puede comentar ni leer comentarios de una tarea ajena (403)', async () => {
    const owner = await registerUser('mem-owner5@test.com');
    const ajeno = await registerUser('mem-ajeno5@test.com');
    const p = await createProject(owner.token, 'Privado');
    const t = await createTask(owner.token, p.id, { title: 'Secreta' });

    const leer = await request(app).get(`/api/tasks/${t.id}/comments`).set(auth(ajeno.token));
    const comentar = await request(app)
      .post(`/api/tasks/${t.id}/comments`)
      .set(auth(ajeno.token))
      .send({ body: 'Hola' });

    expect(leer.status).toBe(403);
    expect(comentar.status).toBe(403);
  });

  it('rechaza un token inválido (401)', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set({ Authorization: 'Bearer token-trucho' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
