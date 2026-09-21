import type { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { rooms, floorLights, roomPresets } from '../db/schema/index';
import { scenesService } from '../services/scenes';
import type { CreateRoomRequest, PartySceneAction, ApplyColorRequest, ApplyWhiteRequest, CreateRoomPresetRequest } from '@casa/shared';

const roomRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get('/', async (_request, reply) => {
    const [allRooms, allLights] = await Promise.all([
      db.select().from(rooms),
      db.select().from(floorLights),
    ]);

    const data = allRooms.map((room) => {
      const lights = allLights.filter((l) => l.roomId === room.id);
      return {
        ...room,
        lightIds: lights.map((l) => l.id),
        lightsOn: lights.filter((l) => l.isOn).length,
        lightCount: lights.length,
        partyActive: scenesService.isPartyActive(room.id),
      };
    });

    return reply.send({ success: true, data });
  });

  fastify.post<{ Body: CreateRoomRequest }>('/', async (request, reply) => {
    const { name } = request.body;
    if (!name?.trim()) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Room name is required' } });
    }
    const [room] = await db.insert(rooms).values({ name: name.trim() }).returning();
    return reply.status(201).send({ success: true, data: room });
  });

  fastify.put<{ Params: { id: string }; Body: CreateRoomRequest }>('/:id', async (request, reply) => {
    const { name } = request.body;
    if (!name?.trim()) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Room name is required' } });
    }
    const [updated] = await db
      .update(rooms)
      .set({ name: name.trim(), updatedAt: new Date() })
      .where(eq(rooms.id, request.params.id))
      .returning();
    if (!updated) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Room not found' } });
    return reply.send({ success: true, data: updated });
  });

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    scenesService.stopParty(request.params.id);
    await db.delete(rooms).where(eq(rooms.id, request.params.id));
    return reply.send({ success: true, data: null });
  });

  // Turn every light in the room on/off with one call
  fastify.post<{ Params: { id: string }; Body: { on: boolean } }>('/:id/toggle', async (request, reply) => {
    const lights = await db.select().from(floorLights).where(eq(floorLights.roomId, request.params.id));
    const { on } = request.body;

    scenesService.stopParty(request.params.id);
    await scenesService.toggleRoom(lights.map((l) => l.tuyaDeviceId), on);

    if (lights.length > 0) {
      await db.update(floorLights).set({ isOn: on, updatedAt: new Date() }).where(eq(floorLights.roomId, request.params.id));
    }

    await fastify.redis.publish('ws:broadcast', JSON.stringify({
      type: 'room_state_changed',
      payload: { roomId: request.params.id, on },
      timestamp: new Date().toISOString(),
    }));

    return reply.send({ success: true, data: { on, lightCount: lights.length } });
  });

  // Party mode: server-side interval cycles random colors every 500ms until stopped
  fastify.post<{ Params: { id: string }; Body: { action: PartySceneAction } }>(
    '/:id/scenes/party',
    async (request, reply) => {
      const { action } = request.body;
      if (action === 'stop') {
        scenesService.stopParty(request.params.id);
        return reply.send({ success: true, data: { partyActive: false } });
      }

      const lights = await db.select().from(floorLights).where(eq(floorLights.roomId, request.params.id));
      if (lights.length === 0) {
        return reply.status(400).send({ success: false, error: { code: 'NO_LIGHTS', message: 'This room has no lights to run party mode on' } });
      }
      scenesService.startParty(request.params.id, lights.map((l) => l.tuyaDeviceId));
      return reply.send({ success: true, data: { partyActive: true } });
    },
  );

  // Apply an arbitrary color to every light in the room (one-shot, not animated)
  fastify.post<{ Params: { id: string }; Body: ApplyColorRequest }>('/:id/scenes/color', async (request, reply) => {
    const lights = await db.select().from(floorLights).where(eq(floorLights.roomId, request.params.id));
    if (lights.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'NO_LIGHTS', message: 'This room has no lights' } });
    }

    const { h, s, v } = request.body;
    scenesService.stopParty(request.params.id);
    await scenesService.applyColor(lights.map((l) => l.tuyaDeviceId), h, s, v);
    await db.update(floorLights).set({ isOn: true, updatedAt: new Date() }).where(eq(floorLights.roomId, request.params.id));

    return reply.send({ success: true, data: { applied: true } });
  });

  // Apply white/warm light to every light in the room
  fastify.post<{ Params: { id: string }; Body: ApplyWhiteRequest }>('/:id/scenes/white', async (request, reply) => {
    const lights = await db.select().from(floorLights).where(eq(floorLights.roomId, request.params.id));
    if (lights.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'NO_LIGHTS', message: 'This room has no lights' } });
    }

    const { brightness, colorTemp } = request.body;
    scenesService.stopParty(request.params.id);
    await scenesService.applyWhite(lights.map((l) => l.tuyaDeviceId), brightness, colorTemp);
    await db.update(floorLights).set({ isOn: true, brightness, updatedAt: new Date() }).where(eq(floorLights.roomId, request.params.id));

    return reply.send({ success: true, data: { applied: true } });
  });

  fastify.get<{ Params: { id: string } }>('/:id/presets', async (request, reply) => {
    const presets = await db.select().from(roomPresets).where(eq(roomPresets.roomId, request.params.id));
    return reply.send({ success: true, data: presets });
  });

  fastify.post<{ Params: { id: string }; Body: CreateRoomPresetRequest }>('/:id/presets', async (request, reply) => {
    const { name, mode, h, s, brightness, colorTemp } = request.body;
    if (!name?.trim()) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Preset name is required' } });
    }
    if (mode !== 'colour' && mode !== 'white') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'mode must be "colour" or "white"' } });
    }

    const [preset] = await db.insert(roomPresets).values({
      roomId: request.params.id,
      name: name.trim(),
      mode,
      hue: mode === 'colour' ? h ?? null : null,
      saturation: mode === 'colour' ? s ?? null : null,
      brightness,
      colorTemp: mode === 'white' ? colorTemp ?? null : null,
    }).returning();

    return reply.status(201).send({ success: true, data: preset });
  });

  fastify.post<{ Params: { id: string; presetId: string } }>('/:id/presets/:presetId/apply', async (request, reply) => {
    const [preset] = await db.select().from(roomPresets)
      .where(and(eq(roomPresets.id, request.params.presetId), eq(roomPresets.roomId, request.params.id)))
      .limit(1);
    if (!preset) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Preset not found' } });

    const lights = await db.select().from(floorLights).where(eq(floorLights.roomId, request.params.id));
    if (lights.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'NO_LIGHTS', message: 'This room has no lights' } });
    }

    scenesService.stopParty(request.params.id);
    const tuyaDeviceIds = lights.map((l) => l.tuyaDeviceId);
    if (preset.mode === 'colour') {
      await scenesService.applyColor(tuyaDeviceIds, preset.hue!, preset.saturation!, Math.round((preset.brightness / 100) * 1000));
    } else {
      await scenesService.applyWhite(tuyaDeviceIds, preset.brightness, preset.colorTemp!);
    }
    await db.update(floorLights).set({ isOn: true, updatedAt: new Date() }).where(eq(floorLights.roomId, request.params.id));

    return reply.send({ success: true, data: { applied: true } });
  });

  fastify.delete<{ Params: { id: string; presetId: string } }>('/:id/presets/:presetId', async (request, reply) => {
    await db.delete(roomPresets).where(and(eq(roomPresets.id, request.params.presetId), eq(roomPresets.roomId, request.params.id)));
    return reply.send({ success: true, data: null });
  });
};

export default roomRoutes;
