/**
 * Caracterización · validación del nombre de proyecto (projects.controller.ts).
 * 18e7f19 la unificó en validateProjectName; de67599 la volvió a duplicar en
 * create() y update() (Duplicated Code de nuevo). Se fija que las dos copias
 * se comportan igual, para poder unificarlas otra vez sin riesgo.
 */
import request from 'supertest';
import { app, auth, createProject, registerUser } from '../helpers';
import { etiqueta, resumen } from './golden';

const NOMBRES: unknown[] = ['abc', '  abc  ', 'ab', '   ', '', 'a'.repeat(100), 'a'.repeat(101), 123, null];

describe('Caracterización · nombre de proyecto', () => {
  it('POST /projects y PATCH /projects/:id con los mismos nombres', async () => {
    const { token } = await registerUser('nombres@test.com');
    const crear: Record<string, unknown> = {};
    const editar: Record<string, unknown> = {};
    for (const [i, name] of NOMBRES.entries()) {
      const c = await request(app).post('/api/projects').set(auth(token)).send({ name });
      crear[etiqueta(name)] = c.status === 201 ? { status: c.status, name: etiqueta(c.body.name) } : resumen(c);
      if (c.status === 201) await request(app).delete(`/api/projects/${c.body.id}`).set(auth(token));

      const p = await createProject(token, `Para editar ${i}`);
      const u = await request(app).patch(`/api/projects/${p.id}`).set(auth(token)).send({ name });
      editar[etiqueta(name)] = u.status === 200 ? { status: u.status, name: etiqueta(u.body.name) } : resumen(u);
      await request(app).delete(`/api/projects/${p.id}`).set(auth(token));
    }
    expect({ crear, editar }).toMatchSnapshot();
  });
});
