import type { Locator } from '@playwright/test';

/**
 * Component Objects (ADR-001 §2.3). Cada uno recibe un Locator raíz y busca
 * sus elementos ADENTRO por data-testid, así sirve para cualquier instancia.
 */

export class TaskCard {
  constructor(readonly root: Locator) {}

  get title() {
    return this.root.getByTestId('task-card-title');
  }
  get priority() {
    return this.root.getByTestId('task-card-priority');
  }
  get assignee() {
    return this.root.getByTestId('task-card-assignee');
  }
  get dueDate() {
    return this.root.getByTestId('task-card-duedate');
  }
  get commentCount() {
    return this.root.getByTestId('task-card-comment-count');
  }
  get statusSelect() {
    return this.root.getByTestId('task-card-status-select');
  }

  async moveTo(status: 'TODO' | 'IN_PROGRESS' | 'DONE'): Promise<void> {
    await this.statusSelect.selectOption(status);
  }

  async open(): Promise<void> {
    await this.title.click();
  }
}

export class CommentItem {
  constructor(readonly root: Locator) {}

  get body() {
    return this.root.getByTestId('comment-item-body');
  }
  get author() {
    return this.root.getByTestId('comment-item-author');
  }
  get date() {
    return this.root.getByTestId('comment-item-date');
  }
  get deleteButton() {
    return this.root.getByTestId('comment-delete-button');
  }
}

export class MemberItem {
  constructor(readonly root: Locator) {}

  get email() {
    return this.root.getByTestId('member-item-email');
  }
  get role() {
    return this.root.getByTestId('member-item-role');
  }
  get removeButton() {
    return this.root.getByTestId('member-remove-button');
  }
}

export class AppHeader {
  constructor(readonly root: Locator) {}

  get userEmail() {
    return this.root.getByTestId('header-user-email');
  }
  get homeLink() {
    return this.root.getByTestId('header-home-link');
  }
  get logoutButton() {
    return this.root.getByTestId('logout-button');
  }
}
