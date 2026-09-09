import request from 'supertest';
import { app, auth, createProject, createTask, registerUser } from './helpers';

describe('Tareas', () => {
  it('permite al owner cambiar estado y rechaza a un miembro no asignado', async () => {
    const owner = await registerUser('status-owner@test.com');
    const member = await registerUser('status-member@test.com');
    const project = await createProject(owner.token, 'Permisos de estado');
    const invitation = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set(auth(owner.token))
      .send({ email: 'status-member@test.com' });
    expect(invitation.status).toBe(201);
    const task = await createTask(owner.token, project.id, { title: 'Sin asignar' });

    const denied = await request(app).patch(`/api/tasks/${task.id}`)
      .set(auth(member.token)).send({ status: 'IN_PROGRESS' });
    expect(denied.status).toBe(403);

    const allowed = await request(app).patch(`/api/tasks/${task.id}`)
      .set(auth(owner.token)).send({ status: 'IN_PROGRESS' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.status).toBe('IN_PROGRESS');
  });

  it('crea una tarea en un proyecto', async () => {
    const { token } = await registerUser('task1@test.com');
    const project = await createProject(token, 'Proyecto de tareas');

    const res = await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(token))
      .send({ title: 'Implementar login', priority: 'HIGH' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('TODO');
  });

  it('avanza una tarea de TODO a IN_PROGRESS', async () => {
    const { token, id } = await registerUser('task2@test.com');
    const project = await createProject(token, 'Proyecto de estados');
    const task = (
      await request(app)
        .post(`/api/projects/${project.id}/tasks`)
        .set(auth(token))
        .send({ title: 'Tarea con estados', assigneeId: id })
    ).body;

    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(token))
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('filtra las tareas por estado', async () => {
    const { token } = await registerUser('task3@test.com');
    const project = await createProject(token, 'Proyecto de filtros');
    await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(token))
      .send({ title: 'Primera tarea' });
    await request(app)
      .post(`/api/projects/${project.id}/tasks`)
      .set(auth(token))
      .send({ title: 'Segunda tarea' });

    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks?status=TODO`)
      .set(auth(token));

    expect(res.body.items).toHaveLength(2);
  });
});
