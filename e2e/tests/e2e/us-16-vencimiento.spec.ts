import { expect, factories, iniciarSesion, test } from '../../fixtures';
import { BoardPage, TaskDetailPage } from '../../page-objects';

/**
 * US-16 · Fecha de vencimiento. Arrange por API, Act y Assert por UI.
 * Navegador y servidor corren en America/Montevideo (playwright.config.ts): ahí aparece
 * BUG-03 (la fecha vuelve un día antes). Esos casos corren como test.fail.
 *
 * c6 (formato inválido → 400) no se puede ejercitar desde la UI: el <input type="date">
 * nativo no deja escribir "15/09/2026" ni "2026-02-30" (los sanea a vacío). Está cubierto
 * a nivel API/unitario (BUG-04, server/tests/unit/ids.test.ts).
 */

test.describe('US-16 · Fecha de vencimiento', () => {
  test('US-16 c3 · BUG-03: la fecha cargada (2026-09-15) se muestra igual en UTC-3', async ({
    seedProject,
    taskDetailPage,
  }) => {
    test.fail(true, 'BUG-03: en UTC-3 la fecha vuelve un día antes (2026-09-14)');
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    await taskDetailPage.dueDateInput.fill('2026-09-15');
    const res = await taskDetailPage.save();
    expect(res.status()).toBe(200);
    expect((await taskDetailPage.reload()).status()).toBe(200);
    await expect(taskDetailPage.dueDateValue).toHaveText('2026-09-15');
  });

  test('US-16 c2 · BUG-03: el tablero muestra la fecha en formato ISO igual a la cargada', async ({
    seedProject,
    boardPage,
  }) => {
    test.fail(true, 'BUG-03: en UTC-3 la tarjeta muestra 2026-09-14');
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea(), dueDate: '2026-09-15' });

    expect((await boardPage.goto(project.id)).status()).toBe(200);
    await expect(boardPage.card(task.title).dueDate).toHaveText('2026-09-15');
  });

  test('US-16 c4 · una tarea sin vencimiento se muestra sin fecha', async ({ seedProject, taskDetailPage }) => {
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    await expect(taskDetailPage.dueDateValue).toHaveText('—');
    await expect(taskDetailPage.dueDateInput).toHaveValue('');
  });

  test('US-16 c5 · borde: vaciar el campo quita la fecha (dueDate nulo)', async ({
    seedProject,
    loggedInPage,
    taskDetailPage,
  }) => {
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea(), dueDate: '2026-09-15' });
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    await taskDetailPage.dueDateInput.fill('');
    const res = await taskDetailPage.save();
    expect(res.status()).toBe(200);
    expect((await res.json()).dueDate).toBeNull();
    await expect(taskDetailPage.dueDateValue).toHaveText('—');

    const board = new BoardPage(loggedInPage);
    expect((await board.goto(project.id)).status()).toBe(200);
    await expect(board.card(task.title).dueDate).toHaveText('—');
  });

  test('US-16 c7 · borde: se acepta una fecha pasada (200) y no se muestra error', async ({
    seedProject,
    taskDetailPage,
  }) => {
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    await taskDetailPage.dueDateInput.fill('2020-01-01');
    const res = await taskDetailPage.save();
    expect(res.status()).toBe(200);
    expect((await res.json()).dueDate).not.toBeNull();
    await expect(taskDetailPage.error).toHaveCount(0);
  });

  test('US-16 c7 · BUG-03: la fecha pasada se devuelve igual a la cargada', async ({ seedProject, taskDetailPage }) => {
    test.fail(true, 'BUG-03: 2020-01-01 vuelve como 2019-12-31 en UTC-3');
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    await taskDetailPage.dueDateInput.fill('2020-01-01');
    const res = await taskDetailPage.save();
    expect(res.status()).toBe(200);
    expect((await res.json()).dueDate).toBe('2020-01-01');
    await expect(taskDetailPage.dueDateValue).toHaveText('2020-01-01');
  });

  test('US-16 c8 · error: un ex-miembro no puede cambiar la fecha (403) y la fecha no cambia', async ({
    seedProject,
    page,
  }) => {
    const { project, tasks, projects } = seedProject;
    const bob = await seedProject.addMember('bob');
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    await iniciarSesion(page, bob);
    const detalle = new TaskDetailPage(page);
    expect((await detalle.goto(project.id, task.id)).status()).toBe(200);

    // Mientras bob tiene la pantalla abierta, el owner lo quita del proyecto.
    await projects.removeMember(project.id, bob.user.id);

    await detalle.dueDateInput.fill('2026-12-24');
    const res = await detalle.save();
    expect(res.status()).toBe(403);
    await expect(detalle.error).toBeVisible();
    expect((await tasks.get(task.id)).dueDate).toBeNull();
  });
});
