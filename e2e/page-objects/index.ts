import type { Page, Response } from '@playwright/test';
import { AppHeader, CommentItem, MemberItem, TaskCard } from '../components';

/**
 * Page Objects (ADR-001 §2.2): una clase por pantalla. Se componen de los
 * Component Objects de ../components. Los métodos que disparan una request
 * devuelven la Response, para que el test chequee el status antes de asertar.
 */

type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Espera la respuesta de la API que coincide con el método y el path (regex sobre la URL). */
export function respuestaDe(page: Page, metodo: Metodo, ruta: RegExp): Promise<Response> {
  return page.waitForResponse((res) => res.request().method() === metodo && ruta.test(new URL(res.url()).pathname));
}

abstract class BasePage {
  readonly header: AppHeader;

  constructor(readonly page: Page) {
    this.header = new AppHeader(page.getByTestId('app-header'));
  }

  get error() {
    return this.page.getByTestId('error-message');
  }
}

export class LoginPage extends BasePage {
  readonly email = this.page.getByTestId('login-email-input');
  readonly password = this.page.getByTestId('login-password-input');
  readonly name = this.page.getByTestId('login-name-input');
  readonly submit = this.page.getByTestId('login-submit');
  readonly modeToggle = this.page.getByTestId('login-mode-toggle');

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async login(email: string, password: string): Promise<Response> {
    await this.email.fill(email);
    await this.password.fill(password);
    const res = respuestaDe(this.page, 'POST', /\/api\/auth\/login$/);
    await this.submit.click();
    return res;
  }

  async register(email: string, password: string): Promise<Response> {
    await this.modeToggle.click();
    await this.email.fill(email);
    await this.password.fill(password);
    const res = respuestaDe(this.page, 'POST', /\/api\/auth\/register$/);
    await this.submit.click();
    return res;
  }
}

export class ProjectsPage extends BasePage {
  readonly nameInput = this.page.getByTestId('project-name-input');
  readonly descriptionInput = this.page.getByTestId('project-description-input');
  readonly createSubmit = this.page.getByTestId('project-create-submit');

  async goto(): Promise<void> {
    await this.page.goto('/projects');
  }

  card(name: string) {
    return this.page.getByTestId('project-card').filter({ hasText: name });
  }

  async create(name: string): Promise<Response> {
    await this.nameInput.fill(name);
    const res = respuestaDe(this.page, 'POST', /\/api\/projects$/);
    await this.createSubmit.click();
    return res;
  }

  async open(name: string): Promise<void> {
    await this.card(name).getByTestId('project-card-name').click();
  }
}

export class BoardPage extends BasePage {
  readonly projectName = this.page.getByTestId('board-project-name');
  readonly total = this.page.getByTestId('board-total');
  readonly titleInput = this.page.getByTestId('task-create-title-input');
  readonly createSubmit = this.page.getByTestId('task-create-submit');

  async goto(projectId: string): Promise<Response> {
    const res = respuestaDe(this.page, 'GET', /\/api\/projects\/[^/]+\/tasks$/);
    await this.page.goto(`/projects/${projectId}`);
    return res;
  }

  column(status: string) {
    return this.page.getByTestId(`board-column-list-${status}`);
  }

  columnCount(status: string) {
    return this.page.getByTestId(`board-column-count-${status}`);
  }

  /** BoardPage se compone de TaskCard (COM). */
  card(title: string): TaskCard {
    return new TaskCard(this.page.getByTestId('task-card').filter({ hasText: title }));
  }

  async createTask(title: string): Promise<Response> {
    await this.titleInput.fill(title);
    const res = respuestaDe(this.page, 'POST', /\/api\/projects\/[^/]+\/tasks$/);
    await this.createSubmit.click();
    return res;
  }

  async moveTask(title: string, status: 'TODO' | 'IN_PROGRESS' | 'DONE'): Promise<Response> {
    const res = respuestaDe(this.page, 'PATCH', /\/api\/tasks\/[^/]+$/);
    await this.card(title).moveTo(status);
    return res;
  }
}

export class TaskDetailPage extends BasePage {
  readonly titleInput = this.page.getByTestId('task-title-input');
  readonly descriptionInput = this.page.getByTestId('task-description-input');
  readonly prioritySelect = this.page.getByTestId('task-priority-select');
  readonly assigneeSelect = this.page.getByTestId('task-assignee-select');
  readonly dueDateInput = this.page.getByTestId('task-duedate-input');
  readonly dueDateValue = this.page.getByTestId('task-duedate-value');
  readonly saveButton = this.page.getByTestId('task-save-button');
  readonly currentStatus = this.page.getByTestId('task-current-status');
  readonly tagInput = this.page.getByTestId('tag-add-input');
  readonly tagAddButton = this.page.getByTestId('tag-add-button');
  readonly tagChips = this.page.getByTestId('tag-chip');
  readonly tagNames = this.page.getByTestId('tag-chip-name');
  readonly commentInput = this.page.getByTestId('comment-add-input');
  readonly commentAddButton = this.page.getByTestId('comment-add-button');

  /** Abre el detalle y espera el GET de la tarea; devuelve esa respuesta. */
  async goto(projectId: string, taskId: string): Promise<Response> {
    const res = respuestaDe(this.page, 'GET', /\/api\/tasks\/[^/]+$/);
    await this.page.goto(`/projects/${projectId}/tasks/${taskId}`);
    return res;
  }

  /** Recarga la página y espera el GET de la tarea (para asertar contra lo persistido). */
  async reload(): Promise<Response> {
    const res = respuestaDe(this.page, 'GET', /\/api\/tasks\/[^/]+$/);
    await this.page.reload();
    return res;
  }

  async save(): Promise<Response> {
    const res = respuestaDe(this.page, 'PATCH', /\/api\/tasks\/[^/]+$/);
    await this.saveButton.click();
    return res;
  }

  async addTag(name: string): Promise<Response> {
    await this.tagInput.fill(name);
    const res = respuestaDe(this.page, 'POST', /\/api\/tasks\/[^/]+\/tags$/);
    await this.tagAddButton.click();
    return res;
  }

  async removeTag(name: string): Promise<Response> {
    const res = respuestaDe(this.page, 'DELETE', /\/api\/tasks\/[^/]+\/tags\/[^/]+$/);
    await this.tagChips.filter({ hasText: name }).getByTestId('tag-remove-button').click();
    return res;
  }

  /** TaskDetailPage se compone de CommentItem (COM). */
  comment(text: string): CommentItem {
    return new CommentItem(this.page.getByTestId('comment-item').filter({ hasText: text }));
  }
}

export class MembersPage extends BasePage {
  readonly emailInput = this.page.getByTestId('member-email-input');
  readonly addButton = this.page.getByTestId('member-add-button');
  readonly addForm = this.page.getByTestId('member-add-form');
  readonly list = this.page.getByTestId('member-list');

  async goto(projectId: string): Promise<void> {
    await this.page.goto(`/projects/${projectId}/members`);
  }

  /** MembersPage se compone de MemberItem (COM). */
  member(email: string): MemberItem {
    return new MemberItem(this.page.getByTestId('member-item').filter({ hasText: email }));
  }

  async add(projectId: string, email: string): Promise<Response> {
    await this.emailInput.fill(email);
    const res = this.page.waitForResponse(
      (r) => r.url().endsWith(`/api/projects/${projectId}/members`) && r.request().method() === 'POST',
    );
    await this.addButton.click();
    return res;
  }
}
