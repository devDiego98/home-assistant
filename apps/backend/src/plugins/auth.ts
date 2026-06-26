import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyPluginAsync } from 'fastify';
import { config } from '../config';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; email: string; role: string };
    user: { userId: string; email: string; role: string };
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN },
  });

  fastify.decorate('authenticate', async function (request: Parameters<typeof fastify.authenticate>[0], reply: Parameters<typeof fastify.authenticate>[1]) {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
    }
  });
};

export default fp(authPlugin, { name: 'auth' });
