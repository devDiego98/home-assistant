import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index';
import { rooms, floorLights } from '../db/schema/index';
import { tuyaService } from '../services/tuya';
import { tuyaLocalService } from '../services/tuyaLocal';
import type { TuyaSyncResult } from '@casa/shared';

function deriveRoomName(deviceName: string): string {
  const stripped = deviceName.trim().replace(/[\s\-_]+\d+\s*$/, '').trim();
  return stripped || deviceName.trim();
}

const tuyaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate);

  // Pull every Tuya device, skip already-linked ones, group the rest into rooms by name
  // (stripping a trailing number, e.g. "Living Room 1" -> "Living Room") and link them.
  fastify.post('/devices/sync', async (_request, reply) => {
    if (!tuyaService.isConfigured()) {
      return reply.status(503).send({ success: false, error: { code: 'TUYA_NOT_CONFIGURED', message: 'Tuya credentials not set in server .env' } });
    }

    try {
      const [tuyaDevices, existingLights, existingRooms] = await Promise.all([
        tuyaService.listDevices(),
        db.select().from(floorLights),
        db.select().from(rooms),
      ]);

      const linkedDeviceIds = new Set(existingLights.map((l) => l.tuyaDeviceId));
      const roomIdByName = new Map(existingRooms.map((r) => [r.name.toLowerCase(), r.id]));
      const unlinkedDevices = tuyaDevices.filter((d) => !linkedDeviceIds.has(d.id));

      const result: TuyaSyncResult = { linked: 0, roomsCreated: 0, skipped: tuyaDevices.length - unlinkedDevices.length };

      await db.transaction(async (tx) => {
        for (const device of unlinkedDevices) {
          const roomName = deriveRoomName(device.name);
          const roomKey = roomName.toLowerCase();
          let roomId = roomIdByName.get(roomKey);

          if (!roomId) {
            const [room] = await tx.insert(rooms).values({ name: roomName }).returning();
            if (!room) throw new Error(`Failed to create room "${roomName}"`);
            roomId = room.id;
            roomIdByName.set(roomKey, roomId);
            result.roomsCreated += 1;
          }

          await tx.insert(floorLights).values({ name: device.name, tuyaDeviceId: device.id, roomId });
          result.linked += 1;
        }
      });

      return reply.send({ success: true, data: result });
    } catch (err) {
      fastify.log.error(err, 'Tuya sync error');
      return reply.status(502).send({ success: false, error: { code: 'TUYA_ERROR', message: String(err) } });
    }
  });

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
          await tuyaLocalService.setBrightness(request.params.id, brightness);
        } else {
          await tuyaLocalService.toggleLight(request.params.id, on);
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
