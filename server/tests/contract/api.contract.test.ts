/**
 * Verificación del proveedor (la API) contra el contrato que define el
 * frontend en client/src/contracts/api.contract.ts.
 *
 * Cada interacción del contrato se ejecuta contra la API real (Express +
 * SQLite) y se compara status y forma del cuerpo. El último test verifica que
 * no haya quedado ninguna interacción del contrato sin probar.
 *
 * Los tests corren en orden y comparten estado (usuarios, proyecto, tarea...).
 */
import { knownBug } from '../knownBug';
import request, { Response } from 'supertest';
import {
  contract,
  errorContract,
  InteractionKey,
  violations,
} from '../../../client/src/contracts/api.contract';
import { db } from '../../src/lib/db';
import { parsePublicId } from '../../src/lib/ids';
import { app, auth } from '../helpers';

const verified = new Set<InteractionKey>();

function honor(key: InteractionKey, res: Response): void {
  verified.add(key);
  const expected = contract[key];
  expect({
    status: res.status,
    violations: expected.body ? violations(expected.body, res.body) : [],
  }).toEqual({ status: expected.status, violations: [] });
}

function honorError(res: Response, status: number): void {
  expect({ status: res.status, violations: violations(errorContract, res.body) }).toEqual({
    status,
    violations: [],
  });
}

const OWNER_EMAIL = 'contract-owner@test.com';
const MEMBER_EMAIL = 'contract-member@test.com';
const PASSWORD = 'Password1';

let ownerToken = '';
let ownerId = '';
let memberId = '';
let projectId = '';
let taskId = '';
let tagId = '';
let commentId = '';

