import { expect, factories, test } from '../../fixtures';

/**
 * US-11 — El owner agrega un miembro por email desde la pantalla de miembros.
 *
 * Reproducía BUG-06 (docs/bugs.md): la API respondía 400 a cualquier email
 * válido. El bug está resuelto, así que corre como un test normal.
 */

test('el owner agrega un miembro por email y aparece en la lista', async ({
  seedProject,
  auth,
  membersPage,
}) => {
  const { project } = seedProject;
  const member = await auth.register(factories.email('member'));

  // Sesión del owner inyectada por el fixture (login por UI ya cubierto en login.spec).
  await membersPage.goto(project.id);
  await expect(membersPage.addForm).toBeVisible();

  const addResponse = await membersPage.add(project.id, member.user.email);
  expect(addResponse.status()).toBe(201);

  await expect(membersPage.list).toContainText(member.user.email);
  await expect(membersPage.member(member.user.email).root).toBeVisible();
  await expect(membersPage.error).toHaveCount(0);
});
