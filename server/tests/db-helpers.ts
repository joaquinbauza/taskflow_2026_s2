import { db } from '../src/lib/db';

// Helpers para el Arrange: preparar escenarios directo en la base cuando la API
// no ofrece el camino (o cuando el endpoint que lo haría es justo el que tiene un bug).
// Lo que se verifica (Act + Assert) siempre pasa por la API.

export const num = (publicId: string) => Number(publicId.split('-')[1]);

export async function addMemberDb(projectId: string, userId: string, role = 'MEMBER') {
  await db.projectMember.create({
    data: { projectId: num(projectId), userId: num(userId), role },
  });
}

export async function archiveProjectDb(projectId: string) {
  await db.project.update({ where: { id: num(projectId) }, data: { archived: true } });
}

export async function setTaskStatusDb(taskId: string, status: string) {
  await db.task.update({ where: { id: num(taskId) }, data: { status } });
}

export { db };
