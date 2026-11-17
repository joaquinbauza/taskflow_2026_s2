import { expect, factories, test } from '../../fixtures';
import { BoardPage, ProjectsPage } from '../../page-objects';

test('un usuario crea un proyecto, crea una tarea y la mueve de estado', async ({ page, loginPage }) => {
  const email = factories.email('golden');
  const password = 'Passw0rd1';
  const projectName = factories.nombreProyecto();
  const taskTitle = factories.tituloTarea();
  const projectsPage = new ProjectsPage(page);
  const boardPage = new BoardPage(page);

  await loginPage.goto();

  // Registro (es parte del flujo de punta a punta: se hace por UI)
  const registerResponse = await loginPage.register(email, password);
  expect(registerResponse.status()).toBe(201);

  await expect(page).toHaveURL('/projects');
  await expect(projectsPage.header.userEmail).toHaveText(email);

  // Crear proyecto
  const createProjectResponse = await projectsPage.create(projectName);
  expect(createProjectResponse.status()).toBe(201);

  await expect(projectsPage.card(projectName)).toBeVisible();

  // Entrar al tablero del proyecto
  await projectsPage.open(projectName);
  await expect(boardPage.projectName).toHaveText(projectName);

  // Crear tarea
  const createTaskResponse = await boardPage.createTask(taskTitle);
  expect(createTaskResponse.status()).toBe(201);

  await expect(boardPage.total).toHaveText('Total: 1');

  await expect(boardPage.column('TODO')).toContainText(taskTitle);
  await expect(boardPage.columnCount('TODO')).toHaveText('(1)');
  await expect(boardPage.columnCount('IN_PROGRESS')).toHaveText('(0)');

  // Mover la tarea a IN_PROGRESS
  const patchResponse = await boardPage.moveTask(taskTitle, 'IN_PROGRESS');
  expect(patchResponse.status()).toBe(200);

  await expect(boardPage.columnCount('TODO')).toHaveText('(0)');
  await expect(boardPage.columnCount('IN_PROGRESS')).toHaveText('(1)');
  await expect(boardPage.column('IN_PROGRESS')).toContainText(taskTitle);
});
