import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../../lib/db';
import { badRequest, conflict, notFound, unauthorized } from '../../lib/http';
import { toPublicId } from '../../lib/ids';
import { assertEmail, assertPassword, normalizeEmail } from '../../lib/validation';
import { signToken } from '../../middleware/auth';

// Validacion anterior: rechazaba direcciones con + aceptadas por assertEmail.
// const EMAIL_PATTERN = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD_HASH_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1000;
const RESET_TOKEN_BYTES = 24;
const RESET_TOKEN_DURATION_MS = 60 * 60 * 1000;

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export function serializeUser(u: {
  id: number;
  email: string;
  name: string | null;
  createdAt: Date;
}): PublicUser {
  return {
    id: toPublicId('user', u.id),
    email: u.email,
    name: u.name,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function register(body: Record<string, unknown>) {
  const email = assertEmail(body.email);
  const password = assertPassword(body.password);
  const name = typeof body.name === 'string' ? body.name.trim() : null;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw conflict('Email already registered');

  const user = await db.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, PASSWORD_HASH_ROUNDS), name },
  });

  return {
    user: serializeUser(user),
    token: signToken({ userId: user.id, email: user.email }),
  };
}

export async function login(body: Record<string, unknown>) {
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw unauthorized('Invalid credentials');

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw unauthorized('Account temporarily locked. Try again later.');
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const attempts = user.failedAttempts + 1;
    const data: { failedAttempts: number; lockedUntil?: Date } = { failedAttempts: attempts };
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      data.lockedUntil = new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS);
    }
    await db.user.update({ where: { id: user.id }, data });
    throw unauthorized('Invalid credentials');
  }

  if (user.lockedUntil) {
    await db.user.update({ where: { id: user.id }, data: { lockedUntil: null } });
  }

  return {
    user: serializeUser(user),
    token: signToken({ userId: user.id, email: user.email }),
  };
}

export async function forgotPassword(body: Record<string, unknown>) {
  const email = assertEmail(body.email);

  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw notFound('No account found for that email');

  await db.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + RESET_TOKEN_DURATION_MS),
    },
  });

  // No hay servicio de email en el proyecto: el token se devuelve en la respuesta.
  return { message: 'Password reset requested', token };
}

export async function resetPassword(body: Record<string, unknown>) {
  const token = typeof body.token === 'string' ? body.token : '';
  const newPassword = assertPassword(body.newPassword);

  const record = await db.passwordResetToken.findUnique({ where: { token } });
  if (!record) throw badRequest('Invalid or expired reset token');

  await db.user.update({
    where: { id: record.userId },
    data: {
      passwordHash: await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS),
      failedAttempts: 0,
      lockedUntil: null,
    },
  });

  return { message: 'Password updated' };
}
