import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { floorLights } from '../db/schema/index';
import { tuyaService } from '../services/tuya';
import type { CreateFloorLightRequest } from '@casa/shared';

const floorRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate);

  // Get all floor lights with live Tuya state
  fastify.get('/', async (_request, reply) => {
    const lights = await db.select().from(floorLights);

    // Enrich with live state from Tuya if configured
    if (tuyaService.isConfigured() && lights.length > 0) {
      const enriched = await Promise.all(
        lights.map(async (light) => {
          try {
            const status = await tuyaService.getDeviceStatus(light.tuyaDeviceId);
            const switchStatus = status.find((s) => s.code === 'switch_led');
            const brightnessStatus = status.find((s) => s.code === 'bright_value_v2');
            return {
              ...light,
              isOn: switchStatus ? Boolean(switchStatus.value) : light.isOn,
              brightness: brightnessStatus ? Math.round((Number(brightnessStatus.value) / 1000) * 100) : light.brightness,
            };
          } catch {
            return light;
          }
        }),
      );
      return reply.send({ success: true, data: enriched });
    }

    return reply.send({ success: true, data: lights });
  });

  // Place a new light on the floor plan
  fastify.post<{ Body: CreateFloorLightRequest }>('/', async (request, reply) => {
    const { name, tuyaDeviceId, positionX, positionY } = request.body;
    if (!name || !tuyaDeviceId || positionX == null || positionY == null) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } });
    }

    const [light] = await db.insert(floorLights).values({ name, tuyaDeviceId, positionX, positionY }).returning();
    return reply.status(201).send({ success: true, data: light });
  });

  // Update position or name
  fastify.put<{ Params: { id: string }; Body: Partial<CreateFloorLightRequest> }>('/:id', async (request, reply) => {
    const updates: Partial<typeof floorLights.$inferInsert> = {};
    const { name, positionX, positionY } = request.body;
    if (name !== undefined) updates.name = name;
    if (positionX !== undefined) updates.positionX = positionX;
    if (positionY !== undefined) updates.positionY = positionY;
    updates.updatedAt = new Date();

    const [updated] = await db.update(floorLights).set(updates).where(eq(floorLights.id, request.params.id)).returning();
    if (!updated) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Light not found' } });
    return reply.send({ success: true, data: updated });
  });

  // Toggle light on/off
  fastify.post<{ Params: { id: string }; Body: { on: boolean; brightness?: number } }>(
    '/:id/toggle',
    async (request, reply) => {
      const [light] = await db.select().from(floorLights).where(eq(floorLights.id, request.params.id)).limit(1);
      if (!light) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Light not found' } });

      const { on, brightness } = request.body;

      if (tuyaService.isConfigured()) {
        if (brightness !== undefined) {
          await tuyaService.setBrightness(light.tuyaDeviceId, brightness);
        } else {
          await tuyaService.toggleLight(light.tuyaDeviceId, on);
        }
      }

      const [updated] = await db
        .update(floorLights)
        .set({ isOn: on, brightness: brightness ?? light.brightness, updatedAt: new Date() })
        .where(eq(floorLights.id, request.params.id))
        .returning();

      // Broadcast to WebSocket clients
      await fastify.redis.publish('ws:broadcast', JSON.stringify({
        type: 'device_state_changed',
        payload: { deviceId: light.id, state: { power: on, brightness } },
        timestamp: new Date().toISOString(),
      }));

      return reply.send({ success: true, data: updated });
    },
  );

  // Remove a light from the floor plan
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    await db.delete(floorLights).where(eq(floorLights.id, request.params.id));
    return reply.send({ success: true, data: null });
  });
};

export default floorRoutes;
