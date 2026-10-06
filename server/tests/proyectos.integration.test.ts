import request from 'supertest';
import { app, auth, createProject, createTask, registerUser } from './helpers';
import { addMemberDb, archiveProjectDb, db, num } from './db-helpers';

describe('Proyectos (US-03, US-04, US-09, US-10, US-11)', () => {
  describe('crear', () => {
    it('rechaza un proyecto con nombre duplicado del mismo owner (409)', async () => {
      const u = await registerUser('pc-dup@test.com');
      await createProject(u.token, 'Repetido');

      const res = await request(app).post('/api/projects').set(auth(u.token)).send({ name: 'Repetido' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rechaza un nombre de más de 100 caracteres (400)', async () => {
      const u = await registerUser('pc-largo@test.com');

      const res = await request(app)
        .post('/api/projects')
        .set(auth(u.token))
        .send({ name: 'x'.repeat(101) });

      expect(res.status).toBe(400);
    });

    it('rechaza un nombre de 2 caracteres (400)', async () => {
      const u = await registerUser('pc-corto@test.com');

      const res = await request(app).post('/api/projects').set(auth(u.token)).send({ name: 'ab' });

      expect(res.status).toBe(400);
    });

    it('el creador queda como owner y la respuesta trae id, nombre y fecha', async () => {
      const u = await registerUser('pc-ok@test.com');

      const res = await request(app)
        .post('/api/projects')
        .set(auth(u.token))
        .send({ name: 'Nuevo', description: 'desc' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'Nuevo', description: 'desc', ownerId: u.id, archived: false });
      expect(res.body.id).toMatch(/^proj-\d+$/);
    });
  });

  describe('listar', () => {
    it('devuelve un array vacío si el usuario no tiene proyectos', async () => {
      const u = await registerUser('pl-vacio@test.com');

      const res = await request(app).get('/api/projects').set(auth(u.token));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('no muestra proyectos de otros usuarios', async () => {
      const ana = await registerUser('pl-ana@test.com');
      const bob = await registerUser('pl-bob@test.com');
      await createProject(ana.token, 'De Ana');

      const res = await request(app).get('/api/projects').set(auth(bob.token));

      expect(res.body).toEqual([]);
    });

    it('un miembro ve el proyecto donde lo agregaron', async () => {
      const ana = await registerUser('pl-ana2@test.com');
      const bob = await registerUser('pl-bob2@test.com');
      const p = await createProject(ana.token, 'Compartido');
      await addMemberDb(p.id, bob.id);

      const res = await request(app).get('/api/projects').set(auth(bob.token));

      expect(res.body.map((x: { id: string }) => x.id)).toEqual([p.id]);
    });

    it('no muestra al owner sus proyectos archivados', async () => {
      const ana = await registerUser('pl-arch-owner@test.com');
      const p = await createProject(ana.token, 'Viejo');
      await archiveProjectDb(p.id);

      const res = await request(app).get('/api/projects').set(auth(ana.token));

      expect(res.body.map((x: { name: string }) => x.name)).not.toContain('Viejo');
    });

    it('no muestra a un miembro (no owner) los proyectos archivados', async () => {
      const ana = await registerUser('pl-arch-ana@test.com');
      const bob = await registerUser('pl-arch-bob@test.com');
      const p = await createProject(ana.token, 'Viejo');
      await addMemberDb(p.id, bob.id);
      await archiveProjectDb(p.id);

      const res = await request(app).get('/api/projects').set(auth(bob.token));

      expect(res.body.map((x: { name: string }) => x.name)).not.toContain('Viejo');
    });
  });

  describe('editar', () => {
    it('el owner puede cambiar el nombre', async () => {
      const u = await registerUser('pe-ok@test.com');
      const p = await createProject(u.token, 'Proyecto Viejo');

      const res = await request(app)
        .patch(`/api/projects/${p.id}`)
        .set(auth(u.token))
        .send({ name: 'Proyecto Nuevo' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Proyecto Nuevo');
    });

    it('solo enviar la descripción conserva el nombre', async () => {
      const u = await registerUser('pe-desc@test.com');
      const p = await createProject(u.token, 'Se queda');

      const res = await request(app)
        .patch(`/api/projects/${p.id}`)
        .set(auth(u.token))
        .send({ description: 'Nueva descripción' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name: 'Se queda', description: 'Nueva descripción' });
    });

    it('rechaza renombrar a un nombre que ya usa otro proyecto mío (409)', async () => {
      const u = await registerUser('pe-dup@test.com');
      await createProject(u.token, 'Alfa');
      const beta = await createProject(u.token, 'Beta');

      const res = await request(app).patch(`/api/projects/${beta.id}`).set(auth(u.token)).send({ name: 'Alfa' });

      expect(res.status).toBe(409);
    });

    it('rechaza un nombre inválido al editar (400)', async () => {
      const u = await registerUser('pe-corto@test.com');
      const p = await createProject(u.token, 'Valido');

      const res = await request(app).patch(`/api/projects/${p.id}`).set(auth(u.token)).send({ name: 'ab' });

      expect(res.status).toBe(400);
    });

    it('un miembro no owner recibe 403', async () => {
      const ana = await registerUser('pe-ana@test.com');
      const bob = await registerUser('pe-bob@test.com');
      const p = await createProject(ana.token, 'De Ana');
      await addMemberDb(p.id, bob.id);

      const res = await request(app).patch(`/api/projects/${p.id}`).set(auth(bob.token)).send({ name: 'Otro nombre' });

      expect(res.status).toBe(403);
    });

    it('un proyecto ajeno o inexistente devuelve 404', async () => {
      const ana = await registerUser('pe-ana404@test.com');
      const caro = await registerUser('pe-caro404@test.com');
      const p = await createProject(ana.token, 'De Ana');

      const ajeno = await request(app).patch(`/api/projects/${p.id}`).set(auth(caro.token)).send({ name: 'Mío' });
      const inexistente = await request(app).patch('/api/projects/proj-9999').set(auth(caro.token)).send({ name: 'Mío' });
      const malId = await request(app).patch('/api/projects/abc-x').set(auth(caro.token)).send({ name: 'Mío' });

      expect(ajeno.status).toBe(404);
      expect(inexistente.status).toBe(404);
      expect(malId.status).toBe(404);
    });
  });

  describe('eliminar', () => {
    it('el owner elimina el proyecto (204) y deja de aparecer en el listado', async () => {
      const u = await registerUser('pd-ok@test.com');
      const p = await createProject(u.token, 'A borrar');

      const res = await request(app).delete(`/api/projects/${p.id}`).set(auth(u.token));
      const lista = await request(app).get('/api/projects').set(auth(u.token));

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
      expect(lista.body).toEqual([]);
    });

    it('un miembro no owner recibe 403', async () => {
      const ana = await registerUser('pd-ana@test.com');
      const bob = await registerUser('pd-bob@test.com');
      const p = await createProject(ana.token, 'De Ana');
      await addMemberDb(p.id, bob.id);

      const res = await request(app).delete(`/api/projects/${p.id}`).set(auth(bob.token));

      expect(res.status).toBe(403);
    });

    it('un proyecto inexistente devuelve 404', async () => {
      const u = await registerUser('pd-404@test.com');

      const res = await request(app).delete('/api/projects/proj-9999').set(auth(u.token));
      const ajeno = await request(app).delete('/api/projects/x-1').set(auth(u.token));

      expect(res.status).toBe(404);
      expect(ajeno.status).toBe(404);
    });

    it('un usuario ajeno (no miembro) recibe 404', async () => {
      const ana = await registerUser('pd-ana2@test.com');
      const caro = await registerUser('pd-caro2@test.com');
      const p = await createProject(ana.token, 'De Ana');

      const res = await request(app).delete(`/api/projects/${p.id}`).set(auth(caro.token));

      expect(res.status).toBe(404);
    });

    it('al eliminar el proyecto no quedan comentarios ni historial de sus tareas', async () => {
      const u = await registerUser('pd-cascada@test.com');
      const p = await createProject(u.token, 'Con cosas');
      const t = await createTask(u.token, p.id, { title: 'Tarea', assigneeId: u.id });
      await request(app).post(`/api/tasks/${t.id}/comments`).set(auth(u.token)).send({ body: 'Uno' });
      await request(app).post(`/api/tasks/${t.id}/comments`).set(auth(u.token)).send({ body: 'Dos' });

      const res = await request(app).delete(`/api/projects/${p.id}`).set(auth(u.token));

      expect(res.status).toBe(204);
      expect(await db.task.count({ where: { projectId: num(p.id) } })).toBe(0);
      expect(await db.comment.count({ where: { taskId: num(t.id) } })).toBe(0);
      expect(await db.taskHistory.count({ where: { taskId: num(t.id) } })).toBe(0);
    });
  });

  describe('miembros', () => {
    it('el owner agrega un miembro por email (201) y el miembro ve el proyecto', async () => {
      const ana = await registerUser('pm-ana@test.com');
      const bob = await registerUser('pm-bob@test.com');
      const p = await createProject(ana.token, 'Equipo');

      const res = await request(app)
        .post(`/api/projects/${p.id}/members`)
        .set(auth(ana.token))
        .send({ email: 'pm-bob@test.com' });
      const lista = await request(app).get('/api/projects').set(auth(bob.token));

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ projectId: p.id, userId: bob.id, role: 'MEMBER' });
      expect(lista.body.map((x: { id: string }) => x.id)).toContain(p.id);
    });

    it('agregar un email sin usuario devuelve 404', async () => {
      const ana = await registerUser('pm-ana404@test.com');
      const p = await createProject(ana.token, 'Equipo');

      const res = await request(app)
        .post(`/api/projects/${p.id}/members`)
        .set(auth(ana.token))
        .send({ email: 'nadie@test.com' });

      expect(res.status).toBe(404);
    });

    it('agregar a alguien que ya es miembro devuelve 409', async () => {
      const ana = await registerUser('pm-ana409@test.com');
      const bob = await registerUser('pm-bob409@test.com');
      const p = await createProject(ana.token, 'Equipo');
      await addMemberDb(p.id, bob.id);

      const res = await request(app)
        .post(`/api/projects/${p.id}/members`)
        .set(auth(ana.token))
        .send({ email: 'pm-bob409@test.com' });

      expect(res.status).toBe(409);
    });

    it('agregar con un email inválido devuelve 400', async () => {
      const ana = await registerUser('pm-ana400@test.com');
      const p = await createProject(ana.token, 'Equipo');

      const res = await request(app)
        .post(`/api/projects/${p.id}/members`)
        .set(auth(ana.token))
        .send({ email: 'no-es-email' });

      expect(res.status).toBe(400);
    });

    it('un miembro no owner no puede agregar miembros (403)', async () => {
      const ana = await registerUser('pm-ana403@test.com');
      const bob = await registerUser('pm-bob403@test.com');
      await registerUser('pm-caro403@test.com');
      const p = await createProject(ana.token, 'Equipo');
      await addMemberDb(p.id, bob.id);

      const res = await request(app)
        .post(`/api/projects/${p.id}/members`)
        .set(auth(bob.token))
        .send({ email: 'pm-caro403@test.com' });

      expect(res.status).toBe(403);
    });

    it('agregar miembros a un proyecto inexistente devuelve 404', async () => {
      const ana = await registerUser('pm-anaNF@test.com');

      const res = await request(app)
        .post('/api/projects/proj-9999/members')
        .set(auth(ana.token))
        .send({ email: 'x@test.com' });
      const malId = await request(app)
        .post('/api/projects/zzz/members')
        .set(auth(ana.token))
        .send({ email: 'x@test.com' });

      expect(res.status).toBe(404);
      expect(malId.status).toBe(404);
    });

    it('el owner quita a un miembro (204) y el miembro deja de ver el proyecto', async () => {
      const ana = await registerUser('pr-ana@test.com');
      const bob = await registerUser('pr-bob@test.com');
      const p = await createProject(ana.token, 'Equipo');
      await addMemberDb(p.id, bob.id);

      const res = await request(app).delete(`/api/projects/${p.id}/members/${bob.id}`).set(auth(ana.token));
      const lista = await request(app).get('/api/projects').set(auth(bob.token));

      expect(res.status).toBe(204);
      expect(lista.body).toEqual([]);
    });

    it('al quitar un miembro sus tareas quedan sin asignado', async () => {
      const ana = await registerUser('pr-ana2@test.com');
      const bob = await registerUser('pr-bob2@test.com');
      const p = await createProject(ana.token, 'Equipo');
      await addMemberDb(p.id, bob.id);
      const t = await createTask(ana.token, p.id, { title: 'De Bob', assigneeId: bob.id });

      await request(app).delete(`/api/projects/${p.id}/members/${bob.id}`).set(auth(ana.token));
      const tarea = await request(app).get(`/api/tasks/${t.id}`).set(auth(ana.token));

      expect(tarea.body.assigneeId).toBeNull();
    });

    it('el owner no se puede quitar a sí mismo (400)', async () => {
      const ana = await registerUser('pr-ana3@test.com');
      const p = await createProject(ana.token, 'Equipo');

      const res = await request(app).delete(`/api/projects/${p.id}/members/${ana.id}`).set(auth(ana.token));

      expect(res.status).toBe(400);
    });

    it('quitar a alguien que no es miembro devuelve 404', async () => {
      const ana = await registerUser('pr-ana4@test.com');
      const caro = await registerUser('pr-caro4@test.com');
      const p = await createProject(ana.token, 'Equipo');

      const res = await request(app).delete(`/api/projects/${p.id}/members/${caro.id}`).set(auth(ana.token));
      const malId = await request(app).delete(`/api/projects/${p.id}/members/abc`).set(auth(ana.token));
      const sinProyecto = await request(app).delete(`/api/projects/proj-9999/members/${caro.id}`).set(auth(ana.token));

      expect(res.status).toBe(404);
      expect(malId.status).toBe(404);
      expect(sinProyecto.status).toBe(404);
    });

    it('un miembro no owner no puede quitar miembros (403)', async () => {
      const ana = await registerUser('pr-ana5@test.com');
      const bob = await registerUser('pr-bob5@test.com');
      const caro = await registerUser('pr-caro5@test.com');
      const p = await createProject(ana.token, 'Equipo');
      await addMemberDb(p.id, bob.id);
      await addMemberDb(p.id, caro.id);

      const res = await request(app).delete(`/api/projects/${p.id}/members/${caro.id}`).set(auth(bob.token));

      expect(res.status).toBe(403);
    });
  });
});
