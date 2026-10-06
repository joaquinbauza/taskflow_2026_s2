import request from 'supertest';
import { app, auth, createProject, createTask, registerUser } from './helpers';
import { addMemberDb, db, num, setTaskStatusDb } from './db-helpers';

async function proyectoConOwner(email: string, nombre = 'Proyecto') {
  const owner = await registerUser(email);
  const p = await createProject(owner.token, nombre);
  return { owner, p };
}

describe('Tareas (US-05, US-06, US-07, US-12, US-13, US-14, US-15, US-16)', () => {
  describe('crear', () => {
    it('rechaza una prioridad inválida y menciona los valores válidos (400)', async () => {
      const { owner, p } = await proyectoConOwner('tc-prio@test.com');

      const res = await request(app)
        .post(`/api/projects/${p.id}/tasks`)
        .set(auth(owner.token))
        .send({ title: 'Tarea', priority: 'URGENTE' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('LOW, MEDIUM, HIGH, CRITICAL');
    });

    it('rechaza un título de menos de 3 caracteres (400)', async () => {
      const { owner, p } = await proyectoConOwner('tc-titulo@test.com');

      const res = await request(app).post(`/api/projects/${p.id}/tasks`).set(auth(owner.token)).send({ title: 'ab' });
      const sinTitulo = await request(app).post(`/api/projects/${p.id}/tasks`).set(auth(owner.token)).send({});

      expect(res.status).toBe(400);
      expect(sinTitulo.status).toBe(400);
    });

    it('rechaza una fecha de vencimiento con formato inválido (400)', async () => {
      const { owner, p } = await proyectoConOwner('tc-fecha@test.com');

      const res = await request(app)
        .post(`/api/projects/${p.id}/tasks`)
        .set(auth(owner.token))
        .send({ title: 'Tarea', dueDate: '15/09/2026' });

      expect(res.status).toBe(400);
    });

    it('rechaza asignar a alguien que no es miembro (400)', async () => {
      const { owner, p } = await proyectoConOwner('tc-asig@test.com');
      const caro = await registerUser('tc-asig-caro@test.com');

      const res = await request(app)
        .post(`/api/projects/${p.id}/tasks`)
        .set(auth(owner.token))
        .send({ title: 'Tarea', assigneeId: caro.id });
      const idInvalido = await request(app)
        .post(`/api/projects/${p.id}/tasks`)
        .set(auth(owner.token))
        .send({ title: 'Tarea', assigneeId: 'proj-1' });

      expect(res.status).toBe(400);
      expect(idInvalido.status).toBe(400);
    });

    it('crea con fecha, asignado y prioridad', async () => {
      const { owner, p } = await proyectoConOwner('tc-ok@test.com');

      const res = await request(app)
        .post(`/api/projects/${p.id}/tasks`)
        .set(auth(owner.token))
        .send({ title: 'Completa', priority: 'CRITICAL', assigneeId: owner.id });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: 'Completa',
        priority: 'CRITICAL',
        assigneeId: owner.id,
        status: 'TODO',
      });
    });

    it('el estado inicial es TODO aunque la solicitud mande otro estado', async () => {
      const { owner, p } = await proyectoConOwner('tc-estado@test.com');

      const res = await request(app)
        .post(`/api/projects/${p.id}/tasks`)
        .set(auth(owner.token))
        .send({ title: 'Nueva tarea', status: 'DONE' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('TODO');
    });
  });

  describe('cambiar estado', () => {
    it('no permite ir de TODO directamente a DONE (422)', async () => {
      const { owner, p } = await proyectoConOwner('ts-todo-done@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Tarea', assigneeId: owner.id });

      const res = await request(app).patch(`/api/tasks/${t.id}`).set(auth(owner.token)).send({ status: 'DONE' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });

    it('no permite reabrir una tarea DONE (422)', async () => {
      const { owner, p } = await proyectoConOwner('ts-reabrir@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Tarea', assigneeId: owner.id });
      await setTaskStatusDb(t.id, 'DONE');

      const res = await request(app).patch(`/api/tasks/${t.id}`).set(auth(owner.token)).send({ status: 'TODO' });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain('DONE');
    });

    it('rechaza un estado que no existe (400)', async () => {
      const { owner, p } = await proyectoConOwner('ts-invalido@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Tarea' });

      const res = await request(app).patch(`/api/tasks/${t.id}`).set(auth(owner.token)).send({ status: 'ARCHIVED' });

      expect(res.status).toBe(400);
    });

    it('IN_PROGRESS → TODO es válida', async () => {
      const { owner, p } = await proyectoConOwner('ts-volver@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Tarea', assigneeId: owner.id });
      await setTaskStatusDb(t.id, 'IN_PROGRESS');

      const res = await request(app).patch(`/api/tasks/${t.id}`).set(auth(owner.token)).send({ status: 'TODO' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('TODO');
    });

    it('cada cambio de estado queda en el historial con autor y fecha', async () => {
      const { owner, p } = await proyectoConOwner('ts-historial@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Tarea', assigneeId: owner.id });

      await request(app).patch(`/api/tasks/${t.id}`).set(auth(owner.token)).send({ status: 'IN_PROGRESS' });
      await request(app).patch(`/api/tasks/${t.id}`).set(auth(owner.token)).send({ status: 'DONE' });
      const res = await request(app).get(`/api/tasks/${t.id}/history`).set(auth(owner.token));

      expect(res.status).toBe(200);
      const cambios = res.body.filter((h: { fromStatus: string | null }) => h.fromStatus !== null);
      expect(cambios).toHaveLength(2);
      expect(cambios[0]).toMatchObject({ fromStatus: 'TODO', toStatus: 'IN_PROGRESS', changedBy: owner.id });
      expect(cambios[1]).toMatchObject({ fromStatus: 'IN_PROGRESS', toStatus: 'DONE' });
      expect(cambios[0].changedAt).toEqual(expect.any(String));
    });

    it('mandar el mismo estado que ya tiene no genera historial nuevo', async () => {
      const { owner, p } = await proyectoConOwner('ts-mismo@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Tarea' });

      const res = await request(app).patch(`/api/tasks/${t.id}`).set(auth(owner.token)).send({ status: 'TODO' });
      const hist = await request(app).get(`/api/tasks/${t.id}/history`).set(auth(owner.token));

      expect(res.status).toBe(200);
      expect(hist.body).toHaveLength(1);
    });

    it('un ex-miembro no puede cambiar el estado aunque siga asignado (403)', async () => {
      const { owner: ana, p } = await proyectoConOwner('ts-ex-ana@test.com');
      const bob = await registerUser('ts-ex-bob@test.com');
      await addMemberDb(p.id, bob.id);
      const t = await createTask(ana.token, p.id, { title: 'De Bob', assigneeId: bob.id });
      await db.projectMember.deleteMany({ where: { projectId: num(p.id), userId: num(bob.id) } });

      const res = await request(app).patch(`/api/tasks/${t.id}`).set(auth(bob.token)).send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(403);
    });
  });

  describe('editar y asignar', () => {
    it('edita título, descripción y prioridad', async () => {
      const { owner, p } = await proyectoConOwner('te-ok@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Implementar login' });

      const res = await request(app).patch(`/api/tasks/${t.id}`).set(auth(owner.token)).send({
        title: 'Implementar login con OAuth',
        description: 'Con Google',
        priority: 'HIGH',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        title: 'Implementar login con OAuth',
        description: 'Con Google',
        priority: 'HIGH',
      });
    });

    it('un body vacío no cambia nada', async () => {
      const { owner, p } = await proyectoConOwner('te-vacio@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Igual' });

      const res = await request(app).patch(`/api/tasks/${t.id}`).set(auth(owner.token)).send({});

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Igual');
    });

    it('rechaza prioridad o fecha inválidas al editar (400)', async () => {
      const { owner, p } = await proyectoConOwner('te-400@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Tarea' });

      const prio = await request(app).patch(`/api/tasks/${t.id}`).set(auth(owner.token)).send({ priority: 'URGENTE' });
      const fecha = await request(app).patch(`/api/tasks/${t.id}`).set(auth(owner.token)).send({ dueDate: '15/09/2026' });

      expect(prio.status).toBe(400);
      expect(fecha.status).toBe(400);
    });

    it('permite quitar la fecha de vencimiento enviando null', async () => {
      const { owner, p } = await proyectoConOwner('te-null@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Tarea', dueDate: '2026-09-15' });

      const res = await request(app).patch(`/api/tasks/${t.id}`).set(auth(owner.token)).send({ dueDate: null });

      expect(res.status).toBe(200);
      expect(res.body.dueDate).toBeNull();
    });

    it('editar una tarea inexistente devuelve 404', async () => {
      const u = await registerUser('te-404@test.com');

      const res = await request(app).patch('/api/tasks/task-9999').set(auth(u.token)).send({ title: 'Nada' });
      const malId = await request(app).patch('/api/tasks/abc').set(auth(u.token)).send({ title: 'Nada' });

      expect(res.status).toBe(404);
      expect(malId.status).toBe(404);
    });

    it('un usuario ajeno al proyecto no puede editar la tarea (403)', async () => {
      const { owner, p } = await proyectoConOwner('te-ajeno-owner@test.com');
      const caro = await registerUser('te-ajeno-caro@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Original' });

      const res = await request(app).patch(`/api/tasks/${t.id}`).set(auth(caro.token)).send({ title: 'Cambiado' });
      const despues = await request(app).get(`/api/tasks/${t.id}`).set(auth(owner.token));

      expect(res.status).toBe(403);
      expect(despues.body.title).toBe('Original');
    });

    it('cualquier miembro puede asignar y desasignar, sin cambiar el estado', async () => {
      const { owner: ana, p } = await proyectoConOwner('ta-ana@test.com');
      const bob = await registerUser('ta-bob@test.com');
      await addMemberDb(p.id, bob.id);
      const t = await createTask(ana.token, p.id, { title: 'Tarea' });

      const asignar = await request(app).patch(`/api/tasks/${t.id}`).set(auth(bob.token)).send({ assigneeId: bob.id });
      const desasignar = await request(app).patch(`/api/tasks/${t.id}`).set(auth(bob.token)).send({ assigneeId: null });

      expect(asignar.status).toBe(200);
      expect(asignar.body).toMatchObject({ assigneeId: bob.id, status: 'TODO' });
      expect(desasignar.body.assigneeId).toBeNull();
    });

    it('un miembro que no es asignado ni owner no puede cambiar el estado (403)', async () => {
      const { owner: ana, p } = await proyectoConOwner('ta-perm-ana@test.com');
      const bob = await registerUser('ta-perm-bob@test.com');
      await addMemberDb(p.id, bob.id);
      const t = await createTask(ana.token, p.id, { title: 'Tarea', assigneeId: ana.id });

      const res = await request(app).patch(`/api/tasks/${t.id}`).set(auth(bob.token)).send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(403);
    });

    it('un admin del proyecto (no asignado) sí puede cambiar el estado', async () => {
      const { owner: ana, p } = await proyectoConOwner('ta-admin-ana@test.com');
      const bob = await registerUser('ta-admin-bob@test.com');
      await addMemberDb(p.id, bob.id, 'ADMIN');
      const t = await createTask(ana.token, p.id, { title: 'Tarea' });

      const res = await request(app).patch(`/api/tasks/${t.id}`).set(auth(bob.token)).send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);
    });

    it('la fecha devuelta es la misma que se cargó, sin importar la zona horaria', async () => {
      const tzOriginal = process.env.TZ;
      process.env.TZ = 'America/Montevideo';
      try {
        const { owner, p } = await proyectoConOwner('te-tz@test.com');
        const t = await createTask(owner.token, p.id, { title: 'Tarea' });

        await request(app).patch(`/api/tasks/${t.id}`).set(auth(owner.token)).send({ dueDate: '2026-09-15' });
        const res = await request(app).get(`/api/tasks/${t.id}`).set(auth(owner.token));

        expect(res.body.dueDate).toBe('2026-09-15');
      } finally {
        process.env.TZ = tzOriginal;
      }
    });
  });

  describe('eliminar', () => {
    it('un miembro elimina la tarea (204) y se van sus comentarios', async () => {
      const { owner, p } = await proyectoConOwner('td-ok@test.com');
      const t = await createTask(owner.token, p.id, { title: 'A borrar' });
      await request(app).post(`/api/tasks/${t.id}/comments`).set(auth(owner.token)).send({ body: 'Uno' });

      const res = await request(app).delete(`/api/tasks/${t.id}`).set(auth(owner.token));
      const lista = await request(app).get(`/api/projects/${p.id}/tasks`).set(auth(owner.token));

      expect(res.status).toBe(204);
      expect(lista.body.items).toEqual([]);
      expect(await db.comment.count({ where: { taskId: num(t.id) } })).toBe(0);
    });

    it('eliminar una tarea inexistente devuelve 404', async () => {
      const u = await registerUser('td-404@test.com');

      const res = await request(app).delete('/api/tasks/task-9999').set(auth(u.token));
      const malId = await request(app).delete('/api/tasks/zzz').set(auth(u.token));

      expect(res.status).toBe(404);
      expect(malId.status).toBe(404);
    });

    it('un usuario ajeno al proyecto no puede eliminar la tarea (403)', async () => {
      const { owner, p } = await proyectoConOwner('td-ajeno-owner@test.com');
      const caro = await registerUser('td-ajeno-caro@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Sigue viva' });

      const res = await request(app).delete(`/api/tasks/${t.id}`).set(auth(caro.token));
      const despues = await request(app).get(`/api/tasks/${t.id}`).set(auth(owner.token));

      expect(res.status).toBe(403);
      expect(despues.status).toBe(200);
    });
  });

  describe('filtrar y buscar', () => {
    async function proyectoConTareas(email: string) {
      const { owner, p } = await proyectoConOwner(email);
      await createTask(owner.token, p.id, { title: 'Implementar Login', priority: 'HIGH', assigneeId: owner.id });
      await createTask(owner.token, p.id, { title: 'Revisar diseño', priority: 'LOW' });
      await createTask(owner.token, p.id, { title: 'Tests de login', priority: 'LOW', description: 'unitarios' });
      return { owner, p };
    }

    it('filtra por prioridad', async () => {
      const { owner, p } = await proyectoConTareas('tf-prio@test.com');

      const res = await request(app).get(`/api/projects/${p.id}/tasks?priority=LOW`).set(auth(owner.token));

      expect(res.body.items).toHaveLength(2);
      expect(res.body.items.every((t: { priority: string }) => t.priority === 'LOW')).toBe(true);
    });

    it('filtra por asignado e incluye el email del asignado', async () => {
      const { owner, p } = await proyectoConTareas('tf-asig@test.com');

      const res = await request(app)
        .get(`/api/projects/${p.id}/tasks?assignedTo=${owner.id}`)
        .set(auth(owner.token));

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].assignee).toEqual({ id: owner.id, email: 'tf-asig@test.com' });
    });

    it('busca por texto en la descripción', async () => {
      const { owner, p } = await proyectoConTareas('tf-desc@test.com');

      const res = await request(app).get(`/api/projects/${p.id}/tasks?search=unitarios`).set(auth(owner.token));

      expect(res.body.items.map((t: { title: string }) => t.title)).toEqual(['Tests de login']);
    });

    it('sin resultados devuelve un array vacío', async () => {
      const { owner, p } = await proyectoConTareas('tf-vacio@test.com');

      const res = await request(app).get(`/api/projects/${p.id}/tasks?status=DONE`).set(auth(owner.token));

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    });

    it('la búsqueda no distingue mayúsculas de minúsculas', async () => {
      const { owner, p } = await proyectoConTareas('tf-mayus@test.com');

      const res = await request(app).get(`/api/projects/${p.id}/tasks?search=login`).set(auth(owner.token));

      expect(res.body.items.map((t: { title: string }) => t.title).sort()).toEqual(['Implementar Login', 'Tests de login']);
    });

    it('los filtros se combinan entre sí', async () => {
      const { owner, p } = await proyectoConTareas('tf-combo@test.com');
      await createTask(owner.token, p.id, { title: 'Alta pero hecha', priority: 'HIGH', assigneeId: owner.id });
      const alta = (await request(app).get(`/api/projects/${p.id}/tasks?priority=HIGH`).set(auth(owner.token))).body.items;
      await setTaskStatusDb(alta[1].id, 'DONE');

      const res = await request(app)
        .get(`/api/projects/${p.id}/tasks?status=TODO&priority=HIGH`)
        .set(auth(owner.token));

      expect(res.body.items.map((t: { title: string }) => t.title)).toEqual(['Implementar Login']);
    });

    it('la búsqueda trata el texto como dato (comillas no rompen la consulta)', async () => {
      const { owner, p } = await proyectoConTareas('tf-sql@test.com');

      const res = await request(app)
        .get(`/api/projects/${p.id}/tasks`)
        .query({ search: "' OR 1=1 OR '" })
        .set(auth(owner.token));

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    });

    it('el listado viene paginado: 20 por defecto y total con todas', async () => {
      const { owner, p } = await proyectoConOwner('tf-pag@test.com');
      await db.task.createMany({
        data: Array.from({ length: 25 }, (_, i) => ({ projectId: num(p.id), title: `Tarea ${i + 1}` })),
      });

      const res = await request(app).get(`/api/projects/${p.id}/tasks`).set(auth(owner.token));

      expect(res.body.items).toHaveLength(20);
      expect(res.body.total).toBe(25);
    });
  });

  describe('etiquetas', () => {
    it('agrega una etiqueta (201) y aparece en el detalle', async () => {
      const { owner, p } = await proyectoConOwner('tg-ok@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Tarea' });

      const res = await request(app).post(`/api/tasks/${t.id}/tags`).set(auth(owner.token)).send({ name: 'backend' });
      const detalle = await request(app).get(`/api/tasks/${t.id}`).set(auth(owner.token));

      expect(res.status).toBe(201);
      expect(detalle.body.tags.map((x: { name: string }) => x.name)).toEqual(['backend']);
    });

    it('rechaza nombres vacíos o de más de 30 caracteres (400)', async () => {
      const { owner, p } = await proyectoConOwner('tg-400@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Tarea' });

      const vacio = await request(app).post(`/api/tasks/${t.id}/tags`).set(auth(owner.token)).send({ name: '  ' });
      const largo = await request(app).post(`/api/tasks/${t.id}/tags`).set(auth(owner.token)).send({ name: 'x'.repeat(31) });

      expect(vacio.status).toBe(400);
      expect(largo.status).toBe(400);
    });

    it('no admite más de 10 etiquetas (400)', async () => {
      const { owner, p } = await proyectoConOwner('tg-max@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Tarea' });
      for (let i = 1; i <= 10; i++) {
        await request(app).post(`/api/tasks/${t.id}/tags`).set(auth(owner.token)).send({ name: `tag${i}` });
      }

      const res = await request(app).post(`/api/tasks/${t.id}/tags`).set(auth(owner.token)).send({ name: 'tag11' });

      expect(res.status).toBe(400);
    });

    it('quita una etiqueta (204) y quitar una que no tiene devuelve 404', async () => {
      const { owner, p } = await proyectoConOwner('tg-del@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Tarea' });
      const tag = (await request(app).post(`/api/tasks/${t.id}/tags`).set(auth(owner.token)).send({ name: 'quitar' })).body;

      const res = await request(app).delete(`/api/tasks/${t.id}/tags/${tag.id}`).set(auth(owner.token));
      const otraVez = await request(app).delete(`/api/tasks/${t.id}/tags/${tag.id}`).set(auth(owner.token));
      const malId = await request(app).delete(`/api/tasks/${t.id}/tags/abc`).set(auth(owner.token));

      expect(res.status).toBe(204);
      expect(otraVez.status).toBe(404);
      expect(malId.status).toBe(404);
    });

    it('agregar la misma etiqueta dos veces no la duplica (200)', async () => {
      const { owner, p } = await proyectoConOwner('tg-dup@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Tarea' });
      await request(app).post(`/api/tasks/${t.id}/tags`).set(auth(owner.token)).send({ name: 'bug' });

      const res = await request(app).post(`/api/tasks/${t.id}/tags`).set(auth(owner.token)).send({ name: 'bug' });
      const detalle = await request(app).get(`/api/tasks/${t.id}`).set(auth(owner.token));

      expect(res.status).toBe(200);
      expect(detalle.body.tags).toHaveLength(1);
    });

    it('las etiquetas se normalizan a minúsculas', async () => {
      const { owner, p } = await proyectoConOwner('tg-mayus@test.com');
      const t = await createTask(owner.token, p.id, { title: 'Tarea' });

      const res = await request(app).post(`/api/tasks/${t.id}/tags`).set(auth(owner.token)).send({ name: '  BUG ' });

      expect(res.body.name).toBe('bug');
    });
  });
});
