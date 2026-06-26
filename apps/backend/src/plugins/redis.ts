import fp from 'fastify-plugin';
import Redis from 'ioredis';
import type { FastifyPluginAsync } from 'fastify';
import { config } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(config.REDIS_URL);

  redis.on('error', (err) => fastify.log.error({ err }, 'Redis error'));

  fastify.decorate('redis', redis);
  fastify.addHook('onClose', async () => redis.quit());
};

export default fp(redisPlugin, { name: 'redis' });
