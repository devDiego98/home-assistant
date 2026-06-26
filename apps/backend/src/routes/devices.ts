import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { devices } from '../db/schema/index';

const deviceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get('/', async (_request, reply) => {
    const rows = await db.select().from(devices);
    return reply.send({ success: true, data: rows });
  });

  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const [device] = await db.select().from(devices).where(eq(devices.id, request.params.id)).limit(1);
    if (!device) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Device not found' } });
    return reply.send({ success: true, data: device });
  });

  fastify.post<{ Params: { id: string }; Body: { command: string; value: unknown } }>(
    '/:id/command',
    async (request, reply) => {
      const [device] = await db.select().from(devices).where(eq(devices.id, request.params.id)).limit(1);
      if (!device) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Device not found' } });

      const { command, value } = request.body;
      const mqttTopic = device.mqttTopic ?? `zigbee2mqtt/${device.id}/set`;

      await fastify.redis.publish('device:command', JSON.stringify({ deviceId: device.id, topic: mqttTopic, command, value }));

      return reply.send({ success: true, data: { queued: true } });
    },
  );
};

export default deviceRoutes;
