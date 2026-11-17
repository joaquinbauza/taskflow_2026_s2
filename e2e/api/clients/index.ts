import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { env } from '../../config/env';

/**
 * Clients de la API (ADR-001 §2.6). Los usan los fixtures para el Arrange,
 * así no hay dos formas distintas de llamar a la API.
 */

export function url(ruta: string): string {
  return `${env.API_URL}${ruta}`;
}

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Verifica el status exacto y devuelve el body tipado. */
export async function esperar<T>(res: APIResponse, status: number): Promise<T> {
  expect(res.status(), `${res.url()} → ${await res.text()}`).toBe(status);
  return (status === 204 ? undefined : await res.json()) as T;
}

export interface Sesion {
  token: string;
  user: { id: string; email: string; name: string | null };
}

export interface Proyecto {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  archived: boolean;
}

export interface Tarea {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
  tags?: { id: string; name: string }[];
}

abstract class ApiClient {
  constructor(
    protected readonly request: APIRequestContext,
    protected readonly token?: string,
  ) {}

  protected get headers() {
    return this.token ? bearer(this.token) : {};
  }
}

export class AuthClient extends ApiClient {
  async register(email: string, password = env.TEST_USER_PASSWORD, name?: string): Promise<Sesion> {
    const res = await this.request.post(url('/auth/register'), { data: { email, password, name } });
    return esperar<Sesion>(res, 201);
  }

  login(email: string, password = env.TEST_USER_PASSWORD) {
    return this.request.post(url('/auth/login'), { data: { email, password } });
  }
}

export class ProjectsClient extends ApiClient {
  async create(name: string, description?: string): Promise<Proyecto> {
    const res = await this.request.post(url('/projects'), { headers: this.headers, data: { name, description } });
    return esperar<Proyecto>(res, 201);
  }

  remove(projectId: string) {
    return this.request.delete(url(`/projects/${projectId}`), { headers: this.headers });
  }

  async addMember(projectId: string, email: string) {
    const res = await this.request.post(url(`/projects/${projectId}/members`), {
      headers: this.headers,
      data: { email },
    });
    return esperar<{ projectId: string; userId: string; email: string; role: string }>(res, 201);
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    const res = await this.request.delete(url(`/projects/${projectId}/members/${userId}`), { headers: this.headers });
    await esperar<void>(res, 204);
  }
}

export class TasksClient extends ApiClient {
  async create(projectId: string, data: Record<string, unknown>): Promise<Tarea> {
    const res = await this.request.post(url(`/projects/${projectId}/tasks`), { headers: this.headers, data });
    return esperar<Tarea>(res, 201);
  }

  async get(taskId: string): Promise<Tarea> {
    return esperar<Tarea>(await this.request.get(url(`/tasks/${taskId}`), { headers: this.headers }), 200);
  }

  async update(taskId: string, data: Record<string, unknown>): Promise<Tarea> {
    const res = await this.request.patch(url(`/tasks/${taskId}`), { headers: this.headers, data });
    return esperar<Tarea>(res, 200);
  }

  async addTag(taskId: string, name: string) {
    const res = await this.request.post(url(`/tasks/${taskId}/tags`), { headers: this.headers, data: { name } });
    return esperar<{ id: string; name: string }>(res, 201);
  }
}

export class CommentsClient extends ApiClient {
  async create(taskId: string, body: string) {
    const res = await this.request.post(url(`/tasks/${taskId}/comments`), { headers: this.headers, data: { body } });
    return esperar<{ id: string; body: string; authorId: string }>(res, 201);
  }

  async list(taskId: string) {
    return esperar<{ id: string; body: string }[]>(
      await this.request.get(url(`/tasks/${taskId}/comments`), { headers: this.headers }),
      200,
    );
  }
}
