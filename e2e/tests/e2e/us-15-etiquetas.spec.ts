import { expect, factories, test } from '../../fixtures';

/**
 * US-15 · Etiquetar tareas. Arrange por API, Act y Assert por UI.
 * Los casos marcados con test.fail reproducen BUG-17 (docs/bugs.md): quedan en verde
 * mientras el bug exista y se ponen en rojo cuando se arregle.
 */

test.describe('US-15 · Etiquetar tareas', () => {
  test('US-15 c1 · el miembro agrega la etiqueta "backend" y aparece en la tarea', async ({
    seedProject,
    taskDetailPage,
  }) => {
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    const res = await taskDetailPage.addTag('backend');
    expect(res.status()).toBe(201);
    await expect(taskDetailPage.tagNames).toHaveText(['backend']);
    await expect(taskDetailPage.tagInput).toHaveValue('');
  });

  test('US-15 c1 · BUG-17: "  Backend " se guarda normalizada como "backend"', async ({
    seedProject,
    taskDetailPage,
  }) => {
    test.fail(true, 'BUG-17: las etiquetas no se pasan a minúsculas');
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    expect((await taskDetailPage.addTag('  Backend ')).status()).toBe(201);
    await expect(taskDetailPage.tagNames).toHaveText(['backend']);
  });

  test('US-15 c2 · BUG-17: "BUG" es la misma etiqueta que "bug" y no se agrega otra', async ({
    seedProject,
    taskDetailPage,
  }) => {
    test.fail(true, 'BUG-17: las etiquetas distinguen mayúsculas');
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    await tasks.addTag(task.id, 'bug');
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    await taskDetailPage.addTag('BUG');
    expect((await taskDetailPage.reload()).status()).toBe(200);
    await expect(taskDetailPage.tagNames).toHaveText(['bug']);
  });

  test('US-15 c3 · BUG-17: volver a agregar "bug" responde 200 y no la duplica', async ({
    seedProject,
    taskDetailPage,
  }) => {
    test.fail(true, 'BUG-17: la etiqueta repetida responde 201 y se duplica');
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    await tasks.addTag(task.id, 'bug');
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    const res = await taskDetailPage.addTag('bug');
    expect(res.status()).toBe(200);
    await expect(taskDetailPage.tagChips).toHaveCount(1);
  });

  test('US-15 c4 · borde: se acepta una etiqueta de 30 caracteres y se rechaza una de 31 (400)', async ({
    seedProject,
    taskDetailPage,
  }) => {
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    const treinta = 'a'.repeat(30);
    expect((await taskDetailPage.addTag(treinta)).status()).toBe(201);
    await expect(taskDetailPage.tagNames).toHaveText([treinta]);

    const res = await taskDetailPage.addTag('b'.repeat(31));
    expect(res.status()).toBe(400);
    await expect(taskDetailPage.error).toBeVisible();
    await expect(taskDetailPage.tagChips).toHaveCount(1);
  });

  test('US-15 c5 · error: con 10 etiquetas, agregar la 11.ª devuelve 400 y muestra el error', async ({
    seedProject,
    taskDetailPage,
  }) => {
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    for (let i = 1; i <= 10; i += 1) await tasks.addTag(task.id, `tag${i}`);
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);
    await expect(taskDetailPage.tagChips).toHaveCount(10);

    const res = await taskDetailPage.addTag('once');
    expect(res.status()).toBe(400);
    await expect(taskDetailPage.error).toBeVisible();
    await expect(taskDetailPage.tagChips).toHaveCount(10);
  });

  test('US-15 c6 · quitar una etiqueta la saca de la tarea (204)', async ({ seedProject, taskDetailPage }) => {
    const { project, tasks } = seedProject;
    const task = await tasks.create(project.id, { title: factories.tituloTarea() });
    await tasks.addTag(task.id, 'frontend');
    await tasks.addTag(task.id, 'urgente');
    expect((await taskDetailPage.goto(project.id, task.id)).status()).toBe(200);

    const res = await taskDetailPage.removeTag('frontend');
    expect(res.status()).toBe(204);
    await expect(taskDetailPage.tagNames).toHaveText(['urgente']);
  });
});
