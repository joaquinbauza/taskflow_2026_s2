/**
 * Tests de integración que reproducen los bugs reportados en docs/bugs.md.
 * Cada test describe el comportamiento que pide la especificación; ver
 * tests/knownBug.ts para cómo se ejecutan.
 */
import request from 'supertest';
import { db } from '../src/lib/db';
import { parsePublicId } from '../src/lib/ids';
import { app, auth, createProject, createTask, registerUser } from './helpers';
import { knownBug } from './knownBug';

/** Alta de miembro directo en la base: por BUG-06 no se puede hacer por la API. */
async function addMemberDirect(projectId: string, userId: string): Promise<void> {
  await db.projectMember.create({
    data: {
      projectId: parsePublicId(projectId, 'proj')!,
      userId: parsePublicId(userId, 'user')!,
      role: 'MEMBER',
    },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('BUG-05 · Los filtros del listado no se combinan (US-07)', () => {
  knownBug('status=TODO&priority=HIGH devuelve solo las TODO de prioridad HIGH', async () => {
    const { token } = await registerUser('bug05@test.com');
    const project = await createProject(token, 'Filtros combinados');
    for (let i = 0; i < 3; i++) await createTask(token, project.id, { title: `Alta ${i}`, priority: 'HIGH' });
    for (let i = 0; i < 4; i++) await createTask(token, project.id, { title: `Baja ${i}`, priority: 'LOW' });

    const done = await createTask(token, project.id, { title: 'Alta pero DONE', priority: 'HIGH' });
    await request(app).patch(`/api/tasks/${done.id}`).set(auth(token)).send({ status: 'IN_PROGRESS' });
    await request(app).patch(`/api/tasks/${done.id}`).set(auth(token)).send({ status: 'DONE' });

    const combined = await request(app)
      .get(`/api/projects/${project.id}/tasks?status=TODO&priority=HIGH`)
      .set(auth(token));
    expect(combined.body.items.map((t: { title: string }) => t.title).sort()).toEqual([
      'Alta 0',
      'Alta 1',
      'Alta 2',
    ]);
  });
});

describe('BUG-07 · PATCH y DELETE de tareas no verifican membresía (US-12, US-13)', () => {
  let ownerToken: string;
  let outsiderToken: string;
  let taskId: string;

  beforeAll(async () => {
    ownerToken = (await registerUser('bug07-owner@test.com')).token;
    outsiderToken = (await registerUser('bug07-outsider@test.com')).token;
    const project = await createProject(ownerToken, 'Proyecto privado');
    taskId = (await createTask(ownerToken, project.id, { title: 'Título original' })).id;
  });

  knownBug('un usuario ajeno no puede editar la tarea (403) y el título no cambia', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set(auth(outsiderToken))
      .send({ title: 'Cambiado' });
    const after = await request(app).get(`/api/tasks/${taskId}`).set(auth(ownerToken));
    expect({ status: res.status, title: after.body.title }).toEqual({
      status: 403,
      title: 'Título original',
    });
  });

  knownBug('un usuario ajeno no puede eliminar la tarea (403) y la tarea sigue existiendo', async () => {
    const res = await request(app).delete(`/api/tasks/${taskId}`).set(auth(outsiderToken));
    const after = await request(app).get(`/api/tasks/${taskId}`).set(auth(ownerToken));
    expect({ status: res.status, stillExists: after.status === 200 }).toEqual({
      status: 403,
      stillExists: true,
    });
  });
});

describe('BUG-08 · Quitar un miembro no libera sus tareas y el ex-miembro sigue operando (US-11)', () => {
  let ownerToken: string;
  let exToken: string;
  let taskId: string;

  beforeAll(async () => {
    const owner = await registerUser('bug08-owner@test.com');
    const ex = await registerUser('bug08-member@test.com');
    ownerToken = owner.token;
    exToken = ex.token;
    const project = await createProject(ownerToken, 'Proyecto con baja');
    await addMemberDirect(project.id, ex.id);
    taskId = (await createTask(ownerToken, project.id, { title: 'Asignada a Bob', assigneeId: ex.id })).id;

    const removed = await request(app)
      .delete(`/api/projects/${project.id}/members/${ex.id}`)
      .set(auth(ownerToken));
    expect(removed.status).toBe(204);
  });

  knownBug('la tarea del miembro quitado queda sin asignado', async () => {
    const res = await request(app).get(`/api/tasks/${taskId}`).set(auth(ownerToken));
    expect(res.body.assigneeId).toBeNull();
  });

  knownBug('el ex-miembro no puede cambiar el estado de la tarea (403)', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set(auth(exToken))
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(403);
  });
});

describe('BUG-09 · Inyección SQL en la búsqueda de tareas (US-07, Seguridad 1)', () => {
  knownBug('el texto de búsqueda se trata como dato y no expone tareas de otros proyectos', async () => {
    const victim = await registerUser('bug09-victim@test.com');
    const victimProject = await createProject(victim.token, 'Proyecto confidencial');
    await createTask(victim.token, victimProject.id, { title: 'Plan secreto de la víctima' });

    const attacker = await registerUser('bug09-attacker@test.com');
    const ownProject = await createProject(attacker.token, 'Proyecto del atacante');

    const res = await request(app)
      .get(`/api/projects/${ownProject.id}/tasks`)
      .query({ search: "') > 0) OR 1=1 --" })
      .set(auth(attacker.token));

    expect({
      status: res.status,
      titles: (res.body.items ?? []).map((t: { title: string }) => t.title),
    }).toEqual({ status: 200, titles: [] });
  });
});

describe('BUG-10 · La búsqueda distingue mayúsculas de minúsculas (US-07)', () => {
  knownBug('search=login encuentra "Implementar Login"', async () => {
    const { token } = await registerUser('bug10@test.com');
    const project = await createProject(token, 'Búsqueda');
    await createTask(token, project.id, { title: 'Implementar Login' });
    await createTask(token, project.id, { title: 'Revisar diseño' });

    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks?search=login`)
      .set(auth(token));
    expect(res.body.items.map((t: { title: string }) => t.title)).toEqual(['Implementar Login']);
  });
});

describe('BUG-11 · El listado de tareas no pagina (US-07, Rendimiento 1)', () => {
  let token: string;
  let projectId: string;

  beforeAll(async () => {
    token = (await registerUser('bug11@test.com')).token;
    projectId = (await createProject(token, 'Paginación')).id;
    for (let i = 1; i <= 25; i++) await createTask(token, projectId, { title: `Tarea ${i}` });
  });

  knownBug('sin parámetros devuelve 20 tareas y total 25', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/tasks`).set(auth(token));
    expect({ items: res.body.items.length, total: res.body.total }).toEqual({ items: 20, total: 25 });
  });

  knownBug('limit=5&offset=20 devuelve las tareas 21 a 25', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks?limit=5&offset=20`)
      .set(auth(token));
    expect(res.body.items.map((t: { title: string }) => t.title)).toEqual([
      'Tarea 21',
      'Tarea 22',
      'Tarea 23',
      'Tarea 24',
      'Tarea 25',
    ]);
  });
});

describe('BUG-12 · Al crear una tarea se aceptan campos que no se deberían (US-05)', () => {
  knownBug('el estado inicial es TODO aunque la solicitud mande status DONE', async () => {
    const { token } = await registerUser('bug12@test.com');
    const project = await createProject(token, 'Estado forzado');
    const res = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(token))
      .send({ title: 'Nueva tarea', status: 'DONE' });
    expect({ status: res.status, taskStatus: res.body.status }).toEqual({
      status: 201,
      taskStatus: 'TODO',
    });
  });
});

describe('BUG-13 · Los comentarios vienen del más nuevo al más viejo (US-08)', () => {
  knownBug('se devuelven en orden cronológico ascendente', async () => {
    const { token } = await registerUser('bug13@test.com');
    const project = await createProject(token, 'Comentarios');
    const task = await createTask(token, project.id, { title: 'Con comentarios' });
    for (const body of ['primero', 'segundo', 'tercero']) {
      await request(app).post(`/api/tasks/${task.id}/comments`).set(auth(token)).send({ body });
      await sleep(5);
    }
    const res = await request(app).get(`/api/tasks/${task.id}/comments`).set(auth(token));
    expect(res.body.map((c: { body: string }) => c.body)).toEqual(['primero', 'segundo', 'tercero']);
  });
});

describe('BUG-14 · forgot-password revela si el email existe (US-17, Seguridad 3)', () => {
  knownBug('responde 200 con el mismo cuerpo exista o no la cuenta', async () => {
    await registerUser('bug14@test.com');
    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'bug14@test.com' });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nadie@test.com' });
    expect({ status: unknown.status, body: unknown.body }).toEqual({
      status: known.status,
      body: known.body,
    });
    expect(known.status).toBe(200);
  });
});

describe('BUG-15 · reset-password acepta tokens usados, invalidados o vencidos (US-17)', () => {
  async function requestToken(email: string): Promise<string> {
    const res = await request(app).post('/api/auth/forgot-password').send({ email });
    return res.body.token;
  }

  knownBug('un token ya utilizado no se puede reutilizar (400)', async () => {
    await registerUser('bug15a@test.com');
    const token = await requestToken('bug15a@test.com');
    const first = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'NuevaClave1' });
    expect(first.status).toBe(200);
    const second = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'OtraClave2' });
    expect(second.status).toBe(400);
  });

  knownBug('un token generado hace 61 minutos no sirve (400)', async () => {
    await registerUser('bug15b@test.com');
    const token = await requestToken('bug15b@test.com');
    await db.passwordResetToken.update({
      where: { token },
      data: { expiresAt: new Date(Date.now() - 60 * 1000) },
    });
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'NuevaClave1' });
    expect(res.status).toBe(400);
  });

  knownBug('al pedir un token nuevo, el anterior queda invalidado (400)', async () => {
    await registerUser('bug15c@test.com');
    const oldToken = await requestToken('bug15c@test.com');
    await requestToken('bug15c@test.com');
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: oldToken, newPassword: 'NuevaClave1' });
    expect(res.status).toBe(400);
  });
});

describe('BUG-16 · El contador de intentos fallidos no se reinicia tras un login exitoso (US-02)', () => {
  knownBug('3 fallos + login ok + 3 fallos no bloquean la cuenta', async () => {
    await registerUser('bug16@test.com');
    const login = (password: string) =>
      request(app).post('/api/auth/login').send({ email: 'bug16@test.com', password });

    for (let i = 0; i < 3; i++) await login('Incorrecta1');
    expect((await login('Password1')).status).toBe(200);
    for (let i = 0; i < 3; i++) await login('Incorrecta1');

    expect((await login('Password1')).status).toBe(200);
  });
});

describe('BUG-17 · Las etiquetas no se normalizan y se duplican (US-15)', () => {
  let token: string;
  let taskId: string;

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    token = (await registerUser(`bug17-${stamp}@test.com`)).token;
    const project = await createProject(token, `Etiquetas ${stamp}`);
    taskId = (await createTask(token, project.id, { title: 'Con etiquetas' })).id;
  });

  const addTag = (name: string) =>
    request(app).post(`/api/tasks/${taskId}/tags`).set(auth(token)).send({ name });
  const tagNames = async () =>
    (await request(app).get(`/api/tasks/${taskId}`).set(auth(token))).body.tags.map(
      (t: { name: string }) => t.name,
    );

  knownBug('se guardan en minúsculas y sin espacios', async () => {
    await addTag('  Backend ');
    expect(await tagNames()).toEqual(['backend']);
  });

  knownBug('agregar la misma etiqueta dos veces responde 200 y no la duplica', async () => {
    await addTag('bug');
    const again = await addTag('bug');
    expect({ status: again.status, tags: await tagNames() }).toEqual({ status: 200, tags: ['bug'] });
  });

  knownBug('"BUG" y "bug" son la misma etiqueta', async () => {
    await addTag('bug');
    await addTag('BUG');
    expect(await tagNames()).toEqual(['bug']);
  });
});

describe('BUG-19 · Un miembro ve los proyectos archivados (US-04)', () => {
  knownBug('un proyecto archivado no aparece aunque el usuario sea miembro', async () => {
    const owner = await registerUser('bug19-owner@test.com');
    const member = await registerUser('bug19-member@test.com');
    const project = await createProject(owner.token, 'Proyecto archivado');
    await addMemberDirect(project.id, member.id);
    await db.project.update({ where: { id: parsePublicId(project.id, 'proj')! }, data: { archived: true } });

    const res = await request(app).get('/api/projects').set(auth(member.token));
    expect(res.body.map((p: { id: string }) => p.id)).not.toContain(project.id);
  });
});

describe('BUG-20 · Eliminar un proyecto deja comentarios e historial huérfanos (US-10)', () => {
  knownBug('no queda ningún comentario ni historial de las tareas del proyecto', async () => {
    const { token, id } = await registerUser('bug20@test.com');
    const project = await createProject(token, 'Proyecto a borrar');
    const task = await createTask(token, project.id, { title: 'Con datos asociados', assigneeId: id });
    for (const body of ['uno', 'dos']) {
      await request(app).post(`/api/tasks/${task.id}/comments`).set(auth(token)).send({ body });
    }
    await request(app).patch(`/api/tasks/${task.id}`).set(auth(token)).send({ status: 'IN_PROGRESS' });

    const res = await request(app).delete(`/api/projects/${project.id}`).set(auth(token));
    expect(res.status).toBe(204);

    const taskDbId = parsePublicId(task.id, 'task')!;
    expect({
      comments: await db.comment.count({ where: { taskId: taskDbId } }),
      history: await db.taskHistory.count({ where: { taskId: taskDbId } }),
    }).toEqual({ comments: 0, history: 0 });
  });
});
