/**
 * Caracterización · Smell 3 (`any` → Comment/unknown) y Smell 4 (errores de
 * serialización tragados) en comments.service.ts.
 * Se fija qué cuerpos acepta create() ahora que recibe `unknown`, la forma
 * exacta de serialize() y que un error de serialización se propaga (antes
 * del refactor devolvía null).
 */
import type { Comment } from '@prisma/client';
import request from 'supertest';
import { serialize } from '../../src/modules/comments/comments.service';
import { app, auth, createProject, createTask, registerUser } from '../helpers';
import { etiqueta, resumen } from './golden';

const CUERPOS: unknown[] = [
  { body: 'Comentario normal' },
  { body: '   recortado   ' },
  { body: 'x' },
  { body: 'a'.repeat(1000) },
  { body: 'a'.repeat(1001) },
  { body: '' },
  { body: '    ' },
  { body: 123 },
  { body: null },
  { body: ['lista'] },
  { texto: 'campo equivocado' },
  {},
  [],
];

describe('Caracterización · comentarios', () => {
  it('POST /tasks/:id/comments con distintos cuerpos', async () => {
    const { token } = await registerUser('comentarios@test.com');
    const project = await createProject(token, 'Proyecto comentarios');
    const task = await createTask(token, project.id, { title: 'Tarea comentada' });

    const resultados: Record<string, unknown> = {};
    for (const cuerpo of CUERPOS) {
      const res = await request(app).post(`/api/tasks/${task.id}/comments`).set(auth(token)).send(cuerpo as object);
      const r = resumen(res);
      if (res.status === 201) {
        const b = res.body as { body: string };
        r.body = { ...(r.body as object), body: etiqueta(b.body) };
      }
      resultados[etiqueta(cuerpo)] = r;
    }
    expect(resultados).toMatchSnapshot();
  });

  it('GET /tasks/:id/comments: forma y orden de la lista', async () => {
    const { token } = await registerUser('lista-comentarios@test.com');
    const project = await createProject(token, 'Proyecto lista');
    const task = await createTask(token, project.id, { title: 'Tarea con lista' });
    for (const body of ['primero', 'segundo', 'tercero']) {
      await request(app).post(`/api/tasks/${task.id}/comments`).set(auth(token)).send({ body });
    }
    const res = await request(app).get(`/api/tasks/${task.id}/comments`).set(auth(token));
    expect(resumen(res)).toMatchSnapshot();
  });

  it('serialize() devuelve los ids públicos y la fecha ISO', () => {
    const comment: Comment = {
      id: 7,
      taskId: 3,
      authorId: 2,
      body: 'Hola',
      createdAt: new Date('2026-09-09T15:24:19.000Z'),
    };
    expect(serialize(comment)).toEqual({
      id: 'comment-7',
      taskId: 'task-3',
      authorId: 'user-2',
      body: 'Hola',
      createdAt: '2026-09-09T15:24:19.000Z',
    });
  });

  it('serialize() propaga el error si la fila es inválida (ya no devuelve null)', () => {
    const roto = { id: 1, taskId: 1, authorId: 1, body: 'x', createdAt: 'no es una fecha' } as unknown as Comment;
    expect(() => serialize(roto)).toThrow(TypeError);
  });
});
