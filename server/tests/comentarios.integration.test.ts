import request from 'supertest';
import { app, auth, createProject, createTask, registerUser } from './helpers';
import { addMemberDb } from './db-helpers';

async function tareaConMiembros(prefijo: string) {
  const ana = await registerUser(`${prefijo}-ana@test.com`);
  const bob = await registerUser(`${prefijo}-bob@test.com`);
  const p = await createProject(ana.token, 'Con comentarios');
  await addMemberDb(p.id, bob.id);
  const t = await createTask(ana.token, p.id, { title: 'Tarea comentada' });
  return { ana, bob, t };
}

const comentar = (token: string, taskId: string, body: unknown) =>
  request(app).post(`/api/tasks/${taskId}/comments`).set(auth(token)).send(body as object);

describe('Comentarios (US-08)', () => {
  it('registra al autor y la fecha', async () => {
    const { ana, t } = await tareaConMiembros('cm-autor');

    const res = await comentar(ana.token, t.id, { body: 'Revisado y aprobado' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ authorId: ana.id, taskId: t.id, body: 'Revisado y aprobado' });
    expect(res.body.createdAt).toEqual(expect.any(String));
  });

  it('rechaza comentarios vacíos o de más de 1000 caracteres (400)', async () => {
    const { ana, t } = await tareaConMiembros('cm-largo');

    const vacio = await comentar(ana.token, t.id, { body: '   ' });
    const sinBody = await comentar(ana.token, t.id, {});
    const largo = await comentar(ana.token, t.id, { body: 'x'.repeat(1001) });
    const limite = await comentar(ana.token, t.id, { body: 'x'.repeat(1000) });

    expect(vacio.status).toBe(400);
    expect(sinBody.status).toBe(400);
    expect(largo.status).toBe(400);
    expect(limite.status).toBe(201);
  });

  it('el autor puede borrar su comentario (204)', async () => {
    const { bob, t } = await tareaConMiembros('cm-borrar');
    const c = (await comentar(bob.token, t.id, { body: 'Mío' })).body;

    const res = await request(app).delete(`/api/comments/${c.id}`).set(auth(bob.token));
    const lista = await request(app).get(`/api/tasks/${t.id}/comments`).set(auth(bob.token));

    expect(res.status).toBe(204);
    expect(lista.body).toEqual([]);
  });

  it('no se puede borrar el comentario de otro usuario (403)', async () => {
    const { ana, bob, t } = await tareaConMiembros('cm-ajeno');
    const c = (await comentar(bob.token, t.id, { body: 'De Bob' })).body;

    const res = await request(app).delete(`/api/comments/${c.id}`).set(auth(ana.token));

    expect(res.status).toBe(403);
  });

  it('borrar un comentario inexistente devuelve 404', async () => {
    const { ana } = await tareaConMiembros('cm-404');

    const res = await request(app).delete('/api/comments/comment-9999').set(auth(ana.token));
    const malId = await request(app).delete('/api/comments/task-1').set(auth(ana.token));

    expect(res.status).toBe(404);
    expect(malId.status).toBe(404);
  });

  it('los comentarios se devuelven del más antiguo al más reciente', async () => {
    const { ana, t } = await tareaConMiembros('cm-orden');
    for (const body of ['Primero', 'Segundo', 'Tercero']) {
      await comentar(ana.token, t.id, { body });
      await new Promise((r) => setTimeout(r, 15));
    }

    const res = await request(app).get(`/api/tasks/${t.id}/comments`).set(auth(ana.token));

    expect(res.body.map((c: { body: string }) => c.body)).toEqual(['Primero', 'Segundo', 'Tercero']);
  });
});
