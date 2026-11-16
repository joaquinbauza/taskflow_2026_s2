import { expect, test } from '@playwright/test';

test('un usuario crea un proyecto, crea una tarea y la mueve de estado', async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-${stamp}@taskflow.test`;
  const password = 'Passw0rd1';
  const projectName = `Proyecto E2E ${stamp}`;
  const taskTitle = `Tarea E2E ${stamp}`;

  await page.goto('/login');

  // Registro
  await page.getByTestId('login-mode-toggle').click();
  await page.getByTestId('login-email-input').fill(email);
  await page.getByTestId('login-password-input').fill(password);
  const registerResponse = page.waitForResponse(
    (res) => res.url().includes('/api/auth/register') && res.request().method() === 'POST',
  );
  await page.getByTestId('login-submit').click();
  expect((await registerResponse).status()).toBe(201);

  await expect(page).toHaveURL('/projects');
  await expect(page.getByTestId('header-user-email')).toHaveText(email);

  // Crear proyecto
  await page.getByTestId('project-name-input').fill(projectName);
  const createProjectResponse = page.waitForResponse(
    (res) => res.url().includes('/api/projects') && res.request().method() === 'POST',
  );
  await page.getByTestId('project-create-submit').click();
  expect((await createProjectResponse).status()).toBe(201);

  const projectCard = page.getByTestId('project-card').filter({ hasText: projectName });
  await expect(projectCard).toBeVisible();

  // Entrar al tablero del proyecto
  await projectCard.getByTestId('project-card-name').click();
  await expect(page.getByTestId('board-project-name')).toHaveText(projectName);

  // Crear tarea
  await page.getByTestId('task-create-title-input').fill(taskTitle);
  const createTaskResponse = page.waitForResponse(
    (res) => /\/api\/projects\/.+\/tasks$/.test(res.url()) && res.request().method() === 'POST',
  );
  await page.getByTestId('task-create-submit').click();
  expect((await createTaskResponse).status()).toBe(201);

  await expect(page.getByTestId('board-total')).toHaveText('Total: 1');

  const taskCard = page.getByTestId('task-card').filter({ hasText: taskTitle });
  await expect(page.getByTestId('board-column-list-TODO')).toContainText(taskTitle);
  await expect(page.getByTestId('board-column-count-TODO')).toHaveText('(1)');
  await expect(page.getByTestId('board-column-count-IN_PROGRESS')).toHaveText('(0)');

  // Mover la tarea a IN_PROGRESS
  const patchResponse = page.waitForResponse(
    (res) => /\/api\/tasks\/.+$/.test(res.url()) && res.request().method() === 'PATCH',
  );
  await taskCard.getByTestId('task-card-status-select').selectOption('IN_PROGRESS');
  expect((await patchResponse).status()).toBe(200);

  await expect(page.getByTestId('board-column-count-TODO')).toHaveText('(0)');
  await expect(page.getByTestId('board-column-count-IN_PROGRESS')).toHaveText('(1)');
  await expect(page.getByTestId('board-column-list-IN_PROGRESS')).toContainText(taskTitle);
});

test('un intento de login con credenciales inválidas muestra un error y no navega', async ({
  page,
}) => {
  await page.goto('/login');

  await page.getByTestId('login-email-input').fill('usuario-inexistente@taskflow.test');
  await page.getByTestId('login-password-input').fill('ClaveInvalida1');

  const loginResponse = page.waitForResponse(
    (res) => res.url().includes('/api/auth/login') && res.request().method() === 'POST',
  );
  await page.getByTestId('login-submit').click();
  expect((await loginResponse).status()).toBe(401);

  await expect(page).toHaveURL('/login');
  await expect(page.getByTestId('error-message')).toBeVisible();
});
