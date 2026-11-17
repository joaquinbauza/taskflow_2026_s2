import { expect, factories, iniciarSesion, test } from '../../fixtures';
import { TaskDetailPage } from '../../page-objects';

/**
 * US-12 · Editar tarea. Arrange por API (fixtures), Act y Assert por UI.
 * Antes de cada assert que depende del servidor se espera la respuesta y se chequea su status.
 */

test.describe('US-12 · Editar tarea', () => {
  test('US-12 c1 · el miembro edita título, descripción y prioridad y quedan guardados', async ({
    seedProject,
    taskDetailPage,
  }) => {
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea(), priority: 'LOW' });
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    await taskDetailPage.titleInput.fill('Implementar login con OAuth');
    await taskDetailPage.descriptionInput.fill('Usar el proveedor de la empresa');
    await taskDetailPage.prioritySelect.selectOption('CRITICAL');
    const res = await taskDetailPage.save();
    expect(res.status()).toBe(200);

    // Lo persistido: se recarga la página y se lee lo que devuelve el GET.
    expect((await taskDetailPage.reload()).status()).toBe(200);
    await expect(taskDetailPage.titleInput).toHaveValue('Implementar login con OAuth');
    await expect(taskDetailPage.descriptionInput).toHaveValue('Usar el proveedor de la empresa');
    await expect(taskDetailPage.prioritySelect).toHaveValue('CRITICAL');
    await expect(taskDetailPage.error).toHaveCount(0);
  });

  test('US-12 c2 · un título de 2 caracteres se rechaza con 400, se muestra el error y no se guarda', async ({
    seedProject,
    taskDetailPage,
  }) => {
    const { project, tasks } = seedProject;
    const original = factories.tituloTarea();
    const task = await tasks.create(project.id, { title: original });
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    await taskDetailPage.titleInput.fill('ab');
    const res = await taskDetailPage.save();
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    await expect(taskDetailPage.saveError).toBeVisible();

    expect((await taskDetailPage.reload()).status()).toBe(200);
    await expect(taskDetailPage.titleInput).toHaveValue(original);
  });

  test('US-12 c2 · borde: se aceptan títulos de exactamente 3 y 200 caracteres, y 201 se rechaza', async ({
    seedProject,
    taskDetailPage,
  }) => {
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    await taskDetailPage.titleInput.fill('abc');
    expect((await taskDetailPage.save()).status()).toBe(200);
    await expect(taskDetailPage.titleInput).toHaveValue('abc');

    const doscientos = 'x'.repeat(200);
    await taskDetailPage.titleInput.fill(doscientos);
    expect((await taskDetailPage.save()).status()).toBe(200);
    await expect(taskDetailPage.titleInput).toHaveValue(doscientos);

    await taskDetailPage.titleInput.fill('x'.repeat(201));
    expect((await taskDetailPage.save()).status()).toBe(400);
    await expect(taskDetailPage.saveError).toBeVisible();
    expect((await taskDetailPage.reload()).status()).toBe(200);
    await expect(taskDetailPage.titleInput).toHaveValue(doscientos);
  });

  test('US-12 c4 · editar no cambia el estado de la tarea', async ({ seedProject, taskDetailPage }) => {
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    await tasks.update(task.id, { status: 'IN_PROGRESS' });
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    await taskDetailPage.titleInput.fill('Título corregido');
    const res = await taskDetailPage.save();
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe('IN_PROGRESS');
    await expect(taskDetailPage.currentStatus).toHaveText('IN_PROGRESS');
  });

  test('US-12 c5 · un usuario que no es miembro no puede abrir la tarea para editarla (403)', async ({
    seedProject,
    auth,
    page,
  }) => {
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    const ajeno = await auth.register(factories.email('ajeno'));
    await iniciarSesion(page, ajeno);
    const detalle = new TaskDetailPage(page);

    const res = await detalle.goto(project.id, task.id);
    expect(res.status()).toBe(403);
    await expect(detalle.error).toBeVisible();
    await expect(detalle.titleInput).toHaveCount(0);
  });

  test('US-12 c7 · abrir para editar una tarea inexistente muestra error (404)', async ({
    seedProject,
    taskDetailPage,
  }) => {
    const res = await taskDetailPage.goto(seedProject.project.id, 'task-999999');
    expect(res.status()).toBe(404);
    await expect(taskDetailPage.error).toBeVisible();
    await expect(taskDetailPage.saveButton).toHaveCount(0);
  });
});
