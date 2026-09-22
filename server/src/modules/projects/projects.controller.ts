import { NextFunction, Request, Response } from 'express';
import { db } from '../../lib/db';
import { badRequest, conflict, forbidden, notFound } from '../../lib/http';
import { parsePublicId, toPublicId } from '../../lib/ids';
//import { assertOptionalString } from '../../lib/validation';
import { assertEmail, assertOptionalString } from '../../lib/validation';

//const EMAIL_CHECK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function serialize(p: {
  id: number;
  name: string;
  description: string | null;
  ownerId: number;
  archived: boolean;
  createdAt: Date;
}) {
  return {
    id: toPublicId('proj', p.id),
    name: p.name,
    description: p.description,
    ownerId: toPublicId('user', p.ownerId),
    archived: p.archived,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (name.length > 100) {
      throw badRequest('name must be between 3 and 100 characters');
    }
    const description = assertOptionalString(req.body?.description, 'description', 500);

    const duplicate = await db.project.findFirst({ where: { ownerId: userId, name } });
    if (duplicate) throw conflict('You already have a project with that name');

    const project = await db.project.create({
      data: { name, description: description ?? null, ownerId: userId },
    });
    await db.projectMember.create({
      data: { projectId: project.id, userId, role: 'OWNER' },
    });

    res.status(201).json(serialize(project));
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const projects = await db.project.findMany({
      where: {
        OR: [
          { ownerId: userId, archived: false },
          { members: { some: { userId } }, ownerId: { not: userId } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(projects.map(serialize));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const id = parsePublicId(req.params.projectId, 'proj');
    if (id === null) throw notFound('Project not found');

    const project = await db.project.findUnique({ where: { id } });
    if (!project) throw notFound('Project not found');
    if (project.ownerId !== userId) {
      const membership = await db.projectMember.findUnique({
        where: { projectId_userId: { projectId: id, userId } },
      });
      if (membership) throw forbidden('Only the project owner can edit it');
      throw notFound('Project not found');
    }

    const data: { name?: string; description?: string | null } = {};

    if (req.body?.name !== undefined) {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (name.length < 3 || name.length > 100) {
        throw badRequest('name must be between 3 and 100 characters');
      }
      const duplicate = await db.project.findFirst({
        where: { ownerId: userId, name, id: { not: id } },
      });
      if (duplicate) throw conflict('You already have a project with that name');
      data.name = name;
    }

    if (req.body?.description !== undefined) {
      data.description = assertOptionalString(req.body.description, 'description', 500) ?? null;
    }

    res.json(serialize(await db.project.update({ where: { id }, data })));
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const id = parsePublicId(req.params.projectId, 'proj');
    if (id === null) throw notFound('Project not found');

    const project = await db.project.findUnique({ where: { id } });
    if (!project) throw notFound('Project not found');
    if (project.ownerId !== userId) {
      const membership = await db.projectMember.findUnique({
        where: { projectId_userId: { projectId: id, userId } },
      });
      if (membership) throw forbidden('Only the project owner can delete it');
      throw notFound('Project not found');
    }

    await db.project.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const id = parsePublicId(req.params.projectId, 'proj');
    if (id === null) throw notFound('Project not found');

    const project = await db.project.findUnique({ where: { id } });
    if (!project) throw notFound('Project not found');
    if (project.ownerId !== userId) throw forbidden('Only the project owner can manage members');

    const email = assertEmail(req.body?.email, 'email must be a valid address');

    const user = await db.user.findUnique({ where: { email } });
    if (!user) throw notFound('No user found with that email');

    const existing = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: user.id } },
    });
    if (existing) throw conflict('User is already a member of this project');

    await db.projectMember.create({ data: { projectId: id, userId: user.id, role: 'MEMBER' } });
    res.status(201).json({
      projectId: toPublicId('proj', id),
      userId: toPublicId('user', user.id),
      email: user.email,
      role: 'MEMBER',
    });
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actingUserId = req.user!.userId;
    const id = parsePublicId(req.params.projectId, 'proj');
    const memberId = parsePublicId(req.params.userId, 'user');
    if (id === null || memberId === null) throw notFound('Project not found');

    const project = await db.project.findUnique({ where: { id } });
    if (!project) throw notFound('Project not found');
    if (project.ownerId !== actingUserId) {
      throw forbidden('Only the project owner can manage members');
    }
    if (memberId === project.ownerId) {
      throw badRequest('The project owner cannot be removed from the project');
    }

    const membership = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: memberId } },
    });
    if (!membership) throw notFound('User is not a member of this project');

    await db.projectMember.delete({ where: { id: membership.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
