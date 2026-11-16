import request from 'supertest';
import { addMember, app, auth, createProject, registerUser } from './helpers';

describe('Miembros', () => {
  it('el owner agrega un miembro por email', async () => {
    const owner = await registerUser('members-owner@test.com');
    const invitee = await registerUser('members-invitee@test.com');
    const project = await createProject(owner.token, 'Proyecto con miembros');

    const res = await addMember(owner.token, project.id, invitee.res.body.user.email);

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('members-invitee@test.com');
    expect(res.body.role).toBe('MEMBER');
  });

  it('rechaza un email invalido', async () => {
    const owner = await registerUser('members-bademail@test.com');
    const project = await createProject(owner.token, 'Proyecto con email invalido');

    const res = await addMember(owner.token, project.id, 'no-es-un-email');

    expect(res.status).toBe(400);
  });

  it('rechaza agregar dos veces al mismo miembro', async () => {
    const owner = await registerUser('members-duplicate@test.com');
    const invitee = await registerUser('members-duplicate-invitee@test.com');
    const project = await createProject(owner.token, 'Proyecto con duplicado');

    await addMember(owner.token, project.id, 'members-duplicate-invitee@test.com');
    const res = await addMember(owner.token, project.id, 'members-duplicate-invitee@test.com');

    expect(res.status).toBe(409);
  });

  it('rechaza que alguien que no es el owner agregue miembros', async () => {
    const owner = await registerUser('members-notowner@test.com');
    const outsider = await registerUser('members-outsider@test.com');
    const project = await createProject(owner.token, 'Proyecto ajeno');

    const res = await addMember(outsider.token, project.id, 'members-notowner@test.com');

    expect(res.status).toBe(403);
  });

  it('el owner quita a un miembro', async () => {
    const owner = await registerUser('members-remove-owner@test.com');
    const member = await registerUser('members-remove-member@test.com');
    const project = await createProject(owner.token, 'Proyecto para sacar miembro');
    await addMember(owner.token, project.id, 'members-remove-member@test.com');

    const res = await request(app)
      .delete(`/api/projects/${project.id}/members/${member.id}`)
      .set(auth(owner.token));

    expect(res.status).toBe(204);
  });
});
