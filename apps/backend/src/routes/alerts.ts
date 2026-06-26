import type { FastifyPluginAsync } from 'fastify';
import { eq, desc, and, gte, lte, isNull, isNotNull } from 'drizzle-orm';
import { db } from '../db/index';
import { alerts } from '../db/schema/index';

const alertRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get<{ Querystring: { acknowledged?: string; from?: string; to?: string; limit?: string; offset?: string } }>(
    '/',
    async (request, reply) => {
      const { acknowledged, from, to, limit = '20', offset = '0' } = request.query;

      const conditions = [];
      if (acknowledged === 'true') conditions.push(isNotNull(alerts.acknowledgedAt));
      if (acknowledged === 'false') conditions.push(isNull(alerts.acknowledgedAt));
      if (from) conditions.push(gte(alerts.createdAt, new Date(from)));
      if (to) conditions.push(lte(alerts.createdAt, new Date(to)));

      const rows = await db
        .select()
        .from(alerts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(alerts.createdAt))
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      return reply.send({ success: true, data: rows });
    },
  );

  fastify.post<{ Params: { id: string } }>('/:id/acknowledge', async (request, reply) => {
    const [alert] = await db.select().from(alerts).where(eq(alerts.id, request.params.id)).limit(1);
    if (!alert) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Alert not found' } });

    await db.update(alerts).set({ acknowledgedAt: new Date() }).where(eq(alerts.id, request.params.id));

    return reply.send({ success: true, data: { id: request.params.id, acknowledged: true } });
  });
};

export default alertRoutes;
