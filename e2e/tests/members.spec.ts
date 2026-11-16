import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * US-11 — El owner agrega un miembro por email desde la pantalla de miembros.
 *
 * Hoy falla por BUG-06 (docs/bugs.md): la API responde 400 a cualquier email
 * válido. Se marca como falla esperada; con SHOW_BUGS=1 corre como un test
 * normal y muestra el error real.
 */

async function registerViaApi(request: APIRequestContext, email: string) {
  const res = await request.post('/api/auth/register', {
    data: { email, password: 'Passw0rd1' },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { token: string; user: { id: string; email: string } };
}

test('el owner agrega un miembro por email y aparece en la lista', async ({ page, request }) => {
  test.fail(!process.env.SHOW_BUGS, 'BUG-06: POST /projects/:id/members responde 400 con emails válidos');

  const stamp = Date.now();
  const owner = await registerViaApi(request, `e2e-owner-${stamp}@taskflow.test`);
  const member = await registerViaApi(request, `e2e-member-${stamp}@taskflow.test`);

  const projectRes = await request.post('/api/projects', {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { name: `Proyecto miembros ${stamp}` },
  });
  expect(projectRes.status()).toBe(201);
  const project = (await projectRes.json()) as { id: string };

  // Sesión del owner sin pasar por el formulario de login (ya cubierto en golden-path).
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('taskflow_token', token);
      localStorage.setItem('taskflow_user', JSON.stringify(user));
    },
    { token: owner.token, user: owner.user },
  );

  await page.goto(`/projects/${project.id}/members`);
  await expect(page.getByTestId('member-add-form')).toBeVisible();

  await page.getByTestId('member-email-input').fill(member.user.email);
  const addResponse = page.waitForResponse(
    (res) => res.url().endsWith(`/api/projects/${project.id}/members`) && res.request().method() === 'POST',
  );
  await page.getByTestId('member-add-button').click();
  expect((await addResponse).status()).toBe(201);

  await expect(page.getByTestId('member-list')).toContainText(member.user.email);
  await expect(page.getByTestId('error-message')).toHaveCount(0);
});
