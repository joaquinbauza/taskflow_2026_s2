import path from 'path';
import { MatchersV3, PactV3 } from '@pact-foundation/pact';

const { like, eachLike, regex } = MatchersV3;

// Lo que hace el frontend (client/src/lib/api.ts → api<T>(ruta)).
// Se copia acá porque api.ts usa localStorage y una URL relativa: no corre en Node.
async function llamar(baseUrl: string, ruta: string, init: { method?: string; token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${baseUrl}/api${ruta}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  // El cuerpo se tipa laxo a propósito: lo que se verifica es la forma declarada en el contrato.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, body: (await res.json()) as any };
}

const pact = new PactV3({
  consumer: 'TaskFlowWeb',
  provider: 'TaskFlowAPI',
  dir: path.resolve(process.cwd(), 'pacts'),
});

describe('Contrato: lista de proyectos', () => {
  it('devuelve los proyectos del usuario', async () => {
    pact
      .given('ana tiene un proyecto')
      .uponReceiving('un GET a /api/projects')
      .withRequest({
        method: 'GET',
        path: '/api/projects',
        headers: { Authorization: like('Bearer abc') },
      })
      .willRespondWith({
        status: 200,
        // Solo los campos que usa ProjectsPage.tsx
        body: eachLike({
          id: like('proj-1'),
          name: like('Rediseño del sitio'),
          description: like('Renovación completa del sitio'),
          archived: like(false),
        }),
      });

    await pact.executeTest(async (mockServer) => {
      const { status, body } = await llamar(mockServer.url, '/projects', { token: 'token-de-prueba' });
      expect(status).toBe(200);
      expect(body.length).toBeGreaterThan(0);
      expect(body[0]).toHaveProperty('name');
    });
  });

  it('rechaza la request si no hay token', async () => {
    pact
      .uponReceiving('un GET a /api/projects sin token')
      .withRequest({ method: 'GET', path: '/api/projects' })
      .willRespondWith({
        status: 401,
        body: { error: { code: 'UNAUTHORIZED', message: like('Authentication required') } },
      });

    await pact.executeTest(async (mockServer) => {
      const { status, body } = await llamar(mockServer.url, '/projects');
      expect(status).toBe(401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  it('rechaza crear un proyecto con nombre de más de 100 caracteres', async () => {
    const nombreLargo = 'x'.repeat(101);
    pact
      .given('ana tiene una sesión válida')
      .uponReceiving('un POST a /api/projects con nombre de 101 caracteres')
      .withRequest({
        method: 'POST',
        path: '/api/projects',
        headers: { Authorization: like('Bearer abc'), 'Content-Type': 'application/json' },
        body: { name: nombreLargo },
      })
      .willRespondWith({
        status: 400,
        body: { error: { code: 'VALIDATION_ERROR', message: like('Project name must be at most 100 characters') } },
      });

    await pact.executeTest(async (mockServer) => {
      const { status, body } = await llamar(mockServer.url, '/projects', {
        method: 'POST',
        token: 'token-de-prueba',
        body: { name: nombreLargo },
      });
      expect(status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

// Ejercicio 3 · contrato de login (client/src/lib/auth.tsx → AuthResponse { user, token })
describe('Contrato: login', () => {
  it('devuelve token y usuario con credenciales válidas', async () => {
    pact
      .given('existe ana@test.com con contraseña Password1')
      .uponReceiving('un POST a /api/auth/login con credenciales válidas')
      .withRequest({
        method: 'POST',
        path: '/api/auth/login',
        headers: { 'Content-Type': 'application/json' },
        body: { email: 'ana@test.com', password: 'Password1' },
      })
      .willRespondWith({
        status: 200,
        // auth.tsx guarda token y user; App.tsx muestra user.email; MembersPage y
        // TaskDetailPage comparan user.id. El tipo User declara name (string | null).
        body: {
          token: like('eyJhbGciOiJIUzI1NiJ9.e30.firma'),
          user: {
            id: like('user-1'),
            email: like('ana@test.com'),
            name: like('Ana'),
          },
        },
      });

    await pact.executeTest(async (mockServer) => {
      const { status, body } = await llamar(mockServer.url, '/auth/login', {
        method: 'POST',
        body: { email: 'ana@test.com', password: 'Password1' },
      });
      expect(status).toBe(200);
      expect(typeof body.token).toBe('string');
      expect(body.user).toHaveProperty('id');
      expect(body.user).toHaveProperty('email');
    });
  });
});

// Ejercicio 3 · contrato de comentarios (TaskDetailPage.tsx → api<Comment[]>(`/tasks/${taskId}/comments`))
describe('Contrato: comentarios de una tarea', () => {
  it('devuelve los comentarios de la tarea', async () => {
    pact
      .given('la tarea task-1 tiene comentarios')
      .uponReceiving('un GET a /api/tasks/task-1/comments')
      .withRequest({
        method: 'GET',
        path: '/api/tasks/task-1/comments',
        headers: { Authorization: like('Bearer abc') },
      })
      .willRespondWith({
        status: 200,
        // TaskDetailPage usa id (key y borrar), body, authorId (autor y botón Borrar)
        // y createdAt (fecha). taskId está en el tipo Comment de client/src/types.ts.
        body: eachLike({
          id: like('comment-1'),
          taskId: regex(/^task-\d+$/, 'task-1'),
          authorId: like('user-1'),
          body: like('Arranco con esto.'),
          createdAt: like('2026-11-16T12:00:00.000Z'),
        }),
      });

    await pact.executeTest(async (mockServer) => {
      const { status, body } = await llamar(mockServer.url, '/tasks/task-1/comments', { token: 'token-de-prueba' });
      expect(status).toBe(200);
      expect(body.length).toBeGreaterThan(0);
      expect(body[0]).toHaveProperty('body');
      expect(body[0]).toHaveProperty('createdAt');
    });
  });
});