describe('Contrato frontend → API', () => {
  describe('Autenticación', () => {
    it('POST /auth/register', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: OWNER_EMAIL, password: PASSWORD, name: 'Owner' });
      honor('POST /auth/register', res);
      ownerToken = res.body.token;
      ownerId = res.body.user.id;

      const member = await request(app)
        .post('/api/auth/register')
        .send({ email: MEMBER_EMAIL, password: PASSWORD });
      memberId = member.body.user.id;
    });

    it('POST /auth/login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: OWNER_EMAIL, password: PASSWORD });
      honor('POST /auth/login', res);
    });
  });

  describe('Proyectos', () => {
    it('POST /projects', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set(auth(ownerToken))
        .send({ name: 'Proyecto de contrato', description: 'Verificación del contrato' });
      honor('POST /projects', res);
      projectId = res.body.id;
    });

    it('GET /projects', async () => {
      const res = await request(app).get('/api/projects').set(auth(ownerToken));
      honor('GET /projects', res);
      expect(res.body.map((p: { id: string }) => p.id)).toContain(projectId);
    });

    // BUG-06: addMember siempre responde 400 con un email válido.
    knownBug('[BUG-06] POST /projects/:projectId/members', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set(auth(ownerToken))
        .send({ email: MEMBER_EMAIL });
      honor('POST /projects/:projectId/members', res);
    });

    it('DELETE /projects/:projectId/members/:userId', async () => {
      // Por BUG-06 no se puede dar de alta un miembro por la API: se inserta
      // directo en la base para poder verificar la baja.
      await db.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId: parsePublicId(projectId, 'proj')!,
            userId: parsePublicId(memberId, 'user')!,
          },
        },
        update: {},
        create: {
          projectId: parsePublicId(projectId, 'proj')!,
          userId: parsePublicId(memberId, 'user')!,
          role: 'MEMBER',
        },
      });
      const res = await request(app)
        .delete(`/api/projects/${projectId}/members/${memberId}`)
        .set(auth(ownerToken));
      honor('DELETE /projects/:projectId/members/:userId', res);
    });
  });

  describe('Tareas', () => {
    it('POST /projects/:projectId/tasks', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set(auth(ownerToken))
        .send({
          title: 'Tarea del contrato',
          description: 'Con todos los campos',
          priority: 'HIGH',
          assigneeId: ownerId,
          dueDate: '2026-12-01',
        });
      honor('POST /projects/:projectId/tasks', res);
      taskId = res.body.id;
    });

    it('GET /projects/:projectId/tasks', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks`)
        .set(auth(ownerToken));
      honor('GET /projects/:projectId/tasks', res);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].assignee).toEqual({ id: ownerId, email: OWNER_EMAIL });
    });

    it('GET /projects/:projectId/tasks con filtros que usa el tablero', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks`)
        .query({ priority: 'HIGH', assignedTo: ownerId, search: 'contrato' })
        .set(auth(ownerToken));
      honor('GET /projects/:projectId/tasks', res);
    });

    it('PATCH /tasks/:taskId', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set(auth(ownerToken))
        .send({ title: 'Tarea del contrato (editada)', status: 'IN_PROGRESS' });
      honor('PATCH /tasks/:taskId', res);
      expect(res.body.status).toBe('IN_PROGRESS');
    });

    it('POST /tasks/:taskId/tags', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/tags`)
        .set(auth(ownerToken))
        .send({ name: 'backend' });
      honor('POST /tasks/:taskId/tags', res);
      tagId = res.body.id;
    });

    it('GET /tasks/:taskId', async () => {
      const res = await request(app).get(`/api/tasks/${taskId}`).set(auth(ownerToken));
      honor('GET /tasks/:taskId', res);
      expect(res.body.tags).toEqual([{ id: tagId, name: 'backend' }]);
    });

    it('GET /tasks/:taskId/history', async () => {
      const res = await request(app).get(`/api/tasks/${taskId}/history`).set(auth(ownerToken));
      honor('GET /tasks/:taskId/history', res);
      expect(res.body).toHaveLength(2);
    });

    it('DELETE /tasks/:taskId/tags/:tagId', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${taskId}/tags/${tagId}`)
        .set(auth(ownerToken));
      honor('DELETE /tasks/:taskId/tags/:tagId', res);
    });
  });

  describe('Comentarios', () => {
    it('POST /tasks/:taskId/comments', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set(auth(ownerToken))
        .send({ body: 'Comentario del contrato' });
      honor('POST /tasks/:taskId/comments', res);
      commentId = res.body.id;
    });

    it('GET /tasks/:taskId/comments', async () => {
      const res = await request(app).get(`/api/tasks/${taskId}/comments`).set(auth(ownerToken));
      honor('GET /tasks/:taskId/comments', res);
      expect(res.body[0].authorId).toBe(ownerId);
    });

    it('DELETE /comments/:commentId', async () => {
      const res = await request(app).delete(`/api/comments/${commentId}`).set(auth(ownerToken));
      honor('DELETE /comments/:commentId', res);
    });

    it('DELETE /tasks/:taskId', async () => {
      const res = await request(app).delete(`/api/tasks/${taskId}`).set(auth(ownerToken));
      honor('DELETE /tasks/:taskId', res);
    });
  });

  describe('Formato de errores (lib/api.ts → ApiError)', () => {
    it('401 sin token', async () => {
      honorError(await request(app).get('/api/projects'), 401);
    });

    it('401 con credenciales inválidas', async () => {
      honorError(
        await request(app).post('/api/auth/login').send({ email: OWNER_EMAIL, password: 'Mala1234' }),
        401,
      );
    });

    it('400 por validación', async () => {
      honorError(
        await request(app)
          .post(`/api/projects/${projectId}/tasks`)
          .set(auth(ownerToken))
          .send({ title: 'Prioridad inválida', priority: 'URGENTE' }),
        400,
      );
    });

    it('404 por recurso inexistente', async () => {
      honorError(await request(app).get('/api/tasks/task-999999').set(auth(ownerToken)), 404);
    });

    it('409 por conflicto', async () => {
      honorError(
        await request(app).post('/api/auth/register').send({ email: OWNER_EMAIL, password: PASSWORD }),
        409,
      );
    });

    it('422 por transición inválida', async () => {
      const task = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set(auth(ownerToken))
        .send({ title: 'Para terminar' });
      for (const status of ['IN_PROGRESS', 'DONE']) {
        await request(app).patch(`/api/tasks/${task.body.id}`).set(auth(ownerToken)).send({ status });
      }
      honorError(
        await request(app)
          .patch(`/api/tasks/${task.body.id}`)
          .set(auth(ownerToken))
          .send({ status: 'TODO' }),
        422,
      );
    });
  });

  it('todas las interacciones del contrato fueron verificadas', () => {
    const missing = (Object.keys(contract) as InteractionKey[]).filter((k) => !verified.has(k));
    expect(missing).toEqual([]);
  });
});
