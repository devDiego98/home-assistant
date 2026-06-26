import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { cameras } from '../db/schema/index';
import { config } from '../config';

const cameraRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get('/', async (_request, reply) => {
    const rows = await db.select().from(cameras);
    return reply.send({ success: true, data: rows });
  });

  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const [camera] = await db.select().from(cameras).where(eq(cameras.id, request.params.id)).limit(1);
    if (!camera) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Camera not found' } });
    return reply.send({ success: true, data: camera });
  });

  fastify.get<{ Params: { id: string } }>('/:id/stream', async (request, reply) => {
    const [camera] = await db.select().from(cameras).where(eq(cameras.id, request.params.id)).limit(1);
    if (!camera) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Camera not found' } });

    const frigateId = camera.frigateId ?? camera.id;
    const hlsUrl = `${config.FRIGATE_URL}/api/${frigateId}/hls/index.m3u8`;

    return reply.send({
      success: true,
      data: {
        cameraId: camera.id,
        protocol: 'hls',
        url: hlsUrl,
      },
    });
  });

  fastify.get<{ Params: { id: string } }>('/:id/recordings', async (request, reply) => {
    const [camera] = await db.select().from(cameras).where(eq(cameras.id, request.params.id)).limit(1);
    if (!camera) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Camera not found' } });

    const frigateId = camera.frigateId ?? camera.id;
    const frigateRes = await fetch(`${config.FRIGATE_URL}/api/${frigateId}/recordings`);
    const recordings = await frigateRes.json();

    return reply.send({ success: true, data: recordings });
  });
};

export default cameraRoutes;
