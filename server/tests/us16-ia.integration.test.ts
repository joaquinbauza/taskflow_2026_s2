import request from 'supertest';
import { app, auth, createProject, createTask, registerUser, addMember } from './helpers';
import { knownBug } from './knownBug';

// Clasificación (docs/clase12-ej2-ia.md): los rojos por bug real pasan a knownBug y los
// alucinados a it.skip. BUG-03 solo se reproduce al oeste de UTC (America/Montevideo).
const knownBugEnZonaNegativa = new Date().getTimezoneOffset() > 0 ? knownBug : it;

let seq = 0;
const email = (p: string) => `${p}-${Date.now()}-${++seq}@test.com`;

async function setup() {
  const owner = await registerUser(email('owner'));
  const project = await createProject(owner.token, `Proyecto US16 ${seq}`);
  const task = await createTask(owner.token, project.id, { title: 'Tarea con vencimiento' });
  return { owner, project, task };
}

describe('US-16 · Fecha de vencimiento de tarea', () => {
  // ---------- Prompt 2a ----------

  it('US-16 c1 · la fecha se devuelve sin componente de hora', async () => {
    const { owner, task } = await setup();
    const res = await request(app).patch(`/api/tasks/${task.id}`).set(auth(owner.token)).send({ dueDate: '2026-09-15' });
    expect(res.status).toBe(200);
    expect(res.body.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // Rojo por bug real: BUG-03 (la fecha vuelve un día antes en UTC-3).
  knownBugEnZonaNegativa('US-16 c2 · se envía y se devuelve en formato ISO 8601 (2026-09-15)', async () => {
    const { owner, task } = await setup();
    await request(app).patch(`/api/tasks/${task.id}`).set(auth(owner.token)).send({ dueDate: '2026-09-15' });
    const res = await request(app).get(`/api/tasks/${task.id}`).set(auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBe('2026-09-15');
  });

  // Rojo por bug real: BUG-03 (la fecha vuelve un día antes en UTC-3).
  knownBugEnZonaNegativa('US-16 c3 · la fecha devuelta es la misma que se cargó con el servidor en UTC-3', async () => {
    const { owner, task } = await setup();
    const patch = await request(app).patch(`/api/tasks/${task.id}`).set(auth(owner.token)).send({ dueDate: '2026-01-01' });
    expect(patch.body.dueDate).toBe('2026-01-01');
  });

  // Rojo por bug real: BUG-03 (la fecha vuelve un día antes en UTC-3).
  knownBugEnZonaNegativa('US-16 c3 · al crear la tarea con dueDate se devuelve la misma fecha', async () => {
    const owner = await registerUser(email('owner'));
    const project = await createProject(owner.token, `Proyecto crear ${seq}`);
    const task = await createTask(owner.token, project.id, { title: 'Con fecha', dueDate: '2026-12-31' });
    expect(task.dueDate).toBe('2026-12-31');
  });

  it('US-16 c4 · una tarea creada sin vencimiento tiene dueDate null', async () => {
    const { owner, task } = await setup();
    const res = await request(app).get(`/api/tasks/${task.id}`).set(auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBeNull();
  });

  it('US-16 c5 · enviar dueDate null quita la fecha', async () => {
    const { owner, task } = await setup();
    await request(app).patch(`/api/tasks/${task.id}`).set(auth(owner.token)).send({ dueDate: '2026-09-15' });
    const res = await request(app).patch(`/api/tasks/${task.id}`).set(auth(owner.token)).send({ dueDate: null });
    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBeNull();
  });

  it('US-16 c6 · formato dd/mm/aaaa devuelve 400', async () => {
    const { owner, task } = await setup();
    const res = await request(app).patch(`/api/tasks/${task.id}`).set(auth(owner.token)).send({ dueDate: '15/09/2026' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // Rojo por bug real: BUG-04 (se aceptan fechas inexistentes).
  knownBug('US-16 c6 · una fecha inexistente (2026-02-30) devuelve 400', async () => {
    const { owner, task } = await setup();
    const res = await request(app).patch(`/api/tasks/${task.id}`).set(auth(owner.token)).send({ dueDate: '2026-02-30' });
    expect(res.status).toBe(400);
  });

  it('US-16 c6 · una fecha con hora (ISO datetime) devuelve 400', async () => {
    const { owner, task } = await setup();
    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(owner.token))
      .send({ dueDate: '2026-09-15T10:00:00Z' });
    expect(res.status).toBe(400);
  });

  it('US-16 c6 · un número en lugar de string devuelve 400', async () => {
    const { owner, task } = await setup();
    const res = await request(app).patch(`/api/tasks/${task.id}`).set(auth(owner.token)).send({ dueDate: 20260915 });
    expect(res.status).toBe(400);
  });

  // Alucinado: el campo `overdue` no existe en la API ni en la especificación (la spec dice
  // que la tarea "se considera vencida" pero no define cómo se expone). Se deja sin correr.
  it.skip('US-16 c7 · se acepta una fecha pasada y la tarea queda vencida', async () => {
    const { owner, task } = await setup();
    const res = await request(app).patch(`/api/tasks/${task.id}`).set(auth(owner.token)).send({ dueDate: '2020-01-01' });
    expect(res.status).toBe(200);
    expect(res.body.overdue).toBe(true);
  });

  it('US-16 c8 · un usuario que no es miembro recibe 403 al cambiar la fecha', async () => {
    const { task } = await setup();
    const outsider = await registerUser(email('outsider'));
    const res = await request(app).patch(`/api/tasks/${task.id}`).set(auth(outsider.token)).send({ dueDate: '2026-09-15' });
    expect(res.status).toBe(403);
  });

  it('US-16 c8 · un miembro del proyecto puede cambiar la fecha', async () => {
    const { owner, project, task } = await setup();
    const memberEmail = email('member');
    const member = await registerUser(memberEmail);
    await addMember(owner.token, project.id, memberEmail);
    const res = await request(app).patch(`/api/tasks/${task.id}`).set(auth(member.token)).send({ dueDate: '2026-10-01' });
    expect(res.status).toBe(200);
  });

  it('US-16 · sin token devuelve 401', async () => {
    const { task } = await setup();
    const res = await request(app).patch(`/api/tasks/${task.id}`).send({ dueDate: '2026-09-15' });
    expect(res.status).toBe(401);
  });

  // ---------- Prompt 2b (revisión encadenada) ----------

  // Rojo por bug real: BUG-03 (la fecha vuelve un día antes en UTC-3).
  knownBugEnZonaNegativa('US-16 c7 · una fecha pasada se acepta (200) y se devuelve igual', async () => {
    const { owner, task } = await setup();
    const res = await request(app).patch(`/api/tasks/${task.id}`).set(auth(owner.token)).send({ dueDate: '2020-01-01' });
    expect(res.status).toBe(200);
    const get = await request(app).get(`/api/tasks/${task.id}`).set(auth(owner.token));
    expect(get.body.dueDate).toBe('2020-01-01');
  });

  it('US-16 c5 · después de quitar la fecha, el GET devuelve null (persistido)', async () => {
    const { owner, task } = await setup();
    await request(app).patch(`/api/tasks/${task.id}`).set(auth(owner.token)).send({ dueDate: '2026-09-15' });
    await request(app).patch(`/api/tasks/${task.id}`).set(auth(owner.token)).send({ dueDate: null });
    const get = await request(app).get(`/api/tasks/${task.id}`).set(auth(owner.token));
    expect(get.status).toBe(200);
    expect(get.body.dueDate).toBeNull();
  });

  it('US-16 c6 · un string vacío devuelve 400', async () => {
    const { owner, task } = await setup();
    const res = await request(app).patch(`/api/tasks/${task.id}`).set(auth(owner.token)).send({ dueDate: '' });
    expect(res.status).toBe(400);
  });

  it('US-16 c6 · un mes inexistente (2026-13-01) devuelve 400', async () => {
    const { owner, task } = await setup();
    const res = await request(app).patch(`/api/tasks/${task.id}`).set(auth(owner.token)).send({ dueDate: '2026-13-01' });
    expect(res.status).toBe(400);
  });

  it('US-16 c4 · editar otro campo sin mandar dueDate conserva la fecha', async () => {
    const { owner, task } = await setup();
    const first = await request(app).patch(`/api/tasks/${task.id}`).set(auth(owner.token)).send({ dueDate: '2026-09-15' });
    const res = await request(app).patch(`/api/tasks/${task.id}`).set(auth(owner.token)).send({ title: 'Otro título' });
    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBe(first.body.dueDate);
  });

  it('US-16 c8 · el no-miembro no altera la fecha (el owner la sigue viendo null)', async () => {
    const { owner, task } = await setup();
    const outsider = await registerUser(email('outsider'));
    await request(app).patch(`/api/tasks/${task.id}`).set(auth(outsider.token)).send({ dueDate: '2026-09-15' });
    const get = await request(app).get(`/api/tasks/${task.id}`).set(auth(owner.token));
    expect(get.body.dueDate).toBeNull();
  });

  it('US-16 c8 · un ex-miembro recibe 403 al cambiar la fecha', async () => {
    const { owner, project, task } = await setup();
    const memberEmail = email('ex');
    const member = await registerUser(memberEmail);
    await addMember(owner.token, project.id, memberEmail);
    await request(app).delete(`/api/projects/${project.id}/members/${member.id}`).set(auth(owner.token));
    const res = await request(app).patch(`/api/tasks/${task.id}`).set(auth(member.token)).send({ dueDate: '2026-09-15' });
    expect(res.status).toBe(403);
  });
});
