/**
 * Caracterización · Smell 5 (Long Method / condicionales anidados) en
 * tasks.service.ts: la validación del asignado (parseAssigneeId) y el cambio
 * de estado (resolveStatusChange) se extrajeron de createTask/updateTask.
 * Se fija la matriz de resultados por valor de assigneeId, por actor y por
 * transición.
 */
import request from 'supertest';
import { db } from '../../src/lib/db';
import { parsePublicId } from '../../src/lib/ids';
import { app, auth, createProject, createTask, registerUser } from '../helpers';
import { etiqueta, resumen } from './golden';

const ESTADOS = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

async function escenario(prefijo: string) {
  const owner = await registerUser(`${prefijo}-owner@test.com`);
  const admin = await registerUser(`${prefijo}-admin@test.com`);
  const miembro = await registerUser(`${prefijo}-miembro@test.com`);
  const ajeno = await registerUser(`${prefijo}-ajeno@test.com`);
  const project = await createProject(owner.token, `Proyecto ${prefijo}`);
  for (const email of [`${prefijo}-admin@test.com`, `${prefijo}-miembro@test.com`]) {
    await request(app).post(`/api/projects/${project.id}/members`).set(auth(owner.token)).send({ email });
  }
  await db.projectMember.update({
    where: {
      projectId_userId: { projectId: parsePublicId(project.id, 'proj')!, userId: parsePublicId(admin.id, 'user')! },
    },
    data: { role: 'ADMIN' },
  });
  return { owner, admin, miembro, ajeno, project };
}

/** Lleva la tarea al estado pedido escribiendo directo en la base. */
async function ponerEstado(taskId: string, status: string) {
  await db.task.update({ where: { id: parsePublicId(taskId, 'task')! }, data: { status } });
}

describe('Caracterización · tareas: asignado y cambio de estado', () => {
  it('assigneeId al crear y al editar', async () => {
    const e = await escenario('asig');
    const valores: Record<string, unknown> = {
      'omitido': undefined,
      'null': null,
      'owner': e.owner.id,
      'miembro': e.miembro.id,
      'usuario no miembro': e.ajeno.id,
      'id inexistente': 'user-9999',
      'formato inválido': 'abc',
      'número': 1,
      'id de proyecto': e.project.id,
    };

    const crear: Record<string, unknown> = {};
    const editar: Record<string, unknown> = {};
    const base = await createTask(e.owner.token, e.project.id, { title: 'Tarea para editar', assigneeId: e.owner.id });
    for (const [nombre, valor] of Object.entries(valores)) {
      const body = valor === undefined ? { title: `Crear ${nombre}` } : { title: `Crear ${nombre}`, assigneeId: valor };
      const c = await request(app).post(`/api/projects/${e.project.id}/tasks`).set(auth(e.owner.token)).send(body);
      crear[nombre] = c.status === 201 ? { status: c.status, assignee: etiqueta(c.body.assigneeId) } : resumen(c);

      const u = await request(app).patch(`/api/tasks/${base.id}`).set(auth(e.owner.token))
        .send(valor === undefined ? {} : { assigneeId: valor });
      editar[nombre] = u.status === 200 ? { status: u.status, assignee: etiqueta(u.body.assigneeId) } : resumen(u);
    }
    expect({ crear, editar }).toMatchSnapshot();
  });

  it('quién puede cambiar el estado', async () => {
    const e = await escenario('actor');
    const actores = { owner: e.owner, admin: e.admin, 'miembro asignado': e.miembro, 'miembro no asignado': e.miembro, ajeno: e.ajeno };
    const resultados: Record<string, unknown> = {};
    for (const [nombre, actor] of Object.entries(actores)) {
      const assigneeId = nombre === 'miembro asignado' ? e.miembro.id : null;
      const task = await createTask(e.owner.token, e.project.id, { title: `Tarea de ${nombre}`, assigneeId });
      const res = await request(app).patch(`/api/tasks/${task.id}`).set(auth(actor.token)).send({ status: 'IN_PROGRESS' });
      const historial = await db.taskHistory.count({ where: { taskId: parsePublicId(task.id, 'task')! } });
      resultados[nombre] = { ...resumen(res), filasDeHistorial: historial };
    }
    expect(resultados).toMatchSnapshot();
  });

  it('el miembro no asignado puede "cambiar" al mismo estado y editar otros campos', async () => {
    const e = await escenario('mismo');
    const task = await createTask(e.owner.token, e.project.id, { title: 'Tarea sin asignar' });
    const mismoEstado = await request(app).patch(`/api/tasks/${task.id}`).set(auth(e.miembro.token))
      .send({ status: 'TODO', title: 'Título cambiado por el miembro' });
    const conEstadoNuevo = await request(app).patch(`/api/tasks/${task.id}`).set(auth(e.miembro.token))
      .send({ status: 'IN_PROGRESS', title: 'No debería quedar' });
    const final = await request(app).get(`/api/tasks/${task.id}`).set(auth(e.owner.token));
    expect({
      mismoEstado: resumen(mismoEstado),
      conEstadoNuevo: resumen(conEstadoNuevo),
      tituloFinal: final.body.title,
    }).toMatchSnapshot();
  });

  it('matriz de transiciones (owner)', async () => {
    const e = await escenario('trans');
    const resultados: Record<string, unknown> = {};
    for (const desde of ESTADOS) {
      for (const hacia of [...ESTADOS, 'BLOCKED', 'todo', 1]) {
        const task = await createTask(e.owner.token, e.project.id, { title: `De ${desde} a ${String(hacia)}` });
        await ponerEstado(task.id, desde);
        const res = await request(app).patch(`/api/tasks/${task.id}`).set(auth(e.owner.token)).send({ status: hacia });
        const historial = await db.taskHistory.count({ where: { taskId: parsePublicId(task.id, 'task')! } });
        resultados[`${desde} → ${etiqueta(hacia)}`] = res.status === 200
          ? { status: res.status, estado: res.body.status, filasDeHistorial: historial }
          : { ...resumen(res), filasDeHistorial: historial };
      }
    }
    expect(resultados).toMatchSnapshot();
  });
});
