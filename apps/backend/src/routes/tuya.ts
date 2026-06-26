import type { FastifyPluginAsync } from 'fastify';
import { tuyaService } from '../services/tuya';

const tuyaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get('/devices', async (_request, reply) => {
    if (!tuyaService.isConfigured()) {
      return reply.status(503).send({ success: false, error: { code: 'TUYA_NOT_CONFIGURED', message: 'Tuya credentials not set in server .env' } });
    }
    try {
      const devices = await tuyaService.listDevices();
      return reply.send({ success: true, data: devices });
    } catch (err) {
      fastify.log.error(err, 'Tuya listDevices error');
      return reply.status(502).send({ success: false, error: { code: 'TUYA_ERROR', message: String(err) } });
    }
  });

  fastify.get<{ Params: { id: string } }>('/devices/:id/status', async (request, reply) => {
    try {
      const status = await tuyaService.getDeviceStatus(request.params.id);
      return reply.send({ success: true, data: status });
    } catch (err) {
      return reply.status(502).send({ success: false, error: { code: 'TUYA_ERROR', message: String(err) } });
    }
  });

  fastify.post<{ Params: { id: string }; Body: { on: boolean; brightness?: number } }>(
    '/devices/:id/control',
    async (request, reply) => {
      const { on, brightness } = request.body;
      try {
        if (brightness !== undefined) {
          await tuyaService.setBrightness(request.params.id, brightness);
        } else {
          await tuyaService.toggleLight(request.params.id, on);
        }
        return reply.send({ success: true, data: { on, brightness } });
      } catch (err) {
        fastify.log.error(err, 'Tuya control error');
        return reply.status(502).send({ success: false, error: { code: 'TUYA_ERROR', message: String(err) } });
      }
    },
  );
};

export default tuyaRoutes;
