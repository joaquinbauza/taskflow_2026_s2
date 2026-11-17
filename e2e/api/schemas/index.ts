import { expect } from '@playwright/test';

/** Forma esperada de las respuestas que usan los tests (ADR-001 §2.6). Se usan con toMatchObject. */
export const schemas = {
  user: { id: expect.stringMatching(/^user-\d+$/), email: expect.any(String) },
  project: {
    id: expect.stringMatching(/^proj-\d+$/),
    name: expect.any(String),
    archived: expect.any(Boolean),
  },
  task: {
    id: expect.stringMatching(/^task-\d+$/),
    projectId: expect.stringMatching(/^proj-\d+$/),
    title: expect.any(String),
    status: expect.stringMatching(/^(TODO|IN_PROGRESS|DONE)$/),
    priority: expect.stringMatching(/^(LOW|MEDIUM|HIGH|CRITICAL)$/),
  },
  error: (code: string) => ({ error: expect.objectContaining({ code, message: expect.any(String) }) }),
};
