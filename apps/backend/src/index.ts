import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import authPlugin from './plugins/auth';
import redisPlugin from './plugins/redis';
import authRoutes from './routes/auth';
import deviceRoutes from './routes/devices';
import cameraRoutes from './routes/cameras';
import alertRoutes from './routes/alerts';
import wsRoutes from './routes/ws';
import tuyaRoutes from './routes/tuya';
import floorRoutes from './routes/floor';

const fastify = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: config.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
  },
});

await fastify.register(cors, { origin: config.NODE_ENV === 'development' });
await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' });
await fastify.register(websocket);
await fastify.register(redisPlugin);
await fastify.register(authPlugin);

await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(deviceRoutes, { prefix: '/api/devices' });
await fastify.register(cameraRoutes, { prefix: '/api/cameras' });
await fastify.register(alertRoutes, { prefix: '/api/alerts' });
await fastify.register(wsRoutes, { prefix: '/api/ws' });
await fastify.register(tuyaRoutes, { prefix: '/api/tuya' });
await fastify.register(floorRoutes, { prefix: '/api/floor/lights' });

fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

try {
  await fastify.listen({ port: config.PORT, host: config.HOST });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
