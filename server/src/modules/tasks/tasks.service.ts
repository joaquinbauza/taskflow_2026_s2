import { db } from '../../lib/db';
import { badRequest, forbidden, notFound } from '../../lib/http';
import { formatDueDate, parseDueDate, parsePublicId, toPublicId } from '../../lib/ids';
import {
  assertOptionalString,
  assertPriority,
  assertStatus,
  assertString,
  Status,
} from '../../lib/validation';
import { isMember } from '../../middleware/membership';
import { assertTransition } from './transitions';

export interface TaskRow {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: number | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeTask(t: TaskRow, extra: Record<string, unknown> = {}) {
  return {
    id: toPublicId('task', t.id),
    projectId: toPublicId('proj', t.projectId),
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assigneeId: t.assigneeId === null ? null : toPublicId('user', t.assigneeId),
    dueDate: formatDueDate(t.dueDate),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    ...extra,
  };
}

async function parseAssigneeId(value: unknown, projectId: number): Promise<number | null> {
  if (value === null) return null;
  const id = parsePublicId(value, 'user');
  if (id === null) throw badRequest('assigneeId must be a valid user id');
  if (!(await isMember(id, projectId))) {
    throw badRequest('The assignee must be a member of the project');
  }
  return id;
}

async function resolveStatusChange(task: TaskRow, userId: number, value: unknown): Promise<Status | null> {
  if (value === undefined) return null;
  const requested = assertStatus(value);
  if (requested === task.status) return null;

  if (task.assigneeId !== userId) {
    const membership = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId: task.projectId, userId } },
    });
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw forbidden('Only the assignee or a project admin can change the status');
    }
  }

  assertTransition(task.status as Status, requested);
  return requested;
}

export async function createTask(projectId: number, userId: number, body: Record<string, unknown>) {
  const title = assertString(body.title, 'title', 3, 200);
  const description = assertOptionalString(body.description, 'description', 500);
  const priority = body.priority === undefined ? 'MEDIUM' : assertPriority(body.priority);

  const assigneeId = body.assigneeId === undefined ? null : await parseAssigneeId(body.assigneeId, projectId);

  const dueDate = body.dueDate === undefined ? undefined : parseDueDate(body.dueDate);
  if (dueDate === undefined && body.dueDate !== undefined) {
    throw badRequest('dueDate must be a calendar date in YYYY-MM-DD format');
  }

  const task = await db.task.create({
    data: {
      ...(body as object),
      projectId,
      title,
      description: description ?? null,
      priority,
      assigneeId,
      dueDate: dueDate ?? null,
    } as never,
  });

  await db.taskHistory.create({
    data: { taskId: task.id, changedById: userId, fromStatus: null, toStatus: task.status },
  });

  return serializeTask(task);
}

/**
 * Actualiza una tarea: valida los campos recibidos, aplica las reglas de
 * autorización, resuelve la transición de estado, escribe el historial y
 * devuelve la tarea serializada.
 */
export async function updateTask(taskId: number, userId: number, body: Record<string, unknown>) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw notFound('Task not found');

  const data: Record<string, unknown> = {};

  if (body.title !== undefined) {
    data.title = assertString(body.title, 'title', 3, 200);
  }

  if (body.description !== undefined) {
    const description = assertOptionalString(body.description, 'description', 500);
    data.description = description ?? null;
  }

  if (body.priority !== undefined) {
    data.priority = assertPriority(body.priority);
  }

  if (body.dueDate !== undefined) {
    const parsed = parseDueDate(body.dueDate);
    if (parsed === undefined) {
      throw badRequest('dueDate must be a calendar date in YYYY-MM-DD format');
    }
    data.dueDate = parsed;
  }

  if (body.assigneeId !== undefined) {
    data.assigneeId = await parseAssigneeId(body.assigneeId, task.projectId);
  }

  const nextStatus = await resolveStatusChange(task, userId, body.status);

  if (nextStatus !== null) {
    data.status = nextStatus;
  }

  if (Object.keys(data).length === 0) {
    return serializeTask(task);
  }

  const updated = await db.task.update({ where: { id: taskId }, data });

  if (nextStatus !== null) {
    await db.taskHistory.create({
      data: {
        taskId,
        changedById: userId,
        fromStatus: task.status,
        toStatus: nextStatus,
      },
    });
  }

  return serializeTask(updated);
}

export async function deleteTask(taskId: number): Promise<void> {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw notFound('Task not found');

  await db.comment.deleteMany({ where: { taskId } });
  await db.taskHistory.deleteMany({ where: { taskId } });
  await db.taskTag.deleteMany({ where: { taskId } });
  await db.task.delete({ where: { id: taskId } });
}

const MAX_TAGS_PER_TASK = 10;

export async function addTag(taskId: number, rawName: unknown) {
  if (typeof rawName !== 'string' || rawName.trim().length < 1 || rawName.trim().length > 30) {
    throw badRequest('Tag name must be between 1 and 30 characters');
  }
  const name = rawName.trim();

  const current = await db.taskTag.count({ where: { taskId } });
  if (current >= MAX_TAGS_PER_TASK) {
    throw badRequest(`A task can have at most ${MAX_TAGS_PER_TASK} tags`);
  }

  let tag = await db.tag.findFirst({ where: { name } });
  if (!tag) tag = await db.tag.create({ data: { name } });

  await db.taskTag.create({ data: { taskId, tagId: tag.id } });

  return { id: toPublicId('tag', tag.id), name: tag.name };
}

export async function removeTag(taskId: number, tagId: number): Promise<void> {
  const link = await db.taskTag.findFirst({ where: { taskId, tagId } });
  if (!link) throw notFound('The task does not have that tag');
  await db.taskTag.delete({ where: { id: link.id } });
}

export async function listTags(taskId: number) {
  const links = await db.taskTag.findMany({ where: { taskId }, include: { tag: true } });
  return links.map((l) => ({ id: toPublicId('tag', l.tag.id), name: l.tag.name }));
}
