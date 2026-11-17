import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  AuthClient,
  CommentsClient,
  ProjectsClient,
  TasksClient,
  type Proyecto,
  type Sesion,
} from '../api/clients';
import { BoardPage, LoginPage, MembersPage, ProjectsPage, TaskDetailPage } from '../page-objects';
import { factories } from '../test-data/factories';

/**
 * Fixtures (ADR-001 §2.4 y §2.5): el estado previo lo arma el framework por API.
 *
 * - apiContext:   APIRequestContext propio del test (contra API_URL).
 * - owner:        usuario nuevo registrado por API (la base E2E arranca vacía, sin seed).
 * - seedProject:  proyecto del owner creado por API; se BORRA al terminar el test.
 * - loggedInPage: page con la sesión del owner inyectada en localStorage
 *                 (taskflow_token y taskflow_user, ver client/src/lib/api.ts).
 * - Page Objects listos para usar (los autenticados se apoyan en loggedInPage).
 */

export interface SeedProject {
  project: Proyecto;
  owner: Sesion;
  tasks: TasksClient;
  comments: CommentsClient;
  projects: ProjectsClient;
  /** Registra un usuario nuevo y lo agrega como miembro del proyecto. */
  addMember: (rol?: string) => Promise<Sesion>;
}

interface Fixtures {
  apiContext: APIRequestContext;
  auth: AuthClient;
  owner: Sesion;
  seedProject: SeedProject;
  loggedInPage: Page;
  loginPage: LoginPage;
  projectsPage: ProjectsPage;
  boardPage: BoardPage;
  taskDetailPage: TaskDetailPage;
  membersPage: MembersPage;
}

/** Inyecta una sesión en localStorage antes de que cargue la app. */
export async function iniciarSesion(page: Page, sesion: Sesion): Promise<void> {
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('taskflow_token', token);
      localStorage.setItem('taskflow_user', JSON.stringify(user));
    },
    { token: sesion.token, user: sesion.user },
  );
}

/**
 * La API no tiene GET /projects/:id/members: el front arma la lista de miembros con
 * un caché en localStorage (client/src/lib/members.ts). Esto precarga ese caché, como
 * si el usuario hubiera agregado a esas personas desde la pantalla Miembros.
 */
export async function recordarMiembros(
  page: Page,
  projectId: string,
  miembros: { userId: string; email: string; role?: string }[],
): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    {
      key: `taskflow_members_${projectId}`,
      value: JSON.stringify(miembros.map((m) => ({ role: 'MEMBER', ...m }))),
    },
  );
}

export const test = base.extend<Fixtures>({
  apiContext: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext();
    await use(ctx);
    await ctx.dispose();
  },

  auth: async ({ apiContext }, use) => {
    await use(new AuthClient(apiContext));
  },

  owner: async ({ auth }, use) => {
    await use(await auth.register(factories.email('owner')));
  },

  seedProject: async ({ apiContext, auth, owner }, use) => {
    const projects = new ProjectsClient(apiContext, owner.token);
    const project = await projects.create(factories.nombreProyecto());
    await use({
      project,
      owner,
      projects,
      tasks: new TasksClient(apiContext, owner.token),
      comments: new CommentsClient(apiContext, owner.token),
      addMember: async (rol = 'member') => {
        const sesion = await auth.register(factories.email(rol));
        await projects.addMember(project.id, sesion.user.email);
        return sesion;
      },
    });
    // Teardown: el proyecto (y sus tareas, por cascada) se borra al terminar el test.
    const res = await projects.remove(project.id);
    expect([204, 404]).toContain(res.status());
  },

  loggedInPage: async ({ page, owner }, use) => {
    await iniciarSesion(page, owner);
    await use(page);
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  projectsPage: async ({ loggedInPage }, use) => {
    await use(new ProjectsPage(loggedInPage));
  },
  boardPage: async ({ loggedInPage }, use) => {
    await use(new BoardPage(loggedInPage));
  },
  taskDetailPage: async ({ loggedInPage }, use) => {
    await use(new TaskDetailPage(loggedInPage));
  },
  membersPage: async ({ loggedInPage }, use) => {
    await use(new MembersPage(loggedInPage));
  },
});

export { expect };
export { factories } from '../test-data/factories';
export { respuestaDe } from '../page-objects';
