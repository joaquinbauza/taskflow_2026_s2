import { Server } from 'http';
import { AddressInfo } from 'net';
import path from 'path';
import bcrypt from 'bcryptjs';
import { Verifier } from '@pact-foundation/pact';
import { createApp } from '../../src/app';
import { db } from '../../src/lib/db';
import { signToken } from '../../src/middleware/auth';

let server: Server;
let baseUrl: string;
let token = '';
let secuencia = 0;

// Un email distinto por usuario de cada estado, para no chocar con el 409 de email repetido.
function emailUnico(prefijo: string): string {
  secuencia += 1;
  return `${prefijo}-${Date.now()}-${secuencia}@test.com`;
}

async function usuarioConSesion(prefijo: string, nombre: string) {
  const user = await db.user.create({
    data: { email: emailUnico(prefijo), name: nombre, passwordHash: 'x' },
  });
  token = signToken({ userId: user.id, email: user.email });
  return user;
}

beforeAll(async () => {
  // La API real, en un puerto libre y con la base temporal de tests/setup.ts
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('Verificación del provider: TaskFlowAPI', () => {
  it('cumple el contrato con TaskFlowWeb', async () => {
    await new Verifier({
      provider: 'TaskFlowAPI',
      providerBaseUrl: baseUrl,
      // El handout dice "TaskFlowWebTaskFlowAPI.json" (errata): el consumer genera este nombre.
      pactUrls: [path.resolve(process.cwd(), 'pacts/TaskFlowWeb-TaskFlowAPI.json')],
      // Cambia el token falso del contrato por uno real (solo si la request trae token)
      requestFilter: (req, _res, next) => {
        if (req.headers['authorization']) {
          req.headers['authorization'] = `Bearer ${token}`;
        }
        next();
      },
      // Prepara los datos de cada "given" del consumer (texto idéntico, letra por letra)
      stateHandlers: {
        'ana tiene un proyecto': async () => {
          const ana = await usuarioConSesion('ana', 'Ana');
          const project = await db.project.create({
            data: {
              name: 'Rediseño del sitio',
              description: 'Renovación completa del sitio',
              ownerId: ana.id,
            },
          });
          await db.projectMember.create({
            data: { projectId: project.id, userId: ana.id, role: 'OWNER' },
          });
        },

        'ana tiene una sesión válida': async () => {
          await usuarioConSesion('ana-sesion', 'Ana');
        },

        // Idempotente: si ana@test.com ya existe, se le vuelve a poner la contraseña y
        // se limpia el bloqueo. El hash se calcula igual que en auth.service.ts (bcrypt, 10).
        'existe ana@test.com con contraseña Password1': async () => {
          const passwordHash = await bcrypt.hash('Password1', 10);
          await db.user.upsert({
            where: { email: 'ana@test.com' },
            update: { passwordHash, failedAttempts: 0, lockedUntil: null, name: 'Ana' },
            create: { email: 'ana@test.com', passwordHash, name: 'Ana' },
          });
        },

        // El path del contrato es fijo (task-1): la tarea se crea con id 1 explícito si
        // todavía no existe, y la sesión pasa a ser de un miembro de su proyecto.
        'la tarea task-1 tiene comentarios': async () => {
          const autor = await usuarioConSesion('autor-comentarios', 'Autor');
          let tarea = await db.task.findUnique({ where: { id: 1 } });
          if (!tarea) {
            const project = await db.project.create({
              data: { name: 'Proyecto con comentarios', ownerId: autor.id },
            });
            tarea = await db.task.create({
              data: { id: 1, projectId: project.id, title: 'Tarea con comentarios' },
            });
          }
          await db.projectMember.upsert({
            where: { projectId_userId: { projectId: tarea.projectId, userId: autor.id } },
            update: {},
            create: { projectId: tarea.projectId, userId: autor.id, role: 'MEMBER' },
          });
          await db.comment.create({
            data: { taskId: tarea.id, authorId: autor.id, body: 'Arranco con esto.' },
          });
        },
      },
    }).verifyProvider();
  });
});
