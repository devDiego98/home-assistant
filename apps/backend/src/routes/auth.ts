import { createHash, randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { users, refreshTokens } from '../db/schema/index';
import type { LoginRequest, LoginResponse } from '@casa/shared';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: LoginRequest }>('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: body.error.flatten() } });
    }

    const [user] = await db.select().from(users).where(eq(users.email, body.data.email)).limit(1);
    if (!user) {
      return reply.status(401).send({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    const hash = createHash('sha256').update(body.data.password).digest('hex');
    if (hash !== user.passwordHash) {
      return reply.status(401).send({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    const accessToken = fastify.jwt.sign({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokens).values({ userId: user.id, token: refreshToken, expiresAt });

    const response: LoginResponse = {
      user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() },
      tokens: { accessToken, refreshToken, expiresIn: 900 },
    };

    return reply.send({ success: true, data: response });
  });

  fastify.post('/refresh', async (request, reply) => {
    const { token } = request.body as { token: string };
    if (!token) return reply.status(400).send({ success: false, error: { code: 'MISSING_TOKEN', message: 'Refresh token required' } });

    const [stored] = await db.select().from(refreshTokens).where(eq(refreshTokens.token, token)).limit(1);
    if (!stored || stored.expiresAt < new Date()) {
      return reply.status(401).send({ success: false, error: { code: 'INVALID_TOKEN', message: 'Refresh token invalid or expired' } });
    }

    const [user] = await db.select().from(users).where(eq(users.id, stored.userId)).limit(1);
    if (!user) return reply.status(401).send({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });

    await db.delete(refreshTokens).where(eq(refreshTokens.token, token));

    const accessToken = fastify.jwt.sign({ userId: user.id, email: user.email, role: user.role });
    const newRefreshToken = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(refreshTokens).values({ userId: user.id, token: newRefreshToken, expiresAt });

    return reply.send({ success: true, data: { accessToken, refreshToken: newRefreshToken, expiresIn: 900 } });
  });

  fastify.post('/logout', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { token } = request.body as { token?: string };
    if (token) {
      await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
    }
    return reply.send({ success: true, data: null });
  });
};

export default authRoutes;
