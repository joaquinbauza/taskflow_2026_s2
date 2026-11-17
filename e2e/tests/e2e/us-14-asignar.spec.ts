import { expect, factories, iniciarSesion, recordarMiembros, test } from '../../fixtures';
import { BoardPage, TaskDetailPage } from '../../page-objects';

/**
 * US-14 · Asignar tarea a un miembro. Arrange por API, Act y Assert por UI.
 *
 * Nota: la API no expone GET /projects/:id/members; el selector de asignado se arma con un
 * caché en localStorage (ver docs/bugs.md, Observaciones). El Arrange lo precarga con
 * recordarMiembros(), como si el owner hubiera agregado a esas personas desde la UI.
 */

test.describe('US-14 · Asignar tarea a un miembro', () => {
  test('US-14 c1 · el owner asigna la tarea a un miembro y se ve en el detalle y en el tablero', async ({
    seedProject,
    loggedInPage,
    taskDetailPage,
  }) => {
    const { project, tasks } = seedProject;
    const bob = await seedProject.addMember('bob');
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    await recordarMiembros(loggedInPage, project.id, [{ userId: bob.user.id, email: bob.user.email }]);
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    await taskDetailPage.assigneeSelect.selectOption(bob.user.id);
    const res = await taskDetailPage.save();
    expect(res.status()).toBe(200);
    expect((await res.json()).assigneeId).toBe(bob.user.id);

    expect((await taskDetailPage.reload()).status()).toBe(200);
    await expect(taskDetailPage.assigneeSelect).toHaveValue(bob.user.id);

    const board = new BoardPage(loggedInPage);
    expect((await board.goto(project.id)).status()).toBe(200);
    await expect(board.card(task.title).assignee).toHaveText(bob.user.email);
  });

  test('US-14 c1 · error: asignar a alguien que no es miembro devuelve 400 y la tarea queda sin asignar', async ({
    seedProject,
    auth,
    loggedInPage,
    taskDetailPage,
  }) => {
    const { project, tasks } = seedProject;
    // caro existe pero no es miembro: aparece en el selector por un caché viejo.
    const caro = await auth.register(factories.email('caro'));
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    await recordarMiembros(loggedInPage, project.id, [{ userId: caro.user.id, email: caro.user.email }]);
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    await taskDetailPage.assigneeSelect.selectOption(caro.user.id);
    const res = await taskDetailPage.save();
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    await expect(taskDetailPage.saveError).toBeVisible();

    expect((await taskDetailPage.reload()).status()).toBe(200);
    await expect(taskDetailPage.assigneeSelect).toHaveValue('');
  });

  test('US-14 c2 · una tarea asignada se reasigna a otro miembro', async ({
    seedProject,
    loggedInPage,
    taskDetailPage,
  }) => {
    const { project, tasks } = seedProject;
    const bob = await seedProject.addMember('bob');
    const caro = await seedProject.addMember('caro');
    const task = await tasks.create(project.id, { title: factories.tituloTarea(), assigneeId: bob.user.id });
    await recordarMiembros(loggedInPage, project.id, [
      { userId: bob.user.id, email: bob.user.email },
      { userId: caro.user.id, email: caro.user.email },
    ]);
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);
    await expect(taskDetailPage.assigneeSelect).toHaveValue(bob.user.id);

    await taskDetailPage.assigneeSelect.selectOption(caro.user.id);
    expect((await taskDetailPage.save()).status()).toBe(200);
    expect((await taskDetailPage.reload()).status()).toBe(200);
    await expect(taskDetailPage.assigneeSelect).toHaveValue(caro.user.id);
  });

  test('US-14 c3 · borde: se desasigna eligiendo "Sin asignar" (assigneeId nulo)', async ({
    seedProject,
    loggedInPage,
    taskDetailPage,
  }) => {
    const { project, tasks } = seedProject;
    const bob = await seedProject.addMember('bob');
    const task = await tasks.create(project.id, { title: factories.tituloTarea(), assigneeId: bob.user.id });
    await recordarMiembros(loggedInPage, project.id, [{ userId: bob.user.id, email: bob.user.email }]);
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    await taskDetailPage.assigneeSelect.selectOption('');
    const res = await taskDetailPage.save();
    expect(res.status()).toBe(200);
    expect((await res.json()).assigneeId).toBeNull();

    const board = new BoardPage(loggedInPage);
    expect((await board.goto(project.id)).status()).toBe(200);
    await expect(board.card(task.title).assignee).toHaveText('Sin asignar');
  });

  test('US-14 c4 · un miembro que no es owner también puede asignar tareas', async ({ seedProject, page }) => {
    const { project, tasks } = seedProject;
    const bob = await seedProject.addMember('bob');
    const caro = await seedProject.addMember('caro');
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    await iniciarSesion(page, bob);
    await recordarMiembros(page, project.id, [{ userId: caro.user.id, email: caro.user.email }]);
    const detalle = new TaskDetailPage(page);
    expect((await detalle.goto(project.id, task.id)).status()).toBe(200);

    await detalle.assigneeSelect.selectOption(caro.user.id);
    const res = await detalle.save();
    expect(res.status()).toBe(200);
    expect((await res.json()).assigneeId).toBe(caro.user.id);
    await expect(detalle.error).toHaveCount(0);
  });

  test('US-14 c5 · asignar no modifica el estado de la tarea', async ({ seedProject, loggedInPage, taskDetailPage }) => {
    const { project, tasks } = seedProject;
    const bob = await seedProject.addMember('bob');
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    await tasks.update(task.id, { status: 'IN_PROGRESS' });
    await recordarMiembros(loggedInPage, project.id, [{ userId: bob.user.id, email: bob.user.email }]);
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    await taskDetailPage.assigneeSelect.selectOption(bob.user.id);
    const res = await taskDetailPage.save();
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe('IN_PROGRESS');
    await expect(taskDetailPage.currentStatus).toHaveText('IN_PROGRESS');
  });
});
