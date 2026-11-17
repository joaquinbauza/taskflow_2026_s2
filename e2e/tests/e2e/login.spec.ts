import { expect, factories, test } from '../../fixtures';

/**
 * El formulario de login se prueba por UI una sola vez, acá (ADR-001 §2.5).
 * El resto de la suite arranca con la sesión inyectada por el fixture loggedInPage.
 */

test('un intento de login con credenciales inválidas muestra un error y no navega', async ({ loginPage, page }) => {
  await loginPage.goto();

  const res = await loginPage.login('usuario-inexistente@taskflow.test', 'ClaveInvalida1');
  expect(res.status()).toBe(401);

  await expect(page).toHaveURL('/login');
  await expect(loginPage.error).toBeVisible();
});

test('un usuario registrado inicia sesión por el formulario y llega a sus proyectos', async ({
  loginPage,
  auth,
  page,
}) => {
  const email = factories.email('login');
  await auth.register(email);
  await loginPage.goto();

  const res = await loginPage.login(email, 'Passw0rd1');
  expect(res.status()).toBe(200);

  await expect(page).toHaveURL('/projects');
  await expect(loginPage.header.userEmail).toHaveText(email);
});
