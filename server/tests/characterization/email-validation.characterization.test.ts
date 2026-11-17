/**
 * Caracterización · Smell 1 (Duplicated Code): validación de email.
 * Antes de 18e7f19 había tres validaciones distintas (checkEmail en auth,
 * EMAIL_CHECK en proyectos y assertEmail en lib/validation). Hoy las tres
 * rutas usan assertEmail. Se fija qué aceptan, cómo normalizan y qué mensaje
 * de error devuelve cada una.
 */
import request from 'supertest';
import { app, auth, createProject, registerUser } from '../helpers';
import { etiqueta, resumen } from './golden';

const EMAILS: unknown[] = [
  'simple@test.com',
  'Mayus.Con.Puntos@Test.COM',
  '  con-espacios@test.com  ',
  'alias+etiqueta@test.com',
  'ñandú@test.uy',
  'a@b.c',
  'a@b',
  'sin-arroba.com',
  'dos@@test.com',
  'con espacio@test.com',
  '',
  123,
  null,
];

describe('Caracterización · validación de email (assertEmail)', () => {
  it('POST /auth/register', async () => {
    const resultados: Record<string, unknown> = {};
    for (const email of EMAILS) {
      const res = await request(app).post('/api/auth/register').send({ email, password: 'Password1' });
      resultados[etiqueta(email)] = res.status === 201
        ? { status: res.status, email: res.body.user.email }
        : resumen(res);
    }
    expect(resultados).toMatchSnapshot();
  });

  it('POST /auth/forgot-password', async () => {
    const resultados: Record<string, unknown> = {};
    for (const email of [...EMAILS, 'no-registrado@test.com']) {
      const res = await request(app).post('/api/auth/forgot-password').send({ email });
      resultados[etiqueta(email)] = resumen(res);
    }
    expect(resultados).toMatchSnapshot();
  });

  it('POST /projects/:id/members', async () => {
    const owner = await registerUser('owner-emails@test.com');
    const project = await createProject(owner.token, 'Proyecto emails');
    const resultados: Record<string, unknown> = {};
    for (const email of [...EMAILS, 'no-registrado@test.com']) {
      const res = await request(app)
        .post(`/api/projects/${project.id}/members`)
        .set(auth(owner.token))
        .send({ email });
      resultados[etiqueta(email)] = res.status === 201
        ? { status: res.status, email: res.body.email, role: res.body.role }
        : resumen(res);
    }
    expect(resultados).toMatchSnapshot();
  });
});
